<#
.SYNOPSIS
  Daily price log (lessons L100): the D1 database gear-world-prices and the private Worker gear-world-prices, which
  logs the prices of the 13 sites once a day. Read-only unless -Apply and the typed approval phrase(s).

.DESCRIPTION
  Every 15 minutes the Worker takes the next site that is not logged yet today (UTC) and writes, in its own database,
  one row per product whose price, "was" price, stock or listing changed (the first time: every product). It READS the
  13 site databases with SELECT only and never writes to them. It has no public address (no routes, workers.dev off).

  -Step check   READ-ONLY. The Cloudflare login, the 13 site databases (all must be there), the price database and its
                tables, the price Worker (live version), and the plan with its two approval phrases.
  -Step apply   CHANGES CLOUDFLARE, with -Apply and two approvals, each for its own part (both asked before anything
                changes; a part that is already done is skipped):
                  ΕΓΚΡΙΝΩ PRICES D1     (-Approve)        the D1 database gear-world-prices and its 3 empty tables
                  ΕΓΚΡΙΝΩ PRICES WORKER (-ApproveWorker)  the private Worker gear-world-prices with its 15-minute cron
                First a rollback note. The 13 sites, their databases, the Hub and gwh-sitemap do not change.
  -Step status  READ-ONLY. What the Worker logged today and the 2 days before (price_runs), site by site.
  -Step stop    CHANGES THE PRICE WORKER ONLY, with -Apply and ΕΓΚΡΙΝΩ PRICES STOP: the Worker without its cron, so it
                stops logging. The database and its data stay.
  Report: <home>\gear-world-reports\PRICES_SETUP_<STEP>_<time>.txt (also copied to the clipboard)
  Exit: 0 done, 1 no approval, 3 Node.js or npm, 4 Cloudflare login, 6 Cloudflare could not be read, 8 not ready,
        9 a Cloudflare step failed, 11 backup failed, 13 unexpected template.
