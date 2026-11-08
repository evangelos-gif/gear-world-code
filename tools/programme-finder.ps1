<#
.SYNOPSIS
  READ-ONLY: affiliate programmes that are live right now and that you have not joined yet, on Awin and CJ, by topic.

.DESCRIPTION
  Why (8 Nov 2026): three Awin profiles we had found on public pages (Musclefood 11002, Farmison 115479,
  Hampers.co.uk 29169) all said "The account you are trying to view is not active". This list comes straight from the
  Awin and CJ APIs instead.

  READ-ONLY. There is no -Apply: the tool never joins or applies to anything and never changes a setting on Awin or CJ.
  Only GET calls, only to api.awin.com and advertiser-lookup.api.cj.com.

  -Topic food,music,outdoor,camera,fishing   one or more topics (default food); -Keywords 'a,b,c' for your own words.
  Awin (Publisher API, publisher -PublisherId, about 20 calls a minute, so the tool waits -PauseMs between calls):
    GET /publishers/<id>/programmes?relationship=notjoined&countryCode=GB, and relationship=joined, pending,
    suspended, rejected (to show what is already joined or pending); then
    GET /publishers/<id>/programmedetails?advertiserId=<id>&relationship=notjoined for the best -MaxDetails matches
    (commission range, approval %, validation days), and relationship=any for the suggested -CheckIds that are in no list.
    Only programmes that are active (not offline) and for GB (region GB, GBP or a .uk address) are listed.
  CJ (advertiser lookup, REST): advertiser-ids=notjoined and joined with the keywords of each topic, and Ocado by name.
    CJ needs your CJ account number (requestor CID): -Cid, or the file <home>\gear-world-secrets\cj-cid.txt if it is
    there. Without it, or without the CJ token, CJ is skipped and the report says why.
  Tokens: the Awin API token of tools/awin-sales.ps1 (<home>\gear-world-secrets\awin-api-token.dat) and the CJ token of
  tools/cj-feed-download.ps1 (<home>\gear-world-secrets\cj-token.dat), both kept encrypted for your Windows user
  (DPAPI). A token is sent only in the Authorization header and never printed, written to the report, the clipboard or
  the repo. A missing or refused (401) Awin token: the report says so and what to do. -NewToken asks for a new Awin key
  here in PowerShell (never in the chat) and keeps it encrypted only after Awin accepts it.
  Report: <home>\gear-world-reports\PROGRAMME_FINDER_<topic>_<yyyyMMdd-HHmmss>.txt (UTF-8, also copied to the clipboard).
  The parsing, matching and report text are in tools/programme-finder.mjs (Node.js).
