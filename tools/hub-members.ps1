<#
.SYNOPSIS
  The one member list in Gear World Hub (lessons L90): new fields in the Hub's member table, a copy of the old Rewards
  members, the 30-minute copy to MailerLite and the MailerLite key. Read-only unless -Apply and the approval phrase.

.DESCRIPTION
  -Step check   READ-ONLY. The Hub's D1 (gear-world-registry): which new fields of hub_subscribers are there; how many
                members each of the 6 older sites has (and how many gave marketing consent); the Hub config on this PC
                (the 30-minute timer); the MailerLite key (set or not). Shows the plan. Nothing changes.
  -Step apply   CHANGES THE HUB'S D1, THE HUB CONFIG ON THIS PC AND ONE SECRET, one approval: ΕΓΚΡΙΝΩ HUB MEMBERS.
                  1. backup: a D1 restore point (Time Travel), all rows of hub_subscribers in a file on this PC, and a
                     copy of the Hub's wrangler.toml;
                  2. the new fields (only the missing ones) and the table member_rate; the members already there are
                     marked as members from before (no automatic welcome email);
                  3. the Rewards members of the 6 older sites are copied in: email, first name, country, consent, site,
                     date. Never the phone, surname or trade. Their own databases are only read. Nobody is deleted.
                  4. the 30-minute timer in the Hub's wrangler.toml (it takes effect with the next Hub update);
                  5. the MailerLite key, pasted here (never shown, never in a file or the report). Enter skips it.
                Running it again is safe: fields and members already there are kept.
  Report: <home>\gear-world-reports\HUB_MEMBERS_<STEP>_<time>.txt (also copied to the clipboard). Email addresses never
  go into the report: only counts and masked examples (j***@gmail.com).
