"""今週の予定（#相場観測・週次）のテスト。

見るのは:
  - 週の区切り（月〜金・日曜に流したら翌週）
  - 🔴 決算は**保有銘柄ぶんだけ**か（予定表を丸ごと流さない）
  - 🔴 5日ぶんすべてを1日1行で出すか（まとめない・飛ばさない）
  - 🔴 「予定が無い」と「取れていない」を書き分けるか
"""

from __future__ import annotations

from datetime import date

import pytest

from robotrade.data import week_ahead as wm
from robotrade.notify import summary as smod


class FakeCalendar:
    def __init__(self, closed=None, events=None, dividend=None, high=None):
        self.closed = closed or {}
        self.events = events or {}
        self.dividend = dividend or {}
        self.high = high or {}

    def closed_reason(self, day):
        return self.closed.get(day.isoformat())

    def events_on(self, day):
        return self.events.get(day.isoformat(), [])

    def high_impact_on(self, day):
        return self.high.get(day.isoformat(), [])

    def dividend_on(self, day):
        return self.dividend.get(day.isoformat())


class FakeEarnings:
    def __init__(self, rows, available=True):
        self.rows = rows            # {ticker: "YYYY-MM-DD"}
        self._available = available

    def is_available(self):
        return self._available

    def next_announcement(self, ticker, as_of):
        when = self.rows.get(ticker)
        if not when or when < as_of.isoformat():
            return None
        return {"date": when, "days_until": 0, "kind": "第１四半期", "as_of": "2026-09-20"}


# ---------------------------------------------------------------- 週の区切り


@pytest.mark.parametrize("today,monday", [
    (date(2026, 9, 21), date(2026, 9, 21)),   # 月曜 → その日から
    (date(2026, 9, 24), date(2026, 9, 21)),   # 週の途中 → その週の月曜
    (date(2026, 9, 26), date(2026, 9, 21)),   # 土曜 → その週の月曜（翌週にずらさない）
    (date(2026, 9, 20), date(2026, 9, 21)),   # 日曜 → 明日から始まる週
])
def test_week_bounds(today, monday):
    start, end = wm.week_bounds(today)
    assert start == monday
    assert end == monday.replace(day=monday.day + 4)


# ---------------------------------------------------------------- 集める


def test_collects_only_holdings_earnings(cfg):
    """🔴 予定表には毎週何百件もある。出すのは保有銘柄ぶんだけ。"""
    week = wm.collect(
        today=date(2026, 9, 21),
        calendar=FakeCalendar(),
        earnings=FakeEarnings({"4716.T": "2026-09-24", "9999.T": "2026-09-24"}),
        holdings=["4716.T"],
    )
    got = [row["ticker"] for day in week.days for row in day.earnings]
    assert got == ["4716.T"]


def test_marks_when_earnings_are_unavailable(cfg):
    """🔴 「予定が無い」と「取れていない」を混ぜない。"""
    week = wm.collect(today=date(2026, 9, 21), calendar=FakeCalendar(),
                      earnings=None, holdings=["4716.T"])
    assert week.earnings_available is False
    assert all(not day.earnings for day in week.days)


# ---------------------------------------------------------------- 文面


def test_lists_every_day_without_merging(cfg):
    """🔴 1日1行・5日ぶんすべて（運用者の指示「日付ごとにリストで。短縮なしで」）。

    行が抜けると「見落としたのか、予定が無いのか」が読み手に分からない。
    """
    closed = {f"2026-09-{d}": "祝日" for d in (21, 22, 23)}
    week = wm.collect(
        today=date(2026, 9, 21),
        calendar=FakeCalendar(
            closed=closed,
            events={"2026-09-25": [{"type": "pce", "label": "米PCE", "category": "us"}]},
            high={"2026-09-25": [{"type": "pce"}]},
        ),
        earnings=None, holdings=[],
    )
    lines = smod.build_week_ahead(week, cfg)[0].description.split(chr(10))
    assert len(lines) == 5
    assert lines[0].startswith("`9/21(月)` 休場（祝日）")
    assert lines[2].startswith("`9/23(水)` 休場（祝日）")   # まとめない
    assert lines[3] == "`9/24(木)` 予定なし"                 # 予定の無い日も出す
    assert "🇺🇸 **米PCE**" in lines[4]                       # 高インパクトは太字


