<#
.SYNOPSIS
  Gear World - backup of the Gear World folders on this PC, the GitHub code and the site databases to an external drive.

.DESCRIPTION
  Without -Apply: READ-ONLY. Checks the drive, the network and the wrangler login, and shows what WOULD be copied
  (folders, feeds, GitHub branches, databases), what stays OUT (keys and customer data), how big it is and whether it
  fits. Writes nothing to the drive.

  With -Apply and the approval phrase (-Approve 'ΕΓΚΡΙΝΩ BACKUP <drive letter>', e.g. ΕΓΚΡΙΝΩ BACKUP D) it runs on its
  own, without any question (lessons L113), and writes to <drive>:\GearWorldBackup\ :
    files\     the Gear World folders in your user folder (gear-world-hub, construction-gear-uk, mens-gear-world ...,
               *-engine, every <name>-gear-world, gear-world-import, gear-world-reports ...) and the Awin feeds in
               Downloads (GW_AWIN_BULK_ARCHIVE and <advertiserId>-*.csv.gz). node_modules and .wrangler are skipped
               (they come back with npm). Only new or changed files are copied.
    github\    a zip of every branch of evangelos-gif/gear-world-code and of gearworld-media (an unchanged branch is
               not downloaded again).
    d1\        every Cloudflare D1 database: schema.sql, tables.txt (every table and its rows) and the rows as JSON
               pages. Rowid tables are read by rowid ranges, WITHOUT ROWID tables (price_log, price_last ...) in key
               order with LIMIT/OFFSET pages. READ-ONLY for Cloudflare: only SELECT.
    README-RESTORE.txt  how to get everything back.
  NOT on the drive (the drive is not encrypted): .dev.vars, .env, key files (*.pem, *.key ...), the folder
  gear-world-secrets, any file with a key or token in it, any file with several e-mail addresses that are not ours
  (text files, .gz, .zip/.xlsx/.docx and SQLite files are read; .7z/.rar cannot be read and stay out), files over
  -ScanMaxMB (200 MB; read in 1 MB pieces) that could not be read through, locked files, and the rows of customer tables (hub_subscribers,
  customers, newsletter, reward_*, any table with an e-mail or IP column, rate counters): for those only the number of
  rows. The report lists every file left out, by path only. Old copies of such files from an earlier backup are
  removed from the drive (also when the file is no longer on the PC); a file that is locked or too slow to check now
  keeps its old copy only if that old copy reads clean (no key, no e-mails, and it could be checked). The keys live as Cloudflare secrets, the
  customers in D1 and MailerLite. The Awin feeds are copied without reading them (they are product data).
  While it runs the PC is kept awake and the screen on (SetThreadExecutionState, no power setting is changed), and a
  click in the window does not pause it; at the end both are normal again.
  It first checks the drive, the space, the network and the wrangler login, and stops at once if one is missing.
  A table that fails is noted and the backup goes on. Anything unexpected still ends with the report, and so does
  Ctrl+C («ΔΙΑΚΟΠΗ»: the report file is written, gw-last-report puts it on the clipboard). Every part prints its start time and progress; the report ends with how many minutes
  each part took («Χρόνοι:»). Order: files, databases, then GitHub (the code is on GitHub anyway). The last line
  is ΤΕΛΟΣ BACKUP. For a clean start in a new folder: -Target D:\GearWorldBackup-<date> (lessons L117).

  Report: <home>\gear-world-reports\GW_BACKUP_<time>.txt (also copied to the clipboard)
