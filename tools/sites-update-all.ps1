<#
.SYNOPSIS
  Updates the 13 Gear World sites and then the Gear World Group page with ONE approval (owner, 14 Nov 2026,
  lessons L131): "put all the approvals together in one command".

.DESCRIPTION
  -Step check   READ-ONLY. Shows the plan: every step in order, and that each site tool is in this version.
  -Step apply   CHANGES THE 13 LIVE SITES AND gearworldgroup.com, one approval: ΕΓΚΡΙΝΩ ALL UPDATES.
                In this order, one at a time, each through its own tool (each tool keeps its own backup and its own
                report): CGW, GGW, HGW, KGW update + remove-preview, AGW, BGW update, MGW, WGW update +
                remove-preview, TGW, VGW, SGW, PGW, ZGW update, then the Group page (the Group adds up the 13 sites'
                numbers, so it goes last, lessons L130). A test address (*-preview Worker) never stays behind.
                If one step fails, nothing after it runs and the report says which sites were already updated.
  Only "update" and "remove-preview" steps are run: never a database, import, domain or switch step.
  Without -Apply nothing changes. Report: <home>\gear-world-reports\SITES_UPDATE_ALL_<step>_<time>.txt
#>
param(
    [ValidateSet('check', 'apply')]
    [string]$Step = 'check',
    [switch]$Apply,
    [string]$Approve = '',
    [string]$OutDir = '',
    [string]$ToolDir = '',
    [switch]$NoClipboard
)

$ErrorActionPreference = 'Stop'
$Phrase = 'ΕΓΚΡΙΝΩ ALL UPDATES'
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
if (-not $ToolDir) { $ToolDir = $PSScriptRoot }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss_fff'

# The steps, in order. code: the letters of the site's own phrase ("ΕΓΚΡΙΝΩ <code> UPDATE").
$Steps = @(
    @{ tool = 'cgw-engine'; step = 'update'; code = 'CGW' }, @{ tool = 'cgw-engine'; step = 'remove-preview'; code = 'CGW' },
    @{ tool = 'ggw-engine'; step = 'update'; code = 'GGW' }, @{ tool = 'ggw-engine'; step = 'remove-preview'; code = 'GGW' },
    @{ tool = 'hgw-engine'; step = 'update'; code = 'HGW' }, @{ tool = 'hgw-engine'; step = 'remove-preview'; code = 'HGW' },
    @{ tool = 'kgw-engine'; step = 'update'; code = 'KGW' }, @{ tool = 'kgw-engine'; step = 'remove-preview'; code = 'KGW' },
    @{ tool = 'agw-cloudflare'; step = 'update'; code = 'AGW' },
    @{ tool = 'bgw-cloudflare'; step = 'update'; code = 'BGW' },
    @{ tool = 'mgw-engine'; step = 'update'; code = 'MGW' }, @{ tool = 'mgw-engine'; step = 'remove-preview'; code = 'MGW' },
    @{ tool = 'wgw-engine'; step = 'update'; code = 'WGW' }, @{ tool = 'wgw-engine'; step = 'remove-preview'; code = 'WGW' },
    @{ tool = 'tgw-cloudflare'; step = 'update'; code = 'TGW' },
    @{ tool = 'vgw-cloudflare'; step = 'update'; code = 'VGW' },
    @{ tool = 'sgw-cloudflare'; step = 'update'; code = 'SGW' },
    @{ tool = 'pgw-cloudflare'; step = 'update'; code = 'PGW' },
    @{ tool = 'zgw-cloudflare'; step = 'update'; code = 'ZGW' },
    @{ tool = 'group-site'; step = 'update'; code = 'GROUP' }
)

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$text, [string]$color = '') {
    $L.Add($text)
    if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
}

function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('SITES_UPDATE_ALL_{0}_{1}.txt' -f $Step.ToUpper(), $stamp)
    $text = $L -join "`r`n"
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host 'Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «1 · Gear World Manager» και πάτα Ctrl+V.' -ForegroundColor Green }
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
        Write-Host ('Για να ανέβουν ΟΛΑ τα παραπάνω, γράψε ακριβώς: {0}' -f $phrase) -ForegroundColor Yellow
        Write-Host '(ή πάτα Enter για να σταματήσω χωρίς αλλαγές)'
        $typed = Read-Host 'Έγκριση'
    }
    return ((Normalize-Phrase $typed) -eq (Normalize-Phrase $phrase))
}

