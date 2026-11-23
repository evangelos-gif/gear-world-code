<#
.SYNOPSIS
  Mega Stores Gear World (megastoresgearworld.com, code OGW) - test address, live site, remove the test address.

.DESCRIPTION
  Gift guides that link to amazon.co.uk and to the Gear World sites. No database, no cookies, no secrets. It does not
  touch the other sites, the Hub, the Group page or any database.

  -Step check           READ-ONLY. Cloudflare login, the live Worker "mega-stores-gear-world" (if any), the test
                        Worker, and what megastoresgearworld.com answers.
  -Step preview         CHANGES CLOUDFLARE (a test Worker only), one approval: ΕΓΚΡΙΝΩ OGW PREVIEW. The test Worker
                        "mega-stores-gear-world-preview" on its *.workers.dev address gets this version: noindex, and
                        the Amazon buttons link WITHOUT the Associates ID (the test address is not in the Associates
                        account). The report ends with ΕΤΟΙΜΟ when every page answered.
  -Step live            CHANGES THE LIVE SITE, one approval: ΕΓΚΡΙΝΩ OGW LIVE. Publishes the Worker
                        "mega-stores-gear-world" on megastoresgearworld.com and www (Cloudflare Custom Domains; the
                        first time Cloudflare makes the DNS records and the certificate itself). Then, only if the
                        Amazon links are not live yet, a second question: ΕΓΚΡΙΝΩ OGW AMAZON LINKS = the owner has
                        added megastoresgearworld.com to his Amazon Associates account (gearworld04-21); with it the
                        Amazon buttons carry the Associates ID (AMAZON_LINKS=on), with Enter the site goes live
                        without Amazon buttons (only the Gear World buttons) and the phrase can be given at the next
                        live step. Once live, Amazon links stay on at later updates (the tool reads the live home
                        page; if it does not answer, nothing is deployed, exit 6). -AmazonOff: deploy without Amazon
                        links (for example if the Associates account is closed).
                        -AfterPreview: goes on only when the newest preview report is of this code version, from the
                        last 2 hours, ended ΕΤΟΙΜΟ and has no ΠΡΟΒΛΗΜΑ (one paste: preview, live, remove-preview).
                        An update of a live site first checks that this version contains the live one (L156).
  -Step remove-preview  CHANGES CLOUDFLARE (the test Worker only), one approval: ΕΓΚΡΙΝΩ OGW REMOVE PREVIEW. Deletes
                        "mega-stores-gear-world-preview" (owner, 29 Oct 2026: no test Worker left running).

  Phrases of the first launch, in this order (one paste): ΕΓΚΡΙΝΩ OGW PREVIEW, ΕΓΚΡΙΝΩ OGW LIVE,
  ΕΓΚΡΙΝΩ OGW AMAZON LINKS (or Enter), ΕΓΚΡΙΝΩ OGW REMOVE PREVIEW.
  Rollback: a later update goes back with "npx wrangler rollback <version> --name mega-stores-gear-world" (the report
  names the version); the first launch is undone with "npx wrangler delete --name mega-stores-gear-world".
  Without -Apply, every step only shows what it WOULD do.
  Every preview and live check also reads (L195): the Greek home page (/?lang=el), the Hub link, and until Cyber
  Monday the Black Friday block (countdown, a store that started, a code linking to a Gear World /discount-codes/ page,
  Amazon's own Black Friday page with the Associates ID only with Amazon links on).
  Exit codes: 0 done, 1 no approval, 3 Node.js or npm, 4 Cloudflare login, 6 the live site did not answer before an
  update, 9 the deploy failed, 11 Cloudflare did not say whether the live Worker exists, 12 wrong test Worker name,
  13 this version lacks the live one (L156), 23 -AfterPreview without a clean preview report of this version.
  Report: <home>\gear-world-reports\OGW_SITE_<STEP>_<time>.txt (also copied to the clipboard)
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
    [switch]$NoHttpCheck,
    [switch]$AfterPreview,
    [switch]$AmazonOff,
    [string]$Chat = '1 · Gear World Manager' # the chat that gave the command, named in the clipboard line (L116, L208)
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
# Lessons L156: the live-version guard (refuses a version that lacks the live one) and the version every deploy writes.
. (Join-Path (Join-Path (Join-Path $repo 'tools') 'lib') 'live-guard.ps1')
$GwVersionVar = Get-GwVersionVar $repo
$WorkerName = 'mega-stores-gear-world'
$PreviewName = 'mega-stores-gear-world-preview'
$Domain = 'megastoresgearworld.com'
$AmazonTag = 'gearworld04-21'
$PhrasePreview = 'ΕΓΚΡΙΝΩ OGW PREVIEW'
$PhraseLive = 'ΕΓΚΡΙΝΩ OGW LIVE'
$PhraseAmazon = 'ΕΓΚΡΙΝΩ OGW AMAZON LINKS'
$PhraseRemovePreview = 'ΕΓΚΡΙΝΩ OGW REMOVE PREVIEW'
$Ok = 'Green'; $Warn = 'Yellow'; $Bad = 'Magenta'
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'mega-stores-gear-world' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$DashLink = 'https://dash.cloudflare.com/?to=/:account/workers/services/view/mega-stores-gear-world/production/deployments'
$DnsLink = 'https://dash.cloudflare.com/?to=/:account/:zone/dns/records'
$AssociatesLink = 'https://affiliate-program.amazon.co.uk/'
$UserAgent = 'GearWorldQA-bot/1.0 (+read-only check)'
# L195: the Black Friday block of the home page shows until the end of Cyber Monday (UK day); the check reads it until then.
$BlackFridayEnd = '2026-11-30'

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('OGW_SITE_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $text = $L -join "`r`n"
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host ('Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «{0}» και πάτα Ctrl+V.' -f $Chat) -ForegroundColor $Ok }
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

# -Approve may hold several phrases separated by ";" (tests); otherwise the owner types the phrase.
function Confirm-Approval([string]$phrase, [string]$enterNote = '(ή πάτα Enter για να σταματήσω χωρίς αλλαγές)') {
    $given = @()
    if ($Approve) { $given = @($Approve -split ';') }
    else {
        Write-Host ''
        Write-Host ('Για να συνεχίσω, γράψε ακριβώς: {0}' -f $phrase) -ForegroundColor $Warn
        Write-Host $enterNote
        # Lines left over from the paste (an empty last line) would answer the prompt by themselves (8 Nov 2026).
        try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
        $given = @(Read-Host 'Έγκριση')
    }
    foreach ($g in $given) { if ((Normalize-Phrase $g) -eq (Normalize-Phrase $phrase)) { return $true } }
    return $false
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
# -Retry: on a network error or a passing Cloudflare error, try again, up to 3 times (only for calls safe to repeat).
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$NonInteractive, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tmp = [System.IO.Path]::GetTempPath()
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder))
    if ($NonInteractive) { $lines += 'set CI=true' }
    $lines += 'set WRANGLER_SEND_METRICS=false'
    $lines += 'set FORCE_COLOR=0'
    $lines += 'set NO_COLOR=1'
    $lines += ('call npx --yes wrangler {0} 2>&1' -f $Arguments)
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path $tmp ('gw-wrangler-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
        [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        }
        $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
        $result = @{ code = $code; text = $text }
        $network = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|code: 7403|code: 10000'
        if ($code -eq 0 -or -not $network -or $try -eq $tries) { break }
        Say ('Προσωρινό πρόβλημα με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/{2})...' -f (5 * $try), ($try + 1), $tries) $Warn
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

# The version that is live now (for the rollback line): @{ known; ver }. ver '' with known = the Worker does not exist
# yet (first launch); known = $false = Cloudflare gave another answer, so nobody can tell (the live step stops, exit 11).
function Get-WorkerState([string]$folder, [string]$name) {
    $r = Invoke-Wrangler $folder ('deployments list --name {0}' -f $name) -NonInteractive -Retry
    $ms = [regex]::Matches($r.text, '\(100%\)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($ms.Count -gt 0) { return @{ known = $true; ver = $ms[$ms.Count - 1].Groups[1].Value; text = '' } }
    if ($r.text -match '(?i)no deployments|does not exist|10007') { return @{ known = $true; ver = ''; text = '' } }
    return @{ known = $false; ver = ''; text = $r.text }
}

function Prepare-Deploy {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        foreach ($item in @('src', 'sites', 'promos', 'package.json', 'package-lock.json')) {
            Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Recurse -Force
        }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-npm-ci.cmd'
        $body = "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n"
        [System.IO.File]::WriteAllText($cmdFile, $body, [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
    }
    return $dest
}

# The real wrangler.jsonc from the template: the test Worker (its own name, workers.dev on) or the live Worker (the
# two custom domains). The template has no database and no secrets.
function Write-Config([string]$folder, [bool]$preview) {
    $text = [System.IO.File]::ReadAllText((Join-Path $folder 'wrangler.jsonc.example'))
    $nameLine = ('"name": "{0}",' -f $WorkerName)
    $devLine = '"workers_dev": false,'
    $obs = '"observability": { "enabled": true }'
    if ($text.IndexOf($nameLine) -lt 0 -or $text.IndexOf($devLine) -lt 0 -or $text.IndexOf($obs) -lt 0) { Say 'Το πρότυπο wrangler.jsonc.example δεν έχει τη μορφή που περίμενα. Δεν άλλαξε τίποτα.' $Bad; Finish 9 }
    if ($preview) {
        $text = $text.Replace($nameLine, ('"name": "{0}",' -f $PreviewName)).Replace($devLine, '"workers_dev": true,')
        $file = Join-Path $folder 'wrangler.preview.jsonc'
    } else {
        $routes = $obs + ',' + "`r`n" + '  "routes": [' + "`r`n" +
            ('    {{ "pattern": "{0}", "custom_domain": true }},' -f $Domain) + "`r`n" +
            ('    {{ "pattern": "www.{0}", "custom_domain": true }}' -f $Domain) + "`r`n" + '  ]'
        $text = $text.Replace($obs, $routes)
        $file = Join-Path $folder 'wrangler.jsonc'
    }
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($false)))
    Copy-Item -LiteralPath $file -Destination (Join-Path $WorkDir (Split-Path -Leaf $file)) -Force
    return $file
}

# One GET (no redirects followed): @{ status; text; location; robots } (status 0 = no answer). $country: the visitor's
# country the QA check asks for (the UK unless a check names another, L210).
function Get-Page([string]$url, [string]$country = 'GB') {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Method = 'GET'
        $req.UserAgent = $UserAgent
        # The view of a UK visitor (the Worker honours it only for the network's QA check), so every run reads the same.
        $req.Headers.Add('X-GW-QA-Country', $country)
        $req.AllowAutoRedirect = $false
        $req.Timeout = 20000
        $resp = $req.GetResponse()
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if (-not $resp) { return @{ status = 0; text = ''; location = ''; robots = '' } }
    } catch {
        return @{ status = 0; text = ''; location = ''; robots = '' }
    }
    try {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream(), [System.Text.Encoding]::UTF8)
        $text = $reader.ReadToEnd()
        $reader.Close()
        return @{ status = [int]$resp.StatusCode; text = $text; location = [string]$resp.Headers['Location']; robots = [string]$resp.Headers['X-Robots-Tag'] }
    } finally { $resp.Close() }
}

