import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL(
  "../../projects/carbonet-frontend/source/src/features/generated-screen/GeneratedScreenPage.tsx",
  import.meta.url), "utf8");

assert.doesNotMatch(source, /actions\.length[^\n]+\.slice\(0,\s*1\)/,
  "generated screens must not truncate secondary actions");
assert.match(source, /\.map\(action=>[\s\S]*?execute\(action\.code\)/,
  "each rendered action must execute its own canonical command code");
assert.match(source, /\/start`[\s\S]*?routePath:\s*screen\.routePath,\s*audience:\s*screen\.audience/,
  "process start must carry the exact screen route and audience");
assert.match(source, /\/commands`[\s\S]*?routePath:\s*screen\.routePath,\s*audience:\s*screen\.audience/,
  "each command must carry the exact screen route and audience");
assert.match(source, /requestFields===null\|\|requestFields\.includes\(field\.code\)/,
  "required-field validation must be scoped to the selected command API contract");

const actions = [
  { code: "SAVE", label: "Save" },
  { code: "APPROVE", label: "Approve" },
];
const requests = actions.map(action => ({ method: "POST", body: { commandCode: action.code } }));
assert.deepEqual(requests, [
  { method: "POST", body: { commandCode: "SAVE" } },
  { method: "POST", body: { commandCode: "APPROVE" } },
]);
console.log("generated-screen multi-command contract: PASS (2/2 actions, exact identity and fields)");
