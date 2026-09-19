# ロボトレード の日次実行（SPEC 13）。
#
# 起動 → パイプライン実行 → 通知 → 終了 の一発完結型。常駐しない。
#
# 🔴 ぽいロボのデータを先に最新化する。ロボトレード は public/data/*.json を**読むだけ**で、
#    それを更新するのは GitHub Actions（fetch-data.yml）。git pull しないと
#    「7日以上古い」で実行がスキップされる。
# 🔴 休場日・データ不足の判定は Python 側が持っている。ここでは曜日を見ない
#    （祝日判定を2か所に書かない。ぽいロボの marketCalendar.mjs が単一情報源）。
# 🔵 お知らせフィード（note・ポイ活）は休場日でも走る。main.py の中で
#    トレードのスキップ判定より前に置いてあるため。
#
# 手で動かすとき:
#   powershell -ExecutionPolicy Bypass -File scripts\run_daily.ps1
# 引数はそのまま main.py へ渡る:
#   powershell -ExecutionPolicy Bypass -File scripts\run_daily.ps1 -Args "--weekly"

param(
    [string]$Args = ""
)

$ErrorActionPreference = "Stop"

# 🔴 native コマンドの stdout を UTF-8 として読む。
#    既定では OEM コードページ（日本語環境なら cp932）で解釈されるため、
#    Python が UTF-8 で出した日本語がログで化ける。
#    タスクスケジューラ経由でだけ起きる（対話シェルでは既に UTF-8 のことがある）ので、
#    手で動かして確認しただけでは気づけない。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $PSScriptRoot          # ロボトレード
$repo = Split-Path -Parent $root                  # stock-calendar
$python = Join-Path $root ".venv\Scripts\python.exe"
$logDir = Join-Path $root "logs"
$logFile = Join-Path $logDir ("run_" + (Get-Date -Format "yyyy-MM-dd") + ".log")

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-Log($message) {
    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $message
    Write-Output $line
    Add-Content -Path $logFile -Value $line -Encoding utf8
}

Write-Log "=== ロボトレード 日次実行 ==="

if (-not (Test-Path $python)) {
    Write-Log "🔴 venv が無い: $python"
    exit 2
}

# --- ① ぽいロボのデータを最新化 ---
Push-Location $repo
try {
    # 🔴 未コミットの変更があると rebase は必ず失敗する。開発中はそれが普通なので、
    #    試す前に見て、汚れていれば黙って飛ばす（毎回エラーを出さない）。
    $dirty = (& git status --porcelain | Measure-Object).Count
    if ($dirty -gt 0) {
        Write-Log "🔵 未コミットの変更が $dirty 件あるので git pull を飛ばす"
    } else {
        Write-Log "git pull (ぽいロボのデータ)"
        $pull = (& git pull --rebase | Out-String).Trim()
        if ($LASTEXITCODE -eq 0) {
            Write-Log $pull
        } else {
            # 🔵 pull に失敗しても止めない。鮮度チェックは Python 側にあるので、
            #    古ければそこでスキップされる（勝手に古いデータで走らせない）。
            Write-Log "🔵 git pull に失敗したが続行する"
        }
    }
} finally {
    Pop-Location
}

# --- ② 本体 ---
Push-Location $root
try {
    $env:PYTHONIOENCODING = "utf-8"
    $argList = @("main.py")
    if ($Args) { $argList += $Args.Split(" ") }

    Write-Log ("実行: python " + ($argList -join " "))
    # 🔴 native コマンドに 2>&1 を付けない。PowerShell 5.1 は stderr の各行を
    #    ErrorRecord に包み、**成功しても終了コードが 1 になる**。
    #    Python 側のログは stdout に出している（robotrade/logs.py）。
    & $python @argList | ForEach-Object { Write-Log $_ }
    $code = $LASTEXITCODE
} finally {
    Pop-Location
}

Write-Log ("終了コード: " + $code)
exit $code
