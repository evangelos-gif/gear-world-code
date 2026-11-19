<#
.SYNOPSIS
  Downloads the product feeds of the Linkwise programmes (Greece and Cyprus) into the feed folder (lessons L199).

.DESCRIPTION
  Linkwise is the Greek affiliate network (it accepted Gear World on 18 and 19 Nov 2026). Its "Product feed" tool gives
  one CSV per programme at an address that holds our affiliate code (CD and digits). The code is asked once and kept
  encrypted for your Windows user (DPAPI) in <home>\gear-world-secrets\linkwise-code.dat; it goes only to Linkwise and
  never into a report, the screen or the repository.
  The programmes are the ones with import rules in tools\import-rules\lw-<programme>.mjs (each limited on its site to
  Greece and/or Cyprus with Greek names), or -Program 11532,14184.
  Each feed is saved as LINKWISE_<programme>.csv.gz with the Awin column names and the Linkwise tracking link of each
  product in aw_deep_link, so tools\legacy-import-batch.ps1 imports them like the CJ and Daisycon shops.

  Without -Apply: READ-ONLY. Lists the programmes and the copies already in the feed folder. Nothing is downloaded.
  With -Apply and the approval phrase ΕΓΚΡΙΝΩ LINKWISE FEED DOWNLOAD: downloads every feed (4 at a time), checks the
  file, moves the old copy to <folder>\_old\<time>\ and only then puts the new one in its place. A download with less
  than half the products of the old copy is NOT used. The sites do not change: the import is a separate step.
  Report: <home>\gear-world-reports\LINKWISE_FEED_DOWNLOAD_<time>.txt (copied to the clipboard)
#>
param(
    [string[]]$Program = @(),
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Archive = '',
    [string]$SecretFile = '',
    [int]$Parallel = 4,
    [string]$Base = '',
    [string]$OutDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $Archive) { $Archive = Join-Path (Join-Path $HOME 'Downloads') 'GW_AWIN_BULK_ARCHIVE' }
