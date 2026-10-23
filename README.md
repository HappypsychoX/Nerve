# Nerve

A private, self-hosted operations dashboard for the home server.

> **Nerve observes first. It controls later.**

Nerve V1 is a read-only dashboard that answers one question fast: *"Is my
server healthy, what needs attention, and where do I go to fix it?"* It is not
a replacement for Portainer, WUD, or the applications themselves.

See [`Nerve-v1-Plan.md`](./Nerve-v1-Plan.md) for the full build plan.

---

## Status

**v1.1.1 — TLS trust security patch; Jellyfin activity monitoring.**

The container uses Node 22.23.4 and Alpine CA certificates 20261020-r0 or
newer. HTTPS service checks now verify certificates. See the
[October 2026 TLS patch notes](./docs/TLS-Trust-2026-10.md) for evidence,
isolated verification, deployment requirements and rollback.

Read-only, real-time Jellyfin activity (currently playing, paused, and idle
clients) is shown on the Overview page; see **Jellyfin activity monitoring**
below.

Milestones 0–7 are implemented:

- A Next.js + TypeScript application shell with a dark operations-console layout
- Responsive navigation for **Overview**, **Containers**, **Backups**, and **Updates**
- Live Docker integration (containers, stats, disk) via a read-only socket proxy
- Configurable service health checks with an overall-health summary
- WUD update tracking
- Backup integration: an authenticated Offen webhook, SQLite persistence, and a
  real backups view (see **Backup integration** below)
- Gluetun/VPN status monitoring
- A basic YAML configuration loader
- A production `Dockerfile` and `compose.yaml` stack
- Deployment readiness: Portainer stack documentation, container healthchecks,
  restart policy, non-root standalone image, and the `v1.0.1` release tag

Not implemented, by design: Nerve V1 has no authentication, no actions, no
alerts, and no historical metrics (plan §4, "Explicitly NOT in V1"). Actions,
alerts, and history are on the post-V1 roadmap (plan §20) — they were never
part of Milestone 7.

---

## Tech stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Lucide** icons
- **YAML** config (via `yaml`), with secrets kept in environment variables

---

## Local development

Requirements: Node.js 22.23.4+ on the 22.x line and npm (`.nvmrc` pins
22.23.4). Patched 24.x (24.22.1+) and 26.x (26.12.1+) are also accepted by
`engines`; the production container stays on Node 22.

```bash
npm install
npm run dev
```

`npm run test:tls` is an opt-in external HTTPS regression check. All four
eMudhra test hosts must fail certificate validation while the normal HTTPS
controls succeed. Network failures are failures, not proof of remediation.

Open http://localhost:3000.

Useful scripts:

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `npm run dev`   | Start the development server       |
| `npm run build` | Production build                   |
| `npm run start` | Serve a production build           |
| `npm run lint`  | Run ESLint                         |
| `npm test`      | Run unit tests (Vitest)            |

---

## Running with Docker

Requirements: Docker with the Compose plugin.

```bash
docker compose up --build
```

Open http://localhost:3001 (`compose.yaml` maps host `3001` to container `3000`).

`compose.yaml` mounts two named volumes:

- `nerve-config` — seeded from the image's `config/` directory; drop a
  `nerve.yaml` in here (or set `NERVE_CONFIG_PATH`) to override defaults.
- `nerve-data` — holds the SQLite database at `/app/data/nerve.db` (backup run
  history).

To inject secrets and connection details, create a `.env` from
[`.env.example`](./.env.example); `docker compose` reads it automatically.

For Portainer deployment, see **Deployment (Portainer)** below.

---

## Deployment (Portainer)

Use [`deploy/portainer.compose.yaml`](./deploy/portainer.compose.yaml) for the
existing Portainer deployment. It is a complete, first-party template matching
the prepared external `Nerve_Stack/docker-compose.yaml`: remote Nerve `#master`
build, inline display YAML, existing named volumes/network, and the scoped
Portainer public-certificate mount. Use it by itself; `compose.yaml` remains
the portable local-build example.

1. Review the template against the **existing `nerve` stack**. Preserve the
   stack name, volume names, secrets and any intentional local customizations.
   Do not create a second stack alongside containers with the same names.
   A first installation also uses stack name `nerve` to retain the expected
   `nerve_nerve-internal` network prefix.
