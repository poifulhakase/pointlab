# 入場歓迎Bot をWindowsタスクスケジューラに常駐登録する（WELCOME_BOT.md）。
#
# 🔴 ロボトレードの日次タスクとは性格が違う:
#    - トリガーは「**ログオン時**」（毎日決まった時刻ではない）
#    - 実行時間の上限は**無し**（常駐なので、時間で切られると止まる）
#    - 落ちたら**自動で再起動**する
#
# 🔵 PCが寝ている間の参加は検知できないが、Bot は起動時に
#    「最近参加したが歓迎していない人」を拾い直すので取りこぼさない（数時間遅れるだけ）。
#
#   登録:   powershell -ExecutionPolicy Bypass -File scripts\register_bot_task.ps1
#   確認:   powershell -ExecutionPolicy Bypass -File scripts\register_bot_task.ps1 -Show
#   解除:   powershell -ExecutionPolicy Bypass -File scripts\register_bot_task.ps1 -Remove
#   今すぐ: powershell -ExecutionPolicy Bypass -File scripts\register_bot_task.ps1 -Start

param(
    [string]$TaskName = "welcomebot",
    [switch]$Remove,
    [switch]$Show,
    [switch]$Start
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $root "scripts\run_bot.ps1"

if ($Show) {
    try {
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        $info = Get-ScheduledTaskInfo -TaskName $TaskName
        Write-Output "タスク: $TaskName"
        Write-Output ("  状態     : " + $task.State + "  （Running なら常駐中）")
        Write-Output ("  前回起動 : " + $info.LastRunTime + " (結果 " + $info.LastTaskResult + ")")
    } catch {
        Write-Output "タスク $TaskName は登録されていない"
    }
    exit 0
}

if ($Remove) {
    try {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Output "解除した: $TaskName"
    } catch {
        Write-Output "タスク $TaskName は登録されていない"
    }
    exit 0
}

if ($Start) {
    Start-ScheduledTask -TaskName $TaskName
    Write-Output "起動した: $TaskName"
    exit 0
}

if (-not (Test-Path $runner)) {
    Write-Error "run_bot.ps1 が無い: $runner"
    exit 2
}

# 🔴 .env にトークンが入っていないと起動してすぐ落ちる。登録の前に見ておく。
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
    $hasToken = (Get-Content $envFile -Encoding utf8 |
        Where-Object { $_ -match "^DISCORD_BOT_TOKEN=.+" } | Measure-Object).Count
    if ($hasToken -eq 0) {
        Write-Warning "DISCORD_BOT_TOKEN が .env に入っていない。登録はするが、入れるまで起動してもすぐ落ちる"
    }
} else {
    Write-Warning ".env が無い（.env.example をコピーして作る）"
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument ("-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runner`"") `
    -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([timespan]::Zero) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Description "入場歓迎Bot（ぽいふる博士の口上）" -Force | Out-Null

Write-Output "登録した: $TaskName（ログオン時に起動・常駐）"
Write-Output "  実行するもの: $runner"
Write-Output ""
Write-Output "🔵 実行時間の上限は無し（常駐なので時間で切らない）。"
Write-Output "   落ちたら1分後に再起動する（最大999回）。"
Write-Output ""
Write-Output "今すぐ起動: powershell -ExecutionPolicy Bypass -File scripts\register_bot_task.ps1 -Start"
Write-Output "状態を見る: powershell -ExecutionPolicy Bypass -File scripts\register_bot_task.ps1 -Show"
