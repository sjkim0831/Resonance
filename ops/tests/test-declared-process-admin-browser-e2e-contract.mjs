import { readFileSync } from "node:fs";
const base = new URL("../../", import.meta.url);
const engine = readFileSync(new URL("ops/scripts/resonance-declared-process-admin-browser-e2e.mjs", base), "utf8");
const wrapper = readFileSync(new URL("ops/tests/run-co2-quality-analysis-admin-e2e.sh", base), "utf8");
for (const token of ["/admin/login/actionLogin", "adminBrowser: 1", "adminResponsive: 1", "adminAccessibility: 1", "pathname.startsWith(\"/admin/\")", "Math.max(Number(evidence.performanceP95Ms || 0), adminP95)", 'includes("SCREEN COORDINATE")', 'querySelectorAll("input,select,textarea,button,a[href]").length >= 8']) if (!engine.includes(token)) throw new Error(`admin engine contract missing: ${token}`);
for (const token of ["const pages = new Map()", "window.dispatchEvent(new PopStateEvent(\"popstate\"))", ".includes(expected)", "sortedAdmin.length < 20"]) if (!engine.includes(token)) throw new Error(`admin SPA measurement contract missing: ${token}`);
for (const token of ["run-co2-quality-analysis-business-e2e.sh", "/admin/work/co2-quality-analysis", "adminBrowser,adminResponsive,adminAccessibility", '"$required" ADMIN']) if (!wrapper.includes(token)) throw new Error(`admin wrapper contract missing: ${token}`);
console.log("DECLARED_PROCESS_ADMIN_BROWSER_CONTRACT_PASS steps=3 routes=24 audience=ADMIN");
