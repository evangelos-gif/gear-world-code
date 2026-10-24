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

# 3c2. Router folder (gear-world-import): code files only, no worker.js needed, backups and packages skipped
$router = Join-Path $root 'gear-world-import'
Write-Utf8 (Join-Path $router 'router.mjs') ("// router`nconst TOKEN_SECRET = `"$fakeSecret`";`nexport const sites = ['cgw'];`n")
Write-Utf8 (Join-Path $router 'scripts/split-feeds.ps1') "Write-Host 'split'`n"
Write-Utf8 (Join-Path $router 'router-before-v2.mjs') "// old copy`n"
Write-Utf8 (Join-Path $router 'node_modules/x/index.js') "// package`n"
Write-Utf8 (Join-Path $router 'backups/old.js') "// backup`n"
Write-Utf8 (Join-Path $router 'data.csv') "a,b`n"
$routerBefore = Get-TreeHash $router
& $exe -NoProfile -ExecutionPolicy Bypass -File $snap -Site ROUTER -Root $root -OutDir (Join-Path $work 'out-router') -SkipD1 -NoClipboard
Check ($LASTEXITCODE -eq 0) 'router snapshot exit code 0'
$repR = @(Get-ChildItem -LiteralPath (Join-Path $work 'out-router') -Filter 'GW_SNAPSHOT_ROUTER_*.txt' -ErrorAction SilentlyContinue)
if ($repR.Count -ge 1) {
    $rr = [System.IO.File]::ReadAllText($repR[0].FullName)
    Check ($rr.Contains('--- FILE: router.mjs')) 'router code file included'
    Check ($rr.Contains('--- FILE: scripts/split-feeds.ps1')) 'router script in a subfolder included'
    Check (-not $rr.Contains('--- FILE: router-before-v2.mjs')) 'router backup copy not read'
    Check (-not $rr.Contains('--- FILE: node_modules')) 'router packages not read'
    Check (-not $rr.Contains('backups/old.js')) 'router backups folder skipped'
    Check (-not $rr.Contains('--- FILE: data.csv')) 'router data files not read'
    Check (-not $rr.Contains($fakeSecret)) 'router secret masked'
} else { Check $false 'router report written' }
Check ((Get-TreeHash $router) -eq $routerBefore) 'router folder unchanged (read-only)'

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
        'echo [{"results":[{"products":42}],"success":true}]',
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
        Check ($r4.Contains('gw-site-snapshot v3')) 'report shows tool version'
        Check ($r4.Contains('--- CLOUDFLARE ACCOUNTS AND D1 DATABASES')) 'report lists Cloudflare accounts and D1 databases'
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

    $sampleOut = Join-Path $work 'sample-run'
    & $exe -NoProfile -ExecutionPolicy Bypass -File $runTool -LocalRepo $repo -Tool awin-feed-sample -Advertiser 123932 -Archive $arch -OutDir $sampleOut -NoClipboard
    Check ($LASTEXITCODE -eq 0) 'feed sample: exit code 0 through gw-run'
    $samples = @(Get-ChildItem -LiteralPath $sampleOut -Directory -Filter 'AWIN_FEED_SAMPLE_123932_*' -ErrorAction SilentlyContinue)
    Check ($samples.Count -eq 1) 'feed sample: report folder written'
    if ($samples.Count -ge 1) {
        $srep = [System.IO.File]::ReadAllText((Join-Path $samples[0].FullName 'report.txt'))
        Check ($srep.Contains('Products: 2')) 'feed sample: counts the products'
        Check ($srep.Contains('Sony WH-1000XM5')) 'feed sample: shows sample products'
    }
    Check ((Get-FileHash -LiteralPath $gzPath -Algorithm SHA256).Hash -eq $archHash) 'feed sample: Awin archive unchanged'

    $carOut = Join-Path $work 'car-scan-run'
    & $exe -NoProfile -ExecutionPolicy Bypass -File $runTool -LocalRepo $repo -Tool car-feed-scan -Archive $arch -OutDir $carOut -KeyFile (Join-Path $work 'no-key.dat') -NoClipboard | Out-Null
    Check ($LASTEXITCODE -eq 0) 'car feed scan: exit code 0 through gw-run, without a saved key'
    $cars = @(Get-ChildItem -LiteralPath $carOut -Directory -Filter 'CAR_FEED_SCAN_*' -ErrorAction SilentlyContinue)
    Check ($cars.Count -eq 1) 'car feed scan: report folder written'
    if ($cars.Count -ge 1) { Check ([System.IO.File]::ReadAllText((Join-Path $cars[0].FullName 'report.txt')).Contains('Retailers in the archive: 1')) 'car feed scan: reads the archive' }
    Check ((Get-FileHash -LiteralPath $gzPath -Algorithm SHA256).Hash -eq $archHash) 'car feed scan: Awin archive unchanged'
    $travelOut = Join-Path $work 'travel-scan-run'
    & $exe -NoProfile -ExecutionPolicy Bypass -File $runTool -LocalRepo $repo -Tool travel-feed-scan -Archive $arch -OutDir $travelOut -KeyFile (Join-Path $work 'no-key.dat') -NoClipboard | Out-Null
    Check ($LASTEXITCODE -eq 0) 'travel feed scan: exit code 0 through gw-run, without a saved key'
    $travels = @(Get-ChildItem -LiteralPath $travelOut -Directory -Filter 'TRAVEL_FEED_SCAN_*' -ErrorAction SilentlyContinue)
    Check ($travels.Count -eq 1) 'travel feed scan: report folder written'
    if ($travels.Count -ge 1) { Check ([System.IO.File]::ReadAllText((Join-Path $travels[0].FullName 'report.txt')).Contains('Retailers in the archive: 1')) 'travel feed scan: reads the archive' }
    Check ((Get-FileHash -LiteralPath $gzPath -Algorithm SHA256).Hash -eq $archHash) 'travel feed scan: Awin archive unchanged'
    $agwOut = Join-Path $work 'agw-plan-run'
    & $exe -NoProfile -ExecutionPolicy Bypass -File $runTool -LocalRepo $repo -Tool agw-import-plan -Archive $arch -OutDir $agwOut -NoClipboard | Out-Null
    Check ($LASTEXITCODE -eq 0) 'agw import plan: exit code 0 through gw-run'
    $agwPlans = @(Get-ChildItem -LiteralPath $agwOut -Directory -Filter 'AGW_IMPORT_PLAN_*' -ErrorAction SilentlyContinue)
    Check ($agwPlans.Count -eq 1) 'agw import plan: report folder written'
    if ($agwPlans.Count -ge 1) { Check ([System.IO.File]::ReadAllText((Join-Path $agwPlans[0].FullName 'report.txt')).Contains('AGW IMPORT PLAN')) 'agw import plan: AGW report' }
    Check ((Get-FileHash -LiteralPath $gzPath -Algorithm SHA256).Hash -eq $archHash) 'agw import plan: Awin archive unchanged'
    $vgwOut = Join-Path $work 'vgw-plan-run'
    & $exe -NoProfile -ExecutionPolicy Bypass -File $runTool -LocalRepo $repo -Tool vgw-import-plan -Archive $arch -OutDir $vgwOut -NoClipboard | Out-Null
    Check ($LASTEXITCODE -eq 0) 'vgw import plan: exit code 0 through gw-run'
    $vgwPlans = @(Get-ChildItem -LiteralPath $vgwOut -Directory -Filter 'VGW_IMPORT_PLAN_*' -ErrorAction SilentlyContinue)
    Check ($vgwPlans.Count -eq 1) 'vgw import plan: report folder written'
    if ($vgwPlans.Count -ge 1) { Check ([System.IO.File]::ReadAllText((Join-Path $vgwPlans[0].FullName 'report.txt')).Contains('VGW IMPORT PLAN')) 'vgw import plan: VGW report' }
    Check ((Get-FileHash -LiteralPath $gzPath -Algorithm SHA256).Hash -eq $archHash) 'vgw import plan: Awin archive unchanged'

    $coesCsv = "merchant_name,aw_product_id,brand_name,merchant_product_id,merchant_category,product_name,merchant_deep_link,merchant_image_url,search_price,stock_quantity`n" +
        "Coes,1,Barbour,10,Menswear,Barbour Beaufort Wax Jacket,https://www.coes.co.uk/products/beaufort?variant=10,https://cdn.shopify.com/1.png,299,1`n" +
        "Coes,2,Barbour,20,Menswear,Barbour Beaufort Wax Jacket,https://www.coes.co.uk/products/beaufort?variant=20,https://cdn.shopify.com/1.png,289,2`n" +
        "Coes,3,Joules,30,Womenswear,Joules Ladies Dress,https://www.coes.co.uk/products/dress?variant=30,https://cdn.shopify.com/3.png,59,1`n"
    $coesGz = Join-Path $arch 'AWIN_30645_116078.csv.gz'
    $fs = [System.IO.File]::Create($coesGz)
    $gz = New-Object System.IO.Compression.GZipStream($fs, [System.IO.Compression.CompressionMode]::Compress)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($coesCsv)
    $gz.Write($bytes, 0, $bytes.Length); $gz.Close(); $fs.Close()
    $coesHash = (Get-FileHash -LiteralPath $coesGz -Algorithm SHA256).Hash
    $lipOut = Join-Path $work 'legacy-plan-run'
    & $exe -NoProfile -ExecutionPolicy Bypass -File $runTool -LocalRepo $repo -Tool legacy-import-plan -Retailer coes -Archive $arch -OutDir $lipOut -NoClipboard
    Check ($LASTEXITCODE -eq 0) 'legacy import plan: exit code 0 through gw-run'
    $lips = @(Get-ChildItem -LiteralPath $lipOut -Directory -Filter 'IMPORT_PLAN_coes_*' -ErrorAction SilentlyContinue)
    Check ($lips.Count -eq 1) 'legacy import plan: report folder written'
    if ($lips.Count -ge 1) {
        $lrep = [System.IO.File]::ReadAllText((Join-Path $lips[0].FullName 'report.txt'))
        Check ($lrep.Contains('3 (one row per size) -> 2 products -> 2 would be imported')) 'legacy import plan: sizes joined, both products placed'
        Check (Test-Path -LiteralPath (Join-Path (Join-Path (Join-Path $lips[0].FullName 'sql') 'mgw') '0001.sql')) 'legacy import plan: MGW SQL written, not executed'
        Check (Test-Path -LiteralPath (Join-Path (Join-Path (Join-Path $lips[0].FullName 'sql') 'wgw') '0001.sql')) 'legacy import plan: WGW SQL written, not executed'
    }
    Check ((Get-FileHash -LiteralPath $coesGz -Algorithm SHA256).Hash -eq $coesHash) 'legacy import plan: Awin archive unchanged'
    & $exe -NoProfile -ExecutionPolicy Bypass -File $runTool -LocalRepo $repo -Tool legacy-import-plan -Retailer 'no-rules' -Archive $arch -OutDir $lipOut -NoClipboard
    Check ($LASTEXITCODE -eq 2) 'legacy import plan: unknown retailer gives exit code 2'

    $nsArch = Join-Path $work 'ns-archive'
    New-Item -ItemType Directory -Path $nsArch -Force | Out-Null
    $nsCsv = "merchant_name,product_name,search_price,currency,in_stock,merchant_category`n" +
        "Game Shop,EA Sports FC 25 (PS5),39.99,GBP,1,Video Games`n" +
        "Bag World,Samsonite Spinner 55cm Cabin Suitcase,159,GBP,1,Luggage`n" +
        "Tool Shop,Makita Drill,99,GBP,1,Tools`n"
    $nsGz = Join-Path $nsArch 'AWIN_100_1.csv.gz'
    $fs = [System.IO.File]::Create($nsGz)
    $gz = New-Object System.IO.Compression.GZipStream($fs, [System.IO.Compression.CompressionMode]::Compress)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($nsCsv)
    $gz.Write($bytes, 0, $bytes.Length); $gz.Close(); $fs.Close()
    $nsHash = (Get-FileHash -LiteralPath $nsGz -Algorithm SHA256).Hash
    $nsOut = Join-Path $work 'ns-run'
    & $exe -NoProfile -ExecutionPolicy Bypass -File $runTool -LocalRepo $repo -Tool gw-new-site-scan -Archive $nsArch -OutDir $nsOut -KeyFile (Join-Path $work 'no-key.dat') -NoClipboard
    Check ($LASTEXITCODE -eq 0) 'new site scan: exit code 0 through gw-run'
    $nsRuns = @(Get-ChildItem -LiteralPath $nsOut -Directory -Filter 'GW_NEW_SITE_SCAN_*' -ErrorAction SilentlyContinue)
    Check ($nsRuns.Count -eq 1) 'new site scan: report folder written'
    if ($nsRuns.Count -ge 1) {
        $nsRep = [System.IO.File]::ReadAllText((Join-Path $nsRuns[0].FullName 'report.txt'), [System.Text.Encoding]::UTF8)
        Check ($nsRep.Contains('SIDE BY SIDE') -and $nsRep.Contains('Samsonite Spinner') -and $nsRep.Contains('EA Sports FC 25')) 'new site scan: travel and gaming products counted'
        Check (-not $nsRep.Contains('Makita')) 'new site scan: other products left out'
        Check ($nsRep.Contains('NOT checked')) 'new site scan: without a saved key, membership is not checked'
    }
    Check ((Get-FileHash -LiteralPath $nsGz -Algorithm SHA256).Hash -eq $nsHash) 'new site scan: Awin archive unchanged'
    Check (-not (Test-Path -LiteralPath (Join-Path $work 'no-key.dat'))) 'new site scan: never asks for or saves a key'

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
    $fakeBookmark = '00000085-0000024c-00004c6d-' + [guid]::NewGuid().ToString('N')
    $fakeNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"whoami" >nul && goto whoami',
        'echo %* | findstr /C:"d1 list" >nul && goto d1list',
        'echo %* | findstr /C:"d1 create" >nul && goto d1create',
        'echo %* | findstr /C:"migrations apply" >nul && goto ok',
        'echo %* | findstr /C:"time-travel info" >nul && goto ttinfo',
        'echo %* | findstr /C:"--command" >nul && goto query',
        'echo %* | findstr /C:"d1 execute" >nul && goto ok',
        'echo %* | findstr /C:" deploy" >nul && goto deploy',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':whoami',
        'if defined GW_FAKE_NOLOGIN goto nologin',
        'echo You are logged in with an OAuth Token, associated with the email test@example.com.',
        ('echo ^| Test Account ^| ' + $fakeAcct + ' ^|'),
        'exit /b 0',
        ':nologin',
        'echo You are not authenticated. Please run wrangler login.',
        'exit /b 1',
        ':d1list',
        'if not defined GW_FAKE_FLAKY goto d1listreal',
        'if exist "%GW_FAKE_STATE%\flaky.txt" goto d1listreal',
        'echo flaky > "%GW_FAKE_STATE%\flaky.txt"',
        'echo X [ERROR] fetch failed',
        'exit /b 1',
        ':d1listreal',
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
        ':ttinfo',
        ('echo The current bookmark is ' + $fakeBookmark),
        'exit /b 0',
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
        $env:GW_FAKE_NOLOGIN = '1'
        Check ((Run-Cf @('-Step', 'check')) -eq 4) 'cloudflare: not logged in gives exit 4'
        Remove-Item Env:\GW_FAKE_NOLOGIN
        $lastReport = @(Get-ChildItem -LiteralPath $cfOut -Filter 'TGW_CLOUDFLARE_CHECK_*.txt' | Sort-Object LastWriteTime | Select-Object -Last 1)
        Check ($lastReport.Count -eq 1 -and ([System.IO.File]::ReadAllText($lastReport[0].FullName)).Contains('not authenticated')) 'cloudflare: report shows the wrangler output'
        $env:GW_FAKE_FLAKY = '1'
        Check ((Run-Cf @('-Step', 'check')) -eq 0) 'cloudflare: one network error is retried'
        Remove-Item Env:\GW_FAKE_FLAKY
        Check (([regex]::Matches((Calls), 'd1 list')).Count -eq 2) 'cloudflare: the D1 list was read twice'
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
        Check (@(Get-ChildItem -LiteralPath (Join-Path $cfWork 'deploy') -Recurse -Filter 'promos.js' -ErrorAction SilentlyContinue).Count -ge 1) 'cloudflare preview: the deploy copy has promos/ (the site config imports it)'
        Check (-not ((Calls) -match 'routes|custom_domain|technologygearworld\.com')) 'cloudflare preview: no custom domain'
        Check ((Run-Cf @('-Step', 'import', '-Archive', $arch)) -eq 0) 'cloudflare import without -Apply: exit 0'
        Check (-not ((Calls) -match 'd1 execute .*--file')) 'cloudflare import without -Apply: loads nothing'
        Check ((Run-Cf @('-Step', 'import', '-Archive', $arch, '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ TGW IMPORT')) -eq 0) 'cloudflare import with approval: exit 0'
        $c = Calls
        $iBackup = $c.IndexOf('time-travel info')
        $iExec = $c.IndexOf('--file')
        Check ($iBackup -ge 0 -and $iExec -gt $iBackup) 'cloudflare import: restore point before loading'
        $notes = @(Get-ChildItem -LiteralPath (Join-Path $cfWork 'backups') -Filter '*.txt' -ErrorAction SilentlyContinue)
        Check ($notes.Count -eq 1 -and ([System.IO.File]::ReadAllText($notes[0].FullName)).Contains($fakeBookmark)) 'cloudflare import: restore point written with the bookmark'
        $deploysBefore = ([regex]::Matches((Calls), 'wrangler deploy')).Count
        Check ((Run-Cf @('-Step', 'domain')) -eq 0) 'cloudflare domain without -Apply: exit 0'
        Check (([regex]::Matches((Calls), 'wrangler deploy')).Count -eq $deploysBefore -and -not ([System.IO.File]::ReadAllText($cfg) -match '(?m)^\s*"routes"\s*:')) 'cloudflare domain without -Apply: changes nothing'
        Check ((Run-Cf @('-Step', 'domain', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ TGW DOMAIN', '-NoHttpCheck')) -eq 0) 'cloudflare domain with approval: exit 0'
        $cfgNow = [System.IO.File]::ReadAllText($cfg)
        Check ($cfgNow.Contains('"pattern": "technologygearworld.com", "custom_domain": true') -and $cfgNow.Contains('"pattern": "www.technologygearworld.com", "custom_domain": true') -and $cfgNow.Contains($fakeDb)) 'cloudflare domain: config has both custom domains and keeps the database id'
        Check (@(Get-ChildItem -LiteralPath $cfWork -Filter 'wrangler.jsonc.before-domain-*').Count -eq 1) 'cloudflare domain: old config saved first'
        Check (([regex]::Matches((Calls), 'wrangler deploy')).Count -eq $deploysBefore + 1) 'cloudflare domain: deploys once'
        Check ((Run-Cf @('-Step', 'domain', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ TGW DOMAIN', '-NoHttpCheck')) -eq 0 -and ([regex]::Matches([System.IO.File]::ReadAllText($cfg), '(?m)^\s*"routes"\s*:')).Count -eq 1) 'cloudflare domain twice: routes added only once'
        $deploysBefore = ([regex]::Matches((Calls), 'wrangler deploy')).Count
        Check ((Run-Cf @('-Step', 'update', '-Apply', '-Approve', 'wrong')) -eq 1 -and ([regex]::Matches((Calls), 'wrangler deploy')).Count -eq $deploysBefore) 'cloudflare update with wrong phrase: no deploy'
        Check ((Run-Cf @('-Step', 'update', '-Apply', '-Approve', 'egkrino tgw update', '-NoHttpCheck')) -eq 0 -and ([regex]::Matches((Calls), 'wrangler deploy')).Count -eq $deploysBefore + 1) 'cloudflare update with approval: deploys once'
        $reports = @(Get-ChildItem -LiteralPath $cfOut -Filter 'TGW_CLOUDFLARE_*.txt' -ErrorAction SilentlyContinue)
        Check ($reports.Count -ge 6) 'cloudflare: a report for every run'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 5b. agw-cloudflare.ps1 (Car Gear World, same steps as TGW) with a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'agw-cloudflare.ps1 (fake wrangler)'
    $cfTool = Join-Path (Join-Path $repo 'tools') 'agw-cloudflare.ps1'
    $state = Join-Path $work 'acf-state'
    $cfWork = Join-Path $work 'acf-work'
    $cfOut = Join-Path $work 'acf-out'
    $cfBin = Join-Path $work 'acf-bin'
    New-Item -ItemType Directory -Path $state, $cfBin -Force | Out-Null
    $fakeDb = [guid]::NewGuid().ToString()
    $fakeAcct = [guid]::NewGuid().ToString('N')
    $fakeBookmark = '00000085-0000024c-00004c6d-' + [guid]::NewGuid().ToString('N')
    $fakeNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"whoami" >nul && goto whoami',
        'echo %* | findstr /C:"d1 list" >nul && goto d1list',
        'echo %* | findstr /C:"d1 create" >nul && goto d1create',
        'echo %* | findstr /C:"migrations apply" >nul && goto ok',
        'echo %* | findstr /C:"time-travel info" >nul && goto ttinfo',
        'echo %* | findstr /C:"--command" >nul && goto query',
        'echo %* | findstr /C:"d1 execute" >nul && goto ok',
        'echo %* | findstr /C:" deploy" >nul && goto deploy',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':whoami',
        'if defined GW_FAKE_NOLOGIN goto nologin',
        'echo You are logged in with an OAuth Token, associated with the email test@example.com.',
        ('echo ^| Test Account ^| ' + $fakeAcct + ' ^|'),
        'exit /b 0',
        ':nologin',
        'echo You are not authenticated. Please run wrangler login.',
        'exit /b 1',
        ':d1list',
        'if not defined GW_FAKE_FLAKY goto d1listreal',
        'if exist "%GW_FAKE_STATE%\flaky.txt" goto d1listreal',
        'echo flaky > "%GW_FAKE_STATE%\flaky.txt"',
        'echo X [ERROR] fetch failed',
        'exit /b 1',
        ':d1listreal',
        'if exist "%GW_FAKE_STATE%\db.txt" goto d1listyes',
        'echo []',
        'exit /b 0',
        ':d1listyes',
        ('echo [{"uuid":"' + $fakeDb + '","name":"car-gear-world"}]'),
        'exit /b 0',
        ':d1create',
        'echo created > "%GW_FAKE_STATE%\db.txt"',
        'echo Successfully created DB',
        'exit /b 0',
        ':ttinfo',
        ('echo The current bookmark is ' + $fakeBookmark),
        'exit /b 0',
        ':query',
        'echo [{"results":[{"category_slug":"audio","n":1}],"success":true}]',
        'exit /b 0',
        ':deploy',
        'echo Uploaded car-gear-world',
        'echo   https://car-gear-world.example-test.workers.dev',
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
        $env:GW_FAKE_NOLOGIN = '1'
        Check ((Run-Cf @('-Step', 'check')) -eq 4) 'agw cloudflare: not logged in gives exit 4'
        Remove-Item Env:\GW_FAKE_NOLOGIN
        $lastReport = @(Get-ChildItem -LiteralPath $cfOut -Filter 'AGW_CLOUDFLARE_CHECK_*.txt' | Sort-Object LastWriteTime | Select-Object -Last 1)
        Check ($lastReport.Count -eq 1 -and ([System.IO.File]::ReadAllText($lastReport[0].FullName)).Contains('not authenticated')) 'agw cloudflare: report shows the wrangler output'
        $env:GW_FAKE_FLAKY = '1'
        Check ((Run-Cf @('-Step', 'check')) -eq 0) 'agw cloudflare: one network error is retried'
        Remove-Item Env:\GW_FAKE_FLAKY
        Check (([regex]::Matches((Calls), 'd1 list')).Count -eq 2) 'agw cloudflare: the D1 list was read twice'
        Check ((Run-Cf @('-Step', 'check')) -eq 0) 'agw cloudflare check: exit 0'
        Check (-not ((Calls) -match 'd1 create|deploy|execute|migrations')) 'agw cloudflare check: only reads'
        Check ((Run-Cf @('-Step', 'd1')) -eq 0) 'agw cloudflare d1 without -Apply: exit 0'
        Check (-not ((Calls) -match 'd1 create')) 'agw cloudflare d1 without -Apply: creates nothing'
        Check ((Run-Cf @('-Step', 'd1', '-Apply', '-Approve', 'yes please')) -eq 1) 'agw cloudflare d1 with wrong phrase: stops'
        Check (-not ((Calls) -match 'd1 create')) 'agw cloudflare d1 with wrong phrase: creates nothing'
        Check ((Run-Cf @('-Step', 'preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ AGW PREVIEW')) -eq 8) 'agw cloudflare preview before d1: refused'
        Check ((Run-Cf @('-Step', 'd1', '-Apply', '-Approve', 'egkrino agw d1')) -eq 0) 'agw cloudflare d1 with approval (Latin form): exit 0'
        $c = Calls
        Check ($c -match 'd1 create car-gear-world' -and $c -match 'migrations apply car-gear-world --remote') 'agw cloudflare d1: creates the database and its tables'
        $cfg = Join-Path $cfWork 'wrangler.jsonc'
        Check ((Test-Path -LiteralPath $cfg) -and ([System.IO.File]::ReadAllText($cfg)).Contains($fakeDb)) 'agw cloudflare d1: local wrangler.jsonc has the database id'
        Check ((Run-Cf @('-Step', 'preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ AGW PREVIEW')) -eq 0) 'agw cloudflare preview with approval: exit 0'
        Check ((Calls) -match '(?m)wrangler deploy') 'agw cloudflare preview: deploys'
        Check (@(Get-ChildItem -LiteralPath (Join-Path $cfWork 'deploy') -Recurse -Filter 'promos.js' -ErrorAction SilentlyContinue).Count -ge 1) 'agw cloudflare preview: the deploy copy has promos/ (the site config imports it)'
        Check (-not ((Calls) -match 'routes|custom_domain|cargearworld\.com')) 'agw cloudflare preview: no custom domain'
        Check ((Run-Cf @('-Step', 'import', '-Archive', $arch)) -eq 0) 'agw cloudflare import without -Apply: exit 0'
        Check (-not ((Calls) -match 'd1 execute .*--file')) 'agw cloudflare import without -Apply: loads nothing'
        Check ((Run-Cf @('-Step', 'import', '-Archive', $arch, '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ AGW IMPORT')) -eq 0) 'agw cloudflare import with approval: exit 0'
        $c = Calls
        $iBackup = $c.IndexOf('time-travel info')
        $iExec = $c.IndexOf('--file')
        Check ($iBackup -ge 0 -and $iExec -gt $iBackup) 'agw cloudflare import: restore point before loading'
        $notes = @(Get-ChildItem -LiteralPath (Join-Path $cfWork 'backups') -Filter '*.txt' -ErrorAction SilentlyContinue)
        Check ($notes.Count -eq 1 -and ([System.IO.File]::ReadAllText($notes[0].FullName)).Contains($fakeBookmark)) 'agw cloudflare import: restore point written with the bookmark'
        $deploysBefore = ([regex]::Matches((Calls), 'wrangler deploy')).Count
        Check ((Run-Cf @('-Step', 'domain')) -eq 0) 'agw cloudflare domain without -Apply: exit 0'
        Check (([regex]::Matches((Calls), 'wrangler deploy')).Count -eq $deploysBefore -and -not ([System.IO.File]::ReadAllText($cfg) -match '(?m)^\s*"routes"\s*:')) 'agw cloudflare domain without -Apply: changes nothing'
        Check ((Run-Cf @('-Step', 'domain', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ AGW DOMAIN', '-NoHttpCheck')) -eq 0) 'agw cloudflare domain with approval: exit 0'
        $cfgNow = [System.IO.File]::ReadAllText($cfg)
        Check ($cfgNow.Contains('"pattern": "cargearworld.com", "custom_domain": true') -and $cfgNow.Contains('"pattern": "www.cargearworld.com", "custom_domain": true') -and $cfgNow.Contains($fakeDb)) 'agw cloudflare domain: config has both custom domains and keeps the database id'
        Check (@(Get-ChildItem -LiteralPath $cfWork -Filter 'wrangler.jsonc.before-domain-*').Count -eq 1) 'agw cloudflare domain: old config saved first'
        Check (([regex]::Matches((Calls), 'wrangler deploy')).Count -eq $deploysBefore + 1) 'agw cloudflare domain: deploys once'
        Check ((Run-Cf @('-Step', 'domain', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ AGW DOMAIN', '-NoHttpCheck')) -eq 0 -and ([regex]::Matches([System.IO.File]::ReadAllText($cfg), '(?m)^\s*"routes"\s*:')).Count -eq 1) 'agw cloudflare domain twice: routes added only once'
        $deploysBefore = ([regex]::Matches((Calls), 'wrangler deploy')).Count
        Check ((Run-Cf @('-Step', 'update', '-Apply', '-Approve', 'wrong')) -eq 1 -and ([regex]::Matches((Calls), 'wrangler deploy')).Count -eq $deploysBefore) 'agw cloudflare update with wrong phrase: no deploy'
        Check ((Run-Cf @('-Step', 'update', '-Apply', '-Approve', 'egkrino agw update', '-NoHttpCheck')) -eq 0 -and ([regex]::Matches((Calls), 'wrangler deploy')).Count -eq $deploysBefore + 1) 'agw cloudflare update with approval: deploys once'
        $reports = @(Get-ChildItem -LiteralPath $cfOut -Filter 'AGW_CLOUDFLARE_*.txt' -ErrorAction SilentlyContinue)
        Check ($reports.Count -ge 6) 'agw cloudflare: a report for every run'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 5c. vgw-cloudflare.ps1 (Travel Gear World, same steps as the car site) with a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'vgw-cloudflare.ps1 (fake wrangler)'
    $cfTool = Join-Path (Join-Path $repo 'tools') 'vgw-cloudflare.ps1'
    $state = Join-Path $work 'vcf-state'
    $cfWork = Join-Path $work 'vcf-work'
    $cfOut = Join-Path $work 'vcf-out'
    $cfBin = Join-Path $work 'vcf-bin'
    New-Item -ItemType Directory -Path $state, $cfBin -Force | Out-Null
    $fakeDb = [guid]::NewGuid().ToString()
    $fakeAcct = [guid]::NewGuid().ToString('N')
    $fakeBookmark = '00000085-0000024c-00004c6d-' + [guid]::NewGuid().ToString('N')
    $fakeNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"whoami" >nul && goto whoami',
        'echo %* | findstr /C:"d1 list" >nul && goto d1list',
        'echo %* | findstr /C:"d1 create" >nul && goto d1create',
        'echo %* | findstr /C:"migrations apply" >nul && goto ok',
        'echo %* | findstr /C:"time-travel info" >nul && goto ttinfo',
        'echo %* | findstr /C:"--command" >nul && goto query',
        'echo %* | findstr /C:"d1 execute" >nul && goto ok',
        'echo %* | findstr /C:" deploy" >nul && goto deploy',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':whoami',
        'if defined GW_FAKE_NOLOGIN goto nologin',
        'echo You are logged in with an OAuth Token, associated with the email test@example.com.',
        ('echo ^| Test Account ^| ' + $fakeAcct + ' ^|'),
        'exit /b 0',
        ':nologin',
        'echo You are not authenticated. Please run wrangler login.',
        'exit /b 1',
        ':d1list',
        'if not defined GW_FAKE_FLAKY goto d1listreal',
        'if exist "%GW_FAKE_STATE%\flaky.txt" goto d1listreal',
        'echo flaky > "%GW_FAKE_STATE%\flaky.txt"',
        'echo X [ERROR] fetch failed',
        'exit /b 1',
        ':d1listreal',
        'if exist "%GW_FAKE_STATE%\db.txt" goto d1listyes',
        'echo []',
        'exit /b 0',
        ':d1listyes',
        ('echo [{"uuid":"' + $fakeDb + '","name":"travel-gear-world"}]'),
        'exit /b 0',
        ':d1create',
        'echo created > "%GW_FAKE_STATE%\db.txt"',
        'echo Successfully created DB',
        'exit /b 0',
        ':ttinfo',
        ('echo The current bookmark is ' + $fakeBookmark),
        'exit /b 0',
        ':query',
        'echo [{"results":[{"category_slug":"audio","n":1}],"success":true}]',
        'exit /b 0',
        ':deploy',
        'echo Uploaded travel-gear-world',
        'echo   https://travel-gear-world.example-test.workers.dev',
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
        $env:GW_FAKE_NOLOGIN = '1'
        Check ((Run-Cf @('-Step', 'check')) -eq 4) 'vgw cloudflare: not logged in gives exit 4'
        Remove-Item Env:\GW_FAKE_NOLOGIN
        $lastReport = @(Get-ChildItem -LiteralPath $cfOut -Filter 'VGW_CLOUDFLARE_CHECK_*.txt' | Sort-Object LastWriteTime | Select-Object -Last 1)
        Check ($lastReport.Count -eq 1 -and ([System.IO.File]::ReadAllText($lastReport[0].FullName)).Contains('not authenticated')) 'vgw cloudflare: report shows the wrangler output'
        $env:GW_FAKE_FLAKY = '1'
        Check ((Run-Cf @('-Step', 'check')) -eq 0) 'vgw cloudflare: one network error is retried'
        Remove-Item Env:\GW_FAKE_FLAKY
        Check (([regex]::Matches((Calls), 'd1 list')).Count -eq 2) 'vgw cloudflare: the D1 list was read twice'
        Check ((Run-Cf @('-Step', 'check')) -eq 0) 'vgw cloudflare check: exit 0'
        Check (-not ((Calls) -match 'd1 create|deploy|execute|migrations')) 'vgw cloudflare check: only reads'
        Check ((Run-Cf @('-Step', 'd1')) -eq 0) 'vgw cloudflare d1 without -Apply: exit 0'
        Check (-not ((Calls) -match 'd1 create')) 'vgw cloudflare d1 without -Apply: creates nothing'
        Check ((Run-Cf @('-Step', 'd1', '-Apply', '-Approve', 'yes please')) -eq 1) 'vgw cloudflare d1 with wrong phrase: stops'
        Check (-not ((Calls) -match 'd1 create')) 'vgw cloudflare d1 with wrong phrase: creates nothing'
        Check ((Run-Cf @('-Step', 'preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ VGW PREVIEW')) -eq 8) 'vgw cloudflare preview before d1: refused'
        Check ((Run-Cf @('-Step', 'd1', '-Apply', '-Approve', 'egkrino vgw d1')) -eq 0) 'vgw cloudflare d1 with approval (Latin form): exit 0'
        $c = Calls
        Check ($c -match 'd1 create travel-gear-world' -and $c -match 'migrations apply travel-gear-world --remote') 'vgw cloudflare d1: creates the database and its tables'
        $cfg = Join-Path $cfWork 'wrangler.jsonc'
        Check ((Test-Path -LiteralPath $cfg) -and ([System.IO.File]::ReadAllText($cfg)).Contains($fakeDb)) 'vgw cloudflare d1: local wrangler.jsonc has the database id'
        Check ((Run-Cf @('-Step', 'preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ VGW PREVIEW')) -eq 0) 'vgw cloudflare preview with approval: exit 0'
        Check ((Calls) -match '(?m)wrangler deploy') 'vgw cloudflare preview: deploys'
        Check (@(Get-ChildItem -LiteralPath (Join-Path $cfWork 'deploy') -Recurse -Filter 'promos.js' -ErrorAction SilentlyContinue).Count -ge 1) 'vgw cloudflare preview: the deploy copy has promos/ (the site config imports it)'
        Check (-not ((Calls) -match 'routes|custom_domain|travelgearworld\.com')) 'vgw cloudflare preview: no custom domain'
        Check ((Run-Cf @('-Step', 'import', '-Archive', $arch)) -eq 0) 'vgw cloudflare import without -Apply: exit 0'
        Check (-not ((Calls) -match 'd1 execute .*--file')) 'vgw cloudflare import without -Apply: loads nothing'
        Check ((Run-Cf @('-Step', 'import', '-Archive', $arch, '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ VGW IMPORT')) -eq 0) 'vgw cloudflare import with approval: exit 0'
        $c = Calls
        $iBackup = $c.IndexOf('time-travel info')
        $iExec = $c.IndexOf('--file')
        Check ($iBackup -ge 0 -and $iExec -gt $iBackup) 'vgw cloudflare import: restore point before loading'
        $notes = @(Get-ChildItem -LiteralPath (Join-Path $cfWork 'backups') -Filter '*.txt' -ErrorAction SilentlyContinue)
        Check ($notes.Count -eq 1 -and ([System.IO.File]::ReadAllText($notes[0].FullName)).Contains($fakeBookmark)) 'vgw cloudflare import: restore point written with the bookmark'
        $deploysBefore = ([regex]::Matches((Calls), 'wrangler deploy')).Count
        Check ((Run-Cf @('-Step', 'domain')) -eq 0) 'vgw cloudflare domain without -Apply: exit 0'
        Check (([regex]::Matches((Calls), 'wrangler deploy')).Count -eq $deploysBefore -and -not ([System.IO.File]::ReadAllText($cfg) -match '(?m)^\s*"routes"\s*:')) 'vgw cloudflare domain without -Apply: changes nothing'
        Check ((Run-Cf @('-Step', 'domain', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ VGW DOMAIN', '-NoHttpCheck')) -eq 0) 'vgw cloudflare domain with approval: exit 0'
        $cfgNow = [System.IO.File]::ReadAllText($cfg)
        Check ($cfgNow.Contains('"pattern": "travelgearworld.com", "custom_domain": true') -and $cfgNow.Contains('"pattern": "www.travelgearworld.com", "custom_domain": true') -and $cfgNow.Contains($fakeDb)) 'vgw cloudflare domain: config has both custom domains and keeps the database id'
        Check (@(Get-ChildItem -LiteralPath $cfWork -Filter 'wrangler.jsonc.before-domain-*').Count -eq 1) 'vgw cloudflare domain: old config saved first'
        Check (([regex]::Matches((Calls), 'wrangler deploy')).Count -eq $deploysBefore + 1) 'vgw cloudflare domain: deploys once'
        Check ((Run-Cf @('-Step', 'domain', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ VGW DOMAIN', '-NoHttpCheck')) -eq 0 -and ([regex]::Matches([System.IO.File]::ReadAllText($cfg), '(?m)^\s*"routes"\s*:')).Count -eq 1) 'vgw cloudflare domain twice: routes added only once'
        $deploysBefore = ([regex]::Matches((Calls), 'wrangler deploy')).Count
        Check ((Run-Cf @('-Step', 'update', '-Apply', '-Approve', 'wrong')) -eq 1 -and ([regex]::Matches((Calls), 'wrangler deploy')).Count -eq $deploysBefore) 'vgw cloudflare update with wrong phrase: no deploy'
        Check ((Run-Cf @('-Step', 'update', '-Apply', '-Approve', 'egkrino vgw update', '-NoHttpCheck')) -eq 0 -and ([regex]::Matches((Calls), 'wrangler deploy')).Count -eq $deploysBefore + 1) 'vgw cloudflare update with approval: deploys once'
        $reports = @(Get-ChildItem -LiteralPath $cfOut -Filter 'VGW_CLOUDFLARE_*.txt' -ErrorAction SilentlyContinue)
        Check ($reports.Count -ge 6) 'vgw cloudflare: a report for every run'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 6. gwh-tgw-link.ps1 with a fake hub folder and a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'gwh-tgw-link.ps1 (fake hub, fake wrangler)'
    $hubTool = Join-Path $repo 'tools\gwh-tgw-link.ps1'
    $hub = Join-Path $work 'hub'
    $hubState = Join-Path $work 'hub-state'
    $hubBin = Join-Path $work 'hub-bin'
    $hubOut = Join-Path $work 'hub-out'
    New-Item -ItemType Directory -Path $hubState, $hubBin -Force | Out-Null
    & node (Join-Path $repo 'tests\fixtures\make-hub-fixture.mjs') $hub
    $hubBookmark = '00000085-0000024c-00004c6d-' + [guid]::NewGuid().ToString('N')
    $hubFake = @(
        '@echo off',
        'echo %* >> "%GW_HUB_STATE%\calls.log"',
        'echo %* | findstr /C:"time-travel info" >nul && goto tt',
        'echo %* | findstr /C:"--command" >nul && goto sites',
        'echo %* | findstr /C:"--file" >nul && goto ok',
        'echo %* | findstr /C:"deployments list" >nul && goto deps',
        'echo %* | findstr /C:" deploy" >nul && goto ok',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':tt',
        ('echo The current bookmark is ' + $hubBookmark),
        'exit /b 0',
        ':sites',
        'echo [{"results":[{"site_key":"GGW","domain":"gardengearworld.com","priority":60,"is_active":1}],"success":true}]',
        'exit /b 0',
        ':deps',
        'echo []',
        'exit /b 0',
        ':ok',
        'echo OK',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $hubBin 'npx.cmd'), $hubFake + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $hubBin + ';' + $oldPath
    $env:GW_HUB_STATE = $hubState
    $hubCalls = Join-Path $hubState 'calls.log'
    $indexPath = Join-Path $hub 'public\index.html'
    function Run-Hub([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $hubTool, '-HubDir', $hub, '-OutDir', $hubOut, '-SkipOnline', '-NoClipboard') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function HubCalls { if (Test-Path -LiteralPath $hubCalls) { return [System.IO.File]::ReadAllText($hubCalls) } else { return '' } }
    try {
        $before = [System.IO.File]::ReadAllText($indexPath)
        Check ((Run-Hub @()) -eq 0) 'hub link check: exit 0'
        Check ([System.IO.File]::ReadAllText($indexPath) -eq $before -and -not ((HubCalls) -match ' deploy|--file')) 'hub link check: changes nothing'
        Check ((Run-Hub @('-Apply', '-Approve', 'yes')) -eq 1 -and [System.IO.File]::ReadAllText($indexPath) -eq $before) 'hub link wrong phrase: changes nothing'
        Check ((Run-Hub @('-Apply', '-Approve', 'EGKRINO TGW HUB LINK')) -eq 0) 'hub link with approval: exit 0'
        $after = [System.IO.File]::ReadAllText($indexPath)
        Check ($after.Contains('https://technologygearworld.com/') -and (Test-Path -LiteralPath (Join-Path $hub 'public\hub-tgw.jpg'))) 'hub link: card and photo added'
        $c = HubCalls
        $iT = $c.IndexOf('time-travel info'); $iD = $c.IndexOf(' deploy'); $iF = $c.IndexOf('--file')
        Check ($iT -ge 0 -and $iD -gt $iT -and $iF -gt $iD) 'hub link: restore point, then deploy, then D1 row'
        $rb = @(Get-ChildItem -LiteralPath (Join-Path $hub 'backups') -Recurse -Filter 'ROLLBACK.txt')
        Check ($rb.Count -eq 1 -and ([System.IO.File]::ReadAllText($rb[0].FullName)).Contains($hubBookmark) -and (Test-Path -LiteralPath (Join-Path $rb[0].DirectoryName 'index.html'))) 'hub link: backup and rollback written first'
        $sqlFile = @(Get-ChildItem -LiteralPath (Join-Path $hub 'backups') -Recurse -Filter 'add-tgw-site.sql')
        Check ($sqlFile.Count -eq 1 -and ([System.IO.File]::ReadAllText($sqlFile[0].FullName)).Contains('INSERT OR IGNORE INTO sites')) 'hub link: D1 row can never be added twice'
        Check ((Run-Hub @()) -eq 0 -and [System.IO.File]::ReadAllText($indexPath) -eq $after) 'hub link second check: files stay the same'
        $broken = Join-Path $work 'hub-broken'
        & node (Join-Path $repo 'tests\fixtures\make-hub-fixture.mjs') $broken
        $bi = Join-Path $broken 'public\index.html'
        [System.IO.File]::WriteAllText($bi, ([System.IO.File]::ReadAllText($bi)).Replace('data-world="GGW"', 'data-world="XXX"'))
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $hubTool, '-HubDir', $broken, '-OutDir', $hubOut, '-SkipOnline', '-NoClipboard', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ TGW HUB LINK')
        & $exe @all | Out-Null
        Check ($LASTEXITCODE -eq 6 -and -not ([System.IO.File]::ReadAllText($bi)).Contains('TGW')) 'hub link: unexpected hub files change nothing'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_HUB_STATE -ErrorAction SilentlyContinue
    }
}

# 6b. gwh-agw-link.ps1 (Car Gear World as the 8th hub card) on a fake hub that already has TGW
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'gwh-agw-link.ps1 (fake hub with TGW, fake wrangler)'
    $aHubTool = Join-Path $repo 'tools\gwh-agw-link.ps1'
    $aHub = Join-Path $work 'ahub'
    $aState = Join-Path $work 'ahub-state'
    $aBin = Join-Path $work 'ahub-bin'
    $aOut = Join-Path $work 'ahub-out'
    New-Item -ItemType Directory -Path $aState, $aBin -Force | Out-Null
    & node (Join-Path $repo 'tests\fixtures\make-hub-fixture.mjs') $aHub
    & node (Join-Path $repo 'tools\gwh-tgw-link.mjs') --hub $aHub --write | Out-Null
    $aBookmark = '00000085-0000024c-00004c6d-' + [guid]::NewGuid().ToString('N')
    $aFake = @(
        '@echo off',
        'echo %* >> "%GW_AHUB_STATE%\calls.log"',
        'echo %* | findstr /C:"time-travel info" >nul && goto tt',
        'echo %* | findstr /C:"--command" >nul && goto sites',
        'echo %* | findstr /C:"--file" >nul && goto ok',
        'echo %* | findstr /C:"deployments list" >nul && goto deps',
        'echo %* | findstr /C:" deploy" >nul && goto ok',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':tt',
        ('echo The current bookmark is ' + $aBookmark),
        'exit /b 0',
        ':sites',
        'echo [{"results":[{"site_key":"TGW","domain":"technologygearworld.com","priority":70,"is_active":1}],"success":true}]',
        'exit /b 0',
        ':deps',
        'echo []',
        'exit /b 0',
        ':ok',
        'echo OK',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $aBin 'npx.cmd'), $aFake + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $aBin + ';' + $oldPath
    $env:GW_AHUB_STATE = $aState
    $aCalls = Join-Path $aState 'calls.log'
    $aIndex = Join-Path $aHub 'public\index.html'
    function Run-AHub([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $aHubTool, '-HubDir', $aHub, '-OutDir', $aOut, '-SkipOnline', '-NoClipboard') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function AHubCalls { if (Test-Path -LiteralPath $aCalls) { return [System.IO.File]::ReadAllText($aCalls) } else { return '' } }
    try {
        $before = [System.IO.File]::ReadAllText($aIndex)
        Check ($before.Contains('data-world="TGW"')) 'agw hub link: fake hub has the TGW card'
        Check ((Run-AHub @()) -eq 0 -and [System.IO.File]::ReadAllText($aIndex) -eq $before -and -not ((AHubCalls) -match ' deploy|--file')) 'agw hub link check: changes nothing'
        Check ((Run-AHub @('-Apply', '-Approve', 'ΕΓΚΡΙΝΩ TGW HUB LINK')) -eq 1 -and [System.IO.File]::ReadAllText($aIndex) -eq $before) 'agw hub link: the TGW phrase is not accepted'
        Check ((Run-AHub @('-Apply', '-Approve', 'EGKRINO AGW HUB LINK')) -eq 0) 'agw hub link with approval: exit 0'
        $after = [System.IO.File]::ReadAllText($aIndex)
        Check ($after.Contains('https://cargearworld.com/') -and (Test-Path -LiteralPath (Join-Path $aHub 'public\hub-agw.jpg'))) 'agw hub link: card and photo added'
        $c = AHubCalls
        $iT = $c.IndexOf('time-travel info'); $iD = $c.IndexOf(' deploy'); $iF = $c.IndexOf('--file')
        Check ($iT -ge 0 -and $iD -gt $iT -and $iF -gt $iD) 'agw hub link: restore point, then deploy, then D1 row'
        $sqlFile = @(Get-ChildItem -LiteralPath (Join-Path $aHub 'backups') -Recurse -Filter 'add-agw-site.sql')
        Check ($sqlFile.Count -eq 1 -and ([System.IO.File]::ReadAllText($sqlFile[0].FullName)).Contains("'AGW', 'Car Gear World', 'cargearworld.com'")) 'agw hub link: D1 row for AGW'
        Check ((Run-AHub @()) -eq 0 -and [System.IO.File]::ReadAllText($aIndex) -eq $after) 'agw hub link second check: files stay the same'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_AHUB_STATE -ErrorAction SilentlyContinue
    }
}

# 6c. gwh-vgw-link.ps1 (Travel Gear World as the 9th hub card) on a fake hub that already has TGW and AGW
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'gwh-vgw-link.ps1 (fake hub with TGW and AGW, fake wrangler)'
    $aHubTool = Join-Path $repo 'tools\gwh-vgw-link.ps1'
    $aHub = Join-Path $work 'vhub'
    $aState = Join-Path $work 'vhub-state'
    $aBin = Join-Path $work 'vhub-bin'
    $aOut = Join-Path $work 'vhub-out'
    New-Item -ItemType Directory -Path $aState, $aBin -Force | Out-Null
    & node (Join-Path $repo 'tests\fixtures\make-hub-fixture.mjs') $aHub
    & node (Join-Path $repo 'tools\gwh-tgw-link.mjs') --hub $aHub --write | Out-Null
    & node (Join-Path $repo 'tools\gwh-agw-link.mjs') --hub $aHub --write | Out-Null
    $aBookmark = '00000085-0000024c-00004c6d-' + [guid]::NewGuid().ToString('N')
    $aFake = @(
        '@echo off',
        'echo %* >> "%GW_VHUB_STATE%\calls.log"',
        'echo %* | findstr /C:"time-travel info" >nul && goto tt',
        'echo %* | findstr /C:"--command" >nul && goto sites',
        'echo %* | findstr /C:"--file" >nul && goto ok',
        'echo %* | findstr /C:"deployments list" >nul && goto deps',
        'echo %* | findstr /C:" deploy" >nul && goto ok',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':tt',
        ('echo The current bookmark is ' + $aBookmark),
        'exit /b 0',
        ':sites',
        'echo [{"results":[{"site_key":"TGW","domain":"technologygearworld.com","priority":70,"is_active":1}],"success":true}]',
        'exit /b 0',
        ':deps',
        'echo []',
        'exit /b 0',
        ':ok',
        'echo OK',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $aBin 'npx.cmd'), $aFake + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $aBin + ';' + $oldPath
    $env:GW_VHUB_STATE = $aState
    $aCalls = Join-Path $aState 'calls.log'
    $aIndex = Join-Path $aHub 'public\index.html'
    function Run-VHub([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $aHubTool, '-HubDir', $aHub, '-OutDir', $aOut, '-SkipOnline', '-NoClipboard') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function VHubCalls { if (Test-Path -LiteralPath $aCalls) { return [System.IO.File]::ReadAllText($aCalls) } else { return '' } }
    try {
        $before = [System.IO.File]::ReadAllText($aIndex)
        Check ($before.Contains('data-world="AGW"')) 'vgw hub link: fake hub has the AGW card'
        Check ((Run-VHub @()) -eq 0 -and [System.IO.File]::ReadAllText($aIndex) -eq $before -and -not ((VHubCalls) -match ' deploy|--file')) 'vgw hub link check: changes nothing'
        Check ((Run-VHub @('-Apply', '-Approve', 'ΕΓΚΡΙΝΩ AGW HUB LINK')) -eq 1 -and [System.IO.File]::ReadAllText($aIndex) -eq $before) 'vgw hub link: the AGW phrase is not accepted'
        Check ((Run-VHub @('-Apply', '-Approve', 'EGKRINO VGW HUB LINK')) -eq 0) 'vgw hub link with approval: exit 0'
        $after = [System.IO.File]::ReadAllText($aIndex)
        Check ($after.Contains('https://travelgearworld.com/') -and (Test-Path -LiteralPath (Join-Path $aHub 'public\hub-vgw.jpg'))) 'vgw hub link: card and photo added'
        $c = VHubCalls
        $iT = $c.IndexOf('time-travel info'); $iD = $c.IndexOf(' deploy'); $iF = $c.IndexOf('--file')
        Check ($iT -ge 0 -and $iD -gt $iT -and $iF -gt $iD) 'vgw hub link: restore point, then deploy, then D1 row'
        $sqlFile = @(Get-ChildItem -LiteralPath (Join-Path $aHub 'backups') -Recurse -Filter 'add-vgw-site.sql')
        Check ($sqlFile.Count -eq 1 -and ([System.IO.File]::ReadAllText($sqlFile[0].FullName)).Contains("'VGW', 'Travel Gear World', 'travelgearworld.com'")) 'vgw hub link: D1 row for VGW'
        Check ((Run-VHub @()) -eq 0 -and [System.IO.File]::ReadAllText($aIndex) -eq $after) 'vgw hub link second check: files stay the same'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_VHUB_STATE -ErrorAction SilentlyContinue
    }
}

# 7. ggw-engine.ps1 with a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'ggw-engine.ps1 (fake wrangler)'
    $gTool = Join-Path (Join-Path $repo 'tools') 'ggw-engine.ps1'
    $gState = Join-Path $work 'ggw-state'
    $gWork = Join-Path $work 'ggw-work'
    $gOut = Join-Path $work 'ggw-out'
    $gBin = Join-Path $work 'ggw-bin'
    $gOld = Join-Path $work 'ggw-old-site'
    New-Item -ItemType Directory -Path $gState, $gBin -Force | Out-Null
    $gDb = [guid]::NewGuid().ToString()
    $gVer = [guid]::NewGuid().ToString()
    $gNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"whoami" >nul && goto whoami',
        'echo %* | findstr /C:"d1 list" >nul && goto d1list',
        'echo %* | findstr /C:"--command" >nul && goto query',
        'echo %* | findstr /C:"deployments list" >nul && goto deployments',
        'echo %* | findstr /C:" deploy" >nul && goto deploy',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':whoami',
        'echo You are logged in with an OAuth Token, associated with the email test@example.com.',
        'exit /b 0',
        ':d1list',
        ('echo [{"uuid":"' + $gDb + '","name":"garden-gear-world"},{"uuid":"x","name":"other-site"}]'),
        'exit /b 0',
        ':query',
        'echo [{"results":[{"site_category":"Garden Tools","retailer":"Tooled Up","n":5,"awin":0}],"success":true}]',
        'exit /b 0',
        ':deployments',
        ('echo Version(s):  (100%%) ' + $gVer),
        'exit /b 0',
        ':deploy',
        'echo Uploaded garden-gear-world',
        'echo   https://garden-gear-world-preview.example-test.workers.dev',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $gBin 'npx.cmd'), $gNpx + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $gBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $gState
    $gCalls = Join-Path $gState 'calls.log'
    function Run-G([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $gTool, '-WorkDir', $gWork, '-OldSiteDir', $gOld, '-OutDir', $gOut, '-SkipInstall', '-NoClipboard', '-NoHttpCheck') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function GCalls { if (Test-Path -LiteralPath $gCalls) { return [System.IO.File]::ReadAllText($gCalls) } else { return '' } }
    function GDeploys { return ([regex]::Matches((GCalls), 'wrangler deploy --config')).Count }
    try {
        Check ((Run-G @('-Step', 'check')) -eq 0) 'ggw check: exit 0'
        $c = GCalls
        Check ($c -match 'd1 execute garden-gear-world --remote --json --command "SELECT ' -and $c -match 'deployments list --name garden-gear-world') 'ggw check: reads products and the live version'
        Check ((GDeploys) -eq 0 -and -not ($c -match 'delete|rollback|INSERT|UPDATE')) 'ggw check: only reads'
        $rep = @(Get-ChildItem -LiteralPath $gOut -Filter 'GGW_ENGINE_CHECK_*.txt' | Select-Object -Last 1)
        Check ($rep.Count -eq 1 -and ([System.IO.File]::ReadAllText($rep[0].FullName)).Contains($gVer)) 'ggw check: report shows the live version'
        Check ((Run-G @('-Step', 'preview')) -eq 0 -and (GDeploys) -eq 0) 'ggw preview without -Apply: no deploy'
        Check ((Run-G @('-Step', 'preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ GGW SWITCH')) -eq 1 -and (GDeploys) -eq 0) 'ggw preview with the wrong phrase: no deploy'
        Check ((Run-G @('-Step', 'preview', '-Apply', '-Approve', 'egkrino ggw preview')) -eq 0 -and (GDeploys) -eq 1) 'ggw preview with approval: deploys once'
        $pc = Join-Path $gWork 'wrangler.preview.jsonc'
        $pt = $(if (Test-Path -LiteralPath $pc) { [System.IO.File]::ReadAllText($pc) } else { '' })
        Check ($pt.Contains('"name": "garden-gear-world-preview"') -and $pt.Contains($gDb) -and $pt.Contains('"CLICK_LOG": "off"') -and -not $pt.Contains('custom_domain')) 'ggw preview: separate test Worker, same database, clicks off, no domain'
        Check ((GCalls) -match 'deploy --config "[^"]*wrangler\.preview\.jsonc"') 'ggw preview: deploys the preview config'
        Check (@(Get-ChildItem -LiteralPath (Join-Path $gWork 'deploy') -Recurse -Filter 'promos.js' -ErrorAction SilentlyContinue).Count -ge 1) 'ggw preview: the deploy copy has promos/ (the site configs import it)'
        Check ((Run-G @('-Step', 'switch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ GGW SWITCH')) -eq 11 -and (GDeploys) -eq 1) 'ggw switch without the old site code: refused, no deploy'
        Write-Utf8 (Join-Path $gOld 'worker.js') 'export default {}'
        Write-Utf8 (Join-Path $gOld 'wrangler.jsonc') '{ "name": "garden-gear-world" }'
        Write-Utf8 (Join-Path $gOld '.dev.vars') 'SECRET=never-copy'
        Write-Utf8 (Join-Path (Join-Path $gOld 'public') 'index.html') '<!doctype html>'
        Check ((Run-G @('-Step', 'switch', '-Apply', '-Approve', 'wrong')) -eq 1 -and (GDeploys) -eq 1) 'ggw switch with the wrong phrase: no deploy'
        Check ((Run-G @('-Step', 'switch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ GGW SWITCH')) -eq 0 -and (GDeploys) -eq 2) 'ggw switch with approval: deploys once'
        $zips = @(Get-ChildItem -LiteralPath (Join-Path $gWork 'backups') -Filter 'old-ggw-site-*.zip' -ErrorAction SilentlyContinue)
        Check ($zips.Count -eq 1) 'ggw switch: old site code zipped first'
        if ($zips.Count -eq 1) {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $z = [System.IO.Compression.ZipFile]::OpenRead($zips[0].FullName)
            $names = @($z.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
            $z.Dispose()
            Check (($names -contains 'worker.js') -and ($names -contains 'public/index.html') -and -not ($names -contains '.dev.vars')) 'ggw switch: backup has the code and site files, never .dev.vars'
        }
        $notes = @(Get-ChildItem -LiteralPath (Join-Path $gWork 'backups') -Filter 'ggw-before-switch-*.txt' -ErrorAction SilentlyContinue)
        Check ($notes.Count -eq 1 -and ([System.IO.File]::ReadAllText($notes[0].FullName)).Contains('rollback ' + $gVer)) 'ggw switch: rollback note with the old live version'
        $lc = [System.IO.File]::ReadAllText((Join-Path $gWork 'wrangler.jsonc'))
        Check ($lc.Contains('"name": "garden-gear-world"') -and $lc.Contains($gDb) -and $lc.Contains('"pattern": "gardengearworld.com", "custom_domain": true') -and $lc.Contains('"pattern": "www.gardengearworld.com", "custom_domain": true') -and $lc.Contains('"keep_vars": true') -and -not $lc.Contains('CLICK_LOG')) 'ggw switch: live config has the domains, the same database, keeps dashboard settings'
        $c = GCalls
        Check ($c.LastIndexOf('deployments list') -lt $c.LastIndexOf('deploy --config')) 'ggw switch: live version read before deploying'
        Check ((Run-G @('-Step', 'update', '-Apply', '-Approve', 'EGKRINO GGW UPDATE')) -eq 0 -and (GDeploys) -eq 3) 'ggw update with approval: deploys once'
        Check (@(Get-ChildItem -LiteralPath $gOut -Filter 'GGW_ENGINE_*.txt').Count -ge 8) 'ggw: a report for every run'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 8. mgw-engine.ps1 (same tool for Men's Gear World) with a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'mgw-engine.ps1 (fake wrangler)'
    $mTool = Join-Path (Join-Path $repo 'tools') 'mgw-engine.ps1'
    $mState = Join-Path $work 'mgw-state'
    $mWork = Join-Path $work 'mgw-work'
    $mOut = Join-Path $work 'mgw-out'
    $mBin = Join-Path $work 'mgw-bin'
    $mOld = Join-Path $work 'mgw-old-site'
    New-Item -ItemType Directory -Path $mState, $mBin -Force | Out-Null
    $mDb = [guid]::NewGuid().ToString()
    $mVer = [guid]::NewGuid().ToString()
    $mNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"whoami" >nul && goto whoami',
        'echo %* | findstr /C:"d1 list" >nul && goto d1list',
        'echo %* | findstr /C:"--command" >nul && goto query',
        'echo %* | findstr /C:"deployments list" >nul && goto deployments',
        'echo %* | findstr /C:" deploy" >nul && goto deploy',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':whoami',
        'echo You are logged in with an OAuth Token, associated with the email test@example.com.',
        'exit /b 0',
        ':d1list',
        ('echo [{"uuid":"' + $mDb + '","name":"mens-gear-world"},{"uuid":"x","name":"other-site"}]'),
        'exit /b 0',
        ':query',
        'echo [{"results":[{"site_category":"Garden Tools","retailer":"Tooled Up","n":5,"awin":0}],"success":true}]',
        'exit /b 0',
        ':deployments',
        ('echo Version(s):  (100%%) ' + $mVer),
        'exit /b 0',
        ':deploy',
        'echo Uploaded mens-gear-world',
        'echo   https://mens-gear-world-preview.example-test.workers.dev',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $mBin 'npx.cmd'), $mNpx + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $mBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $mState
    $mCalls = Join-Path $mState 'calls.log'
    function Run-M([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $mTool, '-WorkDir', $mWork, '-OldSiteDir', $mOld, '-OutDir', $mOut, '-SkipInstall', '-NoClipboard', '-NoHttpCheck') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function MCalls { if (Test-Path -LiteralPath $mCalls) { return [System.IO.File]::ReadAllText($mCalls) } else { return '' } }
    function MDeploys { return ([regex]::Matches((MCalls), 'wrangler deploy --config')).Count }
    try {
        Check ((Run-M @('-Step', 'check')) -eq 0) 'mgw check: exit 0'
        $c = MCalls
        Check ($c -match 'd1 execute mens-gear-world --remote --json --command "SELECT ' -and $c -match 'deployments list --name mens-gear-world') 'mgw check: reads products and the live version'
        Check ((MDeploys) -eq 0 -and -not ($c -match 'delete|rollback|INSERT|UPDATE')) 'mgw check: only reads'
        $rep = @(Get-ChildItem -LiteralPath $mOut -Filter 'MGW_ENGINE_CHECK_*.txt' | Select-Object -Last 1)
        Check ($rep.Count -eq 1 -and ([System.IO.File]::ReadAllText($rep[0].FullName)).Contains($mVer)) 'mgw check: report shows the live version'
        Check ((Run-M @('-Step', 'preview')) -eq 0 -and (MDeploys) -eq 0) 'mgw preview without -Apply: no deploy'
        Check ((Run-M @('-Step', 'preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ MGW SWITCH')) -eq 1 -and (MDeploys) -eq 0) 'mgw preview with the wrong phrase: no deploy'
        Check ((Run-M @('-Step', 'preview', '-Apply', '-Approve', 'egkrino mgw preview')) -eq 0 -and (MDeploys) -eq 1) 'mgw preview with approval: deploys once'
        $pc = Join-Path $mWork 'wrangler.preview.jsonc'
        $pt = $(if (Test-Path -LiteralPath $pc) { [System.IO.File]::ReadAllText($pc) } else { '' })
        Check ($pt.Contains('"name": "mens-gear-world-preview"') -and $pt.Contains($mDb) -and $pt.Contains('"CLICK_LOG": "off"') -and -not $pt.Contains('custom_domain')) 'mgw preview: separate test Worker, same database, clicks off, no domain'
        Check ((MCalls) -match 'deploy --config "[^"]*wrangler\.preview\.jsonc"') 'mgw preview: deploys the preview config'
        Check (@(Get-ChildItem -LiteralPath (Join-Path $mWork 'deploy') -Recurse -Filter 'promos.js' -ErrorAction SilentlyContinue).Count -ge 1) 'mgw preview: the deploy copy has promos/ (the site configs import it)'
        Check ((Run-M @('-Step', 'switch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ MGW SWITCH')) -eq 11 -and (MDeploys) -eq 1) 'mgw switch without the old site code: refused, no deploy'
        Write-Utf8 (Join-Path $mOld 'worker.js') 'export default {}'
        Write-Utf8 (Join-Path $mOld 'wrangler.jsonc') '{ "name": "mens-gear-world" }'
        Write-Utf8 (Join-Path $mOld '.dev.vars') 'SECRET=never-copy'
        Write-Utf8 (Join-Path (Join-Path $mOld 'public') 'index.html') '<!doctype html>'
        Check ((Run-M @('-Step', 'switch', '-Apply', '-Approve', 'wrong')) -eq 1 -and (MDeploys) -eq 1) 'mgw switch with the wrong phrase: no deploy'
        Check ((Run-M @('-Step', 'switch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ MGW SWITCH')) -eq 0 -and (MDeploys) -eq 2) 'mgw switch with approval: deploys once'
        $zips = @(Get-ChildItem -LiteralPath (Join-Path $mWork 'backups') -Filter 'old-mgw-site-*.zip' -ErrorAction SilentlyContinue)
        Check ($zips.Count -eq 1) 'mgw switch: old site code zipped first'
        if ($zips.Count -eq 1) {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $z = [System.IO.Compression.ZipFile]::OpenRead($zips[0].FullName)
            $names = @($z.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
            $z.Dispose()
            Check (($names -contains 'worker.js') -and ($names -contains 'public/index.html') -and -not ($names -contains '.dev.vars')) 'mgw switch: backup has the code and site files, never .dev.vars'
        }
        $notes = @(Get-ChildItem -LiteralPath (Join-Path $mWork 'backups') -Filter 'mgw-before-switch-*.txt' -ErrorAction SilentlyContinue)
        Check ($notes.Count -eq 1 -and ([System.IO.File]::ReadAllText($notes[0].FullName)).Contains('rollback ' + $mVer)) 'mgw switch: rollback note with the old live version'
        $lc = [System.IO.File]::ReadAllText((Join-Path $mWork 'wrangler.jsonc'))
        Check ($lc.Contains('"name": "mens-gear-world"') -and $lc.Contains($mDb) -and $lc.Contains('"pattern": "mensgearworld.com", "custom_domain": true') -and $lc.Contains('"pattern": "www.mensgearworld.com", "custom_domain": true') -and $lc.Contains('"keep_vars": true') -and -not $lc.Contains('CLICK_LOG')) 'mgw switch: live config has the domains, the same database, keeps dashboard settings'
        $c = MCalls
        Check ($c.LastIndexOf('deployments list') -lt $c.LastIndexOf('deploy --config')) 'mgw switch: live version read before deploying'
        Check ((Run-M @('-Step', 'update', '-Apply', '-Approve', 'EGKRINO MGW UPDATE')) -eq 0 -and (MDeploys) -eq 3) 'mgw update with approval: deploys once'
        Check (@(Get-ChildItem -LiteralPath $mOut -Filter 'MGW_ENGINE_*.txt').Count -ge 8) 'mgw: a report for every run'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 8b. wgw-engine.ps1 (same tool for Women's Gear World) with a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'wgw-engine.ps1 (fake wrangler)'
    $wTool = Join-Path (Join-Path $repo 'tools') 'wgw-engine.ps1'
    $wState = Join-Path $work 'wgw-state'
    $wWork = Join-Path $work 'wgw-work'
    $wOut = Join-Path $work 'wgw-out'
    $wBin = Join-Path $work 'wgw-bin'
    $wOld = Join-Path $work 'wgw-old-site'
    New-Item -ItemType Directory -Path $wState, $wBin -Force | Out-Null
    $wDb = [guid]::NewGuid().ToString()
    $wVer = [guid]::NewGuid().ToString()
    $wNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"whoami" >nul && goto whoami',
        'echo %* | findstr /C:"d1 list" >nul && goto d1list',
        'echo %* | findstr /C:"--command" >nul && goto query',
        'echo %* | findstr /C:"deployments list" >nul && goto deployments',
        'echo %* | findstr /C:" deploy" >nul && goto deploy',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':whoami',
        'echo You are logged in with an OAuth Token, associated with the email test@example.com.',
        'exit /b 0',
        ':d1list',
        ('echo [{"uuid":"' + $wDb + '","name":"womens-gear-world"},{"uuid":"x","name":"other-site"}]'),
        'exit /b 0',
        ':query',
        'echo [{"results":[{"site_category":"Garden Tools","retailer":"Tooled Up","n":5,"awin":0}],"success":true}]',
        'exit /b 0',
        ':deployments',
        ('echo Version(s):  (100%%) ' + $wVer),
        'exit /b 0',
        ':deploy',
        'echo Uploaded womens-gear-world',
        'echo   https://womens-gear-world-preview.example-test.workers.dev',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $wBin 'npx.cmd'), $wNpx + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $wBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $wState
    $wCalls = Join-Path $wState 'calls.log'
    function Run-W([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $wTool, '-WorkDir', $wWork, '-OldSiteDir', $wOld, '-OutDir', $wOut, '-SkipInstall', '-NoClipboard', '-NoHttpCheck') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function WCalls { if (Test-Path -LiteralPath $wCalls) { return [System.IO.File]::ReadAllText($wCalls) } else { return '' } }
    function WDeploys { return ([regex]::Matches((WCalls), 'wrangler deploy --config')).Count }
    try {
        Check ((Run-W @('-Step', 'check')) -eq 0) 'wgw check: exit 0'
        $c = WCalls
        Check ($c -match 'd1 execute womens-gear-world --remote --json --command "SELECT ' -and $c -match 'deployments list --name womens-gear-world') 'wgw check: reads products and the live version'
        Check ((WDeploys) -eq 0 -and -not ($c -match 'delete|rollback|INSERT|UPDATE')) 'wgw check: only reads'
        $rep = @(Get-ChildItem -LiteralPath $wOut -Filter 'WGW_ENGINE_CHECK_*.txt' | Select-Object -Last 1)
        Check ($rep.Count -eq 1 -and ([System.IO.File]::ReadAllText($rep[0].FullName)).Contains($wVer)) 'wgw check: report shows the live version'
        Check ((Run-W @('-Step', 'preview')) -eq 0 -and (WDeploys) -eq 0) 'wgw preview without -Apply: no deploy'
        Check ((Run-W @('-Step', 'preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ WGW SWITCH')) -eq 1 -and (WDeploys) -eq 0) 'wgw preview with the wrong phrase: no deploy'
        Check ((Run-W @('-Step', 'preview', '-Apply', '-Approve', 'egkrino wgw preview')) -eq 0 -and (WDeploys) -eq 1) 'wgw preview with approval: deploys once'
        $pc = Join-Path $wWork 'wrangler.preview.jsonc'
        $pt = $(if (Test-Path -LiteralPath $pc) { [System.IO.File]::ReadAllText($pc) } else { '' })
        Check ($pt.Contains('"name": "womens-gear-world-preview"') -and $pt.Contains($wDb) -and $pt.Contains('"CLICK_LOG": "off"') -and -not $pt.Contains('custom_domain')) 'wgw preview: separate test Worker, same database, clicks off, no domain'
        Check ((WCalls) -match 'deploy --config "[^"]*wrangler\.preview\.jsonc"') 'wgw preview: deploys the preview config'
        Check (@(Get-ChildItem -LiteralPath (Join-Path $wWork 'deploy') -Recurse -Filter 'promos.js' -ErrorAction SilentlyContinue).Count -ge 1) 'wgw preview: the deploy copy has promos/ (the site configs import it)'
        Check ((Run-W @('-Step', 'switch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ WGW SWITCH')) -eq 11 -and (WDeploys) -eq 1) 'wgw switch without the old site code: refused, no deploy'
        Write-Utf8 (Join-Path $wOld 'worker.js') 'export default {}'
        Write-Utf8 (Join-Path $wOld 'wrangler.jsonc') '{ "name": "womens-gear-world" }'
        Write-Utf8 (Join-Path $wOld '.dev.vars') 'SECRET=never-copy'
        Write-Utf8 (Join-Path (Join-Path $wOld 'public') 'index.html') '<!doctype html>'
        Check ((Run-W @('-Step', 'switch', '-Apply', '-Approve', 'wrong')) -eq 1 -and (WDeploys) -eq 1) 'wgw switch with the wrong phrase: no deploy'
        Check ((Run-W @('-Step', 'switch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ WGW SWITCH')) -eq 0 -and (WDeploys) -eq 2) 'wgw switch with approval: deploys once'
        $zips = @(Get-ChildItem -LiteralPath (Join-Path $wWork 'backups') -Filter 'old-wgw-site-*.zip' -ErrorAction SilentlyContinue)
        Check ($zips.Count -eq 1) 'wgw switch: old site code zipped first'
        if ($zips.Count -eq 1) {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $z = [System.IO.Compression.ZipFile]::OpenRead($zips[0].FullName)
            $names = @($z.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
            $z.Dispose()
            Check (($names -contains 'worker.js') -and ($names -contains 'public/index.html') -and -not ($names -contains '.dev.vars')) 'wgw switch: backup has the code and site files, never .dev.vars'
        }
        $notes = @(Get-ChildItem -LiteralPath (Join-Path $wWork 'backups') -Filter 'wgw-before-switch-*.txt' -ErrorAction SilentlyContinue)
        Check ($notes.Count -eq 1 -and ([System.IO.File]::ReadAllText($notes[0].FullName)).Contains('rollback ' + $wVer)) 'wgw switch: rollback note with the old live version'
        $lc = [System.IO.File]::ReadAllText((Join-Path $wWork 'wrangler.jsonc'))
        Check ($lc.Contains('"name": "womens-gear-world"') -and $lc.Contains($wDb) -and $lc.Contains('"pattern": "womensgearworld.com", "custom_domain": true') -and $lc.Contains('"pattern": "www.womensgearworld.com", "custom_domain": true') -and $lc.Contains('"keep_vars": true') -and -not $lc.Contains('CLICK_LOG')) 'wgw switch: live config has the domains, the same database, keeps dashboard settings'
        $c = WCalls
        Check ($c.LastIndexOf('deployments list') -lt $c.LastIndexOf('deploy --config')) 'wgw switch: live version read before deploying'
        Check ((Run-W @('-Step', 'update', '-Apply', '-Approve', 'EGKRINO WGW UPDATE')) -eq 0 -and (WDeploys) -eq 3) 'wgw update with approval: deploys once'
        Check (@(Get-ChildItem -LiteralPath $wOut -Filter 'WGW_ENGINE_*.txt').Count -ge 8) 'wgw: a report for every run'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 8b2. awin-feed-source.ps1 (where the feeds come from) on a fake folder
Write-Host 'awin-feed-source.ps1'
$fsRoot = Join-Path $work 'fs-home'
$fsArch = Join-Path $fsRoot 'GW_AWIN_BULK_ARCHIVE'
$fsOut = Join-Path $work 'fs-out'
New-Item -ItemType Directory -Path $fsArch, (Join-Path $fsRoot 'scripts') -Force | Out-Null
Write-Utf8 (Join-Path $fsArch 'AWIN_30645_116078.csv.gz') 'x'
$fsKey = 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6'
Write-Utf8 (Join-Path (Join-Path $fsRoot 'scripts') 'get-feeds.ps1') ("`$out = 'C:\Users\x\Downloads\GW_AWIN_BULK_ARCHIVE'`nInvoke-WebRequest -Uri 'https://productdata.awin.com/datafeed/download/apikey/$fsKey/fid/116078/format/csv' -OutFile `$out`n")
& $exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path (Join-Path $repo 'tools') 'awin-feed-source.ps1') -Archive $fsArch -SearchRoot @($fsRoot) -OutDir $fsOut -NoClipboard | Out-Null
Check ($LASTEXITCODE -eq 0) 'feed source: exit code 0'
$fsRep = @(Get-ChildItem -LiteralPath $fsOut -Filter 'AWIN_FEED_SOURCE_*.txt' -ErrorAction SilentlyContinue)
if ($fsRep.Count -ge 1) {
    $fr = [System.IO.File]::ReadAllText($fsRep[0].FullName)
    Check ($fr.Contains('get-feeds.ps1')) 'feed source: finds the download script'
    Check ($fr.Contains('Αρχεία: 1')) 'feed source: counts the feed files'
    Check (-not $fr.Contains($fsKey)) 'feed source: the download key is masked'
} else { Check $false 'feed source: report written' }

# 8b3. kgw-engine.ps1 (same tool for Kids' Gear World) with a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'kgw-engine.ps1 (fake wrangler)'
    $kTool = Join-Path (Join-Path $repo 'tools') 'kgw-engine.ps1'
    $kState = Join-Path $work 'kgw-state'
    $kWork = Join-Path $work 'kgw-work'
    $kOut = Join-Path $work 'kgw-out'
    $kBin = Join-Path $work 'kgw-bin'
    $kOld = Join-Path $work 'kgw-old-site'
    New-Item -ItemType Directory -Path $kState, $kBin -Force | Out-Null
    $kDb = [guid]::NewGuid().ToString()
    $kVer = [guid]::NewGuid().ToString()
    $kNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"whoami" >nul && goto whoami',
        'echo %* | findstr /C:"d1 list" >nul && goto d1list',
        'echo %* | findstr /C:"--command" >nul && goto query',
        'echo %* | findstr /C:"deployments list" >nul && goto deployments',
        'echo %* | findstr /C:" delete " >nul && goto delete',
        'echo %* | findstr /C:" deploy" >nul && goto deploy',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':whoami',
        'echo You are logged in with an OAuth Token, associated with the email test@example.com.',
        'exit /b 0',
        ':d1list',
        ('echo [{"uuid":"' + $kDb + '","name":"kids-gear-world"},{"uuid":"x","name":"other-site"}]'),
        'exit /b 0',
        ':query',
        'echo [{"results":[{"site_category":"Garden Tools","retailer":"Tooled Up","n":5,"awin":0}],"success":true}]',
        'exit /b 0',
        ':deployments',
        ('echo Version(s):  (100%%) ' + $kVer),
        'exit /b 0',
        ':delete',
        'echo Successfully deleted kids-gear-world-preview',
        'exit /b 0',
        ':deploy',
        'echo Uploaded kids-gear-world',
        'echo   https://kids-gear-world-preview.example-test.workers.dev',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $kBin 'npx.cmd'), $kNpx + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $kBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $kState
    $kCalls = Join-Path $kState 'calls.log'
    function Run-K([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $kTool, '-WorkDir', $kWork, '-OldSiteDir', $kOld, '-OutDir', $kOut, '-SkipInstall', '-NoClipboard', '-NoHttpCheck') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function KCalls { if (Test-Path -LiteralPath $kCalls) { return [System.IO.File]::ReadAllText($kCalls) } else { return '' } }
    function KDeploys { return ([regex]::Matches((KCalls), 'wrangler deploy --config')).Count }
    try {
        Check ((Run-K @('-Step', 'check')) -eq 0) 'kgw check: exit 0'
        $c = KCalls
        Check ($c -match 'd1 execute kids-gear-world --remote --json --command "SELECT ' -and $c -match 'deployments list --name kids-gear-world') 'kgw check: reads products and the live version'
        Check ((KDeploys) -eq 0 -and -not ($c -match 'delete|rollback|INSERT|UPDATE')) 'kgw check: only reads'
        $rep = @(Get-ChildItem -LiteralPath $kOut -Filter 'KGW_ENGINE_CHECK_*.txt' | Select-Object -Last 1)
        Check ($rep.Count -eq 1 -and ([System.IO.File]::ReadAllText($rep[0].FullName)).Contains($kVer)) 'kgw check: report shows the live version'
        Check ((Run-K @('-Step', 'preview')) -eq 0 -and (KDeploys) -eq 0) 'kgw preview without -Apply: no deploy'
        Check ((Run-K @('-Step', 'preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ KGW SWITCH')) -eq 1 -and (KDeploys) -eq 0) 'kgw preview with the wrong phrase: no deploy'
        Check ((Run-K @('-Step', 'preview', '-Apply', '-Approve', 'egkrino kgw preview')) -eq 0 -and (KDeploys) -eq 1) 'kgw preview with approval: deploys once'
        $pc = Join-Path $kWork 'wrangler.preview.jsonc'
        $pt = $(if (Test-Path -LiteralPath $pc) { [System.IO.File]::ReadAllText($pc) } else { '' })
        Check ($pt.Contains('"name": "kids-gear-world-preview"') -and $pt.Contains($kDb) -and $pt.Contains('"CLICK_LOG": "off"') -and -not $pt.Contains('custom_domain')) 'kgw preview: separate test Worker, same database, clicks off, no domain'
        Check ((KCalls) -match 'deploy --config "[^"]*wrangler\.preview\.jsonc"') 'kgw preview: deploys the preview config'
        Check (@(Get-ChildItem -LiteralPath (Join-Path $kWork 'deploy') -Recurse -Filter 'promos.js' -ErrorAction SilentlyContinue).Count -ge 1) 'kgw preview: the deploy copy has promos/ (the site configs import it)'
        Check ((Run-K @('-Step', 'switch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ KGW SWITCH')) -eq 11 -and (KDeploys) -eq 1) 'kgw switch without the old site code: refused, no deploy'
        Write-Utf8 (Join-Path $kOld 'worker.js') 'export default {}'
        Write-Utf8 (Join-Path $kOld 'wrangler.jsonc') '{ "name": "kids-gear-world" }'
        Write-Utf8 (Join-Path $kOld '.dev.vars') 'SECRET=never-copy'
        Write-Utf8 (Join-Path (Join-Path $kOld 'public') 'index.html') '<!doctype html>'
        Check ((Run-K @('-Step', 'switch', '-Apply', '-Approve', 'wrong')) -eq 1 -and (KDeploys) -eq 1) 'kgw switch with the wrong phrase: no deploy'
        Check ((Run-K @('-Step', 'switch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ KGW SWITCH')) -eq 0 -and (KDeploys) -eq 2) 'kgw switch with approval: deploys once'
        $zips = @(Get-ChildItem -LiteralPath (Join-Path $kWork 'backups') -Filter 'old-kgw-site-*.zip' -ErrorAction SilentlyContinue)
        Check ($zips.Count -eq 1) 'kgw switch: old site code zipped first'
        if ($zips.Count -eq 1) {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $z = [System.IO.Compression.ZipFile]::OpenRead($zips[0].FullName)
            $names = @($z.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
            $z.Dispose()
            Check (($names -contains 'worker.js') -and ($names -contains 'public/index.html') -and -not ($names -contains '.dev.vars')) 'kgw switch: backup has the code and site files, never .dev.vars'
        }
        $notes = @(Get-ChildItem -LiteralPath (Join-Path $kWork 'backups') -Filter 'kgw-before-switch-*.txt' -ErrorAction SilentlyContinue)
        Check ($notes.Count -eq 1 -and ([System.IO.File]::ReadAllText($notes[0].FullName)).Contains('rollback ' + $kVer)) 'kgw switch: rollback note with the old live version'
        $lc = [System.IO.File]::ReadAllText((Join-Path $kWork 'wrangler.jsonc'))
        Check ($lc.Contains('"name": "kids-gear-world"') -and $lc.Contains($kDb) -and $lc.Contains('"pattern": "kidsgearworld.com", "custom_domain": true') -and $lc.Contains('"pattern": "www.kidsgearworld.com", "custom_domain": true') -and $lc.Contains('"keep_vars": true') -and -not $lc.Contains('CLICK_LOG')) 'kgw switch: live config has the domains, the same database, keeps dashboard settings'
        $c = KCalls
        Check ($c.LastIndexOf('deployments list') -lt $c.LastIndexOf('deploy --config')) 'kgw switch: live version read before deploying'
        Check ((Run-K @('-Step', 'update', '-Apply', '-Approve', 'EGKRINO KGW UPDATE')) -eq 0 -and (KDeploys) -eq 3) 'kgw update with approval: deploys once'
        function KDeletes { return ([regex]::Matches((KCalls), 'wrangler delete ')).Count }
        Check ((Run-K @('-Step', 'remove-preview')) -eq 0 -and (KDeletes) -eq 0) 'kgw remove-preview without -Apply: deletes nothing'
        Check ((Run-K @('-Step', 'remove-preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ KGW SWITCH')) -eq 1 -and (KDeletes) -eq 0) 'kgw remove-preview with the wrong phrase: deletes nothing'
        Check ((Run-K @('-Step', 'remove-preview', '-Apply', '-Approve', 'egkrino kgw remove preview')) -eq 0 -and (KDeletes) -eq 1) 'kgw remove-preview with approval: one delete'
        $c = KCalls
        Check ($c -match 'wrangler delete kids-gear-world-preview\s' -and -not ($c -match 'delete kids-gear-world\s') -and (KDeploys) -eq 3) 'kgw remove-preview: only the test Worker, no deploy'
        Check (@(Get-ChildItem -LiteralPath $kOut -Filter 'KGW_ENGINE_*.txt').Count -ge 8) 'kgw: a report for every run'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 8b5. cgw-engine.ps1 (same tool for Construction Gear World) with a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'cgw-engine.ps1 (fake wrangler)'
    $cTool = Join-Path (Join-Path $repo 'tools') 'cgw-engine.ps1'
    $cState = Join-Path $work 'cgw-state'
    $cWork = Join-Path $work 'cgw-work'
    $cOut = Join-Path $work 'cgw-out'
    $cBin = Join-Path $work 'cgw-bin'
    $cOld = Join-Path $work 'cgw-old-site'
    New-Item -ItemType Directory -Path $cState, $cBin -Force | Out-Null
    $cDb = [guid]::NewGuid().ToString()
    $cVer = [guid]::NewGuid().ToString()
    $cNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"whoami" >nul && goto whoami',
        'echo %* | findstr /C:"d1 list" >nul && goto d1list',
        'echo %* | findstr /C:"--command" >nul && goto query',
        'echo %* | findstr /C:"deployments list" >nul && goto deployments',
        'echo %* | findstr /C:" delete " >nul && goto delete',
        'echo %* | findstr /C:" deploy" >nul && goto deploy',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':whoami',
        'echo You are logged in with an OAuth Token, associated with the email test@example.com.',
        'exit /b 0',
        ':d1list',
        ('echo [{"uuid":"' + $cDb + '","name":"construction-gear-customers"},{"uuid":"x","name":"other-site"}]'),
        'exit /b 0',
        ':query',
        'echo [{"results":[{"site_category":"Garden Tools","retailer":"Tooled Up","n":5,"awin":0}],"success":true}]',
        'exit /b 0',
        ':deployments',
        ('echo Version(s):  (100%%) ' + $cVer),
        'exit /b 0',
        ':delete',
        'echo Successfully deleted construction-gear-uk-preview',
        'exit /b 0',
        ':deploy',
        'echo Uploaded construction-gear-uk',
        'echo   https://construction-gear-uk-preview.example-test.workers.dev',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $cBin 'npx.cmd'), $cNpx + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $cBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $cState
    $cCalls = Join-Path $cState 'calls.log'
    function Run-C([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $cTool, '-WorkDir', $cWork, '-OldSiteDir', $cOld, '-OutDir', $cOut, '-SkipInstall', '-NoClipboard', '-NoHttpCheck') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function CCalls { if (Test-Path -LiteralPath $cCalls) { return [System.IO.File]::ReadAllText($cCalls) } else { return '' } }
    function CDeploys { return ([regex]::Matches((CCalls), 'wrangler deploy --config')).Count }
    try {
        Check ((Run-C @('-Step', 'check')) -eq 0) 'cgw check: exit 0'
        $c = CCalls
        Check ($c -match 'd1 execute construction-gear-customers --remote --json --command "SELECT ' -and $c -match 'deployments list --name construction-gear-uk') 'cgw check: reads products and the live version'
        Check ((CDeploys) -eq 0 -and -not ($c -match 'delete|rollback|INSERT|UPDATE')) 'cgw check: only reads'
        $rep = @(Get-ChildItem -LiteralPath $cOut -Filter 'CGW_ENGINE_CHECK_*.txt' | Select-Object -Last 1)
        Check ($rep.Count -eq 1 -and ([System.IO.File]::ReadAllText($rep[0].FullName)).Contains($cVer)) 'cgw check: report shows the live version'
        Check ((Run-C @('-Step', 'preview')) -eq 0 -and (CDeploys) -eq 0) 'cgw preview without -Apply: no deploy'
        Check ((Run-C @('-Step', 'preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ CGW SWITCH')) -eq 1 -and (CDeploys) -eq 0) 'cgw preview with the wrong phrase: no deploy'
        Check ((Run-C @('-Step', 'preview', '-Apply', '-Approve', 'egkrino cgw preview')) -eq 0 -and (CDeploys) -eq 1) 'cgw preview with approval: deploys once'
        $pc = Join-Path $cWork 'wrangler.preview.jsonc'
        $pt = $(if (Test-Path -LiteralPath $pc) { [System.IO.File]::ReadAllText($pc) } else { '' })
        Check ($pt.Contains('"name": "construction-gear-uk-preview"') -and $pt.Contains($cDb) -and $pt.Contains('"CLICK_LOG": "off"') -and -not $pt.Contains('custom_domain')) 'cgw preview: separate test Worker, same database, clicks off, no domain'
        Check ((CCalls) -match 'deploy --config "[^"]*wrangler\.preview\.jsonc"') 'cgw preview: deploys the preview config'
        Check (@(Get-ChildItem -LiteralPath (Join-Path $cWork 'deploy') -Recurse -Filter 'promos.js' -ErrorAction SilentlyContinue).Count -ge 1) 'cgw preview: the deploy copy has promos/ (the site configs import it)'
        Check ((Run-C @('-Step', 'switch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ CGW SWITCH')) -eq 11 -and (CDeploys) -eq 1) 'cgw switch without the old site code: refused, no deploy'
        Write-Utf8 (Join-Path $cOld 'worker.js') 'export default {}'
        Write-Utf8 (Join-Path $cOld 'wrangler.jsonc') '{ "name": "construction-gear-uk" }'
        Write-Utf8 (Join-Path $cOld '.dev.vars') 'SECRET=never-copy'
        Write-Utf8 (Join-Path (Join-Path $cOld 'public') 'index.html') '<!doctype html>'
        Check ((Run-C @('-Step', 'switch', '-Apply', '-Approve', 'wrong')) -eq 1 -and (CDeploys) -eq 1) 'cgw switch with the wrong phrase: no deploy'
        Check ((Run-C @('-Step', 'switch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ CGW SWITCH')) -eq 0 -and (CDeploys) -eq 2) 'cgw switch with approval: deploys once'
        $zips = @(Get-ChildItem -LiteralPath (Join-Path $cWork 'backups') -Filter 'old-cgw-site-*.zip' -ErrorAction SilentlyContinue)
        Check ($zips.Count -eq 1) 'cgw switch: old site code zipped first'
        if ($zips.Count -eq 1) {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $z = [System.IO.Compression.ZipFile]::OpenRead($zips[0].FullName)
            $names = @($z.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
            $z.Dispose()
            Check (($names -contains 'worker.js') -and ($names -contains 'public/index.html') -and -not ($names -contains '.dev.vars')) 'cgw switch: backup has the code and site files, never .dev.vars'
        }
        $notes = @(Get-ChildItem -LiteralPath (Join-Path $cWork 'backups') -Filter 'cgw-before-switch-*.txt' -ErrorAction SilentlyContinue)
        Check ($notes.Count -eq 1 -and ([System.IO.File]::ReadAllText($notes[0].FullName)).Contains('rollback ' + $cVer)) 'cgw switch: rollback note with the old live version'
        $lc = [System.IO.File]::ReadAllText((Join-Path $cWork 'wrangler.jsonc'))
        Check ($lc.Contains('"name": "construction-gear-uk"') -and $lc.Contains($cDb) -and $lc.Contains('"pattern": "constructiongearworld.com", "custom_domain": true') -and $lc.Contains('"pattern": "www.constructiongearworld.com", "custom_domain": true') -and $lc.Contains('"keep_vars": true') -and -not $lc.Contains('CLICK_LOG')) 'cgw switch: live config has the domains, the same database, keeps dashboard settings'
        $c = CCalls
        Check ($c.LastIndexOf('deployments list') -lt $c.LastIndexOf('deploy --config')) 'cgw switch: live version read before deploying'
        Check ((Run-C @('-Step', 'update', '-Apply', '-Approve', 'EGKRINO CGW UPDATE')) -eq 0 -and (CDeploys) -eq 3) 'cgw update with approval: deploys once'
        function CDeletes { return ([regex]::Matches((CCalls), 'wrangler delete ')).Count }
        Check ((Run-C @('-Step', 'remove-preview')) -eq 0 -and (CDeletes) -eq 0) 'cgw remove-preview without -Apply: deletes nothing'
        Check ((Run-C @('-Step', 'remove-preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ CGW SWITCH')) -eq 1 -and (CDeletes) -eq 0) 'cgw remove-preview with the wrong phrase: deletes nothing'
        Check ((Run-C @('-Step', 'remove-preview', '-Apply', '-Approve', 'egkrino cgw remove preview')) -eq 0 -and (CDeletes) -eq 1) 'cgw remove-preview with approval: one delete'
        $c = CCalls
        Check ($c -match 'wrangler delete construction-gear-uk-preview\s' -and -not ($c -match 'delete construction-gear-uk\s') -and (CDeploys) -eq 3) 'cgw remove-preview: only the test Worker, no deploy'
        Check (@(Get-ChildItem -LiteralPath $cOut -Filter 'CGW_ENGINE_*.txt').Count -ge 8) 'cgw: a report for every run'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 8b4. hgw-engine.ps1 (same tool for Home Gear World) with a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'hgw-engine.ps1 (fake wrangler)'
    $hTool = Join-Path (Join-Path $repo 'tools') 'hgw-engine.ps1'
    $hState = Join-Path $work 'hgw-state'
    $hWork = Join-Path $work 'hgw-work'
    $hOut = Join-Path $work 'hgw-out'
    $hBin = Join-Path $work 'hgw-bin'
    $hOld = Join-Path $work 'hgw-old-site'
    New-Item -ItemType Directory -Path $hState, $hBin -Force | Out-Null
    $hDb = [guid]::NewGuid().ToString()
    $hVer = [guid]::NewGuid().ToString()
    $hNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"whoami" >nul && goto whoami',
        'echo %* | findstr /C:"d1 list" >nul && goto d1list',
        'echo %* | findstr /C:"--command" >nul && goto query',
        'echo %* | findstr /C:"deployments list" >nul && goto deployments',
        'echo %* | findstr /C:" delete " >nul && goto delete',
        'echo %* | findstr /C:" deploy" >nul && goto deploy',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':whoami',
        'echo You are logged in with an OAuth Token, associated with the email test@example.com.',
        'exit /b 0',
        ':d1list',
        ('echo [{"uuid":"' + $hDb + '","name":"home-gear-world"},{"uuid":"x","name":"other-site"}]'),
        'exit /b 0',
        ':query',
        'echo [{"results":[{"site_category":"Garden Tools","retailer":"Tooled Up","n":5,"awin":0}],"success":true}]',
        'exit /b 0',
        ':deployments',
        ('echo Version(s):  (100%%) ' + $hVer),
        'exit /b 0',
        ':delete',
        'echo Successfully deleted home-gear-world-preview',
        'exit /b 0',
        ':deploy',
        'echo Uploaded home-gear-world',
        'echo   https://home-gear-world-preview.example-test.workers.dev',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $hBin 'npx.cmd'), $hNpx + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $hBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $hState
    $hCalls = Join-Path $hState 'calls.log'
    function Run-H([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $hTool, '-WorkDir', $hWork, '-OldSiteDir', $hOld, '-OutDir', $hOut, '-SkipInstall', '-NoClipboard', '-NoHttpCheck') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function HCalls { if (Test-Path -LiteralPath $hCalls) { return [System.IO.File]::ReadAllText($hCalls) } else { return '' } }
    function HDeploys { return ([regex]::Matches((HCalls), 'wrangler deploy --config')).Count }
    try {
        Check ((Run-H @('-Step', 'check')) -eq 0) 'hgw check: exit 0'
        $c = HCalls
        Check ($c -match 'd1 execute home-gear-world --remote --json --command "SELECT ' -and $c -match 'deployments list --name home-gear-world') 'hgw check: reads products and the live version'
        Check ((HDeploys) -eq 0 -and -not ($c -match 'delete|rollback|INSERT|UPDATE')) 'hgw check: only reads'
        $rep = @(Get-ChildItem -LiteralPath $hOut -Filter 'HGW_ENGINE_CHECK_*.txt' | Select-Object -Last 1)
        Check ($rep.Count -eq 1 -and ([System.IO.File]::ReadAllText($rep[0].FullName)).Contains($hVer)) 'hgw check: report shows the live version'
        Check ((Run-H @('-Step', 'preview')) -eq 0 -and (HDeploys) -eq 0) 'hgw preview without -Apply: no deploy'
        Check ((Run-H @('-Step', 'preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ HGW SWITCH')) -eq 1 -and (HDeploys) -eq 0) 'hgw preview with the wrong phrase: no deploy'
        Check ((Run-H @('-Step', 'preview', '-Apply', '-Approve', 'egkrino hgw preview')) -eq 0 -and (HDeploys) -eq 1) 'hgw preview with approval: deploys once'
        $pc = Join-Path $hWork 'wrangler.preview.jsonc'
        $pt = $(if (Test-Path -LiteralPath $pc) { [System.IO.File]::ReadAllText($pc) } else { '' })
        Check ($pt.Contains('"name": "home-gear-world-preview"') -and $pt.Contains($hDb) -and $pt.Contains('"CLICK_LOG": "off"') -and -not $pt.Contains('custom_domain')) 'hgw preview: separate test Worker, same database, clicks off, no domain'
        Check ((HCalls) -match 'deploy --config "[^"]*wrangler\.preview\.jsonc"') 'hgw preview: deploys the preview config'
        Check (@(Get-ChildItem -LiteralPath (Join-Path $hWork 'deploy') -Recurse -Filter 'promos.js' -ErrorAction SilentlyContinue).Count -ge 1) 'hgw preview: the deploy copy has promos/ (the site configs import it)'
        Check ((Run-H @('-Step', 'switch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ HGW SWITCH')) -eq 11 -and (HDeploys) -eq 1) 'hgw switch without the old site code: refused, no deploy'
        Write-Utf8 (Join-Path $hOld 'worker.js') 'export default {}'
        Write-Utf8 (Join-Path $hOld 'wrangler.jsonc') '{ "name": "home-gear-world" }'
        Write-Utf8 (Join-Path $hOld '.dev.vars') 'SECRET=never-copy'
        Write-Utf8 (Join-Path (Join-Path $hOld 'public') 'index.html') '<!doctype html>'
        Check ((Run-H @('-Step', 'switch', '-Apply', '-Approve', 'wrong')) -eq 1 -and (HDeploys) -eq 1) 'hgw switch with the wrong phrase: no deploy'
        Check ((Run-H @('-Step', 'switch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ HGW SWITCH')) -eq 0 -and (HDeploys) -eq 2) 'hgw switch with approval: deploys once'
        $zips = @(Get-ChildItem -LiteralPath (Join-Path $hWork 'backups') -Filter 'old-hgw-site-*.zip' -ErrorAction SilentlyContinue)
        Check ($zips.Count -eq 1) 'hgw switch: old site code zipped first'
        if ($zips.Count -eq 1) {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $z = [System.IO.Compression.ZipFile]::OpenRead($zips[0].FullName)
            $names = @($z.Entries | ForEach-Object { $_.FullName -replace '\\', '/' })
            $z.Dispose()
            Check (($names -contains 'worker.js') -and ($names -contains 'public/index.html') -and -not ($names -contains '.dev.vars')) 'hgw switch: backup has the code and site files, never .dev.vars'
        }
        $notes = @(Get-ChildItem -LiteralPath (Join-Path $hWork 'backups') -Filter 'hgw-before-switch-*.txt' -ErrorAction SilentlyContinue)
        Check ($notes.Count -eq 1 -and ([System.IO.File]::ReadAllText($notes[0].FullName)).Contains('rollback ' + $hVer)) 'hgw switch: rollback note with the old live version'
        $lc = [System.IO.File]::ReadAllText((Join-Path $hWork 'wrangler.jsonc'))
        Check ($lc.Contains('"name": "home-gear-world"') -and $lc.Contains($hDb) -and $lc.Contains('"pattern": "homegearworld.com", "custom_domain": true') -and $lc.Contains('"pattern": "www.homegearworld.com", "custom_domain": true') -and $lc.Contains('"keep_vars": true') -and -not $lc.Contains('CLICK_LOG')) 'hgw switch: live config has the domains, the same database, keeps dashboard settings'
        $c = HCalls
        Check ($c.LastIndexOf('deployments list') -lt $c.LastIndexOf('deploy --config')) 'hgw switch: live version read before deploying'
        Check ((Run-H @('-Step', 'update', '-Apply', '-Approve', 'EGKRINO HGW UPDATE')) -eq 0 -and (HDeploys) -eq 3) 'hgw update with approval: deploys once'
        function HDeletes { return ([regex]::Matches((HCalls), 'wrangler delete ')).Count }
        Check ((Run-H @('-Step', 'remove-preview')) -eq 0 -and (HDeletes) -eq 0) 'hgw remove-preview without -Apply: deletes nothing'
        Check ((Run-H @('-Step', 'remove-preview', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ HGW SWITCH')) -eq 1 -and (HDeletes) -eq 0) 'hgw remove-preview with the wrong phrase: deletes nothing'
        Check ((Run-H @('-Step', 'remove-preview', '-Apply', '-Approve', 'egkrino hgw remove preview')) -eq 0 -and (HDeletes) -eq 1) 'hgw remove-preview with approval: one delete'
        $c = HCalls
        Check ($c -match 'wrangler delete home-gear-world-preview\s' -and -not ($c -match 'delete home-gear-world\s') -and (HDeploys) -eq 3) 'hgw remove-preview: only the test Worker, no deploy'
        Check (@(Get-ChildItem -LiteralPath $hOut -Filter 'HGW_ENGINE_*.txt').Count -ge 8) 'hgw: a report for every run'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 8b3. awin-feed-download.ps1 against a local fake Awin server (Windows only: the key is kept with DPAPI)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'awin-feed-download.ps1 (fake Awin server)'
    $fdDir = Join-Path $work 'fd'
    $fdArch = Join-Path $fdDir 'archive'
    $fdOut = Join-Path $fdDir 'out'
    New-Item -ItemType Directory -Path $fdArch -Force | Out-Null
    $fdKey = 'TestKey' + ([guid]::NewGuid().ToString('N').Substring(0, 10))
    $fdKeyFile = Join-Path $fdDir 'key.dat'
    [System.IO.File]::WriteAllText($fdKeyFile, (ConvertFrom-SecureString (ConvertTo-SecureString $fdKey -AsPlainText -Force)), [System.Text.Encoding]::ASCII)
    $srv = Join-Path $fdDir 'server.js'
    Write-Utf8 $srv ("const http=require('http'),zlib=require('zlib');const key=process.argv[2];" +
      "const list='Advertiser ID,Advertiser Name,Membership Status,Feed ID,No of products,Last Imported\n30645,Coes,active,116078,2,2026-10-20\n55555,Other,not joined,1,9,2026-10-20\n';" +
      "const feed=zlib.gzipSync('aw_product_id,product_name,merchant_deep_link,search_price\n1,A Jacket,https://www.coes.co.uk/products/a,10\n2,B Shirt,https://www.coes.co.uk/products/b,20\n');" +
      "http.createServer((q,s)=>{if(!q.url.includes('/apikey/'+key+'/')&&!q.url.endsWith('/apikey/'+key)){s.writeHead(403);return s.end('bad key')}" +
      "if(q.url.startsWith('/datafeed/list/')){s.writeHead(200,{'Content-Type':'text/csv'});return s.end(list)}" +
      "if(q.url.includes('/fid/116078/')&&q.url.includes('columns/')){s.writeHead(200,{'Content-Type':'application/x-gzip'});return s.end(feed)}" +
      "s.writeHead(404);s.end('no')}).listen(8799,'127.0.0.1');")
    $node = (Get-Command node).Source
    $proc = Start-Process -FilePath $node -ArgumentList @($srv, $fdKey) -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2
    function Run-Fd([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path (Join-Path $repo 'tools') 'awin-feed-download.ps1'), '-Archive', $fdArch, '-KeyFile', $fdKeyFile, '-BaseUrl', 'http://127.0.0.1:8799', '-OutDir', $fdOut, '-NoClipboard') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    try {
        Check ((Run-Fd @('-Advertiser', '30645,55555')) -eq 0) 'feed download without -Apply: exit 0'
        Check (@(Get-ChildItem -LiteralPath $fdArch -File).Count -eq 0) 'feed download without -Apply: downloads nothing'
        $fdRep = [System.IO.File]::ReadAllText((@(Get-ChildItem -LiteralPath $fdOut -Filter '*.txt')[0]).FullName)
        Check ($fdRep.Contains('116078') -and $fdRep.Contains('ΕΓΚΡΙΝΩ FEED DOWNLOAD')) 'feed download report: the feed and the phrase'
        Check ($fdRep.Contains('δεν είσαι ενεργό μέλος')) 'feed download: a programme not joined is skipped'
        Check (-not $fdRep.Contains($fdKey)) 'feed download: the key is never in the report'
        $nsArch2 = Join-Path $fdDir 'ns-archive'
        New-Item -ItemType Directory -Path $nsArch2 -Force | Out-Null
        Write-Utf8 (Join-Path $nsArch2 'AWIN_30645_116078.csv') "merchant_name,product_name,search_price,currency,in_stock`nCoes,Antler Holdall,89,GBP,1`n"
        $nsOut2 = Join-Path $fdDir 'ns-out'
        & $exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path (Join-Path $repo 'tools') 'gw-new-site-scan.ps1') -Archive $nsArch2 -OutDir $nsOut2 -KeyFile $fdKeyFile -BaseUrl 'http://127.0.0.1:8799' -NoClipboard | Out-Null
        Check ($LASTEXITCODE -eq 0) 'new site scan with the Awin list: exit 0'
        $nsAll = (@(Get-ChildItem -LiteralPath $nsOut2 -Recurse -File) | ForEach-Object { [System.IO.File]::ReadAllText($_.FullName) }) -join ' '
        Check ($nsAll -match 'Coes\s+1\s+median 89 GBP.*MEMBER') 'new site scan: marks the retailers where you are a member'
        Check (-not $nsAll.Contains($fdKey)) 'new site scan: the key is in no report or list'
        Check ((Run-Fd @('-Apply', '-Approve', 'wrong')) -eq 1) 'feed download with wrong phrase: stops'
        Write-Utf8 (Join-Path $fdArch 'AWIN_30645_116078.csv.gz') 'old copy'
        Check ((Run-Fd @('-Apply', '-Approve', 'egkrino feed download')) -eq 0) 'feed download with approval: exit 0'
        $new = Join-Path $fdArch 'AWIN_30645_116078.csv.gz'
        $b = [System.IO.File]::ReadAllBytes($new)
        Check ($b[0] -eq 0x1f -and $b[1] -eq 0x8b) 'feed download: the new feed is in place'
        Check (@(Get-ChildItem -LiteralPath (Join-Path $fdArch '_old') -Recurse -File -Filter 'AWIN_30645_116078.csv.gz').Count -eq 1) 'feed download: the old copy is kept in _old'
        $all = (@(Get-ChildItem -LiteralPath $fdOut -Filter '*.txt') | ForEach-Object { [System.IO.File]::ReadAllText($_.FullName) }) -join ' '
        Check (-not $all.Contains($fdKey)) 'feed download: the key is in no report'
        Check ((Run-Fd @('-AllJoined')) -eq 0) 'feed download -AllJoined: exit 0'
        $fdLast = [System.IO.File]::ReadAllText((@(Get-ChildItem -LiteralPath $fdOut -Filter '*.txt' | Sort-Object LastWriteTime) | Select-Object -Last 1).FullName)
        Check ($fdLast.Contains('Όλα τα προγράμματα όπου είσαι μέλος και έχουν feed: 1') -and -not $fdLast.Contains('55555')) 'feed download -AllJoined: only joined programmes'
        Check ($fdLast.Contains('σχεδόν άδειο')) 'feed download -AllJoined: an almost empty copy is listed as missing'
        Check ((Run-Fd @('-AllJoined', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ FEED DOWNLOAD')) -eq 2) 'feed download -AllJoined -Apply without -OnlyMissing: refused'
    } finally {
        if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
    }
}

# 8c. legacy-import.ps1 (new retailer into MGW/WGW) with a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'legacy-import.ps1 (fake wrangler)'
    $liTool = Join-Path (Join-Path $repo 'tools') 'legacy-import.ps1'
    $liState = Join-Path $work 'li-state'
    $liBin = Join-Path $work 'li-bin'
    $liWork = Join-Path $work 'li-work'
    $liOut = Join-Path $work 'li-out'
    New-Item -ItemType Directory -Path $liState, $liBin -Force | Out-Null
    $liBookmark = '00000085-0000024c-00004c6d-' + [guid]::NewGuid().ToString('N')
    $liNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"time-travel info" >nul && goto ttinfo',
        'echo %* | findstr /C:"sqlite_master" >nul && goto layout',
        'echo %* | findstr /C:"GROUP BY" >nul && goto group',
        'echo %* | findstr /C:"awin_product_id, is_active" >nul && goto curids',
        'echo %* | findstr /C:"--command" >nul && goto count',
        'echo %* | findstr /C:"--file" >nul && goto ok',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':ttinfo',
        ('echo The current bookmark is ' + $liBookmark),
        'exit /b 0',
        ':layout',
        'if defined GW_FAKE_BADLAYOUT goto layoutbad',
        'echo [{"results":[{"n":1}],"success":true}]',
        'exit /b 0',
        ':layoutbad',
        'echo [{"results":[{"n":0}],"success":true}]',
        'exit /b 0',
        ':curids',
        'echo [{"results":[{"id":77,"awin_product_id":"30645:old-product","is_active":1},{"id":78,"awin_product_id":"30645:beaufort","is_active":1}],"success":true}]',
        'exit /b 0',
        ':group',
        'echo [{"results":[{"site_category":"Clothing","n":1}],"success":true}]',
        'exit /b 0',
        ':count',
        'echo [{"results":[{"n":0,"active":0}],"success":true}]',
        'exit /b 0',
        ':ok',
        'echo OK',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $liBin 'npx.cmd'), $liNpx + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $liBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $liState
    $liCalls = Join-Path $liState 'calls.log'
    function Run-Li([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $liTool, '-Retailer', 'coes', '-Archive', $arch, '-WorkDir', $liWork, '-OutDir', $liOut, '-NoClipboard') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function LiCalls { if (Test-Path -LiteralPath $liCalls) { return [System.IO.File]::ReadAllText($liCalls) } else { return '' } }
    try {
        Check ((Run-Li @('-Site', 'mgw')) -eq 0) 'legacy import without -Apply: exit 0'
        Check (-not ((LiCalls) -match '--file|time-travel')) 'legacy import without -Apply: only reads'
        Check (-not ((LiCalls) -match 'INSERT|UPDATE|DELETE')) 'legacy import without -Apply: only SELECT sent'
        Check ((Run-Li @('-Site', 'mgw', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ COES WGW')) -eq 1) 'legacy import with the other site''s phrase: stops'
        Check (-not ((LiCalls) -match '--file')) 'legacy import with wrong phrase: loads nothing'
        $env:GW_FAKE_BADLAYOUT = '1'
        Check ((Run-Li @('-Site', 'mgw', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ COES MGW')) -eq 5) 'legacy import: unexpected table layout stops before anything'
        Remove-Item Env:\GW_FAKE_BADLAYOUT
        Check (-not ((LiCalls) -match '--file')) 'legacy import: bad layout loads nothing'
        Check ((Run-Li @('-Site', 'mgw', '-Apply', '-Approve', 'egkrino coes mgw')) -eq 0) 'legacy import with approval (Latin form): exit 0'
        $c = LiCalls
        $iBackup = $c.IndexOf('time-travel info mens-gear-world')
        $iExec = $c.IndexOf('d1 execute mens-gear-world --remote --file')
        Check ($iBackup -ge 0 -and $iExec -gt $iBackup) 'legacy import: restore point before loading'
        Check (-not ($c -match 'womens-gear-world')) 'legacy import: the other site is not touched'
        Check ($c -match 'hide-gone\.sql') 'legacy import: a product no longer in the feed is hidden'
        $goneUndo = @(Get-ChildItem -LiteralPath (Join-Path $liWork 'backups') -Filter '*-gone-*-rollback.sql' -ErrorAction SilentlyContinue)
        Check ($goneUndo.Count -eq 1 -and ([System.IO.File]::ReadAllText($goneUndo[0].FullName)).Contains('SET is_active = 1') -and ([System.IO.File]::ReadAllText($goneUndo[0].FullName)).Contains('WHERE id IN (77)')) 'legacy import: rollback for the hidden products, by id'
        $liNotes = @(Get-ChildItem -LiteralPath (Join-Path $liWork 'backups') -Filter '*-restore-point-*.txt' -ErrorAction SilentlyContinue)
        Check ($liNotes.Count -eq 1 -and ([System.IO.File]::ReadAllText($liNotes[0].FullName)).Contains($liBookmark)) 'legacy import: restore point written with the bookmark'
        $liReports = @(Get-ChildItem -LiteralPath $liOut -Filter 'IMPORT_COES_MGW_*.txt' -ErrorAction SilentlyContinue)
        Check ($liReports.Count -ge 4) 'legacy import: a report for every run'
        $lastLi = [System.IO.File]::ReadAllText(($liReports | Sort-Object LastWriteTime | Select-Object -Last 1).FullName)
        Check ($lastLi.Contains("DELETE FROM products WHERE retailer = 'Coes'")) 'legacy import: report shows how to remove only this retailer'

        # Add-only plan (Joybuy beauty on WGW, where Joybuy is already on the site): hides nothing, never offers
        # to delete the shop's products, and its quick undo hides only the products it adds.
        $jArch = Join-Path $work 'joybuy-arch'
        New-Item -ItemType Directory -Path $jArch -Force | Out-Null
        $jCsv = "merchant_name,aw_product_id,brand_name,merchant_product_id,merchant_category,product_name,merchant_deep_link,merchant_image_url,search_price,currency`n" +
            "Joybuy UK,1,Paco Rabanne,10551,Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne,Paco Rabanne Olympea Women's Eau de Parfum 30ml,https://www.joybuy.co.uk/landingPage/dp/olympea/10551?siteCode=GB,https://images1.joy-sourcing.com/1.jpg,37.70,GBP`n" +
            "Joybuy UK,2,Dior,10552,Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne,Dior Sauvage Eau de Toilette 100ml,https://www.joybuy.co.uk/landingPage/dp/sauvage/10552?siteCode=GB,https://images1.joy-sourcing.com/2.jpg,89,GBP`n"
        $jGz = Join-Path $jArch 'AWIN_123932_114093.csv.gz'
        $fs = [System.IO.File]::Create($jGz)
        $gz = New-Object System.IO.Compression.GZipStream($fs, [System.IO.Compression.CompressionMode]::Compress)
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($jCsv)
        $gz.Write($bytes, 0, $bytes.Length); $gz.Close(); $fs.Close()
        if (Test-Path -LiteralPath $liCalls) { Remove-Item -LiteralPath $liCalls -Force }
        $jAll = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $liTool, '-Retailer', 'joybuy', '-Site', 'wgw', '-Archive', $jArch, '-WorkDir', $liWork, '-OutDir', $liOut, '-NoClipboard', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ JOYBUY WGW')
        & $exe @jAll | Out-Null
        Check ($LASTEXITCODE -eq 0) 'legacy import add-only (Joybuy WGW): exit 0'
        $jc = LiCalls
        Check ($jc -match 'd1 execute womens-gear-world --remote --file') 'legacy import add-only: loads into WGW'
        Check (-not ($jc -match 'hide-gone\.sql')) 'legacy import add-only: hides nothing'
        $jUndo = @(Get-ChildItem -LiteralPath (Join-Path $liWork 'backups') -Filter 'wgw-joybuy-added-*-rollback.sql' -ErrorAction SilentlyContinue)
        Check ($jUndo.Count -eq 1 -and ([System.IO.File]::ReadAllText($jUndo[0].FullName)).Contains("awin_product_id IN ('123932:10551')")) 'legacy import add-only: undo hides only the new products'
        $jRep = @(Get-ChildItem -LiteralPath $liOut -Filter 'IMPORT_JOYBUY_WGW_*.txt' -ErrorAction SilentlyContinue)
        Check ($jRep.Count -eq 1 -and -not ([System.IO.File]::ReadAllText($jRep[0].FullName)).Contains('DELETE FROM products')) 'legacy import add-only: never offers to delete the shop''s products'

        # legacy-import-batch.ps1: several pairs, read-only, one report with every summary and plan.
        $bOut = Join-Path $work 'batch-out'
        $bAll = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $repo 'tools\legacy-import-batch.ps1'), '-Pairs', 'joybuy:wgw,joybuy:mgw', '-Archive', $jArch, '-WorkDir', $liWork, '-OutDir', $bOut, '-NoClipboard')
        if (Test-Path -LiteralPath $liCalls) { Remove-Item -LiteralPath $liCalls -Force }
        & $exe @bAll | Out-Null
        Check ($LASTEXITCODE -eq 0) 'import batch (read-only): exit 0'
        $bRep = @(Get-ChildItem -LiteralPath $bOut -File -Filter 'IMPORT_BATCH_*.txt')
        Check ($bRep.Count -eq 1) 'import batch: one combined report'
        if ($bRep.Count -ge 1) {
            $bt = [System.IO.File]::ReadAllText($bRep[0].FullName)
            Check ($bt.Contains('joybuy -> WGW: exit 0') -and $bt.Contains('joybuy -> MGW: exit 0') -and $bt.Contains('##### PLAN joybuy')) 'import batch: both pairs and the plan in the report'
        }
        Check (-not ((LiCalls) -match '--file|time-travel')) 'import batch without -Apply: only reads'
        $bBad = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $repo 'tools\legacy-import-batch.ps1'), '-Pairs', 'joybuy:xyz', '-OutDir', $bOut, '-NoClipboard')
        & $exe @bBad | Out-Null
        Check ($LASTEXITCODE -eq 2) 'import batch: a wrong site is refused'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 8d. legacy-cleanup.ps1 (hide wrong products on MGW/WGW) with a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'legacy-cleanup.ps1 (fake wrangler)'
    $lcTool = Join-Path (Join-Path $repo 'tools') 'legacy-cleanup.ps1'
    $lcState = Join-Path $work 'lc-state'
    $lcBin = Join-Path $work 'lc-bin'
    $lcWork = Join-Path $work 'lc-work'
    $lcOut = Join-Path $work 'lc-out'
    New-Item -ItemType Directory -Path $lcState, $lcBin -Force | Out-Null
    $lcBookmark = '00000085-0000024c-00004c6d-' + [guid]::NewGuid().ToString('N')
    $lcNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"time-travel info" >nul && goto ttinfo',
        'echo %* | findstr /C:"--file" >nul && goto file',
        'echo %* | findstr /C:"GROUP BY reason" >nul && goto summary',
        'echo %* | findstr /C:"PARTITION BY reason" >nul && goto samples',
        'echo %* | findstr /C:"NOT IN" >nul && goto kept',
        'echo %* | findstr /C:"SELECT id FROM h" >nul && goto ids',
        'echo %* | findstr /C:"SELECT id FROM x" >nul && goto ids',
        'echo %* | findstr /C:"--command" >nul && goto count',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':ttinfo',
        ('echo The current bookmark is ' + $lcBookmark),
        'exit /b 0',
        ':file',
        'echo hidden > "%GW_FAKE_STATE%\hidden.txt"',
        'echo OK',
        'exit /b 0',
        ':summary',
        'if exist "%GW_FAKE_STATE%\hidden.txt" goto empty',
        'echo [{"results":[{"reason":"political merchandise","site_category":"Clothing","n":2},{"reason":"same product, other size or colour","site_category":"Clothing","n":1}],"success":true}]',
        'exit /b 0',
        ':empty',
        'echo [{"results":[],"success":true}]',
        'exit /b 0',
        ':samples',
        'echo [{"results":[{"reason":"political merchandise","product_name":"Restore Britain Hoodie"}],"success":true}]',
        'exit /b 0',
        ':kept',
        'echo [{"results":[{"site_category":"Clothing","n":7}],"success":true}]',
        'exit /b 0',
        ':ids',
        'echo [{"results":[{"id":4},{"id":5},{"id":9}],"success":true}]',
        'exit /b 0',
        ':count',
        'echo [{"results":[{"n":10}],"success":true}]',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $lcBin 'npx.cmd'), $lcNpx + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $lcBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $lcState
    $lcCalls = Join-Path $lcState 'calls.log'
    function Run-Lc([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $lcTool, '-Rules', 'instock', '-WorkDir', $lcWork, '-OutDir', $lcOut, '-NoClipboard') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function LcCalls { if (Test-Path -LiteralPath $lcCalls) { return [System.IO.File]::ReadAllText($lcCalls) } else { return '' } }
    try {
        Check ((Run-Lc @('-Site', 'mgw')) -eq 0) 'cleanup without -Apply: exit 0'
        Check (-not ((LcCalls) -match '--file|time-travel')) 'cleanup without -Apply: only reads'
        $lcRep = [System.IO.File]::ReadAllText((@(Get-ChildItem -LiteralPath $lcOut -Filter 'CLEANUP_INSTOCK_MGW_*.txt')[0]).FullName)
        Check ($lcRep.Contains('Restore Britain Hoodie') -and $lcRep.Contains('ΕΓΚΡΙΝΩ INSTOCK CLEANUP MGW')) 'cleanup report: samples and the approval phrase'
        # KGW with the family rules (medicines, supplements, adult clothing, items for the mother): read-only and its own phrase.
        & $exe -NoProfile -ExecutionPolicy Bypass -File $lcTool -Rules family -Site kgw -WorkDir $lcWork -OutDir $lcOut -NoClipboard | Out-Null
        Check ($LASTEXITCODE -eq 0) 'cleanup family kgw without -Apply: exit 0'
        $c = LcCalls
        Check ($c -match 'd1 execute kids-gear-world --remote --json --command "WITH ' -and -not ($c -match '--file|time-travel')) 'cleanup family kgw: reads the KGW database only'
        $kgRep = @(Get-ChildItem -LiteralPath $lcOut -Filter 'CLEANUP_FAMILY_KGW_*.txt')
        Check ($kgRep.Count -eq 1 -and ([System.IO.File]::ReadAllText($kgRep[0].FullName)).Contains('ΕΓΚΡΙΝΩ FAMILY CLEANUP KGW')) 'cleanup family kgw: report with its own approval phrase'
        & $exe -NoProfile -ExecutionPolicy Bypass -File $lcTool -Rules family -Site kgw -WorkDir $lcWork -OutDir $lcOut -NoClipboard -Apply -Approve 'ΕΓΚΡΙΝΩ INSTOCK CLEANUP KGW' | Out-Null
        Check ($LASTEXITCODE -eq 1 -and -not ((LcCalls) -match '--file|time-travel')) 'cleanup family kgw with the instock phrase: stops, changes nothing'
        Check ((Run-Lc @('-Site', 'mgw', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ INSTOCK CLEANUP WGW')) -eq 1) 'cleanup with the other site''s phrase: stops'
        Check (-not ((LcCalls) -match '--file')) 'cleanup with wrong phrase: changes nothing'
        Check ((Run-Lc @('-Site', 'mgw', '-Apply', '-Approve', 'egkrino instock cleanup mgw')) -eq 0) 'cleanup with approval (Latin form): exit 0'
        $c = LcCalls
        $iBackup = $c.IndexOf('time-travel info mens-gear-world')
        $iExec = $c.IndexOf('d1 execute mens-gear-world --remote --file')
        Check ($iBackup -ge 0 -and $iExec -gt $iBackup) 'cleanup: restore point before the change'
        Check (-not ($c -match 'womens-gear-world')) 'cleanup: the other site is not touched'
        $bk = Join-Path $lcWork 'backups'
        $idsF = @(Get-ChildItem -LiteralPath $bk -Filter '*-ids.txt' -ErrorAction SilentlyContinue)
        $undoF = @(Get-ChildItem -LiteralPath $bk -Filter '*-rollback.sql' -ErrorAction SilentlyContinue)
        $hideF = @(Get-ChildItem -LiteralPath $bk -Filter '*-hide.sql' -ErrorAction SilentlyContinue)
        Check ($idsF.Count -eq 1 -and ([System.IO.File]::ReadAllText($idsF[0].FullName)) -match '4\s+5\s+9') 'cleanup: the list of hidden products is saved'
        Check ($hideF.Count -eq 1 -and ([System.IO.File]::ReadAllText($hideF[0].FullName)).Contains('SET is_active = 0') -and ([System.IO.File]::ReadAllText($hideF[0].FullName)).Contains('WHERE id IN (4, 5, 9)')) 'cleanup: hides by id only'
        Check ($undoF.Count -eq 1 -and ([System.IO.File]::ReadAllText($undoF[0].FullName)).Contains('SET is_active = 1')) 'cleanup: rollback file written'
        $rp = @(Get-ChildItem -LiteralPath $bk -Filter '*-restore-point.txt' -ErrorAction SilentlyContinue)
        Check ($rp.Count -eq 1 -and ([System.IO.File]::ReadAllText($rp[0].FullName)).Contains($lcBookmark)) 'cleanup: restore point written with the bookmark'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 8e. legacy-tidy.ps1 (names and products of the other site, MGW/WGW) with a fake wrangler (Windows only)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'legacy-tidy.ps1 (fake wrangler)'
    $tdTool = Join-Path (Join-Path $repo 'tools') 'legacy-tidy.ps1'
    $tdState = Join-Path $work 'td-state'
    $tdBin = Join-Path $work 'td-bin'
    $tdWork = Join-Path $work 'td-work'
    $tdOut = Join-Path $work 'td-out'
    New-Item -ItemType Directory -Path $tdState, $tdBin -Force | Out-Null
    $tdBookmark = '00000085-0000024c-00004c6d-' + [guid]::NewGuid().ToString('N')
    $tdNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"time-travel info" >nul && goto ttinfo',
        'echo %* | findstr /C:"--file" >nul && goto file',
        'echo %* | findstr /C:"substr(lower(retailer)" >nul && goto names',
        'echo %* | findstr /C:"instr(lower(product_name)" >nul && goto gender',
        'echo %* | findstr /C:"--command" >nul && goto count',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':ttinfo',
        ('echo The current bookmark is ' + $tdBookmark),
        'exit /b 0',
        ':file',
        'echo done > "%GW_FAKE_STATE%\done.txt"',
        'echo OK',
        'exit /b 0',
        ':names',
        'if exist "%GW_FAKE_STATE%\done.txt" goto empty',
        'type "%GW_FAKE_STATE%\names.json"',
        'exit /b 0',
        ':gender',
        'if exist "%GW_FAKE_STATE%\done.txt" goto empty',
        'echo [{"results":[{"id":2,"retailer":"Watch Enclave","site_category":"Watches","product_name":"Hugo Boss Hera Womens Watch"},{"id":3,"retailer":"InStock UK","site_category":"Clothing","product_name":"Mens and Ladies Socks"}],"success":true}]',
        'exit /b 0',
        ':empty',
        'echo [{"results":[],"success":true}]',
        'exit /b 0',
        ':count',
        'echo [{"results":[{"n":10}],"success":true}]',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $tdBin 'npx.cmd'), $tdNpx + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $tdBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $tdState
    $tdCalls = Join-Path $tdState 'calls.log'
    # wrangler writes UTF-8: a name with a right single quote must come back as it is, not as the console code page's ÔÇÖ.
    $rsq = [string][char]0x2019
    [System.IO.File]::WriteAllText((Join-Path $tdState 'names.json'), ('[{"results":[{"id":1,"retailer":"InStock UK","site_category":"Clothing","product_name":"Organic Poplin Shirt: Mens - 3XL / Cream"},{"id":7,"retailer":"InStock UK","site_category":"Clothing","product_name":"Acme KIDSRSQ Helmet – Matt - XS / Grey"}],"success":true}]').Replace('RSQ', $rsq), (New-Object System.Text.UTF8Encoding($false)))
    function Run-Td([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $tdTool, '-WorkDir', $tdWork, '-OutDir', $tdOut, '-NoClipboard') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function TdCalls { if (Test-Path -LiteralPath $tdCalls) { return [System.IO.File]::ReadAllText($tdCalls) } else { return '' } }
    try {
        Check ((Run-Td @('-Site', 'mgw')) -eq 0) 'tidy without -Apply: exit 0'
        Check (-not ((TdCalls) -match '--file|time-travel')) 'tidy without -Apply: only reads'
        $tdRep = [System.IO.File]::ReadAllText((@(Get-ChildItem -LiteralPath $tdOut -Filter 'TIDY_MGW_*.txt')[0]).FullName)
        Check ($tdRep.Contains('Hugo Boss Hera') -and $tdRep.Contains('-> Organic Poplin Shirt: Mens') -and -not $tdRep.Contains('Mens and Ladies Socks')) 'tidy report: women-only hidden, unisex kept, name sample'
        Check ($tdRep.Contains('ΕΓΚΡΙΝΩ TIDY MGW')) 'tidy report: approval phrase'
        Check ((Run-Td @('-Site', 'mgw', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ TIDY WGW')) -eq 1) 'tidy with the other site''s phrase: stops'
        Check (-not ((TdCalls) -match '--file')) 'tidy with wrong phrase: changes nothing'
        Check ((Run-Td @('-Site', 'mgw', '-Apply', '-Approve', 'egkrino tidy mgw')) -eq 0) 'tidy with approval (Latin form): exit 0'
        $c = TdCalls
        Check ($c.IndexOf('time-travel info mens-gear-world') -ge 0 -and $c.IndexOf('d1 execute mens-gear-world --remote --file') -gt $c.IndexOf('time-travel info mens-gear-world')) 'tidy: restore point before the change'
        Check (-not ($c -match 'womens-gear-world')) 'tidy: the other site is not touched'
        $runs = @(Get-ChildItem -LiteralPath (Join-Path $tdWork 'backups') -Directory -Filter 'mgw-tidy-*' | Sort-Object Name)
        $last = $runs[$runs.Count - 1].FullName
        $chg = [System.IO.File]::ReadAllText((Join-Path $last 'change.sql'))
        $und = [System.IO.File]::ReadAllText((Join-Path $last 'rollback.sql'))
        Check ($chg.Contains('SET is_active = 0') -and $chg.Contains('WHERE id IN (2)') -and $chg.Contains("product_name = 'Organic Poplin Shirt: Mens'")) 'tidy: change file by id'
        Check ($und.Contains('SET is_active = 1') -and $und.Contains("product_name = 'Organic Poplin Shirt: Mens - 3XL / Cream'")) 'tidy: rollback file has the old name'
        $chgU = [System.IO.File]::ReadAllText((Join-Path $last 'change.sql'), [System.Text.Encoding]::UTF8)
        Check ($chgU.Contains("product_name = 'Acme KIDS" + $rsq + " Helmet – Matt'") -and -not $chgU.Contains([string][char]0x2500) -and -not $chgU.Contains('Ô')) 'tidy: names with curly quotes and – are read as UTF-8 and written back unchanged'
        Check (([System.IO.File]::ReadAllText((Join-Path $last 'restore-point.txt'))).Contains($tdBookmark)) 'tidy: restore point written with the bookmark'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 8f. legacy-fix-names.ps1 (repair names broken by the tidy step) with a fake wrangler (Windows only)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'legacy-fix-names.ps1 (fake wrangler)'
    $fnTool = Join-Path (Join-Path $repo 'tools') 'legacy-fix-names.ps1'
    $fnState = Join-Path $work 'fn-state'
    $fnBin = Join-Path $work 'fn-bin'
    $fnWork = Join-Path $work 'fn-work'
    $fnOut = Join-Path $work 'fn-out'
    New-Item -ItemType Directory -Path $fnState, $fnBin -Force | Out-Null
    $fnBookmark = '00000085-0000024c-00004c6d-' + [guid]::NewGuid().ToString('N')
    $fnNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"time-travel info" >nul && goto ttinfo',
        'echo %* | findstr /C:"--file" >nul && goto file',
        'echo %* | findstr /C:"feed_product_name" >nul && goto rows',
        'echo %* | findstr /C:"--command" >nul && goto count',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':ttinfo',
        ('echo The current bookmark is ' + $fnBookmark),
        'exit /b 0',
        ':file',
        'echo done > "%GW_FAKE_STATE%\done.txt"',
        'echo OK',
        'exit /b 0',
        ':rows',
        'if exist "%GW_FAKE_STATE%\done.txt" goto empty',
        'type "%GW_FAKE_STATE%\rows.json"',
        'exit /b 0',
        ':empty',
        'echo [{"results":[],"success":true}]',
        'exit /b 0',
        ':count',
        'echo [{"results":[{"n":10}],"success":true}]',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $fnBin 'npx.cmd'), $fnNpx + "`r`n", [System.Text.Encoding]::ASCII)
    # Broken names exactly as the tidy step wrote them, the untouched feed names, and one that is not safe to fix.
    $fnRows = '[{"results":[' +
        '{"id":11,"retailer":"InStock UK","product_name":"Acme KIDSÔÇÖ Helmet","feed_product_name":"Acme KIDSRSQ Helmet - Matt Grey / XS"},' +
        '{"id":12,"retailer":"InStock UK","product_name":"Acme Banz┬« Sunglasses","feed_product_name":"Acme Banz® Sunglasses - Green / S"},' +
        '{"id":13,"retailer":"InStock UK","product_name":"Other ÔÇô Name","feed_product_name":"Different – Name - Red / S"}' +
        '],"success":true}]'
    $rsq = [string][char]0x2019
    $fnRows = $fnRows.Replace('RSQ', $rsq)
    [System.IO.File]::WriteAllText((Join-Path $fnState 'rows.json'), $fnRows, (New-Object System.Text.UTF8Encoding($false)))
    $oldPath = $env:PATH
    $env:PATH = $fnBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $fnState
    $fnCalls = Join-Path $fnState 'calls.log'
    function Run-Fn([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $fnTool, '-WorkDir', $fnWork, '-OutDir', $fnOut, '-NoClipboard') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function FnCalls { if (Test-Path -LiteralPath $fnCalls) { return [System.IO.File]::ReadAllText($fnCalls) } else { return '' } }
    try {
        Check ((Run-Fn @('-Site', 'kgw')) -eq 0) 'fix names without -Apply: exit 0'
        Check (-not ((FnCalls) -match '--file|time-travel')) 'fix names without -Apply: only reads'
        $fnRep = [System.IO.File]::ReadAllText((@(Get-ChildItem -LiteralPath $fnOut -Filter 'FIXNAMES_KGW_*.txt')[0]).FullName, [System.Text.Encoding]::UTF8)
        Check ($fnRep.Contains('-> Acme KIDS' + $rsq + ' Helmet') -and $fnRep.Contains('-> Acme Banz® Sunglasses') -and $fnRep.Contains('[13]') -and $fnRep.Contains('ΕΓΚΡΙΝΩ FIX NAMES KGW')) 'fix names report: every name before -> after, the unsafe one listed, approval phrase'
        Check ((Run-Fn @('-Site', 'kgw', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ TIDY KGW')) -eq 1 -and -not ((FnCalls) -match '--file')) 'fix names with another phrase: changes nothing'
        Check ((Run-Fn @('-Site', 'kgw', '-Apply', '-Approve', 'egkrino fix names kgw')) -eq 0) 'fix names with approval (Latin form): exit 0'
        $c = FnCalls
        Check ($c.IndexOf('time-travel info kids-gear-world') -ge 0 -and $c.IndexOf('d1 execute kids-gear-world --remote --file') -gt $c.IndexOf('time-travel info kids-gear-world')) 'fix names: restore point before the change'
        $runs = @(Get-ChildItem -LiteralPath (Join-Path $fnWork 'backups') -Directory -Filter 'kgw-fixnames-*' | Sort-Object Name)
        $last = $runs[$runs.Count - 1].FullName
        $chg = [System.IO.File]::ReadAllText((Join-Path $last 'change.sql'), [System.Text.Encoding]::UTF8)
        $und = [System.IO.File]::ReadAllText((Join-Path $last 'rollback.sql'), [System.Text.Encoding]::UTF8)
        Check ($chg.Contains("product_name = 'Acme KIDS" + $rsq + " Helmet'") -and $chg.Contains("product_name = 'Acme Banz® Sunglasses'") -and -not $chg.Contains('id = 13') -and -not $chg.Contains('is_active')) 'fix names: only the safe names, by id, nothing hidden'
        Check ($und.Contains("product_name = 'Acme KIDSÔÇÖ Helmet'")) 'fix names: rollback file has the old name'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# 9. group-site.ps1 with a fake wrangler (Windows only: runs .cmd files)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'group-site.ps1 (fake wrangler)'
    $grTool = Join-Path (Join-Path $repo 'tools') 'group-site.ps1'
    $grState = Join-Path $work 'group-state'
    $grWork = Join-Path $work 'group-work'
    $grOut = Join-Path $work 'group-out'
    $grBin = Join-Path $work 'group-bin'
    New-Item -ItemType Directory -Path $grState, $grBin -Force | Out-Null
    $grNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"whoami" >nul && goto whoami',
        'echo %* | findstr /C:"deployments list" >nul && goto deployments',
        'echo %* | findstr /C:" deploy" >nul && goto deploy',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':whoami',
        'echo You are logged in with an OAuth Token, associated with the email test@example.com.',
        'exit /b 0',
        ':deployments',
        'echo No deployments found',
        'exit /b 0',
        ':deploy',
        'echo Uploaded gear-world-group',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $grBin 'npx.cmd'), $grNpx + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $grBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $grState
    $grCalls = Join-Path $grState 'calls.log'
    function Run-Gr([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $grTool, '-WorkDir', $grWork, '-OutDir', $grOut, '-SkipInstall', '-NoClipboard', '-NoHttpCheck') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    function GrDeploys { if (Test-Path -LiteralPath $grCalls) { return ([regex]::Matches([System.IO.File]::ReadAllText($grCalls), 'wrangler deploy --config')).Count } else { return 0 } }
    try {
        Check ((Run-Gr @('-Step', 'check')) -eq 0 -and (GrDeploys) -eq 0) 'group check: exit 0, no deploy'
        Check ((Run-Gr @('-Step', 'launch')) -eq 0 -and (GrDeploys) -eq 0) 'group launch without -Apply: no deploy'
        Check ((Run-Gr @('-Step', 'launch', '-Apply', '-Approve', 'ΕΓΚΡΙΝΩ GROUP UPDATE')) -eq 1 -and (GrDeploys) -eq 0) 'group launch with the wrong phrase: no deploy'
        Check ((Run-Gr @('-Step', 'launch', '-Apply', '-Approve', 'egkrino group site')) -eq 0 -and (GrDeploys) -eq 1) 'group launch with approval: deploys once'
        $gc = [System.IO.File]::ReadAllText((Join-Path $grWork 'wrangler.jsonc'))
        Check ($gc.Contains('"pattern": "gearworldgroup.com", "custom_domain": true') -and $gc.Contains('"pattern": "www.gearworldgroup.com", "custom_domain": true') -and -not $gc.Contains('d1_databases')) 'group launch: both domains, no database'
    } finally {
        $env:PATH = $oldPath
        Remove-Item Env:\GW_FAKE_STATE -ErrorAction SilentlyContinue
    }
}

# gw-backup.ps1 with a fake home, a fake drive folder and a fake wrangler (Windows only: runs .cmd files and robocopy)
if ($isWin -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'gw-backup.ps1 (fake home and wrangler)'
    $bTool = Join-Path (Join-Path $repo 'tools') 'gw-backup.ps1'
    $bHome = Join-Path $work 'bk-home'
    $bTarget = Join-Path $work 'bk-drive\GearWorldBackup'
    $bState = Join-Path $work 'bk-state'
    $bBin = Join-Path $work 'bk-bin'
    New-Item -ItemType Directory -Path $bState, $bBin -Force | Out-Null
    Write-Utf8 (Join-Path $bHome 'gear-world-hub\worker.js') 'export default {}'
    Write-Utf8 (Join-Path $bHome 'gear-world-hub\.dev.vars') 'X=1'
    Write-Utf8 (Join-Path $bHome 'gear-world-hub\node_modules\pkg\index.js') '// package'
    Write-Utf8 (Join-Path $bHome 'construction-gear-world-engine\backups\note.txt') 'bookmark'
    Write-Utf8 (Join-Path $bHome 'Documents\private.txt') 'not gear world'
    Write-Utf8 (Join-Path $bHome 'Downloads\GW_AWIN_BULK_ARCHIVE\AWIN_1_2.csv.gz') 'feed'
    Write-Utf8 (Join-Path $bHome 'Downloads\48473-retail-en_GB.csv.gz') 'google feed'
    Write-Utf8 (Join-Path $bHome 'Downloads\holiday.jpg') 'photo'
    $bNpx = @(
        '@echo off',
        'echo %* >> "%GW_FAKE_STATE%\calls.log"',
        'echo %* | findstr /C:"d1 list" >nul && goto d1list',
        'echo %* | findstr /C:"sqlite_master" >nul && goto schema',
        'echo %* | findstr /C:"MIN(rowid)" >nul && goto range',
        'echo %* | findstr /C:"BETWEEN" >nul && goto rows',
        'echo unknown command 1>&2',
        'exit /b 1',
        ':d1list',
        'echo [{"uuid":"x","name":"test-db"}]',
        'exit /b 0',
        ':schema',
        'echo [{"results":[{"type":"table","name":"products","tbl_name":"products","sql":"CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT)"},{"type":"table","name":"products_fts","tbl_name":"products_fts","sql":"CREATE VIRTUAL TABLE products_fts USING fts5(name)"},{"type":"table","name":"products_fts_data","tbl_name":"products_fts_data","sql":"CREATE TABLE products_fts_data(id INTEGER PRIMARY KEY, block BLOB)"}],"success":true}]',
        'exit /b 0',
        ':range',
        'echo [{"results":[{"a":1,"b":5,"n":5}],"success":true}]',
        'exit /b 0',
        ':rows',
        'echo [{"results":[{"_rowid":1,"id":1,"name":"Drill"}],"success":true}]',
        'exit /b 0'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $bBin 'npx.cmd'), $bNpx + "`r`n", [System.Text.Encoding]::ASCII)
    $oldPath = $env:PATH
    $env:PATH = $bBin + ';' + $oldPath
    $env:GW_FAKE_STATE = $bState
    function Run-B([string[]]$a) {
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $bTool, '-Target', $bTarget, '-HomeDir', $bHome, '-AllowSystemDrive', '-SkipGitHub', '-PageRows', '3', '-NoClipboard') + $a
        & $exe @all | Out-Null
        return $LASTEXITCODE
    }
    try {
        $drive = ([string]$env:SystemDrive).TrimEnd(':').ToUpper()
        Check ((Run-B @()) -eq 0 -and -not (Test-Path -LiteralPath $bTarget)) 'backup without -Apply: writes nothing'
        $rep = @(Get-ChildItem -LiteralPath (Join-Path $bHome 'gear-world-reports') -Filter 'GW_BACKUP_*.txt' | Select-Object -Last 1)
        $rt = $(if ($rep.Count) { [System.IO.File]::ReadAllText($rep[0].FullName) } else { '' })
        Check ($rt.Contains('gear-world-hub') -and $rt.Contains('test-db') -and $rt.Contains('ΕΓΚΡΙΝΩ BACKUP ' + $drive) -and -not $rt.Contains('Documents')) 'backup plan: Gear World folders and databases, not other folders'
        Check ((Run-B @('-Apply', '-Approve', 'ΕΓΚΡΙΝΩ BACKUP Q')) -eq 1 -and -not (Test-Path -LiteralPath $bTarget)) 'backup with the wrong phrase: writes nothing'
        Check ((Run-B @('-Apply', '-Approve', ('egkrino backup ' + $drive))) -eq 0) 'backup with approval: exit 0'
        $f = Join-Path $bTarget 'files'
        Check ((Test-Path -LiteralPath (Join-Path $f 'gear-world-hub\worker.js')) -and (Test-Path -LiteralPath (Join-Path $f 'gear-world-hub\.dev.vars')) -and (Test-Path -LiteralPath (Join-Path $f 'construction-gear-world-engine\backups\note.txt'))) 'backup: Gear World folders copied'
        Check (-not (Test-Path -LiteralPath (Join-Path $f 'gear-world-hub\node_modules')) -and -not (Test-Path -LiteralPath (Join-Path $f 'Documents'))) 'backup: node_modules and other folders skipped'
        Check ((Test-Path -LiteralPath (Join-Path $f 'Downloads\GW_AWIN_BULK_ARCHIVE\AWIN_1_2.csv.gz')) -and (Test-Path -LiteralPath (Join-Path $f 'Downloads\48473-retail-en_GB.csv.gz')) -and -not (Test-Path -LiteralPath (Join-Path $f 'Downloads\holiday.jpg'))) 'backup: Awin feeds copied, other downloads not'
        $d = Join-Path $bTarget 'd1\test-db'
        Check ((Test-Path -LiteralPath (Join-Path $d 'products-0001.json')) -and (Test-Path -LiteralPath (Join-Path $d 'products-0002.json')) -and -not (Test-Path -LiteralPath (Join-Path $d 'products_fts_data-0001.json'))) 'backup: table rows in pages, search index tables skipped'
        Check (([System.IO.File]::ReadAllText((Join-Path $d 'schema.sql'))).Contains('CREATE VIRTUAL TABLE products_fts')) 'backup: schema has every table'
        $calls = [System.IO.File]::ReadAllText((Join-Path $bState 'calls.log'))
        Check (-not ($calls -match '(?i)INSERT|UPDATE|DELETE|DROP|deploy|time-travel restore')) 'backup: databases only read'
        Check (Test-Path -LiteralPath (Join-Path $bTarget 'README-RESTORE.txt')) 'backup: restore instructions written'
        Remove-Item -LiteralPath (Join-Path $bHome 'gear-world-hub\worker.js')
        Check ((Run-B @('-Apply', '-Approve', ('ΕΓΚΡΙΝΩ BACKUP ' + $drive), '-SkipDatabases')) -eq 0 -and (Test-Path -LiteralPath (Join-Path $f 'gear-world-hub\worker.js'))) 'backup again: a file deleted on the PC stays on the drive'
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
