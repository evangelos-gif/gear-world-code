<#
.SYNOPSIS
  READ-ONLY check of which Awin programmes still pay, for the shops that have products on the older Gear World sites
  (CGW, MGW, WGW, KGW, HGW, GGW). Job 4 of 25 Oct 2026, lessons L61.

.DESCRIPTION
  Reads, without changing anything:
    1. from each site's database: the shops with active products, how many, their Awin advertiser id (from the links)
       and how many of their Awin links have no product address (?ued= that does not start with http);
    2. your Awin feed list (the same list as tools/awin-feed-download.ps1, with the feed key kept encrypted for your
       Windows user in <home>\gear-world-secrets\awin-feed-key.dat; asked once if it is not there).
  Then says for every programme: member with a fresh feed (ΕΝΤΑΞΕΙ), member with a feed older than 30 days (ΠΡΟΣΟΧΗ),
  in the list but not a member or not in the list at all (ΠΡΟΒΛΗΜΑ: the clicks earn nothing), and broken links.
  Each programme that is not fine gets its Awin page (https://ui.awin.com/awin/affiliate/3057233/merchant-profile/<id>).
  A programme with no feed in the list is ΠΡΟΣΟΧΗ, not ΠΡΟΒΛΗΜΑ: the list only has programmes with a feed. Programmes the
  owner saw as Joined on their Awin page are kept in tools/awin-known-members.json (lessons L79).
  No product link is ever opened (no clicks). Nothing is hidden or changed: that is a separate step with its own approval.
  Report: <home>\gear-world-reports\AWIN_MEMBERSHIP_<time>.txt (also copied to the clipboard). The key is never written.
#>
param(
    [string]$Sites = 'cgw,mgw,wgw,kgw,hgw,ggw',
    [string]$KeyFile = '',
    [string]$BaseUrl = 'https://productdata.awin.com',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
$SiteInfo = @{
    cgw = @{ db = 'construction-gear-customers'; work = 'construction-gear-world-engine' }
    mgw = @{ db = 'mens-gear-world'; work = 'mens-gear-world-engine' }
    wgw = @{ db = 'womens-gear-world'; work = 'womens-gear-world-engine' }
    kgw = @{ db = 'kids-gear-world'; work = 'kids-gear-world-engine' }
    hgw = @{ db = 'home-gear-world'; work = 'home-gear-world-engine' }
    ggw = @{ db = 'garden-gear-world'; work = 'garden-gear-world-engine' }
}
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $KeyFile) { $KeyFile = Join-Path (Join-Path $HOME 'gear-world-secrets') 'awin-feed-key.dat' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$script:Work = ''
$script:secret = ''

$L = New-Object System.Collections.Generic.List[string]
function Mask([string]$s) {
    if ($script:secret) { $s = $s.Replace($script:secret, '***') }
    return [regex]::Replace($s, '(?i)(apikey/)[^/\s]+', '$1***')
}
function Say([string]$t, [string]$c = '') { $t = Mask $t; $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('AWIN_MEMBERSHIP_{0}.txt' -f $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('AWIN_MEMBERSHIP_{0}_{1}.txt' -f $stamp, $n); $n++ }
    $text = $L -join "`r`n"
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
    exit $code
}

# Runs wrangler through a temporary .cmd file and reads its output as UTF-8 (lessons L58). Passing Cloudflare errors are retried (L43).
function Invoke-Wrangler([string]$Arguments) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tmp = [System.IO.Path]::GetTempPath()
    $lines = @('@echo off', ('cd /d "{0}"' -f $script:Work), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $result = $null
    for ($try = 1; $try -le 3; $try++) {
        $cmdFile = Join-Path $tmp ('gw-wrangler-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
        [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
        $oldEnc = $null
        try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
            if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } }
        }
        $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
        $result = @{ code = $code; text = $text }
        $network = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|code: 7403|code: 10000'
        if ($code -eq 0 -or -not $network -or $try -eq 3) { break }
        Say ('Προσωρινό πρόβλημα με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/3)...' -f (5 * $try), ($try + 1)) 'Yellow'
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

Write-Host ''
Say 'Προγράμματα Awin που πληρώνουν - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει τίποτα)' 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
$host1 = ([uri]$BaseUrl).Host
if ($host1 -ne 'productdata.awin.com' -and $host1 -ne '127.0.0.1') { Say 'Μη αναμενόμενη διεύθυνση του Awin.' 'Red'; Finish 2 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js.' 'Red'; Finish 3 }
$list = @()
foreach ($s in ($Sites -split ',')) {
    $t = $s.Trim().ToLower()
    if (-not $t) { continue }
    if (-not $SiteInfo.ContainsKey($t)) { Say ('Άγνωστο site: {0}' -f $s) 'Red'; Finish 2 }
    $list += $t
}
$planDir = Join-Path $OutDir ('AWIN_MEMBERSHIP_PLAN_{0}' -f $stamp)
New-Item -ItemType Directory -Path $planDir -Force | Out-Null

# 1. The shops with active products on each site (read-only).
$siteArgs = @()
$sql = "SELECT retailer, COUNT(*) AS n, MIN(affiliate_url) AS link, SUM(CASE WHEN instr(affiliate_url, 'cread.php') = 0 THEN 0 WHEN instr(affiliate_url, 'ued=http') = 0 THEN 1 ELSE 0 END) AS bad FROM products WHERE is_active = 1 GROUP BY retailer"
$exitCode = 0
foreach ($site in $list) {
    $script:Work = $WorkDir
    if (-not $script:Work) {
        $script:Work = Join-Path $HOME $SiteInfo[$site].work
        if (-not (Test-Path -LiteralPath $script:Work)) { $script:Work = Join-Path $HOME 'gear-world-import' }
    }
    if (-not (Test-Path -LiteralPath $script:Work)) { New-Item -ItemType Directory -Path $script:Work -Force | Out-Null }
    $r = Invoke-Wrangler ('d1 execute {0} --remote --json --command "{1}"' -f $SiteInfo[$site].db, $sql)
    if ($r.code -ne 0 -or $r.text.IndexOf('"results"') -lt 0) { Say ('{0}: δεν μπόρεσα να διαβάσω τη βάση (σύνδεση στο Cloudflare;).' -f $site.ToUpper()) 'Yellow'; $exitCode = 4; continue }
    $f = Join-Path $planDir ('{0}.json.txt' -f $site)
    [System.IO.File]::WriteAllText($f, $r.text, (New-Object System.Text.UTF8Encoding($false)))
    $siteArgs += @('--site', ('{0}={1}' -f $site, $f))
}
if ($siteArgs.Count -eq 0) { Say 'Δεν διάβασα καμία βάση. Δεν άλλαξε τίποτα.' 'Red'; Finish 4 }

# 2. Your Awin feed list (read-only). The key is asked once and kept encrypted for this Windows user.
$listFile = ''
if (-not (Test-Path -LiteralPath $KeyFile)) {
    Write-Host ''
    Write-Host 'Χρειάζομαι μία φορά το κλειδί των feeds του Awin (Toolbox > Create-a-Feed, είναι το κομμάτι μετά το /apikey/ σε ένα link λήψης).' -ForegroundColor Yellow
    Write-Host 'Θα φυλαχτεί κρυπτογραφημένο μόνο για τον χρήστη σου στα Windows. Δεν θα φαίνεται πουθενά.'
    $sec = Read-Host 'Κλειδί Awin feed' -AsSecureString
    if ($sec.Length -ge 8) {
        $dir = Split-Path -Parent $KeyFile
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        [System.IO.File]::WriteAllText($KeyFile, (ConvertFrom-SecureString $sec), [System.Text.Encoding]::ASCII)
        Say ('Το κλειδί φυλάχτηκε κρυπτογραφημένο: {0}' -f $KeyFile) 'Green'
    }
}
if (Test-Path -LiteralPath $KeyFile) {
    try {
        $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($KeyFile).Trim())
        $script:secret = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    } catch { $script:secret = '' }
}
if ($script:secret -match '^[A-Za-z0-9]{8,64}$') {
    $listUrl = '{0}/datafeed/list/apikey/{1}' -f $BaseUrl.TrimEnd('/'), $script:secret
    try {
        $resp = Invoke-WebRequest -UseBasicParsing -Uri $listUrl -TimeoutSec 120
        # Only the columns the check needs: the list also has download links that carry the key, and they are never written.
        $rows = @($resp.Content | ConvertFrom-Csv)
        $keep = New-Object System.Collections.Generic.List[string]
        $keep.Add('Advertiser ID,Advertiser Name,Membership Status,Feed ID,Last Imported,No of products,Primary Region')
        function Col($row, [string]$re) { foreach ($p in $row.PSObject.Properties) { if ($p.Name -match $re) { return [string]$p.Value } }; return '' }
        function Csv([string]$v) { return '"' + $v.Replace('"', '""') + '"' }
        foreach ($x in $rows) {
            $keep.Add((@((Col $x '(?i)^advertiser.?id$'), (Col $x '(?i)^advertiser.?name$'), (Col $x '(?i)membership'), (Col $x '(?i)^feed.?id$'),
                (Col $x '(?i)last.?imported'), (Col $x '(?i)(no|number).?of.?products'), (Col $x '(?i)region')) | ForEach-Object { Csv $_ }) -join ',')
        }
        $listFile = Join-Path $planDir 'awin-list.csv'
        [System.IO.File]::WriteAllText($listFile, ($keep -join "`n") + "`n", (New-Object System.Text.UTF8Encoding($false)))
    } catch { Say ('Το Awin δεν έδωσε τη λίστα των feeds: {0}' -f (Mask $_.Exception.Message)) 'Yellow' }
} else { Say 'Δεν υπάρχει (ή δεν διαβάζεται) το κλειδί των feeds του Awin.' 'Yellow' }
if (-not $listFile) { Say '🟡 ΠΡΟΣΟΧΗ: χωρίς τη λίστα του Awin δεν ξέρω ποια προγράμματα πληρώνουν. Παρακάτω μόνο τα στοιχεία των sites.' 'Yellow'; if ($exitCode -eq 0) { $exitCode = 5 } }

# 3. The check (read-only).
$a = @((Join-Path (Join-Path $repo 'tools') 'awin-membership-plan.mjs'), '--out', $planDir) + $siteArgs
if ($listFile) { $a += @('--list', $listFile) }
& node @a
if ($LASTEXITCODE -ne 0) { Say 'Ο έλεγχος δεν ολοκληρώθηκε.' 'Red'; Finish 10 }
Say ''
foreach ($line in [System.IO.File]::ReadAllLines((Join-Path $planDir 'report.txt'), [System.Text.Encoding]::UTF8)) {
    if ($line -match 'ΠΡΟΒΛΗΜΑ|ΠΡΟΣΟΧΗ') { Say $line 'Yellow' } else { Say $line }
}
Say ''
Say 'Δεν άλλαξε τίποτα. Απόκρυψη προϊόντων ενός προγράμματος που δεν πληρώνει: ξεχωριστό βήμα με δική του έγκριση.'
Finish $exitCode
