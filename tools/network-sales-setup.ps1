<#
.SYNOPSIS
  Sales of CJ, Daisycon and Linkwise in the private dashboard, next to the Awin sales (lessons L197): a private Worker
  copies them every 2 hours into the Awin sales database (NEW tables only). Read-only unless -Apply and the typed
  approval phrase.

.DESCRIPTION
  -Step check   READ-ONLY (default). Cloudflare login; the database gear-world-awin (made by awin-setup) and its new
                tables; the Worker gear-world-network-sync, the code version it runs, and which of its keys are set
                (NAMES only, never a value); the last sync of each network and the sales saved. Shows the plan and
                where each key is made.
  -Step apply   CHANGES CLOUDFLARE ONLY (no site, no site database, the Awin sync stays as it is), one approval:
                ΕΓΚΡΙΝΩ ΠΩΛΗΣΕΙΣ ΔΙΚΤΥΩΝ. First the live-version guard (L156): a Worker that runs a code version this
                one does not contain is never replaced (exit 13). Then, in this order:
                  1. backup: a Time Travel restore point of gear-world-awin and a dated copy (export) on this PC;
                  2. the new tables (migrations 0002 and 0003); the Awin tables do not change;
                  3. the private Worker gear-world-network-sync (no public address, a cron every 2 hours at :47),
                     deployed with --var GW_COMMIT:<this version>, which is also written to network_sync_meta;
                  4. the keys of the chosen networks (-Only), each typed at a hidden prompt, first tested with one
                     read-only call to that network, and handed to wrangler through its input only: never shown,
                     written to a file or put in the report. Enter at a key prompt = that network is skipped
                     (ΠΑΡΑΛΕΙΦΘΗΚΕ), or keeps its keys when it has them all. Daisycon: the Worker's OWN app and a
                     sign-in in the browser (its keys work once and last 30 days; the Worker keeps the newest one
                     encrypted).
                The report says how to undo exactly what this run made.
  -Step keys    CHANGES WORKER SECRETS ONLY, one approval: ΕΓΚΡΙΝΩ ΚΛΕΙΔΙΑ ΔΙΚΤΥΩΝ. Step 4 of apply alone, for the
                networks in -Only: no migration, no deploy. Needs the Worker and the tables (an apply first).
  -Step probe   READ-ONLY, Linkwise only. With the Linkwise API login typed at the prompt (not stored by this step), one
                call to reports_transaction.json and one to programs.json, without parameters; the report gets ONLY the
                parameter names, field names and messages, never a value (TODO(linkwise) in src/networks/linkwise.js).
  -Only cj | daisycon | linkwise (or a list 'cj,daisycon'): which networks' keys to set or check. Default: cj,daisycon
                (Linkwise only when asked: its sync waits for the probe).
  Report: <home>\gear-world-reports\NETWORK_SALES_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'apply', 'keys', 'probe')]
    [string]$Step = 'check',
    [string]$Only = 'cj,daisycon',
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
$PhraseKeys = 'ΕΓΚΡΙΝΩ ΚΛΕΙΔΙΑ ΔΙΚΤΥΩΝ'
$DbName = 'gear-world-awin'
$WorkerName = 'gear-world-network-sync'
# The first version with this Worker: a Worker that does not say its version yet must be at least this one (L156).
$NsGuardFloor = 'b2b10661d3270ac41f12c37cc4fb6c385b322c80'
$DaisyconAppPage = 'https://login.daisycon.com/'
$DaisyconRedirect = 'https://login.daisycon.com/oauth/cli'
if (-not $PcHome) { $PcHome = $HOME }
if (-not $WorkDir) { $WorkDir = Join-Path $PcHome 'gear-world-network-sales' }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
$SecretsDir = Join-Path $PcHome 'gear-world-secrets'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$script:Secrets = New-Object System.Collections.Generic.List[string]

# The networks and their Worker secrets (src/networks/*.js). A new network: one entry here and one file there.
$Networks = [ordered]@{
    cj       = @{ Label = 'CJ'; Secrets = @('CJ_TOKEN'); Optional = @(); Page = 'https://developers.cj.com/account/personal-access-tokens' }
    daisycon = @{ Label = 'Daisycon'; Secrets = @('DAISYCON_CLIENT_ID', 'DAISYCON_REFRESH_SEED', 'NETWORK_SYNC_KEY'); Optional = @('DAISYCON_CLIENT_SECRET'); Page = 'https://login.daisycon.com/ (Tools -> Daisycon API, own app for the Worker)' }
    linkwise = @{ Label = 'Linkwise'; Secrets = @('LINKWISE_API_USER', 'LINKWISE_API_PASSWORD'); Optional = @(); Page = 'https://affiliate.linkwi.se/ (API)' }
}
$NewTables = @('network_transactions', 'network_sync_runs', 'network_oauth', 'all_network_sales', 'network_sync_meta')

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

