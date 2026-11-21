<#
.SYNOPSIS
  bol.com Partnerprogramma (lessons L154, Manager 14 Nov 2026): the keys of the Marketing Catalog API, kept only on
  this PC, and a read-only check that they work.

.DESCRIPTION
  bol.com is the fifth affiliate network (after Awin, CJ, Rakuten and Daisycon): bol.com's own shop, delivery to the
  Netherlands and Belgium (site ID 1559450, gearworldhub.com). Its products come from the Marketing Catalog API
  (https://api.bol.com/marketing/catalog/v1), with a token from https://login.bol.com/token.

  -Step keys    CHANGES ONE FILE ON THIS PC. Without -Apply it only says what will happen. With -Apply and the phrase
                ΕΓΚΡΙΝΩ BOL KEYS it asks for the Client ID and the Client Secret of the bol.com partner account
                (partner.bol.com -> Mijn account -> API toegang -> Client credentials). Neither is shown while you type
                or paste. They are kept encrypted for your Windows user (DPAPI) in
                <home>\gear-world-secrets\bol-api.dat, never on the screen, in a report, on the clipboard, in a Worker
                or in the repo. A file that is already there is kept as bol-api.dat.old-<time> first. No token is asked
                for in this step. Rollback: delete bol-api.dat (or rename the .old file back).
  -Step check   READ-ONLY. ONE token for the whole run (bol.com blocks an address that asks for too many: a token is
                asked for again only when it has run out), then ONE search (-SearchTerm, default
                "Strauss werkschoenen", -Country NL or BE, Accept-Language nl). Shows only how many products bol.com
                found and the first one's name and price. Nothing is saved.
  -Step categories  READ-ONLY (chat 9, 16 Nov 2026). ONE token, ONE call: bol.com's categories with their ids and
                product counts (top level and one level down), to choose the ids of the download. Nothing is saved.
  -Step download  CHANGES ONLY FILES ON THIS PC (the feeds folder). Without -Apply it only shows the plan (no token).
                With -Apply and the phrase ΕΓΚΡΙΝΩ BOL FEED DOWNLOAD: the most popular products of each category
                (-Categories '<id>=<name>,<id>' in the order of the commission, highest first) and of each search
                (-Search 'werkschoenen', optional -SearchCategory <id>), at most -MaxPerCategory (default 1000) each,
                pages of 50, ONE token for the run (again only when it has run out, at most 3), to
                <feeds folder>\BOL_<category>_<country>.csv.gz with the Awin column names and the partner link of site ID
                1559450 (tools/bol-feed.mjs). A product without an offer or without a bol.com page is left out; one EAN
                once in the whole run; no "was" price. The old copy of a file goes to _old\<time> first (rollback: move
                it back). The sites, the databases and the Workers do NOT change; an import is always a separate step
                with ΕΓΚΡΙΝΩ ALL IMPORTS, and for bol.com only after the removal tool and the daily refresh (Manager 15/11).
                -Standard instead of -Categories/-Search (lessons L205): the standard lists of src/lib/bol-lists.js (12
                categories and 2 searches), the same ones the private Worker gear-world-bol-refresh re-reads every day.
  The keys go only to login.bol.com (the token) and the token only to api.bol.com (or the tests' local server).
  Report: <home>\gear-world-reports\BOL_FEED_<STEP>_<time>.txt (copied to the clipboard)
#>
param(
    [ValidateSet('keys', 'check', 'categories', 'download')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$SearchTerm = 'Strauss werkschoenen',
    [ValidateSet('NL', 'BE')]
    [string]$Country = 'NL',
    [string]$Categories = '',
    [string]$Search = '',
    [string]$SearchCategory = '',
    [switch]$Standard,
    [int]$MaxPerCategory = 1000,
    [int]$PauseMs = 300,
    [string]$Archive = '',
    [string]$SecretFile = '',
    [string]$LoginBase = '',
    [string]$ApiBase = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$DefaultSecretFile = Join-Path (Join-Path $HOME 'gear-world-secrets') 'bol-api.dat'
if (-not $SecretFile) { $SecretFile = $DefaultSecretFile }
if (-not $LoginBase) { $LoginBase = 'https://login.bol.com' }
if (-not $ApiBase) { $ApiBase = 'https://api.bol.com' }
$LoginBase = $LoginBase.TrimEnd('/')
$ApiBase = $ApiBase.TrimEnd('/')
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$PhraseKeys = 'ΕΓΚΡΙΝΩ BOL KEYS'
$PhraseDownload = 'ΕΓΚΡΙΝΩ BOL FEED DOWNLOAD'
# The bol.com feed is the work of chat 9 (Retailers & Feeds B) from 16 Nov 2026 (chat 3's hand-over in the plan).
$ChatName = '9 · Retailers & Feeds Β'

$L = New-Object System.Collections.Generic.List[string]
$script:secrets = New-Object System.Collections.Generic.List[string]
$script:token = ''
$script:tokenUntil = [DateTime]::MinValue
$script:tokenCount = 0
# Nothing secret ever reaches the screen or the report: every key, the Basic header and any Bearer token are masked.
function Mask([string]$s) {
    foreach ($x in $script:secrets) { if ($x -and $x.Length -ge 4) { $s = $s.Replace($x, '***') } }
    $s = [regex]::Replace($s, '(?i)(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+', '$1 ***')
    return [regex]::Replace($s, '(?i)("?access_token"?\s*[:=]\s*"?)[^",\s]+', '$1***')
}
function Say([string]$t, [string]$c = '') { $t = Mask $t; $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Finish([int]$code) {
    $script:token = ''
    $script:secrets.Clear()
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('BOL_FEED_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('BOL_FEED_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = $L -join "`r`n"
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host ('Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «{0}» και πάτα Ctrl+V.' -f $ChatName) -ForegroundColor Green }
    exit $code
}
trap {
    Say ('Απρόβλεπτο σφάλμα: {0}' -f $_.Exception.Message) 'Magenta'
    Say 'Σταμάτησα εδώ. Ό,τι γράφει πιο πάνω έγινε, τίποτα μετά. Στείλε την αναφορά στο Claude.' 'Magenta'
    Finish 9
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
        try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
}
# Only bol.com's own servers get the keys and the token (or the tests' local fake server).
function Test-BolBase([string]$base, [string]$hostWanted) {
    try { $u = [Uri]$base } catch { return $false }
    if ($u.Host -eq '127.0.0.1' -and $u.Scheme -eq 'http') { return $true }
    return ($u.Scheme -eq 'https' -and $u.Host -eq $hostWanted -and ($u.AbsolutePath -eq '/' -or $u.AbsolutePath -eq ''))
}
function Plain([System.Security.SecureString]$sec) {
    $b = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}
# One HTTPS call. Returns status, body and Retry-After; never follows a redirect (the keys stay with bol.com).
function Invoke-Bol([string]$method, [string]$url, [hashtable]$headers) {
    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Method = $method
    $req.AllowAutoRedirect = $false
    $req.Timeout = 30000
    $req.ReadWriteTimeout = 60000
    $req.Accept = 'application/json'
    $req.UserAgent = 'GearWorld-bol-feed/1.0 (+https://gearworldgroup.com)'
    foreach ($k in $headers.Keys) { $req.Headers[$k] = [string]$headers[$k] }
    if ($method -eq 'POST') { $req.ContentLength = 0 }
    $resp = $null
    try { $resp = $req.GetResponse() }
    catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if (-not $resp) { return @{ status = 0; body = ''; retryAfter = ''; error = [string]$_.Exception.Message } }
    }
    try {
        $status = [int]$resp.StatusCode
        $retry = [string]$resp.Headers['Retry-After']
        $sr = New-Object System.IO.StreamReader($resp.GetResponseStream(), [System.Text.Encoding]::UTF8)
        $body = $sr.ReadToEnd()
        $sr.Close()
    } finally { $resp.Close() }
    return @{ status = $status; body = $body; retryAfter = $retry; error = '' }
}
function Read-Keys {
    if (-not (Test-Path -LiteralPath $SecretFile)) { return $null }
    try {
        $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($SecretFile).Trim())
        $c = (Plain $sec) | ConvertFrom-Json
        $id = [string]$c.id
        $secret = [string]$c.secret
        $c = $null
    } catch { return $null }
    if (-not $id -or -not $secret) { return $null }
    $script:secrets.Add($id)
    $script:secrets.Add($secret)
    return @{ id = $id; secret = $secret }
}
# The token: asked for once per run, and again only when it has run out (bol.com: "Please do not request a new token
# for each request"; too many token requests block the address).
function Get-Token([hashtable]$keys) {
    if ($script:token -and (Get-Date) -lt $script:tokenUntil) { return $script:token }
    if ($script:tokenCount -ge 3) { Say 'Ζητήθηκαν ήδη 3 token σε αυτή την εκτέλεση: σταματάω, για να μη μπλοκάρει το bol.com τη διεύθυνση.' 'Magenta'; Finish 6 }
    $basic = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($keys.id + ':' + $keys.secret))
    $script:secrets.Add($basic)
    $script:tokenCount++
    $r = Invoke-Bol 'POST' ($LoginBase + '/token?grant_type=client_credentials') @{ Authorization = 'Basic ' + $basic }
    if ($r.status -eq 401) { Say 'Το bol.com δεν δέχτηκε τα κλειδιά (401). Φτιάξε νέα στο partner.bol.com και τρέξε ξανά το βήμα keys.' 'Magenta'; Finish 3 }
    if ($r.status -eq 429 -or $r.status -eq 403) { Say ('Το bol.com απάντησε {0} στο token (πολλά αιτήματα ή μπλοκάρισμα{1}). Σταματάω χωρίς νέα προσπάθεια.' -f $r.status, $(if ($r.retryAfter) { ', ξανά μετά από ' + $r.retryAfter + ' δευτερόλεπτα' } else { '' })) 'Magenta'; Finish 6 }
    if ($r.status -ne 200) { Say ('Το token δεν βγήκε: {0} {1}' -f $r.status, $r.error) 'Magenta'; Finish 4 }
    try { $j = $r.body | ConvertFrom-Json } catch { $j = $null }
    if (-not $j -or -not $j.access_token) { Say 'Το bol.com δεν έδωσε token στην απάντηση.' 'Magenta'; Finish 4 }
    $script:token = [string]$j.access_token
    $script:secrets.Add($script:token)
    $life = 299
    try { if ([int]$j.expires_in -gt 0) { $life = [int]$j.expires_in } } catch { }
    $script:tokenUntil = (Get-Date).AddSeconds([Math]::Max(30, $life - 30))
    Say ('Token: ΕΝΤΑΞΕΙ (ένα σε αυτή την εκτέλεση, ισχύει {0} δευτερόλεπτα· δεν φαίνεται πουθενά)' -f $life) 'Cyan'
    return $script:token
}

Write-Host ''
Say ('bol.com Partnerprogramma - step: {0} - {1} - {2}' -f $Step, $(if ($Step -eq 'check' -or $Step -eq 'categories') { 'ΜΟΝΟ ΑΝΑΓΝΩΣΗ' } elseif ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΤΟ ΠΛΑΝΟ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
if (-not (Test-BolBase $LoginBase 'login.bol.com') -or -not (Test-BolBase $ApiBase 'api.bol.com')) {
    Say 'Τα κλειδιά και το token πηγαίνουν μόνο στο login.bol.com και στο api.bol.com. Σταμάτησα.' 'Magenta'
    Finish 2
}

# ---------------- keys ----------------
if ($Step -eq 'keys') {
    $exists = Test-Path -LiteralPath $SecretFile
    Say ''
    Say 'Τι θα γίνει:'
    Say '  - Θα σου ζητήσω το Client ID και το Client Secret του bol.com (partner.bol.com -> Mijn account -> API toegang -> Client credentials).'
    Say '    Δεν φαίνονται όσο τα γράφεις ή τα επικολλάς, και δεν γράφονται ποτέ στην οθόνη, στην αναφορά ή στο πρόχειρο.'
    Say ('  - Φυλάγονται κρυπτογραφημένα μόνο για τον χρήστη σου στα Windows (DPAPI): {0}' -f $SecretFile)
    if ($exists) { Say ('  - Υπάρχουν ήδη κλειδιά: το παλιό αρχείο μένει ως {0}.old-{1} (επαναφορά: μετονομασία πίσω).' -f (Split-Path -Leaf $SecretFile), $stamp) }
    Say '  - Δεν ζητάω token σε αυτό το βήμα: τα κλειδιά τα δοκιμάζει το βήμα check (ένα token).'
    Say ('  - Επαναφορά: σβήσιμο του αρχείου {0}.' -f $SecretFile)
    Say '  - Τα sites, οι βάσεις και οι Workers ΔΕΝ αλλάζουν.'
    if (-not $Apply) { Say ''; Say ('Χωρίς -Apply δεν άλλαξε τίποτα. Για την αλλαγή: -Apply και η φράση {0}' -f $PhraseKeys) 'Yellow'; Finish 0 }
    if (-not (Confirm-Approval $PhraseKeys)) { Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
    $id = ''
    $secret = ''
    # The checks of the repo give the keys through an environment variable, and only with a file other than the real one.
    if ($env:GW_BOL_TEST_KEYS -and $SecretFile -ne $DefaultSecretFile) {
        $parts = ([string]$env:GW_BOL_TEST_KEYS).Split('|')
        if ($parts.Count -eq 2) { $id = $parts[0]; $secret = $parts[1] }
    } else {
        Write-Host ''
        Write-Host 'Επικόλλησε το Client ID (δεν θα φαίνεται) και πάτα Enter:' -ForegroundColor Yellow
        try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
        $id = Plain (Read-Host 'Client ID' -AsSecureString)
        Write-Host 'Επικόλλησε το Client Secret (δεν θα φαίνεται) και πάτα Enter:' -ForegroundColor Yellow
        $secret = Plain (Read-Host 'Client Secret' -AsSecureString)
    }
    $id = $id.Trim()
    $secret = $secret.Trim()
    if ($id) { $script:secrets.Add($id) }
    if ($secret) { $script:secrets.Add($secret) }
    if ($id.Length -lt 8 -or $secret.Length -lt 8 -or $id -match '\s' -or $secret -match '\s' -or $id.Length -gt 200 -or $secret.Length -gt 400) {
        Say 'Τα κλειδιά δεν μοιάζουν σωστά (κενά ή πολύ μικρά). Δεν αποθήκευσα τίποτα. Αντίγραψέ τα ξανά από το partner.bol.com.' 'Magenta'
        Finish 1
    }
    if ($id -eq $secret) { Say 'Το Client ID και το Client Secret είναι ίδια: μάλλον επικολλήθηκε το ίδιο δύο φορές. Δεν αποθήκευσα τίποτα.' 'Magenta'; Finish 1 }
    $dir = Split-Path -Parent $SecretFile
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    if ($exists) {
        $old = $SecretFile + '.old-' + $stamp
        Move-Item -LiteralPath $SecretFile -Destination $old -Force
        Say ('Τα παλιά κλειδιά κρατήθηκαν (κρυπτογραφημένα): {0}' -f $old)
    }
    $json = (New-Object PSObject -Property @{ id = $id; secret = $secret; saved = (Get-Date -Format 'yyyy-MM-dd HH:mm') }) | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($SecretFile, (ConvertFrom-SecureString (ConvertTo-SecureString $json -AsPlainText -Force)), [System.Text.Encoding]::ASCII)
    $json = ''
    $back = Read-Keys
    if (-not $back -or $back.id -ne $id -or $back.secret -ne $secret) { Say 'Δεν μπόρεσα να ξαναδιαβάσω τα κλειδιά που φύλαξα. Στείλε την αναφορά στο Claude.' 'Magenta'; Finish 3 }
    Say ('Τα κλειδιά φυλάχτηκαν κρυπτογραφημένα (DPAPI, μόνο για αυτόν τον χρήστη): {0} (Client ID {1} χαρακτήρες, Client Secret {2} χαρακτήρες)' -f $SecretFile, $id.Length, $secret.Length) 'Cyan'
    $id = ''
    $secret = ''
    Say ''
    Say 'Αποτέλεσμα: ΕΤΟΙΜΟ. Επόμενο: το βήμα check (μόνο ανάγνωση) τα δοκιμάζει με ένα token και μία αναζήτηση.' 'Cyan'
    Finish 0
}

# ---------------- categories and download (tools/bol-feed.mjs) ----------------
# The keys reach Node only through two environment variables of this process, cleared right after; Node never
# writes them. Its report comes back through a file and every line still goes through Mask.
function Invoke-BolNode([string[]]$a) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Magenta'; Finish 3 }
    $k = Read-Keys
    if (-not $k) {
        Say ('Δεν βρήκα φυλαγμένα κλειδιά του bol.com στο {0} (ή δεν διαβάζονται από αυτόν τον χρήστη).' -f $SecretFile) 'Magenta'
        Say ('Τρέξε πρώτα το βήμα keys με τη φράση {0}.' -f $PhraseKeys)
        Finish 3
    }
    Say 'Κλειδιά: βρέθηκαν (κρυπτογραφημένα, δεν φαίνονται): ΕΝΤΑΞΕΙ' 'Cyan'
    $rep = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-bol-' + $stamp + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
    $all = @((Join-Path $PSScriptRoot 'bol-feed.mjs'), '--login-base', $LoginBase, '--api-base', $ApiBase, '--report', $rep) + $a
    $lines = @()
    try {
        $env:GW_BOL_ID = $k.id
        $env:GW_BOL_SECRET = $k.secret
        $lines = @(& $node.Source @all)
        $code = $LASTEXITCODE
    } finally {
        $env:GW_BOL_ID = $null
        $env:GW_BOL_SECRET = $null
    }
    if (Test-Path -LiteralPath $rep) {
        Say ''
        foreach ($line in ([System.IO.File]::ReadAllText($rep, [System.Text.Encoding]::UTF8) -split "`r?`n")) { Say $line }
        Remove-Item -LiteralPath $rep -Force -ErrorAction SilentlyContinue
    }
    $j = $null
    if ($lines.Count) { try { $j = ([string]$lines[-1]) | ConvertFrom-Json } catch { $j = $null } }
    return @{ code = $code; json = $j }
}

if ($Step -eq 'categories') {
    $r = Invoke-BolNode @('--mode', 'categories', '--country', $Country)
    if ($r.code -ne 0) {
        $why = ''; if ($r.json -and $r.json.error) { $why = [string]$r.json.error }
        Say ('Οι κατηγορίες δεν βγήκαν: {0}' -f $why) 'Magenta'
        Finish $r.code
    }
    Say 'Αποτέλεσμα: ΕΤΟΙΜΟ (μόνο ανάγνωση). Στείλε την αναφορά στο Claude για να διαλέξει τις κατηγορίες της λήψης.' 'Cyan'
    Finish 0
}

if ($Step -eq 'download') {
    if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
    $cats = @(([string]$Categories).Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^\d{1,12}(\s*=\s*[^,;]{1,60})?$' })
    $terms = @(([string]$Search).Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_.Length -le 60 })
    $max = [Math]::Min(10000, [Math]::Max(1, $MaxPerCategory))
    # -Standard (L205): the one list of src/lib/bol-lists.js, shared with the daily refresh Worker; the names are read
    # from that file with its own pattern ({ id: '<digits>', name: '<text>' }), the searches from BOL_SEARCHES.
    if ($Standard) {
        if ($cats.Count -or $terms.Count) { Say '-Standard παίρνει τις λίστες του src/lib/bol-lists.js: μη δώσεις και -Categories ή -Search. Δεν άλλαξε τίποτα.' 'Magenta'; Finish 2 }
        $listsFile = Join-Path (Join-Path (Join-Path (Split-Path -Parent $PSScriptRoot) 'src') 'lib') 'bol-lists.js'
        if (-not (Test-Path -LiteralPath $listsFile)) { Say ('Δεν βρήκα τις λίστες: {0}' -f $listsFile) 'Magenta'; Finish 2 }
        $listsText = [System.IO.File]::ReadAllText($listsFile, [System.Text.Encoding]::UTF8)
        $cats = @([regex]::Matches($listsText, "\{ id: '(\d+)', name: '([^']+)' \}") | ForEach-Object { '{0}={1}' -f $_.Groups[1].Value, $_.Groups[2].Value })
        $sm = [regex]::Match($listsText, 'export const BOL_SEARCHES = \[([^\]]*)\]')
        $terms = @()
        if ($sm.Success) { $terms = @([regex]::Matches($sm.Groups[1].Value, "'([^']+)'") | ForEach-Object { $_.Groups[1].Value }) }
        if (-not $PSBoundParameters.ContainsKey('MaxPerCategory')) { $max = 1000 }
        $SearchCategory = ''
    }
    Say ''
    Say 'Τι θα γίνει:'
    if ($Standard) { Say ('  - Οι τυπικές λίστες του src/lib/bol-lists.js ({0} κατηγορίες, {1} αναζητήσεις), οι ίδιες που ξαναδιαβάζει κάθε μέρα ο Worker gear-world-bol-refresh (L205).' -f $cats.Count, $terms.Count) }
    Say ('  - Λήψη από το επίσημο API του bol.com ({0}), ένα token για όλη την εκτέλεση, σελίδες των 50, έως {1} προϊόντα ανά κατηγορία ή αναζήτηση.' -f $Country, $max)
    foreach ($c in $cats) { Say ('    κατηγορία {0}' -f $c) }
    foreach ($t in $terms) { Say ('    αναζήτηση «{0}»{1}' -f $t, $(if ($SearchCategory) { ' στην κατηγορία ' + $SearchCategory } else { '' })) }
    Say ('  - Αρχεία: {0}\BOL_<κατηγορία>_{1}.csv.gz· το παλιό αντίγραφο πάει πρώτα στο _old\{2} (επαναφορά: μετακίνηση πίσω).' -f $Archive, $Country, ($stamp -replace '_', ''))
    Say '  - Έξω: προϊόντα χωρίς προσφορά ή χωρίς σελίδα bol.com· το ίδιο EAN μία φορά· καμία «πριν» τιμή.'
    Say '  - Τα sites, οι βάσεις και οι Workers ΔΕΝ αλλάζουν. Εισαγωγή μόνο αργότερα, με ΕΓΚΡΙΝΩ ALL IMPORTS.'
    if (-not $cats.Count -and -not $terms.Count) { Say 'Δεν δόθηκε καμία κατηγορία (-Categories) ή αναζήτηση (-Search). Δεν άλλαξε τίποτα.' 'Magenta'; Finish 2 }
    if (-not (Test-Path -LiteralPath $Archive)) { Say ('Δεν βρήκα τον φάκελο των feeds: {0}' -f $Archive) 'Magenta'; Finish 2 }
    if (-not $Apply) { Say ''; Say ('Χωρίς -Apply δεν άλλαξε τίποτα. Για τη λήψη: -Apply και η φράση {0}' -f $PhraseDownload) 'Yellow'; Finish 0 }
    if (-not (Confirm-Approval $PhraseDownload)) { Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
    $a = @('--mode', 'download', '--country', $Country, '--out', $Archive, '--max', [string]$max, '--pause', [string]([Math]::Max(0, $PauseMs)), '--stamp', ($stamp -replace '_', ''))
    if ($Standard) { $a += @('--standard') } else {
        if ($cats.Count) { $a += @('--categories', ($cats -join ',')) }
        if ($terms.Count) { $a += @('--search', ($terms -join ',')) }
    }
    if ($SearchCategory -match '^\d{1,12}$') { $a += @('--search-category', $SearchCategory) }
    $r = Invoke-BolNode $a
    if ($r.code -eq 0) { Say 'Αποτέλεσμα: ΕΤΟΙΜΟ (μόνο αρχεία στον υπολογιστή). Στείλε την αναφορά στο Claude.' 'Cyan'; Finish 0 }
    $why = ''; if ($r.json -and $r.json.error) { $why = [string]$r.json.error }
    if ($r.code -eq 5) { Say 'Αποτέλεσμα: ΠΡΟΣΟΧΗ: κάποια αρχεία δεν κατέβηκαν (δες πιο πάνω). Τα άλλα είναι στη θέση τους.' 'Yellow'; Finish 5 }
    Say ('Η λήψη σταμάτησε: {0}. Ό,τι γράφει πιο πάνω ΕΝΤΑΞΕΙ έγινε· τίποτα μισό δεν έμεινε.' -f $why) 'Magenta'
    Finish $r.code
}

# ---------------- check ----------------
$keys = Read-Keys
if (-not $keys) {
    Say ('Δεν βρήκα φυλαγμένα κλειδιά του bol.com στο {0} (ή δεν διαβάζονται από αυτόν τον χρήστη).' -f $SecretFile) 'Magenta'
    Say ('Τρέξε πρώτα το βήμα keys με τη φράση {0}.' -f $PhraseKeys)
    Finish 3
}
Say 'Κλειδιά: βρέθηκαν (κρυπτογραφημένα, δεν φαίνονται): ΕΝΤΑΞΕΙ' 'Cyan'
$tok = Get-Token $keys
$q = 'search-term=' + [Uri]::EscapeDataString($SearchTerm.Trim()) + '&country-code=' + $Country + '&page=1&page-size=1&include-offer=true'
$r = Invoke-Bol 'GET' ($ApiBase + '/marketing/catalog/v1/products/search?' + $q) @{ Authorization = 'Bearer ' + $tok; 'Accept-Language' = 'nl' }
if ($r.status -eq 401) { Say 'Το api.bol.com δεν δέχτηκε το token (401). Στείλε την αναφορά στο Claude (δεν ζητάω άλλο token).' 'Magenta'; Finish 4 }
if ($r.status -eq 429) { Say ('Το api.bol.com απάντησε 429 (πολλά αιτήματα{0}). Σταματάω χωρίς νέα προσπάθεια.' -f $(if ($r.retryAfter) { ', ξανά μετά από ' + $r.retryAfter + ' δευτερόλεπτα' } else { '' })) 'Magenta'; Finish 6 }
if ($r.status -ne 200) {
    $why = ''
    try { $e = $r.body | ConvertFrom-Json; if ($e.detail) { $why = [string]$e.detail } elseif ($e.title) { $why = [string]$e.title } } catch { }
    Say ('Η αναζήτηση δεν έγινε: {0} {1} {2}' -f $r.status, $why, $r.error) 'Magenta'
    Finish 4
}
try { $j = $r.body | ConvertFrom-Json } catch { Say 'Η απάντηση της αναζήτησης δεν είναι JSON.' 'Magenta'; Finish 4 }
$total = 0
try { $total = [int64]$j.totalResults } catch { }
$first = $null
if ($j.results) { $first = @($j.results)[0] }
Say ''
Say ('Αναζήτηση «{0}» στο bol.com ({1}): βρέθηκαν {2} προϊόντα.' -f $SearchTerm.Trim(), $Country, $total) 'Cyan'
if ($first) {
    $price = ''
    if ($first.offer -and $null -ne $first.offer.price) { $price = ('€{0}' -f ([double]$first.offer.price).ToString('0.00', [System.Globalization.CultureInfo]::InvariantCulture)) }
    else { $price = 'χωρίς τιμή (δεν πωλείται τώρα)' }
    Say ('  Πρώτο: {0} - {1}' -f ([string]$first.title), $price)
} else {
    Say '  Δεν βγήκε κανένα προϊόν για αυτές τις λέξεις.' 'Yellow'
}
Say ''
Say ('Αιτήματα αυτής της εκτέλεσης: {0} token, 1 αναζήτηση. Δεν αποθηκεύτηκε τίποτα.' -f $script:tokenCount)
Say 'Αποτέλεσμα: ΕΤΟΙΜΟ (τα κλειδιά δουλεύουν).' 'Cyan'
Finish 0
