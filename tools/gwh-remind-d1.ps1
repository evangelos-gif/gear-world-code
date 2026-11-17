<#
.SYNOPSIS
  "Remind me on 27 Nov" (lessons L182): the table remind_signups in the D1 of Gear World Hub (gear-world-registry).
  Read-only unless -Apply with the approval phrase ΕΓΚΡΙΝΩ REMIND ME D1.

.DESCRIPTION
  The Hub code of "Remind me on 27 Nov" (sites/gwh/remind.js) keeps the reminders of the 13 sites in one new table,
  remind_signups (sites/gwh/migrations/0004_remind.sql): one new table and its index, nothing else changes. Until the
  table exists, the Hub answers the sites that the list is closed and their box does not show. The cron of the Hub
  deletes every row from 28 Nov 2026 12:00 UTC.

  Without -Apply   READ-ONLY. Cloudflare login, does the table exist yet, the plan.
  -Apply           CHANGES THE HUB D1, approval: ΕΓΚΡΙΝΩ REMIND ME D1. First a D1 Time Travel restore point (written to
                   a note with the rollback), then the migration, then the check.
  Rollback (only with approval): npx wrangler d1 execute gear-world-registry --remote --command "DROP TABLE IF EXISTS remind_signups"
  Report: <home>\gear-world-reports\GWH_REMIND_D1_<CHECK|APPLY>_<time>.txt (also copied to the clipboard)
#>
param(
    [switch]$Apply,
    [string]$Approve = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$DbName = 'gear-world-registry'
$Table = 'remind_signups'
$Phrase = 'ΕΓΚΡΙΝΩ REMIND ME D1'
$Migration = 'migrations/0004_remind.sql'
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-remind' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Step = 'check'
if ($Apply) { $Step = 'apply' }
# Colours without red and green (lessons L35): cyan = OK, yellow = attention, magenta = problem.
$Ok = 'Cyan'
$Warn = 'Yellow'
$Bad = 'Magenta'

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
    $file = Join-Path $OutDir ('GWH_REMIND_D1_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('GWH_REMIND_D1_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = Hide-Ids ($L -join "`r`n")
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «4 · Sites & Κώδικας» και πάτα Ctrl+V.' -ForegroundColor $Ok }
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

# -Approve may hold several phrases separated by ";" (one per change). Without it the phrase is typed.
function Confirm-Approval([string]$phrase) {
    $given = @()
    if ($Approve) { $given = @($Approve -split ';') }
    else {
        Write-Host ''
        Write-Host ('Για να συνεχίσω, γράψε ακριβώς: {0}' -f $phrase) -ForegroundColor $Warn
        Write-Host '(ή πάτα Enter για να σταματήσω χωρίς αλλαγές)'
        $given = @(Read-Host 'Έγκριση')
    }
    foreach ($g in $given) { if ((Normalize-Phrase $g) -eq (Normalize-Phrase $phrase)) { return $true } }
    return $false
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
# -Retry: on a network error or a passing Cloudflare error (7403, 10000: lessons L43), try again, up to 3 times.
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-remind-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
        [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        }
        $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
        $result = @{ code = $code; text = $text }
        $passing = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|code: 7403|code: 10000'
        if ($code -eq 0 -or -not $passing -or $try -eq $tries) { break }
        Say ('Προσωρινό πρόβλημα με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα...' -f (5 * $try)) $Warn
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

# The JSON array in wrangler's output, as a flat array of its items (Windows PowerShell 5.1, lessons L76).
function Get-JsonArray([string]$text) {
    $m = [regex]::Match($text, '(?m)^\s*\[')
    $j = $text.LastIndexOf(']')
    if (-not $m.Success -or $j -le $m.Index) { return $null }
    try { $parsed = ConvertFrom-Json -InputObject $text.Substring($m.Index, $j - $m.Index + 1) } catch { return $null }
    $items = New-Object System.Collections.ArrayList
    foreach ($x in @($parsed)) { if ($null -ne $x) { [void]$items.Add($x) } }
    return , $items.ToArray()
}

# The rows of a D1 query with --json: [ { results: [...], success } ] -> the results, or $null.
function Invoke-D1Rows([string]$folder, [string]$sql) {
    $r = Invoke-Wrangler $folder ('d1 execute {0} --remote --json --command "{1}"' -f $DbName, $sql) -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j -or $j.Count -eq 0) { return $null }
    $rows = New-Object System.Collections.ArrayList
    foreach ($x in @($j[0].results)) { if ($null -ne $x) { [void]$rows.Add($x) } }
    return , $rows.ToArray()
}

# A copy of this repo version, ready for wrangler (npm ci once per version, so the wrangler version is fixed).
function Prepare-Copy {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path (Join-Path $dest 'sites') -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path (Join-Path $repo 'sites') 'gwh') -Destination (Join-Path $dest 'sites') -Recurse -Force
        foreach ($item in @('package.json', 'package-lock.json')) { Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Force }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-remind-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
    }
    return $dest
}

function Test-Table([string]$folder) {
    $rows = Invoke-D1Rows $folder ("SELECT name FROM sqlite_master WHERE type='table' AND name='{0}'" -f $Table)
    if ($null -eq $rows) { return 'unknown' }
    if ($rows.Count -gt 0) { return 'yes' }
    return 'no'
}

Say ('GWH REMIND ME D1 (L182) - {0} - {1}' -f $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) $Ok
Say ('Έκδοση: {0}' -f (Split-Path -Leaf $repo))

