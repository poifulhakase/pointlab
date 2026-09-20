"""適時開示（TDnet）の取得（SPEC 5.2b / 7.4 の `HeadlineSource` 実装）。

ニュース/カタリスト分析AI に渡す**一次情報**。決算短信・上方修正・自社株買い・
TOB・提携などの開示を、銘柄コードで取る。

なぜ適時開示だけにするか:
  - SPEC 7.4 が一次情報（TDnet/IR）を最優先と定めている。報道メディアは補助で、
    SNS・掲示板は原則として判断の根拠にしない（風説・情報操作の温床）。
  - 株探・Yahoo!ファイナンス等の**スクレイピングは規約で禁じられている**ので使わない。

🔴 **point-in-time**（SPEC 5.2 / 9.1）
   判断日より**後**に出た開示を渡さない。渡すと「未来のニュースを見て買った」ことになり、
   成績が嘘になる（`--force` で過去日を再実行するときに必ず踏む）。
   開示の `pubdate` を見て切る。同じ理由で「取得時刻」ではなく**公表日時**で判定する。

🔴 **取れなかった**ことと**開示が無かった**ことを混ぜない。
   前者は自分の失敗、後者はその銘柄の事実。下流の要約文で区別する（`news.none_result`）。

🔵 取得元は Yanoshin の TDnet WebAPI（無料・APIキー不要）。TDnet 自体に公開APIが無く、
   JPX の閲覧サービスは直近31日ぶんをコード検索できないため。
   落ちていても**その日の実行は止めない**（材料なしとして続ける）。
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any

import requests

log = logging.getLogger(__name__)

# 🔴 開示のタイトルだけで本文PDFは読まない（本文の取得と要約はコストが跳ねる）。
#    タイトルに材料の種類はほぼ出る（「上方修正」「自己株式取得」「業務提携」）。
ENDPOINT = "https://webapi.yanoshin.jp/webapi/tdnet/list/{code}.json"


class TdnetHeadlines:
    """銘柄コードで適時開示を引く。`agents/news.py` の HeadlineSource として差す。"""

    def __init__(self, cfg, *, session: Any = None):
        self.cfg = cfg
        self.session = session or requests.Session()
        self.endpoint = str(cfg.get("news.endpoint", ENDPOINT))
        self.lookback_days = int(cfg.get("news.lookback_days", 30))
        self.max_items = int(cfg.get("news.max_items", 8))
        self.timeout = float(cfg.get("news.timeout_sec", 15))

    def fetch_headlines(self, ticker: str, as_of: date | None = None
                        ) -> list[dict[str, Any]]:
        """[{'date','title','body','source_tier'}]。取れなければ空配列。"""
        code = ticker.split(".")[0]
        # 🔴 取りこぼさないよう API には多めに要求し、絞るのはこちらでやる
        #    （期間で切ったあと max_items 件に落とす）。
        url = self.endpoint.format(code=code)
        try:
            res = self.session.get(url, params={"limit": max(self.max_items * 3, 20)},
                                   timeout=self.timeout,
                                   headers={"User-Agent": "robotrade/1.0"})
            res.raise_for_status()
            items = (res.json() or {}).get("items") or []
        except Exception as exc:  # noqa: BLE001
            # 🔴 ここで例外を上げるとその日の実行が止まる。材料なしとして続ける。
            log.warning("適時開示の取得に失敗 %s: %s", ticker, exc)
            return []

        cutoff = None
        if as_of is not None:
            cutoff = as_of - timedelta(days=self.lookback_days)

        rows: list[dict[str, Any]] = []
        for item in items:
            row = item.get("Tdnet") or {}
            published = _published_on(row.get("pubdate"))
            if published is None:
                continue
            if as_of is not None and (published > as_of or published < cutoff):
                continue          # 🔴 未来の開示と、古すぎる開示は渡さない
            title = str(row.get("title") or "").strip()
            if not title:
                continue
            rows.append({
                "date": published.isoformat(),
                "title": title,
                "body": "",       # 本文PDFは読まない（タイトルに材料の種類が出る）
                "source_tier": "primary",   # TDnet＝発行体自身の開示＝一次情報
                "url": str(row.get("document_url") or ""),
            })

        rows.sort(key=lambda r: r["date"], reverse=True)
        return rows[: self.max_items]


def _published_on(pubdate: Any) -> date | None:
    """`2026-08-07 17:00:00` → date。読めない値は捨てる（捏造しない）。"""
    if not pubdate:
        return None
    text = str(pubdate).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    log.warning("開示の日付が読めない: %r", pubdate)
    return None


def from_config(cfg) -> Any:
    """config の `news.source` で取得元を決める。未知の値は**黙って無視しない**。"""
    source = str(cfg.get("news.source", "none") or "none").lower()
    if source in ("none", "off", ""):
        return None
    if source == "tdnet":
        return TdnetHeadlines(cfg)
    raise ValueError(f"news.source が不正: {source!r}（tdnet / none）")
