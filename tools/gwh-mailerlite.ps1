<#
.SYNOPSIS
  Gear World email, step 5a: the email sign-ups of gearworldhub.com go to MailerLite.
  Read-only unless -Step preview/live/remove-preview with -Apply and the typed approval phrase.

.DESCRIPTION
  The change (5 files of the Hub, a D1 migration and a cron):
    mailerlite.js             NEW: /api/subscribe writes the sign-up into the Hub D1 FIRST (never lost), then adds it to
                              MailerLite (group "Gear World subscribers", field source_site). If MailerLite does not
                              answer, the row stays 'pending' and the cron sends it again. 5 sign-up attempts an hour per
                              visitor (anonymous daily code, the IP is never stored). On the test address it writes nothing.
    worker.js                 sends /api/subscribe to mailerlite.js and runs the cron (scheduled)
    public/email-signup.js    the form texts in 11 languages: weekly deals, consent incl. open/click tracking (ICO)
    public/index.html         the same texts in the page, new version of email-signup.js
    public/privacy/index.html MailerLite, open/click tracking and the anonymous sign-up count
    D1 gear-world-registry    migration 0002: 4 new columns in hub_subscribers (the older sign-ups get ml_status 'hold':
                              they go to MailerLite only with email step 6), one index, the table subscribe_usage
    wrangler.toml on the PC   [triggers] crons = ["*/10 * * * *"]
  The 13 sites, their D1 databases and the other Workers do NOT change.

  -Step check           READ-ONLY. Hub folder on this PC and gearworldhub.com still the version of live-baseline.txt?
                        Cloudflare login, live version (for going back), the secret MAILERLITE_API_KEY, the D1 table
                        (columns, number of sign-ups; never the addresses), the cron in wrangler.toml. Shows the plan.
  -Step preview         CHANGES CLOUDFLARE (the test Worker only), approval: ΕΓΚΡΙΝΩ MAILERLITE SITES. The test Worker
                        "gear-world-hub-preview" (*.workers.dev, noindex) gets this version, without poster counting and
                        without the cron. Its sign-up form answers but writes and sends nothing. gearworldhub.com does
                        NOT change.
  -Step live            CHANGES THE LIVE HUB AND ITS D1, approval: ΕΓΚΡΙΝΩ MAILERLITE SITES. Zip of the hub folder,
                        the live version and a D1 Time Travel restore point first; then the D1 migration, the 5 files and
                        the cron into the hub folder, the deploy, and the checks. If the deploy fails, the hub folder goes
                        back as it was (the new D1 columns stay: they change nothing for the old code).
  -Step remove-preview  CHANGES CLOUDFLARE (the test Worker only), approval: ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW. Deletes the test
                        Worker (owner, 29/10/2026: no test address is left running after a live update).
  Report: <home>\gear-world-reports\GWH_MAILERLITE_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'preview', 'live', 'remove-preview')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$HubDir = '',
    [string]$WorkDir = '',
    [string]$BaselineFile = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard,
    [switch]$NoHttpCheck
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$HubWorker = 'gear-world-hub'
$PreviewName = 'gear-world-hub-preview'
$DbName = 'gear-world-registry'
$SecretName = 'MAILERLITE_API_KEY'
$PhraseChange = 'ΕΓΚΡΙΝΩ MAILERLITE SITES'
$PhraseRemovePreview = 'ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW'
$Cron = '*/10 * * * *'
$ScriptVersion = '/email-signup.js?v=20261102-mailerlite-1'
$Migration = 'migrations/0002_mailerlite_sync.sql'
$LiveUrl = 'https://gearworldhub.com'
if (-not $HubDir) { $HubDir = Join-Path $HOME 'gear-world-hub' }
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-mailerlite' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$sep = [System.IO.Path]::DirectorySeparatorChar
# Colours without red and green (lessons L35): cyan = OK, yellow = attention, magenta = problem.
$Ok = 'Cyan'
$Warn = 'Yellow'
$Bad = 'Magenta'

# The files of this change, and what each one does (in the words of the report). Any other difference stops the tool.
$About = [ordered]@{
    'mailerlite.js'             = 'ΝΕΟ: η εγγραφή γράφεται πρώτα στη D1 του Hub και μετά πάει στο MailerLite (group «Gear World subscribers», πεδίο source_site); αν το MailerLite δεν απαντήσει, ξαναστέλνεται κάθε 10 λεπτά; 5 εγγραφές την ώρα ανά επισκέπτη'
    'worker.js'                 = 'στέλνει το /api/subscribe στο mailerlite.js και τρέχει το cron'
    'public/email-signup.js'    = 'νέα κείμενα της φόρμας σε 11 γλώσσες (προσφορές της εβδομάδας, συγκατάθεση και για το άνοιγμα/κλικ)'
    'public/index.html'         = 'τα ίδια κείμενα στη σελίδα και η νέα έκδοση του email-signup.js'
    'public/privacy/index.html' = 'Privacy: MailerLite, άνοιγμα/κλικ των email, ανώνυμη μέτρηση εγγραφών'
}

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
    $file = Join-Path $OutDir ('GWH_MAILERLITE_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('GWH_MAILERLITE_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = Hide-Ids ($L -join "`r`n")
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
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-mlhub-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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

function Get-Sha([byte[]]$bytes) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
}

function Local-Path([string]$root, [string]$rel) { return (Join-Path $root ($rel.Replace('/', $sep))) }

function Get-FileSha([string]$path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return '' }
    return (Get-Sha ([System.IO.File]::ReadAllBytes($path)))
}

# Copy of this repo version, ready for wrangler (npm ci once per version, so the wrangler version is fixed).
function Prepare-Deploy {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path (Join-Path $dest 'sites') -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path (Join-Path $repo 'sites') 'gwh') -Destination (Join-Path $dest 'sites') -Recurse -Force
        foreach ($item in @('package.json', 'package-lock.json')) { Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Force }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-mlhub-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
    }
    return $dest
}

