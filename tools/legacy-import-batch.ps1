<#
.SYNOPSIS
  Runs legacy-import.ps1 for several shop/site pairs one after another and gathers ONE report (clipboard).

.DESCRIPTION
  Without -Apply: READ-ONLY for every pair (plan + comparison with each site's database). Changes nothing.
  With -Apply: each pair shows its plan again and asks for ITS OWN approval phrase (ΕΓΚΡΙΝΩ <SHOP> <SITE>).
  Enter without a phrase skips that pair and the next pair still asks. Each import takes its own restore point first.
  The pairs do not depend on each other (different sites, or different shops on one site).

  -Tgw: also Technology Gear World, after the pairs. Without -Apply its read-only plan (tgw-import-plan.ps1); with
  -Apply its import (tgw-cloudflare.ps1 -Step import), which asks its own phrase ΕΓΚΡΙΝΩ TGW IMPORT.

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
foreach ($p in ($Pairs -split ',')) {
    $t = $p.Trim().ToLower()
    if ($t -notmatch '^[a-z0-9\-]{2,40}:(mgw|wgw|kgw|hgw|ggw)$') {
        Write-Host ('Λάθος ζευγάρι κατάστημα:site: {0}' -f $p) -ForegroundColor Red
        exit 2
    }
    $list += $t
}

$mode = 'ΔΟΚΙΜΗ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ'
if ($Apply) { $mode = 'ΕΙΣΑΓΩΓΗ - κάθε site ζητά τη δική του φράση έγκρισης' }
Write-Host ''
Write-Host ('Εισαγωγές για {0} ζευγάρια - {1}' -f $list.Count, $mode) -ForegroundColor Cyan

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
    if ($Apply) { $a += '-Apply' }
    & $exe @a
    $results += ('{0} -> {1}: exit {2}' -f $parts[0], $parts[1].ToUpper(), $LASTEXITCODE)
}

# Technology Gear World has its own tools (another database layout): its plan, or its import with its own phrase.
if ($Tgw) {
    Write-Host ''
    Write-Host '===== Technology Gear World (TGW) =====' -ForegroundColor Cyan
    if ($Apply) {
        $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path (Join-Path $repo 'tools') 'tgw-cloudflare.ps1'), '-Step', 'import', '-Apply', '-OutDir', $OutDir, '-NoClipboard')
    } else {
        $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path (Join-Path $repo 'tools') 'tgw-import-plan.ps1'), '-OutDir', $OutDir, '-NoClipboard')
    }
    if ($Archive) { $a += @('-Archive', $Archive) }
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
