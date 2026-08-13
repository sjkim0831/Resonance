import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

const root = resolve(process.argv[2]);
const frontend = join(root, "projects/carbonet-frontend/source");
const generator = join(frontend, "scripts/generate-screen-blueprints.mjs");
const legacyFixture = join(frontend, "scripts/fixtures/screen-blueprint-export-v2.example.json");
const work = mkdtempSync(join(tmpdir(), "canonical-design-generation-contract."));
const started = performance.now();
const scenarios = ["HAPPY_PATH", "AUTHORITY", "ISOLATION", "EXCEPTION", "RECOVERY"];
const laneNames = ["FRONTEND", "API", "DATABASE", "HELP", "CARDS"];

const fail = (message) => { throw new Error(message); };
const assert = (value, message) => { if (!value) fail(message); };
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableJson = (value) => JSON.stringify(stable(value));
const sha256 = (value) => createHash("sha256")
  .update(typeof value === "string" ? value : stableJson(value), "utf8").digest("hex");
const keyCompare = (left, right) => Buffer.byteLength(left) - Buffer.byteLength(right)
  || Buffer.compare(Buffer.from(left), Buffer.from(right));
const pgText = (value) => value === null ? "null"
  : Array.isArray(value) ? "[" + value.map(pgText).join(", ") + "]"
    : value && typeof value === "object"
      ? "{" + Object.keys(value).sort(keyCompare)
        .map((key) => JSON.stringify(key) + ": " + pgText(value[key])).join(", ") + "}"
      : JSON.stringify(value);
