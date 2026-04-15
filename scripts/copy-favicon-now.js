#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const src = path.join(process.env.USERPROFILE, '.cursor', 'projects', 'c-Users-owner-OneDrive-PointLab', 'assets', 'c__Users_owner_AppData_Roaming_Cursor_User_workspaceStorage_e55a5f051b324abc10124655a3d9a30c_images_favicon-0d1a022b-3f1b-4d78-b866-95e3d2a05d1f.png');
const root = path.join(__dirname, '..');
const dst32 = path.join(root, 'favicon-32x32.png');
const dst16 = path.join(root, 'favicon-16x16.png');
if (!fs.existsSync(src)) {
  console.error('Source not found:', src);
  process.exit(1);
}
fs.copyFileSync(src, dst32);
fs.copyFileSync(src, dst16);
console.log('OK:', dst32, dst16);
console.log('Size:', fs.statSync(dst32).size);
