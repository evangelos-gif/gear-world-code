<#
.SYNOPSIS
  Gear World runner: downloads ONE fixed version (commit) of the gear-world-code repo and runs one tool from it.

.DESCRIPTION
  Used for tools that need more than one file (for example a PowerShell script plus Node.js code).
  The version is a full commit SHA, so the code that runs is exactly the code that passed the automatic checks.
  The download goes to %TEMP% and is reused next time. Nothing else on the PC is changed by this runner.
  Any extra arguments are passed to the tool.
  -Chat '<chat name>': after the tool, one line says which Claude chat the report on the clipboard goes to
  (owner, 11 Nov 2026: every command ends with that line; chat 9 on 16 Nov 2026). Without -Chat nothing changes.
  When codeload.github.com cannot be reached (the owner's PC, 21 Nov 2026: its IPv4-only address does not answer there,
  lessons L212), the version is built from the newest complete older copy in %TEMP% plus the files that changed: GitHub's
  compare API lists them, each one is read from raw.githubusercontent.com and checked against its git blob SHA-1. So the
  command stays 3 lines. Tests only: GW_RUN_TEST_TEMP, GW_RUN_TEST_CODELOAD=fail, GW_RUN_TEST_API, GW_RUN_TEST_RAW.

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

# Folder of the downloaded versions: <home>\gear-world-tools (tests: their own folder). On 23 Nov 2026 Norton removed
# gw-run.ps1 from %TEMP% ("IDP.WebShield.PSHelper36"); the owner excluded only C:\Users\vagge\gear-world-tools from its
# scans, so the versions and the tools run from there (lessons L220). Older versions in %TEMP% still serve as the base
# when codeload.github.com cannot be reached (L212).
$TempRoot = Join-Path $HOME 'gear-world-tools'
$OldRoots = @([System.IO.Path]::GetTempPath())
if ($env:GW_RUN_TEST_TEMP) { $TempRoot = [string]$env:GW_RUN_TEST_TEMP; $OldRoots = @() }
if (-not (Test-Path -LiteralPath $TempRoot)) { New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null }

# The bytes of one web address (tests: of one file under a local folder instead).
function Read-Url([string]$Url, [string]$TestBase, [string]$TestName) {
    if ($TestBase) {
        $local = Join-Path $TestBase ($TestName -replace '/', [string][System.IO.Path]::DirectorySeparatorChar)
        return ,([System.IO.File]::ReadAllBytes($local))
    }
    $t = [System.IO.Path]::GetTempFileName()
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $t
        return ,([System.IO.File]::ReadAllBytes($t))
    } finally {
        Remove-Item -LiteralPath $t -Force -ErrorAction SilentlyContinue
    }
}

# Git's blob SHA-1 of some bytes: the same as the "sha" GitHub gives for that file.
function Get-BlobSha([byte[]]$Bytes) {
    $head = [System.Text.Encoding]::ASCII.GetBytes('blob ' + $Bytes.Length + [char]0)
    $all = New-Object byte[] ($head.Length + $Bytes.Length)
    [Array]::Copy($head, $all, $head.Length)
    [Array]::Copy($Bytes, 0, $all, $head.Length, $Bytes.Length)
    $sha = [System.Security.Cryptography.SHA1]::Create()
    return (-join ($sha.ComputeHash($all) | ForEach-Object { $_.ToString('x2') }))
}

