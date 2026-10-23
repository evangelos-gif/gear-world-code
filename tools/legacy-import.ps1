<#
.SYNOPSIS
  Imports a new retailer into ONE older Gear World site (CGW, MGW, WGW, KGW, HGW or GGW) - from the read-only import plan, with a typed approval.

.DESCRIPTION
  Without -Apply: READ-ONLY. Makes the import plan (tools/legacy-import-plan.mjs) from the Awin feed on this PC,
  reads the site database (how many products of this retailer it already has, that the table layout is the
  expected one) and shows what WOULD be added. Changes nothing.

  With -Apply and the approval phrase (ΕΓΚΡΙΝΩ <RETAILER> <SITE>, e.g. ΕΓΚΡΙΝΩ COES MGW):
    1. Takes a Cloudflare Time Travel restore point of the site database and writes it to a backup note.
    2. Loads the plan's SQL files one by one (INSERT or UPDATE of this retailer's products only; nothing is deleted).
       Stops at the first error.
    3. Counts this retailer's products per category in the database and compares them with the plan.
  It changes ONLY the products of this retailer in this one site's database. No code, no other site, no deploy.
  An add-only plan (e.g. Joybuy beauty for WGW, where Joybuy is already on the site) adds and updates only the
  products in the plan and hides nothing; its quick undo hides only the products it added.

  Rollback (printed at the end): remove only this retailer's products, or restore the restore point.
  Report: <home>\gear-world-reports\IMPORT_<RETAILER>_<SITE>_<time>.txt (also copied to the clipboard)
#>
param(
    [Parameter(Mandatory = $true)][string]$Retailer,
    [Parameter(Mandatory = $true)][ValidateSet('cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw')][string]$Site,
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Archive = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Retailer = $Retailer.ToLower()
$SiteInfo = @{
    cgw = @{ db = 'construction-gear-customers'; domain = 'constructiongearworld.com'; work = 'construction-gear-world-engine'; key = 'awin' }
    mgw = @{ db = 'mens-gear-world'; domain = 'mensgearworld.com'; work = 'mens-gear-world-engine'; key = 'awin' }
    wgw = @{ db = 'womens-gear-world'; domain = 'womensgearworld.com'; work = 'womens-gear-world-engine'; key = 'awin' }
    kgw = @{ db = 'kids-gear-world'; domain = 'kidsgearworld.com'; work = 'kids-gear-world-engine'; key = 'stable' }
    hgw = @{ db = 'home-gear-world'; domain = 'homegearworld.com'; work = 'home-gear-world-engine'; key = 'stable' }
    ggw = @{ db = 'garden-gear-world'; domain = 'gardengearworld.com'; work = 'garden-gear-world-engine'; key = 'stable' }
}
$DbName = $SiteInfo[$Site].db
$Domain = $SiteInfo[$Site].domain
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $WorkDir) {
    $WorkDir = Join-Path $HOME $SiteInfo[$Site].work
    if (-not (Test-Path -LiteralPath $WorkDir)) { $WorkDir = Join-Path $HOME 'gear-world-import' }
}
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('IMPORT_{0}_{1}_{2}.txt' -f $Retailer.ToUpper(), $Site.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('IMPORT_{0}_{1}_{2}_{3}.txt' -f $Retailer.ToUpper(), $Site.ToUpper(), $stamp, $n); $n++ }
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
        Write-Host '(ή πάτα Enter για να σταματήσω χωρίς αλλαγές)'
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
# -Retry: on a network error, or a passing Cloudflare 'account not authorized' (7403, seen on 23 Oct 2026 between two
# successful calls), try again, up to 3 times. Only for calls that are safe to repeat.
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tmp = [System.IO.Path]::GetTempPath()
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
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
        $network = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|code: 7403'
        if ($code -eq 0 -or -not $network -or $try -eq $tries) { break }
        Say ('Πρόβλημα δικτύου με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/{2})...' -f (5 * $try), ($try + 1), $tries) 'Yellow'
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

