import { ReactNode, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type EntityType = "actor" | "process" | "step" | "case" | "job";
type Selection = { type: EntityType; row: Row };
type Props = {
  actors: Row[];
  processes: Row[];
  steps: Row[];
  cases: Row[];
  jobs: Row[];
  dependencies: Row[];
  runs: Row[];
  progress: Row[];
  busy: boolean;
  onPost: (path: string, body: Record<string, unknown>) => Promise<void>;
};

const value = (row: Row, key: string) => String(row[key] ?? "");
const statusClass = (status: string) => status === "VERIFIED" || status === "COMPLETED" || status === "APPROVED" || status === "PASSED"
  ? "bg-emerald-100 text-emerald-800"
  : status === "FAILED" || status === "BLOCKED"
    ? "bg-red-100 text-red-800"
    : status === "RUNNING" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800";

export function CustomerWorkDevelopmentDashboard(props: Props) {
  const [processCode, setProcessCode] = useState("");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const normalized = query.trim().toLowerCase();
  const visibleSteps = useMemo(() => props.steps.filter(row => !processCode || value(row, "processCode") === processCode), [props.steps, processCode]);
  const visibleCases = useMemo(() => props.cases.filter(row => (!processCode || value(row, "processCode") === processCode) && (!normalized || Object.values(row).join(" ").toLowerCase().includes(normalized))), [props.cases, processCode, normalized]);
  const visibleJobs = useMemo(() => props.jobs.filter(row => (!processCode || value(row, "processCode") === processCode) && (!normalized || Object.values(row).join(" ").toLowerCase().includes(normalized))), [props.jobs, processCode, normalized]);
  const completedJobs = props.jobs.filter(row => ["VERIFIED", "COMPLETED"].includes(value(row, "jobStatus"))).length;
  const passedCases = props.cases.filter(row => value(row, "status") === "APPROVED" || props.runs.some(run => value(run, "caseCode") === value(row, "caseCode") && value(run, "result") === "PASSED")).length;
  const select = (type: EntityType, row: Row) => setSelection({ type, row });

  return <div className="space-y-5">
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
      <p className="text-sm font-bold text-blue-700">CUSTOMER WORK DELIVERY BOARD</p>
      <h3 className="mt-1 text-xl font-black text-[#052b57]">고객 업무를 액터·프로세스·테스트·개발 태스크 단위로 지정하고 완료까지 추적합니다.</h3>
      <p className="mt-2 text-sm leading-6 text-slate-700">모든 항목을 선택하면 책임, 계약, 화면, 상태, 검증 증적과 다음 작업이 표시됩니다. 개발 요청은 선택한 태스크만 승인된 실행 큐에 등록합니다.</p>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[
        ["액터", props.actors.length, "actor", props.actors[0]],
        ["프로세스", props.processes.length, "process", props.processes[0]],
        ["업무 단계", props.steps.length, "step", props.steps[0]],
        ["통과 테스트", `${passedCases}/${props.cases.length}`, "case", props.cases[0]],
        ["완료 태스크", `${completedJobs}/${props.jobs.length}`, "job", props.jobs[0]]
      ].map(([label, count, type, row]) => <button key={String(label)} type="button" disabled={!row} onClick={() => row && select(type as EntityType, row as Row)} className="rounded-2xl border bg-white p-4 text-left hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50">
        <span className="text-sm font-bold text-slate-500">{String(label)}</span><strong className="mt-1 block text-2xl font-black text-[#052b57]">{String(count)}</strong>
      </button>)}
    </section>

    <section className="grid gap-3 rounded-2xl border bg-white p-4 lg:grid-cols-[minmax(240px,1fr)_minmax(240px,1fr)_auto]">
      <label className="text-sm font-bold text-slate-700">프로세스
        <select value={processCode} onChange={event => { setProcessCode(event.target.value); setSelection(null); }} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
          <option value="">전체 고객 업무</option>
          {props.processes.map(row => <option key={value(row, "processCode")} value={value(row, "processCode")}>{value(row, "processName")} ({value(row, "processCode")})</option>)}
        </select>
      </label>
      <label className="text-sm font-bold text-slate-700">테스트·태스크 검색
        <input value={query} onChange={event => setQuery(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3" placeholder="업무명, 화면, 상태, 액터" />
      </label>
      <button type="button" disabled={props.busy || !processCode} onClick={() => void props.onPost("development/direct", { processCode })} className="min-h-11 self-end rounded-lg bg-[#246beb] px-5 font-bold text-white disabled:opacity-50">선택 프로세스 개발</button>
    </section>

    <section className="grid gap-4 xl:grid-cols-4">
      <Lane title="액터" count={props.actors.length}>{props.actors.map(row => <Item key={value(row, "actorCode")} selected={selection?.type === "actor" && value(selection.row, "actorCode") === value(row, "actorCode")} title={value(row, "actorName")} subtitle={`${value(row, "actorType")} · ${value(row, "actorCode")}`} onClick={() => select("actor", row)} />)}</Lane>
      <Lane title="프로세스·단계" count={visibleSteps.length}>{props.processes.filter(row => !processCode || value(row, "processCode") === processCode).map(row => { const progress = props.progress.find(item => value(item, "processCode") === value(row, "processCode")); return <Item key={value(row, "processCode")} selected={selection?.type === "process" && value(selection.row, "processCode") === value(row, "processCode")} title={value(row, "processName")} subtitle={`${value(row, "stepCount")}단계 · 테스트 ${value(row, "approvedCaseCount")}/${value(row, "caseCount")} · 개발 ${value(progress || {}, "completionPercent") || "0"}%`} status={value(row, "status")} onClick={() => select("process", row)} />; })}{visibleSteps.map(row => <Item key={value(row, "stepCode")} selected={selection?.type === "step" && value(selection.row, "stepCode") === value(row, "stepCode")} title={`${value(row, "stepOrder")}. ${value(row, "stepName")}`} subtitle={`${value(row, "actorCode")} · ${value(row, "userPath") || value(row, "adminPath") || "화면 연결 필요"}`} status={value(row, "automationStatus")} onClick={() => select("step", row)} />)}</Lane>
      <Lane title="테스트 시나리오" count={visibleCases.length}>{visibleCases.map(row => { const passed = props.runs.some(run => value(run, "caseCode") === value(row, "caseCode") && value(run, "result") === "PASSED"); return <Item key={value(row, "caseCode")} selected={selection?.type === "case" && value(selection.row, "caseCode") === value(row, "caseCode")} title={value(row, "caseName")} subtitle={`${value(row, "caseType")} · ${value(row, "caseCode")}`} status={passed ? "PASSED" : value(row, "status")} onClick={() => select("case", row)} />; })}</Lane>
      <Lane title="개발 태스크" count={visibleJobs.length}>{visibleJobs.map(row => <Item key={value(row, "jobId")} selected={selection?.type === "job" && value(selection.row, "jobId") === value(row, "jobId")} title={`#${value(row, "jobId")} ${value(row, "jobName")}`} subtitle={`${value(row, "jobType")} · ${value(row, "targetPath") || "공통 작업"}`} status={value(row, "jobStatus")} onClick={() => select("job", row)} />)}</Lane>
    </section>

    <Detail selection={selection} props={props} busy={props.busy} onPost={props.onPost} />
  </div>;
}

function Lane({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border bg-white"><header className="flex items-center justify-between border-b bg-slate-50 px-4 py-3"><h4 className="font-black text-[#052b57]">{title}</h4><span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700">{count}</span></header><div className="max-h-[620px] space-y-2 overflow-y-auto p-3">{children}</div></section>;
}

function Item({ title, subtitle, status, selected, onClick }: { title: string; subtitle: string; status?: string; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`w-full rounded-xl border p-3 text-left ${selected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}`}><span className="block font-bold text-slate-900">{title}</span><span className="mt-1 block break-all text-xs leading-5 text-slate-500">{subtitle}</span>{status && <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${statusClass(status)}`}>{status}</span>}</button>;
}

function Detail({ selection, props, busy, onPost }: { selection: Selection | null; props: Props; busy: boolean; onPost: Props["onPost"] }) {
  if (!selection) return <section className="rounded-2xl border border-dashed bg-slate-50 p-8 text-center text-slate-600">액터, 프로세스, 단계, 테스트 또는 태스크를 선택하면 세부 내용이 표시됩니다.</section>;
  const row = selection.row;
  const processCode = value(row, "processCode");
  const stepCode = value(row, "stepCode");
  const jobId = value(row, "jobId");
  const fields: [string, string][] = selection.type === "actor" ? [["액터 코드", value(row, "actorCode")], ["유형", value(row, "actorType")], ["책임", value(row, "responsibility")], ["책무", value(row, "accountability")], ["역량", value(row, "competency")], ["겸직 금지", value(row, "conflictActorCodes")]]
    : selection.type === "process" ? [["프로세스 코드", processCode], ["목표", value(row, "goal")], ["시작 조건", value(row, "startCondition")], ["완료 조건", value(row, "completionCondition")], ["선행 프로세스", value(row, "prerequisiteCodes") || "없음"], ["자동화", value(row, "automationMode")]]
    : selection.type === "step" ? [["프로세스", processCode], ["단계 코드", stepCode], ["담당 액터", value(row, "actorCode")], ["상태 전이", `${value(row, "fromState")} → ${value(row, "toState")}`], ["완료 조건", value(row, "completionRule")], ["입력 계약", value(row, "inputContract")], ["출력 계약", value(row, "outputContract")], ["API", value(row, "apiContract")]]
    : selection.type === "case" ? [["프로세스", processCode], ["시나리오 코드", value(row, "caseCode")], ["유형", value(row, "caseType")], ["사전 조건", value(row, "preconditions")], ["실행 절차", value(row, "stepsJson")], ["기대 결과", value(row, "assertionsJson")]]
    : [["프로세스", processCode], ["단계", stepCode], ["작업 유형", value(row, "jobType")], ["대상", value(row, "targetPath") || "공통"], ["승인", value(row, "approvalStatus")], ["품질", value(row, "qualityStatus")], ["시도", `${value(row, "attemptCount")}/${value(row, "maxAttempts")}`], ["증적", value(row, "evidenceRef") || "미등록"], ["복구 기준", value(row, "rollbackRef") || "미등록"], ["최근 오류", value(row, "lastError") || "없음"]];
  const deps = selection.type === "job" ? props.dependencies.filter(dep => value(dep, "jobId") === jobId) : [];
  const routes = [value(row, "userPath"), value(row, "adminPath"), value(row, "targetPath")].filter(path => path.startsWith("/"));
  return <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-sm font-bold text-blue-700">{selection.type.toUpperCase()} DETAIL</p><h3 className="mt-1 text-xl font-black text-[#052b57]">{value(row, "actorName") || value(row, "processName") || value(row, "stepName") || value(row, "caseName") || value(row, "jobName")}</h3></div><div className="flex flex-wrap gap-2">{routes.map(route => <a key={route} href={route} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-bold text-blue-700">화면 열기</a>)}{processCode && <button type="button" disabled={busy} onClick={() => void onPost("development/direct", { processCode })} className="rounded-lg bg-[#052b57] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">프로세스 개발</button>}{selection.type === "job" && <button type="button" disabled={busy || ["RUNNING", "VERIFIED", "COMPLETED"].includes(value(row, "jobStatus"))} onClick={() => void onPost("development/request", { jobId })} className="rounded-lg bg-[#246beb] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">이 태스크 개발 요청</button>}</div></div>
    <dl className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{fields.map(([label, content]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm leading-6 text-slate-800">{content || "-"}</dd></div>)}</dl>
    {deps.length > 0 && <div className="mt-4"><h4 className="font-black text-[#052b57]">선행 태스크</h4><ul className="mt-2 space-y-2">{deps.map(dep => <li key={value(dep, "dependsOnJobId")} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">#{value(dep, "dependsOnJobId")} {value(dep, "dependsOnJobName")} · {value(dep, "dependsOnStatus")}</li>)}</ul></div>}
  </section>;
}
