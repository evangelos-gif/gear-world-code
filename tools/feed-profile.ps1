<#
.SYNOPSIS
  Gear World - FEED PROFILE. READ-ONLY.
.DESCRIPTION
  For the feeds on this PC (Awin, and the CJ, Daisycon and Rakuten catalogues) downloaded in the last -Days days (default 2; -Hours for the last hours), or for -Advertiser '<ids>', one block per
  feed: the shop's web address, currency, products, in stock, prices, the shop's categories, brands and sample names.
  What is needed to write a new shop's import rules and choose its site. It changes nothing (no import, no Cloudflare,
  no D1, no file in the archive).
  -AlsoHours <n> with -Advertiser: the shops asked for AND every feed downloaded in the last n hours, in one report.
  Output: <home>\gear-world-reports\FEED_PROFILE_<time>\report.txt (also copied to the clipboard)
#>
param(
    [string]$Advertiser = '',
    [int]$Days = 2,
    [int]$Hours = 0,
    [int]$AlsoHours = 0,
    [string]$Archive = '',
    [string]$OutDir = '',
    [int]$MaxRows = 0,
    [switch]$NoClipboard
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
Write-Host ''
Write-Host 'Feed profile - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν φορτώνει, δεν κατεβάζει και δεν αλλάζει τίποτα)' -ForegroundColor Cyan
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
            $dirs = @(Get-Item -LiteralPath $r) + @(Get-ChildItem -LiteralPath $r -Directory -ErrorAction SilentlyContinue)
            foreach ($d in $dirs) { $n = Count-Feeds $d.FullName; if ($n -gt $bestN) { $best = $d.FullName; $bestN = $n } }
        }
        if (-not $best) { Write-Host 'Δεν βρήκα φάκελο με αρχεία AWIN_*.csv.gz. Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red; exit 2 }
        $Archive = $best
    }
}
if (-not (Test-Path -LiteralPath $Archive)) { Write-Host ('Δεν βρήκα τον φάκελο: {0}' -f $Archive) -ForegroundColor Red; exit 2 }
$run = Join-Path $OutDir ('FEED_PROFILE_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Path $run -Force | Out-Null

Write-Host ('Φάκελος: {0} ({1} αρχεία)' -f $Archive, (Count-Feeds $Archive))
Write-Host 'Διαβάζω όλα τα feeds... (μπορεί να πάρει μερικά λεπτά, άφησέ το να τελειώσει)'
# -Hours: only the feeds downloaded in the last hours (a second download the same day, 8 Nov 2026).
$dayText = [string]$Days
if ($Hours -gt 0) { $dayText = ([double]$Hours / 24).ToString([System.Globalization.CultureInfo]::InvariantCulture) }
$nodeArgs = @((Join-Path (Join-Path $repo 'tools') 'feed-profile.mjs'), '--archive', $Archive, '--out', $run, '--days', $dayText)
if ($Advertiser) { $nodeArgs += @('--advertiser', $Advertiser) }
# -AlsoHours with -Advertiser: also every feed downloaded in the last hours (massive import of 14 Nov 2026, L133).
if ($AlsoHours -gt 0) { $nodeArgs += @('--also-days', ([double]$AlsoHours / 24).ToString([System.Globalization.CultureInfo]::InvariantCulture)) }
if ($MaxRows -gt 0) { $nodeArgs += @('--max-rows', [string]$MaxRows) }
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
