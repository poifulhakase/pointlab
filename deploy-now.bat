@echo off
chcp 65001 >nul
setlocal
set "SCRIPT_DIR=%~dp0"
set "POINTLAB_DIR=%SCRIPT_DIR%"
set "ROOT_DIR=%SCRIPT_DIR%.."

echo === PointLab 本番反映（Vercel CLI） ===
echo.
cd /d "%POINTLAB_DIR%"
call "%POINTLAB_DIR%batch\copy-images.bat" --silent 2>nul
echo デプロイ前チェック...
node "%POINTLAB_DIR%scripts\verify-before-deploy.js"
if errorlevel 1 (
  echo チェックに問題があります。上記を確認してください。
  pause
  exit /b 1
)

echo 画像キャッシュバスティング適用...
node "%POINTLAB_DIR%scripts\update-image-versions.js"

echo Vercel 本番デプロイ（親ディレクトリから pointlab/ をデプロイ）...
cd /d "%ROOT_DIR%"
npx vercel --prod --scope pointlabs-projects --yes
if errorlevel 1 (
  echo デプロイに失敗しました。
  pause
  exit /b 1
)

echo.
echo === 完了 ===
echo https://pointlab.vercel.app で確認できます。
pause
