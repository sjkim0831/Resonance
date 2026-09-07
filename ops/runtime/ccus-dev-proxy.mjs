import http from "node:http";
import https from "node:https";
import net from "node:net";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createPortOneTestHandler } from "./portone-test-handler.mjs";
const handlePortOneTest = createPortOneTestHandler();

// Canonical source for the buildless development proxy. Synchronize it with
// ops/scripts/sync-carbonet-dev-proxy.sh instead of editing the runtime copy.

const listenHost = "0.0.0.0";
const listenPort = 80;
const secureListenHost = process.env.CARBONET_DIRECT_HTTPS_HOST || "172.16.1.232";
const frontend = { host: "127.0.0.1", port: 5175 };
const developmentBackend = { host: "127.0.0.1", port: 18000 };
const productionBackend = { host: "127.0.0.1", port: 18080 };
const productionHosts = new Set([
  "production.172.16.1.232.nip.io",
  "production.211.50.135.232.nip.io",
  "carbonet.duckdns.org",
  "ccus.duckdns.org",
  "211.50.135.232"
]);
const tlsKeyPath = process.env.CARBONET_DIRECT_TLS_KEY || "/opt/resonance-data/dev-runtime/certificate-verification/tls/tls.key";
const tlsCertPath = process.env.CARBONET_DIRECT_TLS_CERT || "/opt/resonance-data/dev-runtime/certificate-verification/tls/tls.crt";
const externalTlsKeyPath = process.env.CARBONET_EXTERNAL_TLS_KEY || "/opt/resonance-data/dev-runtime/certificate-verification/tls/ccus-duckdns.key";
const externalTlsCertPath = process.env.CARBONET_EXTERNAL_TLS_CERT || "/opt/resonance-data/dev-runtime/certificate-verification/tls/ccus-duckdns.crt";
const acmeChallengeRoot = process.env.CARBONET_ACME_CHALLENGE_ROOT || "/opt/resonance-data/acme/carbonet-production/.well-known/acme-challenge";
const resonanceRoot = "/opt/resonance-data/dev-worktrees/certificate-verification";
const memberClosureScript = `${resonanceRoot}/ops/scripts/run-member-domain-closure-fast-dev.sh`;
const memberClosureEvidenceRoot = `${resonanceRoot}/var/test-evidence/member-domain-closure`;
const memberDesignFingerprintScript = `${resonanceRoot}/ops/scripts/member-domain-design-fingerprint.sh`;
const runtimeAlertEventFile = `${resonanceRoot}/var/dev-design-sync/runtime-alert-events.jsonl`;
let memberClosureJob = null;
let memberDesignWatch = { enabled: false, baseline: null, pending: null, pendingSince: null, lastTriggeredAt: null, lastTrigger: null };

