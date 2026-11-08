<#
.SYNOPSIS
  Google Ads review fixes on the 13 live sites (lessons L101): the "Gear Cart" becomes a "Saved list" (no quantity,
  no total, bookmark icon, /saved/), the product page says "Sold by <retailer> (not by Gear World)", "<retailer>
  delivers to" and "Stock at <retailer>", /about/ says who runs Gear World, and every footer says "Run by Evangelos
  Kalogerakis, United Kingdom · We don't sell products" (owner's decision, 7/11/2026). The product structured data is an
  AggregateOffer (a comparison page, not a shop). In all 10 languages. Read-only unless -Apply and the phrase.
  Follow-up of the appeal (lessons L102): every product card, the price list and the saved list say "<retailer>
  delivers to" (the name untranslated), the compare table says "Sold by", "Stock at the retailer" and "The retailer
  delivers to", the seasonal banner of /deals/ and /discount-codes/ speaks of gifts or of comparing prices (never
  "offers") and shows only above real price drops or codes, and the unused "Quantity" text is gone.
  Clean-up (lessons L103): "Browse by category" (not "Shop by category"), "<n> retailers compared" (not "retailer
  partners"), "{0} compares prices across retailers" (not "trusted retailers"), the discount codes "published through
  the retailers' affiliate programmes" (not "given to their affiliate partners") and no "Shop through <site>" or "our
  retailers" in their description, "Lowest price (retailers listed)" in the Car guide (not "our shops"), and every
  retailer name inside a translated text ("View at", "Stock at", "Shop at", the codes) in its own translate="no" span.
  D1 rows read (lessons L105): the product pages of the 7 new-layout sites read the rows of a product group through the
  index idx_products_group_key (about 500 rows a page instead of about 62,000 on cargearworld.com), "similar products"
  reads fewer rows on all 13 sites, and robots.txt keeps SERankingBacklinksBot out. The index goes in FIRST
  (tools/d1-native-index.ps1, ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ D1); without it the new code reads about as much as the old one.

.DESCRIPTION
  -Step check   READ-ONLY. The 13 site tools are there? Shows the plan.
  -Step apply   CHANGES THE 13 LIVE SITES, one approval: ΕΓΚΡΙΝΩ ADS FIXES. In this order:
                  1. the 13 sites, each with its own update step and its usual checks (newer sites first). Each update
                     publishes this version of the engine, the site script, the icons and the dictionaries;
                  2. every home page links to /saved/ and has the new footer line, and every /about/ says who runs
                     Gear World.
                It stops at the first problem; sites already updated keep working. Running it again is safe.
                The site databases and their settings on this PC do not change. The Hub has its own step
                (tools/gwh-hub-v2.ps1, ΕΓΚΡΙΝΩ HUB CLEANUP LIVE for L103).
                Going back: each site tool's update with the version before (git commit 12e54c0 before L105;
                98b476d for the L103 clean-up; f4c8c35 for the L102 follow-up; c544884 before L101).
  Report: <home>\gear-world-reports\ADS_FIXES_<STEP>_<time>.txt (also copied to the clipboard)
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
$Phrase = 'ΕΓΚΡΙΝΩ ADS FIXES'
if (-not $PcHome) { $PcHome = $HOME }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
if (-not $SiteToolDir) { $SiteToolDir = Join-Path $repo 'tools' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

# The 13 live sites in the order of the update: the newer ones first (Pets, live since 1/11/2026, too), then the older ones.
$Sites = @(
    @{ code = 'sgw'; tool = 'sgw-cloudflare'; domain = 'sportygearworld.com'; pc = 'sporty-gear-world' },
    @{ code = 'tgw'; tool = 'tgw-cloudflare'; domain = 'technologygearworld.com'; pc = 'technology-gear-world' },
    @{ code = 'agw'; tool = 'agw-cloudflare'; domain = 'cargearworld.com'; pc = 'car-gear-world' },
    @{ code = 'vgw'; tool = 'vgw-cloudflare'; domain = 'travelgearworld.com'; pc = 'travel-gear-world' },
    @{ code = 'bgw'; tool = 'bgw-cloudflare'; domain = 'bikergearworld.com'; pc = 'biker-gear-world' },
    @{ code = 'pgw'; tool = 'pgw-cloudflare'; domain = 'gaminggearworld.com'; pc = 'gaming-gear-world' },
    @{ code = 'zgw'; tool = 'zgw-cloudflare'; domain = 'petsgearworld.com'; pc = 'pets-gear-world' },
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
    $file = Join-Path $OutDir ('ADS_FIXES_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('ADS_FIXES_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = Hide-Ids ($L -join "`r`n")
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Cyan }
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

# Does the home page link to the saved list and carry the new footer line, and does /about/ say who runs Gear World?
# L103: "Browse by category", no "Shop by category", "retailer partners" or "trusted retailers", the retailer name of
# "View at" in its own translate="no" span, and no "Shop through" / "our retailers" / "affiliate partners" on the codes page.
# (no utm_source and a bot user agent: never counted as a poster scan, never a click)
function Get-Page([string]$url) {
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add('User-Agent', 'GearWorldQA-bot/1.0 (+read-only check)')
        $wc.Encoding = [System.Text.Encoding]::UTF8
        try { return $wc.DownloadString($url) } finally { $wc.Dispose() }
    } catch { return '' }
}
function Test-Fixes([string]$domain) {
    $homePage = Get-Page ('https://{0}/?gwcheck={1}' -f $domain, $stamp)
    $about = Get-Page ('https://{0}/about/?gwcheck={1}' -f $domain, $stamp)
    $okHome = ($homePage -match 'href="/saved/"') -and ($homePage -match 'class="footer-legal"') -and ($homePage -match 'Run by Evangelos Kalogerakis, United Kingdom') -and -not ($homePage -match 'Gear Cart|\+ Cart<') -and -not ($homePage -match 'class="ship-word">Delivers to<')
    $okAbout = ($about -match 'class="about-lead"') -and ($about -match 'class="about-run"') -and ($about -match 'contact@gearworldhub\.com')
    $codes = Get-Page ('https://{0}/discount-codes/?gwcheck={1}' -f $domain, $stamp)
    $okL103 = ($homePage -match 'Browse by category') -and -not ($homePage -match 'Shop by category|retailer partners?|trusted retailers') -and ($homePage -match 'data-i18n="View at \{0\}"[^>]*data-i18n-keep="0"') -and -not ($codes -match 'Shop through|our retailers|affiliate partners')
    # L105: robots.txt keeps SERankingBacklinksBot out (the lines below it stay as they were).
    $robots = Get-Page ('https://{0}/robots.txt?gwcheck={1}' -f $domain, $stamp)
    $okL105 = ($robots -match '(?m)^User-agent: SERankingBacklinksBot\s*$') -and ($robots -match '(?m)^Disallow: /out/\s*$')
    return ($okHome -and $okAbout -and $okL103 -and $okL105)
}

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)'
if ($Apply) { $mode = 'APPLY (με έγκριση)' }
Say ('GOOGLE ADS REVIEW FIXES ON THE SITES - step: {0} - {1} - {2}' -f $Step, $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Magenta'; Finish 3 }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$problems = 0
$missingTools = @($Sites | Where-Object { -not (Test-Path -LiteralPath (Join-Path $SiteToolDir ($_.tool + '.ps1'))) } | ForEach-Object { $_.tool })
if ($missingTools.Count -gt 0) { Say ('Εργαλεία sites που λείπουν: {0}' -f ($missingTools -join ', ')) 'Yellow'; $problems++ }
else { Say ('Τα {0} εργαλεία των sites: υπάρχουν' -f $Sites.Count) }

if ($Step -eq 'check') {
    Say ''
    Say ('Πλάνο του apply (φράση: {0}):' -f $Phrase)
    Say ('  1. τα 13 sites, το καθένα με το δικό του update: {0}' -f (($Sites | ForEach-Object { $_.code.ToUpper() }) -join ', '))
    Say '     («Saved list» αντί για «Gear Cart», «Sold by … (not by Gear World)», «… delivers to», «Stock at …», το /about/ και η γραμμή του footer, σε 10 γλώσσες)'
    Say '     (L102: «<κατάστημα> delivers to» και στις κάρτες, το μπάνερ των Χριστουγέννων λέει «Gifts for everyone» και φαίνεται μόνο πάνω από πραγματικές προσφορές, χωρίς «Quantity»)'
    Say '     (L103: «Browse by category», «retailers compared», «compares prices across retailers», κωδικοί «through their affiliate programmes», το όνομα του καταστήματος translate="no" στο «View at» / «Stock at»)'
    Say '     (L105: η σελίδα προϊόντος των 7 νέων sites διαβάζει μόνο τις γραμμές της ομάδας μέσα από το idx_products_group_key, τα «Παρόμοια» διαβάζουν λιγότερα και στα 13, και το robots.txt κλείνει το SERankingBacklinksBot)'
    Say '     ΠΡΩΤΑ το ευρετήριο στις 7 βάσεις: tools/d1-native-index.ps1 με «ΕΓΚΡΙΝΩ ΕΥΡΕΤΗΡΙΑ D1». Χωρίς αυτό ο νέος κώδικας διαβάζει περίπου όσο ο παλιός.'
    Say '  2. έλεγχος ότι κάθε αρχική σελίδα δείχνει στο /saved/ και έχει τη νέα γραμμή στο footer, και ότι το /about/ λέει ποιος τρέχει το Gear World'
    Say '  Οι βάσεις των sites και οι ρυθμίσεις τους στον υπολογιστή δεν αλλάζουν.'
    Say ''
    if ($problems -gt 0) { Say 'Αποτέλεσμα: ΠΡΟΣΟΧΗ (δες τα παραπάνω). Δεν άλλαξε τίποτα.' 'Yellow'; Finish 2 }
    Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ (μόνο έλεγχος, δεν άλλαξε τίποτα)' 'Cyan'
    Finish 0
}

# ================= apply =================
if (-not $Apply) { Say ''; Say ('Χωρίς -Apply δεν αλλάζει τίποτα. Για την αλλαγή: -Step apply -Apply και η φράση {0}' -f $Phrase) 'Yellow'; Finish 0 }
if ($problems -gt 0) { Say 'Υπάρχουν προβλήματα (δες τα παραπάνω): ΔΕΝ αλλάζω τίποτα.' 'Magenta'; Finish 8 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
Say ''
Say 'Έγκριση: ΕΝΤΑΞΕΙ.' 'Cyan'

# 1. the 13 sites, one by one
$done = New-Object System.Collections.Generic.List[string]
foreach ($s in $Sites) {
    $tool = Join-Path $SiteToolDir ($s.tool + '.ps1')
    $exe = (Get-Process -Id $PID).Path
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $tool, '-Step', 'update', '-Apply', '-Approve', ('EGKRINO {0} UPDATE' -f $s.code.ToUpper()), '-OutDir', $OutDir, '-NoClipboard')
    Say ('1. {0}: ανεβαίνει...' -f $s.code.ToUpper())
    & $exe @a | Out-Null
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        Say ('   {0}: ΠΡΟΒΛΗΜΑ (κωδικός {1}). Σταμάτησα εδώ. Ανέβηκαν ήδη: {2}' -f $s.code.ToUpper(), $code, $(if ($done.Count) { $done -join ', ' } else { 'κανένα' })) 'Magenta'
        $rep = @(Get-ChildItem -LiteralPath $OutDir -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like ('*' + $s.code + '*') -or $_.Name -like ('*' + $s.code.ToUpper() + '*') -or $_.Name -like ($s.tool + '*') } | Sort-Object LastWriteTime | Select-Object -Last 1)
        if ($rep.Count -eq 1) { foreach ($line in @([System.IO.File]::ReadAllLines($rep[0].FullName) | Select-Object -Last 15)) { Say ('     ' + $line) } }
        Finish 12
    }
    $done.Add($s.code.ToUpper())
    Say ('   {0}: ΕΝΤΑΞΕΙ' -f $s.code.ToUpper()) 'Cyan'
}

# 2. every home page links to /saved/ and has the footer line, every /about/ says who runs Gear World
if (-not $NoHttpCheck) {
    Say ''
    $notYet = @()
    foreach ($s in $Sites) { if (-not (Test-Fixes $s.domain)) { $notYet += $s.domain } }
    if ($notYet.Count -gt 0) { Say ('2. Οι αλλαγές δεν φαίνονται ακόμα σε: {0} (η cache κρατάει έως λίγα λεπτά· στείλε στο Claude αυτή την αναφορά)' -f ($notYet -join ', ')) 'Yellow' }
    else { Say '2. Και τα 13 sites: «Saved list» στο /saved/, η γραμμή του footer, το /about/, οι λέξεις του L103 και το robots.txt του L105: ΕΝΤΑΞΕΙ' 'Cyan' }
}
Say ''
Say ('Ανέβηκαν: {0}' -f ($done -join ', '))
Say 'Αποτέλεσμα: ΕΤΟΙΜΟ' 'Cyan'
Finish 0
