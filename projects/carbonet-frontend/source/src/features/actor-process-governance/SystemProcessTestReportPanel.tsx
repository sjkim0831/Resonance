import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;

type ReportPayload = {
  auditMode?: string;
  summary?: Row;
  workTypes?: Row[];
  processes?: Row[];
  items?: Row[];
  generatedAt?: string;
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

const fieldClass = "mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#246beb] focus:ring-2 focus:ring-blue-100";

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
  const [payload, setPayload] = useState<ReportPayload>({ items: [], processes: [], workTypes: [], summary: {} });
  const [workTypeCode, setWorkTypeCode] = useState("");
  const [processCode, setProcessCode] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${base}/system-test-report`, {
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`전체 프로세스 테스트 API가 JSON을 반환하지 않았습니다. (${response.status})`);
      }
      const body = await response.json() as ReportPayload & { message?: string };
      if (!response.ok) throw new Error(body.message || "전체 프로세스 테스트 결과를 불러오지 못했습니다.");
      setPayload({
        ...body,
        items: Array.isArray(body.items) ? body.items : [],
        processes: Array.isArray(body.processes) ? body.processes : [],
        workTypes: Array.isArray(body.workTypes) ? body.workTypes : [],
        summary: body.summary && typeof body.summary === "object" ? body.summary : {}
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "전체 프로세스 테스트 결과를 불러오지 못했습니다.");
    } finally {
      setBusy(false);
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
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) throw new Error(`프로세스 계약 점검 API가 JSON을 반환하지 않았습니다. (${response.status})`);
      const body = await response.json() as Row;
      if (!response.ok) throw new Error(text(body, "message") || "프로세스 계약 점검에 실패했습니다.");
      setMessage(`계약 점검을 기록했습니다. 점검 범위 ${text(body, "auditedStepCount", "stepCount", "matchedItemCount") || "선택 조건"}개 절차 · 실제 업무 명령은 실행하지 않았습니다.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "프로세스 계약 점검에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }, [base, load, processCode, workTypeCode]);

  useEffect(() => { void load(); }, [load]);

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
      e2eUncovered: Math.max(0, processCodes.size - e2eCovered.size)
    };
  }, [items]);

  const summary = payload.summary ?? {};
  const summaryValues: Array<[string, number, string]> = [
    ["전체 프로세스", number(summary, "totalProcesses", "processCount") || computedSummary.totalProcesses, "text-[#052b57]"],
    ["전체 절차", number(summary, "totalSteps", "stepCount", "total") || computedSummary.totalSteps, "text-[#052b57]"],
    ["계약 통과", number(summary, "passed", "passedCount", "passedStepCount") || computedSummary.passed, "text-emerald-700"],
    ["계약 차단", number(summary, "blocked", "blockedCount", "blockedStepCount", "failedCount") || computedSummary.blocked, "text-red-700"],
    ["계약 미점검", number(summary, "notRun", "notRunCount", "untestedStepCount", "pendingCount") || computedSummary.notRun, "text-slate-700"],
    ["업무 E2E 검증", number(summary, "e2eCoveredProcessCount") || computedSummary.e2eCovered, "text-blue-700"],
    ["업무 E2E 미검증", number(summary, "e2eUncoveredProcessCount") || computedSummary.e2eUncovered, "text-amber-700"]
  ];

  const generatedAt = text(payload as Row, "generatedAt", "evaluatedAt") || text(summary, "generatedAt", "evaluatedAt", "lastExecutedAt") || "-";

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
        .system-process-test-report { color: #111827 !important; }
        .system-process-test-report .report-no-print { display: none !important; }
        .system-process-test-report .report-print-detail { display: table-row !important; }
        .system-process-test-report .report-print-break { break-inside: avoid; }
        .system-process-test-report table { font-size: 9pt !important; }
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
        </div>
        <div className="report-no-print flex shrink-0 flex-wrap gap-2">
          <button className="min-h-11 rounded-lg border border-blue-300 bg-white px-4 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50" disabled={busy} onClick={() => void load()} type="button">{busy ? "처리 중" : "결과 새로고침"}</button>
          <button className="min-h-11 rounded-lg border border-[#174ea6] bg-[#174ea6] px-4 text-sm font-bold text-white hover:bg-[#0d3f8f] disabled:opacity-50" disabled={busy} onClick={() => void runAudit()} type="button">선택 범위 계약 점검</button>
          <button className="min-h-11 rounded-lg bg-[#246beb] px-5 text-sm font-black text-white hover:bg-[#1d56bd]" onClick={() => window.print()} type="button">전체 결과 인쇄</button>
        </div>
      </div>
    </section>

    {message && <div className="report-no-print rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status"><strong className="block text-emerald-800">계약 점검 완료</strong><span className="mt-1 block text-sm text-emerald-700">{message}</span></div>}
    {error && <div className="report-no-print rounded-xl border border-red-200 bg-red-50 p-4" role="alert"><strong className="block text-red-800">처리 실패</strong><span className="mt-1 block text-sm text-red-700">{error}</span></div>}

    <section className="report-print-break grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" aria-label="계약 점검 및 업무 E2E 결과 요약">
      {summaryValues.map(([label, metric, color]) => <article className="rounded-xl border border-slate-200 bg-white p-4" key={label}><span className="text-xs font-bold text-slate-500">{label}</span><strong className={`mt-1 block text-2xl font-black ${color}`}>{metric.toLocaleString("ko-KR")}</strong></article>)}
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
        <button className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => { setWorkTypeCode(""); setProcessCode(""); setResultFilter(""); }} type="button">필터 초기화</button>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
          <caption className="sr-only">업무 종류, 프로세스, 절차 순서, 담당자, 화면 경로와 실행 결과 목록</caption>
          <thead className="bg-slate-50 text-xs font-black text-slate-600">
            <tr>
              <th className="w-20 px-4 py-3" scope="col">순서</th>
              <th className="min-w-44 px-4 py-3" scope="col">업무 종류</th>
              <th className="min-w-64 px-4 py-3" scope="col">프로세스</th>
              <th className="min-w-72 px-4 py-3" scope="col">절차</th>
              <th className="min-w-40 px-4 py-3" scope="col">담당자</th>
              <th className="min-w-32 px-4 py-3" scope="col">계약 점검</th>
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
              const routePath = text(row, "routePath", "screenPath", "entryPath");
              return <Fragment key={key}>
                <tr className="report-print-break border-t border-slate-200 align-top hover:bg-blue-50/40">
                  <td className="px-4 py-4 font-black text-[#052b57]">{sequenceLabel(row, index)}</td>
                  <td className="px-4 py-4"><strong className="block text-slate-800">{text(row, "workTypeName", "domainName") || "미분류 업무"}</strong><span className="mt-1 block font-mono text-[11px] text-slate-400">{text(row, "workTypeCode", "domainCode") || "-"}</span></td>
                  <td className="px-4 py-4"><strong className="block text-[#052b57]">{text(row, "processName") || text(row, "processCode") || "-"}</strong><span className="mt-1 block font-mono text-[11px] text-slate-400">{text(row, "processCode") || "-"}</span></td>
                  <td className="px-4 py-4"><strong className="block text-slate-800">{stepLabel(row, index)}</strong><span className="mt-1 block font-mono text-[11px] text-slate-400">{text(row, "stepCode") || "-"}</span></td>
                  <td className="px-4 py-4"><span className="block font-bold text-slate-700">{text(row, "actorName", "assigneeName") || "담당자 미지정"}</span><span className="mt-1 block font-mono text-[11px] text-slate-400">{text(row, "actorCode", "assigneeActorCode") || "-"}</span></td>
                  <td className="px-4 py-4"><ResultBadge result={result}/>{text(row, "latestBlockerCodes", "resultMessage", "message", "failureReason") && <span className="mt-2 line-clamp-2 block max-w-56 text-xs leading-5 text-slate-500">{formatStructuredValue(firstValue(row, "latestBlockerCodes", "resultMessage", "message", "failureReason"))}</span>}</td>
                  <td className="px-4 py-4"><BusinessResultBadge row={row}/><span className="mt-2 block max-w-48 text-xs leading-5 text-slate-500">{text(row, "businessCaseCode") || "실제 업무 E2E 증적 없음"}</span></td>
                  <td className="px-4 py-4 text-xs leading-5 text-slate-600">{formatDateTime(text(row, "executedAt", "latestExecutedAt", "lastExecutedAt", "testedAt"))}<span className="block text-slate-400">계약 점검</span></td>
                  <td className="report-no-print px-4 py-4"><div className="flex justify-end gap-2">{routePath ? <a className="inline-flex min-h-10 items-center rounded-lg border border-blue-300 bg-white px-3 font-bold text-blue-700 hover:bg-blue-50" href={routePath} rel="noreferrer" target="_blank">화면 열기</a> : <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-bold text-slate-400">경로 없음</span>}<button aria-controls={detailId} aria-expanded={expanded} className="min-h-10 rounded-lg bg-slate-800 px-3 font-bold text-white hover:bg-slate-700" onClick={() => toggleRow(row, index)} type="button">{expanded ? "접기" : "상세"}</button></div></td>
                </tr>
                <tr className={`report-print-detail border-t border-slate-100 bg-slate-50/70 ${expanded ? "table-row" : "hidden"}`} id={detailId}>
                  <td className="px-4 py-5" colSpan={9}>
                    <StepDetail row={row}/>
                  </td>
                </tr>
              </Fragment>;
            })}
            {!busy && filteredItems.length === 0 && <tr><td className="px-6 py-14 text-center text-slate-500" colSpan={9}>선택한 조건에 해당하는 점검 절차가 없습니다.</td></tr>}
            {busy && filteredItems.length === 0 && <tr><td className="px-6 py-14 text-center font-bold text-blue-700" colSpan={9}>전체 프로세스 계약 점검 결과를 불러오는 중입니다.</td></tr>}
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
    <article className={`rounded-xl border p-4 lg:col-span-2 xl:col-span-3 ${businessResultClass(row)}`}>
      <p className="text-xs font-black tracking-[0.08em] text-blue-700">LATEST BUSINESS E2E EVIDENCE</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center"><BusinessResultBadge row={row}/><p className="text-sm leading-6 text-slate-700">실제 업무 계정과 데이터로 실행한 별도 종단간 테스트 증적입니다. 계약 점검 결과와 독립적으로 판정합니다.</p></div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4"><DetailLine label="업무 E2E 실행 ID" value={text(row, "latestBusinessRunId") || "-"}/><DetailLine label="케이스 코드" value={text(row, "businessCaseCode") || "-"}/><DetailLine label="케이스 유형" value={text(row, "businessCaseType") || "-"}/><DetailLine label="실행 계정" value={text(row, "businessExecutedBy") || "-"}/><DetailLine label="실행 시각" value={formatDateTime(text(row, "businessExecutedAt"))}/></dl>
      <div className="mt-4"><p className="text-xs font-bold text-slate-500">업무 E2E 증적</p><FormattedValue value={firstValue(row, "businessEvidenceJson")}/></div>
    </article>
  </div>;
}

