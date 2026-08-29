param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$TasksPath = (Join-Path $RepoRoot 'TASKS.md'),
    [string]$StatePath = (Join-Path $RepoRoot 'docs\control-plane\lane-saturation-state.json'),
    [string]$CatalogPath = (Join-Path $RepoRoot 'docs\control-plane\mutex-catalog.json'),
    [string]$ProofPath = (Join-Path $RepoRoot 'docs\control-plane\SATURATION_PROOF.json')
)

$ErrorActionPreference = 'Stop'
$WarningPreference = 'Stop'

# ArrayList/object[] empty values unroll to $null in Hashtable assignment.
# JsonArr is a single reference type so empty JSON arrays stay arrays.
class JsonArr {
    [System.Collections.ArrayList]$Items
    JsonArr() {
        $this.Items = New-Object System.Collections.ArrayList
    }
}

# ---------------------------------------------------------------------------
# GOV-OS-03 fail-closed lane-saturation proof checker (PowerShell 5.x)
# Not a scheduler. Does not admit, rank, select, or invent work.
# ---------------------------------------------------------------------------

$script:NeverCandidateIds = @('PRIVATE-BETA-INVITE-01')
$script:RepoRootAbs = 'C:\Users\knlee\aiSandBox2026B'
$script:I18nFiles = @(
    'frontend/messages/en.json',
    'frontend/messages/zh-TW.json',
    'frontend/messages/zh-CN.json'
)
$script:I18nKeys = @(
    'frontend/messages/en.json',
    'frontend/messages/zh-tw.json',
    'frontend/messages/zh-cn.json'
)
$script:ClosedMutexIds = @(
    'GOVERNANCE', 'GATEWAY', 'AI-SERVICE', 'CONTAINER-MANAGER', 'FRONTEND',
    'I18N', 'MIGRATION', 'PACKAGE', 'COMPOSE', 'ENV', 'LOCAL-RUNTIME',
    'STAGING', 'PROVIDER-LIVE', 'CREDIT', 'HOTFILE'
)
$script:OccupancyBlockKeys = @(
    'schemaVersion', 'maxImplementationLanes', 'lane3',
    'lane1.state', 'lane1.taskId', 'lane2.state', 'lane2.taskId',
    'governance.owner', 'governance.state',
    'saturationSuspended', 'suspensionReason', 'occupancyHash'
)
$script:SidecarRootKeys = @(
    'schemaVersion', 'maxImplementationLanes', 'lane3', 'saturationSuspended',
    'suspensionReason', 'governance', 'occupancy', 'candidates',
    'lockedTaskIds', 'sharedContracts', 'runtimeAuthorization'
)
$script:LaneKeys = @(
    'state', 'taskId', 'mutexes', 'writePaths', 'hotfiles', 'i18n',
    'evidenceClass', 'exclusiveCapacity', 'sharedContractIds',
    'mutatesSharedContractIds', 'runtimeNeeds'
)
$script:CandidateKeys = @(
    'taskId', 'nature', 'lifecycle', 'status', 'startCondition',
    'saturationClass', 'productClass', 'futureAuthorization', 'dependsOn',
    'mutexes', 'writePaths', 'hotfiles', 'i18n', 'sharedContractIds',
    'mutatesSharedContractIds', 'evidenceClass', 'exclusiveCapacity',
    'runtimeNeeds', 'admissionUncertain', 'writeSetPrecision'
)
$script:CatalogMutexKeys = @(
    'id', 'aliases', 'kind', 'exclusive', 'pathPrefixes', 'files',
    'matchKind', 'matchNames'
)
$script:ResourceIds = @('LOCAL-RUNTIME', 'STAGING', 'PROVIDER-LIVE', 'CREDIT')
$script:CapacityFail = $false
$script:Catalog = $null
$script:IdToSpec = $null
$script:AliasToId = $null

function New-OrdinalMap {
    return New-Object 'System.Collections.Hashtable' ([System.StringComparer]::Ordinal)
}

function New-StringSet {
    return New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
}

function Get-Sha256Hex {
    param([string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
        $hash = $sha.ComputeHash($bytes)
        $sb = New-Object System.Text.StringBuilder
        foreach ($b in $hash) {
            [void]$sb.Append($b.ToString('x2'))
        }
        return $sb.ToString()
    } finally {
        $sha.Dispose()
    }
}

function Escape-JsonString {
    param([string]$s)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $s.ToCharArray()) {
        $code = [int]$ch
        if ($ch -eq '"') {
            [void]$sb.Append('\"')
        } elseif ($ch -eq '\') {
            [void]$sb.Append('\\')
        } elseif ($code -le 0x1F) {
            [void]$sb.Append('\u')
            [void]$sb.Append($code.ToString('x4'))
        } else {
            [void]$sb.Append($ch)
        }
    }
    return $sb.ToString()
}

function Get-CanonicalJson {
    param($Value)
    if ($null -eq $Value) {
        throw 'CANONICAL_NULL'
    }
    if ($Value -is [bool]) {
        if ($Value) { return 'true' } else { return 'false' }
    }
    if ($Value -is [byte] -or $Value -is [int16] -or $Value -is [uint16] -or
        $Value -is [int] -or $Value -is [uint32] -or $Value -is [long] -or
        $Value -is [int64] -or $Value -is [uint64]) {
        return ([int64]$Value).ToString([System.Globalization.CultureInfo]::InvariantCulture)
    }
    if ($Value -is [string]) {
        return ('"' + (Escape-JsonString $Value) + '"')
    }
    if ($Value -is [JsonArr]) {
        $parts = New-Object System.Collections.Generic.List[string]
        foreach ($el in $Value.Items) {
            $parts.Add((Get-CanonicalJson $el))
        }
        return ('[' + [string]::Join(',', $parts.ToArray()) + ']')
    }
    if ($Value -is [System.Collections.IDictionary]) {
        $keys = New-Object System.Collections.Generic.List[string]
        foreach ($k in $Value.Keys) { $keys.Add([string]$k) }
        $keys.Sort([System.StringComparer]::Ordinal)
        $parts = New-Object System.Collections.Generic.List[string]
        foreach ($k in $keys) {
            $parts.Add(('"' + (Escape-JsonString $k) + '":' + (Get-CanonicalJson $Value[$k])))
        }
        return ('{' + [string]::Join(',', $parts.ToArray()) + '}')
    }
    if ($Value -is [System.Collections.IEnumerable]) {
        $parts = New-Object System.Collections.Generic.List[string]
        foreach ($el in $Value) {
            $parts.Add((Get-CanonicalJson $el))
        }
        return ('[' + [string]::Join(',', $parts.ToArray()) + ']')
    }
    throw 'CANONICAL_TYPE'
}

function ConvertTo-ArrayList {
    param($Value)
    $list = New-Object System.Collections.ArrayList
    if ($null -eq $Value) { return $list }
    if ($Value -is [JsonArr]) { return $Value.Items }
    if ($Value -is [System.Collections.ArrayList]) { return $Value }
    if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [string] -and $Value -isnot [System.Collections.IDictionary]) {
        foreach ($el in $Value) { [void]$list.Add($el) }
        return $list
    }
    [void]$list.Add($Value)
    return $list
}

function Read-Utf8File {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw 'IO'
    }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        return [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
    }
    return [System.Text.Encoding]::UTF8.GetString($bytes)
}

# ----- strict JSON parser (null forbidden; empty arrays preserved) -----

$script:jpText = ''
$script:jpPos = 0
$script:jpLen = 0

function Jp-Peek {
    if ($script:jpPos -ge $script:jpLen) { return [char]0 }
    return $script:jpText[$script:jpPos]
}

function Jp-SkipWs {
    while ($script:jpPos -lt $script:jpLen) {
        $c = $script:jpText[$script:jpPos]
        if ($c -eq ' ' -or $c -eq "`t" -or $c -eq "`n" -or $c -eq "`r") {
            $script:jpPos++
        } else { break }
    }
}

function Jp-ParseString {
    if ((Jp-Peek) -ne '"') { throw 'JSON' }
    $script:jpPos++
    $sb = New-Object System.Text.StringBuilder
    while ($script:jpPos -lt $script:jpLen) {
        $c = $script:jpText[$script:jpPos]
        $script:jpPos++
        if ($c -eq '"') { return $sb.ToString() }
        if ($c -eq '\') {
            if ($script:jpPos -ge $script:jpLen) { throw 'JSON' }
            $e = $script:jpText[$script:jpPos]
            $script:jpPos++
            switch ($e) {
                '"' { [void]$sb.Append('"') }
                '\' { [void]$sb.Append('\') }
                '/' { [void]$sb.Append('/') }
                'b' { [void]$sb.Append([char]8) }
                'f' { [void]$sb.Append([char]12) }
                'n' { [void]$sb.Append([char]10) }
                'r' { [void]$sb.Append([char]13) }
                't' { [void]$sb.Append([char]9) }
                'u' {
                    if (($script:jpPos + 4) -gt $script:jpLen) { throw 'JSON' }
                    $hex = $script:jpText.Substring($script:jpPos, 4)
                    $script:jpPos += 4
                    $code = [Convert]::ToInt32($hex, 16)
                    [void]$sb.Append([char]$code)
                }
                default { throw 'JSON' }
            }
        } elseif ([int]$c -lt 0x20) {
            throw 'JSON'
        } else {
            [void]$sb.Append($c)
        }
    }
    throw 'JSON'
}

