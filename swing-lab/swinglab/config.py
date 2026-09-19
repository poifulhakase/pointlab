"""config.yaml と .env の読み込み＋起動時バリデーション（SPEC 9.1）。

🔴 設定の矛盾・範囲外は**起動時に落とす**。動き出してから気づくと、
   本番（＝毎日の疑似トレード）に変な値が混ざったまま実績が貯まる。
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent


class ConfigError(Exception):
    """設定が矛盾している・範囲外。起動時に投げる。"""


@dataclass
class Secrets:
    anthropic_api_key: str | None
    discord_webhook_url: str | None


class Config:
    """dict をドット表記で引けるだけの薄いラッパ。

    `cfg.get("risk.max_positions")` のように引く。キーが無ければ ConfigError。
    """

    def __init__(self, raw: dict[str, Any], secrets: Secrets, root: Path):
        self.raw = raw
        self.secrets = secrets
        self.root = root

    def get(self, path: str, default: Any = ...) -> Any:
        node: Any = self.raw
        for part in path.split("."):
            if not isinstance(node, dict) or part not in node:
                if default is ...:
                    raise ConfigError(f"config に {path} がない")
                return default
            node = node[part]
        return node

    def path(self, path: str, default: Any = ...) -> Path:
        """config 内の相対パスを swing-lab ルート基準の絶対パスにする。"""
        value = self.get(path, default)
        p = Path(value)
        return p if p.is_absolute() else (self.root / p)


def _require_range(cfg: Config, key: str, low: float, high: float) -> None:
    value = cfg.get(key)
    if not isinstance(value, (int, float)) or not (low <= value <= high):
        raise ConfigError(f"{key} は {low}〜{high} の数値でなければならない（今: {value!r}）")


def validate(cfg: Config) -> list[str]:
    """矛盾は例外、気になるだけの点は警告文字列で返す。"""
    warnings: list[str] = []

    # --- 範囲 ---
    for key in (
        "risk.max_position_pct",
        "risk.max_total_exposure_pct",
        "risk.max_bucket_pct",
        "risk.risk_per_trade_pct",
        "risk.drawdown_throttle",
        "risk.market_drop_pct",
        "exec.max_volume_pct",
        "exec.max_entry_gap_pct",
        "screen.recent_move_pct",
    ):
        _require_range(cfg, key, 0.0, 1.0)

    if cfg.get("holding.min_days") < 1:
        raise ConfigError("holding.min_days は 1 以上")
    if cfg.get("holding.max_days") <= cfg.get("holding.min_days"):
        raise ConfigError("holding.max_days は holding.min_days より大きくなければならない")

    if cfg.get("screen.atr_min") >= cfg.get("screen.atr_max"):
        raise ConfigError("screen.atr_min は screen.atr_max より小さくなければならない")
    if cfg.get("screen.top_n") < 1:
        raise ConfigError("screen.top_n は 1 以上")

    if cfg.get("risk.stop_atr_min") >= cfg.get("risk.stop_atr_max"):
        raise ConfigError("risk.stop_atr_min は risk.stop_atr_max より小さくなければならない")

    if cfg.get("exec.lot_size") < 1:
        raise ConfigError("exec.lot_size は 1 以上")
    if cfg.get("exec.fill_rule") != "next_open":
        raise ConfigError("exec.fill_rule は next_open のみ対応（SPEC 10.2）")

    if cfg.get("risk.risk_off_action") not in ("halt_new", "lighten"):
        raise ConfigError("risk.risk_off_action は halt_new か lighten")
    if cfg.get("screen.penny_stock_policy") not in ("exclude", "allow"):
        raise ConfigError("screen.penny_stock_policy は exclude か allow")

    # --- 整合 ---
    # 1銘柄上限 × 最大保有数 が総エクスポージャー上限を下回ると、上限まで建てられない
    if cfg.get("risk.max_position_pct") * cfg.get("risk.max_positions") < cfg.get(
        "risk.max_total_exposure_pct"
    ):
        warnings.append(
            "risk: max_position_pct × max_positions が max_total_exposure_pct に届かない"
            "＝総エクスポージャー上限には構造的に到達できない"
        )
    if cfg.get("risk.risk_per_trade_pct") > cfg.get("risk.max_position_pct"):
        raise ConfigError(
            "risk.risk_per_trade_pct が max_position_pct を超えている"
            "（1トレードの想定損失が1銘柄の投資上限より大きいのは矛盾）"
        )
    if cfg.get("risk.max_bucket_pct") > cfg.get("risk.max_total_exposure_pct"):
        warnings.append("risk.max_bucket_pct が max_total_exposure_pct より大きい＝相関上限が効かない")

    # 🔴 ノートレード化の検知（SPEC 9.1）
    #    1銘柄あたりの投資上限より 1単元のコストが大きい銘柄は、
    #    プレフィルタを通っても**サイジングで必ず0株**になり、永久に約定しない。
    #    「候補は出るのに約定が貯まらない」という一番気づきにくい壊れ方なので起動時に弾く。
    position_cap_yen = cfg.get("capital.initial_cash") * cfg.get("risk.max_position_pct")
    lot = cfg.get("exec.lot_size")
    max_affordable_price = position_cap_yen / lot
    if cfg.get("screen.max_unit_cost") > position_cap_yen:
        warnings.append(
            f"🔴 買えない銘柄を通している: 1銘柄の投資上限は "
            f"{position_cap_yen:,.0f}円（資金{cfg.get('capital.initial_cash'):,.0f}×"
            f"{cfg.get('risk.max_position_pct')}）だが、screen.max_unit_cost は "
            f"{cfg.get('screen.max_unit_cost'):,.0f}円。"
            f"株価{max_affordable_price:,.0f}円を超える銘柄は必ず0株になる。"
            f"→ screen.max_unit_cost を {position_cap_yen:,.0f} まで下げるか、"
            f"capital.initial_cash か risk.max_position_pct を上げる"
        )
    if max_affordable_price < cfg.get("screen.min_price"):
        raise ConfigError(
            f"資金が足りず1銘柄も買えない: 買える上限株価 {max_affordable_price:,.0f}円 < "
            f"screen.min_price {cfg.get('screen.min_price')}円"
        )

    # 指標の足数が history_days に収まっているか
    need = max(cfg.get("indicators.sma")) * 5 + 10  # 週足SMA75 ぶん
    if cfg.get("indicators.history_days") < need:
        warnings.append(
            f"indicators.history_days={cfg.get('indicators.history_days')} は "
            f"週足SMA{max(cfg.get('indicators.sma'))} に必要な {need} 日に足りない"
        )
    if cfg.get("indicators.min_bars") > cfg.get("indicators.history_days"):
        raise ConfigError("indicators.min_bars が history_days を超えている")

    # 🔴 モデル別の API 制約（2026-09-19 に /v1/models と SDK の署名で確認）
    cheap = str(cfg.get("models.cheap"))
    for tier in ("cheap", "strong"):
        if cfg.get(f"models.{tier}_temperature", None) is not None:
            raise ConfigError(
                f"models.{tier}_temperature は使えない。"
                "Anthropic Python SDK 1.7 の messages.create() に temperature 引数が無い"
                "（4.6世代以降のモデルが受け付けないため削除された）。この行を消す"
            )
    if cfg.get("models.cheap_effort", None) is not None and cheap.startswith("claude-haiku"):
        raise ConfigError(
            f"models.cheap={cheap} は output_config.effort を受け付けない（400）。"
            "models.cheap_effort は書かない"
        )
    if cfg.get("models.parallel_workers") < 1:
        raise ConfigError("models.parallel_workers は 1 以上")
    if cfg.get("models.max_retries") < 1:
        raise ConfigError("models.max_retries は 1 以上")

    if not any(cfg.get(f"agents.{name}") for name in ("selector", "chart", "supply_demand", "news")):
        warnings.append("agents: 分析AIが全部オフ＝売買判断AIに渡す材料が無い")

    return warnings


def load(config_path: str | Path | None = None, *, root: Path | None = None) -> tuple[Config, list[str]]:
    """config.yaml と .env を読み、検証した Config を返す。"""
    root = Path(root) if root else ROOT
    config_path = Path(config_path) if config_path else (root / "config.yaml")
    if not config_path.exists():
        raise ConfigError(f"config が見つからない: {config_path}")

    with config_path.open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    if not isinstance(raw, dict):
        raise ConfigError(f"config の中身が辞書でない: {config_path}")

    load_dotenv(root / ".env")
    secrets = Secrets(
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY") or None,
        discord_webhook_url=os.environ.get("DISCORD_WEBHOOK_URL") or None,
    )

    cfg = Config(raw, secrets, root)
    warnings = validate(cfg)
    return cfg, warnings
