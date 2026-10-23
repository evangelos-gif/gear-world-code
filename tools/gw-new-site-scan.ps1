<#
.SYNOPSIS
  Gear World - NEW SITE SCAN (Travel or Gaming). READ-ONLY.

.DESCRIPTION
  Reads every Awin feed that is already in the Awin archive on this PC and counts, side by side, the products that
  would fit Travel Gear World (suitcases, travel bags, travel accessories, camping) and Gaming Gear World (consoles,
  games, controllers and VR, PC gaming, board and card games): per category and per retailer, with samples, prices,
  and how many Technology Gear World already takes.
  If the Awin feed key is already saved on this PC (by awin-feed-download.ps1), it also reads the Awin feed list
  (read-only) to mark the retailers where you are a member and to list other retailers whose name fits.
  It never asks for the key and never saves it. It does NOT import anything, does NOT contact Cloudflare or D1 and
  does NOT change any file in the archive.
  Output: <home>\gear-world-reports\GW_NEW_SITE_SCAN_<time>\report.txt (also copied to the clipboard)
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
Write-Host 'Gear World - νέο site: Travel ή Gaming; ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν φορτώνει και δεν αλλάζει τίποτα)' -ForegroundColor Cyan

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host 'Δεν βρέθηκε το Node.js σε αυτόν τον υπολογιστή. Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red; exit 3 }
$version = [string](& node --version)
$major = 0
[void][int]::TryParse(($version -replace '^v', '').Split('.')[0], [ref]$major)
if ($major -lt 18) { Write-Host ('Το Node.js είναι παλιό ({0}). Χρειάζεται 18 ή νεότερο. Στείλε στο Claude αυτό το μήνυμα.' -f $version) -ForegroundColor Red; exit 3 }

# 1. The feed folder (found automatically, as in awin-feed-inventory.ps1).
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
                if ($n -gt $bestN) { $best = $d.FullName; $bestN = $n }
            }
        }
        if (-not $best) { Write-Host 'Δεν βρήκα φάκελο με αρχεία AWIN_*.csv.gz. Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red; exit 2 }
        $Archive = $best
    }
}
if (-not (Test-Path -LiteralPath $Archive)) { Write-Host ('Δεν βρήκα τον φάκελο: {0}' -f $Archive) -ForegroundColor Red; exit 2 }
$run = Join-Path $OutDir ('GW_NEW_SITE_SCAN_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Path $run -Force | Out-Null
Write-Host ('Φάκελος feeds: {0} ({1} αρχεία)' -f $Archive, (Count-Feeds $Archive))

# 2. Awin membership (only if the key is already saved; read-only; the key is never written anywhere).
$membersFile = ''
$host1 = ([uri]$BaseUrl).Host
if ((Test-Path -LiteralPath $KeyFile) -and ($host1 -eq 'productdata.awin.com' -or $host1 -eq '127.0.0.1')) {
    $secret = ''
    try {
        $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($KeyFile).Trim())
        $secret = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    } catch { $secret = '' }
    if ($secret -match '^[A-Za-z0-9]{8,64}$') {
        Write-Host 'Διαβάζω τη λίστα των feeds του Awin (μόνο ανάγνωση)...'
        try {
            $resp = Invoke-WebRequest -UseBasicParsing -Uri ('{0}/datafeed/list/apikey/{1}' -f $BaseUrl.TrimEnd('/'), $secret) -TimeoutSec 120
            $list = @($resp.Content | ConvertFrom-Csv)
            function Col($row, [string]$re) { foreach ($p in $row.PSObject.Properties) { if ($p.Name -match $re) { return [string]$p.Value } }; return '' }
            function Q([string]$v) { return '"' + ($v -replace '"', '""') + '"' }
            $lines = New-Object System.Collections.Generic.List[string]
            $lines.Add('advertiser_id,advertiser,region,membership,products,feed_name,vertical')
            foreach ($row in $list) {
                $id = Col $row '(?i)^advertiser\s*id$'
                if ($id -notmatch '^\d+$') { continue }
                $lines.Add((@($id, (Col $row '(?i)^advertiser\s*name$'), (Col $row '(?i)region'), (Col $row '(?i)membership'), (Col $row '(?i)no\.? of products|products'), (Col $row '(?i)^feed\s*name$'), (Col $row '(?i)vertical')) | ForEach-Object { Q (([string]$_).Replace($secret, '***')) }) -join ',')
            }
            $membersFile = Join-Path $run 'awin-list.csv'
            [System.IO.File]::WriteAllText($membersFile, ($lines -join "`r`n"), (New-Object System.Text.UTF8Encoding($true)))
            Write-Host ('Λίστα Awin: {0} feeds.' -f $list.Count)
        } catch {
            Write-Host 'Το Awin δεν έδωσε τη λίστα. Συνεχίζω χωρίς τον έλεγχο μέλους.' -ForegroundColor Yellow
            $membersFile = ''
        }
    }
    $secret = ''
} else {
    Write-Host 'Δεν βρήκα φυλαγμένο κλειδί Awin: συνεχίζω χωρίς τον έλεγχο μέλους (δεν πειράζει).' -ForegroundColor Yellow
}

# 3. The scan.
$reportPath = Join-Path $run 'report.txt'
Write-Host 'Διαβάζω όλα τα feeds. Με 1.500.000 προϊόντα μπορεί να πάρει 10-20 λεπτά. Μην κλείσεις το παράθυρο.'
$nodeArgs = @((Join-Path (Join-Path $repo 'tools') 'gw-new-site-scan.mjs'), '--archive', $Archive, '--out', $reportPath)
if ($membersFile) { $nodeArgs += @('--members', $membersFile) }
& node @nodeArgs
if ($LASTEXITCODE -ne 0) { Write-Host 'Το εργαλείο σταμάτησε με σφάλμα. Στείλε στο Claude ό,τι γράφει η οθόνη.' -ForegroundColor Red; exit $LASTEXITCODE }

$report = [System.IO.File]::ReadAllText($reportPath, [System.Text.Encoding]::UTF8)
$copied = $false
if (-not $NoClipboard) { try { Set-Clipboard -Value $report; $copied = $true } catch { $copied = $false } }
Write-Host ''
Write-Host ('OK - Η αναφορά γράφτηκε: {0}' -f $reportPath) -ForegroundColor Green
Write-Host 'Τίποτα δεν φορτώθηκε και κανένα αρχείο του archive δεν άλλαξε.'
if ($copied) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
exit 0
