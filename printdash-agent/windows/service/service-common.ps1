Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:ServiceId = "SEAOILPrinterAgent"
$script:ServiceDisplayName = "SEAOIL Printer Monitoring Agent"

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Administrator privileges are required. Open PowerShell with 'Run as administrator' and try again."
    }
}

function Get-SEAOILService {
    return (Get-Service -Name $script:ServiceId -ErrorAction SilentlyContinue)
}

function Get-SEAOILServiceLayout {
    param([Parameter(Mandatory = $true)][string]$ProgramDataRoot)

    return [PSCustomObject]@{
        Root = $ProgramDataRoot
        Config = Join-Path $ProgramDataRoot "config"
        Logs = Join-Path $ProgramDataRoot "logs"
        Data = Join-Path $ProgramDataRoot "data"
        Service = Join-Path $ProgramDataRoot "service"
    }
}

function Wait-SEAOILServiceStatus {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("Running", "Stopped")][string]$Status,
        [int]$TimeoutSeconds = 30
    )

    $service = Get-Service -Name $script:ServiceId -ErrorAction Stop
    $targetStatus = [Enum]::Parse([System.ServiceProcess.ServiceControllerStatus], $Status)
    $service.WaitForStatus($targetStatus, [TimeSpan]::FromSeconds($TimeoutSeconds))
    $service.Refresh()
    if ($service.Status.ToString() -ne $Status) {
        throw "$script:ServiceDisplayName did not reach status $Status within $TimeoutSeconds seconds."
    }
    return $service
}
