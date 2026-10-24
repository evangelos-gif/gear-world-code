<#
.SYNOPSIS
  Gear World Hub - photo search (camera button). Read-only unless -Apply and the typed approval phrases.

.DESCRIPTION
  -Step check    READ-ONLY. Cloudflare login, the hub D1 (are the 2 photo-search tables there?), and whether the hub
                 folder on this PC is still exactly the code that ran live on 24/10/2026 (sites/gwh/live-baseline.txt),
                 so a later deploy never undoes a change made somewhere else.
  -Step preview  CHANGES CLOUDFLARE, two separate approvals (the live Hub gearworldhub.com does NOT change):
                   1. ΕΓΚΡΙΝΩ HUB PHOTO D1      - a Time Travel restore point of the hub D1 first, then 2 NEW tables for the
                                                  fair-use counts (sites/gwh/migrations/0001_photo_search_limits.sql).
                                                  No existing table changes. Skipped when the tables are already there.
                   2. ΕΓΚΡΙΝΩ HUB PHOTO PREVIEW - a NEW, separate Worker "gear-world-hub-preview" on a *.workers.dev test
                                                  address (noindex, no analytics, newsletter sign-up closed), with the same
                                                  D1 and Workers AI, and its own secret for the anonymous visitor code.
                 Then a short live test of the test address, including one photo search.
  Report: <home>\gear-world-reports\GWH_PHOTO_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'preview')]
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
$DbName = 'gear-world-registry'
$HubWorker = 'gear-world-hub'
$PreviewName = 'gear-world-hub-preview'
$PhraseD1 = 'ΕΓΚΡΙΝΩ HUB PHOTO D1'
$PhrasePreview = 'ΕΓΚΡΙΝΩ HUB PHOTO PREVIEW'
if (-not $HubDir) { $HubDir = Join-Path $HOME 'gear-world-hub' }
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-hub-photo' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

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
    $file = Join-Path $OutDir ('GWH_PHOTO_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('GWH_PHOTO_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
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

# -Approve may hold several phrases separated by ";" (one per change). Without it the phrase is typed.
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

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-hubphoto-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
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
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-hubphoto-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
    }
    return $dest
}

# The preview config from the template: its own Worker name, a workers.dev address, GWH_PREVIEW = "1". Never the live name.
function Write-PreviewConfig([string]$folder, [string]$dbId) {
    $text = [System.IO.File]::ReadAllText((Join-Path $folder 'wrangler.toml.example'))
    if ($text -notmatch '(?m)^name = "gear-world-hub"\r?$' -or $text.IndexOf('REPLACE_WITH_DATABASE_ID') -lt 0 -or $text -notmatch '(?m)^compatibility_date = ') {
        Say 'Το πρότυπο wrangler.toml.example δεν έχει τη μορφή που περίμενα: ΔΕΝ ανέβασα τίποτα.' 'Red'; Finish 13
    }
    $text = $text.Replace('REPLACE_WITH_DATABASE_ID', $dbId)
    $text = [regex]::Replace($text, '(?m)^name = "gear-world-hub"(\r?)$', ('name = "{0}"$1' -f $PreviewName))
    $text = [regex]::Replace($text, '(?m)^(compatibility_date = [^\r\n]+)', ('$1' + "`nworkers_dev = true"))
    $text = $text.TrimEnd() + "`n`n[vars]`nGWH_PREVIEW = `"1`"`n"
    if ($text -match '(?m)^name = "gear-world-hub"\r?$' -or $text -notmatch ('(?m)^name = "{0}"' -f $PreviewName)) { Say 'Λάθος όνομα Worker στη ρύθμιση: ΔΕΝ ανέβασα τίποτα.' 'Red'; Finish 13 }
    $file = Join-Path $folder 'wrangler.preview.toml'
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($false)))
    return $file
}

function Test-Tables([string]$folder) {
    $q = Invoke-Wrangler $folder ('d1 execute {0} --remote --json --command "SELECT name FROM sqlite_master WHERE type = ''table'' AND name IN (''photo_search_usage'', ''photo_search_daily'')"' -f $DbName) -Retry
    $rows = Get-JsonArray $q.text
    if ($null -eq $rows -or $rows.Count -eq 0) { return @{ ok = $false; text = $q.text } }
    $names = @($rows[0].results | ForEach-Object { [string]$_.name })
    return @{ ok = $true; ready = (($names -contains 'photo_search_usage') -and ($names -contains 'photo_search_daily')); names = $names }
}

