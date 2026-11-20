<#
  bol.com import gate (lessons L204, L205; Manager, 20 Nov 2026). A bol.com price may be shown only while the daily
  refresh (the private Worker gear-world-bol-refresh) checks it: a bol.com row loaded while the refresh's kill switch
  is off, or before the refresh is set up, would stay on the site up to 24 hours unchecked. So every import step that
  would load bol.com rows reads the switch FIRST (one read-only SELECT on gear-world-awin) and loads nothing unless it
  is on. The dry runs (no -Apply) never need it.
  Dot-sourced by tools/legacy-import.ps1 and the import step of the newer sites' tools (<site>-cloudflare.ps1): they
  already define Say and Invoke-Wrangler. Windows PowerShell 5.1 syntax only. Read-only.
#>

$script:BolGateDb = 'gear-world-awin'
$script:BolGateSql = "SELECT value FROM bol_refresh_meta WHERE key = 'enabled'"
# The file the planner of the newer sites (tools/tgw-import-plan.mjs) writes in its plan folder when the plan reads bol.com.
$script:BolGatePlanFile = 'bol.txt'

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

# Reads the switch with the caller's Invoke-Wrangler (in $Folder), says what it found, and returns $true only when it is
# on. -NonInteractive: the newer sites' Invoke-Wrangler has that switch too.
function Test-BolImportGate([string]$Folder, [switch]$NonInteractive) {
    $a = 'd1 execute {0} --remote --json --command "{1}"' -f $script:BolGateDb, $script:BolGateSql
    if ($NonInteractive) { $r = Invoke-Wrangler $Folder $a -NonInteractive -Retry } else { $r = Invoke-Wrangler $Folder $a -Retry }
    $state = Get-BolSwitchState ([int]$r.code) ([string]$r.text)
    $color = 'Red'
    if ($state -eq 'on') { $color = 'Green' }
    foreach ($line in (Get-BolGateLines $state)) { Say $line $color }
    return ($state -eq 'on')
}
