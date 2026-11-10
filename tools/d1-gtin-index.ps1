<#
.SYNOPSIS
  The barcode-search indexes of the 7 D1 databases that the group-key index of L105 does not cover (lessons L115): the 6
  older-layout sites (CGW, MGW, WGW, KGW, HGW, GGW) and Technology Gear World (TGW).
  Read-only unless -Apply and the typed approval phrase ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ BARCODE.

.DESCRIPTION
  The Gear World app scans a barcode and the Hub asks every site /api/products?gtin=<code>. Each site finds the code
  through an index on exactly the expression that src/db.js (gtinLookupKey) asks for; without it the same lookup reads
  the whole table (CGW-like data: about 171,000 rows per lookup instead of about 60; measured with
  tools/d1-view-bench.mjs --gtin):
    older layout   idx_products_group_key ON products(<LEGACY_GROUP_KEY>): the ean column, or the gtin in specs_json.
                   MGW, WGW, KGW, HGW and GGW have it since lessons L51 (their product pages use it): nothing to add there.
                   CGW groups its offers through product_group_offers and never had it: this tool adds it.
    TGW            idx_products_gtin ON products(gtin) (sites/tgw/migrations/0002_gtin_index.sql). TGW does not group
                   offers, so it has no group-key index (lessons L105).
  The 6 new-layout sites that group offers (AGW, VGW, SGW, BGW, PGW, ZGW) use their idx_products_group_key of L105
  (tools/d1-native-index.ps1): not here.

  Without -Apply: READ-ONLY. For each database it reads the schema (sqlite_master) and, where an index is missing, the
                  number of rows of products (one COUNT: D1 writes about one row per product for a new index), and shows
                  which indexes exist, what would be added, about how many rows D1 would write, and how to go back.
  With -Apply:    CHANGES ONLY THE DATABASES THAT LACK THEIR INDEX (only an index, never a table or a row, lessons L28),
                  one approval: ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ BARCODE. First the schema of every such database is saved to a dated
                  file (backup), then the index is added (CREATE INDEX IF NOT EXISTS: running it again changes nothing),
                  then it checks that the index is there with exactly this text.
                  Above 90,000 rows written in all it needs -PaidPlan (Cloudflare Workers Paid; Workers Free allows
                  100,000 a day for the whole account, lessons L49). On 10/11/2026: CGW about 98,700 + TGW about 34,700.
  -Verify         READ-ONLY. Exit 0 only when every database has its index with exactly this text, otherwise exit 9
                  (tools/ads-fixes-sites.ps1 runs this before it publishes the barcode code).
  -Only cgw,tgw   only these sites (codes, comma separated).
  Going back, IN THIS ORDER: 1. first the 13 sites back to the code before L115 (tools/ads-fixes-sites.ps1 -Step apply
              through gw-run with -Ref 573fc043704bab644e0c3533bda0637389f87876 and ΕΓΚΡΙΝΩ ADS FIXES); 2. only then, and
              ONLY on the databases where this tool added the index (the report and the backup note name them):
              npx wrangler d1 execute <database> --remote --command "DROP INDEX IF EXISTS <index>"
              NEVER on MGW, WGW, KGW, HGW or GGW: their idx_products_group_key is from L51 and their product pages need it.

  Files on this PC: <home>\gear-world-d1-gtin-index\ (deploy\<version> with wrangler, backups\)
  Report: <home>\gear-world-reports\D1_GTIN_INDEX_<CHECK|APPLY|VERIFY>_<time>.txt (also copied to the clipboard)