# Read-only SELECT on the site database. Returns the rows, or $null on error.
function Select-Rows([string]$sql) {
    if ($sql -notmatch '^\s*SELECT ') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --json --command "{1}"' -f $DbName, $sql) -Retry
    if ($r.code -ne 0) { Say $r.text; return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { Say $r.text; return $null }
    return @($j[0].results)
}

Write-Host ''
$mode = 'ΔΟΚΙΜΗ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ'
if ($Apply) { $mode = 'ΕΙΣΑΓΩΓΗ (με έγκριση)' }
Say ('Εισαγωγή {0} στο {1} ({2}) - {3}' -f $Retailer, $Site.ToUpper(), $Domain, $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
if ($Retailer -notmatch '^[a-z0-9\-]{2,40}$') { Say 'Λάθος όνομα καταστήματος.' 'Red'; Finish 2 }
if (-not (Test-Path -LiteralPath (Join-Path (Join-Path (Join-Path $repo 'tools') 'import-rules') ($Retailer + '.mjs')))) { Say ('Δεν υπάρχουν κανόνες για: {0}' -f $Retailer) 'Red'; Finish 2 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js.' 'Red'; Finish 3 }
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }

# 1. The Awin archive on this PC (found automatically).
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

# 2. The plan (read-only).
$planDir = Join-Path $OutDir ('IMPORT_PLAN_{0}_{1}' -f $Retailer, $stamp)
$k = 2
while (Test-Path -LiteralPath $planDir) { $planDir = Join-Path $OutDir ('IMPORT_PLAN_{0}_{1}_{2}' -f $Retailer, $stamp, $k); $k++ }
Write-Host 'Φτιάχνω το σχέδιο από το feed (1-3 λεπτά)...'
& node (Join-Path (Join-Path $repo 'tools') 'legacy-import-plan.mjs') --archive $Archive --retailer $Retailer --out $planDir | Out-Null
if ($LASTEXITCODE -ne 0) { Say 'Το σχέδιο απέτυχε (δεν βρέθηκε feed ή λάθος στο αρχείο).' 'Red'; Finish 10 }
$plan = [System.IO.File]::ReadAllText((Join-Path $planDir 'plan.json'), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$sp = $plan.sites.$Site
if ($null -eq $sp -or [int]$sp.products -lt 1) { Say ('Το σχέδιο δεν έχει προϊόντα για το {0}.' -f $Site.ToUpper()) 'Red'; Finish 10 }
$RetailerName = [string]$plan.retailer
if ($RetailerName -notmatch "^[A-Za-z0-9 .\-]{2,40}$") { Say 'Μη αναμενόμενο όνομα καταστήματος στο σχέδιο.' 'Red'; Finish 10 }
# An add-only plan covers only part of a shop that is already on the site (e.g. Joybuy beauty): it never hides the rest.
$AddOnly = $false
if (($plan.PSObject.Properties.Name -contains 'addOnly') -and $plan.addOnly) { $AddOnly = $true }
$files = @(Get-ChildItem -LiteralPath (Join-Path (Join-Path $planDir 'sql') $Site) -Filter '*.sql' | Sort-Object Name)
Say ('Σχέδιο: {0} προϊόντα {1} για το {2}, σε {3} αρχεία SQL. Πλήρες σχέδιο: {4}' -f $sp.products, $RetailerName, $Site.ToUpper(), $files.Count, (Join-Path $planDir 'report.txt'))
foreach ($p in $sp.byCategory.PSObject.Properties) { Say ('  {0,-26} {1}' -f $p.Name, $p.Value) }

# 3. The site database now (read-only).
# The unique key the plan's SQL uses must exist: awin_product_id UNIQUE (CGW, MGW, WGW), or the (retailer, merchant id)
# index for every retailer (KGW, HGW, GGW). (No > or < here: the wrangler call refuses them.)
if ($SiteInfo[$Site].key -eq 'stable') {
    $layout = Select-Rows "SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'ux_products_refresh_stable_key' AND instr(sql, 'products(retailer, merchant_product_id)') BETWEEN 1 AND 1000000 AND instr(sql, 'retailer IN') = 0"
} else {
    $layout = Select-Rows "SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'products' AND instr(sql, 'awin_product_id TEXT NOT NULL UNIQUE') BETWEEN 1 AND 1000000"
}
if ($null -eq $layout) { Say 'Δεν μπόρεσα να διαβάσω τη βάση (σύνδεση στο Cloudflare;). Δεν άλλαξε τίποτα.' 'Red'; Finish 4 }
if ([int]$layout[0].n -ne 1) { Say 'Ο πίνακας products δεν έχει τη μορφή που περιμένω. Σταματώ χωρίς αλλαγές.' 'Red'; Finish 5 }
$before = Select-Rows ("SELECT COUNT(*) AS n, SUM(is_active) AS active FROM products WHERE retailer = '{0}'" -f $RetailerName)
$total = Select-Rows 'SELECT COUNT(*) AS n FROM products WHERE is_active = 1'
if ($null -eq $before -or $null -eq $total) { Say 'Δεν μπόρεσα να διαβάσω τη βάση. Δεν άλλαξε τίποτα.' 'Red'; Finish 4 }
$hadBefore = [int]$before[0].n
Say ('Βάση {0}: {1} ενεργά προϊόντα συνολικά, {2} από {3} ήδη.' -f $DbName, $total[0].n, $hadBefore, $RetailerName)

# What the database has for this retailer, compared with the plan (read-only). Products no longer in the plan
# (sold out in every size, or gone from the shop) are hidden after loading; nothing is deleted.
$cur = Invoke-Wrangler $WorkDir ("d1 execute {0} --remote --json --command `"SELECT id, awin_product_id, is_active FROM products WHERE retailer = '{1}'`"" -f $DbName, $RetailerName) -Retry
if ($cur.code -ne 0 -or $cur.text.IndexOf('[') -lt 0) { Say 'Δεν μπόρεσα να διαβάσω τα προϊόντα του καταστήματος. Δεν άλλαξε τίποτα.' 'Red'; Say $cur.text; Finish 4 }
$diffDir = Join-Path $planDir ('diff-' + $Site)
New-Item -ItemType Directory -Path $diffDir -Force | Out-Null
$curFile = Join-Path $diffDir 'database.json.txt'
[System.IO.File]::WriteAllText($curFile, $cur.text, (New-Object System.Text.UTF8Encoding($false)))
& node (Join-Path (Join-Path $repo 'tools') 'legacy-import-diff.mjs') (Join-Path (Join-Path (Join-Path $planDir 'sql') $Site) 'ids.txt') $curFile $diffDir
if ($LASTEXITCODE -ne 0) { Say 'Η σύγκριση με τη βάση απέτυχε. Δεν άλλαξε τίποτα.' 'Red'; Finish 10 }
$d = ([System.IO.File]::ReadAllText((Join-Path $diffDir 'diff.txt'))).Trim() -split '\s+'
$goneN = [int]$d[3]
$hideGone = ($d[5] -eq '1')
if ($AddOnly) {
    $hideGone = $false
    Say ('Σύγκριση με τη βάση: {0} νέα, {1} ενημέρωση τιμής/στοιχείων, {2} επιστρέφουν.' -f $d[0], $d[1], $d[2])
    Say ('Το σχέδιο καλύπτει μόνο ένα μέρος του {0}: τα άλλα {1} ενεργά προϊόντα του στο site μένουν όπως είναι (δεν κρύβεται τίποτα).' -f $RetailerName, $goneN)
} else {
    Say ('Σύγκριση με τη βάση: {0} νέα, {1} ενημέρωση τιμής/στοιχείων, {2} επιστρέφουν, {3} δεν είναι πια στο feed ή εξαντλήθηκαν.' -f $d[0], $d[1], $d[2], $goneN)
    if ($goneN -gt 0 -and -not $hideGone) {
        Say ('ΠΡΟΣΟΧΗ: λείπουν πάνω από τα μισά από τα {0} ενεργά προϊόντα. Μάλλον το feed δεν κατέβηκε ολόκληρο, οπότε ΔΕΝ θα κρυφτούν.' -f $d[4]) 'Yellow'
    }
}

Say ''
Say 'Τι θα γίνει με -Apply:'
Say ('  - Σημείο επαναφοράς (Cloudflare Time Travel) της βάσης {0}, γραμμένο στο {1}' -f $DbName, (Join-Path $WorkDir 'backups'))
Say ('  - Προσθήκη ή ενημέρωση {0} προϊόντων {1}. Δεν σβήνεται τίποτα, κανένα άλλο κατάστημα δεν αλλάζει.' -f $sp.products, $RetailerName)
if ($goneN -gt 0 -and $hideGone) { Say ('  - Απόκρυψη {0} προϊόντων {1} που δεν είναι πια στο feed ή εξαντλήθηκαν (με αρχείο επαναφοράς).' -f $goneN, $RetailerName) }
if ($AddOnly) { Say ('  - Τα άλλα προϊόντα {0} στο site δεν αλλάζουν και δεν κρύβεται κανένα.' -f $RetailerName) }
Say ('  - Αλλάζει ΜΟΝΟ η βάση του {0}. Κανένας κώδικας, κανένα άλλο site, κανένα deploy.' -f $Site.ToUpper())
$phrase = 'ΕΓΚΡΙΝΩ {0} {1}' -f $Retailer.ToUpper(), $Site.ToUpper()
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Say ('Η φράση έγκρισης για την εισαγωγή: {0}' -f $phrase); Finish 0 }
if (-not (Confirm-Approval $phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# 4. Backup: D1 cannot export databases with search (FTS5) tables, so the backup is a Time Travel restore point.
$bdir = Join-Path $WorkDir 'backups'
if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
$tt = Invoke-Wrangler $WorkDir ('d1 time-travel info {0}' -f $DbName) -Retry
$bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
if ($tt.code -ne 0 -or -not $bm.Success) { Say 'Δεν πήρα σημείο επαναφοράς: ΔΕΝ φόρτωσα τίποτα.' 'Red'; Say $tt.text; Finish 11 }
$restoreCmd = 'npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $DbName, $bm.Value
$removeCmd = ('npx wrangler d1 execute {0} --remote --command "DELETE FROM products WHERE retailer = ''{1}''"' -f $DbName, $RetailerName)
# When the shop was already on the site (or the plan is add-only), removing all its products would also remove the old ones:
# the quick undo then hides only the products this import ADDS (by their awin_product_id).
$undoNew = ''
$addedUndoSrc = Join-Path $diffDir 'rollback-added.sql'
if ([int]$d[0] -gt 0 -and (Test-Path -LiteralPath $addedUndoSrc)) {
    $addedUndo = Join-Path $bdir ('{0}-{1}-added-{2}-rollback.sql' -f $Site, $Retailer, $stamp)
    Copy-Item -LiteralPath $addedUndoSrc -Destination $addedUndo -Force
    $undoNew = 'npx wrangler d1 execute {0} --remote --file "{1}"' -f $DbName, $addedUndo
}
$quickUndo = $removeCmd
$quickUndoText = 'remove only the {0} products' -f $RetailerName
if ($hadBefore -gt 0 -or $AddOnly) {
    $quickUndo = $undoNew
    $quickUndoText = 'hide only the {0} products this import adds' -f $RetailerName
    if (-not $quickUndo) { $quickUndo = $restoreCmd; $quickUndoText = 'the whole database as it was' }
}
$backup = Join-Path $bdir ('{0}-restore-point-before-{1}-import-{2}.txt' -f $Site, $Retailer, $stamp)
$note = @(
    ('{0} database restore point before the {1} import, {2}' -f $Site.ToUpper(), $RetailerName, (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    ('bookmark: {0}' -f $bm.Value),
    ('{0} products of {1} were in the database before the import.' -f $hadBefore, $RetailerName),
    'To go back, ONLY with approval, run in PowerShell one of:',
    ('  cd "{0}"' -f $WorkDir),
    ('  A) {0}:  {1}' -f $quickUndoText, $quickUndo),
    ('  B) the whole database as it was:  {0}' -f $restoreCmd),
    'B also undoes any other change made to the database after this moment. Valid for 7 days (Free) or 30 days (Paid).'
) -join "`r`n"
[System.IO.File]::WriteAllText($backup, $note, (New-Object System.Text.UTF8Encoding($false)))
Say ('Σημείο επαναφοράς: {0}' -f $backup) 'Green'

# 5. Load. Every file is INSERT ... ON CONFLICT DO UPDATE, so repeating one after a network error is safe.
$n = 0
foreach ($f in $files) {
    $x = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --file "{1}"' -f $DbName, $f.FullName) -Retry
    if ($x.code -ne 0) {
        Say ('Λάθος στο {0}. Σταμάτησα. Τα προηγούμενα αρχεία φορτώθηκαν.' -f $f.Name) 'Red'
        Say $x.text
        Say ('Επαναφορά (μόνο με έγκριση): {0}' -f $quickUndo)
        Finish 12
    }
    $n++
    Write-Host ('  {0} OK' -f $f.Name)
}
Say ('Φορτώθηκαν {0} αρχεία SQL.' -f $n) 'Green'

if ($goneN -gt 0 -and $hideGone) {
    $goneUndo = Join-Path $bdir ('{0}-{1}-gone-{2}-rollback.sql' -f $Site, $Retailer, $stamp)
    Copy-Item -LiteralPath (Join-Path $diffDir 'rollback-gone.sql') -Destination $goneUndo -Force
    Copy-Item -LiteralPath (Join-Path $diffDir 'gone-ids.txt') -Destination ($goneUndo -replace 'rollback\.sql$', 'ids.txt') -Force
    $g = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --file "{1}"' -f $DbName, (Join-Path $diffDir 'hide-gone.sql')) -Retry
    if ($g.code -ne 0) { Say 'Λάθος στην απόκρυψη όσων εξαντλήθηκαν. Τα νέα προϊόντα και οι τιμές φορτώθηκαν.' 'Red'; Say $g.text; Finish 12 }
    Say ('Κρύφτηκαν {0} προϊόντα που δεν είναι πια στο feed. Επαναφορά τους: npx wrangler d1 execute {1} --remote --file "{2}"' -f $goneN, $DbName, $goneUndo) 'Green'
}

# 6. Check.
$after = Select-Rows ("SELECT site_category, COUNT(*) AS n FROM products WHERE retailer = '{0}' AND is_active = 1 GROUP BY site_category ORDER BY n DESC" -f $RetailerName)
$sum = 0
if ($after) { foreach ($r in $after) { Say ('  {0,-26} {1}' -f $r.site_category, $r.n); $sum += [int]$r.n } }
if ($sum -lt [int]$sp.products) {
    Say ('ΠΡΟΣΟΧΗ: στη βάση βλέπω {0} ενεργά προϊόντα {1}, το σχέδιο είχε {2}. Στείλε την αναφορά στο Claude.' -f $sum, $RetailerName, $sp.products) 'Yellow'
    Finish 13
}
Say ''
Say ('ΕΤΟΙΜΟ: {0} προϊόντα {1} στο {2}.' -f $sum, $RetailerName, $Site.ToUpper()) 'Green'
Say ('Δες τα: https://{0}/?search={1} (η αρχική και οι κατηγορίες ανανεώνονται μέσα σε λίγα λεπτά)' -f $Domain, $RetailerName)
if ($hadBefore -gt 0 -or $AddOnly) {
    # A refresh: the products were there before, so going back means hiding only the new ones, or the restore point.
    if ($undoNew) { Say ('Αν χρειαστεί επαναφορά (μόνο με έγκριση), κρύβει μόνο τα νέα προϊόντα: {0}' -f $undoNew) }
    Say ('Επαναφορά όλης της βάσης όπως ήταν (μόνο με έγκριση): {0}' -f $restoreCmd)
} else {
    Say ('Αν χρειαστεί επαναφορά (μόνο με έγκριση): {0}' -f $removeCmd)
}
Finish 0
