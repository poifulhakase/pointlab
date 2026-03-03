/**
 * GIFの白背景を透明にするスクリプト
 * ImageMagick がインストールされている場合、poinavi/hakase.gif を処理します。
 *
 * 必要なツール: ImageMagick (magick または convert コマンド)
 * インストール: choco install imagemagick または https://imagemagick.org/script/download.php
 */
import { spawn } from "child_process";
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

function runMagick(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("magick", args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    let stderr = "";
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `exit ${code}`));
    });
  });
}

function runConvert(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("convert", args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    let stderr = "";
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `exit ${code}`));
    });
  });
}

async function main() {
  const args = [
    gifPath,
    "-coalesce",
    "-fuzz",
    "10%",
    "-transparent",
    "white",
    "-layers",
    "OptimizePlus",
    tempPath,
  ];

  try {
    try {
      await runMagick(args);
    } catch (e) {
      await runConvert(args);
    }
    const fs = await import("fs");
    fs.renameSync(tempPath, gifPath);
    console.log("博士GIF: 白背景を透明にしました。");
  } catch (err) {
    if (existsSync(tempPath)) {
      const fs = await import("fs");
      fs.unlinkSync(tempPath);
    }
    console.log(
      "ImageMagick が見つかりません。博士GIFの白背景削除をスキップします。"
    );
    console.log(
      "手動で透明化: ImageMagick をインストール (choco install imagemagick) 後、"
    );
    console.log(
      "  magick poinavi\\hakase.gif -coalesce -fuzz 10%% -transparent white -layers OptimizePlus poinavi\\hakase_out.gif"
    );
    process.exit(0);
  }
}

main();
