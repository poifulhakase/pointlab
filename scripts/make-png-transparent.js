/**
 * PNGの白背景を透明にし、PNGのまま上書き保存
 * hakase.png / hakase-default.png を処理
 */
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const poinaviDir = path.join(rootDir, "poinavi");
const files = ["hakase.png", "hakase-default.png"];
const WHITE_THRESHOLD = 250;

async function processFile(pngPath) {
  if (!existsSync(pngPath)) return false;
  try {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(pngPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
        data[i + 3] = 0;
      }
    }
    const outPath = pngPath + ".tmp";
    await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toFile(outPath);
    const fs = await import("fs");
    fs.renameSync(outPath, pngPath);
    return true;
  } catch (err) {
    console.log("make-png-transparent:", err.message);
    return false;
  }
}

for (const f of files) {
  const p = path.join(poinaviDir, f);
  if (await processFile(p)) {
    console.log(`Hakase: white -> transparent (${f})`);
  }
}
