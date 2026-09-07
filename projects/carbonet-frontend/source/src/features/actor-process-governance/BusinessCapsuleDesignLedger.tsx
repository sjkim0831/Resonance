import { useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Payload = { summary?: Row; capsules?: Row[] };
const text = (row: Row, key: string) => String(row[key] ?? "");
const num = (row: Row, key: string) => Number(row[key] ?? 0);
const yes = (value: unknown) => value === true || value === "true";
const rows = (value: unknown): Row[] => {
  if (Array.isArray(value)) return value as Row[];
  const candidate = value && typeof value === "object" && "value" in value
    ? (value as { value?: unknown }).value
    : value;
  if (typeof candidate !== "string") return [];
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed as Row[] : [];
  } catch {
    return [];
  }
};
const values = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(item => typeof item === "string" ? [item] : item && typeof item === "object" ? [String((item as Row).code || (item as Row).name || (item as Row).method || JSON.stringify(item))] : []);
  const candidate = value && typeof value === "object" && "value" in value ? (value as { value?: unknown }).value : value;
  if (typeof candidate !== "string" || !candidate.trim()) return [];
  try { return values(JSON.parse(candidate)); } catch { return candidate.split(/[\n,·]/).map(item => item.trim()).filter(Boolean); }
};

export function BusinessCapsuleDesignLedger() {
  const endpoint = "/api/internal/actor-process/business-capsule-ledger";
  const [payload, setPayload] = useState<Payload>({});
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { credentials: "include" });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error(`설계 원장 API가 JSON을 반환하지 않았습니다. (${response.status})`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "설계 원장 조회 실패");
      setPayload(body); setError("");
      if (!selected && body.capsules?.length) setSelected(String(body.capsules[0].capsuleCode || ""));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "설계 원장 조회 실패"); }
    finally { setLoading(false); }
  }, [endpoint, selected]);
  useEffect(() => { void load(); }, [load]);
  const capsules = payload.capsules || [];
  const capsule = useMemo(() => capsules.find(row => text(row, "capsuleCode") === selected) || capsules[0], [capsules, selected]);
  const steps = rows(capsule?.steps);
  const screens = rows(capsule?.screens);
  const permissions = rows(capsule?.permissions);
  const relay = rows(capsule?.accountRelayContract);
  const versions = rows(capsule?.versions);
  const operations = rows(capsule?.operations);
  const head = versions[0] || {};
  const mutate = async (action: string, operationType = "") => {
    if (!capsule || running) return;
    setRunning(operationType || action); setNotice("");
    try {
      const query = new URLSearchParams({ capsuleCode: text(capsule, "capsuleCode") });
      if (operationType) query.set("operationType", operationType);
      const response = await fetch(`${endpoint}/${action}?${query}`, { method: "POST", credentials: "include" });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error(`자동화 API 응답 오류 (${response.status})`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || `${action} 실패`);
      setNotice(`${operationType || action}: ${body.operationStatus || body.status || "완료"}`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "자동화 실행 실패"); }
    finally { setRunning(""); }
  };

  if (loading && !capsule) return <section className="rounded-2xl border bg-white p-8 font-bold text-slate-600">설계 원장을 불러오는 중입니다.</section>;
  return <div className="space-y-5" data-business-capsule-ledger="v1">
    <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-[#052b57] to-[#174ea6] p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black tracking-[.12em] text-blue-200">BUSINESS DESIGN LEDGER · SSOT</p><h2 className="mt-2 text-2xl font-black">업무 설계 원장</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50">업무 종류부터 프로세스·계정 릴레이·액터·권한·홈/관리자 화면·기능·검증까지 하나의 버전으로 고정합니다.</p></div><div className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-black">직접 수정 금지 · 새 버전 승인 방식</div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">{[
        ["캡슐", num(payload.summary || {}, "capsuleCount")], ["동결", num(payload.summary || {}, "closedCount")], ["검토 중", num(payload.summary || {}, "openCount")],
        ["단계", num(payload.summary || {}, "stepCount")], ["화면", num(payload.summary || {}, "screenCount")], ["무결성", `${num(payload.summary || {}, "integrityPercent")}%`]
      ].map(([label, value]) => <article key={String(label)} className="rounded-xl bg-white/10 p-4"><span className="text-xs text-blue-100">{label}</span><strong className="mt-1 block text-2xl">{value}</strong></article>)}</div>
    </section>
    <MemberDomainQaPanel />
    {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
    <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-black text-[#052b57]">등록 프로세스</h3><button className="rounded-lg border px-3 py-2 text-xs font-bold" onClick={() => void load()} type="button">새로고침</button></div><div className="mt-4 space-y-2">{capsules.map(row => {
        const active = text(row, "capsuleCode") === text(capsule || {}, "capsuleCode");
        return <button key={text(row, "capsuleCode")} type="button" onClick={() => setSelected(text(row, "capsuleCode"))} className={`w-full rounded-xl border p-4 text-left ${active ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}><div className="flex items-center justify-between gap-2"><strong className="text-sm text-[#052b57]">{text(row, "processName") || text(row, "processCode")}</strong><span className={`rounded-full px-2 py-1 text-[11px] font-black ${text(row, "lifecycleStatus") === "FROZEN" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{text(row, "lifecycleStatus")}</span></div><p className="mt-2 text-xs text-slate-500">{text(row, "workTypeCode")} · v{text(row, "capsuleVersion")}</p></button>;
      })}</div></aside>
      {capsule ? <main className="space-y-5">
        <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black text-blue-700">{text(capsule, "workTypeCode")} · {text(capsule, "processCode")}</p><h3 className="mt-1 text-2xl font-black text-[#052b57]">{text(capsule, "processName")}</h3><p className="mt-2 text-sm text-slate-600">원장 버전 {text(capsule, "capsuleVersion")} · 다음 프로세스 {text(capsule, "nextProcessCode") || "종료"}</p></div><div className={`rounded-xl px-4 py-3 text-sm font-black ${text(capsule, "capsuleStatus") === "CLOSED" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{text(capsule, "capsuleStatus")} · {text(capsule, "lifecycleStatus")}</div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
            ["실행 단계", `${num(capsule, "executableStepCount")}/${num(capsule, "stepCount")}`], ["액터", num(capsule, "actorCount")], ["준비 화면", `${num(capsule, "readyScreenCount")}/${num(capsule, "screenCount")}`], ["권한", `${num(capsule, "coveredPermissionCount")}/${num(capsule, "permissionRequirementCount")}`], ["테스트 유형", `${num(capsule, "passedTestTypeCount")}/${num(capsule, "automatedTestTypeCount")}`]
          ].map(([label, value]) => <article key={String(label)} className="rounded-xl border bg-slate-50 p-4"><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-xl text-[#052b57]">{value}</strong></article>)}</div>
        </section>
        <WorkflowReplayConsole capsule={capsule} />
        <ExecutionRelationSelector capsules={capsules} capsule={capsule} onProcessChange={setSelected} />
        <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm" data-capsule-automation="v1"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black tracking-[.12em] text-blue-700">VERSION AUTOMATION</p><h3 className="mt-1 font-black text-[#052b57]">설계→구현 자동화 게이트</h3><p className="mt-1 text-xs text-slate-600">현재 헤드 v{text(head, "versionNo") || text(capsule, "capsuleVersion")} · {text(head, "versionStatus") || text(capsule, "lifecycleStatus")}</p></div>{notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">{notice}</p>}</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-7">{[
            ["draft", "", "1. 새 초안"], ["run", "LINT", "2. 계약 검사"], ["run", "IMPACT", "3. 영향도"], ["approve", "", "4. 승인"], ["run", "GENERATE", "5. SDUI 생성"], ["run", "TEST", "6. 계정 릴레이"], ["close", "", "7. 동결"]
          ].map(([action, operation, label]) => <button key={label} type="button" disabled={Boolean(running)} onClick={() => void mutate(action, operation)} className="min-h-11 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-black text-blue-900 enabled:hover:bg-blue-100 disabled:opacity-50">{running === (operation || action) ? "처리 중…" : label}</button>)}</div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2"><article className="rounded-xl border bg-slate-50 p-4"><h4 className="text-xs font-black text-slate-700">최근 버전</h4><div className="mt-2 space-y-1">{versions.slice(0, 4).map(row => <p key={text(row, "versionId")} className="flex justify-between text-xs"><span>v{text(row, "versionNo")}</span><strong>{text(row, "versionStatus")}</strong></p>)}</div></article><article className="rounded-xl border bg-slate-50 p-4"><h4 className="text-xs font-black text-slate-700">최근 자동화 증거</h4><div className="mt-2 space-y-1">{operations.slice(0, 6).map(row => <p key={text(row, "operationId")} className="flex justify-between text-xs"><span>{text(row, "operationType")}</span><strong className={text(row, "operationStatus") === "PASSED" ? "text-emerald-700" : "text-amber-700"}>{text(row, "operationStatus")}</strong></p>)}</div></article></div>
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-black text-[#052b57]">계정·액터 릴레이</h3><div className="mt-4 grid gap-3 lg:grid-cols-4">{relay.map((row, index) => <article key={`${text(row, "actorCode")}-${index}`} className="relative rounded-xl border border-blue-200 bg-blue-50 p-4"><span className="text-xs font-black text-blue-700">{num(row, "sequence")}단계</span><strong className="mt-1 block text-sm text-[#052b57]">{text(row, "accountType")}</strong><p className="text-xs font-bold text-slate-600">actor={text(row, "actorCode")}</p><p className="mt-2 text-xs leading-5 text-slate-700">{text(row, "responsibility")}</p></article>)}</div></section>
        <LedgerTable title={`업무 단계 ${steps.length}개`} heads={["순서", "단계·액터", "상태 전환", "홈 화면", "관리자 화면", "완료 조건"]} rows={steps.map(row => [text(row, "stepOrder"), `${text(row, "stepName")}\n${text(row, "actorCode")}`, `${text(row, "fromState")} → ${text(row, "toState")}`, text(row, "userPath") || "-", text(row, "adminPath") || "-", text(row, "completionRule") || "-"])} />
        <LedgerTable title={`화면 계약 ${screens.length}개`} heads={["단계", "대상", "화면", "경로", "계약", "6대 검증"]} rows={screens.map(row => { const checks = ["apiVerified", "databaseVerified", "authorityVerified", "responsiveVerified", "accessibilityVerified", "exceptionStatesVerified"].filter(key => yes(row[key])).length; return [text(row, "stepCode"), text(row, "audience"), text(row, "screenName"), text(row, "routePath"), text(row, "contractStatus"), `${checks}/6`]; })} />
        <LedgerTable title={`권한 요구 ${permissions.length}개`} heads={["단계", "권한", "범위", "액터 보유"]} rows={permissions.map(row => [text(row, "stepCode"), text(row, "permissionCode"), text(row, "scopeType"), yes(row.covered) ? "COVERED" : "MISSING"])} />
      </main> : <main className="rounded-2xl border bg-white p-10 text-center text-slate-500">등록된 업무 캡슐이 없습니다.</main>}
    </section>
  </div>;
}

function MemberDomainQaPanel() {
  const endpoint = "/api/internal/actor-process/business-capsule-ledger/member-domain-qa";
  const [status, setStatus] = useState<Row>({ status: "IDLE", processes: 21, steps: 81, gates: 4 });
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(endpoint, { credentials: "include", headers: { Accept: "application/json" } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `회원 QA 조회 실패 (${response.status})`);
    setStatus(body); setError(""); return body as Row;
  }, []);
  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : "회원 QA 조회 실패")); }, [load]);
  const execute = async () => {
    try {
      const response = await fetch(`${endpoint}/execute`, { method: "POST", credentials: "include", headers: { Accept: "application/json" } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `회원 QA 실행 실패 (${response.status})`);
      setStatus(body);
      for (let attempt = 0; attempt < 160; attempt += 1) {
        await new Promise(resolve => window.setTimeout(resolve, 2000));
        const current = await load();
        if (text(current, "status") !== "RUNNING") break;
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "회원 QA 실행 실패"); }
  };
  const processList = rows(status.processList);
  const running = text(status, "status") === "RUNNING";
  const passed = text(status, "status") === "PASSED";
  return <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm" data-member-domain-qa="v1">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black tracking-[.12em] text-emerald-700">MEMBER DOMAIN · FULL QA</p><h3 className="mt-1 text-xl font-black text-[#052b57]">회원 업무 전체 자동 검증·녹화</h3><p className="mt-1 text-sm text-slate-600">정적 설계 → 로그인·생명주기 → 통제 → 예외 복구를 실제 계정 릴레이로 검증합니다.</p></div><button type="button" onClick={() => void execute()} disabled={running} className="min-h-11 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:bg-slate-400">{running ? "4개 게이트 실행 중…" : "21개 프로세스 전체 실행"}</button></div>
    {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-4">{[["프로세스", `${num(status, "processesPassed") || (passed ? num(status, "processes") : 0)}/${num(status, "processes")}`], ["업무 단계", `${num(status, "stepsPassed") || (passed ? num(status, "steps") : 0)}/${num(status, "steps")}`], ["실행 게이트", `${num(status, "gatesPassed") || (passed ? num(status, "gates") : 0)}/${num(status, "gates")}`], ["최종 판정", text(status, "status")]].map(([label, value]) => <article key={label} className={`rounded-xl border p-4 ${passed ? "border-emerald-200 bg-emerald-50" : "bg-slate-50"}`}><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-xl text-[#052b57]">{value}</strong></article>)}</div>
    {yes(status.videoAvailable) && <video className="mt-4 w-full max-w-4xl rounded-xl border bg-slate-950" controls preload="metadata" src={`${endpoint}/video?v=${num(status, "durationMs")}`} />}
    {processList.length > 0 && <div className="mt-4 max-h-64 overflow-auto rounded-xl border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr>{["순서", "프로세스", "책임 액터", "단계", "화면", "권한"].map(value => <th key={value} className="p-3 font-black">{value}</th>)}</tr></thead><tbody>{processList.map(row => <tr key={text(row, "processCode")} className="border-t"><td className="p-3">{text(row, "order")}</td><td className="p-3"><strong>{text(row, "processName")}</strong><span className="block text-slate-500">{text(row, "processCode")}</span></td><td className="p-3">{text(row, "ownerActorCode")}</td><td className="p-3">{text(row, "stepCount")}</td><td className="p-3">{text(row, "screenCount")}</td><td className="p-3">{text(row, "permissionCount")}</td></tr>)}</tbody></table></div>}
  </section>;
}

