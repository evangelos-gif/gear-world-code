<#
.SYNOPSIS
  Gear World email, step 2: the MailerLite API key becomes the secret MAILERLITE_API_KEY of the Hub Worker
  (gear-world-hub). Read-only unless -Step apply with -Apply and the typed approval phrase.

.DESCRIPTION
  -Step check   READ-ONLY. Cloudflare login; the Hub Worker and its live version; the NAMES (never the values) of its
                secrets; is MAILERLITE_API_KEY there already? Shows the plan.
  -Step apply   CHANGES CLOUDFLARE (only the secrets of the Hub Worker), one approval: ΕΓΚΡΙΝΩ MAILERLITE ΚΛΕΙΔΙ.
                  1. a backup note on this PC: the live version of the Hub and the names of its secrets, with how to go back;
                  2. you paste the key here, hidden: it is never shown, written to a file, put on a command line, in the
                     report or in an error message;
                  3. the key is tried on MailerLite, read-only (the list of groups). A key MailerLite refuses is NOT stored;
                  4. wrangler stores it (through its input only) as MAILERLITE_API_KEY. Cloudflare makes a new version of the
                     Hub with the SAME code (that is how Worker secrets work). Nothing uses the key before email step 5.
                The sites, the D1 databases and the other Workers do not change. The key goes to the Hub only: in step 5 the
                sites send their sign-ups to the Hub, so the key lives in one place.
  -NoKeyTest and -KeyEnv exist for the automatic tests only.
  Report: <home>\gear-world-reports\GWH_MAILERLITE_KEY_<STEP>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'apply')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$PcHome = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [string]$KeyEnv = '',
    [switch]$NoKeyTest,
    [switch]$NoHttpCheck,
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ MAILERLITE ΚΛΕΙΔΙ'
$HubWorker = 'gear-world-hub'
$SecretName = 'MAILERLITE_API_KEY'
$GroupName = 'Gear World subscribers'
$ApiBase = 'https://connect.mailerlite.com/api'
$KeyPage = 'https://dashboard.mailerlite.com/integrations/api'
$LiveUrl = 'https://gearworldhub.com'
if (-not $PcHome) { $PcHome = $HOME }
if (-not $WorkDir) { $WorkDir = Join-Path $PcHome 'gear-world-mailerlite' }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
# Colours without red and green (lessons L35): cyan = OK, yellow = attention, magenta = problem.
$Ok = 'Cyan'
$Warn = 'Yellow'
$Bad = 'Magenta'
$script:Secrets = New-Object System.Collections.Generic.List[string]

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    foreach ($s in $script:Secrets) { if ($s) { $text = $text.Replace($s, '[key]') } }
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

