<#
.SYNOPSIS
  The indexes of lessons L159 in the 7 new-layout D1 databases (TGW, AGW, VGW, SGW, BGW, PGW, ZGW): the lists of a big
  category read only the cards they show. Read-only unless -Apply and the typed approval phrase ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ ΛΙΣΤΩΝ.

.DESCRIPTION
  On 14 Nov 2026 Car Gear World got 92,535 tyres (one category of 123,142 rows) and its D1 answered "overloaded": every
  category page numbered all the rows of its category, and the counts, the filters and the home page read every row
  (local test with 1,000,000 products: home page 10-13 s, a tyre page 1-3 s). The sites' code of L159 (src/db.js,
  fastMode) walks each category in the page's own order through these five indexes (home page 1 ms, a tyre page 1-2 ms,
  page 40 18 ms on the same test), and uses them only when all five are there: before they go in, and after they are
  dropped, the sites read exactly as before. The statements are those of sites/<site>/migrations/0003_fast_lists.sql
  (read from this version of the code), the same as FAST_INDEX_SQL in src/db.js.

  Without -Apply: READ-ONLY. For each database it reads the schema (sqlite_master) and the highest product id (one row),
                  and shows which of the five indexes exist, what would be added, about how many rows D1 would write
                  (highest id x indexes to add), and how to go back. Changes nothing.
  With -Apply:    CHANGES THE DATABASES (only indexes, never a table or a row, lessons L28), one approval:
                  ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ ΛΙΣΤΩΝ. First the schema of every database is saved to a dated file (backup), then
                  the missing indexes go into each database (CREATE INDEX IF NOT EXISTS: running it again changes
                  nothing), one database at a time, then it checks that all five are there with exactly this text.
                  While D1 builds them (seconds per database) the site's pages answer with their last copy (L159).
                  Above 90,000 rows written in all it needs -PaidPlan (Cloudflare Workers Paid, lessons L49).
  -Verify         READ-ONLY. Exit 0 only when every database has the five indexes with exactly this text, otherwise 9.
  -Only agw,vgw   only these sites (codes, comma separated).
  Going back: for each database DROP INDEX IF EXISTS of the five (the report prints the commands). The sites' code then
              reads the old way by itself (fastMode looks again within 10 minutes, and a query that misses an index is
              asked again the old way at once): no code goes back first.

  Files on this PC: <home>\gear-world-d1-index\ (deploy\<version> with wrangler, backups\)
  Report: <home>\gear-world-reports\D1_FAST_LISTS_<CHECK|APPLY|VERIFY>_<time>.txt (also copied to the clipboard)
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
$Phrase = 'ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ ΛΙΣΤΩΝ'
$FreeWriteLimit = 90000
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-d1-index' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
# Colours without red and green (lessons L35): cyan = OK, yellow = attention, magenta = problem.
$Ok = 'Cyan'
$Warn = 'Yellow'
$Bad = 'Magenta'

# The 7 new-layout sites (their own schema, sites/<site>/migrations). The older sites keep their database as it is (L28).
$Sites = @(
    @{ code = 'agw'; db = 'car-gear-world'; domain = 'cargearworld.com' },
    @{ code = 'tgw'; db = 'technology-gear-world'; domain = 'technologygearworld.com' },
    @{ code = 'vgw'; db = 'travel-gear-world'; domain = 'travelgearworld.com' },
    @{ code = 'sgw'; db = 'sporty-gear-world'; domain = 'sportygearworld.com' },
    @{ code = 'bgw'; db = 'biker-gear-world'; domain = 'bikergearworld.com' },
    @{ code = 'pgw'; db = 'gaming-gear-world'; domain = 'gaminggearworld.com' },
    @{ code = 'zgw'; db = 'pets-gear-world'; domain = 'petsgearworld.com' }
)

# The five statements, from the migration of this version of the code (the same file for every new-layout site).
$migration = Join-Path (Join-Path (Join-Path (Join-Path $repo 'sites') 'agw') 'migrations') '0003_fast_lists.sql'
$Indexes = New-Object System.Collections.ArrayList
if (Test-Path -LiteralPath $migration) {
    foreach ($line in [System.IO.File]::ReadAllLines($migration, [System.Text.Encoding]::UTF8)) {
        $m = [regex]::Match($line, '^CREATE INDEX IF NOT EXISTS (idx_products_\w+) ON products \(')
        if ($m.Success) { [void]$Indexes.Add(@{ name = $m.Groups[1].Value; sql = $line.Trim() }) }
    }
}

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
    $file = Join-Path $OutDir ('D1_FAST_LISTS_{0}_{1}.txt' -f $kind, $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('D1_FAST_LISTS_{0}_{1}_{2}.txt' -f $kind, $stamp, $n); $n++ }
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
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-d1-fast-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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

