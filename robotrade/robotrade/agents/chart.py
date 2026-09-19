"""チャート分析AI（SPEC 7.2）。

役割: 1銘柄の値動きの「形」を分析。銘柄ごとに個別呼び出し。
渡し方は (A) 数値（安定・安価）を採用。(B) 画像 vision は後から足せるようにしておく。

🔴 曖昧述語の接地（SPEC 7 共通ルール）
   strong/moderate/weak・good/weak/bad は境界が言語的に曖昧で、LLMごと・文脈ごとに
   解釈が揺れる。**数値の目安をプロンプトに書き**、コード側の検算（プロセス評価）でも
   同じ基準を使う。閾値は config 化する。
"""

from __future__ import annotations

from typing import Any

from .base import AgentError, LLMAgent, json_block

HIGHER_TF = {"up", "down", "range"}
REGIMES = {"uptrend", "downtrend", "range", "unclear"}
STRENGTHS = {"strong", "moderate", "weak"}
POSITIONS = {"overbought", "oversold", "neutral"}
BAND_STATES = {"squeeze", "expansion", "normal"}
BREAKOUTS = {"confirmed", "weak", "none"}
SWING_FITS = {"good", "weak", "bad"}

SYSTEM = """あなたはテクニカル分析の担当です。対象は保有期間2〜14日の日足スイングです。
チャートは**市場参加者の心理の痕跡**だと捉えてください。サポート/レジスタンスは
「そこで売買した人の記憶」、ブレイクは「我慢の限界」、急騰は強欲(FOMO)、投げ売りは恐怖。
数値の奥にいる人間の感情（強欲・恐怖・諦め）を読み、単なる指標値でなくその意味を捉えます。
ただし参加者は人間だけでなく**アルゴ・機関**もいます。教科書的なパターンやサポート直下の
ストップは**狩られうる**ので盲信しないでください（板情報は無いので断定はしない）。

まず**価格そのもの**を最優先に読んでください。直近スイングの高値/安値、サポート/
レジスタンス、ブレイク水準に対して、今の株価がどこにいるかを判定します。
指標（傾き・乖離率・バンド幅・出来高など）はその補助として使ってください。

次に regime（レンジ/トレンド）を判定します。SMA25の傾き・バンド幅・価格構造
（高値安値の切り上げ/切り下げか、水平の往復か）が揃って初めて uptrend/downtrend/range
と判定し、サインが食い違う・どっちつかずの時は無理に決めず unclear としてください。
長期のトレンドラインではなく、今後数日〜2週間で完結しうる「今の波」を見ます。

上位足（週足）の方向を必ず確認し、日足の見立てが週足に沿うか逆らうかを higher_tf_trend に
反映してください（上位足に逆らう形は慎重に）。ブレイクを見るときは出来高を伴うか
（breakout_volume）で本物/騙しを判断し、直近の主要ローソク足パターン（candle_pattern）も
拾ってください。そのうえで swing_fit と expected_move_days を付けてください。

**質的ラベルの数値の目安**（解釈が揺れないように。これに機械的に従うのではなく目安として使う）:
- trend_strength: strong = SMA25の傾きが |0.2%/日| 以上 / moderate = 0.05〜0.2% / weak = 0.05%未満
- position: overbought = SMA25乖離率 +10%超 または RSI 70超 / oversold = 乖離率 -10%未満 または RSI 30未満
- band_state: squeeze = バンド幅 0.05未満 / expansion = 0.12超 / それ以外は normal
- swing_fit: good = 2〜14日で到達しうる明確な目標（レジスタンス等）が現値から3%以上離れている、
  かつ損切り位置が明確 / bad = 目標が近すぎる・損切り位置が決められない

support と resistance は**入力データに実在する価格水準**から選んでください（作らない）。
出力は必ず指定のツール形式（JSON）で返してください。
これは実際の投資助言ではなく、疑似トレードの実験です。"""


