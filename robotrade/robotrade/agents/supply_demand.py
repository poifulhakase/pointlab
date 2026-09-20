"""需給分析AI（SPEC 7.3）。

役割: 価格の裏側（誰がどれだけ持ち・売買したか）を分析。チャート分析AIと並列。

🔴 取れないデータは「データなし」と**明示して**渡す（推測させない・SPEC 5.2）。
   いま取れるもの: 銘柄ごとの週次信用残（ぽいロボのJPX蓄積・制度/一般の内訳あり）、
                   市場全体の空売り比率・投資部門別動向、出来高の急増
   取れないもの:   個別銘柄の決算日・権利確定日（J-Quants 導入＝Phase 11 待ち）、
                   個別の空売り残高、自社株買い/増資などの適時開示

🔴 信用残は **2026-08-14 の週からの蓄積しか無い**（JPX が直近5週しか公開しないため）。
   週数が足りないことも「データの状態」として渡す。
"""

from __future__ import annotations

from typing import Any

from .base import AgentError, LLMAgent, json_block

PRESSURES = {"low", "mid", "high"}

SYSTEM = """あなたは需給分析の担当です。対象は保有期間2〜14日の日足スイングです。
需給の数字は**参加者の心理状態**として読んでください。信用買い残は「含み損を抱えて
逃げたい人の量＝将来の売り圧力」、踏み上げは「売り方の恐怖」、取り組みの偏りは
「どちらが追い込まれているか」。単なる残高でなく、その裏の感情と力学を評価します。
参加者には**機関**もいます。出来高を伴う継続的な買い（大口の**分割執行**）は機関の
仕込みのサインになりうるので、部門別動向と併せて注目してください。

信用残・空売り・投資部門別動向・需給イベント（自社株買い、増資、分割、TOB、
指数リバランス、権利確定日など）から、将来の売り圧力・踏み上げ余地・警戒イベントを
評価してください。とくに信用の踏み上げ／取り組みはこの時間軸で効きやすいので重視します。
また、想定保有期間（最大{max_days}日）内に決算や権利確定日などのイベントが入るかを判定し、
event_in_horizon に反映してください（決算またぎは重要なリスクです）。

🔴 **データが無い項目は推測せず「データなし」として扱ってください。**
   入力に「取得できていない項目」が明記されています。そこに書かれた項目については、
   有無を断定せず、has_event=false のまま comment に「判定材料なし」と書いてください。
   無いデータから物語を作らないでください。

**質的ラベルの数値の目安**:
- selling_pressure: high = 制度買残が直近3週で20%以上増加 / low = 減少傾向
- short_squeeze_potential: high = 制度売残が買残の30%超 かつ 増加傾向 / low = 売残が薄い
- supply_demand_score: -1.0（売り圧力が強い）〜 +1.0（買い手が優勢）の連続値

出力は必ず指定のツール形式（JSON）で返してください。
これは実際の投資助言ではなく、疑似トレードの実験です。"""


