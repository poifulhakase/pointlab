"""ダッシュボードが読むデータのテスト（SPEC 12 / 12.1）。

Streamlit は起動しない（UI と切り離してあるため）。見るのは:
  - 観察者バイアス対策が**データの出し方**として形になっているか
  - 読み取り専用で開けるか（画面から書けない）
"""

from __future__ import annotations

import json
from datetime import date

import pytest

from swinglab import money
from swinglab.dashboard_data import DashboardData
from swinglab.portfolio.portfolio import Portfolio
from swinglab.portfolio.store import Store


@pytest.fixture
def filled(tmp_path):
    """1営業日ぶんの記録が入ったDB。"""
    path = tmp_path / "t.db"
    store = Store(path)
    day = date(2026, 9, 18)
    store.start_run(day)

    store.record_analysis(day, "6986.T", "chart", {
        "regime": "uptrend", "higher_tf_trend": "up", "trend_strength": "strong",
        "position": "overbought", "swing_fit": "good", "comment": "抵抗線直下で迷い十字",
    })
    store.record_analysis(day, "6986.T", "supply_demand", {
        "supply_demand_score": 0.35, "selling_pressure": "mid",
        "short_squeeze_potential": "mid",
        "event_in_horizon": {"has_event": False, "event": "", "days_until": None},
        "comment": "制度買残が4週で57%増",
    })
    store.record_analysis(day, "6986.T", "news", {"_no_data": True, "catalyst": "none"})
    store.record_decision(day, {
        "ticker": "6986.T", "action": "hold", "entry": None, "stop": None, "target": None,
        "planned_holding_days": None, "confidence": 0.3, "reason": "過熱で見送り",
    }, outcome="hold", note="様子見")
    store.record_decision(day, {
        "ticker": "4565.T", "action": "buy", "entry": 1299.0, "stop": 1230.0,
        "target": 1380.0, "planned_holding_days": 6, "confidence": 0.55,
        "reason": "出来高を伴うブレイク",
    }, outcome="staged", note="翌寄りで発注予定")

    p = Portfolio(5_000_000)
    entry = p.buy(day=day, ticker="4565.T", quantity=100, price_sen=money.to_sen(1299),
                  fee_sen=money.to_sen(65), stop_sen=money.to_sen(1230),
                  target_sen=money.to_sen(1380), planned_holding_days=6, time_exit_days=6)
    store.record_trade(day, entry)
    store.save_portfolio(p)

    win = p.sell(day=date(2026, 9, 25), ticker="4565.T", price_sen=money.to_sen(1380),
                 fee_sen=money.to_sen(69), label="win", reason="利確到達")
    store.record_trade(date(2026, 9, 25), win)

    p2 = Portfolio(5_000_000)
    entry2 = p2.buy(day=day, ticker="8362.T", quantity=100, price_sen=money.to_sen(8000),
                    fee_sen=money.to_sen(400), stop_sen=None, target_sen=None,
                    planned_holding_days=5, time_exit_days=5)
    store.record_trade(day, entry2)
    loss = p2.sell(day=date(2026, 9, 24), ticker="8362.T", price_sen=money.to_sen(7600),
                   fee_sen=money.to_sen(380), label="loss", reason="損切り到達")
    store.record_trade(date(2026, 9, 24), loss)

    store.record_equity(day, cash_sen=p.cash_sen, equity_sen=money.to_sen(5_000_000),
                        peak_sen=money.to_sen(5_000_000), drawdown_pct=0.0,
                        position_count=1, benchmark=4091.14)
    store.finish_run(day, status="done", market_view="円安と米株高でリスクオン。",
                     funnel={"入力": 3678, "第3層通過": 12},
                     cost={"total_usd": 0.11, "calls": 10, "over_limit": False})
    store.close()
    return path


@pytest.fixture
def data(filled):
    store = Store(filled, readonly=True)
    yield DashboardData(store)
    store.close()


# ------------------------------------------------------------------ 読み取り専用


def test_dashboard_opens_read_only(filled):
    """🔴 画面から書ける経路を構造的に塞ぐ（SPEC 12「閲覧専用」）。"""
    store = Store(filled, readonly=True)
    try:
        with pytest.raises(Exception):
            store.conn.execute("DELETE FROM runs")
    finally:
        store.close()


def test_read_only_works_from_another_thread(filled):
    """🔴 Streamlit は再描画ごとに別スレッドで走る。既定の接続だと落ちる。"""
    import threading

    store = Store(filled, readonly=True)
    result = {}

    def read():
        result["rows"] = len(DashboardData(store).equity_history())

    try:
        t = threading.Thread(target=read)
        t.start()
        t.join()
        assert result["rows"] == 1
    finally:
        store.close()


def test_read_only_needs_an_existing_db(tmp_path):
    with pytest.raises(FileNotFoundError):
        Store(tmp_path / "ない.db", readonly=True)


# ------------------------------------------------------------------ 意思決定ビュー


