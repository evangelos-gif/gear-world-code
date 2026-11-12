<#
.SYNOPSIS
  Gear World: puts the newest report of a tool back on the clipboard (read-only).

.DESCRIPTION
  Changes nothing. Finds the newest $HOME\gear-world-reports\<Name>_*.txt (default GW_BACKUP, the backup report),
  shows its name, time and last lines, and copies the whole report to the clipboard, so the owner never has to look
  for a report file (CLAUDE.md) when the clipboard was overwritten.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File gw-run.ps1 -Ref <40-character commit> -Tool gw-last-report
#>
param(
    [string]$Name = 'GW_BACKUP',
    [string]$HomeDir = '',
    [switch]$NoClipboard,
    [string]$Chat = '4 · Sites & Κώδικας'
)

$ErrorActionPreference = 'Continue'
if (-not $HomeDir) { $HomeDir = $HOME }
if ($Name -notmatch '^[A-Za-z][A-Za-z0-9_\-]{1,59}$') {
    Write-Host 'Λάθος όνομα αναφοράς (μόνο γράμματα, ψηφία, _ και -). Στείλε στο Claude την εντολή που έτρεξες.' -ForegroundColor Red
    exit 2
}
$dir = Join-Path $HomeDir 'gear-world-reports'
# Name_<digit>... only, so GW_BACKUP never picks another tool's GW_BACKUPX_ report.
$found = @(Get-ChildItem -LiteralPath $dir -Filter ($Name + '_*.txt') -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match ('^' + [regex]::Escape($Name) + '_[0-9]') } | Sort-Object LastWriteTime | Select-Object -Last 1)
if ($found.Count -eq 0) {
    Write-Host ('Δεν βρήκα αναφορά {0}_... στο {1}. Στείλε στο Claude αυτό το μήνυμα.' -f $Name, $dir) -ForegroundColor Yellow
    exit 3
}
$r = $found[0]
$text = [System.IO.File]::ReadAllText($r.FullName)
Write-Host ('Η πιο πρόσφατη αναφορά: {0}  ({1})' -f $r.Name, $r.LastWriteTime.ToString('yyyy-MM-dd HH:mm')) -ForegroundColor Cyan
Write-Host 'Τελευταίες γραμμές:'
foreach ($line in @(($text.TrimEnd() -split "`r?`n") | Select-Object -Last 3)) { Write-Host ('  ' + $line) }
if (-not $NoClipboard) {
    try {
        Set-Clipboard -Value $text
        Write-Host ('Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «{0}» και πάτα Ctrl+V.' -f $Chat) -ForegroundColor Green
    } catch { Write-Host 'Δεν μπόρεσα να τη βάλω στο πρόχειρο. Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Yellow; exit 4 }
}
exit 0
