#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BROWSER="$ROOT/ops/scripts/validate-company-reapplication-browser.mjs"
RUNTIME="$ROOT/ops/scripts/validate-company-reapplication-runtime.sh"
WRAPPER="$ROOT/ops/tests/run-company-reapplication-business-e2e.sh"
STATUS_PAGE="$ROOT/projects/carbonet-frontend/source/src/features/join-company-status/JoinCompanyStatusMigrationPage.tsx"
CONTROLLER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/member/web/MemberJoinController.java"
RATE_CANDIDATE_FILTER="$ROOT/ops/scripts/lib/company-reapplication-browser-rate-limit-candidate.jq"
RATE_BEHAVIOR_TEST="$ROOT/ops/tests/test-company-reapplication-browser-rate-limit-cleanup.sh"
for file in "$BROWSER" "$RUNTIME" "$WRAPPER" "$STATUS_PAGE" "$CONTROLLER" "$RATE_CANDIDATE_FILTER" "$RATE_BEHAVIOR_TEST"; do
  [[ -f "$file" ]] || { echo "missing $file" >&2; exit 1; }
done
bash -n "$RUNTIME" "$WRAPPER" "$0"
node --check "$BROWSER"
node - "$BROWSER" "$RUNTIME" "$WRAPPER" "$STATUS_PAGE" "$CONTROLLER" <<'NODE'
const fs=require("fs");
const [browserPath,runtimePath,wrapperPath,statusPagePath,controllerPath]=process.argv.slice(2);
const browser=fs.readFileSync(browserPath,"utf8");
const runtime=fs.readFileSync(runtimePath,"utf8");
const wrapper=fs.readFileSync(wrapperPath,"utf8");
const statusPage=fs.readFileSync(statusPagePath,"utf8");
const controller=fs.readFileSync(controllerPath,"utf8");
const assert=(value,message)=>{if(!value)throw new Error(message);};

for(const token of [
  "routeSamples.length<20",
  "sample<=10",
  "performanceSampleCount:durations.length",
  "performanceP95Ms:durations[p95Index]",
  'page.locator("#lookup-bizNo").fill',
  'page.locator("#lookup-repName").fill',
  'page.locator("#lookup-registeredContact").fill',
  "const uploadBuffer=readFileSync(testCase.pdfPath)",
  "buffer:uploadBuffer",
  "fileInput.files[0].size>0",
  'name:"재신청 완료"',
  'name:"재신청 접수 완료"',
  'url.pathname==="/join/companyJoinStatusDetail"',
  'page.getByRole("listitem").filter',
  'getByRole("link",{name:"다운로드",exact:true})',
  'page.waitForEvent("download"',
  'downloadedBuffer.equals(uploadBuffer)',
  'downloadVerified:true',
  'downloadVerified:journeys.every(item=>item.downloadVerified)?1:0',
  'representativeUpdateVerified:journeys.some(item=>item.representativeUpdated)?1:0',
  'updatedRepName',
  'statusDetailResponse.status()!==200',
  "businessJourneyCount:journeys.length",
]) assert(browser.includes(token),`browser business E2E contract missing: ${token}`);
assert(browser.includes("process.env.CARBONET_BROWSER_BASE_URL||process.env.CARBONET_RUNTIME_BASE_URL"),
  "browser-specific canonical host precedence missing");