# Is the Amazon statement live on the site (AMAZON_LINKS=on)? Read-only: the home page footer says it only then.
function Test-LiveAmazon {
    $p = Get-Page ('https://{0}/' -f $Domain)
    return ($p.status -eq 200 -and $p.text.Contains('As an Amazon Associate I earn from qualifying purchases.'))
}

# The pages of a deployed address: home, one guide, the Black Friday checks, privacy, robots.txt. $mode: on, off or
# preview. Every line that fails says ΠΡΟΒΛΗΜΑ (-AfterPreview reads it).
function Test-Site([string]$base, [string]$mode) {
    $all = $true
    $guide = 'christmas-gift-ideas-for-him'
    foreach ($path in @('/', ('/guides/{0}/' -f $guide), '/guides/black-friday-checks-before-you-choose/', '/privacy/', '/how-we-make-money/')) {
        $p = Get-Page ($base + $path)
        if ($p.status -eq 200) { Say ('  {0} απαντά 200: ΕΝΤΑΞΕΙ' -f $path) $Ok }
        else { Say ('  {0} απαντά {1}: ΠΡΟΒΛΗΜΑ' -f $path, $p.status) $Bad; $all = $false }
        if ($path -eq ('/guides/{0}/' -f $guide) -and $p.status -eq 200) {
            $tagged = $p.text.Contains('tag=' + $AmazonTag)
            $amazon = $p.text.Contains('https://www.amazon.co.uk/s?k=')
            $gw = $p.text.Contains('https://mensgearworld.com/category/')
            if ($mode -eq 'on' -and -not ($amazon -and $tagged)) { Say '  Κουμπιά Amazon με το Associates ID: λείπουν: ΠΡΟΒΛΗΜΑ' $Bad; $all = $false }
            elseif ($mode -eq 'on') { Say ('  Κουμπιά Amazon με το Associates ID {0}: ΕΝΤΑΞΕΙ' -f $AmazonTag) $Ok }
            if ($mode -eq 'preview' -and ($tagged -or -not $amazon)) { Say '  Δοκιμαστική διεύθυνση: τα κουμπιά Amazon πρέπει να είναι ΧΩΡΙΣ Associates ID: ΠΡΟΒΛΗΜΑ' $Bad; $all = $false }
            elseif ($mode -eq 'preview') { Say '  Κουμπιά Amazon χωρίς Associates ID (δοκιμαστική διεύθυνση): ΕΝΤΑΞΕΙ' $Ok }
            if ($mode -eq 'off' -and $amazon) { Say '  Κουμπιά Amazon χωρίς την έγκρισή σου: ΠΡΟΒΛΗΜΑ' $Bad; $all = $false }
            elseif ($mode -eq 'off') { Say '  Χωρίς κουμπιά Amazon (δεν δόθηκε η φράση Amazon): ΕΝΤΑΞΕΙ' $Ok }
            if (-not $gw) { Say '  Κουμπιά προς τα Gear World sites: λείπουν: ΠΡΟΒΛΗΜΑ' $Bad; $all = $false }
            else { Say '  Κουμπιά προς τις κατηγορίες των Gear World sites: ΕΝΤΑΞΕΙ' $Ok }
        }
    }
    # L191: the Joybuy store page (product photos read live from the Gear World sites) and the Amazon page. A new
    # version reads the sites the first time, so up to 3 tries, 20 seconds apart. Read-only (GET), never /out/ or /go/.
    $sp = $null
    for ($i = 1; $i -le 3; $i++) {
        $sp = Get-Page ($base + '/stores/joybuy/')
        if ($sp.status -eq 200 -and $sp.text.Contains('<li class="pcard">')) { break }
        if ($i -lt 3) { Start-Sleep -Seconds 20 }
    }
    if ($sp.status -ne 200) { Say ('  /stores/joybuy/ απαντά {0}: ΠΡΟΒΛΗΜΑ' -f $sp.status) $Bad; $all = $false }
    else {
        $cards = [regex]::Matches($sp.text, '<li class="pcard">').Count
        $photo = $sp.text -match '<a class="pcard-photo" href="https://[a-z]+gearworld\.com/product/[^"]+"[^>]*><img src="https://'
        $outLink = $sp.text -match 'href="[^"]*/(out|go)/'
        # The retailers' own code lines ("£10 off when you spend £59", L186, L195) are the only text with £.
        $pound = ([regex]::Replace($sp.text, '<p class="promo-offer">[\s\S]*?</p>', '')).Contains([string][char]0x00A3)
        if ($cards -ge 1 -and $photo -and -not $outLink -and -not $pound) { Say ('  /stores/joybuy/: {0} προϊόντα με φωτογραφία και link στη σελίδα τους στο Gear World, χωρίς τιμές, χωρίς /out/ και /go/: ΕΝΤΑΞΕΙ' -f $cards) $Ok }
        else {
            $why = @()
            if ($cards -lt 1) { $why += 'κανένα προϊόν' }
            elseif (-not $photo) { $why += 'προϊόν χωρίς φωτογραφία ή χωρίς σελίδα Gear World' }
            if ($outLink) { $why += 'link /out/ ή /go/' }
            if ($pound) { $why += 'τιμή σε £' }
            Say ('  /stores/joybuy/: {0}: ΠΡΟΒΛΗΜΑ' -f ($why -join ', ')) $Bad; $all = $false
        }
    }
    # L195 (owner, 18 Nov 2026): every language, the Hub link and Black Friday. Read-only GETs, never /out/ or /go/.
    $hp = Get-Page ($base + '/')
    if ($hp.status -ne 200) { Say ('  Αρχική σελίδα απαντά {0}: ΠΡΟΒΛΗΜΑ' -f $hp.status) $Bad; $all = $false }
    else {
        if ($hp.text.Contains('class="hub-link" href="https://gearworldhub.com/')) { Say '  Link προς το Gear World Hub στην αρχική: ΕΝΤΑΞΕΙ' $Ok }
        else { Say '  Link προς το Gear World Hub στην αρχική: λείπει: ΠΡΟΒΛΗΜΑ' $Bad; $all = $false }
        $ukToday = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
        try { $ukToday = [System.TimeZoneInfo]::ConvertTimeFromUtc((Get-Date).ToUniversalTime(), [System.TimeZoneInfo]::FindSystemTimeZoneById('GMT Standard Time')).ToString('yyyy-MM-dd') } catch { }
        if ($ukToday -le $BlackFridayEnd) {
            $i = $hp.text.IndexOf('id="black-friday"')
            $block = ''
            if ($i -ge 0) { $block = $hp.text.Substring($i) }
            $count = $block.Contains('class="bf-count"')
            $store = $block.Contains('<li class="bf-store"')
            $code = $block -match 'href="https://[a-z]+gearworld\.com/discount-codes/[a-z0-9-]+/"'
            $out = $block -match 'href="[^"]*/(out|go)/'
            if ($count -and $store -and $code -and -not $out) { Say '  Black Friday στην αρχική: αντίστροφη μέτρηση, καταστήματα που ξεκίνησαν και κωδικοί με link σε σελίδα Gear World: ΕΝΤΑΞΕΙ' $Ok }
            else {
                $why = @()
                if ($i -lt 0) { $why += 'δεν υπάρχει το μπλοκ' }
                elseif (-not $count) { $why += 'λείπει η αντίστροφη μέτρηση' }
                if ($i -ge 0 -and -not $store) { $why += 'κανένα κατάστημα που ξεκίνησε' }
                if ($i -ge 0 -and -not $code) { $why += 'κανένας κωδικός με link σε /discount-codes/' }
                if ($out) { $why += 'link /out/ ή /go/' }
                Say ('  Black Friday στην αρχική: {0}: ΠΡΟΒΛΗΜΑ' -f ($why -join ', ')) $Bad; $all = $false
            }
            $bfTagged = $hp.text.Contains('https://www.amazon.co.uk/blackfriday?tag=' + $AmazonTag)
            $bfPlain = $hp.text.Contains('href="https://www.amazon.co.uk/blackfriday"')
            if ($mode -eq 'on') {
                if ($bfTagged) { Say ('  Κουμπί «Black Friday on Amazon» με το Associates ID {0}: ΕΝΤΑΞΕΙ' -f $AmazonTag) $Ok }
                else { Say '  Κουμπί «Black Friday on Amazon» με το Associates ID: λείπει: ΠΡΟΒΛΗΜΑ' $Bad; $all = $false }
            } elseif ($mode -eq 'preview') {
                if ($bfPlain -and -not $bfTagged) { Say '  Κουμπί «Black Friday on Amazon» χωρίς Associates ID (δοκιμαστική διεύθυνση): ΕΝΤΑΞΕΙ' $Ok }
                else { Say '  Κουμπί «Black Friday on Amazon» της δοκιμαστικής διεύθυνσης: ΠΡΟΒΛΗΜΑ' $Bad; $all = $false }
            } else {
                if (-not ($bfTagged -or $bfPlain)) { Say '  Χωρίς κουμπί Amazon στη Black Friday (δεν δόθηκε η φράση Amazon): ΕΝΤΑΞΕΙ' $Ok }
                else { Say '  Κουμπί Amazon στη Black Friday χωρίς την έγκρισή σου: ΠΡΟΒΛΗΜΑ' $Bad; $all = $false }
            }
        } else { Say ('  Black Friday: τελείωσε στις {0}, το μπλοκ δεν φαίνεται πια: ΕΝΤΑΞΕΙ' -f $BlackFridayEnd) $Ok }
    }
    # L210 (owner, 21 Nov 2026): a visitor from Greece sees the Greek stores and no UK store, code or Amazon UK; a visitor
    # from a country with no store (the US) sees the line that says so.
    $ukStore = 'href="/stores/(joybuy|tooled-up|my-tool-shed|pchub-uk|gs-workwear|back-to-the-office|dhgate|amazon)/"'
    $gr = Get-Page ($base + '/') 'GR'
    $grUk = $gr.text.Contains('class="bf-started"') -or $gr.text.Contains('class="promo-card"') -or ($gr.text -match $ukStore) -or ($gr.text -match '(?i)amazon')
    # L215 (owner, 22 Nov 2026: "we will declare it but we will hide it"): Linkwise approved megastoresgearworld.com on
    # 23 Nov 2026, so hiddenNetworks is empty again: from Greece the 7 Greek stores of Linkwise (L210), and their store page.
    $grStores = @('kouzinika-gr', 'katoikein-gr', 'minipini-gr', 'xxxl-leo-gr', 'casualshoes-gr', 'parex-gr', 'tsakiris-mallas-gr')
    $grMissing = @($grStores | Where-Object { -not $gr.text.Contains('href="/stores/' + $_ + '/"') })
    if ($gr.status -eq 200 -and $grMissing.Count -eq 0 -and -not $gr.text.Contains('stores-none') -and -not $grUk) { Say '  Από Ελλάδα: τα 7 ελληνικά καταστήματα της Linkwise (L210, L215), κανένα κατάστημα, κωδικός ή Amazon του UK: ΕΝΤΑΞΕΙ' $Ok }
    else { Say ('  Από Ελλάδα ({0}): λείπουν ελληνικά καταστήματα ({1}) ή φαίνονται καταστήματα, κωδικοί ή Amazon του UK ({2}) (L215): ΠΡΟΒΛΗΜΑ' -f $gr.status, ($grMissing -join ', '), $grUk) $Bad; $all = $false }
    $lw = Get-Page ($base + '/stores/kouzinika-gr/') 'GR'
    if ($lw.status -eq 200 -and $lw.text.Contains('Kouzinika GR') -and -not $lw.text.Contains('store-elsewhere')) { Say '  /stores/kouzinika-gr/ από Ελλάδα (L215): ΕΝΤΑΞΕΙ - η σελίδα του καταστήματος υπάρχει ξανά' $Ok }
    else { Say ('  /stores/kouzinika-gr/ από Ελλάδα απαντά {0} (L215): ΠΡΟΒΛΗΜΑ' -f $lw.status) $Bad; $all = $false }
    $us = Get-Page ($base + '/') 'US'
    $usAny = $us.text.Contains('class="bf-started"') -or $us.text.Contains('class="promo-card"') -or $us.text.Contains('href="/stores/') -or ($us.text -match '(?i)amazon')
    if ($us.status -eq 200 -and $us.text.Contains('stores-none') -and -not $usAny) { Say '  Από ΗΠΑ: κανένα κατάστημα, με τη γραμμή «δεν εμφανίζεται ακόμα για τη χώρα σας»: ΕΝΤΑΞΕΙ' $Ok }
    else { Say ('  Από ΗΠΑ ({0}): φαίνονται καταστήματα, κωδικοί ή Amazon: ΠΡΟΒΛΗΜΑ' -f $us.status) $Bad; $all = $false }
    # L211: a store page where the store is not listed (Joybuy from Greece) is never in a search engine (noindex).
    $ge = Get-Page ($base + '/stores/joybuy/') 'GR'
    if ($ge.status -eq 200 -and $ge.text.Contains('store-elsewhere') -and $ge.text.Contains('<meta name="robots" content="noindex">')) { Say '  Joybuy από Ελλάδα: «δεν εμφανίζεται για τη χώρα σας», με noindex (L211): ΕΝΤΑΞΕΙ' $Ok }
    else { Say ('  Joybuy από Ελλάδα ({0}): λείπει η γραμμή ή το noindex (L211): ΠΡΟΒΛΗΜΑ' -f $ge.status) $Bad; $all = $false }
    # L218: the row of the Gear World app (Google Play badge) on the home page for a visitor from the UK (a country of the
    # app), not from Germany. Its link is never opened.
    $appGbPage = Get-Page ($base + '/') 'GB'
    $appDePage = Get-Page ($base + '/') 'DE'
    $appGb = $appGbPage.text.Contains('class="app-bar"')
    $appDe = $appDePage.text.Contains('class="app-bar"')
    if ($appGbPage.status -eq 200 -and $appDePage.status -eq 200 -and $appGb -and -not $appDe) { Say '  Γραμμή «Gear World app» με το κουμπί Google Play (L218): ΕΝΤΑΞΕΙ - UK ναι, Γερμανία όχι' $Ok }
    else { Say ('  Γραμμή «Gear World app» (L218): ΠΡΟΒΛΗΜΑ - UK: {0} (απάντηση {1}), Γερμανία: {2} (απάντηση {3})' -f $appGb, $appGbPage.status, $appDe, $appDePage.status) $Bad; $all = $false }
    # L214 (owner, 21 Nov 2026): Mega Stores for Greece at its own address, the page Google shows in Greece. Greek for every
    # visitor (this check asks as a UK one), the 7 Greek stores, no UK store, code or Amazon, its own canonical and the
    # hreflang next to the UK page; a Greek store page in Greek, indexed, with its own canonical; /gr/ in the sitemap.
    $edUkStore = '/stores/(joybuy|tooled-up|my-tool-shed|pchub-uk|gs-workwear|back-to-the-office|dhgate|amazon)/'
    $ed = Get-Page ($base + '/gr/')
    $edUk = ($ed.text -match $edUkStore) -or ($ed.text -match '(?i)amazon\.co\.uk|>Amazon<') -or $ed.text.Contains('class="promo-card"')
    $edOk = ($ed.status -eq 200 -and $ed.text.Contains('<html lang="el-GR">') -and $ed.text.Contains('<link rel="canonical" href="https://' + $Domain + '/gr/">') -and $ed.text.Contains('<link rel="alternate" hreflang="el-GR" href="https://' + $Domain + '/gr/">') -and $ed.text.Contains('<link rel="alternate" hreflang="en-GB" href="https://' + $Domain + '/">') -and $ed.text.Contains('href="/gr/stores/kouzinika-gr/"') -and $ed.text.Contains('href="/gr/stores/tsakiris-mallas-gr/"') -and -not $ed.text.Contains('name="robots"') -and -not $edUk -and $ed.text.Contains('class="app-bar"'))
    if ($edOk) { Say '  /gr/ (Mega Stores για την Ελλάδα, L214): ΕΝΤΑΞΕΙ - στα Ελληνικά και για επισκέπτη από το UK, με τη γραμμή της εφαρμογής, τα ελληνικά καταστήματα, κανένα του UK ή Amazon, δικό του canonical και hreflang' $Ok }
    else { Say ('  /gr/ (Mega Stores για την Ελλάδα, L214): ΠΡΟΒΛΗΜΑ - απάντηση {0}, κατάστημα, κωδικός ή Amazon του UK: {1}' -f $ed.status, $edUk) $Bad; $all = $false }
    $es = Get-Page ($base + '/gr/stores/kouzinika-gr/')
    $esOk = ($es.status -eq 200 -and $es.text.Contains('<html lang="el-GR">') -and $es.text.Contains('<link rel="canonical" href="https://' + $Domain + '/gr/stores/kouzinika-gr/">') -and -not $es.text.Contains('name="robots"') -and -not ($es.text -match '(?i)amazon\.co\.uk|>Amazon<'))
    $esCards = ([regex]::Matches($es.text, '<li class="pcard">')).Count
    if ($esOk -and $esCards -gt 0) { Say ('  /gr/stores/kouzinika-gr/ (L214): ΕΝΤΑΞΕΙ - στα Ελληνικά, μπαίνει στη Google, {0} προϊόντα με φωτογραφία' -f $esCards) $Ok }
    elseif ($esOk) { Say '  /gr/stores/kouzinika-gr/ (L214): ΠΡΟΣΟΧΗ - η σελίδα είναι σωστή, αλλά τα προϊόντα δεν φορτώθηκαν αυτή τη στιγμή (φορτώνονται ξανά σε επόμενη επίσκεψη)' $Warn }
    else { Say ('  /gr/stores/kouzinika-gr/ (L214): ΠΡΟΒΛΗΜΑ - απάντηση {0}' -f $es.status) $Bad; $all = $false }
    $edSm = Get-Page ($base + '/sitemap.xml')
    if ($edSm.status -eq 200 -and $edSm.text.Contains('<loc>https://' + $Domain + '/gr/</loc>') -and $edSm.text.Contains('<loc>https://' + $Domain + '/gr/stores/kouzinika-gr/</loc>')) { Say '  sitemap.xml με το /gr/ και τις σελίδες των ελληνικών καταστημάτων (L214): ΕΝΤΑΞΕΙ' $Ok }
    else { Say ('  sitemap.xml χωρίς το /gr/ (L214, απάντηση {0}): ΠΡΟΒΛΗΜΑ' -f $edSm.status) $Bad; $all = $false }
    $el = Get-Page ($base + '/?lang=el')
    if ($el.status -eq 200 -and $el.text.Contains('<html lang="el-GR"') -and $el.text.Contains('Οδηγοί δώρων')) { Say '  /?lang=el απαντά στα Ελληνικά (Οδηγοί δώρων): ΕΝΤΑΞΕΙ' $Ok }
    else { Say ('  /?lang=el δεν απαντά στα Ελληνικά ({0}): ΠΡΟΒΛΗΜΑ' -f $el.status) $Bad; $all = $false }
    $ap = Get-Page ($base + '/stores/amazon/')
    if ($mode -eq 'on') {
        if ($ap.status -eq 200 -and $ap.text.Contains('tag=' + $AmazonTag)) { Say ('  /stores/amazon/ με το Associates ID {0}: ΕΝΤΑΞΕΙ' -f $AmazonTag) $Ok }
        else { Say ('  /stores/amazon/ ({0}) χωρίς το Associates ID: ΠΡΟΒΛΗΜΑ' -f $ap.status) $Bad; $all = $false }
    } elseif ($mode -eq 'preview') {
        if ($ap.status -eq 200 -and $ap.text.Contains('https://www.amazon.co.uk/s?k=') -and -not $ap.text.Contains('tag=')) { Say '  /stores/amazon/ χωρίς Associates ID (δοκιμαστική διεύθυνση): ΕΝΤΑΞΕΙ' $Ok }
        else { Say ('  /stores/amazon/ της δοκιμαστικής διεύθυνσης ({0}): ΠΡΟΒΛΗΜΑ' -f $ap.status) $Bad; $all = $false }
    } else {
        if ($ap.status -eq 404) { Say '  /stores/amazon/ δεν υπάρχει χωρίς τη φράση Amazon (404): ΕΝΤΑΞΕΙ' $Ok }
        else { Say ('  /stores/amazon/ απαντά {0} χωρίς τη φράση Amazon: ΠΡΟΒΛΗΜΑ' -f $ap.status) $Bad; $all = $false }
    }
    $r = Get-Page ($base + '/robots.txt')
    if ($mode -eq 'preview') {
        if ($r.status -eq 200 -and $r.text.Contains('Disallow: /')) { Say '  robots.txt: η δοκιμαστική διεύθυνση δεν μπαίνει στη Google: ΕΝΤΑΞΕΙ' $Ok }
        else { Say '  robots.txt της δοκιμαστικής διεύθυνσης: ΠΡΟΒΛΗΜΑ' $Bad; $all = $false }
    } else {
        if ($r.status -eq 200 -and $r.text.Contains('Sitemap: https://' + $Domain + '/sitemap.xml')) { Say '  robots.txt με sitemap: ΕΝΤΑΞΕΙ' $Ok }
        else { Say '  robots.txt: ΠΡΟΒΛΗΜΑ' $Bad; $all = $false }
    }
    return $all
}

