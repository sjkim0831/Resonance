import { useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Props = { base: string; processes: Row[] };
const value = (row: Row, key: string) => String(row[key] ?? "");
const fieldClass = "mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-[#246beb] focus:outline-none focus:ring-2 focus:ring-blue-100";

export function ScreenWorkflowTestPanel({ base, processes }: Props) {
  const workTypes = useMemo(() => Array.from(new Set(processes.map(row => value(row, "domainCode")).filter(Boolean))).sort(), [processes]);
  const [workTypeCode, setWorkTypeCode] = useState("");
  const [processCode, setProcessCode] = useState("");
  const [screens, setScreens] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row>();
  const [detail, setDetail] = useState<Row>();
  const [stepCode, setStepCode] = useState("");
  const [capabilityCode, setCapabilityCode] = useState("");
  const [result, setResult] = useState<Row>();
  const [testCases, setTestCases] = useState<Row[]>([]);
  const [testCaseId, setTestCaseId] = useState("");
  const [caseName, setCaseName] = useState("기본 정상 처리");
  const [preInputs, setPreInputs] = useState<Record<string, string>>({});
  const [previewVisible, setPreviewVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [caseType, setCaseType] = useState("HAPPY_PATH");
  const [expectedResult, setExpectedResult] = useState("PASSED");
  const [expectedState, setExpectedState] = useState("");
  const [caseDescription, setCaseDescription] = useState("");
  const [expectedOutputJson, setExpectedOutputJson] = useState("{}");
  const [error, setError] = useState("");

  const filteredProcesses = useMemo(() => processes.filter(row => !workTypeCode || value(row, "domainCode") === workTypeCode), [processes, workTypeCode]);
  useEffect(() => {
    if (!workTypeCode && workTypes.length) setWorkTypeCode(workTypes[0]);
  }, [workTypeCode, workTypes]);
  useEffect(() => {
    if (!filteredProcesses.some(row => value(row, "processCode") === processCode)) setProcessCode(value(filteredProcesses[0] ?? {}, "processCode"));
  }, [filteredProcesses, processCode]);

  const loadScreens = useCallback(async () => {
    if (!processCode) return;
    setBusy(true); setError(""); setSelected(undefined); setDetail(undefined); setResult(undefined); setStepCode(""); setCapabilityCode("");
    try {
      const response = await fetch(`${base}/page-development-master?processCode=${encodeURIComponent(processCode)}`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "화면 목록을 불러오지 못했습니다.");
      setScreens(Array.isArray(body.items) ? body.items : []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }, [base, processCode]);
  useEffect(() => { void loadScreens(); }, [loadScreens]);

  async function selectScreen(row: Row) {
    setBusy(true); setError(""); setSelected(row); setDetail(undefined); setResult(undefined); setTestCaseId(""); setTestCases([]); setStepCode(""); setCapabilityCode("");
    try {
      const response = await fetch(`${base}/page-development-master/${value(row, "itemId")}`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "화면 계약을 불러오지 못했습니다.");
      setDetail(body);
      const scopedBindings = (Array.isArray(body.bindings) ? body.bindings as Row[] : []).filter(binding => value(binding, "processCode") === processCode);
      setStepCode(value(scopedBindings[0] ?? {}, "stepCode"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  const bindings = useMemo(() => (Array.isArray(detail?.bindings) ? detail.bindings as Row[] : []).filter(row => value(row, "processCode") === processCode), [detail, processCode]);
  const steps = useMemo(() => Array.from(new Map(bindings.map(row => [value(row, "stepCode"), row])).values()), [bindings]);
  const selectedBinding = useMemo(() => bindings.find(row => value(row, "stepCode") === stepCode), [bindings, stepCode]);
  const allCapabilities = useMemo(() => Array.isArray(detail?.capabilities) ? detail.capabilities as Row[] : [], [detail]);
  const capabilities = useMemo(() => allCapabilities.filter(row => capabilityMatches(selectedBinding, row)), [allCapabilities, selectedBinding]);

  useEffect(() => {
    if (!steps.some(row => value(row, "stepCode") === stepCode)) setStepCode(value(steps[0] ?? {}, "stepCode"));
  }, [stepCode, steps]);
  useEffect(() => {
    if (!capabilities.some(row => value(row, "capabilityCode") === capabilityCode)) setCapabilityCode(value(capabilities[0] ?? {}, "capabilityCode"));
  }, [capabilities, capabilityCode]);

  const allFields = useMemo(() => Array.isArray(detail?.fields) ? detail.fields as Row[] : [], [detail]);
  const stepFields = useMemo(() => {
    const scoped = (Array.isArray(detail?.stepFields) ? detail.stepFields as Row[] : []).filter(row => value(row, "processCode") === processCode && value(row, "stepCode") === stepCode);
    const source = scoped.length ? scoped : allFields;
    return Array.from(new Map(source.map(field => [value(field, "fieldCode"), field])).values());
  }, [allFields, detail, processCode, stepCode]);

  useEffect(() => {
    setPreInputs(current => Object.fromEntries(stepFields.map(field => [value(field, "fieldCode"), current[value(field, "fieldCode")] ?? ""])));
    setTestCaseId(""); setTestCases([]); setResult(undefined);
  }, [stepFields, capabilityCode]);

  const loadTestCases = useCallback(async () => {
    if (!selected || !selectedBinding || !capabilityCode) return;
    const response = await fetch(`${base}/screen-workflow-test-cases?screenResourceId=${Number(selected.screenResourceId)}&processCode=${encodeURIComponent(processCode)}&stepCode=${encodeURIComponent(stepCode)}&capabilityCode=${encodeURIComponent(capabilityCode)}`, { credentials: "include" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "저장 테스트 케이스를 불러오지 못했습니다.");
    setTestCases(Array.isArray(body.items) ? body.items : []);
  }, [base, capabilityCode, processCode, selected, selectedBinding, stepCode]);
  useEffect(() => { void loadTestCases().catch(reason => setError(reason instanceof Error ? reason.message : String(reason))); }, [loadTestCases]);

  async function saveTestCase() {
    if (!selected || !selectedBinding || !capabilityCode) { setError("화면·절차·기능을 모두 선택하세요."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`${base}/screen-workflow-test-cases`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ screenResourceId: Number(selected.screenResourceId), processCode, stepCode, capabilityCode, caseType, caseName, caseDescription, preInputJson: JSON.stringify(preInputs), expectedOutputJson, actionSequenceJson: "[]", expectedResult, expectedState }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "테스트 케이스 저장에 실패했습니다.");
      setTestCaseId(String(body.testCaseId)); await loadTestCases();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  function applyTestCase(id: string) {
    setTestCaseId(id);
    const item = testCases.find(row => value(row, "testCaseId") === id);
    if (!item) return;
    setCaseName(value(item, "caseName"));
    setCaseType(value(item, "caseType") || "HAPPY_PATH");
    setExpectedResult(value(item, "expectedResult") || "PASSED");
    setExpectedState(value(item, "expectedState"));
    setCaseDescription(value(item, "caseDescription"));
    setExpectedOutputJson(value(item, "expectedOutputJson") || "{}");
    try { setPreInputs(JSON.parse(value(item, "preInputJson"))); }
    catch { setError("저장된 선입력 JSON 형식이 올바르지 않습니다."); }
  }

  async function runTest() {
    if (!selected || !selectedBinding || !capabilityCode) { setError("화면·절차·기능을 모두 선택하세요."); return; }
    setBusy(true); setError("");
    try {
      if (previewVisible) { setPreviewVisible(false); await new Promise(resolve => window.setTimeout(resolve, 150)); }
      const response = await fetch(`${base}/screen-workflow-test`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: Number(selected.itemId), processCode, stepCode, capabilityCode, testCaseId: testCaseId || undefined, preInputJson: JSON.stringify(preInputs) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "결정론적 테스트에 실패했습니다.");
      setResult(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  const tests = useMemo(() => (Array.isArray(detail?.tests) ? detail.tests as Row[] : []).filter(row => value(row, "processCode") === processCode && value(row, "stepCode") === stepCode), [detail, processCode, stepCode]);
  const checks = Array.isArray(result?.checks) ? result.checks as Row[] : [];
  const selectedCapability = capabilities.find(row => value(row, "capabilityCode") === capabilityCode);
  const previewPath = selected ? `${value(selected, "routePath")}${value(selected, "routePath").includes("?") ? "&" : "?"}step=${stepCode.toLowerCase()}` : "";

  return <div className="space-y-5">
    <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-5">
      <p className="text-xs font-black tracking-[0.12em] text-blue-700">AI-INDEPENDENT SCREEN TEST WORKBENCH</p>
      <h2 className="mt-1 text-2xl font-black text-[#052b57]">업무부터 기능 데이터셋까지 선택하는 화면 테스트</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">업무 종류 → 프로세스 → 화면 → 절차 → 기능 순서로 범위를 좁히고, 해당 절차의 필드 계약만 선입력하여 실제 화면을 미리 보고 테스트 증적을 저장합니다.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SelectField label="1. 업무 종류" value={workTypeCode} onChange={setWorkTypeCode} options={workTypes.map(code => ({ value: code, label: code }))}/>
        <SelectField label="2. 프로세스" value={processCode} onChange={setProcessCode} options={filteredProcesses.map(row => ({ value: value(row, "processCode"), label: value(row, "processName") }))}/>
        <SelectField label="3. 화면" value={value(selected ?? {}, "itemId")} onChange={id => { const row = screens.find(item => value(item, "itemId") === id); if (row) void selectScreen(row); }} placeholder="화면 선택" options={screens.map(row => ({ value: value(row, "itemId"), label: value(row, "screenName") }))}/>
        <SelectField label="4. 절차" value={stepCode} onChange={setStepCode} placeholder="절차 선택" options={steps.map(row => ({ value: value(row, "stepCode"), label: `${value(row, "stepOrder")}. ${value(row, "stepName")}` }))}/>
        <SelectField label="5. 기능" value={capabilityCode} onChange={setCapabilityCode} placeholder="기능 선택" options={capabilities.map(row => ({ value: value(row, "capabilityCode"), label: value(row, "capabilityName") }))}/>
      </div>
    </section>

    {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
    {!detail && <section className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">상단에서 화면을 선택하면 절차·기능·데이터셋·미리보기가 표시됩니다.</section>}
    {detail && <>
      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div><h3 className="text-xl font-black text-[#052b57]">{value(selected ?? {}, "screenName")}</h3><a className="mt-1 block text-sm font-bold text-blue-700 hover:underline" href={previewPath} target="_blank" rel="noreferrer">{previewPath}</a><p className="mt-2 text-sm text-slate-600"><b>{value(selectedBinding ?? {}, "stepName")}</b> · {value(selectedCapability ?? {}, "capabilityName")}</p></div>
          <div className="flex flex-wrap gap-2"><ScreenMoveButton disabled={!selected || screens.findIndex(row => value(row, "itemId") === value(selected, "itemId")) <= 0} label="이전 화면" onClick={() => moveScreen(-1)}/><ScreenMoveButton disabled={!selected || screens.findIndex(row => value(row, "itemId") === value(selected, "itemId")) >= screens.length - 1} label="다음 화면" onClick={() => moveScreen(1)}/><button className="min-h-11 rounded-lg border border-blue-300 bg-white px-4 text-sm font-bold text-blue-700" onClick={() => setPreviewVisible(current => !current)} type="button">{previewVisible ? "미리보기 닫기" : "미리보기 열기"}</button><button className="min-h-11 rounded-lg bg-[#246beb] px-5 text-sm font-black text-white disabled:opacity-50" disabled={busy || !capabilityCode} onClick={() => void runTest()} type="button">{busy ? "검사 중" : "선택 기능 테스트"}</button></div>
        </div>
      </section>

      {previewVisible && <section className="overflow-hidden rounded-2xl border bg-white"><div className="flex items-center justify-between border-b px-5 py-3"><strong className="text-[#052b57]">실제 화면 미리보기</strong><span className="text-xs text-slate-500">동일 로그인 세션 · 선택 절차 반영</span></div><iframe className="h-[520px] w-full bg-white" key={previewPath} src={previewPath} title={`${value(selected ?? {}, "screenName")} 미리보기`}/></section>}

      <MetricGrid values={[["절차", steps.length], ["선택 기능", capabilities.length], ["기능 데이터 필드", stepFields.length], ["안전 테스트", tests.length]]}/>
      <section className="rounded-2xl border bg-white p-5">
        <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1.5fr_auto] lg:items-end"><label className="text-sm font-bold text-slate-700">저장 테스트 데이터셋<select className={fieldClass} value={testCaseId} onChange={event => applyTestCase(event.target.value)}><option value="">새 테스트 데이터셋</option>{testCases.map(row => <option key={value(row, "testCaseId")} value={value(row, "testCaseId")}>{value(row, "caseType")} · {value(row, "caseName")}</option>)}</select></label><label className="text-sm font-bold text-slate-700">경우의 수<select className={fieldClass} value={caseType} onChange={event => { setCaseType(event.target.value); setExpectedResult(event.target.value === "HAPPY_PATH" ? "PASSED" : "BLOCKED"); }}>{["HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY"].map(type => <option key={type}>{type}</option>)}</select></label><label className="text-sm font-bold text-slate-700">케이스명<input className={fieldClass} value={caseName} onChange={event => setCaseName(event.target.value)}/></label><button className="min-h-11 rounded-lg bg-slate-800 px-5 text-sm font-black text-white disabled:opacity-50" disabled={busy || !caseName.trim() || !capabilityCode} onClick={() => void saveTestCase()} type="button">데이터셋 저장·수정</button></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3"><label className="text-sm font-bold text-slate-700">기대 판정<select className={fieldClass} value={expectedResult} onChange={event => setExpectedResult(event.target.value)}><option>PASSED</option><option>BLOCKED</option></select></label><label className="text-sm font-bold text-slate-700">기대 상태<input className={fieldClass} value={expectedState} onChange={event => setExpectedState(event.target.value)} placeholder="완료 후 상태"/></label><label className="text-sm font-bold text-slate-700">기대 출력 JSON<input className={`${fieldClass} font-mono`} value={expectedOutputJson} onChange={event => setExpectedOutputJson(event.target.value)} /></label></div>
        <label className="mt-4 block text-sm font-bold text-slate-700">테스트 목적·중단 조건<textarea className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm" value={caseDescription} onChange={event => setCaseDescription(event.target.value)} placeholder="이 경우의 수가 검증할 기능, 중단 조건, 복구 방법을 기록합니다."/></label>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{stepFields.map(field => <label className="text-sm font-bold text-slate-700" key={value(field, "fieldCode")}>{value(field, "fieldName")} {field.required === true && <span className="text-red-600">*</span>}<input className={fieldClass} placeholder={value(field, "apiProperty")} value={preInputs[value(field, "fieldCode")] ?? ""} onChange={event => setPreInputs(current => ({ ...current, [value(field, "fieldCode")]: event.target.value }))}/><span className="mt-1 block text-xs font-normal text-slate-400">{value(field, "fieldGroup") || "공통"} · {value(field, "dataType") || value(field, "controlType")} · {value(field, "lineageStatus")}</span></label>)}</div>
      </section>

      <ContractTable title="선택 절차" heads={["순서", "절차", "액터", "명령", "대상"]} rows={selectedBinding ? [[value(selectedBinding, "stepOrder"), value(selectedBinding, "stepName"), value(selectedBinding, "actorName") || value(selectedBinding, "actorCode"), value(selectedBinding, "commandCode"), value(selectedBinding, "audience")]] : []}/>
      <ContractTable title="선택 가능한 기능" heads={["코드", "기능", "유형", "구현"]} rows={capabilities.map(row => [value(row, "capabilityCode"), value(row, "capabilityName"), value(row, "capabilityType"), value(row, "implementationStatus")])}/>
      <ContractTable title="선택 절차 테스트" heads={["유형", "시나리오", "상태"]} rows={tests.map(row => [value(row, "caseType"), value(row, "caseName"), value(row, "caseStatus")])}/>
      {result && <div className={`rounded-2xl border p-5 ${value(result, "result") === "PASSED" ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}><div className="flex items-center justify-between"><strong className="text-lg text-[#052b57]">결정론적 테스트 결과</strong><span className="rounded-full bg-white px-3 py-1 text-sm font-black">{value(result, "result")} · {value(result, "passedCheckCount")}/{value(result, "totalCheckCount")}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{checks.map(row => <div className="rounded-lg border bg-white p-3" key={value(row, "code")}><strong className={row.passed === true ? "text-emerald-700" : "text-red-700"}>{row.passed === true ? "통과" : "차단"} · {value(row, "name")}</strong><span className="mt-1 block text-xs text-slate-500">{value(row, "code")}</span></div>)}</div></div>}
    </>}
  </div>;

  function moveScreen(offset: number) {
    const index = screens.findIndex(row => value(row, "itemId") === value(selected ?? {}, "itemId"));
    const target = screens[index + offset]; if (target) void selectScreen(target);
  }
}

function capabilityMatches(binding: Row | undefined, capability: Row) {
  if (!binding) return false;
  const commandCode = value(binding, "commandCode");
  if (value(capability, "capabilityCode") === commandCode) return true;
  try {
    const raw = capability.commandContract;
    const contract = typeof raw === "string" ? JSON.parse(raw || "{}") : (raw ?? {}) as Row;
    return contract.commandCode === commandCode || (Array.isArray(contract.commands) && contract.commands.includes(commandCode));
  } catch { return false; }
}
function SelectField({ label, value: selected, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; placeholder?: string }) { return <label className="text-sm font-bold text-slate-700">{label}<select className={fieldClass} value={selected} onChange={event => onChange(event.target.value)}>{placeholder && <option value="">{placeholder}</option>}{options.map(option => <option key={option.value} value={option.value}>{option.label} · {option.value}</option>)}</select></label>; }
function MetricGrid({ values }: { values: [string, number][] }) { return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{values.map(([label, count]) => <article className="rounded-xl border bg-white p-4" key={label}><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl text-[#052b57]">{count}</strong></article>)}</div>; }
function ScreenMoveButton({ disabled, label, onClick }: { disabled: boolean; label: string; onClick: () => void }) { return <button className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-40" disabled={disabled} onClick={onClick} type="button">{label}</button>; }
function ContractTable({ title, heads, rows }: { title: string; heads: string[]; rows: string[][] }) { return <div className="overflow-x-auto rounded-2xl border bg-white"><h3 className="border-b px-5 py-4 font-black text-[#052b57]">{title}</h3><table className="min-w-[720px] w-full text-left text-sm"><thead className="bg-slate-50"><tr>{heads.map(head => <th className="px-4 py-3 text-xs text-slate-600" key={head}>{head}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr className="border-t" key={index}>{row.map((cell, cellIndex) => <td className="px-4 py-3" key={cellIndex}>{cell || "-"}</td>)}</tr>) : <tr><td className="px-4 py-5 text-center text-slate-500" colSpan={heads.length}>등록된 항목이 없습니다.</td></tr>}</tbody></table></div>; }
