<#
.SYNOPSIS
  Poster QR scans (lessons L76): count the scans of the A3 posters on the 10 sites and the Hub, in a private database.
  Read-only unless -Apply and the typed approval phrase.

.DESCRIPTION
  A QR code of a poster opens a home page with ?utm_source=poster&utm_campaign=<poster>. Each Worker then adds +1 for
  (day, poster, site) in the D1 database gear-world-posters, through the private Worker gear-world-posters (service
  binding POSTERS; it has no public address). No IP address, no cookies, nothing about the visitor is kept.

  -Step check         READ-ONLY. Cloudflare login; the database and the counter Worker (made already?); the live
                      version of the 11 Workers (needed to go back); the configs on this PC (TGW, AGW, VGW, SGW, Hub);
                      whether the Hub folder on this PC and gearworldhub.com are still the version of
                      sites/gwh/live-baseline.txt. Shows the plan.
  -Step apply         CHANGES CLOUDFLARE AND THE LIVE SITES, one approval: ΕΓΚΡΙΝΩ POSTER STATS. In this order:
                        1. backup: the live version of the 11 Workers (rollback note), copies of the 5 configs of
                           this PC and a zip of the Hub folder;
                        2. the D1 database gear-world-posters and its table poster_scans (migration 0001);
                        3. the private Worker gear-world-posters;
                        4. the line POSTERS in the configs of this PC (TGW, AGW, VGW, SGW);
                        5. the 10 sites, each with its own update step and its usual checks, SGW first;
                        6. the Hub: POSTERS in its wrangler.toml and the new worker.js + poster-scan.js, then deploy
                           (only when its folder and the live site are still the known version);
                        7. every home page answers.
                      Nothing changes unless every check passes first. It stops at the first problem; what was
                      already updated keeps working. Running it again is safe (what is done is skipped or repeated).
  -Step test-cleanup  CHANGES THE POSTER DATABASE ONLY: deletes the rows of the test poster (poster-test), after saving
                      them in a file that can put them back. Approval: ΕΓΚΡΙΝΩ POSTER CLEANUP
  Report: <home>\gear-world-reports\POSTER_SETUP_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'apply', 'test-cleanup')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$PcHome = '',
    [string]$WorkDir = '',
    [string]$HubDir = '',
    [string]$OutDir = '',
    [string]$BaselineFile = '',
    [string]$SiteToolDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard,
    [switch]$NoHttpCheck
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ POSTER STATS'
$PhraseCleanup = 'ΕΓΚΡΙΝΩ POSTER CLEANUP'
$DbName = 'gear-world-posters'
$Counter = 'gear-world-posters'
$HubWorker = 'gear-world-hub'
$HubUrl = 'https://gearworldhub.com'
if (-not $PcHome) { $PcHome = $HOME }
if (-not $WorkDir) { $WorkDir = Join-Path $PcHome 'gear-world-posters' }
if (-not $HubDir) { $HubDir = Join-Path $PcHome 'gear-world-hub' }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
if (-not $SiteToolDir) { $SiteToolDir = Join-Path $repo 'tools' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$sep = [System.IO.Path]::DirectorySeparatorChar
$DashLink = 'https://dash.cloudflare.com/?to=/:account/workers-and-pages'

# The 10 sites, in the order of the update: SGW first (its live code is already the newest, so only the count is new),
# then the other new sites, then the 6 older ones. pc: the folder whose wrangler.jsonc is the live config (new sites);
# the older sites make their config from the repo template at every update.
$Sites = @(
    @{ code = 'sgw'; tool = 'sgw-cloudflare'; worker = 'sporty-gear-world'; domain = 'sportygearworld.com'; pc = 'sporty-gear-world' },
    @{ code = 'tgw'; tool = 'tgw-cloudflare'; worker = 'technology-gear-world'; domain = 'technologygearworld.com'; pc = 'technology-gear-world' },
    @{ code = 'agw'; tool = 'agw-cloudflare'; worker = 'car-gear-world'; domain = 'cargearworld.com'; pc = 'car-gear-world' },
    @{ code = 'vgw'; tool = 'vgw-cloudflare'; worker = 'travel-gear-world'; domain = 'travelgearworld.com'; pc = 'travel-gear-world' },
    @{ code = 'cgw'; tool = 'cgw-engine'; worker = 'construction-gear-uk'; domain = 'constructiongearworld.com'; pc = '' },
    @{ code = 'mgw'; tool = 'mgw-engine'; worker = 'mens-gear-world'; domain = 'mensgearworld.com'; pc = '' },
    @{ code = 'wgw'; tool = 'wgw-engine'; worker = 'womens-gear-world'; domain = 'womensgearworld.com'; pc = '' },
    @{ code = 'kgw'; tool = 'kgw-engine'; worker = 'kids-gear-world'; domain = 'kidsgearworld.com'; pc = '' },
    @{ code = 'hgw'; tool = 'hgw-engine'; worker = 'home-gear-world'; domain = 'homegearworld.com'; pc = '' },
    @{ code = 'ggw'; tool = 'ggw-engine'; worker = 'garden-gear-world'; domain = 'gardengearworld.com'; pc = '' }
)

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
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
    $file = Join-Path $OutDir ('POSTER_SETUP_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('POSTER_SETUP_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
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
    $typed = $Approve
    if (-not $typed) {
        Write-Host ''
        Write-Host ('Για να συνεχίσω, γράψε ακριβώς: {0}' -f $phrase) -ForegroundColor Yellow
        Write-Host '(ή πάτα Enter για να σταματήσω χωρίς αλλαγές)'
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
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
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-posters-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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
        Say ('Προσωρινό πρόβλημα με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/{2})...' -f (5 * $try), ($try + 1), $tries) 'Yellow'
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

# The JSON array that wrangler printed with --json (warnings before it are skipped).
function Get-JsonArray([string]$text) {
    $m = [regex]::Match($text, '(?m)^\s*\[')
    $j = $text.LastIndexOf(']')
    if (-not $m.Success -or $j -le $m.Index) { return $null }
    # The comma keeps an empty array an array (PowerShell returns nothing for a bare @()).
    try { return , @($text.Substring($m.Index, $j - $m.Index + 1) | ConvertFrom-Json) } catch { return $null }
}

# Rows of a read-only SELECT on the poster database, or $null on error.
function Select-Posters([string]$Folder, [string]$sql) {
    if ($sql -notmatch '^\s*SELECT ') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler $Folder ('d1 execute {0} --remote --json --command "{1}"' -f $DbName, $sql) -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j -or $j.Count -lt 1) { return $null }
    return , @($j[0].results)
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
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        foreach ($item in @('src', 'sites', 'promos', 'package.json', 'package-lock.json')) {
            $src = Join-Path $repo $item
            if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $dest -Recurse -Force }
        }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-posters-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
    }
    return $dest
}

