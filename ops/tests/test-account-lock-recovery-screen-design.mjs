import fs from "node:fs";

const root = process.env.RESONANCE_ROOT || process.cwd();
const migration = fs.readFileSync(`${root}/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811190500__complete_account_lock_recovery_screen_design.sql`, "utf8");
const publicPage = fs.readFileSync(`${root}/projects/carbonet-frontend/source/src/features/public-entry/PublicEntryPages.tsx`, "utf8");

for (const token of ["affected_user <> 4", "affected_admin <> 4", "design_ready <> 16", "LOADING:", "EMPTY:", "ERROR:", "FORBIDDEN:", "command_contract = CASE", "계정 잠금 해제", "복구 감사 추적", "ACCOUNT_LOCK_RECOVERY_S1", "ACCOUNT_LOCK_RECOVERY_S2", "ACCOUNT_LOCK_RECOVERY_S3", "ACCOUNT_LOCK_RECOVERY_S4", "contract_status = 'DESIGN_COMPLETE'"]) {
  if (!migration.includes(token)) throw new Error(`missing design contract: ${token}`);
}
for (const endpoint of ["/signin/account-recovery/requests", "/signin/account-recovery/requests/{requestId}/verify", "/signin/resetPassword", "/signin/findPassword/result"]) {
  const sourceToken = endpoint === "/signin/account-recovery/requests/{requestId}/verify"
    ? "/signin/account-recovery/requests/${recoveryRequestId}/verify"
    : endpoint;
  if (!migration.includes(endpoint) || !publicPage.includes(sourceToken)) throw new Error(`public route mismatch: ${endpoint}`);
}
if (/api_verified\s*=\s*true|database_verified\s*=\s*true|authority_verified\s*=\s*true/.test(migration)) throw new Error("design migration must not forge implementation evidence");
console.log("[account-lock-recovery-design] PASS screens=16 user=4 admin=4 verificationForged=0 ai=false");
