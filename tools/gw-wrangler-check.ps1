<#
.SYNOPSIS
  Gear World: read-only check of the wrangler versions on this PC, and (with -BackupCheck) the backup check too.

.DESCRIPTION
  Changes nothing: no site, database, Cloudflare setting or drive is changed (lessons L114).
  1. poster-stats from the wrangler branch (-WranglerRef, default the wrangler 4.158.0 branch). It reads the poster
     counts (SELECT only) with the wrangler of that branch, installed in its own folder under gear-world-posters\deploy.
  2. The wrangler version in that folder, and the Node.js version.
  3. wrangler in the Gear World folders of the home folder (each folder's own node_modules).
  4. wrangler in the npx cache and in the global npm.
  5. wrangler log folders: number of files, size, and how many contain a token word. The contents are never shown.
  With -BackupCheck: then tools/gw-backup.ps1 of this same version WITHOUT -Apply (reads the folders and databases,
  writes nothing to the drive) and its report is added at the end.
  One report in $HOME\gear-world-reports, copied to the clipboard. Last line: «ΤΕΛΟΣ ΕΛΕΓΧΟΥ».

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File gw-run.ps1 -Ref <40-character commit> -Tool gw-wrangler-check -BackupCheck
#>
param(
    [string]$WranglerRef = 'ef67a8f007241b50f2a624b13082707605dcf9e2',
    [switch]$BackupCheck,
    [switch]$SkipPosterStats,
    [string]$HomeDir = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Continue'
if (-not $HomeDir) { $HomeDir = $HOME }
if (-not $OutDir) { $OutDir = Join-Path $HomeDir 'gear-world-reports' }
$exe = (Get-Process -Id $PID).Path
$t0 = Get-Date
$stamp = $t0.ToString('yyyyMMdd_HHmmss')

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}
function Short([string]$p) {
    if ($p.StartsWith($HomeDir, [System.StringComparison]::OrdinalIgnoreCase)) { return '~' + $p.Substring($HomeDir.Length) }
    return $p
}
function Get-Version([string]$packageJson) {
    try { return [string]((Get-Content -LiteralPath $packageJson -Raw -Encoding UTF8 | ConvertFrom-Json).version) } catch { return '?' }
}
# Keep the PC awake and stop a click from pausing the window while this runs (lessons L115); both back at the end.
$script:Awake = $false
$script:ConsoleMode = $null
function Initialize-Native {
    if ('GwCheckPower.Native' -as [type]) { return $true }
    try {
        $sig = '[System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);' +
            ' [System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern System.IntPtr GetStdHandle(int nStdHandle);' +
            ' [System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern bool GetConsoleMode(System.IntPtr hConsoleHandle, out uint lpMode);' +
            ' [System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern bool SetConsoleMode(System.IntPtr hConsoleHandle, uint dwMode);'
        Add-Type -Namespace GwCheckPower -Name Native -MemberDefinition $sig
        return $true
    } catch { return $false }
}
function Set-Awake([bool]$on) {
    if (-not (Initialize-Native)) { return $false }
    try {
        if ($on) { [void][GwCheckPower.Native]::SetThreadExecutionState([uint32]2147483651); $script:Awake = $true; return $true }
        [void][GwCheckPower.Native]::SetThreadExecutionState([uint32]2147483648); $script:Awake = $false; return $true
    } catch { return $false }
}
function Set-QuickEdit([bool]$on) {
    try {
        if (-not (Initialize-Native)) { return $false }
        $h = [GwCheckPower.Native]::GetStdHandle(-10)
        if ($on) {
            if ($null -ne $script:ConsoleMode) { [void][GwCheckPower.Native]::SetConsoleMode($h, [uint32]$script:ConsoleMode); $script:ConsoleMode = $null }
            return $true
        }
        $mode = [uint32]0
        if (-not [GwCheckPower.Native]::GetConsoleMode($h, [ref]$mode)) { return $false }
        if (($mode -band 0x40) -eq 0) { return $true }
        if ([GwCheckPower.Native]::SetConsoleMode($h, [uint32](($mode -bor 0x80) - 0x40))) { $script:ConsoleMode = $mode; return $true }
        return $false
    } catch { return $false }
}
function Get-Newest([string]$dir, [string]$filter, [datetime]$after) {
    return @(Get-ChildItem -LiteralPath $dir -Filter $filter -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $after } | Sort-Object LastWriteTime | Select-Object -Last 1)
}

