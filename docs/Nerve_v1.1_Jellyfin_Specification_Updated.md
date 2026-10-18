# Nerve v1.1 — Jellyfin Integration
**Status:** Real-server verification gate (M0) completed, revised 2026-10-17. **M1 (integration & configuration), M2 (API routes), M3 (dashboard/polling), and M4 (technical details/posters) implemented and validated 2026-10-18; M5 (documentation, validation, release preparation) completed 2026-10-18.** The `1.1.0` version bump is applied and all release-blocking manual acceptance checks are confirmed; the remaining non-blocking items are recorded in §8.  
**Progress:** M1–M5 are implemented and validated under this specification; release/versioning (`1.1.0`) is complete. The M1–M5 requirements below are unchanged and still binding.  
**Basis:** Original v1.1 specification and Claude Opus 5.5 planning review of Nerve `master`, v1.0.1 (`7681fb5`).

## 1. Release goal and locked decisions

Add read-only, real-time Jellyfin activity to Nerve's existing Next.js dashboard without changing the deployment architecture or impairing existing monitoring.

| Decision | Final requirement |
|---|---|
| Placement | Expandable **full-width section after the main 2×2 grid and before ServicesPanel** on Overview |
| Polling | **10 seconds**, only while Overview is mounted; fix the shared `usePolled` hook to prevent overlapping requests |
| Artwork | Enabled; secure bounded server-side image proxy and fixed-size fallback |
| Activity | Playing, paused, and connected idle clients shown separately |
| Idle window | Request sessions active within **960 seconds**; verified on Jellyfin **10.11.11**, including expiration of idle sessions older than 960 seconds |
| Anonymous clients | **Include**, using a generic label such as “Unidentified client”; do not invent a username |
| Health | **Jellyfin section only**; do not add duplicate Attention items or modify `computeOverallHealth` |
| Servers | One Jellyfin instance |
| API | Read-only, allowlisted GET endpoints |
| Historical reporting, playback controls, Android, multiple Jellyfin instances | Out of scope |

### Existing Nerve conventions to preserve
- URLs and secrets for integrations are environment variables, **not YAML**.
- `NerveConfig` is passed into the browser-facing `AppShell`; never add the upstream URL or API key to that object.
- Config loader drops unknown keys and caches loaded config for process lifetime: explicitly parse the new display-only block and document restart after changes.
- Follow the Gluetun integration client, route-handler and existing UI-component patterns.
- Keep the dashboard section on Overview; do not add its polling to `DashboardProvider`, which is mounted across pages.
- Existing service checks may already monitor Jellyfin. The Jellyfin section reports its own API/auth state, **without duplicating overall health or Attention alerts**.

## 2. Configuration and connectivity

Environment variables (server-side only):

```dotenv
JELLYFIN_URL=http://<reachable-jellyfin-host>:8096
JELLYFIN_API_KEY=<dedicated-revocable-jellyfin-api-key>
```

YAML (display-only; parsed and defaulted by `loadConfig()`):

```yaml
jellyfin:
  enabled: true
  showPosters: true
  showIdleClients: true
```

- Do **not** add `url`, `apiKey`, or `refreshIntervalSeconds` to YAML or `NerveConfig`.
- Define `JELLYFIN_POLL_INTERVAL_MS = 10000` in the client hook.
- `JELLYFIN_URL` must be reachable **from the Nerve container**. `http://jellyfin:8096` works only if containers share a resolvable Docker network; otherwise configure a reachable host address. Document both options without silently modifying Docker networks.
- Prefer internal HTTP on a trusted Docker network when the Jellyfin endpoint uses a self-signed certificate; **never disable TLS certificate verification** for requests carrying the API key.
- Jellyfin API keys are not read-only scoped. Create a dedicated, revocable key named “Nerve”; Nerve enforces read-only behavior by its fixed GET-only request paths.
- Disabled/unconfigured states make **zero upstream network requests**. When unconfigured, show actionable configuration guidance. Config changes require container restart.

## 3. Jellyfin API verification (M0 complete)

The installed Jellyfin server was verified before implementation. No credentials, raw session payloads, or personally identifying session values are retained in this specification.

