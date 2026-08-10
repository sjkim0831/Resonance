import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const declared = readFileSync(new URL("ops/tests/run-privacy-retention-destruction-business-e2e.sh", root), "utf8");
for (const token of [
  "PRD_ACCESS,PRD_CLASSIFY,PRD_DESTROY",
  "PRIVACY_OFFICER,PRIVACY_OFFICER,PRIVACY_OFFICER",
  '"PRIVACY_OFFICER":"qaverify26"',
  '"HSE_MANAGER":"qacalc26"',
  "/work/privacy-retention-destruction",
  "run-declared-process-relay-e2e.sh",
]) if (!declared.includes(token)) throw new Error(`missing PRD relay contract: ${token}`);
console.log("PRIVACY_RETENTION_DESTRUCTION_CONTRACT_PASS steps=3 actors=1 counterActors=1 cleanup=1");
