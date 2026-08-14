#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testRoot, "../..");
const frontendRoot = path.join(repositoryRoot, "projects/carbonet-frontend/source");
const indexPath = path.join(frontendRoot, "index.html");
const faviconPath = path.join(frontendRoot, "public/favicon.svg");
const pipelinePath = path.join(frontendRoot, "scripts/run-frontend-pipeline.mjs");
const viteConfigPath = path.join(frontendRoot, "vite.config.ts");
const viteBin = path.join(frontendRoot, "node_modules/vite/bin/vite.js");

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] || "";
}

function iconLinkTags(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => attribute(tag, "rel").toLowerCase().split(/\s+/).includes("icon"));
}

function validateIndex(html, label, expectedHref = "/favicon.svg") {
  const links = iconLinkTags(html);
  assert.equal(links.length, 1, `${label}: exactly one explicit favicon link is required`);
  const tag = links[0];
  assert.equal(attribute(tag, "href"), expectedHref, `${label}: favicon href must match the serving base`);
  assert.equal(attribute(tag, "type"), "image/svg+xml", `${label}: favicon MIME declaration must match SVG bytes`);
  assert.equal(attribute(tag, "sizes"), "any", `${label}: scalable favicon must declare sizes=any`);
  assert.equal(/favicon\.ico/i.test(tag), false, `${label}: favicon.ico must not be requested by the document`);
  return expectedHref;
}

function browserIconRequests(html) {
  const links = iconLinkTags(html);
  return links.length ? links.map((tag) => attribute(tag, "href")) : ["/favicon.ico"];
}

function validateSvg(svg, label) {
  const normalized = svg.trim();
  assert.ok(Buffer.byteLength(svg, "utf8") > 100 && Buffer.byteLength(svg, "utf8") < 4096,
    `${label}: favicon must remain a small code-native vector`);
  assert.match(normalized, /^<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*>/i,
    `${label}: SVG namespace is required`);
  assert.match(normalized, /\bviewBox="0 0 64 64"/i, `${label}: stable square viewBox is required`);
  assert.match(normalized, /<title>Carbonet<\/title>/, `${label}: product title is required`);
  assert.match(normalized, /<(?:path|rect|circle)\b/i, `${label}: at least one vector primitive is required`);
  assert.ok(normalized.endsWith("</svg>"), `${label}: closing svg tag is required`);
  assert.doesNotMatch(normalized, /<(?:script|foreignObject)\b/i, `${label}: executable or foreign content is forbidden`);
  assert.doesNotMatch(normalized, /\b(?:href|xlink:href)\s*=/i, `${label}: external resources are forbidden`);
}

const pipelineGates = [
  "test-work-execution-versioned-support-ui.mjs",
  "test-versioned-support-help-integration.mjs",
  "test-global-user-gnb-home-fetch-stability.mjs",
  "test-frontend-favicon-contract.mjs",
];

function validatePipeline(source, label) {
  for (const gate of pipelineGates) {
    assert.ok(source.includes(gate), `${label}: parallel validation gate missing ${gate}`);
  }
  const promiseStart = source.indexOf("const validationTasks = [");
  const promiseEnd = source.indexOf("];", promiseStart);
  assert.ok(promiseStart >= 0 && promiseEnd > promiseStart, `${label}: validation task array is missing`);
  const validationTasks = source.slice(promiseStart, promiseEnd);
  for (const gate of pipelineGates) {
    assert.ok(validationTasks.includes(gate), `${label}: ${gate} must stay in the parallel validation lane`);
  }
}

let mutantCount = 0;
function rejectMutation(label, callback) {
  mutantCount += 1;
  assert.throws(callback, undefined, `${label}: mutation survived`);
}

async function createViteFixture(indexHtml, faviconSvg, productionBase) {
  await access(viteBin);
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "carbonet-favicon-vite-"));
  const dist = path.join(fixtureRoot, "dist");
  await mkdir(path.join(fixtureRoot, "src"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "public/assets/react/runtime"), { recursive: true });
  await writeFile(path.join(fixtureRoot, "index.html"), indexHtml, "utf8");
  await writeFile(path.join(fixtureRoot, "vite.config.mjs"),
    `export default { base: ${JSON.stringify(productionBase)} };\n`, "utf8");
  await writeFile(path.join(fixtureRoot, "src/main.tsx"), "document.documentElement.dataset.faviconFixture = 'ready';\n", "utf8");
  await writeFile(path.join(fixtureRoot, "public/assets/react/runtime/screen-system-assets.js"), "// favicon fixture\n", "utf8");
  await writeFile(path.join(fixtureRoot, "public/favicon.svg"), faviconSvg, "utf8");
  const build = spawnSync(process.execPath, [
    viteBin,
    "build",
    fixtureRoot,
    "--config",
    path.join(fixtureRoot, "vite.config.mjs"),
    "--outDir",
    dist,
    "--emptyOutDir",
    "--logLevel",
    "error",
  ], {
    cwd: frontendRoot,
    encoding: "utf8",
    timeout: 60_000,
  });
  if (build.error || build.status !== 0) {
    throw new Error(`minimal Vite favicon build failed status=${build.status} ${build.error?.message || ""} ${build.stderr || ""}`);
  }
  return { fixtureRoot, dist };
}

