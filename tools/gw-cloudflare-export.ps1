<#
.SYNOPSIS
  Gear World: a copy of the Cloudflare settings of every domain on the backup drive (reads Cloudflare, never changes it).

.DESCRIPTION
  Lessons L120 (owner, 14/11/2026): the backup had the code, the PC folders and the databases, but not the settings of
  the 15 domains (DNS, SSL/TLS, security and rate-limit rules, redirects, header rules, DNSSEC, Worker routes and
  domains). If the Cloudflare account were lost they would have to be found again by hand.

  It reads Cloudflare with a READ-ONLY API token of the owner, made once in the Cloudflare dashboard from the template
  "Read all resources". The token is never shown, never written into a report, never sent to GitHub and never put on the
  backup drive: it stays on this PC only, encrypted for this Windows user (DPAPI), in
  <home>\gear-world-secrets\cloudflare-read.token (the backup leaves that folder out). Every request is a GET.

  -Step token   Without -Apply: shows whether a token is saved and works. With -Apply -Approve
                'ΕΓΚΡΙΝΩ ΚΛΕΙΔΙ ΑΝΑΓΝΩΣΗΣ CLOUDFLARE': opens the token page of Cloudflare and waits (up to -WaitSec, 10
                minutes) until the owner presses Copy next to the new token; it takes the token from the clipboard
                (nothing else is kept from the clipboard), checks it with Cloudflare, saves it encrypted and empties the
                clipboard. A token that is already saved and works is kept (-Replace to change it).
  -Step check   READ-ONLY (default): checks the token, lists the domains and shows what the export would write.
  -Step export  With -Apply -Approve 'ΕΓΚΡΙΝΩ BACKUP <drive letter>' (the phrase of the backup): writes
                <Target>\cloudflare\<date_time>\ : per domain dns.bind (the DNS records as a zone file Cloudflare can
                import), dns-<page>.json, settings.json, dnssec.json, rulesets\<phase>.json (the zone's own rules),
                pagerules.json, workers-routes.json, managed-headers.json, bot-management.json; for the account
                accounts.json, workers-domains.json, workers-scripts.json (names, no code), d1-databases.json;
                summary.txt and README-CLOUDFLARE.txt (how to restore). <Target> must be an existing backup folder
                (with README-RESTORE.txt) on a drive that is not the Windows drive.

  Report: <home>\gear-world-reports\GW_CLOUDFLARE_<step>_<time>.txt (also copied to the clipboard). It names the
  domains and counts only: no IDs, no token. Exit codes: 0 ok, 1 phrase, 2 target or drive, 3 no working token,
  4 Cloudflare cannot be reached, 12 some parts could not be read, 13 unexpected.

.EXAMPLE
  ... -Tool gw-cloudflare-export -Step token -Apply -Approve 'ΕΓΚΡΙΝΩ ΚΛΕΙΔΙ ΑΝΑΓΝΩΣΗΣ CLOUDFLARE'
.EXAMPLE
  ... -Tool gw-cloudflare-export -Step export -Apply -Approve 'ΕΓΚΡΙΝΩ BACKUP D' -Target 'D:\GearWorldBackup-2026-11-12'
#>
param(
    [ValidateSet('check', 'token', 'export')]
    [string]$Step = 'check',
    [string]$Target = '',
    [switch]$Apply,
    [string]$Approve = '',
    [switch]$Replace,
    [int]$WaitSec = 600,
    [switch]$AllowSystemDrive,
    [string]$HomeDir = '',
    [string]$OutDir = '',
    [switch]$NoClipboard,
    [string]$Chat = '4 · Sites & Κώδικας',
    [string]$FakeApiDir = '', # tests only: Cloudflare answers read from files
    [string]$ClipboardFile = '' # tests only: the clipboard read from a file
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (-not $HomeDir) { $HomeDir = $HOME }
if (-not $OutDir) { $OutDir = Join-Path $HomeDir 'gear-world-reports' }
if ($WaitSec -lt 1) { $WaitSec = 600 }
$ApiBase = 'https://api.cloudflare.com/client/v4/'
$PhraseToken = 'ΕΓΚΡΙΝΩ ΚΛΕΙΔΙ ΑΝΑΓΝΩΣΗΣ CLOUDFLARE'
$TokenPage = 'https://dash.cloudflare.com/profile/api-tokens'
$SecretDir = Join-Path $HomeDir 'gear-world-secrets'
$TokenFile = Join-Path $SecretDir 'cloudflare-read.token'
$TokenRx = '^[A-Za-z0-9_\-]{30,120}$'
$UuidRx = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$L = New-Object System.Collections.Generic.List[string]
$script:Finishing = $false
$script:Token = ''
$script:Problems = 0
$script:Warnings = 0

function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}
# No ID and never the token in a report (the report goes into the chat): 32-character hex IDs are masked as well.
function Hide-Text([string]$s) {
    $t = [regex]::Replace([string]$s, '\b[0-9a-fA-F]{32}\b', '<id>')
    if ($script:Token) { $t = $t.Replace($script:Token, '<κλειδί>') }
    return $t
}
function Finish([int]$code) {
    if ($script:Finishing) { exit $code }
    $script:Finishing = $true
    if ($Step -eq 'export' -and $Apply) { Say 'ΤΕΛΟΣ ΑΝΤΙΓΡΑΦΟΥ CLOUDFLARE' 'Cyan' }
    elseif ($Step -eq 'token' -and $Apply) { Say 'ΤΕΛΟΣ ΚΛΕΙΔΙΟΥ CLOUDFLARE' 'Cyan' }
    else { Say 'ΤΕΛΟΣ ΕΛΕΓΧΟΥ CLOUDFLARE (δεν γράφτηκε τίποτα)' 'Cyan' }
    $text = Hide-Text ($L -join "`r`n")
    $file = Join-Path $OutDir ('GW_CLOUDFLARE_{0}_{1}.txt' -f $Step.ToUpperInvariant(), $stamp)
    $written = $false
    try {
        if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
        [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
        $written = $true
    } catch { Write-Host ('Η αναφορά δεν γράφτηκε στο {0}: {1}' -f $file, $_.Exception.Message) -ForegroundColor Yellow }
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    if ($written) { Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file) }
    if (-not $NoClipboard) { Write-Host ('Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «{0}» και πάτα Ctrl+V.' -f $Chat) -ForegroundColor Cyan }
    exit $code
}
trap { Say ('ΠΡΟΒΛΗΜΑ: η εντολή σταμάτησε απρόσμενα: {0}' -f (Hide-Text $_.Exception.Message)) 'Yellow'; Finish 13 }
function Normalize-Phrase([string]$s) {
    $d = ([string]$s).Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    $t = ($sb.ToString().ToUpperInvariant() -replace '\s+', ' ').Trim()
    return ($t -replace '^EGKRINO ', 'ΕΓΚΡΙΝΩ ')
}
function Test-Phrase([string]$phrase) {
    if (-not $Approve) { Say ('Λείπει η φράση: η εντολή θέλει -Approve ''{0}''. Δεν άλλαξε τίποτα.' -f $phrase) 'Yellow'; Finish 1 }
    if ((Normalize-Phrase $Approve) -ne (Normalize-Phrase $phrase)) { Say ('Λάθος φράση έγκρισης (χρειάζεται: {0}). Δεν άλλαξε τίποτα.' -f $phrase) 'Yellow'; Finish 1 }
}

# One GET to the Cloudflare API: @{ status; text; bytes; json }. Only GET, ever (lessons L120). The bytes are kept as they
# come (UTF-8), so a file on the drive is exactly what Cloudflare sent. One more try after 5 seconds on 429/5xx/no answer.
function Invoke-Cf([string]$path, [string]$token) {
    if ($FakeApiDir) {
        $name = ($path -replace '[^A-Za-z0-9]+', '_').Trim('_')
        $f = Join-Path $FakeApiDir ($name + '.txt')
        if (-not (Test-Path -LiteralPath $f)) { return @{ status = 404; text = ''; bytes = $null; json = $null } }
        $bytes = [System.IO.File]::ReadAllBytes($f)
        $text = [System.Text.Encoding]::UTF8.GetString($bytes)
        if ($text.StartsWith('#')) { return @{ status = [int]($text.Substring(1, 3)); text = ''; bytes = $null; json = $null } }
        $j = $null
        try { $j = $text | ConvertFrom-Json } catch { }
        return @{ status = 200; text = $text; bytes = $bytes; json = $j }
    }
    $uri = $ApiBase + $path
    for ($try = 1; $try -le 2; $try++) {
        $status = 0
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Method Get -TimeoutSec 60 -Uri $uri -Headers @{ Authorization = ('Bearer ' + $token); 'User-Agent' = 'gear-world-backup' }
            $bytes = $r.RawContentStream.ToArray()
            $text = [System.Text.Encoding]::UTF8.GetString($bytes)
            $j = $null
            try { $j = $text | ConvertFrom-Json } catch { }
            return @{ status = [int]$r.StatusCode; text = $text; bytes = $bytes; json = $j }
        } catch [System.Net.WebException] {
            if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        }
        if ($status -ne 0 -and $status -ne 429 -and $status -lt 500) { return @{ status = $status; text = ''; bytes = $null; json = $null } }
        if ($try -eq 1) { Start-Sleep -Seconds 5 }
    }
    return @{ status = $status; text = ''; bytes = $null; json = $null }
}
function Get-SavedToken {
    if (-not (Test-Path -LiteralPath $TokenFile)) { return '' }
    try {
        $enc = ([System.IO.File]::ReadAllText($TokenFile)).Trim()
        $ss = ConvertTo-SecureString -String $enc
        $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
        try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
    } catch { return '' }
}
# 'active', or why not ('none' = no answer from Cloudflare).
function Test-TokenWorks([string]$token) {
    $r = Invoke-Cf 'user/tokens/verify' $token
    if ($r.status -eq 0) { return 'none' }
    if ($r.status -eq 200 -and $r.json -and $r.json.success -and $r.json.result -and [string]$r.json.result.status -eq 'active') { return 'active' }
    if ($r.status -eq 200 -and $r.json -and $r.json.result -and $r.json.result.status) { return ('κατάσταση ' + [string]$r.json.result.status) }
    return ('HTTP {0}' -f $r.status)
}
function Read-Clip {
    if ($ClipboardFile) {
        if (Test-Path -LiteralPath $ClipboardFile) { return ([System.IO.File]::ReadAllText($ClipboardFile)).Trim() }
        return ''
    }
    try { $c = Get-Clipboard -Raw; if ($null -eq $c) { return '' }; return ([string]$c).Trim() } catch { return '' }
}
# Every page of a list (Cloudflare gives result_info.total_pages); stops at 50 pages.
function Get-AllPages([string]$path, [string]$sep) {
    $pages = New-Object System.Collections.Generic.List[object]
    for ($pg = 1; $pg -le 50; $pg++) {
        $r = Invoke-Cf ('{0}{1}page={2}' -f $path, $sep, $pg) $script:Token
        $pages.Add($r)
        if ($r.status -ne 200 -or -not $r.json) { break }
        $total = 1
        if ($r.json.result_info -and $r.json.result_info.total_pages) { $total = [int]$r.json.result_info.total_pages }
        if ($pg -ge $total) { break }
    }
    return ,($pages.ToArray())
}

