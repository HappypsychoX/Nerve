// Opt-in network regression check. No credentials, redirects or TLS bypasses.
// Run with --system inside a disposable Alpine container with curl installed.
import https from "node:https";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const system = process.argv.includes("--system");
if (process.argv.slice(2).some((arg) => arg !== "--system")) {
  throw new Error("Usage: node scripts/verify-tls.mjs [--system]");
}
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  throw new Error("Refusing to test with TLS verification disabled");
}
const certificateErrors = new Set([
  "CERT_REVOKED", "CERT_SIGNATURE_FAILURE", "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_UNTRUSTED",
]);
const cases = [
  ["https://nodejs.org/", true],
  ["https://registry.npmjs.org/", true],
  ...["dv-g3b", "dv-g3b-aaa", "dv-g3b-noct", "dv-g3b-aaa-noct"]
    .map((name) => [`https://${name}-emudhra.we-have-a-problem.com/`, false]),
];

function nativeHttps(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { rejectUnauthorized: true, agent: false }, (res) => {
      res.destroy();
      resolve({ accepted: true, detail: `HTTP ${res.statusCode}` });
    });
    const timer = setTimeout(() => req.destroy(new Error("TIMEOUT")), 12000);
    req.once("close", () => clearTimeout(timer));
    req.once("error", (err) => resolve({
      accepted: false, certificate: certificateErrors.has(err.code),
      detail: err.code ?? err.message,
    }));
  });
}

async function nativeFetch(url) {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(12000) });
    await res.body?.cancel();
    return { accepted: true, detail: `HTTP ${res.status}` };
  } catch (err) {
    const code = err.cause?.code ?? err.code ?? err.name;
    return { accepted: false, certificate: certificateErrors.has(code), detail: code };
  }
}

async function systemCurl(url) {
  try {
    const { stdout } = await run("curl", [
      "--silent", "--show-error", "--noproxy", "*", "--proto", "=https",
      "--cacert", "/etc/ssl/certs/ca-certificates.crt",
      "--connect-timeout", "5", "--max-time", "12",
      "--output", "/dev/null", "--write-out", "%{http_code}", url,
    ], { timeout: 15000 });
    return { accepted: true, detail: `HTTP ${stdout}` };
  } catch (err) {
    const detail = err.stderr?.trim() ?? err.message;
    return { accepted: false,
      certificate: err.code === 60 && /unable to get (local )?issuer certificate|certificate revoked|self[- ]signed certificate|unable to verify.*certificate/i.test(detail),
      detail: `curl ${err.code}: ${detail.split("\n")[0]}` };
  }
}

console.log(JSON.stringify({ node: process.version, openssl: process.versions.openssl,
  system, extraCA: Boolean(process.env.NODE_EXTRA_CA_CERTS),
  nodeOptionsSet: Boolean(process.env.NODE_OPTIONS) }));
const clients = [["https", nativeHttps], ["fetch", nativeFetch]];
if (system) clients.push(["system-curl", systemCurl]);
const results = await Promise.all(clients.flatMap(([client, request]) =>
  cases.map(async ([url, shouldAccept]) => {
    const result = await request(url);
    // DNS failures, timeouts and connection failures never prove distrust.
    const pass = shouldAccept ? result.accepted : !result.accepted && result.certificate;
    return { client, url, expected: shouldAccept ? "accept" : "certificate-rejection",
      result: result.detail, pass: Boolean(pass) };
  }),
));
for (const result of results) console.log(JSON.stringify(result));
process.exitCode = results.every((result) => result.pass) ? 0 : 1;
