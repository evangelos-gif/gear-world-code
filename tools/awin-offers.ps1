<#
.SYNOPSIS
  Gear World email: every Awin offer (voucher codes and promotions) of the programmes we have joined. READ-ONLY.

.DESCRIPTION
  Asks for the Awin API token, hidden (https://ui.awin.com/awin-api, "Show my API token"). The token is never shown,
  written to a file, put on a command line, in the report or in an error message.
  Reads the Awin Publisher API (POST https://api.awin.com/publisher/3057233/promotions: it only reads) for the active
  and the upcoming offers of the joined programmes, all regions, 200 per page. Nothing changes anywhere.
  Writes:
    <home>\gear-world-reports\AWIN_OFFERS_<time>.csv  every offer: advertiser, type, code, title, dates, regions,
                                                      landing page, and whether it is a real offer
    <home>\gear-world-reports\AWIN_OFFERS_<time>.txt  only the real offers (a code, % off, money off, free delivery,
                                                      buy X get Y, sale), by advertiser; also copied to the clipboard
  Product listings without a discount ("Explore ... at GamingKit") are counted but left out of the summary.
  The Awin tracking links (urlTracking) are never written: opening one would count as a click.
  -FromFile (a saved API answer) and -TokenEnv exist for the automatic tests only.
#>
param(
    [string]$OutDir = '',
    [string]$PcHome = '',
    [string]$FromFile = '',
    [string]$TokenEnv = '',
    [int]$MaxPages = 60,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$PublisherId = 3057233
$Api = 'https://api.awin.com/publisher/{0}/promotions' -f $PublisherId
$TokenPage = 'https://ui.awin.com/awin-api'
$OffersPage = 'https://ui.awin.com/go/publisher?r=/awin/affiliate/{0}/promotion' -f $PublisherId
if (-not $PcHome) { $PcHome = $HOME }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$today = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
# Colours without red and green (lessons L35): cyan = OK, yellow = attention, magenta = problem.
$Ok = 'Cyan'
$Warn = 'Yellow'
$Bad = 'Magenta'
$script:Secret = ''

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    if ($script:Secret) { $text = $text.Replace($script:Secret, '[token]') }
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('AWIN_OFFERS_{0}.txt' -f $stamp)
    $text = $L -join "`r`n"
    if ($script:Secret) { $text = $text.Replace($script:Secret, '[token]') }
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor $Ok }
    exit $code
}

function Short([string]$s, [int]$max) {
    $t = (([string]$s) -replace '\s+', ' ').Trim()
    if ($t.Length -le $max) { return $t }
    return ($t.Substring(0, $max - 1).TrimEnd() + '…')
}

function Day([object]$v) {
    $s = [string]$v
    if ($s -match '^(\d{4}-\d{2}-\d{2})') { return $Matches[1] }
    return ''
}

# One page of the Awin promotions API: @{ status; items; error }. The token goes only in the Authorization header.
function Get-Page([string]$token, [string]$status, [int]$page) {
    $body = @{ filters = @{ membership = 'joined'; status = $status; type = 'all' }; pagination = @{ page = $page; pageSize = 200 } } | ConvertTo-Json -Depth 5
    $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($body)
    for ($try = 1; $try -le 3; $try++) {
        try {
            $req = [System.Net.HttpWebRequest]::Create($Api)
            $req.Method = 'POST'
            $req.ContentType = 'application/json'
            $req.Accept = 'application/json'
            $req.UserAgent = 'GearWorld-offers/1.0 (read-only)'
            $req.Timeout = 60000
            $req.Headers.Add('Authorization', 'Bearer ' + $token)
            $req.ContentLength = $bytes.Length
            $s = $req.GetRequestStream()
            try { $s.Write($bytes, 0, $bytes.Length) } finally { $s.Close() }
            $resp = $req.GetResponse()
        } catch [System.Net.WebException] {
            $resp = $_.Exception.Response
            if (-not $resp) {
                if ($try -lt 3) { Start-Sleep -Seconds (5 * $try); continue }
                return @{ status = 0; items = @(); error = 'network' }
            }
        }
        $code = [int]$resp.StatusCode
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream(), (New-Object System.Text.UTF8Encoding($false)))
        $text = $reader.ReadToEnd()
        $reader.Close()
        $resp.Close()
        if ($code -eq 429 -and $try -lt 3) { Say ('Το Awin ζήτησε να περιμένουμε. Ξαναδοκιμάζω σε {0} δευτερόλεπτα...' -f (30 * $try)) $Warn; Start-Sleep -Seconds (30 * $try); continue }
        if ($code -ne 200) { return @{ status = $code; items = @(); error = ('HTTP {0}' -f $code) } }
        $its = Get-Items $text
        return @{ status = 200; items = $its; error = '' }
    }
    return @{ status = 0; items = @(); error = 'retries' }
}

