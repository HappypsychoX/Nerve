<#
.SYNOPSIS
    Read-only, privacy-preserving verification of Jellyfin's public-info and
    session endpoints for the Nerve v1.1 verification gate.

.DESCRIPTION
    Performs GET requests only. It never follows redirects, writes response
    data to disk, or prints credentials or session values. Output is limited
    to HTTP status/version, aggregate session counts, filter comparisons, and
    boolean/type observations about selected response fields.

    Credential lookup order:
      1. JELLYFIN_API_KEY in the current PowerShell process environment.
      2. JELLYFIN_API_KEY in the current Windows User environment.
      3. A hidden secure prompt, if neither environment variable is set.

.PARAMETER BaseUrl
    Jellyfin server base URL. Defaults to http://192.168.40.186:8096.

.PARAMETER Include300SecondWindow
    Also request /Sessions?activeWithinSeconds=300 for an additional comparison.

.PARAMETER TimeoutSeconds
    Per-request timeout, from 1 to 30 seconds. Defaults to 5 seconds.

.EXAMPLE
    .\scripts\Verify-JellyfinApi.ps1

.EXAMPLE
    .\scripts\Verify-JellyfinApi.ps1 -Include300SecondWindow

.EXAMPLE
    .\scripts\Verify-JellyfinApi.ps1 -BaseUrl 'http://192.168.40.186:8096' -Include300SecondWindow
#>
[CmdletBinding()]
param(
    [Parameter()]
    [string]$BaseUrl = 'http://192.168.40.186:8096',

    [Parameter()]
    [switch]$Include300SecondWindow,

    [Parameter()]
    [ValidateRange(1, 30)]
    [int]$TimeoutSeconds = 5
)

$ErrorActionPreference = 'Stop'

function Get-PropertyValue {
    param(
        [AllowNull()][object]$InputObject,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if ($null -eq $InputObject) { return $null }
    $property = $InputObject.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Get-ValueTypeName {
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) { return 'null' }
    if ($Value -is [System.Array]) { return 'Array' }
    return $Value.GetType().Name
}

function Invoke-JellyfinGet {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [AllowNull()][string]$ApiKey,
        [Parameter(Mandatory = $true)][int]$TimeoutMilliseconds
    )

    $request = $null
    $response = $null
    $body = $null
    $data = $null
    $statusCode = $null
    $isJsonArray = $false
    $jsonValid = $false
    $failure = $null

    try {
        $request = [System.Net.HttpWebRequest]::Create($Uri)
        $request.Method = 'GET'
        $request.AllowAutoRedirect = $false
        $request.Timeout = $TimeoutMilliseconds
        $request.ReadWriteTimeout = $TimeoutMilliseconds
        $request.KeepAlive = $false
        $request.Accept = 'application/json'

        if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
            $request.Headers['Authorization'] = 'MediaBrowser Token="' + $ApiKey + '"'
        }

        $response = [System.Net.HttpWebResponse]$request.GetResponse()
        $statusCode = [int]$response.StatusCode
        if ($statusCode -eq 200) {
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            try {
                $body = $reader.ReadToEnd()
            }
            finally {
                $reader.Dispose()
            }

            try {
                $trimmedBody = $body.TrimStart()
                $isJsonArray = $trimmedBody.StartsWith('[')
                if ($isJsonArray -and $trimmedBody -eq '[]') {
                    $data = @()
                    $jsonValid = $true
                }
                else {
                    $parsed = ConvertFrom-Json -InputObject $body -ErrorAction Stop
                    if ($isJsonArray) {
                        $data = @($parsed)
                        $jsonValid = $true
                    }
                    else {
                        $data = $parsed
                        $jsonValid = $true
                    }
                }
            }
            catch {
                # Do not echo parser errors: they can include response content.
                $failure = 'invalid_json'
            }
        }
        else {
            $failure = 'http_status'
        }
    }
    catch [System.Net.WebException] {
        if ($null -ne $_.Exception.Response) {
            try {
                $response = [System.Net.HttpWebResponse]$_.Exception.Response
                $statusCode = [int]$response.StatusCode
                $failure = 'http_status'
            }
            catch {
                $failure = 'request_failed'
            }
        }
        else {
            $failure = 'network_or_timeout'
        }
    }
    catch {
        # Do not echo exception details, request headers, or response content.
        $failure = 'request_failed'
    }
    finally {
        if ($null -ne $response) {
            try { $response.Close() } catch { }
        }
        $body = $null
    }

    return [pscustomobject]@{
        StatusCode  = $statusCode
        Data        = $data
        IsJsonArray = $isJsonArray
        JsonValid   = $jsonValid
        Failure     = $failure
    }
}