if (-not $SecretFile) { $SecretFile = Join-Path (Join-Path $HOME 'gear-world-secrets') 'linkwise-code.dat' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Phrase = 'ΕΓΚΡΙΝΩ LINKWISE FEED DOWNLOAD'

$L = New-Object System.Collections.Generic.List[string]
$script:code = ''
function Mask([string]$s) {
    if ($script:code) { $s = $s.Replace($script:code, '***') }
    return [regex]::Replace($s, '\bCD\d{3,9}\b', 'CD***')
}
function Say([string]$t, [string]$c = '') { $t = Mask $t; $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Finish([int]$code) {
    $env:GW_LW_CODE = $null
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('LINKWISE_FEED_DOWNLOAD_{0}.txt' -f $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('LINKWISE_FEED_DOWNLOAD_{0}_{1}.txt' -f $stamp, $n); $n++ }
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
function Count-Rows([string]$path) {
    $oc = @()
    try { $oc = @(& node (Join-Path $PSScriptRoot 'feed-rows.mjs') $path 'product_name' 'aw_deep_link') } catch { $oc = @('bad 0') }
    return (([string]($oc -join ' ')).Trim() -split '\s+')
}

Write-Host ''
$mode = 'ΜΟΝΟ ΑΝΑΓΝΩΣΗ (δεν κατεβάζει τίποτα)'
if ($Apply) { $mode = 'ΛΗΨΗ (με έγκριση)' }
Say ('Λήψη feeds του Linkwise (Ελλάδα και Κύπρος) - {0}' -f $mode) 'Cyan'
Say ('Ώρα: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))
if ($Base -and $Base -notmatch '^http://127\.0\.0\.1:\d{2,5}$') { Say 'Μη αναμενόμενη διεύθυνση του Linkwise.' 'Red'; Finish 2 }
if ($Parallel -lt 1 -or $Parallel -gt 8) { Say 'Λάθος -Parallel (1 έως 8).' 'Red'; Finish 2 }
if (-not (Test-Path -LiteralPath $Archive)) { Say ('Δεν βρήκα τον φάκελο των feeds: {0}' -f $Archive) 'Red'; Finish 2 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Δεν βρήκα το Node.js σε αυτόν τον υπολογιστή.' 'Red'; Finish 2 }

# 1. The programmes: the ones with import rules (tools\import-rules\lw-<programme>.mjs), or -Program.
$ids = @($Program | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ } | ForEach-Object { if ($_ -notmatch '^\d{2,9}$') { Say ('Λάθος αριθμός προγράμματος του Linkwise: {0}' -f $_) 'Red'; Finish 2 }; $_ } | Select-Object -Unique)
if ($ids.Count -eq 0) {
    $rulesDir = Join-Path (Join-Path $repo 'tools') 'import-rules'
    $ids = @(Get-ChildItem -LiteralPath $rulesDir -Filter 'lw-*.mjs' -File | ForEach-Object { $_.BaseName.Substring(3) } | Where-Object { $_ -match '^\d{2,9}$' } | Sort-Object { [int]$_ })
}
if ($ids.Count -lt 1) { Say 'Δεν βρήκα πρόγραμμα του Linkwise με κανόνες εισαγωγής.' 'Red'; Finish 2 }
Say ('Προγράμματα: {0} ({1})' -f $ids.Count, ($ids -join ', '))
$have = 0
foreach ($id in $ids) {
    $f = Join-Path $Archive ('LINKWISE_{0}.csv.gz' -f $id)
    if (Test-Path -LiteralPath $f) { $have++ }
}
Say ('Στον φάκελο {0} υπάρχουν ήδη {1} από αυτά (το παλιό αντίγραφο πάει στο _old πριν μπει το νέο).' -f $Archive, $have)

# 2. The affiliate code (once; kept encrypted for this Windows user).
if (-not (Test-Path -LiteralPath $SecretFile)) {
    Write-Host ''
    Write-Host 'Μία φορά: ο κωδικός συνεργάτη σου στο Linkwise (τα γράμματα CD και αριθμοί).' -ForegroundColor Yellow
    Write-Host 'Επικόλλησε είτε τον κωδικό είτε οποιοδήποτε link του Linkwise που τον έχει (π.χ. τη διεύθυνση ενός feed ή ένα link go.linkwi.se): τον βρίσκω μέσα.' -ForegroundColor Yellow
    $cs = Read-Host 'Κωδικός ή link του Linkwise (δεν θα φαίνεται καθώς το επικολλάς)' -AsSecureString
    $raw = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($cs))
    $typed = ''
    $m = [regex]::Match(([string]$raw).ToUpperInvariant(), '(?<![A-Z0-9])CD\d{3,9}(?!\d)')
    if ($m.Success) { $typed = $m.Value }
    if ($typed -notmatch '^CD\d{3,9}$') { Say 'Δεν βρήκα κωδικό του Linkwise (CD και αριθμοί). Σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }
    $dir = Split-Path -Parent $SecretFile
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($SecretFile, (ConvertFrom-SecureString (ConvertTo-SecureString $typed -AsPlainText -Force)), [System.Text.Encoding]::ASCII)
    Say ('Ο κωδικός φυλάχτηκε κρυπτογραφημένος: {0}' -f $SecretFile) 'Green'
}
try {
    $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($SecretFile).Trim())
    $script:code = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()
} catch { Say 'Δεν μπόρεσα να διαβάσω τον φυλαγμένο κωδικό. Σβήσε το αρχείο του και ξανατρέξε.' 'Red'; Say $SecretFile; Finish 3 }
if ($script:code -notmatch '^CD\d{3,9}$') { Say 'Ο φυλαγμένος κωδικός δεν είναι σωστός. Σβήσε το αρχείο του και ξανατρέξε.' 'Red'; Say $SecretFile; Finish 3 }
Say 'Κωδικός Linkwise: φυλαγμένος (δεν γράφεται πουθενά).'

Say ''
Say ('Με -Apply: λήψη {0} feeds στο {1} (LINKWISE_<πρόγραμμα>.csv.gz), {2} τη φορά. Τα sites δεν αλλάζουν.' -f $ids.Count, $Archive, $Parallel)
if (-not $Apply) { Say 'Μόνο ανάγνωση (χωρίς -Apply): δεν κατέβηκε τίποτα.' 'Green'; Say ('Η φράση έγκρισης: {0}' -f $Phrase); Finish 0 }
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε έγκριση: σταμάτησα χωρίς αλλαγές.' 'Yellow'; Finish 1 }

# 3. Download (to .part), check, then swap (old copy kept). Unfinished .part files of an earlier run are cleared first.
foreach ($old in @(Get-ChildItem -LiteralPath $Archive -Filter 'LINKWISE_*.csv.gz.part' -File -ErrorAction SilentlyContinue)) {
    Remove-Item -LiteralPath $old.FullName -Force -ErrorAction SilentlyContinue
    Say ('Έσβησα ένα μισοτελειωμένο αρχείο από προηγούμενη λήψη: {0}' -f $old.Name)
}
Write-Host ('Κατεβάζω {0} feeds από το Linkwise ({1} τη φορά, μερικά λεπτά)...' -f $ids.Count, $Parallel)
$out = Join-Path $env:TEMP ('gw-linkwise-{0}.tsv' -f $stamp)
$env:GW_LW_CODE = $script:code
$oldEnc = $null
try { $oldEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }
try {
    $na = @((Join-Path (Join-Path $repo 'tools') 'linkwise-feed.mjs'), 'download', '--archive', $Archive, '--programs', ($ids -join ','), '--parallel', ([string]$Parallel), '--out', $out)
    if ($Base) { $na += @('--base', $Base) }
    $o = @(& node @na)
} finally {
    $env:GW_LW_CODE = $null
    if ($oldEnc) { try { [Console]::OutputEncoding = $oldEnc } catch { } }
}
$ok = 0; $bad = 0; $rows = 0
foreach ($line in $o) {
    $t = [string]$line
    if ($t -match '^OK (\d+) (\d+)') { $ok++; $rows += [int]$Matches[2]; Say ('{0}: OK, {1} προϊόντα' -f $Matches[1], $Matches[2]) 'Green' }
    elseif ($t -match '^FAIL (\d+) (\d+) ?(.*)$') { $bad++; Say ('{0}: δεν κατέβηκε ({1}). Κράτησα ό,τι υπήρχε.' -f $Matches[1], $Matches[3]) 'Yellow' }
    elseif ($t -match '^ERROR') { Say $t 'Red' }
}
if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force -ErrorAction SilentlyContinue }
Say ''
if ($ok -eq 0) { Say 'Δεν κατέβηκε κανένα feed. Τα sites δεν άλλαξαν. Στείλε την αναφορά στο Claude.' 'Red'; Finish 4 }
Say ('ΕΤΟΙΜΟ: κατέβηκαν {0} από {1} feeds, {2} προϊόντα. Τα παλιά αντίγραφα (αν υπήρχαν): {3}' -f $ok, $ids.Count, $rows, (Join-Path (Join-Path $Archive '_old') '<ώρα>')) 'Green'
Say 'Τα sites δεν άλλαξαν. Επόμενο βήμα: η δοκιμή της εισαγωγής (legacy-import-batch), μετά η έγκρισή της.'
Finish 0
