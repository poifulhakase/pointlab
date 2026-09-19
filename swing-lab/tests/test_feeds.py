"""お知らせフィードのテスト（NOTE_FEED.md）。

RSS も Discord も叩かない（差し替える）。見るのは**事故を防ぐための決め**が効いているか:
  - 初回に全件まとめて投稿しない
  - RSSが0件のときに既読を消さない
  - 既読ファイルが壊れているときに初回扱いしない
  - 投稿に失敗したものを既読にしない
  - 流量の多い情報源を1通にまとめる（ポイ探は実測1日10件）
"""

from __future__ import annotations

import datetime as dt
import json
from types import SimpleNamespace

import pytest

from swinglab.notify import feeds as ff


# ------------------------------------------------------------------ 足場


def entry(guid, title, creator="", cats=(), ts=None):
    return {
        "id": guid, "link": guid, "title": title,
        "note_creatorname": creator, "author": creator,
        "tags": [{"term": c} for c in cats],
        "published": "x", "published_parsed": ts,
    }


def make_feed(entries, status=200):
    return SimpleNamespace(entries=list(entries), status=status, bozo=False)


def spec(key="s1", channel="note", style="per_item", **over):
    base = dict(key=key, name=f"{key}の名前", url=f"https://{key}.test/feed",
                channel=channel, username="ぽよん君", style=style,
                emoji="📝", label="新着", max_per_run=10)
    base.update(over)
    return ff.SourceSpec(**base)


class FakeNotifier:
    def __init__(self, ok=True):
        self.ok = ok
        self.sent: list[str] = []
        self.embeds: list[list] = []
        self.enabled = True

    def send(self, content="", embeds=None, files=None, **kwargs):
        if not self.ok:
            return False
        self.sent.append(content)
        return True

    def send_batched(self, embeds, content="", files=None, **kwargs):
        if not self.ok:
            return False
        self.embeds.append(embeds)
        return True


class Runner(ff.FeedRunner):
    """RSS と Discord を差し替えた FeedRunner。"""

    def __init__(self, cfg, tmp_path, specs, feeds_by_key):
        self.cfg = cfg
        self.enabled = True
        self.store = ff.SeenStore(tmp_path / "feed_state.json")
        self.specs = specs
        self.avatar_base = ""
        self.sent_log = None
        self._notifiers = {}
        self._feeds = feeds_by_key
        self.notifier = FakeNotifier()

    def fetch(self, source):
        return self._feeds[source.key]

    def notifier_for(self, source):
        return self.notifier


# ------------------------------------------------------------------ 整形


def test_entries_are_ordered_oldest_first():
    feed = make_feed([
        entry("g2", "新しい", ts=(2026, 9, 18, 0, 0, 0, 0, 0, 0)),
        entry("g1", "古い", ts=(2026, 9, 10, 0, 0, 0, 0, 0, 0)),
    ])
    assert [a.title for a in ff.parse_entries(feed, spec())] == ["古い", "新しい"]


def test_entry_without_guid_is_dropped():
    feed = make_feed([{"title": "guidなし"}])
    assert ff.parse_entries(feed, spec()) == []


def test_categories_are_picked_up():
    feed = make_feed([entry("g", "t", cats=("キャンペーン", "楽天ポイント"))])
    assert ff.parse_entries(feed, spec())[0].categories == ["キャンペーン", "楽天ポイント"]


def test_per_item_line_matches_spec():
    a = ff.Article(guid="g", title="タイトル", link="https://note.com/x", creator="ムサシ")
    assert a.line("📝", "新着") == "📝 新着｜タイトル｜by ムサシ｜https://note.com/x"


def test_per_item_line_without_creator():
    a = ff.Article(guid="g", title="t", link="l")
    assert a.line("🎁", "お得") == "🎁 お得｜t｜l"


def test_digest_line_is_a_masked_link_with_category():
    a = ff.Article(guid="g", title="タイトル", link="https://x", categories=["楽天", "クレカ"])
    line = a.digest_line()
    assert "[タイトル](https://x)" in line
    assert "楽天／クレカ" in line


# ------------------------------------------------------------------ ダイジェスト


