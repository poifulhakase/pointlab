/**
 * 副業サムネ画像を HTML に Base64 で埋め込み（404 を完全回避）
 * deploy-now.bat から自動実行
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const projectsDir = path.join(process.env.USERPROFILE || process.env.HOME, '.cursor', 'projects');
const htmlFiles = ['index.html', 'index-en.html', 'index-zh.html'];
const OLD_SRC = 'src="./images/Side_Biz_Encyclopedia_Delegate.png"';

function getAllAssetsDirs() {
  const dirs = [];
  try {
    if (!fs.existsSync(projectsDir)) return dirs;
    const projects = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const p of projects) {
      if (p.isDirectory()) {
        const ad = path.join(projectsDir, p.name, 'assets');
        if (fs.existsSync(ad)) dirs.push(ad);
      }
    }
  } catch {}
  return dirs;
}

function findInDir(assetsDir) {
  if (!fs.existsSync(assetsDir)) return null;
  const entries = fs.readdirSync(assetsDir, { withFileTypes: true });
  const pngs = entries
    .filter(e => !e.isDirectory() && e.name.endsWith('.png'))
    .map(e => {
      const full = path.join(assetsDir, e.name);
      return { name: e.name, full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  const pasted = pngs.find(f => f.name.includes('images__'));
  if (pasted) return pasted.full;
  const byName = pngs.find(f => /Side_Biz|Delegate|dd155946/i.test(f.name));
  if (byName) return byName.full;
  return pngs[0]?.full ?? null;
}

function findImage() {
  // 1) ユーザー指定の正しい画像を最優先（ノート・手帳風）
  const preferred = [
    'c__Users_owner_AppData_Roaming_Cursor_User_workspaceStorage_e55a5f051b324abc10124655a3d9a30c_images_Side_Biz_Encyclopedia_Delegate-00747aba-f285-42ba-8dc6-c1e92db8a415.png',
    'c__Users_owner_AppData_Roaming_Cursor_User_workspaceStorage_e55a5f051b324abc10124655a3d9a30c_images__7A9D326D-F15E-489D-9F7A-63F6F19CC942_-320e5e33-5600-451f-b825-a0d5d5544f82.png',
  ];
  for (const ad of getAllAssetsDirs()) {
    for (const name of preferred) {
      const full = path.join(ad, name);
      if (fs.existsSync(full)) return full;
    }
  }
  // 2) 通常の検索（assets 内の images__ 等）
  for (const ad of getAllAssetsDirs()) {
    const src = findInDir(ad);
    if (src) return src;
  }
  const imgPath = path.join(root, 'images', 'Side_Biz_Encyclopedia_Delegate.png');
  if (fs.existsSync(imgPath)) return imgPath;
  const srcPath = path.join(root, 'images-source', 'Side_Biz_Encyclopedia_Delegate.png');
  if (fs.existsSync(srcPath)) return srcPath;
  return null;
}

const src = findImage();
if (!src) {
  console.error('副業画像が見つかりません。以下いずれかで配置してください:');
  console.error('  - pointlab/images/Side_Biz_Encyclopedia_Delegate.png');
  console.error('  - pointlab/images-source/Side_Biz_Encyclopedia_Delegate.png');
  console.error('  - Cursor チャットにノート画像を貼り付け');
  process.exit(1);
}

const buf = fs.readFileSync(src);
const base64 = buf.toString('base64');
const dataUri = 'data:image/png;base64,' + base64;

let updated = 0;
for (const name of htmlFiles) {
  const filePath = path.join(root, name);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(OLD_SRC)) {
    content = content.replace(new RegExp(OLD_SRC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `src="${dataUri}"`);
    fs.writeFileSync(filePath, content);
    updated++;
  }
}

if (updated > 0) {
  console.log(`埋め込み完了: ${updated} ファイル（${(buf.length / 1024).toFixed(0)}KB）`);
} else {
  console.log('既に埋め込み済みまたは該当なし');
}
