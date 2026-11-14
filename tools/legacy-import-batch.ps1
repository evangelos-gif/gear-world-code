<#
.SYNOPSIS
  Runs legacy-import.ps1 for several shop/site pairs one after another and gathers ONE report (clipboard).

.DESCRIPTION
  Without -Apply: READ-ONLY for every pair (plan + comparison with each site's database). Changes nothing.
  With -Apply: first the full list of what will be imported, then ONE approval phrase for all of it:
  ΕΓΚΡΙΝΩ ALL IMPORTS (owner, 8 Nov 2026: "when we have many different retailers' feeds, one approval for all, not one
  by one"). Run the same command without -Apply first: that dry run is where every plan is checked. With the phrase,
  every pair, clean-up and site import below runs one after another and still takes ITS OWN restore point first and
  prints its own plan; a wrong phrase or Enter changes nothing at all. The pairs do not depend on each other.

  -Cleanups 'viaduct-sizes:mgw,viaduct-sizes:wgw': after the pairs, these clean-ups (legacy-cleanup.ps1). Without -Apply
  read-only; with -Apply they are covered by the one phrase. Their reports go into the same batch report.
  -Sites 'agw:104931,pgw:69178+113754,sgw:19475': the new-engine sites (AGW, PGW, SGW, VGW, BGW, ZGW) with the Awin
  advertisers to import there (several joined with +). Each runs <site>-cloudflare.ps1 -Step import -Only <advertisers>:
  without -Apply its plan only, with -Apply its import (Time Travel restore point first), covered by the one phrase.
  -Pairs none: no legacy imports, only the clean-ups, -Sites and/or TGW.

  -Tgw: also Technology Gear World, after the pairs and clean-ups. Without -Apply its read-only plan (tgw-import-plan.ps1);
  with -Apply its import (tgw-cloudflare.ps1 -Step import), covered by the one phrase.
  -PaidPlan: the Cloudflare account is on Workers Paid (passed to TGW, PGW, SGW and BGW). Without it a TGW import that
  would write more than 90,000 rows in D1 (about 11,000 products) stops before changing anything (lessons L49).
  -Approve: the phrase given on the command line instead of typing it (tests only).
  -MinFreeMb (default 1024): with less free disk space than this nothing starts (exit 6); first pc-disk-cleanup.ps1.

  Report: <home>\gear-world-reports\IMPORT_BATCH_<time>.txt (also copied to the clipboard), with every pair's
  summary and the full plan of every shop.
#>
param(
    [string]$Pairs = 'joybuy:mgw,joybuy:hgw,joybuy:kgw,joybuy:ggw,coes-kids:kgw,mytoolshed-garden:ggw',
    [switch]$Apply,
    [string]$Archive = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$Tgw,
    [string]$Cleanups = '',
    [switch]$PaidPlan,
    [string]$Sites = '',
    [string]$Approve = '',
    [int]$MinFreeMb = 1024,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$tool = Join-Path (Join-Path $repo 'tools') 'legacy-import.ps1'
$exe = (Get-Process -Id $PID).Path
$start = (Get-Date).AddSeconds(-2)
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

$list = @()
if ($Pairs.Trim().ToLower() -ne 'none') {
    foreach ($p in ($Pairs -split ',')) {
        $t = $p.Trim().ToLower()
        # CGW too (legacy-import.ps1 has it): GRABO on Construction Gear World (25 Oct 2026, lessons L63).
        if ($t -notmatch '^[a-z0-9\-]{2,40}:(cgw|mgw|wgw|kgw|hgw|ggw)$') {
            Write-Host ('Λάθος ζευγάρι κατάστημα:site: {0}' -f $p) -ForegroundColor Red
            exit 2
        }
        $list += $t
    }
}
$cleanList = @()
foreach ($c in ($Cleanups -split ',')) {
    $t = $c.Trim().ToLower()
    if (-not $t) { continue }
    if ($t -notmatch '^[a-z0-9\-]{2,40}:(mgw|wgw|kgw|hgw|ggw)$') {
        Write-Host ('Λάθος καθάρισμα κανόνες:site: {0}' -f $c) -ForegroundColor Red
        exit 2
    }
    $cleanList += $t
}

# New-engine sites: site:advertiser+advertiser (Awin numbers), e.g. agw:104931,pgw:69178+113754.
$siteList = @()
foreach ($e in ($Sites -split ',')) {
    $t = $e.Trim().ToLower()
    if (-not $t) { continue }
    if ($t -notmatch '^(agw|pgw|sgw|vgw|bgw|zgw):[0-9]{2,9}(\+[0-9]{2,9})*$') {
        Write-Host ('Λάθος site:καταστήματα στο -Sites: {0} (π.χ. agw:104931 ή pgw:69178+113754)' -f $e) -ForegroundColor Red
        exit 2
    }
    $parts = $t -split ':'
    $siteList += New-Object PSObject -Property @{ site = $parts[0]; only = ($parts[1] -replace '\+', ',') }
}
$paidSites = @('pgw', 'sgw', 'bgw')

# One phrase for the whole batch (owner, 8 Nov 2026). Accents, case and Latin "EGKRINO" do not matter.
$AllPhrase = 'ΕΓΚΡΙΝΩ ALL IMPORTS'
function Normalize-Phrase([string]$s) {
    $d = ([string]$s).Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    $t = ($sb.ToString().ToUpperInvariant() -replace '\s+', ' ').Trim()
    return ($t -replace '^EGKRINO ', 'ΕΓΚΡΙΝΩ ')
}

$mode = 'ΔΟΚΙΜΗ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ'
if ($Apply) { $mode = 'ΕΙΣΑΓΩΓΗ - μία φράση έγκρισης για όλα' }
Write-Host ''
Write-Host ('Εισαγωγές για {0} ζευγάρια και {1} νέα sites - {2}' -f $list.Count, $siteList.Count, $mode) -ForegroundColor Cyan

# 8 Nov 2026: an import stopped with "ENOSPC: no space left on device". With too little free space nothing starts.
$freeMb = -1
try { $freeMb = [Math]::Floor((New-Object System.IO.DriveInfo([System.IO.Path]::GetPathRoot((Resolve-Path -LiteralPath $OutDir).Path))).AvailableFreeSpace / 1MB) } catch { }
if ($MinFreeMb -gt 0 -and $freeMb -ge 0 -and $freeMb -lt $MinFreeMb) {
    $msg = ('Ο δίσκος έχει μόνο {0} MB ελεύθερα (χρειάζονται τουλάχιστον {1} MB). Δεν ξεκίνησε τίποτα, δεν άλλαξε τίποτα. Πρώτα το καθάρισμα χώρου (εργαλείο pc-disk-cleanup).' -f $freeMb, $MinFreeMb)
    Write-Host $msg -ForegroundColor Red
    $file0 = Join-Path $OutDir ('IMPORT_BATCH_{0}.txt' -f $stamp)
    $text0 = ('IMPORT BATCH {0} - {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $mode) + "`r`n" + $msg + "`r`n"
    try { [System.IO.File]::WriteAllText($file0, $text0, (New-Object System.Text.UTF8Encoding($true))) } catch { }
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text0 } catch { } }
    exit 6
}

if ($Apply) {
    $jobs = @()
    foreach ($pair in $list) { $pp = $pair -split ':'; $jobs += ('{0} -> {1}' -f $pp[0], $pp[1].ToUpper()) }
    foreach ($c in $cleanList) { $pp = $c -split ':'; $jobs += ('καθάρισμα {0} -> {1}' -f $pp[0], $pp[1].ToUpper()) }
    foreach ($e in $siteList) { $jobs += ('{0}: καταστήματα Awin {1}' -f $e.site.ToUpper(), $e.only) }
    if ($Tgw) { $jobs += 'TGW: όλα τα καταστήματα του Technology' }
    if ($jobs.Count -eq 0) { Write-Host 'Δεν δόθηκε τίποτα για εισαγωγή.' -ForegroundColor Yellow; exit 2 }
    Write-Host ''
    Write-Host 'Τι θα γίνει, το ένα μετά το άλλο (το καθένα παίρνει πρώτα το δικό του σημείο επαναφοράς):' -ForegroundColor Cyan
    $k = 0
    foreach ($j in $jobs) { $k++; Write-Host ('  {0,2}. {1}' -f $k, $j) }
    Write-Host 'Τα σχέδιά τους είναι αυτά της δοκιμής (η ίδια εντολή χωρίς -Apply).'
    $typed = $Approve
    if (-not $typed) {
        Write-Host ''
        Write-Host ('Για να γίνουν ΟΛΑ, γράψε ακριβώς: {0}' -f $AllPhrase) -ForegroundColor Yellow
        Write-Host '(ή πάτα Enter για να σταματήσω χωρίς καμία αλλαγή)'
        # Lines left over from the paste (an empty last line) would answer the prompt by themselves (8 Nov 2026).
        try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
        $typed = Read-Host 'Έγκριση'
    }
    if ((Normalize-Phrase $typed) -ne (Normalize-Phrase $AllPhrase)) {
        $msg = 'Δεν δόθηκε η φράση: δεν άλλαξε τίποτα σε κανένα site.'
        Write-Host $msg -ForegroundColor Yellow
        $file0 = Join-Path $OutDir ('IMPORT_BATCH_{0}.txt' -f $stamp)
        $text0 = ('IMPORT BATCH {0} - {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $mode) + "`r`n" + (($jobs | ForEach-Object { '  ' + $_ }) -join "`r`n") + "`r`n" + $msg + "`r`n"
        [System.IO.File]::WriteAllText($file0, $text0, (New-Object System.Text.UTF8Encoding($true)))
        if (-not $NoClipboard) { try { Set-Clipboard -Value $text0 } catch { } }
        exit 1
    }
    Write-Host 'Έγκριση για όλα: ξεκινώ.' -ForegroundColor Green
}

$results = @()
$n = 0
foreach ($pair in $list) {
    $n++
    $parts = $pair -split ':'
    Write-Host ''
    Write-Host ('===== {0}/{1}: {2} -> {3} =====' -f $n, $list.Count, $parts[0], $parts[1].ToUpper()) -ForegroundColor Cyan
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $tool, '-Retailer', $parts[0], '-Site', $parts[1], '-OutDir', $OutDir, '-NoClipboard')
    if ($Archive) { $a += @('-Archive', $Archive) }
    if ($WorkDir) { $a += @('-WorkDir', $WorkDir) }
    # The one phrase covers it: the tool gets its own exact phrase (Latin EGKRINO, the same phrase without Greek letters
    # on the command line).
    if ($Apply) { $a += @('-Apply', '-Approve', ('EGKRINO {0} {1}' -f $parts[0].ToUpper(), $parts[1].ToUpper())) }
    & $exe @a
    $results += ('{0} -> {1}: exit {2}' -f $parts[0], $parts[1].ToUpper(), $LASTEXITCODE)
}

# Clean-ups after the imports (e.g. the old one-card-per-size Viaduct rows, once the new cards are on the site).
$cleanTool = Join-Path (Join-Path $repo 'tools') 'legacy-cleanup.ps1'
foreach ($c in $cleanList) {
    $parts = $c -split ':'
    Write-Host ''
    Write-Host ('===== Καθάρισμα {0} -> {1} =====' -f $parts[0], $parts[1].ToUpper()) -ForegroundColor Cyan
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $cleanTool, '-Rules', $parts[0], '-Site', $parts[1], '-OutDir', $OutDir, '-NoClipboard')
    if ($WorkDir) { $a += @('-WorkDir', $WorkDir) }
    if ($Apply) { $a += @('-Apply', '-Approve', ('EGKRINO {0} CLEANUP {1}' -f $parts[0].ToUpper(), $parts[1].ToUpper())) }
    & $exe @a
    $results += ('cleanup {0} -> {1}: exit {2}' -f $parts[0], $parts[1].ToUpper(), $LASTEXITCODE)
}

# New-engine sites (own D1 each): their plan, or their import, only for the advertisers given.
foreach ($e in $siteList) {
    Write-Host ''
    Write-Host ('===== {0}: καταστήματα Awin {1} =====' -f $e.site.ToUpper(), $e.only) -ForegroundColor Cyan
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path (Join-Path $repo 'tools') ($e.site + '-cloudflare.ps1')), '-Step', 'import', '-Only', $e.only, '-OutDir', $OutDir, '-NoClipboard')
    if ($Archive) { $a += @('-Archive', $Archive) }
    if ($Apply) { $a += @('-Apply', '-Approve', ('EGKRINO {0} IMPORT' -f $e.site.ToUpper())) }
    if ($Apply -and $PaidPlan -and ($paidSites -contains $e.site)) { $a += '-PaidPlan' }
    & $exe @a
    $results += ('{0} ({1}): exit {2}' -f $e.site.ToUpper(), $e.only, $LASTEXITCODE)
}

