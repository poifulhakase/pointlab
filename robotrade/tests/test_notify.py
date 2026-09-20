"""Discord 通知のテスト（DISCORD.md 1〜4章）。

実際には送らない（requests をモックする）。見るのは:
  - チャンネルの振り分けと送信者（ぽいロボ／ぽよん君）
  - Discord の上限（2000字 / embed 10個 / 6000字 / 25フィールド）で落ちないか
  - 運用ルール（日々のP&Lを煽らない・静かさ・負けを埋もれさせない）が形になっているか
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

import pytest

from robotrade.money import to_sen
from robotrade.notify import discord as dmod
from robotrade.notify import summary as smod


# ------------------------------------------------------------------ 足場


class FakePost:
    """requests.post の差し替え。送られた payload を貯める。"""

    def __init__(self, status=204):
        self.calls: list[dict[str, Any]] = []
        self.status = status

    def __call__(self, url, json=None, data=None, files=None, timeout=None):
        self.calls.append({"url": url, "json": json, "data": data, "files": files})

        class R:
            status_code = self.status
            text = ""

        return R()


@dataclass
class FakeTrade:
    ticker: str = "7203.T"
    side: str = "buy"
    quantity: int = 100
    price_sen: int = 300000
    cost_sen: int = 150
    reason: str = "翌寄り約定"
    realized_sen: int | None = None
    holding_days: int | None = None
    label: str | None = None

    def as_dict(self):
        return {"ticker": self.ticker}


@dataclass
class FakeResult:
    run_date: date = date(2026, 9, 18)
    status: str = "done"
    funnel: dict = field(default_factory=lambda: {"入力": 3678, "第3層通過": 12})
    fills: list = field(default_factory=list)
    exits: list = field(default_factory=list)
    decisions: list = field(default_factory=list)
    analyses: list = field(default_factory=list)
    portfolio_state: dict = field(default_factory=dict)
    performance: dict = field(default_factory=dict)
    market_view: str = "円安と米株高でリスクオン。過熱銘柄が多く新規は厳選。"
    risk_off: list = field(default_factory=list)
    cost: dict = field(default_factory=lambda: {"total_usd": 0.1, "calls": 10,
                                                "limit_usd": 3.0, "over_limit": False})


def a_decision(action="buy", ticker="6986.T", outcome="staged", note=""):
    return {
        "decision": {
            "action": action, "ticker": ticker, "entry": 806.0, "stop": 735.0,
            "target": 880.0, "planned_holding_days": 7, "confidence": 0.45,
            "reason": "週足・日足とも上昇トレンドでレジスタンスを出来高確認済みでブレイク。",
            "exit_conditions": {"take_profit": 880.0, "stop_loss": 735.0, "time_exit_days": 7},
        },
        "outcome": outcome,
        "note": note,
    }


def an_analysis(ticker="6986.T"):
    return {
        "ticker": ticker, "name": "双葉電子工業", "sector": "電気機器",
        "fx_sensitivity": "yen_weak", "price_class": "mid", "close": 806.0,
        "chart": {"regime": "uptrend", "higher_tf_trend": "up", "trend_strength": "strong",
                  "position": "overbought", "band_state": "expansion",
                  "breakout_volume": "confirmed", "swing_fit": "good"},
        "supply_demand": {"supply_demand_score": 0.35, "selling_pressure": "mid",
                          "short_squeeze_potential": "low",
                          "event_in_horizon": {"has_event": False, "event": "", "days_until": None}},
        "news": {"_no_data": True, "catalyst": "none"},
        "ml_prob": None,
    }


def a_position(ticker="6986.T", pnl=-1200.0, days=3):
    return {
        "ticker": ticker, "quantity": 700, "avg_price": 800.4, "current_price": 798.6,
        "unrealized_pnl": pnl, "unrealized_pct": -0.2, "days_held": days,
        "days_remaining": 11 - days, "stop": 735.0, "target": 880.0,
    }


# ------------------------------------------------------------------ ルーター


def test_router_reports_missing_channels(cfg):
    router = dmod.from_config(cfg)
    # .env の埋まり方に関わらず、4チャンネルとも定義されている
    assert set(router.channels) == {"decisions", "fills", "performance", "errors"}
    assert set(router.configured) | set(router.missing) == set(router.channels)


def test_unset_webhook_does_not_pretend_to_send(caplog):
    """🔴「送ったつもり」を作らない。無効なら False を返す。"""
    n = dmod.DiscordNotifier(None, label="decisions")
    assert n.send(content="x") is False


def test_sender_identity_is_poirobo(cfg, monkeypatch):
    post = FakePost()
    monkeypatch.setattr(dmod.requests, "post", post)
    n = dmod.DiscordNotifier("https://example.test/hook", username="ぽいロボ｜判断",
                             avatar_url="https://example.test/robo.png")
    n.send(embeds=[dmod.Embed(title="t")])
    body = post.calls[0]["json"]
    assert body["username"] == "ぽいロボ｜判断"
    assert body["avatar_url"].endswith("robo.png")


def test_poyon_posts_to_same_channel_with_own_identity(cfg, monkeypatch):
    post = FakePost()
    monkeypatch.setattr(dmod.requests, "post", post)
    router = dmod.from_config(cfg)
    router.channels["performance"].webhook_url = "https://example.test/hook"
    router.channels["performance"].enabled = True

    router.poyon_on("performance").send(content="ぼくにもできるかな？")
    body = post.calls[0]["json"]
    assert body["username"] == "ぽよん君"
    assert body["content"] == "ぼくにもできるかな？"


# ------------------------------------------------------------------ 上限（4章）


def test_send_batched_splits_over_ten_embeds(monkeypatch):
    post = FakePost()
    monkeypatch.setattr(dmod.requests, "post", post)
    n = dmod.DiscordNotifier("https://example.test/hook")
    n.send_batched([dmod.Embed(title=f"e{i}") for i in range(23)])
    assert len(post.calls) == 3                       # 10 + 10 + 3
    assert len(post.calls[0]["json"]["embeds"]) == 10
    assert len(post.calls[2]["json"]["embeds"]) == 3


def test_send_batched_splits_over_character_budget(monkeypatch):
    post = FakePost()
    monkeypatch.setattr(dmod.requests, "post", post)
    n = dmod.DiscordNotifier("https://example.test/hook")
    big = [dmod.Embed(title="t", description="あ" * 3000) for _ in range(4)]
    n.send_batched(big)
    assert len(post.calls) >= 2                       # 6000字上限で割れている
    for call in post.calls:
        total = sum(len(str(e)) for e in call["json"]["embeds"])
        assert total <= dmod.MAX_EMBED_TOTAL * 1.2    # 目安内に収まっている


def test_field_value_is_truncated():
    e = dmod.Embed().add_field("n", "あ" * 3000)
    assert len(e.fields[0]["value"]) <= dmod.MAX_FIELD_VALUE
    assert e.fields[0]["value"].endswith("…")


def test_fields_are_capped_at_25():
    e = dmod.Embed()
    for i in range(40):
        e.add_field(f"f{i}", "v")
    assert len(e.to_payload()["fields"]) == dmod.MAX_FIELDS


def test_content_is_truncated():
    assert len(dmod.truncate("あ" * 5000, dmod.MAX_CONTENT)) == dmod.MAX_CONTENT


def test_tradingview_url():
    assert dmod.tradingview_url("7203.T").endswith("symbol=TSE:7203")


# ------------------------------------------------------------------ 3.1 #判断サマリ


def test_decisions_embed_shape(cfg):
    result = FakeResult(
        decisions=[a_decision(), a_decision(action="hold", ticker="8362.T", outcome="hold")],
        analyses=[an_analysis()],
    )
    embeds = smod.build_decisions(result, cfg)
    head = embeds[0]
    assert "判断サマリ" in head.title
    assert result.market_view in head.description
    assert any("しぼり込み" in f["name"] for f in head.fields)
    assert len(embeds) == 3                            # 総括 + カード2枚


def test_decisions_show_universe_before_candidates(cfg):
    """🔴 候補の**前**に、何銘柄から絞ったか（対象銘柄）を出す。"""
    result = FakeResult(
        decisions=[a_decision()], analyses=[an_analysis()],
        funnel={"入力": 3678, "第1層通過": 1014, "第2層上位15": 15, "第3層通過": 12},
    )
    value = next(f["value"] for f in smod.build_decisions(result, cfg)[0].fields
                 if f["name"] == "しぼり込み")
    assert value.startswith("対象銘柄 **3,678件** → 候補 **12件** → 分析 **1件**")
    # 途中の段は日々の一目に出さない（詳細は logs/ とダッシュボード）
    assert "1,014" not in value


def test_decisions_funnel_survives_missing_steps(cfg):
    """ファネルが空でも落ちない（対象銘柄を省き、候補は分析件数で代用）。"""
    result = FakeResult(decisions=[a_decision()], analyses=[an_analysis()], funnel={})
    value = next(f["value"] for f in smod.build_decisions(result, cfg)[0].fields
                 if f["name"] == "しぼり込み")
    assert value.startswith("候補 **1件**")


def test_decisions_card_has_no_english_enums(cfg):
    """🔴 通知に英語を出さない（strong / overbought などをそのまま載せない）。"""
    result = FakeResult(decisions=[a_decision()], analyses=[an_analysis()])
    card = smod.build_decisions(result, cfg)[1]
    reading = next(f["value"] for f in card.fields if f["name"] == "各AIの読み")
    for raw in ("strong", "overbought", "confirmed", "good", "uptrend", "mid", "low"):
        assert raw not in reading
    assert "勢い強い" in reading and "位置買われすぎ" in reading
    assert "ブレイクの出来高 伴った" in reading and "スイング適性 向く" in reading
    assert "売り圧力中" in reading and "踏み上げ低" in reading


def test_decisions_card_drops_confidence_and_link_heading(cfg):
    """確信度は出さない／リンクは見出しそのものに持たせる（2026-09-20）。"""
    card = smod.build_decisions(FakeResult(decisions=[a_decision()],
                                           analyses=[an_analysis()]), cfg)[1]
    names = [f["name"] for f in card.fields]
    assert "確信度" not in names
    assert "確認" not in names
    assert card.url == dmod.tradingview_url("6986.T")


def test_exit_label_is_japanese(cfg):
    """DBの win/loss/time_exit をそのまま出さない。"""
    trade = FakeTrade(side="sell", realized_sen=-12000, holding_days=5, label="time_exit")
    result = FakeResult(exits=[{"trade": trade}])
    text = "".join(f["name"] + f["value"]
                   for e in smod.build_fills(result, cfg) for f in e.fields)
    assert "時間切れ" in text
    assert "time_exit" not in text


def test_decisions_do_not_show_quantity(cfg):
    """🔴 数量は翌寄りにコードが決めるので、この時点では出さない。"""
    result = FakeResult(decisions=[a_decision()], analyses=[an_analysis()])
    text = "".join(f["value"] for e in smod.build_decisions(result, cfg) for f in e.fields)
    assert "株" not in text
    assert "翌寄り" in text


def test_decisions_include_each_agent_reading(cfg):
    result = FakeResult(decisions=[a_decision()], analyses=[an_analysis()])
    text = "".join(f["value"] for e in smod.build_decisions(result, cfg) for f in e.fields)
    assert "上昇トレンド" in text          # チャートAI
    assert "需給" in text                  # 需給AI
    assert "データなし" in text            # ニュースは未導入を正直に出す
    assert "未導入" in text                # ml_prob も同様


def test_decisions_show_rejection_reason(cfg):
    result = FakeResult(
        decisions=[a_decision(outcome="rejected", note="ストップ妥当性ガード: stop が近すぎる")],
        analyses=[an_analysis()],
    )
    text = "".join(f["value"] for e in smod.build_decisions(result, cfg) for f in e.fields)
    assert "ストップ妥当性ガード" in text


def test_decisions_no_trade_day_says_so(cfg):
    embeds = smod.build_decisions(FakeResult(), cfg)
    assert any("売買なし" in (e.title or "") for e in embeds)


def test_risk_off_is_flagged_in_head(cfg):
    result = FakeResult(risk_off=["TOPIX が -3.5%（急落 3%超）"])
    head = smod.build_decisions(result, cfg)[0]
    assert any("リスクオフ" in f["name"] for f in head.fields)
    assert head.color == dmod.COLOR_WARN


# ------------------------------------------------------------------ 3.2 #約定・保有


def test_fills_channel_is_silent_when_nothing_happened(cfg):
    """🔴 通知の静かさ（4章）。動きも保有も無い日は送らない。"""
    assert smod.build_fills(FakeResult(portfolio_state={"positions": []}), cfg) == []


def test_fills_shows_unrealized_loss(cfg):
    """🔴 含み損から目を背けさせない（SPEC 12.1 損失回避対策）。"""
    result = FakeResult(portfolio_state={
        "positions": [a_position(pnl=-1200.0)], "cash": 4_400_000, "exposure_pct": 11.0,
    })
    text = "".join(f["value"] for e in smod.build_fills(result, cfg) for f in e.fields)
    assert "-1,200円" in text
    assert "🔴" in "".join(f["name"] for e in smod.build_fills(result, cfg) for f in e.fields)


def test_fills_shows_holding_days_out_of_max(cfg):
    result = FakeResult(portfolio_state={
        "positions": [a_position(days=9)], "cash": 1.0, "exposure_pct": 1.0,
    })
    names = "".join(f["name"] for e in smod.build_fills(result, cfg) for f in e.fields)
    assert f"9/{cfg.get('holding.max_days')}日" in names


def test_fills_does_not_headline_total_return(cfg):
    """🔴 日々のP&Lを煽らない（4章）。総資産の増減率は週次の #成績 だけ。"""
    result = FakeResult(portfolio_state={
        "positions": [a_position()], "cash": 4_400_000, "exposure_pct": 11.0,
        "total_value": 5_010_000, "total_return_pct": 0.20,
    })
    text = "".join(
        (e.title or "") + (e.description or "") + "".join(f["value"] for f in e.fields)
        for e in smod.build_fills(result, cfg)
    )
    assert "総資産" not in text
    assert "+0.20%" not in text


