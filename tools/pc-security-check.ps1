<#
.SYNOPSIS
  Gear World - security check of this Windows PC. READ-ONLY: it changes nothing.

.DESCRIPTION
  There is no apply mode. Every check only reads: cmdlets that read (Get-...), the registry, file NAMES.
  It never starts a scan, never searches online for updates (only the local update history is read), and never changes
  a setting, a service, an account or the registry. Files that look like secrets are listed by path, relative to the
  user folder (~\...), and NOTHING of their content is ever shown, copied or written: the tool reads at most their
  first 4 KB in memory, only to tell an encrypted file (DPAPI) from plain text, and then forgets it. Files that live
  only in the cloud (OneDrive) are not opened at all, so that nothing is downloaded.

  Checks:
    1. Microsoft Defender: service, antivirus, real-time protection, tamper protection, age of the virus definitions
       (ΠΡΟΣΟΧΗ above 2 days, ΠΡΟΒΛΗΜΑ above 7), last quick and full scan, cloud protection and sample submission,
       PUA blocking, controlled folder access (information only), threats of the last 30 days (name and date only),
       other antivirus products that Windows knows (SecurityCenter2).
    2. Firewall: the Domain, Private and Public profiles.
    3. Windows Update: last installed update (Get-HotFix and the local Windows Update history, with a time limit),
       restart pending (registry keys), Windows version and build.
    4. Accounts: UAC, whether this user is an administrator, the built-in Administrator and Guest accounts.
    5. SmartScreen, and Windows Hello / PIN (the PIN cannot be read reliably: only the link).
    6. Disk encryption of the system drive (BitLocker / Device Encryption).
    7. Remote access: Remote Desktop (and NLA), SMBv1.
    8. Gear World: files named .dev.vars, .env, *.env or with token / secret / password in the name, up to 3 levels
       under the user folder (node_modules and .git skipped), paths only, each one classified from its first 4 KB:
       encrypted for this user (DPAPI), plain text that looks like a key, a report without a key, empty, other text,
       not text, or unreadable; whether a wrangler login file exists.
    9. Backups: OneDrive (running, Desktop and Documents in OneDrive), File History, the gw-backup copy on an
       attached drive (<drive>:\GearWorldBackup\README-RESTORE.txt, the drive letters checked are listed), last System
       Restore point.
  An antivirus that is off but still registered next to an active one (not Windows Defender) gets an information line
  with the link to uninstall it (ms-settings:appsfeatures).

  A check that needs administrator rights, or a cmdlet these Windows do not have, says «χρειάζεται διαχειριστή» or
  «δεν διαβάζεται» and the tool goes on. Every status is written in words too (the owner cannot tell red from green,
  lessons L35): 🟢 ΕΝΤΑΞΕΙ, 🟡 ΠΡΟΣΟΧΗ, 🔴 ΠΡΟΒΛΗΜΑ, ⚪ ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ, ℹ️ ΠΛΗΡΟΦΟΡΙΑ.
  The report never holds the full user or computer name (first letter and ***), serial numbers, product keys, MAC
  addresses, e-mail addresses or secrets.

  -HomeDir               the user folder for the secret-file search and the wrangler login (default: this user)
  -OutDir                where the report goes (default: <home>\gear-world-reports)
  -UpdateTimeoutSeconds  time limit for reading the local Windows Update history (default 30; 0 = do not read it)
  -NoClipboard           do not copy the report to the clipboard (tests)
  -TestAntivirus         tests only: the antivirus list instead of SecurityCenter2, as "Name=on;Name=off"

  Report: <home>\gear-world-reports\PC_SECURITY_<yyyyMMdd-HHmmss>.txt (UTF-8, also copied to the clipboard)
  Exit code: always 0 (another code only if the script itself breaks).
