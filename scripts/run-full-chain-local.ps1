param(
  [switch]$StopOnExit,
  [string]$BackendUrl = "http://127.0.0.1:8080",
  [string]$ClientUrl = "http://127.0.0.1:4174",
  [string]$AdminUrl = "http://127.0.0.1:5174"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ServerRoot = Join-Path $RepoRoot "server"
$ClientRoot = Join-Path $RepoRoot "frontend\client-app"
$AdminRoot = Join-Path $RepoRoot "frontend\admin-web"
$ArtifactsRoot = Join-Path $RepoRoot "artifacts"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

New-Item -ItemType Directory -Force -Path $ArtifactsRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $ServerRoot "data") | Out-Null

$StartedProcesses = @()

function Test-HttpReady {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpReady -Url $Url) {
      return
    }
    Start-Sleep -Milliseconds 500
  }
  throw "Timeout waiting for $Url"
}

function Start-LoggedProcess {
  param(
    [string]$Name,
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory,
    [string]$StdoutPath,
    [string]$StderrPath
  )
  $process = Start-Process `
    -FilePath $FilePath `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $StdoutPath `
    -RedirectStandardError $StderrPath `
    -WindowStyle Hidden `
    -PassThru
  $script:StartedProcesses += $process
  Write-Host "$Name PID=$($process.Id)"
  Write-Host "$Name LOG=$StdoutPath"
  Write-Host "$Name ERR=$StderrPath"
  return $process
}

function Stop-ProcessTree {
  param([int]$ProcessId)
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId ([int]$child.ProcessId)
  }
  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($null -ne $process -and -not $process.HasExited) {
    Stop-Process -Id $ProcessId -Force
  }
}

function Get-ToolCommand {
  param(
    [string[]]$Candidates
  )
  foreach ($candidate in $Candidates) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($null -ne $command) {
      return $command.Source
    }
  }
  throw "Missing command. Tried: $($Candidates -join ', ')"
}

$GoCommand = Get-ToolCommand -Candidates @("go.exe", "go")
$NpmCommand = Get-ToolCommand -Candidates @("npm.cmd", "npm")
$PythonCommand = Get-ToolCommand -Candidates @("python.exe", "python", "py.exe", "py")

$ServerLog = Join-Path $ArtifactsRoot "full-chain-server-$Timestamp.log"
$ServerErr = Join-Path $ArtifactsRoot "full-chain-server-$Timestamp.err.log"
$ClientLog = Join-Path $ArtifactsRoot "full-chain-client-web-$Timestamp.log"
$ClientErr = Join-Path $ArtifactsRoot "full-chain-client-web-$Timestamp.err.log"
$AdminLog = Join-Path $ArtifactsRoot "full-chain-admin-web-$Timestamp.log"
$AdminErr = Join-Path $ArtifactsRoot "full-chain-admin-web-$Timestamp.err.log"
$SmokeLog = Join-Path $ArtifactsRoot "full-chain-smoke-$Timestamp.log"

try {
  $env:SFC_ENV = "local"
  $env:SFC_SERVER_ADDR = "127.0.0.1:8080"
  $env:SFC_WECHAT_MINIAPP_FAKE_LOGIN = "true"
  $env:SFC_AMAP_FAKE = "true"
  $env:SFC_SHARE_BASE_URL = "http://127.0.0.1:4174/share"
  $env:SFC_SQLITE_PATH = Join-Path $ServerRoot "data\full-chain-local.db"
  $env:VITE_API_ORIGIN = $BackendUrl

  if (Test-HttpReady -Url "$BackendUrl/healthz") {
    Write-Host "Backend already ready at $BackendUrl"
  } else {
    Start-LoggedProcess `
      -Name "Backend" `
      -FilePath $GoCommand `
      -ArgumentList @("run", "./cmd/api") `
      -WorkingDirectory $ServerRoot `
      -StdoutPath $ServerLog `
      -StderrPath $ServerErr | Out-Null
    Wait-HttpReady -Url "$BackendUrl/healthz" -TimeoutSeconds 90
  }

  if (Test-HttpReady -Url $ClientUrl) {
    Write-Host "Client Web already ready at $ClientUrl"
  } else {
    Start-LoggedProcess `
      -Name "ClientWeb" `
      -FilePath $NpmCommand `
      -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "4174") `
      -WorkingDirectory $ClientRoot `
      -StdoutPath $ClientLog `
      -StderrPath $ClientErr | Out-Null
    Wait-HttpReady -Url $ClientUrl -TimeoutSeconds 90
  }

  if (Test-HttpReady -Url $AdminUrl) {
    Write-Host "Admin Web already ready at $AdminUrl"
  } else {
    Start-LoggedProcess `
      -Name "AdminWeb" `
      -FilePath $NpmCommand `
      -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "5174") `
      -WorkingDirectory $AdminRoot `
      -StdoutPath $AdminLog `
      -StderrPath $AdminErr | Out-Null
    Wait-HttpReady -Url $AdminUrl -TimeoutSeconds 90
  }

  Write-Host "BACKEND_URL=$BackendUrl"
  Write-Host "CLIENT_WEB_URL=$ClientUrl"
  Write-Host "ADMIN_WEB_URL=$AdminUrl"
  Write-Host "SQLITE_PATH=$env:SFC_SQLITE_PATH"

  & $PythonCommand (Join-Path $RepoRoot "scripts\full_chain_smoke.py") --base-url $BackendUrl --artifacts-dir $ArtifactsRoot *>&1 | Tee-Object -FilePath $SmokeLog
  $SmokeExitCode = $LASTEXITCODE
  Write-Host "SMOKE_LOG=$SmokeLog"
  if ($SmokeExitCode -ne 0) {
    throw "Full-chain smoke failed with exit code $SmokeExitCode"
  }

  Write-Host "Full-chain local integration is ready."
  Write-Host "Processes are kept running by default for browser/manual checks."
  if ($StopOnExit) {
    Write-Host "StopOnExit is enabled; stopping processes started by this script."
  }
} finally {
  if ($StopOnExit) {
    foreach ($process in $StartedProcesses) {
      if ($null -ne $process) {
        Stop-ProcessTree -ProcessId $process.Id
      }
    }
  }
}
