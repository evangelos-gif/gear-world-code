<#
.SYNOPSIS
  Adtraction: lists the programmes we are approved for and downloads their product feeds into the feed folder (L221).

.DESCRIPTION
  Adtraction is a Swedish affiliate network. On 23 Nov 2026 it approved Gear World for 9 UK shops (chat 7 sheet
  «Εγκρίσεις» rows 1183-1191: Living Chic, Garden Chic, Simply Log Cabins, Defender Security, Online Bedrooms, Sheet
  Story, Showery, Phones Direct, Tyres.net); they go in wave 1 of the massive import with the UK.
  The API token (Adtraction: your account at the bottom of the left menu > Settings > API > Create API key) is asked once
  and kept encrypted for your Windows user (DPAPI) in <home>\gear-world-secrets\adtraction-token.dat. It goes only to
  Adtraction (header X-Token), never into a report, the screen or the repository.
  The channel (our site at Adtraction, a number) is read from the API; when the API does not list it, it is asked once and
  kept in <home>\gear-world-secrets\adtraction-channel.txt (a number, not a secret).

  -Step check (default): READ-ONLY. The programmes this channel is approved for in -Market (default GB), with the number of
  products in their feeds. Nothing is downloaded.
  -Step download -Apply and the approval phrase ΕΓΚΡΙΝΩ ADTRACTION FEED DOWNLOAD: downloads the feed of every approved
  programme with products (or only -Program 1234,5678) as ADTRACTION_<programme>.csv.gz (Awin column names, the Adtraction
  click in aw_deep_link), checks the file, moves the old copy to <folder>\_old\<time>\ and only then puts the new one in
  its place. A download with less than half the products of the old copy is NOT used (L168). The sites do not change: the
  import is a separate step (legacy-import-batch.ps1, the new-engine site tools).
  Report: <home>\gear-world-reports\ADTRACTION_FEED_<step>_<time>.txt (copied to the clipboard)
