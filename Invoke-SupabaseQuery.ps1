# Invoke-SupabaseQuery.ps1
#
# A robust PowerShell script to execute SQL against a Supabase Postgres database without relying on
# piping into the Supabase CLI. It:
# - Reads .env.server for SUPABASE_DB_URL or DATABASE_URL
# - Parses the URL into host/port/db/user/password
# - Tries to run via local psql first (auto-installs via winget/choco/scoop if missing)
# - Falls back to Docker (Docker Desktop auto-install via winget if missing) and runs psql in a postgres container
# - Supports -Query and -File (File takes precedence)
# - Logs results to .\logs\query_yyyyMMdd_HHmmss.txt and prints to console

[CmdletBinding()] param(
  [Parameter(Position=0)]
  [string]$Query,

  [Parameter(Position=1)]
  [string]$File
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Ok($msg)   { Write-Host $msg -ForegroundColor Green }

function Get-EnvDbUrl {
  $envPath = Join-Path -Path (Get-Location) -ChildPath '.env.server'
  if (-not (Test-Path -Path $envPath)) {
    throw ".env.server not found at '$envPath'"
  }
  $dbUrl = $null
  $lines = Get-Content -Path $envPath
  foreach ($line in $lines) {
    $t = ($line -as [string]).Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    if ($t -match '^(?i)\s*(export\s+)?SUPABASE_DB_URL\s*=\s*(.+)$') {
      $dbUrl = $Matches[2]
      break
    }
    elseif (-not $dbUrl -and $t -match '^(?i)\s*(export\s+)?DATABASE_URL\s*=\s*(.+)$') {
      $dbUrl = $Matches[2]
    }
  }
  if (-not $dbUrl) {
    throw "No SUPABASE_DB_URL or DATABASE_URL found in .env.server"
  }
  $dbUrl = $dbUrl.Trim().Trim('"').Trim("'")
  if (-not $dbUrl) { throw "Database URL is empty after parsing .env.server" }
  return $dbUrl
}

function Parse-PostgresUrl([string]$url) {
  # Ensure scheme is postgres:// or postgresql://
  if ($url -notmatch '^(postgres(ql)?):\/\/') {
    throw "Unsupported connection URL scheme. Expected postgres:// or postgresql://"
  }
  $uri = [System.Uri]::new($url)
  $userInfo = $uri.UserInfo
  $user = $null
  $pass = $null
  if ($userInfo) {
    $parts = $userInfo.Split(':', 2)
    $user = [System.Net.WebUtility]::UrlDecode($parts[0])
    if ($parts.Count -gt 1) { $pass = [System.Net.WebUtility]::UrlDecode($parts[1]) }
  }
  $host = $uri.Host
  $port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
  $db = $uri.AbsolutePath.Trim('/')
  if (-not $db) { $db = 'postgres' }
  return [pscustomobject]@{ User=$user; Password=$pass; Host=$host; Port=$port; Database=$db }
}

function Find-PsqlPath {
  $cmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Path }
  # Probe typical install locations
  $candidates = @()
  $candidates += Get-ChildItem -Path 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName 'bin\psql.exe' }
  if ($env:ChocolateyInstall) {
    $candidates += Get-ChildItem -Path (Join-Path $env:ChocolateyInstall 'lib') -Filter 'postgresql*' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      Join-Path $_.FullName 'tools\**\psql.exe'
    }
  }
  if ($env:SCOOP) {
    $candidates += @(
      Join-Path $env:SCOOP 'apps\postgresql\current\bin\psql.exe'
    )
  }
  foreach ($p in $candidates) {
    $expanded = Resolve-Path $p -ErrorAction SilentlyContinue
    if ($expanded) { return $expanded.Path }
  }
  return $null
}

