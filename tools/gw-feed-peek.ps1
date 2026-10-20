<#
.SYNOPSIS
  Gear World - feed PEEK. READ-ONLY.

.DESCRIPTION
  Reads the Awin feeds of the advertisers you name (by Awin advertiser id) from the Awin archive on this PC
  and shows what each feed holds: number of products, prices, stock, top categories, brands and samples.
  It does NOT change the archive, does NOT write SQL and does NOT contact Cloudflare, D1 or Awin.
  Needs Node.js (already used for the other Gear World tools).

  Output: <home>\gear-world-reports\GW_FEED_PEEK_<time>\report.txt (also copied to the clipboard)

.EXAMPLE
  gw-feed-peek.ps1 -Ids 83599,91665,48473
#>
param(
    [string]$Ids = '83599,91665,48473',
    [string]$Archive = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }

Write-Host ''
Write-Host 'Gear World feed peek - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει και δεν φορτώνει τίποτα)' -ForegroundColor Cyan

$idList = @($Ids -split '[\s,;]+' | Where-Object { $_ -ne '' })
$bad = @($idList | Where-Object { $_ -notmatch '^\d{1,9}$' })
if ($idList.Count -eq 0 -or $bad.Count -gt 0) {
    Write-Host 'Λάθος advertiser ids. Στείλε στο Claude την εντολή που έτρεξες.' -ForegroundColor Red
    exit 2
}

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

$run = Join-Path $OutDir ('GW_FEED_PEEK_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$mjs = Join-Path (Join-Path $repo 'tools') 'gw-feed-peek.mjs'
Write-Host ('Archive: {0}' -f $Archive)
Write-Host ('Advertisers: {0}' -f ($idList -join ', '))
Write-Host 'Διαβάζω τα feeds... (μπορεί να πάρει λίγο)'
& node $mjs --archive $Archive --ids ($idList -join ',') --out $run
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
Write-Host 'Τίποτα δεν άλλαξε και τίποτα δεν φορτώθηκε.'
if ($copied) {
    Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green
}
exit 0
