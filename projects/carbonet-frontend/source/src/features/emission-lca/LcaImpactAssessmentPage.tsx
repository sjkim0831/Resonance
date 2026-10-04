import { useCallback, useEffect, useMemo, useState } from "react";
import { buildResilientCsrfHeaders } from "../../lib/api/core";

type Project = { id: string; name: string; site: string; period: string; status: string };
type WorkspaceRecord = { workspaceId?: string; version?: number; workflowStatus?: string; payload?: unknown; updatedAt?: string };
type WorkspaceBody = { records?: WorkspaceRecord[]; message?: string };
type Check = { label: string; state: "ready" | "missing" | "review" | "unknown"; detail: string; href: string };
type ImpactRow = { category: string; indicator: string; value: string; unit: string; method: string };

const PROJECTS_API = "/home/api/emission-projects?page=1&size=100";
const WORKSPACE = "/admin/api/admin/lca-workspaces";
const WORKSPACES = ["LCA_PRODUCT_PROCESS", "LCA_SCOPE", "LCA_DATA_COLLECTION", "LCA_MATERIAL_MAPPING", "LCA_CALCULATION_RESULT", "LCA_IMPACT_ASSESSMENT"];

function payload(record?: WorkspaceRecord): Record<string, unknown> {
  if (record?.payload && typeof record.payload === "object") return record.payload as Record<string, unknown>;
  if (typeof record?.payload === "string") { try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; } }
  return {};
}
function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) { const v = row[key]; if (v !== undefined && v !== null && String(v).trim()) return String(v); }
  return "";
}
function approved(record?: WorkspaceRecord) { return ["APPROVED", "VALIDATED", "COMPLETED", "LOCKED"].includes(String(record?.workflowStatus || "").toUpperCase()); }
function impactRows(record?: WorkspaceRecord): ImpactRow[] {
  const p = payload(record);
  const raw = p.impactCategories ?? p.categoryResults ?? p.results ?? p.impactResults;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is Record<string, unknown> => !!v && typeof v === "object").map((v) => ({
    category: str(v, "categoryName", "impactCategory", "category", "name"),
    indicator: str(v, "indicator", "indicatorName", "midpointIndicator"),
    value: str(v, "characterizedValue", "result", "value", "score"),
    unit: str(v, "unit", "resultUnit"),
    method: str(v, "methodName", "lciaMethod", "method"),
  })).filter(row => row.category && row.value);
}

