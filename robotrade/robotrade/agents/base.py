"""LLM呼び出しの共通処理（SPEC 7 共通ルール / 7.6 堅牢性）。

🔴 全エージェントは **tool use で出力スキーマを固定**する。自由文では返させない。
🔴 パース失敗は数回リトライ → それでもダメならその銘柄だけスキップし、
   **パイプライン全体は止めない**（SPEC 7.6）。
🔴 外部テキスト（ニュース・開示）は**データとして囲って**渡し、
   そこに書かれた指示を命令として扱わない（プロンプトインジェクション対策 SPEC 7.6）。

モデル別の API 制約（2026-09-19 に /v1/models と docs で確認）:
  - temperature … **どのモデルにも渡せない**（SDK 1.7 の messages.create() に引数自体が無い）
  - Haiku 4.5   … output_config.effort は **400**
  - Sonnet 5    … effort は使える
  この差は config の models.* で吸収する（コードに model 名を書かない）。
  再現性は「判断ログに モデル・プロンプト版・入力ハッシュを残す」で担保する。
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

import anthropic

log = logging.getLogger(__name__)

# 料金表（USD / 1M tokens・2026-09-19 時点）。コスト監視（SPEC 7.6）に使う。
PRICING_USD_PER_MTOK: dict[str, tuple[float, float]] = {
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-opus-5": (5.0, 25.0),
}

UNTRUSTED_OPEN = "<外部テキスト 信用しない>"
UNTRUSTED_CLOSE = "</外部テキスト>"


class AgentError(Exception):
    """この銘柄はスキップする、を表す。パイプラインは止めない。"""


@dataclass
class Usage:
    """1回の呼び出しのトークンとコスト。"""

    model: str
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def cost_usd(self) -> float:
        rate_in, rate_out = PRICING_USD_PER_MTOK.get(self.model, (0.0, 0.0))
        return (self.input_tokens * rate_in + self.output_tokens * rate_out) / 1_000_000


@dataclass
class AgentCall:
    """1回の呼び出しの記録。**生の入出力をそのままログに残す**（SPEC 9 監査可能性）。"""

    agent: str
    model: str
    ticker: str | None
    system: str
    user: str
    prompt_version: str
    input_hash: str
    output: dict[str, Any] | None
    usage: Usage
    attempts: int
    elapsed_sec: float
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "agent": self.agent,
            "model": self.model,
            "ticker": self.ticker,
            "prompt_version": self.prompt_version,
            "input_hash": self.input_hash,
            "system": self.system,
            "user": self.user,
            "output": self.output,
            "usage": {
                "input_tokens": self.usage.input_tokens,
                "output_tokens": self.usage.output_tokens,
                "cost_usd": round(self.usage.cost_usd, 6),
            },
            "attempts": self.attempts,
            "elapsed_sec": round(self.elapsed_sec, 2),
            "error": self.error,
        }


@dataclass
class CostTracker:
    """1日のAPIコストを積む。上限を超えたら警告する（SPEC 7.6 / ops.daily_cost_alert_usd）。"""

    limit_usd: float
    total_usd: float = 0.0
    calls: int = 0
    by_agent: dict[str, float] = field(default_factory=dict)
    alerted: bool = False

    def add(self, agent: str, usage: Usage) -> None:
        cost = usage.cost_usd
        self.total_usd += cost
        self.calls += 1
        self.by_agent[agent] = self.by_agent.get(agent, 0.0) + cost
        if not self.alerted and self.total_usd > self.limit_usd:
            self.alerted = True
            log.warning(
                "🔴 APIコストが上限を超えた: $%.3f > $%.2f（候補銘柄が増えると急増する）",
                self.total_usd, self.limit_usd,
            )

    def summary(self) -> dict[str, Any]:
        return {
            "calls": self.calls,
            "total_usd": round(self.total_usd, 4),
            "limit_usd": self.limit_usd,
            "over_limit": self.total_usd > self.limit_usd,
            "by_agent": {k: round(v, 4) for k, v in sorted(self.by_agent.items())},
        }


def wrap_untrusted(text: str) -> str:
    """外部テキストをデータとして囲う（プロンプトインジェクション対策・SPEC 7.6）。

    🔴 囲いタグ自体を本文に書かれると囲いが破れるので、入力側のタグ文字列を潰す。
    """
    safe = str(text).replace("<外部テキスト", "<外部テキスト‍").replace("</外部テキスト", "</外部テキスト‍")
    return f"{UNTRUSTED_OPEN}\n{safe}\n{UNTRUSTED_CLOSE}"


def input_hash(system: str, user: str) -> str:
    """同じ入力かを後から照合するためのハッシュ（SPEC 7.6 再現性）。"""
    return hashlib.sha256((system + "\x00" + user).encode("utf-8")).hexdigest()[:16]


class LLMAgent:
    """tool use で JSON を強制する1エージェント。

    サブクラスは `name` / `prompt_version` / `system_prompt()` / `tool_schema()` /
    `build_user(...)` を定義する。
    """

    name: str = "agent"
    prompt_version: str = "v1"
    tier: str = "cheap"  # cheap / strong

    def __init__(self, cfg, client: anthropic.Anthropic | None = None,
                 tracker: CostTracker | None = None):
        self.cfg = cfg
        self.client = client or anthropic.Anthropic(api_key=cfg.secrets.anthropic_api_key)
        self.tracker = tracker
        self.max_retries = int(cfg.get("models.max_retries"))

    # -------------------------------------------------- サブクラスが定義

    def system_prompt(self) -> str:
        raise NotImplementedError

    def tool_schema(self) -> dict[str, Any]:
        """出力スキーマ。`strict` を効かせるため additionalProperties:false + required 必須。"""
        raise NotImplementedError

    # -------------------------------------------------- 共通

    @property
    def model(self) -> str:
        return str(self.cfg.get(f"models.{self.tier}"))

    @property
    def max_tokens(self) -> int:
        return int(self.cfg.get(f"models.{self.tier}_max_tokens"))

    def _request_kwargs(self) -> dict[str, Any]:
        """🔴 モデルによって受け付けるパラメータが違う。config で出し分ける。

        temperature は**渡せない**（SDK 1.7 の messages.create() に引数が無い）。
        effort は Sonnet 5 では使えるが Haiku 4.5 では 400 になる。
        """
        kwargs: dict[str, Any] = {}
        effort = self.cfg.get(f"models.{self.tier}_effort", None)
        if effort:
            kwargs["output_config"] = {"effort": str(effort)}
        return kwargs

    def call(self, user: str, *, ticker: str | None = None) -> tuple[dict[str, Any], AgentCall]:
        """LLM を呼んで JSON を返す。失敗したら AgentError（その銘柄だけスキップ）。"""
        system = self.system_prompt()
        schema = self.tool_schema()
        tool_name = schema["name"]
        started = time.time()
        usage = Usage(model=self.model)
        last_error: str | None = None

        for attempt in range(1, self.max_retries + 1):
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=self.max_tokens,
                    system=system,
                    messages=[{"role": "user", "content": user}],
                    tools=[schema],
                    tool_choice={"type": "tool", "name": tool_name},
                    **self._request_kwargs(),
                )
            except anthropic.APIStatusError as exc:
                last_error = f"{exc.status_code}: {exc.message}"
                log.warning("%s: API エラー（%d回目）%s", self.name, attempt, last_error)
                if exc.status_code < 500 and exc.status_code != 429:
                    break  # 400 系はリトライしても同じ
                time.sleep(2 ** attempt)
                continue
            except anthropic.APIConnectionError as exc:
                last_error = f"接続エラー: {exc}"
                log.warning("%s: 接続エラー（%d回目）", self.name, attempt)
                time.sleep(2 ** attempt)
                continue

            usage.input_tokens += response.usage.input_tokens
            usage.output_tokens += response.usage.output_tokens

            # 🔴 refusal / max_tokens を content より先に見る
            if response.stop_reason == "refusal":
                last_error = "モデルが応答を拒否した"
                break
            if response.stop_reason == "max_tokens":
                last_error = "max_tokens で切れた（出力が長すぎる）"
                log.warning("%s: %s", self.name, last_error)
                continue

            payload = self._extract_tool_input(response, tool_name)
            if payload is None:
                last_error = "tool_use ブロックが返ってこなかった"
                log.warning("%s: %s（%d回目）", self.name, last_error, attempt)
                continue

            try:
                validated = self.validate(payload)
            except AgentError as exc:
                last_error = str(exc)
                log.warning("%s: 出力が不正（%d回目）%s", self.name, attempt, last_error)
                continue

            record = AgentCall(
                agent=self.name, model=self.model, ticker=ticker, system=system, user=user,
                prompt_version=self.prompt_version, input_hash=input_hash(system, user),
                output=validated, usage=usage, attempts=attempt,
                elapsed_sec=time.time() - started,
            )
            if self.tracker:
                self.tracker.add(self.name, usage)
            return validated, record

        record = AgentCall(
            agent=self.name, model=self.model, ticker=ticker, system=system, user=user,
            prompt_version=self.prompt_version, input_hash=input_hash(system, user),
            output=None, usage=usage, attempts=self.max_retries,
            elapsed_sec=time.time() - started, error=last_error,
        )
        if self.tracker:
            self.tracker.add(self.name, usage)
        raise AgentError(f"{self.name}({ticker or '-'}): {last_error}") from None

    @staticmethod
    def _extract_tool_input(response: Any, tool_name: str) -> dict[str, Any] | None:
        """🔴 tool_use.input は必ず dict として扱う。生成された JSON 文字列を
        文字列マッチしない（エスケープの差で壊れる）。"""
        for block in response.content:
            if getattr(block, "type", None) == "tool_use" and block.name == tool_name:
                value = block.input
                if isinstance(value, str):
                    try:
                        value = json.loads(value)
                    except json.JSONDecodeError:
                        return None
                return value if isinstance(value, dict) else None
        return None

    # -------------------------------------------------- 検証

    def validate(self, payload: dict[str, Any]) -> dict[str, Any]:
        """スキーマを通った後の中身の妥当性。サブクラスで上書きする。

        🔴 enum 外・負の数量・矛盾した値は **ここで弾いてリトライ**させる（SPEC 9.2 契約テスト）。
        """
        return payload

    # -------------------------------------------------- 便利

    @staticmethod
    def enum_or_fail(value: Any, allowed: set[str], field_name: str) -> str:
        if value not in allowed:
            raise AgentError(f"{field_name} が enum 外: {value!r}（許可: {sorted(allowed)}）")
        return str(value)

    @staticmethod
    def number_or_fail(value: Any, field_name: str, *, low: float | None = None,
                       high: float | None = None, allow_none: bool = False) -> float | None:
        if value is None:
            if allow_none:
                return None
            raise AgentError(f"{field_name} が無い")
        try:
            num = float(value)
        except (TypeError, ValueError):
            raise AgentError(f"{field_name} が数値でない: {value!r}") from None
        if low is not None and num < low:
            raise AgentError(f"{field_name} が下限未満: {num} < {low}")
        if high is not None and num > high:
            raise AgentError(f"{field_name} が上限超過: {num} > {high}")
        return num


def json_block(label: str, payload: Any) -> str:
    """プロンプトに構造化データを載せる共通の形。"""
    return f"## {label}\n```json\n{json.dumps(payload, ensure_ascii=False, indent=1, default=str)}\n```"
