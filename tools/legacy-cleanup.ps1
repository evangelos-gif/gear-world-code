<#
.SYNOPSIS
  Clean-up of products already on ONE older Gear World site (MGW, WGW or KGW): hides products that should not be shown.

.DESCRIPTION
  Rules: tools/cleanup-rules/<rules>.mjs (-Rules instock): one card per product instead of one per size and colour,
  smartwatch straps, films and spare parts out of Watches, political party merchandise.
  -Rules family (KGW, a site for parents): medicines, food supplements, adult clothing and items for the mother.

  Without -Apply: READ-ONLY. Counts what WOULD be hidden, per reason and category, with samples. Changes nothing.
  With -Apply and the approval phrase (ΕΓΚΡΙΝΩ <RULES> CLEANUP <SITE>, e.g. ΕΓΚΡΙΝΩ INSTOCK CLEANUP MGW):
    1. Saves the list of products to hide and a rollback file on this PC, and takes a Cloudflare Time Travel restore point.
    2. Hides them (is_active = 0). Nothing is deleted.
    3. Counts again: nothing that matches the rules should be left.
  Rollback: the saved rollback file shows them again (is_active = 1), or the restore point.
  Report: <home>\gear-world-reports\CLEANUP_<RULES>_<SITE>_<time>.txt (also copied to the clipboard)