#>
param(
    [ValidateSet('check', 'apply', 'status', 'stop')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$ApproveWorker = '',
    [string]$PcHome = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ PRICES D1'
$PhraseWorker = 'ΕΓΚΡΙΝΩ PRICES WORKER'
$PhraseStop = 'ΕΓΚΡΙΝΩ PRICES STOP'
$DbName = 'gear-world-prices'
$Worker = 'gear-world-prices'
$Cron = '*/15 * * * *'
$Tables = @('price_last', 'price_log', 'price_runs')
if (-not $PcHome) { $PcHome = $HOME }
if (-not $WorkDir) { $WorkDir = Join-Path $PcHome 'gear-world-prices' }
if (-not $OutDir) { $OutDir = Join-Path $PcHome 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$DashLink = 'https://dash.cloudflare.com/?to=/:account/workers-and-pages'
$D1Link = 'https://dash.cloudflare.com/?to=/:account/workers/d1'

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

# Cloudflare IDs (databases, versions) never go into a report.
function Hide-Ids([string]$Text) {
    $t = [regex]::Replace($Text, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '${1}-masked-id')
    return [regex]::Replace($t, '\b([0-9a-fA-F]{4})[0-9a-fA-F]{28}\b', '${1}-masked-id')
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('PRICES_SETUP_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('PRICES_SETUP_{0}_{1}_{2}.txt' -f $Step.ToUpper(), $stamp, $n); $n++ }
    $text = Hide-Ids ($L -join "`r`n")
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
    exit $code
}

# Normalise an approval phrase: no accents, upper case, single spaces; Latin "EGKRINO" also accepted.
function Normalize-Phrase([string]$s) {
    $d = ([string]$s).Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    $t = ($sb.ToString().ToUpperInvariant() -replace '\s+', ' ').Trim()
    return ($t -replace '^EGKRINO ', 'ΕΓΚΡΙΝΩ ')
}

# The phrase given on the command line, or typed now when none was given.
function Confirm-Approval([string]$given, [string]$phrase) {
    $typed = $given
    if (-not $typed) {
        Write-Host ''
        Write-Host ('Για να συνεχίσω, γράψε ακριβώς: {0}' -f $phrase) -ForegroundColor Yellow
        Write-Host '(ή πάτα Enter για να μη γίνει αυτό το μέρος)'
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
}

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
# -Retry: on a network error or a passing Cloudflare error (7403, 10000: lessons L43), try again, up to 3 times.
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$Retry) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder), 'set CI=true', 'set WRANGLER_SEND_METRICS=false', 'set FORCE_COLOR=0', 'set NO_COLOR=1', ('call npx --yes wrangler {0} 2>&1' -f $Arguments))
    $tries = 1
    if ($Retry) { $tries = 3 }
    $result = $null
    for ($try = 1; $try -le $tries; $try++) {
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-prices-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
        [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
        try {
            $out = @(& $cmdFile)
            $code = $LASTEXITCODE
        } finally {
            Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        }
        $text = (($out | ForEach-Object { "$_" }) -join "`n") -replace '\x1b\[[0-9;]*m', ''
        $result = @{ code = $code; text = $text }
        $passing = $text -match '(?i)fetch failed|connectivity issue|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|code: 7403|code: 10000'
        if ($code -eq 0 -or -not $passing -or $try -eq $tries) { break }
        Say ('Προσωρινό πρόβλημα με το Cloudflare. Ξαναδοκιμάζω σε {0} δευτερόλεπτα ({1}/{2})...' -f (5 * $try), ($try + 1), $tries) 'Yellow'
        Start-Sleep -Seconds (5 * $try)
    }
    return $result
}

# The JSON array that wrangler printed with --json (warnings before it are skipped), as a flat array of its items
# (Windows PowerShell 5.1 gives a JSON array back as ONE object, PowerShell 7 as its items: lessons L76).
function Get-JsonArray([string]$text) {
    $m = [regex]::Match($text, '(?m)^\s*\[')
    $j = $text.LastIndexOf(']')
    if (-not $m.Success -or $j -le $m.Index) { return $null }
    try { $parsed = ConvertFrom-Json -InputObject $text.Substring($m.Index, $j - $m.Index + 1) } catch { return $null }
    $items = New-Object System.Collections.ArrayList
    foreach ($x in @($parsed)) { if ($null -ne $x) { [void]$items.Add($x) } }
    return , $items.ToArray()
}

# Rows of a read-only SELECT on the price database, or $null on error.
function Select-Prices([string]$Folder, [string]$sql) {
    if ($sql -notmatch '^\s*SELECT ') { throw 'Only SELECT here' }
    $r = Invoke-Wrangler $Folder ('d1 execute {0} --remote --json --command "{1}"' -f $DbName, $sql) -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j -or $j.Count -lt 1) { return $null }
    return , @($j[0].results)
}

# The D1 databases of the account as name -> id, or $null when the list could not be read.
function Get-Databases([string]$folder) {
    $r = Invoke-Wrangler $folder 'd1 list --json' -Retry
    if ($r.code -ne 0) { return $null }
    $j = Get-JsonArray $r.text
    if ($null -eq $j) { return $null }
    $map = @{}
    foreach ($d in $j) { if ([string]$d.name -and [string]$d.uuid) { $map[[string]$d.name] = [string]$d.uuid } }
    return $map
}

# Copy of this repo version, ready for wrangler (npm ci once per version, so the wrangler version is fixed).
function Prepare-Deploy {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        foreach ($item in @('src', 'sites', 'promos', 'package.json', 'package-lock.json')) {
            $src = Join-Path $repo $item
            if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $dest -Recurse -Force }
        }
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-prices-npm-ci.cmd'
        [System.IO.File]::WriteAllText($cmdFile, "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n", [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
    }
    return $dest
}

# The version of a Worker that is live now (for going back). Read-only. The last "Version(s):" block is the live one,
# and it must be ONE version with 100%. Returns '' when there is none, 'missing' when the Worker does not exist.
function Get-LiveVersion([string]$folder, [string]$name) {
    $r = Invoke-Wrangler $folder ('deployments list --name {0}' -f $name) -Retry
    if ($r.code -ne 0) {
        if ($r.text -match '(?i)code: 10007|does not exist|not found') { return 'missing' }
        return ''
    }
    $at = $r.text.LastIndexOf('Version(s):')
    if ($at -lt 0) { return '' }
    $ms = [regex]::Matches($r.text.Substring($at), '\((\d+)%\)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($ms.Count -ne 1 -or $ms[0].Groups[1].Value -ne '100') { return '' }
    return $ms[0].Groups[2].Value
}

# Deploy; when Cloudflare answers "This Worker does not exist" (code 10007) right after an upload, wait and deploy
# once more: a deploy is safe to repeat (lessons L72).
function Invoke-Deploy([string]$folder, [string]$config) {
    $d = Invoke-Wrangler $folder ('deploy --config "{0}"' -f $config)
    if ($d.code -ne 0 -and $d.text -match 'code: 10007') {
        Say 'Το Cloudflare δεν απάντησε σωστά στο ανέβασμα. Ξαναδοκιμάζω σε 15 δευτερόλεπτα...' 'Yellow'
        Start-Sleep -Seconds 15
        $d = Invoke-Wrangler $folder ('deploy --config "{0}"' -f $config)
    }
    return $d
}

# The real config (wrangler.jsonc, with the database IDs) from the template, made by tools/prices-config.mjs.
# mode: run (with the cron) or stop (without). Returns the path, or '' on any problem. The IDs stay on this PC.
function Write-PricesConfig([hashtable]$dbs, [string]$mode) {
    $ids = @{}
    foreach ($n in $Names) {
        if (-not $dbs.ContainsKey($n)) { return '' }
        $ids[$n] = $dbs[$n]
    }
    $idsFile = Join-Path $WorkDir ('ids-' + $stamp + '.json')
    [System.IO.File]::WriteAllText($idsFile, ($ids | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
    $cfg = Join-Path $pricesDir 'wrangler.jsonc'
    try {
        $out = @(& node $helper write $tpl $idsFile $cfg $mode)
    } finally {
        Remove-Item -LiteralPath $idsFile -ErrorAction SilentlyContinue
    }
    if ($LASTEXITCODE -ne 0 -or (($out -join ' ') -notmatch '^ok databases=14')) { Say ('Το αρχείο ρυθμίσεων δεν έγινε: {0}' -f ($out -join ' ')) 'Red'; return '' }
    Copy-Item -LiteralPath $cfg -Destination (Join-Path $WorkDir 'wrangler.jsonc') -Force
    return $cfg
}

# ---------------- start ----------------
Say ('PRICE LOG SETUP - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$helper = Join-Path (Join-Path $repo 'tools') 'prices-config.mjs'
$tpl = Join-Path (Join-Path (Join-Path $repo 'sites') 'prices') 'wrangler.jsonc.example'
$Names = @()
foreach ($line in @(& node $helper names $tpl)) { if ("$line" -match '^db=([a-z0-9-]+)$') { $Names += $Matches[1] } }
if ($LASTEXITCODE -ne 0 -or $Names.Count -ne 14 -or $Names[0] -ne $DbName) { Say 'Το πρότυπο του Worker των τιμών δεν έχει τη μορφή που περίμενα. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 13 }
$SiteDbs = @($Names | Select-Object -Skip 1)
$deploy = Prepare-Deploy
$pricesDir = Join-Path (Join-Path $deploy 'sites') 'prices'

$who = Invoke-Wrangler $deploy 'whoami' -Retry
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    if ($who.text -match '(?i)not authenticated|wrangler login') { Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red' }
    else { Say 'Δεν μπόρεσα να ελέγξω τη σύνδεση με το Cloudflare. Στείλε στο Claude αυτό το μήνυμα.' 'Red' }
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 15)) { Say ('  ' + $line) }
    Finish 4
}
Say 'Cloudflare login: ΕΝΤΑΞΕΙ' 'Green'

# ================= what is there now (read-only) =================
$problems = New-Object System.Collections.Generic.List[string]
$dbs = Get-Databases $deploy
if ($null -eq $dbs) { Say 'Δεν μπόρεσα να διαβάσω τη λίστα των βάσεων D1. Ξανατρέξε την εντολή σε λίγο. Δεν άλλαξε τίποτα.' 'Red'; Finish 6 }
$missingSites = @($SiteDbs | Where-Object { -not $dbs.ContainsKey($_) })
if ($missingSites.Count -eq 0) { Say ('Οι {0} βάσεις των sites (μόνο ανάγνωση από τον Worker): ΕΝΤΑΞΕΙ' -f $SiteDbs.Count) 'Green' }
else {
    Say ('Βάσεις των sites: ΠΡΟΒΛΗΜΑ - λείπουν: {0}' -f ($missingSites -join ', ')) 'Red'
    $problems.Add(('λείπουν βάσεις sites: {0}' -f ($missingSites -join ', ')))
}
$dbId = ''
if ($dbs.ContainsKey($DbName)) { $dbId = $dbs[$DbName] }
$tableCount = 0
if ($dbId) {
    $t = Select-Prices $deploy ("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('price_last', 'price_log', 'price_runs') ORDER BY name")
    if ($null -eq $t) { Say ('Βάση {0}: υπάρχει, αλλά δεν διαβάστηκε: ΠΡΟΣΟΧΗ' -f $DbName) 'Yellow'; $problems.Add('η βάση των τιμών δεν διαβάστηκε') }
    else {
        $tableCount = @($t | Where-Object { $Tables -contains [string]$_.name }).Count
        if ($tableCount -eq 3) { Say ('Βάση {0}: υπάρχει ήδη, με τους 3 πίνακες: ΕΝΤΑΞΕΙ' -f $DbName) 'Green' }
        else { Say ('Βάση {0}: υπάρχει, πίνακες {1} από 3 (θα μπουν με το apply)' -f $DbName, $tableCount) }
    }
} else { Say ('Βάση {0}: δεν υπάρχει ακόμα (θα γίνει με το apply)' -f $DbName) }
$workerLive = Get-LiveVersion $deploy $Worker
$workerExists = ($workerLive -and $workerLive -ne 'missing')
if ($workerLive -eq 'missing') { Say ('Worker {0}: δεν υπάρχει ακόμα (θα γίνει με το apply)' -f $Worker) }
elseif ($workerExists) { Say ('Worker {0}: υπάρχει ήδη, η ζωντανή έκδοση βρέθηκε (για επαναφορά): ΕΝΤΑΞΕΙ' -f $Worker) 'Green' }
else { Say ('Worker {0}: ΠΡΟΣΟΧΗ - δεν μπόρεσα να διαβάσω τη ζωντανή του έκδοση' -f $Worker) 'Yellow'; $problems.Add('η ζωντανή έκδοση του Worker των τιμών δεν διαβάστηκε') }

# ================= status =================
if ($Step -eq 'status') {
    if (-not $dbId -or $tableCount -lt 3) { Say ''; Say 'Η καταγραφή τιμών δεν έχει στηθεί ακόμα (πρώτα -Step apply). Δεν άλλαξε τίποτα.' 'Yellow'; Finish 0 }
    $days = @(0, 1, 2 | ForEach-Object { [DateTime]::UtcNow.AddDays(-$_).ToString('yyyy-MM-dd') })
    $rows = Select-Prices $deploy ("SELECT day, site, status, products, changed, added, gone, writes, ms, attempts, error FROM price_runs WHERE day IN ('{0}', '{1}', '{2}') ORDER BY day DESC, site" -f $days[0], $days[1], $days[2])
    if ($null -eq $rows) { Say 'Δεν μπόρεσα να διαβάσω τη βάση των τιμών. Ξανατρέξε την εντολή σε λίγο. Δεν άλλαξε τίποτα.' 'Red'; Finish 6 }
    foreach ($d in $days) {
        $dr = @($rows | Where-Object { [string]$_.day -eq $d })
        $ok = @($dr | Where-Object { [string]$_.status -eq 'ok' }).Count
        $chg = 0
        $wr = 0
        foreach ($r in $dr) { $chg += [int]$r.changed + [int]$r.added + [int]$r.gone; $wr += [int]$r.writes }
        Say ''
        $sign = $(if ($ok -eq $SiteDbs.Count) { 'ΕΝΤΑΞΕΙ' } elseif ($dr.Count -lt $SiteDbs.Count -and @($dr | Where-Object { [string]$_.status -eq 'error' }).Count -eq 0) { 'ΣΕ ΕΞΕΛΙΞΗ' } else { 'ΠΡΟΣΟΧΗ' })
        Say ('{0} (UTC): {1}/{2} sites, {3} αλλαγές, {4} εγγραφές: {5}' -f $d, $ok, $SiteDbs.Count, $chg, $wr, $sign) $(if ($sign -eq 'ΕΝΤΑΞΕΙ') { 'Green' } elseif ($sign -eq 'ΠΡΟΣΟΧΗ') { 'Yellow' } else { '' })
        foreach ($r in $dr) {
            $line = '  {0}: {1}, προϊόντα {2}, άλλαξαν {3}, νέα {4}, έφυγαν {5}, {6} δευτ., προσπάθειες {7}' -f ([string]$r.site).ToUpper(), $r.status, $r.products, $r.changed, $r.added, $r.gone, [math]::Round([int]$r.ms / 1000, 1), $r.attempts
            if ([string]$r.error) { $line += (' - λάθος: ' + [string]$r.error) }
            Say $line
        }
    }
    Say ''
    Say ('Worker {0}: {1}' -f $Worker, $(if ($workerExists) { 'υπάρχει' } else { 'ΔΕΝ βρέθηκε' }))
    Say 'Μόνο ανάγνωση: δεν άλλαξε τίποτα.' 'Green'
    Finish 0
}

# ================= stop: the Worker without its cron =================
if ($Step -eq 'stop') {
    if ($workerLive -eq 'missing') { Say ''; Say ('Ο Worker {0} δεν υπάρχει: τίποτα να σταματήσω.' -f $Worker) 'Green'; Finish 0 }
    if (-not $workerExists -or $missingSites.Count -gt 0 -or -not $dbId) { Say ''; Say 'ΠΡΟΒΛΗΜΑ: δεν είναι όλα έτοιμα, οπότε ΔΕΝ αλλάζω τίποτα:' 'Red'; foreach ($p in $problems) { Say ('  - ' + $p) }; Finish 8 }
    Say ''
    Say ('Τι θα γίνει με -Step stop -Apply και τη φράση {0}:' -f $PhraseStop)
    Say '  1. Σημείωμα επαναφοράς με τη ζωντανή έκδοση του Worker.'
    Say ('  2. Ο Worker {0} ανεβαίνει ξανά ΧΩΡΙΣ το ρολόι των 15 λεπτών: σταματά να καταγράφει. Η βάση και τα δεδομένα της μένουν.' -f $Worker)
    Say '  Τα sites και οι βάσεις τους ΔΕΝ αλλάζουν.'
    if (-not $Apply) { Say ''; Say 'Μόνο έλεγχος (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
    if (-not (Confirm-Approval $Approve $PhraseStop)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
    $bdir = Join-Path (Join-Path $WorkDir 'backups') ('before-prices-stop-' + $stamp)
    New-Item -ItemType Directory -Path $bdir -Force | Out-Null
    $note = @(
        ('Gear World price log before the stop ({0}), {1}' -f (Split-Path -Leaf $repo), (Get-Date -Format 'yyyy-MM-dd HH:mm')),
        ('Live version of {0} before the stop: {1}' -f $Worker, $workerLive),
        'To start the logging again (only with approval): tools/prices-setup.ps1 -Step apply -Apply -ApproveWorker (phrase ΕΓΚΡΙΝΩ PRICES WORKER).',
        'The price database and its data were not changed.'
    )
    $noteFile = Join-Path $bdir 'rollback.txt'
    [System.IO.File]::WriteAllText($noteFile, ($note -join "`r`n") + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
    if (-not (Test-Path -LiteralPath $noteFile)) { Say 'Το σημείωμα επαναφοράς δεν γράφτηκε: ΔΕΝ άλλαξα τίποτα.' 'Red'; Finish 11 }
    Say ('1. Σημείωμα επαναφοράς: {0}: ΕΝΤΑΞΕΙ' -f $noteFile) 'Green'
    $cfg = Write-PricesConfig $dbs 'stop'
    if (-not $cfg) { Finish 13 }
    $d = Invoke-Deploy $pricesDir $cfg
    if ($d.code -ne 0) { Say 'Ο Worker δεν ανέβηκε: συνεχίζει να καταγράφει όπως πριν. Έξοδος:' 'Red'; Say $d.text; Finish 9 }
    if ($d.text.Contains($Cron)) { Say '2. Ο Worker ανέβηκε, αλλά το wrangler δείχνει ακόμα το ρολόι: ΠΡΟΣΟΧΗ. Στείλε στο Claude αυτό το μήνυμα.' 'Yellow'; Finish 9 }
    Say ('2. Worker {0} χωρίς ρολόι: δεν καταγράφει πια. Τα δεδομένα μένουν: ΕΝΤΑΞΕΙ' -f $Worker) 'Green'
    Finish 0
}

# ================= check and apply =================
$needDb = (-not $dbId -or $tableCount -lt 3)
Say ''
Say 'Τι θα γίνει με -Step apply -Apply (κάθε μέρος με τη δική του φράση, και οι δύο ζητιούνται πριν αλλάξει οτιδήποτε):'
Say '  1. Σημείωμα επαναφοράς (τι υπάρχει τώρα και πώς γυρίζει πίσω).'
if ($needDb) { Say ('  2. [{0}] Η βάση D1 {1} και οι 3 άδειοι πίνακες price_last, price_log, price_runs.' -f $Phrase, $DbName) }
else { Say ('  2. Η βάση {0}: υπάρχει ήδη με τους πίνακές της, δεν ξαναγίνεται (δεν χρειάζεται η φράση {1}).' -f $DbName, $Phrase) }
Say ('  3. [{0}] Ο ιδιωτικός Worker {1} (χωρίς δημόσια διεύθυνση) με ρολόι κάθε 15 λεπτά: ένα site τη φορά, και τα 13 σε περίπου 3 ώρες.' -f $PhraseWorker, $Worker)
Say '  4. Έλεγχος: οι 3 πίνακες, η ζωντανή έκδοση του Worker και το ρολόι του.'
Say '  Ο Worker ΜΟΝΟ διαβάζει τις 13 βάσεις των sites (μόνο SELECT) και γράφει μόνο στη δική του βάση.'
Say '  Πρώτη μέρα: περίπου 460.000 εγγραφές (όλα τα προϊόντα μία φορά). Μετά: μόνο ό,τι αλλάζει. Μέσα στο Workers Paid: κανένα επιπλέον κόστος.'
Say '  Τα sites, οι βάσεις τους, το Hub, ο gwh-sitemap, ο μετρητής των αφισών και οι προγραμματισμένες εργασίες ΔΕΝ αλλάζουν.'
Say ('  Σταμάτημα, αν χρειαστεί: -Step stop -Apply με τη φράση {0} (φεύγει το ρολόι, τα δεδομένα μένουν). Ή στο Cloudflare: {1} > {2} > Settings > Trigger events.' -f $PhraseStop, $DashLink, $Worker)
if ($Step -eq 'check') {
    Say ''
    if ($problems.Count -eq 0) { Say 'Αποτέλεσμα: ΕΝΤΑΞΕΙ - όλα έτοιμα για το apply. Μόνο έλεγχος: δεν άλλαξε τίποτα.' 'Green' }
    else {
        Say 'Αποτέλεσμα: ΠΡΟΒΛΗΜΑ - αυτά πρέπει να διορθωθούν πριν από το apply (μόνο έλεγχος: δεν άλλαξε τίποτα):' 'Red'
        foreach ($p in $problems) { Say ('  - ' + $p) }
    }
    Finish 0
}

if ($problems.Count -gt 0) {
    Say ''
    Say 'ΠΡΟΒΛΗΜΑ: δεν είναι όλα έτοιμα, οπότε ΔΕΝ αλλάζω τίποτα:' 'Red'
    foreach ($p in $problems) { Say ('  - ' + $p) }
    Finish 8
}
if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }

# Both approvals first, before anything changes.
if ($needDb -and -not (Confirm-Approval $Approve $Phrase)) { Say ('Δεν δόθηκε η φράση {0}: σταμάτησα χωρίς αλλαγές.' -f $Phrase) 'Yellow'; Finish 1 }
$okWorker = Confirm-Approval $ApproveWorker $PhraseWorker
if (-not $okWorker -and -not $needDb) { Say ('Δεν δόθηκε η φράση {0}: σταμάτησα χωρίς αλλαγές.' -f $PhraseWorker) 'Yellow'; Finish 1 }
if (-not $okWorker) { Say ('Δεν δόθηκε η φράση {0}: γίνεται ΜΟΝΟ η βάση (άδεια, δεν κάνει τίποτα μόνη της). Ο Worker δεν ανεβαίνει.' -f $PhraseWorker) 'Yellow' }

# 1. Rollback note first
$bdir = Join-Path (Join-Path $WorkDir 'backups') ('before-prices-' + $stamp)
New-Item -ItemType Directory -Path $bdir -Force | Out-Null
$note = @(
    ('Gear World price log before the setup ({0}), {1}' -f (Split-Path -Leaf $repo), (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    ('Before: database {0}: {1}. Worker {2}: {3}.' -f $DbName, $(if ($dbId) { ('existed, {0} of 3 tables' -f $tableCount) } else { 'did not exist' }), $Worker, $(if ($workerExists) { ('live version ' + $workerLive) } else { 'did not exist' })),
    'To go back (only with approval):',
    '  - Stop the logging: tools/prices-setup.ps1 -Step stop -Apply (phrase ΕΓΚΡΙΝΩ PRICES STOP). The Worker stays without its cron; the data stay.',
    ('  - Or in the Cloudflare dashboard: {0} > {1} > Settings > Trigger events: delete the cron.' -f $DashLink, $Worker)
)
if ($workerExists) { $note += ('  - The Worker code before: npx wrangler rollback {0} --name {1}' -f $workerLive, $Worker) }
$note += ('  - The database {0} holds only the price log. Deleting it needs its own approval phrase (not in this tool): {1}' -f $DbName, $D1Link)
$note += '  - The 13 site databases are not changed by this setup or by the Worker: it only reads them (SELECT).'
$noteFile = Join-Path $bdir 'rollback.txt'
[System.IO.File]::WriteAllText($noteFile, ($note -join "`r`n") + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
$listFile = Join-Path $bdir 'databases-before.txt'
[System.IO.File]::WriteAllText($listFile, ((@($dbs.Keys) | Sort-Object) -join "`r`n") + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
if (-not (Test-Path -LiteralPath $noteFile) -or -not (Test-Path -LiteralPath $listFile)) { Say 'Το σημείωμα επαναφοράς δεν γράφτηκε: ΔΕΝ άλλαξα τίποτα.' 'Red'; Finish 11 }
Say ''
Say ('1. Σημείωμα επαναφοράς: {0}: ΕΝΤΑΞΕΙ' -f $noteFile) 'Green'

# 2. The database and its tables
if ($needDb) {
    if (-not $dbId) {
        $c = Invoke-Wrangler $deploy ('d1 create {0}' -f $DbName) -Retry
        if ($c.code -ne 0 -and $c.text -notmatch '(?i)already exists') { Say 'Η βάση δεν έγινε. Τίποτα άλλο δεν άλλαξε. Έξοδος:' 'Red'; Say $c.text; Finish 9 }
        $dbs = Get-Databases $deploy
        if ($null -eq $dbs -or -not $dbs.ContainsKey($DbName)) { Say 'Η βάση έγινε, αλλά δεν τη βρίσκω στη λίστα. Ξανατρέξε την ίδια εντολή σε 1 λεπτό (είναι ασφαλές).' 'Red'; Finish 9 }
        $dbId = $dbs[$DbName]
    }
}
$cfg = Write-PricesConfig $dbs 'run'
if (-not $cfg) { Finish 13 }
if ($needDb) {
    $m = Invoke-Wrangler $pricesDir ('d1 migrations apply {0} --remote --config "{1}"' -f $DbName, $cfg) -Retry
    if ($m.code -ne 0) { Say 'Οι πίνακες δεν έγιναν. Τα sites δεν άλλαξαν. Έξοδος:' 'Red'; Say $m.text; Finish 9 }
    $t = Select-Prices $pricesDir ("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('price_last', 'price_log', 'price_runs') ORDER BY name")
    if ($null -eq $t -or @($t | Where-Object { $Tables -contains [string]$_.name }).Count -ne 3) { Say 'Δεν βρίσκω και τους 3 πίνακες μετά το migration. Τα sites δεν άλλαξαν.' 'Red'; Finish 9 }
    Say ('2. Βάση {0} με τους 3 άδειους πίνακες: ΕΝΤΑΞΕΙ' -f $DbName) 'Green'
} else {
    Say ('2. Βάση {0}: υπήρχε ήδη με τους πίνακές της (δεν άλλαξε): ΕΝΤΑΞΕΙ' -f $DbName) 'Green'
}
if (-not $okWorker) {
    Say ''
    Say ('Η βάση είναι έτοιμη. Ο Worker ΔΕΝ ανέβηκε: για να ξεκινήσει η καταγραφή, ξανατρέξε με -ApproveWorker και τη φράση {0}.' -f $PhraseWorker) 'Yellow'
    Finish 1
}

# 3. The private Worker with its cron
$d = Invoke-Deploy $pricesDir $cfg
if ($d.code -ne 0) { Say 'Ο Worker δεν ανέβηκε. Η βάση έμεινε (άδεια ή όπως ήταν). Τα sites δεν άλλαξαν. Έξοδος:' 'Red'; Say $d.text; Finish 9 }
if ($d.text -match '(?i)https://[^\s]*workers\.dev') { Say '3. ΠΡΟΣΟΧΗ: το wrangler έδωσε διεύθυνση workers.dev, ενώ ο Worker πρέπει να μην έχει καμία. Στείλε στο Claude αυτό το μήνυμα.' 'Yellow'; Finish 9 }
$cv = Get-LiveVersion $pricesDir $Worker
if (-not $cv -or $cv -eq 'missing' -or ($workerExists -and $cv -eq $workerLive)) { Say '3. Ο Worker ανέβηκε, αλλά δεν βρίσκω νέα ζωντανή έκδοση: ΠΡΟΣΟΧΗ. Ξανατρέξε σε 1 λεπτό (είναι ασφαλές).' 'Yellow'; Finish 9 }
Say ('3. Worker {0} (χωρίς δημόσια διεύθυνση): νέα ζωντανή έκδοση: ΕΝΤΑΞΕΙ' -f $Worker) 'Green'
if ($d.text.Contains($Cron)) { Say ('4. Ρολόι: κάθε 15 λεπτά ({0}): ΕΝΤΑΞΕΙ' -f $Cron) 'Green' }
else { Say '4. Ρολόι: το wrangler δεν το έδειξε στην έξοδο: ΠΡΟΣΟΧΗ. Ο Claude θα το ελέγξει με μόνο ανάγνωση.' 'Yellow' }
Say ''
Say 'ΕΤΟΙΜΟ. Η πρώτη καταγραφή ξεκινά μόνη της μέσα σε 15 λεπτά: ένα site κάθε 15 λεπτά, και τα 13 σε περίπου 3 ώρες.' 'Green'
Say 'Γράψε στο Claude «έγινε»: ελέγχει τις πρώτες καταγραφές με μόνο ανάγνωση.'
Say ('Σταμάτημα, αν χρειαστεί: {0}' -f $noteFile)
Finish 0
