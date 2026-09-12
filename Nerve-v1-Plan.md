# Nerve — V1 Build Plan

**Status:** Planned  
**Project type:** Internal homelab operations dashboard  
**Primary goal:** Provide one clean, fast place to answer: **“Is my server healthy, what needs attention, and where do I go to fix it?”**

---

## 1. Project Summary

Nerve is a private, self-hosted operations dashboard for the home server.

V1 is intentionally **read-only**. It will collect and present useful status from Docker and selected services without trying to replace Portainer, WUD, Nginx Proxy Manager, Offen, or the applications themselves.

The dashboard should make it possible to check the server in a few seconds instead of opening several separate tools.

### V1 should answer

- Are all expected containers running?
- Are any containers unhealthy, restarting, or stopped?
- Which containers are consuming notable CPU or memory?
- Is Docker reachable and healthy?
- How much Docker disk space is being used?
- Are container updates available?
- Did the last backup succeed?
- When did the last backup run?
- Did the local and cloud backup process report success?
- Is Gluetun connected?
- What VPN public IP is Gluetun using?
- Are important services reachable?
- Where can I click to open Portainer, NPM, Jellyfin, WUD, etc.?

---

# 2. Core Design Rule

> **Nerve observes first. It controls later.**

V1 will contain no destructive or administrative actions.

No buttons to:

- restart containers
- stop containers
- update containers
- trigger backups
- modify Docker
- change Gluetun
- edit NPM
- alter application configuration

The goal is to establish reliable visibility before adding control.

This also sharply reduces the damage Nerve could cause if something goes wrong.

---

# 3. V1 Scope

## Included

### Dashboard Overview

A single primary dashboard showing:

- overall system state
- container summary
- attention-required items
- latest backup
- available updates
- VPN status
- Docker resource usage
- quick links

### Containers

For each container:

- name
- state
- health status when available
- uptime
- image
- CPU usage
- memory usage
- restart count
- update available status when WUD knows about one

Containers should be visually grouped where useful.

Initial logical groups:

- Media
- Downloads
- Infrastructure
- Monitoring / Maintenance
- Remote Access
- Other

### Docker Summary

Display:

- Docker connectivity
- Docker version
- running container count
- stopped container count
- unhealthy container count
- image count
- Docker disk usage
- reclaimable Docker disk space

### Backup Status

Display the most recent Offen backup event:

- success / failure
- start time
- end time
- duration
- backup filename
- backup size
- stopped container count
- stop/start errors if reported
- local storage result
- S3/R2 result
- error message on failure

The latest result should be prominent on the overview screen.

### WUD Updates

Use WUD as the source of truth for container image update information.

Display:

- number of updates available
- affected containers
- current image/version
- available image/version when supplied by WUD

V1 only reports updates.

Updating still happens in WUD or Portainer.

### Gluetun

Display:

- VPN state
- public VPN IP
- container health

V1 must use read-only Gluetun access.

### Service Quick Links

Configurable links for services such as:

- Portainer
- Nginx Proxy Manager
- Jellyfin
- Jellyseerr
- WUD
- T3 Code
- any future internal tools

These are navigation shortcuts only.

### Basic Service Health

Allow Nerve to perform simple HTTP checks against selected internal services.

Status:

- Online
- Degraded
- Offline
- Unknown

This is not meant to replace UptimeRobot. It gives Nerve a local view of services that external monitoring cannot see.

---

# 4. Explicitly NOT in V1

These are future features.

If implementation starts drifting into these items, stop.

## No Docker Control

Do not add:

- start
- stop
- restart
- kill
- recreate
- pull image
- prune
- exec shell

## No Update Automation

Do not:

- update containers
- automatically deploy newer images
- replace WUD
- replace Portainer

## No Backup Controls

Do not:

- manually trigger backups
- restore backups
- browse archive contents
- delete backups

## No User Accounts

Nerve is an internal application.

V1 assumes access is restricted to the trusted LAN and/or Meshnet.

Do not build:

- registration
- passwords
- roles
- permissions
- Authentik integration

Authentication can be added later if the exposure model changes.

## No Internet Exposure

Do not expose Nerve publicly through NPM in V1.

Remote access should use Meshnet.

## No Windows Host Agent

V1 will report Docker workload information, not full Windows host telemetry.

Full host metrics can later be added with a small Windows service/agent.

## No Alerting Engine

Do not build:

- alert rules
- thresholds editor
- notification routing
- escalation
- Discord notification engine

Existing tools continue handling their existing notifications.

## No AI Features

Absolutely no:

> “Ask AI why Jellyfin is down.”

We can survive without putting a language model between us and `container exited`.