def test_digest_groups_by_source():
    """🔴 ポイ探は実測1日10件。1通にまとめないと毎日10通になる。"""
    poitan = spec("poitan", "deals", "digest", emoji="🎁", label="今日のお得",
                  name="ポイ探ニュース")
    kocha = spec("kochalog", "deals", "digest", emoji="🎁", label="今日のお得",
                 name="こちゃログ")
    articles = [
        ff.Article(guid=f"p{i}", title=f"お得{i}", link=f"https://p/{i}",
                   categories=["キャンペーン"], source_key="poitan", source_name="ポイ探ニュース")
        for i in range(3)
    ] + [
        ff.Article(guid="k1", title="ゲーム攻略", link="https://k/1",
                   source_key="kochalog", source_name="こちゃログ")
    ]
    embeds = ff.build_digest(articles, {"poitan": poitan, "kochalog": kocha},
                             dt.date(2026, 9, 19))
    assert len(embeds) == 1                       # 1通にまとまる
    payload = embeds[0].to_payload()
    assert payload["title"] == "🎁 今日のお得 9/19（4件）"
    names = [f["name"] for f in payload["fields"]]
    assert names == ["ポイ探ニュース（3件）", "こちゃログ（1件）"]


def test_digest_date_has_no_leading_zero():
    """🔵 strftime の %-m は Windows で ValueError になるので自前で組んでいる。"""
    s = spec("k", "deals", "digest", emoji="🎁", label="今日のお得")
    a = ff.Article(guid="g", title="t", link="l", source_key="k")
    title = ff.build_digest([a], {"k": s}, dt.date(2026, 1, 5))[0].title
    assert "1/5" in title and "01/05" not in title


def test_digest_of_ten_items_fits_in_limits():
    s = spec("poitan", "deals", "digest", emoji="🎁", label="今日のお得")
    articles = [
        ff.Article(guid=f"g{i}", title="楽天カード新規入会・利用で1万ポイント" * 2,
                   link=f"https://www.poitan.jp/archives/19325{i}",
                   categories=["キャンペーン", "クレジットカード（クレカ）"],
                   source_key="poitan", source_name="ポイ探ニュース")
        for i in range(10)
    ]
    embed = ff.build_digest(articles, {"poitan": s}, dt.date(2026, 9, 19))[0]
    assert embed.size() < 6000
    assert all(len(f["value"]) <= 1024 for f in embed.to_payload()["fields"])


def test_empty_digest_returns_nothing():
    assert ff.build_digest([], {}, dt.date(2026, 9, 19)) == []


# ------------------------------------------------------------------ 初回・差分


def test_first_run_posts_nothing(cfg, tmp_path):
    """🔴 導入した瞬間にチャンネルを埋めない。"""
    s = spec()
    feed = make_feed([entry("g1", "A"), entry("g2", "B")])
    runner = Runner(cfg, tmp_path, [s], {"s1": feed})
    results = runner.run()
    assert results[0].first_run is True
    assert runner.notifier.sent == []
    assert len(runner.store.load("s1")[0]) == 2


def test_only_new_articles_are_posted(cfg, tmp_path):
    s = spec()
    feed = make_feed([entry("g1", "A")])
    runner = Runner(cfg, tmp_path, [s], {"s1": feed})
    runner.run()                                   # 初回

    runner._feeds["s1"] = make_feed([entry("g1", "A"), entry("g2", "できたて")])
    results = runner.run()
    assert [a.title for a in results[0].posted] == ["できたて"]
    assert runner.notifier.sent == ["📝 新着｜できたて｜g2"]


def test_running_twice_posts_nothing_the_second_time(cfg, tmp_path):
    """冪等性: 同じフィードを2回読んでも二重投稿しない。"""
    s = spec()
    runner = Runner(cfg, tmp_path, [s], {"s1": make_feed([entry("g1", "A")])})
    runner.run()
    runner._feeds["s1"] = make_feed([entry("g1", "A"), entry("g2", "B")])
    runner.run()
    before = len(runner.notifier.sent)
    runner.run()
    assert len(runner.notifier.sent) == before


def test_max_per_run_holds_the_rest(cfg, tmp_path):
    s = spec(max_per_run=1)
    runner = Runner(cfg, tmp_path, [s], {"s1": make_feed([entry("g0", "seed")])})
    runner.run()
    runner._feeds["s1"] = make_feed([entry("g0", "seed"), entry("g1", "A"), entry("g2", "B")])
    first = runner.run()[0]
    assert len(first.posted) == 1 and first.held == 1
    second = runner.run()[0]
    assert len(second.posted) == 1


