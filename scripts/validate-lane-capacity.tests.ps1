param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$WarningPreference = 'Stop'

$validator = Join-Path $PSScriptRoot 'validate-lane-capacity.ps1'
$fixturesRoot = Join-Path $RepoRoot 'docs\control-plane\fixtures'
$defaultCatalog = Join-Path $RepoRoot 'docs\control-plane\mutex-catalog.json'

if (-not (Test-Path -LiteralPath $validator)) {
    Write-Output 'FAIL validator-missing'
    exit 1
}
if (-not (Test-Path -LiteralPath $fixturesRoot)) {
    Write-Output 'FAIL fixtures-root-missing'
    exit 1
}

$grandfatherBacklog = Join-Path $fixturesRoot '_grandfather-only-backlog.md'
if (-not (Test-Path -LiteralPath $grandfatherBacklog)) {
    Write-Output 'FAIL grandfather-backlog-missing'
    exit 1
}

$dirs = @(Get-ChildItem -LiteralPath $fixturesRoot -Directory | Where-Object { $_.Name -match '^[0-9]{2}-' } | Sort-Object -Property Name)
if ($dirs.Count -eq 0) {
    Write-Output 'FAIL no-fixtures'
    exit 1
}

$pass = 0
$fail = 0
$failures = New-Object System.Collections.ArrayList

function ConvertTo-Hashtable {
    param($InputObject)
    if ($null -eq $InputObject) { return $null }
    if ($InputObject -is [System.Collections.IDictionary]) {
        $h = @{}
        foreach ($k in $InputObject.Keys) {
            $h[[string]$k] = ConvertTo-Hashtable $InputObject[$k]
        }
        return $h
    }
    if ($InputObject -is [System.Collections.IEnumerable] -and $InputObject -isnot [string]) {
        $list = New-Object System.Collections.ArrayList
        foreach ($el in $InputObject) {
            [void]$list.Add((ConvertTo-Hashtable $el))
        }
        return $list
    }
    if ($InputObject -is [System.Management.Automation.PSCustomObject]) {
        $h = @{}
        foreach ($p in $InputObject.PSObject.Properties) {
            $h[$p.Name] = ConvertTo-Hashtable $p.Value
        }
        return $h
    }
    return $InputObject
}

function Get-ExpectedObject {
    param([string]$Path)
    $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) {
        $raw = $raw.Substring(1)
    }
    return ConvertTo-Hashtable (ConvertFrom-Json -InputObject $raw)
}

function Get-ProofObject {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
    try {
        return ConvertTo-Hashtable (ConvertFrom-Json -InputObject $Text)
    } catch {
        return $null
    }
}

