$ErrorActionPreference = 'Stop'

$taskName = 'CollegePracticalPortalBackend'
$runnerPath = Join-Path $PSScriptRoot 'keep-backend-running.ps1'
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$powershellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runnerPath`""

$action = New-ScheduledTaskAction -Execute $powershellPath -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$settings = New-ScheduledTaskSettingsSet `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $taskName `
    -Description 'Keeps the College Practical Portal backend running and restarts it after failures.' `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Write-Host "Backend auto-start is installed for $currentUser and has been started."
Write-Host 'The backend starts at your next Windows sign-in and retries after unexpected exits.'
Write-Host "Supervisor log: $env:LOCALAPPDATA\CollegePracticalPortal\backend-supervisor.log"
