<#
.SYNOPSIS
  Gear World security fixes of 8/11/2026 (lessons L106): the Cloudflare part that the code cannot do by itself.
  Read-only unless -Apply and the typed approval phrase of the step. No site code, no database and no domain changes here.

.DESCRIPTION
  -Step check        READ-ONLY. Cloudflare login; the NAMES of the secrets of the 14 Workers (Hub + 13 sites; values can never
                     be read); which secrets no code reads any more; the misnamed secret (shown only as its first 20
                     characters and "..."); the Turnstile widgets of the account. Shows the plan of the other steps.
  -Step turnstile    CHANGES SECRETS ONLY, one approval: ΕΓΚΡΙΝΩ TURNSTILE. Two Turnstile widgets for the network (a widget
                     of the free plan takes at most 10 hostnames): "Gear World sign-up 1" (the Hub + 9 sites) and
                     "Gear World sign-up 2" (4 sites), made by wrangler if they are not there yet (or, with -Manual, made
                     by you in the dashboard and pasted here). Then the Hub gets TURNSTILE_SECRET_KEY, TURNSTILE_SECRET_KEY_2
                     and TURNSTILE_SITE_KEY, and each site TURNSTILE_SITE_KEY (the public sitekey of its widget). A secret
                     key goes to wrangler only through its standard input: never on a command line, in a file, a report or
                     on the screen. Each secret key is first checked with Cloudflare (Siteverify), so a wrong one changes
                     nothing. First a note with the live version of each Worker (for rollback). Runs BEFORE the new code.
  -Step secrets      DELETES SECRETS THAT NO CODE READS, one approval: ΕΓΚΡΙΝΩ ΔΙΑΓΡΑΦΗ ΜΥΣΤΙΚΩΝ. GW_INTERNAL_TOKEN (Hub and
                     sites; its Hub address is gone), CGW_ADMIN_TOKEN / HGW_ADMIN_TOKEN (the engine reads only ADMIN_TOKEN),
                     TURNSTILE_SECRET_KEY on the 13 SITES (the Hub checks the tokens now; the Hub keeps its own), and the
                     secret whose NAME holds a Turnstile secret value (garden-gear-world): deleted without ever showing its
                     name in full. Nothing else is touched. First a note with the names and the live versions.
  -Step old-widgets  DELETES THE OLD TURNSTILE WIDGETS of the Gear World hostnames (not the two new ones), one approval:
                     ΕΓΚΡΙΝΩ ΔΙΑΓΡΑΦΗ ΠΑΛΙΩΝ TURNSTILE. Deleting the old Garden widget also makes its secret, which was
                     pasted into a secret name, useless (F07). Only after -Step turnstile.
  -Manual            (turnstile only) You make the two widgets in the dashboard and paste their sitekey and secret key here:
                     https://dash.cloudflare.com/?to=/:account/turnstile
  Report: <home>\gear-world-reports\GW_SECURITY_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'turnstile', 'secrets', 'old-widgets')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [switch]$Manual,
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard,
    [switch]$NoHttpCheck
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
$Phrases = @{ turnstile = 'ΕΓΚΡΙΝΩ TURNSTILE'; secrets = 'ΕΓΚΡΙΝΩ ΔΙΑΓΡΑΦΗ ΜΥΣΤΙΚΩΝ'; 'old-widgets' = 'ΕΓΚΡΙΝΩ ΔΙΑΓΡΑΦΗ ΠΑΛΙΩΝ TURNSTILE' }
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-security' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$DashTurnstile = 'https://dash.cloudflare.com/?to=/:account/turnstile'
$DashWorkers = 'https://dash.cloudflare.com/?to=/:account/workers-and-pages'
# Colours without red and green (lessons L35): cyan = OK, yellow = attention, magenta = problem. Always with words too.
$Ok = 'Cyan'
$Warn = 'Yellow'
$Bad = 'Magenta'

# The Hub and the 13 sites: Worker, domain and Turnstile widget (sites/gwh/security.js has the same two lists).
$Widget1Hosts = @('gearworldhub.com', 'constructiongearworld.com', 'mensgearworld.com', 'womensgearworld.com', 'kidsgearworld.com', 'homegearworld.com', 'gardengearworld.com', 'technologygearworld.com', 'cargearworld.com', 'travelgearworld.com')
$Widget2Hosts = @('sportygearworld.com', 'bikergearworld.com', 'gaminggearworld.com', 'petsgearworld.com')
$WidgetNames = @{ 1 = 'Gear World sign-up 1'; 2 = 'Gear World sign-up 2' }
$HostsOf = @{ 1 = $Widget1Hosts; 2 = $Widget2Hosts }
$Workers = @(
    @{ code = 'hub'; name = 'gear-world-hub'; domain = 'gearworldhub.com' },
    @{ code = 'cgw'; name = 'construction-gear-uk'; domain = 'constructiongearworld.com' },
    @{ code = 'mgw'; name = 'mens-gear-world'; domain = 'mensgearworld.com' },
    @{ code = 'wgw'; name = 'womens-gear-world'; domain = 'womensgearworld.com' },
    @{ code = 'kgw'; name = 'kids-gear-world'; domain = 'kidsgearworld.com' },
    @{ code = 'hgw'; name = 'home-gear-world'; domain = 'homegearworld.com' },
    @{ code = 'ggw'; name = 'garden-gear-world'; domain = 'gardengearworld.com' },
    @{ code = 'tgw'; name = 'technology-gear-world'; domain = 'technologygearworld.com' },
    @{ code = 'agw'; name = 'car-gear-world'; domain = 'cargearworld.com' },
    @{ code = 'vgw'; name = 'travel-gear-world'; domain = 'travelgearworld.com' },
    @{ code = 'sgw'; name = 'sporty-gear-world'; domain = 'sportygearworld.com' },
    @{ code = 'bgw'; name = 'biker-gear-world'; domain = 'bikergearworld.com' },
    @{ code = 'pgw'; name = 'gaming-gear-world'; domain = 'gaminggearworld.com' },
    @{ code = 'zgw'; name = 'pets-gear-world'; domain = 'petsgearworld.com' }
)
foreach ($w in $Workers) { $w.widget = $(if ($Widget1Hosts -contains $w.domain) { 1 } else { 2 }) }