2. Verify the public certificate already provisioned at
   `C:\ProgramData\Nerve\trust\portainer-probe.pem`. The template binds its
   Docker Desktop Linux path read-only at `/run/configs/portainer-probe.pem`
   and includes the active `checkTls` configuration. Follow the
   [certificate provisioning, rotation and verification guide](./docs/Portainer-Health-TLS.md).
   On another Docker host, replace the source with its verified absolute host
   path. Never mount Portainer's data volume or private key into Nerve.
3. Keep `JELLYFIN_URL`, `JELLYFIN_API_KEY`, `OFFEN_WEBHOOK_TOKEN`,
   `GLUETUN_API_KEY` and optional `WUD_USERNAME`/`WUD_PASSWORD` in Portainer's
   stack environment. The template contains substitutions, never credentials.
4. Publish/build the approved Nerve patch on the effective source ref before
   deployment: the template uses GitHub `#master`, so local edits or a feature
   branch alone do not reach that build. After explicit deployment approval,
   synchronize the template into the existing stack's editor or Git source
   and recreate **only Nerve**. Portainer's Update/Deploy action applies the
   stack; editing this repository does not change an already-running container.
5. Confirm the Nerve healthcheck, the live read-only certificate mount,
   Portainer `online` / HTTP 200 in `/api/services/health`, and the existing
   integrations. Display/health configuration lives in
   `configs.nerve-display-config.content`, mounted at `/run/configs/nerve.yaml`
   via `NERVE_CONFIG_PATH`. Edit that inline block for this deployment;
   `/app/config/nerve.yaml` and the fallback example do not override it.

Both services use `restart: unless-stopped`, so the stack comes back
automatically after a host reboot.

---

## Configuration

Nerve reads a YAML file for non-secret display configuration and environment
variables for secrets and connection details.

1. **YAML** — [`config/opNervexample.yaml`](./config/opNervexample.yaml) is the
   documented example and fallback default. Copy it to `config/nerve.yaml` to
   customize (service names, URLs, groups, criticality).

   The config loader resolves the file in this order:

   1. `NERVE_CONFIG_PATH` (environment variable)
   2. `config/nerve.yaml`
   3. `config/opNervexample.yaml` (fallback)

   The Portainer template sets `NERVE_CONFIG_PATH=/run/configs/nerve.yaml` and
   supplies that file from its inline config. Its Portainer TLS settings and
   certificate bind must be kept together when customizing the template.

2. **Environment** — see [`.env.example`](./.env.example). Secrets and
   integration URLs (Docker, WUD, Gluetun, Jellyfin, Offen) live here, never in
   YAML.

Display overrides: `NERVE_TITLE`, `NERVE_SERVER_NAME`.

HTTPS `checkUrl` values require a trusted certificate with a matching
hostname. Self-signed endpoints (including a default Portainer certificate)
will show offline/unreachable. Use a valid HTTPS endpoint, a vetted private
CA, or an internal HTTP health URL on a trusted network. Never disable TLS
validation to restore a green status.

For the installed Portainer endpoint, the [scoped TLS probe guide](./docs/Portainer-Health-TLS.md)
documents a verified public-certificate mount and per-service `checkTls`
settings. These preserve validation without changing global Node trust or
opening Portainer's HTTP port.

---

## Gluetun read-only access

Nerve reads VPN status from Gluetun's control server (`GLUETUN_URL`, default
`http://gluetun:8000`) using a **read-only, role-scoped API key** sent as the
`X-API-Key` header. It calls exactly two routes and nothing else:

- `GET /v1/vpn/status`
- `GET /v1/publicip/ip`

Setup:

1. Generate a key on the Docker host:

   ```bash
   docker run --rm qmcgaw/gluetun genkey
   ```

2. Register the key in Gluetun's control-server authentication configuration,
   scoped to only the two GET routes above (see Gluetun's control server
   authentication documentation for the exact syntax of your Gluetun version).
   Do not grant Nerve's key any other route — Nerve never writes to Gluetun.
