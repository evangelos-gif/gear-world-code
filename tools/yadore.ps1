<#
.SYNOPSIS
  Yadore (pay per click) on the 13 Gear World sites (lessons L235). Read-only unless -Apply and the typed approval phrase.

.DESCRIPTION
  The API key is only in Anna's email of 20 Nov 2026 (Yadore). It is typed ONCE at a hidden prompt of this tool and kept
  encrypted for this Windows user (DPAPI) in <home>\gear-world-secrets\yadore-api.dat; it never goes to a chat, GitHub,
  the plan or a report. The Worker secret YADORE_API_KEY is the switch: without it no site shows the box.

  -Step plan     READ-ONLY at Yadore and on the sites (default). The first time it asks for the key (hidden) and keeps it
                 encrypted on this PC (that file is the only thing it writes, besides the report). Then: does the key
                 work, which markets are open, the stores of the Greek market, and for every category word of the 13
                 sites (src/lib/yadore-words.js) how many offers the box would show and from which stores, with a
                 proposed list of a few stores (never the 5 big Linkwise stores, Amazon, Aliexpress, Panora). No click.
  -Step keys     CHANGES CLOUDFLARE (Worker secrets only), one approval: ΕΓΚΡΙΝΩ YADORE ΚΛΕΙΔΙ. The key of this PC
                 (tested with one call first) goes to the 13 live Workers as YADORE_API_KEY through wrangler's input
                 (never a command line, a file or the report). Before: the names of each Worker's secrets and its
                 /api/version (backup of what was there); after: the same check. The code does not change: a secret is
                 added to the version that runs. Undo: -Step off.
  -Step off      CHANGES CLOUDFLARE, one approval: ΕΓΚΡΙΝΩ YADORE OFF. Deletes YADORE_API_KEY from the 13 Workers: the box
                 disappears at once everywhere and every /out/y/ link goes back to its page. Undo: -Step keys.
  -Step pause    CHANGES CLOUDFLARE, one approval: ΕΓΚΡΙΝΩ YADORE ΠΑΥΣΗ. -Stores 'a.gr, Tsakiris Mallas GR' (the 300-click
                 rule; names separated by commas, as Yadore writes them): the secret YADORE_PAUSE on the 13 Workers, so
                 those stores leave the box at once. -Stores is the WHOLE list (-Clear removes it: Windows PowerShell 5.1
                 drops an empty -Stores '' when it starts a script, so an empty list is never typed). The list is also
                 kept on this PC (<home>\gear-world-secrets\yadore-pause.txt, not a secret), so the plan shows the list
                 before and the undo is that list.
  -Step check    READ-ONLY. The live category pages from Greece (the network's QA header, L158) and one page per site from
                 the UK: box or not, offers, stores, marks (Sponsored, the note, the date, sponsored nofollow, no L107
                 word, no store that is never allowed). Never a /out/ or /out/y/ link.
  -Step report   READ-ONLY. Clicks and sales per store (Conversion API) and per day (Report API) from -From to -To
                 (default 2 Dec 2026 to two days ago): the 300-click rule and the 1% conversion target.
  Report: <home>\gear-world-reports\YADORE_<STEP>_<time>.txt (also copied to the clipboard).
#>
param(
    [ValidateSet('plan', 'keys', 'off', 'pause', 'check', 'report')]
    [string]$Step = 'plan',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Stores = '',
    [switch]$Clear,
    [string]$From = '',
    [string]$To = '',
    [string]$Sites = '',
    [string]$PcHome = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [string]$SecretFile = '',
    [string]$SecretEnvPrefix = '',
    [string]$Chat = '4 · Sites & Cloudflare',
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
$Phrases = @{ keys = 'ΕΓΚΡΙΝΩ YADORE ΚΛΕΙΔΙ'; off = 'ΕΓΚΡΙΝΩ YADORE OFF'; pause = 'ΕΓΚΡΙΝΩ YADORE ΠΑΥΣΗ' }
$SecretName = 'YADORE_API_KEY'
$PauseName = 'YADORE_PAUSE'
# The 13 live Workers and their domains (the same names as the site tools and sites/*/wrangler.jsonc.example).
$Workers = @(
    @{ Code = 'cgw'; Worker = 'construction-gear-uk'; Domain = 'constructiongearworld.com' },
    @{ Code = 'ggw'; Worker = 'garden-gear-world'; Domain = 'gardengearworld.com' },
    @{ Code = 'hgw'; Worker = 'home-gear-world'; Domain = 'homegearworld.com' },
    @{ Code = 'kgw'; Worker = 'kids-gear-world'; Domain = 'kidsgearworld.com' },
    @{ Code = 'mgw'; Worker = 'mens-gear-world'; Domain = 'mensgearworld.com' },
    @{ Code = 'wgw'; Worker = 'womens-gear-world'; Domain = 'womensgearworld.com' },
    @{ Code = 'agw'; Worker = 'car-gear-world'; Domain = 'cargearworld.com' },
    @{ Code = 'bgw'; Worker = 'biker-gear-world'; Domain = 'bikergearworld.com' },
    @{ Code = 'tgw'; Worker = 'technology-gear-world'; Domain = 'technologygearworld.com' },
    @{ Code = 'vgw'; Worker = 'travel-gear-world'; Domain = 'travelgearworld.com' },
    @{ Code = 'sgw'; Worker = 'sporty-gear-world'; Domain = 'sportygearworld.com' },
    @{ Code = 'pgw'; Worker = 'gaming-gear-world'; Domain = 'gaminggearworld.com' },
    @{ Code = 'zgw'; Worker = 'pets-gear-world'; Domain = 'petsgearworld.com' }
)
if (-not $PcHome) { $PcHome = $HOME }
if (-not $WorkDir) { $WorkDir = Join-Path $PcHome 'gear-world-yadore' }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
if (-not $SecretFile) { $SecretFile = Join-Path (Join-Path $PcHome 'gear-world-secrets') 'yadore-api.dat' }
$PauseFile = Join-Path (Split-Path -Parent $SecretFile) 'yadore-pause.txt'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$script:Secrets = New-Object System.Collections.Generic.List[string]

$L = New-Object System.Collections.Generic.List[string]
function Hide-Secrets([string]$text) {
    foreach ($s in $script:Secrets) { if ($s -and $s.Length -ge 6) { $text = $text.Replace($s, '[κλειδί]') } }
    return $text
}
function Say([string]$text, [string]$color = '') {
    $text = Hide-Secrets $text
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}
function Hide-Ids([string]$Text) {
    $t = [regex]::Replace($Text, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
    return [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{28}\b', '${1}-masked-id')
}
function Finish([int]$code) {
    [System.Environment]::SetEnvironmentVariable('GW_YADORE_KEY', $null)
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('YADORE_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('YADORE_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = Hide-Secrets (Hide-Ids ($L -join "`r`n"))
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host ('Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «{0}» και πάτα Ctrl+V.' -f $Chat) -ForegroundColor Green }
    exit $code
}
trap {
    Say ('Απρόβλεπτο σφάλμα: {0}' -f $_.Exception.Message) 'Red'
    Say 'Σταμάτησα εδώ. Ό,τι γράφει πιο πάνω έγινε, τίποτα μετά. Στείλε την αναφορά στο Claude.' 'Red'
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

# The key: this PC's encrypted file, else the hidden prompt (then kept encrypted). In the tests: <prefix>YADORE_API_KEY.
function Read-PcKey {
    if (-not (Test-Path -LiteralPath $SecretFile)) { return '' }
    try {
        $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($SecretFile).Trim())
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
        try { $t = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    } catch { return '' }
    $t = ([string]$t).Trim()
    if ($t) { $script:Secrets.Add($t) }
    return $t
}
function Get-Key([switch]$AllowPrompt) {
    if ($SecretEnvPrefix) {
        $k = ([string][System.Environment]::GetEnvironmentVariable($SecretEnvPrefix + $SecretName)).Trim()
        if ($k) { $script:Secrets.Add($k); return @{ key = $k; from = 'test' } }
        return @{ key = ''; from = '' }
    }
    $k = Read-PcKey
    if ($k) { return @{ key = $k; from = 'file' } }
    if (-not $AllowPrompt) { return @{ key = ''; from = '' } }
    Write-Host ''
    Write-Host 'Δεν βρήκα το κλειδί του Yadore σε αυτόν τον υπολογιστή.' -ForegroundColor Yellow
    Write-Host 'Άνοιξε το email της Άννας (Yadore, 20/11) στο Gmail, αντέγραψε ΜΟΝΟ το API key και επικόλλησέ το εδώ.' -ForegroundColor Yellow
    Write-Host 'Δεν θα φαίνεται όσο το επικολλάς. Σκέτο Enter = σταματάω χωρίς αλλαγές.' -ForegroundColor Yellow
    try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
    $sec = Read-Host 'Yadore API key' -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { $k = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $k = ([string]$k).Trim()
    if ($k) { $script:Secrets.Add($k) }
    return @{ key = $k; from = 'prompt' }
}
function Save-PcKey([string]$k) {
    $dir = Split-Path -Parent $SecretFile
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $enc = ConvertFrom-SecureString (ConvertTo-SecureString $k -AsPlainText -Force)
    [System.IO.File]::WriteAllText($SecretFile, $enc, [System.Text.Encoding]::ASCII)
}

# Runs tools/yadore-api.mjs (the key only in its environment, for this call) and returns its JSON answer, or $null.
function Invoke-YadoreApi([string[]]$NodeArgs, [string]$Key) {
    $a = @((Join-Path (Join-Path $repo 'tools') 'yadore-api.mjs')) + $NodeArgs
    $oldEnc = $null
    try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
    if ($Key) { $env:GW_YADORE_KEY = $Key }
    try { $o = @(& node @a) } finally {
        [System.Environment]::SetEnvironmentVariable('GW_YADORE_KEY', $null)
        if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } }
    }
    $line = [string](($o | Where-Object { "$_".StartsWith('{') }) | Select-Object -Last 1)
    if (-not $line) { return $null }
    try { return ($line | ConvertFrom-Json) } catch { return $null }
}
function Say-Lines($R) {
    if ($null -eq $R) { return }
    foreach ($x in @($R.lines)) { Say ([string]$x) }
}

function New-CmdFile([string]$Folder, [string]$Arguments) {
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-yadore-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
    [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
    return $cmdFile
}
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [string]$InputText = '', [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = New-CmdFile $Folder $Arguments
        $oldEnc = $null
        try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
        try {
            if ($InputText) { $out = @($InputText | & $cmdFile) } else { $out = @(& $cmdFile) }
            $code = $LASTEXITCODE
        } finally {
            if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } }
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        }
        $text = Hide-Secrets ((($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', '')
        $result = @{ code = $code; text = $text }
        $passing = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|code: 7403|code: 10000'
        if ($code -eq 0 -or -not $passing -or $try -eq $tries) { break }
        Say ('Προσωρινό πρόβλημα με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/{2})...' -f (5 * $try), ($try + 1), $tries) 'Yellow'
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}
function Get-JsonArray([string]$text) {
    $m = [regex]::Match($text, '(?m)^\s*\[')
    $j = $text.LastIndexOf(']')
    if (-not $m.Success -or $j -le $m.Index) { return $null }
    try { $parsed = ConvertFrom-Json -InputObject $text.Substring($m.Index, $j - $m.Index + 1) } catch { return $null }
    $items = New-Object System.Collections.ArrayList
    foreach ($x in @($parsed)) { if ($null -ne $x) { [void]$items.Add($x) } }
    return , $items.ToArray()
}
# The names of a Worker's secrets (never values); $null when unreadable.
function Get-SecretNames([string]$folder, [string]$worker) {
    $r = Invoke-Wrangler $folder ('secret list --name {0}' -f $worker) -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { return $null }
    $names = New-Object System.Collections.ArrayList
    foreach ($s in $j) { if ([string]$s.name) { [void]$names.Add([string]$s.name) } }
    return , $names.ToArray()
}
# A JSON string with every letter outside ASCII as \uXXXX: Windows PowerShell 5.1 pipes text to a program in
# $OutputEncoding (ASCII), which would turn Greek letters into "?" (independent review of L235).
function ConvertTo-AsciiJson([string]$s) {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('"')
    foreach ($ch in $s.ToCharArray()) {
        $c = [int]$ch
        if ($ch -eq '"') { [void]$sb.Append('\"') }
        elseif ($ch -eq '\') { [void]$sb.Append('\\') }
        elseif ($c -lt 32 -or $c -gt 126) { [void]$sb.Append(('\u{0:x4}' -f $c)) }
        else { [void]$sb.Append($ch) }
    }
    [void]$sb.Append('"')
    return $sb.ToString()
}
# One secret through wrangler's standard input only (secret bulk): never on a command line, in a file or in the report.
function Set-Secret([string]$folder, [string]$worker, [string]$name, [string]$value) {
    $json = '{' + (ConvertTo-AsciiJson $name) + ':' + (ConvertTo-AsciiJson $value) + '}'
    $r = Invoke-Wrangler $folder ('secret bulk --name {0}' -f $worker) $json
    $json = ''
    return $r
}
function Remove-Secret([string]$folder, [string]$worker, [string]$name) {
    return (Invoke-Wrangler $folder ('secret delete {0} --name {1}' -f $name, $worker) 'y')
}
# The live code version of a site (/api/version, lessons L156), '' when it cannot be read.
function Get-LiveCommit([string]$domain) {
    if ($env:GW_TEST_YADORE_VERSION) { return $env:GW_TEST_YADORE_VERSION }
    try {
        $r = Invoke-WebRequest -Uri ('https://{0}/api/version' -f $domain) -UseBasicParsing -TimeoutSec 20 -Headers @{ 'User-Agent' = 'GearWorldQA-bot/1.0 (+read-only check)' }
        $j = $r.Content | ConvertFrom-Json
        return ([string]$j.commit)
    } catch { return '' }
}
function Prepare-Deploy {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        foreach ($item in @('package.json', 'package-lock.json')) {
            $src = Join-Path $repo $item
            if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $dest -Force }
        }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-yadore-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
    }
    return $dest
}

# ---------------- start ----------------
$mode = 'ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει τίποτα στα sites)'
if ($Apply -and ($Step -eq 'keys' -or $Step -eq 'off' -or $Step -eq 'pause')) { $mode = 'APPLY (με έγκριση)' }
Say ('YADORE (L235) - step: {0} - {1} - {2}' -f $Step, $mode, (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not $env:GW_TEST_YADORE_API -and -not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
$siteList = @()
if ($Sites) { $siteList = @($Sites.ToLower() -split '[,\s]+' | Where-Object { $_ }) }
$targets = @($Workers | Where-Object { $siteList.Count -eq 0 -or $siteList -contains $_.Code })
if ($targets.Count -eq 0) { Say ('Κανένα site με αυτά τα γράμματα: {0}' -f $Sites) 'Red'; Finish 2 }

# ================= check (read-only, no key) =================
if ($Step -eq 'check') {
    $na = @('site-check', '--root', $repo)
    if ($siteList.Count -gt 0) { $na += @('--sites', ($siteList -join ',')) }
    $R = Invoke-YadoreApi $na ''
    if ($null -eq $R) { Say 'Ο έλεγχος δεν έδωσε απάντηση. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 6 }
    Say-Lines $R
    Say ''
    if ($R.ok) { Say 'Αποτέλεσμα: 🟢 ΕΝΤΑΞΕΙ (μόνο ανάγνωση, κανένα link /out/ δεν άνοιξε).' 'Green'; Finish 0 }
    Say 'Αποτέλεσμα: 🔴 ΠΡΟΒΛΗΜΑ (δες τις γραμμές πιο πάνω). Τίποτα δεν άλλαξε.' 'Red'
    Finish 6
}

# ================= plan and report (read-only at Yadore) =================
if ($Step -eq 'plan' -or $Step -eq 'report') {
    $k = Get-Key -AllowPrompt:($Step -eq 'plan')
    if (-not $k.key) {
        if ($Step -eq 'plan') { Say 'Δεν δόθηκε κλειδί: σταμάτησα χωρίς αλλαγές.' 'Yellow' } else { Say ('Δεν υπάρχει κλειδί σε αυτόν τον υπολογιστή ({0}): πρώτα -Step plan.' -f $SecretFile) 'Red' }
        Finish 1
    }
    if ($k.key -match '\s' -or $k.key.Length -lt 16) { Say '🔴 ΠΡΟΒΛΗΜΑ: αυτό δεν μοιάζει με κλειδί (κενά ή πολύ μικρό). Δεν το κράτησα.' 'Red'; Finish 2 }
    $T = Invoke-YadoreApi @('test') $k.key
    if ($null -eq $T -or -not $T.ok) {
        Say-Lines $T
        if ($k.from -eq 'prompt') { Say 'Το κλειδί ΔΕΝ κρατήθηκε (η δοκιμή στο Yadore απέτυχε). Τίποτα δεν άλλαξε.' 'Red' }
        Finish 5
    }
    if ($k.from -eq 'prompt') {
        Save-PcKey $k.key
        Say ('Το κλειδί δούλεψε και κρατήθηκε κρυπτογραφημένο για αυτόν τον χρήστη των Windows: {0}' -f $SecretFile) 'Green'
        Say '  (μόνο αυτός ο υπολογιστής και αυτός ο χρήστης μπορούν να το ανοίξουν· δεν γράφεται πουθενά αλλού)'
    } elseif ($k.from -eq 'file') { Say ('Κλειδί: από το κρυπτογραφημένο αρχείο {0}' -f $SecretFile) }
    if ($Step -eq 'plan') {
        Say 'Διαβάζω τα καταστήματα και δοκιμάζω τις λέξεις των κατηγοριών (περίπου 200 κλήσεις, 1-3 λεπτά, κανένα κλικ)...'
        $na = @('plan', '--market', 'gr')
        if ($siteList.Count -gt 0) { $na += @('--sites', ($siteList -join ',')) }
        $R = Invoke-YadoreApi $na $k.key
    } else {
        if (-not $From) { $From = '2026-12-02' }
        if (-not $To) { $To = (Get-Date).ToUniversalTime().AddDays(-2).ToString('yyyy-MM-dd') }
        if ($To -lt $From) { $To = $From }
        $R = Invoke-YadoreApi @('report', '--market', 'gr', '--from', $From, '--to', $To) $k.key
    }
    if ($null -eq $R) { Say 'Το Yadore δεν έδωσε απάντηση. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 5 }
    Say-Lines $R
    Say ''
    if ($R.ok) { Say 'Αποτέλεσμα: 🟢 ΕΝΤΑΞΕΙ (μόνο ανάγνωση στο Yadore και στα sites, κανένα κλικ).' 'Green'; Finish 0 }
    Say 'Αποτέλεσμα: 🔴 ΠΡΟΒΛΗΜΑ (δες πιο πάνω). Τίποτα δεν άλλαξε στα sites.' 'Red'
    Finish 5
}

# ================= keys, off, pause (Cloudflare secrets of the 13 Workers) =================
$folder = Prepare-Deploy
$who = Invoke-Wrangler $folder 'whoami' '' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    Say 'Δεν μπόρεσα να ελέγξω τη σύνδεση με το Cloudflare (wrangler whoami). Στείλε στο Claude αυτό το μήνυμα.' 'Red'
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: 🟢 ΕΝΤΑΞΕΙ' 'Green'

$key = ''
$pauseList = ''
if ($Step -eq 'keys') {
    $k = Get-Key
    if (-not $k.key) { Say ('Δεν υπάρχει κλειδί σε αυτόν τον υπολογιστή ({0}). Πρώτα: -Step plan (ζητά το κλειδί μία φορά).' -f $SecretFile) 'Red'; Finish 1 }
    $key = $k.key
    if ($env:GW_TEST_YADORE_API) { $T = $env:GW_TEST_YADORE_API | ConvertFrom-Json } else { $T = Invoke-YadoreApi @('test') $key }
    if ($null -eq $T -or -not $T.ok) { Say-Lines $T; Say '🔴 ΠΡΟΒΛΗΜΑ: το Yadore δεν δέχτηκε το κλειδί. Δεν άλλαξε τίποτα.' 'Red'; Finish 5 }
    if (@($T.markets) -notcontains 'gr') { Say '🔴 ΠΡΟΒΛΗΜΑ: η αγορά gr δεν είναι ανοιχτή για τον λογαριασμό. Δεν άλλαξε τίποτα.' 'Red'; Finish 5 }
    Say 'Δοκιμή κλειδιού στο Yadore (μία κλήση, /v2/markets): 🟢 ΕΝΤΑΞΕΙ, η αγορά gr είναι ανοιχτή' 'Green'
}
$pauseBefore = ''
if ($Step -eq 'pause') {
    # Names as src/lib/yadore.js storeKey() writes them: lower case, no https:// or www., no path, single spaces. Only
    # commas and new lines separate two names ("Tsakiris Mallas GR" is one name).
    # A final sigma becomes σ, as in storeKey() (JavaScript writes ς, .NET σ).
    $list = @($Stores.ToLowerInvariant() -split '[,\r\n]+' | ForEach-Object { (($_.Trim() -replace '^https?://', '') -replace '^www\.', '') -replace '/.*$', '' } | ForEach-Object { (($_ -replace '\s+', ' ').Trim()).Replace([string][char]0x03C2, [string][char]0x03C3) } | Where-Object { $_ })
    $bad = @($list | Where-Object { $_ -notmatch "^[\p{L}\p{N}][\p{L}\p{N}.\-&'+() ]{0,80}$" })
    if ($bad.Count -gt 0) { Say ('Δεν κατάλαβα αυτά τα καταστήματα: {0}' -f ($bad -join ' | ')) 'Red'; Finish 2 }
    $pauseList = (@($list | Select-Object -Unique) -join ',')
    if (-not $pauseList -and -not $Clear) { Say 'Δώσε τα καταστήματα με -Stores ''a.gr, b.gr'' ή -Clear για να σβηστεί η παύση. Δεν άλλαξε τίποτα.' 'Red'; Finish 2 }
    if ($pauseList -and $Clear) { Say '-Stores και -Clear μαζί: διάλεξε ένα. Δεν άλλαξε τίποτα.' 'Red'; Finish 2 }
    if (Test-Path -LiteralPath $PauseFile) { $pauseBefore = ([System.IO.File]::ReadAllText($PauseFile)).Trim() }
}

Say ''
Say 'Τι υπάρχει τώρα (αντίγραφο ασφαλείας: μόνο τα ΟΝΟΜΑΤΑ των secrets, ποτέ τιμές, και η έκδοση που τρέχει):'
$before = @{}
foreach ($w in $targets) {
    $names = Get-SecretNames $folder $w.Worker
    $commit = Get-LiveCommit $w.Domain
    if ($null -eq $names) { Say ('  {0} {1}: 🔴 ΠΡΟΒΛΗΜΑ: δεν διάβασα τα secrets' -f $w.Code.ToUpper(), $w.Worker) 'Red'; Finish 5 }
    $before[$w.Code] = @{ names = $names; commit = $commit }
    $has = @($names) -contains $SecretName
    $hasPause = @($names) -contains $PauseName
    $c = $commit
    if ($c.Length -gt 12) { $c = $c.Substring(0, 12) }
    if (-not $c) { $c = '?' }
    Say ('  {0} {1}: {2}={3}, {4}={5}, έκδοση {6}' -f $w.Code.ToUpper(), $w.Worker, $SecretName, $(if ($has) { 'ναι' } else { 'όχι' }), $PauseName, $(if ($hasPause) { 'ναι' } else { 'όχι' }), $c)
}

Say ''
Say 'Σχέδιο:'
if ($Step -eq 'keys') {
    Say ('  Το κλειδί του Yadore μπαίνει ως secret {0} στους {1} Workers (μέσα από την είσοδο του wrangler, δεν φαίνεται πουθενά).' -f $SecretName, $targets.Count)
    Say '  Ο κώδικας ΔΕΝ αλλάζει: το secret μπαίνει στην έκδοση που τρέχει. Ο κώδικας του Yadore (L235) δείχνει το πλαίσιο μόνο από Τετ 2/12 18:00 και μόνο σε επισκέπτες από την Ελλάδα.'
    Say '  Αναίρεση: tools/yadore.ps1 -Step off -Apply (σβήνει το secret από όλους· το πλαίσιο φεύγει αμέσως).'
} elseif ($Step -eq 'off') {
    Say ('  Σβήνει το secret {0} από τους {1} Workers: το πλαίσιο φεύγει αμέσως παντού και κάθε link /out/y/ γυρίζει στη σελίδα του.' -f $SecretName, $targets.Count)
    Say '  Αναίρεση: tools/yadore.ps1 -Step keys -Apply (με το κλειδί αυτού του υπολογιστή).'
} else {
    if ($pauseBefore) { Say ('  Λίστα παύσης πριν (από αυτόν τον υπολογιστή): {0}' -f $pauseBefore) } else { Say '  Λίστα παύσης πριν: καμία (σε αυτόν τον υπολογιστή)' }
    if ($pauseList) { Say ('  ΝΕΑ λίστα παύσης, ολόκληρη (secret {0}): {1}' -f $PauseName, $pauseList) } else { Say ('  Καμία παύση: το secret {0} σβήνεται' -f $PauseName) }
    Say '  Τα καταστήματα της λίστας φεύγουν αμέσως από το πλαίσιο και τα links τους γυρίζουν στη σελίδα.'
}
if (-not $Apply) { Say ''; Say ('Χωρίς -Apply: τίποτα δεν άλλαξε. Για να γίνει: ίδια εντολή με -Apply (φράση: {0}).' -f $Phrases[$Step]) 'Yellow'; Finish 0 }
if (-not (Confirm-Approval $Phrases[$Step])) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

Say ''
Say 'Αλλαγές:'
$done = New-Object System.Collections.Generic.List[string]
foreach ($w in $targets) {
    $label = '{0} {1}' -f $w.Code.ToUpper(), $w.Worker
    if ($Step -eq 'keys') { $r = Set-Secret $folder $w.Worker $SecretName $key }
    elseif ($Step -eq 'off') {
        if (@($before[$w.Code].names) -notcontains $SecretName) { Say ('  {0}: δεν είχε το secret, τίποτα να σβηστεί' -f $label); continue }
        $r = Remove-Secret $folder $w.Worker $SecretName
    } else {
        if ($pauseList) { $r = Set-Secret $folder $w.Worker $PauseName $pauseList }
        elseif (@($before[$w.Code].names) -contains $PauseName) { $r = Remove-Secret $folder $w.Worker $PauseName }
        else { Say ('  {0}: χωρίς παύση από πριν, τίποτα να σβηστεί' -f $label); continue }
    }
    if ($r.code -ne 0) {
        Say ('  {0}: 🔴 ΠΡΟΒΛΗΜΑ' -f $label) 'Red'
        foreach ($line in @($r.text -split "`n" | Select-Object -Last 6)) { Say ('    ' + $line) }
        Say ('Σταμάτησα. Έγιναν ήδη: {0}. Ξανατρέξε την ίδια εντολή (είναι ασφαλές) ή στείλε την αναφορά στο Claude.' -f $(if ($done.Count) { $done -join ', ' } else { 'κανένα' })) 'Red'
        Finish 7
    }
    $done.Add($w.Code.ToUpper())
    Say ('  {0}: 🟢 ΕΝΤΑΞΕΙ' -f $label) 'Green'
}
$key = ''
# The list kept on this PC is the one of all 13 sites: a run with -Sites (some sites only) does not change it.
if ($Step -eq 'pause' -and $siteList.Count -eq 0) {
    $dir = Split-Path -Parent $PauseFile
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($PauseFile, $pauseList, (New-Object System.Text.UTF8Encoding($false)))
} elseif ($Step -eq 'pause') { Say ('Με -Sites: η λίστα του υπολογιστή ({0}) ΔΕΝ άλλαξε (κρατά τη λίστα και των 13).' -f $PauseFile) 'Yellow' }

Say ''
Say 'Έλεγχος μετά (ονόματα secrets και έκδοση που τρέχει):'
$bad = 0
foreach ($w in $targets) {
    $names = Get-SecretNames $folder $w.Worker
    $commit = Get-LiveCommit $w.Domain
    $want = $true
    $name = $SecretName
    if ($Step -eq 'off') { $want = $false }
    if ($Step -eq 'pause') { $name = $PauseName; $want = [bool]$pauseList }
    $has = ($null -ne $names) -and (@($names) -contains $name)
    $same = (-not $before[$w.Code].commit) -or ($commit -eq $before[$w.Code].commit)
    if ($has -eq $want -and $same) { Say ('  {0}: 🟢 ΕΝΤΑΞΕΙ ({1} {2}, ίδια έκδοση)' -f $w.Code.ToUpper(), $name, $(if ($has) { 'υπάρχει' } else { 'δεν υπάρχει' })) 'Green' }
    else { $bad++; Say ('  {0}: 🔴 ΠΡΟΒΛΗΜΑ ({1} {2}, έκδοση {3})' -f $w.Code.ToUpper(), $name, $(if ($has) { 'υπάρχει' } else { 'δεν υπάρχει' }), $(if ($same) { 'ίδια' } else { 'ΑΛΛΑΞΕ' })) 'Red' }
}
Say ''
Say 'Αναίρεση:'
if ($Step -eq 'keys') { Say '  tools/yadore.ps1 -Step off -Apply   (φράση ΕΓΚΡΙΝΩ YADORE OFF)' }
elseif ($Step -eq 'off') { Say '  tools/yadore.ps1 -Step keys -Apply  (φράση ΕΓΚΡΙΝΩ YADORE ΚΛΕΙΔΙ)' }
elseif ($pauseBefore) { Say ('  tools/yadore.ps1 -Step pause -Apply -Stores ''{0}''   (φράση ΕΓΚΡΙΝΩ YADORE ΠΑΥΣΗ)' -f ($pauseBefore -replace "'", "''")) }
else { Say '  tools/yadore.ps1 -Step pause -Clear -Apply   (φράση ΕΓΚΡΙΝΩ YADORE ΠΑΥΣΗ: πριν δεν υπήρχε παύση)' }
if ($bad -gt 0) { Say ''; Say ('Αποτέλεσμα: 🔴 ΠΡΟΒΛΗΜΑ σε {0} site(s). Στείλε την αναφορά στο Claude.' -f $bad) 'Red'; Finish 8 }
Say ''
Say ('Αποτέλεσμα: 🟢 ΕΤΟΙΜΟ: {0} ({1} sites).' -f $(if ($Step -eq 'keys') { 'το κλειδί μπήκε' } elseif ($Step -eq 'off') { 'το Yadore σταμάτησε' } else { 'η παύση ισχύει' }), $done.Count) 'Green'
Finish 0