function Jp-ParseNumber {
    $start = $script:jpPos
    if ((Jp-Peek) -eq '-') { $script:jpPos++ }
    if ($script:jpPos -ge $script:jpLen) { throw 'JSON' }
    $c = Jp-Peek
    if ($c -lt '0' -or $c -gt '9') { throw 'JSON' }
    if ($c -eq '0') {
        $script:jpPos++
    } else {
        while ($script:jpPos -lt $script:jpLen) {
            $c = Jp-Peek
            if ($c -ge '0' -and $c -le '9') { $script:jpPos++ } else { break }
        }
    }
    $c = Jp-Peek
    if ($c -eq '.' -or $c -eq 'e' -or $c -eq 'E') { throw 'JSON' }
    $raw = $script:jpText.Substring($start, $script:jpPos - $start)
    return [int64]::Parse($raw, [System.Globalization.CultureInfo]::InvariantCulture)
}

function Jp-ParseValue {
    Jp-SkipWs
    if ($script:jpPos -ge $script:jpLen) { throw 'JSON' }
    $c = Jp-Peek
    if ($c -eq '{') { return Jp-ParseObject }
    if ($c -eq '[') { return Jp-ParseArray }
    if ($c -eq '"') { return Jp-ParseString }
    if ($c -eq '-' -or ($c -ge '0' -and $c -le '9')) { return Jp-ParseNumber }
    if ($c -eq 't') {
        if (($script:jpPos + 4) -le $script:jpLen -and $script:jpText.Substring($script:jpPos, 4) -eq 'true') {
            $script:jpPos += 4
            return $true
        }
        throw 'JSON'
    }
    if ($c -eq 'f') {
        if (($script:jpPos + 5) -le $script:jpLen -and $script:jpText.Substring($script:jpPos, 5) -eq 'false') {
            $script:jpPos += 5
            return $false
        }
        throw 'JSON'
    }
    if ($c -eq 'n') {
        throw 'JSON_NULL'
    }
    throw 'JSON'
}

function Jp-ParseObject {
    $script:jpPos++
    $map = New-OrdinalMap
    Jp-SkipWs
    if ((Jp-Peek) -eq '}') { $script:jpPos++; return $map }
    while ($true) {
        Jp-SkipWs
        if ((Jp-Peek) -ne '"') { throw 'JSON' }
        $key = Jp-ParseString
        Jp-SkipWs
        if ((Jp-Peek) -ne ':') { throw 'JSON' }
        $script:jpPos++
        $val = Jp-ParseValue
        if ($map.ContainsKey($key)) { throw 'JSON' }
        $map[$key] = $val
        Jp-SkipWs
        $c = Jp-Peek
        if ($c -eq ',') { $script:jpPos++; continue }
        if ($c -eq '}') { $script:jpPos++; return $map }
        throw 'JSON'
    }
}

function Jp-ParseArray {
    $script:jpPos++
    $arr = New-Object JsonArr
    Jp-SkipWs
    if ((Jp-Peek) -eq ']') { $script:jpPos++; return $arr }
    while ($true) {
        $val = Jp-ParseValue
        [void]$arr.Items.Add($val)
        Jp-SkipWs
        $c = Jp-Peek
        if ($c -eq ',') { $script:jpPos++; continue }
        if ($c -eq ']') { $script:jpPos++; return $arr }
        throw 'JSON'
    }
}

function Parse-JsonStrict {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { throw 'JSON' }
    $script:jpText = $Text
    $script:jpPos = 0
    $script:jpLen = $Text.Length
    $val = Jp-ParseValue
    Jp-SkipWs
    if ($script:jpPos -ne $script:jpLen) { throw 'JSON' }
    return $val
}

function Test-IsMap {
    param($v)
    return ($v -is [System.Collections.IDictionary])
}

function Get-MapKeys {
    param($Map)
    $list = New-Object System.Collections.Generic.List[string]
    foreach ($k in $Map.Keys) { $list.Add([string]$k) }
    return $list
}

function Assert-ClosedKeys {
    param($Map, [string[]]$Allowed)
    $allow = New-StringSet
    foreach ($a in $Allowed) { [void]$allow.Add($a) }
    foreach ($k in (Get-MapKeys $Map)) {
        if (-not $allow.Contains($k)) { throw 'UNKNOWN_PROPERTY' }
    }
}

function Assert-RequiredKeys {
    param($Map, [string[]]$Required)
    foreach ($r in $Required) {
        if (-not $Map.ContainsKey($r)) { throw 'MISSING' }
    }
}

function Test-TaskId {
    param([string]$Id)
    if ([string]::IsNullOrEmpty($Id)) { return $false }
    if ($Id.Length -lt 3 -or $Id.Length -gt 128) { return $false }
    return [bool]($Id -cmatch '^[A-Z][A-Z0-9-]{1,126}[A-Z0-9]$')
}

function Test-ContractId {
    param([string]$Id)
    if ([string]::IsNullOrEmpty($Id)) { return $false }
    if ($Id.Length -lt 3 -or $Id.Length -gt 128) { return $false }
    return [bool]($Id -cmatch '^[A-Z][A-Z0-9_-]{1,126}[A-Z0-9]$')
}

function Test-StringArray {
    param($Value)
    if ($null -eq $Value) { return $false }
    if ($Value -isnot [JsonArr] -and $Value -isnot [System.Collections.ArrayList] -and $Value -isnot [System.Collections.IList]) {
        return $false
    }
    $list = ConvertTo-ArrayList $Value
    foreach ($el in $list) {
        if ($el -isnot [string]) { return $false }
    }
    return $true
}

# ----- occupancy block -----

function Parse-OccupancyBlock {
    param([string]$Text)
    $beginMark = '<!-- AISB_OCCUPANCY_V1_BEGIN -->'
    $endMark = '<!-- AISB_OCCUPANCY_V1_END -->'
    $beginIdx = 0
    $beginCount = 0
    $searchFrom = 0
    while ($true) {
        $i = $Text.IndexOf($beginMark, $searchFrom, [System.StringComparison]::Ordinal)
        if ($i -lt 0) { break }
        $beginCount++
        if ($beginCount -eq 1) { $beginIdx = $i }
        $searchFrom = $i + $beginMark.Length
    }
    $endIdx = 0
    $endCount = 0
    $searchFrom = 0
    while ($true) {
        $i = $Text.IndexOf($endMark, $searchFrom, [System.StringComparison]::Ordinal)
        if ($i -lt 0) { break }
        $endCount++
        if ($endCount -eq 1) { $endIdx = $i }
        $searchFrom = $i + $endMark.Length
    }
    if ($beginCount -ne 1 -or $endCount -ne 1) { throw 'MALFORMED' }
    if ($endIdx -le $beginIdx) { throw 'MALFORMED' }
    $legacyIdx = $Text.IndexOf('LEGACY / FROZEN TASK HISTORY', [System.StringComparison]::Ordinal)
    if ($legacyIdx -lt 0) {
        $legacyIdx = $Text.IndexOf('LEGACY / FROZEN', [System.StringComparison]::Ordinal)
    }
    if ($legacyIdx -ge 0 -and $beginIdx -gt $legacyIdx) { throw 'MALFORMED' }
    $innerStart = $beginIdx + $beginMark.Length
    $inner = $Text.Substring($innerStart, $endIdx - $innerStart)
    if ($inner.Contains($beginMark) -or $inner.Contains($endMark)) { throw 'MALFORMED' }
    $inner = $inner -replace '^\r?\n', ''
    $inner = $inner -replace '\r?\n$', ''
    $lines = $inner -split '\r?\n'
    $map = New-OrdinalMap
    foreach ($line in $lines) {
        if ($line.Length -eq 0) { throw 'MALFORMED' }
        if ($line.Contains("`t")) { throw 'MALFORMED' }
        if ($line -ne $line.Trim()) { throw 'MALFORMED' }
        $eq = $line.IndexOf('=')
        if ($eq -le 0) { throw 'MALFORMED' }
        $key = $line.Substring(0, $eq)
        $val = $line.Substring($eq + 1)
        if ($key.Contains(' ') -or $val.Contains(' ') -and $key -ne 'occupancyHash') {
            # occupancyHash has no spaces; any key/value space is malformed
        }
        if ($key.Contains(' ') -or ($key + '=' + $val) -ne $line) { throw 'MALFORMED' }
        if ($line -match ' =|= ') { throw 'MALFORMED' }
        if ($map.ContainsKey($key)) { throw 'MALFORMED' }
        $map[$key] = $val
    }
    foreach ($k in (Get-MapKeys $map)) {
        $known = $false
        foreach ($ok in $script:OccupancyBlockKeys) { if ($k -eq $ok) { $known = $true; break } }
        if (-not $known) { throw 'MALFORMED' }
    }
    foreach ($ok in $script:OccupancyBlockKeys) {
        if (-not $map.ContainsKey($ok)) { throw 'MALFORMED' }
    }
    return $map
}

