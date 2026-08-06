import { Fragment, useCallback, useEffect, useId, useMemo, useState } from "react";

type Row = Record<string, unknown>;

type ReportPayload = {
  auditMode?: string;
  summary?: Row;
  workTypes?: Row[];
  processes?: Row[];
  items?: Row[];
  generatedAt?: string;
  evaluatedAt?: string;
};

type Props = {
  base: string;
};

type TestResult = "PASSED" | "BLOCKED" | "NOT_RUN";

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
  if (response.status === 401) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인한 뒤 실행하세요.");
  if (response.status === 403) throw new Error("이 결과를 조회하거나 계약 점검을 실행할 권한이 없습니다.");
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

export function SystemProcessTestReportPanel({ base }: Props) {
  const scrollHelpId = useId();
  const [payload, setPayload] = useState<ReportPayload>({ items: [], processes: [], workTypes: [], summary: {} });
  const [workTypeCode, setWorkTypeCode] = useState("");
  const [processCode, setProcessCode] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${base}/system-test-report`, {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal
      });
      const body = await readJsonResponse<ReportPayload & { message?: string }>(response, "전체 프로세스 테스트 결과를 불러오지 못했습니다.");
      setPayload({
        ...body,
        items: Array.isArray(body.items) ? body.items : [],
        processes: Array.isArray(body.processes) ? body.processes : [],
        workTypes: Array.isArray(body.workTypes) ? body.workTypes : [],
        summary: body.summary && typeof body.summary === "object" ? body.summary : {}
      });
    } catch (reason) {
      if (isAbortError(reason)) return;
      setError(requestErrorMessage(reason, "전체 프로세스 테스트 결과를 불러오지 못했습니다."));
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, [base]);

  const runAudit = useCallback(async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const request = {
        ...(workTypeCode ? { domainCode: workTypeCode } : {}),
        ...(processCode ? { processCode } : {})
      };
      const response = await fetch(`${base}/system-test-report/audit`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });
      const body = await readJsonResponse<Row>(response, "프로세스 계약 점검에 실패했습니다.");
      const auditOutcome = text(body, "outcome", "result") || "UNKNOWN";
      setMessage(`계약 점검 실행 완료 · 결과 ${auditOutcome} · 대상 ${text(body, "targetCount") || "0"}개 · 절차 ${text(body, "auditedStepCount") || "0"}개 · 바인딩 ${text(body, "auditedBindingCount") || "0"}개 · 기능 대상 ${text(body, "auditedCapabilityTargetCount") || "0"}개 · 결과를 다시 조회했습니다. 실제 업무 명령은 실행하지 않았습니다.`);
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

  const items = payload.items ?? [];
  const workTypes = useMemo(() => {
    const registered = (payload.workTypes ?? []).map(row => ({
      code: text(row, "workTypeCode", "domainCode", "code"),
      name: text(row, "workTypeName", "domainName", "name")
    }));
    const inferred = items.map(row => ({
      code: text(row, "workTypeCode", "domainCode"),
      name: text(row, "workTypeName", "domainName")
    }));
    return uniqueOptions([...registered, ...inferred]);
  }, [items, payload.workTypes]);

  const processes = useMemo(() => {
    const registered = (payload.processes ?? []).map(row => ({
      code: text(row, "processCode", "code"),
      name: text(row, "processName", "name"),
      workTypeCode: text(row, "workTypeCode", "domainCode"),
      order: number(row, "processOrder", "developmentOrder", "sortOrder", "order")
    }));
    const inferred = items.map(row => ({
      code: text(row, "processCode"),
      name: text(row, "processName"),
      workTypeCode: text(row, "workTypeCode", "domainCode"),
      order: number(row, "processOrder", "developmentOrder", "sortOrder")
    }));
    return Array.from(new Map([...registered, ...inferred].filter(option => option.code).map(option => [option.code, option])).values())
      .filter(option => !workTypeCode || option.workTypeCode === workTypeCode)
      .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, "ko"));
  }, [items, payload.processes, workTypeCode]);

  useEffect(() => {
    if (processCode && !processes.some(process => process.code === processCode)) setProcessCode("");
  }, [processCode, processes]);

  const filteredItems = useMemo(() => items
    .filter(row => !workTypeCode || text(row, "workTypeCode", "domainCode") === workTypeCode)
    .filter(row => !processCode || text(row, "processCode") === processCode)
    .filter(row => !resultFilter || normalizeResult(row) === resultFilter)
    .sort(compareRows), [items, processCode, resultFilter, workTypeCode]);

  const computedSummary = useMemo(() => {
    const processCodes = new Set(items.map(row => text(row, "processCode")).filter(Boolean));
    const e2eCovered = new Set(items.filter(row => normalizeBusinessResult(row) !== "NOT_RUN").map(row => text(row, "processCode")).filter(Boolean));
    return {
      totalProcesses: processCodes.size,
      totalSteps: items.length,
      passed: items.filter(row => normalizeResult(row) === "PASSED").length,
      blocked: items.filter(row => normalizeResult(row) === "BLOCKED").length,
      notRun: items.filter(row => normalizeResult(row) === "NOT_RUN").length,
      e2eCovered: e2eCovered.size,
      e2eUncovered: Math.max(0, processCodes.size - e2eCovered.size),
      fixtureSuiteBindings: items.reduce((sum, row) => sum + number(row, "fixtureSuiteCaseCount"), 0),
      fixtureSuiteCompleteSteps: items.filter(row => text(row, "fixtureSuiteCoverageState") === "COMPLETE").length,
      fixtureSuiteIncompleteSteps: items.filter(row => text(row, "fixtureSuiteCoverageState") !== "COMPLETE").length,
      fixtureSuiteCurrentRuns: items.reduce((sum, row) => sum + number(row, "fixtureSuiteCurrentRunCount"), 0)
    };
  }, [items]);

  const summary = payload.summary ?? {};
  const summaryValues: Array<[string, number, string]> = [
    ["전체 프로세스", numberOr(summary, computedSummary.totalProcesses, "totalProcesses", "processCount"), "text-[#052b57]"],
    ["전체 절차", numberOr(summary, computedSummary.totalSteps, "totalSteps", "stepCount", "total"), "text-[#052b57]"],
    ["계약 통과", numberOr(summary, computedSummary.passed, "passed", "passedCount", "passedStepCount"), "text-emerald-700"],
    ["계약 차단", numberOr(summary, computedSummary.blocked, "blocked", "blockedCount", "blockedStepCount", "failedCount"), "text-red-700"],
    ["계약 미점검", numberOr(summary, computedSummary.notRun, "notRun", "notRunCount", "untestedStepCount", "pendingCount"), "text-slate-700"],
    ["업무 E2E 검증", numberOr(summary, computedSummary.e2eCovered, "e2eCoveredProcessCount"), "text-blue-700"],
    ["업무 E2E 미검증", numberOr(summary, computedSummary.e2eUncovered, "e2eUncoveredProcessCount"), "text-amber-700"]
  ];

  const generatedAt = payload.generatedAt || payload.evaluatedAt || text(summary, "generatedAt", "evaluatedAt", "lastExecutedAt") || "-";
  const selectedWorkTypeName = workTypes.find(option => option.code === workTypeCode)?.name || "전체 업무 종류";
  const selectedProcessName = processes.find(option => option.code === processCode)?.name || "전체 프로세스";
  const selectedResultName = resultFilter ? RESULT_LABELS[resultFilter as TestResult] : "전체 계약 결과";

  function toggleRow(row: Row, index: number) {
    const key = rowKey(row, index);
    setExpandedRows(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return <div className="system-process-test-report space-y-5">
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
          <p className="text-xs font-black tracking-[0.12em] text-blue-700">SYSTEM-WIDE PROCESS TEST REPORT</p>
          <h2 className="mt-1 text-2xl font-black text-[#052b57]">전체 업무 프로세스 계약 점검·E2E 증적</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">모든 절차의 액터·라우트·명령·입출력·화면·테스트 계약을 결정론적으로 점검합니다. 계약 점검은 저장·승인·삭제 같은 실제 업무 명령을 실행하지 않습니다. 실제 계정과 데이터로 수행한 업무 E2E 결과는 별도 증적 영역에 분리하여 표시합니다.</p>
          <p className="mt-2 text-xs font-medium text-slate-500">결과 생성 시각: {formatDateTime(generatedAt)}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">조회 범위: {selectedWorkTypeName} · {selectedProcessName} · {selectedResultName} · {filteredItems.length.toLocaleString("ko-KR")}개 절차</p>
        </div>
        <div className="report-no-print flex shrink-0 flex-wrap gap-2">
          <button className={`min-h-11 rounded-lg border border-blue-300 bg-white px-4 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50 ${focusClass}`} disabled={busy} onClick={() => void load()} type="button">{busy ? "처리 중" : "결과 새로고침"}</button>
          <button className={`min-h-11 rounded-lg border border-[#174ea6] bg-[#174ea6] px-4 text-sm font-bold text-white hover:bg-[#0d3f8f] disabled:opacity-50 ${focusClass}`} disabled={busy} onClick={() => void runAudit()} type="button">선택 범위 계약 점검</button>
          <button className={`min-h-11 rounded-lg bg-[#246beb] px-5 text-sm font-black text-white hover:bg-[#1d56bd] ${focusClass}`} onClick={() => window.print()} type="button">현재 결과 인쇄</button>
        </div>
      </div>
    </section>

    {message && <div className="report-no-print rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status"><strong className="block text-emerald-800">계약 점검 완료</strong><span className="mt-1 block text-sm text-emerald-700">{message}</span></div>}
    {error && <div className="report-no-print rounded-xl border border-red-200 bg-red-50 p-4" role="alert"><strong className="block text-red-800">처리 실패</strong><span className="mt-1 block text-sm text-red-700">{error}</span></div>}
    <p aria-live="polite" className="sr-only" role="status">{busy ? "전체 프로세스 계약 점검 결과를 처리하고 있습니다." : `계약 점검 결과 ${filteredItems.length}개를 표시합니다.`}</p>

    <section className="report-print-break grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" aria-label="계약 점검 및 업무 E2E 결과 요약">
      <div className="sm:col-span-2 lg:col-span-4 xl:col-span-7"><h3 className="font-black text-[#052b57]">시스템 전체 누적 요약</h3><p className="mt-1 text-xs text-slate-500">아래 수치는 현재 필터와 관계없이 전체 프로세스를 기준으로 합니다.</p></div>
      {summaryValues.map(([label, metric, color]) => <article className="rounded-xl border border-slate-200 bg-white p-4" key={label}><span className="text-xs font-bold text-slate-500">{label}</span><strong className={`mt-1 block text-2xl font-black ${color}`}>{metric.toLocaleString("ko-KR")}</strong></article>)}
    </section>

    <section className="report-print-break rounded-2xl border border-violet-200 bg-violet-50/40 p-5" aria-label="워크플로 픽스처 스위트 범위">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-black tracking-[0.1em] text-violet-700">WORKFLOW FIXTURE SUITE COVERAGE</p><h3 className="mt-1 font-black text-[#052b57]">5대 안전 시나리오 전체 등록·실행 증적</h3><p className="mt-1 text-sm leading-6 text-slate-600">HAPPY_PATH · AUTHORITY · ISOLATION · EXCEPTION · RECOVERY 바인딩 전체를 집계합니다. 계약 건전성 감사가 선택하는 정상 픽스처 1건 및 실제 업무 E2E와 서로 다른 증적입니다.</p></div>
        <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-black text-violet-800">읽기 전용 · 업무 명령 미실행</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FixtureMetric label="단계·픽스처 바인딩" value={numberOr(summary, computedSummary.fixtureSuiteBindings, "fixtureSuiteBindingCount")}/>
        <FixtureMetric label="5종 완비 단계" value={numberOr(summary, computedSummary.fixtureSuiteCompleteSteps, "fixtureSuiteCompleteStepCount")}/>
        <FixtureMetric label="유형 보완 필요 단계" value={numberOr(summary, computedSummary.fixtureSuiteIncompleteSteps, "fixtureSuiteIncompleteStepCount")} warning/>
        <FixtureMetric label="현행 버전 실행 증적" value={numberOr(summary, computedSummary.fixtureSuiteCurrentRuns, "fixtureSuiteCurrentRunCount")}/>
      </div>
    </section>

    <section className="report-no-print rounded-2xl border border-slate-200 bg-white p-5" aria-label="테스트 결과 필터">
      <div className="grid gap-4 md:grid-cols-3">
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
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-600">조건에 맞는 절차 <strong className="text-[#052b57]">{filteredItems.length.toLocaleString("ko-KR")}개</strong></p>
        <button className={`min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 ${focusClass}`} onClick={() => { setWorkTypeCode(""); setProcessCode(""); setResultFilter(""); }} type="button">필터 초기화</button>
      </div>
    </section>

    <section className="report-table-shell overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <p className="report-no-print border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500 lg:hidden" id={scrollHelpId}>표를 좌우로 이동하면 모든 계약과 E2E 결과를 확인할 수 있습니다.</p>
      <div aria-describedby={scrollHelpId} aria-label="전체 프로세스 계약 점검 결과 표" className={`report-table-scroll overflow-x-auto overscroll-x-contain ${focusClass}`} role="region" tabIndex={0}>
        <table className="w-full min-w-[1680px] border-collapse text-left text-sm">
          <caption className="sr-only">업무 종류, 프로세스, 절차 순서, 담당자, 화면 경로와 실행 결과 목록</caption>
          <thead className="bg-slate-50 text-xs font-black text-slate-600">
            <tr>
              <th className="w-20 px-4 py-3" scope="col">순서</th>
              <th className="min-w-44 px-4 py-3" scope="col">업무 종류</th>
              <th className="min-w-64 px-4 py-3" scope="col">프로세스</th>
              <th className="min-w-72 px-4 py-3" scope="col">절차</th>
              <th className="min-w-40 px-4 py-3" scope="col">담당자</th>
              <th className="min-w-32 px-4 py-3" scope="col">계약 점검</th>
              <th className="min-w-44 px-4 py-3" scope="col">픽스처 스위트</th>
              <th className="min-w-36 px-4 py-3" scope="col">시뮬레이션 증적</th>
              <th className="min-w-32 px-4 py-3" scope="col">업무 E2E</th>
              <th className="min-w-40 px-4 py-3" scope="col">최근 실행</th>
              <th className="report-no-print w-40 px-4 py-3 text-right" scope="col">기능</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((row, index) => {
              const key = rowKey(row, index);
              const expanded = expandedRows.has(key);
              const result = normalizeResult(row);
              const detailId = `system-process-test-detail-${safeId(key)}`;
              const routePath = safeRoutePath(text(row, "routePath", "screenPath", "entryPath"));
              return <Fragment key={key}>
                <tr className="report-print-break border-t border-slate-200 align-top hover:bg-blue-50/40">
                  <td className="px-4 py-4 font-black text-[#052b57]">{sequenceLabel(row, index)}</td>
                  <td className="px-4 py-4"><strong className="block text-slate-800">{text(row, "workTypeName", "domainName") || "미분류 업무"}</strong><span className="mt-1 block font-mono text-[11px] text-slate-400">{text(row, "workTypeCode", "domainCode") || "-"}</span></td>
                  <td className="px-4 py-4"><strong className="block text-[#052b57]">{text(row, "processName") || text(row, "processCode") || "-"}</strong><span className="mt-1 block font-mono text-[11px] text-slate-400">{text(row, "processCode") || "-"}</span></td>
                  <td className="px-4 py-4"><strong className="block text-slate-800">{stepLabel(row, index)}</strong><span className="mt-1 block font-mono text-[11px] text-slate-400">{text(row, "stepCode") || "-"}</span></td>
                  <td className="px-4 py-4"><span className="block font-bold text-slate-700">{text(row, "actorName", "assigneeName") || "담당자 미지정"}</span><span className="mt-1 block font-mono text-[11px] text-slate-400">{text(row, "actorCode", "assigneeActorCode") || "-"}</span></td>
                  <td className="px-4 py-4"><ResultBadge result={result}/>{text(row, "latestBlockerCodes", "resultMessage", "message", "failureReason") && <span className="mt-2 line-clamp-2 block max-w-56 text-xs leading-5 text-slate-500">{formatStructuredValue(firstValue(row, "latestBlockerCodes", "resultMessage", "message", "failureReason"))}</span>}</td>
                  <td className="px-4 py-4"><FixtureSuiteBadge row={row}/><span className="mt-2 block max-w-56 text-xs leading-5 text-slate-500">{text(row, "fixtureSuiteMissingTypes") ? `누락: ${text(row, "fixtureSuiteMissingTypes")}` : `${text(row, "fixtureSuiteCoveredTypeCount") || "0"}/5 유형 · ${text(row, "fixtureSuiteCaseCount") || "0"}건`}</span></td>
                  <td className="px-4 py-4"><SimulationResultBadge row={row}/><span className="mt-2 block max-w-48 text-xs leading-5 text-slate-500">{text(row, "simulationCaseCode") || "시뮬레이션 증적 없음"}</span></td>
                  <td className="px-4 py-4"><BusinessResultBadge row={row}/><span className="mt-2 block max-w-48 text-xs leading-5 text-slate-500">{text(row, "businessEvidenceStatus") || "EVIDENCE_LEDGER_UNAVAILABLE"}</span></td>
                  <td className="px-4 py-4 text-xs leading-5 text-slate-600">{formatDateTime(text(row, "executedAt", "latestExecutedAt", "lastExecutedAt", "testedAt"))}<span className="block text-slate-400">계약 점검</span></td>
                  <td className="report-no-print px-4 py-4"><div className="flex flex-wrap justify-end gap-2">{routePath ? <a className={`inline-flex min-h-10 items-center rounded-lg border border-blue-300 bg-white px-3 font-bold text-blue-700 hover:bg-blue-50 ${focusClass}`} href={routePath} rel="noreferrer" target="_blank">화면 열기<span className="sr-only">: {text(row, "screenName", "stepName") || routePath} (새 창)</span></a> : <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-bold text-slate-400">경로 없음</span>}<button aria-controls={detailId} aria-expanded={expanded} className={`min-h-10 rounded-lg bg-slate-800 px-3 font-bold text-white hover:bg-slate-700 ${focusClass}`} onClick={() => toggleRow(row, index)} type="button">{expanded ? "상세 접기" : "상세 보기"}<span className="sr-only">: {text(row, "processName", "processCode")} {text(row, "stepName", "stepCode")}</span></button></div></td>
                </tr>
                <tr className={`report-print-detail border-t border-slate-100 bg-slate-50/70 ${expanded ? "table-row" : "hidden"}`} id={detailId}>
                  <td className="px-4 py-5" colSpan={11}>
                    <StepDetail row={row}/>
                  </td>
                </tr>
              </Fragment>;
            })}
            {!busy && filteredItems.length === 0 && <tr><td className="px-6 py-14 text-center text-slate-500" colSpan={11}>선택한 조건에 해당하는 점검 절차가 없습니다.</td></tr>}
            {busy && filteredItems.length === 0 && <tr><td className="px-6 py-14 text-center font-bold text-blue-700" colSpan={11}>전체 프로세스 계약 점검 결과를 불러오는 중입니다.</td></tr>}
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

function StepDetail({ row }: { row: Row }) {
  const sections: Array<[string, unknown, string]> = [
    ["화면·라우트", firstValue(row, "screenRoutes", "routePath", "screenPath", "entryPath") || "등록되지 않음", `${text(row, "screenCount") || "0"}개 연결 화면 · ${text(row, "implementationStatuses") || "구현 상태 미등록"}`],
    ["실행 명령", text(row, "commandName", "commandCode", "actionCode") || "등록되지 않음", text(row, "commandCode", "actionCode") || "명령 코드 없음"],
    ["입력 계약", firstValue(row, "inputContract", "input"), "필수 입력 필드와 데이터 계약"],
    ["계약 점검 입력값", firstValue(row, "latestInput", "latestPreInputJson", "inputValues", "inputJson", "requestBody"), "최근 계약 점검에 사용한 입력"],
    ["출력 계약", firstValue(row, "outputContract", "output"), "결과값과 다음 절차 인계 계약"],
    ["계약 점검 출력값", firstValue(row, "latestOutput", "outputValues", "outputJson", "responseBody"), "최근 계약 점검 결과"],
    ["API 계약", firstValue(row, "apiContract"), "연결 엔드포인트와 요청·응답 계약"],
    ["기능", firstValue(row, "capabilityNames", "functions", "capabilities", "functionNames", "functionCodes"), "화면에서 검증할 공통·업무 기능"],
    ["계약 점검 증적", firstValue(row, "evidenceJson", "latestEvidenceJson", "evidence", "evidencePath", "evidenceHash"), "계약 검사 로그·해시·실행 ID"]
  ];
  return <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black tracking-[0.08em] text-blue-700">ACTOR & AUTHORITY</p>
      <h4 className="mt-2 font-black text-[#052b57]">{text(row, "actorName", "assigneeName") || "담당자 미지정"}</h4>
      <dl className="mt-3 space-y-2 text-sm"><DetailLine label="액터 코드" value={text(row, "actorCode", "assigneeActorCode") || "-"}/><DetailLine label="계정" value={text(row, "accountName", "assigneeName", "username") || "-"}/><DetailLine label="권한 판정" value={text(row, "authorityResult", "permissionResult") || "-"}/></dl>
    </article>
    {sections.map(([title, raw, description]) => <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4" key={title}>
      <p className="text-xs font-black tracking-[0.08em] text-blue-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <FormattedValue value={raw}/>
    </article>)}
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

function ResultBadge({ result }: { result: TestResult }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${RESULT_CLASSES[result]}`}>{RESULT_LABELS[result]} · {result}</span>;
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

function booleanLabel(value: unknown) {
  if (value === true || value === 1 || String(value).toLowerCase() === "true") return "현재 버전";
  if (value === false || value === 0 || String(value).toLowerCase() === "false") return "이전 버전";
  return "-";
}

function compareRows(left: Row, right: Row) {
  return number(left, "workTypeOrder", "domainOrder") - number(right, "workTypeOrder", "domainOrder")
    || number(left, "processOrder", "developmentOrder", "processSequence", "processSequenceNo") - number(right, "processOrder", "developmentOrder", "processSequence", "processSequenceNo")
    || number(left, "stepOrder", "stepSequence", "stepSequenceNo") - number(right, "stepOrder", "stepSequence", "stepSequenceNo")
    || text(left, "processName", "processCode").localeCompare(text(right, "processName", "processCode"), "ko")
    || text(left, "stepName", "stepCode").localeCompare(text(right, "stepName", "stepCode"), "ko");
}

function uniqueOptions(options: Array<{ code: string; name: string }>) {
  return Array.from(new Map(options.filter(option => option.code).map(option => [option.code, option])).values())
    .sort((left, right) => (left.name || left.code).localeCompare(right.name || right.code, "ko"));
}

function rowKey(row: Row, index: number) {
  const processCode = text(row, "processCode");
  const stepCode = text(row, "stepCode");
  if (processCode && stepCode) return `${text(row, "workTypeCode", "domainCode")}:${processCode}:${stepCode}`;
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
  const processOrder = number(row, "processOrder", "developmentOrder", "processSequence", "processSequenceNo");
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