# The phrase each site tool asks for its step, written with the Latin "EGKRINO" (the tools accept it, and it passes
# between Windows PowerShell processes without any problem with Greek letters).
function Step-Phrase($s) {
    if ($s.step -eq 'remove-preview') { return ('EGKRINO {0} REMOVE PREVIEW' -f $s.code) }
    return ('EGKRINO {0} UPDATE' -f $s.code)
}

Say ('GEAR WORLD - ΟΛΑ ΤΑ SITES ΚΑΙ Η GROUP - step: {0} - {1} - {2}' -f $Step, $(if ($Apply) { 'APPLY (με μία έγκριση)' } else { 'ΜΟΝΟ ΕΛΕΓΧΟΣ (δεν αλλάζει τίποτα)' }), (Get-Date -Format 'yyyy-MM-dd HH:mm')) 'Cyan'
Say ''
Say ('Πλάνο ({0} βήματα, ένα-ένα, με αυτή τη σειρά):' -f $Steps.Count)
$n = 0
$missing = @()
foreach ($s in $Steps) {
    $n++
    $what = 'ανεβαίνει η νέα έκδοση (η προηγούμενη μένει για επαναφορά)'
    if ($s.step -eq 'remove-preview') { $what = 'σβήνεται η δοκιμαστική διεύθυνση (*-preview), αν υπάρχει' }
    if ($s.code -eq 'GROUP') { $what = 'ανεβαίνει η σελίδα gearworldgroup.com (τελευταία, μετά τα 13 sites)' }
    Say ('  {0,2}. {1,-6} {2}' -f $n, $s.code, $what)
    if (-not (Test-Path -LiteralPath (Join-Path $ToolDir ($s.tool + '.ps1')))) { $missing += $s.tool }
}
Say ''
if ($missing.Count -gt 0) { Say ('ΠΡΟΒΛΗΜΑ: λείπουν εργαλεία σε αυτή την έκδοση: {0}. Δεν αλλάζω τίποτα.' -f (($missing | Select-Object -Unique) -join ', ')) 'Magenta'; Finish 8 }
Say 'Και τα 14 εργαλεία υπάρχουν: ΕΝΤΑΞΕΙ' 'Cyan'

if ($Step -eq 'check' -or -not $Apply) {
    Say ''
    Say ('Χωρίς -Step apply -Apply δεν αλλάζει τίποτα. Για την αλλαγή: μία φράση, {0}' -f $Phrase) 'Yellow'
    Finish 0
}

if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε η σωστή φράση. Δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }
Say ''
Say 'Έγκριση: ΕΝΤΑΞΕΙ. Ξεκινάω, ένα-ένα.' 'Cyan'

$exe = (Get-Process -Id $PID).Path
$done = New-Object System.Collections.Generic.List[string]
$n = 0
foreach ($s in $Steps) {
    $n++
    $label = '{0} {1}' -f $s.code, $s.step
    $tool = Join-Path $ToolDir ($s.tool + '.ps1')
    Say ''
    Say ('===== {0}/{1}: {2} =====' -f $n, $Steps.Count, $label) 'Cyan'
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $tool, '-Step', $s.step, '-Apply', '-Approve', (Step-Phrase $s), '-OutDir', $OutDir, '-NoClipboard')
    $started = Get-Date
    & $exe @a
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        Say ''
        Say ('ΠΡΟΒΛΗΜΑ στο {0} (κωδικός {1}). Σταμάτησα εδώ: τα επόμενα βήματα ΔΕΝ έτρεξαν.' -f $label, $code) 'Magenta'
        Say ('Έγιναν ήδη: {0}' -f $(if ($done.Count) { $done -join ', ' } else { 'κανένα' }))
        # The end of the failing tool's own report, so this report says why (nothing to look for by hand).
        $rep = @(Get-ChildItem -LiteralPath $OutDir -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $started.AddSeconds(-1) -and $_.Name -notlike 'SITES_UPDATE_ALL_*' } | Sort-Object LastWriteTime | Select-Object -Last 1)
        if ($rep.Count -eq 1) {
            Say ('Το τέλος της αναφοράς του ({0}):' -f $rep[0].Name)
            foreach ($line in @([System.IO.File]::ReadAllLines($rep[0].FullName) | Select-Object -Last 15)) { Say ('     ' + $line) }
        }
        Finish 12
    }
    $done.Add($label)
    Say ('   {0}: ΕΝΤΑΞΕΙ' -f $label) 'Cyan'
}
Say ''
Say ('Έγιναν και τα {0} βήματα: {1}' -f $done.Count, ($done -join ', '))
Say 'Αποτέλεσμα: ΕΤΟΙΜΟ' 'Cyan'
Finish 0
