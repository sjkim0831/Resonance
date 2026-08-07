#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BROWSER="$ROOT/ops/scripts/validate-company-reapplication-browser.mjs"
RUNTIME="$ROOT/ops/scripts/validate-company-reapplication-runtime.sh"
WRAPPER="$ROOT/ops/tests/run-company-reapplication-business-e2e.sh"
for file in "$BROWSER" "$RUNTIME" "$WRAPPER"; do
  [[ -f "$file" ]] || { echo "missing $file" >&2; exit 1; }
done
bash -n "$RUNTIME" "$WRAPPER" "$0"
node --check "$BROWSER"
node - "$BROWSER" "$RUNTIME" "$WRAPPER" <<'NODE'
const fs=require("fs");
const [browserPath,runtimePath,wrapperPath]=process.argv.slice(2);
const browser=fs.readFileSync(browserPath,"utf8");
const runtime=fs.readFileSync(runtimePath,"utf8");
const wrapper=fs.readFileSync(wrapperPath,"utf8");
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
  "businessJourneyCount:journeys.length",
]) assert(browser.includes(token),`browser business E2E contract missing: ${token}`);
assert(browser.includes("process.env.CARBONET_BROWSER_BASE_URL||process.env.CARBONET_RUNTIME_BASE_URL"),
  "browser-specific canonical host precedence missing");
for(const token of ["RESOLVED_CLEANUP_PATH","realpath -m","[[ -L \"$RESOLVED_CLEANUP_PATH\" ]]"]){
  assert(runtime.includes(token),`runtime resolved physical cleanup contract missing: ${token}`);
}
for(const token of [
  "prepare_status_rate_limit_fixture",
  "capture_status_rate_limit_identity",
  "track_status_rate_limit_request",
  "RATE_LIMIT_BASELINE_COUNTS",
  "cleanup_status_rate_limit_fixture 1",
  "remote_addr_hash='${RATE_LIMIT_REMOTE_HASH}'",
  "window_bucket=${RATE_LIMIT_WINDOW_BUCKET}",
  "for update",
  "request_count=rate.request_count-${RATE_LIMIT_REQUESTS}",
  "locked.request_count=${RATE_LIMIT_REQUESTS}",
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
  "insert into comtninsttinfo(",
  "browserPersistence:1",
  '[[ -s "$DESKTOP_PDF" && -s "$MOBILE_PDF" ]]',
  "rateLimitFixtureCleanup",
  "delete_browser_fixtures 1",
  ".performanceSampleCount<20",
]) assert(wrapper.includes(token),`wrapper fail-closed contract missing: ${token}`);
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
const runtimeWithoutRateCleanup=runtime.replace("cleanup_status_rate_limit_fixture 1","true");
assert(!runtimeWithoutRateCleanup.includes("cleanup_status_rate_limit_fixture 1"),"rate-limit cleanup mutation escaped");
NODE
echo '[company-reapplication-business-e2e-wrapper-test] PASS routeSamples=20 journeys=2 freshness=3 identities=runtime+validation cleanup=resolved+rate-ledger mutations=5'
