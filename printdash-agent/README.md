# PrintDash

<img width="1376" height="768" alt="PrintDash Banner" src="https://github.com/user-attachments/assets/312fb595-4a8f-41dc-8233-bd5df12c4ded" />

A self-hosted office printer management dashboard with SNMP-based toner/status monitoring, print job control, network scanning, and Telegram alerts — all from a single Node.js process.

---

## Features

### Printer Monitoring
- SNMP polling of networked printers (Canon, HP, and others)
- Toner/ink levels per cartridge with low-toner threshold alerts
- Paper tray status and empty tray detection
- Jam, cover-open, and service alert detection
- Online/offline state with consecutive-failure debounce (avoids false alarms from transient SNMP timeouts)
- Page count tracking with history per printer
- Uptime display

### Print Management (via CUPS)
- View all CUPS print queues and their current status
- Submit print jobs directly from the dashboard (file upload)
- Live and completed job history with job cancellation
- Pause/resume individual print queues
- Set default printer
- Discover IPP printers on the local network and add them to CUPS in one click

### Scanning (via SANE + Samba)
- Detect connected scanners via `scanimage`
- Trigger scans remotely from the dashboard
- Browse and download completed scan files
- Built-in Samba config helper — generates the `/etc/samba/smb.conf` snippet so Canon/HP printers can scan-to-folder directly to the server over SMB (`\\SERVER_IP\scans`)

### Printer Discovery
- SNMP subnet scan to auto-discover printers on your network
- Automatic local subnet detection
- IPP/CUPS discovery as an alternative to SNMP
- One-click add from scan results

### Alerts (Telegram)
- Instant notifications for low toner, paper empty, jams, offline, and back-online events
- Per-alert type toggles (enable/disable individually)
- Configurable toner threshold percentage
- Alert cooldown to prevent repeated notifications for the same condition
- In-memory alert cooldown to avoid repeated alerts while the process is running
- Test message button to verify your bot token and chat ID

### Dashboard & Auth
- Dark-themed responsive web UI
- Role-based login — `admin` (full access) and `user` (read-only monitoring)
- Admin user management (add, change password, delete)
- Settings page with live Telegram configuration

 <img width="1897" height="904" alt="2026-07-06 16_58_24-PrintDash and 25 more pages - Personal - Microsoft​ Edge" src="https://github.com/user-attachments/assets/fc40b844-6459-400f-8ea5-0022417cb3ec" />

---

## Requirements

- Node.js 18+
- Network access (SNMP, UDP 161) to your printers
- Outbound HTTPS access to the central SEAOIL monitoring API
- **CUPS** installed and running on the host — PrintDash shells out to CUPS command-line tools (`lpstat`, `lp`, `cancel`, `lpadmin`, `lpinfo`, `cupsenable`, `cupsdisable`) for print queue management, job control, and IPP-based printer discovery
- **SANE** (`scanimage`) installed on the host for scanner support
- **Samba** (`smbd`) installed on the host if you want scan-to-folder from printer web UIs
- Appropriate printer drivers for your hardware (Canon, HP, etc.) installed via CUPS

The production image pins Node.js 24 LTS. Prefer that LTS runtime for the agent;
Node.js 26 is still in Current status and is outside the runtime used by this
deployment. SNMP session errors are handled per printer so a
malformed ASN.1 response is logged safely and does not terminate the poll loop.

On Debian/Ubuntu:

```bash
sudo apt update
sudo apt install -y cups cups-client sane-utils samba printer-driver-all
```

The user running the Node.js process needs CUPS administrator access. PrintDash
first runs CUPS commands as that account and only uses its restricted,
non-interactive `sudo` fallback when direct access is rejected:

```bash
sudo usermod -aG lpadmin $USER
```

---

## Installation

```bash
git clone https://github.com/isuruwa/printdash.git
cd printdash
npm install
```

---

## Configuration

PrintDash stores its runtime data in JSON files that are **not** included in this repo (gitignored — they contain credentials and your internal network layout). Copy the provided examples to get started:

```bash
cp .env.example .env
cp printers.example.json printers.json
cp settings.example.json settings.json
```

| File | Purpose |
|---|---|
| `printers.json` | List of printers to monitor (IP, SNMP community string, location) |
| `settings.json` | Telegram bot token/chat ID and alert thresholds |
| `users.json` | Created automatically on first run with default accounts `admin/admin123` and `user/user123` |

**Change the default passwords immediately after first login.**

### SEAOIL agent environment variables

Configure these in `.env`. The bearer token authenticates the agent; the agent
key is a stable, non-secret identity and must stay unchanged for that office.
Use the corresponding agent key/name in the central dashboard configuration.

Create the agent credential on the central dashboard first. The central API
looks up the payload's agent key and verifies the bearer token against that
agent's bcrypt hash. Changing only `SEAOIL_AGENT_KEY` cannot impersonate a
different office because each key has an independent token.

