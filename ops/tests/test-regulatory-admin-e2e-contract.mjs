import fs from "node:fs";
const source=fs.readFileSync(new URL("../scripts/resonance-regulatory-admin-e2e.mjs",import.meta.url),"utf8");
for(const token of ['let projectId = String(process.env.CARBONET_REGULATORY_TEST_PROJECT || "")','if (!projectId) projectId = String((listPayload.items || [])[0]?.id || "")','element.closest("label")?.textContent','pageOverflow','authenticatedAdmin: 1','mobile: 1']){if(!source.includes(token))throw new Error(`REGULATORY_ADMIN_E2E_CONTRACT_MISSING ${token}`)}
if(source.includes('PRJ-2026-5B8992'))throw new Error("REGULATORY_ADMIN_E2E_STALE_PROJECT");
console.log("REGULATORY_ADMIN_E2E_CONTRACT_PASS project=dynamic label=associated responsive=desktop+mobile");