# A small test photo (a drawn box), made with .NET on Windows: proves the whole chain on the test address.
function New-TestJpeg {
    Add-Type -AssemblyName System.Drawing
    $bmp = New-Object System.Drawing.Bitmap 320, 240
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.Clear([System.Drawing.Color]::White)
        $g.FillRectangle([System.Drawing.Brushes]::DarkBlue, 70, 90, 180, 60)
        $g.FillEllipse([System.Drawing.Brushes]::Orange, 130, 40, 60, 60)
    } finally { $g.Dispose() }
    $ms = New-Object System.IO.MemoryStream
    try { $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg); return $ms.ToArray() } finally { $ms.Dispose(); $bmp.Dispose() }
}

function Test-Preview([string]$base) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
        $home1 = Invoke-WebRequest -UseBasicParsing -Uri ($base + '/') -TimeoutSec 30
        $robots = ''
        foreach ($k in @($home1.Headers.Keys)) { if ($k -ieq 'X-Robots-Tag') { $robots = [string]$home1.Headers[$k] } }
        Say ('  Αρχική: {0}, κουμπί κάμερας: {1}, noindex: {2}' -f $home1.StatusCode, $(if ([string]$home1.Content -match 'gear-world-camera\.js') { 'ναι' } else { 'ΟΧΙ' }), $(if ($robots -match 'noindex') { 'ναι' } else { 'ΟΧΙ' }))
        $h = Invoke-WebRequest -UseBasicParsing -Uri ($base + '/api/health') -TimeoutSec 30
        Say ('  /api/health: {0}' -f $h.StatusCode)
        $s = (Invoke-WebRequest -UseBasicParsing -Uri ($base + '/api/search?q=drill') -TimeoutSec 60).Content | ConvertFrom-Json
        Say ('  Αναζήτηση "drill": {0} αποτελέσματα, partial {1}' -f $s.count, $s.partial)
    } catch {
        Say ('  Η δοκιμαστική διεύθυνση δεν απάντησε ακόμα ({0}). Συνήθως θέλει 1-2 λεπτά.' -f $_.Exception.Message) 'Yellow'
        return
    }
    try {
        $jpeg = New-TestJpeg
        $r = Invoke-WebRequest -UseBasicParsing -Uri ($base + '/api/photo-search') -Method Post -ContentType 'image/jpeg' -Body $jpeg -TimeoutSec 60
        $p = $r.Content | ConvertFrom-Json
        Say ('  Δοκιμή φωτογραφίας (σχήμα, όχι προϊόν): απάντηση {0}, βρήκε προϊόν: {1}, λέξεις: {2}' -f $r.StatusCode, $p.found, (@($p.keywords) -join ' '))
    } catch {
        $msg = $_.Exception.Message
        $resp = $_.Exception.Response
        if ($resp) {
            try { $sr = New-Object System.IO.StreamReader($resp.GetResponseStream()); $msg = $msg + ' ' + $sr.ReadToEnd() } catch { }
        }
        Say ('  Δοκιμή φωτογραφίας: {0}' -f $msg) 'Yellow'
    }
}

