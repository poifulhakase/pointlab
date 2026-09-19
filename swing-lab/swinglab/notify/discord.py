"""Discord Incoming Webhook 通知（SPEC 11 / DISCORD.md 1〜2章）。

Bot 常駐は不要。チャンネル設定で発行した URL に POST するだけ。
🔴 Webhook URL は実質パスワード（知っていれば誰でも投稿できる）ので .env から読む。

チャンネルは4つに分ける（DISCORD.md 1章）:
  decisions   … #判断サマリ（日次・引け後）  青
  fills       … #約定・保有（日次・引け後）  緑
  performance … #成績（週次）                紫
  errors      … #エラー・異常（イベント時）  赤

送信者は **ぽいロボ**（機械の正確さで事実を報告する）。
**ぽよん君**は節目だけ別送信者として一言添える（やりすぎない・DISCORD.md 2章）。

🔴 送信したら **message_id を必ず記録する**（SentLog）。
   Webhook は自分の投稿を**一覧できない**（読み取り権限が無い）ので、
   記録しそこねたメッセージは、あとから Discord の画面で手で消すしかなくなる。
"""

from __future__ import annotations

import datetime as dt
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import requests

log = logging.getLogger(__name__)

# Discord の制限（DISCORD.md 4章）
MAX_CONTENT = 2000
MAX_EMBEDS = 10
MAX_FIELDS = 25
MAX_FIELD_VALUE = 1024
MAX_EMBED_TOTAL = 6000

COLOR_BUY = 0x2ECC71      # 緑
COLOR_SELL = 0xE74C3C     # 赤
COLOR_HOLD = 0x95A5A6     # グレー
COLOR_INFO = 0x3498DB     # 青
COLOR_WARN = 0xF39C12     # 橙

ACTION_COLOR = {"buy": COLOR_BUY, "sell": COLOR_SELL, "hold": COLOR_HOLD}

DISCLAIMER = "※ 疑似トレードの実験であり投資助言ではありません"


def tradingview_url(ticker: str) -> str:
    """7203.T → TradingView の TSE:7203 チャートURL（SPEC 11 / 11.1）。"""
    code = ticker.split(".")[0]
    return f"https://www.tradingview.com/chart/?symbol=TSE:{code}"


def truncate(text: Any, limit: int) -> str:
    """Discord の上限で落ちないように切る。切ったことが分かるように … を付ける。"""
    if text is None:
        return ""
    text = str(text)
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


# ---------------------------------------------------------------- 送信記録


class SentLog:
    """送った message_id を追記で残す（あとで消せるようにするため）。

    🔴 Webhook は**自分が投稿したメッセージを一覧できない**（読み取り権限が無い）。
       削除には message_id が要るので、**送った瞬間に記録しておくしかない**。
    """

    def __init__(self, path: Path | str | None):
        self.path = Path(path) if path else None
        if self.path:
            self.path.parent.mkdir(parents=True, exist_ok=True)

    def record(self, *, channel: str, message_id: str, kind: str, run_date: str = "") -> None:
        if not self.path:
            return
        row = {
            "sent_at": dt.datetime.now().isoformat(timespec="seconds"),
            "channel": channel,
            "message_id": message_id,
            "kind": kind,
            "run_date": run_date,
        }
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    def rows(self) -> list[dict[str, Any]]:
        if not self.path or not self.path.exists():
            return []
        out: list[dict[str, Any]] = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                out.append(json.loads(line))
        return out

    def rewrite(self, rows: list[dict[str, Any]]) -> None:
        """消せたぶんを取り除いて書き戻す。"""
        if not self.path:
            return
        with self.path.open("w", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------- Embed


@dataclass
class Embed:
    title: str = ""
    url: str = ""                 # 見出しをクリックできるようにする
    description: str = ""
    color: int = COLOR_INFO
    fields: list[dict[str, Any]] = field(default_factory=list)
    footer: str = ""
    image_url: str = ""
    thumbnail_url: str = ""

    def add_field(self, name: str, value: str, inline: bool = False) -> "Embed":
        self.fields.append(
            {
                "name": truncate(name, 256),
                "value": truncate(value, MAX_FIELD_VALUE) or "—",
                "inline": inline,
            }
        )
        return self

    def to_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"color": self.color}
        if self.title:
            payload["title"] = truncate(self.title, 256)
        if self.url:
            payload["url"] = self.url
        if self.description:
            payload["description"] = truncate(self.description, 4096)
        if self.fields:
            payload["fields"] = self.fields[:MAX_FIELDS]
        if self.footer:
            payload["footer"] = {"text": truncate(self.footer, 2048)}
        if self.image_url:
            payload["image"] = {"url": self.image_url}
        if self.thumbnail_url:
            payload["thumbnail"] = {"url": self.thumbnail_url}
        return payload

    def size(self) -> int:
        """embed 全体の文字数（6000字上限の見積もり）。"""
        return len(json.dumps(self.to_payload(), ensure_ascii=False))