---

# 5. Recommended Architecture

## High-Level Layout

```text
                     ┌─────────────────────────┐
                     │       Web Browser       │
                     │     Nerve UI          │
                     └────────────┬────────────┘
                                  │
                                  ▼
                     ┌─────────────────────────┐
                     │      OpNervepp        │
                     │                         │
                     │ Next.js + TypeScript    │
                     │ Server API + UI         │
                     └──────┬──────┬──────┬───┘
                            │      │      │
              ┌─────────────┘      │      └──────────────┐
              ▼                    ▼                     ▼
      ┌──────────────┐     ┌─────────────┐      ┌──────────────┐
      │ Docker API   │     │   WUD API   │      │ Gluetun API  │
      │ read-only    │     │             │      │ read-only    │
      └──────────────┘     └─────────────┘      └──────────────┘
              │
              │
              ▼
      ┌──────────────┐
      │ Docker Host  │
      └──────────────┘

      Offen ───── webhook ─────► OpsDNerve
```

---

# 6. Technology Stack

## Application

**Next.js + TypeScript**

Reasons:

- one repository
- one application container
- frontend and backend routes together
- easy component-based UI
- simple deployment
- good fit for an internal dashboard
- avoids maintaining separate frontend/backend projects during V1

Use the current supported Next.js release at implementation time.

## UI

Recommended:

- React
- Tailwind CSS
- shadcn/ui for primitives
- Lucide icons

The visual identity should be customized rather than left looking like stock shadcn.

## Persistence

**SQLite**

Keep persistence minimal.

V1 needs storage primarily for:

- backup run events
- optional service-health history
- application metadata

Recommended ORM:

- Drizzle ORM

Avoid PostgreSQL/MySQL for V1.

Adding a database server to display whether other servers are healthy would be deeply on-brand, but also stupid.

## Containerization

Use Docker Compose / Portainer stack deployment.

Initial services:

```text
Nerve
opNerveocket-proxy
```

SQLite data should live in a named Docker volume.

---

# 7. Docker Access and Security

Direct access to the Docker socket is extremely privileged.

Nerve should **not** receive `/var/run/docker.sock` directly unless there is a strong reason.

Instead place a Docker socket proxy between Nerve and the Docker Engine.

Concept:

```text
Nerve
   │
   ▼
Docker Socket Proxy
   │
   ▼
/var/run/docker.sock
```

The proxy should:

- exist only on a private Docker network
- expose no host port
- reject POST requests
- enable only API areas Nerve needs
- never be exposed through NPM

Likely required read access:

- containers
- info
- images
- events
- system/version endpoints

### Important

A Docker API proxy reduces risk but does not make Docker metadata harmless.

Nerve must still be treated as trusted infrastructure.

V1 should never be Internet exposed.

---

# 8. Integration Design

## 8.1 Docker Engine

Create a dedicated adapter:

```text
src/lib/integrations/docker/
```

Responsibilities:

- Docker connection status
- Docker version/info
- list containers
- inspect container state
- read health status
- collect container stats
- calculate uptime
- read restart count
- Docker disk usage

Normalize Docker responses into Nerve's own models.

UI components should never depend directly on Docker API response shapes.

Example internal model:

```ts
type ContainerStatus = {
  id: string
  name: string
  image: string
  state: "running" | "stopped" | "restarting" | "unknown"
  health: "healthy" | "unhealthy" | "starting" | "none"
  uptimeSeconds: number | null
  restartCount: number
  cpuPercent: number | null
  memoryBytes: number | null
}
```

---

## 8.2 WUD

Create:

```text
src/lib/integrations/wud/
```

WUD remains responsible for registry/update detection.

Nerve only reads and summarizes WUD data.

Normalize to:

```ts
type ContainerUpdate = {
  containerId: string
  containerName: string
  currentVersion: string | null
  availableVersion: string | null
  updateAvailable: boolean
}
```

If WUD is unreachable:

- Nerve remains operational
- update status becomes `Unknown`
- dashboard shows the WUD integration as unavailable

One broken integration must not break the whole dashboard.

---

## 8.3 Offen Backup

Do not scrape logs as the primary mechanism.

Configure Offen notifications to POST backup completion information into Nerve.

Endpoint concept:

```text
POST /api/webhooks/offen
```

Store each received backup run in SQLite.

Record:

```ts
type BackupRun = {
  id: string
  status: "success" | "failure"
  startedAt: Date
  endedAt: Date | null
  durationSeconds: number | null
  filename: string | null
  sizeBytes: number | null
  stoppedContainers: number | null
  stopErrors: number | null
  localStatus: string | null
  s3Status: string | null
  error: string | null
}
```