def test_quiet_week_still_lists_five_days(cfg):
    week = wm.collect(today=date(2026, 9, 21), calendar=FakeCalendar(),
                      earnings=None, holdings=[])
    lines = smod.build_week_ahead(week, cfg)[0].description.split(chr(10))
    assert len(lines) == 5
    assert all(line.endswith("予定なし") for line in lines)


def test_dividend_and_earnings_lines(cfg):
    week = wm.collect(
        today=date(2026, 9, 21),
        calendar=FakeCalendar(
            dividend={"2026-09-25": {"kind": "saishu", "label": "権利付最終日", "month": 9}},
        ),
        earnings=FakeEarnings({"4716.T": "2026-09-24"}),
        holdings=["4716.T"],
    )
    text = smod.build_week_ahead(week, cfg)[0].description
    assert "権利付最終日（9月期）" in text
    assert "📊 保有 4716.T の決算・第１四半期" in text


def test_no_trading_advice_in_the_post(cfg):
    """🔴 客観的状態記述型を崩さない（命令・推奨を書かない）。"""
    week = wm.collect(
        today=date(2026, 9, 21),
        calendar=FakeCalendar(
            events={"2026-09-25": [{"type": "pce", "label": "米PCE", "category": "us"}]}),
        earnings=None, holdings=[],
    )
    embed = smod.build_week_ahead(week, cfg)[0]
    text = embed.description + "".join(f["value"] for f in embed.fields)
    for word in ("買い", "売り", "推奨", "狙", "べき"):
        assert word not in text


# ---------------------------------------------------------------- 送る曜日


def test_calendar_is_weekly_on_monday(cfg):
    assert smod.should_send_calendar(date(2026, 9, 21), cfg) is True      # 月
    assert smod.should_send_calendar(date(2026, 9, 24), cfg) is False     # 木
    assert smod.should_send_calendar(date(2026, 9, 24), cfg, forced=True) is True


def test_no_disclaimer_footer(cfg):
    """🔵 免責は付けない（2026-09-20・運用者の指示）。日程を並べるだけで示唆を含まない。"""
    week = wm.collect(today=date(2026, 9, 21), calendar=FakeCalendar(),
                      earnings=None, holdings=[])
    assert smod.build_week_ahead(week, cfg)[0].footer == ""


def test_earnings_note_only_explains_why_it_is_missing(cfg):
    """🔴 決算の行が出ない理由だけ書く。出ているときは注記も出さない（ノイズにしない）。"""
    # 保有あり・予定も取れている → 日付の行に出るので注記なし
    week = wm.collect(today=date(2026, 9, 21), calendar=FakeCalendar(),
                      earnings=FakeEarnings({"4716.T": "2026-09-24"}), holdings=["4716.T"])
    assert smod.build_week_ahead(week, cfg)[0].fields == []

    # 保有なし → なぜ決算の行が無いかを書く
    week = wm.collect(today=date(2026, 9, 21), calendar=FakeCalendar(),
                      earnings=FakeEarnings({}), holdings=[])
    field = smod.build_week_ahead(week, cfg)[0].fields[0]
    assert field["name"] == "📊 決算"
    assert "保有なし" in field["value"]

    # 🔴 取れていない → 黙って消さず、取れていないと言う
    week = wm.collect(today=date(2026, 9, 21), calendar=FakeCalendar(),
                      earnings=None, holdings=["4716.T"])
    assert "取れていない" in smod.build_week_ahead(week, cfg)[0].fields[0]["value"]
