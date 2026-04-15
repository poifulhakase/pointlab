@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo === 画像圧縮（SEO・表示速度改善） ===
echo.

if not exist "images" (
  echo images フォルダがありません。先に batch\copy-images.bat を実行してください。
  pause
  exit /b 1
)

node "scripts\compress-images.js"
echo.
pause
