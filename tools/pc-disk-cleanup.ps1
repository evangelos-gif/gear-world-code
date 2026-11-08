<#
.SYNOPSIS
  Frees disk space on this PC that the Gear World tools filled. READ-ONLY by default.
.DESCRIPTION
  On 8 Nov 2026 an import stopped with "ENOSPC: no space left on device". Every code version keeps copies on the PC:
   - %TEMP%\gear-world-code-<version>          (the code, from the 3-line paste),
   - <home>\<site folder>\deploy\gear-world-code-<version>  (code + node_modules from npm ci, 150-300 MB each),
   - <feeds>\_old\<time>                        (the old feeds after each download),
   - gear-world-reports\*IMPORT_PLAN_*          (the SQL files of each import plan),
   - wrangler log files and the npm download cache.
  Without -Apply: shows the free space and what could go, with sizes. Changes nothing.
  With -Apply and the phrase ΕΓΚΡΙΝΩ DISK CLEANUP it deletes:
   - the code copies (in %TEMP% and in each site's deploy folder) except the version running now and the newest other one,
   - the old feed copies in _old except the newest folder,
   - the .sql files of import plans older than -PlanHours hours (default 2); their .txt reports stay,
   - half-downloaded feeds (*.part), wrangler log files older than -PlanHours hours, the npm download cache.
  It never touches the feeds in use, the site folders themselves, backups, restore points or reports.
  Everything it deletes is made again by the tools when needed (code and npm packages are downloaded again).
  Report: <home>\gear-world-reports\DISK_CLEANUP_<time>.txt (also copied to the clipboard)
#>
param(
    [switch]$Apply,
    [string]$Approve = '',
    [string]$PcHome = '',
    [string]$TempRoot = '',
    [string]$Archive = '',
    [string]$OutDir = '',
    [string]$NpmCache = '',
    [string[]]$WranglerLogs = @(),
    [string]$KeepVersion = '',
    [string]$KeepCache = '',
    [int]$PlanHours = 2,
    [switch]$NoClipboard
)
$ErrorActionPreference = 'Stop'
$isWin = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
if (-not $PcHome) { $PcHome = $HOME }
if (-not $TempRoot) { $TempRoot = [System.IO.Path]::GetTempPath() }
if (-not $Archive) { $Archive = Join-Path (Join-Path $PcHome 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
if (-not $NpmCache -and $env:LOCALAPPDATA) { $NpmCache = Join-Path $env:LOCALAPPDATA 'npm-cache' }
if ($WranglerLogs.Count -eq 0) {
    $WranglerLogs = @(Join-Path (Join-Path $PcHome '.wrangler') 'logs')
    if ($env:APPDATA) { $WranglerLogs += (Join-Path (Join-Path (Join-Path $env:APPDATA 'xdg.config') '.wrangler') 'logs') }
}
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
# The version running now. gw-run puts the code in <temp>\gear-world-code-<12>\gear-world-code-<sha>\tools.
$repo = Split-Path -Parent $PSScriptRoot
if (-not $KeepVersion) { $KeepVersion = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', '' }
if (-not $KeepCache) { $KeepCache = Split-Path -Leaf (Split-Path -Parent $repo) }
$Phrase = 'ΕΓΚΡΙΝΩ DISK CLEANUP'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$L = New-Object System.Collections.Generic.List[string]
function Say([string]$t, [string]$c = '') { $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Finish([int]$code) {
    $file = Join-Path $OutDir ('DISK_CLEANUP_{0}.txt' -f $stamp)
    $text = ($L -join "`r`n") + "`r`n"
    try { [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true))) } catch { Write-Host 'Δεν γράφτηκε η αναφορά (δίσκος γεμάτος;).' -ForegroundColor Yellow }
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    exit $code
}
function Normalize-Phrase([string]$s) {
    $d = ([string]$s).Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    $t = ($sb.ToString().ToUpperInvariant() -replace '\s+', ' ').Trim()
    return ($t -replace '^EGKRINO ', 'ΕΓΚΡΙΝΩ ')
}
# Size in bytes. .NET enumeration is much faster than Get-ChildItem for node_modules; on an error the part counted so far is kept.
function Size-Of([string]$p, [string]$skipExt = '') {
    $sum = [double]0
    try {
        if (Test-Path -LiteralPath $p -PathType Leaf) { return [double](Get-Item -LiteralPath $p -Force).Length }
        $di = New-Object System.IO.DirectoryInfo($p)
        foreach ($f in $di.EnumerateFiles('*', [System.IO.SearchOption]::AllDirectories)) {
            if ($skipExt -and $f.Extension -eq $skipExt) { continue }
            $sum += $f.Length
        }
    } catch { }
    return $sum
}
function Mb([double]$b) { return ('{0:N0} MB' -f ($b / 1MB)) }
function Free-Space([string]$p) {
    try { $root = [System.IO.Path]::GetPathRoot((Resolve-Path -LiteralPath $p).Path); return [double](New-Object System.IO.DriveInfo($root)).AvailableFreeSpace } catch { return -1 }
}
function Remove-Folder([string]$p) {
    # rd is much faster than Remove-Item for node_modules and copes with long paths; its messages go to nul.
    if ($isWin) { try { & cmd.exe /c ('rd /s /q "{0}" >nul 2>&1' -f $p) } catch { } }
    if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue }
    return (-not (Test-Path -LiteralPath $p))
}
function Add-Target([string]$kind, [string]$path, [bool]$sqlOnly = $false) { $targets.Add(@{ kind = $kind; path = $path; sqlOnly = $sqlOnly; size = 0 }) }

$mode = 'ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν σβήνει τίποτα)'
if ($Apply) { $mode = 'ΚΑΘΑΡΙΣΜΑ (με έγκριση)' }
Say ('Χώρος στον δίσκο - {0}' -f $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
$free0 = Free-Space $OutDir
if ($free0 -ge 0) { Say ('Ελεύθερος χώρος τώρα: {0}' -f (Mb $free0)) }
Say 'Μετράω τα μεγέθη (μπορεί να πάρει 1-3 λεπτά)...'

$targets = New-Object System.Collections.Generic.List[object]
# 1. Code copies in %TEMP%: keep the one running now and the newest other one.
$caches = @(Get-ChildItem -LiteralPath $TempRoot -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^gear-world-code-[0-9a-f]{12}$' -and $_.Name -ne $KeepCache } | Sort-Object LastWriteTime -Descending)
for ($k = 1; $k -lt $caches.Count; $k++) { Add-Target 'αντίγραφα κώδικα στο TEMP' $caches[$k].FullName }
# 2. Code + node_modules copies in each site's deploy folder: keep the version running now and the newest other one.
$deployDirs = 0
foreach ($w in @(Get-ChildItem -LiteralPath $PcHome -Directory -ErrorAction SilentlyContinue)) {
    $dep = Join-Path $w.FullName 'deploy'
    if (-not (Test-Path -LiteralPath $dep -PathType Container)) { continue }
    $vers = @(Get-ChildItem -LiteralPath $dep -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'gear-world-code*' -and $_.Name -ne $KeepVersion } | Sort-Object LastWriteTime -Descending)
    if ($vers.Count -gt 0) { $deployDirs += 1 }
    for ($k = 1; $k -lt $vers.Count; $k++) { Add-Target 'παλιές εκδόσεις στα deploy των sites' $vers[$k].FullName }
}
# 3. Old feed copies: keep the newest _old folder.
$olds = @(Get-ChildItem -LiteralPath (Join-Path $Archive '_old') -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending)
for ($k = 1; $k -lt $olds.Count; $k++) { Add-Target 'παλιά feeds (_old)' $olds[$k].FullName }
# 4. SQL files of import plans older than -PlanHours; the .txt reports stay.
$limit = (Get-Date).AddHours(-1 * [Math]::Max(0, $PlanHours))
foreach ($d in @(Get-ChildItem -LiteralPath $OutDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $limit -and ($_.Name -match '^([A-Z]{3}_)?IMPORT_PLAN_' -or $_.Name -match '^REFRESH_PLAN_') })) {
    $hasSql = @(Get-ChildItem -LiteralPath $d.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Extension -ne '.txt' } | Select-Object -First 1).Count -gt 0
    if ($hasSql) { Add-Target 'αρχεία SQL παλιών σχεδίων εισαγωγής' $d.FullName $true }
}
# 5. Half-downloaded feeds, wrangler logs, npm download cache.
foreach ($f in @(Get-ChildItem -LiteralPath $Archive -File -Filter '*.part' -ErrorAction SilentlyContinue)) { Add-Target 'μισές λήψεις (*.part)' $f.FullName }
foreach ($wl in $WranglerLogs) {
    foreach ($f in @(Get-ChildItem -LiteralPath $wl -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $limit })) { Add-Target 'logs του wrangler' $f.FullName }
}
if ($NpmCache) {
    foreach ($n in @('_cacache', '_npx')) {
        $p = Join-Path $NpmCache $n
        if (Test-Path -LiteralPath $p -PathType Container) { Add-Target 'npm cache (κατεβαίνει ξανά μόνο του)' $p }
    }
}

