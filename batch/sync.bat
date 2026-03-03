@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo === ローカル同期（本番の変更を取得）===
echo.
echo 管理画面で修正した内容をローカルに反映します。
echo.

for /f "delims=" %%i in ('git rev-parse --show-toplevel 2^>nul') do set GIT_ROOT=%%i
if defined GIT_ROOT cd /d "%GIT_ROOT%"

git pull origin main
if errorlevel 1 (
  echo.
  echo 同期に失敗しました。リポジトリが設定されていますか？
  pause
  exit /b 1
)

echo.
echo === 完了 ===
echo ローカルが本番（GitHub）と同期されました。
pause