**Confirmed on Jellyfin 10.11.11:**
1. `Authorization: MediaBrowser Token="<key>"` authenticated successfully, and session queries succeeded. Never put the key in a URL/query string.
2. `GET /System/Info/Public` reported version `10.11.11`; public info alone does **not** establish API-key validity.
3. `GET /Sessions?activeWithinSeconds=960` was accepted, and idle sessions older than 960 seconds were observed to expire from the filtered results. **960 seconds is the chosen policy, not a verified Jellyfin dashboard default.**

**Not observed in the live verification; implement safe fallbacks and cover them with fixtures/tests:**
- Transcoding sessions and `TranscodingInfo` details.
- Anonymous/DLNA sessions.
- Album artwork references and successful artwork retrieval.

Do not infer that these fields or cases are absent from Jellyfin generally. Treat missing values as unavailable, keep anonymous identity generic if encountered, and show the artwork placeholder when no usable image reference or image is available.

The following remain defensive implementation/test requirements because the live verification did not establish them: bad-key status mapping; all optional session field shapes and transcode-reason encodings; episode artwork references; image authentication requirements; and whether Nerve's own API requests create an idle session. Never place API keys in browser-facing URLs. Avoid adding a Jellyfin device identity to Nerve requests unless necessary; if one is required, prevent Nerve's own session from appearing as a client.

## 4. Normalization and data contract

### Session classification
- `NowPlayingItem` present + `PlayState.IsPaused` true → `paused`.
- `NowPlayingItem` present + not paused → `playing`.
- No `NowPlayingItem` → `idle`.
- Each returned session belongs to exactly one state; totals are derived from normalized sessions. `transcoding` is a **subset** of playing/paused sessions, not a fourth mutually exclusive state.
- Anonymous sessions remain included; render “Unidentified client” and preserve any available client/device label without fabricating identity.
- Stable sort: playing, paused, idle; within groups by displayed user label and session ID.

### Playback fields
- Method: map `DirectPlay`, `DirectStream`, `Transcode`; if absent, use presence of `TranscodingInfo` as a transcode fallback, otherwise `null`.
- Represent missing user, device, codecs, position, duration, or resolution as `null`; UI displays “Unavailable” or an appropriate dash, never `NaN` or misleading `0%`.
- Convert Jellyfin ticks to seconds on the server (**10,000,000 ticks/second**). Live TV or unknown duration has no percentage progress.
- Distinguish **source** codecs/resolution from **transcode output** codecs/resolution when provided. Do not infer unreported output data.
- TV episodes display series, season and episode context when available. No dedicated music or Live TV layout is required.
- Use a **field allowlist** to construct response objects. Never forward raw Jellyfin sessions or expose `RemoteEndPoint`, `DeviceId`, `UserId`, capabilities, queues, tokens, or upstream headers.

### Proposed normalized response (illustrative, subject to fixture validation)
```json
{
  "status": "online",
  "observedAt": "2026-10-17T12:00:00Z",
  "counts": { "playing": 1, "paused": 0, "idle": 1, "transcoding": 0 },
  "sessions": [{
    "id": "opaque-session-id",
    "user": "Unidentified client",
    "client": "Jellyfin Android TV",
    "device": "Living Room TV",
    "state": "playing",
    "media": {
      "id": "opaque-media-id",
      "type": "Movie",
      "title": "Example Movie",
      "series": null,
      "season": null,
      "episode": null,
      "positionSeconds": 420,
      "durationSeconds": 900,
      "posterUrl": "/api/jellyfin/artwork/0123456789abcdef0123456789abcdef?tag=validatedTag"
    },
    "playback": {
      "method": "directPlay",
      "sourceVideoCodec": "h264",
      "sourceAudioCodec": "aac",
      "sourceResolution": "1920x1080",
      "outputVideoCodec": null,
      "outputAudioCodec": null,
      "outputResolution": null,
      "transcodeReasons": []
    }
  }]
}
```
The example is **not** a claim about the user's live server. `posterUrl` is `null` if posters are disabled or no usable image reference exists. Session IDs are opaque and must not reuse Jellyfin `DeviceId` as a substitute.

## 5. API routes and error model

| Route | Purpose |
|---|---|
| `GET /api/jellyfin/sessions` | Main poll; status, observedAt, counts, normalized sessions |
| `GET /api/jellyfin/health` | Diagnostic status and version; **not** independently polled by Overview |
| `GET /api/jellyfin/artwork/[itemId]?tag=...` | Narrow image proxy, not an arbitrary Jellyfin proxy |

