"""RSS のお知らせ（`NOTE_FEED.md`）。

トレードマシン（SPEC.md / DISCORD.md）とは**別系統のおまけ機能**。混ぜない。
判断/約定/成績/エラーの4チャンネルには**構造的に流れない**
（送信経路を `discord.channels` と分けてある）。
キャラは**ぽよん君**（お得情報を一緒に探す助手）。ぽいロボはトレード側の顔。

🔴 「日次バッチの**最後**に足す」ではなく**スキップ判定より前**に置く
   トレードの日次バッチは休場日・データが古い日に早期 return する。末尾に置くと、
   連休のあいだ新着が溜まったまま流れない（2026-09-19〜23 は5日連続の休場）。

🔴 重複防止は pubDate ではなく **guid の集合**
   記事は後から編集・バックデートされることがある。「最後の pubDate より新しいもの」
   方式だと取りこぼしや二重投稿が起きる。

🔴 流量に合わせて出し方を変える（実測・2026-09-19）
   ポイ探ニュースは **1日10件**（3日で30件）。1件1メッセージだと毎日10通になり、
   DISCORD.md 4章の「通知の静かさ」に反する。
   → `style: cards` ＋ `drop_rest: true` で**1日1記事（カード1枚）だけ**流し、
     残りは既読にして捨てる（運用者の判断・2026-09-19）。
     🔴 捨てずに持ち越すと、毎日9件ずつ未読が積み上がって永久に追いつかない。
     🔴 捨てた件数は**本文に出す**（黙って消さない）。
     低頻度の note（副業図鑑）は `style: per_item` で**全件**流す。

🔴 サムネの取り出し方が情報源ごとに違う（実測・2026-09-19）
   note は `media_thumbnail`、ポイ探・こちゃログ（WordPress）は**本文の先頭の `<img>`**。
   どちらも無ければサムネ無しのカードにする（でっち上げない）。
"""

from __future__ import annotations

import datetime as dt
import html
import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import feedparser

from .discord import MAX_FIELD_VALUE, DiscordNotifier, Embed, SentLog, truncate

log = logging.getLogger(__name__)

# 記憶しておく guid の上限（情報源ごと）。ポイ探で30件/回なので十分な余裕を取る。
MAX_REMEMBERED = 1000

# 1メッセージの embed は10個まで。見出し1＋残り一覧1 を引いた数がカードの上限。
MAX_CARDS = 8


@dataclass
class Article:
    guid: str
    title: str
    link: str
    creator: str = ""
    categories: list[str] = field(default_factory=list)
    published: str = ""
    source_key: str = ""
    source_name: str = ""
    image: str = ""
    summary: str = ""
    # 🔴 情報源をまたいで並べ替えるための公開時刻。文字列の published では比較できない
    #    （情報源ごとに書式が違う）。無いものは None にして末尾へ送る。
    published_ts: tuple | None = None

    def line(self, emoji: str, label: str) -> str:
        """1件1メッセージのときの形（NOTE_FEED.md の通知フォーマット）。"""
        by = f"｜by {self.creator}" if self.creator else ""
        return f"{emoji} {label}｜{self.title}{by}｜{self.link}"

    def digest_line(self) -> str:
        """一覧の1行。カテゴリを頭に出して拾い読みしやすくする。"""
        tags = "／".join(self.categories[:2])
        head = f"`{truncate(tags, 28)}` " if tags else ""
        return f"{head}[{truncate(self.title, 90)}]({self.link})"

    def card(self, color: int) -> Embed:
        """1件1カード。サムネがあれば右に出す。"""
        embed = Embed(
            title=truncate(self.title, 240),
            url=self.link,
            description=truncate(self.summary, 300),
            color=color,
            thumbnail_url=self.image,
        )
        tags = "／".join(self.categories[:3])
        parts = [self.source_name]
        if self.creator:
            parts.append(f"by {self.creator}")
        if tags:
            parts.append(tags)
        embed.footer = truncate(" ｜ ".join(parts), 200)
        return embed


