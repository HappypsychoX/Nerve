# Portainer health probe: scoped TLS trust

Pre-deployment follow-up, 2026-10-23. Nothing was committed, pushed or deployed;
no production container/network was changed. A subsequent explicitly authorized
public-certificate mount preparation also updates only Nerve's entries in its
external deployment source, as recorded below.
This supplements [the eMudhra patch report](./TLS-Trust-2026-10.md).

## What is actually deployed

Nerve reads **`/run/configs/nerve.yaml`**, supplied by the Portainer stack's
inline `nerve-display-config`. Its Portainer service has both `url` and
`checkUrl` set to **`https://192.168.40.186:9443`**, with `critical: true`.
Editing `/app/config/nerve.yaml` or the repository example will not override
that explicit runtime configuration.

Read-only inspection and disposable-container probes established:

- Portainer is on Docker's default `bridge`, currently `172.17.0.2`.
  Container ports **9000 HTTP and 9443 HTTPS are both listening**. Both
  `/api/status` and the supported **`/api/system/status`** return HTTP 200
  from a disposable container on that bridge.
- Portainer publishes **9443 → host 9443**, and edge tunnel port **8000 →
  host 8001**. Port 9000 is **not published**; LAN port 9000 refuses connections.
  An image's `EXPOSE 9000` alone would not have proved an active listener.
- Nerve is only on `nerve_nerve-internal`, currently `172.22.0.3`.
  From a disposable container sharing Nerve's existing network namespace,
  `172.17.0.2:9000` and `:9443` time out; LAN `:9443` is reachable.
  `portainer:9000` does not provide a working service-name route there.
  No production network attachments were changed for these checks.
- NPM is also on the default bridge. Its three generated proxy hosts serve
  Jellyfin, Jellyseerr and qBittorrent. **There is no existing Portainer NPM
  hostname/route to reuse.** No new public management route is needed.
- Portainer's public certificate was read from the existing Docker volume
  `portainer_data`, path `certs/cert.pem`, through a read-only mount. No
  private key or Portainer database was read. Certificate SANs are
  **`DNS:localhost, IP:0.0.0.0`**; validity is 2024-09-01 to 2029-09-01.
  It is a self-signed leaf, not a CA (`ca: false`). SHA-256 fingerprint:

  ```text
  3F:FC:A4:36:54:31:77:BA:7A:B0:66:8E:A5:9E:14:DD:1D:1A:EE:A3:11:03:21:E7:B6:4D:59:24:F6:B0:C7:AA
  ```

With patched Node, the default request fails `DEPTH_ZERO_SELF_SIGNED_CERT`.
Trusting the public leaf alone then fails `ERR_TLS_CERT_ALTNAME_INVALID`
because the LAN IP is absent from its SANs. Trusting that exact leaf and
verifying its existing **localhost** DNS SAN succeeds: **HTTP 200**, socket
**authorized=true**, for the status endpoint through the existing LAN route.
Using an incorrect verification hostname still fails.

## Selected remediation

Keep the existing HTTPS transport and add **per-service `checkTls` settings**
to Nerve. `caFile` supplies a trusted public PEM certificate/CA only to that
probe; `serverName` optionally selects the DNS SAN that normal Node TLS
verification must validate. Neither field changes global roots or integration
clients. A scoped `ca` replaces the public root set for that request.

For this installed certificate, use the exact verified public leaf plus
`serverName: localhost`. The TCP destination remains the LAN IP; `localhost`
is the TLS identity/SNI, not a DNS destination override. Nerve still checks
the certificate chain, validity and hostname. It does not override
`checkServerIdentity` or disable verification. The unique trusted leaf binds
the generic localhost name to this Portainer installation.

The code fails closed for a missing/invalid trust file, wrong certificate or
hostname, or scoped TLS settings on an HTTP URL. Requests do not follow
redirects or send Portainer credentials. No Portainer login/API key is needed
for this public status endpoint. The existing service-status mapper reports
reachability (including HTTP 2xx–4xx); this is not a Docker environment or
Portainer authenticated API permissions check.

There is **no Portainer restart, new listener, published port, NPM route or
Docker network change required** for this option. The deployment change is
limited to Nerve's image, inline service configuration and a read-only public
certificate mount.

## Exact deployment configuration — after separate approval

