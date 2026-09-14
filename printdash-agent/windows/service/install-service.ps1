param(
    [string]$AgentPath,
    [string]$NodePath,
    [string]$ConfigFile,
    [string]$ProgramDataRoot,
    [switch]$Start
)

. (Join-Path $PSScriptRoot "service-common.ps1")
Assert-Administrator

$WinSWVersion = "2.12.0"
$ExpectedWinSWHash = "05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da"

if ([string]::IsNullOrWhiteSpace($AgentPath)) {
    $AgentPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
}
if ([string]::IsNullOrWhiteSpace($ProgramDataRoot)) {
    $ProgramDataRoot = Join-Path $env:ProgramData "SEAOIL\PrinterAgent"
}
if ([string]::IsNullOrWhiteSpace($NodePath)) {
    $NodePath = Join-Path $env:ProgramFiles "SEAOIL\PrinterAgent\Runtime\node.exe"
}

$AgentPath = [IO.Path]::GetFullPath($AgentPath)
$NodePath = [IO.Path]::GetFullPath($NodePath)
$ProgramDataRoot = [IO.Path]::GetFullPath($ProgramDataRoot)
$service = Get-SEAOILService
if ($null -ne $service) {
    Write-Host "$script:ServiceDisplayName is already installed. No duplicate registration was created."
    if ($Start -and $service.Status -ne "Running") {
        Start-Service -Name $script:ServiceId
        Wait-SEAOILServiceStatus -Status Running | Out-Null
        Write-Host "$script:ServiceDisplayName started."
    }
    return
}

$AgentEntrypoint = Join-Path $AgentPath "server.js"
$PackageFile = Join-Path $AgentPath "package.json"
$TemplateFile = Join-Path $PSScriptRoot "SEAOILPrinterAgent.xml"
$SourceWrapper = Join-Path $PSScriptRoot "WinSW-x64.exe"

foreach ($requiredFile in @($AgentEntrypoint, $PackageFile, $TemplateFile, $NodePath, $SourceWrapper)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required file was not found: $requiredFile"
    }
}

$actualHash = (Get-FileHash -LiteralPath $SourceWrapper -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $ExpectedWinSWHash) {
    throw "WinSW checksum verification failed. Expected the official WinSW $WinSWVersion x64 SHA-256 $ExpectedWinSWHash."
}

$nodeRuntimeOutput = & $NodePath --version
if ($LASTEXITCODE -ne 0) {
    throw "The configured Node.js executable could not be started: $NodePath"
}
$nodeRuntimeVersion = ($nodeRuntimeOutput | Out-String).Trim()
if ($nodeRuntimeVersion -notmatch '^v24\.') {
    Write-Warning "Node.js 24 LTS is recommended for production. Detected $nodeRuntimeVersion."
}

$layout = Get-SEAOILServiceLayout -ProgramDataRoot $ProgramDataRoot
foreach ($directory in @($layout.Root, $layout.Config, $layout.Logs, $layout.Data, $layout.Service)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}
$scanDirectory = Join-Path $layout.Data "scans"
$uploadDirectory = Join-Path $layout.Data "uploads"
New-Item -ItemType Directory -Path $scanDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $uploadDirectory -Force | Out-Null

$targetConfig = Join-Path $layout.Config "agent.env"
if (-not [string]::IsNullOrWhiteSpace($ConfigFile)) {
    $ConfigFile = [IO.Path]::GetFullPath($ConfigFile)
    if (-not (Test-Path -LiteralPath $ConfigFile -PathType Leaf)) {
        throw "Configuration file was not found: $ConfigFile"
    }
    if ($ConfigFile -ne $targetConfig) {
        Copy-Item -LiteralPath $ConfigFile -Destination $targetConfig -Force
    }
}
if (-not (Test-Path -LiteralPath $targetConfig -PathType Leaf)) {
    throw "Create $targetConfig from .env.example, or pass -ConfigFile with a prepared service configuration. No credentials were written."
}

$icacls = Join-Path $env:SystemRoot "System32\icacls.exe"
& $icacls $targetConfig "/reset" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Could not reset inherited permissions on $targetConfig."
}
& $icacls $targetConfig "/inheritance:r" "/grant:r" "*S-1-5-18:(R)" "*S-1-5-32-544:(F)" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Could not restrict permissions on $targetConfig."
}

$targetWrapper = Join-Path $layout.Service "$script:ServiceId.exe"
$targetXml = Join-Path $layout.Service "$script:ServiceId.xml"
Copy-Item -LiteralPath $SourceWrapper -Destination $targetWrapper -Force

function ConvertTo-XmlValue([string]$value) {
    return [Security.SecurityElement]::Escape($value)
}

$replacements = [ordered]@{
    "{{NODE_EXECUTABLE}}" = (ConvertTo-XmlValue $NodePath)
    "{{AGENT_ENTRYPOINT}}" = (ConvertTo-XmlValue $AgentEntrypoint)
    "{{AGENT_DIRECTORY}}" = (ConvertTo-XmlValue $AgentPath)
    "{{CONFIG_FILE}}" = (ConvertTo-XmlValue $targetConfig)
    "{{USERS_FILE}}" = (ConvertTo-XmlValue (Join-Path $layout.Data "users.json"))
    "{{PRINTERS_FILE}}" = (ConvertTo-XmlValue (Join-Path $layout.Data "printers.json"))
    "{{SETTINGS_FILE}}" = (ConvertTo-XmlValue (Join-Path $layout.Config "settings.json"))
    "{{CONFIG_CACHE_FILE}}" = (ConvertTo-XmlValue (Join-Path $layout.Data "seaoil-config-cache.json"))
    "{{SCAN_DIRECTORY}}" = (ConvertTo-XmlValue $scanDirectory)
    "{{UPLOAD_DIRECTORY}}" = (ConvertTo-XmlValue $uploadDirectory)
    "{{LOG_DIRECTORY}}" = (ConvertTo-XmlValue $layout.Logs)
}
$xml = Get-Content -LiteralPath $TemplateFile -Raw
foreach ($replacement in $replacements.GetEnumerator()) {
    $xml = $xml.Replace($replacement.Key, $replacement.Value)
}
if ($xml.Contains("{{")) {
    throw "The generated WinSW configuration contains an unresolved template value."
}
$validatedXml = [xml]$xml
if ($null -eq $validatedXml.DocumentElement) {
    throw "The generated WinSW configuration is not valid XML."
}
[IO.File]::WriteAllText($targetXml, $xml, [Text.UTF8Encoding]::new($false))

Push-Location $layout.Service
try {
    & $targetWrapper install
    if ($LASTEXITCODE -ne 0) {
        throw "WinSW could not install $script:ServiceDisplayName (exit code $LASTEXITCODE)."
    }
} finally {
    Pop-Location
}

Write-Host "$script:ServiceDisplayName installed with Automatic startup."
Write-Host "Wrapper: $targetWrapper"
Write-Host "Configuration: $targetConfig"
Write-Host "Logs: $($layout.Logs)"
if ($Start) {
    Start-Service -Name $script:ServiceId
    Wait-SEAOILServiceStatus -Status Running | Out-Null
    Write-Host "$script:ServiceDisplayName started."
}