function Convert-BoardOccupancy {
    param($Map)
    if ($Map['schemaVersion'] -cne '1') { throw 'MALFORMED' }
    $maxRaw = $Map['maxImplementationLanes']
    if ($maxRaw -cne '2') { $script:CapacityFail = $true }
    if ($Map['lane3'] -cne 'DISABLED') { $script:CapacityFail = $true }
    $l1s = $Map['lane1.state']
    $l2s = $Map['lane2.state']
    $l1t = $Map['lane1.taskId']
    $l2t = $Map['lane2.taskId']
    foreach ($st in @($l1s, $l2s)) {
        if ($st -cne 'EMPTY' -and $st -cne 'ACTIVE' -and $st -cne 'LANE-DONE') { throw 'MALFORMED' }
    }
    $govOwner = $Map['governance.owner']
    $govState = $Map['governance.state']
    if ($govState -cne 'UNOWNED' -and $govState -cne 'ACTIVE') { throw 'MALFORMED' }
    $suspRaw = $Map['saturationSuspended']
    if ($suspRaw -cne 'true' -and $suspRaw -cne 'false') { throw 'MALFORMED' }
    $susp = ($suspRaw -ceq 'true')
    $reason = $Map['suspensionReason']
    if ($reason -cne 'NONE' -and $reason -cne 'OS_MUTATION') { throw 'MALFORMED' }
    $hashField = $Map['occupancyHash']
    if ($hashField -cnotmatch '^sha256:[a-f0-9]{64}$') { throw 'MALFORMED' }

    function Assert-LanePair([string]$state, [string]$taskId) {
        if ($state -ceq 'EMPTY') {
            if ($taskId -cne 'NONE') { throw 'MALFORMED' }
        } else {
            if ($taskId -ceq 'NONE') { throw 'MALFORMED' }
            if (-not (Test-TaskId $taskId)) { throw 'MALFORMED' }
        }
    }
    Assert-LanePair $l1s $l1t
    Assert-LanePair $l2s $l2t
    if ($l1t -cne 'NONE' -and $l1t -ceq $l2t) { throw 'MALFORMED' }
    if ($govState -ceq 'UNOWNED') {
        if ($govOwner -cne 'NONE') { throw 'MALFORMED' }
    } else {
        if (-not (Test-TaskId $govOwner)) { throw 'MALFORMED' }
    }
    if ($susp -and $reason -cne 'OS_MUTATION') { throw 'MALFORMED' }
    if ((-not $susp) -and $reason -cne 'NONE') { throw 'MALFORMED' }

    $maxLanes = 0
    if (-not [int64]::TryParse($maxRaw, [ref]$maxLanes)) { throw 'MALFORMED' }

    $subset = New-OrdinalMap
    $gov = New-OrdinalMap
    $gov['owner'] = $govOwner
    $gov['state'] = $govState
    $subset['governance'] = $gov
    $subset['lane3'] = $Map['lane3']
    $subset['maxImplementationLanes'] = $maxLanes
    $occ = New-OrdinalMap
    $a = New-OrdinalMap
    $a['state'] = $l1s
    $a['taskId'] = $l1t
    $b = New-OrdinalMap
    $b['state'] = $l2s
    $b['taskId'] = $l2t
    $occ['lane1'] = $a
    $occ['lane2'] = $b
    $subset['occupancy'] = $occ
    $subset['saturationSuspended'] = $susp
    $subset['schemaVersion'] = [int64]1
    $subset['suspensionReason'] = $reason
    $board = New-OrdinalMap
    $board['subset'] = $subset
    $board['hashField'] = $hashField.Substring(7)
    $board['lane1State'] = $l1s
    $board['lane1TaskId'] = $l1t
    $board['lane2State'] = $l2s
    $board['lane2TaskId'] = $l2t
    $board['suspended'] = $susp
    $board['reason'] = $reason
    $board['govOwner'] = $govOwner
    $board['govState'] = $govState
    $board['maxLanes'] = $maxLanes
    $board['lane3'] = $Map['lane3']
    return $board
}

# ----- path normalization -----