def test_exits_show_wins_and_losses_the_same_way(cfg):
    """勝ちと負けを同じ導線・同じ重みで出す（確証バイアス対策）。"""
    win = FakeTrade(side="sell", realized_sen=to_sen(9945), holding_days=5, label="win",
                    reason="利確到達")
    loss = FakeTrade(side="sell", ticker="8362.T", realized_sen=to_sen(-5000),
                     holding_days=3, label="loss", reason="損切り到達")
    result = FakeResult(exits=[{"trade": win, "check": None}, {"trade": loss, "check": None}],
                        portfolio_state={"positions": []})
    fields = [f for e in smod.build_fills(result, cfg) for f in e.fields]
    assert len(fields) == 2
    assert all(f["inline"] is False for f in fields)   # 同じ見え方
    assert any("🟢" in f["name"] for f in fields)
    assert any("🔴" in f["name"] for f in fields)


# ------------------------------------------------------------------ 3.3 #成績


def test_performance_is_weekly_by_default(cfg):
    friday, monday = date(2026, 9, 25), date(2026, 9, 28)
    assert friday.weekday() == 4 and monday.weekday() == 0
    assert smod.should_send_performance(friday, cfg) is True
    assert smod.should_send_performance(monday, cfg) is False
    assert smod.should_send_performance(monday, cfg, forced=True) is True