# The version of a Worker that is live now (for going back). Read-only. wrangler lists the deployments oldest first:
# the last "Version(s):" block is the live one, and it must be ONE version with 100% of the visitors.
# Returns '' when there is none, 'missing' when the Worker does not exist.
function Get-LiveVersion([string]$folder, [string]$name) {
    $r = Invoke-Wrangler $folder ('deployments list --name {0}' -f $name) -Retry
    if ($r.code -ne 0) {
        if ($r.text -match '(?i)code: 10007|does not exist|not found') { return 'missing' }
        return ''
    }
    $at = $r.text.LastIndexOf('Version(s):')
    if ($at -lt 0) { return '' }
    $ms = [regex]::Matches($r.text.Substring($at), '\((\d+)%\)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($ms.Count -ne 1 -or $ms[0].Groups[1].Value -ne '100') { return '' }
    return $ms[0].Groups[2].Value
}

# The ID of the poster database, '' when it does not exist yet, $null when the list could not be read.
function Get-PosterDbId([string]$folder) {
    $r = Invoke-Wrangler $folder 'd1 list --json' -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { return $null }
    foreach ($d in $j) { if ([string]$d.name -eq $DbName -and [string]$d.uuid) { return [string]$d.uuid } }
    return ''
}

# Deploy; when Cloudflare answers "This Worker does not exist" (code 10007) right after an upload, wait and deploy
# once more: a deploy is safe to repeat (lessons L72).
function Invoke-Deploy([string]$folder, [string]$config) {
    $d = Invoke-Wrangler $folder ('deploy --config "{0}"' -f $config)
    if ($d.code -ne 0 -and $d.text -match 'code: 10007') {
        Say 'Το Cloudflare δεν απάντησε σωστά στο ανέβασμα. Ξαναδοκιμάζω σε 15 δευτερόλεπτα...' 'Yellow'
        Start-Sleep -Seconds 15
        $d = Invoke-Wrangler $folder ('deploy --config "{0}"' -f $config)
    }
    return $d
}

# tools/poster-config.mjs: "check" (has/missing) or "add" (added/already) for one config file of this PC.
function Invoke-PosterConfig([string]$mode, [string]$file) {
    $helper = Join-Path (Join-Path $repo 'tools') 'poster-config.mjs'
    $out = @(& node $helper $mode $file)
    $code = $LASTEXITCODE
    $text = (($out | ForEach-Object { "$_" }) -join ' ').Trim()
    if ($code -ne 0) { return ('error ' + $text) }
    return $text
}

# sha256 of a live file of the Hub as the Worker sends it ('missing' for 404, 'error' when it could not be read).
# Cloudflare Web Analytics adds its own beacon script to HTML for some visitors (lessons L71): it is taken out first.
# The user agent is a bot's and there is no utm_source, so these checks are never counted as poster scans.
function Get-LiveSha([string]$url, [bool]$isHtml) {
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add('User-Agent', 'GearWorldQA-bot/1.0 (+read-only check)')
        try { $bytes = $wc.DownloadData($url) } finally { $wc.Dispose() }
    } catch {
        $we = $_.Exception
        while ($we -and -not ($we -is [System.Net.WebException])) { $we = $we.InnerException }
        if ($we -and $we.Response -and [int]$we.Response.StatusCode -eq 404) { return 'missing' }
        return 'error'
    }
    if ($isHtml) {
        $enc = New-Object System.Text.UTF8Encoding($false)
        $text = $enc.GetString($bytes)
        $clean = [regex]::Replace($text, '<script[^>]*static\.cloudflareinsights\.com/beacon\.min\.js[^>]*></script>\r?\n?', '')
        if ($clean -ne $text) { $bytes = $enc.GetBytes($clean) }
    }
    return (Get-Sha $bytes)
}

function Get-UrlPath([string]$rel) {
    $p = $rel.Substring(7)
    if ($p -eq 'index.html') { return '/' }
    if ($p -match '/index\.html$') { return ('/' + $p.Substring(0, $p.Length - 10)) }
    return ('/' + $p)
}

# Status of a home page (no utm_source, bot user agent: never counted).
function Get-HomeStatus([string]$domain) {
    try {
        $req = [System.Net.HttpWebRequest]::Create(('https://{0}/?gwcheck={1}' -f $domain, $stamp))
        $req.UserAgent = 'GearWorldQA-bot/1.0 (+read-only check)'
        $req.AllowAutoRedirect = $false
        $req.Timeout = 30000
        $resp = $req.GetResponse()
        $c = [int]$resp.StatusCode
        $resp.Close()
        return $c
    } catch {
        $we = $_.Exception
        while ($we -and -not ($we -is [System.Net.WebException])) { $we = $we.InnerException }
        if ($we -and $we.Response) { return [int]$we.Response.StatusCode }
        return 0
    }
}

