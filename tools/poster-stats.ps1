<#
.SYNOPSIS
  Poster QR scans (lessons L76): how many times each A3 poster was scanned, per site and per day. READ-ONLY.

.DESCRIPTION
  Reads the table poster_scans of the D1 database gear-world-posters (only SELECT) and shows:
    1. poster x site: the scans of the last -Days days (default 30), with the total per poster and per site;
    2. per day: the scans of every day that had any, per poster.
  Posters: poster10 (the old one), poster-a, poster-b, poster-c; "other" = a poster name the counter does not know;
  poster-test = the test after the setup (deleted with tools/poster-setup.ps1 -Step test-cleanup).
  A cell of 200 means the daily limit of the counter was reached (most likely a bot, lessons L76).
  Changes nothing. Report: <home>\gear-world-reports\POSTER_STATS_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateRange(1, 3660)]
    [int]$Days = 30,
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$DbName = 'gear-world-posters'
$Cap = 200
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'gear-world-posters' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$SiteOrder = @('hub', 'cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw', 'tgw', 'vgw', 'agw', 'sgw')
$PosterOrder = @('poster10', 'poster-a', 'poster-b', 'poster-c', 'other', 'poster-test')

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('POSTER_STATS_{0}.txt' -f $stamp)
    $text = $L -join "`r`n"
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
    exit $code
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
function Invoke-Wrangler([string]$Folder, [string]$Arguments) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $result = $null
    for ($try = 1; $try -le 3; $try++) {
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-poster-stats-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
        [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        }
        $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
        $result = @{ code = $code; text = $text }
        $passing = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|code: 7403|code: 10000'
        if ($code -eq 0 -or -not $passing -or $try -eq 3) { break }
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

# The JSON array that wrangler printed with --json (warnings before it are skipped), as a flat array of its items.
# Windows PowerShell 5.1 gives a JSON array back as ONE object (the array) and PowerShell 7 as its items: both end up
# here as the items (lessons L76).
function Get-JsonArray([string]$text) {
    $m = [regex]::Match($text, '(?m)^\s*\[')
    $j = $text.LastIndexOf(']')
    if (-not $m.Success -or $j -le $m.Index) { return $null }
    try { $parsed = ConvertFrom-Json -InputObject $text.Substring($m.Index, $j - $m.Index + 1) } catch { return $null }
    $items = New-Object System.Collections.ArrayList
    foreach ($x in @($parsed)) { if ($null -ne $x) { [void]$items.Add($x) } }
    # The comma keeps an empty array an array (PowerShell returns nothing for a bare @()).
    return , $items.ToArray()
}

# Today in London (the owner's time), as the counter writes the days.
function Get-LondonToday {
    try {
        $tz = [System.TimeZoneInfo]::FindSystemTimeZoneById('GMT Standard Time')
        return [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $tz).Date
    } catch {
        try {
            $tz = [System.TimeZoneInfo]::FindSystemTimeZoneById('Europe/London')
            return [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $tz).Date
        } catch { return [DateTime]::UtcNow.Date }
    }
}

function Pad([string]$s, [int]$n) { if ($s.Length -ge $n) { return $s } return ($s + (' ' * ($n - $s.Length))) }
function PadL([string]$s, [int]$n) { if ($s.Length -ge $n) { return $s } return ((' ' * ($n - $s.Length)) + $s) }

# ---------------- start ----------------
$today = Get-LondonToday
$from = $today.AddDays(1 - $Days).ToString('yyyy-MM-dd')
$to = $today.ToString('yyyy-MM-dd')
Say ('ΣΑΡΩΣΕΙΣ ΑΦΙΣΩΝ (QR) - {0} έως {1} ({2} μέρες, ώρα Λονδίνου) - ΜΟΝΟ ΑΝΑΓΝΩΣΗ' -f $from, $to, $Days) 'Cyan'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }

# wrangler of this repo version (npm ci once per version, shared with tools/poster-setup.ps1)
$ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
$dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    foreach ($item in @('package.json', 'package-lock.json')) { Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Force }
}
if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
    Write-Host 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-poster-stats-npm-ci.cmd'
    [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
    & $cmdFile
    $code = $LASTEXITCODE
    Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
}

