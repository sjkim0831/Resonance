import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

type Row = Record<string, unknown>;

type ReportPayload = {
  auditMode?: string;
  summary?: Row;
  workTypes?: Row[];
  processes?: Row[];
  items?: Row[];
  generatedAt?: string;
  evaluatedAt?: string;
  pagination?: Pagination;
};

type Pagination = {
  page: number;
  size: number;
  returnedItemCount: number;
  totalStepCount: number;
  hasNext: boolean;
  mode: string;
};

type Props = {
  base: string;
};

type TestResult = "PASSED" | "BLOCKED" | "NOT_RUN";
type ReviewStatus = "UNREVIEWED" | "REVIEWED" | "CHANGE_REQUESTED";
type EvidenceFilter = "" | "BUSINESS_E2E" | "CONTRACT_SIMULATION" | "DESIGN" | "NO_EVIDENCE";
type ReviewDraft = { status: ReviewStatus; note: string };
type ReviewScope = { key: string; label: string; screenResourceId?: number; capabilityCode: string; partial: boolean };
type NextDestination = { label: string; code: string; routePath: string; sourceLabel: string };

const text = (row: Row | undefined, ...keys: string[]) => {
  for (const key of keys) {
    const raw = row?.[key];
    if (raw !== undefined && raw !== null && String(raw).trim()) return String(raw);
  }
  return "";
};

