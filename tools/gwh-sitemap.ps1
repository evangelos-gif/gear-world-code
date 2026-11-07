<#
.SYNOPSIS
  Gear World Hub sitemap (the small Worker "gwh-sitemap" on gearworldhub.com/sitemap.xml): /about/ and the gift guides go in.
  Read-only unless -Step preview/live/remove-preview with -Apply and the typed approval phrase.

.DESCRIPTION
  The Worker gwh-sitemap was made on 24/10/2026 in another chat and sends 6 pages. The new version
  (sites/gwh-sitemap/worker.js) sends the same 6 pages, /about/ (who runs Gear World, owner 7/11/2026, lessons L103)
  and the 6 pages of the gift guides (/guides/ and 5 guides, owner 4/11/2026): 13 pages.
  Nothing else changes: the Hub Worker (gear-world-hub), its D1, the route and the sites stay as they are.

  -Step check           READ-ONLY. Which version gearworldhub.com/sitemap.xml sends now (the one of 24/10/2026,
                        sites/gwh-sitemap/before-worker.js, or already the new one), the Cloudflare login and the live
                        version of the Worker (needed to go back).
  -Step preview         CHANGES CLOUDFLARE, one approval: ΕΓΚΡΙΝΩ SITEMAP PREVIEW. A separate test Worker
                        "gwh-sitemap-preview" on a *.workers.dev address gets the new version, without any route.
                        gearworldhub.com does NOT change.
  -Step live            CHANGES THE LIVE SITEMAP, one approval: ΕΓΚΡΙΝΩ SITEMAP LIVE. Only when gearworldhub.com/sitemap.xml
                        is still the version of 24/10/2026 (or already the new one) and the live version of the Worker is
                        known. First a note with that version and the old sitemap (for going back), then the deploy of
                        gwh-sitemap with its own route (sites/gwh-sitemap/gwh-sitemap.toml), then a check of the live sitemap.
  -Step remove-preview  CHANGES CLOUDFLARE (the test Worker only), one approval: ΕΓΚΡΙΝΩ SITEMAP REMOVE PREVIEW. Deletes
                        "gwh-sitemap-preview" from a new empty folder (lessons L83). Never gwh-sitemap itself.
  Report: <home>\gear-world-reports\GWH_SITEMAP_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'preview', 'live', 'remove-preview')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard,
    [switch]$NoHttpCheck
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$PhrasePreview = 'ΕΓΚΡΙΝΩ SITEMAP PREVIEW'
$PhraseLive = 'ΕΓΚΡΙΝΩ SITEMAP LIVE'
$PhraseRemovePreview = 'ΕΓΚΡΙΝΩ SITEMAP REMOVE PREVIEW'
$LiveWorker = 'gwh-sitemap'
$PreviewName = 'gwh-sitemap-preview'
$LiveUrl = 'https://gearworldhub.com/sitemap.xml'
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-hub-sitemap' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
# Colours without red and green (lessons L35): cyan = OK, yellow = attention, magenta = problem.
$Ok = 'Cyan'
$Warn = 'Yellow'
$Bad = 'Magenta'

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
    $file = Join-Path $OutDir ('GWH_SITEMAP_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('GWH_SITEMAP_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
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

# Runs a command through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
function Invoke-Line([string]$Folder, [string]$Line, [switch]$Retry) {
    if ($Line -match '[&|<>^%]') { throw 'Unsafe characters in the command' }
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call {0} 2>&1' -f $Line))
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-sitemap-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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
        Say ('Πρόβλημα δικτύου με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα...' -f (5 * $try)) $Warn
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$Retry) {
    if ($Retry) { return (Invoke-Line $Folder ('npx --yes wrangler ' + $Arguments) -Retry) }
    return (Invoke-Line $Folder ('npx --yes wrangler ' + $Arguments))
}

function Get-Sha([byte[]]$bytes) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
}

# Downloads a page: @{ status; bytes }. status 0 = could not be read.
function Get-Web([string]$url) {
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.UserAgent = 'GearWorldQA-bot/1.0 (+read-only check)'
        $req.Accept = '*/*'
        $req.Timeout = 30000
        $resp = $req.GetResponse()
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if (-not $resp) { return @{ status = 0; bytes = (New-Object byte[] 0) } }
    } catch {
        return @{ status = 0; bytes = (New-Object byte[] 0) }
    }
    try {
        $ms = New-Object System.IO.MemoryStream
        $resp.GetResponseStream().CopyTo($ms)
        return @{ status = [int]$resp.StatusCode; bytes = $ms.ToArray() }
    } finally { $resp.Close() }
}

