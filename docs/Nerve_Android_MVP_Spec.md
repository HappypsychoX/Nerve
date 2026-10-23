# Nerve Android Companion — Minimum Specification

**Status:** Proposed specification · **Target baseline:** existing Nerve web dashboard v1.1 · **Date:** 2026-10-18

> This specification is based on the reported v1.1 capabilities, not a code audit. Endpoint names, storage choices, and auth integration must be reconciled with the actual repository before implementation. Do not replace existing working web-dashboard behavior.

## 1. Goal

Build a **native, read-only Android companion** to the existing Nerve v1.1 server, accessible from cellular or other off-site networks **without a VPN or companion app**. Use **Cloudflare Tunnel plus Cloudflare Access** for remote entry. Establish an extensible backend event model for future notifications from Nerve and third-party containers, but **do not implement event ingestion integrations, Firebase, push delivery, watchdog monitoring, or periodic Android checks in the first release**.

### Success criteria

- Authenticated phone reaches Nerve over cellular through the tunnel; no inbound router port is forwarded.
- App displays available current service/host status and existing incident/history information exposed by v1.1; it handles offline and stale-data states without falsely declaring an outage.
- All mobile operations are read-only; revoking a user's Access authorization terminates remote access as sessions expire or are invalidated.
- Existing web UI, monitor jobs, configuration, and Docker/Portainer deployments continue to function.
- Future event and notification providers can be added without changing the mobile status contract.

## 2. Scope

### Included in Android v1
- Native Android app (Kotlin + Jetpack Compose recommended).
- First-run server connection and authentication through a browser-based Cloudflare Access sign-in, with documented session expiry and reauthentication.
- Overview of monitored systems/services and status details, using data Nerve v1.1 actually exposes.
- Existing event/incident history **only where already available**; if v1.1 has none, omit the screen rather than building a new history system solely for mobile.
- Manual refresh; refresh on screen entry/return; explicit last-updated and connection/error states.
- API version compatibility check, sensible connection timeouts, secure credential/session handling.

### Included in backend v1 changes
- Versioned, read-only API facade over existing status data; reuse current endpoints if suitable.
- Authentication boundary and strict read-only authorization for mobile routes.
- Minimal request validation, pagination and server-side filtering for existing history if supported.
- Documentation of canonical event schema and interfaces for later ingestion/subscription/delivery.
- Health endpoint(s) separated by purpose: a minimal internal process liveness check and an authenticated status summary.

### Explicitly excluded until later
- Push notifications, FCM, per-device push tokens, Android notification permission flows.
- Raspberry Pi watchdog, external heartbeat checks, background polling or WorkManager monitoring.
- Incoming third-party webhooks, alert rules, notification subscriptions, outbound email/Discord delivery.
- Docker/container control, restart/update/backup actions, settings editing, admin screens.
- Full account-management platform, offline write queues, home-screen widgets.

## 3. Proposed network and trust boundaries

```text
Android app (cellular/Wi-Fi)
    │ HTTPS; interactive Cloudflare Access authentication
    ▼
Cloudflare Access policy (explicit authorized identity)
    ▼
Cloudflare Tunnel (cloudflared; outbound-only connection)
    ▼
Nerve API (read-only /api/v1/mobile/*)
    ▼
Existing Nerve status services and data store

Existing Nerve web dashboard: unchanged
Existing UptimeRobot: independent outage monitoring (unchanged)
```

