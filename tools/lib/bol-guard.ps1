<#
  bol.com import gate (lessons L204, L205; Manager, 20 Nov 2026). A bol.com price may be shown only while the daily
  refresh (the private Worker gear-world-bol-refresh) checks it: a bol.com row loaded while the refresh's kill switch
  is off, or before the refresh is set up, would stay on the site up to 24 hours unchecked. So every import step that
  would load bol.com rows reads the switch FIRST (one read-only SELECT on gear-world-awin) and loads nothing unless it
  is on. The dry runs (no -Apply) never need it.
  Review of 6954a135: the gate also needs a SUCCESSFUL refresh run in the last 2 hours (bol_refresh_runs ok = 1: the
  Worker really runs, not only its switch), and checks the 12-hour freshness of the bol.com files again when it loads
  (the plan may have been made earlier). It reminds that Price Watch must run the version that leaves bol.com out (its
  Worker has no address and keeps no version, so this cannot be read cheaply).
  Test hook (tests/run-tests.ps1 only, never in a command for the owner): GW_BOL_GATE_TEST_NOW = the time used as "now".
  Dot-sourced by tools/legacy-import.ps1 and the import step of the newer sites' tools (<site>-cloudflare.ps1): they
  already define Say and Invoke-Wrangler. Windows PowerShell 5.1 syntax only. Read-only.
#>

$script:BolGateDb = 'gear-world-awin'
$script:BolGateSql = "SELECT value FROM bol_refresh_meta WHERE key = 'enabled'"
# The file the planner of the newer sites (tools/tgw-import-plan.mjs) writes in its plan folder when the plan reads bol.com.
$script:BolGatePlanFile = 'bol.txt'
$script:BolGateMaxAgeHours = 12
$script:BolGateRunHours = 2

function Get-BolGateNow {
    $t = [string]$env:GW_BOL_GATE_TEST_NOW
    if ($t) { try { return [DateTime]::Parse($t, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal -bor [Globalization.DateTimeStyles]::AssumeUniversal) } catch { } }
    return [DateTime]::UtcNow
}

# The oldest bol.com download time of a newer site's plan (bol.txt), 'yyyy-MM-dd HH:mm:ss' UTC, or ''.
function Get-BolPlanStamp([string]$PlanDir) {
    $f = Join-Path $PlanDir $script:BolGatePlanFile
    if (-not (Test-Path -LiteralPath $f)) { return '' }
    $m = [regex]::Match([System.IO.File]::ReadAllText($f), 'bol\.com oldest download \(UTC\): (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})')
    if ($m.Success) { return $m.Groups[1].Value }
    return ''
}

# How many bol.com products a newer site's plan has (bol.txt), or -1 when it does not say.
function Get-BolPlanCount([string]$PlanDir) {
    $f = Join-Path $PlanDir $script:BolGatePlanFile
    if (-not (Test-Path -LiteralPath $f)) { return 0 }
    $m = [regex]::Match([System.IO.File]::ReadAllText($f), 'bol\.com products: (\d+)')
    if ($m.Success) { return [int]$m.Groups[1].Value }
    return -1
}

# How many hours ago a 'yyyy-MM-dd HH:mm:ss' UTC time was (-1 when it cannot be read).
function Get-BolStampAge([string]$Stamp) {
    try {
        $t = [DateTime]::ParseExact($Stamp, 'yyyy-MM-dd HH:mm:ss', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal -bor [Globalization.DateTimeStyles]::AssumeUniversal)
        return ((Get-BolGateNow) - $t).TotalHours
    } catch { return -1 }
}

# The successful refresh runs of the last 2 hours from wrangler's answer: 'ok' (one or more), 'none' (no run, or no
# table) or 'unknown' (could not read it).
function Get-BolRunState([int]$Code, [string]$Text) {
    $t = [string]$Text
    if ($t -match '(?i)no such table') { return 'none' }
    if ($Code -ne 0) { return 'unknown' }
    $m = [regex]::Match($t, '"n"\s*:\s*"?(\d+)')
    if (-not $m.Success) { return 'unknown' }
    if ([int]$m.Groups[1].Value -gt 0) { return 'ok' }
    return 'none'
}

