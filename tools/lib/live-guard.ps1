<#
  Live-version guard (lessons L156; owner, 15 Nov 2026: "so that the map never goes again").
  Before a live update: read which code version each site has live (GET https://<domain>/api/version, written by the
  last deploy with --var GW_COMMIT:<commit>) and ask GitHub whether the new version contains it. A version that does not
  contain the live one undoes work that is live: on 14 and 15 Nov 2026 the Group map, the open-country rule and the
  Group wording went twice that way. Then nothing is deployed and the report says why.
  Dot-sourced by the site tools and tools/sites-update-all.ps1 (they already define Say and Finish).
  Windows PowerShell 5.1 syntax only. Read-only: two GET requests per site, nothing else.
  Test hooks (tests/run-tests.ps1 only, never in a command for the owner): GW_GUARD_TEST_COMMIT = the commit of the
  version being deployed, GW_GUARD_TEST_LIVE = "<domain>=<commit|none|error>;*=..." and GW_GUARD_TEST_COMPARE =
  "<status>" (ahead, identical, behind, diverged, error).
#>

$script:GwGuardOwner = 'evangelos-gif'
$script:GwGuardRepo = 'gear-world-code'
# Before the first deploy that writes its version, no site says which one it has. Then the new version must contain
# this one: the first with the Group map (L152), the open-country rule (L151), the Group wording (L155) and round 3
# all together (15 Nov 2026).
$script:GwGuardFloor = '2c5270454e9d3a5542bd71f90e276d77c25a857a'
$script:GwGuardUserAgent = 'GearWorldQA-bot/1.0 (+read-only check)'

# The commit of this code version: gw-run.ps1 unpacks it as gear-world-code-<40-character commit>.
function Get-GwCommit([string]$RepoPath) {
    if ($env:GW_GUARD_TEST_COMMIT) { return $env:GW_GUARD_TEST_COMMIT }
    $m = [regex]::Match((Split-Path -Leaf $RepoPath), '([0-9a-f]{40})$')
    if ($m.Success) { return $m.Groups[1].Value }
    return ''
}

# The extra wrangler deploy argument that writes this version into the Worker (read back at /api/version).
function Get-GwVersionVar([string]$RepoPath) {
    $c = Get-GwCommit $RepoPath
    if ($c) { return (' --var GW_COMMIT:{0}' -f $c) }
    return ''
}

function Get-GwTestValue([string]$Spec, [string]$Key) {
    $default = $null
    foreach ($part in ($Spec -split ';')) {
        $kv = $part -split '=', 2
        if ($kv.Count -ne 2) { continue }
        if ($kv[0].Trim() -eq $Key) { return $kv[1].Trim() }
        if ($kv[0].Trim() -eq '*') { $default = $kv[1].Trim() }
    }
    return $default
}

# Which commit is live on a domain: @{ ok; commit } ('' when the live code is older than this guard), or ok = $false.
function Get-GwLiveCommit([string]$Domain) {
    if ($env:GW_GUARD_TEST_LIVE) {
        $v = Get-GwTestValue $env:GW_GUARD_TEST_LIVE $Domain
        if ($v -eq 'error' -or -not $v) { return @{ ok = $false; commit = ''; error = 'test: no answer' } }
        if ($v -eq 'none') { return @{ ok = $true; commit = ''; error = '' } }
        return @{ ok = $true; commit = $v; error = '' }
    }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $url = 'https://{0}/api/version?guard={1}' -f $Domain, [DateTime]::UtcNow.Ticks
    for ($try = 1; $try -le 2; $try++) {
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri $url -UserAgent $script:GwGuardUserAgent -TimeoutSec 20
            # Code older than this guard has no /api/version: a 404, or (the Group) a redirect to a page. No JSON means
            # "does not say its version yet", and then the base version is checked instead.
            $type = [string]$r.Headers['Content-Type']
            if ($type -notmatch 'json') { return @{ ok = $true; commit = ''; error = '' } }
            $j = $null
            try { $j = $r.Content | ConvertFrom-Json } catch { $j = $null }
            $c = ''
            if ($j -and $j.commit) { $c = [string]$j.commit }
            if ($c -and $c -notmatch '^[0-9a-f]{40}$') { return @{ ok = $false; commit = ''; error = 'strange answer' } }
            return @{ ok = $true; commit = $c; error = '' }
        } catch {
            $status = 0
            if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
            # The live code is older than this guard: it has no /api/version yet.
            if ($status -eq 404) { return @{ ok = $true; commit = ''; error = '' } }
            if ($try -eq 2) { return @{ ok = $false; commit = ''; error = $_.Exception.Message } }
            Start-Sleep -Seconds 3
        }
    }
}

