#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.RESONANCE_ROOT || path.join(testRoot, "../.."));
const frontendRoot = path.join(root, "projects/carbonet-frontend/source");
const sourceRoot = path.join(frontendRoot, "src");
const stylesPath = path.join(sourceRoot, "styles.css");
const taskQuestPath = path.join(sourceRoot, "features/task-quest/TaskQuestPanel.tsx");
const fontPath = path.join(frontendRoot, "public/assets/fonts/MaterialSymbolsOutlined-0.46.0.woff2");
const fontLicensePath = path.join(frontendRoot, "public/assets/fonts/MaterialSymbolsOutlined-LICENSE.txt");
const provenancePath = path.join(frontendRoot, "public/assets/fonts/MaterialSymbolsOutlined-PROVENANCE.txt");
const deployScriptPath = path.join(root, "ops/scripts/auto-deploy-main.sh");
const nodeModules = path.resolve(
  process.env.CARBONET_FRONTEND_NODE_MODULES || path.join(frontendRoot, "node_modules"),
);
const styles = readFileSync(stylesPath, "utf8");
const taskQuest = readFileSync(taskQuestPath, "utf8");
const provenance = readFileSync(provenancePath, "utf8");
const license = readFileSync(fontLicensePath, "utf8");
const deployScript = readFileSync(deployScriptPath, "utf8");
const font = readFileSync(fontPath);

assert.equal(statSync(fontPath).size, 3_960_036, "pinned Material Symbols font size drifted");
assert.equal(
  createHash("sha256").update(font).digest("hex"),
  "9ec3f3deed0be4da191a434b78fdc53e76ead92333290d3f8ee9f3dde34b6339",
  "pinned Material Symbols font digest drifted",
);
assert.match(license, /Apache License\s+Version 2\.0/);
assert.match(provenance, /material-symbols@0\.46\.0/);
assert.match(provenance, /Runtime network dependency: none/);
assert.match(
  deployScript,
  /git -c core\.autocrlf=false -C "\$clean_worktree" checkout-index --force --update --\s*\\\s*projects\/carbonet-frontend\/source\/public\/assets\/fonts\/MaterialSymbolsOutlined-LICENSE\.txt/,
  "persistent deployment worktree must re-materialize the LF-pinned license asset",
);

const fontFace = /@font-face\s*\{(?<rules>[\s\S]*?MaterialSymbolsOutlined-0\.46\.0\.woff2[\s\S]*?)\}/.exec(styles)?.groups?.rules || "";
const symbolRules = /\.material-symbols-outlined\s*\{(?<rules>[\s\S]*?)\}/.exec(styles)?.groups?.rules || "";
const requiredFontFace = [
  [/font-family:\s*"Material Symbols Outlined"/, "self-hosted family"],
  [/\/assets\/react\/assets\/fonts\/MaterialSymbolsOutlined-0\.46\.0\.woff2/, "production asset route"],
  [/font-weight:\s*100 700/, "variable weight range"],
  [/font-display:\s*block/, "no raw-token flash"],
];
const requiredSymbolRules = [
  [/font-family:\s*"Material Symbols Outlined"/, "global family binding"],
  [/white-space:\s*nowrap/, "token no-wrap"],
  [/overflow-wrap:\s*normal/, "global anywhere override"],
  [/word-break:\s*normal/, "token word-break override"],
  [/font-feature-settings:\s*"liga"/, "ligature feature"],
  [/font-variation-settings:[^;]*"opsz"\s+24/, "symbol optical size"],
];
for (const [pattern, name] of requiredFontFace) assert.match(fontFace, pattern, name);
for (const [pattern, name] of requiredSymbolRules) assert.match(symbolRules, pattern, name);

for (const requiredTaskToken of [
  'data-task-quest-panel=""',
  'data-process-qa-card=""',
  "assistant_navigation",
  "fact_check",
  "top-[6.75rem]",
  "top-1/2",
]) {
  assert.ok(taskQuest.includes(requiredTaskToken), `TaskQuest visual contract missing ${requiredTaskToken}`);
}

function collectFiles(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(absolute, output);
    else if (entry.name.endsWith(".tsx")) output.push(absolute);
  }
  return output;
}

