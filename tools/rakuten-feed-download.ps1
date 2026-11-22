<#
.SYNOPSIS
  Downloads the product catalogues of Rakuten Advertising advertisers that accepted Gear World into the feed folder (L128).

.DESCRIPTION
  Rakuten gives its catalogues only as files on its server for publishers (aftp.linksynergy.com), with a user name and
  password that Rakuten's support sends on request (one per publisher; the web login does not work there). Each advertiser
  that accepted you and has a catalogue is one file <MID>_<SID>_mp.txt.gz (or .xml.gz). They are saved as RAKUTEN_<MID>.csv.gz
  in the same folder and with the same column names as the Awin feeds, with the Rakuten tracking link of each product in
  aw_deep_link, so tools/legacy-import.ps1 imports them like CJ shops (lessons L86).

  Only SFTP (lessons L217): Rakuten's publisher guide offers SFTP and a plain FTP that is being retired; plain FTP sends the
  password unencrypted, so it is never used (before L217 the tool tried FTPS, which Rakuten does not offer, and then fell
  back to plain FTP). The SFTP client is tools\rakuten-sftp\sftp.mjs (the npm package ssh2, pinned in its package-lock,
  installed once with npm ci). The server's host key is pinned: the first connection keeps its fingerprint in
  <home>\gear-world-secrets\rakuten-sftp-hostkey.txt, and the tool stops if a later connection shows another one.
  The user name and password are asked once (the password is not shown while typed) and kept encrypted for your
  Windows user (DPAPI) in <home>\gear-world-secrets\rakuten-ftp.dat. They are never written to a report, the clipboard,
  the command line or the repo, and are sent only to a Rakuten server (linksynergy.com or rakutenadvertising.*).

  Without -Apply: READ-ONLY. Lists the catalogue files on the server (advertiser number, size, date) and, for the chosen
  advertisers (-Advertiser, Rakuten MIDs; default all, at most -SampleMax), reads only the first part of the file to show
  the advertiser's name, the fields and 2 samples with price, currency, stock, picture and tracking link. Nothing is saved
  in the feed folder (the first part goes to %TEMP% and is deleted). With -Apply the first parts are not read again (each
  file is downloaded once).
  With -Apply and the approval phrase ΕΓΚΡΙΝΩ RAKUTEN FEED DOWNLOAD: downloads each file (not bigger than -MaxMb), checks
  that it is whole (the product count of its last line), converts it as a stream (a catalogue over 512 MB of text too,
  L185), moves the old copy to <folder>\_old\<time>\ and
  only then puts the new one in place. A file with less than half the products of the old copy is NOT used.
  The sites do not change: the import is a separate step with its own approval.
  Report: <home>\gear-world-reports\RAKUTEN_FEED_DOWNLOAD_<time>.txt (copied to the clipboard)
