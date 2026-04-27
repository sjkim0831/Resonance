import fs from "node:fs";
import path from "node:path";

const frontendRoot = process.cwd();
const repoRoot = path.resolve(frontendRoot, "..");
const resonanceRoot = path.resolve(frontendRoot, "../../..");
const outputPath = path.join(frontendRoot, "src", "generated", "verificationCenterInventory.json");
const dynamicMenuCodePageIds = new Set(["repair-workbench"]);

function firstExistingPath(paths) {
  return paths.find((candidate) => fs.existsSync(candidate)) || paths[0];
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listFilesRelative(baseDir, filter) {
  if (!fs.existsSync(baseDir)) {
    return [];
  }
  const results = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const resolved = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(resolved);
        continue;
      }
      if (filter(resolved)) {
        results.push(path.relative(repoRoot, resolved).replaceAll(path.sep, "/"));
      }
    }
  }

  walk(baseDir);
  return results.sort((left, right) => left.localeCompare(right));
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    return [];
  }
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const columns = splitCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = columns[index] || "";
      return row;
    }, {});
  });
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

const riskRules = [
  {
    tag: "PAYMENT",
    mode: "any",
    keywords: ["payment", "billing", "settlement", "order"],
    requiredProfiles: ["PAYMENT_SANDBOX_OPERATOR", "MASKED_PAYMENT_FIXTURE"]
  },
  {
    tag: "REFUND",
    mode: "any",
    keywords: ["refund"],
    requiredProfiles: ["REFUND_REVIEWER_SANDBOX", "MASKED_REFUND_FIXTURE"]
  },
  {
    tag: "VIRTUAL_ACCOUNT",
    mode: "any",
    keywords: ["virtual_issue", "virtual-account", "virtual_account", "/payment/virtual", "payment-virtual"],
    requiredProfiles: ["VIRTUAL_ACCOUNT_SANDBOX", "FAKE_ACCOUNT_LEDGER_PACK"]
  },
  {
    tag: "EXTERNAL_AUTH",
    mode: "any",
    keywords: ["external auth", "external_auth", "/auth/external", "kisa", "identify", "verify/validate", "joint certificate", "financial certificate"],
    requiredProfiles: ["EXTERNAL_AUTH_SANDBOX", "MASKED_IDENTITY_FIXTURE"]
  },
  {
    tag: "CERTIFICATE",
    mode: "any",
    keywords: ["certificate", "cert"],
    requiredProfiles: ["CERTIFICATE_QA_OPERATOR", "MASKED_CERTIFICATE_PACK"]
  },
  {
    tag: "KEY_TOKEN",
    mode: "any",
    keywords: ["token", "key", "secret", "oauth"],
    requiredProfiles: ["TOKEN_ROTATION_SANDBOX", "EXPIRY_MONITORING_RULE"]
  }
];