const tokenPattern = /<span\b[^>]*material-symbols-outlined[^>]*>\s*([a-z][a-z0-9_]*)\s*<\/span>/g;
const tokens = new Set();
let classReferenceCount = 0;
let componentFileCount = 0;
for (const sourcePath of collectFiles(sourceRoot)) {
  const source = readFileSync(sourcePath, "utf8");
  const references = source.match(/material-symbols-outlined/g) || [];
  if (references.length > 0) componentFileCount += 1;
  classReferenceCount += references.length;
  for (const match of source.matchAll(tokenPattern)) tokens.add(match[1]);
}
const sortedTokens = [...tokens].sort();
assert.ok(componentFileCount >= 160, `global component scan narrowed unexpectedly: ${componentFileCount}`);
assert.ok(classReferenceCount >= 1_100, `global class scan narrowed unexpectedly: ${classReferenceCount}`);
assert.ok(sortedTokens.length >= 220, `global literal token scan narrowed unexpectedly: ${sortedTokens.length}`);
assert.ok(sortedTokens.includes("assistant_navigation"));
assert.ok(sortedTokens.includes("fact_check"));

const fixture = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="/src/styles.css">
  <style>
    html, body { margin: 0; min-height: 100%; overflow-x: hidden; }
    body { background: #f5f7fa; }
    #fixture-root { min-height: 100vh; }
    .fixture-header { position: fixed; inset: 0 0 auto 0; height: 80px; background: #052b57; color: white; z-index: 1000; }
    .fixture-pill { position: fixed; right: 32px; min-height: 48px; display: flex; align-items: center; gap: 8px; border-radius: 9999px; border: 1px solid; background: white; padding: 8px 16px; font-weight: 700; }
    .fixture-pill .material-symbols-outlined { flex: 0 0 auto; font-size: 21px; }
    .fixture-next { top: 108px; color: #12356b; border-color: #16408d; }
    .fixture-qa { top: 50%; transform: translateY(-50%); color: #065f46; border-color: #047857; }
    .fixture-count { border-radius: 9999px; background: #dc2626; color: white; padding: 2px 8px; font-size: 12px; }
    .fixture-token-grid { position: fixed; left: -100000px; top: 0; width: max-content; opacity: 0; pointer-events: none; }
    .fixture-token-grid .material-symbols-outlined { margin: 1px; }
    @media (max-width: 639px) { .fixture-pill { right: 12px; } }
  </style>
</head>
<body><div id="fixture-root"></div>
<script>
  const tokens = ${JSON.stringify(sortedTokens)};
  const root = document.getElementById("fixture-root");
  const icon = (token) => '<span aria-hidden="true" class="material-symbols-outlined" data-symbol-token="' + token + '">' + token + '</span>';
  function render(iteration) {
    const english = iteration % 2 === 1;
    root.innerHTML = '<header class="fixture-header" data-fixture-header></header>' +
      '<button class="fixture-pill fixture-next" data-fixture-next type="button">' + icon('assistant_navigation') + (english ? 'My next task' : '다음 업무') + '<span class="fixture-count">1</span></button>' +
      '<button class="fixture-pill fixture-qa" data-fixture-qa type="button">' + icon('fact_check') + (english ? 'QA workflow' : 'QA 업무') + '</button>' +
      '<div class="fixture-token-grid">' + tokens.map(icon).join('') + '</div>';
    root.dataset.renderCount = String(iteration);
  }
  for (let iteration = 1; iteration <= 30; iteration += 1) render(iteration);
</script></body></html>`;

const requestCounts = new Map();
const server = createServer((request, response) => {
  const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
  requestCounts.set(pathname, (requestCounts.get(pathname) || 0) + 1);
  if (pathname === "/fixture.html") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(fixture);
    return;
  }
  if (pathname === "/src/styles.css") {
    response.writeHead(200, { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "no-store" });
    response.end(styles);
    return;
  }
  if (pathname === "/assets/react/assets/fonts/MaterialSymbolsOutlined-0.46.0.woff2") {
    response.writeHead(200, { "Content-Type": "font/woff2", "Cache-Control": "public, max-age=31536000, immutable" });
    response.end(font);
    return;
  }
  if (pathname === "/assets/react/assets/fonts/PretendardGOVVariable.woff2") {
    response.writeHead(200, { "Content-Type": "font/woff2", "Cache-Control": "public, max-age=31536000, immutable" });
    response.end(readFileSync(path.join(frontendRoot, "public/assets/fonts/PretendardGOVVariable.woff2")));
    return;
  }
  if (pathname === "/favicon.ico") {
    response.writeHead(204, { "Cache-Control": "no-store" });
    response.end();
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain" });
  response.end("not found");
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}`;
const { chromium } = await import(pathToFileURL(path.join(nodeModules, "@playwright/test/index.mjs")).href);
const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "/snap/bin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].find((candidate) => candidate && existsSync(candidate));
const evidenceRoot = path.resolve(process.env.MATERIAL_SYMBOLS_EVIDENCE_DIR || `/tmp/material-symbols-self-hosting-${process.pid}`);
mkdirSync(evidenceRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const browserErrors = [];
const httpErrors = [];
const externalRequests = [];
const results = [];

try {
  const page = await browser.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console:${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror:${error.message}`));
  page.on("request", (request) => {
    if (!request.url().startsWith(baseUrl)) externalRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`);
  });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile-390", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/fixture.html?viewport=${viewport.name}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.fonts.check('24px "Material Symbols Outlined"'));
    const metrics = await page.evaluate(() => {
      const rect = (selector) => {
        const value = document.querySelector(selector)?.getBoundingClientRect();
        if (!value) throw new Error(`missing fixture ${selector}`);
        return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
      };
      const overlaps = (left, right) => left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
      const header = rect("[data-fixture-header]");
      const next = rect("[data-fixture-next]");
      const qa = rect("[data-fixture-qa]");
      const symbolNodes = [...document.querySelectorAll("[data-symbol-token]")];
      const rawTokens = symbolNodes.flatMap((node) => {
        const symbolRect = node.getBoundingClientRect();
        const computed = getComputedStyle(node);
        const limit = Number.parseFloat(computed.fontSize) * 1.1;
        return symbolRect.width > limit || symbolRect.height > limit
          ? [{ token: node.dataset.symbolToken, width: symbolRect.width, height: symbolRect.height, limit }]
          : [];
      });
      const sample = getComputedStyle(document.querySelector('.fixture-token-grid [data-symbol-token="assistant_navigation"]'));
      const inside = (value) => value.left >= 0 && value.top >= 0 && value.right <= innerWidth && value.bottom <= innerHeight;
      return {
        renderCount: Number(document.getElementById("fixture-root")?.dataset.renderCount || 0),
        fontFamily: sample.fontFamily,
        fontFeatureSettings: sample.fontFeatureSettings,
        whiteSpace: sample.whiteSpace,
        overflowWrap: sample.overflowWrap,
        wordBreak: sample.wordBreak,
        display: sample.display,
        symbolCount: symbolNodes.length,
        rawTokens,
        header,
        next,
        qa,
        inside: { next: inside(next), qa: inside(qa) },
        overlap: { pills: overlaps(next, qa), nextHeader: overlaps(next, header), qaHeader: overlaps(qa, header) },
      };
    });

    assert.equal(metrics.renderCount, 30, `${viewport.name}: rerender count`);
    assert.ok(metrics.fontFamily.includes("Material Symbols Outlined"), `${viewport.name}: computed font family`);
    assert.ok(metrics.fontFeatureSettings.includes("liga"), `${viewport.name}: computed ligature feature`);
    assert.equal(metrics.whiteSpace, "nowrap", `${viewport.name}: no wrapping`);
    assert.equal(metrics.overflowWrap, "normal", `${viewport.name}: no anywhere wrapping`);
    assert.equal(metrics.wordBreak, "normal", `${viewport.name}: no token word break`);
    assert.equal(metrics.display, "inline-block", `${viewport.name}: deterministic icon box`);
    assert.equal(metrics.symbolCount, sortedTokens.length + 2, `${viewport.name}: all global tokens rendered`);
    assert.deepEqual(metrics.rawTokens, [], `${viewport.name}: raw symbol token text leaked`);
    assert.deepEqual(metrics.inside, { next: true, qa: true }, `${viewport.name}: pill escaped viewport`);
    assert.deepEqual(metrics.overlap, { pills: false, nextHeader: false, qaHeader: false }, `${viewport.name}: pill/header overlap`);
    const screenshot = path.join(evidenceRoot, `${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    results.push({ viewport, screenshot, next: metrics.next, qa: metrics.qa });
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

assert.deepEqual(browserErrors, [], "browser console/page errors");
assert.deepEqual(httpErrors, [], "browser HTTP errors");
assert.deepEqual(externalRequests, [], "external runtime requests");
assert.ok((requestCounts.get("/assets/react/assets/fonts/MaterialSymbolsOutlined-0.46.0.woff2") || 0) >= 1, "self-hosted font was not requested");

console.log(JSON.stringify({
  status: "PASS",
  componentFileCount,
  classReferenceCount,
  literalTokenCount: sortedTokens.length,
  viewports: results,
  rerendersPerViewport: 30,
  runtimeExternalRequests: 0,
}, null, 2));