def test_performance_warns_when_sample_is_small(cfg):
    result = FakeResult(performance={
        "件数": 8, "勝ち": 5, "負け": 3, "時間切れ": 0, "勝率": 62.5,
        "勝率95%CI": [30.6, 86.3], "平均利益": 10000, "平均損失": 5000,
        "ペイオフレシオ": 2.0, "期待値": 4375, "平均保有日数": 5.2,
        "保有日数別": {}, "統計的に語れる件数か": False,
    }, portfolio_state={"total_value": 5_030_000, "total_return_pct": 0.6})
    embeds = smod.build_performance(result, cfg, history=[], excess=None, recent_losses=[])
    text = "".join(f["value"] for e in embeds for f in e.fields)
    assert "暫定値" in text
    assert "ランク付けしない" in text
    assert "95%CI" in text


def test_performance_decomposes_expectancy(cfg):
    """🔴 勝率だけ見ない。期待値の分解を必ず出す（SPEC 10.4）。"""
    result = FakeResult(performance={
        "件数": 40, "勝ち": 24, "負け": 16, "時間切れ": 3, "勝率": 60.0,
        "勝率95%CI": [44.6, 73.7], "平均利益": 10000, "平均損失": 5000,
        "ペイオフレシオ": 2.0, "期待値": 4000, "平均保有日数": 6.0,
        "保有日数別": {"2-4日": {"件数": 10, "勝率": 70.0, "平均損益": 3000}},
        "統計的に語れる件数か": True,
    }, portfolio_state={"total_value": 5_160_000, "total_return_pct": 3.2})
    text = "".join(f["value"] for e in smod.build_performance(
        result, cfg, history=[], excess=None, recent_losses=[]) for f in e.fields)
    assert "期待値の分解" in text
    assert "平均利益" in text and "平均損失" in text
    assert "ペイオフレシオ" in text
    assert "保有日数別" in "".join(f["name"] for e in smod.build_performance(
        result, cfg, history=[], excess=None, recent_losses=[]) for f in e.fields)