#>
param(
    [string[]]$Topic = @('food'),
    [string]$Keywords = '',
    [string]$PublisherId = '3057233',
    [string]$Cid = '',
    [string]$CheckIds = '11002,115479,29169',
    [int]$MaxDetails = 40,
    [int]$MaxRows = 25,
    [int]$CjMaxPages = 2,
    [int]$PauseMs = 3100,
    [int]$RetryWaitSec = 65,
    [switch]$NewToken,
    [string]$TokenEnv = '',
    [string]$TokenFile = '',
    [string]$CjTokenFile = '',
    [string]$CidFile = '',
    [string]$AwinApi = 'https://api.awin.com',
    [string]$CjApi = 'https://advertiser-lookup.api.cj.com',
    [string]$OutDir = '',
    [string]$ClipboardFile = '',
    [switch]$KeepData,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# HTTPS with TLS 1.2: Windows PowerShell 5.1 may still offer only older TLS, which the APIs refuse (L106).
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
$script:mjs = Join-Path (Join-Path $repo 'tools') 'programme-finder.mjs'
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$secretsDir = Join-Path $HOME 'gear-world-secrets'
if (-not $TokenFile) { $TokenFile = Join-Path $secretsDir 'awin-api-token.dat' }
if (-not $CjTokenFile) { $CjTokenFile = Join-Path $secretsDir 'cj-token.dat' }
if (-not $CidFile) { $CidFile = Join-Path $secretsDir 'cj-cid.txt' }
$TokenPage = 'https://ui.awin.com/awin-api'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$script:secret = ''
$script:cjSecret = ''
$script:reportName = 'food'
$script:work = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-programme-finder-' + $stamp + '-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
$script:awinCalls = 0
$script:cjCalls = 0
$script:lastBody = ''

$L = New-Object System.Collections.Generic.List[string]
# The same masking as tools/awin-sales.ps1 (Awin) and tools/cj-feed-download.ps1 (CJ).
function Mask([string]$s) {
    if ($script:secret) { $s = $s.Replace($script:secret, '***') }
    if ($script:cjSecret -and $script:cjSecret.Length -ge 6) { $s = $s.Replace($script:cjSecret, '***') }
    return [regex]::Replace($s, '(?i)(accessToken=|Bearer\s+)[^&\s]+', '$1***')
}
function Say([string]$t, [string]$c = '') { $t = Mask $t; $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('PROGRAMME_FINDER_{0}_{1}.txt' -f $script:reportName, $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('PROGRAMME_FINDER_{0}_{1}_{2}.txt' -f $script:reportName, $stamp, $n); $n++ }
    $text = Mask ($L -join "`r`n")
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if ($ClipboardFile) { [System.IO.File]::WriteAllText($ClipboardFile, $text, (New-Object System.Text.UTF8Encoding($false))) }
    elseif (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    $script:secret = ''
    $script:cjSecret = ''
    if (-not $KeepData -and (Test-Path -LiteralPath $script:work)) { Remove-Item -LiteralPath $script:work -Recurse -Force -ErrorAction SilentlyContinue }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if ($ClipboardFile -or -not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
    exit $code
}

# One GET into a file (raw bytes, so names keep their letters). The token goes ONLY in the Authorization header.
# Returns 0 when it worked, else the HTTP status (-1: no answer). 429 (too many calls): waits once and tries again.
function Get-Api([string]$Url, [string]$Token, [string]$File) {
    $script:lastBody = ''
    for ($try = 1; $try -le 2; $try++) {
        try {
            Invoke-WebRequest -UseBasicParsing -Method Get -Uri $Url -Headers @{ Authorization = ('Bearer ' + $Token) } -OutFile $File -TimeoutSec 120
            return 0
        } catch {
            $status = -1
            $resp = $null
            try { $resp = $_.Exception.Response } catch { }
            if ($resp) { try { $status = [int]$resp.StatusCode } catch { } }
            $body = ''
            try { if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $body = [string]$_.ErrorDetails.Message } } catch { }
            if (-not $body -and $status -lt 0) { $body = [string]$_.Exception.Message }
            $body = Mask (($body -replace '<[^>]+>', ' ' -replace '\s+', ' ').Trim())
            if ($body.Length -gt 200) { $body = $body.Substring(0, 200) }
            $script:lastBody = $body
            if (Test-Path -LiteralPath $File) { Remove-Item -LiteralPath $File -Force -ErrorAction SilentlyContinue }
            if ($status -eq 429 -and $try -eq 1) {
                Write-Host ('Πολλές κλήσεις μαζί (429): περιμένω {0} δευτερόλεπτα και ξαναδοκιμάζω...' -f $RetryWaitSec) -ForegroundColor Yellow
                Start-Sleep -Seconds $RetryWaitSec
                continue
            }
            return $status
        }
    }
    return 429
}

# Awin: about 20 calls a minute per user, so a pause before every call but the first.
function Get-Awin([string]$PathAndQuery, [string]$File) {
    if ($script:awinCalls -gt 0) { Start-Sleep -Milliseconds $PauseMs }
    $script:awinCalls++
    return (Get-Api ($AwinApi.TrimEnd('/') + $PathAndQuery) $script:secret $File)
}

# The Node.js part (parsing, matching, report). It answers one line of ASCII JSON and never writes to stderr.
function Invoke-Finder([string[]]$NodeArgs) {
    $oldEnc = $null
    try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
    try {
        $o = @(& node $script:mjs @NodeArgs)
    } finally {
        if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } }
    }
    $line = [string](($o | Where-Object { "$_".StartsWith('{') }) | Select-Object -Last 1)
    if (-not $line) { return $null }
    try { return ($line | ConvertFrom-Json) } catch { return $null }
}

