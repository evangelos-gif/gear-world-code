<#
.SYNOPSIS
  The column of the extra product photos (lessons L206) in the 13 D1 databases: the 7 new-layout ones (TGW, AGW, VGW, SGW,
  BGW, PGW, ZGW) and the 6 older ones (CGW, MGW, WGW, KGW, HGW, GGW). The product pages show a photo gallery when a
  product has more photos. Read-only unless -Apply and the typed approval phrase ΕΓΚΡΙΝΩ ΣΤΗΛΗ ΦΩΤΟΓΡΑΦΙΩΝ.

.DESCRIPTION
  Until 20 Nov 2026 every product had ONE photo. The feed downloads now keep the shops' other photos, and the imports write
  up to 4 of them into one new column, products.images (text; NULL when a product has none). The statement is that of
  this version of the code: sites/<site>/migrations/0004_product_images.sql (new layout) and 0002_product_images.sql (older
  sites), exactly: ALTER TABLE products ADD COLUMN images TEXT;
  A nullable column at the end of the table: SQLite writes no product row for it (only the text of the table in
  sqlite_master), every INSERT of the import tools names its columns, and no index, view or trigger uses it. The sites'
  code looks for the column by itself (src/db.js hasImagesColumn, every 10 minutes): before it is there, and if it goes
  again, the pages are exactly as before. So the order with the code (ALL UPDATES) does not matter.

  Without -Apply: READ-ONLY. For each database it reads the list of columns of products (one small SELECT) and shows
                  whether the column is there, what would be added and how to go back. Changes nothing.
  With -Apply:    CHANGES THE DATABASES (one column, no row), one approval: ΕΓΚΡΙΝΩ ΣΤΗΛΗ ΦΩΤΟΓΡΑΦΙΩΝ. First a Time
                  Travel restore point (bookmark) of every database and its schema to dated files (backup), then the
                  column, one database at a time (it stops at the first problem), then a check that every one has it.
  -Verify         READ-ONLY. Exit 0 only when every database has the column, otherwise 9.
  -Only mgw,wgw   only these sites (codes, comma separated).
  Going back (printed in the report and next to the backup): nothing has to go back, the column is harmless and the pages
              work without its data (the imports simply fill it). If it must go, the way back is the restore point:
              d1 time-travel restore (the whole database as it was, which also undoes every later import). Never DROP
              COLUMN: it rewrites every row of the table, and on the big databases (HGW, WGW) it can run past D1's time
              limits. The sites' code then reads the old way by itself.

  Files on this PC: <home>\gear-world-d1-photos\ (deploy\<version> with wrangler, backups\)
  Report: <home>\gear-world-reports\D1_PHOTO_COLUMN_<CHECK|APPLY|VERIFY>_<time>.txt (also copied to the clipboard)
