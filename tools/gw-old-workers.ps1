<#
.SYNOPSIS
  Gear World - old Workers: which ones can go, and (only with the approval phrase) delete them.

.DESCRIPTION
  -Step check   READ-ONLY. For each Worker of the fixed list below: does it exist, last deploy, custom domains,
                routes, workers.dev address, cron triggers, who uses it (service bindings, tail consumers, Durable
                Objects, queues, Pages, and the check wrangler itself makes before a delete), requests in the last
                7 days. "safe" only when nothing sends visitors to it and nothing uses it. If something cannot be
                read, the Worker stays ("keep"). It reads the Cloudflare settings with the login wrangler already
                has; the login is never shown or saved.
  -Step delete  CHANGES CLOUDFLARE, one approval: ΕΓΚΡΙΝΩ ΔΙΑΓΡΑΦΗ ΠΑΛΙΩΝ WORKERS. The same check first; then ONLY for
                the "safe" Workers: a backup of each (code, settings, deployments), then the delete with force=false,
                so Cloudflare itself refuses a Worker that something still uses. Each Worker is checked once more
                right before its delete.
                Never: gwh-sitemap, gear-world-hub, gear-world-group or any live site Worker (they are not on the list).
  -Only         Optional, comma separated: only these Workers of the list.
  Report: <home>\gear-world-reports\GW_OLD_WORKERS_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'delete')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Only = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ ΔΙΑΓΡΑΦΗ ΠΑΛΙΩΝ WORKERS'
# The old Workers (exact names, never a pattern) and what each one was.
$List = [ordered]@{
    'gw-ml-isolated-hub-test'      = 'παλιά δοκιμή (11/10/2026)'
    'gw-ml-isolated-client-test'   = 'παλιά δοκιμή (11/10/2026)'
    'constraction-gear-uk'         = 'παλιό αντίγραφο με λάθος γράμμα (24/08/2026). Ο κανονικός construction-gear-uk ΜΕΝΕΙ'
    'construction-gear-uk-preview' = 'δοκιμαστική διεύθυνση του Construction Gear World (το site τρέχει ήδη τη νέα μηχανή)'
    'mens-gear-world-preview'      = "δοκιμαστική διεύθυνση του Men's Gear World (το site τρέχει ήδη τη νέα μηχανή)"
    'womens-gear-world-preview'    = "δοκιμαστική διεύθυνση του Women's Gear World (το site τρέχει ήδη τη νέα μηχανή)"
    'home-gear-world-preview'      = 'δοκιμαστική διεύθυνση του Home Gear World (το site τρέχει ήδη τη νέα μηχανή)'
    'garden-gear-world-preview'    = 'δοκιμαστική διεύθυνση του Garden Gear World (το site τρέχει ήδη τη νέα μηχανή)'
    'gear-world-hub-preview'       = 'δοκιμαστική διεύθυνση του Hub (το βήμα preview του gwh-photo τη φτιάχνει ξανά όταν χρειαστεί)'
}
# Never deleted, and never accepted as a candidate by tools/gw-old-workers.mjs either.
$Protected = @('gwh-sitemap', 'gear-world-hub', 'gear-world-group', 'construction-gear-uk', 'mens-gear-world', 'womens-gear-world',
    'kids-gear-world', 'home-gear-world', 'garden-gear-world', 'technology-gear-world', 'car-gear-world', 'travel-gear-world')
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-old-workers' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$mjs = Join-Path (Join-Path $repo 'tools') 'gw-old-workers.mjs'

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
    $file = Join-Path $OutDir ('GW_OLD_WORKERS_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('GW_OLD_WORKERS_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = Hide-Ids ($L -join "`r`n")
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
    $given = @()
    if ($Approve) { $given = @($Approve -split ';') }
    else {
        Write-Host ''
        Write-Host ('Για να συνεχίσω, γράψε ακριβώς: {0}' -f $phrase) -ForegroundColor Yellow
        Write-Host '(ή πάτα Enter για να σταματήσω χωρίς αλλαγές)'
        $given = @(Read-Host 'Έγκριση')
    }
    foreach ($g in $given) { if ((Normalize-Phrase $g) -eq (Normalize-Phrase $phrase)) { return $true } }
    return $false
}

