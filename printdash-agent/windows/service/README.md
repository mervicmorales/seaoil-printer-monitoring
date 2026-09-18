# SEAOIL Printer Monitoring Agent Windows Service

Milestone 2 runs the existing Node.js agent as a Windows service:

```text
Windows Service Control Manager
  -> WinSW 2.12.0 (SEAOILPrinterAgent.exe)
    -> explicit Node.js runtime
      -> printdash-agent/server.js
```

The wrapper does not replace the agent. It starts the same `server.js` used by
`npm start`, captures its console output, sends the stop signal used by the
agent's graceful-shutdown handler, and asks Windows to restart it after an
unexpected non-zero exit.

## Service identity and privileges

- Service ID: `SEAOILPrinterAgent`
- Display name: `SEAOIL Printer Monitoring Agent`
- Startup type: `Automatic`
- Default account: LocalSystem (the WinSW/SCM default for this milestone)
- Recovery: restart after 60 seconds for first, second, and subsequent failures;
  reset the failure count after one hour of stable operation
- Graceful stop allowance: 30 seconds

Run every management script from an elevated PowerShell window. LocalSystem is
acceptable for a spare-laptop integration test, but production should use a
dedicated, lower-privilege service identity with only the filesystem and local
printer/scanner permissions it needs. Do not put an account password in this
repository or the XML template.

## Runtime and mutable-data layout

The future installer is expected to place immutable application files here:

```text
C:\Program Files\SEAOIL\PrinterAgent\
|-- Agent\
|   `-- server.js (and the remaining agent files)
`-- Runtime\
    `-- node.exe (Node.js 24 LTS)
```

The service scripts keep mutable and site-specific files outside Program Files:

```text
C:\ProgramData\SEAOIL\PrinterAgent\
|-- config\
|   |-- agent.env
|   `-- settings.json
|-- data\
|   |-- users.json
|   |-- printers.json
|   |-- seaoil-config-cache.json
|   |-- scans\
|   `-- uploads\
|-- logs\
`-- service\
    |-- SEAOILPrinterAgent.exe
    `-- SEAOILPrinterAgent.xml
```

The install script can point at a repository checkout for development. It does
not copy or migrate existing application data automatically.

Port 3003 remains the local PrintDash/PrintOps HTTP port. The agent now starts
monitoring only after that listener is acquired. A normal second `npm start`
therefore exits before polling or uploading and writes a clear duplicate-instance
message. The service does not kill another process and does not silently choose
a different port. An explicitly different bind address or port is treated as an
intentional separate deployment and must be managed by the administrator.

## Acquire the pinned WinSW wrapper

WinSW is intentionally not committed. Download the official x64 WinSW 2.12.0
release into this directory and verify its pinned SHA-256 before installation:

```powershell
$ServiceScripts = "C:\path\to\seaoil-printer-monitoring\printdash-agent\windows\service"
$WinSW = Join-Path $ServiceScripts "WinSW-x64.exe"
Invoke-WebRequest `
  -Uri "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe" `
  -OutFile $WinSW
(Get-FileHash -LiteralPath $WinSW -Algorithm SHA256).Hash.ToLowerInvariant()
```

Expected x64 SHA-256:

```text
05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da
```

`install-service.ps1` repeats this checksum check and refuses any other binary.
There is no runtime download and no use of an unpinned `latest` release.

## Configuration

Create the protected service configuration before installation:

```powershell
$AgentSource = "C:\path\to\seaoil-printer-monitoring\printdash-agent"
$ConfigDirectory = Join-Path $env:ProgramData "SEAOIL\PrinterAgent\config"
New-Item -ItemType Directory -Path $ConfigDirectory -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $AgentSource ".env.example") `
  -Destination (Join-Path $ConfigDirectory "agent.env")
notepad (Join-Path $ConfigDirectory "agent.env")
```

Set real values for `SEAOIL_API_URL`, `SEAOIL_AGENT_KEY`, and
`SEAOIL_AGENT_TOKEN`. On the first service start, also set local dashboard
passwords of at least 12 characters:

```text
PRINTDASH_ADMIN_PASSWORD=<secure value>
PRINTDASH_USER_PASSWORD=<secure value>
```

Service startup rejects the unchanged example URL and placeholder secret values.

The service XML contains only paths and non-secret runtime settings. The install
script restricts `agent.env` to LocalSystem read access and local Administrators
full control. If a dedicated service account is introduced later, explicitly
grant that identity read access before changing the SCM logon account.

### Native scanner mapping

Install an organization-approved pinned NAPS2 release and the manufacturer's
WIA/WSD driver on the agent computer. List devices without starting a scan:

```powershell
& 'C:\Program Files\NAPS2\NAPS2.Console.exe' --version
& 'C:\Program Files\NAPS2\NAPS2.Console.exe' --noprofile --listdevices --driver wia
& 'C:\Program Files\NAPS2\NAPS2.Console.exe' --noprofile --listdevices --driver twain
```

Copy `scanner-devices.example.json` to this local-only path and replace its
placeholder with each printer's physical serial and exact listed device name:

```text
C:\ProgramData\SEAOIL\PrinterAgent\config\scanner-devices.json
```

The mapping contains no credentials but is machine-specific and must not be
committed. Legacy HP devices that advertise the old CloudScan namespace should
use WIA or TWAIN rather than the NAPS2 eSCL driver. If a device appears for the
interactive administrator but not in service diagnostics, verify that its
driver is installed machine-wide and visible to LocalSystem.

### Printing backends

The recommended site architecture uses the local CUPS gateway. Create queues
named `PrintOps_<central printer ID>`, then add these local-only settings to
`agent.env`:

```dotenv
PRINT_BACKEND=remote-cups
CUPS_SERVER_URL=http://127.0.0.1:631
```

CUPS owns printer protocol and certificate workarounds, while the Windows agent
submits print jobs to deterministic queues. Keep CUPS bound to localhost when it
runs on the same computer through WSL. The agent never creates queues remotely.

The rollback backend is `PRINT_BACKEND=windows`. For that mode, install a
reviewed SumatraPDF build at
`C:\ProgramData\SEAOIL\PrinterAgent\tools\SumatraPDF\SumatraPDF.exe` and copy
`printer-queues.example.json` to
`C:\ProgramData\SEAOIL\PrinterAgent\config\printer-queues.json`. Map physical
serial numbers to exact Windows queue names and keep the real mapping local.

The service binds the local dashboard and `/health` endpoint to
`127.0.0.1:3003`. This avoids exposing local administration endpoints to the
branch network. Interactive `npm start` retains the existing `0.0.0.0` default
for compatibility; set `PRINTDASH_LISTEN_ADDRESS` explicitly when needed and
protect any LAN exposure with the Windows Firewall.

## Install from a repository checkout

Use an explicit `node.exe` path. The script never assumes Node is available on
the LocalSystem `PATH`:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd "C:\path\to\seaoil-printer-monitoring\printdash-agent\windows\service"
.\install-service.ps1 `
  -AgentPath "C:\path\to\seaoil-printer-monitoring\printdash-agent" `
  -NodePath "C:\Program Files\nodejs\node.exe" `
  -ConfigFile "$env:ProgramData\SEAOIL\PrinterAgent\config\agent.env" `
  -Start
```

For the future packaged layout, the equivalent command is:

```powershell
.\install-service.ps1 `
  -AgentPath "C:\Program Files\SEAOIL\PrinterAgent\Agent" `
  -NodePath "C:\Program Files\SEAOIL\PrinterAgent\Runtime\node.exe" `
  -ConfigFile "$env:ProgramData\SEAOIL\PrinterAgent\config\agent.env" `
  -Start
```

Installation is idempotent: an existing service is reported and is not
registered a second time.

## Service management

From this directory in elevated PowerShell:

```powershell
.\start-service.ps1
.\status-service.ps1
.\stop-service.ps1
.\restart-service.ps1
.\test-service.ps1
.\uninstall-service.ps1
```

Uninstalling preserves the ProgramData configuration, monitoring cache, local
data, scan files, and logs. It never removes secrets or historical files.

## Health and logs

The local, unauthenticated health response contains only status, version, and
process uptime:

```powershell
Invoke-RestMethod http://127.0.0.1:3003/health
```

WinSW writes equivalent application/service logs under:

```text
C:\ProgramData\SEAOIL\PrinterAgent\logs\
|-- SEAOILPrinterAgent.out.log      (agent stdout)
|-- SEAOILPrinterAgent.err.log      (agent stderr)
`-- SEAOILPrinterAgent.wrapper.log  (WinSW lifecycle/errors)
```

Each stdout/stderr log rolls at approximately 10 MB and retains five rotated
files. Windows Event Viewer may also contain SCM/WinSW startup failures. Agent
logs include startup/version/runtime mode, configuration and poll summaries,
upload/retry summaries, and graceful shutdown. They must never contain bearer
tokens, password values, SNMP community values, or full authorization headers.

## Manual Windows integration test

Use a spare Windows laptop on the printer network.

1. **Install.** Prepare `agent.env`, download/verify WinSW, and run the install
   command above. Run `.\status-service.ps1`; confirm `Running` and `Automatic`.