# Secrets that no code of this version reads (tests/worker/security-fixes.test.mjs checks the code for each name).
$UnusedEverywhere = @('GW_INTERNAL_TOKEN', 'CGW_ADMIN_TOKEN', 'HGW_ADMIN_TOKEN')
$UnusedOnSites = @('TURNSTILE_SECRET_KEY')
# What the Hub reads: never deleted there. TURNSTILE_SITE_KEY and ADMIN_TOKEN are read on every site: never deleted.
$KeepOnHub = @('TURNSTILE_SECRET_KEY', 'TURNSTILE_SECRET_KEY_2', 'TURNSTILE_SITE_KEY', 'MAILERLITE_API_KEY', 'PHOTO_LIMIT_SALT')
$KeepEverywhere = @('TURNSTILE_SITE_KEY', 'ADMIN_TOKEN')
$TurnstilePrefix = 'TURNSTILE_SECRET_KEY'

# Everything said goes through Hide-Text: secret values and the misnamed secret never reach the screen, the report or
# a note (Hide-Secret); the screen and the report also show Cloudflare ids only by their first 4 characters.
$script:Hidden = New-Object System.Collections.Generic.List[string]
function Hide-Secret([string]$text) {
    $t = [string]$text
    foreach ($s in $script:Hidden) { if ($s) { $t = $t.Replace($s, '[κρυφό]') } }
    # A name that starts with TURNSTILE_SECRET_KEY and goes on (not _2): only its first 20 characters, then "...".
    $t = [regex]::Replace($t, 'TURNSTILE_SECRET_KEY(?!_2(?![A-Za-z0-9]))[A-Za-z0-9=_\-\.]+', ($TurnstilePrefix + [char]0x2026))
    # A Turnstile secret key (0x and about 33 more characters); the public sitekeys are shorter.
    return [regex]::Replace($t, '\b[0-9]x[0-9A-Za-z_\-]{26,}', '[κρυφό]')
}
function Hide-Text([string]$text) {
    $t = Hide-Secret $text
    # Cloudflare ids (account, version): only their first 4 characters.
    $t = [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
    return [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{28}\b', '${1}-masked-id')
}

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $safe = Hide-Text $text
    $L.Add($safe)
    if ($color) { Write-Host $safe -ForegroundColor $color } else { Write-Host $safe }
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('GW_SECURITY_{0}_{1}.txt' -f $Step.ToUpper().Replace('-', '_'), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('GW_SECURITY_{0}_{1}_{2}.txt' -f $Step.ToUpper().Replace('-', '_'), $stamp, $n); $n++ }
    $text = Hide-Text ($L -join "`r`n")
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor $Ok }
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
        Write-Host ('Για να συνεχίσω, γράψε ακριβώς: {0}' -f $phrase) -ForegroundColor $Warn
        Write-Host '(ή πάτα Enter για να σταματήσω χωρίς αλλαγές)'
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
}

