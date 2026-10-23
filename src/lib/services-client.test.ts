import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rootCertificates } from "node:tls";
import { afterEach, describe, expect, it } from "vitest";
import { probeUrl } from "./integrations/services/client";
import { checkServices } from "./integrations/services";
// Public test-only self-signed localhost certificate/key. Never use outside tests.
import fixture from "./fixtures/localhost-tls.json";

const servers: http.Server[] = [];
const directories: string[] = [];
function certificateFile(content: string = fixture.cert): string {
  const dir = mkdtempSync(join(tmpdir(), "nerve-probe-tls-"));
  directories.push(dir);
  const file = join(dir, "cert.pem");
  writeFileSync(file, content);
  return file;
}
async function listen(server: http.Server): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `127.0.0.1:${(server.address() as AddressInfo).port}`;
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  })));
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("service probe transport", () => {
  it("rejects self-signed HTTPS before sending an HTTP request", async () => {
    let requests = 0;
    const server = https.createServer(fixture, (_req, res) => {
      requests++;
      res.end("untrusted");
    });
    const address = await listen(server);
    expect(await probeUrl(`https://${address}/`)).toEqual({ statusCode: null, error: "network" });
    expect(requests).toBe(0);
  });

  it("preserves internal HTTP health checks", async () => {
    const address = await listen(http.createServer((_req, res) => res.end("ok")));
    expect(await probeUrl(`http://${address}/`)).toEqual({ statusCode: 200, error: null });
  });

  it("bounds a stalled response", async () => {
    const address = await listen(http.createServer(() => {}));
    expect(await probeUrl(`http://${address}/`, 50)).toEqual({ statusCode: null, error: "timeout" });
  });

  it("uses scoped trust and a verified DNS SAN without changing other probes or fetch", async () => {
    const address = await listen(https.createServer(fixture, (_req, res) => res.end("ok")));
    const url = `https://${address}/api/system/status`;
    const [row] = await checkServices([{
      id: "portainer", name: "Portainer", group: "infrastructure", checkUrl: url,
      checkTls: { caFile: certificateFile(), serverName: "localhost" },
    }]);
    expect(row.health).toBe("online");
    expect(row.statusCode).toBe(200);
    expect(row).not.toHaveProperty("checkTls");
    expect(await probeUrl(url)).toEqual({ statusCode: null, error: "network" });
    await expect(fetch(url)).rejects.toThrow();
  });

  it("still rejects a wrong hostname even when the certificate is trusted", async () => {
    let requests = 0;
    const address = await listen(https.createServer(fixture, (_req, res) => {
      requests++;
      res.end("ok");
    }));
    expect(await probeUrl(`https://${address}/`, undefined, {
      caFile: certificateFile(), serverName: "wrong-host.invalid",
    })).toEqual({ statusCode: null, error: "network" });
    expect(requests).toBe(0);
  });

  it("rejects an unrelated certificate with the correct hostname", async () => {
    const address = await listen(https.createServer(fixture, (_req, res) => res.end("ok")));
    expect(await probeUrl(`https://${address}/`, undefined, {
      caFile: certificateFile(rootCertificates[0]), serverName: "localhost",
    })).toEqual({ statusCode: null, error: "network" });
  });

  it.each(["", "not a certificate"])("fails closed on malformed trust material (%j)", async (content) => {
    const address = await listen(https.createServer(fixture, (_req, res) => res.end("ok")));
    expect(await probeUrl(`https://${address}/`, undefined, {
      caFile: certificateFile(content),
    })).toEqual({ statusCode: null, error: "network" });
  });

  it("fails closed on a missing trust file", async () => {
    const missing = `${certificateFile()}.missing`;
    expect(await probeUrl("https://127.0.0.1:1/", undefined, {
      caFile: missing,
    })).toEqual({ statusCode: null, error: "network" });
  });

  it("refuses scoped TLS settings on an HTTP check URL", async () => {
    let requests = 0;
    const address = await listen(http.createServer((_req, res) => {
      requests++;
      res.end("ok");
    }));
    expect(await probeUrl(`http://${address}/`, undefined, {
      caFile: certificateFile(),
    })).toEqual({ statusCode: null, error: "network" });
    expect(requests).toBe(0);
  });
});
