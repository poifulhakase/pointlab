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
