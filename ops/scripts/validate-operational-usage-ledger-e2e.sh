#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash ops/scripts/validate-operational-usage-ledger-e2e.sh [root] [expected-commit] [base-url]
  bash ops/scripts/validate-operational-usage-ledger-e2e.sh --self-test

Runs only against an already-published healthy runtime release. It verifies the
ordered operational usage ledger API, an exact full step detail, secret
redaction, an APPROVED human-review round trip with exact cleanup, authorization
denials, and desktop/mobile browser geometry. It does not execute business
commands or create a CHANGE_REQUESTED development job.
EOF
}

fail() {
  printf '[operational-usage-ledger-e2e] FAIL: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '[operational-usage-ledger-e2e] %s\n' "$*"
}

assert_local_mutations() {
  node <<'NODE'
const rows = [
  { domainOrder: 1, workflowOrder: 1, processCode: "A", stepOrder: 1, stepCode: "A_1" },
  { domainOrder: 1, workflowOrder: 1, processCode: "A", stepOrder: 2, stepCode: "A_2A" },
  { domainOrder: 1, workflowOrder: 1, processCode: "A", stepOrder: 2, stepCode: "A_2B" },
  { domainOrder: 2, workflowOrder: 1, processCode: "B", stepOrder: 1, stepCode: "B_1" },
];
const key = (row) => [Number(row.domainOrder), Number(row.workflowOrder), String(row.processCode), Number(row.stepOrder), String(row.stepCode)];
const compare = (left, right) => {
  for (let index = 0; index < 5; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
};
if (rows.some((row, index) => index > 0 && compare(key(rows[index - 1]), key(row)) > 0)) {
  throw new Error("valid order rejected");
}
const orderMutation = [...rows];
[orderMutation[0], orderMutation[1]] = [orderMutation[1], orderMutation[0]];
if (!orderMutation.some((row, index) => index > 0 && compare(key(orderMutation[index - 1]), key(row)) > 0)) {
  throw new Error("order regression mutation survived");
}
const stepCodeTieMutation = [...rows];
[stepCodeTieMutation[1], stepCodeTieMutation[2]] = [stepCodeTieMutation[2], stepCodeTieMutation[1]];
if (!stepCodeTieMutation.some((row, index) => index > 0 && compare(key(stepCodeTieMutation[index - 1]), key(row)) > 0)) {
  throw new Error("stepCode tie-order regression mutation survived");
}
const secretFragments = ["password", "passwd", "pwd", "accesstoken", "refreshtoken", "token", "authorization", "cookie", "secret", "otp", "proof", "developmentcode", "verificationcode", "apikey", "privatekey", "credential", "sessionid", "csrf", "jwt"];
const assertRedacted = (value) => {
  if (Array.isArray(value)) return value.forEach(assertRedacted);
  if (!value || typeof value !== "object") return;
  for (const [field, nested] of Object.entries(value)) {
    const normalized = field.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    if (secretFragments.some((fragment) => normalized.includes(fragment)) && nested !== "[REDACTED]") {
      throw new Error(`unredacted secret field ${field}`);
    }
    assertRedacted(nested);
  }
};
assertRedacted({ password: "[REDACTED]", safeCode: "A_1" });
let mutationCaught = false;
try { assertRedacted({ nested: { accessToken: "mutation-leak" } }); } catch { mutationCaught = true; }
if (!mutationCaught) throw new Error("secret mutation survived");
let extendedSecretMutationsCaught = 0;
for (const [field, value] of Object.entries({ apiKey: "api-key-leak", credential: "credential-leak", privateKey: "private-key-leak", sessionId: "session-id-leak", developmentCode: "development-code-leak", verificationCode: "verification-code-leak" })) {
  try { assertRedacted({ nested: { [field]: value } }); } catch { extendedSecretMutationsCaught += 1; }
}
if (extendedSecretMutationsCaught !== 6) throw new Error("extended secret mutation survived");
const assertBranchTruth = (branch) => {
  for (const field of ["edgeActorCode", "targetActorCode", "userRoutePath", "adminRoutePath", "routePath", "routeResolution", "screenRouteInventory", "authoritative"]) {
    if (!Object.prototype.hasOwnProperty.call(branch, field)) throw new Error(`branch truth field missing ${field}`);
  }
  if (Object.prototype.hasOwnProperty.call(branch, "actorCode")) throw new Error("ambiguous branch actorCode survived");
  if (!["MISSING", "MULTIPLE_CANDIDATES", "SINGLE"].includes(branch.routeResolution)) throw new Error("invalid route resolution");
  if (!Array.isArray(branch.screenRouteInventory) || branch.authoritative !== true) throw new Error("branch inventory or authority is invalid");
  const user = String(branch.userRoutePath || "").trim();
  const admin = String(branch.adminRoutePath || "").trim();
  const expected = !user && !admin ? "MISSING" : user && admin && user !== admin ? "MULTIPLE_CANDIDATES" : "SINGLE";
  if (branch.routeResolution !== expected) throw new Error("branch route truth is inconsistent");
  if (expected === "MULTIPLE_CANDIDATES" && branch.routePath != null) throw new Error("dual route was collapsed into one route");
};
assertBranchTruth({ edgeActorCode: "EDGE", targetActorCode: "TARGET", userRoutePath: "/user", adminRoutePath: "/admin", routePath: null, routeResolution: "MULTIPLE_CANDIDATES", screenRouteInventory: [{ audience: "USER", entryMode: "PRIMARY", screenResourceId: 1, routePath: "/user" }], authoritative: true });
let branchMutationCaught = false;
try { assertBranchTruth({ actorCode: "AMBIGUOUS", edgeActorCode: "EDGE", targetActorCode: "TARGET", userRoutePath: "/user", adminRoutePath: "/admin", routePath: "/user", routeResolution: "SINGLE", screenRouteInventory: [], authoritative: true }); } catch { branchMutationCaught = true; }
if (!branchMutationCaught) throw new Error("branch truth mutation survived");
process.stdout.write("[operational-usage-ledger-e2e] self-test PASS mutations=4 secretLeakMutations=7\n");
NODE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then usage; exit 0; fi
if [[ "${1:-}" == "--self-test" ]]; then assert_local_mutations; exit 0; fi

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
EXPECTED_COMMIT="${2:-$(git -C "$ROOT" rev-parse HEAD)}"
SOURCE_COMMIT="${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-$EXPECTED_COMMIT}"
EVIDENCE_MODE="${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-legacy}"
cd "$ROOT"

# shellcheck source=ops/scripts/runtime-url-common.sh
source "$ROOT/ops/scripts/runtime-url-common.sh"
# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"

BASE_URL="${3:-$(carbonet_runtime_base_url)}"
BASE_URL="${BASE_URL%/}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
DATABASE_USER="${POSTGRES_ADMIN_USER:-postgres}"
PAGE_SIZE=50
TMP_DIR="$(mktemp -d /tmp/operational-usage-ledger-e2e.XXXXXX)"
COOKIE_JAR="$TMP_DIR/master.cookies"
ORDINARY_COOKIE_JAR="$TMP_DIR/ordinary.cookies"
ORDER_FILE="$TMP_DIR/order.tsv"
IDS_FILE="$TMP_DIR/ids.txt"
REVIEW_KEY="usage-ledger-e2e-$(date +%Y%m%d%H%M%S)-$$-${RANDOM}"
REVIEW_NOTE="Operational usage ledger postdeploy ownership ${REVIEW_KEY}"
REVIEW_CREATED=0
POSTGRES_LEADER="${RESONANCE_POSTGRES_LEADER_POD:-}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

for command_name in curl jq node kubectl git awk sort uniq; do require_cmd "$command_name"; done
[[ "$EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "expected commit must be a 40-character lowercase Git SHA"
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "candidate source commit must be a 40-character lowercase Git SHA"
[[ "$EVIDENCE_MODE" != candidate || "$SOURCE_COMMIT" == "$EXPECTED_COMMIT" ]] \
  || fail "candidate source commit does not match expected runtime commit"
[[ "$REVIEW_KEY" =~ ^[A-Za-z0-9._:-]+$ ]] || fail "generated review ownership key is unsafe"

resolve_postgres_leader() {
  local pod recovery
  if [[ -n "$POSTGRES_LEADER" ]]; then return 0; fi
  while IFS= read -r pod; do
    [[ -n "$pod" ]] || continue
    recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- \
      psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
    if [[ "$recovery" == "f" ]]; then POSTGRES_LEADER="$pod"; return 0; fi
  done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}')
  fail "PostgreSQL leader is unavailable"
}

db_scalar() {
  kubectl -n "$NAMESPACE" exec "$POSTGRES_LEADER" -c patroni -- \
    psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -v ON_ERROR_STOP=1 -Atqc "$1"
}

cleanup_owned_review() {
  local count ownership deleted after
  [[ -n "$POSTGRES_LEADER" ]] || return 0
  count="$(db_scalar "select count(*) from framework_system_usage_review where idempotency_key='${REVIEW_KEY}'" 2>/dev/null || true)"
  [[ "$count" =~ ^[0-9]+$ ]] || return 1
  if [[ "$count" == "0" ]]; then REVIEW_CREATED=0; return 0; fi
  ownership="$(db_scalar "select count(*) from framework_system_usage_review where idempotency_key='${REVIEW_KEY}' and review_status='APPROVED' and review_note='${REVIEW_NOTE}' and linked_job_id is null" 2>/dev/null || true)"
  if [[ "$count" != "1" || "$ownership" != "1" ]]; then
    printf '[operational-usage-ledger-e2e] REFUSING CLEANUP: ownership mismatch count=%s owned=%s\n' "$count" "$ownership" >&2
    return 1
  fi
  deleted="$(db_scalar "with deleted as (delete from framework_system_usage_review where idempotency_key='${REVIEW_KEY}' and review_status='APPROVED' and review_note='${REVIEW_NOTE}' and linked_job_id is null returning review_id) select count(*) from deleted" 2>/dev/null || true)"
  after="$(db_scalar "select count(*) from framework_system_usage_review where idempotency_key='${REVIEW_KEY}'" 2>/dev/null || true)"
  [[ "$deleted" == "1" && "$after" == "0" ]] || return 1
  REVIEW_CREATED=0
}

finalize() {
  local original_status=$? cleanup_status=0 logout_status=0
  trap - EXIT INT TERM
  set +e
  cleanup_owned_review || cleanup_status=$?
  if [[ "${CARBONET_QA_AUTH_SESSION_ACTIVE:-}" == "1" ]]; then
    if [[ -f "$ORDINARY_COOKIE_JAR" ]]; then carbonet_qa_logout "$ORDINARY_COOKIE_JAR" "$BASE_URL" || logout_status=$?;
    else carbonet_qa_logout "$COOKIE_JAR" "$BASE_URL" || logout_status=$?; fi
  fi
  rm -rf "$TMP_DIR"
  if (( original_status == 0 && (cleanup_status != 0 || logout_status != 0) )); then original_status=1; fi
  exit "$original_status"
}
trap finalize EXIT INT TERM

api_status() {
  local output_file="$1" method="$2" path="$3" body_file="${4:-}" status
  if [[ "$method" == "GET" ]]; then
    status="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      -o "$output_file" -w '%{http_code}' "$BASE_URL$path")" || status=000
  else
    status="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      -H 'Content-Type: application/json' -X "$method" --data-binary "@$body_file" \
      -o "$output_file" -w '%{http_code}' "$BASE_URL$path")" || status=000
  fi
  printf '%s\n' "$status"
}

anonymous_api_status() {
  local output_file="$1" method="$2" path="$3" body_file="${4:-}" status
  if [[ "$method" == "GET" ]]; then
    status="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -o "$output_file" -w '%{http_code}' "$BASE_URL$path")" || status=000
  else
    status="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -H 'Content-Type: application/json' -X "$method" \
      --data-binary "@$body_file" -o "$output_file" -w '%{http_code}' "$BASE_URL$path")" || status=000
  fi
  printf '%s\n' "$status"
}

assert_redacted_detail() {
  local detail_file="$1"
  node - "$detail_file" <<'NODE'
const fs = require("node:fs");
const detail = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (detail.success !== true || detail.detailMode !== "SELECTED_STEP_FULL" || detail.reviewCriticalFieldsComplete !== true) {
  throw new Error("exact step detail envelope is incomplete");
}
const item = detail.item;
if (!item || item.reviewAllowed !== true || item.reviewCriticalFieldsComplete !== true) {
  throw new Error("exact step detail is not review-authoritative");
}
const inventory = JSON.parse(String(item.screenFunctionInventoryJson || "[]"));
if (!Array.isArray(inventory) || inventory.length < 1 || inventory.some((entry) => !entry.screenResourceId || !entry.routePath || !entry.capabilityCode)) {
  throw new Error("full screen/function inventory is missing");
}
const destinations = JSON.parse(String(item.nextDestinationsJson || "[]"));
if (!Array.isArray(destinations)) throw new Error("next destination inventory must be an array");
for (const branch of destinations) {
  for (const field of ["edgeActorCode", "targetActorCode", "userRoutePath", "adminRoutePath", "routePath", "routeResolution", "screenRouteInventory", "authoritative"]) {
    if (!Object.prototype.hasOwnProperty.call(branch, field)) throw new Error(`branch truth field missing ${field}`);
  }
  if (Object.prototype.hasOwnProperty.call(branch, "actorCode")) throw new Error("ambiguous branch actorCode is forbidden");
  if (!["MISSING", "MULTIPLE_CANDIDATES", "SINGLE"].includes(branch.routeResolution)) throw new Error("invalid branch routeResolution");
  if (!Array.isArray(branch.screenRouteInventory) || branch.authoritative !== true) throw new Error("branch inventory or authority is invalid");
  const user = String(branch.userRoutePath || "").trim();
  const admin = String(branch.adminRoutePath || "").trim();
  const expected = !user && !admin ? "MISSING" : user && admin && user !== admin ? "MULTIPLE_CANDIDATES" : "SINGLE";
  if (branch.routeResolution !== expected) throw new Error("branch route truth is inconsistent");
  if (expected === "MULTIPLE_CANDIDATES" && branch.routePath != null) throw new Error("dual branch route must remain unresolved");
}
const evidenceFields = ["actualInput", "actualOutput", "actualEvidenceJson", "latestPreInputJson", "latestEvidenceJson", "latestInput", "latestOutput", "evidenceJson", "simulationEvidenceJson", "businessEvidenceJson", "fixtureSuiteCasesJson", "screenFunctionInventoryJson", "scopedReviewInventoryJson", "reviewScopesJson", "nextDestinationsJson"];
const secretFragments = ["password", "passwd", "pwd", "accesstoken", "refreshtoken", "token", "authorization", "cookie", "secret", "otp", "proof", "developmentcode", "verificationcode", "apikey", "privatekey", "credential", "sessionid", "csrf", "jwt"];
function assertRedacted(value) {
  if (Array.isArray(value)) return value.forEach(assertRedacted);
  if (!value || typeof value !== "object") return;
  for (const [field, nested] of Object.entries(value)) {
    const normalized = field.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    if (secretFragments.some((fragment) => normalized.includes(fragment)) && nested !== "[REDACTED]") {
      throw new Error(`unredacted secret field ${field}`);
    }
    assertRedacted(nested);
  }
}
for (const field of evidenceFields) {
  if (item[field] == null || item[field] === "") continue;
  const parsed = typeof item[field] === "string" ? JSON.parse(item[field]) : item[field];
  if (parsed && parsed.omitted === true) throw new Error(`exact detail field ${field} was compacted`);
  assertRedacted(parsed);
}
const mutation = JSON.parse(JSON.stringify(item));
mutation.actualInput = JSON.stringify({ nested: { password: "postdeploy-mutation-leak" } });
let mutationCaught = false;
try { assertRedacted(JSON.parse(mutation.actualInput)); } catch { mutationCaught = true; }
if (!mutationCaught) throw new Error("redaction mutation survived");
let extendedSecretMutationsCaught = 0;
for (const [field, value] of Object.entries({ apiKey: "api-key-leak", credential: "credential-leak", privateKey: "private-key-leak", sessionId: "session-id-leak", developmentCode: "development-code-leak", verificationCode: "verification-code-leak" })) {
  try { assertRedacted({ nested: { [field]: value } }); } catch { extendedSecretMutationsCaught += 1; }
}
if (extendedSecretMutationsCaught !== 6) throw new Error("extended redaction mutation survived");
process.stdout.write(`[operational-usage-ledger-e2e] detail PASS inventory=${inventory.length} redactionMutation=CAUGHT extendedSecretMutations=6 branchDestinations=${destinations.length}\n`);
NODE
}

run_browser_contract() {
  local cookie_file="$1"
  CARBONET_USAGE_LEDGER_COOKIE_JAR="$cookie_file" \
  CARBONET_USAGE_LEDGER_BASE_URL="$BASE_URL" \
  CARBONET_USAGE_LEDGER_HELP_SELECTORS_FILE="$HELP_SELECTORS_FILE" \
  RESONANCE_ROOT="$ROOT" \
  node <<'NODE'
const { createRequire } = require("node:module");
const { readFileSync } = require("node:fs");
const path = require("node:path");
(async () => {
const root = process.env.RESONANCE_ROOT;
const requireFromFrontend = createRequire(path.join(root, "projects/carbonet-frontend/source/package.json"));
const { chromium } = requireFromFrontend("@playwright/test");
const base = process.env.CARBONET_USAGE_LEDGER_BASE_URL.replace(/\/$/, "");
const cookieJar = process.env.CARBONET_USAGE_LEDGER_COOKIE_JAR;
const helpSelectors = readFileSync(process.env.CARBONET_USAGE_LEDGER_HELP_SELECTORS_FILE, "utf8").split(/\r?\n/).filter(Boolean);
if (helpSelectors.length !== 5 || new Set(helpSelectors).size !== 5) throw new Error("five unique DB help selectors are required");
const cookies = readFileSync(cookieJar, "utf8").split(/\r?\n/).flatMap((line) => {
  const httpOnly = line.startsWith("#HttpOnly_");
  if (!line || (line.startsWith("#") && !httpOnly)) return [];
  const fields = (httpOnly ? line.slice("#HttpOnly_".length) : line).split("\t");
  if (fields.length < 7) return [];
  const [domain, , cookiePath, secure, expires, name, ...valueParts] = fields;
  return [{ name, value: valueParts.join("\t"), domain, path: cookiePath || "/", httpOnly, secure: secure === "TRUE", expires: Number(expires) > 0 ? Number(expires) : -1 }];
});
if (!cookies.length) throw new Error("authenticated browser cookie state is unavailable");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const results = [];
try {
  for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
    await context.addCookies(cookies);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(`${base}/admin/system/actor-process?tab=system-test-report`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.getByTestId("operational-usage-verification-ledger").waitFor({ state: "visible", timeout: 30000 });
    await page.getByRole("heading", { name: /실사용 검수 대장/ }).waitFor({ state: "visible", timeout: 30000 });
    const firstDetailButton = page.getByRole("button", { name: /상세 보기/ }).first();
    await firstDetailButton.waitFor({ state: "visible", timeout: 90000 });
    await firstDetailButton.evaluate(button => button.click());
    const reviewEditor = page.getByTestId("operational-review-editor").first();
    await reviewEditor.waitFor({ state: "visible", timeout: 30000 });
    await reviewEditor.locator("select").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(() => {
      const editor = document.querySelector('[data-testid="operational-review-editor"]');
      const select = editor?.querySelector("select");
      return Boolean(select && !select.disabled && select.options.length > 1);
    }, { timeout: 30000 });
    const state = await page.evaluate((requiredHelpSelectors) => {
      const scroll = document.querySelector(".report-table-scroll");
      const reviewSelect = document.querySelector('[data-testid="operational-review-editor"] select');
      return {
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
        tableHorizontalScroll: Boolean(scroll && scroll.scrollWidth > scroll.clientWidth + 2),
        helpAnchorCount: requiredHelpSelectors.filter((selector) => document.querySelector(selector)).length,
        tableCount: document.querySelectorAll('[data-help-id="usage-ledger-table"] table').length,
        reviewScopeOptionCount: reviewSelect ? reviewSelect.options.length : 0,
        reviewScopeEnabled: Boolean(reviewSelect && !reviewSelect.disabled),
      };
    }, helpSelectors);
    if ((response?.status() || 0) >= 400 || errors.length || state.pageOverflow || !state.tableHorizontalScroll || state.helpAnchorCount !== 5 || state.tableCount !== 1 || !state.reviewScopeEnabled || state.reviewScopeOptionCount < 2) {
      throw new Error(`${viewport.name} browser contract failed ${JSON.stringify({ status: response?.status() || 0, errors: errors.length, ...state })}`);
    }
    results.push({ viewport: viewport.name, mount: 1, pageOverflow: 0, tableHorizontalScroll: 1, helpAnchors: 5, reviewScopeSelector: 1 });
    await context.close();
  }
} finally {
  await browser.close();
}
process.stdout.write(`[operational-usage-ledger-e2e] browser PASS ${JSON.stringify(results)}\n`);
})().catch((error) => {
  process.stderr.write(`[operational-usage-ledger-e2e] browser FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
NODE
}

started_at="$(date +%s)"
resolve_postgres_leader
carbonet_set_curl_args

health="$(curl "${CARBONET_CURL_ARGS[@]}" -fsS --max-time 10 "$BASE_URL/actuator/health" || true)"
[[ "$health" == *'"status":"UP"'* ]] || fail "runtime health is not UP"
table_name="$(db_scalar "select to_regclass('public.framework_system_usage_review')::text")"
[[ "$table_name" == "framework_system_usage_review" ]] || fail "review ledger migration is not deployed"
runtime_commit="$(db_scalar "select source_commit from framework_runtime_release_state where release_key='CARBONET_RUNTIME' and health_status='UP'")"
[[ "$runtime_commit" == "$EXPECTED_COMMIT" ]] || fail "healthy runtime release does not match expected commit"

TOTAL_STEPS="$(db_scalar "select count(*) from framework_process_definition p join framework_process_step s using(process_code)")"
[[ "$TOTAL_STEPS" =~ ^[1-9][0-9]*$ ]] || fail "current structural step total is invalid"
HELP_SELECTORS_FILE="$TMP_DIR/help-selectors.txt"
db_scalar "select anchor_selector from ui_help_item where page_id='actor-process-governance' and active_yn='Y' order by display_order,item_id" > "$HELP_SELECTORS_FILE"
mapfile -t HELP_SELECTORS < <(sed '/^[[:space:]]*$/d' "$HELP_SELECTORS_FILE")
[[ "${#HELP_SELECTORS[@]}" == "5" ]] || fail "DB must publish exactly five active usage-ledger help selectors"
[[ "$(sort -u "$HELP_SELECTORS_FILE" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')" == "5" ]] || fail "DB help selectors must be unique"
for help_selector in "${HELP_SELECTORS[@]}"; do
  [[ "$help_selector" =~ ^\[data-help-id=\"[A-Za-z0-9-]+\"\]$ ]] || fail "DB help selector is outside the safe data-help-id contract"
done

export CARBONET_QA_AUTH_SECRET="${CARBONET_USAGE_LEDGER_ALLOWED_AUTH_SECRET:-carbonet-usage-ledger-system-admin}"
unset CARBONET_QA_AUTH_USER CARBONET_QA_AUTH_PASSWORD CARBONET_ACTOR_TEST_PASSWORD
carbonet_qa_login "$COOKIE_JAR" "$BASE_URL" || fail "isolated system administrator login failed"
session_file="$TMP_DIR/master-session.json"
status="$(api_status "$session_file" GET '/api/frontend/session')"
[[ "$status" == "200" ]] || fail "administrator session probe failed (http=$status)"
jq -e --arg user "$CARBONET_QA_AUTH_EFFECTIVE_USER" '.authenticated==true and ((.actualUserId // .userId // "")|ascii_downcase)==($user|ascii_downcase) and ((.authorCode // "") as $role | ($role=="ROLE_SYSTEM_MASTER" or $role=="ROLE_SYSTEM_ADMIN"))' "$session_file" >/dev/null \
  || fail "allowed QA account is not SYSTEM_MASTER or SYSTEM_ADMIN"

page_count=$(( (TOTAL_STEPS + PAGE_SIZE - 1) / PAGE_SIZE ))
: > "$ORDER_FILE"; : > "$IDS_FILE"
for ((page=0; page<page_count; page+=1)); do
  page_file="$TMP_DIR/page-${page}.json"
  status="$(api_status "$page_file" GET "/admin/api/system/actor-process/system-test-report?compact=true&page=${page}&size=${PAGE_SIZE}")"
  [[ "$status" == "200" ]] || fail "compact page ${page} failed (http=$status)"
  expected_count=$(( TOTAL_STEPS - page * PAGE_SIZE )); (( expected_count > PAGE_SIZE )) && expected_count=$PAGE_SIZE
  jq -e --argjson page "$page" --argjson size "$PAGE_SIZE" --argjson total "$TOTAL_STEPS" --argjson returned "$expected_count" '
    .success==true and .compact==true and .auditMode=="CONTRACT_ONLY" and .businessFunctionsExecuted==false and
    .pagination.page==$page and .pagination.size==$size and .pagination.totalStepCount==$total and
    .pagination.returnedItemCount==$returned and (.items|length)==$returned and
    .orderContract.fields==["domainOrder","workflowOrder","processCode","stepOrder","stepCode"] and .orderContract.direction=="ASC" and
    ([.items[].reviewAllowed]|all(.==false)) and ([.items[].reviewCriticalFieldsComplete]|all(.==false))
  ' "$page_file" >/dev/null || fail "compact page ${page} contract mismatch"
  jq -r '.items[] | [.domainOrder,.workflowOrder,.processCode,.stepOrder,.stepCode] | @tsv' "$page_file" >> "$ORDER_FILE"
  jq -r '.items[] | [.processCode,.stepCode] | join("|")' "$page_file" >> "$IDS_FILE"
done

[[ "$(wc -l < "$IDS_FILE" | tr -d ' ')" == "$TOTAL_STEPS" ]] || fail "pagination did not return every current step"
[[ "$(sort -u "$IDS_FILE" | wc -l | tr -d ' ')" == "$TOTAL_STEPS" ]] || fail "pagination returned a duplicate process/step"
awk -F '\t' '
  function regressed() {
    if ($1 != pd) return $1 < pd
    if ($2 != pw) return $2 < pw
    if ($3 != pp) return $3 < pp
    if ($4 != ps) return $4 < ps
    return $5 < pc
  }
  NF!=5 || $1!~/^[0-9]+$/ || $2!~/^[0-9]+$/ || $3=="" || $4!~/^[0-9]+$/ || $5=="" { exit 2 }
  NR>1 && regressed() { exit 3 }
  { pd=$1; pw=$2; pp=$3; ps=$4; pc=$5 }
' "$ORDER_FILE" || fail "global 5-key WORK_TYPE_PROCESS_STEP order regressed across pages"
db_total_after="$(db_scalar "select count(*) from framework_process_definition p join framework_process_step s using(process_code)")"
[[ "$db_total_after" == "$TOTAL_STEPS" ]] || fail "structural catalogue changed during pagination; retry after design writes settle"
info "pagination PASS totalSteps=${TOTAL_STEPS} pages=${page_count} pageSize=${PAGE_SIZE} duplicates=0 orderRegressions=0"

selected="$(for ((page=0; page<page_count; page+=1)); do jq -r '.items[] | select((.screenCount // 0)>0) | [.processCode,.stepCode] | @tsv' "$TMP_DIR/page-${page}.json"; done | sed -n '1p')"
IFS=$'\t' read -r SELECTED_PROCESS SELECTED_STEP <<< "$selected"
[[ "$SELECTED_PROCESS" =~ ^[A-Z0-9_:-]+$ && "$SELECTED_STEP" =~ ^[A-Z0-9_:-]+$ ]] || fail "no safe reviewable step was found"
detail_file="$TMP_DIR/detail.json"
status="$(api_status "$detail_file" GET "/admin/api/system/actor-process/system-test-report/step-detail?processCode=${SELECTED_PROCESS}&stepCode=${SELECTED_STEP}")"
[[ "$status" == "200" ]] || fail "exact step detail failed (http=$status)"
assert_redacted_detail "$detail_file"

before_count="$(db_scalar "select count(*) from framework_system_usage_review where idempotency_key='${REVIEW_KEY}'")"
[[ "$before_count" == "0" ]] || fail "review ownership key already exists before test"
review_body="$TMP_DIR/review.json"
jq -n --arg process "$SELECTED_PROCESS" --arg step "$SELECTED_STEP" --arg key "$REVIEW_KEY" --arg note "$REVIEW_NOTE" \
  '{processCode:$process,stepCode:$step,capabilityCode:"ALL",reviewStatus:"APPROVED",reviewNote:$note,idempotencyKey:$key}' > "$review_body"
review_one="$TMP_DIR/review-one.json"
status="$(api_status "$review_one" POST '/admin/api/system/actor-process/system-test-report/reviews' "$review_body")"
[[ "$status" == "200" ]] || fail "APPROVED review create failed (http=$status)"
jq -e '.success==true and .review.reviewStatus=="APPROVED" and .review.reviewEvidenceScope=="HUMAN_REVIEW_ONLY" and .review.idempotent==false and .review.linkedJobId==null and .review.reviewCurrentVersion==true' "$review_one" >/dev/null \
  || fail "created review response contract mismatch"
REVIEW_CREATED=1
review_id="$(jq -r '.review.reviewId' "$review_one")"
[[ "$review_id" =~ ^[1-9][0-9]*$ ]] || fail "created review id is invalid"
persisted="$(db_scalar "select count(*) from framework_system_usage_review where review_id=${review_id} and idempotency_key='${REVIEW_KEY}' and process_code='${SELECTED_PROCESS}' and step_code='${SELECTED_STEP}' and review_status='APPROVED' and linked_job_id is null")"
[[ "$persisted" == "1" ]] || fail "review row did not persist with exact ownership"

review_two="$TMP_DIR/review-two.json"
status="$(api_status "$review_two" POST '/admin/api/system/actor-process/system-test-report/reviews' "$review_body")"
[[ "$status" == "200" ]] || fail "APPROVED review idempotent reload failed (http=$status)"
jq -e --argjson reviewId "$review_id" '.success==true and .review.reviewId==$reviewId and .review.idempotent==true and .review.linkedJobId==null' "$review_two" >/dev/null \
  || fail "review idempotency contract mismatch"
[[ "$(db_scalar "select count(*) from framework_system_usage_review where idempotency_key='${REVIEW_KEY}'")" == "1" ]] || fail "idempotent retry created a duplicate row"

review_mismatch_body="$TMP_DIR/review-mismatch.json"
jq -n --arg process "$SELECTED_PROCESS" --arg step "$SELECTED_STEP" --arg key "$REVIEW_KEY" --arg note "${REVIEW_NOTE} mismatched-payload" \
  '{processCode:$process,stepCode:$step,capabilityCode:"ALL",reviewStatus:"APPROVED",reviewNote:$note,idempotencyKey:$key}' > "$review_mismatch_body"
review_mismatch="$TMP_DIR/review-mismatch-response.json"
status="$(api_status "$review_mismatch" POST '/admin/api/system/actor-process/system-test-report/reviews' "$review_mismatch_body")"
[[ "$status" == "409" ]] || fail "mismatched idempotency payload was not rejected (http=$status)"
jq -e '.success==false and .message=="IDEMPOTENCY_KEY_REUSE_MISMATCH"' "$review_mismatch" >/dev/null \
  || fail "idempotency mismatch response contract mismatch"
persisted_after_mismatch="$(db_scalar "select count(*) from framework_system_usage_review where review_id=${review_id} and idempotency_key='${REVIEW_KEY}' and review_note='${REVIEW_NOTE}' and review_status='APPROVED' and linked_job_id is null")"
[[ "$persisted_after_mismatch" == "1" ]] || fail "idempotency mismatch mutated or duplicated the owned review"
[[ "$(db_scalar "select count(*) from framework_system_usage_review where idempotency_key='${REVIEW_KEY}'")" == "1" ]] || fail "idempotency mismatch changed review row cardinality"

detail_after_review="$TMP_DIR/detail-after-review.json"
status="$(api_status "$detail_after_review" GET "/admin/api/system/actor-process/system-test-report/step-detail?processCode=${SELECTED_PROCESS}&stepCode=${SELECTED_STEP}")"
[[ "$status" == "200" ]] || fail "review reload detail failed (http=$status)"
jq -e --argjson reviewId "$review_id" '.item.reviewId==$reviewId and .item.reviewStatus=="APPROVED" and .item.reviewCurrentVersion==true and .item.reviewEvidenceScope=="HUMAN_REVIEW_ONLY"' "$detail_after_review" >/dev/null \
  || fail "saved review did not reload on exact step detail"

cleanup_owned_review || fail "exact review cleanup failed"
[[ "$(db_scalar "select count(*) from framework_system_usage_review where idempotency_key='${REVIEW_KEY}'")" == "0" ]] || fail "review cleanup after-count is not zero"
info "review PASS before=0 persisted=1 idempotent=1 mismatch409=1 rowsAfterMismatch=1 linkedJobs=0 after=0"

run_browser_contract "$COOKIE_JAR"
carbonet_qa_logout "$COOKIE_JAR" "$BASE_URL" || fail "system administrator logout failed"

anonymous_review_body="$TMP_DIR/anonymous-review.json"
jq -n --arg process "$SELECTED_PROCESS" --arg step "$SELECTED_STEP" --arg key "${REVIEW_KEY}-anonymous" \
  '{processCode:$process,stepCode:$step,capabilityCode:"ALL",reviewStatus:"APPROVED",reviewNote:"anonymous denial probe",idempotencyKey:$key}' > "$anonymous_review_body"
anonymous_index=0
for spec in \
  'GET|/admin/api/system/actor-process/system-test-report?compact=true&page=0&size=1|' \
  "POST|/admin/api/system/actor-process/system-test-report/reviews|${anonymous_review_body}"; do
  IFS='|' read -r method path body_file <<< "$spec"
  anonymous_file="$TMP_DIR/anonymous-${anonymous_index}.json"
  status="$(anonymous_api_status "$anonymous_file" "$method" "$path" "$body_file")"
  [[ "$status" == "401" ]] || fail "anonymous request was not denied for ${method} ${path} (http=$status)"
  jq -e '(.status==401) or (.success==false and .message=="AUTHENTICATION_REQUIRED")' "$anonymous_file" >/dev/null \
    || fail "anonymous denial response contract mismatch"
  anonymous_index=$((anonymous_index+1))
done
[[ "$(db_scalar "select count(*) from framework_system_usage_review where idempotency_key='${REVIEW_KEY}-anonymous'")" == "0" ]] || fail "anonymous review unexpectedly persisted"
info "anonymous authorization PASS status=401 endpoints=2 persistedReviews=0"

# A second existing isolated account is used only for denied calls. If it is
# absent or cannot authenticate, report BLOCKED and fail closed instead of
# presenting static controller coverage as live authorization evidence.
export CARBONET_QA_AUTH_SECRET="${CARBONET_USAGE_LEDGER_DENIED_AUTH_SECRET:-carbonet-test-account-switch}"
unset CARBONET_QA_AUTH_USER CARBONET_QA_AUTH_PASSWORD CARBONET_ACTOR_TEST_PASSWORD
if ! carbonet_qa_login "$ORDINARY_COOKIE_JAR" "$BASE_URL"; then
  printf '[operational-usage-ledger-e2e] BLOCKED: safe ordinary QA account unavailable; static controller test remains required\n' >&2
  exit 75
fi
COOKIE_JAR="$ORDINARY_COOKIE_JAR"
ordinary_session="$TMP_DIR/ordinary-session.json"
status="$(api_status "$ordinary_session" GET '/api/frontend/session')"
[[ "$status" == "200" ]] || fail "ordinary session probe failed (http=$status)"
jq -e '.authenticated==true and ((.authorCode // "") as $role | ($role!="ROLE_SYSTEM_MASTER" and $role!="ROLE_SYSTEM_ADMIN"))' "$ordinary_session" >/dev/null \
  || fail "denied QA account unexpectedly has system report authority"
denied_review_body="$TMP_DIR/denied-review.json"
jq -n --arg process "$SELECTED_PROCESS" --arg step "$SELECTED_STEP" --arg key "${REVIEW_KEY}-denied" \
  '{processCode:$process,stepCode:$step,capabilityCode:"ALL",reviewStatus:"APPROVED",reviewNote:"denial probe",idempotencyKey:$key}' > "$denied_review_body"
denied_audit_body="$TMP_DIR/denied-audit.json"
jq -n --arg process "$SELECTED_PROCESS" --arg step "$SELECTED_STEP" '{processCode:$process,stepCode:$step,maxSteps:1,maxTargets:1,compact:true}' > "$denied_audit_body"
declare -a denied_specs=(
  "GET|/admin/api/system/actor-process|"
  "GET|/admin/api/system/actor-process/dashboard/core|"
  "GET|/admin/api/system/actor-process/design-assets|"
  "GET|/admin/api/system/actor-process/system-test-report?compact=true&page=0&size=1|"
  "GET|/admin/api/system/actor-process/system-test-report/step-detail?processCode=${SELECTED_PROCESS}&stepCode=${SELECTED_STEP}|"
  "POST|/admin/api/system/actor-process/system-test-report/audit|${denied_audit_body}"
  "POST|/admin/api/system/actor-process/system-test-report/reviews|${denied_review_body}"
)
denied_index=0
for spec in "${denied_specs[@]}"; do
  IFS='|' read -r method path body_file <<< "$spec"
  denied_file="$TMP_DIR/denied-${denied_index}.json"
  status="$(api_status "$denied_file" "$method" "$path" "$body_file")"
  [[ "$status" == "403" ]] || fail "ordinary account was not denied for ${method} ${path} (http=$status)"
  jq -e '.success==false and .message=="SYSTEM_REPORT_ADMIN_REQUIRED"' "$denied_file" >/dev/null \
    || fail "ordinary denial response contract mismatch"
  denied_index=$((denied_index+1))
done
[[ "$(db_scalar "select count(*) from framework_system_usage_review where idempotency_key='${REVIEW_KEY}-denied'")" == "0" ]] || fail "denied review unexpectedly persisted"
carbonet_qa_logout "$ORDINARY_COOKIE_JAR" "$BASE_URL" || fail "ordinary QA logout failed"

elapsed=$(( $(date +%s) - started_at ))
if [[ "$EVIDENCE_MODE" == candidate ]]; then
  jq -cn --arg selectedProcess "$SELECTED_PROCESS" --arg selectedStep "$SELECTED_STEP" \
    --argjson totalSteps "$TOTAL_STEPS" --argjson pages "$page_count" --argjson durationSeconds "$elapsed" \
    '{selectedProcess:$selectedProcess,selectedStep:$selectedStep,totalSteps:$totalSteps,pages:$pages,durationSeconds:$durationSeconds,allowedRole:"SYSTEM_ADMIN_FAMILY",anonymousDenied:2,ordinaryDenied:7,browserViewports:2,persistentFixtures:0,reviewCreateReloadIdempotencyCleanup:true}' |
    bash "$ROOT/ops/scripts/stage-postdeploy-evidence-candidate.sh" \
      OPERATIONAL_USAGE_LEDGER_GATE __RELEASE__ RELEASE_GATE "$SOURCE_COMMIT"
fi
info "PASS allowedRole=SYSTEM_ADMIN_FAMILY anonymous401=2 deniedRole=NON_SYSTEM_ADMIN deniedEndpoints=7 totalSteps=${TOTAL_STEPS} pages=${page_count} browserViewports=2 persistentFixtures=0 duration=${elapsed}s"
