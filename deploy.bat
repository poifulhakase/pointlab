@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === PointLab 本番反映 ===
echo.
echo [1] Vercel CLI 直接デプロイ
echo [2] Git push でVercel自動デプロイ
echo [3] ローカル同期（本番の変更を git pull で取得）
echo.
set /p choice="1, 2, or 3: "

if "%choice%"=="1" (
  echo.
  call "%~dp0batch\copy-images.bat" --silent 2>nul
  echo 画像を圧縮しています...
  node "%~dp0scripts\compress-images.js" 2>nul
  echo デプロイ前チェック...
  node "%~dp0scripts\verify-before-deploy.js"
  if errorlevel 1 (
    echo.
    echo 上記の問題を解消してから再度実行してください。
    pause
    exit /b 1
  )
  echo.
  echo pointlab/pointlab をデプロイ（正しいルート）
  npx vercel --prod
  if errorlevel 1 (
    echo デプロイに失敗しました。
    pause
    exit /b 1
  )
  goto :done
)

if "%choice%"=="2" (
  echo.
  call "%~dp0batch\copy-images.bat" --silent 2>nul
  echo キャッシュバスティング適用...
  node "%~dp0scripts\update-image-versions.js" 2>nul
  echo デプロイ前チェック...
  node "%~dp0scripts\verify-before-deploy.js"
  if errorlevel 1 (
    echo.
    echo 上記の問題を解消してから再度実行してください。
    pause
    exit /b 1
  )
  for /f "delims=" %%i in ('git rev-parse --show-toplevel 2^>nul') do set GIT_ROOT=%%i
  if defined GIT_ROOT cd /d "%GIT_ROOT%"
  
  git status
  echo.
  set /p confirm="コミットとプッシュしますか? (y/n): "
  if /i not "%confirm%"=="y" (
    echo キャンセルしました。
    pause
    exit /b 0
  )
  git add .
  git commit -m "Update: 管理画面追加・SEO改善"
  if errorlevel 1 (
    echo コミットに失敗しました。
    pause
    exit /b 1
  )
  git push origin main
  if errorlevel 1 (
    echo プッシュに失敗しました。
    pause
    exit /b 1
  )
  goto :done
)

if "%choice%"=="3" (
  for /f "delims=" %%i in ('git rev-parse --show-toplevel 2^>nul') do set GIT_ROOT=%%i
  if defined GIT_ROOT cd /d "%GIT_ROOT%"
  echo.
  echo 管理画面で修正した内容をローカルに反映します...
  git pull origin main
  if errorlevel 1 (
    echo 同期に失敗しました。
    pause
    exit /b 1
  )
  echo ローカルが本番と同期されました。
  goto :done
)

echo 無効な選択です。
pause
exit /b 1

:done
echo.
echo === 完了 ===
echo https://pointlab.vercel.app で確認できます。
echo 管理画面: https://pointlab.vercel.app/admin/
pause