const governedTestProfiles = [
  {
    profileId: "PAYMENT_SANDBOX_OPERATOR",
    type: "ACCOUNT",
    title: "Payment sandbox operator",
    appliesTo: ["PAYMENT", "REFUND"],
    requiresExpiryTracking: true,
    notes: "Use sandbox gateway only. Real card or bank targets are prohibited."
  },
  {
    profileId: "REFUND_REVIEWER_SANDBOX",
    type: "ACCOUNT",
    title: "Refund reviewer sandbox",
    appliesTo: ["REFUND", "VIRTUAL_ACCOUNT"],
    requiresExpiryTracking: true,
    notes: "Use masked refund targets and reset the queue state after execution."
  },
  {
    profileId: "VIRTUAL_ACCOUNT_SANDBOX",
    type: "ACCOUNT",
    title: "Virtual account sandbox",
    appliesTo: ["PAYMENT", "VIRTUAL_ACCOUNT"],
    requiresExpiryTracking: true,
    notes: "Use fake virtual account numbers and a disposable account ledger pack."
  },
  {
    profileId: "EXTERNAL_AUTH_SANDBOX",
    type: "ACCOUNT",
    title: "External auth sandbox",
    appliesTo: ["EXTERNAL_AUTH", "KEY_TOKEN"],
    requiresExpiryTracking: true,
    notes: "Keep token expiration, reissue window, and callback endpoint separate from production."
  },
  {
    profileId: "CERTIFICATE_QA_OPERATOR",
    type: "ACCOUNT",
    title: "Certificate QA operator",
    appliesTo: ["CERTIFICATE"],
    requiresExpiryTracking: true,
    notes: "Use masked certificate identities and non-production issuance flows."
  },
  {
    profileId: "MASKED_PAYMENT_FIXTURE",
    type: "DATASET",
    title: "Masked payment fixture",
    appliesTo: ["PAYMENT"],
    requiresExpiryTracking: false,
    notes: "Contains fake payer, amount, and gateway callback combinations."
  },
  {
    profileId: "MASKED_REFUND_FIXTURE",
    type: "DATASET",
    title: "Masked refund fixture",
    appliesTo: ["REFUND"],
    requiresExpiryTracking: false,
    notes: "Contains refund state transitions without real settlement targets."
  },
  {
    profileId: "FAKE_ACCOUNT_LEDGER_PACK",
    type: "DATASET",
    title: "Fake account ledger pack",
    appliesTo: ["VIRTUAL_ACCOUNT"],
    requiresExpiryTracking: false,
    notes: "Contains disposable ledger entries and callback payloads for virtual account flows."
  },
  {
    profileId: "MASKED_IDENTITY_FIXTURE",
    type: "DATASET",
    title: "Masked identity fixture",
    appliesTo: ["EXTERNAL_AUTH", "CERTIFICATE"],
    requiresExpiryTracking: false,
    notes: "Contains masked identity assertions and browser callback payloads."
  },
  {
    profileId: "MASKED_CERTIFICATE_PACK",
    type: "DATASET",
    title: "Masked certificate pack",
    appliesTo: ["CERTIFICATE"],
    requiresExpiryTracking: false,
    notes: "Contains fake certificate review, issuance, and audit scenarios."
  },
  {
    profileId: "TOKEN_ROTATION_SANDBOX",
    type: "ACCOUNT",
    title: "Token rotation sandbox",
    appliesTo: ["KEY_TOKEN", "EXTERNAL_AUTH"],
    requiresExpiryTracking: true,
    notes: "Track expiresAt, reset history, and reissue ownership for reusable credentials."
  },
  {
    profileId: "EXPIRY_MONITORING_RULE",
    type: "POLICY",
    title: "Expiry monitoring rule",
    appliesTo: ["KEY_TOKEN", "EXTERNAL_AUTH", "PAYMENT", "REFUND", "VIRTUAL_ACCOUNT", "CERTIFICATE"],
    requiresExpiryTracking: true,
    notes: "Verification must fail closed when only expired or production-bound credentials remain."
  }
];

const baselineRegistry = [
  {
    pageId: "environment-management",
    routePath: "/admin/system/environment-management",
    baselineId: "BL-ENV-2026-04-14",
    snapshotPath: "var/baselines/environment-management/2026-04-14",
    owner: "PLATFORM_ADMIN",
    lastVerifiedAt: "2026-04-14T09:10:00+09:00",
    stale: false,
    requiredScenarioIds: ["ROUTE_HEAD", "SCREEN_COMMAND_METADATA", "PRIMARY_ACTION_BAR"]
  },
  {
    pageId: "asset-inventory",
    routePath: "/admin/system/asset-inventory",
    baselineId: "BL-AINV-2026-04-14",
    snapshotPath: "var/baselines/asset-inventory/2026-04-14",
    owner: "PLATFORM_ADMIN",
    lastVerifiedAt: "2026-04-14T09:18:00+09:00",
    stale: false,
    requiredScenarioIds: ["ROUTE_HEAD", "SUMMARY_COUNT", "DETAIL_LINKS"]
  },
  {
    pageId: "asset-impact",
    routePath: "/admin/system/asset-impact",
    baselineId: "BL-AIMP-2026-04-13",
    snapshotPath: "var/baselines/asset-impact/2026-04-13",
    owner: "PLATFORM_ADMIN",
    lastVerifiedAt: "2026-04-13T19:05:00+09:00",
    stale: true,
    requiredScenarioIds: ["ROUTE_HEAD", "MODE_SWITCH", "LINKED_CONSOLES"]
  },
  {
    pageId: "verification-center",
    routePath: "/admin/system/verification-center",
    baselineId: "BL-VC-2026-04-14",
    snapshotPath: "var/baselines/verification-center/2026-04-14",
    owner: "OPS_AUDIT",
    lastVerifiedAt: "2026-04-14T09:25:00+09:00",
    stale: false,
    requiredScenarioIds: ["ROUTE_HEAD", "FULL_LISTS", "RISK_SCOPE"]
  }
];