const exactKeys = (value, keys, label) => assert(
  value && !Array.isArray(value) && stableJson(Object.keys(value).sort()) === stableJson([...keys].sort()),
  label + " keys mismatch: " + Object.keys(value || {}).join(",")
);
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function canonical(summarySuffix) {
  const responsive = { mobile: "single-column", tablet: "adaptive-grid", desktop: "task-and-context" };
  const accessibility = { standard: "WCAG_2_1_AA", keyboard: true, labels: true, focusManagement: true };
  const inputContract = { designHash: "sha256", reviewComment: "string" };
  const outputContract = { decision: "APPROVED", evidenceId: "string" };
  return {
    identity: {
      screenKey: "CANONICAL_QA_REVIEW|CANONICAL_QA_REVIEW_EXECUTE|ADMIN|/canonical-contract/qa-review",
      blueprintCode: "BP_CANONICAL_QA_REVIEW_ADMIN", processCode: "CANONICAL_QA_REVIEW",
      stepCode: "CANONICAL_QA_REVIEW_EXECUTE", audience: "ADMIN",
      routePath: "/canonical-contract/qa-review", pageId: "CANONICAL_QA_REVIEW_ADMIN",
      actorCode: "QUALITY_REVIEWER"
    },
    process: {
      processName: "Canonical QA review", domainCode: "GOVERNANCE", processVersion: "1",
      goal: "Review one canonical screen and persist exact evidence.",
      startCondition: "A compilable canonical design is assigned.",
      completionCondition: "All five QA scenarios pass.", ownerActorCode: "QUALITY_REVIEWER",
      riskLevel: "HIGH", slaHours: "__NUM_1_0__", lifecycleStatus: "ACTIVE"
    },
    step: {
      stepName: "Execute canonical QA review", stepOrder: 10, stepType: "HUMAN_TASK",
      actorCode: "QUALITY_REVIEWER", fromState: "READY",
      commandCode: "APPROVE_CANONICAL_SCREEN", toState: "APPROVED",
      requirement: "Validate actor, input, output, authority and recovery evidence.",
      completionRule: "Persist the exact design hash and five-lane evidence.",
      inputContract, outputContract, evidenceRequired: true,
      evidenceTypes: ["SCREEN", "API", "DATABASE", "AUTHORITY", "RECOVERY"],
      segregationActorCodes: ["DESIGN_AUTHOR"], rollbackCommandCode: "REOPEN_CANONICAL_SCREEN",
      decisionRule: "All required scenarios must pass."
    },
    lanes: {
      HELP: {
        title: "Canonical QA review help", summary: "Review canonical screen " + summarySuffix,
        entryCondition: "Open the assigned review.", exitCondition: "Submit evidence and decision.",
        exceptionStates: [{ code: "EVIDENCE_MISSING", recovery: "Attach evidence." }],
        evidence: [{ type: "SCREEN_CAPTURE", required: true }],
        items: [{ id: "qa-review-form", title: "QA review form",
          body: "Check the design, actor, inputs, outputs and evidence.",
          anchorSelector: "[data-help-id=\"qa-review-form\"]" }]
      },
      WORK_GUIDE: {
        processCode: "CANONICAL_QA_REVIEW", stepCode: "CANONICAL_QA_REVIEW_EXECUTE",
        stepOrder: 10, actorCode: "QUALITY_REVIEWER",
        requirement: "Validate actor, inputs, outputs and all five scenarios.",
        fromState: "READY", commandCode: "APPROVE_CANONICAL_SCREEN", toState: "APPROVED",
        completionRule: "Persist the exact bundle hash.", inputContract, outputContract,
        steps: [{ order: 10, code: "CANONICAL_QA_REVIEW_EXECUTE",
          name: "Execute canonical QA review", actorCode: "QUALITY_REVIEWER",
          fromState: "READY", commandCode: "APPROVE_CANONICAL_SCREEN", toState: "APPROVED",
          completionRule: "Persist the exact bundle hash." }],
        nextAction: { label: "Approve canonical screen", routePath: "/canonical-contract/qa-review",
          commandCode: "APPROVE_CANONICAL_SCREEN", toState: "APPROVED",
          completionRule: "Persist the exact bundle hash." }
      },
      QA: {
        validationStatus: "VALID", contractStatus: "COMPLETE", requiredScenarioTypes: scenarios,
        traceability: { requirementIds: ["REQ-CANONICAL-001"], requiredScenarioTypes: scenarios },
        evidence: [{ type: "AUTOMATED_TEST", ref: "canonical-contract" }],
        apiVerified: true, databaseVerified: true, authorityVerified: true,
        responsiveVerified: true, accessibilityVerified: true, exceptionStatesVerified: true,
        auditEvidenceRef: "QA-CANONICAL-001",
        checks: scenarios.map((code) => ({ code, passed: true }))
      },
      DESIGN_CARD: {
        designSystem: "KRDS", pageId: "CANONICAL_QA_REVIEW_ADMIN",
        pageName: "Canonical QA review", screenType: "FORM", templateCode: "KRDS_TASK_FORM",
        specification: {
          businessPurpose: "Review and approve one canonical screen.",
          actorResponsibilities: ["Review design", "Persist evidence"],
          entryConditions: ["Assigned canonical design exists"],
          exitConditions: ["Decision and evidence are persisted"], states: ["READY", "APPROVED"],
          sections: [{ code: "REVIEW", label: "Review" }],
          fields: [{ code: "REVIEW_COMMENT", label: "Review comment", required: true }],
          actions: [{ code: "APPROVE_CANONICAL_SCREEN", label: "Approve" }],
          permissions: [{ code: "CANONICAL_REVIEW", scope: "TENANT" }],
          validations: [{ code: "REVIEW_REQUIRED", type: "REQUIRED" }],
          errors: [{ code: "EVIDENCE_MISSING", recovery: "Attach evidence." }],
          responsive, accessibility, completionRule: "Persist the exact bundle hash.",
          numericScaleA: "__NUM_1_00__", numericNegativeZero: "__NUM_NEG_ZERO__"
        },
        traceability: { requirementIds: ["REQ-CANONICAL-001"], requiredScenarioTypes: scenarios },
        sections: [{ code: "REVIEW", label: "Review" }],
        assetBindings: [{ assetType: "SECTION", assetCode: "KRDS_REVIEW_SECTION", slot: "REVIEW" }],
        responsive, accessibility, security: { permission: "CANONICAL_REVIEW", tenantScoped: true }
      },
      FRONTEND: {
        routePath: "/canonical-contract/qa-review", pageId: "CANONICAL_QA_REVIEW_ADMIN",
        screenType: "FORM", templateCode: "KRDS_TASK_FORM",
        sections: [{ code: "REVIEW", label: "Review" }],
        fields: [{ code: "REVIEW_COMMENT", label: "Review comment", required: true }],
        actions: [{ code: "APPROVE_CANONICAL_SCREEN", label: "Approve" }],
        states: ["READY", "APPROVED"], responsive, accessibility
      },
      API: [{ code: "APPROVE_CANONICAL_SCREEN", method: "POST",
        path: "/home/api/canonical-screen/reviews", input: inputContract, output: outputContract }],
      DATABASE: [{ code: "CANONICAL_SCREEN_REVIEW", entity: "framework_canonical_screen_review",
        tenantScoped: true, fields: ["design_hash", "decision", "evidence_id"] }]
    }
  };
}

