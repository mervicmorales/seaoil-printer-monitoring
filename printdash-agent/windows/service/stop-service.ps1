. (Join-Path $PSScriptRoot "service-common.ps1")
Assert-Administrator

$service = Get-SEAOILService
if ($null -eq $service) { throw "$script:ServiceDisplayName is not installed." }
if ($service.Status -eq "Stopped") {
    Write-Host "$script:ServiceDisplayName is already stopped."
    return
}
Stop-Service -Name $script:ServiceId
Wait-SEAOILServiceStatus -Status Stopped | Out-Null
Write-Host "$script:ServiceDisplayName stopped cleanly."