The complete first-party deployment template is now
**[`deploy/portainer.compose.yaml`](../deploy/portainer.compose.yaml)**. It
contains both the public-certificate bind and the active inline Portainer
`checkTls` entry below. It mirrors the already-prepared external Nerve stack;
no additional edits were made to that external file in the template follow-up.
Use this complete file by itself, not as an override merged with `compose.yaml`.
The root Compose example and fallback YAML link to this template because their
portable defaults do not load the production inline configuration.

Template follow-up validation: both Compose examples passed
`config --no-interpolate --quiet`; the production template is semantically
identical to the prepared external stack, whose file hash stayed unchanged.
No certificate body, private key or literal credential is embedded. A disposable
UID-1001 Nerve review container using the template's exact inline YAML and
stable PEM bind returned Portainer online/200; opening the certificate for
writing failed with EROFS. The host certificate and live containers were not
changed again. Deployment templates are excluded from the image build context.

1. Obtain the certificate through the trusted local Docker control plane,
   never by automatically accepting a certificate offered by the network:

   ```powershell
   docker cp portainer:/data/certs/cert.pem .\portainer-probe.pem
   ```

   With the already-installed local Node runtime, inspect the public
   certificate fingerprint without any network request:

   ```powershell
   @'
   const { X509Certificate } = require('node:crypto');
   const cert = new X509Certificate(require('node:fs').readFileSync('portainer-probe.pem'));
   console.log(cert.fingerprint256);
   '@ | node
   ```

   This copies the **public certificate only**. Confirm its SHA-256
   fingerprint against the value above (and with the administrator if the
   certificate has rotated). Do not copy `key.pem`, mount `portainer_data`
   into Nerve, commit the instance certificate, or modify system/Node roots.
   `*.pem` is excluded from Git and now also from the Docker build context.
   In this investigation the public-only test copy is under ignored
   `.next/portainer-trust/portainer.pem`; it is not a deployment artifact.

2. In the effective Portainer **Nerve stack** configuration, keep the current
   `configs.nerve-display-config.content` and change only its Portainer entry:

   ```yaml
   - id: portainer
     name: Portainer
     url: https://192.168.40.186:9443
     checkUrl: https://192.168.40.186:9443/api/system/status
     checkTls:
       caFile: /run/configs/portainer-probe.pem
       serverName: localhost
     group: infrastructure
     critical: true
   ```

3. The explicitly authorized preparation has now provisioned the verified
   public certificate at **`C:\ProgramData\Nerve\trust\portainer-probe.pem`**.
   The Docker Desktop Linux engine sees that file at
   **`/run/desktop/mnt/host/c/ProgramData/Nerve/trust/portainer-probe.pem`**.
   The actual deployment source now appends this entry to
   `services.nerve.volumes`, preserving its existing config/data mounts:

   ```yaml
   - type: bind
     source: /run/desktop/mnt/host/c/ProgramData/Nerve/trust/portainer-probe.pem
     target: /run/configs/portainer-probe.pem
     read_only: true
     bind:
       create_host_path: false
   ```

   No extra Compose `configs:` certificate is needed with this bind mount;
   keep the existing inline `nerve-display-config`. `create_host_path: false`
   makes a missing source fail deployment rather than creating an empty
   directory. The Linux source path is specific to this Docker Desktop host;
   do not copy it unchanged to a different Linux/remote Docker host.

4. After the Nerve source patch is reviewed and approved for publication,
   build the effective stack's Nerve source ref with the follow-up included.
   The infrastructure definition currently uses GitHub Nerve `#master`;
   publishing only the feature branch will not update that context. The
   earlier `nerve:1.1.1-emudhra-review` image predates this follow-up.
   Save the previous image/stack configuration before an approved rollout.
5. Only after explicit deployment approval, apply the prepared stack definition
   in Portainer and recreate **only Nerve** with the patched image, inline YAML
   and certificate bind; preserve all existing data, secrets and networks.
   Nerve caches its YAML configuration, so changing the inline content alone
   does not update an already-running process. Verify `/api/health` and
   `/api/services/health`: Portainer should be `online`, `statusCode: 200`.
   Confirm the dashboard, Jellyfin, WUD and the original eMudhra TLS checks.

The only Shitflix-Docker file changed by the explicitly authorized preparation
is **`Nerve_Stack/docker-compose.yaml`**: one Nerve volume entry and the inline
Portainer service's `checkUrl`/`checkTls` fields. Structural comparisons proved
that every other service and setting is unchanged. Its original contents
matched the effective Portainer file before editing.

