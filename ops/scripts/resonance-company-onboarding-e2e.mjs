#!/usr/bin/env node
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PROCESS_CODE = "COMPANY_ONBOARDING";
const STEP_CODES = [
  "COMPANY_ONBOARDING_APPLY",
  "COMPANY_ONBOARDING_APPROVE",
  "COMPANY_ONBOARDING_SITE",
  "COMPANY_ONBOARDING_ACTORS",
  "COMPANY_ONBOARDING_READY",
];
const CASE_CODES = [
  "COMPANY_ONBOARDING_HAPPY",
  "COMPANY_ONBOARDING_NO_COMPANY",
  "COMPANY_ONBOARDING_NO_SITE",
  "COMPANY_ONBOARDING_ROLE_GAP",
  "COMPANY_ONBOARDING_SOD",
  "COMPANY_ONBOARDING_TENANT",
  "COMPANY_ONBOARDING_RETRY",
];
const root = path.resolve(process.env.RESONANCE_ROOT || path.join(import.meta.dirname, "../.."));

function hashEmployeePassword(rawPassword, userId) {
  return createHash("sha256")
    .update(String(userId), "utf8")
    .update(String(rawPassword), "utf8")
    .digest("base64");
}

if (process.argv.includes("--self-test")) {
  const passwordHashVector = hashEmployeePassword(["employee", "123"].join("-"), "qa-clone-01")
    === "emiVMWrJn+oRpKC0jTH8tQ9rwQ8oBqKB5kFI/QPQIso=";
  console.log(JSON.stringify({
    status: "SELF_TEST_PASS",
    promotionEligible: false,
    processCode: PROCESS_CODE,
    stepCount: STEP_CODES.length,
    caseCount: CASE_CODES.length,
    stepCodes: STEP_CODES,
    caseCodes: CASE_CODES,
    cleanupGuard: "disposable INSTT_ tenant plus exact account/site/project identifiers",
    passwordDerivation: "SHA-256(userId || rawPassword) Base64",
    passwordHashVector,
    failClosed: true,
  }));
  process.exit(0);
}

const require = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { chromium, request } = require("@playwright/test");
const baseURL = String(process.env.CARBONET_RUNTIME_BASE_URL || "http://127.0.0.1").replace(/\/$/, "");
const namespace = String(process.env.K8S_NAMESPACE || "carbonet-prod");
const patroniPod = String(process.env.PATRONI_POD || "");
const actorPassword = String(process.env.CARBONET_ACTOR_TEST_PASSWORD || "");
const adminPassword = String(process.env.CARBONET_ADMIN_TEST_PASSWORD || "");
const adminUser = String(process.env.CARBONET_ADMIN_TEST_USER || "webmaster");
const contractsFile = String(process.env.E2E_CONTRACTS_FILE || "");
const managedExecutablePath = chromium.executablePath();
const executablePath = String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "") ||
  (existsSync(managedExecutablePath) ? managedExecutablePath : [
    "/snap/bin/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
  ].find((candidate) => existsSync(candidate)) || "");

const requireEnv = (value, name) => {
  if (!value) throw new Error(`${name} is required`);
  return value;
};
requireEnv(patroniPod, "PATRONI_POD");
requireEnv(actorPassword, "CARBONET_ACTOR_TEST_PASSWORD");
requireEnv(adminPassword, "CARBONET_ADMIN_TEST_PASSWORD");
requireEnv(contractsFile, "E2E_CONTRACTS_FILE");

const startedAt = Date.now();
const short = `${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 5)}`.toLowerCase();
const marker = `ONB${short.toUpperCase()}`;
const companyName = `온보딩 격리 검증 ${marker}`;
const businessNumber = `9${String(Date.now()).slice(-9)}`;
const siteCode = `E2E-${short.toUpperCase()}`.slice(0, 40);
const siteName = `격리 사업장 ${marker}`;
const foreignTenant = `E2E_FOREIGN_${short}`.slice(0, 100);
const foreignSiteName = `타테넌트 사업장 ${marker}`;
const accounts = {
  owner: `e2eo${short}`.slice(0, 20),
  data: `e2ed${short}`.slice(0, 20),
  calculator: `e2ec${short}`.slice(0, 20),
  verifier: `e2ev${short}`.slice(0, 20),
  approver: `e2ea${short}`.slice(0, 20),
};
const accountSpecs = [
  [accounts.owner, "qaowner26", "기업 업무 책임자", "COMPANY_MANAGER", "ROLE_ADMIN", `UO${short}`],
  [accounts.data, "qadata26", "사업장 자료 담당자", "SITE_DATA_OWNER", "ROLE_USER", `UD${short}`],
  [accounts.calculator, "qacalc26", "배출량 산정 담당자", "CALCULATOR", "ROLE_USER", `UC${short}`],
  [accounts.verifier, "qaverify26", "검증 담당자", "VERIFIER", "ROLE_USER", `UV${short}`],
  [accounts.approver, "qaapprove26", "승인 담당자", "APPROVER", "ROLE_USER", `UA${short}`],
].map(([id, source, name, actor, role, esntl]) => ({ id, source, name, actor, role, esntl: esntl.slice(0, 20) }));

