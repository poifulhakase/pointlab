"""日次パイプラインの制御（SPEC 9章）。

実行の順番（🔴 この順序に意味がある）:
  0. 鮮度チェック・営業日判定 → 走らせてよい日か
  1. 前回の発注待ちを**今日の寄り**で約定させる（翌寄り約定の再現・SPEC 10.2）
  2. 保有中の手仕舞い判定を**今日の高安**で行う（SPEC 10.5）
  3. データ取得 → 指標 → プレフィルタ
  4. 銘柄選定AI → 各銘柄の分析AI（並列）
  5. 売買判断AI（ポートフォリオ状態・過去実績・マクロ込み）
  6. リスクガードを通して**発注待ち**に積む（今日は約定させない）
  7. まとめてコミット → ログ → Discord 通知

🔴 冪等性（SPEC 9.1）: 同じ営業日に2回走っても二重約定しない。
🔴 部分失敗の一貫性（SPEC 9.1）: 途中で落ちたらポートフォリオを更新しない。
   すべての判断が終わってから1トランザクションで書く。
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import date, datetime, time as dtime
from typing import Any

import anthropic
import pandas as pd

from .agents.base import AgentError, CostTracker
from .agents.chart import ChartAgent
from .agents.decider import DeciderAgent
from .agents.news import NewsAgent, NoHeadlines, none_result as news_none
from .agents.selector import SelectorAgent
from .agents.supply_demand import SupplyDemandAgent
from .data import fetch as fetch_mod
from .data import indicators as ind_mod
from .data import prefilter as prefilter_mod
from .data.poirobo import DataStaleError, MarketCalendar, PoiroboData
from .learning import outcomes as outcomes_mod
from .logs import RunLogger
from .money import to_sen, to_yen, yen_int_str
from .portfolio import execution as ex
from .portfolio.portfolio import Portfolio, PortfolioError
from .portfolio.store import Store

log = logging.getLogger(__name__)

MARKET_CLOSE = dtime(15, 30)


class SkipRun(Exception):
    """この日は走らせない（休場・データ不足・実行済み）。異常ではない。"""


@dataclass
class RunResult:
    run_date: date
    status: str
    funnel: dict[str, int] = field(default_factory=dict)
    fills: list[dict[str, Any]] = field(default_factory=list)
    exits: list[dict[str, Any]] = field(default_factory=list)
    decisions: list[dict[str, Any]] = field(default_factory=list)
    analyses: list[dict[str, Any]] = field(default_factory=list)
    portfolio_state: dict[str, Any] = field(default_factory=dict)
    performance: dict[str, Any] = field(default_factory=dict)
    market_view: str = ""
    risk_off: list[str] = field(default_factory=list)
    cost: dict[str, Any] = field(default_factory=dict)
    note: str = ""


def resolve_run_date(calendar: MarketCalendar, now: datetime | None = None) -> date:
    """走らせる対象の営業日を決める。

    🔴 大引け前に走らせるとその日の四本値が確定していない。
       当日が営業日でも 15:30 前なら**前営業日**を対象にする（SPEC 13）。
    """
    now = now or datetime.now()
    today = now.date()
    if calendar.is_business_day(today) and now.time() >= MARKET_CLOSE:
        return today
    cursor = today if not calendar.is_business_day(today) else today
    for _ in range(30):
        cursor = cursor.fromordinal(cursor.toordinal() - 1)
        if calendar.is_business_day(cursor):
            return cursor
    raise SkipRun("直近30日に営業日が見つからない")


def order_is_due(decided_on: str, run_date: date) -> bool:
    """この発注待ちを今日約定させてよいか（🔴 先読み防止の要）。

    判断した日より**後**の営業日でなければ約定させない。
    同じ日に判断した注文をその日の寄りで約定させると、
    「その日の終値まで見たうえでその日の始値で買う」ことになり成績が嘘になる。
    """
    return str(decided_on) < run_date.isoformat()


class Orchestrator:
    def __init__(self, cfg, *, dry_run: bool = False, force: bool = False,
                 headline_source: Any = None):
        self.cfg = cfg
        self.dry_run = dry_run
        self.force = force
        self.poirobo = PoiroboData(cfg)
        self.calendar = MarketCalendar(self.poirobo.calendar(), cfg)
        self.store = Store(cfg.path("ops.db_path"))
        self.fetcher = fetch_mod.PriceFetcher(cfg)
        self.tracker = CostTracker(limit_usd=float(cfg.get("ops.daily_cost_alert_usd")))
        self.client = anthropic.Anthropic(api_key=cfg.secrets.anthropic_api_key)
        self.headlines = headline_source or NoHeadlines()
        self.run_logger: RunLogger | None = None

    # ================================================== 本体

    def run(self, run_date: date | None = None) -> RunResult:
        run_date = run_date or resolve_run_date(self.calendar)

        if not self.calendar.is_business_day(run_date):
            raise SkipRun(f"{run_date} は休場（{self.calendar.closed_reason(run_date)}）")
        if not self.store.start_run(run_date, force=self.force):
            raise SkipRun(f"{run_date} はすでに実行済み（--force で再実行）")

        self.run_logger = RunLogger(self.cfg.path("ops.log_dir"), run_date)
        result = RunResult(run_date=run_date, status="running")

        try:
            warnings = self.poirobo.check_freshness(run_date)
            for w in warnings:
                log.warning("鮮度: %s", w)
        except DataStaleError as exc:
            # 🔴 データが取れなければその日の実行はスキップ（欠損を捏造しない・SPEC 13）
            self.store.finish_run(run_date, status="skipped", note=str(exc))
            self.run_logger.finish("skipped", str(exc))
            raise SkipRun(str(exc)) from exc

        portfolio = self.store.load_portfolio(float(self.cfg.get("capital.initial_cash")))
        universe = self.poirobo.universe()
        by_ticker = {s.ticker: s for s in universe}

        # --- 3. 価格・指標（保有銘柄は必ず含める） ---------------------------
        log.info("価格を取得（%d銘柄）", len(universe))
        tickers = [s.ticker for s in universe]
        frames = self.fetcher.fetch(tickers)
        for held in portfolio.positions:
            if held not in frames:
                log.warning("保有中の %s の価格が取れない（簿価で評価する）", held)

        pairs: list[tuple[Any, Any]] = []
        for ticker, frame in frames.items():
            if ticker not in by_ticker:
                continue
            try:
                pairs.append((by_ticker[ticker], ind_mod.compute(frame, self.cfg, ticker)))
            except Exception as exc:  # noqa: BLE001
                log.warning("指標計算に失敗 %s: %s", ticker, exc)

        indicators_by_ticker = {ind.ticker: ind for _, ind in pairs}
        bars_today = self._bars_on(frames, run_date)
        prices_sen = {t: b.close_sen for t, b in bars_today.items()}

        # --- 1. 前回の発注待ちを今日の寄りで約定 ------------------------------
        fills = self._process_pending(portfolio, bars_today, indicators_by_ticker, run_date)
        result.fills = fills

        # --- 2. 保有中の手仕舞い判定 -----------------------------------------
        exits = self._process_exits(portfolio, bars_today, run_date)
        result.exits = exits

        # --- マクロとリスクオフ ---------------------------------------------
        macro = self.poirobo.macro_snapshot()
        macro.update(self.fetcher.fetch_macro())
        result.risk_off = ex.risk_off_reasons(cfg=self.cfg, macro=macro)
        if result.risk_off:
            log.warning("🔴 リスクオフ検知: %s", " / ".join(result.risk_off))

        # --- 3. プレフィルタ -------------------------------------------------
        next_day = self.calendar.next_business_day(run_date)
        high_impact = self.calendar.high_impact_on(next_day)
        prefilter = prefilter_mod.run(pairs, self.cfg, event_days=1 if high_impact else 0)
        result.funnel = dict(prefilter.funnel)
        log.info("プレフィルタ: %s", prefilter.funnel_text())
        self.run_logger.step("prefilter", {
            "funnel": prefilter.funnel,
            "selected": [c.summary(self.cfg) for c in prefilter.selected],
        })

        # --- 4. 選定AI → 分析AI ---------------------------------------------
        candidates = self._select(prefilter.selected)
        analyses = self._analyze(candidates, run_date)
        result.analyses = analyses

        # --- 5. 売買判断AI ---------------------------------------------------
        portfolio.update_peak(portfolio.equity_sen(prices_sen))
        state = portfolio.state_dict(prices_sen, run_date, self.calendar)
        result.portfolio_state = state

        performance = outcomes_mod.summarize(self.store.closed_trades(
            limit=int(self.cfg.get("feedback.recent_n"))
        ))
        result.performance = performance.as_dict()

        decision_payload = self._decide(
            analyses=analyses, state=state, macro=macro,
            performance=performance, next_day=next_day, high_impact=high_impact,
        )
        result.market_view = decision_payload.get("market_view", "")
        decisions = decision_payload.get("decisions", [])

        # --- 6. リスクガード → 発注待ちに積む --------------------------------
        staged = self._stage_orders(
            decisions, portfolio, prices_sen, indicators_by_ticker,
            by_ticker, state, run_date, risk_off=result.risk_off,
        )
        result.decisions = staged

        # --- 7. まとめてコミット ---------------------------------------------
        equity = portfolio.equity_sen(prices_sen)
        portfolio.update_peak(equity)
        result.portfolio_state = portfolio.state_dict(prices_sen, run_date, self.calendar)

        if self.dry_run:
            log.warning("dry-run のため書き込まない")
            result.status = "dry_run"
        else:
            with self.store.transaction():
                for fill in fills:
                    self.store.record_trade(run_date, fill["trade"])
                for item in exits:
                    self.store.record_trade(run_date, item["trade"])
                for a in analyses:
                    for agent_name in ("chart", "supply_demand", "news"):
                        if a.get(agent_name):
                            self.store.record_analysis(run_date, a["ticker"], agent_name,
                                                       a[agent_name])
                for d in staged:
                    self.store.record_decision(run_date, d["decision"],
                                               outcome=d["outcome"], note=d["note"])
                    if d["outcome"] == "staged":
                        self.store.add_pending(run_date, d["decision"], d.get("snapshot"))
                self.store.save_portfolio(portfolio)
                self.store.record_equity(
                    run_date, cash_sen=portfolio.cash_sen, equity_sen=equity,
                    peak_sen=portfolio.peak_equity_sen,
                    drawdown_pct=portfolio.drawdown(equity) * 100.0,
                    position_count=len(portfolio.positions),
                    benchmark=(macro.get("topix") or {}).get("close"),
                )
            result.status = "done"

        result.cost = self.tracker.summary()
        self.store.finish_run(run_date, status=result.status, funnel=result.funnel,
                              cost=result.cost, market_view=result.market_view)
        self.run_logger.step("result", {
            "fills": [f["trade"].as_dict() for f in fills],
            "exits": [e["trade"].as_dict() for e in exits],
            "decisions": [{"decision": d["decision"], "outcome": d["outcome"], "note": d["note"]}
                          for d in staged],
            "portfolio": result.portfolio_state,
            "performance": result.performance,
            "cost": result.cost,
            "risk_off": result.risk_off,
        })
        self.run_logger.finish(result.status)
        return result

    # ================================================== 各段

    def _bars_on(self, frames: dict[str, pd.DataFrame], day: date) -> dict[str, ex.Bar]:
        """その日の四本値。無い銘柄は含めない（取引停止・上場前など）。"""
        stamp = pd.Timestamp(day)
        out: dict[str, ex.Bar] = {}
        for ticker, frame in frames.items():
            if stamp in frame.index:
                out[ticker] = ex.Bar.from_row(frame.loc[stamp])
        return out

    def _process_pending(self, portfolio: Portfolio, bars: dict[str, ex.Bar],
                         indicators: dict[str, Any], run_date: date) -> list[dict[str, Any]]:
        """**前の営業日**に判断した注文を、今日の寄りで約定させる（SPEC 10.2）。

        🔴 先読み防止の要。ここで扱ってよいのは `decided_on < run_date` の注文だけ。
           同じ日に判断した注文をその日の寄りで約定させると、
           **その日の終値まで見たうえでその日の始値で買う**ことになり、成績が嘘になる。
           （--force で同じ日を再実行したときに実際に踏んだ）
        🔴 期限切れも落とす。実行が飛んだ日があると、古い注文が何日も後に約定してしまう。
        """
        expired = self.store.expire_stale_pending(run_date)
        if expired:
            log.warning("%d件の古い発注待ちを失効させた（実行が飛んだ日がある）", expired)

        fills: list[dict[str, Any]] = []
        for order in self.store.pending_orders():
            if not order_is_due(order["decided_on"], run_date):
                # まだ約定日が来ていない（今日判断したぶん）。翌営業日に処理する。
                continue
            ticker = order["ticker"]
            bar = bars.get(ticker)
            if bar is None:
                self.store.resolve_pending(order["id"], status="rejected", on=run_date,
                                           note="その日の四本値が無い（取引停止など）")
                continue

            if order["side"] == "sell":
                # 裁量手仕舞いは翌寄り（SPEC 10.5）
                if ticker not in portfolio.positions:
                    self.store.resolve_pending(order["id"], status="rejected", on=run_date,
                                               note="すでに保有していない")
                    continue
                price = ex.slipped_price(bar.open_sen, float(self.cfg.get("exec.slippage_bps")),
                                         is_buy=False)
                pos = portfolio.positions[ticker]
                fee = ex.exit_fee_sen(price, pos.quantity, self.cfg)
                trade = portfolio.sell(day=run_date, ticker=ticker, price_sen=price, fee_sen=fee,
                                       reason=f"裁量手仕舞い（翌寄り）: {order['reason']}",
                                       label=outcomes_mod.label_trade(
                                           (price - pos.avg_price_sen) * pos.quantity, "裁量"),
                                       calendar=self.calendar)
                self.store.resolve_pending(order["id"], status="filled", on=run_date,
                                           note=f"{to_yen(price)}円で手仕舞い")
                fills.append({"trade": trade, "kind": "sell"})
                continue

            # 買い
            ind = indicators.get(ticker)
            avg_volume = None
            atr_sen = 0
            if ind is not None:
                avg_volume = ind.frame["vol_ma"].iloc[-1]
                avg_volume = None if pd.isna(avg_volume) else float(avg_volume)
                atr = ind.latest.get("atr")
                atr_sen = to_sen(atr) if atr else 0

            equity = portfolio.equity_sen({t: b.close_sen for t, b in bars.items()})
            entry_result, sizing = ex.simulate_entry(
                cfg=self.cfg, next_bar=bar,
                planned_entry_sen=order["entry_sen"] or bar.open_sen,
                stop_sen=order["stop_sen"] or 0,
                equity_sen=equity, cash_sen=portfolio.cash_sen, avg_volume=avg_volume,
            )
            if not entry_result.filled:
                self.store.resolve_pending(order["id"], status="skipped", on=run_date,
                                           note=entry_result.reason)
                log.info("見送り %s: %s", ticker, entry_result.reason)
                continue

            try:
                trade = portfolio.buy(
                    day=run_date, ticker=ticker, quantity=entry_result.quantity,
                    price_sen=entry_result.price_sen, fee_sen=entry_result.fee_sen,
                    stop_sen=order["stop_sen"], target_sen=order["target_sen"],
                    planned_holding_days=order["planned_holding_days"]
                    or int(self.cfg.get("holding.max_days")),
                    time_exit_days=order["time_exit_days"],
                    reason=order["reason"] or "",
                    snapshot={"decided_on": order["decided_on"],
                              "sizing": sizing.detail if sizing else {},
                              "atr_sen": atr_sen},
                    allow_pyramiding=bool(self.cfg.get("risk.allow_pyramiding")),
                )
            except PortfolioError as exc:
                self.store.resolve_pending(order["id"], status="rejected", on=run_date,
                                           note=str(exc))
                log.warning("約定できない %s: %s", ticker, exc)
                continue

            self.store.resolve_pending(order["id"], status="filled", on=run_date,
                                       note=entry_result.reason)
            fills.append({"trade": trade, "kind": "buy"})
            log.info("約定 %s %d株 @%s円", ticker, trade.quantity, to_yen(trade.price_sen))
        return fills

    def _process_exits(self, portfolio: Portfolio, bars: dict[str, ex.Bar],
                       run_date: date) -> list[dict[str, Any]]:
        """利確・損切り・時間手仕舞いを今日の高安で判定（SPEC 10.5）。"""
        exits: list[dict[str, Any]] = []
        for ticker in list(portfolio.positions):
            bar = bars.get(ticker)
            if bar is None:
                continue
            pos = portfolio.positions[ticker]
            days_held = pos.days_held(run_date, self.calendar)
            check = ex.check_exit(cfg=self.cfg, position=pos, bar=bar, days_held=days_held)
            if not check.should_exit:
                continue
            fee = ex.exit_fee_sen(check.price_sen, pos.quantity, self.cfg)
            trade = portfolio.sell(day=run_date, ticker=ticker, price_sen=check.price_sen,
                                   fee_sen=fee, reason=check.reason, label=check.label,
                                   calendar=self.calendar)
            exits.append({"trade": trade, "check": check})
            log.info("手仕舞い %s: %s（%s円・%s）", ticker, check.reason,
                     to_yen(check.price_sen), check.label)
        return exits

    def _select(self, selected: list[Any]) -> list[Any]:
        """銘柄選定AI（SPEC 7.1）。オフなら上位をそのまま使う。"""
        if not selected:
            return []
        if not self.cfg.get("agents.selector", True):
            return selected[: int(self.cfg.get("risk.max_positions"))]

        agent = SelectorAgent(self.cfg, self.client, self.tracker,
                              max_select=int(self.cfg.get("risk.max_positions")))
        summaries = [c.summary(self.cfg) for c in selected]
        try:
            out, record = agent.call(agent.build_user(summaries))
        except AgentError as exc:
            log.warning("選定AIに失敗（プレフィルタ上位をそのまま使う）: %s", exc)
            return selected[: int(self.cfg.get("risk.max_positions"))]

        self.run_logger.agent_call(record)
        self.run_logger.step("selector", out)
        chosen = {row["ticker"]: row for row in out["selected"]}
        result = [c for c in selected if c.ticker in chosen]
        for c in result:
            c.reasons.append(f"選定AI: {chosen[c.ticker]['reason']}")
        log.info("選定AI: %d件 → %s", len(result), [c.ticker for c in result])
        return result

    def _analyze(self, candidates: list[Any], run_date: date) -> list[dict[str, Any]]:
        """チャート・需給・ニュースを**銘柄ごとに並列**で呼ぶ（SPEC 9-4）。"""
        if not candidates:
            return []
        workers = int(self.cfg.get("models.parallel_workers"))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            results = list(pool.map(lambda c: self._analyze_one(c, run_date), candidates))
        return [r for r in results if r]

    def _analyze_one(self, candidate: Any, run_date: date) -> dict[str, Any] | None:
        profile = candidate.profile(self.cfg)
        ind = candidate.indicators
        out: dict[str, Any] = {
            **profile,
            "close": round(ind.latest["close"], 1),
            "prefilter_score": round(candidate.score, 2),
            "indicators": ind.latest,
            "chart": None, "supply_demand": None, "news": None, "ml_prob": None,
        }

        if self.cfg.get("agents.chart", True):
            agent = ChartAgent(self.cfg, self.client, self.tracker)
            try:
                payload, record = agent.call(
                    agent.build_user(profile=profile, indicators=ind), ticker=candidate.ticker)
                out["chart"] = payload
                self.run_logger.agent_call(record)
            except AgentError as exc:
                # 🔴 その銘柄だけスキップ。パイプライン全体は止めない（SPEC 7.6）
                log.warning("チャート分析を飛ばす: %s", exc)

        if self.cfg.get("agents.supply_demand", True):
            agent = SupplyDemandAgent(self.cfg, self.client, self.tracker)
            code = candidate.stock.code
            try:
                payload, record = agent.call(
                    agent.build_user(
                        profile=profile,
                        margin_rows=self.poirobo.margin_for(code),
                        market_flow=self._market_flow(),
                        indicators_latest=ind.latest,
                        horizon_days=int(self.cfg.get("holding.max_days")),
                    ),
                    ticker=candidate.ticker,
                )
                out["supply_demand"] = payload
                self.run_logger.agent_call(record)
            except AgentError as exc:
                log.warning("需給分析を飛ばす: %s", exc)

        if self.cfg.get("agents.news", True):
            headlines = self.headlines.fetch_headlines(candidate.ticker)
            if not headlines:
                # 🔴 ニュースが無いのに LLM を呼ばない（無駄な課金）。明示的に「なし」を入れる。
                out["news"] = news_none()
            else:
                agent = NewsAgent(self.cfg, self.client, self.tracker)
                try:
                    payload, record = agent.call(
                        agent.build_user(profile=profile, headlines=headlines),
                        ticker=candidate.ticker)
                    out["news"] = payload
                    self.run_logger.agent_call(record)
                except AgentError as exc:
                    log.warning("ニュース分析を飛ばす: %s", exc)
                    out["news"] = news_none()

        return out

    def _market_flow(self) -> dict[str, Any]:
        macro = self.poirobo.macro_snapshot()
        return {
            "空売り比率": macro.get("short_sell"),
            "投資部門別（週次・億円）": macro.get("investor_flow"),
            "騰落レシオ25日": macro.get("advance_decline_ratio25"),
        }

    def _decide(self, *, analyses: list[dict[str, Any]], state: dict[str, Any],
                macro: dict[str, Any], performance: Any, next_day: date,
                high_impact: list[dict[str, Any]]) -> dict[str, Any]:
        """売買判断AI（SPEC 7.5）。候補が無くても**保有があれば呼ぶ**（手仕舞い判断のため）。"""
        if not analyses and not state["positions"]:
            log.info("候補も保有も無いので売買判断AIは呼ばない")
            return {"market_view": "候補なし・保有なし", "decisions": []}

        allowed = {a["ticker"] for a in analyses} | {p["ticker"] for p in state["positions"]}
        agent = DeciderAgent(self.cfg, self.client, self.tracker, allowed_tickers=allowed)
        upcoming = [
            {"date": e["date"], "short": e["short"], "label": e["label"],
             "days_until": e["days_until"]}
            for e in self.calendar.events_within(next_day, int(self.cfg.get("holding.max_days")))
        ]
        user = agent.build_user(
            analyses=analyses,
            portfolio_state=state,
            macro=macro,
            feedback=performance.as_dict() if performance.trades else None,
            upcoming_events=upcoming,
            risk_note={
                "max_positions": self.cfg.get("risk.max_positions"),
                "max_position_pct": self.cfg.get("risk.max_position_pct"),
                "max_total_exposure_pct": self.cfg.get("risk.max_total_exposure_pct"),
                "max_holding_days": self.cfg.get("holding.max_days"),
                "min_holding_days": self.cfg.get("holding.min_days"),
                "risk_per_trade_pct": self.cfg.get("risk.risk_per_trade_pct"),
                "翌営業日": next_day.isoformat(),
                "翌営業日の高インパクトイベント": [e["short"] for e in high_impact],
            },
        )
        try:
            payload, record = agent.call(user)
        except AgentError as exc:
            log.error("🔴 売買判断AIに失敗した（今日は何もしない）: %s", exc)
            return {"market_view": f"判断できず: {exc}", "decisions": []}

        self.run_logger.agent_call(record)
        self.run_logger.step("decider", payload)
        return payload

    def _stage_orders(self, decisions: list[dict[str, Any]], portfolio: Portfolio,
                      prices_sen: dict[str, int], indicators: dict[str, Any],
                      by_ticker: dict[str, Any], state: dict[str, Any],
                      run_date: date, *, risk_off: list[str]) -> list[dict[str, Any]]:
        """🔴 最終ガードはコード側（SPEC 7 共通ルール / 10.3）。

        LLM が暴走しても資金とリスクの一線はここが守る。却下した理由は必ず残す。
        """
        staged: list[dict[str, Any]] = []
        buys_accepted = 0
        max_positions = int(self.cfg.get("risk.max_positions"))
        halt_new = bool(risk_off) and self.cfg.get("risk.risk_off_action") == "halt_new"

        equity = portfolio.equity_sen(prices_sen)
        drawdown = portfolio.drawdown(equity)
        throttle = drawdown > float(self.cfg.get("risk.drawdown_throttle"))
        bucket_of = {t: by_ticker[t].fx_sensitivity for t in portfolio.positions if t in by_ticker}
        buckets = portfolio.bucket_exposure(prices_sen, bucket_of)

        for decision in decisions:
            ticker = decision["ticker"]
            action = decision["action"]
            note = ""

            if action == "hold":
                staged.append({"decision": decision, "outcome": "hold", "note": "様子見"})
                continue

            if action == "sell":
                if ticker not in portfolio.positions:
                    note = "保有していないので売れない"
                    staged.append({"decision": decision, "outcome": "rejected", "note": note})
                    continue
                staged.append({"decision": decision, "outcome": "staged",
                               "note": "翌寄りで手仕舞い予定",
                               "snapshot": {"kind": "sell"}})
                continue

            # --- 以下は buy -------------------------------------------------
            if halt_new:
                note = f"リスクオフのため新規停止: {' / '.join(risk_off)}"
            elif throttle:
                note = (f"ドローダウン {drawdown*100:.1f}% が上限 "
                        f"{float(self.cfg.get('risk.drawdown_throttle'))*100:.0f}% を超過＝新規を絞る")
            elif ticker in portfolio.positions and not self.cfg.get("risk.allow_pyramiding"):
                note = "すでに保有中（買い増しは既定オフ）"
            elif len(portfolio.positions) + buys_accepted >= max_positions:
                note = f"同時保有の上限 {max_positions} に達している"
            elif portfolio.exposure(prices_sen) >= float(self.cfg.get("risk.max_total_exposure_pct")):
                note = "総エクスポージャーが上限"
            else:
                stock = by_ticker.get(ticker)
                bucket = stock.fx_sensitivity if stock else "unknown"
                bucket_pct = buckets.get(bucket, 0.0)
                if bucket_pct >= float(self.cfg.get("risk.max_bucket_pct")):
                    note = (f"{bucket} の合計比率 {bucket_pct*100:.0f}% が上限"
                            f"{float(self.cfg.get('risk.max_bucket_pct'))*100:.0f}%（相関対策）")
                else:
                    ind = indicators.get(ticker)
                    atr = (ind.latest.get("atr") if ind else None) or 0
                    ok, reason = ex.validate_stop(
                        cfg=self.cfg,
                        entry_sen=to_sen(decision["entry"]),
                        stop_sen=to_sen(decision["stop"]),
                        atr_sen=to_sen(atr),
                    )
                    if not ok:
                        note = f"ストップ妥当性ガード: {reason}"
                    else:
                        buys_accepted += 1
                        staged.append({
                            "decision": decision, "outcome": "staged",
                            "note": f"翌寄りで発注予定（{reason}）",
                            "snapshot": {"kind": "buy", "analysis_at": run_date.isoformat()},
                        })
                        continue

            log.info("却下 %s: %s", ticker, note)
            staged.append({"decision": decision, "outcome": "rejected", "note": note})

        return staged