function Ensure-PostgresClient {
  $psql = Find-PsqlPath
  if ($psql) { return $psql }

  Write-Info 'psql not found. Attempting to install via winget/choco/scoop...'
  $installed = $false
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    try {
      Write-Info 'Trying: winget install PostgreSQL.PostgreSQL (silent)'
      winget install --id PostgreSQL.PostgreSQL -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
      $installed = $true
    } catch { Write-Warn "winget install failed: $_" }
  }
  if (-not $installed -and (Get-Command choco -ErrorAction SilentlyContinue)) {
    try {
      Write-Info 'Trying: choco install postgresql -y'
      choco install postgresql -y | Out-Null
      $installed = $true
    } catch { Write-Warn "choco install failed: $_" }
  }
  if (-not $installed -and (Get-Command scoop -ErrorAction SilentlyContinue)) {
    try {
      Write-Info 'Trying: scoop install postgresql'
      scoop bucket add main | Out-Null
      scoop install postgresql | Out-Null
      $installed = $true
    } catch { Write-Warn "scoop install failed: $_" }
  }

  $psql = Find-PsqlPath
  if ($psql) { return $psql }
  throw "psql not found after attempted installation. Please install PostgreSQL client tools and retry."
}

function Ensure-Docker {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
      try {
        Write-Info 'Docker not found. Installing Docker Desktop via winget...'
        winget install --id Docker.DockerDesktop -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
      } catch {
        throw "Failed to install Docker Desktop via winget: $_"
      }
    } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
      try {
        Write-Info 'Docker not found. Installing Docker Desktop via choco...'
        choco install docker-desktop -y | Out-Null
      } catch {
        throw "Failed to install Docker Desktop via choco: $_"
      }
    } else {
      throw "Docker CLI not found and no supported package manager (winget/choco) available to install it."
    }
  }

  # Start Docker Desktop if not running and wait for engine
  try {
    & docker info > $null 2>&1
  } catch {
    $dockerDesktop = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'
    if (Test-Path $dockerDesktop) {
      Write-Info 'Starting Docker Desktop...'
      Start-Process -FilePath $dockerDesktop | Out-Null
    } else {
      Write-Warn "Docker Desktop executable not found at $dockerDesktop. Ensure Docker is running."
    }
  }

  $deadline = (Get-Date).AddMinutes(3)
  while ((Get-Date) -lt $deadline) {
    try {
      $p = Start-Process -FilePath 'docker' -ArgumentList 'info' -NoNewWindow -Wait -PassThru -ErrorAction Stop
      if ($p.ExitCode -eq 0) { return }
    } catch {}
    Start-Sleep -Seconds 3
  }
  throw "Docker engine did not become ready within timeout."
}

function Get-QueryText {
  if ($File -and $File.Trim()) {
    if (-not (Test-Path -Path $File)) {
      throw "SQL file not found: $File"
    }
    return Get-Content -Path $File -Raw
  }
  if ($Query -and $Query.Trim()) { return $Query }
  return "select table_name from information_schema.tables where table_schema='public';"
}

function Run-WithPsql([string]$psqlPath, $conn, [string]$queryText, [string]$logPath) {
  $env:PGPASSWORD = $conn.Password
  try {
    $args = @('-h', $conn.Host, '-p', "$($conn.Port)", '-U', $conn.User, '-d', $conn.Database, '-v', 'ON_ERROR_STOP=1')
    if ($File -and $File.Trim()) {
      $args += @('-f', (Resolve-Path $File).Path)
      Write-Info "Executing via local psql with -f $File"
      $proc = Start-Process -FilePath $psqlPath -ArgumentList $args -NoNewWindow -Wait -PassThru -RedirectStandardOutput $logPath -RedirectStandardError $logPath
    } else {
      # Use temporary file to avoid quoting issues
      $tmp = New-Item -ItemType File -Path (Join-Path $env:TEMP ("query_" + [guid]::NewGuid().ToString() + '.sql')) -Force
      Set-Content -Path $tmp.FullName -Value $queryText -NoNewline
      $args += @('-f', $tmp.FullName)
      Write-Info "Executing via local psql with inline query"
      $proc = Start-Process -FilePath $psqlPath -ArgumentList $args -NoNewWindow -Wait -PassThru -RedirectStandardOutput $logPath -RedirectStandardError $logPath
      Remove-Item -Path $tmp.FullName -Force -ErrorAction SilentlyContinue
    }
    $exit = $proc.ExitCode
    Get-Content -Path $logPath | Out-Host
    if ($exit -ne 0) { throw "psql exited with code $exit" }
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue | Out-Null
  }
}

