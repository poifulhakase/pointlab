"""トレード結果のラベリングと成績指標（SPEC 8.1 / 10.4）。

🔴 勝率だけ見ない（SPEC 10.4）
   成績は必ず **期待値 = 勝率 × 平均利益 − 敗率 × 平均損失 − コスト** に分解して記録する。
   勝率が低くても平均利益が大きければ勝てる／勝率が高くてもコスト負けする、を見抜くため。

🔴 有意性の明示（SPEC 10.4）
   勝率・期待値には**信頼区間を必ず併記**する。n=30 の勝率60%は 95%CI でおよそ 42〜76% と
   幅広く、50%（無意味）と区別できない。**少数のうちは勝率でランク付けしない**。
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from ..money import to_yen

# 統計的に語り始めてよい最低件数の目安。これ未満は「暫定値」と明示する。
MIN_N_FOR_INFERENCE = 30


def label_trade(realized_sen: int, reason: str) -> str:
    """手仕舞い結果のラベル（SPEC 8.1）。

    win / loss / time_exit の3値。時間切れは勝ち負けと別の帰結として扱う
    （「持ちすぎない」が効いたかを別軸で見たいため）。
    """
    if "時間手仕舞い" in reason:
        return "time_exit"
    return "win" if realized_sen > 0 else "loss"


def wilson_interval(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """勝率の95%信頼区間（Wilson score）。

    正規近似（単純な ±1.96√(p(1-p)/n)）は n が小さいと区間が [0,1] をはみ出すので使わない。
    """
    if n <= 0:
        return (0.0, 1.0)
    p = successes / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    margin = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, center - margin), min(1.0, center + margin))


@dataclass
class Performance:
    """成績サマリ。すべて**実トレードのみ**（シャドウ追跡は混ぜない・SPEC 8.1）。"""

    trades: int
    wins: int
    losses: int
    time_exits: int
    win_rate: float
    win_rate_ci: tuple[float, float]
    avg_win_yen: float
    avg_loss_yen: float
    payoff_ratio: float | None
    expectancy_yen: float
    total_cost_yen: float
    avg_holding_days: float
    by_holding_days: dict[str, dict[str, Any]]
    reliable: bool

    def as_dict(self) -> dict[str, Any]:
        return {
            "件数": self.trades,
            "勝ち": self.wins,
            "負け": self.losses,
            "時間切れ": self.time_exits,
            "勝率": round(self.win_rate * 100, 1),
            "勝率95%CI": [round(self.win_rate_ci[0] * 100, 1), round(self.win_rate_ci[1] * 100, 1)],
            "平均利益": round(self.avg_win_yen, 0),
            "平均損失": round(self.avg_loss_yen, 0),
            "ペイオフレシオ": None if self.payoff_ratio is None else round(self.payoff_ratio, 2),
            "期待値": round(self.expectancy_yen, 0),
            "コスト合計": round(self.total_cost_yen, 0),
            "平均保有日数": round(self.avg_holding_days, 1),
            "保有日数別": self.by_holding_days,
            "統計的に語れる件数か": self.reliable,
        }

    def text(self) -> str:
        lines = [
            f"{self.trades}トレード（勝{self.wins} 負{self.losses} 時間切れ{self.time_exits}）",
            f"勝率 {self.win_rate*100:.1f}% "
            f"[95%CI {self.win_rate_ci[0]*100:.0f}〜{self.win_rate_ci[1]*100:.0f}%]",
            f"期待値 {self.expectancy_yen:+,.0f}円/トレード "
            f"= 勝率×平均利益{self.avg_win_yen:,.0f} − 敗率×平均損失{self.avg_loss_yen:,.0f}",
        ]
        if self.payoff_ratio is not None:
            lines.append(f"ペイオフレシオ {self.payoff_ratio:.2f}（平均利益÷平均損失）")
        lines.append(f"平均保有 {self.avg_holding_days:.1f}営業日")
        if not self.reliable:
            lines.append(
                f"🔴 n={self.trades} は少なすぎる（目安{MIN_N_FOR_INFERENCE}件）。"
                "この数字は暫定値。勝率でモデルやプロンプトをランク付けしないこと"
            )
        return "\n".join(lines)


def summarize(closed_trades: list[dict[str, Any]]) -> Performance:
    """手仕舞い済みトレードから成績を出す。

    `closed_trades` は store.closed_trades() の形
    （date / ticker / realized_pnl / holding_days / label）。
    """
    n = len(closed_trades)
    if n == 0:
        return Performance(0, 0, 0, 0, 0.0, (0.0, 1.0), 0.0, 0.0, None, 0.0, 0.0, 0.0, {}, False)

    wins = [t for t in closed_trades if (t.get("realized_pnl") or 0) > 0]
    losses = [t for t in closed_trades if (t.get("realized_pnl") or 0) <= 0]
    time_exits = [t for t in closed_trades if t.get("label") == "time_exit"]

    avg_win = sum(t["realized_pnl"] for t in wins) / len(wins) if wins else 0.0
    avg_loss = abs(sum(t["realized_pnl"] for t in losses) / len(losses)) if losses else 0.0
    win_rate = len(wins) / n
    # 期待値の分解（SPEC 10.4）。コストは約定価格に織り込み済みなので realized に含まれる。
    expectancy = win_rate * avg_win - (1 - win_rate) * avg_loss

    holding = [t["holding_days"] for t in closed_trades if t.get("holding_days") is not None]
    avg_holding = sum(holding) / len(holding) if holding else 0.0

    # 保有日数別の勝率（SPEC 10.4）。「持ちすぎ」が効いているかを見る。
    buckets: dict[str, list[dict[str, Any]]] = {"2-4日": [], "5-9日": [], "10-14日": [], "15日以上": []}
    for t in closed_trades:
        days = t.get("holding_days")
        if days is None:
            continue
        key = "2-4日" if days <= 4 else ("5-9日" if days <= 9 else ("10-14日" if days <= 14 else "15日以上"))
        buckets[key].append(t)
    by_holding = {
        key: {
            "件数": len(rows),
            "勝率": round(
                sum(1 for r in rows if (r.get("realized_pnl") or 0) > 0) / len(rows) * 100, 1
            ) if rows else None,
            "平均損益": round(sum(r.get("realized_pnl") or 0 for r in rows) / len(rows), 0)
            if rows else None,
        }
        for key, rows in buckets.items()
    }

    return Performance(
        trades=n,
        wins=len(wins),
        losses=len(losses),
        time_exits=len(time_exits),
        win_rate=win_rate,
        win_rate_ci=wilson_interval(len(wins), n),
        avg_win_yen=avg_win,
        avg_loss_yen=avg_loss,
        payoff_ratio=(avg_win / avg_loss) if avg_loss else None,
        expectancy_yen=expectancy,
        total_cost_yen=0.0,   # 約定価格に織り込み済み（別計上すると二重になる）
        avg_holding_days=avg_holding,
        by_holding_days=by_holding,
        reliable=n >= MIN_N_FOR_INFERENCE,
    )


def benchmark_excess(equity_history: list[dict[str, Any]]) -> dict[str, Any] | None:
    """TOPIX バイ&ホールドに対する超過リターン（SPEC 10.4）。

    「地合いで勝っただけ」を見抜くため、絶対損益だけで判断しない。
    """
    usable = [r for r in equity_history if r.get("benchmark")]
    if len(usable) < 2:
        return None
    first, last = usable[0], usable[-1]
    strategy = (last["equity"] - first["equity"]) / first["equity"] * 100
    benchmark = (last["benchmark"] - first["benchmark"]) / first["benchmark"] * 100
    return {
        "期間": f"{first['date']}〜{last['date']}",
        "自分%": round(strategy, 2),
        "TOPIX%": round(benchmark, 2),
        "超過%": round(strategy - benchmark, 2),
    }
