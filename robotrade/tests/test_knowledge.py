"""専門ごとの「これまでに分かったこと」（robotrade/learning/knowledge.py）。

🔴 ここが緩むと、貯めた知識が**検証に使えなくなる**。固定するのは3つ:
  1. `learned_at` より前の日を再生するとき、その知識を使わない（先読み）
  2. 人が承認するまで使わない（AIに判断材料を勝手に増やさせない）
  3. 件数の上限とオフの口（優位の比較は「あり／なし」でしか測れない）
"""

from __future__ import annotations

import datetime as dt
import sqlite3

import pytest

from robotrade.learning import knowledge as km
from robotrade.portfolio.store import SCHEMA


@pytest.fixture
def store():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return km.KnowledgeStore(conn)


def a_item(**kw):
    base = dict(agent="chart", condition="レンジで買われすぎ", finding="勝率が低かった",
                sample_n=12, win_rate=0.25, learned_at="2026-09-10")
    base.update(kw)
    return km.Knowledge(**base)


# ---------------------------------------------------------------- 先読み


def test_knowledge_is_not_used_before_it_was_learned(store):
    """🔴 9月に分かったことで5月を判断しない（嘘の検証結果になる）。"""
    ident = store.add(a_item(learned_at="2026-09-10"))
    store.approve(ident, on=dt.date(2026, 9, 10))

    assert store.active_for("chart", as_of=dt.date(2026, 9, 10), limit=8)   # 当日は使う
    assert store.active_for("chart", as_of=dt.date(2026, 9, 11), limit=8)   # 以降も使う
    assert store.active_for("chart", as_of=dt.date(2026, 9, 9), limit=8) == []  # 前日は使わない


def test_retired_knowledge_is_still_used_before_it_was_retired(store):
    """撤回した知識も、撤回**前**の日の再生では使われていたので、そう再現する。"""
    ident = store.add(a_item(learned_at="2026-05-01"))
    store.approve(ident, on=dt.date(2026, 5, 1))
    store.retire(ident, on=dt.date(2026, 8, 1), note="効かなくなった")

    assert store.active_for("chart", as_of=dt.date(2026, 7, 31), limit=8)     # まだ使っていた
    assert store.active_for("chart", as_of=dt.date(2026, 8, 1), limit=8) == []  # 外した日から使わない


# ---------------------------------------------------------------- 承認


def test_draft_is_not_used_until_a_person_approves(store):
    """🔴 AI に自分の判断材料を勝手に増やさせない。"""
    store.add(a_item())
    assert store.active_for("chart", as_of=dt.date(2026, 9, 30), limit=8) == []


def test_unknown_agent_is_rejected(store):
    """打ち間違いを黙って通さない（誰にも届かない知識ができてしまう）。"""
    with pytest.raises(ValueError):
        store.add(a_item(agent="chat"))


# ---------------------------------------------------------------- 取り出し


def test_limit_caps_the_number(store):
    for i in range(12):
        ident = store.add(a_item(condition=f"条件{i}", learned_at="2026-09-10"))
        store.approve(ident, on=dt.date(2026, 9, 10))
    got = store.active_for("chart", as_of=dt.date(2026, 9, 30), limit=5)
    assert len(got) == 5


def test_agents_do_not_see_each_others_knowledge(store):
    ident = store.add(a_item(agent="supply_demand"))
    store.approve(ident, on=dt.date(2026, 9, 10))
    assert store.active_for("chart", as_of=dt.date(2026, 9, 30), limit=8) == []
    assert store.active_for("supply_demand", as_of=dt.date(2026, 9, 30), limit=8)


# ---------------------------------------------------------------- 文面


def test_block_shows_sample_size():
    """🔴 件数を必ず添える。弱い所見を強い根拠として読ませない。"""
    text = km.block_for([a_item(sample_n=12, win_rate=0.25)])
    assert "12件" in text and "25%" in text
    assert "規則ではなく" in text            # 規則として読ませない
    assert "目の前のデータを優先" in text


def test_block_without_win_rate():
    text = km.block_for([a_item(win_rate=None)])
    assert "（12件）" in text


def test_empty_knowledge_adds_nothing():
    """🔵 空の見出しを出さない（何も分かっていないのに枠だけ出さない）。"""
    assert km.block_for([]) == ""


# ---------------------------------------------------------------- 丸ごとオフ


def test_disabled_config_returns_none(cfg, monkeypatch):
    """🔴 「あり／なし」で比べられないと、優位かどうかを測れない。"""
    raw = dict(cfg.raw.get("knowledge", {}))
    cfg.raw["knowledge"] = {**raw, "enabled": False}
    try:
        class FakeStore:
            conn = None
        assert km.from_config(cfg, FakeStore()) is None
    finally:
        cfg.raw["knowledge"] = raw


def test_lookup_ignores_unknown_agent(store):
    lookup = km.KnowledgeLookup(store, limit=8)
    assert lookup.block("chat", as_of=dt.date(2026, 9, 30)) == ""