# Reads a page or file like a browser (or sends JSON with -Body): @{ status; bytes; text }. status 0 = no answer.
function Get-Web([string]$url, [string]$Body = '') {
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.UserAgent = 'GearWorldQA-bot/1.0 (+read-only check)'
        $req.Accept = '*/*'
        $req.Timeout = 30000
        if ($Body) {
            $req.Method = 'POST'
            $req.ContentType = 'application/json'
            $data = (New-Object System.Text.UTF8Encoding($false)).GetBytes($Body)
            $req.ContentLength = $data.Length
            $s = $req.GetRequestStream()
            try { $s.Write($data, 0, $data.Length) } finally { $s.Close() }
        }
        $resp = $req.GetResponse()
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if (-not $resp) { return @{ status = 0; bytes = (New-Object byte[] 0); text = '' } }
    } catch {
        return @{ status = 0; bytes = (New-Object byte[] 0); text = '' }
    }
    try {
        $ms = New-Object System.IO.MemoryStream
        $resp.GetResponseStream().CopyTo($ms)
        $bytes = $ms.ToArray()
        return @{ status = [int]$resp.StatusCode; bytes = $bytes; text = (New-Object System.Text.UTF8Encoding($false)).GetString($bytes) }
    } finally { $resp.Close() }
}

function Get-UrlPath([string]$rel) {
    $p = $rel.Substring(7)
    if ($p -eq 'index.html') { return '/' }
    if ($p -match '/index\.html$') { return ('/' + $p.Substring(0, $p.Length - 10)) }
    return ('/' + $p)
}

# sha256 of a live file as the Worker sends it: 'missing' for 404, 'error' when it could not be read.
# Cloudflare Web Analytics adds its own beacon script to HTML for some visitors (lessons L71): it is taken out first.
function Get-LiveSha([string]$url, [bool]$isHtml) {
    $w = Get-Web $url
    if ($w.status -eq 404) { return 'missing' }
    if ($w.status -ne 200) { return 'error' }
    $bytes = $w.bytes
    if ($isHtml) {
        $enc = New-Object System.Text.UTF8Encoding($false)
        $text = $enc.GetString($bytes)
        $clean = [regex]::Replace($text, '<script[^>]*static\.cloudflareinsights\.com/beacon\.min\.js[^>]*></script>\r?\n?', '')
        if ($clean -ne $text) { $bytes = $enc.GetBytes($clean) }
    }
    return (Get-Sha $bytes)
}

# Deploy; when Cloudflare answers "This Worker does not exist" (code 10007) right after an upload, wait and deploy
# once more: a deploy is safe to repeat (lessons L72). Any other error is not repeated.
function Invoke-Deploy([string]$folder, [string]$config) {
    $d = Invoke-Wrangler $folder ('deploy --config "{0}"' -f $config)
    if ($d.code -ne 0 -and $d.text -match 'code: 10007') {
        Say 'Το Cloudflare δεν απάντησε σωστά στο ανέβασμα. Ξαναδοκιμάζω σε 15 δευτερόλεπτα...' $Warn
        Start-Sleep -Seconds 15
        $d = Invoke-Wrangler $folder ('deploy --config "{0}"' -f $config)
    }
    return $d
}

# The version of the Worker that is live now (for going back): ONE version with 100% of the visitors.
function Get-LiveVersion([string]$folder, [string]$name) {
    $r = Invoke-Wrangler $folder ('deployments list --name {0}' -f $name) -Retry
    if ($r.code -ne 0) { return '' }
    $at = $r.text.LastIndexOf('Version(s):')
    if ($at -lt 0) { return '' }
    $ms = [regex]::Matches($r.text.Substring($at), '\((\d+)%\)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($ms.Count -ne 1 -or $ms[0].Groups[1].Value -ne '100') { return '' }
    return $ms[0].Groups[2].Value
}

# The preview config from the template: its own Worker name, workers.dev, GWH_PREVIEW = "1", WITHOUT the POSTERS
# line and WITHOUT the cron. Never the live name.
function Write-PreviewConfig([string]$folder, [string]$dbId) {
    $text = [System.IO.File]::ReadAllText((Join-Path $folder 'wrangler.toml.example'))
    if ($text -notmatch '(?m)^name = "gear-world-hub"\r?$' -or $text.IndexOf('REPLACE_WITH_DATABASE_ID') -lt 0 -or $text -notmatch '(?m)^compatibility_date = ') {
        Say 'Το πρότυπο wrangler.toml.example δεν έχει τη μορφή που περίμενα: ΔΕΝ ανέβασα τίποτα.' $Bad; Finish 13
    }
    $text = $text.Replace('REPLACE_WITH_DATABASE_ID', $dbId)
    $text = [regex]::Replace($text, '(?m)^name = "gear-world-hub"(\r?)$', ('name = "{0}"$1' -f $PreviewName))
    # The template has "workers_dev = false" (live Hub, F04, lessons L106): the test Worker gets workers.dev instead (one key).
    $text = [regex]::Replace($text, '(?m)^(workers_dev|preview_urls) = (true|false)\r?\n', '')
    $text = [regex]::Replace($text, '(?m)^(compatibility_date = [^\r\n]+)', ('$1' + "`nworkers_dev = true"))
    $text = [regex]::Replace($text, '(?m)^\[\[services\]\]\r?\nbinding = "POSTERS"\r?\nservice = "[^"]+"\r?\n?', '')
    $text = [regex]::Replace($text, '(?m)^\[triggers\]\r?\ncrons = \[[^\r\n]*\]\r?\n?', '')
    $text = $text.TrimEnd() + "`n`n[vars]`nGWH_PREVIEW = `"1`"`n"
    if ($text -match '(?m)^name = "gear-world-hub"\r?$' -or $text -notmatch ('(?m)^name = "{0}"' -f $PreviewName) -or $text -match 'binding = "POSTERS"' -or $text -match '(?m)^crons') { Say 'Λάθος ρύθμιση για το preview: ΔΕΝ ανέβασα τίποτα.' $Bad; Finish 13 }
    $file = Join-Path $folder 'wrangler.preview.toml'
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($false)))
    return $file
}

