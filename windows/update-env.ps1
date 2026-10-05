# Adds any NEW settings from .env.example to your .env, without touching the
# values you already have. Makes a backup first (.env.backup-<date>).
# Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File windows\update-env.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$example = Join-Path $root ".env.example"
$target = Join-Path $root ".env"

if (-not (Test-Path $target)) {
  Write-Host "No .env found. Run windows\new-env.ps1 to create one." -ForegroundColor Yellow
  exit 1
}

$current = [System.IO.File]::ReadAllText($target)
$have = @{}
foreach ($line in ($current -split "`r?`n")) {
  if ($line -match '^\s*([A-Za-z0-9_]+)\s*=') { $have[$Matches[1]] = $true }
}

$added = New-Object System.Collections.Generic.List[string]
$newLines = New-Object System.Collections.Generic.List[string]
foreach ($line in (Get-Content $example)) {
  if ($line -match '^\s*([A-Za-z0-9_]+)\s*=') {
    $key = $Matches[1]
    if (-not $have.ContainsKey($key)) {
      $newLines.Add($line)
      $added.Add($key)
      $have[$key] = $true
    }
  }
}

if ($added.Count -eq 0) {
  Write-Host "Your .env already has every setting. Nothing changed." -ForegroundColor Green
  exit 0
}

$stamp = Get-Date -Format "yyyy-MM-dd-HHmm"
Copy-Item $target (Join-Path $root ".env.backup-$stamp")

$text = $current.TrimEnd("`r", "`n") + "`n`n# Added by update-env.ps1 on $stamp (fill in any empty values)`n" + ($newLines -join "`n") + "`n"
[System.IO.File]::WriteAllText($target, $text, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Added $($added.Count) new setting(s) to .env:" -ForegroundColor Green
$added | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "Backup saved as .env.backup-$stamp"
Write-Host "Open .env (notepad .env) and fill in any of the above that are empty."
