<#
.SYNOPSIS
  Gear World - the backup for the night: ONE paste with the approval phrase in it, which waits until no other Gear
  World command runs and then starts the backup on its own (lessons L200).

.DESCRIPTION
  For a night when another Gear World command (an import, ALL UPDATES ...) may still be running in another window.
  First, at once: it checks the phrase (-Approve 'ΕΓΚΡΙΝΩ BACKUP <drive letter>') and that the external drive is there,
  and stops with a clear message if not, so the owner knows before going to sleep. Then it WAITS, without changing
  anything: every minute it looks for another running Gear World command (a PowerShell window that runs a Gear World
  tool, or wrangler). Only when none has run for -QuietMinutes (15) in a row does it start gw-backup.ps1 of this same
  version with -Apply (SELECT only on Cloudflare, it writes only to the external drive; L113). So the backup and an
  import never run at the same time (both are «⛔ ΜΟΝΗ ΤΗΣ»).
  If another command still runs after -MaxWaitHours (6), the backup does NOT start and the report says so, so the
  morning stays free. While it waits the PC stays awake and the screen on (no setting changes, as gw-backup does), and a
  click in the window does not pause it. It never reads the clipboard, never shows command lines (only tool names).
  At the end: its own report and the backup report together on the clipboard; the last line is ΤΕΛΟΣ BACKUP.

  Report: <home>\gear-world-reports\GW_NIGHT_BACKUP_<time>.txt (the backup's own report stays GW_BACKUP_<time>.txt).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File gw-run.ps1 -Ref <40-character commit> -Tool gw-night-backup -Target 'D:\GearWorldBackup-2026-11-12' -Approve 'ΕΓΚΡΙΝΩ BACKUP D'
#>
param(
    [string]$Target = 'D:\GearWorldBackup',
    [string]$Approve = '',
    [int]$QuietMinutes = 15,
    [double]$MaxWaitHours = 6,
    [int]$PollSec = 60,
    [string]$HomeDir = '',
    [string]$OutDir = '',
    [string]$Chat = '4 · Sites & Κώδικας',
    [switch]$NoClipboard,
    [string]$SaveTo = '',          # tests only: the clipboard text also to this file
    [string]$BackupScript = '',    # tests only: another script instead of gw-backup.ps1 of this version
    [string]$FakeProcessFile = '', # tests only: the process list from a file, one "id|parent|name|command line" per line
    [switch]$AllowSystemDrive      # tests only: passed on to the backup
)

$ErrorActionPreference = 'Stop'
if (-not $HomeDir) { $HomeDir = $HOME }
if (-not $OutDir) { $OutDir = Join-Path $HomeDir 'gear-world-reports' }
if (-not $BackupScript) { $BackupScript = Join-Path $PSScriptRoot 'gw-backup.ps1' }
if ($QuietMinutes -lt 0) { $QuietMinutes = 15 }
if ($PollSec -lt 1) { $PollSec = 1 }
if ($MaxWaitHours -le 0) { $MaxWaitHours = 6 }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$L = New-Object System.Collections.Generic.List[string]
$script:Awake = $false
$script:ConsoleMode = $null
$script:Done = $false

function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}
function Initialize-Native {
    if ('GwNightPower.Native' -as [type]) { return $true }
    try {
        $sig = '[System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);' +
            ' [System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern System.IntPtr GetStdHandle(int nStdHandle);' +
            ' [System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern bool GetConsoleMode(System.IntPtr hConsoleHandle, out uint lpMode);' +
            ' [System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern bool SetConsoleMode(System.IntPtr hConsoleHandle, uint dwMode);'
        Add-Type -Namespace GwNightPower -Name Native -MemberDefinition $sig
        return $true
    } catch { return $false }
}
# The same as gw-backup (L113): no sleep and the screen on while this window waits; ES_CONTINUOUS alone puts it back.
function Set-Awake([bool]$on) {
    if (-not (Initialize-Native)) { return $false }
    try {
        if ($on) { [void][GwNightPower.Native]::SetThreadExecutionState([uint32]2147483651); $script:Awake = $true; return $true }
        [void][GwNightPower.Native]::SetThreadExecutionState([uint32]2147483648); $script:Awake = $false; return $true
    } catch { return $false }
}
# Quick Edit off for this window while it waits (a click would pause the window and the backup would never start).
function Set-QuickEdit([bool]$on) {
    try {
        if (-not (Initialize-Native)) { return $false }
        $h = [GwNightPower.Native]::GetStdHandle(-10)
        if ($on) {
            if ($null -ne $script:ConsoleMode) { [void][GwNightPower.Native]::SetConsoleMode($h, [uint32]$script:ConsoleMode); $script:ConsoleMode = $null }
            return $true
        }
        $mode = [uint32]0
        if (-not [GwNightPower.Native]::GetConsoleMode($h, [ref]$mode)) { return $false }
        if (($mode -band 0x40) -eq 0) { return $true }
        $new = [uint32](($mode -bor 0x80) - 0x40)
        if ([GwNightPower.Native]::SetConsoleMode($h, $new)) { $script:ConsoleMode = $mode; return $true }
        return $false
    } catch { return $false }
}
function Set-Title([string]$t) { try { $Host.UI.RawUI.WindowTitle = $t } catch { } }
function Normalize-Phrase([string]$s) {
    $d = ([string]$s).Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    $t = ($sb.ToString().ToUpperInvariant() -replace '\s+', ' ').Trim()
    return ($t -replace '^EGKRINO ', 'ΕΓΚΡΙΝΩ ')
}
# Every process: id, parent, name, command line. Tests give a file instead ({PID} and {PPID} are this run's).
function Get-ProcessList {
    $list = New-Object System.Collections.Generic.List[object]
    if ($FakeProcessFile) {
        $parent = 0
        try { $parent = [int](Get-CimInstance Win32_Process -Filter ('ProcessId={0}' -f $PID)).ParentProcessId } catch { $parent = 0 }
        $lines = @()
        try { $lines = @([System.IO.File]::ReadAllLines($FakeProcessFile)) } catch { $lines = @() }
        foreach ($line in $lines) {
            $p = ([string]$line).Replace('{PID}', [string]$PID).Replace('{PPID}', [string]$parent).Split('|')
            if ($p.Count -lt 4) { continue }
            $list.Add([pscustomobject]@{ Id = [int]$p[0]; Parent = [int]$p[1]; Name = [string]$p[2]; Cmd = (($p[3..($p.Count - 1)]) -join '|') })
        }
        return $list
    }
    foreach ($p in @(Get-CimInstance Win32_Process)) {
        $list.Add([pscustomobject]@{ Id = [int]$p.ProcessId; Parent = [int]$p.ParentProcessId; Name = [string]$p.Name; Cmd = [string]$p.CommandLine })
    }
    return $list
}
# A Gear World command: PowerShell running a Gear World script (the 3-line pastes use %TEMP%\gw-*.ps1, gw-run runs
# tools\<tool>.ps1 from its copy %TEMP%\gear-world-code-<commit>), or wrangler / that copy's code in node. Nothing
# broader, so a program that only has "gear-world" in a folder name (e.g. an app's file server) never holds it up.
function Test-GwCommand($p) {
    $name = ([string]$p.Name).ToLowerInvariant()
    $cmd = [string]$p.Cmd
    if ($name -eq 'powershell.exe' -or $name -eq 'pwsh.exe') {
        return ($cmd -match '(?i)\.ps1' -and $cmd -match '(?i)(\\gw-[a-z0-9\-]*\.ps1|\\gear-world-code-[0-9a-f]{6,}\\|\\tools\\[a-z0-9\-]+\.ps1)')
    }
    if ($name -eq 'node.exe') { return ($cmd -match '(?i)wrangler|\\gear-world-code-[0-9a-f]{6,}\\') }
    return $false
}
# A short name for the report, never the whole command line: the -Tool of gw-run, else the script name, else wrangler.
function Get-ToolName($p) {
    $cmd = [string]$p.Cmd
    $m = [regex]::Match($cmd, '(?i)-Tool\s+["'']?([a-z0-9\-]+)')
    if ($m.Success) { return $m.Groups[1].Value }
    $ms = [regex]::Matches($cmd, '(?i)([a-z0-9\-]+)\.ps1')
    if ($ms.Count -gt 0) { return $ms[$ms.Count - 1].Groups[1].Value }
    if ($cmd -match '(?i)wrangler') { return 'wrangler' }
    return ([string]$p.Name)
}
# Other Gear World commands now: never this window's own chain (this script, gw-run that started it, the window).
function Get-OtherCommands {
    $all = Get-ProcessList
    $byId = @{}
    foreach ($p in $all) { $byId[[int]$p.Id] = $p }
    $mine = @{}
    $id = [int]$PID
    for ($i = 0; $i -lt 30 -and $id -gt 0 -and -not $mine.ContainsKey($id); $i++) {
        $mine[$id] = $true
        if (-not $byId.ContainsKey($id)) { break }
        $id = [int]$byId[$id].Parent
    }
    $names = New-Object System.Collections.Generic.List[string]
    foreach ($p in $all) {
        if ($mine.ContainsKey([int]$p.Id)) { continue }
        if (Test-GwCommand $p) {
            $n = Get-ToolName $p
            if (-not $names.Contains($n)) { $names.Add($n) }
        }
    }
    return @($names)
}
function Write-Report([string]$extra) {
    $file = Join-Path $OutDir ('GW_NIGHT_BACKUP_{0}.txt' -f $stamp)
    $text = $L -join "`r`n"
    try {
        if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
        [System.IO.File]::WriteAllText($file, $text + "`r`n", (New-Object System.Text.UTF8Encoding($true)))
        Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    } catch { Write-Host ('Η αναφορά δεν γράφτηκε: {0}' -f $_.Exception.Message) -ForegroundColor Red }
    $all = $text
    if ($extra) { $all = $text + "`r`n`r`n" + $extra }
    if ($SaveTo) { try { [System.IO.File]::WriteAllText($SaveTo, $all, (New-Object System.Text.UTF8Encoding($false))) } catch { } }
    if (-not $NoClipboard) {
        try {
            Set-Clipboard -Value $all
            Write-Host ('Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «{0}» και πάτα Ctrl+V.' -f $Chat) -ForegroundColor Green
        } catch { Write-Host 'Δεν μπόρεσα να βάλω την αναφορά στο πρόχειρο.' -ForegroundColor Yellow }
    }
}
function Finish([int]$code, [string]$extra = '') {
    $script:Done = $true
    if ($script:Awake) { [void](Set-Awake $false) }
    if ($null -ne $script:ConsoleMode) { [void](Set-QuickEdit $true) }
    Say 'ΤΕΛΟΣ BACKUP' 'Cyan'
    Set-Title 'GW BACKUP ΝΥΧΤΑΣ - ΤΕΛΟΣ'
    Write-Report $extra
    exit $code
}