# The offers in an API answer: a JSON array, or an object with "data" (Windows PowerShell 5.1: arrays flattened, L76).
function Get-Items([string]$text) {
    $parsed = ConvertFrom-Json -InputObject $text
    $list = $parsed
    if ($null -ne $parsed -and -not ($parsed -is [System.Array]) -and $parsed.PSObject.Properties['data']) { $list = $parsed.data }
    $items = New-Object System.Collections.ArrayList
    foreach ($x in @($list)) { if ($null -ne $x -and $x.PSObject.Properties['promotionId']) { [void]$items.Add($x) } }
    return , $items.ToArray()
}

# A real offer: a voucher code, or a promotion whose words say what the customer saves.
$SaveWords = '(?i)(\d+\s?%|£\s?\d|€\s?\d|\$\s?\d|\boff\b|free\s+(eco\s+|uk\s+|standard\s+|next\s+day\s+)?(delivery|shipping|gift|p&p)|buy\s+\d+.{0,20}get|\bsave\b|\bsale\b|discount|black friday|cyber monday|clearance|half price|bogof|\bdeals?\b)'
function Test-Real([object]$o) {
    $code = ''
    if ($o.PSObject.Properties['voucher'] -and $null -ne $o.voucher -and $o.voucher.PSObject.Properties['code']) { $code = [string]$o.voucher.code }
    if ($code.Trim()) { return $true }
    $words = ([string]$o.title) + ' ' + ([string]$o.description)
    if ($words -match '(?i)^\s*(explore|browse|find|check|discover|upgrade your)\b' -and $words -notmatch '(?i)(\d+\s?%|£\s?\d|\boff\b|free\s+\w*\s*delivery|\bsave\b|\bsale\b|black friday)') { return $false }
    return ($words -match $SaveWords)
}

function Get-Regions([object]$o) {
    if ($null -eq $o.regions) { return '' }
    if ($o.regions.PSObject.Properties['all'] -and $o.regions.all -eq $true) { return 'All' }
    $codes = @()
    if ($o.regions.PSObject.Properties['list']) { foreach ($r in @($o.regions.list)) { if ($r -and $r.countryCode) { $codes += [string]$r.countryCode } } }
    return ($codes -join ' ')
}

# ---------------- start ----------------
Say ('AWIN OFFERS (μόνο ανάγνωση) - {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')) $Ok
Say ('Έκδοση εργαλείου: {0}' -f (Split-Path -Leaf $repo))
Say ''