def test_performance_shows_benchmark_excess(cfg):
    result = FakeResult(portfolio_state={"total_value": 5_160_000, "total_return_pct": 3.2})
    excess = {"期間": "09/18〜10/18", "自分%": 10.0, "TOPIX%": 4.0, "超過%": 6.0}
    text = "".join(f["value"] for e in smod.build_performance(
        result, cfg, history=[], excess=excess, recent_losses=[]) for f in e.fields)
    assert "TOPIX" in text and "超過" in text


def test_performance_keeps_recent_losses_visible(cfg):
    """🔴 負けを埋もれさせない（確証バイアス対策・SPEC 12.1）。成績に常設する。"""
    losses = [{"date": "2026-10-01", "ticker": "8362.T", "realized_pnl": -5000,
               "holding_days": 3, "label": "loss", "reason": "損切り到達"}]
    embeds = smod.build_performance(FakeResult(), cfg, history=[], excess=None,
                                    recent_losses=losses)
    assert any("負けトレード" in (e.title or "") for e in embeds)


def test_performance_attaches_chart_by_reference(cfg):
    embeds = smod.build_performance(FakeResult(), cfg, history=[], excess=None,
                                    recent_losses=[], chart_name="equity.png")
    assert embeds[0].image_url == "attachment://equity.png"
    assert embeds[0].to_payload()["image"]["url"] == "attachment://equity.png"


