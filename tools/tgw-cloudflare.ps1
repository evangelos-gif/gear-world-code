<#
.SYNOPSIS
  Technology Gear World - Cloudflare steps, one at a time, each with a typed approval.

.DESCRIPTION
  -Step check    READ-ONLY. Shows the Cloudflare account wrangler is logged in to and whether the TGW
                 database and the local config already exist. Changes nothing.
  -Step d1       CHANGES CLOUDFLARE. Creates the empty D1 database "technology-gear-world" and its tables.
                 Approval phrase: ΕΓΚΡΙΝΩ TGW D1
  -Step preview  CHANGES CLOUDFLARE. Publishes the site ONLY on its test address (*.workers.dev), never on
                 technologygearworld.com. The test address is hidden from Google (noindex).
                 Approval phrase: ΕΓΚΡΙΝΩ TGW PREVIEW
  -Step import   CHANGES THE TGW DATABASE. Backs up the TGW database first, then loads the products from the
                 Awin feed (the same plan as tgw-import-plan). Approval phrase: ΕΓΚΡΙΝΩ TGW IMPORT

  Without -Apply, every step only shows what it WOULD do. With -Apply, it still asks you to type the approval
  phrase before it changes anything. It never touches the other Gear World sites or their databases.

  Files on this PC: <home>\technology-gear-world\  (wrangler.jsonc with the database ID, deploy\, backups\)
  Report: <home>\gear-world-reports\TGW_CLOUDFLARE_<step>_<time>.txt (also copied to the clipboard)
