<#
.SYNOPSIS
  Gear World Hub - legal pages (Privacy, Cookies, Terms, Affiliate disclosure, Contact) and footer links.
  Read-only unless -Apply and the typed approval.

.DESCRIPTION
  Without -Apply (READ-ONLY): checks that
    - the hub folder on this PC is the same as the live gearworldhub.com (otherwise a deploy could undo other work),
    - worker.js has not changed since the last deploy,
    - the hub footer looks exactly as expected,
  and lists what would change. Nothing is changed.

  With -Apply and the phrase ΕΓΚΡΙΝΩ HUB LEGAL PAGES:
    1. Backup: a copy of index.html (and of any legal page that already exists) and ROLLBACK.txt.
    2. Writes 5 static pages in public\ (/privacy/, /cookies/, /terms/, /affiliate-disclosure/, /contact/),
       public\legal\legal.css and legal.js, and adds the 5 links to the footer of index.html.
    3. Deploys the hub (same worker.js; only these files are new).
    4. Checks the live pages.
  worker.js, the hub D1, the search and the 8 sites are NOT changed.

  Report: <home>\gear-world-reports\GWH_LEGAL_PAGES_<time>.txt (also copied to the clipboard)
#>
param(
    [switch]$Apply,
    [string]$Approve = '',
    [string]$HubDir = '',
    [string]$OutDir = '',
    [string]$HubUrl = 'https://gearworldhub.com',
    [switch]$SkipOnline,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ HUB LEGAL PAGES'
$HubDbName = 'gear-world-registry'
$HubWorker = 'gear-world-hub'
if (-not $HubDir) { $HubDir = Join-Path $HOME 'gear-world-hub' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$public = Join-Path $HubDir 'public'
$Folders = @('privacy', 'cookies', 'terms', 'affiliate-disclosure', 'contact', 'legal')

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
    $file = Join-Path $OutDir ('GWH_LEGAL_PAGES_{0}.txt' -f $stamp)
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

function Get-Sha([byte[]]$bytes) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '') } finally { $sha.Dispose() }
}

# Cloudflare may add its Web Analytics beacon to HTML on the way out. It is not in the hub files, so it is left out of the comparison.
function Get-PageSha([byte[]]$bytes, [bool]$isHtml) {
    if (-not $isHtml) { return Get-Sha $bytes }
    $enc = New-Object System.Text.UTF8Encoding($false)
    $t = [regex]::Replace($enc.GetString($bytes), '<script[^>]*static\.cloudflareinsights\.com[^>]*>\s*</script>\r?\n?', '')
    return Get-Sha ($enc.GetBytes($t))
}

function Get-Bytes([string]$url) {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add('User-Agent', 'GearWorldQA-bot/1.0 (+read-only check)')
    try { return $wc.DownloadData($url) } finally { $wc.Dispose() }
}

function Get-Text([string]$url) {
    return (New-Object System.Text.UTF8Encoding($false)).GetString((Get-Bytes $url))
}

function Run-Patcher([string[]]$extra) {
    $mjs = Join-Path (Join-Path $repo 'tools') 'gwh-legal-pages.mjs'
    $out = & node $mjs --hub $HubDir @extra
    $code = $LASTEXITCODE
    $json = $null
    try { $json = (($out | ForEach-Object { "$_" }) -join "`n") | ConvertFrom-Json } catch { $json = $null }
    return @{ code = $code; json = $json; text = (($out | ForEach-Object { "$_" }) -join "`n") }
}

function Restore-Files([string]$bdir) {
    Copy-Item -LiteralPath (Join-Path $bdir 'index.html') -Destination $public -Force
    foreach ($f in $Folders) {
        $p = Join-Path $public $f
        if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force }
        $b = Join-Path (Join-Path $bdir 'public') $f
        if (Test-Path -LiteralPath $b) { Copy-Item -LiteralPath $b -Destination $public -Recurse -Force }
    }
}

