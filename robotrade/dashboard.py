"""ローカルダッシュボード（SPEC 12）。

Discord＝プッシュ（届く・流れる）に対し、ここは**プル（じっくり見返す）**。
パイプラインが書き込む**同じ SQLite を読むだけ**（別DB・API不要）。

    .venv/Scripts/python.exe -m streamlit run dashboard.py
    → http://localhost:8501

🔴 **閲覧専用**。ここから発注も判断もしない（マシンの自動フローと人間の観察を分ける）。
🔴 デザインは**超シンプル**。装飾より一覧性。数字と表とライングラフが主役。

観察者バイアス対策（SPEC 12.1）— 装置が正しくても観察者が歪めば学びは歪む:
  - 確証バイアス … 勝ちと負けを均等に表示。履歴は勝ち優先で並べない。
    「直近の負けトレード」を成績サマリに**常設**する。
  - 後知恵バイアス … AIの読みは**判断時点のスナップショット**をそのまま出す。
  - 自動化バイアス … confidence を併記し、単発でなく分布・期待値で見せる。
  - 損失回避 … 含み損のポジションも必ず一覧に出す（目を背けさせない）。
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent))

from robotrade import config as config_mod  # noqa: E402
from robotrade.dashboard_data import DashboardData  # noqa: E402
from robotrade.learning import outcomes as outcomes_mod  # noqa: E402
from robotrade.notify.discord import tradingview_url  # noqa: E402
from robotrade.portfolio.store import Store  # noqa: E402

ACTION_MARK = {"buy": "🟢 買い", "sell": "🔴 売り", "hold": "⚪ 様子見"}
OUTCOME_MARK = {
    "staged": "翌寄りで発注", "rejected": "却下", "hold": "様子見", "skipped": "見送り",
}
REGIME_JP = {
    "uptrend": "上昇トレンド", "downtrend": "下降トレンド",
    "range": "レンジ", "unclear": "どっちつかず",
}

st.set_page_config(page_title="ロボトレード", page_icon="📊", layout="wide")


# ---------------------------------------------------------------- 読み込み


@st.cache_resource
def _load():
    cfg, warnings = config_mod.load()
    # 🔴 読み取り専用で開く（SPEC 12「閲覧専用」をコードで担保する）。
    #    Streamlit は再描画ごとに別スレッドで走るので check_same_thread=False も要る。
    store = Store(cfg.path("ops.db_path"), readonly=True)
    return cfg, warnings, DashboardData(store)


def theme_note() -> None:
    """ライト/ダークの案内（SPEC 12）。

    🔴 自前の切替ボタンは**置かない**。`st.set_option("theme.base", ...)` は
       実行時にテーマを変えられず（1.64 で実測）、押せるのに効かないUIになる。
       Streamlit の標準メニュー（右上 ⋮）に System / Light / Dark の切替があり、
       `.streamlit/config.toml` の `[theme.light]` / `[theme.dark]` がそのまま効く。
       既定は **System＝ブラウザ/OSのモードに追従**。
    """
    st.caption("🌗 ライト/ダークは右上の ⋮ から（既定はOSに追従）")


# ---------------------------------------------------------------- 画面


def view_decisions(data: DashboardData, cfg) -> None:
    """① 今日の意思決定ビュー（目玉）。なぜこの判断かを一目で追う。"""
    runs = data.runs(limit=60)
    if not runs:
        st.info("まだ実行の記録がない。`main.py` を1回走らせると出る。")
        return

    labels = [f"{r.run_date}（{r.status}）" for r in runs]
    picked = st.selectbox("対象日", labels, index=0)
    run = runs[labels.index(picked)]

    st.subheader(f"{run.run_date} の判断")
    if run.market_view:
        st.markdown(f"**地合い**　{run.market_view}")
    if run.note:
        st.warning(run.note)

    cols = st.columns(3)
    funnel = run.funnel or {}
    cols[0].metric("候補（第3層通過）", funnel.get("第3層通過", "—"))
    cols[1].metric("分析した銘柄", len(data.decision_view(run.run_date)))
    cost = run.cost or {}
    cols[2].metric("APIコスト", f"${cost.get('total_usd', 0):.3f}",
                   f"{cost.get('calls', 0)}回")

    if funnel:
        st.caption("しぼり込み　" + " → ".join(f"{k} {v}" for k, v in funnel.items()))

    rows = data.decision_view(run.run_date)
    if not rows:
        st.info("この日は候補が無かった。")
        return

    st.divider()
    for row in rows:
        ticker = row["ticker"]
        decision = row["decision"] or {}
        action = decision.get("action", "—")
        name = (row.get("chart") or {}).get("_name", "")
        header = f"{ACTION_MARK.get(action, action)}　{ticker}　{name}"
        if decision.get("outcome"):
            header += f"　【{OUTCOME_MARK.get(decision['outcome'], decision['outcome'])}】"

        with st.expander(header, expanded=(action == "buy")):
            left, right = st.columns([2, 3])

            with left:
                if decision.get("entry"):
                    st.markdown(
                        f"**水準**　入 {decision['entry']:,.0f} / "
                        f"損切 {decision['stop']:,.0f} / 利確 {decision['target']:,.0f}\n\n"
                        f"想定保有 {decision.get('planned_holding_days') or '—'}日"
                    )
                # 🔴 自動化バイアス対策: 確信度を必ず併記する
                st.markdown(f"**確信度**　{decision.get('confidence', 0):.2f}")
                st.link_button("TradingView で見る", tradingview_url(ticker))
                if decision.get("outcome_note"):
                    st.caption(f"こちら側の処理: {decision['outcome_note']}")

            with right:
                st.markdown("**各AIの読み（判断した時点の記録）**")
                st.dataframe(_agent_table(row), hide_index=True, use_container_width=True)

            if decision.get("reason"):
                st.markdown(f"**判断の理由**　{decision['reason']}")


def _agent_table(row: dict) -> pd.DataFrame:
    """チャート・需給・ニュースを1つの表に並べる（横並びで比べる）。"""
    chart = row.get("chart") or {}
    sd = row.get("supply_demand") or {}
    news = row.get("news") or {}
    event = (sd.get("event_in_horizon") or {})

    records = [
        {"AI": "📈 チャート", "見立て": REGIME_JP.get(chart.get("regime", ""), "—"),
         "詳細": f"週足{chart.get('higher_tf_trend', '—')}／勢い{chart.get('trend_strength', '—')}"
                 f"／位置{chart.get('position', '—')}／適性{chart.get('swing_fit', '—')}",
         "ひとこと": (chart.get("comment") or "")[:120]},
        {"AI": "⚖️ 需給", "見立て": f"{sd.get('supply_demand_score', 0):+.2f}" if sd else "—",
         "詳細": f"売り圧力{sd.get('selling_pressure', '—')}／"
                 f"踏み上げ{sd.get('short_squeeze_potential', '—')}"
                 + (f"／{event.get('event')}まで{event.get('days_until')}日"
                    if event.get("has_event") else ""),
         "ひとこと": (sd.get("comment") or "")[:120]},
        {"AI": "📰 ニュース",
         "見立て": "データなし" if news.get("_no_data") else news.get("catalyst", "—"),
         "詳細": f"強さ{news.get('strength', '—')}／出所{news.get('source_tier', '—')}",
         "ひとこと": (news.get("summary") or "")[:120]},
        {"AI": "🤖 予測ML", "見立て": "未導入", "詳細": "Phase 12", "ひとこと": ""},
    ]
    return pd.DataFrame(records)


def view_portfolio(data: DashboardData, cfg) -> None:
    """② ポートフォリオ現況。保有日数を目立たせる。"""
    state = data.positions(float(cfg.get("capital.initial_cash")), today=date.today())
    latest = data.latest_equity()

    cols = st.columns(4)
    cols[0].metric("総資産", f"{state['equity']:,.0f}円")
    cols[1].metric("現金", f"{state['cash']:,.0f}円")
    cols[2].metric("建玉", f"{len(state['positions'])}件")
    cols[3].metric("ドローダウン", f"{(latest or {}).get('drawdown_pct', 0):.1f}%")

    if not state["positions"]:
        st.info("いまは建玉なし（現金のみ）。")
        return

    max_days = int(cfg.get("holding.max_days"))
    # 🔴 含み損のポジションも必ず出す（損失回避・サンクコスト対策）
    frame = pd.DataFrame([
        {
            "銘柄": p["ticker"],
            "株数": p["quantity"],
            "取得単価": p["avg_price"],
            "損切": p["stop"],
            "利確": p["target"],
            "保有": f"{p.get('days_held', 0)}/{max_days}日",
            "建てた日": p["entry_date"],
        }
        for p in state["positions"]
    ])
    st.dataframe(frame, hide_index=True, use_container_width=True)
    st.caption(
        "🔵 現在値・含み損益は**直近の確定終値**で評価する（日中値は使わない）。"
        "保有日数が上限に達したらコード側が手仕舞う。"
    )


def view_performance(data: DashboardData, cfg) -> None:
    """③ 成績サマリ。グラフが主役。"""
    history = data.equity_history()
    trades = data.trades(limit=500)
    perf = outcomes_mod.summarize(trades)

    if not history:
        st.info("まだ資産の記録がない。")
        return

    frame = pd.DataFrame(history)
    if len(frame) >= 2 and frame["benchmark"].notna().any():
        # 🔴 二軸にしない。総資産（円）と TOPIX（ポイント）は桁が違うので
        #    **両方を起点100に指数化**して1本の軸に載せる（SPEC 10.4）。
        indexed = pd.DataFrame({
            "日付": pd.to_datetime(frame["date"]),
            "ロボトレード": frame["equity"] / frame["equity"].iloc[0] * 100,
            "TOPIX": frame["benchmark"] / frame["benchmark"].dropna().iloc[0] * 100,
        }).set_index("日付")
        st.line_chart(indexed, height=320)
        st.caption("起点=100 に揃えた指数。桁の違う2つを二軸で並べない（勝敗を演出できてしまうため）。")
    else:
        st.line_chart(
            pd.DataFrame({"日付": pd.to_datetime(frame["date"]),
                          "総資産": frame["equity"]}).set_index("日付"),
            height=320,
        )
        st.caption("TOPIX との比較は、営業日2日ぶんのデータが揃うと出る。")

    excess = outcomes_mod.benchmark_excess(history)
    cols = st.columns(4)
    cols[0].metric("トレード数", perf.trades)
    # 🔴 0件のときに「勝率 0.0%」と出さない（負け続けているように読める）。
    if perf.trades:
        cols[1].metric("勝率", f"{perf.win_rate * 100:.1f}%",
                       f"95%CI {perf.win_rate_ci[0]*100:.0f}〜{perf.win_rate_ci[1]*100:.0f}%")
        cols[2].metric("期待値／トレード", f"{perf.expectancy_yen:+,.0f}円")
    else:
        cols[1].metric("勝率", "—", "手仕舞いがまだ無い")
        cols[2].metric("期待値／トレード", "—")
    cols[3].metric("TOPIX比 超過", f"{excess['超過%']:+.2f}%" if excess else "—")

    if perf.trades:
        # 🔴 勝率だけ見ない。期待値の分解を必ず出す（SPEC 10.4）
        st.markdown(
            f"**期待値の分解**　"
            f"{perf.expectancy_yen:+,.0f}円 ＝ "
            f"勝率{perf.win_rate*100:.1f}% × 平均利益{perf.avg_win_yen:,.0f}円 − "
            f"敗率{(1-perf.win_rate)*100:.1f}% × 平均損失{perf.avg_loss_yen:,.0f}円"
        )
        if perf.payoff_ratio:
            st.markdown(f"ペイオフレシオ {perf.payoff_ratio:.2f}　"
                        f"平均保有 {perf.avg_holding_days:.1f}営業日")
        if not perf.reliable:
            # 🔴 自動化バイアス対策: 少数の結果を信じさせない
            st.warning(
                f"n={perf.trades} は少なすぎる（目安30件）。勝率の95%CIが "
                f"{perf.win_rate_ci[0]*100:.0f}〜{perf.win_rate_ci[1]*100:.0f}% と広く、"
                "50%（無意味）と区別できない。**暫定値**として扱い、"
                "勝率でモデルやプロンプトをランク付けしない。"
            )

        buckets = perf.by_holding_days
        rows = [{"保有日数": k, **v} for k, v in buckets.items() if v.get("件数")]
        if rows:
            st.markdown("**保有日数別（持ちすぎていないか）**")
            st.dataframe(pd.DataFrame(rows), hide_index=True, use_container_width=True)

    # 🔴 負けを埋もれさせない。成績サマリに常設する（確証バイアス対策）
    st.markdown("**直近の負けトレード**")
    losses = data.recent_losses()
    if losses:
        st.dataframe(pd.DataFrame(losses), hide_index=True, use_container_width=True)
    else:
        st.caption("まだ負けトレードは無い。")


def view_history(data: DashboardData) -> None:
    """④ トレード履歴・判断ログ。"""
    # 🔴 既定は「すべて」。勝ち優先で並べない（確証バイアス対策）
    choice = st.radio("結果で絞る", ["すべて", "勝ちだけ", "負けだけ"],
                      horizontal=True, index=0)
    trades = data.trades(limit=500, result=choice)
    if trades:
        st.dataframe(pd.DataFrame(trades), hide_index=True, use_container_width=True)
    else:
        st.info("手仕舞い済みのトレードがまだ無い。")

    st.divider()
    st.markdown("**約定（買い・売りの全記録）**")
    fills = data.all_fills(limit=500)
    if fills:
        st.dataframe(pd.DataFrame(fills), hide_index=True, use_container_width=True)
    else:
        st.info("約定がまだ無い。")


def view_ticker(data: DashboardData) -> None:
    """⑤ 銘柄ドリルダウン。"""
    tickers = data.known_tickers()
    if not tickers:
        st.info("まだ銘柄の記録がない。")
        return
    ticker = st.selectbox("銘柄", tickers)
    detail = data.ticker_history(ticker)

    st.link_button("TradingView で見る", tradingview_url(ticker))

    st.markdown("**これまでの判断**")
    if detail["decisions"]:
        st.dataframe(pd.DataFrame(detail["decisions"]), hide_index=True,
                     use_container_width=True)
    else:
        st.caption("判断の記録なし。")

    st.markdown("**約定**")
    if detail["trades"]:
        st.dataframe(pd.DataFrame(detail["trades"]), hide_index=True,
                     use_container_width=True)
    else:
        st.caption("約定なし。")

    st.markdown("**各AIの読み（日付ごと・判断した時点の記録）**")
    for run_date, agents in list(detail["analyses"].items())[:10]:
        with st.expander(run_date):
            st.json(agents, expanded=False)


def view_ops(data: DashboardData, warnings: list[str]) -> None:
    """⑥ 運用（後回しの項目）: APIコスト推移・実行の記録。"""
    costs = data.cost_history()
    if costs:
        frame = pd.DataFrame(costs)
        st.line_chart(
            frame.assign(日付=pd.to_datetime(frame["date"])).set_index("日付")[["usd"]],
            height=260,
        )
        st.caption(f"合計 ${frame['usd'].sum():.2f} / {int(frame['calls'].sum())}回")
    else:
        st.info("コストの記録がまだ無い。")

    st.markdown("**実行の記録**")
    runs = data.runs(limit=60)
    st.dataframe(
        pd.DataFrame([
            {"日付": r.run_date, "状態": r.status, "開始": r.started_at,
             "終了": r.finished_at, "備考": r.note}
            for r in runs
        ]),
        hide_index=True, use_container_width=True,
    )

    if warnings:
        st.markdown("**設定の警告**")
        for w in warnings:
            st.warning(w)


# ---------------------------------------------------------------- 本体


def main() -> None:
    try:
        cfg, warnings, data = _load()
    except FileNotFoundError:
        st.title("📊 ロボトレード")
        st.info("まだ実行の記録がない。`main.py` を1回走らせると、この画面に出る。")
        return
    except Exception as exc:  # noqa: BLE001
        st.error(f"読み込みに失敗した: {exc}")
        return

    with st.sidebar:
        st.title("📊 ロボトレード")
        st.caption("疑似トレードの観察用。ここから発注も判断もしない。")
        theme_note()
        st.divider()
        page = st.radio(
            "画面",
            ["① 今日の意思決定", "② ポートフォリオ現況", "③ 成績", "④ 履歴",
             "⑤ 銘柄ドリルダウン", "⑥ 運用"],
            label_visibility="collapsed",
        )
        st.divider()
        if st.button("読み直す", use_container_width=True):
            st.cache_resource.clear()
            st.rerun()
        st.caption("※ 疑似トレードの実験であり投資助言ではありません")

    if page.startswith("①"):
        view_decisions(data, cfg)
    elif page.startswith("②"):
        view_portfolio(data, cfg)
    elif page.startswith("③"):
        view_performance(data, cfg)
    elif page.startswith("④"):
        view_history(data)
    elif page.startswith("⑤"):
        view_ticker(data)
    else:
        view_ops(data, warnings)


main()
