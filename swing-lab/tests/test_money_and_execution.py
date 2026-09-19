"""お金・執行・サイジングの単体テスト（SPEC 9.2）。

🔴 ここは**お金の計算**なので「それっぽい」を許さない。手計算した既知の値と突き合わせる。
🔴 境界（現金0・ATR=0・単元切り下げで0株・stop=entry）で安全に振る舞うことを試す。
"""

from __future__ import annotations

from datetime import date

import pytest

from swinglab import money
from swinglab.portfolio import execution as ex
from swinglab.portfolio.portfolio import (
    Portfolio, PortfolioError, PositionState, transition,
)


# ------------------------------------------------------------------ money


def test_to_sen_known_values():
    assert money.to_sen(1234.5) == 123450
    assert money.to_sen(3000) == 300000
    assert money.to_sen("0.01") == 1


def test_to_sen_rounds_half_up():
    # 0.005円 = 0.5銭 → 1銭（四捨五入を明示的に決めてある）
    assert money.to_sen(0.005) == 1
    assert money.to_sen(0.004) == 0


def test_float_error_does_not_accumulate():
    """🔴 float なら 0.1+0.2 != 0.3。int の銭なら一致する。"""
    assert 0.1 + 0.2 != 0.3                       # float の現実
    assert money.to_sen(0.1) + money.to_sen(0.2) == money.to_sen(0.3)

    # 1円を1万回足しても誤差ゼロ
    total = sum(money.to_sen(0.1) for _ in range(10000))
    assert total == money.to_sen(1000)


def test_apply_bps_is_always_adverse():
    """買いは高く、売りは安く（SPEC 10.2 会計ルール）。"""
    price = 300000  # 3,000円
    # 5bps = 0.05% → 300000 * 0.0005 = 150銭
    assert money.apply_bps(price, 5, adverse=True, is_buy=True) == 300150
    assert money.apply_bps(price, 5, adverse=True, is_buy=False) == 299850


# ------------------------------------------------------------------ 手数料


def test_fee_is_half_of_round_trip():
    """cost_bps は往復。片道はその半分（10bps → 片道5bps）。"""
    notional = money.to_sen(1_000_000)      # 100万円 = 1億銭
    # 1億銭 × 0.0005 = 50,000銭 = 500円
    assert ex.fee_sen(notional, 10) == 50000
    assert money.to_yen(ex.fee_sen(notional, 10)) == pytest.approx(500)


# ------------------------------------------------------------------ サイジング


def test_sizing_risk_basis_known_value(cfg):
    """手計算: 口座1,000万円・リスク1%・entry3,000円・stop2,900円。

    リスク予算 = 1,000万 × 1% = 10万円 = 1,000万銭
    1株あたりリスク = 100円 = 10,000銭
    → リスク基準 1,000株
    1銘柄上限 = 1,000万 × 20% = 200万円 → 200万/3,000 = 666株
    → min(1000, 666) = 666 → 単元切り下げ 600株
    """
    result = ex.size_position(
        cfg=cfg,
        equity_sen=money.to_sen(10_000_000),
        cash_sen=money.to_sen(10_000_000),
        entry_sen=money.to_sen(3000),
        stop_sen=money.to_sen(2900),
        avg_volume=10_000_000,
    )
    assert result.detail["risk基準"] == 1000
    assert result.detail["1銘柄上限基準"] == 666
    assert result.quantity == 600
    assert result.basis == "position_cap"


def test_sizing_stop_equals_entry_is_skipped(cfg):
    """🔴 損切り距離ゼロ。0除算せず見送り（SPEC 9.2 境界値）。"""
    result = ex.size_position(
        cfg=cfg, equity_sen=money.to_sen(10_000_000), cash_sen=money.to_sen(10_000_000),
        entry_sen=money.to_sen(3000), stop_sen=money.to_sen(3000), avg_volume=1_000_000,
    )
    assert result.quantity == 0
    assert result.basis == "invalid_stop"


