. (Join-Path $PSScriptRoot "service-common.ps1")
Assert-Administrator

$service = Get-SEAOILService
if ($null -eq $service) { throw "$script:ServiceDisplayName is not installed." }
if ($service.Status -ne "Stopped") {
    Stop-Service -Name $script:ServiceId
    Wait-SEAOILServiceStatus -Status Stopped | Out-Null
}
Start-Service -Name $script:ServiceId
Wait-SEAOILServiceStatus -Status Running | Out-Null
Write-Host "$script:ServiceDisplayName restarted successfully."
