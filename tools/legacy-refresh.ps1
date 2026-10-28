<#
.SYNOPSIS
  Refreshes price, picture and stock of retailers that are ALREADY on the older Gear World sites (CGW, MGW, WGW, KGW,
  HGW, GGW) from the Awin feeds on this PC, and hides their products that are no longer in the feed.

.DESCRIPTION
  -Pairs "reidl:cgw,tooled-up:cgw": shop and site, the shop as its name on the site written with dashes (Tooled Up ->
  tooled-up, WATCH & WATCH -> watch-watch). The feed is found by its merchant_name in the Awin archive
  (Downloads\GW_AWIN_BULK_ARCHIVE), or with -Advertiser <id> when only one pair is given.

  Without -Apply: READ-ONLY. Reads the site database (the shop's active products and the table's indexes) and the feed,
  and shows what WOULD change: prices, pictures and stock that differ, products no longer in the feed, prices that jump
  more than 3 times (not changed, listed), and the rows that D1 would write. Changes nothing.

  With -Apply, for EACH pair its own approval phrase (ΕΓΚΡΙΝΩ REFRESH <SHOP> <SITE>, e.g. ΕΓΚΡΙΝΩ REFRESH REIDL CGW):
    1. Takes a Cloudflare Time Travel restore point and saves a rollback file with the old values on this PC.
    2. Updates only the values that differ (one UPDATE per product, by id), then hides the products no longer in the
       feed (is_active = 0; nothing is deleted). Products already hidden stay hidden.
    3. Counts the shop's active products again.
  A feed not updated for more than 30 days changes nothing (lessons L39). A feed missing more than half of the active
  products hides nothing. Rows written in D1 stay under -MaxWrites (default 90,000 for the whole run: Workers Free allows
  100,000 a day, lessons L49); what is left waits for the next run. -PaidPlan: Workers Paid, up to 1,000,000 per run.
  It changes ONLY the products of these shops in these sites' databases. No code, no other shop, no deploy.

  -FromShop (job 3, lessons L60): for shops whose Awin feed stopped (Red Gorilla, Wavytalk, Gardenista: not refreshed since
  15 May 2026) the source is the shop's own live Shopify catalogue instead of the feed (read-only GETs to the shop; its
  address comes from the products' links). Products gone from the shop or sold out there are hidden; a price changes only
  when the shop sells in the site's currency. Same approval phrase. Example: -Pairs "gardenista:hgw" -FromShop
  A shop with more than 10,000 products (InStock, L80) is not read whole: -Sample N (default 100) of the site's own
  products are looked up one by one on the shop, and the report shows how many have the same price, another price, are
  sold out or gone. Nothing changes from a sample. The same happens when the shop stops answering part-way through its
  catalogue. -SampleShops "instock-uk" sends the shops named there straight to the sample (no full catalogue read: reading
  InStock's catalogue made Shopify answer HTTP 429, "slow down", to this PC for every Shopify shop, 27 Oct 2026); the
  other pairs of the same run are refreshed as usual. On 429 the sample waits, asks once more, and stops after 3 in a row.
  -SlowShops "instock-uk" (L81): the full check for such a shop, product by product (/products/<handle>.js, about one a
  second; InStock: 16,587 products on 5 sites, about 4-5 hours). The answers are kept for 48 hours in
  <home>\gear-world-reports\shop-memory (one file per shop, shared by the sites), so a stopped or interrupted run goes on
  where it stopped. A run that asked the shop does not ask for approval (it may have run for hours, unattended): the same
  command again within 48 hours takes the answers from memory, shows the plan and asks each site's phrase. Products that
  did not answer stay as they are. Windows is kept awake while it runs.
  -AcceptJumps "gardenista": that shop's prices that change more than 3 times change too (the owner checked them).

  Rollback (printed): the rollback file puts back the old values and shows the hidden products again; or the restore point.
  Report: <home>\gear-world-reports\REFRESH_<time>.txt (also copied to the clipboard)
#>
param(
    [Parameter(Mandatory = $true)][string]$Pairs,
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Archive = '',
    [string]$Advertiser = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [int]$MaxWrites = 90000,
    [switch]$PaidPlan,
    [switch]$FromShop,
    [int]$Sample = 100,
    [string]$SampleShops = '',
    [string]$SlowShops = '',
    [string]$AcceptJumps = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$SiteInfo = @{
    cgw = @{ db = 'construction-gear-customers'; domain = 'constructiongearworld.com'; work = 'construction-gear-world-engine' }
    mgw = @{ db = 'mens-gear-world'; domain = 'mensgearworld.com'; work = 'mens-gear-world-engine' }
    wgw = @{ db = 'womens-gear-world'; domain = 'womensgearworld.com'; work = 'womens-gear-world-engine' }
    kgw = @{ db = 'kids-gear-world'; domain = 'kidsgearworld.com'; work = 'kids-gear-world-engine' }
    hgw = @{ db = 'home-gear-world'; domain = 'homegearworld.com'; work = 'home-gear-world-engine' }
    ggw = @{ db = 'garden-gear-world'; domain = 'gardengearworld.com'; work = 'garden-gear-world-engine' }
}
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$budget = $MaxWrites
if ($PaidPlan -and $MaxWrites -eq 90000) { $budget = 1000000 }
$script:DbName = ''
$script:Work = ''

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('REFRESH_{0}.txt' -f $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('REFRESH_{0}_{1}.txt' -f $stamp, $n); $n++ }
    $text = $L -join "`r`n"
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
    exit $code
}

# Normalise an approval phrase: no accents, upper case, single spaces; Latin "EGKRINO" also accepted.
function Normalize-Phrase([string]$s) {
    $d = ([string]$s).Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    $t = ($sb.ToString().ToUpperInvariant() -replace '\s+', ' ').Trim()
    return ($t -replace '^EGKRINO ', 'ΕΓΚΡΙΝΩ ')
}

function Confirm-Approval([string]$phrase) {
    $typed = $Approve
    if (-not $typed) {
        Write-Host ''
        Write-Host ('Για να συνεχίσω, γράψε ακριβώς: {0}' -f $phrase) -ForegroundColor Yellow
        Write-Host '(ή πάτα Enter για να το παραλείψω χωρίς αλλαγές)'
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
# -Retry: on a network error or a passing Cloudflare error (7403, 10000: lessons L43), try again, up to 3 times.
function Invoke-Wrangler([string]$Arguments, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tmp = [System.IO.Path]::GetTempPath()
    $lines = @('@echo off', ('cd /d "{0}"' -f $script:Work), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path $tmp ('gw-wrangler-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
        [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
        # wrangler writes UTF-8; Windows PowerShell would read it with the console code page (850, 737...): names came
        # out as 'Schl├â┬╝ssel' (26 Oct 2026, lessons L58), and any other text would reach the plan and its rollback wrong.
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
        if ($code -eq 0 -or -not $network -or $try -eq $tries) { break }
        Say ('Προσωρινό πρόβλημα με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/{2})...' -f (5 * $try), ($try + 1), $tries) 'Yellow'
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

function Get-JsonArray([string]$text) {
    $i = $text.IndexOf('[')
    $j = $text.LastIndexOf(']')
    if ($i -lt 0 -or $j -le $i) { return $null }
    try { return @($text.Substring($i, $j - $i + 1) | ConvertFrom-Json) } catch { return $null }
}

# Read-only SELECT. Returns @{ rows; text } or $null on error.
function Select-Raw([string]$sql) {
    if ($sql -notmatch '^\s*SELECT ') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler ('d1 execute {0} --remote --json --command "{1}"' -f $script:DbName, $sql) -Retry
    if ($r.code -ne 0) { Say $r.text; return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { Say $r.text; return $null }
    return @{ rows = @($j[0].results); text = $r.text }
}

# The shop's name as an SQL text: an ampersand is written with char(38) (the command goes through cmd.exe).
function Sql-Name([string]$name) {
    $q = $name.Replace("'", "''")
    if ($q.Contains('&')) { return ("replace('{0}', '~', char(38))" -f $q.Replace('&', '~')) }
    return ("'{0}'" -f $q)
}
function Key-Of([string]$s) { return (($s.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')) }

Write-Host ''
$mode = 'ΔΟΚΙΜΗ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ'
if ($Apply) { $mode = 'ΑΝΑΝΕΩΣΗ - κάθε κατάστημα ζητά τη δική του φράση έγκρισης' }
Say ('Ανανέωση τιμών, εικόνων και αποθέματος - {0}' -f $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))

$list = @()
foreach ($p in ($Pairs -split ',')) {
    $t = $p.Trim().ToLower()
    if (-not $t) { continue }
    if ($t -notmatch '^[a-z0-9\-]{2,60}:(cgw|mgw|wgw|kgw|hgw|ggw)$') { Say ('Λάθος ζευγάρι κατάστημα:site: {0}' -f $p) 'Red'; Finish 2 }
    $list += $t
}
if ($list.Count -lt 1) { Say 'Δεν δόθηκε κανένα ζευγάρι κατάστημα:site.' 'Red'; Finish 2 }
if ($Advertiser -and ($list.Count -ne 1 -or $Advertiser -notmatch '^\d{1,9}$')) { Say '-Advertiser μόνο με ΕΝΑ ζευγάρι και μόνο αριθμός.' 'Red'; Finish 2 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js.' 'Red'; Finish 3 }
$shopKeys = @($list | ForEach-Object { ($_ -split ':')[0] })
# The shops named in -SampleShops, -SlowShops or -AcceptJumps: each must be one of the -Pairs.
function Shop-List([string]$value, [string]$label) {
    $keys = @()
    foreach ($s in ($value -split ',')) {
        $k = Key-Of $s
        if (-not $k) { continue }
        if ($shopKeys -notcontains $k) { Say ('{0}: το «{1}» δεν είναι στα -Pairs.' -f $label, $s) 'Red'; Finish 2 }
        $keys += $k
    }
    return ,$keys
}
$sampleKeys = Shop-List $SampleShops '-SampleShops'
$slowKeys = Shop-List $SlowShops '-SlowShops'
$jumpKeys = Shop-List $AcceptJumps '-AcceptJumps'
if ((($sampleKeys.Count + $slowKeys.Count) -gt 0) -and -not $FromShop) { Say '-SampleShops και -SlowShops μόνο μαζί με -FromShop.' 'Red'; Finish 2 }
foreach ($k in $sampleKeys) {
    if ($slowKeys -contains $k) { Say ('Το {0} είναι και στα -SampleShops και στα -SlowShops: διάλεξε ένα.' -f $k) 'Red'; Finish 2 }
    Say ('Μόνο δείγμα για το {0} (χωρίς ανάγνωση όλου του καταλόγου, L80).' -f $k)
}
foreach ($k in $slowKeys) { Say ('Αργός πλήρης έλεγχος για το {0}: ένα-ένα, περίπου 1 προϊόν το δευτερόλεπτο (L81).' -f $k) }
foreach ($k in $jumpKeys) { Say ('Οι τιμές του {0} που αλλάζουν πάνω από 3 φορές ΑΛΛΑΖΟΥΝ κι αυτές (-AcceptJumps).' -f $k) 'Yellow' }
if ($slowKeys.Count -gt 0) {
    # Hours of checking: keep Windows awake while this window runs (ES_CONTINUOUS | ES_SYSTEM_REQUIRED). A closed laptop lid still sleeps.
    try {
        Add-Type -Namespace GearWorld -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);' -ErrorAction Stop
        [void][GearWorld.Power]::SetThreadExecutionState([uint32]2147483649)
        Say 'Ο υπολογιστής δεν θα πέσει σε αναστολή όσο τρέχει (αν είναι laptop: στο ρεύμα, με ανοιχτό καπάκι).'
    } catch { }
}

# The Awin archive on this PC (found automatically).
function Count-Feeds([string]$dir) {
    try { return @(Get-ChildItem -LiteralPath $dir -File -Filter 'AWIN_*.csv*' -ErrorAction Stop).Count } catch { return 0 }
}
if (-not $Archive) {
    $default = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE'
    if ((Count-Feeds $default) -gt 0) { $Archive = $default }
    else {
        $best = ''; $bestN = 0
        foreach ($root in @('Downloads', 'Desktop', 'Documents')) {
            $r = Join-Path $HOME $root
            if (-not (Test-Path -LiteralPath $r)) { continue }
            $dirs = @(Get-Item -LiteralPath $r) + @(Get-ChildItem -LiteralPath $r -Directory -ErrorAction SilentlyContinue)
            foreach ($d in $dirs) { $n = Count-Feeds $d.FullName; if ($n -gt $bestN) { $best = $d.FullName; $bestN = $n } }
        }
        $Archive = $best
    }
}
if ((-not $FromShop) -and (-not $Archive -or -not (Test-Path -LiteralPath $Archive))) { Say 'Δεν βρήκα τον φάκελο με τα feeds του Awin.' 'Red'; Finish 2 }
if (-not $Archive) { $Archive = $HOME }
if ($FromShop) { Say 'Πηγή: ο ζωντανός κατάλογος κάθε καταστήματος (όχι τα feeds του Awin, L60).' } else { Say ('Feeds: {0}' -f $Archive) }
Say ('Όριο εγγραφών D1 για όλη την εκτέλεση: {0}' -f $budget)

$planRoot = Join-Path $OutDir ('REFRESH_PLAN_{0}' -f $stamp)
New-Item -ItemType Directory -Path $planRoot -Force | Out-Null
$exitCode = 0
$n = 0
foreach ($pair in $list) {
    $n++
    $parts = $pair -split ':'
    $key = $parts[0]
    $site = $parts[1]
    $script:DbName = $SiteInfo[$site].db
    $script:Work = $WorkDir
    if (-not $script:Work) {
        $script:Work = Join-Path $HOME $SiteInfo[$site].work
        if (-not (Test-Path -LiteralPath $script:Work)) { $script:Work = Join-Path $HOME 'gear-world-import' }
    }
    if (-not (Test-Path -LiteralPath $script:Work)) { New-Item -ItemType Directory -Path $script:Work -Force | Out-Null }
    Say ''
    Say ('===== {0}/{1}: {2} στο {3} ({4}) =====' -f $n, $list.Count, $key, $site.ToUpper(), $SiteInfo[$site].domain) 'Cyan'

    # 1. The shop's name on the site (read-only).
    $shops = Select-Raw 'SELECT retailer, COUNT(*) AS n FROM products WHERE is_active = 1 GROUP BY retailer'
    if ($null -eq $shops) { Say 'Δεν μπόρεσα να διαβάσω τη βάση (σύνδεση στο Cloudflare;). Δεν άλλαξε τίποτα.' 'Red'; $exitCode = 4; continue }
    $name = ''
    foreach ($s in $shops.rows) { if ((Key-Of ([string]$s.retailer)) -eq $key) { $name = [string]$s.retailer } }
    if (-not $name) {
        Say ('Το κατάστημα «{0}» δεν έχει ενεργά προϊόντα στο {1}. Καταστήματα εκεί:' -f $key, $site.ToUpper()) 'Yellow'
        foreach ($s in $shops.rows) { Say ('  {0} ({1}): {2}' -f (Key-Of ([string]$s.retailer)), $s.retailer, $s.n) }
        if ($exitCode -eq 0) { $exitCode = 5 }
        continue
    }
    if ($name -match '[|<>^%~"]') { Say ('Το όνομα «{0}» έχει χαρακτήρες που δεν περνούν με ασφάλεια. Σταματώ για αυτό το κατάστημα.' -f $name) 'Red'; $exitCode = 5; continue }
    $sqlName = Sql-Name $name

    # 2. Indexes and triggers (for the rows D1 writes, L57/L59) and the shop's active products, 5,000 at a time (read-only).
    $dir = Join-Path $planRoot ('{0}-{1}' -f $site, $key)
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $idx = Select-Raw "SELECT type, name, sql FROM sqlite_master WHERE type IN ('index', 'trigger') AND tbl_name = 'products'"
    if ($null -eq $idx) { Say 'Δεν μπόρεσα να διαβάσω τη δομή της βάσης. Δεν άλλαξε τίποτα.' 'Red'; $exitCode = 4; continue }
    $idxFile = Join-Path $dir 'indexes.json.txt'
    [System.IO.File]::WriteAllText($idxFile, $idx.text, (New-Object System.Text.UTF8Encoding($false)))
    $rowFiles = @()
    $last = 0
    $failed = $false
    for ($page = 1; $page -le 200; $page++) {
        $cols = 'id, awin_product_id, merchant_product_id, product_name, price, currency, stock_status, image_url, is_active'
        if ($FromShop) { $cols = $cols + ', affiliate_url' }
        $sql = ('SELECT {2} FROM products WHERE retailer = {0} AND is_active = 1 AND id BETWEEN {1} AND 2147483647 ORDER BY id LIMIT 5000' -f $sqlName, ($last + 1), $cols)
        $r = Select-Raw $sql
        if ($null -eq $r) { $failed = $true; break }
        $f = Join-Path $dir ('rows-{0:D3}.json.txt' -f $page)
        [System.IO.File]::WriteAllText($f, $r.text, (New-Object System.Text.UTF8Encoding($false)))
        $rowFiles += $f
        if ($r.rows.Count -lt 5000) { break }
        $last = [long]($r.rows[$r.rows.Count - 1].id)
    }
    if ($failed) { Say 'Δεν μπόρεσα να διαβάσω τα προϊόντα του καταστήματος. Δεν άλλαξε τίποτα.' 'Red'; $exitCode = 4; continue }

    # 3. The plan (read-only).
    $a = @((Join-Path (Join-Path $repo 'tools') 'legacy-refresh-plan.mjs'), '--archive', $Archive, '--retailer', $name, '--site', $site, '--indexes', $idxFile, '--out', $dir, '--max-writes', [string]$budget)
    if ($Advertiser) { $a += @('--advertiser', $Advertiser) }
    if ($FromShop) { $a += @('--from-shop', '--sample', [string]$Sample) }
    if ($FromShop -and ($sampleKeys -contains $key)) { $a += @('--sample-only') }
    if ($FromShop -and ($slowKeys -contains $key)) { $a += @('--slow', '--memory', (Join-Path $OutDir 'shop-memory')) }
    if ($jumpKeys -contains $key) { $a += @('--accept-jumps') }
    foreach ($f in $rowFiles) { $a += @('--rows', $f) }
    & node @a
    $planCode = $LASTEXITCODE
    $reportFile = Join-Path $dir 'report.txt'
    if (Test-Path -LiteralPath $reportFile) { foreach ($line in [System.IO.File]::ReadAllLines($reportFile, [System.Text.Encoding]::UTF8)) { if ($line -match '^ΠΡΟΣΟΧΗ') { Say $line 'Yellow' } else { Say $line } } }
    # 5 = the shop's catalogue was not read whole (too big, stopped answering part-way, or -SampleShops): only a sample
    # was checked (L80). Nothing can change from it.
    if ($planCode -eq 5) { Say 'Μόνο δείγμα (ο κατάλογος δεν διαβάστηκε ολόκληρος, ο λόγος πιο πάνω): δεν άλλαξε τίποτα.' 'Yellow'; continue }
    if ($planCode -ne 0) { Say 'Το σχέδιο δεν έγινε (δες πιο πάνω). Δεν άλλαξε τίποτα.' 'Red'; if ($exitCode -eq 0) { $exitCode = 10 }; continue }
    $c = ([System.IO.File]::ReadAllText((Join-Path $dir 'counts.txt'))).Trim() -split '\s+'
    $nChanges = [int]$c[0]; $nHides = [int]$c[1]; $writes = [int]$c[2]; $stale = ($c[3] -eq '1'); $activeBefore = [int]$c[5]
    $live = ($c.Count -gt 6 -and $c[6] -eq '1')
    $phrase = 'ΕΓΚΡΙΝΩ REFRESH {0} {1}' -f $key.ToUpper(), $site.ToUpper()
    if ($stale -or ($nChanges + $nHides) -eq 0) {
        if (-not $stale) { Say 'Τίποτα να αλλάξει.' 'Green' }
        continue
    }
    # The slow check asked the shop in this run (hours, maybe unattended): no approval now; the next run applies from memory (L81).
    if ($live) { Say ('Πρόβα: δεν άλλαξε τίποτα. Ξανατρέξε την ίδια εντολή μέσα σε 48 ώρες για να ζητήσει τη φράση {0}.' -f $phrase) 'Green'; continue }
    if (-not $Apply) { Say ('Δοκιμή μόνο: δεν άλλαξε τίποτα. Η φράση έγκρισης: {0}' -f $phrase) 'Green'; continue }
    if (-not (Confirm-Approval $phrase)) { Say 'Δεν δόθηκε έγκριση: δεν άλλαξε τίποτα σε αυτό το κατάστημα.' 'Yellow'; if ($exitCode -eq 0) { $exitCode = 1 }; continue }

    # 4. Backup: Time Travel restore point and the rollback file with the old values.
    $bdir = Join-Path $script:Work 'backups'
    if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
    $tt = Invoke-Wrangler ('d1 time-travel info {0}' -f $script:DbName) -Retry
    $bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
    if ($tt.code -ne 0 -or -not $bm.Success) { Say 'Δεν πήρα σημείο επαναφοράς: ΔΕΝ άλλαξα τίποτα.' 'Red'; Say $tt.text; $exitCode = 11; continue }
    $restoreCmd = 'npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $script:DbName, $bm.Value
    $rollback = Join-Path $bdir ('{0}-refresh-{1}-{2}-rollback.sql' -f $site, $key, $stamp)
    Copy-Item -LiteralPath (Join-Path $dir 'rollback.sql') -Destination $rollback -Force
    Copy-Item -LiteralPath (Join-Path $dir 'hidden-ids.txt') -Destination ($rollback -replace 'rollback\.sql$', 'hidden-ids.txt') -Force
    $undo = 'npx wrangler d1 execute {0} --remote --file "{1}"' -f $script:DbName, $rollback
    $note = @(
        ('{0} database restore point before the refresh of {1}, {2}' -f $site.ToUpper(), $name, (Get-Date -Format 'yyyy-MM-dd HH:mm')),
        ('bookmark: {0}' -f $bm.Value),
        ('{0} values changed and {1} products hidden by this refresh.' -f $nChanges, $nHides),
        'To go back, ONLY with approval, run in PowerShell one of:',
        ('  cd "{0}"' -f $script:Work),
        ('  A) only this refresh (old values back, hidden products shown again):  {0}' -f $undo),
        ('  B) the whole database as it was:  {0}' -f $restoreCmd),
        'B also undoes any other change made to the database after this moment. Valid for 7 days (Free) or 30 days (Paid).'
    ) -join "`r`n"
    $backup = Join-Path $bdir ('{0}-restore-point-before-{1}-refresh-{2}.txt' -f $site, $key, $stamp)
    [System.IO.File]::WriteAllText($backup, $note, (New-Object System.Text.UTF8Encoding($false)))
    Say ('Σημείο επαναφοράς: {0}' -f $backup) 'Green'

    # 5. Load. Every statement sets fixed values by id, so repeating a file after a network error is safe.
    $stopped = $false
    $summary = [System.IO.File]::ReadAllText((Join-Path $dir 'summary.json'), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
    foreach ($uf in @($summary.updateFiles)) {
        $x = Invoke-Wrangler ('d1 execute {0} --remote --file "{1}"' -f $script:DbName, (Join-Path $dir $uf)) -Retry
        if ($x.code -ne 0) { Say ('Λάθος στο {0}. Σταμάτησα. Τα προηγούμενα αρχεία φορτώθηκαν.' -f $uf) 'Red'; Say $x.text; Say ('Επαναφορά (μόνο με έγκριση): {0}' -f $undo); $stopped = $true; break }
        Write-Host ('  {0} OK' -f $uf)
    }
    if ($stopped) { $exitCode = 12; continue }
    if ($nHides -gt 0) {
        $x = Invoke-Wrangler ('d1 execute {0} --remote --file "{1}"' -f $script:DbName, (Join-Path $dir 'hide.sql')) -Retry
        if ($x.code -ne 0) { Say 'Λάθος στην απόκρυψη. Οι τιμές, οι εικόνες και το απόθεμα φορτώθηκαν.' 'Red'; Say $x.text; Say ('Επαναφορά (μόνο με έγκριση): {0}' -f $undo); $exitCode = 12; continue }
    }
    $budget = $budget - $writes

    # 6. Check.
    $after = Select-Raw ('SELECT COUNT(*) AS n FROM products WHERE retailer = {0} AND is_active = 1' -f $sqlName)
    if ($null -ne $after) {
        $now = [int]$after.rows[0].n
        if ($now -eq ($activeBefore - $nHides)) { Say ('ΕΤΟΙΜΟ: {0} αλλαγές, {1} κρυμμένα. Ενεργά τώρα: {2}.' -f $nChanges, $nHides, $now) 'Green' }
        else { Say ('ΠΡΟΣΟΧΗ: ενεργά τώρα {0}, περίμενα {1}. Στείλε την αναφορά στο Claude.' -f $now, ($activeBefore - $nHides)) 'Yellow'; $exitCode = 13 }
    }
    Say ('Επαναφορά μόνο αυτής της ανανέωσης (μόνο με έγκριση): {0}' -f $undo)
    Say ('Επαναφορά όλης της βάσης όπως ήταν (μόνο με έγκριση): {0}' -f $restoreCmd)
}
Say ''
Say ('Σχέδια και αρχεία: {0}' -f $planRoot)
Finish $exitCode
