<#
.SYNOPSIS
  The daily bol.com price refresh (lessons L205): the private Worker gear-world-bol-refresh keeps price and stock of the
  bol.com products on the 10 Gear World sites fresh from bol.com's official Marketing Catalog API (bol.com's terms 3.6:
  at least daily). Read-only unless -Apply and the typed approval phrase.

.DESCRIPTION
  -Step check    READ-ONLY (default). Cloudflare login; the database gear-world-awin and the 10 site databases (found by
                 NAME; the IDs never reach a report); the Worker, the code version it runs, its keys (NAMES only, never a
                 value), the kill switch (and why it is off), the last runs; whether this PC has the catalog keys of
                 bol-feed-download; per site, how many rows are 'bol.com', and a ΠΡΟΣΟΧΗ when rows with partner.bol.com
                 links have another retailer name (the Worker refreshes only exactly 'bol.com').
  -Step apply    CHANGES CLOUDFLARE ONLY, one approval: ΕΓΚΡΙΝΩ BOL ΑΝΑΝΕΩΣΗ. First the live-version guard (L156): a
                 Worker that runs a code version this one does not contain is never replaced (exit 13). Then:
                   1. backup: a Time Travel restore point of gear-world-awin and a dated copy (export) on this PC, and the
                      restore points of the 10 site databases (in rollback.txt);
                   2. the new tables in gear-world-awin (sites/bol-refresh/migrations, their own migrations list); the
                      sales tables and the site databases do not change;
                   3. the private Worker gear-world-bol-refresh (no public address, every hour at :13), bound to the 10
                      site databases and gear-world-awin found by name now, deployed with --var GW_COMMIT:<this version>,
                      which is also written to bol_refresh_meta;
                   4. the keys BOL_CATALOG_CLIENT_ID and BOL_CATALOG_CLIENT_SECRET, when the Worker does not have them yet
                      (or with -ReplaceKeys): taken from this PC's encrypted file of bol-feed-download -Step keys
                      (<home>\gear-world-secrets\bol-api.dat, DPAPI), or typed at a hidden prompt when there is none;
                      tested with ONE token and ONE call, then handed to wrangler through its input only, BOTH in one
                      request (wrangler secret bulk: both or neither): never shown, written to a file or put in the report.
                 The apply step never turns the kill switch on: a '0' (the removal tool's first step, -Step disable, or
                 the Worker itself after a 401/403 from bol.com) stays until -Step enable.
                 When the Worker exists but its tables are gone (e.g. a restore of gear-world-awin), apply makes only the
                 tables (backup first) and stops: the Worker writes its version at its next run (:13), then run apply again.
                 The report says how to undo exactly what this run made, and in which folder the undo commands run.
  -Step keys     CHANGES WORKER SECRETS ONLY, one approval: ΕΓΚΡΙΝΩ BOL ΑΝΑΝΕΩΣΗ ΚΛΕΙΔΙΑ. Step 4 alone, always with the
                 keys of this PC (new keys after bol-feed-download -Step keys). Needs the Worker and the tables.
  -Step disable  CHANGES ONE VALUE, one approval: ΕΓΚΡΙΝΩ BOL ΑΝΑΝΕΩΣΗ ΠΑΥΣΗ. The kill switch off (bol_refresh_meta
                 enabled = 0): no bol.com call and no price change any more; the Worker still hides every bol.com row not
                 checked for 24 hours (bol.com's terms). The removal tool sets the same switch.
  -Step enable   CHANGES ONE VALUE, one approval: ΕΓΚΡΙΝΩ BOL ΑΝΑΝΕΩΣΗ ΕΝΑΡΞΗ. The kill switch on again (and the reason the
                 Worker gave when it turned it off, cleared).
  Report: <home>\gear-world-reports\BOL_REFRESH_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'apply', 'keys', 'disable', 'enable')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$PcHome = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [string]$SecretFile = '',
    [string]$SecretEnvPrefix = '',
    [switch]$ReplaceKeys,
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
# HTTPS with TLS 1.2: Windows PowerShell 5.1 may still offer only older TLS, which GitHub and Cloudflare refuse (L106).
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
$PhraseApply = 'ΕΓΚΡΙΝΩ BOL ΑΝΑΝΕΩΣΗ'
$PhraseKeys = 'ΕΓΚΡΙΝΩ BOL ΑΝΑΝΕΩΣΗ ΚΛΕΙΔΙΑ'
$PhraseOff = 'ΕΓΚΡΙΝΩ BOL ΑΝΑΝΕΩΣΗ ΠΑΥΣΗ'
$PhraseOn = 'ΕΓΚΡΙΝΩ BOL ΑΝΑΝΕΩΣΗ ΕΝΑΡΞΗ'
$WorkerName = 'gear-world-bol-refresh'
$SalesDb = 'gear-world-awin'
$BolPage = 'https://partner.bol.com/'
# The 10 sites with bol.com products and their databases (src/bol-refresh.js BOL_SITES; the tests check they agree).
$Sites = @(
    @{ Code = 'cgw'; Db = 'construction-gear-customers' },
    @{ Code = 'hgw'; Db = 'home-gear-world' },
    @{ Code = 'ggw'; Db = 'garden-gear-world' },
    @{ Code = 'wgw'; Db = 'womens-gear-world' },
    @{ Code = 'mgw'; Db = 'mens-gear-world' },
    @{ Code = 'kgw'; Db = 'kids-gear-world' },
    @{ Code = 'agw'; Db = 'car-gear-world' },
    @{ Code = 'sgw'; Db = 'sporty-gear-world' },
    @{ Code = 'vgw'; Db = 'travel-gear-world' },
    @{ Code = 'zgw'; Db = 'pets-gear-world' }
)
$NewTables = @('bol_refresh_runs', 'bol_refresh_meta', 'bol_refresh_checked', 'bol_refresh_hidden')
$SecretNames = @('BOL_CATALOG_CLIENT_ID', 'BOL_CATALOG_CLIENT_SECRET')
if (-not $PcHome) { $PcHome = $HOME }
if (-not $WorkDir) { $WorkDir = Join-Path $PcHome 'gear-world-bol-refresh' }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
if (-not $SecretFile) { $SecretFile = Join-Path (Join-Path $PcHome 'gear-world-secrets') 'bol-api.dat' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$script:Secrets = New-Object System.Collections.Generic.List[string]

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

# Cloudflare IDs (databases, versions, restore points) never go into a report.
function Hide-Ids([string]$Text) {
    $t = [regex]::Replace($Text, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
    return [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{28}\b', '${1}-masked-id')
}

function Clear-BolEnv {
    foreach ($n in @('GW_BOL_ID', 'GW_BOL_SECRET')) { [System.Environment]::SetEnvironmentVariable($n, $null) }
}

function Finish([int]$code) {
    Clear-BolEnv
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('BOL_REFRESH_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('BOL_REFRESH_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
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

# The catalog keys kept encrypted for this Windows user (DPAPI) by bol-feed-download -Step keys: @{ id; secret } or $null.
function Read-PcKeys([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($Path).Trim())
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
        try { $t = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
        $o = $t | ConvertFrom-Json
        $t = ''
        $id = ([string]$o.id).Trim()
        $secret = ([string]$o.secret).Trim()
    } catch { return $null }
    if ($id) { $script:Secrets.Add($id) }
    if ($secret) { $script:Secrets.Add($secret) }
    if (-not $id -or -not $secret) { return $null }
    return @{ id = $id; secret = $secret }
}

function New-CmdFile([string]$Folder, [string]$Arguments) {
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-bolrefresh-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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
        $oldEnc = $null
        try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } }
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

# The two keys go to wrangler in ONE request (secret bulk: both or neither, so the Worker never has a mismatched pair),
# through its standard input only: never on a command line, in a file or in the report.
function Set-WorkerSecretPair([string]$Folder, [string]$Id, [string]$Secret) {
    $json = '{"BOL_CATALOG_CLIENT_ID":' + (ConvertTo-Json $Id -Compress) + ',"BOL_CATALOG_CLIENT_SECRET":' + (ConvertTo-Json $Secret -Compress) + '}'
    $cmdFile = New-CmdFile $Folder ('secret bulk --name {0}' -f $WorkerName)
    try {
        $out = @($json | & $cmdFile)
        $code = $LASTEXITCODE
    } finally {
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        $json = ''
    }
    $text = Hide-Secrets ((($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', '')
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
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-bolrefresh-npm-ci.cmd'
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

# The IDs of the databases by name (@{ name = id }), $null when the list could not be read.
function Get-DbIds([string]$folder) {
    $r = Invoke-Wrangler $folder 'd1 list --json' -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { return $null }
    $ids = @{}
    foreach ($d in $j) { if ([string]$d.name -and [string]$d.uuid) { $ids[[string]$d.name] = [string]$d.uuid } }
    return $ids
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

# The version the Worker runs now (deployments status), '' when it cannot be read. Read before a deploy, so the undo
# can go back to exactly that version (the key changes of the same run make newer versions too).
function Get-ActiveVersion([string]$folder) {
    $r = Invoke-Wrangler $folder ('deployments status --name {0}' -f $WorkerName) -Retry
    if ($r.code -ne 0) { return '' }
    $m = [regex]::Match($r.text, 'Version\(s\):[^\r\n]*?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($m.Success) { return $m.Groups[1].Value }
    return ''
}

# Rows of a read-only SELECT on gear-world-awin, or $null on error.
function Select-Db([string]$folder, [string]$sql) {
    if ($sql -notmatch '^\s*SELECT ') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler $folder ('d1 execute {0} --remote --json --command "{1}"' -f $SalesDb, $sql) -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j -or $j.Count -lt 1) { return $null }
    return , @($j[0].results)
}

# Rows of a read-only SELECT on one of the 10 site databases (bound in the config), or $null on error.
function Select-SiteDb([string]$folder, [string]$dbName, [string]$sql) {
    if ($sql -notmatch '^\s*SELECT ') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler $folder ('d1 execute {0} --remote --json --command "{1}"' -f $dbName, $sql) -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j -or $j.Count -lt 1) { return $null }
    return , @($j[0].results)
}

# Per site: the rows with the name 'bol.com' (the ones the Worker looks after) and, as ΠΡΟΣΟΧΗ, rows with partner.bol.com
# links under any other retailer name: the Worker never refreshes those (it matches the name exactly, L205).
function Show-BolNames([string]$folder) {
    $sql = "SELECT retailer, COUNT(*) AS n FROM products WHERE retailer = 'bol.com' OR instr(COALESCE(affiliate_url, ''), 'partner.bol.com') != 0 GROUP BY retailer"
    $counts = New-Object System.Collections.Generic.List[string]
    $warn = 0
    foreach ($s in $Sites) {
        $rows = Select-SiteDb $folder $s.Db $sql
        if ($null -eq $rows) { $counts.Add(('{0} δεν διαβάστηκε' -f $s.Code.ToUpper())); continue }
        $n = 0
        foreach ($x in $rows) {
            if ([string]$x.retailer -ceq 'bol.com') { $n = [int]$x.n; continue }
            $warn++
            Say ('  🟡 ΠΡΟΣΟΧΗ: {0} ({1}): {2} γραμμές με links του partner.bol.com έχουν το όνομα «{3}», όχι ακριβώς «bol.com»: ο Worker ΔΕΝ τις ανανεώνει. Πρέπει να διορθωθεί το όνομα στην εισαγωγή.' -f $s.Code.ToUpper(), $s.Db, $x.n, [string]$x.retailer) 'Yellow'
        }
        $counts.Add(('{0} {1}' -f $s.Code.ToUpper(), $n))
    }
    Say ('  Γραμμές «bol.com» στα sites: {0}' -f ($counts -join ', '))
    if ($warn -eq 0) { Say '  Όνομα καταστήματος: όλες οι γραμμές με links του bol.com λέγονται ακριβώς «bol.com»: 🟢 ΕΝΤΑΞΕΙ' }
}

# The tables of this tool that exist now (names), or $null when they could not be read.
function Get-NewTables([string]$folder) {
    $have = Select-Db $folder ("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('{0}')" -f ($NewTables -join "', '"))
    if ($null -eq $have) { return $null }
    return , @($have | ForEach-Object { [string]$_.name })
}

# bol_refresh_meta: @{ ok; enabled; commit; cycle } ('' = not there).
function Get-MetaValues([string]$folder, [string[]]$tables) {
    $res = @{ ok = $true; enabled = ''; commit = ''; cycle = ''; disabled_reason = '' }
    if ($tables -notcontains 'bol_refresh_meta') { return $res }
    $rows = Select-Db $folder "SELECT key, value FROM bol_refresh_meta WHERE key IN ('enabled', 'commit', 'cycle', 'disabled_reason')"
    if ($null -eq $rows) { $res.ok = $false; return $res }
    foreach ($x in $rows) { $res[[string]$x.key] = [string]$x.value }
    if ($res.commit -and $res.commit -notmatch '^[0-9a-f]{40}$') { $res.ok = $false; $res.commit = '' }
    return $res
}

function Write-Config([string]$path, [hashtable]$ids) {
    $text = [System.IO.File]::ReadAllText((Join-Path (Join-Path (Join-Path $repo 'sites') 'bol-refresh') 'wrangler.jsonc.example'))
    if ($ids.ContainsKey($SalesDb)) { $text = $text.Replace('REPLACE_WITH_DATABASE_ID_SALES', $ids[$SalesDb]) }
    foreach ($s in $Sites) { if ($ids.ContainsKey($s.Db)) { $text = $text.Replace(('REPLACE_WITH_DATABASE_ID_' + $s.Code.ToUpper()), $ids[$s.Db]) } }
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

function Show-Runs([string]$folder) {
    $runs = Select-Db $folder 'SELECT ran_at, ok, state, calls, tokens, found, updated, hidden, reshown, pending, message FROM bol_refresh_runs ORDER BY id DESC LIMIT 5'
    if ($null -eq $runs) { Say '  Τελευταίες εκτελέσεις: δεν διαβάστηκαν (ο πίνακας δεν υπάρχει ακόμα;)'; return }
    if ($runs.Count -eq 0) { Say '  Τελευταίες εκτελέσεις: καμία ακόμα (η πρώτη γίνεται στο επόμενο :13).'; return }
    Say '  Τελευταίες εκτελέσεις (η νεότερη πρώτα):'
    foreach ($x in $runs) {
        # ok: 1 = good, 2 = held (kill switch off; never a problem), 0 = problem.
        $state = '🔴 ΠΡΟΒΛΗΜΑ'
        if ([int]$x.ok -eq 1) { $state = '🟢 ΕΝΤΑΞΕΙ' } elseif ([int]$x.ok -eq 2) { $state = '⏸ ΣΕ ΠΑΥΣΗ (διακόπτης κλειστός)' }
        Say ('    {0}  {1}  κλήσεις {2}, token {3}, ελέγχθηκαν {4}, άλλαξαν {5}, κρύφτηκαν {6}, ξαναφάνηκαν {7}, μένουν {8}  {9}' -f $x.ran_at, $state, $x.calls, $x.tokens, $x.found, $x.updated, $x.hidden, $x.reshown, $x.pending, [string]$x.message)
    }
}

function Show-Switch([hashtable]$meta) {
    if ($meta.enabled -eq '0') {
        Say '  Διακόπτης (kill switch): ⏸ ΚΛΕΙΣΤΟΣ: καμία κλήση στο bol.com, καμία αλλαγή τιμής· κρύβονται μόνο όσα δεν ελέγχθηκαν 24 ώρες'
        if ($meta.disabled_reason) { Say ('    🔴 ΠΡΟΒΛΗΜΑ: τον έκλεισε ο ίδιος ο Worker, γιατί το bol.com αρνήθηκε ή μπλόκαρε (401/403): {0}' -f $meta.disabled_reason) 'Red'; Say ('    Επόμενο: έλεγξε τα κλειδιά (bol-feed-download -Step check), μετά -Step keys αν χρειάζεται, και -Step enable (φράση {0}).' -f $PhraseOn) }
        else { Say '    Τον έκλεισε η αφαίρεση των προϊόντων ή το -Step disable. Ανοίγει ΜΟΝΟ με -Step enable.' }
    }
    elseif ($meta.enabled) { Say '  Διακόπτης (kill switch): ΑΝΟΙΧΤΟΣ' }
    else { Say '  Διακόπτης (kill switch): δεν υπάρχει ακόμα (θα μπει ανοιχτός με τους πίνακες)' }
}

function Test-Yes([string]$s) {
    $t = Normalize-Phrase $s
    return (@('ΝΑΙ', 'NAI', 'YES', 'Y') -contains $t)
}

# The undo of exactly what this run made. Printed on screen and in the report, and written to rollback.txt of the backup
# folder (with the IDs, which the report hides).
function Write-Undo {
    $lines = New-Object System.Collections.Generic.List[string]
    if ($script:Deployed -or $script:SetKeys.Count -gt 0) {
        $lines.Add(('  Πρώτα και χωρίς σβήσιμο: κλείσε την ανανέωση με -Step disable (φράση {0}). Ο Worker τότε δεν καλεί το bol.com και δεν αλλάζει τιμές, αλλά κρύβει ό,τι δεν ελέγχθηκε 24 ώρες.' -f $PhraseOff))
    }
    if ($script:CreatedWorker) {
        $lines.Add(('  Ο Worker (φτιάχτηκε τώρα, μαζί και τα κλειδιά του):  npx wrangler delete --name {0}' -f $WorkerName))
        $lines.Add('    ΠΡΟΣΟΧΗ: χωρίς τον Worker κανείς δεν κρύβει τις τιμές του bol.com που παλιώνουν (όροι του bol.com): πρώτα η αφαίρεση των προϊόντων του bol.com (tools/bol-remove.ps1).')
    } else {
        if ($script:MaybeCreatedWorker) {
            $lines.Add(('  Ο Worker, ΜΟΝΟ αν δεν υπήρχε πριν (ο έλεγχος δεν μπόρεσε να το διαβάσει):  npx wrangler delete --name {0}' -f $WorkerName))
        }
        foreach ($k in $script:SetKeys) { $lines.Add(('  Το κλειδί {0} (ΣΒΗΝΕΤΑΙ από τον Worker· το προηγούμενο δεν κρατήθηκε πουθενά):  npx wrangler secret delete {0} --name {1}' -f $k, $WorkerName)) }
        if ($script:SetKeys.Count -gt 0) {
            $lines.Add(('    Για να ξαναμπούν κλειδιά: τα κλειδιά αυτού του υπολογιστή με -Step keys (φράση {0}); τα προηγούμενα του υπολογιστή: μετονόμασε το νεότερο bol-api.dat.old-<ώρα> σε bol-api.dat στο {1} και μετά -Step keys.' -f $PhraseKeys, (Split-Path -Parent $SecretFile)))
        }
        if ($script:Deployed -and -not $script:MaybeCreatedWorker) {
            $was = 'κώδικα που είχε πριν'
            if ($script:PrevCommit) { $was = ('κώδικα που είχε πριν, έκδοση {0}' -f (Get-GwShort $script:PrevCommit)) }
            if ($script:PrevVersion) {
                $lines.Add(('  Ο νέος κώδικας του Worker (επιστροφή στον {0}):  npx wrangler rollback {1} --name {2}' -f $was, $script:PrevVersion, $WorkerName))
            } else {
                $lines.Add(('  Ο νέος κώδικας του Worker (επιστροφή στον {0}):  npx wrangler rollback --name {1}' -f $was, $WorkerName))
            }
        }
    }
    $made = @($script:CreatedTables)
    if ($made.Count -gt 0) {
        $sql = New-Object System.Collections.Generic.List[string]
        foreach ($t in @('bol_refresh_hidden', 'bol_refresh_runs', 'bol_refresh_meta')) { if ($made -contains $t) { $sql.Add(('DROP TABLE IF EXISTS {0}' -f $t)) } }
        if ($made.Count -eq $NewTables.Count) { $sql.Add('DROP TABLE IF EXISTS d1_migrations_bol_refresh') }
        $lines.Add(('  Οι πίνακες που φτιάχτηκαν τώρα:  npx wrangler d1 execute {0} --remote --command "{1}"' -f $SalesDb, ($sql -join '; ')))
    }
    if ($script:Bookmark) {
        $lines.Add(('  Ή όλη η βάση {0} όπως ήταν πριν:  npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $SalesDb, $script:Bookmark))
        $lines.Add('    Η επαναφορά γυρίζει πίσω και τις πωλήσεις των δικτύων· ξαναγεμίζουν από την ανάγνωση των 90 ημερών του επόμενου συγχρονισμού.')
    }
    if ($script:SiteBookmarks.Count -gt 0) {
        $lines.Add('  Οι βάσεις των 10 sites ΔΕΝ άλλαξαν σε αυτή την εκτέλεση. Ο Worker αλλάζει εκεί μόνο γραμμές bol.com (τιμή, απόθεμα, ημερομηνία ελέγχου, απόκρυψη)· όσες κρύβει τις γράφει στο bol_refresh_hidden.')
        $lines.Add('    Τα σημεία επαναφοράς τους (μόνο σε ανάγκη: γυρίζουν ΟΛΗ τη βάση του site, και εισαγωγές και clicks) είναι στο rollback.txt.')
    }
    Say ''
    if ($lines.Count -eq 0) { Say 'Αναίρεση: αυτή η εκτέλεση δεν άλλαξε τίποτα.'; return }
    Say 'Αν θελήσεις να το αναιρέσεις (μόνο με έγκριση):'
    Say ('  Οι εντολές αναίρεσης (npx wrangler ...) τρέχουν στον φάκελο: {0}  (πρώτα: cd "{0}")' -f $cfgDir)
    # Never a loop variable named l: PowerShell names are case-blind and dynamically scoped, so Say would take it for its report list.
    foreach ($undoLine in $lines) { Say $undoLine }
    if ($script:SetKeys.Count -gt 0) { Say ('  Τα κλειδιά ακυρώνονται και στο ίδιο το bol.com: {0} -> Mijn account -> API toegang.' -f $BolPage) }
    if ($script:BackupDir) {
        $text = @(('Gear World - bol.com daily price refresh ({0}), {1}' -f $WorkerName, (Get-Date -Format 'yyyy-MM-dd HH:mm')), 'To undo (only with approval):', ('  run the commands in the folder: {0}' -f $cfgDir)) + @($lines)
        foreach ($k in $script:SiteBookmarks.Keys) { $text += ('  site database {0} before this run (only in an emergency, it undoes EVERYTHING after it):  npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $k, $script:SiteBookmarks[$k]) }
        $text += ('copy of {0} before the change: {1}' -f $SalesDb, $script:Dump)
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
$script:PrevVersion = ''
$script:Bookmark = ''
$script:SiteBookmarks = [ordered]@{}
$script:BackupDir = ''
$script:Dump = ''

# The keys step of apply and keys: from this PC's file, else the hidden prompt; one test; then through wrangler's input.
function Put-CatalogKeys([string]$folder) {
    $keys = Read-PcKeys $SecretFile
    $from = ''
    if ($keys) {
        $from = ('το κρυπτογραφημένο αρχείο του υπολογιστή ({0}, από το bol-feed-download -Step keys)' -f $SecretFile)
    } else {
        Write-Host ''
        Write-Host ('Δεν βρήκα τα κλειδιά του καταλόγου σε αυτόν τον υπολογιστή ({0}).' -f $SecretFile) -ForegroundColor Yellow
        Write-Host ('Επικόλλησέ τα εδώ: {0} -> Mijn account -> API toegang -> Client credentials (το κλειδί «GearWorld» του Marketing Catalog API).' -f $BolPage) -ForegroundColor Yellow
        $id = Read-Key 'BOL_CATALOG_CLIENT_ID' 'bol.com Client ID (δεν φαίνεται όσο το επικολλάς· σκέτο Enter = παράλειψη)'
        if (-not $id) { Say '   bol.com: ΠΑΡΑΛΕΙΦΘΗΚΕ (δεν δόθηκε κλειδί· τίποτα δεν άλλαξε)'; return 'skipped' }
        $secret = Read-Key 'BOL_CATALOG_CLIENT_SECRET' 'bol.com Client Secret (δεν φαίνεται όσο το επικολλάς)'
        if (-not $secret) { Say '   bol.com: ΠΑΡΑΛΕΙΦΘΗΚΕ (δεν δόθηκε κλειδί· τίποτα δεν άλλαξε)'; return 'skipped' }
        $keys = @{ id = $id; secret = $secret }
        $from = 'την κρυφή ερώτηση'
    }
    Say ('   Κλειδιά από {0}: δεν φαίνονται πουθενά.' -f $from)
    if ($keys.id.Length -lt 8 -or $keys.secret.Length -lt 8 -or $keys.id -match '\s' -or $keys.secret -match '\s' -or $keys.id -eq $keys.secret) {
        Say '   🔴 ΠΡΟΒΛΗΜΑ: τα κλειδιά δεν μοιάζουν σωστά (κενά, πολύ μικρά ή ίδια). Δεν αποθήκευσα τίποτα.' 'Red'
        return 'failed'
    }
    $verdict = 'none'
    # GW_TEST_BOL_API: the answer of the key test in tests/run-tests.ps1 only (no call to bol.com there).
    if ($env:GW_TEST_BOL_API) { $verdict = $env:GW_TEST_BOL_API } else {
        $env:GW_BOL_ID = $keys.id; $env:GW_BOL_SECRET = $keys.secret
        try { $R = Invoke-NodeJson 'bol-refresh.mjs' @('--mode', 'key-test') } finally { Clear-BolEnv }
        if ($R) {
            if ($R.ok) { $verdict = 'ok' } elseif ($R.refused) { $verdict = 'refused' } elseif ($R.blocked) { $verdict = 'blocked' }
            if ($R.error) { Say ('   bol.com: {0}' -f [string]$R.error) }
        }
    }
    if ($verdict -eq 'refused') { Say ('   🔴 ΠΡΟΒΛΗΜΑ: το bol.com ΔΕΝ δέχτηκε τα κλειδιά (401). Δεν τα αποθήκευσα. Φτιάξε νέα στο {0} και τρέξε το bol-feed-download -Step keys.' -f $BolPage) 'Red'; return 'failed' }
    if ($verdict -eq 'blocked') { Say '   🔴 ΠΡΟΒΛΗΜΑ: το bol.com απάντησε 403/429 (πολλά αιτήματα ή μπλοκάρισμα). Δεν τα αποθήκευσα· ξαναδοκίμασε σε μία ώρα, χωρίς νέες προσπάθειες ενδιάμεσα.' 'Red'; return 'failed' }
    if ($verdict -ne 'ok') { Say '   🔴 ΠΡΟΒΛΗΜΑ: το bol.com δεν απάντησε σωστά στη δοκιμή (ένα token, μία κλήση). Δεν τα αποθήκευσα· ξαναδοκίμασε σε λίγο.' 'Red'; return 'failed' }
    Say '   Δοκιμή στο bol.com (ένα token, μία κλήση): 🟢 ΕΝΤΑΞΕΙ' 'Green'
    $s = Set-WorkerSecretPair $folder $keys.id $keys.secret
    $keys = $null
    if ($s.code -ne 0) {
        Say '   🔴 ΠΡΟΒΛΗΜΑ: τα κλειδιά δεν αποθηκεύτηκαν. Μπαίνουν και τα δύο μαζί σε μία αίτηση, άρα ο Worker έμεινε με όποια είχε πριν (ή χωρίς).' 'Red'
        foreach ($line in @($s.text -split "`n" | Select-Object -Last 6)) { Say ('  ' + $line) }
        return 'failed'
    }
    foreach ($k in $SecretNames) { $script:SetKeys.Add($k) }
    $check = Get-SecretNames $folder
    $miss = @($SecretNames | Where-Object { @($check) -notcontains $_ })
    if ($null -eq $check -or $miss.Count -gt 0) { Say ('   🔴 ΠΡΟΒΛΗΜΑ: μετά την αποθήκευση δεν βρίσκω τα ονόματα {0}. Ξανατρέξε -Step keys.' -f ($SecretNames -join ', ')) 'Red'; return 'failed' }
    Say ('   {0}: αποθηκεύτηκαν μαζί, σε μία αίτηση (δεν φαίνονται ποτέ ξανά)' -f ($SecretNames -join ' και ')) 'Green'
    return 'ok'
}

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply -and $Step -ne 'check') { $mode = 'APPLY (με έγκριση)' }
Say ('BOL.COM DAILY PRICE REFRESH ({0}) - step: {1} - {2} - {3}' -f $WorkerName, $Step, $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (($Step -eq 'apply' -or $Step -eq 'keys') -and -not $env:GW_TEST_BOL_API -and -not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }

if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$deploy = Prepare-Deploy
$cfgDir = Join-Path (Join-Path $deploy 'sites') 'bol-refresh'
$config = Join-Path $cfgDir 'wrangler.jsonc'

$who = Invoke-Wrangler $deploy 'whoami' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    if ($who.text -match '(?i)not authenticated|wrangler login') { Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red' }
    else { Say 'Δεν μπόρεσα να ελέγξω τη σύνδεση με το Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red' }
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 15)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: 🟢 ΕΝΤΑΞΕΙ' 'Green'

$ids = Get-DbIds $deploy
if ($null -eq $ids) { Say 'Δεν διάβασα τη λίστα των βάσεων D1. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 5 }
if (-not $ids.ContainsKey($SalesDb)) { Say ('Η βάση {0} δεν υπάρχει: πρώτα το awin-setup (apply). Δεν άλλαξε τίποτα.' -f $SalesDb) 'Red'; Finish 5 }
$missingDbs = @($Sites | Where-Object { -not $ids.ContainsKey($_.Db) } | ForEach-Object { $_.Db })
Write-Config $config $ids

Say ''
Say 'Τι υπάρχει τώρα:'
Say ('  Βάση {0}: υπάρχει (εκεί γράφει ο Worker τις εκτελέσεις του, δίπλα στις πωλήσεις)' -f $SalesDb)
if ($missingDbs.Count -eq 0) { Say ('  Βάσεις των 10 sites: βρέθηκαν όλες ({0})' -f (($Sites | ForEach-Object { $_.Code.ToUpper() }) -join ', ')) }
else { Say ('  Βάσεις sites που ΔΕΝ βρέθηκαν: {0}' -f ($missingDbs -join ', ')) 'Red' }
$worker = Get-WorkerState $deploy
$names = @('missing')
if ($worker -ne 'no') {
    $names = Get-SecretNames $deploy
    if ($worker -eq 'unknown' -and $null -ne $names) {
        if (@($names) -contains 'missing') { $worker = 'no' } else { $worker = 'yes' }
    }
}
$have = Get-NewTables $cfgDir
if ($null -eq $have) { Say '  Πίνακες της ανανέωσης: δεν διαβάστηκαν. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 5 }
$missingTables = @($NewTables | Where-Object { $have -notcontains $_ })
if ($missingTables.Count -eq 0) { Say '  Πίνακες της ανανέωσης: υπάρχουν όλοι' } else { Say ('  Πίνακες της ανανέωσης που λείπουν (θα φτιαχτούν): {0}' -f ($missingTables -join ', ')) }
if ($worker -eq 'yes') { Say ('  Worker {0}: υπάρχει' -f $WorkerName) } elseif ($worker -eq 'no') { Say ('  Worker {0}: δεν υπάρχει ακόμα (θα ανέβει)' -f $WorkerName) } else { Say ('  Worker {0}: δεν διαβάστηκε' -f $WorkerName) 'Yellow' }
$meta = Get-MetaValues $cfgDir $have
$script:PrevCommit = $meta.commit
if ($worker -eq 'yes') {
    if (-not $meta.ok) { Say '  Έκδοση κώδικα του Worker: δεν διαβάστηκε' 'Yellow' }
    elseif ($meta.commit) { Say ('  Έκδοση κώδικα του Worker: {0}' -f (Get-GwShort $meta.commit)) }
    else { Say '  Έκδοση κώδικα του Worker: δεν τη γράφει ακόμα (τη γράφει σε κάθε εκτέλεση, στο :13)' }
}
$thisCommit = Get-GwCommit $repo
if ($thisCommit) { Say ('  Αυτή η έκδοση κώδικα: {0}' -f (Get-GwShort $thisCommit)) }
if ($null -eq $names) { Say '  Κλειδιά του Worker: δεν διαβάστηκαν' 'Yellow' }
elseif (@($names) -contains 'missing') { Say '  Κλειδιά του Worker: κανένα (δεν υπάρχει Worker)' }
else {
    $setK = @($SecretNames | Where-Object { @($names) -contains $_ })
    if ($setK.Count -eq $SecretNames.Count) { Say ('  Κλειδιά του Worker: υπάρχουν ({0}, μόνο ονόματα)' -f ($SecretNames -join ', ')) }
    else { Say ('  Κλειδιά του Worker: λείπουν {0}' -f ((@($SecretNames | Where-Object { @($names) -notcontains $_ })) -join ', ')) }
}
if ($have -contains 'bol_refresh_meta') { Show-Switch $meta }
if ($have -contains 'bol_refresh_runs') { Show-Runs $cfgDir }
if ($Step -eq 'check' -and $missingDbs.Count -eq 0) { Show-BolNames $cfgDir }
if (Test-Path -LiteralPath $SecretFile) { Say '  Κλειδιά του καταλόγου σε αυτόν τον υπολογιστή (bol-feed-download -Step keys): υπάρχουν (κρυπτογραφημένα, δεν ανοίχτηκαν)' }
else { Say ('  Κλειδιά του καταλόγου σε αυτόν τον υπολογιστή: δεν υπάρχουν ({0})· στο apply θα σου ζητηθούν κρυφά' -f $SecretFile) }

if ($Step -eq 'check') {
    Say ''
    Say ('Πλάνο του apply (φράση: {0}):' -f $PhraseApply)
    Say '  0. έλεγχος έκδοσης (L156): ένας Worker με έκδοση που αυτή εδώ δεν έχει μέσα ΔΕΝ αντικαθίσταται'
    Say ('  1. backup: σημείο επαναφοράς (Time Travel) και αντίγραφο σε αρχείο της {0}, και τα σημεία επαναφοράς των 10 βάσεων των sites' -f $SalesDb)
    Say ('  2. οι πίνακες bol_refresh_runs, bol_refresh_meta, bol_refresh_checked, bol_refresh_hidden στη {0} (μόνο αν λείπουν· οι πωλήσεις δεν αλλάζουν)' -f $SalesDb)
    Say ('  3. ο ιδιωτικός Worker {0}: χωρίς δημόσια διεύθυνση, κάθε ώρα στο :13· ανάγνωση των λιστών του bol.com στις 04:13 και 16:13 UTC' -f $WorkerName)
    Say '     Αλλάζει μόνο γραμμές bol.com που ήδη υπάρχουν στα 10 sites (τιμή, απόθεμα, απόκρυψη, και την ημερομηνία μόνο μαζί με αλλαγή ή όταν περάσουν 7 μέρες)· δεν προσθέτει ποτέ προϊόν και δεν αλλάζει νόμισμα.'
    Say '     Σε 401/403 του bol.com κλείνει μόνος του τον διακόπτη (δεν ξαναρωτά κάθε ώρα)· ανοίγει ξανά μόνο με -Step enable.'
    Say '  4. τα κλειδιά BOL_CATALOG_CLIENT_ID και BOL_CATALOG_CLIENT_SECRET, από το κρυπτογραφημένο αρχείο του υπολογιστή (ή κρυφή ερώτηση), με μία δοκιμή πρώτα'
    Say ('  Μόνο κλειδιά: -Step keys (φράση: {0}). Παύση: -Step disable ({1}). Ξανά: -Step enable ({2}). Το apply δεν ανοίγει ποτέ τον διακόπτη.' -f $PhraseKeys, $PhraseOff, $PhraseOn)
    Say ''
    Say 'Αποτέλεσμα: 🟢 ΕΝΤΑΞΕΙ (μόνο έλεγχος, δεν άλλαξε τίποτα)' 'Green'
    Finish 0
}

# ================= disable / enable (the kill switch) =================
if ($Step -eq 'disable' -or $Step -eq 'enable') {
    $want = '0'; $phrase = $PhraseOff; $other = 'enable'; $otherPhrase = $PhraseOn
    if ($Step -eq 'enable') { $want = '1'; $phrase = $PhraseOn; $other = 'disable'; $otherPhrase = $PhraseOff }
    if ($have -notcontains 'bol_refresh_meta' -or -not $meta.ok) { Say ''; Say 'Ο διακόπτης δεν υπάρχει ή δεν διαβάστηκε: πρώτα το apply. Δεν άλλαξε τίποτα.' 'Red'; Finish 7 }
    if (-not $Apply) { Say ''; Say ('Χωρίς -Apply δεν αλλάζει τίποτα. Για τον διακόπτη: -Step {0} -Apply και η φράση {1}' -f $Step, $phrase) 'Yellow'; Finish 0 }
    if (-not (Confirm-Approval $phrase)) { Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
    $was = $meta.enabled
    # The reason the Worker gave (after a 401/403) is cleared with every change of the switch by hand.
    $ts = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    $sqlSet = "INSERT INTO bol_refresh_meta (key, value, updated_at) VALUES ('enabled', '{0}', '{1}'), ('disabled_reason', '', '{1}') ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at" -f $want, $ts
    $w = Invoke-Wrangler $cfgDir ('d1 execute {0} --remote --command "{1}"' -f $SalesDb, $sqlSet) -Retry
    if ($w.code -ne 0) { Say 'Ο διακόπτης δεν άλλαξε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($w.text -split "`n" | Select-Object -Last 6)) { Say ('  ' + $line) }; Finish 6 }
    $after = Get-MetaValues $cfgDir $have
    Say ''
    if ($after.enabled -ne $want) { Say 'Αποτέλεσμα: 🔴 ΠΡΟΒΛΗΜΑ: ο διακόπτης δεν διαβάστηκε με τη νέα τιμή. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 6 }
    Show-Switch $after
    Say ('Αναίρεση: -Step {0} -Apply με τη φράση {1} (πριν ήταν: {2}).' -f $other, $otherPhrase, $(if ($was) { $was } else { 'δεν υπήρχε' }))
    if ($want -eq '0') { Say 'Αποτέλεσμα: 🟢 ΕΤΟΙΜΟ: η ανανέωση σταμάτησε από την επόμενη εκτέλεση (:13). Ό,τι δεν ελέγχθηκε 24 ώρες κρύβεται.' 'Green' }
    else { Say 'Αποτέλεσμα: 🟢 ΕΤΟΙΜΟ: η ανανέωση ξεκινά ξανά στην επόμενη εκτέλεση (:13).' 'Green' }
    Finish 0
}

# ================= keys (secrets only) =================
if ($Step -eq 'keys') {
    if ($worker -ne 'yes' -or $missingTables.Count -gt 0) { Say ''; Say 'Το βήμα keys χρειάζεται τον Worker και τους πίνακες: πρώτα το apply. Δεν άλλαξε τίποτα.' 'Red'; Finish 7 }
    if (-not $Apply) { Say ''; Say ('Χωρίς -Apply δεν αλλάζει τίποτα. Για τα κλειδιά: -Step keys -Apply και η φράση {0}' -f $PhraseKeys) 'Yellow'; Finish 0 }
    if (-not (Confirm-Approval $PhraseKeys)) { Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
    Say ''
    Say 'Έγκριση: 🟢 ΕΝΤΑΞΕΙ. Αλλάζουν μόνο τα κλειδιά του Worker: ούτε πίνακες, ούτε ανέβασμα κώδικα.' 'Green'
    if ($null -eq $names -or @($names) -contains 'missing') { Say 'Δεν διάβασα ποια κλειδιά έχει ο Worker: για ασφάλεια ΔΕΝ αλλάζω κανένα. Ξανατρέξε σε λίγα λεπτά.' 'Red'; Finish 14 }
    Say ''
    Say '4. Τα κλειδιά του bol.com:'
    $k = Put-CatalogKeys $deploy
    Write-Undo
    Say ''
    if ($k -eq 'ok') { Say 'Αποτέλεσμα: 🟢 ΕΤΟΙΜΟ. Ο Worker τα χρησιμοποιεί από την επόμενη εκτέλεση (:13).' 'Green'; Finish 0 }
    if ($k -eq 'skipped') { Say 'Αποτέλεσμα: ΠΑΡΑΛΕΙΦΘΗΚΕ: δεν άλλαξε κανένα κλειδί.' 'Yellow'; Finish 0 }
    Say 'Αποτέλεσμα: 🔴 ΠΡΟΒΛΗΜΑ με τα κλειδιά (δες πιο πάνω). Στείλε στο Claude την αναφορά.' 'Red'
    Finish 8
}

# ================= apply =================
if (-not $Apply) {
    Say ''
    Say ('Χωρίς -Apply δεν αλλάζει τίποτα. Για την εγκατάσταση: -Step apply -Apply και η φράση {0}' -f $PhraseApply) 'Yellow'
    Finish 0
}
if ($missingDbs.Count -gt 0) { Say ''; Say ('Λείπουν βάσεις sites ({0}): ο Worker δεν μπορεί να συνδεθεί σε αυτές. Δεν άλλαξε τίποτα.' -f ($missingDbs -join ', ')) 'Red'; Finish 5 }
# 0. the live-version guard (L156), before anything is asked or changed
Say ''
Say 'Έλεγχος έκδοσης (L156): έχει αυτή η έκδοση μέσα όποια τρέχει τώρα ο Worker;'
if ($thisCommit -notmatch '^[0-9a-f]{40}$') {
    Say '  ΣΤΟΠ: δεν ξέρω ποια έκδοση κώδικα ανεβαίνει (ο φάκελος δεν έχει commit). Η εντολή τρέχει μόνο μέσω gw-run.ps1 με -Ref.' 'Magenta'
    Say 'ΣΤΑΜΑΤΗΣΑ ΧΩΡΙΣ ΑΛΛΑΓΕΣ. Στείλε αυτή την αναφορά στο Claude «1 · Gear World Manager».' 'Magenta'
    Finish 13
}
# The Worker exists but its tables are gone (e.g. a restore of gear-world-awin): its version cannot be read (it writes it
# there). Then only the tables are made, with a backup first, and the tool stops: the Worker writes its version at its
# next run and the same command goes on from there. The Worker itself is not touched.
$tablesOnly = ($worker -ne 'no' -and $missingTables.Count -gt 0)
if ($tablesOnly) {
    Say ('  Ο Worker υπάρχει, αλλά οι πίνακές του στη {0} λείπουν ({1}), π.χ. μετά από επαναφορά της βάσης. Ο Worker γράφει την έκδοσή του εκεί, άρα τώρα δεν ξέρω ποια τρέχει.' -f $SalesDb, ($missingTables -join ', ')) 'Yellow'
    Say '  Με τη φράση φτιάχνω ΜΟΝΟ τους πίνακες (με backup πρώτα) και σταματάω· ο Worker δεν αλλάζει. Στο επόμενο :13 γράφει την έκδοσή του· μετά ξανατρέξε την ίδια εντολή.' 'Yellow'
} elseif ($worker -ne 'no') {
    if (-not $meta.ok -or -not $meta.commit) {
        Say '  ΣΤΟΠ: δεν διάβασα ποια έκδοση τρέχει ο Worker (τη γράφει σε κάθε εκτέλεση, στο :13). Για ασφάλεια δεν ανεβαίνει τίποτα· ξανατρέξε μετά το επόμενο :13.' 'Magenta'
        Say 'ΣΤΑΜΑΤΗΣΑ ΧΩΡΙΣ ΑΛΛΑΓΕΣ.' 'Magenta'
        Finish 13
    }
    $cmp = Test-GwContains $meta.commit $thisCommit
    if (-not $cmp.ok) { Say ('  ΣΤΟΠ: το GitHub δεν απάντησε αν η νέα έκδοση έχει μέσα την έκδοση του Worker {0} ({1}). Ξαναδοκίμασε σε λίγα λεπτά.' -f (Get-GwShort $meta.commit), $cmp.status) 'Magenta'; Say 'ΣΤΑΜΑΤΗΣΑ ΧΩΡΙΣ ΑΛΛΑΓΕΣ.' 'Magenta'; Finish 13 }
    if (-not $cmp.contains) {
        Say ('  ΣΤΟΠ: η έκδοση {0} ΔΕΝ έχει μέσα την έκδοση του Worker {1} (GitHub: {2}). Θα έσβηνε κώδικα που τρέχει τώρα.' -f (Get-GwShort $thisCommit), (Get-GwShort $meta.commit), $cmp.status) 'Magenta'
        Say 'ΣΤΑΜΑΤΗΣΑ ΧΩΡΙΣ ΑΛΛΑΓΕΣ. Χρειάζεται μια έκδοση που έχει μέσα και αυτή που τρέχει. Στείλε αυτή την αναφορά στο Claude «1 · Gear World Manager».' 'Magenta'
        Finish 13
    }
    Say ('  ΕΝΤΑΞΕΙ: η έκδοση {0} έχει μέσα την έκδοση του Worker {1}.' -f (Get-GwShort $thisCommit), (Get-GwShort $meta.commit))
} else {
    Say '  ΕΝΤΑΞΕΙ: δεν υπάρχει ακόμα Worker, οπότε δεν χάνεται τίποτα.'
}
if (-not (Confirm-Approval $PhraseApply)) { Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
Say ''
Say 'Έγκριση: 🟢 ΕΝΤΑΞΕΙ.' 'Green'

# 1. backup
$bdir = Join-Path (Join-Path $WorkDir 'backups') ('before-bol-refresh-' + $stamp)
New-Item -ItemType Directory -Path $bdir -Force | Out-Null
$bmPattern = '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}'
$tt = Invoke-Wrangler $cfgDir ('d1 time-travel info {0}' -f $SalesDb) -Retry
$bm = [regex]::Match($tt.text, $bmPattern)
if ($tt.code -ne 0 -or -not $bm.Success) { Say ('Δεν πήρα σημείο επαναφοράς της {0}: ΔΕΝ άλλαξα τίποτα.' -f $SalesDb) 'Red'; Finish 11 }
$dump = Join-Path $bdir ($SalesDb + '.sql')
$ex = Invoke-Wrangler $cfgDir ('d1 export {0} --remote --output "{1}"' -f $SalesDb, $dump) -Retry
if ($ex.code -ne 0 -or -not (Test-Path -LiteralPath $dump)) { Say 'Δεν έγινε το αντίγραφο της βάσης σε αρχείο: ΔΕΝ άλλαξα τίποτα.' 'Red'; foreach ($line in @($ex.text -split "`n" | Select-Object -Last 6)) { Say ('  ' + $line) }; Finish 11 }
foreach ($s in @($Sites | Where-Object { -not $tablesOnly })) {
    $t2 = Invoke-Wrangler $cfgDir ('d1 time-travel info {0}' -f $s.Db) -Retry
    $b2 = [regex]::Match($t2.text, $bmPattern)
    if ($t2.code -ne 0 -or -not $b2.Success) { Say ('Δεν πήρα σημείο επαναφοράς της βάσης {0}: ΔΕΝ άλλαξα τίποτα.' -f $s.Db) 'Red'; Finish 11 }
    $script:SiteBookmarks[$s.Db] = $b2.Value
}
$script:Bookmark = $bm.Value
$script:BackupDir = $bdir
$script:Dump = $dump
[System.IO.File]::WriteAllText((Join-Path $bdir 'rollback.txt'), (('Restore point before the change (only with approval): npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $SalesDb, $bm.Value) + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
if ($tablesOnly) { Say ('1. Backup: σημείο επαναφοράς και αντίγραφο της {0} σε αρχείο: 🟢 ΕΝΤΑΞΕΙ ({1})' -f $SalesDb, $bdir) 'Green' }
else { Say ('1. Backup: σημεία επαναφοράς (11 βάσεις) και αντίγραφο της {0} σε αρχείο: 🟢 ΕΝΤΑΞΕΙ ({1})' -f $SalesDb, $bdir) 'Green' }

# 2. the new tables (gear-world-awin only, this Worker's own migrations list)
Copy-Item -LiteralPath $config -Destination (Join-Path $WorkDir 'wrangler.jsonc') -Force
$m = Invoke-Wrangler $cfgDir ('d1 migrations apply {0} --remote' -f $SalesDb) -Retry
$tablesAfter = Get-NewTables $cfgDir
if ($null -ne $tablesAfter) { $script:CreatedTables = @($NewTables | Where-Object { ($tablesAfter -contains $_) -and ($have -notcontains $_) }) }
if ($m.code -ne 0) { Say '2. Οι πίνακες δεν φτιάχτηκαν. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($m.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }; Write-Undo; Finish 6 }
Say ('2. Πίνακες της ανανέωσης στη {0}: 🟢 ΕΝΤΑΞΕΙ (οι πωλήσεις δεν άλλαξαν)' -f $SalesDb) 'Green'
if ($tablesOnly) {
    Write-Undo
    Say ''
    Say 'Αποτέλεσμα: ΣΤΑΜΑΤΗΣΑ ΣΚΟΠΙΜΑ μετά τους πίνακες (ο Worker δεν άλλαξε). Επόμενο: μετά το επόμενο :13 ξανατρέξε την ίδια εντολή· τότε ο έλεγχος έκδοσης διαβάζει την έκδοση του Worker.' 'Yellow'
    Finish 13
}

# 3. the Worker, with the code version it runs
Say ('3. Ανεβάζω τον ιδιωτικό Worker {0} (έκδοση {1})...' -f $WorkerName, (Get-GwShort $thisCommit))
if ($worker -ne 'no') { $script:PrevVersion = Get-ActiveVersion $cfgDir }
$deployArgs = ('deploy --config "{0}"{1}' -f $config, (Get-GwVersionVar $repo))
$d = Invoke-Wrangler $cfgDir $deployArgs
if ($d.code -ne 0 -and $d.text -match 'code: 10007') {
    Say 'Το Cloudflare δεν απάντησε σωστά στο ανέβασμα. Ξαναδοκιμάζω σε 15 δευτερόλεπτα...' 'Yellow'
    Start-Sleep -Seconds 15
    $d = Invoke-Wrangler $cfgDir $deployArgs
}
if ($d.code -ne 0) { Say '   Ο Worker δεν ανέβηκε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; foreach ($line in @($d.text -split "`n" | Select-Object -Last 12)) { Say ('  ' + $line) }; Write-Undo; Finish 7 }
$script:Deployed = $true
if ($worker -eq 'no') { $script:CreatedWorker = $true } elseif ($worker -ne 'yes') { $script:MaybeCreatedWorker = $true }
Say '   Worker: 🟢 ΕΝΤΑΞΕΙ (χωρίς δημόσια διεύθυνση, κάθε ώρα στο :13)' 'Green'
# The version, readable at once (the Worker also writes it at every run).
$metaSql = "INSERT INTO bol_refresh_meta (key, value, updated_at) VALUES ('commit', '{0}', '{1}') ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at" -f $thisCommit, ((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))
$mw = Invoke-Wrangler $cfgDir ('d1 execute {0} --remote --command "{1}"' -f $SalesDb, $metaSql) -Retry
if ($mw.code -ne 0) { Say '   Η έκδοση δεν γράφτηκε στη βάση τώρα· ο Worker τη γράφει μόνος του στην πρώτη του εκτέλεση.' 'Yellow' }

# 4. the keys. If the Worker's key names cannot be read, NO key is touched.
$names = Get-SecretNames $deploy
if ($null -eq $names -or @($names) -contains 'missing') {
    Say ''
    Say 'Δεν διάβασα ποια κλειδιά έχει ήδη ο Worker: για ασφάλεια ΔΕΝ αλλάζω κανένα κλειδί. Ξανατρέξε σε λίγα λεπτά (ή -Step keys).' 'Red'
    Write-Undo
    Finish 14
}
Say ''
Say '4. Τα κλειδιά του bol.com:'
$allSet = (@($SecretNames | Where-Object { @($names) -notcontains $_ }).Count -eq 0)
$k = 'kept'
if ($allSet -and -not $ReplaceKeys) { Say '   bol.com: ΠΑΡΑΛΕΙΦΘΗΚΕ (κρατήθηκαν τα κλειδιά που υπάρχουν· για νέα: -Step keys)' }
else { $k = Put-CatalogKeys $deploy }

# 5. checks
$after = Get-SecretNames $deploy
if ($null -eq $after) { $after = @() }
$workerOk = (Get-WorkerState $deploy) -eq 'yes'
$metaAfter = Get-MetaValues $cfgDir $NewTables
Say ''
$missK = @($SecretNames | Where-Object { @($after) -notcontains $_ })
if ($missK.Count -eq 0) { Say '  Κλειδιά του Worker: 🟢 υπάρχουν και τα δύο (μόνο ονόματα)' } else { Say ('  Κλειδιά του Worker: λείπουν {0}' -f ($missK -join ', ')) }
Show-Switch $metaAfter
Show-Runs $cfgDir
Write-Undo
Say ''
if (-not $workerOk) { Say 'Αποτέλεσμα: 🔴 ΠΡΟΒΛΗΜΑ: ο Worker δεν βρέθηκε στον τελικό έλεγχο. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 9 }
if ($k -eq 'failed') { Say 'Αποτέλεσμα: 🔴 ΠΡΟΒΛΗΜΑ με τα κλειδιά: ο Worker είναι έτοιμος αλλά χωρίς κλειδιά δεν καλεί το bol.com (κρύβει μόνο ό,τι δεν ελέγχθηκε 24 ώρες). Ξανατρέξε με -Step keys. Στείλε στο Claude την αναφορά.' 'Red'; Finish 8 }
if ($missK.Count -gt 0) { Say 'Αποτέλεσμα: ΠΡΟΣΟΧΗ: ο Worker ανέβηκε χωρίς κλειδιά· χωρίς αυτά δεν καλεί το bol.com. Επόμενο: -Step keys.' 'Yellow'; Finish 8 }
$note = ''
if ($metaAfter.enabled -eq '0') { $note = (' Ο διακόπτης έμεινε ΚΛΕΙΣΤΟΣ: το apply δεν τον ανοίγει ποτέ (τον κλείνει η αφαίρεση των προϊόντων ως πρώτο βήμα, το -Step disable, ή ο ίδιος ο Worker μετά από 401/403). Για να ξεκινήσει η ανανέωση: -Step enable (φράση {0}).' -f $PhraseOn) }
Say ('Αποτέλεσμα: 🟢 ΕΤΟΙΜΟ. Η πρώτη εκτέλεση γίνεται στο επόμενο :13· ανάγνωση των λιστών στις 04:13 και 16:13 UTC.{0}' -f $note) 'Green'
Finish 0