# Runs a command through a temporary .cmd file, so the output is plain text in Windows PowerShell 5.1.
function Invoke-Cmd([string]$Folder, [string]$Line, [switch]$Retry) {
    if ($Line -match '[&|<>^%]') { throw 'Unsafe characters in the command' }
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', 'set NODE_NO_WARNINGS=1', ('call {0} 2>&1' -f $Line))
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-oldworkers-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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
        Say ('Πρόβλημα δικτύου με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα...' -f (5 * $try)) 'Yellow'
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

# The helper tools/gw-old-workers.mjs, with the Cloudflare login only in its environment (never in a file or on screen).
function Invoke-Helper([string]$Arguments) {
    $env:GW_CF_TOKEN = $script:token
    try {
        $r = Invoke-Cmd $tools ('node "{0}" {1}' -f $mjs, $Arguments)
    } finally {
        Remove-Item Env:\GW_CF_TOKEN -ErrorAction SilentlyContinue
    }
    $i = $r.text.IndexOf('{')
    $j = $r.text.LastIndexOf('}')
    $data = $null
    if ($i -ge 0 -and $j -gt $i) { try { $data = $r.text.Substring($i, $j - $i + 1) | ConvertFrom-Json } catch { $data = $null } }
    return @{ code = $r.code; data = $data }
}

function Join-Or([object[]]$items, [string]$none) {
    $x = @($items | Where-Object { $_ })
    if ($x.Count -eq 0) { return $none }
    return ($x -join ', ')
}

# ---------------- start ----------------
Say ('GW OLD WORKERS - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }

$names = @($List.Keys)
if ($Only) {
    $names = @()
    foreach ($n in @($Only -split ',')) {
        $n = $n.Trim()
        if (-not $n) { continue }
        if (-not $List.Contains($n)) { Say ('Ο Worker "{0}" δεν είναι στη λίστα των παλιών Workers: δεν τον αγγίζω.' -f $n) 'Red'; Finish 2 }
        $names += $n
    }
}
foreach ($n in $names) { if ($Protected -contains $n) { Say ('Ο Worker "{0}" προστατεύεται: δεν τον αγγίζω.' -f $n) 'Red'; Finish 2 } }

# wrangler of this repo version (for the login only)
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
$tools = Join-Path (Join-Path $WorkDir 'tools') $ver
if (-not (Test-Path -LiteralPath (Join-Path $tools 'package.json'))) {
    New-Item -ItemType Directory -Path $tools -Force | Out-Null
    foreach ($item in @('package.json', 'package-lock.json')) { Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $tools -Force }
}
if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $tools 'node_modules'))) {
    Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
    $ci = Invoke-Cmd $tools 'npm ci --no-audit --no-fund'
    if ($ci.code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
}
$who = Invoke-Cmd $tools 'npx --yes wrangler whoami' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red'
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: OK'
# The login of wrangler, for reading the settings. Never printed: only "OK" or not.
$auth = Invoke-Cmd $tools 'npx --yes wrangler auth token --json' -Retry
$script:token = ''
$ai = $auth.text.IndexOf('{')
$aj = $auth.text.LastIndexOf('}')
if ($auth.code -eq 0 -and $ai -ge 0 -and $aj -gt $ai) {
    try { $script:token = [string](($auth.text.Substring($ai, $aj - $ai + 1) | ConvertFrom-Json).token) } catch { $script:token = '' }
}
$auth = $null
if (-not $script:token) { Say 'Δεν μπόρεσα να διαβάσω τη σύνδεση του wrangler. Δεν άλλαξε τίποτα. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 4 }

# ---------------- check (read-only) ----------------
$cands = ($names -join ',')
$prot = ($Protected -join ',')
Say ''
Say 'Ελέγχω τους παλιούς Workers (μόνο ανάγνωση: domains, routes, cron, ποιος τους χρησιμοποιεί, κίνηση)...'
$chk = Invoke-Helper ('check "{0}" "{1}"' -f $cands, $prot)
if ($chk.code -ne 0 -or $null -eq $chk.data -or $chk.data.error) {
    Say 'Ο έλεγχος δεν ολοκληρώθηκε. Δεν άλλαξε τίποτα. Στείλε στο Claude αυτό το μήνυμα:' 'Red'
    if ($chk.data -and $chk.data.error) { Say ('  ' + [string]$chk.data.error) }
    Finish 5
}
$safe = @()
$i = 0
foreach ($w in @($chk.data.workers)) {
    $i++
    Say ''
    Say ('{0}. {1}: {2}' -f $i, $w.name, $List[[string]$w.name])
    $status = [string]$w.verdict.status
    if ($status -eq 'missing') { Say '   ⚪ ΔΕΝ ΥΠΑΡΧΕΙ ΗΔΗ (τίποτα να σβηστεί)'; continue }
    if ($status -eq 'safe') { Say '   🟢 ΑΣΦΑΛΕΣ ΝΑ ΣΒΗΣΤΕΙ: τίποτα δεν τον χρησιμοποιεί και τίποτα δεν στέλνει επισκέπτες σε αυτόν' 'Green'; $safe += [string]$w.name }
    else { Say '   🟡 ΜΕΝΕΙ: κάτι τον χρησιμοποιεί ή δεν μπόρεσα να το ελέγξω' 'Yellow' }
    $last = [string]$w.lastDeploy
    if ($last.Length -ge 10) { $last = $last.Substring(0, 10) }
    $req = $(if ($null -eq $w.requests7d) { 'δεν φαίνονται' } else { [string]$w.requests7d })
    $dev = $(if ($null -eq $w.workersDev) { '?' } elseif ($w.workersDev) { 'ναι' } else { 'όχι' })
    Say ('   τελευταίο deploy: {0} · διεύθυνση workers.dev: {1} · αιτήματα 7 ημερών: {2}' -f $(if ($last) { $last } else { '?' }), $dev, $req)
    Say ('   δικά του domains: {0} · routes: {1} · cron: {2}' -f (Join-Or @($w.domains) 'κανένα'), (Join-Or @($w.routes) 'κανένα'), (Join-Or @($w.crons) 'κανένα'))
    Say ('   τον χρησιμοποιεί: {0}' -f (Join-Or @($w.usedBy) 'κανείς'))
    if (@($w.checksFailed).Count) { Say ('   δεν μπόρεσα να ελέγξω: {0}' -f (Join-Or @($w.checksFailed) '')) 'Yellow' }
    if (@($w.kvLeftover).Count) { Say ('   παλιός χώρος KV του (Workers Sites): {0}. ΔΕΝ σβήνεται εδώ.' -f (Join-Or @($w.kvLeftover) '')) }
}
foreach ($note in @($chk.data.notes)) {
    if ([string]$note -match 'requests of the last 7 days') { Say ''; Say 'Σημείωση: τα αιτήματα 7 ημερών δεν φαίνονται με τη σύνδεση του wrangler. Ο έλεγχος στηρίζεται στα domains, routes, cron και στο ποιος τους χρησιμοποιεί.' }
    elseif ($note) { Say ('Σημείωση: ' + [string]$note) }
}
Say ''
Say ('Ασφαλείς να σβηστούν: {0} από {1}' -f $safe.Count, @($chk.data.workers).Count)

if ($Step -eq 'check') {
    Say ''
    Say 'Μόνο έλεγχος: δεν άλλαξε τίποτα.' 'Green'
    Finish 0
}

# ---------------- delete (only with the phrase) ----------------
Say ''
if ($safe.Count -eq 0) { Say 'Τίποτα να σβήσω: κανένας Worker δεν είναι ασφαλής να σβηστεί.' 'Green'; Finish 0 }
Say ('Τι θα γίνει (φράση {0}):' -f $Phrase)
Say '  1. Αντίγραφο ασφαλείας κάθε Worker (κώδικας, ρυθμίσεις, deploys) στον φάκελο αντιγράφων.'
Say ('  2. Σβήνονται ΜΟΝΟ: {0}' -f ($safe -join ', '))
Say '     Πριν από κάθε έναν γίνεται ξανά ο έλεγχος. Το Cloudflare αρνείται μόνο του αν κάτι τον χρησιμοποιεί ακόμα.'
Say '  Τα live sites, το Hub, το Group και ο gwh-sitemap ΔΕΝ αλλάζουν.'
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

$bdir = Join-Path (Join-Path $WorkDir 'backups') ('old-workers-' + $stamp)
New-Item -ItemType Directory -Path $bdir -Force | Out-Null
foreach ($n in $safe) {
    $b = Invoke-Helper ('backup {0} "{1}"' -f $n, (Join-Path $bdir $n))
    if ($b.code -ne 0 -or $null -eq $b.data -or $b.data.error -or @($b.data.saved).Count -eq 0) {
        Say ('Το αντίγραφο ασφαλείας του "{0}" δεν γράφτηκε: ΔΕΝ σβήνω τίποτα.' -f $n) 'Red'
        if ($b.data -and $b.data.error) { Say ('  ' + [string]$b.data.error) }
        Finish 11
    }
    Say ('Αντίγραφο ασφαλείας του {0}: {1}' -f $n, (@($b.data.saved) -join ', ')) 'Green'
}
$note = @(
    ('Gear World old Workers deleted on {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    ('Backups (code, settings, deployments): {0}' -f $bdir),
    'A deleted Worker cannot be brought back by Cloudflare. To make one again, Claude deploys it from its backup.',
    'The *-preview test addresses are made again by the preview step of each site tool, when needed.'
) -join "`r`n"
[System.IO.File]::WriteAllText((Join-Path $bdir 'README.txt'), $note, (New-Object System.Text.UTF8Encoding($false)))

$failed = 0
foreach ($n in $safe) {
    $d = Invoke-Helper ('delete {0} "{1}" "{2}"' -f $n, $cands, $prot)
    if ($d.code -eq 0 -and $d.data -and $d.data.deleted) { Say ('Σβήστηκε: {0}' -f $n) 'Green' }
    elseif ($d.code -eq 0 -and $d.data -and $d.data.missing) { Say ('Δεν υπάρχει ήδη: {0}' -f $n) }
    else {
        $failed++
        Say ('ΔΕΝ σβήστηκε: {0}' -f $n) 'Red'
        if ($d.data -and $d.data.error) { Say ('  ' + [string]$d.data.error) }
    }
}
Say ''
Say ('Αντίγραφα ασφαλείας: {0}' -f $bdir)
if ($failed) { Say ('{0} Workers δεν σβήστηκαν (δες πιο πάνω). Τίποτα άλλο δεν άλλαξε.' -f $failed) 'Yellow'; Finish 9 }
Say 'ΕΤΟΙΜΟ: οι παλιοί Workers σβήστηκαν. Τα live sites, το Hub και ο gwh-sitemap δεν άλλαξαν.' 'Green'
Finish 0
