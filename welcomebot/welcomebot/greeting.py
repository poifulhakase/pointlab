"""歓迎の文面と、誰を歓迎したかの記録（WELCOME_BOT.md）。

🔴 Discord に繋がない部分だけをここに置く。Bot を起動しなくてもテストできるようにするため。

文体は**ぽいふる博士**（〜じゃ / 諸君 / さらばじゃ！）で統一する。
"""

from __future__ import annotations

import datetime as dt
import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# 名前に使える長さ。Discord の表示名は32文字までだが、念のため切る。
MAX_NAME = 32

# 🔴 文面は設計書（WELCOME_BOT.md）のものを正とする。ここを直したら向こうも直す。
GREETINGS: list[str] = [
    """やあ諸君、{name} 君だな。ぽいふる博士だ。
ぽいんとらぼへようこそ！

諸君も今日から研究員のひとりじゃ。
まずは自己紹介から始めてくれたまえ。
・ニックネーム
・興味のある分野（ポイ活／副業／投資／その他）
・今ハマっていること、挑戦したいこと

助手のぽよん君、発明品のぽいロボと共に、諸君を歓迎する。さらばじゃ！""",
    """ほう、{name} 君か。よく来たな。ぽいふる博士じゃ。
ぽいんとらぼの扉は、今この瞬間から諸君にも開かれておる。

研究員としての最初の仕事は、自己紹介じゃ。
・ニックネーム
・興味のある分野（ポイ活／副業／投資／その他）
・今ハマっていること、挑戦したいこと

助手のぽよん君も、発明品のぽいロボも、諸君を待っておったぞ。さらばじゃ！""",
    """{name} 君、入りたまえ。ぽいふる博士である。
ここ ぽいんとらぼ は、儲けを競う場ではない。**試して、観て、考える**場じゃ。

まずは名乗ってくれたまえ。
・ニックネーム
・興味のある分野（ポイ活／副業／投資／その他）
・今ハマっていること、挑戦したいこと

諸君の research を楽しみにしておる。さらばじゃ！""",
]


def safe_name(raw: Any) -> str:
    """表示名を文面に差し込める形にする。

    🔴 メンバーが自分で決める値なので**そのまま埋めない**。
       - `@everyone` / `@here` が書かれていたら全員に通知が飛ぶ
       - Markdown（`*` `_` `~` `|` `` ` ``）で文面が崩れる
       - 改行を入れられると口上がバラバラになる
    """
    name = str(raw or "").strip()
    name = " ".join(name.split())                      # 改行・連続空白をつぶす
    name = name.replace("@", "＠")                      # メンションを無効化（全角に）
    for mark in ("*", "_", "~", "|", "`", ">", "#"):
        name = name.replace(mark, "")
    name = name[:MAX_NAME].strip()
    return name or "名無しの研究員"


def build_greeting(name: Any, *, mention: str = "", rng: random.Random | None = None) -> str:
    """歓迎の口上。`mention` があれば先頭に付けて本人に通知を鳴らす。

    🔵 文面は数種類からランダム（設計書の「より生きた感じに」）。
    """
    chooser = rng or random
    body = chooser.choice(GREETINGS).format(name=safe_name(name))
    head = str(mention or "").strip()
    return f"{head}\n{body}" if head else body


# ---------------------------------------------------------------- 記録


@dataclass
class WelcomeRecord:
    user_id: str
    name: str
    at: str


class WelcomedStore:
    """歓迎した人を覚えておく。

    🔴 二重に歓迎しない（設計書「歓迎の重複防止」＝初回のみ）。
    🔴 **Bot が落ちている間の参加を拾い直す**ためにも要る。
       常駐とはいえ PC は寝るし再起動もする。その間の `on_member_join` は届かないので、
       起動時にサーバーのメンバーを見て「参加済みだが歓迎していない人」を探す。
       このとき記録が無いと、起動のたびに全員を歓迎してしまう。
    """

    def __init__(self, path: Path | str):
        self.path = Path(path)
        self._data: dict[str, Any] | None = None

    def _load(self) -> dict[str, Any]:
        if self._data is not None:
            return self._data
        if not self.path.exists():
            self._data = {"welcomed": {}}
            return self._data
        try:
            self._data = json.loads(self.path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            # 🔴 壊れていても「まっさら」にしない。まっさらにすると全員を歓迎し直す。
            raise RuntimeError(f"歓迎の記録が読めない: {self.path} ({exc})") from exc
        self._data.setdefault("welcomed", {})
        return self._data

    def has_welcomed(self, user_id: Any) -> bool:
        return str(user_id) in self._load()["welcomed"]

    def mark(self, user_id: Any, name: str) -> None:
        data = self._load()
        data["welcomed"][str(user_id)] = {
            "name": str(name), "at": dt.datetime.now().isoformat(timespec="seconds"),
        }
        data["updated_at"] = dt.datetime.now().isoformat(timespec="seconds")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    def seed(self, user_ids: list[Any]) -> int:
        """初回起動時に「既にいる人」を歓迎済みとして記録する（歓迎しない）。

        🔴 これが無いと、Bot を入れた瞬間に**既存メンバー全員へ口上が飛ぶ**。
        """
        data = self._load()
        added = 0
        for user_id in user_ids:
            key = str(user_id)
            if key not in data["welcomed"]:
                data["welcomed"][key] = {"name": "", "at": "seed"}
                added += 1
        if added:
            data["updated_at"] = dt.datetime.now().isoformat(timespec="seconds")
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(data, ensure_ascii=False, indent=1),
                                 encoding="utf-8")
        return added

    @property
    def count(self) -> int:
        return len(self._load()["welcomed"])

    @property
    def is_new(self) -> bool:
        """まだ一度も記録を作っていないか（＝Bot の初回起動）。"""
        return not self.path.exists()


def catch_up_targets(members: list[Any], store: WelcomedStore, *,
                     joined_within_days: int = 14,
                     now: dt.datetime | None = None) -> list[Any]:
    """Bot が落ちていた間に参加した人を拾う。

    🔴 「歓迎していない人」を全部拾うと、記録を消したときに古参まで歓迎してしまう。
       **最近参加した人**に限る（既定14日）。
    🔵 `joined_at` が取れないメンバーは対象にしない（推測で歓迎しない）。
    """
    now = now or dt.datetime.now(dt.timezone.utc)
    out = []
    for member in members:
        if getattr(member, "bot", False):
            continue
        if store.has_welcomed(getattr(member, "id", "")):
            continue
        joined = getattr(member, "joined_at", None)
        if joined is None:
            continue
        if (now - joined).days <= joined_within_days:
            out.append(member)
    return out
