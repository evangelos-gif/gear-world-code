<#
.SYNOPSIS
  Awin sales in the private dashboard (lessons L91): a private Worker copies the Awin sales of every Gear World site
  into its own D1 database every 2 hours. Read-only unless -Apply and the typed approval phrase.

.DESCRIPTION
  -Step check   READ-ONLY. Cloudflare login; the database gear-world-awin, the Worker gear-world-awin-sync and its
                secret AWIN_TOKEN (made already?); the last syncs and the sales saved so far. Shows the plan.
  -Step apply   CHANGES CLOUDFLARE ONLY (no site, no site database), one approval: ΕΓΚΡΙΝΩ AWIN SYNC. In this order:
                  1. the D1 database gear-world-awin and its tables (migration 0001);
                  2. the private Worker gear-world-awin-sync (no public address, a cron every 2 hours);
                  3. the Awin token as the secret AWIN_TOKEN: you paste it here, it is never shown, written to a file
                     or put in the report.
                Everything is new, so nothing of the sites needs a backup; to undo it, the report says how to delete
                the two new things. Running it again is safe (what is there is kept; the token can be replaced).
  -Step token   CHANGES ONE SECRET ONLY, one approval: ΕΓΚΡΙΝΩ AWIN TOKEN. Replaces AWIN_TOKEN of the Worker
                gear-world-awin-sync with a new Awin key (Awin revoked all keys on 3/11/2026). The key is pasted here,
                first tested with one read-only call to the Awin API (GET /accounts) and stored only if Awin accepts it.
                The Worker code, the database and the sites do not change. A refused key changes nothing.
  Report: <home>\gear-world-reports\AWIN_SETUP_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'apply', 'token')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$PcHome = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [string]$TokenEnv = '',
    [switch]$KeepToken,
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
# HTTPS with TLS 1.2: Windows PowerShell 5.1 may still offer only older TLS, which GitHub and Cloudflare refuse (L106).
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ AWIN SYNC'
$PhraseToken = 'ΕΓΚΡΙΝΩ AWIN TOKEN'
$DbName = 'gear-world-awin'
$WorkerName = 'gear-world-awin-sync'
$SecretName = 'AWIN_TOKEN'
if (-not $PcHome) { $PcHome = $HOME }
if (-not $WorkDir) { $WorkDir = Join-Path $PcHome 'gear-world-awin' }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$TokenPage = 'https://ui.awin.com/awin-api'
$script:Secrets = New-Object System.Collections.Generic.List[string]

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    foreach ($s in $script:Secrets) { if ($s) { $text = $text.Replace($s, '[token]') } }
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

