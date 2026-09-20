"""数値プレフィルタ（SPEC 6章・コード側・LLMなし）。

**このマシンの土台**。数千銘柄 → 十数件に機械的に絞る。
ここが甘いと、下流でどれだけ賢いAIを積んでも「見る価値のない銘柄」を分析させることになる。
役割は「良い銘柄を選ぶ」ことより前に「**向かない銘柄・地雷をふるい落とす**」こと。

3層構成:
  第1層 足切り        … ハードフィルタ（満たさなければ即除外）
  第2層 スイング適性  … スコアリング（点数化して上位N件）
  第3層 除外フィルタ  … ハードフィルタ（地雷）

🔴 第2層を二値にしない。二値だと候補がゼロや過多になって不安定になる（SPEC 6）。
🔴 閾値はすべて config。相場つきで最適値が変わるので、コード埋め込みだと調整できない。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from .indicators import Indicators
from .poirobo import Stock

log = logging.getLogger(__name__)


@dataclass
class Candidate:
    """1銘柄のプレフィルタ結果。落ちた銘柄も理由つきで残す（あとで検証するため）。"""

    stock: Stock
    indicators: Indicators
    passed_layer1: bool = False
    passed_layer3: bool = False
    score: float = 0.0
    score_parts: dict[str, float] = field(default_factory=dict)
    reasons: list[str] = field(default_factory=list)
    rejected_by: str | None = None

    @property
    def ticker(self) -> str:
        return self.stock.ticker

    @property
    def selected(self) -> bool:
        return self.passed_layer1 and self.passed_layer3 and self.rejected_by is None

    def profile(self, cfg) -> dict[str, Any]:
        """銘柄プロファイル（SPEC 5.3）。エージェントの共通の下敷きになる。"""
        close = float(self.indicators.latest["close"])
        low = float(cfg.get("profile.price_class_low"))
        high = float(cfg.get("profile.price_class_high"))
        price_class = "low" if close < low else ("high" if close >= high else "mid")
        return {
            "ticker": self.ticker,
            "name": self.stock.name,
            "sector": self.stock.sector,
            "fx_sensitivity": self.stock.fx_sensitivity,
            "price_class": price_class,
        }

    def summary(self, cfg) -> dict[str, Any]:
        """ログ・選定AIに渡す要約。"""
        latest = self.indicators.latest
        return {
            **self.profile(cfg),
            "close": round(latest["close"], 1),
            "score": round(self.score, 3),
            "score_parts": {k: round(v, 3) for k, v in self.score_parts.items()},
            "atr_pct": _round(latest.get("atr_pct"), 4),
            "rel_volume": _round(latest.get("rel_volume"), 2),
            "turnover_ma_oku": _round((latest.get("turnover_ma") or 0) / 1e8, 1),
            "sma25_slope_pct_per_day": _round(latest.get("sma25_slope_pct_per_day"), 3),
            "disparity_pct": _round(latest.get("disparity_pct"), 2),
            "weekly_trend": latest.get("weekly_trend"),
            "rsi": _round(latest.get("rsi"), 1),
            "bb_width": _round(latest.get("bb_width"), 4),
            "candle_pattern": latest.get("candle_pattern"),
            "breakout_volume": latest.get("breakout_volume"),
            "dist_to_resistance_pct": _round(latest.get("dist_to_resistance_pct"), 2),
            "dist_to_support_pct": _round(latest.get("dist_to_support_pct"), 2),
            "reasons": self.reasons,
        }


# ---------------------------------------------------------------- 第1層


def layer1(candidate: Candidate, cfg) -> bool:
    """足切り（土俵に上げる最低条件）。1つでも外れたら即除外。"""
    latest = candidate.indicators.latest
    close = float(latest["close"])
    turnover = latest.get("turnover_ma")
    lot = int(cfg.get("exec.lot_size"))

    # 流動性（**ここが最重要**）。薄い板だと想定値で約定できずスリッページも大きい。
    min_turnover = float(cfg.get("screen.min_turnover"))
    if turnover is None:
        candidate.rejected_by = "L1:売買代金が計算できない"
        return False
    if turnover < min_turnover:
        candidate.rejected_by = f"L1:売買代金 {turnover/1e8:.1f}億 < {min_turnover/1e8:.1f}億"
        return False

    # 価格帯・単元
    if close < float(cfg.get("screen.min_price")):
        candidate.rejected_by = f"L1:株価 {close:.0f}円 < {cfg.get('screen.min_price')}円"
        return False
    unit_cost = close * lot
    if unit_cost > float(cfg.get("screen.max_unit_cost")):
        candidate.rejected_by = f"L1:1単元 {unit_cost:,.0f}円 > 上限"
        return False

    # 低位株・ボロ株は基本除外（流動性が薄い・急落・上場廃止の事故リスク）
    if cfg.get("screen.penny_stock_policy") == "exclude":
        if close < float(cfg.get("profile.price_class_low")):
            candidate.rejected_by = f"L1:低位株（{close:.0f}円）"
            return False

    candidate.passed_layer1 = True
    return True


# ---------------------------------------------------------------- 第2層


def _triangle(value: float, low: float, high: float) -> float:
    """レンジの真ん中で1.0、両端で0.0になる山形スコア。上下限の両方を効かせる。"""
    if value is None or high <= low:
        return 0.0
    if value <= low or value >= high:
        return 0.0
    mid = (low + high) / 2.0
    half = (high - low) / 2.0
    return max(0.0, 1.0 - abs(value - mid) / half)


def layer2(candidate: Candidate, cfg) -> float:
    """スイング適性のスコアリング。0〜1 に正規化した部品を重み付きで合算する。"""
    latest = candidate.indicators.latest
    w = cfg.get("screen.weights")
    parts: dict[str, float] = {}

    # ボラティリティ: 低すぎると2〜14日で利幅が取れず、高すぎると振り回される
    parts["atr_fit"] = _triangle(
        latest.get("atr_pct"), float(cfg.get("screen.atr_min")), float(cfg.get("screen.atr_max"))
    )

    # 出来高の変化: 注目が集まり始めた兆候
    rel = latest.get("rel_volume")
    spike = float(cfg.get("screen.vol_spike_ratio"))
    parts["vol_spike"] = 0.0 if rel is None else min(1.0, max(0.0, (rel - 1.0) / (spike - 1.0)))

    # トレンド/位置: 上向きの並びで、かつ伸び切っていない（乖離が大きすぎない）
    trend = 0.0
    sma5, sma25, sma75 = latest.get("sma5"), latest.get("sma25"), latest.get("sma75")
    close = latest["close"]
    if None not in (sma5, sma25, sma75):
        if close > sma5 > sma25 > sma75:
            trend = 1.0
        elif close > sma25 > sma75:
            trend = 0.8
        elif close > sma25:
            trend = 0.5
        elif close > sma75:
            trend = 0.3
    disparity = latest.get("disparity_pct")
    if disparity is not None and abs(disparity) > 15:
        trend *= 0.5  # 行き過ぎは掴まない
    if latest.get("weekly_trend") == "up":
        trend = min(1.0, trend * 1.2)   # 上位足に沿う形を優遇
    elif latest.get("weekly_trend") == "down":
        trend *= 0.4                     # 買いオンリーなので週足下降は不利
    parts["trend"] = trend

    # 地合いの明確さ（曖昧な銘柄を上位に残さない・SPEC 6）
    # 傾きがほぼゼロ／バンド幅が中途半端／動意がない銘柄を低スコアにする。
    slope = abs(latest.get("sma25_slope_pct_per_day") or 0.0)
    slope_score = min(1.0, slope / 0.3)       # 0.3%/日 で満点
    width = latest.get("bb_width")
    if width is None:
        width_score = 0.0
    else:
        # スクイーズ（狭い＝これから動く）か拡大（広い＝動いている）が明確なら加点。
        # 中途半端な幅＝どっちつかずを減点する。
        width_score = abs(width - 0.08) / 0.08
        width_score = min(1.0, width_score)
    parts["clarity"] = (slope_score * 0.6) + (width_score * 0.4)

    score = sum(parts[k] * float(w.get(k, 1.0)) for k in parts)
    candidate.score_parts = parts
    candidate.score = score
    return score


# ---------------------------------------------------------------- 第3層


def layer3(candidate: Candidate, cfg, *, event_days: int = 0,
           earnings_days: int | None = None) -> bool:
    """除外フィルタ（地雷を踏まない）。

    `earnings_days` = 決算発表予定日まであと何日か（取れていなければ None）。
    """
    frame = candidate.indicators.frame
    days = int(cfg.get("screen.recent_move_days"))
    limit = float(cfg.get("screen.recent_move_pct"))

    # 直近の窓・急騰急落: すでに動き切った後を掴まない
    if len(frame) > days:
        past = float(frame["close"].iloc[-1 - days])
        now = float(frame["close"].iloc[-1])
        move = abs(now - past) / past if past else 0.0
        if move > limit:
            candidate.rejected_by = f"L3:直近{days}日で{move*100:.0f}%動いた（動き切った後）"
            return False

    # 異常値フラグ（調整済みなのに1日±50%＝分割の取りこぼし疑い）
    outliers = getattr(candidate, "_outliers", None)
    if outliers:
        candidate.reasons.append(f"異常値フラグ: {outliers}")

    # 決算直前: 発表をまたぐと数値分析の外側で窓を開ける（2026-09-20 に判定を導入）
    # 🔴 **近すぎるものだけ落とす**。保有期間（最大14日）内の決算を全部落とすと
    #    決算シーズンに候補が全滅する。少し先のものは売買判断AIに渡して重みを判断させる。
    earnings_within = int(cfg.get("screen.exclude_earnings_within_days"))
    if earnings_days is not None:
        if 0 <= earnings_days <= earnings_within:
            candidate.rejected_by = f"L3:{earnings_days}日後に決算発表（またぎを避ける）"
            return False
        candidate.reasons.append(f"{earnings_days}日後に決算発表")

    # イベント直前: 市場全体のマクロイベント（FOMC・日銀・SQ 等）
    exclude_within = int(cfg.get("screen.exclude_event_within_days"))
    if event_days and 0 < event_days <= exclude_within:
        candidate.reasons.append(f"{event_days}日後に高インパクトの経済イベント")

    candidate.passed_layer3 = True
    return True


# ---------------------------------------------------------------- まとめ


@dataclass
class PrefilterResult:
    selected: list[Candidate]
    all_candidates: list[Candidate]
    funnel: dict[str, int]

    def funnel_text(self) -> str:
        return " → ".join(f"{k}:{v}" for k, v in self.funnel.items())


def run(
    stocks_with_indicators: list[tuple[Stock, Indicators]],
    cfg,
    *,
    event_days: int = 0,
    earnings_days: dict[str, int] | None = None,
) -> PrefilterResult:
    """プレフィルタ本体。

    🔴 ファネル計測（SPEC 9.1）: 各ゲートで何件落ちたかを必ず数える。
       見送りゲートが AND で重なると候補がほぼ全滅し、約定が貯まらず学習も評価もできなくなる。
    """
    candidates = [Candidate(stock=s, indicators=i) for s, i in stocks_with_indicators]
    funnel: dict[str, int] = {"入力": len(candidates)}

    alive = [c for c in candidates if layer1(c, cfg)]
    funnel["第1層通過"] = len(alive)

    for c in alive:
        layer2(c, cfg)
    alive.sort(key=lambda c: c.score, reverse=True)

    top_n = int(cfg.get("screen.top_n"))
    ranked = alive[:top_n]
    for c in alive[top_n:]:
        c.rejected_by = f"L2:スコア {c.score:.2f} が上位{top_n}位圏外"
    funnel[f"第2層上位{top_n}"] = len(ranked)

    earnings_days = earnings_days or {}
    selected = [c for c in ranked
                if layer3(c, cfg, event_days=event_days,
                          earnings_days=earnings_days.get(c.ticker))]
    funnel["第3層通過"] = len(selected)

    if not selected:
        log.warning(
            "プレフィルタで候補が0件になった。ファネル: %s（閾値が厳しすぎないか見る）",
            " → ".join(f"{k}:{v}" for k, v in funnel.items()),
        )

    return PrefilterResult(selected=selected, all_candidates=candidates, funnel=funnel)


def _round(value: Any, digits: int) -> Any:
    return None if value is None else round(float(value), digits)
