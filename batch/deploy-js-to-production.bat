@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo === js フォルダ本番反映（pointlab-deploy 経由） ===
echo.

set "DEPLOY_DIR=%~dp0..\..\pointlab-deploy"
if not exist "%DEPLOY_DIR%\.git" (
  echo pointlab-deploy が見つかりません。
  echo.
  echo 事前に以下を実行してください：
  echo   cd %~dp0..\..
  echo   git clone https://github.com/poifulhakase/pointlab.git pointlab-deploy
  echo.
  set "DEPLOY_DIR=%~dp0..\..\..\pointlab-deploy"
  echo デスクトップ直下の pointlab-deploy を探しています...
)

if not exist "%DEPLOY_DIR%\.git" (
  echo.
  echo [手動での手順]
  echo 1. デスクトップで pointlab-deploy フォルダを開く
  echo 2. PointLab\pointlab\js を pointlab-deploy\ にコピー
  echo 3. pointlab-deploy で以下を実行：
  echo    git add js
  echo    git commit -m "fix: add js folder"
  echo    git push origin main
  echo.
  pause
  exit /b 1
)

echo js をコピーしています...
xcopy "%~dp0..\js" "%DEPLOY_DIR%\js\" /E /Y /I
if errorlevel 1 (
  echo コピーに失敗しました。
  pause
  exit /b 1
)

echo.
echo pointlab-deploy で git 操作...
cd /d "%DEPLOY_DIR%"
git add js/
git status
echo.
git commit -m "fix: add js folder for header, nav, tabs"
git push origin main

echo.
echo === 完了 ===
pause
