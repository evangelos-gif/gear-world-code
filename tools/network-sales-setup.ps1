<#
.SYNOPSIS
  Sales of CJ, Daisycon and Linkwise in the private dashboard, next to the Awin sales (lessons L197): a private Worker
  copies them every 2 hours into the Awin sales database (NEW tables only). Read-only unless -Apply and the typed
  approval phrase.

.DESCRIPTION
  -Step check   READ-ONLY (default). Cloudflare login; the database gear-world-awin (made by awin-setup) and its new
                tables; the Worker gear-world-network-sync and which of its keys are set (NAMES only, never a value);
                the last sync of each network and the sales saved. Shows the plan and where each key is made.
  -Step apply   CHANGES CLOUDFLARE ONLY (no site, no site database, the Awin sync stays as it is), one approval:
                ΕΓΚΡΙΝΩ ΠΩΛΗΣΕΙΣ ΔΙΚΤΥΩΝ. In this order:
                  1. backup: a Time Travel restore point of gear-world-awin and a dated copy (export) on this PC;
                  2. the new tables (migration 0002: network_transactions, network_sync_runs, network_oauth and the
                     view all_network_sales); the Awin tables do not change;
                  3. the private Worker gear-world-network-sync (no public address, a cron every 2 hours at :47);
                  4. the keys of the chosen networks (-Only), each typed at a hidden prompt, first tested with one
                     read-only call to that network, and handed to wrangler through its input only: never shown,
                     written to a file or put in the report. Daisycon: a sign-in in the browser (its keys work once
                     and last 30 days; the Worker keeps the newest one encrypted).
                Running it again is safe: what is there is kept, a key is replaced only when a new one is typed.
  -Step probe   READ-ONLY, Linkwise only. With the Linkwise API login typed at the prompt (not stored by this step), one
                call to reports_transaction.json and one to programs.json, without parameters; the report gets ONLY the
                parameter names, field names and messages, never a value (TODO(linkwise) in src/networks/linkwise.js).
  -Only cj | daisycon | linkwise (or a list 'cj,daisycon'): which networks' keys to set or check. Default: all three.
  Report: <home>\gear-world-reports\NETWORK_SALES_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'apply', 'probe')]
    [string]$Step = 'check',
    [string]$Only = 'cj,daisycon,linkwise',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$CjCid = '8114224,7806395',
    [string]$PcHome = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [string]$SecretEnvPrefix = '',
    [switch]$KeepSecrets,
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
# HTTPS with TLS 1.2: Windows PowerShell 5.1 may still offer only older TLS, which GitHub and Cloudflare refuse (L106).
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ ΠΩΛΗΣΕΙΣ ΔΙΚΤΥΩΝ'
$DbName = 'gear-world-awin'
$WorkerName = 'gear-world-network-sync'
if (-not $PcHome) { $PcHome = $HOME }
if (-not $WorkDir) { $WorkDir = Join-Path $PcHome 'gear-world-network-sales' }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
$SecretsDir = Join-Path $PcHome 'gear-world-secrets'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$script:Secrets = New-Object System.Collections.Generic.List[string]

# The networks and their Worker secrets (src/networks/*.js). A new network: one entry here and one file there.
$Networks = [ordered]@{
    cj       = @{ Label = 'CJ'; Secrets = @('CJ_TOKEN'); Optional = @(); Page = 'https://developers.cj.com/account/personal-access-tokens' }
    daisycon = @{ Label = 'Daisycon'; Secrets = @('DAISYCON_CLIENT_ID', 'DAISYCON_REFRESH_SEED', 'NETWORK_SYNC_KEY'); Optional = @('DAISYCON_CLIENT_SECRET'); Page = 'https://login.daisycon.com/ (Tools -> Daisycon API)' }
    linkwise = @{ Label = 'Linkwise'; Secrets = @('LINKWISE_API_USER', 'LINKWISE_API_PASSWORD'); Optional = @(); Page = 'https://affiliate.linkwi.se/ (API)' }
}
$NewTables = @('network_transactions', 'network_sync_runs', 'network_oauth', 'all_network_sales')