# The live-version guard of the site tools (lessons L156): Get-GwCommit, Get-GwVersionVar, Test-GwContains.
. (Join-Path (Join-Path (Join-Path $repo 'tools') 'lib') 'live-guard.ps1')

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
        # ok: 1 = good, 2 = held (built but waiting, e.g. Linkwise; never a problem), 0 = failed (migration 0003).
        $state = '🔴 ΠΡΟΒΛΗΜΑ'
        if ([int]$x.ok -eq 1) { $state = '🟢 ΕΝΤΑΞΕΙ' } elseif ([int]$x.ok -eq 2) { $state = '⏸ ΣΕ ΑΝΑΜΟΝΗ' }
        Say ('  {0}: {1}  {2}  κλήσεις {3}, πωλήσεις που ήρθαν {4}, αποθηκεύτηκαν {5}  {6}' -f $x.network, $x.ran_at, $state, $x.calls, $x.fetched, $x.saved, [string]$x.message)
    }
    $tot = Select-Db $folder 'SELECT network, COUNT(*) AS n, ROUND(SUM(commission_amount), 2) AS c, MAX(currency) AS cur, MAX(sale_date) AS last FROM network_transactions GROUP BY network ORDER BY network'
    if ($null -ne $tot) {
        foreach ($x in $tot) { Say ('  Πωλήσεις {0} στη βάση: {1}, προμήθεια {2} {3}, τελευταία {4}' -f $x.network, $x.n, $x.c, $x.cur, $x.last) }
    }
}

# The new tables that exist now (names), or $null when they could not be read.
function Get-NewTables([string]$folder) {
    $have = Select-Db $folder ("SELECT name FROM sqlite_master WHERE name IN ('{0}')" -f ($NewTables -join "', '"))
    if ($null -eq $have) { return $null }
    return , @($have | ForEach-Object { [string]$_.name })
}

# The code version the Worker runs (network_sync_meta 'commit'): @{ ok; commit } ('' = it does not say yet).
function Get-DeployedCommit([string]$folder, [string[]]$tables) {
    if ($tables -notcontains 'network_sync_meta') { return @{ ok = $true; commit = '' } }
    $r = Select-Db $folder "SELECT value FROM network_sync_meta WHERE key = 'commit'"
    if ($null -eq $r) { return @{ ok = $false; commit = '' } }
    $c = ''
    if ($r.Count -gt 0) { $c = [string]$r[0].value }
    if ($c -and $c -notmatch '^[0-9a-f]{40}$') { return @{ ok = $false; commit = '' } }
    return @{ ok = $true; commit = $c }
}

function Test-Yes([string]$s) {
    $t = Normalize-Phrase $s
    return (@('ΝΑΙ', 'NAI', 'YES', 'Y') -contains $t)
}