function Normalize-WritePath {
    param([string]$Path)
    if ($null -eq $Path) { throw 'MALFORMED' }
    if ($Path -isnot [string]) { throw 'MALFORMED' }
    if ($Path.Length -eq 0) { throw 'MALFORMED' }
    if ($Path.Trim() -ne $Path) { throw 'MALFORMED' }
    if ($Path.Contains('*') -or $Path.Contains('?') -or $Path.Contains('[') -or $Path.Contains(']')) {
        throw 'MALFORMED'
    }
    $p = $Path.Replace('\', '/')
    while ($p.Contains('//')) { $p = $p.Replace('//', '/') }
    if ($p.StartsWith('./')) { $p = $p.Substring(2) }
    $segs = $p.Split('/')
    foreach ($seg in $segs) {
        if ($seg -eq '..') { throw 'MALFORMED' }
    }
    $lowerFull = $p.ToLowerInvariant()
    $repoA = 'C:\Users\knlee\aiSandBox2026B'.Replace('\', '/').ToLowerInvariant()
    $repoB = 'C:/Users/knlee/aiSandBox2026B'.ToLowerInvariant()
    $isAbs = $false
    if ($lowerFull.StartsWith($repoA) -or $lowerFull.StartsWith($repoB)) {
        $isAbs = $true
        $prefixLen = 0
        if ($lowerFull.StartsWith($repoA)) { $prefixLen = $repoA.Length } else { $prefixLen = $repoB.Length }
        if ($p.Length -gt $prefixLen -and ($p[$prefixLen] -eq '/' -or $p[$prefixLen] -eq '\')) {
            $p = $p.Substring($prefixLen + 1)
        } elseif ($p.Length -eq $prefixLen) {
            throw 'MALFORMED'
        } else {
            $p = $p.Substring($prefixLen)
        }
        while ($p.StartsWith('/')) { $p = $p.Substring(1) }
    }
    if ($p.Length -ge 2 -and $p[1] -eq ':') { throw 'MALFORMED' }
    if ($p.Length -eq 0) { throw 'MALFORMED' }
    $kind = 'FILE'
    if ($p.EndsWith('/')) { $kind = 'DIR' }
    $value = $p.ToLowerInvariant()
    $obj = New-OrdinalMap
    $obj['kind'] = $kind
    $obj['value'] = $value
    $obj['original'] = $Path
    return $obj
}

function Test-PathOverlap {
    param($A, $B)
    $av = [string]$A['value']
    $bv = [string]$B['value']
    $ak = [string]$A['kind']
    $bk = [string]$B['kind']
    if ($ak -eq 'FILE' -and $bk -eq 'FILE') {
        return ($av -eq $bv)
    }
    if ($ak -eq 'DIR' -and $bk -eq 'DIR') {
        if ($av -eq $bv) { return $true }
        if ($av.Length -gt 0 -and $bv.StartsWith($av)) { return $true }
        if ($bv.Length -gt 0 -and $av.StartsWith($bv)) { return $true }
        return $false
    }
    if ($ak -eq 'DIR' -and $bk -eq 'FILE') {
        $dirNo = $av
        if ($dirNo.EndsWith('/')) { $dirNo = $dirNo.Substring(0, $dirNo.Length - 1) }
        if ($bv -eq $dirNo) { return $true }
        if ($bv.StartsWith($av)) { return $true }
        return $false
    }
    if ($ak -eq 'FILE' -and $bk -eq 'DIR') {
        return (Test-PathOverlap $B $A)
    }
    return $false
}

function Get-Basename {
    param([string]$NormValue)
    $v = $NormValue
    if ($v.EndsWith('/')) { $v = $v.Substring(0, $v.Length - 1) }
    $i = $v.LastIndexOf('/')
    if ($i -lt 0) { return $v }
    return $v.Substring($i + 1)
}

# ----- catalog -----

function Load-Catalog {
    param($Root)
    if (-not (Test-IsMap $Root)) { throw 'MALFORMED' }
    Assert-ClosedKeys $Root @('schemaVersion', 'mutexes')
    Assert-RequiredKeys $Root @('schemaVersion', 'mutexes')
    if ($Root['schemaVersion'] -isnot [int64] -or [int64]$Root['schemaVersion'] -ne 1) { throw 'MALFORMED' }
    $mutexes = ConvertTo-ArrayList $Root['mutexes']
    $idMap = New-OrdinalMap
    $aliasMap = New-OrdinalMap
    foreach ($spec in $mutexes) {
        if (-not (Test-IsMap $spec)) { throw 'MALFORMED' }
        Assert-ClosedKeys $spec $script:CatalogMutexKeys
        Assert-RequiredKeys $spec $script:CatalogMutexKeys
        $id = $spec['id']
        if ($id -isnot [string] -or -not ($script:ClosedMutexIds -contains $id)) { throw 'MALFORMED' }
        if ($idMap.ContainsKey($id)) { throw 'MALFORMED' }
        $kind = $spec['kind']
        if ($kind -cne 'BROAD' -and $kind -cne 'ATOMIC' -and $kind -cne 'RESOURCE' -and $kind -cne 'MATCHER' -and $kind -cne 'HOTFILE_RULE') {
            throw 'MALFORMED'
        }
        if ($spec['exclusive'] -isnot [bool]) { throw 'MALFORMED' }
        $mk = $spec['matchKind']
        if ($mk -cne 'NONE' -and $mk -cne 'FILENAME' -and $mk -cne 'BASENAME_PREFIX') { throw 'MALFORMED' }
        if (-not (Test-StringArray $spec['aliases'])) { throw 'MALFORMED' }
        if (-not (Test-StringArray $spec['pathPrefixes'])) { throw 'MALFORMED' }
        if (-not (Test-StringArray $spec['files'])) { throw 'MALFORMED' }
        if (-not (Test-StringArray $spec['matchNames'])) { throw 'MALFORMED' }
        $idMap[$id] = $spec
        foreach ($al in (ConvertTo-ArrayList $spec['aliases'])) {
            if ($aliasMap.ContainsKey([string]$al) -or $idMap.ContainsKey([string]$al)) { throw 'MALFORMED' }
            $aliasMap[[string]$al] = $id
        }
    }
    foreach ($need in $script:ClosedMutexIds) {
        if (-not $idMap.ContainsKey($need)) { throw 'MALFORMED' }
    }
    $script:IdToSpec = $idMap
    $script:AliasToId = $aliasMap
}

function Resolve-MutexId {
    param([string]$Raw)
    if ($script:IdToSpec.ContainsKey($Raw)) { return $Raw }
    if ($script:AliasToId.ContainsKey($Raw)) { return [string]$script:AliasToId[$Raw] }
    throw 'MALFORMED'
}

function Add-PathToSet {
    param($PathSet, $Norm)
    [void]$PathSet.Add($Norm)
}

function Expand-Effective {
    param($Record)
    $mutexSet = New-StringSet
    $pathSet = New-Object System.Collections.ArrayList
    $hotSet = New-Object System.Collections.ArrayList
    $resSet = New-StringSet
    $listedMutex = New-StringSet

    foreach ($raw in (ConvertTo-ArrayList $Record['mutexes'])) {
        if ($raw -isnot [string]) { throw 'MALFORMED' }
        $s = [string]$raw
        if ($s -eq 'HOTFILE' -or $s.StartsWith('HOTFILE:')) { throw 'MALFORMED' }
        $id = Resolve-MutexId $s
        if (-not $listedMutex.Add($id)) { throw 'MALFORMED' }
        [void]$mutexSet.Add($id)
        $spec = $script:IdToSpec[$id]
        foreach ($pp in (ConvertTo-ArrayList $spec['pathPrefixes'])) {
            $n = Normalize-WritePath ([string]$pp)
            if ($n['kind'] -ne 'DIR') {
                # prefixes should be dirs; still add as given after normalize
            }
            [void]$pathSet.Add($n)
        }
        foreach ($f in (ConvertTo-ArrayList $spec['files'])) {
            [void]$pathSet.Add((Normalize-WritePath ([string]$f)))
        }
        if ([string]$spec['kind'] -eq 'RESOURCE') { [void]$resSet.Add($id) }
        if ($id -eq 'I18N') {
            foreach ($lf in $script:I18nFiles) {
                [void]$pathSet.Add((Normalize-WritePath $lf))
            }
        }
    }

    foreach ($p in (ConvertTo-ArrayList $Record['writePaths'])) {
        if ($p -isnot [string]) { throw 'MALFORMED' }
        $n = Normalize-WritePath ([string]$p)
        [void]$pathSet.Add($n)
        $base = Get-Basename ([string]$n['value'])
        foreach ($spec in $script:IdToSpec.Values) {
            if ([string]$spec['kind'] -ne 'MATCHER') { continue }
            $matched = $false
            $mk = [string]$spec['matchKind']
            foreach ($mn in (ConvertTo-ArrayList $spec['matchNames'])) {
                $name = ([string]$mn).ToLowerInvariant()
                if ($mk -eq 'FILENAME') {
                    if ($base -eq $name) { $matched = $true }
                } elseif ($mk -eq 'BASENAME_PREFIX') {
                    if ($base.StartsWith($name)) { $matched = $true }
                }
            }
            if ($matched) {
                $mid = [string]$spec['id']
                if (-not $listedMutex.Contains($mid)) { throw 'MALFORMED' }
                [void]$mutexSet.Add($mid)
            }
        }
    }

    foreach ($h in (ConvertTo-ArrayList $Record['hotfiles'])) {
        if ($h -isnot [string]) { throw 'MALFORMED' }
        $n = Normalize-WritePath ([string]$h)
        if ($n['kind'] -ne 'FILE') { throw 'MALFORMED' }
        [void]$hotSet.Add($n)
        [void]$pathSet.Add($n)
    }

    if ($Record['i18n'] -eq $true) {
        [void]$mutexSet.Add('I18N')
        foreach ($lf in $script:I18nFiles) {
            [void]$pathSet.Add((Normalize-WritePath $lf))
        }
    }

    foreach ($r in (ConvertTo-ArrayList $Record['runtimeNeeds'])) {
        if ($r -isnot [string]) { throw 'MALFORMED' }
        $rid = [string]$r
        if ($script:ResourceIds -notcontains $rid) { throw 'MALFORMED' }
        [void]$resSet.Add($rid)
        [void]$mutexSet.Add($rid)
    }

    $eff = New-OrdinalMap
    $eff['mutexSet'] = $mutexSet
    $eff['pathSet'] = $pathSet
    $eff['hotSet'] = $hotSet
    $eff['resSet'] = $resSet
    return $eff
}

function Test-TouchesLocale {
    param($Record)
    $paths = New-Object System.Collections.ArrayList
    foreach ($p in (ConvertTo-ArrayList $Record['writePaths'])) {
        [void]$paths.Add((Normalize-WritePath ([string]$p)))
    }
    foreach ($p in (ConvertTo-ArrayList $Record['hotfiles'])) {
        [void]$paths.Add((Normalize-WritePath ([string]$p)))
    }
    foreach ($p in $paths) {
        foreach ($lf in $script:I18nFiles) {
            $n = Normalize-WritePath $lf
            if (Test-PathOverlap $p $n) { return $true }
        }
    }
    return $false
}

function Assert-I18nAgreement {
    param($Record)
    $i18n = $Record['i18n']
    if ($i18n -isnot [bool]) { throw 'MALFORMED' }
    $hasI18nMutex = $false
    foreach ($raw in (ConvertTo-ArrayList $Record['mutexes'])) {
        try {
            $id = Resolve-MutexId ([string]$raw)
            if ($id -eq 'I18N') { $hasI18nMutex = $true }
        } catch {
            throw 'MALFORMED'
        }
    }
    $touches = Test-TouchesLocale $Record
    if ($touches -and (-not $i18n -or -not $hasI18nMutex)) { throw 'MALFORMED' }
    if ($i18n -and -not $hasI18nMutex) { throw 'MALFORMED' }
    if ($hasI18nMutex -and -not $i18n) { throw 'MALFORMED' }
}

function Get-CanonicalMutexIds {
    param($MutexArray)
    $set = New-StringSet
    $list = New-Object System.Collections.Generic.List[string]
    foreach ($raw in (ConvertTo-ArrayList $MutexArray)) {
        $id = Resolve-MutexId ([string]$raw)
        if (-not $set.Add($id)) { throw 'MALFORMED' }
        $list.Add($id)
    }
    $list.Sort([System.StringComparer]::Ordinal)
    return $list
}

function Assert-RecordIntra {
    param($Record, [bool]$IsCandidate)
    Assert-I18nAgreement $Record
    $mutexCanon = Get-CanonicalMutexIds $Record['mutexes']
    $mutexSet = New-StringSet
    foreach ($id in $mutexCanon) { [void]$mutexSet.Add($id) }

    $needs = ConvertTo-ArrayList $Record['runtimeNeeds']
    foreach ($r in $needs) {
        if ($script:ResourceIds -notcontains [string]$r) { throw 'MALFORMED' }
        if (-not $mutexSet.Contains([string]$r)) { throw 'MALFORMED' }
    }

    $ev = [string]$Record['evidenceClass']
    if ($IsCandidate) {
        if ($ev -cne 'LOCAL-TESTS' -and $ev -cne 'LOCAL-RUNTIME' -and $ev -cne 'STAGING-RUNTIME' -and $ev -cne 'PROVIDER-LIVE') {
            throw 'MALFORMED'
        }
    } else {
        if ($ev -cne 'NONE' -and $ev -cne 'LOCAL-TESTS' -and $ev -cne 'LOCAL-RUNTIME' -and $ev -cne 'STAGING-RUNTIME' -and $ev -cne 'PROVIDER-LIVE') {
            throw 'MALFORMED'
        }
    }

    $needSet = New-StringSet
    foreach ($r in $needs) { [void]$needSet.Add([string]$r) }
    if ($ev -eq 'STAGING-RUNTIME' -and -not $needSet.Contains('STAGING')) { throw 'MALFORMED' }
    if ($ev -eq 'PROVIDER-LIVE' -and -not $needSet.Contains('PROVIDER-LIVE')) { throw 'MALFORMED' }
    if ($ev -eq 'LOCAL-RUNTIME' -and -not $mutexSet.Contains('LOCAL-RUNTIME')) { throw 'MALFORMED' }
    if ($ev -eq 'LOCAL-TESTS') {
        if ($needSet.Contains('STAGING') -or $needSet.Contains('PROVIDER-LIVE')) { throw 'MALFORMED' }
    }

    $pc = [string]$Record['productClass']
    $fa = [string]$Record['futureAuthorization']
    if ($IsCandidate) {
        if ($pc -eq 'APPROVED_FUTURE') {
            if ($fa -cne 'AUTHORIZED' -and $fa -cne 'NONE') { throw 'MALFORMED' }
        } else {
            if ($fa -cne 'NONE') { throw 'MALFORMED' }
        }
        if ([string]$Record['nature'] -eq 'IMPLEMENTATION' -and $mutexSet.Contains('GOVERNANCE')) {
            throw 'MALFORMED'
        }
        $wsp = [string]$Record['writeSetPrecision']
        $au = $Record['admissionUncertain']
        if ($au -isnot [bool]) { throw 'MALFORMED' }
        if ($wsp -eq 'PROVISIONAL' -and $au -ne $true) { throw 'MALFORMED' }
        $deps = ConvertTo-ArrayList $Record['dependsOn']
        $depSet = New-StringSet
        foreach ($d in $deps) {
            if ($d -isnot [string] -or -not (Test-TaskId ([string]$d))) { throw 'MALFORMED' }
            if ([string]$d -eq [string]$Record['taskId']) { throw 'MALFORMED' }
            if (-not $depSet.Add([string]$d)) { throw 'MALFORMED' }
        }
        $sc = New-StringSet
        foreach ($id in (ConvertTo-ArrayList $Record['sharedContractIds'])) {
            if ($id -isnot [string] -or -not (Test-ContractId ([string]$id))) { throw 'MALFORMED' }
            if (-not $sc.Add([string]$id)) { throw 'MALFORMED' }
        }
        $ms = New-StringSet
        foreach ($id in (ConvertTo-ArrayList $Record['mutatesSharedContractIds'])) {
            if ($id -isnot [string] -or -not (Test-ContractId ([string]$id))) { throw 'MALFORMED' }
            if (-not $ms.Add([string]$id)) { throw 'MALFORMED' }
            if ($sc.Contains([string]$id)) { throw 'MALFORMED' }
        }
    }

    # force path/hotfile glob checks
    foreach ($p in (ConvertTo-ArrayList $Record['writePaths'])) { $null = Normalize-WritePath ([string]$p) }
    foreach ($p in (ConvertTo-ArrayList $Record['hotfiles'])) { $null = Normalize-WritePath ([string]$p) }
    $null = Expand-Effective $Record
}

function Test-StringListEqual {
    param($A, $B)
    $la = @(ConvertTo-ArrayList $A)
    $lb = @(ConvertTo-ArrayList $B)
    if ($la.Count -ne $lb.Count) { return $false }
    for ($i = 0; $i -lt $la.Count; $i++) {
        if ([string]$la[$i] -cne [string]$lb[$i]) { return $false }
    }
    return $true
}

function Test-OccupiedMatchesCandidate {
    param($Lane, $Cand)
    $lm = Get-CanonicalMutexIds $Lane['mutexes']
    $cm = Get-CanonicalMutexIds $Cand['mutexes']
    if ($lm.Count -ne $cm.Count) { return $false }
    for ($i = 0; $i -lt $lm.Count; $i++) {
        if ($lm[$i] -cne $cm[$i]) { return $false }
    }
    if (-not (Test-StringListEqual $Lane['writePaths'] $Cand['writePaths'])) { return $false }
    if (-not (Test-StringListEqual $Lane['hotfiles'] $Cand['hotfiles'])) { return $false }
    if ([bool]$Lane['i18n'] -ne [bool]$Cand['i18n']) { return $false }
    if ([string]$Lane['evidenceClass'] -cne [string]$Cand['evidenceClass']) { return $false }
    if ([bool]$Lane['exclusiveCapacity'] -ne [bool]$Cand['exclusiveCapacity']) { return $false }
    if (-not (Test-StringListEqual $Lane['sharedContractIds'] $Cand['sharedContractIds'])) { return $false }
    if (-not (Test-StringListEqual $Lane['mutatesSharedContractIds'] $Cand['mutatesSharedContractIds'])) { return $false }
    if (-not (Test-StringListEqual $Lane['runtimeNeeds'] $Cand['runtimeNeeds'])) { return $false }
    return $true
}

function Assert-EmptyLane {
    param($Lane)
    if ([string]$Lane['taskId'] -cne 'NONE') { throw 'MALFORMED' }
    if ((ConvertTo-ArrayList $Lane['mutexes']).Count -ne 0) { throw 'MALFORMED' }
    if ((ConvertTo-ArrayList $Lane['writePaths']).Count -ne 0) { throw 'MALFORMED' }
    if ((ConvertTo-ArrayList $Lane['hotfiles']).Count -ne 0) { throw 'MALFORMED' }
    if ($Lane['i18n'] -ne $false) { throw 'MALFORMED' }
    if ([string]$Lane['evidenceClass'] -cne 'NONE') { throw 'MALFORMED' }
    if ($Lane['exclusiveCapacity'] -ne $false) { throw 'MALFORMED' }
    if ((ConvertTo-ArrayList $Lane['sharedContractIds']).Count -ne 0) { throw 'MALFORMED' }
    if ((ConvertTo-ArrayList $Lane['mutatesSharedContractIds']).Count -ne 0) { throw 'MALFORMED' }
    if ((ConvertTo-ArrayList $Lane['runtimeNeeds']).Count -ne 0) { throw 'MALFORMED' }
}

function Assert-OccupiedLaneShape {
    param($Lane)
    $tid = [string]$Lane['taskId']
    if (-not (Test-TaskId $tid)) { throw 'MALFORMED' }
    $wp = (ConvertTo-ArrayList $Lane['writePaths']).Count
    $mx = (ConvertTo-ArrayList $Lane['mutexes']).Count
    $ex = [bool]$Lane['exclusiveCapacity']
    if ($wp -eq 0 -and $mx -eq 0 -and -not $ex) { throw 'MALFORMED' }
    if ([string]$Lane['evidenceClass'] -eq 'NONE') { throw 'MALFORMED' }
}

function Get-EvidenceDeny {
    param([string]$A, [string]$B)
    if ($A -eq 'NONE' -or $B -eq 'NONE') { return $false }
    $order = @{ 'LOCAL-TESTS' = 0; 'LOCAL-RUNTIME' = 1; 'STAGING-RUNTIME' = 2; 'PROVIDER-LIVE' = 3 }
    if (-not $order.ContainsKey($A) -or -not $order.ContainsKey($B)) { return $true }
    $matrix = @(
        @($false, $false, $true, $true),
        @($false, $true, $true, $true),
        @($true, $true, $true, $true),
        @($true, $true, $true, $true)
    )
    return $matrix[$order[$A]][$order[$B]]
}

function Test-HotOrPathHotOverlap {
    param($EffA, $EffB)
    foreach ($h in $EffA['hotSet']) {
        foreach ($h2 in $EffB['hotSet']) {
            if (Test-PathOverlap $h $h2) { return $true }
        }
        foreach ($p in $EffB['pathSet']) {
            if (Test-PathOverlap $h $p) { return $true }
        }
    }
    foreach ($h in $EffB['hotSet']) {
        foreach ($p in $EffA['pathSet']) {
            if (Test-PathOverlap $h $p) { return $true }
        }
    }
    return $false
}

function Test-PathSetOverlap {
    param($EffA, $EffB)
    foreach ($a in $EffA['pathSet']) {
        foreach ($b in $EffB['pathSet']) {
            if (Test-PathOverlap $a $b) { return $true }
        }
    }
    return $false
}

function Get-IdSetFromArray {
    param($Arr)
    $s = New-OrdinalMap
    foreach ($x in (ConvertTo-ArrayList $Arr)) { $s[[string]$x] = $true }
    return $s
}

function Test-SharedContractPair {
    param($A, $B)
    $aDep = Get-IdSetFromArray $A['sharedContractIds']
    $aMut = Get-IdSetFromArray $A['mutatesSharedContractIds']
    $bDep = Get-IdSetFromArray $B['sharedContractIds']
    $bMut = Get-IdSetFromArray $B['mutatesSharedContractIds']
    foreach ($id in $aMut.Keys) {
        if ($bDep.ContainsKey($id) -or $bMut.ContainsKey($id)) { return $true }
    }
    foreach ($id in $bMut.Keys) {
        if ($aDep.ContainsKey($id) -or $aMut.ContainsKey($id)) { return $true }
    }
    return $false
}

function Get-Conflict {
    param($A, $B)
    $ea = Expand-Effective $A
    $eb = Expand-Effective $B
    # contract paths for mutators
    function Add-ContractPaths($Rec, $Eff, $Registry) {
        foreach ($id in (ConvertTo-ArrayList $Rec['mutatesSharedContractIds'])) {
            if ($Registry.ContainsKey([string]$id)) {
                $c = $Registry[[string]$id]
                foreach ($p in (ConvertTo-ArrayList $c['paths'])) {
                    [void]$Eff['pathSet'].Add((Normalize-WritePath ([string]$p)))
                }
            }
        }
    }
    Add-ContractPaths $A $ea $script:ContractRegistry
    Add-ContractPaths $B $eb $script:ContractRegistry

    $ia = $ea['mutexSet']
    $ib = $eb['mutexSet']
    $hitStaging = $ia.Contains('STAGING') -and $ib.Contains('STAGING')
    $hitProv = $ia.Contains('PROVIDER-LIVE') -and $ib.Contains('PROVIDER-LIVE')
    $hitCredit = $ia.Contains('CREDIT') -and $ib.Contains('CREDIT')
    $hitRt = $ia.Contains('LOCAL-RUNTIME') -and $ib.Contains('LOCAL-RUNTIME')
    $hitI18n = $ia.Contains('I18N') -and $ib.Contains('I18N')
    $any = $false
    foreach ($id in $ia) { if ($ib.Contains($id)) { $any = $true; break } }
    if ($hitStaging) { return 'STAGING_CONFLICT' }
    if ($hitProv) { return 'PROVIDER_LIVE_CONFLICT' }
    if ($hitCredit) { return 'CREDIT_CONFLICT' }
    if ($hitRt) { return 'RUNTIME_INCOMPATIBLE' }
    if ($hitI18n) { return 'I18N_CONFLICT' }
    if ($any) { return 'MUTEX_CONFLICT' }
    if (Test-HotOrPathHotOverlap $ea $eb) { return 'HOTFILE_CONFLICT' }
    if (Test-PathSetOverlap $ea $eb) { return 'WRITE_SCOPE_CONFLICT' }
    if (Test-SharedContractPair $A $B) { return 'SHARED_CONTRACT_UNFROZEN' }
    $evA = [string]$A['evidenceClass']
    $evB = [string]$B['evidenceClass']
    if (Get-EvidenceDeny $evA $evB) { return 'EVIDENCE_INCOMPATIBLE' }
    return 'OK'
}

function Get-OccupiedLanes {
    param($Occ)
    $list = New-Object System.Collections.ArrayList
    foreach ($name in @('lane1', 'lane2')) {
        $ln = $Occ[$name]
        if ([string]$ln['state'] -ne 'EMPTY') { [void]$list.Add($ln) }
    }
    return $list
}

function Test-Admissible {
    param($C, $Occ, $LockedSet)
    $occupiedIds = New-StringSet
    foreach ($ln in (Get-OccupiedLanes $Occ)) {
        [void]$occupiedIds.Add([string]$ln['taskId'])
    }
    $tid = [string]$C['taskId']
    if ($occupiedIds.Contains($tid)) { return 'SKIP' }

    if ($script:NeverCandidateIds -contains $tid) { return 'PROHIBITED' }
    if ([string]$C['nature'] -cne 'IMPLEMENTATION') { return 'GOVERNANCE_NATURE' }
    if ([string]$C['productClass'] -eq 'PARKED' -or [string]$C['status'] -eq 'PARKED') { return 'PARKED' }
    if ([string]$C['productClass'] -eq 'PROHIBITED' -or [string]$C['status'] -eq 'PROHIBITED') { return 'PROHIBITED' }
    if ([string]$C['productClass'] -eq 'APPROVED_FUTURE' -and [string]$C['futureAuthorization'] -cne 'AUTHORIZED') {
        return 'FUTURE_NOT_AUTHORIZED'
    }
    $pc = [string]$C['productClass']
    $eligible = ($pc -eq 'CURRENT' -or $pc -eq 'LIMITED_PRIVATE_BETA' -or ($pc -eq 'APPROVED_FUTURE' -and [string]$C['futureAuthorization'] -eq 'AUTHORIZED'))
    if (-not $eligible) { return 'PROHIBITED' }
    if ([string]$C['status'] -cne 'READY') { return 'NOT_READY' }
    if ([string]$C['startCondition'] -cne 'READY') { return 'NOT_READY' }
    if ([string]$C['saturationClass'] -cne 'FORCING') { return 'NOT_FORCING' }
    if ($C['admissionUncertain'] -eq $true) { return 'ADMISSION_UNCERTAIN' }
    foreach ($d in (ConvertTo-ArrayList $C['dependsOn'])) {
        if (-not $LockedSet.Contains([string]$d)) { return 'DEPS_UNSATISFIED' }
    }

    $otherOccupied = $false
    foreach ($ln in (Get-OccupiedLanes $Occ)) { $otherOccupied = $true }
    if ([bool]$C['exclusiveCapacity'] -and $otherOccupied) { return 'EXCLUSIVE_CAPACITY' }
    foreach ($ln in (Get-OccupiedLanes $Occ)) {
        if ([bool]$ln['exclusiveCapacity']) { return 'EXCLUSIVE_CAPACITY' }
    }

    foreach ($ln in (Get-OccupiedLanes $Occ)) {
        $code = Get-Conflict $C $ln
        if ($code -ne 'OK') { return $code }
    }

    $needs = Get-IdSetFromArray $C['runtimeNeeds']
    $rt = $script:RuntimeAuth
    if ($needs.ContainsKey('LOCAL-RUNTIME') -and $rt['localRuntimeAuthorized'] -ne $true) { return 'RUNTIME_INCOMPATIBLE' }
    if ($needs.ContainsKey('STAGING') -and $rt['stagingAuthorized'] -ne $true) { return 'STAGING_CONFLICT' }
    if ($needs.ContainsKey('PROVIDER-LIVE') -and $rt['providerLiveAuthorized'] -ne $true) { return 'PROVIDER_LIVE_CONFLICT' }
    if ($needs.ContainsKey('CREDIT') -and $rt['creditAuthorized'] -ne $true) { return 'CREDIT_CONFLICT' }

    foreach ($id in (ConvertTo-ArrayList $C['sharedContractIds'])) {
        if (-not $script:ContractRegistry.ContainsKey([string]$id)) { return 'SHARED_CONTRACT_UNFROZEN' }
        if ([string]$script:ContractRegistry[[string]$id]['state'] -cne 'FROZEN') { return 'SHARED_CONTRACT_UNFROZEN' }
    }
    foreach ($id in (ConvertTo-ArrayList $C['mutatesSharedContractIds'])) {
        if (-not $script:ContractRegistry.ContainsKey([string]$id)) { return 'SHARED_CONTRACT_UNFROZEN' }
        foreach ($ln in (Get-OccupiedLanes $Occ)) {
            $dep = Get-IdSetFromArray $ln['sharedContractIds']
            $mut = Get-IdSetFromArray $ln['mutatesSharedContractIds']
            if ($dep.ContainsKey([string]$id) -or $mut.ContainsKey([string]$id)) { return 'SHARED_CONTRACT_UNFROZEN' }
        }
    }
    return 'OK'
}

function Get-SidecarSubset {
    param($State)
    $subset = New-OrdinalMap
    $gov = New-OrdinalMap
    $gov['owner'] = [string]$State['governance']['owner']
    $gov['state'] = [string]$State['governance']['state']
    $subset['governance'] = $gov
    $subset['lane3'] = [string]$State['lane3']
    $subset['maxImplementationLanes'] = [int64]$State['maxImplementationLanes']
    $occ = New-OrdinalMap
    foreach ($name in @('lane1', 'lane2')) {
        $ln = $State['occupancy'][$name]
        $o = New-OrdinalMap
        $o['state'] = [string]$ln['state']
        $o['taskId'] = [string]$ln['taskId']
        $occ[$name] = $o
    }
    $subset['occupancy'] = $occ
    $subset['saturationSuspended'] = [bool]$State['saturationSuspended']
    $subset['schemaVersion'] = [int64]$State['schemaVersion']
    $subset['suspensionReason'] = [string]$State['suspensionReason']
    return $subset
}

function Get-GitFacts {
    param([string]$Root)
    $head = 'UNKNOWN'
    $dirty = $true
    try {
        $h = & git -C $Root rev-parse HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($h)) {
            $head = ([string]$h).Trim()
        }
        $st = & git -C $Root status --porcelain 2>$null
        if ($LASTEXITCODE -eq 0) {
            $dirty = -not [string]::IsNullOrWhiteSpace(([string]$st))
        }
    } catch {
        $head = 'UNKNOWN'
        $dirty = $true
    }
    $o = New-OrdinalMap
    $o['headSha'] = $head
    $o['workingTreeDirty'] = $dirty
    return $o
}

function Write-JsonStdout {
    param($Obj)
    $json = Get-CanonicalJson $Obj
    Write-Output $json
}

function Fail-Exit1 {
    param([string]$Code)
    $o = New-OrdinalMap
    $o['result'] = 'FAIL'
    $o['exitCode'] = [int64]1
    $o['errorCode'] = $Code
    Write-JsonStdout $o
    exit 1
}

function Save-Proof {
    param($Proof, [string]$Path, [int]$Code)
    $json = Get-CanonicalJson $Proof
    if ($Code -ne 1 -and -not [string]::IsNullOrWhiteSpace($Path)) {
        $enc = New-Object System.Text.UTF8Encoding $false
        $dir = Split-Path -Parent $Path
        if (-not [string]::IsNullOrWhiteSpace($dir) -and -not (Test-Path -LiteralPath $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        [System.IO.File]::WriteAllText($Path, $json + "`r`n", $enc)
    }
    Write-Output $json
    exit $Code
}

function New-Proof {
    param(
        [string]$Result,
        [int]$ExitCode,
        [string]$IdleCode,
        $S,
        $Rejected,
        [string]$OccHash,
        [string]$SidecarHash,
        [string]$CatalogHash,
        [string]$HeadSha,
        [bool]$Dirty
    )
    $p = New-OrdinalMap
    $p['schemaVersion'] = [int64]1
    $p['result'] = $Result
    $p['exitCode'] = [int64]$ExitCode
    $p['idleCode'] = $IdleCode
    $sList = New-Object System.Collections.ArrayList
    foreach ($x in (ConvertTo-ArrayList $S)) { [void]$sList.Add([string]$x) }
    $p['admissibleForcingCandidates'] = $sList
    $rList = New-Object System.Collections.ArrayList
    foreach ($x in (ConvertTo-ArrayList $Rejected)) { [void]$rList.Add($x) }
    $p['rejectedCandidates'] = $rList
    $ih = New-OrdinalMap
    $ih['occupancyHash'] = $OccHash
    $ih['sidecarSha256'] = $SidecarHash
    $ih['mutexCatalogSha256'] = $CatalogHash
    $p['inputHashes'] = $ih
    $p['headSha'] = $HeadSha
    $p['workingTreeDirty'] = $Dirty
    return $p
}

function Assert-LaneObject {
    param($Lane)
    if (-not (Test-IsMap $Lane)) { throw 'MALFORMED' }
    Assert-ClosedKeys $Lane $script:LaneKeys
    Assert-RequiredKeys $Lane $script:LaneKeys
    $st = $Lane['state']
    if ($st -cne 'EMPTY' -and $st -cne 'ACTIVE' -and $st -cne 'LANE-DONE') { throw 'MALFORMED' }
    if ($Lane['taskId'] -isnot [string]) { throw 'MALFORMED' }
    if ($Lane['i18n'] -isnot [bool]) { throw 'MALFORMED' }
    if ($Lane['exclusiveCapacity'] -isnot [bool]) { throw 'MALFORMED' }
    if (-not (Test-StringArray $Lane['mutexes'])) { throw 'MALFORMED' }
    if (-not (Test-StringArray $Lane['writePaths'])) { throw 'MALFORMED' }
    if (-not (Test-StringArray $Lane['hotfiles'])) { throw 'MALFORMED' }
    if (-not (Test-StringArray $Lane['sharedContractIds'])) { throw 'MALFORMED' }
    if (-not (Test-StringArray $Lane['mutatesSharedContractIds'])) { throw 'MALFORMED' }
    if (-not (Test-StringArray $Lane['runtimeNeeds'])) { throw 'MALFORMED' }
    $ev = $Lane['evidenceClass']
    if ($ev -cne 'NONE' -and $ev -cne 'LOCAL-TESTS' -and $ev -cne 'LOCAL-RUNTIME' -and $ev -cne 'STAGING-RUNTIME' -and $ev -cne 'PROVIDER-LIVE') {
        throw 'MALFORMED'
    }
}

function Assert-CandidateObject {
    param($C)
    if (-not (Test-IsMap $C)) { throw 'MALFORMED' }
    Assert-ClosedKeys $C $script:CandidateKeys
    Assert-RequiredKeys $C $script:CandidateKeys
    if ($C['taskId'] -isnot [string] -or -not (Test-TaskId ([string]$C['taskId']))) { throw 'MALFORMED' }
    $nat = [string]$C['nature']
    if ($nat -cne 'IMPLEMENTATION' -and $nat -cne 'GOVERNANCE') { throw 'MALFORMED' }
    $lc = [string]$C['lifecycle']
    if ($lc -cne '2-STEP' -and $lc -cne '3-STEP' -and $lc -cne '4-STEP') { throw 'MALFORMED' }
    $st = [string]$C['status']
    $okSt = @('READY', 'ADMITTED', 'LANE-DONE', 'LOCKED', 'REJECTED', 'RETURN-TO-READY', 'PARKED', 'PROHIBITED')
    if ($okSt -notcontains $st) { throw 'MALFORMED' }
    $sc = [string]$C['startCondition']
    if ($sc -cne 'READY' -and $sc -cne 'NOT_READY') { throw 'MALFORMED' }
    $sat = [string]$C['saturationClass']
    if ($sat -cne 'FORCING' -and $sat -cne 'OPTIONAL') { throw 'MALFORMED' }
    $pc = [string]$C['productClass']
    $okPc = @('CURRENT', 'LIMITED_PRIVATE_BETA', 'APPROVED_FUTURE', 'PARKED', 'PROHIBITED')
    if ($okPc -notcontains $pc) { throw 'MALFORMED' }
    $fa = [string]$C['futureAuthorization']
    if ($fa -cne 'NONE' -and $fa -cne 'AUTHORIZED') { throw 'MALFORMED' }
    if ($C['i18n'] -isnot [bool]) { throw 'MALFORMED' }
    if ($C['exclusiveCapacity'] -isnot [bool]) { throw 'MALFORMED' }
    if ($C['admissionUncertain'] -isnot [bool]) { throw 'MALFORMED' }
    $wsp = [string]$C['writeSetPrecision']
    if ($wsp -cne 'PROVISIONAL' -and $wsp -cne 'EXACT') { throw 'MALFORMED' }
    $ev = [string]$C['evidenceClass']
    if ($ev -cne 'LOCAL-TESTS' -and $ev -cne 'LOCAL-RUNTIME' -and $ev -cne 'STAGING-RUNTIME' -and $ev -cne 'PROVIDER-LIVE') {
        throw 'MALFORMED'
    }
    if (-not (Test-StringArray $C['dependsOn'])) { throw 'MALFORMED' }
    if (-not (Test-StringArray $C['mutexes'])) { throw 'MALFORMED' }
    if (-not (Test-StringArray $C['writePaths'])) { throw 'MALFORMED' }
    if (-not (Test-StringArray $C['hotfiles'])) { throw 'MALFORMED' }
    if (-not (Test-StringArray $C['sharedContractIds'])) { throw 'MALFORMED' }
    if (-not (Test-StringArray $C['mutatesSharedContractIds'])) { throw 'MALFORMED' }
    if (-not (Test-StringArray $C['runtimeNeeds'])) { throw 'MALFORMED' }
    foreach ($r in (ConvertTo-ArrayList $C['runtimeNeeds'])) {
        if ($script:ResourceIds -notcontains [string]$r) { throw 'MALFORMED' }
    }
}

function Derive-Idle {
    param($Occ, $Candidates, $S)
    foreach ($name in @('lane1', 'lane2')) {
        $ln = $Occ[$name]
        if ([string]$ln['state'] -ne 'EMPTY' -and [bool]$ln['exclusiveCapacity']) {
            return 'EXCLUSIVE_CAPACITY_HELD'
        }
    }
    $anyForcing = $false
    foreach ($c in (ConvertTo-ArrayList $Candidates)) {
        if ([string]$c['saturationClass'] -eq 'FORCING') { $anyForcing = $true }
    }
    if (-not $anyForcing) { return 'NO_FORCING_CANDIDATES' }
    return 'NO_PAIRWISE_ADMISSIBLE_CANDIDATE'
}

# ===================== MAIN =====================

try {
    $tasksText = Read-Utf8File $TasksPath
    $stateText = Read-Utf8File $StatePath
    $catalogText = Read-Utf8File $CatalogPath
} catch {
    Fail-Exit1 'IO'
}

try {
    $boardMap = Parse-OccupancyBlock $tasksText
    $board = Convert-BoardOccupancy $boardMap
} catch {
    Fail-Exit1 'MALFORMED'
}

try {
    $state = Parse-JsonStrict $stateText
    $catalogRoot = Parse-JsonStrict $catalogText
} catch {
    Fail-Exit1 'MALFORMED'
}

try {
    Load-Catalog $catalogRoot
} catch {
    Fail-Exit1 'MALFORMED'
}

$unreg = $false
$dup = $false
$occLane3 = $false

try {
    if (-not (Test-IsMap $state)) { throw 'MALFORMED' }
    foreach ($k in (Get-MapKeys $state)) {
        $known = $false
        foreach ($ok in $script:SidecarRootKeys) { if ($k -eq $ok) { $known = $true; break } }
        if (-not $known) { throw 'UNKNOWN_PROPERTY' }
    }
    Assert-RequiredKeys $state $script:SidecarRootKeys

    if ($state['schemaVersion'] -isnot [int64] -or [int64]$state['schemaVersion'] -ne 1) { throw 'MALFORMED' }
    if ($state['maxImplementationLanes'] -isnot [int64]) { throw 'MALFORMED' }
    if ([int64]$state['maxImplementationLanes'] -ne 2) { $script:CapacityFail = $true }
    if ($state['lane3'] -isnot [string]) { throw 'MALFORMED' }
    if ([string]$state['lane3'] -cne 'DISABLED') { $script:CapacityFail = $true }
    if ($state['saturationSuspended'] -isnot [bool]) { throw 'MALFORMED' }
    $sr = $state['suspensionReason']
    if ($sr -cne 'NONE' -and $sr -cne 'OS_MUTATION') { throw 'MALFORMED' }
    $susp = [bool]$state['saturationSuspended']
    if ($susp -and $sr -cne 'OS_MUTATION') { throw 'MALFORMED' }
    if ((-not $susp) -and $sr -cne 'NONE') { throw 'MALFORMED' }

    $gov = $state['governance']
    if (-not (Test-IsMap $gov)) { throw 'MALFORMED' }
    Assert-ClosedKeys $gov @('owner', 'state')
    Assert-RequiredKeys $gov @('owner', 'state')
    if ($gov['owner'] -isnot [string] -or $gov['state'] -isnot [string]) { throw 'MALFORMED' }
    if ($gov['state'] -cne 'UNOWNED' -and $gov['state'] -cne 'ACTIVE') { throw 'MALFORMED' }
    if ($gov['state'] -eq 'UNOWNED' -and $gov['owner'] -cne 'NONE') { throw 'MALFORMED' }
    if ($gov['state'] -eq 'ACTIVE' -and -not (Test-TaskId ([string]$gov['owner']))) { throw 'MALFORMED' }

    $rt = $state['runtimeAuthorization']
    if (-not (Test-IsMap $rt)) { throw 'MALFORMED' }
    Assert-ClosedKeys $rt @('localRuntimeAuthorized', 'stagingAuthorized', 'providerLiveAuthorized', 'creditAuthorized')
    Assert-RequiredKeys $rt @('localRuntimeAuthorized', 'stagingAuthorized', 'providerLiveAuthorized', 'creditAuthorized')
    foreach ($rk in @('localRuntimeAuthorized', 'stagingAuthorized', 'providerLiveAuthorized', 'creditAuthorized')) {
        if ($rt[$rk] -isnot [bool]) { throw 'MALFORMED' }
    }
    $script:RuntimeAuth = $rt

    $occ = $state['occupancy']
    if (-not (Test-IsMap $occ)) { throw 'MALFORMED' }
    foreach ($k in (Get-MapKeys $occ)) {
        if ($k -eq 'lane3' -or $k -eq 'lane3Occupancy') { $occLane3 = $true; continue }
        if ($k -ne 'lane1' -and $k -ne 'lane2') { throw 'UNKNOWN_PROPERTY' }
    }
    if (-not $occ.ContainsKey('lane1') -or -not $occ.ContainsKey('lane2')) { throw 'MISSING' }
    if ($occLane3) { $script:CapacityFail = $true }
    Assert-LaneObject $occ['lane1']
    Assert-LaneObject $occ['lane2']

    $l1 = $occ['lane1']; $l2 = $occ['lane2']
    foreach ($ln in @($l1, $l2)) {
        $st = [string]$ln['state']
        $tid = [string]$ln['taskId']
        if ($st -eq 'EMPTY') { Assert-EmptyLane $ln }
        else { Assert-OccupiedLaneShape $ln }
    }
    if ([string]$l1['state'] -eq 'EMPTY' -and [string]$l1['taskId'] -cne 'NONE') { throw 'MALFORMED' }
    if ([string]$l2['state'] -eq 'EMPTY' -and [string]$l2['taskId'] -cne 'NONE') { throw 'MALFORMED' }
    if ([string]$l1['taskId'] -cne 'NONE' -and [string]$l1['taskId'] -eq [string]$l2['taskId']) { throw 'MALFORMED' }

    $locked = ConvertTo-ArrayList $state['lockedTaskIds']
    $lockedSet = New-StringSet
    foreach ($id in $locked) {
        if ($id -isnot [string] -or -not (Test-TaskId ([string]$id))) { throw 'MALFORMED' }
        if (-not $lockedSet.Add([string]$id)) { throw 'MALFORMED' }
    }

    $contracts = ConvertTo-ArrayList $state['sharedContracts']
    $script:ContractRegistry = New-OrdinalMap
    foreach ($c in $contracts) {
        if (-not (Test-IsMap $c)) { throw 'MALFORMED' }
        Assert-ClosedKeys $c @('id', 'state', 'paths')
        Assert-RequiredKeys $c @('id', 'state', 'paths')
        if ($c['id'] -isnot [string] -or -not (Test-ContractId ([string]$c['id']))) { throw 'MALFORMED' }
        if ($c['state'] -cne 'FROZEN' -and $c['state'] -cne 'UNFROZEN') { throw 'MALFORMED' }
        if (-not (Test-StringArray $c['paths'])) { throw 'MALFORMED' }
        foreach ($p in (ConvertTo-ArrayList $c['paths'])) { $null = Normalize-WritePath ([string]$p) }
        if ($script:ContractRegistry.ContainsKey([string]$c['id'])) { throw 'MALFORMED' }
        $script:ContractRegistry[[string]$c['id']] = $c
    }

    $cands = ConvertTo-ArrayList $state['candidates']
    $candById = New-OrdinalMap
    foreach ($c in $cands) {
        Assert-CandidateObject $c
        $id = [string]$c['taskId']
        if ($candById.ContainsKey($id)) { $dup = $true; throw 'DUPLICATE_ID' }
        $candById[$id] = $c
        Assert-RecordIntra $c $true
    }

    foreach ($pair in @(@('lane1', $l1), @('lane2', $l2))) {
        $ln = $pair[1]
        if ([string]$ln['state'] -eq 'EMPTY') { continue }
        Assert-RecordIntra $ln $false
        $tid = [string]$ln['taskId']
        if (-not $candById.ContainsKey($tid)) { $unreg = $true; throw 'UNREGISTERED' }
        $cand = $candById[$tid]
        $wantStatus = 'ADMITTED'
        if ([string]$ln['state'] -eq 'LANE-DONE') { $wantStatus = 'LANE-DONE' }
        if ([string]$cand['status'] -cne $wantStatus) { throw 'MALFORMED' }
        if (-not (Test-OccupiedMatchesCandidate $ln $cand)) { throw 'MALFORMED' }
    }
} catch {
    $m = [string]$_.Exception.Message
    if ($dup) { Fail-Exit1 'DUPLICATE_ID' }
    if ($unreg) { Fail-Exit1 'UNREGISTERED' }
    if ($m -eq 'UNKNOWN_PROPERTY') { Fail-Exit1 'MALFORMED' }
    Fail-Exit1 'MALFORMED'
}

if ($script:CapacityFail) {
    # capacity after schema
}

# hashes
$sidecarHash = Get-Sha256Hex (Get-CanonicalJson $state)
$catalogHash = Get-Sha256Hex (Get-CanonicalJson $catalogRoot)
$sidecarSubset = Get-SidecarSubset $state
$hBoardField = [string]$board['hashField']
$hBoardFacts = Get-Sha256Hex (Get-CanonicalJson $board['subset'])
$hSidecarFacts = Get-Sha256Hex (Get-CanonicalJson $sidecarSubset)
$git = Get-GitFacts $RepoRoot

$emptyS = New-Object System.Collections.ArrayList
$emptyR = New-Object System.Collections.ArrayList

if ($script:CapacityFail) {
    $proof = New-Proof 'FAIL' 4 'NONE' $emptyS $emptyR $hSidecarFacts $sidecarHash $catalogHash $git['headSha'] $git['workingTreeDirty']
    Save-Proof $proof $ProofPath 4
}

if ($hBoardField -ne $hBoardFacts -or $hBoardFacts -ne $hSidecarFacts) {
    $proof = New-Proof 'FAIL' 3 'NONE' $emptyS $emptyR $hBoardFacts $sidecarHash $catalogHash $git['headSha'] $git['workingTreeDirty']
    Save-Proof $proof $ProofPath 3
}

$occ = $state['occupancy']
$occCount = 0
if ([string]$occ['lane1']['state'] -ne 'EMPTY') { $occCount++ }
if ([string]$occ['lane2']['state'] -ne 'EMPTY') { $occCount++ }

if ([bool]$state['saturationSuspended']) {
    if ($occCount -ne 0) {
        $proof = New-Proof 'FAIL' 5 'NONE' $emptyS $emptyR $hSidecarFacts $sidecarHash $catalogHash $git['headSha'] $git['workingTreeDirty']
        Save-Proof $proof $ProofPath 5
    } else {
        $proof = New-Proof 'PASS' 0 'OS_MUTATION_QUIESCENCE' $emptyS $emptyR $hSidecarFacts $sidecarHash $catalogHash $git['headSha'] $git['workingTreeDirty']
        Save-Proof $proof $ProofPath 0
    }
}

# pairwise occupied
if ($occCount -eq 2) {
    $ex = [bool]$occ['lane1']['exclusiveCapacity'] -or [bool]$occ['lane2']['exclusiveCapacity']
    $pairCode = 'OK'
    if ($ex) { $pairCode = 'EXCLUSIVE_CAPACITY' }
    else { $pairCode = Get-Conflict $occ['lane1'] $occ['lane2'] }
    if ($pairCode -ne 'OK') {
        $proof = New-Proof 'FAIL' 2 'NONE' $emptyS $emptyR $hSidecarFacts $sidecarHash $catalogHash $git['headSha'] $git['workingTreeDirty']
        Save-Proof $proof $ProofPath 2
    }
}

$S = New-Object System.Collections.Generic.List[string]
$rejected = New-Object System.Collections.ArrayList
$lockedSet2 = New-StringSet
foreach ($id in (ConvertTo-ArrayList $state['lockedTaskIds'])) { [void]$lockedSet2.Add([string]$id) }

foreach ($c in (ConvertTo-ArrayList $state['candidates'])) {
    $r = Test-Admissible $c $occ $lockedSet2
    if ($r -eq 'SKIP') { continue }
    if ($r -eq 'OK') {
        $S.Add([string]$c['taskId'])
    } else {
        $row = New-OrdinalMap
        $row['taskId'] = [string]$c['taskId']
        $row['code'] = $r
        [void]$rejected.Add($row)
    }
}
$S.Sort([System.StringComparer]::Ordinal)
$rejSorted = New-Object System.Collections.ArrayList
$rejIds = New-Object System.Collections.Generic.List[string]
foreach ($row in $rejected) { $rejIds.Add([string]$row['taskId']) }
$rejIds.Sort([System.StringComparer]::Ordinal)
foreach ($id in $rejIds) {
    foreach ($row in $rejected) {
        if ([string]$row['taskId'] -eq $id) { [void]$rejSorted.Add($row); break }
    }
}

$free = 2 - $occCount
$Sarr = New-Object System.Collections.ArrayList
foreach ($id in $S) { [void]$Sarr.Add($id) }

if ($free -eq 0) {
    $proof = New-Proof 'PASS' 0 'CAPACITY_FULL' $Sarr $rejSorted $hSidecarFacts $sidecarHash $catalogHash $git['headSha'] $git['workingTreeDirty']
    Save-Proof $proof $ProofPath 0
}

if ($S.Count -gt 0) {
    $proof = New-Proof 'FAIL' 2 'NONE' $Sarr $rejSorted $hSidecarFacts $sidecarHash $catalogHash $git['headSha'] $git['workingTreeDirty']
    Save-Proof $proof $ProofPath 2
}

$idle = Derive-Idle $occ $state['candidates'] $S
$proof = New-Proof 'PASS' 0 $idle $Sarr $rejSorted $hSidecarFacts $sidecarHash $catalogHash $git['headSha'] $git['workingTreeDirty']
Save-Proof $proof $ProofPath 0
