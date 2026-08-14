#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publishMemberLifecycleContracts } from "../scripts/publish-member-lifecycle-screen-contracts.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const wrapper = await readFile(resolve(here, "../scripts/publish-member-lifecycle-screen-contracts.sh"), "utf8");
const runner = await readFile(resolve(here, "../scripts/publish-member-lifecycle-screen-contracts.mjs"), "utf8");

function extractRuntimeSnapshotGenerator(shellSource) {
  const match = shellSource.match(
    /jq (?<flags>-[A-Za-z]+) --arg source "\$source_commit" --arg container "\$CONTAINER"[\s\S]*?--slurpfile deployment "\$deployment_file" --slurpfile pods "\$pods_file" '\n(?<filter>[\s\S]*?\n    \})'\n\}/,
  );
  assert.ok(match?.groups, "runtime snapshot jq generator is missing");
  return match.groups;
}

function executeRuntimeSnapshot(shellSource, deploymentFile, podsFile, sourceCommit) {
  const { flags, filter } = extractRuntimeSnapshotGenerator(shellSource);
  const result = spawnSync("jq", [
    flags,
    "--arg", "source", sourceCommit,
    "--arg", "container", "carbonet-runtime",
    "--slurpfile", "deployment", deploymentFile,
    "--slurpfile", "pods", podsFile,
    filter,
  ], {
    input: "{poisoned-stdin-is-not-json\n",
    encoding: "utf8",
  });
  assert.notEqual(result.error?.code, "ENOENT", "jq executable is required for the publisher contract test");
  return result;
}

const snapshotDir = await mkdtemp(join(tmpdir(), "member-contract-runtime-snapshot-"));
try {
  const sourceCommit = "a".repeat(40);
  const deploymentFile = join(snapshotDir, "deployment.json");
  const podsFile = join(snapshotDir, "pods.json");
  await writeFile(deploymentFile, JSON.stringify({
    metadata: {
      uid: "deployment-uid-1",
      generation: 42,
      annotations: { "resonance.ai/target-commit": sourceCommit },
    },
    spec: {
      replicas: 2,
      template: {
        metadata: { labels: { "resonance.ai/release-id": "release-42" } },
        spec: { containers: [{ name: "carbonet-runtime", image: "registry/carbonet:release-42" }] },
      },
    },
    status: { observedGeneration: 42, updatedReplicas: 2, readyReplicas: 2, availableReplicas: 2 },
  }));
  await writeFile(podsFile, JSON.stringify({ items: [
    { metadata: { name: "runtime-b" }, status: { containerStatuses: [
      { name: "carbonet-runtime", imageID: "sha256:runtime-image" },
    ] } },
    { metadata: { name: "runtime-a" }, status: { containerStatuses: [
      { name: "carbonet-runtime", imageID: "sha256:runtime-image" },
    ] } },
  ] }));

  const snapshotResult = executeRuntimeSnapshot(wrapper, deploymentFile, podsFile, sourceCommit);
  assert.equal(snapshotResult.status, 0,
    `runtime snapshot must ignore poisoned stdin: ${snapshotResult.stderr}`);
  assert.ok(snapshotResult.stdout.trim().length > 2, "runtime snapshot JSON must be nonempty");
  assert.deepEqual(JSON.parse(snapshotResult.stdout), {
    sourceCommit,
    targetCommit: sourceCommit,
    deploymentUid: "deployment-uid-1",
    deploymentGeneration: 42,
    observedGeneration: 42,
    desiredReplicas: 2,
    updatedReplicas: 2,
    readyReplicas: 2,
    availableReplicas: 2,
    releaseId: "release-42",
    imageRef: "registry/carbonet:release-42",
    podNames: ["runtime-a", "runtime-b"],
    imageIds: ["sha256:runtime-image"],
    healthStatus: "UP",
  });

  const missingNullInputMutant = wrapper.replace(
    'jq -ncS --arg source "$source_commit"', 'jq -cS --arg source "$source_commit"');
  assert.notEqual(missingNullInputMutant, wrapper, "missing -n mutation was not applied");
  const mutantResult = executeRuntimeSnapshot(missingNullInputMutant, deploymentFile, podsFile, sourceCommit);
  assert.notEqual(mutantResult.status, 0, "missing -n mutant consumed poisoned stdin without failing");
  assert.equal(mutantResult.stdout.trim(), "", "missing -n mutant unexpectedly emitted a snapshot");
} finally {
  await rm(snapshotDir, { recursive: true, force: true });
}

