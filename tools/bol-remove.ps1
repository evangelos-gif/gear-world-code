<#
.SYNOPSIS
  bol.com removal (lessons L204): every bol.com product off the Gear World sites at once, for the day the bol.com
  partnership ends (bol.com terms 9.1 f: EUR 1,000 for every day a product stays). Read-only unless -Apply and the
  typed approval phrase.

.DESCRIPTION
  -Step check   READ-ONLY (default). For each of the 13 site databases (not only the 10 that list bol.com) and Price
                Watch (gear-world-prices): how many bol.com rows there are, table by table (products, and on the
                older sites the tables that point to them, such as product_group_offers on CGW); a bol.com row is the
                name 'bol.com' (also a name the site shows as 'bol.com', database.retailerNames) or the bol.com partner
                link. Gear World Hub keeps no products (its search reads the sites). And the daily refresh (lessons
                L205): whether the Worker gear-world-bol-refresh exists and its kill switch (gear-world-awin,
                bol_refresh_meta 'enabled'). Shows the plan and the approval phrase.
  -Step apply   CHANGES CLOUDFLARE, one approval: ΕΓΚΡΙΝΩ ΑΦΑΙΡΕΣΗ BOL (-Apply, and -Approve or typed). In this order:
                  1. a Time Travel restore point of EVERY database that has bol.com rows, and of gear-world-awin (if
                     one cannot be taken, nothing changes);
                  2. the refresh off FIRST: bol_refresh_meta 'enabled' = '0' in gear-world-awin (the table is made if
                     it is not there; bol_refresh_hidden is left as it is); then the Worker gear-world-bol-refresh is
                     deleted (its schedule stops with it). If either does not work, the report gives the exact command
                     and the Cloudflare page, and the removal goes on;
                  3. every bol.com row is deleted, database by database (side tables first, products in parts);
                  4. the counts again: every one must be 0, and the switch '0'.
                The report says what was removed in each database and how to bring each one back (its restore point).
                Click and sales logs stay (they show nothing; the commission of earlier clicks is still matched).
  Report: <home>\gear-world-reports\BOL_REMOVE_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'apply')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$PcHome = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
# HTTPS with TLS 1.2: Windows PowerShell 5.1 may still offer only older TLS, which GitHub and Cloudflare refuse (L106).
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ ΑΦΑΙΡΕΣΗ BOL'
$WorkerName = 'gear-world-bol-refresh'
$WorkerPage = 'https://dash.cloudflare.com/?to=/:account/workers/services/view/gear-world-bol-refresh/production/triggers'
# The refresh's own tables (sites/bol-refresh/migrations, lessons L205): the kill switch is bol_refresh_meta 'enabled'.
$AwinDb = 'gear-world-awin'
$Core = Join-Path (Join-Path $repo 'tools') 'bol-remove.mjs'
if (-not $PcHome) { $PcHome = $HOME }
if (-not $WorkDir) { $WorkDir = Join-Path $PcHome 'gear-world-bol-remove' }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

