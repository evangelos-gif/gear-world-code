<#
.SYNOPSIS
  Gear World - gets another PC ready from the backup drive, so the project runs there.

.DESCRIPTION
  Without -Apply: READ-ONLY. Finds the backup drive by itself (any drive letter with \GearWorldBackup\README-RESTORE.txt)
  and shows what would be copied to this PC and what is still missing here (Node.js, Cloudflare sign-in, Awin key).

  With -Apply and the approval phrase ΕΓΚΡΙΝΩ NEW PC (it shows the plan first, then asks):
    1. Copies the Gear World folders from the drive to your user folder (C:\Users\<name>\) and the Awin feeds to
       Downloads. Only ADDS: a file that is newer on this PC is never overwritten and nothing is deleted.
       gear-world-secrets is NOT copied: the Awin key is locked to the old PC's Windows user, so the first Awin tool
       asks for it once here. Old backup folders (GearWorld_Backups ...) stay on the drive unless -WithArchives:
       they are not needed to work and are the biggest part.
    2. Installs Node.js (LTS) with winget if it is missing (Windows asks you to allow it).
    3. npm install in every copied project with a package.json and no node_modules (they are not in the backup).
    4. Cloudflare sign-in (npx wrangler login opens the browser) if this PC is not signed in yet.
  No site, database, Worker or GitHub change. The drive is only read.

  On the drive, GEAR-WORLD-NEW-PC.cmd (written by gw-backup) runs this with one double-click.
  Report: <home>\gear-world-reports\GW_NEW_PC_<time>.txt (also copied to the clipboard)