# Which version a sitemap address sends: 'before', 'new', 'other' or 'error'.
function Get-SitemapState([string]$url) {
    $w = Get-Web ($url + '?gwcheck=' + $stamp)
    if ($w.status -ne 200) { return 'error' }
    $sha = Get-Sha $w.bytes
    if ($sha -eq $script:shaBefore) { return 'before' }
    if ($sha -eq $script:shaNew) { return 'new' }
    return 'other'
}

# Copy of this repo version, ready for wrangler (npm ci once per version, so the wrangler version is fixed).
function Prepare-Deploy {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path (Join-Path $repo 'sites') 'gwh-sitemap') -Destination $dest -Recurse -Force
        foreach ($item in @('package.json', 'package-lock.json')) { Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Force }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $r = Invoke-Line $dest 'npm ci --no-audit --no-fund'
        if ($r.code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
    }
    return $dest
}

# The version of the Worker that is live now (for going back): ONE version with 100% of the visitors.
function Get-LiveVersion([string]$folder) {
    $r = Invoke-Wrangler $folder ('deployments list --name {0}' -f $LiveWorker) -Retry
    if ($r.code -ne 0) { return '' }
    $at = $r.text.LastIndexOf('Version(s):')
    if ($at -lt 0) { return '' }
    $ms = [regex]::Matches($r.text.Substring($at), '\((\d+)%\)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($ms.Count -ne 1 -or $ms[0].Groups[1].Value -ne '100') { return '' }
    return $ms[0].Groups[2].Value
}

# ---------------- start ----------------
Say ('GWH SITEMAP (/about/ και οδηγοί δώρων στο sitemap του Hub) - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) $Ok
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
if ($PreviewName -eq $LiveWorker -or $PreviewName -notmatch '-preview$') { Say 'Λάθος όνομα δοκιμαστικού Worker: δεν κάνω τίποτα.' $Bad; Finish 12 }

# 1. The two versions of the sitemap, as this repo version makes them
$mjs = Join-Path (Join-Path $repo 'tools') 'gwh-sitemap.mjs'
$hb = Invoke-Line $repo ('node "{0}" sha before' -f $mjs)
$hn = Invoke-Line $repo ('node "{0}" sha new' -f $mjs)
$script:shaBefore = ([string]$hb.text).Trim()
$script:shaNew = ([string]$hn.text).Trim()
if ($hb.code -ne 0 -or $hn.code -ne 0 -or $script:shaBefore -notmatch '^[0-9a-f]{64}$' -or $script:shaNew -notmatch '^[0-9a-f]{64}$') {
    Say 'Δεν μπόρεσα να φτιάξω τα δύο sitemap από τον κώδικα: ΔΕΝ αλλάζω τίποτα. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 13
}
Say 'Τι αλλάζει: στο https://gearworldhub.com/sitemap.xml μπαίνουν η σελίδα /about/ και οι 6 σελίδες των οδηγών δώρων (/guides/ και 5 οδηγοί), μαζί με τις 6 που έχει ήδη: 13 σελίδες.'

# 2. What the live sitemap is now
$liveState = 'unknown'
if (-not $NoHttpCheck) {
    $liveState = Get-SitemapState $LiveUrl
    switch ($liveState) {
        'before' { Say 'Live sitemap: η έκδοση της 24/10/2026 (6 σελίδες): ΕΝΤΑΞΕΙ' $Ok }
        'new' { Say 'Live sitemap: έχει ήδη τη νέα έκδοση (13 σελίδες): ΕΝΤΑΞΕΙ' $Ok }
        'other' { Say 'Live sitemap: ΠΡΟΒΛΗΜΑ - δεν είναι ούτε η έκδοση της 24/10/2026 ούτε η νέα (άλλαξε από αλλού).' $Bad }
        default { Say 'Live sitemap: ΠΡΟΣΟΧΗ - δεν μπόρεσα να το διαβάσω τώρα.' $Warn }
    }
}

# 3. Cloudflare login and the live version of the Worker
$deploy = Prepare-Deploy
$folder = Join-Path $deploy 'gwh-sitemap'
$who = Invoke-Wrangler $folder 'whoami' -Retry
if ($who.code -ne 0 -or $who.text -notmatch '(?i)You are logged in') {
    Say 'Cloudflare login: ΔΕΝ είσαι συνδεδεμένος. Τρέξε πρώτα: npx wrangler login, και μετά ξανά αυτή την εντολή.' $Bad; Finish 4
}
Say 'Cloudflare login: ΕΝΤΑΞΕΙ' $Ok
$liveVersion = Get-LiveVersion $folder
if ($liveVersion) { Say ('Ζωντανή έκδοση του Worker "{0}": βρέθηκε (για επαναφορά): ΕΝΤΑΞΕΙ' -f $LiveWorker) $Ok }
else { Say ('Ζωντανή έκδοση του Worker "{0}": ΠΡΟΣΟΧΗ - δεν τη βρήκα (το live δεν θα γίνει χωρίς αυτήν).' -f $LiveWorker) $Warn }

Say ''
Say ('Preview (φράση {0}): ο δοκιμαστικός Worker "{1}" σε διεύθυνση *.workers.dev, χωρίς route. Το live sitemap ΔΕΝ αλλάζει.' -f $PhrasePreview, $PreviewName)
Say ('Live (φράση {0}): σημείωση επαναφοράς με τη ζωντανή έκδοση, deploy του "{1}" με το route του (gearworldhub.com/sitemap.xml), έλεγχος.' -f $PhraseLive, $LiveWorker)
Say '  Ο Worker του Hub (gear-world-hub), η D1 και τα sites ΔΕΝ αλλάζουν.'
Say ('  Επαναφορά (μόνο με έγκριση): npx wrangler rollback <ζωντανή έκδοση> --name {0}' -f $LiveWorker)

if ($Step -eq 'check') {
    Say ''
    if (($liveState -eq 'before' -or $liveState -eq 'new' -or ($NoHttpCheck -and $liveState -eq 'unknown')) -and $liveVersion) { Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ - έτοιμο για το preview και για το live. Μόνο έλεγχος: δεν άλλαξε τίποτα.' $Ok }
    else { Say 'Αποτέλεσμα: για το live κάτι από τα παραπάνω δεν είναι έτοιμο (δες ΠΡΟΒΛΗΜΑ/ΠΡΟΣΟΧΗ). Μόνο έλεγχος: δεν άλλαξε τίποτα.' $Warn }
    Finish 0
}

# ---------------- remove-preview ----------------
if ($Step -eq 'remove-preview') {
    Say ''
    Say ('Τι θα γίνει: σβήνεται ΜΟΝΟ ο δοκιμαστικός Worker "{0}". Ο "{1}" και το gearworldhub.com ΔΕΝ αλλάζουν.' -f $PreviewName, $LiveWorker)
    if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
    if (-not (Confirm-Approval $PhraseRemovePreview)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' $Warn; Finish 1 }
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

# ---------------- preview ----------------
if ($Step -eq 'preview') {
    if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
    if (-not (Confirm-Approval $PhrasePreview)) { Say 'Δεν δόθηκε η έγκριση για το preview: σταμάτησα (δεν ανέβηκε τίποτα).' $Warn; Finish 1 }
    $cfg = Join-Path $folder 'wrangler.preview.toml'
    $toml = @('# The test address of the sitemap (made by tools/gwh-sitemap.ps1): its own Worker, a workers.dev address, no route.',
        ('name = "{0}"' -f $PreviewName), 'main = "worker.js"', 'compatibility_date = "2026-10-24"', 'workers_dev = true') -join "`n"
    [System.IO.File]::WriteAllText($cfg, $toml + "`n", (New-Object System.Text.UTF8Encoding($false)))
    $d = Invoke-Wrangler $folder ('deploy --config "{0}"' -f $cfg)
    if ($d.code -ne 0) { Say 'Το ανέβασμα απέτυχε. Το live sitemap δεν άλλαξε. Έξοδος:' $Bad; Say $d.text; Finish 9 }
    $um = [regex]::Match($d.text, 'https://[A-Za-z0-9\.\-]+\.workers\.dev')
    $url = $(if ($um.Success) { $um.Value } else { '' })
    Say ('Ανέβηκε. Δοκιμαστική διεύθυνση: {0}' -f $(if ($url) { $url + '/sitemap.xml' } else { '(δεν τη βρήκα στην έξοδο)' })) $Ok
    if ($url -and -not $NoHttpCheck) {
        Start-Sleep -Seconds 8
        $st = Get-SitemapState ($url + '/sitemap.xml')
        if ($st -eq 'new') { Say '  Το sitemap της δοκιμαστικής έχει τις 13 σελίδες της νέας έκδοσης: ΕΝΤΑΞΕΙ' $Ok }
        else { Say ('  ΠΡΟΣΟΧΗ - το sitemap της δοκιμαστικής δεν είναι ακόμα η νέα έκδοση ({0}). Ξαναδές σε 1 λεπτό.' -f $st) $Warn }
    }
    Say ''
    Say 'ΕΤΟΙΜΟ: η δοκιμαστική διεύθυνση είναι πάνω. Το live gearworldhub.com/sitemap.xml δεν άλλαξε.' $Ok
    Finish 0
}

# ---------------- live ----------------
if ($liveState -eq 'new') { Say ''; Say 'Το live sitemap έχει ήδη τη νέα έκδοση. Τίποτα να κάνω.' $Ok; Finish 0 }
if ($liveState -eq 'other') { Say 'Το live sitemap άλλαξε από αλλού: ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' $Bad; Finish 7 }
if ($liveState -eq 'error') { Say 'Δεν μπόρεσα να διαβάσω το live sitemap: ΔΕΝ αλλάζω τίποτα. Ξανατρέξε την εντολή σε λίγο.' $Bad; Finish 6 }
if (-not $liveVersion) { Say ('Δεν βρήκα τη ζωντανή έκδοση του "{0}" (χρειάζεται για επαναφορά): για ασφάλεια ΔΕΝ αλλάζω τίποτα.' -f $LiveWorker) $Bad; Finish 11 }
$cfgLive = Join-Path $folder 'gwh-sitemap.toml'
$cfgText = [System.IO.File]::ReadAllText($cfgLive)
if ($cfgText -notmatch '(?m)^name = "gwh-sitemap"\r?$' -or $cfgText -notmatch 'pattern = "gearworldhub\.com/sitemap\.xml", zone_name = "gearworldhub\.com"' -or $cfgText -notmatch '(?m)^workers_dev = false\r?$') {
    Say 'Το gwh-sitemap.toml του sitemap δεν έχει τη μορφή που περίμενα: ΔΕΝ ανέβασα τίποτα.' $Bad; Finish 13
}
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
if (-not (Confirm-Approval $PhraseLive)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' $Warn; Finish 1 }

# 1. Backup first: the live version (for rollback), the old code and the old sitemap
$bdir = Join-Path $WorkDir 'backups'
if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
Copy-Item -LiteralPath (Join-Path $folder 'before-worker.js') -Destination (Join-Path $bdir ('gwh-sitemap-before-' + $stamp + '.js')) -Force
if (-not $NoHttpCheck) {
    $oldBody = Get-Web ($LiveUrl + '?gwbackup=' + $stamp)
    if ($oldBody.status -eq 200) { [System.IO.File]::WriteAllBytes((Join-Path $bdir ('sitemap-before-' + $stamp + '.xml')), $oldBody.bytes) }
}
$note = @(
    ('Gear World Hub sitemap before /about/ and the gift guides went in ({0}), {1}' -f (Split-Path -Leaf $repo), (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    ('Live version of gwh-sitemap before: {0}' -f $liveVersion),
    ('Its code: gwh-sitemap-before-{0}.js (the same as sites/gwh-sitemap/before-worker.js)' -f $stamp),
    'To go back (only with approval), in PowerShell:',
    ('  npx wrangler rollback {0} --name gwh-sitemap' -f $liveVersion),
    'Or in the Cloudflare dashboard: Workers > gwh-sitemap > Deployments > the version above > Rollback.'
) -join "`r`n"
$noteFile = Join-Path $bdir ('gwh-sitemap-before-live-' + $stamp + '.txt')
[System.IO.File]::WriteAllText($noteFile, $note, (New-Object System.Text.UTF8Encoding($false)))
Say ('Αντίγραφο ασφαλείας και οδηγίες επαναφοράς: {0}' -f $noteFile) $Ok

# 2. Deploy the live Worker with its own route
$d = Invoke-Wrangler $folder ('deploy --config "{0}"' -f $cfgLive)
if ($d.code -ne 0) { Say 'Το ανέβασμα απέτυχε: το live sitemap έμεινε όπως ήταν. Έξοδος:' $Bad; Say $d.text; Finish 9 }
Say ('Ο "{0}" ανέβηκε με τη νέα έκδοση.' -f $LiveWorker) $Ok

# 3. Live check
if (-not $NoHttpCheck) {
    $st = 'error'
    for ($try = 1; $try -le 4; $try++) {
        Start-Sleep -Seconds $(if ($try -eq 1) { 8 } else { 10 })
        $st = Get-SitemapState $LiveUrl
        if ($st -eq 'new') { break }
    }
    if ($st -eq 'new') { Say '  https://gearworldhub.com/sitemap.xml: 13 σελίδες (οι 6 παλιές, το /about/ και οι 6 των οδηγών): ΕΝΤΑΞΕΙ' $Ok }
    else { Say ('  ΠΡΟΣΟΧΗ - το live sitemap δεν δείχνει ακόμα τη νέα έκδοση ({0}). Ξαναδές σε 1-2 λεπτά.' -f $st) $Warn }
}
Say ''
Say 'ΕΤΟΙΜΟ: το sitemap του Hub έχει και το /about/ και τους οδηγούς δώρων. Αν κάτι δεν σου αρέσει: οδηγίες επαναφοράς πιο πάνω.' $Ok
Finish 0