if ($WranglerRef -notmatch '^[0-9a-f]{40}$') {
    Write-Host 'Λάθος έκδοση wrangler (χρειάζεται commit 40 χαρακτήρων). Στείλε στο Claude την εντολή που έτρεξες.' -ForegroundColor Red
    exit 2
}

Say ('GW WRANGLER CHECK (MONO ANAGNOSI / READ-ONLY) {0}  wrangler ref {1}' -f $t0.ToString('yyyy-MM-dd HH:mm'), $WranglerRef.Substring(0, 7)) 'Cyan'
if (Set-Awake $true) { Say 'Ο υπολογιστής μένει ξύπνιος όσο τρέχει (χωρίς αλλαγή ρυθμίσεων).' } else { Say 'ΠΡΟΣΟΧΗ: δεν μπόρεσα να κρατήσω τον υπολογιστή ξύπνιο. Αν κοιμηθεί, συνεχίζει όταν ξυπνήσει.' 'Yellow' }
[void](Set-QuickEdit $false)

# 1. poster-stats with the wrangler of the branch (it installs it in its own deploy folder).
Say '=== 1. poster-stats (wrangler του κλάδου) ==='
if ($SkipPosterStats) {
    Say 'παραλείφθηκε (-SkipPosterStats)'
} else {
    $t1 = Get-Date
    $run = Join-Path $PSScriptRoot 'gw-run.ps1'
    & $exe -NoProfile -ExecutionPolicy Bypass -File $run -Ref $WranglerRef -Tool poster-stats -NoClipboard
    Say ('poster-stats exit {0}' -f $LASTEXITCODE)
    $ps = @(Get-Newest (Join-Path $HOME 'gear-world-reports') 'POSTER_STATS_*.txt' $t1)
    if ($ps.Count) { $L.Add((Get-Content -LiteralPath $ps[0].FullName -Raw -Encoding UTF8).TrimEnd()) } else { Say 'ΔΕΝ γράφτηκε αναφορά poster-stats' 'Yellow' }
}

# 2. wrangler in the deploy folder of the branch, and Node.js.
$deploy = Join-Path (Join-Path (Join-Path $HomeDir 'gear-world-posters') 'deploy') ('gear-world-code-' + $WranglerRef)
Say ('=== 2. wrangler στο {0} ===' -f (Short $deploy))
$pkg = Join-Path $deploy 'node_modules\wrangler\package.json'
if (Test-Path -LiteralPath $pkg) {
    Say ('package.json version: {0}' -f (Get-Version $pkg))
    $env:WRANGLER_SEND_METRICS = 'false'
    Push-Location -LiteralPath $deploy
    try { $v = cmd /c 'npx --no-install wrangler --version 2>&1' } finally { Pop-Location }
    Say ('wrangler --version: {0}' -f (($v | Out-String).Trim()))
} else {
    Say 'wrangler ΔΕΝ είναι εγκατεστημένο εδώ'
}
Say ('node: {0}' -f ((cmd /c 'node --version 2>&1') | Out-String).Trim())

# 3. wrangler in the Gear World folders (own node_modules, up to 2 levels down).
Say '=== 3. wrangler στους φακέλους Gear World ==='
foreach ($x in @(Get-ChildItem -LiteralPath $HomeDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'gear-world|gear-uk' } | Sort-Object Name)) {
    $pk = @(Get-Item -Path ($x.FullName + '\node_modules\wrangler\package.json'), ($x.FullName + '\*\node_modules\wrangler\package.json'), ($x.FullName + '\*\*\node_modules\wrangler\package.json') -ErrorAction SilentlyContinue)
    if ($pk.Count -eq 0) { Say ('{0}: δικό του wrangler δεν έχει (το npx παίρνει το cache ή το τελευταίο)' -f $x.Name) }
    foreach ($q in $pk) { Say ('{0}: {1}  {2}' -f $x.Name, (Get-Version $q.FullName), (Short $q.FullName)) }
}

