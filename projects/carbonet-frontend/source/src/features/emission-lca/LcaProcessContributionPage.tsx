import { useCallback, useEffect, useMemo, useState } from "react";

type Project = { id: string; name: string; site: string; period: string };
type WorkspaceRecord = { workspaceId?: string; version?: number; workflowStatus?: string; updatedAt?: string; payload?: unknown };
type ProcessRow = { id: string; name: string; sequence?: number; category: string; indicator: string; value: string; unit: string; share: string; evidence: string; sourceVersion: string };
const PROJECTS_API = "/home/api/emission-projects?page=1&size=100";
const WORKSPACE_API = "/admin/api/admin/lca-workspaces";

function dataOf(record?: WorkspaceRecord): Record<string, unknown> {
  if (record?.payload && typeof record.payload === "object") return record.payload as Record<string, unknown>;
  if (typeof record?.payload === "string") { try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; } }
  return {};
}
function textOf(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) if (row[key] !== null && row[key] !== undefined && String(row[key]).trim()) return String(row[key]);
  return "";
}
function arrayOf(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object") : []; }
function getProjectId(record: WorkspaceRecord) { return textOf(dataOf(record), "projectId", "project_id"); }
function toProcessRows(record: WorkspaceRecord | undefined, processes: Record<string, unknown>[], category: string): ProcessRow[] {
  const p = dataOf(record);
  const rawRows = [p.processContributions, p.processContributionResults, p.processResults, p.processBreakdown, p.processImpactResults, p.contributions].flatMap(arrayOf);
  for (const result of arrayOf(p.impactCategories ?? p.categoryResults ?? p.results ?? p.impactResults)) {
    const categoryName = textOf(result, "categoryName", "impactCategory", "category", "name");
    if (!category || categoryName === category) rawRows.push(...[result.processContributions, result.processResults, result.contributions, result.processBreakdown].flatMap(arrayOf).map(row => ({ ...row, __category: textOf(row, "categoryName", "impactCategory", "category") || categoryName })));
  }
  const processMap = new Map(processes.map(row => [textOf(row, "processId", "id", "code"), row]));
  return rawRows.flatMap((row, index) => {
    const rowCategory = textOf(row, "categoryName", "impactCategory", "category", "__category");
    if (category && rowCategory !== category) return [];
    const id = textOf(row, "processId", "processCode", "process_id", "id");
    const process = processMap.get(id) || {};
    const value = textOf(row, "contributionValue", "characterizedValue", "impactValue", "value", "result", "score");
    const share = textOf(row, "contributionPercent", "contributionRate", "sharePercent", "percentage", "share");
    return [{
      id: id || `RESULT-${index + 1}`,
      name: textOf(row, "processName", "name", "process", "stageName") || textOf(process, "name", "processName") || "이름 미기록 공정",
      sequence: Number(row.sequence ?? process.sequence ?? index + 1),
      category: rowCategory || category || "전체 범주",
      indicator: textOf(row, "indicator", "indicatorName", "midpointIndicator"),
      value,
      unit: textOf(row, "unit", "resultUnit", "impactUnit"),
      share: share ? (share.endsWith("%") ? share : `${share}%`) : "",
      evidence: textOf(row, "evidenceRef", "sourceRef", "evidence", "activityDataRef"),
      sourceVersion: textOf(row, "lciVersion", "inputVersion", "inventoryVersion"),
    }];
  }).sort((a, b) => a.sequence - b.sequence);
}

export function LcaProcessContributionPage() {
  const requestedProject = new URLSearchParams(location.search).get("projectId") || "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [processRecords, setProcessRecords] = useState<WorkspaceRecord[]>([]);
  const [impactRecords, setImpactRecords] = useState<WorkspaceRecord[]>([]);
  const [projectId, setProjectId] = useState(requestedProject);
  const [assessmentId, setAssessmentId] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const urls = [PROJECTS_API, `${WORKSPACE_API}/LCA_PRODUCT_PROCESS`, `${WORKSPACE_API}/LCA_IMPACT_ASSESSMENT`];
      const responses = await Promise.all(urls.map(url => fetch(url, { credentials: "include", cache: "no-store", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } })));
      const bodies = await Promise.all(responses.map(response => response.json().catch(() => ({})) as Promise<Record<string, unknown>>));
      const failed = responses.map((response, index) => !response.ok ? `${["프로젝트", "공정 정보", "영향평가 결과"][index]} (${response.status})` : "").filter(Boolean);
      if (failed.length) throw new Error(`자료 조회 권한 또는 API 오류: ${failed.join(", ")}`);
      setProjects(arrayOf(bodies[0].items).map(row => ({ id: textOf(row, "id", "projectId"), name: textOf(row, "name", "projectName", "id"), site: textOf(row, "site", "siteName"), period: textOf(row, "period", "periodStart", "reportingPeriod") })).filter(row => row.id));
      setProcessRecords(arrayOf(bodies[1].records) as WorkspaceRecord[]);
      setImpactRecords(arrayOf(bodies[2].records) as WorkspaceRecord[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "기여도 자료를 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const project = projects.find(row => row.id === projectId);
  const projectProcessRecord = processRecords.find(record => getProjectId(record) === projectId);
  const productPayload = dataOf(projectProcessRecord);
  const product = productPayload.product && typeof productPayload.product === "object" ? productPayload.product as Record<string, unknown> : {};
  const processes = arrayOf(productPayload.processes).sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
  const assessments = impactRecords.filter(record => getProjectId(record) === projectId).sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  useEffect(() => { setAssessmentId(current => assessments.some(row => String(row.workspaceId || "") === current) ? current : String(assessments[0]?.workspaceId || "")); }, [projectId, impactRecords]);
  const assessment = assessments.find(record => String(record.workspaceId || "") === assessmentId) || assessments[0];
  const assessmentPayload = dataOf(assessment);
  const lciId = textOf(assessmentPayload, "inputLciWorkspaceId");
  const lciVersion = textOf(assessmentPayload, "inputLciVersion", "inventoryVersion");
  const categoryOptions = useMemo(() => [...new Set(arrayOf(assessmentPayload.impactCategories ?? assessmentPayload.categoryResults ?? assessmentPayload.results ?? assessmentPayload.impactResults).map(row => textOf(row, "categoryName", "impactCategory", "category", "name")).filter(Boolean))], [assessment?.workspaceId, assessment?.version]);
  const rows = useMemo(() => toProcessRows(assessment, processes, category).filter(row => !query || `${row.name} ${row.id} ${row.evidence}`.toLowerCase().includes(query.toLowerCase())), [assessment?.workspaceId, assessment?.version, projectProcessRecord?.workspaceId, category, query]);
  const selected = rows.find(row => row.id === selectedId) || rows[0];
  const hasBreakdown = rows.length > 0;
  const link = (path: string) => { const url = new URL(path, location.origin); if (projectId) url.searchParams.set("projectId", projectId); return `${url.pathname}${url.search}`; };
  function chooseProject(id: string) { setProjectId(id); setCategory(""); setAssessmentId(""); setSelectedId(""); const url = new URL(location.href); id ? url.searchParams.set("projectId", id) : url.searchParams.delete("projectId"); history.replaceState(null, "", url); }
  function exportData() {
    if (!project) return;
    const snapshot = { schema: "ccus.lca.process-contribution-review.v1", createdAt: new Date().toISOString(), project, assessmentVersion: assessment?.version ?? null, assessmentRunId: textOf(assessmentPayload, "assessmentRunId", "runId", "calculationId") || null, inputLciWorkspaceId: lciId || null, inputLciVersion: lciVersion || null, impactCategory: category || null, processContributions: rows, note: "서버에 저장된 공정별 기여도 검토 자료입니다. 화면에서 기여율 또는 산출값을 계산하지 않았습니다." };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }); const href = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = href; anchor.download = `${project.id}-process-contribution.json`; anchor.click(); URL.revokeObjectURL(href);
  }

  return <main className="mx-auto max-w-[1440px] px-4 py-7 text-[#052b57]" data-testid="lca-process-contribution-page">
    <nav aria-label="현재 위치" className="mb-4 text-sm"><a className="underline" href="/emission/lca?menu=H1030101">제품 LCA</a>　›　<a className="underline" href={link("/lca/impact-assessment")}>LCIA 영향평가</a>　›　<strong>공정별 기여도</strong></nav>
    <header className="flex flex-wrap items-end justify-between gap-5 rounded-lg border border-blue-200 bg-blue-50 p-6"><div><p className="font-bold text-blue-800">제품 LCA · 결과 분석 · H1030303</p><h1 className="mt-1 text-3xl font-black">공정별 기여도</h1><p className="mt-2 max-w-4xl">선택한 영향평가 결과에서 공정별 기여값을 확인하고, 원본 공정·입력자료의 근거를 추적합니다.</p></div><label className="min-w-80 font-bold">분석 프로젝트<select aria-label="분석 프로젝트" className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={projectId} onChange={event => chooseProject(event.target.value)}><option value="">프로젝트 선택</option>{projects.map(row => <option key={row.id} value={row.id}>{row.name} · {row.id}</option>)}</select></label></header>
    {error && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4">{error}</p>}
    <section className="mt-4 rounded-lg border bg-white p-5" aria-label="기여도 분석 조건"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="font-bold">영향평가 결과 버전<select className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={assessmentId} onChange={event => { setAssessmentId(event.target.value); setCategory(""); setSelectedId(""); }} disabled={!assessments.length}><option value="">{assessments.length ? "평가 버전을 선택하세요" : "저장된 평가 결과 없음"}</option>{assessments.map(row => <option key={row.workspaceId || row.version} value={String(row.workspaceId || "")}>LCIA v{row.version ?? "—"} · {row.workflowStatus || "상태 미확인"}</option>)}</select></label><label className="font-bold">영향범주<select className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={category} onChange={event => { setCategory(event.target.value); setSelectedId(""); }} disabled={!categoryOptions.length}><option value="">전체 범주</option>{categoryOptions.map(value => <option key={value}>{value}</option>)}</select></label><label className="font-bold">공정 검색<input className="mt-2 block min-h-11 w-full rounded border border-slate-300 px-3 font-normal" value={query} onChange={event => setQuery(event.target.value)} placeholder="공정명·공정 ID·근거" /></label><div className="flex items-end gap-2"><button type="button" onClick={() => void load()} className="min-h-11 rounded border border-blue-700 px-4 font-bold text-blue-900">새로고침</button><button type="button" onClick={exportData} disabled={!project || !hasBreakdown} className="min-h-11 rounded bg-[#003b88] px-4 font-bold text-white disabled:opacity-50">근거 내보내기</button></div></div></section>
    {project && <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="선택한 분석 범위"><article className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">프로젝트</p><strong>{project.name}</strong><p className="text-xs text-slate-500">{project.id} · {project.site || "사업장 정보 없음"}</p></article><article className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">입력 LCI</p><strong>{lciVersion ? `v${lciVersion}` : "버전 미연결"}</strong><p className="text-xs text-slate-500">{lciId || "고정된 LCI 결과 ID 없음"}</p></article><article className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">영향평가</p><strong>LCIA v{assessment?.version ?? "—"} · {assessment?.workflowStatus || "결과 없음"}</strong><p className="text-xs text-slate-500">실행 ID {textOf(assessmentPayload, "assessmentRunId", "runId", "calculationId") || "미기록"}</p></article><article className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">공정 분석</p><strong>{hasBreakdown ? `${rows.length}개 기여 결과` : `${processes.length}개 공정 정의`}</strong><p className="text-xs text-slate-500">{hasBreakdown ? `${category || "전체 범주"} · 서버 저장값` : "기여 결과 연결 대기"}</p></article></section>}
    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-lg border bg-white"><div className="border-b p-5"><p className="text-sm font-bold text-blue-800">분석 결과</p><h2 className="mt-1 text-xl font-black">공정별 영향 기여</h2><p className="mt-1 text-sm text-slate-600">선택 범주의 저장된 결과만 표시합니다. 공정별 결과가 저장되지 않은 경우 임의 값이나 기여율은 표시하지 않습니다.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-100"><tr>{["순서", "공정", "영향범주", "기여값", "단위", "기여율", "근거"].map(label => <th key={label} className="border-b p-3 text-left">{label}</th>)}</tr></thead><tbody>{hasBreakdown ? rows.map(row => <tr key={`${row.id}-${row.category}`} className={selected?.id === row.id ? "bg-blue-50" : "hover:bg-slate-50"}><td className="border-b p-3">{row.sequence}</td><td className="border-b p-3"><button type="button" onClick={() => setSelectedId(row.id)} className="font-bold text-blue-800 underline">{row.name}</button><div className="text-xs text-slate-500">{row.id}</div></td><td className="border-b p-3">{row.category}</td><td className="border-b p-3 font-bold">{row.value || "미기록"}</td><td className="border-b p-3">{row.unit || "미기록"}</td><td className="border-b p-3">{row.share || "미기록"}</td><td className="border-b p-3">{row.evidence || "자료 연결 없음"}</td></tr>) : <tr><td colSpan={7} className="p-12 text-center"><strong className="block">{loading ? "공정별 기여 자료를 불러오는 중입니다." : !project ? "프로젝트를 선택하세요." : !assessment ? "저장된 LCIA 평가 결과가 없습니다." : processes.length ? "공정 정보는 있지만 공정별 영향 기여 결과가 아직 연결되지 않았습니다." : "이 프로젝트에 저장된 공정 정의가 없습니다."}</strong><span className="mt-2 block text-sm text-slate-600">{!hasBreakdown && assessment ? "LCIA 계산 결과 API가 공정 ID·범주별 기여값·기여율·근거를 저장하면 이 표에 표시됩니다." : ""}</span></td></tr>}</tbody></table></div></div>
      <aside className="rounded-lg border bg-white p-5"><p className="text-sm font-bold text-blue-800">선택 공정 상세</p>{selected ? <><h2 className="mt-1 text-xl font-black">{selected.name}</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-slate-500">공정 식별자</dt><dd className="font-bold">{selected.id}</dd></div><div><dt className="text-slate-500">영향범주·지표</dt><dd className="font-bold">{selected.category} · {selected.indicator || "미기록"}</dd></div><div><dt className="text-slate-500">기여값·기여율</dt><dd className="font-bold">{selected.value || "미기록"} {selected.unit} · {selected.share || "미기록"}</dd></div><div><dt className="text-slate-500">입력 LCI 버전</dt><dd className="font-bold">{selected.sourceVersion || lciVersion || "미기록"}</dd></div><div><dt className="text-slate-500">원본 근거</dt><dd className="break-all font-bold">{selected.evidence || "결과에 근거 식별자가 포함되지 않았습니다."}</dd></div></dl></> : <p className="mt-4 text-sm text-slate-600">공정별 결과 행을 선택하면 영향 기여값과 입력 근거를 확인할 수 있습니다.</p>}
        {projectProcessRecord && <div className="mt-5 border-t pt-4"><h3 className="font-bold">공정 정의 확인</h3><p className="mt-1 text-sm">제품: {textOf(product, "name", "productName") || "미기록"}</p><ol className="mt-2 space-y-2">{processes.map((row, index) => <li key={textOf(row, "processId", "id") || index} className="rounded bg-slate-50 p-2 text-sm"><strong>{Number(row.sequence || index + 1)}. {textOf(row, "name", "processName") || "공정명 미기록"}</strong><p className="text-xs text-slate-600">투입 {textOf(row, "inputName") || "미기록"} → 산출 {textOf(row, "outputName") || "미기록"}</p></li>)}</ol></div>}
      </aside>
    </section>
    <nav className="mt-5 flex flex-wrap gap-3" aria-label="LCA 분석 이동"><a className="rounded border bg-white p-3 font-bold underline" href={link("/lca/impact-assessment")}>이전: LCIA 영향평가</a><a className="rounded border bg-white p-3 font-bold underline" href={link("/lca/contribution-analysis/materials")}>다음: 원료별 기여도</a></nav>
    <details className="mt-5 rounded border bg-white p-4"><summary className="cursor-pointer font-bold">도움말 · 완료 기준 · QA</summary><div className="mt-3 grid gap-4 md:grid-cols-3"><p><strong>업무 순서</strong><br/>프로젝트 선택 → LCIA 결과 버전 고정 → 영향범주 선택 → 공정별 결과·근거 검토 → 개선 의견 기록.</p><p><strong>완료 기준</strong><br/>각 행에 공정 ID, 영향범주, 값과 단위, 기여율, 입력 LCI 버전과 원본 근거가 연결되어야 합니다.</p><p><strong>현재 데이터 한계</strong><br/>현재 연결된 LCIA 저장 데이터에 공정별 결과가 없으면 결과를 만들지 않습니다. 계산 서비스가 공정별 상세값을 저장해야 분석을 완료할 수 있습니다.</p><p className="md:col-span-3"><strong>QA 확인</strong><br/>프로젝트·평가 버전·LCI 버전의 연결, 영향범주 일치, 공정 정의와 기여 결과 대조, 근거 식별자 존재를 검토합니다.</p></div></details>
  </main>;
}
