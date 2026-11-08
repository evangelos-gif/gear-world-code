<#
.SYNOPSIS
  The group-key index of the 7 new-layout D1 databases (lessons L105): TGW, AGW, VGW, SGW, BGW, PGW and ZGW.
  Read-only unless -Apply and the typed approval phrase ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ D1.

.DESCRIPTION
  On 6-8 Nov 2026 D1 read about 1 billion rows a day: an SEO crawler opened about 1,000 product pages an hour on
  cargearworld.com, and every product page read about 62,000 rows, because the new-layout databases have no index on
  the product-group key ("the same product at other retailers" read the whole table, "similar products" the whole
  category). The new code (src/db.js, NATIVE_GROUP_KEY) reads only the rows of each group through this index:
    CREATE INDEX IF NOT EXISTS idx_products_group_key ON products(COALESCE(NULLIF(TRIM(gtin), ''), 'id:' || id));
  (the same statement as sites/<site>/migrations/0002_group_key_index.sql). The index goes in BEFORE the new code.

  Without -Apply: READ-ONLY. For each database it reads the schema (sqlite_master) and the highest product id (one row),
                  and shows which indexes exist, what would be added, about how many rows D1 would write, and how to
                  go back. Changes nothing.
  With -Apply:    CHANGES THE 7 DATABASES (only an index, never a table or a row, lessons L28), one approval:
                  ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ D1. First the schema of every database is saved to a dated file (backup), then the
                  index is added to each database that does not have it (CREATE INDEX IF NOT EXISTS: running it again
                  changes nothing), then it checks that the index is there with exactly this text.
                  Above 90,000 rows written in all it needs -PaidPlan (Cloudflare Workers Paid; Workers Free allows
                  100,000 a day for the whole account, lessons L49).
  -Only agw,vgw   only these sites (codes, comma separated).
  Going back: npx wrangler d1 execute <database> --remote --command "DROP INDEX IF EXISTS idx_products_group_key"
              (the report prints it for each database). The sites keep working without the index, they only read more.

  Files on this PC: <home>\gear-world-d1-index\ (deploy\<version> with wrangler, backups\)
  Report: <home>\gear-world-reports\D1_NATIVE_INDEX_<CHECK|APPLY>_<time>.txt (also copied to the clipboard)