#>
param(
    [ValidateSet('check', 'download')]
    [string]$Step = 'check',
    [string[]]$Program = @(),
    [string]$Market = 'GB',
    [string]$Channel = '',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Archive = '',
    [string]$SecretFile = '',
    [string]$ChannelFile = '',
    [string]$Base = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
$secrets = Join-Path $HOME 'gear-world-secrets'
if (-not $SecretFile) { $SecretFile = Join-Path $secrets 'adtraction-token.dat' }
if (-not $ChannelFile) { $ChannelFile = Join-Path $secrets 'adtraction-channel.txt' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Phrase = 'ΕΓΚΡΙΝΩ ADTRACTION FEED DOWNLOAD'

$L = New-Object System.Collections.Generic.List[string]
$script:token = ''
function Mask([string]$s) {
    if ($script:token) { $s = $s.Replace($script:token, '***') }
    return $s
}
function Say([string]$t, [string]$c = '') { $t = Mask $t; $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Finish([int]$code) {
    $env:GW_AT_TOKEN = $null
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('ADTRACTION_FEED_{0}_{1}.txt' -f $Step.ToUpperInvariant(), $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('ADTRACTION_FEED_{0}_{1}_{2}.txt' -f $Step.ToUpperInvariant(), $stamp, $n); $n++ }
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
function Run-Node([string[]]$a) {
    $oldEnc = $null
    try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
    $env:GW_AT_TOKEN = $script:token
    try {
        $na = @((Join-Path (Join-Path $repo 'tools') 'adtraction-feed.mjs')) + $a
        if ($Base) { $na += @('--base', $Base) }
        return @(& node @na | ForEach-Object { [string]$_ })
    } finally {
        $env:GW_AT_TOKEN = $null
        if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } }
    }
}

Write-Host ''
$mode = 'ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν κατεβάζει τίποτα)'
if ($Step -eq 'download' -and $Apply) { $mode = 'ΛΗΨΗ (με έγκριση)' }
Say ('Adtraction: προγράμματα και feeds - {0}' -f $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
if ($Base -and $Base -notmatch '^http://127\.0\.0\.1:\d{2,5}$') { Say 'Μη αναμενόμενη διεύθυνση του Adtraction.' 'Red'; Finish 2 }
if ($Market -notmatch '^[A-Za-z]{2,3}(,[A-Za-z]{2,3})*$') { Say ('Λάθος -Market: {0} (π.χ. GB)' -f $Market) 'Red'; Finish 2 }
if ($Channel -and $Channel -notmatch '^\d{3,12}$') { Say 'Λάθος -Channel (μόνο αριθμός).' 'Red'; Finish 2 }
if (-not (Test-Path -LiteralPath $Archive)) { Say ('Δεν βρήκα τον φάκελο των feeds: {0}' -f $Archive) 'Red'; Finish 2 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρήκα το Node.js σε αυτόν τον υπολογιστή.' 'Red'; Finish 2 }
$ids = @($Program | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ } | ForEach-Object { if ($_ -notmatch '^\d{2,12}$') { Say ('Λάθος αριθμός προγράμματος του Adtraction: {0}' -f $_) 'Red'; Finish 2 }; $_ })

# 1. The API token (once; kept encrypted for this Windows user).
if (-not (Test-Path -LiteralPath $SecretFile)) {
    Write-Host ''
    Write-Host 'Μία φορά: το API token του Adtraction.' -ForegroundColor Yellow
    Write-Host 'Στο https://adtraction.com/login : ο λογαριασμός σου κάτω αριστερά > Settings > καρτέλα API > Create API key > Copy.'
    $cs = Read-Host 'API token του Adtraction (δεν θα φαίνεται καθώς το επικολλάς)' -AsSecureString
    $typed = ([System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($cs))).Trim()
    if ($typed -notmatch '^[A-Za-z0-9_-]{16,128}$') { Say 'Αυτό δεν μοιάζει με API token του Adtraction. Σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
    if (-not (Test-Path -LiteralPath $secrets)) { New-Item -ItemType Directory -Path $secrets -Force | Out-Null }
    [System.IO.File]::WriteAllText($SecretFile, (ConvertFrom-SecureString (ConvertTo-SecureString $typed -AsPlainText -Force)), [System.Text.Encoding]::ASCII)
    Say ('Το token φυλάχτηκε κρυπτογραφημένο: {0}' -f $SecretFile) 'Green'
}
try {
    $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($SecretFile).Trim())
    $script:token = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
} catch { Say 'Δεν μπόρεσα να διαβάσω το φυλαγμένο token. Σβήσε το αρχείο του και ξανατρέξε.' 'Red'; Say $SecretFile; Finish 3 }
if ($script:token -notmatch '^[A-Za-z0-9_-]{16,128}$') { Say 'Το φυλαγμένο token δεν είναι σωστό. Σβήσε το αρχείο του και ξανατρέξε.' 'Red'; Say $SecretFile; Finish 3 }
Say 'API token του Adtraction: φυλαγμένο (δεν γράφεται πουθενά).'

# 2. The channel and the approved programmes.
if (-not $Channel -and (Test-Path -LiteralPath $ChannelFile)) { $Channel = ([System.IO.File]::ReadAllText($ChannelFile)).Trim() }
$a = @('programs', '--markets', $Market.ToUpperInvariant())
if ($Channel) { $a += @('--channel', $Channel) }
$o = Run-Node $a
if (@($o | Where-Object { $_ -eq 'NOCHANNEL' }).Count -gt 0) {
    Write-Host ''
    Write-Host 'Το Adtraction δεν έδωσε τον αριθμό του καναλιού σου (το site σου εκεί).' -ForegroundColor Yellow
    Write-Host 'Στο https://adtraction.com/login : Channels (ή Settings > Channels) - ο αριθμός (Channel ID) δίπλα στο gearworldhub.com.'
    $typedCh = (Read-Host 'Channel ID (μόνο αριθμός)').Trim()
    if ($typedCh -notmatch '^\d{3,12}$') { Say 'Αυτό δεν είναι αριθμός καναλιού. Σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
    if (-not (Test-Path -LiteralPath $secrets)) { New-Item -ItemType Directory -Path $secrets -Force | Out-Null }
    [System.IO.File]::WriteAllText($ChannelFile, $typedCh, [System.Text.Encoding]::ASCII)
    Say ('Το κανάλι φυλάχτηκε: {0}' -f $ChannelFile)
    $Channel = $typedCh
    $o = Run-Node @('programs', '--markets', $Market.ToUpperInvariant(), '--channel', $Channel)
}
$progs = @()
foreach ($line in $o) {
    if ($line -match '^CHANNEL (\d+) ?(.*)$') { Say ('Κανάλι: {0} {1}' -f $Matches[1], $Matches[2]) }
    elseif ($line -match '^FAIL (\d+) (\S+) (.*)$') { Say ('Κανάλι {0}, αγορά {1}: το Adtraction απάντησε {2}' -f $Matches[1], $Matches[2], $Matches[3]) 'Yellow' }
    elseif ($line -match '^ERROR') { Say $line 'Red' }
    elseif ($line.StartsWith("PROGRAM`t")) {
        $f = $line -split "`t"
        if ($f.Count -ge 7) { $progs += [pscustomobject]@{ id = $f[1]; channel = $f[2]; market = $f[3]; currency = $f[4]; products = [int]$f[5]; name = $f[6] } }
    }
}
Say ''
Say ('Εγκεκριμένα προγράμματα ({0}): {1}' -f $Market.ToUpperInvariant(), $progs.Count)
foreach ($p in ($progs | Sort-Object name)) {
    $file = Join-Path $Archive ('ADTRACTION_{0}.csv.gz' -f $p.id)
    $have = 'όχι ακόμα στον φάκελο'
    if (Test-Path -LiteralPath $file) { $have = 'υπάρχει ήδη στον φάκελο' }
    Say ('  {0}  {1}  [{2}, {3}]  feed: {4} προϊόντα  (κανάλι {5}, {6})' -f $p.id, $p.name, $p.market, $p.currency, $p.products, $p.channel, $have)
}
if ($progs.Count -eq 0) { Say 'Δεν βρήκα εγκεκριμένο πρόγραμμα. Τα sites δεν άλλαξαν. Στείλε την αναφορά στο Claude.' 'Yellow'; Finish 4 }

$want = @($progs | Where-Object { $_.products -gt 0 })
if ($ids.Count -gt 0) {
    $want = @($progs | Where-Object { $ids -contains $_.id })
    foreach ($i in $ids) { if (-not (@($progs | Where-Object { $_.id -eq $i }).Count)) { Say ('Το πρόγραμμα {0} δεν είναι στα εγκεκριμένα: το αφήνω.' -f $i) 'Yellow' } }
}
Say ''
Say ('Με -Step download -Apply: λήψη {0} feeds στο {1} (ADTRACTION_<πρόγραμμα>.csv.gz). Τα sites δεν αλλάζουν.' -f $want.Count, $Archive)
if ($Step -ne 'download' -or -not $Apply) { Say 'Μόνο ανάγνωση: δεν κατέβηκε τίποτα.' 'Green'; Say ('Η φράση έγκρισης για τη λήψη: {0}' -f $Phrase); Finish 0 }
if ($want.Count -eq 0) { Say 'Κανένα feed με προϊόντα για λήψη.' 'Yellow'; Finish 4 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# 3. Download (to .part), check, then swap (old copy kept). Unfinished .part files of an earlier run are cleared first.
foreach ($old in @(Get-ChildItem -LiteralPath $Archive -Filter 'ADTRACTION_*.csv.gz.part' -File -ErrorAction SilentlyContinue)) {
    Remove-Item -LiteralPath $old.FullName -Force -ErrorAction SilentlyContinue
    Say ('Έσβησα ένα μισοτελειωμένο αρχείο από προηγούμενη λήψη: {0}' -f $old.Name)
}
Write-Host ('Κατεβάζω {0} feeds από το Adtraction (μερικά λεπτά)...' -f $want.Count)
$items = @($want | ForEach-Object { $cur = ''; if ($_.currency -match '^[A-Za-z]{3}$') { $cur = ':' + $_.currency.ToUpperInvariant() }; '{0}:{1}{2}' -f $_.id, $_.channel, $cur })
$o2 = Run-Node @('download', '--archive', $Archive, '--programs', ($items -join ','))
$ok = 0; $rows = 0
foreach ($line in $o2) {
    $nm = ''
    if ($line -match '^(OK|FAIL) (\d+) ') { $id = $Matches[2]; $nm = (@($want | Where-Object { $_.id -eq $id }) | Select-Object -First 1).name }
    if ($line -match '^OK (\d+) (\d+) (\d+)') {
        $ok++; $rows += [int]$Matches[2]
        $note = ''
        if ([int]$Matches[3] -gt 0) { $note = (' ({0} με το βασικό deep link του Adtraction)' -f $Matches[3]) }
        Say ('{0} {1}: OK, {2} προϊόντα{3}' -f $Matches[1], $nm, $Matches[2], $note) 'Green'
    }
    elseif ($line -match '^FAIL (\d+) (\d+) (\d+) ?(.*)$') { Say ('{0} {1}: δεν κατέβηκε ({2}). Κράτησα ό,τι υπήρχε.' -f $Matches[1], $nm, $Matches[4]) 'Yellow' }
    elseif ($line -match '^ERROR') { Say $line 'Red' }
}
Say ''
if ($ok -eq 0) { Say 'Δεν κατέβηκε κανένα feed. Τα sites δεν άλλαξαν. Στείλε την αναφορά στο Claude.' 'Red'; Finish 4 }
Say ('ΕΤΟΙΜΟ: κατέβηκαν {0} από {1} feeds, {2} προϊόντα. Τα παλιά αντίγραφα (αν υπήρχαν): {3}' -f $ok, $want.Count, $rows, (Join-Path (Join-Path $Archive '_old') '<ώρα>')) 'Green'
Say 'Τα sites δεν άλλαξαν. Επόμενο βήμα: οι κανόνες κάθε καταστήματος και η δοκιμή της εισαγωγής.'
Finish 0
