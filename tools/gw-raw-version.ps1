<#
.SYNOPSIS
  Prepares a code version for gw-run.ps1 when codeload.github.com cannot be reached. Changes nothing on any site,
  database or account: it only writes files under %TEMP%.

.DESCRIPTION
  21 Nov 2026 (chat 3, 16:24): the owner's PC reached raw.githubusercontent.com but not codeload.github.com, where
  gw-run.ps1 downloads a version (zip) into %TEMP%\gear-world-code-<12>\gear-world-code-<40> and marks it with
  download-complete.txt. This tool builds that same folder another way, so gw-run finds it ready:
    1. The version is already there (marker), or codeload answers: it does nothing (gw-run downloads as always).
    2. Otherwise it takes a base version already in %TEMP% (-Base: one or more commits, separated by ",", that the
       version contains), asks api.github.com which files differ, downloads only those from raw.githubusercontent.com
       and checks each file's git blob SHA-1 against GitHub's. Any failure removes the half-made folder.
  Exit codes: 0 ready, 2 wrong arguments, 3 no usable base version in %TEMP%, 4 a download or a check failed.
  Usage: powershell -NoProfile -ExecutionPolicy Bypass -File gw-raw-version.ps1 -Ref <40-character commit> -Base <commit>
#>
param(
    [string]$Ref = '',
    [string]$Base = '',
    [string]$Owner = 'evangelos-gif',
    [string]$Repo = 'gear-world-code'
)

