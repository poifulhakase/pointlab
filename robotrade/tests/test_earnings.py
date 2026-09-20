"""決算発表予定日のテスト（robotrade/data/earnings.py）。

実際には JPX を叩かない。見るのは:
  - 🔴 終わった決算を「これから」と言わないか
  - 🔴 「未定」の行で日付を捏造しないか
  - 🔴 取れなくてもその日の実行を止めないか
  - 5桁コード（末尾0）の正規化
"""

from __future__ import annotations

import json
from datetime import date

import pytest

from robotrade.data import earnings as emod


@pytest.fixture
def schedule(cfg, tmp_path, monkeypatch):
    """キャッシュを差し替えた EarningsSchedule を作る（本物のファイルを汚さない）。"""
    def _make(rows: dict[str, list[dict[str, str]]], as_of: str = "2026-09-20"):
        path = tmp_path / "earnings.json"
        path.write_text(json.dumps({"as_of": as_of, "schedule": rows},
                                   ensure_ascii=False), encoding="utf-8")
        es = emod.EarningsSchedule(cfg)
        es.cache_path = path
        return es
    return _make


def test_returns_the_nearest_future_announcement(schedule):
    es = schedule({"4716": [{"date": "2026-09-24", "kind": "第１四半期"},
                            {"date": "2026-12-24", "kind": "第２四半期"}]})
    found = es.next_announcement("4716.T", date(2026, 9, 20))
    assert found["date"] == "2026-09-24"
    assert found["days_until"] == 4
    assert found["kind"] == "第１四半期"


def test_does_not_report_a_finished_announcement(schedule):
    """🔴 終わった決算を「これから来る」と言わない。"""
    es = schedule({"4716": [{"date": "2026-09-10", "kind": "第１四半期"}]})
    assert es.next_announcement("4716.T", date(2026, 9, 20)) is None


def test_unknown_ticker_is_none(schedule):
    es = schedule({"4716": [{"date": "2026-09-24", "kind": ""}]})
    assert es.next_announcement("7203.T", date(2026, 9, 20)) is None


def test_broken_cache_does_not_raise(cfg, tmp_path):
    """🔴 キャッシュが壊れていてもその日の実行を止めない。"""
    path = tmp_path / "broken.json"
    path.write_text("{ｺﾞﾐ", encoding="utf-8")
    es = emod.EarningsSchedule(cfg, session=_FailingSession())
    es.cache_path = path
    assert es.next_announcement("4716.T", date(2026, 9, 20)) is None
    assert es.is_available() is False


class _FailingSession:
    def get(self, *args, **kwargs):
        raise RuntimeError("JPXに繋がらない")


def test_fetch_failure_does_not_raise(cfg, tmp_path):
    es = emod.EarningsSchedule(cfg, session=_FailingSession())
    es.cache_path = tmp_path / "missing.json"
    assert es.is_available() is False


# ---------------------------------------------------------------- 解釈


@pytest.mark.parametrize("raw,expected", [
    ("69860", "6986"),      # 5桁（末尾0）→ 4桁
    ("6986", "6986"),
    (6986.0, "6986"),       # Excel が数値で返す
    ("135A", "135A"),       # 英字入りの新しいコード
    (None, ""),
    ("合計", ""),
])
def test_code_normalization(raw, expected):
    assert emod._normalize_code(raw) == expected


@pytest.mark.parametrize("raw", ["", None, "未定", "―"])
def test_undecided_date_is_dropped_not_guessed(raw):
    """🔴「未定」を今日の日付などで埋めない。"""
    assert emod._parse_date(raw) is None


def test_parses_excel_datetime_and_strings():
    assert emod._parse_date("2026-09-24 00:00:00") == date(2026, 9, 24)
    assert emod._parse_date("2026/09/24") == date(2026, 9, 24)
    assert emod._parse_date(date(2026, 9, 24)) == date(2026, 9, 24)


# ---------------------------------------------------------------- 第3層での使われ方


def _a_candidate():
    """layer3 を通すだけの最小の候補（直近の値動きは穏やかにしておく）。"""
    import pandas as pd

    from robotrade.data.prefilter import Candidate

    frame = pd.DataFrame({"close": [1000.0] * 30})

    class Ind:
        def __init__(self):
            self.frame = frame
            self.latest = {"close": 1000.0}

    class Stock:
        ticker = "4716.T"
        code = "4716"
        name = "日本オラクル"
        sector = "情報・通信業"
        fx_sensitivity = "neutral"

    return Candidate(stock=Stock(), indicators=Ind())


def test_layer3_excludes_a_candidate_announcing_within_days(cfg):
    """🔴 決算をまたぐ新規建てを避ける（数値分析の外側で窓を開ける）。"""
    from robotrade.data.prefilter import layer3

    limit = int(cfg.get("screen.exclude_earnings_within_days"))
    candidate = _a_candidate()
    assert layer3(candidate, cfg, earnings_days=limit) is False
    assert "決算発表" in candidate.rejected_by


def test_layer3_keeps_a_candidate_announcing_later(cfg):
    """少し先の決算は落とさず、材料として残す（決算シーズンの全滅を避ける）。"""
    from robotrade.data.prefilter import layer3

    later = int(cfg.get("screen.exclude_earnings_within_days")) + 5
    candidate = _a_candidate()
    assert layer3(candidate, cfg, earnings_days=later) is True
    assert any("決算発表" in r for r in candidate.reasons)


def test_layer3_without_earnings_data_does_not_exclude(cfg):
    """🔴 取れていないことを理由に落とさない（データなしと予定ありを混ぜない）。"""
    from robotrade.data.prefilter import layer3

    candidate = _a_candidate()
    assert layer3(candidate, cfg, earnings_days=None) is True
    assert not any("決算発表" in r for r in candidate.reasons)
