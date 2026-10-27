<#
.SYNOPSIS
  Gear World Hub - code export. READ-ONLY.

.DESCRIPTION
  Collects the code of the Gear World Hub (gearworldhub.com, Worker gear-world-hub) from this PC into ONE text
  report, so Claude can put it in the gear-world-code repo (sites/gwh) and every later change is kept in GitHub.
    - MANIFEST: every file the Worker deploys (the Worker code and the whole assets folder, usually public/):
      size, SHA-256 of the file on disk, and whether its text is in the report
    - the full text of the Worker code (main file and the files it imports), the wrangler config (IDs masked),
      package.json, and every text file of the assets folder (HTML, CSS, JS, JSON, SVG, _headers ...)
    - images, fonts and other binary files: name, size and SHA-256 only (Claude takes them from the live site
      and checks that they are byte-for-byte the same)
    - files with backup-like names inside the assets folder (they are published too, lesson L04): listed only
    - other files of the hub folder: names and sizes only, never their text (they may hold data or keys)
    - optional: D1 table structure and row counts of the hub database (SELECT only, no rows are read)
  Hard-coded secrets, Cloudflare IDs and personal email addresses are masked and reported.
  Files named .dev.vars / .env are never read. Nothing on the PC, in Cloudflare or in D1 is changed.

  Output: <home>\gear-world-reports\GWH_CODE_EXPORT_<time>.txt  (also copied to the clipboard)

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File gwh-code-export.ps1
#>
[CmdletBinding()]
param(
    [string]$HubDir = '',
    [string]$Root = $HOME,
    [string]$OutDir = '',
    [int]$MaxTextKB = 600,
    [switch]$SkipD1,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$ScriptVersion = 'gwh-code-export v1'
$HubWorker = 'gear-world-hub'
$HubFolderName = 'gear-world-hub'
$MaxImportFiles = 40
$TextExt = @('.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.json', '.jsonc', '.txt', '.xml', '.svg', '.webmanifest', '.map', '.md', '.toml', '.ts')
$TextNames = @('_headers', '_redirects', '_routes.json', '.assetsignore')
$NeverRead = @('.dev.vars', '.env', '.env.local', '.env.production')
$BackupName = '(?i)(before|\.bak|backup|-old|_old|\.orig)'
$SkipDirs = @('node_modules', '.wrangler', '.git', 'backups', 'backup')

# ---------- helpers ----------

$Utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-TextBom([string]$Path, [string]$Text) {
    $enc = New-Object System.Text.UTF8Encoding($true)
    [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Get-Sha256Hex([byte[]]$Bytes) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
}

function Format-Size([long]$Bytes) {
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N1} KB' -f ($Bytes / 1KB)) }
    return ('{0} B' -f $Bytes)
}

function Get-WranglerConfig([string]$Dir) {
    foreach ($n in @('wrangler.jsonc', 'wrangler.json', 'wrangler.toml')) {
        $p = Join-Path $Dir $n
        if (Test-Path -LiteralPath $p) { return $p }
    }
    return $null
}

function Get-WranglerName([string]$ConfigPath) {
    $t = [System.IO.File]::ReadAllText($ConfigPath, [System.Text.Encoding]::UTF8)
    if ($ConfigPath -like '*.toml') {
        $m = [regex]::Match($t, '(?m)^\s*name\s*=\s*"([^"]+)"')
    } else {
        $m = [regex]::Match($t, '"name"\s*:\s*"([^"]+)"')
    }
    if ($m.Success) { return $m.Groups[1].Value }
    return ''
}

function Find-HubFolder([string]$BaseRoot) {
    $direct = Join-Path $BaseRoot $HubFolderName
    $cfg = $null
    if (Test-Path -LiteralPath $direct) { $cfg = Get-WranglerConfig $direct }
    if ($cfg -and ((Get-WranglerName $cfg) -eq $HubWorker)) { return $direct }
    $bases = @($BaseRoot, (Join-Path $BaseRoot 'Documents'), (Join-Path $BaseRoot 'Desktop'), (Join-Path $BaseRoot 'OneDrive'))
    foreach ($b in $bases) {
        if (-not (Test-Path -LiteralPath $b)) { continue }
        foreach ($d in (Get-ChildItem -LiteralPath $b -Directory -ErrorAction SilentlyContinue)) {
            $c = Get-WranglerConfig $d.FullName
            if ($c -and ((Get-WranglerName $c) -eq $HubWorker)) { return $d.FullName }
        }
    }
    return $null
}

function Hide-Ids([string]$Text) {
    # Mask UUIDs and 32-hex IDs (database_id, account_id, zone_id, KV ids ...). Keep the first 4 characters.
    $t = [regex]::Replace($Text, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
    $t = [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{28}\b', '${1}-masked-id')
    return $t
}

$SecretAssign = '(?i)((?:secret|token|api[_-]?key|apikey|password|passwd|private[_-]?key)[A-Za-z0-9_]*["'']?\s*[:=]\s*)(["''`])([^"''`\r\n]{12,})\2'
$SecretPrefix = '(sk_live_|ghp_|github_pat_|AKIA|xox[baprs]-)[A-Za-z0-9_\-]{10,}'
$SecretBlock = '-----BEGIN [A-Z ]*PRIVATE KEY-----'
$EmailRx = '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}'
$KeepEmailDomain = '(?i)^(gearworldhub\.com|gearworldgroup\.com|[a-z0-9-]*gearworld\.com|example\.(com|org|net|invalid))$'
$NotEmailTld = @('png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico', 'js', 'mjs', 'cjs', 'css', 'json', 'html', 'htm', 'woff', 'woff2', 'map', 'txt', 'xml')

function Protect-EmailsInLine([string]$Line) {
    # Personal addresses are masked. Addresses of the Gear World domains (contact@gearworldhub.com ...) stay.
    $ms = [regex]::Matches($Line, $EmailRx)
    if ($ms.Count -eq 0) { return $Line }
    $sb = New-Object System.Text.StringBuilder
    $pos = 0
    foreach ($m in $ms) {
        $domain = $m.Value.Substring($m.Value.IndexOf('@') + 1)
        $tld = $domain.Substring($domain.LastIndexOf('.') + 1).ToLowerInvariant()
        $keep = ($domain -match $KeepEmailDomain) -or ($NotEmailTld -contains $tld)
        [void]$sb.Append($Line.Substring($pos, $m.Index - $pos))
        if ($keep) { [void]$sb.Append($m.Value) } else { [void]$sb.Append('masked-email@example.invalid') }
        $pos = $m.Index + $m.Length
    }
    [void]$sb.Append($Line.Substring($pos))
    return $sb.ToString()
}

function Protect-Text([string]$Text, [string]$Label) {
    # $Text uses LF line ends. Returns the masked text; findings go to the script lists.
    $lines = $Text.Split("`n")
    for ($i = 0; $i -lt $lines.Length; $i++) {
        $old = $lines[$i]
        $new = [regex]::Replace($old, $SecretAssign, '${1}${2}***MASKED***${2}')
        $new = [regex]::Replace($new, $SecretPrefix, '${1}***MASKED***')
        if ($new -match $SecretBlock) { $new = '***MASKED PRIVATE KEY LINE***' }
        if ($new -ne $old) { [void]$script:SecretHits.Add(('{0} line {1}' -f $Label, ($i + 1))) }
        $e = Protect-EmailsInLine $new
        if ($e -ne $new) { [void]$script:EmailHits.Add(('{0} line {1}' -f $Label, ($i + 1))); $new = $e }
        $d = Hide-Ids $new
        if ($d -ne $new) { [void]$script:IdHits.Add(('{0} line {1}' -f $Label, ($i + 1))); $new = $d }
        $lines[$i] = $new
    }
    return [string]::Join("`n", $lines)
}

function Read-TextStrict([byte[]]$Bytes) {
    # Strict UTF-8: a file with invalid bytes or NUL characters is not treated as text.
    $bom = ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF)
    $start = 0
    if ($bom) { $start = 3 }
    try {
        $t = $Utf8Strict.GetString($Bytes, $start, $Bytes.Length - $start)
    } catch {
        return @{ ok = $false; text = ''; bom = $bom }
    }
    if ($t.IndexOf([char]0) -ge 0) { return @{ ok = $false; text = ''; bom = $bom } }
    return @{ ok = $true; text = $t; bom = $bom }
}

function Get-Eol([string]$t) {
    $crlf = ([regex]::Matches($t, "`r`n")).Count
    $lf = ([regex]::Matches($t, "(?<!`r)`n")).Count
    if ($crlf -eq 0 -and $lf -eq 0) { return 'none' }
    if ($lf -eq 0) { return 'crlf' }
    if ($crlf -eq 0) { return 'lf' }
    return 'mixed'
}

function Get-RelPath([string]$Base, [string]$Full) {
    return $Full.Substring($Base.Length).TrimStart('\', '/').Replace('\', '/')
}

function Test-TextFile([System.IO.FileInfo]$f) {
    if ($TextNames -contains $f.Name) { return $true }
    return ($TextExt -contains $f.Extension.ToLowerInvariant())
}

function Get-RelativeImports([string]$JsText) {
    $list = New-Object System.Collections.Generic.List[string]
    $pats = @(
        '\bfrom\s*["''](\.{1,2}/[^"''\r\n]+)["'']',
        '\bimport\s*["''](\.{1,2}/[^"''\r\n]+)["'']',
        '\bimport\s*\(\s*["''](\.{1,2}/[^"''\r\n]+)["'']\s*\)'
    )
    foreach ($p in $pats) { foreach ($m in [regex]::Matches($JsText, $p)) { $list.Add($m.Groups[1].Value) } }
    return $list
}

function Resolve-Import([string]$FromFile, [string]$Rel) {
    $dir = Split-Path -Parent $FromFile
    $base = [System.IO.Path]::GetFullPath((Join-Path $dir $Rel))
    foreach ($c in @($base, ($base + '.js'), ($base + '.mjs'), (Join-Path $base 'index.js'))) {
        if (Test-Path -LiteralPath $c -PathType Leaf) { return $c }
    }
    return $null
}

function Invoke-D1Select([string]$SiteDir, [string]$DbName, [string]$Sql) {
    # Safety: one SELECT statement only, no characters that cmd.exe could interpret.
    if ($Sql -notmatch '^\s*SELECT\s') { throw 'Only SELECT is allowed' }
    if ($Sql -match '[;"&|<>^%]') { throw 'Unsafe character in SQL' }
    if ($Sql -match '(?i)\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|PRAGMA|VACUUM)\b') { throw 'Write keyword in SQL' }
    if ($DbName -notmatch '^[A-Za-z0-9_\-]+$') { throw 'Bad database name' }
    $tmp = [System.IO.Path]::GetTempPath()
    $cmdFile = Join-Path $tmp 'gwh-export-d1.cmd'
    $errFile = Join-Path $tmp 'gwh-export-d1.err.txt'
    $body = "@echo off`r`ncd /d `"$SiteDir`"`r`nset WRANGLER_SEND_METRICS=false`r`nset FORCE_COLOR=0`r`ncall npx --yes wrangler d1 execute $DbName --remote --json --command `"$Sql`" 2>`"$errFile`"`r`n"
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

# ---------- main ----------

if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$MaxTextBytes = [long]$MaxTextKB * 1024
$script:SecretHits = New-Object System.Collections.ArrayList
$script:EmailHits = New-Object System.Collections.ArrayList
$script:IdHits = New-Object System.Collections.ArrayList

Write-Host ''
Write-Host 'Gear World Hub - εξαγωγή κώδικα - ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν αλλάζει τίποτα)' -ForegroundColor Cyan

if ($HubDir) {
    if (-not (Test-Path -LiteralPath $HubDir -PathType Container)) {
        Write-Host ('Δεν υπάρχει ο φάκελος {0}. Στείλε στο Claude αυτό το μήνυμα.' -f $HubDir) -ForegroundColor Red
        exit 2
    }
    $hubDirFull = (Resolve-Path -LiteralPath $HubDir).ProviderPath
} else {
    $hubDirFull = Find-HubFolder $Root
    if (-not $hubDirFull) {
        Write-Host ('Δεν βρήκα τον φάκελο του Hub ({0}) μέσα στο {1}. Στείλε στο Claude αυτό το μήνυμα.' -f $HubFolderName, $Root) -ForegroundColor Red
        exit 2
    }
}
$hubDirFull = $hubDirFull.TrimEnd('\', '/')
$cfgPath = Get-WranglerConfig $hubDirFull
if (-not $cfgPath -or ((Get-WranglerName $cfgPath) -ne $HubWorker)) {
    Write-Host ('Ο φάκελος {0} δεν είναι ο Worker {1} (λείπει ή διαφέρει το wrangler). ΔΕΝ διάβασα τίποτα άλλο.' -f $hubDirFull, $HubWorker) -ForegroundColor Red
    exit 3
}
Write-Host ('Φάκελος: {0}' -f $hubDirFull)

# Worker entry and assets folder, from the wrangler config
$cfgText = [System.IO.File]::ReadAllText($cfgPath, [System.Text.Encoding]::UTF8)
$isToml = ($cfgPath -like '*.toml')
$mainRel = 'worker.js'
if ($isToml) { $m = [regex]::Match($cfgText, '(?m)^\s*main\s*=\s*"([^"]+)"') } else { $m = [regex]::Match($cfgText, '"main"\s*:\s*"([^"]+)"') }
if ($m.Success) { $mainRel = $m.Groups[1].Value }
$assetsRel = 'public'
if ($isToml) { $m = [regex]::Match($cfgText, '(?m)^\s*(?:directory|bucket)\s*=\s*"([^"]+)"') } else { $m = [regex]::Match($cfgText, '"(?:directory|bucket)"\s*:\s*"([^"]+)"') }
if ($m.Success) { $assetsRel = $m.Groups[1].Value }
$assetsRel = ($assetsRel -replace '^\./', '').TrimEnd('/', '\')
$dbNames = @()
foreach ($dm in [regex]::Matches($cfgText, 'database_name"?\s*[:=]\s*"([^"]+)"')) { $dbNames += $dm.Groups[1].Value }
$mainPath = [System.IO.Path]::GetFullPath((Join-Path $hubDirFull $mainRel))
$assetsDir = [System.IO.Path]::GetFullPath((Join-Path $hubDirFull $assetsRel)).TrimEnd('\', '/')

# entries: kind, rel, bytes, rawSha, text (or $null), note
$entries = New-Object System.Collections.ArrayList
$taken = @{}

function Add-TextEntry([string]$Kind, [string]$FullPath) {
    $rel = Get-RelPath $hubDirFull $FullPath
    if ($script:taken.ContainsKey($rel.ToLowerInvariant())) { return $null }
    $script:taken[$rel.ToLowerInvariant()] = $true
    $fi = Get-Item -LiteralPath $FullPath
    $e = @{ kind = $Kind; rel = $rel; bytes = $fi.Length; raw = '-'; text = $null; exp = '-'; note = ''; time = $fi.LastWriteTime }
    # Checked before anything is read: a secret file is never opened.
    if ($NeverRead -contains $fi.Name) { $e.kind = 'NEVER'; $e.note = 'secret file name: never read'; [void]$script:entries.Add($e); return $e }
    $bytes = [System.IO.File]::ReadAllBytes($FullPath)
    $e.raw = Get-Sha256Hex $bytes
    if ($fi.Length -gt $MaxTextBytes) { $e.kind = 'BIG'; $e.note = ('over {0} KB: text not included' -f $MaxTextKB); [void]$script:entries.Add($e); return $e }
    $r = Read-TextStrict $bytes
    if (-not $r.ok) { $e.kind = 'NOTUTF8'; $e.note = 'not UTF-8 text: text not included'; [void]$script:entries.Add($e); return $e }
    $eol = Get-Eol $r.text
    $norm = $r.text.Replace("`r`n", "`n")
    $text = Protect-Text $norm $rel
    $e.text = $text
    $e.exp = Get-Sha256Hex ($Utf8NoBom.GetBytes($text))
    $bomWord = 'no'
    if ($r.bom) { $bomWord = 'yes' }
    $e.note = ('eol={0} bom={1}' -f $eol, $bomWord)
    [void]$script:entries.Add($e)
    return $e
}

# 1. Worker code: main file and the files it imports (relative imports, inside the hub folder)
$codeQueue = New-Object System.Collections.Queue
if (Test-Path -LiteralPath $mainPath -PathType Leaf) { $codeQueue.Enqueue($mainPath) }
$seenCode = @{}
while ($codeQueue.Count -gt 0 -and $seenCode.Count -lt $MaxImportFiles) {
    $p = [string]$codeQueue.Dequeue()
    if ($seenCode.ContainsKey($p.ToLowerInvariant())) { continue }
    $seenCode[$p.ToLowerInvariant()] = $true
    if (-not $p.StartsWith($hubDirFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { continue }
    $e = Add-TextEntry 'CODE' $p
    if ($e -and $e.text) {
        foreach ($imp in (Get-RelativeImports $e.text)) {
            $target = Resolve-Import $p $imp
            if ($target) { $codeQueue.Enqueue($target) }
        }
    }
}

# 2. Config files
[void](Add-TextEntry 'CONFIG' $cfgPath)
foreach ($n in @('package.json')) {
    $p = Join-Path $hubDirFull $n
    if (Test-Path -LiteralPath $p -PathType Leaf) { [void](Add-TextEntry 'CONFIG' $p) }
}

# 3. Assets folder: every file (it is all published)
$assetFiles = @()
if (Test-Path -LiteralPath $assetsDir -PathType Container) {
    $assetFiles = @(Get-ChildItem -LiteralPath $assetsDir -Recurse -File -Force -ErrorAction SilentlyContinue | Sort-Object FullName)
}
foreach ($f in $assetFiles) {
    $rel = Get-RelPath $hubDirFull $f.FullName
    if ($taken.ContainsKey($rel.ToLowerInvariant())) { continue }
    if (($f.Name -match $BackupName) -or (-not (Test-TextFile $f)) -or ($NeverRead -contains $f.Name)) {
        $taken[$rel.ToLowerInvariant()] = $true
        $kind = 'BINARY'
        $note = ''
        if ($NeverRead -contains $f.Name) { $kind = 'NEVER'; $note = 'secret file name: never read' }
        elseif ($f.Name -match $BackupName) { $kind = 'BACKUP'; $note = 'backup-like name, published too (lesson L04): text not included' }
        $raw = '-'
        if ($kind -ne 'NEVER') { $raw = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
        [void]$entries.Add(@{ kind = $kind; rel = $rel; bytes = $f.Length; raw = $raw; text = $null; exp = '-'; note = $note; time = $f.LastWriteTime })
        continue
    }
    [void](Add-TextEntry 'ASSET' $f.FullName)
}

# 4. Everything else in the hub folder: names and sizes only
$others = New-Object System.Collections.Generic.List[string]
foreach ($it in @(Get-ChildItem -LiteralPath $hubDirFull -Force -ErrorAction SilentlyContinue | Sort-Object @{ Expression = { -not $_.PSIsContainer } }, Name)) {
    if ($it.PSIsContainer) {
        if ($it.FullName.TrimEnd('\', '/') -eq $assetsDir) { continue }
        if ($SkipDirs -contains $it.Name.ToLowerInvariant()) { $others.Add(('[DIR] {0}  (not opened)' -f $it.Name)); continue }
        $cnt = @(Get-ChildItem -LiteralPath $it.FullName -Recurse -File -Force -ErrorAction SilentlyContinue).Count
        $others.Add(('[DIR] {0}  ({1} files)' -f $it.Name, $cnt))
        continue
    }
    $rel = Get-RelPath $hubDirFull $it.FullName
    if ($taken.ContainsKey($rel.ToLowerInvariant())) { continue }
    $others.Add(('{0,-60} {1,10}  {2}' -f $it.Name, (Format-Size $it.Length), $it.LastWriteTime.ToString('yyyy-MM-dd HH:mm')))
}

# ---------- report ----------
$L = New-Object System.Collections.Generic.List[string]
$L.Add('=== GEAR WORLD HUB CODE EXPORT (read-only) ===')
$L.Add(('Tool: {0} | Time: {1} | PowerShell {2}' -f $ScriptVersion, (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $PSVersionTable.PSVersion))
$L.Add(('Folder: {0} | Worker: {1} | config: {2} | main: {3} | assets: {4} | D1: {5}' -f $hubDirFull, $HubWorker, (Split-Path -Leaf $cfgPath), $mainRel, $assetsRel, ($dbNames -join ', ')))
$withText = @($entries | Where-Object { $_.text -ne $null })
$totalText = 0
foreach ($e in $withText) { $totalText += $e.text.Length }
$L.Add(('Files: {0} in the manifest, {1} with text in this report ({2} characters)' -f $entries.Count, $withText.Count, $totalText))
if (-not (Test-Path -LiteralPath $mainPath -PathType Leaf)) { $L.Add(('WARNING: the Worker main file {0} was not found' -f $mainRel)) }
if (-not (Test-Path -LiteralPath $assetsDir -PathType Container)) { $L.Add(('WARNING: the assets folder {0} was not found' -f $assetsRel)) }
$L.Add('If this report was cut off, the MANIFEST below is still enough for Claude to continue.')

$L.Add('')
$L.Add('--- MANIFEST (kind | path | bytes | sha256 of the file | sha256 of the exported text, LF | modified | notes) ---')
foreach ($e in ($entries | Sort-Object @{ Expression = { $_.rel } })) {
    $L.Add(('{0} | {1} | {2} | {3} | {4} | {5} | {6}' -f $e.kind, $e.rel, $e.bytes, $e.raw, $e.exp, $e.time.ToString('yyyy-MM-dd HH:mm'), $e.note))
}

$L.Add('')
$L.Add('--- OTHER FILES IN THE HUB FOLDER (names and sizes only; only what is in the MANIFEST is deployed or read) ---')
if ($others.Count -eq 0) { $L.Add('(none)') } else { foreach ($o in $others) { $L.Add($o) } }

$L.Add('')
$L.Add('--- SECRET FILES (presence only, never read) ---')
foreach ($n in $NeverRead) {
    $state = 'absent'
    if (Test-Path -LiteralPath (Join-Path $hubDirFull $n)) { $state = 'present' }
    $L.Add(('{0}: {1}' -f $n, $state))
}

# D1 structure (SELECT only, no rows)
$L.Add('')
$L.Add('--- D1 (read-only SELECT: structure and row counts, no rows) ---')
if ($SkipD1) {
    $L.Add('skipped (-SkipD1)')
} elseif ($dbNames.Count -eq 0) {
    $L.Add('no database_name found in the wrangler config')
} else {
    $dbName = $dbNames[0]
    Write-Host ("Διαβάζω τη δομή της D1 '{0}' (μόνο ανάγνωση, SELECT)..." -f $dbName)
    $L.Add(('database_name: {0}' -f $dbName))
    try {
        $schemaSql = "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND substr(name,1,7) != 'sqlite_' AND substr(name,1,4) != '_cf_' ORDER BY type DESC, name"
        $r = Invoke-D1Select $hubDirFull $dbName $schemaSql
        if (-not $r.ok) {
            $L.Add('schema query failed. Output:')
            $raw = $r.raw
            if ($raw.Length -gt 4000) { $raw = $raw.Substring(0, 4000) }
            $L.Add($raw)
        } else {
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
                $counted = @($tables | Select-Object -First 40)
                $parts = @()
                foreach ($t in $counted) { $parts += ('(SELECT COUNT(*) FROM [{0}]) AS [{0}]' -f $t) }
                $c = Invoke-D1Select $hubDirFull $dbName ('SELECT ' + ($parts -join ', '))
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
    } catch {
        $L.Add(('D1 read failed: {0}' -f $_.Exception.Message))
    }
}

$L.Add('')
$L.Add('--- MASKING CHECK ---')
$L.Add(('secrets masked: {0} line(s)' -f $SecretHits.Count))
foreach ($x in $SecretHits) { $L.Add('  ' + $x) }
$L.Add(('personal email addresses masked: {0} line(s)' -f $EmailHits.Count))
foreach ($x in $EmailHits) { $L.Add('  ' + $x) }
$L.Add(('IDs masked: {0} line(s)' -f $IdHits.Count))
foreach ($x in $IdHits) { $L.Add('  ' + $x) }

$L.Add('')
$L.Add('=== FILE CONTENTS (each block: text with LF line ends, its sha256 is in the begin line) ===')
foreach ($e in ($withText | Sort-Object @{ Expression = { $_.rel } })) {
    $L.Add(('<<<GW-FILE-BEGIN path={0} sha256={1} >>>' -f $e.rel, $e.exp))
    $L.Add($e.text.Replace("`n", "`r`n"))
    $L.Add(('<<<GW-FILE-END path={0} >>>' -f $e.rel))
}
$L.Add('=== END OF EXPORT ===')

# Everything outside the file blocks is masked again (wrangler output can print account and database IDs).
# Inside the blocks the text is already masked, so this changes nothing there.
$report = Hide-Ids ($L -join "`r`n")
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$outFile = Join-Path $OutDir ('GWH_CODE_EXPORT_{0}.txt' -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
Write-TextBom $outFile $report

$copied = $false
if (-not $NoClipboard) {
    try { Set-Clipboard -Value $report; $copied = $true } catch { $copied = $false }
}

Write-Host ''
Write-Host ('OK - Η αναφορά γράφτηκε: {0}' -f $outFile) -ForegroundColor Green
Write-Host ('Αρχεία: {0} | με κείμενο: {1} | μέγεθος αναφοράς: {2}' -f $entries.Count, $withText.Count, (Format-Size $report.Length))
Write-Host ('Κρύφτηκαν: μυστικά {0}, προσωπικά email {1}, IDs {2}' -f $SecretHits.Count, $EmailHits.Count, $IdHits.Count)
Write-Host 'Δεν άλλαξε τίποτα στον υπολογιστή, στο Cloudflare ή στη D1.'
if ($copied) {
    Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green
}
exit 0
