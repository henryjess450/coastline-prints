# Creates the .env settings file for Coastline Prints by asking for each value.
# Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File windows\new-env.ps1
# Press Enter to skip anything you don't have yet; you can run this again later.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$example = Join-Path $root ".env.example"
$target = Join-Path $root ".env"

if (Test-Path $target) {
  $answer = Read-Host ".env already exists. Replace it? (y/N)"
  if ($answer -notmatch '^[yY]') { Write-Host "Nothing changed."; exit 0 }
}

Write-Host ""
Write-Host "Coastline Prints setup. Paste each value and press Enter (Enter alone = leave blank)." -ForegroundColor Cyan
Write-Host ""

function Ask($label, $default = "") {
  $prompt = if ($default) { "$label [$default]" } else { $label }
  $v = Read-Host $prompt
  if ([string]::IsNullOrWhiteSpace($v)) { return $default }
  return $v.Trim()
}

$values = [ordered]@{}
$values["PICKUP_ADDRESS"] = Ask "Pickup address (kept private, only shown to paying customers)"
$values["OWNER_EMAIL"] = Ask "Email that receives new-order alerts" "coastline.printz@gmail.com"

Write-Host ""
Write-Host "Square: developer.squareup.com/apps > your app > Credentials and Locations" -ForegroundColor Cyan
$values["SQUARE_ENVIRONMENT"] = Ask "Square environment (production or sandbox)" "production"
$values["SQUARE_APPLICATION_ID"] = Ask "Square Application ID"
$values["SQUARE_ACCESS_TOKEN"] = Ask "Square Access token"
$values["SQUARE_LOCATION_ID"] = Ask "Square Location ID"
$values["SQUARE_WEBHOOK_SIGNATURE_KEY"] = Ask "Square webhook Signature Key (skip if not set up yet)"

Write-Host ""
Write-Host "Gmail: myaccount.google.com/apppasswords" -ForegroundColor Cyan
$values["GMAIL_USER"] = Ask "Gmail address that sends emails" "coastline.printz@gmail.com"
$values["GMAIL_APP_PASSWORD"] = Ask "Gmail App Password (16 letters)"

Write-Host ""
$values["ADMIN_USERNAME"] = Ask "Admin username for the dashboard (optional for now)"
$values["ADMIN_PASSWORD"] = Ask "Admin password (optional for now)"

# Start from .env.example and fill in the answers.
$lines = Get-Content $example
$done = @{}
$out = foreach ($line in $lines) {
  if ($line -match '^([A-Z0-9_]+)=') {
    $key = $Matches[1]
    if ($values.Contains($key)) {
      $done[$key] = $true
      $v = $values[$key] -replace '"', '\"'
      "$key=`"$v`""
      continue
    }
  }
  $line
}
foreach ($key in $values.Keys) {
  if (-not $done.ContainsKey($key)) {
    $v = $values[$key] -replace '"', '\"'
    $out += "$key=`"$v`""
  }
}

# UTF-8 without a byte-order mark, so Docker reads the first line correctly.
[System.IO.File]::WriteAllText($target, (($out -join "`n") + "`n"), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Saved $target" -ForegroundColor Green
Write-Host "Next: docker compose up -d --build"