# L119: preview, live and remove-preview in one paste. With -AfterPreview the live step goes on only when the newest
# preview report is of this code version, from the last 2 hours, ended ΕΤΟΙΜΟ and has no ΠΡΟΒΛΗΜΑ line.
function Test-PreviewReport {
    $last = @(Get-ChildItem -LiteralPath $OutDir -Filter 'OGW_SITE_PREVIEW_*.txt' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime, Name | Select-Object -Last 1)
    if ($last.Count -eq 0) { Say 'Δεν βρήκα αναφορά της δοκιμαστικής διεύθυνσης (-AfterPreview): ΔΕΝ ανεβάζω το site, δεν άλλαξε τίποτα. Στείλε στο Claude αυτή την αναφορά.' $Bad; return $false }
    $r = $last[0]
    $text = [System.IO.File]::ReadAllText($r.FullName, [System.Text.Encoding]::UTF8)
    $why = @()
    if (((Get-Date) - $r.LastWriteTime).TotalMinutes -gt 120) { $why += 'είναι πιο παλιά από 2 ώρες' }
    if (-not $text.Contains('Code version: ' + (Split-Path -Leaf $repo))) { $why += 'είναι άλλης έκδοσης του κώδικα' }
    if (-not $text.Contains('ΕΤΟΙΜΟ: άνοιξε τη δοκιμαστική διεύθυνση')) { $why += 'δεν τελείωσε με ΕΤΟΙΜΟ' }
    if ($text.Contains('ΠΡΟΒΛΗΜΑ')) { $why += 'λέει ΠΡΟΒΛΗΜΑ' }
    if ($why.Count -gt 0) {
        Say ('Η αναφορά της δοκιμαστικής διεύθυνσης {0} {1}: ΔΕΝ ανεβάζω το site, δεν άλλαξε τίποτα. Στείλε στο Claude αυτή την αναφορά.' -f $r.Name, ($why -join ', ')) $Bad
        return $false
    }
    Say ('Δοκιμαστική διεύθυνση αυτής της έκδοσης ({0}): ΕΤΟΙΜΟ, χωρίς ΠΡΟΒΛΗΜΑ: ΕΝΤΑΞΕΙ' -f $r.Name) $Ok
    return $true
}

