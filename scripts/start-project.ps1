$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

$services = @(
    @{ Name = 'Portal Backend'; Directory = Join-Path $projectRoot 'backend'; Command = 'npm start' },
    @{ Name = 'Portal Frontend'; Directory = Join-Path $projectRoot 'frontend'; Command = 'npm run dev -- --host localhost' }
)

foreach ($service in $services) {
    if (-not (Test-Path $service.Directory)) {
        throw "Service directory not found: $($service.Directory)"
    }

    $command = "Set-Location -LiteralPath '$($service.Directory)'; `$Host.UI.RawUI.WindowTitle = '$($service.Name)'; & $($service.Command)"
    Start-Process powershell.exe -WorkingDirectory $service.Directory -ArgumentList @(
        '-NoExit',
        '-NoProfile',
        '-Command',
        $command
    )
}

Write-Host 'Started Portal Backend and Portal Frontend. The backend auto-starts the existing Myraa service.'
Write-Host 'Portal: http://localhost:5173/'
Write-Host 'Myraa:  integrated at /student/myraa'