for (const required of [
  "carbonet_qa_auth_acquire_lock",
  "carbonet-usage-ledger-system-admin",
  "professional-screen-contracts/preview",
  "professional-screen-contracts",
  "[216005,216006,216007,216008]",
  "runtimeStateHashBefore",
  "runtimeWriteCount:0",
  "activeTokenFinal:$finalTokens",
  "trap cleanup_on_exit EXIT",
  "logout_without_unlock",
  "status --porcelain=v1 --untracked-files=all",
  "resonance.ai/target-commit",
  ".status.observedGeneration==.metadata.generation",
  "imageID closure is not exact",
  "runtime health is not UP",
  "Deployment drifted during initial publication",
  "runtimeStability:{status:\"STABLE\"",
  "sourceCommit:$sourceCommit",
  "jq -ncS --arg source",
  "--connect-timeout \"$CURL_CONNECT_TIMEOUT\" --max-time \"$CURL_MAX_TIME\"",
]) assert.ok(wrapper.includes(required) || runner.includes(required), `missing safety contract: ${required}`);
assert.doesNotMatch(wrapper, /echo[^\n]*(?:PASSWORD|PUBLISH_PASSWORD)|printf[^\n]*(?:PASSWORD|PUBLISH_PASSWORD)/i);
assert.doesNotMatch(runner, /console\.[a-z]+\([^\n]*password/i);
const preSnapshotAt = wrapper.indexOf('runtime_snapshot_before="$(runtime_snapshot)"');
const firstMutationPhaseAt = wrapper.indexOf('CARBONET_MEMBER_CONTRACT_PHASE=initial');
const driftGateAt = wrapper.indexOf('Deployment drifted during initial publication');
const idempotentPhaseAt = wrapper.indexOf('CARBONET_MEMBER_CONTRACT_PHASE=idempotent');
const finalSnapshotAt = wrapper.indexOf('runtime_snapshot_final="$(runtime_snapshot)"');
assert.ok(preSnapshotAt > 0 && preSnapshotAt < firstMutationPhaseAt,
  "exact runtime snapshot must precede the mutation phase");
assert.ok(firstMutationPhaseAt < driftGateAt && driftGateAt < idempotentPhaseAt,
  "deployment drift must stop follow-up publication before idempotent reconciliation");
assert.ok(idempotentPhaseAt < finalSnapshotAt,
  "final target revalidation must follow idempotent reconciliation");

const steps = ["01_PLAN", "02_DATA", "03_VERIFY", "04_APPROVE"];
const rows = steps.map((suffix, index) => {
  const designHash = (index + 1).toString(16).repeat(64);
  return {
    payload: { contractId: 216005 + index, contractStatus: "VERIFIED", businessPurpose: `purpose-${index}` },
    expected: {
      processCode: "MEMBER_LIFECYCLE",
      stepCode: `MEMBER_LIFECYCLE_${suffix}`,
      audience: "USER",
      routePath: "/work/execution",
      designHash,
      catalogHash: null,
    },
  };
});

function extractDbSourceGate(shellSource) {
  const match = shellSource.match(/jq -e '\n(  length==4[\s\S]*?)\n' "\$input_file" >\/dev\/null \|\| \{/);
  assert.ok(match, "current-DB jq source gate is missing");
  return match[1];
}

function executeDbSourceGate(shellSource, fixture) {
  const result = spawnSync("jq", ["-e", extractDbSourceGate(shellSource)], {
    input: JSON.stringify(fixture),
    encoding: "utf8",
  });
  assert.notEqual(result.error?.code, "ENOENT", "jq executable is required for the publisher contract test");
  return result;
}

const validDbGate = executeDbSourceGate(wrapper, rows);
assert.equal(validDbGate.status, 0,
  `the exact four valid DB rows must pass the real jq gate: ${validDbGate.stderr}`);

const dbGateMutants = [
  ["missing target", rows.slice(0, 3)],
  ["contract id order", structuredClone(rows)],
  ["unverified contract", structuredClone(rows)],
  ["wrong audience", structuredClone(rows)],
  ["invalid design hash", structuredClone(rows)],
  ["invalid catalog hash", structuredClone(rows)],
];
dbGateMutants[1][1][0].payload.contractId = 216008;
dbGateMutants[2][1][0].payload.contractStatus = "DRAFT";
dbGateMutants[3][1][0].expected.audience = "ADMIN";
dbGateMutants[4][1][0].expected.designHash = "not-a-sha256";
dbGateMutants[5][1][0].expected.catalogHash = "not-a-sha256";
for (const [name, mutant] of dbGateMutants) {
  const result = executeDbSourceGate(wrapper, mutant);
  assert.notEqual(result.status, 0, `${name} mutant passed the real jq gate`);
}

for (const [name, sourceMutant] of [
  ["payload all-generator regression", wrapper.replace(
    "all(.[]; .payload.contractStatus", "all(.[].payload.contractStatus")],
  ["expected all-generator regression", wrapper.replace(
    "all(.[]; .expected.processCode", "all(.[].expected.processCode")],
]) {
  assert.notEqual(sourceMutant, wrapper, `${name} mutation was not applied`);
  const result = executeDbSourceGate(sourceMutant, rows);
  assert.notEqual(result.status, 0, `${name} survived against four valid rows`);
}
assert.doesNotMatch(wrapper, /all\(\.\[\]\.(?:payload|expected)/,
  "one-argument all must not re-iterate each row object");

function supportFor(row) {
  const card = { assetBindings: [{ type: "route", value: row.expected.routePath }] };
  return {
    schemaVersion: "carbonet.executable-screen-support/v1",
    designHash: row.expected.designHash,
    catalogHash: null,
    help: { title: "help" },
    workGuide: { next: "next" },
    qa: { status: "PASS" },
    designCard: card,
    assetBindings: card.assetBindings,
    lanes: {
      API: [], DATABASE: [], DESIGN_CARD: card, FRONTEND: {}, HELP: { title: "help" },
      QA: { status: "PASS" }, WORK_GUIDE: { next: "next" },
    },
  };
}

function publication(row, phase, predicted) {
  const index = row.payload.contractId - 216005;
  const support = supportFor(row);
  const unchanged = phase === "idempotent";
  return {
    published: predicted ? false : !unchanged,
    reason: unchanged ? "UNCHANGED" : "DESIGN_CHANGED",
    contractId: row.payload.contractId,
    versionId: predicted && !unchanged ? null : 5001 + index,
    versionNo: 1,
    bindingCount: 1,
    contractHash: `${index + 1}`.repeat(32),
    designHash: row.expected.designHash,
    catalogHash: null,
    support,
    buildRequired: false,
    ...(predicted ? {
      predicted: true,
      applied: false,
      wouldPublish: !unchanged,
      publicationMode: "PREDICTED_READ_ONLY",
    } : {}),
  };
}

function responseBody(row, phase, kind, corrupt) {
  if (kind === "resolve") {
    const pub = publication(row, phase, false);
    return {
      source: "DB_VERSIONED_CONTRACT",
      resolvedBy: "ROUTE_PROCESS_STEP_AUDIENCE",
      matchCount: 1,
      screenKey: `MEMBER_${row.payload.contractId}`,
      routePath: "/work/execution",
      versionId: pub.versionId,
      versionNo: pub.versionNo,
      contractHash: pub.contractHash,
      contract: {
        screen: { route: "/work/execution", audience: "USER" },
        process: { processCode: "MEMBER_LIFECYCLE", stepCode: row.expected.stepCode },
        support: pub.support,
      },
    };
  }
  const predicted = kind === "preview";
  const pub = publication(row, phase, predicted);
  if (corrupt === "support-drift" && kind === "publish" && row.payload.contractId === 216005) {
    pub.support = structuredClone(pub.support);
    pub.support.qa.status = "DRIFT";
  }
  if (corrupt === "idempotent-reason" && kind === "preview" && row.payload.contractId === 216005) {
    pub.reason = "DESIGN_CHANGED";
    pub.wouldPublish = true;
    pub.versionId = null;
  }
  return {
    success: true,
    contract: {
      contractId: row.payload.contractId,
      readinessScore: corrupt === "readiness" && row.payload.contractId === 216005 ? 99 : 100,
      readinessGaps: corrupt === "readiness" && row.payload.contractId === 216005 ? "gap" : "",
    },
    designGate: { status: "PASSED", score: 100, issues: "" },
    runtimePublication: pub,
    autoImplementation: { buildRequired: false, fullGenerationDeferred: true },
    ...(predicted ? { preview: true, rolledBack: true, committed: false, mutationScope: "READ_ONLY_PREDICTION" } : {}),
  };
}

function fakeRuntime(phase, corrupt = "") {
  const calls = [];
  return {
    calls,
    fetch: async (url, options = {}) => {
      const parsed = new URL(url);
      let kind;
      let row;
      if (parsed.pathname.endsWith("/preview")) {
        kind = "preview";
        row = rows.find((candidate) => candidate.payload.contractId === JSON.parse(options.body).contractId);
      } else if (parsed.pathname.endsWith("/professional-screen-contracts")) {
        kind = "publish";
        row = rows.find((candidate) => candidate.payload.contractId === JSON.parse(options.body).contractId);
      } else {
        kind = "resolve";
        row = rows.find((candidate) => candidate.expected.stepCode === parsed.searchParams.get("stepCode"));
      }
      assert.ok(row, `mock target missing for ${url}`);
      calls.push({ kind, contractId: row.payload.contractId });
      return new Response(JSON.stringify(responseBody(row, phase, kind, corrupt)), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    },
  };
}

for (const phase of ["initial", "idempotent"]) {
  const fake = fakeRuntime(phase);
  const result = await publishMemberLifecycleContracts({
    rows: structuredClone(rows), baseUrl: "https://runtime.test", cookie: "SESSION=test",
    phase, fetchImpl: fake.fetch,
  });
  assert.equal(result.previewCount, 4);
  assert.equal(result.publishCount, 4);
  assert.equal(result.resolverCount, 4);
  assert.deepEqual(fake.calls.slice(0, 4).map((item) => item.kind), ["preview", "preview", "preview", "preview"]);
  assert.equal(fake.calls.findIndex((item) => item.kind === "publish"), 4);
  if (phase === "idempotent") assert.ok(result.contracts.every((item) => item.predictionReason === "UNCHANGED"));
}

for (const scenario of [
  { phase: "initial", corrupt: "readiness", pattern: /readiness is not 100/ },
  { phase: "initial", corrupt: "support-drift", pattern: /support changed between preview and publish/ },
  { phase: "idempotent", corrupt: "idempotent-reason", pattern: /did not predict UNCHANGED/ },
]) {
  const fake = fakeRuntime(scenario.phase, scenario.corrupt);
  await assert.rejects(() => publishMemberLifecycleContracts({
    rows: structuredClone(rows), baseUrl: "https://runtime.test", cookie: "SESSION=test",
    phase: scenario.phase, fetchImpl: fake.fetch,
  }), scenario.pattern);
  if (scenario.corrupt === "readiness" || scenario.corrupt === "idempotent-reason") {
    assert.equal(fake.calls.filter((item) => item.kind === "publish").length, 0,
      "a failed preview must prevent every mutation");
  }
}

process.stdout.write("MEMBER_LIFECYCLE_SCREEN_CONTRACT_PUBLISHER_PASS happyPhases=2 targets=4 previewBeforeMutation=4/4 resolver=4/4 negativeCases=3 dbJqValid=4 dbJqDataMutants=6 dbJqSourceMutants=2 runtimeSnapshotPoisonedStdin=PASS runtimeSnapshotMissingNMutant=CAUGHT passwordOutput=0\n");
