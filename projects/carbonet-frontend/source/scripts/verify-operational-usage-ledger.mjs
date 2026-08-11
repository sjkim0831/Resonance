import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "../src/features/actor-process-governance/SystemProcessTestReportPanel.tsx"), "utf8");
const packageJson = readFileSync(resolve(here, "../package.json"), "utf8");
const pipeline = readFileSync(resolve(here, "run-frontend-pipeline.mjs"), "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const tierContract = candidate => candidate.includes('if (raw === "DESIGN") return "DESIGN";')
  && candidate.includes('<option value="DESIGN">설계만 등록·실행 증적 없음</option>')
  && !candidate.includes('raw === "CONTRACT" || raw === "DESIGN"');
const reviewScopeContract = candidate => candidate.includes('scope.screenResourceId ? { screenResourceId: scope.screenResourceId }')
  && candidate.includes('scope.capabilityCode !== "ALL" ? { capabilityCode: scope.capabilityCode }')
  && candidate.includes("function buildReviewScopes")
  && candidate.includes("function reviewDraftKey")
  && candidate.includes("검토 대상 화면·기능")
  && candidate.includes("scopedReviewInventoryJson")
  && candidate.includes("function parseScopedReviews")
  && candidate.includes("부분 검토");
const orderContract = candidate => {
  const start = candidate.indexOf("function compareRows");
  const end = candidate.indexOf("function uniqueOptions", start);
  const comparator = start >= 0 && end > start ? candidate.slice(start, end) : "";
  const tokens = [
    'number(left, "domainOrder")',
    'number(left, "workflowOrder")',
    'text(left, "processCode").localeCompare(text(right, "processCode"), "ko")',
    'number(left, "stepOrder", "stepSequence", "stepSequenceNo")',
    'text(left, "stepCode").localeCompare(text(right, "stepCode"), "ko")'
  ];
  const positions = tokens.map(token => comparator.indexOf(token));
  return positions.every(position => position >= 0)
    && positions.every((position, index) => index === 0 || positions[index - 1] < position)
    && !comparator.includes("processOrder")
    && !comparator.includes("developmentOrder")
    && !comparator.includes("processName")
    && !comparator.includes("stepName")
    && candidate.includes("const orderedItems = useMemo(() => [...items].sort(compareRows), [items])")
    && candidate.includes("const orderedRows = [...rows].sort(compareRows)")
    && candidate.includes("return Array.from(index.values()).sort(compareRows)");
};

const tieOrderFixture = [
  { domainOrder: 1, workflowOrder: 7, processCode: "PROCESS_B", stepOrder: 1, stepCode: "B_STEP_1" },
  { domainOrder: 1, workflowOrder: 7, processCode: "PROCESS_A", stepOrder: 2, stepCode: "A_STEP_2" },
  { domainOrder: 1, workflowOrder: 7, processCode: "PROCESS_A", stepOrder: 1, stepCode: "A_STEP_1" },
  { domainOrder: 1, workflowOrder: 7, processCode: "PROCESS_B", stepOrder: 2, stepCode: "B_STEP_2" }
];
const fixtureToken = rows => [...rows].sort((left, right) => left.domainOrder - right.domainOrder
  || left.workflowOrder - right.workflowOrder
  || left.processCode.localeCompare(right.processCode, "ko")
  || left.stepOrder - right.stepOrder
  || left.stepCode.localeCompare(right.stepCode, "ko"))
  .map(row => `${row.processCode}:${row.stepCode}`).join("|");
const mutatedStepFirstFixtureToken = rows => [...rows].sort((left, right) => left.domainOrder - right.domainOrder
  || left.workflowOrder - right.workflowOrder
  || left.stepOrder - right.stepOrder
  || left.processCode.localeCompare(right.processCode, "ko")
  || left.stepCode.localeCompare(right.stepCode, "ko"))
  .map(row => `${row.processCode}:${row.stepCode}`).join("|");
const expectedTieOrderToken = "PROCESS_A:A_STEP_1|PROCESS_A:A_STEP_2|PROCESS_B:B_STEP_1|PROCESS_B:B_STEP_2";
const rowCommandOverlapFixture = () => {
  let current = "";
  const begin = key => { if (current) return false; current = key; return true; };
  const finish = key => { if (current === key) current = ""; };
  const firstAccepted = begin("ROW_A");
  const overlapRejected = !begin("ROW_B");
  finish("ROW_B");
  const staleFinishPreservedOwner = current === "ROW_A";
  finish("ROW_A");
  return { firstAccepted, overlapRejected, staleFinishPreservedOwner, released: current === "" };
};
const partialOnlyReviewFixture = {
  reviewId: 0,
  reviewStatus: "PENDING",
  reviewCurrentVersion: false,
  scopedReviewInventoryJson: JSON.stringify([{ reviewId: 41, screenResourceId: 9001, capabilityCode: "READ", reviewStatus: "APPROVED", currentVersion: true }])
};
const fixtureReviewCurrent = row => row.currentVersion === true || row.reviewCurrentVersion === true;
const fixtureHasCurrentSavedReview = row => Number(row.reviewId || 0) > 0 && fixtureReviewCurrent(row);
const fixtureScopedReviews = JSON.parse(partialOnlyReviewFixture.scopedReviewInventoryJson).filter(fixtureHasCurrentSavedReview);
const noE2ePromotionContract = candidate => candidate.includes('if (tier === "BUSINESS_E2E") return normalizeBusinessResult(row);')
  && candidate.includes('if (tier === "CONTRACT_SIMULATION") return normalizeSimulationResult(row) !== "NOT_RUN" ? normalizeSimulationResult(row) : normalizeResult(row);')
  && candidate.includes("계약 점검이나 시뮬레이션은 실제 저장·승인·반려·삭제 기능의 E2E 통과로 승격하지 않습니다.");
const paginationContract = candidate => candidate.includes('new URLSearchParams({ compact: String(compact), page: String(page), size: "50" })')
  && candidate.includes("while (latestPagination.hasNext)")
  && candidate.includes("mergeOrderedRows")
  && candidate.includes("mergeCatalogRows")
  && candidate.includes("자동 불러오기 일시정지")
  && candidate.includes("자동 불러오기 계속");
const compactReviewGateContract = candidate => candidate.includes("/system-test-report/step-detail?")
  && candidate.includes('body.detailMode !== "SELECTED_STEP_FULL"')
  && candidate.includes("body.reviewCriticalFieldsComplete !== true")
  && candidate.includes("detail.reviewAllowed !== true")
  && candidate.includes("detail.reviewCriticalFieldsComplete !== true")
  && candidate.includes("Boolean(fullDetailRows[key])")
  && candidate.includes("compactValueOmitted")
  && candidate.includes("상세 기능 목록 로딩 필요")
  && candidate.includes('disabled={busy || !ready}')
  && candidate.includes('disabled={busy || !ready || !draft.note.trim()}');
const autoPaginationContract = candidate => candidate.includes("window.setTimeout")
  && candidate.includes("loadNextPage(controller.signal, true)")
  && candidate.includes("자동 불러오기 일시정지")
  && candidate.includes("자동 불러오기 계속")
  && candidate.includes("pageRequestInFlightRef.current")
  && candidate.includes("bulkPageAbortRef.current?.abort()");
const fullDocumentContract = candidate => candidate.includes('fetchReportPage(page, controller.signal, false)')
  && candidate.includes('collectFullDocument("PRINT")')
  && candidate.includes('collectFullDocument("TEXT")')
  && candidate.includes("전체 실사용 기록 텍스트(.txt) 내보내기")
  && candidate.includes("downloadOperationalLedgerText")
  && candidate.includes("buildOperationalLedgerText")
  && candidate.includes("const SENSITIVE_EXPORT_KEY =")
  && candidate.includes("[REDACTED]")
  && candidate.includes("fullRows.length !== latestPagination.totalStepCount")
  && candidate.includes("printStateApplied = true")
  && candidate.includes("setPrintAllRows(true)")
  && candidate.includes("const displayedItems = printAllRows ? orderedItems : filteredItems")
  && candidate.includes("setPayload(browsingPayload)")
  && candidate.includes("setPagination(browsingPagination)")
  && candidate.includes("전체 자료 수집 중단")
  && candidate.includes("documentRetryMode");
const secretRedactionContract = candidate => ["developmentCode", "verificationCode", "apiKey", "privateKey", "credential", "sessionId", "csrf", "jwt"].every(fragment => (candidate.match(new RegExp(fragment, "g")) || []).length >= 2)
  && candidate.includes('if (Array.isArray(raw)) return raw.map(value => redactExportValue(value));')
  && candidate.includes('Object.entries(raw as Row).map(([childKey, value]) => [childKey, redactExportValue(value, childKey)])')
  && candidate.includes("중첩 객체까지 재마스킹했습니다");
const scopedReviewPersistenceContract = candidate => candidate.includes('const raw = firstValue(row, "scopedReviewInventoryJson", "reviewScopesJson");')
  && candidate.includes("scopeFromReviewRecord")
  && candidate.includes("function hasCurrentSavedReview")
  && candidate.includes('const hasVersionFlag = Object.prototype.hasOwnProperty.call(row, "currentVersion") || Object.prototype.hasOwnProperty.call(row, "reviewCurrentVersion");')
  && candidate.includes('return number(row, "reviewId") > 0 && hasVersionFlag && reviewRecordCurrent(row);')
  && candidate.includes("if (hasCurrentSavedReview(row)) return scopeFromSavedReview(row).key;")
  && candidate.includes("const latestScoped = parseScopedReviews(row).find(hasCurrentSavedReview);")
  && candidate.includes("const currentScopedReviews = parseScopedReviews(row).filter(review => hasCurrentSavedReview(review)")
  && candidate.includes("`부분 검토 ${currentScopedReviews.length}건 · 절차 전체 미승인`")
  && !candidate.includes('if (text(row, "reviewStatus") && scopeFromSavedReview(row).key === scope.key)')
  && candidate.includes("reviewStatusForScope")
  && candidate.includes("reviewNoteForScope")
  && candidate.includes("records.forEach(record")
  && candidate.includes("normalizeAggregateReviewStatus(row)");
const nextBranchContract = candidate => candidate.includes('firstValue(row, "nextDestinationsJson", "nextTransitionsJson")')
  && candidate.includes("nextDestinationCount")
  && candidate.includes("nextHasBranching")
  && candidate.includes("안내 순서 · 강제 선행 또는 자동 전이 계약 아님")
  && candidate.includes("다음 업무 원본 전체 분기·조건");
const actorCandidateContract = candidate => candidate.includes("전체 범위 후보 계정")
  && candidate.includes("assignmentScope")
  && candidate.includes("실제 업무 실행 계정")
  && !candidate.includes('DetailLine label="배정 계정"');
const dualActorRouteContract = candidate => candidate.includes('text(destination, "edgeActorCode")')
  && candidate.includes('text(destination, "targetActorCode")')
  && candidate.includes('text(destination, "userRoutePath")')
  && candidate.includes('text(destination, "adminRoutePath")')
  && candidate.includes('firstValue(destination, "screenRouteInventory")')
  && candidate.includes("저장된 전이 계약 액터")
  && candidate.includes("현재 대상 절차 액터")
  && !candidate.includes("전이 수행 액터")
  && !candidate.includes(">전이 액터:")
  && !candidate.includes("대상 액터:")
  && candidate.includes("사용자 경로 후보")
  && candidate.includes("관리자 경로 후보")
  && candidate.includes("기존 actorCode 호환용 후보")
  && candidate.includes("기존 routePath 호환용 후보")
  && candidate.includes("routeResolution")
  && candidate.includes("MULTIPLE_CANDIDATES")
  && candidate.includes("실제 업무 E2E 실행 경로")
  && candidate.includes("actualBusinessRoutePath")
  && candidate.indexOf("if (branches.length > 0)") < candidate.indexOf("if (explicitProcessCode || explicitStepCode || explicitRoute)")
  && !candidate.includes(">다음 화면 열기")
  && !candidate.includes('`다음 업무: ${next.label} (${next.code || "-"}) · ${next.routePath');
const cumulativeSummaryContract = candidate => candidate.includes('["불러온 프로세스", computedSummary.totalProcesses')
  && candidate.includes('["불러온 절차", computedSummary.totalSteps')
  && !candidate.includes('["불러온 프로세스", numberOr(summary')
  && !candidate.includes('["불러온 절차", numberOr(summary');
const reviewBusyContract = candidate => candidate.includes('const rowCommandBusyRef = useRef("");')
  && candidate.includes("const interactionBusy = busy || documentBusy || Boolean(rowBusyKey);")
  && candidate.includes("if (busy || documentBusy || rowCommandBusyRef.current) return false;")
  && candidate.includes("if (rowCommandBusyRef.current !== key) return;")
  && candidate.includes('setRowBusyKey(current => current === key ? "" : current);')
  && (candidate.match(/if \(!beginRowCommand\(busyKey\)\) return;/g) || []).length === 1
  && (candidate.match(/if \(!beginRowCommand\(key\)\) return;/g) || []).length === 2
  && (candidate.match(/finishRowCommand\(busyKey\)/g) || []).length === 1
  && (candidate.match(/finishRowCommand\(key\)/g) || []).length === 2
  && candidate.includes("const rowBusy = interactionBusy;")
  && candidate.includes("<ReviewEditor busy={rowBusy}")
  && (candidate.match(/disabled=\{busy \|\| !ready\}/g) || []).length >= 3;
const reviewAuthoritativeRefreshContract = candidate => {
  const start = candidate.indexOf("async function saveReview");
  const end = candidate.indexOf("async function loadFullReviewDetail", start);
  const body = start >= 0 && end > start ? candidate.slice(start, end) : "";
  return candidate.includes("async function fetchExactReviewDetail")
    && candidate.includes("setReviewDrafts(current => mergeReviewDrafts(current, [authoritative]))")
    && body.includes("delete next[busyKey]")
    && body.includes("authoritative = await fetchExactReviewDetail({ ...row, ...saved }, index)")
    && body.includes("reviewStatusForScope(authoritative, scope)")
    && body.includes("검토 저장은 완료됐지만 서버의 최신 화면·기능·범위별 검토 목록 동기화에 실패했습니다")
    && body.includes("stale 상세는 폐기했습니다")
    && body.includes("exact step-detail 범위별 원장과 다시 동기화했습니다")
    && body.indexOf("authoritative = await fetchExactReviewDetail") < body.indexOf("exact step-detail 범위별 원장과 다시 동기화했습니다");
};

expect(source.includes("전 시스템 실사용 검수 대장"), "Operational usage ledger heading is missing.");
expect(source.includes('data-common-component="COMMON_OPERATIONAL_USAGE_VERIFICATION_LEDGER"'), "Reusable common-component registration is missing.");
for (const helpId of ["operational-ledger-summary", "operational-ledger-filters", "operational-ledger-table", "operational-ledger-detail", "operational-ledger-review"]) expect(source.includes(`data-help-id="${helpId}"`), `Help anchor is missing: ${helpId}.`);
for (const helpId of ["usage-ledger-summary", "usage-ledger-filter", "usage-ledger-table", "usage-ledger-detail", "usage-ledger-review"]) expect(source.includes(`data-help-id="${helpId}"`), `Persisted help contract anchor is missing: ${helpId}.`);
expect(source.includes("업무 종류 → 프로세스 → 절차 → 화면 → 담당 액터 → 기능 → 입력·출력 → 증적 → 다음 업무"), "Ordered usage contract is missing.");
expect(source.includes(".sort(compareRows)"), "Work, process and step order must be deterministic.");
expect(source.includes("actualInput") && source.includes("actualOutput") && source.includes("actualEvidenceJson"), "Actual input, output and evidence fields are missing.");
expect(source.includes("screenFunctionInventoryJson"), "Per-screen function inventory is missing.");
expect(source.includes("assignedAccountCount") && source.includes("assignedAccountIds") && source.includes("actorCapabilityCodes"), "Actor account and capability fields are missing.");
expect(source.includes("nextProcessCode") && source.includes("nextStepCode") && source.includes("nextRoutePath") && source.includes("nextTransitionSource"), "Explicit next-work fields are missing.");
expect(source.includes("명시적 NEXT 계약이 없어 다른 프로세스를 추정하지 않습니다."), "The UI must not infer an unregistered cross-process transition.");
expect(source.includes("system-test-report/reviews") && source.includes('reviewStatus: status === "REVIEWED" ? "APPROVED" : "CHANGE_REQUESTED"'), "Human review persistence is missing.");
expect(source.includes("linkedJobId") && source.includes("DEVELOPMENT_REVIEW_PENDING"), "Change requests must expose the linked design-development follow-up.");
expect(source.includes("이 상태는 절차 전체 승인이나 계약·E2E 통과를 의미하지 않습니다."), "Human review must not be represented as test evidence.");
expect(source.includes("HUMAN REVIEW RECORD") && source.includes("reviewedBy") && source.includes("reviewedAt"), "Printable human review evidence is missing.");
expect(source.includes("reviewScreenResourceId") && source.includes("reviewCapabilityCode"), "Printable review scope is missing.");
expect(source.includes("stepCode: text(row, \"stepCode\")") && source.includes("계약 재점검"), "Single-step contract rerun is missing.");
expect(source.includes("BUSINESS_E2E") && source.includes("CONTRACT_SIMULATION") && source.includes("DESIGN") && source.includes("NO_EVIDENCE"), "Evidence tiers are not separated.");
expect(source.includes("계약 점검이나 시뮬레이션은 실제 저장·승인·반려·삭제 기능의 E2E 통과로 승격하지 않습니다."), "False E2E promotion warning is missing.");
expect(source.includes("현재 결과 모두 펼치기") && source.includes("window.print()") && source.includes("report-print-detail"), "Expand and print workflow is incomplete.");
expect(source.includes("primaryRoutePath") && source.includes("safeRoutePath"), "Direct-open routes are not sanitized.");
expect(source.includes('type="search"') && source.includes("evidenceFilter") && source.includes("reviewFilter"), "Ledger filters are incomplete.");
expect(tierContract(source), "DESIGN must remain design-only and must not be labeled as contract evidence.");
expect(reviewScopeContract(source), "Human review drafts and writes must be scoped by screen and capability when available.");
expect(orderContract(source), "Rows must follow the backend order contract: domainOrder, workflowOrder, processCode, stepOrder, stepCode.");
expect(fixtureToken(tieOrderFixture) === expectedTieOrderToken, "Equal-workflow processes must remain grouped by processCode before stepOrder.");
expect(mutatedStepFirstFixtureToken(tieOrderFixture) !== expectedTieOrderToken, "Tie-order mutation survived: stepOrder incorrectly precedes processCode.");
expect(Object.values(rowCommandOverlapFixture()).every(Boolean), "ROW_A/ROW_B overlap or stale-finally ownership fixture failed.");
expect(!fixtureHasCurrentSavedReview(partialOnlyReviewFixture) && fixtureScopedReviews.length === 1 && `부분 검토 ${fixtureScopedReviews.length}건 · 절차 전체 미승인` === "부분 검토 1건 · 절차 전체 미승인", "Partial-only saved review must remain reachable without promoting PENDING to a whole-step review.");
expect(noE2ePromotionContract(source), "Contract or simulation evidence must not be promoted to business E2E.");
expect(paginationContract(source), "Progressive pagination, deterministic merge or print-all gate is incomplete.");
expect(compactReviewGateContract(source), "Compact rows must not be reviewable until exact full step detail is loaded.");
expect(autoPaginationContract(source), "Sequential background pagination or pause/resume/abort control is incomplete.");
expect(fullDocumentContract(source), "Full-detail print and redacted TXT export must collect every compact=false page with retry/abort safety.");
expect(secretRedactionContract(source), "TXT export must recursively mask every backend secret fragment, including nested arrays and objects.");
expect(scopedReviewPersistenceContract(source), "Persisted screen/capability reviews must survive reload without becoming whole-step approval.");
expect(cumulativeSummaryContract(source), "Loaded-range summary must be recomputed from merged rows instead of the stale first-page summary.");
expect(reviewBusyContract(source), "Scoped review writes must lock the owning row and all document export writes.");
expect(nextBranchContract(source), "Every next-work branch and condition must be shown while STEP_ORDER remains guidance-only.");
expect(actorCandidateContract(source), "Actor-wide candidates must not be mislabeled as actual assigned or E2E execution accounts.");
expect(dualActorRouteContract(source), "Transition actor, target actor, user/admin route candidates and actual E2E route must remain separate.");
expect(reviewAuthoritativeRefreshContract(source), "A saved review must refetch exact step detail before showing synchronized success, and discard stale detail on failure.");
expect(source.includes("관리자 로그인 세션이 만료되었습니다") && source.includes("webmaster 또는 시스템 관리자 권한"), "401 and 403 guidance is incomplete.");
expect(source.includes("현재 불러온 범위 누적 요약") && !source.includes("시스템 전체 누적 요약"), "Partial pages must not be labeled as a complete system summary.");
expect(source.includes('items.length >= pagination.totalStepCount ? "전 시스템 실사용 검수 대장" : "실사용 검수 대장 · 부분 불러오기"'), "The system-wide heading must be gated by complete pagination.");
expect(packageJson.includes('"audit:operational-usage-ledger": "node scripts/verify-operational-usage-ledger.mjs"'), "Package audit command is not registered.");
expect(pipeline.includes('runAsync(process.execPath, ["scripts/verify-operational-usage-ledger.mjs"])'), "Deployment build validation does not run the usage-ledger audit.");

const mutations = [
  ["tier truthfulness", source.replace('if (raw === "DESIGN") return "DESIGN";', 'if (raw === "DESIGN") return "CONTRACT_SIMULATION";'), tierContract],
  ["review screen scope", source.replace('scope.screenResourceId ? { screenResourceId: scope.screenResourceId }', 'false ? { screenResourceId: scope.screenResourceId }'), reviewScopeContract],
  ["workflow order", source.replace('|| number(left, "workflowOrder") - number(right, "workflowOrder")', ''), orderContract],
  ["processCode grouping", source.replace('|| text(left, "processCode").localeCompare(text(right, "processCode"), "ko")', ''), orderContract],
  ["stepCode tie order", source.replace('|| text(left, "stepCode").localeCompare(text(right, "stepCode"), "ko")', ''), orderContract],
  ["processName primary", source.replaceAll('text(left, "processCode").localeCompare(text(right, "processCode"), "ko")', 'text(left, "processName").localeCompare(text(right, "processName"), "ko")'), orderContract],
  ["no E2E promotion", source.replace('if (tier === "CONTRACT_SIMULATION") return normalizeSimulationResult(row) !== "NOT_RUN" ? normalizeSimulationResult(row) : normalizeResult(row);', 'if (tier === "CONTRACT_SIMULATION") return normalizeBusinessResult(row);'), noE2ePromotionContract],
  ["pagination hasNext", source.replace("while (latestPagination.hasNext)", "while (false)"), paginationContract],
  ["compact review gate", source.replace("body.reviewCriticalFieldsComplete !== true", "false"), compactReviewGateContract],
  ["auto pagination pause", source.replace("loadNextPage(controller.signal, true)", "loadNextPage(undefined, false)"), autoPaginationContract],
  ["full document detail", source.replace("fetchReportPage(page, controller.signal, false)", "fetchReportPage(page, controller.signal, true)"), fullDocumentContract],
  ["print all ignores filters", source.replace("const displayedItems = printAllRows ? orderedItems : filteredItems", "const displayedItems = filteredItems"), fullDocumentContract],
  ["client secret redaction", source.replace("const SENSITIVE_EXPORT_KEY =", "const UNUSED_EXPORT_KEY ="), fullDocumentContract],
  ["extended secret fragments", source.replaceAll("developmentCode|verificationCode|apiKey|privateKey|credential|sessionId|csrf|jwt", "credential"), secretRedactionContract],
  ["nested object secret redaction", source.replace("redactExportValue(value, childKey)", "redactExportValue(value)"), secretRedactionContract],
  ["nested array secret redaction", source.replace("raw.map(value => redactExportValue(value))", "raw.map(value => value)"), secretRedactionContract],
  ["persisted scoped review", source.replace('const raw = firstValue(row, "scopedReviewInventoryJson", "reviewScopesJson");', 'const raw = firstValue(row, "reviewStatus");'), scopedReviewPersistenceContract],
  ["cumulative merged summary", source.replace('["불러온 절차", computedSummary.totalSteps', '["불러온 절차", numberOr(summary, computedSummary.totalSteps'), cumulativeSummaryContract],
  ["row command overlap A/B", source.replace("if (busy || documentBusy || rowCommandBusyRef.current) return false;", "if (false) return false;"), reviewBusyContract],
  ["global row interaction busy", source.replace("const interactionBusy = busy || documentBusy || Boolean(rowBusyKey);", "const interactionBusy = Boolean(rowBusyKey);"), reviewBusyContract],
  ["saved review identity", source.replace('return number(row, "reviewId") > 0 && hasVersionFlag && reviewRecordCurrent(row);', 'return Boolean(text(row, "reviewStatus"));'), scopedReviewPersistenceContract],
  ["partial-only review reload", source.replace("const currentScopedReviews = parseScopedReviews(row).filter(review => hasCurrentSavedReview(review)", "const currentScopedReviews = parseScopedReviews(row).filter(review => false && hasCurrentSavedReview(review)"), scopedReviewPersistenceContract],
  ["next branch inventory", source.replaceAll('firstValue(row, "nextDestinationsJson", "nextTransitionsJson")', 'firstValue(row, "nextStepCode")'), nextBranchContract],
  ["actor candidates truthful", source.replaceAll("전체 범위 후보 계정", "배정 계정"), actorCandidateContract],
  ["dual actor mismatch", source.replaceAll('text(destination, "targetActorCode")', 'text(destination, "edgeActorCode")'), dualActorRouteContract],
  ["dual route mismatch", source.replaceAll('text(destination, "adminRoutePath")', 'text(destination, "userRoutePath")'), dualActorRouteContract],
  ["review exact-detail refresh", source.replace("authoritative = await fetchExactReviewDetail({ ...row, ...saved }, index)", "authoritative = { ...row, ...saved }"), reviewAuthoritativeRefreshContract],
  ["review stale-detail purge", source.replaceAll("delete next[busyKey]", "void next[busyKey]"), reviewAuthoritativeRefreshContract]
];
mutations.forEach(([name, mutant, contract]) => expect(!contract(mutant), `Mutation survived: ${name}.`));

if (failures.length) {
  console.error("[operational-usage-ledger] FAIL");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("[operational-usage-ledger] PASS");
console.log("order=domain-workflow-processCode-stepOrder-stepCode tieFixture=grouped actor=saved-edge-contract-vs-current-target route=user-admin-candidates-vs-e2e io=actual evidence=tiered next=all-branches-guide-only review=scoped-authoritative-refetch+partial-only rowCommands=global-serialized-A-B export=recursive-redacted-txt rerun=single-step pagination=auto50 print=full-all-unfiltered truthful=true mutations=28 pipeline=fail-closed");