# ---------------- start ----------------
Say ('MEGA STORES GEAR WORLD (OGW) - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

# ---------------- remove-preview: the test Worker goes (owner, 29/10/2026) ----------------
if ($Step -eq 'remove-preview') {
    Say ''
    Say 'Τι θα γίνει:'
    Say ('  - Σβήνεται ΜΟΝΟ ο δοκιμαστικός Worker "{0}" (η διεύθυνση *.workers.dev παύει να ανοίγει).' -f $PreviewName)
    Say ('  - Το {0} και ο Worker "{1}" ΔΕΝ αλλάζουν.' -f $Domain, $WorkerName)
    Say '  - Αν τον ξαναχρειαστούμε: το βήμα preview τον φτιάχνει ξανά σε 1 λεπτό.'
    if ($PreviewName -eq $WorkerName -or $PreviewName -notmatch '-preview$') { Say 'Λάθος όνομα δοκιμαστικού Worker: δεν σβήνω τίποτα.' $Bad; Finish 12 }
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
    Say ('Σβήστηκε ο δοκιμαστικός Worker "{0}". Το {1} δεν άλλαξε.' -f $PreviewName, $Domain) $Ok
    Finish 0
}

$deploy = Prepare-Deploy
$ogw = Join-Path (Join-Path $deploy 'sites') 'ogw'

$who = $null
for ($try = 1; $try -le 3; $try++) {
    $who = Invoke-Wrangler $ogw 'whoami'
    if ($who.text -match '(?i)associated with the email|you are logged in') { break }
    if ($try -lt 3) { Start-Sleep -Seconds 5 }
}
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare ή δεν απάντησε. Στείλε στο Claude αυτό το μήνυμα.' $Bad
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 20)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: OK'
$liveState = Get-WorkerState $ogw $WorkerName
$live = $liveState.ver
if (-not $liveState.known) { Say ('Worker "{0}" (live): η Cloudflare δεν είπε αν υπάρχει.' -f $WorkerName) $Warn }
else { Say ('Worker "{0}" (live): {1}' -f $WorkerName, $(if ($live) { 'υπάρχει, έκδοση ' + $live } else { 'δεν υπάρχει ακόμα (πρώτο ανέβασμα)' })) }

