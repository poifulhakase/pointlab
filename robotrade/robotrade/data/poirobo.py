"""ぽいロボ（stock-calendar）のデータを読む層。

🔴 なぜ自前で取りに行かないか
   ぽいロボの `.github/workflows/fetch-data.yml` が毎日 JPX・日経・為替・VIX などを取得して
   `public/data/*.json` にコミットしている。同じものを ロボトレード がもう一度取りに行くと、
   **同じ数字の出どころが2つ**になり、食い違ったときにどちらが正か分からなくなる。
   だからここでは「読むだけ」。取得・更新の責任はぽいロボ側に残す。

🔴 鮮度（SPEC 13）
   ローカルのファイルは **git pull した時点のもの**。古いまま走らせると、
   「昨日の地合い」のつもりで1週間前の数字を見ることになる。
   `check_freshness()` で古ければ実行を止める（欠損を捏造しない）。
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)


class DataStaleError(Exception):
    """参照先データが古い。その日の実行は止める（SPEC 13）。"""


class DataMissingError(Exception):
    """参照先データが無い。"""


# 東証33業種 → 為替感応度（SPEC 5.3 銘柄プロファイル）
# 🔴 これは「閾値」ではなく分類表なのでコードに置く（config に出しても調整のしようがない）。
#    業種内でも個社差は大きいので、断定ではなく**傾向のラベル**として扱う。
FX_SENSITIVITY_BY_SECTOR: dict[str, str] = {
    # 円安メリット（輸出・海外売上比率が高い傾向）
    "輸送用機器": "yen_weak",
    "電気機器": "yen_weak",
    "機械": "yen_weak",
    "精密機器": "yen_weak",
    "鉄鋼": "yen_weak",
    "非鉄金属": "yen_weak",
    "ゴム製品": "yen_weak",
    "海運業": "yen_weak",
    # 円高メリット（輸入コスト低下・内需）
    "小売業": "yen_strong",
    "食料品": "yen_strong",
    "電気・ガス業": "yen_strong",
    "陸運業": "yen_strong",
    "空運業": "yen_strong",
    "石油・石炭製品": "yen_strong",
    "パルプ・紙": "yen_strong",
    "繊維製品": "yen_strong",
    "医薬品": "yen_strong",
}


@dataclass
class Stock:
    """ユニバースの1銘柄。"""

    code: str
    name: str
    sector: str
    ticker: str  # yfinance 用（7203.T）

    @property
    def fx_sensitivity(self) -> str:
        return FX_SENSITIVITY_BY_SECTOR.get(self.sector, "neutral")


class PoiroboData:
    """ぽいロボの public/data を読むだけのリーダ。"""

    def __init__(self, cfg):
        self.cfg = cfg
        self.data_dir = cfg.path("poirobo.data_dir")
        self.calendar_path = cfg.path("poirobo.calendar_json")
        self.margin_dir = cfg.path("poirobo.margin_weekly_dir")

    # -------------------------------------------------- 低レベル

    def _load(self, name: str) -> Any:
        path = self.data_dir / name
        if not path.exists():
            raise DataMissingError(
                f"ぽいロボのデータが見つからない: {path}\n"
                "stock-calendar を git pull したか確認する"
            )
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def _updated_at(payload: Any) -> datetime | None:
        value = payload.get("updatedAt") if isinstance(payload, dict) else None
        if not value:
            return None
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))

    # -------------------------------------------------- 鮮度

    def check_freshness(self, today: date | None = None) -> list[str]:
        """主要ファイルの更新日を見て、古ければ DataStaleError。

        戻り値は「古くはないが気になる」警告のリスト。
        """
        today = today or date.today()
        limit = int(self.cfg.get("poirobo.max_stale_days"))
        stale: list[str] = []
        warnings: list[str] = []

        for name in ("stock_master.json", "usdjpy.json", "vix.json", "topix.json"):
            try:
                payload = self._load(name)
            except DataMissingError as exc:
                stale.append(str(exc))
                continue
            updated = self._updated_at(payload)
            if updated is None:
                warnings.append(f"{name}: updatedAt が無く鮮度を判定できない")
                continue
            age = (today - updated.date()).days
            if age > limit:
                stale.append(f"{name}: {age}日前（{updated.date()}）の古いデータ")
            elif age > 2:
                warnings.append(f"{name}: {age}日前（{updated.date()}）")

        if not self.calendar_path.exists():
            stale.append(
                f"カレンダーが無い: {self.calendar_path}\n"
                "  → stock-calendar 直下で `npx tsx robotrade/scripts/export_calendar.mjs` を実行する"
            )

        if stale:
            raise DataStaleError(
                "参照データが古い/欠けているので、この日の実行は止める（欠損を捏造しない）:\n  - "
                + "\n  - ".join(stale)
            )
        return warnings

    # -------------------------------------------------- ユニバース

    def universe(self) -> list[Stock]:
        """全上場銘柄（stock_master.json）。"""
        payload = self._load("stock_master.json")
        rows = payload.get("data", [])
        exclude_etf = bool(self.cfg.get("universe.exclude_etf", True))
        limit = int(self.cfg.get("universe.max_symbols", 0))

        stocks: list[Stock] = []
        for row in rows:
            code = str(row.get("code", "")).strip()
            if not code:
                continue
            sector = str(row.get("sector33") or "").strip()
            # 🔴 ETF/REIT は sector33 が空 or「その他」で、個別株のスイングとは値動きの質が違う。
            #    個別株だけを対象にする（SPEC 1「日本株のスイング」）。
            if exclude_etf and not sector:
                continue
            stocks.append(
                Stock(code=code, name=str(row.get("name", "")), sector=sector, ticker=f"{code}.T")
            )
        if limit > 0:
            stocks = stocks[:limit]
        return stocks

    # -------------------------------------------------- マクロ（SPEC 5.4）

    def macro_snapshot(self) -> dict[str, Any]:
        """ドル円・VIX・TOPIX・騰落レシオ・投資部門別・空売り比率の直近値。

        米株（S&P/ナスダック/SOX/米金利）はぽいロボに無いので、fetch.py 側で yfinance から取る。
        """
        out: dict[str, Any] = {}

        # 🔴 ぽいロボのJSONは**ファイルごとに並び順が違う**（usdjpy/vix は新しい順、topix は古い順）。
        #    末尾を決め打ちで読むと半年前の値を「今日の為替」として使う事故になる（実際に踏んだ）。
        #    必ず _latest()/_prev() で日付を見て取る。
        fx = self._load("usdjpy.json").get("data", [])
        last = _latest(fx, "time")
        if last:
            out["usdjpy"] = {
                "date": _norm_date(last.get("time")),
                "close": last.get("close"),
                "change_pct": last.get("changePct"),
                "ma5_dev_pct": last.get("ma5dev"),
                "direction": _direction(last.get("changePct")),
            }

        vix = self._load("vix.json").get("data", [])
        last = _latest(vix, "date")
        if last:
            out["vix"] = {
                "date": _norm_date(last.get("date")),
                "close": last.get("close"),
                "change_pct": last.get("changePct"),
            }

        topix = self._load("topix.json").get("data", [])
        last, prev = _latest(topix, "time"), _prev(topix, "time")
        if last:
            out["topix"] = {
                "date": _norm_date(last.get("time")),
                "close": last.get("close"),
                "change_pct": _pct_change(prev.get("close") if prev else None, last.get("close")),
            }

        ad = self._load("advance_decline.json").get("data", [])
        last = _latest(ad, "date")
        if last:
            out["advance_decline_ratio25"] = last.get("ratio25")

        daily = self._load("short_sell.json").get("daily", [])
        last = _latest(daily, "date")
        if last:
            out["short_sell"] = {"date": _norm_date(last.get("date")), "ratio": last.get("ratio")}

        investor = self._load("investor.json").get("data", [])
        last = _latest(investor, "date")
        if last:
            out["investor_flow"] = {
                "date": _norm_date(last.get("date")),
                "label": last.get("label"),
                "foreigner": last.get("foreigner"),
                "individual": last.get("individual"),
                "trust_bank": last.get("trustBank"),
            }

        return out

    # -------------------------------------------------- 信用残（SPEC 7.3）

    @lru_cache(maxsize=1)
    def _margin_index(self) -> dict[str, Any]:
        path = self.margin_dir / "index.json"
        if not path.exists():
            return {}
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def margin_weeks(self) -> list[str]:
        return list(self._margin_index().get("weeks", []))

    def margin_for(self, code: str, weeks: int = 8) -> list[dict[str, Any]]:
        """1銘柄の週次信用残（制度買/一般買/制度売/一般売）を古い順で返す。

        🔴 判定に使うのは**制度信用の買残**（一般信用は期日が6か月ではない）。
        🔴 JPX は直近5週しか公開しないので、**貯めたぶんしか無い**（2026-08-14 の週から）。
           足りない週は落とす。無い期間を推測で埋めない。
        """
        rows: list[dict[str, Any]] = []
        for week in self.margin_weeks()[-weeks:]:
            path = self.margin_dir / f"{week}.json"
            if not path.exists():
                continue
            with path.open("r", encoding="utf-8") as f:
                payload = json.load(f)
            entry = (payload.get("rows") or {}).get(code)
            if entry is None:
                continue
            # index.json の columns 順: 制度買残/一般買残/制度売残/一般売残
            values = entry if isinstance(entry, list) else []
            rows.append(
                {
                    "week": week,
                    "seido_buy": _at(values, 0),
                    "ippan_buy": _at(values, 1),
                    "seido_sell": _at(values, 2),
                    "ippan_sell": _at(values, 3),
                }
            )
        return rows

    # -------------------------------------------------- カレンダー（SPEC 13 / 5.4）

    @lru_cache(maxsize=1)
    def calendar(self) -> dict[str, Any]:
        if not self.calendar_path.exists():
            raise DataMissingError(
                f"カレンダーが無い: {self.calendar_path}\n"
                "stock-calendar 直下で `npx tsx robotrade/scripts/export_calendar.mjs` を実行する"
            )
        with self.calendar_path.open("r", encoding="utf-8") as f:
            return json.load(f)


# ---------------------------------------------------------------- カレンダー操作


class MarketCalendar:
    """営業日・休場・マクロイベントの判定（データは JS 側が正）。"""

    def __init__(self, payload: dict[str, Any], cfg):
        self.closed: dict[str, str] = payload.get("closed", {})
        self.macro: dict[str, list[dict[str, Any]]] = payload.get("macro", {})
        self.sq: dict[str, str] = payload.get("sq", {})
        # 権利付最終日・権利落ち日・権利確定日（export_calendar.mjs が書き出す）
        self.dividend: dict[str, dict[str, Any]] = payload.get("dividend", {})
        self.range = (payload.get("from"), payload.get("to"))
        self.high_impact_types = set(cfg.get("macro.high_impact_types", []))
        self.high_impact_sq = set(cfg.get("macro.high_impact_sq", []))

    @staticmethod
    def _key(day: date) -> str:
        return day.strftime("%Y-%m-%d")

    def _in_range(self, day: date) -> bool:
        lo, hi = self.range
        return bool(lo and hi and lo <= self._key(day) <= hi)

    def is_closed(self, day: date) -> bool:
        if not self._in_range(day):
            raise DataMissingError(
                f"{day} はカレンダーの範囲外（{self.range[0]}〜{self.range[1]}）。"
                "export_calendar.mjs を広い年で流し直す"
            )
        return self._key(day) in self.closed

    def closed_reason(self, day: date) -> str | None:
        return self.closed.get(self._key(day))

    def is_business_day(self, day: date) -> bool:
        return not self.is_closed(day)

    def next_business_day(self, day: date) -> date:
        cursor = day + timedelta(days=1)
        for _ in range(30):
            if self.is_business_day(cursor):
                return cursor
            cursor += timedelta(days=1)
        raise DataMissingError(f"{day} の翌営業日が30日以内に見つからない")

    def business_days_between(self, start: date, end: date) -> int:
        """start（含まない）〜 end（含む）の営業日数。保有日数の算出に使う。"""
        if end <= start:
            return 0
        count = 0
        cursor = start + timedelta(days=1)
        while cursor <= end:
            if self.is_business_day(cursor):
                count += 1
            cursor += timedelta(days=1)
        return count

    def events_on(self, day: date) -> list[dict[str, Any]]:
        events = list(self.macro.get(self._key(day), []))
        sq_type = self.sq.get(self._key(day))
        if sq_type:
            events.append({"type": f"sq_{sq_type}", "short": f"SQ({sq_type})",
                           "label": "メジャーSQ" if sq_type == "major" else "ミニSQ",
                           "category": "jp", "headline": None})
        return events

    def dividend_on(self, day: date) -> dict[str, Any] | None:
        """その日の権利日（権利付最終日・権利落ち日・権利確定日）。無ければ None。"""
        return self.dividend.get(self._key(day))

    def high_impact_on(self, day: date) -> list[dict[str, Any]]:
        """市場全体を揺らす高インパクトイベントだけ（SPEC 5.4）。"""
        out = []
        for e in self.events_on(day):
            etype = str(e.get("type", ""))
            if etype in self.high_impact_types:
                out.append(e)
            elif etype.startswith("sq_") and etype.removeprefix("sq_") in self.high_impact_sq:
                out.append(e)
        return out

    def events_within(self, start: date, days: int) -> list[dict[str, Any]]:
        """start から days 日以内のイベント（保有期間にまたぐか判定する）。"""
        out = []
        for offset in range(days + 1):
            day = start + timedelta(days=offset)
            if not self._in_range(day):
                break
            for e in self.events_on(day):
                out.append({**e, "date": self._key(day), "days_until": offset})
        return out


# ---------------------------------------------------------------- 小物


def _at(values: list[Any], index: int) -> float | None:
    if index >= len(values):
        return None
    v = values[index]
    return None if v is None else float(v)


def _direction(change_pct: Any) -> str:
    if change_pct is None:
        return "unknown"
    v = float(change_pct)
    if v > 0.2:
        return "yen_weak"   # ドル円上昇＝円安
    if v < -0.2:
        return "yen_strong"
    return "flat"


def _pct_change(prev: Any, cur: Any) -> float | None:
    if prev in (None, 0) or cur is None:
        return None
    return (float(cur) - float(prev)) / float(prev) * 100.0


def _norm_date(value: Any) -> str | None:
    """2026/09/17 → 2026-09-17。"""
    if not value:
        return None
    return str(value).replace("/", "-")


def _sorted_rows(rows: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    """日付キーで古い順に並べ直す。

    🔴 ファイルの並び順を信用しない。日付を見て自分で並べる。
       日付が YYYY-MM-DD / YYYY/MM/DD で混在するので正規化してから比べる。
    """
    usable = [r for r in rows if isinstance(r, dict) and r.get(key)]
    return sorted(usable, key=lambda r: _norm_date(r.get(key)) or "")


def _latest(rows: list[dict[str, Any]], key: str) -> dict[str, Any] | None:
    ordered = _sorted_rows(rows, key)
    return ordered[-1] if ordered else None


def _prev(rows: list[dict[str, Any]], key: str) -> dict[str, Any] | None:
    ordered = _sorted_rows(rows, key)
    return ordered[-2] if len(ordered) >= 2 else None
