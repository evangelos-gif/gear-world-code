<#
.SYNOPSIS
  Gear World: says that a command has finished (owner, 27 Nov 2026, for all chats; lessons L240).

.DESCRIPTION
  Runs at the very end of every PowerShell command, after «Αντιγράφηκε στο πρόχειρο...»:
    - 3 beeps,
    - a voice says "Gear World. Command finished.",
    - a Windows notification «Gear World – <name>: ΕΤΟΙΜΟ», or «Gear World – <name>: ΣΦΑΛΜΑ» when -Code is not 0
      (or with -Failed).
  -Phone (only for the long «ΜΟΝΗ ΤΗΣ» commands: imports, price refreshes, backups): also a notification on the phone
  through the free ntfy app. Its text is only «Τελείωσε HH:mm» or «Σφάλμα HH:mm», with the title «Gear World»:
  never the command, a number, a key or any data.
  The ntfy topic (the private name the phone listens to) is made by tools/gw-notify-setup.ps1 and kept encrypted for
  this Windows user (DPAPI) in <home>\gear-world-secrets\ntfy-topic.dat. It is never written to the screen, a report,
  the clipboard or the repo. Without that file -Phone only says that the phone is not set up yet.
  This script never stops or changes the command that called it: every part is in try/catch, it writes no file and
  it has no exit, so it always ends with 0.
  gw-notify-setup.ps1 copies it to <home>\gear-world-tools\gw-notify.ps1, so every paste can end with:
    $nf = Join-Path $HOME 'gear-world-tools\gw-notify.ps1'; if (Test-Path $nf) { powershell -NoProfile -ExecutionPolicy Bypass -File $nf -Name '<name>' -Code $c }
  (and -Phone for imports, price refreshes and backups).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File gw-notify.ps1 -Name 'Mega Stores τιμές' -Code 0 -Phone
#>
param(
    [string]$Name = 'Εντολή',
    [int]$Code = 0,
    [switch]$Failed,
    [switch]$Phone,
    [switch]$Quiet,
    [switch]$NoPopup,
    [string]$TopicFile = '',
    [string]$Server = 'https://ntfy.sh',
    [string]$DryRunFile = ''
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$bad = $Failed -or ($Code -ne 0)
$when = Get-Date -Format 'HH:mm'
$label = 'ΕΤΟΙΜΟ'
if ($bad) { $label = 'ΣΦΑΛΜΑ' }
$short = ([string]$Name -replace '[\r\n\t]+', ' ').Trim()
if (-not $short) { $short = 'Εντολή' }
if ($short.Length -gt 36) { $short = $short.Substring(0, 36).Trim() + '...' }
$dash = [string][char]0x2013
$title = 'Gear World ' + $dash + ' ' + $short + ': ' + $label
if (-not $TopicFile) { $TopicFile = Join-Path (Join-Path $HOME 'gear-world-secrets') 'ntfy-topic.dat' }
# Tests only (-DryRunFile): the notification title and, with -Phone, what would go to ntfy. Nothing is sent.
$dry = New-Object System.Collections.Generic.List[string]
$dry.Add($title)

# 1. The Windows notification first: it stays on screen while the sound plays.
$icon = $null
$started = Get-Date
if (-not $NoPopup) {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $icon = New-Object System.Windows.Forms.NotifyIcon
        if ($bad) {
            $icon.Icon = [System.Drawing.SystemIcons]::Warning
            $icon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Warning
            $icon.BalloonTipText = 'Σφάλμα στις ' + $when + '. Δες το παράθυρο του PowerShell.'
        } else {
            $icon.Icon = [System.Drawing.SystemIcons]::Information
            $icon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
            $icon.BalloonTipText = 'Τελείωσε στις ' + $when + '.'
        }
        $icon.BalloonTipTitle = $title
        $icon.Text = 'Gear World'
        $icon.Visible = $true
        $icon.ShowBalloonTip(10000)
    } catch {
        Write-Host 'Η ειδοποίηση των Windows δεν βγήκε (η εντολή τελείωσε κανονικά).' -ForegroundColor DarkGray
        $icon = $null
    }
}

# 2. Three beeps, then the voice.
if (-not $Quiet) {
    try {
        for ($i = 0; $i -lt 3; $i++) { [console]::Beep(988, 250); Start-Sleep -Milliseconds 120 }
    } catch {
        try { [System.Media.SystemSounds]::Asterisk.Play() } catch { }
    }
    try {
        Add-Type -AssemblyName System.Speech
        $voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $voice.Volume = 100
        $voice.Speak('Gear World. Command finished.')
        $voice.Dispose()
    } catch { }
}

# 3. The phone (ntfy): only «Τελείωσε HH:mm» or «Σφάλμα HH:mm».
if ($Phone) {
    $topic = ''
    if (Test-Path -LiteralPath $TopicFile) {
        try {
            $sec = ConvertTo-SecureString ([System.IO.File]::ReadAllText($TopicFile).Trim())
            $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
            try { $topic = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        } catch { $topic = '' }
    }
    if ($topic -notmatch '^gw(-[a-z0-9]{4}){5}$') {
        Write-Host 'Ειδοποίηση στο κινητό: δεν έχει στηθεί σε αυτόν τον υπολογιστή (gw-notify-setup).' -ForegroundColor DarkGray
    } else {
        $msg = 'Τελείωσε ' + $when
        $tag = 'large_blue_circle'
        if ($bad) { $msg = 'Σφάλμα ' + $when; $tag = 'large_orange_diamond' }
        $json = (@{ topic = $topic; title = 'Gear World'; message = $msg; tags = @($tag) } | ConvertTo-Json -Compress)
        $topic = ''
        if ($DryRunFile) {
            $dry.Add($Server)
            $dry.Add($json)
            Write-Host 'Ειδοποίηση στο κινητό: δοκιμή χωρίς αποστολή.' -ForegroundColor DarkGray
        } else {
            try {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                $body = [System.Text.Encoding]::UTF8.GetBytes($json)
                Invoke-RestMethod -Method Post -Uri ($Server.TrimEnd('/') + '/') -Body $body -ContentType 'application/json; charset=utf-8' -TimeoutSec 15 -UseBasicParsing | Out-Null
                Write-Host 'Ειδοποίηση στο κινητό: στάλθηκε.' -ForegroundColor Cyan
            } catch {
                Write-Host 'Ειδοποίηση στο κινητό: δεν στάλθηκε (ίντερνετ ή ntfy). Η εντολή τελείωσε κανονικά.' -ForegroundColor DarkGray
            }
        }
        $json = ''
    }
}

# 4. Keep the Windows notification about 6 seconds, then tidy the tray icon away.
if ($icon) {
    try {
        $left = 6000 - [int]((Get-Date) - $started).TotalMilliseconds
        if ($left -gt 0) { Start-Sleep -Milliseconds $left }
        $icon.Visible = $false
        $icon.Dispose()
    } catch { }
}
if ($DryRunFile) { try { [System.IO.File]::WriteAllText($DryRunFile, ($dry -join "`n"), (New-Object System.Text.UTF8Encoding($false))) } catch { } }
Write-Host ($title + ' (' + $when + ')') -ForegroundColor Cyan
