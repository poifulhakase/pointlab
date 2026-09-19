"""Phase 0: EDA（探索的データ分析）— まず作らずに眺める（SPEC 14-0）。

何かを組む前に実データの素性を掴む。ここで「データの現実」を知ってから
設計値（閾値・特徴量）を詰めると手戻りが激減する。

見るもの:
  1. クレンジングの実態 … 何がどれだけ落ちるか（SPEC 5.6）
  2. リターン分布の形   … 正規でない・ファットテール（SPEC 14-0）
  3. 指標間の相関       … 「独立した確認」に見えて実は1つ、を見つける（SPEC 8.3）
  4. プレフィルタの通り … 各層で何件残るか＝閾値が厳しすぎ/緩すぎないか（SPEC 9.1）

使い方:
    .venv/Scripts/python.exe eda/run_eda.py --limit 500
    .venv/Scripts/python.exe eda/run_eda.py            # 全銘柄
"""

from __future__ import annotations

import argparse
import json
import logging
import random
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from swinglab import config as config_mod  # noqa: E402
from swinglab.data import fetch as fetch_mod  # noqa: E402
from swinglab.data import indicators as ind_mod  # noqa: E402
from swinglab.data import prefilter as prefilter_mod  # noqa: E402
from swinglab.data.poirobo import PoiroboData  # noqa: E402

log = logging.getLogger("eda")


def describe_returns(frames: dict[str, pd.DataFrame]) -> dict:
    """リターン分布の形。正規分布を仮定していいのかを確かめる。"""
    rets = []
    for frame in frames.values():
        r = frame["close"].pct_change().dropna()
        rets.append(r)
    all_rets = pd.concat(rets) if rets else pd.Series(dtype=float)
    if all_rets.empty:
        return {}

    std = float(all_rets.std())
    mean = float(all_rets.mean())
    # 正規分布なら ±3σ 超えは 0.27%、±5σ は 0.00006%。実データはこれを大きく上回る。
    beyond_3s = float((all_rets.abs() > mean + 3 * std).mean())
    beyond_5s = float((all_rets.abs() > mean + 5 * std).mean())
    return {
        "件数": int(len(all_rets)),
        "平均%": round(mean * 100, 4),
        "標準偏差%": round(std * 100, 3),
        "歪度": round(float(all_rets.skew()), 3),
        "尖度（正規=0）": round(float(all_rets.kurtosis()), 2),
        "±3σ超の割合%": round(beyond_3s * 100, 3),
        "正規分布なら%": 0.270,
        "±5σ超の割合%": round(beyond_5s * 100, 4),
        "正規分布なら(5σ)%": 0.00006,
        "最大上昇%": round(float(all_rets.max()) * 100, 1),
        "最大下落%": round(float(all_rets.min()) * 100, 1),
    }


