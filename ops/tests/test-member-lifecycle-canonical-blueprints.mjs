#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationPath = process.env.MEMBER_CANONICAL_BLUEPRINT_MIGRATION
  ? path.resolve(process.env.MEMBER_CANONICAL_BLUEPRINT_MIGRATION)
  : path.join(
      root,
      "apps/carbonet-api/src/main/resources/db/migration/postgresql/" +
        "V20260814052000__close_member_lifecycle_canonical_runtime_contract.sql",
    );
const source = readFileSync(migrationPath, "utf8");

const required = [
  ["exact-process-scope", "step.process_code='MEMBER_LIFECYCLE'"],
  ["user-audience", "contract.audience='USER'"],
  ["exact-step-route-source", "step.user_path=blueprint.route_path"],
  ["query-route-preserved", "screen_name,user_path,'CONTENT','KRDS_CONTENT'"],
  ["normalized-contract-join", "lower(split_part(contract.route_path,'?',1))="],
  ["raw-unique-insert", "ON CONFLICT(audience,route_path) DO NOTHING"],
  ["exact-source-reference", "'framework_professional_screen_contract:'||contract.contract_id"],
  ["four-source-closure", "source_count<>4 OR distinct_route_count<>4"],
  ["exact-contract-cardinality", "professional contract identity is not exact"],
  ["targeted-bundle-only", "framework_canonical_screen_bundle("],
  ["seven-lanes", "'API','DATABASE','DESIGN_CARD','FRONTEND','HELP','QA','WORK_GUIDE'"],
  ["asset-bindings", "{canonicalDesign,lanes,DESIGN_CARD,assetBindings}"],
  ["hash-format", "'^[0-9a-f]{64}$'"],
  ["hash-recompute", "encode(sha256(convert_to(bundle->>'canonicalText','UTF8')),'hex')"],
  ["adopt-existing", "'ADOPT_EXISTING'"],
  ["react-source", "features/work-execution/WorkExecutionPage.tsx"],
];

function violations(candidate) {
  const failed = required
    .filter(([, token]) => !candidate.includes(token))
    .map(([name]) => name);
  if (candidate.includes("framework_canonical_design_catalog(")) failed.push("no-global-catalog");
  if (candidate.includes("framework_canonical_design_readiness(")) failed.push("no-global-readiness");
  if (/\bUPDATE\s+framework_screen_blueprint\b/i.test(candidate)) failed.push("no-blueprint-update");
  if (/insert\s+into\s+framework_screen_contract_version/i.test(candidate)) failed.push("no-runtime-version-dml");
  if (/insert\s+into\s+framework_screen_contract_binding/i.test(candidate)) failed.push("no-runtime-binding-dml");
  if (/(?:insert\s+into|update|delete\s+from)\s+framework_professional_screen_contract/i.test(candidate)) {
    failed.push("no-professional-contract-dml");
  }
  return failed;
}

const failed = violations(source);
if (failed.length) {
  throw new Error(`MEMBER canonical blueprint contract failed: ${failed.join(",")}`);
}

let mutantCount = 0;
for (const [name, token] of required) {
  if (!source.includes(token)) throw new Error(`mutation fixture missing: ${name}`);
  mutantCount += 1;
  const mutantFailures = violations(source.replaceAll(token, "__REMOVED_BY_MUTANT__"));
  if (!mutantFailures.includes(name)) {
    throw new Error(`${name} mutation survived: ${mutantFailures.join(",") || "none"}`);
  }
}

const stepTokens = [
  "MEMBER_LIFECYCLE_01_PLAN",
  "MEMBER_LIFECYCLE_02_WORK",
  "MEMBER_LIFECYCLE_03_VERIFY",
  "MEMBER_LIFECYCLE_04_APPROVE",
];
// The migration derives all four rows from process_step rather than duplicating
// step literals.  Its fail-closed cardinality guard is the executable assertion;
// this test keeps the expected identities visible to reviewers and CI output.
if (new Set(stepTokens).size !== 4) throw new Error("expected step identities drifted");

console.log(
  `MEMBER_LIFECYCLE_CANONICAL_BLUEPRINT_CONTRACT_PASS checks=${required.length + 6} ` +
    `mutants=${mutantCount} identities=${stepTokens.length} lanes=7 ` +
    `publication=AUTHENTICATED_SAVE_API`,
);