function New-CmdFile([string]$Folder, [string]$Arguments) {
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', 'set WRANGLER_WRITE_LOGS=false', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-sec-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
    [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
    return $cmdFile
}

# Runs wrangler through a temporary .cmd file (plain text output in Windows PowerShell 5.1). The .cmd holds only the
# command: never a secret value. WRANGLER_WRITE_LOGS=false: wrangler keeps no log file of what it printed (a widget's
# secret key, the misnamed secret's name) in <home>\.wrangler\logs. -Retry: network errors and the passing Cloudflare errors 7403 / 10000 (lessons L43).
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
        Say ('Προσωρινό πρόβλημα με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/{2})...' -f (5 * $try), ($try + 1), $tries) $Warn
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

# A secret value goes to wrangler through its standard input only (the .cmd file holds just the command).
function Set-WorkerSecret([string]$Folder, [string]$Worker, [string]$Name, [string]$Value) {
    if ($Name -notmatch '^[A-Z0-9_]+$' -or $Worker -notmatch '^[a-z0-9-]+$') { throw 'Bad secret or Worker name' }
    $cmdFile = New-CmdFile $Folder ('secret put {0} --name {1}' -f $Name, $Worker)
    try {
        $out = @($Value | & $cmdFile)
        $code = $LASTEXITCODE
    } finally {
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    }
    $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
    if ($Value) { $text = $text.Replace($Value, '[κρυφό]') }
    return @{ code = $code; text = $text }
}

# The misnamed secret holds a secret value in its NAME, so even the .cmd file must not have it: wrangler is called
# directly, with no log file, and its output stays in memory (masked before anything is shown).
function Remove-SecretDirect([string]$Folder, [string]$Worker, [string]$Name) {
    $before = @{ CI = $env:CI; WRANGLER_SEND_METRICS = $env:WRANGLER_SEND_METRICS; FORCE_COLOR = $env:FORCE_COLOR; NO_COLOR = $env:NO_COLOR; WRANGLER_WRITE_LOGS = $env:WRANGLER_WRITE_LOGS }
    $oldPref = $ErrorActionPreference
    $here = Get-Location
    try {
        $env:CI = 'true'; $env:WRANGLER_SEND_METRICS = 'false'; $env:FORCE_COLOR = '0'; $env:NO_COLOR = '1'; $env:WRANGLER_WRITE_LOGS = 'false'
        $ErrorActionPreference = 'Continue'
        Set-Location -LiteralPath $Folder
        $out = @(& npx.cmd --yes wrangler secret delete $Name --name $Worker 2>&1)
        $code = $LASTEXITCODE
    } finally {
        Set-Location -LiteralPath $here
        $ErrorActionPreference = $oldPref
        foreach ($k in @($before.Keys)) {
            if ($null -eq $before[$k]) { Remove-Item -Path ('Env:' + $k) -ErrorAction SilentlyContinue }
            else { Set-Item -Path ('Env:' + $k) -Value $before[$k] }
        }
    }
    $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
    return @{ code = $code; text = $text.Replace($Name, ($TurnstilePrefix + [char]0x2026)) }
}

# The JSON array in wrangler's output, as a flat array (Windows PowerShell 5.1 gives an array as ONE object, lessons L76).
function Get-JsonArray([string]$text) {
    $m = [regex]::Match($text, '(?m)^\s*\[')
    $j = $text.LastIndexOf(']')
    if (-not $m.Success -or $j -le $m.Index) { return $null }
    try { $parsed = ConvertFrom-Json -InputObject $text.Substring($m.Index, $j - $m.Index + 1) } catch { return $null }
    $items = New-Object System.Collections.ArrayList
    foreach ($x in @($parsed)) { if ($null -ne $x) { [void]$items.Add($x) } }
    return , $items.ToArray()
}

function Get-JsonObject([string]$text) {
    $i = $text.IndexOf('{')
    $j = $text.LastIndexOf('}')
    if ($i -lt 0 -or $j -le $i) { return $null }
    try { return (ConvertFrom-Json -InputObject $text.Substring($i, $j - $i + 1)) } catch { return $null }
}

# The names of a Worker's secrets (never values): $null when they could not be read.
function Get-SecretNames([string]$Folder, [string]$Worker) {
    $r = Invoke-Wrangler $Folder ('secret list --name {0}' -f $Worker) -Retry
    if ($r.code -ne 0) { return $null }
    $list = Get-JsonArray $r.text
    if ($null -eq $list) { return $null }
    return , @($list | ForEach-Object { [string]$_.name })
}

# The version of a Worker that is live now (for going back), or ''.
function Get-LiveVersion([string]$Folder, [string]$Worker) {
    $r = Invoke-Wrangler $Folder ('deployments list --name {0}' -f $Worker) -Retry
    if ($r.code -ne 0) { return '' }
    $at = $r.text.LastIndexOf('Version(s):')
    if ($at -lt 0) { return '' }
    $ms = [regex]::Matches($r.text.Substring($at), '\((\d+)%\)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($ms.Count -ne 1 -or $ms[0].Groups[1].Value -ne '100') { return '' }
    return $ms[0].Groups[2].Value
}

# The Turnstile widgets of the account (sitekey, name, domains; the list never has secret keys), or $null.
function Get-Widgets([string]$Folder) {
    $r = Invoke-Wrangler $Folder 'turnstile widget list --json' -Retry
    if ($r.code -ne 0) { return $null }
    $list = Get-JsonArray $r.text
    if ($null -eq $list) { return $null }
    # An empty list stays an empty list (not "could not read").
    return , $list
}

function Test-SiteKey([string]$k) { return ($k -match '^[0-9]x[0-9A-Za-z_-]{10,64}$') }
function Test-SecretKey([string]$k) { return ($k -match '^[0-9]x[0-9A-Za-z_-]{20,128}$') }

# Siteverify with a made-up token: a right secret key says "invalid-input-response", a wrong one "invalid-input-secret".
# Only Cloudflare sees the key. 'ok', 'bad' or 'unknown' ('skipped' with -NoHttpCheck).
function Test-TurnstileSecret([string]$secret) {
    if ($NoHttpCheck) { return 'skipped' }
    try {
        $body = 'secret=' + [Uri]::EscapeDataString($secret) + '&response=gw-security-check'
        $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'https://challenges.cloudflare.com/turnstile/v0/siteverify' -ContentType 'application/x-www-form-urlencoded' -Body $body -TimeoutSec 30
        $j = $r.Content | ConvertFrom-Json
        $codes = @($j.'error-codes')
        if ($codes -contains 'invalid-input-secret') { return 'bad' }
        if ($codes -contains 'invalid-input-response') { return 'ok' }
        return 'unknown'
    } catch { return 'unknown' }
}

# A folder with this repo's pinned wrangler (npm ci once per version). wrangler needs no config here: every call names its Worker.
function Prepare-Wrangler {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'wrangler') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        foreach ($item in @('package.json', 'package-lock.json')) { Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Force }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-sec-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
    }
    return $dest
}

# Which secrets of this Worker go: never one that the code reads.
function Get-DeletePlan($worker, [string[]]$names) {
    $plan = @()
    foreach ($n in $names) {
        if ($KeepEverywhere -contains $n) { continue }
        if ($worker.code -eq 'hub' -and $KeepOnHub -contains $n) { continue }
        $misnamed = ($n.StartsWith($TurnstilePrefix) -and $n -ne $TurnstilePrefix -and $n -ne ($TurnstilePrefix + '_2'))
        if ($misnamed) { $plan += @{ name = $n; misnamed = $true }; continue }
        if ($UnusedEverywhere -contains $n) { $plan += @{ name = $n; misnamed = $false }; continue }
        if ($worker.code -ne 'hub' -and $UnusedOnSites -contains $n) { $plan += @{ name = $n; misnamed = $false } }
    }
    return , $plan
}

