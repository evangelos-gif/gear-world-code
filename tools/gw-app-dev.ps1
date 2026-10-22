<#
.SYNOPSIS
  Gear World app - puts the app code on this PC and starts it for the phone (Expo Go). Read-only unless -Apply.

.DESCRIPTION
  Without -Apply (READ-ONLY): checks Node.js and npm, and shows where the app would go
  (<home>\gear-world-app\mobile). Nothing is changed.

  With -Apply and the phrase ΕΓΚΡΙΝΩ GEAR WORLD APP SETUP:
    1. If the folder already exists, it is first moved to <home>\gear-world-app\backups\mobile-<time> (backup).
    2. Copies the app code from this repo version and installs its packages (npm ci, only inside that folder).
    3. Starts the app server (Expo). A QR code appears: scan it with Expo Go (Android) or the Camera (iPhone).
       Stop it with Ctrl+C. Nothing is published: the app runs only on your phone, from this PC.
  It never touches the Hub, the sites, Cloudflare, D1 or the stores.

  -InstallNode with the phrase ΕΓΚΡΙΝΩ NODE LTS installs the current Node.js LTS with winget (only if Node.js is too old).
  -StartOnly starts the app server again from the existing folder (nothing is copied or installed).
  The phone connects through an ngrok tunnel (works on any network). -Lan uses the local Wi-Fi instead.

  Report: <home>\gear-world-reports\GW_APP_DEV_<time>.txt (also copied to the clipboard)
#>
param(
    [switch]$Apply,
    [string]$Approve = '',
    [switch]$InstallNode,
    [switch]$StartOnly,
    [switch]$Lan,
    [string]$Target = '',
    [string]$OutDir = '',
    [switch]$SkipNodeCheck,
    [switch]$SkipInstall,
    [switch]$NoStart,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ GEAR WORLD APP SETUP'
$NodePhrase = 'ΕΓΚΡΙΝΩ NODE LTS'
$source = Join-Path (Join-Path $repo 'app') 'mobile'
if (-not $Target) { $Target = Join-Path (Join-Path $HOME 'gear-world-app') 'mobile' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Skip = @('node_modules', '.expo', 'dist', 'web-build')

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Save-Report {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('GW_APP_DEV_{0}.txt' -f $stamp)
    $text = $L -join "`r`n"
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
}

function Finish([int]$code) { Save-Report; exit $code }

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

# Expo needs Node.js 22.13+ or 24.3+ (or 26+). Returns @{ ok; text }.
function Test-Node {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $cmd) { return @{ ok = $false; text = 'δεν βρέθηκε' } }
    $v = ([string](& node --version)).Trim()
    $m = [regex]::Match($v, '^v(\d+)\.(\d+)')
    if (-not $m.Success) { return @{ ok = $false; text = $v } }
    $major = [int]$m.Groups[1].Value; $minor = [int]$m.Groups[2].Value
    $ok = ($major -eq 22 -and $minor -ge 13) -or ($major -eq 24 -and $minor -ge 3) -or ($major -ge 26)
    return @{ ok = $ok; text = $v }
}

function Get-LanIp {
    try {
        $ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -ExpandProperty IPAddress)
        if ($ips.Count -gt 0) { return $ips[0] }
    } catch { }
    return ''
}