# Without codeload (L212): copy the newest complete older version found in the temporary folder, then apply the files
# GitHub's compare API lists between the two (each from raw.githubusercontent.com, checked by its blob SHA-1).
# Returns $true when the folder $Root holds the version $Ref.
function Build-FromOlder([string]$Ref, [string]$Cache, [string]$Root) {
    $cands = @(@($TempRoot) + $OldRoots | ForEach-Object { Get-ChildItem -LiteralPath $_ -Directory -Filter ($Repo + '-*') -ErrorAction SilentlyContinue } |
        Where-Object { $_.FullName -ne $Cache -and (Test-Path -LiteralPath (Join-Path $_.FullName 'download-complete.txt')) } |
        Sort-Object LastWriteTime -Descending)
    foreach ($c in $cands) {
        $baseRef = ([string](Get-Content -LiteralPath (Join-Path $c.FullName 'download-complete.txt') -TotalCount 1)).Trim()
        if ($baseRef -notmatch '^[0-9a-f]{40}$') { continue }
        $baseRoot = Join-Path $c.FullName ($Repo + '-' + $baseRef)
        if (-not (Test-Path -LiteralPath $baseRoot)) { continue }
        $pair = $baseRef + '...' + $Ref
        try {
            $bytes = Read-Url ('https://api.github.com/repos/{0}/{1}/compare/{2}' -f $Owner, $Repo, $pair) $env:GW_RUN_TEST_API ($pair + '.json')
            $cmp = [System.Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
        } catch {
            continue
        }
        # Only from an older version of the same line ("ahead"); the compare API lists at most 300 files.
        if (@('ahead', 'identical') -notcontains [string]$cmp.status) { continue }
        $files = @()
        if ($cmp.files) { $files = @($cmp.files) }
        if ($files.Count -ge 300) { continue }
        Write-Host ('Το codeload.github.com δεν απαντά: φτιάχνω την έκδοση {0} από την {1} και {2} αρχεία που άλλαξαν, με έλεγχο SHA-1 ένα-ένα...' -f $Ref.Substring(0, 7), $baseRef.Substring(0, 7), $files.Count)
        if (Test-Path -LiteralPath $Cache) { Remove-Item -LiteralPath $Cache -Recurse -Force }
        New-Item -ItemType Directory -Path $Cache -Force | Out-Null
        Copy-Item -LiteralPath $baseRoot -Destination $Root -Recurse
        $ok = $true
        foreach ($f in $files) {
            $path = [string]$f.filename
            $sep = [string][System.IO.Path]::DirectorySeparatorChar
            $local = Join-Path $Root ($path -replace '/', $sep)
            $state = [string]$f.status
            if ($state -eq 'renamed' -and $f.previous_filename) {
                $prev = Join-Path $Root (([string]$f.previous_filename) -replace '/', $sep)
                if (Test-Path -LiteralPath $prev) { Remove-Item -LiteralPath $prev -Force }
            }
            if ($state -eq 'removed') {
                if (Test-Path -LiteralPath $local) { Remove-Item -LiteralPath $local -Force }
                continue
            }
            $enc = (@($path -split '/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
            try {
                $b = Read-Url ('https://raw.githubusercontent.com/{0}/{1}/{2}/{3}' -f $Owner, $Repo, $Ref, $enc) $env:GW_RUN_TEST_RAW $path
            } catch {
                Write-Host ('Δεν κατέβηκε το αρχείο {0}.' -f $path) -ForegroundColor Yellow
                $ok = $false
                break
            }
            if ((Get-BlobSha $b) -ne [string]$f.sha) {
                Write-Host ('Το αρχείο {0} δεν ταιριάζει με το GitHub (SHA-1): δεν το χρησιμοποιώ.' -f $path) -ForegroundColor Yellow
                $ok = $false
                break
            }
            $dir = Split-Path -Parent $local
            if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
            [System.IO.File]::WriteAllBytes($local, $b)
        }
        if ($ok) { return $true }
        Remove-Item -LiteralPath $Cache -Recurse -Force -ErrorAction SilentlyContinue
    }
    return $false
}

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
    $cache = Join-Path $TempRoot ('gear-world-code-' + $Ref.Substring(0, 12))
    $root = Join-Path $cache ($Repo + '-' + $Ref)
    $marker = Join-Path $cache 'download-complete.txt'
    if (-not (Test-Path -LiteralPath $marker)) {
        Write-Host ('Κατεβάζω την έκδοση {0} του {1}...' -f $Ref.Substring(0, 7), $Repo)
        $oldProgress = $ProgressPreference
        $ProgressPreference = 'SilentlyContinue' # much faster downloads in Windows PowerShell 5.1
        $built = $false
        try {
            if (Test-Path -LiteralPath $cache) { Remove-Item -LiteralPath $cache -Recurse -Force }
            New-Item -ItemType Directory -Path $cache -Force | Out-Null
            $zip = Join-Path $cache 'code.zip'
            $url = 'https://codeload.github.com/{0}/{1}/zip/{2}' -f $Owner, $Repo, $Ref
            if ($env:GW_RUN_TEST_CODELOAD -eq 'fail') { throw 'test: codeload.github.com does not answer' }
            Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip
            Expand-Archive -LiteralPath $zip -DestinationPath $cache -Force
            Remove-Item -LiteralPath $zip -Force
            $built = $true
        } catch {
            Write-Host ('Η λήψη από το codeload.github.com δεν έγινε ({0}).' -f $_.Exception.Message) -ForegroundColor Yellow
        }
        if (-not $built) { $built = Build-FromOlder $Ref $cache $root }
        $ProgressPreference = $oldProgress
        if (-not $built) {
            Write-Host 'Δεν μπόρεσα να φτιάξω αυτή την έκδοση (ούτε από το codeload ούτε από παλιότερη έκδοση στο PC). Στείλε στο Claude ό,τι γράφει η οθόνη.' -ForegroundColor Red
            exit 3
        }
        Set-Content -LiteralPath $marker -Value $Ref -Encoding ASCII
    }
}

$toolPath = Join-Path (Join-Path $root 'tools') ($Tool + '.ps1')
if (-not (Test-Path -LiteralPath $toolPath)) {
    Write-Host ('Δεν βρέθηκε το εργαλείο {0} σε αυτή την έκδοση.' -f $Tool) -ForegroundColor Red
    exit 2
}

# -Chat '<name>' is read here and not passed to the tool (it is not a declared parameter, so every other argument
# reaches the tool exactly as before).
$Chat = ''
$rest = New-Object System.Collections.Generic.List[object]
$all = @($args)
for ($i = 0; $i -lt $all.Count; $i++) {
    if (([string]$all[$i]) -ieq '-Chat' -and ($i + 1) -lt $all.Count) { $Chat = [string]$all[$i + 1]; $i++; continue }
    $rest.Add($all[$i])
}
$exe = (Get-Process -Id $PID).Path
$toolArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $toolPath) + @($rest.ToArray())
& $exe @toolArgs
$code = $LASTEXITCODE
if ($Chat) {
    $chatName = ($Chat -replace '[\r\n]', ' ').Trim()
    if ($code -eq 0) {
        Write-Host ('Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «{0}» και πάτα Ctrl+V.' -f $chatName) -ForegroundColor Green
    } else {
        Write-Host ('Το εργαλείο σταμάτησε (κωδικός {0}). Πήγαινε στη συζήτηση με το Claude «{1}» και στείλε ό,τι γράφει η οθόνη (ή Ctrl+V).' -f $code, $chatName) -ForegroundColor Yellow
    }
}
exit $code
