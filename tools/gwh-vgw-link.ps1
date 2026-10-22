<#
.SYNOPSIS
  Gear World Hub - adds Travel Gear World (VGW) to the hub, as the 9th site after Car (AGW). Read-only unless -Apply and the typed approval.

.DESCRIPTION
  Without -Apply (READ-ONLY): checks that
    - the hub folder on this PC is the same as the live gearworldhub.com (otherwise a deploy could undo other work),
    - the hub files look exactly as expected for the change,
    - VGW answers the hub search (/api/products) and the hub links (/?search=..&highlight=..) (QA gate L22),
  and shows the hub site list from the hub D1. Nothing is changed.

  With -Apply and the phrase ΕΓΚΡΙΝΩ VGW HUB LINK:
    1. Backup: copies of index.html and translations.js, and a Cloudflare Time Travel restore point of the hub D1.
    2. Hub homepage: Travel card (photo hub-vgw.jpg) after Car, texts in 11 languages, "nine worlds". Deploys the hub.
    3. Hub D1: one new row in "sites" for VGW, so the hub search also searches VGW. No categories, no routing rules,
       so the central import pipeline does not send any products to VGW.
    4. Checks the live hub.
  Rollback steps are written to <hub>\backups\vgw-hub-link-<time>\ROLLBACK.txt and to the report.

  Report: <home>\gear-world-reports\GWH_VGW_LINK_<time>.txt (also copied to the clipboard)
