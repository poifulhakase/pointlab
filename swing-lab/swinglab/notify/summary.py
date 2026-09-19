"""日次サマリを Discord の embed に組み立てる（SPEC 11）。

🔴 1メッセージ2000文字・embed 10個の制限がある。長い理由は要約して載せる。
🔴 各銘柄に TradingView リンクを付ける（通知からワンタップで手動確認へ・SPEC 11.1）。
🔴 免責を必ず入れる（SPEC 15 コンプライアンス）。
"""

from __future__ import annotations

from typing import Any

from ..money import to_yen, yen_int_str
from .discord import (
    COLOR_BUY, COLOR_HOLD, COLOR_INFO, COLOR_SELL, COLOR_WARN, DISCLAIMER,
    Embed, tradingview_url, truncate,
)

ACTION_LABEL = {"buy": "買い", "sell": "売り", "hold": "様子見"}
OUTCOME_LABEL = {
    "staged": "翌寄りで発注",
    "rejected": "却下",
    "hold": "様子見",
    "skipped": "見送り",
}


def build(result: Any, cfg) -> list[Embed]:
    embeds: list[Embed] = []
    state = result.portfolio_state or {}

    # --- 1. 総括 -------------------------------------------------------
    head = Embed(
        title=f"swing-lab {result.run_date.isoformat()}",
        description=truncate(result.market_view or "（地合いのコメントなし）", 900),
        color=COLOR_WARN if result.risk_off else COLOR_INFO,
        footer=DISCLAIMER,
    )
    if state:
        head.add_field(
            "資産",
            f"総資産 **{state['total_value']:,.0f}円**（{state['total_return_pct']:+.2f}%）\n"
            f"現金 {state['cash']:,.0f}円 / 建玉 {state['position_count']}件 "
            f"/ 投資比率 {state['exposure_pct']:.0f}%\n"
            f"含み損益 {state['unrealized_pnl']:+,.0f}円 / DD {state['drawdown_pct']:.1f}%",
        )
    if result.risk_off:
        head.add_field("🔴 リスクオフ検知（新規を止めた）", "\n".join(f"・{r}" for r in result.risk_off))
    if result.funnel:
        head.add_field("ファネル", " → ".join(f"{k} {v}" for k, v in result.funnel.items()), inline=True)
    cost = result.cost or {}
    if cost:
        mark = "🔴 " if cost.get("over_limit") else ""
        head.add_field("APIコスト", f"{mark}${cost.get('total_usd', 0):.3f} / {cost.get('calls', 0)}回",
                       inline=True)
    embeds.append(head)

    # --- 2. 約定・手仕舞い ---------------------------------------------
    if result.fills:
        e = Embed(title="約定（前回の判断を翌寄りで執行）", color=COLOR_BUY)
        for item in result.fills:
            t = item["trade"]
            e.add_field(
                f"{ACTION_LABEL.get(t.side, t.side)} {t.ticker}",
                f"{t.quantity}株 @ {to_yen(t.price_sen):,.1f}円\n"
                f"[チャート]({tradingview_url(t.ticker)})",
                inline=True,
            )
        embeds.append(e)

    if result.exits:
        e = Embed(title="手仕舞い", color=COLOR_SELL)
        for item in result.exits:
            t = item["trade"]
            pnl = to_yen(t.realized_sen or 0)
            mark = "🟢" if (t.realized_sen or 0) > 0 else "🔴"
            e.add_field(
                f"{mark} {t.ticker}（{t.label}）",
                f"{t.quantity}株 @ {to_yen(t.price_sen):,.1f}円 / 損益 **{pnl:+,.0f}円**\n"
                f"{truncate(t.reason, 120)}\n保有{t.holding_days}営業日",
                inline=False,
            )
        embeds.append(e)

    # --- 3. 今日の判断 --------------------------------------------------
    if result.decisions:
        e = Embed(title="今日の判断", color=COLOR_HOLD)
        for item in result.decisions[:10]:
            d = item["decision"]
            outcome = OUTCOME_LABEL.get(item["outcome"], item["outcome"])
            lines = []
            if d.get("entry"):
                lines.append(
                    f"入 {d['entry']:,.0f} / 損切 {d['stop']:,.0f} / 利確 {d['target']:,.0f}"
                    f"（{d.get('planned_holding_days') or '-'}日）"
                )
            lines.append(f"確信度 {d.get('confidence', 0):.2f}")
            lines.append(truncate(d.get("reason", ""), 300))
            if item.get("note"):
                lines.append(f"→ {truncate(item['note'], 150)}")
            lines.append(f"[チャート]({tradingview_url(d['ticker'])})")
            e.add_field(
                f"{ACTION_LABEL.get(d['action'], d['action'])} {d['ticker']}【{outcome}】",
                "\n".join(lines),
                inline=False,
            )
        embeds.append(e)

    # --- 4. 保有中 ------------------------------------------------------
    positions = state.get("positions") or []
    if positions:
        e = Embed(title="保有中", color=COLOR_INFO)
        for p in positions:
            pnl = p.get("unrealized_pnl", 0)
            mark = "🟢" if pnl > 0 else ("🔴" if pnl < 0 else "⚪")
            e.add_field(
                f"{mark} {p['ticker']}",
                f"{p['quantity']}株 @ {p['avg_price']:,.1f}円 → "
                f"{p.get('current_price', 0):,.1f}円\n"
                f"含み {pnl:+,.0f}円（{p.get('unrealized_pct', 0):+.1f}%）\n"
                f"保有 **{p.get('days_held', 0)}日** / 残り {p.get('days_remaining', 0)}日\n"
                f"損切 {p['stop'] or '-'} / 利確 {p['target'] or '-'}\n"
                f"[チャート]({tradingview_url(p['ticker'])})",
                inline=True,
            )
        embeds.append(e)

    # --- 5. 成績（期待値の分解＋信頼区間） -------------------------------
    perf = result.performance or {}
    if perf.get("件数"):
        ci = perf["勝率95%CI"]
        lines = [
            f"{perf['件数']}トレード（勝{perf['勝ち']} 負{perf['負け']} 時間切れ{perf['時間切れ']}）",
            f"勝率 {perf['勝率']}%（95%CI {ci[0]}〜{ci[1]}%）",
            f"期待値 **{perf['期待値']:+,.0f}円/トレード**",
            f"平均利益 {perf['平均利益']:,.0f} / 平均損失 {perf['平均損失']:,.0f}"
            + (f" / ペイオフ {perf['ペイオフレシオ']}" if perf["ペイオフレシオ"] else ""),
            f"平均保有 {perf['平均保有日数']}営業日",
        ]
        if not perf["統計的に語れる件数か"]:
            lines.append("🔴 件数が少なく、この数字は暫定値（勝率でランク付けしない）")
        embeds.append(Embed(title="成績", description="\n".join(lines), color=COLOR_INFO))

    return embeds


def build_skip(run_date, reason: str) -> list[Embed]:
    return [Embed(
        title=f"swing-lab {run_date} — 実行せず",
        description=truncate(reason, 900),
        color=COLOR_WARN,
        footer=DISCLAIMER,
    )]
