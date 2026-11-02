<#
.SYNOPSIS
  "Get deal updates" on the 12 sites (lessons L92): the form at the bottom of every page, which sends a sign-up to the
  one member list of Gear World Hub. Read-only unless -Apply and the approval phrase.

.DESCRIPTION
  -Step check   READ-ONLY. Is the new Hub (with the member list) live? (sites/gwh/live-baseline.txt has members.js)
                The configs of the 6 newer sites on this PC: do they have the link HUB to the Hub? The 12 site tools are
                there? Shows the plan.
  -Step apply   CHANGES THE 12 LIVE SITES, one approval: ΕΓΚΡΙΝΩ DEAL UPDATES. In this order:
                  1. backup: copies of the 6 configs of this PC;
                  2. the link HUB in those 6 configs (the 6 older sites already have it as GW_HUB);
                  3. the 12 sites, each with its own update step and its usual checks (newer sites first). Each update
                     publishes this version: the form, the new privacy text, the new styles.
                  4. every home page shows the form.
                It stops at the first problem; sites already updated keep working. Running it again is safe.
                The site databases do not change: the sign-ups go to the Hub.
  Report: <home>\gear-world-reports\DEAL_UPDATES_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'apply')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$PcHome = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [string]$BaselineFile = '',
    [string]$SiteToolDir = '',
    [switch]$NoClipboard,
    [switch]$NoHttpCheck
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ DEAL UPDATES'
if (-not $PcHome) { $PcHome = $HOME }
if (-not $WorkDir) { $WorkDir = Join-Path $PcHome 'gear-world-deal-updates' }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
if (-not $SiteToolDir) { $SiteToolDir = Join-Path $repo 'tools' }
if (-not $BaselineFile) { $BaselineFile = Join-Path (Join-Path (Join-Path $repo 'sites') 'gwh') 'live-baseline.txt' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

# The 12 sites in the order of the update: the newer ones (their config stays on this PC and gets HUB), then the older
# ones (their config is made from the repo template, which already has GW_HUB).
$Sites = @(
    @{ code = 'sgw'; tool = 'sgw-cloudflare'; domain = 'sportygearworld.com'; pc = 'sporty-gear-world' },
    @{ code = 'tgw'; tool = 'tgw-cloudflare'; domain = 'technologygearworld.com'; pc = 'technology-gear-world' },
    @{ code = 'agw'; tool = 'agw-cloudflare'; domain = 'cargearworld.com'; pc = 'car-gear-world' },
    @{ code = 'vgw'; tool = 'vgw-cloudflare'; domain = 'travelgearworld.com'; pc = 'travel-gear-world' },
    @{ code = 'bgw'; tool = 'bgw-cloudflare'; domain = 'bikergearworld.com'; pc = 'biker-gear-world' },
    @{ code = 'pgw'; tool = 'pgw-cloudflare'; domain = 'gaminggearworld.com'; pc = 'gaming-gear-world' },
    @{ code = 'cgw'; tool = 'cgw-engine'; domain = 'constructiongearworld.com'; pc = '' },
    @{ code = 'mgw'; tool = 'mgw-engine'; domain = 'mensgearworld.com'; pc = '' },
    @{ code = 'wgw'; tool = 'wgw-engine'; domain = 'womensgearworld.com'; pc = '' },
    @{ code = 'kgw'; tool = 'kgw-engine'; domain = 'kidsgearworld.com'; pc = '' },
    @{ code = 'hgw'; tool = 'hgw-engine'; domain = 'homegearworld.com'; pc = '' },
    @{ code = 'ggw'; tool = 'ggw-engine'; domain = 'gardengearworld.com'; pc = '' }
)

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
    $file = Join-Path $OutDir ('DEAL_UPDATES_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('DEAL_UPDATES_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
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

function Invoke-HubBinding([string]$mode, [string]$file) {
    $helper = Join-Path (Join-Path $repo 'tools') 'hub-binding.mjs'
    $out = @(& node $helper $mode $file)
    $code = $LASTEXITCODE
    $text = (($out | ForEach-Object { "$_" }) -join ' ').Trim()
    if ($code -ne 0) { return ('error ' + $text) }
    return $text
}

# Does the home page show the form? (no utm_source and a bot user agent: never counted as a poster scan)
function Test-Form([string]$domain) {
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add('User-Agent', 'GearWorldQA-bot/1.0 (+read-only check)')
        $wc.Encoding = [System.Text.Encoding]::UTF8
        try { $html = $wc.DownloadString(('https://{0}/?gwcheck={1}' -f $domain, $stamp)) } finally { $wc.Dispose() }
        return ($html -match 'class="deal-form"')
    } catch { return $false }
}

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply) { $mode = 'APPLY (με έγκριση)' }
Say ('DEAL UPDATES ON THE SITES - step: {0} - {1} - {2}' -f $Step, $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$problems = 0
# 1. the Hub with the member list must be live first (else the forms would have nowhere to send)
$hubReady = $false
if (Test-Path -LiteralPath $BaselineFile) { $hubReady = ([System.IO.File]::ReadAllText($BaselineFile) -match '(?m)^members\.js \| ') }
if ($hubReady) { Say 'Νέο Hub με τη λίστα μελών: live: ΕΝΤΑΞΕΙ' 'Green' }
else { Say 'Νέο Hub με τη λίστα μελών: ΔΕΝ είναι ακόμα live (πρώτα ΕΓΚΡΙΝΩ HUB MEMBERS και το νέο Hub).' 'Yellow'; $problems++ }

# 2. the configs of the newer sites on this PC, and the site tools
Say ''
Say 'Ρυθμίσεις των νέων sites στον υπολογιστή (σύνδεση HUB):'
$cfgs = @{}
foreach ($s in $Sites) {
    if (-not $s.pc) { continue }
    $f = Join-Path (Join-Path $PcHome $s.pc) 'wrangler.jsonc'
    $cfgs[$s.code] = $f
    if (-not (Test-Path -LiteralPath $f)) { Say ('  {0}: ΠΡΟΒΛΗΜΑ - δεν βρέθηκε το {1}' -f $s.code.ToUpper(), $f) 'Yellow'; $problems++; continue }
    $st = Invoke-HubBinding 'check-hub' $f
    if ($st -eq 'has') { Say ('  {0}: HUB υπάρχει' -f $s.code.ToUpper()) }
    elseif ($st -eq 'missing') { Say ('  {0}: HUB θα μπει' -f $s.code.ToUpper()) }
    else { Say ('  {0}: ΠΡΟΒΛΗΜΑ - {1}' -f $s.code.ToUpper(), $st) 'Yellow'; $problems++ }
}
$missingTools = @($Sites | Where-Object { -not (Test-Path -LiteralPath (Join-Path $SiteToolDir ($_.tool + '.ps1'))) } | ForEach-Object { $_.tool })
if ($missingTools.Count -gt 0) { Say ('Εργαλεία sites που λείπουν: {0}' -f ($missingTools -join ', ')) 'Yellow'; $problems++ }
else { Say 'Τα 12 εργαλεία των sites: υπάρχουν' }

if ($Step -eq 'check') {
    Say ''
    Say ('Πλάνο του apply (φράση: {0}):' -f $Phrase)
    Say '  1. αντίγραφα των 6 ρυθμίσεων του υπολογιστή'
    Say '  2. η σύνδεση HUB στις 6 ρυθμίσεις (τα 6 παλιά sites την έχουν ήδη ως GW_HUB)'
    Say ('  3. τα 12 sites, το καθένα με το δικό του update: {0}' -f (($Sites | ForEach-Object { $_.code.ToUpper() }) -join ', '))
    Say '  4. έλεγχος ότι κάθε αρχική σελίδα δείχνει τη φόρμα «Get deal updates»'
    Say '  Οι βάσεις των sites δεν αλλάζουν: οι εγγραφές πάνε στη λίστα του Hub.'
    Say ''
    if ($problems -gt 0) { Say 'Αποτέλεσμα: ΠΡΟΣΟΧΗ (δες τα παραπάνω). Δεν άλλαξε τίποτα.' 'Yellow'; Finish 2 }
    Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ (μόνο έλεγχος, δεν άλλαξε τίποτα)' 'Green'
    Finish 0
}

# ================= apply =================
if (-not $Apply) { Say ''; Say ('Χωρίς -Apply δεν αλλάζει τίποτα. Για την αλλαγή: -Step apply -Apply και η φράση {0}' -f $Phrase) 'Yellow'; Finish 0 }
if ($problems -gt 0) { Say 'Υπάρχουν προβλήματα (δες τα παραπάνω): ΔΕΝ αλλάζω τίποτα.' 'Red'; Finish 8 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
Say ''
Say 'Έγκριση: ΕΝΤΑΞΕΙ.' 'Green'

# 1. backup of the 6 configs of this PC
$bdir = Join-Path (Join-Path $WorkDir 'backups') ('before-deal-updates-' + $stamp)
New-Item -ItemType Directory -Path $bdir -Force | Out-Null
foreach ($k in $cfgs.Keys) { Copy-Item -LiteralPath $cfgs[$k] -Destination (Join-Path $bdir ($k + '.wrangler.jsonc')) -Force }
Say ('1. Αντίγραφα των ρυθμίσεων: {0}' -f $bdir) 'Green'

# 2. HUB in the 6 configs
foreach ($s in $Sites) {
    if (-not $s.pc) { continue }
    $r = Invoke-HubBinding 'add-hub' $cfgs[$s.code]
    if ($r -ne 'added' -and $r -ne 'already') { Say ('2. {0}: η σύνδεση HUB δεν μπήκε ({1}). Κανένα site δεν άλλαξε. Στείλε στο Claude αυτό το μήνυμα.' -f $s.code.ToUpper(), $r) 'Red'; Finish 9 }
}
Say '2. Σύνδεση HUB στις 6 ρυθμίσεις: ΕΝΤΑΞΕΙ' 'Green'

# 3. the 12 sites, one by one
$done = New-Object System.Collections.Generic.List[string]
foreach ($s in $Sites) {
    $tool = Join-Path $SiteToolDir ($s.tool + '.ps1')
    $exe = (Get-Process -Id $PID).Path
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $tool, '-Step', 'update', '-Apply', '-Approve', ('EGKRINO {0} UPDATE' -f $s.code.ToUpper()), '-OutDir', $OutDir, '-NoClipboard')
    Say ('3. {0}: ανεβαίνει...' -f $s.code.ToUpper())
    & $exe @a | Out-Null
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        Say ('   {0}: ΠΡΟΒΛΗΜΑ (κωδικός {1}). Σταμάτησα εδώ. Ανέβηκαν ήδη: {2}' -f $s.code.ToUpper(), $code, $(if ($done.Count) { $done -join ', ' } else { 'κανένα' })) 'Red'
        $rep = @(Get-ChildItem -LiteralPath $OutDir -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like ('*' + $s.code + '*') -or $_.Name -like ('*' + $s.code.ToUpper() + '*') -or $_.Name -like ($s.tool + '*') } | Sort-Object LastWriteTime | Select-Object -Last 1)
        if ($rep.Count -eq 1) { foreach ($line in @([System.IO.File]::ReadAllLines($rep[0].FullName) | Select-Object -Last 15)) { Say ('     ' + $line) } }
        Finish 12
    }
    $done.Add($s.code.ToUpper())
    Say ('   {0}: ΕΝΤΑΞΕΙ' -f $s.code.ToUpper()) 'Green'
}

# 4. every home page shows the form
if (-not $NoHttpCheck) {
    Say ''
    $noForm = @()
    foreach ($s in $Sites) { if (-not (Test-Form $s.domain)) { $noForm += $s.domain } }
    if ($noForm.Count -gt 0) { Say ('4. Η φόρμα δεν φαίνεται ακόμα σε: {0} (η cache κρατάει έως λίγα λεπτά· στείλε στο Claude αυτή την αναφορά)' -f ($noForm -join ', ')) 'Yellow' }
    else { Say '4. Η φόρμα «Get deal updates» φαίνεται και στις 12 αρχικές σελίδες: ΕΝΤΑΞΕΙ' 'Green' }
}
Say ''
Say ('Ανέβηκαν: {0}' -f ($done -join ', '))
Say 'Αποτέλεσμα: ΕΤΟΙΜΟ' 'Green'
Finish 0
