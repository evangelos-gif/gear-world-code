<#
.SYNOPSIS
  Gear World: puts the newest report of a tool back on the clipboard (read-only).

.DESCRIPTION
  Changes nothing. Finds the newest $HOME\gear-world-reports\<Name>_*.txt (default GW_BACKUP, the backup report),
  shows its name, time and last lines, and copies the whole report to the clipboard, so the owner never has to look
  for a report file (CLAUDE.md) when the clipboard was overwritten.
  Several reports in one go (lessons L119): -Name 'A,B,C' puts the newest report of each name on the clipboard, one
  after the other in that order, each under a line "===== <file> (<time>) =====" - for example the preview, live and
  remove-preview reports of one paste. -SinceMinutes N counts only reports written in the last N minutes, so an older
  report of the same tool is never taken for this run's.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File gw-run.ps1 -Ref <40-character commit> -Tool gw-last-report
.EXAMPLE
  ... -Tool gw-last-report -Name 'GWH_HUB_V2_PREVIEW,GWH_HUB_V2_LIVE,GWH_HUB_V2_REMOVE-PREVIEW' -SinceMinutes 180
#>
param(
    [string]$Name = 'GW_BACKUP',
    [string]$HomeDir = '',
    [int]$SinceMinutes = 0,
    [switch]$NoClipboard,
    [string]$SaveTo = '',
    [string]$Chat = '4 · Sites & Κώδικας'
)

$ErrorActionPreference = 'Continue'
if (-not $HomeDir) { $HomeDir = $HOME }
$names = @(([string]$Name).Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$badNames = @($names | Where-Object { $_ -notmatch '^[A-Za-z][A-Za-z0-9_\-]{1,59}$' })
if ($names.Count -eq 0 -or $names.Count -gt 6 -or $badNames.Count -gt 0) {
    Write-Host 'Λάθος όνομα αναφοράς (μόνο γράμματα, ψηφία, _ και -, έως 6 χωρισμένα με κόμμα). Στείλε στο Claude την εντολή που έτρεξες.' -ForegroundColor Magenta
    exit 2
}
$dir = Join-Path $HomeDir 'gear-world-reports'
$since = (Get-Date).AddMinutes(-1 * [Math]::Max(0, $SinceMinutes))
$parts = @()
$missing = @()
foreach ($n in $names) {
    # Name_<digit>... only, so GW_BACKUP never picks another tool's GW_BACKUPX_ report.
    $found = @(Get-ChildItem -LiteralPath $dir -Filter ($n + '_*.txt') -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match ('^' + [regex]::Escape($n) + '_[0-9]') -and ($SinceMinutes -le 0 -or $_.LastWriteTime -ge $since) } |
        Sort-Object LastWriteTime | Select-Object -Last 1)
    if ($found.Count -eq 0) {
        $missing += $n
        if ($SinceMinutes -gt 0) { Write-Host ('Δεν βρήκα αναφορά {0}_... των τελευταίων {1} λεπτών στο {2}.' -f $n, $SinceMinutes, $dir) -ForegroundColor Yellow }
        else { Write-Host ('Δεν βρήκα αναφορά {0}_... στο {1}.' -f $n, $dir) -ForegroundColor Yellow }
        continue
    }
    $r = $found[0]
    $text = [System.IO.File]::ReadAllText($r.FullName)
    $when = $r.LastWriteTime.ToString('yyyy-MM-dd HH:mm')
    Write-Host ('Η πιο πρόσφατη αναφορά: {0}  ({1})' -f $r.Name, $when) -ForegroundColor Cyan
    Write-Host 'Τελευταίες γραμμές:'
    foreach ($line in @(($text.TrimEnd() -split "`r?`n") | Select-Object -Last 3)) { Write-Host ('  ' + $line) }
    if ($names.Count -gt 1) { $parts += (('===== {0} ({1}) =====' -f $r.Name, $when) + "`r`n" + $text.Trim([char]0xFEFF).TrimEnd()) }
    else { $parts += $text }
}
if ($parts.Count -eq 0) {
    Write-Host 'Καμία αναφορά για το πρόχειρο. Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Yellow
    exit 3
}
if ($names.Count -gt 1) {
    $all = ($parts -join "`r`n`r`n") + "`r`n"
    if ($missing.Count -gt 0) { $all += ('ΔΕΝ βρέθηκε αναφορά: {0}' -f ($missing -join ', ')) + "`r`n" }
} else {
    $all = $parts[0]
}
if ($SaveTo) { [System.IO.File]::WriteAllText($SaveTo, $all, (New-Object System.Text.UTF8Encoding($false))) }
if (-not $NoClipboard) {
    try {
        Set-Clipboard -Value $all
        Write-Host ('Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «{0}» και πάτα Ctrl+V.' -f $Chat) -ForegroundColor Cyan
    } catch { Write-Host 'Δεν μπόρεσα να τη βάλω στο πρόχειρο. Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Yellow; exit 4 }
}
exit 0