def test_creator_filter(cfg, tmp_path):
    s = spec(only_creators=["ハル"])
    runner = Runner(cfg, tmp_path, [s], {"s1": make_feed([entry("g0", "seed", "ハル")])})
    runner.run()
    runner._feeds["s1"] = make_feed([
        entry("g0", "seed", "ハル"), entry("g1", "ハルの記事", "ハル"),
        entry("g2", "他の人の記事", "だれか"),
    ])
    assert [a.title for a in runner.run()[0].posted] == ["ハルの記事"]


def test_category_filter(cfg, tmp_path):
    s = spec(only_categories=["楽天ポイント"])
    runner = Runner(cfg, tmp_path, [s], {"s1": make_feed([entry("g0", "seed", cats=("楽天ポイント",))])})
    runner.run()
    runner._feeds["s1"] = make_feed([
        entry("g0", "seed", cats=("楽天ポイント",)),
        entry("g1", "楽天の記事", cats=("楽天ポイント", "キャンペーン")),
        entry("g2", "dポイントの記事", cats=("dポイント",)),
    ])
    assert [a.title for a in runner.run()[0].posted] == ["楽天の記事"]


# ------------------------------------------------------------------ 事故を防ぐ決め


def test_empty_feed_does_not_wipe_seen(cfg, tmp_path):
    """🔴 取得失敗で0件になったときに既読を消さない（次回に全件投稿してしまう）。"""
    s = spec()
    runner = Runner(cfg, tmp_path, [s], {"s1": make_feed([entry("g1", "A")])})
    runner.run()
    before = runner.store.load("s1")[0]

    runner._feeds["s1"] = make_feed([])
    result = runner.run()[0]
    assert result.error and "取得失敗" in result.error
    assert runner.store.load("s1")[0] == before


def test_http_error_is_reported(cfg, tmp_path):
    s = spec()
    runner = Runner(cfg, tmp_path, [s], {"s1": make_feed([entry("g", "A")], status=503)})
    result = runner.run()[0]
    assert result.error and "503" in result.error


def test_fetch_exception_does_not_crash(cfg, tmp_path, monkeypatch):
    s = spec()
    runner = Runner(cfg, tmp_path, [s], {})

    def boom(_source):
        raise OSError("ネットワークが死んだ")

    monkeypatch.setattr(runner, "fetch", boom)
    result = runner.run()[0]
    assert result.error and "ネットワーク" in result.error


def test_corrupt_state_raises_instead_of_resetting(tmp_path):
    """🔴 壊れた既読ファイルを初回扱いにしない（既読が消えて全件投稿になる）。"""
    path = tmp_path / "feed_state.json"
    path.write_text("{壊れたJSON", encoding="utf-8")
    with pytest.raises(RuntimeError, match="読めない"):
        ff.SeenStore(path).load("s1")


def test_failed_post_is_not_marked_as_seen(cfg, tmp_path):
    """🔴 送れなかったものは既読にしない。次回もう一度出す。"""
    s = spec()
    runner = Runner(cfg, tmp_path, [s], {"s1": make_feed([entry("g0", "seed")])})
    runner.run()
    runner._feeds["s1"] = make_feed([entry("g0", "seed"), entry("g1", "送れない記事")])

    runner.notifier = FakeNotifier(ok=False)
    result = runner.run()[0]
    assert result.posted == []
    assert "g1" not in runner.store.load("s1")[0]

    runner.notifier = FakeNotifier(ok=True)
    assert [a.title for a in runner.run()[0].posted] == ["送れない記事"]


def test_failed_digest_is_not_marked_as_seen(cfg, tmp_path):
    s = spec("poitan", "deals", "digest")
    runner = Runner(cfg, tmp_path, [s], {"poitan": make_feed([entry("g0", "seed")])})
    runner.run()
    runner._feeds["poitan"] = make_feed([entry("g0", "seed"), entry("g1", "お得")])

    runner.notifier = FakeNotifier(ok=False)
    result = runner.run()[0]
    assert result.posted == [] and result.error
    assert "g1" not in runner.store.load("poitan")[0]


def test_dry_run_posts_nothing_and_keeps_state(cfg, tmp_path):
    s = spec()
    runner = Runner(cfg, tmp_path, [s], {"s1": make_feed([entry("g1", "A")])})
    runner.run(dry_run=True)
    assert runner.store.load("s1")[1] is True      # まだ初回のまま
    assert runner.notifier.sent == []


