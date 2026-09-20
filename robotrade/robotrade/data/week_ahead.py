"""今週の相場の予定を集める（#相場観測・週次）。

ぽいロボ本体が持っているカレンダーと、いま入れた決算予定を1週間ぶんに束ねるだけ。

🔴 **日付の計算をここで作らない**。休場・マクロ・SQ・権利日は
   `src/utils/{marketCalendar.mjs,macroCalendar.ts,sqCalendar.ts,dividendCalendar.ts}` が
   単一情報源で、`scripts/export_calendar.mjs` が書き出した JSON を読むだけ（CLAUDE.md の不変ルール）。

🔴 **決算は保有銘柄ぶんだけ**出す。予定表には毎週何百件も入っているので、
   全部出すと誰も読まない（DISCORD.md 4章「要点だけ」）。

🔴 **売買の示唆を書かない**。出すのは「いつ何があるか」だけ（客観的状態記述型）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any


@dataclass
class DayPlan:
    """1日ぶんの予定。"""

    day: date
    closed_reason: str | None = None
    events: list[dict[str, Any]] = field(default_factory=list)   # マクロ＋SQ
    high_impact: list[str] = field(default_factory=list)          # 上のうち高インパクトの type
    dividend: dict[str, Any] | None = None
    earnings: list[dict[str, Any]] = field(default_factory=list)  # 保有銘柄の決算

    @property
    def is_empty(self) -> bool:
        return not (self.closed_reason or self.events or self.dividend or self.earnings)


@dataclass
class WeekAhead:
    start: date
    end: date
    days: list[DayPlan]
    holdings: list[str] = field(default_factory=list)
    earnings_available: bool = True

    @property
    def has_anything(self) -> bool:
        return any(not d.is_empty for d in self.days)


def week_bounds(today: date) -> tuple[date, date]:
    """その週の月曜〜金曜。**土日に走らせても翌週にずらさない**。

    🔵 月曜の朝に出す想定なので、月曜なら当日から金曜まで。
       日曜に手で流したときも「明日から始まる週」を出したいので、日曜だけ翌日起点にする。
    """
    if today.weekday() == 6:          # 日曜
        monday = today + timedelta(days=1)
    else:
        monday = today - timedelta(days=today.weekday())
    return monday, monday + timedelta(days=4)


def collect(*, today: date, calendar, earnings, holdings: list[str]) -> WeekAhead:
    """今週の予定を集める。

    `earnings` が None（取得元を切っている・取れていない）なら決算の行は出さない。
    🔴 「予定が無い」と「取れていない」を混ぜない。
    """
    start, end = week_bounds(today)
    available = earnings is not None and earnings.is_available()

    days: list[DayPlan] = []
    cursor = start
    while cursor <= end:
        plan = DayPlan(day=cursor)
        try:
            plan.closed_reason = calendar.closed_reason(cursor)
            plan.events = calendar.events_on(cursor)
            plan.high_impact = [str(e.get("type", "")) for e in calendar.high_impact_on(cursor)]
            plan.dividend = calendar.dividend_on(cursor)
        except Exception:  # noqa: BLE001
            # カレンダーの範囲外など。その日は空で出す（週まるごと落とさない）
            pass

        if available:
            for ticker in holdings:
                found = earnings.next_announcement(ticker, cursor)
                if found and found["date"] == cursor.isoformat():
                    plan.earnings.append({"ticker": ticker, **found})

        days.append(plan)
        cursor += timedelta(days=1)

    return WeekAhead(start=start, end=end, days=days,
                     holdings=list(holdings), earnings_available=available)
