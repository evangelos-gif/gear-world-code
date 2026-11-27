<#
.SYNOPSIS
  Gear World: sets up the end-of-command notifications (owner, 27 Nov 2026, for all chats; lessons L234).

.DESCRIPTION
  Every command then ends with 3 beeps, the voice "Gear World. Command finished." and a Windows notification
  «Gear World – <name>: ΕΤΟΙΜΟ / ΣΦΑΛΜΑ» (tools/gw-notify.ps1). The long «ΜΟΝΗ ΤΗΣ» commands (imports, price refreshes,
  backups) also send «Τελείωσε HH:mm» or «Σφάλμα HH:mm» to the phone through the free ntfy app (https://ntfy.sh).

  Without -Apply: READ-ONLY. Says what is already set up and what -Apply would do. Nothing changes.
  With -Apply and the phrase ΕΓΚΡΙΝΩ ΕΙΔΟΠΟΙΗΣΕΙΣ NTFY:
    1. a dated backup of an older gw-notify.ps1 (if there is one),
    2. copies gw-notify.ps1 to <home>\gear-world-tools\ (the folder Norton leaves alone, 23 Nov 2026),
    3. makes the ntfy topic once: a random private name like gw-xxxx-xxxx-xxxx-xxxx-xxxx (about 99 bits), kept
       encrypted for this Windows user (DPAPI) in <home>\gear-world-secrets\ntfy-topic.dat. An existing topic is kept,
       so the phone stays subscribed; -NewTopic makes a new one (the old file is backed up first).
    4. shows the topic ONLY on this screen, with the steps for the phone, waits for Enter and sends one test
       notification to the phone and one to Windows.
  -ShowTopic (READ-ONLY): shows the saved topic on this screen again (a new phone). Never in the report.
  The topic is never written to the report, the clipboard or the repo: it works like a password, because anyone who
  knows it could read the notifications (which only say «Τελείωσε / Σφάλμα» and the time).
  Report: <home>\gear-world-reports\NOTIFY_SETUP_<time>.txt (copied to the clipboard).
  Rollback: printed in the report (delete the two files, or put the .bak files back, and unsubscribe on the phone).
#>
param(
    [switch]$Apply,
    [string]$Approve = '',
    [switch]$NewTopic,
    [switch]$ShowTopic,
    [switch]$NoWait,
    [switch]$NoTest,
    [switch]$NoClipboard,
    [switch]$NoNotify,
    [string]$ToolsDir = '',
    [string]$SecretsDir = '',
    [string]$OutDir = '',
    [string]$Chat = '1 · Gear World Manager'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (-not $ToolsDir) { $ToolsDir = Join-Path $HOME 'gear-world-tools' }
if (-not $SecretsDir) { $SecretsDir = Join-Path $HOME 'gear-world-secrets' }
if (-not $OutDir) { $OutDir = Join-Path $HOME 'gear-world-reports' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Phrase = 'ΕΓΚΡΙΝΩ ΕΙΔΟΠΟΙΗΣΕΙΣ NTFY'
$src = Join-Path $PSScriptRoot 'gw-notify.ps1'
$dst = Join-Path $ToolsDir 'gw-notify.ps1'
$topicFile = Join-Path $SecretsDir 'ntfy-topic.dat'
$script:exitCode = 0

$L = New-Object System.Collections.Generic.List[string]
function Say([string]$t, [string]$c = '') { $L.Add($t); if ($c) { Write-Host $t -ForegroundColor $c } else { Write-Host $t } }
function Finish([int]$code) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $file = Join-Path $OutDir ('NOTIFY_SETUP_{0}.txt' -f $stamp)
    $n = 2
    while (Test-Path -LiteralPath $file) { $file = Join-Path $OutDir ('NOTIFY_SETUP_{0}_{1}.txt' -f $stamp, $n); $n++ }
    $text = $L -join "`r`n"
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($true)))
    if (-not $NoClipboard) { try { Set-Clipboard -Value $text } catch { } }
    Write-Host ''
    Write-Host ('Η αναφορά γράφτηκε: {0}' -f $file)
    if (-not $NoClipboard) { Write-Host ('Αντιγράφηκε στο πρόχειρο. Πήγαινε στη συζήτηση με το Claude «{0}» και πάτα Ctrl+V.' -f $Chat) -ForegroundColor Cyan }
    if (-not $NoNotify) {
        $nf = $dst
        if (-not (Test-Path -LiteralPath $nf)) { $nf = $src }
        if (Test-Path -LiteralPath $nf) {
            try { & (Join-Path $PSHOME 'powershell.exe') -NoProfile -ExecutionPolicy Bypass -File $nf -Name 'Ειδοποιήσεις' -Code $code } catch { }
        }
    }
    exit $code
}
function Normalize-Phrase([string]$s) {
    $d = ([string]$s).Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    $t = ($sb.ToString().ToUpperInvariant() -replace '\s+', ' ').Trim()
    $t = ($t -replace '^EGKRINO ', 'ΕΓΚΡΙΝΩ ')
    return ($t -replace ' EIDOPOIHSEIS ', ' ΕΙΔΟΠΟΙΗΣΕΙΣ ')
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
    foreach ($one in ([string]$typed).Split(';')) { if ((Normalize-Phrase $one) -eq (Normalize-Phrase $phrase)) { return $true } }
    return $false
}
# A random topic: gw- and 5 groups of 4 from 31 easy characters (no i, l, o, 0, 1), about 99 bits.
function New-Topic {
    $abc = 'abcdefghjkmnpqrstuvwxyz23456789'
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    $one = New-Object byte[] 1
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('gw')
    try {
        for ($g = 0; $g -lt 5; $g++) {
            [void]$sb.Append('-')
            $k = 0
            while ($k -lt 4) {
                $rng.GetBytes($one)
                if ($one[0] -lt 248) { [void]$sb.Append($abc[$one[0] % 31]); $k++ }
            }
        }
    } finally { $rng.Dispose() }
    return $sb.ToString()
}
function Read-Topic {
    if (-not (Test-Path -LiteralPath $topicFile)) { return '' }
    try {
        $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($topicFile).Trim())
        $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
        try { $t = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    } catch { return '?' }
    if ($t -notmatch '^gw(-[a-z0-9]{4}){5}$') { return '?' }
    return $t
}
function Show-PhoneSteps([string]$topic) {
    # Straight to the screen, never through Say: the topic must not reach the report or the clipboard.
    Write-Host ''
    Write-Host '=================== ΜΟΝΟ ΓΙΑ ΤΗΝ ΟΘΟΝΗ ΣΟΥ ===================' -ForegroundColor Yellow
    Write-Host 'Το ιδιωτικό όνομα (topic) για το κινητό είναι:' -ForegroundColor Yellow
    Write-Host ''
    Write-Host ('      ' + $topic) -ForegroundColor White -BackgroundColor DarkBlue
    Write-Host ''
    Write-Host 'Είναι σαν κωδικός: μην το στείλεις σε κανέναν, ούτε στο Claude, ούτε σε φωτογραφία.' -ForegroundColor Yellow
    Write-Host 'Στο κινητό:'
    Write-Host '  1) Εγκατάστησε τη δωρεάν εφαρμογή ntfy (Android: Google Play, iPhone: App Store).'
    Write-Host '  2) Άνοιξέ τη και πάτα το + (κάτω δεξιά στο Android, πάνω δεξιά στο iPhone).'
    Write-Host '  3) Στο «Topic name» γράψε το όνομα ακριβώς όπως φαίνεται πάνω (μικρά γράμματα, με τις παύλες).'
    Write-Host '  4) Άφησε το «Use another server» κλειστό (ntfy.sh) και πάτα Subscribe.'
    Write-Host '  5) Αν ρωτήσει για ειδοποιήσεις, πάτα «Allow» (Επιτρέπεται).'
    Write-Host '================================================================' -ForegroundColor Yellow
}

