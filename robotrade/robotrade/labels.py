"""表示用の日本語ラベル（Discord通知・ダッシュボード共通）。

🔴 **人が読むところに英語を出さない**（運用者の指示・2026-09-20）。

🔴 内部の値は英語のまま据え置く。エージェントの enum（`agents/*.py`）・トレードのラベル
   （`learning/outcomes.py`）は DB・スキーマ・テストが持っている識別子なので、
   値そのものを日本語にしない。**表示する瞬間だけ**ここで訳す。

🔴 訳は**ここだけ**に置く（通知とダッシュボードで違う言葉にしない）。
   enum を増やしたら、ここにも足す。`tests/test_labels.py` が
   `agents/*.py` の enum を総なめして、訳の抜けを落として教える。
"""

from __future__ import annotations

from typing import Any

# チャート分析AI（agents/chart.py）
REGIME_LABEL = {
    "uptrend": "上昇トレンド", "downtrend": "下降トレンド",
    "range": "レンジ", "unclear": "どっちつかず",
}
TREND_LABEL = {"up": "上", "down": "下", "range": "横"}
STRENGTH_LABEL = {"strong": "強い", "moderate": "ふつう", "weak": "弱い"}
POSITION_LABEL = {"overbought": "買われすぎ", "oversold": "売られすぎ", "neutral": "中立"}
BAND_LABEL = {"squeeze": "収縮（これから動く）", "expansion": "拡大（動いている）",
              "normal": "ふつう"}
BREAKOUT_LABEL = {"confirmed": "伴った", "weak": "乏しい", "none": "なし"}
SWING_FIT_LABEL = {"good": "向く", "weak": "やや不向き", "bad": "不向き"}

# 需給分析AI（agents/supply_demand.py）・ニュース分析AI（agents/news.py）
LEVEL_LABEL = {"low": "低", "mid": "中", "high": "高"}
CATALYST_LABEL = {"positive": "好材料", "negative": "悪材料", "neutral": "中立",
                  "none": "なし"}
SOURCE_TIER_LABEL = {"primary": "一次情報", "secondary": "二次情報",
                     "unverified": "裏取りなし"}

# 売買判断AI（agents/decider.py）
ACTION_LABEL = {"buy": "買い", "sell": "売り", "hold": "様子見"}

# 手仕舞いの帰結（learning/outcomes.py の label_trade）
TRADE_LABEL = {"win": "勝ち", "loss": "負け", "time_exit": "時間切れ"}

# 1日の実行の状態（orchestrator / portfolio/store.py の runs.status）
RUN_STATUS_LABEL = {
    "running": "実行中", "done": "完了", "dry_run": "お試し実行",
    "skipped": "実行せず", "error": "失敗",
}


def ja(table: dict[str, str], value: Any, *, unknown: str = "不明") -> str:
    """enum を日本語に直す。

    🔴 未知の値は**そのまま出す**。黙って「不明」に潰すと、
       enum が増えたのに訳を足し忘れたことに気づけなくなる。
    """
    if value is None or value == "":
        return unknown
    return table.get(value, str(value))