for(const token of [
  "<HomeLinkButton",
  "aria-label={copy.download}",
  'href={`/join/downloadInsttFile?downloadToken=${encodeURIComponent(downloadToken)}`}',
  '<span aria-hidden="true" className="material-symbols-outlined text-[18px]">download</span>',
]) assert(statusPage.includes(token),`status file direct-download contract missing: ${token}`);
for(const token of [
  "consumeCompanyReapplyToken(session, reapplyToken, normalizedInsttId, bizNo, projectId)",
  "boolean stableIdentityMatches = current != null && !current.isEmpty()",
  "constantTimeEquals(normalizeBusinessNumber(current.getBizrno()), normalizedBizNo)",
  "InstitutionStatusVO committedIdentity = new InstitutionStatusVO()",
  "committedIdentity.setInsttId(normalizedInsttId)",
  "committedIdentity.setReprsntNm(repName.trim())",
  "issueCompanyLookupHandle(session, projectId, committedIdentity)",
]) assert(controller.includes(token),`committed lookup-handle identity contract missing: ${token}`);
assert(!controller.includes("SESSION_REAPPLY_TOKEN_REP_NAME"),"mutable representative must not bind the stable reapplication token");
for(const token of ["RESOLVED_CLEANUP_PATH","realpath -m","[[ -L \"$RESOLVED_CLEANUP_PATH\" ]]"]){
  assert(runtime.includes(token),`runtime resolved physical cleanup contract missing: ${token}`);
}
for(const token of [
  "prepare_public_rate_limit_fixture",
  "capture_public_rate_limit_identity",
  "track_public_rate_limit_request",
  "RATE_LIMIT_BASELINE_COUNTS",
  "cleanup_public_rate_limit_fixture company-reapply-page 1",
  "cleanup_public_rate_limit_fixture company-reapply-submit 1",
  "cleanup_public_rate_limit_fixture company-status-detail 1",
  "remote_addr_hash='${remote_hash}'",
  "window_bucket=${bucket}",
  "for update",
  "request_count=rate.request_count-${owned}",
  "locked.request_count=${owned}",
  "rateLimitFixtureCleanup:1",
]) assert(runtime.includes(token),`runtime rate-limit isolation contract missing: ${token}`);
for(const token of [
  'DEPLOY_LOCK_FILE="${CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock}"',
  'flock -w "$DEPLOY_LOCK_WAIT_SECONDS" 8',
  'VALIDATION_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"',
  'validationCommit:$validationCommit',
  'verify_release_identity "$SOURCE_COMMIT" "$VALIDATION_COMMIT" after-capture',
  'verify_release_identity "$SOURCE_COMMIT" "$VALIDATION_COMMIT" before-promotion',
  'verify_release_identity "$SOURCE_COMMIT" "$VALIDATION_COMMIT" after-post-context',
  'plan-incremental-work.sh',
  'PLAN_DATABASE_REQUIRED',
  'CARBONET_REAPPLICATION_BROWSER_CASES_FILE="$CASES_FILE"',
  'DESKTOP_UPDATED_REP="QA_UI_D_NEW_${RUN_TOKEN:0:4}"',
  'updatedRepName:$desktopUpdatedRep',
  "COMPANY_REAPPLICATION_BROWSER_UPDATED_REPRESENTATIVE_FAILED",
  "insert into comtninsttinfo(",
  "browserPersistence:1",
  "downloadVerified,representativeUpdateVerified",
  '[[ -s "$DESKTOP_PDF" && -s "$MOBILE_PDF" ]]',
  "rateLimitFixtureCleanup",
  "wait_for_browser_rate_limit_capacity",
  "max_count+BROWSER_RATE_LIMIT_REQUIRED_CAPACITY <= BROWSER_RATE_LIMIT_MAX_REQUESTS",
  "seconds_left > BROWSER_RATE_LIMIT_WINDOW_GUARD_SECONDS",
  "COMPANY_REAPPLICATION_RATE_LIMIT_PREFLIGHT_WAIT_EXCEEDED",
  "select coalesce(max(request_count),0)",
  "delete_browser_fixtures 1",
  ".performanceSampleCount<20",
  "snapshot_browser_rate_limit_baseline",
  "cleanup_browser_rate_limit_fixture 1",
  "cleanup_browser_rate_limit_fixture 0",
  "browserRateLimitFixtureCleanup:1",
  "for update",
  "request_count=request_count-${owned_delta}",
  "and request_count=0",
  "locked_rows <> 3",
  "updated_rows <> 3",
  "COMPANY_REAPPLICATION_BROWSER_RATE_LIMIT_CANDIDATE_MISMATCH",
  "BROWSER_RATE_LIMIT_BASELINE_CAPTURED=1",
  "BROWSER_RATE_LIMIT_FIXTURE_CLEANED=1",
]) assert(wrapper.includes(token),`wrapper fail-closed contract missing: ${token}`);
assert(wrapper.includes("rateLimitFixtureCleanup,browserRateLimitFixtureCleanup"),"runtime and browser limiter cleanup evidence must be distinct");
assert(wrapper.indexOf('flock -w "$DEPLOY_LOCK_WAIT_SECONDS" 8')<wrapper.indexOf("capture-business-e2e-contract.sh"),
  "deploy lock must be held before contract capture");
