# Nerve v1.1 Jellyfin Specification — Planning Review

**Reviewed:** `docs/Nerve_v1.1_Jellyfin_Specification.md` against `master` (v1.0.1, commit `7681fb5`)
**Date:** 2026-10-17
**Type:** Planning review only. No code changes were made.

## Verdict

The spec is sound in scope and security intent. Eight things in it need changing before implementation starts, because they conflict with how Nerve already works or leave behaviour undefined. None of them block the design; they need decisions, not rework.

---

## 1. Where the spec conflicts with the repository

| # | The spec says | The repo actually does | Resolution |
|---|---|---|---|
| R1 | `jellyfin.url` goes in the YAML config | README rule (`README.md:147`): integration URLs live in env, never in YAML. Gluetun and WUD both read `*_URL` from env. | **Required.** Use `JELLYFIN_URL` and `JELLYFIN_API_KEY` from env. Only non-secret display toggles go in YAML. |
| R2 | Server-side YAML block | `loadConfig()` hands the **whole `NerveConfig` object to the client `AppShell`** (`src/app/layout.tsx:25`). Anything added to `NerveConfig` ends up in the browser's RSC payload. | **Required.** Never put the key or upstream URL into `NerveConfig`. This is a second, concrete reason for R1. |
| R3 | YAML block is read | The loader drops unknown keys (`src/lib/config/loader.ts:35-41`) and caches the config for the life of the process (`:83`). | **Required.** Add parsing for a `jellyfin` block. Document that config changes need a container restart. |
| R4 | `refreshIntervalSeconds: 10` is configurable | Every poll interval is a hard-coded client constant (`VPN_POLL_INTERVAL_MS`, etc.). | **Required.** Drop the knob and add `JELLYFIN_POLL_INTERVAL_MS = 10000`. It is a finalized decision anyway. |
| R5 | "No overlapping client polls" | `usePolled` uses `setInterval` with no in-flight guard (`src/hooks/use-polled.ts:58`). Slow responses can stack up. | **Required.** Add an in-flight guard to `usePolled`. This is a small fix and every integration benefits. |
| R6 | "Last known snapshot may remain visible" | `usePolled` replaces `data` with any 200 response (`src/hooks/use-polled.ts:45`). An `offline` payload would wipe the last good sessions. | **Required.** The Jellyfin hook must keep a separate last-good snapshot, i.e. the last response with `status: "online"`. |
| R7 | Polls "while the dashboard is active" | `DashboardProvider` is mounted in `AppShell` (`src/components/layout/app-shell.tsx:20`), so everything in it polls on **every page**. | **Required decision.** Recommend: do *not* add Jellyfin to the provider. Call `usePolled` from `Overview`, so it only polls on `/`. |
| R8 | "Stale" is listed as a server state next to offline, unauthorized and unconfigured | In Nerve, staleness is derived on the client (`PolledMeta.stale`, 3× the interval). The server has no snapshot cache. | **Required clarification.** The server reports `online \| offline \| unauthorized \| unconfigured \| disabled \| error`. The client derives stale. |
| R9 | `artwork/[itemId]/route.ts` | In Next 15.5, route-handler `params` is a **Promise**. No dynamic API routes exist in the repo yet. | Note for the implementer: `{ params }: { params: Promise<{ itemId: string }> }`. |
| R10 | Proposed component folder `dashboard/jellyfin/` | Dashboard components are flat (`vpn-card.tsx`, `backup-card.tsx`). Tests live in `src/lib/*.test.ts`. | Optional. A subfolder is acceptable for four components. Put tests in `src/lib/jellyfin-*.test.ts` to match the existing layout. |
| R11 | Default URL `http://jellyfin:8096` | Nerve only joins `nerve-internal` (`compose.yaml:53-56`), so `jellyfin` won't resolve unless the network is shared. | **Required doc.** Either attach Nerve to Jellyfin's network (as an external network) or use the host IP. |
| R12 | Separate health status | Jellyfin is already probed through `services[].checkUrl` with `critical: true` in the example config. It feeds the Attention panel and overall health. | **Required decision.** Recommend: don't add Jellyfin to `computeOverallHealth` or to the Attention panel's offline items (they would duplicate). Optionally add one attention item for `unauthorized` only, since the probe can't detect that. |

Other repo facts the implementation must follow:

- **Client pattern:** copy `src/lib/integrations/gluetun/client.ts`. It has a `*BaseUrl()` and key getter, an `AbortController` timeout, and a `{ ok, error: "timeout"|"network"|"http"|"auth" }` result.
- **Route pattern:** `dynamic = "force-dynamic"`, `runtime = "nodejs"`, `Cache-Control: no-store`, and HTTP 200 with a status inside the body.
- **Card pattern:** `Card`, `CardHeader`, `StatusPill`, `UpdatedHint`, `Metric`, `ProgressBar` and `Skeleton` all exist in `src/components/ui/`. Reuse them; don't write new ones.
- **Tests:** Vitest runs in the `node` environment with no jsdom or React Testing Library. Component tests are not possible without new dependencies.
- **Lint:** `next/core-web-vitals` flags plain `<img>`. Use `next/image` with `unoptimized`, or justify an eslint-disable.

---

## 2. Jellyfin API and version assumptions to verify on your server

Before M1, capture real redacted `/Sessions` responses from your installed version as test fixtures. Each item below needs checking:

1. **Auth header.** Use `Authorization: MediaBrowser Token="<key>"`. The `X-Emby-Token` header and `?api_key=` query parameter are legacy; newer versions deprecate them and may disable them by default. Never put the key in a query string.
2. **API keys have full admin rights.** Jellyfin API keys can't be scoped to read-only. "Read-only" is enforced only by Nerve's hard-coded GET allowlist. Document this and recommend a dedicated, revocable key named "Nerve".
3. **Endpoints needed:**
   - `GET /System/Info/Public` (no auth): version and server name.
   - `GET /Sessions?activeWithinSeconds=N` (auth): sessions.
   - `GET /Items/{id}/Images/Primary` (artwork).
   - Nothing else.
4. **Unauthorized detection.** `/System/Info/Public` succeeds even with a bad key, so "unauthorized" has to come from a 401/403 on `/Sessions`. The health endpoint can therefore show a version alongside an auth failure; the UI should allow for that.
5. **Session state mapping:**
   - `NowPlayingItem` present and `PlayState.IsPaused` → paused.
   - `NowPlayingItem` present and not paused → playing.
   - No `NowPlayingItem` → idle.
   - Each session gets exactly one state, as the spec requires.
6. **Idle window.** Without `activeWithinSeconds`, sessions that ended long ago show up as idle. The spec doesn't say what window to use. Recommend 960 s, which I believe matches Jellyfin's own dashboard (verify).
7. **Nerve's own session.** If Nerve sends `Client`/`Device`/`DeviceId` in the auth header, Jellyfin may register Nerve as a session, and it would show up as an idle client. Either send `Token` only or filter out Nerve's own `DeviceId`.
8. **Playback method.** Read `PlayState.PlayMethod` (`DirectPlay` / `DirectStream` / `Transcode`). If it's missing, fall back to "transcode" when `TranscodingInfo` is present; otherwise mark it unavailable.
9. **`TranscodeReasons` format.** It is an array in recent versions and was a comma-separated string in older ones. Accept both.
10. **Codecs and resolution.** "Resolution" is ambiguous. Recommend showing **source** (from `NowPlayingItem.MediaStreams`) and **output** (`TranscodingInfo.Width/Height`, only when transcoding). Check that `MediaStreams` is actually populated in `/Sessions` on your version.
11. **Ticks.** 1 tick = 100 ns (10,000,000 per second). `RunTimeTicks` is null for Live TV, so progress shows as unavailable. Recommend converting to seconds on the server so the UI never handles ticks.
12. **Episode and music artwork.** For an episode, the poster is the series image (`SeriesId` + `SeriesPrimaryImageTag`). For audio, it's the album (`AlbumId` + `AlbumPrimaryImageTag`). The artwork ID is often **not** `media.id`, which the spec's example assumes.
13. **Item IDs** are 32-character hex. Validate with `/^[0-9a-f]{32}$/i` and also accept the dashed GUID form if your server returns it.
14. **Artwork auth.** Image endpoints are typically served without auth. If that holds on your version, the proxy shouldn't send the key at all.

---

## 3. Security

**Required:**