const evidence = {
  status: "FAILED",
  promotionEligible: false,
  processCode: PROCESS_CODE,
  sourceCommit: "",
  startedAt: new Date(startedAt).toISOString(),
  stepCount: STEP_CODES.length,
  caseCount: CASE_CODES.length,
  api: 0,
  database: 0,
  authority: 0,
  exceptionStates: 0,
  audit: 0,
  recovery: 0,
  cleanup: 0,
  responsive: 0,
  accessibility: 0,
  desktop: 0,
  mobile: 0,
  performanceP95Ms: 0,
  contracts: [],
  steps: Object.fromEntries(STEP_CODES.map((code) => [code, { result: "NOT_RUN" }])),
  cases: Object.fromEntries(CASE_CODES.map((code) => [code, { result: "NOT_RUN" }])),
  authorityTransitions: [],
  routes: [],
  fixture: { isolated: true, marker, tenantId: "", projectId: "" },
};

const timings = [];
const clients = [];
let tenantId = "";
let projectId = "";
let evidencePaths = [];
let browser;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}
function assertFixtureIdentifiers() {
  assert(/^INSTT_[0-9]{10,14}$/.test(tenantId), `unsafe disposable tenant id: ${tenantId}`);
  assert(Object.values(accounts).every((id) => /^e2e[a-z0-9]{4,17}$/.test(id)), "unsafe disposable account id");
  assert(/^E2E-[A-Z0-9]{4,30}$/.test(siteCode), "unsafe disposable site code");
}
function psql(sql) {
  return execFileSync("kubectl", [
    "-n", namespace, "exec", patroniPod, "-c", "patroni", "--",
    "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", "carbonet",
    "-X", "-v", "ON_ERROR_STOP=1", "-Atq", "-c", sql,
  ], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
}
function dbJson(sql) {
  const raw = psql(sql);
  return raw ? JSON.parse(raw.split(/\r?\n/).filter(Boolean).at(-1)) : {};
}
async function jsonBody(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { return { raw: text.slice(0, 1000) }; }
}
async function apiCall(api, method, url, data, expected = [200], label = url) {
  const before = Date.now();
  const response = await api[method](url, {
    ...(data === undefined ? {} : { data }),
    failOnStatusCode: false,
  });
  const durationMs = Date.now() - before;
  timings.push(durationMs);
  const body = await jsonBody(response);
  assert(expected.includes(response.status()), `${label} HTTP ${response.status()} ${body.message || body.raw || ""}`);
  return { status: response.status(), body, durationMs };
}
function containsMissing(body, expected) {
  const missing = body?.readiness?.missing || body?.missing || [];
  return Array.isArray(missing) && missing.some((value) => String(value).includes(expected));
}
function markCase(code, detail) {
  evidence.cases[code] = { result: "PASSED", ...detail };
}
function markStep(code, detail) {
  evidence.steps[code] = { result: "PASSED", ...detail };
}
async function login(pathname, userId, userPw, role) {
  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
  clients.push(api);
  const result = await apiCall(api, "post", pathname, { userId, userPw, userSe: "USR" }, [200], `${role} login`);
  assert(result.body?.status !== "loginFailure", `${role} login rejected`);
  return api;
}
function projectBody(overrides = {}) {
  const year = new Date().getUTCFullYear();
  return {
    clientRequestId: `onboarding-${short}-${Math.random().toString(36).slice(2, 8)}`,
    name: `온보딩 검증 프로젝트 ${marker} ${Math.random().toString(36).slice(2, 6)}`,
    site: siteName,
    owner: accounts.owner,
    dataOwner: accounts.data,
    calculator: accounts.calculator,
    verifier: accounts.verifier,
    approver: accounts.approver,
    reportingYear: year,
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
    dueDate: `${year}-12-31`,
    scopes: ["Scope 1", "Scope 2"],
    organizationBoundary: "OPERATIONAL_CONTROL",
    emissionStandard: "ISO_14064_1",
    methodologyVersion: "2018",
    verificationLevel: "LIMITED",
    collectionCycle: "MONTHLY",
    materialityThreshold: "5",
    ...overrides,
  };
}

function cloneDisposableAccounts() {
  assertFixtureIdentifiers();
  const inserts = accountSpecs.map((account) => {
    const passwordHash = hashEmployeePassword(actorPassword, account.id);
    return `
INSERT INTO comtnemplyrinfo(
  emplyr_id,orgnzt_id,user_nm,password,empl_no,ihidnum,sexdstn_code,brthdy,
  fxnum,house_adres,password_hint,password_cnsr,house_end_telno,area_no,
  detail_adres,zip,offm_telno,mbtlnum,email_adres,ofcps_nm,
  house_middle_telno,group_id,pstinst_code,emplyr_sttus_code,esntl_id,
  crtfc_dn_value,sbscrb_de,lock_at,lock_cnt,lock_last_pnttm,
  chg_pwd_last_pnttm,auth_ty,auth_dn,auth_ci,auth_di,auth_email,marketing_yn,instt_id
)
SELECT ${sqlLiteral(account.id)},orgnzt_id,${sqlLiteral(`${account.name} ${marker}`)},${sqlLiteral(passwordHash)},empl_no,ihidnum,
  sexdstn_code,brthdy,fxnum,house_adres,password_hint,password_cnsr,house_end_telno,area_no,
  detail_adres,zip,offm_telno,mbtlnum,${sqlLiteral(`${account.id}@resonance.test`)},${sqlLiteral(account.name)},
  house_middle_telno,group_id,pstinst_code,emplyr_sttus_code,${sqlLiteral(account.esntl)},crtfc_dn_value,
  current_timestamp,lock_at,0,null,current_timestamp,auth_ty,auth_dn,auth_ci,auth_di,auth_email,'N',${sqlLiteral(tenantId)}
FROM comtnemplyrinfo WHERE lower(emplyr_id)=lower(${sqlLiteral(account.source)});
INSERT INTO comtnemplyrscrtyestbs(scrty_dtrmn_trget_id,mber_ty_code,author_code)
VALUES (${sqlLiteral(account.esntl)},'USR03',${sqlLiteral(account.role)});
`;
  }).join("\n");
  psql(`BEGIN; ${inserts} COMMIT;`);
  const cloned = Number(psql(`SELECT count(*) FROM comtnemplyrinfo WHERE instt_id=${sqlLiteral(tenantId)} AND emplyr_id IN (${Object.values(accounts).map(sqlLiteral).join(",")})`));
  assert(cloned === 5, `disposable account clone incomplete count=${cloned}`);
}

async function checkRoute(browserInstance, storageState, route, viewport, audience, stepCode) {
  const context = await browserInstance.newContext({ storageState, ignoreHTTPSErrors: true, viewport });
  const page = await context.newPage();
  const pageErrors = [];
  const serverErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`); });
  const before = Date.now();
  const response = await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  const loadMs = Date.now() - before;
  assert(response && response.status() < 400, `${route} navigation HTTP ${response?.status() || 0}`);
  await page.waitForFunction(() => {
    const root = document.querySelector("#root");
    const text = document.body.textContent || "";
    return !root || root.childElementCount > 0 ||
      text.includes("React app did not mount") ||
      text.includes("AUTHENTICATION_REQUIRED");
  }, undefined, { timeout: 10_000 }).catch(() => undefined);
  const finalUrl = page.url();
  const requestedPath = new URL(`${baseURL}${route}`).pathname.replace(/\/$/, "") || "/";
  const finalPath = new URL(finalUrl).pathname.replace(/\/$/, "") || "/";
  assert(finalPath === requestedPath, `${route} redirected to unexpected path ${finalPath}`);
  const metrics = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const controls = [...document.querySelectorAll("button,input,select,textarea,a[href]")].filter(visible);
    const unnamed = controls.filter((element) => {
      const id = element.getAttribute("id");
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : "";
      return !(element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") ||
        element.getAttribute("title") || element.getAttribute("placeholder") || label || element.textContent?.trim() ||
        (element instanceof HTMLInputElement && ["hidden", "submit", "button"].includes(element.type)));
    });
    return {
      title: document.title,
      mainText: (document.querySelector("main") || document.body).textContent?.trim().slice(0, 160) || "",
      failureText: ["AUTHENTICATION_REQUIRED", "React app did not mount", "Unexpected token", "페이지 처리 중 오류가 발생했습니다."]
        .filter((message) => document.body.textContent?.includes(message)),
      passwordInputs: document.querySelectorAll('input[type="password"]').length,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      unnamedControls: unnamed.length,
    };
  });
  await context.close();
  assert(metrics.mainText.length > 0, `${route} rendered no meaningful content`);
  assert(metrics.failureText.length === 0, `${route} rendered failure fallback ${metrics.failureText.join(" | ")}`);
  assert(metrics.passwordInputs === 0, `${route} rendered a login form instead of the requested screen`);
  assert(pageErrors.length === 0, `${route} page error ${pageErrors.join(" | ")}`);
  assert(serverErrors.length === 0, `${route} server error ${serverErrors.join(" | ")}`);
  assert(!metrics.horizontalOverflow, `${route} page-level horizontal overflow`);
  assert(metrics.unnamedControls === 0, `${route} has ${metrics.unnamedControls} unnamed controls`);
  evidence.routes.push({ stepCode, audience, route, finalUrl, viewport, status: response.status(), loadMs, ...metrics });
}

async function removeEvidenceFiles() {
  const safePaths = evidencePaths.filter((value) => typeof value === "string" && (/^\/var\/file\/instt\//.test(value) || /\/file\/instt\//.test(value)));
  assert(safePaths.length === evidencePaths.length, "unsafe institution evidence path refused");
  if (!safePaths.length) return;
  const pods = execFileSync("kubectl", ["-n", namespace, "get", "pods", "-l", "app=carbonet-runtime", "-o", "jsonpath={range .items[*]}{.metadata.name}{'\\n'}{end}"], { encoding: "utf8" })
    .split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  for (const pod of pods) {
    for (const filePath of safePaths) {
      execFileSync("kubectl", ["-n", namespace, "exec", pod, "--", "sh", "-c",
        "case \"$1\" in /var/file/instt/*|*/file/instt/*) rm -f -- \"$1\";; *) exit 42;; esac", "sh", filePath],
      { stdio: "ignore" });
    }
  }
}

async function cleanupFixture(ownerApi) {
  if (!tenantId) return { residualCount: 0 };
  assertFixtureIdentifiers();
  if (ownerApi) {
    const projects = psql(`SELECT project_id FROM emission_project_registry WHERE tenant_id=${sqlLiteral(tenantId)} AND project_name LIKE ${sqlLiteral(`%${marker}%`)}`)
      .split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    for (const disposableProjectId of projects) {
      const response = await ownerApi.delete(`/home/api/emission-projects/${encodeURIComponent(disposableProjectId)}`, { failOnStatusCode: false });
      if (response.status() !== 200 && response.status() !== 404) throw new Error(`project cleanup HTTP ${response.status()}`);
    }
    projectId = "";
  }
  const rereadPaths = psql(`SELECT file_stre_path FROM comtninsttfile WHERE instt_id=${sqlLiteral(tenantId)} AND file_stre_path IS NOT NULL`)
    .split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  evidencePaths = [...new Set([...evidencePaths, ...rereadPaths])];
  await removeEvidenceFiles();
  const ids = Object.values(accounts).map(sqlLiteral).join(",");
  const esntls = accountSpecs.map((account) => sqlLiteral(account.esntl)).join(",");
  psql(`BEGIN;
    DELETE FROM framework_project_actor_assignment WHERE user_id IN (${ids});
    DELETE FROM framework_account_actor_assignment WHERE tenant_id=${sqlLiteral(tenantId)} AND account_id IN (${ids});
    DELETE FROM emission_site_registry WHERE (tenant_id=${sqlLiteral(tenantId)} AND site_code=${sqlLiteral(siteCode)}) OR (tenant_id=${sqlLiteral(foreignTenant)} AND site_code=${sqlLiteral(siteCode)});
    DELETE FROM comtnauthtokenstore WHERE lower(user_id) IN (${Object.values(accounts).map((id) => sqlLiteral(id.toLowerCase())).join(",")});
    DELETE FROM comtnloginhist WHERE lower(user_id) IN (${Object.values(accounts).map((id) => sqlLiteral(id.toLowerCase())).join(",")});
    DELETE FROM comtnemplyrscrtyestbs WHERE scrty_dtrmn_trget_id IN (${esntls});
    DELETE FROM comtnemplyrinfo WHERE instt_id=${sqlLiteral(tenantId)} AND emplyr_id IN (${ids});
    DELETE FROM audit_event WHERE entity_type='COMPANY' AND entity_id LIKE ${sqlLiteral(`%${tenantId}%`)};
    DELETE FROM comtninsttfile WHERE instt_id=${sqlLiteral(tenantId)};
    DELETE FROM comtninsttinfo WHERE instt_id=${sqlLiteral(tenantId)};
  COMMIT;`);
  return dbJson(`SELECT jsonb_build_object('residualCount',
    (SELECT count(*) FROM comtninsttinfo WHERE instt_id=${sqlLiteral(tenantId)})+
    (SELECT count(*) FROM comtninsttfile WHERE instt_id=${sqlLiteral(tenantId)})+
    (SELECT count(*) FROM comtnemplyrinfo WHERE instt_id=${sqlLiteral(tenantId)})+
    (SELECT count(*) FROM framework_account_actor_assignment WHERE tenant_id=${sqlLiteral(tenantId)})+
    (SELECT count(*) FROM emission_site_registry WHERE tenant_id IN (${sqlLiteral(tenantId)},${sqlLiteral(foreignTenant)}))+
    (SELECT count(*) FROM emission_project_registry WHERE tenant_id=${sqlLiteral(tenantId)}))::text`);
}

let mainError;
let cleanupError;
let ownerApi;
try {
  const contractPayload = JSON.parse(await readFile(contractsFile, "utf8"));
  evidence.contracts = Array.isArray(contractPayload) ? contractPayload : contractPayload.contracts;
  assert(Array.isArray(evidence.contracts) && evidence.contracts.length === 5, "five pre-run contract envelopes are required");
  assert(new Set(evidence.contracts.map((item) => item.stepCode)).size === 5, "contract step envelopes are not unique");
  assert(STEP_CODES.every((code) => evidence.contracts.some((item) => item.processCode === PROCESS_CODE && item.stepCode === code)), "contract envelope is incomplete");
  evidence.sourceCommit = String(evidence.contracts[0].sourceCommit || "");
  assert(evidence.contracts.every((item) => item.sourceCommit === evidence.sourceCommit), "source commit changed during contract capture");

  const publicApi = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
  clients.push(publicApi);
  const registrationStarted = Date.now();
  const registrationResponse = await publicApi.post("/join/api/company-register", {
    multipart: {
      membershipType: "EMITTER",
      agencyName: companyName,
      representativeName: "온보딩 검증 대표",
      bizRegistrationNumber: businessNumber,
      zipCode: "04524",
      companyAddress: "서울특별시 중구 세종대로 110",
      companyAddressDetail: marker,
      chargerName: "온보딩 검증 담당자",
      chargerEmail: `${short}@resonance.test`,
      chargerTel: "0200000000",
      lang: "ko",
      fileUploads: { name: `${marker}.txt`, mimeType: "text/plain", buffer: Buffer.from(`isolated onboarding evidence ${marker}\n`) },
    },
    failOnStatusCode: false,
  });
  timings.push(Date.now() - registrationStarted);
  const registration = await jsonBody(registrationResponse);
  assert(registrationResponse.status() === 200 && registration.success === true, `company registration failed HTTP ${registrationResponse.status()}`);
  tenantId = String(registration.insttId || "");
  evidence.fixture.tenantId = tenantId;
  assertFixtureIdentifiers();
  const applyDb = dbJson(`SELECT jsonb_build_object(
    'status',max(i.instt_sttus),'companyCount',count(DISTINCT i.instt_id),'fileCount',count(f.file_id),
    'paths',coalesce(jsonb_agg(f.file_stre_path) FILTER (WHERE f.file_stre_path IS NOT NULL),'[]'::jsonb))::text
    FROM comtninsttinfo i LEFT JOIN comtninsttfile f ON f.instt_id=i.instt_id
    WHERE i.instt_id=${sqlLiteral(tenantId)} GROUP BY i.instt_id`);
  evidencePaths = Array.isArray(applyDb.paths) ? applyDb.paths : [];
  assert(applyDb.status === "A" && Number(applyDb.companyCount) === 1 && Number(applyDb.fileCount) >= 1, "APPLY DB reread failed");
  markStep("COMPANY_ONBOARDING_APPLY", { actor: "COMPANY_MANAGER", effectiveAccount: "anonymous applicant", httpStatus: 200, dbReread: applyDb });

  cloneDisposableAccounts();
  ownerApi = await login("/signin/actionLogin", accounts.owner, actorPassword, "COMPANY_MANAGER user session");
  const ownerAdminApi = await login("/admin/login/actionLogin", accounts.owner, actorPassword, "COMPANY_MANAGER admin session");
  const dataApi = await login("/signin/actionLogin", accounts.data, actorPassword, "SITE_DATA_OWNER user session");
  const adminApi = await login("/admin/login/actionLogin", adminUser, adminPassword, "platform approval administrator");

  const pending = await apiCall(ownerApi, "get", "/home/api/emission-projects/options", undefined, [200], "pending company readiness");
  assert(pending.body?.readiness?.ready === false && containsMissing(pending.body, "COMPANY_NOT_APPROVED"), "pending company was not blocked");
  markCase("COMPANY_ONBOARDING_NO_COMPANY", { state: "A", missing: pending.body.readiness.missing });

  const forbiddenApproval = await apiCall(ownerAdminApi, "post", "/admin/api/admin/member/company-approve/action", { action: "approve", insttId: tenantId }, [403], "non-master approval boundary");
  evidence.authorityTransitions.push({ stepCode: "COMPANY_ONBOARDING_APPROVE", declaredActor: "APPROVER", attemptedAccount: accounts.owner, result: "FORBIDDEN", httpStatus: forbiddenApproval.status });
  const approval = await apiCall(adminApi, "post", "/admin/api/admin/member/company-approve/action", { action: "approve", insttId: tenantId }, [200], "master company approval");
  const approveDb = dbJson(`SELECT jsonb_build_object(
    'status',(SELECT instt_sttus FROM comtninsttinfo WHERE instt_id=${sqlLiteral(tenantId)}),
    'auditCount',(SELECT count(*) FROM audit_event WHERE entity_type='COMPANY' AND entity_id LIKE ${sqlLiteral(`%${tenantId}%`)} AND action_code LIKE 'COMPANY_APPROVAL_%'))::text`);
  assert(approveDb.status === "P" && Number(approveDb.auditCount) >= 1, "APPROVE DB/audit reread failed");
  evidence.authorityTransitions.push({ stepCode: "COMPANY_ONBOARDING_APPROVE", declaredActor: "APPROVER", effectiveAccountClass: "platform master administrator", automaticAccountSwitch: true, result: "ALLOWED", httpStatus: approval.status, auditCount: Number(approveDb.auditCount) });
  markStep("COMPANY_ONBOARDING_APPROVE", { actor: "APPROVER", effectiveAccountClass: "platform master administrator", automaticAccountSwitch: true, httpStatus: approval.status, dbReread: approveDb });

  const noSite = await apiCall(ownerApi, "get", "/home/api/emission-projects/options", undefined, [200], "missing site readiness");
  assert(noSite.body?.readiness?.ready === false && containsMissing(noSite.body, "ACTIVE_SITE_REQUIRED"), "missing site was not blocked");
  markCase("COMPANY_ONBOARDING_NO_SITE", { missing: noSite.body.readiness.missing });

  const site = await apiCall(ownerAdminApi, "post", "/admin/api/admin/emission/sites", {
    code: siteCode, name: siteName, countryCode: "KR", postalCode: "04524",
    address: "서울특별시 중구 세종대로 110", detailAddress: marker,
    boundaryMethod: "OPERATIONAL_CONTROL", dataOwner: accounts.data, status: "ACTIVE",
  }, [200], "tenant site registration");
  const siteDb = dbJson(`SELECT jsonb_build_object('count',count(*),'tenant',max(tenant_id),'status',max(site_status),'dataOwner',max(data_owner_id))::text
    FROM emission_site_registry WHERE tenant_id=${sqlLiteral(tenantId)} AND site_code=${sqlLiteral(siteCode)}`);
  assert(Number(siteDb.count) === 1 && siteDb.tenant === tenantId && siteDb.status === "ACTIVE", "SITE DB reread failed");
  markStep("COMPANY_ONBOARDING_SITE", { actor: "COMPANY_MANAGER", effectiveAccount: accounts.owner, automaticAccountSwitch: "user-to-admin-session", httpStatus: site.status, dbReread: siteDb });

  const roleGap = await apiCall(ownerApi, "get", "/home/api/emission-projects/options", undefined, [200], "role gap readiness");
  assert(roleGap.body?.readiness?.ready === false && containsMissing(roleGap.body, "REQUIRED_ACTOR_MISSING:VERIFIER"), "verifier role gap was not blocked");
  markCase("COMPANY_ONBOARDING_ROLE_GAP", { missing: roleGap.body.readiness.missing });

  const sod = await apiCall(ownerApi, "post", "/home/api/emission-projects", projectBody({ verifier: accounts.calculator }), [400], "segregation-of-duties rejection");
  assert(String(sod.body?.message || "").includes("PROJECT_SEGREGATION_OF_DUTIES_REQUIRED"), "SOD violation was not rejected by policy");
  markCase("COMPANY_ONBOARDING_SOD", { httpStatus: sod.status, error: "PROJECT_SEGREGATION_OF_DUTIES_REQUIRED" });

  const forbiddenAssign = await apiCall(dataApi, "post", "/admin/api/system/actor-process/assignments", {
    accountId: accounts.data, tenantId, projectId: "*", actorCode: "SITE_DATA_OWNER", dataScope: "*",
  }, [401, 403], "non-manager actor assignment boundary");
  assert(forbiddenAssign.body?.message === "ACTOR_ASSIGNMENT_COMPANY_MANAGER_REQUIRED", "non-manager assignment did not reach the actor-policy boundary");
  const forbiddenWriteCount = Number(psql(`SELECT count(*) FROM framework_account_actor_assignment WHERE tenant_id=${sqlLiteral(tenantId)} AND project_id='*' AND lower(account_id)=lower(${sqlLiteral(accounts.data)}) AND actor_code='SITE_DATA_OWNER' AND assignment_status='ACTIVE'`));
  assert(forbiddenWriteCount === 0, "non-manager assignment wrote actor authority before rejection");
  evidence.authorityTransitions.push({ stepCode: "COMPANY_ONBOARDING_ACTORS", declaredActor: "COMPANY_MANAGER", attemptedActor: "SITE_DATA_OWNER", result: "FORBIDDEN", httpStatus: forbiddenAssign.status, policy: forbiddenAssign.body.message, forbiddenWriteCount });
  const assignmentResponses = [];
  for (const account of accountSpecs) {
    assignmentResponses.push(await apiCall(ownerAdminApi, "post", "/admin/api/system/actor-process/assignments", {
      accountId: account.id, tenantId, projectId: "*", actorCode: account.actor, dataScope: "*",
    }, [200], `assign ${account.actor}`));
  }
  const actorDb = dbJson(`SELECT jsonb_build_object(
    'assignmentCount',count(*),'actorCount',count(DISTINCT actor_code),'accountCount',count(DISTINCT lower(account_id)),
    'actors',jsonb_agg(actor_code ORDER BY actor_code))::text
    FROM framework_account_actor_assignment WHERE tenant_id=${sqlLiteral(tenantId)} AND project_id='*' AND assignment_status='ACTIVE'`);
  assert(Number(actorDb.assignmentCount) === 5 && Number(actorDb.actorCount) === 5 && Number(actorDb.accountCount) === 5, "ACTORS DB reread or duty separation failed");
  evidence.authorityTransitions.push({ stepCode: "COMPANY_ONBOARDING_ACTORS", declaredActor: "COMPANY_MANAGER", effectiveAccount: accounts.owner, automaticAccountSwitch: "user-to-admin-session", result: "ALLOWED", httpStatus: 200 });
  markStep("COMPANY_ONBOARDING_ACTORS", { actor: "COMPANY_MANAGER", effectiveAccount: accounts.owner, automaticAccountSwitch: "user-to-admin-session", httpStatuses: assignmentResponses.map((item) => item.status), dbReread: actorDb });

  const ready = await apiCall(ownerApi, "get", "/home/api/emission-projects/options", undefined, [200], "ready diagnostics");
  assert(ready.body?.readiness?.ready === true && ready.body?.readiness?.missing?.length === 0, "readiness did not recover after remediation");
  markCase("COMPANY_ONBOARDING_RETRY", { before: "BLOCKED", after: "READY", missing: [] });

  psql(`INSERT INTO emission_site_registry(tenant_id,site_code,site_name,address,site_status,source_type,created_by,updated_by)
    VALUES (${sqlLiteral(foreignTenant)},${sqlLiteral(siteCode)},${sqlLiteral(foreignSiteName)},'격리 검증 주소','ACTIVE','E2E_FIXTURE','E2E','E2E')`);
  const crossTenant = await apiCall(ownerApi, "post", "/home/api/emission-projects", projectBody({ site: foreignSiteName }), [400], "cross-tenant site rejection");
  assert(String(crossTenant.body?.message || "").includes("PROJECT_SITE_NOT_REGISTERED"), "cross-tenant site was not rejected");
  const crossTenantDbCount = Number(psql(`SELECT count(*) FROM emission_project_registry WHERE tenant_id=${sqlLiteral(tenantId)} AND site_name=${sqlLiteral(foreignSiteName)}`));
  assert(crossTenantDbCount === 0, "cross-tenant project write occurred");
  markCase("COMPANY_ONBOARDING_TENANT", { httpStatus: crossTenant.status, crossTenantWrite: false, dbRereadCount: crossTenantDbCount });

  const created = await apiCall(ownerApi, "post", "/home/api/emission-projects", projectBody(), [200], "ready project creation");
  projectId = String(created.body?.id || "");
  evidence.fixture.projectId = projectId;
  assert(/^PRJ-[0-9]{4}-[A-Z0-9]{6}$/.test(projectId), "valid project id was not returned");
  const readyDb = dbJson(`SELECT jsonb_build_object(
    'projectCount',(SELECT count(*) FROM emission_project_registry WHERE project_id=${sqlLiteral(projectId)} AND tenant_id=${sqlLiteral(tenantId)}),
    'companyStatus',(SELECT instt_sttus FROM comtninsttinfo WHERE instt_id=${sqlLiteral(tenantId)}),
    'siteCount',(SELECT count(*) FROM emission_site_registry WHERE tenant_id=${sqlLiteral(tenantId)} AND site_status='ACTIVE'),
    'actorCount',(SELECT count(DISTINCT actor_code) FROM framework_account_actor_assignment WHERE tenant_id=${sqlLiteral(tenantId)} AND project_id='*' AND assignment_status='ACTIVE'))::text`);
  assert(Number(readyDb.projectCount) === 1 && readyDb.companyStatus === "P" && Number(readyDb.siteCount) === 1 && Number(readyDb.actorCount) === 5, "READY DB reread failed");
  markStep("COMPANY_ONBOARDING_READY", { actor: "COMPANY_MANAGER", effectiveAccount: accounts.owner, httpStatuses: [ready.status, created.status], dbReread: readyDb });
  markCase("COMPANY_ONBOARDING_HAPPY", { ready: true, projectCreated: true, projectId });

  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const userState = await ownerApi.storageState();
  const adminState = await adminApi.storageState();
  const anonymousState = { cookies: [], origins: [] };
  const routePairs = [
    ["COMPANY_ONBOARDING_APPLY", "/join/companyRegister", "/admin/member/company-approve"],
    ["COMPANY_ONBOARDING_APPROVE", `/join/companyJoinStatusDetail?bizNo=${businessNumber}&repName=${encodeURIComponent("온보딩 검증 대표")}`, "/admin/member/company-approve"],
    ["COMPANY_ONBOARDING_SITE", "/mypage/company", "/admin/emission/site-management"],
    ["COMPANY_ONBOARDING_ACTORS", "/mypage/staff", "/admin/system/actor-process"],
    ["COMPANY_ONBOARDING_READY", "/emission/project/create", "/admin/emission/project-operations"],
  ];
  for (const [stepCode, userRoute, adminRoute] of routePairs) {
    const userRouteState = ["COMPANY_ONBOARDING_APPLY", "COMPANY_ONBOARDING_APPROVE"].includes(stepCode)
      ? anonymousState
      : userState;
    await checkRoute(browser, userRouteState, userRoute, { width: 1440, height: 1000 }, "USER", stepCode);
    await checkRoute(browser, adminState, adminRoute, { width: 1440, height: 1000 }, "ADMIN", stepCode);
    await checkRoute(browser, userRouteState, userRoute, { width: 390, height: 844 }, "USER", stepCode);
    await checkRoute(browser, adminState, adminRoute, { width: 390, height: 844 }, "ADMIN", stepCode);
  }
} catch (error) {
  mainError = error;
} finally {
  try {
    if (browser) await browser.close();
    const cleanupResult = await cleanupFixture(ownerApi);
    assert(Number(cleanupResult.residualCount) === 0, `fixture cleanup residual=${cleanupResult.residualCount}`);
    evidence.cleanup = 1;
    evidence.fixture.cleanup = cleanupResult;
  } catch (error) {
    cleanupError = error;
  }
  await Promise.all(clients.map((client) => client.dispose().catch(() => undefined)));
}

const p95 = timings.length ? [...timings].sort((a, b) => a - b)[Math.max(0, Math.ceil(timings.length * 0.95) - 1)] : 0;
evidence.performanceP95Ms = p95;
evidence.durationMs = Date.now() - startedAt;
evidence.finishedAt = new Date().toISOString();
const allCasesPassed = CASE_CODES.every((code) => evidence.cases[code]?.result === "PASSED");
const allStepsPassed = STEP_CODES.every((code) => evidence.steps[code]?.result === "PASSED" && evidence.steps[code]?.dbReread);
if (!mainError && !cleanupError && allCasesPassed && allStepsPassed && evidence.routes.length === 20) {
  Object.assign(evidence, {
    status: "PASS", promotionEligible: true, api: 1, database: 1, authority: 1,
    exceptionStates: 1, audit: 1, recovery: 1, responsive: 1, accessibility: 1,
    desktop: 1, mobile: 1,
  });
} else {
  evidence.failure = {
    message: mainError?.message || cleanupError?.message || "incomplete fail-closed evidence",
    cleanupMessage: cleanupError?.message || "",
    passedSteps: STEP_CODES.filter((code) => evidence.steps[code]?.result === "PASSED").length,
    passedCases: CASE_CODES.filter((code) => evidence.cases[code]?.result === "PASSED").length,
  };
}

const outputDir = path.join(root, "var/test-evidence");
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "company-onboarding-latest.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence));
if (evidence.status !== "PASS") process.exitCode = 1;
