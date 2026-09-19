"""指標の単体テスト（SPEC 9.2）。

🔴 「それっぽく動く」を許さない。**手計算した既知の値**と突き合わせる。
   境界（ATR=0・値動きなし・足が足りない）でクラッシュしないことも試す。
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from robotrade.data import indicators as ind


def make_df(closes, highs=None, lows=None, opens=None, volumes=None) -> pd.DataFrame:
    n = len(closes)
    idx = pd.bdate_range("2026-01-01", periods=n)
    return pd.DataFrame(
        {
            "open": opens if opens is not None else closes,
            "high": highs if highs is not None else [c + 1 for c in closes],
            "low": lows if lows is not None else [c - 1 for c in closes],
            "close": closes,
            "volume": volumes if volumes is not None else [1000.0] * n,
        },
        index=idx,
    )


# ------------------------------------------------------------------ 既知入力→既知出力


def test_sma_known_value():
    s = pd.Series([1.0, 2, 3, 4, 5])
    # 直近3本の平均 = (3+4+5)/3 = 4.0
    assert ind.sma(s, 3).iloc[-1] == pytest.approx(4.0)
    # 窓が埋まるまでは NaN（前方に嘘を埋めない）
    assert pd.isna(ind.sma(s, 3).iloc[1])


def test_true_range_known_value():
    df = make_df([100.0, 110.0], highs=[105.0, 112.0], lows=[95.0, 108.0])
    tr = ind.true_range(df)
    assert tr.iloc[0] == pytest.approx(10.0)          # 高値-安値（前日終値なし）
    # 2日目: high-low=4, |high-prev_close|=12, |low-prev_close|=8 → 12
    assert tr.iloc[1] == pytest.approx(12.0)


def test_slope_pct_known_value():
    # 100 → 110 を 5日 ＝ +10% を5日で割って 1日あたり 2.0%
    s = pd.Series([100.0] + [0.0] * 4 + [110.0])
    s.iloc[1:5] = np.nan
    s = pd.Series([100.0, 102.0, 104.0, 106.0, 108.0, 110.0])
    assert ind.slope_pct(s, 5).iloc[-1] == pytest.approx(2.0)


def test_bollinger_known_value():
    # 一定値の系列は std=0 → バンド幅0 → %B は NaN（0で埋めない）
    df = ind.bollinger(pd.Series([50.0] * 25), 20, 2.0)
    assert df["bb_mid"].iloc[-1] == pytest.approx(50.0)
    assert df["bb_width"].iloc[-1] == pytest.approx(0.0)
    assert pd.isna(df["bb_pct_b"].iloc[-1])


def test_rsi_all_up_is_100():
    """🔴 0除算の境界。一度も下げていない系列は avg_loss=0。"""
    s = pd.Series([float(i) for i in range(1, 40)])
    assert ind.rsi(s, 14).iloc[-1] == pytest.approx(100.0)


def test_rsi_flat_is_50():
    """上げも下げも無いときは 50（中立）。NaN やクラッシュにしない。"""
    s = pd.Series([100.0] * 40)
    assert ind.rsi(s, 14).iloc[-1] == pytest.approx(50.0)


# ------------------------------------------------------------------ 価格構造


def test_swing_points_finds_peak_and_trough():
    closes = [10, 11, 12, 15, 12, 11, 10, 9, 8, 9, 10, 11, 12, 13]
    df = make_df([float(c) for c in closes],
                 highs=[float(c) + 0.5 for c in closes],
                 lows=[float(c) - 0.5 for c in closes])
    out = ind.swing_points(df, lookback=20)
    # 山は index3 の高値 15.5、谷は index8 の安値 7.5
    assert out["swing_high"] == pytest.approx(15.5)
    assert out["swing_low"] == pytest.approx(7.5)
    # 現値 13 の上にある直近の山＝レジスタンス、下にある谷＝サポート
    assert out["resistance"] == pytest.approx(15.5)
    assert out["support"] == pytest.approx(7.5)


def test_swing_points_too_short_returns_none():
    """足が足りないときは None を返す（でっち上げない）。"""
    out = ind.swing_points(make_df([10.0, 11.0]), lookback=20)
    assert out["swing_high"] is None and out["support"] is None


def test_candle_pattern_doji():
    df = make_df([100.0, 100.0], opens=[100.0, 100.05], highs=[101.0, 103.0], lows=[99.0, 97.0])
    assert ind.candle_pattern(df).startswith("doji")


def test_candle_pattern_bullish_engulfing():
    # 前日が陰線(102→98)、当日が陽線(97→104)で前日の実体を包む
    df = make_df([98.0, 104.0], opens=[102.0, 97.0], highs=[103.0, 105.0], lows=[97.0, 96.0])
    assert ind.candle_pattern(df).startswith("bullish_engulfing")


def test_candle_pattern_zero_range_is_none():
    """🔴 ストップ高/安で値幅ゼロ。0除算せず none を返す。"""
    df = make_df([100.0, 100.0], opens=[100.0, 100.0], highs=[100.0, 100.0], lows=[100.0, 100.0])
    assert ind.candle_pattern(df) == "none"


def test_to_weekly_aggregates_ohlc():
    idx = pd.bdate_range("2026-01-05", periods=5)  # 月〜金の1週間
    df = pd.DataFrame(
        {"open": [10.0, 11, 12, 13, 14], "high": [15.0] * 5, "low": [9.0] * 5,
         "close": [11.0, 12, 13, 14, 20], "volume": [100.0] * 5},
        index=idx,
    )
    w = ind.to_weekly(df)
    assert len(w) == 1
    assert w["open"].iloc[0] == 10.0      # 週の最初
    assert w["close"].iloc[0] == 20.0     # 週の最後
    assert w["volume"].iloc[0] == 500.0   # 合計


# ------------------------------------------------------------------ compute 全体


def test_compute_flat_series_does_not_crash(cfg):
    """🔴 ATR=0・値動きゼロでも落ちない（0除算の境界・SPEC 9.2）。"""
    df = make_df([100.0] * 200, highs=[100.0] * 200, lows=[100.0] * 200, opens=[100.0] * 200)
    out = ind.compute(df, cfg, "FLAT")
    assert out.latest["atr"] == pytest.approx(0.0)
    assert out.latest["atr_pct"] == pytest.approx(0.0)
    assert out.latest["breakout_volume"] == "none"
    assert out.latest["rsi"] == pytest.approx(50.0)


def test_compute_uptrend_is_detected(cfg):
    closes = [100.0 + i * 0.5 for i in range(250)]
    out = ind.compute(make_df(closes), cfg, "UP")
    assert out.latest["sma25_slope_pct_per_day"] > 0
    assert out.latest["weekly_trend"] == "up"
    assert out.latest["close"] > out.latest["sma25"] > out.latest["sma75"]


def test_compute_latest_has_no_nan_leaking_as_number(cfg):
    """NaN は None にして下流へ。float('nan') を JSON に流さない。"""
    out = ind.compute(make_df([100.0 + i for i in range(30)]), cfg, "SHORT")
    for key, value in out.latest.items():
        if isinstance(value, float):
            assert not np.isnan(value), f"{key} が NaN のまま"
