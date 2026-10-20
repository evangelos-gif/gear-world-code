<#
.SYNOPSIS
  Downloads fresh Awin product feeds for chosen retailers into the feed folder on this PC.

.DESCRIPTION
  Without -Apply: READ-ONLY. Reads your Awin feed list and shows, for each chosen retailer (-Advertiser, Awin
  advertiser ids, default 30645 = Coes): membership status, feed id, products, when Awin last refreshed it, and the
  date of the copy on this PC. Nothing is downloaded or changed.
  With -Apply and the approval phrase ΕΓΚΡΙΝΩ FEED DOWNLOAD: downloads each feed to a temporary file, checks it
  (gzip, product columns, number of products), moves the old copy to <folder>\_old\<time>\ and only then puts the
  new one in its place. A feed that comes back with less than half the products of the old copy is NOT used.
  Nothing on the sites changes: importing is a separate step (tools/legacy-import.ps1) with its own approval.

  The Awin feed key is asked once and kept encrypted for your Windows user (DPAPI) in
  <home>\gear-world-secrets\awin-feed-key.dat. It is never written to a report, the clipboard or the repo.
  Report: <home>\gear-world-reports\AWIN_FEED_DOWNLOAD_<time>.txt (copied to the clipboard)
#>
param(
    [string[]]$Advertiser = @('30645'),
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Archive = '',
    [string]$KeyFile = '',
    [string]$BaseUrl = 'https://productdata.awin.com',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
# The progress bar makes big downloads very slow in Windows PowerShell 5.1.
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
if (-not $KeyFile) { $KeyFile = Join-Path (Join-Path $HOME 'gear-world-secrets') 'awin-feed-key.dat' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Phrase = 'ΕΓΚΡΙΝΩ FEED DOWNLOAD'
# The columns the import tools read. A column a retailer does not fill simply comes back empty.
$Columns = 'data_feed_id,merchant_id,merchant_name,aw_product_id,aw_deep_link,aw_image_url,aw_thumb_url,category_id,category_name,brand_id,brand_name,merchant_product_id,merchant_category,ean,product_GTIN,mpn,product_name,description,merchant_deep_link,merchant_image_url,large_image,search_price,store_price,rrp_price,currency,delivery_cost,in_stock,stock_quantity,stock_status,condition,colour,size,fashion_size,fashion_suitable_for,parent_product_id,product_type,keywords,last_updated'

$L = New-Object System.Collections.Generic.List[string]
$script:secret = ''
function Mask([string]$s) {
    if ($script:secret) { $s = $s.Replace($script:secret, '***') }
    return [regex]::Replace($s, '(?i)(apikey/)[^/\s]+', '$1***')
}
function Say([string]$t, [string]$c = '') { $t = Mask $t; $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('AWIN_FEED_DOWNLOAD_{0}.txt' -f $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('AWIN_FEED_DOWNLOAD_{0}_{1}.txt' -f $stamp, $n); $n++ }
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

Write-Host ''
$mode = 'ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν κατεβάζει τίποτα)'
if ($Apply) { $mode = 'ΛΗΨΗ (με έγκριση)' }
Say ('Λήψη feeds του Awin - {0}' -f $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
$host1 = ([uri]$BaseUrl).Host
if ($host1 -ne 'productdata.awin.com' -and $host1 -ne '127.0.0.1') { Say 'Μη αναμενόμενη διεύθυνση λήψης.' 'Red'; Finish 2 }
$ids = @($Advertiser | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ } | ForEach-Object { if ($_ -notmatch '^\d{2,9}$') { Say ('Λάθος αριθμός καταστήματος: {0}' -f $_) 'Red'; Finish 2 }; $_ })
if (-not (Test-Path -LiteralPath $Archive)) { Say ('Δεν βρήκα τον φάκελο των feeds: {0}' -f $Archive) 'Red'; Finish 2 }

# 1. The feed key (asked once, kept encrypted for this Windows user).
if (-not (Test-Path -LiteralPath $KeyFile)) {
    Write-Host ''
    Write-Host 'Χρειάζομαι μία φορά το κλειδί των feeds του Awin (Toolbox > Create-a-Feed, είναι το κομμάτι μετά το /apikey/ σε ένα link λήψης).' -ForegroundColor Yellow
    Write-Host 'Θα φυλαχτεί κρυπτογραφημένο μόνο για τον χρήστη σου στα Windows. Δεν θα φαίνεται πουθενά.'
    $sec = Read-Host 'Κλειδί Awin feed' -AsSecureString
    if ($sec.Length -lt 8) { Say 'Δεν δόθηκε κλειδί. Σταμάτησα.' 'Yellow'; Finish 1 }
    $dir = Split-Path -Parent $KeyFile
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($KeyFile, (ConvertFrom-SecureString $sec), [System.Text.Encoding]::ASCII)
    Say ('Το κλειδί φυλάχτηκε κρυπτογραφημένο: {0}' -f $KeyFile) 'Green'
}
try {
    $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($KeyFile).Trim())
    $script:secret = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
} catch { Say 'Δεν μπόρεσα να διαβάσω το φυλαγμένο κλειδί. Σβήσε το αρχείο του και ξανατρέξε για να το δώσεις ξανά.' 'Red'; Say $KeyFile; Finish 3 }
if ($script:secret -notmatch '^[A-Za-z0-9]{8,64}$') { Say 'Το φυλαγμένο κλειδί δεν μοιάζει με κλειδί του Awin.' 'Red'; Finish 3 }

# 2. The feed list (read-only).
$listUrl = '{0}/datafeed/list/apikey/{1}' -f $BaseUrl.TrimEnd('/'), $script:secret
try { $resp = Invoke-WebRequest -UseBasicParsing -Uri $listUrl -TimeoutSec 120 } catch { Say ('Το Awin δεν έδωσε τη λίστα των feeds: {0}' -f $_.Exception.Message) 'Red'; Finish 4 }
$list = @($resp.Content | ConvertFrom-Csv)
if ($list.Count -lt 1) { Say 'Η λίστα των feeds ήρθε άδεια.' 'Red'; Finish 4 }
function Col($row, [string]$re) { foreach ($p in $row.PSObject.Properties) { if ($p.Name -match $re) { return [string]$p.Value } }; return '' }
$joined = @($list | Where-Object { (Col $_ '(?i)membership') -match '(?i)^\s*(active|joined)\s*$' })
Say ('Λίστα Awin: {0} feeds, {1} από προγράμματα όπου είσαι μέλος.' -f $list.Count, $joined.Count)

$todo = New-Object System.Collections.Generic.List[object]
foreach ($id in $ids) {
    $rows = @($list | Where-Object { (Col $_ '(?i)^advertiser.?id$') -eq $id })
    Say ''
    if ($rows.Count -eq 0) { Say ('{0}: δεν υπάρχει στη λίστα σου (δεν είσαι μέλος ή δεν έχει feed).' -f $id) 'Yellow'; continue }
    foreach ($r in $rows) {
        $fid = Col $r '(?i)^feed.?id$'
        $name = Col $r '(?i)^advertiser.?name$'
        $mem = Col $r '(?i)membership'
        $cnt = Col $r '(?i)(no|number).?of.?products|products'
        $last = Col $r '(?i)last.?imported'
        $local = Join-Path $Archive ('AWIN_{0}_{1}.csv.gz' -f $id, $fid)
        $localTxt = 'δεν υπάρχει'
        if (Test-Path -LiteralPath $local) { $localTxt = (Get-Item -LiteralPath $local).LastWriteTime.ToString('yyyy-MM-dd HH:mm') }
        Say ('{0} {1}, feed {2}: μέλος: {3} | προϊόντα στο Awin: {4} | ανανέωση Awin: {5} | αντίγραφο εδώ: {6}' -f $id, $name, $fid, $mem, $cnt, $last, $localTxt)
        if ($fid -match '^\d+$' -and $mem -match '(?i)^\s*(active|joined)\s*$') { $todo.Add(@{ id = $id; fid = $fid; name = $name; local = $local; count = $cnt }) }
        elseif ($fid -match '^\d+$') { Say '  δεν κατεβαίνει: δεν είσαι ενεργό μέλος αυτού του προγράμματος.' 'Yellow' }
    }
}
Say ''
if ($todo.Count -eq 0) { Say 'Δεν υπάρχει feed για λήψη.' 'Yellow'; Finish 0 }
Say ('Με -Apply: λήψη {0} feeds στο {1}. Το παλιό αντίγραφο πάει πρώτα στο _old\{2}. Τα sites δεν αλλάζουν.' -f $todo.Count, $Archive, $stamp)
if (-not $Apply) { Say 'Μόνο ανάγνωση (χωρίς -Apply): δεν κατέβηκε τίποτα.' 'Green'; Say ('Η φράση έγκρισης: {0}' -f $Phrase); Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# 3. Download, check, then swap (old copy kept).
$oldDir = Join-Path (Join-Path $Archive '_old') $stamp
$ok = 0
foreach ($t in $todo) {
    $url = '{0}/datafeed/download/apikey/{1}/fid/{2}/format/csv/language/any/delimiter/%2C/compression/gzip/adultcontent/1/columns/{3}/' -f $BaseUrl.TrimEnd('/'), $script:secret, $t.fid, $Columns
    $part = $t.local + '.part'
    Write-Host ('Κατεβάζω {0} (feed {1})...' -f $t.name, $t.fid)
    try { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $part -TimeoutSec 1800 } catch { Say ('{0}: η λήψη απέτυχε: {1}' -f $t.name, $_.Exception.Message) 'Red'; Remove-Item -LiteralPath $part -ErrorAction SilentlyContinue; continue }
    $bytes = New-Object byte[] 2
    $fs = [System.IO.File]::OpenRead($part); [void]$fs.Read($bytes, 0, 2); $fs.Close()
    if ($bytes[0] -ne 0x1f -or $bytes[1] -ne 0x8b) { Say ('{0}: δεν ήρθε συμπιεσμένο feed (ίσως μήνυμα λάθους από το Awin). Κράτησα το παλιό.' -f $t.name) 'Red'; Remove-Item -LiteralPath $part; continue }
    $chk = @(& node -e "const z=require('zlib'),fs=require('fs');let t=z.gunzipSync(fs.readFileSync(process.argv[1])).toString('utf8');const h=t.split('\n',1)[0].toLowerCase();let n=0;for(const l of t.split('\n'))if(l.trim())n++;console.log((h.includes('product_name')?'ok':'bad')+' '+Math.max(0,n-1))" $part)
    $cp = ([string]($chk -join ' ')).Trim() -split '\s+'
    if ($cp[0] -ne 'ok') { Say ('{0}: το αρχείο δεν έχει στήλη product_name. Κράτησα το παλιό.' -f $t.name) 'Red'; Remove-Item -LiteralPath $part; continue }
    $newRows = [int]$cp[1]
    $oldRows = -1
    if (Test-Path -LiteralPath $t.local) {
        $oc = @(& node -e "const z=require('zlib'),fs=require('fs');let n=0;for(const l of z.gunzipSync(fs.readFileSync(process.argv[1])).toString('utf8').split('\n'))if(l.trim())n++;console.log(Math.max(0,n-1))" $t.local)
        $oldRows = [int](([string]($oc -join '')).Trim())
    }
    if ($oldRows -ge 100 -and $newRows -lt ($oldRows / 2)) {
        Say ('{0}: ήρθαν {1} γραμμές, ενώ το παλιό είχε {2}. Μάλλον κάτι πήγε στραβά, κράτησα το παλιό (το νέο έμεινε ως .part για έλεγχο).' -f $t.name, $newRows, $oldRows) 'Yellow'
        continue
    }
    if (Test-Path -LiteralPath $t.local) {
        if (-not (Test-Path -LiteralPath $oldDir)) { New-Item -ItemType Directory -Path $oldDir -Force | Out-Null }
        Move-Item -LiteralPath $t.local -Destination (Join-Path $oldDir (Split-Path -Leaf $t.local)) -Force
    }
    Move-Item -LiteralPath $part -Destination $t.local -Force
    $ok++
    $was = 'καινούργιο'
    if ($oldRows -ge 0) { $was = 'πριν {0}' -f $oldRows }
    Say ('{0}: OK, {1} γραμμές ({2}).' -f $t.name, $newRows, $was) 'Green'
}
Say ''
Say ('ΕΤΟΙΜΟ: κατέβηκαν {0} από {1} feeds. Τα παλιά αντίγραφα: {2}' -f $ok, $todo.Count, $oldDir) 'Green'
Say 'Τα sites δεν άλλαξαν. Επόμενο βήμα: tools/legacy-import.ps1 για το κατάστημα (δείχνει τι άλλαξε και ζητά έγκριση).'
Finish 0