$ErrorActionPreference = 'Stop'
$bases = @(([string]$Base).Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$badBase = @($bases | Where-Object { $_ -notmatch '^[0-9a-f]{40}$' })
if ($Ref -notmatch '^[0-9a-f]{40}$' -or $bases.Count -eq 0 -or $badBase.Count -gt 0) {
    Write-Host 'Λείπει η έκδοση (-Ref) ή η βάση (-Base): commit 40 χαρακτήρων. Στείλε στο Claude την εντολή που έτρεξες.' -ForegroundColor Red
    exit 2
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
$UserAgent = 'GearWorldQA-bot/1.0 (+read-only check)'
$tmp = [System.IO.Path]::GetTempPath()
$cache = Join-Path $tmp ('gear-world-code-' + $Ref.Substring(0, 12))
$root = Join-Path $cache ($Repo + '-' + $Ref)
$marker = Join-Path $cache 'download-complete.txt'
$short = $Ref.Substring(0, 7)

if (Test-Path -LiteralPath $marker) {
    Write-Host ('Η έκδοση {0} είναι ήδη έτοιμη στον υπολογιστή: ΕΝΤΑΞΕΙ' -f $short) -ForegroundColor Green
    exit 0
}

# 1. Does codeload answer? Then gw-run downloads the version itself.
$codeload = $false
try {
    $req = [System.Net.HttpWebRequest]::Create(('https://codeload.github.com/{0}/{1}/zip/{2}' -f $Owner, $Repo, $Ref))
    $req.Method = 'HEAD'
    $req.UserAgent = $UserAgent
    $req.Timeout = 20000
    $resp = $req.GetResponse()
    $codeload = ([int]$resp.StatusCode -eq 200)
    $resp.Close()
} catch { $codeload = $false }
if ($codeload) {
    Write-Host 'Το codeload.github.com απαντά: η έκδοση κατεβαίνει κανονικά από το gw-run: ΕΝΤΑΞΕΙ' -ForegroundColor Green
    exit 0
}
Write-Host ('Το codeload.github.com δεν απαντά. Φτιάχνω την έκδοση {0} από μια παλιότερη στον υπολογιστή και το raw.githubusercontent.com...' -f $short) -ForegroundColor Cyan

# 2. A base version in %TEMP% that this version contains.
$baseRoot = ''
$baseRef = ''
$files = @()
foreach ($b in $bases) {
    $bc = Join-Path $tmp ('gear-world-code-' + $b.Substring(0, 12))
    $br = Join-Path $bc ($Repo + '-' + $b)
    if (-not (Test-Path -LiteralPath (Join-Path $bc 'download-complete.txt')) -or -not (Test-Path -LiteralPath $br)) { continue }
    try {
        $cmp = Invoke-RestMethod -Uri ('https://api.github.com/repos/{0}/{1}/compare/{2}...{3}' -f $Owner, $Repo, $b, $Ref) -UserAgent $UserAgent -TimeoutSec 30
    } catch {
        Write-Host ('  Το GitHub δεν απάντησε για τη βάση {0}: {1}' -f $b.Substring(0, 7), $_.Exception.Message) -ForegroundColor Yellow
        continue
    }
    if ([string]$cmp.status -ne 'ahead' -and [string]$cmp.status -ne 'identical') {
        Write-Host ('  Η βάση {0} δεν είναι μέσα στην έκδοση ({1}): την προσπερνώ.' -f $b.Substring(0, 7), $cmp.status) -ForegroundColor Yellow
        continue
    }
    $files = @($cmp.files)
    if ($files.Count -ge 300) {
        Write-Host ('  Η βάση {0} διαφέρει σε 300 ή περισσότερα αρχεία (όριο του GitHub): την προσπερνώ.' -f $b.Substring(0, 7)) -ForegroundColor Yellow
        continue
    }
    $baseRoot = $br
    $baseRef = $b
    break
}
if (-not $baseRoot) {
    Write-Host 'ΠΡΟΒΛΗΜΑ: καμία από τις βάσεις δεν υπάρχει έτοιμη στον υπολογιστή. Τίποτα δεν άλλαξε. Στείλε την οθόνη στο Claude.' -ForegroundColor Magenta
    exit 3
}
Write-Host ('  Βάση {0}, {1} αρχεία διαφέρουν.' -f $baseRef.Substring(0, 7), $files.Count)

# 3. Copy the base, then each changed file from raw, checked against GitHub's blob SHA-1.
try {
    if (Test-Path -LiteralPath $cache) { Remove-Item -LiteralPath $cache -Recurse -Force }
    New-Item -ItemType Directory -Path $cache -Force | Out-Null
    Copy-Item -LiteralPath $baseRoot -Destination $root -Recurse
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    foreach ($f in $files) {
        $rel = [string]$f.filename
        $dst = Join-Path $root ($rel -replace '/', '\')
        if ([string]$f.status -eq 'removed') {
            if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
            Write-Host ('  {0}: σβήστηκε' -f $rel)
            continue
        }
        if ([string]$f.status -eq 'renamed' -and $f.previous_filename) {
            $old = Join-Path $root (([string]$f.previous_filename) -replace '/', '\')
            if (Test-Path -LiteralPath $old) { Remove-Item -LiteralPath $old -Force }
        }
        $dir = Split-Path -Parent $dst
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        $path = (@($rel -split '/') | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join '/'
        $url = 'https://raw.githubusercontent.com/{0}/{1}/{2}/{3}' -f $Owner, $Repo, $Ref, $path
        Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $dst -UserAgent $UserAgent -TimeoutSec 60
        $bytes = [System.IO.File]::ReadAllBytes($dst)
        $head = [System.Text.Encoding]::ASCII.GetBytes(('blob {0}' -f $bytes.Length) + [string][char]0)
        $all = New-Object byte[] ($head.Length + $bytes.Length)
        [System.Array]::Copy($head, 0, $all, 0, $head.Length)
        [System.Array]::Copy($bytes, 0, $all, $head.Length, $bytes.Length)
        $got = -join ($sha1.ComputeHash($all) | ForEach-Object { $_.ToString('x2') })
        if ($got -ne [string]$f.sha) { throw ('το αρχείο {0} δεν ταιριάζει με αυτό του GitHub' -f $rel) }
        Write-Host ('  {0}: ΕΝΤΑΞΕΙ' -f $rel)
    }
    Set-Content -LiteralPath $marker -Value $Ref -Encoding ASCII
} catch {
    Write-Host ('ΠΡΟΒΛΗΜΑ: {0}. Η έκδοση δεν φτιάχτηκε· τίποτα δεν άλλαξε σε sites. Στείλε την οθόνη στο Claude.' -f $_.Exception.Message) -ForegroundColor Magenta
    if (Test-Path -LiteralPath $cache) { Remove-Item -LiteralPath $cache -Recurse -Force -ErrorAction SilentlyContinue }
    exit 4
}
Write-Host ('ΕΤΟΙΜΟ: η έκδοση {0} είναι στον υπολογιστή (βάση {1} + {2} αρχεία ελεγμένα με το GitHub).' -f $short, $baseRef.Substring(0, 7), $files.Count) -ForegroundColor Green
exit 0