@dataclass
class SourceSpec:
    key: str
    name: str
    url: str
    channel: str
    username: str
    avatar: str | None = None
    style: str = "per_item"          # per_item / digest
    emoji: str = "📝"
    label: str = "新着"
    max_per_run: int = 10
    card_limit: int = 5               # style: cards のとき、カードにする上位何件か
    drop_rest: bool = False           # カードに載らなかったぶんを既読にして捨てるか
    color: int = 0xAECBEB             # ぽよん君の色
    only_creators: list[str] = field(default_factory=list)
    only_categories: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "SourceSpec":
        return cls(
            key=str(raw["key"]), name=str(raw.get("name", raw["key"])),
            url=str(raw["url"]), channel=str(raw["channel"]),
            username=str(raw.get("username", "ぽよん君")),
            avatar=raw.get("avatar"),
            style=str(raw.get("style", "per_item")),
            emoji=str(raw.get("emoji", "📝")),
            label=str(raw.get("label", "新着")),
            max_per_run=int(raw.get("max_per_run", 10)),
            card_limit=int(raw.get("card_limit", 5)),
            drop_rest=bool(raw.get("drop_rest", False)),
            color=int(raw.get("color", 0xAECBEB)),
            only_creators=[str(x) for x in (raw.get("only_creators") or [])],
            only_categories=[str(x) for x in (raw.get("only_categories") or [])],
        )


@dataclass
class SourceResult:
    key: str
    name: str
    posted: list[Article] = field(default_factory=list)
    held: int = 0
    dropped: int = 0                  # 既読にして捨てたぶん（drop_rest）
    first_run: bool = False
    error: str | None = None

    def summary(self) -> str:
        if self.error:
            return f"{self.name}: 失敗（{self.error}）"
        if self.first_run:
            return f"{self.name}: 初回なので投稿しない（{self.held}件を既読にする）"
        if not self.posted and not self.dropped:
            return f"{self.name}: 新着なし"
        # 🔴 捨てたぶんを「新着なし」と言わない（新着はあったが流さなかった、が事実）
        parts = []
        if self.posted:
            parts.append(f"{len(self.posted)}件を投稿")
        if self.dropped:
            parts.append(f"{self.dropped}件は既読にして流さず")
        if self.held:
            parts.append(f"{self.held}件は次回")
        return f"{self.name}: " + "／".join(parts)


# ---------------------------------------------------------------- 既読の記録


