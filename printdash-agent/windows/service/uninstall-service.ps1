param(
    [string]$ProgramDataRoot
)

. (Join-Path $PSScriptRoot "service-common.ps1")
Assert-Administrator

if ([string]::IsNullOrWhiteSpace($ProgramDataRoot)) {
    $ProgramDataRoot = Join-Path $env:ProgramData "SEAOIL\PrinterAgent"
}
$layout = Get-SEAOILServiceLayout -ProgramDataRoot ([IO.Path]::GetFullPath($ProgramDataRoot))
$wrapper = Join-Path $layout.Service "$script:ServiceId.exe"
$service = Get-SEAOILService

if ($null -eq $service) {
    Write-Host "$script:ServiceDisplayName is not installed. Nothing was changed."
    return
}
if ($service.Status -ne "Stopped") {
    Stop-Service -Name $script:ServiceId
    Wait-SEAOILServiceStatus -Status Stopped | Out-Null
}
if (-not (Test-Path -LiteralPath $wrapper -PathType Leaf)) {
    throw "The WinSW wrapper is missing: $wrapper. Restore it before uninstalling the service."
}

Push-Location $layout.Service
try {
    & $wrapper uninstall
    if ($LASTEXITCODE -ne 0) {
        throw "WinSW could not uninstall $script:ServiceDisplayName (exit code $LASTEXITCODE)."
    }
} finally {
    Pop-Location
}

Write-Host "$script:ServiceDisplayName was uninstalled. Configuration, data, and logs were preserved in $($layout.Root)."