# The switch from wrangler's answer: 'on' ('1'), 'off' (any other value), 'none' (no table or no row: the refresh was
# never set up) or 'unknown' (could not read it).
function Get-BolSwitchState([int]$Code, [string]$Text) {
    $t = [string]$Text
    if ($t -match '(?i)no such table') { return 'none' }
    if ($Code -ne 0) { return 'unknown' }
    $m = [regex]::Match($t, '"value"\s*:\s*("([^"]*)"|[^,}\s]+)')
    if ($m.Success) {
        $v = $m.Groups[1].Value.Trim('"').Trim()
        if ($v -eq '1') { return 'on' }
        return 'off'
    }
    if ($t -match '"results"\s*:\s*\[\s*\]') { return 'none' }
    return 'unknown'
}

# What the owner reads, in Greek, for each state (the word next to the colour, never the colour alone).
function Get-BolGateLines([string]$State) {
    switch ($State) {
        'on' { return @('bol.com: ο διακόπτης της καθημερινής ανανέωσης (gear-world-awin) είναι ΑΝΟΙΧΤΟΣ: ΕΝΤΑΞΕΙ. Τα νέα προϊόντα bol.com ελέγχονται στην επόμενη ωριαία ανανέωση.') }
        'off' {
            return @(
                'ΠΡΟΒΛΗΜΑ: ο διακόπτης της καθημερινής ανανέωσης του bol.com (gear-world-awin) είναι ΚΛΕΙΣΤΟΣ. Νέα προϊόντα bol.com θα έμεναν έως 24 ώρες χωρίς έλεγχο τιμής, γι'' αυτό ΔΕΝ φορτώθηκε τίποτα.',
                'Πρώτα δες γιατί έκλεισε (tools/bol-refresh-setup.ps1 -Step check) και άνοιξέ τον (-Step enable, φράση ΕΓΚΡΙΝΩ BOL ΑΝΑΝΕΩΣΗ ΕΝΑΡΞΗ), μετά ξανά η εισαγωγή.',
                'Αν τον έκλεισε το εργαλείο αφαίρεσης (tools/bol-remove.ps1, τέλος της συνεργασίας με το bol.com), ΜΗΝ τον ανοίξεις και μη φορτώσεις bol.com.'
            )
        }
        'none' {
            return @(
                'ΠΡΟΒΛΗΜΑ: η καθημερινή ανανέωση του bol.com δεν έχει στηθεί ακόμα (δεν υπάρχει ο διακόπτης της στη gear-world-awin), γι'' αυτό ΔΕΝ φορτώθηκε τίποτα.',
                'Πρώτα το βήμα της ανανέωσης (tools/bol-refresh-setup.ps1 -Step apply, φράση ΕΓΚΡΙΝΩ BOL ΑΝΑΝΕΩΣΗ), μετά η εισαγωγή.'
            )
        }
        default {
            return @(
                'ΠΡΟΒΛΗΜΑ: δεν μπόρεσα να διαβάσω τον διακόπτη της καθημερινής ανανέωσης του bol.com (gear-world-awin), γι'' αυτό ΔΕΝ φορτώθηκε τίποτα.',
                'Δοκίμασε ξανά σε λίγο. Αν μείνει, στείλε την αναφορά στο Claude.'
            )
        }
    }
}