const number = (row: Row | undefined, ...keys: string[]) => {
  const raw = text(row, ...keys);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const numberOr = (row: Row | undefined, fallback: number, ...keys: string[]) => {
  if (!row) return fallback;
  for (const key of keys) {
    const raw = row[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

async function readJsonResponse<T extends object>(response: Response, fallbackMessage: string): Promise<T> {
  if (response.status === 401) throw new Error("관리자 로그인 세션이 만료되었습니다. 다시 로그인한 뒤 실사용 검수 대장을 열어 주세요.");
  if (response.status === 403) throw new Error("실사용 검수 대장은 webmaster 또는 시스템 관리자 권한이 있는 계정만 조회·점검·검토할 수 있습니다.");
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/html")) throw new Error(`${fallbackMessage} 로그인 세션 또는 API 라우팅을 확인하세요. (${response.status})`);
  if (!contentType.includes("json")) throw new Error(`${fallbackMessage} 서버 응답 형식이 올바르지 않습니다. (${response.status})`);
  let parsed: unknown;
  try { parsed = JSON.parse(await response.text()); }
  catch { throw new Error(`${fallbackMessage} 서버 JSON을 해석하지 못했습니다. (${response.status})`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${fallbackMessage} 서버 데이터 구조가 올바르지 않습니다. (${response.status})`);
  const row = parsed as Row;
  if (!response.ok || row.success === false) throw new Error(text(row, "message", "error") || `${fallbackMessage} (${response.status})`);
  return parsed as T;
}

function isAbortError(reason: unknown) {
  return typeof reason === "object" && reason !== null && "name" in reason && reason.name === "AbortError";
}

function requestErrorMessage(reason: unknown, fallback: string) {
  if (reason instanceof TypeError) return `${fallback} 서버 연결 상태를 확인한 뒤 다시 시도하세요.`;
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

const fieldClass = "mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#246beb] focus:ring-2 focus:ring-blue-100";
const focusClass = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246beb]";

const RESULT_LABELS: Record<TestResult, string> = {
  PASSED: "계약 통과",
  BLOCKED: "계약 차단",
  NOT_RUN: "미점검"
};

const RESULT_CLASSES: Record<TestResult, string> = {
  PASSED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  BLOCKED: "border-red-200 bg-red-50 text-red-800",
  NOT_RUN: "border-slate-200 bg-slate-100 text-slate-700"
};

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  UNREVIEWED: "미검토",
  REVIEWED: "검토 완료",
  CHANGE_REQUESTED: "설계·기능 변경 요청"
};

const REVIEW_CLASSES: Record<ReviewStatus, string> = {
  UNREVIEWED: "border-slate-200 bg-slate-100 text-slate-700",
  REVIEWED: "border-blue-200 bg-blue-50 text-blue-800",
  CHANGE_REQUESTED: "border-amber-200 bg-amber-50 text-amber-900"
};

export function SystemProcessTestReportPanel({ base }: Props) {
  const scrollHelpId = useId();
  const [payload, setPayload] = useState<ReportPayload>({ items: [], processes: [], workTypes: [], summary: {} });
  const [workTypeCode, setWorkTypeCode] = useState("");
  const [processCode, setProcessCode] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>("");
  const [reviewFilter, setReviewFilter] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [reviewScopeKeys, setReviewScopeKeys] = useState<Record<string, string>>({});
  const [fullDetailRows, setFullDetailRows] = useState<Record<string, Row>>({});
  const [rowBusyKey, setRowBusyKey] = useState("");
  const rowCommandBusyRef = useRef("");
  const [pagination, setPagination] = useState<Pagination>({ page: 0, size: 50, returnedItemCount: 0, totalStepCount: 0, hasNext: false, mode: "STRUCTURAL_SCOPE" });
  const [pageBusy, setPageBusy] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentRetryMode, setDocumentRetryMode] = useState<"PRINT" | "TEXT" | "">("");
  const [printAllRows, setPrintAllRows] = useState(false);
  const [autoLoadPaused, setAutoLoadPaused] = useState(false);
  const autoPageAbortRef = useRef<AbortController | null>(null);
  const bulkPageAbortRef = useRef<AbortController | null>(null);
  const pageRequestInFlightRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchReportPage = useCallback(async (page: number, signal?: AbortSignal, compact = true) => {
    const query = new URLSearchParams({ compact: String(compact), page: String(page), size: "50" });
    const response = await fetch(`${base}/system-test-report?${query.toString()}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal
    });
    return readJsonResponse<ReportPayload & { message?: string }>(response, "전체 프로세스 실사용 검수 결과를 불러오지 못했습니다.");
  }, [base]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    setError("");
    try {
      const body = await fetchReportPage(0, signal);
      const pageItems = Array.isArray(body.items) ? body.items : [];
      const nextPagination = normalizePagination(body.pagination, 0, pageItems.length);
      setPayload({
        ...body,
        items: pageItems,
        processes: Array.isArray(body.processes) ? body.processes : [],
        workTypes: Array.isArray(body.workTypes) ? body.workTypes : [],
        summary: body.summary && typeof body.summary === "object" ? body.summary : {},
        pagination: nextPagination
      });
      setPagination(nextPagination);
      setReviewDrafts(current => mergeReviewDrafts(current, pageItems));
    } catch (reason) {
      if (isAbortError(reason)) return;
      setError(requestErrorMessage(reason, "전체 프로세스 실사용 검수 결과를 불러오지 못했습니다."));
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, [fetchReportPage]);

  const runAudit = useCallback(async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const scope = {
        ...(workTypeCode ? { domainCode: workTypeCode } : {}),
        ...(processCode ? { processCode } : {})
      };
      let targetOffset = 0;
      let pageCount = 0;
      let targetCount = 0;
      let passedCount = 0;
      let blockedCount = 0;
      let finalOutcome = "PASSED";
      while (true) {
        pageCount += 1;
        if (pageCount > 10_000) throw new Error("계약 감사 페이지 수가 안전 한도를 초과했습니다.");
        const response = await fetch(`${base}/system-test-report/audit`, {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ ...scope, targetOffset, maxTargets: 250 })
        });
        const body = await readJsonResponse<Row>(response, "프로세스 계약 감사에 실패했습니다.");
        if (body.businessFunctionsExecuted !== false) throw new Error("계약 감사 중 실제 업무 기능 실행이 감지되었습니다.");
        const outcome = text(body, "outcome", "result") || "UNKNOWN";
        if (outcome === "ERROR" || number(body, "errorCount") > 0) throw new Error(`계약 감사 ${pageCount}페이지에서 오류가 발생했습니다.`);
        if (outcome === "BLOCKED") finalOutcome = "BLOCKED";
        targetCount += number(body, "targetCount");
        passedCount += number(body, "passedCount");
        blockedCount += number(body, "blockedCount");
        const hasMore = body.hasMore === true || String(body.hasMore).toLowerCase() === "true";
        setMessage(`계약 감사 진행 중 · ${pageCount}페이지 · ${targetCount.toLocaleString("ko-KR")}개 대상 처리`);
        if (!hasMore) break;
        const nextOffset = number(body, "nextTargetOffset");
        if (nextOffset <= targetOffset) throw new Error("계약 감사 다음 페이지 위치가 올바르지 않습니다.");
        targetOffset = nextOffset;
      }
      setMessage(`계약 감사 전체 페이지 완료 · 결과 ${finalOutcome} · ${pageCount}페이지 · 대상 ${targetCount.toLocaleString("ko-KR")}개 · 통과 ${passedCount.toLocaleString("ko-KR")}개 · 차단 ${blockedCount.toLocaleString("ko-KR")}개 · 실제 업무 기능은 실행하지 않았습니다.`);
      await load();
    } catch (reason) {
      setError(requestErrorMessage(reason, "프로세스 계약 점검에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  }, [base, load, processCode, workTypeCode]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function loadNextPage(signal?: AbortSignal, automatic = false) {
    if (pageRequestInFlightRef.current || !pagination.hasNext) return;
    pageRequestInFlightRef.current = true;
    setPageBusy(true);
    setError("");
    try {
      const body = await fetchReportPage(pagination.page + 1, signal);
      const pageItems = Array.isArray(body.items) ? body.items : [];
      const nextPagination = normalizePagination(body.pagination, pagination.page + 1, pageItems.length);
      if (nextPagination.page <= pagination.page) throw new Error("다음 검수 페이지 번호가 이전 페이지보다 크지 않습니다.");
      setPayload(current => ({
        ...current,
        items: mergeOrderedRows(current.items ?? [], pageItems),
        processes: mergeCatalogRows(current.processes ?? [], Array.isArray(body.processes) ? body.processes : [], "processCode", "code"),
        workTypes: mergeCatalogRows(current.workTypes ?? [], Array.isArray(body.workTypes) ? body.workTypes : [], "workTypeCode", "domainCode", "code"),
        pagination: nextPagination
      }));
      setPagination(nextPagination);
      setReviewDrafts(current => mergeReviewDrafts(current, pageItems));
      setMessage(`${automatic ? "자동 " : ""}실사용 검수 대장 ${nextPagination.page + 1}페이지를 추가했습니다. ${Math.min(nextPagination.totalStepCount, (nextPagination.page + 1) * nextPagination.size).toLocaleString("ko-KR")} / ${nextPagination.totalStepCount.toLocaleString("ko-KR")}개 절차를 불러왔습니다.`);
    } catch (reason) {
      if (isAbortError(reason)) return;
      setError(requestErrorMessage(reason, "다음 실사용 검수 페이지를 불러오지 못했습니다. 현재까지 불러온 결과는 유지됩니다."));
    } finally {
      pageRequestInFlightRef.current = false;
      setPageBusy(false);
    }
  }

  async function loadRemainingPages() {
    if (pageRequestInFlightRef.current) return;
    pageRequestInFlightRef.current = true;
    setAutoLoadPaused(true);
    autoPageAbortRef.current?.abort();
    const controller = new AbortController();
    bulkPageAbortRef.current = controller;
    setPageBusy(true);
    setError("");
    try {
      let currentPage = pagination.page;
      let latestPagination = pagination;
      let mergedItems = payload.items ?? [];
      const reviewRows: Row[] = [];
      const maximumPageCount = Math.max(1, Math.ceil(Math.max(pagination.totalStepCount, mergedItems.length) / Math.max(1, pagination.size)) + 1);
      let fetchedPageCount = 0;
      while (latestPagination.hasNext) {
        fetchedPageCount += 1;
        if (fetchedPageCount > maximumPageCount) throw new Error("실사용 검수 페이지 수가 계산된 안전 한도를 초과했습니다.");
        const body = await fetchReportPage(currentPage + 1, controller.signal);
        const pageItems = Array.isArray(body.items) ? body.items : [];
        const nextPagination = normalizePagination(body.pagination, currentPage + 1, pageItems.length);
        if (nextPagination.page <= currentPage) throw new Error("실사용 검수 페이지 순서가 역행하여 전체 불러오기를 중단했습니다.");
        mergedItems = mergeOrderedRows(mergedItems, pageItems);
        reviewRows.push(...pageItems);
        currentPage = nextPagination.page;
        latestPagination = nextPagination;
        setPayload(current => ({
          ...current,
          items: mergedItems,
          processes: mergeCatalogRows(current.processes ?? [], Array.isArray(body.processes) ? body.processes : [], "processCode", "code"),
          workTypes: mergeCatalogRows(current.workTypes ?? [], Array.isArray(body.workTypes) ? body.workTypes : [], "workTypeCode", "domainCode", "code"),
          pagination: latestPagination
        }));
        setPagination(latestPagination);
        setReviewDrafts(current => mergeReviewDrafts(current, pageItems));
        setMessage(`전체 검수 대장 수집 중 · ${currentPage + 1}페이지 · ${mergedItems.length.toLocaleString("ko-KR")} / ${latestPagination.totalStepCount.toLocaleString("ko-KR")}개 절차`);
      }
      if (reviewRows.length) setReviewDrafts(current => mergeReviewDrafts(current, reviewRows));
      setMessage(`실사용 검수 대장 전체 ${mergedItems.length.toLocaleString("ko-KR")}개 절차를 순서대로 불러왔습니다.`);
    } catch (reason) {
      if (isAbortError(reason)) return;
      setError(requestErrorMessage(reason, "전체 실사용 검수 대장을 불러오지 못했습니다. 성공한 페이지까지는 유지되며 다시 시도할 수 있습니다."));
    } finally {
      if (bulkPageAbortRef.current === controller) bulkPageAbortRef.current = null;
      pageRequestInFlightRef.current = false;
      setPageBusy(false);
    }
  }

  async function collectFullDocument(mode: "PRINT" | "TEXT") {
    if (pageRequestInFlightRef.current) return;
    pageRequestInFlightRef.current = true;
    setDocumentBusy(true);
    setDocumentRetryMode(mode);
    setPageBusy(true);
    setAutoLoadPaused(true);
    setError("");
    autoPageAbortRef.current?.abort();
    const controller = new AbortController();
    const browsingPayload = payload;
    const browsingPagination = pagination;
    let printStateApplied = false;
    bulkPageAbortRef.current = controller;
    try {
      let page = 0;
      let hasNext = true;
      let fullRows: Row[] = [];
      let fullProcesses: Row[] = [];
      let fullWorkTypes: Row[] = [];
      let latestPagination: Pagination = { page: 0, size: 50, returnedItemCount: 0, totalStepCount: 0, hasNext: true, mode: "STRUCTURAL_SCOPE" };
      let safePageLimit = 2;
      while (hasNext) {
        if (page >= safePageLimit) throw new Error("전체 문서 페이지 수가 계산된 안전 한도를 초과했습니다.");
        const body = await fetchReportPage(page, controller.signal, false);
        const pageItems = Array.isArray(body.items) ? body.items : [];
        latestPagination = normalizePagination(body.pagination, page, pageItems.length);
        if (latestPagination.page !== page) throw new Error("전체 문서 페이지 순서가 요청 순서와 일치하지 않습니다.");
        if (page === 0) safePageLimit = Math.max(2, Math.ceil(latestPagination.totalStepCount / Math.max(1, latestPagination.size)) + 1);
        fullRows = mergeOrderedRows(fullRows, pageItems);
        fullProcesses = mergeCatalogRows(fullProcesses, Array.isArray(body.processes) ? body.processes : [], "processCode", "code");
        fullWorkTypes = mergeCatalogRows(fullWorkTypes, Array.isArray(body.workTypes) ? body.workTypes : [], "workTypeCode", "domainCode", "code");
        hasNext = latestPagination.hasNext;
        setMessage(`${mode === "PRINT" ? "인쇄" : "텍스트 내보내기"} 전체 자료 수집 중 · ${page + 1}페이지 · ${fullRows.length.toLocaleString("ko-KR")} / ${latestPagination.totalStepCount.toLocaleString("ko-KR")}개 절차`);
        page += 1;
        if (hasNext) await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      }
      if (fullRows.length !== latestPagination.totalStepCount) throw new Error(`전체 문서 절차 수가 일치하지 않습니다. 수집 ${fullRows.length} / 원장 ${latestPagination.totalStepCount}`);
      setReviewDrafts(current => mergeReviewDrafts(current, fullRows));
      if (mode === "PRINT") {
        printStateApplied = true;
        setPayload(current => ({ ...current, items: fullRows, processes: fullProcesses, workTypes: fullWorkTypes, pagination: latestPagination }));
        setPagination(latestPagination);
        setPrintAllRows(true);
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        window.print();
      } else {
        downloadOperationalLedgerText(fullRows);
      }
      setDocumentRetryMode("");
      setMessage(`전체 ${fullRows.length.toLocaleString("ko-KR")}개 절차 ${mode === "PRINT" ? "인쇄 준비" : "텍스트 내보내기"}가 완료되었습니다.`);
    } catch (reason) {
      if (isAbortError(reason)) {
        setMessage(`${mode === "PRINT" ? "인쇄" : "텍스트 내보내기"}용 전체 자료 수집을 중단했습니다. 같은 버튼으로 처음부터 다시 수집할 수 있습니다.`);
        return;
      }
      setError(requestErrorMessage(reason, `${mode === "PRINT" ? "인쇄" : "텍스트 내보내기"}용 전체 자료를 수집하지 못했습니다. 다시 시도해 주세요.`));
    } finally {
      if (bulkPageAbortRef.current === controller) bulkPageAbortRef.current = null;
      pageRequestInFlightRef.current = false;
      if (printStateApplied) {
        setPayload(browsingPayload);
        setPagination(browsingPagination);
      }
      setPrintAllRows(false);
      setDocumentBusy(false);
      setPageBusy(false);
    }
  }

  useEffect(() => {
    if (autoLoadPaused || busy || !pagination.hasNext) return;
    const controller = new AbortController();
    autoPageAbortRef.current = controller;
    const timer = window.setTimeout(() => {
      if (!controller.signal.aborted) void loadNextPage(controller.signal, true);
    }, 120);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (autoPageAbortRef.current === controller) autoPageAbortRef.current = null;
    };
  }, [autoLoadPaused, busy, pagination.hasNext, pagination.page]);

  useEffect(() => () => {
    autoPageAbortRef.current?.abort();
    bulkPageAbortRef.current?.abort();
  }, []);

  const items = payload.items ?? [];
  const workTypes = useMemo(() => {
    const registered = (payload.workTypes ?? []).map(row => ({
      code: text(row, "workTypeCode", "domainCode", "code"),
      name: text(row, "workTypeName", "domainName", "name"),
      order: number(row, "workTypeOrder", "domainOrder", "sortOrder", "order")
    }));
    const inferred = items.map(row => ({
      code: text(row, "workTypeCode", "domainCode"),
      name: text(row, "workTypeName", "domainName"),
      order: number(row, "workTypeOrder", "domainOrder", "sortOrder")
    }));
    return uniqueOptions([...registered, ...inferred]);
  }, [items, payload.workTypes]);

  const processes = useMemo(() => {
    const registered = (payload.processes ?? []).map(row => ({
      code: text(row, "processCode", "code"),
      name: text(row, "processName", "name"),
      workTypeCode: text(row, "workTypeCode", "domainCode"),
      order: number(row, "workflowOrder", "processOrder", "developmentOrder", "sortOrder", "order")
    }));
    const inferred = items.map(row => ({
      code: text(row, "processCode"),
      name: text(row, "processName"),
      workTypeCode: text(row, "workTypeCode", "domainCode"),
      order: number(row, "workflowOrder", "processOrder", "developmentOrder", "sortOrder")
    }));
    return Array.from(new Map([...registered, ...inferred].filter(option => option.code).map(option => [option.code, option])).values())
      .filter(option => !workTypeCode || option.workTypeCode === workTypeCode)
      .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, "ko"));
  }, [items, payload.processes, workTypeCode]);

  useEffect(() => {
    if (processCode && !processes.some(process => process.code === processCode)) setProcessCode("");
  }, [processCode, processes]);

  const orderedItems = useMemo(() => [...items].sort(compareRows), [items]);

  const filteredItems = useMemo(() => {
    const keyword = searchKeyword.trim().toLocaleLowerCase("ko-KR");
    return orderedItems
      .filter(row => !workTypeCode || text(row, "workTypeCode", "domainCode") === workTypeCode)
      .filter(row => !processCode || text(row, "processCode") === processCode)
      .filter(row => !resultFilter || normalizeResult(row) === resultFilter)
      .filter(row => !evidenceFilter || evidenceState(row) === evidenceFilter)
      .filter(row => !reviewFilter || normalizeAggregateReviewStatus(row) === reviewFilter)
      .filter(row => !keyword || rowSearchText(row).includes(keyword));
  }, [evidenceFilter, orderedItems, processCode, resultFilter, reviewFilter, searchKeyword, workTypeCode]);
  const displayedItems = printAllRows ? orderedItems : filteredItems;

  const computedSummary = useMemo(() => {
    const processCodes = new Set(items.map(row => text(row, "processCode")).filter(Boolean));
    const businessResultsByProcess = new Map<string, TestResult[]>();
    items.forEach(row => {
      const code = text(row, "processCode");
      if (code) businessResultsByProcess.set(code, [...(businessResultsByProcess.get(code) || []), normalizeBusinessResult(row)]);
    });
    const e2eCovered = Array.from(businessResultsByProcess.values()).filter(results => results.length > 0 && results.every(result => result !== "NOT_RUN")).length;
    const e2ePassed = Array.from(businessResultsByProcess.values()).filter(results => results.length > 0 && results.every(result => result === "PASSED")).length;
    return {
      totalProcesses: processCodes.size,
      totalSteps: items.length,
      passed: items.filter(row => normalizeResult(row) === "PASSED").length,
      blocked: items.filter(row => normalizeResult(row) === "BLOCKED").length,
      notRun: items.filter(row => normalizeResult(row) === "NOT_RUN").length,
      e2eCovered,
      e2ePassed,
      e2eUncovered: Math.max(0, processCodes.size - e2eCovered),
      fixtureSuiteBindings: items.reduce((sum, row) => sum + number(row, "fixtureSuiteCaseCount"), 0),
      fixtureSuiteCompleteSteps: items.filter(row => text(row, "fixtureSuiteCoverageState") === "COMPLETE").length,
      fixtureSuiteIncompleteSteps: items.filter(row => text(row, "fixtureSuiteCoverageState") !== "COMPLETE").length,
      fixtureSuiteCurrentRuns: items.reduce((sum, row) => sum + number(row, "fixtureSuiteCurrentRunCount"), 0),
      reviewed: items.filter(row => normalizeAggregateReviewStatus(row) === "REVIEWED").length,
      changeRequested: items.filter(row => normalizeAggregateReviewStatus(row) === "CHANGE_REQUESTED").length
    };
  }, [items]);

  const summary = payload.summary ?? {};
  const summaryValues: Array<[string, number, string]> = [
    ["불러온 프로세스", computedSummary.totalProcesses, "text-[#052b57]"],
    ["불러온 절차", computedSummary.totalSteps, "text-[#052b57]"],
    ["계약 통과", computedSummary.passed, "text-emerald-700"],
    ["계약 차단", computedSummary.blocked, "text-red-700"],
    ["계약 미점검", computedSummary.notRun, "text-slate-700"],
    ["업무 E2E 통과", computedSummary.e2ePassed, "text-blue-700"],
    ["업무 E2E 미검증", computedSummary.e2eUncovered, "text-amber-700"],
    ["사용자 검토 완료", computedSummary.reviewed, "text-blue-700"],
    ["변경 요청", computedSummary.changeRequested, "text-amber-700"]
  ];

  const generatedAt = payload.generatedAt || payload.evaluatedAt || text(summary, "generatedAt", "evaluatedAt", "lastExecutedAt") || "-";
  const selectedWorkTypeName = workTypes.find(option => option.code === workTypeCode)?.name || "전체 업무 종류";
  const selectedProcessName = processes.find(option => option.code === processCode)?.name || "전체 프로세스";
  const selectedResultName = resultFilter ? RESULT_LABELS[resultFilter as TestResult] : "전체 계약 결과";
  const loadProgressPercent = pagination.totalStepCount > 0 ? Math.min(100, Math.round(items.length / pagination.totalStepCount * 100)) : 0;
  const interactionBusy = busy || documentBusy || Boolean(rowBusyKey);

  function toggleRow(row: Row, index: number) {
    const key = rowKey(row, index);
    setExpandedRows(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function beginRowCommand(key: string) {
    if (busy || documentBusy || rowCommandBusyRef.current) return false;
    rowCommandBusyRef.current = key;
    setRowBusyKey(key);
    return true;
  }

  function finishRowCommand(key: string) {
    if (rowCommandBusyRef.current !== key) return;
    rowCommandBusyRef.current = "";
    setRowBusyKey(current => current === key ? "" : current);
  }

  function updateReviewDraft(row: Row, index: number, scope: ReviewScope, patch: Partial<ReviewDraft>) {
    const key = reviewDraftKey(row, index, scope);
    setReviewDrafts(current => ({
      ...current,
      [key]: { status: current[key]?.status || reviewStatusForScope(row, scope), note: current[key]?.note || reviewNoteForScope(row, scope), ...patch }
    }));
  }

  async function fetchExactReviewDetail(row: Row, index: number) {
    const key = rowKey(row, index);
    const query = new URLSearchParams({ processCode: text(row, "processCode"), stepCode: text(row, "stepCode") });
    const response = await fetch(`${base}/system-test-report/step-detail?${query.toString()}`, { credentials: "include", headers: { Accept: "application/json" } });
    const body = await readJsonResponse<Row>(response, "검토 대상 화면·기능 상세를 불러오지 못했습니다.");
    if (body.detailMode !== "SELECTED_STEP_FULL" || body.reviewCriticalFieldsComplete !== true) throw new Error("선택 절차의 전체 상세 응답이 아니어서 검토 저장을 차단했습니다.");
    const detail = body.item && typeof body.item === "object" && !Array.isArray(body.item) ? body.item as Row : undefined;
    if (!detail || detail.reviewAllowed !== true || detail.reviewCriticalFieldsComplete !== true || compactValueOmitted(detail.screenFunctionInventoryJson) || compactValueOmitted(firstValue(detail, "scopedReviewInventoryJson", "reviewScopesJson"))) throw new Error("전체 화면·기능·범위별 검토 목록을 불러오지 못해 검토 완료를 활성화할 수 없습니다.");
    const authoritative = { ...row, ...detail };
    setFullDetailRows(current => ({ ...current, [key]: authoritative }));
    setReviewDrafts(current => mergeReviewDrafts(current, [authoritative]));
    return authoritative;
  }

  async function saveReview(row: Row, index: number, scope: ReviewScope, status: "REVIEWED" | "CHANGE_REQUESTED") {
    const key = reviewDraftKey(row, index, scope);
    const busyKey = rowKey(row, index);
    const draft = reviewDrafts[key] || { status: reviewStatusForScope(row, scope), note: reviewNoteForScope(row, scope) };
    if (status === "CHANGE_REQUESTED" && !draft.note.trim()) {
      setError("변경 요청 사유를 입력해야 설계·기능 보완 작업으로 전달할 수 있습니다.");
      return;
    }
    if (!beginRowCommand(busyKey)) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${base}/system-test-report/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          processCode: text(row, "processCode"),
          stepCode: text(row, "stepCode"),
          ...(scope.screenResourceId ? { screenResourceId: scope.screenResourceId } : {}),
          ...(scope.capabilityCode !== "ALL" ? { capabilityCode: scope.capabilityCode } : {}),
          reviewStatus: status === "REVIEWED" ? "APPROVED" : "CHANGE_REQUESTED",
          reviewNote: draft.note.trim()
        })
      });
      const body = await readJsonResponse<Row>(response, "사용자 검토 결과를 저장하지 못했습니다.");
      const saved = body.review && typeof body.review === "object" && !Array.isArray(body.review) ? body.review as Row : body;
      const savedStatus = normalizeReviewStatus(saved);
      setReviewDrafts(current => ({ ...current, [key]: { status: savedStatus, note: text(saved, "reviewNote") || draft.note.trim() } }));
      setPayload(current => ({ ...current, items: (current.items ?? []).map((candidate, position) => rowKey(candidate, position) === rowKey(row, index) ? { ...candidate, ...saved } : candidate) }));
      setFullDetailRows(current => {
        const next = { ...current };
        delete next[busyKey];
        return next;
      });
      let authoritative: Row;
      try {
        authoritative = await fetchExactReviewDetail({ ...row, ...saved }, index);
        const authoritativeStatus = reviewStatusForScope(authoritative, scope);
        if (authoritativeStatus !== savedStatus) throw new Error(`저장 응답(${savedStatus})과 재조회 결과(${authoritativeStatus})가 일치하지 않습니다.`);
      } catch (syncReason) {
        setFullDetailRows(current => {
          const next = { ...current };
          delete next[busyKey];
          return next;
        });
        setMessage("");
        setError(`검토 저장은 완료됐지만 서버의 최신 화면·기능·범위별 검토 목록 동기화에 실패했습니다. stale 상세는 폐기했습니다. ‘전체 기능 목록 불러오기’로 다시 동기화해 주세요. ${requestErrorMessage(syncReason, "최신 상세 재조회 실패")}`);
        return;
      }
      const designFeedback = savedStatus === "CHANGE_REQUESTED"
        ? ` · 설계 검토 작업 ${text(saved, "linkedJobId") || "생성 대기"} · 다음 조치 ${text(saved, "nextAction") || "DEVELOPMENT_REVIEW_PENDING"}`
        : "";
      setMessage(`${text(row, "processName", "processCode")} · ${text(row, "stepName", "stepCode")} · ${scope.label} 검토를 ${REVIEW_LABELS[savedStatus]} 상태로 저장하고 exact step-detail 범위별 원장과 다시 동기화했습니다${designFeedback}. 이 상태는 절차 전체 승인이나 계약·E2E 통과를 의미하지 않습니다.`);
    } catch (reason) {
      setError(requestErrorMessage(reason, "사용자 검토 결과를 저장하지 못했습니다."));
    } finally {
      finishRowCommand(busyKey);
    }
  }

  async function loadFullReviewDetail(row: Row, index: number) {
    const key = rowKey(row, index);
    if (!beginRowCommand(key)) return;
    setError("");
    try {
      await fetchExactReviewDetail(row, index);
      setMessage(`${text(row, "stepName", "stepCode")}의 전체 화면·기능 목록을 불러왔습니다. 검토 범위를 선택할 수 있습니다.`);
    } catch (reason) {
      setError(requestErrorMessage(reason, "검토 대상 화면·기능 상세를 불러오지 못했습니다."));
    } finally {
      finishRowCommand(key);
    }
  }

  async function runRowAudit(row: Row, index: number) {
    const key = rowKey(row, index);
    if (!beginRowCommand(key)) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${base}/system-test-report/audit`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          domainCode: text(row, "workTypeCode", "domainCode"),
          processCode: text(row, "processCode"),
          stepCode: text(row, "stepCode"),
          compact: true,
          maxSteps: 1,
          maxTargets: 500
        })
      });
      const body = await readJsonResponse<Row>(response, "선택 절차 계약 점검에 실패했습니다.");
      if (body.businessFunctionsExecuted !== false) throw new Error("계약 점검 중 실제 업무 기능 실행이 감지되었습니다.");
      setMessage(`${text(row, "stepName", "stepCode")} 계약 점검 완료 · ${text(body, "outcome", "result") || "UNKNOWN"} · 대상 ${number(body, "targetCount").toLocaleString("ko-KR")}개 · 실제 업무 기능은 실행하지 않았습니다.`);
      await load();
    } catch (reason) {
      setError(requestErrorMessage(reason, "선택 절차 계약 점검에 실패했습니다."));
    } finally {
      finishRowCommand(key);
    }
  }

  function expandVisibleRows() {
    setExpandedRows(new Set(filteredItems.map((row, index) => rowKey(row, index))));
  }

  return <div className="system-process-test-report space-y-5" data-common-component="COMMON_OPERATIONAL_USAGE_VERIFICATION_LEDGER" data-testid="operational-usage-verification-ledger">
    <style>{`
      @media print {
        @page { size: A4 landscape; margin: 12mm; }
        body { background: #fff !important; }
        body * { visibility: hidden !important; }
        .system-process-test-report, .system-process-test-report * { visibility: visible !important; }
        .system-process-test-report { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; color: #111827 !important; }
        .system-process-test-report, .system-process-test-report * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .system-process-test-report .report-no-print { display: none !important; }
        .system-process-test-report .report-print-detail { display: table-row !important; }
        .system-process-test-report .report-print-break { break-inside: avoid; }
        .system-process-test-report .report-table-shell, .system-process-test-report .report-table-scroll { overflow: visible !important; }
        .system-process-test-report table { min-width: 0 !important; width: 100% !important; table-layout: fixed; font-size: 8pt !important; }
        .system-process-test-report thead { display: table-header-group; }
        .system-process-test-report tr, .system-process-test-report td, .system-process-test-report article { break-inside: avoid; }
        .system-process-test-report th, .system-process-test-report td { overflow-wrap: anywhere; padding: 5pt !important; }
        .system-process-test-report pre { max-height: none !important; overflow: visible !important; white-space: pre-wrap !important; }
        .system-process-test-report a { color: #111827 !important; text-decoration: none !important; }
      }
    `}</style>

    <section className="report-print-break rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.12em] text-blue-700">OPERATIONAL USAGE VERIFICATION LEDGER</p>
          <h2 className="mt-1 text-2xl font-black text-[#052b57]">{pagination.totalStepCount > 0 && items.length >= pagination.totalStepCount ? "전 시스템 실사용 검수 대장" : "실사용 검수 대장 · 부분 불러오기"}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">업무 종류 → 프로세스 → 절차 → 화면 → 담당 액터 → 기능 → 입력·출력 → 증적 → 다음 업무를 실제 사용 순서로 확인합니다. 계약 점검·시뮬레이션·실제 업무 E2E를 서로 다른 증적 등급으로 유지하며, 사용자의 검토 완료나 변경 요청이 자동으로 테스트 통과를 뜻하지 않습니다.</p>
          <p className="mt-2 text-xs font-medium text-slate-500">결과 생성 시각: {formatDateTime(generatedAt)}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{printAllRows ? "인쇄 범위: 전체 업무·프로세스·절차" : `조회 범위: ${selectedWorkTypeName} · ${selectedProcessName} · ${selectedResultName}`} · 표시 {displayedItems.length.toLocaleString("ko-KR")}개 · 불러옴 {items.length.toLocaleString("ko-KR")} / {pagination.totalStepCount.toLocaleString("ko-KR")}개</p>
        </div>
        <div className="report-no-print flex shrink-0 flex-wrap gap-2">
          <button className={`min-h-11 rounded-lg border border-blue-300 bg-white px-4 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50 ${focusClass}`} disabled={busy || pageBusy || documentBusy} onClick={() => void load()} type="button">{busy ? "처리 중" : "첫 페이지 새로고침"}</button>
          <button className={`min-h-11 rounded-lg border border-[#174ea6] bg-[#174ea6] px-4 text-sm font-bold text-white hover:bg-[#0d3f8f] disabled:opacity-50 ${focusClass}`} disabled={busy || pageBusy || documentBusy} onClick={() => void runAudit()} type="button">선택 범위 계약 점검</button>
          <button className={`min-h-11 rounded-lg bg-[#246beb] px-5 text-sm font-black text-white hover:bg-[#1d56bd] disabled:opacity-50 ${focusClass}`} disabled={busy || pageBusy || documentBusy} onClick={() => void collectFullDocument("PRINT")} type="button">{documentBusy ? "전체 상세 수집 중" : "전체 상세 불러와 인쇄"}</button>
          <button className={`min-h-11 rounded-lg border border-emerald-600 bg-white px-4 text-sm font-black text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 ${focusClass}`} disabled={busy || pageBusy || documentBusy} onClick={() => void collectFullDocument("TEXT")} type="button">전체 실사용 기록 텍스트(.txt) 내보내기</button>
          {documentBusy && <button className={`min-h-11 rounded-lg border border-red-300 bg-white px-4 text-sm font-black text-red-700 hover:bg-red-50 ${focusClass}`} onClick={() => bulkPageAbortRef.current?.abort()} type="button">전체 자료 수집 중단</button>}
        </div>
      </div>
    </section>

    {message && <div className="report-no-print rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status"><strong className="block text-emerald-800">처리 상태</strong><span className="mt-1 block text-sm text-emerald-700">{message}</span></div>}
    {error && <div className="report-no-print flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert"><div><strong className="block text-red-800">처리 실패</strong><span className="mt-1 block text-sm text-red-700">{error}</span></div><button className={`min-h-10 shrink-0 rounded-lg border border-red-300 bg-white px-4 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50 ${focusClass}`} disabled={busy || pageBusy || documentBusy} onClick={() => void (documentRetryMode ? collectFullDocument(documentRetryMode) : items.length > 0 && pagination.hasNext ? loadNextPage() : load())} type="button">다시 시도</button></div>}
    <p aria-live="polite" className="sr-only" role="status">{busy || pageBusy || documentBusy ? "전체 프로세스 실사용 검수 결과를 처리하고 있습니다." : `검수 결과 ${displayedItems.length}개를 표시하며 전체 ${pagination.totalStepCount}개 중 ${items.length}개를 불러왔습니다.`}</p>

    <section className="report-no-print rounded-2xl border border-blue-200 bg-white p-5" aria-label="실사용 검수 대장 불러오기 진행률">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="font-black text-[#052b57]">검수 대장 불러오기</h3><p className="mt-1 text-sm text-slate-600">구조 순서 원장 기준 {items.length.toLocaleString("ko-KR")} / {pagination.totalStepCount.toLocaleString("ko-KR")}개 · {loadProgressPercent}% · 페이지 {pagination.page + 1} · {pagination.mode} · 자동 불러오기 {autoLoadPaused ? "일시정지" : "진행 중"}</p></div><div className="flex flex-wrap gap-2"><button className={`min-h-10 rounded-lg border border-violet-300 bg-white px-4 text-sm font-black text-violet-800 hover:bg-violet-50 disabled:opacity-50 ${focusClass}`} disabled={busy || documentBusy || !pagination.hasNext} onClick={() => { setAutoLoadPaused(current => !current); autoPageAbortRef.current?.abort(); }} type="button">{autoLoadPaused ? "자동 불러오기 계속" : "자동 불러오기 일시정지"}</button><button className={`min-h-10 rounded-lg border border-blue-300 bg-white px-4 text-sm font-black text-blue-700 hover:bg-blue-50 disabled:opacity-50 ${focusClass}`} disabled={busy || pageBusy || documentBusy || !pagination.hasNext} onClick={() => void loadNextPage()} type="button">{pageBusy ? "불러오는 중" : `다음 ${pagination.size}개`}</button><button className={`min-h-10 rounded-lg border border-slate-300 bg-slate-800 px-4 text-sm font-black text-white hover:bg-slate-700 disabled:opacity-50 ${focusClass}`} disabled={busy || pageBusy || documentBusy || !pagination.hasNext} onClick={() => void loadRemainingPages()} type="button">나머지 모두 불러오기</button></div></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="검수 대장 불러오기 진행률" aria-valuemax={100} aria-valuemin={0} aria-valuenow={loadProgressPercent}><span className="block h-full bg-[#246beb] transition-[width]" style={{ width: `${loadProgressPercent}%` }}/></div>
      {!pagination.hasNext && pagination.totalStepCount > 0 && <p className="mt-3 text-xs font-bold text-emerald-700">전체 페이지를 중복 없이 순서대로 불러왔습니다. 인쇄와 사용자 검토가 가능합니다.</p>}
    </section>

    <section className="report-print-break grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="계약 점검 및 업무 E2E 결과 요약" data-help-id="usage-ledger-summary">
      <div className="sm:col-span-2 lg:col-span-3 xl:col-span-5" data-help-id="operational-ledger-summary"><h3 className="font-black text-[#052b57]">현재 불러온 범위 누적 요약</h3><p className="mt-1 text-xs text-slate-500">아래 수치는 현재까지 불러온 {items.length.toLocaleString("ko-KR")}개 절차 기준입니다. 전체 수치는 모든 페이지를 불러온 뒤 확정됩니다.</p></div>
      {summaryValues.map(([label, metric, color]) => <article className="rounded-xl border border-slate-200 bg-white p-4" key={label}><span className="text-xs font-bold text-slate-500">{label}</span><strong className={`mt-1 block text-2xl font-black ${color}`}>{metric.toLocaleString("ko-KR")}</strong></article>)}
    </section>

    <section className="report-print-break rounded-2xl border border-violet-200 bg-violet-50/40 p-5" aria-label="워크플로 픽스처 스위트 범위">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-black tracking-[0.1em] text-violet-700">WORKFLOW FIXTURE SUITE COVERAGE</p><h3 className="mt-1 font-black text-[#052b57]">5대 안전 시나리오 전체 등록·실행 증적</h3><p className="mt-1 text-sm leading-6 text-slate-600">HAPPY_PATH · AUTHORITY · ISOLATION · EXCEPTION · RECOVERY 바인딩 전체를 집계합니다. 계약 건전성 감사가 선택하는 정상 픽스처 1건 및 실제 업무 E2E와 서로 다른 증적입니다.</p></div>
        <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-black text-violet-800">읽기 전용 · 업무 명령 미실행</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FixtureMetric label="단계·픽스처 바인딩" value={computedSummary.fixtureSuiteBindings}/>
        <FixtureMetric label="5종 완비 단계" value={computedSummary.fixtureSuiteCompleteSteps}/>
        <FixtureMetric label="유형 보완 필요 단계" value={computedSummary.fixtureSuiteIncompleteSteps} warning/>
        <FixtureMetric label="현행 버전 실행 증적" value={computedSummary.fixtureSuiteCurrentRuns}/>
      </div>
    </section>

    <section className="report-no-print rounded-2xl border border-slate-200 bg-white p-5" aria-label="테스트 결과 필터" data-help-id="usage-ledger-filter">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-help-id="operational-ledger-filters">
        <label className="text-sm font-bold text-slate-700">업무 종류
          <select className={fieldClass} value={workTypeCode} onChange={event => { setWorkTypeCode(event.target.value); setProcessCode(""); }}>
            <option value="">전체 업무 종류</option>
            {workTypes.map(option => <option key={option.code} value={option.code}>{option.name || option.code}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">업무 프로세스
          <select className={fieldClass} value={processCode} onChange={event => setProcessCode(event.target.value)}>
            <option value="">전체 프로세스</option>
            {processes.map(option => <option key={option.code} value={option.code}>{option.name || option.code}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">계약 점검 결과
          <select className={fieldClass} value={resultFilter} onChange={event => setResultFilter(event.target.value)}>
            <option value="">전체 결과</option>
            <option value="PASSED">계약 통과</option>
            <option value="BLOCKED">계약 차단</option>
            <option value="NOT_RUN">미점검</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">실행 증적 등급
          <select className={fieldClass} value={evidenceFilter} onChange={event => setEvidenceFilter(event.target.value as EvidenceFilter)}>
            <option value="">전체 증적</option>
            <option value="BUSINESS_E2E">실제 업무 E2E</option>
            <option value="CONTRACT_SIMULATION">계약 점검·시뮬레이션</option>
            <option value="DESIGN">설계만 등록·실행 증적 없음</option>
            <option value="NO_EVIDENCE">실행 증적 없음</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">사용자 검토 상태
          <select className={fieldClass} value={reviewFilter} onChange={event => setReviewFilter(event.target.value)}>
            <option value="">전체 검토 상태</option>
            <option value="UNREVIEWED">미검토</option>
            <option value="REVIEWED">검토 완료</option>
            <option value="CHANGE_REQUESTED">설계·기능 변경 요청</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">통합 검색
          <input className={fieldClass} onChange={event => setSearchKeyword(event.target.value)} placeholder="업무·절차·화면·담당자·기능·경로" type="search" value={searchKeyword}/>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-600">조건에 맞는 절차 <strong className="text-[#052b57]">{filteredItems.length.toLocaleString("ko-KR")}개</strong></p>
        <div className="flex flex-wrap gap-2">
          <button className={`min-h-10 rounded-lg border border-blue-300 bg-white px-4 text-sm font-bold text-blue-700 hover:bg-blue-50 ${focusClass}`} onClick={expandVisibleRows} type="button">현재 결과 모두 펼치기</button>
          <button className={`min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 ${focusClass}`} onClick={() => setExpandedRows(new Set())} type="button">모두 접기</button>
          <button className={`min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 ${focusClass}`} onClick={() => { setWorkTypeCode(""); setProcessCode(""); setResultFilter(""); setEvidenceFilter(""); setReviewFilter(""); setSearchKeyword(""); }} type="button">필터 초기화</button>
        </div>
      </div>
    </section>

    <section className="report-table-shell overflow-hidden rounded-2xl border border-slate-200 bg-white" data-help-id="usage-ledger-table">
      <p className="report-no-print border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500 lg:hidden" id={scrollHelpId}>표를 좌우로 이동하면 모든 계약과 E2E 결과를 확인할 수 있습니다.</p>
      <div aria-describedby={scrollHelpId} aria-label="전체 프로세스 계약 점검 결과 표" className={`report-table-scroll overflow-x-auto overscroll-x-contain ${focusClass}`} data-help-id="operational-ledger-table" role="region" tabIndex={0}>
        <table className="w-full min-w-[2240px] border-collapse text-left text-sm">
          <caption className="sr-only">업무 종류, 프로세스, 절차 순서, 화면, 기능, 담당자, 입력·출력 증적, 다음 업무와 사용자 검토 목록</caption>
          <thead className="bg-slate-50 text-xs font-black text-slate-600">
            <tr>
              <th className="w-20 px-4 py-3" scope="col">순서</th>
              <th className="min-w-44 px-4 py-3" scope="col">업무 종류</th>
              <th className="min-w-64 px-4 py-3" scope="col">프로세스</th>
              <th className="min-w-72 px-4 py-3" scope="col">절차</th>
              <th className="min-w-72 px-4 py-3" scope="col">화면·기능</th>
              <th className="min-w-48 px-4 py-3" scope="col">담당자·계정</th>
              <th className="min-w-32 px-4 py-3" scope="col">계약 점검</th>
              <th className="min-w-44 px-4 py-3" scope="col">픽스처 스위트</th>
              <th className="min-w-36 px-4 py-3" scope="col">시뮬레이션 증적</th>
              <th className="min-w-32 px-4 py-3" scope="col">업무 E2E</th>
              <th className="min-w-64 px-4 py-3" scope="col">다음 업무</th>
              <th className="min-w-44 px-4 py-3" scope="col">사용자 검토</th>
              <th className="min-w-40 px-4 py-3" scope="col">최근 실행</th>
              <th className="report-no-print min-w-64 px-4 py-3 text-right" scope="col">실행</th>
            </tr>
          </thead>
          <tbody>
            {displayedItems.map((row, index) => {
              const key = rowKey(row, index);
              const expanded = expandedRows.has(key);
              const result = normalizeResult(row);
              const detailId = `system-process-test-detail-${safeId(key)}`;
              const routePath = primaryRoutePath(row);
              const next = resolveNextDestination(row, orderedItems);
              const effectiveRow = fullDetailRows[key] || row;
              const reviewReady = Boolean(fullDetailRows[key]) && !compactValueOmitted(effectiveRow.screenFunctionInventoryJson);
              const scopes = reviewReady ? buildReviewScopes(effectiveRow) : [];
              const defaultScopeKey = savedReviewScopeKey(effectiveRow) || scopes[0]?.key || "STEP:ALL";
              const selectedScopeKey = reviewScopeKeys[key] || defaultScopeKey;
              const selectedScope = scopes.find(scope => scope.key === selectedScopeKey) || scopes[0] || { key: "STEP:ALL", label: "절차 전체", capabilityCode: "ALL", partial: false };
              const draftKey = reviewDraftKey(effectiveRow, index, selectedScope);
              const review = reviewDrafts[draftKey] || { status: reviewStatusForScope(effectiveRow, selectedScope), note: reviewNoteForScope(effectiveRow, selectedScope) };
              const aggregateReview = normalizeAggregateReviewStatus(row);
              const rowBusy = interactionBusy;
              return <Fragment key={key}>
                <tr className="report-print-break border-t border-slate-200 align-top hover:bg-blue-50/40">
                  <td className="px-4 py-4 font-black text-[#052b57]">{sequenceLabel(row, index)}</td>
                  <td className="px-4 py-4"><strong className="block text-slate-800">{text(row, "workTypeName", "domainName") || "미분류 업무"}</strong><span className="mt-1 block font-mono text-[11px] text-slate-400">{text(row, "workTypeCode", "domainCode") || "-"}</span></td>
                  <td className="px-4 py-4"><strong className="block text-[#052b57]">{text(row, "processName") || text(row, "processCode") || "-"}</strong><span className="mt-1 block font-mono text-[11px] text-slate-400">{text(row, "processCode") || "-"}</span></td>
                  <td className="px-4 py-4"><strong className="block text-slate-800">{stepLabel(row, index)}</strong><span className="mt-1 block font-mono text-[11px] text-slate-400">{text(row, "stepCode") || "-"}</span></td>
                  <td className="px-4 py-4"><strong className="block text-slate-800">{text(row, "screenName") || "연결 화면 미등록"}</strong><span className="mt-1 block break-all font-mono text-[11px] text-slate-500">{routePath || "경로 없음"}</span><span className="mt-2 line-clamp-2 block text-xs leading-5 text-blue-700">{text(row, "functionCodes", "capabilityNames", "functionNames") || "기능 계약 미등록"}</span></td>
                  <td className="px-4 py-4"><span className="block font-bold text-slate-700">{text(row, "actorName", "assigneeName") || "담당자 미지정"}</span><span className="mt-1 block font-mono text-[11px] text-slate-400">{text(row, "actorCode", "assigneeActorCode") || "-"}</span><span className="mt-2 block text-xs text-slate-500">전체 범위 후보 계정 {text(row, "assignedAccountCount") || "0"}개</span><span className="mt-1 block text-xs text-blue-700">실제 실행 {text(row, "businessExecutedBy", "actualExecutedBy", "executedBy") || "증적 없음"}</span></td>
                  <td className="px-4 py-4"><ResultBadge result={result}/>{text(row, "latestBlockerCodes", "resultMessage", "message", "failureReason") && <span className="mt-2 line-clamp-2 block max-w-56 text-xs leading-5 text-slate-500">{formatStructuredValue(firstValue(row, "latestBlockerCodes", "resultMessage", "message", "failureReason"))}</span>}</td>
                  <td className="px-4 py-4"><FixtureSuiteBadge row={row}/><span className="mt-2 block max-w-56 text-xs leading-5 text-slate-500">{text(row, "fixtureSuiteMissingTypes") ? `누락: ${text(row, "fixtureSuiteMissingTypes")}` : `${text(row, "fixtureSuiteCoveredTypeCount") || "0"}/5 유형 · ${text(row, "fixtureSuiteCaseCount") || "0"}건`}</span></td>
                  <td className="px-4 py-4"><SimulationResultBadge row={row}/><span className="mt-2 block max-w-48 text-xs leading-5 text-slate-500">{text(row, "simulationCaseCode") || "시뮬레이션 증적 없음"}</span></td>
                  <td className="px-4 py-4"><BusinessResultBadge row={row}/><span className="mt-2 block max-w-48 text-xs leading-5 text-slate-500">{text(row, "businessEvidenceStatus") || "EVIDENCE_LEDGER_UNAVAILABLE"}</span></td>
                  <td className="px-4 py-4"><strong className="block text-slate-800">{next.label}</strong><span className="mt-1 block font-mono text-[11px] text-slate-400">{next.code || "-"}</span><span className="mt-2 block text-xs text-slate-500">{next.sourceLabel}</span><TransitionTruthSummary row={row}/></td>
                  <td className="px-4 py-4"><ReviewBadge scopeLabel={savedReviewScopeLabel(row)} status={aggregateReview}/>{text(row, "reviewedBy") && <span className="mt-2 block text-xs text-slate-500">{text(row, "reviewedBy")} · {formatDateTime(text(row, "reviewedAt"))}</span>}</td>
                  <td className="px-4 py-4 text-xs leading-5 text-slate-600">{formatDateTime(text(row, "executedAt", "latestExecutedAt", "lastExecutedAt", "testedAt"))}<span className="block text-slate-400">계약 점검</span></td>
                  <td className="report-no-print px-4 py-4"><div className="flex flex-wrap justify-end gap-2">{routePath ? <a className={`inline-flex min-h-10 items-center rounded-lg border border-blue-300 bg-white px-3 font-bold text-blue-700 hover:bg-blue-50 ${focusClass}`} href={routePath} rel="noreferrer" target="_blank">화면 열기<span className="sr-only">: {text(row, "screenName", "stepName") || routePath} (새 창)</span></a> : <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-bold text-slate-400">경로 없음</span>}<button className={`min-h-10 rounded-lg border border-violet-300 bg-white px-3 font-bold text-violet-800 hover:bg-violet-50 disabled:opacity-50 ${focusClass}`} disabled={rowBusy} onClick={() => void runRowAudit(row, index)} type="button">{rowBusy ? "점검 중" : "계약 재점검"}</button><button aria-controls={detailId} aria-expanded={expanded} className={`min-h-10 rounded-lg bg-slate-800 px-3 font-bold text-white hover:bg-slate-700 disabled:opacity-50 ${focusClass}`} disabled={rowBusy} onClick={() => { toggleRow(row, index); if (!expanded && !reviewReady) void loadFullReviewDetail(row, index); }} type="button">{expanded ? "상세 접기" : "상세 보기"}<span className="sr-only">: {text(row, "processName", "processCode")} {text(row, "stepName", "stepCode")}</span></button></div></td>
                </tr>
                <tr className={`report-print-detail border-t border-slate-100 bg-slate-50/70 ${expanded ? "table-row" : "hidden"}`} id={detailId}>
                  <td className="px-4 py-5" colSpan={14}>
                    <StepDetail row={effectiveRow} next={next}/>
                    <ReviewEditor busy={rowBusy} draft={review} onChange={patch => updateReviewDraft(effectiveRow, index, selectedScope, patch)} onLoadDetail={() => void loadFullReviewDetail(row, index)} onSave={status => void saveReview(effectiveRow, index, selectedScope, status)} onScopeChange={scopeKey => setReviewScopeKeys(current => ({ ...current, [key]: scopeKey }))} ready={reviewReady} row={effectiveRow} scopes={scopes} selectedScope={selectedScope}/>
                  </td>
                </tr>
              </Fragment>;
            })}
            {!busy && displayedItems.length === 0 && <tr><td className="px-6 py-14 text-center text-slate-500" colSpan={14}>선택한 조건에 해당하는 점검 절차가 없습니다.</td></tr>}
            {busy && displayedItems.length === 0 && <tr><td className="px-6 py-14 text-center font-bold text-blue-700" colSpan={14}>전체 프로세스 계약 점검 결과를 불러오는 중입니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <section className="report-print-break rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-black text-[#052b57]">계약 점검과 실제 업무 E2E 판정 기준</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">현재 자동 점검 모드는 <strong className="text-[#052b57]">{payload.auditMode || "CONTRACT_ONLY"}</strong>입니다. 화면·라우트·권한·데이터·테스트 계약과 저장된 실행 증적을 검사하며, 저장·승인·삭제 같은 실제 업무 명령은 별도의 종단간 테스트에서 실행합니다.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ResultRule result="PASSED" text="액터·상태·입출력·라우트·화면·API·테스트 계약의 필수 참조가 모두 일치합니다. 실제 업무 기능 통과를 뜻하지 않습니다."/>
        <ResultRule result="BLOCKED" text="필수 계약이 누락되거나 서로 불일치하여 구현 또는 E2E 테스트에 진입할 수 없습니다. 원인 제거 후 계약 점검을 다시 실행해야 합니다."/>
        <ResultRule result="NOT_RUN" text="계약 점검 증적이 아직 없습니다. 계약 통과 또는 업무 E2E 통과로 간주하지 않습니다."/>
      </div>
      <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><strong>업무 E2E 통과</strong>는 실제 권한 계정으로 화면과 API를 사용해 저장·조회·승인·반려·삭제·복구 등 해당 시나리오를 수행하고, 입력·출력·DB 재조회·증적이 일치한 경우에만 표시합니다.</p>
    </section>
  </div>;
}

function TransitionTruthSummary({ row }: { row: Row }) {
  const destinations = parseNextTransitions(row);
  const edgeActors = Array.from(new Set(destinations.map(destination => text(destination, "edgeActorCode")).filter(Boolean)));
  const targetActors = Array.from(new Set(destinations.map(destination => text(destination, "targetActorCode")).filter(Boolean)));
  const routeResolutions = Array.from(new Set(destinations.map(destination => text(destination, "routeResolution")).filter(Boolean)));
  const actualRoute = actualBusinessRoutePath(row);
  return <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-[11px] leading-4 text-slate-600">
    <span className="block">저장된 전이 계약 액터: {edgeActors.join(", ") || "명시 없음"}</span>
    <span className="block">현재 대상 절차 액터: {targetActors.join(", ") || "명시 없음"}</span>
    <span className="block">경로 판정: {routeResolutions.join(", ") || "호환용 후보"}</span>
    <span className={`block font-bold ${actualRoute ? "text-emerald-700" : "text-slate-500"}`}>실제 E2E 경로: {actualRoute || "증적 없음"}</span>
  </div>;
}

function StepDetail({ row, next }: { row: Row; next: NextDestination }) {
  const sections: Array<[string, unknown, string]> = [
    ["화면·라우트", firstValue(row, "screenRoutes", "routePath", "screenPath", "entryPath") || "등록되지 않음", `${text(row, "screenCount") || "0"}개 연결 화면 · ${text(row, "implementationStatuses") || "구현 상태 미등록"}`],
    ["화면별 기능 목록", firstValue(row, "screenFunctionInventoryJson"), "연결 화면마다 등록된 기능·capability·라우트 목록"],
    ["다음 업무 분기 계약", firstValue(row, "nextDestinationsJson", "nextTransitionsJson"), `${text(row, "nextDestinationCount") || "0"}개 목적지 · ${text(row, "nextHasBranching") || "false"} 분기 · ${text(row, "nextTransitionMode") || "GUIDE_ONLY"} · STEP_ORDER는 강제 전이가 아닌 안내 순서`],
    ["실행 명령", text(row, "commandName", "commandCode", "actionCode") || "등록되지 않음", text(row, "commandCode", "actionCode") || "명령 코드 없음"],
    ["입력 계약", firstValue(row, "inputContract", "input"), "필수 입력 필드와 데이터 계약"],
    ["실제 실행 입력값", firstValue(row, "actualInput", "latestInput", "latestPreInputJson", "inputValues", "inputJson", "requestBody"), "최근 연결 증적에 저장된 입력값"],
    ["출력 계약", firstValue(row, "outputContract", "output"), "결과값과 다음 절차 인계 계약"],
    ["실제 실행 출력값", firstValue(row, "actualOutput", "latestOutput", "outputValues", "outputJson", "responseBody"), "최근 연결 증적에 저장된 출력값"],
    ["API 계약", firstValue(row, "apiContract"), "연결 엔드포인트와 요청·응답 계약"],
    ["기능", firstValue(row, "functionCodes", "capabilityNames", "functions", "capabilities", "functionNames"), "화면에서 검증할 공통·업무 기능"],
    ["액터 기능 권한", firstValue(row, "actorCapabilityCodes", "authorityResult", "permissionResult"), "선택 액터가 사용할 수 있는 기능 권한"],
    ["실행 증적", firstValue(row, "actualEvidenceJson", "evidenceJson", "latestEvidenceJson", "evidence", "evidencePath", "evidenceHash"), "실행 등급별 로그·해시·실행 ID"]
  ];
  return <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" data-help-id="usage-ledger-detail">
    <article className="rounded-xl border border-slate-200 bg-white p-4" data-help-id="operational-ledger-detail">
      <p className="text-xs font-black tracking-[0.08em] text-blue-700">ACTOR & AUTHORITY</p>
      <h4 className="mt-2 font-black text-[#052b57]">{text(row, "actorName", "assigneeName") || "담당자 미지정"}</h4>
      <dl className="mt-3 space-y-2 text-sm"><DetailLine label="액터 코드" value={text(row, "actorCode", "assigneeActorCode") || "-"}/><DetailLine label="계정 후보 범위" value={text(row, "assignmentScope") || "범위 계약 확인 필요"}/><DetailLine label="전체 범위 후보 계정 수" value={text(row, "assignedAccountCount") || "0"}/><DetailLine label="전체 범위 후보 계정" value={formatStructuredValue(firstValue(row, "assignedAccountIds")) || "확인된 후보 없음"}/><DetailLine label="실제 업무 실행 계정" value={text(row, "businessExecutedBy", "actualExecutedBy", "executedBy") || "실제 E2E 실행 증적 없음"}/><DetailLine label="권한 판정" value={text(row, "authorityResult", "permissionResult") || "확인 전"}/></dl>
    </article>
    {sections.map(([title, raw, description]) => <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4" key={title}>
      <p className="text-xs font-black tracking-[0.08em] text-blue-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <FormattedValue value={raw}/>
    </article>)}
    <article className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 lg:col-span-2 xl:col-span-3">
      <p className="text-xs font-black tracking-[0.08em] text-blue-700">NEXT WORK</p>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h4 className="font-black text-[#052b57]">{next.label}</h4><p className="mt-1 font-mono text-xs text-slate-500">{next.code || "다음 절차 계약 미등록"}</p><p className="mt-2 text-sm text-slate-600">{next.sourceLabel}</p></div>
        {next.routePath ? <a className={`report-no-print inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300 bg-white px-4 text-sm font-black text-emerald-800 hover:bg-emerald-50 ${focusClass}`} href={next.routePath} rel="noreferrer" target="_blank">실제 업무 E2E 실행 경로 열기<span className="sr-only"> (새 창)</span></a> : <span className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500">실제 업무 E2E 실행 경로 증적 없음</span>}
      </div>
    </article>
    <NextTransitionInventory row={row}/>
    <article className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2 xl:col-span-3">
      <p className="text-xs font-black tracking-[0.08em] text-blue-700">EVIDENCE CLASSIFICATION</p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4"><DetailLine label="증적 등급" value={evidenceTierLabel(row)}/><DetailLine label="실행 결과" value={normalizeActualResult(row)}/><DetailLine label="실행자" value={text(row, "businessExecutedBy", "simulationExecutedBy", "executedBy") || "확인 전"}/><DetailLine label="실행 시각" value={formatDateTime(text(row, "businessExecutedAt", "simulationExecutedAt", "executedAt"))}/></dl>
      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">계약 점검이나 시뮬레이션은 실제 저장·승인·반려·삭제 기능의 E2E 통과로 승격하지 않습니다. 실제 업무 계정·입력·출력·DB 재조회 증적이 현재 코드와 일치할 때만 업무 E2E로 표시합니다.</p>
    </article>
    <article className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 lg:col-span-2 xl:col-span-3">
      <p className="text-xs font-black tracking-[0.08em] text-amber-800">HUMAN REVIEW RECORD</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center"><ReviewBadge scopeLabel={savedReviewScopeLabel(row)} status={normalizeAggregateReviewStatus(row)}/><p className="text-sm leading-6 text-slate-700">{text(row, "reviewNote") || "저장된 사용자 검토 의견이 없습니다."}</p></div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-7"><DetailLine label="검토자" value={text(row, "reviewedBy") || "-"}/><DetailLine label="검토 시각" value={formatDateTime(text(row, "reviewedAt"))}/><DetailLine label="검토 화면" value={text(row, "reviewScreenResourceId") || "절차 전체"}/><DetailLine label="검토 기능" value={text(row, "reviewCapabilityCode") || "ALL"}/><DetailLine label="현재 계약 버전" value={booleanLabel(row.reviewCurrentVersion)}/><DetailLine label="연결 개발 작업" value={text(row, "linkedJobId", "reviewLinkedJobId") || "없음"}/><DetailLine label="다음 조치" value={text(row, "nextAction") || "NONE"}/></dl>
      <p className="mt-4 text-xs font-black text-amber-800">화면·기능 범위별 저장 기록 · 부분 검토는 절차 전체 승인으로 집계하지 않음</p>
      <FormattedValue value={firstValue(row, "scopedReviewInventoryJson", "reviewScopesJson")}/>
    </article>
    <article className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2 xl:col-span-3">
      <p className="text-xs font-black tracking-[0.08em] text-blue-700">LATEST CONTRACT AUDIT</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center"><ResultBadge result={normalizeResult(row)}/><p className="text-sm leading-6 text-slate-700">{formatStructuredValue(firstValue(row, "latestBlockerCodes", "resultMessage", "message", "failureReason")) || "상세 실행 메시지가 없습니다."}</p></div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4"><DetailLine label="계약 점검 ID" value={text(row, "latestRunId", "testRunId", "runId", "executionId") || "-"}/><DetailLine label="승인 시나리오" value={`${text(row, "approvedScenarioCount") || "0"}/${text(row, "scenarioCount") || "0"}`}/><DetailLine label="점검 계정" value={text(row, "executedBy", "latestExecutedBy", "accountName", "username") || "-"}/><DetailLine label="점검 시각" value={formatDateTime(text(row, "executedAt", "latestExecutedAt", "lastExecutedAt", "testedAt"))}/><DetailLine label="계약 검사" value={`${text(row, "latestPassedCheckCount") || "0"}/${text(row, "latestTotalCheckCount") || "0"}`}/><DetailLine label="차단 코드" value={formatStructuredValue(firstValue(row, "latestBlockerCodes")) || "-"}/><DetailLine label="완료 조건" value={text(row, "completionRule") || "-"}/><DetailLine label="소요 시간" value={durationLabel(row) || "-"}/></dl>
    </article>
    <article className={`rounded-xl border p-4 lg:col-span-2 xl:col-span-3 ${simulationResultClass(row)}`}>
      <p className="text-xs font-black tracking-[0.08em] text-violet-700">LATEST SIMULATION EVIDENCE</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center"><SimulationResultBadge row={row}/><p className="text-sm leading-6 text-slate-700">메타데이터·계약 시뮬레이션 증적이며 실제 업무 함수 실행 또는 업무 E2E 통과를 의미하지 않습니다.</p></div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5"><DetailLine label="시뮬레이션 실행 ID" value={number(row, "latestSimulationRunId") > 0 ? text(row, "latestSimulationRunId") : "-"}/><DetailLine label="케이스 코드" value={text(row, "simulationCaseCode") || "-"}/><DetailLine label="케이스 유형" value={text(row, "simulationCaseType") || "-"}/><DetailLine label="추적 범위" value={text(row, "simulationTraceScope") || "-"}/><DetailLine label="프로세스 버전" value={text(row, "simulationProcessVersion") || "-"}/><DetailLine label="현재 계약 버전" value={booleanLabel(row.simulationCurrentVersion)}/><DetailLine label="실행 계정" value={text(row, "simulationExecutedBy") || "-"}/><DetailLine label="실행 시각" value={formatDateTime(text(row, "simulationExecutedAt"))}/></dl>
      <div className="mt-4"><p className="text-xs font-bold text-slate-500">시뮬레이션 증적</p><FormattedValue value={firstValue(row, "simulationEvidenceJson")}/></div>
    </article>
    <article className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 lg:col-span-2 xl:col-span-3">
      <p className="text-xs font-black tracking-[0.08em] text-violet-700">WORKFLOW FIXTURE SUITE</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center"><FixtureSuiteBadge row={row}/><p className="text-sm leading-6 text-slate-700">5대 안전 유형의 전체 바인딩과 최신 시뮬레이션 증적입니다. 대표 계약 감사 및 실제 업무 E2E 판정으로 승격하지 않습니다.</p></div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5"><DetailLine label="필수 유형" value={`${text(row, "fixtureSuiteCoveredTypeCount") || "0"}/${text(row, "fixtureSuiteRequiredTypeCount") || "5"}`}/><DetailLine label="활성 픽스처" value={text(row, "fixtureSuiteActiveCaseCount", "fixtureSuiteCaseCount") || "0"}/><DetailLine label="승인 픽스처" value={text(row, "fixtureSuiteApprovedCaseCount") || "0"}/><DetailLine label="현행 버전 실행" value={text(row, "fixtureSuiteCurrentRunCount") || "0"}/><DetailLine label="미실행" value={text(row, "fixtureSuiteNotRunCount") || "0"}/><DetailLine label="과거 버전 증적" value={text(row, "fixtureSuiteStaleRunCount") || "0"}/><DetailLine label="실행 통과" value={text(row, "fixtureSuitePassedRunCount") || "0"}/><DetailLine label="실행 차단" value={text(row, "fixtureSuiteBlockedRunCount") || "0"}/><DetailLine label="등록 유형" value={text(row, "fixtureSuiteCoveredTypes") || "-"}/><DetailLine label="누락 유형" value={text(row, "fixtureSuiteMissingTypes") || "없음"}/></dl>
      <div className="mt-4"><p className="text-xs font-bold text-slate-500">전체 픽스처 목록</p><FormattedValue value={firstValue(row, "fixtureSuiteCasesJson")}/></div>
    </article>
    <article className={`rounded-xl border p-4 lg:col-span-2 xl:col-span-3 ${businessResultClass(row)}`}>
      <p className="text-xs font-black tracking-[0.08em] text-blue-700">LATEST BUSINESS E2E EVIDENCE</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center"><BusinessResultBadge row={row}/><p className="text-sm leading-6 text-slate-700">실제 업무 계정·데이터·함수 실행 증적 원장이 연결될 때만 판정합니다. 시뮬레이션 결과로 승격하지 않습니다.</p></div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><DetailLine label="업무 E2E 증적 상태" value={text(row, "businessEvidenceStatus") || "EVIDENCE_LEDGER_UNAVAILABLE"}/><DetailLine label="업무 E2E 결과" value={normalizeBusinessResult(row)}/></dl>
    </article>
  </div>;
}

function RouteCandidate({ label, routePath, actual = false }: { label: string; routePath: string; actual?: boolean }) {
  const safePath = safeRoutePath(routePath);
  return <div className={`rounded-lg border p-3 ${actual ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
    <p className={`text-xs font-black ${actual ? "text-emerald-800" : "text-slate-600"}`}>{label}</p>
    {safePath ? <a className={`mt-1 block break-all font-mono text-xs font-bold underline ${actual ? "text-emerald-800" : "text-blue-700"} ${focusClass}`} href={safePath} rel="noreferrer" target="_blank">{safePath}<span className="sr-only"> (새 창)</span></a> : <span className="mt-1 block text-xs text-slate-500">등록 없음</span>}
  </div>;
}

function NextTransitionInventory({ row }: { row: Row }) {
  const registered = parseNextTransitions(row);
  const destinations = registered.length > 0 ? registered : [{
    edgeActorCode: text(row, "nextEdgeActorCode"),
    targetActorCode: text(row, "nextTargetActorCode"),
    actorCode: text(row, "actorCode"),
    userRoutePath: text(row, "nextUserRoutePath"),
    adminRoutePath: text(row, "nextAdminRoutePath"),
    routePath: text(row, "nextRoutePath"),
    routeResolution: text(row, "nextRouteResolution") || "LEGACY_CANDIDATE",
    nextProcessCode: text(row, "nextProcessCode"),
    nextStepCode: text(row, "nextStepCode"),
    nextStepName: text(row, "nextStepName"),
    edgeType: text(row, "nextTransitionSource") || "LEGACY"
  } satisfies Row];
  const actualRoute = actualBusinessRoutePath(row);
  return <article className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 lg:col-span-2 xl:col-span-3">
    <p className="text-xs font-black tracking-[0.08em] text-indigo-800">NEXT TRANSITION ACTOR & ROUTE CANDIDATES</p>
    <h4 className="mt-1 font-black text-[#052b57]">저장된 전이 계약 액터·현재 대상 절차 액터·사용자·관리자 경로를 분리 확인</h4>
    <p className="mt-2 text-xs leading-5 text-slate-600">후보 경로는 실제 실행 경로가 아닙니다. routeResolution이 SINGLE이어도 업무 E2E 증적에 저장된 실행 경로와 별도로 표시합니다. 기존 actorCode·routePath는 의미가 불명확한 호환용 후보로만 제공합니다.</p>
    <div className="mt-4"><RouteCandidate actual label="실제 업무 E2E 실행 경로" routePath={actualRoute}/>{actualRoute && destinations.length > 1 && <p className="mt-2 text-xs font-bold text-amber-800">실행 경로는 이 절차의 E2E 증적이며 특정 분기와의 연결은 별도 증적이 없으면 확정하지 않습니다.</p>}</div>
    <div className="mt-4 space-y-4">
      {destinations.map((destination, index) => {
        const edgeActorCode = text(destination, "edgeActorCode");
        const targetActorCode = text(destination, "targetActorCode");
        const legacyActorCode = text(destination, "actorCode");
        const userRoutePath = text(destination, "userRoutePath");
        const adminRoutePath = text(destination, "adminRoutePath");
        const legacyRoutePath = text(destination, "routePath", "nextRoutePath");
        return <section className="rounded-xl border border-indigo-200 bg-white p-4" key={`${text(destination, "edgeId") || "legacy"}-${index}`}>
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-black text-indigo-700">전이 {index + 1} · {text(destination, "edgeType") || "유형 미등록"}</p><h5 className="mt-1 font-black text-[#052b57]">{text(destination, "nextStepName") || text(destination, "nextStepCode") || "대상 절차 미등록"}</h5><p className="mt-1 font-mono text-xs text-slate-500">{[text(destination, "nextProcessCode"), text(destination, "nextStepCode")].filter(Boolean).join(" / ") || "대상 코드 없음"}</p></div><span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-800">{text(destination, "routeResolution") || "LEGACY_CANDIDATE"} · {transitionRouteResolution(destination)}</span></div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5"><DetailLine label="저장된 전이 계약 액터" value={edgeActorCode || "명시적 edgeActorCode 미등록"}/><DetailLine label="현재 대상 절차 액터" value={targetActorCode || "명시적 targetActorCode 미등록"}/><DetailLine label="기존 actorCode 호환용 후보" value={legacyActorCode || "없음"}/><DetailLine label="분기 조건 코드" value={text(destination, "conditionCode") || "조건 없음"}/><DetailLine label="분기 조건 계약" value={formatStructuredValue(firstValue(destination, "conditionContract")) || "조건 계약 없음"}/></dl>
          <div className="mt-4 grid gap-3 lg:grid-cols-3"><RouteCandidate label="사용자 경로 후보" routePath={userRoutePath}/><RouteCandidate label="관리자 경로 후보" routePath={adminRoutePath}/><RouteCandidate label="기존 routePath 호환용 후보" routePath={legacyRoutePath}/></div>
          <div className="mt-4"><p className="text-xs font-black text-indigo-800">화면별 전체 경로 후보 · audience·entryMode 포함</p><FormattedValue value={firstValue(destination, "screenRouteInventory")}/></div>
        </section>;
      })}
    </div>
  </article>;
}

function ReviewEditor({ row, draft, busy, ready, scopes, selectedScope, onChange, onSave, onScopeChange, onLoadDetail }: {
  row: Row;
  draft: ReviewDraft;
  busy: boolean;
  ready: boolean;
  scopes: ReviewScope[];
  selectedScope: ReviewScope;
  onChange: (patch: Partial<ReviewDraft>) => void;
  onSave: (status: "REVIEWED" | "CHANGE_REQUESTED") => void;
  onScopeChange: (scopeKey: string) => void;
  onLoadDetail: () => void;
}) {
  return <section className="report-no-print mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4" data-help-id="usage-ledger-review" data-testid="operational-review-editor">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between" data-help-id="operational-ledger-review">
      <div><p className="text-xs font-black tracking-[0.08em] text-amber-800">HUMAN DESIGN & FUNCTION REVIEW</p><h4 className="mt-1 font-black text-[#052b57]">이 절차를 직접 확인하고 설계에 환류</h4><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">사용자 검토는 사람의 확인 기록입니다. 검토 완료를 저장해도 계약 점검이나 실제 업무 E2E 결과는 바뀌지 않습니다.</p></div>
      <ReviewBadge scopeLabel={selectedScope.label} status={draft.status}/>
    </div>
    {!ready && <div className="mt-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between" role="alert"><p className="text-sm font-bold text-red-800">상세 기능 목록 로딩 필요 · 압축 응답에서 화면·기능 목록이 생략되어 검토 완료와 변경 요청을 저장할 수 없습니다.</p><button className={`min-h-10 shrink-0 rounded-lg border border-red-300 bg-white px-4 text-sm font-black text-red-700 hover:bg-red-50 disabled:opacity-50 ${focusClass}`} disabled={busy} onClick={onLoadDetail} type="button">전체 기능 목록 불러오기</button></div>}
    <label className="mt-4 block text-sm font-bold text-slate-700">검토 대상 화면·기능
      <select className={fieldClass} disabled={busy || !ready} onChange={event => onScopeChange(event.target.value)} value={selectedScope.key}>{!ready && <option value="STEP:ALL">상세 기능 목록을 먼저 불러오세요</option>}{scopes.map(scope => <option key={scope.key} value={scope.key}>{scope.label}</option>)}</select>
    </label>
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <label className="text-sm font-bold text-slate-700">검토 의견 또는 변경 요청 사유
        <textarea className={`mt-2 min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-[#246beb] focus:ring-2 focus:ring-blue-100 disabled:opacity-50 ${focusClass}`} disabled={busy || !ready} onChange={event => onChange({ note: event.target.value })} placeholder="화면·기능·입력값·출력값·다음 업무 중 무엇을 어떻게 수정해야 하는지 적어 주세요." value={draft.note}/>
      </label>
      <div className="flex flex-wrap gap-2 lg:max-w-72">
        <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 text-sm font-black text-blue-800 ${focusClass}`}>
          <input checked={draft.status === "REVIEWED"} disabled={busy || !ready} onChange={event => { if (event.currentTarget.checked) onSave("REVIEWED"); }} type="checkbox"/>
          검토 완료 저장
        </label>
        <button className={`min-h-11 rounded-lg border border-amber-400 bg-amber-100 px-4 text-sm font-black text-amber-900 hover:bg-amber-200 disabled:opacity-50 ${focusClass}`} disabled={busy || !ready || !draft.note.trim()} onClick={() => onSave("CHANGE_REQUESTED")} type="button">설계·기능 변경 요청</button>
      </div>
    </div>
    <dl className="mt-4 grid gap-3 border-t border-amber-200 pt-3 text-xs sm:grid-cols-2 xl:grid-cols-8"><DetailLine label="프로세스" value={text(row, "processCode") || "-"}/><DetailLine label="절차" value={text(row, "stepCode") || "-"}/><DetailLine label="검토 화면" value={selectedScope.screenResourceId ? String(selectedScope.screenResourceId) : "절차 전체"}/><DetailLine label="검토 기능" value={selectedScope.capabilityCode}/><DetailLine label="검토 계약 버전" value={text(row, "processVersion") || "확인 전"}/><DetailLine label="현재 버전 검토" value={booleanLabel(row.reviewCurrentVersion)}/><DetailLine label="연결 개발 작업" value={text(row, "linkedJobId", "reviewLinkedJobId") || "없음"}/><DetailLine label="다음 조치" value={text(row, "nextAction") || "NONE"}/></dl>
  </section>;
}

function ResultBadge({ result }: { result: TestResult }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${RESULT_CLASSES[result]}`}>{RESULT_LABELS[result]} · {result}</span>;
}

function ReviewBadge({ status, scopeLabel = "절차 전체" }: { status: ReviewStatus; scopeLabel?: string }) {
  const scopedLabel = status === "REVIEWED" && scopeLabel !== "절차 전체" ? "부분 검토 완료" : REVIEW_LABELS[status];
  return <span className={`inline-flex flex-col rounded-lg border px-3 py-1 text-xs font-black ${REVIEW_CLASSES[status]}`}><span>{scopedLabel} · {status}</span><span className="mt-0.5 max-w-48 truncate font-medium">{scopeLabel}</span></span>;
}

function FixtureMetric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <article className="rounded-xl border border-violet-100 bg-white p-4"><span className="text-xs font-bold text-slate-500">{label}</span><strong className={`mt-1 block text-2xl font-black ${warning && value > 0 ? "text-amber-700" : "text-violet-800"}`}>{value.toLocaleString("ko-KR")}</strong></article>;
}

function FixtureSuiteBadge({ row }: { row: Row }) {
  const state = text(row, "fixtureSuiteCoverageState") || "MISSING";
  const className = state === "COMPLETE" ? "border-violet-200 bg-violet-100 text-violet-800" : state === "PARTIAL" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-100 text-slate-700";
  const label = state === "COMPLETE" ? "5종 완비" : state === "PARTIAL" ? "유형 보완 필요" : "픽스처 미등록";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${className}`}>{label} · {state}</span>;
}

function BusinessResultBadge({ row }: { row: Row }) {
  const result = normalizeBusinessResult(row);
  const labels: Record<TestResult, string> = { PASSED: "E2E 통과", BLOCKED: "E2E 실패·차단", NOT_RUN: "E2E 미검증" };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${RESULT_CLASSES[result]}`}>{labels[result]} · {result}</span>;
}

function SimulationResultBadge({ row }: { row: Row }) {
  const result = normalizeSimulationResult(row);
  const labels: Record<TestResult, string> = { PASSED: "시뮬레이션 통과", BLOCKED: "시뮬레이션 차단", NOT_RUN: "시뮬레이션 미실행" };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${RESULT_CLASSES[result]}`}>{labels[result]} · {result}</span>;
}

function businessResultClass(row: Row) {
  const result = normalizeBusinessResult(row);
  return result === "PASSED" ? "border-emerald-200 bg-emerald-50/50" : result === "BLOCKED" ? "border-red-200 bg-red-50/50" : "border-slate-200 bg-slate-50";
}

function simulationResultClass(row: Row) {
  const result = normalizeSimulationResult(row);
  return result === "PASSED" ? "border-violet-200 bg-violet-50/50" : result === "BLOCKED" ? "border-red-200 bg-red-50/50" : "border-slate-200 bg-slate-50";
}

function ResultRule({ result, text: description }: { result: TestResult; text: string }) {
  return <article className={`rounded-xl border p-4 ${RESULT_CLASSES[result]}`}><ResultBadge result={result}/><p className="mt-3 text-sm leading-6">{description}</p></article>;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-800">{value}</dd></div>;
}

function FormattedValue({ value }: { value: unknown }) {
  const formatted = formatStructuredValue(value);
  return <pre aria-label="구조화된 계약 또는 증적 데이터" className={`mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100 ${focusClass}`} tabIndex={0}>{formatted || "등록된 값이 없습니다."}</pre>;
}

function normalizeResult(row: Row): TestResult {
  const raw = text(row, "testState", "latestResult", "result", "testResult", "resultStatus", "status").toUpperCase();
  if (["PASSED", "PASS", "SUCCESS", "VERIFIED", "COMPLETED"].includes(raw)) return "PASSED";
  if (["BLOCKED", "FAILED", "FAIL", "ERROR", "RETRY"].includes(raw)) return "BLOCKED";
  return "NOT_RUN";
}

function normalizeBusinessResult(row: Row): TestResult {
  const raw = text(row, "businessTestResult").toUpperCase();
  if (["PASSED", "PASS", "SUCCESS", "VERIFIED", "COMPLETED"].includes(raw)) return "PASSED";
  if (["BLOCKED", "FAILED", "FAIL", "ERROR", "RETRY"].includes(raw)) return "BLOCKED";
  return "NOT_RUN";
}

function normalizeSimulationResult(row: Row): TestResult {
  const raw = text(row, "simulationTestResult").toUpperCase();
  if (["PASSED", "PASS", "SUCCESS", "VERIFIED", "COMPLETED"].includes(raw)) return booleanLabel(row.simulationCurrentVersion) === "현재 버전" ? "PASSED" : "BLOCKED";
  if (["BLOCKED", "FAILED", "FAIL", "ERROR", "RETRY"].includes(raw)) return "BLOCKED";
  return "NOT_RUN";
}

function normalizeActualResult(row: Row): TestResult {
  const raw = text(row, "actualResult").toUpperCase();
  if (["PASSED", "PASS", "SUCCESS", "VERIFIED", "COMPLETED"].includes(raw)) return "PASSED";
  if (["BLOCKED", "FAILED", "FAIL", "ERROR", "RETRY"].includes(raw)) return "BLOCKED";
  const tier = evidenceState(row);
  if (tier === "BUSINESS_E2E") return normalizeBusinessResult(row);
  if (tier === "CONTRACT_SIMULATION") return normalizeSimulationResult(row) !== "NOT_RUN" ? normalizeSimulationResult(row) : normalizeResult(row);
  return "NOT_RUN";
}

function normalizeReviewStatus(row: Row): ReviewStatus {
  const raw = text(row, "reviewStatus", "humanReviewStatus").toUpperCase();
  if (["APPROVED", "REVIEWED", "CHECKED", "COMPLETED"].includes(raw)) return "REVIEWED";
  if (["CHANGE_REQUESTED", "REVISION_REQUIRED", "REJECTED"].includes(raw)) return "CHANGE_REQUESTED";
  return "UNREVIEWED";
}

function normalizeAggregateReviewStatus(row: Row): ReviewStatus {
  if (number(row, "reviewScreenResourceId") > 0 || !hasCurrentSavedReview(row)) return "UNREVIEWED";
  return normalizeReviewStatus(row);
}

function reviewRecordCurrent(row: Row) {
  const key = Object.prototype.hasOwnProperty.call(row, "currentVersion") ? "currentVersion" : Object.prototype.hasOwnProperty.call(row, "reviewCurrentVersion") ? "reviewCurrentVersion" : "";
  if (!key) return true;
  const value = row[key];
  return value === true || value === 1 || String(value).toLowerCase() === "true";
}

function hasCurrentSavedReview(row: Row) {
  const hasVersionFlag = Object.prototype.hasOwnProperty.call(row, "currentVersion") || Object.prototype.hasOwnProperty.call(row, "reviewCurrentVersion");
  return number(row, "reviewId") > 0 && hasVersionFlag && reviewRecordCurrent(row);
}

function compactValueOmitted(raw: unknown) {
  if (!raw) return false;
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Row).omitted === true);
  } catch { return false; }
}

function parseScreenFunctionInventory(row: Row) {
  const raw = row.screenFunctionInventoryJson;
  if (!raw || compactValueOmitted(raw)) return [] as Row[];
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(value) ? value.filter(item => item && typeof item === "object") as Row[] : [];
  } catch { return [] as Row[]; }
}

function parseScopedReviews(row: Row) {
  const raw = firstValue(row, "scopedReviewInventoryJson", "reviewScopesJson");
  if (!raw || compactValueOmitted(raw)) return [] as Row[];
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(value) ? value.filter(item => item && typeof item === "object") as Row[] : [];
  } catch { return [] as Row[]; }
}

function buildReviewScopes(row: Row): ReviewScope[] {
  const scopes: ReviewScope[] = [{ key: "STEP:ALL", label: "절차 전체", capabilityCode: "ALL", partial: false }];
  const seen = new Set(["STEP:ALL"]);
  parseScreenFunctionInventory(row).forEach(item => {
    const screenResourceId = number(item, "screenResourceId");
    if (screenResourceId <= 0) return;
    const screenName = text(item, "screenName") || `화면 ${screenResourceId}`;
    const routePath = text(item, "routePath") || "경로 없음";
    const screenKey = `SCREEN:${screenResourceId}:ALL`;
    if (!seen.has(screenKey)) {
      scopes.push({ key: screenKey, label: `${screenName} · ${routePath} · 전체 기능`, screenResourceId, capabilityCode: "ALL", partial: true });
      seen.add(screenKey);
    }
    const capabilityCode = text(item, "capabilityCode") || "ALL";
    if (capabilityCode === "ALL") return;
    const capabilityKey = `SCREEN:${screenResourceId}:CAPABILITY:${capabilityCode}`;
    if (!seen.has(capabilityKey)) {
      scopes.push({ key: capabilityKey, label: `${screenName} · ${routePath} · ${text(item, "capabilityName") || capabilityCode}`, screenResourceId, capabilityCode, partial: true });
      seen.add(capabilityKey);
    }
  });
  return scopes;
}

function scopeFromSavedReview(row: Row): ReviewScope {
  const screenResourceId = number(row, "reviewScreenResourceId");
  const capabilityCode = text(row, "reviewCapabilityCode") || "ALL";
  if (screenResourceId > 0) return { key: capabilityCode === "ALL" ? `SCREEN:${screenResourceId}:ALL` : `SCREEN:${screenResourceId}:CAPABILITY:${capabilityCode}`, label: savedReviewScopeLabel(row), screenResourceId, capabilityCode, partial: true };
  return { key: "STEP:ALL", label: "절차 전체", capabilityCode: "ALL", partial: false };
}

function scopeFromReviewRecord(review: Row): ReviewScope {
  const screenResourceId = number(review, "screenResourceId", "reviewScreenResourceId");
  const capabilityCode = text(review, "capabilityCode", "reviewCapabilityCode") || "ALL";
  if (screenResourceId > 0) return { key: capabilityCode === "ALL" ? `SCREEN:${screenResourceId}:ALL` : `SCREEN:${screenResourceId}:CAPABILITY:${capabilityCode}`, label: `화면 ${screenResourceId} · ${capabilityCode}`, screenResourceId, capabilityCode, partial: true };
  return { key: "STEP:ALL", label: "절차 전체", capabilityCode: "ALL", partial: false };
}

function savedReviewScopeKey(row: Row) {
  if (hasCurrentSavedReview(row)) return scopeFromSavedReview(row).key;
  const latestScoped = parseScopedReviews(row).find(hasCurrentSavedReview);
  return latestScoped ? scopeFromReviewRecord(latestScoped).key : "";
}

function savedReviewScopeLabel(row: Row) {
  const screenResourceId = number(row, "reviewScreenResourceId");
  const capabilityCode = text(row, "reviewCapabilityCode") || "ALL";
  if (hasCurrentSavedReview(row)) return screenResourceId > 0 ? `화면 ${screenResourceId} · ${capabilityCode}` : "절차 전체";
  const currentScopedReviews = parseScopedReviews(row).filter(review => hasCurrentSavedReview(review) && number(review, "screenResourceId") > 0);
  return currentScopedReviews.length > 0 ? `부분 검토 ${currentScopedReviews.length}건 · 절차 전체 미승인` : "절차 전체";
}

function reviewStatusForScope(row: Row, scope: ReviewScope): ReviewStatus {
  if (hasCurrentSavedReview(row) && scopeFromSavedReview(row).key === scope.key) return normalizeReviewStatus(row);
  const scoped = parseScopedReviews(row).find(review => scopeFromReviewRecord(review).key === scope.key);
  return scoped && hasCurrentSavedReview(scoped) ? normalizeReviewStatus(scoped) : "UNREVIEWED";
}

function reviewNoteForScope(row: Row, scope: ReviewScope) {
  if (hasCurrentSavedReview(row) && scopeFromSavedReview(row).key === scope.key) return text(row, "reviewNote", "changeRequestNote");
  const scoped = parseScopedReviews(row).find(review => scopeFromReviewRecord(review).key === scope.key);
  return scoped && hasCurrentSavedReview(scoped) ? text(scoped, "reviewNote", "changeRequestNote") : "";
}

function reviewDraftKey(row: Row, index: number, scope: ReviewScope) {
  return `${rowKey(row, index)}:${scope.key}`;
}

function evidenceState(row: Row): Exclude<EvidenceFilter, ""> {
  const raw = text(row, "evidenceTier").toUpperCase();
  if (raw === "BUSINESS_E2E") return "BUSINESS_E2E";
  if (raw === "CONTRACT_SIMULATION" || raw === "SIMULATION" || raw === "CONTRACT") return "CONTRACT_SIMULATION";
  if (raw === "DESIGN") return "DESIGN";
  if (normalizeBusinessResult(row) !== "NOT_RUN") return "BUSINESS_E2E";
  if (normalizeSimulationResult(row) !== "NOT_RUN" || normalizeResult(row) !== "NOT_RUN") return "CONTRACT_SIMULATION";
  return "NO_EVIDENCE";
}

function evidenceTierLabel(row: Row) {
  const tier = evidenceState(row);
  if (tier === "BUSINESS_E2E") return "실제 업무 E2E · BUSINESS_E2E";
  if (tier === "CONTRACT_SIMULATION") return "계약 점검·시뮬레이션 · CONTRACT_SIMULATION";
  if (tier === "DESIGN") return "설계만 등록·실행 증적 없음 · DESIGN";
  return "실행 증적 없음 · NO_EVIDENCE";
}

function rowSearchText(row: Row) {
  return [
    "workTypeName", "domainName", "workTypeCode", "domainCode", "processName", "processCode", "stepName", "stepCode",
    "screenName", "routePath", "screenRoutes", "actorName", "actorCode", "assignedAccountIds", "capabilityNames", "functionCodes",
    "commandName", "commandCode", "nextProcessName", "nextProcessCode", "nextStepName", "nextStepCode"
  ].map(key => formatStructuredValue(row[key])).join(" ").toLocaleLowerCase("ko-KR");
}

function primaryRoutePath(row: Row) {
  const direct = safeRoutePath(text(row, "routePath", "screenPath", "entryPath"));
  if (direct) return direct;
  const registered = text(row, "screenRoutes").split(",").map(value => safeRoutePath(value)).find(Boolean);
  return registered || "";
}

function transitionSourceLabel(raw: string, mode = "") {
  const source = raw.trim();
  if (mode.toUpperCase() === "GUIDE_ONLY" || source.toUpperCase() === "STEP_ORDER") return `안내 순서${source ? `(${source})` : ""} · 강제 선행 또는 자동 전이 계약 아님`;
  return source || "설계된 다음 업무 연결";
}

function parseNextTransitions(row: Row) {
  const raw = firstValue(row, "nextDestinationsJson", "nextTransitionsJson");
  if (!raw || compactValueOmitted(raw)) return [] as Row[];
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(value) ? value.filter(item => item && typeof item === "object") as Row[] : [];
  } catch { return [] as Row[]; }
}

function actualBusinessRoutePath(row: Row) {
  if (normalizeBusinessResult(row) === "NOT_RUN") return "";
  return safeRoutePath(text(row, "actualE2eRoutePath", "businessExecutedRoutePath", "businessRoutePath", "actualRoutePath", "executedRoutePath"));
}

function transitionRouteResolution(destination: Row) {
  const raw = text(destination, "routeResolution").toUpperCase();
  if (raw === "SINGLE") return "단일 경로 후보";
  if (raw === "MULTIPLE_CANDIDATES") return "사용자·관리자 복수 경로 후보";
  if (raw === "MISSING") return "경로 후보 미등록";
  return "기존 계약 호환 후보 · 확정 상태 미등록";
}

function resolveNextDestination(row: Row, orderedItems: Row[]): NextDestination {
  const explicitProcessCode = text(row, "nextProcessCode");
  const explicitStepCode = text(row, "nextStepCode");
  const explicitRoute = safeRoutePath(text(row, "nextRoutePath"));
  const branches = parseNextTransitions(row);
  const actualRoute = actualBusinessRoutePath(row);
  if (branches.length > 0) {
    const targets = branches.map(branch => [text(branch, "nextProcessName", "targetProcessName", "nextProcessCode", "targetProcessCode"), text(branch, "nextStepName", "targetStepName", "nextStepCode", "targetStepCode")].filter(Boolean).join(" · ")).filter(Boolean);
    const resolutions = Array.from(new Set(branches.map(branch => text(branch, "routeResolution") || "LEGACY_CANDIDATE")));
    return {
      label: `${branches.length}개 검증 전이${targets.length ? ` · ${targets.slice(0, 2).join(" / ")}${targets.length > 2 ? " 외" : ""}` : ""}`,
      code: branches.map(branch => [text(branch, "nextProcessCode", "targetProcessCode"), text(branch, "nextStepCode", "targetStepCode")].filter(Boolean).join("/")).filter(Boolean).join(", "),
      routePath: actualRoute,
      sourceLabel: `저장된 전이 계약 액터·현재 대상 절차 액터와 사용자·관리자 경로 후보를 상세에서 분리 확인 · 경로 판정 ${resolutions.join(", ")}`
    };
  }
  if (explicitProcessCode || explicitStepCode || explicitRoute) {
    return {
      label: `${[text(row, "nextProcessName") || explicitProcessCode, text(row, "nextStepName") || explicitStepCode].filter(Boolean).join(" · ") || "다음 업무"} · 기존 계약 호환용 후보`,
      code: [explicitProcessCode, explicitStepCode].filter(Boolean).join(" / "),
      routePath: actualRoute,
      sourceLabel: `${transitionSourceLabel(text(row, "nextTransitionSource"), text(row, "nextTransitionMode"))} · ${explicitRoute ? `${explicitRoute}는 호환용 경로 후보이며 실제 E2E 실행 경로가 아님` : "경로 후보 미등록"}`
    };
  }
  const currentProcess = text(row, "processCode");
  const currentStep = text(row, "stepCode");
  const currentIndex = orderedItems.findIndex(candidate => text(candidate, "processCode") === currentProcess && text(candidate, "stepCode") === currentStep);
  const nextRow = currentIndex >= 0 ? orderedItems.slice(currentIndex + 1).find(candidate => text(candidate, "processCode") === currentProcess) : undefined;
  if (nextRow) {
    return {
      label: text(nextRow, "stepName") || text(nextRow, "stepCode") || "목록상 다음 절차",
      code: `${text(nextRow, "processCode")} / ${text(nextRow, "stepCode")}`,
      routePath: actualRoute,
      sourceLabel: `STEP_ORDER 안내 순서 · 강제 선행 또는 자동 전이 계약 아님 · ${primaryRoutePath(nextRow) || "경로 없음"}은 목록상 호환용 후보`
    };
  }
  return { label: "프로세스 종료 또는 다음 연결 미등록", code: "", routePath: "", sourceLabel: "명시적 NEXT 계약이 없어 다른 프로세스를 추정하지 않습니다." };
}

function booleanLabel(value: unknown) {
  if (value === true || value === 1 || String(value).toLowerCase() === "true") return "현재 버전";
  if (value === false || value === 0 || String(value).toLowerCase() === "false") return "이전 버전";
  return "-";
}

function compareRows(left: Row, right: Row) {
  return number(left, "domainOrder") - number(right, "domainOrder")
    || number(left, "workflowOrder") - number(right, "workflowOrder")
    || text(left, "processCode").localeCompare(text(right, "processCode"), "ko")
    || number(left, "stepOrder", "stepSequence", "stepSequenceNo") - number(right, "stepOrder", "stepSequence", "stepSequenceNo")
    || text(left, "stepCode").localeCompare(text(right, "stepCode"), "ko");
}

function uniqueOptions(options: Array<{ code: string; name: string; order?: number }>) {
  return Array.from(new Map(options.filter(option => option.code).map(option => [option.code, option])).values())
    .sort((left, right) => Number(left.order || 9999) - Number(right.order || 9999) || (left.name || left.code).localeCompare(right.name || right.code, "ko"));
}

function normalizePagination(raw: Pagination | undefined, fallbackPage: number, returnedItemCount: number): Pagination {
  const row = raw as unknown as Row | undefined;
  const page = number(row, "page") || fallbackPage;
  const size = number(row, "size") || 50;
  const totalStepCount = number(row, "totalStepCount") || (page * size + returnedItemCount);
  return {
    page,
    size,
    returnedItemCount: number(row, "returnedItemCount") || returnedItemCount,
    totalStepCount,
    hasNext: raw?.hasNext === true || String(raw?.hasNext).toLowerCase() === "true",
    mode: text(row, "mode") || "STRUCTURAL_SCOPE"
  };
}

function mergeOrderedRows(existing: Row[], incoming: Row[]) {
  const index = new Map<string, Row>();
  existing.forEach((row, position) => index.set(rowKey(row, position), row));
  incoming.forEach((row, position) => index.set(rowKey(row, existing.length + position), row));
  return Array.from(index.values()).sort(compareRows);
}

function mergeCatalogRows(existing: Row[], incoming: Row[], ...identityKeys: string[]) {
  const index = new Map<string, Row>();
  [...existing, ...incoming].forEach((row, position) => {
    const identity = text(row, ...identityKeys) || `catalog-row-${position}`;
    index.set(identity, row);
  });
  return Array.from(index.values());
}

function mergeReviewDrafts(current: Record<string, ReviewDraft>, rows: Row[]) {
  const next = { ...current };
  rows.forEach((row, index) => {
    const records = parseScopedReviews(row);
    if (hasCurrentSavedReview(row) && !records.some(record => scopeFromReviewRecord(record).key === "STEP:ALL")) records.unshift(row);
    records.forEach(record => {
      const scope = scopeFromReviewRecord(record);
      const key = reviewDraftKey(row, index, scope);
      next[key] = { status: hasCurrentSavedReview(record) ? normalizeReviewStatus(record) : "UNREVIEWED", note: hasCurrentSavedReview(record) ? text(record, "reviewNote", "changeRequestNote") || next[key]?.note || "" : next[key]?.note || "" };
    });
  });
  return next;
}

function rowKey(row: Row, index: number) {
  const processCode = text(row, "processCode");
  const stepCode = text(row, "stepCode");
  if (processCode && stepCode) {
    const screenScope = text(row, "screenResourceId") || "STEP";
    const functionScope = text(row, "capabilityCode", "latestAuditCapabilityCode", "functionCode") || "ALL";
    return `${text(row, "workTypeCode", "domainCode")}:${processCode}:${stepCode}:${screenScope}:${functionScope}`;
  }
  return text(row, "itemId", "latestRunId", "testRunId", "runId") || `report-row-${index}`;
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function safeRoutePath(raw: string) {
  const route = raw.trim();
  if (/^\/(?!\/)/.test(route) || /^https?:\/\//i.test(route)) return route;
  return "";
}

function sequenceLabel(row: Row, index: number) {
  const processOrder = number(row, "workflowOrder", "processOrder", "developmentOrder", "processSequence", "processSequenceNo");
  const stepOrder = number(row, "stepOrder", "stepSequence", "stepSequenceNo");
  return processOrder && stepOrder ? `${processOrder}-${stepOrder}` : String(index + 1);
}

function stepLabel(row: Row, index: number) {
  const order = number(row, "stepOrder", "stepSequence", "stepSequenceNo") || index + 1;
  return `${order}. ${text(row, "stepName") || text(row, "stepCode") || "이름 없는 절차"}`;
}

function firstValue(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

const SENSITIVE_EXPORT_KEY = /(password|passwd|pwd|token|otp|proof|secret|developmentCode|verificationCode|apiKey|privateKey|credential|sessionId|csrf|jwt|authorization|cookie)/i;

function redactExportValue(raw: unknown, key = ""): unknown {
  if (SENSITIVE_EXPORT_KEY.test(key)) return "[REDACTED]";
  if (raw === undefined || raw === null || raw === "") return "";
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try { return redactExportValue(JSON.parse(trimmed)); }
      catch { /* Keep the backend-redacted string and apply the fallback mask below. */ }
    }
    return raw.replace(/(["']?(?:password|passwd|pwd|token|otp|proof|secret|developmentCode|verificationCode|apiKey|privateKey|credential|sessionId|csrf|jwt|authorization|cookie)["']?\s*[=:]\s*["']?)([^\n,;}&]+)/gi, "$1[REDACTED]");
  }
  if (Array.isArray(raw)) return raw.map(value => redactExportValue(value));
  if (typeof raw === "object") {
    return Object.fromEntries(Object.entries(raw as Row).map(([childKey, value]) => [childKey, redactExportValue(value, childKey)]));
  }
  return raw;
}

function exportField(row: Row, ...keys: string[]) {
  const sanitized = redactExportValue(firstValue(row, ...keys));
  return formatStructuredValue(sanitized) || "-";
}

function exportTransitionInventory(row: Row) {
  const registered = parseNextTransitions(row);
  const destinations = registered.length > 0 ? registered : [{
    edgeActorCode: text(row, "nextEdgeActorCode"), targetActorCode: text(row, "nextTargetActorCode"), actorCode: text(row, "actorCode"),
    userRoutePath: text(row, "nextUserRoutePath"), adminRoutePath: text(row, "nextAdminRoutePath"), routePath: text(row, "nextRoutePath"),
    routeResolution: text(row, "nextRouteResolution") || "LEGACY_CANDIDATE", nextProcessCode: text(row, "nextProcessCode"), nextStepCode: text(row, "nextStepCode")
  } satisfies Row];
  return formatStructuredValue(redactExportValue(destinations.map((destination, index) => ({
    transitionIndex: index + 1,
    edgeType: text(destination, "edgeType"),
    conditionCode: text(destination, "conditionCode"),
    conditionContract: firstValue(destination, "conditionContract"),
    nextProcessCode: text(destination, "nextProcessCode"),
    nextStepCode: text(destination, "nextStepCode"),
    savedTransitionContractActorCode: text(destination, "edgeActorCode") || "저장된 전이 계약 액터 미등록",
    currentTargetStepActorCode: text(destination, "targetActorCode") || "현재 대상 절차 액터 미등록",
    legacyActorCodeCandidate: text(destination, "actorCode") || "-",
    routeResolution: text(destination, "routeResolution") || "LEGACY_CANDIDATE",
    userRoutePathCandidate: text(destination, "userRoutePath") || "-",
    adminRoutePathCandidate: text(destination, "adminRoutePath") || "-",
    legacyRoutePathCandidate: text(destination, "routePath", "nextRoutePath") || "-",
    screenRouteInventory: firstValue(destination, "screenRouteInventory") || []
  }))));
}

function buildOperationalLedgerText(rows: Row[]) {
  const orderedRows = [...rows].sort(compareRows);
  const generatedAt = new Date().toISOString();
  const entries = orderedRows.map((row, index) => {
    const next = resolveNextDestination(row, orderedRows);
    const routes = exportField(row, "screenRoutes", "routePath", "screenPath", "entryPath");
    return [
      `[${String(index + 1).padStart(4, "0")}] ${text(row, "workTypeName", "domainName") || "미분류 업무"} > ${text(row, "processName", "processCode") || "프로세스 미등록"} > ${text(row, "stepName", "stepCode") || "절차 미등록"}`,
      `업무 종류: ${text(row, "workTypeName", "domainName") || "-"} (${text(row, "workTypeCode", "domainCode") || "-"})`,
      `프로세스: ${text(row, "processName") || "-"} (${text(row, "processCode") || "-"}) · workflowOrder=${text(row, "workflowOrder", "processOrder", "developmentOrder") || "-"}`,
      `절차: ${text(row, "stepName") || "-"} (${text(row, "stepCode") || "-"}) · stepOrder=${text(row, "stepOrder", "stepSequence", "stepSequenceNo") || "-"}`,
      `화면·경로: ${text(row, "screenName") || "연결 화면 미등록"} · ${routes}`,
      `담당 액터: ${text(row, "actorName", "assigneeName") || "담당자 미지정"} (${text(row, "actorCode", "assigneeActorCode") || "-"})`,
      `전체 범위 후보 계정: ${text(row, "assignedAccountCount") || "0"}개 · ${exportField(row, "assignedAccountIds")}`,
      `계정 후보 범위: ${text(row, "assignmentScope") || "GLOBAL_ACTIVE_ACTOR_CANDIDATES 여부 확인 필요"}`,
      `실제 업무 실행 계정: ${text(row, "businessExecutedBy", "actualExecutedBy", "executedBy") || "실제 E2E 실행 증적 없음"}`,
      `액터 기능 권한: ${exportField(row, "actorCapabilityCodes", "authorityResult", "permissionResult")}`,
      `화면별 기능: ${exportField(row, "screenFunctionInventoryJson", "functionCodes", "capabilityNames", "functions")}`,
      `입력 계약: ${exportField(row, "inputContract", "input")}`,
      `실제 입력값: ${exportField(row, "actualInput", "latestInput", "latestPreInputJson", "inputValues", "inputJson", "requestBody")}`,
      `출력 계약: ${exportField(row, "outputContract", "output")}`,
      `실제 출력값: ${exportField(row, "actualOutput", "latestOutput", "outputValues", "outputJson", "responseBody")}`,
      `계약 점검 결과: ${normalizeResult(row)} · ${exportField(row, "latestBlockerCodes", "resultMessage", "message", "failureReason")}`,
      `실제 결과: ${normalizeActualResult(row)} · 증적 등급 ${evidenceState(row)}`,
      `증적: ${exportField(row, "actualEvidenceJson", "businessEvidenceJson", "evidenceJson", "latestEvidenceJson", "evidence", "evidencePath", "evidenceHash")}`,
      `실행자·시간: ${text(row, "businessExecutedBy", "simulationExecutedBy", "executedBy") || "-"} · ${text(row, "businessExecutedAt", "simulationExecutedAt", "executedAt") || "-"}`,
      `다음 업무 요약: ${next.label} (${next.code || "-"}) · ${next.sourceLabel}`,
      `실제 업무 E2E 실행 경로: ${actualBusinessRoutePath(row) || "실행 경로 증적 없음"}`,
      `다음 업무 저장된 전이 계약 액터·현재 대상 절차 액터·사용자·관리자 경로 후보: ${exportTransitionInventory(row)}`,
      `다음 업무 원본 전체 분기·조건: ${exportField(row, "nextDestinationsJson", "nextTransitionsJson")}`,
      `절차 전체 사람 검토: ${normalizeAggregateReviewStatus(row)} · ${text(row, "reviewedBy") || "-"} · ${text(row, "reviewedAt") || "-"} · ${exportField(row, "reviewNote")}`,
      `화면·기능 범위별 사람 검토: ${exportField(row, "scopedReviewInventoryJson", "reviewScopesJson")}`
    ].join("\n");
  });
  const separator = `\n\n${"=".repeat(96)}\n\n`;
  return `\ufeffResonance 전체 실사용 검수 대장\n생성 시각: ${generatedAt}\n절차 수: ${orderedRows.length}\n주의: 사람 검토는 계약 점검 또는 실제 업무 E2E 통과를 의미하지 않습니다. 비밀번호·토큰·OTP·증명·비밀·API 키·개인 키·인증정보·세션 ID·CSRF·JWT·쿠키는 클라이언트에서 중첩 객체까지 재마스킹했습니다.\n\n${entries.join(separator)}\n`;
}

function downloadOperationalLedgerText(rows: Row[]) {
  const blob = new Blob([buildOperationalLedgerText(rows)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `resonance-operational-usage-ledger-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatStructuredValue(raw: unknown) {
  if (raw === undefined || raw === null || raw === "") return "";
  if (typeof raw === "string") {
    try { return JSON.stringify(JSON.parse(raw), null, 2); }
    catch { return raw; }
  }
  if (typeof raw === "object") return JSON.stringify(raw, null, 2);
  return String(raw);
}

function formatDateTime(raw: string) {
  if (!raw || raw === "-") return "-";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function durationLabel(row: Row) {
  const milliseconds = number(row, "durationMs", "elapsedMs");
  if (milliseconds > 0) return milliseconds >= 1000 ? `${(milliseconds / 1000).toFixed(2)}초` : `${milliseconds}ms`;
  return text(row, "duration", "elapsedTime");
}