Follow current Nerve route conventions: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `Cache-Control: no-store` for JSON and HTTP 200 with an application `status` field for expected integration failures. Statuses: `online`, `offline`, `unauthorized`, `unconfigured`, `disabled`, `error`. Distinguish timeout/network/auth/malformed upstream response internally without leaking secrets.

`stale` is **client-derived**, not a backend status. The Jellyfin hook retains the last response with `status: "online"` as a last-good snapshot and separately exposes current status and last success time. Never present cached playback as live: clearly mark it stale/offline. Use existing `PolledMeta` conventions (3× poll interval for staleness) and avoid overwriting last-good sessions with an offline payload.

### Artwork proxy security
- Route params are asynchronous in Next.js 15.5: await `params`.
- Validate item IDs (32 hex or verified dashed GUID form) and tag against a restrictive pattern; invalid input must return 404 **without an upstream call**.
- Only proxy `Items/{id}/Images/Primary` with server-fixed image dimensions/quality.
- Do not follow redirects with credentials (`redirect: "manual"` or `"error"`).
- Accept only `image/jpeg`, `image/png`, `image/webp`; reject SVG and other content.
- Enforce a **2 MB maximum body** even for chunked responses, with a **5-second timeout**; abort oversized transfers.
- Return `X-Content-Type-Options: nosniff`; on validated tag use `Cache-Control: private, max-age=86400`. On error return 404/placeholder without upstream details.
- Never leak upstream URLs, response bodies, headers, or API keys to browser/logs.
- Nerve currently has no application authentication. Preserve its LAN/mesh-only deployment boundary; the artwork proxy is a fixed-path server-side endpoint, **not an authenticated app session**. Do not claim it is authenticated until app auth exists.

## 6. Dashboard UI and polling

Location: full-width, **after Overview's main 2×2 grid and before `ServicesPanel`**.

- **Stable expandable shell** with native button, `aria-expanded` and `aria-controls`; expansion remains stable across polling and error/loading transitions.
- Collapsed: online/offline pill and playing, paused, idle, transcoding counts.
- Expanded: playing first, paused second, then connected idle clients. Anonymous entries use “Unidentified client”.
- Session cards: poster (fixed 2:3 box, lazy-loaded), title, TV context, user, client/device, state, progress and playback method. Expand for source/output technical details and transcode reasons.
- Reuse `Card`, `CardHeader`, `StatusPill`, `UpdatedHint`, `Metric`, `ProgressBar`, `Skeleton` from existing Nerve UI. Use `next/image` with `unoptimized` for proxied artwork if appropriate to the existing Next.js setup.
- Poster failure uses a fixed-size placeholder with no layout shift. Long text truncates without losing accessible full text.
- Empty state: online, zero activity, “Nothing currently playing”.
- Offline, unauthorized, error, unconfigured and disabled are distinct. A stale last-good snapshot may remain visible **only with clear stale status/timestamp**.
- With the locked `showIdleClients: true`, show idle sessions and count; if toggled false later, preserve idle count while hiding the idle list.
- No client-side progress interpolation or browser-local session history.
- Poll sessions **every 10 seconds only on Overview**. `usePolled` must skip ticks while a previous request is in flight; regression-test existing consumers. Avoid unnecessary repeated artwork downloads. Do not poll Jellyfin from the app-wide `DashboardProvider`.
- Jellyfin health stays **in this section only**; no new `Attention` item, `SystemStatus` row, or change to `computeOverallHealth`.

## 7. Implementation tasks (file-by-file)

### M0 — Real-server verification gate (complete; no code)
Verified server version `10.11.11`, successful token authentication/session queries, and expiration of idle sessions older than 960 seconds. Transcoding, anonymous sessions, and album artwork were not observed; M1 must use graceful fallbacks and tests for those cases. No raw or personally identifying payloads are kept as fixtures.

