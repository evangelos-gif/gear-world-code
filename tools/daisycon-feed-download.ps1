<#
.SYNOPSIS
  Downloads the product feeds of Daisycon programmes that accepted Gear World into the feed folder (lessons L128).

.DESCRIPTION
  Daisycon is the fourth affiliate network (after Awin, CJ and Rakuten). The feeds come from Daisycon's own API: once,
  the owner creates an API app in Daisycon (Tools -> Daisycon API, redirect URI https://login.daisycon.com/oauth/cli),
  gives this tool its Client ID and Client secret, signs in to Daisycon in the browser and pastes the code the page shows.
  From then on the tool signs in by itself. The app's keys and the sign-in are kept encrypted for your Windows user (DPAPI)
  in <home>\gear-world-secrets\daisycon-oauth.dat, are sent only to Daisycon and are never written to a report.
  The API gives each programme's feed address with our media id (-MediaId, 447289 = the Gear World site on Daisycon).
  The feeds are saved as DAISYCON_<programme>.csv.gz with the Awin column names and the Daisycon tracking link of each
  product in aw_deep_link, so tools/legacy-import.ps1 imports them like CJ shops.

  Without -Apply: READ-ONLY. For each programme (-Program, Daisycon programme ids, e.g. 16029,22318) it shows its feeds
  (language, currency, products) and 2 samples of the chosen one with price, stock, picture and tracking link.
  With -Apply and the approval phrase ΕΓΚΡΙΝΩ DAISYCON FEED DOWNLOAD: downloads every product, checks the file, moves the
  old copy to <folder>\_old\<time>\ and only then puts the new one in its place. A download with less than half the
  products of the old copy is NOT used. The sites do not change: the import is a separate step with its own approval.
  Report: <home>\gear-world-reports\DAISYCON_FEED_DOWNLOAD_<time>.txt (copied to the clipboard)
#>
param(
    [Parameter(Mandatory = $true)][string[]]$Program,
    [string]$MediaId = '447289',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Archive = '',
    [string]$SecretFile = '',
    [string]$Base = '',
    [int]$PauseMs = 1400,
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
if (-not $SecretFile) { $SecretFile = Join-Path (Join-Path $HOME 'gear-world-secrets') 'daisycon-oauth.dat' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Phrase = 'ΕΓΚΡΙΝΩ DAISYCON FEED DOWNLOAD'

$L = New-Object System.Collections.Generic.List[string]
$script:secrets = New-Object System.Collections.Generic.List[string]
function Mask([string]$s) {
    foreach ($x in $script:secrets) { if ($x -and $x.Length -ge 6) { $s = $s.Replace($x, '***') } }
    return [regex]::Replace($s, '(?i)(Bearer\s+)\S+', '$1***')
}
function Say([string]$t, [string]$c = '') { $t = Mask $t; $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Clear-DcEnv { $env:GW_DC_CLIENT = $null; $env:GW_DC_SECRET = $null; $env:GW_DC_REFRESH = $null; $env:GW_DC_CODE = $null; $env:GW_DC_VERIFIER = $null }
function Finish([int]$code) {
    Clear-DcEnv
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('DAISYCON_FEED_DOWNLOAD_{0}.txt' -f $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('DAISYCON_FEED_DOWNLOAD_{0}_{1}.txt' -f $stamp, $n); $n++ }
    $text = $L -join "`r`n"
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude και πάτα Ctrl+V.' -ForegroundColor Green }
    exit $code
}
trap {
    Say ('Απρόβλεπτο σφάλμα: {0}' -f $_.Exception.Message) 'Red'
    Say 'Σταμάτησα εδώ. Ό,τι γράφει πιο πάνω έγινε, τίποτα μετά. Στείλε την αναφορά στο Claude.' 'Red'
    Finish 9
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
        try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
}
# Runs the Node part (the keys only in its environment) and returns its JSON summary (or $null).
function Invoke-Daisycon([string[]]$a) {
    $a = @((Join-Path (Join-Path $repo 'tools') 'daisycon-feed.mjs')) + $a
    if ($Base) { $a += @('--base', $Base) }
    $oldEnc = $null
    try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
    try { $o = @(& node @a) } finally { if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } } }
    $line = ([string](($o | Where-Object { "$_".StartsWith('{') }) | Select-Object -Last 1))
    if (-not $line) { Say ('Το Node δεν έδωσε απάντηση: {0}' -f (($o -join ' ').Substring(0, [Math]::Min(300, ($o -join ' ').Length)))) 'Red'; return $null }
    try { return ($line | ConvertFrom-Json) } catch { Say 'Η απάντηση του Node δεν διαβάστηκε.' 'Red'; return $null }
}
function Save-Secret($obj) {
    $json = $obj | ConvertTo-Json -Compress
    $dir = Split-Path -Parent $SecretFile
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($SecretFile, (ConvertFrom-SecureString (ConvertTo-SecureString $json -AsPlainText -Force)), [System.Text.Encoding]::ASCII)
}
function Count-Rows([string]$path) {
    $oc = @()
    try { $oc = @(& node -e "const z=require('zlib'),fs=require('fs');try{const t=z.gunzipSync(fs.readFileSync(process.argv[1])).toString('utf8');const h=t.split('\n',1)[0];let n=0;for(const l of t.split('\n'))if(l.trim())n++;console.log((h.includes('product_name')&&h.includes('aw_deep_link')?'ok':'bad')+' '+Math.max(0,n-1))}catch(e){console.log('bad 0')}" $path) } catch { $oc = @('bad 0') }
    return (([string]($oc -join ' ')).Trim() -split '\s+')
}

Write-Host ''
$mode = 'ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν κατεβάζει τίποτα)'
if ($Apply) { $mode = 'ΛΗΨΗ (με έγκριση)' }
Say ('Λήψη feeds του Daisycon - {0}' -f $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
if ($MediaId -notmatch '^\d{3,10}$') { Say 'Λάθος αριθμός media του Daisycon.' 'Red'; Finish 2 }
if ($Base -and $Base -notmatch '^http://127\.0\.0\.1:\d+$') { Say 'Μη αναμενόμενη διεύθυνση του Daisycon.' 'Red'; Finish 2 }
$ids = @($Program | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ } | ForEach-Object { if ($_ -notmatch '^\d{2,8}$') { Say ('Λάθος αριθμός προγράμματος του Daisycon: {0}' -f $_) 'Red'; Finish 2 }; $_ } | Select-Object -Unique)
if ($ids.Count -lt 1) { Say 'Δεν δόθηκε πρόγραμμα του Daisycon.' 'Red'; Finish 2 }
if (-not (Test-Path -LiteralPath $Archive)) { Say ('Δεν βρήκα τον φάκελο των feeds: {0}' -f $Archive) 'Red'; Finish 2 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρήκα το Node.js σε αυτόν τον υπολογιστή.' 'Red'; Finish 2 }
Say ('Media (το site σου στο Daisycon): {0} | προγράμματα: {1}' -f $MediaId, ($ids -join ', '))

# 1. The app's keys and the sign-in (once; kept encrypted for this Windows user).
if (-not (Test-Path -LiteralPath $SecretFile)) {
    Write-Host ''
    Write-Host 'Μία φορά: τα στοιχεία της εφαρμογής (app) που έφτιαξες στο Daisycon (Tools -> Daisycon API).' -ForegroundColor Yellow
    $client = (Read-Host 'Client ID').Trim()
    if ($client -notmatch '^[A-Za-z0-9._-]{4,100}$') { Say 'Δεν δόθηκε σωστό Client ID. Σταμάτησα.' 'Yellow'; Finish 1 }
    $secS = Read-Host 'Client secret (δεν θα φαίνεται καθώς το επικολλάς· σκέτο Enter αν δεν έχει)' -AsSecureString
    $secret = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secS))
    if ($secret) { $script:secrets.Add($secret) }
    $U = Invoke-Daisycon @('--mode', 'auth-url', '--client', $client)
    if ($null -eq $U -or -not $U.ok) { Say 'Δεν έγινε η διεύθυνση σύνδεσης.' 'Red'; Finish 3 }
    $script:secrets.Add([string]$U.verifier)
    Write-Host ''
    Write-Host 'Ανοίγω τη σελίδα του Daisycon στον browser. Συνδέσου, πάτα Authorize/Allow, και αντέγραψε τον κωδικό (code) που θα δεις.' -ForegroundColor Yellow
    Write-Host ([string]$U.url)
    try { Start-Process ([string]$U.url) } catch { Write-Host 'Δεν άνοιξε μόνος του: αντέγραψε την παραπάνω διεύθυνση στον browser.' -ForegroundColor Yellow }
    $codeS = Read-Host 'Κωδικός (code) από τη σελίδα του Daisycon' -AsSecureString
    $code = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($codeS)).Trim()
    if (-not $code) { Say 'Δεν δόθηκε κωδικός. Σταμάτησα.' 'Yellow'; Finish 1 }
    $script:secrets.Add($code)
    $env:GW_DC_CLIENT = $client; $env:GW_DC_SECRET = $secret; $env:GW_DC_CODE = $code; $env:GW_DC_VERIFIER = [string]$U.verifier
    $T = Invoke-Daisycon @('--mode', 'auth-token')
    Clear-DcEnv
    if ($null -eq $T -or -not $T.ok) { $why = ''; if ($T) { $why = [string]$T.error }; Say ('Η σύνδεση με το Daisycon δεν έγινε: {0}' -f $why) 'Red'; Say 'Ξανατρέξε την ίδια εντολή για νέα προσπάθεια.'; Finish 3 }
    $script:secrets.Add([string]$T.refresh)
    Save-Secret (New-Object PSObject -Property @{ client = $client; secret = $secret; refresh = [string]$T.refresh })
    Say ('Η σύνδεση με το Daisycon έγινε και φυλάχτηκε κρυπτογραφημένη: {0}' -f $SecretFile) 'Green'
}
try {
    $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($SecretFile).Trim())
    $C = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)) | ConvertFrom-Json
} catch { Say 'Δεν μπόρεσα να διαβάσω τη φυλαγμένη σύνδεση. Σβήσε το αρχείο της και ξανατρέξε για νέα σύνδεση.' 'Red'; Say $SecretFile; Finish 3 }
foreach ($x in @([string]$C.secret, [string]$C.refresh)) { if ($x) { $script:secrets.Add($x) } }
function Invoke-WithSignIn([string[]]$a) {
    $env:GW_DC_CLIENT = [string]$C.client; $env:GW_DC_SECRET = [string]$C.secret; $env:GW_DC_REFRESH = [string]$C.refresh
    try { $R = Invoke-Daisycon $a } finally { Clear-DcEnv }
    if ($R -and $R.newRefresh) {
        $script:secrets.Add([string]$R.newRefresh)
        $C.refresh = [string]$R.newRefresh
        Save-Secret $C
    }
    if ($R -and $R.signIn) { Say ('Το Daisycon δεν δέχτηκε τη φυλαγμένη σύνδεση: {0}' -f $R.error) 'Red'; Say 'Σβήσε το αρχείο της σύνδεσης και ξανατρέξε για νέα σύνδεση:'; Say $SecretFile; Finish 3 }
    return $R
}

