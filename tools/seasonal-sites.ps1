<#
.SYNOPSIS
  Seasonal banners on the deals pages of the 10 Gear World sites (Halloween, Black Friday, Christmas).
  Read-only unless -Step apply -Apply and the typed approval phrase.

.DESCRIPTION
  What changes on each site (code of the shared engine, from this repo version):
    /discount-codes/ and /deals/   a banner at the top: the still picture and the text (season, end date, title,
                                   Black Friday countdown, "See the deals"), translated in the 11 languages
    assets/site.js                 the muted video loop, only after the page has loaded and only when the visitor can
                                   afford it (not with "reduce motion", Save-Data or a slow connection); Pause button
    Content-Security-Policy        media-src also allows https://gearworldhub.com (the videos come from the Hub:
                                   one copy for all 11, cached for a year, byte ranges for iPhone Safari)
  The calendar repeats every year by itself (src/lib/seasons.js). The databases, the products, the /out/ links, the
  Hub and the other Workers (gwh-sitemap too) do NOT change.

  -Step check  READ-ONLY. Which season runs today; the Hub serves the 3 videos with byte ranges; every site answers,
               and whether it already has the banner and the media-src rule.
  -Step apply  CHANGES THE 10 LIVE SITES, one approval: ΕΓΚΡΙΝΩ SEASONAL BANNERS. Each site with its own update step
               (its own checks, its own note with the live version for rollback, its own live test), in the order of
               the poster update (SGW first). It stops at the first problem; the sites already updated keep working.
               Then every site is checked: /deals/ answers, media-src is there, and in a season the banner is on it.
  Report: <home>\gear-world-reports\SEASONAL_SITES_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'apply')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$OutDir = '',
    [string]$SiteToolDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard,
    [switch]$NoHttpCheck
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ SEASONAL BANNERS'
$HubUrl = 'https://gearworldhub.com'
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $SiteToolDir) { $SiteToolDir = Join-Path $repo 'tools' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
# Colours without red and green (lessons L35): cyan = OK, yellow = attention, magenta = problem.
$Ok = 'Cyan'
$Warn = 'Yellow'
$Bad = 'Magenta'

# The 10 sites, in the order of the poster update (SGW first, then the other new sites, then the 6 older ones).
$Sites = @(
    @{ code = 'sgw'; tool = 'sgw-cloudflare'; domain = 'sportygearworld.com' },
    @{ code = 'tgw'; tool = 'tgw-cloudflare'; domain = 'technologygearworld.com' },
    @{ code = 'agw'; tool = 'agw-cloudflare'; domain = 'cargearworld.com' },
    @{ code = 'vgw'; tool = 'vgw-cloudflare'; domain = 'travelgearworld.com' },
    @{ code = 'cgw'; tool = 'cgw-engine'; domain = 'constructiongearworld.com' },
    @{ code = 'mgw'; tool = 'mgw-engine'; domain = 'mensgearworld.com' },
    @{ code = 'wgw'; tool = 'wgw-engine'; domain = 'womensgearworld.com' },
    @{ code = 'kgw'; tool = 'kgw-engine'; domain = 'kidsgearworld.com' },
    @{ code = 'hgw'; tool = 'hgw-engine'; domain = 'homegearworld.com' },
    @{ code = 'ggw'; tool = 'ggw-engine'; domain = 'gardengearworld.com' }
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
    $file = Join-Path $OutDir ('SEASONAL_SITES_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('SEASONAL_SITES_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
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

# Downloads a page or file like a browser: @{ status; text; headers }. status 0 = could not be read.
function Get-Web([string]$url, [switch]$FirstBytes) {
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.UserAgent = 'GearWorldQA-bot/1.0 (+read-only check)'
        $req.Accept = '*/*'
        $req.Timeout = 30000
        if ($FirstBytes) { $req.AddRange(0, 1) }
        $resp = $req.GetResponse()
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if (-not $resp) { return @{ status = 0; text = ''; headers = $null } }
    } catch {
        return @{ status = 0; text = ''; headers = $null }
    }
    try {
        $ms = New-Object System.IO.MemoryStream
        $resp.GetResponseStream().CopyTo($ms)
        $text = (New-Object System.Text.UTF8Encoding($false)).GetString($ms.ToArray())
        return @{ status = [int]$resp.StatusCode; text = $text; headers = $resp.Headers }
    } finally { $resp.Close() }
}

# Today's season, from the engine itself (src/lib/seasons.js), so this tool and the sites always agree.
function Get-Season {
    $lib = (Join-Path (Join-Path (Join-Path $repo 'src') 'lib') 'seasons.js').Replace('\', '/')
    $js = "import('file:///" + $lib.TrimStart('/') + "').then(m => { const s = m.seasonFor(); console.log(s ? s.id + ' ' + s.start + ' ' + s.end : 'none'); })"
    try { $out = @(& node --input-type=module -e $js 2>$null) } catch { $out = @() }
    $line = [string]($out | Select-Object -Last 1)
    if ($line -match '^(halloween|black-friday|christmas) (\d{4}-\d{2}-\d{2}) (\d{4}-\d{2}-\d{2})$') { return @{ id = $Matches[1]; start = $Matches[2]; end = $Matches[3] } }
    return $null
}

function Test-Sites([bool]$after, $season) {
    $problems = 0
    foreach ($s in $Sites) {
        $w = Get-Web ('https://{0}/deals/?gwcheck={1}' -f $s.domain, $stamp)
        $csp = $(if ($w.headers) { [string]$w.headers['Content-Security-Policy'] } else { '' })
        $media = ($csp -match "media-src 'self' https://gearworldhub\.com")
        $banner = ($w.text -match 'data-season="([a-z-]+)"')
        $which = $(if ($banner) { $Matches[1] } else { '' })
        if ($w.status -ne 200) { Say ('  {0}: /deals/ απαντά {1}: ΠΡΟΒΛΗΜΑ' -f $s.code.ToUpper(), $w.status) $Bad; $problems++; continue }
        $state = ('  {0}: /deals/ 200, βίντεο από το Hub (media-src): {1}, μπάνερ: {2}' -f $s.code.ToUpper(), $(if ($media) { 'ναι' } else { 'όχι ακόμα' }), $(if ($which) { $which } else { 'όχι' }))
        if ($after) {
            $good = $media -and ((-not $season) -or $which -eq $season.id)
            if ($good) { Say ($state + ': ΕΝΤΑΞΕΙ') $Ok } else { Say ($state + ': ΠΡΟΣΟΧΗ (cache; ξαναδές σε 5 λεπτά)') $Warn; $problems++ }
        } else { Say $state }
    }
    return $problems
}

# ---------------- start ----------------
Say ('SEASONAL BANNERS (10 sites) - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) $Ok
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
$missingTools = @($Sites | Where-Object { -not (Test-Path -LiteralPath (Join-Path $SiteToolDir ($_.tool + '.ps1'))) } | ForEach-Object { $_.tool })
if ($missingTools.Count) { Say ('Λείπουν εργαλεία: {0}. Στείλε στο Claude αυτό το μήνυμα.' -f ($missingTools -join ', ')) $Bad; Finish 2 }

$season = Get-Season
if ($season) { Say ('Εποχή σήμερα: {0} ({1} έως {2}): το μπάνερ φαίνεται από τη στιγμή που θα ανέβει.' -f $season.id, $season.start, $season.end) $Ok }
else { Say 'Εποχή σήμερα: καμία. Το μπάνερ θα φανεί μόνο του στην επόμενη εποχή (Halloween 20/10, Black Friday 7 μέρες πριν, Χριστούγεννα 2/12).' }

if (-not $NoHttpCheck) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $hubOk = $true
    foreach ($f in @('halloween', 'black-friday', 'christmas')) {
        $v = Get-Web ('{0}/seasonal/{1}.mp4?v=29bd24c' -f $HubUrl, $f) -FirstBytes
        if ($v.status -ne 206) { $hubOk = $false; Say ('  Hub: {0}.mp4 απαντά {1} αντί για 206: ΠΡΟΒΛΗΜΑ' -f $f, $v.status) $Bad }
    }
    if ($hubOk) { Say 'Hub: τα 3 βίντεο απαντούν σε κομμάτια (206, για iPhone): ΕΝΤΑΞΕΙ' $Ok }
    else { Say 'Το Hub δεν δίνει σωστά τα βίντεο: ΔΕΝ αλλάζω τίποτα. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 6 }
    Say 'Τα 10 sites τώρα:'
    [void](Test-Sites $false $season)
}

Say ''
Say ('Τι θα γίνει με -Step apply -Apply και τη φράση {0}:' -f $Phrase)
Say '  Τα 10 sites, ένα-ένα (πρώτα το SGW), το καθένα με το δικό του βήμα update: ελέγχει, κρατά τη ζωντανή του έκδοση'
Say '  για επαναφορά, ανεβαίνει και δοκιμάζεται. Στο πρώτο πρόβλημα σταματώ: όσα ανέβηκαν δουλεύουν κανονικά.'
Say '  Αλλάζει: το μπάνερ στις σελίδες /discount-codes/ και /deals/, το site.js (το βίντεο, η Παύση, η αντίστροφη μέτρηση),'
Say '  οι μεταφράσεις (11 γλώσσες) και ο κανόνας media-src για τα βίντεο του Hub.'
Say '  ΔΕΝ αλλάζουν: οι βάσεις, τα προϊόντα, τα links /out/, το Hub και οι άλλοι Workers (και ο gwh-sitemap).'
Say '  Επαναφορά (μόνο με έγκριση): κάθε site γράφει τη δική του σημείωση με τη ζωντανή έκδοση (npx wrangler rollback ...),'
Say '  ή στο Cloudflare: https://dash.cloudflare.com/?to=/:account/workers-and-pages > Worker > Deployments > Rollback.'
Say '  Διάρκεια: περίπου 20-30 λεπτά.'

if ($Step -eq 'check') { Say ''; Say 'Αποτέλεσμα: μόνο έλεγχος, δεν άλλαξε τίποτα.' $Ok; Finish 0 }

# ---------------- apply ----------------
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' $Warn; Finish 1 }

$psExe = (Get-Process -Id $PID).Path
$done = @()
foreach ($s in $Sites) {
    Say ''
    Say ('{0}: ενημέρωση με το {1}.ps1 -Step update ...' -f $s.code.ToUpper(), $s.tool) $Ok
    $tool = Join-Path $SiteToolDir ($s.tool + '.ps1')
    $started = Get-Date
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $tool, '-Step', 'update', '-Apply', '-Approve', ('EGKRINO {0} UPDATE' -f $s.code.ToUpper()), '-OutDir', $OutDir, '-NoClipboard')
    if ($SkipInstall) { $a += '-SkipInstall' }
    if ($NoHttpCheck) { $a += '-NoHttpCheck' }
    & $psExe @a
    $code = $LASTEXITCODE
    $rep = @(Get-ChildItem -LiteralPath $OutDir -Filter '*.txt' -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $started.AddSeconds(-2) -and $_.Name -notlike 'SEASONAL_SITES_*' } | Sort-Object LastWriteTime | Select-Object -Last 1)
    if ($rep.Count -eq 1) {
        foreach ($line in @([System.IO.File]::ReadAllLines($rep[0].FullName) | Select-Object -Last 4)) { $L.Add('     ' + $line) }
    }
    if ($code -ne 0) {
        Say ('   {0}: ΠΡΟΒΛΗΜΑ - το update σταμάτησε (κωδικός {1}). Σταματώ εδώ: τα επόμενα sites ΔΕΝ άλλαξαν.' -f $s.code.ToUpper(), $code) $Bad
        Say ('   Ανέβηκαν ήδη: {0}. Δουλεύουν κανονικά (η επαναφορά τους είναι στη σημείωση του καθενός).' -f $(if ($done.Count) { $done -join ', ' } else { '(κανένα)' }))
        Finish 12
    }
    $done += $s.code.ToUpper()
    Say ('   {0}: ΕΝΤΑΞΕΙ' -f $s.code.ToUpper()) $Ok
}

Say ''
if (-not $NoHttpCheck) {
    Start-Sleep -Seconds 10
    Say 'Έλεγχος των 10 sites μετά το update:'
    $p = Test-Sites $true $season
    if ($p -gt 0) { Say ('Αποτέλεσμα: ανέβηκαν και τα 10, αλλά {0} δεν δείχνουν ακόμα το μπάνερ (cache έως 5 λεπτά). Ξανατρέξε το -Step check σε λίγο.' -f $p) $Warn; Finish 0 }
}
Say 'ΕΤΟΙΜΟ: τα 10 sites έχουν το εποχικό μπάνερ στις σελίδες των προσφορών.' $Ok
Finish 0
