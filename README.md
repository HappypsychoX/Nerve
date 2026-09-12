# Nerve

A private, self-hosted operations dashboard for the home server.

> **Nerve observes first. It controls later.**

Nerve V1 is a read-only dashboard that answers one question fast: *"Is my
server healthy, what needs attention, and where do I go to fix it?"* It is not
a replacement for Portainer, WUD, or the applications themselves.

See [`Nerve-v1-Plan.md`](./Nerve-v1-Plan.md) for the full build plan.

---

## Status

**Milestone 0 — Skeleton** (current).

This repository currently provides:

- A Next.js + TypeScript application shell with a dark operations-console layout
- Responsive navigation for **Overview**, **Containers**, **Backups**, and **Updates**
- A placeholder overview dashboard (static sample data)
- A basic YAML configuration loader
- A production `Dockerfile` and `compose.yaml` stack

Not yet implemented: Docker/WUD/Offen/Gluetun integrations, service health
checks, authentication, actions, alerts, and historical metrics. Those arrive
in Milestones 1–7.

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

Open http://localhost:3000.

`compose.yaml` mounts two named volumes:

- `nerve-config` — seeded from the image's `config/` directory; drop a
  `nerve.yaml` in here (or set `NERVE_CONFIG_PATH`) to override defaults.
- `nerve-data` — reserved for future SQLite persistence (Milestone 4).

To inject secrets and connection details (used in later milestones), create a
`.env` from [`.env.example`](./.env.example) and uncomment the `env_file` block
in `compose.yaml`, or run `docker compose --env-file .env up --build`.

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

## Project structure

```text
src/
  app/                 # routes: overview, containers, backups, updates, api
  components/
    layout/            # app shell, sidebar, topbar, clock
    dashboard/         # overview panels
    ui/                # shared primitives (cards, status dots, metrics)
  lib/
    config/            # YAML configuration loader + types
    health.ts          # status model helpers
    mock/              # static placeholder data (Milestone 0 only)
    utils.ts
  types/               # shared domain models (ContainerStatus, ...)
config/
  opNervexample.yaml   # example + fallback configuration
Dockerfile
compose.yaml
.env.example
```

---

## Milestones

| Milestone | Scope                       | Status |
| --------- | --------------------------- | ------ |
| 0         | Skeleton                    | ✅     |
| 1         | Docker integration          | ⏳     |
| 2         | Service health              | ⏳     |
| 3         | WUD integration             | ⏳     |
| 4         | Backup integration          | ⏳     |
| 5         | Gluetun                     | ⏳     |
| 6         | Polish                      | ⏳     |
| 7         | Deployment                  | ⏳     |