$total = [double]0
$byKind = @{}
$order = New-Object System.Collections.Generic.List[string]
foreach ($t in $targets) {
    if ($t.sqlOnly) { $t.size = Size-Of $t.path '.txt' } else { $t.size = Size-Of $t.path }
    $total += $t.size
    if (-not $byKind.ContainsKey($t.kind)) { $byKind[$t.kind] = @{ n = 0; size = [double]0 }; $order.Add($t.kind) }
    $byKind[$t.kind].n += 1
    $byKind[$t.kind].size += $t.size
}
Say ''
Say ('Μπορούν να σβηστούν: {0} φάκελοι/αρχεία, {1}' -f $targets.Count, (Mb $total)) 'Cyan'
foreach ($k in $order) { Say ('  - {0}: {1}, {2}' -f $k, $byKind[$k].n, (Mb $byKind[$k].size)) }
$big = @($targets | Sort-Object { $_.size } -Descending | Select-Object -First 5)
if ($big.Count -gt 0) {
    Say 'Τα 5 μεγαλύτερα:'
    foreach ($t in $big) { Say ('  {0}  {1}' -f (Mb $t.size), $t.path) }
}
Say ''
Say ('Μένουν: η έκδοση που τρέχει ({0}) και η αμέσως προηγούμενη, τα feeds σε χρήση, οι φάκελοι των sites, backups, σημεία επαναφοράς και αναφορές.' -f $KeepVersion)
$feedNow = Size-Of $Archive
if ($feedNow -gt 0) { Say ('Τα feeds (μένουν, μαζί με το _old): {0}' -f (Mb $feedNow)) }
if ($targets.Count -eq 0) { Say 'Δεν υπάρχει τίποτα για σβήσιμο.' 'Green'; Finish 0 }
if (-not $Apply) { Say ''; Say ('Μόνο ανάγνωση: δεν σβήστηκε τίποτα. Για καθάρισμα: -Apply και η φράση {0}' -f $Phrase) 'Green'; Finish 0 }

