# copy-images.ps1 - copy-images.bat の PowerShell 版（PowerShell からの実行時にエンコーディング問題を回避）
# 使い方: pointlab または batch フォルダで .\copy-images.ps1 を実行

$ErrorActionPreference = "SilentlyContinue"
$root = (Get-Item $PSScriptRoot).Parent.FullName
$assetsDir = Join-Path $env:USERPROFILE ".cursor\projects\c-Users-owner-OneDrive-PointLab\assets"
$imagesDir = Join-Path $root "images"
$imagesSource = Join-Path $root "images-source"
$note1 = Join-Path $env:USERPROFILE "Downloads\note用"
$note2 = Join-Path $env:USERPROFILE "Downloads\note用2"
$newFolder = Join-Path $env:USERPROFILE "Downloads\新しいフォルダー"

if (-not (Test-Path $imagesDir)) { New-Item -ItemType Directory -Path $imagesDir -Force | Out-Null }

Write-Host "=== サムネイル画像のコピー ===" -ForegroundColor Cyan
Write-Host ""

# ポイ活（note用）
Write-Host "ポイ活画像（note用）をコピー中..."
$poiSrc = Join-Path $note1 "Poikatsu_3min_Recipe_rakutenSPS.jpg"
if (Test-Path $poiSrc) {
  Get-ChildItem $note1 -Filter "Poikatsu_3min_Recipe_*.jpg" -ErrorAction SilentlyContinue | ForEach-Object {
    $dest = if ($_.Name -match "TikTok Lite|V FASTch") { Join-Path $imagesDir $_.Name } else { Join-Path $imagesDir $_.Name }
    Copy-Item $_.FullName $dest -Force
  }
  Write-Host "ポイ活: OK"
}

# ポイ活マガジン・マツ活（assets）
Write-Host "ポイ活マガジン画像（Cursor assets）をコピー中..."
if (Test-Path $assetsDir) {
  Get-ChildItem $assetsDir -Filter "*cooking_class*.png" -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $imagesDir "Poikatsu_3min_Recipe_cooking_class.png") -Force
  }
}
if (Test-Path (Join-Path $imagesDir "Poikatsu_3min_Recipe_cooking_class.png")) { Write-Host "ポイ活マガジン: OK" } else { Write-Host "注意: ポイ活マガジン画像が見つかりません" }

Write-Host "マツ活画像（Cursor assets）をコピー中..."
$matsuDest = Join-Path $imagesDir "Poikatsu_3min_Recipe_Matsumotokiyoshi.png"
$matsu = Get-ChildItem $assetsDir -Filter "*.png" -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -match "BA236BE7|392E5C96|3c11c08e|D6D7917A|a3cb9356|Matsumotokiyoshi"
} | Select-Object -First 1
if ($matsu) {
  Copy-Item $matsu.FullName $matsuDest -Force
}
if (Test-Path (Join-Path $imagesDir "Poikatsu_3min_Recipe_Matsumotokiyoshi.png")) { Write-Host "マツ活: OK" } else {
  if (Test-Path (Join-Path $note1 "Poikatsu_3min_Recipe_Matsumotokiyoshi.png")) {
    Copy-Item (Join-Path $note1 "Poikatsu_3min_Recipe_Matsumotokiyoshi.png") $imagesDir -Force
    Write-Host "マツ活: OK (note用)"
  } else { Write-Host "注意: マツ活画像が見つかりません" }
}

# 生き方
Write-Host "生き方画像（note用2）をコピー中..."
$livingSrc = Join-Path $note2 "Compass_for_Living_career_eye_catching_parallel_carrier.jpg"
if (Test-Path $livingSrc) {
  Get-ChildItem $note2 -Filter "Compass_for_Living_*.jpg" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName $imagesDir -Force
  }
  Write-Host "生き方: OK"
} else { Write-Host "注意: $note2 が見つかりません" }

# 副業（images-source）
Write-Host "副業画像をコピー中..."
$sideBiz = Join-Path $imagesSource "Side_Biz_Encyclopedia_Delegate.png"
if (Test-Path $sideBiz) {
  Copy-Item $sideBiz $imagesDir -Force
  Write-Host "副業: OK（images-source）"
} elseif (Test-Path (Join-Path $imagesDir "Side_Biz_Encyclopedia_Delegate.png")) {
  Write-Host "副業: 既存を使用"
} else {
  Write-Host "注意: images\Side_Biz_Encyclopedia_Delegate.png を配置してください"
}