const verificationRuns = [
  {
    runId: "VR-2026-04-15-001",
    runType: "DAILY_SWEEP",
    targetScope: "system-governed-pages",
    baselineId: "BL-ENV-2026-04-14",
    result: "WARN",
    startedAt: "2026-04-15T06:00:00+09:00",
    finishedAt: "2026-04-15T06:12:00+09:00",
    traceId: "trace-verification-daily-001",
    profileId: "EXPIRY_MONITORING_RULE",
    datasetId: "MASKED_PAYMENT_FIXTURE",
    failureCount: 2,
    driftCount: 1,
    followupPath: "/admin/system/current-runtime-compare"
  },
  {
    runId: "VR-2026-04-14-POST-DEPLOY",
    runType: "POST_DEPLOY_SMOKE",
    targetScope: "asset-inventory,asset-detail,asset-impact",
    baselineId: "BL-AINV-2026-04-14",
    result: "PASS",
    startedAt: "2026-04-14T22:11:00+09:00",
    finishedAt: "2026-04-14T22:16:00+09:00",
    traceId: "trace-verification-postdeploy-014",
    profileId: "PLATFORM_ADMIN_SANDBOX",
    datasetId: "SYSTEM_ASSET_SEED_PACK",
    failureCount: 0,
    driftCount: 0,
    followupPath: "/admin/system/verification-center"
  },
  {
    runId: "VR-2026-04-14-EXPIRY",
    runType: "WEEKLY_PROFILE_AUDIT",
    targetScope: "sandbox-accounts-and-datasets",
    baselineId: "BL-VC-2026-04-14",
    result: "TODO",
    startedAt: "2026-04-14T07:30:00+09:00",
    finishedAt: "2026-04-14T07:37:00+09:00",
    traceId: "trace-verification-expiry-002",
    profileId: "TOKEN_ROTATION_SANDBOX",
    datasetId: "MASKED_IDENTITY_FIXTURE",
    failureCount: 0,
    driftCount: 3,
    followupPath: "/admin/system/security-policy"
  }
];

const managedVault = {
  accounts: [
    {
      profileId: "PLATFORM_ADMIN_SANDBOX",
      role: "SYSTEM_ADMIN",
      status: "READY",
      expiresAt: "2026-05-15T00:00:00+09:00",
      resetOwner: "ops-admin",
      allowedRoutes: ["/admin/system/environment-management", "/admin/system/asset-inventory"]
    },
    {
      profileId: "TOKEN_ROTATION_SANDBOX",
      role: "INTEGRATION_SANDBOX",
      status: "EXPIRING_SOON",
      expiresAt: "2026-04-20T00:00:00+09:00",
      resetOwner: "external-auth-ops",
      allowedRoutes: ["/admin/external/keys", "/admin/system/verification-center"]
    },
    {
      profileId: "PAYMENT_SANDBOX_OPERATOR",
      role: "PAYMENT_QA",
      status: "READY",
      expiresAt: "2026-05-01T00:00:00+09:00",
      resetOwner: "payment-ops",
      allowedRoutes: ["/payment/pay", "/payment/refund"]
    }
  ],
  datasets: [
    {
      datasetId: "SYSTEM_ASSET_SEED_PACK",
      type: "WORKFLOW",
      status: "READY",
      lastRefreshedAt: "2026-04-14T18:00:00+09:00",
      retentionPolicy: "30d",
      maskingPolicy: "FULL_MASK"
    },
    {
      datasetId: "MASKED_IDENTITY_FIXTURE",
      type: "IDENTITY",
      status: "STALE",
      lastRefreshedAt: "2026-03-20T12:00:00+09:00",
      retentionPolicy: "60d",
      maskingPolicy: "PARTIAL_MASK"
    },
    {
      datasetId: "MASKED_PAYMENT_FIXTURE",
      type: "PAYMENT",
      status: "READY",
      lastRefreshedAt: "2026-04-10T10:30:00+09:00",
      retentionPolicy: "30d",
      maskingPolicy: "FULL_MASK"
    }
  ]
};

