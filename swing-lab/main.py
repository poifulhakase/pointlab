"""swing-lab エントリポイント。

    .venv/Scripts/python.exe main.py                 # 直近の営業日を対象に1回走らせる
    .venv/Scripts/python.exe main.py --date 2026-09-18
    .venv/Scripts/python.exe main.py --dry-run       # 書き込まない（判断だけ見る）
    .venv/Scripts/python.exe main.py --force         # 実行済みの日をやり直す
    .venv/Scripts/python.exe main.py --notify-test   # Discord 疎通確認だけ

🔴 起動 → パイプライン実行 → 通知 → 終了 の一発完結型。常駐しない（SPEC 13）。
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import date

from swinglab import config as config_mod
from swinglab.logs import setup_logging
from swinglab.notify import discord as discord_mod
from swinglab.notify import summary as summary_mod
from swinglab.orchestrator import Orchestrator, SkipRun, resolve_run_date

log = logging.getLogger("swing-lab")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="LLMスイングトレード 疑似トレードマシン")
    parser.add_argument("--date", help="対象の営業日（YYYY-MM-DD）。既定は直近の営業日")
    parser.add_argument("--dry-run", action="store_true", help="DBに書き込まない")
    parser.add_argument("--force", action="store_true", help="実行済みの日をやり直す")
    parser.add_argument("--no-notify", action="store_true", help="Discord に送らない")
    parser.add_argument("--notify-test", action="store_true", help="Discord 疎通確認だけして終了")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args(argv)

    setup_logging(logging.DEBUG if args.verbose else logging.INFO)

    try:
        cfg, warnings = config_mod.load()
    except config_mod.ConfigError as exc:
        log.error("🔴 設定が不正: %s", exc)
        return 2
    for w in warnings:
        log.warning("config: %s", w)

    notifier = discord_mod.from_config(cfg)
    if args.notify_test:
        ok = notifier.send_test()
        log.info("Discord 疎通: %s", "OK" if ok else "失敗")
        return 0 if ok else 1

    if not cfg.secrets.anthropic_api_key:
        log.error("🔴 ANTHROPIC_API_KEY が無い（.env を確認する）")
        return 2

    orchestrator = Orchestrator(cfg, dry_run=args.dry_run, force=args.force)
    run_date = date.fromisoformat(args.date) if args.date else None

    try:
        result = orchestrator.run(run_date)
    except SkipRun as exc:
        target = run_date or resolve_run_date(orchestrator.calendar)
        log.info("実行せず: %s", exc)
        if not args.no_notify:
            notifier.send_batched(summary_mod.build_skip(target, str(exc)))
        return 0
    except Exception as exc:  # noqa: BLE001
        log.exception("🔴 実行に失敗した")
        if not args.no_notify:
            notifier.send_batched(summary_mod.build_skip(
                run_date or date.today(), f"実行に失敗: {exc}"))
        return 1

    log.info("=" * 60)
    log.info("対象日 %s / 状態 %s", result.run_date, result.status)
    log.info("約定 %d件 / 手仕舞い %d件 / 判断 %d件",
             len(result.fills), len(result.exits), len(result.decisions))
    state = result.portfolio_state
    if state:
        log.info("総資産 %s円（%+.2f%%）/ 現金 %s円 / 建玉 %d件",
                 f"{state['total_value']:,.0f}", state["total_return_pct"],
                 f"{state['cash']:,.0f}", state["position_count"])
    log.info("APIコスト $%.4f（%d回）", result.cost.get("total_usd", 0), result.cost.get("calls", 0))

    if not args.no_notify:
        sent = notifier.send_batched(summary_mod.build(result, cfg))
        log.info("Discord 通知: %s", "送信" if sent else "送らず")

    return 0


if __name__ == "__main__":
    sys.exit(main())
