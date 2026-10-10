"""表示ラベルの網羅テスト（robotrade/labels.py）。

🔴 ねらいは「訳の**抜け**に気づけること」。エージェントの enum は増える。
   増えたときに通知へ英語がそのまま出るのを、ここで落として教える。
"""

from __future__ import annotations

import re

from robotrade import labels as L
from robotrade.agents import chart, news, supply_demand


def _assert_all_translated(values: set[str], table: dict[str, str], where: str) -> None:
    missing = sorted(v for v in values if v not in table)
    assert not missing, f"{where} の訳が無い: {missing}（labels.py に足す）"


def test_chart_enums_are_translated():
    _assert_all_translated(chart.HIGHER_TF, L.TREND_LABEL, "chart.HIGHER_TF")
    _assert_all_translated(chart.REGIMES, L.REGIME_LABEL, "chart.REGIMES")
    _assert_all_translated(chart.STRENGTHS, L.STRENGTH_LABEL, "chart.STRENGTHS")
    _assert_all_translated(chart.POSITIONS, L.POSITION_LABEL, "chart.POSITIONS")
    _assert_all_translated(chart.BAND_STATES, L.BAND_LABEL, "chart.BAND_STATES")
    _assert_all_translated(chart.BREAKOUTS, L.BREAKOUT_LABEL, "chart.BREAKOUTS")
    _assert_all_translated(chart.SWING_FITS, L.SWING_FIT_LABEL, "chart.SWING_FITS")


def test_supply_demand_and_news_enums_are_translated():
    _assert_all_translated(supply_demand.PRESSURES, L.LEVEL_LABEL, "supply_demand.PRESSURES")
    _assert_all_translated(news.CATALYSTS, L.CATALYST_LABEL, "news.CATALYSTS")
    _assert_all_translated(news.STRENGTHS, L.LEVEL_LABEL, "news.STRENGTHS")
    _assert_all_translated(news.SOURCE_TIERS, L.SOURCE_TIER_LABEL, "news.SOURCE_TIERS")


def test_every_label_value_is_japanese():
    """訳に英単語が残っていないか（コピペのし忘れ）。"""
    tables = [v for k, v in vars(L).items() if k.endswith("_LABEL")]
    for table in tables:
        for key, value in table.items():
            assert not re.fullmatch(r"[A-Za-z_ ]+", value), f"{key} の訳が英語のまま: {value}"


def test_ja_keeps_unknown_value_visible():
    """🔴 知らない値は黙って潰さない（訳の足し忘れに気づけなくなる）。"""
    assert L.ja(L.LEVEL_LABEL, "extreme") == "extreme"
    assert L.ja(L.LEVEL_LABEL, None) == "不明"
    assert L.ja(L.LEVEL_LABEL, "", unknown="—") == "—"
    assert L.ja(L.LEVEL_LABEL, "high") == "高"


def test_ja_text_rewrites_field_names_left_in_ai_reason():
    """🔴 2026-09-28：判断の理由に `chartのswing_fit=good` が残った（#判断サマリ）。表示の瞬間に直す。"""
    assert L.ja_text("chartはswing_fit=goodで押し目形成中") == "チャート分析はスイング適性「向く」で押し目形成中"
    assert L.ja_text("chartのswing_fitもweakと判定") == "チャート分析のスイング適性も「やや不向き」と判定"
    assert L.ja_text("需給はselling_pressure=highで") == "需給は売り圧力「高」で"
    assert L.ja_text("supply_demand_score -0.35") == "需給スコア -0.35"


def test_ja_text_leaves_general_words_alone():
    """指標名や、項目名の付かない英単語は触らない（MACD・RSI・weak 単独など）。"""
    assert L.ja_text("MACDヒストグラムもマイナス、RSIは50") == "MACDヒストグラムもマイナス、RSIは50"
    assert L.ja_text("weakな地合い") == "weakな地合い"
    assert L.ja_text(None) == ""


def test_every_field_name_value_table_is_a_label_table():
    """項目名の訳に使う値の表は、既存の *_LABEL と同じもの（訳を二重に持たない）。"""
    tables = [v for k, v in vars(L).items() if k.endswith("_LABEL")]
    for key, (label, table) in L.FIELD_NAMES.items():
        assert not re.fullmatch(r"[A-Za-z_ ]+", label), key
        assert table is None or any(table is t for t in tables), key