function appendRuntimeAlert(sourceCode, req, statusCode, reasonCode) {
  if (!sourceCode) return;
  const pathname = String(req.url || "/").split("?", 1)[0].slice(0, 240);
  const event = {
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    sourceCode,
    statusCode: Number(statusCode || 0),
    method: String(req.method || "GET").slice(0, 12),
    pathname,
    reasonCode
  };
  try {
    fs.mkdirSync(`${resonanceRoot}/var/dev-design-sync`, { recursive: true });
    fs.appendFileSync(runtimeAlertEventFile, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o640 });
  } catch (error) {
    console.error(`[runtime-alert] append failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function classifyResponseAlert(req, statusCode) {
  const pathname = String(req.url || "/").split("?", 1)[0];
  if (statusCode >= 500 && /\/emission-survey-report\/issue-pdf$/.test(pathname)) return ["PDF_ISSUANCE_FAILURE", "PDF_API_HTTP_ERROR"];
  if (statusCode >= 500 && isBackendPath(pathname)) return ["API_HTTP_500", "BACKEND_HTTP_5XX"];
  if (statusCode === 404 && !/\.(?:js|css|map|png|jpe?g|gif|svg|ico|woff2?|ttf)$/i.test(pathname)) return ["PAGE_HTTP_404", "ROUTE_OR_PAGE_DATA_NOT_FOUND"];
  return ["", ""];
}

function isBackendPath(url = "") {
  const pathname = String(url || "").split("?", 1)[0];
  return /^\/(?:en\/)?(?:api\/|admin\/api\/|signin\/api\/|actuator\/|runtime\/screens\/)/.test(pathname)
    || /^\/(?:en\/)?signin\/(?:actionLogin|actionLogout)$/.test(pathname)
    || /^\/(?:en\/)?signin\/(?:account-recovery\/requests(?:\/[^/]+\/verify)?|resetPassword)$/.test(pathname)
    || /^\/(?:en\/)?admin\/login\/(?:actionLogin|actionLogout)$/.test(pathname)
    || /^\/(?:en\/)?admin\/system\/menu-data$/.test(pathname)
    || pathname.endsWith("/page-data");
}

function backendForRequest(req) {
  const requestHost = String(req.headers.host || "").split(":", 1)[0].toLowerCase();
  return productionHosts.has(requestHost) ? productionBackend : developmentBackend;
}

function forwardedHeaders(req, target) {
  const requestHost = String(req.headers.host || "").split(":", 1)[0].toLowerCase();
  const upstreamHost = target === frontend && requestHost.endsWith(".duckdns.org")
    ? `${target.host}:${target.port}`
    : (req.headers.host || `${target.host}:${target.port}`);
  return {
    ...req.headers,
    host: upstreamHost,
    "x-forwarded-host": req.headers.host || "",
    "x-forwarded-proto": String(req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http")),
    // The edge owns client-address attribution. Never forward a caller-supplied
    // X-Forwarded-For value because it would create a new public rate-limit key.
    "x-forwarded-for": String(req.socket.remoteAddress || "")
  };
}

function responseHeaders(req, headers) {
  const requestHost = String(req.headers.host || "").split(":", 1)[0].toLowerCase();
  if (!req.socket.encrypted || !productionHosts.has(requestHost)) return headers;
  return {
    ...headers,
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "content-security-policy": "upgrade-insecure-requests; block-all-mixed-content",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin"
  };
}

function latestMemberClosureReceipt() {
  try {
    const runs = fs.readdirSync(memberClosureEvidenceRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
    for (const run of runs) {
      const path = `${memberClosureEvidenceRoot}/${run}/receipt.json`;
      if (fs.existsSync(path)) {
        const receipt = JSON.parse(fs.readFileSync(path, "utf8"));
        const defaults = {
          STATIC: { file: "projects/carbonet-backend-metadata/work-design", route: "/admin/system/actor-process?tab=process-map&process=MEMBER_LIFECYCLE" },
          LIFECYCLE: { file: "projects/carbonet-backend-metadata/work-design", route: "/admin/system/actor-process?tab=process-map&process=MEMBER_LIFECYCLE" },
          CONTROLS: { file: "apps/carbonet-api/src/main/resources/db/migration/postgresql", route: "/admin/system/authority" },
          EXCEPTIONS: { file: "projects/carbonet-frontend/source/src/features/task-quest", route: "/emission/my-tasks" }
        };
        receipt.gates = (receipt.gates || []).map((gate) => {
          const logName = String(gate.log || "").replace(/[^a-z0-9._-]/gi, "");
          const logPath = `${memberClosureEvidenceRoot}/${run}/${logName}`;
          const logOutput = logName && fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").slice(-12000) : "";
          const affectedFiles = [...new Set(logOutput.match(/(?:apps|modules|ops|projects)\/[A-Za-z0-9_./-]+/g) || [])].slice(0, 8);
          const affectedRoutes = [...new Set(logOutput.match(/\/(?:admin|emission|home|join|mypage)\/[A-Za-z0-9_?&=./-]+/g) || [])].slice(0, 8);
          const fallback = defaults[gate.name] || defaults.STATIC;
          return { ...gate, logOutput, affectedFiles: affectedFiles.length ? affectedFiles : [fallback.file], affectedRoutes: affectedRoutes.length ? affectedRoutes : [fallback.route] };
        });
        return { ...receipt, evidencePath: path };
      }
    }
  } catch {}
  return null;
}

function writeJson(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function authenticatedDevelopmentRequest(req, callback) {
  const upstream = http.request({
    hostname: developmentBackend.host,
    port: developmentBackend.port,
    method: "GET",
    path: "/home/api/process-executions/qa-results?processCode=MEMBER_LIFECYCLE",
    headers: forwardedHeaders(req, developmentBackend)
  }, (response) => {
    response.resume();
    response.on("end", () => callback(response.statusCode === 200));
  });
  upstream.on("error", () => callback(false));
  upstream.end();
}

function startMemberClosureJob(trigger = "manual", requestedGate = "ALL") {
  if (memberClosureJob?.running) return false;
  const startedAt = new Date().toISOString();
  const child = spawn("/bin/bash", [memberClosureScript], { cwd: resonanceRoot, env: { ...process.env, RESONANCE_ROOT: resonanceRoot, MEMBER_CLOSURE_ONLY_GATE: requestedGate } });
  memberClosureJob = { running: true, pid: child.pid, trigger, requestedGate, startedAt, finishedAt: null, exitCode: null, output: "" };
  const capture = (chunk) => {
    memberClosureJob.output = `${memberClosureJob.output}${chunk}`.slice(-16000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  child.on("error", (error) => {
    memberClosureJob = { ...memberClosureJob, running: false, finishedAt: new Date().toISOString(), exitCode: -1, output: `${memberClosureJob.output}\n${error.message}`.trim() };
  });
  child.on("exit", (code) => {
    memberClosureJob = { ...memberClosureJob, running: false, finishedAt: new Date().toISOString(), exitCode: code ?? -1 };
  });
  return true;
}

function readMemberDesignFingerprint(callback) {
  const child = spawn("/bin/bash", [memberDesignFingerprintScript], { cwd: resonanceRoot, env: { ...process.env, RESONANCE_ROOT: resonanceRoot } });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.on("error", () => callback(null));
  child.on("exit", (code) => callback(code === 0 ? output.trim() : null));
}

function pollMemberDesignChanges() {
  if (!memberDesignWatch.enabled) return;
  readMemberDesignFingerprint((fingerprint) => {
    if (!fingerprint) return;
    if (!memberDesignWatch.baseline) {
      memberDesignWatch = { ...memberDesignWatch, baseline: fingerprint };
      return;
    }
    if (fingerprint === memberDesignWatch.baseline) {
      memberDesignWatch = { ...memberDesignWatch, pending: null, pendingSince: null };
      return;
    }
    const now = Date.now();
    if (fingerprint !== memberDesignWatch.pending) {
      memberDesignWatch = { ...memberDesignWatch, pending: fingerprint, pendingSince: now };
      return;
    }
    if (now - memberDesignWatch.pendingSince < 10000 || memberClosureJob?.running) return;
    memberDesignWatch = { ...memberDesignWatch, baseline: fingerprint, pending: null, pendingSince: null, lastTriggeredAt: new Date().toISOString(), lastTrigger: "design-change" };
    startMemberClosureJob("design-change", "ALL");
  });
}

function handleMemberClosureQa(req, res) {
  const requestHost = String(req.headers.host || "").split(":", 1)[0].toLowerCase();
  if (productionHosts.has(requestHost)) {
    writeJson(res, 404, { success: false, message: "Development QA runner is unavailable on production." });
    return;
  }
  authenticatedDevelopmentRequest(req, (authenticated) => {
    if (!authenticated) {
      writeJson(res, 401, { success: false, message: "Authentication is required." });
      return;
    }
    if (req.method === "GET") {
      writeJson(res, 200, { success: true, running: Boolean(memberClosureJob?.running), job: memberClosureJob, receipt: latestMemberClosureReceipt(), automation: memberDesignWatch });
      return;
    }
    if (req.method !== "POST" || req.headers["x-carbonet-test-mode"] !== "1") {
      writeJson(res, 405, { success: false, message: "POST with test mode is required." });
      return;
    }
    if (memberClosureJob?.running) {
      writeJson(res, 409, { success: false, message: "Member closure verification is already running.", job: memberClosureJob });
      return;
    }
    const requestedGate = new URL(req.url || "/", "http://localhost").searchParams.get("gate") || "ALL";
    if (!new Set(["ALL", "STATIC", "LIFECYCLE", "CONTROLS", "EXCEPTIONS"]).has(requestedGate)) {
      writeJson(res, 400, { success: false, message: "Unknown member closure gate." });
      return;
    }
    startMemberClosureJob("manual", requestedGate);
    writeJson(res, 202, { success: true, running: true, job: memberClosureJob });
  });
}

const handleRequest = (req, res) => {
  if (handlePortOneTest(req, res)) return;
  if (String(req.url || "").split("?", 1)[0] === "/runtime/qa/member-domain-closure") {
    handleMemberClosureQa(req, res);
    return;
  }
  const target = isBackendPath(req.url) ? backendForRequest(req) : frontend;
  const upstream = http.request({
    hostname: target.host,
    port: target.port,
    method: req.method,
    path: req.url,
    headers: forwardedHeaders(req, target)
  }, (upstreamResponse) => {
    const statusCode = upstreamResponse.statusCode || 502;
    const [sourceCode, reasonCode] = classifyResponseAlert(req, statusCode);
    appendRuntimeAlert(sourceCode, req, statusCode, reasonCode);
    upstreamResponse.on("error", () => {
      if (!res.destroyed) res.destroy();
    });
    const pathname = String(req.url || "").split("?", 1)[0];
    const inspectLogin = /\/(?:admin\/login\/)?actionLogin$/.test(pathname);
    if (!inspectLogin) {
      res.writeHead(statusCode, responseHeaders(req, upstreamResponse.headers));
      upstreamResponse.pipe(res);
      return;
    }
    const chunks = [];
    let bytes = 0;
    upstreamResponse.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes <= 65536) chunks.push(chunk);
    });
    upstreamResponse.on("end", () => {
      const body = Buffer.concat(chunks);
      if (/\"status\"\s*:\s*\"loginFailure\"/.test(body.toString("utf8"))) {
        appendRuntimeAlert("LOGIN_AUTHENTICATION_FAILURE", req, statusCode, "LOGIN_REJECTED");
      }
      res.writeHead(statusCode, responseHeaders(req, upstreamResponse.headers));
      res.end(body);
    });
  });
  upstream.on("error", (error) => {
    appendRuntimeAlert("API_HTTP_500", req, 502, "UPSTREAM_UNAVAILABLE");
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    }
    res.end(JSON.stringify({ status: "error", message: "Upstream unavailable", detail: error.message }));
  });
  req.on("aborted", () => upstream.destroy());
  req.on("error", () => upstream.destroy());
  res.on("error", () => upstream.destroy());
  req.pipe(upstream);
};

const handlePlainRequest = (req, res) => {
  const requestHost = String(req.headers.host || "").split(":", 1)[0].toLowerCase();
  const challengePrefix = "/.well-known/acme-challenge/";
  const pathname = String(req.url || "/").split("?", 1)[0];
  if (req.method === "GET" && pathname.startsWith(challengePrefix)) {
    const token = pathname.slice(challengePrefix.length);
    if (/^[A-Za-z0-9_-]+$/.test(token)) {
      try {
        const body = fs.readFileSync(`${acmeChallengeRoot}/${token}`);
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
        res.end(body);
        return;
      } catch {}
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    res.end("ACME challenge not found");
    return;
  }
  if (productionHosts.has(requestHost)) {
    const location = `https://${requestHost}${req.url || "/"}`;
    res.writeHead(308, {
      location,
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8"
    });
    res.end(`HTTPS is required: ${location}`);
    return;
  }
  handleRequest(req, res);
};

