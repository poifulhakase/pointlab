@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo [1] 依存関係をインストール中...
call npm install
if errorlevel 1 (
  echo npm install に失敗しました。
  pause
  exit /b 1
)

echo [2] favicon.svg からアイコンを生成中...
node scripts/generate-apple-touch-icon-sharp.js
if errorlevel 1 (
  echo 失敗: sharp がインストールされていません。
  pause
  exit /b 1
)

echo.
echo 完了: favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png, icon-192.png
echo deploy-now.bat で本番反映してください。
pause
