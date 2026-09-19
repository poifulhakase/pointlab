"""永続化・冪等性・成績指標のテスト（SPEC 9.1 / 10.4）。"""

from __future__ import annotations

from datetime import date

import pytest

from swinglab import money
from swinglab.learning import outcomes
from swinglab.portfolio.portfolio import Portfolio
from swinglab.portfolio.store import Store


@pytest.fixture
def store(tmp_path):
    s = Store(tmp_path / "test.db")
    yield s
    s.close()


# ------------------------------------------------------------------ 冪等性


def test_same_day_run_twice_is_blocked(store):
    """🔴 同じ営業日に2回走っても二重約定しない（SPEC 9.1）。"""
    day = date(2026, 9, 18)
    assert store.start_run(day) is True
    store.finish_run(day, status="done")
    assert store.start_run(day) is False          # 2回目は拒否
    assert store.start_run(day, force=True) is True   # --force なら通す


def test_failed_run_can_be_retried(store):
    """失敗した日は同じ営業日内なら再実行できる。"""
    day = date(2026, 9, 18)
    store.start_run(day)
    store.finish_run(day, status="failed", note="APIが落ちた")
    assert store.start_run(day) is True


# ------------------------------------------------------------------ 状態の往復


def test_portfolio_round_trip_keeps_exact_amounts(store):
    """🔴 保存→読み込みで1銭もズレない（int で持っているため）。"""
    p = Portfolio(5_000_000)
    p.buy(day=date(2026, 9, 24), ticker="6986.T", quantity=100,
          price_sen=money.to_sen(803.3), fee_sen=money.to_sen(40.2),
          stop_sen=money.to_sen(734), target_sen=money.to_sen(880),
          planned_holding_days=7, time_exit_days=8, reason="テスト")
    store.save_portfolio(p)

    loaded = store.load_portfolio(5_000_000)
    assert loaded.cash_sen == p.cash_sen
    assert loaded.peak_equity_sen == p.peak_equity_sen
    pos = loaded.positions["6986.T"]
    assert pos.quantity == 100
    assert pos.avg_price_sen == money.to_sen(803.3)
    assert pos.entry_date == date(2026, 9, 24)
    assert pos.stop_sen == money.to_sen(734)


def test_empty_store_returns_initial_portfolio(store):
    p = store.load_portfolio(5_000_000)
    assert p.cash_sen == money.to_sen(5_000_000)
    assert p.positions == {}


# ------------------------------------------------------------------ 発注待ち


def test_pending_order_lifecycle(store):
    decision = {
        "ticker": "6986.T", "action": "buy", "entry": 803.0, "stop": 734.0,
        "target": 880.0, "planned_holding_days": 7, "confidence": 0.45,
        "reason": "ブレイク", "exit_conditions": {"time_exit_days": 7},
    }
    store.add_pending(date(2026, 9, 18), decision)
    pending = store.pending_orders()
    assert len(pending) == 1
    assert pending[0]["entry_sen"] == money.to_sen(803.0)

    store.resolve_pending(pending[0]["id"], status="filled", on=date(2026, 9, 24), note="約定")
    assert store.pending_orders() == []


def test_stale_pending_orders_expire(store):
    """🔴 実行が飛んだ日があっても、古い注文が後日約定しない（先読み汚染の防止）。"""
    decision = {"ticker": "6986.T", "action": "buy", "entry": 803.0, "stop": 734.0,
                "target": 880.0, "planned_holding_days": 7, "confidence": 0.4,
                "reason": "r", "exit_conditions": {}}
    store.add_pending(date(2026, 9, 10), decision)     # 古い
    store.add_pending(date(2026, 9, 18), decision)     # 当日ぶん

    expired = store.expire_stale_pending(date(2026, 9, 18))
    assert expired == 1
    remaining = store.pending_orders()
    assert len(remaining) == 1
    assert remaining[0]["decided_on"] == "2026-09-18"


# ------------------------------------------------------------------ 成績（SPEC 10.4）


def _trade(pnl, days, label="win"):
    return {"date": "2026-10-01", "ticker": "X.T", "realized_pnl": pnl,
            "holding_days": days, "label": label}


def test_performance_expectancy_known_value():
    """手計算: 勝3（+10,000 平均）・負2（-5,000 平均）。

    勝率 = 3/5 = 0.6
    期待値 = 0.6×10,000 − 0.4×5,000 = 6,000 − 2,000 = 4,000円
    ペイオフ = 10,000 / 5,000 = 2.0
    """
    trades = [_trade(10000, 5)] * 3 + [_trade(-5000, 3, "loss")] * 2
    perf = outcomes.summarize(trades)
    assert perf.win_rate == pytest.approx(0.6)
    assert perf.avg_win_yen == pytest.approx(10000)
    assert perf.avg_loss_yen == pytest.approx(5000)
    assert perf.expectancy_yen == pytest.approx(4000)
    assert perf.payoff_ratio == pytest.approx(2.0)


def test_performance_low_n_is_flagged_unreliable():
    """🔴 n が小さいうちは点推定を信じない（SPEC 10.4）。"""
    perf = outcomes.summarize([_trade(1000, 3)] * 5)
    assert perf.reliable is False
    assert "暫定値" in perf.text()


