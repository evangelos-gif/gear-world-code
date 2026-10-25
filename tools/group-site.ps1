<#
.SYNOPSIS
  Gear World Group company page (gearworldgroup.com) - one step at a time, each with a typed approval.

.DESCRIPTION
  A single page for retailers and affiliate networks: the Gear World sites, how we promote retailers, contact.
  No database, no cookies. It does not touch the other sites, the Hub or any database.

  -Step check    READ-ONLY. Cloudflare login and the live version of the Worker "gear-world-group" (if any).
  -Step launch   CHANGES CLOUDFLARE. Publishes the page as the Worker "gear-world-group" and connects
                 gearworldgroup.com and www to it (Cloudflare Custom Domains; email (MX) records are not touched).
                 Approval phrase: ΕΓΚΡΙΝΩ GROUP SITE
  -Step update   CHANGES THE LIVE PAGE. Publishes a newer version. Approval phrase: ΕΓΚΡΙΝΩ GROUP UPDATE

  Without -Apply, every step only shows what it WOULD do. Report: <home>\gear-world-reports\GROUP_SITE_<step>_<time>.txt
#>
param(
    [ValidateSet('check', 'launch', 'update')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard,
    [switch]$NoHttpCheck
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$WorkerName = 'gear-world-group'
$Domain = 'gearworldgroup.com'
$Phrases = @{ launch = 'ΕΓΚΡΙΝΩ GROUP SITE'; update = 'ΕΓΚΡΙΝΩ GROUP UPDATE' }
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-group' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$DashLink = 'https://dash.cloudflare.com/?to=/:account/workers/services/view/gear-world-group/production/deployments'

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('GROUP_SITE_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $text = $L -join "`r`n"
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
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
    $typed = $Approve
    if (-not $typed) {
        Write-Host ''
        Write-Host ('Για να συνεχίσω, γράψε ακριβώς: {0}' -f $phrase) -ForegroundColor Yellow
        Write-Host '(ή πάτα Enter για να σταματήσω χωρίς αλλαγές)'
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
# -Retry: on a network error ("fetch failed") or a passing Cloudflare error, try again, up to 3 times. Passing errors:
# 7403 'account not authorized' (23 Oct 2026, between two successful calls) and 10000 'Authentication error' (24 Oct
# 2026: the 1-hour wrangler sign-in ran out mid-run, L43). Only for calls that are safe to repeat.
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
        $network = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|code: 7403|code: 10000|Not currently importing anything'
        if ($code -eq 0 -or -not $network -or $try -eq $tries) { break }
        Say ('Προσωρινό πρόβλημα με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/{2})...' -f (5 * $try), ($try + 1), $tries) 'Yellow'
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

function Get-JsonArray([string]$text) {
    $i = $text.IndexOf('[')
    $j = $text.LastIndexOf(']')
    if ($i -lt 0 -or $j -le $i) { return $null }
    try { return @($text.Substring($i, $j - $i + 1) | ConvertFrom-Json) } catch { return $null }
}


function Get-LiveVersion([string]$folder) {
    $r = Invoke-Wrangler $folder ('deployments list --name {0}' -f $WorkerName) -NonInteractive -Retry
    $ms = [regex]::Matches($r.text, '\(100%\)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($ms.Count -eq 0) { return '' }
    return $ms[$ms.Count - 1].Groups[1].Value
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
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
    }
    return $dest
}

function Write-Config([string]$folder) {
    $text = [System.IO.File]::ReadAllText((Join-Path $folder 'wrangler.jsonc.example'))
    $obs = '"observability": { "enabled": true }'
    if ($text.IndexOf($obs) -lt 0) { Say 'Το πρότυπο wrangler.jsonc.example δεν έχει τη μορφή που περίμενα.' 'Red'; Finish 13 }
    $routes = $obs + ',' + "`r`n" + '  "routes": [' + "`r`n" +
        ('    {{ "pattern": "{0}", "custom_domain": true }},' -f $Domain) + "`r`n" +
        ('    {{ "pattern": "www.{0}", "custom_domain": true }}' -f $Domain) + "`r`n" + '  ]'
    $text = $text.Replace($obs, $routes)
    $file = Join-Path $folder 'wrangler.jsonc'
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($false)))
    Copy-Item -LiteralPath $file -Destination (Join-Path $WorkDir 'wrangler.jsonc') -Force
    return $file
}

# ---------------- start ----------------
Say ('GEAR WORLD GROUP - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$deploy = Prepare-Deploy
$grp = Join-Path (Join-Path $deploy 'sites') 'group'

$who = $null
for ($try = 1; $try -le 3; $try++) {
    $who = Invoke-Wrangler $grp 'whoami'
    if ($who.text -match '(?i)associated with the email|you are logged in') { break }
    if ($try -lt 3) { Start-Sleep -Seconds 5 }
}
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare ή δεν απάντησε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 20)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: OK'
$live = Get-LiveVersion $grp
Say ('Worker "{0}": {1}' -f $WorkerName, $(if ($live) { 'υπάρχει, έκδοση ' + $live } else { 'δεν υπάρχει ακόμα' }))

switch ($Step) {
    'check' { Say ''; Say 'Μόνο έλεγχος: δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
    { $_ -eq 'launch' -or $_ -eq 'update' } {
        Say ''
        Say 'Τι θα γίνει:'
        Say ('  - Ανεβαίνει η σελίδα του Gear World Group στον Worker "{0}", στο {1} και στο www.{1}.' -f $WorkerName, $Domain)
        Say '  - Η Cloudflare φτιάχνει μόνη της τις εγγραφές για τη σελίδα. Οι εγγραφές email (MX, Google) ΔΕΝ αλλάζουν.'
        Say '  - Τα 7 sites, το hub και οι βάσεις ΔΕΝ αλλάζουν.'
        if ($live) { Say ('  - Επαναφορά: Rollback στο {0} ή: npx wrangler rollback {1} --name {2}' -f $DashLink, $live, $WorkerName) }
        else { Say ('  - Επαναφορά: npx wrangler delete --name {0} (σβήνει τη σελίδα· το email δεν επηρεάζεται)' -f $WorkerName) }
        if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
        if (-not (Confirm-Approval $Phrases[$Step])) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
        $cfg = Write-Config $grp
        $d = Invoke-Wrangler $grp ('deploy --config "{0}"' -f $cfg) -NonInteractive
        if ($d.code -ne 0) { Say 'Το ανέβασμα απέτυχε. Τίποτα άλλο δεν άλλαξε. Έξοδος:' 'Red'; Say $d.text; Finish 9 }
        Say ('Ανέβηκε στο {0}.' -f $Domain) 'Green'
        if (-not $NoHttpCheck) {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $ok = $false
            for ($i = 1; $i -le 20; $i++) {
                try {
                    $r = Invoke-WebRequest -UseBasicParsing -Uri ('https://{0}/' -f $Domain) -TimeoutSec 20
                    Say ('  https://{0}/ απαντά {1}' -f $Domain, $r.StatusCode)
                    $ok = $true
                    break
                } catch { Start-Sleep -Seconds 15 }
            }
            if (-not $ok) { Say ('Το https://{0} δεν απάντησε ακόμα (το SSL θέλει έως 10 λεπτά). Άνοιξέ το σε λίγο.' -f $Domain) 'Yellow' }
        }
        Say ''
        Say ('ΕΤΟΙΜΟ: https://{0}' -f $Domain) 'Green'
        Finish 0
    }
}
