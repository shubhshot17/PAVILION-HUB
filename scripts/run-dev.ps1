$ErrorActionPreference = 'SilentlyContinue'

# Stop leftovers
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -eq '' -and $_.Path -like '*nodejs*'
} | ForEach-Object {
    $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
    if ($cmdline -match 'PAVILION-HUB') { Stop-Process -Id $_.Id -Force }
}

Write-Host 'Starting backend + frontend detached...'
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm run dev --prefix backend > dev-output.log 2>&1' -WorkingDirectory 'C:\Users\ADMIN\PAVILION-HUB' -WindowStyle Hidden
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm run dev --prefix frontend >> dev-output.log 2>&1' -WorkingDirectory 'C:\Users\ADMIN\PAVILION-HUB' -WindowStyle Hidden

Start-Sleep -Seconds 8

$apiOk = $false
$webOk = $false
foreach ($i in 1..10) {
    try { Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 3 | Out-Null; $webOk = $true; break } catch { Start-Sleep -Seconds 2 }
}
foreach ($i in 1..10) {
    try { Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 3 | Out-Null; $apiOk = $true; break } catch { Start-Sleep -Seconds 2 }
}
Write-Host "API health: $apiOk  Frontend: $webOk"