const server = http.createServer(handlePlainRequest);
const secureServer = https.createServer({
  key: fs.readFileSync(tlsKeyPath),
  cert: fs.readFileSync(tlsCertPath),
  minVersion: "TLSv1.2"
}, handleRequest);
const externalSecureServer = https.createServer({
  key: fs.readFileSync(externalTlsKeyPath),
  cert: fs.readFileSync(externalTlsCertPath),
  minVersion: "TLSv1.2"
}, handleRequest);

function handleUpgrade(req, socket, head) {
  const upstream = net.connect(frontend.port, frontend.host, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let index = 0; index < req.rawHeaders.length; index += 2) {
      lines.push(`${req.rawHeaders[index]}: ${req.rawHeaders[index + 1]}`);
    }
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  socket.on("error", () => upstream.destroy());
  socket.on("close", () => upstream.destroy());
  upstream.on("error", () => socket.destroy());
  upstream.on("close", () => socket.destroy());
}

server.on("upgrade", handleUpgrade);
secureServer.on("upgrade", handleUpgrade);
externalSecureServer.on("upgrade", handleUpgrade);

server.listen(listenPort, listenHost, () => {
  console.log(`Carbonet direct development proxy listening on ${listenHost}:${listenPort}`);
});

secureServer.listen(443, secureListenHost, () => {
  console.log(`Carbonet direct HTTPS proxy listening on ${secureListenHost}:443`);
});

externalSecureServer.listen(32947, listenHost, () => {
  console.log(`Carbonet direct external HTTPS proxy listening on ${listenHost}:32947`);
});

pollMemberDesignChanges();
setInterval(pollMemberDesignChanges, 5000).unref();