3. Set `GLUETUN_API_KEY=<key>` in Nerve's environment (Portainer stack
   environment variables, or `.env` for local compose). Never commit it.
4. Recreate the Nerve container. The VPN card shows connection state and the
   public VPN IP. If the key is missing or rejected (401/403), the card
   degrades gracefully — a broken Gluetun integration never blocks the rest of
   the dashboard.

## Jellyfin activity monitoring

Nerve shows real-time, **read-only** Jellyfin activity on the **Overview** page:
currently playing, paused, and recently connected idle clients, plus transcode
details and poster artwork. Nerve never plays, pauses, stops, or otherwise
controls Jellyfin, and it never writes to Jellyfin.

### API key (dedicated and revocable)

Jellyfin API keys are **not read-only scoped** — a Jellyfin key can perform any
action the server allows, including writes and admin operations. Nerve does not
"downgrade" the key; it protects you by only ever issuing read-only GET requests
(see **Read-only allowlist** below).

- Create a **dedicated key named "Nerve"** in **Jellyfin → Dashboard → API
  Keys**. Do not reuse a personal or admin key.
- Store it in `JELLYFIN_API_KEY` (see `.env.example`). Never commit it, never
  put it in YAML, and never put it in a URL or query string.
- Revoke and rotate the key at any time without affecting the rest of Jellyfin;
  Nerve reports `unauthorized` until you restart it with the new key.

### Read-only allowlist

Nerve calls exactly these Jellyfin endpoints, and nothing else:

| Endpoint | Purpose | Auth |
| --- | --- | --- |
| `GET /System/Info/Public` | Server version (diagnostics) | none |
| `GET /Sessions?activeWithinSeconds=960` | Active sessions | `MediaBrowser Token="<key>"` |
| `GET /Items/{id}/Images/Primary` | Poster artwork (via proxy) | retry-only |

The key is sent in the `Authorization: MediaBrowser Token="<key>"` header, never
in a URL. Redirects are never followed. Requests are bounded (5-second timeout),
and poster fetches are constrained to a fixed width/quality (`maxWidth=600`,
`quality=80`), JPEG/PNG/WebP only, and a 2 MB maximum body.

### Environment vs display-only YAML

- **Environment variables** (`JELLYFIN_URL`, `JELLYFIN_API_KEY`) carry the
  connection details and the secret. They are server-side only and are never
  sent to the browser.
- **YAML** (`config/opNervexample.yaml`) carries only display toggles:

  ```yaml
  jellyfin:
    enabled: true
    showPosters: true
    showIdleClients: true
  ```

  Do **not** add `url`, `apiKey`, or `refreshIntervalSeconds` to YAML.

### Container networking

`JELLYFIN_URL` must be reachable **from inside the Nerve container**:

- **Shared Docker network** — if Jellyfin and Nerve share a Docker network, use
  the service/container name, e.g. `JELLYFIN_URL=http://jellyfin:8096`. Nerve's
  compose does not auto-join Jellyfin's network; attach it explicitly (for
  example, as an external network).
- **Host address** — otherwise use a host-reachable address such as
  `JELLYFIN_URL=http://192.168.40.186:8096`.

The value in this repository's `compose.yaml` is a pass-through
(`${JELLYFIN_URL:-}`); production Compose definitions are maintained separately
(in Shitflix-Docker), where the Portainer environment substitutions are already
configured.

### TLS

- If the Jellyfin endpoint uses a certificate Nerve does not trust (for example,
  a self-signed certificate), prefer **internal HTTP over a trusted Docker
  network** instead.
- **Never disable TLS certificate verification.** Requests that carry the API
  key must not be sent to an unverified endpoint.

### Restart after configuration changes

Nerve's config loader caches the loaded configuration for the process lifetime,
and environment variables are read at startup. After changing `JELLYFIN_URL`,
`JELLYFIN_API_KEY`, or the display-only YAML block, **restart (recreate) the
Nerve container** for the change to take effect.

### Polling

The Overview page polls Jellyfin sessions **every 10 seconds, and only while
Overview is mounted**. Navigating to Containers, Backups, or Updates stops the
polling; returning to Overview resumes it. Poll ticks are skipped while a
previous request is still in flight, so slow responses never overlap.

