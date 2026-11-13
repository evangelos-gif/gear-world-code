<#
.SYNOPSIS
  Downloads the product feeds of Daisycon programmes that accepted Gear World into the feed folder (lessons L128).

.DESCRIPTION
  Daisycon is the fourth affiliate network (after Awin, CJ and Rakuten). Each approved programme has a product feed at
  daisycon.io/datafeed with our media id (the same number is in every Daisycon link of ours, so there is no key to keep).
  The feeds are saved as DAISYCON_<programme>.csv.gz in the same folder and with the same column names as the Awin feeds,
  and the Daisycon tracking link of each product in aw_deep_link, so tools/legacy-import.ps1 imports them like CJ shops.

  Without -Apply: READ-ONLY. For each programme (-Program, Daisycon programme ids, e.g. 16029,22318) it finds which feed
  "standard" answers (one product per request), and shows the programme's name, the product fields and 2 samples with
  price, currency, stock, picture and tracking link. Nothing is saved.
  With -Apply and the approval phrase ΕΓΚΡΙΝΩ DAISYCON FEED DOWNLOAD: downloads every product, checks the file (product
  names, Daisycon tracking links), moves the old copy to <folder>\_old\<time>\ and only then puts the new one in its
  place. A download with less than half the products of the old copy is NOT used. The sites do not change: the import is
  a separate step with its own approval.
  Report: <home>\gear-world-reports\DAISYCON_FEED_DOWNLOAD_<time>.txt (copied to the clipboard)
#>
param(
    [Parameter(Mandatory = $true)][string[]]$Program,
    [string]$MediaId = '447289',
    [string]$Standards = '',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Archive = '',
    [string]$Base = '',
    [int]$PauseMs = 200,
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Phrase = 'ΕΓΚΡΙΝΩ DAISYCON FEED DOWNLOAD'

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$t, [string]$c = '') { $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Finish([int]$code) {
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
# Runs the Node part and returns its JSON summary (or $null).
function Invoke-Daisycon([string]$mode, [string]$programs, [string]$out) {
    $a = @((Join-Path (Join-Path $repo 'tools') 'daisycon-feed.mjs'), '--mode', $mode, '--media', $MediaId, '--programs', $programs, '--pause', [string]$PauseMs)
    if ($out) { $a += @('--out', $out) }
    if ($Standards) { $a += @('--standards', $Standards) }
    if ($Base) { $a += @('--base', $Base) }
    # Node writes UTF-8 (names with é, ü, €): read it as UTF-8, not in the console's code page (lessons L58).
    $oldEnc = $null
    try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
    try { $o = @(& node @a) } finally { if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } } }
    $line = ([string](($o | Where-Object { "$_".StartsWith('{') }) | Select-Object -Last 1))
    if (-not $line) { Say ('Το Node δεν έδωσε απάντηση: {0}' -f (($o -join ' ').Substring(0, [Math]::Min(300, ($o -join ' ').Length)))) 'Red'; return $null }
    try { return ($line | ConvertFrom-Json) } catch { Say 'Η απάντηση του Node δεν διαβάστηκε.' 'Red'; return $null }
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
if ($Base -and $Base -notmatch '^http://127\.0\.0\.1:\d+/') { Say 'Μη αναμενόμενη διεύθυνση feeds.' 'Red'; Finish 2 }
$ids = @($Program | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ } | ForEach-Object { if ($_ -notmatch '^\d{2,8}$') { Say ('Λάθος αριθμός προγράμματος του Daisycon: {0}' -f $_) 'Red'; Finish 2 }; $_ } | Select-Object -Unique)
if ($ids.Count -lt 1) { Say 'Δεν δόθηκε πρόγραμμα του Daisycon.' 'Red'; Finish 2 }
if ($Standards -and $Standards -notmatch '^[\d,]+$') { Say 'Λάθος -Standards (π.χ. 1,2,3).' 'Red'; Finish 2 }
if (-not (Test-Path -LiteralPath $Archive)) { Say ('Δεν βρήκα τον φάκελο των feeds: {0}' -f $Archive) 'Red'; Finish 2 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρήκα το Node.js σε αυτόν τον υπολογιστή.' 'Red'; Finish 2 }
Say ('Media (το site σου στο Daisycon): {0} | προγράμματα: {1}' -f $MediaId, ($ids -join ', '))

# 1. Read-only probe (always first): which feed standard answers, samples.
Write-Host 'Ψάχνω το feed κάθε προγράμματος (ένα προϊόν ανά αίτημα, λίγα δευτερόλεπτα ανά πρόγραμμα)...'
$S = Invoke-Daisycon 'probe' ($ids -join ',') ''
if ($null -eq $S) { Finish 4 }
if ($S.error) { Say ('Πρόβλημα: {0}' -f $S.error) 'Red'; Finish 4 }
$good = New-Object System.Collections.Generic.List[string]
foreach ($p in @($S.programs)) {
    Say ''
    if (-not $p.ok) {
        Say ('{0}: δεν βρέθηκε feed με προϊόντα (δοκιμάστηκαν {1} standards). Πρώτη απάντηση: {2}' -f $p.program, $p.tried, $p.firstAnswer) 'Yellow'
        continue
    }
    Say ('{0} {1}: feed standard {2} | πεδία: {3}' -f $p.program, $p.name, $p.standard, (@($p.keys) -join ', '))
    $i = 0
    foreach ($x in @($p.samples)) {
        $i++
        Say ('  Δείγμα {0}: {1} | {2} {3} | απόθεμα: {4} | κατηγορία: {5} | εικόνα: {6} | link Daisycon: {7}' -f $i, $x.name, $x.price, $x.currency, $x.stock, $x.category, $x.image, $x.tracking)
        Say ('     σελίδα: {0}' -f $x.page)
    }
    if (@($p.samples | Where-Object { $_.tracking -eq 'NONE' }).Count -gt 0) { Say '  🟡 ΠΡΟΣΟΧΗ: κάποια δείγματα δεν έχουν link του Daisycon με το media σου. Αυτά δεν θα μπουν στα sites (δεν πληρώνουν).' 'Yellow' }
    $good.Add(('{0}:{1}' -f $p.program, $p.standard))
}
Say ''
if ($good.Count -eq 0) { Say 'Κανένα πρόγραμμα δεν έδωσε feed. Δεν κατέβηκε τίποτα.' 'Yellow'; Finish 0 }
Say ('Με -Apply: λήψη {0} feeds στο {1} (DAISYCON_<πρόγραμμα>.csv.gz). Το παλιό αντίγραφο πάει πρώτα στο _old\{2}. Τα sites δεν αλλάζουν.' -f $good.Count, $Archive, $stamp)
if (-not $Apply) { Say 'Μόνο ανάγνωση (χωρίς -Apply): δεν κατέβηκε τίποτα.' 'Green'; Say ('Η φράση έγκρισης: {0}' -f $Phrase); Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# 2. Download (to .part), check, then swap (old copy kept).
Write-Host ('Κατεβάζω από το Daisycon ({0} προϊόντα ανά αίτημα)...' -f 500)
$D = Invoke-Daisycon 'download' ($good -join ',') $Archive
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
