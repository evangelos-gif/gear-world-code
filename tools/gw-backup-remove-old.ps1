<#
.SYNOPSIS
  Gear World: deletes an OLD backup folder on the external drive, only after a newer complete backup exists there.

.DESCRIPTION
  Without -Apply it only shows what would be deleted and changes nothing. With -Apply -Approve 'ΕΓΚΡΙΝΩ ΣΒΗΣΙΜΟ
  ΠΑΛΙΟΥ BACKUP' it deletes the folder -Old (for example D:\GearWorldBackup, the 3/11 copy that was never checked for
  keys and customer e-mails), lessons L117. It never asks a question.

  It refuses (exit 2) unless: -Old and -Keep are different folders on the same drive, that drive is not the Windows
  drive, neither is the drive itself or inside the other, both names start with GearWorldBackup, and -Old looks like a
  backup (files\, d1\ or README-RESTORE.txt), neither is a junction or symlink, and the paths are plain D:\... ones.
  It refuses (exit 3) unless -Keep is a complete backup: README-RESTORE.txt, at least one folder in files\ and in d1\,
  no half written or failed database (d1\_new_*, d1\*.incomplete), a report of a full run in logs\ with no ΠΡΟΒΛΗΜΑ
  outside its GitHub part, the GitHub zips of every repo the old folder has zips of, and no newer report in -Old.

  Nothing on the PC, the sites, the databases or Cloudflare is touched. There is no way back for the deleted folder:
  the backup from then on is -Keep. Report in <home>\gear-world-reports\GW_BACKUP_REMOVE_OLD_<time>.txt, copied to
  the clipboard. Last line: ΤΕΛΟΣ ΣΒΗΣΙΜΑΤΟΣ.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File gw-run.ps1 -Ref <40-character commit> -Tool gw-backup-remove-old -Old 'D:\GearWorldBackup' -Keep 'D:\GearWorldBackup-2026-11-12'
#>
param(
    [string]$Old = 'D:\GearWorldBackup',
    [string]$Keep = '',
    [switch]$Apply,
    [string]$Approve = '',
    [switch]$AllowSystemDrive,
    [string]$HomeDir = '',
    [string]$OutDir = '',
    [switch]$NoClipboard,
    [string]$Chat = '4 · Sites & Κώδικας'
)

