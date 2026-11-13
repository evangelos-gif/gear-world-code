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
  -Joined (READ-ONLY, lessons L128): the shops that accepted you, from CJ's Advertiser Lookup API (the feed list stops at
  10,000 feeds), each with its product count and samples, as without -Apply. Nothing is downloaded.
  -ListFeeds (READ-ONLY, lessons L96): lists EVERY product feed the CJ API knows, also of shops that have not accepted
  you yet, in one currency (-Currency GBP, or ALL), biggest first, with the shop number, name, products, language and
  last update. The shops given with -Advertiser are marked as yours. Nothing is downloaded and nothing changes.
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
    [switch]$ListFeeds,
    [switch]$Joined,
    [string]$LookupApi = 'https://advertiser-lookup.api.cj.com/v2/advertiser-lookup',
    [string]$Currency = 'GBP',
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
        $o = @(& node (Join-Path (Join-Path $repo 'tools') 'cj-feed.mjs') --mode $mode --cid $Cid --pid $PropertyId --advertisers ($ids -join ',') --out $out --api $Api --pause $PauseMs --lookup $LookupApi)
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
    if (@($S.productArgs).Count) {
        Say ('  Φίλτρα της αναζήτησης προϊόντων: {0}' -f (@($S.productArgs) -join ', '))
        if ($S.priceBands) { Say '  Κατάλογοι πάνω από 10.000 προϊόντα: διαβάζονται σε ζώνες τιμής (το CJ δίνει έως 10.000 ανά αναζήτηση).' } else { Say '  🟡 ΠΡΟΣΟΧΗ: το CJ δεν έχει φίλτρο τιμής: από κατάλογο πάνω από 10.000 προϊόντα έρχονται μόνο τα πρώτα 10.000.' 'Yellow' }
    }
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
$lookupHost = ([uri]$LookupApi).Host
if ($lookupHost -ne 'advertiser-lookup.api.cj.com' -and $lookupHost -ne '127.0.0.1') { Say 'Μη αναμενόμενη διεύθυνση του CJ (lookup).' 'Red'; Finish 2 }
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

# 2a. -ListFeeds: every CJ feed, also of shops that have not accepted us, read-only (lessons L96).
if ($ListFeeds) {
    if ($Apply) { Say 'Το -ListFeeds είναι μόνο ανάγνωση: τρέξε το χωρίς -Apply.' 'Red'; Finish 2 }
    $cur = ([string]$Currency).Trim().ToUpperInvariant()
    if ($cur -notmatch '^(ALL|[A-Z]{3})$') { Say ('Λάθος νόμισμα: {0} (π.χ. GBP ή ALL)' -f $Currency) 'Red'; Finish 2 }
    $S = Invoke-CjFeed 'list' '-'
    if ($null -eq $S) { Finish 4 }
    if ($S.error) { Say ('Το CJ δεν απάντησε σωστά: {0}' -f $S.error) 'Red'; Finish 4 }
    Say ('CJ: διεύθυνση {0} | λογαριασμός (CID) που δούλεψε: {1}' -f $S.api, $S.cid)
    if ($S.feedsError) { Say ('  Η λίστα feeds δεν ήρθε ολόκληρη: {0}' -f $S.feedsError) 'Yellow' }
    $all = @($S.feeds | Where-Object { $_ })
    $pick = @($all | Where-Object { $cur -eq 'ALL' -or ([string]$_.currency).ToUpperInvariant() -eq $cur })
    $pick = @($pick | Sort-Object -Property @{ Expression = { [long](('0' + ([string]$_.productCount -replace '\D', ''))) }; Descending = $true }, @{ Expression = { [string]$_.advertiserName }; Descending = $false })
    $shops = @($pick | ForEach-Object { [string]$_.advertiserId } | Sort-Object -Unique)
    $told = ''
    if ($null -ne $S.feedsApiTotal) { $told = (' (το CJ λέει ότι έχει {0})' -f $S.feedsApiTotal) }
    Say ('Feeds στο CJ: διαβάστηκαν {0}{1}. Σε {2}: {3} feeds από {4} καταστήματα.' -f $all.Count, $told, $cur, $pick.Count, $shops.Count)
    if ($S.feedsCapped) { Say ('  ΠΡΟΣΟΧΗ: η λίστα σταμάτησε στα {0} feeds (όριο σελίδων), μπορεί να λείπουν καταστήματα. Στείλε το στο Claude.' -f $all.Count) 'Yellow' }
    Say 'Μία γραμμή για κάθε κατάστημα (το μεγαλύτερο feed του), τα μεγαλύτερα πρώτα. Η αίτηση γίνεται στο CJ: Partners > Advertisers.'
    # One line per shop, its biggest feed (the list is already sorted); shops whose feeds are all empty are only counted
    # (lessons L96: Travel Luggage had a feed with 0 products). ΠΑΛΙΟ = older than 30 days (lessons L39).
    $seen = @{}
    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($f in $pick) {
        $k = [string]$f.advertiserId
        if ($seen.ContainsKey($k)) { $seen[$k] = $seen[$k] + 1; continue }
        $seen[$k] = 1
        $rows.Add($f)
    }
    $oldDay = (Get-Date).AddDays(-30).ToString('yyyy-MM-dd')
    $empty = 0
    foreach ($f in $rows) {
        $k = [string]$f.advertiserId
        $n = [long](('0' + ([string]$f.productCount -replace '\D', '')))
        $isMine = $ids -contains $k
        if ($n -le 0 -and -not $isMine) { $empty++; continue }
        $extra = ''
        if ($seen[$k] -gt 1) { $extra = (' (+{0} ακόμα feeds)' -f ($seen[$k] - 1)) }
        $upd = [string]$f.lastUpdated
        if ($upd.Length -gt 10) { $upd = $upd.Substring(0, 10) }
        $old = ''
        if ($upd -and $upd -lt $oldDay) { $old = ' | ΠΑΛΙΟ (πάνω από 30 μέρες)' }
        $more = ''
        if ($cur -eq 'ALL') { $more = (' | νόμισμα: {0}' -f $f.currency) }
        if ([string]$f.language -and [string]$f.language -ne 'en') { $more += (' | γλώσσα: {0}' -f $f.language) }
        $mine = ''
        if ($isMine) { $mine = ' | ΔΙΚΟ ΣΟΥ (σε έχει δεχτεί)' }
        Say ('  {0} {1} | προϊόντα: {2} | feed: {3}{4} | ανανέωση: {5}{6}{7}{8}' -f $k, ([string]$f.advertiserName).Trim(), $n, ([string]$f.feedName).Trim(), $extra, $upd, $more, $old, $mine)
    }
    Say ('Καταστήματα μόνο με άδεια feeds (0 προϊόντα), δεν γράφονται εδώ: {0}' -f $empty)
    Say ''
    Say 'Μόνο ανάγνωση: δεν κατέβηκε τίποτα και δεν άλλαξε τίποτα.' 'Green'
    Finish 0
}

