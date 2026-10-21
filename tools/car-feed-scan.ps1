<#
.SYNOPSIS
  Car feed scan. READ-ONLY.

.DESCRIPTION
  1. Reads every Awin feed file on this PC (folder GW_AWIN_BULK_ARCHIVE, found automatically) and counts, per retailer,
     how many products are car products (parts, tyres, garage tools, car care, car electronics, interior, exterior/towing,
     safety, EV charging), with samples.
  2. If the Awin feed key is already saved on this PC (by awin-feed-download.ps1), reads the Awin feed list (read-only)
     and shows which car programmes you joined and which you could apply to, with links.
  It imports nothing, downloads no feed, does not contact Cloudflare and changes no file.
  The key is never written to the report, the clipboard or the repo.
  Output: <home>\gear-world-reports\CAR_FEED_SCAN_<time>\report.txt (copied to the clipboard)
#>
param(
    [string]$Archive = '',
    [string]$OutDir = '',
    [string]$KeyFile = '',
    [string]$BaseUrl = 'https://productdata.awin.com',
    [int]$MaxRows = 0,
    [switch]$NoClipboard
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $KeyFile) { $KeyFile = Join-Path (Join-Path $HOME 'gear-world-secrets') 'awin-feed-key.dat' }
Write-Host ''
Write-Host 'Car feed scan - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν φορτώνει, δεν κατεβάζει και δεν αλλάζει τίποτα)' -ForegroundColor Cyan
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red; exit 3 }
$host1 = ([uri]$BaseUrl).Host
if ($host1 -ne 'productdata.awin.com' -and $host1 -ne '127.0.0.1') { Write-Host 'Μη αναμενόμενη διεύθυνση.' -ForegroundColor Red; exit 2 }

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
$run = Join-Path $OutDir ('CAR_FEED_SCAN_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Path $run -Force | Out-Null

# The Awin feed list (read-only), only if the key is already saved. It goes to a temporary file that is deleted at the end.
$listFile = ''
$secret = ''
if (Test-Path -LiteralPath $KeyFile) {
    try {
        $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($KeyFile).Trim())
        $secret = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    } catch { $secret = '' }
    if ($secret -match '^[A-Za-z0-9]{8,64}$') {
        Write-Host 'Διαβάζω τη λίστα των feeds του Awin (μόνο ανάγνωση)...'
        try {
            $resp = Invoke-WebRequest -UseBasicParsing -Uri ('{0}/datafeed/list/apikey/{1}' -f $BaseUrl.TrimEnd('/'), $secret) -TimeoutSec 120
            $listFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-awin-list-' + [guid]::NewGuid().ToString('N') + '.csv')
            [System.IO.File]::WriteAllText($listFile, [string]$resp.Content, (New-Object System.Text.UTF8Encoding($false)))
        } catch { Write-Host 'Το Awin δεν έδωσε τη λίστα. Συνεχίζω μόνο με τα αρχεία.' -ForegroundColor Yellow; $listFile = '' }
    } else { Write-Host 'Δεν μπόρεσα να διαβάσω το φυλαγμένο κλειδί. Συνεχίζω μόνο με τα αρχεία.' -ForegroundColor Yellow }
} else { Write-Host 'Δεν υπάρχει φυλαγμένο κλειδί του Awin: διαβάζω μόνο τα αρχεία.' -ForegroundColor Yellow }

Write-Host ('Φάκελος: {0} ({1} αρχεία)' -f $Archive, (Count-Feeds $Archive))
Write-Host 'Διαβάζω όλα τα feeds... (μπορεί να πάρει μερικά λεπτά, άφησέ το να τελειώσει)'
$nodeArgs = @((Join-Path (Join-Path $repo 'tools') 'car-feed-scan.mjs'), '--archive', $Archive, '--out', $run)
if ($listFile) { $nodeArgs += @('--list', $listFile) }
if ($MaxRows -gt 0) { $nodeArgs += @('--max-rows', [string]$MaxRows) }
try { & node @nodeArgs; $code = $LASTEXITCODE } finally { if ($listFile) { Remove-Item -LiteralPath $listFile -Force -ErrorAction SilentlyContinue } }
if ($code -ne 0) { Write-Host 'Το εργαλείο σταμάτησε με σφάλμα. Στείλε στο Claude ό,τι γράφει η οθόνη.' -ForegroundColor Red; exit $code }

$reportPath = Join-Path $run 'report.txt'
$report = [System.IO.File]::ReadAllText($reportPath, [System.Text.Encoding]::UTF8)
if ($secret -and $report.Contains($secret)) { $report = $report.Replace($secret, '***'); [System.IO.File]::WriteAllText($reportPath, $report, (New-Object System.Text.UTF8Encoding($true))) }
$copied = $false
if (-not $NoClipboard) { try { Set-Clipboard -Value $report; $copied = $true } catch { $copied = $false } }
Write-Host ''
Write-Host ('OK - Η αναφορά γράφτηκε: {0}' -f $reportPath) -ForegroundColor Green
Write-Host 'Δεν άλλαξε τίποτα: ούτε τα αρχεία, ούτε τα sites, ούτε οι βάσεις.'
if ($copied) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
exit 0
