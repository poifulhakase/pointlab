"""売買判断AI（SPEC 7.5）。

**意思決定はここに一本化**する。選定・チャート・需給・ニュース・ML の5つは
「材料を出すアナリスト」で、売る／買うは決めない。合議や多数決で発注を決めない。

🔴 責任を二重化しない（SPEC 7 共通ルール）
   コードが機械的に強制できる制約（**数量計算**・各種上限・ギャップ見送り・単元丸め）は
   コード側だけに置き、プロンプトには書かない。
   → したがって出力スキーマから `quantity` を**外してある**。
     SPEC 7.5 のスキーマ例には quantity があるが、同じ SPEC の共通ルールが
     「数量計算はコード側だけ」と定めているので、そちらに従う。
     数量は `portfolio/sizing.py` がリスク%固定＋上限キャップで逆算する（SPEC 10.3）。

🔴 二段構え: 判断＝このAI、最終ガード＝コード側（資金管理・サイジング・相関/集中・
   ストップ妥当性・時間手仕舞い）。LLM が暴走しても資金とリスクの一線はコードが守る。
"""

from __future__ import annotations

from typing import Any

from .base import AgentError, LLMAgent, json_block

ACTIONS = {"buy", "sell", "hold"}

# 出力に混ざることがあるプレースホルダー語。見つけたら弾いて再試行させる。
PLACEHOLDERS = {"dummy", "placeholder", "n/a", "na", "none", "todo", "tbd", "-", "なし", "未定"}

SYSTEM = """あなたはポートフォリオマネージャーです。対象は保有期間2〜14日の日足スイングです。
各銘柄のチャート分析・需給分析・ニュース/カタリスト分析・予測MLモデルの有利変動確率
（ml_prob）、そして自分の過去トレード実績サマリ、現在のポートフォリオ状態（現金・保有・
含み損益・各ポジションの経過日数 days_held）とリスク制約を踏まえ、翌営業日の寄りで
想定する売買を決定してください。

ml_prob とニュースはあくまで補助シグナルです。過信せず、チャート・需給と食い違う場合は
その旨を reason に書いてください。過去実績サマリに自分の負けパターンが見えている場合は、
同じ轍を踏まないよう判断を調整してください。
銘柄プロファイルとドル円の方向も踏まえてください（例: 円安メリット株は円安局面で追い風、
低位株は原則対象外だがボラが高い銘柄は損切り幅を相応に取る）。

このマシンは**買いのみ（空売りしない）**。regime によって戦略を切り替えます:
- uptrend（上昇トレンド）→ 順張り。押し目買いやブレイク狙い、利益は伸ばす。
- downtrend（下降トレンド）→ **新規買いは見送り**（買いオンリーでは下降トレンドで取れる
  新規建てはない。落ちるナイフは掴まない）。**既存保有の手仕舞いのみ**を検討。
- range（レンジ）→ 逆張り。サポート付近で買い、レジスタンス手前で早めに利確。
- unclear（どっちつかず）→ 原則見送り（新規買いを見送る）。無理にトレードしない。
レンジで順張り、上昇トレンドで逆張りは往復ビンタ／振り落としの元なので避けてください。

新規買いには想定保有日数（planned_holding_days, 2〜14）と手仕舞い条件
（利確・損切り・時間手仕舞い time_exit_days）を必ず付けてください。
既存保有については、利確/損切り水準への到達に加え、保有日数が上限
（max_holding_days）に達している、または想定した値動きが崩れた場合は手仕舞いを
検討してください。スイングでは「持ちすぎない」ことを重視します。
需給分析の event_in_horizon が保有期間内の決算・権利日を示す場合は、
またぐリスクを判断に織り込んでください。
高インパクトの経済イベント（FOMC・日銀会合・雇用統計・メジャーSQ等）が翌日に控える場合は、
新規建てを控えるか、またいで持たない前提で判断してください（市場全体のギャップリスク）。

数量は決めなくて構いません（こちらで資金管理ルールから逆算します）。
あなたが決めるのは**方向（buy/sell/hold）・価格水準・確信度・理由**です。

market_view には、マクロ（ドル円・前夜の米国市場・VIX・TOPIX）から見た**今日の地合い**を
1〜2文で書いてください。入力の値を根拠に書き、プレースホルダや空文字を入れないこと。

🔴 **売買する必要が無ければ decisions を空配列 [] にしてください。**
   「今日は何もしない」は正当な判断です。無理にトレードしないこと。
   ダミー・プレースホルダー・架空の銘柄を要素として入れないでください。
   decisions に入れてよい ticker は、入力の候補銘柄と現在の保有銘柄だけです。

出力は必ず指定のツール形式（JSON）で返してください。
これは実際の投資助言ではなく、疑似トレードの実験です。"""