const actionQueue = [
  {
    actionId: "QA-001",
    severity: "HIGH",
    category: "STALE_BASELINE",
    title: "asset-impact baseline snapshot refresh",
    owner: "platform-admin",
    targetId: "asset-impact",
    recommendedAction: "Recapture baseline and rerun mode-switch smoke"
  },
  {
    actionId: "QA-002",
    severity: "HIGH",
    category: "PROFILE_EXPIRY",
    title: "token rotation sandbox expires within 5 days",
    owner: "external-auth-ops",
    targetId: "TOKEN_ROTATION_SANDBOX",
    recommendedAction: "Reissue credential and record reset evidence"
  },
  {
    actionId: "QA-003",
    severity: "MEDIUM",
    category: "DATASET_DRIFT",
    title: "masked identity fixture refresh overdue",
    owner: "ops-audit",
    targetId: "MASKED_IDENTITY_FIXTURE",
    recommendedAction: "Refresh dataset and rerun external-auth smoke"
  }
];

function gatherRiskTags(values) {
  const haystack = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return riskRules
    .filter((rule) => rule.mode === "all"
      ? rule.keywords.every((keyword) => haystack.includes(keyword))
      : rule.keywords.some((keyword) => haystack.includes(keyword)))
    .map((rule) => rule.tag);
}

function mapRequiredProfiles(tags) {
  return uniqueSorted(
    tags.flatMap((tag) => riskRules
      .filter((rule) => rule.tag === tag)
      .flatMap((rule) => rule.requiredProfiles))
  );
}

function parsePageManifestInventory() {
  const sourcePath = path.join(frontendRoot, "src", "platform", "screen-registry", "pageManifests.ts");
  const source = readText(sourcePath);
  const blockPattern = /"([^"]+)":\s*\{\s*pageId:\s*"([^"]+)",\s*routePath:\s*"([^"]*)",\s*(?:menuCode:\s*"([^"]*)",\s*)?/gms;
  const pages = [];
  let match;
  while ((match = blockPattern.exec(source)) !== null) {
    pages.push({
      manifestKey: match[1],
      pageId: match[2],
      routePath: match[3],
      menuCode: match[4] || "",
      menuBindingType: dynamicMenuCodePageIds.has(match[2]) ? "dynamic" : (match[4] ? "static" : "unbound")
    });
  }
  return pages.sort((left, right) => left.pageId.localeCompare(right.pageId));
}

function parseApiInventory() {
  const sourcePath = firstExistingPath([
    path.join(resonanceRoot, "docs", "ai", "40-backend", "controller-service-map.csv"),
    path.join(repoRoot, "docs", "ai", "40-backend", "controller-service-map.csv"),
  ]);
  const rows = parseCsv(readText(sourcePath));
  return rows.map((row) => ({
    controllerClass: row.controller_class || "",
    routePrefix: row.route_prefix || "",
    action: row.action || "",
    serviceClass: row.service_class || "",
    serviceMethod: row.service_method || ""
  })).sort((left, right) => {
    const leftKey = `${left.routePrefix} ${left.action}`;
    const rightKey = `${right.routePrefix} ${right.action}`;
    return leftKey.localeCompare(rightKey);
  });
}

function parseFunctionInventory() {
  const sourcePath = firstExistingPath([
    path.join(resonanceRoot, "docs", "ai", "20-ui", "event-map.csv"),
    path.join(repoRoot, "docs", "ai", "20-ui", "event-map.csv"),
  ]);
  const rows = parseCsv(readText(sourcePath));
  const functions = [];
  for (const row of rows) {
    const names = String(row.frontend_function || "")
      .split("/")
      .map((value) => value.trim())
      .filter(Boolean);
    for (const name of names) {
      functions.push({
        screenId: row.screen_id || "",
        eventType: row.event_type || "",
        frontendFunction: name,
        apiOrRoute: row.api_or_route || ""
      });
    }
  }
  return functions.sort((left, right) => {
    const leftKey = `${left.frontendFunction} ${left.screenId}`;
    const rightKey = `${right.frontendFunction} ${right.screenId}`;
    return leftKey.localeCompare(rightKey);
  });
}