- **S1 – Key handling.** The key stays server-only, in env, and outside `NerveConfig` (see R2). Never log URLs, headers or upstream response bodies; log only the error kind and HTTP status, like Gluetun does.
- **S2 – Fixed paths.** The base URL comes from env. Request paths are constants. Only `itemId` and `tag` are interpolated, both validated with regexes first. Use `redirect: "manual"` (or `"error"`) so a redirect can't carry the key to another host.
- **S3 – Strip fields from the session payload.** `SessionInfo` contains `RemoteEndPoint` (client IPs), `DeviceId`, `UserId`, play queues and capabilities. The normalizer must allowlist fields; it must never pass through or spread raw objects. A test should assert that no IP or device ID reaches the payload.
- **S4 – Artwork proxy limits:**
  - Only image type `Primary`.
  - Server-fixed `maxHeight`/`quality`.
  - Content type must be `image/jpeg`, `image/png` or `image/webp`. **No SVG.**
  - Stream with a cap of about 2 MB and abort if it's exceeded.
  - 5 s timeout.
  - `X-Content-Type-Options: nosniff`.
  - `Cache-Control: private, max-age=86400` when a `tag` is present (the URL changes whenever the artwork does).
  - Return 404 or a placeholder on any failure, never the upstream error.
- **S5 – TLS.** Don't copy the services probe's `rejectUnauthorized: false` (`src/lib/integrations/services/client.ts`). That's acceptable there because no secret is sent, but here the key is. For a self-signed Jellyfin, use internal `http://` on the Docker network.
- **S6 – Privacy note in the README.** Nerve has no authentication and compose publishes `3001:3000` on every host interface. Anyone on the LAN or mesh can see who is watching what. The spec acknowledges this (§6.7); the README needs to say it plainly.

**Optional:**

- Have the artwork proxy serve only item IDs seen in the last sessions fetch, using an in-memory set. This stops Nerve from browsing the whole library. It's cheap, but has little value if Jellyfin already serves images without auth.
- Add a server-side in-flight/TTL cache of about 5 s for `/Sessions`, so multiple open tabs share one upstream call.
- Cache the result of `/System/Info/Public` for about 5 minutes.

---

## 4. UX edge cases the spec doesn't cover

- **U1 – Expansion state is lost on reload.** Existing cards switch between skeleton, error and normal JSX trees, which remounts the content. The Jellyfin section needs a **stable shell**, with `expanded` state owned by that shell. Per-session detail expansion should be keyed by `session.id`, and the sort should be stable: playing, then paused, then idle; within each group by user, then id. Optionally, persist expansion in `sessionStorage`.
- **U2 – Accessibility.** Use a `<button aria-expanded aria-controls>`, not a click handler on a `div`.
- **U3 – Hidden idle clients.** When `showIdleClients: false`, still return the idle count, omit the idle list, and render the count.
- **U4 – Missing data.** Missing user, device, duration (Live TV) or codecs render as "—" or "Unavailable". Never show `NaN`, `0%` or "Unknown user".
- **U5 – Progress resolution.** Progress updates in 10 s steps. That's acceptable; skip client-side interpolation (scope).
- **U6 – Collapsed view.** Show a status pill and "▶ 2 · ❚❚ 1 · idle 3 · transcoding 1". Unconfigured: "Not configured — set JELLYFIN_URL / JELLYFIN_API_KEY". Disabled: hide the section, or show a muted "Disabled" line.
- **U7 – Placement.** Recommend a full-width section after the 2×2 grid and before `ServicesPanel` (`src/components/dashboard/overview.tsx:105`).
- **U8 – Narrow screens.** One column of session cards. The poster is a fixed 2:3 box with a placeholder, so there's no layout shift. Long titles truncate, with the full title in a `title` attribute.

---

## 5. File-by-file tasks

### M1 – Integration (no UI)

Depends on: fixtures captured from your server.