Say ('GWH LEGAL PAGES - {0} - {1}' -f $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ' }), (Get-Date -Format 'yyyy-MM-dd HH:mm'))
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# 1. Hub folder
$toml = Join-Path $HubDir 'wrangler.toml'
if (-not (Test-Path -LiteralPath $toml)) { Say ('Δεν βρήκα το hub στο {0}.' -f $HubDir) 'Red'; Finish 2 }
$tomlText = [System.IO.File]::ReadAllText($toml)
if ($tomlText -notmatch ('(?m)^\s*name\s*=\s*"{0}"' -f $HubWorker) -or $tomlText -notmatch ('database_name\s*=\s*"{0}"' -f $HubDbName)) {
    Say 'Το wrangler.toml του hub δεν είναι αυτό που περίμενα: σταμάτησα.' 'Red'; Finish 2
}
if ($tomlText -notmatch '(?m)^\s*directory\s*=\s*"public"') {
    Say 'Το hub δεν δημοσιεύει τον φάκελο public όπως περίμενα: σταμάτησα.' 'Red'; Finish 2
}
Say ('Hub folder: {0}' -f $HubDir)

# 2. Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Say 'Δεν βρέθηκε το Node.js.' 'Red'; Finish 3 }

# 3. Can the hub files be changed safely?
$plan = Run-Patcher @()
if ($plan.code -ne 0 -or -not $plan.json) {
    Say 'Το footer του hub δεν έχει τη μορφή που περίμενα: ΔΕΝ αλλάζω τίποτα.' 'Red'
    Say $(if ($plan.json) { $plan.json.error } else { $plan.text })
    Finish 6
}
$filesDone = [bool]$plan.json.already
Say ('Νομικές σελίδες του hub: {0}' -f $(if ($filesDone) { 'υπάρχουν ήδη, ίδιες με αυτή την έκδοση' } else { 'μπορούν να μπουν με ασφάλεια' }))

if (-not $SkipOnline) {
    # 4a. Is the hub folder on this PC the same as the live hub? (A deploy uploads the whole folder.)
    $diff = @()
    foreach ($f in @(Get-ChildItem -LiteralPath $public -File)) {
        $path = '/' + $f.Name
        if ($f.Name -eq 'index.html') { $path = '/' }
        try {
            $live = Get-Bytes ($HubUrl + $path)
            $isHtml = $f.Extension -eq '.html'
            if ((Get-PageSha $live $isHtml) -ne (Get-PageSha ([System.IO.File]::ReadAllBytes($f.FullName)) $isHtml)) { $diff += $f.Name }
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
}

Say ''
Say 'Τι θα γίνει:'
if ($filesDone) { Say '  - Τίποτα: οι νομικές σελίδες είναι ήδη στο hub.' 'Green'; Finish 0 }
foreach ($c in @($plan.json.changes)) { Say ('  - ' + $c) }
Say '  - Deploy του hub (ίδιος κώδικας worker.js, μόνο αυτά τα αρχεία είναι νέα)'
Say ('  - Νέες διευθύνσεις: {0}' -f ((@($plan.json.paths) | ForEach-Object { $HubUrl + $_ }) -join ', '))
Say '  - ΔΕΝ αλλάζουν: worker.js, η D1 του hub, η αναζήτηση, το newsletter και τα 8 sites.'
if (-not $Apply) { Say ''; Say 'Μόνο έλεγχος (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
Say ('Έγκριση: {0}' -f $Phrase) 'Green'

# 5. Backup
$bdir = Join-Path (Join-Path $HubDir 'backups') ('legal-pages-' + $stamp)
New-Item -ItemType Directory -Path $bdir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $public 'index.html') -Destination $bdir -Force
$bpub = Join-Path $bdir 'public'
foreach ($f in $Folders) {
    $p = Join-Path $public $f
    if (Test-Path -LiteralPath $p) {
        if (-not (Test-Path -LiteralPath $bpub)) { New-Item -ItemType Directory -Path $bpub -Force | Out-Null }
        Copy-Item -LiteralPath $p -Destination $bpub -Recurse -Force
    }
}
$rollback = @(
    ('Gear World Hub - rollback of the legal pages, {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    'Only with approval. In PowerShell:',
    ('  cd "{0}"' -f $HubDir),
    ('  Copy-Item "{0}\index.html" ".\public\" -Force' -f $bdir),
    ('  Remove-Item {0} -Recurse -Force' -f (($Folders | ForEach-Object { '".\public\' + $_ + '"' }) -join ',')),
    ('  if (Test-Path "{0}\public") {{ Copy-Item "{0}\public\*" ".\public\" -Recurse -Force }}' -f $bdir),
    '  npx wrangler deploy',
    'No D1 change was made, so there is nothing to restore in the database.'
) -join "`r`n"
[System.IO.File]::WriteAllText((Join-Path $bdir 'ROLLBACK.txt'), $rollback, (New-Object System.Text.UTF8Encoding($false)))
Say ('Backup και οδηγίες επαναφοράς: {0}' -f $bdir) 'Green'

# 6. Files + deploy
$w = Run-Patcher @('--write')
if ($w.code -ne 0) { Say 'Η αλλαγή των αρχείων απέτυχε: τα επαναφέρω.' 'Red'; Restore-Files $bdir; Finish 6 }
Say 'Οι σελίδες και τα links γράφτηκαν στον φάκελο του hub.' 'Green'
$d = Invoke-Wrangler 'deploy'
if ($d.code -ne 0) {
    Say 'Το deploy του hub απέτυχε. Το live hub ΔΕΝ άλλαξε. Επαναφέρω τα αρχεία στον υπολογιστή. Έξοδος:' 'Red'
    Say $d.text
    Restore-Files $bdir
    Finish 9
}
Say 'Το hub ανέβηκε με τις νομικές σελίδες.' 'Green'

# 7. Live checks
if (-not $SkipOnline) {
    Start-Sleep -Seconds 5
    $okAll = $true
    foreach ($p in @($plan.json.paths)) {
        try {
            $t = Get-Text ($HubUrl + $p + '?v=' + $stamp)
            $good = $t.Contains('/legal/legal.css')
            Say ('  {0}{1}: {2}' -f $HubUrl, $p, $(if ($good) { 'OK' } else { 'ανοίγει, αλλά όχι η νέα σελίδα (cache, ξαναδές σε 1 λεπτό)' }))
            if (-not $good) { $okAll = $false }
        } catch {
            Say ('  {0}{1}: ΔΕΝ άνοιξε ({2})' -f $HubUrl, $p, $_.Exception.Message) 'Yellow'
            $okAll = $false
        }
    }
    try {
        $homePage = Get-Text ($HubUrl + '/?v=' + $stamp)
        Say ('  Footer της αρχικής με τα links: {0}' -f $(if ($homePage.Contains('GWH-LEGAL-LINKS')) { 'ναι' } else { 'ΟΧΙ ακόμα (cache, ξαναδές σε 1 λεπτό)' }))
        $s = Get-Text ($HubUrl + '/api/health')
        Say ('  /api/health: {0}' -f $s)
    } catch {
        Say ('  Ο έλεγχος της αρχικής δεν ολοκληρώθηκε: {0}' -f $_.Exception.Message) 'Yellow'
    }
    if (-not $okAll) { Say 'Κάποιες σελίδες δεν φάνηκαν ακόμα. Στείλε την αναφορά στο Claude.' 'Yellow' }
}
Say ''
Say 'ΕΤΟΙΜΟ: οι νομικές σελίδες είναι στο Gear World Hub.' 'Green'
Finish 0