const pageInventory = parsePageManifestInventory();
const apiInventory = parseApiInventory();
const functionInventory = parseFunctionInventory();
const frontendTests = listFilesRelative(path.join(frontendRoot, "e2e"), (filePath) => filePath.endsWith(".spec.ts"));
const backendTests = listFilesRelative(path.join(repoRoot, "src", "test"), (filePath) => filePath.endsWith(".java"));
const highRiskPages = pageInventory
  .map((item) => {
    const riskTags = gatherRiskTags([item.pageId, item.routePath, item.menuCode]);
    return {
      pageId: item.pageId,
      routePath: item.routePath,
      menuCode: item.menuCode,
      riskTags,
      requiredProfiles: mapRequiredProfiles(riskTags)
    };
  })
  .filter((item) => item.riskTags.length > 0)
  .sort((left, right) => left.pageId.localeCompare(right.pageId));
const highRiskApis = apiInventory
  .map((item) => {
    const riskTags = gatherRiskTags([item.routePrefix, item.action, item.controllerClass, item.serviceMethod]);
    return {
      routePrefix: item.routePrefix,
      action: item.action,
      controllerClass: item.controllerClass,
      serviceMethod: item.serviceMethod,
      riskTags,
      requiredProfiles: mapRequiredProfiles(riskTags)
    };
  })
  .filter((item) => item.riskTags.length > 0)
  .sort((left, right) => {
    const leftKey = `${left.routePrefix} ${left.action}`;
    const rightKey = `${right.routePrefix} ${right.action}`;
    return leftKey.localeCompare(rightKey);
  });

const payload = {
  generatedAt: new Date().toISOString(),
  sources: {
    pageManifest: "frontend/src/platform/screen-registry/pageManifests.ts",
    apiMap: "docs/ai/40-backend/controller-service-map.csv",
    functionMap: "docs/ai/20-ui/event-map.csv",
    frontendE2e: "frontend/e2e",
    backendTests: "src/test",
    testDataPolicy: "docs/operations/test-data-safety-policy.md",
    governancePlan: "docs/architecture/verification-center-and-baseline-governance-plan.md"
  },
  summary: {
    pageCount: pageInventory.length,
    menuBoundPageCount: pageInventory.filter((item) => item.menuCode || item.menuBindingType === "dynamic").length,
    staticMenuBoundPageCount: pageInventory.filter((item) => item.menuCode).length,
    dynamicMenuBoundPageCount: pageInventory.filter((item) => item.menuBindingType === "dynamic").length,
    unmanagedPageCount: pageInventory.filter((item) => !item.menuCode && item.menuBindingType !== "dynamic").length,
    routeBoundPageCount: pageInventory.filter((item) => item.routePath).length,
    apiCount: apiInventory.length,
    uniqueRouteCount: uniqueSorted(apiInventory.map((item) => item.routePrefix)).length,
    functionCount: functionInventory.length,
    uniqueFunctionCount: uniqueSorted(functionInventory.map((item) => item.frontendFunction)).length,
    frontendE2eCount: frontendTests.length,
    backendTestCount: backendTests.length,
    highRiskPageCount: highRiskPages.length,
    highRiskApiCount: highRiskApis.length,
    governedTestProfileCount: governedTestProfiles.length,
    baselineRegistryCount: baselineRegistry.length,
    staleBaselineCount: baselineRegistry.filter((item) => item.stale).length,
    verificationRunCount: verificationRuns.length,
    failingRunCount: verificationRuns.filter((item) => item.result !== "PASS").length,
    expiringProfileCount: managedVault.accounts.filter((item) => item.status !== "READY").length,
    staleDatasetCount: managedVault.datasets.filter((item) => item.status !== "READY").length,
    actionQueueCount: actionQueue.length
  },
  pages: pageInventory,
  apis: apiInventory,
  functions: functionInventory,
  highRisk: {
    pages: highRiskPages,
    apis: highRiskApis
  },
  testProfiles: governedTestProfiles,
  baselineRegistry,
  verificationRuns,
  managedVault,
  actionQueue,
  tests: {
    frontendE2e: frontendTests,
    backend: backendTests
  }
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`[generate-verification-center-inventory] wrote ${outputPath}`);
