<#
.SYNOPSIS
  Gear World Hub - search labels (TGW, AGW, VGW, SGW ...) and the waiting text of the search.
  Read-only unless -Step live -Apply and the typed approval phrase.

.DESCRIPTION
  The change on gearworldhub.com is 3 files of the page, nothing else:
    public/app.js           every search result shows the short name of its Gear World (CGW ... TGW, AGW, VGW, SGW and
                            any new world). The old code knew only the first 6 sites and wrote "GEAR WORLD" for the rest.
    public/translations.js  the waiting text is "Searching all Gear Worlds..." in the 11 languages, not the list of the
                            first 6 sites.
    public/index.html       new ?v= for these 2 files, so browsers load the new version at once (lessons L31).
  worker.js, the photo search, the D1, the 10 sites and the other Workers (gwh-sitemap too) do NOT change.

  -Step check  READ-ONLY. Is the hub folder on this PC still exactly the version that runs live
               (sites/gwh/live-baseline.txt, its "# version:" line names it), and is gearworldhub.com still that
               version? Cloudflare login, and the live version of the Worker (needed to go back). Shows the plan.
  -Step live   CHANGES THE LIVE HUB, one approval: ΕΓΚΡΙΝΩ HUB LABELS LIVE. Only when the hub folder on this PC and the
               live site are still the version of live-baseline.txt (or already this version). First a zip of the hub
               folder and the number of the live version (for rollback), then the changed files go into the hub
               folder, then gearworldhub.com is deployed from that folder and checked. If the deploy fails, the old
               files go back into the hub folder, so it stays the same as the live site.
  Report: <home>\gear-world-reports\GWH_LABELS_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'live')]
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
$PhraseLive = 'ΕΓΚΡΙΝΩ HUB LABELS LIVE'
$LiveUrl = 'https://gearworldhub.com'
if (-not $HubDir) { $HubDir = Join-Path $HOME 'gear-world-hub' }
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-hub-labels' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$sep = [System.IO.Path]::DirectorySeparatorChar

# What each file of the change does, in the words of the report.
$About = @{
    'public/app.js'          = 'κάθε αποτέλεσμα γράφει το δικό του Gear World (TGW, AGW, VGW, SGW...), όχι «GEAR WORLD»'
    'public/translations.js' = 'το κείμενο αναμονής γίνεται «Searching all Gear Worlds...» και στις 11 γλώσσες'
    'public/index.html'      = 'νέο ?v= για τα 2 αρχεία, ώστε τα κινητά να πάρουν αμέσως τη νέα έκδοση'
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
    $file = Join-Path $OutDir ('GWH_LABELS_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('GWH_LABELS_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
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
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-hublabels-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
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
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-hublabels-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
    }
    return $dest
}

# sha256 of a live file as the Worker sends it: 'missing' for 404, 'error' when it could not be read.
# Cloudflare Web Analytics adds its own beacon script to HTML for some visitors (lessons L71): it is taken out first.
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