# The undo of exactly what this run made: the Worker or the tables when this run created them, else the keys it set.
# Printed on screen and in the report, and written to rollback.txt of the backup folder.
function Write-Undo {
    $lines = New-Object System.Collections.Generic.List[string]
    if ($script:CreatedWorker) {
        $lines.Add(('  Ο Worker (φτιάχτηκε τώρα, μαζί και τα κλειδιά του):  npx wrangler delete --name {0}' -f $WorkerName))
    } else {
        if ($script:MaybeCreatedWorker) {
            $lines.Add(('  Ο Worker, ΜΟΝΟ αν δεν υπήρχε πριν (ο έλεγχος δεν μπόρεσε να το διαβάσει):  npx wrangler delete --name {0}' -f $WorkerName))
        }
        foreach ($k in $script:SetKeys) { $lines.Add(('  Το κλειδί {0}:  npx wrangler secret delete {0} --name {1}' -f $k, $WorkerName)) }
        if ($script:Deployed -and $script:PrevCommit) {
            $lines.Add(('  Ο Worker υπήρχε ήδη (έκδοση {0}): για τον προηγούμενο κώδικα, το ίδιο apply από την έκδοση {0} (μόνο με έγκριση).' -f (Get-GwShort $script:PrevCommit)))
        }
    }
    $made = @($script:CreatedTables)
    if ($made.Count -gt 0) {
        $sql = New-Object System.Collections.Generic.List[string]
        foreach ($t in @('all_network_sales', 'network_oauth', 'network_sync_runs', 'network_transactions', 'network_sync_meta')) {
            if ($made -contains $t) {
                if ($t -eq 'all_network_sales') { $sql.Add('DROP VIEW IF EXISTS all_network_sales') } else { $sql.Add(('DROP TABLE IF EXISTS {0}' -f $t)) }
            }
        }
        $migs = New-Object System.Collections.Generic.List[string]
        if (@($made | Where-Object { $_ -ne 'network_sync_meta' }).Count -gt 0) { $migs.Add("'0002_network_sales.sql'") }
        if ($made -contains 'network_sync_meta') {
            $migs.Add("'0003_network_sync_meta.sql'")
            if ($made -notcontains 'network_sync_runs') { $sql.Add('ALTER TABLE network_sync_runs DROP COLUMN state') }
        }
        $sql.Add(('DELETE FROM d1_migrations WHERE name IN ({0})' -f ($migs -join ', ')))
        $lines.Add(('  Οι πίνακες που φτιάχτηκαν τώρα:  npx wrangler d1 execute {0} --remote --command "{1}"' -f $DbName, ($sql -join '; ')))
    }
    if ($script:Bookmark) {
        $lines.Add(('  Ή όλη η βάση όπως ήταν πριν:  npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $DbName, $script:Bookmark))
        $lines.Add('    Μετά από αυτή την επαναφορά το Daisycon θέλει νέα σύνδεση: -Only daisycon (η φυλαγμένη σύνδεση γυρίζει σε μία που έχει ήδη χρησιμοποιηθεί).')
        $lines.Add('    Η επαναφορά γυρίζει πίσω και το ιστορικό του Awin (awin_sync_runs)· οι πωλήσεις του Awin ξαναγεμίζουν από την ανάγνωση των 90 ημερών του επόμενου συγχρονισμού.')
    }
    Say ''
    if ($lines.Count -eq 0) { Say 'Αναίρεση: αυτή η εκτέλεση δεν άλλαξε τίποτα.'; return }
    Say 'Αν θελήσεις να το αναιρέσεις (μόνο με έγκριση· τα sites και ο συγχρονισμός του Awin δεν επηρεάζονται):'
    # Never a loop variable named l: PowerShell names are case-blind and dynamically scoped, so Say would take it for its report list.
    foreach ($undoLine in $lines) { Say $undoLine }
    Say ('  Τα κλειδιά ακυρώνονται και στα ίδια τα δίκτυα: CJ https://developers.cj.com/account/personal-access-tokens · Daisycon {0}' -f $DaisyconAppPage)
    if ($script:BackupDir) {
        $text = @(('Gear World - network sales (CJ, Daisycon, Linkwise), {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')), 'To undo (only with approval):') + @($lines) + @(('copy of the database before the change: {0}' -f $script:Dump))
        [System.IO.File]::WriteAllText((Join-Path $script:BackupDir 'rollback.txt'), ($text -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
        Say ('  (όλα γραμμένα και στο {0})' -f (Join-Path $script:BackupDir 'rollback.txt'))
    }
}

# What this run made, for Write-Undo.
$script:CreatedWorker = $false
$script:MaybeCreatedWorker = $false
$script:CreatedTables = @()
$script:SetKeys = New-Object System.Collections.Generic.List[string]
$script:Deployed = $false
$script:PrevCommit = ''
$script:Bookmark = ''
$script:BackupDir = ''
$script:Dump = ''

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply -and ($Step -eq 'apply' -or $Step -eq 'keys')) { $mode = 'APPLY (με έγκριση)' }
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
if ($worker -ne 'no') {
    $names = Get-SecretNames $deploy
    # The deployment list gave no clear answer: the key list says "does not exist" (code 10007) for a missing Worker,
    # so the guard and the undo know this run is the one that makes it.
    if ($worker -eq 'unknown' -and $null -ne $names -and @($names) -contains 'missing') { $worker = 'no' }
}

Say ''
Say 'Τι υπάρχει τώρα:'
Say ('  Βάση {0}: υπάρχει (εκεί είναι και οι πωλήσεις του Awin)' -f $DbName)
$haveNames = Get-NewTables $nsDir
if ($null -eq $haveNames) { Say '  Νέοι πίνακες: δεν διαβάστηκαν. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 5 }
$missingTables = @($NewTables | Where-Object { $haveNames -notcontains $_ })
if ($missingTables.Count -eq 0) { Say '  Νέοι πίνακες: υπάρχουν όλοι' } else { Say ('  Νέοι πίνακες που λείπουν (θα φτιαχτούν): {0}' -f ($missingTables -join ', ')) }
if ($worker -eq 'yes') { Say ('  Worker {0}: υπάρχει' -f $WorkerName) } elseif ($worker -eq 'no') { Say ('  Worker {0}: δεν υπάρχει ακόμα (θα ανέβει)' -f $WorkerName) } else { Say ('  Worker {0}: δεν διαβάστηκε' -f $WorkerName) 'Yellow' }
$dep = Get-DeployedCommit $nsDir $haveNames
$script:PrevCommit = $dep.commit
if ($worker -eq 'yes') {
    if (-not $dep.ok) { Say '  Έκδοση κώδικα του Worker: δεν διαβάστηκε' 'Yellow' }
    elseif ($dep.commit) { Say ('  Έκδοση κώδικα του Worker: {0}' -f (Get-GwShort $dep.commit)) }
    else { Say '  Έκδοση κώδικα του Worker: δεν τη γράφει ακόμα (παλιότερο ανέβασμα)' }
}
$thisCommit = Get-GwCommit $repo
if ($thisCommit) { Say ('  Αυτή η έκδοση κώδικα: {0}' -f (Get-GwShort $thisCommit)) }
if ($null -eq $names) { Say '  Κλειδιά του Worker: δεν διαβάστηκαν' 'Yellow' }
foreach ($k in $Networks.Keys) {
    $n = $Networks[$k]
    $set = @($n.Secrets | Where-Object { @($names) -contains $_ })
    $miss = @($n.Secrets | Where-Object { @($names) -notcontains $_ })
    $state = 'δεν έχει στηθεί'
    if ($miss.Count -eq 0) { $state = 'όλα τα κλειδιά υπάρχουν' } elseif ($set.Count -gt 0) { $state = ('λείπουν: {0}' -f ($miss -join ', ')) }
    Say ('  {0}: {1}' -f $n.Label, $state)
}
if ($missingTables.Count -lt $NewTables.Count) { Show-Syncs $nsDir }

if ($Step -eq 'check') {
    Say ''
    Say ('Πλάνο του apply (φράση: {0}):' -f $Phrase)
    Say '  0. έλεγχος έκδοσης (L156): ένας Worker με έκδοση που αυτή εδώ δεν έχει μέσα ΔΕΝ αντικαθίσταται'
    Say ('  1. backup: σημείο επαναφοράς (Time Travel) της βάσης {0} και αντίγραφό της σε αρχείο σε αυτόν τον υπολογιστή' -f $DbName)
    Say '  2. οι νέοι πίνακες (μόνο αν λείπουν). Οι πίνακες του Awin δεν αλλάζουν'
    Say ('  3. ο ιδιωτικός Worker {0}: χωρίς δημόσια διεύθυνση, κάθε 2 ώρες στο :47' -f $WorkerName)
    Say '  4. τα κλειδιά, μόνο για τα δίκτυα που διάλεξες (θα σου ζητηθούν, δεν φαίνονται, δεν γράφονται πουθενά· σκέτο Enter = παράλειψη):'
    foreach ($c in $chosen) {
        $n = $Networks[$c]
        Say ('     {0}: {1}  - από {2}' -f $n.Label, (($n.Secrets + $n.Optional) -join ', '), $n.Page)
    }
    if ($chosen -contains 'daisycon') { Say ('     Daisycon: ο Worker θέλει ΔΙΚΗ ΤΟΥ εφαρμογή (app) στο {0}, Tools -> Daisycon API, με Redirect URI {1}' -f $DaisyconAppPage, $DaisyconRedirect) }
    if ($chosen -contains 'linkwise') { Say '     Linkwise: τα κλειδιά φυλάγονται, αλλά ο συγχρονισμός του μένει ⏸ ΣΕ ΑΝΑΜΟΝΗ ώσπου το βήμα probe (μόνο ανάγνωση) δείξει τις παραμέτρους.' }
    else { Say '     Linkwise: μόνο αν το ζητήσεις (-Only linkwise).' }
    Say ('  Μόνο κλειδιά, χωρίς πίνακες και ανέβασμα: -Step keys (φράση: {0}).' -f $PhraseKeys)
    Say '  Τα sites και οι βάσεις τους δεν αλλάζουν.'
    Say ''
    Say 'Αποτέλεσμα: 🟢 ΕΝΤΑΞΕΙ (μόνο έλεγχος, δεν άλλαξε τίποτα)' 'Green'
    Finish 0
}

# ================= keys (secrets only) =================
if ($Step -eq 'keys') {
    if ($worker -ne 'yes' -or $missingTables.Count -gt 0) { Say ''; Say 'Το βήμα keys χρειάζεται τον Worker και τους πίνακες: πρώτα το apply. Δεν άλλαξε τίποτα.' 'Red'; Finish 7 }
    if (-not $Apply) { Say ''; Say ('Χωρίς -Apply δεν αλλάζει τίποτα. Για τα κλειδιά: -Step keys -Apply και η φράση {0}' -f $PhraseKeys) 'Yellow'; Finish 0 }
    if (-not (Confirm-Approval $PhraseKeys)) { Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
    Say ''
    Say 'Έγκριση: 🟢 ΕΝΤΑΞΕΙ. Αλλάζουν μόνο κλειδιά του Worker: ούτε πίνακες, ούτε ανέβασμα κώδικα.' 'Green'
}

# ================= apply =================
if ($Step -eq 'apply') {
    if (-not $Apply) {
        Say ''
        Say ('Χωρίς -Apply δεν αλλάζει τίποτα. Για την εγκατάσταση: -Step apply -Apply και η φράση {0}' -f $Phrase) 'Yellow'
        Finish 0
    }
    # 0. the live-version guard (L156), before anything is asked or changed
    Say ''
    Say 'Έλεγχος έκδοσης (L156): έχει αυτή η έκδοση μέσα όποια τρέχει τώρα ο Worker;'
    if ($thisCommit -notmatch '^[0-9a-f]{40}$') {
        Say '  ΣΤΟΠ: δεν ξέρω ποια έκδοση κώδικα ανεβαίνει (ο φάκελος δεν έχει commit). Η εντολή τρέχει μόνο μέσω gw-run.ps1 με -Ref.' 'Magenta'
        Say 'ΣΤΑΜΑΤΗΣΑ ΧΩΡΙΣ ΑΛΛΑΓΕΣ. Στείλε αυτή την αναφορά στο Claude «1 · Gear World Manager».' 'Magenta'
        Finish 13
    }
    if ($worker -ne 'no') {
        if (-not $dep.ok) { Say '  ΣΤΟΠ: δεν διάβασα ποια έκδοση τρέχει ο Worker. Για ασφάλεια δεν ανεβαίνει τίποτα· ξαναδοκίμασε σε λίγα λεπτά.' 'Magenta'; Say 'ΣΤΑΜΑΤΗΣΑ ΧΩΡΙΣ ΑΛΛΑΓΕΣ.' 'Magenta'; Finish 13 }
        $base = $dep.commit
        $what = 'την έκδοση του Worker'
        if (-not $base) { $base = $NsGuardFloor; $what = 'την πρώτη έκδοση του Worker (δεν γράφει ακόμα τη δική του)' }
        $cmp = Test-GwContains $base $thisCommit
        if (-not $cmp.ok) { Say ('  ΣΤΟΠ: το GitHub δεν απάντησε αν η νέα έκδοση έχει μέσα {0} {1} ({2}). Ξαναδοκίμασε σε λίγα λεπτά.' -f $what, (Get-GwShort $base), $cmp.status) 'Magenta'; Say 'ΣΤΑΜΑΤΗΣΑ ΧΩΡΙΣ ΑΛΛΑΓΕΣ.' 'Magenta'; Finish 13 }
        if (-not $cmp.contains) {
            Say ('  ΣΤΟΠ: η έκδοση {0} ΔΕΝ έχει μέσα {1} {2} (GitHub: {3}). Θα έσβηνε κώδικα που τρέχει τώρα.' -f (Get-GwShort $thisCommit), $what, (Get-GwShort $base), $cmp.status) 'Magenta'
            Say 'ΣΤΑΜΑΤΗΣΑ ΧΩΡΙΣ ΑΛΛΑΓΕΣ. Χρειάζεται μια έκδοση που έχει μέσα και αυτή που τρέχει. Στείλε αυτή την αναφορά στο Claude «1 · Gear World Manager».' 'Magenta'
            Finish 13
        }
        Say ('  ΕΝΤΑΞΕΙ: η έκδοση {0} έχει μέσα {1} {2}.' -f (Get-GwShort $thisCommit), $what, (Get-GwShort $base))
    } else {
        Say '  ΕΝΤΑΞΕΙ: δεν υπάρχει ακόμα Worker, οπότε δεν χάνεται τίποτα.'
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
    $script:Bookmark = $bm.Value
    $script:BackupDir = $bdir
    $script:Dump = $dump
    [System.IO.File]::WriteAllText((Join-Path $bdir 'rollback.txt'), (('Restore point before the change (only with approval): npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $DbName, $bm.Value) + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
    Say ('1. Backup: σημείο επαναφοράς και αντίγραφο σε αρχείο: 🟢 ΕΝΤΑΞΕΙ ({0})' -f $bdir) 'Green'

    # 2. the new tables
    Copy-Item -LiteralPath $config -Destination (Join-Path $WorkDir 'wrangler.jsonc') -Force
    $m = Invoke-Wrangler $nsDir ('d1 migrations apply {0} --remote' -f $DbName) -Retry
    $tablesAfter = Get-NewTables $nsDir
    if ($null -ne $tablesAfter) { $script:CreatedTables = @($NewTables | Where-Object { ($tablesAfter -contains $_) -and ($haveNames -notcontains $_) }) }
    if ($m.code -ne 0) { Say '2. Οι νέοι πίνακες δεν φτιάχτηκαν. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($m.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }; Write-Undo; Finish 6 }
    Say '2. Νέοι πίνακες: 🟢 ΕΝΤΑΞΕΙ (του Awin δεν άλλαξαν)' 'Green'

    # 3. the Worker, with the code version it runs
    Say ('3. Ανεβάζω τον ιδιωτικό Worker {0} (έκδοση {1})...' -f $WorkerName, (Get-GwShort $thisCommit))
    $deployArgs = ('deploy --config "{0}"{1}' -f $config, (Get-GwVersionVar $repo))
    $d = Invoke-Wrangler $nsDir $deployArgs
    if ($d.code -ne 0 -and $d.text -match 'code: 10007') {
        Say 'Το Cloudflare δεν απάντησε σωστά στο ανέβασμα. Ξαναδοκιμάζω σε 15 δευτερόλεπτα...' 'Yellow'
        Start-Sleep -Seconds 15
        $d = Invoke-Wrangler $nsDir $deployArgs
    }
    if ($d.code -ne 0) { Say '   Ο Worker δεν ανέβηκε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($d.text -split "`n" | Select-Object -Last 12)) { Say ('  ' + $line) }; Write-Undo; Finish 7 }
    $script:Deployed = $true
    if ($worker -eq 'no') { $script:CreatedWorker = $true } elseif ($worker -ne 'yes') { $script:MaybeCreatedWorker = $true }
    Say '   Worker: 🟢 ΕΝΤΑΞΕΙ (χωρίς δημόσια διεύθυνση, κάθε 2 ώρες στο :47)' 'Green'
    # The version, readable at once (the Worker also writes it at every run).
    $metaSql = "INSERT INTO network_sync_meta (key, value, updated_at) VALUES ('commit', '{0}', '{1}') ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at" -f $thisCommit, ((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))
    $mw = Invoke-Wrangler $nsDir ('d1 execute {0} --remote --command "{1}"' -f $DbName, $metaSql) -Retry
    if ($mw.code -ne 0) { Say '   Η έκδοση δεν γράφτηκε στη βάση τώρα· ο Worker τη γράφει μόνος του στον πρώτο συγχρονισμό.' 'Yellow' }
}

# 4. the keys, network by network. A network whose key is refused is left as it was; the others go on.
# If the Worker's key names cannot be read, NO key is touched: a new NETWORK_SYNC_KEY over an existing one would make the
# kept Daisycon sign-in unreadable.
$names = Get-SecretNames $deploy
if ($null -eq $names -or @($names) -contains 'missing') {
    Say ''
    Say 'Δεν διάβασα ποια κλειδιά έχει ήδη ο Worker: για ασφάλεια ΔΕΝ αλλάζω κανένα κλειδί (ούτε τη σύνδεση του Daisycon). Ξανατρέξε σε λίγα λεπτά.' 'Red'
    Write-Undo
    Finish 14
}
$failed = New-Object System.Collections.Generic.List[string]
$skipped = New-Object System.Collections.Generic.List[string]
function Put-Key([string]$Name, [string]$Value) {
    $s = Set-WorkerSecret $deploy $Name $Value
    if ($s.code -ne 0) { Say ('   Το κλειδί {0} δεν αποθηκεύτηκε.' -f $Name) 'Red'; foreach ($line in @($s.text -split "`n" | Select-Object -Last 6)) { Say ('  ' + $line) }; return $false }
    $script:SetKeys.Add($Name)
    Say ('   {0}: αποθηκεύτηκε (δεν φαίνεται ποτέ ξανά)' -f $Name) 'Green'
    return $true
}
function Skip-Network([string]$Label, [bool]$Kept) {
    if ($Kept) { Say ('   {0}: ΠΑΡΑΛΕΙΦΘΗΚΕ (κρατήθηκαν τα κλειδιά που υπάρχουν)' -f $Label) } else { Say ('   {0}: ΠΑΡΑΛΕΙΦΘΗΚΕ (δεν δόθηκε κλειδί· τίποτα δεν άλλαξε)' -f $Label) }
    $script:skipped.Add($Label)
}

Say ''
Say '4. Τα κλειδιά των δικτύων (σκέτο Enter σε μια ερώτηση κλειδιού = παράλειψη του δικτύου).'
foreach ($c in $chosen) {
    $n = $Networks[$c]
    $allSet = (@($n.Secrets | Where-Object { @($names) -notcontains $_ }).Count -eq 0)
    if ($allSet -and $KeepSecrets) { Say ('   {0}: τα κλειδιά υπάρχουν ήδη, τα κρατάω (-KeepSecrets).' -f $n.Label); continue }
    Say ''
    Say ('   {0} ({1})' -f $n.Label, $n.Page) 'Cyan'

    if ($c -eq 'cj') {
        $tok = ''
        $pcTok = ''
        if (-not $SecretEnvPrefix) { $pcTok = ([string](Read-DpapiText (Join-Path $SecretsDir 'cj-token.dat'))).Trim() }
        if ($pcTok) {
            $script:Secrets.Add($pcTok)
            Write-Host 'Υπάρχει ήδη κλειδί του CJ σε αυτόν τον υπολογιστή (από το cj-feed-download).' -ForegroundColor Yellow
            try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
            if (Test-Yes (Read-Host 'Γράψε ΝΑΙ για να το χρησιμοποιήσω, ή σκέτο Enter για να επικολλήσεις άλλο')) { $tok = $pcTok; Say '   Χρησιμοποιώ το κλειδί του CJ αυτού του υπολογιστή.' }
        }
        if (-not $tok) {
            $hint = 'σκέτο Enter = παράλειψη του CJ'
            if ($allSet) { $hint = 'σκέτο Enter = κρατάω το υπάρχον' }
            $tok = Read-Key 'CJ_TOKEN' ('Κλειδί CJ (Personal Access Token, δεν φαίνεται όσο το επικολλάς· {0})' -f $hint)
        }
        if (-not $tok) { Skip-Network 'CJ' $allSet; continue }
        if ($tok -notmatch '^[A-Za-z0-9._~+/=-]{10,400}$') { Say '   Αυτό δεν μοιάζει με κλειδί του CJ. Δεν το αποθήκευσα.' 'Red'; $failed.Add('CJ'); continue }
        $verdict = 'none'
        if ($env:GW_TEST_NS_API) { $verdict = $env:GW_TEST_NS_API } else {
            $env:GW_NS_CJ_TOKEN = $tok
            try { $R = Invoke-NodeJson 'network-sales.mjs' @('--mode', 'cj-test', '--cid', $CjCid) } finally { Clear-NsEnv }
            if ($R) {
                foreach ($x in @($R.cids)) { if ($x.ok) { Say ('   CJ λογαριασμός {0}: {1} πωλήσεις τις τελευταίες 30 μέρες' -f $x.cid, $x.count) } else { Say ('   CJ λογαριασμός {0}: {1}' -f $x.cid, $x.error) } }
                if ($R.ok) { $verdict = 'ok' } elseif ($R.refused) { $verdict = 'refused' } elseif ($R.accountsRefused) { $verdict = 'accounts' } elseif ($R.queryError) { $verdict = 'query' }
                if ($R.error) { Say ('   CJ: {0}' -f $R.error) }
            }
        }
        if ($verdict -eq 'refused') { Say '   🔴 Το CJ ΔΕΝ δέχτηκε το κλειδί (401/403: λάθος, ληγμένο ή ακυρωμένο). Δεν το αποθήκευσα. Φτιάξε νέο στο https://developers.cj.com/account/personal-access-tokens' 'Red'; $failed.Add('CJ'); continue }
        if ($verdict -eq 'accounts') { Say ('   🔴 Το CJ αρνήθηκε αυτό το κλειδί για αυτούς τους λογαριασμούς (CID {0}: «Not authorized»): είναι κλειδί άλλου λογαριασμού ή λάθος αριθμός λογαριασμού. Δεν το αποθήκευσα.' -f $CjCid) 'Red'; $failed.Add('CJ'); continue }
        if ($verdict -eq 'query') { Say '   🔴 Το CJ δέχτηκε το κλειδί, αλλά η ερώτηση για τις πωλήσεις έχει λάθος (λάθος του κώδικα, όχι του κλειδιού). Δεν το αποθήκευσα· στείλε την αναφορά στο Claude.' 'Red'; $failed.Add('CJ'); continue }
        if ($verdict -ne 'ok') { Say '   🔴 Το CJ δεν απάντησε σωστά στη δοκιμή του κλειδιού (μία δοκιμή μόνο ανάγνωσης). Δεν το αποθήκευσα· ξαναδοκίμασε σε λίγο.' 'Red'; $failed.Add('CJ'); continue }
        if (-not (Put-Key 'CJ_TOKEN' $tok)) { $failed.Add('CJ') }
        $tok = ''
        continue
    }

    if ($c -eq 'daisycon') {
        Write-Host 'Ο Worker χρειάζεται ΔΙΚΗ ΤΟΥ εφαρμογή (app) στο Daisycon, ώστε η σύνδεσή του να μη χαλάει τη σύνδεση του υπολογιστή (daisycon-feed-download).' -ForegroundColor Yellow
        Write-Host ('Μία φορά: {0} -> Tools -> Daisycon API -> νέα εφαρμογή, με Redirect URI {1}. Μετά επικόλλησε εδώ το Client ID και το Client secret της.' -f $DaisyconAppPage, $DaisyconRedirect) -ForegroundColor Yellow
        $hint = 'σκέτο Enter = παράλειψη του Daisycon'
        if ($allSet) { $hint = 'σκέτο Enter = κρατάω την υπάρχουσα σύνδεση, χωρίς νέα σύνδεση' }
        $client = Read-Key 'DAISYCON_CLIENT_ID' ('Client ID της εφαρμογής του Worker (δεν φαίνεται όσο το επικολλάς· {0})' -f $hint)
        $secret = ''
        if (-not $client) {
            if ($allSet) { Skip-Network 'Daisycon' $true; continue }
            # Only as a fallback: the PC feed tool's app, with a warning.
            $pcClient = ''; $pcSecret = ''
            if (-not $SecretEnvPrefix) {
                $saved = Read-DpapiText (Join-Path $SecretsDir 'daisycon-oauth.dat')
                if ($saved) { try { $o = $saved | ConvertFrom-Json; $pcClient = [string]$o.client; $pcSecret = [string]$o.secret } catch { } }
                if ($pcSecret) { $script:Secrets.Add($pcSecret) }
            }
            if ($pcClient) {
                Write-Host 'Εναλλακτικά υπάρχει η εφαρμογή του υπολογιστή (daisycon-feed-download). Προσοχή: μια νέα σύνδεση της μίας μπορεί να χαλάσει την άλλη.' -ForegroundColor Yellow
                try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
                if (Test-Yes (Read-Host 'Γράψε ΝΑΙ για να χρησιμοποιήσω την εφαρμογή του υπολογιστή, ή σκέτο Enter για παράλειψη του Daisycon')) {
                    $client = $pcClient; $secret = $pcSecret
                    Say '   Χρησιμοποιώ την εφαρμογή του υπολογιστή (προσοχή: μια νέα σύνδεση της μίας μπορεί να χαλάσει την άλλη).' 'Yellow'
                }
            }
            if (-not $client) { Skip-Network 'Daisycon' $false; continue }
        } else {
            $secret = Read-Key 'DAISYCON_CLIENT_SECRET' 'Client secret της εφαρμογής του Worker (δεν φαίνεται όσο το επικολλάς· σκέτο Enter αν δεν έχει)'
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
            $code = Read-Key 'DAISYCON_CODE' 'Κωδικός (code) από τη σελίδα του Daisycon (δεν φαίνεται όσο τον επικολλάς· σκέτο Enter = παράλειψη)'
            if (-not $code) { Skip-Network 'Daisycon' $false; continue }
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
        # would become unreadable), never shown. The names were read above, so "missing" is really missing.
        if ($okAll -and (@($names) -notcontains 'NETWORK_SYNC_KEY')) {
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
        $hint = 'σκέτο Enter = παράλειψη του Linkwise'
        if ($allSet) { $hint = 'σκέτο Enter = κρατάω τα υπάρχοντα' }
        $u = Read-Key 'LINKWISE_API_USER' ('Linkwise API: όνομα χρήστη (δεν φαίνεται όσο το γράφεις· {0})' -f $hint)
        if (-not $u) { Skip-Network 'Linkwise' $allSet; continue }
        $p = Read-Key 'LINKWISE_API_PASSWORD' 'Linkwise API: κωδικός (δεν φαίνεται όσο τον γράφεις)'
        if (-not $p) { Skip-Network 'Linkwise' $allSet; continue }
        $okKey = $false
        if ($env:GW_TEST_NS_API) { $okKey = ($env:GW_TEST_NS_API -eq 'ok') } else {
            $env:GW_NS_LW_USER = $u; $env:GW_NS_LW_PASS = $p
            try { $R = Invoke-NodeJson 'network-sales.mjs' @('--mode', 'linkwise-probe') } finally { Clear-NsEnv }
            if ($R) { $okKey = [bool]$R.ok -and -not [bool]$R.refused }
        }
        if (-not $okKey) { Say '   🔴 Το Linkwise ΔΕΝ δέχτηκε το όνομα/κωδικό του API (μία δοκιμή μόνο ανάγνωσης). Δεν τα αποθήκευσα.' 'Red'; $failed.Add('Linkwise'); continue }
        $okAll = Put-Key 'LINKWISE_API_USER' $u
        if ($okAll) { $okAll = Put-Key 'LINKWISE_API_PASSWORD' $p }
        $u = ''; $p = ''
        if (-not $okAll) { $failed.Add('Linkwise') }
        Say '   Linkwise: ο συγχρονισμός του μένει ⏸ ΣΕ ΑΝΑΜΟΝΗ ώσπου το βήμα probe (μόνο ανάγνωση) δείξει τις παραμέτρους της αναφοράς.' 'Yellow'
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
    $miss = @($n.Secrets | Where-Object { @($after) -notcontains $_ })
    if ($miss.Count -eq 0) { Say ('  {0}: 🟢 όλα υπάρχουν' -f $n.Label) } else { Say ('  {0}: λείπουν {1}' -f $n.Label, ($miss -join ', ')) }
}
Show-Syncs $nsDir
Write-Undo
Say ''
if (-not $workerOk) { Say 'Αποτέλεσμα: 🔴 ΠΡΟΒΛΗΜΑ: ο Worker δεν βρέθηκε στον τελικό έλεγχο. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 9 }
$skipText = ''
if ($skipped.Count -gt 0) { $skipText = (' ΠΑΡΑΛΕΙΦΘΗΚΕ: {0}.' -f (($skipped | Select-Object -Unique) -join ', ')) }
if ($failed.Count -gt 0) {
    Say ('Αποτέλεσμα: 🔴 ΠΡΟΒΛΗΜΑ με: {0}. Τα υπόλοιπα είναι έτοιμα· ξανατρέξε με -Step keys -Only για αυτά.{1} Στείλε στο Claude την αναφορά.' -f (($failed | Select-Object -Unique) -join ', '), $skipText) 'Red'
    Finish 8
}
Say ('Αποτέλεσμα: 🟢 ΕΤΟΙΜΟ.{0} Ο επόμενος συγχρονισμός γίνεται στο :47 μιας ζυγής ώρας (π.χ. 14:47, 16:47).' -f $skipText) 'Green'
Finish 0