# ------------------------------------------------------------------ ぽよん君（2章）


def test_poyon_stays_quiet_on_ordinary_days(cfg):
    result = FakeResult(performance={"件数": 7, "統計的に語れる件数か": False},
                        portfolio_state={"drawdown_pct": 2.0})
    assert smod.poyon_milestone(result, cfg) is None


def test_poyon_speaks_at_milestone(cfg):
    milestone = int(cfg.get("discord.milestone_trades")[0])
    result = FakeResult(performance={"件数": milestone, "統計的に語れる件数か": False},
                        portfolio_state={"drawdown_pct": 1.0})
    word = smod.poyon_milestone(result, cfg)
    assert word and str(milestone) in word


def test_poyon_speaks_on_deep_drawdown(cfg):
    limit = float(cfg.get("risk.drawdown_throttle")) * 100
    result = FakeResult(performance={"件数": 7, "統計的に語れる件数か": False},
                        portfolio_state={"drawdown_pct": limit + 1})
    assert "ドローダウン" in (smod.poyon_milestone(result, cfg) or "")


# ------------------------------------------------------------------ 3.4 #エラー・異常


def test_error_embed_has_kind_state_and_detail(cfg):
    embeds = smod.build_error(title="APIコストが上限を超えた", kind="コスト",
                              detail="$3.5 > $3.0", cfg=cfg, needs_action=True,
                              when="2026-09-18")
    e = embeds[0]
    assert e.title.startswith("[コスト]")
    assert e.color == int(cfg.get("discord.channels.errors.color"))
    values = {f["name"]: f["value"] for f in e.fields}
    assert values["状態"] == "要対応"
    assert "$3.5" in values["内容"]