try {
    Say 'Gear World - backup της νύχτας (περιμένει να τελειώσει κάθε άλλη εντολή Gear World, μετά τρέχει μόνο του)' 'Cyan'
    Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
    # 1. At once, before any wait: the phrase, the drive, the backup script.
    $qual = ''
    try { $qual = Split-Path -Qualifier $Target } catch { $qual = '' }
    $letter = $qual.TrimEnd(':').ToUpper()
    if (-not $letter) { Say ('ΠΡΟΒΛΗΜΑ: ο φάκελος {0} δεν έχει γράμμα δίσκου (π.χ. D:\GearWorldBackup). Δεν άλλαξε τίποτα.' -f $Target) 'Red'; Finish 2 }
    $phrase = 'ΕΓΚΡΙΝΩ BACKUP {0}' -f $letter
    if (-not $Approve) { Say ('Λείπει η φράση: η εντολή θέλει -Approve ''{0}''. Δεν άλλαξε τίποτα.' -f $phrase) 'Red'; Finish 1 }
    if ((Normalize-Phrase $Approve) -ne (Normalize-Phrase $phrase)) { Say ('Λάθος φράση έγκρισης (χρειάζεται: {0}). Δεν άλλαξε τίποτα.' -f $phrase) 'Red'; Finish 1 }
    if (-not (Test-Path -LiteralPath ($qual + '\'))) {
        Say ('ΠΡΟΒΛΗΜΑ: δεν βρίσκω τον δίσκο {0}:. Σύνδεσε τον εξωτερικό δίσκο και ξανατρέξε την εντολή. Δεν άλλαξε τίποτα.' -f $letter) 'Red'
        Finish 2
    }
    if (-not (Test-Path -LiteralPath $BackupScript)) { Say 'ΠΡΟΒΛΗΜΑ: λείπει το gw-backup.ps1 σε αυτή την έκδοση. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 2 }
    try {
        $di = New-Object System.IO.DriveInfo($letter)
        Say ('Δίσκος {0}: ελεύθερα {1:N1} GB από {2:N1} GB. Φάκελος: {3}' -f $letter, ($di.AvailableFreeSpace / 1GB), ($di.TotalSize / 1GB), $Target)
    } catch { Say ('Δίσκος {0}: υπάρχει. Φάκελος: {1}' -f $letter, $Target) }
    try {
        $sysd = New-Object System.IO.DriveInfo(([string]$env:SystemDrive).TrimEnd(':'))
        $sysFree = $sysd.AvailableFreeSpace / 1GB
        if ($sysFree -lt 10) { Say ('ΠΡΟΣΟΧΗ: ο δίσκος των Windows έχει μόνο {0:N1} GB ελεύθερα (το backup κρατά εκεί προσωρινά τα zip του GitHub).' -f $sysFree) 'Yellow' }
    } catch { }
    Say ('Φράση έγκρισης: εντάξει ({0}).' -f $phrase)

    # 2. The wait: nothing changes, the PC stays awake.
    if (Set-Awake $true) { Say 'Ο υπολογιστής μένει ξύπνιος και η οθόνη ανοιχτή όσο περιμένει και όσο τρέχει το backup (χωρίς αλλαγή ρυθμίσεων). Αν είναι laptop, καπάκι ανοιχτό και καλώδιο στην πρίζα.' }
    else { Say 'ΠΡΟΣΟΧΗ: δεν μπόρεσα να κρατήσω τον υπολογιστή ξύπνιο. Αν κοιμηθεί, συνεχίζει όταν ξυπνήσει.' 'Yellow' }
    if (Set-QuickEdit $false) { Say 'Ένα κλικ μέσα στο παράθυρο δεν το σταματά.' }
    Set-Title 'GW BACKUP ΝΥΧΤΑΣ - περιμένει, μην κλείσεις το παράθυρο'
    $startWait = Get-Date
    $deadline = $startWait.AddHours($MaxWaitHours)
    $quietSince = $startWait
    $seen = New-Object System.Collections.Generic.List[string]
    $nextBeat = $startWait.AddMinutes(15)
    $wasBusy = $false
    Say ('Περιμένω μέχρι να μην τρέχει καμία άλλη εντολή Gear World για {0} λεπτά στη σειρά, το πολύ ως τις {1}.' -f $QuietMinutes, $deadline.ToString('HH:mm'))
    while ($true) {
        $now = Get-Date
        # One failed look at the process list (rare) counts as busy for that minute, never as a reason to stop.
        try { $busy = @(Get-OtherCommands) } catch { $busy = @('λίστα προγραμμάτων μη διαθέσιμη') }
        if ($busy.Count -gt 0) {
            foreach ($b in $busy) { if (-not $seen.Contains($b)) { $seen.Add($b) } }
            if (-not $wasBusy) { Say ('{0}: τρέχει ακόμα άλλη εντολή Gear World ({1}). Περιμένω να τελειώσει.' -f $now.ToString('HH:mm'), ($busy -join ', ')) 'Yellow' }
            $wasBusy = $true
            $quietSince = $null
        } elseif ($wasBusy -or $null -eq $quietSince) {
            $quietSince = $now
            $wasBusy = $false
            Say ('{0}: η άλλη εντολή τελείωσε. Ξεκινώ το backup αν δεν ξεκινήσει άλλη μέσα σε {1} λεπτά.' -f $now.ToString('HH:mm'), $QuietMinutes)
        }
        if ($null -ne $quietSince -and ($now - $quietSince).TotalMinutes -ge $QuietMinutes) { break }
        if ($now -ge $deadline) {
            Say ''
            Say ('ΔΕΝ ΞΕΚΙΝΗΣΕ: στις {0} έτρεχε ακόμα άλλη εντολή Gear World ({1}). Το backup δεν έγινε, για να είναι ελεύθερο το πρωί. Δεν άλλαξε τίποτα στον δίσκο.' -f $now.ToString('HH:mm'), (($seen | Select-Object -Last 3) -join ', ')) 'Yellow'
            Say 'Στείλε την αναφορά στο Claude «4 · Sites & Κώδικας» για νέα νύχτα.'
            Finish 3
        }
        if ($now -ge $nextBeat) {
            if ($wasBusy) { Say ('{0}: περιμένω ακόμα ({1}).' -f $now.ToString('HH:mm'), ($busy -join ', ')) }
            $nextBeat = $now.AddMinutes(15)
        }
        Start-Sleep -Seconds $PollSec
    }
    $waited = [int][Math]::Round(((Get-Date) - $startWait).TotalMinutes)
    if ($seen.Count -gt 0) { Say ('Περίμενα {0} λεπτά να τελειώσουν: {1}.' -f $waited, ($seen -join ', ')) }
    else { Say ('Δεν έτρεχε άλλη εντολή Gear World ({0} λεπτά έλεγχος).' -f $waited) }

    # 3. The backup of this same version, with the same phrase (its own checks, report and «ΤΕΛΟΣ BACKUP»).
    $bStart = Get-Date
    Say ('{0}: ξεκινά το backup (gw-backup -Apply). Μην κλείσεις το παράθυρο· τελείωσε όταν η τελευταία γραμμή γράψει ΤΕΛΟΣ BACKUP.' -f $bStart.ToString('HH:mm')) 'Cyan'
    Set-Title 'GW BACKUP τρέχει - μην κλείσεις το παράθυρο'
    $exe = (Get-Process -Id $PID).Path
    $bArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $BackupScript, '-Target', $Target, '-Apply', '-Approve', $Approve, '-Chat', $Chat, '-NoClipboard', '-HomeDir', $HomeDir, '-OutDir', $OutDir)
    if ($AllowSystemDrive) { $bArgs += '-AllowSystemDrive' }
    & $exe @bArgs
    $code = $LASTEXITCODE
    $mins = [int][Math]::Round(((Get-Date) - $bStart).TotalMinutes)
    Say ''
    Say ('{0}: το backup τελείωσε σε {1} λεπτά, exit {2}.' -f (Get-Date -Format 'HH:mm'), $mins, $code)
    $rep = @(Get-ChildItem -LiteralPath $OutDir -Filter 'GW_BACKUP_*.txt' -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^GW_BACKUP_[0-9]' -and $_.LastWriteTime -ge $bStart.AddSeconds(-5) } |
        Sort-Object LastWriteTime | Select-Object -Last 1)
    $extra = ''
    if ($rep.Count -gt 0) {
        $extra = ('===== {0} =====' -f $rep[0].Name) + "`r`n" + ([System.IO.File]::ReadAllText($rep[0].FullName)).Trim([char]0xFEFF).TrimEnd()
    } else {
        Say 'ΠΡΟΣΟΧΗ: δεν βρήκα την αναφορά του backup (GW_BACKUP_...).' 'Yellow'
    }
    if ($code -eq 0) { Say 'ΕΤΟΙΜΟ: το backup της νύχτας έγινε.' 'Green' }
    else { Say ('Το backup τελείωσε με exit {0}: στείλε την αναφορά στο Claude.' -f $code) 'Yellow' }
    Finish $code $extra
} catch {
    Say ('ΠΡΟΒΛΗΜΑ: η εντολή σταμάτησε απρόσμενα: {0}' -f $_.Exception.Message) 'Red'
    Finish 13
} finally {
    # Ctrl+C: .NET calls only (cmdlets can fail while PowerShell stops). The report says how far it got.
    if (-not $script:Done) {
        try {
            $L.Add('ΔΙΑΚΟΠΗ: σταμάτησε με Ctrl+C.')
            $L.Add('ΤΕΛΟΣ BACKUP')
            if (-not [System.IO.Directory]::Exists($OutDir)) { [void][System.IO.Directory]::CreateDirectory($OutDir) }
            [System.IO.File]::WriteAllText([System.IO.Path]::Combine($OutDir, ('GW_NIGHT_BACKUP_{0}.txt' -f $stamp)), ($L -join "`r`n"), (New-Object System.Text.UTF8Encoding($true)))
        } catch { }
        try { if ($script:Awake) { [void][GwNightPower.Native]::SetThreadExecutionState([uint32]2147483648) } } catch { }
        try { if ($null -ne $script:ConsoleMode) { [void][GwNightPower.Native]::SetConsoleMode([GwNightPower.Native]::GetStdHandle(-10), [uint32]$script:ConsoleMode) } } catch { }
    }
}