#>
param(
    [string]$Target = 'D:\GearWorldBackup',
    [switch]$Apply,
    [string]$Approve = '',
    [switch]$SkipFeeds,
    [switch]$SkipDatabases,
    [switch]$SkipGitHub,
    [switch]$AllowSystemDrive,
    [string]$HomeDir = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [int]$PageRows = 3000,
    [int]$ScanMaxMB = 200,
    [int]$FileBudgetSec = 60,
    [string]$Chat = '4 · Sites & Κώδικας',
    [int]$ProgressSec = 30,
    [string[]]$NetworkUrls = @(),
    [switch]$SkipNetworkCheck,
    [switch]$NoClipboard,
    [switch]$TestInterrupt # tests only: behaves as if Ctrl+C was pressed right after the checks
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue' # much faster downloads in Windows PowerShell 5.1
# HTTPS with TLS 1.2: Windows PowerShell 5.1 may still offer only older TLS, which GitHub and Cloudflare refuse (L106).
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (-not $HomeDir) { $HomeDir = $HOME }
if (-not $OutDir) { $OutDir = Join-Path $HomeDir 'gear-world-reports' }
if (-not $WorkDir) { $WorkDir = Join-Path $HomeDir 'gear-world-backup-work' }
if ($PageRows -lt 1) { $PageRows = 3000 }
if ($FileBudgetSec -lt 0) { $FileBudgetSec = 60 }
if ($ProgressSec -lt 0) { $ProgressSec = 30 } # 0 = a line for every file (tests)
$script:FileDeadline = [DateTime]::MaxValue
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Owner = 'evangelos-gif'
$Repos = @('gear-world-code', 'gearworld-media')
$WranglerVersion = '4.158.0'
$SkipDirs = @('node_modules', '.wrangler', '.cache', '.npm')
# Never on the drive (lessons L113): files with these names, and these folders of the user folder.
$SecretNames = @('.dev.vars', '.dev.vars.*', '.env', '.env.*', '*.pem', '*.key', '*.pfx', '*.p12', '*.kdbx', '.npmrc')
$SecretDirs = @('gear-world-secrets')
# Files read to find keys and customer e-mails (up to -ScanMaxMB each; bigger ones stay out, lessons L113). SQLite files
# keep text as UTF-8, so they are read the same way; .gz, .zip, .xlsx and .docx are read inside.
$ScanExt = @('', '.sql', '.csv', '.tsv', '.json', '.jsonl', '.ndjson', '.txt', '.log', '.xml', '.ini', '.cfg', '.conf', '.toml', '.jsonc', '.yaml', '.yml', '.ps1', '.psm1', '.bat', '.cmd', '.js', '.mjs', '.cjs', '.ts', '.py', '.md', '.html', '.htm', '.bak', '.old', '.vars', '.env', '.db', '.sqlite', '.sqlite3', '.dump')
# A key or token written as a value (a name like ..._KEY, ...TOKEN, SECRET, PASSWORD, then 20+ letters AND digits),
# a private key block, a Bearer token or a JWT. The begin marker is split so the repo's own secret scan does not match it.
# Both have a 5-second limit per file, so one odd file can never hold the backup up.
$RxLimit = [TimeSpan]::FromSeconds(5)
$RxOpts = [System.Text.RegularExpressions.RegexOptions]::Compiled # compiled: much faster on .NET Framework
$SecretRx = [System.Text.RegularExpressions.Regex]::new(('(?i)(-----BEGIN ' + '[A-Z ]*PRIVATE KEY-----' + '|\b(?![A-Za-z0-9_]*site_?key\b)[A-Za-z0-9_]*(?:key|token|secret|password|passwd|pwd)\b["'']?\s*[:=]\s*["'']?(?=[A-Za-z_\-+/]*[0-9])(?=[0-9_\-+/]*[A-Za-z])[A-Za-z0-9_\-+/=]{20,}' + '|/api' + 'key/[A-Za-z0-9]{16,}' + '|\bgh[pousr]_[A-Za-z0-9]{30,}' + '|\bgithub' + '_pat_[A-Za-z0-9_]{40,}' + '|://[^\s/:@]+:[^\s/@]{8,}@' + '|\bBearer\s+(?=[A-Za-z_\-\.]*[0-9])[A-Za-z0-9_\-\.]{20,}' + '|\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.)'), $RxOpts, $RxLimit)
# An address starts only where a run of address characters starts (the lookbehind keeps the search linear).
$EmailRx = [System.Text.RegularExpressions.Regex]::new('(?<![A-Za-z0-9._%+\-])[A-Za-z0-9._%+\-]+@(?:[A-Za-z0-9\-]+\.)+[A-Za-z]{2,24}\b', $RxOpts, $RxLimit)
# Addresses that are not customers: our domains, examples, services; and file names such as logo@2x.png.
$NotCustomerRx = '(?i)(@|\.)(gearworldhub\.com|gearworldgroup\.com|[a-z]*gearworld\.com|example\.(com|org|net)|users\.noreply\.github\.com|anthropic\.com|cloudflare\.com|w3\.org)$|^(no-?reply|noreply)@|\.(png|jpe?g|gif|svg|webp|avif|ico|js|mjs|css|map|json|html?)$'
$EmailLimit = 3 # a file with this many different customer-like addresses stays out
$ScanBuf = New-Object char[] 1048576 # one buffer for every file read
$ArchiveOut = @('.7z', '.rar', '.tgz', '.tar') # cannot be read here: they stay out
$ZipExt = @('.zip', '.xlsx', '.xlsm', '.docx')
# Tables whose rows never go to the drive, only their number (lessons L113): customers, sign-ups, rewards, users,
# visitor counters, and any table with an e-mail, IP or phone column.
$CountOnlyNameRx = '(?i)^(hub_subscribers|subscribers?|customers?|newsletter\w*|members?|users?|rewards?\w*|\w+_(subscribers?|members?|customers?|users?)|rate_limits?|member_rate|\w+_usage)$'
$PersonalColRx = '(?i)[(,]\s*["`\[]?(e_?mail\w*|ip|ip_?addr\w*|client_ip|remote_ip|phone\w*|mobile)["`\]]?\s'

$L = New-Object System.Collections.Generic.List[string]
$script:Awake = $false
$script:ConsoleMode = $null
$script:Finishing = $false
# How long each part took, in the report (lessons L117): on 11-12/11 a backup ran all night and nobody could tell where.
$script:Times = New-Object System.Collections.Generic.List[string]
$script:PhaseName = ''
$script:PhaseStart = $null
$script:NextBeat = [DateTime]::MinValue
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}
# Windows (kernel32): keep the PC awake, and stop a click in the window from pausing the run (Quick Edit). No setting
# is saved: both end with this script and this window (lessons L113).
function Initialize-Native {
    if ('GwBackupPower.Native' -as [type]) { return $true }
    try {
        $sig = '[System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);' +
            ' [System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern System.IntPtr GetStdHandle(int nStdHandle);' +
            ' [System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern bool GetConsoleMode(System.IntPtr hConsoleHandle, out uint lpMode);' +
            ' [System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern bool SetConsoleMode(System.IntPtr hConsoleHandle, uint dwMode);'
        Add-Type -Namespace GwBackupPower -Name Native -MemberDefinition $sig
        return $true
    } catch { return $false }
}
function Set-Awake([bool]$on) {
    if (-not (Initialize-Native)) { return $false }
    try {
        # ES_CONTINUOUS (0x80000000) + ES_SYSTEM_REQUIRED (0x1) + ES_DISPLAY_REQUIRED (0x2): no sleep and the screen stays
        # on (a laptop with Modern Standby can sleep when only the screen goes off). ES_CONTINUOUS alone: back to normal.
        if ($on) {
            [void][GwBackupPower.Native]::SetThreadExecutionState([uint32]2147483651)
            $script:Awake = $true
            return $true
        }
        [void][GwBackupPower.Native]::SetThreadExecutionState([uint32]2147483648)
        $script:Awake = $false
        return $true
    } catch { return $false }
}
# Quick Edit off for this window while the backup runs (a click or a selection would pause it); back as it was at the end.
function Set-QuickEdit([bool]$on) {
    try {
        if (-not (Initialize-Native)) { return $false }
        $h = [GwBackupPower.Native]::GetStdHandle(-10)
        if ($on) {
            if ($null -ne $script:ConsoleMode) { [void][GwBackupPower.Native]::SetConsoleMode($h, [uint32]$script:ConsoleMode); $script:ConsoleMode = $null }
            return $true
        }
        $mode = [uint32]0
        if (-not [GwBackupPower.Native]::GetConsoleMode($h, [ref]$mode)) { return $false }
        if (($mode -band 0x40) -eq 0) { return $true }
        $new = [uint32](($mode -bor 0x80) - 0x40) # ENABLE_EXTENDED_FLAGS on, ENABLE_QUICK_EDIT_MODE off
        if ([GwBackupPower.Native]::SetConsoleMode($h, $new)) { $script:ConsoleMode = $mode; return $true }
        return $false
    } catch { return $false }
}
function Set-Title([string]$t) { try { $Host.UI.RawUI.WindowTitle = $t } catch { } }
function End-Phase {
    if ($null -eq $script:PhaseStart) { return }
    $script:Times.Add(('{0}: {1} λεπτά' -f $script:PhaseName, [int][Math]::Round(((Get-Date) - $script:PhaseStart).TotalMinutes)))
    $script:PhaseStart = $null
}
function Start-Phase([string]$name) {
    End-Phase
    $script:PhaseName = $name
    $script:PhaseStart = Get-Date
    Say ''
    Say ('== {0} ({1}) ==' -f $name, $script:PhaseStart.ToString('HH:mm')) 'Cyan'
}
# After Ctrl+C PowerShell is stopping: cmdlets (Write-Host, Get-Date, Set-Clipboard, New-Object ...) may fail there, so
# this uses .NET calls only. It writes the report file (gw-last-report puts it back on the clipboard) (lessons L117).
function Write-Interrupted {
    $script:Finishing = $true
    try {
        if ($null -ne $script:PhaseStart) { $script:Times.Add(('{0}: {1} λεπτά' -f $script:PhaseName, [int][Math]::Round(([DateTime]::Now - $script:PhaseStart).TotalMinutes))) }
        $L.Add('ΔΙΑΚΟΠΗ: σταμάτησε πριν τελειώσει (Ctrl+C). Ό,τι γράφτηκε μέχρι εδώ μένει στον δίσκο.')
        if ($script:Times.Count -gt 0) { $L.Add('Χρόνοι: ' + ($script:Times -join ' · ')) }
        if ($Apply) { $L.Add('ΤΕΛΟΣ BACKUP') } else { $L.Add('ΤΕΛΟΣ ΕΛΕΓΧΟΥ BACKUP (δεν γράφτηκε τίποτα στον δίσκο)') }
        if (-not [System.IO.Directory]::Exists($OutDir)) { [void][System.IO.Directory]::CreateDirectory($OutDir) }
        $file = [System.IO.Path]::Combine($OutDir, ('GW_BACKUP_{0}.txt' -f $stamp))
        [System.IO.File]::WriteAllText($file, ($L -join "`r`n"), [System.Text.UTF8Encoding]::new($true))
        [Console]::WriteLine('Η αναφορά γράφτηκε: ' + $file)
    } catch { }
    try { if ($script:Awake) { [void][GwBackupPower.Native]::SetThreadExecutionState([uint32]2147483648) } } catch { }
    try { if ($null -ne $script:ConsoleMode) { [void][GwBackupPower.Native]::SetConsoleMode([GwBackupPower.Native]::GetStdHandle(-10), [uint32]$script:ConsoleMode) } } catch { }
    try { if ($Apply) { $Host.UI.RawUI.WindowTitle = 'GW BACKUP - ΔΙΑΚΟΠΗ' } } catch { }
}
# A progress line at most every -ProgressSec seconds, on the screen only (lessons L115, L117).
function Beat([string]$msg) {
    if ([DateTime]::UtcNow -lt $script:NextBeat) { return }
    Write-Host ('      ... {0}  ({1})' -f $msg, (Get-Date -Format 'HH:mm'))
    $script:NextBeat = [DateTime]::UtcNow.AddSeconds($ProgressSec)
}
function Finish([int]$code) {
    if ($script:Finishing) { exit $code }
    $script:Finishing = $true
    End-Phase
    if ($script:Times.Count -gt 0) { Say ('Χρόνοι: {0}' -f ($script:Times -join ' · ')) }
    if ($script:Awake) { [void](Set-Awake $false); Say 'Ο υπολογιστής γύρισε στον κανονικό ύπνο.' }
    if ($null -ne $script:ConsoleMode) { [void](Set-QuickEdit $true) }
    if ($Apply) {
        Say 'ΤΕΛΟΣ BACKUP' 'Cyan'
        Set-Title 'GW BACKUP - ΤΕΛΟΣ'
    }
    else { Say 'ΤΕΛΟΣ ΕΛΕΓΧΟΥ BACKUP (δεν γράφτηκε τίποτα στον δίσκο)' 'Cyan' }
    $file = Join-Path $OutDir ('GW_BACKUP_{0}.txt' -f $stamp)
    $text = $L -join "`r`n"
    $written = $false
    try {
        if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
        [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
        $written = $true
    } catch { Write-Host ('Η αναφορά δεν γράφτηκε στο {0}: {1}' -f $file, $_.Exception.Message) -ForegroundColor Red }
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    if ($written) { Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file) }
    # The chat that gave the command is named (owner, 11/11/2026, lessons L116).
    if (-not $NoClipboard) { Write-Host ('Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «{0}» και πάτα Ctrl+V.' -f $Chat) -ForegroundColor Green }
    exit $code
}
# Anything unexpected still ends with the report, the clipboard and the last line, never a silent stop (lessons L113).
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
function Test-SecretName([string]$name) {
    foreach ($p in $SecretNames) { if ($name -like $p) { return $true } }
    return $false
}
# Reads text in 1 MB pieces (the last 512 characters again at the start of the next piece, so nothing is missed at an
# edge) and returns 'key', 'emails' or ''. A regex that runs out of time throws: the caller makes it 'slow'.
function Test-TextReader([System.IO.TextReader]$reader) {
    $buf = $ScanBuf
    $tail = ''
    $seen = @{}
    while ($true) {
        $n = $reader.ReadBlock($buf, 0, $buf.Length)
        if ($n -le 0) { break }
        $text = $tail + [string]::new($buf, 0, $n)
        if ($SecretRx.IsMatch($text)) { return 'key' }
        if ($text.IndexOf([char]'@') -ge 0) { # no @, no address: skip the e-mail search
            $m = $EmailRx.Match($text)
            while ($m.Success) {
                $a = $m.Value.ToLowerInvariant()
                if (-not ($a -match $NotCustomerRx)) { $seen[$a] = $true; if ($seen.Count -ge $EmailLimit) { return 'emails' } }
                $m = $m.NextMatch()
            }
        }
        if ($text.Length -gt 512) { $tail = $text.Substring($text.Length - 512) } else { $tail = $text }
        if ($n -lt $buf.Length) { break }
        # One file never holds the check up for long (-FileBudgetSec, lessons L115): it stays out as 'slow'.
        if ([DateTime]::UtcNow -gt $script:FileDeadline) { return 'slow' }
    }
    return ''
}
function Test-Scannable([string]$name) {
    $ext = [System.IO.Path]::GetExtension($name).ToLowerInvariant()
    if ($ext -eq '.gz') { $ext = [System.IO.Path]::GetExtension([System.IO.Path]::GetFileNameWithoutExtension($name)).ToLowerInvariant() }
    return ($ScanExt -contains $ext)
}
# Why a file must stay off the drive: 'key', 'emails', 'slow', 'unreadable', 'archive', 'big' or '' (lessons L113).
# The file is opened so that a program writing to it does not stop the read; if it cannot be opened it stays out.
function Get-SensitiveReason([string]$path) {
    $script:FileDeadline = [DateTime]::UtcNow.AddSeconds($FileBudgetSec)
    $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
    if ($ArchiveOut -contains $ext) { return 'archive' }
    $isZip = $ZipExt -contains $ext
    $isGz = ($ext -eq '.gz')
    if ($isGz -and ($ArchiveOut -contains [System.IO.Path]::GetExtension([System.IO.Path]::GetFileNameWithoutExtension($path)).ToLowerInvariant())) { return 'archive' } # .tar.gz
    if (-not $isZip -and -not (Test-Scannable ([System.IO.Path]::GetFileName($path)))) { return '' }
    $fi = New-Object System.IO.FileInfo($path)
    if ($fi.Length -eq 0) { return '' }
    if ($fi.Length -gt ([long]$ScanMaxMB * 1MB)) { return 'big' }
    $fs = $null
    try { $fs = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete)) } catch { return 'unreadable' }
    try {
        if ($isZip) {
            Add-Type -AssemblyName System.IO.Compression
            $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Read)
            try {
                foreach ($entry in $zip.Entries) {
                    if ([DateTime]::UtcNow -gt $script:FileDeadline) { return 'slow' } # many entries: the same time budget (L115)
                    $ee = [System.IO.Path]::GetExtension($entry.Name).ToLowerInvariant()
                    if (($ArchiveOut -contains $ee) -or ($ZipExt -contains $ee) -or $ee -eq '.gz') { return 'archive' } # an archive inside
                    if (-not (Test-Scannable $entry.Name) -or $entry.Length -eq 0) { continue }
                    if ($entry.Length -gt ([long]$ScanMaxMB * 1MB)) { return 'big' }
                    $r = New-Object System.IO.StreamReader($entry.Open())
                    try { $x = Test-TextReader $r } finally { $r.Dispose() }
                    if ($x) { return $x }
                }
            } finally { $zip.Dispose() }
            return ''
        }
        $stream = $fs
        if ($isGz) { $stream = New-Object System.IO.Compression.GZipStream($fs, [System.IO.Compression.CompressionMode]::Decompress) }
        $reader = New-Object System.IO.StreamReader($stream)
        try { return (Test-TextReader $reader) } finally { $reader.Dispose() }
    } catch {
        # Could not be checked (in time): it stays out, to be safe. PowerShell wraps the .NET error, so look inside.
        $ex = $_.Exception
        while ($ex) { if ($ex -is [System.Text.RegularExpressions.RegexMatchTimeoutException]) { return 'slow' }; $ex = $ex.InnerException }
        return 'unreadable'
    } finally {
        if ($fs) { $fs.Dispose() }
    }
}
# Size of a folder without node_modules and the other skipped folders, and the files that must stay out. Without
# $content only the names are checked (the Awin feeds: product data). A file or folder that cannot be read stays out.
function Get-FolderScan([string]$dir, [bool]$content = $true) {
    $total = [double]0; $count = 0
    $out = New-Object System.Collections.Generic.List[object]
    # A line at least every -ProgressSec seconds, so a long folder shows that it moves (lessons L115).
    $clock = [System.Diagnostics.Stopwatch]::StartNew()
    $next = [long]$ProgressSec * 1000
    $seenFiles = 0
    $stack = New-Object System.Collections.Stack
    $stack.Push($dir)
    while ($stack.Count -gt 0) {
        $d = $stack.Pop()
        $rel = $d.Substring($dir.Length).TrimStart('\', '/')
        $files = $null
        try { $files = [System.IO.Directory]::GetFiles($d) } catch { if ($rel) { $out.Add(@{ path = $d; rel = $rel; reason = 'unreadable'; dir = $true }) }; continue }
        foreach ($f in $files) {
            $seenFiles++
            if ($clock.ElapsedMilliseconds -ge $next) {
                Write-Host ('      ... {0} λεπτά, {1} αρχεία, {2} · τώρα: {3}' -f [int][Math]::Floor($clock.Elapsed.TotalMinutes), $seenFiles, (Format-Size $total), $f.Substring($dir.Length).TrimStart('\', '/'))
                $next = $clock.ElapsedMilliseconds + ([long]$ProgressSec * 1000)
            }
            $reason = ''
            $len = [long]0
            try {
                $fi = New-Object System.IO.FileInfo($f)
                $len = $fi.Length
                if (Test-SecretName $fi.Name) { $reason = 'name' }
                elseif ($content) { $reason = Get-SensitiveReason $f }
            } catch { $reason = 'unreadable' }
            if ($reason) { $out.Add(@{ path = $f; rel = $f.Substring($dir.Length).TrimStart('\', '/'); reason = $reason; dir = $false }) }
            else { $total += $len; $count++ }
        }
        $subs = @()
        try { $subs = [System.IO.Directory]::GetDirectories($d) } catch { }
        foreach ($s in $subs) {
            $name = [System.IO.Path]::GetFileName($s)
            if ($SkipDirs -contains $name) { continue }
            try {
                $attr = [System.IO.File]::GetAttributes($s)
                if (($attr -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
            } catch { $out.Add(@{ path = $s; rel = $s.Substring($dir.Length).TrimStart('\', '/'); reason = 'unreadable'; dir = $true }); continue }
            $stack.Push($s)
        }
    }
    return @{ bytes = $total; files = $count; out = $out }
}
# HTTPS reachable? Any HTTP answer (even 401/404) means the network works. 15 seconds at most, never waits longer.
function Test-Https([string]$url) {
    try {
        $req = [System.Net.WebRequest]::Create($url)
        $req.Method = 'HEAD'; $req.Timeout = 15000; $req.UserAgent = 'gear-world-backup'
        $resp = $req.GetResponse(); $resp.Close()
        return $true
    } catch {
        $e = $_.Exception
        while ($e -and -not ($e -is [System.Net.WebException])) { $e = $e.InnerException }
        if ($e -and $e.Response) { try { $e.Response.Close() } catch { }; return $true }
        return $false
    }
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1. The version is fixed
# (L113): a bare 'npx wrangler' takes whatever npm offers that day.
function Invoke-Wrangler([string]$Folder, [string]$Arguments) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tmp = [System.IO.Path]::GetTempPath()
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler@{0} {1} 2>&1' -f $WranglerVersion, $Arguments))
    $result = $null
    for ($try = 1; $try -le 3; $try++) {
        $cmdFile = Join-Path $tmp ('gw-wrangler-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
        [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        }
        $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
        $result = @{ code = $code; text = $text }
        $network = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|\b429\b|\b503\b|Too Many Requests|Service Unavailable|temporarily unavailable|overloaded|try again later|\b10000\b'
        if ($code -eq 0 -or -not $network -or $try -eq 3) { break }
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}
# The JSON array wrangler printed with --json: it starts on its own line with '[' then '{', ']' or the line end, so a
# warning such as "[WARNING] ..." printed before it is skipped.
function Get-JsonText([string]$text) {
    $m = [regex]::Match($text, '(?m)^\s*\[\s*(\{|\]|$)')
    if (-not $m.Success) { return '' }
    $i = $text.IndexOf('[', $m.Index)
    $j = $text.LastIndexOf(']')
    if ($i -lt 0 -or $j -le $i) { return '' }
    return $text.Substring($i, $j - $i + 1)
}
# Only SELECT, only on the Cloudflare databases. Returns the rows, or $null.
function Select-Rows([string]$db, [string]$sql) {
    if ($sql -notmatch '^\s*SELECT ') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --json --command "{1}"' -f $db, $sql)
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonText $r.text
    if (-not $j) { return $null }
    try { return @(($j | ConvertFrom-Json)[0].results) } catch { return $null }
}
function Test-CountOnly([string]$table, [string]$sql) {
    return (($table -match $CountOnlyNameRx) -or ($sql -match $PersonalColRx))
}
# The CREATE TABLE text of one table inside a schema.sql written by this script ('' if not found).
function Get-CreateSql([string]$schema, [string]$table) {
    $m = [regex]::Match($schema, ('(?is)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["''`\[]?' + [regex]::Escape($table) + '["''`\]]?\s*\(.*?\)\s*(?:WITHOUT\s+ROWID\s*)?;'))
    if ($m.Success) { return $m.Value }
    return ''
}
# The primary key columns of a WITHOUT ROWID table, for a stable page order ('' if they cannot be read).
function Get-OrderBy([string]$sql) {
    $cols = @()
    $m = [regex]::Match($sql, '(?is)PRIMARY\s+KEY\s*\(([^)]*)\)')
    if ($m.Success) {
        foreach ($p in $m.Groups[1].Value.Split(',')) {
            $c = (($p.Trim() -split '\s+')[0]).Trim('"', '`', '[', ']', "'")
            if ($c -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { return '' }
            $cols += $c
        }
    } else {
        $m2 = [regex]::Match($sql, '(?i)[(,]\s*["`\[]?([A-Za-z_][A-Za-z0-9_]*)["`\]]?\s+[A-Za-z]+[^,]*?\bPRIMARY\s+KEY')
        if ($m2.Success) { $cols += $m2.Groups[1].Value }
    }
    if ($cols.Count -eq 0) { return '' }
    return (' ORDER BY ' + ($cols -join ', '))
}
# One table into JSON pages in $dir. Returns ok, mode, rows (from COUNT), pages.
function Backup-Table([string]$db, [string]$t, [string]$sql, [string]$dir) {
    if (Test-CountOnly $t $sql) {
        $c = Select-Rows $db ('SELECT COUNT(*) AS n FROM {0}' -f $t)
        if ($null -eq $c -or $c.Count -eq 0) { return @{ ok = $false; mode = 'μόνο πλήθος'; rows = -1; pages = 0 } }
        return @{ ok = $true; mode = 'μόνο πλήθος (στοιχεία πελατών/επισκεπτών)'; rows = [long]$c[0].n; pages = 0 }
    }
    $enc = New-Object System.Text.UTF8Encoding($false)
    if ($sql -match '(?i)\bWITHOUT\s+ROWID\b') {
        # No rowid: pages in key order, until a page comes back empty. A row added meanwhile (price log every 15
        # minutes) can only repeat a row at a page edge; a row removed meanwhile could make one be missed, so the rows
        # read are counted: fewer than the table had at the start = a problem, and the old copy is kept (lessons L113).
        $c = Select-Rows $db ('SELECT COUNT(*) AS n FROM {0}' -f $t)
        if ($null -eq $c -or $c.Count -eq 0) { return @{ ok = $false; mode = 'σελίδες με κλειδί'; rows = -1; pages = 0 } }
        $n = [long]$c[0].n
        $order = Get-OrderBy $sql
        $ok = $true; $page = 0; $done = $false; $read = [long]0; $fails = 0
        $max = [long][Math]::Ceiling($n / $PageRows) * 2 + 10
        for ($i = 0; $i -lt $max; $i++) {
            Beat ('{0}.{1}: σελίδα {2} από περίπου {3}' -f $db, $t, ($i + 1), [long][Math]::Ceiling($n / $PageRows))
            $x = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --json --command "SELECT * FROM {1}{2} LIMIT {3} OFFSET {4}"' -f $db, $t, $order, $PageRows, ($i * [long]$PageRows))
            $j = Get-JsonText $x.text
            if ($x.code -ne 0 -or -not $j) {
                $ok = $false; $fails++; Say ('  ΠΡΟΒΛΗΜΑ: {0}.{1} σελίδα {2}' -f $db, $t, ($i + 1)) 'Red'
                if ($fails -ge 3) { Say ('  ΠΡΟΒΛΗΜΑ: {0}.{1}: 3 σελίδες στη σειρά απέτυχαν, ο πίνακας σταμάτησε' -f $db, $t) 'Red'; $done = $true; break }
                continue
            }
            $fails = 0
            $got = -1
            try { $got = @(($j | ConvertFrom-Json)[0].results).Count } catch { $got = -1 }
            if ($got -lt 0) { $ok = $false; Say ('  ΠΡΟΒΛΗΜΑ: {0}.{1} σελίδα {2} δεν διαβάστηκε' -f $db, $t, ($i + 1)) 'Red'; continue }
            if ($got -eq 0) { $done = $true; break }
            $read += $got
            $page++
            [System.IO.File]::WriteAllText((Join-Path $dir ('{0}-{1:D4}.json' -f $t, $page)), $j, $enc)
        }
        if (-not $done) { $ok = $false; Say ('  ΠΡΟΒΛΗΜΑ: {0}.{1}: δεν έφτασα στο τέλος του πίνακα μετά από {2} σελίδες' -f $db, $t, $max) 'Red' }
        elseif ($read -lt $n) { $ok = $false; Say ('  ΠΡΟΒΛΗΜΑ: {0}.{1}: διάβασα {2} γραμμές από {3}' -f $db, $t, $read, $n) 'Red' }
        $mode = 'σελίδες με κλειδί'
        if (-not $order) { $mode = 'σελίδες χωρίς σειρά κλειδιού' }
        return @{ ok = $ok; mode = $mode; rows = $n; pages = $page }
    }
    $range = Select-Rows $db ('SELECT MIN(rowid) AS a, MAX(rowid) AS b, COUNT(*) AS n FROM {0}' -f $t)
    if ($null -eq $range -or $range.Count -eq 0) { return @{ ok = $false; mode = 'σελίδες με rowid'; rows = -1; pages = 0 } }
    $n = [long]$range[0].n
    $ok = $true; $page = 0; $fails = 0
    if ($n -gt 0) {
        $lo = [long]$range[0].a; $hi = [long]$range[0].b
        for ($s = $lo; $s -le $hi; $s += $PageRows) {
            $page++
            Beat ('{0}.{1}: σελίδα {2} από {3}' -f $db, $t, $page, [long][Math]::Ceiling(($hi - $lo + 1) / $PageRows))
            $e = $s + $PageRows - 1
            $x = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --json --command "SELECT rowid AS _rowid, * FROM {1} WHERE rowid BETWEEN {2} AND {3}"' -f $db, $t, $s, $e)
            $j = Get-JsonText $x.text
            if ($x.code -ne 0 -or -not $j) {
                $ok = $false; $fails++; Say ('  ΠΡΟΒΛΗΜΑ: {0}.{1} σελίδα {2}' -f $db, $t, $page) 'Red'
                if ($fails -ge 3) { Say ('  ΠΡΟΒΛΗΜΑ: {0}.{1}: 3 σελίδες στη σειρά απέτυχαν, ο πίνακας σταμάτησε' -f $db, $t) 'Red'; break }
                continue
            }
            $fails = 0
            [System.IO.File]::WriteAllText((Join-Path $dir ('{0}-{1:D4}.json' -f $t, $page)), $j, $enc)
        }
    }
    return @{ ok = $ok; mode = 'σελίδες με rowid'; rows = $n; pages = $page }
}
# Old copies on the drive that must not stay there (lessons L113): secret files, the secrets folder, the files the scan
# found, and customer-table pages in d1\. Counts them, and with -Remove deletes them. Never touches anything else.
function Clear-DriveSensitive([bool]$Remove, $flaggedRel) {
    $found = New-Object System.Collections.Generic.List[string]
    $keys = @{}
    function Add-Found([string]$p) { $k = $p.ToLowerInvariant(); if (-not $keys.ContainsKey($k)) { $keys[$k] = $true; $found.Add($p) } }
    $files = Join-Path $Target 'files'
    if (Test-Path -LiteralPath $files) {
        foreach ($sd in $SecretDirs) {
            $p = Join-Path $files $sd
            if (Test-Path -LiteralPath $p) { Add-Found $p }
        }
        $feedsOnDrive = Join-Path $files 'Downloads'
        $clock = [System.Diagnostics.Stopwatch]::StartNew()
        $next = [long]$ProgressSec * 1000
        $seenFiles = 0
        foreach ($f in @(Get-ChildItem -LiteralPath $files -Recurse -File -Force -ErrorAction SilentlyContinue)) {
            $seenFiles++
            if ($clock.ElapsedMilliseconds -ge $next) {
                Write-Host ('      ... δίσκος: {0} λεπτά, {1} αρχεία · τώρα: {2}' -f [int][Math]::Floor($clock.Elapsed.TotalMinutes), $seenFiles, $f.FullName.Substring($files.Length).TrimStart('\', '/'))
                $next = $clock.ElapsedMilliseconds + ([long]$ProgressSec * 1000)
            }
            if (Test-SecretName $f.Name) { Add-Found $f.FullName; continue }
            # A file whose original is no longer on the PC is read here (the feeds in Downloads are product data).
            if ($f.FullName.StartsWith($feedsOnDrive + '\', [System.StringComparison]::OrdinalIgnoreCase)) { continue }
            $pc = Join-Path $HomeDir $f.FullName.Substring($files.Length).TrimStart('\', '/')
            if (Test-Path -LiteralPath $pc) { continue }
            # Anything that cannot be checked (.7z/.rar, over -ScanMaxMB, too slow, unreadable) goes too: the backup of
            # 3/11 checked nothing, so if in doubt, out (lessons L113).
            $why = ''
            try { $why = Get-SensitiveReason $f.FullName } catch { $why = 'unreadable' }
            if ($why) { Add-Found $f.FullName }
        }
        foreach ($rel in $flaggedRel) {
            $p = Join-Path $files $rel
            if (Test-Path -LiteralPath $p) { Add-Found $p }
        }
    }
    $d1 = Join-Path $Target 'd1'
    if (Test-Path -LiteralPath $d1) {
        foreach ($dbDir in @(Get-ChildItem -LiteralPath $d1 -Directory -ErrorAction SilentlyContinue)) {
            $schema = ''
            $sf = Join-Path $dbDir.FullName 'schema.sql'
            if (Test-Path -LiteralPath $sf) { try { $schema = [System.IO.File]::ReadAllText($sf) } catch { $schema = '' } }
            foreach ($f in @(Get-ChildItem -LiteralPath $dbDir.FullName -File -Filter '*.json' -ErrorAction SilentlyContinue)) {
                $m = [regex]::Match($f.Name, '^([A-Za-z_][A-Za-z0-9_]*)-\d{4}\.json$')
                if (-not $m.Success) { continue }
                $t = $m.Groups[1].Value
                if (Test-CountOnly $t (Get-CreateSql $schema $t)) { Add-Found $f.FullName }
            }
        }
    }
    $removed = 0
    if ($Remove) {
        foreach ($p in $found) {
            try {
                if (-not (Test-Path -LiteralPath $p)) { $removed++; continue } # already gone with its folder
                if (Test-Path -LiteralPath $p -PathType Container) { Remove-Item -LiteralPath $p -Recurse -Force } else { Remove-Item -LiteralPath $p -Force }
                $removed++
            } catch { Say ('  ΠΡΟΒΛΗΜΑ: δεν σβήστηκε από τον δίσκο: {0}' -f $p.Substring($Target.Length)) 'Red' }
        }
    }
    return @{ found = $found.Count; removed = $removed }
}

Write-Host ''
$mode = 'ΕΛΕΓΧΟΣ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν γράφει τίποτα στον δίσκο)'
if ($Apply) { $mode = 'ΑΝΤΙΓΡΑΦΟ ΑΣΦΑΛΕΙΑΣ (με έγκριση, τρέχει μόνο του)'; Set-Title 'GW BACKUP τρέχει - μην κλείσεις το παράθυρο' }
Say ('Gear World backup - {0}' -f $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
$phrase = 'ΕΓΚΡΙΝΩ BACKUP {0}' -f ((Split-Path -Qualifier $Target).TrimEnd(':').ToUpper())
$blockers = New-Object System.Collections.Generic.List[string]

# Everything below runs inside try/finally: Ctrl+C still writes the report, with how far it got (lessons L117).
try {
    # 0. The approval comes only from -Approve: this script never asks a question and never waits (lessons L113).
    if ($Apply) {
        if (-not $Approve) { Say ('Λείπει η φράση: η εντολή θέλει -Approve ''{0}''. Δεν άλλαξε τίποτα.' -f $phrase) 'Red'; Finish 1 }
        if ((Normalize-Phrase $Approve) -ne (Normalize-Phrase $phrase)) { Say ('Λάθος φράση έγκρισης (χρειάζεται: {0}). Δεν άλλαξε τίποτα.' -f $phrase) 'Red'; Finish 1 }
    }
    # From the first minute, in the check too: reading the folders can take a while, and on 10/11 the check stood still all
    # night because the PC slept (lessons L113, L115). Nothing in the settings changes; Finish puts both back.
    if (Set-Awake $true) { Say 'Ο υπολογιστής μένει ξύπνιος και η οθόνη ανοιχτή όσο τρέχει (χωρίς αλλαγή ρυθμίσεων). Αν είναι laptop, άφησε το καπάκι ανοιχτό και το καλώδιο στην πρίζα.' }
    else { Say 'ΠΡΟΣΟΧΗ: δεν μπόρεσα να κρατήσω τον υπολογιστή ξύπνιο. Αν κοιμηθεί, συνεχίζει όταν ξυπνήσει.' 'Yellow' }
    if (Set-QuickEdit $false) { Say 'Ένα κλικ μέσα στο παράθυρο δεν το σταματά πια.' }

    # 1. The drive.
    $qual = Split-Path -Qualifier $Target
    $letter = $qual.TrimEnd(':').ToUpper()
    $sysLetter = ([string]$env:SystemDrive).TrimEnd(':').ToUpper()
    if (-not (Test-Path -LiteralPath ($qual + '\'))) {
        Say ('ΠΡΟΒΛΗΜΑ: δεν βρίσκω τον δίσκο {0}:. Σύνδεσε τον εξωτερικό δίσκο (GWBackup) και ξανατρέξε την εντολή. Δεν άλλαξε τίποτα.' -f $letter) 'Red'
        Finish 2
    }
    if ($letter -eq $sysLetter -and -not $AllowSystemDrive) {
        Say ('ΠΡΟΒΛΗΜΑ: ο {0}: είναι ο δίσκος των Windows, όχι εξωτερικός. Δεν άλλαξε τίποτα.' -f $letter) 'Red'
        Finish 2
    }
    $di = New-Object System.IO.DriveInfo($letter)
    $label = ''
    try { $label = $di.VolumeLabel } catch { }
    $free = [double]$di.AvailableFreeSpace
    Say ('Δίσκος {0}: "{1}" ({2}), ελεύθερα {3} από {4}' -f $letter, $label, $di.DriveType, (Format-Size $free), (Format-Size ([double]$di.TotalSize)))
    Say ('Φάκελος αντιγράφου: {0}' -f $Target)

    # 2. Network (only what the backup uses), at most 15 seconds per address.
    if (-not $SkipNetworkCheck) {
        $urls = @($NetworkUrls)
        if ($urls.Count -eq 0) {
            if (-not $SkipDatabases) { $urls += 'https://api.cloudflare.com/client/v4/' }
            if (-not $SkipGitHub) { $urls += 'https://api.github.com/' }
        }
        foreach ($u in $urls) {
            if (Test-Https $u) { Say ('Δίκτυο: ΕΝΤΑΞΕΙ ({0})' -f ([Uri]$u).Host) }
            else {
                Say ('ΠΡΟΒΛΗΜΑ: δεν υπάρχει σύνδεση με το {0}. Έλεγξε το internet και ξανατρέξε την εντολή.' -f ([Uri]$u).Host) 'Red'
                if ($Apply) { Say 'Σταμάτησα πριν γράψω οτιδήποτε.'; Finish 5 }
                $blockers.Add('δίκτυο')
            }
        }
    }

    # 3. Databases: Node.js and the wrangler login (the list of databases is read here).
    $dbs = @()
    $dbBytes = [double]0
    if (-not $SkipDatabases) {
        Say ''
        Say '== Βάσεις Cloudflare D1 (μόνο ανάγνωση) =='
        if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
            Say 'ΠΡΟΒΛΗΜΑ: δεν βρέθηκε το Node.js, που χρειάζεται το wrangler για τις βάσεις.' 'Red'
            if ($Apply) { Say 'Σταμάτησα πριν γράψω οτιδήποτε.'; Finish 6 }
            $blockers.Add('Node.js')
        } else {
            if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
            $r = Invoke-Wrangler $WorkDir 'd1 list --json'
            $j = Get-JsonText $r.text
            $list = $null
            # Windows PowerShell 5.1 gives the whole JSON array as ONE object: unroll it, or several databases become one
            # name "a b c" and are all skipped (L113).
            if ($r.code -eq 0 -and $j) { try { $parsed = $j | ConvertFrom-Json; $list = @($parsed | ForEach-Object { $_ }) } catch { $list = $null } }
            if ($null -eq $list) {
                if ($r.text -match '(?i)not authenticated|wrangler login|not logged in|oauth') { Say 'ΠΡΟΒΛΗΜΑ: το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε αυτή την αναφορά στο Claude.' 'Red' }
                else { Say 'ΠΡΟΒΛΗΜΑ: δεν μπόρεσα να διαβάσω τις βάσεις από το Cloudflare. Στείλε αυτή την αναφορά στο Claude.' 'Red' }
                if ($Apply) { Say 'Σταμάτησα πριν γράψω οτιδήποτε.'; Finish 4 }
                $blockers.Add('σύνδεση wrangler')
            } else {
                Say 'Σύνδεση wrangler: ΕΝΤΑΞΕΙ'
                foreach ($x in $list) {
                    if ([string]$x.name -match '^[a-z0-9\-]{2,60}$') {
                        $dbs += [string]$x.name
                        try { if ($x.file_size) { $dbBytes += [double]$x.file_size } } catch { }
                    }
                }
                Say ('  {0} βάσεις: {1}' -f $dbs.Count, ($dbs -join ', '))
                Say '  Οι γραμμές τους διαβάζονται με SELECT, σε σελίδες. Πίνακες πελατών: μόνο το πλήθος τους.'
            }
        }
    }

    # 4. What would be copied from this PC, and what stays out.
    $copies = @()
    # Every site folder: the old names, plus any '<name>-gear-world...' folder, so a new site (e.g. sporty-gear-world)
    # is backed up without changing this script. The secrets folder never.
    $namePattern = '^(gear-world|gearworld|construction-gear|constraction-gear|mens-gear|womens-gear|kids-gear|home-gear|garden-gear|technology-gear|car-gear|travel-gear|gaming-gear)|^[a-z]+-gear-world'
    foreach ($d in @(Get-ChildItem -LiteralPath $HomeDir -Directory -Force -ErrorAction SilentlyContinue | Sort-Object Name)) {
        if ($d.Name -notmatch $namePattern) { continue }
        if ($d.FullName -eq $WorkDir) { continue }
        if ($SecretDirs -contains $d.Name) { continue }
        $copies += @{ src = $d.FullName; dst = (Join-Path (Join-Path $Target 'files') $d.Name); rel = $d.Name; kind = 'folder'; files = @(); out = @() }
    }
    $downloads = Join-Path $HomeDir 'Downloads'
    if (-not $SkipFeeds) {
        $arch = Join-Path $downloads 'GW_AWIN_BULK_ARCHIVE'
        if (Test-Path -LiteralPath $arch) { $copies += @{ src = $arch; dst = (Join-Path (Join-Path (Join-Path $Target 'files') 'Downloads') 'GW_AWIN_BULK_ARCHIVE'); rel = 'Downloads\GW_AWIN_BULK_ARCHIVE'; kind = 'feeds'; files = @(); out = @() } }
        $loose = @(Get-ChildItem -LiteralPath $downloads -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^\d+-.+\.csv(\.gz)?$' } | ForEach-Object { $_.Name })
        if ($loose.Count -gt 0) { $copies += @{ src = $downloads; dst = (Join-Path (Join-Path $Target 'files') 'Downloads'); rel = 'Downloads'; kind = 'loose feeds'; files = $loose; out = @() } }
    }
    $need = [double]0
    $outAll = New-Object System.Collections.Generic.List[object]
    Start-Phase 'Από αυτόν τον υπολογιστή'
    if ($copies.Count -eq 0) { Say '  Δεν βρέθηκαν φάκελοι του Gear World.' 'Yellow' }
    foreach ($c in $copies) {
        if ($c.files.Count -gt 0) {
            $b = [double]0
            foreach ($n in $c.files) { $it = Get-Item -LiteralPath (Join-Path $c.src $n) -ErrorAction SilentlyContinue; if ($it) { $b += $it.Length } }
            $c['bytes'] = $b
            Say ('  {0,-40} {1,10}  ({2} feeds στα Downloads)' -f 'Downloads\<id>-*.csv.gz', (Format-Size $b), $c.files.Count)
        } else {
            Write-Host ('  ... διαβάζω {0} (μπορεί να πάρει μερικά λεπτά, μην κλείσεις το παράθυρο)' -f $c.rel)
            $s = Get-FolderScan $c.src ($c.kind -ne 'feeds') # the Awin feeds are product data: only their names are checked
            $c['bytes'] = $s.bytes
            $c['out'] = $s.out.ToArray() # index syntax: a dot assignment of an array here fails in PowerShell 5.1
            foreach ($o in $s.out) { $outAll.Add(@{ rel = (Join-Path $c.rel $o.rel); reason = $o.reason }) }
            Say ('  {0,-40} {1,10}  ({2} αρχεία)' -f $c.rel, (Format-Size $s.bytes), $s.files)
        }
        $need += $c.bytes
    }
    Say ('  Σύνολο: {0} (χωρίς node_modules και .wrangler). Μόνο όσα άλλαξαν αντιγράφονται ξανά.' -f (Format-Size $need))
    Say ''
    Say ('== Μένουν ΕΞΩ από τον δίσκο: {0} αρχεία με κλειδιά ή emails πελατών ==' -f $outAll.Count)
    Say '  (μένουν μόνο στον υπολογιστή· τα κλειδιά είναι και στο Cloudflare, οι πελάτες στη D1 και στο MailerLite)'
    if (@(Get-ChildItem -LiteralPath $HomeDir -Directory -Force -ErrorAction SilentlyContinue | Where-Object { $SecretDirs -contains $_.Name }).Count -gt 0) { Say '  φάκελος gear-world-secrets (κρυπτογραφημένα κλειδιά, δουλεύουν μόνο σε αυτόν τον υπολογιστή)' }
    $why = @{ name = 'αρχείο κλειδιών'; key = 'έχει κλειδί/token'; emails = 'έχει emails'; slow = 'δεν ελέγχθηκε εγκαίρως'; unreadable = 'δεν διαβάστηκε (ανοιχτό ή κλειδωμένο)'; archive = 'αρχείο .7z/.rar ή zip μέσα σε zip, δεν διαβάζεται'; big = ('πάνω από {0} MB, δεν ελέγχθηκε' -f $ScanMaxMB) }
    $shown = 0
    foreach ($o in $outAll) {
        if ($shown -ge 60) { Say ('  ... και {0} ακόμα (όλη η λίστα στο αρχείο παρακάτω)' -f ($outAll.Count - $shown)); break }
        Say ('  {0}  ({1})' -f $o.rel, $why[$o.reason]); $shown++
    }
    if ($outAll.Count -gt 0) {
        # The whole list (paths, never contents). It sits in gear-world-reports, which is copied to the drive too: paths only.
        $outList = Join-Path $OutDir ('GW_LEFT_OUT_{0}.txt' -f $stamp)
        try {
            if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
            [System.IO.File]::WriteAllText($outList, ((@($outAll | ForEach-Object { '{0}  ({1})' -f $_.rel, $why[$_.reason] }) -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($true)))
            Say ('  Όλη η λίστα: {0}' -f $outList)
        } catch { Say ('  Η πλήρης λίστα δεν γράφτηκε σε αρχείο: {0}' -f $_.Exception.Message) 'Yellow' }
    }
    # A file that could not be checked now (locked, or the check ran out of time) keeps its old copy on the drive, so the
    # backup is not lost, but only if that old copy itself reads clean: the backup of 3/11 checked nothing, so an old copy
    # with a key or e-mails, or one that cannot be checked either, goes like the others. For a folder that cannot be read
    # now, every old file in it is read the same way (lessons L113).
    $keepOld = @('unreadable', 'slow')
    $flaggedList = New-Object System.Collections.Generic.List[string]
    $keptOld = 0
    foreach ($o in $outAll) {
        if ($keepOld -notcontains $o.reason) { $flaggedList.Add($o.rel); continue }
        $dc = Join-Path (Join-Path $Target 'files') $o.rel
        if (Test-Path -LiteralPath $dc -PathType Container) {
            $dcFull = (Get-Item -LiteralPath $dc -Force).FullName
            $clean = 0
            foreach ($df in @(Get-ChildItem -LiteralPath $dc -Recurse -File -Force -ErrorAction SilentlyContinue)) {
                $dr = ''
                try { $dr = Get-SensitiveReason $df.FullName } catch { $dr = 'unreadable' }
                if ($dr) { $flaggedList.Add((Join-Path $o.rel $df.FullName.Substring($dcFull.Length).TrimStart('\', '/'))) } else { $clean++ }
            }
            if ($clean -gt 0) { $keptOld++ }
        } elseif (Test-Path -LiteralPath $dc -PathType Leaf) {
            $dr = ''
            try { $dr = Get-SensitiveReason $dc } catch { $dr = 'unreadable' }
            if ($dr) { $flaggedList.Add($o.rel) } else { $keptOld++ }
        }
    }
    $flaggedRel = @($flaggedList)
    if ($keptOld -gt 0) { Say ('  {0} από αυτά δεν διαβάστηκαν τώρα (κλειδωμένα ή αργά): το παλιό τους αντίγραφο στον δίσκο ελέγχθηκε, είναι καθαρό και μένει.' -f $keptOld) 'Yellow' }
    $old = Clear-DriveSensitive $false $flaggedRel
    if ($old.found -gt 0) { Say ('  Στον δίσκο υπάρχουν {0} παλιά αντίγραφα τέτοιων αρχείων ή πινάκων πελατών: με -Apply σβήνονται από τον δίσκο.' -f $old.found) 'Yellow' }

    # 5. GitHub (public repos, read-only).
    $branches = @{}
    if (-not $SkipGitHub) {
        Say ''
        Say '== GitHub (μόνο ανάγνωση) =='
        foreach ($r in $Repos) {
            try {
                $list = @(Invoke-RestMethod -UseBasicParsing -TimeoutSec 60 -Uri ('https://api.github.com/repos/{0}/{1}/branches?per_page=100' -f $Owner, $r) -Headers @{ 'User-Agent' = 'gear-world-backup' })
                $branches[$r] = $list
                Say ('  {0}: {1} κλάδοι' -f $r, $list.Count)
            } catch {
                Say ('  {0}: δεν μπόρεσα να διαβάσω τους κλάδους ({1})' -f $r, $_.Exception.Message) 'Yellow'
            }
        }
    }

    # 6. Space: files + about twice the database size as JSON + 1 GB for the GitHub zips.
    $needAll = $need + (2 * $dbBytes) + 1GB
    Say ''
    $fits = $needAll -lt ($free * 0.95)
    if ($fits) { Say ('Χώρος: ΕΝΤΑΞΕΙ (χρειάζονται έως {0}, ελεύθερα {1}).' -f (Format-Size $needAll), (Format-Size $free)) }
    else {
        Say ('ΠΡΟΒΛΗΜΑ: ΔΕΝ χωράει: χρειάζονται έως {0}, ο δίσκος έχει {1} ελεύθερα.' -f (Format-Size $needAll), (Format-Size $free)) 'Red'
        if ($Apply) { Say 'Σταμάτησα πριν γράψω οτιδήποτε.'; Finish 3 }
        $blockers.Add('χώρος')
    }
    if (-not $Apply) {
        Say ''
        Say 'Τι θα γίνει με -Apply (τρέχει μόνο του, χωρίς ερωτήσεις):'
        Say ('  - Αντιγραφή στο {0}: μόνο όσα άλλαξαν. Κλειδιά και emails πελατών μένουν έξω.' -f $Target)
        Say '  - Zip κάθε κλάδου του GitHub που άλλαξε, και αντίγραφο κάθε βάσης D1 (μόνο SELECT, σε σελίδες).'
        Say '  - Ο υπολογιστής μένει ξύπνιος και η οθόνη ανοιχτή μέχρι το τέλος, χωρίς αλλαγή ρυθμίσεων· ένα κλικ στο παράθυρο δεν το σταματά.'
        Say '  - Καμία αλλαγή σε site, βάση, Worker ή GitHub.'
        Say ''
        if ($blockers.Count -gt 0) {
            Say ('ΠΡΟΒΛΗΜΑ: {0}. Με -Apply θα σταματούσε αμέσως, πριν γράψει οτιδήποτε.' -f ($blockers -join ', ')) 'Red'
            Say ('Η φράση έγκρισης: {0}' -f $phrase)
            Finish 7
        }
        Say 'ΕΝΤΑΞΕΙ: όλα έτοιμα για το backup. Δεν γράφτηκε τίποτα στον δίσκο.' 'Green'
        Say ('Η φράση έγκρισης: {0}' -f $phrase)
        Finish 0
    }

    # ---------------- from here on: -Apply with the right phrase, all checks passed ----------------
    if ($TestInterrupt) { Write-Interrupted; exit 15 }
    $problems = 0
    if (-not (Test-Path -LiteralPath $Target)) { New-Item -ItemType Directory -Path $Target -Force | Out-Null }

    # 7. Old copies of keys and customer data off the drive.
    Start-Phase 'Καθάρισμα παλιών αντιγράφων με κλειδιά ή πελάτες'
    $cl = Clear-DriveSensitive $true $flaggedRel
    Say ('  Σβήστηκαν {0} από {1}.' -f $cl.removed, $cl.found)
    if ($cl.removed -lt $cl.found) { $problems++ }

    # 8. Copy (robocopy: only new or changed files). Key files and the files the scan found are left out.
    Start-Phase 'Αντιγραφή αρχείων'
    foreach ($c in $copies) {
        try {
            if (-not (Test-Path -LiteralPath $c.dst)) { New-Item -ItemType Directory -Path $c.dst -Force | Out-Null }
            $a = @($c.src, $c.dst)
            $outDirs = @($c.out | Where-Object { $_.dir } | ForEach-Object { $_.path })
            $outFiles = @($c.out | Where-Object { -not $_.dir } | ForEach-Object { $_.path })
            if ($c.files.Count -gt 0) { $a += $c.files } else { $a += @('/E', '/XD') + $SkipDirs + $outDirs }
            # Full paths keep the exclusion exact. If the command line would be too long (32K), the file names only: a file
            # of the same name elsewhere in this folder then stays out too, which is safe, and the report says so (L113).
            $xf = @($SecretNames) + $outFiles
            $len = (($a + $xf) | ForEach-Object { ([string]$_).Length + 3 } | Measure-Object -Sum).Sum
            if ($len -gt 28000) {
                $xf = @($SecretNames) + @($outFiles | ForEach-Object { [System.IO.Path]::GetFileName($_) } | Sort-Object -Unique)
                $len = (($a + $xf) | ForEach-Object { ([string]$_).Length + 3 } | Measure-Object -Sum).Sum
                Say ('  {0}: {1} αρχεία έξω, άρα μένουν έξω και όσα έχουν το ίδιο όνομα σε αυτόν τον φάκελο' -f $c.rel, $outFiles.Count) 'Yellow'
            }
            if ($len -gt 30000) { throw ('πάρα πολλά αρχεία μένουν έξω ({0}): ο φάκελος δεν αντιγράφηκε' -f $outFiles.Count) }
            $a += @('/XF') + $xf
            $a += @('/R:1', '/W:1', '/XJ', '/NP', '/NFL', '/NDL', '/NJH', '/NJS')
            Write-Host ('  ... αντιγράφω {0} ({1}), από {2}' -f $c.rel, (Format-Size $c.bytes), (Get-Date -Format 'HH:mm'))
            $t0c = Get-Date
            & robocopy @a | Out-Null
            $rc = $LASTEXITCODE
            $mins = [int][Math]::Round(((Get-Date) - $t0c).TotalMinutes)
            if ($rc -ge 8) { $problems++; Say ('  ΠΡΟΒΛΗΜΑ στο {0} (robocopy {1})' -f $c.src, $rc) 'Red' }
            else { Say ('  OK  {0}  ({1} λεπτά)' -f $c.dst, $mins) }
        } catch { $problems++; Say ('  ΠΡΟΒΛΗΜΑ στο {0}: {1}' -f $c.src, $_.Exception.Message) 'Red' }
        # Safety net, always: what the scan found must not be on the drive, even if robocopy took it. Not for what could not
        # be checked now: its old copy stays (see above).
        foreach ($o in $c.out) {
            if (($keepOld -contains $o.reason) -and ($flaggedRel -notcontains (Join-Path $c.rel $o.rel))) { continue }
            try {
                $p = Join-Path $c.dst $o.rel
                if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force }
            } catch { $problems++; Say ('  ΠΡΟΒΛΗΜΑ: δεν σβήστηκε από τον δίσκο: {0}' -f $o.rel) 'Red' }
        }
    }

    # 9. Databases: schema + tables.txt + rows as JSON pages (SELECT only). A database is written to _new_<name> first and
    # replaces the old copy only when every table worked; otherwise the old copy stays and the new one is <name>.incomplete.
    if ($dbs.Count -gt 0) {
        Start-Phase 'Βάσεις D1'
        $d1Root = Join-Path $Target 'd1'
        try { if (-not (Test-Path -LiteralPath $d1Root)) { New-Item -ItemType Directory -Path $d1Root -Force | Out-Null } } catch { $problems++; Say ('  ΠΡΟΒΛΗΜΑ: {0}' -f $_.Exception.Message) 'Red' }
        foreach ($left in @(Get-ChildItem -LiteralPath $d1Root -Directory -Filter '_new_*' -ErrorAction SilentlyContinue)) { try { Remove-Item -LiteralPath $left.FullName -Recurse -Force } catch { } }
        $di = 0
        foreach ($db in $dbs) {
            $di++
            Write-Host ('  ... βάση {0} ({1} από {2}), από {3}' -f $db, $di, @($dbs).Count, (Get-Date -Format 'HH:mm'))
            $final = Join-Path $d1Root $db
            $tmp = Join-Path $d1Root ('_new_' + $db)
            $dbProblems = 0
            $rowsTotal = 0; $tables = 0; $countOnly = 0
            try {
                New-Item -ItemType Directory -Path $tmp -Force | Out-Null
                $objs = Select-Rows $db 'SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type DESC, name'
                if ($null -eq $objs) { throw 'δεν διάβασα το σχήμα της βάσης' }
                $schema = New-Object System.Text.StringBuilder
                $virtual = @()
                foreach ($o in $objs) {
                    [void]$schema.AppendLine(([string]$o.sql).Trim() + ';')
                    if ([string]$o.sql -match '^\s*CREATE\s+VIRTUAL\s+TABLE') { $virtual += [string]$o.name }
                }
                [System.IO.File]::WriteAllText((Join-Path $tmp 'schema.sql'), $schema.ToString(), (New-Object System.Text.UTF8Encoding($false)))
                $manifest = New-Object System.Collections.Generic.List[string]
                $manifest.Add('table  rows  pages  how')
                foreach ($o in $objs) {
                    if ([string]$o.type -ne 'table') { continue }
                    $t = [string]$o.name
                    if ($t -notmatch '^[A-Za-z_][A-Za-z0-9_]*$' -or $t -like 'sqlite_*' -or $t -like '_cf_*') { continue }
                    if ($virtual -contains $t) { continue }
                    $shadow = $false
                    foreach ($v in $virtual) { if ($t.StartsWith($v + '_')) { $shadow = $true } }
                    if ($shadow) { continue } # the search index is rebuilt from the table itself
                    $res = $null
                    try { $res = Backup-Table $db $t ([string]$o.sql) $tmp } catch { $res = @{ ok = $false; mode = $_.Exception.Message; rows = -1; pages = 0 } }
                    $manifest.Add(('{0}  {1}  {2}  {3}' -f $t, $res.rows, $res.pages, $res.mode))
                    if (-not $res.ok) { $dbProblems++; Say ('  ΠΡΟΒΛΗΜΑ: {0}.{1} ({2})' -f $db, $t, $res.mode) 'Red'; continue }
                    if ($res.pages -eq 0 -and $res.mode -like 'μόνο πλήθος*') { $countOnly++ }
                    $rowsTotal += $res.rows; $tables++
                }
                [System.IO.File]::WriteAllText((Join-Path $tmp 'tables.txt'), (($manifest -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
            } catch {
                $dbProblems++; Say ('  ΠΡΟΒΛΗΜΑ: {0}: {1}' -f $db, $_.Exception.Message) 'Red'
            }
            try {
                if ($dbProblems -eq 0) {
                    if (Test-Path -LiteralPath $final) { Remove-Item -LiteralPath $final -Recurse -Force }
                    [System.IO.Directory]::Move($tmp, $final)
                    Say ('  OK  {0}: {1} πίνακες, {2} γραμμές ({3} πίνακες μόνο με πλήθος)' -f $db, $tables, $rowsTotal, $countOnly)
                } else {
                    $inc = $final + '.incomplete'
                    if (Test-Path -LiteralPath $inc) { Remove-Item -LiteralPath $inc -Recurse -Force }
                    if (Test-Path -LiteralPath $tmp) { [System.IO.Directory]::Move($tmp, $inc) }
                    Say ('  {0}: {1} πρόβλημα(τα). Το προηγούμενο αντίγραφο της βάσης μένει, το νέο είναι στο {2}.incomplete' -f $db, $dbProblems, $db) 'Yellow'
                }
            } catch { $dbProblems++; Say ('  ΠΡΟΒΛΗΜΑ: {0}: {1}' -f $db, $_.Exception.Message) 'Red' }
            $problems += $dbProblems
        }
    }

    # 10. GitHub zips (a branch whose commit did not change is not downloaded again). Last: the code is on GitHub anyway,
    # so if the night runs out, the files and the databases are already on the drive (lessons L117).
    if (-not $SkipGitHub) {
        Start-Phase 'GitHub'
        foreach ($r in $branches.Keys) {
            try {
                $dir = Join-Path (Join-Path $Target 'github') $r
                if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
                $known = @{}
                $mf = Join-Path $dir 'branches.txt'
                if (Test-Path -LiteralPath $mf) {
                    foreach ($line in [System.IO.File]::ReadAllLines($mf)) { $p = $line -split '\s+'; if ($p.Count -ge 2) { $known[$p[0]] = $p[1] } }
                }
                $manifest = New-Object System.Collections.Generic.List[string]
                $same = 0
                $bi = 0
                foreach ($b in $branches[$r]) {
                    $bi++
                    Beat ('{0}: κλάδος {1} από {2}' -f $r, $bi, @($branches[$r]).Count)
                    $name = [string]$b.name
                    $sha = [string]$b.commit.sha
                    $file = Join-Path $dir (($name -replace '[^A-Za-z0-9._-]', '_') + '.zip')
                    if ($known[$name] -eq $sha -and (Test-Path -LiteralPath $file) -and (Get-Item -LiteralPath $file).Length -gt 0) { $manifest.Add(('{0}  {1}' -f $name, $sha)); $same++; continue }
                    try {
                        Invoke-WebRequest -UseBasicParsing -TimeoutSec 600 -OutFile $file -Uri ('https://codeload.github.com/{0}/{1}/zip/refs/heads/{2}' -f $Owner, $r, $name)
                        $manifest.Add(('{0}  {1}' -f $name, $sha))
                    } catch {
                        $problems++; Say ('  ΠΡΟΒΛΗΜΑ: {0} {1}' -f $r, $name) 'Red'
                    }
                }
                [System.IO.File]::WriteAllText($mf, (($manifest -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
                Say ('  OK  {0}: {1} κλάδοι ({2} ίδιοι με πριν)' -f $r, $manifest.Count, $same)
            } catch { $problems++; Say ('  ΠΡΟΒΛΗΜΑ στο GitHub {0}: {1}' -f $r, $_.Exception.Message) 'Red' }
        }
    }

    # 11. How to restore.
    $readme = @(
        'GEAR WORLD - ΑΝΤΙΓΡΑΦΟ ΑΣΦΑΛΕΙΑΣ / BACKUP',
        ('Τελευταία ενημέρωση / last run: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')),
        '',
        'ΤΙ ΕΧΕΙ ΜΕΣΑ',
        '  files\    οι φάκελοι του Gear World από τον φάκελο χρήστη (C:\Users\<όνομα>\) και τα feeds του Awin (Downloads)',
        '  github\   zip κάθε κλάδου του κώδικα (gear-world-code) και των εικόνων (gearworld-media), branches.txt = commit',
        '  d1\       κάθε βάση των sites: schema.sql (πίνακες), tables.txt (γραμμές κάθε πίνακα) και <πίνακας>-0001.json ...',
        '',
        'ΤΙ ΔΕΝ ΕΧΕΙ (ο δίσκος δεν είναι κρυπτογραφημένος)',
        '  - Κλειδιά και κωδικούς: .dev.vars, .env, αρχεία κλειδιών, τον φάκελο gear-world-secrets, και κάθε αρχείο με κλειδί μέσα.',
        '  - Emails πελατών: οι γραμμές των hub_subscribers, newsletter, customers, reward_* και κάθε πίνακα με email ή IP.',
        '    Για αυτούς το tables.txt γράφει μόνο πόσες γραμμές είχαν.',
        '',
        'ΠΩΣ ΞΑΝΑΣΤΗΝΟΝΤΑΙ ΚΛΕΙΔΙΑ ΚΑΙ ΠΕΛΑΤΕΣ',
        '  - Τα κλειδιά (Awin, MailerLite, Turnstile κ.ά.) είναι secrets των Workers στο Cloudflare: τα sites τα έχουν ήδη',
        '    και δεν χάνονται με τον υπολογιστή. Όταν χρειαστεί νέο: φτιάχνεται στον πάροχο και περνά με εντολή του Claude',
        '    μέσα στο PowerShell (wrangler secret put), ποτέ σε chat. Το κλειδί feeds του Awin το ζητά ξανά το εργαλείο',
        '    awin-feed-download την πρώτη φορά σε νέο υπολογιστή.',
        '  - Οι πελάτες ζουν στις βάσεις D1 του Cloudflare και στο MailerLite. Για χαλασμένη βάση: Cloudflare D1 Time Travel',
        '    (επαναφορά έως 30 ημέρες πίσω), με φράση έγκρισης.',
        '',
        'ΑΝ ΧΑΛΑΣΕΙ Ο ΥΠΟΛΟΓΙΣΤΗΣ',
        '  1. Σε νέο υπολογιστή: εγκατάστησε Node.js (LTS) από https://nodejs.org',
        '  2. Αντέγραψε τα περιεχόμενα του files\ στον φάκελο χρήστη (C:\Users\<όνομα>\), και το files\Downloads\ στα Downloads.',
        '  3. Στο PowerShell: npx wrangler login (σύνδεση στο Cloudflare ξανά, ο κωδικός δεν αντιγράφεται).',
        '  4. Ο κώδικας είναι και στο GitHub (evangelos-gif/gear-world-code). Τα zip εδώ είναι για την περίπτωση που λείπει.',
        '  5. Οι βάσεις: τα sites ζουν στο Cloudflare και δεν χάνονται με τον υπολογιστή. Το d1\ είναι για την περίπτωση',
        '     που χαλάσει μια βάση: πες στο Claude «επαναφορά βάσης από το backup» και δείξε του αυτόν τον φάκελο.',
        '',
        'Φύλαξε τον δίσκο στο σπίτι: έχει τον κώδικα και τις ρυθμίσεις των sites.'
    ) -join "`r`n"
    try {
        [System.IO.File]::WriteAllText((Join-Path $Target 'README-RESTORE.txt'), $readme + "`r`n", (New-Object System.Text.UTF8Encoding($true)))
    } catch { $problems++; Say ('  ΠΡΟΒΛΗΜΑ: README-RESTORE.txt: {0}' -f $_.Exception.Message) 'Red' }
    $logDir = Join-Path $Target 'logs'
    try { if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null } } catch { }

    Say ''
    if ($problems -gt 0) {
        Say ('ΤΕΛΟΣ ΜΕ {0} ΠΡΟΒΛΗΜΑΤΑ: τα υπόλοιπα αντιγράφηκαν. Στείλε την αναφορά στο Claude.' -f $problems) 'Yellow'
        try { [System.IO.File]::WriteAllText((Join-Path $logDir ('GW_BACKUP_{0}.txt' -f $stamp)), ($L -join "`r`n"), (New-Object System.Text.UTF8Encoding($true))) } catch { }
        Finish 12
    }
    Say ('ΕΤΟΙΜΟ: όλο το Gear World είναι στο {0}. Οδηγίες επαναφοράς: {1}' -f $Target, (Join-Path $Target 'README-RESTORE.txt')) 'Green'
    try { [System.IO.File]::WriteAllText((Join-Path $logDir ('GW_BACKUP_{0}.txt' -f $stamp)), ($L -join "`r`n"), (New-Object System.Text.UTF8Encoding($true))) } catch { }
    Finish 0
} catch {
    # An unexpected error: the same as the trap (Ctrl+C and exit never come here).
    Say ('ΠΡΟΒΛΗΜΑ: η εντολή σταμάτησε απρόσμενα: {0}' -f $_.Exception.Message) 'Red'
    Finish 13
} finally {
    # Only Ctrl+C gets here without a Finish: the report is still written, with how far it got.
    if (-not $script:Finishing) { Write-Interrupted }
}
