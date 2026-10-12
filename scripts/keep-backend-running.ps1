$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDirectory = Join-Path $projectRoot 'backend'
$serverFile = Join-Path $backendDirectory 'src\server.js'
$logDirectory = Join-Path $env:LOCALAPPDATA 'CollegePracticalPortal'
$logFile = Join-Path $logDirectory 'backend-supervisor.log'
$standardOutputFile = Join-Path $logDirectory 'backend.stdout.log'
$standardErrorFile = Join-Path $logDirectory 'backend.stderr.log'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$portOccupied = $false

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Set-Location -LiteralPath $backendDirectory

while ($true) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        if (-not $portOccupied) {
            Add-Content -LiteralPath $logFile -Value "[$(Get-Date -Format o)] Port 5000 is already in use; waiting before starting the backend."
            $portOccupied = $true
        }
        Start-Sleep -Seconds 5
        continue
    }

    $portOccupied = $false
    Add-Content -LiteralPath $logFile -Value "[$(Get-Date -Format o)] Starting the portal backend."
    $serverArguments = '"{0}"' -f $serverFile
    $serverProcess = Start-Process `
        -FilePath $nodePath `
        -ArgumentList $serverArguments `
        -WorkingDirectory $backendDirectory `
        -RedirectStandardOutput $standardOutputFile `
        -RedirectStandardError $standardErrorFile `
        -Wait `
        -PassThru
    $exitCode = $serverProcess.ExitCode
    Add-Content -LiteralPath $logFile -Value "[$(Get-Date -Format o)] Backend exited with code $exitCode; retrying in 5 seconds."
    Start-Sleep -Seconds 5
}
