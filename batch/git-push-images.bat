@echo off
chcp 65001 >nul
cd /d "%~dp0..\.."

echo === 画像をGitに追加してpush ===
echo.

REM 副業画像は HTML 埋め込みのため images/ に存在しなくても OK
git add pointlab/images/*.png pointlab/images/*.jpg 2>nul
git add pointlab/images/
git status

echo.
set /p OK="コミットしてpushしますか？ (y/n): "
if /i not "%OK%"=="y" exit /b 0

git commit -m "副業サムネ画像を追加"
git push origin main

echo.
echo === 完了 ===
echo 数分後に https://pointlab.vercel.app で反映されます
pause