The running stack's saved copy at
`/data/compose/66/Nerve_Stack/docker-compose.yaml` was **not** overwritten;
byte-hash comparison before/after confirmed it unchanged. Portainer must receive
the prepared source at the approved deployment step. The existing container
cannot acquire a new Docker bind mount without recreation. No attempt was made
to hot-mount, copy a file into, or otherwise modify the live Nerve container.

### Prepared host file and non-disruptive verification

- Exported only `portainer:/data/certs/cert.pem` through the trusted Docker
  control plane. The stable file is **518 bytes**, parses as one public X.509
  certificate, contains no private-key PEM block and matches the SHA-256
  fingerprint above. No private key or Portainer database was copied/read.
- Windows ACLs on the dedicated trust directory/file grant SYSTEM and
  Administrators full control, the trusted deployment owner
  `SHITFLIX-SERVER\Jeramey` modify access, and ordinary Users read access to
  the file. The trust directory uses a protected DACL. The first provisioning
  attempt needed a DACL-only correction for the owner's write permission;
  final ACLs and copy succeeded. No security privilege/administrator elevation
  or broader filesystem permission changes were required.
- A disposable UID-1001 container mounted the exact daemon-native source at
  `/run/configs/portainer-probe.pem`. Docker reported **`RW: false`**;
  `/proc/self/mountinfo` reported `ro`; opening the file for writing failed
  **`EROFS`** before any bytes were written. Non-root reading, PEM parsing and
  fingerprint checks passed. The test container was removed.
- `docker compose config --no-interpolate` validated the actual prepared stack,
  including `read_only: true`, `create_host_path: false`, and the matching
  `checkTls.caFile` destination and `serverName: localhost`. No secrets were
  interpolated or printed.
- A second disposable Nerve review container used that **stable host PEM**
  and the **prepared production inline YAML**, with no published ports or
  production data/config mounts. Its real `/api/services/health` returned
  Portainer **online / HTTP 200** with validation enabled, as UID 1001.
  The running Nerve ID remained
  `9ef8f4f7385f95fee771d0b96b9f2a2bc049e892bee5cee889b7c83d6e571b06`,
  started `2026-10-23T09:07:32.132256Z`, with only its original config/data
  volumes. Portainer and the socket proxy were not changed.

Remaining deployment actions: review/publish the patched Nerve source to the
effective build ref (`master` in the current external definition), build that
approved image, synchronize this prepared stack source into Portainer, and
after explicit approval recreate only Nerve. Then verify the live read-only
mount and health result. No commit/push/redeployment has been performed here.

### Reproduce the template and Portainer stack update

Validate the template without deploying or resolving secret substitutions:

```powershell
docker compose -f deploy/portainer.compose.yaml config --no-interpolate --quiet
```

For a Web Editor stack, after approval copy the reviewed template into the
**existing `nerve` stack**, preserving its environment variables and intentional
site customizations. Portainer's Update/Deploy action is the deployment boundary;
there is no filesystem/template edit that hot-adds a bind to the running
container. For a Git-managed stack, publish the approved template/source update
and select the correct Compose path in that stack's repository settings before
an approved update. The outer stack repository and the template's Nerve
`build.context` (`#master`) are separate source references; both must resolve
to the reviewed configuration/application code. Do not switch the actual stack
to a new repository/path, publish code, or press Update/Deploy without approval.

Keep these linked settings together when adapting the inline YAML:

- Host file: `C:\ProgramData\Nerve\trust\portainer-probe.pem` (this Windows host).
- Docker-engine bind source: `/run/desktop/mnt/host/c/ProgramData/Nerve/trust/portainer-probe.pem`.
- Read-only destination and `checkTls.caFile`: `/run/configs/portainer-probe.pem`.
- Status URL: `https://192.168.40.186:9443/api/system/status`.
- Verified TLS DNS SAN: `checkTls.serverName: localhost`.
- Inline YAML target: `/run/configs/nerve.yaml`, selected by `NERVE_CONFIG_PATH`.

The file must exist before deployment and be readable by UID 1001. Keep
`read_only: true` and `bind.create_host_path: false`. No certificate/key bytes
or live secrets belong in the template. The existing host PEM is reused; the
template follow-up neither exported another copy nor changed the prepared bind.

### Safe certificate refresh and rotation

Refresh the public trust file only as a separately approved maintenance action:

1. Export **only** `portainer:/data/certs/cert.pem` to a staged filename such as
   `C:\ProgramData\Nerve\trust\portainer-probe.next.pem`; do not overwrite the
   trusted file automatically. Read it through the trusted Docker control plane,
   never by accepting an unverified network certificate. Never export `key.pem`.

   ```powershell
   docker cp portainer:/data/certs/cert.pem C:\ProgramData\Nerve\trust\portainer-probe.next.pem
   ```
2. Parse the staged PEM as X.509, reject any private-key block, and check the
   SHA-256 certificate fingerprint, SAN and validity dates. Compare an unchanged
   certificate against the recorded fingerprint above. For an intentional
   rotation, verify the **new** expected fingerprint with the administrator
   through that trusted channel before accepting it. A different fingerprint
   alone is a reason to investigate, not permission to trust it.
3. Retain the previous public PEM as a protected rollback copy, then replace
   the stable file with the verified public PEM. Preserve the host ACL policy:
   administrators/SYSTEM and the trusted deployment owner can maintain it;
   ordinary Users read only. On a Linux host, use an administrator-owned file
   and directory with UID-1001 read access, for example root-owned directory
   mode 0755 and certificate mode 0644. Keep the container bind read-only.
4. If the replacement certificate uses another DNS SAN, update `serverName`
   and, where appropriate, the status URL to its correct verified identity.
   Keep chain, expiry and hostname verification enabled. Do not use a global
   trust override to hide a failed rotation.
5. Do not assume that replacing a host file atomically refreshes an existing
   single-file bind: the container can retain the previous mounted file.
   During the approved maintenance window recreate **only Nerve** with the
   same reviewed bind/config, then verify the certificate seen inside the
   container and its actual health result. A Nerve restart/recreation here is
   a future deployment action, not something performed by this preparation.

Read-only post-deployment checks (after approval/deployment):

```powershell
docker inspect --format '{{.Name}} mounts={{json .Mounts}}' nerve
@'
const fs = require('node:fs');
const { X509Certificate } = require('node:crypto');
const pem = fs.readFileSync('/run/configs/portainer-probe.pem', 'utf8');
if (pem.includes('PRIVATE KEY') || (pem.match(/-----BEGIN CERTIFICATE-----/g) || []).length !== 1)
  throw Error('Expected exactly one public certificate');
const cert = new X509Certificate(pem);
// Change this expected value only after an administrator verifies a rotation.
const expected = '3F:FC:A4:36:54:31:77:BA:7A:B0:66:8E:A5:9E:14:DD:1D:1A:EE:A3:11:03:21:E7:B6:4D:59:24:F6:B0:C7:AA';
if (cert.fingerprint256 !== expected) throw Error('Certificate fingerprint mismatch');
console.log(JSON.stringify({uid: process.getuid(), fingerprint: cert.fingerprint256,
  san: cert.subjectAltName, validTo: cert.validTo}));
(async () => {
  const response = await fetch('http://127.0.0.1:3000/api/services/health');
  if (!response.ok) throw Error('Service-health API failed');
  const row = (await response.json()).services.find(s => s.id === 'portainer');
  console.log(JSON.stringify({id: row?.id, health: row?.health, statusCode: row?.statusCode}));
  if (row?.health !== 'online' || row.statusCode !== 200) process.exitCode = 1;
})().catch(() => { console.error('Portainer verification failed'); process.exitCode = 1; });
'@ | docker exec -i nerve node -
docker exec nerve node scripts/verify-tls.mjs
```

Inspect only mount metadata, not `.Config.Env`. The certificate destination
must have `RW: false`, and the fingerprint seen inside must match the approved
host PEM. Also confirm the actual Portainer entry is online/200 and the
eMudhra negative/normal HTTPS controls still pass. A rollback trust file is
usable only if Portainer still presents a certificate it validates; restoring
an old PEM cannot authenticate an unrelated newly rotated key. Keep the
patched runtime when repairing a failed trust configuration.

## Security and alternatives

- Trust the certificate only after authenticating its fingerprint through
  the Docker host/admin channel. Automatically downloading and trusting an
  arbitrary network certificate would defeat the purpose of TLS.
- The PEM/config is public, but its **integrity** matters. Keep deployment
  editing/mount ownership limited to trusted administrators. Certificate
  replacement/rotation deliberately makes the probe fail until the verified
  replacement PEM is deployed when the new certificate is outside the
  configured trust. Re-verify the fingerprint on every rotation. Expiry still
  fails; schedule replacement
  before 2029-09-01. A normal restart with persisted `portainer_data` should
  retain the same certificate, but verify after rotation/reinstallation.