function Run-WithDocker($conn, [string]$queryText, [string]$logPath) {
  Ensure-Docker
  Write-Info 'Falling back to Docker: pulling postgres:16-alpine...'
  & docker pull postgres:16-alpine | Out-Null

  $tmpDir = Join-Path $env:TEMP ("supabase_query_" + (Get-Date -Format 'yyyyMMdd_HHmmss'))
  New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
  $sqlPath = Join-Path $tmpDir 'query.sql'
  Set-Content -Path $sqlPath -Value $queryText -NoNewline

  $mountArg = "$tmpDir:/sql"
  $passArg = "PGPASSWORD=$($conn.Password)"
  $args = @('run','--rm','-v', $mountArg,'-e', $passArg,'postgres:16-alpine','psql',
            '-h', $conn.Host,'-p', "$($conn.Port)",'-U', $conn.User,'-d', $conn.Database,'-v','ON_ERROR_STOP=1','-f','/sql/query.sql')
  Write-Info 'Executing via Dockerized psql...'

  $proc = Start-Process -FilePath 'docker' -ArgumentList $args -NoNewWindow -Wait -PassThru -RedirectStandardOutput $logPath -RedirectStandardError $logPath
  $exit = $proc.ExitCode
  Get-Content -Path $logPath | Out-Host
  if ($exit -ne 0) { throw "dockerized psql exited with code $exit" }
}

try {
  $logsDir = Join-Path (Get-Location) 'logs'
  New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  $logPath = Join-Path $logsDir ("query_$stamp.txt")

  $dbUrl = Get-EnvDbUrl
  $conn = Parse-PostgresUrl -url $dbUrl
  $queryText = Get-QueryText

  Write-Info "Host=$($conn.Host) Port=$($conn.Port) DB=$($conn.Database) User=$($conn.User)"

  $psqlPath = $null
  try {
    $psqlPath = Ensure-PostgresClient
  } catch {
    Write-Warn $_
  }

  if ($psqlPath) {
    try {
      Run-WithPsql -psqlPath $psqlPath -conn $conn -queryText $queryText -logPath $logPath
      Write-Ok "Success via local psql. Log: $logPath"
      return
    } catch {
      Write-Warn "Local psql failed: $_"
    }
  }

  # Fallback to Dockerized psql
  Run-WithDocker -conn $conn -queryText $queryText -logPath $logPath
  Write-Ok "Success via Dockerized psql. Log: $logPath"
}
catch {
  Write-Error $_
  exit 1
}
# HOW TO USE
# - Run from PowerShell in this folder.
# - Inline query example:
#     .\Invoke-SupabaseQuery.ps1 -Query "select current_user;"
# - From file example:
#     .\Invoke-SupabaseQuery.ps1 -File .\queries\my.sql
# - If no parameters are passed, the script lists public tables by default.
# - Logs are written to .\logs\query_yyyyMMdd_HHmmss.txt

# Invoke-SupabaseQuery.ps1
# A robust PowerShell script to execute SQL against a Supabase Postgres database without relying on
# piping into the Supabase CLI. It:
# - Reads .env.server for SUPABASE_DB_URL or DATABASE_URL
# - Parses the URL into host/port/db/user/password
# - Tries to run via local psql first (auto-installs via winget/choco/scoop if missing)
# - Falls back to Docker (Docker Desktop auto-install via winget/choco) and runs psql in a postgres container
# - Supports -Query and -File (File takes precedence)
# - Logs results to .\logs\query_yyyyMMdd_HHmmss.txt and prints to console

