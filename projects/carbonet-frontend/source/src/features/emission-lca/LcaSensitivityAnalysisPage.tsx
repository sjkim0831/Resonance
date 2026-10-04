import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { buildResilientCsrfHeaders } from "../../lib/api/core";

type Project = { id: string; name: string; site: string; period: string };
type Workspace = { workspaceId?: string; businessKey?: string; workflowStatus?: string; version?: number; updatedAt?: string; payload?: unknown };
type InputVariable = { id: string; label: string; group: string; value: number; unit: string; sourceVersion: string; evidence: string };
type SensitivityResult = { variable: string; scenario: string; input: string; impact: string; unit: string; change: string; category: string; evidence: string };

const PROJECTS_API = "/home/api/emission-projects?page=1&size=100";
const WORKSPACE_API = "/admin/api/admin/lca-workspaces";
const INPUT_TYPES = ["LCA_MATERIAL_MAPPING", "LCA_ENERGY_STEAM", "LCA_TRANSPORT"];
const REQUIRED_TYPES = ["LCA_CALCULATION_RESULT", "LCA_IMPACT_ASSESSMENT"];
const HEADERS = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function payloadOf(record?: Workspace): Record<string, unknown> {
  if (record?.payload && typeof record.payload === "object") return record.payload as Record<string, unknown>;
  if (typeof record?.payload === "string") { try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; } }
  return {};
}
function list(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.filter(item => item && typeof item === "object") as Record<string, unknown>[] : []; }
function text(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) return String(row[key]);
  return "";
}
function projectIdOf(record: Workspace) { return text(payloadOf(record), "projectId", "project_id"); }
function approved(record?: Workspace) { return ["APPROVED", "VALIDATED", "COMPLETED", "LOCKED"].includes(String(record?.workflowStatus || "").toUpperCase()); }
function numeric(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) { const value = Number(row[key]); if (row[key] !== undefined && row[key] !== null && Number.isFinite(value)) return value; }
  return Number.NaN;
}
function rowsFrom(payload: Record<string, unknown>, keys: string[]) { return keys.flatMap(key => list(payload[key])); }
function buildInputVariables(records: Record<string, Workspace[]>, projectId: string): InputVariable[] {
  const labels: Record<string, string> = { LCA_MATERIAL_MAPPING: "원료·보조재", LCA_ENERGY_STEAM: "에너지·스팀", LCA_TRANSPORT: "운송" };
  const out: InputVariable[] = [];
  for (const type of INPUT_TYPES) {
    const record = (records[type] || []).find(item => projectIdOf(item) === projectId);
    if (!record) continue;
    const data = payloadOf(record);
    const entries = rowsFrom(data, ["items", "materials", "inputs", "inventory", "records", "rows", "energySources", "transportLegs"]);
    entries.forEach((row, index) => {
      const value = numeric(row, "quantity", "amount", "activityAmount", "consumption", "distance", "value");
      if (!Number.isFinite(value)) return;
      const id = text(row, "id", "materialId", "flowId", "inputId", "processId", "code") || `${type}-${index + 1}`;
      out.push({
        id,
        label: text(row, "name", "materialName", "flowName", "energyName", "transportName", "processName") || `${labels[type]} ${index + 1}`,
        group: labels[type],
        value,
        unit: text(row, "unit", "quantityUnit", "activityUnit", "distanceUnit") || "단위 미기록",
        sourceVersion: `v${record.version ?? "—"}`,
        evidence: text(row, "evidenceRef", "sourceRef", "datasetName", "documentId") || "근거 미기록"
      });
    });
  }
  return out;
}
function sensitivityResults(record?: Workspace): SensitivityResult[] {
  const data = payloadOf(record);
  const raw = rowsFrom(data, ["sensitivityResults", "analysisResults", "scenarioResults", "results"]);
  return raw.map(row => ({
    variable: text(row, "variableName", "inputName", "parameterName", "variable") || "변수 미기록",
    scenario: text(row, "scenarioName", "scenario", "caseName") || "시나리오 미기록",
    input: text(row, "inputValue", "changedValue", "value"),
    impact: text(row, "impactValue", "resultValue", "characterizedValue", "result"),
    unit: text(row, "impactUnit", "resultUnit", "unit"),
    change: text(row, "changePercent", "relativeChange", "deltaPercent"),
    category: text(row, "impactCategory", "categoryName", "category") || "범주 미기록",
    evidence: text(row, "evidenceRef", "sourceRef", "inputSnapshotId") || "증적 미기록"
  }));
}

