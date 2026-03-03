#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const src = path.join(process.env.USERPROFILE, '.cursor', 'projects', 'c-Users-owner-OneDrive-PointLab', 'assets', 'c__Users_owner_AppData_Roaming_Cursor_User_workspaceStorage_e55a5f051b324abc10124655a3d9a30c_images_Sole_Proprietor_Tax_Limits_file_a_tax_return-fcaec837-7a60-4029-86fd-971e2025adab.png');
const dst = path.join(__dirname, '..', 'images', 'Sole_Proprietor_Shinkoku_thumbnail.png');

if (!fs.existsSync(src)) {
  console.error('Source not found:', src);
  process.exit(1);
}
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log('OK:', dst);
console.log('Size:', fs.statSync(dst).size);