$typed = $Approve
if (-not $typed) {
    Write-Host ''
    Write-Host ('Για να σβηστούν, γράψε ακριβώς: {0}' -f $Phrase) -ForegroundColor Yellow
    Write-Host '(ή πάτα Enter για να σταματήσω χωρίς αλλαγές)'
    # An empty line left over from the paste must not answer this question (lessons L106).
    try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
    $typed = Read-Host 'Έγκριση'
}
if ((Normalize-Phrase $typed) -ne (Normalize-Phrase $Phrase)) { Say 'Δεν δόθηκε η φράση: δεν σβήστηκε τίποτα.' 'Yellow'; Finish 1 }

Say ''
Say 'Σβήνω...'
$done = 0
$freed = [double]0
$failed = 0
foreach ($t in $targets) {
    $ok = $false
    if ($t.sqlOnly) {
        try {
            foreach ($f in @(Get-ChildItem -LiteralPath $t.path -Recurse -File -Force | Where-Object { $_.Extension -ne '.txt' })) { Remove-Item -LiteralPath $f.FullName -Force }
            foreach ($sd in @(Get-ChildItem -LiteralPath $t.path -Recurse -Directory -Force | Sort-Object { $_.FullName.Length } -Descending)) {
                if (@(Get-ChildItem -LiteralPath $sd.FullName -Force).Count -eq 0) { Remove-Item -LiteralPath $sd.FullName -Force }
            }
            $ok = $true
        } catch { $ok = $false }
    } elseif (Test-Path -LiteralPath $t.path -PathType Container) {
        $ok = Remove-Folder $t.path
    } else {
        try { Remove-Item -LiteralPath $t.path -Force -ErrorAction Stop; $ok = $true } catch { $ok = $false }
    }
    if ($ok) { $done += 1; $freed += $t.size } else { $failed += 1; Say ('Δεν σβήστηκε (σε χρήση;): {0}' -f $t.path) 'Yellow' }
}
$free1 = Free-Space $OutDir
Say ''
Say ('ΕΤΟΙΜΟ: σβήστηκαν {0} από {1}, περίπου {2}.' -f $done, $targets.Count, (Mb $freed)) 'Green'
if ($free1 -ge 0) { Say ('Ελεύθερος χώρος τώρα: {0}' -f (Mb $free1)) 'Green' }
Say 'Επαναφορά: δεν χρειάζεται. Ό,τι σβήστηκε το ξαναφτιάχνουν τα εργαλεία (ξανακατεβαίνει ο κώδικας και τα πακέτα npm).'
Say 'Τα σημειώματα επαναφοράς βάσης (bookmarks) ισχύουν: το Claude δίνει νέα εντολή από την έκδοση που μένει.'
if ($failed -gt 0) { Finish 5 }
Finish 0
