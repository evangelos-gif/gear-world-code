<#
.SYNOPSIS
  Downloads the product catalogue of CJ Affiliate advertisers that accepted Gear World (e.g. XPLORA UK) into the feed folder.

.DESCRIPTION
  CJ is the second affiliate network (after Awin). Its products come from the CJ product search API with a personal
  access token, and are saved as CJ_<advertiser>.csv.gz in the same folder and the same column names as the Awin feeds,
  so tools/legacy-import.ps1 imports them like any other shop (lessons L86).

  Without -Apply: READ-ONLY. Shows which CJ account id works, the feeds of the advertisers that accepted you, how many
  products each chosen advertiser (-Advertiser, CJ advertiser ids, default 5175167 = XPLORA UK) has, and 5 sample
  products with their price, stock and CJ tracking link. Nothing is saved.
  With -Apply and the approval phrase ΕΓΚΡΙΝΩ CJ FEED DOWNLOAD: downloads every product, checks the file (product
  names, CJ tracking links), moves the old copy to <folder>\_old\<time>\ and only then puts the new one in its place.
  A download with less than half the products of the old copy is NOT used. The sites do not change: the import is a
  separate step with its own approval.

  The CJ token is asked once and kept encrypted for your Windows user (DPAPI) in
  <home>\gear-world-secrets\cj-token.dat. It is never written to a report, the clipboard or the repo.
  Report: <home>\gear-world-reports\CJ_FEED_DOWNLOAD_<time>.txt (copied to the clipboard)
