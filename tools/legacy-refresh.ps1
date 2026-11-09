<#
.SYNOPSIS
  Refreshes price, picture and stock of retailers that are ALREADY on the older Gear World sites (CGW, MGW, WGW, KGW,
  HGW, GGW) from the Awin feeds on this PC, hides their products that are no longer in the feed, and gives every
  product the feed still confirms the time of the feed as its "Price checked" date (lessons L108).

.DESCRIPTION
  Two ways to run it:

  -Pairs "reidl:cgw,tooled-up:cgw": shop and site, the shop as its name on the site written with dashes (Tooled Up ->
  tooled-up, WATCH & WATCH -> watch-watch). The feed is found by its merchant_name in the Awin archive
  (Downloads\GW_AWIN_BULK_ARCHIVE), or with -Advertiser <id> when only one pair is given. With -Apply, EACH pair asks
  its own approval phrase (ΕΓΚΡΙΝΩ REFRESH <SHOP> <SITE>, e.g. ΕΓΚΡΙΝΩ REFRESH REIDL CGW).

  -Stale [-Sites cgw,hgw] [-OlderThanDays 7] (lessons L108, one paste for the owner): every shop of these sites (default
  all six) that has active products not checked for more than -OlderThanDays days (default 7, so a weekly run keeps
  everything under the 14-day "Check price and stock at the retailer"). Read-only part: one read per site of the active
  products grouped by shop (with how many are older than 7, 14 and 30 days), one paged read of the site's active rows
  for all its shops, the feed of each shop in the archive (by its name, or by the Awin advertiser id of its links), and
  per shop what WOULD change, with how many products would be shown again. -Stale never hides a product: one the feed
  does not confirm gets no date, and the sites stop listing it after 30 days on their own. With -Apply ONE phrase for the whole run,
  ΕΓΚΡΙΝΩ REFRESH ΠΑΛΙΑ ΠΡΟΪΟΝΤΑ: first fresh feeds for just those shops with tools/awin-feed-download.ps1 (it keeps
  the Awin feed key encrypted for your Windows user and asks for it only if it is missing; the key is never shown or
  written anywhere), then the refresh of every shop. A shop whose feed is not found, not downloaded or too old is
  skipped and listed; it never stops the run.

  Without -Apply: READ-ONLY. Reads the site database (the shop's active products, the table's indexes and triggers)
  and the feed, and shows what WOULD change: prices, pictures and stock that differ, products no longer in the feed,
  prices that jump more than 3 times (not changed, listed), the products the feed confirms (they get the time of the
  feed as their date) and the rows that D1 would read and write. Changes nothing.

  With -Apply:
    1. Takes a Cloudflare Time Travel restore point (per database) and saves a rollback file with the old values
       (dates too) on this PC.
    2. Loads small SQL files (at most 50 statements and 5,000 rows written each) with a pause of -PauseSeconds
       (default 3) between them: a big file keeps the database busy and the site answers with short 500 errors.
       Best at a quiet time (late in the evening, UK time).
    3. Counts the shop's active products again.
  The date written is the time the feed file was downloaded (its time on this PC), never the time of the run. A feed
  file downloaded more than 2 days ago writes no date (with -Stale the shop then changes nothing). A feed not updated
  for more than 30 days changes nothing (lessons L39). A feed missing more than half of the active products hides
  nothing. Hidden products, products not in the feed and prices held back get no date. Rows written in D1 stay under
  -MaxWrites (default 90,000 for the whole run: Workers Free allows 100,000 a day, lessons L49); what is left waits
  for the next run. -PaidPlan: Workers Paid, up to 1,000,000 per run.
  It changes ONLY the products of these shops in these sites' databases. No code, no other shop, no deploy.

  Rollback (printed in Greek): the rollback files put back the old values and dates and show the hidden products
  again; or the restore point of the whole database.
  Report: <home>\gear-world-reports\REFRESH_<time>.txt (also copied to the clipboard)
