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

Write-Host "=== Copying thumbnails ===" -ForegroundColor Cyan
Write-Host ""

# ポイ活（note用）
Write-Host "Copying Poikatsu images..."
$poiSrc = Join-Path $note1 "Poikatsu_3min_Recipe_rakutenSPS.jpg"
if (Test-Path $poiSrc) {
  Get-ChildItem $note1 -Filter "Poikatsu_3min_Recipe_*.jpg" -ErrorAction SilentlyContinue | ForEach-Object {
    $dest = if ($_.Name -match "TikTok Lite|V FASTch") { Join-Path $imagesDir $_.Name } else { Join-Path $imagesDir $_.Name }
    Copy-Item $_.FullName $dest -Force
  }
  Write-Host "Poikatsu: OK"
}

# ポイ活マガジン・マツ活（assets）
Write-Host "Copying cooking class image..."
if (Test-Path $assetsDir) {
  Get-ChildItem $assetsDir -Filter "*cooking_class*.png" -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $imagesDir "Poikatsu_3min_Recipe_cooking_class.png") -Force
  }
}
if (Test-Path (Join-Path $imagesDir "Poikatsu_3min_Recipe_cooking_class.png")) { Write-Host "Cooking: OK" } else { Write-Host "Note: cooking image not found" }

Write-Host "Copying Matsukatsu image..."
$matsuDest = Join-Path $imagesDir "Poikatsu_3min_Recipe_Matsumotokiyoshi.png"
$matsu = Get-ChildItem $assetsDir -Filter "*.png" -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -match "BA236BE7|392E5C96|3c11c08e|D6D7917A|a3cb9356|Matsumotokiyoshi"
} | Select-Object -First 1
if ($matsu) {
  Copy-Item $matsu.FullName $matsuDest -Force
}
if (Test-Path (Join-Path $imagesDir "Poikatsu_3min_Recipe_Matsumotokiyoshi.png")) { Write-Host "Matsukatsu: OK" } else {
  if (Test-Path (Join-Path $note1 "Poikatsu_3min_Recipe_Matsumotokiyoshi.png")) {
    Copy-Item (Join-Path $note1 "Poikatsu_3min_Recipe_Matsumotokiyoshi.png") $imagesDir -Force
    Write-Host "Matsukatsu: OK (note)"
  } else { Write-Host "Note: Matsukatsu image not found" }
}

# 生き方
Write-Host "Copying Living images..."
$livingSrc = Join-Path $note2 "Compass_for_Living_career_eye_catching_parallel_carrier.jpg"
if (Test-Path $livingSrc) {
  Get-ChildItem $note2 -Filter "Compass_for_Living_*.jpg" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName $imagesDir -Force
  }
  Write-Host "Living: OK"
} else { Write-Host "Note: note2 folder not found" }

# 副業（images-source）
Write-Host "Copying Side Biz image..."
$sideBiz = Join-Path $imagesSource "Side_Biz_Encyclopedia_Delegate.png"
if (Test-Path $sideBiz) {
  Copy-Item $sideBiz $imagesDir -Force
  Write-Host "Side Biz: OK"
} elseif (Test-Path (Join-Path $imagesDir "Side_Biz_Encyclopedia_Delegate.png")) {
  Write-Host "Side Biz: using existing"
} else {
  Write-Host "Note: place Side_Biz_Encyclopedia_Delegate.png in images/"
}

# ぽいナビ・博士画像
Write-Host "Copying Hakase image..."
$poinaviDir = Join-Path $root "poinavi"
$hakaseGif = Join-Path $poinaviDir "hakase.gif"
$hakasePng = Join-Path $poinaviDir "hakase.png"
$hakaseGifSrc = Get-ChildItem $assetsDir -Filter "*hakase*.gif" -ErrorAction SilentlyContinue | Select-Object -First 1
$hakasePngSrc = Get-ChildItem $assetsDir -Filter "*hakase*.png" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($hakaseGifSrc) {
  Copy-Item $hakaseGifSrc.FullName $hakaseGif -Force
  Write-Host "Hakase: OK - GIF"
  Write-Host "Making GIF transparent and slowing loop..."
  Push-Location $root
  node scripts\make-gif-transparent.js 2>$null
  Pop-Location
} elseif ($hakasePngSrc) {
  Copy-Item $hakasePngSrc.FullName $hakasePng -Force
  Write-Host "Hakase: OK - PNG"
} else {
  Write-Host "Note: Hakase image not found"
}

# ポイ活マガジン（note用フォールバック）
if (-not (Test-Path (Join-Path $imagesDir "Poikatsu_3min_Recipe_cooking_class.png"))) {
  if (Test-Path (Join-Path $note1 "Poikatsu_3min_Recipe_cooking_class.png")) {
    Copy-Item (Join-Path $note1 "Poikatsu_3min_Recipe_cooking_class.png") $imagesDir -Force
    Write-Host "Cooking (note): OK"
  }
}

# ハカセAI・確定申告・開業・ぽいんとらぼ
Write-Host "Copying HakaseAI, Kaigyo, Shinkoku images..."
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
if (Test-Path (Join-Path $imagesDir "Sole_Proprietor_Shinkoku_thumbnail.png")) { Write-Host "Shinkoku: OK" } else { Write-Host "Note: paste Shinkoku image in Cursor" }

# 株式投資
Write-Host "Copying Stock images..."
$stockSrc = Join-Path $newFolder "Stock_Trade_Lab_TradingView.png"
if (Test-Path $stockSrc) {
  Get-ChildItem $newFolder -Filter "Stock_Trade_Lab_*.png" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName $imagesDir -Force
  }
  Write-Host "Stock: OK"
} else { Write-Host "Note: new folder not found" }

# favicon
Write-Host "Copying favicon..."
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
if (Test-Path (Join-Path $root "favicon-32x32.png")) { Write-Host "Favicon: OK" } else { Write-Host "Note: favicon not found" }

$count = (Get-ChildItem $imagesDir -Include "*.jpg","*.png" -File -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host ""
if ($count -gt 0) {
  Write-Host "=== Done ($count files) ===" -ForegroundColor Green
  Write-Host "Run deploy-now.bat or sync-and-push.bat to deploy."
} else {
  Write-Host "No images copied. Check Downloads for note / note2 / new folder." -ForegroundColor Yellow
}