[CmdletBinding()]
param(
  [Parameter(Position=0)]
  [string]$Query,

  [Parameter(Position=1)]
  [string]$File
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Ok($msg)   { Write-Host $msg -ForegroundColor Green }

function Get-EnvDbUrl {
  $envPath = Join-Path -Path (Get-Location) -ChildPath '.env.server'
  if (-not (Test-Path -Path $envPath)) {
    throw ".env.server not found at '${envPath}'"
  }
  $dbUrl = $null
  $lines = Get-Content -Path $envPath
  foreach ($line in $lines) {
    $t = ($line -as [string]).Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    if ($t -match '^(?i)\s*(export\s+)?SUPABASE_DB_URL\s*=\s*(.+)$') {
      $dbUrl = $Matches[2]
      break
    }
    elseif (-not $dbUrl -and $t -match '^(?i)\s*(export\s+)?DATABASE_URL\s*=\s*(.+)$') {
      $dbUrl = $Matches[2]
    }
  }
  if (-not $dbUrl) {
    throw "No SUPABASE_DB_URL or DATABASE_URL found in .env.server"
  }
  $dbUrl = $dbUrl.Trim().Trim('"').Trim("'")
  if (-not $dbUrl) { throw "Database URL is empty after parsing .env.server" }
  return $dbUrl
}

function Parse-PostgresUrl([string]$url) {
  if ($url -notmatch '^(postgres(ql)?):\/\/') {
    throw "Unsupported connection URL scheme. Expected postgres:// or postgresql://"
  }
  $uri = [System.Uri]::new($url)
  $userInfo = $uri.UserInfo
  $user = $null
  $pass = $null
  if ($userInfo) {
    $parts = $userInfo.Split(':', 2)
    $user = [System.Net.WebUtility]::UrlDecode($parts[0])
    if ($parts.Count -gt 1) { $pass = [System.Net.WebUtility]::UrlDecode($parts[1]) }
  }
  $host = $uri.Host
  $port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
  $db = $uri.AbsolutePath.Trim('/')
  if (-not $db) { $db = 'postgres' }
  return [pscustomobject]@{ User=$user; Password=$pass; Host=$host; Port=$port; Database=$db }
}

function Find-PsqlPath {
  $cmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Path }
  $candidates = @()
  $candidates += Get-ChildItem -Path 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName 'bin\psql.exe' }
  if ($env:ChocolateyInstall) {
    $candidates += Get-ChildItem -Path (Join-Path $env:ChocolateyInstall 'lib') -Filter 'postgresql*' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      Join-Path $_.FullName 'tools\**\psql.exe'
    }
  }
  if ($env:SCOOP) {
    $candidates += @(
      Join-Path $env:SCOOP 'apps\postgresql\current\bin\psql.exe'
    )
  }
  foreach ($p in $candidates) {
    $expanded = Resolve-Path $p -ErrorAction SilentlyContinue
    if ($expanded) { return $expanded.Path }
  }
  return $null
}

function Ensure-PostgresClient {
  $psql = Find-PsqlPath
  if ($psql) { return $psql }

  Write-Info 'psql not found. Attempting to install via winget/choco/scoop...'
  $installed = $false
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    try {
      Write-Info 'Trying: winget install PostgreSQL.PostgreSQL (silent)'
      winget install --id PostgreSQL.PostgreSQL -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
      $installed = $true
    } catch { Write-Warn "winget install failed: $_" }
  }
  if (-not $installed -and (Get-Command choco -ErrorAction SilentlyContinue)) {
    try {
      Write-Info 'Trying: choco install postgresql -y'
      choco install postgresql -y | Out-Null
      $installed = $true
    } catch { Write-Warn "choco install failed: $_" }
  }
  if (-not $installed -and (Get-Command scoop -ErrorAction SilentlyContinue)) {
    try {
      Write-Info 'Trying: scoop install postgresql'
      scoop bucket add main | Out-Null
      scoop install postgresql | Out-Null
      $installed = $true
    } catch { Write-Warn "scoop install failed: $_" }
  }

  $psql = Find-PsqlPath
  if ($psql) { return $psql }
  throw "psql not found after attempted installation. Please install PostgreSQL client tools and retry."
}

function Ensure-Docker {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
      try {
        Write-Info 'Docker not found. Installing Docker Desktop via winget...'
        winget install --id Docker.DockerDesktop -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
      } catch {
        throw "Failed to install Docker Desktop via winget: $_"
      }
    } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
      try {
        Write-Info 'Docker not found. Installing Docker Desktop via choco...'
        choco install docker-desktop -y | Out-Null
      } catch {
        throw "Failed to install Docker Desktop via choco: $_"
      }
    } else {
      throw "Docker CLI not found and no supported package manager (winget/choco) available to install it."
    }
  }

  try {
    & docker info > $null 2>&1
  } catch {
    $dockerDesktop = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'
    if (Test-Path $dockerDesktop) {
      Write-Info 'Starting Docker Desktop...'
      Start-Process -FilePath $dockerDesktop | Out-Null
    } else {
      Write-Warn "Docker Desktop executable not found at ${dockerDesktop}. Ensure Docker is running."
    }
  }

  $deadline = (Get-Date).AddMinutes(3)
  while ((Get-Date) -lt $deadline) {
    try {
      $p = Start-Process -FilePath 'docker' -ArgumentList 'info' -NoNewWindow -Wait -PassThru -ErrorAction Stop
      if ($p.ExitCode -eq 0) { return }
    } catch {}
    Start-Sleep -Seconds 3
  }
  throw "Docker engine did not become ready within timeout."
}

