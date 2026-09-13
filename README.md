# Nerve

A private, self-hosted operations dashboard for the home server.

> **Nerve observes first. It controls later.**

Nerve V1 is a read-only dashboard that answers one question fast: *"Is my
server healthy, what needs attention, and where do I go to fix it?"* It is not
a replacement for Portainer, WUD, or the applications themselves.

See [`Nerve-v1-Plan.md`](./Nerve-v1-Plan.md) for the full build plan.

---

## Status

**Milestone 6 — Polish** (current).

Milestones 0–6 are implemented:

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

Not yet implemented: authentication, actions, alerts, and historical metrics.
Those arrive in Milestone 7.

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
| 7         | Deployment                  | ⏳     |
