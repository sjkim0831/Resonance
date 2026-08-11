#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));
const browser = fs.readFileSync(path.join(root, "ops/scripts/member-registration-step5-e2e.mjs"), "utf8");
const wrapper = fs.readFileSync(path.join(root, "ops/tests/run-member-registration-step5-business-e2e.sh"), "utf8");

for (const caseType of ["HAPPY_PATH", "AUTHORITY", "ISOLATION", "EXCEPTION", "RECOVERY"]) {
  if (!browser.includes(`caseType: "${caseType}"`)) throw new Error(`missing browser case ${caseType}`);
}
for (const contract of [
  "document.documentElement.scrollWidth",
  "unnamedActions",
  "duplicateIds",
  "production-runtime+browser+admin-handoff",
  "administratorApprovalAndRejection",
  "member-registration-step5-relay-e2e",
]) {
  if (!`${browser}\n${wrapper}`.includes(contract)) throw new Error(`missing step5 contract ${contract}`);
}
if (!wrapper.includes("run-member-approval-business-e2e.sh")) throw new Error("administrator relay E2E is not composed");
if (!wrapper.includes("sha256sum") || !wrapper.includes("begin;") || !wrapper.includes("commit;")) {
  throw new Error("immutable evidence transaction contract is incomplete");
}
console.log("[member-step5-contract] PASS cases=5 responsive=1 accessibility=1 admin-handoff=1 evidence=1");
