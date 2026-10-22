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
  -BuildApk with the phrase ΕΓΚΡΙΝΩ GEAR WORLD APP BUILD (-BuildApprove) starts a test APK build in the Expo cloud
    (EAS Build, profile "preview", account in app.json) and reports the link to install it on the phone.
    Nothing is sent to Google Play or the App Store. Works together with -Apply (fresh copy first) or on its own.
  -BuildIos with the phrase ΕΓΚΡΙΝΩ GEAR WORLD IOS TESTFLIGHT (-IosApprove) builds the iPhone app in the Expo cloud
    (profile "production") and uploads it to TestFlight, Apple's private testing area (not the public App Store).
    It asks in this window for the Apple account sign-in and the 2FA code; they are never written to the report.
  The phone connects through an ngrok tunnel (works on any network). -Lan uses the local Wi-Fi instead.

  Report: <home>\gear-world-reports\GW_APP_DEV_<time>.txt (also copied to the clipboard)
#>
param(
    [switch]$Apply,
    [string]$Approve = '',
    [switch]$InstallNode,
    [switch]$StartOnly,
    [switch]$BuildApk,
    [string]$BuildApprove = '',
    [switch]$BuildIos,
    [string]$IosApprove = '',
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
$BuildPhrase = 'ΕΓΚΡΙΝΩ GEAR WORLD APP BUILD'
$IosPhrase = 'ΕΓΚΡΙΝΩ GEAR WORLD IOS TESTFLIGHT'
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

function Confirm-Approval([string]$phrase, [string]$given) {
    $typed = $given
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

function Read-AppJson([string]$dir) {
    $f = Join-Path $dir 'app.json'
    if (-not (Test-Path -LiteralPath $f)) { return $null }
    try { return ([System.IO.File]::ReadAllText($f) | ConvertFrom-Json).expo } catch { return $null }
}

# The Expo project of the app folder: owner and slug from app.json; stops if the link to Expo (projectId) is missing.
function Get-EasProject([string]$dir) {
    $app = Read-AppJson $dir
    $projectId = ''
    if ($app -and $app.extra -and $app.extra.eas) { $projectId = [string]$app.extra.eas.projectId }
    if (-not $projectId) { Say 'Λείπει η σύνδεση με το έργο Expo (projectId στο app.json). Στείλε αυτή την αναφορά στο Claude.' 'Red'; Finish 2 }
    return @{ owner = [string]$app.owner; slug = [string]$app.slug }
}

function First-BuildId([string]$text) {
    $id = ''
    try { foreach ($b in ($text | ConvertFrom-Json)) { if ($b.id) { $id = [string]$b.id; break } } } catch { $id = '' }
    if (-not $id) { $m = [regex]::Match($text, '"id"\s*:\s*"([0-9a-fA-F-]{36})"'); if ($m.Success) { $id = $m.Groups[1].Value } }
    return $id
}

# Test APK in the Expo cloud (EAS Build, profile "preview"). Approval is checked by the caller.
function Build-Apk([string]$dir) {
    Say ''
    Say 'Νέο APK για δοκιμή (EAS Build, προφίλ preview).' 'Cyan'
    $proj = Get-EasProject $dir
    $owner = $proj.owner; $slug = $proj.slug
    Say ('  Λογαριασμός Expo: {0}, έργο: {1}. Το build γίνεται στο cloud του Expo (περίπου 10-20 λεπτά).' -f $owner, $slug)
    Say '  ΔΕΝ στέλνεται τίποτα στο Google Play ή στο App Store. Το Hub και τα sites δεν αλλάζουν.'
    Push-Location -LiteralPath $dir
    $notLoggedIn = $false
    try {
        $env:EAS_NO_VCS = '1'
        $env:EAS_PROJECT_ROOT = $dir
        $env:EXPO_NO_TELEMETRY = '1'
        $who = & npx.cmd --yes eas-cli@latest whoami
        $whoCode = $LASTEXITCODE
        if ($whoCode -ne 0) {
            $notLoggedIn = $true
        } else {
            Say ('  Συνδεδεμένος στο Expo ως: {0}' -f (($who | Out-String).Trim() -split "`r?`n")[0])
            Say '  Ανεβαίνει ο κώδικας και ξεκινά το build. Περίμενε μέχρι να ξαναεμφανιστεί η γραμμή εντολών...'
            $out = & npx.cmd --yes eas-cli@latest build --platform android --profile preview --non-interactive --no-wait --json
            $code = $LASTEXITCODE
        }
    } finally {
        Pop-Location
        Remove-Item Env:\EAS_NO_VCS, Env:\EAS_PROJECT_ROOT -ErrorAction SilentlyContinue
    }
    if ($notLoggedIn) {
        Say 'Δεν είσαι συνδεδεμένος στο Expo σε αυτόν τον υπολογιστή. Στείλε αυτή την αναφορά στο Claude για την εντολή σύνδεσης.' 'Red'
        Finish 4
    }
    $text = ($out | Out-String).Trim()
    if ($code -ne 0) {
        Say ('Το build δεν ξεκίνησε (κωδικός {0}). Στείλε την αναφορά και ό,τι γράφει η οθόνη στο Claude.' -f $code) 'Red'
        if ($text) { Say $text }
        Finish 9
    }
    $id = First-BuildId $text
    if (-not $id) {
        Say 'Το build στάλθηκε, αλλά δεν διάβασα τον αριθμό του. Δες τη λίστα builds:' 'Yellow'
        Say ('  https://expo.dev/accounts/{0}/projects/{1}/builds' -f $owner, $slug)
        return
    }
    $link = 'https://expo.dev/accounts/{0}/projects/{1}/builds/{2}' -f $owner, $slug, $id
    Say ''
    Say 'Το build ξεκίνησε.' 'Green'
    Say ('  Link του build: {0}' -f $link)
    Say '  Σε 10-20 λεπτά άνοιξε αυτό το link στο κινητό Android, πάτα «Install» και μετά άνοιξε το αρχείο που κατέβηκε.'
    Say '  Το νέο APK εγκαθίσταται πάνω από το παλιό (μένουν οι ρυθμίσεις σου).'
}

# iPhone app: EAS Build (profile "production") in the Expo cloud, then EAS Submit uploads it to TestFlight
# (App Store Connect, private testing). Interactive on purpose: Apple sign-in and 2FA are typed in this window
# and are never captured. Approval is checked by the caller.
function Build-Ios([string]$dir) {
    Say ''
    Say 'iPhone: build και ανέβασμα στο TestFlight.' 'Cyan'
    $proj = Get-EasProject $dir
    $owner = $proj.owner; $slug = $proj.slug
    Say ('  Λογαριασμός Expo: {0}, έργο: {1}. Το build γίνεται στο cloud του Expo (περίπου 15-30 λεπτά) και μετά ανεβαίνει μόνο του στο TestFlight.' -f $owner, $slug)
    Say '  Το TestFlight είναι η ιδιωτική περιοχή δοκιμών της Apple: η εφαρμογή ΔΕΝ γίνεται δημόσια στο App Store.'
    Say '  Τι θα σε ρωτήσει (απαντάς σε αυτό το παράθυρο):'
    Say '    "Do you want to log in to your Apple account?"  ->  Y'
    Say '    "Apple ID"  ->  το email του Apple Account σου'
    Say '    "Password"  ->  ο κωδικός του (δεν φαίνεται όσο γράφεις, είναι κανονικό)'
    Say '    κωδικός 6 ψηφίων  ->  αυτός που εμφανίζεται στη συσκευή ή στο SMS σου'
    Say '    "Generate a new Apple Distribution Certificate / Provisioning Profile / App Store Connect API Key?"  ->  Y'
    Say '    σε ό,τι άλλο ρωτήσει  ->  Enter (η προτεινόμενη απάντηση)'
    Say '  Ο κωδικός πηγαίνει μόνο στην Apple: δεν γράφεται στην αναφορά και δεν τον βλέπει το Claude.'
    Push-Location -LiteralPath $dir
    $notLoggedIn = $false
    try {
        $env:EAS_NO_VCS = '1'
        $env:EAS_PROJECT_ROOT = $dir
        $env:EXPO_NO_TELEMETRY = '1'
        $who = & npx.cmd --yes eas-cli@latest whoami
        if ($LASTEXITCODE -ne 0) {
            $notLoggedIn = $true
        } else {
            Say ('  Συνδεδεμένος στο Expo ως: {0}' -f (($who | Out-String).Trim() -split "`r?`n")[0])
            Write-Host ''
            & npx.cmd --yes eas-cli@latest build --platform ios --profile production --auto-submit --no-wait
            $code = $LASTEXITCODE
            if ($code -eq 0) {
                $out = & npx.cmd --yes eas-cli@latest build:list --platform ios --limit 1 --json --non-interactive
            }
        }
    } finally {
        Pop-Location
        Remove-Item Env:\EAS_NO_VCS, Env:\EAS_PROJECT_ROOT -ErrorAction SilentlyContinue
    }
    if ($notLoggedIn) {
        Say 'Δεν είσαι συνδεδεμένος στο Expo σε αυτόν τον υπολογιστή. Στείλε αυτή την αναφορά στο Claude για την εντολή σύνδεσης.' 'Red'
        Finish 4
    }
    if ($code -ne 0) {
        Say ('Το iPhone build δεν ξεκίνησε (κωδικός {0}). Στείλε την αναφορά και μια φωτογραφία της οθόνης στο Claude.' -f $code) 'Red'
        Finish 9
    }
    $id = First-BuildId (($out | Out-String).Trim())
    Say ''
    Say 'Το iPhone build ξεκίνησε και θα ανέβει μόνο του στο TestFlight.' 'Green'
    if ($id) { Say ('  Link του build: https://expo.dev/accounts/{0}/projects/{1}/builds/{2}' -f $owner, $slug, $id) }
    else { Say ('  Λίστα builds: https://expo.dev/accounts/{0}/projects/{1}/builds' -f $owner, $slug) }
    Say '  Σε 30-60 λεπτά θα το δεις στο App Store Connect: https://appstoreconnect.apple.com/apps  ->  Gear World  ->  TestFlight.'
    Say '  Η Apple στέλνει και email όταν ολοκληρωθεί η επεξεργασία.'
}

# Approvals for the cloud builds, each with its own phrase. Checked before anything changes.
function Confirm-Builds {
    if ($BuildApk) {
        if (-not (Confirm-Approval $BuildPhrase $BuildApprove)) { return $false }
        Say ('Έγκριση: {0}' -f $BuildPhrase) 'Green'
    }
    if ($BuildIos) {
        if (-not (Confirm-Approval $IosPhrase $IosApprove)) { return $false }
        Say ('Έγκριση: {0}' -f $IosPhrase) 'Green'
    }
    return $true
}

Say ('GEAR WORLD APP DEV - {0} - {1}' -f $(if ($Apply -or $InstallNode -or $BuildApk -or $BuildIos) { 'APPLY (με έγκριση)' } elseif ($StartOnly) { 'ΕΚΚΙΝΗΣΗ' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ' }), (Get-Date -Format 'yyyy-MM-dd HH:mm'))
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))

# 1. Node.js
$node = @{ ok = $true; text = '(δεν ελέγχθηκε)' }
if (-not $SkipNodeCheck) { $node = Test-Node }
Say ('Node.js: {0} {1}' -f $node.text, $(if ($node.ok) { '(OK)' } else { '(χρειάζεται 22.13 ή νεότερο LTS)' })) $(if ($node.ok) { 'Green' } else { 'Yellow' })

if ($InstallNode) {
    if ($node.ok) { Say 'Το Node.js είναι ήδη εντάξει: δεν χρειάζεται εγκατάσταση.' 'Green'; Finish 0 }
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το winget σε αυτόν τον υπολογιστή. Στείλε την αναφορά στο Claude.' 'Red'; Finish 3 }
    Say 'Θα εγκατασταθεί το Node.js LTS (επίσημο πακέτο OpenJS.NodeJS.LTS μέσω winget). Τα υπόλοιπα εργαλεία Gear World δουλεύουν και με αυτό.'
    if (-not (Confirm-Approval $NodePhrase $Approve)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
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

if (($BuildApk -or $BuildIos) -and -not $Apply) {
    if (-not (Test-Path -LiteralPath (Join-Path $Target 'node_modules'))) { Say 'Η εφαρμογή δεν έχει στηθεί ακόμα σε αυτόν τον υπολογιστή. Τρέξε πρώτα την εντολή με -Apply.' 'Red'; Finish 2 }
    if (-not $node.ok) { Say 'Πρώτα χρειάζεται νεότερο Node.js.' 'Red'; Finish 3 }
    if (-not (Confirm-Builds)) { Say 'Δεν δόθηκε έγκριση για το build: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
    if ($BuildApk) { Build-Apk $Target }
    if ($BuildIos) { Build-Ios $Target }
    Finish 0
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
if (-not (Confirm-Approval $Phrase $Approve)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
Say ('Έγκριση: {0}' -f $Phrase) 'Green'
# Build approvals are checked before anything changes, so a wrong build phrase never leaves a half-done step.
if (-not (Confirm-Builds)) { Say 'Δεν δόθηκε έγκριση για το build: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

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
if ($exists) {
    # Keep the link to the Expo project (extra.eas.projectId, written by 'eas init' on this PC, not kept in the public repo).
    $oldJson = Join-Path $backup 'app.json'
    $newJson = Join-Path $Target 'app.json'
    if ((Test-Path -LiteralPath $oldJson) -and (Get-Command node -ErrorAction SilentlyContinue)) {
        $js = "const fs=require('fs');const [o,n]=process.argv.slice(1);const a=JSON.parse(fs.readFileSync(o,'utf8'));const b=JSON.parse(fs.readFileSync(n,'utf8'));const id=a.expo&&a.expo.extra&&a.expo.extra.eas&&a.expo.extra.eas.projectId;if(!id){console.log('none');process.exit(0)}b.expo.extra=b.expo.extra||{};b.expo.extra.eas=Object.assign({},b.expo.extra.eas,{projectId:id});fs.writeFileSync(n,JSON.stringify(b,null,2)+'\n');console.log('kept')"
        $r = & node -e $js $oldJson $newJson
        if ("$r" -eq 'kept') { Say 'Η σύνδεση με το έργο Expo κρατήθηκε (projectId).' 'Green' }
    }
}

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
Say 'Επαναφορά (αν τη χρειαστείς): το Hub και τα sites δεν άλλαξαν. Για να γυρίσει ο φάκελος της εφαρμογής όπως ήταν:'
if ($exists) {
    Say ('  Remove-Item -LiteralPath "{0}" -Recurse -Force; Move-Item -LiteralPath "{1}" -Destination "{0}"' -f $Target, $backup)
} else {
    Say ('  Remove-Item -LiteralPath "{0}" -Recurse -Force' -f $Target)
}

# 6. Cloud builds (only with -BuildApk / -BuildIos and their own phrases), then start
if ($BuildApk) { Build-Apk $Target }
if ($BuildIos) { Build-Ios $Target }
if ($BuildApk -or $BuildIos) { Finish 0 }
if ($NoStart) { Finish 0 }
Start-Expo $Target
exit 0