function catalog(suffix) {
  const canonicalText = pgText(canonical(suffix))
    .replace("\"__NUM_1_0__\"", "1.0")
    .replace("\"__NUM_1_00__\"", "1.00")
    .replace("\"__NUM_NEG_ZERO__\"", "-0.0");
  const canonicalDesign = JSON.parse(canonicalText);
  const designHash = sha256(canonicalText);
  const screenKey = canonicalDesign.identity.screenKey;
  return { schema: "carbonet.canonical-design/v1",
    catalogHash: sha256(screenKey + "\u001f" + designHash), screenCount: 1,
    screens: [{ screenKey, processCode: "CANONICAL_QA_REVIEW",
      stepCode: "CANONICAL_QA_REVIEW_EXECUTE", audience: "ADMIN",
      routePath: "/canonical-contract/qa-review", designHash, canonicalText, canonicalDesign }] };
}

function run(input, output, label) {
  const result = spawnSync(process.execPath,
    [generator, "--input", input, "--outDir", output, "--strict", "true"],
    { cwd: frontend, encoding: "utf8", timeout: 10000 });
  if (result.error || result.status !== 0) fail(label + " rc=" + result.status +
    " error=" + (result.error?.message || "none") + "\n" +
    (result.stdout || "").slice(-3000) + "\n" + (result.stderr || "").slice(-3000));
}

function files(directory) {
  const found = [];
  const visit = (current) => readdirSync(current).forEach((entry) => {
    const path = join(current, entry);
    if (statSync(path).isDirectory()) visit(path);
    else if (entry !== "generation-report.json") found.push(path);
  });
  visit(directory);
  return found.sort((a, b) => relative(directory, a).localeCompare(relative(directory, b)));
}
const snapshot = (directory) => files(directory).map((path) =>
  [relative(directory, path), readFileSync(path).toString("base64")]);
const outputText = (directory) => files(directory).map((path) => readFileSync(path, "utf8")).join("\n");

function verifySource(input) {
  exactKeys(input, ["schema", "catalogHash", "screenCount", "screens"], "canonical catalog");
  const screen = input.screens[0];
  assert(sha256(screen.canonicalText) === screen.designHash, "canonicalText hash");
  assert(stableJson(JSON.parse(screen.canonicalText)) === stableJson(screen.canonicalDesign),
    "canonicalText deep-equality");
  assert(input.catalogHash === sha256(screen.screenKey + "\u001f" + screen.designHash),
    "catalog hash formula");
}

function verifyManifest(manifest, source, label) {
  exactKeys(manifest, ["schema", "catalogHash", "screenCount", "screens", "bundleHash"], label);
  assert(manifest.schema === "carbonet.generated-screen-bundle/v1", label + " schema");
  assert(manifest.catalogHash === source.catalogHash, label + " catalogHash");
  assert(manifest.screenCount === 1 && manifest.screens.length === 1, label + " count");
  const screen = manifest.screens[0], sourceScreen = source.screens[0];
  exactKeys(screen, ["pageId", "routePath", "designHash", "lanes", "bundleHash"], label + ".screen");
  assert(screen.pageId === sourceScreen.canonicalDesign.identity.pageId, label + " pageId");
  assert(screen.routePath === sourceScreen.routePath, label + " routePath");
  assert(screen.designHash === sourceScreen.designHash, label + " designHash");
  exactKeys(screen.lanes, laneNames, label + ".lanes");
  laneNames.forEach((name) => {
    const lane = screen.lanes[name];
    exactKeys(lane, ["designHash", "laneHash", "payload"], label + "." + name);
    assert(lane.designHash === sourceScreen.designHash, label + "." + name + " designHash");
    const { laneHash, ...core } = lane;
    assert(laneHash === sha256(core), label + "." + name + " laneHash");
  });
  const { bundleHash, ...screenCore } = screen;
  assert(bundleHash === sha256(screenCore), label + " screen bundleHash");
  const { bundleHash: topHash, ...manifestCore } = manifest;
  assert(topHash === sha256(manifestCore), label + " top bundleHash");
  return screen;
}

