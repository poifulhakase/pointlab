"""入場歓迎Bot（WELCOME_BOT.md）。

新メンバーが参加したら `#やぁ諸君！` に**ぽいふる博士の口上**で自動歓迎する。

    .venv/Scripts/python.exe bot.py
    .venv/Scripts/python.exe bot.py --dry-run   # 投稿せず、誰を歓迎するかだけ出す

🔴 Webhook だけでは作れない機能
   「メンバー参加イベントを検知して反応する」には Gateway 接続（＝常駐Bot）が要る。
   Webhook は送信専用。

🔴 Bot に投稿権限は要らない
   歓迎文は**Webhook で投げる**（送信者が「ハカセ」になる）。
   Bot に必要なのは「サーバーにいること」と SERVER MEMBERS INTENT だけ。
   権限を最小にできるので、トークンが漏れても被害が小さい。

🔴 落ちている間の参加を取りこぼさない
   常駐とはいえ PC は寝るし再起動もする。その間の `on_member_join` は届かない。
   起動時にメンバーを見て「最近参加したが歓迎していない人」を拾い直す。

🔴 入れた瞬間に既存メンバー全員へ飛ばさない
   初回起動時は、今いる人を**歓迎済みとして記録するだけ**にする（seed）。
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path

import discord
import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent))

from welcomebot.greeting import (  # noqa: E402
    WelcomedStore, build_greeting, catch_up_targets,
)

ROOT = Path(__file__).resolve().parent
log = logging.getLogger("welcomebot")


def setup_logging(verbose: bool = False) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
        # 🔴 ログは stdout へ。PowerShell から呼ぶと stderr は ErrorRecord に包まれ、
        #    成功しても終了コードが 1 になる（ロボトレードで踏んだ）。
        stream=sys.stdout,
    )
    for noisy in ("discord", "discord.client", "discord.gateway", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


class WelcomeBot(discord.Client):
    def __init__(self, *, webhook_url: str, guild_id: int, store: WelcomedStore,
                 catch_up_days: int, dry_run: bool):
        # 🔴 SERVER MEMBERS INTENT が要る（Developer Portal でONにする）。
        #    members だけ立て、メッセージ本文は読まない（要らないものは要求しない）。
        intents = discord.Intents.none()
        intents.guilds = True
        intents.members = True
        super().__init__(intents=intents)

        self.webhook_url = webhook_url
        self.guild_id = guild_id
        self.store = store
        self.catch_up_days = catch_up_days
        self.dry_run = dry_run

    # -------------------------------------------------- 起動時

    async def on_ready(self) -> None:
        log.info("接続した: %s", self.user)
        guild = self.get_guild(self.guild_id)
        if guild is None:
            log.error("🔴 サーバーが見つからない（guild_id=%s）。Bot が招待されているか確認する",
                      self.guild_id)
            return

        members = [m for m in guild.members if not m.bot]
        log.info("サーバー: %s / 人間のメンバー %d人", guild.name, len(members))

        if self.store.is_new:
            # 🔴 初回は歓迎しない。今いる人を「歓迎済み」にするだけ。
            added = self.store.seed([m.id for m in members])
            log.info("初回起動: 既存メンバー %d人を歓迎済みとして記録した（口上は送らない）", added)
            return

        targets = catch_up_targets(members, self.store, joined_within_days=self.catch_up_days)
        if not targets:
            log.info("取りこぼしなし。参加を待ち受ける")
            return

        log.info("落ちていた間の参加を %d人 拾う", len(targets))
        for member in targets:
            await self.welcome(member, reason="catch-up")

    # -------------------------------------------------- 参加イベント

    async def on_member_join(self, member: discord.Member) -> None:
        if member.guild.id != self.guild_id:
            return
        if member.bot:
            log.info("Bot の参加なので歓迎しない: %s", member)
            return
        await self.welcome(member, reason="join")

    # -------------------------------------------------- 歓迎

    async def welcome(self, member: discord.Member, *, reason: str) -> bool:
        if self.store.has_welcomed(member.id):
            log.info("歓迎済みなので送らない: %s", member.display_name)
            return False

        text = build_greeting(member.display_name, mention=member.mention)
        if self.dry_run:
            log.info("dry-run のため送らない（%s・%s）:\n%s", reason, member.display_name, text)
            return False

        ok = await asyncio.to_thread(self.post, text)
        if ok:
            self.store.mark(member.id, member.display_name)
            log.info("歓迎した（%s）: %s", reason, member.display_name)
        else:
            # 🔴 送れなかったら記録しない。次の起動でもう一度拾う。
            log.warning("歓迎を送れなかった: %s", member.display_name)
        return ok

    def post(self, text: str) -> bool:
        """Webhook で投稿する（送信者は「ハカセ」）。

        🔴 Webhook URL は実質パスワード。失敗しても本文もURLもログに出さない。
        🔵 `allowed_mentions` でメンションできる先を**参加した本人だけ**に絞る。
           表示名に `@everyone` が入っていても全員には飛ばない（文面側でも潰してある）。
        """
        try:
            res = requests.post(
                self.webhook_url,
                json={
                    "content": text,
                    "allowed_mentions": {"parse": ["users"]},
                },
                timeout=15,
            )
        except requests.RequestException as exc:
            log.error("Discord への投稿に失敗: %s", type(exc).__name__)
            return False
        if res.status_code >= 300:
            log.error("Discord への投稿に失敗: HTTP %s", res.status_code)
            return False
        return True


# ---------------------------------------------------------------- 起動


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="入場歓迎Bot（ぽいふる博士）")
    parser.add_argument("--dry-run", action="store_true",
                        help="投稿せず、誰を歓迎するかだけ出す")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args(argv)

    setup_logging(args.verbose)
    load_dotenv(ROOT / ".env")

    token = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
    webhook = os.environ.get("WELCOME_WEBHOOK_URL", "").strip()
    guild_id = os.environ.get("DISCORD_GUILD_ID", "").strip()
    catch_up_days = int(os.environ.get("WELCOME_CATCH_UP_DAYS", "14"))

    missing = [
        name for name, value in (
            ("DISCORD_BOT_TOKEN", token),
            ("WELCOME_WEBHOOK_URL", webhook),
            ("DISCORD_GUILD_ID", guild_id),
        ) if not value
    ]
    if missing:
        log.error("🔴 .env に %s が無い（.env.example を見る）", "/".join(missing))
        return 2
    if not guild_id.isdigit():
        log.error("🔴 DISCORD_GUILD_ID が数値でない")
        return 2

    store = WelcomedStore(ROOT / "welcomed.json")
    client = WelcomeBot(
        webhook_url=webhook, guild_id=int(guild_id), store=store,
        catch_up_days=catch_up_days, dry_run=args.dry_run,
    )

    try:
        client.run(token, log_handler=None)
    except discord.LoginFailure:
        log.error("🔴 トークンが違う（Developer Portal で Reset Token して入れ直す）")
        return 2
    except discord.PrivilegedIntentsRequired:
        log.error("🔴 SERVER MEMBERS INTENT が無効。Developer Portal の Bot 設定でONにする")
        return 2
    except KeyboardInterrupt:
        log.info("停止した")
    return 0


if __name__ == "__main__":
    sys.exit(main())