# 2. Read-only look (always first). -Joined: first the shops that accepted you (lessons L128).
$probeMode = 'probe'
if ($Joined) {
    if ($Apply) { Say 'Το -Joined είναι μόνο ανάγνωση: τρέξε το χωρίς -Apply.' 'Red'; Finish 2 }
    $probeMode = 'joined'
}
$S = Invoke-CjFeed $probeMode '-'
if ($Joined -and $null -ne $S) {
    foreach ($t in @($S.joinedTried)) { if ($t) { Say ('  CID {0}: η λίστα δεν ήρθε: {1}' -f $t.cid, $t.error) 'Yellow' } }
    if (-not $S.error) {
        $jl = @($S.joined | Where-Object { $_ })
        Say ('Καταστήματα του CJ που σε έχουν δεχτεί: {0}' -f $jl.Count) 'Cyan'
        foreach ($j in $jl) { Say ('  {0} {1} | {2} | {3}' -f $j.id, $j.name, $j.status, $j.category) }
        if ($jl.Count -eq 0) { Say 'Κανένα κατάστημα δεν βρέθηκε.' 'Yellow'; Finish 0 }
    }
}
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
if ($Joined) {
    Say ('Καταστήματα με προϊόντα στο CJ (για -Advertiser): {0}' -f ($good -join ','))
    Say 'Μόνο ανάγνωση: δεν κατέβηκε τίποτα.' 'Green'
    Finish 0
}
Say ('Με -Apply: λήψη {0} καταλόγων στο {1} (CJ_<αριθμός>.csv.gz). Το παλιό αντίγραφο πάει πρώτα στο _old\{2}. Τα sites δεν αλλάζουν.' -f $good.Count, $Archive, $stamp)
if (-not $Apply) { Say 'Μόνο ανάγνωση (χωρίς -Apply): δεν κατέβηκε τίποτα.' 'Green'; Say ('Η φράση έγκρισης: {0}' -f $Phrase); Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# 3. Download (to .part), check, then swap (old copy kept).
$ids = @($good)
Write-Host 'Κατεβάζω από το CJ (1.000 προϊόντα ανά αίτημα, οι κατάλογοι πάνω από 10.000 σε ζώνες τιμής: μπορεί να πάρει αρκετά λεπτά)...'
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
    if ($a.split -eq 'price') { Say ('  Ο κατάλογος έχει πάνω από 10.000 προϊόντα: ήρθε σε {0} ζώνες τιμής (lessons L129).' -f $a.bands) }
    if ($a.capped) { Say ('  🟡 ΠΡΟΣΟΧΗ: ήρθαν {0} από τα {1} προϊόντα του CJ (το CJ δίνει έως 10.000 ανά αναζήτηση). Τα υπόλοιπα λείπουν από το αρχείο.' -f $newRows, $a.total) 'Yellow' }
}
Say ''
Say ('ΕΤΟΙΜΟ: κατέβηκαν {0} από {1} καταλόγους. Τα παλιά αντίγραφα (αν υπήρχαν): {2}' -f $ok, @($D.advertisers).Count, $oldDir) 'Green'
Say 'Τα sites δεν άλλαξαν. Επόμενο βήμα: tools/legacy-import.ps1 για το κατάστημα (πρώτα πρόβα, μετά έγκριση).'
Finish 0
