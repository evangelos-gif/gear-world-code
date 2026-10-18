<#
.SYNOPSIS
  Gear World runner: downloads ONE fixed version (commit) of the gear-world-code repo and runs one tool from it.

.DESCRIPTION
  Used for tools that need more than one file (for example a PowerShell script plus Node.js code).
  The version is a full commit SHA, so the code that runs is exactly the code that passed the automatic checks.
  The download goes to %TEMP% and is reused next time. Nothing else on the PC is changed by this runner.
  Any extra arguments are passed to the tool.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File gw-run.ps1 -Ref <40-character commit> -Tool tgw-import-plan
#>
param(
    [string]$Ref = '',
    [string]$Tool = '',
    [string]$LocalRepo = ''
)

$ErrorActionPreference = 'Stop'
$Owner = 'evangelos-gif'
$Repo = 'gear-world-code'

if ($Tool -notmatch '^[a-z0-9][a-z0-9\-]{1,60}$') {
    Write-Host 'Λάθος όνομα εργαλείου. Στείλε στο Claude την εντολή που έτρεξες.' -ForegroundColor Red
    exit 2
}

if ($LocalRepo) {
    # Tests: run from a local copy instead of downloading.
    $root = (Resolve-Path -LiteralPath $LocalRepo).Path
} else {
    if ($Ref -notmatch '^[0-9a-f]{40}$') {
        Write-Host 'Λείπει η έκδοση (commit). Στείλε στο Claude την εντολή που έτρεξες.' -ForegroundColor Red
        exit 2
    }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $cache = Join-Path ([System.IO.Path]::GetTempPath()) ('gear-world-code-' + $Ref.Substring(0, 12))
    $root = Join-Path $cache ($Repo + '-' + $Ref)
    $marker = Join-Path $cache 'download-complete.txt'
    if (-not (Test-Path -LiteralPath $marker)) {
        Write-Host ('Κατεβάζω την έκδοση {0} του {1}...' -f $Ref.Substring(0, 7), $Repo)
        if (Test-Path -LiteralPath $cache) { Remove-Item -LiteralPath $cache -Recurse -Force }
        New-Item -ItemType Directory -Path $cache -Force | Out-Null
        $zip = Join-Path $cache 'code.zip'
        $url = 'https://codeload.github.com/{0}/{1}/zip/{2}' -f $Owner, $Repo, $Ref
        $oldProgress = $ProgressPreference
        $ProgressPreference = 'SilentlyContinue' # much faster downloads in Windows PowerShell 5.1
        try {
            Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip
            Expand-Archive -LiteralPath $zip -DestinationPath $cache -Force
        } finally {
            $ProgressPreference = $oldProgress
        }
        Remove-Item -LiteralPath $zip -Force
        Set-Content -LiteralPath $marker -Value $Ref -Encoding ASCII
    }
}

$toolPath = Join-Path (Join-Path $root 'tools') ($Tool + '.ps1')
if (-not (Test-Path -LiteralPath $toolPath)) {
    Write-Host ('Δεν βρέθηκε το εργαλείο {0} σε αυτή την έκδοση.' -f $Tool) -ForegroundColor Red
    exit 2
}

$exe = (Get-Process -Id $PID).Path
$toolArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $toolPath) + @($args)
& $exe @toolArgs
exit $LASTEXITCODE
