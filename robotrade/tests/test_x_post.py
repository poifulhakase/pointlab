"""X への投稿（Buffer 経由）のテスト。

見るのは:
  - 🔴 ハッシュタグは**候補の中だけ**か（AIが作った語を混ぜない）
  - 🔴 280字に収まるか。削る順番は一言→タイトルで、URLと出典は消さない
  - 🔴 一言が無くても投稿が成立するか
  - 🔴 既読は Discord と**別に**持つか（同じだと X に1件も出ない）
  - Buffer の失敗を握り潰さないか
"""

from __future__ import annotations

import datetime as dt

import pytest

from robotrade.notify import buffer as bmod
from robotrade.notify import x_compose as xc

# 🔵 テストの中に生の改行を書くと読みにくいので、名前を付けて使う
NL = "\n"
LEAD = f"人生経験を棚卸しすれば、{NL}道も見えてくるかもしれんのう。"
THREE_LINES = NL.join(["1行目", "2行目", "3行目"])


# ---------------------------------------------------------------- 文面


def test_compose_full_shape():
    """🔴 @Aojiru_Hakase の実際の形（一人称・絵文字なし・書き手は｜で添える）。"""
    text = xc.compose(
        title="婚活カウンセラーを副業で始める方法",
        link="https://note.com/x/n/abc",
        creator="ムサシ",
        comment=LEAD,
        hashtags=["#副業", "#働き方"],
    )
    assert text.startswith(LEAD)
    assert "博士「" not in text            # 本人のアカウントなのでカギカッコで囲まない
    assert "📝" not in text                # 絵文字は付けない
    assert "婚活カウンセラーを副業で始める方法｜ムサシ" in text
    assert text.endswith("#副業 #働き方")


def test_compose_keeps_line_breaks():
    """🔴 改行を空白に潰さない（短い行に切って読ませる形が博士の投稿）。"""
    text = xc.compose(title="t", link="https://note.com/x", creator="",
                      comment=THREE_LINES, hashtags=[])
    assert text.startswith(THREE_LINES)


def test_compose_without_comment():
    """🔴 一言が作れなくても投稿は成立する（AIが落ちても止めない）。"""
    text = xc.compose(title="タイトル", link="https://note.com/x", creator="だれか",
                      comment="", hashtags=["#副業"])
    assert text.startswith("タイトル｜だれか")
    assert "https://note.com/x" in text


def test_long_post_drops_the_comment_first():
    """🔴 削る順番＝一言 → タイトル。URLと出典は消さない。"""
    text = xc.compose(
        title="あ" * 200, link="https://note.com/x/n/abc", creator="ムサシ",
        comment="い" * 60, hashtags=["#副業"],
    )
    assert xc._weigh(text, "https://note.com/x/n/abc") <= xc.MAX_CHARS
    assert "い" not in text                     # 一言が先に落ちる
    assert "https://note.com/x/n/abc" in text   # URLは残る
    assert "｜ムサシ" in text                   # 出典も残る


def test_very_long_title_is_truncated():
    link = "https://note.com/x/n/abc"
    text = xc.compose(title="あ" * 400, link=link, creator="ムサシ",
                      comment="", hashtags=["#副業"])
    assert xc._weigh(text, link) <= xc.MAX_CHARS
    assert "…" in text


def test_url_counts_as_23_chars():
    """X は URL を t.co の23文字として数える。長いURLで不必要に削らない。"""
    link = "https://note.com/" + "a" * 200
    assert xc._weigh(f"x {link}", link) == len("x ") + xc.URL_WEIGHT


# ---------------------------------------------------------------- ハッシュタグ


def test_hashtags_reject_values_outside_the_choices():
    """🔴 AI が作った語を混ぜない（候補の外は捨てる）。"""
    got = xc.pick_hashtags(["#副業図鑑", "#絶対に稼げる"], fixed=["#副業"],
                           choices=["#副業", "#副業図鑑"], limit=3)
    assert got == ["#副業", "#副業図鑑"]


def test_hashtags_keep_fixed_and_dedupe():
    got = xc.pick_hashtags(["#副業"], fixed=["#副業"], choices=["#副業"], limit=3)
    assert got == ["#副業"]


def test_hashtags_respect_the_limit():
    got = xc.pick_hashtags(["#b", "#c", "#d"], fixed=["#a"],
                           choices=["#b", "#c", "#d"], limit=2)
    assert got == ["#a", "#b"]