# ---------------------------------------------------------------- 1チャンネル


class DiscordNotifier:
    """1チャンネルぶんの Webhook。

    Webhook が無ければ黙って何もしない（ローカル検証を止めないため）。
    🔴 「送ったつもり」を作らないよう、無効時は send() が False を返し理由をログに出す。
    """

    def __init__(self, webhook_url: str | None, *, username: str = "ぽいロボ",
                 avatar_url: str | None = None, color: int = COLOR_INFO,
                 label: str = "", enabled: bool = True, timeout: float = 15.0,
                 sent_log: SentLog | None = None, channel: str = ""):
        self.webhook_url = webhook_url
        self.username = username
        self.avatar_url = avatar_url
        self.color = color
        self.label = label or username
        self.channel = channel or self.label
        self.sent_log = sent_log
        self.enabled = enabled and bool(webhook_url)
        self.timeout = timeout
        if enabled and not webhook_url:
            log.warning("Discord[%s]: Webhook URL が未設定なので通知は飛ばさない", self.label)

    # -------------------------------------------------- 送信

    def _identity(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"username": self.username}
        if self.avatar_url:
            payload["avatar_url"] = self.avatar_url
        return payload

    def _wait_url(self) -> str:
        """🔴 ?wait=true にすると投稿されたメッセージが JSON で返り message_id が取れる。

        これを記録しないと、あとから消せなくなる（Webhook は一覧を取れない）。
        """
        sep = "&" if "?" in (self.webhook_url or "") else "?"
        return f"{self.webhook_url}{sep}wait=true"

    def send(self, content: str = "", embeds: list[Embed] | None = None,
             files: list[Path] | None = None, *, kind: str = "",
             run_date: str = "") -> bool:
        if not self.enabled:
            log.info("Discord[%s]: 無効のため送信せず（%s）", self.label,
                     truncate(content or (embeds[0].title if embeds else ""), 60))
            return False

        payload = self._identity()
        if content:
            payload["content"] = truncate(content, MAX_CONTENT)
        if embeds:
            payload["embeds"] = [e.to_payload() for e in embeds[:MAX_EMBEDS]]
        if "content" not in payload and "embeds" not in payload and not files:
            raise ValueError("content も embeds も files も空では送れない")

        url = self._wait_url()
        try:
            if files:
                # 画像添付は multipart。payload_json に本体を入れる（Discord の作法）。
                handles = [
                    (f"files[{i}]", (p.name, p.open("rb"), "image/png"))
                    for i, p in enumerate(files) if p.exists()
                ]
                try:
                    res = requests.post(
                        url,
                        data={"payload_json": json.dumps(payload, ensure_ascii=False)},
                        files=handles, timeout=self.timeout,
                    )
                finally:
                    for _, (_, fh, _) in handles:
                        fh.close()
            else:
                res = requests.post(url, json=payload, timeout=self.timeout)
        except requests.RequestException as exc:
            log.error("Discord[%s]: 送信に失敗 %s", self.label, exc)
            return False

        if res.status_code >= 300:
            log.error("Discord[%s]: %s %s", self.label, res.status_code, truncate(res.text, 300))
            return False

        self._record(res, kind=kind, run_date=run_date)
        return True

    def _record(self, res: Any, *, kind: str, run_date: str) -> None:
        if self.sent_log is None:
            return
        try:
            message_id = (res.json() or {}).get("id")
        except (ValueError, AttributeError):
            message_id = None
        if message_id:
            self.sent_log.record(channel=self.channel, message_id=str(message_id),
                                 kind=kind or self.label, run_date=run_date)
        else:
            log.warning("Discord[%s]: message_id が取れなかった（後から消せない）", self.label)

    def send_batched(self, embeds: list[Embed], content: str = "",
                     files: list[Path] | None = None, *, kind: str = "",
                     run_date: str = "") -> bool:
        """embeds が10個 / 6000文字を超える場合に分割して送る（DISCORD.md 4章）。"""
        if not embeds:
            if content or files:
                return self.send(content=content, files=files, kind=kind, run_date=run_date)
            return False

        ok = True
        chunk: list[Embed] = []
        size = 0
        first = True
        for e in embeds:
            length = e.size()
            if chunk and (len(chunk) >= MAX_EMBEDS or size + length > MAX_EMBED_TOTAL):
                ok = self.send(content if first else "", chunk, kind=kind,
                               run_date=run_date) and ok
                first = False
                chunk, size = [], 0
            chunk.append(e)
            size += length
        if chunk:
            # 添付は最後のメッセージに付ける
            ok = self.send(content if first else "", chunk, files=files, kind=kind,
                           run_date=run_date) and ok
        return ok

    def send_test(self) -> bool:
        """疎通確認（SPEC 14 Phase 1）。`--purge-test` で後からまとめて消せる。"""
        embed = Embed(
            title=f"疎通確認 — {self.label}",
            description="このチャンネルに通知が届きます。",
            color=self.color,
            footer=DISCLAIMER,
        )
        embed.add_field("チャートリンクの例", f"[7203 トヨタ]({tradingview_url('7203.T')})")
        return self.send(embeds=[embed], kind="test")

    # -------------------------------------------------- 削除

    def delete_message(self, message_id: str) -> bool:
        """自分が投稿したメッセージを消す。

        すでに無い場合（404）も成功扱いにする（結果として「消えている」ため）。
        """
        if not self.webhook_url:
            return False
        try:
            res = requests.delete(f"{self.webhook_url}/messages/{message_id}",
                                  timeout=self.timeout)
        except requests.RequestException as exc:
            log.error("Discord[%s]: 削除に失敗 %s", self.label, exc)
            return False
        if res.status_code in (204, 404):
            return True
        log.error("Discord[%s]: 削除できない %s %s", self.label, res.status_code,
                  truncate(res.text, 200))
        return False


