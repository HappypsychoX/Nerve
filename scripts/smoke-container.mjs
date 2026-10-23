// Run ONLY in a disposable Nerve image, without host/production volumes or
// Docker socket. Uses local HTTP fixtures and a temporary SQLite database.
// --serve keeps the fixture-backed dashboard available for browser QA.
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

assert.equal(process.cwd(), "/app", "Run inside the disposable Nerve image");
const itemId = "0123456789abcdef0123456789abcdef";
const key = "synthetic-jellyfin-test-key";
const token = "synthetic-webhook-test-token";
let jellyfinAuthorized = true;
let wudAuthorized = true;
let readOnlyViolation = false;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=", "base64");
const fixture = http.createServer((req, res) => {
  readOnlyViolation ||= req.method !== "GET";
  const path = new URL(req.url, "http://fixture").pathname;
  const json = (body, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (path === "/Sessions") {
    if (!jellyfinAuthorized || req.headers.authorization !== `MediaBrowser Token="${key}"`) return json({}, 401);
    return json([{ Id: "fixture-session", UserName: "Test viewer", Client: "Jellyfin Web",
      DeviceName: "Test browser", RemoteEndPoint: "private-upstream-field",
      NowPlayingItem: { Id: itemId, Name: "TLS regression fixture", Type: "Movie", ImageTags: { Primary: "testTag" } },
      PlayState: { IsPaused: false, PlayMethod: "DirectPlay" } }]);
  }
  if (path === "/System/Info/Public") return json({ Version: "12.3.0" });
  if (path.startsWith("/Items/")) {
    if (req.headers.authorization !== `MediaBrowser Token="${key}"`) return json({}, 401);
    res.writeHead(200, { "content-type": "image/png" });
    return res.end(png);
  }
  if (path === "/api/containers") {
    if (!wudAuthorized || req.headers.authorization !== `Basic ${Buffer.from("test:password").toString("base64")}`) return json({}, 401);
    return json([{ id: "fixture", name: "nerve", updateAvailable: false, image: { tag: { value: "1.1.1" } } }]);
  }
  if (path === "/version") return json({ Version: "27.2.0" });
  if (path === "/info") return json({ MemTotal: 8 * 1024 ** 3 });
  if (path === "/images/json") return json([]);
  if (path === "/system/df") return json({ LayersSize: 1234 });
  if (path === "/containers/json") return json([{ Id: "fixture", Names: ["/nerve"], Image: "nerve:1.1.1", State: "running" }]);
  if (path === "/containers/fixture/json") return json({ State: { Status: "running", StartedAt: new Date().toISOString(), Health: { Status: "healthy" } }, RestartCount: 0 });
  if (path === "/containers/fixture/stats") return json({ cpu_stats: { cpu_usage: { total_usage: 0 } }, precpu_stats: { cpu_usage: { total_usage: 0 } }, memory_stats: { usage: 1024 } });
  if (path === "/v1/vpn/status") {
    if (req.headers["x-api-key"] !== "synthetic-gluetun-key") return json({}, 401);
    return json({ status: "running" });
  }
  if (path === "/v1/publicip/ip") return json({ public_ip: "192.0.2.1" });
  if (path === "/health") return json({ status: "ok" });
  return json({}, 404);
});
fixture.listen(0, "127.0.0.1");
await once(fixture, "listening");
const upstream = `http://127.0.0.1:${fixture.address().port}`;
const dir = mkdtempSync(join(tmpdir(), "nerve-smoke-"));
writeFileSync(join(dir, "config.yaml"), JSON.stringify({
  title: "Nerve TLS review", serverName: "Isolated fixtures",
  services: [{ id: "nerve", name: "Nerve", group: "infrastructure", checkUrl: `${upstream}/health` }],
}));
const server = spawn(process.execPath, ["server.js"], {
  cwd: "/app", stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: "3000", HOSTNAME: "0.0.0.0",
    NERVE_CONFIG_PATH: join(dir, "config.yaml"), NERVE_DATABASE_PATH: join(dir, "nerve.db"),
    DOCKER_HOST: upstream, JELLYFIN_URL: upstream, JELLYFIN_API_KEY: key,
    WUD_URL: upstream, WUD_USERNAME: "test", WUD_PASSWORD: "password",
    GLUETUN_URL: upstream, GLUETUN_API_KEY: "synthetic-gluetun-key", OFFEN_WEBHOOK_TOKEN: token },
});
let serverLog = "";
server.stdout.on("data", (chunk) => { serverLog += chunk; });
server.stderr.on("data", (chunk) => { serverLog += chunk; });
const base = "http://127.0.0.1:3000";
async function request(path, init) {
  return fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
}
async function json(path) {
  const res = await request(path);
  assert.equal(res.status, 200, path);
  const text = await res.text();
  assert.ok(!text.includes(key) && !text.includes(token) && !text.includes("private-upstream-field"), "No credentials/private session fields in responses");
  return JSON.parse(text);
}
async function cleanup() {
  server.kill("SIGTERM");
  if (server.exitCode === null && server.signalCode === null) await once(server, "exit");
  fixture.closeAllConnections();
  await new Promise((resolve) => fixture.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { ready = (await request("/api/health")).ok; } catch { /* starting */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "Standalone server starts");
  for (const path of ["/", "/containers", "/backups", "/updates"]) {
    const res = await request(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.ok(html.includes("/_next/static/"), `${path} serves dashboard assets`);
  }
  assert.equal((await json("/api/health")).status, "ok");
  assert.equal((await json("/api/docker/health")).health, "healthy");
  assert.equal((await json("/api/docker/containers")).counts.running, 1);
  assert.equal((await json("/api/docker/system")).version, "27.2.0");
  assert.equal((await json("/api/services/health")).services[0].health, "online");
  assert.equal((await json("/api/wud/updates")).health, "healthy");
  wudAuthorized = false;
  assert.equal((await json("/api/wud/updates")).detail, "Auth failed");
  wudAuthorized = true;
  assert.equal((await json("/api/jellyfin/sessions")).status, "online");
  assert.equal((await json("/api/jellyfin/health")).status, "online");
  const artwork = await request(`/api/jellyfin/artwork/${itemId}?tag=testTag`);
  assert.equal(artwork.status, 200);
  assert.equal(artwork.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await artwork.arrayBuffer()), png);
  jellyfinAuthorized = false;
  assert.equal((await json("/api/jellyfin/sessions")).status, "unauthorized");
  jellyfinAuthorized = true;
  const webhook = { method: "POST", body: JSON.stringify({ status: "success" }) };
  assert.equal((await request("/api/webhooks/offen", webhook)).status, 401);
  assert.equal((await request("/api/webhooks/offen", { ...webhook,
    headers: { "X-Nerve-Token": token, "X-Nerve-Source": "local" } })).status, 200);
  const backups = await json("/api/backups");
  assert.equal(backups.dbError, null);
  assert.equal(backups.runs.length, 1);
  assert.equal((await json("/api/gluetun/status")).health, "healthy");
  assert.equal(readOnlyViolation, false, "All upstream calls remain GET-only");
  assert.ok(!serverLog.includes(key) && !serverLog.includes(token), "No test credentials in server logs");
  console.log("PASS: standalone dashboard, Docker proxy API, service health, WUD/basic auth, Jellyfin/auth/artwork, Gluetun, Offen auth and SQLite persistence");
  if (process.argv.includes("--serve")) {
    console.log("READY: fixture-backed dashboard on port 3000 for browser QA");
    await new Promise((resolve) => {
      process.once("SIGTERM", resolve);
      process.once("SIGINT", resolve);
    });
  }
} finally {
  await cleanup();
}
