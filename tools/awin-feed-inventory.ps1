<#
.SYNOPSIS
  Awin feed inventory. READ-ONLY.
.DESCRIPTION
  Reads every Awin feed file (AWIN_<advertiser>_<feed>.csv.gz) in the archive folder on this PC and reports, per
  retailer: products, in-stock share, EAN share, how old the file is, main categories, which Gear World site it
  seems to fit, and whether a site already uses it. It changes nothing: no file, no site, no database.
  If the archive is not in Downloads\GW_AWIN_BULK_ARCHIVE, it looks for a folder with AWIN_*.csv.gz files in
  Downloads, Desktop and Documents and uses the one with the most files.
  Output: <home>\gear-world-reports\AWIN_FEED_INVENTORY_<time>\report.txt (copied to the clipboard) and retailers.csv
#>
param(
    [string]$Archive = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
Write-Host ''
Write-Host 'Awin feed inventory - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει τίποτα)' -ForegroundColor Cyan
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red; exit 3 }

function Count-Feeds([string]$dir) {
    try { return @(Get-ChildItem -LiteralPath $dir -File -Filter 'AWIN_*.csv*' -ErrorAction Stop).Count } catch { return 0 }
}
if (-not $Archive) {
    $default = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE'
    if ((Count-Feeds $default) -gt 0) { $Archive = $default }
    else {
        Write-Host 'Ψάχνω τον φάκελο με τα feeds του Awin...'
        $best = ''; $bestN = 0
        foreach ($root in @('Downloads', 'Desktop', 'Documents')) {
            $r = Join-Path $HOME $root
            if (-not (Test-Path -LiteralPath $r)) { continue }
            $dirs = @(Get-Item -LiteralPath $r) + @(Get-ChildItem -LiteralPath $r -Directory -ErrorAction SilentlyContinue) + @(Get-ChildItem -LiteralPath $r -Directory -ErrorAction SilentlyContinue | ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Directory -ErrorAction SilentlyContinue })
            foreach ($d in $dirs) {
                $n = Count-Feeds $d.FullName
                if ($n -gt 0) { Write-Host ('  {0}: {1} αρχεία' -f $d.FullName, $n) }
                if ($n -gt $bestN) { $best = $d.FullName; $bestN = $n }
            }
        }
        if (-not $best) { Write-Host 'Δεν βρήκα φάκελο με αρχεία AWIN_*.csv.gz. Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red; exit 2 }
        $Archive = $best
    }
}
if (-not (Test-Path -LiteralPath $Archive)) { Write-Host ('Δεν βρήκα τον φάκελο: {0}' -f $Archive) -ForegroundColor Red; exit 2 }
$run = Join-Path $OutDir ('AWIN_FEED_INVENTORY_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
Write-Host ('Φάκελος: {0} ({1} αρχεία)' -f $Archive, (Count-Feeds $Archive))
Write-Host 'Διαβάζω όλα τα feeds. Με 1.500.000 προϊόντα μπορεί να πάρει 10-20 λεπτά. Μην κλείσεις το παράθυρο.'
& node (Join-Path (Join-Path $repo 'tools') 'awin-feed-inventory.mjs') --archive $Archive --out $run
if ($LASTEXITCODE -ne 0) { Write-Host 'Το εργαλείο σταμάτησε με σφάλμα. Στείλε στο Claude ό,τι γράφει η οθόνη.' -ForegroundColor Red; exit $LASTEXITCODE }
$reportPath = Join-Path $run 'report.txt'
$report = [System.IO.File]::ReadAllText($reportPath, [System.Text.Encoding]::UTF8)
$copied = $false
if (-not $NoClipboard) { try { Set-Clipboard -Value $report; $copied = $true } catch { $copied = $false } }
Write-Host ''
Write-Host ('OK - Η αναφορά γράφτηκε: {0}' -f $reportPath) -ForegroundColor Green
Write-Host 'Δεν άλλαξε τίποτα: ούτε τα αρχεία, ούτε τα sites, ούτε οι βάσεις.'
if ($copied) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
exit 0
