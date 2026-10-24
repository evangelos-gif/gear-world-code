<#
.SYNOPSIS
  Gear World - full backup of everything on this PC, the GitHub code and the site databases, to an external drive.

.DESCRIPTION
  Without -Apply: READ-ONLY. Shows what WOULD be copied (folders, feeds, GitHub branches, databases), how big it is
  and whether it fits on the drive. Writes nothing to the drive.

  With -Apply and the approval phrase (ΕΓΚΡΙΝΩ BACKUP <drive letter>, e.g. ΕΓΚΡΙΝΩ BACKUP D) it writes to
  <drive>:\GearWorldBackup\ :
    files\     the Gear World folders in your user folder (gear-world-hub, construction-gear-uk, mens-gear-world ...,
               *-engine, car-gear-world, gear-world-import, gear-world-reports ...) and the Awin feeds in Downloads
               (GW_AWIN_BULK_ARCHIVE and <advertiserId>-*.csv.gz). node_modules and .wrangler are skipped (they come
               back with npm). Files are only ADDED or UPDATED: nothing on the drive is ever deleted, so a file that
               breaks or disappears on the PC is still on the drive.
    github\    a zip of every branch of evangelos-gif/gear-world-code and of gearworld-media (latest version).
    d1\        every Cloudflare D1 database: schema.sql (tables, indexes, triggers) and the rows of every table as
               JSON pages (D1 cannot export databases with search tables, so the rows are read with SELECT).
               READ-ONLY for Cloudflare: only SELECT.
    README-RESTORE.txt  how to get everything back.
  The site databases are only READ. No site, database, Worker or GitHub change.

  The drive then holds your site settings (.dev.vars, wrangler files) and customer emails (Rewards, Hub sign-ups):
  keep it at home. Run it again any time: it only copies what changed (the databases are read again in full).

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
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
if (-not $HomeDir) { $HomeDir = $HOME }
if (-not $OutDir) { $OutDir = Join-Path $HomeDir 'gear-world-reports' }
if (-not $WorkDir) { $WorkDir = Join-Path $HomeDir 'gear-world-backup-work' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Owner = 'evangelos-gif'
$Repos = @('gear-world-code', 'gearworld-media')
$SkipDirs = @('node_modules', '.wrangler', '.cache', '.npm')

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}
function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('GW_BACKUP_{0}.txt' -f $stamp)
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
# Size of a folder without node_modules and the other skipped folders.
function Get-FolderSize([string]$dir) {
    $total = [double]0; $count = 0
    $stack = New-Object System.Collections.Stack
    $stack.Push($dir)
    while ($stack.Count -gt 0) {
        $d = $stack.Pop()
        try {
            foreach ($f in [System.IO.Directory]::GetFiles($d)) { try { $total += (New-Object System.IO.FileInfo($f)).Length; $count++ } catch { } }
            foreach ($s in [System.IO.Directory]::GetDirectories($d)) {
                $name = [System.IO.Path]::GetFileName($s)
                if ($SkipDirs -contains $name) { continue }
                $attr = [System.IO.File]::GetAttributes($s)
                if (($attr -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
                $stack.Push($s)
            }
        } catch { }
    }
    return @{ bytes = $total; files = $count }
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
function Invoke-Wrangler([string]$Folder, [string]$Arguments) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tmp = [System.IO.Path]::GetTempPath()
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
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
        $network = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up'
        if ($code -eq 0 -or -not $network -or $try -eq 3) { break }
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}
function Get-JsonText([string]$text) {
    $i = $text.IndexOf('[')
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

Write-Host ''
$mode = 'ΔΟΚΙΜΗ - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν γράφει τίποτα στον δίσκο)'
if ($Apply) { $mode = 'ΑΝΤΙΓΡΑΦΟ ΑΣΦΑΛΕΙΑΣ (με έγκριση)' }
Say ('Gear World backup - {0}' -f $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))

# 1. The drive.
$qual = Split-Path -Qualifier $Target
$letter = $qual.TrimEnd(':').ToUpper()
$sysLetter = ([string]$env:SystemDrive).TrimEnd(':').ToUpper()
if (-not (Test-Path -LiteralPath ($qual + '\'))) {
    Say ('Δεν βρίσκω τον δίσκο {0}:. Σύνδεσε τον εξωτερικό δίσκο και ξανατρέξε την εντολή. Δεν άλλαξε τίποτα.' -f $letter) 'Red'
    Finish 2
}
if ($letter -eq $sysLetter -and -not $AllowSystemDrive) {
    Say ('Ο {0}: είναι ο δίσκος των Windows, όχι εξωτερικός. Δεν άλλαξε τίποτα.' -f $letter) 'Red'
    Finish 2
}
$di = New-Object System.IO.DriveInfo($letter)
$label = ''
try { $label = $di.VolumeLabel } catch { }
$free = [double]$di.AvailableFreeSpace
Say ('Δίσκος {0}: "{1}" ({2}), ελεύθερα {3} από {4}' -f $letter, $label, $di.DriveType, (Format-Size $free), (Format-Size ([double]$di.TotalSize)))
Say ('Φάκελος αντιγράφου: {0}' -f $Target)

# 2. What would be copied from this PC.
$copies = @()
$namePattern = '^(gear-world|gearworld|construction-gear|constraction-gear|mens-gear|womens-gear|kids-gear|home-gear|garden-gear|technology-gear|car-gear|travel-gear|gaming-gear)'
foreach ($d in @(Get-ChildItem -LiteralPath $HomeDir -Directory -Force -ErrorAction SilentlyContinue | Sort-Object Name)) {
    if ($d.Name -notmatch $namePattern) { continue }
    if ($d.FullName -eq $WorkDir) { continue }
    $copies += @{ src = $d.FullName; dst = (Join-Path (Join-Path $Target 'files') $d.Name); kind = 'folder'; files = @() }
}
$downloads = Join-Path $HomeDir 'Downloads'
if (-not $SkipFeeds) {
    $arch = Join-Path $downloads 'GW_AWIN_BULK_ARCHIVE'
    if (Test-Path -LiteralPath $arch) { $copies += @{ src = $arch; dst = (Join-Path (Join-Path (Join-Path $Target 'files') 'Downloads') 'GW_AWIN_BULK_ARCHIVE'); kind = 'feeds'; files = @() } }
    $loose = @(Get-ChildItem -LiteralPath $downloads -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^\d+-.+\.csv(\.gz)?$' } | ForEach-Object { $_.Name })
    if ($loose.Count -gt 0) { $copies += @{ src = $downloads; dst = (Join-Path (Join-Path $Target 'files') 'Downloads'); kind = 'loose feeds'; files = $loose } }
}
$need = [double]0
Say ''
Say '== Από αυτόν τον υπολογιστή =='
if ($copies.Count -eq 0) { Say '  Δεν βρέθηκαν φάκελοι του Gear World.' 'Yellow' }
foreach ($c in $copies) {
    if ($c.files.Count -gt 0) {
        $b = [double]0
        foreach ($n in $c.files) { $b += (Get-Item -LiteralPath (Join-Path $c.src $n)).Length }
        $c.bytes = $b
        Say ('  {0,-40} {1,10}  ({2} feeds στα Downloads)' -f 'Downloads\<id>-*.csv.gz', (Format-Size $b), $c.files.Count)
    } else {
        $s = Get-FolderSize $c.src
        $c.bytes = $s.bytes
        Say ('  {0,-40} {1,10}  ({2} αρχεία)' -f ($c.src.Substring($HomeDir.Length).TrimStart('\', '/')), (Format-Size $s.bytes), $s.files)
    }
    $need += $c.bytes
}
Say ('  Σύνολο: {0} (χωρίς node_modules και .wrangler). Μόνο όσα άλλαξαν αντιγράφονται ξανά.' -f (Format-Size $need))

# 3. GitHub (public repos, read-only).
$branches = @{}
if (-not $SkipGitHub) {
    Say ''
    Say '== GitHub (μόνο ανάγνωση) =='
    foreach ($r in $Repos) {
        try {
            $list = @(Invoke-RestMethod -UseBasicParsing -Uri ('https://api.github.com/repos/{0}/{1}/branches?per_page=100' -f $Owner, $r) -Headers @{ 'User-Agent' = 'gear-world-backup' })
            $branches[$r] = $list
            Say ('  {0}: {1} κλάδοι' -f $r, $list.Count)
        } catch {
            Say ('  {0}: δεν μπόρεσα να διαβάσω τους κλάδους ({1})' -f $r, $_.Exception.Message) 'Yellow'
        }
    }
}

# 4. Databases (read-only list).
$dbs = @()
if (-not $SkipDatabases) {
    Say ''
    Say '== Βάσεις Cloudflare D1 (μόνο ανάγνωση) =='
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Say '  Δεν βρέθηκε το Node.js: οι βάσεις παραλείπονται.' 'Yellow'
    } else {
        if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
        $r = Invoke-Wrangler $WorkDir 'd1 list --json'
        $j = Get-JsonText $r.text
        if ($r.code -ne 0 -or -not $j) {
            Say '  Δεν μπόρεσα να διαβάσω τις βάσεις (σύνδεση στο Cloudflare;). Οι βάσεις παραλείπονται.' 'Yellow'
        } else {
            foreach ($x in @($j | ConvertFrom-Json)) { if ($x.name -match '^[a-z0-9\-]{2,60}$') { $dbs += [string]$x.name } }
            Say ('  {0} βάσεις: {1}' -f $dbs.Count, ($dbs -join ', '))
            Say '  Οι γραμμές τους διαβάζονται με SELECT (λίγα λεπτά για τις μεγάλες).'
        }
    }
}

Say ''
$fits = $need -lt ($free * 0.95)
if (-not $fits) { Say ('ΔΕΝ χωράει: χρειάζονται περίπου {0}, ο δίσκος έχει {1} ελεύθερα.' -f (Format-Size $need), (Format-Size $free)) 'Red' }
Say 'Τι θα γίνει με -Apply:'
Say ('  - Αντιγραφή στο {0}: μόνο προσθήκη ή ενημέρωση αρχείων, τίποτα δεν σβήνεται στον δίσκο.' -f $Target)
Say '  - Zip κάθε κλάδου του GitHub, και αντίγραφο κάθε βάσης D1 (μόνο ανάγνωση, με SELECT).'
Say '  - Καμία αλλαγή σε site, βάση, Worker ή GitHub.'
Say '  - Ο δίσκος θα έχει ρυθμίσεις των sites και emails πελατών: φύλαξέ τον στο σπίτι.'
$phrase = 'ΕΓΚΡΙΝΩ BACKUP {0}' -f $letter
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν γράφτηκε τίποτα στον δίσκο.' 'Green'; Say ('Η φράση έγκρισης: {0}' -f $phrase); Finish 0 }
if (-not $fits) { Finish 3 }
if (-not (Confirm-Approval $phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

$problems = 0
if (-not (Test-Path -LiteralPath $Target)) { New-Item -ItemType Directory -Path $Target -Force | Out-Null }

# 5. Copy (robocopy: only new or changed files; never deletes on the drive).
Say ''
Say '== Αντιγραφή αρχείων ==' 'Cyan'
foreach ($c in $copies) {
    if (-not (Test-Path -LiteralPath $c.dst)) { New-Item -ItemType Directory -Path $c.dst -Force | Out-Null }
    $a = @($c.src, $c.dst)
    if ($c.files.Count -gt 0) { $a += $c.files } else { $a += @('/E', '/XD') + $SkipDirs }
    $a += @('/R:1', '/W:1', '/XJ', '/NP', '/NFL', '/NDL', '/NJH', '/NJS')
    & robocopy @a | Out-Null
    $rc = $LASTEXITCODE
    if ($rc -ge 8) { $problems++; Say ('  ΠΡΟΒΛΗΜΑ στο {0} (robocopy {1})' -f $c.src, $rc) 'Red' }
    else { Say ('  OK  {0}' -f $c.dst) }
}

# 6. GitHub zips.
if (-not $SkipGitHub) {
    Say ''
    Say '== GitHub ==' 'Cyan'
    foreach ($r in $branches.Keys) {
        $dir = Join-Path (Join-Path $Target 'github') $r
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        $manifest = New-Object System.Collections.Generic.List[string]
        foreach ($b in $branches[$r]) {
            $name = [string]$b.name
            $file = Join-Path $dir (($name -replace '[^A-Za-z0-9._-]', '_') + '.zip')
            try {
                Invoke-WebRequest -UseBasicParsing -OutFile $file -Uri ('https://codeload.github.com/{0}/{1}/zip/refs/heads/{2}' -f $Owner, $r, $name)
                $manifest.Add(('{0}  {1}' -f $name, $b.commit.sha))
            } catch {
                $problems++; Say ('  ΠΡΟΒΛΗΜΑ: {0} {1}' -f $r, $name) 'Red'
            }
        }
        [System.IO.File]::WriteAllText((Join-Path $dir 'branches.txt'), (($manifest -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
        Say ('  OK  {0}: {1} κλάδοι' -f $r, $manifest.Count)
    }
}

# 7. Databases: schema + every table as JSON pages (SELECT only).
if ($dbs.Count -gt 0) {
    Say ''
    Say '== Βάσεις D1 ==' 'Cyan'
    foreach ($db in $dbs) {
        $dir = Join-Path (Join-Path $Target 'd1') $db
        if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force }
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $objs = Select-Rows $db "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type DESC, name"
        if ($null -eq $objs) { $problems++; Say ('  ΠΡΟΒΛΗΜΑ: δεν διάβασα το {0}' -f $db) 'Red'; continue }
        $schema = New-Object System.Text.StringBuilder
        $virtual = @()
        foreach ($o in $objs) {
            [void]$schema.AppendLine(([string]$o.sql).Trim() + ';')
            if ([string]$o.sql -match '^\s*CREATE\s+VIRTUAL\s+TABLE') { $virtual += [string]$o.name }
        }
        [System.IO.File]::WriteAllText((Join-Path $dir 'schema.sql'), $schema.ToString(), (New-Object System.Text.UTF8Encoding($false)))
        $rowsTotal = 0; $tables = 0
        foreach ($o in $objs) {
            if ([string]$o.type -ne 'table') { continue }
            $t = [string]$o.name
            if ($t -notmatch '^[A-Za-z_][A-Za-z0-9_]*$' -or $t -like 'sqlite_*' -or $t -like '_cf_*') { continue }
            if ($virtual -contains $t) { continue }
            $shadow = $false
            foreach ($v in $virtual) { if ($t.StartsWith($v + '_')) { $shadow = $true } }
            if ($shadow) { continue } # the search index is rebuilt from the table itself
            $range = Select-Rows $db ("SELECT MIN(rowid) AS a, MAX(rowid) AS b, COUNT(*) AS n FROM {0}" -f $t)
            $page = 0
            if ($null -eq $range) {
                # WITHOUT ROWID table: read it in one go (these are small).
                $x = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --json --command "SELECT * FROM {1}"' -f $db, $t)
                $j = Get-JsonText $x.text
                if ($x.code -ne 0 -or -not $j) { $problems++; Say ('  ΠΡΟΒΛΗΜΑ: {0}.{1}' -f $db, $t) 'Red'; continue }
                [System.IO.File]::WriteAllText((Join-Path $dir ('{0}-0001.json' -f $t)), $j, (New-Object System.Text.UTF8Encoding($false)))
                $tables++
                continue
            }
            $n = [int]$range[0].n
            if ($n -gt 0) {
                $lo = [long]$range[0].a; $hi = [long]$range[0].b
                for ($s = $lo; $s -le $hi; $s += $PageRows) {
                    $page++
                    $e = $s + $PageRows - 1
                    $x = Invoke-Wrangler $WorkDir ('d1 execute {0} --remote --json --command "SELECT rowid AS _rowid, * FROM {1} WHERE rowid BETWEEN {2} AND {3}"' -f $db, $t, $s, $e)
                    $j = Get-JsonText $x.text
                    if ($x.code -ne 0 -or -not $j) { $problems++; Say ('  ΠΡΟΒΛΗΜΑ: {0}.{1} σελίδα {2}' -f $db, $t, $page) 'Red'; continue }
                    [System.IO.File]::WriteAllText((Join-Path $dir ('{0}-{1:D4}.json' -f $t, $page)), $j, (New-Object System.Text.UTF8Encoding($false)))
                }
            }
            $rowsTotal += $n; $tables++
        }
        Say ('  OK  {0}: {1} πίνακες, {2} γραμμές' -f $db, $tables, $rowsTotal)
    }
}

# 8. How to restore.
$readme = @(
    'GEAR WORLD - ΑΝΤΙΓΡΑΦΟ ΑΣΦΑΛΕΙΑΣ / BACKUP',
    ('Τελευταία ενημέρωση / last run: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    '',
    'ΤΙ ΕΧΕΙ ΜΕΣΑ',
    '  files\    οι φάκελοι του Gear World από τον φάκελο χρήστη (C:\Users\<όνομα>\) και τα feeds του Awin (Downloads)',
    '  github\   zip κάθε κλάδου του κώδικα (gear-world-code) και των εικόνων (gearworld-media), branches.txt = commit',
    '  d1\       κάθε βάση των sites: schema.sql (πίνακες) και <πίνακας>-0001.json ... (όλες οι γραμμές)',
    '',
    'ΑΝ ΧΑΛΑΣΕΙ Ο ΥΠΟΛΟΓΙΣΤΗΣ',
    '  1. Σε νέο υπολογιστή: εγκατάστησε Node.js (LTS) από https://nodejs.org',
    '  2. Αντέγραψε τα περιεχόμενα του files\ στον φάκελο χρήστη (C:\Users\<όνομα>\), και το files\Downloads\ στα Downloads.',
    '  3. Στο PowerShell: npx wrangler login (σύνδεση στο Cloudflare ξανά, ο κωδικός δεν αντιγράφεται).',
    '  4. Ο κώδικας είναι και στο GitHub (evangelos-gif/gear-world-code). Τα zip εδώ είναι για την περίπτωση που λείπει.',
    '  5. Οι βάσεις: τα sites ζουν στο Cloudflare και δεν χάνονται με τον υπολογιστή. Το d1\ είναι για την περίπτωση',
    '     που χαλάσει μια βάση: πες στο Claude «επαναφορά βάσης από το backup» και δείξε του αυτόν τον φάκελο.',
    '     Για αλλαγές των τελευταίων 7-30 ημερών υπάρχει και το Cloudflare Time Travel.',
    '',
    'ΠΡΟΣΟΧΗ: εδώ υπάρχουν ρυθμίσεις των sites (.dev.vars, wrangler) και emails πελατών. Φύλαξε τον δίσκο στο σπίτι.'
) -join "`r`n"
[System.IO.File]::WriteAllText((Join-Path $Target 'README-RESTORE.txt'), $readme + "`r`n", (New-Object System.Text.UTF8Encoding($true)))
$logDir = Join-Path $Target 'logs'
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

Say ''
if ($problems -gt 0) {
    Say ('ΤΕΛΟΣ ΜΕ {0} ΠΡΟΒΛΗΜΑΤΑ: τα υπόλοιπα αντιγράφηκαν. Στείλε την αναφορά στο Claude.' -f $problems) 'Yellow'
    [System.IO.File]::WriteAllText((Join-Path $logDir ('GW_BACKUP_{0}.txt' -f $stamp)), ($L -join "`r`n"), (New-Object System.Text.UTF8Encoding($true)))
    Finish 12
}
Say ('ΕΤΟΙΜΟ: όλο το Gear World είναι στο {0}. Οδηγίες επαναφοράς: {1}' -f $Target, (Join-Path $Target 'README-RESTORE.txt')) 'Green'
[System.IO.File]::WriteAllText((Join-Path $logDir ('GW_BACKUP_{0}.txt' -f $stamp)), ($L -join "`r`n"), (New-Object System.Text.UTF8Encoding($true)))
Finish 0