# 4. npx cache and global npm.
Say '=== 4. npx cache + global npm ==='
$npxCache = Join-Path $env:LOCALAPPDATA 'npm-cache\_npx'
foreach ($q in @(Get-Item -Path (Join-Path $npxCache '*\node_modules\wrangler\package.json') -ErrorAction SilentlyContinue)) {
    Say ('npx cache: {0}  {1}' -f (Get-Version $q.FullName), $q.LastWriteTime.ToString('yyyy-MM-dd'))
}
Say ('npm global: {0}' -f ((cmd /c 'npm ls -g wrangler --depth=0 2>&1') | Out-String).Trim())

# 5. wrangler logs: counts only, the contents are never shown or copied.
Say '=== 5. wrangler logs (το περιεχόμενο ΔΕΝ εμφανίζεται) ==='
$logDirs = @((Join-Path $HomeDir '.wrangler\logs'), (Join-Path $HomeDir '.config\.wrangler\logs'))
if ($env:APPDATA) { $logDirs += (Join-Path $env:APPDATA 'xdg.config\.wrangler\logs') }
foreach ($lg in $logDirs) {
    if (Test-Path -LiteralPath $lg) {
        $fl = @(Get-ChildItem -LiteralPath $lg -File -ErrorAction SilentlyContinue)
        $tk = @($fl | Where-Object { Select-String -LiteralPath $_.FullName -Pattern 'oauth_token|refresh_token|access_token|Bearer ' -Quiet -ErrorAction SilentlyContinue })
        $mb = [Math]::Round((($fl | Measure-Object -Property Length -Sum).Sum / 1MB), 1)
        Say ('{0}: {1} αρχεία, {2} MB, {3} με λέξη token' -f (Short $lg), $fl.Count, $mb, $tk.Count)
    } else {
        Say ('{0}: δεν υπάρχει' -f (Short $lg))
    }
}

# 6. The backup check of this same version, without -Apply (writes nothing to the drive).
$bx = $null
if ($BackupCheck) {
    Say '=== 6. έλεγχος backup (χωρίς -Apply, 5-30 λεπτά) ===' 'Cyan'
    $t2 = Get-Date
    $bk = Join-Path $PSScriptRoot 'gw-backup.ps1'
    & $exe -NoProfile -ExecutionPolicy Bypass -File $bk -HomeDir $HomeDir -OutDir $OutDir -NoClipboard
    $bx = $LASTEXITCODE
    Say ('gw-backup (έλεγχος) exit {0}' -f $bx)
    $br = @(Get-Newest $OutDir 'GW_BACKUP_*.txt' $t2)
    if ($br.Count) { $L.Add((Get-Content -LiteralPath $br[0].FullName -Raw -Encoding UTF8).TrimEnd()) } else { Say 'ΔΕΝ γράφτηκε αναφορά backup' 'Yellow' }
}

if ($script:Awake) { [void](Set-Awake $false); Say 'Ο υπολογιστής γύρισε στον κανονικό ύπνο.' }
if ($null -ne $script:ConsoleMode) { [void](Set-QuickEdit $true) }
Say ''
Say 'ΤΕΛΟΣ ΕΛΕΓΧΟΥ' 'Green'
$text = ($L -join "`r`n") + "`r`n"
$file = Join-Path $OutDir ('GW_WRANGLER_CHECK_{0}.txt' -f $stamp)
$written = $false
try {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    $written = $true
} catch { Write-Host ('Η αναφορά δεν γράφτηκε: {0}' -f $_.Exception.Message) -ForegroundColor Red }
if ($written) { Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file) }
if (-not $NoClipboard) {
    try { Set-Clipboard -Value $text; Write-Host 'Αντιγράφηκε στο πρόχειρο: πάτα Ctrl+V στη συνομιλία του Claude.' -ForegroundColor Green } catch { }
}
if ($null -ne $bx -and $bx -ne 0) { exit $bx }
exit 0