class ChartAgent(LLMAgent):
    name = "chart"
    prompt_version = "chart-v1"
    tier = "cheap"

    def system_prompt(self) -> str:
        return SYSTEM

    def tool_schema(self) -> dict[str, Any]:
        return {
            "name": "submit_chart_analysis",
            "description": "1銘柄の値動きの形を分析して返す",
            "strict": True,
            "input_schema": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "higher_tf_trend", "regime", "trend_strength", "position", "band_state",
                    "candle_pattern", "breakout_volume", "support", "resistance", "pattern",
                    "entry_zone", "swing_fit", "expected_move_days", "comment",
                ],
                "properties": {
                    "higher_tf_trend": {"type": "string", "enum": sorted(HIGHER_TF)},
                    "regime": {"type": "string", "enum": sorted(REGIMES)},
                    "trend_strength": {"type": "string", "enum": sorted(STRENGTHS)},
                    "position": {"type": "string", "enum": sorted(POSITIONS)},
                    "band_state": {"type": "string", "enum": sorted(BAND_STATES)},
                    "candle_pattern": {"type": "string"},
                    "breakout_volume": {"type": "string", "enum": sorted(BREAKOUTS)},
                    "support": {"type": ["number", "null"]},
                    "resistance": {"type": ["number", "null"]},
                    "pattern": {"type": "string", "description": "チャートの形（三角持ち合い・押し目等）"},
                    "entry_zone": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "[下限, 上限] の2要素。決められないときは空配列",
                    },
                    "swing_fit": {"type": "string", "enum": sorted(SWING_FITS)},
                    "expected_move_days": {
                        "type": ["integer", "null"],
                        "description": "値動き完結までの日数目安（2〜14）",
                    },
                    "comment": {"type": "string"},
                },
            },
        }

    def validate(self, payload: dict[str, Any]) -> dict[str, Any]:
        out = dict(payload)
        out["higher_tf_trend"] = self.enum_or_fail(out.get("higher_tf_trend"), HIGHER_TF, "higher_tf_trend")
        out["regime"] = self.enum_or_fail(out.get("regime"), REGIMES, "regime")
        out["trend_strength"] = self.enum_or_fail(out.get("trend_strength"), STRENGTHS, "trend_strength")
        out["position"] = self.enum_or_fail(out.get("position"), POSITIONS, "position")
        out["band_state"] = self.enum_or_fail(out.get("band_state"), BAND_STATES, "band_state")
        out["breakout_volume"] = self.enum_or_fail(out.get("breakout_volume"), BREAKOUTS, "breakout_volume")
        out["swing_fit"] = self.enum_or_fail(out.get("swing_fit"), SWING_FITS, "swing_fit")

        out["support"] = self.number_or_fail(out.get("support"), "support", low=0, allow_none=True)
        out["resistance"] = self.number_or_fail(out.get("resistance"), "resistance", low=0, allow_none=True)
        if out["support"] and out["resistance"] and out["support"] >= out["resistance"]:
            raise AgentError(
                f"support({out['support']}) >= resistance({out['resistance']}) は矛盾"
            )

        zone = out.get("entry_zone") or []
        if zone:
            if len(zone) != 2:
                raise AgentError(f"entry_zone は2要素かからっぽ: {zone!r}")
            lo, hi = float(zone[0]), float(zone[1])
            if lo > hi:
                lo, hi = hi, lo  # 逆順は直して通す（害がない）
            out["entry_zone"] = [lo, hi]
        else:
            out["entry_zone"] = []

        days = out.get("expected_move_days")
        if days is not None:
            days = int(days)
            lo_d, hi_d = int(self.cfg.get("holding.min_days")), int(self.cfg.get("holding.max_days"))
            days = max(lo_d, min(hi_d, days))  # 範囲外は丸める（判断の本筋ではない）
        out["expected_move_days"] = days
        return out

    def build_user(self, *, profile: dict[str, Any], indicators: Any) -> str:
        """SPEC 7.2 (A) 数値方式。指標は一元計算（indicators.py）のものをそのまま渡す。"""
        latest = indicators.latest
        return "\n".join([
            f"{profile['name']}（{profile['ticker']}・{profile['sector']}）を分析してください。",
            "",
            json_block("直近の確定値（一元計算の指標）", latest),
            "",
            "## 日足の系列（直近20日）",
            "```csv",
            indicators.series_text(20).strip(),
            "```",
            "",
            "## 週足の系列（直近12週・上位足の文脈）",
            "```csv",
            indicators.weekly_text(12).strip(),
            "```",
        ])