### Privacy and data exposure

- Nerve is **LAN-only** with no application authentication (see
  **Network exposure**). Do not expose it publicly.
- The Jellyfin session payload is normalized through a strict field allowlist.
  `RemoteEndPoint`, `DeviceId`, `UserId`, capabilities, queues, raw session
  objects, and the API key are **never** sent to the browser or written to logs.
- Poster artwork is served through Nerve's own bounded proxy
  (`/api/jellyfin/artwork/[itemId]?tag=...`); Jellyfin's URL and credentials
  never reach the browser.
- Anonymous/DLNA sessions are shown as "Unidentified client" without fabricating
  a username.

### Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| "Jellyfin is not configured" | `JELLYFIN_URL`/`JELLYFIN_API_KEY` empty — set them and restart Nerve. |
| "Jellyfin API key was rejected" | Bad or revoked key — recreate the "Nerve" key and restart Nerve. |
| "Jellyfin is offline or unreachable" | Nerve cannot reach `JELLYFIN_URL` — check the network/host and restart. |
| "Jellyfin returned an unexpected response" | Unexpected upstream response — check Jellyfin health/version. |
| No poster is shown | `showPosters: false` hides posters — set it to `true` and restart Nerve. |
| Poster shows a placeholder icon | `showPosters: true` but no usable artwork reference, or the image failed to load. |
| "Jellyfin monitoring is disabled" | `jellyfin.enabled: false` — the section stays visible but stops polling; enable it and restart Nerve. |

## Network exposure

Nerve is a LAN-only dashboard. "No Internet Exposure" (plan §4) is a hard rule:

- Reach Nerve at `http://<server-ip>:3001` from the LAN only.
- Do **not** create a proxy host for Nerve in Nginx Proxy Manager or any other
  public reverse proxy, and do **not** port-forward port `3001` on your router.
- For remote access, use your meshnet: install the mesh client on the remote
  device and open `http://<server-ip>:3001` over the mesh network. No inbound
  ports are opened on the server.
- Inside compose, only the `3001:3000` host mapping is published; the
  `nerve-internal` network is private, and the Docker socket proxy publishes
  no ports at all.

---

## Backup integration (Offen / docker-volume-backup)

