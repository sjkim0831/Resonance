import { ReactNode, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type EntityType = "gate" | "action" | "actor" | "process" | "step" | "case" | "job";
type Selection = { type: EntityType; row: Row };
type Props = {
  actors: Row[];
  assignments: Row[];
  actorReadiness: Row[];
  processes: Row[];
  steps: Row[];
  cases: Row[];
  jobs: Row[];
  artifacts: Row[];
  dependencies: Row[];
  runs: Row[];
  progress: Row[];
  screenContracts: Row[];
  backendReadiness: Row[];
  journeyGaps: Row[];
  completionRuns: Row[];
  deliveryQueue: Row[];
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
  const [processCode, setProcessCode] = useState(() => new URLSearchParams(location.search).get("process") || "");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const normalized = query.trim().toLowerCase();
  const visibleSteps = useMemo(() => props.steps.filter(row => !processCode || value(row, "processCode") === processCode), [props.steps, processCode]);
  const visibleCases = useMemo(() => props.cases.filter(row => (!processCode || value(row, "processCode") === processCode) && (!normalized || Object.values(row).join(" ").toLowerCase().includes(normalized))), [props.cases, processCode, normalized]);
  const visibleJobs = useMemo(() => props.jobs.filter(row => (!processCode || value(row, "processCode") === processCode) && (!normalized || Object.values(row).join(" ").toLowerCase().includes(normalized))), [props.jobs, processCode, normalized]);
  const completedJobs = props.jobs.filter(row => ["VERIFIED", "COMPLETED"].includes(value(row, "jobStatus"))).length;
  const passedCases = props.cases.filter(row => value(row, "status") === "APPROVED" || props.runs.some(run => value(run, "caseCode") === value(row, "caseCode") && value(run, "result") === "PASSED")).length;
  const completionGates = useMemo(() => {
    const activeSteps = props.steps.filter(row => value(row, "actorCode"));
    const readyAccounts = props.actorReadiness.filter(row => value(row, "readiness") === "READY").length;
    const readyScreens = props.screenContracts.filter(row => Number(row.readinessScore ?? 0) === 100).length;
    const readyBackends = props.backendReadiness.filter(row => Number(row.backendReadinessScore ?? 0) === 100).length;
    const responsiveScreens = props.screenContracts.filter(row => row.responsiveVerified === true && row.accessibilityVerified === true).length;
    const requiredArtifacts = props.artifacts.filter(row => row.required === true);
    const verifiedArtifacts = requiredArtifacts.filter(row => value(row, "status") === "VERIFIED").length;
    const blockerGaps = props.journeyGaps.filter(row => value(row, "severity") === "BLOCKER").length;
    const latestCompletion = props.completionRuns[0] || {};
    const gates: Row[] = [
      gate("ACTOR_ASSIGNMENT", "액터·계정·데이터 범위", activeSteps.length === props.steps.length && readyAccounts === props.actorReadiness.length && props.assignments.length > 0, `${activeSteps.length}/${props.steps.length} 단계 액터 연결 · ${readyAccounts}/${props.actorReadiness.length} 계정 준비`, "미배정 계정, 권한, 프로젝트 데이터 범위를 보완"),
      gate("PROCESS_CONTRACT", "프로세스 입력·출력·상태 전이", props.processes.every(row => Number(row.stepCount ?? 0) > 0 && value(row, "startCondition") && value(row, "completionCondition")), `${props.processes.filter(row => Number(row.stepCount ?? 0) > 0 && value(row, "startCondition") && value(row, "completionCondition")).length}/${props.processes.length} 프로세스 계약`, "시작·완료 조건과 단계 상태 전이를 설계"),
      gate("SCREEN_DELIVERY", "사용자·관리자 화면", props.screenContracts.length > 0 && readyScreens === props.screenContracts.length, `${readyScreens}/${props.screenContracts.length} 화면 계약 100점`, "미완료 화면의 섹션·기능·예외 상태를 개발"),
      gate("BACKEND_CONTRACT", "API·DB·외부 연계", props.backendReadiness.length > 0 && readyBackends === props.backendReadiness.length, `${readyBackends}/${props.backendReadiness.length} 백엔드 계약 완료`, "API·DB·권한·트랜잭션 테스트를 보완"),
      gate("TEST_SCENARIOS", "정상·예외·권한·격리·복구 테스트", props.cases.length > 0 && passedCases === props.cases.length && props.processes.every(process => new Set(props.cases.filter(item => value(item, "processCode") === value(process, "processCode")).map(item => value(item, "caseType"))).size >= 5), `${passedCases}/${props.cases.length} 테스트 통과`, "5종 테스트가 없거나 미통과한 프로세스를 보완"),
      gate("RESPONSIVE_ACCESSIBILITY", "모바일·접근성·화면 품질", props.screenContracts.length > 0 && responsiveScreens === props.screenContracts.length, `${responsiveScreens}/${props.screenContracts.length} 반응형·접근성 검증`, "모바일 재배치, 넘침, 키보드·명도 검증"),
      gate("EVIDENCE_RECOVERY", "증적·변경 이력·복구 기준", requiredArtifacts.length > 0 && verifiedArtifacts === requiredArtifacts.length && props.jobs.filter(row => row.required === true && !["VERIFIED", "COMPLETED"].includes(value(row, "jobStatus"))).every(row => value(row, "rollbackRef")), `${verifiedArtifacts}/${requiredArtifacts.length} 필수 산출물 검증`, "증적과 실패 시 복구 기준을 등록"),
      gate("ACTOR_E2E", "실제 액터 계정 종단간 업무", props.actorReadiness.length > 0 && readyAccounts === props.actorReadiness.length && props.runs.length > 0 && props.runs.every(row => value(row, "result") === "PASSED"), `${readyAccounts}/${props.actorReadiness.length} 계정 준비 · 실행 ${props.runs.length}건`, "액터별 실제 계정으로 전체 업무를 재실행"),
      gate("CUSTOMER_JOURNEY", "메뉴·화면·다음 업무 연결", blockerGaps === 0, `차단 고객 여정 ${blockerGaps}건`, "죽은 메뉴, 누락 화면, 다음 업무 링크를 연결"),
      gate("DEPLOYMENT_HEALTH", "운영 배포·헬스·자가복구", value(latestCompletion, "runStatus") === "COMPLETED" && Number(latestCompletion.blockedProcessCount ?? 0) === 0, latestCompletion.runStatus ? `최근 자동 완료 ${value(latestCompletion, "runStatus")} · 차단 ${value(latestCompletion, "blockedProcessCount")}` : "자동 완료 실행 증적 없음", "자동 배포, 런타임 헬스, 복구 훈련 증적 확인")
    ];
    return gates;
  }, [passedCases, props.actorReadiness, props.artifacts, props.assignments.length, props.backendReadiness, props.cases, props.completionRuns, props.jobs, props.journeyGaps, props.processes, props.runs, props.screenContracts, props.steps]);
  const priorityActions = useMemo(() => props.deliveryQueue.filter(row => value(row, "nextAction") !== "COMPLETE").map(row => {
    const code = value(row, "processCode"), next = value(row, "nextAction");
    const missingTests = Math.max(0, Number(row.testCount ?? 0) - Number(row.passedTests ?? 0));
    const missingTasks = Math.max(0, Number(row.requiredTasks ?? 0) - Number(row.completedTasks ?? 0));
    const missingScreens = Math.max(0, Number(row.screenContracts ?? 0) - Number(row.readyScreens ?? 0));
    const qualityPending = props.jobs.filter(job => value(job, "processCode") === code && ["VERIFIED", "COMPLETED"].includes(value(job, "jobStatus")) && !["PASSED", "VERIFIED"].includes(value(job, "qualityStatus"))).length;
    const rank = ({ EMISSION_PROJECT: 0, COMPANY_ONBOARDING: 1, LCA_EXECUTION: 2, REDUCTION_EXECUTION: 3, CERTIFICATE_ISSUANCE: 4 } as Record<string, number>)[code] ?? 20 + Number(row.developmentOrder ?? 99);
    return { actionCode: `NEXT_${code}`, processCode: code, actionName: nextActionName(next), processName: value(row, "processName"), priority: rank < 2 ? "P0" : rank < 5 ? "P1" : "P2", rank, completionScore: row.completionScore, reason: `테스트 ${missingTests}건 · 태스크 ${missingTasks}건 · 화면 ${missingScreens}건 · 품질 증적 ${qualityPending}건 미완료`, changeTarget: actionTarget(next), executionPlan: actionExecution(next), speedStrategy: actionSpeed(next), expectedResult: `${value(row, "processName")} 완료율 상승 및 ${nextActionName(next)} 병목 제거`, status: value(row, "priority") };
  }).sort((a, b) => Number(a.rank) - Number(b.rank)), [props.deliveryQueue, props.jobs]);
  const select = (type: EntityType, row: Row) => setSelection({ type, row });
  useEffect(() => {
    if (selection) return;
    const focus = new URLSearchParams(location.search).get("focus");
    if (!focus) return;
    const separator = focus.indexOf(":");
    const type = focus.slice(0, separator) as EntityType;
    const id = focus.slice(separator + 1).replace(/^#/, "");
    const sources: Record<EntityType, Row[]> = { gate: completionGates, action: priorityActions, actor: props.actors, process: props.processes, step: props.steps, case: props.cases, job: props.jobs };
    const row = sources[type]?.find(item => type === "gate" ? value(item, "gateCode") === id : type === "action" ? value(item, "actionCode") === id : type === "actor" ? value(item, "actorCode") === id : type === "process" ? value(item, "processCode") === id : type === "step" ? `${value(item, "processCode")}/${value(item, "stepCode")}` === id : type === "case" ? value(item, "caseCode") === id : value(item, "jobId") === id);
    if (row) setSelection({ type, row });
  }, [completionGates, priorityActions, props.actors, props.cases, props.jobs, props.processes, props.steps, selection]);

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

    <section className="rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-blue-700">PROJECT COMPLETION GATES</p><h3 className="mt-1 text-lg font-black text-[#052b57]">프로젝트 완료 판정</h3></div><strong className="text-lg text-[#052b57]">{completionGates.filter(row => value(row, "status") === "PASSED").length}/{completionGates.length} 통과</strong></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{completionGates.map(row => <button key={value(row, "gateCode")} type="button" onClick={() => select("gate", row)} className={`rounded-xl border p-3 text-left hover:border-blue-400 ${selection?.type === "gate" && value(selection.row, "gateCode") === value(row, "gateCode") ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "bg-white"}`}><span className="block font-bold text-slate-900">{value(row, "gateName")}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{value(row, "summary")}</span><span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${statusClass(value(row, "status"))}`}>{value(row, "status")}</span></button>)}</div>
    </section>

    <section className="overflow-hidden rounded-2xl border bg-white">
      <header className="border-b bg-slate-50 p-4"><p className="text-sm font-bold text-blue-700">FASTEST COMPLETION PRIORITY</p><h3 className="mt-1 text-lg font-black text-[#052b57]">가장 빠른 프로젝트 완료 순서</h3><p className="mt-1 text-sm leading-6 text-slate-600">고객 핵심 업무, 선행 프로세스, 현재 병목과 재사용 가능한 구현을 함께 계산한 순서입니다. 항목을 클릭하면 수정 대상과 가장 빠른 실행 방법이 표시됩니다.</p></header>
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead><tr className="border-b">{["순위","프로세스","완성도","현재 병목","수정 대상","속도 개선 방식"].map(head => <th key={head} className="px-4 py-3 font-bold text-slate-600">{head}</th>)}</tr></thead><tbody>{priorityActions.map((row, index) => <tr key={value(row, "actionCode")} className="border-b last:border-0"><td className="px-4 py-3"><button type="button" onClick={() => select("action", row)} className="rounded-lg bg-[#052b57] px-3 py-2 font-bold text-white">{index + 1} · {value(row, "priority")}</button></td><td className="px-4 py-3"><button type="button" onClick={() => select("action", row)} className="text-left font-bold text-blue-700 hover:underline">{value(row, "processName")}</button><div className="text-xs text-slate-500">{value(row, "processCode")}</div></td><td className="px-4 py-3 font-bold">{value(row, "completionScore")}%</td><td className="max-w-[300px] px-4 py-3 leading-6">{value(row, "reason")}</td><td className="max-w-[260px] px-4 py-3 leading-6">{value(row, "changeTarget")}</td><td className="max-w-[320px] px-4 py-3 leading-6">{value(row, "speedStrategy")}</td></tr>)}</tbody></table></div>
    </section>

    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {[
        ["품질 증적 자동 전파", props.jobs.filter(row => ["VERIFIED", "COMPLETED"].includes(value(row, "jobStatus")) && !["PASSED", "VERIFIED"].includes(value(row, "qualityStatus"))).length, "완료 코드는 다시 만들지 않고 기존 테스트 결과를 상위 프로세스에 연결"],
        ["병렬 실행 가능 태스크", props.jobs.filter(row => value(row, "executionMode") === "PARALLEL" && ["PLANNED", "RETRY"].includes(value(row, "jobStatus"))).length, "의존성이 충족된 작업을 여러 실행기가 동시에 처리"],
        ["고객 여정 차단", props.journeyGaps.filter(row => value(row, "severity") === "BLOCKER").length, "죽은 링크와 다음 업무 연결을 코드 개발보다 먼저 복구"],
        ["미검증 전문 화면", props.screenContracts.filter(row => Number(row.readinessScore ?? 0) < 100).length, "공통 테마·섹션·컴포넌트를 조립하고 변경분만 빌드"]
      ].map(([title, count, description]) => <button key={String(title)} type="button" onClick={() => { const row = priorityActions[0]; if (row) select("action", { ...row, actionCode: `SPEED_${String(title)}`, actionName: String(title), reason: String(description), changeTarget: String(title), speedStrategy: String(description) }); }} className="rounded-2xl border bg-white p-4 text-left hover:border-blue-400 hover:bg-blue-50"><span className="text-sm font-bold text-slate-500">{String(title)}</span><strong className="mt-1 block text-2xl font-black text-[#052b57]">{String(count)}</strong><span className="mt-2 block text-xs leading-5 text-slate-600">{String(description)}</span></button>)}
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

    <Detail selection={selection} props={props} busy={props.busy} copyMessage={copyMessage} onCopyMessage={setCopyMessage} onPost={props.onPost} />
  </div>;
}

function Lane({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border bg-white"><header className="flex items-center justify-between border-b bg-slate-50 px-4 py-3"><h4 className="font-black text-[#052b57]">{title}</h4><span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700">{count}</span></header><div className="max-h-[620px] space-y-2 overflow-y-auto p-3">{children}</div></section>;
}

function Item({ title, subtitle, status, selected, onClick }: { title: string; subtitle: string; status?: string; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`w-full rounded-xl border p-3 text-left ${selected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}`}><span className="block font-bold text-slate-900">{title}</span><span className="mt-1 block break-all text-xs leading-5 text-slate-500">{subtitle}</span>{status && <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${statusClass(status)}`}>{status}</span>}</button>;
}

function Detail({ selection, props, busy, copyMessage, onCopyMessage, onPost }: { selection: Selection | null; props: Props; busy: boolean; copyMessage: string; onCopyMessage: (message: string) => void; onPost: Props["onPost"] }) {
  if (!selection) return <section className="rounded-2xl border border-dashed bg-slate-50 p-8 text-center text-slate-600">액터, 프로세스, 단계, 테스트 또는 태스크를 선택하면 세부 내용이 표시됩니다.</section>;
  const row = selection.row;
  const processCode = value(row, "processCode");
  const stepCode = value(row, "stepCode");
  const jobId = value(row, "jobId");
  const fields: [string, string][] = selection.type === "gate" ? [["완료 게이트", value(row, "gateCode")], ["판정", value(row, "status")], ["현재 현황", value(row, "summary")], ["완료 기준", value(row, "completionCriteria")], ["다음 작업", value(row, "nextAction")]]
    : selection.type === "action" ? [["우선순위", value(row, "priority")], ["프로세스", value(row, "processCode")], ["현재 완성도", `${value(row, "completionScore")}%`], ["병목 원인", value(row, "reason")], ["수정 대상", value(row, "changeTarget")], ["실행 절차", value(row, "executionPlan")], ["속도 개선", value(row, "speedStrategy")], ["완료 후 결과", value(row, "expectedResult")]]
    : selection.type === "actor" ? [["액터 코드", value(row, "actorCode")], ["유형", value(row, "actorType")], ["책임", value(row, "responsibility")], ["책무", value(row, "accountability")], ["역량", value(row, "competency")], ["겸직 금지", value(row, "conflictActorCodes")]]
    : selection.type === "process" ? [["프로세스 코드", processCode], ["목표", value(row, "goal")], ["시작 조건", value(row, "startCondition")], ["완료 조건", value(row, "completionCondition")], ["선행 프로세스", value(row, "prerequisiteCodes") || "없음"], ["자동화", value(row, "automationMode")]]
    : selection.type === "step" ? [["프로세스", processCode], ["단계 코드", stepCode], ["담당 액터", value(row, "actorCode")], ["상태 전이", `${value(row, "fromState")} → ${value(row, "toState")}`], ["완료 조건", value(row, "completionRule")], ["입력 계약", value(row, "inputContract")], ["출력 계약", value(row, "outputContract")], ["API", value(row, "apiContract")]]
    : selection.type === "case" ? [["프로세스", processCode], ["시나리오 코드", value(row, "caseCode")], ["유형", value(row, "caseType")], ["사전 조건", value(row, "preconditions")], ["실행 절차", value(row, "stepsJson")], ["기대 결과", value(row, "assertionsJson")]]
    : [["프로세스", processCode], ["단계", stepCode], ["작업 유형", value(row, "jobType")], ["대상", value(row, "targetPath") || "공통"], ["승인", value(row, "approvalStatus")], ["품질", value(row, "qualityStatus")], ["시도", `${value(row, "attemptCount")}/${value(row, "maxAttempts")}`], ["증적", value(row, "evidenceRef") || "미등록"], ["복구 기준", value(row, "rollbackRef") || "미등록"], ["최근 오류", value(row, "lastError") || "없음"]];
  const deps = selection.type === "job" ? props.dependencies.filter(dep => value(dep, "jobId") === jobId) : [];
  const routes = [value(row, "userPath"), value(row, "adminPath"), value(row, "targetPath")].filter(path => path.startsWith("/"));
  const identity = entityIdentity(selection);
  const focusUrl = `${location.origin}/admin/system/actor-process?process=${encodeURIComponent(processCode)}&focus=${encodeURIComponent(`${selection.type}:${identity}`)}`;
  const reference = `[개발현황판 ${selection.type.toUpperCase()}:${identity}] 프로세스=${processCode || "-"} 단계=${stepCode || "-"} 항목=${value(row, "gateName") || value(row, "actionName") || value(row, "actorName") || value(row, "processName") || value(row, "stepName") || value(row, "caseName") || value(row, "jobName")} 상태=${value(row, "jobStatus") || value(row, "status") || value(row, "automationStatus") || "-"} 링크=${focusUrl}`;
  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
      document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
    }
    onCopyMessage(message);
  };
  return <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-sm font-bold text-blue-700">{selection.type.toUpperCase()} DETAIL · {identity}</p><h3 className="mt-1 text-xl font-black text-[#052b57]">{value(row, "gateName") || value(row, "actorName") || value(row, "processName") || value(row, "stepName") || value(row, "caseName") || value(row, "jobName")}</h3></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void copy(reference, "세션 지칭자를 복사했습니다.")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700">세션 지칭 복사</button><button type="button" onClick={() => void copy(`${reference}\n이 항목의 설계·프론트·백엔드·DB·테스트를 확인하고 미완료 내용을 개발한 뒤 검증 결과를 알려줘.`, "개발 요청문을 복사했습니다.")} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-bold text-blue-700">개발 요청문 복사</button>{routes.map(route => <a key={route} href={route} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-bold text-blue-700">화면 열기</a>)}{processCode && <button type="button" disabled={busy} onClick={() => void onPost("development/direct", { processCode })} className="rounded-lg bg-[#052b57] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">프로세스 개발</button>}{selection.type === "job" && <button type="button" disabled={busy || ["RUNNING", "VERIFIED", "COMPLETED"].includes(value(row, "jobStatus"))} onClick={() => void onPost("development/request", { jobId })} className="rounded-lg bg-[#246beb] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">이 태스크 개발 요청</button>}</div></div>
    {copyMessage && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800" role="status">{copyMessage}</p>}
    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">이 세션에 공유할 지칭</p><code className="mt-1 block break-all text-sm text-slate-800">{reference}</code></div>
    <dl className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{fields.map(([label, content]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm leading-6 text-slate-800">{content || "-"}</dd></div>)}</dl>
    {deps.length > 0 && <div className="mt-4"><h4 className="font-black text-[#052b57]">선행 태스크</h4><ul className="mt-2 space-y-2">{deps.map(dep => <li key={value(dep, "dependsOnJobId")} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">#{value(dep, "dependsOnJobId")} {value(dep, "dependsOnJobName")} · {value(dep, "dependsOnStatus")}</li>)}</ul></div>}
  </section>;
}

function entityIdentity(selection: Selection) {
  const row = selection.row;
  if (selection.type === "gate") return value(row, "gateCode");
  if (selection.type === "action") return value(row, "actionCode");
  if (selection.type === "actor") return value(row, "actorCode");
  if (selection.type === "process") return value(row, "processCode");
  if (selection.type === "step") return `${value(row, "processCode")}/${value(row, "stepCode")}`;
  if (selection.type === "case") return value(row, "caseCode");
  return `#${value(row, "jobId")}`;
}

function nextActionName(action: string) {
  return ({ DEFINE_STEPS: "업무 단계 설계", BIND_ACTORS: "액터·권한 연결", DESIGN_TESTS: "5종 테스트 설계", RUN_TESTS: "미통과 테스트 실행", GENERATE_TASKS: "개발 태스크 생성", RECOVER_BLOCKED_TASKS: "차단 태스크 복구", EXECUTE_TASKS: "개발 태스크 실행", DEFINE_ARTIFACTS: "산출물 계약 설계", VERIFY_ARTIFACTS: "산출물·증적 검증", DEFINE_SCREENS: "전문 화면 계약 설계", COMPLETE_SCREENS: "화면 구현·E2E 검증" } as Record<string, string>)[action] || action;
}
function actionTarget(action: string) {
  if (action === "RUN_TESTS") return "미통과 시나리오와 품질 PENDING 태스크";
  if (action === "GENERATE_TASKS") return "설계는 있으나 개발 태스크가 없는 프로세스";
  if (action === "DEFINE_SCREENS" || action === "COMPLETE_SCREENS") return "사용자·관리자 화면 계약과 연결 라우트";
  if (action === "BIND_ACTORS") return "계정·권한·프로젝트 데이터 범위";
  return "현황판에 표시된 미완료 필수 계약";
}
function actionExecution(action: string) {
  if (action === "RUN_TESTS") return "기존 구현 확인 → 실제 계정·API·DB·브라우저 테스트 → 증적 저장 → 품질 상태 갱신";
  if (action === "GENERATE_TASKS") return "프로세스 계약 검사 → DB·API·프론트·테스트 태스크 자동 생성 → 의존성 순서 배치";
  if (action === "DEFINE_SCREENS" || action === "COMPLETE_SCREENS") return "기존 화면·공통 자산 조사 → 계약 보완 → 변경 화면만 구현 → 모바일·E2E 검사";
  return "설계 정본 보완 → 선택 태스크 개발 요청 → 품질 게이트 통과 → 자동 배포";
}
function actionSpeed(action: string) {
  if (action === "RUN_TESTS") return "코드 재생성·전체 빌드 없이 테스트와 증적 전파만 수행";
  if (action === "GENERATE_TASKS") return "제너레이터로 일괄 생성하고 의존성이 없는 태스크는 병렬 처리";
  if (action === "DEFINE_SCREENS" || action === "COMPLETE_SCREENS") return "등록된 KRDS 테마·섹션·컴포넌트를 재사용하고 변경분만 빌드";
  return "인덱스 검색, 공통 자산 재사용, 증분 컴파일, 자동 검증을 우선 적용";
}

function gate(code: string, name: string, passed: boolean, summary: string, nextAction: string): Row {
  return { gateCode: code, gateName: name, status: passed ? "PASSED" : "BLOCKED", summary, completionCriteria: "관련 필수 항목 100% 충족 및 차단·실패 0건", nextAction };
}