# ---------------------------------------------------------------- ルーター


class DiscordRouter:
    """チャンネル名 → Notifier。未設定のチャンネルは黙って落とす。

    🔴 `errors` が未設定のときだけは**他のチャンネルに寄せない**。
       異常をメインの通知に混ぜると、見たくない情報が毎日の一目を汚してノイズになる。
       未設定ならログに残すだけにする。
    """

    def __init__(self, cfg, sent_log: SentLog | None = None):
        self.cfg = cfg
        self.enabled = bool(cfg.get("discord.enabled", True))
        base = str(cfg.get("discord.avatar_base", "")).rstrip("/")
        self.sent_log = sent_log
        self.channels: dict[str, DiscordNotifier] = {}

        for name, spec in (cfg.get("discord.channels", {}) or {}).items():
            url = cfg.secrets.webhooks.get(name)
            avatar = spec.get("avatar")
            self.channels[name] = DiscordNotifier(
                url,
                username=spec.get("username", "ぽいロボ"),
                avatar_url=f"{base}/{avatar}" if (base and avatar) else None,
                color=int(spec.get("color", COLOR_INFO)),
                label=name,
                channel=name,
                enabled=self.enabled,
                sent_log=sent_log,
            )

        poyon = cfg.get("discord.poyon", {}) or {}
        self.poyon_username = poyon.get("username", "ぽよん君")
        self.poyon_avatar = (
            f"{base}/{poyon['avatar']}" if (base and poyon.get("avatar")) else None
        )
        self.poyon_color = int(poyon.get("color", COLOR_INFO))

    def __getitem__(self, name: str) -> DiscordNotifier:
        if name not in self.channels:
            raise KeyError(f"Discord のチャンネル定義が無い: {name}")
        return self.channels[name]

    @property
    def configured(self) -> list[str]:
        return [name for name, n in self.channels.items() if n.enabled]

    @property
    def missing(self) -> list[str]:
        return [name for name, n in self.channels.items() if not n.enabled]

    def poyon_on(self, channel: str) -> DiscordNotifier:
        """そのチャンネルに**ぽよん君として**一言送るための Notifier。"""
        base = self[channel]
        return DiscordNotifier(
            base.webhook_url, username=self.poyon_username, avatar_url=self.poyon_avatar,
            color=self.poyon_color, label=f"{channel}/poyon", channel=channel,
            enabled=self.enabled, sent_log=self.sent_log,
        )

    def send_test_all(self) -> dict[str, bool]:
        return {name: n.send_test() for name, n in self.channels.items()}

    def _deleter_for(self, channel: str) -> DiscordNotifier | None:
        """削除に使う Notifier を引く。

        🔴 note新着（NOTE_FEED.md）のように**router に登録していないチャンネル**でも
           後片付けはできなければならない。送信の経路は分けたまま（トレードの通知が
           note に流れないように）、削除だけは .env の Webhook から組み立てて届かせる。
           （分離を優先した結果、投稿できるのに消せないという状態を実際に作ってしまった）
        """
        known = self.channels.get(channel)
        if known is not None and known.enabled:
            return known
        url = self.cfg.secrets.webhooks.get(channel)
        if not url:
            return None
        return DiscordNotifier(url, label=channel, channel=channel, enabled=self.enabled)

    # -------------------------------------------------- まとめて削除

    def purge(self, *, kinds: set[str] | None = None, run_date: str | None = None,
              dry_run: bool = False) -> dict[str, Any]:
        """記録してある投稿を消す。

        `kinds` を指定するとその種別だけ（例: {"test"} で疎通確認だけ）。
        🔴 記録に無いメッセージは消せない（Webhook は一覧を取れない）。
        """
        if self.sent_log is None:
            return {"deleted": 0, "failed": 0, "kept": 0,
                    "note": "送信記録が無い（SentLog 未設定）"}

        rows = self.sent_log.rows()
        deleted = failed = 0
        kept: list[dict[str, Any]] = []
        detail: dict[str, int] = {}

        for row in rows:
            match = (kinds is None or row.get("kind") in kinds) and (
                run_date is None or row.get("run_date") == run_date
            )
            if not match:
                kept.append(row)
                continue
            if dry_run:
                detail[row["channel"]] = detail.get(row["channel"], 0) + 1
                kept.append(row)
                deleted += 1
                continue
            notifier = self._deleter_for(row["channel"])
            if notifier is None or not notifier.enabled:
                kept.append(row)
                failed += 1
                continue
            if notifier.delete_message(row["message_id"]):
                deleted += 1
                detail[row["channel"]] = detail.get(row["channel"], 0) + 1
            else:
                kept.append(row)
                failed += 1

        if not dry_run:
            self.sent_log.rewrite(kept)
        return {"deleted": deleted, "failed": failed, "kept": len(kept), "by_channel": detail}


def from_config(cfg, sent_log: SentLog | None = None) -> DiscordRouter:
    if sent_log is None:
        sent_log = SentLog(cfg.path("ops.log_dir") / "sent_messages.jsonl")
    return DiscordRouter(cfg, sent_log=sent_log)