$SchemaSql = 'SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name'

function Get-RollbackLines($dbs) {
    $lines = @(
        'Επαναφορά (αν χρειαστεί): μόνο τα ευρετήρια φεύγουν, ο κώδικας των sites δεν αλλάζει.',
        '  Ο κώδικας του L159 τα χρησιμοποιεί μόνο όταν υπάρχουν και τα πέντε: χωρίς αυτά διαβάζει όπως πριν, μόνος του.',
        '  Για κάθε βάση, από τον φάκελο:',
        ('     cd "{0}"' -f $dest)
    )
    foreach ($s in $dbs) {
        foreach ($ix in $Indexes) { $lines += ('     npx wrangler d1 execute {0} --remote --command "DROP INDEX IF EXISTS {1}"' -f $s.db, $ix.name) }
    }
    return $lines
}

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply) { $mode = 'APPLY (με έγκριση)' }
if ($Verify) { $mode = 'ΕΛΕΓΧΟΣ (μόνο ανάγνωση)' }
Say ('D1 ΕΥΡΕΤΗΡΙΑ ΛΙΣΤΩΝ (L159) - {0} - {1}' -f $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) $Ok
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
if ($Verify -and $Apply) { Say '-Verify μόνο διαβάζει: δεν πάει μαζί με -Apply. Δεν άλλαξε τίποτα.' $Bad; Finish 2 }
if ($Indexes.Count -ne 5) { Say ('ΠΡΟΒΛΗΜΑ: δεν βρήκα τα 5 ευρετήρια στο {0} (βρήκα {1}). Δεν άλλαξε τίποτα.' -f $migration, $Indexes.Count) $Bad; Finish 3 }

$run = @($Sites)
if ($Only) {
    $want = @($Only.ToLowerInvariant() -split '[,\s]+' | Where-Object { $_ })
    $unknown = @($want | Where-Object { $w = $_; -not ($Sites | Where-Object { $_.code -eq $w }) })
    if ($unknown.Count -gt 0) { Say ('Άγνωστο site στο -Only: {0} (μόνο: {1})' -f ($unknown -join ', '), (($Sites | ForEach-Object { $_.code }) -join ', ')) $Bad; Finish 2 }
    $run = @($Sites | Where-Object { $want -contains $_.code })
}
Say ('Βάσεις: {0}' -f (($run | ForEach-Object { '{0} ({1})' -f $_.code.ToUpper(), $_.db }) -join ', '))
Say ('Ευρετήρια: {0}' -f (($Indexes | ForEach-Object { $_.name }) -join ', '))

# wrangler of this repo version (npm ci once per version). No wrangler config here: each database is found by its name.
$ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
$dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    foreach ($item in @('package.json', 'package-lock.json')) { Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Force }
}
if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
    Write-Host 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-d1-fast-npm-ci.cmd'
    [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
    & $cmdFile
    $code = $LASTEXITCODE
    Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
}

# 1. Each database: which of the five indexes it has, and its highest product id (only SELECT)
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
    $missing = New-Object System.Collections.ArrayList
    $wrong = 0
    foreach ($ix in $Indexes) {
        $have = @($rows | Where-Object { $_.type -eq 'index' -and $_.name -eq $ix.name })
        if ($have.Count -eq 1) {
            if ((Normalize-Sql ([string]$have[0].sql)) -eq (Normalize-Sql $ix.sql)) { continue }
            Say ('  {0} ({1}): ΠΡΟΒΛΗΜΑ - το {2} υπάρχει με άλλο κείμενο: {3}' -f $s.code.ToUpper(), $s.db, $ix.name, $have[0].sql) $Bad
            $wrong++
            continue
        }
        [void]$missing.Add($ix)
    }
    if ($wrong -gt 0) { Say '      Δεν το αλλάζω: στείλε στο Claude αυτή την αναφορά.' $Bad; $problems++; $notReady.Add($s.code.ToUpper()); continue }
    if ($missing.Count -eq 0) { Say ('  {0} ({1}): και τα 5 υπάρχουν με το σωστό κείμενο: ΕΝΤΑΞΕΙ (δεν αλλάζει)' -f $s.code.ToUpper(), $s.db) $Ok; continue }
    $notReady.Add($s.code.ToUpper())
    if ($Verify) { Say ('  {0} ({1}): ΛΕΙΠΟΥΝ {2}: {3}' -f $s.code.ToUpper(), $s.db, $missing.Count, (($missing | ForEach-Object { $_.name }) -join ', ')) $Bad; continue }
    $mx = Select-Rows $s.db 'SELECT MAX(id) AS n FROM products'
    $n = 0
    if ($mx.ok -and $mx.rows.Count -ge 1 -and $null -ne $mx.rows[0].n) { $n = [long]$mx.rows[0].n }
    if (-not $mx.ok) { Say ('  {0}: ΠΡΟΣΟΧΗ: δεν διάβασα πόσα προϊόντα έχει.' -f $s.db) $Warn; $problems++; continue }
    $writes += $n * $missing.Count
    [void]$todo.Add(@{ site = $s; missing = @($missing) })
    Say ('  {0} ({1}): λείπουν {2} ({3}): θα μπουν (έως περίπου {4} εγγραφές στη D1, μία φορά)' -f $s.code.ToUpper(), $s.db, $missing.Count, (($missing | ForEach-Object { $_.name }) -join ', '), ($n * $missing.Count)) $Warn
}