# The secret for the anonymous visitor code of the photo search on the test Worker: random, never shown or kept.
function Set-PreviewSecret([string]$folder) {
    $rnd = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($rnd) } finally { $rng.Dispose() }
    $salt = [Convert]::ToBase64String($rnd).Replace('+', '-').Replace('/', '_').TrimEnd('=')
    $secretFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-mlhub-secret-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.json')
    [System.IO.File]::WriteAllText($secretFile, ('{{"PHOTO_LIMIT_SALT":"{0}"}}' -f $salt), (New-Object System.Text.UTF8Encoding($false)))
    try {
        return (Invoke-Wrangler $folder ('secret bulk "{0}" --name {1}' -f $secretFile, $PreviewName))
    } finally {
        Remove-Item -LiteralPath $secretFile -Force -ErrorAction SilentlyContinue
    }
}

# The new form texts and privacy page, and the new /api/subscribe, on the test address or on gearworldhub.com.
function Test-Site([string]$base, [bool]$isLive) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $page = Get-Web ($base + '/?gwcheck=' + $stamp)
    if ($page.status -eq 200 -and $page.text.Contains($ScriptVersion) -and $page.text.Contains('WEEKLY DEALS')) { Say '  Η αρχική με τη νέα φόρμα («WEEKLY DEALS»): ΕΝΤΑΞΕΙ' $Ok }
    else { Say ('  Η αρχική με τη νέα φόρμα: ΠΡΟΣΟΧΗ - δεν τη βλέπω ακόμα (απάντηση {0}, cache;)' -f $page.status) $Warn }
    $pv = Get-Web ($base + '/privacy/?gwcheck=' + $stamp)
    if ($pv.status -eq 200 -and $pv.text.Contains('MailerLite')) { Say '  Privacy με το MailerLite: ΕΝΤΑΞΕΙ' $Ok }
    else { Say ('  Privacy με το MailerLite: ΠΡΟΣΟΧΗ (απάντηση {0})' -f $pv.status) $Warn }
    if ($isLive) {
        # A GET is answered by the new code with 405 (the old code gave the files): proves the route, writes nothing.
        $g = Get-Web ($base + '/api/subscribe?gwcheck=' + $stamp)
        if ($g.status -eq 405 -and $g.text.Contains('method_not_allowed')) { Say '  Νέα εγγραφή (/api/subscribe) στο live: ΕΝΤΑΞΕΙ' $Ok }
        else { Say ('  Νέα εγγραφή (/api/subscribe): ΠΡΟΒΛΗΜΑ - απάντηση {0}' -f $g.status) $Bad }
    } else {
        # The test address answers like the live Hub but writes nothing (example.com is never a real subscriber).
        $p = Get-Web ($base + '/api/subscribe') '{"email":"preview-check@example.com","locale":"en-GB","consent":true,"consent_version":"2026-11-02","source":"hub","website":""}'
        if ($p.status -eq 200 -and $p.text -match '"preview"\s*:\s*true') { Say '  Η φόρμα της δοκιμαστικής απαντά χωρίς να γράφει ή να στέλνει τίποτα: ΕΝΤΑΞΕΙ' $Ok }
        else { Say ('  Η φόρμα της δοκιμαστικής: ΠΡΟΒΛΗΜΑ - απάντηση {0}' -f $p.status) $Bad }
    }
}

# ---------------- start ----------------
Say ('GWH MAILERLITE (email βήμα 5α) - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) $Ok
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }

# ---------------- remove-preview: the test Worker goes (owner, 29/10/2026) ----------------
if ($Step -eq 'remove-preview') {
    Say ''
    Say 'Τι θα γίνει:'
    Say ('  - Σβήνεται ΜΟΝΟ ο δοκιμαστικός Worker "{0}" (η διεύθυνση *.workers.dev παύει να ανοίγει).' -f $PreviewName)
    Say ('  - Το gearworldhub.com, ο Worker "{0}", η D1 και τα sites ΔΕΝ αλλάζουν.' -f $HubWorker)
    if ($PreviewName -eq $HubWorker -or $PreviewName -notmatch '-preview$') { Say 'Λάθος όνομα δοκιμαστικού Worker: δεν σβήνω τίποτα.' $Bad; Finish 12 }
    if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
    if (-not (Confirm-Approval $PhraseRemovePreview)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' $Warn; Finish 1 }
    $deployR = Prepare-Deploy
    # A new empty folder for every run, so no wrangler config can be there and only the Worker named here is meant (L83).
    $empty = Join-Path $WorkDir ('empty-for-delete-' + $stamp)
    if (Test-Path -LiteralPath $empty) { Say ('Ο φάκελος {0} υπάρχει ήδη: δεν σβήνω τίποτα.' -f $empty) $Bad; Finish 12 }
    New-Item -ItemType Directory -Path $empty -Force | Out-Null
    $d = Invoke-Wrangler $empty ('delete {0}' -f $PreviewName)
    Remove-Item -LiteralPath $empty -Recurse -Force -ErrorAction SilentlyContinue
    if ($d.code -ne 0) {
        if ($d.text -match '(?i)not found|does not exist|10007') { Say ('Ο δοκιμαστικός Worker "{0}" δεν υπάρχει ήδη: τίποτα να σβήσω.' -f $PreviewName) $Ok; Finish 0 }
        Say 'Το σβήσιμο απέτυχε. Τίποτα άλλο δεν άλλαξε. Έξοδος:' $Bad; Say $d.text; Finish 9
    }
    Say ('Σβήστηκε ο δοκιμαστικός Worker "{0}". Το gearworldhub.com δεν άλλαξε.' -f $PreviewName) $Ok
    Finish 0
}

# 1. The version that runs live (live-baseline.txt) and the files of this version (the repo)
$baseline = @()
$liveLabel = 'live-baseline.txt'
if (-not $BaselineFile) { $BaselineFile = Join-Path (Join-Path (Join-Path $repo 'sites') 'gwh') 'live-baseline.txt' }
foreach ($line in [System.IO.File]::ReadAllLines($BaselineFile)) {
    if ($line -match '^\s*#\s*version:\s*(.+)$') { $liveLabel = $Matches[1].Trim(); continue }
    if ($line -match '^\s*#' -or -not $line.Trim()) { continue }
    $p = $line -split ' \| '
    if ($p.Count -ge 4) { $baseline += @{ path = $p[0]; bytes = [long]$p[1]; sha = $p[2].ToLowerInvariant(); kind = $p[3] } }
}
if ($baseline.Count -eq 0) { Say 'Το live-baseline.txt είναι άδειο: ΔΕΝ αλλάζω τίποτα. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 13 }
$baseSha = @{}
foreach ($b in $baseline) { $baseSha[$b.path] = $b.sha }

$gwhRepo = Join-Path (Join-Path $repo 'sites') 'gwh'
$newFiles = @('worker.js', 'photo-search.js', 'poster-scan.js', 'mailerlite.js')
$pubRepo = Join-Path $gwhRepo 'public'
foreach ($f in @(Get-ChildItem -LiteralPath $pubRepo -Recurse -File | Sort-Object FullName)) {
    $newFiles += ('public/' + $f.FullName.Substring($pubRepo.Length).TrimStart('\', '/').Replace('\', '/'))
}
$newSha = @{}
foreach ($rel in $newFiles) { $newSha[$rel] = Get-FileSha (Local-Path $gwhRepo $rel) }
$plan = @($newFiles | Where-Object { -not $baseSha.ContainsKey($_) -or $baseSha[$_] -ne $newSha[$_] })
$unexpected = @($plan | Where-Object { -not $About.Contains($_) })
if ($unexpected.Count -gt 0) {
    Say 'Αυτή η έκδοση του κώδικα αλλάζει και αρχεία που δεν ανήκουν στο βήμα 5α: ΔΕΝ αλλάζω τίποτα. Στείλε στο Claude αυτό το μήνυμα:' $Bad
    foreach ($x in $unexpected) { Say ('  - ' + $x) }
    Finish 13
}

# 2. The hub folder on this PC: still the version that runs live, or already this version?
$cfgPc = Join-Path $HubDir 'wrangler.toml'
if (-not (Test-Path -LiteralPath $cfgPc)) { Say ('Δεν βρήκα το Hub στον υπολογιστή ({0}). Στείλε στο Claude αυτό το μήνυμα.' -f $HubDir) $Bad; Finish 2 }
$cfgText = [System.IO.File]::ReadAllText($cfgPc)
if ($cfgText -notmatch ('(?m)^\s*name\s*=\s*"{0}"' -f $HubWorker)) { Say 'Το wrangler.toml του Hub δεν είναι αυτό που περίμενα: σταμάτησα.' $Bad; Finish 2 }
$postersOn = ($cfgText -match '(?m)^\s*binding\s*=\s*"POSTERS"')
$cronOn = ($cfgText -match '(?m)^\s*crons\s*=\s*\[\s*"\*/10 \* \* \* \*"\s*\]')
$otherTriggers = ((-not $cronOn) -and ($cfgText -match '(?m)^\s*\[triggers\]'))
$pub = Join-Path $HubDir 'public'
$pcFiles = @()
if (Test-Path -LiteralPath $pub) {
    foreach ($f in @(Get-ChildItem -LiteralPath $pub -Recurse -File)) {
        $pcFiles += ('public/' + $f.FullName.Substring($pub.Length).TrimStart('\', '/').Replace('\', '/'))
    }
}
$changed = @()
foreach ($b in $baseline) {
    $sha = Get-FileSha (Local-Path $HubDir $b.path)
    if (-not $sha) { $changed += ($b.path + ' (λείπει)') } elseif ($sha -ne $b.sha) { $changed += $b.path }
}
$notNew = @()
foreach ($rel in $plan) { if ((Get-FileSha (Local-Path $HubDir $rel)) -ne $newSha[$rel]) { $notNew += $rel } }
$changedOutsidePlan = @($changed | Where-Object { $plan -notcontains $_ })
$extraBase = @($pcFiles | Where-Object { -not $baseSha.ContainsKey($_) })
$pcIsBaseline = ($changed.Count -eq 0 -and $extraBase.Count -eq 0 -and -not (Test-Path -LiteralPath (Join-Path $HubDir 'mailerlite.js')))
$pcIsNew = ($notNew.Count -eq 0 -and $changedOutsidePlan.Count -eq 0 -and $extraBase.Count -eq 0)
if ($pcIsBaseline) {
    Say ('Φάκελος του Hub στον υπολογιστή: ίδιος με την έκδοση που τρέχει live ({0}, {1} αρχεία): ΕΝΤΑΞΕΙ' -f $liveLabel, $baseline.Count) $Ok
} elseif ($pcIsNew) {
    Say ('Φάκελος του Hub στον υπολογιστή: έχει ήδη αυτή την έκδοση ({0} αρχεία της αλλαγής): ΕΝΤΑΞΕΙ' -f $plan.Count) $Ok
} else {
    Say ('Φάκελος του Hub στον υπολογιστή: ΠΡΟΒΛΗΜΑ - άλλαξε μετά την έκδοση {0}, και δεν είναι ούτε αυτή η έκδοση:' -f $liveLabel) $Bad
    foreach ($c in $changed) { Say ('  - άλλαξε: ' + $c) }
    foreach ($x in $extraBase) { Say ('  - νέο αρχείο: ' + $x) }
}
if ($postersOn) { Say 'Μέτρηση αφισών (POSTERS) στη ρύθμιση του Hub: υπάρχει (μένει όπως είναι): ΕΝΤΑΞΕΙ' $Ok }
else { Say 'Μέτρηση αφισών (POSTERS) στη ρύθμιση του Hub: ΔΕΝ υπάρχει. Ο Hub δεν είναι όπως περίμενα: ΠΡΟΒΛΗΜΑ' $Bad }
if ($cronOn) { Say ('Cron κάθε 10 λεπτά στο wrangler.toml του Hub: υπάρχει ήδη: ΕΝΤΑΞΕΙ') $Ok }
elseif ($otherTriggers) { Say 'Το wrangler.toml του Hub έχει ήδη άλλο [triggers]: ΠΡΟΒΛΗΜΑ - δεν το αλλάζω μόνος μου.' $Bad }
else { Say ('Cron στο wrangler.toml του Hub: δεν υπάρχει ακόμα (θα μπει στο live: crons = ["{0}"])' -f $Cron) }

# 3. The live gearworldhub.com, read like a browser: still the version of the baseline, or already this version?
$liveState = 'unknown'
$unread = @()
if (-not $NoHttpCheck) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    # robots.txt is not compared: Cloudflare puts its managed Content Signals above the Hub's own lines.
    $paths = @(@($baseline | Where-Object { $_.path -like 'public/*' } | ForEach-Object { $_.path }) | Where-Object { $_ -ne 'public/robots.txt' } | Sort-Object -Unique)
    $isBase = $true
    $isNew = $true
    $diff = @()
    foreach ($rel in $paths) {
        $sha = Get-LiveSha ($LiveUrl + (Get-UrlPath $rel) + '?gwcheck=' + $stamp) ($rel -match '\.html$')
        if ($sha -eq 'error') { $unread += $rel; continue }
        $okBase = ($sha -eq $baseSha[$rel])
        $okNew = $(if ($plan -contains $rel) { $sha -eq $newSha[$rel] } else { $okBase })
        if (-not $okBase) { $isBase = $false }
        if (-not $okNew) { $isNew = $false }
        if (-not $okBase -and -not $okNew) { $diff += $rel }
    }
    if ($unread.Count -gt 0) {
        Say 'Live gearworldhub.com: ΠΡΟΣΟΧΗ - δεν μπόρεσα να διαβάσω κάποια αρχεία (δίκτυο;). Ξανατρέξε την εντολή σε λίγο:' $Warn
        foreach ($x in $unread) { Say ('  - ' + $x) }
    } else {
        if ($isBase) { $liveState = 'baseline' } elseif ($isNew) { $liveState = 'new' } else { $liveState = 'mixed' }
        if ($liveState -eq 'baseline') { Say ('Live gearworldhub.com: ίδιο με την έκδοση {0} ({1} αρχεία της σελίδας): ΕΝΤΑΞΕΙ' -f $liveLabel, $paths.Count) $Ok }
        elseif ($liveState -eq 'new') { Say ('Live gearworldhub.com: έχει ήδη αυτή την έκδοση ({0} αρχεία της σελίδας): ΕΝΤΑΞΕΙ' -f $paths.Count) $Ok }
        else {
            Say ('Live gearworldhub.com: ΠΡΟΒΛΗΜΑ - δεν είναι ούτε η έκδοση {0} ούτε αυτή η έκδοση. Αρχεία:' -f $liveLabel) $Bad
            foreach ($x in $diff) { Say ('  - ' + $x) }
        }
    }
}

# 4. Cloudflare: login, the live version of the Worker, the MailerLite key, the D1 table (read-only)
$deploy = Prepare-Deploy
$gwh = Join-Path (Join-Path $deploy 'sites') 'gwh'
$who = Invoke-Wrangler $gwh 'whoami' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    if ($who.text -match '(?i)not authenticated|wrangler login') { Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' $Bad }
    else { Say 'Δεν μπόρεσα να ελέγξω τη σύνδεση με το Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' $Bad }
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 15)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: ΕΝΤΑΞΕΙ' $Ok
$liveVersion = Get-LiveVersion $gwh $HubWorker
if ($liveVersion) { Say ('Ζωντανή έκδοση του Worker "{0}": βρέθηκε (για επαναφορά): ΕΝΤΑΞΕΙ' -f $HubWorker) $Ok }
else { Say ('Ζωντανή έκδοση του Worker "{0}": ΠΡΟΒΛΗΜΑ - δεν τη βρήκα (χρειάζεται για επαναφορά)' -f $HubWorker) $Bad }

$hasKey = $false
$sl = Invoke-Wrangler $gwh ('secret list --name {0}' -f $HubWorker) -Retry
$secrets = $(if ($sl.code -eq 0) { Get-JsonArray $sl.text } else { $null })
if ($null -ne $secrets) { foreach ($s in $secrets) { if ([string]$s.name -eq $SecretName) { $hasKey = $true } } }
if ($hasKey) { Say ('Κλειδί του MailerLite ({0}) στον Hub: υπάρχει: ΕΝΤΑΞΕΙ' -f $SecretName) $Ok }
else { Say ('Κλειδί του MailerLite ({0}) στον Hub: ΠΡΟΒΛΗΜΑ - δεν το βρίσκω (email βήμα 2: tools/gwh-mailerlite-key.ps1)' -f $SecretName) $Bad }

$dl = Invoke-Wrangler $gwh 'd1 list --json' -Retry
$dbList = Get-JsonArray $dl.text
$dbId = ''
if ($dbList) { foreach ($d in $dbList) { if ($d.name -eq $DbName) { $dbId = [string]$d.uuid } } }
$migrated = $false
$d1Ok = $false
if (-not $dbId) { Say ('D1 "{0}": ΠΡΟΒΛΗΜΑ - δεν τη βρήκα' -f $DbName) $Bad }
else {
    $cols = Invoke-D1Rows $gwh 'PRAGMA table_info(hub_subscribers)'
    $count = Invoke-D1Rows $gwh 'SELECT COUNT(*) AS n FROM hub_subscribers'
    if ($null -eq $cols -or $cols.Count -eq 0 -or $null -eq $count) { Say ('D1 "{0}": ΠΡΟΒΛΗΜΑ - δεν μπόρεσα να διαβάσω τον πίνακα hub_subscribers' -f $DbName) $Bad }
    else {
        $d1Ok = $true
        foreach ($c in $cols) { if ([string]$c.name -eq 'ml_status') { $migrated = $true } }
        $total = [int]$count[0].n
        if ($migrated) {
            $byStatus = Invoke-D1Rows $gwh 'SELECT ml_status AS s, COUNT(*) AS n FROM hub_subscribers GROUP BY ml_status'
            $parts = @()
            if ($byStatus) { foreach ($x in $byStatus) { $parts += ('{0}: {1}' -f $x.s, $x.n) } }
            Say ('Πίνακας εγγραφών του Hub: έχει ήδη τις νέες στήλες. {0} εγγραφές ({1}).' -f $total, ($parts -join ', ')) $Ok
        } else {
            Say ('Πίνακας εγγραφών του Hub: {0} εγγραφές μέχρι σήμερα. Οι νέες στήλες μπαίνουν στο live, και αυτές οι {0} μένουν σε αναμονή («hold») για το βήμα 6.' -f $total) $Ok
        }
    }
}

# 5. The plan
Say ''
Say ('Preview (φράση {0}): ο δοκιμαστικός Worker "{1}" σε διεύθυνση *.workers.dev παίρνει αυτή την έκδοση.' -f $PhraseChange, $PreviewName)
Say '  noindex, χωρίς Google Analytics, χωρίς μέτρηση αφισών, χωρίς cron. Η φόρμα εγγραφής απαντά αλλά ΔΕΝ γράφει και ΔΕΝ στέλνει τίποτα.'
Say '  Το live gearworldhub.com ΔΕΝ αλλάζει.'
Say ('Live (φράση {0}):' -f $PhraseChange)
Say '  1. Αντίγραφο ασφαλείας: zip του φακέλου του Hub (κώδικας, wrangler.toml, public), η ζωντανή έκδοση και σημείο επαναφοράς (Time Travel) της D1.'
if ($migrated) { Say '  2. D1: οι νέες στήλες υπάρχουν ήδη, δεν αλλάζει τίποτα.' }
else { Say '  2. D1: 4 νέες στήλες στον πίνακα εγγραφών (οι παλιές εγγραφές σε «hold» για το βήμα 6), 1 index και ο πίνακας subscribe_usage. Τίποτα δεν σβήνεται.' }
Say ('  3. Στον φάκελο του Hub μπαίνουν {0} αρχεία αυτής της έκδοσης:' -f $plan.Count)
foreach ($rel in $plan) { Say ('     - {0}: {1}' -f $rel, $About[$rel]) }
if (-not $cronOn) { Say ('  4. Στο wrangler.toml του Hub μπαίνει: [triggers] crons = ["{0}"] (το POSTERS και τα υπόλοιπα μένουν).' -f $Cron) }
Say '  5. Deploy του gearworldhub.com από τον φάκελο του Hub και έλεγχοι (η νέα φόρμα, το Privacy, το /api/subscribe).'
Say '  Τα 13 sites, οι βάσεις τους και οι άλλοι Workers ΔΕΝ αλλάζουν.'
Say ('  Επαναφορά (μόνο με έγκριση): npx wrangler rollback <ζωντανή έκδοση> --name {0}, και τα αρχεία του zip πίσω στον φάκελο του Hub.' -f $HubWorker)
Say ('Μετά το live, στην ίδια επικόλληση: -Step remove-preview (φράση {0}) σβήνει τη δοκιμαστική διεύθυνση.' -f $PhraseRemovePreview)
$readyLive = (($pcIsBaseline -or $pcIsNew) -and ($liveState -eq 'baseline' -or $liveState -eq 'new' -or ($NoHttpCheck -and $liveState -eq 'unknown')) -and $liveVersion -and $postersOn -and $hasKey -and $d1Ok -and -not $otherTriggers)

if ($Step -eq 'check') {
    Say ''
    if ($readyLive) { Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ - έτοιμο για το preview και για το live. Μόνο έλεγχος: δεν άλλαξε τίποτα.' $Ok }
    else { Say 'Αποτέλεσμα: το preview μπορεί να γίνει. Για το live κάτι από τα παραπάνω δεν είναι έτοιμο (δες ΠΡΟΒΛΗΜΑ/ΠΡΟΣΟΧΗ). Μόνο έλεγχος: δεν άλλαξε τίποτα.' $Warn }
    Finish 0
}

# ---------------- preview ----------------
if ($Step -eq 'preview') {
    if (-not $dbId) { Say ('Δεν βρήκα τη D1 "{0}". Δεν αλλάζω τίποτα.' -f $DbName) $Bad; Finish 5 }
    if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
    if (-not (Confirm-Approval $PhraseChange)) { Say 'Δεν δόθηκε η έγκριση για το preview: σταμάτησα (δεν ανέβηκε τίποτα).' $Warn; Finish 1 }
    $cfg = Write-PreviewConfig $gwh $dbId
    $d = Invoke-Deploy $gwh $cfg
    if ($d.code -ne 0) { Say 'Το ανέβασμα απέτυχε. Το live Hub δεν άλλαξε. Έξοδος:' $Bad; Say $d.text; Finish 9 }
    $um = [regex]::Match($d.text, 'https://[A-Za-z0-9\.\-]+\.workers\.dev')
    $url = $(if ($um.Success) { $um.Value } else { '' })
    $psl = Invoke-Wrangler $gwh ('secret list --name {0}' -f $PreviewName) -Retry
    if ($psl.code -eq 0 -and $psl.text -match 'PHOTO_LIMIT_SALT') {
        Say 'Το μυστικό της αναζήτησης με φωτογραφία στο preview υπάρχει ήδη, έμεινε ίδιο.'
    } else {
        $s = Set-PreviewSecret $gwh
        if ($s.code -ne 0) { Say 'Το μυστικό του preview δεν μπήκε: η αναζήτηση με φωτογραφία εκεί θα απαντά "not ready". Τα υπόλοιπα δουλεύουν.' $Warn }
        else { Say 'Μυστικό για την αναζήτηση με φωτογραφία στο preview: μπήκε (τυχαίο, δεν φαίνεται πουθενά).' $Ok }
    }
    Say ('Ανέβηκε. Δοκιμαστική διεύθυνση: {0}' -f $(if ($url) { $url } else { '(δεν τη βρήκα στην έξοδο)' })) $Ok
    if ($url -and -not $NoHttpCheck) { Start-Sleep -Seconds 8; Test-Site $url $false }
    Say ''
    Say 'ΕΤΟΙΜΟ: άνοιξε τη δοκιμαστική διεύθυνση, κατέβα στη φόρμα «WEEKLY DEALS» και δοκίμασε με το email σου.' $Ok
    Say 'Θα δεις το μήνυμα επιτυχίας, αλλά στη δοκιμαστική ΔΕΝ γράφεται και ΔΕΝ στέλνεται τίποτα (ούτε καλωσόρισμα).'
    Say 'Η πραγματική δοκιμή, με το καλωσόρισμα στο Gmail σου, γίνεται μετά το live. Το live gearworldhub.com δεν άλλαξε.'
    Finish 0
}

# ---------------- live ----------------
if ($plan.Count -eq 0) { Say 'Τίποτα να αλλάξει στο live.' $Ok; Finish 0 }
if (-not $pcIsBaseline -and -not $pcIsNew) {
    Say ('Ο φάκελος του Hub στον υπολογιστή δεν είναι ούτε η έκδοση {0} ούτε αυτή η έκδοση: κάποιος τον άλλαξε. ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' -f $liveLabel) $Bad
    Finish 7
}
if (-not $postersOn) { Say 'Το wrangler.toml του Hub δεν έχει τη μέτρηση αφισών (POSTERS): ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' $Bad; Finish 8 }
if ($otherTriggers) { Say 'Το wrangler.toml του Hub έχει ήδη άλλο [triggers]: ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' $Bad; Finish 8 }
if ($unread.Count -gt 0) { Say 'Δεν μπόρεσα να διαβάσω όλο το live gearworldhub.com: ΔΕΝ αλλάζω τίποτα. Ξανατρέξε την εντολή σε λίγο.' $Bad; Finish 6 }
if ($liveState -eq 'mixed') { Say 'Το live gearworldhub.com άλλαξε από αλλού: ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' $Bad; Finish 7 }
if (-not $hasKey) { Say 'Δεν υπάρχει το κλειδί του MailerLite στον Hub: πρώτα το email βήμα 2. ΔΕΝ αλλάζω τίποτα.' $Bad; Finish 8 }
if (-not $d1Ok) { Say 'Δεν μπόρεσα να διαβάσω τη D1 του Hub: ΔΕΝ αλλάζω τίποτα. Ξανατρέξε την εντολή σε λίγο.' $Bad; Finish 5 }
if ($pcIsNew -and ($liveState -eq 'new' -or ($NoHttpCheck -and $liveState -eq 'unknown')) -and $migrated -and $cronOn) {
    Say ''
    Say 'Η αλλαγή είναι ήδη live, η D1 και το cron είναι έτοιμα. Τίποτα να κάνω.' $Ok
    Finish 0
}
if (-not $liveVersion) {
    Say ('Δεν βρήκα τη ζωντανή έκδοση του Worker "{0}" (χρειάζεται για επαναφορά): για ασφάλεια ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' -f $HubWorker) $Bad
    Finish 11
}
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
if (-not (Confirm-Approval $PhraseChange)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' $Warn; Finish 1 }

# 1. Backup first: the hub folder (zip), the files that change as plain copies, the D1 restore point
$bdir = Join-Path $WorkDir 'backups'
if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
$tmpCopy = Join-Path ([System.IO.Path]::GetTempPath()) ('gwh-before-mailerlite-' + $stamp)
New-Item -ItemType Directory -Path $tmpCopy -Force | Out-Null
foreach ($n in @('worker.js', 'wrangler.toml', 'photo-search.js', 'poster-scan.js', 'mailerlite.js')) {
    $src = Join-Path $HubDir $n
    if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $tmpCopy -Force }
}
Copy-Item -LiteralPath $pub -Destination $tmpCopy -Recurse -Force
$zip = Join-Path $bdir ('gwh-before-mailerlite-live-' + $stamp + '.zip')
Compress-Archive -Path (Join-Path $tmpCopy '*') -DestinationPath $zip -Force
Remove-Item -LiteralPath $tmpCopy -Recurse -Force
if (-not (Test-Path -LiteralPath $zip)) { Say 'Το αντίγραφο ασφαλείας δεν γράφτηκε: ΔΕΝ άλλαξα τίποτα.' $Bad; Finish 11 }
$keep = Join-Path $bdir ('gwh-before-mailerlite-files-' + $stamp)
$hadBefore = @{}
foreach ($rel in @($plan + @('wrangler.toml'))) {
    $src = Local-Path $HubDir $rel
    $hadBefore[$rel] = (Test-Path -LiteralPath $src -PathType Leaf)
    if ($hadBefore[$rel]) {
        $dst = Local-Path $keep $rel
        New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
        Copy-Item -LiteralPath $src -Destination $dst -Force
    }
}
$tt = Invoke-Wrangler $gwh ('d1 time-travel info {0}' -f $DbName) -Retry
$bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
if (-not $bm.Success) { Say 'Δεν βρήκα σημείο επαναφοράς της D1 του Hub: για ασφάλεια ΔΕΝ αλλάζω τίποτα.' $Bad; Finish 11 }
$note = @(
    ('Gear World Hub before email step 5a (MailerLite) went live ({0}), {1}' -f (Split-Path -Leaf $repo), (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    ('Live version before: {0}' -f $liveVersion),
    ('Hub folder before (code, wrangler.toml, public): {0}' -f $zip),
    ('The files that changed, as they were: {0}' -f $keep),
    ('Files that are new in this version (delete them when going back): ' + ((@($plan | Where-Object { -not $hadBefore[$_] })) -join ', ')),
    ('D1 restore point before the migration: npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $DbName, $bm.Value),
    'To go back (only with approval), in PowerShell:',
    ('  npx wrangler rollback {0} --name {1}' -f $liveVersion, $HubWorker),
    ('  then put the files of {0} (wrangler.toml too) back into {1}' -f $keep, $HubDir),
    'The new D1 columns can stay: the old code does not use them. Or the Time Travel restore above (it also undoes sign-ups made since).'
) -join "`r`n"
$noteFile = Join-Path $bdir ('gwh-before-mailerlite-live-' + $stamp + '.txt')
[System.IO.File]::WriteAllText($noteFile, $note, (New-Object System.Text.UTF8Encoding($true)))
Say ('Αντίγραφο ασφαλείας και οδηγίες επαναφοράς: {0}' -f $noteFile) $Ok

# 2. The D1 migration (only when the columns are not there yet: ALTER TABLE cannot run twice)
if (-not $migrated) {
    $migFile = Local-Path $gwh $Migration
    if (-not (Test-Path -LiteralPath $migFile)) { Say 'Δεν βρήκα το αρχείο της αλλαγής της D1: ΔΕΝ άλλαξα τίποτα.' $Bad; Finish 12 }
    $x = Invoke-Wrangler $gwh ('d1 execute {0} --remote --file "{1}"' -f $DbName, $migFile)
    $cols = Invoke-D1Rows $gwh 'PRAGMA table_info(hub_subscribers)'
    $nowOk = $false
    if ($cols) { foreach ($c in $cols) { if ([string]$c.name -eq 'ml_status') { $nowOk = $true } } }
    if (-not $nowOk) {
        Say 'Η αλλαγή της D1 δεν έγινε. Ο Hub και ο φάκελός του ΔΕΝ άλλαξαν. Στείλε αυτή την αναφορά στο Claude. Έξοδος:' $Bad
        foreach ($line in @($x.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }
        Finish 12
    }
    $byStatus = Invoke-D1Rows $gwh 'SELECT ml_status AS s, COUNT(*) AS n FROM hub_subscribers GROUP BY ml_status'
    $parts = @()
    if ($byStatus) { foreach ($s in $byStatus) { $parts += ('{0}: {1}' -f $s.s, $s.n) } }
    Say ('D1: νέες στήλες και πίνακας subscribe_usage: ΕΝΤΑΞΕΙ ({0})' -f $(if ($parts.Count) { $parts -join ', ' } else { 'καμία εγγραφή' })) $Ok
}

# Puts the hub folder (and its wrangler.toml) back as it was (used only when the deploy fails).
function Restore-Before {
    foreach ($rel in @($plan + @('wrangler.toml'))) {
        $dst = Local-Path $HubDir $rel
        if ($hadBefore[$rel]) { Copy-Item -LiteralPath (Local-Path $keep $rel) -Destination $dst -Force }
        elseif (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
    }
}

# 3. The new files and the cron into the hub folder
foreach ($rel in $plan) {
    $dst = Local-Path $HubDir $rel
    New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
    Copy-Item -LiteralPath (Local-Path $gwhRepo $rel) -Destination $dst -Force
}
if (-not $cronOn) {
    $cfgNow = [System.IO.File]::ReadAllText($cfgPc)
    $nl = $(if ($cfgNow.Contains("`r`n")) { "`r`n" } else { "`n" })
    $block = $nl + '# Gear World email (step 5): every 10 minutes the Hub sends sign-ups that are still waiting to MailerLite.' + $nl + '[triggers]' + $nl + ('crons = ["{0}"]' -f $Cron) + $nl
    [System.IO.File]::WriteAllText($cfgPc, $cfgNow.TrimEnd() + $nl + $block, (New-Object System.Text.UTF8Encoding($false)))
}
$bad = @($plan | Where-Object { (Get-FileSha (Local-Path $HubDir $_)) -ne $newSha[$_] })
$cfgAfter = [System.IO.File]::ReadAllText($cfgPc)
if ($bad.Count -gt 0 -or $cfgAfter -notmatch '(?m)^crons = \["\*/10 \* \* \* \*"\]' -or $cfgAfter -notmatch '(?m)^\s*binding\s*=\s*"POSTERS"') {
    Restore-Before
    Say ('Τα νέα αρχεία ή το cron δεν γράφτηκαν σωστά στον φάκελο του Hub ({0}): τα παλιά γύρισαν πίσω, ΔΕΝ ανέβηκε τίποτα.' -f ($bad -join ', ')) $Bad
    Finish 10
}
Say ('Νέα αρχεία στον φάκελο του Hub: {0}; cron κάθε 10 λεπτά στο wrangler.toml' -f ($plan -join ', ')) $Ok

# 4. Deploy the live Hub from its folder, with the wrangler version of this repo version
$d = Invoke-Deploy $gwh $cfgPc
if ($d.code -ne 0) {
    Restore-Before
    Say 'Το ανέβασμα απέτυχε: το live Hub έμεινε όπως ήταν, και τα παλιά αρχεία γύρισαν στον φάκελο του Hub. Οι νέες στήλες της D1 μένουν (ο παλιός κώδικας δεν τις χρησιμοποιεί). Έξοδος:' $Bad
    Say $d.text
    Finish 9
}
Say 'Το gearworldhub.com ανέβηκε με τη νέα εγγραφή email.' $Ok

# 5. Live checks (the edge may keep the old files for a few seconds)
if (-not $NoHttpCheck) {
    $pubPlan = @($plan | Where-Object { $_ -like 'public/*' })
    $state = @{}
    for ($try = 1; $try -le 4; $try++) {
        Start-Sleep -Seconds $(if ($try -eq 1) { 8 } else { 10 })
        $allNew = $true
        foreach ($rel in $pubPlan) {
            $state[$rel] = Get-LiveSha ($LiveUrl + (Get-UrlPath $rel) + '?gwcheck=' + $stamp + '-' + $try) ($rel -match '\.html$')
            if ($state[$rel] -ne $newSha[$rel]) { $allNew = $false }
        }
        if ($allNew) { break }
    }
    foreach ($rel in $pubPlan) {
        if ($state[$rel] -eq $newSha[$rel]) { Say ('  {0}: live = νέα έκδοση: ΕΝΤΑΞΕΙ' -f $rel) $Ok }
        else { Say ('  {0}: ΠΡΟΣΟΧΗ - το live δείχνει ακόμα άλλη έκδοση (cache;). Ξαναδές σε 1-2 λεπτά.' -f $rel) $Warn }
    }
    Test-Site $LiveUrl $true
}
Say ''
Say 'Για το live-baseline.txt (το ενημερώνει το Claude):'
foreach ($rel in $plan) { Say ('  {0} | {1} | {2} | file' -f $rel, (Get-Item -LiteralPath (Local-Path $HubDir $rel)).Length, $newSha[$rel]) }
Say ''
Say 'ΕΤΟΙΜΟ: η εγγραφή email του gearworldhub.com πηγαίνει πλέον και στο MailerLite.' $Ok
Say 'Δοκιμή: γράψου στη φόρμα «WEEKLY DEALS» του gearworldhub.com με το email σου. Σε 1-2 λεπτά πρέπει να έρθει το καλωσόρισμα.'
Finish 0