# 2. Read-only look: each programme's feeds and samples.
Write-Host 'Ρωτάω το Daisycon για τα feeds κάθε προγράμματος (περίπου 2 δευτερόλεπτα ανά πρόγραμμα)...'
$S = Invoke-WithSignIn @('--mode', 'probe', '--media', $MediaId, '--programs', ($ids -join ','), '--pause', [string]$PauseMs)
if ($null -eq $S) { Finish 4 }
if ($S.error) { Say ('Πρόβλημα: {0}' -f $S.error) 'Red'; Finish 4 }
$good = New-Object System.Collections.Generic.List[string]
foreach ($p in @($S.programs)) {
    Say ''
    if (-not $p.ok) { Say ('{0}: δεν βγήκε feed: {1} (feeds στο Daisycon: {2})' -f $p.program, $p.error, $p.feeds) 'Yellow'; continue }
    Say ('{0} {1}: feeds {2} | διάλεξα γλώσσα {3}, νόμισμα {4}, προϊόντα {5}' -f $p.program, $p.name, $p.feeds, $p.language, $p.currency, $p.products)
    Say ('  Πεδία: {0}' -f (@($p.keys) -join ', '))
    $i = 0
    foreach ($x in @($p.samples)) {
        $i++
        Say ('  Δείγμα {0}: {1} | {2} {3} | απόθεμα: {4} | κατηγορία: {5} | εικόνα: {6} | link Daisycon: {7}' -f $i, $x.name, $x.price, $x.currency, $x.stock, $x.category, $x.image, $x.tracking)
        Say ('     σελίδα: {0}' -f $x.page)
    }
    if (@($p.samples | Where-Object { $_.tracking -eq 'NONE' }).Count -gt 0) { Say '  🟡 ΠΡΟΣΟΧΗ: κάποια δείγματα δεν έχουν link του Daisycon με το media σου. Αυτά δεν θα μπουν στα sites (δεν πληρώνουν).' 'Yellow' }
    $good.Add([string]$p.program)
}
Say ''
if ($good.Count -eq 0) { Say 'Κανένα πρόγραμμα δεν έδωσε feed. Δεν κατέβηκε τίποτα.' 'Yellow'; Finish 0 }
Say ('Με -Apply: λήψη {0} feeds στο {1} (DAISYCON_<πρόγραμμα>.csv.gz). Το παλιό αντίγραφο πάει πρώτα στο _old\{2}. Τα sites δεν αλλάζουν.' -f $good.Count, $Archive, $stamp)
if (-not $Apply) { Say 'Μόνο ανάγνωση (χωρίς -Apply): δεν κατέβηκε τίποτα.' 'Green'; Say ('Η φράση έγκρισης: {0}' -f $Phrase); Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# 3. Download (to .part), check, then swap (old copy kept).
Write-Host 'Κατεβάζω από το Daisycon (500 προϊόντα ανά αίτημα)...'
$D = Invoke-WithSignIn @('--mode', 'download', '--media', $MediaId, '--programs', ($good -join ','), '--out', $Archive, '--pause', [string]$PauseMs)
if ($null -eq $D) { Finish 4 }
if ($D.error) { Say ('Πρόβλημα: {0}' -f $D.error) 'Red'; Finish 4 }
$oldDir = Join-Path (Join-Path $Archive '_old') $stamp
$ok = 0
foreach ($a in @($D.programs)) {
    $final = Join-Path $Archive ('DAISYCON_{0}.csv.gz' -f $a.program)
    if (-not $a.ok) { Say ('{0}: 🔴 ΠΡΟΒΛΗΜΑ: {1} (ήρθαν {2}). Κράτησα το παλιό.' -f $a.program, $a.error, $a.got) 'Red'; if ($a.file -and (Test-Path -LiteralPath $a.file)) { Remove-Item -LiteralPath $a.file -ErrorAction SilentlyContinue }; continue }
    $part = [string]$a.file
    $cp = Count-Rows $part
    if ($cp[0] -ne 'ok') { Say ('{0}: το αρχείο δεν διαβάζεται. Κράτησα το παλιό.' -f $a.program) 'Red'; Remove-Item -LiteralPath $part -ErrorAction SilentlyContinue; continue }
    $newRows = [int]$cp[1]
    $oldRows = -1
    if (Test-Path -LiteralPath $final) { $oldRows = [int]((Count-Rows $final)[1]) }
    if ($oldRows -ge 100 -and $newRows -lt ($oldRows / 2)) {
        Say ('{0}: ήρθαν {1} προϊόντα, ενώ το παλιό είχε {2}. Μάλλον κάτι πήγε στραβά, κράτησα το παλιό (το νέο έμεινε ως .part για έλεγχο).' -f $a.program, $newRows, $oldRows) 'Yellow'
        continue
    }
    if (Test-Path -LiteralPath $final) {
        if (-not (Test-Path -LiteralPath $oldDir)) { New-Item -ItemType Directory -Path $oldDir -Force | Out-Null }
        Move-Item -LiteralPath $final -Destination (Join-Path $oldDir (Split-Path -Leaf $final)) -Force
    }
    Move-Item -LiteralPath $part -Destination $final -Force
    $ok++
    $was = 'καινούργιο'
    if ($oldRows -ge 0) { $was = 'πριν {0}' -f $oldRows }
    $cap = ''
    if ($a.capped) { $cap = ' (ΠΡΟΣΟΧΗ: σταμάτησε στο όριο σελίδων)' }
    Say ('{0} {1}: OK, {2} προϊόντα ({3}){4}, με link του Daisycon: {5}, νόμισμα: {6}. Αρχείο: {7}' -f $a.program, $a.name, $newRows, $was, $cap, $a.withTracking, (@($a.currencies) -join ', '), $final) 'Green'
}
Say ''
Say ('ΕΤΟΙΜΟ: κατέβηκαν {0} από {1} feeds. Τα παλιά αντίγραφα (αν υπήρχαν): {2}' -f $ok, @($D.programs).Count, $oldDir) 'Green'
Say 'Τα sites δεν άλλαξαν. Επόμενο βήμα: κανόνες εισαγωγής για κάθε κατάστημα και tools/legacy-import.ps1 (πρώτα δοκιμή, μετά έγκριση).'
Finish 0
