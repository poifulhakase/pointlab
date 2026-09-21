"""ロボトレード エントリポイント。

    .venv/Scripts/python.exe main.py                 # 直近の営業日を対象に1回走らせる
    .venv/Scripts/python.exe main.py --date 2026-09-18
    .venv/Scripts/python.exe main.py --dry-run       # 書き込まない（判断だけ見る）
    .venv/Scripts/python.exe main.py --force         # 実行済みの日をやり直す
    .venv/Scripts/python.exe main.py --weekly        # 成績も出す（既定は金曜だけ）
    .venv/Scripts/python.exe main.py --notify-test   # Discord 4チャンネルの疎通確認
    .venv/Scripts/python.exe main.py --feeds-only    # お知らせフィードのチェックだけ
    .venv/Scripts/python.exe main.py --calendar-only # 今週の予定だけ #相場観測 に出す

🔴 起動 → パイプライン実行 → 通知 → 終了 の一発完結型。常駐しない（SPEC 13）。
🔴 通知は DISCORD.md 1章のとおり**チャンネルごとに振り分ける**。
   異常を日次の一目に混ぜない（ノイズにすると見なくなる）。
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import date, datetime
from pathlib import Path

import anthropic

from robotrade import config as config_mod
from robotrade.agents.base import CostTracker
from robotrade.data import earnings as earnings_mod
from robotrade.data import week_ahead as week_mod
from robotrade.data.poirobo import MarketCalendar, PoiroboData
from robotrade.learning import knowledge as knowledge_mod
from robotrade.learning import outcomes as outcomes_mod
from robotrade.logs import setup_logging
from robotrade.notify import buffer as buffer_mod
from robotrade.notify import chart as chart_mod
from robotrade.notify import discord as discord_mod
from robotrade.notify import feeds as feeds_mod
from robotrade.notify import summary as summary_mod
from robotrade.notify import x_runner as x_mod
from robotrade.orchestrator import AlreadyRan, Orchestrator, SkipRun, resolve_run_date
from robotrade.portfolio.store import Store

log = logging.getLogger("robotrade")


def notify_run(result, cfg, router, *, weekly_forced: bool = False) -> None:
    """結果を4チャンネルに振り分けて送る。"""
    # --- #判断サマリ（毎日） ---
    run_day = result.run_date.isoformat()
    router["decisions"].send_batched(summary_mod.build_decisions(result, cfg),
                                     kind="decisions", run_date=run_day)

    # --- #約定・保有（毎日・動きも保有も無ければ送らない） ---
    fills = summary_mod.build_fills(result, cfg)
    if fills:
        router["fills"].send_batched(fills, kind="fills", run_date=run_day)
    else:
        log.info("#約定・保有: 動きも保有も無いので送らない（通知の静かさ）")

    # --- #エラー・異常（イベント時のみ） ---
    cost = result.cost or {}
    if cost.get("over_limit"):
        router["errors"].send_batched(summary_mod.build_error(
            title="APIコストが上限を超えた", kind="コスト",
            detail=f"1日 ${cost['total_usd']:.3f} > 上限 ${cost['limit_usd']:.2f}\n"
                   f"内訳: {cost.get('by_agent')}\n"
                   "候補銘柄が増えると急増する。screen.top_n / risk.max_positions を見る。",
            cfg=cfg, needs_action=True, when=result.run_date,
        ), kind="error", run_date=run_day)
    if result.risk_off:
        router["errors"].send_batched(summary_mod.build_error(
            title="市場急変を検知して新規を止めた", kind="リスクオフ",
            detail="\n".join(f"・{r}" for r in result.risk_off)
                   + "\n\n中身ではなく「異常度」で手を引くための仕組み（SPEC 10.3）。"
                     "翌営業日に閾値以下へ戻れば自動で再開する。",
            cfg=cfg, needs_action=False, when=result.run_date,
        ), kind="error", run_date=run_day)

    # --- #成績（週次） ---
    if not summary_mod.should_send_performance(result.run_date, cfg, forced=weekly_forced):
        log.info("#成績: 今日は出さない（週次・既定は金曜。--weekly で強制）")
        return

    store = Store(cfg.path("ops.db_path"))
    try:
        history = store.equity_history()
        excess = outcomes_mod.benchmark_excess(history)
        losses = [t for t in store.closed_trades(limit=50)
                  if (t.get("realized_pnl") or 0) <= 0]
    finally:
        store.close()

    files: list[Path] = []
    chart_name = None
    chart_path = cfg.path("ops.cache_dir") / f"equity_{result.run_date.isoformat()}.png"
    if chart_mod.equity_curve(history, chart_path):
        files = [chart_path]
        chart_name = chart_path.name

    embeds = summary_mod.build_performance(
        result, cfg, history=history, excess=excess,
        recent_losses=losses, chart_name=chart_name,
    )
    router["performance"].send_batched(embeds, files=files, kind="performance",
                                       run_date=run_day)

    # ぽよん君は節目だけ（やりすぎない）
    word = summary_mod.poyon_milestone(result, cfg)
    if word:
        router.poyon_on("performance").send(content=word, kind="poyon", run_date=run_day)



def notify_week_ahead(cfg, router, *, forced: bool = False) -> None:
    """今週の予定を #相場観測 へ（週次・既定は月曜）。

    🔴 ここで落ちてもトレードは止めない。カレンダーの書き出しが古い・Webhook 未設定
       といった理由で週次の連絡が出せないだけ、という扱いにする。
    """
    today = date.today()
    if not summary_mod.should_send_calendar(today, cfg, forced=forced):
        log.info("#相場観測: 今日は出さない（週次・既定は月曜。--calendar で強制）")
        return
    try:
        poirobo = PoiroboData(cfg)
        calendar = MarketCalendar(poirobo.calendar(), cfg)
        store = Store(cfg.path("ops.db_path"))
        portfolio = store.load_portfolio(float(cfg.get("capital.initial_cash")))
        week = week_mod.collect(
            today=today,
            calendar=calendar,
            earnings=earnings_mod.from_config(cfg),
            holdings=sorted(portfolio.positions),
        )
        router["calendar"].send_batched(
            summary_mod.build_week_ahead(week, cfg),
            kind="calendar", run_date=week.start.isoformat())
        log.info("#相場観測: 今週の予定を送った（%s〜%s）", week.start, week.end)
    except Exception as exc:  # noqa: BLE001
        log.warning("#相場観測: 今週の予定を出せなかった: %s", exc)



def notify_x(cfg, router) -> None:
    """新着1件を X に予約する（Buffer 経由）。

    🔴 ここで落ちてもトレードは止めない。X が出せないのは「おまけが1つ欠けた」だけで、
       日次の判断とは無関係（NOTE_FEED.md と同じ扱い）。
    """
    try:
        client = buffer_mod.from_config(cfg)
        if client is None:
            return
        runner = x_mod.XRunner(
            cfg,
            buffer_client=client,
            feed_runner=feeds_mod.FeedRunner(cfg, sent_log=router.sent_log),
            llm_client=(anthropic.Anthropic(api_key=cfg.secrets.anthropic_api_key)
                        if cfg.secrets.anthropic_api_key else None),
            tracker=CostTracker(limit_usd=float(cfg.get("ops.daily_cost_alert_usd"))),
        )
        outcome = runner.run()
        log.info("X: %s", outcome.summary())
        for title in outcome.posted:
            log.info("    %s", title[:70])
    except Exception as exc:  # noqa: BLE001
        log.warning("X への投稿を飛ばす: %s", exc)



def run_knowledge(cfg, args) -> int:
    """知識の一覧・承認・撤回（人が使う口）。

    🔴 承認はここからしか行わない。パイプラインが自動で有効にすることはない
       （AI に自分の判断材料を勝手に増やさせない）。
    """
    store = Store(cfg.path("ops.db_path"))
    ks = knowledge_mod.KnowledgeStore(store.conn)

    if args.knowledge_approve:
        ks.approve(args.knowledge_approve)
        log.info("承認した: id=%s", args.knowledge_approve)
        return 0
    if args.knowledge_retire:
        ks.retire(args.knowledge_retire, note="手動")
        log.info("外した: id=%s", args.knowledge_retire)
        return 0

    items = ks.all_for()
    if not items:
        log.info("知識はまだ1件も無い（手仕舞い済みのトレードが貯まってから作る）")
        return 0
    for agent in knowledge_mod.AGENTS:
        rows = [k for k in items if k.agent == agent]
        if not rows:
            continue
        log.info("── %s", agent)
        for k in rows:
            # 🔵 絵文字を使わない。Windows のコンソール（cp932）で出せずログが落ちる
            mark = {"draft": "承認待ち", "active": "有効　　", "retired": "撤回済み"}
            log.info("  [%s] %s  %s  （%s）", k.id, mark.get(k.status, k.status),
                     k.line(), k.learned_at)
    waiting = sum(1 for k in items if k.status == knowledge_mod.DRAFT)
    if waiting:
        log.info("🔵 承認待ちが %d件。`--knowledge-approve <ID>` で有効にする", waiting)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="LLMスイングトレード 疑似トレードマシン")
    parser.add_argument("--date", help="対象の営業日（YYYY-MM-DD）。既定は直近の営業日")
    parser.add_argument("--dry-run", action="store_true", help="DBに書き込まない")
    parser.add_argument("--force", action="store_true", help="実行済みの日をやり直す")
    parser.add_argument("--weekly", action="store_true", help="曜日に関係なく成績も出す")
    parser.add_argument("--no-notify", action="store_true", help="Discord に送らない")
    parser.add_argument("--notify-test", action="store_true",
                        help="Discord 4チャンネルの疎通確認だけして終了")
    parser.add_argument("--purge-test", action="store_true",
                        help="記録してある疎通確認の投稿だけ Discord から消す")
    parser.add_argument("--purge-all", action="store_true",
                        help="記録してある投稿をすべて Discord から消す")
    parser.add_argument("--purge-dry-run", action="store_true",
                        help="消さずに、消える件数だけ出す")
    parser.add_argument("--no-feeds", action="store_true",
                        help="お知らせフィード（note・ポイ活）のチェックをしない")
    parser.add_argument("--feeds-only", action="store_true",
                        help="お知らせフィードのチェックだけして終了（トレードは走らせない）")
    parser.add_argument("--calendar", action="store_true",
                        help="曜日に関係なく「今週の予定」を #相場観測 に出す")
    parser.add_argument("--calendar-only", action="store_true",
                        help="「今週の予定」だけ出して終了（トレードは走らせない）")
    # 専門ごとの「これまでに分かったこと」（learning/knowledge.py）
    parser.add_argument("--knowledge", action="store_true",
                        help="貯まっている知識を一覧して終了")
    parser.add_argument("--knowledge-approve", type=int, metavar="ID",
                        help="🔴 その知識を承認して有効にする（人が判断する）")
    parser.add_argument("--knowledge-retire", type=int, metavar="ID",
                        help="効かなくなった知識を外す（記録は残る）")
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

    router = discord_mod.from_config(cfg)

    if args.knowledge or args.knowledge_approve or args.knowledge_retire:
        return run_knowledge(cfg, args)

    if args.purge_test or args.purge_all:
        kinds = None if args.purge_all else {"test"}
        result = router.purge(kinds=kinds, dry_run=args.purge_dry_run)
        head = "消せる件数" if args.purge_dry_run else "削除"
        log.info("%s: %d件（失敗 %d / 記録に残す %d）",
                 head, result["deleted"], result.get("failed", 0), result["kept"])
        for channel, count in (result.get("by_channel") or {}).items():
            log.info("  %-12s %d件", channel, count)
        if result.get("note"):
            log.warning(result["note"])
        if result["kept"] and not args.purge_dry_run:
            log.info("🔵 記録に無い投稿は消せない（Webhook は自分の投稿を一覧できないため）。"
                     "Discord の画面から手で消す。")
        return 0

    if args.notify_test:
        results = router.send_test_all()
        for name, ok in results.items():
            log.info("  %-12s %s", name, "OK" if ok else "未設定/失敗")
        if router.missing:
            log.warning("未設定のチャンネル: %s（.env に Webhook URL を入れる）", router.missing)
        return 0 if any(results.values()) else 1

    # --- 今週の予定（#相場観測・週次） ---
    # 🔴 トレードより**前**に置く。月曜の朝に出す想定＝まだ引け前なので、
    #    トレードのパイプラインは走らせない（--calendar-only で抜ける）。
    if not args.no_notify:
        notify_week_ahead(cfg, router, forced=args.calendar or args.calendar_only)
    if args.calendar_only:
        return 0

    # --- お知らせフィード（NOTE_FEED.md・おまけ機能） ---
    # 🔴 トレードのスキップ判定より**前**に走らせる。
    #    トレードは休場日・データが古い日に早期 return するので、末尾に置くと
    #    連休のあいだ新着が溜まったまま流れない（9/19〜23 は5日連続の休場）。
    if not (args.no_feeds or args.no_notify):
        for outcome in feeds_mod.FeedRunner(cfg, sent_log=router.sent_log).run(
                dry_run=args.dry_run):
            log.info("お知らせ: %s", outcome.summary())
            for article in outcome.posted[:5]:
                log.info("    %s", article.title[:70])
            if outcome.error:
                log.warning("お知らせ: %s", outcome.summary())
    # --- X への予約投稿（Buffer 経由・1日1件） ---
    # 🔴 フィードの直後に置く。お知らせと同じ「新着を配る」仕事なので、
    #    トレードのスキップ判定より前で完結させる（連休でも止まらない）。
    if not (args.no_feeds or args.no_notify):
        notify_x(cfg, router)
    if args.feeds_only:
        return 0

    if not cfg.secrets.anthropic_api_key:
        log.error("🔴 ANTHROPIC_API_KEY が無い（.env を確認する）")
        return 2

    orchestrator = Orchestrator(cfg, dry_run=args.dry_run, force=args.force)
    run_date = date.fromisoformat(args.date) if args.date else None

    try:
        result = orchestrator.run(run_date)
    except AlreadyRan as exc:
        # 🔴 通知しない。二重起動や手動実行のあとに毎回鳴ると狼少年になる。
        log.info("実行せず: %s", exc)
        return 0
    except SkipRun as exc:
        target = run_date or resolve_run_date(orchestrator.calendar)
        log.info("実行せず: %s", exc)
        if not args.no_notify:
            router["errors"].send_batched(summary_mod.build_skip(target, str(exc), cfg),
                                          kind="error", run_date=target.isoformat())
        return 0
    except Exception as exc:  # noqa: BLE001
        log.exception("🔴 実行に失敗した")
        if not args.no_notify:
            router["errors"].send_batched(summary_mod.build_error(
                title="パイプラインが落ちた", kind="障害",
                detail=f"{type(exc).__name__}: {exc}\n"
                       "ポートフォリオは更新していない（まとめてコミットのため）。"
                       "詳細は logs/ の snapshot.json。",
                cfg=cfg, needs_action=True, when=datetime.now().isoformat(timespec="seconds"),
            ), kind="error")
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
    log.info("APIコスト $%.4f（%d回）", result.cost.get("total_usd", 0),
             result.cost.get("calls", 0))

    if args.no_notify:
        return 0
    if args.dry_run:
        log.warning("dry-run なので通知も送らない")
        return 0

    notify_run(result, cfg, router, weekly_forced=args.weekly)
    return 0


if __name__ == "__main__":
    sys.exit(main())