# Cloudflare ids (account, database, version) never go into a report. A Time Travel bookmark is not one of them: it is
# the restore point the report must give.
function Hide-Ids([string]$Text) {
    return [regex]::Replace($Text, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('BOL_REMOVE_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('BOL_REMOVE_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = Hide-Ids ($L -join "`r`n")
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
    exit $code
}
trap {
    Say ('Απρόβλεπτο σφάλμα: {0}' -f $_.Exception.Message) 'Red'
    Say 'Σταμάτησα εδώ. Ό,τι γράφει πιο πάνω έγινε, τίποτα μετά. Στείλε την αναφορά στο Claude.' 'Red'
    Finish 9
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
        # Lines left over from the paste (an empty last line) would answer the prompt by themselves (8 Nov 2026).
        try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1, read as UTF-8 (L58).
# -Retry: on a network error or a passing Cloudflare error (7403, 10000: lessons L43), try again, up to 3 times. Only
# for calls that are safe to repeat (every call of this tool is: a count, a restore point, a delete of what is left).
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tmp = [System.IO.Path]::GetTempPath()
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path $tmp ('gw-bolrm-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
        [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
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

# Read-only SELECT on one database. Returns the rows, or $null on error.
function Select-Rows([string]$db, [string]$sql) {
    if ($sql -notmatch '^\s*SELECT ' -or $sql -match '(?i)\b(UPDATE|INSERT|DELETE|DROP|ALTER|CREATE|REPLACE INTO|ATTACH|PRAGMA)\b' -or $sql.Contains(';')) { throw 'Only one SELECT here' }
    $r = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --json --command "{1}"' -f $db, $sql) -Retry
    if ($r.code -ne 0) { $script:LastError = $r.text; return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { $script:LastError = $r.text; return $null }
    # The comma keeps an empty result as an empty list (not $null, which means an error here).
    return ,@($j[0].results)
}

function Invoke-Core([string[]]$CoreArgs) {
    $out = @(& node $Core @CoreArgs)
    if ($LASTEXITCODE -ne 0) { throw ('bol-remove.mjs failed: ' + ($CoreArgs -join ' ')) }
    return (($out | ForEach-Object { "$_" }) -join "`n").Trim()
}

function Short-Error([string]$text) {
    $t = (Hide-Ids ([string]$text)) -replace '\s+', ' '
    if ($t.Length -gt 300) { $t = $t.Substring(0, 300) + '...' }
    return $t
}

# The bol.com rows of one database: @{ ok; tables; counts (ordered: table -> rows); total; active }.
function Count-Target($t) {
    $res = @{ ok = $false; tables = @(); counts = [ordered]@{}; total = 0; active = 0; error = '' }
    $rows = Select-Rows $t.db (Invoke-Core @('--mode', 'tables-sql'))
    if ($null -eq $rows) { $res.error = Short-Error $script:LastError; return $res }
    $res.tables = @($rows | ForEach-Object { [string]$_.name } | Where-Object { $_ -match '^[A-Za-z0-9_]{1,64}$' })
    $sql = Invoke-Core @('--mode', 'count-sql', '--target', $t.code, '--tables', ($res.tables -join ','))
    $c = Select-Rows $t.db $sql
    if ($null -eq $c -or $c.Count -lt 1) { $res.error = Short-Error $script:LastError; return $res }
    foreach ($p in $c[0].PSObject.Properties) {
        if ($p.Name -eq 'none') { continue }
        $n = 0
        try { $n = [int64]$p.Value } catch { $n = 0 }
        if ($p.Name -eq 'active') { $res.active = $n; continue }
        $res.counts[$p.Name] = $n
        $res.total += $n
    }
    $res.ok = $true
    return $res
}

function Count-Line($t, $c) {
    if (-not $c.ok) { return ('  {0,-6} {1,-30} ΠΡΟΒΛΗΜΑ: δεν διαβάστηκε ({2})' -f $t.code.ToUpper(), $t.db, $c.error) }
    $parts = @()
    foreach ($k in $c.counts.Keys) { if ([int64]$c.counts[$k] -gt 0) { $parts += ('{0} {1}' -f $k, $c.counts[$k]) } }
    $list = 'καμία γραμμή bol.com'
    if ($parts.Count -gt 0) { $list = ($parts -join ', ') }
    $extra = ''
    if ($t.kind -eq 'site' -and [int64]$c.counts['products'] -gt 0) { $extra = (' (ενεργά: {0})' -f $c.active) }
    $state = 'ΕΝΤΑΞΕΙ'
    if ($c.total -gt 0) { $state = 'ΥΠΑΡΧΟΥΝ' }
    return ('  {0,-6} {1,-30} {2}: {3}{4}' -f $t.code.ToUpper(), $t.db, $state, $list, $extra)
}

Write-Host ''
$mode = 'ΕΛΕΓΧΟΣ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ'
if ($Step -eq 'apply' -and $Apply) { $mode = 'ΑΦΑΙΡΕΣΗ (με έγκριση)' } elseif ($Step -eq 'apply') { $mode = 'ΔΟΚΙΜΗ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (χωρίς -Apply)' }
Say ('bol.com: αφαίρεση από όλα τα sites (L204) - {0}' -f $mode) 'Cyan'
Say ('Ώρα: {0} | έκδοση: {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }

$targets = @((Invoke-Core @('--mode', 'targets') | ConvertFrom-Json).targets)
Say ''
Say ('1. Γραμμές bol.com σε κάθε βάση ({0} βάσεις: τα 13 sites και το Price Watch):' -f $targets.Count)
$counts = @{}
$failed = 0
$withRows = @()
foreach ($t in $targets) {
    $c = Count-Target $t
    $counts[$t.code] = $c
    if (-not $c.ok) { $failed++ } elseif ($c.total -gt 0) { $withRows += $t }
    Say (Count-Line $t $c)
}
Say '  HUB    gear-world-registry            ΕΝΤΑΞΕΙ: το Hub δεν κρατά προϊόντα (η αναζήτησή του διαβάζει τα sites)'
$listed = @($targets | Where-Object { $_.listed } | ForEach-Object { $_.code.ToUpper() })
Say ('  Τα sites που δείχνουν bol.com (ρύθμιση deliversTo): {0}' -f ($listed -join ', '))

Say ''
Say ('2. Ο Worker της καθημερινής ανανέωσης {0}:' -f $WorkerName)
$w = Invoke-Wrangler $WorkDir ('deployments list --name {0}' -f $WorkerName) -Retry
$workerState = 'unknown'
if ($w.code -eq 0) { $workerState = 'exists' } elseif ($w.text -match '(?i)does not exist|not found|10007') { $workerState = 'none' }
if ($workerState -eq 'exists') { Say ('  ΥΠΑΡΧΕΙ: τρέχει κάθε μέρα. Με την αφαίρεση σβήνεται, για να σταματήσει το πρόγραμμά του.') 'Yellow' }
elseif ($workerState -eq 'none') { Say '  ΔΕΝ ΥΠΑΡΧΕΙ: τίποτα να σταματήσει.' 'Green' }
else { Say ('  ΠΡΟΒΛΗΜΑ: δεν μπόρεσα να το δω ({0}).' -f (Short-Error $w.text)) 'Yellow' }

# The kill switch: on (the Worker refreshes), off ('0'), none (no table: the refresh was never set up) or unknown.
function Read-Switch {
    $tables = Select-Rows $AwinDb (Invoke-Core @('--mode', 'tables-sql'))
    if ($null -eq $tables) { return @{ state = 'unknown'; text = (Short-Error $script:LastError) } }
    if (-not (@($tables | ForEach-Object { [string]$_.name }) -contains 'bol_refresh_meta')) { return @{ state = 'none'; text = '' } }
    $r = Select-Rows $AwinDb (Invoke-Core @('--mode', 'switch-read-sql'))
    if ($null -eq $r) { return @{ state = 'unknown'; text = (Short-Error $script:LastError) } }
    if ($r.Count -gt 0 -and ([string]$r[0].value).Trim() -eq '0') { return @{ state = 'off'; text = [string]$r[0].updated_at } }
    return @{ state = 'on'; text = '' }
}
$sw = Read-Switch
if ($sw.state -eq 'on') { Say ('  Διακόπτης ({0}, bol_refresh_meta enabled): ΑΝΟΙΧΤΟΣ. Με την αφαίρεση γίνεται 0 ΠΡΩΤΑ.' -f $AwinDb) 'Yellow' }
elseif ($sw.state -eq 'off') { Say ('  Διακόπτης ({0}, bol_refresh_meta enabled): ΚΛΕΙΣΤΟΣ (0, από {1}).' -f $AwinDb, $sw.text) 'Green' }
elseif ($sw.state -eq 'none') { Say ('  Διακόπτης ({0}): ΔΕΝ ΥΠΑΡΧΕΙ ακόμα (η ανανέωση δεν έχει στηθεί). Με την αφαίρεση γράφεται 0, για να μείνει κλειστός.' -f $AwinDb) 'Green' }
else { Say ('  Διακόπτης ({0}): ΠΡΟΒΛΗΜΑ, δεν διαβάστηκε ({1}). Με την αφαίρεση γράφεται 0.' -f $AwinDb, $sw.text) 'Yellow' }

$totalRows = 0
foreach ($t in $withRows) { $totalRows += $counts[$t.code].total }
Say ''
Say 'Τι θα γίνει με -Step apply -Apply και τη φράση:'
Say ('  1. Σημείο επαναφοράς (Cloudflare Time Travel) σε κάθε βάση με γραμμές bol.com και στη {0}: {1}' -f $AwinDb, ((@($withRows | ForEach-Object { $_.db }) + @($AwinDb)) -join ', '))
Say ('  2. ΠΡΩΤΑ σταματά η ανανέωση: διακόπτης 0 στη {0}, και σβήνεται ο Worker {1} (αν υπάρχει).' -f $AwinDb, $WorkerName)
Say ('  3. Σβήνονται {0} γραμμές bol.com (προϊόντα και ό,τι δείχνει σε αυτά, και το ιστορικό τιμών τους).' -f $totalRows)
Say '  4. Μετράω ξανά: όλα πρέπει να είναι 0 και ο διακόπτης 0. Τα κλικ και οι πωλήσεις μένουν (δεν φαίνονται πουθενά).'
Say '  Δεν αλλάζει κώδικας, deploy ή άλλο κατάστημα.'
Say ('Η φράση έγκρισης: {0}' -f $Phrase)

if ($failed -gt 0) {
    Say ''
    Say ('ΠΡΟΒΛΗΜΑ: {0} βάσεις δεν διαβάστηκαν (σύνδεση στο Cloudflare;). Δεν άλλαξε τίποτα. Τρέξε πάλι την ίδια εντολή.' -f $failed) 'Red'
    Finish 4
}
if ($Step -eq 'check' -or -not $Apply) {
    Say ''
    if ($totalRows -eq 0) { Say 'ΕΝΤΑΞΕΙ: καμία γραμμή bol.com σε καμία βάση. Δεν άλλαξε τίποτα (μόνο ανάγνωση).' 'Green' }
    else { Say ('Μόνο ανάγνωση: δεν άλλαξε τίποτα. Υπάρχουν {0} γραμμές bol.com.' -f $totalRows) 'Green' }
    Finish 0
}
if ($totalRows -eq 0 -and $workerState -ne 'exists' -and $sw.state -ne 'on') { Say ''; Say 'ΕΝΤΑΞΕΙ: δεν υπάρχει τίποτα να σβηστεί ή να σταματήσει.' 'Green'; Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# ---- 1. Restore points first: none taken = nothing changes ----
$bdir = Join-Path (Join-Path $WorkDir 'backups') ('bol-remove-' + $stamp)
New-Item -ItemType Directory -Path $bdir -Force | Out-Null
$restore = [ordered]@{}
Say ''
Say '1. Σημεία επαναφοράς:'
$ttTargets = @($withRows) + @([pscustomobject]@{ code = 'awin'; db = $AwinDb })
foreach ($t in $ttTargets) {
    $tt = Invoke-Wrangler $WorkDir ('d1 time-travel info {0}' -f $t.db) -Retry
    $bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
    if ($tt.code -ne 0 -or -not $bm.Success) {
        Say ('  ΠΡΟΒΛΗΜΑ: δεν πήρα σημείο επαναφοράς για {0}: ΔΕΝ άλλαξε τίποτα σε καμία βάση. ({1})' -f $t.db, (Short-Error $tt.text)) 'Red'
        Finish 11
    }
    $restore[$t.code] = ('npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $t.db, $bm.Value)
    Say ('  {0}: ΕΝΤΑΞΕΙ' -f $t.db) 'Green'
}
$note = New-Object System.Collections.Generic.List[string]
$note.Add(('bol.com removal (lessons L204), {0}, version {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), (Split-Path -Leaf $repo)))
$note.Add('Each database as it was just before the removal. ONLY with approval, in PowerShell:')
$note.Add(('  cd "{0}"' -f $WorkDir))
foreach ($k in $restore.Keys) { $note.Add(('  {0}: {1}' -f $k.ToUpper(), $restore[$k])) }
$note.Add('A restore also undoes any other change made to that database after this moment.')
[System.IO.File]::WriteAllText((Join-Path $bdir 'restore-points.txt'), ($note -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))

# ---- 2. The refresh off FIRST: the kill switch (lessons L205), then the Worker is deleted, so its schedule stops ----
Say ''
Say ('2. Η καθημερινή ανανέωση σταματά (διακόπτης στη {0}, μετά ο Worker {1}):' -f $AwinDb, $WorkerName)
$switchOk = $false
$swFile = Join-Path $bdir 'awin-refresh-off.sql'
[void](Invoke-Core @('--mode', 'switch-sql', '--out', $swFile))
$s = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --file "{1}"' -f $AwinDb, $swFile) -Retry
if ($s.code -eq 0) { $back = Read-Switch; if ($back.state -eq 'off') { $switchOk = $true } }
if ($switchOk) { Say '  Διακόπτης: 0 (ΚΛΕΙΣΤΟΣ): ο Worker δεν καλεί το bol.com και δεν αλλάζει τιμές.' 'Green' }
else {
    Say ('  ΠΡΟΒΛΗΜΑ: ο διακόπτης δεν έγινε 0 ({0}). Η αφαίρεση συνεχίζει.' -f (Short-Error $s.text)) 'Red'
    Say ('  Κλείσ'' τον εσύ, στο PowerShell: cd "{0}"; npx wrangler d1 execute {1} --remote --file "{2}"' -f $WorkDir, $AwinDb, $swFile)
}
$workerOk = $true
if ($workerState -eq 'none') { Say '  ΔΕΝ ΥΠΑΡΧΕΙ: τίποτα να σταματήσει.' 'Green' }
else {
    # A new empty folder, so no wrangler config can be there and only the Worker named here can be meant (L83).
    $empty = Join-Path $WorkDir ('empty-for-delete-' + $stamp)
    New-Item -ItemType Directory -Path $empty -Force | Out-Null
    $d = Invoke-Wrangler $empty ('delete {0}' -f $WorkerName)
    Remove-Item -LiteralPath $empty -Recurse -Force -ErrorAction SilentlyContinue
    if ($d.code -eq 0) { Say '  ΣΒΗΣΤΗΚΕ: η καθημερινή ανανέωση σταμάτησε.' 'Green' }
    elseif ($d.text -match '(?i)does not exist|not found|10007') { Say '  ΔΕΝ ΥΠΑΡΧΕΙ πια: τίποτα να σταματήσει.' 'Green' }
    else {
        $workerOk = $false
        Say ('  ΠΡΟΒΛΗΜΑ: δεν σβήστηκε ({0}). Η αφαίρεση των προϊόντων συνεχίζει.' -f (Short-Error $d.text)) 'Red'
        Say '  Σταμάτησέ τον εσύ, με ΜΙΑ από αυτές τις δύο:'
        Say ('    στο PowerShell: cd "{0}"; npx wrangler delete {1}' -f $WorkDir, $WorkerName)
        Say ('    ή στο Cloudflare (Triggers: σβήσε το Cron): {0}' -f $WorkerPage)
    }
}

# ---- 3. The deletes, database by database ----
Say ''
Say '3. Αφαίρεση:'
$deleteFailed = 0
foreach ($t in $withRows) {
    $c = $counts[$t.code]
    $file = Join-Path $bdir ('{0}-delete.sql' -f $t.code)
    $rows = [int64]0
    $rowsLog = [int64]0
    if ($t.kind -eq 'prices') { $rows = [int64]$c.counts['price_last']; $rowsLog = [int64]$c.counts['price_log'] } else { $rows = [int64]$c.counts['products'] }
    [void](Invoke-Core @('--mode', 'delete-sql', '--target', $t.code, '--tables', ($c.tables -join ','), '--rows', [string]$rows, '--rows-log', [string]$rowsLog, '--out', $file))
    $x = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --file "{1}"' -f $t.db, $file) -Retry
    if ($x.code -ne 0) { $deleteFailed++; Say ('  {0}: ΠΡΟΒΛΗΜΑ ({1})' -f $t.db, (Short-Error $x.text)) 'Red' }
    else { Say ('  {0}: έτρεξε' -f $t.db) 'Green' }
}

# ---- 4. Count again ----
Say ''
Say '4. Έλεγχος μετά (όλα πρέπει να είναι 0, ο διακόπτης 0):'
$swAfter = Read-Switch
if ($swAfter.state -eq 'off') { Say ('  {0,-6} {1,-30} ΕΝΤΑΞΕΙ: διακόπτης ανανέωσης 0' -f 'AWIN', $AwinDb) } else { $switchOk = $false; Say ('  {0,-6} {1,-30} ΠΡΟΒΛΗΜΑ: ο διακόπτης δεν είναι 0' -f 'AWIN', $AwinDb) 'Red' }
$left = 0
$unread = 0
foreach ($t in $withRows) {
    $before = $counts[$t.code]
    $after = Count-Target $t
    if (-not $after.ok) { $unread++; Say (Count-Line $t $after) 'Red'; continue }
    $left += $after.total
    $state = 'ΕΝΤΑΞΕΙ'
    if ($after.total -gt 0) { $state = 'ΠΡΟΒΛΗΜΑ' }
    $parts = @()
    foreach ($k in $before.counts.Keys) { if ([int64]$before.counts[$k] -gt 0) { $parts += ('{0} {1} -> {2}' -f $k, $before.counts[$k], $after.counts[$k]) } }
    Say ('  {0,-6} {1,-30} {2}: {3}' -f $t.code.ToUpper(), $t.db, $state, ($parts -join ', '))
}

Say ''
Say 'Επαναφορά (ΜΟΝΟ με έγκριση): κάθε βάση όπως ήταν πριν, στο PowerShell:'
Say ('  cd "{0}"' -f $WorkDir)
foreach ($k in $restore.Keys) { Say ('  {0}: {1}' -f $k.ToUpper(), $restore[$k]) }
Say ('  (και στο αρχείο {0})' -f (Join-Path $bdir 'restore-points.txt'))
Say '  Η επαναφορά σβήνει και κάθε άλλη αλλαγή της ίδιας βάσης μετά από αυτή την ώρα.'
Say ''
if ($deleteFailed -gt 0) { Say ('ΠΡΟΒΛΗΜΑ: {0} βάσεις δεν άλλαξαν. Τρέξε ξανά την ίδια εντολή (σβήνει μόνο ό,τι έμεινε) και στείλε την αναφορά στο Claude.' -f $deleteFailed) 'Red'; Finish 12 }
if ($unread -gt 0 -or $left -gt 0) { Say ('ΠΡΟΒΛΗΜΑ: μένουν {0} γραμμές bol.com ή βάσεις που δεν διαβάστηκαν ({1}). Τρέξε ξανά την ίδια εντολή.' -f $left, $unread) 'Red'; Finish 13 }
if (-not $workerOk -or -not $switchOk) { Say ('ΣΧΕΔΟΝ ΕΤΟΙΜΟ: όλα τα προϊόντα bol.com σβήστηκαν (0 παντού), αλλά η ανανέωση δεν σταμάτησε πλήρως (διακόπτης ή Worker {0}): κάνε ό,τι γράφει πιο πάνω.' -f $WorkerName) 'Yellow'; Finish 14 }
Say ('ΕΤΟΙΜΟ: σβήστηκαν {0} γραμμές bol.com, 0 έμειναν. Οι σελίδες ανανεώνονται μέσα σε λίγα λεπτά.' -f $totalRows) 'Green'
Finish 0
