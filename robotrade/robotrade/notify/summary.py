"""チャンネル別の通知フォーマット（DISCORD.md 3章 / SPEC 11）。

大原則（DISCORD.md 4章）:
  - **要点だけ**。生ログは流さない（ノイズになると見なくなる）。詳細は `logs/` とDB。
  - **日々のP&Lを煽らない**。総資産の増減率は**週次の #成績 だけ**に出す。
    日次チャンネルは「何が起きたか」という事実に徹する。
  - ただし**含み損は必ず出す**（SPEC 12.1 損失回避・サンクコスト対策。
    見たくないものから目を背けさせない）。
  - 勝ちと負けを**均等に**扱う（確証バイアス対策）。

送信者は**ぽいロボ**（淡々と事実を報告する）。**ぽよん君**は節目だけ一言添える。
"""

from __future__ import annotations

from datetime import date
from typing import Any

from .discord import (
    ACTION_COLOR, COLOR_BUY, COLOR_HOLD, COLOR_INFO, COLOR_SELL, COLOR_WARN,
    DISCLAIMER, Embed, tradingview_url, truncate,
)

ACTION_LABEL = {"buy": "買い", "sell": "売り", "hold": "様子見"}
OUTCOME_LABEL = {
    "staged": "翌寄りで発注",
    "rejected": "却下",
    "hold": "様子見",
    "skipped": "見送り",
}
REGIME_LABEL = {
    "uptrend": "上昇トレンド", "downtrend": "下降トレンド",
    "range": "レンジ", "unclear": "どっちつかず",
}
TREND_LABEL = {"up": "上", "down": "下", "range": "横"}

def _funnel_steps(funnel: dict[str, Any], analyzed: int) -> list[str]:
    """「対象銘柄 3,678件 → 候補 12件」を組み立てる。

    🔴 **両端だけを出す**（運用者の指示）。プレフィルタの途中の段（第1層・第2層上位）は
       日々の一目では使わないのでここには出さない。各段の件数は `logs/` のスナップショットと
       ダッシュボードで見る（DISCORD.md 4章「要点だけ」）。
    """
    steps: list[str] = []
    if "入力" in funnel:
        steps.append(f"対象銘柄 **{funnel['入力']:,}件**")
    steps.append(f"候補 **{funnel.get('第3層通過', analyzed):,}件**")
    return steps


# ================================================================ 3.1 #判断サマリ


def build_decisions(result: Any, cfg) -> list[Embed]:
    """翌営業日の想定売買（メインの一目）。

    🔴 **数量は出さない**。数量は翌営業日の実際の寄り値からコードが逆算するので、
       この時点では未確定。確定値でない数字を出すと、翌日の約定とズレて混乱する。
    """
    color = int(cfg.get("discord.channels.decisions.color"))
    decisions = result.decisions or []
    staged = [d for d in decisions if d["outcome"] == "staged"]
    passed = [d for d in decisions if d["outcome"] != "staged"]

    head = Embed(
        title=f"判断サマリ {result.run_date.isoformat()}",
        description=truncate(result.market_view or "（地合いのコメントなし）", 900),
        color=COLOR_WARN if result.risk_off else color,
        footer=DISCLAIMER,
    )
    funnel = result.funnel or {}
    analyzed = len(result.analyses or [])
    head.add_field(
        "しぼり込み",
        " → ".join(_funnel_steps(funnel, analyzed))
        + f" → 分析 **{analyzed}件**"
        f" → 新規 **{len(staged)}件** / 見送り **{len(passed)}件**",
        inline=True,
    )
    if result.risk_off:
        head.add_field("🔴 リスクオフ（新規を止めた）",
                       "\n".join(f"・{r}" for r in result.risk_off))

    embeds = [head]

    for item in decisions[:8]:
        d = item["decision"]
        analysis = _analysis_for(result, d["ticker"])
        name = analysis.get("name", "") if analysis else ""
        outcome = OUTCOME_LABEL.get(item["outcome"], item["outcome"])

        card = Embed(
            title=f"{ACTION_LABEL.get(d['action'], d['action'])} {d['ticker']} {name}"
                  f"【{outcome}】",
            color=ACTION_COLOR.get(d["action"], COLOR_HOLD),
        )

        if d.get("entry"):
            card.add_field(
                "水準",
                f"入 {d['entry']:,.0f} / 損切 {d['stop']:,.0f} / 利確 {d['target']:,.0f}\n"
                f"想定 {d.get('planned_holding_days') or '-'}日"
                f"（数量は翌寄りの値から算出）",
                inline=True,
            )
        card.add_field("確信度", f"{d.get('confidence', 0):.2f}", inline=True)

        if analysis:
            card.add_field("各AIの読み", _analysis_line(analysis), inline=False)

        card.add_field("判断の理由", truncate(d.get("reason", ""), 500), inline=False)
        if item.get("note") and item["outcome"] != "staged":
            card.add_field("こちらの処理", truncate(item["note"], 300), inline=False)
        card.add_field("確認", f"[TradingViewで見る]({tradingview_url(d['ticker'])})",
                       inline=False)
        embeds.append(card)

    if not decisions:
        embeds.append(Embed(
            title="今日は売買なし",
            description="候補はあったが、いずれも見送り。無理にトレードしないのも判断のうち。"
                        if analyzed else "条件を満たす候補が無かった。",
            color=COLOR_HOLD,
        ))
    return embeds


