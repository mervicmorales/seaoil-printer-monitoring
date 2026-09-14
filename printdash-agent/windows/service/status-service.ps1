. (Join-Path $PSScriptRoot "service-common.ps1")
Assert-Administrator

$service = Get-SEAOILService
if ($null -eq $service) {
    Write-Host "$script:ServiceDisplayName is not installed."
    exit 1
}
$details = Get-CimInstance -ClassName Win32_Service -Filter "Name='$script:ServiceId'"
$startupType = if ($details.StartMode -eq "Auto") { "Automatic" } else { $details.StartMode }
Write-Host "Name:         $($service.DisplayName)"
Write-Host "Status:       $($service.Status)"
Write-Host "Startup Type: $startupType"
Write-Host "Executable:   $($details.PathName)"
