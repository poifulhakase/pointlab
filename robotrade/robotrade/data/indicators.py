"""指標の一元計算（SPEC 5.1）。

🔴 **単一情報源**。チャート分析AI（7.2）にも 予測MLモデル（8.2）にも、
   数値プレフィルタ（6章）にも、ここで計算した**同じ値**を渡す。
   定義を二箇所に持たない（片方だけ直す事故を防ぐ）。

🔴 pandas-ta は使わない（numpy 2.x で壊れている）。必要な指標だけ自前で持つ。
   指標は「測る軸ごとに1つ」。同じことを言う指標を並べない（SPEC 5.1 簡素化の原則）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

# ---------------------------------------------------------------- 基本部品


def sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window, min_periods=window).mean()


def true_range(df: pd.DataFrame) -> pd.Series:
    """TR = max(高値-安値, |高値-前日終値|, |安値-前日終値|)"""
    prev_close = df["close"].shift(1)
    return pd.concat(
        [
            df["high"] - df["low"],
            (df["high"] - prev_close).abs(),
            (df["low"] - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)


def atr(df: pd.DataFrame, window: int = 14) -> pd.Series:
    """ATR。Wilder の平滑化（ewm alpha=1/window）を使う。"""
    tr = true_range(df)
    return tr.ewm(alpha=1.0 / window, adjust=False, min_periods=window).mean()


def rsi(series: pd.Series, window: int = 14) -> pd.Series:
    """RSI(Wilder)。

    🔴 0除算対策：下げが一度も無い期間は avg_loss=0 になる。RSI=100 に倒す。
       上げも下げも無い（完全に動かない）ときは 50（中立）。クラッシュさせない。
    """
    delta = series.diff()
    gain = delta.clip(lower=0.0)
    loss = (-delta).clip(lower=0.0)
    avg_gain = gain.ewm(alpha=1.0 / window, adjust=False, min_periods=window).mean()
    avg_loss = loss.ewm(alpha=1.0 / window, adjust=False, min_periods=window).mean()

    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    out = 100.0 - (100.0 / (1.0 + rs))
    flat = (avg_gain == 0.0) & (avg_loss == 0.0)
    out = out.mask((avg_loss == 0.0) & (avg_gain > 0.0), 100.0)
    out = out.mask(flat, 50.0)
    return out


def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    ema_fast = series.ewm(span=fast, adjust=False, min_periods=fast).mean()
    ema_slow = series.ewm(span=slow, adjust=False, min_periods=slow).mean()
    line = ema_fast - ema_slow
    sig = line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    return pd.DataFrame({"macd": line, "macd_signal": sig, "macd_hist": line - sig})


def bollinger(series: pd.Series, window: int = 20, sigma: float = 2.0) -> pd.DataFrame:
    """ボリンジャーバンド。%B とバンド幅（スクイーズ検知）を返す。

    🔴 0除算対策：値動きが無いと std=0 → バンド幅0 → %B が 0/0。NaN のまま返す
       （「計算できなかった」を None として下流に伝える。0 で埋めると嘘になる）。
    """
    mid = series.rolling(window, min_periods=window).mean()
    std = series.rolling(window, min_periods=window).std(ddof=0)
    upper = mid + sigma * std
    lower = mid - sigma * std
    width = (upper - lower) / mid.replace(0.0, np.nan)
    pct_b = (series - lower) / (upper - lower).replace(0.0, np.nan)
    return pd.DataFrame(
        {"bb_mid": mid, "bb_upper": upper, "bb_lower": lower, "bb_width": width, "bb_pct_b": pct_b}
    )


def slope_pct(series: pd.Series, window: int) -> pd.Series:
    """N日前と比べた変化率を「1日あたり%」に直す。SMA25の傾き＝トレンドの強さ。"""
    past = series.shift(window)
    return ((series - past) / past.abs().replace(0.0, np.nan)) / window * 100.0


# ---------------------------------------------------------------- 価格構造


def swing_points(df: pd.DataFrame, lookback: int, fractal: int = 2) -> dict[str, Any]:
    """直近スイングの高値/安値とサポート/レジスタンス（SPEC 5.1 最重要）。

    fractal=2 ＝「前後2本より高い（安い）足」をスイング点とみなす素朴な定義。
    サポート＝現値**より下**で最も近いスイング安値、レジスタンス＝**より上**の高値。
    サポレジの質（何度試されたか）も返す（試行回数が多いほど強い）。
    """
    empty = {
        "swing_high": None, "swing_low": None, "support": None, "resistance": None,
        "support_touches": 0, "resistance_touches": 0,
    }
    window = df.tail(lookback)
    if len(window) < fractal * 2 + 1:
        return empty

    highs = window["high"].to_numpy(dtype=float)
    lows = window["low"].to_numpy(dtype=float)
    n = len(window)
    swing_highs: list[float] = []
    swing_lows: list[float] = []
    for i in range(fractal, n - fractal):
        seg_h = highs[i - fractal: i + fractal + 1]
        seg_l = lows[i - fractal: i + fractal + 1]
        if int(seg_h.argmax()) == fractal:
            swing_highs.append(float(highs[i]))
        if int(seg_l.argmin()) == fractal:
            swing_lows.append(float(lows[i]))

    close = float(window["close"].iloc[-1])
    below = [p for p in swing_lows if p < close]
    above = [p for p in swing_highs if p > close]
    support = max(below) if below else float(window["low"].min())
    resistance = min(above) if above else float(window["high"].max())

    def touches(level: float | None, series: pd.Series) -> int:
        """水平線が何度試されたか。1%以内に寄った足を数える。"""
        if not level:
            return 0
        return int((series.sub(level).abs() / level < 0.01).sum())

    return {
        "swing_high": float(max(swing_highs)) if swing_highs else float(window["high"].max()),
        "swing_low": float(min(swing_lows)) if swing_lows else float(window["low"].min()),
        "support": support,
        "resistance": resistance,
        "support_touches": touches(support, window["low"]),
        "resistance_touches": touches(resistance, window["high"]),
    }


def candle_pattern(df: pd.DataFrame) -> str:
    """直近1本の主要ローソク足パターン（SPEC 5.1）。

    包み足・はらみ・下ヒゲ/上ヒゲ・十字線。複数該当したら優先度順に1つ返す。
    """
    if len(df) < 2:
        return "none"
    cur, prev = df.iloc[-1], df.iloc[-2]
    o, h, low, c = float(cur["open"]), float(cur["high"]), float(cur["low"]), float(cur["close"])
    po, pc = float(prev["open"]), float(prev["close"])
    rng = h - low
    if rng <= 0:
        return "none"  # ストップ高/安などで値幅ゼロ

    body = abs(c - o)
    upper_wick = h - max(o, c)
    lower_wick = min(o, c) - low
    prev_top, prev_bot = max(po, pc), min(po, pc)
    cur_top, cur_bot = max(o, c), min(o, c)

    if body / rng < 0.1:
        return "doji（十字線・迷い）"
    if cur_top >= prev_top and cur_bot <= prev_bot and body > abs(pc - po):
        return "bullish_engulfing（陽の包み足）" if c > o else "bearish_engulfing（陰の包み足）"
    if cur_top <= prev_top and cur_bot >= prev_bot:
        return "harami（はらみ・勢い減）"
    if lower_wick > body * 2 and upper_wick < body:
        return "hammer（下ヒゲ・売り吸収）"
    if upper_wick > body * 2 and lower_wick < body:
        return "shooting_star（上ヒゲ・買い失速）"
    if body / rng > 0.7:
        return "marubozu_bull（大陽線）" if c > o else "marubozu_bear（大陰線）"
    return "none"


def to_weekly(df: pd.DataFrame) -> pd.DataFrame:
    """日足 → 週足（金曜終い）。上位足の文脈に使う（SPEC 5.1）。"""
    agg = {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
    return df.resample("W-FRI").agg(agg).dropna(how="any")


# ---------------------------------------------------------------- まとめ


@dataclass
class Indicators:
    """1銘柄ぶんの指標。`latest` が判断に使う確定値、`frame` が系列。"""

    ticker: str
    frame: pd.DataFrame
    weekly: pd.DataFrame
    latest: dict[str, Any] = field(default_factory=dict)

    @property
    def asof(self) -> pd.Timestamp:
        return self.frame.index[-1]

    def series_text(self, days: int = 20) -> str:
        """チャート分析AIに渡す系列テキスト（SPEC 7.2 (A) 数値方式）。"""
        cols = ["open", "high", "low", "close", "volume", "sma5", "sma25", "sma75",
                "rsi", "macd_hist", "bb_pct_b", "atr_pct", "rel_volume"]
        use = [c for c in cols if c in self.frame.columns]
        return self.frame[use].tail(days).round(3).to_csv(index_label="date")

    def weekly_text(self, weeks: int = 12) -> str:
        cols = [c for c in ("open", "high", "low", "close", "w_sma13") if c in self.weekly.columns]
        return self.weekly[cols].tail(weeks).round(3).to_csv(index_label="week")


def compute(df: pd.DataFrame, cfg, ticker: str = "") -> Indicators:
    """日足（open/high/low/close/volume・index=DatetimeIndex）から全指標を計算する。

    🔴 ここが唯一の計算場所。他所で同じ指標を再定義しないこと。
    """
    ind_cfg = cfg.get("indicators")
    out = df.copy()

    for w in ind_cfg["sma"]:
        out[f"sma{w}"] = sma(out["close"], w)

    disp_sma = ind_cfg["disparity_sma"]
    base = out[f"sma{disp_sma}"]
    out["sma25_slope"] = slope_pct(base, ind_cfg["slope_window"])
    out["disparity"] = (out["close"] - base) / base.replace(0.0, np.nan) * 100.0

    out["atr"] = atr(out, ind_cfg["atr"])
    out["atr_pct"] = out["atr"] / out["close"].replace(0.0, np.nan)

    out["vol_ma"] = out["volume"].rolling(20, min_periods=20).mean()
    out["rel_volume"] = out["volume"] / out["vol_ma"].replace(0.0, np.nan)
    out["turnover"] = out["close"] * out["volume"]
    out["turnover_ma"] = out["turnover"].rolling(20, min_periods=20).mean()

    out["rsi"] = rsi(out["close"], ind_cfg["rsi"])
    fast, slow, sig = ind_cfg["macd"]
    out = out.join(macd(out["close"], fast, slow, sig))
    out = out.join(bollinger(out["close"], ind_cfg["bb_period"], float(ind_cfg["bb_sigma"])))

    weekly = to_weekly(out[["open", "high", "low", "close", "volume"]])
    if len(weekly) >= 13:
        weekly["w_sma13"] = sma(weekly["close"], 13)
        weekly["w_slope"] = slope_pct(weekly["w_sma13"], 4)
    else:
        weekly["w_sma13"] = np.nan
        weekly["w_slope"] = np.nan

    last = out.iloc[-1]
    structure = swing_points(out, ind_cfg["swing_lookback"])
    close = float(last["close"])

    # ブレイク確認（SPEC 5.1）: レジスタンス超え＋出来高を伴うか＝本物/騙し
    resistance = structure["resistance"]
    vol_ratio = None if pd.isna(last["rel_volume"]) else float(last["rel_volume"])
    if not (resistance and close > resistance):
        breakout = "none"
    elif vol_ratio is not None and vol_ratio >= ind_cfg["breakout_vol_ratio"]:
        breakout = "confirmed"
    else:
        breakout = "weak"

    # 週足トレンド（上位足の文脈）
    weekly_trend = "range"
    weekly_slope = None
    if len(weekly) and pd.notna(weekly["w_sma13"].iloc[-1]):
        w_close = float(weekly["close"].iloc[-1])
        w_ma = float(weekly["w_sma13"].iloc[-1])
        weekly_slope = None if pd.isna(weekly["w_slope"].iloc[-1]) else float(weekly["w_slope"].iloc[-1])
        s = weekly_slope or 0.0
        if w_close > w_ma and s > 0.05:
            weekly_trend = "up"
        elif w_close < w_ma and s < -0.05:
            weekly_trend = "down"

    def f(key: str) -> float | None:
        v = last.get(key)
        return None if v is None or pd.isna(v) else float(v)

    latest: dict[str, Any] = {
        "ticker": ticker,
        "date": out.index[-1].strftime("%Y-%m-%d"),
        "close": close,
        "open": float(last["open"]),
        "high": float(last["high"]),
        "low": float(last["low"]),
        "volume": float(last["volume"]),
        "sma5": f("sma5"), "sma25": f("sma25"), "sma75": f("sma75"),
        "sma25_slope_pct_per_day": f("sma25_slope"),
        "disparity_pct": f("disparity"),
        "atr": f("atr"), "atr_pct": f("atr_pct"),
        "rel_volume": f("rel_volume"),
        "turnover_ma": f("turnover_ma"),
        "rsi": f("rsi"),
        "macd_hist": f("macd_hist"),
        "bb_pct_b": f("bb_pct_b"), "bb_width": f("bb_width"),
        "weekly_trend": weekly_trend,
        "weekly_slope_pct_per_week": weekly_slope,
        "candle_pattern": candle_pattern(out),
        "breakout_volume": breakout,
        "bars": int(len(out)),
    }
    latest.update(structure)

    # 直近高安・サポレジからの距離（MLの特徴量にもそのまま使う）
    for key, level, sign in (
        ("dist_to_swing_high_pct", structure["swing_high"], 1),
        ("dist_to_resistance_pct", structure["resistance"], 1),
        ("dist_to_swing_low_pct", structure["swing_low"], -1),
        ("dist_to_support_pct", structure["support"], -1),
    ):
        latest[key] = None if not level else (level - close) / close * 100.0 * sign

    return Indicators(ticker=ticker, frame=out, weekly=weekly, latest=latest)
