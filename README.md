# Nerve

A private, self-hosted operations dashboard for the home server.

> **Nerve observes first. It controls later.**

Nerve V1 is a read-only dashboard that answers one question fast: *"Is my
server healthy, what needs attention, and where do I go to fix it?"* It is not
a replacement for Portainer, WUD, or the applications themselves.

See [`Nerve-v1-Plan.md`](./Nerve-v1-Plan.md) for the full build plan.

---

## Status

**v1.0.1 — Milestone 7 (Deployment) complete.**

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

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

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

Nerve is deployed as a Portainer stack built from [`compose.yaml`](./compose.yaml).

1. In Portainer, go to **Stacks → Add stack**. Name the stack `nerve`
   (lowercase — the stack name becomes the compose network prefix,
   `nerve_nerve-internal`, which the backup integration below depends on).
   Choose **Web editor** and paste the contents of `compose.yaml`.
2. Under **Environment variables**, add the secrets from
   [`.env.example`](./.env.example) — at minimum:
   - `OFFEN_WEBHOOK_TOKEN` — shared secret for the backup webhook (see
     **Backup integration** below)
   - `GLUETUN_API_KEY` — read-only Gluetun API key (see
     **Gluetun read-only access** below)
   - Optional: `WUD_USERNAME` / `WUD_PASSWORD` if your WUD instance requires
     authentication. `WUD_URL` defaults to `http://wud:3000` in `compose.yaml`;
     edit the stack if your WUD runs elsewhere. `GLUETUN_URL` defaults to
     `http://gluetun:8000`.

   Keep secrets in the stack's environment variables, never in the compose
   YAML itself.
3. Click **Deploy the stack**. Portainer builds the `nerve` image and creates
   the `nerve-config` and `nerve-data` named volumes on first deploy.
4. Wait for the `nerve` container to show as **healthy** (the healthcheck polls
   `/api/health`; `start_period` is 20s), then open `http://<server-ip>:3001`.
5. To customize service names, URLs, and groups, edit `nerve.yaml` inside the
   `nerve-config` volume (Portainer → Volumes → Browse) — see
   **Configuration**.

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

2. **Environment** — see [`.env.example`](./.env.example). Secrets and
   integration URLs (Docker, WUD, Gluetun, Offen) live here, never in YAML.

Display overrides: `NERVE_TITLE`, `NERVE_SERVER_NAME`.

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
    integrations/      # docker + services + wud + backup + gluetun adapters
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