#>
param(
    [string[]]$Advertiser = @('5175167'),
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Archive = '',
    [string]$TokenFile = '',
    [string]$Cid = '8114224,7806395',
    [string]$PropertyId = '101917444',
    [string]$Api = 'https://ads.api.cj.com/query',
    [int]$PauseMs = 1000,
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
if (-not $TokenFile) { $TokenFile = Join-Path (Join-Path $HOME 'gear-world-secrets') 'cj-token.dat' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Phrase = 'ΕΓΚΡΙΝΩ CJ FEED DOWNLOAD'

$L = New-Object System.Collections.Generic.List[string]
$script:secret = ''
function Mask([string]$s) {
    if ($script:secret -and $script:secret.Length -ge 6) { $s = $s.Replace($script:secret, '***') }
    return [regex]::Replace($s, '(?i)(Bearer\s+)\S+', '$1***')
}
function Say([string]$t, [string]$c = '') { $t = Mask $t; $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Finish([int]$code) {
    $env:GW_CJ_TOKEN = $null
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('CJ_FEED_DOWNLOAD_{0}.txt' -f $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('CJ_FEED_DOWNLOAD_{0}_{1}.txt' -f $stamp, $n); $n++ }
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
# Runs the Node part with the token in its environment only. Returns the JSON summary (or $null).
function Invoke-CjFeed([string]$mode, [string]$out) {
    $env:GW_CJ_TOKEN = $script:secret
    # Node writes UTF-8 (product names with £, é, ...): read it as UTF-8, not in the console's code page.
    $oldEnc = $null
    try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
    try {
        $o = @(& node (Join-Path (Join-Path $repo 'tools') 'cj-feed.mjs') --mode $mode --cid $Cid --pid $PropertyId --advertisers ($ids -join ',') --out $out --api $Api --pause $PauseMs)
    } finally {
        $env:GW_CJ_TOKEN = $null
        if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } }
    }
    $line = ([string](($o | Where-Object { "$_".StartsWith('{') }) | Select-Object -Last 1))
    if (-not $line) { Say ('Το Node δεν έδωσε απάντηση: {0}' -f (($o -join ' ').Substring(0, [Math]::Min(300, ($o -join ' ').Length)))) 'Red'; return $null }
    try { return ($line | ConvertFrom-Json) } catch { Say 'Η απάντηση του Node δεν διαβάστηκε.' 'Red'; return $null }
}
function Show-Summary($S) {
    Say ('CJ: διεύθυνση {0} | λογαριασμός (CID) που δούλεψε: {1} | property (PID) για τα links: {2}' -f $S.api, $S.cid, $S.pid)
    foreach ($t in @($S.cidTried)) { if ($t) { Say ('  CID {0} δεν δούλεψε: {1}' -f $t.cid, $t.error) 'Yellow' } }
    if ($S.describeError) { Say ('  Η περιγραφή του API δεν ήρθε ({0}): χρησιμοποιήθηκε η σταθερή λίστα πεδίων.' -f $S.describeError) 'Yellow' }
    if (@($S.queries).Count) { Say ('  Ερωτήματα προϊόντων του API: {0}' -f (@($S.queries) -join ', ')) }
    if (@($S.fields).Count) { Say ('  Πεδία προϊόντος: {0}' -f (@($S.fields) -join ', ')) }
    if ($S.feedsError) { Say ('  Η λίστα feeds δεν ήρθε: {0}' -f $S.feedsError) 'Yellow' }
    if ($null -ne $S.feeds) {
        Say ('Feeds των καταστημάτων που ζήτησες: {0} (το CJ έδωσε {1} feeds συνολικά, και από καταστήματα που δεν σε έχουν δεχτεί)' -f @($S.feeds).Count, $S.feedsTotal)
        foreach ($f in @($S.feeds)) { if ($f) { Say ('  {0} {1} | feed: {2} | προϊόντα: {3} | νόμισμα: {4} | ανανέωση: {5}' -f $f.advertiserId, $f.advertiserName, $f.feedName, $f.productCount, $f.currency, $f.lastUpdated) } }
    }
}

Write-Host ''
$mode = 'ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν κατεβάζει τίποτα)'
if ($Apply) { $mode = 'ΛΗΨΗ (με έγκριση)' }
Say ('Λήψη καταλόγων του CJ - {0}' -f $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
$apiHost = ([uri]$Api).Host
if ($apiHost -ne 'ads.api.cj.com' -and $apiHost -ne '127.0.0.1') { Say 'Μη αναμενόμενη διεύθυνση του CJ.' 'Red'; Finish 2 }
$ids = @($Advertiser | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ } | ForEach-Object { if ($_ -notmatch '^\d{3,12}$') { Say ('Λάθος αριθμός καταστήματος CJ: {0}' -f $_) 'Red'; Finish 2 }; $_ })
if ($ids.Count -lt 1) { Say 'Δεν δόθηκε κατάστημα του CJ.' 'Red'; Finish 2 }
if ($Cid -notmatch '^[\d,\s]+$' -or $PropertyId -notmatch '^\d{3,12}$') { Say 'Λάθος CID ή PID.' 'Red'; Finish 2 }
if (-not (Test-Path -LiteralPath $Archive)) { Say ('Δεν βρήκα τον φάκελο των feeds: {0}' -f $Archive) 'Red'; Finish 2 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρήκα το Node.js σε αυτόν τον υπολογιστή.' 'Red'; Finish 2 }

# 1. The CJ token (asked once, kept encrypted for this Windows user).
if (-not (Test-Path -LiteralPath $TokenFile)) {
    Write-Host ''
    Write-Host 'Χρειάζομαι μία φορά το κλειδί (Personal Access Token) του CJ, από τη σελίδα https://developers.cj.com/account/personal-access-tokens' -ForegroundColor Yellow
    Write-Host 'Επικόλλησέ το εδώ (δεν θα φαίνεται καθώς το επικολλάς) και πάτα Enter. Θα φυλαχτεί κρυπτογραφημένο μόνο για τον χρήστη σου στα Windows.'
    $sec = Read-Host 'Κλειδί CJ' -AsSecureString
    if ($sec.Length -lt 10) { Say 'Δεν δόθηκε κλειδί. Σταμάτησα.' 'Yellow'; Finish 1 }
    $dir = Split-Path -Parent $TokenFile
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($TokenFile, (ConvertFrom-SecureString $sec), [System.Text.Encoding]::ASCII)
    Say ('Το κλειδί φυλάχτηκε κρυπτογραφημένο: {0}' -f $TokenFile) 'Green'
}
try {
    $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($TokenFile).Trim())
    $script:secret = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
} catch { Say 'Δεν μπόρεσα να διαβάσω το φυλαγμένο κλειδί. Σβήσε το αρχείο του και ξανατρέξε για να το δώσεις ξανά.' 'Red'; Say $TokenFile; Finish 3 }
if ($script:secret -notmatch '^[A-Za-z0-9._~+/=-]{10,400}$') { Say 'Το φυλαγμένο κλειδί δεν μοιάζει με κλειδί του CJ. Σβήσε το αρχείο του και ξανατρέξε.' 'Red'; Say $TokenFile; Finish 3 }

# 2. Read-only look (always first).
$S = Invoke-CjFeed 'probe' '-'
if ($null -eq $S) { Finish 4 }
if ($S.error) { Say ('Το CJ δεν απάντησε σωστά: {0}' -f $S.error) 'Red'; Show-Summary $S; Say 'Αν γράφει 401 ή Unauthorized: το κλειδί είναι λάθος ή έληξε. Σβήσε το αρχείο του κλειδιού και ξανατρέξε.'; Say $TokenFile; Finish 4 }
Show-Summary $S
$good = New-Object System.Collections.Generic.List[string]
foreach ($a in @($S.advertisers)) {
    Say ''
    if (-not $a.ok) { Say ('{0}: 🔴 ΠΡΟΒΛΗΜΑ: {1}' -f $a.advertiser, $a.error) 'Red'; continue }
    Say ('{0}: προϊόντα στο CJ: {1}' -f $a.advertiser, $a.total)
    if (-not $a.total) { Say '  Δεν έχει προϊόντα στον κατάλογο του CJ (ή δεν σε έχει δεχτεί ακόμα). Δεν κατεβαίνει.' 'Yellow'; continue }
    $i = 0
    foreach ($p in @($a.samples)) {
        $i++
        Say ('  Δείγμα {0}: {1} | {2} {3} | απόθεμα: {4} | κατηγορία: {5} | εικόνα: {6} | link CJ: {7}' -f $i, $p.name, $p.price, $p.currency, $p.stock, $p.category, $p.image, $p.tracking)
        Say ('     σελίδα: {0}' -f $p.page)
    }
    if (@($a.samples | Where-Object { $_.tracking -eq 'NONE' }).Count -gt 0) { Say '  🟡 ΠΡΟΣΟΧΗ: κάποια δείγματα δεν έχουν link του CJ. Αυτά δεν θα μπουν στα sites (δεν πληρώνουν).' 'Yellow' }
    $good.Add([string]$a.advertiser)
}
Say ''
if ($good.Count -eq 0) { Say 'Δεν υπάρχει κατάλογος για λήψη.' 'Yellow'; Finish 0 }
Say ('Με -Apply: λήψη {0} καταλόγων στο {1} (CJ_<αριθμός>.csv.gz). Το παλιό αντίγραφο πάει πρώτα στο _old\{2}. Τα sites δεν αλλάζουν.' -f $good.Count, $Archive, $stamp)
if (-not $Apply) { Say 'Μόνο ανάγνωση (χωρίς -Apply): δεν κατέβηκε τίποτα.' 'Green'; Say ('Η φράση έγκρισης: {0}' -f $Phrase); Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# 3. Download (to .part), check, then swap (old copy kept).
$ids = @($good)
Write-Host 'Κατεβάζω από το CJ (1.000 προϊόντα ανά αίτημα)...'
$D = Invoke-CjFeed 'download' $Archive
if ($null -eq $D) { Finish 4 }
if ($D.error) { Say ('Το CJ δεν απάντησε σωστά: {0}' -f $D.error) 'Red'; Finish 4 }
$oldDir = Join-Path (Join-Path $Archive '_old') $stamp
$ok = 0
function Count-Rows([string]$path) {
    $oc = @()
    try { $oc = @(& node -e "const z=require('zlib'),fs=require('fs');try{const t=z.gunzipSync(fs.readFileSync(process.argv[1])).toString('utf8');const h=t.split('\n',1)[0];let n=0;for(const l of t.split('\n'))if(l.trim())n++;console.log((h.includes('product_name')&&h.includes('aw_deep_link')?'ok':'bad')+' '+Math.max(0,n-1))}catch(e){console.log('bad 0')}" $path) } catch { $oc = @('bad 0') }
    return (([string]($oc -join ' ')).Trim() -split '\s+')
}
foreach ($a in @($D.advertisers)) {
    $final = Join-Path $Archive ('CJ_{0}.csv.gz' -f $a.advertiser)
    if (-not $a.ok) { Say ('{0}: 🔴 ΠΡΟΒΛΗΜΑ: {1} (ήρθαν {2} από {3}). Κράτησα το παλιό.' -f $a.advertiser, $a.error, $a.got, $a.total) 'Red'; if ($a.file) { Remove-Item -LiteralPath $a.file -ErrorAction SilentlyContinue }; continue }
    $part = [string]$a.file
    $cp = Count-Rows $part
    if ($cp[0] -ne 'ok') { Say ('{0}: το αρχείο δεν διαβάζεται. Κράτησα το παλιό.' -f $a.advertiser) 'Red'; Remove-Item -LiteralPath $part -ErrorAction SilentlyContinue; continue }
    $newRows = [int]$cp[1]
    $oldRows = -1
    if (Test-Path -LiteralPath $final) { $oldRows = [int]((Count-Rows $final)[1]) }
    if ($oldRows -ge 100 -and $newRows -lt ($oldRows / 2)) {
        Say ('{0}: ήρθαν {1} προϊόντα, ενώ το παλιό είχε {2}. Μάλλον κάτι πήγε στραβά, κράτησα το παλιό (το νέο έμεινε ως .part για έλεγχο).' -f $a.advertiser, $newRows, $oldRows) 'Yellow'
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
    Say ('{0} {1}: OK, {2} προϊόντα ({3}), με link του CJ: {4}, νόμισμα: {5}. Αρχείο: {6}' -f $a.advertiser, $a.name, $newRows, $was, $a.withTracking, (@($a.currencies) -join ', '), $final) 'Green'
}
Say ''
Say ('ΕΤΟΙΜΟ: κατέβηκαν {0} από {1} καταλόγους. Τα παλιά αντίγραφα (αν υπήρχαν): {2}' -f $ok, @($D.advertisers).Count, $oldDir) 'Green'
Say 'Τα sites δεν άλλαξαν. Επόμενο βήμα: tools/legacy-import.ps1 για το κατάστημα (πρώτα πρόβα, μετά έγκριση).'
Finish 0
