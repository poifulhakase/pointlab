"""お金の型（SPEC 10.1）。

🔴 float で金額を持たない。0.1+0.2!=0.3 の誤差が積み上がって成績がじわじわズレるため、
   内部表現は **銭（1円の1/100）単位の int** に統一する。
   日本株の呼値は 0.1 円刻みまであるので「円の int」では足りず、銭を最小単位に採る。
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

SEN_PER_YEN = 100


def to_sen(value: float | int | Decimal | str) -> int:
    """円（float 等）→ 銭（int）。四捨五入は明示的に行う。"""
    if value is None:
        raise ValueError("to_sen に None は渡せない")
    d = Decimal(str(value)) * SEN_PER_YEN
    return int(d.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def to_yen(sen: int) -> Decimal:
    """銭（int）→ 円（Decimal）。表示・記録用。"""
    return (Decimal(sen) / SEN_PER_YEN).quantize(Decimal("0.01"))


def yen_str(sen: int) -> str:
    """表示用。1,234.50 のような文字列。"""
    return f"{to_yen(sen):,.2f}"


def yen_int_str(sen: int) -> str:
    """表示用（円未満を丸めた整数）。総資産など大きい額に使う。"""
    return f"{int(to_yen(sen).quantize(Decimal('1'), rounding=ROUND_HALF_UP)):,}"


def apply_bps(sen: int, bps: float, *, adverse: bool, is_buy: bool) -> int:
    """価格に bps ぶんのスリッページ/コストを載せる。

    🔴 会計ルール（SPEC 10.2）: スリッページは**常に不利方向**。
       買いは高く、売りは安く約定する。
    """
    if bps == 0:
        return sen
    rate = Decimal(str(bps)) / Decimal(10000)
    delta = (Decimal(sen) * rate).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    if not adverse:
        return sen
    return int(Decimal(sen) + delta) if is_buy else int(Decimal(sen) - delta)


def multiply(sen: int, qty: int) -> int:
    """単価（銭）× 株数 → 金額（銭）。int 同士なので誤差なし。"""
    return sen * qty


def pct(numer: int, denom: int) -> float:
    """比率。表示・判定用なので float で返してよい（金額の保持には使わない）。"""
    if denom == 0:
        return 0.0
    return numer / denom
