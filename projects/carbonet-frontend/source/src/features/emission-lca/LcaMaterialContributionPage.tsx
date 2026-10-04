import { useCallback, useEffect, useMemo, useState } from "react";

type Project = { id: string; name: string; site: string; period: string };
type Workspace = { workspaceId?: string; version?: number; workflowStatus?: string; payload?: unknown };
type MaterialRow = { id: string; name: string; kind: string; process: string; quantity: string; quantityUnit: string; category: string; indicator: string; value: string; unit: string; share: string; lciVersion: string; evidence: string };
const PROJECTS = "/home/api/emission-projects?page=1&size=100";
const WORKSPACES = "/admin/api/admin/lca-workspaces";
const headers = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };

function payloadOf(record?: Workspace): Record<string, unknown> {
  if (record?.payload && typeof record.payload === "object") return record.payload as Record<string, unknown>;
  if (typeof record?.payload === "string") { try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; } }
  return {};
}
function text(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) if (row[key] !== null && row[key] !== undefined && String(row[key]).trim()) return String(row[key]);
  return "";
}
function rows(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : []; }
function projectOf(record: Workspace) { const data = payloadOf(record); return text(data, "projectId", "project_id"); }

function contributionRows(assessment: Workspace | undefined, materials: Record<string, unknown>[], category: string): MaterialRow[] {
  const data = payloadOf(assessment);
  const candidates = [data.materialContributions, data.materialContributionResults, data.materialResults, data.materialBreakdown, data.rawMaterialContributions, data.inputContributions, data.contributions].flatMap(rows);
  for (const group of rows(data.impactCategories ?? data.categoryResults ?? data.results ?? data.impactResults)) {
    const groupName = text(group, "categoryName", "impactCategory", "category", "name");
    if (!category || groupName === category) candidates.push(...[group.materialContributions, group.materialResults, group.materialBreakdown, group.inputContributions, group.contributions].flatMap(rows).map(item => ({ ...item, __category: text(item, "categoryName", "impactCategory", "category") || groupName })));
  }
  const materialById = new Map(materials.map(item => [text(item, "materialId", "id", "code"), item]));
  return candidates.flatMap((item, index) => {
    const categoryName = text(item, "categoryName", "impactCategory", "category", "__category");
    if (category && categoryName !== category) return [];
    const id = text(item, "materialId", "materialCode", "flowId", "inputId", "material_id", "id") || `RESULT-${index + 1}`;
    const material = materialById.get(id) || {};
    const shareValue = text(item, "contributionPercent", "contributionRate", "sharePercent", "percentage", "share");
    return [{
      id,
      name: text(item, "materialName", "flowName", "inputName", "name", "flow", "material") || text(material, "name", "materialName") || "원료명 미기록",
      kind: text(item, "materialType", "type", "kind") || text(material, "type", "kind") || "원료",
      process: text(item, "processName", "stageName") || text(material, "processName", "process") || "공정 미기록",
      quantity: text(item, "quantity", "amount", "inputQuantity") || text(material, "quantity", "amount"),
      quantityUnit: text(item, "quantityUnit", "inputUnit", "flowUnit") || text(material, "unit"),
      category: categoryName || category || "범주 미기록",
      indicator: text(item, "indicator", "indicatorName", "midpointIndicator"),
      value: text(item, "contributionValue", "characterizedValue", "impactValue", "value", "result", "score"),
      unit: text(item, "resultUnit", "impactUnit", "unit"),
      share: shareValue ? (shareValue.endsWith("%") ? shareValue : `${shareValue}%`) : "",
      lciVersion: text(item, "lciVersion", "inputVersion", "inventoryVersion"),
      evidence: text(item, "evidenceRef", "sourceRef", "evidence", "activityDataRef", "datasetName") || text(material, "evidence", "source", "datasetName")
    }];
  });
}