class SeenStore:
    """情報源ごとに通知済みの guid を覚えておく（冪等性）。"""

    def __init__(self, path: Path | str, legacy_path: Path | str | None = None):
        self.path = Path(path)
        self.legacy_path = Path(legacy_path) if legacy_path else None
        self._data: dict[str, Any] | None = None

    def _load_all(self) -> dict[str, Any]:
        if self._data is not None:
            return self._data
        if self.path.exists():
            try:
                self._data = json.loads(self.path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as exc:
                # 🔴 壊れていたら**初回扱いにしない**。初回扱いにすると既読が消えて
                #    次に全件投稿してしまう。読めないことを伝えて止める。
                raise RuntimeError(f"既読ファイルが読めない: {self.path} ({exc})") from exc
        else:
            self._data = {"sources": {}}
            self._import_legacy()
        self._data.setdefault("sources", {})
        return self._data

    def _import_legacy(self) -> None:
        """単一ソースだったころの note_feed_state.json を引き継ぐ。

        🔴 取り込まないと、すでに通知済みの25件がもう一度流れる。
        """
        if not (self.legacy_path and self.legacy_path.exists()):
            return
        try:
            old = json.loads(self.legacy_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return
        seen = list(old.get("seen", []))
        if seen:
            self._data["sources"]["note_pointlab"] = {"seen": seen}
            log.info("既読を引き継いだ: note_pointlab %d件（%s）", len(seen), self.legacy_path.name)

    def load(self, key: str) -> tuple[list[str], bool]:
        """(guid のリスト, その情報源が初回かどうか)。"""
        sources = self._load_all()["sources"]
        if key not in sources:
            return [], True
        return list(sources[key].get("seen", [])), False

    def save(self, key: str, seen: list[str]) -> None:
        data = self._load_all()
        data["sources"][key] = {"seen": seen[-MAX_REMEMBERED:]}
        data["updated_at"] = dt.datetime.now().isoformat(timespec="seconds")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


# ---------------------------------------------------------------- 取得・整形


IMG_SRC = re.compile(r"""<img[^>]+src=["\']([^"\']+)""", re.IGNORECASE)
TAGS = re.compile(r"<[^>]+>")
# ポイ探の summary 末尾に付く定型句。カードの説明文に入ると邪魔なので落とす。
BOILERPLATE = re.compile(r"(Copyright\s*(&copy;|©).*|\.\.\.\s*$|\[&#8230;\]\s*$)")


def _content_of(entry: Any) -> str:
    """content（無ければ summary）の HTML を1本の文字列にする。"""
    content = entry.get("content")
    if isinstance(content, list) and content:
        return str(content[0].get("value", ""))
    return str(entry.get("summary", "") or "")


def extract_image(entry: Any) -> str:
    """サムネのURL。

    🔴 情報源ごとに置き場所が違う（実測）:
       note は media_thumbnail / media_content、WordPress 系は**本文の先頭の img**。
       どこにも無ければ空文字（サムネ無しのカードにする。でっち上げない）。
    """
    for key in ("media_thumbnail", "media_content"):
        items = entry.get(key)
        if isinstance(items, list) and items:
            url = str(items[0].get("url", "")).strip()
            if url:
                return url
    for source in (entry.get("summary", ""), _content_of(entry)):
        match = IMG_SRC.search(str(source or ""))
        if match:
            return match.group(1).strip()
    return ""


def extract_summary(entry: Any, limit: int = 300) -> str:
    """カードの説明文。HTMLタグと定型句を落としたプレーンテキスト。"""
    text = html.unescape(TAGS.sub("", str(entry.get("summary", "") or "")))
    text = BOILERPLATE.sub("", text)
    text = " ".join(text.split())
    return truncate(text, limit)


def parse_entries(feed: Any, spec: SourceSpec) -> list[Article]:
    """feedparser の結果を Article に直す。古い順に並べ直す（投稿順を自然にするため）。"""
    articles: list[Article] = []
    entries = list(getattr(feed, "entries", []))
    for index, entry in enumerate(entries):
        guid = str(entry.get("id") or entry.get("link") or "").strip()
        if not guid:
            continue
        categories = [
            str(t.get("term")) for t in (entry.get("tags") or []) if t.get("term")
        ]
        articles.append(Article(
            guid=guid,
            title=truncate(entry.get("title", "（無題）"), 300),
            link=str(entry.get("link", "")),
            # note は note_creatorname、WordPress 系は dc:creator が author に入る
            creator=truncate(entry.get("note_creatorname") or entry.get("author") or "", 100),
            categories=categories,
            published=str(entry.get("published", "")),
            source_key=spec.key,
            source_name=spec.name,
            image=extract_image(entry),
            summary=extract_summary(entry),
            published_ts=tuple(entry["published_parsed"])
            if entry.get("published_parsed") else None,
        ))

    def key(pair):
        index, _article = pair
        parsed = entries[index].get("published_parsed")
        return (0, parsed, index) if parsed else (1, None, -index)

    return [a for _, a in sorted(enumerate(articles), key=key)]


def build_cards(channel_articles: list[Article], spec_by_key: dict[str, SourceSpec],
                today: dt.date, *, total: int | None = None,
                drop_rest: bool = False) -> list[Embed]:
    """上位数件をカード（サムネ付き）にし、残りは一覧行にまとめる。

    🔴 Discord の embed は1メッセージ10個まで。見出し1＋カードN＋残り一覧1 に収める。
    🔴 「上位」は**新しい順**。お得情報は鮮度が価値なので、古いものをカードにしない。
       （将来 AI がお得度を判定するようになったら、その順に差し替える）
    """
    if not channel_articles:
        return []

    first = spec_by_key[channel_articles[0].source_key]
    limit = max(0, min(first.card_limit, MAX_CARDS))
    # 🔴 情報源をまたいで**公開時刻の新しい順**に並べる。
    #    情報源ごとに固めて並べると、古い記事がカードに、今日の記事が一覧に落ちる。
    newest_first = sort_newest_first(channel_articles)
    cards, rest = newest_first[:limit], newest_first[limit:]
    total = len(channel_articles) if total is None else total

    # 🔵 日付は自前で組む。strftime の %-m は Windows で ValueError になる。
    head = Embed(
        title=f"{first.emoji} {first.label} {today.month}/{today.day}",
        color=first.color,
    )
    if drop_rest:
        # 🔴 捨てた件数を隠さない。「今日は1件だけだった」と誤解させない。
        head.description = (
            f"新着{total}件のうち、いちばん新しい{len(cards)}件。"
            if total > len(cards) else f"新着{total}件。"
        )
    else:
        head.title += f"（{total}件）"
        head.description = "気になるものだけ開いてね。"

    embeds = [head] + [a.card(first.color) for a in cards]

    if rest and not drop_rest:
        tail = Embed(title=f"そのほか（{len(rest)}件）", color=first.color)
        _add_listing(tail, rest, spec_by_key)
        embeds.append(tail)
    return embeds


def sort_newest_first(articles: list[Article]) -> list[Article]:
    """公開時刻の新しい順。時刻が無いものは末尾へ（でっち上げて並べない）。"""
    timed = [a for a in articles if a.published_ts]
    untimed = [a for a in articles if not a.published_ts]
    # parse_entries は古い順に返すので、時刻の無いものは反転して新しい側を前に置く
    return sorted(timed, key=lambda a: a.published_ts, reverse=True) + list(reversed(untimed))


def _add_listing(embed: Embed, articles: list[Article],
                 spec_by_key: dict[str, SourceSpec]) -> None:
    """情報源ごとの一覧を足す。

    🔴 1フィールドは1024字まで。件数が多い日にここを超えると**黙って切れる**ので、
       溢れる前に「（つづき）」のフィールドへ送る。
    """
    by_source: dict[str, list[Article]] = {}
    for a in articles:
        by_source.setdefault(a.source_key, []).append(a)

    for source_key, items in by_source.items():
        name = spec_by_key[source_key].name
        chunk: list[str] = []
        length = 0
        part = 0
        for article in items:
            line = article.digest_line()
            if chunk and length + len(line) + 1 > MAX_FIELD_VALUE:
                label = f"{name}（{len(items)}件）" if part == 0 else f"{name}（つづき）"
                embed.add_field(label, "\n".join(chunk))
                chunk, length, part = [], 0, part + 1
            chunk.append(line)
            length += len(line) + 1
        if chunk:
            label = f"{name}（{len(items)}件）" if part == 0 else f"{name}（つづき）"
            embed.add_field(label, "\n".join(chunk))


# 互換のため残す（チャンネル1本の一覧だけが欲しいとき）
def build_digest(channel_articles: list[Article], spec_by_key: dict[str, SourceSpec],
                 today: dt.date) -> list[Embed]:
    """カードを作らず、一覧行だけでまとめる。"""
    if not channel_articles:
        return []
    first = spec_by_key[channel_articles[0].source_key]
    head = Embed(
        title=f"{first.emoji} {first.label} {today.month}/{today.day}"
              f"（{len(channel_articles)}件）",
        description="気になるものだけ開いてね。",
        color=first.color,
    )
    _add_listing(head, channel_articles, spec_by_key)
    return [head]


# ---------------------------------------------------------------- 実行


class FeedRunner:
    """設定にある情報源をまとめて回す。"""

    def __init__(self, cfg, sent_log: SentLog | None = None):
        self.cfg = cfg
        self.enabled = bool(cfg.get("feeds.enabled", False))
        self.store = SeenStore(
            cfg.path("feeds.state_path"),
            legacy_path=cfg.root / "note_feed_state.json",
        )
        self.specs = [
            SourceSpec.from_dict(raw) for raw in (cfg.get("feeds.sources", []) or [])
        ]
        self.avatar_base = str(cfg.get("discord.avatar_base", "")).rstrip("/")
        self.sent_log = sent_log
        self._notifiers: dict[str, DiscordNotifier] = {}

    def notifier_for(self, spec: SourceSpec) -> DiscordNotifier:
        cache_key = f"{spec.channel}/{spec.username}"
        if cache_key not in self._notifiers:
            self._notifiers[cache_key] = DiscordNotifier(
                self.cfg.secrets.webhooks.get(spec.channel),
                username=spec.username,
                avatar_url=(f"{self.avatar_base}/{spec.avatar}"
                            if (self.avatar_base and spec.avatar) else None),
                label=spec.key,
                channel=spec.channel,
                enabled=bool(self.cfg.get("discord.enabled", True)) and self.enabled,
                sent_log=self.sent_log,
            )
        return self._notifiers[cache_key]

    def fetch(self, spec: SourceSpec) -> Any:
        return feedparser.parse(spec.url)

    # -------------------------------------------------- 1情報源ぶんの差分

    def _fresh_for(self, spec: SourceSpec) -> tuple[list[Article], SourceResult]:
        result = SourceResult(key=spec.key, name=spec.name)
        try:
            feed = self.fetch(spec)
        except Exception as exc:  # noqa: BLE001 - feedparser は多様な例外を投げる
            result.error = str(exc)
            return [], result

        status = getattr(feed, "status", None)
        if status and status >= 400:
            result.error = f"RSS が {status} を返した"
            return [], result

        articles = parse_entries(feed, spec)
        if not articles:
            # 🔴 0件のときに既読をいじらない。取得失敗で空になった可能性があり、
            #    ここで保存すると既読が消えて次回に全件投稿してしまう。
            result.error = "RSS にエントリが無かった（取得失敗の可能性）"
            return [], result

        if spec.only_creators:
            articles = [a for a in articles if a.creator in spec.only_creators]
        if spec.only_categories:
            wanted = set(spec.only_categories)
            articles = [a for a in articles if wanted & set(a.categories)]

        seen, first_run = self.store.load(spec.key)
        if first_run:
            result.first_run = True
            result.held = len(articles)
            return [], result

        seen_set = set(seen)
        fresh = [a for a in articles if a.guid not in seen_set]
        result.held = max(0, len(fresh) - spec.max_per_run)
        return fresh[: spec.max_per_run], result

    # -------------------------------------------------- 本体

    def run(self, *, dry_run: bool = False, today: dt.date | None = None) -> list[SourceResult]:
        if not self.enabled:
            log.info("お知らせフィード: 無効（feeds.enabled: false）")
            return []

        today = today or dt.date.today()
        spec_by_key = {s.key: s for s in self.specs}
        results: list[SourceResult] = []
        digest_by_channel: dict[str, list[Article]] = {}

        for spec in self.specs:
            fresh, result = self._fresh_for(spec)
            results.append(result)

            if result.first_run:
                if not dry_run:
                    # 初回は投稿せず既読にするだけ（導入直後にチャンネルを埋めない）
                    feed = self.fetch(spec)
                    self.store.save(spec.key, [a.guid for a in parse_entries(feed, spec)])
                continue
            if result.error or not fresh:
                continue

            if spec.style in ("digest", "cards"):
                digest_by_channel.setdefault(spec.channel, []).extend(fresh)
                result.posted = fresh          # 送信可否は下でまとめて確定する
            else:
                result.posted = self._send_each(spec, fresh, dry_run=dry_run)
                if result.posted and not dry_run:
                    seen, _ = self.store.load(spec.key)
                    self.store.save(spec.key, seen + [a.guid for a in result.posted])

        # まとめ系はチャンネルごとに1メッセージ
        for channel, articles in digest_by_channel.items():
            spec = next(s for s in self.specs
                        if s.channel == channel and s.style in ("digest", "cards"))

            # 🔴 drop_rest のときは**カードに載せるぶんだけ**を選び、残りは既読にして捨てる。
            #    持ち越すと毎日9件ずつ未読が積み上がって永久に追いつかない（運用者の判断）。
            shown = articles
            if spec.drop_rest:
                shown = sort_newest_first(articles)[: max(0, spec.card_limit)]

            if spec.style == "cards":
                embeds = build_cards(shown, spec_by_key, today,
                                     total=len(articles), drop_rest=spec.drop_rest)
            else:
                embeds = build_digest(shown, spec_by_key, today)

            if dry_run:
                log.info("お知らせ: dry-run のため投稿しない（%s に %d件／候補%d件）",
                         channel, len(shown), len(articles))
                continue

            ok = self.notifier_for(spec).send_batched(embeds, kind="feed")
            shown_guids = {a.guid for a in shown}
            for result in results:
                mine = [a for a in articles if a.source_key == result.key]
                if not mine:
                    continue
                if ok:
                    # 既読にするのは候補**全部**（捨てたぶんも含む。次回に持ち越さない）
                    seen, _ = self.store.load(result.key)
                    self.store.save(result.key, seen + [a.guid for a in mine])
                    result.posted = [a for a in mine if a.guid in shown_guids]
                    result.dropped = len(mine) - len(result.posted)
                else:
                    # 🔴 送れなかったものは既読にしない。次回もう一度出す。
                    result.posted = []
                    result.error = "投稿に失敗"
        return results

    def _send_each(self, spec: SourceSpec, articles: list[Article], *,
                   dry_run: bool) -> list[Article]:
        if dry_run:
            log.info("お知らせ: dry-run のため投稿しない（%s に %d件）", spec.key, len(articles))
            return articles
        notifier = self.notifier_for(spec)
        posted: list[Article] = []
        for article in articles:
            if notifier.send(content=article.line(spec.emoji, spec.label), kind="feed"):
                posted.append(article)
            else:
                log.warning("お知らせ: 投稿に失敗 %s", article.link)
                break
        return posted
