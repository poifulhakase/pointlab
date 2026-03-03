/**
 * PNGの白背景を透明にし、GIFとして保存（hakase.png -> hakase.gif）
 * アニメーションはありませんが、白背景が透明になります。
 */
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const pngPath = path.join(rootDir, "poinavi", "hakase.png");
const gifPath = path.join(rootDir, "poinavi", "hakase.gif");

if (!existsSync(pngPath)) process.exit(0);

const WHITE_THRESHOLD = 250;

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
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .gif()
    .toFile(gifPath);
  console.log("Hakase PNG: white -> transparent, saved as hakase.gif");
} catch (err) {
  console.log("Hakase PNG:", err.message);
}
