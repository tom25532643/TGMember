$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Run-Step {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$Executable,
    [string[]]$Arguments
  )

  Write-Host "`n==> $Name" -ForegroundColor Cyan
  Push-Location $WorkingDirectory
  try {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$Name failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

Run-Step `
  -Name "Backend health via TestClient" `
  -WorkingDirectory (Join-Path $root "services/backend-api") `
  -Executable "venv/Scripts/python.exe" `
  -Arguments @("-c", "from fastapi.testclient import TestClient; import main; r=TestClient(main.app).get('/health'); print(r.status_code, r.json())")

Run-Step `
  -Name "TDLib service tests" `
  -WorkingDirectory (Join-Path $root "services/tdlib-service") `
  -Executable "venv/Scripts/python.exe" `
  -Arguments @("-m", "pytest", "tests", "-q")

Run-Step `
  -Name "Mobile lint" `
  -WorkingDirectory (Join-Path $root "tgmember-mobile") `
  -Executable "npm.cmd" `
  -Arguments @("run", "lint")

Run-Step `
  -Name "Mobile typecheck" `
  -WorkingDirectory (Join-Path $root "tgmember-mobile") `
  -Executable "npm.cmd" `
  -Arguments @("run", "typecheck")

Write-Host "`nAll checks completed." -ForegroundColor Green