# Cloudflare IDs (versions) never go into a report.
function Hide-Ids([string]$Text) {
    $t = [regex]::Replace($Text, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
    return [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{28}\b', '${1}-masked-id')
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('GWH_MAILERLITE_KEY_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('GWH_MAILERLITE_KEY_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = Hide-Ids ($L -join "`r`n")
    foreach ($s in $script:Secrets) { if ($s) { $text = $text.Replace($s, '[key]') } }
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

function New-CmdFile([string]$Folder, [string]$Arguments) {
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-mlkey-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
    [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
    return $cmdFile
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
# -Retry: on a network error or a passing Cloudflare error (7403, 10000: lessons L43), try again, up to 3 times.
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = New-CmdFile $Folder $Arguments
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        }
        $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
        $result = @{ code = $code; text = $text }
        $passing = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|code: 7403|code: 10000'
        if ($code -eq 0 -or -not $passing -or $try -eq $tries) { break }
        Say ('Προσωρινό πρόβλημα με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/{2})...' -f (5 * $try), ($try + 1), $tries) $Warn
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

# The key goes to wrangler through its standard input only: never on a command line, in a file or in the report.
# wrangler removes the line break at the end (trimTrailingWhitespace).
function Set-KeySecret([string]$Folder, [string]$Value) {
    $cmdFile = New-CmdFile $Folder ('secret put {0} --name {1}' -f $SecretName, $HubWorker)
    try {
        $out = @($Value | & $cmdFile)
        $code = $LASTEXITCODE
    } finally {
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    }
    $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
    if ($Value) { $text = $text.Replace($Value, '[key]') }
    return @{ code = $code; text = $text }
}

# The JSON array that wrangler printed (warnings before it are skipped), as a flat array of its items.
# Windows PowerShell 5.1 gives a JSON array back as ONE object and PowerShell 7 as its items (lessons L76).
function Get-JsonArray([string]$text) {
    $m = [regex]::Match($text, '(?m)^\s*\[')
    $j = $text.LastIndexOf(']')
    if (-not $m.Success -or $j -le $m.Index) { return $null }
    try { $parsed = ConvertFrom-Json -InputObject $text.Substring($m.Index, $j - $m.Index + 1) } catch { return $null }
    $items = New-Object System.Collections.ArrayList
    foreach ($x in @($parsed)) { if ($null -ne $x) { [void]$items.Add($x) } }
    return , $items.ToArray()
}

# The names of the Hub's secrets (never their values), or $null when they could not be read.
function Get-SecretNames([string]$folder) {
    $r = Invoke-Wrangler $folder ('secret list --name {0}' -f $HubWorker) -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { return $null }
    $names = @()
    foreach ($s in $j) { if ([string]$s.name) { $names += [string]$s.name } }
    return , $names
}

# The version of the Hub that is live now (for going back): the last "Version(s):" block of the deployments list.
function Get-LiveVersion([string]$folder) {
    $r = Invoke-Wrangler $folder ('deployments list --name {0}' -f $HubWorker) -Retry
    if ($r.code -ne 0) { return '' }
    $at = $r.text.LastIndexOf('Version(s):')
    if ($at -lt 0) { return '' }
    $ms = [regex]::Matches($r.text.Substring($at), '\((\d+)%\)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($ms.Count -ne 1 -or $ms[0].Groups[1].Value -ne '100') { return '' }
    return $ms[0].Groups[2].Value
}

# A folder with this repo version's package files, so wrangler is the fixed version of package-lock.json. It has no
# wrangler config, so only the Worker named with --name is meant (L83).
function Prepare-Tools {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'tools') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        foreach ($item in @('package.json', 'package-lock.json')) { Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Force }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-mlkey-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' $Bad; Finish 3 }
    }
    return $dest
}

# Tries the key on MailerLite, read-only (GET the list of groups): @{ status; groups; error }. The key is only in the
# Authorization header, never in the address.
function Test-MailerLiteKey([string]$key) {
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    try {
        $req = [System.Net.HttpWebRequest]::Create($ApiBase + '/groups?limit=100')
        $req.Method = 'GET'
        $req.Accept = 'application/json'
        $req.UserAgent = 'GearWorldHub-setup/1.0'
        $req.Timeout = 30000
        $req.Headers.Add('Authorization', 'Bearer ' + $key)
        $resp = $req.GetResponse()
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if (-not $resp) { return @{ status = 0; groups = @(); error = 'network' } }
    } catch {
        return @{ status = 0; groups = @(); error = 'network' }
    }
    try {
        $status = [int]$resp.StatusCode
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream(), (New-Object System.Text.UTF8Encoding($false)))
        $body = $reader.ReadToEnd()
        $reader.Close()
    } finally { $resp.Close() }
    $groups = @()
    if ($status -eq 200) {
        try {
            $j = ConvertFrom-Json -InputObject $body
            foreach ($g in @($j.data)) { if ($null -ne $g -and [string]$g.name) { $groups += [string]$g.name } }
        } catch { }
    }
    return @{ status = $status; groups = $groups; error = '' }
}

# ---------------- start ----------------
Say ('Gear World email, βήμα 2: το κλειδί του MailerLite στον Hub ({0}), {1}' -f $Step, (Get-Date -Format 'dd/MM/yyyy HH:mm'))
Say ('Έκδοση εργαλείου: {0}' -f (Split-Path -Leaf $repo))
Say ''
$tools = Prepare-Tools

$who = Invoke-Wrangler $tools 'whoami' -Retry
if ($who.code -ne 0 -or $who.text -match '(?i)not authenticated|wrangler login') {
    Say 'Σύνδεση στο Cloudflare: ΠΡΟΒΛΗΜΑ - το wrangler δεν είναι συνδεδεμένο. Δεν άλλαξε τίποτα. Στείλε στο Claude αυτό το μήνυμα.' $Bad
    Finish 2
}
Say 'Σύνδεση στο Cloudflare: ΕΝΤΑΞΕΙ' $Ok

$live = Get-LiveVersion $tools
if (-not $live) {
    Say ('Worker του Hub ({0}): ΠΡΟΒΛΗΜΑ - δεν βρήκα μία ζωντανή έκδοση με 100% των επισκεπτών. Δεν άλλαξε τίποτα.' -f $HubWorker) $Bad
    Finish 4
}
Say ('Worker του Hub ({0}): υπάρχει, μία ζωντανή έκδοση: ΕΝΤΑΞΕΙ' -f $HubWorker) $Ok

$names = Get-SecretNames $tools
if ($null -eq $names) { Say 'Μυστικά του Hub: ΠΡΟΒΛΗΜΑ - δεν μπόρεσα να διαβάσω τη λίστα. Δεν άλλαξε τίποτα.' $Bad; Finish 4 }
$shown = '(κανένα)'
if ($names.Count -gt 0) { $shown = ($names -join ', ') }
Say ('Μυστικά του Hub τώρα (μόνο ονόματα): {0}' -f $shown)
$had = $names -contains $SecretName
if ($had) { Say ('Το {0} υπάρχει ήδη: με το apply αντικαθίσταται από το νέο κλειδί.' -f $SecretName) $Warn }
else { Say ('Το {0} δεν υπάρχει ακόμα (θα προστεθεί).' -f $SecretName) }

Say ''
Say 'Τι θα κάνει το apply:'
Say '  1. Σημείωμα ασφαλείας στον υπολογιστή: η ζωντανή έκδοση του Hub και τα ονόματα των μυστικών του, με το πώς γυρνάμε πίσω.'
Say '  2. Επικολλάς το κλειδί κρυφά. Δεν φαίνεται, δεν γράφεται σε αρχείο, σε εντολή ή στην αναφορά.'
Say '  3. Δοκιμή του κλειδιού στο MailerLite, μόνο ανάγνωση (η λίστα των groups). Αν δεν το δεχτεί, ΔΕΝ αποθηκεύεται.'
Say ('  4. Αποθήκευση ως μυστικό {0} στον Worker {1}. Το Cloudflare φτιάχνει νέα έκδοση του Hub με τον ΙΔΙΟ κώδικα.' -f $SecretName, $HubWorker)
Say '  Τα sites, οι βάσεις D1 και οι άλλοι Workers ΔΕΝ αλλάζουν. Κανείς δεν χρησιμοποιεί το κλειδί πριν από το βήμα 5.'
Say ('  Φράση έγκρισης: {0}' -f $Phrase)

if ($Step -eq 'check' -or -not $Apply) {
    Say ''
    Say 'Δοκιμή μόνο (χωρίς -Step apply -Apply): δεν άλλαξε τίποτα.' $Ok
    Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ' $Ok
    Finish 0
}

if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' $Warn; Finish 1 }

# 1. backup note (the version id stays on this PC, not in the report)
$bdir = Join-Path $WorkDir 'backups'
if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
$note = @(
    ('Gear World Hub before the MailerLite key, {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    ('Live version of {0}: {1}' -f $HubWorker, $live),
    ('Secret names before: {0}' -f $shown),
    ('{0} was there before: {1}' -f $SecretName, $had),
    'To go back (only with approval), in PowerShell:',
    ('  npx wrangler secret delete {0} --name {1}' -f $SecretName, $HubWorker),
    ('  or the whole Hub back to the version above: npx wrangler rollback {0} --name {1}' -f $live, $HubWorker),
    ('  and in MailerLite delete the token: {0}' -f $KeyPage)
) -join "`r`n"
$noteFile = Join-Path $bdir ('gwh-before-mailerlite-key-' + $stamp + '.txt')
[System.IO.File]::WriteAllText($noteFile, $note, (New-Object System.Text.UTF8Encoding($true)))
Say ''
Say ('1. Σημείωμα ασφαλείας: {0}' -f $noteFile) $Ok

# 2. the key, hidden
$plain = ''
if ($KeyEnv) {
    $plain = [string][System.Environment]::GetEnvironmentVariable($KeyEnv)
} else {
    Write-Host ''
    Write-Host ('Στο παράθυρο του MailerLite ({0}) πάτα "Copy" στο κλειδί.' -f $KeyPage) -ForegroundColor $Warn
    $sec = Read-Host 'Επικόλλησε εδώ το κλειδί (δεν φαίνεται όσο το επικολλάς) και πάτα Enter' -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
$plain = ([string]$plain).Trim()
if ($plain) { $script:Secrets.Add($plain) }
if (-not $plain) { Say '2. Δεν δόθηκε κλειδί: δεν άλλαξε τίποτα. Τρέξε την ίδια εντολή ξανά όταν το έχεις.' $Warn; Finish 8 }
if ($plain -match '\s' -or $plain.Length -lt 20 -or $plain.Length -gt 4096) {
    Say '2. Αυτό δεν μοιάζει με κλειδί του MailerLite (κενά ή λάθος μήκος). ΔΕΝ το αποθήκευσα. Δοκίμασε ξανά.' $Bad
    Finish 8
}
Say ('2. Κλειδί: δόθηκε ({0} χαρακτήρες, δεν φαίνεται).' -f $plain.Length) $Ok

# 3. read-only test on MailerLite
if ($NoKeyTest) {
    Say '3. Δοκιμή στο MailerLite: παραλείφθηκε (-NoKeyTest, μόνο για τους αυτόματους ελέγχους).' $Warn
} else {
    $t = Test-MailerLiteKey $plain
    if ($t.status -eq 401 -or $t.status -eq 403) {
        Say ('3. Το MailerLite ΔΕΝ δέχτηκε το κλειδί (HTTP {0}). ΔΕΝ το αποθήκευσα. Φτιάξε νέο στο {1} και ξανατρέξε την εντολή.' -f $t.status, $KeyPage) $Bad
        Finish 9
    }
    if ($t.status -ne 200) {
        Say ('3. Δεν μπόρεσα να δοκιμάσω το κλειδί στο MailerLite (απάντηση: {0}). ΔΕΝ το αποθήκευσα. Ξανατρέξε την εντολή σε λίγο.' -f $(if ($t.status) { 'HTTP ' + $t.status } else { 'καμία, πρόβλημα δικτύου' })) $Bad
        Finish 9
    }
    Say ('3. Δοκιμή στο MailerLite: το κλειδί δουλεύει (groups: {0}): ΕΝΤΑΞΕΙ' -f @($t.groups).Count) $Ok
    if (@($t.groups) -contains $GroupName) { Say ('   Το group «{0}» υπάρχει ήδη.' -f $GroupName) }
    else { Say ('   Το group «{0}» δεν υπάρχει ακόμα: θα φτιαχτεί στο βήμα 5.' -f $GroupName) }
}

# 4. store it
$s = Set-KeySecret $tools $plain
$plain = ''
if ($s.code -ne 0) {
    Say '4. Το κλειδί ΔΕΝ αποθηκεύτηκε. Ο Hub δεν άλλαξε. Στείλε στο Claude αυτό το μήνυμα:' $Bad
    foreach ($line in @($s.text -split "`n" | Select-Object -Last 8)) { Say ('  ' + $line) }
    Finish 10
}
$after = Get-SecretNames $tools
if ($null -eq $after -or -not ($after -contains $SecretName)) {
    Say ('4. Το wrangler απάντησε ΕΝΤΑΞΕΙ, αλλά δεν βλέπω το {0} στη λίστα. Στείλε στο Claude αυτό το μήνυμα.' -f $SecretName) $Bad
    Finish 11
}
$lost = @($names | Where-Object { -not ($after -contains $_) })
if ($lost.Count -gt 0) { Say ('4. ΠΡΟΣΟΧΗ: λείπουν μυστικά που υπήρχαν πριν: {0}. Στείλε στο Claude αυτό το μήνυμα.' -f ($lost -join ', ')) $Bad; Finish 11 }
Say ('4. Αποθηκεύτηκε στο Cloudflare ως μυστικό {0} του Hub (δεν φαίνεται ποτέ ξανά). Τα άλλα μυστικά έμειναν ίδια.' -f $SecretName) $Ok

if (-not $NoHttpCheck) {
    Start-Sleep -Seconds 5
    try {
        $req = [System.Net.HttpWebRequest]::Create($LiveUrl + '/api/health')
        $req.UserAgent = 'GearWorldQA-bot/1.0 (+read-only check)'
        $req.Timeout = 30000
        $resp = $req.GetResponse()
        $code = [int]$resp.StatusCode
        $resp.Close()
    } catch [System.Net.WebException] {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    } catch { $code = 0 }
    if ($code -eq 200) { Say '   Το gearworldhub.com απαντά κανονικά: ΕΝΤΑΞΕΙ' $Ok }
    else { Say ('   Το gearworldhub.com απάντησε {0}: στείλε στο Claude αυτό το μήνυμα.' -f $code) $Warn }
}

Say ''
Say 'Αν θελήσεις να το αναιρέσεις (μόνο με έγκριση):'
Say ('  npx wrangler secret delete {0} --name {1}' -f $SecretName, $HubWorker)
Say ('  και στο {0} σβήνεις το κλειδί (Delete).' -f $KeyPage)
Say ('  Η ζωντανή έκδοση από πριν είναι στο σημείωμα ασφαλείας: {0}' -f $noteFile)
Say ''
Say 'Αποτέλεσμα: ΕΤΟΙΜΟ. Μπορείς να κλείσεις το παράθυρο του κλειδιού στο MailerLite.' $Ok
Finish 0