# Reads the switch and the last runs with the caller's Invoke-Wrangler (in $Folder), says what it found, and returns
# $true only when the switch is on, the Worker ran well in the last 2 hours and the bol.com files are still fresh.
# -OldestDownload: the oldest download time of the plan's bol.com rows. -BolRows: how many bol.com products the plan has
# (-1 = not known: counted as some). A plan WITH bol.com products and no download time (an older plan or bol.txt) is
# refused, never loaded unchecked (re-review of 51a8b88). -NonInteractive: the newer sites' Invoke-Wrangler has it too.
function Test-BolImportGate([string]$Folder, [switch]$NonInteractive, [string]$OldestDownload = '', [int]$BolRows = -1) {
    $a = 'd1 execute {0} --remote --json --command "{1}"' -f $script:BolGateDb, $script:BolGateSql
    if ($NonInteractive) { $r = Invoke-Wrangler $Folder $a -NonInteractive -Retry } else { $r = Invoke-Wrangler $Folder $a -Retry }
    $state = Get-BolSwitchState ([int]$r.code) ([string]$r.text)
    $color = 'Red'
    if ($state -eq 'on') { $color = 'Green' }
    foreach ($line in (Get-BolGateLines $state)) { Say $line $color }
    if ($state -ne 'on') { return $false }
    # The Worker really runs: one successful run (ok = 1) in the last 2 hours. (No > < % in a wrangler call: BETWEEN.)
    $cut = (Get-BolGateNow).AddHours(-$script:BolGateRunHours).ToString("yyyy-MM-dd'T'HH:mm:ss", [Globalization.CultureInfo]::InvariantCulture)
    $q = "SELECT COUNT(*) AS n FROM bol_refresh_runs WHERE ok = 1 AND ran_at BETWEEN '{0}' AND '9999'" -f $cut
    $a2 = 'd1 execute {0} --remote --json --command "{1}"' -f $script:BolGateDb, $q
    if ($NonInteractive) { $r2 = Invoke-Wrangler $Folder $a2 -NonInteractive -Retry } else { $r2 = Invoke-Wrangler $Folder $a2 -Retry }
    $runs = Get-BolRunState ([int]$r2.code) ([string]$r2.text)
    if ($runs -eq 'unknown') {
        Say 'ΠΡΟΒΛΗΜΑ: δεν μπόρεσα να διαβάσω τις τελευταίες εκτελέσεις της ανανέωσης του bol.com (gear-world-awin), γι'' αυτό ΔΕΝ φορτώθηκε τίποτα. Δοκίμασε ξανά σε λίγο.' 'Red'
        return $false
    }
    if ($runs -ne 'ok') {
        Say ('ΠΡΟΒΛΗΜΑ: ο Worker της ανανέωσης του bol.com (gear-world-bol-refresh) δεν έχει τρέξει ακόμα με επιτυχία τις τελευταίες {0} ώρες, γι'' αυτό ΔΕΝ φορτώθηκε τίποτα.' -f $script:BolGateRunHours) 'Red'
        Say 'Περίμενε την ωριαία εκτέλεσή του (στο :13 κάθε ώρας) και δες τι λέει το tools/bol-refresh-setup.ps1 -Step check, μετά ξανά η εισαγωγή.' 'Red'
        return $false
    }
    Say ('bol.com: ο Worker της ανανέωσης έτρεξε με επιτυχία τις τελευταίες {0} ώρες: ΕΝΤΑΞΕΙ.' -f $script:BolGateRunHours) 'Green'
    # The files again, now: the plan may have been made earlier (bol.com's terms: never a price older than a day).
    if (-not $OldestDownload -and $BolRows -ne 0) {
        Say 'ΠΡΟΒΛΗΜΑ: το σχέδιο έχει προϊόντα bol.com αλλά δεν λέει πότε κατέβηκαν τα αρχεία τους, γι'' αυτό ΔΕΝ φορτώθηκε τίποτα.' 'Red'
        Say 'Τρέξε ξανά τη λήψη (tools/bol-feed-download.ps1 -Step download), μετά ξανά το σχέδιο και την εισαγωγή.' 'Red'
        return $false
    }
    if ($OldestDownload) {
        $age = Get-BolStampAge $OldestDownload
        if ($age -lt 0 -or $age -gt $script:BolGateMaxAgeHours) {
            Say ('ΠΡΟΒΛΗΜΑ: τα αρχεία του bol.com είναι από {0} UTC, παλιότερα από {1} ώρες τώρα που φορτώνονται: τρέξε πρώτα ξανά τη λήψη (tools/bol-feed-download.ps1 -Step download) και μετά την εισαγωγή. Δεν φορτώθηκε τίποτα.' -f $OldestDownload, $script:BolGateMaxAgeHours) 'Red'
            return $false
        }
        Say ('bol.com: τα αρχεία είναι από {0} UTC, νεότερα από {1} ώρες: ΕΝΤΑΞΕΙ.' -f $OldestDownload, $script:BolGateMaxAgeHours) 'Green'
    }
    Say 'ΥΠΕΝΘΥΜΙΣΗ: το Price Watch (gear-world-prices) πρέπει να τρέχει ήδη την έκδοση που αφήνει έξω το bol.com (tools/prices-setup.ps1). Αν δεν την έχεις ανεβάσει, σταμάτα εδώ: μη δώσεις τη φράση έγκρισης.' 'Yellow'
    return $true
}