#>
[CmdletBinding()]
param(
    [string]$Pairs = '',
    [switch]$Stale,
    [string]$Sites = '',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Archive = '',
    [string]$Advertiser = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [int]$MaxWrites = 90000,
    [switch]$PaidPlan,
    [int]$PauseSeconds = 3,
    [int]$OlderThanDays = 7,
    [string]$FeedKeyFile = '',
    [string]$AwinBaseUrl = '',
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
$SiteOrder = @('cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw')
# The one phrase of the -Stale run (lessons L108). It also approves the feed download of that run, which the download
# tool gets with its own phrase in the Latin form it accepts.
$StalePhrase = 'ΕΓΚΡΙΝΩ REFRESH ΠΑΛΙΑ ΠΡΟΪΟΝΤΑ'
$DownloadPhrase = 'EGKRINO FEED DOWNLOAD'
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$budget = [long]$MaxWrites
if ($PaidPlan -and $MaxWrites -eq 90000) { $budget = 1000000 }
if ($PauseSeconds -lt 0) { $PauseSeconds = 0 }
$exe = (Get-Process -Id $PID).Path
$script:DbName = ''
$script:Work = ''
$script:Site = ''
$script:RowsRead = @{}
$script:RowsWritten = @{}
$script:Schema = @{}
$script:SiteRows = @{}

$L = New-Object System.Collections.Generic.List[string]
# The report is written line by line as the run goes (lessons L108): a run stopped with Ctrl+C still leaves it, with
# where its backups are. Finish writes it once more in full and copies it to the clipboard.
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$script:ReportFile = Join-Path $OutDir ('REFRESH_{0}.txt' -f $stamp)
$rn = 2
while (Test-Path -LiteralPath $script:ReportFile) { $script:ReportFile = Join-Path $OutDir ('REFRESH_{0}_{1}.txt' -f $stamp, $rn); $rn++ }
$script:ReportStarted = $false
function Add-ReportLine([string]$text) {
    $L.Add($text)
    try {
        if ($script:ReportStarted) { [System.IO.File]::AppendAllText($script:ReportFile, $text + "`r`n", (New-Object System.Text.UTF8Encoding($false))) }
        else { [System.IO.File]::WriteAllText($script:ReportFile, $text + "`r`n", (New-Object System.Text.UTF8Encoding($true))); $script:ReportStarted = $true }
    } catch { }
}
function Say([string]$text, [string]$color = '') {
    Add-ReportLine $text
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Finish([int]$code) {
    $file = $script:ReportFile
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
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        }
        $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
        $result = @{ code = $code; text = $text }
        $network = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|code: 7403|code: 10000|Not currently importing anything'
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

function Add-Count($table, [string]$key, [long]$n) {
    if (-not $table.ContainsKey($key)) { $table[$key] = [long]0 }
    $table[$key] = [long]$table[$key] + $n
}
function Count-Of($table, [string]$key) {
    $v = 0
    if ($table.ContainsKey($key)) { $v = $table[$key] }
    return $v
}

# Read-only SELECT. Returns @{ rows; text; read } or $null on error. The rows D1 read are added to the site's count.
function Select-Raw([string]$sql) {
    if ($sql -notmatch '^\s*SELECT ') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler ('d1 execute {0} --remote --json --command "{1}"' -f $script:DbName, $sql) -Retry
    if ($r.code -ne 0) { Say $r.text; return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { Say $r.text; return $null }
    $read = [long]0
    try { if ($null -ne $j[0].meta -and $null -ne $j[0].meta.rows_read) { $read = [long]$j[0].meta.rows_read } } catch { $read = [long]0 }
    Add-Count $script:RowsRead $script:Site $read
    return @{ rows = @($j[0].results); text = $r.text; read = $read }
}

# The shop's name as an SQL text: an ampersand is written with char(38) (the command goes through cmd.exe).
function Sql-Name([string]$name) {
    $q = $name.Replace("'", "''")
    if ($q.Contains('&')) { return ("replace('{0}', '~', char(38))" -f $q.Replace('&', '~')) }
    return ("'{0}'" -f $q)
}
function Key-Of([string]$s) { return (($s.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')) }
function Fmt($n) { return ([long]$n).ToString('N0', [System.Globalization.CultureInfo]::GetCultureInfo('en-GB')) }

function Use-Site([string]$site) {
    $script:Site = $site
    $script:DbName = $SiteInfo[$site].db
    $script:Work = $WorkDir
    if (-not $script:Work) {
        $script:Work = Join-Path $HOME $SiteInfo[$site].work
        if (-not (Test-Path -LiteralPath $script:Work)) { $script:Work = Join-Path $HOME 'gear-world-import' }
    }
    if (-not (Test-Path -LiteralPath $script:Work)) { New-Item -ItemType Directory -Path $script:Work -Force | Out-Null }
}

# The indexes and triggers of the products table (they decide the rows D1 writes, lessons L57, L108), read once per
# site (read-only). Returns the saved file, or '' on an error.
function Get-SchemaFile([string]$site, [string]$planRoot) {
    if ($script:Schema.ContainsKey($site)) { return $script:Schema[$site] }
    $idx = Select-Raw "SELECT type, name, sql FROM sqlite_master WHERE type IN ('index', 'trigger') AND tbl_name = 'products'"
    if ($null -eq $idx) { return '' }
    $f = Join-Path $planRoot ('{0}-schema.json.txt' -f $site)
    [System.IO.File]::WriteAllText($f, $idx.text, (New-Object System.Text.UTF8Encoding($false)))
    $script:Schema[$site] = $f
    return $f
}

# The shop's active products, 5,000 at a time by id (read-only; D1 reads about the shop's active rows once).
# Returns the list of saved files, or $null on an error.
function Save-Rows([string]$sqlName, [string]$dir) {
    $files = @()
    $last = 0
    for ($page = 1; $page -le 200; $page++) {
        $sql = ('SELECT id, awin_product_id, merchant_product_id, product_name, price, currency, stock_status, image_url, is_active, updated_at FROM products WHERE retailer = {0} AND is_active = 1 AND id BETWEEN {1} AND 2147483647 ORDER BY id LIMIT 5000' -f $sqlName, ($last + 1))
        $r = Select-Raw $sql
        if ($null -eq $r) { return $null }
        $f = Join-Path $dir ('rows-{0:D3}.json.txt' -f $page)
        [System.IO.File]::WriteAllText($f, $r.text, (New-Object System.Text.UTF8Encoding($false)))
        $files += $f
        if ($r.rows.Count -lt 5000) { break }
        $last = [long]($r.rows[$r.rows.Count - 1].id)
    }
    return , $files
}

# -Stale: ALL active rows of the site in one paged read by id (read-only, lessons L108), with their retailer, once for
# all its shops: D1 reads each active row once (CGW about 85,600) instead of a walk of the whole site per small shop.
# The plan keeps each shop's own rows. Returns the list of saved files (cached per site), or $null on an error.
function Get-SiteRows([string]$site) {
    if ($script:SiteRows.ContainsKey($site)) { return , $script:SiteRows[$site] }
    $dir = Join-Path $planRoot ('{0}-rows' -f $site)
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $files = @()
    $last = 0
    for ($page = 1; $page -le 400; $page++) {
        $sql = ('SELECT id, retailer, awin_product_id, merchant_product_id, product_name, price, currency, stock_status, image_url, is_active, updated_at FROM products WHERE is_active = 1 AND id BETWEEN {0} AND 2147483647 ORDER BY id LIMIT 5000' -f ($last + 1))
        $r = Select-Raw $sql
        if ($null -eq $r) { return $null }
        $f = Join-Path $dir ('rows-{0:D3}.json.txt' -f $page)
        [System.IO.File]::WriteAllText($f, $r.text, (New-Object System.Text.UTF8Encoding($false)))
        $files += $f
        if ($r.rows.Count -lt 5000) { break }
        $last = [long]($r.rows[$r.rows.Count - 1].id)
    }
    $script:SiteRows[$site] = $files
    return , $files
}

# The plan (read-only, tools/legacy-refresh-plan.mjs). Prints its report. Returns @{ code; summary }.
function Invoke-Plan([string]$site, [string]$name, [string]$dir, [string]$schemaFile, $rowFiles, [long]$maxW, [string]$adv, $feedFiles, [bool]$requireDates, [bool]$noHide) {
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $a = @((Join-Path (Join-Path $repo 'tools') 'legacy-refresh-plan.mjs'), '--archive', $Archive, '--retailer', $name, '--site', $site, '--indexes', $schemaFile, '--out', $dir, '--max-writes', [string]$maxW)
    if ($adv) { $a += @('--advertiser', $adv) }
    foreach ($ff in @($feedFiles)) { if ($ff) { $a += @('--feed-file', [string]$ff) } }
    if ($requireDates) { $a += '--require-dates' }
    if ($noHide) { $a += '--no-hide' }
    foreach ($f in @($rowFiles)) { $a += @('--rows', $f) }
    & node @a | Out-Null
    $code = $LASTEXITCODE
    $reportFile = Join-Path $dir 'report.txt'
    if (Test-Path -LiteralPath $reportFile) { foreach ($line in [System.IO.File]::ReadAllLines($reportFile, [System.Text.Encoding]::UTF8)) { if ($line -match '^ΠΡΟΣΟΧΗ') { Say $line 'Yellow' } else { Say $line } } }
    $summary = $null
    $sf = Join-Path $dir 'summary.json'
    if ($code -eq 0 -and (Test-Path -LiteralPath $sf)) { $summary = [System.IO.File]::ReadAllText($sf, [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
    return @{ code = $code; summary = $summary }
}

# The restore point of the site's database (Cloudflare Time Travel). Returns the bookmark or ''.
function Get-Bookmark() {
    $tt = Invoke-Wrangler ('d1 time-travel info {0}' -f $script:DbName) -Retry
    $bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
    if ($tt.code -ne 0 -or -not $bm.Success) { Say $tt.text; return '' }
    return $bm.Value
}

# Saves the rollback and the restore point note, loads the plan's small files with a pause between them and counts
# the shop's active products again. Returns 0, 12 (a file failed: stop) or 13 (the count is not the expected one).
function Invoke-Load([string]$site, [string]$key, [string]$name, [string]$dir, $summary, [string]$bookmark) {
    $bdir = Join-Path $script:Work 'backups'
    if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
    $rollback = Join-Path $bdir ('{0}-refresh-{1}-{2}-rollback.sql' -f $site, $key, $stamp)
    Copy-Item -LiteralPath (Join-Path $dir 'rollback.sql') -Destination $rollback -Force
    Copy-Item -LiteralPath (Join-Path $dir 'hidden-ids.txt') -Destination ($rollback -replace 'rollback\.sql$', 'hidden-ids.txt') -Force
    $rbDir = Join-Path $bdir ('{0}-refresh-{1}-{2}-rollback' -f $site, $key, $stamp)
    if (-not (Test-Path -LiteralPath $rbDir)) { New-Item -ItemType Directory -Path $rbDir -Force | Out-Null }
    foreach ($rf in @($summary.rollbackFiles)) { if ($rf) { Copy-Item -LiteralPath (Join-Path $dir $rf) -Destination (Join-Path $rbDir $rf) -Force } }
    $restoreCmd = 'npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $script:DbName, $bookmark
    $undoParts = 'Get-ChildItem -LiteralPath "{0}" -Filter ''rollback-*.sql'' | Sort-Object Name | ForEach-Object {{ npx wrangler d1 execute {1} --remote --file $_.FullName --yes; Start-Sleep -Seconds 3 }}' -f $rbDir, $script:DbName
    $undo = 'npx wrangler d1 execute {0} --remote --file "{1}" --yes' -f $script:DbName, $rollback
    $note = @(
        ('{0} database restore point before the refresh of {1}, {2}' -f $site.ToUpper(), $name, (Get-Date -Format 'yyyy-MM-dd HH:mm')),
        ('bookmark: {0}' -f $bookmark),
        ('{0} values changed, {1} products hidden and {2} products dated by this refresh (date {3} UTC).' -f $summary.changes, $summary.hides, $summary.seen, $summary.stamp),
        'To go back, ONLY with approval, run in PowerShell one of:',
        ('  cd "{0}"' -f $script:Work),
        ('  A) only this refresh, in small parts (old values and dates back, hidden products shown again):  {0}' -f $undoParts),
        ('     or in one file:  {0}' -f $undo),
        ('  B) the whole database as it was:  {0}' -f $restoreCmd),
        'B also undoes any other change made to the database after this moment. Valid for 7 days (Free) or 30 days (Paid).',
        '',
        'Επαναφορά (μόνο με έγκριση), στο PowerShell:',
        ('  Α) μόνο αυτή η ανανέωση, σε μικρά κομμάτια με παύση: cd "{0}"; {1}' -f $script:Work, $undoParts),
        ('  Β) όλη η βάση όπως ήταν πριν: cd "{0}"; {1}' -f $script:Work, $restoreCmd),
        'Το Β αναιρεί και κάθε άλλη αλλαγή της βάσης μετά από αυτή τη στιγμή.'
    ) -join "`r`n"
    $backup = Join-Path $bdir ('{0}-restore-point-before-{1}-refresh-{2}.txt' -f $site, $key, $stamp)
    [System.IO.File]::WriteAllText($backup, $note, (New-Object System.Text.UTF8Encoding($true)))
    Say ('Σημείο επαναφοράς: {0}' -f $backup) 'Green'

    # Every statement sets fixed values by id, so repeating a file after a network error is safe.
    $files = @($summary.files)
    $i = 0
    foreach ($uf in $files) {
        $i++
        $x = Invoke-Wrangler ('d1 execute {0} --remote --file "{1}"' -f $script:DbName, (Join-Path $dir $uf.name)) -Retry
        $m = [regex]::Match($x.text, '\((\d+) rows read, (\d+) rows written\)')
        if ($m.Success) { Add-Count $script:RowsRead $site ([long]$m.Groups[1].Value); Add-Count $script:RowsWritten $site ([long]$m.Groups[2].Value) }
        else { Add-Count $script:RowsWritten $site ([long]$uf.writes) }
        if ($x.code -ne 0) {
            Say ('Λάθος στο {0} ({1}/{2}). Σταμάτησα. Τα προηγούμενα αρχεία φορτώθηκαν.' -f $uf.name, $i, $files.Count) 'Red'
            Say $x.text
            Say ('Επαναφορά (μόνο με έγκριση): cd "{0}"; {1}' -f $script:Work, $undoParts)
            return 12
        }
        Write-Host ('  {0} OK ({1}/{2})' -f $uf.name, $i, $files.Count)
        if ($PauseSeconds -gt 0 -and $i -lt $files.Count) { Start-Sleep -Seconds $PauseSeconds }
    }
    $code = 0
    $after = Select-Raw ('SELECT COUNT(*) AS n FROM products WHERE retailer = {0} AND is_active = 1' -f (Sql-Name $name))
    if ($null -ne $after) {
        $now = [long]$after.rows[0].n
        $want = [long]$summary.active - [long]$summary.hides
        if ($now -eq $want) { Say ('ΕΤΟΙΜΟ: {0} αλλαγές, {1} κρυμμένα, {2} με νέα ημερομηνία. Ενεργά τώρα: {3}.' -f $summary.changes, $summary.hides, $summary.seen, $now) 'Green' }
        else { Say ('ΠΡΟΣΟΧΗ: ενεργά τώρα {0}, περίμενα {1}. Στείλε την αναφορά στο Claude.' -f $now, $want) 'Yellow'; $code = 13 }
    }
    Say ('Επαναφορά μόνο αυτής της ανανέωσης (μόνο με έγκριση): cd "{0}"; {1}' -f $script:Work, $undoParts)
    Say ('Επαναφορά όλης της βάσης όπως ήταν (μόνο με έγκριση): cd "{0}"; {1}' -f $script:Work, $restoreCmd)
    return $code
}

$quietTip = 'Συμβουλή: τρέξε το -Apply σε ήσυχη ώρα (αργά το βράδυ, ώρα Αγγλίας): κάθε μικρό αρχείο κρατά τη βάση απασχολημένη λίγο, και ανάμεσα στα αρχεία υπάρχει παύση {0} δευτερολέπτων, ώστε το site να απαντά κανονικά.' -f $PauseSeconds

Write-Host ''
$mode = 'ΔΟΚΙΜΗ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ'
if ($Apply -and $Stale) { $mode = 'ΑΝΑΝΕΩΣΗ - μία φράση έγκρισης για όλη την εκτέλεση' }
elseif ($Apply) { $mode = 'ΑΝΑΝΕΩΣΗ - κάθε κατάστημα ζητά τη δική του φράση έγκρισης' }
$what = 'Ανανέωση τιμών, εικόνων και αποθέματος'
if ($Stale) { $what = 'Ανανέωση των καταστημάτων με παλιά προϊόντα (-Stale)' }
Say ('{0} - {1}' -f $what, $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))

if ($Stale -and $Pairs) { Say 'Δώσε ή -Pairs ή -Stale, όχι και τα δύο.' 'Red'; Finish 2 }
if (-not $Stale -and -not $Pairs) { Say 'Δώσε -Pairs "κατάστημα:site" ή -Stale (όλα τα καταστήματα με παλιά προϊόντα).' 'Red'; Finish 2 }
if ($Sites -and -not $Stale) { Say '-Sites μόνο μαζί με -Stale.' 'Red'; Finish 2 }
if ($Advertiser -and $Stale) { Say '-Advertiser μόνο με -Pairs.' 'Red'; Finish 2 }

$list = @()
$siteList = @()
if ($Stale) {
    $wanted = @($Sites -split '[,\s]+' | Where-Object { $_ } | ForEach-Object { $_.Trim().ToLower() })
    if ($wanted.Count -eq 0) { $wanted = $SiteOrder }
    foreach ($s in $wanted) { if (-not $SiteInfo.ContainsKey($s)) { Say ('Λάθος site: {0} (cgw, mgw, wgw, kgw, hgw, ggw)' -f $s) 'Red'; Finish 2 } }
    $siteList = @($SiteOrder | Where-Object { $wanted -contains $_ })
} else {
    foreach ($p in ($Pairs -split ',')) {
        $t = $p.Trim().ToLower()
        if (-not $t) { continue }
        if ($t -notmatch '^[a-z0-9\-]{2,60}:(cgw|mgw|wgw|kgw|hgw|ggw)$') { Say ('Λάθος ζευγάρι κατάστημα:site: {0}' -f $p) 'Red'; Finish 2 }
        $list += $t
    }
    if ($list.Count -lt 1) { Say 'Δεν δόθηκε κανένα ζευγάρι κατάστημα:site.' 'Red'; Finish 2 }
    if ($Advertiser -and ($list.Count -ne 1 -or $Advertiser -notmatch '^\d{1,9}$')) { Say '-Advertiser μόνο με ΕΝΑ ζευγάρι και μόνο αριθμός.' 'Red'; Finish 2 }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js.' 'Red'; Finish 3 }

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
if (-not $Archive -or -not (Test-Path -LiteralPath $Archive)) { Say 'Δεν βρήκα τον φάκελο με τα feeds του Awin.' 'Red'; Finish 2 }
Say ('Feeds: {0}' -f $Archive)
Say ('Όριο εγγραφών D1 για όλη την εκτέλεση: {0}' -f (Fmt $budget))

$planRoot = Join-Path $OutDir ('REFRESH_PLAN_{0}' -f $stamp)
New-Item -ItemType Directory -Path $planRoot -Force | Out-Null
$exitCode = 0

# The feed of every shop, in one pass over the archive (read-only).
function Find-Feeds([string]$tag) {
    # One line per shop: its name and, after a TAB, one of its affiliate links (the Awin advertiser id in it finds the
    # feed when no feed has the shop's name as its merchant_name).
    $lines = @()
    $seenNames = @{}
    foreach ($sh in $shopsAll) {
        if ($seenNames.ContainsKey($sh.name)) { continue }
        $seenNames[$sh.name] = $true
        $lines += ($sh.name + "`t" + [string]$sh.aurl)
    }
    $by = @{}
    if ($lines.Count -eq 0) { return $by }
    $nf = Join-Path $planRoot ('shops-{0}.txt' -f $tag)
    [System.IO.File]::WriteAllText($nf, ($lines -join "`r`n") + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
    $fo = Join-Path $planRoot ('feeds-{0}' -f $tag)
    & node (Join-Path (Join-Path $repo 'tools') 'legacy-refresh-plan.mjs') --find --archive $Archive --retailers-file $nf --out $fo | Out-Null
    $ff = Join-Path $fo 'feeds.json'
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $ff)) { return $by }
    # -InputObject, not the pipeline: Windows PowerShell 5.1 sends a JSON array down the pipeline as ONE object.
    $parsed = ConvertFrom-Json -InputObject ([System.IO.File]::ReadAllText($ff, [System.Text.Encoding]::UTF8))
    foreach ($x in $parsed) { $k = [string]$x.retailer; $by[$k] = $x }
    return $by
}

# Plans every shop with the remaining budget (read-only) into $script:PlanOut. $readRows: read the rows from D1 again.
function Plan-All($tag, $feedBy, $readRows) {
    $left = $budget
    $script:PlanOut = @()
    foreach ($site in $siteList) {
        if (-not $siteOk.ContainsKey($site)) { continue }
        $mine = @($shopsAll | Where-Object { $_.site -eq $site })
        if ($mine.Count -eq 0) { continue }
        Use-Site $site
        $schemaFile = Get-SchemaFile $site $planRoot
        if (-not $schemaFile) { Say ('{0}: δεν μπόρεσα να διαβάσω τη δομή της βάσης. Αυτό το site δεν αλλάζει.' -f $site.ToUpper()) 'Red'; $script:exitCode = 4; continue }
        foreach ($shop in $mine) {
            $f = $null
            if ($feedBy.ContainsKey($shop.name)) { $f = $feedBy[$shop.name] }
            Say ''
            Say ('----- {0} στο {1} -----' -f $shop.name, $site.ToUpper()) 'Cyan'
            $shop.feed = $f
            $shop.dlOnly = $false
            if ($null -eq $f -or @($f.files).Count -eq 0) {
                $sim = ''
                if ($null -ne $f -and @($f.similar).Count -gt 0) { $sim = ' Παρόμοια: ' + (@($f.similar) -join '; ') }
                $ids = @()
                if ($null -ne $f) { $ids = @($f.advertisers) }
                if ($ids.Count -gt 0) {
                    # No feed on this PC, but the shop's links name its Awin advertiser: the -Apply run downloads it.
                    $shop.dlOnly = $true
                    $shop.reason = ('δεν βρέθηκε feed σε αυτόν τον υπολογιστή (με -Apply κατεβαίνει: Awin {0})' -f ($ids -join ', '))
                    if ($tag -eq 'apply') { $shop.reason = ('δεν βρέθηκε feed ούτε μετά τη λήψη (Awin {0})' -f ($ids -join ', ')) }
                    Say ('Δεν υπάρχει feed στο {0}. Από τα links του: Awin {1}: με -Apply κατεβαίνει πρώτα.' -f $Archive, ($ids -join ', ')) 'Yellow'
                } else {
                    Say ('Δεν βρέθηκε feed με αυτό το όνομα στο {0}: παραλείπεται.{1}' -f $Archive, $sim) 'Yellow'
                    $shop.reason = 'δεν βρέθηκε feed'
                }
                continue
            }
            if ($f.matchedBy -eq 'advertiser') { Say ('Το feed βρέθηκε από το Awin id των links του ({0}), γιατί το όνομα του feed είναι άλλο.' -f (@($f.advertisers) -join ', ')) }
            $shop.reason = ''
            if ($null -eq $shop.rows) {
                $rf = Get-SiteRows $site
                if ($null -eq $rf) { Say 'Δεν μπόρεσα να διαβάσω τα προϊόντα του site: παραλείπεται.' 'Red'; $shop.reason = 'δεν διαβάστηκε η βάση'; $script:exitCode = 4; continue }
                $shop.rows = $rf
                $shop.dir = Join-Path $planRoot ('{0}-{1}' -f $site, $shop.key)
                New-Item -ItemType Directory -Path $shop.dir -Force | Out-Null
            }
            $pdir = Join-Path $shop.dir $tag
            $names = @(@($f.files) | ForEach-Object { [string]$_.file })
            $p = Invoke-Plan $site $shop.name $pdir $schemaFile $shop.rows $left '' $names $true $true
            if ($p.code -ne 0 -or $null -eq $p.summary) { Say 'Το σχέδιο δεν έγινε (δες πιο πάνω): παραλείπεται.' 'Red'; $shop.reason = 'το σχέδιο δεν έγινε'; continue }
            $shop.plan = $p.summary
            $shop.pdir = $pdir
            $shop.oldFile = $false
            $left = $left - $p.summary.writes
            if ($p.summary.skip -eq 'old-file' -or $p.summary.skip -eq 'no-file-time') { $shop.reason = 'το αρχείο του feed είναι πάνω από 2 μερών (κατέβασέ το ξανά)'; $shop.oldFile = $true }
            elseif ($p.summary.skip -eq 'stale-feed') { $shop.reason = 'το feed έχει να ενημερωθεί πάνω από 30 μέρες (L39)' }
            $script:PlanOut += $shop
        }
    }
}

# The short Greek summary per site.
function Say-Summary($applied) {
    Say ''
    Say '===== Σύνοψη ανά site =====' 'Cyan'
    foreach ($site in $siteList) {
        $mine = @($shopsAll | Where-Object { $_.site -eq $site }) + @($skipped | Where-Object { $_.site -eq $site })
        $revive = 0
        $estimate = 0
        $sitePlanned = 0
        $still = @{}
        foreach ($s in $mine) {
            if ($null -ne $s.plan -and -not $s.reason) {
                $revive = $revive + $s.plan.visible.revive
                $sitePlanned = $sitePlanned + $s.plan.writes
                foreach ($st in @($s.plan.still)) { if ($null -ne $st -and [long]$st.n -gt 0) { Add-Count $still ([string]$st.text) ([long]$st.n) } }
            } else {
                if ($null -ne $s.plan) { $estimate = $estimate + $s.plan.visible.reviveIfFresh }
                $why = $s.reason
                if (-not $why) { $why = 'παραλείπεται' }
                if ([long]$s.d30 -gt 0) { Add-Count $still $why ([long]$s.d30) }
            }
        }
        $stillTxt = @($still.Keys | Sort-Object | ForEach-Object { '{0} {1}' -f (Fmt $still[$_]), $_ }) -join '; '
        if (-not $stillTxt) { $stillTxt = 'κανένα' }
        $verb = 'θα φαίνονται ξανά'
        if ($applied) { $verb = 'φαίνονται ξανά' }
        $line = '{0}: {1} {2} προϊόντα' -f $site.ToUpper(), $verb, (Fmt $revive)
        if ($estimate -gt 0) { $line += (' (και περίπου {0} ακόμα με φρέσκο feed)' -f (Fmt $estimate)) }
        $line += ('. Μένουν κρυμμένα: {0}.' -f $stillTxt)
        $line += (' Γραμμές D1: διαβάστηκαν {0}' -f (Fmt (Count-Of $script:RowsRead $site)))
        if ($applied) { $line += (', γράφτηκαν {0}.' -f (Fmt (Count-Of $script:RowsWritten $site))) }
        else { $line += (', θα γραφτούν περίπου {0}.' -f (Fmt $sitePlanned)) }
        if (-not $siteOk.ContainsKey($site)) { $line = '{0}: η βάση δεν διαβάστηκε, δεν άλλαξε τίποτα.' -f $site.ToUpper() }
        Say $line
    }
    $fromFeed = @($shopsAll | Where-Object { $null -ne $_.plan -and -not $_.reason -and $_.plan.stampFromFeed })
    if ($fromFeed.Count -gt 0) { Say ('Σε {0} καταστήματα η ημερομηνία είναι η νεότερη ενημέρωση του ίδιου του feed, παλιότερη από τη λήψη (ποτέ νεότερη από τα στοιχεία του καταστήματος): {1}.' -f $fromFeed.Count, ((@($fromFeed | ForEach-Object { '{0} {1}' -f $_.name, $_.site.ToUpper() })) -join ', ')) }
}

if (-not $Stale) {
    # ===== Per pair: each shop and site with its own phrase (as before L108). =====
    $n = 0
    foreach ($pair in $list) {
        $n++
        $parts = $pair -split ':'
        $key = $parts[0]
        $site = $parts[1]
        Use-Site $site
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

        # 2. Indexes and triggers (for the rows D1 writes) and the shop's active products (read-only).
        $dir = Join-Path $planRoot ('{0}-{1}' -f $site, $key)
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $schemaFile = Get-SchemaFile $site $planRoot
        if (-not $schemaFile) { Say 'Δεν μπόρεσα να διαβάσω τη δομή της βάσης. Δεν άλλαξε τίποτα.' 'Red'; $exitCode = 4; continue }
        $rowFiles = Save-Rows $sqlName $dir
        if ($null -eq $rowFiles) { Say 'Δεν μπόρεσα να διαβάσω τα προϊόντα του καταστήματος. Δεν άλλαξε τίποτα.' 'Red'; $exitCode = 4; continue }

        # 3. The plan (read-only).
        $plan = Invoke-Plan $site $name $dir $schemaFile $rowFiles $budget $Advertiser @() $false $false
        if ($plan.code -ne 0 -or $null -eq $plan.summary) { Say 'Το σχέδιο δεν έγινε (δες πιο πάνω). Δεν άλλαξε τίποτα.' 'Red'; if ($exitCode -eq 0) { $exitCode = 10 }; continue }
        $sm = $plan.summary
        $todo = [long]$sm.changes + [long]$sm.hides + [long]$sm.seen
        $phrase = 'ΕΓΚΡΙΝΩ REFRESH {0} {1}' -f $key.ToUpper(), $site.ToUpper()
        if ($sm.stale -or $todo -eq 0) {
            if (-not $sm.stale) { Say 'Τίποτα να αλλάξει.' 'Green' }
            continue
        }
        Say ('Αρχεία SQL: {0} (το πολύ 50 εντολές και 5.000 εγγραφές το καθένα).' -f @($sm.files).Count)
        if (-not $Apply) { Say ('Δοκιμή μόνο: δεν άλλαξε τίποτα. Η φράση έγκρισης: {0}' -f $phrase) 'Green'; Say $quietTip; continue }
        if (-not (Confirm-Approval $phrase)) { Say 'Δεν δόθηκε έγκριση: δεν άλλαξε τίποτα σε αυτό το κατάστημα.' 'Yellow'; if ($exitCode -eq 0) { $exitCode = 1 }; continue }

        # 4. Backup: Time Travel restore point, then the rollback file, then the small files.
        $bm = Get-Bookmark
        if (-not $bm) { Say 'Δεν πήρα σημείο επαναφοράς: ΔΕΝ άλλαξα τίποτα.' 'Red'; $exitCode = 11; continue }
        $code = Invoke-Load $site $key $name $dir $sm $bm
        if ($code -ne 0) { $exitCode = $code }
        if ($code -ne 12) { $budget = $budget - [long]$sm.writes }
    }
    Say ''
    Say ('Σχέδια και αρχεία: {0}' -f $planRoot)
    Finish $exitCode
}

try {
    # ===== -Stale: every shop of the chosen sites with products not checked for more than 14 days (lessons L108). =====
    $utc = (Get-Date).ToUniversalTime()
    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $d30 = $utc.AddDays(-30).ToString('yyyy-MM-dd', $inv)
    $d14 = $utc.AddDays(-14).ToString('yyyy-MM-dd', $inv)
    if ($OlderThanDays -lt 1 -or $OlderThanDays -gt 30) { Say '-OlderThanDays από 1 έως 30.' 'Red'; Finish 2 }
    $dSel = $utc.AddDays(-$OlderThanDays).ToString('yyyy-MM-dd', $inv)
    Say ('Sites: {0}' -f (($siteList | ForEach-Object { $_.ToUpper() }) -join ', '))
    Say ('Παλιά: τιμή ελεγμένη πριν από {0} («Check price and stock at the retailer», 14 μέρες) και πριν από {1} (δεν φαίνεται, 30 μέρες).' -f $d14, $d30)
    Say ('Επιλογή: καταστήματα με ενεργά προϊόντα ελεγμένα πριν από {0} (πάνω από {1} μέρες, -OlderThanDays {1}), ώστε μια ανανέωση κάθε εβδομάδα να τα κρατά κάτω από τις 14.' -f $dSel, $OlderThanDays)
    Say ('Η αναφορά γράφεται συνέχεια εδώ (μένει και αν σταματήσει η εκτέλεση): {0}' -f $script:ReportFile)
    # Plain arrays: Windows PowerShell 5.1 stops on @( <generic List> ) with "Argument types do not match" (L108).
    $shopsAll = @()
    $skipped = @()
    $siteOk = @{}
    foreach ($site in $siteList) {
        Use-Site $site
        Say ''
        Say ('===== {0} ({1}) =====' -f $site.ToUpper(), $SiteInfo[$site].domain) 'Cyan'
        # One read of the active rows, grouped by shop. MIN(x, day) != day is "x before day" without < or > (the command
        # goes through cmd.exe); a missing date counts as old, as on the sites.
        # MIN(affiliate_url): one link of the shop (its Awin advertiser id finds a feed with another name), no extra rows.
        $q = "SELECT retailer, COUNT(*) AS n, SUM(MIN(COALESCE(updated_at, ''), '$d14') != '$d14') AS d14, SUM(MIN(COALESCE(updated_at, ''), '$d30') != '$d30') AS d30, SUM(MIN(COALESCE(updated_at, ''), '$dSel') != '$dSel') AS dsel, MIN(affiliate_url) AS aurl FROM products WHERE is_active = 1 GROUP BY retailer"
        $r = Select-Raw $q
        if ($null -eq $r) { Say 'Δεν μπόρεσα να διαβάσω τη βάση (σύνδεση στο Cloudflare;). Αυτό το site δεν αλλάζει.' 'Red'; $exitCode = 4; continue }
        $siteOk[$site] = $true
        $tot = 0
        $t14 = 0
        $t30 = 0
        $tSel = 0
        foreach ($row in @($r.rows | Sort-Object -Property d30, d14 -Descending)) {
            $nm = [string]$row.retailer
            $n14 = 0 + $row.d14
            $n30 = 0 + $row.d30
            $nSel = 0 + $row.dsel
            $tot = $tot + $row.n
            $t14 = $t14 + $n14
            $t30 = $t30 + $n30
            $tSel = $tSel + $nSel
            if ($nSel -le 0) { continue }
            Say ('  {0}: ενεργά {1}, πάνω από 14 μέρες {2}, πάνω από 30 μέρες (δεν φαίνονται) {3}, πάνω από {4} μέρες {5}' -f $nm, (Fmt $row.n), (Fmt $n14), (Fmt $n30), $OlderThanDays, (Fmt $nSel))
            $shop = @{ site = $site; name = $nm; key = (Key-Of $nm); n = $row.n; d14 = $n14; d30 = $n30; dsel = $nSel; aurl = [string]$row.aurl; feed = $null; plan = $null; dir = ''; rows = $null; reason = ''; oldFile = $false; dlOnly = $false; loaded = $false; pdir = '' }
            if ($nm -match '[|<>^%~"]') { $shop.reason = 'το όνομα έχει χαρακτήρες που δεν περνούν με ασφάλεια'; $skipped += $shop; continue }
            $shopsAll += $shop
        }
        Say ('  Σύνολο {0}: ενεργά {1}, πάνω από 14 μέρες {2}, πάνω από 30 μέρες {3}. Γραμμές D1 που διαβάστηκαν: {4}. Πάνω από {5} μέρες: {6}.' -f $site.ToUpper(), (Fmt $tot), (Fmt $t14), (Fmt $t30), (Fmt $r.read), $OlderThanDays, (Fmt $tSel))
    }

    if ($shopsAll.Count -eq 0) {
        Say ''
        Say 'Κανένα κατάστημα με παλιά προϊόντα: τίποτα να γίνει.' 'Green'
        Say-Summary $false
        Finish $exitCode
    }

    # 1. Read-only: the feeds on this PC and the plan of every shop with them.
    $feedBy = Find-Feeds 'now'
    Plan-All 'plan' $feedBy $true
    $planned = $script:PlanOut
    $ready = @($planned | Where-Object { -not $_.reason })
    $advs = @($shopsAll | Where-Object { $null -ne $_.feed } | ForEach-Object { @($_.feed.advertisers) } | Where-Object { $_ } | Sort-Object -Unique)
    $nFiles = 0
    foreach ($s in $ready) { $nFiles = $nFiles + @($s.plan.files).Count }
    Say ''
    Say '===== Σχέδιο =====' 'Cyan'
    Say ('Καταστήματα με παλιά προϊόντα: {0}. Με feed σε αυτόν τον υπολογιστή: {1}. Έτοιμα τώρα (feed έως 2 μερών): {2}.' -f ($shopsAll.Count + $skipped.Count), $planned.Count, $ready.Count)
    foreach ($s in @($planned | Where-Object { $_.oldFile })) { Say ('  με -Apply κατεβαίνει πρώτα φρέσκο feed: {0} στο {1} (περίπου {2} θα φαίνονταν ξανά)' -f $s.name, $s.site.ToUpper(), (Fmt $s.plan.visible.reviveIfFresh)) }
    foreach ($s in @($shopsAll | Where-Object { $_.dlOnly })) { Say ('  με -Apply κατεβαίνει πρώτη φορά το feed (Awin {0}): {1} στο {2}' -f (@($s.feed.advertisers) -join ', '), $s.name, $s.site.ToUpper()) }
    foreach ($s in @($shopsAll | Where-Object { $_.reason -and -not $_.oldFile -and -not $_.dlOnly }) + $skipped) { Say ('  παραλείπεται: {0} στο {1}: {2}' -f $s.name, $s.site.ToUpper(), $s.reason) 'Yellow' }
    Say 'Σε αυτή τη λειτουργία κανένα προϊόν δεν κρύβεται: όσα δεν επιβεβαιώνει το feed δεν παίρνουν ημερομηνία και φεύγουν μόνα τους από τα sites στις 30 μέρες.'
    if ($advs.Count -gt 0) { Say ('Με -Apply κατεβαίνουν πρώτα φρέσκα feeds για {0} καταστήματα του Awin: {1} (μόνο αρχεία στον υπολογιστή, με το tools/awin-feed-download.ps1).' -f $advs.Count, ($advs -join ', ')) }
    Say ('Η φράση έγκρισης (ΜΙΑ για όλη την εκτέλεση: λήψη των feeds και ανανέωση όλων των καταστημάτων): {0}' -f $StalePhrase)
    Say $quietTip
    Say-Summary $false
    if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο: δεν άλλαξε τίποτα και δεν κατέβηκε τίποτα.' 'Green'; Finish $exitCode }
    if ($planned.Count -eq 0 -and $advs.Count -eq 0) { Say ''; Say 'Κανένα κατάστημα δεν έχει feed σε αυτόν τον υπολογιστή ή Awin id για λήψη: δεν γίνεται τίποτα.' 'Yellow'; Finish $exitCode }
    if (-not (Confirm-Approval $StalePhrase)) { Say 'Δεν δόθηκε έγκριση: δεν άλλαξε τίποτα και δεν κατέβηκε τίποτα.' 'Yellow'; Finish 1 }

    # 2. Fresh feeds for just those shops (the download tool keeps the key encrypted and asks it only if it is missing).
    Say ''
    Say '===== Λήψη φρέσκων feeds =====' 'Cyan'
    $dlOut = Join-Path $planRoot 'download'
    $dlArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path (Join-Path $repo 'tools') 'awin-feed-download.ps1'), '-Advertiser', ($advs -join ','), '-Apply', '-Approve', $DownloadPhrase, '-Archive', $Archive, '-OutDir', $dlOut, '-NoClipboard')
    if ($FeedKeyFile) { $dlArgs += @('-KeyFile', $FeedKeyFile) }
    if ($AwinBaseUrl) { $dlArgs += @('-BaseUrl', $AwinBaseUrl) }
    & $exe @dlArgs
    $dlCode = $LASTEXITCODE
    foreach ($rep in @(Get-ChildItem -LiteralPath $dlOut -Filter 'AWIN_FEED_DOWNLOAD_*.txt' -ErrorAction SilentlyContinue)) {
        foreach ($line in [System.IO.File]::ReadAllLines($rep.FullName, [System.Text.Encoding]::UTF8)) { Add-ReportLine ('  ' + $line) }
    }
    if ($dlCode -ne 0) { Say ('ΠΡΟΣΟΧΗ: η λήψη των feeds τελείωσε με κωδικό {0}. Συνεχίζω μόνο με όσα feeds είναι έως 2 μερών.' -f $dlCode) 'Yellow' }

    # 3. The plan again with the fresh feeds (the rows already read), then the load, site by site.
    $feedBy = Find-Feeds 'fresh'
    Plan-All 'apply' $feedBy $false
    $final = $script:PlanOut
    $go = @($final | Where-Object { -not $_.reason -and ([long]$_.plan.changes + [long]$_.plan.hides + [long]$_.plan.seen) -gt 0 })
    $nFiles = 0
    foreach ($s in $go) { $nFiles = $nFiles + @($s.plan.files).Count }
    Say ''
    Say ('Φορτώνονται {0} καταστήματα σε {1} μικρά αρχεία, με παύση {2} δευτ. ανάμεσα (περίπου {3} λεπτά).' -f $go.Count, $nFiles, $PauseSeconds, [math]::Ceiling($nFiles * (10 + $PauseSeconds) / 60)) 'Cyan'
    $stopped = $false
    foreach ($site in $siteList) {
        if ($stopped) { break }
        $mine = @($go | Where-Object { $_.site -eq $site })
        if ($mine.Count -eq 0) { continue }
        Use-Site $site
        Say ''
        Say ('===== Φόρτωση {0} =====' -f $site.ToUpper()) 'Cyan'
        Say ('Αντίγραφα και αρχεία επαναφοράς αυτού του site: {0}' -f (Join-Path $script:Work 'backups'))
        $bm = Get-Bookmark
        if (-not $bm) { Say ('Δεν πήρα σημείο επαναφοράς για το {0}: ΔΕΝ άλλαξα τίποτα εκεί.' -f $site.ToUpper()) 'Red'; $exitCode = 11; foreach ($s in $mine) { $s.reason = 'δεν πάρθηκε σημείο επαναφοράς' }; continue }
        foreach ($s in $mine) {
            Say ('----- {0} στο {1} -----' -f $s.name, $site.ToUpper()) 'Cyan'
            $code = Invoke-Load $site $s.key $s.name $s.pdir $s.plan $bm
            if ($code -eq 12) {
                $s.reason = 'η φόρτωση σταμάτησε στη μέση (δες πιο πάνω)'
                $exitCode = 12
                $stopped = $true
                Say 'Σταμάτησα όλη την ανανέωση (για να μη φορτωθεί άλλο αρχείο σε βάση που δυσκολεύεται). Στείλε την αναφορά στο Claude.' 'Red'
                break
            }
            $s.loaded = $true
            if ($code -eq 13 -and $exitCode -eq 0) { $exitCode = 13 }
        }
    }
    foreach ($s in $go) { if (-not $s.loaded -and -not $s.reason) { $s.reason = 'δεν φορτώθηκε (σταμάτησε η εκτέλεση)' } }
    Say-Summary $true
    Say ''
    Say ('Σχέδια και αρχεία: {0}' -f $planRoot)
    Finish $exitCode
} catch {
    Say ('ΣΦΑΛΜΑ: {0}' -f $_.Exception.Message) 'Red'
    Say ([string]$_.InvocationInfo.PositionMessage)
    Say ([string]$_.ScriptStackTrace)
    Say 'Στείλε την αναφορά στο Claude. Ό,τι φορτώθηκε ήδη έχει σημείο και αρχείο επαναφοράς στο backups.' 'Red'
    Finish 20
}