### M1 — Integration and configuration (complete, validated)
| File | Required work |
|---|---|
| `src/lib/integrations/jellyfin/types.ts` (new) | Partial upstream types; normalized DTOs; explicit status union |
| `src/lib/integrations/jellyfin/client.ts` (new) | Env getters; bounded fetches; token header; fixed paths; no redirects; public info, sessions and artwork methods |
| `src/lib/integrations/jellyfin/normalize.ts` (new) | Activity mapping, method mapping, ticks conversion, transcode reasons, poster refs, allowlisted DTOs, counts, stable sort |
| `src/lib/integrations/jellyfin/index.ts` (new) | Orchestrate disabled/unconfigured short-circuit, public info/sessions, normalized statuses |
| `src/lib/config/types.ts`, `loader.ts`, `index.ts` | Parse display-only Jellyfin YAML flags; keep env URL/key out of `NerveConfig` |
| `config/opNervexample.yaml` | Document commented display-only Jellyfin block |

**M1 completion record (2026-10-18):**

- **Changed files:**
  - Added `src/lib/integrations/jellyfin/types.ts` — partial upstream types (all fields optional), allowlisted normalized DTOs, `JellyfinStatus` union (`online | offline | unauthorized | unconfigured | disabled | error`).
  - Added `src/lib/integrations/jellyfin/client.ts` — `jellyfinBaseUrl()`/`jellyfinApiKey()` env getters, `MediaBrowser Token="<key>"` header (never in query string), `redirect: "manual"`, 5 s `AbortController` timeout, fixed GET paths (`/System/Info/Public`, `/Sessions?activeWithinSeconds=960`, `/Items/{id}/Images/Primary`), and `fetchJellyfinPrimaryImage` with ID/tag validation, JPEG/PNG/WebP-only content types, and a 2 MB body cap. Disabled/unconfigured makes zero upstream requests.
  - Added `src/lib/integrations/jellyfin/normalize.ts` — activity mapping (playing/paused/idle), playback-method mapping with `TranscodingInfo` fallback, `10,000,000` ticks/second conversion, transcode-reason array/string parsing, artwork refs (episode→series, audio→album), field-allowlist session DTOs, counts (transcoding as a subset), and stable sort.
  - Added `src/lib/integrations/jellyfin/index.ts` — `getJellyfinSessions()`/`getJellyfinHealth()` with disabled/unconfigured short-circuit before any network call, `Promise.allSettled` for public info + sessions, and error→status mapping.
  - Modified `src/lib/config/types.ts` (new `JellyfinDisplayConfig` + `DEFAULT_JELLYFIN_DISPLAY`), `loader.ts` (`parseJellyfinBlock` with strict type guards/defaults), `index.ts` (exports), and `config/opNervexample.yaml` (commented display-only block).
- **Locked requirements preserved:** server-side token only; no `url`/`apiKey`/`refreshIntervalSeconds` in YAML or `NerveConfig`; 960-second session window; status mapping; field allowlist strips `RemoteEndPoint`/`DeviceId`/`UserId`/capabilities/queues; zero network requests when disabled/unconfigured.
- **Test results:** `npm test` → 138 passing (4 new test files: `jellyfin-normalize.test.ts`, `jellyfin-client.test.ts`, `jellyfin-index.test.ts`, `config/loader.test.ts`) covering normalization, privacy allowlist, auth header/no-key-in-URL, 401/403, timeout, network failure, malformed JSON/shape, redirect refusal, artwork ID/tag validation, and config parsing. `npm run lint` clean; `npm run build` clean.
- **Blockers:** none.
- **Remaining milestones:** M2 (API routes), M3 (dashboard/polling), M4 (technical details/posters), M5 (docs/version bump). The shared `use-polled.ts` in-flight guard is deferred to M3.

**Follow-up review corrections (2026-10-18):**

- `deriveCounts()` no longer counts an idle session with a stale `TranscodingInfo`/`PlayMethod` as transcoding; transcoding remains a subset of playing/paused only. Added a regression test in `jellyfin-normalize.test.ts` for idle sessions carrying stale transcode state.
- `config/opNervexample.yaml` Jellyfin sample is now fully commented; the display-only guidance is preserved and the loader still applies the same defaults when the block is absent.
- Header language reconciled: the "Development is ready to begin / this update changes the specification only" wording was replaced with a progress note reflecting M1 implemented and M2–M5 remaining.
- **Artwork authentication remains unverified on the real server.** Recorded as a later M2/M4 real-server verification item — not an established failure and not an M1 blocker. The secure image fetch (no API key on artwork requests, `redirect: "manual"`, validated IDs/tags, JPEG/PNG/WebP-only content types, 2 MB cap) is unchanged; no speculative auth changes were introduced.