$L = New-Object System.Collections.Generic.List[string]
function Hide-Secrets([string]$text) {
    foreach ($s in $script:Secrets) { if ($s -and $s.Length -ge 6) { $text = $text.Replace($s, '[κλειδί]') } }
    return $text
}
function Say([string]$text, [string]$color = '') {
    $text = Hide-Secrets $text
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

# Cloudflare IDs (database, versions, restore points) never go into a report.
function Hide-Ids([string]$Text) {
    $t = [regex]::Replace($Text, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
    return [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{28}\b', '${1}-masked-id')
}

function Clear-NsEnv {
    foreach ($n in @('GW_NS_CJ_TOKEN', 'GW_NS_LW_USER', 'GW_NS_LW_PASS', 'GW_DC_CLIENT', 'GW_DC_SECRET', 'GW_DC_CODE', 'GW_DC_VERIFIER')) {
        [System.Environment]::SetEnvironmentVariable($n, $null)
    }
}

function Finish([int]$code) {
    Clear-NsEnv
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('NETWORK_SALES_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('NETWORK_SALES_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = Hide-Secrets (Hide-Ids ($L -join "`r`n"))
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

# A key: from the hidden prompt (never echoed), or in the tests from the variable <prefix><NAME>. '' = nothing typed.
function Read-Key([string]$Name, [string]$Prompt) {
    $plain = ''
    if ($SecretEnvPrefix) {
        $plain = [string][System.Environment]::GetEnvironmentVariable($SecretEnvPrefix + $Name)
    } else {
        try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
        $sec = Read-Host $Prompt -AsSecureString
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
        try { $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
    $plain = ([string]$plain).Trim()
    if ($plain) { $script:Secrets.Add($plain) }
    return $plain
}

# A key kept encrypted for this Windows user (DPAPI) by another Gear World tool, or '' when there is none.
function Read-DpapiText([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return '' }
    try {
        $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($Path).Trim())
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
        try { $t = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
        return [string]$t
    } catch { return '' }
}

function New-CmdFile([string]$Folder, [string]$Arguments) {
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-netsales-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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

# A key goes to wrangler through its standard input only: never on a command line, in a file or in the report.
function Set-WorkerSecret([string]$Folder, [string]$Name, [string]$Value) {
    if ($Name -notmatch '^[A-Z][A-Z0-9_]{2,60}$') { throw 'Unexpected secret name' }
    $cmdFile = New-CmdFile $Folder ('secret put {0} --name {1}' -f $Name, $WorkerName)
    try {
        $out = @($Value | & $cmdFile)
        $code = $LASTEXITCODE
    } finally {
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    }
    $text = Hide-Secrets ((($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', '')
    if ($Value) { $text = $text.Replace($Value, '[κλειδί]') }
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
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-netsales-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
    }
    return $dest
}

# Runs a Node helper (the keys only in its environment) and returns its one-line JSON answer, or $null.
function Invoke-NodeJson([string]$Script, [string[]]$NodeArgs) {
    $a = @((Join-Path (Join-Path $repo 'tools') $Script)) + $NodeArgs
    $oldEnc = $null
    try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
    try { $o = @(& node @a) } finally { if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } } }
    $line = [string](($o | Where-Object { "$_".StartsWith('{') }) | Select-Object -Last 1)
    if (-not $line) { return $null }
    try { return ($line | ConvertFrom-Json) } catch { return $null }
}

# The ID of the database, '' when it does not exist, $null when the list could not be read.
function Get-DbId([string]$folder) {
    $r = Invoke-Wrangler $folder 'd1 list --json' -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { return $null }
    foreach ($d in $j) { if ([string]$d.name -eq $DbName -and [string]$d.uuid) { return [string]$d.uuid } }
    return ''
}

# The names of the Worker's secrets (never values), 'missing' when there is no Worker, $null when unreadable.
function Get-SecretNames([string]$folder) {
    $r = Invoke-Wrangler $folder ('secret list --name {0}' -f $WorkerName) -Retry
    if ($r.code -ne 0) {
        if ($r.text -match '(?i)code: 10007|does not exist|not found') { return , @('missing') }
        return $null
    }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { return $null }
    $names = New-Object System.Collections.ArrayList
    foreach ($s in $j) { if ([string]$s.name) { [void]$names.Add([string]$s.name) } }
    return , $names.ToArray()
}

function Get-WorkerState([string]$folder) {
    $r = Invoke-Wrangler $folder ('deployments list --name {0}' -f $WorkerName) -Retry
    if ($r.code -eq 0 -and $r.text -match 'Version\(s\):') { return 'yes' }
    if ($r.text -match '(?i)code: 10007|does not exist|not found') { return 'no' }
    return 'unknown'
}

# Rows of a read-only SELECT on the database, or $null on error.
function Select-Db([string]$folder, [string]$sql) {
    if ($sql -notmatch '^\s*SELECT ') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler $folder ('d1 execute {0} --remote --json --command "{1}"' -f $DbName, $sql) -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j -or $j.Count -lt 1) { return $null }
    return , @($j[0].results)
}

function Write-Config([string]$path, [string]$dbId, [string]$cids) {
    $tpl = [System.IO.File]::ReadAllText((Join-Path (Join-Path (Join-Path $repo 'sites') 'network-sales') 'wrangler.jsonc.example'))
    $text = $tpl.Replace('REPLACE_WITH_DATABASE_ID', $dbId).Replace('REPLACE_WITH_CJ_CIDS', $cids)
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

function Show-Syncs([string]$folder) {
    $runs = Select-Db $folder 'SELECT network, ran_at, ok, calls, fetched, saved, message FROM network_sync_runs WHERE id IN (SELECT MAX(id) FROM network_sync_runs GROUP BY network) ORDER BY network'
    if ($null -eq $runs) { Say 'Τελευταίοι συγχρονισμοί: δεν διαβάστηκαν (οι πίνακες δεν υπάρχουν ακόμα;)'; return }
    if ($runs.Count -eq 0) { Say 'Τελευταίοι συγχρονισμοί: κανένας ακόμα (ο πρώτος γίνεται στο επόμενο :47 μιας ζυγής ώρας).' }
    foreach ($x in $runs) {
        $state = '🔴 ΠΡΟΒΛΗΜΑ'
        if ([int]$x.ok -eq 1) { $state = '🟢 ΕΝΤΑΞΕΙ' }
        Say ('  {0}: {1}  {2}  κλήσεις {3}, πωλήσεις που ήρθαν {4}, αποθηκεύτηκαν {5}  {6}' -f $x.network, $x.ran_at, $state, $x.calls, $x.fetched, $x.saved, [string]$x.message)
    }
    $tot = Select-Db $folder 'SELECT network, COUNT(*) AS n, ROUND(SUM(commission_amount), 2) AS c, MAX(currency) AS cur, MAX(sale_date) AS last FROM network_transactions GROUP BY network ORDER BY network'
    if ($null -ne $tot) {
        foreach ($x in $tot) { Say ('  Πωλήσεις {0} στη βάση: {1}, προμήθεια {2} {3}, τελευταία {4}' -f $x.network, $x.n, $x.c, $x.cur, $x.last) }
    }
}

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply -and $Step -eq 'apply') { $mode = 'APPLY (με έγκριση)' }
Say ('NETWORK SALES SETUP (CJ, Daisycon, Linkwise) - step: {0} - {1} - {2}' -f $Step, $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
$chosen = @(([string]$Only).ToLowerInvariant() -split '[,\s]+' | Where-Object { $_ } | Select-Object -Unique)
foreach ($c in $chosen) { if (-not $Networks.Contains($c)) { Say ('Άγνωστο δίκτυο: {0}. Γράψε cj, daisycon ή linkwise.' -f $c) 'Red'; Finish 12 } }
if ($chosen.Count -lt 1) { Say 'Δεν δόθηκε δίκτυο (-Only cj, daisycon ή linkwise).' 'Red'; Finish 12 }
$cidList = @(([string]$CjCid) -split '[,\s]+' | Where-Object { $_ })
foreach ($c in $cidList) { if ($c -notmatch '^\d{3,12}$') { Say 'Λάθος αριθμός λογαριασμού CJ (-CjCid).' 'Red'; Finish 12 } }
$CjCid = ($cidList -join ',')
Say ('Δίκτυα: {0}' -f (($chosen | ForEach-Object { $Networks[$_].Label }) -join ', '))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }

# ================= probe (Linkwise, read-only, no Cloudflare) =================
if ($Step -eq 'probe') {
    if ($chosen.Count -ne 1 -or $chosen[0] -ne 'linkwise') { Say 'Το βήμα probe είναι μόνο για το Linkwise: -Step probe -Only linkwise' 'Red'; Finish 12 }
    Say ''
    Say 'Μόνο ανάγνωση: μία κλήση στην αναφορά συναλλαγών και μία στη λίστα προγραμμάτων του Linkwise, χωρίς παραμέτρους.'
    Say 'Στην αναφορά γράφονται ΜΟΝΟ ονόματα παραμέτρων και πεδίων και τα μηνύματα του Linkwise, ποτέ τιμές. Το login δεν φυλάγεται.'
    Write-Host ''
    Write-Host 'Το όνομα χρήστη και ο κωδικός του API: στο https://affiliate.linkwi.se/ (μενού API / Εργαλεία).' -ForegroundColor Yellow
    $u = Read-Key 'LINKWISE_API_USER' 'Linkwise API: όνομα χρήστη (δεν φαίνεται όσο το γράφεις)'
    $p = Read-Key 'LINKWISE_API_PASSWORD' 'Linkwise API: κωδικός (δεν φαίνεται όσο τον γράφεις)'
    if (-not $u -or -not $p) { Say 'Δεν δόθηκε όνομα ή κωδικός. Δεν έγινε καμία κλήση.' 'Yellow'; Finish 8 }
    $env:GW_NS_LW_USER = $u; $env:GW_NS_LW_PASS = $p
    try { $R = Invoke-NodeJson 'network-sales.mjs' @('--mode', 'linkwise-probe') } finally { Clear-NsEnv }
    if ($null -eq $R) { Say 'Το Node δεν έδωσε απάντηση. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
    if ($R.error) { Say ('Linkwise: {0}' -f $R.error) 'Red'; Finish 8 }
    foreach ($c in @($R.calls)) {
        Say ''
        Say ('{0}: απάντηση {1} {2}, μορφή {3}' -f $c.path, $c.status, $c.type, $c.kind)
        if (@($c.keys).Count) { Say ('  πεδία πάνω επιπέδου: {0}' -f (@($c.keys) -join ', ')) }
        if ($null -ne $c.items) { Say ('  στοιχεία στη λίστα: {0}; πεδία του πρώτου: {1}' -f $c.items, (@($c.itemKeys) -join ', ')) }
        if (@($c.tags).Count) { Say ('  ετικέτες (XML/HTML): {0}' -f (@($c.tags) -join ', ')) }
        if ($c.tell) { foreach ($pr in $c.tell.PSObject.Properties) { Say ('  {0}: {1}' -f $pr.Name, [string]$pr.Value) } }
        if ($c.error) { Say ('  σφάλμα: {0}' -f $c.error) }
    }
    Say ''
    if ($R.refused) { Say 'Αποτέλεσμα: 🔴 ΠΡΟΒΛΗΜΑ: το Linkwise δεν δέχτηκε το όνομα/κωδικό του API (401). Δεν άλλαξε τίποτα.' 'Red'; Finish 10 }
    Say 'Αποτέλεσμα: 🟢 ΕΝΤΑΞΕΙ (μόνο ανάγνωση, δεν άλλαξε τίποτα). Στείλε την αναφορά στο Claude για να ολοκληρωθεί το Linkwise.' 'Green'
    Finish 0
}

if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$deploy = Prepare-Deploy
$nsDir = Join-Path (Join-Path $deploy 'sites') 'network-sales'
$config = Join-Path $nsDir 'wrangler.jsonc'

$who = Invoke-Wrangler $deploy 'whoami' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    if ($who.text -match '(?i)not authenticated|wrangler login') { Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red' }
    else { Say 'Δεν μπόρεσα να ελέγξω τη σύνδεση με το Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red' }
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 15)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: 🟢 ΕΝΤΑΞΕΙ' 'Green'

$dbId = Get-DbId $deploy
if ($null -eq $dbId) { Say 'Δεν διάβασα τη λίστα των βάσεων D1. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 5 }
if (-not $dbId) { Say ('Η βάση {0} δεν υπάρχει: πρώτα το awin-setup (apply). Δεν άλλαξε τίποτα.' -f $DbName) 'Red'; Finish 5 }
Write-Config $config $dbId $CjCid
$worker = Get-WorkerState $deploy
$names = @('missing')
if ($worker -eq 'yes') { $names = Get-SecretNames $deploy }

Say ''
Say 'Τι υπάρχει τώρα:'
Say ('  Βάση {0}: υπάρχει (εκεί είναι και οι πωλήσεις του Awin)' -f $DbName)
$have = Select-Db $nsDir ("SELECT name FROM sqlite_master WHERE name IN ('{0}')" -f ($NewTables -join "', '"))
$haveNames = @()
if ($null -ne $have) { $haveNames = @($have | ForEach-Object { [string]$_.name }) }
$missingTables = @($NewTables | Where-Object { $haveNames -notcontains $_ })
if ($missingTables.Count -eq 0) { Say '  Νέοι πίνακες: υπάρχουν όλοι' } else { Say ('  Νέοι πίνακες που λείπουν (θα φτιαχτούν): {0}' -f ($missingTables -join ', ')) }
if ($worker -eq 'yes') { Say ('  Worker {0}: υπάρχει' -f $WorkerName) } elseif ($worker -eq 'no') { Say ('  Worker {0}: δεν υπάρχει ακόμα (θα ανέβει)' -f $WorkerName) } else { Say ('  Worker {0}: δεν διαβάστηκε' -f $WorkerName) 'Yellow' }
if ($null -eq $names) { Say '  Κλειδιά του Worker: δεν διαβάστηκαν' 'Yellow'; $names = @() }
foreach ($k in $Networks.Keys) {
    $n = $Networks[$k]
    $set = @($n.Secrets | Where-Object { $names -contains $_ })
    $miss = @($n.Secrets | Where-Object { $names -notcontains $_ })
    $state = 'δεν έχει στηθεί'
    if ($miss.Count -eq 0) { $state = 'όλα τα κλειδιά υπάρχουν' } elseif ($set.Count -gt 0) { $state = ('λείπουν: {0}' -f ($miss -join ', ')) }
    Say ('  {0}: {1}' -f $n.Label, $state)
}
if ($missingTables.Count -lt $NewTables.Count) { Show-Syncs $nsDir }

if ($Step -eq 'check') {
    Say ''
    Say ('Πλάνο του apply (φράση: {0}):' -f $Phrase)
    Say ('  1. backup: σημείο επαναφοράς (Time Travel) της βάσης {0} και αντίγραφό της σε αρχείο σε αυτόν τον υπολογιστή' -f $DbName)
    Say '  2. οι νέοι πίνακες (μόνο αν λείπουν). Οι πίνακες του Awin δεν αλλάζουν'
    Say ('  3. ο ιδιωτικός Worker {0}: χωρίς δημόσια διεύθυνση, κάθε 2 ώρες στο :47' -f $WorkerName)
    Say '  4. τα κλειδιά, μόνο για τα δίκτυα που διάλεξες (θα σου ζητηθούν, δεν φαίνονται, δεν γράφονται πουθενά):'
    foreach ($c in $chosen) {
        $n = $Networks[$c]
        Say ('     {0}: {1}  - από {2}' -f $n.Label, (($n.Secrets + $n.Optional) -join ', '), $n.Page)
    }
    if ($chosen -contains 'linkwise') { Say '     Linkwise: τα κλειδιά φυλάγονται, αλλά ο συγχρονισμός του περιμένει πρώτα το βήμα probe (μόνο ανάγνωση).' }
    Say '  Τα sites και οι βάσεις τους δεν αλλάζουν.'
    Say ''
    Say 'Αποτέλεσμα: 🟢 ΕΝΤΑΞΕΙ (μόνο έλεγχος, δεν άλλαξε τίποτα)' 'Green'
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
Say 'Έγκριση: 🟢 ΕΝΤΑΞΕΙ.' 'Green'

# 1. backup
$bdir = Join-Path (Join-Path $WorkDir 'backups') ('before-network-sales-' + $stamp)
New-Item -ItemType Directory -Path $bdir -Force | Out-Null
$tt = Invoke-Wrangler $nsDir ('d1 time-travel info {0}' -f $DbName) -Retry
$bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
if ($tt.code -ne 0 -or -not $bm.Success) { Say 'Δεν πήρα σημείο επαναφοράς της βάσης: ΔΕΝ άλλαξα τίποτα.' 'Red'; Finish 11 }
$dump = Join-Path $bdir ($DbName + '.sql')
$ex = Invoke-Wrangler $nsDir ('d1 export {0} --remote --output "{1}"' -f $DbName, $dump) -Retry
if ($ex.code -ne 0 -or -not (Test-Path -LiteralPath $dump)) { Say 'Δεν έγινε το αντίγραφο της βάσης σε αρχείο: ΔΕΝ άλλαξα τίποτα.' 'Red'; foreach ($line in @($ex.text -split "`n" | Select-Object -Last 6)) { Say ('  ' + $line) }; Finish 11 }
$undoSql = "DROP VIEW IF EXISTS all_network_sales; DROP TABLE IF EXISTS network_oauth; DROP TABLE IF EXISTS network_sync_runs; DROP TABLE IF EXISTS network_transactions; DELETE FROM d1_migrations WHERE name = '0002_network_sales.sql'"
$rollback = @(
    ('Gear World - network sales (CJ, Daisycon, Linkwise), {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    'To undo (only with approval; the sites and the Awin sync are not affected):',
    ('  1. the Worker:      npx wrangler delete --name {0}' -f $WorkerName),
    ('  2. the new tables:  npx wrangler d1 execute {0} --remote --command "{1}"' -f $DbName, $undoSql),
    ('  or the whole database as it was (also takes the Awin sales back to this moment; the Awin sync fills them again within 2 hours):'),
    ('     npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $DbName, $bm.Value),
    ('  copy of the database before the change: {0}' -f $dump)
) -join "`r`n"
[System.IO.File]::WriteAllText((Join-Path $bdir 'rollback.txt'), $rollback, (New-Object System.Text.UTF8Encoding($false)))
Say ('1. Backup: σημείο επαναφοράς και αντίγραφο σε αρχείο: 🟢 ΕΝΤΑΞΕΙ ({0})' -f $bdir) 'Green'

# 2. the new tables
Copy-Item -LiteralPath $config -Destination (Join-Path $WorkDir 'wrangler.jsonc') -Force
$m = Invoke-Wrangler $nsDir ('d1 migrations apply {0} --remote' -f $DbName) -Retry
if ($m.code -ne 0) { Say '2. Οι νέοι πίνακες δεν φτιάχτηκαν. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($m.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }; Finish 6 }
Say '2. Νέοι πίνακες: 🟢 ΕΝΤΑΞΕΙ (του Awin δεν άλλαξαν)' 'Green'

# 3. the Worker
Say ('3. Ανεβάζω τον ιδιωτικό Worker {0}...' -f $WorkerName)
$d = Invoke-Wrangler $nsDir ('deploy --config "{0}"' -f $config)
if ($d.code -ne 0 -and $d.text -match 'code: 10007') {
    Say 'Το Cloudflare δεν απάντησε σωστά στο ανέβασμα. Ξαναδοκιμάζω σε 15 δευτερόλεπτα...' 'Yellow'
    Start-Sleep -Seconds 15
    $d = Invoke-Wrangler $nsDir ('deploy --config "{0}"' -f $config)
}
if ($d.code -ne 0) { Say '   Ο Worker δεν ανέβηκε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($d.text -split "`n" | Select-Object -Last 12)) { Say ('  ' + $line) }; Finish 7 }
Say '   Worker: 🟢 ΕΝΤΑΞΕΙ (χωρίς δημόσια διεύθυνση, κάθε 2 ώρες στο :47)' 'Green'

# 4. the keys, network by network. A network whose key is refused is left as it was; the others go on.
$names = Get-SecretNames $deploy
if ($null -eq $names) { $names = @() }
$failed = New-Object System.Collections.Generic.List[string]
function Put-Key([string]$Name, [string]$Value) {
    $s = Set-WorkerSecret $deploy $Name $Value
    if ($s.code -ne 0) { Say ('   Το κλειδί {0} δεν αποθηκεύτηκε.' -f $Name) 'Red'; foreach ($line in @($s.text -split "`n" | Select-Object -Last 6)) { Say ('  ' + $line) }; return $false }
    Say ('   {0}: αποθηκεύτηκε (δεν φαίνεται ποτέ ξανά)' -f $Name) 'Green'
    return $true
}

Say '4. Τα κλειδιά των δικτύων.'
foreach ($c in $chosen) {
    $n = $Networks[$c]
    $allSet = (@($n.Secrets | Where-Object { $names -notcontains $_ }).Count -eq 0)
    if ($allSet -and $KeepSecrets) { Say ('   {0}: τα κλειδιά υπάρχουν ήδη, τα κρατάω (-KeepSecrets).' -f $n.Label); continue }
    Say ''
    Say ('   {0} ({1})' -f $n.Label, $n.Page) 'Cyan'

    if ($c -eq 'cj') {
        $tok = Read-Key 'CJ_TOKEN' 'Κλειδί CJ (Personal Access Token). Σκέτο Enter = το κλειδί του CJ που είναι ήδη σε αυτόν τον υπολογιστή'
        if (-not $tok) {
            $tok = ([string](Read-DpapiText (Join-Path $SecretsDir 'cj-token.dat'))).Trim()
            if ($tok) { $script:Secrets.Add($tok); Say '   Χρησιμοποιώ το κλειδί του CJ που είναι ήδη σε αυτόν τον υπολογιστή (cj-feed-download).' }
        }
        if (-not $tok) { if ($names -contains 'CJ_TOKEN') { Say '   Δεν δόθηκε νέο κλειδί: κρατάω το υπάρχον.'; continue }; Say '   Δεν δόθηκε κλειδί: το CJ μένει όπως ήταν.' 'Yellow'; $failed.Add('CJ'); continue }
        if ($tok -notmatch '^[A-Za-z0-9._~+/=-]{10,400}$') { Say '   Αυτό δεν μοιάζει με κλειδί του CJ. Δεν το αποθήκευσα.' 'Red'; $failed.Add('CJ'); continue }
        $okKey = $false
        if ($env:GW_TEST_NS_API) { $okKey = ($env:GW_TEST_NS_API -eq 'ok') } else {
            $env:GW_NS_CJ_TOKEN = $tok
            try { $R = Invoke-NodeJson 'network-sales.mjs' @('--mode', 'cj-test', '--cid', $CjCid) } finally { Clear-NsEnv }
            if ($R) {
                $okKey = [bool]$R.ok
                foreach ($x in @($R.cids)) { if ($x.ok) { Say ('   CJ λογαριασμός {0}: {1} πωλήσεις τις τελευταίες 30 μέρες' -f $x.cid, $x.count) } else { Say ('   CJ λογαριασμός {0}: {1}' -f $x.cid, $x.error) } }
                if ($R.error) { Say ('   CJ: {0}' -f $R.error) }
            }
        }
        if (-not $okKey) { Say '   Το CJ ΔΕΝ δέχτηκε το κλειδί (μία δοκιμή μόνο ανάγνωσης). Δεν το αποθήκευσα.' 'Red'; $failed.Add('CJ'); continue }
        if (-not (Put-Key 'CJ_TOKEN' $tok)) { $failed.Add('CJ') }
        $tok = ''
        continue
    }

    if ($c -eq 'daisycon') {
        # The app's keys: the ones already kept on this PC by daisycon-feed-download, or typed now.
        $client = ''; $secret = ''
        if (-not $SecretEnvPrefix) {
            $saved = Read-DpapiText (Join-Path $SecretsDir 'daisycon-oauth.dat')
            if ($saved) { try { $o = $saved | ConvertFrom-Json; $client = [string]$o.client; $secret = [string]$o.secret } catch { } }
            if ($secret) { $script:Secrets.Add($secret) }
            if ($client) { Say '   Χρησιμοποιώ την εφαρμογή (app) του Daisycon που είναι ήδη σε αυτόν τον υπολογιστή (daisycon-feed-download).' }
        }
        if (-not $client) {
            Write-Host 'Τα στοιχεία της εφαρμογής (app) σου στο Daisycon: Tools -> Daisycon API (redirect URI https://login.daisycon.com/oauth/cli).' -ForegroundColor Yellow
            $client = Read-Key 'DAISYCON_CLIENT_ID' 'Daisycon Client ID (δεν φαίνεται όσο το επικολλάς)'
            $secret = Read-Key 'DAISYCON_CLIENT_SECRET' 'Daisycon Client secret (σκέτο Enter αν δεν έχει)'
        }
        if ($client -notmatch '^[A-Za-z0-9._-]{4,100}$') { Say '   Δεν δόθηκε σωστό Client ID. Το Daisycon μένει όπως ήταν.' 'Red'; $failed.Add('Daisycon'); continue }
        # The sign-in for the Worker: its own, so the PC's own Daisycon sign-in is not used up.
        $seed = ''
        if ($SecretEnvPrefix) {
            $seed = Read-Key 'DAISYCON_REFRESH_SEED' 'seed'
        } else {
            $U = Invoke-NodeJson 'daisycon-feed.mjs' @('--mode', 'auth-url', '--client', $client)
            if ($null -eq $U -or -not $U.ok) { Say '   Δεν έγινε η διεύθυνση σύνδεσης του Daisycon.' 'Red'; $failed.Add('Daisycon'); continue }
            $script:Secrets.Add([string]$U.verifier)
            Write-Host ''
            Write-Host 'Ανοίγω τη σελίδα του Daisycon στον browser. Συνδέσου, πάτα Authorize/Allow, και αντέγραψε τον κωδικό (code) που θα δεις.' -ForegroundColor Yellow
            Write-Host ([string]$U.url)
            try { Start-Process ([string]$U.url) } catch { Write-Host 'Δεν άνοιξε μόνος του: αντέγραψε την παραπάνω διεύθυνση στον browser.' -ForegroundColor Yellow }
            $code = Read-Key 'DAISYCON_CODE' 'Κωδικός (code) από τη σελίδα του Daisycon (δεν φαίνεται όσο τον επικολλάς)'
            if (-not $code) { Say '   Δεν δόθηκε κωδικός. Το Daisycon μένει όπως ήταν.' 'Yellow'; $failed.Add('Daisycon'); continue }
            $env:GW_DC_CLIENT = $client; $env:GW_DC_SECRET = $secret; $env:GW_DC_CODE = $code; $env:GW_DC_VERIFIER = [string]$U.verifier
            try { $T = Invoke-NodeJson 'daisycon-feed.mjs' @('--mode', 'auth-token') } finally { Clear-NsEnv }
            if ($null -eq $T -or -not $T.ok -or -not $T.refresh) {
                $why = ''; if ($T) { $why = [string]$T.error }
                Say ('   Η σύνδεση με το Daisycon δεν έγινε: {0}. Το Daisycon μένει όπως ήταν.' -f $why) 'Red'; $failed.Add('Daisycon'); continue
            }
            $seed = [string]$T.refresh
            $script:Secrets.Add($seed)
        }
        if (-not $seed) { Say '   Δεν έγινε σύνδεση με το Daisycon. Το Daisycon μένει όπως ήταν.' 'Red'; $failed.Add('Daisycon'); continue }
        Say '   Σύνδεση με το Daisycon: 🟢 ΕΝΤΑΞΕΙ' 'Green'
        $okAll = Put-Key 'DAISYCON_CLIENT_ID' $client
        if ($okAll -and $secret) { $okAll = Put-Key 'DAISYCON_CLIENT_SECRET' $secret }
        # The encryption key of the kept sign-in: made once, here, from 32 random bytes; never replaced (the kept sign-in
        # would become unreadable), never shown.
        if ($okAll -and ($names -notcontains 'NETWORK_SYNC_KEY')) {
            $bytes = New-Object byte[] 32
            $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
            try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
            $key = [Convert]::ToBase64String($bytes)
            $script:Secrets.Add($key)
            $okAll = Put-Key 'NETWORK_SYNC_KEY' $key
            $key = ''
        }
        # The sign-in last: the Worker never sees a sign-in without its encryption key.
        if ($okAll) { $okAll = Put-Key 'DAISYCON_REFRESH_SEED' $seed }
        $seed = ''; $secret = ''
        if (-not $okAll) { $failed.Add('Daisycon') }
        continue
    }

    if ($c -eq 'linkwise') {
        Write-Host 'Το όνομα χρήστη και ο κωδικός του API του Linkwise: στο https://affiliate.linkwi.se/ (μενού API / Εργαλεία).' -ForegroundColor Yellow
        $u = Read-Key 'LINKWISE_API_USER' 'Linkwise API: όνομα χρήστη (δεν φαίνεται όσο το γράφεις)'
        $p = Read-Key 'LINKWISE_API_PASSWORD' 'Linkwise API: κωδικός (δεν φαίνεται όσο τον γράφεις)'
        if (-not $u -or -not $p) { if (($names -contains 'LINKWISE_API_USER') -and ($names -contains 'LINKWISE_API_PASSWORD')) { Say '   Δεν δόθηκαν νέα: κρατάω τα υπάρχοντα.'; continue }; Say '   Δεν δόθηκαν όνομα και κωδικός: το Linkwise μένει όπως ήταν.' 'Yellow'; $failed.Add('Linkwise'); continue }
        $okKey = $false
        if ($env:GW_TEST_NS_API) { $okKey = ($env:GW_TEST_NS_API -eq 'ok') } else {
            $env:GW_NS_LW_USER = $u; $env:GW_NS_LW_PASS = $p
            try { $R = Invoke-NodeJson 'network-sales.mjs' @('--mode', 'linkwise-probe') } finally { Clear-NsEnv }
            if ($R) { $okKey = [bool]$R.ok -and -not [bool]$R.refused }
        }
        if (-not $okKey) { Say '   Το Linkwise ΔΕΝ δέχτηκε το όνομα/κωδικό του API (μία δοκιμή μόνο ανάγνωσης). Δεν τα αποθήκευσα.' 'Red'; $failed.Add('Linkwise'); continue }
        $okAll = Put-Key 'LINKWISE_API_USER' $u
        if ($okAll) { $okAll = Put-Key 'LINKWISE_API_PASSWORD' $p }
        $u = ''; $p = ''
        if (-not $okAll) { $failed.Add('Linkwise') }
        Say '   Linkwise: ο συγχρονισμός του περιμένει ακόμα το βήμα probe (μόνο ανάγνωση) για τις παραμέτρους της αναφοράς.' 'Yellow'
        continue
    }
}

# 5. checks
$after = Get-SecretNames $deploy
if ($null -eq $after) { $after = @() }
$workerOk = ((Get-WorkerState $deploy) -eq 'yes')
Say ''
Say 'Κλειδιά του Worker τώρα (μόνο ονόματα):'
foreach ($k in $Networks.Keys) {
    $n = $Networks[$k]
    $miss = @($n.Secrets | Where-Object { $after -notcontains $_ })
    if ($miss.Count -eq 0) { Say ('  {0}: 🟢 όλα υπάρχουν' -f $n.Label) } else { Say ('  {0}: λείπουν {1}' -f $n.Label, ($miss -join ', ')) }
}
Show-Syncs $nsDir
Say ''
Say 'Αν θελήσεις να το αναιρέσεις (μόνο με έγκριση· τα sites και ο συγχρονισμός του Awin δεν επηρεάζονται):'
Say ('  npx wrangler delete --name {0}' -f $WorkerName)
Say ('  npx wrangler d1 execute {0} --remote --command "{1}"' -f $DbName, $undoSql)
Say ('  ή όλη η βάση όπως ήταν: npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $DbName, $bm.Value)
Say ('  (όλα γραμμένα και στο {0})' -f (Join-Path $bdir 'rollback.txt'))
Say '  Τα κλειδιά ακυρώνονται και στα ίδια τα δίκτυα: CJ https://developers.cj.com/account/personal-access-tokens'
Say ''
if (-not $workerOk) { Say 'Αποτέλεσμα: 🔴 ΠΡΟΒΛΗΜΑ: ο Worker δεν βρέθηκε στον τελικό έλεγχο. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 9 }
if ($failed.Count -gt 0) {
    Say ('Αποτέλεσμα: 🔴 ΠΡΟΒΛΗΜΑ με: {0}. Τα υπόλοιπα είναι έτοιμα· ξανατρέξε με -Only για αυτά. Στείλε στο Claude την αναφορά.' -f (($failed | Select-Object -Unique) -join ', ')) 'Red'
    Finish 8
}
Say 'Αποτέλεσμα: 🟢 ΕΤΟΙΜΟ. Ο πρώτος συγχρονισμός γίνεται στο επόμενο :47 μιας ζυγής ώρας (π.χ. 14:47, 16:47).' 'Green'
Finish 0
