<#
.SYNOPSIS
  Puts all the reports of one paste on the clipboard together. READ-ONLY.
.DESCRIPTION
  When one paste runs several tools, each copies its own report to the clipboard and only the last one stays there.
  Run this tool last, with the time the paste started (-Since yyyyMMddHHmmss): it joins every report written in
  <home>\gear-world-reports since then (the top folder, oldest first), with the full import plans of the same time
  (IMPORT_PLAN_*\report.txt: their samples per category are what a dry run is checked by, lessons L14), writes them as
  one REPORTS_<time>.txt and copies that to the clipboard. It changes nothing else.
.EXAMPLE
  $t0 = Get-Date -Format 'yyyyMMddHHmmss'; <tool 1>; <tool 2>; powershell -NoProfile -ExecutionPolicy Bypass -File $f -Ref <commit> -Tool reports-to-clipboard -Since $t0
#>
param(
    [Parameter(Mandatory = $true)][string]$Since,
    [string]$OutDir = '',
    [switch]$NoClipboard
)
$ErrorActionPreference = 'Stop'
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if ($Since -notmatch '^\d{14}$') { Write-Host 'Λάθος ώρα έναρξης (-Since yyyyMMddHHmmss). Στείλε στο Claude την εντολή που έτρεξες.' -ForegroundColor Red; exit 2 }
$from = [datetime]::ParseExact($Since, 'yyyyMMddHHmmss', [System.Globalization.CultureInfo]::InvariantCulture)
$files = @()
if (Test-Path -LiteralPath $OutDir) {
    $top = @(Get-ChildItem -LiteralPath $OutDir -File -Filter '*.txt' | Where-Object { $_.LastWriteTime -ge $from -and $_.Name -notlike 'REPORTS_*' })
    $plans = @(Get-ChildItem -LiteralPath $OutDir -Directory -Filter 'IMPORT_PLAN_*' | ForEach-Object { Get-Item -LiteralPath (Join-Path $_.FullName 'report.txt') -ErrorAction SilentlyContinue } | Where-Object { $_ -and $_.LastWriteTime -ge $from })
    $all = @($top) + @($plans)
    $files = @($all | Sort-Object LastWriteTime, FullName)
}
$parts = New-Object System.Collections.Generic.List[string]
$parts.Add(('Όλες οι αναφορές αυτής της εντολής (από {0}): {1}' -f $from.ToString('yyyy-MM-dd HH:mm'), $files.Count))
foreach ($f in $files) {
    $parts.Add('')
    $label = $f.Name
    if ($f.Name -eq 'report.txt') { $label = (Split-Path -Leaf $f.DirectoryName) + '\report.txt' }
    $parts.Add(('########## {0} ##########' -f $label))
    $parts.Add(([System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)).TrimEnd())
}
if ($files.Count -eq 0) { $parts.Add('Δεν γράφτηκε καμία αναφορά από τότε.') }
$text = $parts -join "`r`n"
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$file = Join-Path $OutDir ('REPORTS_{0}.txt' -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
[System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
Write-Host ''
Write-Host ('{0} αναφορές μαζί: {1}' -f $files.Count, $file)
if (-not $NoClipboard) {
    try { Set-Clipboard -Value $text } catch { }
    Write-Host 'Όλες μαζί αντιγράφηκαν στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green
}
exit 0