#>
param(
    [string]$HomeDir = '',
    [string]$OutDir = '',
    [int]$UpdateTimeoutSeconds = 30,
    [switch]$NoClipboard,
    [string]$TestAntivirus = ''
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$customHome = [bool]$HomeDir
if (-not $HomeDir) { $HomeDir = $HOME }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$now = Get-Date
$inv = [System.Globalization.CultureInfo]::InvariantCulture
# Colours without red and green (lessons L35), and always the words next to the mark.
$Colors = @{ ok = 'Cyan'; warn = 'Yellow'; bad = 'Magenta'; na = 'Gray'; info = 'White' }
$Labels = @{ ok = '🟢 ΕΝΤΑΞΕΙ'; warn = '🟡 ΠΡΟΣΟΧΗ'; bad = '🔴 ΠΡΟΒΛΗΜΑ'; na = '⚪ ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ'; info = 'ℹ️ ΠΛΗΡΟΦΟΡΙΑ' }

# ---------------- report helpers ----------------
$Out = New-Object System.Collections.ArrayList
function Say([string]$text, [string]$color = '') { [void]$Out.Add(@{ t = $text; c = $color }) }

$Results = New-Object System.Collections.ArrayList
$Sections = New-Object System.Collections.ArrayList
$script:Section = ''
function Section([string]$name) {
    $script:Section = $name
    [void]$Sections.Add($name)
    Write-Host ('Ελέγχω: {0}...' -f $name) -ForegroundColor Gray
}
# One result: status (ok, warn, bad, info), what was found, one line on what it means and what to do, the setting to
# open, how urgent it is (smaller = first in the top 3), extra lines.
function Mark([string]$Status, [string]$What, [string]$Advice, [string]$Link = '', [int]$Weight = 50, [string[]]$Details = @()) {
    [void]$Results.Add([pscustomobject]@{ Section = $script:Section; Status = $Status; Why = ''; What = $What; Advice = $Advice; Link = $Link; Weight = $Weight; Details = @($Details); Order = $Results.Count })
}
# A check that could not be read: admin = needs administrator rights, missing = these Windows do not have it.
function MarkNA([string]$What, [string]$Why, [string]$Link = '', [string]$Advice = '') {
    $label = 'δεν διαβάζεται'
    if ($Why -eq 'admin') { $label = 'χρειάζεται διαχειριστή' }
    elseif ($Why -eq 'missing') { $label = 'δεν διαβάζεται: δεν υπάρχει σε αυτά τα Windows' }
    elseif ($Why -eq 'cloud') { $label = 'δεν διαβάζεται: είναι μόνο στο cloud (OneDrive) και δεν το κατέβασα' }
    if (-not $Advice) {
        if ($Why -eq 'admin') { $Advice = 'Τα Windows το δείχνουν μόνο σε PowerShell ως διαχειριστής. Δεν είναι πρόβλημα του υπολογιστή.' }
        elseif ($Why -eq 'missing') { $Advice = 'Αυτά τα Windows δεν έχουν αυτόν τον έλεγχο. Δεν είναι πρόβλημα.' }
        elseif ($Link) { $Advice = 'Τα Windows δεν το έδωσαν σε αυτό το εργαλείο. Δες το μόνος σου στη ρύθμιση.' }
        else { $Advice = 'Τα Windows δεν το έδωσαν σε αυτό το εργαλείο. Αν σε ανησυχεί, στείλε την αναφορά στο Claude.' }
    }
    [void]$Results.Add([pscustomobject]@{ Section = $script:Section; Status = 'na'; Why = $Why; What = ('{0}: «{1}»' -f $What, $label); Advice = $Advice; Link = $Link; Weight = 99; Details = @(); Order = $Results.Count })
}
# Why a read failed: 'admin' for access denied, otherwise 'unread'.
function Get-Reason($err) {
    $msg = ''
    $hr = 0
    try { $msg = [string]$err.Exception.Message } catch { }
    try { $hr = [int]$err.Exception.HResult } catch { }
    if ($hr -eq -2147024891 -or $msg -match '(?i)denied|elevat|administrator|privilege|0x80070005') { return 'admin' }
    return 'unread'
}
function Get-DaysText([double]$days) {
    $n = [int][Math]::Floor($days)
    if ($n -le 0) { return 'λιγότερο από 1 μέρα' }
    if ($n -eq 1) { return '1 μέρα' }
    return ('{0} μέρες' -f $n)
}
function Get-RegValue([string]$Path, [string]$Name) {
    try {
        if (-not (Test-Path -LiteralPath $Path)) { return $null }
        $item = Get-ItemProperty -LiteralPath $Path -Name $Name
        return $item.$Name
    } catch { return $null }
}
function Test-InFolder([string]$Path, [string[]]$Roots) {
    foreach ($r in $Roots) {
        if ($Path.Equals($r, [System.StringComparison]::OrdinalIgnoreCase) -or $Path.StartsWith($r + '\', [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
    return $false
}

# Names that never go into the report in full: user, computer, domain, the name of the user folder.
$PrivateNames = New-Object System.Collections.ArrayList
$profileLeaf = ''
if ($env:USERPROFILE) { $profileLeaf = Split-Path -Leaf $env:USERPROFILE }
foreach ($n in @($env:USERNAME, $env:COMPUTERNAME, $env:USERDOMAIN, $profileLeaf)) {
    $v = ([string]$n).Trim()
    if ($v.Length -ge 2 -and -not ($PrivateNames -contains $v)) { [void]$PrivateNames.Add($v) }
}
$SortedNames = @($PrivateNames | Sort-Object { $_.Length } -Descending)
function Hide-Name([string]$s) {
    $v = ([string]$s).Trim()
    if (-not $v) { return '?***' }
    return ($v.Substring(0, 1) + '***')
}
# The last guard before the report is written: names, IDs, MAC addresses, product keys, e-mail addresses.
function Hide-Private([string]$Text) {
    $t = $Text
    foreach ($n in $SortedNames) {
        $pattern = '(?i)(?<![\p{L}\p{N}_])' + [regex]::Escape($n) + '(?![\p{L}\p{N}_])'
        $t = [regex]::Replace($t, $pattern, (Hide-Name $n).Replace('$', '$$'))
    }
    $t = [regex]::Replace($t, '\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '(masked-id)')
    $t = [regex]::Replace($t, '\b[0-9a-fA-F]{32}\b', '(masked-id)')
    $t = [regex]::Replace($t, '\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b', '(masked-mac)')
    $t = [regex]::Replace($t, '\b[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}\b', '(masked-key)')
    $t = [regex]::Replace($t, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '(masked-email)')
    return $t
}

# The local Windows Update history (installed updates), read in a separate runspace with a time limit.
# Only QueryHistory: no online search, no download, no install.
function Get-UpdateHistory([int]$Seconds) {
    if ($Seconds -le 0) { return @{ state = 'skipped'; items = @() } }
    try {
        $ps = [PowerShell]::Create()
        [void]$ps.AddScript({
            $ErrorActionPreference = 'Stop'
            $session = New-Object -ComObject 'Microsoft.Update.Session'
            $searcher = $session.CreateUpdateSearcher()
            $total = [int]$searcher.GetTotalHistoryCount()
            if ($total -gt 300) { $total = 300 }
            if ($total -gt 0) {
                foreach ($h in $searcher.QueryHistory(0, $total)) {
                    [pscustomobject]@{ Date = $h.Date; Title = [string]$h.Title; Operation = [int]$h.Operation; Result = [int]$h.ResultCode }
                }
            }
        })
        $handle = $ps.BeginInvoke()
        if (-not $handle.AsyncWaitHandle.WaitOne($Seconds * 1000)) {
            try { [void]$ps.BeginStop($null, $null) } catch { }
            return @{ state = 'timeout'; items = @() }
        }
        $items = @($ps.EndInvoke($handle))
        return @{ state = 'ok'; items = $items }
    } catch {
        return @{ state = 'error'; items = @() }
    }
}

# Whether this user is in the Administrators group (SID S-1-5-32-544), also when PowerShell is not elevated.
function Get-AdminGroupMember {
    $ErrorActionPreference = 'Continue'
    try {
        $lines = @(& whoami.exe /groups /fo csv 2>$null)
        if ($lines.Count -eq 0) { return $null }
        return [bool](($lines -join "`n") -match 'S-1-5-32-544')
    } catch { return $null }
}

# manage-bde, status only (needs administrator rights). English output only; another language gives ''.
function Get-ManageBdeState([string]$Drive) {
    $ErrorActionPreference = 'Continue'
    try {
        $text = (@(& manage-bde.exe -status $Drive 2>$null) | ForEach-Object { [string]$_ }) -join "`n"
        if ($text -match 'Protection Status:\s*Protection On') { return 'on' }
        if ($text -match 'Protection Status:\s*Protection Off') {
            if ($text -match 'Fully Encrypted') { return 'suspended' }
            return 'off'
        }
    } catch { }
    return ''
}

# Files whose NAME looks like a secret, up to $MaxDepth levels under $Root. Only names: no file is opened.
$SkipDirNames = @('node_modules', '.git')
function Test-SecretName([string]$Name) {
    $n = $Name.ToLowerInvariant()
    if ($n.StartsWith('.dev.vars')) { return $true }
    if ($n -eq '.env' -or $n.EndsWith('.env')) { return $true }
    if ($n.StartsWith('.env.') -and -not ($n -match '\.(example|sample|template|dist)$')) { return $true }
    if ($n -match 'token|secret|password|passwd') { return $true }
    return $false
}
function Find-SecretFiles([string]$Root, [int]$MaxDepth) {
    $queue = New-Object System.Collections.Queue
    $queue.Enqueue([pscustomobject]@{ Dir = $Root; Depth = 1 })
    while ($queue.Count -gt 0) {
        $cur = $queue.Dequeue()
        foreach ($e in @(Get-ChildItem -LiteralPath $cur.Dir -Force -ErrorAction SilentlyContinue)) {
            if ($e.PSIsContainer) {
                if ($cur.Depth -ge $MaxDepth) { continue }
                if ($SkipDirNames -contains $e.Name) { continue }
                # Junctions and links (e.g. the old "Application Data") are skipped: they point elsewhere.
                $isLink = $false
                try { if ($e.LinkType) { $isLink = $true } } catch { }
                if (-not $isLink -and (($e.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) -and (($e.Attributes -band [System.IO.FileAttributes]::System) -ne 0)) { $isLink = $true }
                if ($isLink) { continue }
                $queue.Enqueue([pscustomobject]@{ Dir = $e.FullName; Depth = ($cur.Depth + 1) })
            } elseif (Test-SecretName $e.Name) {
                $e.FullName
            }
        }
    }
}
function Test-InGit([string]$File, [string]$Root) {
    $d = Split-Path -Parent $File
    while ($d -and $d.Length -ge $Root.Length) {
        if (Test-Path -LiteralPath (Join-Path $d '.git')) { return $true }
        if ($d.Length -eq $Root.Length) { break }
        $d = Split-Path -Parent $d
    }
    return $false
}

# What kind of secret file is it? Only its first 4 KB are read, in memory, and nothing of them leaves Get-SecretKind:
# it returns one word (dpapi, token, report, empty, text, binary, cloud, unread). The bytes are wiped before it returns.
$PeekBytes = 4096
# Windows DPAPI: ConvertFrom-SecureString writes this hex first, ProtectedData writes these bytes first (version 1 and
# the DPAPI provider), and the base64 of those bytes starts with the third text.
$DpapiHex = '01000000d08c9ddf0115d1118c7a00c04fc297eb'
$DpapiHead = [byte[]](0x01, 0x00, 0x00, 0x00, 0xD0, 0x8C, 0x9D, 0xDF, 0x01, 0x15, 0xD1, 0x11, 0x8C, 0x7A, 0x00, 0xC0, 0x4F, 0xC2, 0x97, 0xEB)
$DpapiB64 = 'AQAAANCMnd8BFdERjHoAwE/Cl+'
# Looks like a key: a UUID (the Awin API key has this shape), or a run of 24+ characters from [A-Za-z0-9_-.] whose parts
# that mix letters and digits add up to 20+ characters (a git commit or a sha256, 40 or 64 hex, does not count), or a
# base64 run of 40+ with + or = padding. Names such as AWIN_SETUP_TOKEN_20261103_184934 or raw.githubusercontent.com
# are not keys.
function Test-TokenLike([string]$Text) {
    if ($Text -match '(?<![0-9A-Za-z])[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?![0-9A-Za-z])') { return $true }
    foreach ($m in [regex]::Matches($Text, '[A-Za-z0-9_\-\.]{24,}')) {
        $mixed = 0
        foreach ($piece in ($m.Value -split '[_\-\.]')) {
            if ($piece.Length -lt 2) { continue }
            if (($piece.Length -eq 40 -or $piece.Length -eq 64) -and $piece -match '^[0-9a-fA-F]+$') { continue }
            if ($piece -match '[A-Za-z]' -and $piece -match '[0-9]') { $mixed += $piece.Length }
        }
        if ($mixed -ge 20) { return $true }
    }
    foreach ($m in [regex]::Matches($Text, '[A-Za-z0-9+/]{40,}={0,2}')) {
        $v = $m.Value
        if (($v.Contains('+') -or $v.EndsWith('=')) -and $v -match '[A-Za-z]' -and $v -match '[0-9]') { return $true }
    }
    return $false
}
# The first bytes as text: UTF-16 (with or without BOM, as Out-File writes it), UTF-8 (with or without BOM).
function Get-PeekText([byte[]]$b, [int]$n) {
    if ($n -ge 2 -and $b[0] -eq 0xFF -and $b[1] -eq 0xFE) { return [System.Text.Encoding]::Unicode.GetString($b, 2, $n - 2) }
    if ($n -ge 2 -and $b[0] -eq 0xFE -and $b[1] -eq 0xFF) { return [System.Text.Encoding]::BigEndianUnicode.GetString($b, 2, $n - 2) }
    if ($n -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) { return [System.Text.Encoding]::UTF8.GetString($b, 3, $n - 3) }
    $zeros = 0
    for ($i = 1; $i -lt $n; $i += 2) { if ($b[$i] -eq 0) { $zeros++ } }
    if ($n -ge 8 -and ($zeros * 4) -ge $n) { return [System.Text.Encoding]::Unicode.GetString($b, 0, $n - ($n % 2)) }
    return [System.Text.Encoding]::UTF8.GetString($b, 0, $n)
}
function Get-SecretKind([string]$Path, [bool]$IsReport) {
    $buf = $null
    try {
        $item = Get-Item -LiteralPath $Path -Force
        $attr = [int64]$item.Attributes
        # Offline (0x1000), recall on open (0x40000), recall on data access (0x400000): only in the cloud. Not opened,
        # because reading it would download it.
        if (($attr -band 0x1000) -ne 0 -or ($attr -band 0x40000) -ne 0 -or ($attr -band 0x400000) -ne 0) { return 'cloud' }
        if ($item.Length -eq 0) { return 'empty' }
        $buf = New-Object byte[] $PeekBytes
        $n = 0
        $fs = [System.IO.File]::OpenRead($Path)
        try {
            while ($n -lt $PeekBytes) {
                $got = $fs.Read($buf, $n, $PeekBytes - $n)
                if ($got -le 0) { break }
                $n += $got
            }
        } finally { $fs.Dispose() }
        if ($n -ge $DpapiHead.Length) {
            $same = $true
            for ($i = 0; $i -lt $DpapiHead.Length; $i++) { if ($buf[$i] -ne $DpapiHead[$i]) { $same = $false; break } }
            if ($same) { return 'dpapi' }
        }
        $text = Get-PeekText $buf $n
        if ($text.Trim().Length -eq 0) { return 'empty' }
        $isDpapi = ($text.IndexOf($DpapiHex, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) -or $text.Contains($DpapiB64)
        # The encrypted parts are taken out first: a plain key next to an encrypted one still counts as a plain key.
        $rest = [regex]::Replace($text, '(?i)' + $DpapiHex + '[0-9a-f]*', ' ')
        $rest = [regex]::Replace($rest, [regex]::Escape($DpapiB64) + '[A-Za-z0-9+/]*={0,2}', ' ')
        $text = $null
        if (Test-TokenLike $rest) { return 'token' }
        if ($isDpapi) { return 'dpapi' }
        $odd = [regex]::Matches($rest, '[\x00-\x08\x0B\x0C\x0E-\x1F�]').Count
        if (($odd * 10) -gt $rest.Length) { return 'binary' }
        if ($IsReport) { return 'report' }
        return 'text'
    } catch {
        return 'unread'
    } finally {
        if ($null -ne $buf) { [Array]::Clear($buf, 0, $buf.Length) }
    }
}
# status, words, what it means and what to do
$SecretKinds = @{
    dpapi = @('ok', 'κρυπτογραφημένο για τον χρήστη σου (DPAPI)', 'Μόνο ο δικός σου λογαριασμός σε αυτόν τον υπολογιστή μπορεί να το ανοίξει. Δεν χρειάζεται τίποτα.')
    token = @('warn', 'απλό κείμενο που μοιάζει με κλειδί', 'Αν το κλειδί χρησιμοποιείται ακόμα, βάλε το στα Cloudflare secrets ή στην κρυπτογραφημένη αποθήκη (DPAPI, όπως ο φάκελος gear-world-secrets). Αν δεν χρησιμοποιείται, μπορεί να σβηστεί, αλλά ρώτα πρώτα το Claude.')
    report = @('ok', 'αναφορά χωρίς κλειδί', 'Αναφορά εργαλείου Gear World χωρίς τίποτα που να μοιάζει με κλειδί. Δεν χρειάζεται τίποτα.')
    empty = @('ok', 'άδειο αρχείο', 'Δεν έχει τίποτα μέσα. Δεν χρειάζεται τίποτα.')
    text = @('warn', 'απλό κείμενο χωρίς κρυπτογράφηση (δεν μοιάζει με κλειδί, μπορεί όμως να έχει κωδικό)', 'Δεν είναι κρυπτογραφημένο. Αν έχει κωδικό ή κλειδί που χρησιμοποιείται, βάλε το στα Cloudflare secrets ή στην κρυπτογραφημένη αποθήκη (DPAPI)· αν όχι, μπορεί να σβηστεί, αλλά ρώτα πρώτα το Claude.')
    binary = @('info', 'δεν είναι απλό κείμενο ούτε DPAPI', 'Μόνο πληροφορία: αρχείο προγράμματος, όχι κλειδί σε απλό κείμενο. Αν δεν ξέρεις τι είναι, ρώτα το Claude πριν το αγγίξεις.')
}

# ---------------- facts used by several checks (read only) ----------------
$isAdmin = $false
try { $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) } catch { $isAdmin = $false }
$cv = $null
try { $cv = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' } catch { $cv = $null }
$isServer = $false
$edition = ''
$build = 0
if ($cv) {
    $isServer = ([string]$cv.InstallationType -eq 'Server') -or ([string]$cv.ProductName -match '(?i)server')
    $edition = [string]$cv.EditionID
    try { $build = [int]$cv.CurrentBuild } catch { $build = 0 }
}
$isHome = $edition -match '^Core'
$OneDriveRoots = @(@($env:OneDrive, $env:OneDriveConsumer, $env:OneDriveCommercial) | Where-Object { $_ } | ForEach-Object { ([string]$_).TrimEnd('\') } | Sort-Object -Unique)

# ======================= 1. Microsoft Defender =======================
Section '1. Microsoft Defender'
$mp = $null
$mpWhy = 'missing'
if (Get-Command Get-MpComputerStatus -ErrorAction SilentlyContinue) {
    try { $mp = Get-MpComputerStatus; $mpWhy = '' } catch { $mp = $null; $mpWhy = Get-Reason $_ }
}
$mpPref = $null
if ($mp -and (Get-Command Get-MpPreference -ErrorAction SilentlyContinue)) {
    try { $mpPref = Get-MpPreference } catch { $mpPref = $null }
}
# Antivirus products that Windows knows (SecurityCenter2 exists only on Windows 10/11, not on Windows Server).
$avProducts = $null
$avWhy = ''
try {
    if ($TestAntivirus) {
        # Tests only: "Name=on;Name=off" instead of SecurityCenter2
        $avProducts = @($TestAntivirus -split ';' | Where-Object { $_ -match '=' } | ForEach-Object {
            $kv = $_ -split '=', 2
            [pscustomobject]@{ Name = $kv[0].Trim(); On = ($kv[1].Trim() -eq 'on'); Defender = ($kv[0] -match '(?i)defender') }
        })
    } else {
        $avProducts = @(Get-CimInstance -Namespace 'root/SecurityCenter2' -ClassName 'AntivirusProduct' | ForEach-Object {
            $state = [int64]0
            try { $state = [int64]$_.productState } catch { }
            $hex = '{0:X6}' -f $state
            if ($hex.Length -gt 6) { $hex = $hex.Substring($hex.Length - 6) }
            $rt = $hex.Substring(2, 2)
            [pscustomobject]@{ Name = [string]$_.displayName; On = ($rt -eq '10' -or $rt -eq '11'); Defender = ([string]$_.displayName -match '(?i)defender') }
        })
    }
} catch { $avProducts = $null; $avWhy = Get-Reason $_ }
$others = @($avProducts | Where-Object { $_ -and -not $_.Defender })
$otherOn = @($others | Where-Object { $_.On })
$otherName = (@($otherOn | ForEach-Object { $_.Name }) -join ', ')
$defActive = $false
if ($mp) {
    $defActive = [bool]$mp.AMServiceEnabled -and [bool]$mp.AntivirusEnabled -and ([string]$mp.AMRunningMode -notmatch '(?i)passive|not running')
}

try {
    if ($mp) {
        if ($defActive) {
            Mark 'ok' 'Microsoft Defender: ανοιχτό (η υπηρεσία και το antivirus δουλεύουν)' 'Το antivirus των Windows προστατεύει τον υπολογιστή. Δεν χρειάζεται τίποτα.'
            if ([bool]$mp.RealTimeProtectionEnabled) {
                Mark 'ok' 'Προστασία σε πραγματικό χρόνο: ανοιχτή' 'Ελέγχει κάθε αρχείο τη στιγμή που ανοίγει ή κατεβαίνει. Δεν χρειάζεται τίποτα.'
            } else {
                Mark 'bad' 'Προστασία σε πραγματικό χρόνο: ΚΛΕΙΣΤΗ' 'Ένας ιός μπορεί να τρέξει χωρίς να τον δει κανείς. Στις ρυθμίσεις «Προστασία από ιούς και απειλές» άνοιξε την «Προστασία σε πραγματικό χρόνο».' 'windowsdefender://threatsettings/' 1
            }
        } elseif ($otherOn.Count -gt 0) {
            Mark 'ok' ('Microsoft Defender: σε αναμονή, γιατί προστατεύει το {0}' -f $otherName) ('Ένα antivirus αρκεί. Κράτα το {0} ενημερωμένο.' -f $otherName)
            Mark 'info' 'Προστασία σε πραγματικό χρόνο του Defender: δεν χρησιμοποιείται' ('Την κάνει το {0}. Δεν χρειάζεται τίποτα.' -f $otherName)
        } elseif ($null -eq $avProducts) {
            Mark 'warn' 'Microsoft Defender: κλειστό, και δεν μπορώ να δω αν υπάρχει άλλο antivirus' 'Αν δεν έχεις άλλο antivirus, ο υπολογιστής δεν έχει προστασία από ιούς. Άνοιξε την «Προστασία από ιούς και απειλές» και δες τι γράφει.' 'windowsdefender://threat/' 5
        } else {
            Mark 'bad' 'Microsoft Defender: ΚΛΕΙΣΤΟ (και η προστασία σε πραγματικό χρόνο), και δεν βρέθηκε άλλο antivirus' 'Ο υπολογιστής δεν έχει προστασία από ιούς. Άνοιξε την «Προστασία από ιούς και απειλές» και άνοιξε το Defender.' 'windowsdefender://threat/' 1
        }
    } elseif ($otherOn.Count -gt 0) {
        Mark 'ok' ('Antivirus: {0} (ανοιχτό)' -f $otherName) 'Το Microsoft Defender δεν διαβάζεται, αλλά τα Windows βλέπουν άλλο antivirus ανοιχτό. Κράτα το ενημερωμένο.'
    } else {
        MarkNA 'Microsoft Defender' $mpWhy 'windowsdefender://threat/'
    }
} catch { MarkNA 'Microsoft Defender' (Get-Reason $_) 'windowsdefender://threat/' }

if ($defActive) {
    # Tamper protection
    try {
        $tp = $mp.IsTamperProtected
        if ($null -eq $tp) { MarkNA 'Προστασία από παραβίαση (Tamper Protection)' 'unread' 'windowsdefender://threatsettings/' }
        elseif ([bool]$tp) { Mark 'ok' 'Προστασία από παραβίαση (Tamper Protection): ανοιχτή' 'Κανένα πρόγραμμα δεν μπορεί να κλείσει κρυφά το Defender. Δεν χρειάζεται τίποτα.' }
        else { Mark 'warn' 'Προστασία από παραβίαση (Tamper Protection): κλειστή' 'Ένας ιός θα μπορούσε να κλείσει το Defender. Στις ρυθμίσεις «Προστασία από ιούς και απειλές» άνοιξε την «Προστασία από παραβίαση».' 'windowsdefender://threatsettings/' 9 }
    } catch { MarkNA 'Προστασία από παραβίαση (Tamper Protection)' (Get-Reason $_) 'windowsdefender://threatsettings/' }

    # Virus definitions: ΠΡΟΣΟΧΗ above 2 days, ΠΡΟΒΛΗΜΑ above 7
    try {
        $last = $null
        try { $last = [datetime]$mp.AntivirusSignatureLastUpdated } catch { $last = $null }
        $ageDays = $null
        if ($last -and $last.Year -gt 2000) { $ageDays = ($now - $last).TotalDays }
        elseif ($null -ne $mp.AntivirusSignatureAge -and [int64]$mp.AntivirusSignatureAge -lt 65535) { $ageDays = [double]$mp.AntivirusSignatureAge }
        if ($null -eq $ageDays) { MarkNA 'Ορισμοί ιών του Defender' 'unread' 'windowsdefender://threat/' }
        else {
            $when = 'άγνωστη ημερομηνία'
            if ($last -and $last.Year -gt 2000) { $when = $last.ToString('yyyy-MM-dd HH:mm', $inv) }
            $what = 'Ορισμοί ιών του Defender: τελευταία ενημέρωση {0}, πριν από {1}' -f $when, (Get-DaysText $ageDays)
            if ($ageDays -gt 7) { Mark 'bad' $what 'Το Defender δεν ξέρει τους ιούς της τελευταίας εβδομάδας. Άνοιξε την «Προστασία από ιούς και απειλές», στις «Ενημερώσεις προστασίας» πάτα «Έλεγχος για ενημερώσεις», και μετά άνοιξε και το Windows Update.' 'windowsdefender://threat/' 2 }
            elseif ($ageDays -gt 2) { Mark 'warn' $what 'Το Defender δεν ξέρει τους πιο νέους ιούς. Άνοιξε την «Προστασία από ιούς και απειλές» και στις «Ενημερώσεις προστασίας» πάτα «Έλεγχος για ενημερώσεις».' 'windowsdefender://threat/' 3 }
            else { Mark 'ok' $what 'Το Defender ξέρει τους νέους ιούς. Δεν χρειάζεται τίποτα.' }
        }
    } catch { MarkNA 'Ορισμοί ιών του Defender' (Get-Reason $_) 'windowsdefender://threat/' }

    # Last quick / full scan (days; 65535 or more = never)
    try {
        $q = $null
        $f = $null
        if ($null -ne $mp.QuickScanAge) { $q = [int64]$mp.QuickScanAge }
        if ($null -ne $mp.FullScanAge) { $f = [int64]$mp.FullScanAge }
        $qText = 'άγνωστη'
        if ($null -ne $q) { if ($q -ge 65535 -or $q -lt 0) { $qText = 'ποτέ' } else { $qText = 'πριν από ' + (Get-DaysText $q) } }
        $fText = 'άγνωστη'
        if ($null -ne $f) { if ($f -ge 65535 -or $f -lt 0) { $fText = 'ποτέ' } else { $fText = 'πριν από ' + (Get-DaysText $f) } }
        $what = 'Τελευταία γρήγορη σάρωση: {0} · πλήρης σάρωση: {1}' -f $qText, $fText
        if ($null -eq $q) { MarkNA 'Σαρώσεις του Defender' 'unread' 'windowsdefender://threat/' }
        elseif ($q -ge 65535 -or $q -lt 0 -or $q -gt 14) { Mark 'warn' $what 'Δεν έγινε σάρωση εδώ και καιρό. Άνοιξε την «Προστασία από ιούς και απειλές» και πάτα «Γρήγορη σάρωση» (αυτό το εργαλείο δεν ξεκινά σάρωση).' 'windowsdefender://threat/' 25 }
        else { Mark 'ok' $what 'Το Defender ελέγχει μόνο του τον υπολογιστή. Η πλήρης σάρωση δεν χρειάζεται συχνά.' }
    } catch { MarkNA 'Σαρώσεις του Defender' (Get-Reason $_) 'windowsdefender://threat/' }

    # Cloud protection and sample submission (Get-MpPreference)
    try {
        if ($null -eq $mpPref) { MarkNA 'Προστασία από το cloud και αποστολή δειγμάτων' 'unread' 'windowsdefender://threatsettings/' }
        else {
            $maps = $mpPref.MAPSReporting
            $ssc = $mpPref.SubmitSamplesConsent
            $mapsText = 'δεν διαβάζεται'
            if ($null -ne $maps) {
                switch ([int]$maps) { 0 { $mapsText = 'κλειστή' } 1 { $mapsText = 'ανοιχτή (βασική)' } 2 { $mapsText = 'ανοιχτή' } default { $mapsText = ('τιμή {0}' -f $maps) } }
            }
            $sscText = 'δεν διαβάζεται'
            if ($null -ne $ssc) {
                switch ([int]$ssc) { 0 { $sscText = 'ρωτά πρώτα' } 1 { $sscText = 'αυτόματη (μόνο ασφαλή δείγματα)' } 2 { $sscText = 'ποτέ' } 3 { $sscText = 'αυτόματη (όλα τα δείγματα)' } default { $sscText = ('τιμή {0}' -f $ssc) } }
            }
            $what = 'Προστασία από το cloud: {0} · αποστολή δειγμάτων: {1}' -f $mapsText, $sscText
            if ($null -eq $maps -and $null -eq $ssc) { MarkNA 'Προστασία από το cloud και αποστολή δειγμάτων' 'unread' 'windowsdefender://threatsettings/' }
            elseif (($null -ne $maps -and [int]$maps -eq 0) -or ($null -ne $ssc -and [int]$ssc -eq 2)) { Mark 'warn' $what 'Χωρίς το cloud το Defender αργεί να καταλάβει νέους ιούς. Στις ρυθμίσεις «Προστασία από ιούς και απειλές» άνοιξε την «Προστασία μέσω cloud» και την «Αυτόματη υποβολή δειγμάτων».' 'windowsdefender://threatsettings/' 16 }
            else { Mark 'ok' $what 'Το Defender ρωτά το cloud της Microsoft για νέα ύποπτα αρχεία. Δεν χρειάζεται τίποτα.' }
        }
    } catch { MarkNA 'Προστασία από το cloud και αποστολή δειγμάτων' (Get-Reason $_) 'windowsdefender://threatsettings/' }

    # PUA blocking
    try {
        $pua = $null
        if ($mpPref) { $pua = $mpPref.PUAProtection }
        if ($null -eq $pua) { MarkNA 'Αποκλεισμός ανεπιθύμητων εφαρμογών (PUA)' 'unread' 'windowsdefender://appbrowser/' }
        elseif ([int]$pua -eq 1) { Mark 'ok' 'Αποκλεισμός ανεπιθύμητων εφαρμογών (PUA): ανοιχτός' 'Μπλοκάρει προγράμματα που βάζουν διαφημίσεις ή άλλα προγράμματα χωρίς να ρωτήσουν. Δεν χρειάζεται τίποτα.' }
        else {
            $puaText = 'κλειστός'
            if ([int]$pua -eq 2) { $puaText = 'μόνο καταγραφή' }
            Mark 'warn' ('Αποκλεισμός ανεπιθύμητων εφαρμογών (PUA): {0}' -f $puaText) 'Προγράμματα με κρυφές διαφημίσεις μπορούν να μπουν μαζί με άλλες εγκαταστάσεις. Στον «Έλεγχο εφαρμογών και προγράμματος περιήγησης», στην «Προστασία βάσει φήμης», άνοιξε τον «Αποκλεισμό πιθανώς ανεπιθύμητων εφαρμογών».' 'windowsdefender://appbrowser/' 18
        }
    } catch { MarkNA 'Αποκλεισμός ανεπιθύμητων εφαρμογών (PUA)' (Get-Reason $_) 'windowsdefender://appbrowser/' }

    # Controlled folder access: information only
    try {
        $cfa = $null
        if ($mpPref) { $cfa = $mpPref.EnableControlledFolderAccess }
        $cfaText = 'δεν διαβάζεται'
        if ($null -ne $cfa) {
            switch ([int]$cfa) { 0 { $cfaText = 'κλειστή' } 1 { $cfaText = 'ανοιχτή' } 2 { $cfaText = 'μόνο καταγραφή' } default { $cfaText = 'ανοιχτή εν μέρει' } }
        }
        Mark 'info' ('Ελεγχόμενη πρόσβαση σε φακέλους: {0}' -f $cfaText) 'Μόνο πληροφορία. Προστατεύει τα Έγγραφα από ransomware, αλλά μπλοκάρει και προγράμματα που γράφουν εκεί (π.χ. το Node.js και το wrangler των εργαλείων Gear World). Μην την αλλάξεις χωρίς να ρωτήσεις πρώτα το Claude.'
    } catch { Mark 'info' 'Ελεγχόμενη πρόσβαση σε φακέλους: δεν διαβάζεται' 'Μόνο πληροφορία. Μην την αλλάξεις χωρίς να ρωτήσεις πρώτα το Claude.' }
}

# Threats of the last 30 days: name and date only (never files, users or programs)
if ($mp) {
    if (Get-Command Get-MpThreatDetection -ErrorAction SilentlyContinue) {
        try {
            $since = $now.AddDays(-30)
            $det = @(Get-MpThreatDetection | Where-Object { $_.InitialDetectionTime -and ([datetime]$_.InitialDetectionTime) -ge $since })
            if ($det.Count -eq 0) {
                Mark 'ok' 'Απειλές τις τελευταίες 30 μέρες: καμία' 'Το Defender δεν βρήκε τίποτα. Δεν χρειάζεται τίποτα.'
            } else {
                $names = @{}
                try { foreach ($t in @(Get-MpThreat)) { $names[[string]$t.ThreatID] = [string]$t.ThreatName } } catch { }
                $lines = @()
                foreach ($d in @($det | Sort-Object InitialDetectionTime -Descending | Select-Object -First 10)) {
                    $nm = $names[[string]$d.ThreatID]
                    if (-not $nm) { $nm = 'απειλή ' + [string]$d.ThreatID }
                    $lines += ('· {0} · {1}' -f ([datetime]$d.InitialDetectionTime).ToString('yyyy-MM-dd', $inv), $nm)
                }
                if ($det.Count -gt 10) { $lines += ('· ... και άλλες {0}' -f ($det.Count - 10)) }
                $failed = @($det | Where-Object { $_.ActionSuccess -eq $false }).Count
                if ($failed -gt 0) {
                    Mark 'bad' ('Απειλές τις τελευταίες 30 μέρες: {0}, και {1} ΔΕΝ αντιμετωπίστηκαν' -f $det.Count, $failed) 'Άνοιξε το «Ιστορικό προστασίας», πάτα την απειλή και μετά «Ενέργειες». Στείλε αυτή την αναφορά στο Claude.' 'windowsdefender://threat/' 1 $lines
                } else {
                    Mark 'warn' ('Απειλές τις τελευταίες 30 μέρες: {0} (το Defender τις σταμάτησε)' -f $det.Count) 'Το Defender τις σταμάτησε. Δες στο «Ιστορικό προστασίας» ότι όλες γράφουν «Καταργήθηκε» ή «Σε καραντίνα».' 'windowsdefender://threat/' 11 $lines
                }
            }
        } catch { MarkNA 'Απειλές τις τελευταίες 30 μέρες' (Get-Reason $_) 'windowsdefender://threat/' }
    } else { MarkNA 'Απειλές τις τελευταίες 30 μέρες' 'missing' 'windowsdefender://threat/' }
}

# Other antivirus products registered in Windows
try {
    if ($null -eq $avProducts) {
        if ($isServer) { MarkNA 'Antivirus που ξέρουν τα Windows (Κέντρο ασφαλείας)' 'missing' }
        else { MarkNA 'Antivirus που ξέρουν τα Windows (Κέντρο ασφαλείας)' $avWhy 'windowsdefender://threat/' }
    } elseif ($avProducts.Count -eq 0) {
        Mark 'info' 'Antivirus που ξέρουν τα Windows: κανένα στη λίστα' 'Η λίστα των Windows είναι άδεια. Δες τι γράφει η «Προστασία από ιούς και απειλές».' 'windowsdefender://threat/'
    } else {
        $list = (@($avProducts | ForEach-Object { '{0} ({1})' -f $_.Name, $(if ($_.On) { 'ανοιχτό' } else { 'κλειστό' }) }) -join ', ')
        $activeCount = $otherOn.Count
        if ($defActive) { $activeCount++ }
        if ($activeCount -gt 1) { Mark 'warn' ('Antivirus που ξέρουν τα Windows: {0}' -f $list) 'Δύο antivirus ανοιχτά μαζί κάνουν τον υπολογιστή αργό και μπορεί να συγκρούονται. Ένα αρκεί: στείλε την αναφορά στο Claude για το ποιο να μείνει.' 'windowsdefender://threat/' 30 }
        elseif ($others.Count -eq 0) { Mark 'ok' ('Antivirus που ξέρουν τα Windows: {0}' -f $list) 'Μόνο το Microsoft Defender: σωστό, ένα antivirus αρκεί.' }
        else { Mark 'ok' ('Antivirus που ξέρουν τα Windows: {0}' -f $list) 'Ένα ανοιχτό antivirus αρκεί. Δεν χρειάζεται τίποτα.' }
        # An antivirus that is off but still registered, next to an active one (never Windows Defender): a leftover.
        $anyActive = $defActive -or (@($avProducts | Where-Object { $_.On }).Count -gt 0)
        if ($anyActive) {
            foreach ($old in @($others | Where-Object { -not $_.On })) {
                Mark 'info' ('Παλιό antivirus: {0} (κλειστό, αλλά ακόμα γραμμένο στα Windows)' -f $old.Name) 'Ένα παλιό antivirus είναι ακόμα γραμμένο στα Windows· αν δεν το χρησιμοποιείς, μπορείς να το απεγκαταστήσεις από Ρυθμίσεις > Εφαρμογές.' 'ms-settings:appsfeatures'
            }
        }
    }
} catch { MarkNA 'Antivirus που ξέρουν τα Windows' (Get-Reason $_) }

# ======================= 2. Firewall =======================
Section '2. Τείχος προστασίας (Firewall)'
try {
    if (-not (Get-Command Get-NetFirewallProfile -ErrorAction SilentlyContinue)) { MarkNA 'Τείχος προστασίας' 'missing' 'windowsdefender://network/' }
    else {
        $profiles = $null
        try { $profiles = @(Get-NetFirewallProfile -PolicyStore ActiveStore) } catch { $profiles = @(Get-NetFirewallProfile) }
        $gr = @{ Domain = 'Δίκτυο τομέα'; Private = 'Ιδιωτικό δίκτυο'; Public = 'Δημόσιο δίκτυο' }
        $parts = @()
        $offMain = 0
        $offDomain = $false
        $missing = 0
        foreach ($name in @('Domain', 'Private', 'Public')) {
            $p = $profiles | Where-Object { [string]$_.Name -eq $name } | Select-Object -First 1
            if (-not $p) { $parts += ('{0}: δεν βρέθηκε' -f $gr[$name]); $missing++; continue }
            $on = ([string]$p.Enabled -eq 'True' -or [string]$p.Enabled -eq '1')
            if ($on) { $parts += ('{0}: ανοιχτό' -f $gr[$name]) }
            else {
                $parts += ('{0}: ΚΛΕΙΣΤΟ' -f $gr[$name])
                if ($name -eq 'Domain') { $offDomain = $true } else { $offMain++ }
            }
        }
        $what = 'Τείχος προστασίας: ' + ($parts -join ' · ')
        if ($missing -eq 3) { MarkNA 'Τείχος προστασίας' 'unread' 'windowsdefender://network/' }
        elseif ($offMain -gt 0) { Mark 'bad' $what 'Ο υπολογιστής δέχεται συνδέσεις που δεν ζήτησες, π.χ. σε δημόσιο Wi-Fi. Άνοιξε το «Τείχος προστασίας και προστασία δικτύου» και άνοιξε το τείχος σε κάθε δίκτυο.' 'windowsdefender://network/' 2 }
        elseif ($offDomain) { Mark 'warn' $what 'Το δίκτυο τομέα χρησιμοποιείται μόνο σε εταιρείες, αλλά καλύτερα να είναι κι αυτό ανοιχτό. Άνοιξε το «Τείχος προστασίας και προστασία δικτύου».' 'windowsdefender://network/' 20 }
        else { Mark 'ok' $what 'Μπλοκάρει συνδέσεις από το διαδίκτυο που δεν ζήτησες. Δεν χρειάζεται τίποτα.' }
    }
} catch { MarkNA 'Τείχος προστασίας' (Get-Reason $_) 'windowsdefender://network/' }

# ======================= 3. Windows Update =======================
Section '3. Windows Update'
# Windows version and build (no support dates are kept here: Windows Update says when a newer version is due)
try {
    if (-not $cv) { MarkNA 'Έκδοση των Windows' 'unread' 'ms-settings:windowsupdate' }
    else {
        $product = [string]$cv.ProductName
        # Windows 11 still writes "Windows 10" in ProductName: the build (22000 and later) says which it is.
        if ($build -ge 22000 -and $product -match '^Windows 10') { $product = 'Windows 11' + $product.Substring(10) }
        $disp = [string]$cv.DisplayVersion
        if (-not $disp) { $disp = [string]$cv.ReleaseId }
        $ubr = ''
        if ($null -ne $cv.UBR) { $ubr = '.' + [string]$cv.UBR }
        $what = ('Windows: {0} {1} (build {2}{3})' -f $product, $disp, [string]$cv.CurrentBuild, $ubr) -replace '\s+', ' '
        if (-not $isServer -and $build -gt 0 -and $build -lt 22000) {
            Mark 'warn' $what 'Η δωρεάν υποστήριξη των Windows 10 τελείωσε στις 14/10/2025: χωρίς ενημερώσεις ασφαλείας μένουν ανοιχτά τα νέα κενά. Δες στο Windows Update αν ο υπολογιστής μπορεί να πάει δωρεάν στα Windows 11.' 'ms-settings:windowsupdate' 6
        } else {
            Mark 'info' $what 'Κάθε έκδοση των Windows παίρνει ενημερώσεις ασφαλείας για περιορισμένο χρόνο. Αν το Windows Update δείχνει νεότερη έκδοση (ενημέρωση δυνατοτήτων), εγκατάστησέ την.' 'ms-settings:windowsupdate'
        }
    }
} catch { MarkNA 'Έκδοση των Windows' (Get-Reason $_) 'ms-settings:windowsupdate' }

# Last installed update: Get-HotFix and the local Windows Update history (Defender definitions and the monthly
# malware removal tool do not count: they are not Windows security updates)
try {
    $ExcludeKb = @('2267602', '4052623', '2461484', '890830', '915597', '2310138')
    $latest = $null
    $latestKb = ''
    $latestSrc = ''
    if (Get-Command Get-HotFix -ErrorAction SilentlyContinue) {
        try {
            foreach ($h in @(Get-HotFix)) {
                $d = $null
                try { if ($h.InstalledOn) { $d = [datetime]$h.InstalledOn } } catch { $d = $null }
                if ($null -ne $d -and $d -le $now.AddDays(1) -and ($null -eq $latest -or $d -gt $latest)) { $latest = $d; $latestKb = [string]$h.HotFixID; $latestSrc = 'Get-HotFix' }
            }
        } catch { }
    }
    $wu = Get-UpdateHistory $UpdateTimeoutSeconds
    foreach ($i in @($wu.items)) {
        try {
            if ([int]$i.Operation -ne 1) { continue }
            if ([int]$i.Result -ne 2 -and [int]$i.Result -ne 3) { continue }
            $m = [regex]::Match([string]$i.Title, 'KB(\d{6,8})')
            if (-not $m.Success) { continue }
            if ($ExcludeKb -contains $m.Groups[1].Value) { continue }
            $d = ([datetime]$i.Date).ToLocalTime()
            if ($d -le $now.AddDays(1) -and ($null -eq $latest -or $d -gt $latest)) { $latest = $d; $latestKb = 'KB' + $m.Groups[1].Value; $latestSrc = 'ιστορικό του Windows Update' }
        } catch { }
    }
    $notes = @()
    if ($wu.state -eq 'timeout') { $notes += ('· Το ιστορικό του Windows Update δεν απάντησε σε {0} δευτερόλεπτα: μετράει μόνο η λίστα του Get-HotFix.' -f $UpdateTimeoutSeconds) }
    elseif ($wu.state -eq 'error') { $notes += '· Το ιστορικό του Windows Update δεν διαβάστηκε: μετράει μόνο η λίστα του Get-HotFix.' }
    elseif ($wu.state -eq 'skipped') { $notes += '· Το ιστορικό του Windows Update δεν διαβάστηκε (-UpdateTimeoutSeconds 0): μετράει μόνο η λίστα του Get-HotFix.' }
    if ($null -eq $latest) { MarkNA 'Τελευταία ενημέρωση των Windows' 'unread' 'ms-settings:windowsupdate-history' }
    else {
        $age = ($now - $latest).TotalDays
        $what = 'Τελευταία ενημέρωση των Windows: {0} ({1}, από: {2}), πριν από {3}' -f $latest.ToString('yyyy-MM-dd', $inv), $latestKb, $latestSrc, (Get-DaysText $age)
        if ($age -gt 90) { Mark 'bad' $what 'Πάνω από 3 μήνες χωρίς ενημέρωση: ο υπολογιστής μένει ανοιχτός σε γνωστά κενά ασφαλείας. Άνοιξε το Windows Update, πάτα «Έλεγχος για ενημερώσεις» και εγκατάστησε ό,τι βρει.' 'ms-settings:windowsupdate' 3 $notes }
        elseif ($age -gt 45) { Mark 'warn' $what 'Λείπει μάλλον τουλάχιστον μία μηνιαία ενημέρωση ασφαλείας. Άνοιξε το Windows Update και πάτα «Έλεγχος για ενημερώσεις».' 'ms-settings:windowsupdate' 5 $notes }
        else { Mark 'ok' $what 'Τα Windows παίρνουν τις μηνιαίες ενημερώσεις ασφαλείας. Δεν χρειάζεται τίποτα.' '' 50 $notes }
    }
} catch { MarkNA 'Τελευταία ενημέρωση των Windows' (Get-Reason $_) 'ms-settings:windowsupdate-history' }

# Restart pending (only reads whether the keys exist)
try {
    $reboot = @()
    if (Test-Path -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') { $reboot += 'ενημερώσεις των Windows' }
    if (Test-Path -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') { $reboot += 'Windows Update' }
    if ($reboot.Count -gt 0) { Mark 'warn' ('Επανεκκίνηση για ενημερώσεις: ΧΡΕΙΑΖΕΤΑΙ ({0})' -f ($reboot -join ', ')) 'Κάποιες ενημερώσεις ολοκληρώνονται μόνο μετά από επανεκκίνηση. Αποθήκευσε τη δουλειά σου και κάνε επανεκκίνηση.' 'ms-settings:windowsupdate' 14 }
    else { Mark 'ok' 'Επανεκκίνηση για ενημερώσεις: δεν χρειάζεται' 'Καμία ενημέρωση δεν περιμένει επανεκκίνηση. Δεν χρειάζεται τίποτα.' }
} catch { MarkNA 'Επανεκκίνηση για ενημερώσεις' (Get-Reason $_) 'ms-settings:windowsupdate' }

# ======================= 4. Accounts =======================
Section '4. Λογαριασμοί'
$uacLink = 'UserAccountControlSettings'
try {
    $sysPol = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
    if (-not (Test-Path -LiteralPath $sysPol)) { MarkNA 'Έλεγχος λογαριασμού χρήστη (UAC)' 'unread' $uacLink }
    else {
        $lua = Get-RegValue $sysPol 'EnableLUA'
        $cpba = Get-RegValue $sysPol 'ConsentPromptBehaviorAdmin'
        $posd = Get-RegValue $sysPol 'PromptOnSecureDesktop'
        if ($null -ne $lua -and [int]$lua -eq 0) { Mark 'bad' 'Έλεγχος λογαριασμού χρήστη (UAC): ΚΛΕΙΣΤΟΣ' 'Προγράμματα μπορούν να αλλάξουν τα Windows χωρίς να σε ρωτήσουν. Βάλε τον δείκτη στο προεπιλεγμένο επίπεδο (θέλει επανεκκίνηση).' $uacLink 4 }
        elseif ($null -ne $cpba -and [int]$cpba -eq 0) { Mark 'bad' 'Έλεγχος λογαριασμού χρήστη (UAC): ανοιχτός, αλλά ΔΕΝ ρωτά πριν από αλλαγές' 'Ό,τι τρέξεις ως διαχειριστής αλλάζει τα Windows χωρίς ερώτηση. Βάλε τον δείκτη στο προεπιλεγμένο επίπεδο.' $uacLink 4 }
        elseif ($null -ne $posd -and [int]$posd -eq 0) { Mark 'warn' 'Έλεγχος λογαριασμού χρήστη (UAC): ανοιχτός, χωρίς τη σκοτεινή οθόνη' 'Η ερώτηση δεν προστατεύεται από άλλα προγράμματα. Βάλε τον δείκτη στο προεπιλεγμένο επίπεδο.' $uacLink 19 }
        else { Mark 'ok' 'Έλεγχος λογαριασμού χρήστη (UAC): ανοιχτός (ρωτά πριν από αλλαγές)' 'Κανένα πρόγραμμα δεν αλλάζει τα Windows χωρίς να πατήσεις «Ναι». Δεν χρειάζεται τίποτα.' }
    }
} catch { MarkNA 'Έλεγχος λογαριασμού χρήστη (UAC)' (Get-Reason $_) $uacLink }

try {
    $inAdmins = Get-AdminGroupMember
    if ($isAdmin) { $inAdmins = $true }
    $me = Hide-Name $env:USERNAME
    if ($null -eq $inAdmins) { MarkNA 'Ο λογαριασμός σου είναι διαχειριστής;' 'unread' 'ms-settings:otherusers' }
    elseif ($inAdmins) { Mark 'info' ('Ο λογαριασμός σου ({0}) είναι διαχειριστής' -f $me) 'Συνηθισμένο σε υπολογιστή σπιτιού. Κράτα το UAC ανοιχτό και πάτα «Ναι» μόνο σε προγράμματα που ξέρεις.' }
    else { Mark 'ok' ('Ο λογαριασμός σου ({0}) είναι τυπικός (όχι διαχειριστής)' -f $me) 'Πιο ασφαλές: κανένα πρόγραμμα δεν αλλάζει τα Windows χωρίς τον κωδικό του διαχειριστή.' }
} catch { MarkNA 'Ο λογαριασμός σου είναι διαχειριστής;' (Get-Reason $_) }

# Built-in Administrator (SID ...-500) and Guest (...-501), found by SID: their names depend on the language.
try {
    $accounts = $null
    $accWhy = 'missing'
    if (Get-Command Get-LocalUser -ErrorAction SilentlyContinue) {
        try { $accounts = @(Get-LocalUser | ForEach-Object { [pscustomobject]@{ Sid = [string]$_.SID; Enabled = [bool]$_.Enabled } }) } catch { $accounts = $null; $accWhy = Get-Reason $_ }
    }
    if ($null -eq $accounts) {
        try { $accounts = @(Get-CimInstance -ClassName 'Win32_UserAccount' -Filter 'LocalAccount=True' | ForEach-Object { [pscustomobject]@{ Sid = [string]$_.SID; Enabled = -not [bool]$_.Disabled } }) } catch { $accounts = $null; $accWhy = Get-Reason $_ }
    }
    if ($null -eq $accounts) {
        MarkNA 'Ενσωματωμένος λογαριασμός Administrator' $accWhy
        MarkNA 'Λογαριασμός Επισκέπτη (Guest)' $accWhy
    } else {
        $adm = $accounts | Where-Object { $_.Sid -match '-500$' } | Select-Object -First 1
        $gst = $accounts | Where-Object { $_.Sid -match '-501$' } | Select-Object -First 1
        if (-not $adm) { MarkNA 'Ενσωματωμένος λογαριασμός Administrator' 'unread' }
        elseif ($adm.Enabled) { Mark 'warn' 'Ενσωματωμένος λογαριασμός Administrator: ανοιχτός' 'Είναι ο πρώτος λογαριασμός που δοκιμάζουν όσοι επιτίθενται. Στείλε αυτή την αναφορά στο Claude για την εντολή που τον κλείνει (θέλει διαχειριστή).' '' 20 }
        else { Mark 'ok' 'Ενσωματωμένος λογαριασμός Administrator: κλειστός' 'Σωστό: τα Windows τον κρατούν κλειστό. Δεν χρειάζεται τίποτα.' }
        if (-not $gst) { MarkNA 'Λογαριασμός Επισκέπτη (Guest)' 'unread' }
        elseif ($gst.Enabled) { Mark 'bad' 'Λογαριασμός Επισκέπτη (Guest): ΑΝΟΙΧΤΟΣ' 'Οποιοσδήποτε μπορεί να μπει στον υπολογιστή χωρίς κωδικό. Στείλε αυτή την αναφορά στο Claude για την εντολή που τον κλείνει (θέλει διαχειριστή).' '' 10 }
        else { Mark 'ok' 'Λογαριασμός Επισκέπτη (Guest): κλειστός' 'Σωστό: κανείς δεν μπαίνει χωρίς κωδικό. Δεν χρειάζεται τίποτα.' }
    }
} catch {
    MarkNA 'Ενσωματωμένοι λογαριασμοί Administrator και Guest' (Get-Reason $_)
}

# ======================= 5. SmartScreen and Windows Hello =======================
Section '5. SmartScreen και Windows Hello'
try {
    $ssPolicy = Get-RegValue 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' 'EnableSmartScreen'
    $ssExplorer = Get-RegValue 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer' 'SmartScreenEnabled'
    $ssBad = 'Τα Windows δεν σε προειδοποιούν για άγνωστα ή επικίνδυνα αρχεία που κατεβάζεις. Στον «Έλεγχο εφαρμογών και προγράμματος περιήγησης», στην «Προστασία βάσει φήμης», άνοιξε τον «Έλεγχο εφαρμογών και αρχείων».'
    $ssOk = 'Τα Windows σε προειδοποιούν πριν ανοίξεις άγνωστο ή επικίνδυνο αρχείο. Δεν χρειάζεται τίποτα.'
    if ($null -ne $ssPolicy) {
        if ([int]$ssPolicy -eq 0) { Mark 'bad' 'SmartScreen (έλεγχος εφαρμογών και αρχείων): ΚΛΕΙΣΤΟ από πολιτική' $ssBad 'windowsdefender://appbrowser/' 8 }
        else { Mark 'ok' 'SmartScreen (έλεγχος εφαρμογών και αρχείων): ανοιχτό (από πολιτική)' $ssOk }
    } elseif ($null -ne $ssExplorer) {
        if ([string]$ssExplorer -match '(?i)^off$') { Mark 'bad' 'SmartScreen (έλεγχος εφαρμογών και αρχείων): ΚΛΕΙΣΤΟ' $ssBad 'windowsdefender://appbrowser/' 8 }
        else { Mark 'ok' ('SmartScreen (έλεγχος εφαρμογών και αρχείων): ανοιχτό ({0})' -f [string]$ssExplorer) $ssOk }
    } else {
        Mark 'ok' 'SmartScreen (έλεγχος εφαρμογών και αρχείων): ανοιχτό (προεπιλογή, καμία ρύθμιση δεν το κλείνει)' $ssOk
    }
} catch { MarkNA 'SmartScreen' (Get-Reason $_) 'windowsdefender://appbrowser/' }
# Windows Hello / PIN: Windows keeps it where only the system can read it, so it is not checked here.
Mark 'info' 'Windows Hello / PIN: δεν ελέγχεται αυτόματα (δεν διαβάζεται με σιγουριά)' 'Δες αν έχεις PIN ή Windows Hello: είναι πιο ασφαλές από έναν απλό κωδικό, γιατί δουλεύει μόνο σε αυτόν τον υπολογιστή.' 'ms-settings:signinoptions'

# ======================= 6. Disk encryption =======================
Section '6. Κρυπτογράφηση δίσκου'
try {
    $sysDrive = $env:SystemDrive
    if (-not $sysDrive) { $sysDrive = 'C:' }
    $enc = ''
    $encSrc = ''
    # a. Get-BitLockerVolume (needs administrator rights). Only the status is read, never the keys.
    if ($isAdmin -and (Get-Command Get-BitLockerVolume -ErrorAction SilentlyContinue)) {
        try {
            $bv = Get-BitLockerVolume -MountPoint $sysDrive
            $pst = [string]$bv.ProtectionStatus
            $vst = [string]$bv.VolumeStatus
            if ($pst -eq 'On') { $enc = 'on' }
            elseif ($vst -eq 'FullyEncrypted') { $enc = 'suspended' }
            elseif ($vst -eq 'EncryptionInProgress') { $enc = 'encrypting' }
            elseif ($vst -eq 'DecryptionInProgress') { $enc = 'decrypting' }
            else { $enc = 'off' }
            $encSrc = 'Get-BitLockerVolume'
        } catch { $enc = '' }
    }
    # b. What File Explorer shows next to the drive (works without administrator rights)
    if (-not $enc) {
        try {
            $shell = New-Object -ComObject 'Shell.Application'
            $folder = $shell.NameSpace($sysDrive + '\')
            $v = $null
            if ($folder) { $v = $folder.Self.ExtendedProperty('System.Volume.BitLockerProtection') }
            if ($null -ne $v) {
                $map = @{ 0 = 'off'; 1 = 'on'; 2 = 'off'; 3 = 'encrypting'; 4 = 'decrypting'; 5 = 'suspended'; 6 = 'on'; 8 = 'waiting' }
                $k = [int]$v
                if ($map.ContainsKey($k)) { $enc = $map[$k]; $encSrc = 'Εξερεύνηση αρχείων' }
            }
        } catch { }
    }
    # c. manage-bde, status only (administrator)
    if (-not $enc -and $isAdmin -and (Get-Command manage-bde.exe -ErrorAction SilentlyContinue)) {
        $enc = Get-ManageBdeState $sysDrive
        if ($enc) { $encSrc = 'manage-bde' }
    }
    $homeNote = ''
    if ($isHome) { $homeNote = ' Τα Windows Home δεν έχουν BitLocker: έχουν μόνο την «Κρυπτογράφηση συσκευής», αν την υποστηρίζει ο υπολογιστής.' }
    $encLink = 'control /name Microsoft.BitLockerDriveEncryption'
    if ($isHome) { $encLink = 'ms-settings:deviceencryption' }
    $label = 'Κρυπτογράφηση του δίσκου {0} (BitLocker / Κρυπτογράφηση συσκευής)' -f $sysDrive
    if (-not $enc) {
        if ($isAdmin) { MarkNA $label 'unread' $encLink ('Τα Windows δεν το έδωσαν σε αυτό το εργαλείο. Δες το μόνος σου στη ρύθμιση.' + $homeNote) }
        else { MarkNA $label 'admin' $encLink ('Χωρίς διαχειριστή τα Windows δεν το δείχνουν εδώ. Δες το μόνος σου στη ρύθμιση.' + $homeNote) }
    } else {
        $src = ' (από: {0})' -f $encSrc
        switch ($enc) {
            'on' { Mark 'ok' ($label + ': ανοιχτή' + $src) 'Αν χαθεί ή κλαπεί ο υπολογιστής, κανείς δεν διαβάζει τα αρχεία σου χωρίς τον κωδικό σου. Κράτα το κλειδί ανάκτησης στον λογαριασμό Microsoft.' 'https://account.microsoft.com/devices/recoverykey' }
            'encrypting' { Mark 'ok' ($label + ': κρυπτογραφείται τώρα' + $src) 'Η κρυπτογράφηση γίνεται τώρα. Άφησε τον υπολογιστή ανοιχτό μέχρι να τελειώσει.' }
            'suspended' { Mark 'warn' ($label + ': σε παύση' + $src) 'Ο δίσκος είναι κρυπτογραφημένος αλλά η προστασία είναι σε παύση (συμβαίνει σε ενημερώσεις). Συνήθως ξαναρχίζει μετά από επανεκκίνηση· αν μείνει έτσι, πάτα «Συνέχιση προστασίας».' $encLink 14 }
            'waiting' { Mark 'warn' ($label + ': περιμένει ενεργοποίηση' + $src) ('Η κρυπτογράφηση ξεκινά όταν συνδεθείς με λογαριασμό Microsoft, που κρατά το κλειδί ανάκτησης. Δες τη ρύθμιση.' + $homeNote) $encLink 12 }
            'decrypting' { Mark 'warn' ($label + ': ξεκρυπτογραφείται τώρα' + $src) 'Κάποιος κλείνει την κρυπτογράφηση. Αν δεν το έκανες εσύ, στείλε την αναφορά στο Claude.' $encLink 12 }
            default { Mark 'warn' ($label + ': κλειστή' + $src) ('Αν κλαπεί ο υπολογιστής, κάποιος μπορεί να διαβάσει τα αρχεία σου, μαζί με τα .dev.vars και τη σύνδεση του wrangler. Άνοιξέ την μόνο αφού δεις πού φυλάγεται το κλειδί ανάκτησης (λογαριασμός Microsoft).' + $homeNote) $encLink 12 }
        }
    }
} catch { MarkNA 'Κρυπτογράφηση δίσκου' (Get-Reason $_) }

# ======================= 7. Remote access =======================
Section '7. Απομακρυσμένη πρόσβαση'
try {
    $ts = 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server'
    if (-not (Test-Path -LiteralPath $ts)) { MarkNA 'Απομακρυσμένη επιφάνεια εργασίας (RDP)' 'unread' 'ms-settings:remotedesktop' }
    else {
        $deny = Get-RegValue $ts 'fDenyTSConnections'
        $nla = Get-RegValue ($ts + '\WinStations\RDP-Tcp') 'UserAuthentication'
        if ($null -eq $deny -or [int]$deny -ne 0) { Mark 'ok' 'Απομακρυσμένη επιφάνεια εργασίας (RDP): κλειστή' 'Κανείς δεν μπορεί να συνδεθεί στον υπολογιστή από μακριά. Δεν χρειάζεται τίποτα.' }
        elseif ($null -ne $nla -and [int]$nla -eq 0) { Mark 'bad' 'Απομακρυσμένη επιφάνεια εργασίας (RDP): ΑΝΟΙΧΤΗ, χωρίς έλεγχο ταυτότητας δικτύου (NLA)' 'Είναι εύκολος στόχος για επιθέσεις από το διαδίκτυο. Κλείσε την αν δεν τη χρησιμοποιείς, αλλιώς άνοιξε τον «έλεγχο ταυτότητας σε επίπεδο δικτύου».' 'ms-settings:remotedesktop' 3 }
        else { Mark 'warn' 'Απομακρυσμένη επιφάνεια εργασίας (RDP): ανοιχτή' 'Κάποιος με τον κωδικό σου μπορεί να συνδεθεί από μακριά. Αν δεν τη χρησιμοποιείς, κλείσε την στη ρύθμιση.' 'ms-settings:remotedesktop' 20 }
    }
} catch { MarkNA 'Απομακρυσμένη επιφάνεια εργασίας (RDP)' (Get-Reason $_) 'ms-settings:remotedesktop' }

try {
    $smb = ''
    $smbSrc = ''
    if ($isAdmin -and (Get-Command Get-WindowsOptionalFeature -ErrorAction SilentlyContinue)) {
        try {
            $feat = Get-WindowsOptionalFeature -Online -FeatureName 'SMB1Protocol'
            if ($feat) {
                $st = [string]$feat.State
                if ($st -eq 'Enabled' -or $st -eq 'EnablePending') { $smb = 'on' } else { $smb = 'off' }
                $smbSrc = 'δυνατότητες των Windows'
            }
        } catch { $smb = '' }
    }
    if (-not $smb -and (Get-Command Get-SmbServerConfiguration -ErrorAction SilentlyContinue)) {
        try {
            $cfg = Get-SmbServerConfiguration
            if ($null -ne $cfg.EnableSMB1Protocol) {
                if ([bool]$cfg.EnableSMB1Protocol) { $smb = 'on' } else { $smb = 'off' }
                $smbSrc = 'ρυθμίσεις SMB'
            }
        } catch { $smb = '' }
    }
    if (-not $smb) {
        # Last resort, without administrator: is the SMBv1 driver there at all?
        $drv = 'HKLM:\SYSTEM\CurrentControlSet\Services\mrxsmb10'
        if (-not (Test-Path -LiteralPath $drv)) { $smb = 'off'; $smbSrc = 'μητρώο: ο οδηγός του SMBv1 δεν υπάρχει' }
        else {
            $start = Get-RegValue $drv 'Start'
            if ($null -ne $start -and [int]$start -eq 4) { $smb = 'off'; $smbSrc = 'μητρώο: ο οδηγός του SMBv1 είναι απενεργοποιημένος' }
            else { $smb = 'maybe'; $smbSrc = 'μητρώο: ο οδηγός του SMBv1 υπάρχει' }
        }
    }
    $smbAdvice = 'Το SMBv1 είναι παλιό και το χρησιμοποίησαν ιοί όπως το WannaCry. Στις «Δυνατότητες των Windows» βγάλε το τικ από την «Υποστήριξη κοινής χρήσης αρχείων SMB 1.0/CIFS» (θέλει επανεκκίνηση).'
    $label = 'SMBv1 (παλιό πρωτόκολλο κοινής χρήσης αρχείων)'
    if ($smb -eq 'on') { Mark 'bad' ('{0}: ΑΝΟΙΧΤΟ (από: {1})' -f $label, $smbSrc) $smbAdvice 'optionalfeatures' 10 }
    elseif ($smb -eq 'maybe') { Mark 'warn' ('{0}: μάλλον ανοιχτό (από: {1})' -f $label, $smbSrc) ('Για σίγουρη απάντηση χρειάζεται διαχειριστής. ' + $smbAdvice) 'optionalfeatures' 21 }
    else { Mark 'ok' ('{0}: κλειστό (από: {1})' -f $label, $smbSrc) 'Το παλιό και επικίνδυνο SMBv1 δεν είναι ανοιχτό. Δεν χρειάζεται τίποτα.' }
} catch { MarkNA 'SMBv1' (Get-Reason $_) 'optionalfeatures' }

# ======================= 8. Gear World: secrets and wrangler =======================
Section '8. Gear World: μυστικά και wrangler'
try {
    $scanRoot = ''
    try { $scanRoot = [System.IO.Path]::GetFullPath($HomeDir).TrimEnd('\') } catch { $scanRoot = '' }
    $label = 'Αρχεία με μυστικά στον φάκελο χρήστη (.dev.vars, .env, token, secret, password, έως 3 επίπεδα)'
    if (-not $scanRoot -or -not (Test-Path -LiteralPath $scanRoot -PathType Container)) { MarkNA $label 'unread' }
    else {
        $found = @(Find-SecretFiles $scanRoot 3 | Sort-Object)
        if ($found.Count -eq 0) { Mark 'ok' ($label + ': κανένα') 'Δεν βρέθηκαν αρχεία με μυστικά σε απλό κείμενο. Δεν χρειάζεται τίποτα.' }
        else {
            Mark 'info' ('{0}: {1} (το περιεχόμενό τους δεν εμφανίζεται ποτέ)' -f $label, $found.Count) 'Από κάθε αρχείο διάβασα μόνο την αρχή (έως 4 KB), μόνο για να ξεχωρίσω κρυπτογραφημένο από απλό κείμενο· δεν δείχνω, δεν αντιγράφω και δεν γράφω τίποτα από αυτά. Τα μυστικά των sites ανήκουν στα Cloudflare secrets (wrangler secret put) ή στην κρυπτογραφημένη αποθήκη του υπολογιστή (DPAPI): ποτέ σε GitHub, OneDrive ή email. Μην σβήσεις τίποτα μόνος σου: ρώτα πρώτα το Claude.'
            $reportsDir = Join-Path $scanRoot 'gear-world-reports'
            foreach ($p in @($found | Select-Object -First 40)) {
                $rel = '~\' + $p.Substring($scanRoot.Length).TrimStart('\')
                $marks = @()
                $inOdFile = Test-InFolder $p $OneDriveRoots
                $inGit = Test-InGit $p $scanRoot
                if ($inOdFile) { $marks += 'στο OneDrive: ανεβαίνει στο cloud' }
                if ($inGit) { $marks += 'μέσα σε φάκελο Git' }
                $shownName = $rel
                if ($marks.Count -gt 0) { $shownName += ' (' + ($marks -join ', ') + ')' }
                $kind = Get-SecretKind $p (Test-InFolder (Split-Path -Parent $p) @($reportsDir))
                if ($kind -eq 'cloud') { MarkNA $shownName 'cloud' '' 'Για να μην κατέβει από το OneDrive, δεν το άνοιξα. Αν σε ανησυχεί, στείλε τη λίστα στο Claude.' }
                elseif (-not $SecretKinds.ContainsKey($kind)) { MarkNA $shownName 'unread' '' 'Δεν άνοιξε (ίσως το χρησιμοποιεί άλλο πρόγραμμα ή δεν έχεις δικαίωμα). Αν σε ανησυχεί, στείλε τη λίστα στο Claude.' }
                else {
                    $sk = $SecretKinds[$kind]
                    $w = 30
                    if ($kind -eq 'token') { $w = 15; if ($inOdFile -or $inGit) { $w = 12 } }
                    Mark $sk[0] ('{0}: «{1}»' -f $shownName, $sk[1]) $sk[2] '' $w
                }
            }
            if ($found.Count -gt 40) { Mark 'warn' ('Άλλα {0} αρχεία με μυστικά δεν ελέγχθηκαν (εδώ μόνο τα πρώτα 40)' -f ($found.Count - 40)) 'Στείλε την αναφορά στο Claude για το επόμενο βήμα.' '' 30 }
        }
    }
} catch { MarkNA 'Αρχεία με μυστικά στον φάκελο χρήστη' (Get-Reason $_) }

# wrangler login: only whether the file exists (its content is never read). Wrangler 3/4 keeps it under
# %APPDATA%\xdg.config\.wrangler, older versions under the user folder.
try {
    $wr1 = Join-Path (Join-Path (Join-Path $HomeDir '.wrangler') 'config') 'default.toml'
    $appData = $env:APPDATA
    if ($customHome) { $appData = Join-Path (Join-Path $HomeDir 'AppData') 'Roaming' }
    $e1 = Test-Path -LiteralPath $wr1 -PathType Leaf
    $e2 = $false
    if ($appData) { $e2 = Test-Path -LiteralPath (Join-Path (Join-Path (Join-Path (Join-Path $appData 'xdg.config') '.wrangler') 'config') 'default.toml') -PathType Leaf }
    $lines = @(
        ('· ~\.wrangler\config\default.toml: {0}' -f $(if ($e1) { 'υπάρχει' } else { 'δεν υπάρχει' })),
        ('· %APPDATA%\xdg.config\.wrangler\config\default.toml: {0}' -f $(if ($e2) { 'υπάρχει' } else { 'δεν υπάρχει' }))
    )
    if ($e1 -or $e2) { Mark 'info' 'Σύνδεση του wrangler με το Cloudflare: υπάρχει' 'Ο υπολογιστής κρατά τη σύνδεση με το Cloudflare όλων των sites (το αρχείο δεν διαβάστηκε). Άρα μετράνε ο κωδικός ή το PIN, το κλείδωμα της οθόνης και η κρυπτογράφηση του δίσκου.' '' 50 $lines }
    else { Mark 'info' 'Σύνδεση του wrangler με το Cloudflare: δεν υπάρχει' 'Δεν βρέθηκε σύνδεση του wrangler. Τα εργαλεία Gear World ζητούν σύνδεση όταν τη χρειαστούν.' '' 50 $lines }
} catch { MarkNA 'Σύνδεση του wrangler με το Cloudflare' (Get-Reason $_) }

# ======================= 9. Backups =======================
Section '9. Αντίγραφα ασφαλείας'
try {
    $odRunning = $false
    try { $odRunning = [bool](Get-Process -Name 'OneDrive' -ErrorAction SilentlyContinue) } catch { $odRunning = $false }
    $kf = @(
        @{ name = 'Επιφάνεια εργασίας'; path = [Environment]::GetFolderPath('Desktop') },
        @{ name = 'Έγγραφα'; path = [Environment]::GetFolderPath('MyDocuments') },
        @{ name = 'Εικόνες'; path = [Environment]::GetFolderPath('MyPictures') }
    )
    $parts = @(('OneDrive τρέχει: {0}' -f $(if ($odRunning) { 'ναι' } else { 'όχι' })))
    $inOd = @{}
    foreach ($k in $kf) {
        $yes = $false
        if ($k.path) { $yes = Test-InFolder (([string]$k.path).TrimEnd('\')) $OneDriveRoots }
        $inOd[$k.name] = $yes
        $parts += ('{0}: {1}' -f $k.name, $(if ($yes) { 'στο OneDrive' } else { 'όχι στο OneDrive' }))
    }
    $fh = $false
    if ($env:LOCALAPPDATA) { $fh = Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\FileHistory\Configuration\Config1.xml') }
    $parts += ('Ιστορικό αρχείων: {0}' -f $(if ($fh) { 'ρυθμισμένο' } else { 'όχι' }))
    $what = 'Αντίγραφο των αρχείων σου: ' + ($parts -join ' · ')
    $bothInOd = $inOd['Επιφάνεια εργασίας'] -and $inOd['Έγγραφα']
    $anyInOd = $inOd['Επιφάνεια εργασίας'] -or $inOd['Έγγραφα']
    if ($bothInOd -and $odRunning) { Mark 'ok' $what 'Η Επιφάνεια εργασίας και τα Έγγραφα έχουν αντίγραφο στο OneDrive. Δεν χρειάζεται τίποτα.' }
    elseif ($anyInOd -and -not $odRunning) { Mark 'warn' $what 'Οι φάκελοι είναι στο OneDrive, αλλά το OneDrive δεν τρέχει, άρα οι αλλαγές δεν ανεβαίνουν. Άνοιξε το OneDrive από το μενού Έναρξη.' 'ms-settings:backup' 13 }
    elseif ($fh) { Mark 'ok' $what 'Το Ιστορικό αρχείων κρατά αντίγραφα στον δίσκο που έχεις ορίσει. Σύνδεε τον δίσκο συχνά.' }
    elseif ($anyInOd) { Mark 'warn' $what 'Μόνο ένας από τους δύο φακέλους (Επιφάνεια εργασίας, Έγγραφα) έχει αντίγραφο στο OneDrive. Στα «Αντίγραφα ασφαλείας των Windows» άνοιξε και τον άλλο.' 'ms-settings:backup' 13 }
    else { Mark 'warn' $what 'Αν χαλάσει ο δίσκος, τα αρχεία σου χάνονται. Στα «Αντίγραφα ασφαλείας των Windows» άνοιξε τον συγχρονισμό φακέλων με το OneDrive.' 'ms-settings:backup' 13 }
} catch { MarkNA 'Αντίγραφο των αρχείων σου' (Get-Reason $_) 'ms-settings:backup' }

# The Gear World copy of tools/gw-backup.ps1 (README-RESTORE.txt is written at the end of every backup)
try {
    $gwb = @()
    $checked = @()
    foreach ($dr in [System.IO.DriveInfo]::GetDrives()) {
        $dt = [string]$dr.DriveType
        if ($dt -ne 'Fixed' -and $dt -ne 'Removable') { continue }
        $ready = $false
        try { $ready = $dr.IsReady } catch { $ready = $false }
        if (-not $ready) { continue }
        $checked += ([string]$dr.Name).TrimEnd('\')
        $rf = Join-Path (Join-Path $dr.RootDirectory.FullName 'GearWorldBackup') 'README-RESTORE.txt'
        if (Test-Path -LiteralPath $rf -PathType Leaf) { $gwb += [pscustomobject]@{ Path = (Split-Path -Parent $rf); When = (Get-Item -LiteralPath $rf).LastWriteTime } }
    }
    $drives = 'κανέναν (κανένας δίσκος δεν ήταν έτοιμος)'
    if ($checked.Count -gt 0) { $drives = $checked -join ', ' }
    $best = $gwb | Sort-Object When -Descending | Select-Object -First 1
    if (-not $best) { Mark 'warn' ('Αντίγραφο Gear World (gw-backup): δεν βρέθηκε στους δίσκους {0} (ο δίσκος του αντιγράφου μπορεί απλώς να μην είναι συνδεδεμένος)' -f $drives) 'Ο εξωτερικός δίσκος του αντιγράφου μπορεί απλώς να μην είναι συνδεδεμένος: σύνδεσέ τον και τρέξε ξανά τον έλεγχο. Αν δεν έχεις πάρει ποτέ αντίγραφο, ζήτησε από το Claude την εντολή του gw-backup.' '' 35 }
    else {
        $age = ($now - $best.When).TotalDays
        $what = 'Αντίγραφο Gear World (gw-backup): {0}, τελευταίο {1}, πριν από {2} (έλεγξα τους δίσκους {3})' -f $best.Path, $best.When.ToString('yyyy-MM-dd', $inv), (Get-DaysText $age), $drives
        if ($age -gt 30) { Mark 'warn' $what 'Το αντίγραφο είναι παλιό. Ζήτησε από το Claude την εντολή του gw-backup, με τον δίσκο συνδεδεμένο.' '' 22 }
        else { Mark 'ok' $what 'Ο εξωτερικός δίσκος έχει πρόσφατο αντίγραφο όλου του Gear World. Κράτα τον στο σπίτι.' }
    }
} catch { MarkNA 'Αντίγραφο Gear World (gw-backup)' (Get-Reason $_) }

# Last System Restore point (Get-ComputerRestorePoint needs administrator rights; Windows Server has none)
try {
    $rpLabel = 'Σημείο επαναφοράς συστήματος'
    if (-not (Get-Command Get-ComputerRestorePoint -ErrorAction SilentlyContinue) -or $isServer) { MarkNA $rpLabel 'missing' }
    elseif (-not $isAdmin) { MarkNA $rpLabel 'admin' 'SystemPropertiesProtection' }
    else {
        $rps = @(Get-ComputerRestorePoint)
        $latestRp = $null
        foreach ($rp in $rps) {
            $d = $null
            try { $d = [datetime]::ParseExact(([string]$rp.CreationTime).Substring(0, 14), 'yyyyMMddHHmmss', $inv) } catch { $d = $null }
            if ($null -ne $d -and ($null -eq $latestRp -or $d -gt $latestRp)) { $latestRp = $d }
        }
        if ($rps.Count -eq 0) { Mark 'warn' ($rpLabel + ': κανένα') 'Χωρίς σημείο επαναφοράς δεν γυρίζεις εύκολα πίσω αν χαλάσει μια ενημέρωση ή ένα πρόγραμμα. Η «Προστασία συστήματος» μάλλον είναι κλειστή για τον δίσκο C:.' 'SystemPropertiesProtection' 26 }
        elseif ($null -eq $latestRp) { MarkNA $rpLabel 'unread' 'SystemPropertiesProtection' }
        else {
            $age = ($now - $latestRp).TotalDays
            $what = '{0}: τελευταίο {1}, πριν από {2}' -f $rpLabel, $latestRp.ToString('yyyy-MM-dd', $inv), (Get-DaysText $age)
            if ($age -gt 30) { Mark 'warn' $what 'Το πιο πρόσφατο σημείο επαναφοράς είναι παλιό. Στην «Προστασία συστήματος» πάτα «Δημιουργία» πριν από μεγάλες αλλαγές.' 'SystemPropertiesProtection' 26 }
            else { Mark 'ok' $what 'Μπορείς να γυρίσεις τα Windows πίσω αν χαλάσει κάτι. Δεν χρειάζεται τίποτα.' }
        }
    }
} catch { MarkNA 'Σημείο επαναφοράς συστήματος' (Get-Reason $_) 'SystemPropertiesProtection' }

# ======================= the report: summary, top 3, details =======================
$count = @{ ok = 0; warn = 0; bad = 0; na = 0; info = 0 }
foreach ($r in $Results) { $count[$r.Status]++ }
$sumColor = 'Cyan'
if ($count.warn -gt 0) { $sumColor = 'Yellow' }
if ($count.bad -gt 0) { $sumColor = 'Magenta' }

Say ('ΕΛΕΓΧΟΣ ΑΣΦΑΛΕΙΑΣ ΥΠΟΛΟΓΙΣΤΗ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει τίποτα) - {0}' -f $now.ToString('yyyy-MM-dd HH:mm', $inv)) 'Cyan'
Say ('Υπολογιστής: {0} · Χρήστης: {1} · Τρέχει ως διαχειριστής: {2}' -f (Hide-Name $env:COMPUTERNAME), (Hide-Name $env:USERNAME), $(if ($isAdmin) { 'ναι' } else { 'όχι' }))
Say ('Έκδοση κώδικα: {0}' -f (Split-Path -Leaf $repo))
Say ''
Say ('Σύνοψη: {0} {1} · {2} {3} · {4} {5} · {6} {7}' -f $Labels.ok, $count.ok, $Labels.warn, $count.warn, $Labels.bad, $count.bad, $Labels.na, $count.na) $sumColor
Say ('        και {0}: {1} (χωρίς βαθμό)' -f $Labels.info, $count.info)
Say ''
$rank = @{ bad = 0; warn = 1 }
$todo = @($Results | Where-Object { $_.Status -eq 'bad' -or $_.Status -eq 'warn' } | Sort-Object @{ Expression = { $rank[$_.Status] } }, @{ Expression = { $_.Weight } }, @{ Expression = { $_.Order } } | Select-Object -First 3)
Say 'Τα 3 πρώτα για διόρθωση:' 'Cyan'
if ($todo.Count -eq 0) { Say ('  Τίποτα για διόρθωση: {0}' -f $Labels.ok) 'Cyan' }
$i = 1
foreach ($t in $todo) {
    Say ('  {0}. {1} | {2}' -f $i, $Labels[$t.Status], $t.What) $Colors[$t.Status]
    Say ('     ' + $t.Advice)
    if ($t.Link) { Say ('     Άνοιξε: ' + $t.Link) }
    $i++
}
Say ''
Say 'Για κάθε «Άνοιξε:» πάτα Windows+R, επικόλλησε ό,τι γράφει μετά το «Άνοιξε:» και πάτα Enter.'
$needAdmin = @($Results | Where-Object { $_.Status -eq 'na' -and $_.Why -eq 'admin' }).Count
if (-not $isAdmin -and $needAdmin -gt 0) {
    Say ('Έλεγχοι με «χρειάζεται διαχειριστή»: {0}. Τα Windows τους δείχνουν μόνο σε PowerShell ως διαχειριστής. Δεν είναι απαραίτητο· για πλήρη έλεγχο ζήτησε από το Claude την ίδια εντολή ως διαχειριστής.' -f $needAdmin)
}
foreach ($s in $Sections) {
    Say ''
    Say $s 'Cyan'
    foreach ($r in @($Results | Where-Object { $_.Section -eq $s })) {
        Say ('  {0} | {1}' -f $Labels[$r.Status], $r.What) $Colors[$r.Status]
        foreach ($d in @($r.Details)) { if ($d) { Say ('      ' + $d) } }
        Say ('      ' + $r.Advice)
        if ($r.Link) { Say ('      Άνοιξε: ' + $r.Link) }
    }
}
Say ''
Say 'Τι ΔΕΝ έκανε αυτό το εργαλείο: δεν άλλαξε καμία ρύθμιση, δεν ξεκίνησε σάρωση και δεν έψαξε online για ενημερώσεις. Από τα αρχεία με μυστικά διάβασε μόνο την αρχή τους (έως 4 KB), μόνο για να ξεχωρίσει κρυπτογραφημένο από απλό κείμενο, και δεν έδειξε, δεν αντέγραψε και δεν έγραψε τίποτα από αυτά (όσα είναι μόνο στο cloud δεν τα άνοιξε καθόλου).'
Say 'Στείλε αυτή την αναφορά στο Claude (Ctrl+V) για το επόμενο βήμα.'

# Write: console (colours), report file (UTF-8 with BOM), clipboard. Everything goes through Hide-Private first.
Write-Host ''
foreach ($o in $Out) {
    $line = Hide-Private $o.t
    if ($o.c) { Write-Host $line -ForegroundColor $o.c } else { Write-Host $line }
}
$text = Hide-Private ((@($Out | ForEach-Object { $_.t })) -join "`r`n")
[void][System.IO.Directory]::CreateDirectory($OutDir)
$file = Join-Path $OutDir ('PC_SECURITY_{0}.txt' -f $stamp)
$n = 2
while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('PC_SECURITY_{0}_{1}.txt' -f $stamp, $n); $n++ }
[System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
$copied = $false
if (-not $NoClipboard) { try { Set-Clipboard -Value $text; $copied = $true } catch { $copied = $false } }
Write-Host ''
Write-Host (Hide-Private ('Η αναφορά γράφτηκε: {0}' -f $file))
if ($copied) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Cyan }
exit 0