# BETWEEN, not >=: the characters < > & | ^ % never go to the command line (Invoke-Wrangler refuses them).
$sql = "SELECT day, campaign, site, scans FROM poster_scans WHERE day BETWEEN '$from' AND '$to' ORDER BY day, campaign, site"
$r = Invoke-Wrangler $dest ('d1 execute {0} --remote --json --command "{1}"' -f $DbName, $sql)
if ($r.code -ne 0) {
    if ($r.text -match '(?i)not authenticated|wrangler login') { Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 4 }
    if ($r.text -match '(?i)no such table|couldn.t find|not found|does not exist') { Say 'Η μέτρηση δεν έχει στηθεί ακόμα (δεν βρέθηκε η βάση gear-world-posters ή ο πίνακας). Πρώτα το tools/poster-setup.ps1.' 'Yellow'; Finish 2 }
    Say 'Δεν μπόρεσα να διαβάσω τη βάση των αφισών. Ξανατρέξε σε λίγο. Έξοδος:' 'Red'
    foreach ($line in @($r.text -split "`n" | Select-Object -Last 10)) { Say ('  ' + $line) }
    Finish 6
}
$j = Get-JsonArray $r.text
if ($null -eq $j -or $j.Count -lt 1) { Say 'Η απάντηση του Cloudflare δεν είχε τη μορφή που περίμενα. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 6 }
$rows = @(@($j[0].results) | Where-Object { $_ -and [string]$_.day -match '^\d{4}-\d{2}-\d{2}$' })

# Sum per poster x site and per day x poster
$cell = @{}
$daySum = @{}
$posters = New-Object System.Collections.Generic.List[string]
foreach ($p in $PosterOrder) { $posters.Add($p) }
$capped = @()
foreach ($row in $rows) {
    $p = ([string]$row.campaign).ToLower()
    $s = ([string]$row.site).ToLower()
    $n = [int]$row.scans
    if (-not $posters.Contains($p)) { $posters.Add($p) }
    $k = $p + '|' + $s
    if ($cell.ContainsKey($k)) { $cell[$k] += $n } else { $cell[$k] = $n }
    $dk = [string]$row.day + '|' + $p
    if ($daySum.ContainsKey($dk)) { $daySum[$dk] += $n } else { $daySum[$dk] = $n }
    if ($n -ge $Cap) { $capped += ('{0} {1} {2}' -f $row.day, $p, $s.ToUpper()) }
}
$used = @($posters | Where-Object { $p = $_; @($rows | Where-Object { ([string]$_.campaign).ToLower() -eq $p }).Count -gt 0 -or $PosterOrder.IndexOf($p) -lt 4 })
$total = ($rows | Measure-Object -Property scans -Sum).Sum
if (-not $total) { $total = 0 }

Say ''
Say ('Σύνολο: {0} σαρώσεις' -f $total)
if ($rows.Count -eq 0) { Say 'Καμία σάρωση σε αυτές τις μέρες.' }

# 1. Poster x site
Say ''
Say '1. Αφίσα × site (σαρώσεις)'
$w = 11
$head = (Pad 'Αφίσα' $w)
foreach ($s in $SiteOrder) { $head += (PadL $s.ToUpper() 5) }
$head += (PadL 'Σύνολο' 8)
Say $head
Say ('-' * $head.Length)
$siteTot = @{}
foreach ($p in $used) {
    $line = (Pad $p $w)
    $pt = 0
    foreach ($s in $SiteOrder) {
        $v = 0
        if ($cell.ContainsKey($p + '|' + $s)) { $v = $cell[$p + '|' + $s] }
        $pt += $v
        if ($siteTot.ContainsKey($s)) { $siteTot[$s] += $v } else { $siteTot[$s] = $v }
        $line += (PadL ([string]$v) 5)
    }
    $line += (PadL ([string]$pt) 8)
    if ($p -eq 'poster-test') { $line += '  (δοκιμή)' }
    Say $line
}
Say ('-' * $head.Length)
$line = (Pad 'Σύνολο' $w)
foreach ($s in $SiteOrder) { $line += (PadL ([string]$(if ($siteTot.ContainsKey($s)) { $siteTot[$s] } else { 0 })) 5) }
$line += (PadL ([string]$total) 8)
Say $line

# 2. Per day (only days with scans)
Say ''
Say '2. Ανά μέρα (μόνο μέρες με σαρώσεις)'
$head = (Pad 'Μέρα' 12) + (PadL 'Σύνολο' 8)
foreach ($p in $used) { $head += (PadL $p 12) }
Say $head
Say ('-' * $head.Length)
$daysSeen = @($rows | ForEach-Object { [string]$_.day } | Sort-Object -Unique -Descending)
foreach ($d in $daysSeen) {
    $dt = 0
    $parts = ''
    foreach ($p in $used) {
        $v = 0
        if ($daySum.ContainsKey($d + '|' + $p)) { $v = $daySum[$d + '|' + $p] }
        $dt += $v
        $parts += (PadL ([string]$v) 12)
    }
    Say ((Pad $d 12) + (PadL ([string]$dt) 8) + $parts)
}
if ($daysSeen.Count -eq 0) { Say '(καμία)' }

Say ''
if ($capped.Count -gt 0) {
    Say ('ΠΡΟΣΟΧΗ: σε {0} κελιά η μέτρηση έφτασε το όριο των {1} σαρώσεων τη μέρα (μάλλον bot):' -f $capped.Count, $Cap) 'Yellow'
    foreach ($c in $capped) { Say ('  - ' + $c) }
} else {
    Say ('Όριο {0} σαρώσεων τη μέρα ανά αφίσα και site: δεν το έφτασε κανένα κελί: ΕΝΤΑΞΕΙ' -f $Cap) 'Green'
}
Say 'Σημείωση: μια ανανέωση της σελίδας από τον ίδιο άνθρωπο μετράει ξανά (χωρίς cookies και IP δεν ξεχωρίζει).'
Say 'Μόνο ανάγνωση: δεν άλλαξε τίποτα.'
Finish 0
