# Gear World code - test runner.
# Runs on Windows PowerShell 5.1 (GitHub Actions, windows-latest) and on PowerShell 7.
# Exit code 0 = all checks passed.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$failures = New-Object System.Collections.ArrayList
$passes = 0
$isWin = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT

function Check([bool]$Cond, [string]$Name) {
    if ($Cond) { $script:passes++; Write-Host ('  PASS  ' + $Name) -ForegroundColor Green }
    else { [void]$script:failures.Add($Name); Write-Host ('  FAIL  ' + $Name) -ForegroundColor Red }
}

function Write-Utf8([string]$Path, [string]$Text) {
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-TreeHash([string]$Dir) {
    $sb = New-Object System.Text.StringBuilder
    foreach ($f in (Get-ChildItem -LiteralPath $Dir -Recurse -File -Force | Sort-Object FullName)) {
        [void]$sb.Append($f.FullName + '=' + (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash + ';')
    }
    return $sb.ToString()
}

Write-Host ('PowerShell ' + $PSVersionTable.PSVersion + ' on ' + [System.Environment]::OSVersion.VersionString)
if ($env:CI -eq 'true' -and $isWin) {
    Check ($PSVersionTable.PSVersion.Major -eq 5) 'CI runs on Windows PowerShell 5.1'
}

# 1. Every .ps1 parses without errors, and any .ps1 with non-ASCII text starts with a UTF-8 BOM
Write-Host 'Syntax and encoding'
$psFiles = @(Get-ChildItem -LiteralPath $repo -Recurse -File -Filter '*.ps1' | Where-Object { $_.FullName -notmatch '[\\/](\.git|node_modules|\.wrangler)[\\/]' })
foreach ($f in $psFiles) {
    $tokens = $null; $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$tokens, [ref]$errors)
    Check ($errors.Count -eq 0) ('parses: ' + $f.Name)
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
    $nonAscii = $false
    foreach ($b in $bytes) { if ($b -gt 127) { $nonAscii = $true; break } }
    Check ((-not $nonAscii) -or $hasBom) ('UTF-8 BOM when non-ASCII: ' + $f.Name)
}

# 2. No secrets or Cloudflare IDs committed
Write-Host 'Secret scan'
$patterns = @(
    ('gh' + 'p_[A-Za-z0-9]{30,}'),
    ('github' + '_pat_[A-Za-z0-9_]{20,}'),
    ('AK' + 'IA[0-9A-Z]{16}'),
    ('sk' + '_live_[A-Za-z0-9]{10,}'),
    ('-----BEGIN [A-Z ]*PRIVATE' + ' KEY-----'),
    '\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b'
)
# Files git would commit (tracked + new, not ignored). Ignored local files such as node_modules are skipped.
$listed = @(& git -C $repo ls-files --cached --others --exclude-standard 2>$null)
if ($LASTEXITCODE -ne 0 -or $listed.Count -eq 0) { throw 'git ls-files failed' }
$textFiles = @($listed | ForEach-Object { Get-Item -LiteralPath (Join-Path $repo $_) -ErrorAction SilentlyContinue } | Where-Object { $_ -and $_.Length -lt 2MB })
$hits = @()
foreach ($f in $textFiles) {
    $t = [System.IO.File]::ReadAllText($f.FullName)
    foreach ($p in $patterns) { if ($t -match $p) { $hits += ($f.Name + ' matches ' + $p) } }
}
foreach ($h in $hits) { Write-Host ('    ' + $h) -ForegroundColor Yellow }
Check ($hits.Count -eq 0) 'no secrets, tokens or Cloudflare IDs in the repo'

# 3. gw-site-snapshot.ps1 on a fake site folder
Write-Host 'gw-site-snapshot.ps1'
$exe = (Get-Process -Id $PID).Path
$snap = Join-Path $repo 'tools/gw-site-snapshot.ps1'
$work = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-test-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$root = Join-Path $work 'home'
$site = Join-Path $root 'garden-gear-world'
$out = Join-Path $work 'out'
$fakeSecret = ('Ab9' * 8)
$fakeDbId = [guid]::NewGuid().ToString()
$fakeAccount = [guid]::NewGuid().ToString('N')
Write-Utf8 (Join-Path $site 'worker.js') ("// test worker`nconst API_TOKEN = `"$fakeSecret`";`nexport default { fetch() { return new Response('ok') } };`n")
Write-Utf8 (Join-Path $site 'wrangler.jsonc') ("{`n  // comment`n  `"name`": `"garden-gear-world`",`n  `"account_id`": `"$fakeAccount`",`n  `"d1_databases`": [{ `"binding`": `"DB`", `"database_name`": `"garden-gear-world`", `"database_id`": `"$fakeDbId`" }]`n}`n")
Write-Utf8 (Join-Path $site 'package.json') '{ "name": "ggw", "private": true }'
Write-Utf8 (Join-Path $site '.dev.vars') 'TURNSTILE_SECRET=TOPSECRETVALUE123'
Write-Utf8 (Join-Path $site 'public/robots.txt') "User-agent: *`nAllow: /`n"
Write-Utf8 (Join-Path $site 'public/_headers') "/*`n  X-Content-Type-Options: nosniff`n"
Write-Utf8 (Join-Path $site 'public/big.json') ('{"x":"' + ('y' * 20000) + '"}')
Write-Utf8 (Join-Path $site 'public/index.html') '<!doctype html><title>t</title>'
$before = Get-TreeHash $site

& $exe -NoProfile -ExecutionPolicy Bypass -File $snap -Site GGW -Root $root -OutDir $out -SkipD1 -NoClipboard
Check ($LASTEXITCODE -eq 0) 'exit code 0'
$reports = @(Get-ChildItem -LiteralPath $out -Filter 'GW_SNAPSHOT_GGW_*.txt' -ErrorAction SilentlyContinue)
Check ($reports.Count -eq 1) 'one report written'
if ($reports.Count -ge 1) {
    $r = [System.IO.File]::ReadAllText($reports[0].FullName)
    Check ($r.Contains('--- FILE: worker.js')) 'report has worker.js'
    Check ($r.Contains('--- FILE: wrangler.jsonc')) 'report has wrangler.jsonc'
    Check (-not $r.Contains($fakeSecret)) 'hard-coded secret is masked'
    Check ($r.Contains('masked 1 suspicious line')) 'secret is reported once'
    Check (-not $r.Contains($fakeDbId)) 'database_id is masked'
    Check (-not $r.Contains($fakeAccount)) 'account_id is masked'
    Check (-not $r.Contains('TOPSECRETVALUE123')) '.dev.vars is never read'
    Check ($r.Contains('.dev.vars: present')) '.dev.vars presence is reported'
    Check ($r.Contains('--- FILE: public/robots.txt')) 'small public text file included'
    Check ($r.Contains('--- FILE: public/_headers')) 'file without extension included'
    Check (-not $r.Contains('--- FILE: public/big.json')) 'big public file not included'
    Check ($r.Contains('skipped (-SkipD1)')) 'D1 skipped when asked'
}
Check ((Get-TreeHash $site) -eq $before) 'site folder unchanged (read-only)'

# 3b. Folder found by wrangler name when the folder has another name
$root2 = Join-Path $work 'home2'
New-Item -ItemType Directory -Path $root2 -Force | Out-Null
Copy-Item -LiteralPath $site -Destination (Join-Path $root2 'ggw-renamed') -Recurse
& $exe -NoProfile -ExecutionPolicy Bypass -File $snap -Site GGW -Root $root2 -OutDir (Join-Path $work 'out2') -SkipD1 -NoClipboard
Check ($LASTEXITCODE -eq 0) 'finds the site folder by wrangler name'

# 3c. Missing site gives exit code 2
& $exe -NoProfile -ExecutionPolicy Bypass -File $snap -Site MGW -Root $root -OutDir (Join-Path $work 'out3') -SkipD1 -NoClipboard
Check ($LASTEXITCODE -eq 2) 'missing site gives exit code 2'

# 3d. D1 read path with a fake npx (Windows only, because it runs a .cmd file)
if ($isWin) {
    $bin = Join-Path $work 'bin'
    $fake = @(
        '@echo off',
        'echo %* | findstr /C:"COUNT(" >nul',
        'if %errorlevel%==0 goto counts',
        'echo [',
        'echo {"results":[{"type":"table","name":"products","sql":"CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT)"},{"type":"table","name":"products_fts","sql":"CREATE VIRTUAL TABLE products_fts USING fts5(name)"},{"type":"table","name":"products_fts_data","sql":"CREATE TABLE ''products_fts_data''(id INTEGER PRIMARY KEY, block BLOB)"}],"success":true}',
        'echo ]',
        'exit /b 0',
        ':counts',
        'echo %* | findstr /C:"products_fts" >nul',
        'if %errorlevel%==0 goto bad',
        'echo [{"results":[{"t":"products","n":42}],"success":true}]',
        'exit /b 0',
        ':bad',
        'echo shadow table queried 1>&2',
        'exit /b 1'
    ) -join "`r`n"
    Write-Utf8 (Join-Path $bin 'npx.cmd') $fake
    $oldPath = $env:PATH
    $env:PATH = $bin + ';' + $oldPath
    try {
        & $exe -NoProfile -ExecutionPolicy Bypass -File $snap -Site GGW -Root $root -OutDir (Join-Path $work 'out4') -NoClipboard
        Check ($LASTEXITCODE -eq 0) 'D1 run exit code 0'
    } finally { $env:PATH = $oldPath }
    $rep4 = @(Get-ChildItem -LiteralPath (Join-Path $work 'out4') -Filter '*.txt' -ErrorAction SilentlyContinue)
    if ($rep4.Count -ge 1) {
        $r4 = [System.IO.File]::ReadAllText($rep4[0].FullName)
        Check ($r4.Contains('-- [table] products')) 'D1 schema parsed'
        Check ($r4 -match 'products\s+42') 'D1 row count parsed (FTS shadow tables skipped)'
        Check ($r4.Contains('gw-site-snapshot v2')) 'report shows tool version'
    } else { Check $false 'D1 report written' }
}

# 4. tgw-import-plan.ps1 (needs Node.js) and gw-run.ps1
Write-Host 'tgw-import-plan.ps1 and gw-run.ps1'
if (Get-Command node -ErrorAction SilentlyContinue) {
    $arch = Join-Path $work 'awin'
    New-Item -ItemType Directory -Path $arch -Force | Out-Null
    $csv = "aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean`n" +
        "https://www.awin1.com/pclick.php?p=1&a=1&m=123932,Sony WH-1000XM5 Wireless Headphones,1,JB-1,https://img.example/1.jpg,Audio,279.00,GBP,Sony,1,4006381333931`n" +
        "https://www.awin1.com/pclick.php?p=2&a=1&m=123932,Makita Trim Router 240V,2,JB-2,https://img.example/2.jpg,Tools,120,GBP,Makita,1,`n"
    $gzPath = Join-Path $arch 'AWIN_123932_114093.csv.gz'
    $fs = [System.IO.File]::Create($gzPath)
    $gz = New-Object System.IO.Compression.GZipStream($fs, [System.IO.Compression.CompressionMode]::Compress)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($csv)
    $gz.Write($bytes, 0, $bytes.Length); $gz.Close(); $fs.Close()
    $archHash = (Get-FileHash -LiteralPath $gzPath -Algorithm SHA256).Hash
    $planTool = Join-Path (Join-Path $repo 'tools') 'tgw-import-plan.ps1'
    $runTool = Join-Path (Join-Path $repo 'tools') 'gw-run.ps1'

    $planOut = Join-Path $work 'plan'
    & $exe -NoProfile -ExecutionPolicy Bypass -File $planTool -Archive $arch -OutDir $planOut -NoClipboard
    Check ($LASTEXITCODE -eq 0) 'import plan: exit code 0'
    $plans = @(Get-ChildItem -LiteralPath $planOut -Directory -Filter 'TGW_IMPORT_PLAN_*' -ErrorAction SilentlyContinue)
    Check ($plans.Count -eq 1) 'import plan: report folder written'
    if ($plans.Count -ge 1) {
        $rep = [System.IO.File]::ReadAllText((Join-Path $plans[0].FullName 'report.txt'))
        Check ($rep.Contains('1 of 2 rows would be imported')) 'import plan: 1 of 2 rows accepted'
        Check ($rep.Contains('woodworking or power tool')) 'import plan: router rejected with its reason'
        Check (Test-Path -LiteralPath (Join-Path (Join-Path $plans[0].FullName 'sql') '0001.sql')) 'import plan: SQL written, not executed'
    }
    Check ((Get-FileHash -LiteralPath $gzPath -Algorithm SHA256).Hash -eq $archHash) 'import plan: Awin archive unchanged'

    & $exe -NoProfile -ExecutionPolicy Bypass -File $planTool -Archive (Join-Path $work 'no-such-folder') -OutDir $planOut -NoClipboard
    Check ($LASTEXITCODE -eq 2) 'import plan: missing archive gives exit code 2'

    $runOut = Join-Path $work 'plan-run'
    & $exe -NoProfile -ExecutionPolicy Bypass -File $runTool -LocalRepo $repo -Tool tgw-import-plan -Archive $arch -OutDir $runOut -NoClipboard
    Check ($LASTEXITCODE -eq 0) 'gw-run: runs a tool from a local copy'
    Check (@(Get-ChildItem -LiteralPath $runOut -Directory -ErrorAction SilentlyContinue).Count -eq 1) 'gw-run: passes the arguments to the tool'

    & $exe -NoProfile -ExecutionPolicy Bypass -File $runTool -LocalRepo $repo -Tool 'bad name!' -NoClipboard
    Check ($LASTEXITCODE -eq 2) 'gw-run: rejects a bad tool name'

    if ($env:CI -eq 'true' -and $env:GITHUB_SHA) {
        $dlOut = Join-Path $work 'plan-download'
        & $exe -NoProfile -ExecutionPolicy Bypass -File $runTool -Ref $env:GITHUB_SHA -Tool tgw-import-plan -Archive $arch -OutDir $dlOut -NoClipboard
        Check ($LASTEXITCODE -eq 0) 'gw-run: downloads this commit from GitHub and runs the tool'
        Check (@(Get-ChildItem -LiteralPath $dlOut -Directory -ErrorAction SilentlyContinue).Count -eq 1) 'gw-run: downloaded tool wrote its report'
    }
} else {
    Write-Host '  (Node.js not installed: import plan tests skipped)' -ForegroundColor Yellow
}

# 5. tgw-cloudflare.ps1 with a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'tgw-cloudflare.ps1 (fake wrangler)'
    $cfTool = Join-Path (Join-Path $repo 'tools') 'tgw-cloudflare.ps1'
    $state = Join-Path $work 'cf-state'
    $cfWork = Join-Path $work 'cf-work'
    $cfOut = Join-Path $work 'cf-out'
    $cfBin = Join-Path $work 'cf-bin'
    New-Item -ItemType Directory -Path $state, $cfBin -Force | Out-Null
    $fakeDb = [guid]::NewGuid().ToString()
    $fakeAcct = [guid]::NewGuid().ToString('N')
    $fakeNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"whoami" >nul && goto whoami',
        'echo %* | findstr /C:"d1 list" >nul && goto d1list',
        'echo %* | findstr /C:"d1 create" >nul && goto d1create',
        'echo %* | findstr /C:"migrations apply" >nul && goto ok',
        'echo %* | findstr /C:"d1 export" >nul && goto d1export',
        'echo %* | findstr /C:"--command" >nul && goto query',
        'echo %* | findstr /C:"d1 execute" >nul && goto ok',
        'echo %* | findstr /C:" deploy" >nul && goto deploy',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':whoami',
        'echo You are logged in with an OAuth Token, associated with the email test@example.com.',
        ('echo ^| Test Account ^| ' + $fakeAcct + ' ^|'),
        'exit /b 0',
        ':d1list',
        'if exist "%GW_FAKE_STATE%\db.txt" goto d1listyes',
        'echo []',
        'exit /b 0',
        ':d1listyes',
        ('echo [{"uuid":"' + $fakeDb + '","name":"technology-gear-world"}]'),
        'exit /b 0',
        ':d1create',
        'echo created > "%GW_FAKE_STATE%\db.txt"',
        'echo Successfully created DB',
        'exit /b 0',
        ':d1export',
        'echo -- backup > "%GW_FAKE_STATE%\export.sql"',
        ':exportloop',
        'if "%~1"=="" goto ok',
        'if "%~1"=="--output" goto exportwrite',
        'shift',
        'goto exportloop',
        ':exportwrite',
        'copy /y "%GW_FAKE_STATE%\export.sql" "%~2" >nul',
        'goto ok',
        ':query',
        'echo [{"results":[{"category_slug":"audio","n":1}],"success":true}]',
        'exit /b 0',
        ':deploy',
        'echo Uploaded technology-gear-world',
        'echo   https://technology-gear-world.example-test.workers.dev',
        'exit /b 0',
        ':ok',
        'echo OK',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $cfBin 'npx.cmd'), $fakeNpx + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $cfBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $state
    $calls = Join-Path $state 'calls.log'
    function Run-Cf([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $cfTool, '-WorkDir', $cfWork, '-OutDir', $cfOut, '-SkipInstall', '-NoClipboard') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function Calls { if (Test-Path -LiteralPath $calls) { return [System.IO.File]::ReadAllText($calls) } else { return '' } }
    try {
        Check ((Run-Cf @('-Step', 'check')) -eq 0) 'cloudflare check: exit 0'
        Check (-not ((Calls) -match 'd1 create|deploy|execute|migrations')) 'cloudflare check: only reads'
        Check ((Run-Cf @('-Step', 'd1')) -eq 0) 'cloudflare d1 without -Apply: exit 0'
        Check (-not ((Calls) -match 'd1 create')) 'cloudflare d1 without -Apply: creates nothing'
        Check ((Run-Cf @('-Step', 'd1', '-Apply', '-Approve', 'yes please')) -eq 1) 'cloudflare d1 with wrong phrase: stops'
        Check (-not ((Calls) -match 'd1 create')) 'cloudflare d1 with wrong phrase: creates nothing'
        Check ((Run-Cf @('-Step', 'preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ TGW PREVIEW')) -eq 8) 'cloudflare preview before d1: refused'
        Check ((Run-Cf @('-Step', 'd1', '-Apply', '-Approve', 'egkrino tgw d1')) -eq 0) 'cloudflare d1 with approval (Latin form): exit 0'
        $c = Calls
        Check ($c -match 'd1 create technology-gear-world' -and $c -match 'migrations apply technology-gear-world --remote') 'cloudflare d1: creates the database and its tables'
        $cfg = Join-Path $cfWork 'wrangler.jsonc'
        Check ((Test-Path -LiteralPath $cfg) -and ([System.IO.File]::ReadAllText($cfg)).Contains($fakeDb)) 'cloudflare d1: local wrangler.jsonc has the database id'
        Check ((Run-Cf @('-Step', 'preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ TGW PREVIEW')) -eq 0) 'cloudflare preview with approval: exit 0'
        Check ((Calls) -match '(?m)wrangler deploy') 'cloudflare preview: deploys'
        Check (-not ((Calls) -match 'routes|custom_domain|technologygearworld\.com')) 'cloudflare preview: no custom domain'
        Check ((Run-Cf @('-Step', 'import', '-Archive', $arch)) -eq 0) 'cloudflare import without -Apply: exit 0'
        Check (-not ((Calls) -match 'd1 execute .*--file')) 'cloudflare import without -Apply: loads nothing'
        Check ((Run-Cf @('-Step', 'import', '-Archive', $arch, '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ TGW IMPORT')) -eq 0) 'cloudflare import with approval: exit 0'
        $c = Calls
        $iExport = $c.IndexOf('d1 export')
        $iExec = $c.IndexOf('--file')
        Check ($iExport -ge 0 -and $iExec -gt $iExport) 'cloudflare import: backup before loading'
        Check (@(Get-ChildItem -LiteralPath (Join-Path $cfWork 'backups') -Filter '*.sql' -ErrorAction SilentlyContinue).Count -eq 1) 'cloudflare import: backup file written'
        $reports = @(Get-ChildItem -LiteralPath $cfOut -Filter 'TGW_CLOUDFLARE_*.txt' -ErrorAction SilentlyContinue)
        Check ($reports.Count -ge 5) 'cloudflare: a report for every run'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host ('{0} passed, {1} failed' -f $passes, $failures.Count)
if ($failures.Count -gt 0) { exit 1 }
exit 0
