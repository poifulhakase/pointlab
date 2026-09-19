"""note 新着のお知らせ（`NOTE_FEED.md`）。

トレードマシン（SPEC.md / DISCORD.md）とは**別系統のおまけ機能**。混ぜない。
`#note新着` チャンネル専用の Webhook にだけ投稿し、
判断/約定/成績/エラーの4チャンネルには**絶対に流さない**（構造的に届かないようにしてある）。

🔴 依頼文は「日次バッチの最後に足す」だったが、そこには置かない
   トレードの日次バッチは**休場日・データが古い日にスキップして早期 return する**。
   末尾に置くと、連休のあいだ note の新着が溜まったまま流れない
   （2026-09-19〜23 は土日＋敬老の日＋国民の休日＋秋分の日で5日連続の休場）。
   → 相乗りはするが、**トレード側のスキップ判定より前**に、独立して走らせる。

🔴 初回実行で25件まとめて投稿しない
   状態ファイルが無い1回目は「全部を既読として記録するだけ」で**何も投稿しない**。
   でないと導入した瞬間にチャンネルが埋まる。

🔴 重複防止は pubDate ではなく **guid の集合**で持つ
   記事は後から編集・バックデートされることがある。「最後の pubDate より新しいもの」
   方式だと、その取りこぼしや二重投稿が起きる。見た guid を覚えるほうが素直で確実。
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import feedparser

from .discord import DiscordNotifier, SentLog, truncate

log = logging.getLogger(__name__)

# 記憶しておく guid の上限。フィードは25件程度なので、これだけあれば取りこぼさない。
MAX_REMEMBERED = 500


@dataclass
class Article:
    guid: str
    title: str
    link: str
    creator: str
    published: str = ""

    def line(self) -> str:
        """NOTE_FEED.md の通知フォーマット。"""
        creator = self.creator or "不明"
        return f"📝 新着｜{self.title}｜by {creator}｜{self.link}"


@dataclass
class FeedResult:
    posted: list[Article] = field(default_factory=list)
    skipped: int = 0
    first_run: bool = False
    error: str | None = None

    def summary(self) -> str:
        if self.error:
            return f"失敗: {self.error}"
        if self.first_run:
            return f"初回なので投稿しない（{self.skipped}件を既読にする）"
        if not self.posted:
            return "新着なし"
        extra = f"（さらに {self.skipped}件は次回）" if self.skipped else ""
        return f"{len(self.posted)}件を投稿{extra}"


class SeenStore:
    """通知済みの guid を覚えておく（冪等性）。"""

    def __init__(self, path: Path | str):
        self.path = Path(path)

    def load(self) -> tuple[list[str], bool]:
        """(guid のリスト, 初回かどうか) を返す。"""
        if not self.path.exists():
            return [], True
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            # 🔴 壊れていたら**初回扱いにしない**。初回扱いにすると既読が消えて
            #    次に全部投稿してしまう。読めないことを伝えて止める。
            raise RuntimeError(f"note の既読ファイルが読めない: {self.path} ({exc})") from exc
        return list(data.get("seen", [])), False

    def save(self, seen: list[str]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "updated_at": datetime.now().isoformat(timespec="seconds"),
            "seen": seen[-MAX_REMEMBERED:],
        }
        self.path.write_text(json.dumps(payload, ensure_ascii=False, indent=1),
                             encoding="utf-8")


def parse_entries(feed: Any) -> list[Article]:
    """feedparser の結果を Article に直す。古い順に並べ直す（投稿順を自然にするため）。"""
    articles: list[Article] = []
    for entry in getattr(feed, "entries", []):
        guid = str(entry.get("id") or entry.get("link") or "").strip()
        if not guid:
            continue
        articles.append(Article(
            guid=guid,
            title=truncate(entry.get("title", "（無題）"), 300),
            link=str(entry.get("link", "")),
            creator=truncate(entry.get("note_creatorname") or entry.get("author") or "", 100),
            published=str(entry.get("published", "")),
        ))
    # published_parsed があるものは古い順に。無いものはフィードの並び順を尊重。
    def key(index_article):
        index, article = index_article
        entry = feed.entries[index]
        parsed = entry.get("published_parsed")
        return (0, parsed, index) if parsed else (1, None, -index)

    ordered = [a for _, a in sorted(enumerate(articles), key=key)]
    return ordered


class NoteFeed:
    """RSS を読んで、増えたぶんだけ #note新着 に流す。"""

    def __init__(self, cfg, sent_log: SentLog | None = None):
        self.cfg = cfg
        self.enabled = bool(cfg.get("note_feed.enabled", False))
        self.url = str(cfg.get("note_feed.rss_url", ""))
        self.max_per_run = int(cfg.get("note_feed.max_per_run", 10))
        self.creators = [str(c) for c in (cfg.get("note_feed.only_creators", []) or [])]
        self.store = SeenStore(cfg.path("note_feed.state_path"))

        base = str(cfg.get("discord.avatar_base", "")).rstrip("/")
        avatar = cfg.get("note_feed.avatar", None)
        self.notifier = DiscordNotifier(
            cfg.secrets.webhooks.get("note"),
            username=str(cfg.get("note_feed.username", "ぽいロボ｜note")),
            avatar_url=f"{base}/{avatar}" if (base and avatar) else None,
            label="note",
            channel="note",
            enabled=bool(cfg.get("discord.enabled", True)) and self.enabled,
            sent_log=sent_log,
        )

    def fetch(self) -> Any:
        return feedparser.parse(self.url)

    def run(self, *, dry_run: bool = False) -> FeedResult:
        if not self.enabled:
            log.info("note新着: 無効（note_feed.enabled: false）")
            return FeedResult()
        if not self.url:
            return FeedResult(error="note_feed.rss_url が空")

        try:
            feed = self.fetch()
        except Exception as exc:  # noqa: BLE001 - feedparser は多様な例外を投げる
            log.warning("note新着: RSS を取れなかった %s", exc)
            return FeedResult(error=str(exc))

        status = getattr(feed, "status", None)
        if status and status >= 400:
            return FeedResult(error=f"RSS が {status} を返した")

        articles = parse_entries(feed)
        if not articles:
            # 🔴 0件のときに既読をいじらない。取得失敗で空になった可能性があり、
            #    ここで保存すると既読が消えて次回に全件投稿してしまう。
            return FeedResult(error="RSS にエントリが無かった（取得失敗の可能性）")

        if self.creators:
            articles = [a for a in articles if a.creator in self.creators]

        seen, first_run = self.store.load()
        seen_set = set(seen)
        fresh = [a for a in articles if a.guid not in seen_set]

        if first_run:
            # 初回は投稿せず既読にするだけ（導入直後にチャンネルを埋めない）
            if not dry_run:
                self.store.save([a.guid for a in articles])
                log.info("note新着: 初回なので投稿せず %d件を既読にした", len(articles))
            else:
                log.info("note新着: 初回。本番なら %d件を既読にして投稿はしない", len(articles))
            return FeedResult(skipped=len(articles), first_run=True)

        if not fresh:
            log.info("note新着: 新着なし")
            return FeedResult()

        to_post = fresh[: self.max_per_run]
        held = len(fresh) - len(to_post)

        if dry_run:
            log.info("note新着: dry-run のため投稿しない（%d件）", len(to_post))
            return FeedResult(posted=to_post, skipped=held)

        posted: list[Article] = []
        for article in to_post:
            if self.notifier.send(content=article.line(), kind="note"):
                posted.append(article)
            else:
                # 🔴 送れなかったものは既読にしない。次回もう一度出す。
                log.warning("note新着: 投稿に失敗 %s", article.link)
                break

        if posted:
            self.store.save(seen + [a.guid for a in posted])
        return FeedResult(posted=posted, skipped=held)