# ぽいナビ・博士画像
Write-Host "ぽいナビ研究室・博士画像をコピー中..."
$poinaviDir = Join-Path $root "poinavi"
$hakaseGif = Join-Path $poinaviDir "hakase.gif"
$hakasePng = Join-Path $poinaviDir "hakase.png"
$hakaseGifSrc = Get-ChildItem $assetsDir -Filter "*hakase*.gif" -ErrorAction SilentlyContinue | Select-Object -First 1
$hakasePngSrc = Get-ChildItem $assetsDir -Filter "*hakase*.png" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($hakaseGifSrc) {
  Copy-Item $hakaseGifSrc.FullName $hakaseGif -Force
  Write-Host "博士: OK - GIF"
  Write-Host "博士GIFの白背景を透明化・ループ調整中..."
  Push-Location $root
  node scripts\make-gif-transparent.js 2>$null
  Pop-Location
} elseif ($hakasePngSrc) {
  Copy-Item $hakasePngSrc.FullName $hakasePng -Force
  Write-Host "博士: OK - PNG"
} else {
  Write-Host "注意: 博士画像が見つかりません"
}

# ポイ活マガジン（note用フォールバック）
if (-not (Test-Path (Join-Path $imagesDir "Poikatsu_3min_Recipe_cooking_class.png"))) {
  if (Test-Path (Join-Path $note1 "Poikatsu_3min_Recipe_cooking_class.png")) {
    Copy-Item (Join-Path $note1 "Poikatsu_3min_Recipe_cooking_class.png") $imagesDir -Force
    Write-Host "ポイ活マガジン（note用）: OK"
  }
}

# ハカセAI・確定申告・開業・ぽいんとらぼ
Write-Host "ハカセAI・開業・確定申告画像をコピー中..."
if (Test-Path $assetsDir) {
  Get-ChildItem $assetsDir -Filter "*HakaseAI*.png" -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $imagesDir "Future_Gadget_HakaseAI.png") -Force
  }
  Get-ChildItem $assetsDir -Filter "*.png" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Name -match "3E334533|file_a_tax_return|fcaec837") {
      Copy-Item $_.FullName (Join-Path $imagesDir "Sole_Proprietor_Shinkoku_thumbnail.png") -Force
    }
    if ($_.Name -match "Kaigyo|Sole_Proprietor") {
      Copy-Item $_.FullName (Join-Path $imagesDir "Sole_Proprietor_Kaigyo_thumbnail.png") -Force
    }
    if ($_.Name -match "Pointlab") {
      Copy-Item $_.FullName (Join-Path $imagesDir "Pointlab_thumbnail.png") -Force
    }
  }
}
if (Test-Path (Join-Path $imagesDir "Sole_Proprietor_Shinkoku_thumbnail.png")) { Write-Host "確定申告: OK" } else { Write-Host "注意: 確定申告画像を Cursor に貼り付け" }

# 株式投資
Write-Host "株式投資画像をコピー中..."
$stockSrc = Join-Path $newFolder "Stock_Trade_Lab_TradingView.png"
if (Test-Path $stockSrc) {
  Get-ChildItem $newFolder -Filter "Stock_Trade_Lab_*.png" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName $imagesDir -Force
  }
  Write-Host "株式投資: OK"
} else { Write-Host "注意: $newFolder が見つかりません" }

# favicon
Write-Host "faviconをコピー中..."
if (Test-Path $assetsDir) {
  Get-ChildItem $assetsDir -Filter "*0d1a022b*" -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $root "favicon-32x32.png") -Force
    Copy-Item $_.FullName (Join-Path $root "favicon-16x16.png") -Force
  }
  if (-not (Test-Path (Join-Path $root "favicon-32x32.png"))) {
    Get-ChildItem $assetsDir -Filter "*favicon*" -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object {
      Copy-Item $_.FullName (Join-Path $root "favicon-32x32.png") -Force
      Copy-Item $_.FullName (Join-Path $root "favicon-16x16.png") -Force
    }
  }
}
if (Test-Path (Join-Path $root "favicon-32x32.png")) { Write-Host "favicon: OK" } else { Write-Host "注意: faviconが見つかりません" }

$count = (Get-ChildItem $imagesDir -Include "*.jpg","*.png" -File -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host ""
if ($count -gt 0) {
  Write-Host "=== 完了 ($count 件) ===" -ForegroundColor Green
  Write-Host "deploy-now.bat を実行してデプロイしてください。"
} else {
  Write-Host "画像がコピーされていません。Downloads に note用 / note用2 / 新しいフォルダー があるか確認してください。" -ForegroundColor Yellow
}
