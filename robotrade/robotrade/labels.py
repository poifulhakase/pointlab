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


# ── AI が書いた文章に残る英語の項目名・値（2026-09-28） ─────────────────
# 🔴 プロンプト（decider-v3）で「英語の項目名や区分値を書かない」と頼んでも、
#    判断の理由に `chartのswing_fit=good` のような書き方が残った（9/24・9/25 の #判断サマリ）。
#    頼むだけでは消えないので、**表示する瞬間に**ここで決まった語だけ置き換える。
#    AI の文章そのもの（DB・ログ）は書き換えない。

# 分析AIの名前
AGENT_LABEL = {"chart": "チャート分析", "supply_demand": "需給分析", "news": "ニュース分析",
               "decider": "売買判断", "selector": "銘柄選定"}

# 項目名 → (日本語, その項目の値の訳)
FIELD_NAMES: dict[str, tuple[str, dict[str, str] | None]] = {
    "swing_fit": ("スイング適性", SWING_FIT_LABEL),
    "regime": ("相場の形", REGIME_LABEL),
    "higher_tf_trend": ("週足の向き", TREND_LABEL),
    "trend_strength": ("勢い", STRENGTH_LABEL),
    "position": ("位置", POSITION_LABEL),
    "band_state": ("バンドの状態", BAND_LABEL),
    "breakout_volume": ("ブレイクの出来高", BREAKOUT_LABEL),
    "selling_pressure": ("売り圧力", LEVEL_LABEL),
    "short_squeeze_potential": ("踏み上げ", LEVEL_LABEL),
    "supply_demand_score": ("需給スコア", None),
    "catalyst": ("材料", CATALYST_LABEL),
    "strength": ("材料の強さ", LEVEL_LABEL),
    "source_tier": ("出所", SOURCE_TIER_LABEL),
    "candle_pattern": ("ローソク足の形", None),
    "confidence": ("確信度", None),
    "entry_zone": ("買いの目安帯", None),
}


# 🔴 Python の  は日本語も「単語の文字」とみなすので「はswing_fit」の間に境界が無い。英数字だけで区切る。
_A = r"(?<![A-Za-z0-9_])"
_Z = r"(?![A-Za-z0-9_])"


def ja_text(text: Any) -> str:
    """AI の文章に残った英語の項目名と値を日本語に置き換える（表示用）。

    - `chartのswing_fit=good` → `チャート分析のスイング適性「向く」`
    - `swing_fitもweak` → `スイング適性も「やや不向き」`
    知らない英単語は触らない（MACD・RSI などの一般的な指標名を壊さない）。
    """
    import re

    s = "" if text is None else str(text)
    for key, (label, table) in FIELD_NAMES.items():
        if table:
            vals = "|".join(sorted(map(re.escape, table), key=len, reverse=True))
            s = re.sub(rf"{_A}{key}\s*(=|:|＝|：|は|も|が)?\s*({vals}){_Z}",
                       lambda m, lb=label, tb=table: f"{lb}{'' if (m.group(1) or '') in ('=', ':', '＝', '：', '') else m.group(1)}「{tb[m.group(2)]}」",
                       s)
        s = re.sub(rf"{_A}{key}{_Z}", label, s)
    for key, label in AGENT_LABEL.items():
        s = re.sub(rf"{_A}{key}(?=の|が|は|も|で|と)", label, s)
    return s
