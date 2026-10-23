# October 2026 TLS trust patch — proposed Nerve 1.1.1

Review date: 2026-10-23. All source changes are local and uncommitted.
No live service was restarted, recreated or deployed. Shitflix-Docker was
read only; no files there were changed by this work.

## Checkout and independently established risk

- Nerve checkout: `C:\Projects\Nerve`, branch `feat/jellyfin-integration`,
  initial HEAD `0a6688a` (v1.1.0). No tracked modifications at entry.
- The pre-existing untracked `docs/Nerve_Android_MVP_Spec.md` is user work;
  it is preserved and excluded from this patch. No earlier investigation
  changes or test results were assumed.
- Read-only inspection found production container `nerve`, image
  `nerve-nerve`, image ID
  `sha256:f1a9c1a49f17e650e84ad490fedd1b7dd55cee2265d4c9c40726cf4b5a077197`.
  It runs Node **22.23.3**, OpenSSL **3.5.8**, Alpine **3.24.2**, and
  `ca-certificates-bundle` **20260909-r0**. The full `ca-certificates`
  package was absent. No Node TLS bypass or extra CA setting was reported.
- The old Dockerfile used floating `node:22-alpine` separately in the deps,
  builder and runner stages. Reusing an old image or cached layer does not
  update its runtime or certificates.
- Nerve's integration clients use Node native `fetch`; service checks use
  `https.request`. The service checker explicitly disabled certificate
  verification, so updating trust stores alone could not fix that path.

Eight eMudhra intermediate CA private keys were compromised. An attacker on
the network path can forge a certificate for an arbitrary service; this is
an outbound TLS authentication risk, including credentials sent to HTTPS
Jellyfin/WUD/Gluetun endpoints. HTTP-only internal traffic has no CA chain
and is unaffected by this particular trust-store change. Browser updates
do not update a container's Node or system trust stores. Most non-browser
clients do not enforce Certificate Transparency; No-CT test chains matter.
These observations establish exposure, not evidence of an actual intrusion.

Primary sources checked on the review date:

