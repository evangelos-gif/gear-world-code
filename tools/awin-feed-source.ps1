<#
.SYNOPSIS
  Where do the Awin feeds on this PC come from? READ-ONLY.

.DESCRIPTION
  Looks for what fills the feed folder (GW_AWIN_BULK_ARCHIVE): Windows scheduled tasks that mention Awin or the
  folder, scripts in the user folders that mention the folder or the Awin feed download address, and the dates of
  the feed files. Keys in download addresses are masked in the report. It changes nothing.
  Report: <home>\gear-world-reports\AWIN_FEED_SOURCE_<time>.txt (copied to the clipboard)
#>
param(
    [string]$Archive = '',
    [string[]]$SearchRoot = @(),
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
if ($SearchRoot.Count -eq 0) {
    $SearchRoot = @()
    foreach ($n in @('Downloads', 'Desktop', 'Documents', 'OneDrive', 'gear-world-reports')) { $SearchRoot += (Join-Path $HOME $n) }
    $SearchRoot += $HOME
}
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$L = New-Object System.Collections.Generic.List[string]
function Say([string]$t, [string]$c = '') { $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }

# Download keys must never reach the report or the clipboard.
function Mask([string]$s) {
    $s = [regex]::Replace($s, '(?i)(apikey[/=:]\s*)[A-Za-z0-9]{8,}', '$1***')
    $s = [regex]::Replace($s, '(?i)((?:token|password|secret|key)\s*[=:]\s*["'']?)[^\s"'';]{6,}', '$1***')
    $s = [regex]::Replace($s, '\b[a-f0-9]{32,}\b', '***')
    return $s
}

Say ''
Say 'Από πού έρχονται τα feeds του Awin - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει τίποτα)' 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))

# 1. The feed folder: how many files, oldest and newest.
Say ''
Say ('== ΦΑΚΕΛΟΣ: {0}' -f $Archive)
if (Test-Path -LiteralPath $Archive) {
    $files = @(Get-ChildItem -LiteralPath $Archive -File -ErrorAction SilentlyContinue)
    Say ('Αρχεία: {0}' -f $files.Count)
    if ($files.Count -gt 0) {
        $byTime = @($files | Sort-Object LastWriteTime)
        Say ('Παλαιότερο: {0}  {1}' -f $byTime[0].LastWriteTime.ToString('yyyy-MM-dd HH:mm'), $byTime[0].Name)
        Say ('Νεότερο:    {0}  {1}' -f $byTime[$byTime.Count - 1].LastWriteTime.ToString('yyyy-MM-dd HH:mm'), $byTime[$byTime.Count - 1].Name)
        $days = @($files | Group-Object { $_.LastWriteTime.ToString('yyyy-MM-dd') } | Sort-Object Name)
        foreach ($d in $days) { Say ('  {0}: {1} αρχεία' -f $d.Name, $d.Count) }
        $other = @($files | Where-Object { $_.Name -notmatch '^AWIN_\d+_\d+\.csv' } | Select-Object -First 15)
        foreach ($o in $other) { Say ('  άλλο αρχείο: {0}  ({1})' -f $o.Name, $o.LastWriteTime.ToString('yyyy-MM-dd HH:mm')) }
    }
    $parent = Split-Path -Parent $Archive
    $near = @(Get-ChildItem -LiteralPath $parent -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)awin|feed|GW_' } | Select-Object -First 20)
    foreach ($n in $near) { Say ('  δίπλα στον φάκελο: {0}  ({1})' -f $n.Name, $n.LastWriteTime.ToString('yyyy-MM-dd HH:mm')) }
} else { Say 'Ο φάκελος δεν υπάρχει.' 'Yellow' }

# 2. Windows scheduled tasks that mention Awin, feeds or the folder.
Say ''
Say '== ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΕΣ ΕΡΓΑΣΙΕΣ ΤΩΝ WINDOWS'
$found = 0
try {
    foreach ($t in @(Get-ScheduledTask -ErrorAction Stop)) {
        $acts = @($t.Actions | ForEach-Object { ('{0} {1} {2}' -f $_.Execute, $_.Arguments, $_.WorkingDirectory) }) -join ' | '
        if (($t.TaskName + ' ' + $acts) -match '(?i)awin|feed|GW_AWIN|gear.?world') {
            $found++
            $info = $null
            try { $info = Get-ScheduledTaskInfo -TaskName $t.TaskName -TaskPath $t.TaskPath -ErrorAction Stop } catch { }
            Say ('- {0}{1}  κατάσταση: {2}' -f $t.TaskPath, $t.TaskName, $t.State)
            Say ('  τρέχει: {0}' -f (Mask $acts))
            if ($info) { Say ('  τελευταία φορά: {0}  αποτέλεσμα: {1}  επόμενη: {2}' -f $info.LastRunTime, $info.LastTaskResult, $info.NextRunTime) }
        }
    }
} catch { Say ('Δεν μπόρεσα να διαβάσω τις εργασίες: {0}' -f $_.Exception.Message) 'Yellow' }
if ($found -eq 0) { Say 'Καμία εργασία για Awin ή feeds.' }

# 3. Scripts that mention the folder or the Awin download address.
Say ''
Say '== SCRIPTS ΠΟΥ ΚΑΤΕΒΑΖΟΥΝ ΤΑ FEEDS'
$pattern = '(?i)GW_AWIN_BULK_ARCHIVE|productdata\.awin\.com|datafeed/download|awin.*\.csv\.gz'
$seen = @{}
$hits = 0
foreach ($root in $SearchRoot) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    $depth = 4
    if ($root -eq $HOME) { $depth = 1 }
    $cands = @(Get-ChildItem -LiteralPath $root -Recurse -Depth $depth -File -Include *.ps1, *.psm1, *.bat, *.cmd, *.py, *.js, *.mjs, *.sh, *.txt, *.json -ErrorAction SilentlyContinue |
        Where-Object { $_.Length -lt 2MB -and $_.FullName -notmatch '\\node_modules\\|\\\.git\\|GW_AWIN_BULK_ARCHIVE\\|gear-world-reports\\AWIN_|\\AppData\\' })
    foreach ($c in $cands) {
        if ($seen.ContainsKey($c.FullName)) { continue }
        $seen[$c.FullName] = $true
        $m = $null
        try { $m = @(Select-String -LiteralPath $c.FullName -Pattern $pattern -ErrorAction Stop | Select-Object -First 3) } catch { continue }
        if ($m.Count -gt 0) {
            $hits++
            Say ('- {0}  (άλλαξε {1})' -f $c.FullName, $c.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))
            foreach ($x in $m) { $line = Mask ($x.Line.Trim()); if ($line.Length -gt 160) { $line = $line.Substring(0, 160) + '...' }; Say ('    γρ. {0}: {1}' -f $x.LineNumber, $line) }
        }
        if ($hits -ge 30) { break }
    }
}
if ($hits -eq 0) { Say 'Δεν βρήκα script που να αναφέρει τον φάκελο ή τη διεύθυνση λήψης του Awin.' }

if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$file = Join-Path $OutDir ('AWIN_FEED_SOURCE_{0}.txt' -f $stamp)
$text = $L -join "`r`n"
[System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
$copied = $false
if (-not $NoClipboard) { try { Set-Clipboard -Value $text; $copied = $true } catch { } }
Write-Host ''
Write-Host ('OK - Η αναφορά γράφτηκε: {0}' -f $file) -ForegroundColor Green
Write-Host 'Δεν άλλαξε τίποτα. Τα κλειδιά λήψης δεν γράφονται στην αναφορά.'
if ($copied) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
exit 0
