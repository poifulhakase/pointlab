@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo === サムネイル画像のコピー ===
echo.

if not exist "images" mkdir images

set "NOTE1=%USERPROFILE%\Downloads\note用"
set "NOTE2=%USERPROFILE%\Downloads\note用2"
set "NEWFOLDER=%USERPROFILE%\Downloads\新しいフォルダー"

echo ポイ活画像（note用）をコピー中...
if exist "%NOTE1%\Poikatsu_3min_Recipe_rakutenSPS.jpg" (
  copy /Y "%NOTE1%\Poikatsu_3min_Recipe_rakutenSPS.jpg" "images\" >nul
  copy /Y "%NOTE1%\Poikatsu_3min_Recipe_Moppy.jpg" "images\" >nul
  copy /Y "%NOTE1%\Poikatsu_3min_Recipe_DotMobey.jpg" "images\" >nul
  copy /Y "%NOTE1%\Poikatsu_3min_Recipe_PayPayPoint.jpg" "images\" >nul
  copy /Y "%NOTE1%\Poikatsu_3min_Recipe_RakutenPoint.jpg" "images\" >nul
  copy /Y "%NOTE1%\Poikatsu_3min_Recipe_TikTok Lite.jpg" "images\Poikatsu_3min_Recipe_TikTok Lite.jpg" >nul
  copy /Y "%NOTE1%\Poikatsu_3min_Recipe_Uovice.jpg" "images\" >nul
  copy /Y "%NOTE1%\Poikatsu_3min_Recipe_V FASTch.jpg" "images\Poikatsu_3min_Recipe_V FASTch.jpg" >nul
  copy /Y "%NOTE1%\Poikatsu_3min_Recipe_Welcia.jpg" "images\" >nul
  copy /Y "%NOTE1%\Poikatsu_3min_Recipe_rakutenSPS.jpg" "images\" >nul
  echo ポイ活: OK
)
echo ポイ活マガジン画像（料理本・Cursor assets）をコピー中...
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*cooking_class*.png") do copy /Y "%%F" "images\Poikatsu_3min_Recipe_cooking_class.png" >nul 2>&1
if exist "images\Poikatsu_3min_Recipe_cooking_class.png" (echo ポイ活マガジン: OK) else (echo 注意: ポイ活マガジン画像が見つかりません)
echo マツ活画像（Cursor assets）をコピー中...
echo   正しい画像：「マツ活」「ポイ活3分レシピ」＋シェフの図
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*BA236BE7*.png") do copy /Y "%%F" "images\Poikatsu_3min_Recipe_Matsumotokiyoshi.png" >nul 2>&1
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*392E5C96*.png") do copy /Y "%%F" "images\Poikatsu_3min_Recipe_Matsumotokiyoshi.png" >nul 2>&1
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*3c11c08e*.png") do copy /Y "%%F" "images\Poikatsu_3min_Recipe_Matsumotokiyoshi.png" >nul 2>&1
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*D6D7917A*.png") do copy /Y "%%F" "images\Poikatsu_3min_Recipe_Matsumotokiyoshi.png" >nul 2>&1
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*a3cb9356*.png") do copy /Y "%%F" "images\Poikatsu_3min_Recipe_Matsumotokiyoshi.png" >nul 2>&1
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*Matsumotokiyoshi*.png") do copy /Y "%%F" "images\Poikatsu_3min_Recipe_Matsumotokiyoshi.png" >nul 2>&1
echo   上書き後、ブラウザをCtrl+Shift+Rでハードリロードしてください
if exist "images\Poikatsu_3min_Recipe_Matsumotokiyoshi.png" (
  echo マツ活: OK
) else (
  echo 注意: マツ活画像が見つかりません（Cursorに貼った画像をassetsから取得）
)

if not exist "images\Poikatsu_3min_Recipe_cooking_class.png" (
  if exist "%NOTE1%\Poikatsu_3min_Recipe_cooking_class.png" (
    copy /Y "%NOTE1%\Poikatsu_3min_Recipe_cooking_class.png" "images\" >nul
    echo ポイ活マガジン（note用）: OK
  )
)
if not exist "images\Poikatsu_3min_Recipe_Matsumotokiyoshi.png" (
  if exist "%NOTE1%\Poikatsu_3min_Recipe_Matsumotokiyoshi.png" (
    copy /Y "%NOTE1%\Poikatsu_3min_Recipe_Matsumotokiyoshi.png" "images\" >nul
    echo マツ活（note用）: OK
  )
)

