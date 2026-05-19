"""
PWA アイコン生成スクリプト
poirobo.png を背景 #141623 に合成して各サイズのアイコンを生成する。
CHARACTER_SCALE: キャンバスに対するキャラクター画像の割合（0.0〜1.0）
"""
from PIL import Image
import os

SRC      = os.path.join(os.path.dirname(__file__), '..', 'public', 'poirobo.png')
OUT_DIR  = os.path.join(os.path.dirname(__file__), '..', 'public')
BG_COLOR = (20, 22, 35, 255)   # #141623

# キャラクターをキャンバスの何割に収めるか
CHARACTER_SCALE = 0.80   # 旧: 約0.62 → 1.3倍 ≈ 0.80

def make_icon(src_img: Image.Image, canvas_size: int, scale: float, round_corners=False) -> Image.Image:
    """src_img を scale 割合に縮小して canvas_size の正方形背景に中央配置"""
    bg = Image.new('RGBA', (canvas_size, canvas_size), BG_COLOR)

    # キャラクター画像のトリム後バウンディングボックス
    bbox = src_img.getbbox()
    if bbox:
        char = src_img.crop(bbox)
    else:
        char = src_img

    # canvas_size * scale に収まるようリサイズ
    fit = int(canvas_size * scale)
    char.thumbnail((fit, fit), Image.LANCZOS)

    # 中央配置
    x = (canvas_size - char.width)  // 2
    y = (canvas_size - char.height) // 2
    bg.paste(char, (x, y), char)

    if round_corners:
        bg = apply_round_corners(bg, int(canvas_size * 0.20))

    return bg.convert('RGB')


def apply_round_corners(img: Image.Image, radius: int) -> Image.Image:
    """角丸マスクを適用（RGBA 前提）"""
    mask = Image.new('L', img.size, 0)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=radius, fill=255)
    img.putalpha(mask)
    return img


def main():
    src = Image.open(SRC).convert('RGBA')

    # icon-512.png（通常）
    make_icon(src, 512, CHARACTER_SCALE).save(os.path.join(OUT_DIR, 'icon-512.png'))
    print('icon-512.png 生成完了')

    # icon-192.png
    make_icon(src, 192, CHARACTER_SCALE).save(os.path.join(OUT_DIR, 'icon-192.png'))
    print('icon-192.png 生成完了')

    # apple-touch-icon.png (180x180、角丸)
    make_icon(src, 180, CHARACTER_SCALE, round_corners=True).save(os.path.join(OUT_DIR, 'apple-touch-icon.png'))
    print('apple-touch-icon.png 生成完了')

    # icon-512-maskable.png（safe zone 0.80 内にキャラを収める）
    # maskable safe zone = canvas * 0.80 → キャラは scale * 0.80 の領域に
    maskable_scale = CHARACTER_SCALE * 0.80
    make_icon(src, 512, maskable_scale).save(os.path.join(OUT_DIR, 'icon-512-maskable.png'))
    print('icon-512-maskable.png 生成完了')

    # favicon.png (32x32)
    make_icon(src, 32, 0.85).save(os.path.join(OUT_DIR, 'favicon.png'))
    print('favicon.png 生成完了')

    print('\n全アイコン生成完了')


if __name__ == '__main__':
    main()
