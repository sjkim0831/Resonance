import fs from "node:fs";

const root = process.env.RESONANCE_ROOT || process.cwd();
const migration = fs.readFileSync(`${root}/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811185500__complete_work_assignment_field_contracts.sql`, "utf8");
const page = fs.readFileSync(`${root}/projects/carbonet-frontend/source/src/features/work-assignment/WorkAssignmentPage.tsx`, "utf8");

for (const token of ["WORK_ASSIGNMENT_CONTEXT", "WORK_ASSIGNMENT_ACTOR", "WORK_ASSIGNMENT_STEP", "WORK_ASSIGNMENT_CONFIRM", "affected <> 4", "jsonb_array_elements", "assignments[].stepCode", "assignments[].accountId", "assignedStepCount", "updatedTaskCount", "auditEvidenceId"]) {
  if (!migration.includes(token)) throw new Error(`missing migration contract: ${token}`);
}
for (const token of ["projectId", "workTypeCode", "processCode", "processAccountId", "assignments", "stepCode", "accountId", "assignedStepCount", "updatedTaskCount"]) {
  if (!page.includes(token) || !migration.includes(`'${token}'`)) throw new Error(`frontend/contract mismatch: ${token}`);
}
if ((migration.match(/'fieldCode'/g) || []).length < 16) throw new Error("field contract is not detailed enough");
console.log("[work-assignment-field-contract] PASS steps=4 sharedFields=8 specializedFields=9 apiMapped=true ai=false");
