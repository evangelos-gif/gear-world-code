<#
.SYNOPSIS
  Gear World Hub - shadow catalogue (phase 1). READ-ONLY.

.DESCRIPTION
  Shows what "every product comes in through the Hub and is shared out to the right site and category" would do with
  today's feeds, without changing anything.
  1. Finds the Awin feed folders on this PC (GW_AWIN_BULK_ARCHIVE, GW_AWIN_NEW_..., in Downloads).
  2. If the Awin feed key is already saved (by awin-feed-download.ps1), reads the Awin feed list (read-only) so that only
     programmes you have JOINED count. Without the key every feed on this PC counts, and the summary says so.
  3. Offers every joined shop to the 5 sites with general category rules (TGW, AGW, VGW, SGW, BGW): a shop a site already
     has keeps that site's own rules, a new shop is placed by the product name alone. Same checks as a real import.
  It imports nothing, writes no SQL, downloads no feed, does not contact Cloudflare or D1 and changes no file.
  The key is never written to the report, the clipboard or the repo.
  Output: <home>\gear-world-reports\HUB_SHADOW_<time>\summary.txt (copied to the clipboard)
          <home>\gear-world-reports\HUB_SHADOW_<time>\<SITE>\report.txt (full plan per site)
#>
param(
    [string]$Archive = '',
    [string]$OutDir = '',
    [string]$KeyFile = '',
    [string]$BaseUrl = 'https://productdata.awin.com',
    [switch]$NoClipboard
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $KeyFile) { $KeyFile = Join-Path (Join-Path $HOME 'gear-world-secrets') 'awin-feed-key.dat' }
Write-Host ''
Write-Host 'Hub: κατάλογος «στη σκιά» (Φάση 1) - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει κανένα site, βάση ή αρχείο)' -ForegroundColor Cyan

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red; exit 3 }
$version = [string](& node --version)
$major = 0
[void][int]::TryParse(($version -replace '^v', '').Split('.')[0], [ref]$major)
if ($major -lt 18) { Write-Host ('Το Node.js είναι παλιό ({0}). Χρειάζεται 18 ή νεότερο. Στείλε στο Claude αυτό το μήνυμα.' -f $version) -ForegroundColor Red; exit 3 }
$host1 = ([uri]$BaseUrl).Host
if ($host1 -ne 'productdata.awin.com' -and $host1 -ne '127.0.0.1') { Write-Host 'Μη αναμενόμενη διεύθυνση.' -ForegroundColor Red; exit 2 }

if (-not $Archive) {
    # Every Awin feed folder in Downloads (lessons L41).
    $dl = Join-Path $HOME 'Downloads'
    $found = @(Get-ChildItem -LiteralPath $dl -Directory -Filter 'GW_AWIN_*' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
    if ($found.Count -gt 0) { $Archive = $found -join ';' } else { $Archive = Join-Path $dl 'GW_AWIN_BULK_ARCHIVE' }
}
$missingArchive = @(($Archive -split ';') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not (Test-Path -LiteralPath $_) })
if ($missingArchive.Count -gt 0) {
    Write-Host ('Δεν βρήκα τον φάκελο των feeds: {0}' -f ($missingArchive -join ', ')) -ForegroundColor Red
    Write-Host 'Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red
    exit 2
}
$run = Join-Path $OutDir ('HUB_SHADOW_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
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
        } catch { Write-Host 'Το Awin δεν έδωσε τη λίστα. Συνεχίζω με όλα τα αρχεία του υπολογιστή.' -ForegroundColor Yellow; $listFile = '' }
    } else { Write-Host 'Δεν μπόρεσα να διαβάσω το φυλαγμένο κλειδί. Συνεχίζω με όλα τα αρχεία του υπολογιστή.' -ForegroundColor Yellow }
} else { Write-Host 'Δεν υπάρχει φυλαγμένο κλειδί του Awin: μετράνε όλα τα αρχεία του υπολογιστή.' -ForegroundColor Yellow }

Write-Host ('Φάκελοι: {0}' -f $Archive)
Write-Host 'Διαβάζω όλα τα feeds για 5 sites... (μπορεί να πάρει 10-30 λεπτά, άφησέ το να τελειώσει)'
# More memory for Node: all the joined feeds are read five times (one per site).
$nodeArgs = @('--max-old-space-size=6144', (Join-Path (Join-Path $repo 'tools') 'hub-shadow-catalog.mjs'), '--archive', $Archive, '--out', $run)
if ($listFile) { $nodeArgs += @('--list', $listFile) }
try { & node @nodeArgs; $code = $LASTEXITCODE } finally { if ($listFile) { Remove-Item -LiteralPath $listFile -Force -ErrorAction SilentlyContinue } }
if ($code -ne 0) { Write-Host 'Το εργαλείο σταμάτησε με σφάλμα. Στείλε στο Claude ό,τι γράφει η οθόνη.' -ForegroundColor Red; exit $code }

$summaryPath = Join-Path $run 'summary.txt'
$summary = [System.IO.File]::ReadAllText($summaryPath, [System.Text.Encoding]::UTF8)
if ($secret -and $summary.Contains($secret)) { $summary = $summary.Replace($secret, '***'); [System.IO.File]::WriteAllText($summaryPath, $summary, (New-Object System.Text.UTF8Encoding($true))) }
$copied = $false
if (-not $NoClipboard) { try { Set-Clipboard -Value $summary; $copied = $true } catch { $copied = $false } }
Write-Host ''
Write-Host ('OK - Η σύνοψη γράφτηκε: {0}' -f $summaryPath) -ForegroundColor Green
Write-Host 'Δεν άλλαξε τίποτα: ούτε τα αρχεία, ούτε τα sites, ούτε οι βάσεις.'
if ($copied) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
exit 0
