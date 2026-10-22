<#
.SYNOPSIS
  Gear World app - brand pack (new logo and app icons). Read-only unless -Apply and the approval phrase.

.DESCRIPTION
  Copies the Gear World app brand pack (app/brand in this repo version) to a NEW folder on this PC:
    <home>\gear-world-app\brand
  The pack has the SVG masters and every PNG size Android, iOS, Expo and the stores need (icons, splash, logos).

  Without -Apply it only checks: lists what would be written and where. Nothing is changed.
  With -Apply and the phrase ΕΓΚΡΙΝΩ GEAR WORLD APP LOGO:
    1. If the folder already exists, it is first moved to <home>\gear-world-app\backups\brand-<time> (backup).
    2. The pack is copied and every file is checked byte for byte (SHA-256).
    3. The preview picture opens so you can see the logo.
  It never touches the Hub, the sites, their logos, Cloudflare or any D1.

  Report: <home>\gear-world-reports\GW_APP_BRAND_<time>.txt (also copied to the clipboard)
#>
param(
    [switch]$Apply,
    [string]$Approve = '',
    [string]$Target = '',
    [string]$OutDir = '',
    [switch]$NoClipboard,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$Phrase = 'ΕΓΚΡΙΝΩ GEAR WORLD APP LOGO'
$source = Join-Path (Join-Path $repo 'app') 'brand'
if (-not $Target) { $Target = Join-Path (Join-Path $HOME 'gear-world-app') 'brand' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('GW_APP_BRAND_{0}.txt' -f $stamp)
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

function Get-RelFiles([string]$dir) {
    $base = (Resolve-Path -LiteralPath $dir).Path.TrimEnd('\', '/')
    $list = @()
    foreach ($f in (Get-ChildItem -LiteralPath $dir -Recurse -File | Sort-Object FullName)) {
        $list += New-Object PSObject -Property @{ Rel = $f.FullName.Substring($base.Length + 1); Full = $f.FullName; Size = $f.Length }
    }
    return $list
}

Say ''
Say ('Gear World app - πακέτο λογότυπου και εικονιδίων ({0})' -f $(if ($Apply) { 'ΕΦΑΡΜΟΓΗ' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ, δεν αλλάζει τίποτα' })) 'Cyan'
Say ('Ημερομηνία: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'))

# 1. The pack in this repo version
if (-not (Test-Path -LiteralPath $source)) { Say ('Δεν βρήκα το πακέτο στην έκδοση του κώδικα: {0}' -f $source) 'Red'; Finish 2 }
$files = @(Get-RelFiles $source)
if ($files.Count -lt 40) { Say ('Το πακέτο έχει μόνο {0} αρχεία, περίμενα τουλάχιστον 40: σταμάτησα.' -f $files.Count) 'Red'; Finish 2 }
$total = 0; foreach ($f in $files) { $total += $f.Size }
Say ('Πακέτο: {0} αρχεία, {1:N1} MB' -f $files.Count, ($total / 1MB))
$groups = $files | Group-Object { ($_.Rel -split '[\\/]')[0] } | Sort-Object Name
foreach ($g in $groups) { Say ('  - {0}: {1} αρχεία' -f $g.Name, $g.Count) }

# 2. The new folder on this PC
Say ('Φάκελος προορισμού: {0}' -f $Target)
$exists = Test-Path -LiteralPath $Target
if ($exists) {
    $old = @(Get-ChildItem -LiteralPath $Target -Recurse -File -ErrorAction SilentlyContinue).Count
    Say ('Ο φάκελος υπάρχει ήδη ({0} αρχεία): με -Apply θα μετακινηθεί πρώτα σε backup.' -f $old) 'Yellow'
} else {
    Say 'Ο φάκελος δεν υπάρχει: θα δημιουργηθεί καινούργιος.'
}
Say 'Δεν αλλάζει: το Hub, τα sites και τα logos τους, το Cloudflare και καμία D1.'

if (-not $Apply) {
    Say ''
    Say 'Μόνο έλεγχος: δεν έγινε καμία αλλαγή.' 'Green'
    Say ('Για να γραφτούν τα αρχεία: ίδια εντολή με -Apply -Approve ''{0}''' -f $Phrase)
    Finish 0
}

# 3. Approval
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε η σωστή φράση έγκρισης: δεν άλλαξα τίποτα.' 'Yellow'; Finish 4 }
Say ('Έγκριση: {0}' -f $Phrase) 'Green'

# 4. Backup of an existing folder (moved, never deleted)
$backup = ''
if ($exists) {
    $bdir = Join-Path (Split-Path -Parent $Target) 'backups'
    if (-not (Test-Path -LiteralPath $bdir)) { New-Item -ItemType Directory -Path $bdir -Force | Out-Null }
    $backup = Join-Path $bdir ('brand-' + $stamp)
    Move-Item -LiteralPath $Target -Destination $backup
    Say ('Backup: ο παλιός φάκελος μετακινήθηκε στο {0}' -f $backup) 'Green'
}

# 5. Copy and verify
try {
    foreach ($f in $files) {
        $dest = Join-Path $Target $f.Rel
        $dd = Split-Path -Parent $dest
        if (-not (Test-Path -LiteralPath $dd)) { New-Item -ItemType Directory -Path $dd -Force | Out-Null }
        Copy-Item -LiteralPath $f.Full -Destination $dest -Force
    }
    $bad = 0
    foreach ($f in $files) {
        $dest = Join-Path $Target $f.Rel
        if (-not (Test-Path -LiteralPath $dest) -or (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $f.Full -Algorithm SHA256).Hash) { $bad++ }
    }
    if ($bad -gt 0) { throw ('{0} αρχεία δεν ταιριάζουν μετά την αντιγραφή' -f $bad) }
} catch {
    Say ('Σφάλμα: {0}' -f $_.Exception.Message) 'Red'
    if ($backup) { Say ('Το backup είναι ανέπαφο στο {0}' -f $backup) 'Yellow' }
    Finish 5
}
Say ('OK: γράφτηκαν και ελέγχθηκαν {0} αρχεία στο {1}' -f $files.Count, $Target) 'Green'

# 6. Rollback steps
Say ''
Say 'Επαναφορά (αν τη χρειαστείς):'
Say ('  Remove-Item -LiteralPath "{0}" -Recurse -Force' -f $Target)
if ($backup) { Say ('  Move-Item -LiteralPath "{0}" -Destination "{1}"' -f $backup, $Target) }

if (-not $NoOpen) {
    $preview = Join-Path (Join-Path $Target 'preview') 'preview-large.png'
    if (Test-Path -LiteralPath $preview) { try { Start-Process -FilePath $preview } catch { } }
    try { Start-Process -FilePath $Target } catch { }
}
Finish 0