$ErrorActionPreference = 'Stop'
if (-not $HomeDir) { $HomeDir = $HOME }
if (-not $OutDir) { $OutDir = Join-Path $HomeDir 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$phrase = 'ΕΓΚΡΙΝΩ ΣΒΗΣΙΜΟ ΠΑΛΙΟΥ BACKUP'
$L = New-Object System.Collections.Generic.List[string]
$script:Finishing = $false

function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}
function Finish([int]$code) {
    if ($script:Finishing) { exit $code }
    $script:Finishing = $true
    Say ''
    Say 'ΤΕΛΟΣ ΣΒΗΣΙΜΑΤΟΣ'
    $text = ($L -join "`r`n") + "`r`n"
    $file = Join-Path $OutDir ('GW_BACKUP_REMOVE_OLD_{0}.txt' -f $stamp)
    try {
        if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
        [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
        Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    } catch { Write-Host ('Η αναφορά δεν γράφτηκε: {0}' -f $_.Exception.Message) -ForegroundColor Red }
    if (-not $NoClipboard) {
        try { Set-Clipboard -Value $text; Write-Host ('Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «{0}» και πάτα Ctrl+V.' -f $Chat) -ForegroundColor Green } catch { }
    }
    exit $code
}
trap { Say ('ΠΡΟΒΛΗΜΑ: η εντολή σταμάτησε απρόσμενα: {0}' -f $_.Exception.Message) 'Red'; Finish 13 }
function Normalize-Phrase([string]$s) {
    $d = ([string]$s).Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    $t = ($sb.ToString().ToUpperInvariant() -replace '\s+', ' ').Trim()
    return ($t -replace '^EGKRINO ', 'ΕΓΚΡΙΝΩ ')
}
function Format-Size([double]$b) {
    if ($b -ge 1GB) { return ('{0:N1} GB' -f ($b / 1GB)) }
    if ($b -ge 1MB) { return ('{0:N0} MB' -f ($b / 1MB)) }
    return ('{0:N0} KB' -f ($b / 1KB))
}
function Get-Full([string]$p) { return [System.IO.Path]::GetFullPath($p).TrimEnd('\', '/') }
function Stop-Refuse([string]$why) { Say ('ΠΡΟΒΛΗΜΑ: {0} Δεν σβήστηκε τίποτα.' -f $why) 'Red'; Finish 2 }

if ($Apply) { Say 'Gear World: σβήσιμο παλιού backup (με έγκριση, τρέχει μόνο του)' 'Cyan' } else { Say 'Gear World: σβήσιμο παλιού backup - ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν σβήνει τίποτα)' 'Cyan' }
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))

# 1. The two folders and the drive.
if (-not $Keep) { Stop-Refuse 'λείπει το -Keep (ο νέος φάκελος του backup που μένει).' }
if ($Old -notmatch '^[A-Za-z]:\\' -or $Keep -notmatch '^[A-Za-z]:\\') { Stop-Refuse 'οι φάκελοι πρέπει να είναι πλήρεις διαδρομές σε δίσκο (π.χ. D:\GearWorldBackup).' }
if (($Old + $Keep) -match '[%!"*?<>|]') { Stop-Refuse 'η διαδρομή έχει χαρακτήρες που δεν δέχομαι (% ! " * ? < > |).' }
$oldFull = Get-Full $Old
$keepFull = Get-Full $Keep
$oldRoot = [System.IO.Path]::GetPathRoot($oldFull).TrimEnd('\', '/')
$keepRoot = [System.IO.Path]::GetPathRoot($keepFull).TrimEnd('\', '/')
Say ('Παλιός (σβήνεται): {0}' -f $oldFull)
Say ('Νέος (μένει):      {0}' -f $keepFull)
if ($oldFull -ieq $keepFull) { Stop-Refuse 'ο παλιός και ο νέος φάκελος είναι ο ίδιος.' }
if ($oldRoot -ine $keepRoot) { Stop-Refuse 'ο παλιός και ο νέος φάκελος δεν είναι στον ίδιο δίσκο.' }
if ($oldFull -ieq $oldRoot -or $keepFull -ieq $keepRoot) { Stop-Refuse 'δεν σβήνεται ολόκληρος δίσκος.' }
if ($keepFull.StartsWith($oldFull + '\', [System.StringComparison]::OrdinalIgnoreCase) -or $oldFull.StartsWith($keepFull + '\', [System.StringComparison]::OrdinalIgnoreCase)) { Stop-Refuse 'ο ένας φάκελος είναι μέσα στον άλλο.' }
$sysRoot = ([string]$env:SystemDrive).TrimEnd('\', '/')
if ($oldRoot -ieq $sysRoot -and -not $AllowSystemDrive) { Stop-Refuse ('ο {0} είναι ο δίσκος των Windows, όχι ο εξωτερικός.' -f $oldRoot) }
if (-not ([System.IO.Path]::GetFileName($oldFull) -like 'GearWorldBackup*') -or -not ([System.IO.Path]::GetFileName($keepFull) -like 'GearWorldBackup*')) { Stop-Refuse 'σβήνω μόνο φακέλους backup του Gear World (το όνομα αρχίζει με GearWorldBackup).' }
if (-not (Test-Path -LiteralPath $oldFull -PathType Container)) { Say ('Ο παλιός φάκελος {0} δεν υπάρχει: δεν έχει τίποτα να σβηστεί.' -f $oldFull) 'Yellow'; Finish 0 }
foreach ($pp in @($oldFull, $keepFull)) {
    if (Test-Path -LiteralPath $pp) {
        if (((Get-Item -LiteralPath $pp -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-Refuse ('ο {0} είναι σύνδεσμος (junction/symlink), όχι κανονικός φάκελος.' -f $pp) }
    }
}
$looksBackup = (Test-Path -LiteralPath (Join-Path $oldFull 'files')) -or (Test-Path -LiteralPath (Join-Path $oldFull 'd1')) -or (Test-Path -LiteralPath (Join-Path $oldFull 'README-RESTORE.txt'))
if (-not $looksBackup) { Stop-Refuse 'ο παλιός φάκελος δεν μοιάζει με backup (δεν έχει files, d1 ή README-RESTORE.txt).' }

# 2. The new backup must be complete.
$missing = New-Object System.Collections.Generic.List[string]
if (-not (Test-Path -LiteralPath (Join-Path $keepFull 'README-RESTORE.txt'))) { $missing.Add('README-RESTORE.txt (γράφεται στο τέλος του backup)') }
$nFiles = @(Get-ChildItem -LiteralPath (Join-Path $keepFull 'files') -Directory -ErrorAction SilentlyContinue).Count
$dbDirs = @(Get-ChildItem -LiteralPath (Join-Path $keepFull 'd1') -Directory -ErrorAction SilentlyContinue)
$nDb = @($dbDirs | Where-Object { $_.Name -notlike '_new_*' }).Count
$half = @($dbDirs | Where-Object { $_.Name -like '_new_*' -or $_.Name -like '*.incomplete' }).Count
$logs = @(Get-ChildItem -LiteralPath (Join-Path $keepFull 'logs') -Filter 'GW_BACKUP_*.txt' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
$nLogs = $logs.Count
# The newest FULL run (with the copy and the databases; a GitHub-only run does not count): no ΠΡΟΒΛΗΜΑ outside its
# GitHub part (the code is on GitHub anyway). README-RESTORE.txt alone is written even after problems (review 13/11).
$full = $null
foreach ($lg in $logs) {
    $tx = [System.IO.File]::ReadAllText($lg.FullName)
    if ($tx.Contains('== Αντιγραφή αρχείων') -and $tx.Contains('== Βάσεις D1')) { $full = @{ file = $lg; text = $tx }; break }
}
$badLines = 0
if ($full) {
    $section = ''
    foreach ($line in ($full.text -split "`r?`n")) {
        if ($line.StartsWith('== ')) { $section = $line; continue }
        if ($line.Contains('ΠΡΟΒΛΗΜΑ') -and -not $section.StartsWith('== GitHub')) { $badLines++ }
    }
}
# Offline copies of the code: if the old backup has GitHub zips of a repo, the new one must have them too.
$zipsMissing = New-Object System.Collections.Generic.List[string]
foreach ($gd in @(Get-ChildItem -LiteralPath (Join-Path $oldFull 'github') -Directory -ErrorAction SilentlyContinue)) {
    if (@(Get-ChildItem -LiteralPath $gd.FullName -Filter '*.zip' -File -ErrorAction SilentlyContinue).Count -eq 0) { continue }
    if (@(Get-ChildItem -LiteralPath (Join-Path (Join-Path $keepFull 'github') $gd.Name) -Filter '*.zip' -File -ErrorAction SilentlyContinue).Count -eq 0) { $zipsMissing.Add($gd.Name) }
}
# The one that stays must be the newer one.
$oldLog = @(Get-ChildItem -LiteralPath (Join-Path $oldFull 'logs') -Filter 'GW_BACKUP_*.txt' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
if ($nFiles -lt 1) { $missing.Add('φάκελοι στο files') }
if ($nDb -lt 1) { $missing.Add('βάσεις στο d1') }
if ($half -gt 0) { $missing.Add(('{0} βάσεις γραμμένες μισές ή με πρόβλημα (d1\_new_*, *.incomplete)' -f $half)) }
if ($nLogs -lt 1) { $missing.Add('αναφορά στο logs') }
elseif (-not $full) { $missing.Add('αναφορά ολόκληρου backup (με αντιγραφή αρχείων και βάσεις) στο logs') }
elseif ($badLines -gt 0) { $missing.Add(('{0} γραμμές ΠΡΟΒΛΗΜΑ στην αναφορά {1} (έξω από το GitHub)' -f $badLines, $full.file.Name)) }
if ($zipsMissing.Count -gt 0) { $missing.Add(('τα zip του GitHub για {0} (ο παλιός φάκελος τα έχει)' -f ($zipsMissing -join ', '))) }
if ($oldLog.Count -gt 0 -and $logs.Count -gt 0 -and $oldLog[0].LastWriteTime -gt $logs[0].LastWriteTime) { $missing.Add('νεότερη ημερομηνία: ο «παλιός» φάκελος έχει νεότερη αναφορά από τον «νέο» (μήπως μπερδεύτηκαν;)') }
Say ('Νέο backup: {0} φάκελοι στο files, {1} βάσεις στο d1, {2} αναφορές στο logs' -f $nFiles, $nDb, $nLogs)
if ($missing.Count -gt 0) {
    Say ('ΠΡΟΒΛΗΜΑ: το νέο backup δεν είναι ολόκληρο (λείπει: {0}). Δεν σβήστηκε τίποτα.' -f ($missing -join ', ')) 'Red'
    Finish 3
}
Say '🟢 ΕΝΤΑΞΕΙ: το νέο backup είναι ολόκληρο.'

# 3. What would go.
Write-Host '  ... μετράω τον παλιό φάκελο (μπορεί να πάρει 1-2 λεπτά)'
$size = [double]0; $count = 0
try {
    foreach ($f in [System.IO.Directory]::EnumerateFiles($oldFull, '*', [System.IO.SearchOption]::AllDirectories)) {
        $count++
        try { $size += (New-Object System.IO.FileInfo($f)).Length } catch { }
    }
} catch { Say ('  (δεν μέτρησα όλα τα αρχεία: {0})' -f $_.Exception.Message) 'Yellow' }
Say ('Τι θα γίνει: σβήνεται ολόκληρος ο {0} ({1} αρχεία, {2}). Αυτό δεν γυρίζει πίσω: το backup από εδώ και πέρα είναι ο {3}.' -f $oldFull, $count, (Format-Size $size), $keepFull)
Say 'Δεν αλλάζει τίποτα στον υπολογιστή, στα sites, στις βάσεις ή στο Cloudflare.'

if (-not $Apply) { Say 'Μόνο έλεγχος: δεν σβήστηκε τίποτα.'; Finish 0 }
if (-not $Approve) { Say ('Λείπει η φράση: η εντολή θέλει -Approve ''{0}''. Δεν σβήστηκε τίποτα.' -f $phrase) 'Red'; Finish 1 }
if ((Normalize-Phrase $Approve) -ne (Normalize-Phrase $phrase)) { Say ('Λάθος φράση έγκρισης (χρειάζεται: {0}). Δεν σβήστηκε τίποτα.' -f $phrase) 'Red'; Finish 1 }

# 4. Delete (rd is much faster than Remove-Item for tens of thousands of files).
Say ('Σβήνω τον {0} ...' -f $oldFull)
$t0 = Get-Date
& cmd /d /c ('rd /s /q "{0}" >nul 2>nul' -f $oldFull) # errors stay inside cmd: no PowerShell error records
if (Test-Path -LiteralPath $oldFull) {
    $left = @(Get-ChildItem -LiteralPath $oldFull -Recurse -File -Force -ErrorAction SilentlyContinue).Count
    Say ('ΠΡΟΒΛΗΜΑ: έμειναν {0} αρχεία στον {1} (ανοιχτά ή κλειδωμένα). Κλείσε ό,τι είναι ανοιχτό από τον δίσκο και ξανατρέξε την ίδια εντολή.' -f $left, $oldFull) 'Red'
    Finish 12
}
Say ('🟢 ΕΝΤΑΞΕΙ: σβήστηκε ({0} λεπτά). Στον δίσκο μένει μόνο το καθαρό backup {1}.' -f [int][Math]::Round(((Get-Date) - $t0).TotalMinutes), $keepFull) 'Green'
Finish 0