#>
param(
    [string]$Only = '',
    [switch]$Apply,
    [string]$Approve = '',
    [switch]$PaidPlan,
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ D1'
$IndexName = 'idx_products_group_key'
# Exactly the statement of sites/<site>/migrations/0002_group_key_index.sql (NATIVE_GROUP_KEY of src/db.js).
$CreateSql = 'CREATE INDEX IF NOT EXISTS idx_products_group_key ON products(COALESCE(NULLIF(TRIM(gtin), ''''), ''id:'' || id));'
$DropSql = 'DROP INDEX IF EXISTS idx_products_group_key'
$FreeWriteLimit = 90000
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-d1-index' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
# Colours without red and green (lessons L35): cyan = OK, yellow = attention, magenta = problem.
$Ok = 'Cyan'
$Warn = 'Yellow'
$Bad = 'Magenta'

# The 7 sites with their own database in the new layout (sites/<site>/migrations). Car Gear World first: the crawler was there.
$Sites = @(
    @{ code = 'agw'; db = 'car-gear-world'; domain = 'cargearworld.com' },
    @{ code = 'vgw'; db = 'travel-gear-world'; domain = 'travelgearworld.com' },
    @{ code = 'sgw'; db = 'sporty-gear-world'; domain = 'sportygearworld.com' },
    @{ code = 'bgw'; db = 'biker-gear-world'; domain = 'bikergearworld.com' },
    @{ code = 'pgw'; db = 'gaming-gear-world'; domain = 'gaminggearworld.com' },
    @{ code = 'zgw'; db = 'pets-gear-world'; domain = 'petsgearworld.com' },
    @{ code = 'tgw'; db = 'technology-gear-world'; domain = 'technologygearworld.com' }
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
    $file = Join-Path $OutDir ('D1_NATIVE_INDEX_{0}_{1}.txt' -f $kind, $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('D1_NATIVE_INDEX_{0}_{1}_{2}.txt' -f $kind, $stamp, $n); $n++ }
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
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-d1-index-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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
$WantSql = Normalize-Sql $CreateSql

$SchemaSql = 'SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name'

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply) { $mode = 'APPLY (με έγκριση)' }
Say ('D1 NATIVE INDEX (L105) - {0} - {1}' -f $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) $Ok
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }

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
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-d1-index-npm-ci.cmd'
    [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
    & $cmdFile
    $code = $LASTEXITCODE
    Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
}

# 1. Each database: its indexes, the group-key index, the highest product id (only SELECT)
$problems = 0
$todo = New-Object System.Collections.ArrayList
$schemas = @{}
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
        continue
    }
    $schemas[$s.code] = $r.text
    $rows = @($r.rows)
    $table = @($rows | Where-Object { $_.type -eq 'table' -and $_.name -eq 'products' })
    if ($table.Count -ne 1) { Say ('  {0} ({1}): ΠΡΟΒΛΗΜΑ - δεν έχει πίνακα products. Δεν την αγγίζω.' -f $s.code.ToUpper(), $s.db) $Bad; $problems++; continue }
    $idx = @($rows | Where-Object { $_.type -eq 'index' -and $_.tbl_name -eq 'products' -and $_.sql } | ForEach-Object { [string]$_.name })
    Say ('  {0} ({1}): ευρετήρια του products: {2}' -f $s.code.ToUpper(), $s.db, $(if ($idx.Count) { $idx -join ', ' } else { 'κανένα' }))
    $have = @($rows | Where-Object { $_.type -eq 'index' -and $_.name -eq $IndexName })
    if ($have.Count -eq 1) {
        if ((Normalize-Sql ([string]$have[0].sql)) -eq $WantSql) { Say ('      {0}: υπάρχει ήδη με το σωστό κείμενο: ΕΝΤΑΞΕΙ (δεν αλλάζει)' -f $IndexName) $Ok }
        else {
            Say ('      {0}: ΠΡΟΒΛΗΜΑ - υπάρχει με άλλο κείμενο, που ο κώδικας δεν χρησιμοποιεί: {1}' -f $IndexName, $have[0].sql) $Bad
            Say '      Δεν το αλλάζω: στείλε στο Claude αυτή την αναφορά.' $Bad
            $problems++
        }
        continue
    }
    $mx = Select-Rows $s.db 'SELECT MAX(id) AS n FROM products'
    $n = 0
    if ($mx.ok -and $mx.rows.Count -ge 1 -and $null -ne $mx.rows[0].n) { $n = [long]$mx.rows[0].n }
    if (-not $mx.ok) { Say ('      ΠΡΟΣΟΧΗ: δεν διάβασα πόσα προϊόντα έχει ({0}).' -f $s.db) $Warn; $problems++; continue }
    $writes += $n
    [void]$todo.Add($s)
    Say ('      {0}: λείπει: θα μπει (έως περίπου {1} εγγραφές στη D1, μία φορά)' -f $IndexName, $n) $Warn
}

# 2. The plan
Say ''
Say ('2. Πλάνο (φράση: {0}):' -f $Phrase)
if ($todo.Count -eq 0) { Say '  Καμία βάση δεν χρειάζεται αλλαγή.' }
else {
    Say ('  a. Αντίγραφο ασφαλείας: το σχήμα (sqlite_master) κάθε βάσης σε αρχείο με ημερομηνία, στο {0}' -f (Join-Path $WorkDir 'backups'))
    Say ('  b. Σε {0} βάσεις: {1}' -f $todo.Count, (($todo | ForEach-Object { $_.code.ToUpper() }) -join ', '))
    Say ('     {0}' -f $CreateSql)
    Say '     Μόνο ευρετήριο: κανένας πίνακας και καμία γραμμή δεν αλλάζει (L28). Δεύτερη φορά δεν αλλάζει τίποτα (IF NOT EXISTS).'
    Say ('  c. Έλεγχος ότι το {0} υπάρχει σε κάθε βάση με ακριβώς αυτό το κείμενο.' -f $IndexName)
    Say ('  Εγγραφές στη D1: έως περίπου {0} συνολικά, μία φορά (όσα τα προϊόντα κάθε βάσης).' -f $writes)
    if ($writes -gt $FreeWriteLimit) { Say ('  Πάνω από {0}: χρειάζεται -PaidPlan (Cloudflare Workers Paid). Με Workers Free το όριο είναι 100.000 τη μέρα για όλο τον λογαριασμό (L49).' -f $FreeWriteLimit) $Warn }
    Say '  Μετά: ανεβαίνει ο νέος κώδικας στα sites (πρώτα τα ευρετήρια, μετά ο κώδικας).'
    Say '  Επαναφορά (αν χρειαστεί), για κάθε βάση, από τον φάκελο:'
    Say ('    cd "{0}"' -f $dest)
    foreach ($s in $todo) { Say ('    npx wrangler d1 execute {0} --remote --command "{1}"' -f $s.db, $DropSql) }
    Say '    (τα sites δουλεύουν και χωρίς το ευρετήριο, απλώς διαβάζουν πάλι περισσότερες γραμμές)'
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
if ($todo.Count -eq 0) { Say ''; Say ('Τίποτα να αλλάξει: όλες οι βάσεις έχουν ήδη το {0}. ΕΝΤΑΞΕΙ' -f $IndexName) $Ok; Finish 0 }
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
foreach ($s in $todo) {
    $r = Select-Rows $s.db $SchemaSql
    if (-not $r.ok) { Say ('a. Δεν πήρα αντίγραφο του σχήματος της {0}: ΔΕΝ άλλαξε καμία βάση.' -f $s.db) $Bad; Finish 11 }
    $file = Join-Path $bdir ('{0}-sqlite_master-before-index-{1}.json' -f $s.code, $stamp)
    $m = [regex]::Match($r.text, '(?m)^\s*\[')
    [System.IO.File]::WriteAllText($file, (Hide-Ids $r.text.Substring($m.Index)), (New-Object System.Text.UTF8Encoding($false)))
    $undo = Join-Path $bdir ('{0}-rollback-index-{1}.txt' -f $s.code, $stamp)
    $note = @(
        ('{0} ({1}): the group-key index added on {2} (lessons L105). To go back (only with approval):' -f $s.code.ToUpper(), $s.db, (Get-Date -Format 'yyyy-MM-dd HH:mm')),
        ('  cd "{0}"' -f $dest),
        ('  npx wrangler d1 execute {0} --remote --command "{1}"' -f $s.db, $DropSql)
    ) -join "`r`n"
    [System.IO.File]::WriteAllText($undo, $note, (New-Object System.Text.UTF8Encoding($false)))
    Say ('a. {0}: αντίγραφο του σχήματος: {1}' -f $s.code.ToUpper(), $file) $Ok
}

# b. The index, one database at a time (stops at the first problem)
$done = New-Object System.Collections.Generic.List[string]
foreach ($s in $todo) {
    $sqlFile = Join-Path $bdir ('{0}-add-index-{1}.sql' -f $s.code, $stamp)
    [System.IO.File]::WriteAllText($sqlFile, $CreateSql + "`n", (New-Object System.Text.UTF8Encoding($false)))
    $x = Invoke-Wrangler $dest ('d1 execute {0} --remote --file "{1}"' -f $s.db, $sqlFile) -Retry
    if ($x.code -ne 0) {
        Say ('b. {0}: ΠΡΟΒΛΗΜΑ - το ευρετήριο δεν μπήκε. Σταμάτησα εδώ. Μπήκε ήδη σε: {1}' -f $s.code.ToUpper(), $(if ($done.Count) { $done -join ', ' } else { 'καμία' })) $Bad
        foreach ($line in @($x.text -split "`n" | Select-Object -Last 8)) { Say ('     ' + $line) }
        Finish 12
    }
    $done.Add($s.code.ToUpper())
    Say ('b. {0}: το {1} μπήκε.' -f $s.code.ToUpper(), $IndexName) $Ok
}

# c. Check: the index is there, with exactly this text
$missing = @()
foreach ($s in $todo) {
    $r = Select-Rows $s.db ("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = '{0}'" -f $IndexName)
    $found = @($r.rows | Where-Object { $_.name -eq $IndexName -and (Normalize-Sql ([string]$_.sql)) -eq $WantSql })
    if (-not $r.ok -or $found.Count -ne 1) { $missing += $s.code.ToUpper() }
}
Say ''
if ($missing.Count -gt 0) { Say ('c. Έλεγχος: ΠΡΟΣΟΧΗ - δεν βλέπω το ευρετήριο σε: {0}. Στείλε στο Claude αυτή την αναφορά.' -f ($missing -join ', ')) $Warn; Finish 13 }
Say ('c. Έλεγχος: το {0} υπάρχει σε {1} με το σωστό κείμενο: ΕΝΤΑΞΕΙ' -f $IndexName, ($done -join ', ')) $Ok
Say ''
Say 'Επόμενο βήμα: το ανέβασμα του νέου κώδικα στα sites.'
Say 'Αποτέλεσμα: ΕΤΟΙΜΟ' $Ok
Finish 0