if ($Step -eq 'check') {
    $pv = (Get-WorkerState $ogw $PreviewName).ver
    Say ('Δοκιμαστικός Worker "{0}": {1}' -f $PreviewName, $(if ($pv) { 'υπάρχει (θέλει remove-preview)' } else { 'δεν υπάρχει' }))
    if (-not $NoHttpCheck) {
        $p = Get-Page ('https://{0}/' -f $Domain)
        if ($p.status -eq 200) { Say ('https://{0}/ απαντά 200. Κουμπιά Amazon live: {1}' -f $Domain, $(if (Test-LiveAmazon) { 'ναι' } else { 'όχι' })) }
        else { Say ('https://{0}/ δεν απαντά ακόμα ({1})' -f $Domain, $p.status) }
    }
    Say ''; Say 'Μόνο έλεγχος: δεν άλλαξε τίποτα.' $Ok; Finish 0
}

# ---------------- preview ----------------
if ($Step -eq 'preview') {
    Say ''
    Say 'Τι θα γίνει:'
    Say ('  - Ο δοκιμαστικός Worker "{0}" σε διεύθυνση *.workers.dev παίρνει αυτή την έκδοση (noindex).' -f $PreviewName)
    Say '  - Τα κουμπιά Amazon εκεί είναι ΧΩΡΙΣ το Associates ID (η δοκιμαστική διεύθυνση δεν είναι στο Amazon Associates).'
    Say ('  - Το {0}, τα Gear World sites, το Hub και οι βάσεις ΔΕΝ αλλάζουν.' -f $Domain)
    if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
    if (-not (Confirm-Approval $PhrasePreview)) { Say 'Δεν δόθηκε η έγκριση για τη δοκιμαστική διεύθυνση: σταμάτησα (δεν ανέβηκε τίποτα).' $Warn; Finish 1 }
    $cfg = Write-Config $ogw $true
    $d = Invoke-Wrangler $ogw (('deploy --config "{0}" --var AMAZON_LINKS:preview' -f $cfg) + $GwVersionVar) -NonInteractive
    if ($d.code -ne 0) { Say 'Το ανέβασμα της δοκιμαστικής διεύθυνσης απέτυχε. Τίποτα άλλο δεν άλλαξε. Έξοδος:' $Bad; Say $d.text; Finish 9 }
    $um = [regex]::Match($d.text, 'https://[A-Za-z0-9\.\-]+\.workers\.dev')
    $url = ''
    if ($um.Success) { $url = $um.Value }
    Say ('Ανέβηκε. Δοκιμαστική διεύθυνση: {0}' -f $(if ($url) { $url } else { '(δεν τη βρήκα στην έξοδο)' })) $Ok
    if (-not $url) { Say 'Δεν βρήκα τη δοκιμαστική διεύθυνση: ΠΡΟΒΛΗΜΑ. Στείλε στο Claude αυτή την αναφορά.' $Bad; Finish 9 }
    if (-not $NoHttpCheck) {
        # A new *.workers.dev address can answer nothing or 404 for a short while: up to 6 tries, 10 seconds apart.
        $p = $null
        for ($i = 1; $i -le 6; $i++) {
            Start-Sleep -Seconds 10
            $p = Get-Page ($url + '/')
            if ($p.status -eq 200) { break }
        }
        if ($p.status -eq 200 -and $p.robots -match 'noindex') { Say '  Η δοκιμαστική διεύθυνση έχει noindex: ΕΝΤΑΞΕΙ' $Ok }
        elseif ($p.status -eq 200) { Say '  Η δοκιμαστική διεύθυνση ΧΩΡΙΣ noindex: ΠΡΟΒΛΗΜΑ' $Bad }
        $okSite = Test-Site $url 'preview'
        if (-not $okSite) { Say ''; Say 'Η δοκιμαστική διεύθυνση έχει ΠΡΟΒΛΗΜΑ: το live ΔΕΝ θα γίνει. Στείλε στο Claude αυτή την αναφορά.' $Bad; Finish 9 }
    }
    Say ''
    Say ('ΕΤΟΙΜΟ: άνοιξε τη δοκιμαστική διεύθυνση στο κινητό σου: {0} . Το {1} δεν άλλαξε.' -f $url, $Domain) $Ok
    Finish 0
}

