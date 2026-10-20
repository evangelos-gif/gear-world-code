<#
.SYNOPSIS
  Women's Gear World on the shared Gear World engine (the same code as TGW) - one step at a time, each with a typed approval.

.DESCRIPTION
  The site keeps its database exactly as it is: no table, product or click is changed by these steps.
  The Hub import router keeps writing to the same database the same way.

  -Step check    READ-ONLY. Cloudflare login, the WGW database (product counts per category and retailer),
                 the current live version of the WGW Worker. Changes nothing.
  -Step preview  CHANGES CLOUDFLARE (a NEW test Worker only). Publishes the new WGW as a separate Worker
                 "womens-gear-world-preview" on a *.workers.dev test address, reading the same database.
                 womensgearworld.com does NOT change. Test clicks are not recorded. Hidden from Google.
                 Approval phrase: ΕΓΚΡΙΝΩ WGW PREVIEW
  -Step switch   CHANGES THE LIVE SITE. Backs up the old site code first (zip from the old site folder and the
                 Cloudflare version number), then publishes the new WGW into the existing Worker
                 "womens-gear-world" on womensgearworld.com. Same database, same product addresses.
                 Approval phrase: ΕΓΚΡΙΝΩ WGW SWITCH
  -Step update   CHANGES THE LIVE SITE. Publishes a newer version of the new WGW (after the switch).
                 Approval phrase: ΕΓΚΡΙΝΩ WGW UPDATE

  Without -Apply, every step only shows what it WOULD do. With -Apply, it still asks for the approval phrase.
  It never touches the other Gear World sites, the Hub or any database.

  Files on this PC: <home>\womens-gear-world-engine\ (wrangler configs with the database ID, deploy\, backups\)
  The old site folder <home>\womens-gear-world\ is only read (for the backup zip), never changed.
  Report: <home>\gear-world-reports\WGW_ENGINE_<step>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'preview', 'switch', 'update')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$WorkDir = '',
    [string]$OldSiteDir = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard,
    [switch]$NoHttpCheck
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$DbName = 'womens-gear-world'
$WorkerName = 'womens-gear-world'
$PreviewName = 'womens-gear-world-preview'
$Domain = 'womensgearworld.com'
$Phrases = @{ preview = 'ΕΓΚΡΙΝΩ WGW PREVIEW'; switch = 'ΕΓΚΡΙΝΩ WGW SWITCH'; update = 'ΕΓΚΡΙΝΩ WGW UPDATE' }
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'womens-gear-world-engine' }
if (-not $OldSiteDir) { $OldSiteDir = Join-Path $HOME 'womens-gear-world' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$DashLink = 'https://dash.cloudflare.com/?to=/:account/workers/services/view/womens-gear-world/production/deployments'

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('WGW_ENGINE_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    # Two runs in the same second must not overwrite each other's report.
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('WGW_ENGINE_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = $L -join "`r`n"
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
# -Retry: on a network error ("fetch failed") try again, up to 3 times. Only for calls that are safe to repeat.
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$NonInteractive, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tmp = [System.IO.Path]::GetTempPath()
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder))
    if ($NonInteractive) { $lines += 'set CI=true' }
    $lines += 'set WRANGLER_SEND_METRICS=false'
    $lines += 'set FORCE_COLOR=0'
    $lines += 'set NO_COLOR=1'
    $lines += ('call npx --yes wrangler {0} 2>&1' -f $Arguments)
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path $tmp ('gw-wrangler-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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
        Say ('Πρόβλημα δικτύου με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/{2})...' -f (5 * $try), ($try + 1), $tries) 'Yellow'
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

function Mask-Id([string]$id) { if ($id.Length -ge 8) { return $id.Substring(0, 4) + '...' + $id.Substring($id.Length - 4) } else { return $id } }

function Find-Database([string]$folder) {
    $r = Invoke-Wrangler $folder 'd1 list --json' -Retry
    $list = Get-JsonArray $r.text
    if ($null -eq $list) { return @{ ok = $false; text = $r.text } }
    foreach ($db in $list) {
        if ($db.name -eq $DbName) { return @{ ok = $true; found = $true; id = [string]$db.uuid } }
    }
    return @{ ok = $true; found = $false; id = '' }
}

# Read-only SELECT on the live WGW database. Only SELECT is ever sent.
function Read-Db([string]$folder, [string]$sql) {
    if ($sql -notmatch '^\s*SELECT\s' -or $sql -match ';|\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|PRAGMA)\b') { throw 'Only one SELECT is allowed' }
    $r = Invoke-Wrangler $folder ('d1 execute {0} --remote --json --command "{1}"' -f $DbName, $sql) -NonInteractive -Retry
    $rows = Get-JsonArray $r.text
    if ($null -eq $rows -or $rows.Count -eq 0) { return $null }
    return @($rows[0].results)
}

# The version of the Worker that is live now (for going back). Read-only.
function Get-LiveVersion([string]$folder, [string]$name) {
    $r = Invoke-Wrangler $folder ('deployments list --name {0}' -f $name) -NonInteractive -Retry
    $ms = [regex]::Matches($r.text, '\(100%\)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($ms.Count -eq 0) { return '' }
    return $ms[$ms.Count - 1].Groups[1].Value
}

# Copy of this repo version with the real configs, ready for wrangler (npm ci once per version).
function Prepare-Deploy {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        # promos: discount codes shared by the sites (sites/*/site.config.js imports it).
        foreach ($item in @('src', 'sites', 'promos', 'package.json', 'package-lock.json')) {
            Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Recurse -Force
        }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-npm-ci.cmd'
        $body = "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n"
        [System.IO.File]::WriteAllText($cmdFile, $body, [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
    }
    return $dest
}

# Writes the real wrangler config from the template. -Preview: test Worker, no domains, clicks not recorded.
# Live: the existing Worker with its two custom domains.
function Write-Config([string]$folder, [string]$dbId, [switch]$Preview) {
    $text = [System.IO.File]::ReadAllText((Join-Path $folder 'wrangler.jsonc.example'))
    $text = $text.Replace('REPLACE_WITH_DATABASE_ID', $dbId)
    $obs = '"observability": { "enabled": true }'
    if ($text.IndexOf($obs) -lt 0) { Say 'Το πρότυπο wrangler.jsonc.example δεν έχει τη μορφή που περίμενα.' 'Red'; Finish 13 }
    if ($Preview) {
        $text = $text.Replace('"name": "womens-gear-world"', ('"name": "{0}"' -f $PreviewName))
        $text = $text.Replace($obs, $obs + ',' + "`r`n" + '  "vars": { "CLICK_LOG": "off" }')
        $file = Join-Path $folder 'wrangler.preview.jsonc'
    } else {
        $routes = $obs + ',' + "`r`n" + '  "routes": [' + "`r`n" +
            ('    {{ "pattern": "{0}", "custom_domain": true }},' -f $Domain) + "`r`n" +
            ('    {{ "pattern": "www.{0}", "custom_domain": true }}' -f $Domain) + "`r`n" + '  ]'
        $text = $text.Replace($obs, $routes)
        $file = Join-Path $folder 'wrangler.jsonc'
    }
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($false)))
    Copy-Item -LiteralPath $file -Destination (Join-Path $WorkDir (Split-Path -Leaf $file)) -Force
    return $file
}

function Test-Live([string]$base) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $ok = $true
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri ($base + '/') -TimeoutSec 30
        Say ('  Αρχική: {0}, νέα μηχανή: {1}' -f $r.StatusCode, $(if ([string]$r.Content -match 'data-store="wgw"') { 'ναι' } else { 'ΟΧΙ' }))
        $api = Invoke-WebRequest -UseBasicParsing -Uri ($base + '/api/products?limit=1') -TimeoutSec 30
        $p = ($api.Content | ConvertFrom-Json).products
        if ($p -and $p.Count -ge 1) {
            $u = [string]$p[0].product_url
            $path = ([Uri]$u).AbsolutePath
            $pr = Invoke-WebRequest -UseBasicParsing -Uri ($base + $path) -TimeoutSec 30
            Say ('  Σελίδα προϊόντος {0}: {1}' -f $path, $pr.StatusCode)
            $req = [System.Net.HttpWebRequest]::Create(($base + '/out/' + $p[0].id))
            $req.AllowAutoRedirect = $false
            $req.Method = 'HEAD'
            # A browser user agent: the Cloudflare bot rule blocks "bot" on /out/ (lessons L32). HEAD is never counted as a click.
            $req.UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 GearWorldQA'
            $req.Timeout = 20000
            $resp = $req.GetResponse()
            $loc = [string]$resp.Headers['Location']
            $resp.Close()
            Say ('  Κουμπί καταστήματος: {0}' -f $(if ($loc -match '^https://www\.awin1\.com/') { 'μέσω Awin (με προμήθεια)' } else { 'ΟΧΙ μέσω Awin: ' + $loc.Substring(0, [Math]::Min(80, $loc.Length)) }))
        }
    } catch {
        $ok = $false
        Say ('  Δεν απάντησε ακόμα ({0}). Συνήθως θέλει 1-2 λεπτά.' -f $_.Exception.Message) 'Yellow'
    }
    return $ok
}