function Show-AwinFix {
    Say 'Τι κάνεις (μία φορά· το κλειδί ΔΕΝ το στέλνεις ποτέ στο chat):' 'Yellow'
    Say ('  1. Άνοιξε {0} , βάλε τον κωδικό σου του Awin, πάτα «Show my API token» και αντέγραψέ το.' -f $TokenPage)
    Say '  2. Τρέξε την ίδια εντολή με -NewToken στο τέλος. Το κλειδί το επικολλάς ΕΔΩ στο PowerShell (δεν φαίνεται) και φυλάγεται κρυπτογραφημένο σε αυτόν τον υπολογιστή μόνο αν το δεχτεί το Awin.'
    Say '  3. Το ίδιο νέο κλειδί θέλει και ο Worker των πωλήσεων: το υπάρχον εργαλείο awin-setup -Step token (φράση ΕΓΚΡΙΝΩ AWIN TOKEN). Εκείνο το βάζει μόνο στο Cloudflare και όχι σε αυτόν τον υπολογιστή, άρα δεν αρκεί μόνο του για αυτό εδώ το εργαλείο.'
}

# ---------------- start ----------------
Write-Host ''
Say 'Προγράμματα Awin και CJ που δεν έχεις ακόμα - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (καμία αίτηση, καμία αλλαγή ρύθμισης)' 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
$awinHost = ''
$cjHost = ''
try { $awinHost = ([uri]$AwinApi).Host; $cjHost = ([uri]$CjApi).Host } catch { }
if ($awinHost -ne 'api.awin.com' -and $awinHost -ne '127.0.0.1') { Say 'Μη αναμενόμενη διεύθυνση του Awin API.' 'Red'; Finish 2 }
if ($cjHost -ne 'advertiser-lookup.api.cj.com' -and $cjHost -ne '127.0.0.1') { Say 'Μη αναμενόμενη διεύθυνση του CJ API.' 'Red'; Finish 2 }
if ($PublisherId -notmatch '^\d{3,12}$') { Say 'Λάθος αριθμός publisher του Awin.' 'Red'; Finish 2 }
if ($MaxDetails -lt 0 -or $MaxDetails -gt 200 -or $MaxRows -lt 1 -or $MaxRows -gt 500 -or $CjMaxPages -lt 1 -or $CjMaxPages -gt 5 -or $PauseMs -lt 0 -or $PauseMs -gt 60000 -or $RetryWaitSec -lt 0 -or $RetryWaitSec -gt 300) {
    Say 'Λάθος όριο (-MaxDetails 0-200, -MaxRows 1-500, -CjMaxPages 1-5, -PauseMs 0-60000, -RetryWaitSec 0-300).' 'Red'; Finish 2
}
$topicNames = @(@($Topic) | ForEach-Object { ([string]$_) -split '[,\s]+' } | Where-Object { $_ } | ForEach-Object { $_.Trim().ToLowerInvariant() })
if ($Keywords -and -not $PSBoundParameters.ContainsKey('Topic')) { $topicNames = @() }
foreach ($t in $topicNames) { if ($t -notmatch '^[a-z]{2,20}$') { Say ('Λάθος θέμα: {0}' -f $t) 'Red'; Finish 2 } }
if ($Keywords -match '"') { Say 'Οι λέξεις (-Keywords) δεν μπορούν να έχουν εισαγωγικά.' 'Red'; Finish 2 }
$checkList = (@($CheckIds -split '[,\s]+' | Where-Object { $_ }) | ForEach-Object { if ($_ -notmatch '^\d{1,9}$') { Say ('Λάθος αριθμός προγράμματος: {0}' -f $_) 'Red'; Finish 2 }; $_ }) -join ','
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js σε αυτόν τον υπολογιστή.' 'Red'; Finish 3 }
if (-not (Test-Path -LiteralPath $script:mjs)) { Say 'Λείπει το tools/programme-finder.mjs από αυτή την έκδοση.' 'Red'; Finish 3 }
New-Item -ItemType Directory -Path $script:work -Force | Out-Null

