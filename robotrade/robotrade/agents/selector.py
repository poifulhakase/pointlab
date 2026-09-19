"""銘柄選定AI（SPEC 7.1）。

役割: プレフィルタ後の候補群を俯瞰し、スイングに向く数銘柄を選ぶ。
**「どれを詳しく見るか」だけ**を決める（建玉は決めない）。
"""

from __future__ import annotations

from typing import Any

from .base import AgentError, LLMAgent, json_block

SYSTEM = """あなたは日本株スイングトレードの銘柄スクリーナーです。
以下の候補銘柄リストから、今後数日〜数週間のスイングに向く銘柄を最大{max_select}件選び、
0〜1のスコアと簡潔な理由を付けてください。
まだ売買は決めません。「注目に値するか」だけを判断します。

このマシンは**買いのみ（空売りしない）**なので、下降トレンドの銘柄は選ばないでください。
週足の向き（weekly_trend）に逆らう形は慎重に扱ってください。
値動きの方向がハッキリしない銘柄（傾きがほぼゼロ・動意がない）は選ばないでください。
選ぶ理由が薄い場合は、無理に{max_select}件埋めず少なく返して構いません。

数値の目安（判断がブレないための基準）:
- sma25_slope_pct_per_day … 0.2%/日 以上でトレンドが強い、0.05%/日 未満はほぼ横ばい
- disparity_pct … ±15% を超えると行き過ぎ（掴まない）
- rel_volume … 1.5 以上で注目が集まり始めている
- atr_pct … 0.02〜0.08 がこの時間軸の適正レンジ

出力は必ず指定のツール形式（JSON）で返してください。
これは実際の投資助言ではなく、疑似トレードの実験です。"""


class SelectorAgent(LLMAgent):
    name = "selector"
    prompt_version = "selector-v1"
    tier = "cheap"

    def __init__(self, cfg, *args, max_select: int = 5, **kwargs):
        super().__init__(cfg, *args, **kwargs)
        self.max_select = max_select

    def system_prompt(self) -> str:
        return SYSTEM.format(max_select=self.max_select)

    def tool_schema(self) -> dict[str, Any]:
        return {
            "name": "submit_selection",
            "description": "詳しく分析する価値のある銘柄を選ぶ",
            "strict": True,
            "input_schema": {
                "type": "object",
                "additionalProperties": False,
                "required": ["selected"],
                "properties": {
                    "selected": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["ticker", "score", "reason"],
                            "properties": {
                                "ticker": {"type": "string"},
                                "score": {"type": "number", "description": "0.0〜1.0"},
                                "reason": {"type": "string"},
                            },
                        },
                    }
                },
            },
        }

    def validate(self, payload: dict[str, Any]) -> dict[str, Any]:
        selected = payload.get("selected")
        if not isinstance(selected, list):
            raise AgentError("selected が配列でない")
        clean = []
        for i, row in enumerate(selected):
            if not isinstance(row, dict):
                raise AgentError(f"selected[{i}] が辞書でない")
            ticker = str(row.get("ticker") or "").strip()
            if not ticker:
                raise AgentError(f"selected[{i}].ticker が空")
            clean.append({
                "ticker": ticker,
                "score": self.number_or_fail(row.get("score"), f"selected[{i}].score",
                                             low=0.0, high=1.0),
                "reason": str(row.get("reason") or ""),
            })
        # 🔴 上限超えは切り捨てる（LLM が多く返してもコスト側は守る）
        return {"selected": clean[: self.max_select]}

    def build_user(self, candidates: list[dict[str, Any]]) -> str:
        return "\n".join([
            f"候補は{len(candidates)}件です。この中から最大{self.max_select}件を選んでください。",
            "",
            json_block("候補銘柄（数値プレフィルタ通過）", candidates),
        ])