# ---------------- start ----------------
Say ('WGW ENGINE - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$deploy = Prepare-Deploy
$wgw = Join-Path (Join-Path $deploy 'sites') 'wgw'

$who = $null
for ($try = 1; $try -le 3; $try++) {
    $who = Invoke-Wrangler $wgw 'whoami'
    if ($who.text -match '(?i)associated with the email|you are logged in') { break }
    if ($try -lt 3) { Start-Sleep -Seconds 5 }
}
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    if ($who.text -match '(?i)not authenticated|wrangler login') {
        Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα (θα σου δώσει την εντολή σύνδεσης).' 'Red'
    } else {
        Say 'Δεν μπόρεσα να ελέγξω τη σύνδεση με το Cloudflare (ίσως πρόβλημα δικτύου). Στείλε στο Claude αυτό το μήνυμα.' 'Red'
    }
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 20)) { Say ('  ' + $line) }
    Finish 4
}
$accounts = @([regex]::Matches($who.text, '\b[0-9a-f]{32}\b') | ForEach-Object { $_.Value } | Select-Object -Unique)
if ($accounts.Count -gt 1 -and -not $env:CLOUDFLARE_ACCOUNT_ID) {
    Say ('Βρέθηκαν {0} λογαριασμοί Cloudflare. Στείλε στο Claude αυτό το μήνυμα για να διαλέξουμε τον σωστό.' -f $accounts.Count) 'Red'
    Finish 4
}
Say 'Cloudflare login: OK'