# Cloudflare IDs (database, versions) never go into a report.
function Hide-Ids([string]$Text) {
    $t = [regex]::Replace($Text, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
    return [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{28}\b', '${1}-masked-id')
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('AWIN_SETUP_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('AWIN_SETUP_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = Hide-Ids ($L -join "`r`n")
    foreach ($s in $script:Secrets) { if ($s) { $text = $text.Replace($s, '[token]') } }
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
        # Lines left over from the paste (an empty last line) would answer the prompt by themselves (8 Nov 2026).
        try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
}

function New-CmdFile([string]$Folder, [string]$Arguments) {
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-awin-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
    [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
    return $cmdFile
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
# -Retry: on a network error or a passing Cloudflare error (7403, 10000: lessons L43), try again, up to 3 times.
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

# The token goes to wrangler through its standard input only: never on a command line, in a file or in the report.
function Set-TokenSecret([string]$Folder, [string]$Value) {
    $cmdFile = New-CmdFile $Folder ('secret put {0} --name {1}' -f $SecretName, $WorkerName)
    try {
        $out = @($Value | & $cmdFile)
        $code = $LASTEXITCODE
    } finally {
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    }
    $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
    if ($Value) { $text = $text.Replace($Value, '[token]') }
    return @{ code = $code; text = $text }
}

# The JSON array that wrangler printed with --json (warnings before it are skipped), as a flat array of its items.
# Windows PowerShell 5.1 gives a JSON array back as ONE object and PowerShell 7 as its items (lessons L76).
function Get-JsonArray([string]$text) {
    $m = [regex]::Match($text, '(?m)^\s*\[')
    $j = $text.LastIndexOf(']')
    if (-not $m.Success -or $j -le $m.Index) { return $null }
    try { $parsed = ConvertFrom-Json -InputObject $text.Substring($m.Index, $j - $m.Index + 1) } catch { return $null }
    $items = New-Object System.Collections.ArrayList
    foreach ($x in @($parsed)) { if ($null -ne $x) { [void]$items.Add($x) } }
    return , $items.ToArray()
}

# Copy of this repo version, ready for wrangler (npm ci once per version, so the wrangler version is fixed).
function Prepare-Deploy {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        foreach ($item in @('src', 'sites', 'package.json', 'package-lock.json')) {
            $src = Join-Path $repo $item
            if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $dest -Recurse -Force }
        }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-awin-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
    }
    return $dest
}

# The ID of the Awin database, '' when it does not exist yet, $null when the list could not be read.
function Get-AwinDbId([string]$folder) {
    $r = Invoke-Wrangler $folder 'd1 list --json' -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { return $null }
    foreach ($d in $j) { if ([string]$d.name -eq $DbName -and [string]$d.uuid) { return [string]$d.uuid } }
    return ''
}

# 'yes' / 'no' / 'missing' (no Worker yet) / 'unknown': is the secret AWIN_TOKEN set? Only names are read, never values.
function Get-SecretState([string]$folder) {
    $r = Invoke-Wrangler $folder ('secret list --name {0}' -f $WorkerName) -Retry
    if ($r.code -ne 0) {
        if ($r.text -match '(?i)code: 10007|does not exist|not found') { return 'missing' }
        return 'unknown'
    }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { return 'unknown' }
    foreach ($s in $j) { if ([string]$s.name -eq $SecretName) { return 'yes' } }
    return 'no'
}

function Get-WorkerState([string]$folder) {
    $r = Invoke-Wrangler $folder ('deployments list --name {0}' -f $WorkerName) -Retry
    if ($r.code -eq 0 -and $r.text -match 'Version\(s\):') { return 'yes' }
    if ($r.text -match '(?i)code: 10007|does not exist|not found') { return 'no' }
    return 'unknown'
}

# Rows of a read-only SELECT on the Awin database, or $null on error.
function Select-Awin([string]$folder, [string]$sql) {
    if ($sql -notmatch '^\s*SELECT ') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler $folder ('d1 execute {0} --remote --json --command "{1}"' -f $DbName, $sql) -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j -or $j.Count -lt 1) { return $null }
    return , @($j[0].results)
}

function Write-Config([string]$path, [string]$dbId) {
    $tpl = [System.IO.File]::ReadAllText((Join-Path (Join-Path (Join-Path $repo 'sites') 'awin') 'wrangler.jsonc.example'))
    $text = $tpl.Replace('REPLACE_WITH_DATABASE_ID', $dbId)
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

function Show-Sales([string]$folder) {
    $runs = Select-Awin $folder 'SELECT ran_at, ok, calls, fetched, saved, message FROM awin_sync_runs ORDER BY id DESC LIMIT 3'
    if ($null -eq $runs) { Say 'Τελευταίοι συγχρονισμοί: δεν διαβάστηκαν (ο πίνακας δεν υπάρχει ακόμα;)'; return }
    if ($runs.Count -eq 0) { Say 'Τελευταίοι συγχρονισμοί: κανένας ακόμα (ο πρώτος γίνεται στο επόμενο :23 μιας ζυγής ώρας).' }
    foreach ($x in $runs) {
        $state = 'ΠΡΟΒΛΗΜΑ'
        if ([int]$x.ok -eq 1) { $state = 'ΕΝΤΑΞΕΙ' }
        Say ('  {0}  {1}  κλήσεις {2}, πωλήσεις που ήρθαν {3}, αποθηκεύτηκαν {4}  {5}' -f $x.ran_at, $state, $x.calls, $x.fetched, $x.saved, [string]$x.message)
    }
    $tot = Select-Awin $folder 'SELECT COUNT(*) AS n, ROUND(SUM(commission_amount), 2) AS c, MAX(transaction_date) AS last FROM awin_transactions'
    if ($null -ne $tot -and $tot.Count -ge 1) {
        Say ('Πωλήσεις στη βάση: {0}, προμήθεια {1}, τελευταία {2}' -f $tot[0].n, $tot[0].c, $tot[0].last)
    }
}

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply) { $mode = 'APPLY (με έγκριση)' }
Say ('AWIN SALES SETUP - step: {0} - {1} - {2}' -f $Step, $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$deploy = Prepare-Deploy
$awinDir = Join-Path (Join-Path $deploy 'sites') 'awin'
$config = Join-Path $awinDir 'wrangler.jsonc'

$who = Invoke-Wrangler $deploy 'whoami' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    if ($who.text -match '(?i)not authenticated|wrangler login') { Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red' }
    else { Say 'Δεν μπόρεσα να ελέγξω τη σύνδεση με το Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red' }
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 15)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: ΕΝΤΑΞΕΙ' 'Green'

$dbId = Get-AwinDbId $deploy
if ($null -eq $dbId) { Say 'Δεν διάβασα τη λίστα των βάσεων D1. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 5 }
$worker = Get-WorkerState $deploy
$secret = 'missing'
if ($worker -eq 'yes') { $secret = Get-SecretState $deploy }

Say ''
Say 'Τι υπάρχει τώρα:'
if ($dbId) { Say ('  Βάση {0}: υπάρχει' -f $DbName) } else { Say ('  Βάση {0}: δεν υπάρχει ακόμα (θα φτιαχτεί)' -f $DbName) }
if ($worker -eq 'yes') { Say ('  Worker {0}: υπάρχει' -f $WorkerName) } elseif ($worker -eq 'no') { Say ('  Worker {0}: δεν υπάρχει ακόμα (θα ανέβει)' -f $WorkerName) } else { Say ('  Worker {0}: δεν διαβάστηκε' -f $WorkerName) 'Yellow' }
if ($secret -eq 'yes') { Say '  Κλειδί Awin (AWIN_TOKEN): υπάρχει' } elseif ($secret -eq 'unknown') { Say '  Κλειδί Awin (AWIN_TOKEN): δεν διαβάστηκε' 'Yellow' } else { Say '  Κλειδί Awin (AWIN_TOKEN): δεν υπάρχει ακόμα (θα σου ζητηθεί)' }
if ($dbId) {
    Write-Config $config $dbId
    Show-Sales $awinDir
}

if ($Step -eq 'check') {
    Say ''
    Say ('Πλάνο του apply (φράση: {0}):' -f $Phrase)
    Say ('  1. βάση {0} και οι πίνακές της (μόνο αν λείπουν)' -f $DbName)
    Say ('  2. ο ιδιωτικός Worker {0}: χωρίς δημόσια διεύθυνση, τρέχει κάθε 2 ώρες' -f $WorkerName)
    Say ('  3. το κλειδί του Awin: θα σου ζητηθεί να το επικολλήσεις (από {0}). Δεν φαίνεται και δεν γράφεται πουθενά.' -f $TokenPage)
    Say '  Τα sites και οι βάσεις τους δεν αλλάζουν.'
    Say ''
    Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ (μόνο έλεγχος, δεν άλλαξε τίποτα)' 'Green'
    Finish 0
}

# ================= token (replace AWIN_TOKEN only) =================
if ($Step -eq 'token') {
    Say ''
    Say ('Πλάνο (φράση: {0}): αλλάζει ΜΟΝΟ το μυστικό {1} του Worker {2}.' -f $PhraseToken, $SecretName, $WorkerName)
    Say '  Πριν αποθηκευτεί, το νέο κλειδί δοκιμάζεται με μία ανάγνωση στο Awin (λίστα λογαριασμών). Αν το Awin το αρνηθεί, δεν αλλάζει τίποτα.'
    Say '  Ο κώδικας του Worker, η βάση gear-world-awin και τα sites ΔΕΝ αλλάζουν.'
    Say '  Backup: το παλιό κλειδί το ακύρωσε το Awin (3/11/2026), οπότε δεν υπάρχει κάτι για να γυρίσουμε πίσω.'
    Say ('  Επαναφορά (μόνο με έγκριση): npx wrangler secret delete {0} --name {1}, ή ξανά αυτό το βήμα με άλλο κλειδί.' -f $SecretName, $WorkerName)
    if ($worker -ne 'yes') { Say ('Ο Worker {0} δεν βρέθηκε: πρώτα το βήμα apply. Δεν άλλαξε τίποτα.' -f $WorkerName) 'Red'; Finish 7 }
    if (-not $Apply) { Say ''; Say ('Χωρίς -Apply δεν αλλάζει τίποτα. Για την αλλαγή: -Step token -Apply και η φράση {0}' -f $PhraseToken) 'Yellow'; Finish 0 }
    if (-not (Confirm-Approval $PhraseToken)) { Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
    Say ''
    Say 'Έγκριση: ΕΝΤΑΞΕΙ.' 'Green'
    $plain = ''
    if ($TokenEnv) {
        $plain = [string][System.Environment]::GetEnvironmentVariable($TokenEnv)
    } else {
        Write-Host ''
        Write-Host ('Από τη σελίδα {0}: αντέγραψε το νέο κλειδί.' -f $TokenPage) -ForegroundColor Yellow
        $sec = Read-Host 'Επικόλλησε εδώ το κλειδί (δεν φαίνεται όσο το επικολλάς) και πάτα Enter' -AsSecureString
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
        try { $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
    $plain = ([string]$plain).Trim()
    if ($plain) { $script:Secrets.Add($plain) }
    if (-not $plain) { Say 'Δεν δόθηκε κλειδί. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 8 }
    if ($plain -match '\s' -or $plain.Length -lt 16 -or $plain.Length -gt 200) { Say 'Αυτό δεν μοιάζει με κλειδί του Awin (κενά ή λάθος μήκος). Δεν άλλαξε τίποτα.' 'Red'; Finish 8 }
    # One read-only call to Awin with the new key (in the request header only).
    $awinOk = $false
    $awinNote = ''
    if ($env:GW_TEST_AWIN_API) {
        $awinOk = ($env:GW_TEST_AWIN_API -eq 'ok')
        $awinNote = 'test'
    } else {
        try {
            $resp = Invoke-RestMethod -UseBasicParsing -Method Get -Uri 'https://api.awin.com/accounts?type=publisher' -Headers @{ Authorization = ('Bearer ' + $plain) } -TimeoutSec 30
            $count = @($resp.accounts).Count
            $awinOk = $true
            $awinNote = ('{0} λογαριασμός/οί publisher' -f $count)
        } catch {
            $code = 0
            try { $code = [int]$_.Exception.Response.StatusCode } catch { }
            $awinNote = ('απάντηση {0}' -f $code)
        }
    }
    if (-not $awinOk) { Say ('Το Awin ΔΕΝ δέχτηκε το νέο κλειδί ({0}). Δεν άλλαξε τίποτα. Φτιάξε νέο κλειδί και ξανατρέξε.' -f $awinNote) 'Red'; Finish 10 }
    Say ('Το Awin δέχτηκε το νέο κλειδί ({0}): ΕΝΤΑΞΕΙ' -f $awinNote) 'Green'
    $s = Set-TokenSecret $deploy $plain
    $plain = ''
    if ($s.code -ne 0) { Say 'Το κλειδί δεν αποθηκεύτηκε στο Cloudflare. Το παλιό (ακυρωμένο) μένει. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($s.text -split "`n" | Select-Object -Last 8)) { Say ('  ' + $line) }; Finish 8 }
    if ((Get-SecretState $deploy) -ne 'yes') { Say 'Το μυστικό δεν φαίνεται μετά την αλλαγή. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 9 }
    Say ('Νέο κλειδί: αποθηκεύτηκε ως {0} στον Worker {1} (δεν φαίνεται ποτέ ξανά).' -f $SecretName, $WorkerName) 'Green'
    Say ''
    Say 'Αποτέλεσμα: ΕΤΟΙΜΟ. Ο επόμενος συγχρονισμός γίνεται στο :23 της επόμενης ζυγής ώρας (π.χ. 20:23, 22:23).' 'Green'
    Finish 0
}

# ================= apply =================
if (-not $Apply) {
    Say ''
    Say ('Χωρίς -Apply δεν αλλάζει τίποτα. Για την εγκατάσταση: -Step apply -Apply και η φράση {0}' -f $Phrase) 'Yellow'
    Finish 0
}
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
Say ''
Say 'Έγκριση: ΕΝΤΑΞΕΙ. Όλα είναι καινούρια, οπότε δεν υπάρχει κάτι παλιό για backup.' 'Green'

# 1. database and tables
if (-not $dbId) {
    Say ('1. Φτιάχνω τη βάση {0}...' -f $DbName)
    $c = Invoke-Wrangler $deploy ('d1 create {0}' -f $DbName) -Retry
    if ($c.code -ne 0 -and $c.text -notmatch '(?i)already exists') { Say 'Η βάση δεν φτιάχτηκε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($c.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }; Finish 5 }
    $dbId = Get-AwinDbId $deploy
    if (-not $dbId) { Say 'Η βάση δεν βρέθηκε μετά τη δημιουργία. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 5 }
} else {
    Say ('1. Η βάση {0} υπάρχει ήδη: την κρατάω.' -f $DbName)
}
Write-Config $config $dbId
Copy-Item -LiteralPath $config -Destination (Join-Path $WorkDir 'wrangler.jsonc') -Force
$m = Invoke-Wrangler $awinDir ('d1 migrations apply {0} --remote' -f $DbName) -Retry
if ($m.code -ne 0) { Say 'Οι πίνακες δεν φτιάχτηκαν. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($m.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }; Finish 6 }
Say '   Πίνακες: ΕΝΤΑΞΕΙ' 'Green'

# 2. the Worker
Say ('2. Ανεβάζω τον ιδιωτικό Worker {0}...' -f $WorkerName)
$d = Invoke-Wrangler $awinDir ('deploy --config "{0}"' -f $config)
if ($d.code -ne 0 -and $d.text -match 'code: 10007') {
    Say 'Το Cloudflare δεν απάντησε σωστά στο ανέβασμα. Ξαναδοκιμάζω σε 15 δευτερόλεπτα...' 'Yellow'
    Start-Sleep -Seconds 15
    $d = Invoke-Wrangler $awinDir ('deploy --config "{0}"' -f $config)
}
if ($d.code -ne 0) { Say 'Ο Worker δεν ανέβηκε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($d.text -split "`n" | Select-Object -Last 12)) { Say ('  ' + $line) }; Finish 7 }
Say '   Worker: ΕΝΤΑΞΕΙ (χωρίς δημόσια διεύθυνση, κάθε 2 ώρες)' 'Green'

# 3. the token
$secret = Get-SecretState $deploy
if ($secret -eq 'yes' -and $KeepToken) {
    Say '3. Το κλειδί του Awin υπάρχει ήδη: το κρατάω (-KeepToken).'
} else {
    Say '3. Το κλειδί του Awin.'
    $plain = ''
    if ($TokenEnv) {
        $plain = [string][System.Environment]::GetEnvironmentVariable($TokenEnv)
    } else {
        Write-Host ''
        Write-Host ('Άνοιξε {0}, γράψε τον κωδικό σου, πάτα "Show my API token" και αντέγραψέ το.' -f $TokenPage) -ForegroundColor Yellow
        if ($secret -eq 'yes') { Write-Host 'Υπάρχει ήδη κλειδί: αν πατήσεις σκέτο Enter, το κρατάω.' -ForegroundColor Yellow }
        $sec = Read-Host 'Επικόλλησε εδώ το κλειδί (δεν φαίνεται όσο το επικολλάς) και πάτα Enter' -AsSecureString
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
        try { $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
    $plain = ([string]$plain).Trim()
    if ($plain) { $script:Secrets.Add($plain) }
    if (-not $plain) {
        if ($secret -eq 'yes') { Say '   Δεν δόθηκε νέο κλειδί: κρατάω το υπάρχον.' }
        else { Say '   Δεν δόθηκε κλειδί. Η βάση και ο Worker είναι έτοιμα· τρέξε την ίδια εντολή ξανά όταν το έχεις.' 'Yellow'; Finish 8 }
    } elseif ($plain -match '\s' -or $plain.Length -lt 16 -or $plain.Length -gt 200) {
        Say '   Αυτό δεν μοιάζει με κλειδί του Awin (κενά ή λάθος μήκος). Δεν το αποθήκευσα. Δοκίμασε ξανά.' 'Red'
        Finish 8
    } else {
        $s = Set-TokenSecret $deploy $plain
        $plain = ''
        if ($s.code -ne 0) { Say '   Το κλειδί δεν αποθηκεύτηκε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($s.text -split "`n" | Select-Object -Last 8)) { Say ('  ' + $line) }; Finish 8 }
        Say '   Κλειδί: αποθηκεύτηκε στο Cloudflare ως μυστικό (δεν φαίνεται ποτέ ξανά).' 'Green'
    }
}

# 4. checks
$after = Get-SecretState $deploy
$okAll = ($after -eq 'yes') -and ((Get-WorkerState $deploy) -eq 'yes')
Say ''
Show-Sales $awinDir
Say ''
Say 'Αν θελήσεις να το αναιρέσεις (σβήνει μόνο τα δύο καινούρια, τα sites δεν επηρεάζονται):'
Say ('  npx wrangler delete --name {0}' -f $WorkerName)
Say ('  npx wrangler d1 delete {0}' -f $DbName)
Say ('  και στο {0} μπορείς να ακυρώσεις (Revoke) το κλειδί.' -f $TokenPage)
Say ''
if ($okAll) {
    Say 'Αποτέλεσμα: ΕΤΟΙΜΟ. Ο πρώτος συγχρονισμός γίνεται στο επόμενο :23 μιας ζυγής ώρας (π.χ. 14:23, 16:23).' 'Green'
    Finish 0
}
Say 'Αποτέλεσμα: ΠΡΟΒΛΗΜΑ στον τελικό έλεγχο (Worker ή κλειδί δεν βρέθηκαν). Στείλε στο Claude αυτό το μήνυμα.' 'Red'
Finish 9