Nerve records backup runs from
[`offen/docker-volume-backup`](https://github.com/offen/docker-volume-backup)
containers — the plan calls this "Offen". Backup events are **webhook-driven**;
Nerve does not poll the backup tool. Each notification is normalized into a
Nerve-owned `BackupRun` and stored in SQLite at `NERVE_DATABASE_PATH` (default
`/app/data/nerve.db`, on the `nerve-data` volume).

Nerve is read-only with respect to backups: it never triggers, restores, browses,
or deletes backups.

### Endpoint

```text
POST /api/webhooks/offen
X-Nerve-Token:  <OFFEN_WEBHOOK_TOKEN>     (required)
X-Nerve-Source: local | cloudflare        (optional; enables per-source health)
```

- A missing or incorrect token is rejected with `401`; a malformed or oversized
  (over 64 KB) body with `400`. All responses are JSON.
- The token is compared timing-safely and stays server-side. It is never sent to
  the browser.

### Configure the backup containers

Mount the notification template and point each container at Nerve. The
`@`-prefixed query parameters become HTTP headers (shoutrrr generic service):

```yaml
services:
  volume-backup-local:
    environment:
      NOTIFICATION_LEVEL: info
      NOTIFICATION_URLS: generic://nerve:3000/api/webhooks/offen?@X-Nerve-Token=${OFFEN_WEBHOOK_TOKEN}&@X-Nerve-Source=local&template=json
    volumes:
      - ./config/offen/nerve.tmpl:/etc/dockervolumebackup/notifications.d/nerve.tmpl:ro

  volume-backup-cloudflare:
    environment:
      NOTIFICATION_LEVEL: info
      NOTIFICATION_URLS: generic://nerve:3000/api/webhooks/offen?@X-Nerve-Token=${OFFEN_WEBHOOK_TOKEN}&@X-Nerve-Source=cloudflare&template=json
    volumes:
      - ./config/offen/nerve.tmpl:/etc/dockervolumebackup/notifications.d/nerve.tmpl:ro
```

- `NOTIFICATION_LEVEL: info` sends notifications for **both** success and failure
  (the default is failure only).
- [`config/offen/nerve.tmpl`](./config/offen/nerve.tmpl) renders a compact JSON
  body (`status` + Offen `Stats` + `error`). It never emits the Offen `Config`
  object, which contains secrets such as `GPG_PASSPHRASE` and cloud credentials.
- `X-Nerve-Source` distinguishes the local (daily) and cloud (weekly) schedules.
  Without it, runs are evaluated under a generic, lenient window.
- The backup containers must be able to resolve `nerve:3000`, i.e. share a Docker
  network with Nerve:

  ```bash
  docker network connect nerve_nerve-internal volume-backup-local
  docker network connect nerve_nerve-internal volume-backup-cloudflare
  ```

  This is not persistent: to survive a stack redeploy, declare the external
  network in the backup stack's own compose file (`networks:` + `services.*.networks`).

The `nerve_` prefix comes from the Portainer stack name `nerve` (see **Deployment (Portainer)**). If you named the stack differently, adjust the network name accordingly.

### Secret

`OFFEN_WEBHOOK_TOKEN` is a shared secret. Set it in `.env` (see
[`.env.example`](./.env.example)); `compose.yaml` passes it to the `nerve`
service and the same value goes in each backup container's `NOTIFICATION_URLS`.

### Health semantics

Nerve also watches containers named `volume-backup-*` through the Docker adapter
as a fallback signal, so it can distinguish *"backup failed"* from *"backup
status unknown because the backup tool is down"*:

| Condition                                              | Backup status |
| ------------------------------------------------------ | ------------- |
| Latest run succeeded within its threshold              | Healthy       |
| Latest run failed, or succeeded but overdue            | Degraded      |
| No runs recorded, or backup container down, or DB error | Unknown       |

Thresholds are constants in `src/lib/integrations/backup/status.ts`: **26 h** for
the local/daily schedule and **8 d** for the cloud/weekly schedule. A confirmed
failure or overdue run degrades overall health; absent data stays `unknown` and
never falsely reads as `failed`/`offline`.

### Test

```bash
curl -X POST http://localhost:3001/api/webhooks/offen \
  -H "Content-Type: application/json" \
  -H "X-Nerve-Token: $OFFEN_WEBHOOK_TOKEN" \
  -H "X-Nerve-Source: local" \
  -d '{"status":"success","stats":{"StartTime":"2026-09-12T07:30:00Z","EndTime":"2026-09-12T07:38:42Z","TookTime":522000000000,"BackupFile":{"Name":"backup.tar.zst","Size":1932735283},"Containers":{"Stopped":2,"StopErrors":0},"Storages":{"Local":{"Total":31,"PruneErrors":0}}}}'
```

A successful post returns `{"ok":true,"id":<n>}`. View the result on **Backups**
(`/backups`) or via `GET /api/backups`.

---

## Project structure

```text
src/
  app/                 # routes: overview, containers, backups, updates, api
  components/
    layout/            # app shell, sidebar, topbar, clock
    dashboard/         # overview panels
    backups/           # backups view
    ui/                # shared primitives (cards, status dots, metrics)
  lib/
    config/            # YAML configuration loader + types + matching
    db/                # SQLite + Drizzle schema, client, repository
    integrations/      # docker + services + wud + backup + gluetun + jellyfin adapters
    health.ts          # status model helpers
    utils.ts
  types/               # shared domain models (ContainerStatus, BackupRun, ...)
config/
  opNervexample.yaml   # example + fallback configuration
  offen/nerve.tmpl     # offen/docker-volume-backup notification template
Dockerfile
compose.yaml
.env.example
```

---

## Milestones

| Milestone | Scope                       | Status |
| --------- | --------------------------- | ------ |
| 0         | Skeleton                    | ✅     |
| 1         | Docker integration          | ✅     |
| 2         | Service health              | ✅     |
| 3         | WUD integration             | ✅     |
| 4         | Backup integration          | ✅     |
| 5         | Gluetun                     | ✅     |
| 6         | Polish                      | ✅     |
| 7         | Deployment                  | ✅     |
