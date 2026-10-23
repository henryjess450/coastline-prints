# Pull the latest code and rebuild the app. Run by the "CoastlineDeploy"
# scheduled task, so it runs in the logged-in Windows session (Docker needs the
# Windows Credential Manager, which SSH sessions can't reach).
# Start it from anywhere with:  schtasks /run /tn CoastlineDeploy
# Output goes to deploy.log next to this repo's docker-compose.yml.
$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$log = Join-Path $repo "deploy.log"
"=== Deploy started $(Get-Date -Format s) ===" | Out-File $log -Encoding utf8
git pull 2>&1 | Out-File $log -Append -Encoding utf8
docker compose up -d --build 2>&1 | Out-File $log -Append -Encoding utf8
"=== Deploy finished $(Get-Date -Format s), exit $LASTEXITCODE ===" | Out-File $log -Append -Encoding utf8