| File | Task |
|---|---|
| `src/lib/integrations/jellyfin/types.ts` (new) | Raw upstream partial types (all fields optional). Status enum `JellyfinStatus = online\|offline\|unauthorized\|unconfigured\|disabled\|error`. Normalized `JellyfinSession`, `JellyfinCounts`, `JellyfinSessionsResponse`, `JellyfinHealthResponse`. |
| `src/lib/integrations/jellyfin/client.ts` (new) | Modeled on `gluetun/client.ts`: `jellyfinBaseUrl()`, `jellyfinApiKey()`, `JELLYFIN_TIMEOUT_MS = 5000`, a `MediaBrowser Token` header, `redirect: "manual"`, and 401/403 → `auth`. Plus `fetchPublicInfo()`, `fetchSessions()` and `fetchPrimaryImage(id, tag)` with the S4 limits. |
| `src/lib/integrations/jellyfin/normalize.ts` (new) | Pure functions: `toActivityState`, `toPlayMethod`, `parseTranscodeReasons` (array or string), `ticksToSeconds`, `artworkRef` (episode → series, audio → album), `normalizeSession` (field allowlist), `deriveCounts`, `sortSessions`. |
| `src/lib/integrations/jellyfin/index.ts` (new) | `getJellyfinSessions()` and `getJellyfinHealth()`, following the gluetun `index.ts` pattern. Short-circuit to `disabled`/`unconfigured` **before any network call**. Use `Promise.allSettled` for info and sessions. |
| `src/lib/config/types.ts`, `loader.ts`, `index.ts` | Add `jellyfin?: { enabled: boolean; showPosters: boolean; showIdleClients: boolean }` and parse it with type guards and defaults. |
| `config/opNervexample.yaml` | Add the commented `jellyfin:` block, with no URL or key. |

**Accept when:** unit tests pass against the fixtures; disabled or unconfigured makes zero `fetch` calls; no key appears in any returned object or log line.

### M2 – API

Depends on: M1.

| File | Task |
|---|---|
| `src/app/api/jellyfin/sessions/route.ts` (new) | GET only, 200 with normalized JSON, `no-store`. `posterUrl` is `/api/jellyfin/artwork/{id}?tag={tag}`, or `null` when there's no tag or posters are disabled. |
| `src/app/api/jellyfin/health/route.ts` (new) | Status, version, `observedAt`. The dashboard doesn't poll it (it uses the status embedded in the sessions response), so it exists for diagnostics and future clients. |
| `src/app/api/jellyfin/artwork/[itemId]/route.ts` (new) | Await `params`, validate `itemId` and `tag`, apply S4, return 404 on anything invalid. |

**Accept when:** `curl` output contains no `RemoteEndPoint`, `DeviceId` or key. A bad ID such as `../x` or a 33-character string returns 404 without any upstream call. An SVG or oversized response is rejected. A bad key gives `status: "unauthorized"`.

### M3 – Dashboard

Depends on: M2 and the R5 fix.

| File | Task |
|---|---|
| `src/hooks/use-polled.ts` | Add an in-flight guard so a tick is skipped while the previous request is pending. This affects all integrations; regression-check the existing cards. |
| `src/hooks/use-jellyfin.ts` (new) | `JELLYFIN_POLL_INTERVAL_MS = 10000`. Wraps `usePolled`, keeps the last-good snapshot (R6) and exposes `PolledMeta`. Called from `Overview`, not from the provider (R7). |
| `src/components/dashboard/jellyfin/jellyfin-section.tsx` (new) | Stable shell with expansion state, the collapsed summary and all the states: loading, unconfigured, disabled, offline, unauthorized, empty, stale. |
| `jellyfin-summary.tsx`, `jellyfin-session.tsx` (new) | Counts row; session card with user, client, device, title, S/E context, state, progress (`ProgressBar`) and method badge. |
| `src/components/dashboard/overview.tsx` | Mount the section after the grid. Pass the `showPosters`/`showIdleClients` flags from `page.tsx` via `loadConfig()`. |
| `src/app/page.tsx` | Pass the Jellyfin display flags as a prop. |

**Accept when:** checks 1–5 and 10–13 of the spec's matrix pass manually; expansion survives at least 3 polls; no polling happens on `/containers`; DevTools shows no overlapping requests.

### M4 – Details and artwork

Depends on: M3.

| File | Task |
|---|---|
| `jellyfin-details.tsx` (new) | Expandable panel: source and output video/audio codecs, resolution, method, transcode reasons as chips, each with "Unavailable" when missing. |
| `jellyfin-session.tsx` | Poster via `next/image unoptimized` with `loading="lazy"`, a fixed aspect box and an `onError` placeholder. The stable `posterUrl` (including the tag) prevents downloading the same image again. |

**Accept when:** a missing poster shows the placeholder with no layout shift; direct play and transcode both display correctly; DevTools shows an artwork request only once per tag.

### M5 – Release

Depends on: M1–M4.