function Show-Name($item) {
    if ($item.misnamed) { return ($TurnstilePrefix + [char]0x2026 + ' (το όνομα έχει μέσα μυστική τιμή Turnstile: δεν φαίνεται)') }
    return $item.name
}

function Write-Note([string]$prefix, [string[]]$lines) {
    $bdir = Join-Path $WorkDir 'backups'
    if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
    $file = Join-Path $bdir ($prefix + '-' + $stamp + '.txt')
    # Version ids stay whole here (needed to go back); secret values and the misnamed name never.
    [System.IO.File]::WriteAllText($file, (Hide-Secret ($lines -join "`r`n")), (New-Object System.Text.UTF8Encoding($false)))
    return $file
}

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply) { $mode = 'APPLY (με έγκριση)' }
Say ('GEAR WORLD SECURITY FIXES (L106) - step: {0} - {1} - {2}' -f $Step, $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) $Ok
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$wr = Prepare-Wrangler

$who = Invoke-Wrangler $wr 'whoami' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare (ή δεν απάντησε). Στείλε στο Claude αυτό το μήνυμα.' $Bad
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 15)) { Say ('  ' + $line) }
    Finish 4
}
$accounts = @([regex]::Matches($who.text, '\b[0-9a-f]{32}\b') | ForEach-Object { $_.Value } | Select-Object -Unique)
if ($accounts.Count -gt 1 -and -not $env:CLOUDFLARE_ACCOUNT_ID) { Say ('Βρέθηκαν {0} λογαριασμοί Cloudflare. Στείλε στο Claude αυτό το μήνυμα για να διαλέξουμε τον σωστό.' -f $accounts.Count) $Bad; Finish 4 }
Say 'Cloudflare login: ΕΝΤΑΞΕΙ' $Ok

# The secret names of the 14 Workers (read-only)
$names = @{}
$unreadable = @()
foreach ($w in $Workers) {
    $n = Get-SecretNames $wr $w.name
    if ($null -eq $n) { $unreadable += $w.name; $names[$w.name] = @() } else { $names[$w.name] = @($n) }
}
if ($unreadable.Count -gt 0) { Say ('Δεν διάβασα τα μυστικά των Workers: {0} (δίκτυο;). ΠΡΟΣΟΧΗ' -f ($unreadable -join ', ')) $Warn }

# ---------------- check ----------------
if ($Step -eq 'check') {
    Say ''
    Say 'Μυστικά ανά Worker (μόνο ονόματα· οι τιμές δεν διαβάζονται ποτέ):'
    $toDelete = 0
    foreach ($w in $Workers) {
        $all = @($names[$w.name])
        $plan = Get-DeletePlan $w $all
        $toDelete += $plan.Count
        $ts = $(if ($w.code -eq 'hub') { @('TURNSTILE_SECRET_KEY', 'TURNSTILE_SECRET_KEY_2', 'TURNSTILE_SITE_KEY') } else { @('TURNSTILE_SITE_KEY') })
        $haveTs = @($ts | Where-Object { $all -contains $_ })
        Say ('  {0} ({1}): {2} μυστικά. Turnstile: {3}' -f $w.code.ToUpper(), $w.name, $all.Count, $(if ($haveTs.Count -eq $ts.Count) { 'ΕΝΤΑΞΕΙ' } else { 'λείπει (το βήμα turnstile)' }))
        foreach ($p in $plan) { Say ('     - θα σβηστεί: {0}' -f (Show-Name $p)) }
    }
    Say ''
    $widgets = Get-Widgets $wr
    if ($null -eq $widgets) {
        Say 'Turnstile widgets: δεν διαβάζονται με τη σύνδεση του wrangler. Για το βήμα turnstile: μία φορά «npx wrangler login» (ανοίγει τον browser, πατάς Allow), ή -Manual με τον πίνακα του Cloudflare:' $Warn
        Say ('  {0}' -f $DashTurnstile)
    } else {
        Say ('Turnstile widgets στον λογαριασμό: {0}' -f @($widgets).Count)
        foreach ($wd in @($widgets)) { Say ('  - {0} (sitekey {1}): {2}' -f $wd.name, $wd.sitekey, (@($wd.domains) -join ', ')) }
    }
    Say ''
    Say 'Πλάνο (κάθε βήμα με τη δική του φράση):'
    Say ('  1. -Step turnstile ({0}): 2 widgets, «{1}» με {2} και «{3}» με {4}. Το Hub παίρνει TURNSTILE_SECRET_KEY, TURNSTILE_SECRET_KEY_2, TURNSTILE_SITE_KEY· κάθε site TURNSTILE_SITE_KEY. ΠΡΙΝ από τον νέο κώδικα.' -f $Phrases.turnstile, $WidgetNames[1], ($Widget1Hosts -join ', '), $WidgetNames[2], ($Widget2Hosts -join ', '))
    Say ('  2. -Step secrets ({0}): σβήνονται {1} μυστικά που δεν διαβάζει κανένας κώδικας (μετά τον νέο κώδικα).' -f $Phrases.secrets, $toDelete)
    Say ('  3. -Step old-widgets ({0}): τα παλιά widgets των Gear World domains (μετά το βήμα 1).' -f $Phrases['old-widgets'])
    Say ''
    if ($unreadable.Count -gt 0) { Say 'Αποτέλεσμα: ΠΡΟΣΟΧΗ - δεν διάβασα όλους τους Workers (δες πάνω). Δεν άλλαξε τίποτα: ξανατρέξε σε λίγο.' $Warn; Finish 6 }
    Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ - μόνο έλεγχος, δεν άλλαξε τίποτα.' $Ok
    Finish 0
}