$copy = Prepare-Copy
$gwh = Join-Path (Join-Path $copy 'sites') 'gwh'
$migFile = Join-Path $gwh ($Migration.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
if (-not (Test-Path -LiteralPath $migFile)) { Say 'Δεν βρήκα το αρχείο της αλλαγής της D1 σε αυτή την έκδοση: δεν αλλάζω τίποτα.' $Bad; Finish 2 }
$sqlText = [System.IO.File]::ReadAllText($migFile)
$sqlCode = [regex]::Replace($sqlText, '--[^\r\n]*', '')
if ($sqlCode -match '(?i)\b(DROP|DELETE|UPDATE|ALTER|INSERT)\b' -or $sqlCode -notmatch '(?i)CREATE TABLE IF NOT EXISTS remind_signups') { Say 'Το αρχείο της αλλαγής έχει κάτι άλλο εκτός από CREATE: δεν αλλάζω τίποτα.' $Bad; Finish 2 }

$who = Invoke-Wrangler $gwh 'whoami' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare (ή δεν απάντησε). Στείλε στο Claude αυτό το μήνυμα.' $Bad
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: ΕΝΤΑΞΕΙ' $Ok

$state = Test-Table $gwh
if ($state -eq 'unknown') { Say ('Δεν μπόρεσα να διαβάσω τη D1 {0}: δεν αλλάζω τίποτα. Στείλε στο Claude αυτό το μήνυμα.' -f $DbName) $Bad; Finish 5 }
if ($state -eq 'yes') {
    Say ('Ο πίνακας {0} υπάρχει ήδη στη D1 {1}: τίποτα να κάνω.' -f $Table, $DbName) $Ok
    Finish 0
}
Say ('Ο πίνακας {0} δεν υπάρχει ακόμα στη D1 {1}.' -f $Table, $DbName)
Say ''
Say 'Τι θα γίνει με -Apply:'
Say ('  1. Σημείο επαναφοράς (Cloudflare Time Travel) της D1 {0}, γραμμένο σε σημείωμα με την επαναφορά.' -f $DbName)
Say ('  2. Νέος πίνακας {0} και ένα ευρετήριο ({1}). Κανένας άλλος πίνακας, καμία γραμμή δεν αλλάζει.' -f $Table, $Migration)
Say '  3. Έλεγχος ότι ο πίνακας υπάρχει. Το κουμπί «Remind me on 27 Nov» των sites φαίνεται μόνο όταν υπάρχουν ΚΑΙ ο πίνακας ΚΑΙ ο νέος κώδικας του Hub.'
Say '  Αλλάζει ΜΟΝΟ η D1 του Hub. Κανένα site, κανένα deploy.'
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' $Warn; Finish 1 }

# 1. Restore point first
$bdir = Join-Path $WorkDir 'backups'
if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
$tt = Invoke-Wrangler $gwh ('d1 time-travel info {0}' -f $DbName) -Retry
$bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
if (-not $bm.Success) { Say 'Δεν βρήκα σημείο επαναφοράς της D1 του Hub: για ασφάλεια ΔΕΝ αλλάζω τίποτα.' $Bad; Finish 11 }
$note = @(
    ('Gear World Hub D1 before the table {0} (Remind me on 27 Nov, L182), {1}, {2}' -f $Table, (Split-Path -Leaf $repo), (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    ('D1 restore point: npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $DbName, $bm.Value),
    'To go back (only with approval), in PowerShell:',
    ('  npx wrangler d1 execute {0} --remote --command "DROP TABLE IF EXISTS {1}"' -f $DbName, $Table),
    'The Hub code then answers the sites that the list is closed, and their box goes away by itself.',
    'Or the Time Travel restore above (it also undoes every other change to this database since then).'
) -join "`r`n"
$noteFile = Join-Path $bdir ('gwh-before-remind-d1-' + $stamp + '.txt')
[System.IO.File]::WriteAllText($noteFile, $note, (New-Object System.Text.UTF8Encoding($true)))
if (-not (Test-Path -LiteralPath $noteFile)) { Say 'Το σημείωμα επαναφοράς δεν γράφτηκε: ΔΕΝ άλλαξα τίποτα.' $Bad; Finish 11 }
Say ('Σημείο επαναφοράς και οδηγίες: {0}' -f $noteFile) $Ok

# 2. The migration, 3. the check
$x = Invoke-Wrangler $gwh ('d1 execute {0} --remote --file "{1}"' -f $DbName, $migFile)
$after = Test-Table $gwh
if ($after -ne 'yes') {
    Say ('Ο πίνακας {0} δεν φτιάχτηκε. Στείλε αυτή την αναφορά στο Claude. Έξοδος:' -f $Table) $Bad
    foreach ($line in @($x.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }
    Finish 12
}
$cnt = Invoke-D1Rows $gwh ('SELECT COUNT(*) AS n FROM {0}' -f $Table)
$n = '?'
if ($cnt -and $cnt.Count -gt 0) { $n = [string]$cnt[0].n }
Say ''
Say ('ΕΤΟΙΜΟ: ο πίνακας {0} υπάρχει στη D1 του Hub ({1} γραμμές).' -f $Table, $n) $Ok
Say ('Επαναφορά (μόνο με έγκριση): npx wrangler d1 execute {0} --remote --command "DROP TABLE IF EXISTS {1}"' -f $DbName, $Table)
Finish 0