class SupplyDemandAgent(LLMAgent):
    name = "supply_demand"
    prompt_version = "supply_demand-v1"
    tier = "cheap"

    def system_prompt(self) -> str:
        return SYSTEM.format(max_days=int(self.cfg.get("holding.max_days")))

    def tool_schema(self) -> dict[str, Any]:
        return {
            "name": "submit_supply_demand",
            "description": "1銘柄の需給を評価して返す",
            "strict": True,
            "input_schema": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "supply_demand_score", "selling_pressure", "short_squeeze_potential",
                    "watch_events", "event_in_horizon", "comment",
                ],
                "properties": {
                    "supply_demand_score": {
                        "type": "number",
                        "description": "-1.0（売り圧力が強い）〜 +1.0（買い手が優勢）",
                    },
                    "selling_pressure": {"type": "string", "enum": sorted(PRESSURES)},
                    "short_squeeze_potential": {"type": "string", "enum": sorted(PRESSURES)},
                    "watch_events": {"type": "array", "items": {"type": "string"}},
                    "event_in_horizon": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["has_event", "event", "days_until"],
                        "properties": {
                            "has_event": {"type": "boolean"},
                            "event": {"type": "string"},
                            "days_until": {"type": ["integer", "null"]},
                        },
                    },
                    "comment": {"type": "string"},
                },
            },
        }

    def validate(self, payload: dict[str, Any]) -> dict[str, Any]:
        out = dict(payload)
        out["supply_demand_score"] = self.number_or_fail(
            out.get("supply_demand_score"), "supply_demand_score", low=-1.0, high=1.0
        )
        out["selling_pressure"] = self.enum_or_fail(
            out.get("selling_pressure"), PRESSURES, "selling_pressure")
        out["short_squeeze_potential"] = self.enum_or_fail(
            out.get("short_squeeze_potential"), PRESSURES, "short_squeeze_potential")

        events = out.get("event_in_horizon")
        if not isinstance(events, dict):
            raise AgentError("event_in_horizon が辞書でない")
        has_event = bool(events.get("has_event"))
        days_until = events.get("days_until")
        if has_event and days_until is None:
            raise AgentError("has_event=true なのに days_until が無い")
        out["event_in_horizon"] = {
            "has_event": has_event,
            "event": str(events.get("event") or ""),
            "days_until": None if days_until is None else int(days_until),
        }
        watch = out.get("watch_events") or []
        out["watch_events"] = [str(w) for w in watch if str(w).strip()]
        return out

    def build_user(
        self,
        *,
        profile: dict[str, Any],
        margin_rows: list[dict[str, Any]],
        market_flow: dict[str, Any],
        indicators_latest: dict[str, Any],
        horizon_days: int,
        earnings: dict[str, Any] | None = None,
    ) -> str:
        """取れたデータだけ渡し、**取れていない項目を明示する**。

        `earnings` = 次の決算発表予定（`data/earnings.py`）。取れていなければ None。
        """
        margin_note: Any
        if margin_rows:
            margin_note = {
                "説明": "JPX週次の信用取引残高（株数）。判定に使うのは制度買残（seido_buy）。"
                        "一般信用は期日が6か月ではないので混ぜない。",
                "週数": len(margin_rows),
                "データ": margin_rows,
            }
        else:
            margin_note = "データなし（この銘柄の週次信用残が蓄積に含まれていない）"

        missing = [
            "個別銘柄の権利確定日（取得元が未導入）",
            "個別銘柄の空売り残高（取得元が未導入）",
        ]
        # 🔴 「予定が無い」と「取れていない」を書き分ける。前者は事実、後者は自分の未整備。
        if earnings is None:
            missing.append("次の決算発表予定日（取得できていない）")
            earnings_note: Any = "取得できていない（判定材料なし）"
        elif not earnings:
            earnings_note = "公表されている予定の範囲内に、次の決算発表は無い"
        else:
            earnings_note = {
                "予定日": earnings.get("date"),
                "あと何日": earnings.get("days_until"),
                "種別": earnings.get("kind"),
                "予定表の基準日": earnings.get("as_of"),
                "注意": "予定は変更されることがある（JPX公開の予定一覧）",
            }

        return "\n".join([
            f"{profile['name']}（{profile['ticker']}・{profile['sector']}）の需給を評価してください。",
            f"想定保有期間: 最大{horizon_days}日",
            "",
            json_block("次の決算発表予定（保有期間内にまたぐかの判定に使う）", earnings_note),
            "",
            json_block("この銘柄の週次信用残", margin_note),
            "",
            json_block("出来高（一元計算の指標より）", {
                "rel_volume": indicators_latest.get("rel_volume"),
                "turnover_ma": indicators_latest.get("turnover_ma"),
                "breakout_volume": indicators_latest.get("breakout_volume"),
            }),
            "",
            json_block("市場全体の需給（個別銘柄のものではない・文脈として）", market_flow),
            "",
            json_block("🔴 取得できていない項目（推測で埋めないこと）", missing),
        ])
