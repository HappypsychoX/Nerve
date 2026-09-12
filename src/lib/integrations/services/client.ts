import http from "node:http";
import https from "node:https";
import type { ServiceProbe } from "./types";

export const SERVICE_CHECK_TIMEOUT_MS = 5000;

export function probeUrl(
  url: string,
  timeoutMs: number = SERVICE_CHECK_TIMEOUT_MS,
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

    // rejectUnauthorized:false is safe here: read-only reachability probe, no secrets sent
    const req =
      parsed.protocol === "https:"
        ? https.request(
            parsed,
            { method: "GET", rejectUnauthorized: false },
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
