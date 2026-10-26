# Launches a local mongod using the binary downloaded by the backend test harness.
$ErrorActionPreference = 'Stop'

$dataDir = Join-Path $PSScriptRoot '..\.mongo-data'
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}

$cacheDir = Join-Path $env:USERPROFILE '.cache\mongodb-binaries'
$mongod = Get-ChildItem -Path $cacheDir -Filter 'mongod*.exe' -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $mongod) {
    Write-Error "mongod binary not found in $cacheDir. Run 'npm test --prefix backend' once to download it."
}

$running = Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -InformationLevel Quiet
if ($running) {
    Write-Host "MongoDB is already listening on 127.0.0.1:27017"
    exit 0
}

Write-Host "Starting mongod from $mongod ..."
Start-Process -FilePath $mongod -ArgumentList "--dbpath `"$dataDir`" --port 27017 --bind_ip 127.0.0.1" -WindowStyle Hidden
Start-Sleep -Seconds 3

if (Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -InformationLevel Quiet) {
    Write-Host "MongoDB is up and running on 127.0.0.1:27017"
} else {
    Write-Error "Failed to start MongoDB"
}