function WorkflowReplayConsole({ capsule }: { capsule: Row }) {
  const steps = rows(capsule.steps).sort((a, b) => num(a, "stepOrder") - num(b, "stepOrder"));
  const screens = rows(capsule.screens);
  const accounts = rows(capsule.accounts);
  const permissions = rows(capsule.permissions);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2500);
  const [e2eRunning, setE2eRunning] = useState(false);
  const [e2eStatus, setE2eStatus] = useState("");
  useEffect(() => { setActiveIndex(0); setPlaying(false); }, [capsule.capsuleCode]);
  useEffect(() => {
    if (!playing || steps.length < 2) return;
    const timer = window.setInterval(() => setActiveIndex(index => {
      if (index >= steps.length - 1) { setPlaying(false); return index; }
      return index + 1;
    }), speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, steps.length]);
  const step = steps[Math.min(activeIndex, Math.max(steps.length - 1, 0))] || {};
  const actorCode = text(step, "actorCode");
  const screen = screens.find(row => text(row, "stepCode") === text(step, "stepCode") && text(row, "actorCode") === actorCode && !/signin\/loginView/i.test(text(row, "routePath")))
    || screens.find(row => text(row, "stepCode") === text(step, "stepCode")) || {};
  const account = accounts.find(row => text(row, "actorCode") === actorCode && ["ACTIVE", "PRE_ACCOUNT_CONTEXT"].includes(text(row, "assignmentStatus"))) || {};
  const stepPermissions = permissions.filter(row => text(row, "stepCode") === text(step, "stepCode"));
  const functions = values(screen.apiContract);
  const routePath = text(screen, "routePath");
  const evidenceReady = Boolean(routePath && actorCode && text(account, "accountId") && functions.length && stepPermissions.length && stepPermissions.every(row => yes(row.covered)));
  const next = () => setActiveIndex(index => Math.min(index + 1, Math.max(steps.length - 1, 0)));
  const runActualE2e = async () => {
    if (e2eRunning || text(capsule, "capsuleCode") !== "MEMBER_REGISTRATION_CAPSULE") return;
    setE2eRunning(true); setE2eStatus("RUNNING"); setPlaying(false); setActiveIndex(0);
    try {
      const query = new URLSearchParams({ capsuleCode: text(capsule, "capsuleCode") });
      const start = await fetch(`/api/internal/actor-process/business-capsule-ledger/execute-e2e?${query}`, { method: "POST", credentials: "include" });
      const started = await start.json().catch(() => ({}));
      if (!start.ok) throw new Error(started.message || `실제 E2E 시작 실패 (${start.status})`);
      const operationId = String(started.operationId || "");
      let finalStatus = "RUNNING";
      for (let attempt = 0; attempt < 100 && finalStatus === "RUNNING"; attempt += 1) {
        await new Promise(resolve => window.setTimeout(resolve, 2000));
        const response = await fetch(`/api/internal/actor-process/business-capsule-ledger?workTypeCode=MEMBER`, { credentials: "include" });
        const body = await response.json().catch(() => ({}));
        const current = rows(body.capsules).find(row => text(row, "capsuleCode") === text(capsule, "capsuleCode"));
        const operation = rows(current?.operations).find(row => text(row, "operationId") === operationId);
        finalStatus = text(operation || {}, "operationStatus") || "RUNNING";
      }
      setE2eStatus(finalStatus);
      if (finalStatus === "PASSED") { setActiveIndex(0); setPlaying(true); }
      else if (finalStatus === "RUNNING") setE2eStatus("TIMEOUT");
    } catch (reason) {
      setE2eStatus(reason instanceof Error ? `FAILED: ${reason.message}` : "FAILED");
    } finally { setE2eRunning(false); }
  };
  return <section className="overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-sm" data-workflow-replay-console="v1">
    <div className="flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-cyan-50 to-blue-50 p-5"><div><p className="text-xs font-black tracking-[.12em] text-cyan-800">VISIBLE ACCOUNT RELAY</p><h3 className="mt-1 text-lg font-black text-[#052b57]">업무 자동 재생</h3><p className="mt-1 text-xs text-slate-600">계정 전환부터 화면·기능·입력·출력·권한·다음 담당자까지 원장 순서대로 확인합니다.</p></div><strong className="rounded-full bg-white px-4 py-2 text-sm text-[#052b57] shadow-sm">{Math.min(activeIndex + 1, steps.length)}/{steps.length} 단계</strong></div>
    <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4"><div className="flex flex-wrap gap-2">{steps.map((row, index) => <button key={text(row, "stepCode")} type="button" onClick={() => { setPlaying(false); setActiveIndex(index); }} className={`min-h-11 flex-1 rounded-xl border px-3 py-2 text-left text-xs font-black ${index === activeIndex ? "border-blue-600 bg-blue-600 text-white" : index < activeIndex ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-600"}`}><span className="block opacity-75">{index + 1}단계 · {text(row, "actorCode")}</span>{text(row, "stepName")}</button>)}</div>
        <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-100"><div className="flex items-center justify-between border-b bg-slate-900 px-4 py-3 text-white"><strong className="text-sm">실제 화면 경로</strong>{routePath ? <a className="rounded-lg bg-white px-3 py-2 text-xs font-black text-blue-900" href={routePath} target="_blank" rel="noreferrer">새 창에서 열기</a> : <span className="text-xs text-amber-200">화면 미배정</span>}</div>{routePath ? <iframe key={`${text(capsule, "capsuleCode")}-${activeIndex}-${routePath}`} title={`${text(step, "stepName")} 실제 화면`} src={routePath} className="h-[460px] w-full bg-white" /> : <div className="flex h-[240px] items-center justify-center font-bold text-slate-500">연결 화면이 없습니다.</div>}</div>
      </div>
      <aside className="space-y-3"><article className={`rounded-xl border p-4 ${evidenceReady ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}><span className="text-xs font-black">현재 판정</span><strong className="mt-1 block text-lg text-[#052b57]">{evidenceReady ? "실행 증거 READY" : "설계 보완 필요"}</strong><p className="mt-1 text-xs">{text(step, "fromState") || "시작"} → {text(step, "toState") || "완료"}</p></article>
        {[["사용자계정", text(account, "accountId") || "배정 필요"], ["액터", actorCode || "누락"], ["화면", text(screen, "screenName") || "누락"], ["경로", routePath || "누락"], ["기능", functions.join(" · ") || "누락"], ["권한", stepPermissions.map(row => `${text(row, "permissionCode")}:${yes(row.covered) ? "OK" : "MISSING"}`).join(" · ") || "누락"], ["입력", text(step, "inputContract") || text(step, "fromState") || "원장 상태"], ["출력", text(step, "outputContract") || text(step, "toState") || "완료 상태"], ["완료 조건", text(step, "completionRule") || "누락"], ["다음 담당", activeIndex < steps.length - 1 ? text(steps[activeIndex + 1], "actorCode") : "프로세스 종료"]].map(([label, value]) => <article key={label} className="rounded-xl border bg-slate-50 p-3 text-xs"><span className="font-bold text-slate-500">{label}</span><strong className="mt-1 block break-all text-slate-800">{value}</strong></article>)}
      </aside>
    </div>
    <div className="flex flex-wrap items-center gap-2 border-t bg-slate-50 p-4"><button type="button" onClick={() => void runActualE2e()} disabled={e2eRunning || text(capsule, "capsuleCode") !== "MEMBER_REGISTRATION_CAPSULE"} className="min-h-11 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">{e2eRunning ? "실제 회원가입 검증 중…" : "실제 검증 후 자동 재생"}</button><button type="button" onClick={() => setPlaying(value => !value)} disabled={!steps.length || e2eRunning} className="min-h-11 rounded-xl bg-[#052b57] px-5 py-3 text-sm font-black text-white disabled:opacity-40">{playing ? "일시정지" : activeIndex >= steps.length - 1 ? "현재 단계 보기" : "증거만 재생"}</button><button type="button" onClick={next} disabled={activeIndex >= steps.length - 1 || e2eRunning} className="min-h-11 rounded-xl border border-blue-500 bg-white px-5 py-3 text-sm font-black text-blue-900 disabled:opacity-40">다음 단계</button><button type="button" onClick={() => { setPlaying(false); setActiveIndex(0); }} className="min-h-11 rounded-xl border px-5 py-3 text-sm font-black">처음부터</button>{e2eStatus && <strong data-visible-e2e-status={e2eStatus.startsWith("FAILED") ? "FAILED" : e2eStatus} className={`rounded-lg px-3 py-2 text-xs ${e2eStatus === "PASSED" ? "bg-emerald-100 text-emerald-900" : e2eStatus === "RUNNING" ? "bg-blue-100 text-blue-900" : "bg-red-100 text-red-900"}`}>실제 E2E: {e2eStatus}</strong>}<label className="ml-auto text-xs font-black text-slate-600">재생 속도<select value={speed} onChange={event => setSpeed(Number(event.target.value))} className="ml-2 min-h-11 rounded-xl border bg-white px-3"><option value={4000}>느리게</option><option value={2500}>보통</option><option value={1200}>빠르게</option></select></label></div>
  </section>;
}

