"""RSS の新着を1日1件、X に予約投稿する（Buffer 経由）。

Discord の #マガジン新着 は**全件**流す（今までどおり）。X はタイムラインが埋まるので
**1日1件**に絞る。そのため**既読の集合を Discord とは別に持つ**（`x:<source_key>`）。

🔴 出すのは「その日いちばん新しい1件」。残りは**既読にして捨てる**。
   持ち越すと毎日2件ずつ未投稿が積み上がって永久に追いつかない（ポイ探で踏んだのと同じ）。
   🔴 捨てた件数はログに出す（黙って消さない）。

🔴 **翌朝に予約する**。日次バッチは平日の夕方に走るので、そのまま出すと夜中に流れる。

🔴 一言が作れなくても投稿は止めない（AI が落ちても記事の紹介は成立する）。
"""

from __future__ import annotations

import datetime as dt
import logging
from dataclasses import dataclass, field
from typing import Any

from ..agents.base import AgentError, LLMAgent
from . import x_compose
from .buffer import BufferError

log = logging.getLogger(__name__)


@dataclass
class XResult:
    posted: list[str] = field(default_factory=list)   # 投稿した記事タイトル
    dropped: int = 0                                  # 既読にして捨てた件数
    error: str = ""

    def summary(self) -> str:
        if self.error:
            return f"X: {self.error}"
        if not self.posted:
            return f"X: 投稿なし（新着なし）" if not self.dropped else \
                   f"X: 投稿なし／{self.dropped}件は既読にして流さず"
        head = f"X: {len(self.posted)}件を予約"
        return head if not self.dropped else f"{head}／{self.dropped}件は既読にして流さず"


class CommentAgent(LLMAgent):
    """ぽいふる博士の一言とハッシュタグを書かせる（cheap モデル）。"""

    name = "x_comment"
    prompt_version = "x-comment-v1"
    tier = "cheap"

    def __init__(self, cfg, client, tracker, *, choices: list[str]):
        super().__init__(cfg, client, tracker)
        self.choices = choices

    def system_prompt(self) -> str:
        return x_compose.SYSTEM

    def tool_schema(self) -> dict[str, Any]:
        return x_compose.build_tool_schema(self.choices)

    def validate(self, out: dict[str, Any]) -> dict[str, Any]:
        comment = str(out.get("comment") or "").strip()
        if not comment:
            raise AgentError("comment が空")
        out["comment"] = comment
        out["hashtags"] = [str(t) for t in (out.get("hashtags") or [])]
        return out


class XRunner:
    """1日1件ぶんを組み立てて Buffer に預ける。"""

    def __init__(self, cfg, *, buffer_client, feed_runner, llm_client=None, tracker=None):
        self.cfg = cfg
        self.buffer = buffer_client
        self.feeds = feed_runner
        self.llm_client = llm_client
        self.tracker = tracker

    @property
    def enabled(self) -> bool:
        return bool(self.cfg.get("x_post.enabled", False)) and self.buffer is not None

    def run(self, *, dry_run: bool = False, now: dt.datetime | None = None) -> XResult:
        result = XResult()
        if not self.enabled:
            return result

        now = now or dt.datetime.now()
        source_key = str(self.cfg.get("x_post.source_key"))
        spec = next((s for s in self.feeds.specs if s.key == source_key), None)
        if spec is None:
            result.error = f"x_post.source_key の情報源が無い: {source_key}"
            log.warning(result.error)
            return result

        fresh, feed_result = self.feeds.fresh_for_sink(spec, sink="x")
        if feed_result.error:
            result.error = feed_result.error
            return result
        if feed_result.first_run or not fresh:
            return result

        per_day = int(self.cfg.get("x_post.per_day", 1))
        chosen = fresh[:per_day]
        result.dropped = len(fresh) - len(chosen)

        for article in chosen:
            try:
                text = self._text_for(article)
            except Exception as exc:  # noqa: BLE001
                log.warning("X の文面を作れなかった %s: %s", article.title[:40], exc)
                continue
            if dry_run:
                log.info("X（dry-run）: %s", text.replace("\n", " / ")[:120])
                result.posted.append(article.title)
                continue
            try:
                post_id = self.buffer.create_post(
                    channel_id=str(self.cfg.get("x_post.channel_id")),
                    text=text,
                    due_at=self._due_at(now),
                )
                # 🔵 **出る前に消せる**ことを毎回ログに出す（運用者が確認する導線）。
                #    予約は翌朝なので、夕方の実行から十数時間の猶予がある。
                log.info("X に予約した（翌%s・出る前なら Buffer のキューから消せる）: %s",
                         self._due_at(now).strftime("%m/%d %H:%M"), article.title[:50])
                log.info("    Buffer post=%s / https://publish.buffer.com/", post_id)
                result.posted.append(article.title)
            except BufferError as exc:
                # 🔴 ここで止めない。Discord 側の通知は別経路で済んでいる
                result.error = str(exc)
                log.warning("X への予約に失敗: %s", exc)
                return result

        if not dry_run:
            # 🔴 投稿したものも捨てたものも**まとめて既読**にする（持ち越さない）
            self.feeds.mark_seen_for_sink(spec, fresh, sink="x")
        return result

    # -------------------------------------------------- 中身

    def _due_at(self, now: dt.datetime) -> dt.datetime:
        """翌日の指定時刻（ローカル）。夕方に走るので当日には出さない。"""
        hh, _, mm = str(self.cfg.get("x_post.post_at", "09:00")).partition(":")
        target = (now + dt.timedelta(days=1)).replace(
            hour=int(hh), minute=int(mm or 0), second=0, microsecond=0)
        return target

    def _text_for(self, article: Any) -> str:
        tags_cfg = self.cfg.get("x_post.hashtags", {}) or {}
        fixed = list(tags_cfg.get("fixed", []) or [])
        choices = list(tags_cfg.get("choices", []) or [])
        limit = int(tags_cfg.get("limit", 3))

        comment, picked = "", []
        if self.llm_client is not None:
            try:
                agent = CommentAgent(self.cfg, self.llm_client, self.tracker, choices=choices)
                payload, _record = agent.call(x_compose.build_user(
                    title=article.title, summary=article.summary,
                    creator=article.creator, choices=choices))
                comment = payload.get("comment", "")
                picked = payload.get("hashtags", [])
            except Exception as exc:  # noqa: BLE001
                # 🔴 一言が無くても投稿は成立する。止めない
                log.warning("X の一言を作れなかった（一言なしで出す）: %s", exc)

        return x_compose.compose(
            title=article.title,
            link=article.link,
            creator=article.creator,
            comment=comment,
            hashtags=x_compose.pick_hashtags(picked, fixed=fixed, choices=choices, limit=limit),
            emoji=str(self.cfg.get("x_post.emoji", "📝")),
        )