#>
param(
    [string]$Only = '',
    [switch]$Apply,
    [string]$Approve = '',
    [switch]$Verify,
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ ΣΤΗΛΗ ΦΩΤΟΓΡΑΦΙΩΝ'
$Statement = 'ALTER TABLE products ADD COLUMN images TEXT;'
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-d1-photos' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
# Colours without red and green (lessons L35): cyan = OK, yellow = attention, magenta = problem.
$Ok = 'Cyan'
$Warn = 'Yellow'
$Bad = 'Magenta'

# The 7 new-layout sites and the 6 older sites, each found by its database name, as the other tools find them
# (d1-fast-lists.ps1, legacy-import.ps1).
$Sites = @(
    @{ code = 'agw'; db = 'car-gear-world'; layout = 'new' },
    @{ code = 'tgw'; db = 'technology-gear-world'; layout = 'new' },
    @{ code = 'vgw'; db = 'travel-gear-world'; layout = 'new' },
    @{ code = 'sgw'; db = 'sporty-gear-world'; layout = 'new' },
    @{ code = 'bgw'; db = 'biker-gear-world'; layout = 'new' },
    @{ code = 'pgw'; db = 'gaming-gear-world'; layout = 'new' },
    @{ code = 'zgw'; db = 'pets-gear-world'; layout = 'new' },
    @{ code = 'cgw'; db = 'construction-gear-customers'; layout = 'old' },
    @{ code = 'mgw'; db = 'mens-gear-world'; layout = 'old' },
    @{ code = 'wgw'; db = 'womens-gear-world'; layout = 'old' },
    @{ code = 'kgw'; db = 'kids-gear-world'; layout = 'old' },
    @{ code = 'hgw'; db = 'home-gear-world'; layout = 'old' },
    @{ code = 'ggw'; db = 'garden-gear-world'; layout = 'old' }
)
# The migration file of each layout, and the columns its products table must have (so a database of the other layout,
# or a wrong name, is never touched).
$Expect = @{
    new = @{ file = '0004_product_images.sql'; columns = @('category_slug', 'first_seen_at', 'last_seen_at', 'in_stock', 'image_url') }
    old = @{ file = '0002_product_images.sql'; columns = @('site_category', 'stock_status', 'created_at', 'updated_at', 'image_url') }
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
    $file = Join-Path $OutDir ('D1_PHOTO_COLUMN_{0}_{1}.txt' -f $kind, $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('D1_PHOTO_COLUMN_{0}_{1}_{2}.txt' -f $kind, $stamp, $n); $n++ }
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
# The characters & | < > ^ % never go to the command line: the statement goes in a file (--file).
# -Retry: on a network error try again, up to 3 times (only for calls that are safe to repeat).
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-d1-photos-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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

# The columns of products, read from SQLite's own list (pragma_table_info: no SELECT of a column that may not exist).
$ColumnsSql = "SELECT name FROM pragma_table_info('products')"

# The ways back, for the databases of $items (@{ site; bookmark }).
function Get-RollbackLines($items) {
    $lines = @(
        'Επαναφορά (αν χρειαστεί): συνήθως τίποτα. Η στήλη δεν πειράζει τίποτα και τα sites δουλεύουν και χωρίς τα δεδομένα της.',
        '  Αν πρέπει να φύγει, η επαναφορά είναι το σημείο επαναφοράς (Time Travel) παρακάτω.',
        '  Τα sites τη βρίσκουν μόνα τους (κάθε 10 λεπτά): χωρίς αυτή διαβάζουν ακριβώς όπως πριν, χωρίς ανέβασμα κώδικα.',
        '  Αν πρέπει να φύγει, ΜΟΝΟ με έγκριση, από τον φάκελο:',
        ('     cd "{0}"' -f $dest),
        '  A) όλη η βάση όπως ήταν πριν από τη στήλη (αναιρεί και κάθε εισαγωγή μετά· ισχύει 30 μέρες με Workers Paid):'
    )
    foreach ($t in $items) {
        $bm = '<bookmark>'
        if ($t.bookmark) { $bm = $t.bookmark }
        $lines += ('     npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $t.site.db, $bm)
    }
    $lines += '  Η επαναφορά της στήλης είναι το A (Time Travel). ΟΧΙ DROP COLUMN: ξαναγράφει κάθε γραμμή του πίνακα και στις'
    $lines += '  μεγάλες βάσεις (HGW, WGW) μπορεί να ξεπεράσει τα χρονικά όρια της D1.'
    return $lines
}

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply) { $mode = 'APPLY (με έγκριση)' }
if ($Verify) { $mode = 'ΕΛΕΓΧΟΣ (μόνο ανάγνωση)' }
Say ('D1 ΣΤΗΛΗ ΦΩΤΟΓΡΑΦΙΩΝ (L206) - {0} - {1}' -f $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) $Ok
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
# Each site's statement: exactly the one of its migration file, or nothing is touched.
foreach ($s in $run) {
    $file = Join-Path (Join-Path (Join-Path (Join-Path $repo 'sites') $s.code) 'migrations') $Expect[$s.layout].file
    $found = @()
    if (Test-Path -LiteralPath $file) { $found = @([System.IO.File]::ReadAllLines($file, [System.Text.Encoding]::UTF8) | Where-Object { $_.Trim() -and -not $_.StartsWith('--') } | ForEach-Object { $_.Trim() }) }
    if ($found.Count -ne 1 -or $found[0] -ne $Statement) {
        Say ('ΠΡΟΒΛΗΜΑ: δεν βρήκα την εντολή της στήλης στο sites\{0}\migrations\{1}. Δεν άλλαξε τίποτα.' -f $s.code, $Expect[$s.layout].file) $Bad
        Finish 3
    }
}
Say ('Βάσεις: {0}' -f (($run | ForEach-Object { '{0} ({1})' -f $_.code.ToUpper(), $_.db }) -join ', '))
Say ('Εντολή: {0}' -f $Statement)

# wrangler of this repo version (npm ci once per version). No wrangler config here: each database is found by its name.
$ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
$dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    foreach ($item in @('package.json', 'package-lock.json')) { Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Force }
}
if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
    Write-Host 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-d1-photos-npm-ci.cmd'
    [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
    & $cmdFile
    $code = $LASTEXITCODE
    Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
}

# 1. Each database: the columns of its products table (only SELECT)
$problems = 0
$missing = New-Object System.Collections.Generic.List[string]
$todo = New-Object System.Collections.ArrayList
Say ''
Say '1. Τι υπάρχει τώρα (μόνο ανάγνωση):'
foreach ($s in $run) {
    $r = Select-Rows $s.db $ColumnsSql
    if (-not $r.ok) {
        if ($r.text -match '(?i)not authenticated|wrangler login') { Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 4 }
        Say ('  {0} ({1}): ΠΡΟΒΛΗΜΑ - δεν διάβασα τη βάση. Έξοδος:' -f $s.code.ToUpper(), $s.db) $Bad
        foreach ($line in @($r.text -split "`n" | Select-Object -Last 6)) { Say ('      ' + $line) }
        $problems++
        $missing.Add($s.code.ToUpper())
        continue
    }
    $cols = @($r.rows | ForEach-Object { ([string]$_.name).ToLowerInvariant() })
    if ($cols.Count -eq 0) { Say ('  {0} ({1}): ΠΡΟΒΛΗΜΑ - δεν έχει πίνακα products. Δεν την αγγίζω.' -f $s.code.ToUpper(), $s.db) $Bad; $problems++; $missing.Add($s.code.ToUpper()); continue }
    # The table of the layout this site has (L28): its own columns. Another layout is never touched.
    $lack = @($Expect[$s.layout].columns | Where-Object { $cols -notcontains $_ })
    if ($lack.Count -gt 0) {
        Say ('  {0} ({1}): ΠΡΟΒΛΗΜΑ - ο πίνακας products δεν έχει τις στήλες {2} ({3}). Δεν την αγγίζω.' -f $s.code.ToUpper(), $s.db, ($lack -join ', '), $(if ($s.layout -eq 'old') { 'παλιά μορφή' } else { 'νέα μορφή' })) $Bad
        $problems++
        $missing.Add($s.code.ToUpper())
        continue
    }
    if ($cols -contains 'images') { Say ('  {0} ({1}): έχει ήδη τη στήλη images: ΕΝΤΑΞΕΙ (δεν αλλάζει)' -f $s.code.ToUpper(), $s.db) $Ok; continue }
    $missing.Add($s.code.ToUpper())
    if ($Verify) { Say ('  {0} ({1}): ΛΕΙΠΕΙ η στήλη images' -f $s.code.ToUpper(), $s.db) $Bad; continue }
    [void]$todo.Add(@{ site = $s; bookmark = '' })
    Say ('  {0} ({1}): δεν έχει ακόμα τη στήλη images ({2} στήλες): θα μπει' -f $s.code.ToUpper(), $s.db, $cols.Count) $Warn
}

if ($Verify) {
    Say ''
    if ($missing.Count -gt 0) {
        Say ('Έλεγχος στήλης: ΠΡΟΒΛΗΜΑ - λείπει ή δεν διαβάστηκε σε: {0}. Τα sites εκεί δείχνουν μία φωτογραφία, όπως πριν (L206).' -f ($missing -join ', ')) $Bad
        Say ('Για να μπει: tools/d1-photo-column.ps1 με -Apply και «{0}».' -f $Phrase) $Bad
        Finish 9
    }
    Say ('Έλεγχος στήλης: υπάρχει σε {0}: ΕΝΤΑΞΕΙ' -f (($run | ForEach-Object { $_.code.ToUpper() }) -join ', ')) $Ok
    Finish 0
}

# 2. The plan
Say ''
Say ('2. Πλάνο (φράση: {0}):' -f $Phrase)
if ($todo.Count -eq 0) { Say '  Καμία βάση δεν χρειάζεται αλλαγή.' }
else {
    Say ('  a. Αντίγραφο ασφαλείας: σημείο επαναφοράς (Cloudflare Time Travel) και το σχήμα κάθε βάσης σε αρχεία με ημερομηνία, στο {0}' -f (Join-Path $WorkDir 'backups'))
    Say ('  b. Σε {0} βάσεις, μία-μία: {1}' -f $todo.Count, (($todo | ForEach-Object { $_.site.code.ToUpper() }) -join ', '))
    Say ('     {0}' -f $Statement)
    Say '     Μία στήλη χωρίς τιμή στο τέλος του πίνακα: καμία γραμμή προϊόντος δεν ξαναγράφεται, κανένα ευρετήριο, όψη ή trigger δεν αλλάζει.'
    Say '     Εγγραφές στη D1: σχεδόν καμία (μόνο το κείμενο του πίνακα), μία φορά. Οι φωτογραφίες μπαίνουν με τις επόμενες εισαγωγές.'
    Say '  c. Έλεγχος ότι κάθε βάση έχει τη στήλη.'
    Say '  Τα sites τη βρίσκουν μόνα τους μέσα σε 10 λεπτά· η σειρά με το ALL UPDATES δεν έχει σημασία.'
    foreach ($line in (Get-RollbackLines $todo)) { Say ('  ' + $line) }
}

if (-not $Apply) {
    Say ''
    if ($problems -gt 0) { Say 'Αποτέλεσμα: ΠΡΟΣΟΧΗ (δες τα παραπάνω). Δεν άλλαξε τίποτα.' $Warn; Finish 2 }
    Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ (μόνο έλεγχος, δεν άλλαξε τίποτα)' $Ok
    if ($todo.Count -gt 0) { Say ('Για την αλλαγή: -Apply και η φράση {0}' -f $Phrase) }
    Finish 0
}

# ================= apply =================
if ($problems -gt 0) { Say ''; Say 'Υπάρχουν προβλήματα (δες τα παραπάνω): ΔΕΝ αλλάζω τίποτα.' $Bad; Finish 8 }
if ($todo.Count -eq 0) { Say ''; Say 'Τίποτα να αλλάξει: όλες οι βάσεις έχουν ήδη τη στήλη. ΕΝΤΑΞΕΙ' $Ok; Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say ''; Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' $Warn; Finish 1 }
Say ''
Say 'Έγκριση: ΕΝΤΑΞΕΙ.' $Ok

# a. Backup: a Time Travel restore point and the schema of every database, before any change
$bdir = Join-Path $WorkDir 'backups'
if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
foreach ($t in $todo) {
    $s = $t.site
    $tt = Invoke-Wrangler $dest ('d1 time-travel info {0}' -f $s.db) -Retry
    $bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
    if ($tt.code -ne 0 -or -not $bm.Success) {
        Say ('a. Δεν πήρα σημείο επαναφοράς της {0}: ΔΕΝ άλλαξε καμία βάση.' -f $s.db) $Bad
        foreach ($line in @($tt.text -split "`n" | Select-Object -Last 6)) { Say ('      ' + $line) }
        Finish 11
    }
    $t.bookmark = $bm.Value
    $r = Select-Rows $s.db "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE tbl_name = 'products' ORDER BY type, name"
    if (-not $r.ok) { Say ('a. Δεν πήρα αντίγραφο του σχήματος της {0}: ΔΕΝ άλλαξε καμία βάση.' -f $s.db) $Bad; Finish 11 }
    $schemaFile = Join-Path $bdir ('{0}-sqlite_master-before-photo-column-{1}.json' -f $s.code, $stamp)
    $m = [regex]::Match($r.text, '(?m)^\s*\[')
    [System.IO.File]::WriteAllText($schemaFile, (Hide-Ids $r.text.Substring($m.Index)), (New-Object System.Text.UTF8Encoding($false)))
    $undo = Join-Path $bdir ('{0}-rollback-photo-column-{1}.txt' -f $s.code, $stamp)
    $note = @(('{0} ({1}): η στήλη των φωτογραφιών (μάθημα L206), {2}. bookmark: {3}' -f $s.code.ToUpper(), $s.db, (Get-Date -Format 'yyyy-MM-dd HH:mm'), $t.bookmark)) + @(Get-RollbackLines @($t))
    [System.IO.File]::WriteAllText($undo, ($note -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
    Say ('a. {0}: σημείο επαναφοράς και σχήμα: {1}' -f $s.code.ToUpper(), $undo) $Ok
}

# b. The column, one database at a time (stops at the first problem)
$done = New-Object System.Collections.Generic.List[string]
foreach ($t in $todo) {
    $s = $t.site
    $sqlFile = Join-Path $bdir ('{0}-add-photo-column-{1}.sql' -f $s.code, $stamp)
    [System.IO.File]::WriteAllText($sqlFile, $Statement + "`n", (New-Object System.Text.UTF8Encoding($false)))
    $x = Invoke-Wrangler $dest ('d1 execute {0} --remote --file "{1}"' -f $s.db, $sqlFile)
    if ($x.code -ne 0) {
        Say ('b. {0}: ΠΡΟΒΛΗΜΑ - η στήλη δεν μπήκε. Σταμάτησα εδώ. Μπήκε ήδη σε: {1}' -f $s.code.ToUpper(), $(if ($done.Count) { $done -join ', ' } else { 'καμία' })) $Bad
        foreach ($line in @($x.text -split "`n" | Select-Object -Last 8)) { Say ('     ' + $line) }
        Finish 12
    }
    $done.Add($s.code.ToUpper())
    Say ('b. {0}: μπήκε η στήλη images.' -f $s.code.ToUpper()) $Ok
}

# c. Check: every database has the column
$bad = @()
foreach ($t in $todo) {
    $r = Select-Rows $t.site.db $ColumnsSql
    $have = @($r.rows | Where-Object { ([string]$_.name).ToLowerInvariant() -eq 'images' }).Count
    if (-not $r.ok -or $have -ne 1) { $bad += $t.site.code.ToUpper() }
}
Say ''
if ($bad.Count -gt 0) { Say ('c. Έλεγχος: ΠΡΟΣΟΧΗ - δεν βλέπω τη στήλη σε: {0}. Τα sites εκεί δείχνουν μία φωτογραφία, όπως πριν. Στείλε στο Claude αυτή την αναφορά.' -f ($bad -join ', ')) $Warn; Finish 13 }
Say ('c. Έλεγχος: η στήλη υπάρχει σε {0}: ΕΝΤΑΞΕΙ' -f ($done -join ', ')) $Ok
Say ''
foreach ($line in (Get-RollbackLines $todo)) { Say $line }
Say ''
Say 'Τα sites τη βρίσκουν μόνα τους μέσα σε 10 λεπτά. Οι φωτογραφίες μπαίνουν με τις επόμενες λήψεις feeds και εισαγωγές (L206).'
Say 'Αποτέλεσμα: ΕΤΟΙΜΟ' $Ok
Finish 0