export function LcaMaterialContributionPage() {
  const requested = new URLSearchParams(location.search).get("projectId") || "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [processRecords, setProcessRecords] = useState<Workspace[]>([]);
  const [materialRecords, setMaterialRecords] = useState<Workspace[]>([]);
  const [assessments, setAssessments] = useState<Workspace[]>([]);
  const [projectId, setProjectId] = useState(requested);
  const [assessmentId, setAssessmentId] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const urls = [PROJECTS, `${WORKSPACES}/LCA_PRODUCT_PROCESS`, `${WORKSPACES}/LCA_MATERIAL_MAPPING`, `${WORKSPACES}/LCA_IMPACT_ASSESSMENT`];
      const responses = await Promise.all(urls.map(url => fetch(url, { credentials: "include", cache: "no-store", headers })));
      const bodies = await Promise.all(responses.map(response => response.json().catch(() => ({})) as Promise<Record<string, unknown>>));
      const failures = responses.map((response, index) => !response.ok ? `${["프로젝트", "제품·공정", "원료 인벤토리", "LCIA 결과"][index]} ${response.status}` : "").filter(Boolean);
      if (failures.length) throw new Error(`조회 실패: ${failures.join(", ")}`);
      setProjects(rows(bodies[0].items).map(item => ({ id: text(item, "id", "projectId"), name: text(item, "name", "projectName", "id"), site: text(item, "site", "siteName"), period: text(item, "period", "periodStart", "reportingPeriod") })).filter(item => item.id));
      setProcessRecords(rows(bodies[1].records) as Workspace[]);
      setMaterialRecords(rows(bodies[2].records) as Workspace[]);
      setAssessments(rows(bodies[3].records) as Workspace[]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "기여도 자료를 조회하지 못했습니다."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const project = projects.find(item => item.id === projectId);
  const productRecord = processRecords.find(item => projectOf(item) === projectId);
  const productData = payloadOf(productRecord);
  const materialRecord = materialRecords.find(item => projectOf(item) === projectId);
  const materialData = payloadOf(materialRecord);
  const materials = useMemo(() => [...rows(materialData.materials), ...rows(productData.materials), ...rows(productData.materialInputs), ...rows(productData.rawMaterials)], [materialRecord?.version, productRecord?.version]);
  const projectAssessments = assessments.filter(item => projectOf(item) === projectId).sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  useEffect(() => { setAssessmentId(current => projectAssessments.some(item => String(item.workspaceId || "") === current) ? current : String(projectAssessments[0]?.workspaceId || "")); }, [projectId, assessments]);
  const assessment = projectAssessments.find(item => String(item.workspaceId || "") === assessmentId) || projectAssessments[0];
  const assessmentData = payloadOf(assessment);
  const lciVersion = text(assessmentData, "inputLciVersion", "inventoryVersion");
  const categoryOptions = useMemo(() => [...new Set(rows(assessmentData.impactCategories ?? assessmentData.categoryResults ?? assessmentData.results ?? assessmentData.impactResults).map(item => text(item, "categoryName", "impactCategory", "category", "name")).filter(Boolean))], [assessment?.workspaceId, assessment?.version]);
  const allResults = useMemo(() => contributionRows(assessment, materials, category), [assessment?.workspaceId, assessment?.version, materialRecord?.version, productRecord?.version, category]);
  const filtered = allResults.filter(item => !query || `${item.name} ${item.id} ${item.process} ${item.evidence}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const selected = filtered.find(item => item.id === selectedId) || filtered[0];
  const href = (path: string) => { const url = new URL(path, location.origin); if (projectId) url.searchParams.set("projectId", projectId); return url.pathname + url.search; };
  function selectProject(id: string) { setProjectId(id); setCategory(""); setAssessmentId(""); setSelectedId(""); const url = new URL(location.href); id ? url.searchParams.set("projectId", id) : url.searchParams.delete("projectId"); history.replaceState(null, "", url); }
  function exportEvidence() {
    if (!project || !filtered.length) return;
    const snapshot = { schema: "ccus.lca.material-contribution-review.v1", createdAt: new Date().toISOString(), project, assessmentVersion: assessment?.version ?? null, assessmentRunId: text(assessmentData, "assessmentRunId", "runId", "calculationId") || null, inputLciVersion: lciVersion || null, impactCategory: category || null, materialContributions: filtered, note: "서버에 저장된 원료별 기여 결과입니다. 원료 투입량으로 환경영향 기여율을 추정하지 않았습니다." };
    const link = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = link; anchor.download = `${project.id}-material-contribution.json`; anchor.click(); URL.revokeObjectURL(link);
  }

  return <main className="mx-auto max-w-[1440px] px-4 py-7 text-[#052b57]" data-testid="lca-material-contribution-page">
    <nav aria-label="현재 위치" className="mb-4 text-sm"><a className="underline" href="/emission/lca?menu=H1030101">제품 LCA</a>　›　<a className="underline" href={href("/lca/impact-assessment")}>LCIA 영향평가</a>　›　<strong>원료별 기여도</strong></nav>
    <header className="flex flex-wrap items-end justify-between gap-5 rounded-lg border border-blue-200 bg-blue-50 p-6"><div><p className="font-bold text-blue-800">제품 LCA · 결과 분석 · H1030304</p><h1 className="mt-1 text-3xl font-black">원료별 기여도</h1><p className="mt-2 max-w-4xl">선택한 LCIA 결과에서 원료·보조재별 영향값과 저장된 기여율을 확인하고, 입력 인벤토리와 근거를 추적합니다.</p></div><label className="min-w-80 font-bold">분석 프로젝트<select aria-label="분석 프로젝트" className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={projectId} onChange={event => selectProject(event.target.value)}><option value="">프로젝트 선택</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label></header>
    {error && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4">{error}</p>}
    <section className="mt-4 rounded-lg border bg-white p-5" aria-label="분석 조건"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="font-bold">LCIA 결과 버전<select aria-label="LCIA 결과 버전" className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={assessmentId} onChange={event => { setAssessmentId(event.target.value); setCategory(""); setSelectedId(""); }} disabled={!projectAssessments.length}><option value="">{projectAssessments.length ? "결과 버전을 선택하세요" : "저장된 LCIA 결과 없음"}</option>{projectAssessments.map(item => <option key={item.workspaceId || item.version} value={String(item.workspaceId || "")}>LCIA v{item.version ?? "—"} · {item.workflowStatus || "상태 미확인"}</option>)}</select></label><label className="font-bold">영향범주<select aria-label="영향범주" className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={category} onChange={event => { setCategory(event.target.value); setSelectedId(""); }} disabled={!categoryOptions.length}><option value="">전체 범주</option>{categoryOptions.map(item => <option key={item}>{item}</option>)}</select></label><label className="font-bold">원료 검색<input aria-label="원료 검색" className="mt-2 block min-h-11 w-full rounded border border-slate-300 px-3 font-normal" value={query} onChange={event => setQuery(event.target.value)} placeholder="원료명·공정·근거" /></label><div className="flex items-end gap-2"><button type="button" onClick={() => void load()} className="min-h-11 rounded border border-blue-700 px-4 font-bold text-blue-900">새로고침</button><button type="button" onClick={exportEvidence} disabled={!filtered.length} className="min-h-11 rounded bg-[#003b88] px-4 font-bold text-white disabled:opacity-50">근거 내보내기</button></div></div></section>
    {project && <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="선택 분석 범위">{[["프로젝트", project.name, `${project.id} · ${project.site || "사업장 미기록"}`], ["입력 LCI 버전", lciVersion ? `v${lciVersion}` : "미연결", text(assessmentData, "inputLciWorkspaceId") || "고정된 LCI 결과 식별자 없음"], ["LCIA 결과", `v${assessment?.version ?? "—"} · ${assessment?.workflowStatus || "결과 없음"}`, `실행 ID ${text(assessmentData, "assessmentRunId", "runId", "calculationId") || "미기록"}`], ["분석 데이터", filtered.length ? `${filtered.length}개 원료 결과` : "원료 결과 없음", materials.length ? `원료 인벤토리 ${materials.length}행` : "저장된 원료 인벤토리 없음"]].map(([label, value, detail]) => <article key={label} className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">{label}</p><strong>{value}</strong><p className="text-xs text-slate-500">{detail}</p></article>)}</section>}
    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="overflow-hidden rounded-lg border bg-white"><div className="border-b p-5"><p className="text-sm font-bold text-blue-800">분석 결과</p><h2 className="mt-1 text-xl font-black">원료별 환경영향 기여</h2><p className="mt-1 text-sm text-slate-600">선택한 범주와 LCIA 버전에 저장된 결과를 보여줍니다. 기여율이 저장되지 않은 행은 계산해 채우지 않습니다.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-slate-100"><tr>{["원료", "구분", "사용 공정", "투입량", "영향범주", "영향량", "단위", "기여율", "근거"].map(label => <th key={label} className="border-b p-3 text-left">{label}</th>)}</tr></thead><tbody>{filtered.length ? filtered.map(item => <tr key={`${item.id}-${item.category}`} className={selected?.id === item.id ? "bg-blue-50" : "hover:bg-slate-50"}><td className="border-b p-3"><button type="button" onClick={() => setSelectedId(item.id)} className="font-bold text-blue-800 underline">{item.name}</button><div className="text-xs text-slate-500">{item.id}</div></td><td className="border-b p-3">{item.kind}</td><td className="border-b p-3">{item.process}</td><td className="border-b p-3">{item.quantity || "미기록"} {item.quantityUnit}</td><td className="border-b p-3">{item.category}</td><td className="border-b p-3 font-bold">{item.value || "미기록"}</td><td className="border-b p-3">{item.unit || "미기록"}</td><td className="border-b p-3">{item.share || "미기록"}</td><td className="border-b p-3">{item.evidence || "근거 연결 없음"}</td></tr>) : <tr><td colSpan={9} className="p-12 text-center"><strong className="block">{loading ? "원료 기여 자료를 불러오는 중입니다." : !project ? "프로젝트를 선택하세요." : !assessment ? "저장된 LCIA 결과가 없습니다." : "저장된 원료별 영향 기여 결과가 없습니다."}</strong><span className="mt-2 block text-sm text-slate-600">{assessment ? "LCIA 결과에 materialId, 범주별 영향량, 단위, 기여율과 원천 근거가 저장되어야 표시할 수 있습니다." : "LCIA 영향평가를 완료한 뒤 저장된 결과 버전을 선택하세요."}</span></td></tr>}</tbody></table></div></div>
      <aside className="rounded-lg border bg-white p-5"><p className="text-sm font-bold text-blue-800">선택 원료 상세</p>{selected ? <><h2 className="mt-1 text-xl font-black">{selected.name}</h2><dl className="mt-4 space-y-3 text-sm">{[["식별자·구분", `${selected.id} · ${selected.kind}`], ["사용 공정", selected.process], ["투입량", `${selected.quantity || "미기록"} ${selected.quantityUnit}`], ["영향 결과", `${selected.category} · ${selected.indicator || "지표 미기록"}`], ["영향량·기여율", `${selected.value || "미기록"} ${selected.unit} · ${selected.share || "미기록"}`], ["입력 LCI 버전", selected.lciVersion || lciVersion || "미기록"], ["데이터셋·근거", selected.evidence || "결과에 근거 식별자가 없습니다."]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="break-all font-bold">{value}</dd></div>)}</dl></> : <p className="mt-4 text-sm text-slate-600">원료 결과 행을 선택하면 연결된 인벤토리와 계산 근거를 확인할 수 있습니다.</p>}
      {materials.length > 0 && <div className="mt-5 border-t pt-4"><h3 className="font-bold">저장된 원료·보조재</h3><ul className="mt-2 max-h-64 space-y-2 overflow-auto">{materials.map((item, index) => <li key={text(item, "id", "materialId") || index} className="rounded bg-slate-50 p-2 text-sm"><strong>{text(item, "name", "materialName") || "원료명 미기록"}</strong><p className="text-xs text-slate-600">{text(item, "type", "kind") || "구분 미기록"} · {text(item, "quantity", "amount") || "수량 미기록"} {text(item, "unit")} · {text(item, "processName") || "공정 미기록"}</p></li>)}</ul></div>}</aside></section>
    <nav className="mt-5 flex flex-wrap gap-3" aria-label="LCA 결과 분석 이동"><a className="rounded border bg-white p-3 font-bold underline" href={href("/lca/process-contribution-analysis")}>이전: 공정별 기여도</a><a className="rounded border bg-white p-3 font-bold underline" href={href("/lca/impact-assessment")}>LCIA 결과 확인</a><a className="rounded border bg-white p-3 font-bold underline" href={href("/lca/interpretation")}>다음: 결과 해석·개선안</a></nav>
    <details className="mt-5 rounded border bg-white p-4"><summary className="cursor-pointer font-bold">도움말 · 완료 기준 · QA</summary><div className="mt-3 grid gap-4 md:grid-cols-3"><p><strong>업무 순서</strong><br/>프로젝트 선택 → 저장된 LCIA 버전 선택 → 영향범주 확인 → 원료 결과와 근거 검토 → 개선 업무 연결.</p><p><strong>완료 기준</strong><br/>원료 식별자, 공정, 투입량 단위, 영향범주, 영향량 단위, 기여율, LCI 버전, 데이터 출처가 결과 버전과 연결되어야 합니다.</p><p><strong>계산 원칙</strong><br/>원료 투입량 점유율을 환경영향 기여율로 간주하지 않습니다. 서버의 LCIA 원료별 결과만 기여값으로 표시합니다.</p><p className="md:col-span-3"><strong>QA 확인</strong><br/>LCIA와 LCI 버전 연결, 범주·단위 일치, 원료 ID와 투입 인벤토리 대조, 근거 추적 가능성을 확인합니다.</p></div></details>
  </main>;
}