# ---------------- live ----------------
if (-not $liveState.known) {
    Say ''
    Say 'Δεν μπόρεσα να δω αν το site είναι ήδη live (η Cloudflare έδωσε άλλη απάντηση): για ασφάλεια ΔΕΝ ανεβάζω τίποτα. Ξανατρέξε σε λίγα λεπτά· αν ξανασυμβεί, στείλε στο Claude αυτή την αναφορά.' $Bad
    foreach ($line in @($liveState.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }
    Finish 11
}
# L156: never a version that lacks the live one. Also when Cloudflare lists no version but the site already says
# which one it runs (/api/version).
$runGuard = [bool]$live
if (-not $runGuard -and -not $NoHttpCheck) {
    $v = Get-Page ('https://{0}/api/version' -f $Domain)
    if ($v.status -eq 200 -and $v.text -match '"commit"\s*:\s*"[0-9a-f]{40}"') { $runGuard = $true }
}
if ($runGuard) { Assert-GwLiveGuard @($Domain) $repo }
# Are the Amazon links live? Read from the live home page; an update never guesses (a wrong guess would remove every
# affiliate link without anyone noticing).
$liveAmazon = $false
if ($live -and -not $NoHttpCheck) {
    $hp = Get-Page ('https://{0}/' -f $Domain)
    if ($hp.status -ne 200) {
        Say ('Το https://{0}/ δεν απάντησε ({1}): δεν ξέρω αν τα κουμπιά Amazon είναι live, οπότε ΔΕΝ ανεβάζω τίποτα. Ξανατρέξε σε λίγα λεπτά.' -f $Domain, $hp.status) $Bad
        Finish 6
    }
    $liveAmazon = $hp.text.Contains('As an Amazon Associate I earn from qualifying purchases.')
}
Say ''
Say 'Τι θα γίνει:'
Say ('  - Ανεβαίνει το Mega Stores Gear World στον Worker "{0}", στο {1} και στο www.{1}.' -f $WorkerName, $Domain)
if (-not $live) { Say '  - Πρώτη φορά: η Cloudflare φτιάχνει μόνη της τις εγγραφές DNS και το πιστοποιητικό (έως 10 λεπτά).' }
Say '  - Τα Gear World sites, το Hub, η Group και οι βάσεις ΔΕΝ αλλάζουν. Καμία βάση, κανένα μυστικό, κανένα cookie.'
if ($AmazonOff) { Say '  - Κουμπιά Amazon: ΒΓΑΙΝΟΥΝ (-AmazonOff). Μένουν μόνο τα κουμπιά προς τα Gear World sites.' }
elseif ($liveAmazon) { Say ('  - Κουμπιά Amazon: είναι ήδη live με το {0}, μένουν.' -f $AmazonTag) }
else { Say ('  - Κουμπιά Amazon: μόνο με τη φράση {0} (ότι πρόσθεσες το {1} στο Amazon Associates).' -f $PhraseAmazon, $Domain) }
if ($live) { Say ('  - Επαναφορά: Rollback στο {0} ή: npx wrangler rollback {1} --name {2}' -f $DashLink, $live, $WorkerName) }
else { Say ('  - Επαναφορά: npx wrangler delete --name {0} (σβήνει το site· τίποτα άλλο δεν επηρεάζεται)' -f $WorkerName) }
if ($AfterPreview -and -not (Test-PreviewReport)) { Finish 23 }
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' $Ok; Finish 0 }
if (-not (Confirm-Approval $PhraseLive)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' $Warn; Finish 1 }

$mode = 'off'
if ($AmazonOff) { Say 'Amazon: -AmazonOff: το site ανεβαίνει χωρίς κουμπιά Amazon.' $Warn }
elseif ($liveAmazon) { $mode = 'on' }
else {
    Write-Host ''
    Write-Host ('Amazon: έχεις προσθέσει το {0} στο Amazon Associates ({1} → το email σου → Account Settings → Edit your website list);' -f $Domain, $AssociatesLink) -ForegroundColor Cyan
    Write-Host '  Αν ναι, γράψε τη φράση: τα κουμπιά Amazon θα έχουν το Associates ID gearworld04-21.'
    Write-Host '  Αν όχι, πάτα Enter: το site ανεβαίνει χωρίς κουμπιά Amazon (μόνο τα Gear World) και τη φράση τη δίνεις την επόμενη φορά.'
    if (Confirm-Approval $PhraseAmazon '(ή πάτα Enter: το site ανεβαίνει χωρίς κουμπιά Amazon)') { $mode = 'on'; Say ('Amazon: δόθηκε η φράση {0}: τα κουμπιά Amazon με το {1}.' -f $PhraseAmazon, $AmazonTag) $Ok }
    else { Say 'Amazon: χωρίς φράση: το site ανεβαίνει χωρίς κουμπιά Amazon.' $Warn }
}

$cfg = Write-Config $ogw $false
$d = Invoke-Wrangler $ogw (('deploy --config "{0}" --var AMAZON_LINKS:{1}' -f $cfg, $mode) + $GwVersionVar) -NonInteractive
if ($d.code -ne 0) {
    Say 'Το ανέβασμα απέτυχε. Τίποτα άλλο δεν άλλαξε. Έξοδος:' $Bad
    Say $d.text
    if ($d.text -match '(?i)already has externally managed DNS records|record with that host already exists') {
        Say ('Το {0} έχει ήδη εγγραφή DNS που εμποδίζει. Άνοιξε {1} , διάλεξε το {0} και στείλε στο Claude φωτογραφία των εγγραφών.' -f $Domain, $DnsLink) $Warn
    } elseif ($d.text -match '(?i)zone|not found') {
        Say ('Μάλλον το {0} δεν είναι στον λογαριασμό Cloudflare όπου είναι τα άλλα sites. Στείλε στο Claude αυτή την αναφορά.' -f $Domain) $Warn
    }
    Finish 9
}
Say ('Ανέβηκε στο {0} (κουμπιά Amazon: {1}).' -f $Domain, $(if ($mode -eq 'on') { 'ναι' } else { 'όχι' })) $Ok
if (-not $NoHttpCheck) {
    $answered = $false
    for ($i = 1; $i -le 20; $i++) {
        $p = Get-Page ('https://{0}/' -f $Domain)
        if ($p.status -eq 200) { $answered = $true; break }
        Start-Sleep -Seconds 15
    }
    if (-not $answered) {
        Say ('Το https://{0} δεν απάντησε ακόμα (το πιστοποιητικό θέλει έως 10 λεπτά την πρώτη φορά). Ξανατρέξε το βήμα check σε 15 λεπτά.' -f $Domain) $Warn
    } else {
        # A new version reaches every Cloudflare location within a minute or two (18/11/2026, L190: the check 10 seconds
        # after the deploy that turned the Amazon buttons on still got the page without them, a minute later it had them).
        # So wait, up to 2 minutes, until the guide answers as this version (buttons with or without the Associates ID),
        # asking each time with a new ?gwcheck= so nothing in between hands back an older copy. Read-only (GET).
        # Since L195 (review 19/11/2026) it also waits for /api/version to name this code version: with the Amazon links
        # already on, the guide alone looks the same in the old and the new version.
        $guideUrl = 'https://{0}/guides/christmas-gift-ideas-for-him/' -f $Domain
        $newCommit = Get-GwCommit $repo
        for ($i = 1; $i -le 12; $i++) {
            $v = Get-Page ('https://{0}/api/version?gwcheck={1}-{2}' -f $Domain, $stamp, $i)
            $isNew = (-not $newCommit) -or ($v.status -eq 200 -and $v.text.Contains($newCommit))
            $g = Get-Page ('{0}?gwcheck={1}-{2}' -f $guideUrl, $stamp, $i)
            $hasTag = $g.text.Contains('tag=' + $AmazonTag)
            $hasAmazon = $g.text.Contains('https://www.amazon.co.uk/s?k=')
            if ($isNew -and $g.status -eq 200 -and (($mode -eq 'on' -and $hasTag) -or ($mode -eq 'off' -and -not $hasAmazon))) { break }
            if ($i -eq 1) { Say 'Περιμένω να φτάσει η νέα έκδοση σε όλη την Cloudflare (έως 2 λεπτά)...' }
            Start-Sleep -Seconds 10
        }
        $okSite = Test-Site ('https://{0}' -f $Domain) $mode
        $w = Get-Page ('https://www.{0}/' -f $Domain)
        if ($w.status -eq 301 -and $w.location -eq ('https://{0}/' -f $Domain)) { Say '  www → κανονική διεύθυνση (301): ΕΝΤΑΞΕΙ' $Ok }
        else { Say ('  www.{0}: απαντά {1} (το πιστοποιητικό του www μπορεί να θέλει λίγα λεπτά ακόμα)' -f $Domain, $w.status) $Warn }
        if (-not $okSite) { Say 'Κάτι δεν απάντησε σωστά (δες ΠΡΟΒΛΗΜΑ πιο πάνω). Στείλε στο Claude αυτή την αναφορά.' $Bad; Finish 9 }
    }
}
Say ''
Say ('ΕΤΟΙΜΟ: https://{0}' -f $Domain) $Ok
Finish 0