# Technology Gear World has its own tools (another database layout): its plan, or its import (covered by the one phrase).
if ($Tgw) {
    Write-Host ''
    Write-Host '===== Technology Gear World (TGW) =====' -ForegroundColor Cyan
    if ($Apply) {
        $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path (Join-Path $repo 'tools') 'tgw-cloudflare.ps1'), '-Step', 'import', '-Apply', '-Approve', 'EGKRINO TGW IMPORT', '-OutDir', $OutDir, '-NoClipboard')
    } else {
        $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path (Join-Path $repo 'tools') 'tgw-import-plan.ps1'), '-OutDir', $OutDir, '-NoClipboard')
    }
    if ($Archive) { $a += @('-Archive', $Archive) }
    # Cloudflare Workers Paid: an import of more than 90,000 rows written is allowed (lessons L49).
    if ($Apply -and $PaidPlan) { $a += '-PaidPlan' }
    & $exe @a
    $results += ('TGW: exit {0}' -f $LASTEXITCODE)
}

# One report: the summary of every pair, then the full plan of every shop (latest of this run).
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine(('IMPORT BATCH {0} - {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $mode))
foreach ($r in $results) { [void]$sb.AppendLine('  ' + $r) }
[void]$sb.AppendLine('(exit 0 = OK, 1 = no approval given, other = stopped, see the summary)')
$summaries = @(Get-ChildItem -LiteralPath $OutDir -File -Filter 'IMPORT_*_*.txt' | Where-Object { $_.LastWriteTime -ge $start -and $_.Name -notlike 'IMPORT_BATCH_*' } | Sort-Object LastWriteTime)
foreach ($f in $summaries) {
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('##### ' + $f.Name)
    [void]$sb.AppendLine([System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8))
}
foreach ($f in @(Get-ChildItem -LiteralPath $OutDir -File -Filter 'CLEANUP_*.txt' | Where-Object { $_.LastWriteTime -ge $start } | Sort-Object LastWriteTime)) {
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('##### ' + $f.Name)
    [void]$sb.AppendLine([System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8))
}
$plans = @(Get-ChildItem -LiteralPath $OutDir -Directory -Filter 'IMPORT_PLAN_*' | Where-Object { $_.LastWriteTime -ge $start } | Sort-Object LastWriteTime)
$latest = @{}
foreach ($d in $plans) {
    $shop = ($d.Name -replace '^IMPORT_PLAN_', '') -replace '_\d{8}_\d{6}(_\d+)?$', ''
    $latest[$shop] = $d
}
foreach ($shop in ($latest.Keys | Sort-Object)) {
    $rep = Join-Path $latest[$shop].FullName 'report.txt'
    if (-not (Test-Path -LiteralPath $rep)) { continue }
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('##### PLAN ' + $shop)
    [void]$sb.AppendLine([System.IO.File]::ReadAllText($rep, [System.Text.Encoding]::UTF8))
}
foreach ($sx in @($siteList | ForEach-Object { $_.site } | Select-Object -Unique)) {
    $SX = $sx.ToUpper()
    foreach ($f in @(Get-ChildItem -LiteralPath $OutDir -File -Filter ($SX + '_CLOUDFLARE_*.txt') | Where-Object { $_.LastWriteTime -ge $start } | Sort-Object LastWriteTime)) {
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine('##### ' + $f.Name)
        [void]$sb.AppendLine([System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8))
    }
    foreach ($d in @(Get-ChildItem -LiteralPath $OutDir -Directory -Filter ($SX + '_IMPORT_PLAN_*') | Where-Object { $_.LastWriteTime -ge $start } | Sort-Object LastWriteTime)) {
        $rep = Join-Path $d.FullName 'report.txt'
        if (-not (Test-Path -LiteralPath $rep)) { continue }
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine('##### PLAN ' + $d.Name)
        [void]$sb.AppendLine([System.IO.File]::ReadAllText($rep, [System.Text.Encoding]::UTF8))
    }
}
if ($Tgw) {
    foreach ($f in @(Get-ChildItem -LiteralPath $OutDir -File -Filter 'TGW_CLOUDFLARE_IMPORT_*.txt' | Where-Object { $_.LastWriteTime -ge $start } | Sort-Object LastWriteTime)) {
        [void]$sb.AppendLine('')
        [void]$sb.AppendLine('##### ' + $f.Name)
        [void]$sb.AppendLine([System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8))
    }
    $tgwPlans = @(Get-ChildItem -LiteralPath $OutDir -Directory -Filter 'TGW_IMPORT_PLAN_*' | Where-Object { $_.LastWriteTime -ge $start } | Sort-Object LastWriteTime)
    if ($tgwPlans.Count -gt 0) {
        $rep = Join-Path $tgwPlans[$tgwPlans.Count - 1].FullName 'report.txt'
        if (Test-Path -LiteralPath $rep) {
            [void]$sb.AppendLine('')
            [void]$sb.AppendLine('##### PLAN TGW')
            [void]$sb.AppendLine([System.IO.File]::ReadAllText($rep, [System.Text.Encoding]::UTF8))
        }
    }
}
$text = $sb.ToString()
$file = Join-Path $OutDir ('IMPORT_BATCH_{0}.txt' -f $stamp)
[System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
Write-Host ''
foreach ($r in $results) { Write-Host ('  ' + $r) }
Write-Host ('Η συνολική αναφορά γράφτηκε: {0}' -f $file) -ForegroundColor Green
if (-not $NoClipboard) {
    try { Set-Clipboard -Value $text; Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green } catch { }
}
exit 0