#>
param(
    [ValidateSet('check', 'd1', 'preview', 'import')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Archive = '',
    [string]$WorkDir = '',
    [string]$OutDir = '',
    [switch]$SkipInstall,
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$DbName = 'technology-gear-world'
$WorkerName = 'technology-gear-world'
$Phrases = @{ d1 = 'ΕΓΚΡΙΝΩ TGW D1'; preview = 'ΕΓΚΡΙΝΩ TGW PREVIEW'; import = 'ΕΓΚΡΙΝΩ TGW IMPORT' }
if (-not $WorkDir) { $WorkDir = Join-Path $HOME 'technology-gear-world' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
$configPath = Join-Path $WorkDir 'wrangler.jsonc'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('TGW_CLOUDFLARE_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $text = $L -join "`r`n"
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

# Runs wrangler through a temporary .cmd file, so output is plain text in Windows PowerShell 5.1.
function Invoke-Wrangler([string]$Folder, [string]$Arguments, [switch]$NonInteractive) {
    if ($Arguments -match '[&|<>^%]') { throw 'Unsafe characters in wrangler arguments' }
    $tmp = [System.IO.Path]::GetTempPath()
    $cmdFile = Join-Path $tmp ('gw-wrangler-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.cmd')
    $lines = @('@echo off', ('cd /d "{0}"' -f $Folder))
    if ($NonInteractive) { $lines += 'set CI=true' }
    $lines += 'set WRANGLER_SEND_METRICS=false'
    $lines += ('call npx --yes wrangler {0} 2>&1' -f $Arguments)
    [System.IO.File]::WriteAllText($cmdFile, ($lines -join "`r`n") + "`r`n", [System.Text.Encoding]::ASCII)
    try {
        $out = @(& $cmdFile)
        $code = $LASTEXITCODE
    } finally {
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    }
    return @{ code = $code; text = (($out | ForEach-Object { "$_" }) -join "`n") }
}

function Get-JsonArray([string]$text) {
    $i = $text.IndexOf('[')
    $j = $text.LastIndexOf(']')
    if ($i -lt 0 -or $j -le $i) { return $null }
    try { return @($text.Substring($i, $j - $i + 1) | ConvertFrom-Json) } catch { return $null }
}

function Find-Database([string]$folder) {
    $r = Invoke-Wrangler $folder 'd1 list --json'
    $list = Get-JsonArray $r.text
    if ($null -eq $list) { return @{ ok = $false; text = $r.text } }
    foreach ($db in $list) {
        if ($db.name -eq $DbName) { return @{ ok = $true; found = $true; id = [string]$db.uuid } }
    }
    return @{ ok = $true; found = $false; id = '' }
}

function Mask-Id([string]$id) { if ($id.Length -ge 8) { return $id.Substring(0, 4) + '...' + $id.Substring($id.Length - 4) } else { return $id } }

# Copy of this repo version, with the real wrangler.jsonc, ready for wrangler (npm ci once per version).
function Prepare-Deploy {
    $ver = (Split-Path -Leaf $repo) -replace '[^A-Za-z0-9\-]', ''
    $dest = Join-Path (Join-Path $WorkDir 'deploy') $ver
    if (-not (Test-Path -LiteralPath (Join-Path $dest 'package.json'))) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        foreach ($item in @('src', 'sites', 'package.json', 'package-lock.json')) {
            Copy-Item -LiteralPath (Join-Path $repo $item) -Destination $dest -Recurse -Force
        }
    }
    if ((Test-Path -LiteralPath $configPath)) {
        Copy-Item -LiteralPath $configPath -Destination (Join-Path (Join-Path $dest 'sites') 'tgw') -Force
    }
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $dest 'node_modules'))) {
        Say 'Εγκαθιστώ τα εργαλεία (npm ci, μία φορά ανά έκδοση, 1-2 λεπτά)...'
        $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-npm-ci.cmd'
        $body = "@echo off`r`ncd /d `"$dest`"`r`ncall npm ci --no-audit --no-fund >nul 2>&1`r`n"
        [System.IO.File]::WriteAllText($cmdFile, $body, [System.Text.Encoding]::ASCII)
        & $cmdFile
        $code = $LASTEXITCODE
        Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
        if ($code -ne 0) { Say 'Η εγκατάσταση (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
    }
    return $dest
}

# ---------------- start ----------------
Say ('TGW CLOUDFLARE - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ('Code version: {0}' -f (Split-Path -Leaf $repo))
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρέθηκε το Node.js. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
if (-not (Test-Path -LiteralPath $WorkDir)) { New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null }
$deploy = Prepare-Deploy
$tgw = Join-Path (Join-Path $deploy 'sites') 'tgw'

# Who am I logged in as (read-only)
# Who am I logged in as (read-only). Retried once: a slow network or a token refresh can make the first try fail.
$who = $null
for ($try = 1; $try -le 3; $try++) {
    $who = Invoke-Wrangler $tgw 'whoami'
    if ($who.text -match '(?i)associated with the email|you are logged in') { break }
    if ($try -lt 3) { Start-Sleep -Seconds 5 }
}
if ($who.text -notmatch '(?i)associated with the email|you are logged in') {
    if ($who.text -match '(?i)not authenticated|wrangler login') {
        Say 'Το wrangler δεν είναι συνδεδεμένο στο Cloudflare. Στείλε στο Claude αυτό το μήνυμα (θα σου δώσει την εντολή σύνδεσης).' 'Red'
    } else {
        Say 'Δεν μπόρεσα να ελέγξω τη σύνδεση με το Cloudflare (ίσως πρόβλημα δικτύου). Στείλε στο Claude αυτό το μήνυμα.' 'Red'
    }
    Say 'Έξοδος του wrangler whoami (τελευταίες γραμμές):'
    foreach ($line in @($who.text -split "`n" | Select-Object -Last 20)) { Say ('  ' + $line) }
    Finish 4
}
# More than one Cloudflare account would make wrangler ask which one; stop and let Claude set it up.
$accounts = @([regex]::Matches($who.text, '\b[0-9a-f]{32}\b') | ForEach-Object { $_.Value } | Select-Object -Unique)
if ($accounts.Count -gt 1 -and -not $env:CLOUDFLARE_ACCOUNT_ID) {
    Say ('Βρέθηκαν {0} λογαριασμοί Cloudflare. Στείλε στο Claude αυτό το μήνυμα για να διαλέξουμε τον σωστό.' -f $accounts.Count) 'Red'
    Finish 4
}
$email = ''
$m = [regex]::Match($who.text, '(?i)associated with the email\s+(\S+@\S+?)\.?\s')
if ($m.Success) { $email = $m.Groups[1].Value }
Say ('Cloudflare login: {0}' -f $(if ($email) { $email } else { 'OK' }))

$db = Find-Database $tgw
if (-not $db.ok) { Say 'Δεν μπόρεσα να διαβάσω τη λίστα των D1. Έξοδος του wrangler:' 'Red'; Say $db.text; Finish 5 }
Say ('D1 "{0}": {1}' -f $DbName, $(if ($db.found) { 'υπάρχει (' + (Mask-Id $db.id) + ')' } else { 'δεν υπάρχει ακόμα' }))
Say ('Τοπικό wrangler.jsonc: {0}' -f $(if (Test-Path -LiteralPath $configPath) { 'υπάρχει' } else { 'δεν υπάρχει ακόμα' }))

switch ($Step) {
    'check' {
        Say ''
        Say 'Μόνο έλεγχος: δεν άλλαξε τίποτα.' 'Green'
        Finish 0
    }

    'd1' {
        Say ''
        Say 'Τι θα γίνει:'
        if ($db.found) { Say ('  - Η D1 "{0}" υπάρχει ήδη: δεν δημιουργείται ξανά.' -f $DbName) }
        else { Say ('  - Νέα, άδεια D1 με όνομα "{0}" (μόνο για το TGW).' -f $DbName) }
        Say '  - Πίνακες της D1 από το migrations/0001_init.sql.'
        Say ('  - Αρχείο ρυθμίσεων στο {0} (μένει μόνο στον υπολογιστή σου).' -f $configPath)
        Say ('  - Επαναφορά (αν χρειαστεί): npx wrangler d1 delete {0}' -f $DbName)
        if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
        if (-not (Confirm-Approval $Phrases.d1)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
        if (-not $db.found) {
            $c = Invoke-Wrangler $tgw ('d1 create {0}' -f $DbName) -NonInteractive
            if ($c.code -ne 0) { Say 'Η δημιουργία της D1 απέτυχε. Έξοδος:' 'Red'; Say $c.text; Finish 6 }
            $db = Find-Database $tgw
            if (-not $db.found) { Say 'Η D1 δημιουργήθηκε αλλά δεν τη βρίσκω στη λίστα. Στείλε στο Claude την αναφορά.' 'Red'; Finish 6 }
            Say ('Δημιουργήθηκε η D1 ({0}).' -f (Mask-Id $db.id)) 'Green'
        }
        $example = [System.IO.File]::ReadAllText((Join-Path $tgw 'wrangler.jsonc.example'))
        $real = $example.Replace('REPLACE_WITH_DATABASE_ID', $db.id)
        [System.IO.File]::WriteAllText($configPath, $real, (New-Object System.Text.UTF8Encoding($false)))
        Copy-Item -LiteralPath $configPath -Destination $tgw -Force
        $mg = Invoke-Wrangler $tgw ('d1 migrations apply {0} --remote' -f $DbName) -NonInteractive
        if ($mg.code -ne 0) { Say 'Οι πίνακες δεν δημιουργήθηκαν. Έξοδος:' 'Red'; Say $mg.text; Finish 7 }
        Say 'Οι πίνακες δημιουργήθηκαν.' 'Green'
        Say ''
        Say 'ΕΤΟΙΜΟ: η D1 του TGW υπάρχει και είναι άδεια. Κανένα άλλο site δεν άλλαξε.' 'Green'
        Finish 0
    }

    'preview' {
        if (-not (Test-Path -LiteralPath $configPath) -or -not $db.found) { Say 'Πρώτα χρειάζεται το βήμα d1.' 'Red'; Finish 8 }
        Say ''
        Say 'Τι θα γίνει:'
        Say ('  - Ανεβαίνει ο Worker "{0}" ΜΟΝΟ στη δοκιμαστική διεύθυνση *.workers.dev.' -f $WorkerName)
        Say '  - Το technologygearworld.com ΔΕΝ συνδέεται ακόμα. Το Google δεν βλέπει τη δοκιμαστική διεύθυνση.'
        Say ('  - Επαναφορά (αν χρειαστεί): npx wrangler delete --name {0}' -f $WorkerName)
        if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
        if (-not (Confirm-Approval $Phrases.preview)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
        $d = Invoke-Wrangler $tgw 'deploy' -NonInteractive
        if ($d.code -ne 0) { Say 'Το ανέβασμα απέτυχε. Έξοδος:' 'Red'; Say $d.text; Finish 9 }
        $um = [regex]::Match($d.text, 'https://[A-Za-z0-9\.\-]+\.workers\.dev')
        $url = $(if ($um.Success) { $um.Value } else { '' })
        Say ('Ανέβηκε. Δοκιμαστική διεύθυνση: {0}' -f $(if ($url) { $url } else { '(δεν τη βρήκα στην έξοδο)' })) 'Green'
        if ($url) {
            try {
                $r = Invoke-WebRequest -UseBasicParsing -Uri ($url + '/') -TimeoutSec 30
                Say ('Έλεγχος: η αρχική απαντά {0}, X-Robots-Tag: {1}' -f $r.StatusCode, $r.Headers['X-Robots-Tag'])
            } catch {
                Say 'Η διεύθυνση δεν απάντησε ακόμα (συνήθως χρειάζεται 1 λεπτό). Δοκίμασε να την ανοίξεις.' 'Yellow'
            }
        }
        Finish 0
    }

    'import' {
        if (-not (Test-Path -LiteralPath $configPath) -or -not $db.found) { Say 'Πρώτα χρειάζεται το βήμα d1.' 'Red'; Finish 8 }
        if (-not (Test-Path -LiteralPath $Archive)) { Say ('Δεν βρήκα το Awin archive: {0}' -f $Archive) 'Red'; Finish 2 }
        $planDir = Join-Path $OutDir ('TGW_IMPORT_PLAN_' + $stamp)
        & node (Join-Path (Join-Path $repo 'tools') 'tgw-import-plan.mjs') --archive $Archive --out $planDir | Out-Null
        if ($LASTEXITCODE -ne 0) { Say 'Το σχέδιο import απέτυχε.' 'Red'; Finish 10 }
        $sqlDir = Join-Path $planDir 'sql'
        $files = @(Get-ChildItem -LiteralPath $sqlDir -Filter '*.sql' | Sort-Object Name)
        $head = ([System.IO.File]::ReadAllLines((Join-Path $planDir 'report.txt')) | Where-Object { $_ -match 'would be imported' } | Select-Object -First 1)
        Say ''
        Say 'Τι θα γίνει:'
        Say ('  - Backup της D1 του TGW στο {0}' -f (Join-Path $WorkDir 'backups'))
        Say ('  - Φόρτωση προϊόντων: {0}' -f $head)
        Say ('  - {0} αρχεία SQL, το ένα μετά το άλλο. Σταματά στο πρώτο λάθος.' -f $files.Count)
        Say '  - Αλλάζει ΜΟΝΟ η D1 του TGW. Κανένα άλλο site.'
        if (-not $Apply) { Say ''; Say 'Δοκιμή μόνο (χωρίς -Apply): δεν άλλαξε τίποτα.' 'Green'; Finish 0 }
        if (-not (Confirm-Approval $Phrases.import)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
        $bdir = Join-Path $WorkDir 'backups'
        if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
        $backup = Join-Path $bdir ('tgw-d1-before-import-' + $stamp + '.sql')
        $b = Invoke-Wrangler $tgw ('d1 export {0} --remote --output "{1}"' -f $DbName, $backup) -NonInteractive
        if ($b.code -ne 0 -or -not (Test-Path -LiteralPath $backup)) { Say 'Το backup απέτυχε: ΔΕΝ φόρτωσα τίποτα.' 'Red'; Say $b.text; Finish 11 }
        Say ('Backup: {0}' -f $backup) 'Green'
        $n = 0
        foreach ($f in $files) {
            $x = Invoke-Wrangler $tgw ('d1 execute {0} --remote --file "{1}"' -f $DbName, $f.FullName) -NonInteractive
            if ($x.code -ne 0) {
                Say ('Λάθος στο {0}. Σταμάτησα. Τα προηγούμενα αρχεία φορτώθηκαν.' -f $f.Name) 'Red'
                Say $x.text
                Say ('Επαναφορά: npx wrangler d1 execute {0} --remote --file "{1}"' -f $DbName, $backup)
                Finish 12
            }
            $n++
            Write-Host ('  {0} OK' -f $f.Name)
        }
        Say ('Φορτώθηκαν {0} αρχεία SQL.' -f $n) 'Green'
        $q = Invoke-Wrangler $tgw ('d1 execute {0} --remote --json --command "SELECT category_slug, COUNT(*) AS n FROM products WHERE is_active = 1 GROUP BY category_slug ORDER BY n DESC"' -f $DbName) -NonInteractive
        $rows = Get-JsonArray $q.text
        if ($rows) { foreach ($r in @($rows[0].results)) { Say ('  {0,-24} {1}' -f $r.category_slug, $r.n) } }
        Say ''
        Say 'ΕΤΟΙΜΟ: τα προϊόντα φορτώθηκαν στη D1 του TGW.' 'Green'
        Finish 0
    }
}
