<# 
HOW TO USE
==========
Inline query:
    .\Invoke-SupabaseQuery.ps1 -Query "select now();"

From file:
    .\Invoke-SupabaseQuery.ps1 -File .\queries\my.sql

Default (no params): lists all public tables.

Logs: .\logs\query_TIMESTAMP.txt
#>

[CmdletBinding()]
param(
  [string]$Query,
  [string]$File
)

$ErrorActionPreference = 'Stop'

# Read DATABASE_URL or SUPABASE_DB_URL from .env.server
function Get-EnvDbUrl {
  $envPath = "C:\Users\guita\ravbot_testbranch_clones_v1\v2\.env.server"
  if (-not (Test-Path $envPath)) {
    throw "Missing .env.server at $envPath"
  }
  $lines = Get-Content $envPath
  foreach ($line in $lines) {
    $t = $line.Trim()
    if ($t -and -not $t.StartsWith('#')) {
      if ($t -match '^(?i)\s*(export\s+)?DATABASE_URL\s*=\s*(.+)$') {
        return $Matches[2].Trim().Trim('"').Trim("'")
      }
      if ($t -match '^(?i)\s*(export\s+)?SUPABASE_DB_URL\s*=\s*(.+)$') {
        return $Matches[2].Trim().Trim('"').Trim("'")
      }
    }
  }
  throw "No DATABASE_URL or SUPABASE_DB_URL found in .env.server"
}

function Parse-PostgresUrl([string]$url) {
  $uri = [System.Uri]$url
  $u,$p = $uri.UserInfo.Split(':',2)
  return [pscustomobject]@{ 
    User=$u; Password=$p; Host=$uri.Host; 
    Port=$uri.Port; Database=$uri.AbsolutePath.TrimStart('/') 
  }
}

function Get-QueryText {
  if ($File) { return Get-Content $File -Raw }
  if ($Query) { return $Query }
  return "select table_name from information_schema.tables where table_schema='public';"
}

try {
  $logsDir = "logs"; New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
  $logPath = Join-Path $logsDir ("query_{0:yyyyMMdd_HHmmss}.txt" -f (Get-Date))

  $dbUrl = Get-EnvDbUrl
  $conn = Parse-PostgresUrl $dbUrl
  $queryText = Get-QueryText

  $env:PGPASSWORD = $conn.Password
  $tmp = Join-Path $env:TEMP "q_$([guid]::NewGuid()).sql"
  Set-Content $tmp $queryText

  & psql -h $conn.Host -p "$($conn.Port)" -U $conn.User -d $conn.Database -f $tmp 2>&1 | Tee-Object -FilePath $logPath | Out-Host
  Remove-Item $tmp
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue | Out-Null

  if ($LASTEXITCODE -ne 0) { throw "psql exited with code $LASTEXITCODE" }

  Write-Host "Success. Log: $logPath" -ForegroundColor Green
  exit 0
}
catch {
  Write-Error $_
  exit 1
}
