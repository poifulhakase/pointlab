/**
 * GIFの白背景を透明にするスクリプト
 * gifwrap を使用し、追加ツール不要で poinavi/hakase.gif を処理します。
 */
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const gifPath = path.join(rootDir, "poinavi", "hakase.gif");
const tempPath = path.join(rootDir, "poinavi", "hakase_temp.gif");

if (!existsSync(gifPath)) {
  console.log("poinavi/hakase.gif が見つかりません。スキップします。");
  process.exit(0);
}

const WHITE_THRESHOLD = 250; // この値以上のRGBは白とみなす（0-255）
const FUZZ = 5; // 許容範囲 (255 - FUZZ 以上で白)

function isWhiteOrNearWhite(r, g, b) {
  return r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
}

async function main() {
  let GifUtil;
  try {
    const gifwrap = await import("gifwrap");
    GifUtil = gifwrap.GifUtil;
  } catch (e) {
    console.log(
      "gifwrap がインストールされていません。npm install gifwrap を実行してください。"
    );
    process.exit(0);
  }

  try {
    const inputGif = await GifUtil.read(gifPath);
    const frames = inputGif.frames;

    for (const frame of frames) {
      const { data } = frame.bitmap;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (isWhiteOrNearWhite(r, g, b)) {
          data[i + 3] = 0;
        }
      }
    }

    await GifUtil.write(tempPath, frames, inputGif);
    const fs = await import("fs");
    fs.renameSync(tempPath, gifPath);
    console.log("博士GIF: 白背景を透明にしました。");
  } catch (err) {
    if (existsSync(tempPath)) {
      const fs = await import("fs");
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {}
    }
    console.log("博士GIF処理エラー:", err.message);
    process.exit(0);
  }
}

main();