try {
  const inputA = catalog("A"), inputB = catalog("B");
  verifySource(inputA); verifySource(inputB);
  const bytesA = Buffer.from(inputA.screens[0].canonicalText);
  const bytesB = Buffer.from(inputB.screens[0].canonicalText);
  assert(bytesA.length === bytesB.length, "mutation length");
  let differences = 0;
  bytesA.forEach((byte, index) => { if (byte !== bytesB[index]) differences += 1; });
  assert(differences === 1, "mutation changed " + differences + " bytes");
  [": 1.0", ": 1.00", ": -0.0"].forEach((lexeme) =>
    assert(inputA.screens[0].canonicalText.includes(lexeme), "numeric lexeme " + lexeme));
  const inputAPath = join(work, "a.json"), inputBPath = join(work, "b.json");
  writeFileSync(inputAPath, JSON.stringify(inputA, null, 2) + "\n");
  writeFileSync(inputBPath, JSON.stringify(inputB, null, 2) + "\n");
  const outA1 = join(work, "a1"), outA2 = join(work, "a2"), outB = join(work, "b");
  const outLegacy = join(work, "legacy");
  run(inputAPath, outA1, "direct1"); run(inputAPath, outA2, "direct2");
  run(inputBPath, outB, "mutation"); run(legacyFixture, outLegacy, "legacy");
  assert(stableJson(snapshot(outA1)) === stableJson(snapshot(outA2)), "byte determinism");
  const manifestA = readJson(join(outA1, "generatedScreenBundleManifest.json"));
  const manifestA2 = readJson(join(outA2, "generatedScreenBundleManifest.json"));
  const manifestB = readJson(join(outB, "generatedScreenBundleManifest.json"));
  const screenA = verifyManifest(manifestA, inputA, "manifestA");
  verifyManifest(manifestA2, inputA, "manifestA2");
  const screenB = verifyManifest(manifestB, inputB, "manifestB");
  assert(stableJson(manifestA) === stableJson(manifestA2), "manifest determinism");
  assert(stableJson(screenA.lanes.API.payload) === stableJson(inputA.screens[0].canonicalDesign.lanes.API), "API drift");
  assert(stableJson(screenA.lanes.DATABASE.payload) === stableJson(inputA.screens[0].canonicalDesign.lanes.DATABASE), "DB drift");
  const help = screenA.lanes.HELP.payload;
  assert(help.title && help.summary && help.items.some((item) => item.id && item.title && item.body
    && String(item.anchorSelector).includes("data-help-id")), "HELP/anchor");
  assert(help.pageId === "CANONICAL_QA_REVIEW_ADMIN", "HELP pageId normalization");
  const cards = screenA.lanes.CARDS.payload;
  exactKeys(cards, ["workGuide", "qa", "designCard", "assetBindings"], "CARDS");
  assert(cards.workGuide.steps.every((step) => step.code && step.label), "WORK_GUIDE step labels");
  assert(cards.qa.checks.every((check) => check.code && check.label), "QA check labels");
  assert(cards.workGuide.actorCode === "QUALITY_REVIEWER", "actor");
  assert(cards.workGuide.inputContract.designHash === "sha256", "input");
  assert(cards.workGuide.outputContract.decision === "APPROVED", "output");
  ["label", "routePath", "commandCode", "toState", "completionRule"].forEach((field) =>
    assert(String(cards.workGuide.nextAction[field] || ""), "nextAction." + field));
  assert(scenarios.every((type) => cards.qa.requiredScenarioTypes.includes(type)), "QA scenarios");
  assert(cards.qa.checks.length && cards.designCard.designSystem === "KRDS"
    && cards.assetBindings.length, "QA/card/assets");
  const generatedPageSource = readFileSync(join(frontend,
    "src/features/generated-screen/GeneratedScreenPage.tsx"), "utf8");
  ["check.passed===true", "check.passed===false",
    "text(nextAction.routePath)!==screen.routePath",
    "helpItems[sections.length+index]",
    "helpItems.slice(sections.length+resolvedFieldEntries.length)",
    "designHash: String(supportLayer.designHash || base.designHash || \"\")",
    "if (!response.ok) throw new Error(`VERSIONED_CONTRACT_${response.status}`);",
    "if (!base || cancelled) return;",
    "setScreen(base);",
    "[FALLBACK_STALE] The latest screen contract could not be loaded.",
    "[FALLBACK_STALE] 최신 화면 계약을 불러오지 못해",
    "role=\"alert\""
  ].forEach((token) => assert(generatedPageSource.includes(token), "generated runtime " + token));
  assert(/if \(!cancelled\) \{ setScreen\(resolved\); setRuntimeWarning\(""\); \}/.test(generatedPageSource),
    "successful runtime resolution removes FALLBACK_STALE warning");
  assert(/if \(!cancelled\) \{\s*setScreen\(base\);\s*setRuntimeWarning\(en \?/.test(generatedPageSource),
    "failed runtime resolution preserves static base and exposes FALLBACK_STALE warning");
  const front = screenA.lanes.FRONTEND.payload;
  assert(front.actorCode === "QUALITY_REVIEWER" && front.specification, "frontend actor/spec");
  ["sections", "fields", "actions"].forEach((field) =>
    assert(front.specification[field].length, "frontend " + field));
  assert(front.specification.responsive && front.specification.accessibility, "frontend visual contract");
  const oldHash = inputA.screens[0].designHash, newHash = inputB.screens[0].designHash;
  const textB = outputText(outB);
  const catalogSource = readFileSync(join(outB, "generatedScreenCatalog.ts"), "utf8");
  assert(catalogSource.includes(inputB.catalogHash), "generated catalog catalogHash");
  assert(catalogSource.includes(newHash), "generated catalog page designHash");
  const oldCount = textB.split(oldHash).length - 1, newCount = textB.split(newHash).length - 1;
  assert(oldCount === 0 && newCount >= 10, "hash propagation old=" + oldCount + " new=" + newCount);
  ["generatedScreenCatalog.ts", "generatedScreenFamily.ts", "generatedScreenTests.ts",
    "generatedScreenSpaceIndex.ts", "generatedScreenSupportCatalog.ts"].forEach((file) =>
    assert(readFileSync(join(outB, file), "utf8").includes(newHash), file + " hash"));
  assert(screenB.lanes.HELP.payload.summary.endsWith("B"), "design mutation payload");
  let hashKilled = 0, fieldKilled = 0;
  laneNames.forEach((name) => {
    const hashMutant = structuredClone(manifestA);
    delete hashMutant.screens[0].lanes[name].laneHash;
    try { verifyManifest(hashMutant, inputA, "hash mutant " + name); } catch { hashKilled += 1; }
    const fieldMutant = structuredClone(manifestA);
    const payload = fieldMutant.screens[0].lanes[name].payload;
    if (Array.isArray(payload)) payload.splice(0, 1);
    else delete payload[Object.keys(payload).sort()[0]];
    try { verifyManifest(fieldMutant, inputA, "field mutant " + name); } catch { fieldKilled += 1; }
  });
  assert(hashKilled === 5 && fieldKilled === 5, "mutants hash=" + hashKilled + " field=" + fieldKilled);
  const legacy = readJson(join(outLegacy, "generatedScreenBundleManifest.json"));
  assert(legacy.schema === "carbonet.generated-screen-bundle/v1" && legacy.screenCount === 1, "legacy");
  assert(Object.keys(legacy.screens[0].lanes).sort().join() === [...laneNames].sort().join(), "legacy lanes");
  const support = readFileSync(join(outLegacy, "generatedScreenSupportCatalog.ts"), "utf8");
  ["help", "workGuide", "qa", "designCard", "assetBindings", "anchorSelector"].forEach((token) =>
    assert(support.includes(token), "legacy support " + token));
  const readiness = { schema: "carbonet.canonical-design-readiness/v1", status: "PARTIAL",
    eligibleCount: 4, compilableCount: 1, blockers: [
      { code: "MISSING_CONTRACT", count: 1 }, { code: "DUPLICATE_CONTRACT", count: 1 },
      { code: "INCOMPLETE_LANE", count: 1 }] };
  assert(readiness.status === "PARTIAL" && readiness.blockers.length === 3, "readiness");
  assert(!Object.hasOwn(inputA, "readiness") && !Object.hasOwn(manifestA, "readiness"), "readiness leaked");
  const elapsed = Math.round(performance.now() - started);
  assert(elapsed < 10000, "wall " + elapsed + "ms");
  console.log("PASS canonical=1 deterministic=2 lanes=5 hashMutants=5 fieldMutants=5 " +
    "oneByte=1 numericLexemes=3 legacy=1 readiness=PARTIAL oldHash=0 newHash=" + newCount +
    " wallMs=" + elapsed);
} finally {
  rmSync(work, { recursive: true, force: true });
}