- The trust setting applies only to the configured health probe. Jellyfin,
  WUD, other probes and Node fetch keep their default trust. Existing patched
  Node blocked-key enforcement remains in force. Do not set global
  `NODE_EXTRA_CA_CERTS` or `NODE_TLS_REJECT_UNAUTHORIZED=0` for this fix.
- HTTP 9000 could be used after a separately approved **dedicated user-defined
  private network** joins Portainer and Nerve with a stable `portainer`
  alias. Then test `http://portainer:9000/api/system/status` from Nerve and
  remove `checkTls` from that HTTP entry. Do not publish 9000 on the LAN or
  use the ephemeral `172.17.0.2` address in persistent config. HTTP has no
  encryption or peer authentication and trusts every participant in that
  network; joining Nerve to the broad default bridge is not the selected fix.
- A future proper CA-issued certificate with the actual chosen hostname/IP
  SAN would remove the localhost identity exception. A private CA still uses
  per-probe `caFile`; a public CA certificate needs no custom trust. Installing
  it changes Portainer and requires a separate approved maintenance action.
  A new NPM management hostname also needs deliberate access control and
  upstream-security review; no existing route presently solves this.

Rollback: restore the previous Nerve image **and its matching inline config**
and remove the new certificate mount if abandoning this follow-up. Keep data
volumes intact. The original unpatched production image has the documented
eMudhra vulnerability; prefer repairing the scoped configuration while
retaining the patched runtime. With a patched image but no scoped settings,
the self-signed Portainer check will intentionally report unreachable.

## Evidence and source files

The actual modified `probeUrl` was exercised from Nerve's unchanged network
namespace: default trust rejected; leaf-only trust rejected; leaf plus
localhost returned 200; leaf plus wrong name rejected. Focused unit tests
cover successful scoped trust, continued default/fetch rejection, hostname
mismatch, unrelated issuer, missing/empty/malformed PEM, HTTP downgrade
rejection, HTTP compatibility, timeout, YAML loading and service wiring.

Results: **17/17 focused tests passed** (10 transport/service tests and 7
configuration tests); focused ESLint and full TypeScript checks passed.
The standalone Docker build passed, producing local review image
`nerve:1.1.1-portainer-review`, ID
`sha256:ac269476438b35a8e1da670095776fdf4836b99e71eb42a9242b284ddc150ee3`.
A disposable UID-1001 container on Nerve's existing network ran that image
with temporary configuration and only the public certificate mounted:
its actual **`/api/services/health`** returned Portainer **online / 200**.
The public API response contained no `caFile` setting. The container exited
and removed its temporary config; it had no production data/config mounts.
The prior fixture-backed dashboard/integration/auth/SQLite smoke test also
passed on this image. All 12 Node HTTPS/fetch eMudhra assertions passed,
including both No-CT hosts and normal HTTPS controls.

To reproduce focused tests from the reviewed checkout:

```powershell
docker build --target builder -t nerve:1.1.1-portainer-tests .
docker run --rm --network none --entrypoint sh nerve:1.1.1-portainer-tests -c 'npx vitest run src/lib/services-client.test.ts src/lib/config/loader.test.ts && npx eslint src/lib/config src/lib/integrations/services src/lib/services-client.test.ts && npx tsc --noEmit --incremental false'
docker build -t nerve:1.1.1-portainer-review .
docker run --rm --entrypoint node nerve:1.1.1-portainer-review scripts/verify-tls.mjs
```

Changed for this follow-up: `.dockerignore`, `config/opNervexample.yaml`,
`src/lib/config/types.ts`, `src/lib/config/index.ts`,
`src/lib/config/loader.test.ts`, `src/lib/integrations/services/client.ts`,
`src/lib/integrations/services/index.ts`, `src/lib/services-client.test.ts`,
`README.md`, this document, and `docs/TLS-Trust-2026-10.md`.
Other existing local edits belong to the preceding eMudhra patch; the
pre-existing Android specification is untouched.

Primary references: [Portainer certificate configuration](https://docs.portainer.io/advanced/ssl),
[Portainer public system-status handler](https://github.com/portainer/portainer/blob/develop/api/http/handler/system/status.go),
and [Node TLS identity/trust options](https://nodejs.org/docs/latest-v22.x/api/tls.html#tlsconnectoptions-callback).