def test_disabled_runner_does_nothing(cfg, tmp_path):
    runner = Runner(cfg, tmp_path, [spec()], {})
    runner.enabled = False
    assert runner.run() == []


def test_seen_list_is_capped(tmp_path):
    store = ff.SeenStore(tmp_path / "feed_state.json")
    store.save("s1", [f"g{i}" for i in range(ff.MAX_REMEMBERED + 50)])
    assert len(store.load("s1")[0]) == ff.MAX_REMEMBERED


def test_sources_keep_separate_state(cfg, tmp_path):
    """情報源ごとに既読を分けて持つ（片方の初回がもう片方を巻き込まない）。"""
    a, b = spec("a"), spec("b")
    runner = Runner(cfg, tmp_path, [a, b],
                    {"a": make_feed([entry("ga", "A")]), "b": make_feed([entry("gb", "B")])})
    runner.run()
    assert runner.store.load("a")[0] == ["ga"]
    assert runner.store.load("b")[0] == ["gb"]


# ------------------------------------------------------------------ 既読の引き継ぎ


def test_legacy_state_is_imported(tmp_path):
    """🔴 単一ソースだったころの既読を引き継ぐ（でないと25件が再投稿される）。"""
    legacy = tmp_path / "note_feed_state.json"
    legacy.write_text(json.dumps({"seen": ["g1", "g2", "g3"]}), encoding="utf-8")

    store = ff.SeenStore(tmp_path / "feed_state.json", legacy_path=legacy)
    seen, first_run = store.load("note_pointlab")
    assert seen == ["g1", "g2", "g3"]
    assert first_run is False                      # 初回扱いにならない
    # 別の情報源は初回のまま
    assert store.load("poitan")[1] is True


def test_legacy_import_is_skipped_when_state_exists(tmp_path):
    legacy = tmp_path / "note_feed_state.json"
    legacy.write_text(json.dumps({"seen": ["old"]}), encoding="utf-8")
    current = tmp_path / "feed_state.json"
    current.write_text(json.dumps({"sources": {"note_pointlab": {"seen": ["new"]}}}),
                       encoding="utf-8")

    store = ff.SeenStore(current, legacy_path=legacy)
    assert store.load("note_pointlab")[0] == ["new"]


# ------------------------------------------------------------------ 設定


def test_real_config_sources_are_wired(cfg):
    """本物の config.yaml の情報源が SourceSpec に落ちること。"""
    runner = ff.FeedRunner(cfg)
    keys = {s.key for s in runner.specs}
    assert {"note_pointlab", "poitan", "kochalog"} <= keys
    by_key = {s.key: s for s in runner.specs}
    # 🔴 流量の多いポイ探はカード＋一覧、低頻度の note は1件ずつ
    assert by_key["poitan"].style == "cards"
    assert by_key["poitan"].card_limit >= 1
    assert by_key["kochalog"].channel == by_key["poitan"].channel   # 同じチャンネルに合流
    assert by_key["note_pointlab"].style == "per_item"
    # トレードの4チャンネルには絶対に流れない
    assert {s.channel for s in runner.specs}.isdisjoint(
        {"decisions", "fills", "performance", "errors"})


# ------------------------------------------------------------------ カード（style: cards）


def ts(y, m, d, hh=0, mm=0):
    return (y, m, d, hh, mm, 0, 0, 0, 0)


def article(key, title, *, when=None, image="", summary="", cats=(), source_name=""):
    return ff.Article(
        guid=f"{key}:{title}", title=title, link=f"https://{key}/{title}",
        categories=list(cats), source_key=key, source_name=source_name or key,
        image=image, summary=summary, published_ts=when,
        published=str(when or ""),
    )


def deals_specs():
    return {
        "poitan": spec("poitan", "deals", "cards", emoji="🎁", label="今日のお得",
                       name="ポイ探ニュース", card_limit=5),
        "kochalog": spec("kochalog", "deals", "cards", emoji="🎁", label="今日のお得",
                         name="こちゃログ", card_limit=5),
    }


