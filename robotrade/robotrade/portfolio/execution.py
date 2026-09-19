"""疑似執行のリアリズム（SPEC 10.2 / 10.5）とポジションサイジング（10.3）。

🔴 **甘くしない**。ここを甘くすると「勝てないものを勝てると誤認する」。
   - 新規は**翌営業日の寄り**で約定（当日終値の即約定は先読み）
   - 手数料・スリッページを**必ず引く**（入れないと成績が構造的に上振れ）
   - スリッページは**常に不利方向**（買いは高く、売りは安く）
   - 同日に利確と損切りの両方に触れたら、日足では前後不明なので**損切り側を先**とみなす
   - 単元は**切り下げ**。0単元になる銘柄は見送り
   - 翌寄りが想定エントリーから乖離したら**見送り**（高値掴みしない）
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from ..money import apply_bps, multiply, to_sen, to_yen

log = logging.getLogger(__name__)


@dataclass
class Bar:
    """1日の四本値（銭）。"""

    open_sen: int
    high_sen: int
    low_sen: int
    close_sen: int
    volume: float

    @classmethod
    def from_row(cls, row: Any) -> "Bar":
        return cls(
            open_sen=to_sen(float(row["open"])),
            high_sen=to_sen(float(row["high"])),
            low_sen=to_sen(float(row["low"])),
            close_sen=to_sen(float(row["close"])),
            volume=float(row["volume"]),
        )


@dataclass
class SizingResult:
    quantity: int
    basis: str            # risk / position_cap / cash / volume_cap
    detail: dict[str, Any]

    @property
    def ok(self) -> bool:
        return self.quantity > 0


@dataclass
class EntryResult:
    filled: bool
    quantity: int = 0
    price_sen: int = 0
    fee_sen: int = 0
    reason: str = ""


@dataclass
class ExitCheck:
    should_exit: bool
    price_sen: int = 0
    reason: str = ""
    label: str = ""       # win / loss / time_exit


# ---------------------------------------------------------------- コスト


def fee_sen(notional_sen: int, cost_bps: float) -> int:
    """片道の手数料（往復 cost_bps の半分を片道として掛ける）。"""
    half = Decimal(str(cost_bps)) / Decimal(2) / Decimal(10000)
    return int((Decimal(notional_sen) * half).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def slipped_price(price_sen: int, slippage_bps: float, *, is_buy: bool) -> int:
    """スリッページを**常に不利方向**に載せる。"""
    return apply_bps(price_sen, slippage_bps, adverse=True, is_buy=is_buy)


# ---------------------------------------------------------------- サイジング


def size_position(
    *,
    cfg,
    equity_sen: int,
    cash_sen: int,
    entry_sen: int,
    stop_sen: int,
    avg_volume: float | None,
) -> SizingResult:
    """リスク%固定＋上限キャップ（SPEC 10.3・確定方式）。

    1トレードの想定損失を口座の risk_per_trade_pct に固定し、stop までの距離から
    数量を逆算する。ただし stop が極端に近いと数量が膨らむため、
    **リスク基準と1銘柄上限基準の小さい方**を採る。
    """
    lot = int(cfg.get("exec.lot_size"))
    detail: dict[str, Any] = {}

    risk_distance = entry_sen - stop_sen
    if risk_distance <= 0:
        # 🔴 stop=entry（損切り距離ゼロ）で0除算しない。見送り。
        return SizingResult(0, "invalid_stop",
                            {"理由": f"stop({to_yen(stop_sen)}) が entry({to_yen(entry_sen)}) 以上"})

    # ① リスク基準
    risk_budget = int(Decimal(equity_sen) * Decimal(str(cfg.get("risk.risk_per_trade_pct"))))
    qty_risk = risk_budget // risk_distance
    detail["risk基準"] = qty_risk

    # ② 1銘柄上限基準
    position_cap = int(Decimal(equity_sen) * Decimal(str(cfg.get("risk.max_position_pct"))))
    qty_cap = position_cap // entry_sen if entry_sen else 0
    detail["1銘柄上限基準"] = qty_cap

    quantity = min(qty_risk, qty_cap)
    basis = "risk" if qty_risk <= qty_cap else "position_cap"

    # ③ 現金の範囲（手数料ぶん余裕を見る）
    qty_cash = int(cash_sen * 0.99) // entry_sen if entry_sen else 0
    detail["現金基準"] = qty_cash
    if qty_cash < quantity:
        quantity, basis = qty_cash, "cash"

    # ④ 出来高上限（非現実な大口を避ける・SPEC 10.5）
    if avg_volume:
        qty_volume = int(avg_volume * float(cfg.get("exec.max_volume_pct")))
        detail["出来高上限"] = qty_volume
        if qty_volume < quantity:
            quantity, basis = qty_volume, "volume_cap"

    # ⑤ 単元へ切り下げ。0単元なら見送り（端株は扱わない）
    quantity = (quantity // lot) * lot
    detail["単元切り下げ後"] = quantity
    return SizingResult(max(0, quantity), basis, detail)


# ---------------------------------------------------------------- 新規エントリー


def simulate_entry(
    *,
    cfg,
    next_bar: Bar,
    planned_entry_sen: int,
    stop_sen: int,
    equity_sen: int,
    cash_sen: int,
    avg_volume: float | None,
) -> tuple[EntryResult, SizingResult | None]:
    """翌営業日の寄りで約定したものとして処理する（SPEC 10.2）。"""
    gap_limit = float(cfg.get("exec.max_entry_gap_pct"))
    open_sen = next_bar.open_sen

    # ギャップ乖離ルール: 飛びついて高値掴みしない
    if planned_entry_sen > 0:
        gap = abs(open_sen - planned_entry_sen) / planned_entry_sen
        if gap > gap_limit:
            return EntryResult(
                False,
                reason=f"翌寄り {to_yen(open_sen)}円 が想定 {to_yen(planned_entry_sen)}円 から"
                       f"{gap*100:.1f}%乖離（上限{gap_limit*100:.0f}%）→ 見送り",
            ), None

    # 寄らず（ストップ高/安で値が付かない）＝高安が同値で出来高がほぼ無い
    if next_bar.volume <= 0:
        return EntryResult(False, reason="翌日に出来高が無い（寄らず）→ 不成立"), None

    fill_sen = slipped_price(open_sen, float(cfg.get("exec.slippage_bps")), is_buy=True)

    # 🔴 サイジングは**実際の約定価格**で行う（想定値でやると数量がズレる）
    sizing = size_position(
        cfg=cfg, equity_sen=equity_sen, cash_sen=cash_sen,
        entry_sen=fill_sen, stop_sen=stop_sen, avg_volume=avg_volume,
    )
    if not sizing.ok:
        return EntryResult(
            False,
            reason=f"数量が0（基準={sizing.basis} {sizing.detail}）→ 見送り",
        ), sizing

    notional = multiply(fill_sen, sizing.quantity)
    return EntryResult(
        filled=True,
        quantity=sizing.quantity,
        price_sen=fill_sen,
        fee_sen=fee_sen(notional, float(cfg.get("exec.cost_bps"))),
        reason=f"翌寄り約定（{to_yen(fill_sen)}円 × {sizing.quantity}株・基準={sizing.basis}）",
    ), sizing


# ---------------------------------------------------------------- 手仕舞い


def check_exit(
    *,
    cfg,
    position,
    bar: Bar,
    days_held: int,
) -> ExitCheck:
    """保有中の手仕舞い判定（SPEC 10.5）。

    🔴 日足の高安で判定する。翌寄りまで待つのは遅い。
    🔴 **同日に利確と損切りの両方に触れた場合は損切り側を先に約定とみなす**
       （日足では前後が分からない。成績を甘くしないため保守的に倒す）。
    """
    slippage = float(cfg.get("exec.slippage_bps"))
    max_days = int(cfg.get("holding.max_days"))

    hit_stop = position.stop_sen is not None and bar.low_sen <= position.stop_sen
    hit_target = position.target_sen is not None and bar.high_sen >= position.target_sen

    if hit_stop:
        price = slipped_price(position.stop_sen, slippage, is_buy=False)
        reason = "損切り到達"
        if hit_target:
            reason = "同日に利確と損切りの両方に触れた（日足では前後不明のため損切り側を採用）"
        return ExitCheck(True, price, reason, "loss")

    if hit_target:
        price = slipped_price(position.target_sen, slippage, is_buy=False)
        return ExitCheck(True, price, "利確到達", "win")

    # 時間手仕舞い。🔴 LLM が hold と言い続けて塩漬けになるのをコード側で止める。
    limit = min(max_days, position.time_exit_days or max_days)
    if days_held >= limit:
        price = slipped_price(bar.close_sen, slippage, is_buy=False)
        return ExitCheck(True, price, f"時間手仕舞い（保有{days_held}営業日 ≥ {limit}日）", "time_exit")

    return ExitCheck(False)


def exit_fee_sen(price_sen: int, quantity: int, cfg) -> int:
    return fee_sen(multiply(price_sen, quantity), float(cfg.get("exec.cost_bps")))


# ---------------------------------------------------------------- リスクガード


def validate_stop(*, cfg, entry_sen: int, stop_sen: int, atr_sen: int) -> tuple[bool, str]:
    """ストップ妥当性ガード（SPEC 10.3）。

    LLM の出す stop が近すぎ/遠すぎないかを ATR 倍数で見る。
    外れたら却下（補正すると LLM の判断を黙って書き換えることになる）。
    """
    if atr_sen <= 0:
        return True, "ATR=0 のため判定しない"
    distance = entry_sen - stop_sen
    if distance <= 0:
        return False, f"stop({to_yen(stop_sen)}) が entry({to_yen(entry_sen)}) 以上"
    multiple = distance / atr_sen
    low = float(cfg.get("risk.stop_atr_min"))
    high = float(cfg.get("risk.stop_atr_max"))
    if multiple < low:
        return False, f"stop が近すぎる（ATR×{multiple:.2f} < {low}）＝ノイズで刈られる"
    if multiple > high:
        return False, f"stop が遠すぎる（ATR×{multiple:.2f} > {high}）＝1回の損失が大きすぎる"
    return True, f"ATR×{multiple:.2f}"


def risk_off_reasons(*, cfg, macro: dict[str, Any]) -> list[str]:
    """市場急変（リスクオフ）の検知（SPEC 10.3）。

    地政学ショックは予定できないので、**中身でなく"異常度"を数値で捉えて手を引く**。
    """
    reasons: list[str] = []
    drop_limit = float(cfg.get("risk.market_drop_pct")) * 100.0
    fx_limit = float(cfg.get("risk.fx_move_pct")) * 100.0
    vix_limit = float(cfg.get("risk.vix_spike"))

    topix = (macro.get("topix") or {}).get("change_pct")
    if topix is not None and float(topix) <= -drop_limit:
        reasons.append(f"TOPIX が {topix:.1f}%（急落 {drop_limit:.0f}%超）")

    fx = (macro.get("usdjpy") or {}).get("change_pct")
    if fx is not None and abs(float(fx)) >= fx_limit:
        reasons.append(f"ドル円が {fx:+.1f}%（急変 {fx_limit:.0f}%超）")

    vix = (macro.get("vix") or {}).get("close")
    if vix is not None and float(vix) >= vix_limit:
        reasons.append(f"VIX が {vix}（{vix_limit}超）")

    for symbol, label in (("^GSPC", "S&P500"), ("^IXIC", "ナスダック"), ("^SOX", "SOX")):
        entry = macro.get(symbol) or {}
        change = entry.get("change_pct")
        if change is not None and float(change) <= -drop_limit:
            reasons.append(f"前夜の{label}が {change:.1f}%")

    return reasons