Write-Host ''
$mode = 'ΕΛΕΓΧΟΣ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ'
if ($Apply -and $Step -eq 'token') { $mode = 'ΚΛΕΙΔΙ ΑΝΑΓΝΩΣΗΣ (με έγκριση)' }
if ($Apply -and $Step -eq 'export') { $mode = 'ΑΝΤΙΓΡΑΦΟ ΡΥΘΜΙΣΕΩΝ CLOUDFLARE ΣΤΟΝ ΔΙΣΚΟ (με έγκριση)' }
Say ('Gear World Cloudflare - βήμα {0} - {1}' -f $Step, $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
Say 'Το Cloudflare μόνο διαβάζεται (μόνο GET): καμία ρύθμιση, κανένα site και καμία βάση δεν αλλάζει.'

# 1. The token
$saved = Get-SavedToken
$state = 'missing'
if ($saved) { $state = Test-TokenWorks $saved }
if ($Step -eq 'token') {
    if ($state -eq 'active' -and -not $Replace) {
        $script:Token = $saved
        Say ('Κλειδί ανάγνωσης Cloudflare: υπάρχει ήδη σε αυτόν τον υπολογιστή και δουλεύει (κρυπτογραφημένο στο {0}): ΕΝΤΑΞΕΙ' -f $TokenFile) 'Cyan'
        Finish 0
    }
    if ($state -eq 'none') { Say 'ΠΡΟΒΛΗΜΑ: το Cloudflare δεν απαντά (δίκτυο;). Δεν άλλαξε τίποτα. Ξανατρέξε την εντολή σε λίγο.' 'Yellow'; Finish 4 }
    if (-not $Apply) {
        if ($state -eq 'missing') { Say 'Δεν υπάρχει ακόμα κλειδί ανάγνωσης Cloudflare σε αυτόν τον υπολογιστή.' 'Yellow' }
        else { Say ('Το κλειδί που υπάρχει δεν δουλεύει ({0}).' -f $state) 'Yellow' }
        Say ('Μόνο έλεγχος: για να μπει, η ίδια εντολή με -Apply -Approve ''{0}''.' -f $PhraseToken)
        Finish 3
    }
    Test-Phrase $PhraseToken
    $start = Read-Clip
    Say ''
    Say 'ΤΩΡΑ, στη σελίδα του Cloudflare που ανοίγει (αν δεν ανοίξει: https://dash.cloudflare.com/profile/api-tokens):' 'Cyan'
    Say '  1. Create Token  ->  στη γραμμή «Read all resources» πάτα  Use template'
    Say '  2. Continue to summary  ->  Create Token'
    Say '  3. Πάτα το κουμπί Copy δίπλα στο κλειδί. Το παίρνω μόνο μου από το πρόχειρο - δεν χρειάζεται να το γράψεις πουθενά.'
    Say ('Περιμένω έως {0} λεπτά...' -f [int][Math]::Ceiling($WaitSec / 60.0))
    if (-not $ClipboardFile) { try { Start-Process $TokenPage } catch { } }
    $deadline = (Get-Date).AddSeconds($WaitSec)
    $got = ''
    $tried = @{}
    while ((Get-Date) -lt $deadline) {
        $c = Read-Clip
        # Only what is copied while it waits (not what was on the clipboard before), of the form of a Cloudflare token and
        # not a UUID (an Awin key has that form): nothing else from the clipboard is used or kept.
        if ($c -and $c -ne $start -and $c -match $TokenRx -and $c -notmatch $UuidRx -and -not $tried.ContainsKey($c)) {
            $tried[$c] = $true
            $script:Token = $c
            $v = Test-TokenWorks $c
            if ($v -eq 'active') { $got = $c; break }
            Say ('Αυτό που αντέγραψες δεν είναι ενεργό κλειδί του Cloudflare ({0}). Πάτα Copy στο νέο κλειδί.' -f $v) 'Yellow'
        }
        Start-Sleep -Milliseconds 700
    }
    if (-not $got) {
        Say 'Δεν ήρθε ενεργό κλειδί από το πρόχειρο μέσα στον χρόνο: δεν σώθηκε τίποτα. Ξανατρέξε την εντολή όταν έχεις ανοιχτή τη σελίδα του κλειδιού.' 'Yellow'
        Finish 3
    }
    if (-not (Test-Path -LiteralPath $SecretDir)) { New-Item -ItemType Directory -Path $SecretDir -Force | Out-Null }
    $ss = ConvertTo-SecureString -String $got -AsPlainText -Force
    [System.IO.File]::WriteAllText($TokenFile, (ConvertFrom-SecureString -SecureString $ss), (New-Object System.Text.UTF8Encoding($false)))
    if ((Get-SavedToken) -ne $got) { Say 'ΠΡΟΒΛΗΜΑ: το κλειδί δεν σώθηκε σωστά. Στείλε στο Claude αυτή την αναφορά.' 'Yellow'; Finish 13 }
    # The token leaves the clipboard (the report goes there next anyway).
    if ($ClipboardFile) { [System.IO.File]::WriteAllText($ClipboardFile, '') } else { try { if ((Read-Clip) -eq $got) { Set-Clipboard -Value ' ' } } catch { } }
    Say ('Κλειδί ανάγνωσης Cloudflare: σώθηκε κρυπτογραφημένο, μόνο για αυτόν τον χρήστη των Windows ({0}): ΕΝΤΑΞΕΙ' -f $TokenFile) 'Cyan'
    $state = 'active'
    $saved = $got
}
if ($state -eq 'none') { Say 'ΠΡΟΒΛΗΜΑ: το Cloudflare δεν απαντά (δίκτυο;). Δεν γράφτηκε τίποτα. Ξανατρέξε την εντολή σε λίγο.' 'Yellow'; Finish 4 }
if ($state -ne 'active') {
    if ($state -eq 'missing') { Say 'Δεν υπάρχει κλειδί ανάγνωσης Cloudflare σε αυτόν τον υπολογιστή: πρώτα το βήμα token. Δεν γράφτηκε τίποτα.' 'Yellow' }
    else { Say ('Το κλειδί ανάγνωσης Cloudflare δεν δουλεύει ({0}): το βήμα token με -Replace φτιάχνει νέο. Δεν γράφτηκε τίποτα.' -f $state) 'Yellow' }
    Finish 3
}
$script:Token = $saved
if ($Step -ne 'token') { Say 'Κλειδί ανάγνωσης Cloudflare: δουλεύει: ΕΝΤΑΞΕΙ' 'Cyan' }

# 2. What the token can read: the account and the zones.
$acc = Invoke-Cf 'accounts?per_page=50' $script:Token
$accounts = @()
if ($acc.status -eq 200 -and $acc.json) { $accounts = @($acc.json.result) }
$zonePages = Get-AllPages 'zones?per_page=50' '&'
$zones = New-Object System.Collections.Generic.List[object]
$zonesOk = $true
foreach ($p in $zonePages) {
    if ($p.status -ne 200 -or -not $p.json) { $zonesOk = $false; continue }
    foreach ($z in @($p.json.result)) { if ($z -and $z.name -and ([string]$z.name) -match '^[a-z0-9][a-z0-9.\-]{1,250}$') { $zones.Add($z) } }
}
if (-not $zonesOk -or $zones.Count -eq 0) {
    Say 'ΠΡΟΒΛΗΜΑ: το κλειδί δεν διαβάζει τα domains (ζώνες) του Cloudflare. Φτιάξε το κλειδί από το πρότυπο «Read all resources» και ξανατρέξε το βήμα token με -Replace.' 'Yellow'
    Finish 3
}
Say ('Λογαριασμοί: {0} · domains: {1} ({2})' -f $accounts.Count, $zones.Count, ((@($zones | ForEach-Object { $_.name }) | Sort-Object) -join ', '))
if ($Step -eq 'token') { Finish 0 }
if ($Step -eq 'check') {
    Say ('Το βήμα export θα έγραφε, για κάθε domain: DNS (και ως αρχείο ζώνης), ρυθμίσεις, DNSSEC, κανόνες, Worker routes· και για τον λογαριασμό: Worker domains, Workers, βάσεις D1. Μόνο έλεγχος: δεν γράφτηκε τίποτα.')
    Finish 0
}

# 3. export: the target is an existing backup folder on a drive that is not the Windows drive.
if (-not $Target) { Say 'Λείπει ο φάκελος του backup (-Target, π.χ. D:\GearWorldBackup-2026-11-12). Δεν γράφτηκε τίποτα.' 'Yellow'; Finish 2 }
if ($Target -notmatch '^[A-Za-z]:\\[^%!"*?<>|]+$') { Say 'Ο φάκελος του backup πρέπει να είναι πλήρης διαδρομή όπως D:\GearWorldBackup-2026-11-12. Δεν γράφτηκε τίποτα.' 'Yellow'; Finish 2 }
$Target = $Target.TrimEnd('\')
$letter = (Split-Path -Qualifier $Target).TrimEnd(':').ToUpper()
$sysLetter = ([string]$env:SystemDrive).TrimEnd(':').ToUpper()
if (-not (Test-Path -LiteralPath ($letter + ':\'))) { Say ('ΠΡΟΒΛΗΜΑ: δεν βρίσκω τον δίσκο {0}:. Σύνδεσε τον εξωτερικό δίσκο και ξανατρέξε την εντολή. Δεν γράφτηκε τίποτα.' -f $letter) 'Yellow'; Finish 2 }
if ($letter -eq $sysLetter -and -not $AllowSystemDrive) { Say ('ΠΡΟΒΛΗΜΑ: ο {0}: είναι ο δίσκος των Windows, όχι ο εξωτερικός. Δεν γράφτηκε τίποτα.' -f $letter) 'Yellow'; Finish 2 }
if ((Split-Path -Leaf $Target) -notmatch '^GearWorldBackup') { Say 'ΠΡΟΒΛΗΜΑ: γράφω μόνο σε φάκελο backup με όνομα GearWorldBackup... Δεν γράφτηκε τίποτα.' 'Yellow'; Finish 2 }
if (-not (Test-Path -LiteralPath (Join-Path $Target 'README-RESTORE.txt'))) { Say ('ΠΡΟΒΛΗΜΑ: ο {0} δεν είναι φάκελος backup (λείπει το README-RESTORE.txt). Δεν γράφτηκε τίποτα.' -f $Target) 'Yellow'; Finish 2 }
$phraseExport = 'ΕΓΚΡΙΝΩ BACKUP {0}' -f $letter
if (-not $Apply) {
    Say ('Θα γραφόταν στο {0}\cloudflare\<ημερομηνία_ώρα>\: {1} domains και ο λογαριασμός. Μόνο έλεγχος: δεν γράφτηκε τίποτα. Για να γραφτεί: -Apply -Approve ''{2}''.' -f $Target, $zones.Count, $phraseExport)
    Finish 0
}
Test-Phrase $phraseExport
$outRoot = Join-Path (Join-Path $Target 'cloudflare') (Get-Date -Format 'yyyy-MM-dd_HHmm')
New-Item -ItemType Directory -Path $outRoot -Force | Out-Null
Say ('Φάκελος: {0}' -f $outRoot)
function Save-Part([string]$dir, [string]$name, $resp, [bool]$needed, [string]$what) {
    if ($resp.status -eq 200 -and $null -ne $resp.bytes) {
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        [System.IO.File]::WriteAllBytes((Join-Path $dir $name), [byte[]]$resp.bytes)
        return $true
    }
    if ($resp.status -eq 403) {
        if ($needed) { $script:Problems++; Say ('    ΠΡΟΒΛΗΜΑ: {0}: δεν επιτρέπεται με αυτό το κλειδί (λείπει δικαίωμα ανάγνωσης)' -f $what) 'Yellow' }
        else { $script:Warnings++; Say ('    ΠΡΟΣΟΧΗ: {0}: δεν επιτρέπεται με αυτό το κλειδί' -f $what) 'Yellow' }
        return $false
    }
    if (-not $needed -and ($resp.status -eq 400 -or $resp.status -eq 404)) { return $false }
    $script:Problems++
    Say ('    ΠΡΟΒΛΗΜΑ: {0}: δεν διαβάστηκε (HTTP {1})' -f $what, $resp.status) 'Yellow'
    return $false
}
function Save-Pages([string]$dir, [string]$prefix, $pages, [bool]$needed, [string]$what) {
    $n = 0
    $i = 0
    foreach ($p in $pages) {
        $i++
        if (Save-Part $dir ('{0}-{1}.json' -f $prefix, $i) $p $needed $what) { if ($p.json) { $n += @($p.json.result).Count } }
    }
    return $n
}

# The account: Worker domains (which domain goes to which Worker), the Workers, the D1 databases.
$accDir = Join-Path $outRoot '_account'
[void](Save-Part $accDir 'accounts.json' $acc $true 'λογαριασμός')
$accountLine = '  Λογαριασμός:'
foreach ($a in $accounts) {
    if (-not $a.id -or ([string]$a.id) -notmatch '^[0-9a-fA-F]{32}$|^[A-Za-z0-9_\-]{1,64}$') { continue }
    $aid = [string]$a.id
    $wdr = Invoke-Cf ('accounts/{0}/workers/domains' -f $aid) $script:Token
    $wd = 0
    if (Save-Part $accDir 'workers-domains.json' $wdr $true 'Worker domains') { $wd = @($wdr.json.result).Count }
    $ws = Invoke-Cf ('accounts/{0}/workers/scripts' -f $aid) $script:Token
    $wsN = 0
    if (Save-Part $accDir 'workers-scripts.json' $ws $false 'Workers (ονόματα)') { $wsN = @($ws.json.result).Count }
    $d1 = Save-Pages $accDir 'd1-databases' (Get-AllPages ('accounts/{0}/d1/database?per_page=100' -f $aid) '&') $false 'βάσεις D1 (ονόματα)'
    $accountLine += (' Worker domains {0}, Workers {1}, βάσεις D1 {2}' -f $wd, $wsN, $d1)
}
Say $accountLine
$zoneSaved = 0
foreach ($z in ($zones | Sort-Object { $_.name })) {
    $zid = [string]$z.id
    $zdir = Join-Path $outRoot ([string]$z.name)
    $before = $script:Problems
    $dnsN = Save-Pages $zdir 'dns' (Get-AllPages ('zones/{0}/dns_records?per_page=500' -f $zid) '&') $true 'DNS'
    [void](Save-Part $zdir 'dns.bind' (Invoke-Cf ('zones/{0}/dns_records/export' -f $zid) $script:Token) $true 'DNS (αρχείο ζώνης)')
    $set = Invoke-Cf ('zones/{0}/settings' -f $zid) $script:Token
    $setN = 0
    if (Save-Part $zdir 'settings.json' $set $true 'ρυθμίσεις') { $setN = @($set.json.result).Count }
    $sec = Invoke-Cf ('zones/{0}/dnssec' -f $zid) $script:Token
    $secState = '-'
    if (Save-Part $zdir 'dnssec.json' $sec $false 'DNSSEC') { if ($sec.json -and $sec.json.result) { $secState = [string]$sec.json.result.status } }
    # The zone's own rulesets (security, rate limits, redirects, headers ...); Cloudflare's managed sets are only named.
    $rsList = Invoke-Cf ('zones/{0}/rulesets' -f $zid) $script:Token
    $rules = 0
    $phases = New-Object System.Collections.Generic.List[string]
    if (Save-Part $zdir 'rulesets.json' $rsList $true 'κανόνες (λίστα)') {
        foreach ($rs in @($rsList.json.result)) {
            if (-not $rs -or [string]$rs.kind -ne 'zone' -or ([string]$rs.id) -notmatch '^[A-Za-z0-9_\-]{1,64}$') { continue }
            $ph = ([string]$rs.phase) -replace '[^A-Za-z0-9_]', '_'
            if (-not $ph) { $ph = 'ruleset' }
            $one = Invoke-Cf ('zones/{0}/rulesets/{1}' -f $zid, $rs.id) $script:Token
            if (Save-Part (Join-Path $zdir 'rulesets') ($ph + '.json') $one $true ('κανόνες ' + $ph)) {
                $c = 0
                if ($one.json -and $one.json.result -and $one.json.result.rules) { $c = @($one.json.result.rules).Count }
                $rules += $c
                $phases.Add(('{0} {1}' -f $ph, $c))
            }
        }
    }
    $pr = Invoke-Cf ('zones/{0}/pagerules' -f $zid) $script:Token
    [void](Save-Part $zdir 'pagerules.json' $pr $false 'Page Rules')
    $rt = Invoke-Cf ('zones/{0}/workers/routes' -f $zid) $script:Token
    $rtN = 0
    if (Save-Part $zdir 'workers-routes.json' $rt $true 'Worker routes') { $rtN = @($rt.json.result).Count }
    [void](Save-Part $zdir 'managed-headers.json' (Invoke-Cf ('zones/{0}/managed_headers' -f $zid) $script:Token) $false 'managed headers')
    [void](Save-Part $zdir 'bot-management.json' (Invoke-Cf ('zones/{0}/bot_management' -f $zid) $script:Token) $false 'bot management')
    $mark = 'ΕΝΤΑΞΕΙ'
    if ($script:Problems -gt $before) { $mark = 'ΠΡΟΒΛΗΜΑ' } else { $zoneSaved++ }
    $phText = ''
    if ($phases.Count -gt 0) { $phText = ' (' + ($phases -join ', ') + ')' }
    Say ('  {0}: DNS {1}, ρυθμίσεις {2}, DNSSEC {3}, κανόνες {4}{5}, Worker routes {6}: {7}' -f $z.name, $dnsN, $setN, $secState, $rules, $phText, $rtN, $mark)
}
$readme = @(
    'Gear World - Cloudflare settings, read on ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') + ' by tools/gw-cloudflare-export.ps1 (lessons L120).',
    'Only read from Cloudflare (GET). No token, no secret values: Worker secrets are never readable through the API.',
    '',
    'How to get them back (with Claude, in the chat «4 · Sites & Κώδικας»):',
    '  DNS: Cloudflare dashboard -> the domain -> DNS -> Records -> Import and Export -> Import -> <domain>\dns.bind.',
    '  Rules (security, rate limits, redirects, headers): <domain>\rulesets\<phase>.json, re-created by Claude through the API.',
    '  Settings (SSL/TLS, HSTS, Always Use HTTPS ...): <domain>\settings.json; DNSSEC: dnssec.json.',
    '  Which domain goes to which Worker: _account\workers-domains.json and <domain>\workers-routes.json.',
    '  The Worker code is on GitHub (and in github\ of this backup); the databases are in d1\ of this backup.'
)
[System.IO.File]::WriteAllText((Join-Path $outRoot 'README-CLOUDFLARE.txt'), ($readme -join "`r`n"), (New-Object System.Text.UTF8Encoding($true)))
Say ('Domains που γράφτηκαν πλήρως: {0} από {1}.' -f $zoneSaved, $zones.Count)
[System.IO.File]::WriteAllText((Join-Path $outRoot 'summary.txt'), (Hide-Text ($L -join "`r`n")), (New-Object System.Text.UTF8Encoding($true)))
if ($script:Problems -gt 0) { Say ('ΤΕΛΟΣ ΜΕ {0} ΠΡΟΒΛΗΜΑΤΑ: τα υπόλοιπα γράφτηκαν. Στείλε στο Claude αυτή την αναφορά.' -f $script:Problems) 'Yellow'; Finish 12 }
Say ('Όλες οι ρυθμίσεις Cloudflare γράφτηκαν στον δίσκο {0}: (προσοχές: {1}): ΕΝΤΑΞΕΙ' -f $letter, $script:Warnings) 'Cyan'
Finish 0
