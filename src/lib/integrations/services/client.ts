import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { isIP } from "node:net";
import type { ServiceCheckTls } from "@/lib/config";
import type { ServiceProbe } from "./types";

export const SERVICE_CHECK_TIMEOUT_MS = 5000;

export function probeUrl(
  url: string,
  timeoutMs: number = SERVICE_CHECK_TIMEOUT_MS,
  checkTls?: ServiceCheckTls,
): Promise<ServiceProbe> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Promise.resolve({ statusCode: null, error: "network" });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return Promise.resolve({ statusCode: null, error: "network" });
  }

  let tlsOptions: https.RequestOptions = {};
  if (checkTls !== undefined) {
    // Config is runtime YAML: fail closed for missing/malformed trust settings
    // and never silently downgrade a scoped HTTPS check to HTTP.
    if (
      parsed.protocol !== "https:" ||
      !checkTls ||
      typeof checkTls.caFile !== "string" ||
      !checkTls.caFile.trim() ||
      (checkTls.serverName !== undefined &&
        (typeof checkTls.serverName !== "string" ||
          !checkTls.serverName.trim() ||
          isIP(checkTls.serverName) !== 0))
    ) {
      return Promise.resolve({ statusCode: null, error: "network" });
    }
    try {
      const ca = readFileSync(checkTls.caFile);
      // Reject empty/non-certificate files before creating a request.
      new X509Certificate(ca);
      // An explicit ca replaces public roots for this probe. Do not mutate
      // global agents/roots; do not override checkServerIdentity.
      tlsOptions = { ca, servername: checkTls.serverName, agent: false };
    } catch {
      return Promise.resolve({ statusCode: null, error: "network" });
    }
  }

  return new Promise<ServiceProbe>((resolve) => {
    let settled = false;

    const finish = (result: ServiceProbe) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const onResponse = (res: http.IncomingMessage) => {
      res.on("error", () => {});
      res.resume();
      finish({ statusCode: res.statusCode ?? null, error: null });
    };

    // HTTPS health checks must authenticate the endpoint, including probes
    // without credentials. Never count an untrusted certificate as healthy.
    const req =
      parsed.protocol === "https:"
        ? https.request(
            parsed,
            { ...tlsOptions, method: "GET", rejectUnauthorized: true },
            onResponse,
          )
        : http.request(parsed, { method: "GET" }, onResponse);

    // An outer timer bounds the whole lifecycle (DNS lookup, TCP connect, and
    // response) — req.setTimeout only covers socket inactivity once connected.
    const timer = setTimeout(() => {
      finish({ statusCode: null, error: "timeout" });
      req.destroy();
    }, timeoutMs);

    req.on("error", () => {
      finish({ statusCode: null, error: "network" });
    });

    req.end();
  });
}
