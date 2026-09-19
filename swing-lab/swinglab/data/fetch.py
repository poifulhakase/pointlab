"""価格データの取得とクレンジング（SPEC 5.1 / 5.5 / 5.6）。

🔴 価格調整の方針を**固定**する（SPEC 5.5）
   yfinance は `auto_adjust=True` で分割・配当を調整した系列を返す。
   本プロジェクトは**常に調整済み**で統一する。未調整と混ぜると分割日に偽の急騰急落が出て、
   プレフィルタ第3層（急騰急落の除外）が誤爆する。

🔴 「プロジェクトの大半はデータクレンジング」（SPEC 5.6）
   指標計算より前にここを通す。欠損・異常値・OHLC の破れを**明示的に**扱い、
   直せないものは黙って埋めずに**対象外**にする。
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd
import yfinance as yf

log = logging.getLogger(__name__)

OHLCV = ["open", "high", "low", "close", "volume"]


@dataclass
class CleanReport:
    """クレンジングで何を落としたか。ログに残して後で効きを見る（SPEC 5.6）。"""

    ticker: str
    rows_in: int = 0
    rows_out: int = 0
    dropped_nan: int = 0
    dropped_zero_volume: int = 0
    dropped_ohlc_broken: int = 0
    flagged_outliers: list[str] = field(default_factory=list)
    reject_reason: str | None = None

    @property
    def ok(self) -> bool:
        return self.reject_reason is None

    def as_dict(self) -> dict[str, Any]:
        return {
            "ticker": self.ticker,
            "rows_in": self.rows_in,
            "rows_out": self.rows_out,
            "dropped_nan": self.dropped_nan,
            "dropped_zero_volume": self.dropped_zero_volume,
            "dropped_ohlc_broken": self.dropped_ohlc_broken,
            "flagged_outliers": self.flagged_outliers,
            "reject_reason": self.reject_reason,
        }


# ---------------------------------------------------------------- クレンジング


def clean(df: pd.DataFrame, ticker: str, *, min_bars: int, outlier_pct: float = 0.5) -> tuple[pd.DataFrame | None, CleanReport]:
    """1銘柄の日足をクレンジングする。

    直せない銘柄は `(None, report)` を返す。**推測で埋めない**（SPEC 5.6）。
    """
    report = CleanReport(ticker=ticker, rows_in=len(df) if df is not None else 0)
    if df is None or df.empty:
        report.reject_reason = "データが空"
        return None, report

    out = df.copy()
    out.columns = [str(c).lower() for c in out.columns]
    missing = [c for c in OHLCV if c not in out.columns]
    if missing:
        report.reject_reason = f"列が足りない: {missing}"
        return None, report
    out = out[OHLCV]

    # タイムゾーン・日付の正規化（JST の営業日に揃える。SPEC 5.6）
    if not isinstance(out.index, pd.DatetimeIndex):
        out.index = pd.to_datetime(out.index)
    if out.index.tz is not None:
        out.index = out.index.tz_convert("Asia/Tokyo").tz_localize(None)
    out.index = out.index.normalize()
    out = out[~out.index.duplicated(keep="last")].sort_index()

    for col in OHLCV:
        out[col] = pd.to_numeric(out[col], errors="coerce")

    # 欠損（上場前・休場・データ欠落）は落とす。前方補完で作らない。
    before = len(out)
    out = out.dropna(subset=OHLCV)
    report.dropped_nan = before - len(out)

    # 出来高0の日 ＝ 実質的に売買が無い（yfinance が休場を混ぜることもある）。
    # 残すと出来高移動平均・相対出来高が歪むので落とす。
    before = len(out)
    out = out[out["volume"] > 0]
    report.dropped_zero_volume = before - len(out)

    # OHLC の健全性: low <= open,close <= high が破れていないか（SPEC 5.6 一貫性チェック）
    before = len(out)
    sane = (
        (out["low"] <= out["high"])
        & (out["low"] <= out["open"]) & (out["open"] <= out["high"])
        & (out["low"] <= out["close"]) & (out["close"] <= out["high"])
        & (out[["open", "high", "low", "close"]] > 0).all(axis=1)
    )
    out = out[sane]
    report.dropped_ohlc_broken = before - len(out)

    if len(out) < min_bars:
        report.rows_out = len(out)
        report.reject_reason = f"足が{len(out)}本しかない（必要 {min_bars}本）"
        return None, report

    # 異常値の**検出**（落とさずフラグ）。調整済みなのに1日で±50%動くのは
    # 分割の取りこぼしか誤ったデータの疑い。ストップ高の連続など本物の場合もあるので
    # 判断は下流に渡す（SPEC 5.6）。
    ret = out["close"].pct_change()
    spikes = ret[ret.abs() > outlier_pct]
    report.flagged_outliers = [d.strftime("%Y-%m-%d") for d in spikes.index]

    report.rows_out = len(out)
    return out, report


# ---------------------------------------------------------------- 取得


class PriceFetcher:
    """yfinance から日足を取り、クレンジングしてキャッシュする。

    キャッシュは 1ファイル（parquet・long形式）。銘柄ごとに数千ファイルを作らない。
    """

    def __init__(self, cfg):
        self.cfg = cfg
        self.cache_dir: Path = cfg.path("ops.cache_dir")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_path = self.cache_dir / "prices.parquet"
        self.ttl_hours = float(cfg.get("ops.cache_ttl_hours", 6))
        self.history_days = int(cfg.get("indicators.history_days"))
        self.min_bars = int(cfg.get("indicators.min_bars"))
        self.reports: dict[str, CleanReport] = {}

    # -------------------------------------------------- キャッシュ

    def _cache_is_fresh(self) -> bool:
        if not self.cache_path.exists():
            return False
        age = datetime.now() - datetime.fromtimestamp(self.cache_path.stat().st_mtime)
        return age < timedelta(hours=self.ttl_hours)

    def _read_cache(self) -> dict[str, pd.DataFrame]:
        if not self.cache_path.exists():
            return {}
        long = pd.read_parquet(self.cache_path)
        out: dict[str, pd.DataFrame] = {}
        for ticker, group in long.groupby("ticker", sort=False):
            frame = group.drop(columns=["ticker"]).set_index("date").sort_index()
            out[str(ticker)] = frame
        return out

    def _write_cache(self, frames: dict[str, pd.DataFrame]) -> None:
        if not frames:
            return
        parts = []
        for ticker, frame in frames.items():
            part = frame.reset_index()
            part.columns = ["date"] + list(frame.columns)
            part.insert(0, "ticker", ticker)
            parts.append(part)
        pd.concat(parts, ignore_index=True).to_parquet(self.cache_path, index=False)

    # -------------------------------------------------- 本体

    def fetch(
        self,
        tickers: Iterable[str],
        *,
        use_cache: bool = True,
        batch_size: int = 150,
        pause: float = 0.5,
        progress_every: int = 5,
    ) -> dict[str, pd.DataFrame]:
        """日足を取ってクレンジングして返す。クレンジングで落ちた銘柄は含まれない。"""
        tickers = list(dict.fromkeys(tickers))  # 重複排除・順序維持
        if use_cache and self._cache_is_fresh():
            cached = self._read_cache()
            hit = [t for t in tickers if t in cached]
            if len(hit) >= len(tickers) * 0.9:
                log.info("価格キャッシュを使用: %d/%d 銘柄", len(hit), len(tickers))
                return {t: cached[t] for t in hit}

        period = f"{max(self.history_days, 200)}d"
        frames: dict[str, pd.DataFrame] = {}
        batches = [tickers[i: i + batch_size] for i in range(0, len(tickers), batch_size)]
        started = time.time()

        for i, batch in enumerate(batches, 1):
            raw = self._download(batch, period)
            for ticker in batch:
                frame = self._extract(raw, ticker, single=len(batch) == 1)
                cleaned, report = clean(frame, ticker, min_bars=self.min_bars)
                self.reports[ticker] = report
                if cleaned is not None:
                    frames[ticker] = cleaned
            if i % progress_every == 0 or i == len(batches):
                log.info(
                    "価格取得 %d/%d バッチ（%d銘柄 採用 / %.0f秒）",
                    i, len(batches), len(frames), time.time() - started,
                )
            if pause and i < len(batches):
                time.sleep(pause)

        self._write_cache(frames)
        return frames

    @staticmethod
    def _download(batch: list[str], period: str) -> pd.DataFrame | None:
        """🔴 ネットワーク失敗でパイプライン全体を止めない（SPEC 7.6/9.1）。

        1バッチ落ちてもそのバッチだけ空にして進む。落ちたことはログに残す。
        """
        for attempt in range(3):
            try:
                return yf.download(
                    tickers=batch, period=period, interval="1d",
                    group_by="ticker", auto_adjust=True, threads=True,
                    progress=False, timeout=30,
                )
            except Exception as exc:  # noqa: BLE001 - yfinance は多様な例外を投げる
                log.warning("価格取得に失敗（%d回目）: %s", attempt + 1, exc)
                time.sleep(2 ** attempt)
        log.error("価格取得を諦めた: %s ...", batch[:3])
        return None

    @staticmethod
    def _extract(raw: pd.DataFrame | None, ticker: str, *, single: bool) -> pd.DataFrame | None:
        if raw is None or raw.empty:
            return None
        if single or not isinstance(raw.columns, pd.MultiIndex):
            return raw
        if ticker not in raw.columns.get_level_values(0):
            return None
        return raw[ticker]

    # -------------------------------------------------- マクロ（米国市場）

    def fetch_macro(self) -> dict[str, Any]:
        """前夜の米国市場（SPEC 5.4）。

        ドル円・VIX・TOPIX は**ぽいロボ側が正**なので、ここでは取らない
        （同じ数字の出どころを2つ作らない）。ここで取るのは S&P・ナスダック・SOX・米金利だけ。
        """
        symbols = [s for s in self.cfg.get("macro.us_symbols") if s not in ("^VIX",)]
        out: dict[str, Any] = {}
        raw = self._download(symbols, "10d")
        if raw is None:
            log.warning("米国市場のデータが取れなかった（マクロは欠測として扱う）")
            return out

        for symbol in symbols:
            frame = self._extract(raw, symbol, single=len(symbols) == 1)
            if frame is None or frame.empty:
                continue
            frame = frame.dropna(subset=["Close"])
            if len(frame) < 2:
                continue
            last, prev = float(frame["Close"].iloc[-1]), float(frame["Close"].iloc[-2])
            out[symbol] = {
                "date": frame.index[-1].strftime("%Y-%m-%d"),
                "close": round(last, 2),
                "change_pct": round((last - prev) / prev * 100.0, 2) if prev else None,
            }
        return out


def reject_summary(reports: dict[str, CleanReport]) -> dict[str, int]:
    """クレンジングで落ちた理由の集計（EDA とファネル計測に使う）。"""
    summary: dict[str, int] = {}
    for report in reports.values():
        if report.ok:
            continue
        key = (report.reject_reason or "不明").split("（")[0]
        summary[key] = summary.get(key, 0) + 1
    return summary