foreach ($dir in $dirs) {
    $slug = $dir.Name
    $expectedPath = Join-Path $dir.FullName 'expected.json'
    $tasksPath = Join-Path $dir.FullName 'TASKS.md'
    $statePath = Join-Path $dir.FullName 'lane-saturation-state.json'
    $catalogPath = Join-Path $dir.FullName 'mutex-catalog.json'
    $fixtureProof = Join-Path $dir.FullName 'SATURATION_PROOF.json'

    $ok = $true
    $detail = ''

    if (-not (Test-Path -LiteralPath $expectedPath)) {
        $ok = $false
        $detail = 'missing expected.json'
    } elseif (-not (Test-Path -LiteralPath $tasksPath)) {
        $ok = $false
        $detail = 'missing TASKS.md'
    } elseif (-not (Test-Path -LiteralPath $statePath)) {
        $ok = $false
        $detail = 'missing lane-saturation-state.json'
    }

    if ($ok) {
        if (-not (Test-Path -LiteralPath $catalogPath)) {
            $catalogPath = $defaultCatalog
        }
        $tempProof = Join-Path $env:TEMP ('aisb-sat-proof-' + $slug + '-' + [guid]::NewGuid().ToString('N') + '.json')
        if (Test-Path -LiteralPath $fixtureProof) {
            Copy-Item -LiteralPath $fixtureProof -Destination $tempProof -Force
        }

        $backlogPath = Join-Path $dir.FullName 'TASKS_BACKLOG_FULL.md'
        if (-not (Test-Path -LiteralPath $backlogPath)) {
            $backlogPath = Join-Path $fixturesRoot '_grandfather-only-backlog.md'
        }

        $expected = Get-ExpectedObject $expectedPath
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $validator -RepoRoot $RepoRoot -TasksPath $tasksPath -StatePath $statePath -CatalogPath $catalogPath -ProofPath $tempProof -BacklogPath $backlogPath 2>&1 | Out-String
        $code = $LASTEXITCODE
        $ErrorActionPreference = $prevEap
        if ($null -eq $code) { $code = 0 }

        if (Test-Path -LiteralPath $tempProof) {
            Remove-Item -LiteralPath $tempProof -Force -ErrorAction SilentlyContinue
        }

        $expCode = [int]$expected['exitCode']
        if ($code -ne $expCode) {
            $ok = $false
            $detail = "expected=$expCode actual=$code"
        } else {
            $proof = Get-ProofObject $output
            if ($null -eq $proof) {
                $ok = $false
                $detail = 'stdout-not-json'
            } else {
                $expResult = [string]$expected['result']
                $actResult = [string]$proof['result']
                if ($expResult -ne $actResult) {
                    $ok = $false
                    $detail = "result expected=$expResult actual=$actResult"
                }
                if ($ok -and $expected.ContainsKey('idleCode')) {
                    $expIdle = [string]$expected['idleCode']
                    $actIdle = [string]$proof['idleCode']
                    if ($expIdle -ne $actIdle) {
                        $ok = $false
                        $detail = "idleCode expected=$expIdle actual=$actIdle"
                    }
                }
                if ($ok -and $expected.ContainsKey('errorCode')) {
                    $expErr = [string]$expected['errorCode']
                    $actErr = [string]$proof['errorCode']
                    if ($expErr -ne $actErr) {
                        $ok = $false
                        $detail = "errorCode expected=$expErr actual=$actErr"
                    }
                }
                if ($ok -and $expected.ContainsKey('admissibleForcingCandidates')) {
                    $expS = New-Object System.Collections.Generic.List[string]
                    $rawExp = $expected['admissibleForcingCandidates']
                    if ($null -ne $rawExp) {
                        foreach ($x in @($rawExp)) {
                            if ($null -ne $x -and [string]$x -ne '') { $expS.Add([string]$x) }
                        }
                    }
                    $actS = New-Object System.Collections.Generic.List[string]
                    if ($proof.ContainsKey('admissibleForcingCandidates') -and $null -ne $proof['admissibleForcingCandidates']) {
                        foreach ($x in @($proof['admissibleForcingCandidates'])) {
                            if ($null -ne $x -and [string]$x -ne '') { $actS.Add([string]$x) }
                        }
                    }
                    $expSorted = @($expS | Sort-Object)
                    $actSorted = @($actS | Sort-Object)
                    if (($expSorted -join '|') -ne ($actSorted -join '|')) {
                        $ok = $false
                        $detail = "S expected=[$($expSorted -join ',')] actual=[$($actSorted -join ',')]"
                    }
                }
                if ($ok -and $expected.ContainsKey('rejectedByTaskId')) {
                    $map = $expected['rejectedByTaskId']
                    $actualMap = @{}
                    if ($proof.ContainsKey('rejectedCandidates') -and $null -ne $proof['rejectedCandidates']) {
                        foreach ($rc in @($proof['rejectedCandidates'])) {
                            if ($rc -is [System.Collections.IDictionary] -or $rc -is [hashtable]) {
                                $actualMap[[string]$rc['taskId']] = [string]$rc['code']
                            } else {
                                $actualMap[[string]$rc.taskId] = [string]$rc.code
                            }
                        }
                    }
                    foreach ($k in $map.Keys) {
                        $want = [string]$map[$k]
                        if (-not $actualMap.ContainsKey([string]$k)) {
                            $ok = $false
                            $detail = "rejected missing $($k)"
                            break
                        }
                        if ($actualMap[[string]$k] -ne $want) {
                            $ok = $false
                            $detail = "rejected $k expected=$want actual=$($actualMap[[string]$k])"
                            break
                        }
                    }
                }
            }
        }
    }

    if ($ok) {
        $pass++
        Write-Output "PASS $slug"
    } else {
        $fail++
        [void]$failures.Add("FAIL $slug $detail")
        Write-Output "FAIL $slug $detail"
    }
}

Write-Output ("FIXTURES_TOTAL=" + $dirs.Count)
Write-Output ("FIXTURES_PASS=" + $pass)
Write-Output ("FIXTURES_FAIL=" + $fail)
if ($fail -gt 0) {
    exit 1
}
exit 0