Say ('GEAR WORLD - ΕΙΔΟΠΟΙΗΣΕΙΣ ΣΤΟ ΤΕΛΟΣ ΚΑΘΕ ΕΝΤΟΛΗΣ ({0})' -f (Get-Date -Format 'dd/MM/yyyy HH:mm')) 'Cyan'
Say 'Κάθε εντολή: 3 ήχοι, η φωνή "Gear World. Command finished." και ειδοποίηση των Windows «ΕΤΟΙΜΟ» ή «ΣΦΑΛΜΑ».'
Say 'Οι μεγάλες εντολές (εισαγωγές, ανανεώσεις τιμών, backups): και στο κινητό, μόνο «Τελείωσε / Σφάλμα» και ώρα.'
Say ''
if (-not (Test-Path -LiteralPath $src)) { Say ('Λείπει το {0}. Στείλε στο Claude αυτό το μήνυμα.' -f $src) 'Red'; Finish 2 }
$isWin = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
if (-not $isWin) { Say 'Αυτό το εργαλείο τρέχει μόνο στα Windows (DPAPI).' 'Red'; Finish 2 }

$have = Read-Topic
$srcHash = (Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash
$dstState = 'δεν υπάρχει ακόμα'
if (Test-Path -LiteralPath $dst) {
    if ((Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash -eq $srcHash) { $dstState = 'υπάρχει, ίδια έκδοση' } else { $dstState = 'υπάρχει, παλιότερη έκδοση' }
}
$topicState = 'δεν υπάρχει ακόμα'
if ($have -eq '?') { $topicState = 'υπάρχει αλλά δεν διαβάζεται (θα γίνει νέο, το παλιό κρατιέται ως .bak)' }
elseif ($have) { $topicState = 'υπάρχει (κρυπτογραφημένο, δεν γράφεται εδώ)' }
Say ('Πρόγραμμα ειδοποιήσεων: {0} ({1})' -f $dstState, $dst)
Say ('Όνομα για το κινητό (topic): {0}' -f $topicState)

if ($ShowTopic) {
    if ($Apply) { Say 'Το -ShowTopic είναι μόνο ανάγνωση: τρέξε το χωρίς -Apply.' 'Red'; Finish 2 }
    if (-not $have -or $have -eq '?') { Say 'Δεν υπάρχει αποθηκευμένο όνομα. Τρέξε πρώτα το στήσιμο με -Apply.' 'Yellow'; Finish 1 }
    Show-PhoneSteps $have
    $have = ''
    Say 'Το όνομα φάνηκε μόνο στην οθόνη (όχι σε αυτή την αναφορά).' 'Cyan'
    Finish 0
}

$makeTopic = (-not $have) -or ($have -eq '?') -or $NewTopic
Say ''
Say 'ΣΧΕΔΙΟ (με -Apply):' 'Cyan'
$step = 1
if (Test-Path -LiteralPath $dst) { Say ('  {0}) backup του παλιού: gw-notify.ps1.bak-{1}' -f $step, $stamp); $step++ }
Say ('  {0}) αντιγραφή του gw-notify.ps1 στο {1}' -f $step, $ToolsDir); $step++
if ($makeTopic) {
    if ($have) { Say ('  {0}) backup του παλιού ονόματος (ntfy-topic.dat.bak-{1}) και νέο τυχαίο όνομα· στο κινητό θα χρειαστεί νέο Subscribe' -f $step, $stamp) }
    else { Say ('  {0}) νέο τυχαίο όνομα για το κινητό, κρυπτογραφημένο μόνο για τον χρήστη σου στα Windows (DPAPI)' -f $step) }
} else { Say ('  {0}) το όνομα για το κινητό μένει ίδιο (το κινητό μένει γραμμένο)' -f $step) }
$step++
Say ('  {0}) το όνομα φαίνεται ΜΟΝΟ στην οθόνη με οδηγίες για το κινητό, Enter, και μία δοκιμαστική ειδοποίηση' -f $step)
Say 'Δεν αλλάζει τίποτα σε sites, βάσεις, email ή λογαριασμούς. Το ntfy είναι δωρεάν, χωρίς λογαριασμό.'

if (-not $Apply) {
    Say ''
    Say ('Μόνο ανάγνωση: δεν άλλαξε τίποτα. Για να γίνει, ξανατρέξε με -Apply και τη φράση: {0}' -f $Phrase) 'Yellow'
    Finish 0
}
if (-not (Confirm-Approval $Phrase)) { Say 'Δεν δόθηκε η σωστή φράση: δεν άλλαξε τίποτα.' 'Yellow'; Finish 1 }

Say ''
Say 'ΕΚΤΕΛΕΣΗ:' 'Cyan'
$rollback = New-Object System.Collections.Generic.List[string]
try {
    if (-not (Test-Path -LiteralPath $ToolsDir)) { New-Item -ItemType Directory -Path $ToolsDir -Force | Out-Null }
    if (Test-Path -LiteralPath $dst) {
        $bak = $dst + '.bak-' + $stamp
        Copy-Item -LiteralPath $dst -Destination $bak -Force
        Say ('  backup: {0}' -f $bak)
        $rollback.Add(('Copy-Item -LiteralPath ''{0}'' -Destination ''{1}'' -Force' -f $bak, $dst))
    } else {
        $rollback.Add(('Remove-Item -LiteralPath ''{0}''' -f $dst))
    }
    Copy-Item -LiteralPath $src -Destination $dst -Force
    $ok = (Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash -eq $srcHash
    if (-not $ok) { Say '  Η αντιγραφή του gw-notify.ps1 δεν βγήκε ίδια. Σταμάτησα.' 'Red'; $script:exitCode = 3 }
    else { Say ('  ΕΝΤΑΞΕΙ: gw-notify.ps1 στο {0}' -f $ToolsDir) }

    $topic = $have
    if ($script:exitCode -eq 0 -and $makeTopic) {
        if (-not (Test-Path -LiteralPath $SecretsDir)) { New-Item -ItemType Directory -Path $SecretsDir -Force | Out-Null }
        if (Test-Path -LiteralPath $topicFile) {
            $tbak = $topicFile + '.bak-' + $stamp
            Copy-Item -LiteralPath $topicFile -Destination $tbak -Force
            Say ('  backup του παλιού ονόματος: {0}' -f $tbak)
            $rollback.Add(('Copy-Item -LiteralPath ''{0}'' -Destination ''{1}'' -Force' -f $tbak, $topicFile))
        } else {
            $rollback.Add(('Remove-Item -LiteralPath ''{0}''' -f $topicFile))
        }
        $topic = New-Topic
        $sec = ConvertTo-SecureString $topic -AsPlainText -Force
        [System.IO.File]::WriteAllText($topicFile, (ConvertFrom-SecureString $sec), [System.Text.Encoding]::ASCII)
        if ((Read-Topic) -ne $topic) { Say '  Το νέο όνομα δεν διαβάζεται πίσω. Σταμάτησα.' 'Red'; $script:exitCode = 3 }
        else { Say ('  ΕΝΤΑΞΕΙ: νέο όνομα, κρυπτογραφημένο στο {0}' -f $topicFile) }
    } elseif ($script:exitCode -eq 0) {
        Say '  ΕΝΤΑΞΕΙ: το όνομα για το κινητό έμεινε ίδιο'
    }

    if ($script:exitCode -eq 0) {
        Show-PhoneSteps $topic
        $topic = ''
        if (-not $NoWait) {
            Write-Host ''
            Write-Host 'Όταν κάνεις Subscribe στο κινητό, πάτα Enter εδώ για τη δοκιμαστική ειδοποίηση.' -ForegroundColor Yellow
            try { $Host.UI.RawUI.FlushInputBuffer() } catch { }
            [void](Read-Host 'Enter')
        }
        if (-not $NoTest) {
            & (Join-Path $PSHOME 'powershell.exe') -NoProfile -ExecutionPolicy Bypass -File $dst -Name 'Δοκιμή' -Code 0 -Phone
            Say '  Δοκιμή: στάλθηκε στα Windows και στο κινητό («Τελείωσε» και ώρα).'
            Say '  Αν δεν ήρθε στο κινητό σε 1 λεπτό: έλεγξε ότι το όνομα γράφτηκε ακριβώς ίδιο και ότι η ntfy επιτρέπεται να στέλνει ειδοποιήσεις.'
        }
    }
} catch {
    Say ('  ΣΦΑΛΜΑ: {0}' -f $_.Exception.Message) 'Red'
    $script:exitCode = 3
}

Say ''
if ($script:exitCode -eq 0) { Say 'ΕΤΟΙΜΟ: οι ειδοποιήσεις στήθηκαν.' 'Cyan' } else { Say 'ΔΕΝ ΤΕΛΕΙΩΣΕ: στείλε στο Claude αυτή την αναφορά.' 'Magenta' }
Say 'Επαναφορά (αν τη θελήσεις), στο PowerShell:'
foreach ($r in $rollback) { Say ('  ' + $r) }
Say '  και στο κινητό: στην ntfy κράτα πατημένο το θέμα και Unsubscribe.'
Finish $script:exitCode