def describe_correlation(rows: list[dict]) -> pd.DataFrame:
    """指標間の相関。**同じことを言う指標**を炙り出す（SPEC 8.3 見かけの独立性）。"""
    cols = [
        "sma25_slope_pct_per_day", "disparity_pct", "atr_pct", "rel_volume",
        "rsi", "macd_hist", "bb_pct_b", "bb_width",
        "dist_to_resistance_pct", "dist_to_support_pct",
    ]
    df = pd.DataFrame(rows)[cols].astype(float)
    return df.corr().round(2)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="銘柄数の上限（0=全件）")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--no-cache", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stdout)
    cfg, warnings = config_mod.load()
    for w in warnings:
        log.warning("config 警告: %s", w)

    poirobo = PoiroboData(cfg)
    for w in poirobo.check_freshness():
        log.warning("鮮度: %s", w)

    universe = poirobo.universe()
    if args.limit:
        random.Random(args.seed).shuffle(universe)
        universe = universe[: args.limit]
    log.info("=== 対象 %d 銘柄 ===", len(universe))

    started = time.time()
    fetcher = fetch_mod.PriceFetcher(cfg)
    frames = fetcher.fetch([s.ticker for s in universe], use_cache=not args.no_cache)
    log.info("取得 %.0f秒 / %d銘柄が生き残り", time.time() - started, len(frames))

    # 1. クレンジングの実態
    log.info("\n=== 1. クレンジング（SPEC 5.6）===")
    rejects = fetch_mod.reject_summary(fetcher.reports)
    log.info("対象外になった理由:")
    for reason, count in sorted(rejects.items(), key=lambda kv: -kv[1]):
        log.info("  %-28s %d銘柄", reason, count)
    dropped_nan = sum(r.dropped_nan for r in fetcher.reports.values())
    dropped_zero = sum(r.dropped_zero_volume for r in fetcher.reports.values())
    dropped_broken = sum(r.dropped_ohlc_broken for r in fetcher.reports.values())
    outlier_stocks = [t for t, r in fetcher.reports.items() if r.flagged_outliers]
    log.info("落とした行: 欠損%d / 出来高0=%d / OHLC破れ=%d", dropped_nan, dropped_zero, dropped_broken)
    log.info("1日±50%%超の異常値フラグ: %d銘柄（分割の取りこぼし疑い or ストップ高連続）",
             len(outlier_stocks))
    if outlier_stocks[:5]:
        log.info("  例: %s", outlier_stocks[:5])

    # 2. リターン分布
    log.info("\n=== 2. リターン分布（SPEC 14-0 ファットテール）===")
    stats = describe_returns(frames)
    for k, v in stats.items():
        log.info("  %-20s %s", k, v)

    # 3. 指標を計算して相関を見る
    log.info("\n=== 3. 指標の計算と相関（SPEC 8.3 見かけの独立性）===")
    by_ticker = {s.ticker: s for s in universe}
    pairs = []
    latest_rows = []
    for ticker, frame in frames.items():
        try:
            indi = ind_mod.compute(frame, cfg, ticker)
        except Exception as exc:  # noqa: BLE001
            log.warning("指標計算に失敗 %s: %s", ticker, exc)
            continue
        pairs.append((by_ticker[ticker], indi))
        row = {k: v for k, v in indi.latest.items() if isinstance(v, (int, float))}
        row["ticker"] = ticker
        latest_rows.append(row)
    log.info("指標を計算できた銘柄: %d", len(pairs))

    corr = describe_correlation(latest_rows)
    log.info("\n%s", corr.to_string())
    high = [
        (a, b, corr.loc[a, b])
        for i, a in enumerate(corr.columns) for b in corr.columns[i + 1:]
        if abs(corr.loc[a, b]) >= 0.7
    ]
    if high:
        log.info("\n🔴 相関0.7以上＝実質同じことを言っている組み合わせ（間引き候補）:")
        for a, b, v in sorted(high, key=lambda x: -abs(x[2])):
            log.info("   %-30s %-30s %+.2f", a, b, v)
    else:
        log.info("\n相関0.7以上の組み合わせは無し（指標セットは非冗長）")

    # 4. プレフィルタの通り
    log.info("\n=== 4. プレフィルタのファネル（SPEC 6 / 9.1）===")
    result = prefilter_mod.run(pairs, cfg)
    for stage, count in result.funnel.items():
        log.info("  %-14s %d", stage, count)

    l1_rejects: dict[str, int] = {}
    for c in result.all_candidates:
        if c.rejected_by and c.rejected_by.startswith("L1"):
            key = c.rejected_by.split(":")[1].split(" ")[0]
            l1_rejects[key] = l1_rejects.get(key, 0) + 1
    log.info("  第1層で落ちた内訳:")
    for reason, count in sorted(l1_rejects.items(), key=lambda kv: -kv[1]):
        log.info("    %-22s %d銘柄", reason, count)

    log.info("\n  上位候補:")
    for c in result.selected[:10]:
        s = c.summary(cfg)
        log.info(
            "    %-9s %-14s score=%.2f atr%%=%.3f relvol=%.1f 代金%.0f億 週足=%s",
            s["ticker"], s["name"][:12], s["score"], s["atr_pct"] or 0,
            s["rel_volume"] or 0, s["turnover_ma_oku"] or 0, s["weekly_trend"],
        )

    out_dir = Path(__file__).resolve().parent.parent / "eda_out"
    out_dir.mkdir(exist_ok=True)
    report = {
        "対象銘柄数": len(universe),
        "取得成功": len(frames),
        "クレンジング除外": rejects,
        "リターン分布": stats,
        "相関0.7以上": [[a, b, float(v)] for a, b, v in high],
        "ファネル": result.funnel,
        "第1層除外内訳": l1_rejects,
        "上位候補": [c.summary(cfg) for c in result.selected],
    }
    out_path = out_dir / "eda_report.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    corr.to_csv(out_dir / "indicator_correlation.csv", encoding="utf-8-sig")
    log.info("\n書き出し: %s", out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