def test_cards_put_top_items_as_embeds_and_rest_as_a_list():
    """上位はカード、残りは一覧行（DISCORD.md 4章の静かさと両立させる）。"""
    arts = [article("poitan", f"お得{i}", when=ts(2026, 9, 19, 9, i),
                    image=f"https://img/{i}.jpg", summary="説明", cats=["キャンペーン"],
                    source_name="ポイ探ニュース") for i in range(9)]
    embeds = ff.build_cards(arts, deals_specs(), dt.date(2026, 9, 19))
    # 見出し1 + カード5 + 残り一覧1
    assert len(embeds) == 7
    assert embeds[0].to_payload()["title"] == "🎁 今日のお得 9/19（9件）"
    assert embeds[-1].title == "そのほか（4件）"


def test_card_has_thumbnail_clickable_title_and_footer():
    a = article("poitan", "楽天カード1万ポイント", when=ts(2026, 9, 19),
                image="https://img/rakuten.jpg", summary="楽天マジ得フェスティバル開催",
                cats=["キャンペーン", "楽天カード"], source_name="ポイ探ニュース")
    a.creator = "ポイ探ニュース編集部"
    payload = a.card(0xAECBEB).to_payload()
    assert payload["title"] == "楽天カード1万ポイント"
    assert payload["url"] == a.link                       # 見出しがリンクになる
    assert payload["thumbnail"]["url"] == "https://img/rakuten.jpg"
    assert "楽天マジ得" in payload["description"]
    assert "ポイ探ニュース" in payload["footer"]["text"]
    assert "by ポイ探ニュース編集部" in payload["footer"]["text"]
    assert "キャンペーン／楽天カード" in payload["footer"]["text"]


def test_card_without_image_is_still_valid():
    """🔴 サムネが無いときに画像をでっち上げない。"""
    payload = article("k", "画像なし", when=ts(2026, 9, 19)).card(0x111111).to_payload()
    assert "thumbnail" not in payload


def test_cards_are_ordered_by_publish_time_across_sources():
    """🔴 情報源ごとに固めて並べない。今日の記事が一覧に落ちてしまう。"""
    arts = [
        article("poitan", "朝のお得", when=ts(2026, 9, 19, 11), source_name="ポイ探ニュース"),
        article("poitan", "昨日のお得", when=ts(2026, 9, 18, 9), source_name="ポイ探ニュース"),
        article("kochalog", "深夜の攻略", when=ts(2026, 9, 19, 10), source_name="こちゃログ"),
    ]
    specs_ = deals_specs()
    specs_["poitan"].card_limit = 2
    specs_["kochalog"].card_limit = 2
    embeds = ff.build_cards(arts, specs_, dt.date(2026, 9, 19))
    assert [e.title for e in embeds[1:3]] == ["朝のお得", "深夜の攻略"]
    assert embeds[-1].title == "そのほか（1件）"


def test_articles_without_timestamp_go_last():
    arts = [
        article("poitan", "時刻なし", when=None, source_name="ポイ探ニュース"),
        article("poitan", "時刻あり", when=ts(2026, 9, 10), source_name="ポイ探ニュース"),
    ]
    assert [a.title for a in ff.sort_newest_first(arts)] == ["時刻あり", "時刻なし"]


def test_listing_splits_fields_over_1024_chars():
    """🔴 1フィールドは1024字まで。超えると黙って切れるので分割する。"""
    arts = [article("poitan", f"とても長いタイトルの記事{i}" * 3, when=ts(2026, 9, 19, 9, i),
                    cats=["キャンペーン", "クレジットカード（クレカ）"],
                    source_name="ポイ探ニュース") for i in range(25)]
    embeds = ff.build_cards(arts, deals_specs(), dt.date(2026, 9, 19))
    tail = embeds[-1].to_payload()
    assert len(tail["fields"]) > 1                        # 分割されている
    assert all(len(f["value"]) <= 1024 for f in tail["fields"])
    assert any("つづき" in f["name"] for f in tail["fields"])


def test_cards_stay_within_ten_embeds():
    """Discord は1メッセージ embed 10個まで。card_limit を大きくしても超えない。"""
    specs_ = deals_specs()
    specs_["poitan"].card_limit = 50
    arts = [article("poitan", f"a{i}", when=ts(2026, 9, 19, 9, i),
                    source_name="ポイ探ニュース") for i in range(30)]
    embeds = ff.build_cards(arts, specs_, dt.date(2026, 9, 19))
    assert len(embeds) <= 10
    assert len(embeds) == 1 + ff.MAX_CARDS + 1