function Get-QueryText {
  if ($File -and $File.Trim()) {
    if (-not (Test-Path -Path $File)) {
      throw "SQL file not found: ${File}"
    }
    return Get-Content -Path $File -Raw
  }
  if ($Query -and $Query.Trim()) { return $Query }
  return "select table_name from information_schema.tables where table_schema='public';"
}

function Run-WithPsql([string]$psqlPath, $conn, [string]$queryText, [string]$logPath) {
  $env:PGPASSWORD = $conn.Password
  try {
    $args = @('-h', $conn.Host, '-p', "${($conn.Port)}", '-U', $conn.User, '-d', $conn.Database, '-v', 'ON_ERROR_STOP=1')
    if ($File -and $File.Trim()) {
      $filePath = (Resolve-Path $File).Path
      $args += @('-f', $filePath)
      Write-Info "Executing via local psql with -f ${filePath}"
      & $psqlPath @args 2>&1 | Tee-Object -FilePath $logPath | Out-Host
    } else {
      $tmp = New-Item -ItemType File -Path (Join-Path $env:TEMP ("query_" + [guid]::NewGuid().ToString() + '.sql')) -Force
      Set-Content -Path $tmp.FullName -Value $queryText -NoNewline
      $args += @('-f', $tmp.FullName)
      Write-Info "Executing via local psql with inline query"
      & $psqlPath @args 2>&1 | Tee-Object -FilePath $logPath | Out-Host
      Remove-Item -Path $tmp.FullName -Force -ErrorAction SilentlyContinue
    }
    $exit = $LASTEXITCODE
    if ($exit -ne 0) { throw "psql exited with code ${exit}" }
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue | Out-Null
  }
}

function Run-WithDocker($conn, [string]$queryText, [string]$logPath) {
  Ensure-Docker
  Write-Info 'Falling back to Docker: pulling postgres:16-alpine...'
  & docker pull postgres:16-alpine | Out-Null

  $tmpDir = Join-Path $env:TEMP ("supabase_query_" + (Get-Date -Format 'yyyyMMdd_HHmmss'))
  New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
  $sqlPath = Join-Path $tmpDir 'query.sql'
  Set-Content -Path $sqlPath -Value $queryText -NoNewline

  $mountArg = "${tmpDir}:/sql"
  $passArg = "PGPASSWORD=$($conn.Password)"
  $args = @(
    'run','--rm',
    '-v', $mountArg,
    '-e', $passArg,
    'postgres:16-alpine','psql',
    '-h', $conn.Host,
    '-p', "${($conn.Port)}",
    '-U', $conn.User,
    '-d', $conn.Database,
    '-v','ON_ERROR_STOP=1',
    '-f','/sql/query.sql'
  )
  Write-Info 'Executing via Dockerized psql...'
  & docker @args 2>&1 | Tee-Object -FilePath $logPath | Out-Host
  $exit = $LASTEXITCODE
  if ($exit -ne 0) { throw "dockerized psql exited with code ${exit}" }
}

try {
  $logsDir = Join-Path (Get-Location) 'logs'
  New-Item -ItemType Directory -Path $logsDir -Force | Out-Host | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  $logPath = Join-Path $logsDir ("query_${stamp}.txt")

  $dbUrl = Get-EnvDbUrl
  $conn = Parse-PostgresUrl -url $dbUrl
  $queryText = Get-QueryText

  Write-Info "Host=${($conn.Host)} Port=${($conn.Port)} DB=${($conn.Database)} User=${($conn.User)}"

  $psqlPath = $null
  try {
    $psqlPath = Ensure-PostgresClient
  } catch {
    Write-Warn $_
  }

  if ($psqlPath) {
    try {
      Run-WithPsql -psqlPath $psqlPath -conn $conn -queryText $queryText -logPath $logPath
      Write-Ok "Success via local psql. Log: ${logPath}"
      exit 0
    } catch {
      Write-Warn "Local psql failed: $_"
    }
  }

  Run-WithDocker -conn $conn -queryText $queryText -logPath $logPath
  Write-Ok "Success via Dockerized psql. Log: ${logPath}"
  exit 0
}
catch {
  Write-Error $_
  exit 1
}