# Does $New contain $Base? GitHub compares the two: "ahead" or "identical" = yes; "behind" or "diverged" = no.
function Test-GwContains([string]$Base, [string]$New) {
    if ($Base -eq $New) { return @{ ok = $true; contains = $true; status = 'identical' } }
    $s = ''
    if ($env:GW_GUARD_TEST_COMPARE) {
        $s = $env:GW_GUARD_TEST_COMPARE
        if ($s -eq 'error') { return @{ ok = $false; contains = $false; status = 'test: no answer' } }
    } else {
        # Whether one commit contains another never changes, so a GitHub answer is kept on this PC: ALL UPDATES asks
        # GitHub once, not once per site (GitHub answers 60 questions an hour without a key).
        $cacheFile = Join-Path ([System.IO.Path]::GetTempPath()) 'gw-live-guard-answers.txt'
        $key = '{0}...{1}' -f $Base, $New
        if (Test-Path -LiteralPath $cacheFile) {
            foreach ($line in [System.IO.File]::ReadAllLines($cacheFile)) {
                if ($line.StartsWith($key + '=')) { $s = $line.Substring($key.Length + 1) }
            }
        }
        if (-not $s) {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $url = 'https://api.github.com/repos/{0}/{1}/compare/{2}?per_page=1' -f $script:GwGuardOwner, $script:GwGuardRepo, $key
            for ($try = 1; $try -le 2; $try++) {
                try {
                    $r = Invoke-WebRequest -UseBasicParsing -Uri $url -UserAgent $script:GwGuardUserAgent -Headers @{ Accept = 'application/vnd.github+json' } -TimeoutSec 30
                    $s = [string](($r.Content | ConvertFrom-Json).status)
                    break
                } catch {
                    if ($try -eq 2) { return @{ ok = $false; contains = $false; status = $_.Exception.Message } }
                    Start-Sleep -Seconds 3
                }
            }
            if ($s -eq 'ahead' -or $s -eq 'identical' -or $s -eq 'behind' -or $s -eq 'diverged') {
                try { [System.IO.File]::AppendAllText($cacheFile, ($key + '=' + $s + "`r`n")) } catch { }
            }
        }
    }
    if ($s -eq 'ahead' -or $s -eq 'identical') { return @{ ok = $true; contains = $true; status = $s } }
    if ($s -eq 'behind' -or $s -eq 'diverged') { return @{ ok = $true; contains = $false; status = $s } }
    return @{ ok = $false; contains = $false; status = ('unknown answer: ' + $s) }
}

function Get-GwShort([string]$Commit) {
    if ($Commit.Length -ge 7) { return $Commit.Substring(0, 7) }
    return $Commit
}

# Checks every domain. Returns @{ ok; lines }: the lines say, per site, what was checked, in Greek.
function Test-GwLiveGuard([string[]]$Domains, [string]$NewCommit) {
    $lines = New-Object System.Collections.Generic.List[string]
    if ($NewCommit -notmatch '^[0-9a-f]{40}$') {
        $lines.Add('  ΣΤΟΠ: δεν ξέρω ποια έκδοση κώδικα ανεβαίνει (ο φάκελος δεν έχει commit). Οι εντολές ανεβάσματος τρέχουν μόνο μέσω gw-run.ps1 με -Ref.')
        return @{ ok = $false; lines = $lines }
    }
    $ok = $true
    $answers = @{}
    foreach ($d in $Domains) {
        $live = Get-GwLiveCommit $d
        if (-not $live.ok) {
            $ok = $false
            $lines.Add(('  {0}: ΣΤΟΠ, δεν μπόρεσα να διαβάσω ποια έκδοση είναι live ({1}). Για ασφάλεια δεν ανεβαίνει τίποτα· ξαναδοκίμασε σε λίγα λεπτά.' -f $d, $live.error))
            continue
        }
        $base = $live.commit
        $what = 'η live έκδοση'
        if (-not $base) { $base = $script:GwGuardFloor; $what = 'η βασική έκδοση (το site δεν γράφει ακόμα την έκδοσή του)' }
        if (-not $answers.ContainsKey($base)) { $answers[$base] = Test-GwContains $base $NewCommit }
        $c = $answers[$base]
        if (-not $c.ok) {
            $ok = $false
            $lines.Add(('  {0}: ΣΤΟΠ, το GitHub δεν απάντησε αν η νέα έκδοση έχει μέσα την {1} ({2}). Ξαναδοκίμασε σε λίγα λεπτά.' -f $d, (Get-GwShort $base), $c.status))
        } elseif ($c.contains) {
            $lines.Add(('  {0}: ΕΝΤΑΞΕΙ, η νέα έκδοση {1} έχει μέσα {2} {3}.' -f $d, (Get-GwShort $NewCommit), $what, (Get-GwShort $base)))
        } else {
            $ok = $false
            $lines.Add(('  {0}: ΣΤΟΠ, η νέα έκδοση {1} ΔΕΝ έχει μέσα {2} {3} (GitHub: {4}). Θα έσβηνε δουλειά που είναι live, π.χ. τον χάρτη της Group.' -f $d, (Get-GwShort $NewCommit), $what, (Get-GwShort $base), $c.status))
        }
    }
    return @{ ok = $ok; lines = $lines }
}

# For the site tools: prints the check and stops the tool (exit 13) when a site would lose live work.
function Assert-GwLiveGuard([string[]]$Domains, [string]$RepoPath) {
    Say ''
    Say 'Έλεγχος έκδοσης (L156): έχει η νέα έκδοση μέσα αυτή που είναι live;'
    $g = Test-GwLiveGuard $Domains (Get-GwCommit $RepoPath)
    foreach ($line in $g.lines) { if ($line -match 'ΣΤΟΠ') { Say $line 'Magenta' } else { Say $line } }
    if (-not $g.ok) {
        Say ''
        Say 'ΣΤΑΜΑΤΗΣΑ ΧΩΡΙΣ ΑΛΛΑΓΕΣ. Αυτή η έκδοση είναι παλιότερη από ό,τι είναι live ή δεν ελέγχθηκε. Στείλε αυτή την αναφορά στο Claude «1 · Gear World Manager»: χρειάζεται μια έκδοση που έχει μέσα και τη live.' 'Magenta'
        Finish 13
    }
}