$db = Find-Database $wgw
if (-not $db.ok) { Say 'Δεν μπόρεσα να διαβάσω τη λίστα των D1. Έξοδος του wrangler:' 'Red'; Say $db.text; Finish 5 }
if (-not $db.found) { Say ('Δεν βρέθηκε η D1 "{0}". Στείλε στο Claude αυτό το μήνυμα: δεν αλλάζω τίποτα.' -f $DbName) 'Red'; Finish 5 }
Say ('D1 "{0}": υπάρχει ({1}) - μένει όπως είναι' -f $DbName, (Mask-Id $db.id))

# What the new site will show (read-only)
$cats = Read-Db $wgw 'SELECT site_category, COUNT(*) AS n FROM products WHERE is_active = 1 GROUP BY site_category ORDER BY n DESC'
if ($cats) {
    Say 'Προϊόντα ανά κατηγορία (ενεργά):'
    foreach ($c in $cats) { Say ('  {0,-45} {1}' -f $c.site_category, $c.n) }
}
$rets = Read-Db $wgw 'SELECT retailer, COUNT(*) AS n, SUM(CASE WHEN substr(affiliate_url, 1, 22) = ''https://www.awin1.com/'' THEN 1 ELSE 0 END) AS awin FROM products WHERE is_active = 1 GROUP BY retailer ORDER BY n DESC'
if ($rets) {
    Say 'Καταστήματα (προϊόντα / ήδη με link Awin στη βάση):'
    foreach ($r in $rets) {
        $fix = $(if ([int]$r.awin -eq [int]$r.n) { 'ήδη Awin' } else { 'ΧΩΡΙΣ Awin: χωρίς προμήθεια' })
        Say ('  {0,-25} {1,6} / {2,-6} {3}' -f $r.retailer, $r.n, $r.awin, $fix)
    }
}
$live = Get-LiveVersion $wgw $WorkerName
Say ('Ζωντανή έκδοση του Worker "{0}": {1}' -f $WorkerName, $(if ($live) { $live } else { '(δεν τη βρήκα)' }))