def test_holiday_skip_is_not_treated_as_a_fault(cfg):
    """休場は異常ではない。対応不要として出す。"""
    e = smod.build_skip(date(2026, 9, 21), "2026-09-21 は休場（祝日）", cfg)[0]
    assert e.title.startswith("[休場]")
    assert {f["name"]: f["value"] for f in e.fields}["状態"] == "自動復帰"


def test_data_stale_skip_needs_action(cfg):
    e = smod.build_skip(date(2026, 9, 18), "参照データが古い: stock_master.json", cfg)[0]
    assert e.title.startswith("[データ]")
    assert {f["name"]: f["value"] for f in e.fields}["状態"] == "要対応"


# ------------------------------------------------------------------ 免責（15章）


@pytest.mark.parametrize("builder", ["decisions", "fills", "performance", "errors"])
def test_every_channel_carries_the_disclaimer(cfg, builder):
    """🔴 通知に免責を明記する（SPEC 15 コンプライアンス）。"""
    if builder == "decisions":
        embeds = smod.build_decisions(FakeResult(), cfg)
    elif builder == "fills":
        embeds = smod.build_fills(
            FakeResult(portfolio_state={"positions": [a_position()], "cash": 1, "exposure_pct": 1}),
            cfg)
    elif builder == "performance":
        embeds = smod.build_performance(FakeResult(), cfg, history=[], excess=None,
                                        recent_losses=[])
    else:
        embeds = smod.build_error(title="t", detail="d", cfg=cfg)
    assert any(dmod.DISCLAIMER in (e.footer or "") for e in embeds)


# ------------------------------------------------------------------ 送信記録と削除


class FakeResponse:
    def __init__(self, status=200, body=None):
        self.status_code = status
        self._body = body or {}
        self.text = ""

    def json(self):
        return self._body


def test_message_id_is_recorded_on_send(tmp_path, monkeypatch):
    """🔴 Webhook は自分の投稿を一覧できない。送った瞬間に id を残さないと消せない。"""
    sent = dmod.SentLog(tmp_path / "sent.jsonl")
    posted = {}

    def fake_post(url, json=None, data=None, files=None, timeout=None):
        posted["url"] = url
        return FakeResponse(200, {"id": "999"})

    monkeypatch.setattr(dmod.requests, "post", fake_post)
    n = dmod.DiscordNotifier("https://example.test/hook", sent_log=sent, channel="errors")
    assert n.send(content="x", kind="test", run_date="2026-09-18") is True

    # ?wait=true が付いていないと message_id は返ってこない
    assert "wait=true" in posted["url"]
    rows = sent.rows()
    assert len(rows) == 1
    assert rows[0]["message_id"] == "999"
    assert rows[0]["channel"] == "errors"
    assert rows[0]["kind"] == "test"


def test_wait_param_is_appended_safely(monkeypatch):
    """URL にすでにクエリがある場合でも壊さない。"""
    n = dmod.DiscordNotifier("https://example.test/hook?x=1")
    assert n._wait_url().endswith("?x=1&wait=true")


def test_missing_message_id_is_warned(tmp_path, monkeypatch, caplog):
    sent = dmod.SentLog(tmp_path / "sent.jsonl")
    monkeypatch.setattr(dmod.requests, "post",
                        lambda *a, **k: FakeResponse(204, None))
    n = dmod.DiscordNotifier("https://example.test/hook", sent_log=sent)
    with caplog.at_level("WARNING"):
        n.send(content="x")
    assert sent.rows() == []
    assert "消せない" in caplog.text