#>
param(
    [string]$Source = '',
    [switch]$Apply,
    [string]$Approve = '',
    [switch]$SkipNode,
    [switch]$SkipNpm,
    [switch]$SkipLogin,
    [switch]$WithArchives,
    [string]$HomeDir = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
if (-not $HomeDir) { $HomeDir = $HOME }
if (-not $OutDir) { $OutDir = Join-Path $HomeDir 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
# Not copied: the Awin key only opens for the Windows user that saved it (DPAPI); the backup's own work folder.
$NoCopy = @('gear-world-secrets', 'gear-world-backup-work')
$SkipDirs = @('node_modules', '.wrangler', '.cache', '.npm')

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}
function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('GW_NEW_PC_{0}.txt' -f $stamp)
    $text = $L -join "`r`n"
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
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
function Confirm-Approval([string]$phrase) {
    $typed = $Approve
    if (-not $typed) {
        Write-Host ''
        Write-Host ('Για να συνεχίσω, γράψε ακριβώς: {0}' -f $phrase) -ForegroundColor Yellow
        Write-Host '(ή πάτα Enter για να σταματήσω χωρίς αλλαγές)'
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
}
function Format-Size([double]$b) {
    if ($b -ge 1GB) { return ('{0:N1} GB' -f ($b / 1GB)) }
    if ($b -ge 1MB) { return ('{0:N0} MB' -f ($b / 1MB)) }
    return ('{0:N0} KB' -f ($b / 1KB))
}
# Size of a folder on the drive, and how much of it would really be copied to $dst (missing or older there).
function Get-FolderSize([string]$dir, [string]$dst = '') {
    $total = [double]0; $count = 0; $copy = [double]0; $copyFiles = 0
    $stack = New-Object System.Collections.Stack
    $stack.Push($dir)
    while ($stack.Count -gt 0) {
        $d = $stack.Pop()
        try {
            foreach ($f in [System.IO.Directory]::GetFiles($d)) {
                try {
                    $fi = New-Object System.IO.FileInfo($f)
                    $total += $fi.Length; $count++
                    $todo = $true
                    if ($dst) {
                        $there = New-Object System.IO.FileInfo($dst + $f.Substring($dir.Length))
                        if ($there.Exists -and $there.LastWriteTimeUtc -ge $fi.LastWriteTimeUtc.AddSeconds(-2)) { $todo = $false }
                    }
                    if ($todo) { $copy += $fi.Length; $copyFiles++ }
                } catch { }
            }
            foreach ($s in [System.IO.Directory]::GetDirectories($d)) {
                if ($SkipDirs -contains [System.IO.Path]::GetFileName($s)) { continue }
                if (([System.IO.File]::GetAttributes($s) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
                $stack.Push($s)
            }
        } catch { }
    }
    return @{ bytes = $total; files = $count; copy = $copy; copyFiles = $copyFiles }
}
# Runs a command line through a temporary .cmd file and reads its output as UTF-8 (lessons L58).
function Invoke-Cmd([string]$Folder, [string]$Line) {
    if ($Line -match '[&|<>^%]') { throw 'Unsafe characters in the command' }
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-newpc-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call {0} 2>&1' -f $Line))
    [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
    $oldEnc = $null
    try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
    try {
        $out = @(& $cmdFile)
        $code = $LASTEXITCODE
    } finally {
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } }
    }
    $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
    return @{ code = $code; text = $text }
}
# 'yes', 'no' or 'unknown' for the Cloudflare sign-in on this PC (read-only: wrangler whoami).
function Get-CloudflareLogin {
    $r = Invoke-Cmd $HomeDir 'npx --yes wrangler whoami'
    if ($r.text -match '(?i)not authenticated|wrangler login|not logged in') { return 'no' }
    if ($r.code -eq 0 -and $r.text -match '(?i)logged in|associated with the email') { return 'yes' }
    return 'unknown'
}
function Get-NodeVersion {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return '' }
    try { return ([string](& node --version 2>$null)).Trim() } catch { return '' }
}

Write-Host ''
$mode = 'ΔΟΚΙΜΗ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει τίποτα)'
if ($Apply) { $mode = 'ΕΤΟΙΜΑΣΙΑ ΥΠΟΛΟΓΙΣΤΗ (με έγκριση)' }
Say ('Gear World σε νέο υπολογιστή - {0}' -f $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
Say ('Υπολογιστής: {0}, χρήστης {1}, φάκελος χρήστη {2}' -f $env:COMPUTERNAME, $env:USERNAME, $HomeDir)

# 1. The backup drive (found by itself).
if ($Source) {
    $Source = [System.IO.Path]::GetFullPath($Source).TrimEnd('\', '/')
    if (-not (Test-Path -LiteralPath (Join-Path $Source 'README-RESTORE.txt'))) {
        Say ('Δεν βρίσκω backup του Gear World στο {0}. Δεν άλλαξε τίποτα.' -f $Source) 'Red'
        Finish 2
    }
} else {
    $found = @()
    foreach ($drv in [System.IO.DriveInfo]::GetDrives()) {
        $ready = $false
        try { $ready = $drv.IsReady } catch { }
        if (-not $ready) { continue }
        $p = Join-Path $drv.RootDirectory.FullName 'GearWorldBackup'
        if (Test-Path -LiteralPath (Join-Path $p 'README-RESTORE.txt')) { $found += $p }
    }
    if ($found.Count -eq 0) {
        Say 'Δεν βρίσκω τον δίσκο του backup (φάκελος GearWorldBackup). Σύνδεσε τον εξωτερικό δίσκο και ξανατρέξε. Δεν άλλαξε τίποτα.' 'Red'
        Finish 2
    }
    $Source = @($found | Sort-Object { (Get-Item -LiteralPath (Join-Path $_ 'README-RESTORE.txt')).LastWriteTime } -Descending)[0]
}
$lastRun = (Get-Item -LiteralPath (Join-Path $Source 'README-RESTORE.txt')).LastWriteTime
$age = [int]((Get-Date) - $lastRun).TotalDays
Say ('Backup: {0} (τελευταίο backup {1}, πριν από {2} μέρες)' -f $Source, $lastRun.ToString('yyyy-MM-dd HH:mm'), $age)
if ($age -gt 7) { Say '  ΠΡΟΣΟΧΗ: το backup είναι παλιό. Αν ο παλιός υπολογιστής δουλεύει, κάνε πρώτα νέο backup εκεί.' 'Yellow' }
$srcFormat = ''
try { $srcFormat = [string](New-Object System.IO.DriveInfo((Split-Path -Qualifier $Source))).DriveFormat } catch { }

# 2. What would be copied to this PC.
$filesDir = Join-Path $Source 'files'
$copies = @()
$archives = @()
foreach ($d in @(Get-ChildItem -LiteralPath $filesDir -Directory -Force -ErrorAction SilentlyContinue | Sort-Object Name)) {
    if ($d.Name -eq 'Downloads' -or $NoCopy -contains $d.Name) { continue }
    if ($d.Name -match '(?i)backup' -and -not $WithArchives) { $archives += $d.Name; continue }
    $copies += @{ name = $d.Name; src = $d.FullName; dst = (Join-Path $HomeDir $d.Name) }
}
$dl = Join-Path $filesDir 'Downloads'
if (Test-Path -LiteralPath $dl) { $copies += @{ name = 'Downloads'; src = $dl; dst = (Join-Path $HomeDir 'Downloads') } }
Say ''
Say '== Αρχεία από τον δίσκο προς αυτόν τον υπολογιστή =='
$need = [double]0
$projects = @()
foreach ($c in $copies) {
    if (Test-Path -LiteralPath $c.dst) {
        $s = Get-FolderSize $c.src $c.dst
        $here = $(if ($s.copyFiles -gt 0) { 'υπάρχει εδώ, θα αντιγραφούν {0} αρχεία ({1}) που λείπουν ή είναι παλιότερα' -f $s.copyFiles, (Format-Size $s.copy) } else { 'υπάρχει εδώ, ίδιο: τίποτα να αντιγραφεί' })
    } else {
        $s = Get-FolderSize $c.src
        $here = 'νέο'
    }
    $need += $s.copy
    Say ('  {0,-40} {1,10}  {2} αρχεία, {3}' -f $c.name, (Format-Size $s.bytes), $s.files, $here)
    if ($c.name -ne 'Downloads' -and (Test-Path -LiteralPath (Join-Path $c.src 'package.json')) -and -not (Test-Path -LiteralPath (Join-Path $c.dst 'node_modules'))) { $projects += $c.name }
}
if ($copies.Count -eq 0) { Say '  Το backup δεν έχει φακέλους (files\ άδειο).' 'Yellow' }
Say '  Δεν αντιγράφεται: gear-world-secrets (το κλειδί του Awin ανοίγει μόνο στον παλιό υπολογιστή· εδώ θα σου ζητηθεί μία φορά).'
if ($archives.Count -gt 0) { Say ('  Μένουν στον δίσκο (παλιά αντίγραφα, δεν χρειάζονται για δουλειά): {0}. Με -WithArchives αντιγράφονται κι αυτά.' -f ($archives -join ', ')) }
$sysQual = Split-Path -Qualifier $HomeDir
$free = [double](New-Object System.IO.DriveInfo($sysQual)).AvailableFreeSpace
$fits = $need -lt ($free * 0.9)
Say ('  Θα αντιγραφούν {0}, ελεύθερα στον {1} {2}.' -f (Format-Size $need), $sysQual, (Format-Size $free))
if (-not $fits) { Say '  ΠΡΟΒΛΗΜΑ: δεν χωράει σε αυτόν τον υπολογιστή.' 'Red' }

# 3. What this PC still needs.
Say ''
Say '== Τι χρειάζεται αυτός ο υπολογιστής =='
$nodeVer = Get-NodeVersion
$winget = [bool](Get-Command winget -ErrorAction SilentlyContinue)
if ($nodeVer) { Say ('  ΕΝΤΑΞΕΙ: Node.js {0}' -f $nodeVer) }
elseif ($winget) { Say '  ΠΡΟΣΟΧΗ: δεν υπάρχει Node.js. Με -Apply εγκαθίσταται με winget (τα Windows θα ζητήσουν άδεια).' 'Yellow' }
else { Say '  ΠΡΟΒΛΗΜΑ: δεν υπάρχει Node.js ούτε winget. Εγκατάστησε το Node.js (LTS) από https://nodejs.org και ξανατρέξε.' 'Red' }
$login = 'unknown'
if ($nodeVer) {
    $login = Get-CloudflareLogin
    if ($login -eq 'yes') { Say '  ΕΝΤΑΞΕΙ: σύνδεση στο Cloudflare' }
    else { Say '  ΠΡΟΣΟΧΗ: δεν είσαι συνδεδεμένος στο Cloudflare εδώ. Με -Apply ανοίγει ο browser για σύνδεση.' 'Yellow' }
} else { Say '  Σύνδεση στο Cloudflare: μετά το Node.js.' }
if ($projects.Count -gt 0) { Say ('  npm install (τα node_modules δεν είναι στο backup): {0}' -f ($projects -join ', ')) }
$keyHere = Test-Path -LiteralPath (Join-Path (Join-Path $HomeDir 'gear-world-secrets') 'awin-feed-key.dat')
if ($keyHere) { Say '  ΕΝΤΑΞΕΙ: κλειδί Awin σε αυτόν τον υπολογιστή' }
else { Say '  Κλειδί Awin: θα σου ζητηθεί μία φορά, την πρώτη φορά που θα τρέξει εργαλείο του Awin.' }

Say ''
Say 'Τι θα γίνει με -Apply:'
Say '  - Αντιγραφή από τον δίσκο: μόνο προσθήκη. Αρχείο νεότερο σε αυτόν τον υπολογιστή δεν αλλάζει, τίποτα δεν σβήνεται.'
Say '  - Node.js (αν λείπει), npm install στα έργα, σύνδεση στο Cloudflare (αν λείπει).'
Say '  - Ο δίσκος μόνο διαβάζεται. Καμία αλλαγή σε site, βάση, Worker ή GitHub.'
$phrase = 'ΕΓΚΡΙΝΩ NEW PC'
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Say ('Η φράση έγκρισης: {0}' -f $phrase); Finish 0 }
if (-not $fits) { Finish 3 }
if (-not (Confirm-Approval $phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

$problems = 0
# 4. Copy (robocopy: /XO never replaces a newer file on this PC; no /MIR, so nothing is deleted).
Say ''
Say '== Αντιγραφή ==' 'Cyan'
foreach ($c in $copies) {
    if (-not (Test-Path -LiteralPath $c.dst)) { New-Item -ItemType Directory -Path $c.dst -Force | Out-Null }
    $a = @($c.src, $c.dst, '/E', '/XO', '/XD') + $SkipDirs + @('/R:1', '/W:1', '/XJ', '/NP', '/NFL', '/NDL', '/NJH', '/NJS')
    if ($srcFormat -and $srcFormat -ne 'NTFS') { $a += '/FFT' }
    & robocopy @a | Out-Null
    $rc = $LASTEXITCODE
    if ($rc -ge 8) { $problems++; Say ('  ΠΡΟΒΛΗΜΑ στο {0} (robocopy {1})' -f $c.name, $rc) 'Red' }
    else { Say ('  OK  {0}' -f $c.dst) }
}

# 5. Node.js.
if (-not $nodeVer -and -not $SkipNode) {
    Say ''
    Say '== Node.js ==' 'Cyan'
    if ($winget) {
        Say '  Εγκαθιστώ το Node.js (LTS) με winget. Αν τα Windows ρωτήσουν, πάτα Ναι.'
        & winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
        $nodeVer = Get-NodeVersion
    }
    if ($nodeVer) { Say ('  OK  Node.js {0}' -f $nodeVer) }
    else { $problems++; Say '  ΠΡΟΒΛΗΜΑ: το Node.js δεν βρέθηκε. Κλείσε το PowerShell, άνοιξέ το ξανά και ξανατρέξε την ίδια εντολή (ή εγκατάστησέ το από https://nodejs.org).' 'Red' }
}

# 6. npm install where node_modules is missing.
if ($nodeVer -and -not $SkipNpm -and $projects.Count -gt 0) {
    Say ''
    Say '== npm install ==' 'Cyan'
    foreach ($p in $projects) {
        $dir = Join-Path $HomeDir $p
        if (Test-Path -LiteralPath (Join-Path $dir 'node_modules')) { Say ('  OK  {0} (υπάρχει ήδη)' -f $p); continue }
        Say ('  {0}: εγκατάσταση (1-2 λεπτά)...' -f $p)
        $r = Invoke-Cmd $dir 'npm install --no-audit --no-fund'
        if ($r.code -ne 0) { $problems++; Say ('  ΠΡΟΒΛΗΜΑ: npm install στο {0} (κωδικός {1})' -f $p, $r.code) 'Red' }
        else { Say ('  OK  {0}' -f $p) }
    }
}

# 7. Cloudflare sign-in (opens the browser).
if ($nodeVer -and -not $SkipLogin) {
    if ($login -ne 'yes') { $login = Get-CloudflareLogin }
    if ($login -ne 'yes') {
        Say ''
        Say '== Σύνδεση στο Cloudflare ==' 'Cyan'
        Say '  Ανοίγει ο browser: συνδέσου στο Cloudflare και πάτα Allow. Μετά γύρνα εδώ.'
        Push-Location -LiteralPath $HomeDir
        try { & cmd.exe /c 'npx --yes wrangler login' } finally { Pop-Location }
        $login = Get-CloudflareLogin
        if ($login -eq 'yes') { Say '  OK  συνδέθηκες στο Cloudflare' }
        else { $problems++; Say '  ΠΡΟΒΛΗΜΑ: η σύνδεση στο Cloudflare δεν ολοκληρώθηκε. Ξανατρέξε την ίδια εντολή.' 'Red' }
    }
}

Say ''
if ($problems -gt 0) {
    Say ('ΤΕΛΟΣ ΜΕ {0} ΠΡΟΒΛΗΜΑΤΑ: ό,τι πέρασε έμεινε. Στείλε την αναφορά στο Claude.' -f $problems) 'Yellow'
    Finish 12
}
Say 'ΕΤΟΙΜΟ: αυτός ο υπολογιστής έχει το Gear World. Οι εντολές του Claude δουλεύουν εδώ όπως στον παλιό.' 'Green'
if (-not $keyHere) { Say 'Το κλειδί του Awin θα σου ζητηθεί μία φορά, την πρώτη φορά που θα τρέξει εργαλείο του Awin.' }
Finish 0