### Webhook Security

Use a shared secret.

Example:

```text
X-Nerve-Token: <secret>
```

Reject requests without the correct token.

Keep the webhook available only on the private Docker network if possible.

### Fallback Signal

Nerve should also monitor the Offen container state.

This allows a distinction between:

- `Backup failed`
- `Backup status unknown because Offen is down`

---

## 8.4 Gluetun

Use the Gluetun HTTP control server.

Nerve only needs read access to:

```text
GET /v1/vpn/status
GET /v1/publicip/ip
```

Create a Gluetun role/API credential that grants only these endpoints.

Do not grant Nerve PUT access.

Normalize to:

```ts
type VpnStatus = {
  state: "running" | "stopped" | "unknown"
  publicIp: string | null
  containerHealthy: boolean | null
}
```

---

## 8.5 Internal Service Checks

Services should be configured in a local configuration file.

Example:

```yaml
services:
  - id: jellyfin
    name: Jellyfin
    url: https://jellyfin.example.com
    checkUrl: http://jellyfin:8096
    group: media
    critical: true

  - id: portainer
    name: Portainer
    url: https://192.168.40.186:9443
    checkUrl: https://192.168.40.186:9443
    group: infrastructure
    critical: true
```

This avoids hardcoding Jeramey's server layout into application code.

The public/open URL and health-check URL may be different.

---

# 9. Application Configuration

Prefer environment variables for secrets and connection details.

Example:

```text
Nerve_DATABASE_PATH
DOCKER_HOST
WUD_URL
WUD_USERNAME
WUD_PASSWORD
GLUETUN_URL
GLUETUN_API_KEY
OFFEN_WEBHOOK_TOKEN
```

Use a YAML configuration file for non-secret display configuration:

```text
config/Nerve.yaml
```

Good YAML candidates:

- service names
- service URLs
- groups
- criticality
- display ordering
- icons
- expected containers

Never put credentials in the YAML file committed to Git.

Portainer environment variables or Docker secrets should hold credentials.

---

# 10. Dashboard Design

## Visual Direction

Nerve should feel like:

> **a modern operations console, not a generic SaaS admin template**

Characteristics:

- dark interface
- high information density
- clear hierarchy
- restrained animation
- strong typography
- clear status indicators
- subtle technical/grid aesthetic
- minimal decoration
- useful information above visual gimmicks

Avoid:

- giant empty cards
- excessive gradients
- glowing cyberpunk nonsense
- gauges for everything
- graphs with no operational value
- dashboard widgets designed purely to occupy space

---

# 11. Primary Screen — Overview

Suggested layout:

```text
┌────────────────────────────────────────────────────────────┐
│ Nerve                                      17:42:13      │
│ Shitflix Server                              ● HEALTHY      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  SYSTEM                                                    │
│  ● Docker       Online       14 running / 0 stopped        │
│  ● Backup       Success      12h ago                       │
│  ● VPN          Connected    185.xxx.xxx.xxx               │
│  ◐ Updates      3 available                                │
│                                                            │
├────────────────────────────┬───────────────────────────────┤
│ ATTENTION                  │ DOCKER                        │
│                            │                               │
│ WUD       3 updates        │ CPU     ███░░░ 28%           │
│ Radarr    Update available │ Memory  ████░░ 6.2 GB        │
│ Sonarr    Update available │ Disk    182 GB Docker data   │
│ Jellyfin  Update available │                               │
├────────────────────────────┴───────────────────────────────┤
│ CONTAINERS                                                 │
│                                                            │
│ ● Jellyfin      healthy        1.2%      1.4 GB            │
│ ● Jellyseerr    healthy        0.1%      240 MB            │
│ ● Gluetun       healthy        0.2%      90 MB             │
│ ● qBittorrent   running        2.8%      620 MB            │
│ ...                                                        │
├────────────────────────────────────────────────────────────┤
│ QUICK ACCESS                                               │
│ Portainer | NPM | Jellyfin | Jellyseerr | WUD | T3        │
└────────────────────────────────────────────────────────────┘
```

The exact visual design can evolve.

The information hierarchy should not.

---

# 12. Secondary Views

## Containers

Purpose:

Detailed Docker view without trying to become Portainer.

Features:

- searchable list
- group filters
- status filter
- health
- image
- uptime
- CPU
- memory
- restart count
- available update

No container action buttons in V1.

---

## Backups

Purpose:

Answer whether backups are actually succeeding.

Display:

- current Offen container status
- latest backup result
- backup timestamp
- size
- duration
- local result
- R2/S3 result
- recent backup history

Keep history simple.

Example:

```text
Sep 11  05:03   SUCCESS   1.8 GB   08:42
Sep 07  05:02   SUCCESS   1.7 GB   08:11
Aug 30  12:04   FAILED    —        AccessDenied
```

No restore functionality.

---

## Updates

Purpose:

Provide a clean WUD summary.

Display:

- update count
- container
- current version
- available version
- detected time when available

Include:

**Open in WUD**

Do not duplicate WUD's update controls.

---

# 13. Status Model

Every integration should report:

```ts
type IntegrationHealth =
  | "healthy"
  | "degraded"
  | "offline"
  | "unknown"
```

Do not treat `unknown` as `offline`.

Examples:

- Docker unreachable → Offline
- WUD unreachable → Update information Unknown
- Offen container running but no recent webhook → Degraded
- Gluetun container running but VPN stopped → Degraded
- noncritical service offline → dashboard may remain Healthy
- critical service offline → overall status Degraded

---

# 14. Overall Health Logic

V1 overall state:

```text
HEALTHY
DEGRADED
OFFLINE
```

Suggested logic:

## Healthy

- Docker reachable
- all critical containers running
- no critical container unhealthy
- Gluetun healthy when expected
- last scheduled backup successful and recent

## Degraded

Examples:

- updates available
- optional service down
- backup overdue
- WUD unavailable
- VPN unavailable
- critical container unhealthy

## Offline

Use sparingly.

Examples:

- Docker Engine cannot be reached
- Nerve cannot retrieve any core state

Updates alone should not make the server look broken.

---

# 15. Data Refresh Strategy

Use polling for V1.

Suggested intervals:

```text
Container state:        10 seconds
Container stats:         5 seconds
Service health:         30 seconds
WUD:                    60 seconds
Gluetun:                30 seconds
Docker disk usage:       5 minutes
Backup events:          webhook driven
```

Do not build WebSocket infrastructure unless polling proves inadequate.

Simple beats clever.

---

# 16. Repository Structure

Suggested:

```text
Nerve/
│
├─ src/
│  ├─ app/
│  │  ├─ page.tsx
│  │  ├─ containers/
│  │  ├─ backups/
│  │  ├─ updates/
│  │  └─ api/
│  │
│  ├─ components/
│  │  ├─ dashboard/
│  │  ├─ containers/
│  │  ├─ backups/
│  │  ├─ status/
│  │  └─ ui/
│  │
│  ├─ lib/
│  │  ├─ integrations/
│  │  │  ├─ docker/
│  │  │  ├─ wud/
│  │  │  ├─ gluetun/
│  │  │  └─ services/
│  │  │
│  │  ├─ db/
│  │  ├─ config/
│  │  ├─ health/
│  │  └─ utils/
│  │
│  └─ types/
│
├─ config/
│  └─ opNervexample.yaml
│
├─ drizzle/
├─ public/
├─ tests/
│
├─ Dockerfile
├─ compose.yaml
├─ .env.example
├─ README.md
└─ package.json
```

---

# 17. Development Rules

## Integrations Are Independent

Failure of one integration must never crash the dashboard.

Example:

```text
Docker:    Healthy
WUD:       Offline
Gluetun:   Healthy
Backup:    Healthy
```

The UI should still render.

## Normalize External Data

Never pass raw Docker/WUD/Gluetun responses directly into UI components.

Each integration produces Nerve-owned models.

## Timeouts Required

Every external request gets a timeout.

No integration should be allowed to make the dashboard hang.

## Secrets Stay Server-Side

Credentials and API keys never enter browser JavaScript.

## No Shell Commands When an API Exists

Prefer:

```text
Docker Engine API
```

over:

```text
docker ps
docker stats
docker system df
```

Shelling out should require justification.

## Graceful Unknown State

Bad:

```text
VPN OFFLINE
```

when Gluetun simply failed to answer.

Better:

```text
VPN STATUS UNKNOWN
Gluetun API unavailable
```

---

# 18. V1 Milestones

## Milestone 0 — Skeleton

Create:

- repository
- Next.js TypeScript application
- Tailwind
- component primitives
- Dockerfile
- Compose stack
- configuration loader
- basic application layout

### Done when

Nerve runs in Docker and displays a static dashboard shell.

---

## Milestone 1 — Docker Integration

Implement:

- Docker connectivity
- server info
- container list
- container state
- health
- uptime
- restart count
- stats
- disk usage

Build:

- overview container summary
- containers page

### Done when

Nerve can replace `docker ps` and `docker stats` for normal status checks.

---

## Milestone 2 — Service Health

Implement configurable service checks.

Initial checks:

- Jellyfin
- Jellyseerr
- Portainer
- NPM
- WUD
- T3 Code where reachable

Add quick links.

### Done when

The dashboard identifies which major applications are reachable without opening them individually.

---

## Milestone 3 — WUD Integration

Implement:

- WUD connectivity
- update count
- per-container update state
- updates view

### Done when

Nerve reliably shows the same pending-update picture as WUD.

---

## Milestone 4 — Backup Integration

Implement:

- Offen webhook
- webhook authentication
- SQLite persistence
- latest backup card
- backup history view

Modify Offen notification configuration to send results to Nerve.

### Done when

A real backup run automatically appears in Nerve with success/failure information.

---

## Milestone 5 — Gluetun

Implement:

- VPN status
- public VPN IP
- dashboard card
- Gluetun API credential with read-only routes

### Done when

Nerve can clearly distinguish:

```text
Gluetun container running
VPN connected
VPN public IP known
```

---

## Milestone 6 — Polish

Add:

- skeleton loading states
- clean error states
- responsive layout
- status tooltips
- timestamp formatting
- stale-data indicators
- favicon/logo
- high-tech Nerve visual identity

### Done when

The dashboard feels like a real tool rather than a programming project wearing a dashboard costume.

---

## Milestone 7 — Deployment

Deploy through Portainer.

Verify:

- startup after reboot
- persistence
- integration reconnect behavior
- no public exposure
- Meshnet access
- backup webhook
- configuration documentation

Tag:

```text
v1.0.0
```

Then stop adding shit for at least five minutes.

---

# 19. V1 Acceptance Criteria

Nerve V1 is complete when all of the following are true:

- [ ] Runs as a Docker Compose / Portainer stack
- [ ] Survives host/container restart
- [ ] Dashboard loads without Internet access
- [ ] Docker status is visible
- [ ] Expected containers are listed
- [ ] Container state and health are correct
- [ ] Container CPU and memory are displayed
- [ ] Docker disk usage is displayed
- [ ] Important internal services are checked
- [ ] Quick links work
- [ ] WUD update information is displayed
- [ ] Gluetun VPN state is displayed
- [ ] Gluetun public IP is displayed
- [ ] Offen backup results arrive automatically
- [ ] Recent backup history is retained
- [ ] One failed integration does not break the application
- [ ] Secrets are not sent to the browser
- [ ] Docker access is restricted
- [ ] Nerve is not exposed publicly
- [ ] No control/write features exist
- [ ] README explains deployment and configuration
- [ ] Repository is tagged `v1.0.0`

Anything beyond this list is not required to call V1 complete.

---

# 20. Likely Post-V1 Roadmap

Only after V1 is finished.

## V1.1 — Windows Host Agent

A tiny Windows background service providing:

- host CPU
- host memory
- drive usage
- uptime
- temperatures where practical
- Windows service status

Possible communication:

```text
Windows Agent ──HTTP──► Nerve
```

Keep it read-only.

---

## V1.2 — History

Add lightweight historical charts for useful metrics only:

- CPU
- memory
- container restarts
- service availability
- backup duration/size

Do not attempt to recreate Grafana.

---

## V1.3 — Notifications

Possible Discord alerts for:

- critical container down
- backup failure
- service unreachable
- VPN disconnected

Avoid duplicating alerts already handled well by existing tools.

---

## V1.4 — Safe Actions

First control features might include:

- restart one container
- trigger an Offen backup

Actions should:

- require confirmation
- be auditable
- be narrowly scoped
- never allow arbitrary Docker API commands

Dependency-aware restart groups could come later.

Example:

```text
Gluetun
   ↓
qBittorrent
Sonarr
Radarr
Prowlarr
```

---

## V1.5 — Windows Tray Client

Small Windows client using the Nerve API.

Example:

```text
● Server       Healthy
● Backup       Success
● VPN          Connected
◐ Updates      3

Open Nerve
Open Portainer
SSH Server
```

The tray app should consume Nerve rather than independently rebuilding all integrations.

---

# 21. OpenCrew Test Opportunity

Nerve is a good practical OpenCrew test project.

Suggested initial orchestration flow:

```text
User request
    │
    ▼
crew-lead
    │
    ├── repo-scout
    │
    ├── architect
    │
    ▼
implementer
    │
    ▼
reviewer
    │
    ▼
crew-lead
```

However, OpenCrew should implement **one milestone at a time**.

Do not give an agent:

> Build Nerve.

Give it:

> Implement Milestone 1 — Docker Integration according to the Nerve V1 plan.

That gives the orchestrator a bounded target and gives us a useful way to judge whether OpenCrew actually coordinates work instead of enthusiastically creating 73 files.