#>
param(
    [string[]]$Advertiser = @(),
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Archive = '',
    [string]$SecretFile = '',
    [string]$HostKeyFile = '',
    [int]$Port = 22,
    [int]$MaxMb = 150,
    [int]$SampleMax = 15,
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
if (-not $SecretFile) { $SecretFile = Join-Path (Join-Path $HOME 'gear-world-secrets') 'rakuten-ftp.dat' }
if (-not $HostKeyFile) { $HostKeyFile = Join-Path (Join-Path $HOME 'gear-world-secrets') 'rakuten-sftp-hostkey.txt' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Phrase = 'ΕΓΚΡΙΝΩ RAKUTEN FEED DOWNLOAD'

$L = New-Object System.Collections.Generic.List[string]
$script:user = ''
$script:pass = ''
$script:server = ''
$script:hostKey = ''
function Mask([string]$s) {
    if ($script:pass -and $script:pass.Length -ge 4) { $s = $s.Replace($script:pass, '***') }
    if ($script:user -and $script:user.Length -ge 3) { $s = $s.Replace($script:user, '<user>') }
    return $s
}
function Say([string]$t, [string]$c = '') { $t = Mask $t; $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Finish([int]$code) {
    $script:pass = ''
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('RAKUTEN_FEED_DOWNLOAD_{0}.txt' -f $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('RAKUTEN_FEED_DOWNLOAD_{0}_{1}.txt' -f $stamp, $n); $n++ }
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
# Only Rakuten's own servers get the password (or the tests' local fake server).
function Test-RakutenHost([string]$h) {
    return ($h -match '^[a-z0-9.-]+\.(linksynergy\.com|rakutenadvertising\.(com|io)|rakutenmarketing\.com)$' -or $h -eq '127.0.0.1')
}
# The SFTP client (tools\rakuten-sftp, npm package ssh2 pinned in its package-lock): installed once per version of the code.
function Ensure-Sftp {
    $dir = Join-Path (Join-Path $repo 'tools') 'rakuten-sftp'
    if (Test-Path -LiteralPath (Join-Path (Join-Path $dir 'node_modules') 'ssh2')) { return $true }
    Write-Host 'Εγκαθιστώ μία φορά το πρόγραμμα SFTP (npm ci, περίπου 1 λεπτό)...'
    $cmdFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-rakuten-npm-ci.cmd'
    $body = "@echo off`r`ncd /d `"$dir`"`r`ncall npm ci --omit=optional --no-audit --no-fund >nul 2>&1`r`n"
    [System.IO.File]::WriteAllText($cmdFile, $body, [System.Text.Encoding]::ASCII)
    & $cmdFile
    $code = $LASTEXITCODE
    Remove-Item -LiteralPath $cmdFile -ErrorAction SilentlyContinue
    return ($code -eq 0 -and (Test-Path -LiteralPath (Join-Path (Join-Path $dir 'node_modules') 'ssh2')))
}
# One SFTP step (list, or get a file); the user name and password go only through the environment, for this call.
function Invoke-Sftp([string[]]$a) {
    $env:GW_RK_HOST = $script:server; $env:GW_RK_PORT = [string]$Port; $env:GW_RK_USER = $script:user; $env:GW_RK_PASS = $script:pass; $env:GW_RK_HOSTKEY = $script:hostKey
    $env:NODE_NO_WARNINGS = '1'
    $oldEnc = $null
    $o = @()
    try {
        try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
        $o = @(& node (Join-Path (Join-Path (Join-Path $repo 'tools') 'rakuten-sftp') 'sftp.mjs') @a)
    } finally {
        $env:GW_RK_USER = $null; $env:GW_RK_PASS = $null; $env:GW_RK_HOSTKEY = $null; $env:GW_RK_HOST = $null; $env:GW_RK_PORT = $null; $env:NODE_NO_WARNINGS = $null
        if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } }
    }
    $line = ([string](($o | Where-Object { "$_".StartsWith('{') }) | Select-Object -Last 1))
    if (-not $line) { return $null }
    try { return ($line | ConvertFrom-Json) } catch { return $null }
}
function Invoke-RakutenNode([string[]]$a) {
    $oldEnc = $null
    try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
    try { $o = @(& node (Join-Path (Join-Path $repo 'tools') 'rakuten-feed.mjs') @a) } finally { if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } } }
    $line = ([string](($o | Where-Object { "$_".StartsWith('{') }) | Select-Object -Last 1))
    if (-not $line) { return $null }
    try { return ($line | ConvertFrom-Json) } catch { return $null }
}
function Count-Rows([string]$path) {
    $oc = @()
    try { $oc = @(& node (Join-Path $PSScriptRoot 'feed-rows.mjs') $path 'product_name' 'aw_deep_link') } catch { $oc = @('bad 0') }
    return (([string]($oc -join ' ')).Trim() -split '\s+')
}

Write-Host ''
$mode = 'ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν κατεβάζει τίποτα στον φάκελο των feeds)'
if ($Apply) { $mode = 'ΛΗΨΗ (με έγκριση)' }
Say ('Λήψη καταλόγων του Rakuten - {0}' -f $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
$ids = @($Advertiser | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ } | ForEach-Object { if ($_ -notmatch '^\d{2,10}$') { Say ('Λάθος αριθμός καταστήματος (MID) του Rakuten: {0}' -f $_) 'Red'; Finish 2 }; $_ })
if (-not (Test-Path -LiteralPath $Archive)) { Say ('Δεν βρήκα τον φάκελο των feeds: {0}' -f $Archive) 'Red'; Finish 2 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρήκα το Node.js σε αυτόν τον υπολογιστή.' 'Red'; Finish 2 }

# 1. The server, user name and password (asked once, kept encrypted for this Windows user).
if (-not (Test-Path -LiteralPath $SecretFile)) {
    Write-Host ''
    Write-Host 'Χρειάζομαι μία φορά τα στοιχεία του server του Rakuten, από το email της υποστήριξης του Rakuten.' -ForegroundColor Yellow
    $srv = (Read-Host 'Διεύθυνση server (πάτα Enter για aftp.linksynergy.com)').Trim()
    if (-not $srv) { $srv = 'aftp.linksynergy.com' }
    $srv = ($srv -replace '^(s?ftps?://)', '').TrimEnd('/')
    if (-not (Test-RakutenHost $srv)) { Say ('Η διεύθυνση δεν είναι server του Rakuten: {0}. Σταμάτησα.' -f $srv) 'Red'; Finish 2 }
    $u = (Read-Host 'Όνομα χρήστη (username) του server').Trim()
    $sec = Read-Host 'Κωδικός (password) του server - δεν θα φαίνεται καθώς τον γράφεις' -AsSecureString
    if (-not $u -or $sec.Length -lt 4) { Say 'Δεν δόθηκαν στοιχεία. Σταμάτησα.' 'Yellow'; Finish 1 }
    $p = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    $json = (New-Object PSObject -Property @{ server = $srv; user = $u; pass = $p }) | ConvertTo-Json -Compress
    $p = ''
    $dir = Split-Path -Parent $SecretFile
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($SecretFile, (ConvertFrom-SecureString (ConvertTo-SecureString $json -AsPlainText -Force)), [System.Text.Encoding]::ASCII)
    $json = ''
    Say ('Τα στοιχεία φυλάχτηκαν κρυπτογραφημένα: {0}' -f $SecretFile) 'Green'
}
try {
    $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($SecretFile).Trim())
    $c = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)) | ConvertFrom-Json
    $script:server = [string]$c.server
    $script:user = [string]$c.user
    $script:pass = [string]$c.pass
    $c = $null
} catch { Say 'Δεν μπόρεσα να διαβάσω τα φυλαγμένα στοιχεία. Σβήσε το αρχείο τους και ξανατρέξε για να τα δώσεις ξανά.' 'Red'; Say $SecretFile; Finish 3 }
if (-not (Test-RakutenHost $script:server) -or -not $script:user -or -not $script:pass) { Say 'Τα φυλαγμένα στοιχεία δεν μοιάζουν σωστά. Σβήσε το αρχείο τους και ξανατρέξε.' 'Red'; Say $SecretFile; Finish 3 }

# 2. The list of catalogue files, by SFTP only (lessons L217: plain FTP sends the password unencrypted and is being retired).
if (-not (Ensure-Sftp)) { Say 'Η εγκατάσταση του προγράμματος SFTP (npm ci) απέτυχε. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 3 }
if (Test-Path -LiteralPath $HostKeyFile) { $script:hostKey = ([System.IO.File]::ReadAllText($HostKeyFile)).Trim() }
$Lst = Invoke-Sftp @('--mode', 'list')
if ($null -eq $Lst) { Say 'Το πρόγραμμα SFTP δεν έδωσε απάντηση. Στείλε στο Claude αυτό το μήνυμα.' 'Red'; Finish 4 }
if (-not $Lst.ok) {
    if ($Lst.hostKey) { Say ('🔴 ΠΡΟΒΛΗΜΑ: ο server {0} έδειξε άλλο κλειδί ({1}) από αυτό που κρατήσαμε ({2}). Σταμάτησα χωρίς να στείλω τον κωδικό. Στείλε στο Claude αυτό το μήνυμα.' -f $script:server, $Lst.fingerprint, $script:hostKey) 'Red'; Finish 4 }
    if ($Lst.auth) { Say ('Ο server δεν δέχτηκε το όνομα ή τον κωδικό: {0}' -f $Lst.error) 'Red'; Say 'Σβήσε το αρχείο των στοιχείων και ξανατρέξε για να τα δώσεις ξανά:'; Say $SecretFile; Finish 4 }
    Say ('Δεν έγινε σύνδεση SFTP με {0}: {1}' -f $script:server, $Lst.error) 'Red'; Say 'Στείλε την αναφορά στο Claude.'; Finish 4
}
if (-not $script:hostKey) {
    $dir = Split-Path -Parent $HostKeyFile
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($HostKeyFile, [string]$Lst.fingerprint, [System.Text.Encoding]::ASCII)
    $script:hostKey = [string]$Lst.fingerprint
    Say ('Πρώτη σύνδεση με {0}: κράτησα το κλειδί του server ({1}) στο {2}.' -f $script:server, $script:hostKey, $HostKeyFile) 'Green'
}
Say ('Σύνδεση με {0}: κρυπτογραφημένη (SFTP), κλειδί server {1}.' -f $script:server, $script:hostKey) 'Green'
$names = @($Lst.files | ForEach-Object { [string]$_.name })
$files = New-Object System.Collections.Generic.List[object]
foreach ($e in @($Lst.files)) {
    $m = [regex]::Match([string]$e.name, '^(\d+)_(\d+)_mp\.(txt|xml)\.gz$')
    if (-not $m.Success) { continue }
    $when = ''
    try { $when = ([DateTimeOffset]::FromUnixTimeSeconds([long]$e.mtime)).UtcDateTime.ToString('yyyy-MM-dd HH:mm') } catch { }
    $files.Add((New-Object PSObject -Property @{ size = [long]$e.size; date = $when; mid = $m.Groups[1].Value; sid = $m.Groups[2].Value; ext = $m.Groups[3].Value; name = [string]$e.name }))
}
# One catalogue per advertiser (L217): the server keeps the same catalogue twice, as .txt.gz (pipes) and .xml.gz; the
# .txt.gz is the smaller one. Both used to be downloaded, one over the other.
$byMid = @{}
foreach ($f in $files) {
    $k = $f.mid
    if (-not $byMid.ContainsKey($k) -or ($f.ext -eq 'txt' -and $byMid[$k].ext -ne 'txt')) { $byMid[$k] = $f }
}
$twice = $files.Count - $byMid.Count
$files = New-Object System.Collections.Generic.List[object]
foreach ($k in $byMid.Keys) { $files.Add($byMid[$k]) }
if ($twice -gt 0) { Say ('Ίδιος κατάλογος σε δύο μορφές (txt και xml) για {0} καταστήματα: κρατάω το .txt.gz.' -f $twice) }
Say ('Κατάλογοι στον server: {0} (ένας για κάθε κατάστημα που σε έχει δεχτεί και έχει κατάλογο). Άλλα αρχεία: {1}.' -f $files.Count, ($names.Count - $files.Count))
foreach ($f in @($files | Sort-Object { [long]$_.size } -Descending)) { Say ('  MID {0} | {1} MB | {2} | {3}' -f $f.mid, [Math]::Round($f.size / 1MB, 1), $f.date, $f.name) }
$pick = @($files | Where-Object { $ids.Count -eq 0 -or $ids -contains $_.mid })
foreach ($i in $ids) { if (-not (@($files | Where-Object { $_.mid -eq $i }).Count)) { Say ('MID {0}: δεν υπάρχει κατάλογος στον server (δεν σε έχει δεχτεί ακόμα ή δεν έχει κατάλογο).' -f $i) 'Yellow' } }
if ($pick.Count -eq 0) { Say 'Δεν υπάρχει κατάλογος για λήψη.' 'Yellow'; Finish 0 }

# 3. Read-only look: the first 256 KB of each chosen file, to %TEMP% and deleted again.
$good = New-Object System.Collections.Generic.List[object]
$k = 0
foreach ($f in $pick) {
    $k++
    Say ''
    if ($f.size -gt ($MaxMb * 1MB)) { Say ('MID {0}: {1} MB, πάνω από το όριο των {2} MB. Δεν κατεβαίνει (μεγάλωσε το -MaxMb αν το θέλεις).' -f $f.mid, [Math]::Round($f.size / 1MB, 1), $MaxMb) 'Yellow'; continue }
    # With -Apply each file is downloaded once (L217): the samples were in the read-only run, the checks come after the download.
    if ($Apply) { Say ('MID {0} | {1} MB: για λήψη.' -f $f.mid, [Math]::Round($f.size / 1MB, 1)); $good.Add($f); continue }
    if ($k -gt $SampleMax) { Say ('MID {0}: χωρίς δείγμα (όριο {1} δειγμάτων).' -f $f.mid, $SampleMax); $good.Add($f); continue }
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('gw-rakuten-' + $f.mid + '.gz')
    try {
        $G = Invoke-Sftp @('--mode', 'get', '--remote', $f.name, '--out', $tmp, '--bytes', '262144')
        $S = $null
        if ($G -and $G.ok) { $S = Invoke-RakutenNode @('--mode', 'sample', '--in', $tmp, '--partial') }
    } finally { Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue }
    if ($null -eq $S -or -not $S.ok) { Say ('MID {0}: το δείγμα δεν διαβάστηκε ({1}).' -f $f.mid, $(if ($S) { $S.error } else { 'καμία απάντηση' })) 'Red'; continue }
    $hn = ''
    if ($S.header) { $hn = [string]$S.header.name }
    Say ('MID {0} {1}: μορφή {2}' -f $f.mid, $hn, $S.format)
    $j = 0
    foreach ($x in @($S.rows)) {
        $j++
        Say ('  Δείγμα {0}: {1} | {2} {3} | απόθεμα: {4} | κατηγορία: {5} | εικόνα: {6} | link Rakuten: {7}' -f $j, $x.name, $x.price, $x.currency, $x.stock, $x.category, $x.image, $x.tracking)
        Say ('     σελίδα: {0}' -f $x.page)
    }
    if ($S.first -and @($S.first).Count) { Say ('  Πεδία του πρώτου προϊόντος: {0}' -f ((@($S.first)[0].PSObject.Properties | ForEach-Object { '{0}={1}' -f $_.Name, ([string]$_.Value).Substring(0, [Math]::Min(40, ([string]$_.Value).Length)) }) -join ' | ')) }
    if ([int]$S.withTracking -lt [int]$S.of) { Say '  🟡 ΠΡΟΣΟΧΗ: κάποια δείγματα δεν έχουν link του Rakuten. Αυτά δεν θα μπουν στα sites (δεν πληρώνουν).' 'Yellow' }
    $good.Add($f)
}
Say ''
if ($good.Count -eq 0) { Say 'Δεν υπάρχει κατάλογος για λήψη.' 'Yellow'; Finish 0 }
Say ('Με -Apply: λήψη {0} καταλόγων στο {1} (RAKUTEN_<MID>.csv.gz). Το παλιό αντίγραφο πάει πρώτα στο _old\{2}. Τα sites δεν αλλάζουν.' -f $good.Count, $Archive, $stamp)
if (-not $Apply) { Say 'Μόνο ανάγνωση (χωρίς -Apply): δεν κατέβηκε τίποτα στον φάκελο των feeds.' 'Green'; Say ('Η φράση έγκρισης: {0}' -f $Phrase); Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# 4. Download (to .part), check that the file is whole, convert, then swap (old copy kept).
$oldDir = Join-Path (Join-Path $Archive '_old') $stamp
$ok = 0
foreach ($f in $good) {
    $src = Join-Path $Archive ('RAKUTEN_{0}.source.part' -f $f.mid)
    $part = Join-Path $Archive ('RAKUTEN_{0}.csv.gz.part' -f $f.mid)
    $final = Join-Path $Archive ('RAKUTEN_{0}.csv.gz' -f $f.mid)
    Write-Host ('Κατεβάζω MID {0} ({1} MB)...' -f $f.mid, [Math]::Round($f.size / 1MB, 1))
    $G = Invoke-Sftp @('--mode', 'get', '--remote', $f.name, '--out', $src)
    # The size in the server's list is not the size it sends (22 Nov 2026: 1-2% off, both ways, for every catalogue), so a
    # file is judged by its own last line instead (the product count, checked by the conversion below), not by that size.
    if ($null -eq $G -or -not $G.ok -or [long]$G.got -le 0) {
        $why = 'καμία απάντηση'
        if ($G -and -not $G.ok) { $why = [string]$G.error } elseif ($G) { $why = 'άδειο αρχείο' }
        Say ('MID {0}: 🔴 ΠΡΟΒΛΗΜΑ στη λήψη: {1}. Κράτησα το παλιό.' -f $f.mid, $why) 'Red'; Remove-Item -LiteralPath $src -ErrorAction SilentlyContinue; continue
    }
    if ([long]$G.got -lt [long]($f.size * 0.5)) { Say ('MID {0}: 🔴 ΠΡΟΒΛΗΜΑ στη λήψη: ήρθαν {1} από περίπου {2} bytes. Κράτησα το παλιό.' -f $f.mid, $G.got, $f.size) 'Red'; Remove-Item -LiteralPath $src -ErrorAction SilentlyContinue; continue }
    $C = Invoke-RakutenNode @('--mode', 'convert', '--in', $src, '--out', $part)
    Remove-Item -LiteralPath $src -ErrorAction SilentlyContinue
    if ($null -eq $C -or -not $C.ok) { Say ('MID {0}: 🔴 ΠΡΟΒΛΗΜΑ: {1}. Κράτησα το παλιό.' -f $f.mid, $(if ($C) { $C.error } else { 'καμία απάντηση' })) 'Red'; Remove-Item -LiteralPath $part -ErrorAction SilentlyContinue; continue }
    $cp = Count-Rows $part
    if ($cp[0] -ne 'ok') { Say ('MID {0}: το αρχείο δεν διαβάζεται. Κράτησα το παλιό.' -f $f.mid) 'Red'; Remove-Item -LiteralPath $part -ErrorAction SilentlyContinue; continue }
    $newRows = [int]$cp[1]
    $oldRows = -1
    if (Test-Path -LiteralPath $final) { $oldRows = [int]((Count-Rows $final)[1]) }
    if ($oldRows -ge 100 -and $newRows -lt ($oldRows / 2)) {
        Say ('MID {0}: ήρθαν {1} προϊόντα, ενώ το παλιό είχε {2}. Μάλλον κάτι πήγε στραβά, κράτησα το παλιό (το νέο έμεινε ως .part για έλεγχο).' -f $f.mid, $newRows, $oldRows) 'Yellow'
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
    Say ('MID {0} {1}: OK, {2} προϊόντα ({3}), με link του Rakuten: {4}, νόμισμα: {5}. Αρχείο: {6}' -f $f.mid, $C.name, $newRows, $was, $C.withTracking, (@($C.currencies) -join ', '), $final) 'Green'
}
Say ''
Say ('ΕΤΟΙΜΟ: κατέβηκαν {0} από {1} καταλόγους. Τα παλιά αντίγραφα (αν υπήρχαν): {2}' -f $ok, $good.Count, $oldDir) 'Green'
Say 'Τα sites δεν άλλαξαν. Επόμενο βήμα: κανόνες εισαγωγής για κάθε κατάστημα και tools/legacy-import.ps1 (πρώτα δοκιμή, μετά έγκριση).'
Finish 0