def test_sizing_zero_cash_is_skipped(cfg):
    result = ex.size_position(
        cfg=cfg, equity_sen=money.to_sen(10_000_000), cash_sen=0,
        entry_sen=money.to_sen(3000), stop_sen=money.to_sen(2900), avg_volume=1_000_000,
    )
    assert result.quantity == 0


def test_sizing_volume_cap_applies(cfg):
    """出来高の5%を超える数量は建てない（SPEC 10.5）。"""
    result = ex.size_position(
        cfg=cfg, equity_sen=money.to_sen(10_000_000), cash_sen=money.to_sen(10_000_000),
        entry_sen=money.to_sen(3000), stop_sen=money.to_sen(2900),
        avg_volume=2000,   # 1日2,000株 → 5% = 100株
    )
    assert result.detail["出来高上限"] == 100
    assert result.quantity == 100
    assert result.basis == "volume_cap"


def test_sizing_rounds_down_to_lot_and_may_become_zero(cfg):
    """単元切り下げで0株になる銘柄は見送り（端株は扱わない）。"""
    result = ex.size_position(
        cfg=cfg, equity_sen=money.to_sen(1_000_000), cash_sen=money.to_sen(1_000_000),
        entry_sen=money.to_sen(9000), stop_sen=money.to_sen(8900), avg_volume=1_000_000,
    )
    # 1銘柄上限 20万円 ÷ 9,000円 = 22株 → 単元100に切り下げて 0株
    assert result.detail["1銘柄上限基準"] == 22
    assert result.quantity == 0


# ------------------------------------------------------------------ エントリー


def _bar(o, h, l, c, v=1_000_000):
    return ex.Bar(money.to_sen(o), money.to_sen(h), money.to_sen(l), money.to_sen(c), v)


def test_entry_fills_at_next_open_with_adverse_slippage(cfg):
    result, sizing = ex.simulate_entry(
        cfg=cfg, next_bar=_bar(3000, 3050, 2980, 3020),
        planned_entry_sen=money.to_sen(3000), stop_sen=money.to_sen(2900),
        equity_sen=money.to_sen(10_000_000), cash_sen=money.to_sen(10_000_000),
        avg_volume=10_000_000,
    )
    assert result.filled
    # 始値3,000円にスリッページ5bps（不利方向＝高く）→ 300,000 + 150 = 300,150銭
    assert result.price_sen == 300150
    assert result.quantity == 600


def test_entry_skipped_when_gap_too_large(cfg):
    """翌寄りが想定から2%超離れたら見送り（飛びつかない）。"""
    result, _ = ex.simulate_entry(
        cfg=cfg, next_bar=_bar(3100, 3150, 3080, 3120),   # 想定3,000 → +3.3%
        planned_entry_sen=money.to_sen(3000), stop_sen=money.to_sen(2900),
        equity_sen=money.to_sen(10_000_000), cash_sen=money.to_sen(10_000_000),
        avg_volume=10_000_000,
    )
    assert not result.filled
    assert "乖離" in result.reason


def test_entry_rejected_when_no_volume(cfg):
    """寄らず（ストップ高/安で値が付かない）→ 不成立。"""
    result, _ = ex.simulate_entry(
        cfg=cfg, next_bar=_bar(3000, 3000, 3000, 3000, v=0),
        planned_entry_sen=money.to_sen(3000), stop_sen=money.to_sen(2900),
        equity_sen=money.to_sen(10_000_000), cash_sen=money.to_sen(10_000_000),
        avg_volume=10_000_000,
    )
    assert not result.filled
    assert "寄らず" in result.reason


# ------------------------------------------------------------------ 手仕舞い


class _Pos:
    def __init__(self, stop=None, target=None, time_exit=None):
        self.stop_sen = None if stop is None else money.to_sen(stop)
        self.target_sen = None if target is None else money.to_sen(target)
        self.time_exit_days = time_exit