def test_no_rest_means_no_tail_embed():
    arts = [article("poitan", f"a{i}", when=ts(2026, 9, 19, 9, i),
                    source_name="ポイ探ニュース") for i in range(3)]
    embeds = ff.build_cards(arts, deals_specs(), dt.date(2026, 9, 19))
    assert len(embeds) == 4                               # 見出し + カード3、一覧なし


# ------------------------------------------------------------------ 画像・要約の抽出


def test_extract_image_prefers_media_thumbnail():
    """note は media_thumbnail に入っている。"""
    e = {"media_thumbnail": [{"url": "https://assets.st-note.com/x.png"}],
         "summary": '<img src="https://other/y.png">'}
    assert ff.extract_image(e) == "https://assets.st-note.com/x.png"


def test_extract_image_falls_back_to_first_img_in_body():
    """ポイ探・こちゃログ（WordPress）は本文の先頭の img。"""
    e = {"summary": 'あ<img src="https://www.poitan.jp/wp-content/a.jpg" />い'}
    assert ff.extract_image(e) == "https://www.poitan.jp/wp-content/a.jpg"


def test_extract_image_returns_empty_when_none():
    assert ff.extract_image({"summary": "画像なし"}) == ""


def test_extract_summary_strips_html_and_boilerplate():
    e = {"summary": "<p>楽天カードと楽天モバイルは&hellip;開催する。</p> Copyright &copy; 2026 ポイ探"}
    text = ff.extract_summary(e)
    assert "<p>" not in text
    assert "Copyright" not in text
    assert "楽天カード" in text


def test_extract_summary_unescapes_entities():
    assert "…" in ff.extract_summary({"summary": "続き&hellip;あり"})


def test_parse_entries_fills_image_and_summary():
    feed = make_feed([{
        "id": "g", "link": "https://x", "title": "t",
        "summary": '<img src="https://img/a.jpg">本文テキスト',
        "tags": [], "published_parsed": ts(2026, 9, 19),
    }])
    a = ff.parse_entries(feed, spec())[0]
    assert a.image == "https://img/a.jpg"
    assert "本文テキスト" in a.summary
    assert a.published_ts == ts(2026, 9, 19)


# ------------------------------------------------------------------ 1日1記事（drop_rest）


def one_card_specs():
    s = deals_specs()
    for spec_ in s.values():
        spec_.card_limit = 1
        spec_.drop_rest = True
    return s


def test_one_card_mode_shows_only_the_newest():
    arts = [article("poitan", f"お得{i}", when=ts(2026, 9, 19, 9, i),
                    source_name="ポイ探ニュース") for i in range(10)]
    shown = ff.sort_newest_first(arts)[:1]
    embeds = ff.build_cards(shown, one_card_specs(), dt.date(2026, 9, 19),
                            total=len(arts), drop_rest=True)
    assert len(embeds) == 2                       # 見出し + カード1（一覧なし）
    assert embeds[1].title == "お得9"             # いちばん新しい


def test_one_card_mode_states_how_many_were_dropped():
    """🔴 捨てた件数を隠さない。「今日は1件だけだった」と誤解させない。"""
    arts = [article("poitan", f"a{i}", when=ts(2026, 9, 19, 9, i),
                    source_name="ポイ探ニュース") for i in range(10)]
    head = ff.build_cards(ff.sort_newest_first(arts)[:1], one_card_specs(),
                          dt.date(2026, 9, 19), total=10, drop_rest=True)[0]
    assert "新着10件" in head.description
    assert "1件" in head.description
    assert "（10件）" not in head.title            # 見出しは静かに


def test_one_card_mode_with_a_single_article():
    arts = [article("poitan", "ひとつだけ", when=ts(2026, 9, 19), source_name="ポイ探ニュース")]
    head = ff.build_cards(arts, one_card_specs(), dt.date(2026, 9, 19),
                          total=1, drop_rest=True)[0]
    assert head.description == "新着1件。"