def _analysis_for(result: Any, ticker: str) -> dict[str, Any] | None:
    for a in (result.analyses or []):
        if a.get("ticker") == ticker:
            return a
    return None


def _analysis_line(analysis: dict[str, Any]) -> str:
    """チャート・需給・ニュースを**1行ずつ**に圧縮する（要点主義）。"""
    lines = []

    chart = analysis.get("chart") or {}
    if chart:
        regime = REGIME_LABEL.get(chart.get("regime", ""), chart.get("regime", "?"))
        higher = TREND_LABEL.get(chart.get("higher_tf_trend", ""), "?")
        lines.append(
            f"📈 {regime}（週足{higher}）・勢い{chart.get('trend_strength', '?')}"
            f"・位置{chart.get('position', '?')}\n"
            f"　ブレイク出来高 {chart.get('breakout_volume', '?')}"
            f"・スイング適性 {chart.get('swing_fit', '?')}"
        )

    sd = analysis.get("supply_demand") or {}
    if sd:
        event = sd.get("event_in_horizon") or {}
        note = ""
        if event.get("has_event"):
            note = f"・保有期間内に {event.get('event')}（{event.get('days_until')}日後）"
        lines.append(
            f"⚖️ 需給 {sd.get('supply_demand_score', 0):+.2f}"
            f"・売り圧力{sd.get('selling_pressure', '?')}"
            f"・踏み上げ{sd.get('short_squeeze_potential', '?')}{note}"
        )

    news = analysis.get("news") or {}
    if news.get("_no_data"):
        lines.append("📰 ニュース: 取得元が未導入（データなし）")
    elif news:
        lines.append(
            f"📰 材料 {news.get('catalyst', '?')}／強さ {news.get('strength', '?')}"
            f"（出所 {news.get('source_tier', '?')}）"
        )

    ml = analysis.get("ml_prob")
    lines.append("🤖 予測ML: 未導入" if ml is None else f"🤖 予測ML {ml:.2f}")
    return "\n".join(lines)


# ================================================================ 3.2 #約定・保有