#>
param(
    [Parameter(Mandatory = $true)][string]$Rules,
    [Parameter(Mandatory = $true)][ValidateSet('mgw', 'wgw', 'kgw', 'hgw')][string]$Site,
    [switch]$Apply,
    [string]$Approve = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Rules = $Rules.ToLower()
$SiteInfo = @{
    mgw = @{ db = 'mens-gear-world'; domain = 'mensgearworld.com'; work = 'mens-gear-world-engine' }
    wgw = @{ db = 'womens-gear-world'; domain = 'womensgearworld.com'; work = 'womens-gear-world-engine' }
    kgw = @{ db = 'kids-gear-world'; domain = 'kidsgearworld.com'; work = 'kids-gear-world-engine' }
    hgw = @{ db = 'home-gear-world'; domain = 'homegearworld.com'; work = 'home-gear-world-engine' }
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
    $file = Join-Path $OutDir ('CLEANUP_{0}_{1}_{2}.txt' -f $Rules.ToUpper(), $Site.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('CLEANUP_{0}_{1}_{2}_{3}.txt' -f $Rules.ToUpper(), $Site.ToUpper(), $stamp, $n); $n++ }
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
# -Retry: on a network error try again, up to 3 times. Only for calls that are safe to repeat.
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
        # wrangler writes UTF-8. Windows PowerShell reads a program's output with the console code page (850, 737...),
        # which turned Kids + right single quote into 'KidsÔÇÖ' and those names were written back to the database. Read it as UTF-8.
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
        $network = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up'
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
    if ($sql -notmatch '^\s*(SELECT|WITH) ' -or $sql -match '(?i)\b(UPDATE|INSERT|DELETE|DROP|ALTER|CREATE|REPLACE INTO)\b') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --json --command "{1}"' -f $DbName, $sql) -Retry
    if ($r.code -ne 0) { Say $r.text; return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { Say $r.text; return $null }
    # The comma keeps an empty result as an empty list (not $null, which means an error here).
    return ,@($j[0].results)
}


function Rule-Sql([string]$what) {
    $out = @(& node $rulesFile $what)
    if ($LASTEXITCODE -ne 0) { throw 'rules failed' }
    return (($out -join ' ').Trim())
}

Write-Host ''
$mode = 'ΔΟΚΙΜΗ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ'
if ($Apply) { $mode = 'ΚΑΘΑΡΙΣΜΑ (με έγκριση)' }
Say ('Καθάρισμα προϊόντων ({0}) στο {1} ({2}) - {3}' -f $Rules, $Site.ToUpper(), $Domain, $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
if ($Rules -notmatch '^[a-z0-9\-]{2,40}$') { Say 'Λάθος όνομα κανόνων.' 'Red'; Finish 2 }
$rulesFile = Join-Path (Join-Path (Join-Path $repo 'tools') 'cleanup-rules') ($Rules + '.mjs')
if (-not (Test-Path -LiteralPath $rulesFile)) { Say ('Δεν υπάρχουν κανόνες: {0}' -f $Rules) 'Red'; Finish 2 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js.' 'Red'; Finish 3 }
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }

# 1. What would be hidden (read-only).
$total = Select-Rows 'SELECT COUNT(*) AS n FROM products WHERE is_active = 1'
if ($null -eq $total) { Say 'Δεν μπόρεσα να διαβάσω τη βάση (σύνδεση στο Cloudflare;). Δεν άλλαξε τίποτα.' 'Red'; Finish 4 }
$sum = Select-Rows (Rule-Sql 'summary')
if ($null -eq $sum) { Say 'Ο έλεγχος απέτυχε. Δεν άλλαξε τίποτα.' 'Red'; Finish 4 }
$hide = 0
foreach ($r in $sum) { $hide += [int]$r.n }
Say ('Βάση {0}: {1} ενεργά προϊόντα. Θα κρύβονταν: {2}' -f $DbName, $total[0].n, $hide)
$lastReason = ''
foreach ($r in $sum) {
    if ($r.reason -ne $lastReason) { Say ('-- {0}' -f $r.reason); $lastReason = $r.reason }
    Say ('   {0,-26} {1}' -f $r.site_category, $r.n)
}
$samples = Select-Rows (Rule-Sql 'samples')
if ($samples) {
    Say ''
    Say 'Δείγματα (τυχαία) από όσα θα κρύβονταν:'
    $lastReason = ''
    foreach ($s in $samples) {
        if ($s.reason -ne $lastReason) { Say ('-- {0}' -f $s.reason); $lastReason = $s.reason }
        $name = [string]$s.product_name
        if ($name.Length -gt 110) { $name = $name.Substring(0, 110) + '...' }
        Say ('   - {0}' -f $name)
    }
}
$kept = Select-Rows (Rule-Sql 'kept')
if ($kept) {
    Say ''
    Say 'Μένουν ενεργά μετά το καθάρισμα, ανά κατηγορία:'
    foreach ($k in $kept) { Say ('   {0,-26} {1}' -f $k.site_category, $k.n) }
}
Say ''
Say 'Τι θα γίνει με -Apply:'
Say ('  - Λίστα των προϊόντων και αρχείο επαναφοράς στο {0}, και σημείο επαναφοράς (Cloudflare Time Travel)' -f (Join-Path $WorkDir 'backups'))
Say ('  - Απόκρυψη {0} προϊόντων (is_active = 0). Δεν σβήνεται τίποτα.' -f $hide)
Say ('  - Αλλάζει ΜΟΝΟ η βάση του {0}. Κανένας κώδικας, κανένα άλλο site, κανένα deploy.' -f $Site.ToUpper())
$phrase = 'ΕΓΚΡΙΝΩ {0} CLEANUP {1}' -f $Rules.ToUpper(), $Site.ToUpper()
if ($hide -lt 1) { Say ''; Say 'Δεν υπάρχει τίποτα να κρυφτεί.' 'Green'; Finish 0 }
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Say ('Η φράση έγκρισης: {0}' -f $phrase); Finish 0 }
if (-not (Confirm-Approval $phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# 2. The exact list, saved on this PC, plus the hide and the rollback files.
$bdir = Join-Path $WorkDir 'backups'
if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
$idRows = Select-Rows (Rule-Sql 'ids')
if ($null -eq $idRows -or $idRows.Count -lt 1) { Say 'Δεν πήρα τη λίστα των προϊόντων: δεν άλλαξε τίποτα.' 'Red'; Finish 11 }
$base = Join-Path $bdir ('{0}-cleanup-{1}-{2}' -f $Site, $Rules, $stamp)
$idsFile = $base + '-ids.txt'
$hideFile = $base + '-hide.sql'
$undoFile = $base + '-rollback.sql'
[System.IO.File]::WriteAllText($idsFile, ((@($idRows) | ForEach-Object { [string][int]$_.id }) -join "`n") + "`n", (New-Object System.Text.UTF8Encoding($false)))
& node $rulesFile update $idsFile 0 $hideFile
& node $rulesFile update $idsFile 1 $undoFile
if (-not (Test-Path -LiteralPath $hideFile) -or -not (Test-Path -LiteralPath $undoFile)) { Say 'Δεν γράφτηκαν τα αρχεία: δεν άλλαξε τίποτα.' 'Red'; Finish 11 }
$tt = Invoke-Wrangler $WorkDir ('d1 time-travel info {0}' -f $DbName) -Retry
$bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
if ($tt.code -ne 0 -or -not $bm.Success) { Say 'Δεν πήρα σημείο επαναφοράς: δεν άλλαξε τίποτα.' 'Red'; Say $tt.text; Finish 11 }
$undoCmd = 'npx wrangler d1 execute {0} --remote --file "{1}"' -f $DbName, $undoFile
$restoreCmd = 'npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $DbName, $bm.Value
$note = @(
    ('{0} database before the {1} clean-up, {2}' -f $Site.ToUpper(), $Rules, (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    ('bookmark: {0}' -f $bm.Value),
    ('{0} products hidden, list: {1}' -f $idRows.Count, $idsFile),
    'To go back, ONLY with approval, run in PowerShell one of:',
    ('  cd "{0}"' -f $WorkDir),
    ('  A) show the same products again:  {0}' -f $undoCmd),
    ('  B) the whole database as it was:  {0}' -f $restoreCmd),
    'B also undoes any other change made to the database after this moment.'
) -join "`r`n"
[System.IO.File]::WriteAllText($base + '-restore-point.txt', $note, (New-Object System.Text.UTF8Encoding($false)))
Say ('Λίστα και αρχείο επαναφοράς: {0}' -f ($base + '-*')) 'Green'

# 3. Hide (UPDATE by id only; repeating it is harmless).
$x = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --file "{1}"' -f $DbName, $hideFile) -Retry
if ($x.code -ne 0) { Say 'Λάθος στην απόκρυψη. Σταμάτησα.' 'Red'; Say $x.text; Say ('Επαναφορά (μόνο με έγκριση): {0}' -f $undoCmd); Finish 12 }

# 4. Check: nothing that matches the rules should be left.
$left = Select-Rows (Rule-Sql 'summary')
$leftN = 0
if ($left) { foreach ($r in $left) { $leftN += [int]$r.n } }
$now = Select-Rows 'SELECT COUNT(*) AS n FROM products WHERE is_active = 1'
if ($null -eq $left -or $leftN -gt 0) { Say ('ΠΡΟΣΟΧΗ: μένουν {0} προϊόντα που ταιριάζουν στους κανόνες. Στείλε την αναφορά στο Claude.' -f $leftN) 'Yellow'; Finish 13 }
Say ''
Say ('ΕΤΟΙΜΟ: κρύφτηκαν {0} προϊόντα. Ενεργά τώρα στο {1}: {2}' -f $idRows.Count, $Site.ToUpper(), $now[0].n) 'Green'
Say ('Δες το: https://{0}/ (η αρχική και οι κατηγορίες ανανεώνονται μέσα σε λίγα λεπτά)' -f $Domain)
Say ('Αν χρειαστεί επαναφορά (μόνο με έγκριση): {0}' -f $undoCmd)
Finish 0
