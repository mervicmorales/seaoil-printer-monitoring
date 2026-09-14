param(
    [int]$Port = 3003
)

. (Join-Path $PSScriptRoot "service-common.ps1")
Assert-Administrator

$service = Get-SEAOILService
if ($null -eq $service) { throw "$script:ServiceDisplayName is not installed." }
if ($service.Status -ne "Running") { throw "$script:ServiceDisplayName is $($service.Status), not Running." }

$healthUrl = "http://127.0.0.1:$Port/health"
try {
    $health = Invoke-RestMethod -Method Get -Uri $healthUrl -TimeoutSec 10
} catch {
    throw "The service is running, but its local health endpoint did not respond at $healthUrl. Check the WinSW logs."
}
if ($health.status -ne "ok") {
    throw "The health endpoint returned status '$($health.status)'."
}
Write-Host "$script:ServiceDisplayName passed the local health check."
Write-Host "Version: $($health.version)"
Write-Host "Uptime:  $($health.uptimeSeconds) seconds"