def test_delete_message_treats_404_as_success(monkeypatch):
    """すでに消えているものを消そうとしても失敗扱いにしない。"""
    monkeypatch.setattr(dmod.requests, "delete",
                        lambda *a, **k: FakeResponse(404))
    n = dmod.DiscordNotifier("https://example.test/hook")
    assert n.delete_message("1") is True


def test_purge_only_removes_matching_kind(cfg, tmp_path, monkeypatch):
    sent = dmod.SentLog(tmp_path / "sent.jsonl")
    sent.record(channel="errors", message_id="1", kind="test")
    sent.record(channel="errors", message_id="2", kind="error", run_date="2026-09-18")

    deleted = []
    monkeypatch.setattr(dmod.requests, "delete",
                        lambda url, **k: (deleted.append(url), FakeResponse(204))[1])

    router = dmod.DiscordRouter(cfg, sent_log=sent)
    router.channels["errors"].webhook_url = "https://example.test/hook"
    router.channels["errors"].enabled = True

    result = router.purge(kinds={"test"})
    assert result["deleted"] == 1 and result["kept"] == 1
    assert deleted[0].endswith("/messages/1")
    # 記録は「消していないぶん」だけ残る
    assert [r["message_id"] for r in sent.rows()] == ["2"]


def test_purge_dry_run_changes_nothing(cfg, tmp_path, monkeypatch):
    sent = dmod.SentLog(tmp_path / "sent.jsonl")
    sent.record(channel="errors", message_id="1", kind="test")
    monkeypatch.setattr(dmod.requests, "delete",
                        lambda *a, **k: pytest.fail("dry-run で削除してはいけない"))

    router = dmod.DiscordRouter(cfg, sent_log=sent)
    router.channels["errors"].webhook_url = "https://example.test/hook"
    router.channels["errors"].enabled = True

    result = router.purge(kinds={"test"}, dry_run=True)
    assert result["deleted"] == 1
    assert len(sent.rows()) == 1          # 記録は消えていない


def test_purge_keeps_record_when_delete_fails(cfg, tmp_path, monkeypatch):
    """🔴 消せなかったものは記録に残す（取りこぼしを見失わない）。"""
    sent = dmod.SentLog(tmp_path / "sent.jsonl")
    sent.record(channel="errors", message_id="1", kind="test")
    monkeypatch.setattr(dmod.requests, "delete", lambda *a, **k: FakeResponse(403))

    router = dmod.DiscordRouter(cfg, sent_log=sent)
    router.channels["errors"].webhook_url = "https://example.test/hook"
    router.channels["errors"].enabled = True

    result = router.purge(kinds={"test"})
    assert result["deleted"] == 0 and result["failed"] == 1
    assert len(sent.rows()) == 1


def test_purge_reaches_channels_outside_the_router(cfg, tmp_path, monkeypatch):
    """🔴 回帰テスト（2026-09-19）。

    note新着は「トレードの通知と混ぜない」ために router に登録していない。
    その結果、投稿はできるのに purge で消せないという状態を実際に作ってしまった。
    送信の経路は分けたまま、削除だけは .env の Webhook から届くようにしてある。
    """
    sent = dmod.SentLog(tmp_path / "sent.jsonl")
    sent.record(channel="note", message_id="1", kind="note")

    deleted = []
    monkeypatch.setattr(dmod.requests, "delete",
                        lambda url, **k: (deleted.append(url), FakeResponse(204))[1])

    router = dmod.DiscordRouter(cfg, sent_log=sent)
    assert "note" not in router.channels          # ルーターには載っていない
    if "note" not in cfg.secrets.webhooks:
        pytest.skip("note の Webhook が未設定")

    result = router.purge(kinds={"note"})
    assert result["deleted"] == 1 and result["failed"] == 0
    assert deleted[0].endswith("/messages/1")
