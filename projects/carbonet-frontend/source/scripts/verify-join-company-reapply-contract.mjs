import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, "..");
const repoRoot = path.resolve(sourceRoot, "../../..");

const read = (relativePath) => fs.readFileSync(path.resolve(repoRoot, relativePath), "utf8");
const page = read("projects/carbonet-frontend/source/src/features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx");
const join = read("projects/carbonet-frontend/source/src/lib/api/join.ts");
const session = read("projects/carbonet-frontend/source/src/lib/api/joinSession.ts");
const types = read("projects/carbonet-frontend/source/src/lib/api/joinTypes.ts");
const manifest = read("projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts");
const help = JSON.parse(read("modules/resonance-common/platform-help-content/src/main/resources/help/page-help.json"));

const failures = [];
const requireSource = (condition, message) => {
  if (!condition) failures.push(message);
};

requireSource(page.includes("fetchJoinCompanyReapplyPage("), "lookup must call the company reapply page API");
requireSource(!page.includes("enabled: false"), "manual lookup must not be disabled through useAsyncValue");
requireSource(page.includes("registeredContact: registeredContact.trim()"), "lookup must send the registered contact verifier");
requireSource(join.includes("registeredContact: string"), "lookup API contract must require registeredContact");
requireSource(join.includes("postValidatedJoinJson") && join.includes("postJsonWithResponse"), "identity lookup must use POST JSON");
requireSource(page.includes("lookupHandle") && types.includes("lookupHandle?: string"), "lookup continuation must use an opaque handle");
requireSource(!page.includes('params.get("bizNo")') && !page.includes('params.get("repName")') && !page.includes('params.get("registeredContact")'), "reapply URL must not read raw identity fields");
requireSource(!page.includes("bizNo: form.bizRegistrationNumber") && !page.includes("repName: form.representativeName"), "status navigation must not place identity in the URL");
requireSource(page.includes("nextPage.reapplyToken || \"\""), "POST lookup reapplyToken must hydrate form state");
requireSource(session.includes("reapplyToken: payload.reapplyToken"), "multipart submit must include reapplyToken");
requireSource(types.includes("reapplyToken?: string"), "lookup response type must expose reapplyToken");
requireSource(types.includes("JoinCompanyReapplyResult") && types.includes("JoinCompanyReapplyFile") && types.includes("JoinCompanyReapplyReceipt"), "reapplication result, file and receipt must use explicit response types");
requireSource(!types.includes("result?: Record<string, unknown>;\n  insttFiles?: Array<Record<string, unknown>>;\n};\n\nexport type JoinSessionPayload"), "reapplication page payload must not use unknown record placeholders");
requireSource(types.includes("applicationVersion: number") && types.includes("fileSha256s: string[]"), "receipt must expose immutable submission evidence metadata");
requireSource(page.includes("MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024"), "file limit must be exactly 10 MiB");
requireSource(page.includes("file.size > MAX_FILE_SIZE_BYTES"), "10 MiB files must be accepted and larger files rejected");
requireSource(page.includes("MAX_FILE_COUNT = 10") && page.includes("uploadRows.length >= MAX_FILE_COUNT"), "supporting documents must be limited to 10 files in the UI");
requireSource(page.includes("submitLockRef.current || submitting || submitted"), "duplicate submission must be locked");
requireSource(page.includes("/join/companyJoinStatusSearch"), "successful reapplication must offer status lookup");
requireSource(page.includes("page?.success && !submitted"), "editable rejection form must be hidden after successful submission");
requireSource(page.includes("receipt.insttNm") && page.includes("receipt.regDate"), "completion summary must show organization and submitted time from typed receipt");
requireSource(page.includes("Awaiting approval review"), "completion summary must show approval-waiting status");
requireSource(page.includes("handleNewLookup"), "completion state must offer a new lookup action");
requireSource(page.includes('companyAddressDetail: ""') && page.includes('chargerName: ""') && page.includes('chargerEmail: ""') && page.includes('chargerTel: ""'), "protected contact fields must require re-entry");
requireSource(!page.includes("file.fileId") && !page.includes("file.streFileNm"), "existing documents must not depend on internal file id or storage path");
requireSource(page.includes("기존 제출") && page.includes("Existing submission"), "existing evidence must be labeled as a prior submission");
requireSource(page.includes('role="alert"') && page.includes('aria-live="assertive"'), "error summary must be announced accessibly");
requireSource(page.includes('type="email"') && page.includes("aria-invalid"), "required controls must expose semantic and validation attributes");
requireSource(page.includes("GOV_SYMBOL_PATH") && !page.includes("lh3.googleusercontent.com"), "government emblem must use a local resilient asset");
requireSource(page.includes("lookupBizNoPresent") && page.includes("lookupRegisteredContactPresent") && page.includes("institutionSelected") && page.includes("companyNamePresent"), "governance telemetry must record presence and counts instead of raw identifiers");

const guide = help["join-company-reapply"];
requireSource(Boolean(guide), "page help must exist");
requireSource(guide?.items?.length === 6, "page help must describe six customer journey steps");
const expectedAnchors = [
  "join-company-reapply-lookup",
  "join-company-reapply-rejection",
  "join-company-reapply-information",
  "join-company-reapply-files",
  "join-company-reapply-submit",
  "join-company-reapply-status"
];
expectedAnchors.forEach((anchor) => {
  requireSource(guide.items.some((item) => item.anchorSelector.includes(anchor)), `missing help anchor: ${anchor}`);
  requireSource(page.includes(`data-help-id=\"${anchor}\"`), `missing page anchor: ${anchor}`);
  requireSource(manifest.includes(`instanceKey: \"${anchor}\"`), `missing manifest component: ${anchor}`);
});
requireSource(guide.items.every((item) => !/^JoinCompanyReapply/.test(item.title)), "customer help titles must not expose component class names");

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

console.log("PASS join-company-reapply-contract checks=53 transport=POST handle=opaque helpSteps=6 maxFiles=10 maxFileMiB=10 completionState=summary-only");