if ($Verify) {
    Say ''
    if ($notReady.Count -gt 0) {
        Say ('Έλεγχος ευρετηρίων: ΠΡΟΒΛΗΜΑ - λείπουν ή δεν είναι σωστά σε: {0}. Τα sites διαβάζουν εκεί όπως πριν (L159).' -f ($notReady -join ', ')) $Bad
        Say ('Για να μπουν: tools/d1-fast-lists.ps1 με -Apply και «{0}».' -f $Phrase) $Bad
        Finish 9
    }
    Say ('Έλεγχος ευρετηρίων: και τα 5 υπάρχουν με το σωστό κείμενο σε {0}: ΕΝΤΑΞΕΙ' -f (($run | ForEach-Object { $_.code.ToUpper() }) -join ', ')) $Ok
    Finish 0
}

# 2. The plan
$todoSites = @($todo | ForEach-Object { $_.site })
Say ''
Say ('2. Πλάνο (φράση: {0}):' -f $Phrase)
if ($todo.Count -eq 0) { Say '  Καμία βάση δεν χρειάζεται αλλαγή.' }
else {
    Say ('  a. Αντίγραφο ασφαλείας: το σχήμα (sqlite_master) κάθε βάσης σε αρχείο με ημερομηνία, στο {0}' -f (Join-Path $WorkDir 'backups'))
    Say ('  b. Σε {0} βάσεις, μία-μία: {1}' -f $todo.Count, (($todoSites | ForEach-Object { $_.code.ToUpper() }) -join ', '))
    foreach ($ix in $Indexes) { Say ('     {0}' -f $ix.sql) }
    Say '     Μόνο ευρετήρια: κανένας πίνακας και καμία γραμμή δεν αλλάζει (L28). Δεύτερη φορά δεν αλλάζει τίποτα (IF NOT EXISTS).'
    Say '     Όσο η D1 τα φτιάχνει (δευτερόλεπτα σε κάθε βάση), οι σελίδες του site δείχνουν το τελευταίο τους αντίγραφο (L159).'
    Say '  c. Έλεγχος ότι και τα 5 υπάρχουν σε κάθε βάση με ακριβώς αυτό το κείμενο.'
    Say ('  Εγγραφές στη D1: έως περίπου {0} συνολικά, μία φορά (προϊόντα κάθε βάσης x ευρετήρια που λείπουν).' -f $writes)
    if ($writes -gt $FreeWriteLimit) { Say ('  Πάνω από {0}: χρειάζεται -PaidPlan (Cloudflare Workers Paid). Με Workers Free το όριο είναι 100.000 τη μέρα για όλο τον λογαριασμό (L49).' -f $FreeWriteLimit) $Warn }
    foreach ($line in (Get-RollbackLines $todoSites)) { Say ('  ' + $line) }
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
if ($todo.Count -eq 0) { Say ''; Say 'Τίποτα να αλλάξει: όλες οι βάσεις έχουν ήδη και τα 5. ΕΝΤΑΞΕΙ' $Ok; Finish 0 }
if ($writes -gt $FreeWriteLimit -and -not $PaidPlan) {
    Say ''
    Say ('ΣΤΑΜΑΤΗΣΑ χωρίς αλλαγές: έως περίπου {0} εγγραφές, πάνω από {1}. Με Workers Paid η εντολή παίρνει και -PaidPlan.' -f $writes, $FreeWriteLimit) $Warn
    Finish 7
}
if (-not (Confirm-Approval $Phrase)) { Say ''; Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' $Warn; Finish 1 }
Say ''
Say 'Έγκριση: ΕΝΤΑΞΕΙ.' $Ok

# a. Backup: the schema of every database read again now and saved, before any change
$bdir = Join-Path $WorkDir 'backups'
if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
foreach ($t in $todo) {
    $s = $t.site
    $r = Select-Rows $s.db $SchemaSql
    if (-not $r.ok) { Say ('a. Δεν πήρα αντίγραφο του σχήματος της {0}: ΔΕΝ άλλαξε καμία βάση.' -f $s.db) $Bad; Finish 11 }
    $file = Join-Path $bdir ('{0}-sqlite_master-before-fast-lists-{1}.json' -f $s.code, $stamp)
    $m = [regex]::Match($r.text, '(?m)^\s*\[')
    [System.IO.File]::WriteAllText($file, (Hide-Ids $r.text.Substring($m.Index)), (New-Object System.Text.UTF8Encoding($false)))
    $undo = Join-Path $bdir ('{0}-rollback-fast-lists-{1}.txt' -f $s.code, $stamp)
    $note = @(('{0} ({1}): τα ευρετήρια λιστών (μάθημα L159) μπήκαν στις {2}. Μόνο με έγκριση:' -f $s.code.ToUpper(), $s.db, (Get-Date -Format 'yyyy-MM-dd HH:mm'))) + @(Get-RollbackLines @($s))
    [System.IO.File]::WriteAllText($undo, ($note -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
    Say ('a. {0}: αντίγραφο του σχήματος: {1}' -f $s.code.ToUpper(), $file) $Ok
}

# b. The missing indexes, one database at a time (stops at the first problem)
$done = New-Object System.Collections.Generic.List[string]
foreach ($t in $todo) {
    $s = $t.site
    $sqlFile = Join-Path $bdir ('{0}-add-fast-lists-{1}.sql' -f $s.code, $stamp)
    $text = (($t.missing | ForEach-Object { $_.sql }) -join "`n") + "`n"
    [System.IO.File]::WriteAllText($sqlFile, $text, (New-Object System.Text.UTF8Encoding($false)))
    $x = Invoke-Wrangler $dest ('d1 execute {0} --remote --file "{1}"' -f $s.db, $sqlFile) -Retry
    if ($x.code -ne 0) {
        Say ('b. {0}: ΠΡΟΒΛΗΜΑ - τα ευρετήρια δεν μπήκαν. Σταμάτησα εδώ. Μπήκαν ήδη σε: {1}' -f $s.code.ToUpper(), $(if ($done.Count) { $done -join ', ' } else { 'καμία' })) $Bad
        foreach ($line in @($x.text -split "`n" | Select-Object -Last 8)) { Say ('     ' + $line) }
        Finish 12
    }
    $done.Add($s.code.ToUpper())
    Say ('b. {0}: μπήκαν {1} ευρετήρια.' -f $s.code.ToUpper(), @($t.missing).Count) $Ok
}

# c. Check: all five are there, with exactly this text
$names = ($Indexes | ForEach-Object { "'" + $_.name + "'" }) -join ', '
$bad = @()
foreach ($t in $todo) {
    $s = $t.site
    $r = Select-Rows $s.db ("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name IN ({0})" -f $names)
    $good = 0
    foreach ($ix in $Indexes) { $good += @($r.rows | Where-Object { $_.name -eq $ix.name -and (Normalize-Sql ([string]$_.sql)) -eq (Normalize-Sql $ix.sql) }).Count }
    if (-not $r.ok -or $good -ne $Indexes.Count) { $bad += $s.code.ToUpper() }
}
Say ''
if ($bad.Count -gt 0) { Say ('c. Έλεγχος: ΠΡΟΣΟΧΗ - δεν βλέπω και τα 5 σε: {0}. Τα sites εκεί διαβάζουν όπως πριν. Στείλε στο Claude αυτή την αναφορά.' -f ($bad -join ', ')) $Warn; Finish 13 }
Say ('c. Έλεγχος: και τα 5 υπάρχουν σε {0} με το σωστό κείμενο: ΕΝΤΑΞΕΙ' -f ($done -join ', ')) $Ok
Say ''
Say 'Τα sites τα χρησιμοποιούν μόνα τους μέσα σε 10 λεπτά (L159).'
Say 'Αποτέλεσμα: ΕΤΟΙΜΟ' $Ok
Finish 0
