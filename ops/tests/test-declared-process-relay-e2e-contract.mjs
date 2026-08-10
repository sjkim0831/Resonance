import { readFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const common = readFileSync(new URL("ops/tests/run-declared-process-relay-e2e.sh", root), "utf8");
const declared = readFileSync(new URL("ops/tests/run-certification-eligibility-check-business-e2e.sh", root), "utf8");
for (const [source, token] of [
  [common, "RELAY_TOPOLOGY_INVALID"],
  [common, "sort -u"],
  [common, "framework_process_execution_event"],
  [common, 'E2E_DEPLOYED_COMMIT="$RUNTIME_COMMIT"'],
  [common, 'required="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup"'],
  [declared, "CEC_VALIDATE_COMPANY,CEC_VERIFY_EXTERNAL,CEC_DECIDE"],
  [declared, "CERTIFICATE_OFFICER,SYSTEM_INTEGRATOR,CERTIFICATE_OFFICER"],
]) if (!source.includes(token)) throw new Error(`missing declared relay contract: ${token}`);
console.log("DECLARED_PROCESS_RELAY_CONTRACT_PASS process=1 steps=3 actors=2 cleanup=1");
