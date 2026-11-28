<#
.SYNOPSIS
  bol.com NL - import PLAN for its 10 sites (lessons L204). READ-ONLY.

.DESCRIPTION
  Reads the bol.com feed files on this PC (BOL_<category>_NL.csv.gz and BOL_0_NL-<search>.csv.gz, written by
  tools/bol-feed-download.ps1 in the Awin archive folder) and shows, site by site and category by category, which
  products WOULD go on the 10 sites that list bol.com, and why the others are left out (tools/bol-import-plan.mjs:
  the older sites with tools/import-rules/bol-nl.mjs, AGW VGW SGW ZGW with the bol.com entries of their sources.json).
  It writes the SQL that WOULD load them, but it does NOT run it and does NOT contact Cloudflare or D1.
  The import is a separate step (lessons L243): tools/legacy-import-batch.ps1 with the pairs bol-nl:<site> and
  -Sites agw:43646,vgw:15270,sgw:14648,zgw:12748, within 12 hours of the download, with ΕΓΚΡΙΝΩ ALL IMPORTS.

  Output: <home>\gear-world-reports\BOL_IMPORT_PLAN_<time>\summary.txt (also copied to the clipboard), with the full
          plan of every site next to it.
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
Write-Host 'bol.com import plan - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν φορτώνει τίποτα σε καμία βάση)' -ForegroundColor Cyan

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
    Write-Host ('Δεν βρήκα τον φάκελο των feeds: {0}' -f $Archive) -ForegroundColor Red
    Write-Host 'Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red
    exit 2
}
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$run = Join-Path $OutDir ('BOL_IMPORT_PLAN_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$mjs = Join-Path (Join-Path $repo 'tools') 'bol-import-plan.mjs'
Write-Host ('Φάκελος: {0}' -f $Archive)
Write-Host 'Διαβάζω τα αρχεία του bol.com... (1-3 λεπτά, άφησέ το να τελειώσει)'
& node $mjs --archive $Archive --out $run
$code = $LASTEXITCODE
if ($code -eq 4) {
    Write-Host 'Δεν βρέθηκε κανένα αρχείο BOL_<κατηγορία>_NL.csv.gz στον φάκελο. Πρώτα η λήψη (tools/bol-feed-download.ps1). Δεν άλλαξε τίποτα.' -ForegroundColor Red
    exit 4
}
if ($code -ne 0) {
    Write-Host 'Το εργαλείο σταμάτησε με σφάλμα. Στείλε στο Claude ό,τι γράφει η οθόνη.' -ForegroundColor Red
    exit $code
}

$summaryPath = Join-Path $run 'summary.txt'
$summary = [System.IO.File]::ReadAllText($summaryPath, [System.Text.Encoding]::UTF8)
$copied = $false
if (-not $NoClipboard) {
    try { Set-Clipboard -Value $summary; $copied = $true } catch { $copied = $false }
}
Write-Host ''
Write-Host $summary
Write-Host ('ΕΝΤΑΞΕΙ - Η αναφορά γράφτηκε: {0}' -f $summaryPath) -ForegroundColor Green
Write-Host 'Τίποτα δεν φορτώθηκε (μόνο σχέδιο). Η εισαγωγή είναι ξεχωριστό βήμα, με ΕΓΚΡΙΝΩ ALL IMPORTS (L243).'
if ($copied) {
    Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green
}
exit 0