### M2 — API
| File | Required work |
|---|---|
| `src/app/api/jellyfin/sessions/route.ts` (new) | GET, normalized JSON, `no-store` |
| `src/app/api/jellyfin/health/route.ts` (new) | GET, diagnostic status/version, `no-store` |
| `src/app/api/jellyfin/artwork/[itemId]/route.ts` (new) | Async params, validated IDs/tags, bounded image proxy and security headers |

**M2 completion record (2026-10-18):**

- **Changed files:**
  - Added `src/app/api/jellyfin/sessions/route.ts` — GET handler delegating to `getJellyfinSessions()`; `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `Cache-Control: no-store`; always HTTP 200 with an application `status` field.
  - Added `src/app/api/jellyfin/health/route.ts` — GET handler delegating to `getJellyfinHealth()`; same runtime/dynamic/no-store conventions; diagnostic status/version; not independently polled by Overview.
  - Added `src/app/api/jellyfin/artwork/[itemId]/route.ts` — async `params`, item-ID/tag validation before any upstream call (404 without fetch), disabled/unconfigured short-circuit, `fetchJellyfinPrimaryImage` proxy, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=86400` on success, sanitized 404 (empty body, no upstream details) on failure.
  - Modified `src/lib/integrations/jellyfin/client.ts` — refactored the artwork fetch into `fetchPrimaryImageOnce(itemId, tag, withAuth)`; added server-fixed `maxWidth=600`/`quality=80` query params; added a one-shot server-side auth retry (attach `MediaBrowser Token="<key>"` only after a 401/403; key never in a URL/query string and never on the first attempt).
  - Added `src/lib/jellyfin-routes.test.ts` — 18 route tests covering valid/invalid IDs and tags, MIME allowlist, oversize (declared and chunked), timeout, auth retry, network failure, redirect refusal, fixed image path/dimensions, no-upstream-call on invalid/disabled/unconfigured input, and no secret exposure.
- **M1 mismatch reconciliation (minimal, documented):**
  1. *Artwork authentication* — M1 deliberately attached no API key to artwork requests ("no speculative auth changes"; deferred as a later M2/M4 verification item). The spec's server-side-token requirement ("if server artwork requires authentication, use server-side token only") is now honored with a conditional, one-shot retry: the first attempt is unauthenticated (no key), and only a 401/403 triggers a retry carrying the token server-side. The key never reaches the browser, never appears in a URL/query string, and redirects are never followed on either attempt.
  2. *Server-fixed image dimensions/quality* — M1's artwork fetch used no size/quality params. Added `maxWidth=600` and `quality=80` so the proxy requests a bounded size from Jellyfin; the browser cannot influence upstream image size.
