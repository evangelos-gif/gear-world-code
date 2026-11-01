<#
.SYNOPSIS
  READ-ONLY: what really sells on the Gear World sites, straight from Awin (1 Nov 2026, lessons L64).

.DESCRIPTION
  Reads, without changing anything:
    1. your Awin sales (transactions) of the last -Days days from the Awin Publisher API, in windows of up to 31 days;
    2. the names of your joined programmes (shops), from the same API;
    3. the product names from the sites' databases (only SELECT).
  Then says how many sales, their value and your commission (pending / approved / declined), by site (from the clickref
  "<site>-<product id>" that the sites add to every Awin link), by shop, and every sale with its product.
  The Awin API token is asked once (from https://ui.awin.com/awin-api) and kept encrypted for your Windows user in
  <home>\gear-world-secrets\awin-api-token.dat. It is never written to a report, the clipboard or the repo, and it is
  sent only to api.awin.com, in the Authorization header. -NewToken asks for it again.
  Report: <home>\gear-world-reports\AWIN_SALES_<time>.txt (also copied to the clipboard).
#>
param(
    [int]$Days = 90,
    [string]$PublisherId = '3057233',
    [string]$TokenFile = '',
    [switch]$NewToken,
    [string]$BaseUrl = 'https://api.awin.com',
    [switch]$SkipNames,
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $TokenFile) { $TokenFile = Join-Path (Join-Path $HOME 'gear-world-secrets') 'awin-api-token.dat' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$script:Work = ''
$script:secret = ''

$L = New-Object System.Collections.Generic.List[string]
function Mask([string]$s) {
    if ($script:secret) { $s = $s.Replace($script:secret, '***') }
    return [regex]::Replace($s, '(?i)(accessToken=|Bearer\s+)[^&\s]+', '$1***')
}
function Say([string]$t, [string]$c = '') { $t = Mask $t; $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('AWIN_SALES_{0}.txt' -f $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('AWIN_SALES_{0}_{1}.txt' -f $stamp, $n); $n++ }
    $text = $L -join "`r`n"
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
    exit $code
}

# Runs wrangler through a temporary .cmd file and reads its output as UTF-8 (lessons L58). Passing Cloudflare errors are retried (L43).
function Invoke-Wrangler([string]$Arguments) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tmp = [System.IO.Path]::GetTempPath()
    $lines = @('@echo off', ('cd /d "{0}"' -f $script:Work), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $result = $null
    for ($try = 1; $try -le 3; $try++) {
        $cmdFile = Join-Path $tmp ('gw-wrangler-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
        [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
        $oldEnc = $null
        try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
            if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } }
        }
        $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
        $result = @{ code = $code; text = $text }
        $network = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|code: 7403|code: 10000'
        if ($code -eq 0 -or -not $network -or $try -eq 3) { break }
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

# GET from the Awin API into a file (raw bytes, so names keep their letters). Returns '' or the HTTP status on error.
function Get-Awin([string]$PathAndQuery, [string]$File) {
    try {
        Invoke-WebRequest -UseBasicParsing -Uri ($BaseUrl.TrimEnd('/') + $PathAndQuery) -Headers @{ Authorization = ('Bearer ' + $script:secret) } -OutFile $File -TimeoutSec 120
        return ''
    } catch {
        $status = ''
        try { $status = [string][int]$_.Exception.Response.StatusCode } catch { }
        if (-not $status) { $status = Mask $_.Exception.Message }
        return $status
    }
}

Write-Host ''
Say 'Πωλήσεις Awin ανά site - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει τίποτα)' 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
$host1 = ([uri]$BaseUrl).Host
if ($host1 -ne 'api.awin.com' -and $host1 -ne '127.0.0.1') { Say 'Μη αναμενόμενη διεύθυνση του Awin.' 'Red'; Finish 2 }
if ($PublisherId -notmatch '^\d{3,12}$') { Say 'Λάθος αριθμός publisher.' 'Red'; Finish 2 }
if ($Days -lt 1 -or $Days -gt 400) { Say 'Οι μέρες πρέπει να είναι από 1 έως 400.' 'Red'; Finish 2 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js.' 'Red'; Finish 3 }

# 1. The Awin API token (asked once, kept encrypted for this Windows user).
if ($NewToken -or -not (Test-Path -LiteralPath $TokenFile)) {
    Write-Host ''
    Write-Host 'Χρειάζομαι μία φορά το κλειδί API του Awin (είναι άλλο από το κλειδί των feeds).' -ForegroundColor Yellow
    Write-Host 'Άνοιξε https://ui.awin.com/awin-api , βάλε τον κωδικό σου του Awin, πάτα «Show my API token» και αντίγραψέ το.'
    Write-Host 'Θα φυλαχτεί κρυπτογραφημένο μόνο για τον χρήστη σου στα Windows. Δεν θα φαίνεται πουθενά.'
    $sec = Read-Host 'Κλειδί API του Awin' -AsSecureString
    if ($sec.Length -lt 16) { Say 'Δεν δόθηκε κλειδί. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
    $dir = Split-Path -Parent $TokenFile
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($TokenFile, (ConvertFrom-SecureString $sec), [System.Text.Encoding]::ASCII)
    Say 'Το κλειδί API φυλάχτηκε κρυπτογραφημένο.' 'Green'
}
try {
    $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($TokenFile).Trim())
    $script:secret = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
} catch { Say 'Δεν μπόρεσα να διαβάσω το φυλαγμένο κλειδί API. Ξανατρέξε με -NewToken για να το δώσεις ξανά.' 'Red'; Finish 3 }
if ($script:secret -notmatch '^[A-Za-z0-9\-]{16,80}$') { Say 'Το φυλαγμένο κλειδί δεν μοιάζει με κλειδί API του Awin. Ξανατρέξε με -NewToken.' 'Red'; Finish 3 }

$planDir = Join-Path $OutDir ('AWIN_SALES_PLAN_{0}' -f $stamp)
New-Item -ItemType Directory -Path $planDir -Force | Out-Null

# 2. Sales, in windows of up to 31 days (an Awin limit).
$to = (Get-Date).Date
$from = $to.AddDays(-$Days + 1)
Say ('Μέρες: {0} έως {1}' -f $from.ToString('yyyy-MM-dd'), $to.ToString('yyyy-MM-dd'))
$inArgs = @()
$start = $from
$w = 0
while ($start -le $to) {
    $end = $start.AddDays(29)
    if ($end -gt $to) { $end = $to }
    $w++
    $file = Join-Path $planDir ('transactions-{0}.json' -f $w)
    $q = '/publishers/{0}/transactions/?startDate={1}T00%3A00%3A00&endDate={2}T23%3A59%3A59&timezone=UTC&dateType=transaction' -f $PublisherId, $start.ToString('yyyy-MM-dd'), $end.ToString('yyyy-MM-dd')
    $err = Get-Awin $q $file
    if ($err -eq '401' -or $err -eq '403') { Say ('Το Awin δεν δέχτηκε το κλειδί API ({0}). Ξανατρέξε την ίδια εντολή με -NewToken στο τέλος.' -f $err) 'Red'; Finish 4 }
    if ($err) { Say ('Το Awin δεν έδωσε τις πωλήσεις {0} έως {1}: {2}' -f $start.ToString('yyyy-MM-dd'), $end.ToString('yyyy-MM-dd'), $err) 'Red'; Finish 4 }
    $inArgs += @('--in', $file)
    $start = $end.AddDays(1)
    Start-Sleep -Milliseconds 400
}

# 3. Shop names (optional).
$progFile = Join-Path $planDir 'programmes.json'
$err = Get-Awin ('/publishers/{0}/programmes?relationship=joined' -f $PublisherId) $progFile
$progArgs = @()
if ($err) { Say ('Χωρίς ονόματα καταστημάτων (το Awin έδωσε {0}): φαίνονται με τον αριθμό τους.' -f $err) 'Yellow' } else { $progArgs = @('--programmes', $progFile) }

# 4. Product names from the sites' databases (only SELECT).
$tool = Join-Path (Join-Path $repo 'tools') 'awin-sales-plan.mjs'
$idsFile = Join-Path $planDir 'ids.txt'
$a = @($tool) + $inArgs + @('--ids-out', $idsFile)
& node @a
if ($LASTEXITCODE -ne 0) { Say 'Δεν μπόρεσα να διαβάσω την απάντηση του Awin.' 'Red'; Finish 10 }
$nameArgs = @()
if (-not $SkipNames) {
    $script:Work = $WorkDir
    if (-not $script:Work) { $script:Work = Join-Path $HOME 'gear-world-import' }
    if (-not (Test-Path -LiteralPath $script:Work)) { New-Item -ItemType Directory -Path $script:Work -Force | Out-Null }
    foreach ($line in [System.IO.File]::ReadAllLines($idsFile)) {
        $parts = $line.Trim() -split ' '
        if ($parts.Count -ne 3 -or $parts[0] -notmatch '^[a-z]{3}$' -or $parts[1] -notmatch '^[a-z0-9\-]{2,60}$' -or $parts[2] -notmatch '^[0-9,]{1,4000}$') { continue }
        $r = Invoke-Wrangler ('d1 execute {0} --remote --json --command "SELECT id, product_name FROM products WHERE id IN ({1})"' -f $parts[1], $parts[2])
        if ($r.code -ne 0 -or $r.text.IndexOf('"results"') -lt 0) { Say ('{0}: δεν διάβασα τα ονόματα των προϊόντων (σύνδεση στο Cloudflare;).' -f $parts[0].ToUpper()) 'Yellow'; continue }
        $f = Join-Path $planDir ('names-{0}.txt' -f $parts[0])
        [System.IO.File]::WriteAllText($f, $r.text, (New-Object System.Text.UTF8Encoding($false)))
        $nameArgs += @('--names', ('{0}={1}' -f $parts[0], $f))
    }
}

# 5. The report.
$a = @($tool) + $inArgs + $progArgs + $nameArgs + @('--from', $from.ToString('yyyy-MM-dd'), '--to', $to.ToString('yyyy-MM-dd'), '--out', $planDir)
& node @a
if ($LASTEXITCODE -ne 0) { Say 'Η αναφορά δεν ολοκληρώθηκε.' 'Red'; Finish 10 }
Say ''
foreach ($line in [System.IO.File]::ReadAllLines((Join-Path $planDir 'report.txt'), [System.Text.Encoding]::UTF8)) {
    if ($line -match 'απορρίφθηκε \(') { Say $line 'Yellow' } else { Say $line }
}
Say ''
Say 'Δεν άλλαξε τίποτα. Οι πωλήσεις διαβάστηκαν κατευθείαν από το Awin.'
Finish 0