- Use a dedicated hostname such as `nerve-api.example.com` (illustrative, not a real configured address) and restrict it to the mobile API at the reverse proxy/application layer. Never publish Portainer, Docker daemon, management routes or internal secrets through this endpoint.
- The Nerve origin should listen only on the internal interface/container network needed by the tunnel. Do not expose its port directly to the Internet.
- Restrict Cloudflare Access to explicitly approved identity/identities with MFA where available; deny by default.
- **Enforce Access token validation at the tunnel/origin**, including when the origin is accidentally contacted by another path. A tunnel is transport, not application authorization.
- Also enforce API-level authorization: remote/mobile routes are GET/HEAD-only; reject writes regardless of UI implementation. Do not rely on CORS, hidden buttons, or unguessable URLs.
- Prefer Access interactive human authentication; **never embed a global Access service token or Firebase service-account key in the APK**.
- **Implementation spike / hard gate:** verify Cloudflare Access browser sign-in and authenticated native API requests on the target Android HTTP stack. Access cookies/session sharing between Custom Tabs and native HTTP clients can be nontrivial. Choose and document a supported secure session handoff mechanism before the rest of app development. If the approach cannot be made robust, revisit the identity design rather than silently exposing unauthenticated API routes.
- TLS certificate validation remains enabled; do not bypass errors or accept all certificates.
- Do not log Access cookies, access JWTs, authentication headers, API keys, or other secrets. Encrypt sensitive locally persisted credentials using Android Keystore-backed primitives; avoid storing unnecessary tokens at all.

## 4. Minimum API contract

These are **proposed** paths; preserve existing API conventions where possible. All data routes require authorization and respond with JSON; all endpoints must use consistent IDs, UTC ISO 8601 timestamps, stable status vocabulary, and schema versioning.

| Method | Proposed path | Purpose |
|---|---|---|
| GET | `/api/v1/mobile/meta` | API/schema version, server version, supported features, server timestamp |
| GET | `/api/v1/mobile/overview` | Aggregate health and list of monitored items, status, last check |
| GET | `/api/v1/mobile/items/{id}` | Single item details; current status and existing check metadata |
| GET | `/api/v1/mobile/incidents?limit=&cursor=` | Existing incident/history records, **if available in v1.1** |
| GET | `/internal/health/live` | Minimal process liveness for trusted LAN/internal use only; no sensitive data |

- Return `401` for missing/expired authentication; `403` for denied identity or permission; `404` for unknown IDs; `429` for excessive requests; `503` for genuinely unavailable dependencies. Avoid leaking stack traces.
- Return `Cache-Control: no-store` for sensitive responses; set conservative request size/time limits and rate limits at appropriate layers.
- Mobile must display **Unknown/Unavailable** (rather than **Down**) when it cannot contact Nerve.
- Do not invent monitor data Nerve does not already collect.