# ---------------- start ----------------
Say ('POSTER SCANS SETUP - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$deploy = Prepare-Deploy
$postersDir = Join-Path (Join-Path $deploy 'sites') 'posters'
$gwhDeploy = Join-Path (Join-Path $deploy 'sites') 'gwh'

$who = Invoke-Wrangler $deploy 'whoami' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    if ($who.text -match '(?i)not authenticated|wrangler login') { Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red' }
    else { Say 'Δεν μπόρεσα να ελέγξω τη σύνδεση με το Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red' }
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 15)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: ΕΝΤΑΞΕΙ' 'Green'

# ================= test-cleanup =================
if ($Step -eq 'test-cleanup') {
    $dbId = Get-PosterDbId $deploy
    if ($null -eq $dbId) { Say 'Δεν μπόρεσα να διαβάσω τη λίστα των βάσεων D1. Ξανατρέξε την εντολή σε λίγο.' 'Red'; Finish 6 }
    if (-not $dbId) { Say ('Η βάση {0} δεν υπάρχει ακόμα: τίποτα να σβήσω.' -f $DbName) 'Green'; Finish 0 }
    $rows = Select-Posters $deploy "SELECT day, campaign, site, scans FROM poster_scans WHERE campaign = 'poster-test' ORDER BY day, site"
    $others = Select-Posters $deploy "SELECT COUNT(*) AS n, COALESCE(SUM(scans), 0) AS s FROM poster_scans WHERE campaign != 'poster-test'"
    if ($null -eq $rows -or $null -eq $others) { Say 'Δεν μπόρεσα να διαβάσω τη βάση των αφισών. Ξανατρέξε την εντολή σε λίγο.' 'Red'; Finish 6 }
    $rows = @($rows | Where-Object { [string]$_.day -match '^\d{4}-\d{2}-\d{2}$' -and [string]$_.site -match '^[a-z]{3}$' })
    $otherRows = [int]$others[0].n
    $otherScans = [int]$others[0].s
    Say ''
    Say ('Δοκιμαστικές γραμμές (poster-test): {0}, με {1} μετρήσεις:' -f $rows.Count, (($rows | Measure-Object -Property scans -Sum).Sum + 0))
    foreach ($r in $rows) { Say ('  {0}  {1}  {2}' -f $r.day, ([string]$r.site).ToUpper(), $r.scans) }
    Say ('Οι αληθινές μετρήσεις (όλες οι άλλες αφίσες) ΔΕΝ αλλάζουν: {0} γραμμές, {1} μετρήσεις.' -f $otherRows, $otherScans)
    if ($rows.Count -eq 0) { Say ''; Say 'Δεν υπάρχουν δοκιμαστικές γραμμές: τίποτα να σβήσω.' 'Green'; Finish 0 }
    if (-not $Apply) { Say ''; Say ('Με -Apply και τη φράση {0} σβήνονται ΜΟΝΟ αυτές οι γραμμές, αφού γραφτούν πρώτα σε αρχείο επαναφοράς.' -f $PhraseCleanup); Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
    if (-not (Confirm-Approval $PhraseCleanup)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
    $bdir = Join-Path $WorkDir 'backups'
    if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
    $undo = @('-- Puts back the poster-test rows deleted on ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') + ' (tools/poster-setup.ps1 -Step test-cleanup).')
    foreach ($r in $rows) {
        $undo += ("INSERT INTO poster_scans (day, campaign, site, scans) VALUES ('{0}', 'poster-test', '{1}', {2}) ON CONFLICT (day, campaign, site) DO UPDATE SET scans = excluded.scans;" -f $r.day, $r.site, [int]$r.scans)
    }
    $undoFile = Join-Path $bdir ('poster-test-rows-' + $stamp + '.sql')
    [System.IO.File]::WriteAllText($undoFile, ($undo -join "`r`n") + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
    if (-not (Test-Path -LiteralPath $undoFile)) { Say 'Το αρχείο επαναφοράς δεν γράφτηκε: ΔΕΝ έσβησα τίποτα.' 'Red'; Finish 11 }
    Say ('Αρχείο επαναφοράς: {0}' -f $undoFile) 'Green'
    $d = Invoke-Wrangler $deploy ('d1 execute {0} --remote --command "DELETE FROM poster_scans WHERE campaign = ''poster-test''"' -f $DbName) -Retry
    if ($d.code -ne 0) { Say 'Το σβήσιμο απέτυχε. Τίποτα δεν άλλαξε. Έξοδος:' 'Red'; Say $d.text; Finish 9 }
    $left = Select-Posters $deploy "SELECT COUNT(*) AS n FROM poster_scans WHERE campaign = 'poster-test'"
    $after = Select-Posters $deploy "SELECT COUNT(*) AS n, COALESCE(SUM(scans), 0) AS s FROM poster_scans WHERE campaign != 'poster-test'"
    if ($null -eq $left -or $null -eq $after) { Say 'Σβήστηκαν, αλλά δεν μπόρεσα να ξαναδιαβάσω τη βάση. Τρέξε το poster-stats για έλεγχο.' 'Yellow'; Finish 0 }
    if ([int]$left[0].n -eq 0) { Say 'Δοκιμαστικές γραμμές τώρα: 0: ΕΝΤΑΞΕΙ' 'Green' } else { Say ('Δοκιμαστικές γραμμές τώρα: {0}: ΠΡΟΒΛΗΜΑ' -f $left[0].n) 'Red' }
    if ([int]$after[0].n -ge $otherRows) { Say ('Αληθινές μετρήσεις: {0} γραμμές, {1} μετρήσεις (καμία δεν χάθηκε): ΕΝΤΑΞΕΙ' -f $after[0].n, $after[0].s) 'Green' }
    else { Say ('Αληθινές μετρήσεις: {0} γραμμές, πριν ήταν {1}: ΠΡΟΒΛΗΜΑ. Επαναφορά: npx wrangler d1 execute {2} --remote --file "{3}"' -f $after[0].n, $otherRows, $DbName, $undoFile) 'Red' }
    Say ''
    Say ('ΕΤΟΙΜΟ. Αν χρειαστεί να γυρίσουν πίσω (μόνο με έγκριση): npx wrangler d1 execute {0} --remote --file "{1}"' -f $DbName, $undoFile) 'Green'
    Finish 0
}

# ================= check and apply: everything is read first =================
$problems = New-Object System.Collections.Generic.List[string]

# 1. The poster database and the counter Worker
$dbId = Get-PosterDbId $deploy
if ($null -eq $dbId) { Say 'Βάση D1 gear-world-posters: ΠΡΟΣΟΧΗ - δεν μπόρεσα να διαβάσω τη λίστα των βάσεων' 'Yellow'; $problems.Add('η λίστα των βάσεων D1 δεν διαβάστηκε') }
elseif ($dbId) { Say 'Βάση D1 gear-world-posters: υπάρχει ήδη (δεν ξαναγίνεται): ΕΝΤΑΞΕΙ' 'Green' }
else { Say 'Βάση D1 gear-world-posters: δεν υπάρχει ακόμα (θα γίνει με το apply)' }
$counterLive = Get-LiveVersion $deploy $Counter
if ($counterLive -eq 'missing') { Say ('Worker {0}: δεν υπάρχει ακόμα (θα γίνει με το apply)' -f $Counter) }
elseif ($counterLive) { Say ('Worker {0}: υπάρχει ήδη (ανεβαίνει ξανά, ίδιος κώδικας): ΕΝΤΑΞΕΙ' -f $Counter) 'Green' }
else { Say ('Worker {0}: δεν τον βρήκα (θα γίνει με το apply)' -f $Counter) }

# 2. The live version of every Worker (needed to go back), the site tools and the configs of this PC
$live = @{}
Say ''
Say 'Ζωντανές εκδόσεις (για επαναφορά) και ρυθμίσεις:'
foreach ($s in $Sites) {
    $v = Get-LiveVersion $deploy $s.worker
    $live[$s.worker] = $v
    $tool = Join-Path $SiteToolDir ($s.tool + '.ps1')
    $line = '  {0} ({1}): ζωντανή έκδοση {2}' -f $s.code.ToUpper(), $s.worker, $(if ($v -and $v -ne 'missing') { 'βρέθηκε' } else { 'ΔΕΝ βρέθηκε' })
    if (-not $v -or $v -eq 'missing') { $problems.Add(('δεν βρέθηκε η ζωντανή έκδοση του {0}' -f $s.worker)) }
    if (-not (Test-Path -LiteralPath $tool)) { $problems.Add(('λείπει το εργαλείο {0}.ps1' -f $s.tool)); $line += ', λείπει το εργαλείο' }
    if ($s.pc) {
        $cfg = Join-Path (Join-Path $PcHome $s.pc) 'wrangler.jsonc'
        if (-not (Test-Path -LiteralPath $cfg)) { $problems.Add(('λείπει το {0}' -f $cfg)); $line += ', ρυθμίσεις: ΛΕΙΠΟΥΝ' }
        elseif ([System.IO.File]::ReadAllText($cfg) -notmatch '"routes"\s*:') { $problems.Add(('το {0} δεν έχει τα domains' -f $cfg)); $line += ', ρυθμίσεις χωρίς domains' }
        else {
            $st = Invoke-PosterConfig 'check' $cfg
            if ($st -eq 'has') { $line += ', POSTERS: υπάρχει ήδη' } elseif ($st -eq 'missing') { $line += ', POSTERS: θα μπει' }
            else { $problems.Add(('δεν διαβάζεται το {0} ({1})' -f $cfg, $st)); $line += ', ρυθμίσεις: δεν διαβάζονται' }
        }
    }
    $ok = ($v -and $v -ne 'missing' -and (Test-Path -LiteralPath $tool))
    Say ($line + $(if ($ok) { ': ΕΝΤΑΞΕΙ' } else { ': ΠΡΟΒΛΗΜΑ' })) $(if ($ok) { 'Green' } else { 'Red' })
}
$hubLive = Get-LiveVersion $deploy $HubWorker
$live[$HubWorker] = $hubLive
if (-not $hubLive -or $hubLive -eq 'missing') { $problems.Add('δεν βρέθηκε η ζωντανή έκδοση του gear-world-hub') }

# 3. The Hub: its folder on this PC and gearworldhub.com still the version of live-baseline.txt (or already this one)
$hubCfg = Join-Path $HubDir 'wrangler.toml'
$hubReady = $false
$hubPlan = @()
if (-not (Test-Path -LiteralPath $hubCfg)) {
    $problems.Add(('δεν βρήκα το Hub στον υπολογιστή ({0})' -f $HubDir))
    Say ('  HUB: ΠΡΟΒΛΗΜΑ - δεν βρήκα τον φάκελο του Hub ({0})' -f $HubDir) 'Red'
} elseif ([System.IO.File]::ReadAllText($hubCfg) -notmatch ('(?m)^\s*name\s*=\s*"{0}"' -f $HubWorker)) {
    $problems.Add('το wrangler.toml του Hub δεν είναι αυτό που περίμενα')
    Say '  HUB: ΠΡΟΒΛΗΜΑ - το wrangler.toml του Hub δεν είναι αυτό που περίμενα' 'Red'
} else {
    if (-not $BaselineFile) { $BaselineFile = Join-Path (Join-Path (Join-Path $repo 'sites') 'gwh') 'live-baseline.txt' }
    $baseline = @()
    $liveLabel = 'live-baseline.txt'
    foreach ($line in [System.IO.File]::ReadAllLines($BaselineFile)) {
        if ($line -match '^\s*#\s*version:\s*(.+)$') { $liveLabel = $Matches[1].Trim(); continue }
        if ($line -match '^\s*#' -or -not $line.Trim()) { continue }
        $p = $line -split ' \| '
        if ($p.Count -ge 4) { $baseline += @{ path = $p[0]; sha = $p[2].ToLowerInvariant() } }
    }
    $baseSha = @{}
    foreach ($b in $baseline) { $baseSha[$b.path] = $b.sha }
    $gwhRepo = Join-Path (Join-Path $repo 'sites') 'gwh'
    $newFiles = @('worker.js', 'photo-search.js', 'poster-scan.js')
    $pubRepo = Join-Path $gwhRepo 'public'
    foreach ($f in @(Get-ChildItem -LiteralPath $pubRepo -Recurse -File | Sort-Object FullName)) {
        $newFiles += ('public/' + $f.FullName.Substring($pubRepo.Length).TrimStart('\', '/').Replace('\', '/'))
    }
    $newSha = @{}
    foreach ($rel in $newFiles) { $newSha[$rel] = Get-FileSha (Local-Path $gwhRepo $rel) }
    $hubPlan = @($newFiles | Where-Object { -not $baseSha.ContainsKey($_) -or $baseSha[$_] -ne $newSha[$_] })
    $pub = Join-Path $HubDir 'public'
    $pcFiles = @()
    if (Test-Path -LiteralPath $pub) {
        foreach ($f in @(Get-ChildItem -LiteralPath $pub -Recurse -File)) { $pcFiles += ('public/' + $f.FullName.Substring($pub.Length).TrimStart('\', '/').Replace('\', '/')) }
    }
    $changed = @()
    foreach ($b in $baseline) {
        $sha = Get-FileSha (Local-Path $HubDir $b.path)
        if (-not $sha) { $changed += ($b.path + ' (λείπει)') } elseif ($sha -ne $b.sha) { $changed += $b.path }
    }
    $notNew = @($newFiles | Where-Object { (Get-FileSha (Local-Path $HubDir $_)) -ne $newSha[$_] })
    $pcIsBaseline = ($baseline.Count -gt 0 -and $changed.Count -eq 0 -and @($pcFiles | Where-Object { -not $baseSha.ContainsKey($_) }).Count -eq 0)
    $pcIsNew = ($notNew.Count -eq 0 -and @($pcFiles | Where-Object { -not $newSha.ContainsKey($_) }).Count -eq 0)
    $liveState = 'unknown'
    if (-not $NoHttpCheck) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $isBase = $true
        $unread = 0
        foreach ($rel in @($baseline | Where-Object { $_.path -like 'public/*' } | ForEach-Object { $_.path })) {
            $sha = Get-LiveSha ($HubUrl + (Get-UrlPath $rel) + '?gwcheck=' + $stamp) ($rel -match '\.html$')
            if ($sha -eq 'error') { $unread++; continue }
            if ($sha -ne $baseSha[$rel]) { $isBase = $false }
        }
        if ($unread -gt 0) { $liveState = 'unread' } elseif ($isBase) { $liveState = 'baseline' } else { $liveState = 'mixed' }
    }
    $hubReady = (($pcIsBaseline -or $pcIsNew) -and ($liveState -eq 'baseline' -or ($NoHttpCheck -and $liveState -eq 'unknown')))
    if ($pcIsBaseline) { Say ('  HUB: ο φάκελος του υπολογιστή είναι η έκδοση που τρέχει live ({0})' -f $liveLabel) }
    elseif ($pcIsNew) { Say '  HUB: ο φάκελος του υπολογιστή έχει ήδη αυτή την έκδοση' }
    else {
        Say ('  HUB: ΠΡΟΒΛΗΜΑ - ο φάκελος του υπολογιστή άλλαξε μετά την έκδοση {0}:' -f $liveLabel) 'Red'
        foreach ($c in $changed) { Say ('    - άλλαξε: ' + $c) }
        $problems.Add('ο φάκελος του Hub στον υπολογιστή δεν είναι η γνωστή έκδοση')
    }
    if ($liveState -eq 'unread') { Say '  HUB: ΠΡΟΣΟΧΗ - δεν μπόρεσα να διαβάσω όλο το live gearworldhub.com. Ξανατρέξε σε λίγο.' 'Yellow'; $problems.Add('το live gearworldhub.com δεν διαβάστηκε') }
    elseif ($liveState -eq 'mixed') { Say '  HUB: ΠΡΟΒΛΗΜΑ - το live gearworldhub.com δεν είναι η έκδοση του live-baseline.txt' 'Red'; $problems.Add('το live gearworldhub.com άλλαξε από αλλού') }
    elseif ($liveState -eq 'baseline') { Say '  HUB: το live gearworldhub.com είναι η ίδια έκδοση' }
    $hst = Invoke-PosterConfig 'check' $hubCfg
    if ($hst -eq 'has') { Say '  HUB: POSTERS στο wrangler.toml: υπάρχει ήδη' } elseif ($hst -eq 'missing') { Say '  HUB: POSTERS στο wrangler.toml: θα μπει' }
    else { $problems.Add(('δεν διαβάζεται το wrangler.toml του Hub ({0})' -f $hst)) }
    Say ('  HUB ({0}): ζωντανή έκδοση {1}, αρχεία που αλλάζουν: {2}{3}' -f $HubWorker, $(if ($hubLive -and $hubLive -ne 'missing') { 'βρέθηκε' } else { 'ΔΕΝ βρέθηκε' }), $(if ($hubPlan.Count) { $hubPlan -join ', ' } else { '(κανένα)' }), $(if ($hubReady -and $hubLive -and $hubLive -ne 'missing') { ': ΕΝΤΑΞΕΙ' } else { ': ΠΡΟΒΛΗΜΑ' })) $(if ($hubReady -and $hubLive -and $hubLive -ne 'missing') { 'Green' } else { 'Red' })
}

# 4. The plan
Say ''
Say ('Τι θα γίνει με -Step apply -Apply και τη φράση {0}:' -f $Phrase)
Say '  1. Αντίγραφα ασφαλείας: σημείωμα με τη ζωντανή έκδοση των 11 Workers (για επαναφορά), αντίγραφα των 5 ρυθμίσεων του υπολογιστή, zip του φακέλου του Hub.'
Say ('  2. Η βάση D1 {0} και ο πίνακας poster_scans (day, campaign, site, scans). Οι βάσεις των sites ΔΕΝ αλλάζουν.' -f $DbName)
Say ('  3. Ο ιδιωτικός Worker {0} (χωρίς δημόσια διεύθυνση): αυτός μετράει.' -f $Counter)
Say '  4. Η γραμμή POSTERS στις ρυθμίσεις του υπολογιστή των TGW, AGW, VGW, SGW.'
Say '  5. Τα 10 sites, το καθένα με το δικό του βήμα update και τους συνηθισμένους ελέγχους (πρώτα το SGW).'
Say '  6. Το Hub: POSTERS στο wrangler.toml, τα νέα worker.js και poster-scan.js, deploy από τον φάκελό του.'
Say '  7. Έλεγχος: κάθε αρχική σελίδα απαντά.'
Say '  Ο Worker gwh-sitemap, οι βάσεις των sites, τα προϊόντα και τα links /out/ ΔΕΝ αλλάζουν. Τίποτα δεν κρατιέται για τον επισκέπτη.'
Say '  Διάρκεια: περίπου 20-30 λεπτά (κάθε site εγκαθιστά μία φορά τα εργαλεία του).'
Say ('  Επαναφορά (μόνο με έγκριση): npx wrangler rollback <ζωντανή έκδοση> --name <Worker> για κάθε Worker, από το σημείωμα του βήματος 1, και τα αντίγραφα των ρυθμίσεων πίσω στη θέση τους. Ή στο Cloudflare: {0} > Worker > Deployments > Rollback.' -f $DashLink)

if ($Step -eq 'check') {
    Say ''
    if ($problems.Count -eq 0) { Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ - όλα έτοιμα για το apply. Μόνο έλεγχος: δεν άλλαξε τίποτα.' 'Green' }
    else {
        Say 'Αποτέλεσμα: ΠΡΟΒΛΗΜΑ - αυτά πρέπει να διορθωθούν πριν από το apply (μόνο έλεγχος: δεν άλλαξε τίποτα):' 'Red'
        foreach ($p in $problems) { Say ('  - ' + $p) }
    }
    Finish 0
}

# ================= apply =================
if ($problems.Count -gt 0) {
    Say ''
    Say 'ΠΡΟΒΛΗΜΑ: δεν είναι όλα έτοιμα, οπότε ΔΕΝ αλλάζω τίποτα:' 'Red'
    foreach ($p in $problems) { Say ('  - ' + $p) }
    Finish 8
}
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# Step 1. Backups first
$bdir = Join-Path (Join-Path $WorkDir 'backups') ('before-poster-stats-' + $stamp)
New-Item -ItemType Directory -Path $bdir -Force | Out-Null
$note = @(
    ('Gear World before the poster scan counting ({0}), {1}' -f (Split-Path -Leaf $repo), (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    'To go back (only with approval), in PowerShell, for each Worker that was updated:'
)
foreach ($s in $Sites) { $note += ('  npx wrangler rollback {0} --name {1}' -f $live[$s.worker], $s.worker) }
$note += ('  npx wrangler rollback {0} --name {1}' -f $hubLive, $HubWorker)
$note += 'Then put the config copies of this folder back (they are named after their folder), and the Hub files from the zip.'
$note += ('Or in the Cloudflare dashboard: {0} > the Worker > Deployments > the version above > Rollback.' -f $DashLink)
$note += 'The counter Worker gear-world-posters and the database gear-world-posters do nothing on their own: they can stay.'
$noteFile = Join-Path $bdir 'rollback.txt'
[System.IO.File]::WriteAllText($noteFile, ($note -join "`r`n") + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
foreach ($s in @($Sites | Where-Object { $_.pc })) {
    Copy-Item -LiteralPath (Join-Path (Join-Path $PcHome $s.pc) 'wrangler.jsonc') -Destination (Join-Path $bdir ($s.pc + '.wrangler.jsonc')) -Force
}
Copy-Item -LiteralPath $hubCfg -Destination (Join-Path $bdir 'gear-world-hub.wrangler.toml') -Force
$tmpCopy = Join-Path ([System.IO.Path]::GetTempPath()) ('gwh-before-posters-' + $stamp)
New-Item -ItemType Directory -Path $tmpCopy -Force | Out-Null
foreach ($n in @('worker.js', 'wrangler.toml', 'photo-search.js', 'poster-scan.js')) {
    $src = Join-Path $HubDir $n
    if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $tmpCopy -Force }
}
Copy-Item -LiteralPath (Join-Path $HubDir 'public') -Destination $tmpCopy -Recurse -Force
$zip = Join-Path $bdir 'gear-world-hub-folder.zip'
Compress-Archive -Path (Join-Path $tmpCopy '*') -DestinationPath $zip -Force
Remove-Item -LiteralPath $tmpCopy -Recurse -Force
$copies = @(Get-ChildItem -LiteralPath $bdir -File)
if (-not (Test-Path -LiteralPath $zip) -or $copies.Count -lt 7) { Say 'Τα αντίγραφα ασφαλείας δεν γράφτηκαν όλα: ΔΕΝ άλλαξα τίποτα.' 'Red'; Finish 11 }
Say ''
Say ('1. Αντίγραφα ασφαλείας και οδηγίες επαναφοράς: {0}: ΕΝΤΑΞΕΙ' -f $bdir) 'Green'

# Step 2. The database and its table
if (-not $dbId) {
    $c = Invoke-Wrangler $deploy ('d1 create {0}' -f $DbName) -Retry
    if ($c.code -ne 0 -and $c.text -notmatch '(?i)already exists') { Say 'Η βάση δεν έγινε. Τίποτα άλλο δεν άλλαξε. Έξοδος:' 'Red'; Say $c.text; Finish 9 }
    $dbId = Get-PosterDbId $deploy
    if (-not $dbId) { Say 'Η βάση έγινε, αλλά δεν τη βρίσκω στη λίστα. Ξανατρέξε την ίδια εντολή σε 1 λεπτό (είναι ασφαλές).' 'Red'; Finish 9 }
}
$tpl = [System.IO.File]::ReadAllText((Join-Path $postersDir 'wrangler.jsonc.example'))
if ($tpl.IndexOf('REPLACE_WITH_DATABASE_ID') -lt 0) { Say 'Το πρότυπο του Worker μέτρησης δεν έχει τη μορφή που περίμενα.' 'Red'; Finish 13 }
$counterCfg = Join-Path $postersDir 'wrangler.jsonc'
[System.IO.File]::WriteAllText($counterCfg, $tpl.Replace('REPLACE_WITH_DATABASE_ID', $dbId), (New-Object System.Text.UTF8Encoding($false)))
Copy-Item -LiteralPath $counterCfg -Destination (Join-Path $WorkDir 'wrangler.jsonc') -Force
$m = Invoke-Wrangler $postersDir ('d1 migrations apply {0} --remote' -f $DbName) -Retry
if ($m.code -ne 0) { Say 'Ο πίνακας poster_scans δεν έγινε. Τα sites δεν άλλαξαν. Έξοδος:' 'Red'; Say $m.text; Finish 9 }
$t = Select-Posters $postersDir "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'poster_scans'"
if ($null -eq $t -or $t.Count -ne 1) { Say 'Δεν βρίσκω τον πίνακα poster_scans μετά το migration. Τα sites δεν άλλαξαν.' 'Red'; Finish 9 }
Say ('2. Βάση {0} και πίνακας poster_scans: ΕΝΤΑΞΕΙ' -f $DbName) 'Green'

# Step 3. The private counter Worker
$d = Invoke-Deploy $postersDir $counterCfg
if ($d.code -ne 0) { Say 'Ο Worker μέτρησης δεν ανέβηκε. Τα sites δεν άλλαξαν. Έξοδος:' 'Red'; Say $d.text; Finish 9 }
$cv = Get-LiveVersion $postersDir $Counter
if (-not $cv -or $cv -eq 'missing') { Say 'Ο Worker μέτρησης ανέβηκε, αλλά δεν τον βρίσκω. Τα sites δεν άλλαξαν. Ξανατρέξε σε 1 λεπτό (είναι ασφαλές).' 'Red'; Finish 9 }
Say ('3. Worker {0} (χωρίς δημόσια διεύθυνση): ΕΝΤΑΞΕΙ' -f $Counter) 'Green'

# Step 4. POSTERS in the live configs of this PC (TGW, AGW, VGW, SGW)
foreach ($s in @($Sites | Where-Object { $_.pc })) {
    $cfg = Join-Path (Join-Path $PcHome $s.pc) 'wrangler.jsonc'
    $st = Invoke-PosterConfig 'add' $cfg
    if ($st -ne 'added' -and $st -ne 'already') {
        Copy-Item -LiteralPath (Join-Path $bdir ($s.pc + '.wrangler.jsonc')) -Destination $cfg -Force
        Say ('Η γραμμή POSTERS δεν μπήκε στο {0} ({1}): το αρχείο γύρισε όπως ήταν. Κανένα site δεν άλλαξε.' -f $cfg, $st) 'Red'
        Finish 10
    }
}
Say '4. Γραμμή POSTERS στις ρυθμίσεις των TGW, AGW, VGW, SGW: ΕΝΤΑΞΕΙ' 'Green'

# Step 5. The 10 sites, each with its own update step (its checks, its rollback note, its live test)
$psExe = (Get-Process -Id $PID).Path
$done = @()
foreach ($s in $Sites) {
    Say ''
    Say ('5. {0}: ενημέρωση με το {1}.ps1 -Step update ...' -f $s.code.ToUpper(), $s.tool) 'Cyan'
    $tool = Join-Path $SiteToolDir ($s.tool + '.ps1')
    $started = Get-Date
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $tool, '-Step', 'update', '-Apply', '-Approve', ('EGKRINO {0} UPDATE' -f $s.code.ToUpper()), '-OutDir', $OutDir, '-NoClipboard')
    if ($SkipInstall) { $a += '-SkipInstall' }
    if ($NoHttpCheck) { $a += '-NoHttpCheck' }
    & $psExe @a
    $code = $LASTEXITCODE
    $rep = @(Get-ChildItem -LiteralPath $OutDir -Filter '*.txt' -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $started.AddSeconds(-2) -and $_.Name -notlike 'POSTER_SETUP_*' } | Sort-Object LastWriteTime | Select-Object -Last 1)
    if ($rep.Count -eq 1) {
        foreach ($line in @([System.IO.File]::ReadAllLines($rep[0].FullName) | Select-Object -Last 4)) { $L.Add('     ' + $line) }
    }
    if ($code -ne 0) {
        Say ('   {0}: ΠΡΟΒΛΗΜΑ - το update σταμάτησε (κωδικός {1}). Σταματώ εδώ: τα επόμενα sites και το Hub ΔΕΝ άλλαξαν.' -f $s.code.ToUpper(), $code) 'Red'
        Say ('   Ανέβηκαν ήδη: {0}. Δουλεύουν κανονικά. Επαναφορά τους, αν χρειαστεί: {1}' -f $(if ($done.Count) { $done -join ', ' } else { '(κανένα)' }), $noteFile)
        Finish 12
    }
    $done += $s.code.ToUpper()
    Say ('   {0}: ΕΝΤΑΞΕΙ' -f $s.code.ToUpper()) 'Green'
}

# Step 6. The Hub
Say ''
Say '6. HUB: POSTERS στο wrangler.toml και τα νέα αρχεία στον φάκελο του Hub...' 'Cyan'
$hadBefore = @{}
foreach ($rel in $hubPlan) { $hadBefore[$rel] = (Test-Path -LiteralPath (Local-Path $HubDir $rel) -PathType Leaf) }
$hubKeep = Join-Path $bdir 'hub-files-before'
foreach ($rel in $hubPlan) {
    if ($hadBefore[$rel]) {
        $dst = Local-Path $hubKeep $rel
        New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
        Copy-Item -LiteralPath (Local-Path $HubDir $rel) -Destination $dst -Force
    }
}
function Restore-Hub {
    foreach ($rel in $hubPlan) {
        $dst = Local-Path $HubDir $rel
        if ($hadBefore[$rel]) { Copy-Item -LiteralPath (Local-Path $hubKeep $rel) -Destination $dst -Force }
        elseif (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
    }
    Copy-Item -LiteralPath (Join-Path $bdir 'gear-world-hub.wrangler.toml') -Destination $hubCfg -Force
}
$st = Invoke-PosterConfig 'add' $hubCfg
if ($st -ne 'added' -and $st -ne 'already') { Restore-Hub; Say ('Η γραμμή POSTERS δεν μπήκε στο wrangler.toml του Hub ({0}): ο φάκελος γύρισε όπως ήταν, το Hub ΔΕΝ άλλαξε. Τα 10 sites μετράνε ήδη.' -f $st) 'Red'; Finish 10 }
foreach ($rel in $hubPlan) {
    $dst = Local-Path $HubDir $rel
    New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
    Copy-Item -LiteralPath (Local-Path $gwhRepo $rel) -Destination $dst -Force
}
$bad = @($hubPlan | Where-Object { (Get-FileSha (Local-Path $HubDir $_)) -ne $newSha[$_] })
if ($bad.Count -gt 0) { Restore-Hub; Say ('Τα νέα αρχεία δεν γράφτηκαν σωστά ({0}): ο φάκελος γύρισε όπως ήταν, το Hub ΔΕΝ άλλαξε.' -f ($bad -join ', ')) 'Red'; Finish 10 }
$d = Invoke-Deploy $gwhDeploy $hubCfg
if ($d.code -ne 0) {
    Restore-Hub
    Say 'Το ανέβασμα του Hub απέτυχε: το live Hub έμεινε όπως ήταν και ο φάκελός του γύρισε όπως ήταν. Τα 10 sites μετράνε ήδη. Έξοδος:' 'Red'
    Say $d.text
    Finish 9
}
Say ('   HUB: ανέβηκε ({0}): ΕΝΤΑΞΕΙ' -f ($hubPlan -join ', ')) 'Green'

# Step 7. Every home page answers (no utm_source and a bot user agent: these checks are never counted)
Say ''
Say '7. Έλεγχος των αρχικών σελίδων:'
$allOk = $true
if (-not $NoHttpCheck) {
    Start-Sleep -Seconds 5
    foreach ($dom in @(@($Sites | ForEach-Object { $_.domain }) + 'gearworldhub.com')) {
        $c = Get-HomeStatus $dom
        if ($c -eq 200) { Say ('   https://{0}/ απαντά 200: ΕΝΤΑΞΕΙ' -f $dom) 'Green' }
        else { $allOk = $false; Say ('   https://{0}/ απαντά {1}: ΠΡΟΒΛΗΜΑ (ξαναδές σε 1 λεπτό· επαναφορά από το {2})' -f $dom, $c, $noteFile) 'Red' }
    }
} else { Say '   (παραλείφθηκε: -NoHttpCheck)' }
Say ''
Say 'Για το live-baseline.txt του Hub (το ενημερώνει το Claude):'
foreach ($rel in $hubPlan) { Say ('  {0} | {1} | {2} | file' -f $rel, (Get-Item -LiteralPath (Local-Path $HubDir $rel)).Length, $newSha[$rel]) }
Say ''
if ($allOk) { Say 'ΕΤΟΙΜΟ: οι 10 sites και το Hub μετράνε τις σαρώσεις των αφισών. Πες στο Claude να κάνει τη δοκιμή.' 'Green' }
else { Say 'ΣΧΕΔΟΝ ΕΤΟΙΜΟ: όλα ανέβηκαν, αλλά κάποια αρχική δεν απάντησε 200 (δες πιο πάνω). Στείλε αυτή την αναφορά στο Claude.' 'Yellow' }
Finish 0