def test_exit_stop_hit(cfg):
    check = ex.check_exit(cfg=cfg, position=_Pos(stop=2900, target=3200),
                          bar=_bar(3000, 3050, 2880, 2950), days_held=3)
    assert check.should_exit and check.label == "loss"
    # 損切り2,900円を不利方向（売りは安く）→ 290,000 - 145 = 289,855銭
    assert check.price_sen == 289855


def test_exit_target_hit(cfg):
    check = ex.check_exit(cfg=cfg, position=_Pos(stop=2900, target=3200),
                          bar=_bar(3000, 3250, 2980, 3220), days_held=3)
    assert check.should_exit and check.label == "win"
    assert check.price_sen == money.to_sen(3200) - 160


def test_exit_both_touched_prefers_stop(cfg):
    """🔴 同日に両方に触れたら**損切り側**（日足では前後不明・成績を甘くしない）。"""
    check = ex.check_exit(cfg=cfg, position=_Pos(stop=2900, target=3200),
                          bar=_bar(3000, 3250, 2880, 3100), days_held=3)
    assert check.should_exit and check.label == "loss"
    assert "両方に触れた" in check.reason


def test_exit_time_limit_is_enforced_by_code(cfg):
    """LLM が hold と言い続けても、上限に達したらコードが手仕舞う（SPEC 15）。"""
    max_days = int(cfg.get("holding.max_days"))
    check = ex.check_exit(cfg=cfg, position=_Pos(stop=2000, target=9000),
                          bar=_bar(3000, 3050, 2980, 3020), days_held=max_days)
    assert check.should_exit and check.label == "time_exit"


def test_exit_not_triggered_in_normal_day(cfg):
    check = ex.check_exit(cfg=cfg, position=_Pos(stop=2900, target=3200),
                          bar=_bar(3000, 3100, 2950, 3050), days_held=3)
    assert not check.should_exit


# ------------------------------------------------------------------ ストップ妥当性


def test_validate_stop_rejects_too_tight(cfg):
    ok, note = ex.validate_stop(cfg=cfg, entry_sen=money.to_sen(3000),
                                stop_sen=money.to_sen(2995), atr_sen=money.to_sen(60))
    assert not ok and "近すぎる" in note


def test_validate_stop_rejects_too_far(cfg):
    ok, note = ex.validate_stop(cfg=cfg, entry_sen=money.to_sen(3000),
                                stop_sen=money.to_sen(2500), atr_sen=money.to_sen(60))
    assert not ok and "遠すぎる" in note


def test_validate_stop_accepts_reasonable(cfg):
    ok, _ = ex.validate_stop(cfg=cfg, entry_sen=money.to_sen(3000),
                             stop_sen=money.to_sen(2880), atr_sen=money.to_sen(60))
    assert ok


def test_validate_stop_with_zero_atr_does_not_divide(cfg):
    """🔴 ATR=0（値動きなし）で0除算しない。"""
    ok, _ = ex.validate_stop(cfg=cfg, entry_sen=money.to_sen(3000),
                             stop_sen=money.to_sen(2900), atr_sen=0)
    assert ok


# ------------------------------------------------------------------ リスクオフ


def test_risk_off_detects_market_crash(cfg):
    reasons = ex.risk_off_reasons(cfg=cfg, macro={"topix": {"change_pct": -3.5}})
    assert reasons and "TOPIX" in reasons[0]


def test_risk_off_detects_vix_spike(cfg):
    reasons = ex.risk_off_reasons(cfg=cfg, macro={"vix": {"close": 35.0}})
    assert reasons and "VIX" in reasons[0]


def test_risk_off_quiet_market_is_empty(cfg):
    reasons = ex.risk_off_reasons(cfg=cfg, macro={
        "topix": {"change_pct": 0.8}, "vix": {"close": 15.7},
        "usdjpy": {"change_pct": 0.63}, "^GSPC": {"change_pct": 0.5},
    })
    assert reasons == []


