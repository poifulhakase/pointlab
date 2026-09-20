"""適時開示（TDnet）取得のテスト（robotrade/data/tdnet.py）。

実際には叩かない（requests.Session を差し替える）。見るのは:
  - 🔴 判断日より後の開示を渡さないか（先読み）
  - 🔴 取得に失敗してもその日の実行を止めないか
  - 期間・件数の絞り込みと、並び順
"""

from __future__ import annotations

from datetime import date

import pytest

from robotrade.data import tdnet as tmod


def an_item(pubdate: str, title: str = "業績予想の修正に関するお知らせ"):
    return {"Tdnet": {"id": "1", "pubdate": pubdate, "company_code": "69860",
                      "company_name": "双葉電子", "title": title,
                      "document_url": "https://example.test/x.pdf"}}


class FakeSession:
    """requests.Session の差し替え。"""

    def __init__(self, payload=None, error: Exception | None = None):
        self.payload = payload if payload is not None else {"items": []}
        self.error = error
        self.calls: list[dict] = []

    def get(self, url, params=None, timeout=None, headers=None):
        self.calls.append({"url": url, "params": params})
        if self.error:
            raise self.error

        payload = self.payload

        class R:
            status_code = 200

            def raise_for_status(self):
                pass

            def json(self):
                return payload

        return R()


@pytest.fixture
def source(cfg):
    def _make(session):
        return tmod.TdnetHeadlines(cfg, session=session)
    return _make


def test_does_not_return_disclosures_after_the_run_date(source):
    """🔴 判断日より後の開示を渡さない（未来を見て買ったことになる）。"""
    session = FakeSession({"items": [
        an_item("2026-09-19 15:00:00", "上方修正"),   # 判断日の翌日＝未来
        an_item("2026-09-18 17:00:00", "決算短信"),
    ]})
    rows = source(session).fetch_headlines("6986.T", as_of=date(2026, 9, 18))
    titles = [r["title"] for r in rows]
    assert titles == ["決算短信"]


def test_drops_disclosures_older_than_lookback(source, cfg):
    session = FakeSession({"items": [
        an_item("2026-09-10 15:00:00", "自己株式の取得"),
        an_item("2026-01-05 15:00:00", "大昔のお知らせ"),
    ]})
    rows = source(session).fetch_headlines("6986.T", as_of=date(2026, 9, 18))
    assert [r["title"] for r in rows] == ["自己株式の取得"]


def test_newest_first_and_capped(source, cfg):
    items = [an_item(f"2026-09-{day:02d} 15:00:00", f"開示{day}") for day in range(1, 18)]
    rows = source(FakeSession({"items": items})).fetch_headlines(
        "6986.T", as_of=date(2026, 9, 18))
    assert len(rows) == int(cfg.get("news.max_items"))
    assert rows[0]["date"] > rows[-1]["date"]


def test_marks_tdnet_as_primary_source(source):
    """TDnet＝発行体自身の開示＝一次情報。二次情報と混ぜない。"""
    rows = source(FakeSession({"items": [an_item("2026-09-18 17:00:00")]})).fetch_headlines(
        "6986.T", as_of=date(2026, 9, 18))
    assert rows[0]["source_tier"] == "primary"
    assert rows[0]["date"] == "2026-09-18"


def test_network_failure_does_not_stop_the_run(source, caplog):
    """🔴 取得に失敗しても例外を上げない（その日の実行ごと落ちる）。"""
    rows = source(FakeSession(error=RuntimeError("接続できない"))).fetch_headlines(
        "6986.T", as_of=date(2026, 9, 18))
    assert rows == []


def test_unreadable_date_is_dropped_not_guessed(source):
    """日付が読めない行は捨てる（今日の日付で埋めない）。"""
    session = FakeSession({"items": [an_item("", "日付なし"),
                                     an_item("2026-09-18 17:00:00", "まとも")]})
    rows = source(session).fetch_headlines("6986.T", as_of=date(2026, 9, 18))
    assert [r["title"] for r in rows] == ["まとも"]


def test_uses_four_digit_code(source):
    session = FakeSession()
    source(session).fetch_headlines("6986.T", as_of=date(2026, 9, 18))
    assert "6986" in session.calls[0]["url"]
    assert "6986.T" not in session.calls[0]["url"]


def test_from_config_rejects_unknown_source(cfg):
    """未知の値を黙って none に落とさない（設定ミスに気づけなくなる）。"""
    cfg.raw["news"]["source"] = "kabutan"
    try:
        with pytest.raises(ValueError):
            tmod.from_config(cfg)
    finally:
        # 🔴 cfg は session スコープ。書き換えたら必ず戻す（他のテストに漏れる）
        cfg.raw["news"]["source"] = "tdnet"
