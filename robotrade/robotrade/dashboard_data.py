"""ダッシュボードが読むデータ（SPEC 12）。

🔴 UI と切り離してある。Streamlit を起動しなくてもテストできるようにするため。
🔴 **閲覧専用**。ここから発注も判断もしない（マシンの自動フローと人間の観察を分ける）。

観察者バイアス対策（SPEC 12.1）はこの層にも効かせる:
  - 履歴は**勝ち優先で並べない**（既定は日付順）
  - 「直近の負けトレード」は専用の取り出し口を持つ（負けを埋もれさせない）
  - AIの読みは**判断時点のスナップショット**をそのまま返す（結果を見てから解釈し直さない）
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from typing import Any

from .money import to_yen
from .portfolio.store import Store

AGENTS = ("chart", "supply_demand", "news")


@dataclass
class RunSummary:
    run_date: str
    status: str
    started_at: str
    finished_at: str | None
    market_view: str
    funnel: dict[str, Any]
    cost: dict[str, Any]
    note: str = ""


class DashboardData:
    """SQLite を読むだけ（パイプラインが書いたものと同じファイル）。"""

    def __init__(self, store: Store):
        self.store = store

    # -------------------------------------------------- 実行

    def runs(self, limit: int = 60) -> list[RunSummary]:
        rows = self.store.conn.execute(
            "SELECT * FROM runs ORDER BY run_date DESC LIMIT ?", (limit,)
        ).fetchall()
        return [
            RunSummary(
                run_date=r["run_date"], status=r["status"],
                started_at=r["started_at"], finished_at=r["finished_at"],
                market_view=r["market_view"] or "",
                funnel=_json(r["funnel_json"]), cost=_json(r["cost_json"]),
                note=r["note"] or "",
            )
            for r in rows
        ]

    def latest_run(self) -> RunSummary | None:
        runs = self.runs(limit=1)
        return runs[0] if runs else None

    # -------------------------------------------------- 今日の意思決定ビュー（目玉）

    def decision_view(self, run_date: str) -> list[dict[str, Any]]:
        """候補銘柄ごとに、各AIの読みと最終判断を横並びにする（SPEC 12 画面1）。

        🔴 後知恵バイアス対策: **判断時点に記録した内容をそのまま**返す。
           結果（その後の値動き）で読みを書き換えない。
        """
        analyses: dict[str, dict[str, Any]] = {}
        for row in self.store.conn.execute(
            "SELECT ticker, agent, payload_json FROM analyses WHERE run_date = ?",
            (run_date,),
        ):
            analyses.setdefault(row["ticker"], {})[row["agent"]] = _json(row["payload_json"])

        decisions: dict[str, dict[str, Any]] = {}
        for row in self.store.conn.execute(
            "SELECT * FROM decisions WHERE run_date = ? ORDER BY id", (run_date,)
        ):
            decisions[row["ticker"]] = {
                "action": row["action"],
                "entry": _yen(row["entry_sen"]),
                "stop": _yen(row["stop_sen"]),
                "target": _yen(row["target_sen"]),
                "planned_holding_days": row["planned_holding_days"],
                "confidence": row["confidence"],
                "reason": row["reason"] or "",
                "outcome": row["outcome"],
                "outcome_note": row["outcome_note"] or "",
            }

        tickers = list(dict.fromkeys(list(decisions) + list(analyses)))
        out = []
        for ticker in tickers:
            row: dict[str, Any] = {"ticker": ticker, "decision": decisions.get(ticker)}
            for agent in AGENTS:
                row[agent] = analyses.get(ticker, {}).get(agent)
            out.append(row)
        return out

    # -------------------------------------------------- ポートフォリオ現況

    def positions(self, initial_cash_yen: float, today: date | None = None,
                  calendar=None) -> dict[str, Any]:
        """保有一覧と現金。

        🔴 損失回避対策（SPEC 12.1）: 含み損のポジションも**必ず**含める。
           並べ替えも損益順を既定にしない（負けを下に隠さない）。
        """
        portfolio = self.store.load_portfolio(initial_cash_yen)
        latest = self.latest_equity()
        prices_sen: dict[str, int] = {}
        return {
            "cash": float(to_yen(portfolio.cash_sen)),
            "equity": latest["equity"] if latest else float(to_yen(portfolio.cash_sen)),
            "positions": [
                p.as_dict(prices_sen.get(t), today, calendar)
                for t, p in sorted(portfolio.positions.items(),
                                   key=lambda kv: kv[1].entry_date)   # 建てた順
            ],
        }

    def latest_equity(self) -> dict[str, Any] | None:
        history = self.store.equity_history()
        return history[-1] if history else None

    def equity_history(self) -> list[dict[str, Any]]:
        return self.store.equity_history()

    # -------------------------------------------------- 履歴

    def trades(self, *, limit: int = 200, result: str = "すべて") -> list[dict[str, Any]]:
        """手仕舞い済みトレード。

        🔴 確証バイアス対策（SPEC 12.1）: **既定は日付順**。勝ち優先で並べない。
           絞り込みは明示的に選んだときだけ効かせる。
        """
        rows = self.store.closed_trades(limit=limit)
        if result == "勝ちだけ":
            rows = [r for r in rows if (r.get("realized_pnl") or 0) > 0]
        elif result == "負けだけ":
            rows = [r for r in rows if (r.get("realized_pnl") or 0) <= 0]
        return rows

    def recent_losses(self, limit: int = 5) -> list[dict[str, Any]]:
        """成績サマリに常設する「直近の負け」（負けを埋もれさせない）。"""
        return [t for t in self.store.closed_trades(limit=100)
                if (t.get("realized_pnl") or 0) <= 0][:limit]

    def all_fills(self, limit: int = 200) -> list[dict[str, Any]]:
        rows = self.store.conn.execute(
            "SELECT * FROM trades ORDER BY trade_date DESC, id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [
            {
                "date": r["trade_date"], "ticker": r["ticker"], "side": r["side"],
                "quantity": r["quantity"], "price": _yen(r["price_sen"]),
                "fee": _yen(r["fee_sen"]),
                "realized_pnl": _yen(r["realized_sen"]),
                "holding_days": r["holding_days"], "label": r["label"],
                "reason": r["reason"] or "",
            }
            for r in rows
        ]

    # -------------------------------------------------- 銘柄ドリルダウン

    def ticker_history(self, ticker: str) -> dict[str, Any]:
        """1銘柄について、これまでの判断・約定・各AIの読みを集める。"""
        decisions = [
            {
                "run_date": r["run_date"], "action": r["action"],
                "entry": _yen(r["entry_sen"]), "stop": _yen(r["stop_sen"]),
                "target": _yen(r["target_sen"]),
                "confidence": r["confidence"], "reason": r["reason"] or "",
                "outcome": r["outcome"], "outcome_note": r["outcome_note"] or "",
            }
            for r in self.store.conn.execute(
                "SELECT * FROM decisions WHERE ticker = ? ORDER BY run_date DESC", (ticker,)
            )
        ]
        analyses: dict[str, dict[str, Any]] = {}
        for row in self.store.conn.execute(
            "SELECT run_date, agent, payload_json FROM analyses WHERE ticker = ? "
            "ORDER BY run_date DESC", (ticker,)
        ):
            analyses.setdefault(row["run_date"], {})[row["agent"]] = _json(row["payload_json"])

        trades = [t for t in self.all_fills(limit=500) if t["ticker"] == ticker]
        return {"ticker": ticker, "decisions": decisions, "analyses": analyses,
                "trades": trades}

    def known_tickers(self) -> list[str]:
        rows = self.store.conn.execute(
            "SELECT DISTINCT ticker FROM decisions UNION "
            "SELECT DISTINCT ticker FROM trades ORDER BY 1"
        ).fetchall()
        return [r[0] for r in rows]

    # -------------------------------------------------- コスト

    def cost_history(self) -> list[dict[str, Any]]:
        out = []
        for run in self.runs(limit=90):
            cost = run.cost or {}
            if cost:
                out.append({
                    "date": run.run_date,
                    "usd": cost.get("total_usd", 0.0),
                    "calls": cost.get("calls", 0),
                    "over_limit": bool(cost.get("over_limit")),
                })
        return list(reversed(out))


# ---------------------------------------------------------------- 小物


def _json(value: Any) -> Any:
    if not value:
        return {}
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return {}


def _yen(sen: Any) -> float | None:
    return None if sen is None else float(to_yen(int(sen)))
