<#
.SYNOPSIS
  Tidy-up of products on ONE older Gear World site (MGW or WGW): cleaner names, products of the other site hidden.

.DESCRIPTION
  Rules: tools/cleanup-rules/tidy.mjs
    - InStock names lose the size/colour at the end ("Thermal Top - Black / M" -> "Thermal Top"). The old product
      address redirects to the new one (301), so no link breaks.
    - Women-only products on MGW and men-only products on WGW are hidden. "Mens & Ladies", unisex, couple stay.
  Without -Apply: READ-ONLY. Shows what WOULD change, with samples. Changes nothing.
  With -Apply and the approval phrase ΕΓΚΡΙΝΩ TIDY <SITE> (e.g. ΕΓΚΡΙΝΩ TIDY MGW): saves the change and rollback
  files on this PC, takes a Cloudflare Time Travel restore point, applies the change (by id), checks again.
  Nothing is deleted.
  Report: <home>\gear-world-reports\TIDY_<SITE>_<time>.txt (also copied to the clipboard)
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet('mgw', 'wgw')][string]$Site,
    [switch]$Apply,
    [string]$Approve = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$SiteInfo = @{
    mgw = @{ db = 'mens-gear-world'; domain = 'mensgearworld.com'; work = 'mens-gear-world-engine' }
    wgw = @{ db = 'womens-gear-world'; domain = 'womensgearworld.com'; work = 'womens-gear-world-engine' }
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
    $file = Join-Path $OutDir ('TIDY_{0}_{1}.txt' -f $Site.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('TIDY_{0}_{1}_{2}.txt' -f $Site.ToUpper(), $stamp, $n); $n++ }
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
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
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


# Read-only SELECT whose wrangler output is saved to a file (Node reads it; big results stay out of PowerShell JSON).
function Save-Rows([string]$part, [string]$file) {
    $sql = ((@(& node $tidy sql $Site $part)) -join ' ').Trim()
    if ($sql -notmatch '^\s*SELECT ' -or $sql -match '(?i)\b(UPDATE|INSERT|DELETE|DROP|ALTER|CREATE)\b') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --json --command "{1}"' -f $DbName, $sql) -Retry
    if ($r.code -ne 0 -or $r.text.IndexOf('[') -lt 0) { Say $r.text; return $false }
    [System.IO.File]::WriteAllText($file, $r.text, (New-Object System.Text.UTF8Encoding($false)))
    return $true
}

function Make-Plan([string]$dir) {
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $nf = Join-Path $dir 'names.json.txt'
    $gf = Join-Path $dir 'gender.json.txt'
    if (-not (Save-Rows 'names' $nf)) { return $null }
    if (-not (Save-Rows 'gender' $gf)) { return $null }
    & node $tidy plan $Site $nf $gf $dir
    if ($LASTEXITCODE -ne 0) { return $null }
    $c = ([System.IO.File]::ReadAllText((Join-Path $dir 'counts.txt'))).Trim() -split '\s+'
    return @{ hide = [int]$c[0]; rename = [int]$c[1]; text = [System.IO.File]::ReadAllText((Join-Path $dir 'plan.txt'), [System.Text.Encoding]::UTF8) }
}

Write-Host ''
$mode = 'ΔΟΚΙΜΗ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ'
if ($Apply) { $mode = 'ΑΛΛΑΓΗ (με έγκριση)' }
Say ('Τακτοποίηση προϊόντων στο {0} ({1}) - {2}' -f $Site.ToUpper(), $Domain, $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
$tidy = Join-Path (Join-Path (Join-Path $repo 'tools') 'cleanup-rules') 'tidy.mjs'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js.' 'Red'; Finish 3 }
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }

$bdir = Join-Path $WorkDir 'backups'
$runDir = Join-Path $bdir ('{0}-tidy-{1}' -f $Site, $stamp)
$p = Make-Plan $runDir
if ($null -eq $p) { Say 'Δεν μπόρεσα να διαβάσω τη βάση (σύνδεση στο Cloudflare;). Δεν άλλαξε τίποτα.' 'Red'; Finish 4 }
foreach ($line in ($p.text -split "`n")) { if ($line.Trim()) { Say $line.TrimEnd() } else { Say '' } }
Say ''
Say 'Τι θα γίνει με -Apply:'
Say ('  - Αρχεία αλλαγής και επαναφοράς στο {0}, και σημείο επαναφοράς (Cloudflare Time Travel)' -f $runDir)
Say ('  - Απόκρυψη {0} προϊόντων (is_active = 0) και καθαρότερο όνομα σε {1}. Δεν σβήνεται τίποτα.' -f $p.hide, $p.rename)
Say ('  - Αλλάζει ΜΟΝΟ η βάση του {0}. Κανένας κώδικας, κανένα άλλο site, κανένα deploy.' -f $Site.ToUpper())
$phrase = 'ΕΓΚΡΙΝΩ TIDY {0}' -f $Site.ToUpper()
if (($p.hide + $p.rename) -lt 1) { Say ''; Say 'Δεν υπάρχει τίποτα να αλλάξει.' 'Green'; Finish 0 }
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Say ('Η φράση έγκρισης: {0}' -f $phrase); Finish 0 }
if (-not (Confirm-Approval $phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

$changeFile = Join-Path $runDir 'change.sql'
$undoFile = Join-Path $runDir 'rollback.sql'
$tt = Invoke-Wrangler $WorkDir ('d1 time-travel info {0}' -f $DbName) -Retry
$bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
if ($tt.code -ne 0 -or -not $bm.Success) { Say 'Δεν πήρα σημείο επαναφοράς: δεν άλλαξε τίποτα.' 'Red'; Say $tt.text; Finish 11 }
$undoCmd = 'npx wrangler d1 execute {0} --remote --file "{1}"' -f $DbName, $undoFile
$restoreCmd = 'npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $DbName, $bm.Value
$note = @(
    ('{0} database before the tidy-up, {1}' -f $Site.ToUpper(), (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    ('bookmark: {0}' -f $bm.Value),
    ('{0} products hidden, {1} names changed. Files: {2}' -f $p.hide, $p.rename, $runDir),
    'To go back, ONLY with approval, run in PowerShell one of:',
    ('  cd "{0}"' -f $WorkDir),
    ('  A) undo only this tidy-up:  {0}' -f $undoCmd),
    ('  B) the whole database as it was:  {0}' -f $restoreCmd),
    'B also undoes any other change made to the database after this moment.'
) -join "`r`n"
[System.IO.File]::WriteAllText((Join-Path $runDir 'restore-point.txt'), $note, (New-Object System.Text.UTF8Encoding($false)))
Say ('Αρχεία επαναφοράς: {0}' -f $runDir) 'Green'

# Every statement is by id and sets a fixed value, so repeating it after a network error is harmless.
$x = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --file "{1}"' -f $DbName, $changeFile) -Retry
if ($x.code -ne 0) { Say 'Λάθος στην αλλαγή. Σταμάτησα.' 'Red'; Say $x.text; Say ('Επαναφορά (μόνο με έγκριση): {0}' -f $undoCmd); Finish 12 }

$check = Make-Plan (Join-Path $runDir 'check')
if ($null -eq $check -or ($check.hide + $check.rename) -gt 0) {
    $left = 'unknown'
    if ($check) { $left = ($check.hide + $check.rename) }
    Say ('ΠΡΟΣΟΧΗ: μένουν {0} αλλαγές. Στείλε την αναφορά στο Claude.' -f $left) 'Yellow'
    Finish 13
}
$now = Select-Rows 'SELECT COUNT(*) AS n FROM products WHERE is_active = 1'
$nowN = '?'
if ($now) { $nowN = $now[0].n }
Say ''
Say ('ΕΤΟΙΜΟ: κρύφτηκαν {0} προϊόντα και καθάρισαν {1} ονόματα. Ενεργά τώρα στο {2}: {3}' -f $p.hide, $p.rename, $Site.ToUpper(), $nowN) 'Green'
Say ('Δες το: https://{0}/ (η αρχική και οι κατηγορίες ανανεώνονται μέσα σε λίγα λεπτά)' -f $Domain)
Say ('Αν χρειαστεί επαναφορά (μόνο με έγκριση): {0}' -f $undoCmd)
Finish 0