#>
param(
    [ValidateSet('check', 'apply')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$PcHome = '',
    [string]$HubDir = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [string]$TokenEnv = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ HUB MEMBERS'
$DbName = 'gear-world-registry'
$HubWorker = 'gear-world-hub'
$SecretName = 'MAILERLITE_TOKEN'
$KeyPage = 'https://dashboard.mailerlite.com/integrations/api'
if (-not $PcHome) { $PcHome = $HOME }
if (-not $HubDir) { $HubDir = Join-Path $PcHome 'gear-world-hub' }
if (-not $WorkDir) { $WorkDir = Join-Path $PcHome 'gear-world-members' }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$script:Secrets = New-Object System.Collections.Generic.List[string]

# The older sites whose Rewards members are copied (their databases are only read).
$OldSites = @(
    @{ code = 'mgw'; db = 'mens-gear-world' },
    @{ code = 'wgw'; db = 'womens-gear-world' },
    @{ code = 'hgw'; db = 'home-gear-world' },
    @{ code = 'ggw'; db = 'garden-gear-world' },
    @{ code = 'kgw'; db = 'kids-gear-world' },
    @{ code = 'cgw'; db = 'construction-gear-customers' }
)
# The new fields of hub_subscribers (sites/gwh/migrations/0002_members.sql), in order.
$Columns = @(
    @{ name = 'site'; sql = 'ALTER TABLE hub_subscribers ADD COLUMN site TEXT' },
    @{ name = 'first_name'; sql = 'ALTER TABLE hub_subscribers ADD COLUMN first_name TEXT' },
    @{ name = 'country'; sql = 'ALTER TABLE hub_subscribers ADD COLUMN country TEXT' },
    @{ name = 'member_source'; sql = 'ALTER TABLE hub_subscribers ADD COLUMN member_source TEXT' },
    @{ name = 'mailerlite_group'; sql = 'ALTER TABLE hub_subscribers ADD COLUMN mailerlite_group TEXT' },
    @{ name = 'mailerlite_status'; sql = 'ALTER TABLE hub_subscribers ADD COLUMN mailerlite_status TEXT' },
    @{ name = 'mailerlite_tries'; sql = 'ALTER TABLE hub_subscribers ADD COLUMN mailerlite_tries INTEGER NOT NULL DEFAULT 0' },
    @{ name = 'mailerlite_synced_at'; sql = 'ALTER TABLE hub_subscribers ADD COLUMN mailerlite_synced_at TEXT' }
)

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    foreach ($s in $script:Secrets) { if ($s) { $text = $text.Replace($s, '[key]') } }
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Hide-Ids([string]$Text) {
    $t = [regex]::Replace($Text, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
    return [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{28}\b', '${1}-masked-id')
}

# Never a whole email address in the report or on screen.
function Hide-Emails([string]$Text) {
    return [regex]::Replace($Text, '\b([A-Za-z0-9])[A-Za-z0-9._%+\-]*@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b', '${1}***@${2}')
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('HUB_MEMBERS_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('HUB_MEMBERS_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = Hide-Emails (Hide-Ids ($L -join "`r`n"))
    foreach ($s in $script:Secrets) { if ($s) { $text = $text.Replace($s, '[key]') } }
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
    exit $code
}

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

function New-CmdFile([string]$Folder, [string]$Arguments) {
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-members-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
    [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
    return $cmdFile
}

function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = New-CmdFile $Folder $Arguments
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
        Say ('Προσωρινό πρόβλημα με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/{2})...' -f (5 * $try), ($try + 1), $tries) 'Yellow'
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

function Set-KeySecret([string]$Folder, [string]$Value) {
    $cmdFile = New-CmdFile $Folder ('secret put {0} --name {1}' -f $SecretName, $HubWorker)
    try {
        $out = @($Value | & $cmdFile)
        $code = $LASTEXITCODE
    } finally {
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    }
    $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
    if ($Value) { $text = $text.Replace($Value, '[key]') }
    return @{ code = $code; text = $text }
}

function Get-JsonArray([string]$text) {
    $m = [regex]::Match($text, '(?m)^\s*\[')
    $j = $text.LastIndexOf(']')
    if (-not $m.Success -or $j -le $m.Index) { return $null }
    try { $parsed = ConvertFrom-Json -InputObject $text.Substring($m.Index, $j - $m.Index + 1) } catch { return $null }
    $items = New-Object System.Collections.ArrayList
    foreach ($x in @($parsed)) { if ($null -ne $x) { [void]$items.Add($x) } }
    return , $items.ToArray()
}

# Rows of a read-only query (SELECT or PRAGMA table_info) on a database, or $null on error.
function Read-Db([string]$folder, [string]$db, [string]$sql) {
    if ($sql -notmatch '^\s*(SELECT |PRAGMA table_info\()') { throw 'Only reads here' }
    $r = Invoke-Wrangler $folder ('d1 execute {0} --remote --json --command "{1}"' -f $db, $sql) -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j -or $j.Count -lt 1) { return $null }
    return , @($j[0].results)
}

function Prepare-Deploy {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        foreach ($item in @('tools', 'package.json', 'package-lock.json')) {
            $src = Join-Path $repo $item
            if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $dest -Recurse -Force }
        }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-members-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
    }
    return $dest
}

function Invoke-HubBinding([string]$mode, [string]$file) {
    $helper = Join-Path (Join-Path $repo 'tools') 'hub-binding.mjs'
    $out = @(& node $helper $mode $file)
    $code = $LASTEXITCODE
    $text = (($out | ForEach-Object { "$_" }) -join ' ').Trim()
    if ($code -ne 0) { return ('error ' + $text) }
    return $text
}

function Get-KeyState([string]$folder) {
    $r = Invoke-Wrangler $folder ('secret list --name {0}' -f $HubWorker) -Retry
    if ($r.code -ne 0) { return 'unknown' }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { return 'unknown' }
    foreach ($s in $j) { if ([string]$s.name -eq $SecretName) { return 'yes' } }
    return 'no'
}

function Sql-Text([object]$v, [int]$max) {
    if ($null -eq $v) { return 'NULL' }
    $t = ([string]$v).Trim()
    if (-not $t) { return 'NULL' }
    if ($t.Length -gt $max) { $t = $t.Substring(0, $max) }
    return ("'" + $t.Replace("'", "''") + "'")
}

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply) { $mode = 'APPLY (με έγκριση)' }
Say ('HUB MEMBER LIST - step: {0} - {1} - {2}' -f $Step, $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$deploy = Prepare-Deploy

$who = Invoke-Wrangler $deploy 'whoami' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare (ή δεν απάντησε). Στείλε στο Claude αυτό το μήνυμα.' 'Red'
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 15)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: ΕΝΤΑΞΕΙ' 'Green'

# 1. the member table of the Hub
$info = Read-Db $deploy $DbName 'PRAGMA table_info(hub_subscribers)'
if ($null -eq $info -or $info.Count -eq 0) { Say 'Δεν διάβασα τον πίνακα hub_subscribers του Hub. Δεν αλλάζω τίποτα. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 5 }
$have = @{}
foreach ($c in $info) { $have[[string]$c.name] = $true }
$missing = @($Columns | Where-Object { -not $have.ContainsKey($_.name) })
$hubNow = Read-Db $deploy $DbName 'SELECT COUNT(*) AS n, SUM(marketing_consent = 1) AS c FROM hub_subscribers'
Say ''
Say 'Λίστα μελών του Hub (hub_subscribers):'
if ($null -ne $hubNow -and $hubNow.Count -ge 1) { Say ('  Μέλη τώρα: {0} (με συγκατάθεση για email: {1})' -f $hubNow[0].n, $hubNow[0].c) }
if ($missing.Count -eq 0) { Say '  Νέα πεδία: υπάρχουν όλα' } else { Say ('  Νέα πεδία: λείπουν {0} ({1})' -f $missing.Count, (($missing | ForEach-Object { $_.name }) -join ', ')) }

# 2. the Rewards members of the older sites (read only)
Say ''
Say 'Μέλη Rewards των παλιών sites (μόνο ανάγνωση):'
$members = New-Object System.Collections.ArrayList
$readOk = $true
foreach ($s in $OldSites) {
    $rows = Read-Db $deploy $s.db 'SELECT email, first_name, country, marketing_consent, created_at FROM customers'
    if ($null -eq $rows) { Say ('  {0}: ΠΡΟΒΛΗΜΑ - δεν διαβάστηκε' -f $s.code.ToUpper()) 'Yellow'; $readOk = $false; continue }
    $ok = 0; $consent = 0; $bad = 0
    foreach ($r in $rows) {
        $e = ([string]$r.email).Trim().ToLowerInvariant()
        if ($e -notmatch '^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$') { $bad++; continue }
        $c = 0
        if ([string]$r.marketing_consent -eq '1' -or [string]$r.marketing_consent -eq 'True') { $c = 1; $consent++ }
        [void]$members.Add(@{ email = $e; first = $r.first_name; country = $r.country; consent = $c; created = $r.created_at; site = $s.code })
        $ok++
    }
    $extra = ''
    if ($bad -gt 0) { $extra = (' ({0} χωρίς σωστό email, δεν αντιγράφονται)' -f $bad) }
    Say ('  {0}: {1} μέλη, {2} με συγκατάθεση{3}' -f $s.code.ToUpper(), $ok, $consent, $extra)
}
$withConsent = @($members | Where-Object { $_.consent -eq 1 })
if ($withConsent.Count -gt 0) {
    Say ('  Με συγκατάθεση (κρυμμένα): {0}' -f (Hide-Emails (($withConsent | ForEach-Object { $_.email }) -join ', ')))
}

# 3. the Hub config on this PC and the MailerLite key
$cfgPc = Join-Path $HubDir 'wrangler.toml'
$cronState = 'no-config'
if (Test-Path -LiteralPath $cfgPc) { $cronState = Invoke-HubBinding 'check-cron' $cfgPc }
$keyState = Get-KeyState $deploy
Say ''
if ($cronState -eq 'has') { Say 'Χρονόμετρο 30 λεπτών στη ρύθμιση του Hub: υπάρχει' }
elseif ($cronState -eq 'missing') { Say 'Χρονόμετρο 30 λεπτών στη ρύθμιση του Hub: δεν υπάρχει ακόμα (θα μπει)' }
else { Say ('Ρύθμιση του Hub στον υπολογιστή ({0}): ΠΡΟΒΛΗΜΑ - {1}' -f $cfgPc, $cronState) 'Yellow' }
if ($keyState -eq 'yes') { Say 'Κλειδί MailerLite στο Hub: υπάρχει' } elseif ($keyState -eq 'no') { Say ('Κλειδί MailerLite στο Hub: δεν υπάρχει ακόμα (από {0})' -f $KeyPage) } else { Say 'Κλειδί MailerLite στο Hub: δεν διαβάστηκε' 'Yellow' }

if ($Step -eq 'check') {
    Say ''
    Say ('Πλάνο του apply (φράση: {0}):' -f $Phrase)
    Say '  1. backup: σημείο επαναφοράς της βάσης του Hub, όλα τα μέλη σε αρχείο στον υπολογιστή, αντίγραφο του wrangler.toml'
    Say ('  2. τα νέα πεδία ({0} λείπουν) και ο πίνακας ορίων· όσοι είναι ήδη μέσα μετράνε ως «μέλη από πριν» (χωρίς αυτόματο καλωσόρισμα)' -f $missing.Count)
    Say ('  3. αντιγραφή των {0} μελών Rewards: email, μικρό όνομα, χώρα, συγκατάθεση, site, ημερομηνία (όχι τηλέφωνο, επώνυμο, επάγγελμα)' -f $members.Count)
    Say '  4. το χρονόμετρο 30 λεπτών στη ρύθμιση του Hub (ισχύει με το επόμενο ανέβασμα του Hub)'
    Say '  5. το κλειδί του MailerLite (το επικολλάς· με σκέτο Enter το αφήνεις για αργότερα)'
    Say '  Τα παλιά sites και οι βάσεις τους δεν αλλάζουν. Κανένα μέλος δεν σβήνεται. Κανένα email δεν φεύγει από εδώ.'
    Say ''
    if (-not $readOk -or $cronState -like 'error*' -or $cronState -eq 'no-config') { Say 'Αποτέλεσμα: ΠΡΟΣΟΧΗ (δες τα παραπάνω). Δεν άλλαξε τίποτα.' 'Yellow'; Finish 2 }
    Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ (μόνο έλεγχος, δεν άλλαξε τίποτα)' 'Green'
    Finish 0
}

# ================= apply =================
if (-not $Apply) { Say ''; Say ('Χωρίς -Apply δεν αλλάζει τίποτα. Για την αλλαγή: -Step apply -Apply και η φράση {0}' -f $Phrase) 'Yellow'; Finish 0 }
if (-not $readOk) { Say 'Δεν διάβασα όλα τα παλιά sites: για ασφάλεια ΔΕΝ αλλάζω τίποτα. Ξανατρέξε σε λίγο.' 'Red'; Finish 6 }
if ($cronState -ne 'has' -and $cronState -ne 'missing') { Say 'Η ρύθμιση του Hub στον υπολογιστή δεν είναι αυτή που περίμενα: ΔΕΝ αλλάζω τίποτα.' 'Red'; Finish 7 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
Say ''
Say 'Έγκριση: ΕΝΤΑΞΕΙ.' 'Green'

# 1. backup
$bdir = Join-Path (Join-Path $WorkDir 'backups') ('before-hub-members-' + $stamp)
New-Item -ItemType Directory -Path $bdir -Force | Out-Null
$tt = Invoke-Wrangler $deploy ('d1 time-travel info {0}' -f $DbName) -Retry
$bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
if ($tt.code -ne 0 -or -not $bm.Success) { Say 'Δεν πήρα σημείο επαναφοράς της βάσης του Hub: ΔΕΝ άλλαξα τίποτα.' 'Red'; Finish 11 }
$all = Read-Db $deploy $DbName 'SELECT * FROM hub_subscribers'
if ($null -eq $all) { Say 'Δεν διάβασα τα μέλη για το backup: ΔΕΝ άλλαξα τίποτα.' 'Red'; Finish 11 }
$rowsFile = Join-Path $bdir 'hub_subscribers.json'
[System.IO.File]::WriteAllText($rowsFile, (ConvertTo-Json -InputObject @($all) -Depth 4), (New-Object System.Text.UTF8Encoding($false)))
Copy-Item -LiteralPath $cfgPc -Destination (Join-Path $bdir 'gear-world-hub.wrangler.toml') -Force
$note = @(
    ('Gear World Hub - member list, {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    'Back to how the Hub database was (Time Travel restore point, only with approval):',
    ('  npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $DbName, $bm.Value),
    ('Hub config on this PC before the change: {0}' -f (Join-Path $bdir 'gear-world-hub.wrangler.toml')),
    ('Remove the MailerLite key: npx wrangler secret delete {0} --name {1}' -f $SecretName, $HubWorker)
) -join "`r`n"
[System.IO.File]::WriteAllText((Join-Path $bdir 'rollback.txt'), $note, (New-Object System.Text.UTF8Encoding($false)))
Say ('1. Backup: σημείο επαναφοράς, {0} μέλη σε αρχείο, ρύθμιση του Hub: ΕΝΤΑΞΕΙ ({1})' -f @($all).Count, $bdir) 'Green'

# 2. new fields (only the missing ones) and the limits table
$sqlFile = Join-Path $WorkDir ('members-' + $stamp + '.sql')
$lines = New-Object System.Collections.Generic.List[string]
foreach ($c in $missing) { $lines.Add($c.sql + ';') }
$lines.Add('CREATE TABLE IF NOT EXISTS member_rate (rl_key TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL);')
# The members already there are members from before (no automatic welcome): only when the field is new.
if (@($missing | Where-Object { $_.name -eq 'mailerlite_group' }).Count -gt 0) { $lines.Add("UPDATE hub_subscribers SET mailerlite_group = 'existing' WHERE mailerlite_group IS NULL;") }
# 3. the Rewards members: added when new, else only empty fields are filled (consent is never taken away).
foreach ($m in $members) {
    $lines.Add(("INSERT INTO hub_subscribers (email, locale, marketing_consent, consent_version, source, status, created_at, updated_at, site, first_name, country, member_source, mailerlite_group) VALUES ({0}, 'en-GB', {1}, {2}, 'rewards', 'active', COALESCE({3}, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, {4}, {5}, {6}, {7}, 'existing') ON CONFLICT (email) DO UPDATE SET first_name = COALESCE(hub_subscribers.first_name, excluded.first_name), country = COALESCE(hub_subscribers.country, excluded.country), site = COALESCE(hub_subscribers.site, excluded.site), marketing_consent = MAX(hub_subscribers.marketing_consent, excluded.marketing_consent);" -f (Sql-Text $m.email 254), $m.consent, (Sql-Text ('rewards-' + $m.site) 40), (Sql-Text $m.created 40), (Sql-Text $m.site 3), (Sql-Text $m.first 60), (Sql-Text $m.country 60), (Sql-Text ('rewards:' + $m.site) 20)))
}
[System.IO.File]::WriteAllText($sqlFile, ($lines -join "`n") + "`n", (New-Object System.Text.UTF8Encoding($false)))
try {
    $x = Invoke-Wrangler $deploy ('d1 execute {0} --remote --file "{1}"' -f $DbName, $sqlFile) -Retry
} finally {
    # The file has email addresses: it never stays on the disk.
    Remove-Item -LiteralPath $sqlFile -ErrorAction SilentlyContinue
}
if ($x.code -ne 0) { Say 'Η αλλαγή στη βάση του Hub απέτυχε. Το σημείο επαναφοράς είναι στο rollback.txt. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($x.text -split "`n" | Select-Object -Last 8)) { Say ('  ' + $line) }; Finish 12 }
$info2 = Read-Db $deploy $DbName 'PRAGMA table_info(hub_subscribers)'
$have2 = @{}
if ($null -ne $info2) { foreach ($c in $info2) { $have2[[string]$c.name] = $true } }
$still = @($Columns | Where-Object { -not $have2.ContainsKey($_.name) })
if ($still.Count -gt 0) { Say 'Τα νέα πεδία δεν φαίνονται μετά την αλλαγή. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 12 }
$after = Read-Db $deploy $DbName "SELECT COUNT(*) AS n, SUM(marketing_consent = 1) AS c, SUM(substr(member_source, 1, 8) = 'rewards:') AS r FROM hub_subscribers"
Say ('2-3. Νέα πεδία και μέλη: ΕΝΤΑΞΕΙ. Μέλη τώρα: {0} (με συγκατάθεση: {1}, από Rewards: {2})' -f $after[0].n, $after[0].c, $after[0].r) 'Green'

# 4. the 30-minute timer in the Hub config on this PC
$cr = Invoke-HubBinding 'add-cron' $cfgPc
if ($cr -ne 'added' -and $cr -ne 'already') { Say ('Το χρονόμετρο δεν μπήκε στη ρύθμιση του Hub ({0}). Η βάση είναι έτοιμη· στείλε στο Claude αυτό το μήνυμα.' -f $cr) 'Red'; Finish 13 }
Say ('4. Χρονόμετρο 30 λεπτών στη ρύθμιση του Hub: {0} (ισχύει με το επόμενο ανέβασμα του Hub)' -f $(if ($cr -eq 'added') { 'μπήκε' } else { 'υπήρχε ήδη' })) 'Green'

# 5. the MailerLite key
$plain = ''
if ($TokenEnv) {
    $plain = [string][System.Environment]::GetEnvironmentVariable($TokenEnv)
} else {
    Write-Host ''
    Write-Host ('Κλειδί MailerLite: άνοιξε {0}, πάτα "Generate new token", όνομα "Gear World Hub", και αντέγραψέ το.' -f $KeyPage) -ForegroundColor Yellow
    Write-Host 'Αν δεν το έχεις τώρα, πάτα σκέτο Enter: όλα τα άλλα μένουν έτοιμα.' -ForegroundColor Yellow
    $sec = Read-Host 'Επικόλλησε εδώ το κλειδί (δεν φαίνεται όσο το επικολλάς) και πάτα Enter' -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
$plain = ([string]$plain).Trim()
if ($plain) { $script:Secrets.Add($plain) }
if (-not $plain) {
    Say '5. Κλειδί MailerLite: δεν δόθηκε τώρα (τρέξε την ίδια εντολή ξανά όταν το έχεις· τα υπόλοιπα κρατιούνται).' 'Yellow'
} elseif ($plain -match '\s' -or $plain.Length -lt 20 -or $plain.Length -gt 2000) {
    Say '5. Αυτό δεν μοιάζει με κλειδί του MailerLite. Δεν το αποθήκευσα. Τα υπόλοιπα έγιναν.' 'Red'
    Finish 8
} else {
    $s = Set-KeySecret $deploy $plain
    $plain = ''
    if ($s.code -ne 0) { Say '5. Το κλειδί δεν αποθηκεύτηκε. Τα υπόλοιπα έγιναν. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($s.text -split "`n" | Select-Object -Last 6)) { Say ('  ' + $line) }; Finish 8 }
    Say '5. Κλειδί MailerLite: αποθηκεύτηκε στο Hub ως μυστικό (δεν φαίνεται ποτέ ξανά).' 'Green'
}

Say ''
Say ('Επαναφορά (μόνο αν χρειαστεί): {0}' -f (Join-Path $bdir 'rollback.txt'))
Say 'Επόμενο: το νέο Hub (preview, live, σβήσιμο preview). Τα email προς το MailerLite ξεκινούν μόνο μετά το live του Hub.'
Say 'Αποτέλεσμα: ΕΤΟΙΜΟ' 'Green'
Finish 0
