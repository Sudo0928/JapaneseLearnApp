param(
  [switch]$SkipMigrations,
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
  if (-not (Test-Path $backendEnv)) {
    if ($DryRun) {
      Write-Warning "Missing $backendEnv. Copy packages/backend/.env.production.example first."
      return
    }

    throw "Missing $backendEnv. Copy packages/backend/.env.production.example first."
  }

  if (Test-PlaceholderDatabaseUrl -EnvPath $backendEnv) {
    throw "packages/backend/.env still uses the example DATABASE_URL (user:password). Replace it with your real PostgreSQL credentials first."
  }

  if (-not $SkipMigrations) {
    Invoke-NpmStep -Description 'Run backend migrations' -Arguments @('run', 'migrate', '--workspace=packages/backend')
  }

  Invoke-NpmStep -Description 'Start backend server' -Arguments @('run', 'start', '--workspace=packages/backend')
} finally {
  Pop-Location
}
