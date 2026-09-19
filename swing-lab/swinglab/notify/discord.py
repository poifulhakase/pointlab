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
"""

from __future__ import annotations

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


@dataclass
class Embed:
    title: str = ""
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


class DiscordNotifier:
    """1チャンネルぶんの Webhook。

    Webhook が無ければ黙って何もしない（ローカル検証を止めないため）。
    🔴 「送ったつもり」を作らないよう、無効時は send() が False を返し理由をログに出す。
    """

    def __init__(self, webhook_url: str | None, *, username: str = "ぽいロボ",
                 avatar_url: str | None = None, color: int = COLOR_INFO,
                 label: str = "", enabled: bool = True, timeout: float = 15.0):
        self.webhook_url = webhook_url
        self.username = username
        self.avatar_url = avatar_url
        self.color = color
        self.label = label or username
        self.enabled = enabled and bool(webhook_url)
        self.timeout = timeout
        if enabled and not webhook_url:
            log.warning("Discord[%s]: Webhook URL が未設定なので通知は飛ばさない", self.label)

    def _identity(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"username": self.username}
        if self.avatar_url:
            payload["avatar_url"] = self.avatar_url
        return payload

    def send(self, content: str = "", embeds: list[Embed] | None = None,
             files: list[Path] | None = None) -> bool:
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

        try:
            if files:
                # 画像添付は multipart。payload_json に本体を入れる（Discord の作法）。
                handles = [
                    ("files[%d]" % i, (p.name, p.open("rb"), "image/png"))
                    for i, p in enumerate(files) if p.exists()
                ]
                try:
                    res = requests.post(
                        self.webhook_url,
                        data={"payload_json": json.dumps(payload, ensure_ascii=False)},
                        files=handles, timeout=self.timeout,
                    )
                finally:
                    for _, (_, fh, _) in handles:
                        fh.close()
            else:
                res = requests.post(self.webhook_url, json=payload, timeout=self.timeout)
        except requests.RequestException as exc:
            log.error("Discord[%s]: 送信に失敗 %s", self.label, exc)
            return False

        if res.status_code >= 300:
            log.error("Discord[%s]: %s %s", self.label, res.status_code, truncate(res.text, 300))
            return False
        return True

    def send_batched(self, embeds: list[Embed], content: str = "",
                     files: list[Path] | None = None) -> bool:
        """embeds が10個 / 6000文字を超える場合に分割して送る（DISCORD.md 4章）。"""
        if not embeds:
            return self.send(content=content, files=files) if (content or files) else False

        ok = True
        chunk: list[Embed] = []
        size = 0
        first = True
        for e in embeds:
            length = e.size()
            if chunk and (len(chunk) >= MAX_EMBEDS or size + length > MAX_EMBED_TOTAL):
                ok = self.send(content if first else "", chunk) and ok
                first = False
                chunk, size = [], 0
            chunk.append(e)
            size += length
        if chunk:
            # 添付は最後のメッセージに付ける
            ok = self.send(content if first else "", chunk, files=files) and ok
        return ok

    def send_test(self) -> bool:
        """疎通確認（SPEC 14 Phase 1）。"""
        embed = Embed(
            title=f"疎通確認 — {self.label}",
            description="このチャンネルに通知が届きます。",
            color=self.color,
            footer=DISCLAIMER,
        )
        embed.add_field("チャートリンクの例", f"[7203 トヨタ]({tradingview_url('7203.T')})")
        return self.send(embeds=[embed])


class DiscordRouter:
    """チャンネル名 → Notifier。未設定のチャンネルは黙って落とす。

    🔴 `errors` が未設定のときだけは**他のチャンネルに寄せない**。
       異常をメインの通知に混ぜると、見たくない情報が毎日の一目を汚してノイズになる。
       未設定ならログに残すだけにする。
    """

    def __init__(self, cfg):
        self.cfg = cfg
        self.enabled = bool(cfg.get("discord.enabled", True))
        base = str(cfg.get("discord.avatar_base", "")).rstrip("/")
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
                enabled=self.enabled,
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
            color=self.poyon_color, label=f"{channel}/poyon", enabled=self.enabled,
        )

    def send_test_all(self) -> dict[str, bool]:
        return {name: n.send_test() for name, n in self.channels.items()}


def from_config(cfg) -> DiscordRouter:
    return DiscordRouter(cfg)
