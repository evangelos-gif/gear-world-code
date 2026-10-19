<#
.SYNOPSIS
  Gear World - site snapshot. READ-ONLY.

.DESCRIPTION
  Collects the code of ONE Gear World site (or the shared import router, -Site ROUTER) into ONE text report,
  so Claude can review it:
    - worker.js (full text), wrangler config (IDs masked), package.json
    - list of files in the site folder and in public/ (names and sizes only)
    - small text files from public/ (robots.txt, _headers, _redirects, manifest ...)
    - optional: D1 table structure and row counts (SELECT only, never writes)
    - optional: the Cloudflare accounts wrangler can see and their D1 databases (whoami, d1 list: read-only)
  -Site ROUTER reads the import router folder (gear-world-import): its code files (.js .mjs .ps1 ...) instead
  of worker.js, without backups, node_modules or data files.
  Hard-coded secrets are masked and reported. Files named .dev.vars / .env are never read.
  It never changes site files, production, or D1.

  Output: <home>\gear-world-reports\GW_SNAPSHOT_<SITE>_<time>.txt  (also copied to the clipboard)

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File gw-site-snapshot.ps1 -Site GGW
#>
[CmdletBinding()]
param(
    [ValidateSet('GWH', 'CGW', 'MGW', 'WGW', 'KGW', 'HGW', 'GGW', 'TGW', 'ROUTER')]
    [string]$Site = 'GGW',
    [string]$Root = $HOME,
    [string]$OutDir = '',
    [switch]$SkipD1,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$ScriptVersion = 'gw-site-snapshot v3'
$RouterCodeExt = @('.js', '.mjs', '.cjs', '.ts', '.ps1', '.psm1', '.py', '.sql', '.json', '.jsonc', '.toml', '.md')
$RouterMaxFiles = 40
$RouterFileLimit = 64KB
$RouterSkipDirs = '(?i)[\\/](node_modules|\.wrangler|\.git|backups?|release-archive|archive|reports?|out|dist|tmp|temp)([\\/]|$)'
$RouterSkipNames = '(?i)(before|\.bak|backup|-old|_old|\.orig|\.min\.)'
$MaxTopEntries = 250
$MaxPublicEntries = 400
$SmallTextLimit = 16KB
$SmallTextExt = @('.txt', '.xml', '.json', '.webmanifest', '.toml', '.jsonc', '')
$NeverRead = @('.dev.vars', '.env', '.env.local', '.env.production')

$FolderBySite = @{
    GWH = 'gear-world-hub'; CGW = 'construction-gear-uk'; MGW = 'mens-gear-world'; WGW = 'womens-gear-world'
    KGW = 'kids-gear-world'; HGW = 'home-gear-world'; GGW = 'garden-gear-world'; TGW = 'technology-gear-world'
    ROUTER = 'gear-world-import'
}

# ---------- helpers ----------

function Read-Text([string]$Path) {
    return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Write-TextBom([string]$Path, [string]$Text) {
    $enc = New-Object System.Text.UTF8Encoding($true)
    [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Get-WranglerName([string]$ConfigPath) {
    $t = Read-Text $ConfigPath
    if ($ConfigPath -like '*.toml') {
        $m = [regex]::Match($t, '(?m)^\s*name\s*=\s*"([^"]+)"')
    } else {
        $m = [regex]::Match($t, '"name"\s*:\s*"([^"]+)"')
    }
    if ($m.Success) { return $m.Groups[1].Value }
    return ''
}

function Get-WranglerConfig([string]$Dir) {
    foreach ($n in @('wrangler.jsonc', 'wrangler.json', 'wrangler.toml')) {
        $p = Join-Path $Dir $n
        if (Test-Path -LiteralPath $p) { return $p }
    }
    return $null
}

function Find-SiteFolder([string]$BaseRoot, [string]$FolderName, [switch]$AnyFolder) {
    $direct = Join-Path $BaseRoot $FolderName
    if (Test-Path -LiteralPath (Join-Path $direct 'worker.js')) { return $direct }
    if ($AnyFolder) {
        foreach ($b in @($BaseRoot, (Join-Path $BaseRoot 'Documents'), (Join-Path $BaseRoot 'Desktop'), (Join-Path $BaseRoot 'OneDrive'))) {
            $p = Join-Path $b $FolderName
            if (Test-Path -LiteralPath $p -PathType Container) { return $p }
        }
    }
    $bases = @($BaseRoot, (Join-Path $BaseRoot 'Documents'), (Join-Path $BaseRoot 'Desktop'), (Join-Path $BaseRoot 'OneDrive'))
    foreach ($b in $bases) {
        if (-not (Test-Path -LiteralPath $b)) { continue }
        foreach ($d in (Get-ChildItem -LiteralPath $b -Directory -ErrorAction SilentlyContinue)) {
            $cfg = Get-WranglerConfig $d.FullName
            if ($cfg -and ((Get-WranglerName $cfg) -eq $FolderName)) { return $d.FullName }
        }
    }
    return $null
}

function Hide-Ids([string]$Text) {
    # Mask UUIDs and 32-hex IDs (database_id, account_id, zone_id ...). Keep the first 4 characters.
    $t = [regex]::Replace($Text, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
    $t = [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{28}\b', '${1}-masked-id')
    return $t
}

$SecretAssign = '(?i)((?:secret|token|api[_-]?key|apikey|password|passwd|private[_-]?key)[A-Za-z0-9_]*["'']?\s*[:=]\s*)(["''`])([^"''`\r\n]{12,})\2'
$SecretPrefix = '(sk_live_|ghp_|github_pat_|AKIA|xox[baprs]-)[A-Za-z0-9_\-]{10,}'
$SecretBlock = '-----BEGIN [A-Z ]*PRIVATE KEY-----'

function Protect-Secrets([string]$Text, [string]$Label, [System.Collections.ArrayList]$Findings) {
    $lines = $Text -split "`r?`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $old = $lines[$i]
        $new = [regex]::Replace($old, $SecretAssign, '${1}${2}***MASKED***${2}')
        $new = [regex]::Replace($new, $SecretPrefix, '${1}***MASKED***')
        if ($new -match $SecretBlock) { $new = '***MASKED PRIVATE KEY LINE***' }
        if ($new -ne $old) {
            [void]$Findings.Add(('{0} line {1}' -f $Label, ($i + 1)))
            $lines[$i] = $new
        }
    }
    return ($lines -join "`r`n")
}

function Format-Size([long]$Bytes) {
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N1} KB' -f ($Bytes / 1KB)) }
    return ('{0} B' -f $Bytes)
}

function Invoke-D1Select([string]$SiteDir, [string]$DbName, [string]$Sql) {
    # Safety: one SELECT statement only, no characters that cmd.exe could interpret.
    if ($Sql -notmatch '^\s*SELECT\s') { throw 'Only SELECT is allowed' }
    if ($Sql -match '[;"&|<>^%]') { throw 'Unsafe character in SQL' }
    if ($Sql -match '(?i)\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|PRAGMA|VACUUM)\b') { throw 'Write keyword in SQL' }
    if ($DbName -notmatch '^[A-Za-z0-9_\-]+$') { throw 'Bad database name' }
    $tmp = [System.IO.Path]::GetTempPath()
    $cmdFile = Join-Path $tmp 'gw-d1-select.cmd'
    $errFile = Join-Path $tmp 'gw-d1-select.err.txt'
    $body = "@echo off`r`ncd /d `"$SiteDir`"`r`ncall npx --yes wrangler d1 execute $DbName --remote --json --command `"$Sql`" 2>`"$errFile`"`r`n"
    [System.IO.File]::WriteAllText($cmdFile, $body, [System.Text.Encoding]::ASCII)
    try {
        $out = @(& $cmdFile)
    } finally {
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    }
    $errText = ''
    if (Test-Path -LiteralPath $errFile) {
        $errText = [System.IO.File]::ReadAllText($errFile)
        Remove-Item -LiteralPath $errFile -ErrorAction SilentlyContinue
    }
    $lines = @($out | ForEach-Object { "$_" })
    $raw = ($lines -join "`n")
    # JSON output starts with a line "[" (pretty printed) or "[{" (compact).
    $first = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*\[\s*(\{.*)?$') { $first = $i; break }
    }
    if ($first -lt 0) { return @{ ok = $false; raw = ($raw + "`n" + $errText) } }
    $jsonText = ($lines[$first..($lines.Count - 1)] -join "`n")
    $end = $jsonText.LastIndexOf(']')
    if ($end -lt 0) { return @{ ok = $false; raw = ($raw + "`n" + $errText) } }
    try {
        $json = $jsonText.Substring(0, $end + 1) | ConvertFrom-Json
        return @{ ok = $true; rows = @($json[0].results); raw = $raw }
    } catch {
        return @{ ok = $false; raw = ($raw + "`n" + $errText) }
    }
}

function Invoke-WranglerRead([string]$Dir, [string]$Arguments) {
    # Read-only commands only. The list is fixed: nothing else can be passed through.
    if (@('whoami', 'd1 list --json') -notcontains $Arguments) { throw 'Not a read-only wrangler command' }
    $tmp = [System.IO.Path]::GetTempPath()
    $cmdFile = Join-Path $tmp 'gw-wrangler-read.cmd'
    $body = "@echo off`r`ncd /d `"$Dir`"`r`nset WRANGLER_SEND_METRICS=false`r`nset FORCE_COLOR=0`r`ncall npx --yes wrangler $Arguments 2>&1`r`n"
    [System.IO.File]::WriteAllText($cmdFile, $body, [System.Text.Encoding]::ASCII)
    try { $out = @(& $cmdFile) } finally { Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue }
    return (@($out | ForEach-Object { "$_" }) -join "`r`n")
}

# ---------- main ----------

if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$folderName = $FolderBySite[$Site]
Write-Host ''
Write-Host ("Gear World snapshot - {0} - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει τίποτα)" -f $Site) -ForegroundColor Cyan

$isRouter = ($Site -eq 'ROUTER')
$siteDir = Find-SiteFolder $Root $folderName -AnyFolder:$isRouter
if (-not $siteDir) {
    Write-Host ("Δεν βρήκα τον φάκελο του {0} ({1}) μέσα στο {2}." -f $Site, $folderName, $Root) -ForegroundColor Red
    Write-Host 'Στείλε στο Claude αυτό το μήνυμα.' -ForegroundColor Red
    exit 2
}
Write-Host ("Φάκελος: {0}" -f $siteDir)

$L = New-Object System.Collections.Generic.List[string]
$findings = New-Object System.Collections.ArrayList
$L.Add('=== GEAR WORLD SITE SNAPSHOT (read-only) ===')
$L.Add(('Site: {0} | Folder: {1} | Time: {2} | {3} | PowerShell {4}' -f $Site, $siteDir, (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $ScriptVersion, $PSVersionTable.PSVersion))

# 1. Top-level files
$L.Add('')
$L.Add('--- SITE FOLDER (top level, names and sizes only) ---')
$top = @(Get-ChildItem -LiteralPath $siteDir -Force -ErrorAction SilentlyContinue | Sort-Object @{ Expression = { -not $_.PSIsContainer } }, Name)
foreach ($it in ($top | Select-Object -First $MaxTopEntries)) {
    if ($it.PSIsContainer) { $L.Add(('[DIR] {0}' -f $it.Name)) }
    else { $L.Add(('{0,-60} {1,10}  {2}' -f $it.Name, (Format-Size $it.Length), $it.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))) }
}
if ($top.Count -gt $MaxTopEntries) { $L.Add(('... and {0} more' -f ($top.Count - $MaxTopEntries))) }

# 2. public/ files
$publicDir = Join-Path $siteDir 'public'
$L.Add('')
$L.Add('--- public/ (recursive, names and sizes only) ---')
$pubFiles = @()
if (Test-Path -LiteralPath $publicDir) {
    $pubFiles = @(Get-ChildItem -LiteralPath $publicDir -Recurse -File -Force -ErrorAction SilentlyContinue | Sort-Object FullName)
    $pubTotal = 0
    foreach ($f in $pubFiles) { $pubTotal += $f.Length }
    $L.Add(('files: {0} | total: {1}' -f $pubFiles.Count, (Format-Size $pubTotal)))
    foreach ($f in ($pubFiles | Select-Object -First $MaxPublicEntries)) {
        $rel = $f.FullName.Substring($publicDir.Length).TrimStart('\', '/').Replace('\', '/')
        $L.Add(('{0,-70} {1,10}' -f $rel, (Format-Size $f.Length)))
    }
    if ($pubFiles.Count -gt $MaxPublicEntries) { $L.Add(('... and {0} more' -f ($pubFiles.Count - $MaxPublicEntries))) }
} else {
    $L.Add('(no public folder)')
}

# 3. Secret-file presence (names only, never read)
$L.Add('')
$L.Add('--- SECRET FILES (presence only, never read) ---')
foreach ($n in $NeverRead) {
    $L.Add(('{0}: {1}' -f $n, $(if (Test-Path -LiteralPath (Join-Path $siteDir $n)) { 'present' } else { 'absent' })))
}

# 4. Config and code files
$cfgPath = Get-WranglerConfig $siteDir
$dbName = ''
$codeFiles = @()
if ($cfgPath) { $codeFiles += $cfgPath }
foreach ($n in @('package.json', 'worker.js')) {
    $p = Join-Path $siteDir $n
    if (Test-Path -LiteralPath $p) { $codeFiles += $p }
}
foreach ($p in $codeFiles) {
    $name = Split-Path $p -Leaf
    $text = Read-Text $p
    if ($name -like 'wrangler.*') {
        $m = [regex]::Match($text, 'database_name"?\s*[:=]\s*"([^"]+)"')
        if ($m.Success) { $dbName = $m.Groups[1].Value }
        $text = Hide-Ids $text
    }
    $text = Protect-Secrets $text $name $findings
    $hash = (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.Substring(0, 16)
    $L.Add('')
    $L.Add(('--- FILE: {0} ({1}, sha256 {2}) ---' -f $name, (Format-Size (Get-Item -LiteralPath $p).Length), $hash))
    $L.Add($text)
}

# 4b. Router: its code files (newest first), without backups, data files or installed packages
if ($isRouter) {
    $all = @(Get-ChildItem -LiteralPath $siteDir -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object {
        $rel = $_.FullName.Substring($siteDir.Length)
        ($rel -notmatch $RouterSkipDirs) -and ($_.Name -notmatch $RouterSkipNames) -and ($NeverRead -notcontains $_.Name) -and
        ($RouterCodeExt -contains $_.Extension.ToLower()) -and ($_.Name -notlike 'wrangler.*') -and ($_.Name -ne 'package.json') -and
        ($_.Name -ne 'package-lock.json')
    } | Sort-Object LastWriteTime -Descending)
    $L.Add('')
    $L.Add(('--- ROUTER CODE FILES: {0} found, newest {1} up to {2} included ---' -f $all.Count, $RouterMaxFiles, (Format-Size $RouterFileLimit)))
    foreach ($f in $all) {
        $rel = $f.FullName.Substring($siteDir.Length).TrimStart('\', '/').Replace('\', '/')
        $L.Add(('{0,-70} {1,10}  {2}' -f $rel, (Format-Size $f.Length), $f.LastWriteTime.ToString('yyyy-MM-dd HH:mm')))
    }
    $taken = 0
    foreach ($f in $all) {
        if ($taken -ge $RouterMaxFiles) { break }
        if ($f.Length -gt $RouterFileLimit) { continue }
        $rel = $f.FullName.Substring($siteDir.Length).TrimStart('\', '/').Replace('\', '/')
        $text = Protect-Secrets (Read-Text $f.FullName) $rel $findings
        $hash = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.Substring(0, 16)
        $L.Add('')
        $L.Add(('--- FILE: {0} ({1}, sha256 {2}) ---' -f $rel, (Format-Size $f.Length), $hash))
        $L.Add($text)
        $taken++
    }
}

# 5. Small text files from public/
foreach ($f in $pubFiles) {
    $ext = [System.IO.Path]::GetExtension($f.Name).ToLower()
    if ($f.Length -gt $SmallTextLimit) { continue }
    if ($SmallTextExt -notcontains $ext) { continue }
    if ($ext -eq '.xml' -and $f.Name -notmatch '(?i)sitemap|browserconfig') { continue }
    $rel = $f.FullName.Substring($publicDir.Length).TrimStart('\', '/').Replace('\', '/')
    $text = Protect-Secrets (Read-Text $f.FullName) ('public/' + $rel) $findings
    $L.Add('')
    $L.Add(('--- FILE: public/{0} ---' -f $rel))
    $L.Add($text)
}

# 6. D1 structure (SELECT only)
$L.Add('')
$L.Add('--- D1 (read-only SELECT) ---')
if ($SkipD1) {
    $L.Add('skipped (-SkipD1)')
} elseif (-not $dbName) {
    $L.Add('no database_name found in wrangler config')
} else {
    Write-Host ("Διαβάζω τη δομή της D1 '{0}' (μόνο ανάγνωση, SELECT)..." -f $dbName)
    $L.Add(('database_name: {0}' -f $dbName))
    $schemaSql = "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND substr(name,1,7) != 'sqlite_' AND substr(name,1,4) != '_cf_' ORDER BY type DESC, name"
    $r = Invoke-D1Select $siteDir $dbName $schemaSql
    if (-not $r.ok) {
        $L.Add('schema query failed. Output:')
        $raw = $r.raw
        if ($raw.Length -gt 4000) { $raw = $raw.Substring(0, 4000) }
        $L.Add($raw)
    } else {
        # Virtual tables (FTS5) and their shadow tables are not counted: D1 does not allow reading shadow tables.
        $virtual = @()
        foreach ($row in $r.rows) {
            if ($row.type -eq 'table' -and ([string]$row.sql) -match '^\s*CREATE\s+VIRTUAL\s+TABLE') { $virtual += [string]$row.name }
        }
        $tables = @()
        foreach ($row in $r.rows) {
            $L.Add(('-- [{0}] {1}' -f $row.type, $row.name))
            $L.Add([string]$row.sql)
            if ($row.type -ne 'table' -or $row.name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { continue }
            $skip = $false
            foreach ($v in $virtual) { if ($row.name -eq $v -or $row.name.StartsWith($v + '_')) { $skip = $true } }
            if (-not $skip) { $tables += $row.name }
        }
        if ($tables.Count -gt 0) {
            # One row with one column per table: D1 refuses long UNION ALL queries ("too many terms in compound SELECT").
            $counted = @($tables | Select-Object -First 40)
            $parts = @()
            foreach ($t in $counted) { $parts += ('(SELECT COUNT(*) FROM [{0}]) AS [{0}]' -f $t) }
            $c = Invoke-D1Select $siteDir $dbName ('SELECT ' + ($parts -join ', '))
            $L.Add('')
            $L.Add('row counts:')
            if ($c.ok -and @($c.rows).Count -ge 1) { $one = @($c.rows)[0]; foreach ($t in $counted) { $L.Add(('  {0,-40} {1}' -f $t, $one.$t)) } }
            else {
                $L.Add('  count query failed. Output:')
                $raw = $c.raw
                if ($raw.Length -gt 1500) { $raw = $raw.Substring(0, 1500) }
                $L.Add($raw)
            }
        }
    }
}

# 6b. Cloudflare accounts and D1 databases wrangler can see (read-only: whoami, d1 list)
$L.Add('')
$L.Add('--- CLOUDFLARE ACCOUNTS AND D1 DATABASES (read-only) ---')
if ($SkipD1) {
    $L.Add('skipped (-SkipD1)')
} else {
    Write-Host 'Διαβάζω ποιους λογαριασμούς Cloudflare και ποιες D1 βλέπει το wrangler (μόνο ανάγνωση)...'
    $who = Invoke-WranglerRead $siteDir 'whoami'
    $L.Add('whoami:')
    $L.Add($who)
    $dl = Invoke-WranglerRead $siteDir 'd1 list --json'
    $L.Add('')
    $L.Add('d1 list:')
    if ($dl.Length -gt 8000) { $dl = $dl.Substring(0, 8000) + ' ...' }
    $L.Add($dl)
}

# 7. Findings summary
$L.Add('')
$L.Add('--- SECRET CHECK ---')
if ($findings.Count -eq 0) { $L.Add('no hard-coded secrets found') }
else {
    $L.Add(('masked {0} suspicious line(s):' -f $findings.Count))
    foreach ($x in $findings) { $L.Add('  ' + $x) }
}
$L.Add('')
$L.Add('=== END OF SNAPSHOT ===')

# ---------- write report ----------
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$outFile = Join-Path $OutDir ('GW_SNAPSHOT_{0}_{1}.txt' -f $Site, (Get-Date -Format 'yyyyMMdd_HHmmss'))
# Every line is masked again here, including wrangler error output (it can print account and database IDs).
$report = Hide-Ids ($L -join "`r`n")
Write-TextBom $outFile $report

$copied = $false
if (-not $NoClipboard) {
    try { Set-Clipboard -Value $report; $copied = $true } catch { $copied = $false }
}

Write-Host ''
Write-Host ('OK - Η αναφορά γράφτηκε: {0}' -f $outFile) -ForegroundColor Green
Write-Host ('Μέγεθος: {0} | Ύποπτα μυστικά που κρύφτηκαν: {1}' -f (Format-Size $report.Length), $findings.Count)
if ($copied) {
    Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green
}
exit 0
