<#
.SYNOPSIS
  Import PLAN for a new retailer on the older Gear World sites (MGW, WGW). READ-ONLY.

.DESCRIPTION
  Reads the Awin feed of one retailer (-Retailer coes) from the archive folder on this PC, joins the sizes of each
  product, decides product by product which site and category it would go to (or why it is left out) and writes
  the SQL an import WOULD run. Nothing is sent to any database. It changes nothing.
  Output: <home>\gear-world-reports\IMPORT_PLAN_<retailer>_<time>\report.txt (copied to the clipboard) and sql\<site>\*.sql
#>
param(
    [Parameter(Mandatory = $true)][string]$Retailer,
    [string]$Archive = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
Write-Host ''
$Retailer = $Retailer.ToLower()
Write-Host ('Σχέδιο εισαγωγής για {0} - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει καμία βάση)' -f $Retailer) -ForegroundColor Cyan
if ($Retailer -notmatch '^[a-z0-9\-]{2,40}$') { Write-Host 'Λάθος όνομα καταστήματος.' -ForegroundColor Red; exit 2 }
$rulesFile = Join-Path (Join-Path (Join-Path $repo 'tools') 'import-rules') ($Retailer + '.mjs')
if (-not (Test-Path -LiteralPath $rulesFile)) { Write-Host ('Δεν υπάρχουν κανόνες για: {0}. Στείλε στο Claude αυτό το μήνυμα.' -f $Retailer) -ForegroundColor Red; exit 2 }
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
$run = Join-Path $OutDir ('IMPORT_PLAN_' + $Retailer + '_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
Write-Host ('Φάκελος: {0} ({1} αρχεία)' -f $Archive, (Count-Feeds $Archive))
Write-Host 'Διαβάζω το feed και φτιάχνω το σχέδιο (1-3 λεπτά)...'
& node (Join-Path (Join-Path $repo 'tools') 'legacy-import-plan.mjs') --archive $Archive --retailer $Retailer --out $run
if ($LASTEXITCODE -ne 0) { Write-Host 'Το εργαλείο σταμάτησε με σφάλμα. Στείλε στο Claude ό,τι γράφει η οθόνη.' -ForegroundColor Red; exit $LASTEXITCODE }
$reportPath = Join-Path $run 'report.txt'
$report = [System.IO.File]::ReadAllText($reportPath, [System.Text.Encoding]::UTF8)
$copied = $false
if (-not $NoClipboard) { try { Set-Clipboard -Value $report; $copied = $true } catch { $copied = $false } }
Write-Host ''
Write-Host ('OK - Η αναφορά γράφτηκε: {0}' -f $reportPath) -ForegroundColor Green
Write-Host 'Δεν άλλαξε τίποτα: ούτε τα αρχεία, ούτε τα sites, ούτε οι βάσεις. Τα αρχεία SQL είναι μόνο σχέδιο και δεν εκτελέστηκαν.'
if ($copied) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
exit 0