- [Incident disclosure, test hosts and No-CT chains](https://emudhra.we-have-a-problem.com/).
- [Node 22.23.4 security release](https://nodejs.org/en/blog/release/v22.23.4):
  NSS 3.131.1 roots, OpenSSL 3.5.9 and native blocked-public-key enforcement.
- [Node TLS key-blocking patch](https://github.com/nodejs/node/pull/66871).
- [Alpine 3.24 CA bundle 20261020-r0](https://pkgs.alpinelinux.org/package/v3.24/main/x86_64/ca-certificates-bundle).
- [Alpine CA package 20261020-r0](https://pkgs.alpinelinux.org/package/v3.23/main/x86_64/ca-certificates).

## Source changes and version policy

1. `Dockerfile`: one shared base for every stage, pinned to
   `node:22.23.4-alpine3.24` and manifest digest
   `sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914`.
   Both `ca-certificates` and `ca-certificates-bundle` have an APK lower bound
   of `20261020-r0`. A stale mirror fails the build instead of silently
   satisfying it with an old package. Keep the tag and digest synchronized
   when updating Node. The CA lower bound permits later security updates;
   record resolved versions and the resulting image digest for each release.
2. The real HTTPS service probe now uses `rejectUnauthorized: true`.
   Its existing timeout and response contract are preserved. A regression
   test uses a test-only self-signed localhost key/certificate and confirms
   rejection before an HTTP request is sent; HTTP and timeout cases also pass.
3. `.nvmrc` pins 22.23.4. `engines` documents patched supported release
   lines: 22.23.4+, 24.22.1+, 26.12.1+ within those majors. npm engines are
   advisory unless the developer enables engine-strict; the container pins
   the actual runtime. The Windows host's Node 24.19.0 was not upgraded.
4. Version metadata is 1.1.1 in `package.json`, `package-lock.json` and
   `src/lib/version.ts`. No npm dependency versions changed: this CA fix is
   supplied by Node and Alpine. `@types/node` does not supply runtime roots.
5. `scripts/verify-tls.mjs` (also included in the runtime image) checks both
   native HTTPS clients, optionally system curl, with validation enabled.
   It sends no credentials, follows no redirects, and exits nonzero on an
   accepted compromised chain or an inconclusive network error.
6. `scripts/smoke-container.mjs` runs the actual standalone application with
   synthetic loopback integration servers and a temporary SQLite database.
   It must run in a disposable container without production mounts/socket.

The runtime stays non-root (UID 1001), standalone Next.js, port 3000, with
the same data/config paths. No API contract, database schema, polling hook,
credential header, Docker proxy permission, or network topology is changed.
The existing dashboard has **no application login**; authentication here
means integration credentials and the Offen webhook token. The Android
document remains a proposal; mobile API authentication is not implemented
or claimed by this patch.

## Verification results

All external TLS checks used direct connections with validation ON. Neither
`NODE_TLS_REJECT_UNAUTHORIZED=0`, `rejectUnauthorized:false`, `curl -k`, nor
an injected root-removal workaround was used for the verification.

Baseline: a disposable container from the exact old production image,
without its credentials or volumes, accepted both `dv-g3b` and
`dv-g3b-noct` with HTTP 200 through Node `https` and native `fetch`.
The two AAA cross-chain hosts already failed with
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. Partial rejection was not sufficient.

Patched image: Node **22.23.4**, embedded OpenSSL **3.5.9**, system CA
packages **20261020-r0**. All four hosts below failed with **CERT_REVOKED**
through both Node clients. System curl **8.22.0**, linked to OpenSSL
**3.5.9** and explicitly using `/etc/ssl/certs/ca-certificates.crt`, rejected
all four with **curl exit 60 / issuer verification error 20**:

- `https://dv-g3b-emudhra.we-have-a-problem.com/`
- `https://dv-g3b-aaa-emudhra.we-have-a-problem.com/`
- `https://dv-g3b-noct-emudhra.we-have-a-problem.com/`
- `https://dv-g3b-aaa-noct-emudhra.we-have-a-problem.com/`

Positive controls `https://nodejs.org/` (307, no redirect followed) and
`https://registry.npmjs.org/` (200) succeeded through all three clients.
Result: **18/18 checks passed**. A timeout, DNS error, hostname mismatch or
expired certificate is not counted as evidence of the intended distrust.

The same 12 Node checks also passed with `node --use-openssl-ca`, exercising
Node with system trust enabled: **30/30 total TLS assertions** on the final
review image `nerve:1.1.1-emudhra-review`, image ID
`sha256:c0402820b3074ad0d79523b98cc1865b62ebae47c3fc4558cc2445bd8eb87da4`.
This local tag is a review artifact, not a published release.

- Clean Docker build (`--pull --no-cache`): passed; `npm ci`, production
  compilation, type checks and route generation passed on Node 22.23.4.
- Patched Linux builder: **188 tests passed in 13 files**, including all
  existing Jellyfin tests and 3 service transport regression tests.
  `npm run lint`: passed.
- Standalone image, UID 1001, `--network none`, no production mounts:
  dashboard routes `/`, `/containers`, `/backups`, `/updates`; health and
  all backend integration routes passed against loopback fixtures.
  Verified Docker list/inspect/stats/system normalization, WUD Basic auth
  and rejection, Jellyfin sessions and rejection, poster auth retry and
  image bytes, private session-field filtering, Gluetun API key, Offen
  missing/valid-token handling, and a persisted backup through native
  better-sqlite3. All upstream requests remained GET-only.
- Browser QA against a separate localhost-only fixture container: dashboard
  hydrated, synthetic session and poster rendered; Jellyfin polled at about
  10 seconds, stopped for 25 seconds on Containers and resumed on Overview.
  With responses delayed for 12 seconds, starts were about 20 seconds apart
  (the intervening 10-second ticks were skipped). Maximum observed concurrent
  Jellyfin requests: 1 in both the normal and slow-response checks.
- Host Vitest initially failed because sandboxed esbuild could not traverse
  the parent directory; the full suite above ran successfully inside the
  patched Linux builder. Host lint also completed successfully.

Compatibility caveat: self-signed Portainer HTTPS health checks currently
configured at `https://192.168.40.186:9443` will fail validation. Before
rollout, select a trusted HTTPS hostname/certificate, explicitly provision a
vetted private CA with correct SANs, or choose a supported internal HTTP
health endpoint on a trusted network. Do not restore an accept-all option.
An unauthenticated GET from a disposable patched Node container confirmed
`DEPTH_ZERO_SELF_SIGNED_CERT` for that exact configured endpoint.
The dashboard still works; that service status will be offline/unreachable
until its check URL/trust is corrected. Legitimate services chaining only to
the removed roots also need a replacement certificate. Real production
credentials/endpoints were not exercised by the isolated smoke test; verify
them after an approved rollout.

**Follow-up resolution:** [Portainer scoped TLS trust](./Portainer-Health-TLS.md)
adds optional per-service `checkTls.caFile` and `checkTls.serverName`. The
installed public leaf plus its localhost SAN successfully verifies the
existing LAN HTTPS status endpoint. HTTP 9000 is enabled but unreachable
from Nerve's separate bridge; no existing NPM Portainer route was found.
The earlier review image/results above predate this source follow-up; use
the new image and deploy its matching inline configuration/certificate mount.

Dependency audit (unchanged lockfile dependencies): npm reported **12**
existing findings (4 moderate, 5 high, 3 critical), including Next 15.5.25
(a 15.5.28 patch is advertised) and development Vitest/tinypool findings.
This patch's TLS acceptance results do not establish freedom from those
separate advisories. Review them separately before any broader release or
remote/mobile exposure; no automatic `npm audit fix --force` was applied.

## Reproduce locally without touching production

PowerShell, from `C:\Projects\Nerve` (Linux Docker engine):

```powershell
docker build --pull --no-cache -t nerve:1.1.1-emudhra-review .
docker build --target builder -t nerve:1.1.1-test .
docker run --rm --network none --entrypoint sh nerve:1.1.1-test -c 'npm test && npm run lint'
docker run --rm --entrypoint node nerve:1.1.1-emudhra-review scripts/verify-tls.mjs
docker run --rm --entrypoint node nerve:1.1.1-emudhra-review --use-openssl-ca scripts/verify-tls.mjs

# curl/openssl are added only to this disposable container, not the runtime image.
docker run --rm --user 0 --entrypoint sh nerve:1.1.1-emudhra-review -c 'apk add --no-cache curl openssl >/dev/null && node scripts/verify-tls.mjs --system'

docker run --rm --network none --mount 'type=bind,source=C:\Projects\Nerve\scripts\smoke-container.mjs,target=/tmp/smoke-container.mjs,readonly' --entrypoint node nerve:1.1.1-emudhra-review /tmp/smoke-container.mjs
```

Do not use `docker compose up` for isolated testing: the checked-in Compose
uses production-style container names and persistent volumes. The smoke
runner writes only its temporary synthetic database and deletes it on exit.
For browser QA, omit `--network none`, bind **127.0.0.1:31011:3000**, give the
container a unique review name, and append `--serve`. Stop only that review
container when done. Never mount live config/data volumes or the Docker socket.

## Deployment requirements — approval required, not executed

Use Nerve's complete first-party
[`deploy/portainer.compose.yaml`](../deploy/portainer.compose.yaml) to reproduce
the prepared production bind and inline `checkTls` configuration. The
[Portainer TLS guide](./Portainer-Health-TLS.md) covers the provisioned host PEM,
certificate rotation, verification and the existing stack's update boundary.

Read-only evidence identifies the deployed Compose project as `nerve`, with
Portainer labels pointing to
`/data/compose/66/Nerve_Stack/docker-compose.yaml`. The local infrastructure
definition is `C:\Projects\Shitflix-Docker\Nerve_Stack\docker-compose.yaml`.
Its Nerve build context is **`https://github.com/HappypsychoX/Nerve.git#master`**,
Dockerfile `Dockerfile`. That source definition and the live Portainer editor
can drift; confirm the effective deployed context/ref before release.

1. Review this Nerve diff, resolve the self-signed health-check compatibility
   decision, and approve the commit/release separately. Publish the approved
   Nerve commit to the source ref Portainer actually builds. With the
   checked-in external definition unchanged, that means approved Nerve code
   on **master**. A local change, feature branch push or local review image
   alone does not update that remote build context.
2. Rebuild from the approved Nerve commit with `--pull --no-cache`. Preserve
   the existing image ID under a rollback tag before rebuilding because the
   local `nerve-nerve` tag may be overwritten. Record the new image ID/digest
   and resolved Node/CA versions; a source version string alone is insufficient.
3. After explicit deployment approval, recreate **only the `nerve` service**
   through the existing Portainer stack, using the rebuilt image. Keep the
   socket proxy service, volumes `nerve_nerve-config` and `nerve_nerve-data`,
   network `nerve_nerve-internal`, port `3001:3000`, inline config and
   `NERVE_CONFIG_PATH=/run/configs/nerve.yaml` as configured by that stack.
   Keep Jellyfin/WUD/Gluetun/Offen secrets in Portainer variables. Do not
   replace the stack with this repo's example Compose or rewire networks.
4. Confirm `/api/health`, image ID, Node 22.23.4+, CA packages 20261020-r0+,
   and run `node scripts/verify-tls.mjs` in the deployed container. Run the
   system check on an isolated copy of that exact image; do not install test
   tooling into the live container. Confirm actual dashboard/Jellyfin sessions
   and artwork, WUD, Docker metrics, backup history, webhook auth, and polling.

No infrastructure Dockerfile, injected Node options or container-local
trust-file edits are required. There is no schema migration and no mobile
API/auth change in this patch.

## Rollback

Before any approved deployment, retain/tag or export the old image ID shown
above and save the effective Portainer stack definition and current data
backup. On a functional regression, select that retained image in Portainer
and recreate only `nerve`; preserve the same networks, secrets, config and
data volumes. Avoid a rebuild of an old floating Dockerfile as rollback:
it may resolve to different bytes. Do not run `down -v` or delete volumes.
Recheck health and the integrations. Rolling back to the old image restores
its demonstrated CA vulnerability, so treat it as a temporary operational
rollback while repairing the patched release.

Before commit, stage only this patch's listed files, leaving the existing
Android specification untracked. No commit, push, release tag or deployment
has been made by this work.

Patch file list: `Dockerfile`, `.nvmrc`, `package.json`, `package-lock.json`,
`src/lib/version.ts`, `src/lib/integrations/services/client.ts`,
`src/lib/services-client.test.ts`, `src/lib/fixtures/localhost-tls.json`,
`scripts/verify-tls.mjs`, `scripts/smoke-container.mjs`, `README.md`, and this
document. The fixture contains a deliberately public test key, never a
production credential, and is absent from the standalone runtime image.