class DeciderAgent(LLMAgent):
    name = "decider"
    prompt_version = "decider-v2"
    tier = "strong"

    def __init__(self, cfg, *args, allowed_tickers: set[str] | None = None, **kwargs):
        super().__init__(cfg, *args, **kwargs)
        # 🔴 判断してよい銘柄の集合。候補にも保有にも無い銘柄は**架空**なので弾く。
        #    （実際に "dummy" というプレースホルダーを返してきたことがある）
        self.allowed_tickers = allowed_tickers or set()

    def system_prompt(self) -> str:
        return SYSTEM

    def tool_schema(self) -> dict[str, Any]:
        return {
            "name": "submit_decisions",
            "description": "翌営業日の寄りで想定する売買の判断を返す",
            "strict": True,
            "input_schema": {
                "type": "object",
                "additionalProperties": False,
                "required": ["decisions", "market_view"],
                "properties": {
                    "market_view": {
                        "type": "string",
                        "description": "今日の地合いをどう見たか（1〜2文）",
                    },
                    "decisions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "action", "ticker", "entry", "stop", "target",
                                "planned_holding_days", "exit_conditions", "confidence", "reason",
                            ],
                            "properties": {
                                "action": {"type": "string", "enum": ["buy", "sell", "hold"]},
                                "ticker": {"type": "string"},
                                "entry": {
                                    "type": ["number", "null"],
                                    "description": "想定エントリー価格。sell/hold は null",
                                },
                                "stop": {
                                    "type": ["number", "null"],
                                    "description": "損切り価格。buy では必須",
                                },
                                "target": {
                                    "type": ["number", "null"],
                                    "description": "利確目標。buy では必須",
                                },
                                "planned_holding_days": {
                                    "type": ["integer", "null"],
                                    "description": "新規買いの想定保有日数（2〜14）。sell/hold は null",
                                },
                                "exit_conditions": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "required": ["take_profit", "stop_loss", "time_exit_days"],
                                    "properties": {
                                        "take_profit": {"type": ["number", "null"]},
                                        "stop_loss": {"type": ["number", "null"]},
                                        "time_exit_days": {
                                            "type": ["integer", "null"],
                                            "description": "この日数を過ぎて動かなければ撤退",
                                        },
                                    },
                                },
                                # 🔴 strict スキーマでは minimum/maximum は使えない（400になる）。
                                #    範囲は validate() 側で弾く（そのためのプロセス評価）。
                                "confidence": {
                                    "type": "number",
                                    "description": "0.0〜1.0 の確信度",
                                },
                                "reason": {"type": "string"},
                            },
                        },
                    },
                },
            },
        }

    # -------------------------------------------------- 検証

    def validate(self, payload: dict[str, Any]) -> dict[str, Any]:
        """🔴 LLM の不正出力への防御（SPEC 9.2 契約テスト）。

        矛盾した注文（buy なのに target < entry 等）はここで弾いてリトライさせる。
        通してしまうと、そのままポートフォリオに入って成績が汚れる。
        """
        decisions = payload.get("decisions")
        if not isinstance(decisions, list):
            raise AgentError("decisions が配列でない")

        # 🔴 プレースホルダー検出。強いモデルでも**稀に** "dummy" / "placeholder" を返す
        #    （同じ入力で再試行すると正常な文章が返る＝非決定性）。
        #    通すと「今日の地合い」が永久に dummy のままログに残るので、弾いて再試行させる。
        market_view = str(payload.get("market_view") or "").strip()
        if len(market_view) < 15 or market_view.lower() in PLACEHOLDERS:
            raise AgentError(
                f"market_view がプレースホルダーか短すぎる: {market_view!r}。"
                "入力のマクロ数値を根拠に、今日の地合いを1〜2文で書くこと"
            )

        min_days = int(self.cfg.get("holding.min_days"))
        max_days = int(self.cfg.get("holding.max_days"))
        clean: list[dict[str, Any]] = []

        for i, d in enumerate(decisions):
            if not isinstance(d, dict):
                raise AgentError(f"decisions[{i}] が辞書でない")
            action = self.enum_or_fail(d.get("action"), ACTIONS, f"decisions[{i}].action")
            ticker = str(d.get("ticker") or "").strip()
            if not ticker:
                raise AgentError(f"decisions[{i}].ticker が空")
            if self.allowed_tickers and ticker not in self.allowed_tickers:
                raise AgentError(
                    f"decisions[{i}].ticker={ticker!r} は候補にも保有にも無い。"
                    "売買する必要が無ければ decisions は空配列にすること"
                )

            entry = self.number_or_fail(d.get("entry"), f"decisions[{i}].entry",
                                        low=0, allow_none=True)
            stop = self.number_or_fail(d.get("stop"), f"decisions[{i}].stop",
                                       low=0, allow_none=True)
            target = self.number_or_fail(d.get("target"), f"decisions[{i}].target",
                                         low=0, allow_none=True)
            confidence = self.number_or_fail(d.get("confidence"), f"decisions[{i}].confidence",
                                             low=0.0, high=1.0)
            days = d.get("planned_holding_days")

            if action == "buy":
                if entry is None or stop is None or target is None:
                    raise AgentError(f"decisions[{i}]: buy には entry/stop/target が要る")
                # 買いなのに損切りが上・利確が下＝矛盾
                if stop >= entry:
                    raise AgentError(
                        f"decisions[{i}]: buy なのに stop({stop}) >= entry({entry})"
                    )
                if target <= entry:
                    raise AgentError(
                        f"decisions[{i}]: buy なのに target({target}) <= entry({entry})"
                    )
                if days is None:
                    raise AgentError(f"decisions[{i}]: buy には planned_holding_days が要る")
                days = int(days)
                if not (min_days <= days <= max_days):
                    raise AgentError(
                        f"decisions[{i}].planned_holding_days={days} が {min_days}〜{max_days} の外"
                    )
            else:
                days = None if days is None else int(days)

            exits = d.get("exit_conditions") or {}
            time_exit = exits.get("time_exit_days")
            if time_exit is not None:
                time_exit = int(time_exit)
                if time_exit > max_days:
                    # 上限超えは**却下せず丸める**（コード側でどのみち強制するため）
                    time_exit = max_days

            reason = str(d.get("reason") or "").strip()
            if reason.lower() in PLACEHOLDERS or len(reason) < 10:
                raise AgentError(
                    f"decisions[{i}].reason がプレースホルダーか短すぎる: {reason!r}"
                )

            clean.append({
                "action": action,
                "ticker": ticker,
                "entry": entry,
                "stop": stop,
                "target": target,
                "planned_holding_days": days,
                "exit_conditions": {
                    "take_profit": self.number_or_fail(
                        exits.get("take_profit"), f"decisions[{i}].take_profit",
                        low=0, allow_none=True),
                    "stop_loss": self.number_or_fail(
                        exits.get("stop_loss"), f"decisions[{i}].stop_loss",
                        low=0, allow_none=True),
                    "time_exit_days": time_exit,
                },
                "confidence": confidence,
                "reason": reason,
            })

        return {"market_view": str(payload.get("market_view") or ""), "decisions": clean}

    # -------------------------------------------------- 入力の組み立て

    def build_user(
        self,
        *,
        analyses: list[dict[str, Any]],
        portfolio_state: dict[str, Any],
        macro: dict[str, Any],
        feedback: dict[str, Any] | None,
        upcoming_events: list[dict[str, Any]],
        risk_note: dict[str, Any],
    ) -> str:
        """SPEC 7.5 の入力を全部入れる。

        🔴 LLM は状態を持たない。現金・保有・含み損益・各ポジションの経過日数・
           過去実績サマリを**毎回**入力する（SPEC 15）。
        """
        weights = self.cfg.get("weights")
        parts = [
            "翌営業日の寄りで想定する売買を判断してください。",
            "",
            json_block("候補銘柄の分析結果", analyses),
            "",
            json_block("現在のポートフォリオ", portfolio_state),
            "",
            json_block("マクロ（ドル円・前夜の米国市場・地合い）", macro),
            "",
            json_block("直近の経済イベント予定", upcoming_events),
            "",
            json_block("リスク制約（こちらでも強制するが、判断の前提として）", risk_note),
        ]

        if feedback:
            parts += ["", json_block("過去トレード実績サマリ", feedback)]
        else:
            # コールドスタート（SPEC 8）: 無いものを「ある体」で埋めない
            parts += ["", "## 過去トレード実績サマリ\nまだ実績がありません（運用初期）。"]

        parts += [
            "",
            "## シグナルの扱い（強調度のヒント・掛け算ではない）",
            f"- 需給: {weights['supply_demand']}（2〜14日では踏み上げ／取り組みが効きやすいのでやや重め）",
            f"- ニュース: {weights['news']}",
            f"- ml_prob: {weights['ml_prob']}（チャート・需給と同じ材料を見ている可能性があるので控えめに）",
        ]
        return "\n".join(parts)
