"""永続化（SQLite）。ダッシュボードは**同じファイルを読むだけ**（SPEC 12）。

🔴 金額は銭の INTEGER で入れる。REAL（float）で入れない（SPEC 10.1）。
🔴 冪等性（SPEC 9.1）: 同じ営業日に2回走っても二重約定しない。
   `runs` に実行済み日付を持ち、再実行はスキップする。
🔴 部分失敗の一貫性（SPEC 9.1）: 途中で落ちてもポートフォリオが中途半端に更新されないよう、
   **全エージェント完了後にまとめてコミット**する（`transaction()` で囲む）。
"""

from __future__ import annotations

import json
import logging
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterator

from ..money import to_sen, to_yen
from .portfolio import Portfolio, Position, PositionState, Trade

log = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    run_date     TEXT PRIMARY KEY,
    started_at   TEXT NOT NULL,
    finished_at  TEXT,
    status       TEXT NOT NULL,          -- running / done / skipped / failed
    note         TEXT,
    funnel_json  TEXT,
    cost_json    TEXT,
    market_view  TEXT
);

CREATE TABLE IF NOT EXISTS state (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    cash_sen     INTEGER NOT NULL,
    peak_equity_sen INTEGER NOT NULL,
    initial_cash_sen INTEGER NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
    ticker                TEXT PRIMARY KEY,
    quantity              INTEGER NOT NULL,
    avg_price_sen         INTEGER NOT NULL,
    entry_date            TEXT NOT NULL,
    planned_holding_days  INTEGER NOT NULL,
    stop_sen              INTEGER,
    target_sen            INTEGER,
    time_exit_days        INTEGER,
    entry_reason          TEXT,
    entry_snapshot_json   TEXT
);

CREATE TABLE IF NOT EXISTS trades (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    run_date      TEXT NOT NULL,
    trade_date    TEXT NOT NULL,
    ticker        TEXT NOT NULL,
    side          TEXT NOT NULL,
    quantity      INTEGER NOT NULL,
    price_sen     INTEGER NOT NULL,
    fee_sen       INTEGER NOT NULL,
    realized_sen  INTEGER,
    holding_days  INTEGER,
    label         TEXT,
    reason        TEXT
);

CREATE TABLE IF NOT EXISTS equity_curve (
    run_date      TEXT PRIMARY KEY,
    cash_sen      INTEGER NOT NULL,
    equity_sen    INTEGER NOT NULL,
    peak_sen      INTEGER NOT NULL,
    drawdown_pct  REAL NOT NULL,
    position_count INTEGER NOT NULL,
    benchmark     REAL                     -- TOPIX 終値（ベンチマーク超過の算出用）
);

CREATE TABLE IF NOT EXISTS decisions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    run_date    TEXT NOT NULL,
    ticker      TEXT NOT NULL,
    action      TEXT NOT NULL,
    entry_sen   INTEGER,
    stop_sen    INTEGER,
    target_sen  INTEGER,
    planned_holding_days INTEGER,
    confidence  REAL,
    reason      TEXT,
    outcome     TEXT,                      -- executed / skipped / rejected
    outcome_note TEXT
);

CREATE TABLE IF NOT EXISTS analyses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    run_date    TEXT NOT NULL,
    ticker      TEXT NOT NULL,
    agent       TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    UNIQUE(run_date, ticker, agent)
);

-- 🔴 翌寄り約定を正しく再現するための発注待ち（SPEC 10.2）。
--    判断した日には約定させない。翌営業日の実際の寄りを見てから約定/見送りを決める。
--    これを持たずに当日終値で即約定すると**先読み**になる。
CREATE TABLE IF NOT EXISTS pending_orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    decided_on   TEXT NOT NULL,            -- 判断した営業日
    ticker       TEXT NOT NULL,
    side         TEXT NOT NULL,            -- buy / sell
    entry_sen    INTEGER,
    stop_sen     INTEGER,
    target_sen   INTEGER,
    planned_holding_days INTEGER,
    time_exit_days INTEGER,
    confidence   REAL,
    reason       TEXT,
    snapshot_json TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',  -- pending / filled / skipped / rejected
    resolved_on  TEXT,
    resolve_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_orders(status);
CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(trade_date);
CREATE INDEX IF NOT EXISTS idx_decisions_run ON decisions(run_date);
CREATE INDEX IF NOT EXISTS idx_analyses_run ON analyses(run_date);
"""


class Store:
    """SQLite への入口。

    🔴 `readonly=True` は**ダッシュボード用**（SPEC 12「閲覧専用」）。
       書き込めない接続で開くので、画面側から誤って書く経路が構造的に塞がる。
    🔴 `check_same_thread=False` が要る。Streamlit は再描画のたびに**別スレッド**で走るため、
       既定のままだと「作ったスレッド以外からは使えない」で落ちる。
       この接続を同時に書くのは日次バッチ（別プロセス）だけなので、共有しても競合しない。
    """

    def __init__(self, db_path: Path | str, *, readonly: bool = False):
        self.path = Path(db_path)
        self.readonly = readonly

        if readonly:
            if not self.path.exists():
                raise FileNotFoundError(f"DB がまだ無い: {self.path}")
            uri = f"file:{self.path.as_posix()}?mode=ro"
            self.conn = sqlite3.connect(uri, uri=True, isolation_level=None,
                                        check_same_thread=False)
            self.conn.row_factory = sqlite3.Row
            return

        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path, isolation_level=None,
                                    check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self.conn.executescript(SCHEMA)

    def close(self) -> None:
        self.conn.close()

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        """まとめてコミット。途中で落ちたら全部戻す（SPEC 9.1 部分失敗の一貫性）。"""
        self.conn.execute("BEGIN")
        try:
            yield self.conn
        except Exception:
            self.conn.execute("ROLLBACK")
            raise
        self.conn.execute("COMMIT")

    # -------------------------------------------------- 実行（冪等性）

    def already_ran(self, run_date: date) -> str | None:
        row = self.conn.execute(
            "SELECT status FROM runs WHERE run_date = ?", (run_date.isoformat(),)
        ).fetchone()
        return row["status"] if row else None

    def start_run(self, run_date: date, *, force: bool = False) -> bool:
        """実行を記録する。すでに done なら False（スキップすべき）。"""
        status = self.already_ran(run_date)
        if status == "done" and not force:
            return False
        self.conn.execute(
            "INSERT INTO runs(run_date, started_at, status) VALUES(?, ?, 'running') "
            "ON CONFLICT(run_date) DO UPDATE SET started_at=excluded.started_at, status='running'",
            (run_date.isoformat(), datetime.now().isoformat(timespec="seconds")),
        )
        return True

    def finish_run(self, run_date: date, *, status: str, note: str = "",
                   funnel: dict[str, Any] | None = None, cost: dict[str, Any] | None = None,
                   market_view: str = "") -> None:
        self.conn.execute(
            "UPDATE runs SET finished_at=?, status=?, note=?, funnel_json=?, cost_json=?, "
            "market_view=? WHERE run_date=?",
            (
                datetime.now().isoformat(timespec="seconds"), status, note,
                json.dumps(funnel or {}, ensure_ascii=False),
                json.dumps(cost or {}, ensure_ascii=False),
                market_view, run_date.isoformat(),
            ),
        )

    # -------------------------------------------------- ポートフォリオ

    def load_portfolio(self, initial_cash_yen: float) -> Portfolio:
        portfolio = Portfolio(initial_cash_yen)
        row = self.conn.execute("SELECT * FROM state WHERE id = 1").fetchone()
        if row is None:
            return portfolio

        portfolio.cash_sen = int(row["cash_sen"])
        portfolio.peak_equity_sen = int(row["peak_equity_sen"])
        portfolio.initial_cash_sen = int(row["initial_cash_sen"])

        for p in self.conn.execute("SELECT * FROM positions"):
            portfolio.positions[p["ticker"]] = Position(
                ticker=p["ticker"],
                quantity=int(p["quantity"]),
                avg_price_sen=int(p["avg_price_sen"]),
                entry_date=date.fromisoformat(p["entry_date"]),
                planned_holding_days=int(p["planned_holding_days"]),
                stop_sen=None if p["stop_sen"] is None else int(p["stop_sen"]),
                target_sen=None if p["target_sen"] is None else int(p["target_sen"]),
                time_exit_days=None if p["time_exit_days"] is None else int(p["time_exit_days"]),
                state=PositionState.HOLDING,
                entry_reason=p["entry_reason"] or "",
                entry_snapshot=json.loads(p["entry_snapshot_json"] or "{}"),
            )
        return portfolio

    def save_portfolio(self, portfolio: Portfolio) -> None:
        self.conn.execute(
            "INSERT INTO state(id, cash_sen, peak_equity_sen, initial_cash_sen, updated_at) "
            "VALUES(1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET "
            "cash_sen=excluded.cash_sen, peak_equity_sen=excluded.peak_equity_sen, "
            "initial_cash_sen=excluded.initial_cash_sen, updated_at=excluded.updated_at",
            (portfolio.cash_sen, portfolio.peak_equity_sen, portfolio.initial_cash_sen,
             datetime.now().isoformat(timespec="seconds")),
        )
        self.conn.execute("DELETE FROM positions")
        for pos in portfolio.positions.values():
            self.conn.execute(
                "INSERT INTO positions(ticker, quantity, avg_price_sen, entry_date, "
                "planned_holding_days, stop_sen, target_sen, time_exit_days, entry_reason, "
                "entry_snapshot_json) VALUES(?,?,?,?,?,?,?,?,?,?)",
                (pos.ticker, pos.quantity, pos.avg_price_sen, pos.entry_date.isoformat(),
                 pos.planned_holding_days, pos.stop_sen, pos.target_sen, pos.time_exit_days,
                 pos.entry_reason, json.dumps(pos.entry_snapshot, ensure_ascii=False, default=str)),
            )

    # -------------------------------------------------- 記録

    def record_trade(self, run_date: date, trade: Trade) -> None:
        self.conn.execute(
            "INSERT INTO trades(run_date, trade_date, ticker, side, quantity, price_sen, "
            "fee_sen, realized_sen, holding_days, label, reason) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (run_date.isoformat(), trade.date.isoformat(), trade.ticker, trade.side,
             trade.quantity, trade.price_sen, trade.cost_sen, trade.realized_sen,
             trade.holding_days, trade.label, trade.reason),
        )

    def record_equity(self, run_date: date, *, cash_sen: int, equity_sen: int, peak_sen: int,
                      drawdown_pct: float, position_count: int,
                      benchmark: float | None = None) -> None:
        self.conn.execute(
            "INSERT INTO equity_curve(run_date, cash_sen, equity_sen, peak_sen, drawdown_pct, "
            "position_count, benchmark) VALUES(?,?,?,?,?,?,?) "
            "ON CONFLICT(run_date) DO UPDATE SET cash_sen=excluded.cash_sen, "
            "equity_sen=excluded.equity_sen, peak_sen=excluded.peak_sen, "
            "drawdown_pct=excluded.drawdown_pct, position_count=excluded.position_count, "
            "benchmark=excluded.benchmark",
            (run_date.isoformat(), cash_sen, equity_sen, peak_sen, drawdown_pct,
             position_count, benchmark),
        )

    def record_decision(self, run_date: date, decision: dict[str, Any], *,
                        outcome: str, note: str = "") -> None:
        self.conn.execute(
            "INSERT INTO decisions(run_date, ticker, action, entry_sen, stop_sen, target_sen, "
            "planned_holding_days, confidence, reason, outcome, outcome_note) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (
                run_date.isoformat(), decision["ticker"], decision["action"],
                _sen_or_none(decision.get("entry")), _sen_or_none(decision.get("stop")),
                _sen_or_none(decision.get("target")), decision.get("planned_holding_days"),
                decision.get("confidence"), decision.get("reason"), outcome, note,
            ),
        )

    def record_analysis(self, run_date: date, ticker: str, agent: str,
                        payload: dict[str, Any]) -> None:
        self.conn.execute(
            "INSERT INTO analyses(run_date, ticker, agent, payload_json) VALUES(?,?,?,?) "
            "ON CONFLICT(run_date, ticker, agent) DO UPDATE SET payload_json=excluded.payload_json",
            (run_date.isoformat(), ticker, agent,
             json.dumps(payload, ensure_ascii=False, default=str)),
        )

    # -------------------------------------------------- 発注待ち（翌寄り約定）

    def add_pending(self, decided_on: date, decision: dict[str, Any],
                    snapshot: dict[str, Any] | None = None) -> None:
        self.conn.execute(
            "INSERT INTO pending_orders(decided_on, ticker, side, entry_sen, stop_sen, "
            "target_sen, planned_holding_days, time_exit_days, confidence, reason, "
            "snapshot_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (
                decided_on.isoformat(), decision["ticker"], decision["action"],
                _sen_or_none(decision.get("entry")), _sen_or_none(decision.get("stop")),
                _sen_or_none(decision.get("target")), decision.get("planned_holding_days"),
                (decision.get("exit_conditions") or {}).get("time_exit_days"),
                decision.get("confidence"), decision.get("reason"),
                json.dumps(snapshot or {}, ensure_ascii=False, default=str),
            ),
        )

    def pending_orders(self) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM pending_orders WHERE status='pending' ORDER BY id"
        ).fetchall()
        return [dict(r) for r in rows]

    def resolve_pending(self, order_id: int, *, status: str, on: date, note: str) -> None:
        self.conn.execute(
            "UPDATE pending_orders SET status=?, resolved_on=?, resolve_note=? WHERE id=?",
            (status, on.isoformat(), note, order_id),
        )

    def expire_stale_pending(self, before: date, note: str = "翌営業日に約定機会が無かった") -> int:
        """🔴 取り残しを放置しない。`before` より前に判断した pending は失効させる。

        （実行が飛んだ日があると、古い注文が何日も後に約定してしまう＝先読みに近い汚染）
        `before` には**今回の対象営業日**を渡す。当日判断ぶんは残り、翌営業日に処理される。
        """
        cur = self.conn.execute(
            "UPDATE pending_orders SET status='rejected', resolved_on=?, resolve_note=? "
            "WHERE status='pending' AND decided_on < ?",
            (before.isoformat(), note, before.isoformat()),
        )
        return cur.rowcount or 0

    # -------------------------------------------------- 読み出し（成績・ダッシュボード）

    def closed_trades(self, limit: int = 100) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM trades WHERE side='sell' ORDER BY trade_date DESC, id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [
            {
                "date": r["trade_date"], "ticker": r["ticker"], "quantity": r["quantity"],
                "price": float(to_yen(r["price_sen"])),
                "realized_pnl": float(to_yen(r["realized_sen"] or 0)),
                "holding_days": r["holding_days"], "label": r["label"], "reason": r["reason"],
            }
            for r in rows
        ]

    def equity_history(self) -> list[dict[str, Any]]:
        rows = self.conn.execute("SELECT * FROM equity_curve ORDER BY run_date").fetchall()
        return [
            {
                "date": r["run_date"],
                "equity": float(to_yen(r["equity_sen"])),
                "cash": float(to_yen(r["cash_sen"])),
                "drawdown_pct": r["drawdown_pct"],
                "position_count": r["position_count"],
                "benchmark": r["benchmark"],
            }
            for r in rows
        ]


def _sen_or_none(value: Any) -> int | None:
    return None if value is None else to_sen(value)
