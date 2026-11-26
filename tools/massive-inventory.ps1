<#
.SYNOPSIS
  Gear World - MASSIVE INVENTORY. READ-ONLY.
.DESCRIPTION
  For the massive import of 22 Nov 2026 (every approved shop that no site has yet; UK, then Greece and Cyprus, then the
  world): reads the candidates list of the repo (tools\massive\candidates-1122.json, or -List), the feed folder on this
  PC and the feed download reports of the last -Hours hours (default 12), and writes ONE short line per feed: products,
  stock, currency, language, the shop's web address, top categories, two sample names and the age of the file (lessons
  L207: the feed first, then the rules). Shops without a number in the sheet are looked up by name in the Awin list
  (awin-feed-download -AllJoined) and the CJ list (cj-feed-download -Joined) of those reports. Problems and warnings of
  the downloads are listed at the top. It changes nothing: no file in the feed folder, no site, no database.
  Output: <home>\gear-world-reports\MASSIVE_INVENTORY_<time>\report.txt (also copied to the clipboard)
#>
param(
    [string]$List = '',
    [int]$Hours = 12,
    [string]$Archive = '',
    [string]$Reports = '',
    [int]$MaxRows = 20000,
    [string]$OutDir = '',
    [switch]$NoClipboard
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $Reports) { $Reports = Join-Path $HOME 'gear-world-reports' }
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
if (-not $List) { $List = Join-Path (Join-Path (Join-Path $repo 'tools') 'massive') 'candidates-1122.json' }
# A bare file name is a list of this version's tools\massive folder (lessons L231: -List candidates-1125.json).
if (-not [System.IO.Path]::IsPathRooted($List) -and $List -notmatch '[\\/]') { $List = Join-Path (Join-Path (Join-Path $repo 'tools') 'massive') $List }
Write-Host ''
Write-Host 'Massive inventory - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν φορτώνει, δεν κατεβάζει και δεν αλλάζει τίποτα)' -ForegroundColor Cyan
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red; exit 3 }
if (-not (Test-Path -LiteralPath $Archive)) { Write-Host ('Δεν βρήκα τον φάκελο των feeds: {0}' -f $Archive) -ForegroundColor Red; exit 2 }
if (-not (Test-Path -LiteralPath $List)) { Write-Host ('Δεν βρήκα τη λίστα των καταστημάτων: {0}' -f $List) -ForegroundColor Red; exit 2 }
if ($Hours -lt 1 -or $Hours -gt 240) { Write-Host 'Λάθος -Hours (1 έως 240).' -ForegroundColor Red; exit 2 }
if ($MaxRows -lt 100) { Write-Host 'Λάθος -MaxRows (τουλάχιστον 100).' -ForegroundColor Red; exit 2 }
$run = Join-Path $OutDir ('MASSIVE_INVENTORY_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Path $run -Force | Out-Null
Write-Host ('Φάκελος feeds: {0}' -f $Archive)
Write-Host ('Διαβάζω τα feeds της λίστας, έως {0} προϊόντα από το καθένα... (μπορεί να πάρει 10-30 λεπτά, άφησέ το να τελειώσει)' -f $MaxRows)
$nodeArgs = @((Join-Path (Join-Path $repo 'tools') 'massive-inventory.mjs'), '--archive', $Archive, '--list', $List, '--reports', $Reports, '--hours', [string]$Hours, '--max-rows', [string]$MaxRows, '--out', $run)
& node @nodeArgs
$code = $LASTEXITCODE
if ($code -ne 0) { Write-Host 'Το εργαλείο σταμάτησε με σφάλμα. Στείλε στο Claude ό,τι γράφει η οθόνη.' -ForegroundColor Red; exit $code }
$reportPath = Join-Path $run 'report.txt'
$report = [System.IO.File]::ReadAllText($reportPath, [System.Text.Encoding]::UTF8)
$copied = $false
if (-not $NoClipboard) { try { Set-Clipboard -Value $report; $copied = $true } catch { $copied = $false } }
Write-Host ''
Write-Host ('OK - Η αναφορά γράφτηκε: {0}' -f $reportPath) -ForegroundColor Green
Write-Host 'Δεν άλλαξε τίποτα: ούτε τα αρχεία, ούτε τα sites, ούτε οι βάσεις.'
if ($copied) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
exit 0
