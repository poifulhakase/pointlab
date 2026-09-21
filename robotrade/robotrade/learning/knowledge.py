"""専門ごとの「これまでに分かったこと」（SPEC 8.1 の拡張・2026-09-20）。

SPEC 8.1 のフィードバックループは**売買判断AIにだけ**直近実績の要約を渡す。
こちらはその拡張で、**チャート/需給/ニュース/選定の各AIにも、自分の分野の所見を貯める**。
LLM の重みは変えない（in-context learning）。プロンプトに数行足すだけ。

材料はすでに貯まっている:
  `analyses`（毎日・銘柄ごと・AIごとの読み）× `trades`（手仕舞いの結果）
  → 「どの読みをしたとき、どうなったか」が出せる。

────────────────────────────────────────────────────────────────
🔴 守ること（ここを外すと、貯めた知識が検証に使えなくなる）

1. **`learned_at` を必ず持つ**。過去日を再生するときは**その日以前に分かっていたもの**だけを
   使う。9月に得た知識で5月を判断すると「優位だった」という嘘の結果が出る（先読み）。
   決算予定日・翌寄り約定と同じ構造の事故。

2. **自動で有効にしない**。`draft` で入れ、人が承認して `active` になる。
   AI に自分の判断材料を勝手に増やさせない（納品エラー自動解除の事故と同じ線）。

3. **「条件 → 結果」の形に限る**。銘柄固有の記憶（「6986はこう動く」）は貯めない。
   数が集まらず、相場が変わると害になる。

4. **件数に上限を置く**（`knowledge.max_per_agent`）。増え続けるとトークンが増え、
   長いプロンプトは指示が薄まる。効かなくなったものは `retired` にして落とす。

5. **まるごとオフにできる**（`knowledge.enabled`）。
   優位かどうかは「あり／なし」を**同じ日・同じ候補**で走らせて比べるしかない。
   全体の勝率比較では、知識が効いたのか相場が良かったのか分からない。

🔵 いまは約定0件。優位の判定は最低30件（SPEC 8.3）＝数ヶ月先。
   それでも器を先に作るのは、**あとから作ると `learned_at` が無く、
   貯めた知識が検証に使えなくなる**ため。
"""

from __future__ import annotations

import datetime as dt
import json
import logging
from dataclasses import dataclass
from typing import Any

log = logging.getLogger(__name__)

# 知識を持てるエージェント。🔴 ここに無い名前は受け付けない（打ち間違いを黙って通さない）
AGENTS = ("chart", "supply_demand", "news", "selector", "decider")

DRAFT, ACTIVE, RETIRED = "draft", "active", "retired"
STATUSES = (DRAFT, ACTIVE, RETIRED)


@dataclass
class Knowledge:
    agent: str
    condition: str
    finding: str
    sample_n: int
    learned_at: str
    status: str = DRAFT
    win_rate: float | None = None
    source_trades: list[int] | None = None
    note: str = ""
    id: int | None = None

    def line(self) -> str:
        """プロンプトに載せる1行。根拠の件数を必ず添える（弱い所見を強く読ませない）。"""
        base = f"{self.condition} → {self.finding}"
        if self.win_rate is None:
            return f"{base}（{self.sample_n}件）"
        return f"{base}（{self.sample_n}件・勝率{self.win_rate * 100:.0f}%）"