export function LcaSensitivityAnalysisPage() {
  const requestedProject = new URLSearchParams(location.search).get("projectId") || "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<Record<string, Workspace[]>>({});
  const [projectId, setProjectId] = useState(requestedProject);
  const [baselineId, setBaselineId] = useState("");
  const [variableId, setVariableId] = useState("");
  const [lowerPct, setLowerPct] = useState("-10");
  const [upperPct, setUpperPct] = useState("10");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const urls = [PROJECTS_API, ...REQUIRED_TYPES.map(type => `${WORKSPACE_API}/${type}`), ...INPUT_TYPES.map(type => `${WORKSPACE_API}/${type}`), `${WORKSPACE_API}/LCA_SENSITIVITY_ANALYSIS`];
      const responses = await Promise.all(urls.map(url => fetch(url, { credentials: "include", cache: "no-store", headers: HEADERS })));
      const bodies = await Promise.all(responses.map(response => response.json().catch(() => ({})) as Promise<Record<string, unknown>>));
      if (!responses[0].ok) throw new Error(`프로젝트 조회 실패 (${responses[0].status}). 로그인과 프로젝트 권한을 확인하세요.`);
      const requiredFailure = responses.slice(1, 1 + REQUIRED_TYPES.length).findIndex(response => !response.ok);
      if (requiredFailure >= 0) throw new Error(`기준 결과 조회 실패 (${REQUIRED_TYPES[requiredFailure]} ${responses[requiredFailure + 1].status}). 권한 또는 API 연결을 확인하세요.`);
      const available = list(bodies[0].items).map(row => ({ id: text(row, "id", "projectId"), name: text(row, "name", "projectName", "id"), site: text(row, "site", "siteName"), period: text(row, "period", "periodStart", "reportingPeriod") })).filter(row => row.id);
      const next: Record<string, Workspace[]> = {};
      const allTypes = [...REQUIRED_TYPES, ...INPUT_TYPES, "LCA_SENSITIVITY_ANALYSIS"];
      allTypes.forEach((type, index) => {
        const response = responses[index + 1];
        next[type] = response.ok ? list(bodies[index + 1].records) as Workspace[] : [];
      });
      setProjects(available);
      setRecords(next);
      setProjectId(current => available.some(item => item.id === current) ? current : available.some(item => item.id === requestedProject) ? requestedProject : "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "민감도 분석 자료를 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, [requestedProject]);
  useEffect(() => { void load(); }, [load]);

  const project = projects.find(row => row.id === projectId);
  const lciResults = (records.LCA_CALCULATION_RESULT || []).filter(row => projectIdOf(row) === projectId).sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  const lciaResults = (records.LCA_IMPACT_ASSESSMENT || []).filter(row => projectIdOf(row) === projectId).sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  const baselines = lciaResults.filter(row => approved(row) && rowsFrom(payloadOf(row), ["impactCategories", "categoryResults", "results", "impactResults"]).length > 0);
  const baseline = baselines.find(row => String(row.workspaceId || "") === baselineId) || baselines[0];
  const variables = useMemo(() => buildInputVariables(records, projectId), [records, projectId]);
  const selectedVariable = variables.find(row => row.id === variableId) || variables[0];
  const savedRecords = (records.LCA_SENSITIVITY_ANALYSIS || []).filter(row => projectIdOf(row) === projectId).sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  const results = useMemo(() => savedRecords.flatMap(sensitivityResults).filter(row => !search || `${row.variable} ${row.scenario} ${row.category} ${row.evidence}`.toLowerCase().includes(search.toLowerCase())), [savedRecords, search]);
  const checkReady = Boolean(project && baseline && selectedVariable && Number(lowerPct) < 0 && Number(upperPct) > 0 && Number(lowerPct) < Number(upperPct) && reason.trim());
  const link = (path: string) => { const url = new URL(path, location.origin); if (projectId) url.searchParams.set("projectId", projectId); return `${url.pathname}${url.search}`; };
  function selectProject(id: string) {
    setProjectId(id); setBaselineId(""); setVariableId(""); setNotice("");
    const url = new URL(location.href); if (id) url.searchParams.set("projectId", id); else url.searchParams.delete("projectId"); history.replaceState(null, "", url);
  }
  async function saveScenario(event: FormEvent) {
    event.preventDefault(); setNotice("");
    if (!checkReady || !project || !baseline || !selectedVariable) { setNotice("프로젝트, 승인된 LCIA 기준 결과, 입력 변수와 근거를 확인하세요."); return; }
    setSaving(true);
    try {
      const response = await fetch(`${WORKSPACE_API}/LCA_SENSITIVITY_ANALYSIS`, {
        method: "POST", credentials: "include",
        headers: await buildResilientCsrfHeaders({ "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }),
        body: JSON.stringify({
          businessKey: `${project.id}:SENSITIVITY:${baseline.workspaceId || baseline.version}`,
          assignedActor: "LCA_SPECIALIST",
          payload: {
            schema: "ccus.lca.sensitivity-analysis.v1", projectId: project.id, projectName: project.name,
            baselineLciaWorkspaceId: baseline.workspaceId || null, baselineLciaVersion: baseline.version ?? null,
            baselineWorkflowStatus: baseline.workflowStatus || null,
            inputLciWorkspaceId: text(payloadOf(baseline), "inputLciWorkspaceId") || null,
            inputLciVersion: text(payloadOf(baseline), "inputLciVersion", "inventoryVersion") || null,
            method: "ONE_AT_A_TIME", variable: selectedVariable, lowerPercent: Number(lowerPct), upperPercent: Number(upperPct),
            rationale: reason.trim(), analysisStatus: "DRAFT", results: [],
            savedAt: new Date().toISOString(), note: "조건 초안만 저장했습니다. 민감도 재계산 결과는 계산 엔진에서 생성·저장된 자료만 표시합니다."
          }
        })
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message || `민감도 조건 저장 실패 (${response.status})`);
      setNotice("민감도 조건 초안을 저장했습니다. 계산 결과는 엔진 연결 후 생성됩니다.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "민감도 조건을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }
  function exportReview() {
    const snapshot = { schema: "ccus.lca.sensitivity-review.v1", exportedAt: new Date().toISOString(), project, baseline: baseline ? { workspaceId: baseline.workspaceId, version: baseline.version, workflowStatus: baseline.workflowStatus } : null, conditions: savedRecords.map(row => ({ workspaceId: row.workspaceId, version: row.version, workflowStatus: row.workflowStatus, ...payloadOf(row) })), results, note: "서버에 저장된 분석 결과만 포함합니다. 조건 값으로 결과를 추정하지 않았습니다." };
    const href = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = href; anchor.download = `${project?.id || "lca"}-sensitivity-review.json`; anchor.click(); URL.revokeObjectURL(href);
  }

  return <main className="mx-auto max-w-[1440px] px-4 py-7 text-[#052b57]" data-testid="lca-sensitivity-analysis-page">
    <nav aria-label="현재 위치" className="mb-4 text-sm"><a className="underline" href="/emission/lca?menu=H1030101">제품 LCA</a>　›　<a className="underline" href={link("/lca/impact-assessment")}>LCIA 영향평가</a>　›　<strong>민감도 분석</strong></nav>
    <header className="flex flex-wrap items-end justify-between gap-5 rounded-lg border border-blue-200 bg-blue-50 p-6"><div><p className="font-bold text-blue-800">제품 LCA · 결과 분석 · H1030305</p><h1 className="mt-1 text-3xl font-black">민감도 분석</h1><p className="mt-2 max-w-4xl">원료량·에너지 사용량·운송거리 등 입력 변수의 변화 범위를 정의하고, 고정된 LCIA 기준 결과에 대한 계산 결과와 근거를 검토합니다.</p></div><label className="min-w-80 font-bold">분석 프로젝트<select aria-label="분석 프로젝트" className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={projectId} onChange={event => selectProject(event.target.value)}><option value="">프로젝트 선택</option>{projects.map(row => <option key={row.id} value={row.id}>{row.name} · {row.id}</option>)}</select></label></header>
    {error && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded border border-blue-300 bg-blue-50 p-4">{notice}</p>}
    {project && <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="민감도 분석 기준"><article className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">프로젝트</p><strong>{project.name}</strong><p className="text-xs text-slate-500">{project.id} · {project.site || "사업장 미기록"}</p></article><article className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">LCI 산정 결과</p><strong>{lciResults.length}개 저장본</strong><p className="text-xs text-slate-500">기준 LCIA에 고정된 입력 버전을 확인합니다.</p></article><article className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">승인된 LCIA 기준</p><strong>{baselines.length}개 사용 가능</strong><p className="text-xs text-slate-500">결과값이 포함된 승인·검증 저장본만 기준으로 사용합니다.</p></article><article className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">입력 변수</p><strong>{variables.length}개 확인</strong><p className="text-xs text-slate-500">연결된 인벤토리에서 수량·단위가 있는 입력을 불러옵니다.</p></article></section>}
    <section className="mt-4 rounded-lg border bg-white" aria-labelledby="sensitivity-steps-title"><div className="border-b p-5"><p className="text-sm font-bold text-blue-800">분석 절차</p><h2 id="sensitivity-steps-title" className="mt-1 text-xl font-black">기준 결과 고정 → 입력 범위 지정 → 계산 결과 검토</h2></div><ol className="grid gap-3 p-5 md:grid-cols-4">{[["1", "프로젝트·LCIA 기준 선택", project && baseline ? "확인" : "선택 필요"], ["2", "변수·근거 확인", variables.length ? "확인" : "입력 연결 필요"], ["3", "변화 범위·사유 입력", checkReady ? "조건 준비" : "입력 필요"], ["4", "계산 결과 검토", results.length ? `${results.length}개 결과` : "계산 서비스 연결 대기"]].map(([n, title, state]) => <li key={n} className="rounded border bg-slate-50 p-4"><strong className="text-blue-800">{n}. {title}</strong><p className="mt-2 text-sm text-slate-600">{state}</p></li>)}</ol></section>
    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={saveScenario} className="rounded-lg border bg-white" aria-labelledby="sensitivity-condition-title"><div className="border-b p-5"><p className="text-sm font-bold text-blue-800">민감도 조건</p><h2 id="sensitivity-condition-title" className="mt-1 text-xl font-black">한 번에 변수 하나씩 변화 범위 정의</h2><p className="mt-1 text-sm text-slate-600">입력 수량과 단위를 인벤토리에서 가져옵니다. ± 변화율은 분석 조건으로 저장하며, 결과값은 계산 서비스가 산출한 값만 표시합니다.</p></div>
        {!project ? <p className="p-8 text-center">먼저 프로젝트를 선택하세요.</p> : <div className="grid gap-4 p-5 md:grid-cols-2">
          <label className="font-bold md:col-span-2">승인된 LCIA 기준 결과<select className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={baseline?.workspaceId || baselineId} onChange={event => setBaselineId(event.target.value)} disabled={!baselines.length}><option value="">{baselines.length ? "기준 결과를 선택하세요" : "승인된 LCIA 결과 없음"}</option>{baselines.map(row => <option key={row.workspaceId || row.version} value={String(row.workspaceId || "")}>LCIA v{row.version ?? "—"} · {row.workflowStatus} · {text(payloadOf(row), "lciaMethodName", "methodName") || "평가방법 미기록"}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-600">LCIA 결과와 연결된 LCI 작업공간·버전: {baseline ? `${text(payloadOf(baseline), "inputLciWorkspaceId") || "ID 미기록"} · v${text(payloadOf(baseline), "inputLciVersion", "inventoryVersion") || "버전 미기록"}` : "기준 미선택"}</span></label>
          <label className="font-bold md:col-span-2">분석 변수<select className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={selectedVariable?.id || variableId} onChange={event => setVariableId(event.target.value)} disabled={!variables.length}><option value="">{variables.length ? "분석 변수를 선택하세요" : "수량이 연결된 원료·에너지·운송 입력이 없습니다"}</option>{variables.map(row => <option key={`${row.group}-${row.id}`} value={row.id}>{row.group} · {row.label} · {row.value} {row.unit}</option>)}</select></label>
          {selectedVariable && <div className="rounded border bg-slate-50 p-4 text-sm md:col-span-2"><strong>기준 입력값</strong><p className="mt-1">{selectedVariable.label}: {selectedVariable.value} {selectedVariable.unit} · 입력 {selectedVariable.sourceVersion} · {selectedVariable.evidence}</p></div>}
          <label className="font-bold">하한 변화율 (%)<input aria-label="하한 변화율 (%)" className="mt-2 block min-h-11 w-full rounded border border-slate-300 px-3" type="number" step="0.1" max="-0.1" value={lowerPct} onChange={event => setLowerPct(event.target.value)} /></label>
          <label className="font-bold">상한 변화율 (%)<input aria-label="상한 변화율 (%)" className="mt-2 block min-h-11 w-full rounded border border-slate-300 px-3" type="number" step="0.1" min="0.1" value={upperPct} onChange={event => setUpperPct(event.target.value)} /></label>
          <label className="font-bold md:col-span-2">변경 범위 설정 근거<textarea required className="mt-2 block min-h-24 w-full rounded border border-slate-300 p-3 font-normal" value={reason} onChange={event => setReason(event.target.value)} placeholder="예: 공급자 월별 실적 변동, 계량기 허용 오차, 원료 사양서 범위" /></label>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2"><button type="submit" disabled={saving || loading || !checkReady} className="min-h-11 rounded bg-[#003b88] px-5 font-bold text-white disabled:opacity-50">{saving ? "저장 중…" : "분석 조건 초안 저장"}</button><button type="button" onClick={() => void load()} className="min-h-11 rounded border border-blue-700 px-4 font-bold text-blue-900">새로고침</button><span className="text-xs text-slate-600">저장 액터: LCA_SPECIALIST · 프로젝트별 작업공간</span></div>
        </div>}
      </form>
      <aside className="space-y-4"><section className="rounded-lg border border-amber-300 bg-amber-50 p-5"><p className="text-sm font-bold text-amber-900">계산 서비스 상태</p><h2 className="mt-1 text-lg font-black">{results.length ? "저장 결과를 확인할 수 있습니다" : "민감도 재계산 API 미연결"}</h2><p className="mt-2 text-sm">기준 입력을 바꾸어 재산정하는 엔드포인트가 연결되지 않았습니다. 이 화면은 임의의 비례 추정 결과를 만들지 않습니다.</p><button type="button" disabled title="민감도 재계산 API와 결과 저장 계약이 연결된 뒤 사용할 수 있습니다." className="mt-4 min-h-11 w-full rounded bg-slate-300 px-4 font-bold text-slate-700">민감도 계산 실행 · 연결 대기</button><p className="mt-2 text-xs text-slate-600">실행 API·결과 스키마: 확인되지 않음</p></section>
        <section className="rounded-lg border bg-white p-5"><p className="text-sm font-bold text-blue-800">검토 기준</p><ul className="mt-3 space-y-2 text-sm"><li>① LCIA 기준 결과는 승인·검증 상태여야 합니다.</li><li>② 기준 LCI 버전, 입력 변수 ID·단위를 고정합니다.</li><li>③ 변경 범위 근거를 기록합니다.</li><li>④ 결과에는 범주별 값·단위·변화율·실행 ID·증적이 있어야 합니다.</li></ul></section></aside>
    </section>
    <section className="mt-4 overflow-hidden rounded-lg border bg-white" aria-labelledby="sensitivity-results-title"><div className="flex flex-wrap items-end justify-between gap-3 border-b p-5"><div><p className="text-sm font-bold text-blue-800">민감도 결과</p><h2 id="sensitivity-results-title" className="mt-1 text-xl font-black">저장된 조건과 계산 결과</h2><p className="mt-1 text-sm text-slate-600">계산 결과가 연결되지 않은 경우 조건을 결과처럼 표시하지 않습니다.</p></div><div className="flex gap-2"><input aria-label="결과 검색" className="min-h-10 rounded border px-3" value={search} onChange={event => setSearch(event.target.value)} placeholder="변수·시나리오·범주" /><button type="button" onClick={exportReview} disabled={!project} className="min-h-10 rounded border border-blue-700 px-4 font-bold text-blue-900 disabled:opacity-50">검토 자료 내보내기</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-100"><tr>{["변수", "시나리오", "입력값", "영향범주", "영향 결과", "변화율", "근거"].map(label => <th key={label} className="border-b p-3 text-left">{label}</th>)}</tr></thead><tbody>{results.length ? results.map((row, index) => <tr key={`${row.variable}-${row.scenario}-${index}`}><td className="border-b p-3 font-bold">{row.variable}</td><td className="border-b p-3">{row.scenario}</td><td className="border-b p-3">{row.input || "미기록"}</td><td className="border-b p-3">{row.category}</td><td className="border-b p-3">{row.impact || "미기록"} {row.unit}</td><td className="border-b p-3">{row.change || "미기록"}</td><td className="border-b p-3">{row.evidence}</td></tr>) : <tr><td colSpan={7} className="p-12 text-center"><strong className="block">{loading ? "민감도 분석 자료를 불러오는 중입니다." : !project ? "프로젝트를 선택하세요." : !baseline ? "승인된 LCIA 결과를 선택하거나 먼저 생성하세요." : savedRecords.length ? "조건 초안은 저장됐지만 재계산 결과는 아직 없습니다." : "저장된 민감도 분석 결과가 없습니다."}</strong><span className="mt-2 block text-slate-600">기준값의 단순 증감 계산 결과를 환경영향 결과로 간주하지 않습니다.</span></td></tr>}</tbody></table></div></section>
    <nav className="mt-5 flex flex-wrap gap-3" aria-label="LCA 분석 이동"><a className="rounded border bg-white p-3 font-bold underline" href={link("/lca/material-contribution-analysis")}>이전: 원료별 기여도</a><a className="rounded border bg-white p-3 font-bold underline" href={link("/lca/interpretation")}>다음: 결과 해석·개선안</a></nav>
    <details className="mt-5 rounded border bg-white p-4"><summary className="cursor-pointer font-bold">도움말 · 업무 순서 · 완료 기준 · QA</summary><div className="mt-3 grid gap-4 md:grid-cols-3"><p><strong>업무 순서</strong><br/>프로젝트 선택 → 승인 LCIA 결과와 LCI 입력 버전 고정 → 변수·하한·상한·근거 입력 → 조건 초안 저장 → 계산 서비스 결과 확인.</p><p><strong>완료 기준</strong><br/>입력 스냅샷·방법론 버전이 고정되고, 변화 범위 근거와 재계산 결과·범주·단위·실행 ID가 저장되어야 합니다.</p><p><strong>현재 한계</strong><br/>조건 초안은 작업공간에 저장할 수 있습니다. 실제 민감도 계산과 결과 생성은 전용 계산 API가 연결되어야 완료됩니다.</p><p className="md:col-span-3"><strong>QA 순서</strong><br/>같은 프로젝트·승인 LCIA·LCI 버전을 확인하고, 단일 변수 하한·기준·상한을 각각 계산한 뒤 결과 재조회와 증적을 확인합니다. 기준값이 변하면 이전 결과를 현재 결과로 이어 쓰지 않습니다.</p><p className="md:col-span-3"><strong>현재 자료</strong><br/>{loading ? "조회 중" : `${projects.length}개 프로젝트 · ${variables.length}개 입력 변수 · ${savedRecords.length}개 조건 저장본 · ${results.length}개 결과 행`}</p></div></details>
  </main>;
}
