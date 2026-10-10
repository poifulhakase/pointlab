"""「過熱していない」の点数（prefilter.not_overheated_score・2026-09-28）。

🔴 きっかけ＝売買判断AIの見送り9件中7件が過熱（RSI67〜72・25日線乖離+8〜16%）。
   候補選びがすでに上がった銘柄を上位に出し、押し目で買いたい判断AIが全部見送っていた。
"""
from __future__ import annotations

from robotrade.data import prefilter as pf


def test_calm_pullback_gets_full_marks(cfg):
    assert pf.not_overheated_score(55, 3.0, cfg) == 1.0


def test_the_stocks_the_ai_rejected_score_low(cfg):
    """9/25 に過熱で見送られた形（RSI72・乖離+12%／RSI69・乖離+15.8%）はほぼ0点。"""
    assert pf.not_overheated_score(72, 12.0, cfg) < 0.15
    assert pf.not_overheated_score(69, 15.8, cfg) < 0.25


def test_score_falls_as_heat_rises(cfg):
    assert pf.not_overheated_score(60, 5, cfg) > pf.not_overheated_score(66, 8, cfg) \
        > pf.not_overheated_score(74, 11, cfg)


def test_broken_below_the_25day_line_is_not_a_pullback(cfg):
    """25日線を大きく割った銘柄は押し目ではなく崩れ＝乖離の部分は満点にしない。"""
    assert pf.not_overheated_score(40, -10.0, cfg) < pf.not_overheated_score(40, -3.0, cfg)


def test_missing_values_are_neutral(cfg):
    assert pf.not_overheated_score(None, None, cfg) == 0.5