def build_fills(result: Any, cfg) -> list[Embed]:
    """今日の約定と保有一覧。動きも保有も無ければ**送らない**（通知の静かさ）。"""
    state = result.portfolio_state or {}
    positions = state.get("positions") or []
    if not result.fills and not result.exits and not positions:
        return []

    color = int(cfg.get("discord.channels.fills.color"))
    embeds: list[Embed] = []

    if result.fills:
        e = Embed(title="約定（前営業日の判断を今日の寄りで執行）", color=COLOR_BUY)
        for item in result.fills:
            t = item["trade"]
            e.add_field(
                f"{ACTION_LABEL.get(t.side, t.side)} {t.ticker}",
                f"{t.quantity:,}株 @ {_yen(t.price_sen)}円\n"
                f"[チャート]({tradingview_url(t.ticker)})",
                inline=True,
            )
        embeds.append(e)

    if result.exits:
        # 🔴 勝ちも負けも同じ導線・同じ重みで出す（確証バイアス対策・SPEC 12.1）
        e = Embed(title="手仕舞い", color=COLOR_SELL)
        for item in result.exits:
            t = item["trade"]
            pnl = _yen_value(t.realized_sen or 0)
            mark = "🟢" if pnl > 0 else "🔴"
            e.add_field(
                f"{mark} {t.ticker}（{t.label}）",
                f"{t.quantity:,}株 @ {_yen(t.price_sen)}円 / 損益 **{pnl:+,.0f}円**\n"
                f"{truncate(t.reason, 140)}\n保有 {t.holding_days}営業日",
                inline=False,
            )
        embeds.append(e)

    if positions:
        max_days = int(cfg.get("holding.max_days"))
        e = Embed(
            title=f"保有中 {len(positions)}件",
            description=f"現金 {state['cash']:,.0f}円 / 投資比率 {state['exposure_pct']:.0f}%",
            color=color,
            footer=DISCLAIMER,
        )
        for p in positions:
            pnl = p.get("unrealized_pnl", 0)
            mark = "🟢" if pnl > 0 else ("🔴" if pnl < 0 else "⚪")
            held = p.get("days_held", 0)
            e.add_field(
                f"{mark} {p['ticker']}　保有 {held}/{max_days}日",
                f"{p['quantity']:,}株 @ {p['avg_price']:,.1f} → {p.get('current_price', 0):,.1f}円\n"
                f"含み **{pnl:+,.0f}円**（{p.get('unrealized_pct', 0):+.1f}%）\n"
                f"損切 {p['stop'] or '-'} / 利確 {p['target'] or '-'}\n"
                f"[チャート]({tradingview_url(p['ticker'])})",
                inline=True,
            )
        embeds.append(e)
    else:
        embeds.append(Embed(title="保有なし", description="建玉ゼロ。現金のみ。",
                            color=COLOR_HOLD, footer=DISCLAIMER))
    return embeds


# ================================================================ 3.3 #成績（週次）


def build_performance(result: Any, cfg, *, history: list[dict[str, Any]],
                      excess: dict[str, Any] | None,
                      recent_losses: list[dict[str, Any]],
                      chart_name: str | None = None) -> list[Embed]:
    """週次の振り返り。**ここだけが総資産の増減を語ってよい場所**（4章）。"""
    color = int(cfg.get("discord.channels.performance.color"))
    state = result.portfolio_state or {}
    perf = result.performance or {}

    head = Embed(
        title=f"成績 {result.run_date.isoformat()} 時点",
        color=color,
        footer=DISCLAIMER,
    )
    if chart_name:
        head.image_url = f"attachment://{chart_name}"

    head.add_field(
        "資産",
        f"総資産 **{state.get('total_value', 0):,.0f}円**"
        f"（{state.get('total_return_pct', 0):+.2f}%）\n"
        f"現金 {state.get('cash', 0):,.0f}円 / 建玉 {state.get('position_count', 0)}件\n"
        f"含み損益 {state.get('unrealized_pnl', 0):+,.0f}円\n"
        f"最大ドローダウン {state.get('drawdown_pct', 0):.1f}%",
        inline=True,
    )

    if excess:
        arrow = "▲" if excess["超過%"] >= 0 else "▼"
        head.add_field(
            "TOPIX比（地合いで勝っただけかを見る）",
            f"自分 {excess['自分%']:+.2f}% / TOPIX {excess['TOPIX%']:+.2f}%\n"
            f"**超過 {arrow} {excess['超過%']:+.2f}%**\n{excess['期間']}",
            inline=True,
        )

    if perf.get("件数"):
        ci = perf["勝率95%CI"]
        lines = [
            f"{perf['件数']}トレード（勝{perf['勝ち']} 負{perf['負け']} "
            f"時間切れ{perf['時間切れ']}）",
            f"勝率 **{perf['勝率']}%**　95%CI {ci[0]}〜{ci[1]}%",
            "",
            "**期待値の分解**",
            f"期待値 **{perf['期待値']:+,.0f}円/トレード**",
            f"= 勝率 {perf['勝率']}% × 平均利益 {perf['平均利益']:,.0f}円",
            f"　− 敗率 {100 - perf['勝率']:.1f}% × 平均損失 {perf['平均損失']:,.0f}円",
        ]
        if perf.get("ペイオフレシオ"):
            lines.append(f"ペイオフレシオ {perf['ペイオフレシオ']}（平均利益÷平均損失）")
        lines.append(f"平均保有 {perf['平均保有日数']}営業日")
        head.add_field("成績", "\n".join(lines), inline=False)

        buckets = perf.get("保有日数別") or {}
        rows = [f"{k}: {v['件数']}件 勝率{v['勝率']}% 平均{v['平均損益']:+,.0f}円"
                for k, v in buckets.items() if v.get("件数")]
        if rows:
            head.add_field("保有日数別（持ちすぎていないか）", "\n".join(rows), inline=False)

        if not perf.get("統計的に語れる件数か"):
            head.add_field(
                "🔴 この数字の読み方",
                f"n={perf['件数']} は少なすぎる（目安30件）。勝率の95%CIが "
                f"{ci[0]}〜{ci[1]}% と広く、50%（無意味）と区別できない。\n"
                "**暫定値**として扱い、勝率でモデルやプロンプトをランク付けしない。",
                inline=False,
            )
    else:
        head.add_field("成績", "まだ手仕舞い済みのトレードがない。", inline=False)

    embeds = [head]

    # 🔴 負けを埋もれさせない（確証バイアス対策・SPEC 12.1）。成績サマリに常設する。
    if recent_losses:
        e = Embed(title="直近の負けトレード", color=COLOR_SELL)
        for t in recent_losses[:5]:
            e.add_field(
                f"🔴 {t['ticker']}（{t.get('label', '')}）",
                f"{t['date']} / {t['realized_pnl']:+,.0f}円 / 保有 {t['holding_days']}営業日\n"
                f"{truncate(t.get('reason', ''), 160)}",
                inline=False,
            )
        embeds.append(e)

    if len(history) < 2:
        embeds.append(Embed(
            title="推移グラフはまだ描けない",
            description="営業日2日ぶんのデータが貯まると出る。",
            color=COLOR_HOLD,
        ))
    return embeds