switch ($Step) {
    'check' {
        Say ''
        Say 'Μόνο έλεγχος: δεν άλλαξε τίποτα.' 'Green'
        Finish 0
    }

    'preview' {
        Say ''
        Say 'Τι θα γίνει:'
        Say ('  - Νέος, ξεχωριστός Worker "{0}" σε δοκιμαστική διεύθυνση *.workers.dev.' -f $PreviewName)
        Say ('  - Διαβάζει την ίδια D1. Οι δοκιμαστικές επισκέψεις στα καταστήματα ΔΕΝ γράφονται στη βάση.')
        Say ('  - Το {0} ΔΕΝ αλλάζει. Η Google δεν βλέπει τη δοκιμαστική διεύθυνση (noindex).' -f $Domain)
        Say ('  - Επαναφορά (αν χρειαστεί): npx wrangler delete --name {0}' -f $PreviewName)
        if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
        if (-not (Confirm-Approval $Phrases.preview)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
        $cfg = Write-Config $wgw $db.id -Preview
        $d = Invoke-Wrangler $wgw ('deploy --config "{0}"' -f $cfg) -NonInteractive
        if ($d.code -ne 0) { Say 'Το ανέβασμα απέτυχε. Τίποτα δεν άλλαξε στο live site. Έξοδος:' 'Red'; Say $d.text; Finish 9 }
        $um = [regex]::Match($d.text, 'https://[A-Za-z0-9\.\-]+\.workers\.dev')
        $url = $(if ($um.Success) { $um.Value } else { '' })
        Say ('Ανέβηκε. Δοκιμαστική διεύθυνση: {0}' -f $(if ($url) { $url } else { '(δεν τη βρήκα στην έξοδο)' })) 'Green'
        if ($url -and -not $NoHttpCheck) { Start-Sleep -Seconds 5; [void](Test-Live $url) }
        Say ''
        Say 'ΕΤΟΙΜΟ: άνοιξε τη δοκιμαστική διεύθυνση στο κινητό. Το live WGW δεν άλλαξε.' 'Green'
        Finish 0
    }

    { $_ -eq 'switch' -or $_ -eq 'update' } {
        $phrase = $Phrases[$Step]
        Say ''
        Say 'Τι θα γίνει:'
        if ($Step -eq 'switch') {
            Say ('  - ΠΡΩΤΑ αντίγραφο ασφαλείας: zip του παλιού κώδικα από {0} και ο αριθμός της ζωντανής έκδοσης.' -f $OldSiteDir)
            Say ('  - Μετά ο Worker "{0}" ({1} και www) παίρνει τη νέα μηχανή.' -f $WorkerName, $Domain)
        } else {
            Say ('  - Ο Worker "{0}" ({1}) παίρνει την έκδοση {2}.' -f $WorkerName, $Domain, (Split-Path -Leaf $repo))
        }
        Say '  - Η D1, τα προϊόντα, οι διευθύνσεις των προϊόντων και ο router ΔΕΝ αλλάζουν. Τα άλλα sites και το hub ΔΕΝ αλλάζουν.'
        Say ('  - Επαναφορά (αν χρειαστεί, 1 λεπτό): Cloudflare > womens-gear-world > Deployments > η προηγούμενη έκδοση > Rollback: {0}' -f $DashLink)
        if ($live) { Say ('    ή στο PowerShell: npx wrangler rollback {0} --name {1}' -f $live, $WorkerName) }
        if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
        if (-not (Confirm-Approval $phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
        $bdir = Join-Path $WorkDir 'backups'
        if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
        if (-not $live) { Say 'Δεν βρήκα τον αριθμό της ζωντανής έκδοσης: για ασφάλεια ΔΕΝ ανέβασα τίποτα.' 'Red'; Finish 11 }
        $note = @(
            ('WGW before {0}, {1}' -f $Step, (Get-Date -Format 'yyyy-MM-dd HH:mm')),
            ('Live version before: {0}' -f $live),
            'To go back (only with approval):',
            ('  {0}' -f $DashLink),
            ('  npx wrangler rollback {0} --name {1}' -f $live, $WorkerName)
        )
        if ($Step -eq 'switch') {
            if (-not (Test-Path -LiteralPath (Join-Path $OldSiteDir 'worker.js'))) { Say ('Δεν βρήκα τον παλιό κώδικα στο {0}: για ασφάλεια ΔΕΝ ανέβασα τίποτα.' -f $OldSiteDir) 'Red'; Finish 11 }
            $tmpCopy = Join-Path ([System.IO.Path]::GetTempPath()) ('wgw-old-' + $stamp)
            New-Item -ItemType Directory -Path $tmpCopy -Force | Out-Null
            foreach ($f in @(Get-ChildItem -LiteralPath $OldSiteDir -File | Where-Object { $_.Name -match '\.(js|mjs|jsonc|json|toml|html|txt|md)$' -and $_.Name -notmatch '^\.dev\.vars' })) {
                Copy-Item -LiteralPath $f.FullName -Destination $tmpCopy -Force
            }
            if (Test-Path -LiteralPath (Join-Path $OldSiteDir 'public')) { Copy-Item -LiteralPath (Join-Path $OldSiteDir 'public') -Destination $tmpCopy -Recurse -Force }
            $zip = Join-Path $bdir ('old-wgw-site-' + $stamp + '.zip')
            Compress-Archive -Path (Join-Path $tmpCopy '*') -DestinationPath $zip -Force
            Remove-Item -LiteralPath $tmpCopy -Recurse -Force
            if (-not (Test-Path -LiteralPath $zip)) { Say 'Το αντίγραφο ασφαλείας δεν γράφτηκε: ΔΕΝ ανέβασα τίποτα.' 'Red'; Finish 11 }
            $note += ('Old site code: {0}' -f $zip)
            Say ('Αντίγραφο του παλιού κώδικα: {0}' -f $zip) 'Green'
        }
        $noteFile = Join-Path $bdir ('wgw-before-' + $Step + '-' + $stamp + '.txt')
        [System.IO.File]::WriteAllText($noteFile, ($note -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
        Say ('Σημείωμα επαναφοράς: {0}' -f $noteFile) 'Green'
        $cfg = Write-Config $wgw $db.id
        $d = Invoke-Wrangler $wgw ('deploy --config "{0}"' -f $cfg) -NonInteractive
        if ($d.code -ne 0) { Say 'Το ανέβασμα απέτυχε. Το live site έμεινε όπως ήταν. Έξοδος:' 'Red'; Say $d.text; Finish 9 }
        Say ('Ανέβηκε στο {0}.' -f $Domain) 'Green'
        if (-not $NoHttpCheck) { Start-Sleep -Seconds 5; [void](Test-Live ('https://' + $Domain)) }
        Say ''
        Say ('ΕΤΟΙΜΟ: το https://{0} τρέχει τη νέα μηχανή. Αν κάτι δεν σου αρέσει: Rollback (οδηγίες πιο πάνω).' -f $Domain) 'Green'
        Finish 0
    }
}