| Variable | Required | Default | Purpose |
|---|---:|---|---|
| `SEAOIL_API_URL` | Production | `http://localhost:3000/api/monitoring/ingest` | Central ingest endpoint; use HTTPS remotely |
| `SEAOIL_CONFIG_URL` | No | Derived from `SEAOIL_API_URL` | Central printer-assignment endpoint |
| `SEAOIL_AGENT_TOKEN` | Yes | None | Unique bearer token generated once by the central credential CLI |
| `SEAOIL_AGENT_KEY` | Yes | None | Stable ID such as `cebu-agent`; never derive it only from hostname |
| `SEAOIL_AGENT_NAME` | No | `PrintDash Agent` | Human-readable agent name |
| `SEAOIL_AGENT_LOCATION` | No | None | Human-readable office/location metadata |
| `POLL_INTERVAL_SECONDS` | No | `60` | SNMP polling interval; valid range is 30-3600 seconds |
| `SEAOIL_CONFIG_REFRESH_SECONDS` | No | `60` | Central assignment refresh interval; valid range is 30-3600 seconds |
| `SEAOIL_CONFIG_CACHE_FILE` | No | Beside `DATA_FILE` | Last-known-good central assignment cache; contains no credentials |
| `SEAOIL_SNMP_COMMUNITY` | Remote deployment | `public` | Office-local SNMP community applied to central targets; never uploaded |

An invalid interval falls back to 60 seconds. If the token or stable key is
missing, local PrintDash monitoring remains available but central upload is
disabled with a clear startup error. The token is never printed.

On startup, and then every configuration refresh interval, PrintDash fetches
only the printers assigned to its authenticated agent key. The first valid
central response (including an empty list) becomes authoritative in memory.
Subsequent API failures keep that last known good list, so polling continues.
The last valid list is also cached atomically and loaded after a restart.
The local `printers.json` file is retained as a startup/debugging fallback and
is not overwritten by central assignments. Printer add/edit/delete operations
in the original PrintDash UI are rejected while central management is active;
make assignment changes in the SEAOIL printer form instead.

The SNMP community remains in the remote agent's `.env`. It is applied locally
to configured targets and is excluded from both configuration responses and
monitoring uploads. Configure `SEAOIL_SNMP_COMMUNITY` explicitly in production.

### PrintDash runtime environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3003` | Local PrintDash dashboard port |
| `USERS_FILE` | `./users.json` | Path to the users/auth file |
| `DATA_FILE` | `./printers.json` | Path to the printers list |
| `SEAOIL_CONFIG_CACHE_FILE` | Beside `DATA_FILE` | Agent-managed last-known central configuration |
| `SETTINGS_FILE` | `./settings.json` | Path to settings data |
| `SCAN_DIR` | `/opt/scans` | Directory where scan files are saved |
| `UPLOAD_DIR` | `/tmp/printdash-uploads` | Temp directory for print job uploads |

### Remote office network requirements

The agent machine must be on, or routed to, the printer LAN. Allow outbound
traffic from the agent to:

- Printers over SNMP UDP 161.
- IPP/CUPS endpoints over TCP 631 when print management is used.
- Any model-specific printing/scanning protocols already configured for the
  local installation, such as raw printing TCP 9100 or network scanner services.
- The central SEAOIL API over HTTPS TCP 443, plus normal DNS and time sync.

Do not port-forward or expose printer SNMP to the public internet. The agent
initiates outbound API connections. NetBird, when added later, should run on
the Linux host or as its own managed component, not inside this container.

---

## Docker deployment

The image runs as a non-root Node user, starts with `npm start`, and includes
the CUPS client and SANE tools used by the existing PrintDash UI. A restricted
sudo rule permits that user to run only the CUPS queue-administration commands
needed by PrintDash. Secrets are loaded at runtime from `.env` and are excluded
from the image.

```bash
cp .env.example .env
# Edit .env before continuing.
docker compose -f compose.example.yaml up -d --build
docker compose -f compose.example.yaml logs -f printdash-agent
```

Stop the container without deleting persisted data:

```bash
docker compose -f compose.example.yaml down
```

Printer/user/settings data and scans are stored in named volumes. The example
binds the dashboard to `127.0.0.1:3003` by default. Set
`PRINTDASH_BIND_ADDRESS=0.0.0.0` only when LAN access is required and the host
firewall restricts access to trusted office networks.

The Compose deployment mounts `/var/run/cups/cups.sock` from the host. Install
and start CUPS on that host before launching the agent. If CUPS is restarted,
recreate the agent container so the bind mount follows the new socket. For USB
scanners, additional device mounts may be required. SNMP monitoring itself only
requires outbound UDP access to printer IPs.

---

## Running

```bash
npm ci
npm start
```

At startup, PrintDash prints the agent name, stable key, central API URL, and
poll interval. It never prints the bearer token. Central uploads have a
10-second timeout; an outage or authentication error is logged concisely and
retried on the next poll without stopping the dashboard or local SNMP polling.

For production, use PM2:

```bash
pm2 start server.js --name printdash
pm2 save
```

---

## Scan-to-Folder Setup (optional)

To let your printer scan directly to the server over SMB:

1. Go to **Settings → Scans** in the dashboard — it generates the exact Samba config block for your server
2. Add the block to `/etc/samba/smb.conf` and restart: `systemctl restart smbd`
3. On the printer's web UI set: **Scan → Scan to Folder → `\\SERVER_IP\scans`**

---

## Security Notes

- Never commit `users.json`, `printers.json`, or `settings.json` — they contain password hashes, your Telegram bot token, and internal network details. All are excluded via `.gitignore`.
- Passwords are stored salted and hashed (scrypt), never in plaintext.
- Put this behind a reverse proxy with HTTPS if exposing it outside your LAN.
- Replace the generated default PrintDash passwords immediately on every new installation, before making the dashboard reachable from other machines.
- Give every office a unique agent key and bearer token, and protect `.env` with host filesystem permissions.

---

## License

MIT
