$ErrorActionPreference = 'Continue'
Set-Location C:\Users\ADMIN\PAVILION-HUB\backend
Start-Process -FilePath node -ArgumentList 'server.js' -WindowStyle Hidden
Start-Sleep -Seconds 3
$b = 'http://127.0.0.1:3000/api'
foreach ($t in (Invoke-RestMethod "$b/teams")) {
  foreach ($p in (Invoke-RestMethod "$b/players?teamId=$($t.id)")) {
    try { Invoke-RestMethod "$b/players/$($p.id)" -Method Delete | Out-Null; "deleted player $($p.name)" } catch { "player delete failed: $($_.Exception.Message)" }
  }
  try { Invoke-RestMethod "$b/teams/$($t.id)" -Method Delete | Out-Null; "deleted team $($t.name)" } catch { "team delete failed: $($_.Exception.Message)" }
}
foreach ($m in (Invoke-RestMethod "$b/matches")) {
  try { Invoke-RestMethod "$b/matches/$($m.id)" -Method Delete | Out-Null; "deleted match" } catch {}
}
"FINAL: teams=$((Invoke-RestMethod "$b/teams").Count) players=$((Invoke-RestMethod "$b/players").Count) matches=$((Invoke-RestMethod "$b/matches").Count)"
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
Where-Object { $_.CommandLine -like '*server.js*' } |
ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
'server stopped'