def test_win_rate_confidence_interval_is_wide_at_small_n():
    """n=30 の勝率60% は 95%CI がおよそ 42〜76%＝50%と区別できない。"""
    trades = [_trade(1000, 3)] * 18 + [_trade(-1000, 3, "loss")] * 12
    perf = outcomes.summarize(trades)
    low, high = perf.win_rate_ci
    assert low < 0.5 < high                      # 50%（無意味）を含んでしまう
    assert 0.40 < low < 0.46
    assert 0.74 < high < 0.78


def test_win_rate_ci_stays_within_bounds():
    """全勝でも上限は1.0を超えない（正規近似ではこれが壊れる）。"""
    low, high = outcomes.wilson_interval(5, 5)
    assert 0.0 <= low <= high <= 1.0


def test_performance_empty_is_safe():
    perf = outcomes.summarize([])
    assert perf.trades == 0 and perf.expectancy_yen == 0.0


def test_holding_day_buckets():
    trades = [_trade(1000, 3), _trade(-500, 7, "loss"), _trade(2000, 12)]
    perf = outcomes.summarize(trades)
    assert perf.by_holding_days["2-4日"]["件数"] == 1
    assert perf.by_holding_days["5-9日"]["件数"] == 1
    assert perf.by_holding_days["10-14日"]["件数"] == 1


def test_label_trade():
    assert outcomes.label_trade(1000, "利確到達") == "win"
    assert outcomes.label_trade(-1000, "損切り到達") == "loss"
    assert outcomes.label_trade(500, "時間手仕舞い（保有14営業日 ≥ 14日）") == "time_exit"


def test_benchmark_excess_known_value():
    """自分 +10% / TOPIX +4% → 超過 +6%（地合いで勝っただけかを見抜く）。"""
    history = [
        {"date": "2026-09-18", "equity": 1000.0, "benchmark": 100.0},
        {"date": "2026-10-18", "equity": 1100.0, "benchmark": 104.0},
    ]
    out = outcomes.benchmark_excess(history)
    assert out["自分%"] == pytest.approx(10.0)
    assert out["TOPIX%"] == pytest.approx(4.0)
    assert out["超過%"] == pytest.approx(6.0)


def test_benchmark_excess_needs_two_points():
    assert outcomes.benchmark_excess([{"date": "d", "equity": 1.0, "benchmark": 1.0}]) is None


# ------------------------------------------------------------------ 記録の読み出し


def test_closed_trades_and_equity_history(store):
    p = Portfolio(5_000_000)
    p.buy(day=date(2026, 9, 24), ticker="X.T", quantity=100,
          price_sen=money.to_sen(1000), fee_sen=money.to_sen(50),
          stop_sen=None, target_sen=None, planned_holding_days=7, time_exit_days=7)
    trade = p.sell(day=date(2026, 10, 1), ticker="X.T", price_sen=money.to_sen(1100),
                   fee_sen=money.to_sen(55), label="win", reason="利確到達")
    store.record_trade(date(2026, 10, 1), trade)
    store.record_equity(date(2026, 10, 1), cash_sen=p.cash_sen,
                        equity_sen=p.equity_sen({}), peak_sen=p.peak_equity_sen,
                        drawdown_pct=0.0, position_count=0, benchmark=4100.0)

    closed = store.closed_trades()
    assert len(closed) == 1
    # (1,100 - 1,000) × 100 - 55 = 9,945円
    assert closed[0]["realized_pnl"] == pytest.approx(9945)
    assert closed[0]["label"] == "win"

    history = store.equity_history()
    assert len(history) == 1 and history[0]["benchmark"] == 4100.0


# ------------------------------------------------------------------ 回帰テスト


def test_order_decided_today_is_not_filled_today():
    """🔴 回帰テスト（2026-09-19 に踏んだ先読みバグ）。

    `--force` で同じ営業日を再実行したとき、その日に判断した注文が
    **その日の寄り**で約定していた。「その日の終値まで見たうえでその日の始値で買う」
    ことになり、成績が構造的に良く見える（SPEC 15 先読みバイアス）。
    """
    from swinglab.orchestrator import order_is_due

    run_day = date(2026, 9, 24)
    assert order_is_due("2026-09-18", run_day) is True    # 前営業日の判断 → 今日約定
    assert order_is_due("2026-09-24", run_day) is False   # 同じ日の判断 → 約定させない
    assert order_is_due("2026-09-25", run_day) is False   # 未来（あり得ないが念のため）


def test_already_ran_is_a_skip_but_not_an_error():
    """🔴 「すでに実行済み」で #エラー・異常 を鳴らさない（二重起動は正常）。"""
    from swinglab.orchestrator import AlreadyRan, SkipRun

    assert issubclass(AlreadyRan, SkipRun)
    # main.py は AlreadyRan を先に捕まえて通知せずに終える
    import inspect

    import main as main_mod
    src = inspect.getsource(main_mod.main)
    assert src.index("except AlreadyRan") < src.index("except SkipRun as exc")