def test_drop_rest_marks_everything_as_seen(cfg, tmp_path):
    """🔴 捨てたぶんも既読にする。持ち越すと毎日積み上がって永久に追いつかない。"""
    s = spec("poitan", "deals", "cards", card_limit=1, drop_rest=True,
             name="ポイ探ニュース", emoji="🎁", label="今日のお得")
    seed = make_feed([entry("g0", "seed", ts=ts(2026, 9, 10))])
    runner = Runner(cfg, tmp_path, [s], {"poitan": seed})
    runner.run()                                   # 初回で既読化

    runner._feeds["poitan"] = make_feed([
        entry("g0", "seed", ts=ts(2026, 9, 10)),
        entry("g1", "古い", ts=ts(2026, 9, 19, 9)),
        entry("g2", "新しい", ts=ts(2026, 9, 19, 11)),
        entry("g3", "まんなか", ts=ts(2026, 9, 19, 10)),
    ])
    result = runner.run()[0]
    assert [a.title for a in result.posted] == ["新しい"]
    assert result.dropped == 2
    # 捨てた2件も既読に入っている＝次回に出てこない
    assert set(runner.store.load("poitan")[0]) == {"g0", "g1", "g2", "g3"}
    assert runner.run()[0].posted == []


def test_drop_rest_keeps_everything_unseen_when_post_fails(cfg, tmp_path):
    """送信に失敗したら、捨てるぶんも含めて既読にしない。"""
    s = spec("poitan", "deals", "cards", card_limit=1, drop_rest=True,
             name="ポイ探ニュース", emoji="🎁", label="今日のお得")
    runner = Runner(cfg, tmp_path, [s],
                    {"poitan": make_feed([entry("g0", "seed", ts=ts(2026, 9, 10))])})
    runner.run()
    runner._feeds["poitan"] = make_feed([
        entry("g0", "seed", ts=ts(2026, 9, 10)),
        entry("g1", "A", ts=ts(2026, 9, 19, 9)),
        entry("g2", "B", ts=ts(2026, 9, 19, 10)),
    ])
    runner.notifier = FakeNotifier(ok=False)
    result = runner.run()[0]
    assert result.posted == [] and result.error
    assert set(runner.store.load("poitan")[0]) == {"g0"}


def test_dropped_count_appears_in_summary():
    r = ff.SourceResult(key="poitan", name="ポイ探ニュース",
                        posted=[article("poitan", "a")], dropped=9)
    assert "1件を投稿" in r.summary() and "9件は既読にして流さず" in r.summary()


def test_dropped_only_is_not_reported_as_no_news():
    """🔴 新着はあったが流さなかった、を「新着なし」と言わない。"""
    r = ff.SourceResult(key="kochalog", name="こちゃログ", posted=[], dropped=1)
    assert "新着なし" not in r.summary()
    assert "1件は既読にして流さず" in r.summary()


def test_truly_no_news_says_so():
    assert "新着なし" in ff.SourceResult(key="k", name="こちゃログ").summary()


def test_one_card_mode_picks_across_sources(cfg, tmp_path):
    """ポイ探とこちゃログを合わせて、いちばん新しい1件だけ出す。"""
    poitan = spec("poitan", "deals", "cards", card_limit=1, drop_rest=True,
                  name="ポイ探ニュース", emoji="🎁", label="今日のお得")
    kocha = spec("kochalog", "deals", "cards", card_limit=1, drop_rest=True,
                 name="こちゃログ", emoji="🎁", label="今日のお得")
    runner = Runner(cfg, tmp_path, [poitan, kocha], {
        "poitan": make_feed([entry("p0", "seed", ts=ts(2026, 9, 10))]),
        "kochalog": make_feed([entry("k0", "seed", ts=ts(2026, 9, 10))]),
    })
    runner.run()

    runner._feeds["poitan"] = make_feed([
        entry("p0", "seed", ts=ts(2026, 9, 10)),
        entry("p1", "ポイ探の朝", ts=ts(2026, 9, 19, 9)),
    ])
    runner._feeds["kochalog"] = make_feed([
        entry("k0", "seed", ts=ts(2026, 9, 10)),
        entry("k1", "こちゃログの昼", ts=ts(2026, 9, 19, 12)),
    ])
    results = {r.key: r for r in runner.run()}
    assert [a.title for a in results["kochalog"].posted] == ["こちゃログの昼"]
    assert results["poitan"].posted == []
    assert results["poitan"].dropped == 1
    # 送られたのは1メッセージだけ
    assert len(runner.notifier.embeds) == 1


def test_note_posts_everything(cfg):
    """🔴 note は全件通知（運用者の指示）。max_per_run で止まらない。"""
    runner = ff.FeedRunner(cfg)
    note = next(s for s in runner.specs if s.key == "note_pointlab")
    assert note.style == "per_item"
    assert note.drop_rest is False
    assert note.max_per_run >= 25      # フィードの件数より大きい