def test_decision_view_lines_up_every_agent(data):
    rows = data.decision_view("2026-09-18")
    by_ticker = {r["ticker"]: r for r in rows}
    assert set(by_ticker) == {"6986.T", "4565.T"}

    row = by_ticker["6986.T"]
    # 各AIの読みが横に並ぶ（SPEC 12 画面1）
    assert row["chart"]["regime"] == "uptrend"
    assert row["supply_demand"]["supply_demand_score"] == 0.35
    assert row["news"]["_no_data"] is True
    assert row["decision"]["action"] == "hold"


def test_decision_view_returns_the_snapshot_as_recorded(data):
    """🔴 後知恵バイアス対策: 判断した時点の内容をそのまま返す。"""
    row = data.decision_view("2026-09-18")[0]
    assert "抵抗線直下" in row["chart"]["comment"]
    assert row["decision"]["confidence"] == 0.3


def test_decision_view_converts_sen_to_yen(data):
    buy = [r for r in data.decision_view("2026-09-18") if r["ticker"] == "4565.T"][0]
    assert buy["decision"]["entry"] == pytest.approx(1299.0)
    assert buy["decision"]["stop"] == pytest.approx(1230.0)


def test_decision_view_of_an_unknown_day_is_empty(data):
    assert data.decision_view("2020-01-01") == []


# ------------------------------------------------------------------ 実行・コスト


def test_runs_are_newest_first(data):
    runs = data.runs()
    assert runs[0].run_date == "2026-09-18"
    assert runs[0].status == "done"
    assert runs[0].funnel["第3層通過"] == 12
    assert runs[0].cost["calls"] == 10


def test_cost_history_is_oldest_first_for_charting(data):
    history = data.cost_history()
    assert history and history[0]["usd"] == pytest.approx(0.11)


# ------------------------------------------------------------------ 履歴（12.1）


def test_history_is_not_sorted_by_result_by_default(data):
    """🔴 確証バイアス対策: 既定は日付順。勝ち優先で並べない。"""
    rows = data.trades()
    assert [r["ticker"] for r in rows] == ["4565.T", "8362.T"]   # 9/25 → 9/24


def test_history_filters_are_opt_in(data):
    assert [r["ticker"] for r in data.trades(result="勝ちだけ")] == ["4565.T"]
    assert [r["ticker"] for r in data.trades(result="負けだけ")] == ["8362.T"]


def test_recent_losses_are_available_on_their_own(data):
    """🔴 負けを埋もれさせない（成績サマリに常設する）。"""
    losses = data.recent_losses()
    assert [t["ticker"] for t in losses] == ["8362.T"]
    assert losses[0]["realized_pnl"] < 0


def test_all_fills_include_buys_and_sells(data):
    sides = {t["side"] for t in data.all_fills()}
    assert sides == {"buy", "sell"}


# ------------------------------------------------------------------ 保有


def test_positions_include_losing_ones(data):
    """🔴 損失回避対策: 含み損のポジションも必ず出す。"""
    state = data.positions(5_000_000, today=date(2026, 9, 24))
    assert state["cash"] > 0
    tickers = [p["ticker"] for p in state["positions"]]
    assert "4565.T" in tickers
    # 建てた順（損益順に並べ替えて負けを下に隠さない）
    assert state["positions"][0]["entry_date"] == "2026-09-18"


def test_positions_show_days_held(data):
    state = data.positions(5_000_000, today=date(2026, 9, 24))
    assert state["positions"][0]["days_held"] >= 0
    assert "days_remaining" in state["positions"][0]


# ------------------------------------------------------------------ ドリルダウン


def test_ticker_history_collects_everything(data):
    detail = data.ticker_history("4565.T")
    assert detail["decisions"][0]["action"] == "buy"
    assert detail["trades"]
    assert "2026-09-18" not in detail["analyses"]      # この銘柄の分析は記録していない


def test_known_tickers_covers_decisions_and_trades(data):
    assert set(data.known_tickers()) >= {"6986.T", "4565.T", "8362.T"}


def test_broken_json_does_not_crash(tmp_path):
    """記録が壊れていても画面を落とさない（読めないものは空として扱う）。"""
    store = Store(tmp_path / "b.db")
    store.conn.execute(
        "INSERT INTO analyses(run_date, ticker, agent, payload_json) VALUES(?,?,?,?)",
        ("2026-09-18", "X.T", "chart", "{壊れた"),
    )
    try:
        rows = DashboardData(store).decision_view("2026-09-18")
        assert rows[0]["chart"] == {}
    finally:
        store.close()


def test_empty_db_is_safe(tmp_path):
    store = Store(tmp_path / "e.db")
    try:
        d = DashboardData(store)
        assert d.runs() == []
        assert d.latest_run() is None
        assert d.equity_history() == []
        assert d.known_tickers() == []
        assert d.positions(5_000_000)["positions"] == []
    finally:
        store.close()
