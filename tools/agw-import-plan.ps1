<#
.SYNOPSIS
  Car Gear World - import PLAN. READ-ONLY.

.DESCRIPTION
  Reads the feeds of the approved Car Gear World retailers (sites/agw/sources.json) from the Awin archive on this
  PC and shows which products WOULD go on Car Gear World, in which category, and why others are left out.
  It also writes the SQL that WOULD load them, but it does NOT run it and does NOT contact Cloudflare or D1.
  Needs Node.js (already used for the other Gear World tools).

  Output: <home>\gear-world-reports\AGW_IMPORT_PLAN_<time>\report.txt (also copied to the clipboard)
          <home>\gear-world-reports\AGW_IMPORT_PLAN_<time>\sql\*.sql (not executed)
#>
param(
    [string]$Archive = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }

Write-Host ''
Write-Host 'AGW import plan - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν φορτώνει τίποτα στη D1)' -ForegroundColor Cyan

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
if (-not (Test-Path -LiteralPath $Archive)) {
    Write-Host ('Δεν βρήκα τον φάκελο του Awin archive: {0}' -f $Archive) -ForegroundColor Red
    Write-Host 'Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red
    exit 2
}

$run = Join-Path $OutDir ('AGW_IMPORT_PLAN_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$mjs = Join-Path (Join-Path $repo 'tools') 'agw-import-plan.mjs'
Write-Host ('Archive: {0}' -f $Archive)
Write-Host 'Διαβάζω τα feeds... (τα μεγάλα feeds των εργαλείων παίρνουν μερικά λεπτά, άφησέ το να τελειώσει)'
& node $mjs --archive $Archive --out $run
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
