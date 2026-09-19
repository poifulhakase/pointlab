"""Discord Webhook 用のアバター画像を作る（DISCORD.md 2章）。

🔴 Discord のアバターは**円形にトリミング**される。
   横長・余白の多いフル版をそのまま使うと、丸で欠けるか、中身が小さくなる。
   → **正方形・顔（体）中心**に切り出し、円に収まる範囲へ収める。

出力: stock-calendar/public/discord/*.png
   → https://pointlab.vercel.app/calendar/discord/*.png で配信される
     （🔵 `/stock-calendar/...` は SPA の HTML が返るので使わない）

    .venv/Scripts/python.exe scripts/make_avatars.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT.parent / "public"
OUT_DIR = PUBLIC / "discord"

SIZE = 256          # Discord の推奨は128以上。円トリミング前提で少し大きめ。
MARGIN = 0.90       # 円に収まるよう、正方形の内側90%に収める

# ぽいロボ系＝シアン（配色ルール）。透過のままだと背景次第で見づらいので薄く敷く。
BG_ROBO = (232, 248, 250, 255)
BG_POYON = (240, 246, 252, 255)


def square_crop(im: Image.Image, center: tuple[float, float], half: float) -> Image.Image:
    """中心と半径を指定して正方形に切り出す（画像外にはみ出す分は透明で埋まる）。"""
    cx, cy = center
    box = (int(cx - half), int(cy - half), int(cx + half), int(cy + half))
    return im.crop(box)


def fit_on_background(im: Image.Image, bg: tuple[int, int, int, int]) -> Image.Image:
    """正方形の背景の中央に、余白 MARGIN を残して貼る。"""
    canvas = Image.new("RGBA", (SIZE, SIZE), bg)
    inner = int(SIZE * MARGIN)
    resized = im.resize((inner, inner), Image.LANCZOS)
    offset = (SIZE - inner) // 2
    canvas.alpha_composite(resized, (offset, offset))
    return canvas


def build_poirobo() -> Image.Image:
    """ぽいロボ＝通知の主役。胴体の球が丸なので、そこを中心に切る。"""
    im = Image.open(PUBLIC / "poirobo.png").convert("RGBA")
    # 実測: 不透明領域は (66,70)-(524,537)。顔（目・LED口）は y=240〜350 あたり。
    # アンテナは円の外に出るので捨て、頭〜胴体が円に収まるように取る。
    cropped = square_crop(im, center=(272, 318), half=160)
    return fit_on_background(cropped, BG_ROBO)


def build_poyonkun() -> Image.Image:
    """ぽよん君＝添え役。元画像が 100x78 と小さいので拡大して正方形化する。"""
    im = Image.open(PUBLIC / "poyonkun.png").convert("RGBA")
    w, h = im.size
    # 横長なので、短辺に合わせた正方形に入れてから拡大する（潰さない）
    side = max(w, h)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.alpha_composite(im, ((side - w) // 2, (side - h) // 2))
    return fit_on_background(square, BG_POYON)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, builder in (("poirobo", build_poirobo), ("poyonkun", build_poyonkun)):
        out = OUT_DIR / f"{name}-avatar.png"
        builder().save(out, optimize=True)
        print(f"{out.relative_to(PUBLIC.parent)}  {out.stat().st_size / 1024:.0f}KB")
    print("\n配信URL: https://pointlab.vercel.app/calendar/discord/<name>-avatar.png")
    print("🔴 push して Vercel に反映してから Webhook のアバターに設定する")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
