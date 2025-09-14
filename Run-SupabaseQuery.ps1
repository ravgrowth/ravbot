# Runs a SQL query against the Supabase remote DB using the Supabase CLI.
# - Reads .env.server in the current directory to find SUPABASE_DB_URL or DATABASE_URL
# - Accepts -Query or -File (SQL file). If both are provided, -File takes precedence.
# - Defaults to listing public tables if no input is provided.
# - Prints to console and writes results to query_result.txt.

[CmdletBinding()] param(
  [Parameter(Position=0)]
  [string]$Query,

  [Parameter(Position=1)]
  [string]$File
)

function Get-DbUrlFromEnvFile {
  param(
    [string]$EnvPath
  )
  if (-not (Test-Path -Path $EnvPath)) {
    throw ".env.server not found at '$EnvPath'"
  }

  $dbUrl = $null
  $lines = Get-Content -Path $EnvPath -ErrorAction Stop
  foreach ($line in $lines) {
    $t = ($line -as [string]).Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    # Handle optional 'export ' prefix and spaces around '='
    if ($t -match '^(?i)\s*(export\s+)?SUPABASE_DB_URL\s*=\s*(.+)$') {
      $dbUrl = $Matches[2]
      break
    }
    elseif (-not $dbUrl -and $t -match '^(?i)\s*(export\s+)?DATABASE_URL\s*=\s*(.+)$') {
      $dbUrl = $Matches[2]
      # keep searching in case SUPABASE_DB_URL appears later
    }
  }

  if (-not $dbUrl) {
    throw "No SUPABASE_DB_URL or DATABASE_URL found in .env.server"
  }

  $dbUrl = $dbUrl.Trim().Trim('"').Trim("'")
  if (-not $dbUrl) {
    throw "Database URL is empty after parsing .env.server"
  }
  return $dbUrl
}

try {
  # Ensure Supabase CLI exists
  if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    throw "Supabase CLI ('supabase') is not installed or not on PATH."
  }

  $envPath = Join-Path -Path (Get-Location) -ChildPath '.env.server'
  $dbUrl = Get-DbUrlFromEnvFile -EnvPath $envPath

  # Determine query text with precedence: -File > -Query > default
  $queryText = $null
  if ($File -and $File.Trim()) {
    if (-not (Test-Path -Path $File)) {
      throw "SQL file not found: $File"
    }
    $queryText = Get-Content -Path $File -Raw
  } elseif ($Query -and $Query.Trim()) {
    $queryText = $Query
  } else {
    $queryText = "select table_name from information_schema.tables where table_schema='public';"
  }

  if (-not $queryText -or [string]::IsNullOrWhiteSpace($queryText)) {
    throw "Query text is empty. Provide -Query or -File with SQL content."
  }

  Write-Host "Running query against Supabase remote..." -ForegroundColor Cyan
  Write-Host "DB URL: $dbUrl" -ForegroundColor DarkGray

  # Execute: echo $query | supabase db remote exec --db-url "$dbUrl" --
  # Capture output to console and file.
  $resultPath = Join-Path -Path (Get-Location) -ChildPath 'query_result.txt'

  # Pipe the query text into the Supabase CLI and tee the output
  $queryText | & supabase db remote exec --db-url "$dbUrl" -- 2>&1 | Tee-Object -FilePath $resultPath | Out-Host

  $exit = $LASTEXITCODE
  if ($exit -ne 0) {
    throw "supabase db remote exec exited with code $exit. See query_result.txt for details."
  }

  Write-Host "Results saved to $resultPath" -ForegroundColor Green
}
catch {
  Write-Error $_
  exit 1
}

