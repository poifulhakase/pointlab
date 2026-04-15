@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === Git push（GitHub → Vercel自動デプロイ） ===
echo.

git status
if errorlevel 1 (
  echo.
  echo .git が見つかりません。先に以下を実行してください：
  echo   git init
  echo   git remote add origin https://github.com/poifulhakase/pointlab.git
  echo.
  pause
  exit /b 1
)

git add -A
git status
echo.
set /p confirm="コミットして push しますか? (y/n): "
if /i not "%confirm%"=="y" (
  echo キャンセルしました。
  pause
  exit /b 0
)

git commit -m "Update: 最新版を反映"
if errorlevel 1 (
  echo 変更がありませんでした。
  pause
  exit /b 0
)

git push origin main
if errorlevel 1 (
  echo.
  echo プッシュに失敗しました。
  echo リモートが未設定の場合：
  echo   git remote add origin https://github.com/poifulhakase/pointlab.git
  echo   git push -u origin main
  echo.
  pause
  exit /b 1
)

echo.
echo === 完了 ===
echo GitHub に push 済み。Vercel が自動デプロイします。
echo https://pointlab.vercel.app で確認できます。
pause