$topicArgs = @()
if ($topicNames.Count -gt 0) { $topicArgs += @('--topics', ($topicNames -join ',')) }
if ($Keywords) { $topicArgs += @('--keywords', $Keywords) }
$plan = Invoke-Finder (@('plan') + $topicArgs)
if ($null -eq $plan) { Say 'Το Node.js δεν απάντησε (programme-finder.mjs). Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 10 }
if (-not $plan.ok) {
    $err = [string]$plan.error
    if ($err -like 'unknown-topic:*' -or $err -eq 'no-topic') { Say ('Άγνωστο θέμα: {0}. Θέματα: {1}' -f ($err -replace '^unknown-topic:', ''), (@($plan.known) -join ', ')) 'Red' }
    else { Say ('Λάθος λέξεις στο -Keywords ({0}): 2-40 γράμματα ή αριθμοί η καθεμία, χωρισμένες με κόμμα, έως 30.' -f $err) 'Red' }
    Finish 2
}
$topics = @($plan.topics)
$script:reportName = (@($topics | ForEach-Object { [string]$_.key }) -join '-')
foreach ($t in $topics) { Say ('Θέμα {0}: {1}' -f $t.key, (@($t.terms) -join ', ')) }
$estimate = 5 + $MaxDetails + 3 + ($topics.Count * 2) + 2
$minutes = [int][Math]::Max(1, [Math]::Ceiling($estimate * $PauseMs / 60000.0))
$minWord = 'λεπτά'
if ($minutes -eq 1) { $minWord = 'λεπτό' }
Say ('Θα κάνω έως περίπου {0} κλήσεις GET, αργά λόγω του ορίου του Awin (20 το λεπτό): περίπου {1} {2}. Μην κλείσεις το παράθυρο.' -f $estimate, $minutes, $minWord)
Say ''

# ================= Awin =================
$awinState = 'ok'
$newSec = $null
if ($NewToken) {
    $plain = ''
    if ($TokenEnv) {
        # Tests only: the new key from an environment variable.
        $plain = [string][System.Environment]::GetEnvironmentVariable($TokenEnv)
        if ($plain) { $newSec = ConvertTo-SecureString $plain -AsPlainText -Force }
    } else {
        Write-Host ''
        Write-Host 'Χρειάζομαι το κλειδί API του Awin (είναι άλλο από το κλειδί των feeds). ΔΕΝ το στέλνεις στο chat.' -ForegroundColor Yellow
        Write-Host ('Άνοιξε {0} , βάλε τον κωδικό σου του Awin, πάτα «Show my API token» και αντέγραψέ το.' -f $TokenPage)
        Write-Host 'Θα φυλαχτεί κρυπτογραφημένο μόνο για τον χρήστη σου στα Windows, και μόνο αν το δεχτεί το Awin.'
        $newSec = Read-Host 'Κλειδί API του Awin' -AsSecureString
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($newSec)
        try { $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
    $script:secret = ([string]$plain).Trim()
    $plain = ''
    if ($script:secret -notmatch '^[A-Za-z0-9\-]{16,80}$') { $awinState = 'missing'; $newSec = $null; Say '🔴 ΠΡΟΒΛΗΜΑ: αυτό δεν μοιάζει με κλειδί API του Awin. Δεν φυλάχτηκε τίποτα.' 'Red'; Show-AwinFix }
} elseif (Test-Path -LiteralPath $TokenFile) {
    # The same decrypting as tools/awin-sales.ps1 (DPAPI, this Windows user only).
    try {
        $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($TokenFile).Trim())
        $script:secret = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
    } catch { $script:secret = ''; $awinState = 'unreadable' }
    if ($awinState -eq 'ok' -and $script:secret -notmatch '^[A-Za-z0-9\-]{16,80}$') { $awinState = 'unreadable' }
    if ($awinState -eq 'unreadable') { Say '🔴 ΠΡΟΒΛΗΜΑ: το φυλαγμένο κλειδί API του Awin δεν ανοίγει ή δεν μοιάζει με κλειδί.' 'Red'; Show-AwinFix }
} else {
    $awinState = 'missing'
    Say ('🔴 ΠΡΟΒΛΗΜΑ: δεν βρήκα φυλαγμένο κλειδί API του Awin σε αυτόν τον υπολογιστή ({0}).' -f $TokenFile) 'Red'
    Show-AwinFix
}

if ($awinState -eq 'ok') {
    Write-Host 'Awin: διαβάζω τις λίστες των προγραμμάτων...'
    foreach ($rel in @('notjoined', 'joined', 'pending', 'suspended', 'rejected')) {
        $q = '/publishers/{0}/programmes?relationship={1}' -f $PublisherId, $rel
        if ($rel -eq 'notjoined') { $q += '&countryCode=GB' }
        $code = Get-Awin $q (Join-Path $script:work ('awin-{0}.json' -f $rel))
        if ($code -eq 401 -or $code -eq 403) { $awinState = 'rejected:' + $code; break }
        if ($code -ne 0) { $awinState = 'error:' + $code; break }
        if ($NewToken -and $newSec) {
            # Awin accepted the new key: keep it encrypted, the same way as tools/awin-sales.ps1.
            $dir = Split-Path -Parent $TokenFile
            if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
            [System.IO.File]::WriteAllText($TokenFile, (ConvertFrom-SecureString $newSec), [System.Text.Encoding]::ASCII)
            $newSec = $null
            Say 'Το νέο κλειδί API το δέχτηκε το Awin: φυλάχτηκε κρυπτογραφημένο σε αυτόν τον υπολογιστή (δεν φαίνεται πουθενά).' 'Green'
        }
    }
    if ($awinState -like 'rejected:*') {
        Say ('🔴 ΠΡΟΒΛΗΜΑ: το Awin δεν δέχτηκε το κλειδί API ({0}). Μάλλον είναι το παλιό: το Awin ακύρωσε όλα τα κλειδιά στις 3/11/2026.' -f ($awinState -replace '^rejected:', '')) 'Red'
        if ($NewToken) { Say 'Το κλειδί που έδωσες ΔΕΝ φυλάχτηκε.' 'Red' }
        Show-AwinFix
    } elseif ($awinState -like 'error:*') {
        Say ('🔴 ΠΡΟΒΛΗΜΑ: το Awin δεν έδωσε τη λίστα των προγραμμάτων (απάντηση {0}). Ξανατρέξε σε λίγα λεπτά.' -f ($awinState -replace '^error:', '')) 'Red'
    }
}

$detailsFailed = 0
if ($awinState -eq 'ok') {
    $pickArgs = @('pick', '--dir', $script:work, '--max-details', [string]$MaxDetails) + $topicArgs
    if ($checkList) { $pickArgs += @('--check-ids', $checkList) }
    $pick = Invoke-Finder $pickArgs
    if ($null -eq $pick -or -not $pick.ok) { Say 'Δεν μπόρεσα να διαβάσω τις λίστες του Awin (programme-finder.mjs). Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 10 }
    $det = @($pick.details | Where-Object { $_ })
    Say ('Awin: {0} προγράμματα ταιριάζουν και δεν είσαι μέλος· λεπτομέρειες (προμήθεια, έγκριση) για τα {1} καλύτερα.' -f $pick.matches, $det.Count)
    $i = 0
    foreach ($d in $det) {
        $i++
        $id = [string]$d.id
        $rel = [string]$d.rel
        if ($id -notmatch '^\d{1,12}$' -or $rel -notmatch '^(notjoined|pending)$') { continue }
        Write-Host ('  λεπτομέρειες {0}/{1} (πρόγραμμα {2})...' -f $i, $det.Count, $id)
        $code = Get-Awin ('/publishers/{0}/programmedetails?advertiserId={1}&relationship={2}' -f $PublisherId, $id, $rel) (Join-Path $script:work ('awin-details-{0}.json' -f $id))
        if ($code -eq 401 -or $code -eq 403) { $detailsFailed += ($det.Count - $i + 1); break }
        if ($code -ne 0) { $detailsFailed++ }
    }
    foreach ($c in @($pick.check | Where-Object { $_ })) {
        $id = [string]$c
        if ($id -notmatch '^\d{1,12}$') { continue }
        $f = Join-Path $script:work ('awin-check-{0}.json' -f $id)
        $code = Get-Awin ('/publishers/{0}/programmedetails?advertiserId={1}&relationship=any' -f $PublisherId, $id) $f
        if ($code -ne 0) { [System.IO.File]::WriteAllText((Join-Path $script:work ('awin-check-{0}.err' -f $id)), [string]$code, [System.Text.Encoding]::ASCII) }
    }
}

# ================= CJ =================
$cjState = 'ok'
if (-not (Test-Path -LiteralPath $CjTokenFile)) {
    $cjState = 'no-token'
    Say ('🟡 ΠΡΟΣΟΧΗ: το CJ δεν ελέγχθηκε: δεν υπάρχει φυλαγμένο κλειδί του CJ ({0}). Το φυλάει το εργαλείο cj-feed-download την πρώτη φορά που τρέχει.' -f $CjTokenFile) 'Yellow'
} else {
    # The same decrypting as tools/cj-feed-download.ps1.
    try {
        $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($CjTokenFile).Trim())
        $script:cjSecret = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
    } catch { $script:cjSecret = '' }
    if ($script:cjSecret -notmatch '^[A-Za-z0-9._~+/=-]{10,400}$') { $cjState = 'unreadable'; Say '🟡 ΠΡΟΣΟΧΗ: το CJ δεν ελέγχθηκε: το φυλαγμένο κλειδί του CJ δεν ανοίγει ή δεν μοιάζει με κλειδί.' 'Yellow' }
}
$cids = @()
if ($cjState -eq 'ok') {
    $cidText = $Cid
    if (-not $cidText -and (Test-Path -LiteralPath $CidFile)) { $cidText = ([System.IO.File]::ReadAllText($CidFile)).Trim() }
    $cids = @(([string]$cidText) -split '[,\s]+' | Where-Object { $_ -match '^\d{4,12}$' })
    if ($cids.Count -eq 0) {
        $cjState = 'no-cid'
        Say '🟡 ΠΡΟΣΟΧΗ: το CJ δεν ελέγχθηκε: λείπει ο αριθμός του λογαριασμού σου στο CJ (CID), που το CJ ζητά σε κάθε αναζήτηση (requestor-cid). Το Claude σου δίνει την εντολή με -Cid.' 'Yellow'
    }
}
$script:cjCid = ''
$script:cjCidCodes = ''
$cjBase = $CjApi.TrimEnd('/') + '/v2/advertiser-lookup'
# One CJ advertiser lookup (CJ allows about 25 calls a minute). The first one finds which CID works.
function Get-Cj([string]$Rel, [string]$Extra, [int]$Page, [string]$File) {
    $try = @($script:cjCid)
    if (-not $script:cjCid) { $try = $cids }
    $codes = @()
    foreach ($c in $try) {
        if ($script:cjCalls -gt 0) { Start-Sleep -Milliseconds $PauseMs }
        $script:cjCalls++
        $url = '{0}?requestor-cid={1}&advertiser-ids={2}{3}&page-number={4}&records-per-page=100' -f $cjBase, $c, $Rel, $Extra, $Page
        $code = Get-Api $url $script:cjSecret $File
        if ($code -eq 0) { $script:cjCid = $c; return 0 }
        if ($code -eq 401 -or $script:cjCid) { return $code }
        $tail = $c.Substring([Math]::Max(0, $c.Length - 3))
        Say ('  CJ: ο λογαριασμός CID …{0} δεν δούλεψε ({1}) {2}' -f $tail, $code, $script:lastBody) 'Yellow'
        $codes += [string]$code
    }
    $script:cjCidCodes = $codes -join ','
    return -2
}
if ($cjState -eq 'ok') {
    Write-Host 'CJ: ψάχνω προγράμματα...'
    $stop = $false
    $jobs = @()
    foreach ($t in $topics) {
        foreach ($rel in @('notjoined', 'joined')) { $jobs += @{ key = [string]$t.key; rel = $rel; extra = ('&keywords=' + [uri]::EscapeDataString([string]$t.cj)) } }
    }
    foreach ($rel in @('notjoined', 'joined')) { $jobs += @{ key = 'ocado'; rel = $rel; extra = '&advertiser-name=Ocado'; single = $true } }
    foreach ($j in $jobs) {
        if ($stop) { break }
        $pages = $CjMaxPages
        if ($j.single) { $pages = 1 }
        for ($page = 1; $page -le $pages; $page++) {
            $f = Join-Path $script:work ('cj-{0}-{1}-{2}.xml' -f $j.key, $j.rel, $page)
            if ($j.single) { $f = Join-Path $script:work ('cj-{0}-{1}.xml' -f $j.key, $j.rel) }
            $code = Get-Cj $j.rel $j.extra $page $f
            if ($code -eq 401) { $cjState = 'rejected:401'; $stop = $true; break }
            if ($code -eq -2) { $cjState = 'cid-failed:' + $script:cjCidCodes; $stop = $true; break }
            if ($code -ne 0) { Say ('  🟡 ΠΡΟΣΟΧΗ: το CJ δεν απάντησε για {0} ({1}, σελίδα {2}): {3}' -f $j.key, $j.rel, $page, $code) 'Yellow'; break }
            $m = [regex]::Match([System.IO.File]::ReadAllText($f), 'total-matched="(\d+)"')
            if (-not $m.Success -or [int]$m.Groups[1].Value -le ($page * 100)) { break }
        }
    }
    if ($cjState -like 'rejected:*') { Say '🟡 ΠΡΟΣΟΧΗ: το CJ δεν δέχτηκε το κλειδί (401). Φτιάξε νέο στο https://developers.cj.com/account/personal-access-tokens , σβήσε το αρχείο του κλειδιού και τρέξε το cj-feed-download για να το φυλάξει ξανά.' 'Yellow' }
    if ($cjState -like 'cid-failed:*') { Say '🟡 ΠΡΟΣΟΧΗ: το CJ δεν δέχτηκε κανέναν αριθμό λογαριασμού (CID). Στείλε την αναφορά στο Claude.' 'Yellow' }
}

# ================= report =================
$repFile = Join-Path $script:work 'report.txt'
$rArgs = @('report', '--dir', $script:work, '--awin', $awinState, '--cj', $cjState, '--max-rows', [string]$MaxRows, '--details-failed', [string]$detailsFailed, '--out', $repFile) + $topicArgs
if ($checkList) { $rArgs += @('--check-ids', $checkList) }
if ($script:cjCid) { $rArgs += @('--cid-tail', $script:cjCid.Substring([Math]::Max(0, $script:cjCid.Length - 3))) }
$rep = Invoke-Finder $rArgs
if ($null -eq $rep -or -not $rep.ok -or -not (Test-Path -LiteralPath $repFile)) { Say 'Η αναφορά δεν ολοκληρώθηκε (programme-finder.mjs). Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 10 }
Say ''
foreach ($line in [System.IO.File]::ReadAllLines($repFile, [System.Text.Encoding]::UTF8)) {
    if ($line -match 'ΠΡΟΒΛΗΜΑ|ΠΡΟΣΟΧΗ') { Say $line 'Yellow' } elseif ($line -like '===*') { Say $line 'Cyan' } else { Say $line }
}
Say ''
Say ('Κλήσεις: Awin {0}, CJ {1} (όλες GET, μόνο ανάγνωση).' -f $script:awinCalls, $script:cjCalls)
Say 'Δεν άλλαξε τίποτα: καμία αίτηση και καμία ρύθμιση στο Awin ή στο CJ. Την αίτηση την κάνεις εσύ, από το link κάθε προγράμματος.'
Say 'Επόμενο βήμα: στείλε αυτή την αναφορά στο Claude (Ctrl+V), για να διαλέξουμε μαζί σε ποια προγράμματα αξίζει να κάνεις αίτηση.'
if ($awinState -eq 'ok') { Finish 0 }
if ($awinState -like 'error:*') { Finish 6 }
Finish 4
