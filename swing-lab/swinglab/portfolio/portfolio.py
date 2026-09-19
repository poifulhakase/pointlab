"""仮想ポートフォリオ（SPEC 10.1）。

🔴 お金は **銭（int）** で持つ。float を使わない（誤差が積み上がって成績がズレる）。
🔴 ポジションは**有限状態機械**。不正な状態遷移はコードで拒否する。
   `exited` なのに保有中・二重約定・`open` を飛ばした `holding` を通さない。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Any

from ..money import multiply, to_sen, to_yen

log = logging.getLogger(__name__)


class PositionState(str, Enum):
    """ポジションの状態（SPEC 10.1 FSM）。"""

    CANDIDATE = "candidate"   # プレフィルタを通った
    ANALYZED = "analyzed"     # 各AIの分析が付いた
    DECIDED = "decided"       # 売買判断AIが buy と言った
    OPEN = "open"             # 発注した（翌寄り待ち）
    HOLDING = "holding"       # 約定して保有中
    EXITED = "exited"         # 手仕舞い済み
    SKIPPED = "skipped"       # 見送り（ギャップ乖離・単元0など）
    REJECTED = "rejected"     # 不成立（寄らず・リスクガード却下など）


# 合法な遷移だけを許す（論理学者の「網羅性」を実装で担保する）
LEGAL_TRANSITIONS: dict[PositionState, set[PositionState]] = {
    PositionState.CANDIDATE: {PositionState.ANALYZED, PositionState.SKIPPED},
    PositionState.ANALYZED: {PositionState.DECIDED, PositionState.SKIPPED},
    PositionState.DECIDED: {PositionState.OPEN, PositionState.SKIPPED, PositionState.REJECTED},
    PositionState.OPEN: {PositionState.HOLDING, PositionState.REJECTED},
    PositionState.HOLDING: {PositionState.EXITED},
    PositionState.EXITED: set(),
    PositionState.SKIPPED: set(),
    PositionState.REJECTED: set(),
}


class PortfolioError(Exception):
    """資金・数量・状態の不整合。握り潰さず落とす。"""


def transition(current: PositionState, nxt: PositionState) -> PositionState:
    """状態遷移。合法でなければ例外。"""
    if nxt not in LEGAL_TRANSITIONS[current]:
        raise PortfolioError(f"不正な状態遷移: {current.value} → {nxt.value}")
    return nxt


@dataclass
class Position:
    """保有中の1銘柄。価格はすべて**銭（int）**。"""

    ticker: str
    quantity: int
    avg_price_sen: int
    entry_date: date
    planned_holding_days: int
    stop_sen: int | None = None
    target_sen: int | None = None
    time_exit_days: int | None = None
    state: PositionState = PositionState.HOLDING
    entry_reason: str = ""
    entry_snapshot: dict[str, Any] = field(default_factory=dict)

    @property
    def cost_sen(self) -> int:
        return multiply(self.avg_price_sen, self.quantity)

    def market_value_sen(self, price_sen: int) -> int:
        return multiply(price_sen, self.quantity)

    def unrealized_sen(self, price_sen: int) -> int:
        return self.market_value_sen(price_sen) - self.cost_sen

    def days_held(self, today: date, calendar=None) -> int:
        """経過日数。カレンダーがあれば**営業日**で数える（SPEC 10.1）。"""
        if calendar is not None:
            return calendar.business_days_between(self.entry_date, today)
        return (today - self.entry_date).days

    def as_dict(self, price_sen: int | None = None, today: date | None = None,
                calendar=None) -> dict[str, Any]:
        out: dict[str, Any] = {
            "ticker": self.ticker,
            "quantity": self.quantity,
            "avg_price": float(to_yen(self.avg_price_sen)),
            "cost": float(to_yen(self.cost_sen)),
            "entry_date": self.entry_date.isoformat(),
            "planned_holding_days": self.planned_holding_days,
            "stop": None if self.stop_sen is None else float(to_yen(self.stop_sen)),
            "target": None if self.target_sen is None else float(to_yen(self.target_sen)),
            "time_exit_days": self.time_exit_days,
            "state": self.state.value,
        }
        if price_sen is not None:
            out["current_price"] = float(to_yen(price_sen))
            out["unrealized_pnl"] = float(to_yen(self.unrealized_sen(price_sen)))
            out["unrealized_pct"] = round(
                self.unrealized_sen(price_sen) / self.cost_sen * 100.0, 2
            ) if self.cost_sen else 0.0
        if today is not None:
            held = self.days_held(today, calendar)
            out["days_held"] = held
            out["days_remaining"] = max(0, self.planned_holding_days - held)
        return out


@dataclass
class Trade:
    """約定1件。買いと売りの両方をこの形で記録する。"""

    date: date
    ticker: str
    side: str            # buy / sell
    quantity: int
    price_sen: int       # 実際の約定価格（スリッページ込み）
    cost_sen: int        # 手数料（往復コストの片道ぶん）
    reason: str = ""
    realized_sen: int | None = None   # 売りのときだけ
    holding_days: int | None = None
    label: str | None = None          # win / loss / time_exit（SPEC 8.1）

    def as_dict(self) -> dict[str, Any]:
        return {
            "date": self.date.isoformat(),
            "ticker": self.ticker,
            "side": self.side,
            "quantity": self.quantity,
            "price": float(to_yen(self.price_sen)),
            "fee": float(to_yen(self.cost_sen)),
            "reason": self.reason,
            "realized_pnl": None if self.realized_sen is None else float(to_yen(self.realized_sen)),
            "holding_days": self.holding_days,
            "label": self.label,
        }


class Portfolio:
    """現金・保有・約定履歴。"""

    def __init__(self, initial_cash_yen: float):
        self.initial_cash_sen = to_sen(initial_cash_yen)
        self.cash_sen = self.initial_cash_sen
        self.positions: dict[str, Position] = {}
        self.history: list[Trade] = []
        self.peak_equity_sen = self.initial_cash_sen

    # -------------------------------------------------- 約定

    def buy(self, *, day: date, ticker: str, quantity: int, price_sen: int, fee_sen: int,
            stop_sen: int | None, target_sen: int | None, planned_holding_days: int,
            time_exit_days: int | None, reason: str = "",
            snapshot: dict[str, Any] | None = None, allow_pyramiding: bool = False) -> Trade:
        if quantity <= 0:
            raise PortfolioError(f"{ticker}: 数量が0以下（{quantity}）")
        if ticker in self.positions and not allow_pyramiding:
            raise PortfolioError(f"{ticker}: すでに保有中（買い増しは既定オフ）")

        total = multiply(price_sen, quantity) + fee_sen
        if total > self.cash_sen:
            raise PortfolioError(
                f"{ticker}: 現金不足 必要{to_yen(total)}円 > 残{to_yen(self.cash_sen)}円"
            )

        self.cash_sen -= total
        if ticker in self.positions:
            # 買い増し（許可時のみ）。平均取得単価を出来高加重で更新。
            pos = self.positions[ticker]
            new_qty = pos.quantity + quantity
            pos.avg_price_sen = (pos.cost_sen + multiply(price_sen, quantity)) // new_qty
            pos.quantity = new_qty
        else:
            self.positions[ticker] = Position(
                ticker=ticker, quantity=quantity, avg_price_sen=price_sen, entry_date=day,
                planned_holding_days=planned_holding_days, stop_sen=stop_sen,
                target_sen=target_sen, time_exit_days=time_exit_days,
                state=PositionState.HOLDING, entry_reason=reason,
                entry_snapshot=snapshot or {},
            )

        trade = Trade(date=day, ticker=ticker, side="buy", quantity=quantity,
                      price_sen=price_sen, cost_sen=fee_sen, reason=reason)
        self.history.append(trade)
        return trade

    def sell(self, *, day: date, ticker: str, price_sen: int, fee_sen: int,
             reason: str = "", label: str | None = None, calendar=None,
             quantity: int | None = None) -> Trade:
        pos = self.positions.get(ticker)
        if pos is None:
            raise PortfolioError(f"{ticker}: 保有していないのに売ろうとした")
        qty = pos.quantity if quantity is None else int(quantity)
        if qty <= 0 or qty > pos.quantity:
            raise PortfolioError(f"{ticker}: 売却数量が不正（{qty} / 保有{pos.quantity}）")

        proceeds = multiply(price_sen, qty) - fee_sen
        realized = multiply(price_sen - pos.avg_price_sen, qty) - fee_sen
        holding_days = pos.days_held(day, calendar)

        self.cash_sen += proceeds
        if qty == pos.quantity:
            pos.state = transition(pos.state, PositionState.EXITED)
            del self.positions[ticker]
        else:
            pos.quantity -= qty

        trade = Trade(date=day, ticker=ticker, side="sell", quantity=qty, price_sen=price_sen,
                      cost_sen=fee_sen, reason=reason, realized_sen=realized,
                      holding_days=holding_days, label=label)
        self.history.append(trade)
        return trade

    # -------------------------------------------------- 評価

    def equity_sen(self, prices_sen: dict[str, int]) -> int:
        """総資産＝現金＋保有の時価。

        🔴 時価は**直近の確定終値**を使う（日中値を使わない・SPEC 10.5）。
        🔴 価格が取れない銘柄は簿価で評価する（勝手に0にしない）。
        """
        total = self.cash_sen
        for ticker, pos in self.positions.items():
            price = prices_sen.get(ticker)
            total += pos.market_value_sen(price) if price is not None else pos.cost_sen
        return total

    def update_peak(self, equity_sen: int) -> None:
        self.peak_equity_sen = max(self.peak_equity_sen, equity_sen)

    def drawdown(self, equity_sen: int) -> float:
        if self.peak_equity_sen <= 0:
            return 0.0
        return max(0.0, (self.peak_equity_sen - equity_sen) / self.peak_equity_sen)

    def exposure(self, prices_sen: dict[str, int]) -> float:
        equity = self.equity_sen(prices_sen)
        if equity <= 0:
            return 0.0
        invested = equity - self.cash_sen
        return invested / equity

    def bucket_exposure(self, prices_sen: dict[str, int],
                        bucket_of: dict[str, str]) -> dict[str, float]:
        """為替感応度/セクターごとの比率（相関・集中の上限に使う・SPEC 10.3）。"""
        equity = self.equity_sen(prices_sen)
        out: dict[str, float] = {}
        if equity <= 0:
            return out
        for ticker, pos in self.positions.items():
            bucket = bucket_of.get(ticker, "unknown")
            price = prices_sen.get(ticker)
            value = pos.market_value_sen(price) if price is not None else pos.cost_sen
            out[bucket] = out.get(bucket, 0.0) + value / equity
        return out

    def state_dict(self, prices_sen: dict[str, int], today: date, calendar=None) -> dict[str, Any]:
        """売買判断AIに渡す状態（SPEC 15「状態は毎ターン全部渡す」）。"""
        equity = self.equity_sen(prices_sen)
        unrealized = sum(
            pos.unrealized_sen(prices_sen[t]) for t, pos in self.positions.items()
            if t in prices_sen
        )
        return {
            "cash": float(to_yen(self.cash_sen)),
            "total_value": float(to_yen(equity)),
            "initial_cash": float(to_yen(self.initial_cash_sen)),
            "total_return_pct": round(
                (equity - self.initial_cash_sen) / self.initial_cash_sen * 100.0, 2
            ),
            "unrealized_pnl": float(to_yen(unrealized)),
            "drawdown_pct": round(self.drawdown(equity) * 100.0, 2),
            "exposure_pct": round(self.exposure(prices_sen) * 100.0, 1),
            "position_count": len(self.positions),
            "positions": [
                pos.as_dict(prices_sen.get(t), today, calendar)
                for t, pos in sorted(self.positions.items())
            ],
        }