2. **Health.** Run `.\test-service.ps1`; confirm version `4.0.0` and increasing
   uptime.
3. **Monitoring.** Wait at least one poll interval and confirm the assigned
   printers continue receiving fresh readings in the dashboard.
4. **Agent Management.** Confirm the agent is Online and shows version `4.0.0`,
   Windows platform, hostname, Node.js version, last seen, and existing
   matched/unmatched counts.
5. **Reboot.** Restart Windows without opening Command Prompt afterward. Confirm
   the service returns to `Running` automatically and the dashboard receives a
   new last-seen time.
6. **Logout.** Log out, wait longer than one poll interval, log back in, and
   confirm monitoring continued while no interactive user was signed in.
7. **Crash recovery.** In elevated PowerShell, identify only the service child
   whose command line ends in this agent's `server.js`, then terminate that PID:

   ```powershell
   $AgentEntry = "C:\path\to\seaoil-printer-monitoring\printdash-agent\server.js"
   $AgentProcess = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
     Where-Object { $_.CommandLine -like "*$AgentEntry*" }
   $AgentProcess | Format-Table ProcessId, CommandLine
   Stop-Process -Id $AgentProcess.ProcessId -Force
   Start-Sleep -Seconds 70
   .\status-service.ps1
   ```

   Confirm the wrapper log records the failure and Windows restarts the service
   after roughly 60 seconds. Confirm dashboard reporting resumes.
8. **Manual stop/offline.** Run `.\stop-service.ps1`. Wait for the dashboard's
   existing stale timeout and confirm the agent becomes Offline. Manual stops
   must not trigger recovery.
9. **Manual start/online.** Run `.\start-service.ps1`; confirm the dashboard
   returns to Online after the next successful communication.
10. **Port conflict.** Stop the service, hold port 3003, and try to start it:

    ```powershell
    .\stop-service.ps1
    $Listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 3003)
    $Listener.Start()
    try { .\start-service.ps1 } finally { $Listener.Stop() }
    Get-Content "$env:ProgramData\SEAOIL\PrinterAgent\logs\SEAOILPrinterAgent.err.log" -Tail 30
    ```

    Confirm the log says port 3003 is already in use and suggests another agent
    may be running. After releasing the port, wait for recovery or start the
    service explicitly.
11. **Graceful stop.** Review the output log after a normal stop and confirm both
    `Graceful shutdown started` and `Graceful shutdown complete` appear.

## Troubleshooting

- **Port 3003 in use:** run `Get-NetTCPConnection -LocalPort 3003` and identify
  the owning PID. Do not kill an unknown process. Stop the duplicate agent or
  resolve the conflicting application, then restart this service.
- **Startup validation failed:** check that `agent.env` exists and contains the
  API URL, agent key, bearer token, and initial local dashboard passwords. The
  log reports variable names but never secret values.
- **Service starts then stops:** inspect `.err.log`, `.wrapper.log`, and Windows
  Event Viewer. Confirm the configured explicit Node path still exists.
- **No dashboard uploads:** validate outbound HTTPS/DNS, the agent credential,
  and the central configuration endpoint. Existing cached assignments remain a
  fallback during central outages.
- **No printer readings:** confirm the service identity can reach printer SNMP
  UDP 161 and any local print/scan dependencies.
- **Legacy HP scan returns HTTP 400:** install the machine-wide WIA/WSD driver
  and configure a serial-number WIA or TWAIN mapping. Do not force modern eSCL.
- **Remote CUPS queue missing:** confirm the assigned printer ID has an accepting
  `PrintOps_<ID>` queue and that `CUPS_SERVER_URL` is reachable from the service.
- **Repository checkout access denied:** LocalSystem may not be able to read a
  checkout inside a tightly restricted user profile. Grant only the required
  read/execute access or test from the intended Program Files layout.

## Shutdown behavior and limitations

WinSW sends the console stop signal and allows 30 seconds. The agent immediately
stops its schedules and new HTTP work, aborts central HTTP requests, closes SNMP
sessions, closes the Express server, and waits briefly for active operations.
WinSW terminates the process tree only if that grace period expires. Temporary
scan/upload files remain in ProgramData, so Windows shutdown cannot corrupt an
application database (the agent has none).

An actual Windows host is still required to validate SCM signals, service-account
access to printers/scanners, firewall policy, and the explicit Node runtime.
WinSW, NAPS2, SumatraPDF, and printer drivers remain externally acquired
dependencies that should be pinned, verified, and approved as part of the
future installer release process.

This milestone does not include an installer, bundled Node runtime, registration,
remote commands, or any updater functionality.