def poyon_milestone(result: Any, cfg) -> str | None:
    """ぽよん君が一言添える節目かどうか（DISCORD.md 2章・やりすぎない）。

    節目でなければ None。毎回は出さない。
    """
    perf = result.performance or {}
    trades = perf.get("件数", 0)
    milestones = set(cfg.get("discord.milestone_trades", []) or [])

    if trades and trades in milestones:
        if perf.get("統計的に語れる件数か"):
            return (f"{trades}トレードまで来たね。やっと数字を少し信じていい件数だよ。"
                    "ぼくにも読めるかな？")
        return (f"{trades}トレードめだって。まだ数字はふらふらしてるけど、"
                "積み上がっていくのを見るのは楽しいね。")

    state = result.portfolio_state or {}
    if state.get("drawdown_pct", 0) >= float(cfg.get("risk.drawdown_throttle")) * 100:
        return ("ドローダウンが大きくなってるみたい。"
                "でもここは記録して眺める場所だから、慌てなくていいと思うんだ。")
    return None


# ================================================================ 3.4 #エラー・異常


def build_error(*, title: str, detail: str, cfg, kind: str = "障害",
                needs_action: bool = True, when: Any = None) -> list[Embed]:
    """種別・発生時刻・内容・対応の要否（DISCORD.md 3.4）。"""
    color = int(cfg.get("discord.channels.errors.color"))
    embed = Embed(title=f"[{kind}] {title}", color=color, footer=DISCLAIMER)
    embed.add_field("発生", str(when or ""), inline=True)
    embed.add_field("状態", "要対応" if needs_action else "自動復帰", inline=True)
    embed.add_field("内容", truncate(detail, 1000), inline=False)
    return [embed]


def build_skip(run_date: Any, reason: str, cfg) -> list[Embed]:
    """走らせなかった日の連絡。休場は静かに、データ不足は異常として扱う。"""
    is_holiday = "休場" in reason
    return build_error(
        title=f"{run_date} は実行せず",
        detail=reason, cfg=cfg,
        kind="休場" if is_holiday else "データ",
        needs_action=not is_holiday,
        when=run_date,
    )


# ================================================================ 小物


def _yen(sen: int) -> str:
    return f"{sen / 100:,.1f}"


def _yen_value(sen: int) -> float:
    return sen / 100


def should_send_performance(run_date: date, cfg, *, forced: bool = False) -> bool:
    """成績は週次（既定は金曜）。日々のP&Lを煽らないため毎日は出さない（4章）。"""
    if forced:
        return True
    return run_date.weekday() == int(cfg.get("discord.performance_weekday", 4))