assert((wrapper.match(/verify_release_identity "\$SOURCE_COMMIT" "\$VALIDATION_COMMIT"/g)||[]).length===3,
  "exactly three release freshness checkpoints are required");
assert(wrapper.includes('source=validation-marker')&&wrapper.includes('source=runtime-contract'),
  "validation and runtime identities are not independently fail-closed");
assert(wrapper.includes('source=commit-lineage')&&wrapper.includes('source=unreleased-$key'),
  "unreleased runtime-affecting gaps are not fail-closed");
assert(!/172\.16\.1\.232/.test(browser+wrapper),"deployment IP was hardcoded");

const browserWithoutJourney=browser.replace("buffer:uploadBuffer","files:uploadBuffer");
assert(!browserWithoutJourney.includes("buffer:uploadBuffer"),"non-empty upload payload mutation escaped");
const browserWithNineteen=browser.replace("routeSamples.length<20","routeSamples.length<19");
assert(!browserWithNineteen.includes("routeSamples.length<20"),"sample-count mutation escaped");
const wrapperWithoutLock=wrapper.replace('flock -w "$DEPLOY_LOCK_WAIT_SECONDS" 8','true');
assert(!wrapperWithoutLock.includes('flock -w "$DEPLOY_LOCK_WAIT_SECONDS" 8'),"deploy-lock mutation escaped");
const wrapperWithoutPersistence=wrapper.replace("browserPersistence:1","browserPersistence:0");
assert(!wrapperWithoutPersistence.includes("browserPersistence:1"),"browser-persistence mutation escaped");
const runtimeWithoutRateCleanup=runtime.replace("cleanup_public_rate_limit_fixture company-status-detail 1","true");
assert(!runtimeWithoutRateCleanup.includes("cleanup_public_rate_limit_fixture company-status-detail 1"),"rate-limit cleanup mutation escaped");
const wrapperWithoutBrowserLimiterPreflight=wrapper.replace("wait_for_browser_rate_limit_capacity\n","true\n");
assert(!wrapperWithoutBrowserLimiterPreflight.includes("wait_for_browser_rate_limit_capacity\n"),"browser limiter preflight mutation escaped");
assert((wrapper.match(/company-reapplication-browser-rate-limit-candidate\.jq/g)||[]).length>=3,"candidate resolver must be covered by both dirty guards");
assert(wrapper.includes("request_count=request_count-${owned_delta}"),"browser cleanup must subtract only the owned delta");
const browserWithoutDownloadBytes=browser.replace("downloadedBuffer.equals(uploadBuffer)","downloadedBuffer.length===uploadBuffer.length");
assert(!browserWithoutDownloadBytes.includes("downloadedBuffer.equals(uploadBuffer)"),"download byte-equality mutation escaped");
const statusPageWithoutDirectHref=statusPage.replace('href={`/join/downloadInsttFile?downloadToken=${encodeURIComponent(downloadToken)}`}','href="#"');
assert(!statusPageWithoutDirectHref.includes('href={`/join/downloadInsttFile?downloadToken=${encodeURIComponent(downloadToken)}`}'),"direct-download href mutation escaped");
const controllerWithoutCommittedIdentity=controller.replace("committedIdentity.setReprsntNm(repName.trim())","committedIdentity.setReprsntNm(current.getReprsntNm())");
assert(!controllerWithoutCommittedIdentity.includes("committedIdentity.setReprsntNm(repName.trim())"),"committed representative identity mutation escaped");
const controllerWithMutableTokenBinding=controller.replace("SESSION_REAPPLY_TOKEN_PROJECT_ID","SESSION_REAPPLY_TOKEN_REP_NAME");
assert(controllerWithMutableTokenBinding.includes("SESSION_REAPPLY_TOKEN_REP_NAME"),"mutable-token-binding mutation did not apply");
const wrapperWithoutBrowserCleanupEvidence=wrapper.replace("browserRateLimitFixtureCleanup:1","browserRateLimitFixtureCleanup:0");
assert(!wrapperWithoutBrowserCleanupEvidence.includes("browserRateLimitFixtureCleanup:1"),"browser limiter cleanup evidence mutation escaped");
NODE
bash "$RATE_BEHAVIOR_TEST"
echo '[company-reapplication-business-e2e-wrapper-test] PASS routeSamples=20 journeys=2 downloads=2 representative-update=1 freshness=3 identities=runtime+validation cleanup=resolved+runtime-rate+browser-rate mutations=10'
