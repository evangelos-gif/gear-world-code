<#
.SYNOPSIS
  Google Ads tag on the 12 live sites (lessons L93): the cookie banner, the Google tag AW-18554591090 only after
  "Allow" (consent mode v2), the conversion "outbound_click" on "View at" and discount-code clicks, and the campaign
  (utm_source / utm_campaign) passed to Awin. Read-only unless -Apply and the approval phrase.

.DESCRIPTION
  -Step check   READ-ONLY. The 12 site tools are there? Shows the plan.
  -Step apply   CHANGES THE 12 LIVE SITES, one approval: ΕΓΚΡΙΝΩ GOOGLE ADS TAG. In this order:
                  1. the 12 sites, each with its own update step and its usual checks (newer sites first). Each update
                     publishes this version: consent.js, the banner, "Cookie settings", the new cookies and privacy
                     texts, the styles and the translations;
                  2. every home page has the banner and the Google Ads line, and no Google script in the page itself.
                It stops at the first problem; sites already updated keep working. Running it again is safe.
                The site databases and their settings on this PC do not change. Pets (ZGW) gets it at its launch.
                Going back: each site tool's update with the version before (git commit ef72ae4).
  Report: <home>\gear-world-reports\GOOGLE_ADS_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'apply')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$PcHome = '',
    [string]$OutDir = '',
    [string]$SiteToolDir = '',
    [switch]$NoClipboard,
    [switch]$NoHttpCheck
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ GOOGLE ADS TAG'
if (-not $PcHome) { $PcHome = $HOME }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
if (-not $SiteToolDir) { $SiteToolDir = Join-Path $repo 'tools' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

# The 12 live sites in the order of the update: the newer ones first, then the older ones.
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
    $file = Join-Path $OutDir ('GOOGLE_ADS_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('GOOGLE_ADS_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
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

# Does the home page have the banner and our Google Ads line, and no Google script in the page itself?
# (no utm_source and a bot user agent: never counted as a poster scan)
function Test-Ads([string]$domain) {
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add('User-Agent', 'GearWorldQA-bot/1.0 (+read-only check)')
        $wc.Encoding = [System.Text.Encoding]::UTF8
        try { $html = $wc.DownloadString(('https://{0}/?gwcheck={1}' -f $domain, $stamp)) } finally { $wc.Dispose() }
        return (($html -match '<meta name="gw-ads" content="AW-18554591090"') -and ($html -match 'data-consent hidden') -and -not ($html -match 'googletagmanager'))
    } catch { return $false }
}

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply) { $mode = 'APPLY (με έγκριση)' }
Say ('GOOGLE ADS TAG ON THE SITES - step: {0} - {1} - {2}' -f $Step, $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$problems = 0
$missingTools = @($Sites | Where-Object { -not (Test-Path -LiteralPath (Join-Path $SiteToolDir ($_.tool + '.ps1'))) } | ForEach-Object { $_.tool })
if ($missingTools.Count -gt 0) { Say ('Εργαλεία sites που λείπουν: {0}' -f ($missingTools -join ', ')) 'Yellow'; $problems++ }
else { Say 'Τα 12 εργαλεία των sites: υπάρχουν' }

if ($Step -eq 'check') {
    Say ''
    Say ('Πλάνο του apply (φράση: {0}):' -f $Phrase)
    Say ('  1. τα 12 sites, το καθένα με το δικό του update: {0}' -f (($Sites | ForEach-Object { $_.code.ToUpper() }) -join ', '))
    Say '     (banner για cookies, Google Ads μόνο μετά το «Allow», «Cookie settings», νέα κείμενα cookies/privacy)'
    Say '  2. έλεγχος ότι κάθε αρχική σελίδα έχει το banner και καμία κλήση στη Google πριν το «Allow»'
    Say '  Οι βάσεις των sites και οι ρυθμίσεις τους στον υπολογιστή δεν αλλάζουν.'
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

# 1. the 12 sites, one by one
$done = New-Object System.Collections.Generic.List[string]
foreach ($s in $Sites) {
    $tool = Join-Path $SiteToolDir ($s.tool + '.ps1')
    $exe = (Get-Process -Id $PID).Path
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $tool, '-Step', 'update', '-Apply', '-Approve', ('EGKRINO {0} UPDATE' -f $s.code.ToUpper()), '-OutDir', $OutDir, '-NoClipboard')
    Say ('1. {0}: ανεβαίνει...' -f $s.code.ToUpper())
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

# 2. every home page has the banner, and nothing from Google in the page itself
if (-not $NoHttpCheck) {
    Say ''
    $noAds = @()
    foreach ($s in $Sites) { if (-not (Test-Ads $s.domain)) { $noAds += $s.domain } }
    if ($noAds.Count -gt 0) { Say ('2. Το banner δεν φαίνεται ακόμα σε: {0} (η cache κρατάει έως λίγα λεπτά· στείλε στο Claude αυτή την αναφορά)' -f ($noAds -join ', ')) 'Yellow' }
    else { Say '2. Και οι 12 αρχικές σελίδες έχουν το banner και καμία κλήση στη Google πριν το «Allow»: ΕΝΤΑΞΕΙ' 'Green' }
}
Say ''
Say ('Ανέβηκαν: {0}' -f ($done -join ', '))
Say 'Αποτέλεσμα: ΕΤΟΙΜΟ' 'Green'
Finish 0