def test_comment_strips_tags_and_urls():
    """一言に混ざった飾りを落とす（プロンプトでも禁じているが二重に）。"""
    text = xc.compose(title="t", link="https://note.com/x", creator="",
                      comment="「よい記事だ #副業 https://example.com」", hashtags=[])
    assert text.startswith("よい記事だ" + NL)


# ---------------------------------------------------------------- Buffer


class FakeSession:
    def __init__(self, payload=None, status=200):
        self.payload = payload or {}
        self.status = status
        self.calls: list[dict] = []

    def post(self, url, headers=None, json=None, timeout=None):
        self.calls.append({"url": url, "json": json, "headers": headers})
        payload, status = self.payload, self.status

        class R:
            status_code = status

            def raise_for_status(self):
                if status >= 400:
                    raise RuntimeError(f"HTTP {status}")

            def json(self):
                return payload

        return R()


def test_create_post_schedules_at_the_given_time():
    session = FakeSession({"data": {"createPost": {
        "__typename": "PostActionSuccess", "post": {"id": "p1"}}}})
    client = bmod.BufferClient("key", session=session)
    when = dt.datetime(2027, 1, 1, 9, 0, tzinfo=dt.timezone.utc)
    assert client.create_post(channel_id="c1", text="やあ", due_at=when) == "p1"

    sent = session.calls[0]["json"]["variables"]["i"]
    assert sent["mode"] == "customScheduled"
    assert sent["dueAt"] == "2027-01-01T09:00:00.000Z"
    assert sent["schedulingType"] == "automatic"


def test_create_post_without_time_posts_now():
    session = FakeSession({"data": {"createPost": {
        "__typename": "PostActionSuccess", "post": {"id": "p1"}}}})
    bmod.BufferClient("key", session=session).create_post(channel_id="c1", text="やあ")
    assert session.calls[0]["json"]["variables"]["i"]["mode"] == "shareNow"


def test_buffer_errors_are_not_swallowed():
    """🔴 「送ったつもり」を作らない。"""
    session = FakeSession({"data": {"createPost": {
        "__typename": "LimitReachedError", "message": "queue full"}}})
    client = bmod.BufferClient("key", session=session)
    with pytest.raises(bmod.BufferError):
        client.create_post(channel_id="c1", text="やあ")


def test_expired_key_says_so():
    session = FakeSession({}, status=401)
    with pytest.raises(bmod.BufferError, match="API キーが無効"):
        bmod.BufferClient("key", session=session).call("{ account { id } }")


def test_no_key_means_disabled():
    """鍵が無いときは黙って何もしない（設定前でも日次バッチを壊さない）。"""
    assert bmod.BufferClient("").enabled is False


def test_naive_datetime_is_treated_as_local_not_utc():
    """🔴 タイムゾーンなしを UTC と決め打ちすると9時間ずれる。"""
    local = dt.datetime(2027, 1, 1, 9, 0)
    expected = local.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    assert bmod._to_iso_utc(local) == expected


# ---------------------------------------------------------------- 既読の分離


def test_sink_key_is_separate_from_discord(cfg):
    from robotrade.notify.feeds import FeedRunner

    runner = FeedRunner(cfg)
    spec = runner.specs[0]
    assert FeedRunner.sink_key(spec, "x") != spec.key
    assert FeedRunner.sink_key(spec, "x").endswith(spec.key)


# ---------------------------------------------------------------- 他人の記事を扱う


@pytest.mark.parametrize("word", ["稼げる", "儲かる", "必ず", "絶対", "おすすめ", "ぜひ"])
def test_assertive_comment_is_dropped(word):
    """🔴 運営者は**書き手ではない**。言い切りは書いていない人の言葉として広まる。

    プロンプトでも禁じているが、コードでも止める（AIの指示だけに頼らない）。
    """
    assert xc.is_safe(f"これは{word}ようだ") is False
    text = xc.compose(title="t", link="https://note.com/x", creator="ムサシ",
                      comment=f"これは{word}ようだ", hashtags=["#副業"])
    assert word not in text
    assert text.startswith("t｜ムサシ")     # 一言だけ落ちて、紹介は残る


def test_neutral_comment_survives():
    assert xc.is_safe("人生経験を棚卸しする話が書かれておる") is True


def test_no_fixed_hashtag_is_forced(cfg):
    """🔴 副業と無関係な記事にも #副業 を貼らない（運用者の指摘・2026-09-20）。

    固定タグという設定そのものを置いていない（`sns_post` に fixed が無い）。
    """
    assert "fixed" not in (cfg.get("sns_post", {}) or {})
    # AI が1つも選ばなければタグ無しで出る（無理に貼らない）
    assert xc.pick_hashtags([], fixed=[], choices=["#副業"], limit=3) == []


