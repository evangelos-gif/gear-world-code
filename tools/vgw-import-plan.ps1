<#
.SYNOPSIS
  Travel Gear World - import PLAN. READ-ONLY.

.DESCRIPTION
  Reads the feeds of the approved Travel Gear World retailers (sites/vgw/sources.json) from the Awin archive on this
  PC and shows which products WOULD go on Travel Gear World, in which category, and why others are left out.
  It also writes the SQL that WOULD load them, but it does NOT run it and does NOT contact Cloudflare or D1.
  Needs Node.js (already used for the other Gear World tools).

  -Only 123932: plan only these retailers (Awin advertiser ids, comma separated), e.g. a new retailer on its own.

  Output: <home>\gear-world-reports\VGW_IMPORT_PLAN_<time>\report.txt (also copied to the clipboard)
          <home>\gear-world-reports\VGW_IMPORT_PLAN_<time>\sql\*.sql (not executed)
#>
param(
    [string]$Archive = '',
    [string]$Only = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }

Write-Host ''
Write-Host 'VGW import plan - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν φορτώνει τίποτα στη D1)' -ForegroundColor Cyan

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

$run = Join-Path $OutDir ('VGW_IMPORT_PLAN_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$mjs = Join-Path (Join-Path $repo 'tools') 'vgw-import-plan.mjs'
Write-Host ('Archive: {0}' -f $Archive)
Write-Host 'Διαβάζω τα feeds... (τα μεγάλα feeds παίρνουν μερικά λεπτά, άφησέ το να τελειώσει)'
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