async function startStaticServer({ indexFile, faviconFile, faviconUrl }) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
    requests.push({ method: request.method || "GET", pathname });
    const targetFile = pathname === "/" ? indexFile : pathname === faviconUrl ? faviconFile : "";
    if (!targetFile) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    try {
      const body = await readFile(targetFile);
      response.writeHead(200, {
        "content-type": targetFile.endsWith(".svg") ? "image/svg+xml; charset=utf-8" : "text/html; charset=utf-8",
      });
      response.end(body);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function verifyServedFavicon(baseUrl, expectedHref) {
  const documentResponse = await fetch(`${baseUrl}/`);
  assert.equal(documentResponse.status, 200, "built document must return HTTP 200");
  const href = validateIndex(await documentResponse.text(), "served Vite index", expectedHref);
  const faviconResponse = await fetch(`${baseUrl}${href}`);
  if (faviconResponse.status !== 200) throw new Error(`${href} HTTP ${faviconResponse.status}`);
  assert.match(faviconResponse.headers.get("content-type") || "", /^image\/svg\+xml\b/i,
    "served favicon MIME must match SVG");
  validateSvg(await faviconResponse.text(), "served Vite favicon");
}

const [indexHtml, faviconSvg, pipelineSource, viteConfigSource] = await Promise.all([
  readFile(indexPath, "utf8"),
  readFile(faviconPath, "utf8"),
  readFile(pipelinePath, "utf8"),
  readFile(viteConfigPath, "utf8"),
]);
const productionBaseMatch = viteConfigSource.match(/\bbase:\s*["']([^"']+)["']/);
assert.ok(productionBaseMatch, "Vite production base must be explicit");
const productionBase = productionBaseMatch[1];
assert.match(productionBase, /^\/[A-Za-z0-9/_-]+\/$/, "Vite production base must be a root-relative directory");
const productionFaviconHref = `${productionBase}favicon.svg`;

validateIndex(indexHtml, "source index");
validateSvg(faviconSvg, "source favicon");
validatePipeline(pipelineSource, "frontend pipeline");
assert.deepEqual(browserIconRequests(indexHtml), ["/favicon.svg"], "source document must make one explicit SVG icon request");

const canonicalLink = iconLinkTags(indexHtml)[0];
const missingLinkIndex = indexHtml.replace(canonicalLink, "");
rejectMutation("implicit favicon.ico fallback", () => validateIndex(missingLinkIndex, "missing-link mutant"));
assert.deepEqual(browserIconRequests(missingLinkIndex), ["/favicon.ico"], "missing link mutant must model browser fallback");
rejectMutation("favicon.ico binding", () => validateIndex(indexHtml.replace("/favicon.svg", "/favicon.ico"), "ico mutant"));
rejectMutation("favicon MIME mismatch", () => validateIndex(indexHtml.replace("image/svg+xml", "image/x-icon"), "MIME mutant"));
rejectMutation("malformed SVG", () => validateSvg(faviconSvg.replace("</svg>", ""), "SVG mutant"));
for (const gate of pipelineGates) {
  rejectMutation(`removed pipeline gate ${gate}`, () => validatePipeline(pipelineSource.replace(gate, "removed-validation-gate"), "pipeline mutant"));
}

const sourceServer = await startStaticServer({
  indexFile: indexPath,
  faviconFile: faviconPath,
  faviconUrl: "/favicon.svg",
});
try {
  await verifyServedFavicon(sourceServer.baseUrl, "/favicon.svg");
  assert.equal(sourceServer.requests.filter(({ pathname }) => pathname === "/favicon.svg").length, 1,
    "public source verification must return /favicon.svg exactly once");
  assert.equal(sourceServer.requests.filter(({ pathname }) => pathname === "/favicon.ico").length, 0,
    "public source verification must never request favicon.ico");
} finally {
  await sourceServer.close();
}

const { fixtureRoot, dist } = await createViteFixture(indexHtml, faviconSvg, productionBase);
try {
  const builtIndex = await readFile(path.join(dist, "index.html"), "utf8");
  const builtFavicon = await readFile(path.join(dist, "favicon.svg"), "utf8");
  validateIndex(builtIndex, "Vite output index", productionFaviconHref);
  validateSvg(builtFavicon, "Vite output favicon");
  assert.equal(builtFavicon, faviconSvg, "Vite must copy the public favicon without byte mutation");

  const server = await startStaticServer({
    indexFile: path.join(dist, "index.html"),
    faviconFile: path.join(dist, "favicon.svg"),
    faviconUrl: productionFaviconHref,
  });
  try {
    await verifyServedFavicon(server.baseUrl, productionFaviconHref);
    assert.equal(server.requests.filter(({ pathname }) => pathname === productionFaviconHref).length, 1,
      "production verification must request the base-prefixed favicon exactly once");
    assert.equal(server.requests.filter(({ pathname }) => pathname === "/favicon.ico").length, 0,
      "production verification must never request favicon.ico");

    await rm(path.join(dist, "favicon.svg"));
    mutantCount += 1;
    await assert.rejects(() => verifyServedFavicon(server.baseUrl, productionFaviconHref),
      (error) => error?.message === `${productionFaviconHref} HTTP 404`,
      "missing Vite asset must fail closed on HTTP 404");
    assert.equal(server.requests.filter(({ pathname }) => pathname === "/favicon.ico").length, 0,
      "404 mutant must not hide behind a favicon.ico fallback");
  } finally {
    await server.close();
  }
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log(`FRONTEND_FAVICON_CONTRACT_PASS checks=source+svg+pipeline+vite+http sourceFavicon=/favicon.svg productionFavicon=${productionFaviconHref} faviconSvg200=true faviconIcoRequests=0 mutants=${mutantCount}`);
