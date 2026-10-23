<#
.SYNOPSIS
  Awin feed sample for one or more retailers. READ-ONLY.
.DESCRIPTION
  Reads the Awin feed of one retailer (-Advertiser <Awin advertiser id>), or of several in one report
  (-Advertiser '69306,116097'), from the archive folder on this PC and shows the columns, every category path with
  its count and one product of it, the brands, currencies, stock values and sample products.
  Used to write the import rules for a new retailer. It changes nothing.
  Output: <home>\gear-world-reports\AWIN_FEED_SAMPLE_<id>[-<id>...]_<time>\report.txt (copied to the clipboard)
#>
param(
    [Parameter(Mandatory = $true)][string]$Advertiser,
    [string]$Archive = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
Write-Host ''
Write-Host ('Awin feed sample, advertiser {0} - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει τίποτα)' -f $Advertiser) -ForegroundColor Cyan
if ($Advertiser -notmatch '^\d{2,9}(,\d{2,9}){0,11}$') { Write-Host 'Λάθος αριθμός καταστήματος.' -ForegroundColor Red; exit 2 }
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
$run = Join-Path $OutDir ('AWIN_FEED_SAMPLE_' + $Advertiser.Replace(',', '-') + '_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
Write-Host ('Φάκελος: {0} ({1} αρχεία)' -f $Archive, (Count-Feeds $Archive))
Write-Host 'Διαβάζω τα feeds (1-5 λεπτά, τα μεγάλα καταστήματα αργούν)...'
& node (Join-Path (Join-Path $repo 'tools') 'awin-feed-sample.mjs') --archive $Archive --advertiser $Advertiser --out $run
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