class KnowledgeStore:
    """`knowledge` テーブルの読み書き。"""

    def __init__(self, conn):
        self.conn = conn

    # -------------------------------------------------- 書く

    def add(self, item: Knowledge) -> int:
        """候補として入れる。🔴 status は呼び出し側が draft のまま渡すのが既定。"""
        if item.agent not in AGENTS:
            raise ValueError(f"知らないエージェント: {item.agent}（{AGENTS}）")
        if item.status not in STATUSES:
            raise ValueError(f"知らない status: {item.status}")
        cur = self.conn.execute(
            "INSERT INTO knowledge(agent, condition, finding, sample_n, win_rate,"
            " source_trades, learned_at, status, note) VALUES(?,?,?,?,?,?,?,?,?)",
            (item.agent, item.condition, item.finding, int(item.sample_n),
             item.win_rate,
             json.dumps(item.source_trades or [], ensure_ascii=False),
             item.learned_at, item.status, item.note),
        )
        self.conn.commit()
        return int(cur.lastrowid)

    def approve(self, knowledge_id: int, *, on: dt.date | None = None) -> None:
        """人が承認して有効にする。🔴 コードから自動で呼ばない。"""
        day = (on or dt.date.today()).isoformat()
        self.conn.execute(
            "UPDATE knowledge SET status=?, approved_at=? WHERE id=?",
            (ACTIVE, day, knowledge_id))
        self.conn.commit()

    def retire(self, knowledge_id: int, *, on: dt.date | None = None,
               note: str = "") -> None:
        """効かなくなったものを落とす。**消さない**（いつ外したかを残す）。"""
        day = (on or dt.date.today()).isoformat()
        self.conn.execute(
            "UPDATE knowledge SET status=?, retired_at=?, note=COALESCE(note,'')||? "
            "WHERE id=?",
            (RETIRED, day, f" / 撤回({day}): {note}" if note else "", knowledge_id))
        self.conn.commit()

    # -------------------------------------------------- 読む

    def active_for(self, agent: str, *, as_of: dt.date, limit: int) -> list[Knowledge]:
        """その日に**使っていた**知識（新しい順）。

        🔴 判定は **status ではなく日付**でやる。status は「今どうなっているか」しか
           表さないので、過去日の再生に使うと事実と違う結果になる。
           今日 retire したものは、**retire 前の日には使っていた**のだから、
           その日を再生するときは入っていないとおかしい。
        🔴 3つの条件で切る（どれも先読み・後知恵を防ぐためにある）:
             learned_at   <= as_of  … その日にはまだ分かっていなかったことを使わない
             approved_at  <= as_of  … 人が承認する前の候補を使わない
             retired_at    > as_of  … 外したあとの日では使わない
        """
        day = as_of.isoformat()
        rows = self.conn.execute(
            "SELECT * FROM knowledge WHERE agent=?"
            " AND learned_at<=?"
            " AND approved_at IS NOT NULL AND approved_at<=?"
            " AND (retired_at IS NULL OR retired_at > ?)"
            " ORDER BY learned_at DESC, id DESC LIMIT ?",
            (agent, day, day, day, int(limit)),
        ).fetchall()
        return [_from_row(r) for r in rows]

    def all_for(self, agent: str | None = None,
                status: str | None = None) -> list[Knowledge]:
        """一覧（承認待ちを人が見るため）。"""
        sql = "SELECT * FROM knowledge WHERE 1=1"
        args: list[Any] = []
        if agent:
            sql += " AND agent=?"
            args.append(agent)
        if status:
            sql += " AND status=?"
            args.append(status)
        sql += " ORDER BY agent, learned_at DESC, id DESC"
        return [_from_row(r) for r in self.conn.execute(sql, args).fetchall()]


def _from_row(row: Any) -> Knowledge:
    raw = row["source_trades"]
    try:
        trades = json.loads(raw) if raw else []
    except Exception:  # noqa: BLE001
        trades = []
    return Knowledge(
        id=row["id"], agent=row["agent"], condition=row["condition"],
        finding=row["finding"], sample_n=row["sample_n"], win_rate=row["win_rate"],
        source_trades=trades, learned_at=row["learned_at"], status=row["status"],
        note=row["note"] or "",
    )


# ---------------------------------------------------------------- プロンプトに差し込む


def block_for(items: list[Knowledge]) -> str:
    """プロンプトに載せる塊。無ければ空文字（空の見出しを出さない）。

    🔴 「これまでに分かったこと」であって**規則ではない**と明記する。
       規則として読ませると、相場が変わったときに外せなくなる。
    """
    if not items:
        return ""
    lines = [
        "## これまでに分かったこと（この装置自身の過去の結果から）",
        "🔵 規則ではなく**傾向の記録**です。件数が少ないものは弱い手がかりとして扱い、",
        "   目の前のデータと食い違うときは目の前のデータを優先してください。",
        "",
    ]
    lines += [f"- {k.line()}" for k in items]
    return "\n".join(lines)


def from_config(cfg, store) -> "KnowledgeLookup | None":
    """config が off なら None（＝プロンプトに何も足さない）。"""
    if not cfg.get("knowledge.enabled", False):
        return None
    return KnowledgeLookup(
        KnowledgeStore(store.conn),
        limit=int(cfg.get("knowledge.max_per_agent", 8)),
    )


class KnowledgeLookup:
    """エージェントから使う入口。日付を渡して、その日に使える塊を返すだけ。"""

    def __init__(self, store: KnowledgeStore, *, limit: int):
        self.store = store
        self.limit = limit

    def block(self, agent: str, *, as_of: dt.date) -> str:
        if agent not in AGENTS:
            return ""
        return block_for(self.store.active_for(agent, as_of=as_of, limit=self.limit))