function ResultBadge({ result }: { result: TestResult }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${RESULT_CLASSES[result]}`}>{RESULT_LABELS[result]} · {result}</span>;
}

function BusinessResultBadge({ row }: { row: Row }) {
  const result = normalizeBusinessResult(row);
  const labels: Record<TestResult, string> = { PASSED: "E2E 통과", BLOCKED: "E2E 실패·차단", NOT_RUN: "E2E 미검증" };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${RESULT_CLASSES[result]}`}>{labels[result]} · {result}</span>;
}

function businessResultClass(row: Row) {
  const result = normalizeBusinessResult(row);
  return result === "PASSED" ? "border-emerald-200 bg-emerald-50/50" : result === "BLOCKED" ? "border-red-200 bg-red-50/50" : "border-slate-200 bg-slate-50";
}

function ResultRule({ result, text: description }: { result: TestResult; text: string }) {
  return <article className={`rounded-xl border p-4 ${RESULT_CLASSES[result]}`}><ResultBadge result={result}/><p className="mt-3 text-sm leading-6">{description}</p></article>;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-800">{value}</dd></div>;
}

function FormattedValue({ value }: { value: unknown }) {
  const formatted = formatStructuredValue(value);
  return <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">{formatted || "등록된 값이 없습니다."}</pre>;
}

function normalizeResult(row: Row): TestResult {
  const raw = text(row, "testState", "latestResult", "result", "testResult", "resultStatus", "status").toUpperCase();
  if (["PASSED", "PASS", "SUCCESS", "VERIFIED", "COMPLETED"].includes(raw)) return "PASSED";
  if (["BLOCKED", "FAILED", "FAIL", "ERROR", "RETRY"].includes(raw)) return "BLOCKED";
  return "NOT_RUN";
}

function normalizeBusinessResult(row: Row): TestResult {
  if (!text(row, "latestBusinessRunId", "businessTestResult")) return "NOT_RUN";
  const raw = text(row, "businessTestResult").toUpperCase();
  if (["PASSED", "PASS", "SUCCESS", "VERIFIED", "COMPLETED"].includes(raw)) return "PASSED";
  if (["BLOCKED", "FAILED", "FAIL", "ERROR", "RETRY"].includes(raw)) return "BLOCKED";
  return "NOT_RUN";
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
  return text(row, "itemId", "latestRunId", "testRunId", "runId") || `${text(row, "processCode")}:${text(row, "stepCode")}:${index}`;
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
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