# ---------------- turnstile ----------------
if ($Step -eq 'turnstile') {
    $widgets = $null
    if (-not $Manual) {
        $widgets = Get-Widgets $wr
        if ($null -eq $widgets) {
            Say 'Τα Turnstile widgets δεν διαβάζονται με τη σύνδεση του wrangler. ΔΕΝ άλλαξε τίποτα. Δύο δρόμοι:' $Bad
            Say '  α) μία φορά «npx wrangler login» (ανοίγει τον browser, πατάς Allow) και ξανά αυτό το βήμα, ή'
            Say ('  β) φτιάχνεις τα 2 widgets στο {0} και ξανά αυτό το βήμα με -Manual (επικολλάς sitekey και secret key).' -f $DashTurnstile)
            Finish 5
        }
    }
    $found = @{ 1 = $null; 2 = $null }
    foreach ($n in 1, 2) {
        foreach ($wd in @($widgets)) { if ($wd -and [string]$wd.name -eq $WidgetNames[$n]) { $found[$n] = $wd } }
        if ($found[$n]) {
            $want = @($HostsOf[$n] | Sort-Object)
            $have = @(@($found[$n].domains) | ForEach-Object { ([string]$_).ToLowerInvariant() } | Sort-Object)
            if (($want -join ',') -ne ($have -join ',')) {
                Say ('Το widget «{0}» υπάρχει αλλά με άλλα domains ({1}). ΔΕΝ άλλαξε τίποτα: στείλε στο Claude αυτή την αναφορά.' -f $WidgetNames[$n], ($have -join ', ')) $Bad
                Finish 13
            }
        }
    }
    Say ''
    Say 'Τι θα γίνει:'
    foreach ($n in 1, 2) {
        if ($Manual) { Say ('  - Widget «{0}» (το φτιάχνεις εσύ στο {1}, mode Managed) με τα domains: {2}' -f $WidgetNames[$n], $DashTurnstile, ($HostsOf[$n] -join ', ')) }
        elseif ($found[$n]) { Say ('  - Widget «{0}»: υπάρχει ήδη (sitekey {1}): μένει όπως είναι.' -f $WidgetNames[$n], $found[$n].sitekey) }
        else { Say ('  - Νέο widget «{0}» (Managed) με τα domains: {1}' -f $WidgetNames[$n], ($HostsOf[$n] -join ', ')) }
    }
    Say '  - Hub (gear-world-hub): TURNSTILE_SECRET_KEY (widget 1), TURNSTILE_SECRET_KEY_2 (widget 2), TURNSTILE_SITE_KEY (sitekey του widget 1).'
    Say ('  - Τα 13 sites: TURNSTILE_SITE_KEY (η δημόσια sitekey του widget τους). Widget 2: {0}.' -f ($Widget2Hosts -join ', '))
    Say '  - Κάθε secret key ελέγχεται πρώτα με το Cloudflare (Siteverify) και πηγαίνει στο wrangler μόνο από την είσοδό του: δεν φαίνεται, δεν γράφεται σε αρχείο ή αναφορά.'
    Say '  - Κάθε μυστικό φτιάχνει νέα έκδοση του Worker με τον ίδιο κώδικα: ο τωρινός κώδικας δεν τα διαβάζει, άρα τίποτα δεν αλλάζει για τους επισκέπτες μέχρι τον νέο κώδικα.'
    Say '  - Πρώτα σημείωμα με τη ζωντανή έκδοση κάθε Worker (για επαναφορά).'
    Say ('  - Επαναφορά (μόνο με έγκριση): npx wrangler rollback <έκδοση> --name <Worker> (οι εκδόσεις στο σημείωμα), ή npx wrangler secret delete <όνομα> --name <Worker>· τα widgets σβήνονται στο {0}' -f $DashTurnstile)
    if ($unreadable.Count -gt 0) { Say 'Δεν διάβασα όλους τους Workers: ΔΕΝ αλλάζω τίποτα. Ξανατρέξε σε λίγο.' $Bad; Finish 6 }
    if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
    if (-not (Confirm-Approval $Phrases.turnstile)) { Say 'Δεν δόθηκε η σωστή φράση: δεν άλλαξε τίποτα.' $Warn; Finish 1 }

    # 1. The note first: the live version of every Worker.
    $versions = @{}
    foreach ($w in $Workers) {
        $v = Get-LiveVersion $wr $w.name
        if (-not $v) { Say ('Δεν βρήκα τη ζωντανή έκδοση του {0} (χρειάζεται για επαναφορά): ΔΕΝ αλλάζω τίποτα.' -f $w.name) $Bad; Finish 11 }
        $versions[$w.name] = $v
    }
    $noteLines = @(('Gear World before the Turnstile keys (L106), {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')), 'Live version of each Worker before (to go back, only with approval):')
    foreach ($w in $Workers) { $noteLines += ('  npx wrangler rollback {0} --name {1}' -f $versions[$w.name], $w.name) }
    $noteLines += 'Or delete only the new secrets: npx wrangler secret delete TURNSTILE_SITE_KEY --name <Worker> (and on gear-world-hub also TURNSTILE_SECRET_KEY and TURNSTILE_SECRET_KEY_2).'
    $noteLines += ('Widgets: {0}' -f $DashTurnstile)
    $note = Write-Note 'turnstile-before' $noteLines
    Say ('Σημείωμα επαναφοράς: {0}' -f $note) $Ok

    # 2. The two widgets: sitekey (public) and secret key (only in memory).
    $site = @{}
    $secret = @{}
    foreach ($n in 1, 2) {
        if ($Manual) {
            Write-Host ''
            Write-Host ('Widget «{0}» ({1}):' -f $WidgetNames[$n], ($HostsOf[$n] -join ', ')) -ForegroundColor $Warn
            $site[$n] = ([string](Read-Host 'Επικόλλησε τη Sitekey (δημόσια) και πάτα Enter')).Trim()
            $sec = Read-Host 'Επικόλλησε το Secret key (δεν φαίνεται όσο το επικολλάς) και πάτα Enter' -AsSecureString
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
            try { $secret[$n] = ([System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)).Trim() } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
        } elseif ($found[$n]) {
            $g = Invoke-Wrangler $wr ('turnstile widget get {0} --json' -f $found[$n].sitekey) -Retry
            $obj = Get-JsonObject $g.text
            if ($g.code -ne 0 -or $null -eq $obj) { Say ('Δεν διάβασα το widget «{0}». ΔΕΝ μπήκε κανένα κλειδί.' -f $WidgetNames[$n]) $Bad; Finish 7 }
            $site[$n] = [string]$obj.sitekey
            $secret[$n] = [string]$obj.secret
        } else {
            $hostArgs = @($HostsOf[$n] | ForEach-Object { '--domain ' + $_ }) -join ' '
            $c = Invoke-Wrangler $wr ('turnstile widget create "{0}" {1} --mode managed --json' -f $WidgetNames[$n], $hostArgs)
            $obj = Get-JsonObject $c.text
            if ($obj -and $obj.secret) { $script:Hidden.Add([string]$obj.secret) }
            if ($c.code -ne 0 -or $null -eq $obj) {
                Say ('Το widget «{0}» δεν φτιάχτηκε. ΔΕΝ μπήκε κανένα κλειδί. Έξοδος:' -f $WidgetNames[$n]) $Bad
                foreach ($line in @($c.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }
                Finish 7
            }
            $site[$n] = [string]$obj.sitekey
            $secret[$n] = [string]$obj.secret
            Say ('Νέο widget «{0}»: sitekey {1}: ΕΝΤΑΞΕΙ' -f $WidgetNames[$n], $site[$n]) $Ok
        }
        if ($secret[$n]) { $script:Hidden.Add($secret[$n]) }
        if (-not (Test-SiteKey $site[$n]) -or -not (Test-SecretKey $secret[$n])) { Say ('Η sitekey ή το secret key του widget «{0}» δεν έχει τη μορφή του Turnstile. ΔΕΝ μπήκε κανένα κλειδί.' -f $WidgetNames[$n]) $Bad; Finish 8 }
        $tv = Test-TurnstileSecret $secret[$n]
        if ($tv -eq 'bad') { Say ('Το Cloudflare λέει ότι το secret key του widget «{0}» δεν είναι σωστό. ΔΕΝ μπήκε κανένα κλειδί.' -f $WidgetNames[$n]) $Bad; Finish 8 }
        if ($tv -eq 'unknown') { Say ('Δεν μπόρεσα να ελέγξω το secret key του widget «{0}» με το Cloudflare (δίκτυο;). ΔΕΝ μπήκε κανένα κλειδί: ξανατρέξε σε λίγο.' -f $WidgetNames[$n]) $Bad; Finish 8 }
        if ($tv -eq 'skipped') { Say ('Secret key του widget «{0}»: δεν ελέγχθηκε με το Cloudflare (-NoHttpCheck, μόνο για δοκιμές).' -f $WidgetNames[$n]) $Warn }
        else { Say ('Secret key του widget «{0}»: σωστό (έλεγχος με το Cloudflare): ΕΝΤΑΞΕΙ' -f $WidgetNames[$n]) $Ok }
    }

    # 3. The secrets: the Hub first, then the 13 sites. Stops at the first problem.
    $done = New-Object System.Collections.Generic.List[string]
    $jobs = @(
        @{ worker = 'gear-world-hub'; name = 'TURNSTILE_SECRET_KEY'; value = $secret[1] },
        @{ worker = 'gear-world-hub'; name = 'TURNSTILE_SECRET_KEY_2'; value = $secret[2] },
        @{ worker = 'gear-world-hub'; name = 'TURNSTILE_SITE_KEY'; value = $site[1] }
    )
    foreach ($w in $Workers) { if ($w.code -ne 'hub') { $jobs += @{ worker = $w.name; name = 'TURNSTILE_SITE_KEY'; value = $site[$w.widget] } } }
    foreach ($j in $jobs) {
        $r = Set-WorkerSecret $wr $j.worker $j.name $j.value
        if ($r.code -ne 0) {
            Say ('{0} στο {1}: ΠΡΟΒΛΗΜΑ. Σταμάτησα εδώ. Μπήκαν ήδη: {2}' -f $j.name, $j.worker, $(if ($done.Count) { $done -join ', ' } else { 'κανένα' })) $Bad
            foreach ($line in @($r.text -split "`n" | Select-Object -Last 8)) { Say ('  ' + $line) }
            Finish 9
        }
        $done.Add(('{0}/{1}' -f $j.worker, $j.name))
        Say ('  {0} στο {1}: μπήκε: ΕΝΤΑΞΕΙ' -f $j.name, $j.worker) $Ok
    }
    # 4. Check: the names are there now.
    $missing = @()
    foreach ($j in $jobs) {
        $n = Get-SecretNames $wr $j.worker
        if ($null -eq $n -or @($n) -notcontains $j.name) { $missing += ('{0}/{1}' -f $j.worker, $j.name) }
    }
    if ($missing.Count -gt 0) { Say ('Δεν βλέπω ακόμα: {0}. ΠΡΟΣΟΧΗ - στείλε στο Claude αυτή την αναφορά.' -f ($missing -join ', ')) $Warn; Finish 10 }
    Say ''
    Say ('ΕΤΟΙΜΟ: τα κλειδιά Turnstile μπήκαν στους {0} Workers ({1} μυστικά). Επόμενο: ο νέος κώδικας (πρώτα τα 13 sites, μετά το Hub).' -f $Workers.Count, $jobs.Count) $Ok
    Finish 0
}