function Get-SessionState {
    param([Parameter(Mandatory = $true)][object]$Session)

    $item = Get-PropertyValue -InputObject $Session -Name 'NowPlayingItem'
    if ($null -eq $item) { return 'idle' }
    $playState = Get-PropertyValue -InputObject $Session -Name 'PlayState'
    $paused = Get-PropertyValue -InputObject $playState -Name 'IsPaused'
    if ($paused -eq $true) { return 'paused' }
    return 'playing'
}

function Get-SessionCounts {
    param([object[]]$Sessions)

    $playing = 0
    $paused = 0
    $idle = 0
    foreach ($session in $Sessions) {
        switch (Get-SessionState -Session $session) {
            'playing' { $playing++ }
            'paused' { $paused++ }
            default { $idle++ }
        }
    }
    return [pscustomobject]@{ Playing = $playing; Paused = $paused; Idle = $idle }
}

function Test-AnonymousSession {
    param([Parameter(Mandatory = $true)][object]$Session)

    $userName = Get-PropertyValue -InputObject $Session -Name 'UserName'
    $userId = Get-PropertyValue -InputObject $Session -Name 'UserId'
    if ([string]::IsNullOrWhiteSpace([string]$userName) -and
        [string]::IsNullOrWhiteSpace([string]$userId)) {
        return $true
    }
    if ([string]::Equals([string]$userName, 'Anonymous', [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }
    return $false
}

function Get-SessionFieldObservation {
    param(
        [object[]]$Sessions,
        [Parameter(Mandatory = $true)][string]$Field
    )

    $present = 0
    $types = @{}
    foreach ($session in $Sessions) {
        $property = $session.PSObject.Properties[$Field]
        if ($null -ne $property) {
            $present++
            $typeName = Get-ValueTypeName -Value $property.Value
            $types[$typeName] = $true
        }
    }
    return [pscustomobject]@{
        Present = $present
        Types = (@($types.Keys | Sort-Object) -join '|')
    }
}

function Get-NestedFieldObservation {
    param(
        [object[]]$Sessions,
        [Parameter(Mandatory = $true)][string]$ParentField,
        [Parameter(Mandatory = $true)][string]$ChildField,
        [switch]$RequirePlayingItem
    )

    $present = 0
    $types = @{}
    foreach ($session in $Sessions) {
        if ($RequirePlayingItem -and $null -eq (Get-PropertyValue -InputObject $session -Name 'NowPlayingItem')) {
            continue
        }
        $parent = Get-PropertyValue -InputObject $session -Name $ParentField
        $property = if ($null -ne $parent) { $parent.PSObject.Properties[$ChildField] } else { $null }
        if ($null -ne $property) {
            $present++
            $typeName = Get-ValueTypeName -Value $property.Value
            $types[$typeName] = $true
        }
    }
    return [pscustomobject]@{
        Present = $present
        Types = (@($types.Keys | Sort-Object) -join '|')
    }
}

function Get-LastActivityAgeSeconds {
    param([Parameter(Mandatory = $true)][object]$Session)

    $value = Get-PropertyValue -InputObject $Session -Name 'LastActivityDate'
    if ($null -eq $value) { return $null }
    $parsed = [DateTimeOffset]::MinValue
    $ok = [DateTimeOffset]::TryParse([string]$value, [ref]$parsed)
    if (-not $ok) { return $null }
    return ([DateTimeOffset]::UtcNow - $parsed.ToUniversalTime()).TotalSeconds
}

try {
    $baseUri = $null
    if (-not [Uri]::TryCreate($BaseUrl, [System.UriKind]::Absolute, [ref]$baseUri) -or
        $baseUri.Scheme -notin @('http', 'https') -or
        -not [string]::IsNullOrEmpty($baseUri.UserInfo) -or
        -not [string]::IsNullOrEmpty($baseUri.Query) -or
        -not [string]::IsNullOrEmpty($baseUri.Fragment)) {
        Write-Output 'ERROR: BaseUrl must be an absolute HTTP or HTTPS URL without embedded credentials, query, or fragment.'
        exit 2
    }
    $base = $BaseUrl.TrimEnd('/')
    $timeoutMilliseconds = $TimeoutSeconds * 1000

    $apiKey = [Environment]::GetEnvironmentVariable('JELLYFIN_API_KEY', 'Process')
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        $apiKey = [Environment]::GetEnvironmentVariable('JELLYFIN_API_KEY', 'User')
    }

    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        try {
            $secureKey = Read-Host -Prompt 'Enter Jellyfin verification API key (input hidden)' -AsSecureString
            if ($null -eq $secureKey -or $secureKey.Length -eq 0) {
                Write-Output 'ERROR: No API key was provided. Set JELLYFIN_API_KEY in the process or Windows User environment, or run interactively and enter it at the secure prompt.'
                exit 2
            }
            $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
            try {
                $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
            }
            finally {
                [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
            }
        }
        catch {
            Write-Output 'ERROR: No API key is available and a secure interactive prompt could not be used. Set JELLYFIN_API_KEY in the process or Windows User environment, then rerun.'
            exit 2
        }
    }

    $publicResult = Invoke-JellyfinGet -Uri ($base + '/System/Info/Public') -ApiKey $null -TimeoutMilliseconds $timeoutMilliseconds
    if ($publicResult.StatusCode -eq 200 -and $publicResult.JsonValid) {
        $version = Get-PropertyValue -InputObject $publicResult.Data -Name 'Version'
        if ([string]::IsNullOrWhiteSpace([string]$version)) { $version = '<not returned>' }
        Write-Output ('PublicInfo: HTTP 200; Version=' + [string]$version)
    }
    else {
        $publicStatus = if ($null -eq $publicResult.StatusCode) { $publicResult.Failure } else { [string]$publicResult.StatusCode }
        Write-Output ('PublicInfo: Failed; Status=' + $publicStatus)
    }

    $windows = @(
        [pscustomobject]@{ Name = 'All'; Query = '' },
        [pscustomobject]@{ Name = 'ActiveWithin960'; Query = '?activeWithinSeconds=960' }
    )
    if ($Include300SecondWindow) {
        $windows += [pscustomobject]@{ Name = 'ActiveWithin300'; Query = '?activeWithinSeconds=300' }
    }

    $responses = @{}
    foreach ($window in $windows) {
        $result = Invoke-JellyfinGet -Uri ($base + '/Sessions' + $window.Query) -ApiKey $apiKey -TimeoutMilliseconds $timeoutMilliseconds
        $responses[$window.Name] = $result
        $status = if ($null -eq $result.StatusCode) { [string]$result.Failure } else { [string]$result.StatusCode }
        if ($result.StatusCode -eq 200 -and $result.JsonValid -and $result.IsJsonArray) {
            $sessions = @($result.Data)
            $counts = Get-SessionCounts -Sessions $sessions
            $anonymousCount = @($sessions | Where-Object { Test-AnonymousSession -Session $_ }).Count
            Write-Output ('Sessions[' + $window.Name + ']: HTTP 200; Count=' + $sessions.Count + '; Playing=' + $counts.Playing + '; Paused=' + $counts.Paused + '; Idle=' + $counts.Idle + '; AnonymousOrMissingIdentityObserved=' + [bool]($anonymousCount -gt 0))
        }
        elseif ($result.StatusCode -eq 200) {
            Write-Output ('Sessions[' + $window.Name + ']: HTTP 200; ResponseShape=not_json_array')
        }
        else {
            Write-Output ('Sessions[' + $window.Name + ']: Failed; Status=' + $status)
        }
    }

    $allResult = $responses['All']
    $filteredResult = $responses['ActiveWithin960']
    if ($allResult.StatusCode -eq 200 -and $allResult.JsonValid -and $allResult.IsJsonArray -and
        $filteredResult.StatusCode -eq 200 -and $filteredResult.JsonValid -and $filteredResult.IsJsonArray) {
        $allSessions = @($allResult.Data)
        $filteredSessions = @($filteredResult.Data)
        $allKeys = @{}
        $filteredKeys = @{}
        $allKeysComplete = $true
        $filteredKeysComplete = $true
        foreach ($session in $allSessions) {
            $sessionKey = Get-PropertyValue -InputObject $session -Name 'Id'
            if ([string]::IsNullOrWhiteSpace([string]$sessionKey)) { $allKeysComplete = $false }
            else { $allKeys[[string]$sessionKey] = $true }
        }
        foreach ($session in $filteredSessions) {
            $sessionKey = Get-PropertyValue -InputObject $session -Name 'Id'
            if ([string]::IsNullOrWhiteSpace([string]$sessionKey)) { $filteredKeysComplete = $false }
            else { $filteredKeys[[string]$sessionKey] = $true }
        }

        $subset = $null
        $removed = @()
        if ($allKeysComplete -and $filteredKeysComplete) {
            $subset = $true
            foreach ($keyValue in $filteredKeys.Keys) {
                if (-not $allKeys.ContainsKey($keyValue)) { $subset = $false }
            }
            if ($subset) {
                foreach ($session in $allSessions) {
                    $sessionKey = [string](Get-PropertyValue -InputObject $session -Name 'Id')
                    if (-not $filteredKeys.ContainsKey($sessionKey)) { $removed += $session }
                }
            }
        }

        if ($null -eq $subset) { $subsetText = 'unverifiable' } else { $subsetText = [string]$subset }
        Write-Output ('Filter960: Accepted=True; FilterIsSubsetOfUnfiltered=' + $subsetText + '; Removed=' + $removed.Count)

        if ($null -eq $subset -or -not $subset) {
            Write-Output 'Filter960Difference: unverified because session-set comparison was unavailable or inconsistent'
            Write-Output 'IdleExpiryEvidence: insufficient; unable to compare matched session sets'
        }
        else {
            $removedCounts = Get-SessionCounts -Sessions $removed
            Write-Output ('Filter960Difference: RemovedPlaying=' + $removedCounts.Playing + '; RemovedPaused=' + $removedCounts.Paused + '; RemovedIdle=' + $removedCounts.Idle)
            $unfilteredCounts = Get-SessionCounts -Sessions $allSessions
            if ($unfilteredCounts.Idle -eq 0) {
                Write-Output 'IdleExpiryEvidence: insufficient activity; unfiltered response contained no idle sessions'
            }
            else {
                $oldIdleRemoved = 0
                foreach ($session in $removed) {
                    if ((Get-SessionState -Session $session) -eq 'idle') {
                        $ageSeconds = Get-LastActivityAgeSeconds -Session $session
                        if ($null -ne $ageSeconds -and $ageSeconds -ge 960) { $oldIdleRemoved++ }
                    }
                }
                $idleRemaining = @($filteredSessions | Where-Object { (Get-SessionState -Session $_) -eq 'idle' }).Count
                if ($oldIdleRemoved -gt 0) {
                    Write-Output ('IdleExpiryEvidence: observed; removed idle sessions with LastActivityDate at least 960 seconds old=' + $oldIdleRemoved)
                }
                elseif ($removedCounts.Idle -gt 0) {
                    Write-Output 'IdleExpiryEvidence: idle sessions were removed, but their LastActivityDate did not establish age >= 960 seconds'
                }
                elseif ($idleRemaining -gt 0) {
                    Write-Output 'IdleExpiryEvidence: insufficient; idle sessions remain and none were observed expiring'
                }
                else {
                    Write-Output 'IdleExpiryEvidence: no idle sessions were removed in this snapshot; expiry behavior remains unproven'
                }
            }
        }

        $total = $allSessions.Count
        $nowPlayingObservation = Get-SessionFieldObservation -Sessions $allSessions -Field 'NowPlayingItem'
        $playStateObservation = Get-SessionFieldObservation -Sessions $allSessions -Field 'PlayState'
        $transcodingObservation = Get-SessionFieldObservation -Sessions $allSessions -Field 'TranscodingInfo'
        $lastActivityObservation = Get-SessionFieldObservation -Sessions $allSessions -Field 'LastActivityDate'
        $pausedObservation = Get-NestedFieldObservation -Sessions $allSessions -ParentField 'PlayState' -ChildField 'IsPaused'
        $playMethodObservation = Get-NestedFieldObservation -Sessions $allSessions -ParentField 'PlayState' -ChildField 'PlayMethod'
        $positionObservation = Get-NestedFieldObservation -Sessions $allSessions -ParentField 'PlayState' -ChildField 'PositionTicks'
        $runtimeObservation = Get-NestedFieldObservation -Sessions $allSessions -ParentField 'NowPlayingItem' -ChildField 'RunTimeTicks' -RequirePlayingItem
        $reasonsObservation = Get-NestedFieldObservation -Sessions $allSessions -ParentField 'TranscodingInfo' -ChildField 'TranscodeReasons'

        $seriesIdCount = 0; $seriesImageTagCount = 0; $albumIdCount = 0; $albumImageTagCount = 0; $imageTagsCount = 0
        foreach ($session in $allSessions) {
            $item = Get-PropertyValue -InputObject $session -Name 'NowPlayingItem'
            if ($null -eq $item) { continue }
            if ($null -ne (Get-PropertyValue -InputObject $item -Name 'SeriesId')) { $seriesIdCount++ }
            if ($null -ne (Get-PropertyValue -InputObject $item -Name 'SeriesPrimaryImageTag')) { $seriesImageTagCount++ }
            if ($null -ne (Get-PropertyValue -InputObject $item -Name 'AlbumId')) { $albumIdCount++ }
            if ($null -ne (Get-PropertyValue -InputObject $item -Name 'AlbumPrimaryImageTag')) { $albumImageTagCount++ }
            if ($null -ne (Get-PropertyValue -InputObject $item -Name 'ImageTags')) { $imageTagsCount++ }
        }

        Write-Output ('FieldShape: NowPlayingItem=' + ($nowPlayingObservation.Present -gt 0) + '/' + $total + '; PlayState=' + ($playStateObservation.Present -gt 0) + '/' + $total + '; IsPausedTypes=' + $pausedObservation.Types + '; PlayMethodTypes=' + $playMethodObservation.Types)
        Write-Output ('FieldShape: TranscodingInfo=' + ($transcodingObservation.Present -gt 0) + '/' + $total + '; TranscodeReasonsTypes=' + $reasonsObservation.Types)
        Write-Output ('FieldShape: PositionTicksTypes=' + $positionObservation.Types + '; RunTimeTicksTypes=' + $runtimeObservation.Types + '; LastActivityDateTypes=' + $lastActivityObservation.Types)
        Write-Output ('ArtworkRefs: SeriesId=' + ($seriesIdCount -gt 0) + '; SeriesPrimaryImageTag=' + ($seriesImageTagCount -gt 0) + '; AlbumId=' + ($albumIdCount -gt 0) + '; AlbumPrimaryImageTag=' + ($albumImageTagCount -gt 0) + '; ImageTags=' + ($imageTagsCount -gt 0))
        Write-Output ('AnonymousSessionsObserved=' + [bool](@($allSessions | Where-Object { Test-AnonymousSession -Session $_ }).Count -gt 0))
    }
    elseif ($filteredResult.StatusCode -eq 200) {
        Write-Output 'Filter960: Accepted=False; Response was not a valid JSON array'
    }
    elseif ($filteredResult.StatusCode -ne 200) {
        Write-Output 'Filter960: Accepted=False; See sanitized HTTP status above'
    }

    $apiKey = $null
    $secureKey = $null
}
catch {
    # Keep failures actionable without exposing exception text or response data.
    Write-Output 'ERROR: Verification stopped safely. Check the BaseUrl, network reachability, PowerShell version, and credential availability; no response body or credential was displayed.'
    exit 1
}