# The version of a Worker that is live now (for going back). Read-only. wrangler lists the deployments oldest first:
# the last "Version(s):" block is the live one, and it must be ONE version with 100% of the visitors.
function Get-LiveVersion([string]$folder, [string]$name) {
    $r = Invoke-Wrangler $folder ('deployments list --name {0}' -f $name) -Retry
    if ($r.code -ne 0) { return '' }
    $at = $r.text.LastIndexOf('Version(s):')
    if ($at -lt 0) { return '' }
    $ms = [regex]::Matches($r.text.Substring($at), '\((\d+)%\)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($ms.Count -ne 1 -or $ms[0].Groups[1].Value -ne '100') { return '' }
    return $ms[0].Groups[2].Value
}

# ---------------- start ----------------
Say ('GWH SEARCH LABELS - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }

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
if ($baseline.Count -eq 0) { Say 'Το live-baseline.txt είναι άδειο: ΔΕΝ αλλάζω τίποτα. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 13 }
$baseSha = @{}
foreach ($b in $baseline) { $baseSha[$b.path] = $b.sha }

$gwhRepo = Join-Path (Join-Path $repo 'sites') 'gwh'
$newFiles = @('worker.js', 'photo-search.js')
$pubRepo = Join-Path $gwhRepo 'public'
foreach ($f in @(Get-ChildItem -LiteralPath $pubRepo -Recurse -File | Sort-Object FullName)) {
    $newFiles += ('public/' + $f.FullName.Substring($pubRepo.Length).TrimStart('\', '/').Replace('\', '/'))
}
$newSha = @{}
foreach ($rel in $newFiles) { $newSha[$rel] = Get-FileSha (Local-Path $gwhRepo $rel) }
# The files this version changes or adds, compared with the version that runs live.
$plan = @($newFiles | Where-Object { -not $baseSha.ContainsKey($_) -or $baseSha[$_] -ne $newSha[$_] })

# 2. The hub folder on this PC: still the version that runs live, or already this version?
$cfgPc = Join-Path $HubDir 'wrangler.toml'
if (-not (Test-Path -LiteralPath $cfgPc)) { Say ('Δεν βρήκα το Hub στον υπολογιστή ({0}). Στείλε στο Claude αυτό το μήνυμα.' -f $HubDir) 'Red'; Finish 2 }
if ([System.IO.File]::ReadAllText($cfgPc) -notmatch ('(?m)^\s*name\s*=\s*"{0}"' -f $HubWorker)) { Say 'Το wrangler.toml του Hub δεν είναι αυτό που περίμενα: σταμάτησα.' 'Red'; Finish 2 }
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
foreach ($rel in $newFiles) { if ((Get-FileSha (Local-Path $HubDir $rel)) -ne $newSha[$rel]) { $notNew += $rel } }
$extraBase = @($pcFiles | Where-Object { -not $baseSha.ContainsKey($_) })
$extraAll = @($pcFiles | Where-Object { -not $baseSha.ContainsKey($_) -and -not $newSha.ContainsKey($_) })
$pcIsBaseline = ($changed.Count -eq 0 -and $extraBase.Count -eq 0)
$pcIsNew = ($notNew.Count -eq 0 -and $extraAll.Count -eq 0)
if ($pcIsBaseline -and $plan.Count -gt 0) {
    Say ('Φάκελος του Hub στον υπολογιστή: ίδιος με την έκδοση που τρέχει live ({0}, {1} αρχεία): ΕΝΤΑΞΕΙ' -f $liveLabel, $baseline.Count) 'Green'
} elseif ($pcIsNew) {
    Say ('Φάκελος του Hub στον υπολογιστή: έχει ήδη αυτή την έκδοση ({0} αρχεία): ΕΝΤΑΞΕΙ' -f $newFiles.Count) 'Green'
} else {
    Say ('Φάκελος του Hub στον υπολογιστή: ΠΡΟΒΛΗΜΑ - άλλαξε μετά την έκδοση {0}, και δεν είναι ούτε αυτή η έκδοση:' -f $liveLabel) 'Red'
    foreach ($c in $changed) { Say ('  - άλλαξε: ' + $c) }
    foreach ($x in $extraBase) { Say ('  - νέο αρχείο: ' + $x) }
}

# 3. The live gearworldhub.com, read like a browser: still the version of the baseline, or already this version?
$liveState = 'unknown'
$unread = @()
if (-not $NoHttpCheck) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $paths = @(@($baseline | Where-Object { $_.path -like 'public/*' } | ForEach-Object { $_.path }) + @($newFiles | Where-Object { $_ -like 'public/*' }) | Sort-Object -Unique)
    $isBase = $true
    $isNew = $true
    $diff = @()
    foreach ($rel in $paths) {
        $sha = Get-LiveSha ($LiveUrl + (Get-UrlPath $rel) + '?gwcheck=' + $stamp) ($rel -match '\.html$')
        if ($sha -eq 'error') { $unread += $rel; continue }
        $okBase = ($baseSha.ContainsKey($rel) -and $sha -eq $baseSha[$rel])
        $okNew = ($newSha.ContainsKey($rel) -and $sha -eq $newSha[$rel])
        if ($baseSha.ContainsKey($rel) -and -not $okBase) { $isBase = $false }
        if ($newSha.ContainsKey($rel) -and -not $okNew) { $isNew = $false }
        if (-not $okBase -and -not $okNew) { $diff += $rel }
    }
    if ($unread.Count -gt 0) {
        Say 'Live gearworldhub.com: ΠΡΟΣΟΧΗ - δεν μπόρεσα να διαβάσω κάποια αρχεία (δίκτυο;). Ξανατρέξε την εντολή σε λίγο:' 'Yellow'
        foreach ($x in $unread) { Say ('  - ' + $x) }
    } else {
        if ($isBase) { $liveState = 'baseline' } elseif ($isNew) { $liveState = 'new' } else { $liveState = 'mixed' }
        if ($liveState -eq 'baseline') { Say ('Live gearworldhub.com: ίδιο με την έκδοση {0} ({1} αρχεία της σελίδας): ΕΝΤΑΞΕΙ' -f $liveLabel, $paths.Count) 'Green' }
        elseif ($liveState -eq 'new') { Say ('Live gearworldhub.com: έχει ήδη αυτή την έκδοση ({0} αρχεία της σελίδας): ΕΝΤΑΞΕΙ' -f $paths.Count) 'Green' }
        else {
            Say ('Live gearworldhub.com: ΠΡΟΒΛΗΜΑ - δεν είναι ούτε η έκδοση {0} ούτε αυτή η έκδοση. Αρχεία:' -f $liveLabel) 'Red'
            foreach ($x in $diff) { Say ('  - ' + $x) }
        }
    }
}

# 4. Cloudflare login and the live version of the Worker (read-only)
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
Say 'Cloudflare login: ΕΝΤΑΞΕΙ' 'Green'
$liveVersion = Get-LiveVersion $gwh $HubWorker
if ($liveVersion) { Say ('Ζωντανή έκδοση του Worker "{0}": βρέθηκε (για επαναφορά): ΕΝΤΑΞΕΙ' -f $HubWorker) 'Green' }
else { Say ('Ζωντανή έκδοση του Worker "{0}": ΠΡΟΒΛΗΜΑ - δεν τη βρήκα (χρειάζεται για επαναφορά)' -f $HubWorker) 'Red' }

# 5. The plan
Say ''
if ($plan.Count -eq 0) {
    Say 'Αυτή η έκδοση του κώδικα είναι ήδη η live έκδοση (live-baseline.txt): δεν έχει τίποτα να αλλάξει.' 'Green'
    Finish 0
}
Say ('Τι θα γίνει με -Step live -Apply και τη φράση {0}:' -f $PhraseLive)
Say '  1. Αντίγραφο ασφαλείας: zip του φακέλου του Hub (worker.js, photo-search.js, wrangler.toml, public) και ο αριθμός της ζωντανής έκδοσης.'
Say ('  2. Στον φάκελο του Hub μπαίνουν {0} αρχεία αυτής της έκδοσης:' -f $plan.Count)
foreach ($rel in $plan) {
    $what = $(if ($About.ContainsKey($rel)) { $About[$rel] } else { 'νέα έκδοση του αρχείου' })
    Say ('     - {0}: {1}' -f $rel, $what)
}
Say '  3. Deploy του gearworldhub.com από τον φάκελο του Hub, και έλεγχος: τα νέα αρχεία live και μία αναζήτηση με τις ετικέτες.'
Say '  Το worker.js, η αναζήτηση με φωτογραφία, η D1, τα 10 sites και οι άλλοι Workers (και ο gwh-sitemap) ΔΕΝ αλλάζουν.'
Say ('  Επαναφορά (μόνο με έγκριση): npx wrangler rollback <ζωντανή έκδοση> --name {0}, και τα αρχεία του zip πίσω στον φάκελο του Hub.' -f $HubWorker)
$ready = (($pcIsBaseline -or $pcIsNew) -and ($liveState -eq 'baseline' -or $liveState -eq 'new' -or ($NoHttpCheck -and $liveState -eq 'unknown')) -and $liveVersion)

if ($Step -eq 'check') {
    Say ''
    if ($ready) { Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ - όλα έτοιμα για το -Step live. Μόνο έλεγχος: δεν άλλαξε τίποτα.' 'Green' }
    else { Say 'Αποτέλεσμα: ΠΡΟΣΟΧΗ - κάτι από τα παραπάνω δεν είναι έτοιμο (δες τις γραμμές ΠΡΟΒΛΗΜΑ/ΠΡΟΣΟΧΗ). Μόνο έλεγχος: δεν άλλαξε τίποτα.' 'Yellow' }
    Finish 0
}

# ---------------- live ----------------
if (-not $pcIsBaseline -and -not $pcIsNew) {
    Say ('Ο φάκελος του Hub στον υπολογιστή δεν είναι ούτε η έκδοση {0} ούτε αυτή η έκδοση: κάποιος τον άλλαξε. ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' -f $liveLabel) 'Red'
    Finish 7
}
if ($unread.Count -gt 0) { Say 'Δεν μπόρεσα να διαβάσω όλο το live gearworldhub.com: ΔΕΝ αλλάζω τίποτα. Ξανατρέξε την εντολή σε λίγο.' 'Red'; Finish 6 }
if ($liveState -eq 'mixed') { Say 'Το live gearworldhub.com άλλαξε από αλλού: ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' 'Red'; Finish 7 }
if ($pcIsNew -and $liveState -eq 'new') {
    Say ''
    Say 'Οι νέες ετικέτες είναι ήδη live και ο φάκελος του υπολογιστή είναι ίδιος. Τίποτα να κάνω.' 'Green'
    Finish 0
}
if (-not $liveVersion) {
    Say ('Δεν βρήκα τη ζωντανή έκδοση του Worker "{0}" (χρειάζεται για επαναφορά): για ασφάλεια ΔΕΝ αλλάζω τίποτα. Στείλε αυτή την αναφορά στο Claude.' -f $HubWorker) 'Red'
    Finish 11
}
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
if (-not (Confirm-Approval $PhraseLive)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# 1. Backup first: the whole hub folder that goes live (zip), and the files that change as plain copies
$bdir = Join-Path $WorkDir 'backups'
if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
$tmpCopy = Join-Path ([System.IO.Path]::GetTempPath()) ('gwh-before-labels-' + $stamp)
New-Item -ItemType Directory -Path $tmpCopy -Force | Out-Null
foreach ($n in @('worker.js', 'wrangler.toml', 'photo-search.js')) {
    $src = Join-Path $HubDir $n
    if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $tmpCopy -Force }
}
Copy-Item -LiteralPath $pub -Destination $tmpCopy -Recurse -Force
$zip = Join-Path $bdir ('gwh-before-labels-live-' + $stamp + '.zip')
Compress-Archive -Path (Join-Path $tmpCopy '*') -DestinationPath $zip -Force
Remove-Item -LiteralPath $tmpCopy -Recurse -Force
if (-not (Test-Path -LiteralPath $zip)) { Say 'Το αντίγραφο ασφαλείας δεν γράφτηκε: ΔΕΝ άλλαξα τίποτα.' 'Red'; Finish 11 }
$keep = Join-Path $bdir ('gwh-before-labels-files-' + $stamp)
$hadBefore = @{}
foreach ($rel in $plan) {
    $src = Local-Path $HubDir $rel
    $hadBefore[$rel] = (Test-Path -LiteralPath $src -PathType Leaf)
    if ($hadBefore[$rel]) {
        $dst = Local-Path $keep $rel
        New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
        Copy-Item -LiteralPath $src -Destination $dst -Force
    }
}
$note = @(
    ('Gear World Hub before the search labels went live ({0}), {1}' -f (Split-Path -Leaf $repo), (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    ('Live version before: {0}' -f $liveVersion),
    ('Hub folder before (worker.js, photo-search.js, wrangler.toml, public): {0}' -f $zip),
    ('The {0} files that changed, as they were: {1}' -f $plan.Count, $keep),
    'To go back (only with approval), in PowerShell:',
    ('  npx wrangler rollback {0} --name {1}' -f $liveVersion, $HubWorker),
    ('  then put the files of {0} back into {1}' -f $keep, $HubDir),
    'Or in the Cloudflare dashboard: Workers > gear-world-hub > Deployments > the version above > Rollback.'
) -join "`r`n"
$noteFile = Join-Path $bdir ('gwh-before-labels-live-' + $stamp + '.txt')
[System.IO.File]::WriteAllText($noteFile, $note, (New-Object System.Text.UTF8Encoding($false)))
Say ('Αντίγραφο ασφαλείας και οδηγίες επαναφοράς: {0}' -f $noteFile) 'Green'

# Puts the hub folder back as it was (used only when the deploy fails).
function Restore-Before {
    foreach ($rel in $plan) {
        $dst = Local-Path $HubDir $rel
        if ($hadBefore[$rel]) { Copy-Item -LiteralPath (Local-Path $keep $rel) -Destination $dst -Force }
        elseif (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
    }
}

# 2. The new files into the hub folder
foreach ($rel in $plan) {
    $dst = Local-Path $HubDir $rel
    New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
    Copy-Item -LiteralPath (Local-Path $gwhRepo $rel) -Destination $dst -Force
}
$bad = @($plan | Where-Object { (Get-FileSha (Local-Path $HubDir $_)) -ne $newSha[$_] })
if ($bad.Count -gt 0) {
    Restore-Before
    Say ('Τα νέα αρχεία δεν γράφτηκαν σωστά στον φάκελο του Hub ({0}): τα παλιά γύρισαν πίσω, ΔΕΝ ανέβηκε τίποτα.' -f ($bad -join ', ')) 'Red'
    Finish 10
}
Say ('Νέα αρχεία στον φάκελο του Hub: {0}' -f ($plan -join ', ')) 'Green'

# 3. Deploy the live Hub from its folder, with the wrangler version of this repo version
$d = Invoke-Deploy $gwh (Join-Path $HubDir 'wrangler.toml')
if ($d.code -ne 0) {
    Restore-Before
    Say 'Το ανέβασμα απέτυχε: το live Hub έμεινε όπως ήταν, και τα παλιά αρχεία γύρισαν στον φάκελο του Hub. Έξοδος:' 'Red'
    Say $d.text
    Finish 9
}
Say 'Το gearworldhub.com ανέβηκε με τις νέες ετικέτες.' 'Green'

# 4. Live checks (the edge may keep the old files for a few seconds)
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
        if ($state[$rel] -eq $newSha[$rel]) { Say ('  {0}: live = νέα έκδοση: ΕΝΤΑΞΕΙ' -f $rel) 'Green' }
        else { Say ('  {0}: ΠΡΟΣΟΧΗ - το live δείχνει ακόμα άλλη έκδοση (cache;). Ξαναδές σε 1-2 λεπτά.' -f $rel) 'Yellow' }
    }
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add('User-Agent', 'GearWorldQA-bot/1.0 (+read-only check)')
        $wc.Headers.Add('Accept', 'application/json')
        try { $json = (New-Object System.Text.UTF8Encoding($false)).GetString($wc.DownloadData($LiveUrl + '/api/search?q=suitcase')) } finally { $wc.Dispose() }
        $s = $json | ConvertFrom-Json
        $sites = @(@($s.results) | ForEach-Object { [string]$_.site } | Where-Object { $_ } | Sort-Object -Unique)
        $labels = @($sites | Where-Object { $_ -match '^[A-Za-z]{3}$' } | ForEach-Object { $_.ToUpperInvariant() })
        $odd = @($sites | Where-Object { $_ -notmatch '^[A-Za-z]{3}$' })
        Say ('  Αναζήτηση "suitcase": {0} αποτελέσματα, ετικέτες: {1}' -f @($s.results).Count, $(if ($labels.Count) { $labels -join ', ' } else { '(καμία)' }))
        if ($odd.Count) { Say ('  ΠΡΟΣΟΧΗ: αποτελέσματα χωρίς κωδικό Gear World (γράφουν «GEAR WORLD»): {0}' -f ($odd -join ', ')) 'Yellow' }
    } catch {
        Say ('  Ο έλεγχος της αναζήτησης δεν ολοκληρώθηκε: {0}' -f $_.Exception.Message) 'Yellow'
    }
}
Say ''
Say 'Για το live-baseline.txt (το ενημερώνει το Claude):'
foreach ($rel in $plan) { Say ('  {0} | {1} | {2} | file' -f $rel, (Get-Item -LiteralPath (Local-Path $HubDir $rel)).Length, $newSha[$rel]) }
Say ''
Say 'ΕΤΟΙΜΟ: οι ετικέτες της αναζήτησης είναι live στο https://gearworldhub.com. Αν κάτι δεν σου αρέσει: οδηγίες επαναφοράς πιο πάνω.' 'Green'
Finish 0
