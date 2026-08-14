#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const harnessPath = path.join(root, "ops/scripts/resonance-member-lifecycle-relay-e2e.mjs");
const source = readFileSync(harnessPath, "utf8");

function violations(candidate) {
  const checks = [
    ["no-webmaster-default", !/\|\|\s*["']webmaster["']/.test(candidate)],
    ["webmaster-rejected", candidate.includes('user.toLowerCase() === "webmaster"')],
    ["complete-explicit-pair", candidate.includes("explicit credential pair is incomplete")],
    ["secret-credential-source", candidate.includes('loadSecretField("username")') && candidate.includes('loadSecretField("password")')],
    ["password-env-cleared", candidate.includes("for (const key of explicitPairs.flat()) delete process.env[key]")],
    ["canonical-auth-lock", candidate.includes('"/tmp/carbonet-qa-auth-session.lock"') && candidate.includes('spawnSync("flock"') && candidate.includes('CARBONET_MEMBER_RELAY_LOCK_HELD: "1"')],
    ["active-token-baseline-zero", candidate.includes("evidence.cleanup.activeTokenBaseline !== 0")],
    ["finally-cleanup", /finally\s*\{\s*await cleanupRun\(\);\s*await persistEvidence\(\);\s*\}/s.test(candidate)],
    ["reset-in-cleanup", /async function cleanupRun\(\)[\s\S]*await resetProcessState\(cleanupOwnerApi\);/.test(candidate)],
    ["actor-logout-in-cleanup", /async function cleanupRun\(\)[\s\S]*await logoutAndDisposeActor\("cleanup", true\);/.test(candidate)],
    ["admin-logout-in-cleanup", (candidate.match(/await logoutContext\(adminApi, "admin", true\);/g) || []).length >= 2],
    ["actor-context-disposal", candidate.includes("await disposeRequestContext(context);")],
    ["browser-context-disposal", (candidate.match(/await uiContext\.close\(\);/g) || []).length >= 2],
    ["event-and-draft-zero", candidate.includes("residue.eventCount !== 0 || residue.draftCount !== 0")],
    ["active-token-zero", candidate.includes("postCleanupTokenCount !== 0")],
    ["exclusive-evidence-write", candidate.includes('{ flag: "wx", mode: 0o600 }') && candidate.includes("await chmod(evidencePath, 0o400)")],
    ["eight-screenshot-gate", candidate.includes("evidence.screenshotPaths.length !== 8") && candidate.includes("evidence.screenshots.length !== 8")],
    ["screenshot-paths-and-hashes", candidate.includes("await page.screenshot") && candidate.includes("evidence.screenshotPaths.push") && candidate.includes('createHash("sha256")')],
    ["no-secret-output", !/(console\.(?:log|error)|JSON\.stringify)\s*\([^\n]*(credentialPassword|credentials\.password|selected\.password)/.test(candidate)],
  ];
  return checks.filter(([, passed]) => !passed).map(([name]) => name);
}

function assertContract(candidate, label) {
  const failed = violations(candidate);
  if (failed.length) throw new Error(`${label} failed safe relay contract: ${failed.join(",")}`);
}

function mutate(label, needle, replacement, expectedViolation) {
  if (!source.includes(needle)) throw new Error(`mutation fixture missing source needle: ${label}`);
  const mutant = source.replace(needle, replacement);
  const failed = violations(mutant);
  if (!failed.includes(expectedViolation)) {
    throw new Error(`${label} mutation survived; expected ${expectedViolation}, observed ${failed.join(",") || "none"}`);
  }
}

assertContract(source, "canonical harness");
mutate(
  "webmaster default introduction",
  'const user = String(process.env[userKey] || "");',
  'const user = String(process.env[userKey] || "webmaster");',
  "no-webmaster-default",
);
mutate(
  "webmaster rejection removal",
  'user.toLowerCase() === "webmaster"',
  'user.toLowerCase() === "never-a-real-account"',
  "webmaster-rejected",
);
mutate(
  "explicit credential completeness removal",
  "explicit credential pair is incomplete",
  "credential pair warning",
  "complete-explicit-pair",
);
mutate(
  "canonical QA lock removal",
  'const locked = spawnSync("flock", [',
  'const locked = spawnSync("true", [',
  "canonical-auth-lock",
);
mutate(
  "cleanup RESET removal",
  "await resetProcessState(cleanupOwnerApi);",
  "void cleanupOwnerApi;",
  "reset-in-cleanup",
);
mutate(
  "actor logout removal",
  'await logoutAndDisposeActor("cleanup", true);',
  "void actorApi;",
  "actor-logout-in-cleanup",
);
mutate(
  "admin logout removal",
  'await logoutContext(adminApi, "admin", true);',
  "void adminApi;",
  "admin-logout-in-cleanup",
);
mutate(
  "active token assertion weakening",
  "postCleanupTokenCount !== 0",
  "postCleanupTokenCount < 0",
  "active-token-zero",
);
mutate(
  "residue assertion weakening",
  "residue.eventCount !== 0 || residue.draftCount !== 0",
  "residue.eventCount < 0 || residue.draftCount < 0",
  "event-and-draft-zero",
);
mutate(
  "exclusive evidence write removal",
  '{ flag: "wx", mode: 0o600 }',
  "{ mode: 0o600 }",
  "exclusive-evidence-write",
);
mutate(
  "screenshot count regression",
  "evidence.screenshotPaths.length !== 8",
  "evidence.screenshotPaths.length !== 7",
  "eight-screenshot-gate",
);
mutate(
  "browser context close removal",
  "await uiContext.close();",
  "void uiContext;",
  "browser-context-disposal",
);
mutate(
  "credential console exposure",
  "credentialPassword = credentials.password;",
  "credentialPassword = credentials.password; console.log(credentials.password);",
  "no-secret-output",
);

console.log("MEMBER_LIFECYCLE_RELAY_SAFE_HARNESS_CONTRACT_PASS checks=19 mutants=13 screenshots=8 cleanup=reset+logout+tokens+residue");