| File | Task |
|---|---|
| `.env.example` | `JELLYFIN_URL`, `JELLYFIN_API_KEY`, with notes that the key has admin rights and should be dedicated. |
| `compose.yaml` | Pass through `JELLYFIN_URL=${JELLYFIN_URL:-}` and `JELLYFIN_API_KEY=${JELLYFIN_API_KEY:-}`. Optionally add a commented example for an external Jellyfin network. |
| `README.md` | Jellyfin section covering key creation, network reachability (R11), TLS (S5), the privacy note (S6) and the restart-on-config-change note. Update the features list, project structure and milestone table. While there, fix the broken `./Nerve-v1-Plan.md` link (it should point to `docs/`). |
| `package.json`, `package-lock.json`, `src/lib/version.ts` | Bump to `1.1.0` in all three. |

**Accept when:** `npm run lint`, `npm test` and `npm run build` are clean; the full manual matrix passes against the real server; the existing dashboard is unchanged when Jellyfin is unconfigured.

---

## 6. Tests

All of these run in Vitest's node environment; no new dependencies are needed.

- **`src/lib/jellyfin-normalize.test.ts`** (required):
  - each state: playing, paused, idle;
  - exactly one state per session, and counts add up;
  - episode context (S/E formatting);
  - method mapping, including the fallback when `PlayMethod` is missing;
  - `TranscodeReasons` as an array and as a string;
  - missing fields come back as `null`, not invented values;
  - `RemoteEndPoint` and `DeviceId` are stripped;
  - Nerve's own session is filtered out;
  - artwork ID chosen for movie, episode and audio;
  - null `RunTimeTicks`.
- **`src/lib/jellyfin-client.test.ts`** (required, with `vi.stubGlobal("fetch")`):
  - 401/403 → auth; timeout; network failure; malformed JSON → error;
  - correct auth header format;
  - the key never appears in the URL;
  - unconfigured makes no fetch calls;
  - redirects are not followed.
- **`src/lib/jellyfin-artwork.test.ts`** (required): ID and tag regexes, rejected content types, size cap.
- **`src/lib/config/loader` cases** (required): `jellyfin` block present, absent and malformed.
- **Route-handler tests** that call `GET()` directly: optional.
- **Component and visual checks:** manual, via the spec's §8 matrix. Adding React Testing Library and jsdom would be scope creep.

---

## 7. Prioritized recommendations

**Required before implementation (spec edits):**

1. Move the URL and key to env and keep them out of `NerveConfig` (R1, R2, R3).
2. Drop the configurable refresh interval (R4).
3. Specify the in-flight guard, the last-good snapshot, and that stale is a client-side state (R5, R6, R8).
4. Decide where polling lives: Overview only (R7).
5. Define the idle window and how Nerve's own session is excluded (§2.6–2.7).
6. Add an explicit payload field allowlist that excludes IPs and device IDs (S3).
7. Make the artwork ID separate from `media.id` and include `tag` (§2.12).
8. Document network reachability and TLS (R11, S5), and decide Jellyfin's relationship to overall health and the Attention panel (R12).

**Strongly recommended:** artwork proxy limits as listed in S4, report source and output resolution separately, the privacy note in the README, and redacted fixtures captured from your installed version.

**Optional:**

- server-side request coalescing;
- caching the version lookup;
- the artwork allowlist of recently seen items;
- pausing polls while the tab is hidden;
- persisting expansion in `sessionStorage`;
- an `unauthorized` item in the Attention panel;
- a `jellyfin/` component subfolder.

**Scope creep to reject:**

- client-side progress interpolation;
- music, artist or Live TV-specific layouts beyond graceful fallback;
- a user-avatar proxy;
- library counts;
- multiple Jellyfin servers;
- a component-testing stack;
- adding Jellyfin to `computeOverallHealth`;
- any POST or session-control endpoint;
- refactoring other integrations onto a shared fetch helper. Tempting, but unrelated.

---

## 8. Decisions you need to make

1. **Placement:** after the 2×2 grid (recommended) or below Services?
2. **Health:** is Jellyfin health a SystemStatus row and/or an Attention item, or is it confined to its own section? Recommendation: its own section plus one Attention item for `unauthorized` only.
3. **`usePolled` fix:** is it acceptable to fix the shared hook (recommended), or should the guard be Jellyfin-only so no existing code changes?
4. **Idle window:** is 960 s OK, and should sessions without a user (DLNA or anonymous) be hidden?