function ExecutionRelationSelector({ capsules, capsule, onProcessChange }: { capsules: Row[]; capsule: Row; onProcessChange: (code: string) => void }) {
  const steps = rows(capsule.steps);
  const screens = rows(capsule.screens);
  const accounts = rows(capsule.accounts);
  const permissions = rows(capsule.permissions);
  const [stepCode, setStepCode] = useState("");
  const [routePath, setRoutePath] = useState("");
  const [actorCode, setActorCode] = useState("");
  const [accountId, setAccountId] = useState("");
  const [functionCode, setFunctionCode] = useState("");
  const [permissionCode, setPermissionCode] = useState("");
  const [relayRunning, setRelayRunning] = useState(false);
  const [relayResult, setRelayResult] = useState<Row | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResults, setBatchResults] = useState<Row[]>([]);
  useEffect(() => { setStepCode(""); setRoutePath(""); setActorCode(""); setAccountId(""); setFunctionCode(""); setPermissionCode(""); setRelayResult(null); setBatchResults([]); }, [capsule.capsuleCode]);
  const selectedStep = steps.find(row => text(row, "stepCode") === stepCode);
  const screenOptions = stepCode ? screens.filter(row => text(row, "stepCode") === stepCode) : screens;
  const selectedScreen = screenOptions.find(row => text(row, "routePath") === routePath);
  const actorOptions = [...new Set([...(selectedStep ? [text(selectedStep, "actorCode")] : steps.map(row => text(row, "actorCode"))), ...screenOptions.map(row => text(row, "actorCode"))].filter(Boolean))];
  const assignedAccounts = actorCode ? accounts.filter(row => text(row, "actorCode") === actorCode) : accounts;
  const accountOptions = assignedAccounts.length || !actorCode ? assignedAccounts : [{ accountId: `UNASSIGNED::${actorCode}`, actorCode, tenantId: "-", projectId: "-", assignmentStatus: "MISSING_ASSIGNMENT" }];
  const functionOptions = selectedScreen ? values(selectedScreen.apiContract) : [...new Set(screenOptions.flatMap(row => values(row.apiContract)))];
  const permissionOptions = stepCode ? permissions.filter(row => text(row, "stepCode") === stepCode) : permissions;
  const workTypes = [...new Set(capsules.map(row => text(row, "workTypeCode")).filter(Boolean))];
  const covered = permissionOptions.find(row => text(row, "permissionCode") === permissionCode);
  const selectedAccount = accountOptions.find(row => text(row, "accountId") === accountId);
  const complete = Boolean(stepCode && routePath && actorCode && accountId && functionCode && permissionCode);
  const accountReady = ["ACTIVE", "PRE_ACCOUNT_CONTEXT"].includes(text(selectedAccount || {}, "assignmentStatus"));
  const compatible = complete && text(selectedStep || {}, "actorCode") === actorCode && text(selectedScreen || {}, "actorCode") === actorCode && accountReady && yes(covered?.covered);
  const selectClass = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800";
  const resetAfterStep = (value: string) => { setStepCode(value); setRoutePath(""); setActorCode(""); setAccountId(""); setFunctionCode(""); setPermissionCode(""); };
  const resetAfterScreen = (value: string) => { setRoutePath(value); setActorCode(""); setAccountId(""); setFunctionCode(""); setPermissionCode(""); };
  const runRelayTest = async () => {
    if (!compatible || relayRunning) return;
    setRelayRunning(true); setRelayResult(null);
    try {
      const query = new URLSearchParams({ workTypeCode: text(capsule, "workTypeCode") });
      const response = await fetch(`/api/internal/actor-process/business-capsule-ledger?${query}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `릴레이 테스트 실패 (${response.status})`);
      const liveCapsule = rows(body.capsules).find(row => text(row, "capsuleCode") === text(capsule, "capsuleCode"));
      const liveStep = rows(liveCapsule?.steps).find(row => text(row, "stepCode") === stepCode && text(row, "actorCode") === actorCode);
      const liveScreen = rows(liveCapsule?.screens).find(row => text(row, "stepCode") === stepCode && text(row, "routePath") === routePath && text(row, "actorCode") === actorCode);
      const liveAccount = rows(liveCapsule?.accounts).find(row => text(row, "actorCode") === actorCode && text(row, "accountId") === accountId && ["ACTIVE", "PRE_ACCOUNT_CONTEXT"].includes(text(row, "assignmentStatus")));
      const livePermission = rows(liveCapsule?.permissions).find(row => text(row, "stepCode") === stepCode && text(row, "permissionCode") === permissionCode && yes(row.covered));
      const liveFunction = values(liveScreen?.apiContract).includes(functionCode);
      if (!liveStep || !liveScreen || !liveAccount || !livePermission || !liveFunction) throw new Error("최신 원장의 계정·액터·화면·기능·권한 관계가 일치하지 않습니다.");
      setRelayResult({ status: "PASSED", testedAt: new Date().toLocaleString("ko-KR"), stepCode, routePath, actorCode, accountId, functionCode, permissionCode });
    } catch (reason) {
      setRelayResult({ status: "FAILED", message: reason instanceof Error ? reason.message : "릴레이 테스트 실패" });
    } finally { setRelayRunning(false); }
  };
  const runAllRelayTests = async () => {
    if (batchRunning) return;
    setBatchRunning(true); setBatchResults([]);
    try {
      const query = new URLSearchParams({ workTypeCode: text(capsule, "workTypeCode") });
      const response = await fetch(`/api/internal/actor-process/business-capsule-ledger?${query}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `전체 릴레이 테스트 실패 (${response.status})`);
      const results = rows(body.capsules).flatMap(liveCapsule => rows(liveCapsule.steps).map(liveStep => {
        const liveStepCode = text(liveStep, "stepCode");
        const liveActorCode = text(liveStep, "actorCode");
        const liveScreen = rows(liveCapsule.screens).find(row => text(row, "stepCode") === liveStepCode && text(row, "actorCode") === liveActorCode && !/signin\/loginView/i.test(text(row, "routePath")));
        const preferredAccountByActor: Record<string, string> = { PUBLIC_APPLICANT: "ANONYMOUS_SIGNUP_SESSION", MEMBER_ADMIN: "webmaster", VERIFIER: "qaverify26", APPROVER: "qaapprove26" };
        const accountCandidates = rows(liveCapsule.accounts).filter(row => text(row, "actorCode") === liveActorCode && ["ACTIVE", "PRE_ACCOUNT_CONTEXT"].includes(text(row, "assignmentStatus")));
        const liveAccount = accountCandidates.find(row => text(row, "accountId") === preferredAccountByActor[liveActorCode]) || accountCandidates[0];
        const livePermissions = rows(liveCapsule.permissions).filter(row => text(row, "stepCode") === liveStepCode);
        const liveFunctions = values(liveScreen?.apiContract);
        const passed = Boolean(liveScreen && liveAccount && liveFunctions.length && livePermissions.length && livePermissions.every(row => yes(row.covered)));
        return { capsuleCode: text(liveCapsule, "capsuleCode"), stepOrder: text(liveStep, "stepOrder"), stepCode: liveStepCode, stepName: text(liveStep, "stepName"), actorCode: liveActorCode, accountId: text(liveAccount || {}, "accountId") || "배정 필요", routePath: text(liveScreen || {}, "routePath") || "화면 누락", functionCount: liveFunctions.length, permissionCount: livePermissions.length, status: passed ? "PASS" : "FAIL" };
      }));
      setBatchResults(results);
    } catch (reason) {
      setBatchResults([{ stepCode: "BATCH", stepName: reason instanceof Error ? reason.message : "전체 릴레이 테스트 실패", status: "FAIL" }]);
    } finally { setBatchRunning(false); }
  };
  return <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm" data-execution-relation-selector="v1">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black tracking-[.12em] text-indigo-700">EXECUTION RELATION LEDGER</p><h3 className="mt-1 font-black text-[#052b57]">업무 실행 관계 8단계 선택</h3><p className="mt-1 text-xs text-slate-600">앞 항목을 선택하면 실제 원장 관계에 맞는 다음 후보만 표시합니다.</p></div><span className={`rounded-full px-3 py-2 text-xs font-black ${compatible ? "bg-emerald-100 text-emerald-800" : complete ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>{compatible ? "실행 조합 OK" : complete ? "관계 불일치" : "선택 진행 중"}</span></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ChainSelect no="1" label="업무 종류" value={text(capsule, "workTypeCode")} options={workTypes.map(value => [value, value])} onChange={value => { const target = capsules.find(row => text(row, "workTypeCode") === value); if (target) onProcessChange(text(target, "capsuleCode")); }} className={selectClass} />
      <ChainSelect no="2" label="업무 프로세스" value={text(capsule, "capsuleCode")} options={capsules.filter(row => text(row, "workTypeCode") === text(capsule, "workTypeCode")).map(row => [text(row, "capsuleCode"), text(row, "processName")])} onChange={onProcessChange} className={selectClass} />
      <ChainSelect no="3" label="업무" value={stepCode} options={steps.map(row => [text(row, "stepCode"), `${text(row, "stepOrder")}. ${text(row, "stepName")}`])} onChange={resetAfterStep} className={selectClass} />
      <ChainSelect no="4" label="화면" value={routePath} options={screenOptions.map(row => [text(row, "routePath"), `${text(row, "screenName")} · ${text(row, "audience")}`])} onChange={resetAfterScreen} className={selectClass} />
      <ChainSelect no="5" label="액터" value={actorCode} options={actorOptions.map(value => [value, value])} onChange={value => { setActorCode(value); setAccountId(""); setPermissionCode(""); }} className={selectClass} />
      <ChainSelect no="6" label="사용자계정" value={accountId} options={accountOptions.map(row => [text(row, "accountId"), `${text(row, "accountId")} · ${text(row, "assignmentStatus") === "MISSING_ASSIGNMENT" ? "배정 필요" : text(row, "assignmentStatus")}`])} onChange={setAccountId} className={selectClass} />
      <ChainSelect no="7" label="기능" value={functionCode} options={functionOptions.map(value => [value, value])} onChange={setFunctionCode} className={selectClass} />
      <ChainSelect no="8" label="권한" value={permissionCode} options={permissionOptions.map(row => [text(row, "permissionCode"), `${text(row, "permissionCode")} · ${yes(row.covered) ? "보유" : "누락"}`])} onChange={setPermissionCode} className={selectClass} />
    </div>
    <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">{[["화면 경로", routePath || "-"], ["액터 계정", actorCode && accountId ? `${actorCode} → ${accountId} · ${accountReady ? "READY" : "배정 필요"}` : "-"], ["기능", functionCode || "-"], ["권한 판정", permissionCode ? `${permissionCode} · ${yes(covered?.covered) ? "COVERED" : "MISSING"}` : "-"]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><span className="font-bold text-slate-500">{label}</span><strong className="mt-1 block break-all text-slate-800">{value}</strong></div>)}</div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void runRelayTest()} disabled={!compatible || relayRunning || batchRunning} className="min-h-11 rounded-xl bg-[#052b57] px-5 py-3 text-sm font-black text-white enabled:hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">{relayRunning ? "계정 릴레이 검증 중…" : "선택 조합 테스트 실행"}</button><button type="button" onClick={() => void runAllRelayTests()} disabled={relayRunning || batchRunning} className="min-h-11 rounded-xl border border-blue-600 bg-blue-50 px-5 py-3 text-sm font-black text-blue-900 enabled:hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">{batchRunning ? "전체 릴레이 검증 중…" : "전체 릴레이 테스트 실행"}</button><p className="text-xs font-bold text-slate-500">선택 조합 또는 현재 업무 종류의 전체 단계를 최신 원장으로 검증합니다.</p></div>
    {relayResult && <div data-relay-test-result={text(relayResult, "status")} className={`mt-4 rounded-xl border p-4 text-sm ${text(relayResult, "status") === "PASSED" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-800"}`}><strong className="font-black">{text(relayResult, "status") === "PASSED" ? "계정 릴레이 테스트 PASS" : "계정 릴레이 테스트 FAIL"}</strong>{text(relayResult, "status") === "PASSED" ? <p className="mt-2 break-all text-xs font-bold">{text(relayResult, "stepCode")} · {text(relayResult, "actorCode")} → {text(relayResult, "accountId")} · {text(relayResult, "routePath")} · {text(relayResult, "permissionCode")} · {text(relayResult, "testedAt")}</p> : <p className="mt-2 text-xs font-bold">{text(relayResult, "message")}</p>}</div>}
    {batchResults.length > 0 && <div data-relay-batch-result={batchResults.every(row => text(row, "status") === "PASS") ? "PASSED" : "FAILED"} className="mt-4 overflow-hidden rounded-xl border"><div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${batchResults.every(row => text(row, "status") === "PASS") ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}><strong className="font-black">전체 계정 릴레이 {batchResults.filter(row => text(row, "status") === "PASS").length}/{batchResults.length} PASS</strong><span className="text-xs font-bold">업무 종류 {text(capsule, "workTypeCode")}</span></div><div className="max-h-[360px] overflow-auto"><table className="w-full min-w-[920px] text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr>{["프로세스·업무", "액터", "사용자계정", "화면", "기능", "권한", "판정"].map(head => <th className="px-3 py-3 font-black text-slate-600" key={head}>{head}</th>)}</tr></thead><tbody>{batchResults.map((row, index) => <tr className="border-t" key={`${text(row, "capsuleCode")}-${text(row, "stepCode")}-${index}`}><td className="px-3 py-3"><strong className="block text-[#052b57]">{text(row, "stepOrder")}. {text(row, "stepName")}</strong><span className="text-slate-500">{text(row, "stepCode")}</span></td><td className="px-3 py-3 font-bold">{text(row, "actorCode")}</td><td className="px-3 py-3">{text(row, "accountId")}</td><td className="px-3 py-3 break-all">{text(row, "routePath")}</td><td className="px-3 py-3">{text(row, "functionCount")}개</td><td className="px-3 py-3">{text(row, "permissionCount")}개</td><td className={`px-3 py-3 font-black ${text(row, "status") === "PASS" ? "text-emerald-700" : "text-red-700"}`}>{text(row, "status")}</td></tr>)}</tbody></table></div></div>}
  </section>;
}

function ChainSelect({ no, label, value, options, onChange, className }: { no: string; label: string; value: string; options: string[][]; onChange: (value: string) => void; className: string }) {
  return <label className="rounded-xl border bg-slate-50 p-3 text-xs font-black text-slate-600"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-800">{no}</span>{label}<select className={className} value={value} onChange={event => onChange(event.target.value)}><option value="">선택하세요 ({options.length})</option>{options.map(([optionValue, optionLabel], index) => <option key={`${optionValue}-${index}`} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function LedgerTable({ title, heads, rows }: { title: string; heads: string[]; rows: string[][] }) {
  return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-5 py-4"><h3 className="font-black text-[#052b57]">{title}</h3></div><div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr>{heads.map(head => <th key={head} className="px-4 py-3 font-black text-slate-600">{head}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t align-top">{row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-pre-line break-words px-4 py-3 text-slate-700">{cell}</td>)}</tr>)}</tbody></table></div></section>;
}