# ---------------------------------------------------------------- 鍵の期限


def test_missing_expiry_is_warned_not_ignored(cfg):
    """🔴 書かれていないこと自体を警告する（黙って「問題なし」にしない）。

    期限切れは黙った故障になる。投稿が止まっても理由がどこにも出ない
    （SP-API の鍵が180日で切れて定期処理が落ちたのと同じ壊れ方）。
    """
    raw = dict(cfg.raw.get("buffer", {}))
    cfg.raw["buffer"] = {**raw, "key_expires": ""}
    try:
        assert "書かれていない" in bmod.check_key_expiry(cfg)
    finally:
        cfg.raw["buffer"] = raw


@pytest.mark.parametrize("expires,today,expect", [
    ("2026-10-01", dt.date(2026, 9, 21), "あと10日"),      # 期限が近い
    ("2026-09-01", dt.date(2026, 9, 21), "切れている"),     # すでに切れた
    ("2027-09-20", dt.date(2026, 9, 21), ""),               # まだ先＝黙る
])
def test_expiry_warning(cfg, expires, today, expect):
    raw = dict(cfg.raw.get("buffer", {}))
    cfg.raw["buffer"] = {**raw, "key_expires": expires, "expiry_warn_days": 14}
    try:
        got = bmod.check_key_expiry(cfg, today=today)
        assert expect in got if expect else got == ""
    finally:
        cfg.raw["buffer"] = raw


def test_unreadable_expiry_is_reported(cfg):
    raw = dict(cfg.raw.get("buffer", {}))
    cfg.raw["buffer"] = {**raw, "key_expires": "来年くらい"}
    try:
        assert "読めない" in bmod.check_key_expiry(cfg)
    finally:
        cfg.raw["buffer"] = raw


# ---------------------------------------------------------------- 誤判定しないこと


@pytest.mark.parametrize("text", [
    "どこを見つめ直すべきかをめぐった話が届いた",   # 🔴 2026-09-21 に実際に誤判定した
    "見るべきはどこか、という視点の話らしい",
    "何を残すべきかを考える回じゃ",
])
def test_plain_verb_forms_are_not_blocked(text):
    """🔴 「べき」を単語で切ると、ふつうの問いかけまで巻き込む。

    「直すべきか」は推奨ではない。ここを弾くと博士の一言が丸ごと落ちる。
    """
    assert xc.is_safe(text) is True


@pytest.mark.parametrize("text", [
    "この副業はすべきだと思う",
    "やるべきだろう",
    "ぜひ読んでみてくれたまえ",
])
def test_recommendation_forms_are_blocked(text):
    """言い切っている推奨だけを弾く。"""
    assert xc.is_safe(text) is False


# ---------------------------------------------------------------- 書き手の表示名


def test_long_creator_is_shortened_but_kept():
    """🔴 note の表示名はプロフィール文のことがある。名前だけ残して詰める。

    そのまま載せると一言の余地を食い尽くす（X で 280/280 になった）。
    """
    got = xc.shorten_credit("ハル ｜基本フォロバ100 | note×AIで資産型コンテンツの作り方発信中")
    assert got == "ハル"


def test_short_creator_is_untouched():
    assert xc.shorten_credit("ムサシ@目指せ副収入!") == "ムサシ@目指せ副収入!"


def test_creator_is_never_dropped():
    """🔴 他人の記事なので、誰が書いたかは必ず残す。"""
    got = xc.shorten_credit("あ" * 40)
    assert got and got.endswith("…") and len(got) == xc.MAX_CREDIT


# ---------------------------------------------------------------- 宛先ごとの字数


def test_threads_counts_japanese_as_one():
    """🔴 X は日本語を2、Threads は1で数える。揃えると片方で壊れる。"""
    text = "あ" * 50
    assert xc._weigh(text, "", cjk_weight=xc.CJK_WEIGHT_X) == 100
    assert xc._weigh(text, "", cjk_weight=xc.CJK_WEIGHT_PLAIN) == 50


def test_compose_respects_the_target_limit():
    long_title = "あ" * 300
    link = "https://note.com/x/n/abc"
    for weight, limit in ((xc.CJK_WEIGHT_X, 280), (xc.CJK_WEIGHT_PLAIN, 500)):
        text = xc.compose(title=long_title, link=link, creator="ハル", comment="",
                          hashtags=["#note"], max_chars=limit, cjk_weight=weight)
        assert xc._weigh(text, link, cjk_weight=weight) <= limit