export function LcaImpactAssessmentPage() {
  const requestedProjectId = new URLSearchParams(location.search).get("projectId") || "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(requestedProjectId);
  const [lciWorkspaceId, setLciWorkspaceId] = useState("");
  const [records, setRecords] = useState<Record<string, WorkspaceRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [methodName, setMethodName] = useState("");
  const [methodVersion, setMethodVersion] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [datasetVersion, setDatasetVersion] = useState("");
  const [datasetSource, setDatasetSource] = useState("");
  const [categoryText, setCategoryText] = useState("");
  const [scenario, setScenario] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const responses = await Promise.all([PROJECTS_API, ...WORKSPACES.map(type => `${WORKSPACE}/${type}`)].map(url => fetch(url, { credentials: "include", cache: "no-store", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } })));
      const bodies = await Promise.all(responses.map(response => response.json().catch(() => ({})) as Promise<Record<string, unknown>>));
      if (!responses[0].ok) throw new Error(`프로젝트 조회 실패 (${responses[0].status}). 로그인 및 프로젝트 권한을 확인하세요.`);
      const available = ((bodies[0].items || []) as Array<Record<string, unknown>>).map(row => ({ id: String(row.id || ""), name: String(row.name || row.id || "미명"), site: String(row.site || ""), period: String(row.period || ""), status: String(row.status || "") })).filter(row => row.id);
      const failed = responses.slice(1).map((response, i) => !response.ok ? `${WORKSPACES[i]} (${response.status})` : "").filter(Boolean);
      if (failed.length) throw new Error(`평가 입력·결과 작업공간 조회 권한 또는 API 오류: ${failed.join(", ")}`);
      const next: Record<string, WorkspaceRecord[]> = {};
      WORKSPACES.forEach((type, i) => { next[type] = Array.isArray(bodies[i + 1].records) ? bodies[i + 1].records as WorkspaceRecord[] : []; });
      setProjects(available); setRecords(next);
      setProjectId(current => available.some(row => row.id === current) ? current : available.some(row => row.id === requestedProjectId) ? requestedProjectId : "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "LCIA 프로젝트 자료를 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, [requestedProjectId]);
  useEffect(() => { void load(); }, [load]);

  const project = projects.find(row => row.id === projectId);
  const projectRecords = (type: string) => (records[type] || []).filter(record => payload(record).projectId === projectId);
  const recordFor = (type: string) => projectRecords(type)[0];
  const lciRecords = projectRecords("LCA_CALCULATION_RESULT");
  const lci = lciRecords.find(record => String(record.workspaceId || "") === lciWorkspaceId) || lciRecords[0];
  const impact = recordFor("LCA_IMPACT_ASSESSMENT");
  const savedResults = useMemo(() => impactRows(impact), [impact]);
  const impactPayload = payload(impact);
  const method = str(impactPayload, "lciaMethodName", "methodName", "lciaMethod", "impactMethod");
  const runId = str(impactPayload, "assessmentRunId", "runId", "calculationId");
  useEffect(() => {
    setLciWorkspaceId(current => lciRecords.some(record => String(record.workspaceId || "") === current) ? current : String(lciRecords[0]?.workspaceId || ""));
  }, [projectId, records.LCA_CALCULATION_RESULT]);
  useEffect(() => {
    setMethodName(str(impactPayload, "lciaMethodName", "methodName", "lciaMethod", "impactMethod"));
    setMethodVersion(str(impactPayload, "methodVersion"));
    setDatasetName(str(impactPayload, "datasetName", "characterizationDataset"));
    setDatasetVersion(str(impactPayload, "datasetVersion", "characterizationVersion"));
    setDatasetSource(str(impactPayload, "datasetSource", "methodSource"));
    const categories = impactPayload.impactCategories;
    setCategoryText(Array.isArray(categories) ? categories.map(value => typeof value === "string" ? value : str(value as Record<string, unknown>, "categoryName", "name", "category")).filter(Boolean).join("\n") : "");
    setScenario(str(impactPayload, "scenario", "sensitivityScenario"));
    setSaveMessage("");
  }, [projectId, impact?.workspaceId, impact?.version]);
  const checks: Check[] = [
    { label: "프로젝트 선택·접근권한", state: project ? "ready" : "missing", detail: project ? `${project.name} · ${project.id}` : "접근 가능한 프로젝트를 선택해야 합니다.", href: "/emission/project_list" },
    { label: "승인된 LCI 산정 결과", state: lci ? approved(lci) ? "ready" : "review" : "missing", detail: lci ? `결과 작업공간 v${lci.version ?? "—"} · ${lci.workflowStatus || "상태 미확인"}` : "프로젝트에 연결된 LCI_CALCULATION_RESULT 저장본이 없습니다.", href: "/lca/calculation" },
    { label: "LCI 입력 버전 고정", state: lci && str(payload(lci), "inventoryVersion", "inputVersion") ? "ready" : "review", detail: lci ? `인벤토리 ${str(payload(lci), "inventoryVersion", "inputVersion") || "버전 미확인"} · 매핑 ${str(payload(lci), "mappingVersion") || "버전 미확인"}` : "계산 결과가 없어 입력 스냅샷 연결을 확인할 수 없습니다.", href: "/lca/data-mapping" },
    { label: "LCIA 방법·데이터셋 버전", state: method ? "review" : "missing", detail: method ? `${method}${str(impactPayload, "datasetVersion", "methodVersion") ? ` · ${str(impactPayload, "datasetVersion", "methodVersion")}` : " · 버전 검토 필요"}` : "프로젝트에 저장된 LCIA 방법과 특성화 데이터 버전이 없습니다.", href: "/lca/data-mapping" },
    { label: "영향범주 특성화 결과", state: savedResults.length ? "review" : "missing", detail: savedResults.length ? `${savedResults.length}개 서버 저장 결과 · 실행 ID ${runId || "미확인"} · 검토·승인 상태 확인 필요` : "서버에 저장된 범주별 특성화 결과가 없습니다. 화면에 샘플 점수를 표시하지 않습니다.", href: "/lca/contribution-analysis" },
    { label: "재현성·검토 증적", state: str(impactPayload, "inputHash", "calculationHash") && approved(impact) ? "ready" : "review", detail: impact ? `평가 v${impact.version ?? "—"} · ${impact.workflowStatus || "상태 미확인"} · 해시 ${str(impactPayload, "inputHash", "calculationHash") || "미확인"}` : "평가 저장본 및 불변 입력 해시를 확인할 수 없습니다.", href: "/lca/contribution-analysis" },
  ];
  const configurationReady = Boolean(methodName.trim() && methodVersion.trim() && datasetName.trim() && datasetVersion.trim() && categoryText.trim());
  const lciReady = Boolean(lci && approved(lci));
  const link = (path: string) => { const url = new URL(path, location.origin); if (projectId) url.searchParams.set("projectId", projectId); return `${url.pathname}${url.search}`; };
  function selectProject(id: string) { setProjectId(id); const url = new URL(location.href); if (id) url.searchParams.set("projectId", id); else url.searchParams.delete("projectId"); history.replaceState(null, "", url); }
  async function saveAssessmentDesign() {
    if (!project) { setSaveMessage("먼저 프로젝트를 선택하세요."); return; }
    const categories = categoryText.split(/[\n,]/).map(value => value.trim()).filter(Boolean);
    if (!methodName.trim() || !methodVersion.trim() || !datasetName.trim() || !datasetVersion.trim() || !categories.length) {
      setSaveMessage("방법론명·버전, 특성화 데이터셋명·버전, 영향범주를 입력해야 저장할 수 있습니다."); return;
    }
    setSaving(true); setSaveMessage("");
    try {
      const response = await fetch(`${WORKSPACE}/LCA_IMPACT_ASSESSMENT`, {
        method: "POST", credentials: "include",
        headers: await buildResilientCsrfHeaders({ "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }),
        body: JSON.stringify({
          businessKey: `${project.id}:LCIA`, assignedActor: "LCA_SPECIALIST",
          payload: {
            ...impactPayload, projectId: project.id, projectName: project.name,
            lciaMethodName: methodName.trim(), methodVersion: methodVersion.trim(),
            datasetName: datasetName.trim(), datasetVersion: datasetVersion.trim(), datasetSource: datasetSource.trim(),
            impactCategories: categories.map(categoryName => ({ categoryName })), scenario: scenario.trim(),
            inputLciWorkspaceId: lci?.workspaceId || null, inputLciVersion: lci?.version ?? null,
            inputLciWorkflowStatus: lci?.workflowStatus || null,
            configurationStatus: "DRAFT", configurationUpdatedAt: new Date().toISOString(),
          },
        }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message || `LCIA 설정 저장 실패 (${response.status})`);
      await load();
      setSaveMessage("LCIA 설계를 서버에 저장했습니다. 결과 산정은 승인된 LCI와 서버 LCIA 엔진 연결 후 진행할 수 있습니다.");
    } catch (cause) { setSaveMessage(cause instanceof Error ? cause.message : "LCIA 설계를 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }
  function exportSnapshot() {
    if (!project) return;
    const data = { schema: "ccus.lca.impact-assessment-review.v1", generatedAt: new Date().toISOString(), project: { id: project.id, name: project.name }, inputVersions: Object.fromEntries(WORKSPACES.map(type => [type, type === "LCA_CALCULATION_RESULT" ? lci?.version ?? null : recordFor(type)?.version ?? null])), inputLciWorkspaceId: lci?.workspaceId || null, inputLciWorkflowStatus: lci?.workflowStatus || null, method, runId: runId || null, savedResults, note: "저장된 LCIA 자료 검토용 내보내기입니다. 이 파일은 계산 결과를 생성하거나 서버에 저장하지 않습니다." };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const href = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = href; a.download = `${project.id}-lcia-review.json`; a.click(); URL.revokeObjectURL(href);
  }
  const stateLabel = (state: Check["state"]) => state === "ready" ? "확인" : state === "missing" ? "자료 없음" : state === "review" ? "검토 필요" : "확인 불가";
  const stateClass = (state: Check["state"]) => state === "ready" ? "bg-emerald-100 text-emerald-900" : state === "missing" ? "bg-amber-100 text-amber-900" : "bg-blue-100 text-blue-900";

  return <main className="mx-auto max-w-[1440px] px-4 py-7 text-[#052b57]" data-testid="lca-impact-assessment-page">
    <nav aria-label="현재 위치" className="mb-4 text-sm"><a className="underline" href="/emission/lca?menu=H1030101">제품 LCA</a>　›　<a className="underline" href={link("/lca/calculation")}>LCI 산정</a>　›　<strong>LCIA 영향평가</strong></nav>
    <header className="flex flex-wrap items-end justify-between gap-5 rounded-lg border border-blue-200 bg-blue-50 p-6"><div><p className="font-bold text-blue-800">제품 LCA · 영향범주 평가 · H1030302</p><h1 className="mt-1 text-3xl font-black">LCIA 영향평가</h1><p className="mt-2 max-w-4xl">프로젝트의 승인된 LCI 결과에 평가방법·특성화 데이터 버전을 연결하고, 영향범주별 결과와 검토 이력을 확인합니다.</p></div><label className="min-w-80 font-bold">평가 프로젝트<select className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={projectId} onChange={e => selectProject(e.target.value)}><option value="">프로젝트 선택</option>{projects.map(row => <option key={row.id} value={row.id}>{row.name} · {row.id}</option>)}</select></label></header>
    {error && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4">{error}</p>}
    {project && <section className="mt-4 rounded-lg border border-blue-200 bg-white p-5" aria-label="LCI 산정 결과 고정"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-blue-800">1 · 입력 결과 선택 및 고정</p><h2 className="mt-1 text-xl font-black">LCI 산정 결과</h2><p className="mt-1 text-sm text-slate-600">LCIA의 입력이 될 프로젝트 결과와 버전을 선택합니다. 저장본의 승인 상태를 확인한 뒤 평가 기준에 연결합니다.</p></div><label className="min-w-80 font-bold">LCI 결과 / 버전<select aria-label="LCI 결과 버전" className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={lciWorkspaceId} onChange={event => setLciWorkspaceId(event.target.value)} disabled={!lciRecords.length}><option value="">저장된 LCI 결과 없음</option>{lciRecords.map(record => <option key={record.workspaceId || record.version} value={String(record.workspaceId || "")}>v{record.version ?? "—"} · {record.workflowStatus || "상태 미확인"}</option>)}</select></label></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["프로젝트", `${project.name} · ${project.id}`], ["사업장", project.site || "정보 미제공"], ["기간", project.period || "정보 미제공"], ["선택한 LCI 결과", lci ? `v${lci.version ?? "—"} · ${lci.workflowStatus || "상태 미확인"}` : "연결된 결과 없음"]].map(([label, value]) => <article key={label} className="rounded-lg border bg-slate-50 p-4"><p className="text-sm text-slate-600">{label}</p><strong className="mt-1 block">{value}</strong></article>)}</div>{lci && !lciReady && <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-950">선택한 LCI 저장본은 승인 완료 상태가 아닙니다. 평가 기준 초안은 저장할 수 있지만, 계산 실행 전 승인이 필요합니다.</p>}</section>}
    <section className="mt-4 rounded-lg border bg-white" aria-labelledby="lcia-setup-title">
      <div className="border-b p-5"><p className="text-sm font-bold text-blue-800">2 · 평가 기준 설정</p><h2 id="lcia-setup-title" className="mt-1 text-xl font-black">방법론·데이터 버전 고정</h2><p className="mt-1 text-sm text-slate-600">승인된 방법론 문서와 특성화 데이터의 출처·버전을 입력하고 프로젝트 기준 초안으로 저장합니다. 검증된 방법론 목록이나 평가 계수는 아직 연결되지 않았습니다.</p></div>
      {!project ? <p className="p-8 text-center text-slate-600">평가할 프로젝트를 먼저 선택하세요.</p> : <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm font-bold">LCIA 방법론명<input className="mt-2 block min-h-11 w-full rounded border border-slate-300 px-3 font-normal" value={methodName} onChange={event => setMethodName(event.target.value)} placeholder="승인 문서에 기재된 방법론" /></label>
        <label className="text-sm font-bold">방법론 버전<input className="mt-2 block min-h-11 w-full rounded border border-slate-300 px-3 font-normal" value={methodVersion} onChange={event => setMethodVersion(event.target.value)} placeholder="예: 문서 버전/발행연도" /></label>
        <label className="text-sm font-bold">특성화 데이터셋<input className="mt-2 block min-h-11 w-full rounded border border-slate-300 px-3 font-normal" value={datasetName} onChange={event => setDatasetName(event.target.value)} placeholder="승인된 데이터셋명" /></label>
        <label className="text-sm font-bold">데이터셋 버전<input className="mt-2 block min-h-11 w-full rounded border border-slate-300 px-3 font-normal" value={datasetVersion} onChange={event => setDatasetVersion(event.target.value)} placeholder="배포 버전" /></label>
        <label className="text-sm font-bold">출처·참조<input className="mt-2 block min-h-11 w-full rounded border border-slate-300 px-3 font-normal" value={datasetSource} onChange={event => setDatasetSource(event.target.value)} placeholder="기관, 문서번호 또는 URL" /></label>
        <label className="text-sm font-bold">민감도 시나리오 (선택)<input className="mt-2 block min-h-11 w-full rounded border border-slate-300 px-3 font-normal" value={scenario} onChange={event => setScenario(event.target.value)} placeholder="비교 시나리오 설명" /></label>
        <label className="text-sm font-bold md:col-span-2">평가할 영향범주 <span className="font-normal text-slate-600">(줄마다 하나, 승인 방법론 문서 기준)</span><textarea className="mt-2 block min-h-28 w-full rounded border border-slate-300 p-3 font-normal" value={categoryText} onChange={event => setCategoryText(event.target.value)} placeholder={'예: 승인 방법론에 기재된 범주\n두 번째 범주'} /></label>
        <div className="flex flex-col justify-end gap-2"><button type="button" onClick={() => void saveAssessmentDesign()} disabled={saving || loading} className="min-h-11 rounded bg-[#003b88] px-5 font-bold text-white disabled:opacity-50">{saving ? "저장 중…" : impact ? "평가 기준 수정 저장" : "평가 기준 초안 저장"}</button><p className="text-xs text-slate-600">저장 액터: LCA_SPECIALIST · 프로젝트별 버전 기록</p></div>
        {saveMessage && <p role="status" className="rounded border border-blue-200 bg-blue-50 p-3 text-sm md:col-span-3">{saveMessage}</p>}
      </div>}
    </section>
    <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-5" aria-labelledby="lcia-run-title"><p className="text-sm font-bold text-amber-900">영향평가 실행</p><h2 id="lcia-run-title" className="mt-1 text-xl font-black">{lciReady && configurationReady ? "입력 준비 완료 · 계산 서비스 연결 필요" : "평가 입력을 준비하세요"}</h2><p className="mt-2 text-sm">LCI 결과와 평가방법을 연결한 뒤 계산 결과를 여기서 산출하고 저장합니다. 현재 개발 서버에는 영향평가 계산 기능이 연결되지 않아 실행할 수 없습니다.</p><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled title="LCIA 영향평가 계산 기능 연결 후 실행할 수 있습니다." className="min-h-11 rounded bg-slate-300 px-5 font-bold text-slate-700">영향평가 계산 실행</button><span className="text-sm">입력 LCI: {lci ? `v${lci.version ?? "—"} · ${lci.workflowStatus || "상태 확인 필요"}` : "선택되지 않음"}</span><span className="text-sm">평가방법: {method || "설정되지 않음"}</span></div></section>
    <section className="mt-4 overflow-hidden rounded-lg border bg-white" aria-labelledby="lcia-results-title"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><p className="text-sm font-bold text-blue-800">영향평가 결과</p><h2 id="lcia-results-title" className="mt-1 text-xl font-black">영향범주별 산출 결과</h2><p className="mt-1 text-sm text-slate-600">계산이 완료되면 서버에 저장된 범주별 값과 단위를 표시합니다. 아직 산출값이 없어 현재 표는 비어 있습니다.</p></div><div className="flex gap-2"><button type="button" onClick={() => void load()} className="min-h-10 rounded border border-blue-700 px-4 font-bold text-blue-900">새로고침</button><button type="button" onClick={exportSnapshot} disabled={!project || loading} className="min-h-10 rounded border border-blue-700 px-4 font-bold text-blue-900 disabled:opacity-50">결과 근거 내보내기</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-100"><tr>{["영향범주", "지표", "특성화 결과", "단위", "평가방법"].map(t => <th key={t} className="border-b p-3 text-left">{t}</th>)}</tr></thead><tbody>{savedResults.map((row, i) => <tr key={`${row.category}-${i}`}><td className="border-b p-3 font-bold">{row.category}</td><td className="border-b p-3">{row.indicator || "—"}</td><td className="border-b p-3">{row.value}</td><td className="border-b p-3">{row.unit || "서버 미기록"}</td><td className="border-b p-3">{row.method || method || "서버 미기록"}</td></tr>)}{!savedResults.length && <tr><td colSpan={5} className="p-12 text-center text-slate-600">{loading ? "평가 결과를 불러오는 중입니다." : projectId ? "이 프로젝트의 영향평가 결과가 아직 산출되지 않았습니다." : "프로젝트와 LCI 결과를 선택하면 연결된 평가 결과가 표시됩니다."}</td></tr>}</tbody></table></div></section>
    <nav className="mt-5 flex flex-wrap gap-3" aria-label="LCA 영향평가 단계"><a className="rounded border bg-white p-3 font-bold underline" href={link("/lca/calculation")}>이전: LCI 산정</a><a className="rounded border bg-white p-3 font-bold underline" href={link("/lca/contribution-analysis")}>다음: 기여도·민감도 분석</a></nav>
    <details className="mt-5 rounded border bg-white p-4"><summary className="cursor-pointer font-bold">도움말 · 업무 순서 · 완료 기준 · QA 자료 점검</summary><div className="mt-3 grid gap-4 md:grid-cols-3"><section><h2 className="font-bold">업무 순서</h2><p>프로젝트 선택 → 승인된 LCI 결과 선택 → 평가방법·데이터·영향범주 설정 → 영향평가 실행 → 결과 검토·확정.</p></section><section><h2 className="font-bold">완료 기준</h2><p>영향범주별 값·단위·방법 버전·입력 버전·실행 ID가 저장되고, 검토·승인이 기록되어야 합니다.</p></section><section><h2 className="font-bold">현재 기능 범위</h2><p>평가 기준 초안 저장과 기존 결과 조회가 가능합니다. 계산 API 및 계수 카탈로그가 연결되기 전에는 실제 영향평가를 산출할 수 없습니다.</p></section><section className="md:col-span-3"><h2 className="font-bold">QA 자료 점검</h2><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{checks.map(row => <article key={row.label} className="rounded border p-3 text-sm"><div className="flex items-center justify-between gap-2"><strong>{row.label}</strong><span className={`rounded px-2 py-1 text-xs font-bold ${stateClass(row.state)}`}>{stateLabel(row.state)}</span></div><p className="mt-1 text-slate-700">{row.detail}</p><a className="mt-2 inline-block font-bold text-blue-800 underline" href={link(row.href)}>관련 화면 열기 →</a></article>)}</div><dl className="mt-3 grid gap-2 rounded bg-slate-50 p-3 text-sm sm:grid-cols-2"><div>LCI 버전: <strong>{lci ? `v${lci.version ?? "—"}` : "미연결"}</strong></div><div>LCIA 설정 버전: <strong>{impact ? `v${impact.version ?? "—"}` : "미저장"}</strong></div><div>영향범주 결과: <strong>{savedResults.length}건</strong></div><div>마지막 갱신: <strong>{impact?.updatedAt || "기록 없음"}</strong></div></dl></section></div></details>
  </main>;
}