#>
param(
    [switch]$Apply,
    [string]$Approve = '',
    [string]$HubDir = '',
    [string]$OutDir = '',
    [string]$HubUrl = 'https://gearworldhub.com',
    [string]$VgwUrl = 'https://travelgearworld.com',
    [switch]$SkipOnline,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ VGW HUB LINK'
$HubDbName = 'gear-world-registry'
$HubWorker = 'gear-world-hub'
if (-not $HubDir) { $HubDir = Join-Path $HOME 'gear-world-hub' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$public = Join-Path $HubDir 'public'

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
    $file = Join-Path $OutDir ('GWH_VGW_LINK_{0}.txt' -f $stamp)
    $text = Hide-Ids ($L -join "`r`n")
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

# Runs wrangler in the hub folder through a temporary .cmd file (plain text output in Windows PowerShell 5.1).
function Invoke-Wrangler([string]$Arguments, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $lines = @('@echo off', ('cd /d "{0}"' -f $HubDir), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-hub-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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

function Get-JsonArray([string]$text) {
    $i = $text.IndexOf('[')
    $j = $text.LastIndexOf(']')
    if ($i -lt 0 -or $j -le $i) { return $null }
    try { return @($text.Substring($i, $j - $i + 1) | ConvertFrom-Json) } catch { return $null }
}

function Get-Sha([byte[]]$bytes) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '') } finally { $sha.Dispose() }
}

function Get-Bytes([string]$url) {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add('User-Agent', 'GearWorldQA-bot/1.0 (+read-only check)')
    try { return $wc.DownloadData($url) } finally { $wc.Dispose() }
}

function Get-NoRedirect([string]$url) {
    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.AllowAutoRedirect = $false
    $req.Timeout = 20000
    $req.UserAgent = 'GearWorldQA-bot/1.0 (+read-only check)'
    try { $resp = $req.GetResponse() } catch [System.Net.WebException] { $resp = $_.Exception.Response }
    if (-not $resp) { return @{ status = 0; location = '' } }
    $r = @{ status = [int]$resp.StatusCode; location = [string]$resp.Headers['Location'] }
    $resp.Close()
    return $r
}

function Run-Patcher([string[]]$extra) {
    $mjs = Join-Path (Join-Path $repo 'tools') 'gwh-vgw-link.mjs'
    $out = & node $mjs --hub $HubDir @extra
    $code = $LASTEXITCODE
    $json = $null
    try { $json = (($out | ForEach-Object { "$_" }) -join "`n") | ConvertFrom-Json } catch { $json = $null }
    return @{ code = $code; json = $json; text = (($out | ForEach-Object { "$_" }) -join "`n") }
}

Say ('GWH VGW LINK - {0} - {1}' -f $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ' }), (Get-Date -Format 'yyyy-MM-dd HH:mm'))
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# 1. Hub folder
$toml = Join-Path $HubDir 'wrangler.toml'
if (-not (Test-Path -LiteralPath $toml)) { Say ('Δεν βρήκα το hub στο {0}.' -f $HubDir) 'Red'; Finish 2 }
$tomlText = [System.IO.File]::ReadAllText($toml)
if ($tomlText -notmatch ('(?m)^\s*name\s*=\s*"{0}"' -f $HubWorker) -or $tomlText -notmatch ('database_name\s*=\s*"{0}"' -f $HubDbName)) {
    Say 'Το wrangler.toml του hub δεν είναι αυτό που περίμενα: σταμάτησα.' 'Red'; Finish 2
}
Say ('Hub folder: {0}' -f $HubDir)

# 2. Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Say 'Δεν βρέθηκε το Node.js.' 'Red'; Finish 3 }

# 3. Can the hub files be changed safely?
$plan = Run-Patcher @()
if ($plan.code -ne 0 -or -not $plan.json) {
    Say 'Τα αρχεία του hub δεν έχουν τη μορφή που περίμενα: ΔΕΝ αλλάζω τίποτα.' 'Red'
    Say $(if ($plan.json) { $plan.json.error } else { $plan.text })
    Finish 6
}
$filesDone = [bool]$plan.json.already
Say ('Αρχική σελίδα του hub: {0}' -f $(if ($filesDone) { 'έχει ήδη το VGW' } else { 'μπορεί να αλλάξει με ασφάλεια' }))

if (-not $SkipOnline) {
    # 4a. Is the hub folder on this PC the same as the live hub? (A deploy uploads the whole folder.)
    $diff = @()
    foreach ($f in @(Get-ChildItem -LiteralPath $public -File)) {
        $path = '/' + $f.Name
        if ($f.Name -eq 'index.html') { $path = '/' }
        try {
            $live = Get-Bytes ($HubUrl + $path)
            if ((Get-Sha $live) -ne (Get-Sha ([System.IO.File]::ReadAllBytes($f.FullName)))) { $diff += $f.Name }
        } catch { $diff += ($f.Name + ' (δεν το βρήκα live)') }
    }
    if ($diff.Count -gt 0) {
        Say 'Τα αρχεία του hub σε αυτόν τον υπολογιστή ΔΙΑΦΕΡΟΥΝ από το live gearworldhub.com:' 'Red'
        foreach ($d in $diff) { Say ('  - ' + $d) }
        Say 'Ένα deploy από εδώ θα άλλαζε και αυτά. ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' 'Red'
        Finish 7
    }
    Say 'Τα αρχεία του hub εδώ είναι ίδια με το live: OK' 'Green'

    # 4b. worker.js changed after the last deploy?
    $dep = Invoke-Wrangler 'deployments list --json' -Retry
    $times = @()
    foreach ($m in [regex]::Matches($dep.text, '"created_on"\s*:\s*"([^"]+)"')) {
        $t = [datetime]::MinValue
        if ([datetime]::TryParse($m.Groups[1].Value, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal, [ref]$t)) { $times += $t }
    }
    $worker = Get-Item -LiteralPath (Join-Path $HubDir 'worker.js')
    if ($times.Count -gt 0) {
        $lastDeploy = ($times | Sort-Object | Select-Object -Last 1)
        Say ('Τελευταίο deploy του hub: {0:yyyy-MM-dd HH:mm} UTC · worker.js: {1:yyyy-MM-dd HH:mm} UTC' -f $lastDeploy, $worker.LastWriteTimeUtc)
        if ($worker.LastWriteTimeUtc -gt $lastDeploy.AddMinutes(10)) {
            Say 'Το worker.js άλλαξε ΜΕΤΑ το τελευταίο deploy: ένα deploy θα ανέβαζε και αυτή την αλλαγή. ΔΕΝ αλλάζω τίποτα.' 'Red'
            Finish 7
        }
    } else {
        Say 'Δεν μπόρεσα να διαβάσω την ώρα του τελευταίου deploy. Συνεχίζω, γιατί τα αρχεία της σελίδας είναι ίδια με το live.' 'Yellow'
    }

    # 4c. Does VGW answer the hub search and the hub links?
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $api = (New-Object System.Text.UTF8Encoding($false)).GetString((Get-Bytes ($VgwUrl + '/api/products?search=suitcase&page=1&limit=8'))) | ConvertFrom-Json
        $sw.Stop()
        $first = @($api.products)[0]
        if (-not $first -or -not $first.id) { throw 'no products' }
        Say ('VGW /api/products: {0} προϊόντα σε {1} ms: OK' -f @($api.products).Count, $sw.ElapsedMilliseconds) 'Green'
        $h = Get-NoRedirect ('{0}/?search=suitcase&highlight={1}' -f $VgwUrl, $first.id)
        if ($h.status -ne 302 -or $h.location -notmatch ('-{0}/$' -f $first.id)) { throw ('hub link gives {0} {1}' -f $h.status, $h.location) }
        Say 'VGW link από την αναζήτηση του hub ανοίγει το προϊόν: OK' 'Green'
    } catch {
        Say ('Το VGW δεν είναι ακόμα έτοιμο για την αναζήτηση του hub ({0}). ΔΕΝ αλλάζω τίποτα.' -f $_.Exception.Message) 'Red'
        Finish 8
    }
}

# 5. Hub D1: site list (read-only)
$q = Invoke-Wrangler ('d1 execute {0} --remote --json --command "SELECT site_key, domain, priority, is_active FROM sites ORDER BY priority"' -f $HubDbName) -Retry
$rows = Get-JsonArray $q.text
if (-not $rows) { Say 'Δεν μπόρεσα να διαβάσω τη λίστα των sites από τη D1 του hub. Έξοδος:' 'Red'; Say $q.text; Finish 5 }
$vgwRow = $false
Say 'Sites στη D1 του hub:'
foreach ($r in @($rows[0].results)) {
    Say ('  {0,-4} {1,-28} priority {2} active {3}' -f $r.site_key, $r.domain, $r.priority, $r.is_active)
    if ($r.site_key -eq 'VGW' -or $r.domain -eq 'travelgearworld.com') { $vgwRow = $true }
}

Say ''
Say 'Τι θα γίνει:'
if (-not $filesDone) {
    foreach ($c in @($plan.json.changes)) { Say ('  - ' + $c) }
    Say '  - public\hub-vgw.jpg: φωτογραφία της κάρτας Travel'
    Say '  - Deploy του hub (ίδιος κώδικας worker.js, μόνο τα 2 αρχεία και η φωτογραφία είναι νέα)'
}
if (-not $vgwRow) { Say '  - D1 του hub: μία νέα γραμμή στον πίνακα sites για το VGW (χωρίς κατηγορίες, άρα το κεντρικό import δεν στέλνει προϊόντα στο VGW)' }
if ($filesDone -and $vgwRow) { Say '  - Τίποτα: το VGW είναι ήδη στο hub.' 'Green'; Finish 0 }
Say '  - Τα 9 sites (CGW, MGW, WGW, KGW, HGW, GGW, TGW, AGW, VGW) και οι D1 τους ΔΕΝ αλλάζουν.'
if (-not $Apply) { Say ''; Say 'Μόνο έλεγχος (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# 6. Backup
$bdir = Join-Path (Join-Path $HubDir 'backups') ('vgw-hub-link-' + $stamp)
New-Item -ItemType Directory -Path $bdir -Force | Out-Null
foreach ($n in @('index.html', 'translations.js')) { Copy-Item -LiteralPath (Join-Path $public $n) -Destination $bdir -Force }
$tt = Invoke-Wrangler ('d1 time-travel info {0}' -f $HubDbName) -Retry
$bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
if ($tt.code -ne 0 -or -not $bm.Success) { Say 'Δεν πήρα σημείο επαναφοράς της D1 του hub: ΔΕΝ άλλαξα τίποτα.' 'Red'; Say $tt.text; Finish 11 }
$rollback = @(
    ('Gear World Hub - rollback of the VGW hub link, {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    'Only with approval. In PowerShell:',
    ('  cd "{0}"' -f $HubDir),
    ('  Copy-Item "{0}\index.html","{0}\translations.js" ".\public\" -Force' -f $bdir),
    '  Remove-Item ".\public\hub-vgw.jpg"',
    '  npx wrangler deploy',
    ('  npx wrangler d1 execute {0} --remote --command "UPDATE sites SET is_active = 0 WHERE site_key = ''VGW''"' -f $HubDbName),
    'Full D1 restore point (Time Travel, 7 days on Workers Free, 30 on Paid):',
    ('  npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $HubDbName, $bm.Value)
) -join "`r`n"
[System.IO.File]::WriteAllText((Join-Path $bdir 'ROLLBACK.txt'), $rollback, (New-Object System.Text.UTF8Encoding($false)))
Say ('Backup και οδηγίες επαναφοράς: {0}' -f $bdir) 'Green'

# 7. Hub homepage files + deploy
if (-not $filesDone) {
    $w = Run-Patcher @('--write')
    if ($w.code -ne 0) { Say 'Η αλλαγή των αρχείων απέτυχε: τα επαναφέρω.' 'Red'; Copy-Item -LiteralPath (Join-Path $bdir 'index.html'), (Join-Path $bdir 'translations.js') -Destination $public -Force; Finish 6 }
    Copy-Item -LiteralPath (Join-Path (Join-Path (Join-Path $repo 'tools') 'assets') 'hub-vgw.jpg') -Destination (Join-Path $public 'hub-vgw.jpg') -Force
    $d = Invoke-Wrangler 'deploy'
    if ($d.code -ne 0) {
        Say 'Το deploy του hub απέτυχε. Το live hub ΔΕΝ άλλαξε. Επαναφέρω τα αρχεία στον υπολογιστή. Έξοδος:' 'Red'
        Say $d.text
        Copy-Item -LiteralPath (Join-Path $bdir 'index.html'), (Join-Path $bdir 'translations.js') -Destination $public -Force
        Remove-Item -LiteralPath (Join-Path $public 'hub-vgw.jpg') -ErrorAction SilentlyContinue
        Finish 9
    }
    Say 'Το hub ανέβηκε με την κάρτα Travel.' 'Green'
}

# 8. Hub D1 row (the search reads the site list on every request)
if (-not $vgwRow) {
    $sql = Join-Path $bdir 'add-vgw-site.sql'
    # OR IGNORE: site_key and domain are UNIQUE, so running it twice never adds a second row.
    $sqlText = @(
        "INSERT OR IGNORE INTO sites (site_key, site_name, domain, audience, destination_db, destination_worker, priority, is_active)",
        "VALUES ('VGW', 'Travel Gear World', 'travelgearworld.com', 'travel', 'travel-gear-world', 'travel-gear-world', (SELECT COALESCE(MAX(priority), 0) + 10 FROM sites), 1);"
    ) -join "`n"
    [System.IO.File]::WriteAllText($sql, $sqlText + "`n", (New-Object System.Text.UTF8Encoding($false)))
    $x = Invoke-Wrangler ('d1 execute {0} --remote --file "{1}"' -f $HubDbName, $sql) -Retry
    if ($x.code -ne 0) { Say 'Η γραμμή του VGW στη D1 του hub δεν μπήκε. Η κάρτα υπάρχει, η αναζήτηση όχι ακόμα. Έξοδος:' 'Red'; Say $x.text; Finish 12 }
    Say 'Το VGW μπήκε στη λίστα sites της D1 του hub.' 'Green'
}

# 9. Live checks
if (-not $SkipOnline) {
    Start-Sleep -Seconds 5
    try {
        $hubPage = (New-Object System.Text.UTF8Encoding($false)).GetString((Get-Bytes ($HubUrl + '/?v=' + $stamp)))
        Say ('  Αρχική του hub με κάρτα Travel: {0}' -f $(if ($hubPage.Contains('travelgearworld.com')) { 'ναι' } else { 'ΟΧΙ ακόμα (cache, ξαναδές σε 1 λεπτό)' }))
        $s = (New-Object System.Text.UTF8Encoding($false)).GetString((Get-Bytes ($HubUrl + '/api/search?q=suitcase&v=' + $stamp))) | ConvertFrom-Json
        Say ('  Αναζήτηση hub "suitcase": VGW {0} αποτελέσματα, partial {1}' -f $s.sites.vgw, $s.partial)
    } catch {
        Say ('  Ο έλεγχος του live hub δεν ολοκληρώθηκε: {0}' -f $_.Exception.Message) 'Yellow'
    }
}
Say ''
Say 'ΕΤΟΙΜΟ: το VGW είναι στο Gear World Hub.' 'Green'
Finish 0