function Copy-App([string]$from, [string]$to) {
    $base = (Resolve-Path -LiteralPath $from).Path.TrimEnd('\', '/')
    $n = 0
    foreach ($f in (Get-ChildItem -LiteralPath $from -Recurse -File -Force)) {
        $rel = $f.FullName.Substring($base.Length + 1)
        $first = ($rel -split '[\\/]')[0]
        if ($Skip -contains $first) { continue }
        $dest = Join-Path $to $rel
        $dd = Split-Path -Parent $dest
        if (-not (Test-Path -LiteralPath $dd)) { New-Item -ItemType Directory -Path $dd -Force | Out-Null }
        Copy-Item -LiteralPath $f.FullName -Destination $dest -Force
        $n++
    }
    return $n
}

function Start-Expo([string]$dir) {
    Say ''
    Say 'Ξεκινάω την εφαρμογή (Expo). Σε λίγο εμφανίζεται ένα QR code.' 'Cyan'
    Say '  Android: άνοιξε το Expo Go και πάτα «Scan QR code».'
    Say '  iPhone: άνοιξε την Κάμερα και σκάναρε το QR code.'
    Say '  Η σύνδεση περνά από tunnel (ngrok), οπότε δουλεύει με οποιοδήποτε Wi-Fi ή δεδομένα κινητού.'
    Say '  Για να σταματήσει: Ctrl+C σε αυτό το παράθυρο.'
    Save-Report
    try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
    Push-Location -LiteralPath $dir
    try {
        $env:EXPO_NO_TELEMETRY = '1'
        if ($Lan) { & npx.cmd expo start --lan } else { & npx.cmd expo start --tunnel ngrok }
    } finally { Pop-Location }
}

Say ('GEAR WORLD APP DEV - {0} - {1}' -f $(if ($Apply -or $InstallNode) { 'APPLY (με έγκριση)' } elseif ($StartOnly) { 'ΕΚΚΙΝΗΣΗ' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ' }), (Get-Date -Format 'yyyy-MM-dd HH:mm'))
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))

# 1. Node.js
$node = @{ ok = $true; text = '(δεν ελέγχθηκε)' }
if (-not $SkipNodeCheck) { $node = Test-Node }
Say ('Node.js: {0} {1}' -f $node.text, $(if ($node.ok) { '(OK)' } else { '(χρειάζεται 22.13 ή νεότερο LTS)' })) $(if ($node.ok) { 'Green' } else { 'Yellow' })

if ($InstallNode) {
    if ($node.ok) { Say 'Το Node.js είναι ήδη εντάξει: δεν χρειάζεται εγκατάσταση.' 'Green'; Finish 0 }
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το winget σε αυτόν τον υπολογιστή. Στείλε την αναφορά στο Claude.' 'Red'; Finish 3 }
    Say 'Θα εγκατασταθεί το Node.js LTS (επίσημο πακέτο OpenJS.NodeJS.LTS μέσω winget). Τα υπόλοιπα εργαλεία Gear World δουλεύουν και με αυτό.'
    if (-not (Confirm-Approval $NodePhrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
    & winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) { Say ('Το winget σταμάτησε με κωδικό {0}.' -f $LASTEXITCODE) 'Red'; Finish 9 }
    Say 'Έτοιμο. ΚΛΕΙΣΕ αυτό το PowerShell και άνοιξε καινούργιο, ώστε να φανεί η νέα έκδοση.' 'Green'
    Finish 0
}

if (-not (Test-Path -LiteralPath (Join-Path $source 'package.json'))) { Say ('Δεν βρήκα τον κώδικα της εφαρμογής: {0}' -f $source) 'Red'; Finish 2 }
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
if (-not $npm -and -not $SkipInstall) { Say 'Δεν βρέθηκε το npm (έρχεται μαζί με το Node.js).' 'Red'; Finish 3 }

if ($StartOnly) {
    if (-not (Test-Path -LiteralPath (Join-Path $Target 'node_modules'))) { Say 'Η εφαρμογή δεν έχει στηθεί ακόμα σε αυτόν τον υπολογιστή. Τρέξε πρώτα την εντολή με -Apply.' 'Red'; Finish 2 }
    if (-not $node.ok) { Say 'Πρώτα χρειάζεται νεότερο Node.js.' 'Red'; Finish 3 }
    if ($NoStart) { Finish 0 }
    Start-Expo $Target
    exit 0
}

# 2. Plan
Say ('Φάκελος της εφαρμογής: {0}' -f $Target)
$exists = Test-Path -LiteralPath $Target
if ($exists) { Say 'Ο φάκελος υπάρχει ήδη: με -Apply μετακινείται πρώτα σε backup.' 'Yellow' } else { Say 'Ο φάκελος δεν υπάρχει: θα δημιουργηθεί καινούργιος.' }
$ip = Get-LanIp
if ($ip) { Say ('Διεύθυνση του υπολογιστή στο δίκτυο: {0}' -f $ip) }
Say 'Τι θα γίνει με -Apply: αντιγραφή του κώδικα, εγκατάσταση πακέτων (npm ci, μόνο μέσα στον φάκελο), εκκίνηση με QR code.'
Say 'ΔΕΝ αλλάζουν: το Hub, τα sites, το Cloudflare, οι D1 και τα stores.'
if (-not $node.ok) {
    Say ''
    Say 'Πρώτα χρειάζεται νεότερο Node.js. Στείλε αυτή την αναφορά στο Claude για την εντολή εγκατάστασης.' 'Yellow'
    Finish 3
}
if (-not $Apply) { Say ''; Say 'Μόνο έλεγχος (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }

# 3. Approval
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
Say ('Έγκριση: {0}' -f $Phrase) 'Green'

# 4. Backup (moved, never deleted) and copy
if ($exists) {
    $bdir = Join-Path (Split-Path -Parent $Target) 'backups'
    if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
    $backup = Join-Path $bdir ('mobile-' + $stamp)
    Move-Item -LiteralPath $Target -Destination $backup
    Say ('Backup: ο παλιός φάκελος μετακινήθηκε στο {0}' -f $backup) 'Green'
}
New-Item -ItemType Directory -Path $Target -Force | Out-Null
$count = Copy-App $source $Target
Say ('Αντιγράφηκαν {0} αρχεία στο {1}' -f $count, $Target) 'Green'

# 5. Packages
if (-not $SkipInstall) {
    Say 'Εγκατάσταση πακέτων (npm ci). Παίρνει μερικά λεπτά, άφησέ το να τελειώσει...'
    Push-Location -LiteralPath $Target
    try {
        $env:CI = 'true'
        & $npm.Source ci --no-audit --no-fund
        $code = $LASTEXITCODE
    } finally { Pop-Location; Remove-Item Env:\CI -ErrorAction SilentlyContinue }
    if ($code -ne 0) { Say ('Η εγκατάσταση πακέτων σταμάτησε με κωδικό {0}. Στείλε την αναφορά και ό,τι γράφει η οθόνη στο Claude.' -f $code) 'Red'; Finish 9 }
    Say 'Πακέτα: OK' 'Green'
}
Say ''
Say 'Επαναφορά (αν τη χρειαστείς): διάγραψε τον φάκελο της εφαρμογής. Το Hub και τα sites δεν άλλαξαν.'
Say ('  Remove-Item -LiteralPath "{0}" -Recurse -Force' -f $Target)

# 6. Start
if ($NoStart) { Finish 0 }
Start-Expo $Target
exit 0
