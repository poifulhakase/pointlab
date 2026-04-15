#!/usr/bin/env node
/**
 * ワークスペースの pointlab を C:\PointLabSync にコピー
 * 日本語パスを避けて GitHub push するための同期スクリプト
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DEST = 'C:\\PointLabSync';
const EXCLUDE = ['.git', 'node_modules', '.vercel'];

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const name = path.basename(src);
    if (EXCLUDE.includes(name)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function main() {
  console.log('=== PointLab → C:\\PointLabSync 同期 ===');
  console.log('元:', ROOT);
  console.log('先:', DEST);

  if (!fs.existsSync(path.join(DEST, '.git'))) {
    console.log('\nリポジトリをクローン中...');
    execSync(`git clone https://github.com/poifulhakase/pointlab.git "${DEST}"`, {
      stdio: 'inherit'
    });
  }

  console.log('\nコピー中...');
  if (!fs.existsSync(DEST)) fs.mkdirSync(DEST, { recursive: true });

  for (const item of fs.readdirSync(ROOT)) {
    if (EXCLUDE.includes(item)) continue;
    const srcPath = path.join(ROOT, item);
    const destPath = path.join(DEST, item);
    copyRecursive(srcPath, destPath);
  }

  console.log('コピー完了。Git 状態を確認...');
  const status = execSync('git status --short', { cwd: DEST, encoding: 'utf8' });
  if (!status.trim()) {
    console.log('\n変更はありません。');
    process.exit(0);
  }

  console.log('\n変更ファイル:');
  console.log(status);
  execSync('git add -A', { cwd: DEST });
  execSync('git commit -m "Update: 博士のおすすめ・フル名称・ファビコン反映"', { cwd: DEST });
  execSync('git push origin main', { cwd: DEST, stdio: 'inherit' });
  console.log('\n=== 完了 ===\nGitHub に push 済み。Vercel が自動デプロイします。');
}

main();