# ---------------- secrets ----------------
if ($Step -eq 'secrets') {
    Say ''
    Say 'Τι θα γίνει (σβήνονται ΜΟΝΟ μυστικά που δεν διαβάζει κανένας κώδικας αυτής της έκδοσης):'
    $all = @()
    foreach ($w in $Workers) {
        foreach ($p in (Get-DeletePlan $w @($names[$w.name]))) { $all += @{ worker = $w.name; item = $p } }
    }
    if ($all.Count -eq 0) { Say '  Τίποτα να σβήσω: ΕΝΤΑΞΕΙ' $Ok; Finish 0 }
    foreach ($a in $all) { Say ('  - {0}: {1}' -f $a.worker, (Show-Name $a.item)) }
    Say '  - Μένουν: TURNSTILE_SITE_KEY και ADMIN_TOKEN σε όλα, και στο Hub TURNSTILE_SECRET_KEY, TURNSTILE_SECRET_KEY_2, MAILERLITE_API_KEY, PHOTO_LIMIT_SALT, και κάθε όνομα που δεν ξέρω.'
    Say '  - Κάθε σβήσιμο φτιάχνει νέα έκδοση του Worker με τον ίδιο κώδικα. Πρώτα σημείωμα με τη ζωντανή έκδοση κάθε Worker.'
    Say '  - Επαναφορά (μόνο με έγκριση): npx wrangler rollback <έκδοση πριν> --name <Worker> (η έκδοση πριν έχει ακόμα το μυστικό), ή ξανά npx wrangler secret put <όνομα> --name <Worker>. Το μυστικό με το λάθος όνομα δεν ξαναμπαίνει ποτέ.'
    if ($unreadable.Count -gt 0) { Say 'Δεν διάβασα όλους τους Workers: ΔΕΝ αλλάζω τίποτα. Ξανατρέξε σε λίγο.' $Bad; Finish 6 }
    if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
    if (-not (Confirm-Approval $Phrases.secrets)) { Say 'Δεν δόθηκε η σωστή φράση: δεν άλλαξε τίποτα.' $Warn; Finish 1 }
    $versions = @{}
    foreach ($a in $all) {
        if ($versions.ContainsKey($a.worker)) { continue }
        $v = Get-LiveVersion $wr $a.worker
        if (-not $v) { Say ('Δεν βρήκα τη ζωντανή έκδοση του {0} (χρειάζεται για επαναφορά): ΔΕΝ σβήνω τίποτα.' -f $a.worker) $Bad; Finish 11 }
        $versions[$a.worker] = $v
    }
    $noteLines = @(('Gear World secrets before the clean-up (L106), {0}. Only NAMES, never values.' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')))
    foreach ($a in $all) { $noteLines += ('  {0}: {1}' -f $a.worker, (Show-Name $a.item)) }
    $noteLines += 'To go back (only with approval): npx wrangler rollback <version> --name <Worker>'
    foreach ($k in $versions.Keys) { $noteLines += ('  npx wrangler rollback {0} --name {1}' -f $versions[$k], $k) }
    $note = Write-Note 'secrets-before' $noteLines
    Say ('Σημείωμα επαναφοράς: {0}' -f $note) $Ok
    $removed = 0
    foreach ($a in $all) {
        $n = [string]$a.item.name
        if ($a.item.misnamed) {
            if ($n -notmatch '^[A-Za-z0-9_\-\.=]+$') {
                Say ('  {0}: το μυστικό με το λάθος όνομα έχει χαρακτήρες που δεν περνούν με ασφάλεια από τη γραμμή εντολών: σβήσ'' το στο Workers & Pages > {0} > Settings > Variables and Secrets: {1}' -f $a.worker, $DashWorkers) $Warn
                continue
            }
            $r = Remove-SecretDirect $wr $a.worker $n
        } else {
            $r = Invoke-Wrangler $wr ('secret delete {0} --name {1}' -f $n, $a.worker)
        }
        if ($r.code -ne 0) {
            Say ('  {0}: {1}: ΠΡΟΒΛΗΜΑ - δεν σβήστηκε. Σταμάτησα. Έξοδος:' -f $a.worker, (Show-Name $a.item)) $Bad
            foreach ($line in @($r.text -split "`n" | Select-Object -Last 6)) { Say ('    ' + $line) }
            Finish 9
        }
        $removed++
        Say ('  {0}: {1}: σβήστηκε: ΕΝΤΑΞΕΙ' -f $a.worker, (Show-Name $a.item)) $Ok
    }
    # Check: none of them is there any more.
    $left = @()
    foreach ($a in $all) {
        $now = Get-SecretNames $wr $a.worker
        if ($null -ne $now -and @($now) -contains [string]$a.item.name) { $left += ('{0}: {1}' -f $a.worker, (Show-Name $a.item)) }
    }
    if ($left.Count -gt 0) { Say ('Υπάρχουν ακόμα: {0}. ΠΡΟΣΟΧΗ - στείλε στο Claude αυτή την αναφορά.' -f ($left -join '; ')) $Warn; Finish 10 }
    Say ''
    Say ('ΕΤΟΙΜΟ: σβήστηκαν {0} μυστικά που δεν χρησιμοποιούσε κανείς. Επόμενο: -Step old-widgets.' -f $removed) $Ok
    Finish 0
}

# ---------------- old-widgets ----------------
if ($Step -eq 'old-widgets') {
    $widgets = Get-Widgets $wr
    if ($null -eq $widgets) {
        Say ('Τα Turnstile widgets δεν διαβάζονται με τη σύνδεση του wrangler. ΔΕΝ άλλαξε τίποτα. Σβήσε τα παλιά στο {0} (όχι τα «{1}» και «{2}»), ή μία φορά «npx wrangler login» και ξανά αυτό το βήμα.' -f $DashTurnstile, $WidgetNames[1], $WidgetNames[2]) $Warn
        Finish 5
    }
    $ours = @(@($widgets) | Where-Object { $_ -and ([string]$_.name -eq $WidgetNames[1] -or [string]$_.name -eq $WidgetNames[2]) } | ForEach-Object { [string]$_.sitekey })
    if ($ours.Count -lt 2) { Say ('Πρώτα το -Step turnstile ({0}): τα νέα widgets δεν υπάρχουν ακόμα. ΔΕΝ άλλαξε τίποτα.' -f $Phrases.turnstile) $Bad; Finish 8 }
    $gw = @($Widget1Hosts + $Widget2Hosts)
    $old = @()
    $mixed = @()
    foreach ($wd in @($widgets)) {
        if (-not $wd -or $ours -contains [string]$wd.sitekey) { continue }
        $hosts = @(@($wd.domains) | ForEach-Object { ([string]$_).ToLowerInvariant() -replace '^www\.', '' })
        $hit = @($hosts | Where-Object { $gw -contains $_ })
        $other = @($hosts | Where-Object { $gw -notcontains $_ })
        # A widget that also serves another site is not ours to delete.
        if ($hit.Count -gt 0 -and $other.Count -eq 0) { $old += $wd }
        elseif ($hit.Count -gt 0) { $mixed += $wd }
    }
    Say ''
    Say 'Τι θα γίνει:'
    foreach ($wd in $mixed) { Say ('  - ΔΕΝ σβήνεται «{0}» (sitekey {1}): έχει και άλλα domains ({2}). Αν δεν το χρειάζεσαι, σβήσ'' το στο {3}' -f $wd.name, $wd.sitekey, (@($wd.domains) -join ', '), $DashTurnstile) $Warn }
    if ($old.Count -eq 0) { Say '  Κανένα παλιό widget μόνο με Gear World domains: τίποτα να σβήσω: ΕΝΤΑΞΕΙ' $Ok; Finish 0 }
    foreach ($wd in $old) { Say ('  - σβήνεται το παλιό widget «{0}» (sitekey {1}): {2}' -f $wd.name, $wd.sitekey, (@($wd.domains) -join ', ')) }
    Say ('  - Μένουν: «{0}» και «{1}».' -f $WidgetNames[1], $WidgetNames[2])
    Say '  - Το σβήσιμο ενός widget δεν γυρίζει πίσω: το secret key του σταματά να ισχύει (έτσι και το κλειδί που είχε μπει σε όνομα μυστικού στο Garden, F07). Κανένας κώδικας αυτής της έκδοσης δεν τα χρησιμοποιεί.'
    if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
    if (-not (Confirm-Approval $Phrases['old-widgets'])) { Say 'Δεν δόθηκε η σωστή φράση: δεν άλλαξε τίποτα.' $Warn; Finish 1 }
    $noteLines = @(('Old Turnstile widgets before deleting them (L106), {0}. Public data only.' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')))
    foreach ($wd in $old) { $noteLines += ('  {0} | {1} | {2}' -f $wd.name, $wd.sitekey, (@($wd.domains) -join ' ')) }
    $noteLines += ('A deleted widget cannot come back; a new one can be made at {0}' -f $DashTurnstile)
    $note = Write-Note 'old-widgets-before' $noteLines
    Say ('Σημείωμα: {0}' -f $note) $Ok
    foreach ($wd in $old) {
        $sk = [string]$wd.sitekey
        if (-not (Test-SiteKey $sk)) { Say ('  «{0}»: παράξενη sitekey, δεν το σβήνω.' -f $wd.name) $Warn; continue }
        $r = Invoke-Wrangler $wr ('turnstile widget delete {0} --skip-confirmation' -f $sk)
        if ($r.code -ne 0) { Say ('  «{0}»: ΠΡΟΒΛΗΜΑ - δεν σβήστηκε. Σταμάτησα.' -f $wd.name) $Bad; Finish 9 }
        Say ('  «{0}»: σβήστηκε: ΕΝΤΑΞΕΙ' -f $wd.name) $Ok
    }
    Say ''
    Say ('ΕΤΟΙΜΟ: σβήστηκαν {0} παλιά widgets του Gear World. Μένουν «{1}» και «{2}».' -f $old.Count, $WidgetNames[1], $WidgetNames[2]) $Ok
    Finish 0
}
