"""note 新着通知のテスト（NOTE_FEED.md）。

RSS もDiscordも叩かない（差し替える）。見るのは**事故を防ぐための決め**が効いているか:
  - 初回に25件まとめて投稿しない
  - RSSが0件のときに既読を消さない
  - 既読ファイルが壊れているときに初回扱いしない
  - 投稿に失敗したものを既読にしない
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from swinglab.notify import note_feed as nf


# ------------------------------------------------------------------ 足場


def make_feed(entries, status=200):
    """feedparser.parse() の戻り値に似せる。"""
    items = []
    for i, (guid, title, creator, ts) in enumerate(entries):
        items.append({
            "id": guid, "link": guid, "title": title,
            "note_creatorname": creator,
            "published": f"day{i}",
            "published_parsed": ts,
        })
    return SimpleNamespace(entries=items, status=status, bozo=False)


ENTRIES = [
    ("https://note.com/a/n/1", "古い記事", "ムサシ", (2026, 9, 10, 0, 0, 0, 0, 0, 0)),
    ("https://note.com/a/n/2", "新しい記事", "ノラ", (2026, 9, 18, 0, 0, 0, 0, 0, 0)),
]


class FakeNotifier:
    def __init__(self, ok=True):
        self.ok = ok
        self.sent: list[str] = []
        self.enabled = True

    def send(self, content="", kind="", **kwargs):
        if not self.ok:
            return False
        self.sent.append(content)
        return True


@pytest.fixture
def feed(cfg, tmp_path, monkeypatch):
    """状態ファイルを一時ディレクトリに向けた NoteFeed。"""
    state = tmp_path / "note_state.json"
    monkeypatch.setattr(
        type(cfg), "path",
        lambda self, key, default=...: state if key == "note_feed.state_path"
        else cfg.root / str(self.get(key, default)),
    )
    obj = nf.NoteFeed(cfg)
    obj.notifier = FakeNotifier()
    obj.enabled = True
    return obj


# ------------------------------------------------------------------ 並び・整形


def test_entries_are_ordered_oldest_first():
    """投稿順が自然になるよう古い順に並べ直す（RSSは新しい順で来る）。"""
    articles = nf.parse_entries(make_feed(list(reversed(ENTRIES))))
    assert [a.title for a in articles] == ["古い記事", "新しい記事"]


def test_entry_without_guid_is_dropped():
    bad = SimpleNamespace(entries=[{"title": "guidなし"}], status=200)
    assert nf.parse_entries(bad) == []


def test_line_format_matches_spec():
    a = nf.Article(guid="g", title="タイトル", link="https://note.com/x", creator="ムサシ")
    assert a.line() == "📝 新着｜タイトル｜by ムサシ｜https://note.com/x"


def test_line_handles_missing_creator():
    a = nf.Article(guid="g", title="t", link="l", creator="")
    assert "by 不明" in a.line()


# ------------------------------------------------------------------ 初回


def test_first_run_posts_nothing(feed, monkeypatch):
    """🔴 導入した瞬間に25件でチャンネルを埋めない。"""
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(ENTRIES))
    result = feed.run()
    assert result.first_run is True
    assert result.posted == []
    assert result.skipped == 2
    assert feed.notifier.sent == []
    # 既読は作られている
    assert len(feed.store.load()[0]) == 2


def test_first_run_dry_run_does_not_write_state(feed, monkeypatch):
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(ENTRIES))
    feed.run(dry_run=True)
    assert feed.store.load()[1] is True        # まだ初回のまま


# ------------------------------------------------------------------ 差分


def test_only_new_articles_are_posted(feed, monkeypatch):
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(ENTRIES))
    feed.run()                                   # 初回で2件を既読に

    extra = ENTRIES + [("https://note.com/a/n/3", "できたて", "ハル",
                        (2026, 9, 19, 0, 0, 0, 0, 0, 0))]
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(extra))
    result = feed.run()

    assert [a.title for a in result.posted] == ["できたて"]
    assert feed.notifier.sent == ["📝 新着｜できたて｜by ハル｜https://note.com/a/n/3"]


def test_running_twice_posts_nothing_the_second_time(feed, monkeypatch):
    """冪等性: 同じフィードを2回読んでも二重投稿しない。"""
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(ENTRIES))
    feed.run()
    extra = ENTRIES + [("https://note.com/a/n/3", "できたて", "ハル", None)]
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(extra))
    feed.run()
    before = len(feed.notifier.sent)
    feed.run()
    assert len(feed.notifier.sent) == before


def test_max_per_run_holds_the_rest(feed, monkeypatch):
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(ENTRIES))
    feed.run()
    feed.max_per_run = 1
    more = ENTRIES + [
        ("https://note.com/a/n/3", "A", "x", None),
        ("https://note.com/a/n/4", "B", "y", None),
    ]
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(more))
    result = feed.run()
    assert len(result.posted) == 1 and result.skipped == 1
    # 残りは次回に出る
    result2 = feed.run()
    assert len(result2.posted) == 1


def test_creator_filter(feed, monkeypatch):
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(ENTRIES))
    feed.run()
    feed.creators = ["ハル"]
    more = ENTRIES + [
        ("https://note.com/a/n/3", "ハルの記事", "ハル", None),
        ("https://note.com/a/n/4", "他の人の記事", "だれか", None),
    ]
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(more))
    result = feed.run()
    assert [a.title for a in result.posted] == ["ハルの記事"]


# ------------------------------------------------------------------ 事故を防ぐ決め


def test_empty_feed_does_not_wipe_seen(feed, monkeypatch):
    """🔴 取得失敗で0件になったときに既読を消さない（次回に全件投稿してしまう）。"""
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(ENTRIES))
    feed.run()
    seen_before = feed.store.load()[0]

    monkeypatch.setattr(feed, "fetch", lambda: make_feed([]))
    result = feed.run()
    assert result.error and "取得失敗" in result.error
    assert feed.store.load()[0] == seen_before


def test_http_error_is_reported_not_silently_ignored(feed, monkeypatch):
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(ENTRIES, status=503))
    result = feed.run()
    assert result.error and "503" in result.error
    assert result.posted == []


def test_fetch_exception_does_not_crash(feed, monkeypatch):
    def boom():
        raise OSError("ネットワークが死んだ")

    monkeypatch.setattr(feed, "fetch", boom)
    result = feed.run()
    assert result.error and "ネットワーク" in result.error


def test_corrupt_state_raises_instead_of_resetting(feed, monkeypatch):
    """🔴 壊れた既読ファイルを初回扱いにしない（既読が消えて全件投稿になる）。"""
    feed.store.path.parent.mkdir(parents=True, exist_ok=True)
    feed.store.path.write_text("{壊れたJSON", encoding="utf-8")
    with pytest.raises(RuntimeError, match="読めない"):
        feed.store.load()


def test_failed_post_is_not_marked_as_seen(feed, monkeypatch):
    """🔴 送れなかったものは既読にしない。次回もう一度出す。"""
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(ENTRIES))
    feed.run()
    more = ENTRIES + [("https://note.com/a/n/3", "送れない記事", "x", None)]
    monkeypatch.setattr(feed, "fetch", lambda: make_feed(more))

    feed.notifier = FakeNotifier(ok=False)
    result = feed.run()
    assert result.posted == []
    assert "https://note.com/a/n/3" not in feed.store.load()[0]

    # 次回は投稿できる
    feed.notifier = FakeNotifier(ok=True)
    result = feed.run()
    assert [a.title for a in result.posted] == ["送れない記事"]


def test_disabled_feed_does_nothing(feed, monkeypatch):
    feed.enabled = False
    monkeypatch.setattr(feed, "fetch", lambda: pytest.fail("無効なのに取りにいった"))
    result = feed.run()
    assert result.posted == [] and result.error is None


def test_seen_list_is_capped(feed, monkeypatch):
    feed.store.save([f"g{i}" for i in range(nf.MAX_REMEMBERED + 50)])
    assert len(feed.store.load()[0]) == nf.MAX_REMEMBERED


def test_state_file_is_valid_json(feed):
    feed.store.save(["a", "b"])
    data = json.loads(feed.store.path.read_text(encoding="utf-8"))
    assert data["seen"] == ["a", "b"] and "updated_at" in data