Example read-only overview response (illustrative):

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-18T18:00:00Z",
  "overallStatus": "degraded",
  "items": [
    {
      "id": "jellyfin",
      "name": "Jellyfin",
      "status": "healthy",
      "lastCheckedAt": "2026-10-18T17:59:41Z"
    }
  ]
}
```

Allowed status values should be enumerated explicitly (e.g. `healthy`, `degraded`, `down`, `unknown`) and mapped to existing Nerve v1.1 semantics during implementation.

## 5. Android user experience

1. **Connect:** app asks for Nerve URL or uses a configurable prefilled URL; user authenticates through Access's approved interactive flow.
2. **Overview:** services/hosts with status badges, last refresh timestamp, manual refresh, and clear loading/error states.
3. **Detail:** tap a monitored item to see information already exposed by Nerve.
4. **History:** show existing incidents only if supported by Nerve; otherwise explicitly defer.
5. **Settings:** server endpoint, sign out/clear session, about/API versions; no administrative controls.

Minimum mobile behavior: support current mainstream Android versions (set exact `minSdk` during implementation); dark/light theme; accessible labels; no background service; no Firebase SDK requirement; no device administrator permissions.

## 6. Notification foundation — design now, implement later

The first release **documents and preserves extension points** without creating an operational notification subsystem prematurely.

### Canonical event record (future contract)

```json
{
  "id": "evt_01EXAMPLE",
  "schemaVersion": 1,
  "source": "offen",
  "type": "backup.failed",
  "severity": "error",
  "title": "Backup failed",
  "message": "Cloud upload was unsuccessful",
  "occurredAt": "2026-10-18T18:00:00Z",
  "receivedAt": "2026-10-18T18:00:02Z",
  "dedupeKey": "offen:backup:run-123:failed",
  "metadata": {}
}
```

- Keep **event intake**, **event storage**, **rule/filter evaluation**, and **notification delivery** separate. An event must remain available even when a push provider is offline.
- Reserve an adapter interface for existing emitters: Offen, WUD, CrowdSec, Jellyfin, Sonarr/Radarr, etc. Each adapter should map native messages into the canonical event schema without requiring mobile changes.
- Future incoming webhook routes must have **per-source credentials**, replay resistance, request size limits, rate limiting, schema validation, and tightly bounded metadata. They must not permit arbitrary command execution.
- Define future `NotificationChannel` abstraction (e.g. FCM Android push, Discord, email). Keep FCM optional, with credentials **server-side only**.
- Design for event deduplication, severity categories, timestamps, retention policy, retry/backoff, and device-specific preferences later. Do not prematurely build these features into v1.
- Future mobile notification taps should deep-link to a Nerve incident/event identifier; avoid placing secrets or private diagnostics in push payloads.
- Do not make notifications dependent on Nerve being reachable during a total host outage. External watchdog/FCM architecture is a separate future design decision; UptimeRobot remains the existing outage path.

### Prepared future API namespace (not implemented in v1)
- `POST /api/v1/events/ingest/{source}` — authenticated per-source ingestion.
- `GET /api/v1/events` — authorized event history.
- `POST /api/v1/devices` — register a paired device (with ownership verification).
- `PUT /api/v1/devices/{id}/notifications` — notification preferences.

**Important:** Do not expose placeholder routes accepting requests in v1. Reserve names/contracts in documentation only.

## 7. Implementation order

**M0 — Inspect and map v1.1:** inventory existing backend routes, auth, status models, incidents, database, deployment/network layout; identify reused components and missing fields. No migrations unless unavoidable.

**M1 — Secure connectivity proof:** establish Tunnel, Access policy, origin validation, and **real Android native session acquisition/renewal**. Test on mobile data, not just LAN. This is the go/no-go gate.

**M2 — Read-only mobile API:** reuse the existing status service with stable versioned DTOs, input validation, permission checks, and automated tests. Do not perturb web-dashboard endpoints.

**M3 — Native Android MVP:** sign-in, overview, details, optional existing history, loading/offline/auth-expiry states.

**M4 — Notification-ready documentation:** commit canonical event schema and adapter/delivery interfaces as docs/types where appropriate; no notification infrastructure or dependencies deployed.

## 8. Acceptance tests

- From cellular with no VPN, authorized Android client signs in and views current Nerve status.
- An unauthorized client and a revoked/expired client cannot retrieve API data; protected data is not accessible by direct origin/LAN bypass except through separately authenticated local access as explicitly configured.
- All non-read HTTP methods on mobile API are rejected (including attempts using a valid session).
- The app accurately distinguishes healthy/degraded/down status **reported by Nerve** from inability to contact Nerve itself.
- Existing v1.1 website and Docker deployment still work; no regression to status, history, or monitoring.
- No monitoring workers, push SDK, watchdog, Firebase project, notification pipeline, or new container event listeners required to deploy v1.
- A versioned notification event schema and future integration boundaries are documented for subsequent milestones.

## 9. Open implementation questions (resolve from repository; do not block the spec)

- Which Nerve v1.1 status/history endpoints and authorization mechanisms already exist?
- Does Nerve's deployment already include a suitable reverse proxy and Cloudflare Tunnel instance, and what is the intended API hostname?
- Which Android OS versions/devices are actually targeted?
- Which supported Cloudflare Access native-app sign-in pattern will securely bridge browser authentication to the app's network client?
- Does existing incident history warrant a v1 screen, or should it be deferred?

## 10. Non-goals and guardrails

Keep the first release **boring and small**. Do not add an independent monitoring platform, device-wide VPN, full SSO product, generic user/role management, or generic message bus just to serve one phone. Maintain strict read-only separation and leave an intentional seam for future container-generated notifications.

### Vendor reference notes
- [Cloudflare: publish a self-hosted application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- [Cloudflare: Access applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/)
- [Firebase: architecture for later push delivery](https://firebase.google.com/docs/cloud-messaging/fcm-architecture)
- [Firebase: trusted sending environment](https://firebase.google.com/docs/cloud-messaging/server-environment)
