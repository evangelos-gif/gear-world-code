<#
.SYNOPSIS
  Gear World - FEED GAPS. READ-ONLY.

.DESCRIPTION
  Reads every Awin feed that is already in the Awin archive on this PC and counts how many products could fill
  the thin categories of the Gear World sites (Garden, Kids', Women's, Men's, Home, Technology), per retailer, with samples.
  It does NOT import anything, does NOT contact Cloudflare or D1 and does NOT change any file in the archive.
  Needs Node.js (already used for the other Gear World tools).

  Output: <home>\gear-world-reports\GW_FEED_GAPS_<time>.txt (also copied to the clipboard)
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
Write-Host 'Gear World feed gaps - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν φορτώνει και δεν αλλάζει τίποτα)' -ForegroundColor Cyan

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
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$reportPath = Join-Path $OutDir ('GW_FEED_GAPS_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.txt')
$mjs = Join-Path (Join-Path $repo 'tools') 'gw-feed-gaps.mjs'
Write-Host ('Archive: {0}' -f $Archive)
Write-Host 'Διαβάζω όλα τα feeds... (μπορεί να πάρει μερικά λεπτά, άφησέ το να τελειώσει)'
& node $mjs --archive $Archive --out $reportPath
$code = $LASTEXITCODE
if ($code -ne 0) {
    Write-Host 'Το εργαλείο σταμάτησε με σφάλμα. Στείλε στο Claude ό,τι γράφει η οθόνη.' -ForegroundColor Red
    exit $code
}

$report = [System.IO.File]::ReadAllText($reportPath, [System.Text.Encoding]::UTF8)
$copied = $false
if (-not $NoClipboard) {
    try { Set-Clipboard -Value $report; $copied = $true } catch { $copied = $false }
}
Write-Host ''
Write-Host ('OK - Η αναφορά γράφτηκε: {0}' -f $reportPath) -ForegroundColor Green
Write-Host 'Τίποτα δεν φορτώθηκε και κανένα αρχείο του archive δεν άλλαξε.'
if ($copied) {
    Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green
}
exit 0