- **Locked requirements preserved:** `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `no-store` on JSON, HTTP 200 + application `status` for expected integration failures, async Next.js 15.5 params, validation-before-fetch, fixed `Items/{id}/Images/Primary` path, `redirect: "manual"`, JPEG/PNG/WebP-only content types, 2 MB bounded reads (declared + chunked with abort), 5 s timeout, `nosniff`, `private, max-age=86400` on validated tag, sanitized failures, zero upstream requests when disabled/unconfigured, no API key/URL/body/header leaks, and no duplicate health/Attention changes.
- **Test results:** `npm test` → 156 passing (18 new route tests). `npm run lint` clean; `npm run build` clean.
- **Blockers:** none. Real-server verification of artwork authentication remains a later M4 item (unchanged).
- **Remaining milestones:** M3 (dashboard/polling), M4 (technical details/posters), M5 (docs/version bump).

### M3 — Dashboard
| File | Required work |
|---|---|
| `src/hooks/use-polled.ts` | Shared in-flight guard; verify no regressions |
| `src/hooks/use-jellyfin.ts` (new) | 10-second Overview-scoped polling; last-good snapshot; current status and stale metadata |
| `src/components/dashboard/jellyfin/jellyfin-section.tsx` (new) | Stable expandable shell, accessibility and state handling |
| `jellyfin-summary.tsx`, `jellyfin-session.tsx` (new) | Counts and session cards |
| `src/components/dashboard/overview.tsx`, `src/app/page.tsx` | Insert section at locked placement; pass display-only flags |

**M3 completion record (2026-10-18):**

- **Changed files:**
  - Modified `src/hooks/use-polled.ts` — added a per-effect in-flight guard so a tick is skipped while the previous request is still in flight. Implemented as an effect-local closure (not a shared ref) so an aborted request from a prior effect run can never clear the current run's guard. No regression to the 7 existing consumers (all poll constant URL/interval).
  - Added `src/hooks/use-jellyfin.ts` — `JELLYFIN_POLL_INTERVAL_MS = 10000`; Overview-scoped polling of only `/api/jellyfin/sessions`; last-good `online` snapshot retained and never overwritten by non-online payloads; current status kept separate from last-success time; staleness at 3× interval (30 s); zero requests when `enabled` is false.
  - Added `src/lib/jellyfin-display.ts` (+ `jellyfin-display.test.ts`) — pure Node-testable helpers: status→label/health maps, playback-method labels, progress percent (null for unknown/non-finite duration; never NaN or a fake 0%), playback-time formatting, TV-context formatting, and session grouping.
  - Added `src/components/dashboard/jellyfin/jellyfin-section.tsx` — full-width expandable Card shell with a native button carrying `aria-expanded`/`aria-controls`; local expanded state stable across polling/loading/failure; explicit online/offline/unauthorized/unconfigured/disabled/error states; stale last-good banner; "Nothing currently playing" empty state; idle list hidden (count preserved) when `showIdleClients` is false.
  - Added `src/components/dashboard/jellyfin/jellyfin-summary.tsx` (playing/paused/idle/transcoding counts) and `jellyfin-session.tsx` (fixed 2:3 poster placeholder, title, TV context, user, client/device, state, progress, and playback method; accessible truncation; no NaN/0%).
  - Modified `src/components/dashboard/overview.tsx` and `src/app/page.tsx` — full-width section inserted after the 2×2 grid and before `ServicesPanel`; passes the display-only `JellyfinDisplayConfig` flags.
- **Locked requirements preserved:** 10 s polling only while Overview is mounted; no Jellyfin in `DashboardProvider`; no duplicate Attention/`SystemStatus`/`computeOverallHealth` changes; health not independently polled from the client; last-good snapshot never overwritten by offline/unauthorized/error/unconfigured payloads; anonymous clients shown as "Unidentified client"; no client-side interpolation or history; unknown duration produces no percentage and never NaN; M3/M4 boundary respected (fixed-size placeholder and playback-method label only — no source/output codecs, transcode reasons, or poster rendering).
- **Test results:** `npm test` → 177 passing (21 new display-helper tests covering progress null/NaN/clamp, time formatting, method labels, TV context, session grouping, and status maps). `npm run lint` clean; `npm run build` clean. Independent review found no blockers or warnings; four minor review NITs were addressed (per-effect in-flight guard, `aria-controls` target always mounted via `hidden`, finite guard in TV context, empty-state message keyed to total sessions).
- **Blockers:** none.
- **Remaining milestones:** M4 (technical details/posters), M5 (docs/version bump). The §8 real-server manual matrix (live playing/paused/idle states, navigation away from Overview stopping Jellyfin polling, keyboard and narrow-viewport accessibility, and stale last-good recovery) is a pre-release validation step that cannot be exercised in the Node test harness and remains outstanding.

### M4 — Technical details and posters
| File | Required work |
|---|---|
| `src/components/dashboard/jellyfin/jellyfin-details.tsx` (new) | Expandable technical details, source/output distinction, unavailable fallbacks |
| `jellyfin-session.tsx` | Artwork with stable tagged URL, lazy load and fallback |

**M4 completion record (2026-10-18):**

- **Changed files:**
  - Added `src/components/dashboard/jellyfin/jellyfin-details.tsx` — accessible expandable "Technical details" per playback session: native `<button>` with `aria-expanded`/`aria-controls` (panel always mounted and toggled via `hidden`, so `aria-controls` always references an existing node), a `scope`-annotated `<table>` (with `sr-only` caption) showing source vs transcoded output video/audio codecs and resolution in **independent** columns, playback method, and transcode reasons. Null/absent values render "—" (never NaN/0%/misleading values); transcode reasons row appears only when reasons exist.
  - Modified `src/components/dashboard/jellyfin/jellyfin-session.tsx` — added `"use client"` and poster rendering: a fixed 2:3 (`aspect-[2/3]`) box is always present when `showPosters` is true (no layout shift), rendering `next/image` with `unoptimized` + `fill` + `object-cover` (same-origin proxy path, no optimizer round-trip, lazy loading), with an `onError` fallback to the icon placeholder (unmount, not src-swap) and `key={posterUrl}` so a changed image tag resets the error state. `showPosters=false` and null/bad `posterUrl` fall through to the icon placeholder; no credentials or upstream URLs are ever rendered.
  - Modified `src/lib/jellyfin-display.ts` — added pure Node-testable helpers `buildCodecDetailRows` (source/output independence), `formatDetailValue` ("—" for null/empty, trims), and `formatTranscodeReasons` (comma-joined or null).
  - Added `src/lib/jellyfin-details.test.ts` — 8 tests covering source/output independence in both directions, null/empty/whitespace fallbacks, and reason formatting.
- **Locked requirements preserved:** no M1/M2/M3 files modified; 10-second Overview-scoped polling, last-good snapshot, and session state rendering unchanged; no duplicate health/Attention changes; transcoding remains a subset of playing/paused; posters use only the normalized same-origin `/api/jellyfin/artwork/[itemId]?tag=...` path with no credential/upstream leak; no version bump or other M5 work.
- **Test results:** `npm test` → 185 passing (8 new M4 tests). `npm run lint` clean; `npm run build` clean. Independent review returned APPROVE WITH NITS (no material security/correctness/a11y issues); the two cosmetic nits were addressed (detail-value trimming and a symmetric null-source independence test).
- **Blockers:** none. The §8 real-server manual matrix — live poster retrieval including the artwork-auth fallback, observed transcoding source/output details, and keyboard/narrow-viewport expansion of the details panel — remains a pre-release validation step that cannot be exercised in the Node test harness.
- **Remaining milestones:** M5 (docs/version bump).

### M5 — Documentation, validation, release
| File | Required work |
|---|---|
| `.env.example`, `compose.yaml` | Document/pass through `JELLYFIN_URL` and `JELLYFIN_API_KEY`; do not automatically rewire networks |
| `README.md` | Setup, dedicated admin-capable key warning, Docker reachability, TLS, privacy and config restart instructions |
| `package.json`, `package-lock.json`, `src/lib/version.ts` | Update version consistently to `1.1.0` after acceptance |

Keep implementation scoped to the files actually required by the repository. Avoid refactoring unrelated integrations.

**M5 completion record (2026-10-18):**

- **Changed files:**
  - `.env.example` — added `JELLYFIN_URL` and `JELLYFIN_API_KEY` as empty (dummy) placeholders with guidance: Jellyfin API keys are **not read-only scoped** (create a dedicated, revocable key named "Nerve"); `JELLYFIN_URL` must be reachable from inside the Nerve container.
  - `compose.yaml` — added pass-through `JELLYFIN_URL=${JELLYFIN_URL:-}` and `JELLYFIN_API_KEY=${JELLYFIN_API_KEY:-}` to the `nerve` service, with a comment noting production Compose definitions are maintained separately in Shitflix-Docker (Portainer environment substitutions already configured there) and that real keys must never be placed in this file. No Docker network rewiring.
  - `README.md` — added a "Jellyfin activity monitoring" section: dedicated revocable key warning, read-only GET allowlist, environment vs display-only YAML, container networking reachability, TLS guidance (never disable verification), restart-after-change requirements, 10-second Overview-scoped polling, privacy/data-exposure boundaries, and a troubleshooting table. Updated the Status, Configuration, and Project-structure references to include Jellyfin.
- **Version bump (applied):** `package.json`, `package-lock.json`, and `src/lib/version.ts` updated consistently to `1.1.0` after acceptance criteria passed (all release-blocking manual checks confirmed by the user).
- **Validation results:** `npm test` → 185 passing (12 files). `npm run lint` → clean. `npm run build` → clean (all three Jellyfin routes compile). No regression.
- **Real-world validation (user-confirmed on the deployed feature branch):** playing, paused, and idle clients; multiple simultaneous streams; online/offline detection by stopping Jellyfin; recovery after Jellyfin restart; artwork displayed; transcode details/reasons visible; narrow/mobile viewport rendering; keyboard-accessible expand/collapse. Edge DevTools confirmed ~10 s session polling on Overview, polling stopping when navigating away and resuming on return, and no overlapping requests under throttling.
- **Remaining non-blocking, not separately live-verified items (covered by automated fixtures or minor edge cases):** live missing/bad API key and malformed upstream response; the "online, no sessions" empty state; dashboard behavior with Jellyfin disabled/unconfigured; distinct direct-play vs direct-stream observation; the stale last-good banner while offline; and the artwork auth-retry branch (artwork display itself is confirmed).
- **Blockers:** none.

## 8. Tests and acceptance criteria

**Automated (existing Vitest Node environment; no new component-testing dependencies):**
- Normalization: playing/paused/idle, mutually exclusive activity states, counts, anonymous label, stable sorting, TV context, playback method fallback, array/string reasons, null duration, tick conversion, poster selection.
- Privacy: assert no `RemoteEndPoint`, `DeviceId`, `UserId`, API key, or raw session object reaches normalized output.
- Client: token header, no query-string key, 401/403, timeout, network failure, malformed JSON, redirects refused, disabled/unconfigured make zero upstream requests.
- Artwork: valid/invalid ID and tag, unsupported MIME, oversize/chunked payload, timeout and no upstream call on invalid input.
- Config loader: absent, valid and malformed Jellyfin YAML; URL/key never enter client-facing config.
- Shared polling hook: manually regression-check existing cards and absence of overlapping requests; add a unit test only if supported by existing harness.

**Manual real-server matrix:**
- Online with no sessions; one playing; one paused; multiple simultaneous streams; recently connected idle client.
- The **960-second** server-side filter is verified on Jellyfin 10.11.11; retain regression coverage for the request and graceful empty/idle states.
- Direct play and direct stream where available; transcode details use unavailable fallbacks unless a transcode session can be observed safely.
- Movie/episode artwork where available; album artwork was not observed live. Verify missing/unsupported artwork fallback without requiring an album session.
- Anonymous/DLNA sessions were not observed live; verify generic unidentified-client handling using a sanitized synthetic fixture.
- Missing API key, bad key, offline, malformed response, recovery and stale last-good snapshot.
- Overview expanded through at least three polls; navigating to `/containers` stops Jellyfin polling; no overlapping requests.
- Narrow/mobile viewport and keyboard-accessible expand/collapse.
- Existing dashboard unaffected when Jellyfin is disabled or unconfigured.
- `npm run lint`, `npm test`, `npm run build` pass before release.

**Real-server validation results (2026-10-18, deployed feature branch):** Confirmed — playing, paused, and idle clients; multiple simultaneous streams; online/offline detection by stopping Jellyfin; recovery after Jellyfin restart; artwork displayed; transcode details/reasons visible; narrow/mobile viewport rendering; keyboard-accessible expand/collapse; ~10 s Overview polling with polling stopped while navigating away and resumed on return, and no overlapping requests under throttling (Edge DevTools). **Not separately live-verified but non-blocking** (covered by automated fixtures or minor edge cases) — live missing/bad API key and malformed upstream response; "online with no sessions" empty state; dashboard behavior with Jellyfin disabled/unconfigured; distinct direct-play vs direct-stream observation; stale last-good banner while offline; artwork auth-retry branch. All release-blocking gates are confirmed; acceptance is complete.

**Definition of done:** Correct live and idle monitoring on the installed server; credentials and private fields protected; failure isolation and responsive UI; no duplicate health alerts; tests and build pass; docs and release version updated.

## 9. Explicit exclusions and deferred ideas

Not part of v1.1: playback history, watch-time analytics, library browsing/counts, session controls or POST endpoints, Android API/auth overhaul, multiple Jellyfin servers, client-side progress interpolation, special music/Live TV layouts, user avatar proxy, or unrelated integration refactors.

Optional **only if needed after testing**: request coalescing across tabs, public-info caching, pausing polls in hidden tabs, sessionStorage expansion persistence, in-memory poster-ID allowlist. Do not introduce these as automatic prerequisites.

## 10. Implementation readiness

The real-server verification gate (M0) is complete and the implementation is ready to begin under this specification. Preserve the confirmed 960-second policy and implement graceful fallbacks for the unobserved transcoding, anonymous-session, and album-artwork cases. Do not treat unobserved cases as proof that Jellyfin cannot return them.