#>
param(
    [string]$Only = '',
    [switch]$Apply,
    [string]$Approve = '',
    [switch]$PaidPlan,
    [switch]$Verify,
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ BARCODE'
# Exactly LEGACY_GROUP_KEY of src/db.js (the L51 index of the older databases) and the statement of
# sites/tgw/migrations/0002_gtin_index.sql (PLAIN_GTIN_KEY). The tests compare both texts with the code.
$LegacyIndex = 'idx_products_group_key'
$LegacySql = 'CREATE INDEX IF NOT EXISTS idx_products_group_key ON products(COALESCE(NULLIF(TRIM(COALESCE(NULLIF(TRIM(ean), ''''), json_extract(specs_json, ''$.gtin''))), ''''), ''id:'' || id));'
$PlainIndex = 'idx_products_gtin'
$PlainSql = 'CREATE INDEX IF NOT EXISTS idx_products_gtin ON products(gtin);'
$FreeWriteLimit = 90000
# The sites' code before L115: going back publishes it FIRST, and only then drops an index this tool added.
$PrevRef = '573fc043704bab644e0c3533bda0637389f87876'
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-d1-gtin-index' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
# Colours without red and green (lessons L35): cyan = OK, yellow = attention, magenta = problem.
$Ok = 'Cyan'
$Warn = 'Yellow'
$Bad = 'Magenta'

# The databases whose barcode lookup is not served by the L105 index. l51 = the index is there since L51 (never dropped).
$Sites = @(
    @{ code = 'cgw'; db = 'construction-gear-customers'; index = $LegacyIndex; sql = $LegacySql; l51 = $false },
    @{ code = 'mgw'; db = 'mens-gear-world'; index = $LegacyIndex; sql = $LegacySql; l51 = $true },
    @{ code = 'wgw'; db = 'womens-gear-world'; index = $LegacyIndex; sql = $LegacySql; l51 = $true },
    @{ code = 'kgw'; db = 'kids-gear-world'; index = $LegacyIndex; sql = $LegacySql; l51 = $true },
    @{ code = 'hgw'; db = 'home-gear-world'; index = $LegacyIndex; sql = $LegacySql; l51 = $true },
    @{ code = 'ggw'; db = 'garden-gear-world'; index = $LegacyIndex; sql = $LegacySql; l51 = $true },
    @{ code = 'tgw'; db = 'technology-gear-world'; index = $PlainIndex; sql = $PlainSql; l51 = $false }
)

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Hide-Ids([string]$Text) {
    $t = [regex]::Replace($Text, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
    return [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{28}\b', '${1}-masked-id')
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $kind = 'CHECK'
    if ($Apply) { $kind = 'APPLY' }
    if ($Verify) { $kind = 'VERIFY' }
    $file = Join-Path $OutDir ('D1_GTIN_INDEX_{0}_{1}.txt' -f $kind, $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('D1_GTIN_INDEX_{0}_{1}_{2}.txt' -f $kind, $stamp, $n); $n++ }
    $text = Hide-Ids ($L -join "`r`n")
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor $Ok }
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
        Write-Host ('Για να συνεχίσω, γράψε ακριβώς: {0}' -f $phrase) -ForegroundColor $Warn
        Write-Host '(ή πάτα Enter για να σταματήσω χωρίς αλλαγές)'
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
# The characters & | < > ^ % never go to the command line: the index statement goes in a file (--file).
# -Retry: on a network error try again, up to 3 times (only for calls that are safe to repeat).
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-d1-gtin-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
        [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        }
        $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
        $result = @{ code = $code; text = $text }
        $network = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|code: 7403|code: 10000'
        if ($code -eq 0 -or -not $network -or $try -eq $tries) { break }
        Say ('Πρόβλημα δικτύου με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/{2})...' -f (5 * $try), ($try + 1), $tries) $Warn
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

# The JSON array that wrangler printed with --json (warnings before it are skipped), as a flat array of its items.
# Windows PowerShell 5.1 gives a JSON array back as ONE object (the array) and PowerShell 7 as its items: both end up
# here as the items (lessons L76).
function Get-JsonArray([string]$text) {
    $m = [regex]::Match($text, '(?m)^\s*\[')
    $j = $text.LastIndexOf(']')
    if (-not $m.Success -or $j -le $m.Index) { return $null }
    try { $parsed = ConvertFrom-Json -InputObject $text.Substring($m.Index, $j - $m.Index + 1) } catch { return $null }
    $items = New-Object System.Collections.ArrayList
    foreach ($x in @($parsed)) { if ($null -ne $x) { [void]$items.Add($x) } }
    return , $items.ToArray()
}

# One read-only SELECT on a database: @{ ok; rows; text }
function Select-Rows([string]$db, [string]$sql) {
    if ($sql -notmatch '^SELECT ') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler $dest ('d1 execute {0} --remote --json --command "{1}"' -f $db, $sql) -Retry
    if ($r.code -ne 0) { return @{ ok = $false; rows = @(); text = $r.text } }
    $j = Get-JsonArray $r.text
    if ($null -eq $j -or $j.Count -lt 1) { return @{ ok = $false; rows = @(); text = $r.text } }
    return @{ ok = $true; rows = @($j[0].results); text = $r.text }
}

# The index text as SQLite keeps it in sqlite_master ("IF NOT EXISTS" and the final ";" dropped), compared without
# spaces and case, so only a different expression counts as different.
function Normalize-Sql([string]$s) {
    $t = ([string]$s).ToLowerInvariant() -replace '\s+', ''
    $t = $t -replace 'ifnotexists', ''
    return $t.TrimEnd(';')
}

# How to go back, in this order: first the sites' old code, only then the indexes this tool added.
function Get-RollbackLines($dbs) {
    $lines = @(
        'Επαναφορά (αν χρειαστεί), ΜΕ ΑΥΤΗ ΤΗ ΣΕΙΡΑ:',
        ('  1. ΠΡΩΤΑ τα 13 sites πίσω στον κώδικα πριν από το L115 ({0}): tools/ads-fixes-sites.ps1 -Step apply μέσω του gw-run με -Ref {1} και «ΕΓΚΡΙΝΩ ADS FIXES».' -f $PrevRef.Substring(0, 7), $PrevRef),
        '     Χωρίς το ευρετήριο ο νέος κώδικας διαβάζει ΟΛΟ τον πίνακα σε κάθε αναζήτηση barcode. Αν ο νέος κώδικας δεν ανέβηκε ακόμα, αυτό το βήμα δεν χρειάζεται.',
        '  2. ΜΟΝΟ ΜΕΤΑ, και μόνο στις βάσεις όπου το έβαλε αυτό το εργαλείο, από τον φάκελο:',
        ('     cd "{0}"' -f $dest)
    )
    foreach ($s in $dbs) {
        if ($s.l51) { continue }
        $lines += ('     npx wrangler d1 execute {0} --remote --command "DROP INDEX IF EXISTS {1}"' -f $s.db, $s.index)
    }
    $lines += '     ΠΟΤΕ στις MGW, WGW, KGW, HGW, GGW: το idx_products_group_key τους είναι από το L51 και το χρειάζονται οι σελίδες προϊόντων τους.'
    # Lines, one by one (callers collect them with @()).
    return $lines
}

$SchemaSql = 'SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name'

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply) { $mode = 'APPLY (με έγκριση)' }
if ($Verify) { $mode = 'ΕΛΕΓΧΟΣ ΠΡΙΝ ΑΠΟ ΤΟ ΑΝΕΒΑΣΜΑ ΤΟΥ ΚΩΔΙΚΑ (μόνο ανάγνωση)' }
Say ('D1 GTIN INDEX (L115, αναζήτηση barcode) - {0} - {1}' -f $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) $Ok
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
if ($Verify -and $Apply) { Say '-Verify μόνο διαβάζει: δεν πάει μαζί με -Apply. Δεν άλλαξε τίποτα.' $Bad; Finish 2 }

$run = @($Sites)
if ($Only) {
    $want = @($Only.ToLowerInvariant() -split '[,\s]+' | Where-Object { $_ })
    $unknown = @($want | Where-Object { $w = $_; -not ($Sites | Where-Object { $_.code -eq $w }) })
    if ($unknown.Count -gt 0) { Say ('Άγνωστο site στο -Only: {0} (μόνο: {1})' -f ($unknown -join ', '), (($Sites | ForEach-Object { $_.code }) -join ', ')) $Bad; Finish 2 }
    $run = @($Sites | Where-Object { $want -contains $_.code })
}
Say ('Βάσεις: {0}' -f (($run | ForEach-Object { '{0} ({1})' -f $_.code.ToUpper(), $_.db }) -join ', '))

# wrangler of this repo version (npm ci once per version). No wrangler config here: each database is found by its name.
$ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
$dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    foreach ($item in @('package.json', 'package-lock.json')) { Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Force }
}
if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
    Write-Host 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-d1-gtin-npm-ci.cmd'
    [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
    & $cmdFile
    $code = $LASTEXITCODE
    Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
}

# 1. Each database: its indexes, the barcode index, the number of product rows where it is missing (only SELECT)
$problems = 0
$notReady = New-Object System.Collections.Generic.List[string]
$todo = New-Object System.Collections.ArrayList
$writes = 0
Say ''
Say '1. Τι υπάρχει τώρα (μόνο ανάγνωση):'
foreach ($s in $run) {
    $r = Select-Rows $s.db $SchemaSql
    if (-not $r.ok) {
        if ($r.text -match '(?i)not authenticated|wrangler login') { Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 4 }
        Say ('  {0} ({1}): ΠΡΟΒΛΗΜΑ - δεν διάβασα τη βάση. Έξοδος:' -f $s.code.ToUpper(), $s.db) $Bad
        foreach ($line in @($r.text -split "`n" | Select-Object -Last 6)) { Say ('      ' + $line) }
        $problems++
        $notReady.Add($s.code.ToUpper())
        continue
    }
    $rows = @($r.rows)
    $table = @($rows | Where-Object { $_.type -eq 'table' -and $_.name -eq 'products' })
    if ($table.Count -ne 1) { Say ('  {0} ({1}): ΠΡΟΒΛΗΜΑ - δεν έχει πίνακα products. Δεν την αγγίζω.' -f $s.code.ToUpper(), $s.db) $Bad; $problems++; $notReady.Add($s.code.ToUpper()); continue }
    $idx = @($rows | Where-Object { $_.type -eq 'index' -and $_.tbl_name -eq 'products' -and $_.sql } | ForEach-Object { [string]$_.name })
    Say ('  {0} ({1}): ευρετήρια του products: {2}' -f $s.code.ToUpper(), $s.db, $(if ($idx.Count) { $idx -join ', ' } else { 'κανένα' }))
    $have = @($rows | Where-Object { $_.type -eq 'index' -and $_.name -eq $s.index })
    if ($have.Count -eq 1) {
        if ((Normalize-Sql ([string]$have[0].sql)) -eq (Normalize-Sql $s.sql)) {
            $why = $(if ($s.l51) { ' (από το L51)' } else { '' })
            Say ('      {0}: υπάρχει ήδη με το σωστό κείμενο{1}: ΕΝΤΑΞΕΙ (δεν αλλάζει)' -f $s.index, $why) $Ok
        } else {
            Say ('      {0}: ΠΡΟΒΛΗΜΑ - υπάρχει με άλλο κείμενο, που ο κώδικας δεν χρησιμοποιεί: {1}' -f $s.index, $have[0].sql) $Bad
            Say '      Δεν το αλλάζω: στείλε στο Claude αυτή την αναφορά.' $Bad
            $problems++
            $notReady.Add($s.code.ToUpper())
        }
        continue
    }
    $notReady.Add($s.code.ToUpper())
    if ($Verify) { Say ('      {0}: ΛΕΙΠΕΙ' -f $s.index) $Bad; continue }
    if ($s.l51) { Say ('      {0}: ΠΡΟΣΟΧΗ - λείπει, ενώ το L51 το είχε βάλει εδώ (οι σελίδες προϊόντων το χρειάζονται).' -f $s.index) $Warn }
    $cnt = Select-Rows $s.db 'SELECT COUNT(*) AS n FROM products'
    $n = 0
    if ($cnt.ok -and $cnt.rows.Count -ge 1 -and $null -ne $cnt.rows[0].n) { $n = [long]$cnt.rows[0].n }
    if (-not $cnt.ok) { Say ('      ΠΡΟΣΟΧΗ: δεν διάβασα πόσα προϊόντα έχει ({0}).' -f $s.db) $Warn; $problems++; continue }
    $writes += ($n + 1)
    [void]$todo.Add($s)
    Say ('      {0}: λείπει: θα μπει (περίπου {1} εγγραφές στη D1, μία φορά)' -f $s.index, ($n + 1)) $Warn
}

if ($Verify) {
    Say ''
    if ($notReady.Count -gt 0) {
        Say ('Έλεγχος ευρετηρίων barcode: ΠΡΟΒΛΗΜΑ - λείπουν ή δεν είναι σωστά σε: {0}.' -f ($notReady -join ', ')) $Bad
        Say 'Πρώτα το tools/d1-gtin-index.ps1 με -Apply και «ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ BARCODE», μετά το ανέβασμα του κώδικα.' $Bad
        Finish 9
    }
    Say ('Έλεγχος ευρετηρίων barcode: υπάρχουν με το σωστό κείμενο σε {0}: ΕΝΤΑΞΕΙ' -f (($run | ForEach-Object { $_.code.ToUpper() }) -join ', ')) $Ok
    Finish 0
}

# 2. The plan
Say ''
Say ('2. Πλάνο (φράση: {0}):' -f $Phrase)
if ($todo.Count -eq 0) { Say '  Καμία βάση δεν χρειάζεται αλλαγή.' }
else {
    Say ('  a. Αντίγραφο ασφαλείας: το σχήμα (sqlite_master) κάθε βάσης σε αρχείο με ημερομηνία, στο {0}' -f (Join-Path $WorkDir 'backups'))
    Say ('  b. Σε {0} βάσεις: {1}' -f $todo.Count, (($todo | ForEach-Object { $_.code.ToUpper() }) -join ', '))
    foreach ($s in $todo) { Say ('     {0}: {1}' -f $s.code.ToUpper(), $s.sql) }
    Say '     Μόνο ευρετήριο: κανένας πίνακας και καμία γραμμή δεν αλλάζει (L28). Δεύτερη φορά δεν αλλάζει τίποτα (IF NOT EXISTS).'
    Say '     Μετά από αυτό, κάθε νέο προϊόν που γράφει μια εισαγωγή κοστίζει μία εγγραφή ακόμα (το ευρετήριο), όπως κάθε ευρετήριο (L49, L57).'
    Say '  c. Έλεγχος ότι κάθε ευρετήριο υπάρχει με ακριβώς αυτό το κείμενο.'
    Say ('  Εγγραφές στη D1: περίπου {0} συνολικά, μία φορά (όσες οι γραμμές του products κάθε βάσης).' -f $writes)
    if ($writes -gt $FreeWriteLimit) { Say ('  Πάνω από {0}: χρειάζεται -PaidPlan (Cloudflare Workers Paid). Με Workers Free το όριο είναι 100.000 τη μέρα για όλο τον λογαριασμό (L49).' -f $FreeWriteLimit) $Warn }
    Say '  Μετά: ανεβαίνει ο νέος κώδικας στα sites (πρώτα τα ευρετήρια, μετά ο κώδικας· το ανέβασμα ελέγχει μόνο του ότι τα ευρετήρια υπάρχουν).'
    foreach ($line in (Get-RollbackLines $todo)) { Say ('  ' + $line) }
}

if (-not $Apply) {
    Say ''
    if ($problems -gt 0) { Say 'Αποτέλεσμα: ΠΡΟΣΟΧΗ (δες τα παραπάνω). Δεν άλλαξε τίποτα.' $Warn; Finish 2 }
    Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ (μόνο έλεγχος, δεν άλλαξε τίποτα)' $Ok
    if ($todo.Count -gt 0) { Say ('Για την αλλαγή: -Apply και η φράση {0}{1}' -f $Phrase, $(if ($writes -gt $FreeWriteLimit) { ' (και -PaidPlan)' } else { '' })) }
    Finish 0
}

# ================= apply =================
if ($problems -gt 0) { Say ''; Say 'Υπάρχουν προβλήματα (δες τα παραπάνω): ΔΕΝ αλλάζω τίποτα.' $Bad; Finish 8 }
if ($todo.Count -eq 0) { Say ''; Say 'Τίποτα να αλλάξει: όλες οι βάσεις έχουν ήδη το ευρετήριο barcode. ΕΝΤΑΞΕΙ' $Ok; Finish 0 }
if ($writes -gt $FreeWriteLimit -and -not $PaidPlan) {
    Say ''
    Say ('ΣΤΑΜΑΤΗΣΑ χωρίς αλλαγές: περίπου {0} εγγραφές, πάνω από {1}. Με Workers Paid η εντολή παίρνει και -PaidPlan.' -f $writes, $FreeWriteLimit) $Warn
    Finish 7
}
if (-not (Confirm-Approval $Phrase)) { Say ''; Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' $Warn; Finish 1 }
Say ''
Say 'Έγκριση: ΕΝΤΑΞΕΙ.' $Ok

# a. Backup: the schema of every database read again now and saved, before any change
$bdir = Join-Path $WorkDir 'backups'
if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
foreach ($s in $todo) {
    $r = Select-Rows $s.db $SchemaSql
    if (-not $r.ok) { Say ('a. Δεν πήρα αντίγραφο του σχήματος της {0}: ΔΕΝ άλλαξε καμία βάση.' -f $s.db) $Bad; Finish 11 }
    $file = Join-Path $bdir ('{0}-sqlite_master-before-gtin-index-{1}.json' -f $s.code, $stamp)
    $m = [regex]::Match($r.text, '(?m)^\s*\[')
    [System.IO.File]::WriteAllText($file, (Hide-Ids $r.text.Substring($m.Index)), (New-Object System.Text.UTF8Encoding($false)))
    $undo = Join-Path $bdir ('{0}-rollback-gtin-index-{1}.txt' -f $s.code, $stamp)
    $note = @(('{0} ({1}): το ευρετήριο barcode {2} μπήκε στις {3} (μάθημα L115). Μόνο με έγκριση:' -f $s.code.ToUpper(), $s.db, $s.index, (Get-Date -Format 'yyyy-MM-dd HH:mm'))) + @(Get-RollbackLines @($s))
    $note = $note -join "`r`n"
    [System.IO.File]::WriteAllText($undo, $note, (New-Object System.Text.UTF8Encoding($false)))
    Say ('a. {0}: αντίγραφο του σχήματος: {1}' -f $s.code.ToUpper(), $file) $Ok
}

# b. The index, one database at a time (stops at the first problem)
$done = New-Object System.Collections.Generic.List[string]
foreach ($s in $todo) {
    $sqlFile = Join-Path $bdir ('{0}-add-gtin-index-{1}.sql' -f $s.code, $stamp)
    [System.IO.File]::WriteAllText($sqlFile, $s.sql + "`n", (New-Object System.Text.UTF8Encoding($false)))
    $x = Invoke-Wrangler $dest ('d1 execute {0} --remote --file "{1}"' -f $s.db, $sqlFile) -Retry
    if ($x.code -ne 0) {
        Say ('b. {0}: ΠΡΟΒΛΗΜΑ - το ευρετήριο δεν μπήκε. Σταμάτησα εδώ. Μπήκε ήδη σε: {1}' -f $s.code.ToUpper(), $(if ($done.Count) { $done -join ', ' } else { 'καμία' })) $Bad
        foreach ($line in @($x.text -split "`n" | Select-Object -Last 8)) { Say ('     ' + $line) }
        Finish 12
    }
    $done.Add($s.code.ToUpper())
    Say ('b. {0}: το {1} μπήκε.' -f $s.code.ToUpper(), $s.index) $Ok
}

# c. Check: the index is there, with exactly this text
$missing = @()
foreach ($s in $todo) {
    $r = Select-Rows $s.db ("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = '{0}'" -f $s.index)
    $want = Normalize-Sql $s.sql
    $found = @($r.rows | Where-Object { $_.name -eq $s.index -and (Normalize-Sql ([string]$_.sql)) -eq $want })
    if (-not $r.ok -or $found.Count -ne 1) { $missing += $s.code.ToUpper() }
}
Say ''
if ($missing.Count -gt 0) { Say ('c. Έλεγχος: ΠΡΟΣΟΧΗ - δεν βλέπω το ευρετήριο σε: {0}. Στείλε στο Claude αυτή την αναφορά.' -f ($missing -join ', ')) $Warn; Finish 13 }
Say ('c. Έλεγχος: το ευρετήριο barcode υπάρχει σε {0} με το σωστό κείμενο: ΕΝΤΑΞΕΙ' -f ($done -join ', ')) $Ok
Say ''
Say 'Επόμενο βήμα: το ανέβασμα του νέου κώδικα στα sites.'
Say 'Αποτέλεσμα: ΕΤΟΙΜΟ' $Ok
Finish 0
