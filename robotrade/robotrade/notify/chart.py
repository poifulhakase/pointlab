"""#成績 チャンネルに添える推移グラフ（DISCORD.md 3.3 / SPEC 10.4）。

🔴 **二軸にしない**。総資産は「円」（数百万）、TOPIX は「ポイント」（数千）で桁が違う。
   二軸にすると、目盛りの取り方ひとつでどちらが勝っているようにも見せられる。
   → **両方を起点100に指数化して1本の軸**に載せる。これが SPEC 10.4 の
     「ベンチマーク超過（地合いで勝っただけかを見抜く）」をそのまま絵にした形。

🔴 色は検証済みのペア（dark 用スロット1=青 / 2=橙）。Discord の暗い背景で
   CVD（色覚多様性）分離 ΔE 26.8・コントラスト 3:1 以上を満たすことを確認済み。
   凡例に加えて**線の右端に直接ラベル**を置く（色だけに意味を持たせない）。
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")  # 画面の無い環境で描くため（GUIバックエンドを使わない）

import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib import font_manager  # noqa: E402

log = logging.getLogger(__name__)

# Discord の暗い背景に合わせた面。埋め込みカードの地の色に近づける。
SURFACE = "#2b2d31"
TEXT_PRIMARY = "#dbdee1"
TEXT_MUTED = "#949ba4"
GRID = "#3f4248"

SERIES_SELF = "#3987e5"       # 検証済み dark スロット1（青）
SERIES_BENCH = "#d95926"      # 検証済み dark スロット2（橙）

# Windows に入っている日本語フォント。無いと豆腐（□）になる。
JP_FONTS = ["Yu Gothic", "Meiryo", "MS Gothic", "Noto Sans CJK JP", "IPAexGothic"]


def _pick_font() -> str | None:
    available = {f.name for f in font_manager.fontManager.ttflist}
    for name in JP_FONTS:
        if name in available:
            return name
    log.warning("日本語フォントが見つからない（グラフの文字が豆腐になる）: %s", JP_FONTS)
    return None


def equity_curve(history: list[dict[str, Any]], out_path: Path) -> Path | None:
    """総資産と TOPIX を起点100に揃えて描く。

    `history` は store.equity_history() の形（date / equity / benchmark）。
    点が2つ未満なら描かない（折れ線にならない）。
    """
    points = [
        r for r in history
        if r.get("equity") and r.get("date")
    ]
    if len(points) < 2:
        log.info("グラフは描かない（データ点が %d 個）", len(points))
        return None

    import datetime as _dt

    dates = [_dt.date.fromisoformat(r["date"]) for r in points]
    base_equity = points[0]["equity"]
    equity_idx = [r["equity"] / base_equity * 100 for r in points]

    # ベンチマークは**両方揃っている区間だけ**で指数化する（欠測を捏造しない）
    bench_points = [(d, r) for d, r in zip(dates, points) if r.get("benchmark")]
    bench_dates, bench_idx = [], []
    if len(bench_points) >= 2:
        base_bench = bench_points[0][1]["benchmark"]
        bench_dates = [d for d, _ in bench_points]
        bench_idx = [r["benchmark"] / base_bench * 100 for _, r in bench_points]

    font = _pick_font()
    if font:
        plt.rcParams["font.family"] = font
    plt.rcParams["axes.unicode_minus"] = False

    fig, ax = plt.subplots(figsize=(9, 4.2), dpi=140)
    fig.patch.set_facecolor(SURFACE)
    ax.set_facecolor(SURFACE)

    # 起点（100）の基準線。目盛りより手前に出さない。
    ax.axhline(100, color=GRID, linewidth=1, zorder=1)

    ax.plot(dates, equity_idx, color=SERIES_SELF, linewidth=2, zorder=3,
            solid_capstyle="round", label="ロボトレード")
    if bench_idx:
        ax.plot(bench_dates, bench_idx, color=SERIES_BENCH, linewidth=2, zorder=2,
                solid_capstyle="round", label="TOPIX")

    # 🔴 色だけに意味を持たせない: 右端に直接ラベルを置く（凡例も出す）
    ax.annotate(f" ロボトレード {equity_idx[-1]:.1f}", (dates[-1], equity_idx[-1]),
                color=SERIES_SELF, fontsize=9, va="center", weight="bold",
                xytext=(6, 0), textcoords="offset points")
    if bench_idx:
        ax.annotate(f" TOPIX {bench_idx[-1]:.1f}", (bench_dates[-1], bench_idx[-1]),
                    color=SERIES_BENCH, fontsize=9, va="center",
                    xytext=(6, 0), textcoords="offset points")

    ax.set_title("総資産と TOPIX（起点=100）", color=TEXT_PRIMARY, fontsize=12,
                 loc="left", pad=12)
    ax.set_ylabel("指数（起点=100）", color=TEXT_MUTED, fontsize=9)

    # 目盛り・枠は控えめに（主役はデータ）
    ax.grid(axis="y", color=GRID, linewidth=0.8, alpha=0.6)
    ax.set_axisbelow(True)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(colors=TEXT_MUTED, labelsize=9, length=0)

    ax.xaxis.set_major_formatter(mdates.DateFormatter("%m/%d"))
    fig.autofmt_xdate(rotation=0, ha="center")

    legend = ax.legend(loc="upper left", frameon=False, fontsize=9)
    for text in legend.get_texts():
        text.set_color(TEXT_PRIMARY)

    # 右端のラベルが切れないよう余白を足す
    ax.margins(x=0.10)
    fig.tight_layout()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, facecolor=SURFACE, bbox_inches="tight")
    plt.close(fig)
    return out_path
