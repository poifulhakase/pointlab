"""Discord Incoming Webhook 通知（SPEC 11）。

Bot 常駐は不要。チャンネル設定で発行した URL に POST するだけ。
🔴 Webhook URL は実質パスワード（知っていれば誰でも投稿できる）なので .env から読む。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import requests

log = logging.getLogger(__name__)

# Discord の制限
MAX_CONTENT = 2000
MAX_EMBEDS = 10
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


def truncate(text: str, limit: int) -> str:
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
            payload["fields"] = self.fields[:25]
        if self.footer:
            payload["footer"] = {"text": truncate(self.footer, 2048)}
        return payload


class DiscordNotifier:
    """Webhook が無ければ黙って何もしない（ローカル検証を止めないため）。

    🔴 「送ったつもり」を作らないよう、無効時は send() が False を返し理由をログに出す。
    """

    def __init__(self, webhook_url: str | None, *, username: str = "swing-lab", enabled: bool = True,
                 timeout: float = 10.0):
        self.webhook_url = webhook_url
        self.username = username
        self.enabled = enabled and bool(webhook_url)
        self.timeout = timeout
        if enabled and not webhook_url:
            log.warning("Discord: DISCORD_WEBHOOK_URL が未設定なので通知は飛ばさない")

    def send(self, content: str = "", embeds: list[Embed] | None = None) -> bool:
        if not self.enabled:
            log.info("Discord: 無効のため送信せず（content=%s）", truncate(content, 80))
            return False

        payload: dict[str, Any] = {"username": self.username}
        if content:
            payload["content"] = truncate(content, MAX_CONTENT)
        if embeds:
            payload["embeds"] = [e.to_payload() for e in embeds[:MAX_EMBEDS]]
        if "content" not in payload and "embeds" not in payload:
            raise ValueError("content も embeds も空では送れない")

        try:
            res = requests.post(self.webhook_url, json=payload, timeout=self.timeout)
        except requests.RequestException as exc:
            log.error("Discord: 送信に失敗 %s", exc)
            return False

        if res.status_code >= 300:
            log.error("Discord: %s %s", res.status_code, truncate(res.text, 300))
            return False
        return True

    def send_batched(self, embeds: list[Embed], content: str = "") -> bool:
        """embeds が10件を超える/6000文字を超える場合に分割して送る。"""
        ok = True
        chunk: list[Embed] = []
        size = 0
        first = True
        for e in embeds:
            payload = e.to_payload()
            length = len(str(payload))
            if chunk and (len(chunk) >= MAX_EMBEDS or size + length > MAX_EMBED_TOTAL):
                ok = self.send(content if first else "", chunk) and ok
                first = False
                chunk, size = [], 0
            chunk.append(e)
            size += length
        if chunk or first:
            ok = self.send(content if first else "", chunk) and ok
        return ok

    def send_test(self) -> bool:
        """疎通確認（SPEC 14 Phase 1）。"""
        embed = Embed(
            title="swing-lab 疎通確認",
            description="Webhook は生きています。ここに日次の判断サマリが届きます。",
            color=COLOR_INFO,
            footer=DISCLAIMER,
        )
        embed.add_field("チャートリンクの例", f"[7203 トヨタ]({tradingview_url('7203.T')})")
        return self.send(embeds=[embed])


def from_config(cfg) -> DiscordNotifier:
    return DiscordNotifier(
        cfg.secrets.discord_webhook_url,
        username=cfg.get("discord.username", "swing-lab"),
        enabled=bool(cfg.get("discord.enabled", True)),
    )