$all = New-Object System.Collections.ArrayList
if ($FromFile) {
    # Assigned first: a function that returns its array with the comma must not be wrapped in @() (lessons L76).
    $fileItems = Get-Items ([System.IO.File]::ReadAllText($FromFile))
    foreach ($o in $fileItems) { [void]$all.Add(@{ o = $o; status = 'active' }) }
    Say ('Δοκιμή από αρχείο: {0} προσφορές.' -f $all.Count)
} else {
    $plain = ''
    if ($TokenEnv) {
        $plain = [string][System.Environment]::GetEnvironmentVariable($TokenEnv)
    } else {
        Write-Host ('Άνοιξε {0}, γράψε τον κωδικό σου, πάτα "Show my API token" και αντέγραψέ το.' -f $TokenPage) -ForegroundColor $Warn
        $sec = Read-Host 'Επικόλλησε εδώ το κλειδί (δεν φαίνεται όσο το επικολλάς) και πάτα Enter' -AsSecureString
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
        try { $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
    $plain = ([string]$plain).Trim()
    if ($plain) { $script:Secret = $plain }
    if (-not $plain -or $plain -match '\s' -or $plain.Length -lt 16 -or $plain.Length -gt 200) {
        Say 'Αυτό δεν μοιάζει με κλειδί του Awin (κενό, κενά ή λάθος μήκος). Δεν έστειλα τίποτα. Δοκίμασε ξανά.' $Bad
        Finish 8
    }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    foreach ($status in @('active', 'upcoming')) {
        $got = 0
        for ($page = 1; $page -le $MaxPages; $page++) {
            $p = Get-Page $plain $status $page
            if ($p.status -eq 401 -or $p.status -eq 403) {
                Say ('Το Awin δεν δέχτηκε το κλειδί ({0}). Πάρε νέο από {1} και ξανατρέξε την εντολή.' -f $p.error, $TokenPage) $Bad
                Finish 9
            }
            if ($p.status -ne 200) { Say ('Σελίδα {0} ({1}): δεν διαβάστηκε ({2}). Κρατάω όσα ήρθαν μέχρι εδώ.' -f $page, $status, $p.error) $Warn; break }
            foreach ($o in @($p.items)) { [void]$all.Add(@{ o = $o; status = $status }) }
            $got += @($p.items).Count
            if (@($p.items).Count -lt 200) { break }
        }
        Say ('Awin, προσφορές «{0}»: {1}' -f $status, $got)
    }
    $plain = ''
}

# Clean list: one row per offer id, still valid today, never the tracking link.
$seen = @{}
$rows = New-Object System.Collections.ArrayList
foreach ($e in $all) {
    $o = $e.o
    $id = [string]$o.promotionId
    if ($seen.ContainsKey($id)) { continue }
    $seen[$id] = $true
    $end = Day $o.endDate
    if ($end -and $end -lt $today) { continue }
    $code = ''
    $exclusive = ''
    if ($o.PSObject.Properties['voucher'] -and $null -ne $o.voucher) {
        if ($o.voucher.PSObject.Properties['code']) { $code = [string]$o.voucher.code }
        if ($o.voucher.PSObject.Properties['exclusive'] -and $o.voucher.exclusive -eq $true) { $exclusive = 'yes' }
    }
    $start = Day $o.startDate
    $status = $e.status
    if ($start -and $start -gt $today) { $status = 'upcoming' }
    [void]$rows.Add([pscustomobject]@{
        advertiser_id = [string]$o.advertiser.id
        advertiser    = [string]$o.advertiser.name
        type          = [string]$o.type
        status        = $status
        code          = $code
        exclusive     = $exclusive
        title         = Short $o.title 200
        description   = Short $o.description 400
        terms         = Short $o.terms 400
        start         = $start
        end           = $end
        regions       = Get-Regions $o
        landing_page  = [string]$o.url
        real_offer    = $(if (Test-Real $o) { 'yes' } else { 'no' })
    })
}

if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$csv = Join-Path $OutDir ('AWIN_OFFERS_{0}.csv' -f $stamp)
$rows | Export-Csv -LiteralPath $csv -NoTypeInformation -Encoding UTF8

$real = @($rows | Where-Object { $_.real_offer -eq 'yes' })
$advertisers = @($rows | ForEach-Object { $_.advertiser } | Sort-Object -Unique)
Say ('Σύνολο: {0} προσφορές από {1} καταστήματα. Πραγματικές προσφορές (κωδικός ή έκπτωση): {2}. Χωρίς έκπτωση (π.χ. «Explore ...»): {3}.' -f $rows.Count, $advertisers.Count, $real.Count, ($rows.Count - $real.Count))
Say ('Όλες οι προσφορές (και χωρίς έκπτωση): {0}' -f $csv)
Say ''
Say '=== ΠΡΑΓΜΑΤΙΚΕΣ ΠΡΟΣΦΟΡΕΣ (ανά κατάστημα) ==='
foreach ($g in @($real | Group-Object advertiser | Sort-Object Name)) {
    Say ('* {0} (Awin {1})' -f $g.Name, @($g.Group)[0].advertiser_id)
    foreach ($r in @($g.Group | Sort-Object end, title)) {
        $what = $r.title
        if ($r.description -and $r.description -ne $r.title) { $what = $what + ' — ' + (Short $r.description 140) }
        $codePart = $(if ($r.code) { 'ΚΩΔΙΚΟΣ ' + $r.code + $(if ($r.exclusive) { ' (exclusive)' } else { '' }) + ' · ' } else { '' })
        $endPart = $(if ($r.end) { $r.end } else { 'ΧΩΡΙΣ ΛΗΞΗ' })
        $upPart = $(if ($r.status -eq 'upcoming') { ' · ΕΡΧΕΤΑΙ' } else { '' })
        Say ('  - {0}{1} | {2} → {3}{4} | περιοχές: {5} | {6}' -f $codePart, (Short $what 220), $r.start, $endPart, $upPart, $r.regions, $r.landing_page)
    }
}
Say ''
Say ('Η λίστα στο Awin: {0}' -f $OffersPage)
Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ (μόνο ανάγνωση, δεν άλλαξε τίποτα).' $Ok
Finish 0
