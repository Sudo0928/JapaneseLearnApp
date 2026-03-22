param(
  [switch]$RunMigrations,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Test-PlaceholderDatabaseUrl {
  param(
    [Parameter(Mandatory = $true)]
    [string]$EnvPath
  )

  if (-not (Test-Path $EnvPath)) {
    return $false
  }

  $line = Get-Content $EnvPath | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
  if (-not $line) {
    return $false
  }

  $databaseUrl = $line.Substring('DATABASE_URL='.Length).Trim()
  return (
    $databaseUrl -match '^postgres(ql)?://user:' -or
    $databaseUrl -match '^postgres(ql)?://[^:]+:(password|your_password|change-me|replace-me)@'
  )
}

function Invoke-NpmStep {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Description,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $display = "npm $($Arguments -join ' ')"
  Write-Host "==> $Description"
  Write-Host "    $display"

  if ($DryRun) {
    return
  }

  & npm @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $display"
  }
}

Push-Location $repoRoot
try {
  $backendEnv = Join-Path $repoRoot 'packages\backend\.env'
  $webEnv = Join-Path $repoRoot 'packages\web\.env.production'

  if (-not (Test-Path $backendEnv)) {
    Write-Warning "Missing $backendEnv. Copy packages/backend/.env.production.example first."
  }
  elseif (Test-PlaceholderDatabaseUrl -EnvPath $backendEnv) {
    throw "packages/backend/.env still uses the example DATABASE_URL (user:password). Replace it with your real PostgreSQL credentials first."
  }

  if (-not (Test-Path $webEnv)) {
    Write-Warning "Missing $webEnv. Copy packages/web/.env.production.example first."
  }

  Invoke-NpmStep -Description 'Build shared package' -Arguments @('run', 'build', '--workspace=packages/shared')

  if ($RunMigrations) {
    Invoke-NpmStep -Description 'Run backend migrations' -Arguments @('run', 'migrate', '--workspace=packages/backend')
  }

  Invoke-NpmStep -Description 'Build backend package' -Arguments @('run', 'build', '--workspace=packages/backend')
  Invoke-NpmStep -Description 'Build web package' -Arguments @('run', 'build', '--workspace=packages/web')

  Write-Host ''
  Write-Host 'Self-hosting build steps completed.'
  Write-Host 'Next: start the backend with scripts/selfhost-start-backend.ps1 and point Caddy at packages/web/dist.'
} finally {
  Pop-Location
}
