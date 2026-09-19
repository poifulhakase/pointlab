"""歓迎の文面と記録のテスト（WELCOME_BOT.md）。

Discord には繋がない。見るのは**事故を防ぐための決め**が効いているか:
  - 表示名をそのまま埋めない（@everyone・Markdown・改行）
  - Bot を入れた瞬間に既存メンバー全員へ飛ばさない
  - 二重に歓迎しない
  - 落ちていた間の参加を拾うが、古参まで拾わない
"""

from __future__ import annotations

import datetime as dt
import json
import random
from dataclasses import dataclass

import pytest

from welcomebot import greeting as g


# ------------------------------------------------------------------ 足場


@dataclass
class FakeMember:
    id: int
    display_name: str = "だれか"
    bot: bool = False
    joined_at: dt.datetime | None = None


def days_ago(n: int) -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=n)


@pytest.fixture
def store(tmp_path):
    return g.WelcomedStore(tmp_path / "welcomed.json")


# ------------------------------------------------------------------ 表示名


def test_name_is_inserted():
    text = g.build_greeting("ムサシ", rng=random.Random(0))
    assert "ムサシ 君" in text or "ムサシ" in text


def test_mention_is_blocked_in_the_name():
    """🔴 表示名に @everyone を入れられて全員に通知が飛ぶのを防ぐ。"""
    assert "@" not in g.safe_name("@everyone")
    assert "＠everyone" == g.safe_name("@everyone")
    assert "@" not in g.build_greeting("@here")


def test_markdown_in_the_name_is_stripped():
    """口上が崩れないよう記号を落とす。"""
    assert g.safe_name("**太字**") == "太字"
    assert g.safe_name("~~消し~~") == "消し"
    assert g.safe_name("||伏字||") == "伏字"
    assert g.safe_name("`コード`") == "コード"


def test_newlines_in_the_name_are_flattened():
    assert g.safe_name("あ\nい\r\nう") == "あ い う"


def test_long_name_is_cut():
    assert len(g.safe_name("あ" * 100)) == g.MAX_NAME


def test_empty_name_gets_a_fallback():
    assert g.safe_name("") == "名無しの研究員"
    assert g.safe_name(None) == "名無しの研究員"
    assert g.safe_name("***") == "名無しの研究員"


# ------------------------------------------------------------------ 文面


def test_greeting_is_in_the_doctors_voice():
    text = g.build_greeting("ノラ", rng=random.Random(1))
    assert "ぽいふる博士" in text or "博士" in text
    assert "さらばじゃ" in text
    assert "ぽいんとらぼ" in text


def test_greeting_asks_for_a_self_introduction():
    for template in g.GREETINGS:
        text = template.format(name="X")
        assert "ニックネーム" in text
        assert "興味のある分野" in text
        assert "やぁ諸君！" in text          # 自己紹介するチャンネルを名指しする


def test_greeting_is_the_one_the_operator_wrote():
    """🔴 文面は運用者が決めたもの。勝手に言い回しを足さない。"""
    text = g.build_greeting("ムサシ")
    assert text.startswith("やあ、ムサシ 君。ぽいふる博士だ。")
    assert "まずは「やぁ諸君！」で自己紹介から始めてくれたまえ。" in text
    assert text.endswith("ムサシ 君を歓迎するぞ。\nさらばじゃ！")


def test_name_appears_in_both_places():
    """名前は冒頭と結びの2か所に入る。"""
    assert g.build_greeting("ノラ").count("ノラ 君") == 2


def test_the_same_text_every_time_for_now():
    """いまは1種類なので毎回同じ（増やしたくなったら GREETINGS に足すだけ）。"""
    seen = {g.build_greeting("X", rng=random.Random(seed)) for seed in range(10)}
    assert len(seen) == 1


def test_mention_goes_first():
    text = g.build_greeting("X", mention="<@123>", rng=random.Random(0))
    assert text.startswith("<@123>\n")


# ------------------------------------------------------------------ 記録


def test_nobody_is_welcomed_twice(store):
    assert store.has_welcomed(1) is False
    store.mark(1, "ムサシ")
    assert store.has_welcomed(1) is True


def test_seed_marks_existing_members_without_greeting(store):
    """🔴 Bot を入れた瞬間に既存メンバー全員へ口上が飛ぶのを防ぐ。"""
    added = store.seed([1, 2, 3])
    assert added == 3
    assert all(store.has_welcomed(i) for i in (1, 2, 3))


def test_seed_is_idempotent(store):
    store.seed([1, 2])
    assert store.seed([1, 2, 3]) == 1


def test_is_new_only_before_the_first_write(store):
    assert store.is_new is True
    store.seed([1])
    assert store.is_new is False


def test_broken_record_raises_instead_of_resetting(tmp_path):
    """🔴 まっさらにしない。まっさらにすると全員を歓迎し直す。"""
    path = tmp_path / "welcomed.json"
    path.write_text("{壊れた", encoding="utf-8")
    with pytest.raises(RuntimeError, match="読めない"):
        g.WelcomedStore(path).has_welcomed(1)


def test_record_is_valid_json(store):
    store.mark(7, "ハル")
    data = json.loads(store.path.read_text(encoding="utf-8"))
    assert data["welcomed"]["7"]["name"] == "ハル"
    assert "at" in data["welcomed"]["7"]


# ------------------------------------------------------------------ 取りこぼしの拾い直し


def test_catch_up_picks_recent_unwelcomed(store):
    """🔴 Bot が落ちていた間の参加を拾う（PCは寝るし再起動もする）。"""
    members = [
        FakeMember(1, "きのう来た", joined_at=days_ago(1)),
        FakeMember(2, "歓迎済み", joined_at=days_ago(2)),
    ]
    store.mark(2, "歓迎済み")
    assert [m.id for m in g.catch_up_targets(members, store)] == [1]


def test_catch_up_ignores_old_members(store):
    """🔴 記録を消したときに古参まで歓迎しない。"""
    members = [FakeMember(1, "古参", joined_at=days_ago(90))]
    assert g.catch_up_targets(members, store) == []


def test_catch_up_window_is_configurable(store):
    members = [FakeMember(1, "20日前", joined_at=days_ago(20))]
    assert g.catch_up_targets(members, store) == []
    assert len(g.catch_up_targets(members, store, joined_within_days=30)) == 1


def test_catch_up_skips_bots(store):
    members = [FakeMember(1, "別のBot", bot=True, joined_at=days_ago(1))]
    assert g.catch_up_targets(members, store) == []


def test_catch_up_skips_members_without_join_time(store):
    """🔵 参加日時が取れない人は対象にしない（推測で歓迎しない）。"""
    members = [FakeMember(1, "不明", joined_at=None)]
    assert g.catch_up_targets(members, store) == []


# ------------------------------------------------------------------ dry-run


def test_dry_run_must_not_write_state():
    """🔴 回帰テスト（2026-09-19）。

    `--dry-run` のつもりで動かしたら初回シードが書き込まれ、**本番の初期化になっていた**。
    「試しに動かしただけ」が状態を変えてはいけない。
    bot.py の on_ready がシードの前に dry_run を見ることを、コードの並びで固定する。
    """
    from pathlib import Path

    source = Path(__file__).resolve().parent.parent / "bot.py"
    text = source.read_text(encoding="utf-8")
    body = text[text.index("if self.store.is_new:"):text.index("targets = catch_up_targets")]
    assert "if self.dry_run:" in body
    # dry_run の判定が seed の呼び出しより前にある
    assert body.index("if self.dry_run:") < body.index("self.store.seed(")