# ------------------------------------------------------------------ ポートフォリオ


def test_buy_and_sell_pnl_known_value(cfg):
    """手計算: 3,000円で100株買い、3,200円で売る。手数料は片道500円相当。"""
    p = Portfolio(1_000_000)
    p.buy(day=date(2026, 9, 24), ticker="7203.T", quantity=100,
          price_sen=money.to_sen(3000), fee_sen=money.to_sen(150),
          stop_sen=money.to_sen(2900), target_sen=money.to_sen(3200),
          planned_holding_days=7, time_exit_days=7)
    # 現金 = 100万 - (3,000×100 + 150) = 1,000,000 - 300,150 = 699,850円
    assert money.to_yen(p.cash_sen) == pytest.approx(699850)

    trade = p.sell(day=date(2026, 10, 1), ticker="7203.T", price_sen=money.to_sen(3200),
                   fee_sen=money.to_sen(160), label="win")
    # 実現損益 = (3,200 - 3,000) × 100 - 160 = 20,000 - 160 = 19,840円
    assert money.to_yen(trade.realized_sen) == pytest.approx(19840)
    # 現金 = 699,850 + (3,200×100 - 160) = 699,850 + 319,840 = 1,019,690円
    assert money.to_yen(p.cash_sen) == pytest.approx(1019690)
    assert "7203.T" not in p.positions


def test_buy_rejects_when_cash_insufficient():
    p = Portfolio(100_000)
    with pytest.raises(PortfolioError, match="現金不足"):
        p.buy(day=date(2026, 9, 24), ticker="7203.T", quantity=100,
              price_sen=money.to_sen(3000), fee_sen=0, stop_sen=None, target_sen=None,
              planned_holding_days=7, time_exit_days=7)


def test_buy_rejects_duplicate_without_pyramiding():
    p = Portfolio(10_000_000)
    kwargs = dict(day=date(2026, 9, 24), ticker="7203.T", quantity=100,
                  price_sen=money.to_sen(3000), fee_sen=0, stop_sen=None, target_sen=None,
                  planned_holding_days=7, time_exit_days=7)
    p.buy(**kwargs)
    with pytest.raises(PortfolioError, match="すでに保有中"):
        p.buy(**kwargs)


def test_sell_without_position_raises():
    p = Portfolio(1_000_000)
    with pytest.raises(PortfolioError, match="保有していない"):
        p.sell(day=date(2026, 9, 24), ticker="7203.T", price_sen=money.to_sen(3000), fee_sen=0)


def test_illegal_state_transition_is_rejected():
    """🔴 exited から holding へ戻す等の不整合はコードが拒否する（SPEC 10.1 FSM）。"""
    with pytest.raises(PortfolioError, match="不正な状態遷移"):
        transition(PositionState.EXITED, PositionState.HOLDING)
    with pytest.raises(PortfolioError, match="不正な状態遷移"):
        transition(PositionState.CANDIDATE, PositionState.HOLDING)  # open を飛ばした
    # 合法な遷移は通る
    assert transition(PositionState.OPEN, PositionState.HOLDING) == PositionState.HOLDING


def test_drawdown_tracks_peak():
    p = Portfolio(1_000_000)
    p.update_peak(money.to_sen(1_200_000))
    assert p.drawdown(money.to_sen(1_080_000)) == pytest.approx(0.1)
    assert p.drawdown(money.to_sen(1_300_000)) == 0.0


def test_equity_uses_book_value_when_price_missing():
    """🔴 価格が取れない銘柄を勝手に0評価しない。"""
    p = Portfolio(1_000_000)
    p.buy(day=date(2026, 9, 24), ticker="7203.T", quantity=100,
          price_sen=money.to_sen(3000), fee_sen=0, stop_sen=None, target_sen=None,
          planned_holding_days=7, time_exit_days=7)
    equity = p.equity_sen({})   # 価格なし
    assert money.to_yen(equity) == pytest.approx(1_000_000)
