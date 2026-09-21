"""RSS の新着を1日1件、SNS（X・Threads）に予約投稿する（Buffer 経由）。

Discord の #マガジン新着 は**全件**流す（今までどおり）。SNS はタイムラインが埋まるので
**1日1件**に絞る。そのため**既読の集合を Discord とは別に持つ**（`x:<source_key>`）。
🔵 既読は**宛先ごとに分けない**。同じ記事を X と Threads の両方に出したいので、
   「その記事を SNS に出したか」で1つ持つ。

🔴 **文面は宛先ごとに別々に書かせる**。同じ文を両方に流すと、どこで見ても同じで
   読む理由がなくなるうえ、スパム的な使い方に近づく。字数も違う
   （X は日本語を2文字と数えて実質140字／Threads は500字）。

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

    def __init__(self, cfg, client, tracker, *, choices: list[str],
                 where: str = "X（@Aojiru_Hakase）",
                 length_hint: str = "2〜3行・50文字以内"):
        super().__init__(cfg, client, tracker)
        self.choices = choices
        self.where = where
        self.length_hint = length_hint

    def system_prompt(self) -> str:
        return x_compose.system_for(where=self.where, length_hint=self.length_hint)

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
    """1日1件ぶんを、宛先ごとに文面を作って Buffer に預ける。"""

    def __init__(self, cfg, *, buffer_client, feed_runner, llm_client=None, tracker=None):
        self.cfg = cfg
        self.buffer = buffer_client
        self.feeds = feed_runner
        self.llm_client = llm_client
        self.tracker = tracker

    @property
    def enabled(self) -> bool:
        return bool(self.cfg.get("sns_post.enabled", False)) and self.buffer is not None

    @property
    def targets(self) -> list[dict[str, Any]]:
        return list(self.cfg.get("sns_post.targets", []) or [])

    def run(self, *, dry_run: bool = False, now: dt.datetime | None = None) -> XResult:
        result = XResult()
        if not self.enabled:
            return result

        now = now or dt.datetime.now()
        source_key = str(self.cfg.get("sns_post.source_key"))
        spec = next((s for s in self.feeds.specs if s.key == source_key), None)
        if spec is None:
            result.error = f"sns_post.source_key の情報源が無い: {source_key}"
            log.warning(result.error)
            return result

        # 🔵 既読は宛先ごとに分けない。同じ記事を全宛先に出したいので1つで持つ
        fresh, feed_result = self.feeds.fresh_for_sink(spec, sink="x")
        if feed_result.error:
            result.error = feed_result.error
            return result
        if feed_result.first_run or not fresh:
            return result

        per_day = int(self.cfg.get("sns_post.per_day", 1))
        chosen = fresh[:per_day]
        result.dropped = len(fresh) - len(chosen)

        posted_any = False
        for article in chosen:
            for target in self.targets:
                try:
                    text = self._text_for(article, target)
                except Exception as exc:  # noqa: BLE001
                    log.warning("%s の文面を作れなかった %s: %s",
                                target.get("key"), article.title[:40], exc)
                    continue
                if dry_run:
                    log.info("%s（dry-run）: %s", target.get("key"),
                             text.replace("\n", " / ")[:120])
                    posted_any = True
                    continue
                try:
                    post_id = self.buffer.create_post(
                        channel_id=str(target["channel_id"]),
                        text=text,
                        due_at=self._due_at(now, target),
                    )
                    # 🔵 **出る前に消せる**ことを毎回ログに出す（運用者が確認する導線）。
                    #    予約は翌日なので、夕方の実行から十数時間の猶予がある。
                    log.info("%s に予約した（翌%s・出る前なら Buffer のキューから消せる）: %s",
                             target.get("name", target.get("key")),
                             self._due_at(now, target).strftime("%m/%d %H:%M"),
                             article.title[:50])
                    log.info("    Buffer post=%s / https://publish.buffer.com/", post_id)
                    posted_any = True
                except BufferError as exc:
                    # 🔴 ここで全部を止めない。宛先が1つ落ちても他は出す
                    result.error = f"{target.get('key')}: {exc}"
                    log.warning("%s への予約に失敗: %s", target.get("key"), exc)
            if posted_any:
                result.posted.append(article.title)

        if not dry_run and posted_any:
            # 🔴 投稿したものも捨てたものも**まとめて既読**にする（持ち越さない）
            self.feeds.mark_seen_for_sink(spec, fresh, sink="x")
        return result

    # -------------------------------------------------- 中身

    def _due_at(self, now: dt.datetime, target: dict[str, Any]) -> dt.datetime:
        """翌日の指定時刻（ローカル）。夕方に走るので当日には出さない。

        🔵 宛先ごとに時刻をずらす。同時刻に同じ記事が並ぶと機械的に見える。
        """
        hh, _, mm = str(target.get("post_at", "09:00")).partition(":")
        return (now + dt.timedelta(days=1)).replace(
            hour=int(hh), minute=int(mm or 0), second=0, microsecond=0)

    def _text_for(self, article: Any, target: dict[str, Any]) -> str:
        choices = list(self.cfg.get("sns_post.hashtag_choices", []) or [])
        limit = int(target.get("hashtag_limit", 3))

        comment, picked = "", []
        if self.llm_client is not None:
            try:
                agent = CommentAgent(
                    self.cfg, self.llm_client, self.tracker, choices=choices,
                    where=str(target.get("name", "X")),
                    length_hint=str(target.get("comment_hint", "2〜3行・50文字以内")),
                )
                payload, _record = agent.call(x_compose.build_user(
                    title=article.title, summary=article.summary,
                    creator=article.creator, choices=choices))
                comment = payload.get("comment", "")
                picked = payload.get("hashtags", [])
            except Exception as exc:  # noqa: BLE001
                # 🔴 一言が無くても投稿は成立する。止めない
                log.warning("%s の一言を作れなかった（一言なしで出す）: %s",
                            target.get("key"), exc)

        return x_compose.compose(
            title=article.title,
            link=article.link,
            creator=article.creator,
            comment=comment,
            hashtags=x_compose.pick_hashtags(picked, fixed=[], choices=choices,
                                             limit=limit),
            emoji=str(target.get("emoji", "")),
            max_chars=int(target.get("max_chars", x_compose.MAX_CHARS)),
            cjk_weight=int(target.get("cjk_weight", x_compose.CJK_WEIGHT_X)),
        )