# ---------------- start ----------------
Say ('GWH PHOTO SEARCH - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }

# 1. The hub folder on this PC: still the code that ran live on 24/10/2026?
$baseline = @()
if (-not $BaselineFile) { $BaselineFile = Join-Path (Join-Path (Join-Path $repo 'sites') 'gwh') 'live-baseline.txt' }
foreach ($line in [System.IO.File]::ReadAllLines($BaselineFile)) {
    if ($line -match '^\s*#' -or -not $line.Trim()) { continue }
    $p = $line -split ' \| '
    if ($p.Count -ge 4) { $baseline += @{ path = $p[0]; bytes = [long]$p[1]; sha = $p[2]; kind = $p[3] } }
}
$cfgPc = Join-Path $HubDir 'wrangler.toml'
if (-not (Test-Path -LiteralPath $cfgPc)) { Say ('Δεν βρήκα το Hub στον υπολογιστή ({0}). Στείλε στο Claude αυτό το μήνυμα.' -f $HubDir) 'Red'; Finish 2 }
if ([System.IO.File]::ReadAllText($cfgPc) -notmatch ('(?m)^\s*name\s*=\s*"{0}"' -f $HubWorker)) { Say 'Το wrangler.toml του Hub δεν είναι αυτό που περίμενα: σταμάτησα.' 'Red'; Finish 2 }
$changed = @()
foreach ($b in $baseline) {
    $f = Join-Path $HubDir ($b.path.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { $changed += ($b.path + ' (λείπει)'); continue }
    if ((Get-Sha ([System.IO.File]::ReadAllBytes($f))) -ne $b.sha) { $changed += $b.path }
}
$extra = @()
$pub = Join-Path $HubDir 'public'
if (Test-Path -LiteralPath $pub) {
    $known = @{}
    foreach ($b in $baseline) { $known[$b.path.ToLowerInvariant()] = $true }
    foreach ($f in @(Get-ChildItem -LiteralPath $pub -Recurse -File)) {
        $rel = ('public/' + $f.FullName.Substring($pub.Length).TrimStart('\', '/').Replace('\', '/'))
        if (-not $known.ContainsKey($rel.ToLowerInvariant())) { $extra += $rel }
    }
}
if ($changed.Count -eq 0 -and $extra.Count -eq 0) {
    Say ('Φάκελος του Hub στον υπολογιστή: ίδιος με αυτόν που έτρεχε live στις 24/10 ({0} αρχεία): OK' -f $baseline.Count) 'Green'
} else {
    Say 'Φάκελος του Hub στον υπολογιστή: ΑΛΛΑΞΕ μετά τις 24/10 (το preview δεν επηρεάζεται, αλλά το Claude πρέπει να το δει πριν από το live):' 'Yellow'
    foreach ($c in $changed) { Say ('  - άλλαξε: ' + $c) }
    foreach ($x in $extra) { Say ('  - νέο αρχείο: ' + $x) }
}

# 2. Cloudflare login and the hub D1 (read-only)
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$deploy = Prepare-Deploy
$gwh = Join-Path (Join-Path $deploy 'sites') 'gwh'
$who = Invoke-Wrangler $gwh 'whoami' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    if ($who.text -match '(?i)not authenticated|wrangler login') { Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red' }
    else { Say 'Δεν μπόρεσα να ελέγξω τη σύνδεση με το Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red' }
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 15)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: OK'
$dl = Invoke-Wrangler $gwh 'd1 list --json' -Retry
$list = Get-JsonArray $dl.text
$dbId = ''
if ($list) { foreach ($d in $list) { if ($d.name -eq $DbName) { $dbId = [string]$d.uuid } } }
if (-not $dbId) { Say ('Δεν βρήκα τη D1 "{0}". Δεν αλλάζω τίποτα. Έξοδος:' -f $DbName) 'Red'; Say $dl.text; Finish 5 }
Say ('D1 "{0}": υπάρχει' -f $DbName)
$tables = Test-Tables $gwh
if (-not $tables.ok) { Say 'Δεν μπόρεσα να διαβάσω τους πίνακες της D1. Έξοδος:' 'Red'; Say $tables.text; Finish 5 }
Say ('Πίνακες αναζήτησης με φωτογραφία: {0}' -f $(if ($tables.ready) { 'υπάρχουν' } else { 'δεν υπάρχουν ακόμα' }))

if ($Step -eq 'check') {
    Say ''
    Say 'Μόνο έλεγχος: δεν άλλαξε τίποτα.' 'Green'
    Finish 0
}

# ---------------- preview ----------------
Say ''
Say 'Τι θα γίνει (το live gearworldhub.com ΔΕΝ αλλάζει):'
if (-not $tables.ready) {
    Say ('  1. [{0}] Σημείο επαναφοράς της D1 και μετά 2 ΝΕΟΙ πίνακες (photo_search_usage, photo_search_daily). Κανένας υπάρχων πίνακας δεν αλλάζει.' -f $PhraseD1)
} else {
    Say '  1. Η D1 έχει ήδη τους 2 πίνακες: δεν αλλάζει.'
}
Say ('  2. [{0}] Νέος Worker "{1}" σε δοκιμαστική διεύθυνση *.workers.dev, με τον κώδικα αυτής της έκδοσης:' -f $PhrasePreview, $PreviewName)
Say '     noindex, χωρίς Google Analytics, η εγγραφή email κλειστή, ίδια D1 και Workers AI, δικό του μυστικό για τον ανώνυμο κωδικό.'
Say ('  Επαναφορά (μόνο με έγκριση): npx wrangler delete --name {0}' -f $PreviewName)
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }

$bdir = Join-Path $WorkDir 'backups'
if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }

if (-not $tables.ready) {
    if (-not (Confirm-Approval $PhraseD1)) { Say 'Δεν δόθηκε η έγκριση για τη D1: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
    $tt = Invoke-Wrangler $gwh ('d1 time-travel info {0}' -f $DbName) -Retry
    $bm = [regex]::Match($tt.text, '[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}')
    if ($tt.code -ne 0 -or -not $bm.Success) { Say 'Δεν πήρα σημείο επαναφοράς της D1: ΔΕΝ άλλαξα τίποτα.' 'Red'; Say $tt.text; Finish 11 }
    $note = @(
        ('Gear World Hub - photo search tables, {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')),
        'To remove only the 2 new tables (only with approval):',
        ('  npx wrangler d1 execute {0} --remote --command "DROP TABLE IF EXISTS photo_search_usage; DROP TABLE IF EXISTS photo_search_daily"' -f $DbName),
        'Full D1 restore point (Time Travel):',
        ('  npx wrangler d1 time-travel restore {0} --bookmark={1}' -f $DbName, $bm.Value)
    ) -join "`r`n"
    $noteFile = Join-Path $bdir ('hub-photo-d1-' + $stamp + '.txt')
    [System.IO.File]::WriteAllText($noteFile, $note, (New-Object System.Text.UTF8Encoding($false)))
    Say ('Σημείο επαναφοράς της D1 και οδηγίες: {0}' -f $noteFile) 'Green'
    $sql = Join-Path (Join-Path $gwh 'migrations') '0001_photo_search_limits.sql'
    $x = Invoke-Wrangler $gwh ('d1 execute {0} --remote --file "{1}"' -f $DbName, $sql) -Retry
    if ($x.code -ne 0) { Say 'Οι πίνακες δεν μπήκαν. Η D1 έμεινε όπως ήταν. Έξοδος:' 'Red'; Say $x.text; Finish 12 }
    $again = Test-Tables $gwh
    if (-not ($again.ok -and $again.ready)) { Say 'Οι πίνακες δεν φαίνονται μετά την αλλαγή. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 12 }
    Say 'D1: οι 2 νέοι πίνακες μπήκαν: OK' 'Green'
}

if (-not (Confirm-Approval $PhrasePreview)) { Say 'Δεν δόθηκε η έγκριση για το preview: σταμάτησα (δεν ανέβηκε τίποτα).' 'Yellow'; Finish 1 }
$cfg = Write-PreviewConfig $gwh $dbId
$d = Invoke-Wrangler $gwh ('deploy --config "{0}"' -f $cfg)
if ($d.code -ne 0) { Say 'Το ανέβασμα απέτυχε. Το live Hub δεν άλλαξε. Έξοδος:' 'Red'; Say $d.text; Finish 9 }
$um = [regex]::Match($d.text, 'https://[A-Za-z0-9\.\-]+\.workers\.dev')
$url = $(if ($um.Success) { $um.Value } else { '' })

# The secret for the anonymous visitor code: random, never shown, never saved on this PC.
$rnd = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($rnd) } finally { $rng.Dispose() }
$salt = [Convert]::ToBase64String($rnd).Replace('+', '-').Replace('/', '_').TrimEnd('=')
$secretFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-hubphoto-secret-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.json')
[System.IO.File]::WriteAllText($secretFile, ('{{"PHOTO_LIMIT_SALT":"{0}"}}' -f $salt), (New-Object System.Text.UTF8Encoding($false)))
try {
    $s = Invoke-Wrangler $gwh ('secret bulk "{0}" --name {1}' -f $secretFile, $PreviewName)
} finally {
    Remove-Item -LiteralPath $secretFile -Force -ErrorAction SilentlyContinue
}
if ($s.code -ne 0) { Say 'Το μυστικό του preview δεν μπήκε: η αναζήτηση με φωτογραφία εκεί θα απαντά "not ready". Έξοδος:' 'Red'; Say $s.text; Finish 10 }
Say ('Ανέβηκε. Δοκιμαστική διεύθυνση: {0}' -f $(if ($url) { $url } else { '(δεν τη βρήκα στην έξοδο)' })) 'Green'
if ($url -and -not $NoHttpCheck) { Start-Sleep -Seconds 8; Test-Preview $url }
Say ''
Say 'ΕΤΟΙΜΟ: άνοιξε τη δοκιμαστική διεύθυνση στο κινητό σου και δοκίμασε το κουμπί της κάμερας. Το live Hub δεν άλλαξε.' 'Green'
Finish 0
