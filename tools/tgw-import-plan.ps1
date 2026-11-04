<#
.SYNOPSIS
  Technology Gear World - import PLAN. READ-ONLY.

.DESCRIPTION
  Reads the Joybuy UK feed (and any other approved TGW source) from the Awin archive on this PC and shows
  which products WOULD go on Technology Gear World, in which category, and why others are left out.
  It also writes the SQL that WOULD load them, but it does NOT run it and does NOT contact Cloudflare or D1.
  Needs Node.js (already used for the other Gear World tools).

  Output: <home>\gear-world-reports\TGW_IMPORT_PLAN_<time>\report.txt (also copied to the clipboard)
          <home>\gear-world-reports\TGW_IMPORT_PLAN_<time>\sql\*.sql (not executed)
#>
param(
    [string]$Archive = '',
    [string]$Only = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $Archive) {
    # Every Awin feed folder in Downloads (GW_AWIN_BULK_ARCHIVE, GW_AWIN_NEW_...), as on SGW: the TGW shops' feeds are in
    # more than one, and the newest copy of each feed is used (4 Nov 2026 refresh, L92).
    $dl = Join-Path $HOME 'Downloads'
    $found = @(Get-ChildItem -LiteralPath $dl -Directory -Filter 'GW_AWIN_*' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
    if ($found.Count -gt 0) { $Archive = $found -join ';' } else { $Archive = Join-Path $dl 'GW_AWIN_BULK_ARCHIVE' }
}
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }

Write-Host ''
Write-Host 'TGW import plan - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν φορτώνει τίποτα στη D1)' -ForegroundColor Cyan

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host 'Δεν βρέθηκε το Node.js σε αυτόν τον υπολογιστή. Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red
    exit 3
}
$version = [string](& node --version)
$major = 0
[void][int]::TryParse(($version -replace '^v', '').Split('.')[0], [ref]$major)
if ($major -lt 18) {
    Write-Host ('Το Node.js είναι παλιό ({0}). Χρειάζεται 18 ή νεότερο. Στείλε στο Claude αυτό το μήνυμα.' -f $version) -ForegroundColor Red
    exit 3
}
# Several archive folders can be given, separated by ; (the newest copy of each feed is used).
$missingArchive = @(($Archive -split ';') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not (Test-Path -LiteralPath $_) })
if ($missingArchive.Count -gt 0) {
    Write-Host ('Δεν βρήκα τον φάκελο του Awin archive: {0}' -f ($missingArchive -join ', ')) -ForegroundColor Red
    Write-Host 'Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red
    exit 2
}

$run = Join-Path $OutDir ('TGW_IMPORT_PLAN_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$mjs = Join-Path (Join-Path $repo 'tools') 'tgw-import-plan.mjs'
Write-Host ('Archive: {0}' -f $Archive)
Write-Host 'Διαβάζω το feed... (μπορεί να πάρει 1-2 λεπτά)'
if ($Only -and $Only -notmatch '^[0-9]+(,[0-9]+)*$') { Write-Host 'Λάθος -Only (μόνο αριθμοί Awin, χωρισμένοι με κόμμα).' -ForegroundColor Red; exit 2 }
if ($Only) { & node $mjs --archive $Archive --out $run --only $Only } else { & node $mjs --archive $Archive --out $run }
$code = $LASTEXITCODE
if ($code -ne 0) {
    Write-Host 'Το εργαλείο σταμάτησε με σφάλμα. Στείλε στο Claude ό,τι γράφει η οθόνη.' -ForegroundColor Red
    exit $code
}

$reportPath = Join-Path $run 'report.txt'
$report = [System.IO.File]::ReadAllText($reportPath, [System.Text.Encoding]::UTF8)
$copied = $false
if (-not $NoClipboard) {
    try { Set-Clipboard -Value $report; $copied = $true } catch { $copied = $false }
}
Write-Host ''
Write-Host ('OK - Η αναφορά γράφτηκε: {0}' -f $reportPath) -ForegroundColor Green
Write-Host 'Τίποτα δεν φορτώθηκε στη D1. Τα αρχεία SQL απλώς ετοιμάστηκαν για αργότερα.'
if ($copied) {
    Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green
}
exit 0