echo 生き方画像（note用2）をコピー中...
if exist "%NOTE2%\Compass_for_Living_career_eye_catching_parallel_carrier.jpg" (
  copy /Y "%NOTE2%\Compass_for_Living_career_eye_catching_parallel_carrier.jpg" "images\" >nul
  copy /Y "%NOTE2%\Compass_for_Living_find_eye_catching_find.jpg" "images\" >nul
  copy /Y "%NOTE2%\Compass_for_Living_inauguration_eye_catching_quiet_retirement_silently_practice.jpg" "images\" >nul
  echo 生き方: OK
) else (
  echo 注意: %NOTE2% が見つかりません
)

echo 副業画像をコピー中...
if exist "images-source\Side_Biz_Encyclopedia_Delegate.png" (
  copy /Y "images-source\Side_Biz_Encyclopedia_Delegate.png" "images\" >nul
  echo 副業: OK（images-source より）
) else (
  if exist "images\Side_Biz_Encyclopedia_Delegate.png" (echo 副業: 既存を使用) else (echo 注意: images\Side_Biz_Encyclopedia_Delegate.png を images/ または images-source/ に配置してください)
)
echo ハカセAI画像をコピー中...
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*HakaseAI*.png") do copy /Y "%%F" "images\Future_Gadget_HakaseAI.png" >nul 2>&1
echo 開業・確定申告・ぽいんとらぼ画像をコピー中...
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*3E334533*.png") do copy /Y "%%F" "images\Sole_Proprietor_Shinkoku_thumbnail.png" >nul 2>&1
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*file_a_tax_return*.png") do copy /Y "%%F" "images\Sole_Proprietor_Shinkoku_thumbnail.png" >nul 2>&1
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*fcaec837*.png") do copy /Y "%%F" "images\Sole_Proprietor_Shinkoku_thumbnail.png" >nul 2>&1
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*Kaigyo*.png") do copy /Y "%%F" "images\Sole_Proprietor_Kaigyo_thumbnail.png" >nul 2>&1
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*Sole_Proprietor*.png") do copy /Y "%%F" "images\Sole_Proprietor_Kaigyo_thumbnail.png" >nul 2>&1
if exist "images\Sole_Proprietor_Shinkoku_thumbnail.png" (echo 確定申告: OK) else (echo 注意: 確定申告画像をCursorに貼り、copy-images.batを再実行)
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*Pointlab*.png") do copy /Y "%%F" "images\Pointlab_thumbnail.png" >nul 2>&1
echo 株式投資画像（新しいフォルダー）をコピー中...
if exist "%NEWFOLDER%\Stock_Trade_Lab_TradingView.png" (
  copy /Y "%NEWFOLDER%\Stock_Trade_Lab_*.png" "images\" >nul
  echo 株式投資: OK
) else (
  echo 注意: %NEWFOLDER% が見つかりません
)

echo.
dir /b images\*.jpg images\*.png 2>nul
if errorlevel 1 (
  echo 画像がコピーされていません。Downloads に note用 / note用2 / 新しいフォルダー があるか確認してください。
) else (
  echo.
  echo === 完了 ===
  echo デプロイ前に deploy.bat を実行してください。
)
echo faviconをコピー中...
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*0d1a022b*.png") do (
  copy /Y "%%F" "favicon-32x32.png" >nul 2>&1
  copy /Y "%%F" "favicon-16x16.png" >nul 2>&1
  goto :favicon_done
)
for %%F in ("%USERPROFILE%\.cursor\projects\c-Users-owner-OneDrive-PointLab\assets\*favicon*.png") do (
  copy /Y "%%F" "favicon-32x32.png" >nul 2>&1
  copy /Y "%%F" "favicon-16x16.png" >nul 2>&1
  goto :favicon_done
)
:favicon_done
if exist "favicon-32x32.png" (echo favicon: OK) else (echo 注意: faviconが見つかりません)

if "%1"=="" pause
