import { useCallback, useEffect, useMemo, useState } from "react";

type Project = { id: string; name: string; site: string; period: string; status: string };
type WorkspaceRecord = { workspaceId?: string; version?: number; workflowStatus?: string; payload?: unknown; updatedAt?: string; createdAt?: string };
type InventoryRow = { id: string; category: string; name: string; amount: string; unit: string; process: string; evidence: string };
type Check = { label: string; state: "ready" | "missing" | "review"; detail: string; href: string };
type Tab = "work" | "check" | "results" | "history";

const PROJECTS_API = "/home/api/emission-projects?page=1&size=100";
const WORKSPACE = "/admin/api/admin/lca-workspaces";
const WORKSPACE_TYPES = ["LCA_PRODUCT_PROCESS", "LCA_SCOPE", "LCA_DATA_COLLECTION", "LCA_MATERIAL_MAPPING", "LCA_CALCULATION_RESULT"];
const INPUT_GROUPS: Array<[string, string[]]> = [
  ["원료·보조재", ["materials", "materialEntries"]], ["에너지·스팀", ["energyEntries"]],
  ["운송", ["transportEntries"]], ["제품·부산물", ["productOutputEntries"]], ["폐기물·배출물", ["wasteEmissionEntries"]],
];

function payloadOf(record?: WorkspaceRecord): Record<string, unknown> {
  if (record?.payload && typeof record.payload === "object") return record.payload as Record<string, unknown>;
  if (typeof record?.payload === "string") { try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; } }
  return {};
}
function text(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) { const candidate = row[key]; if (candidate !== undefined && candidate !== null && String(candidate).trim()) return String(candidate); }
  return "";
}
function inventoryFrom(record?: WorkspaceRecord): InventoryRow[] {
  const p = payloadOf(record);
  return INPUT_GROUPS.flatMap(([category, keys]) => keys.flatMap(key => Array.isArray(p[key])
    ? (p[key] as Array<Record<string, unknown>>).map((row, index) => ({
      id: text(row, "id", "rowId") || `${category}:${index}:${text(row, "name", "materialName", "productName", "type")}`,
      category, name: text(row, "name", "materialName", "productName", "type", "substance"),
      amount: text(row, "quantity", "amount", "production"), unit: text(row, "unit"),
      process: text(row, "processId", "processName"), evidence: text(row, "evidence", "evidenceUrl", "source"),
    })).filter(row => row.name)
    : []));
}
function isApproved(record?: WorkspaceRecord) { return ["APPROVED", "VALIDATED", "COMPLETED", "LOCKED"].includes(String(record?.workflowStatus || "").toUpperCase()); }
function asRows(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  if (typeof value === "string") { try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((row): row is Record<string, unknown> => !!row && typeof row === "object") : []; } catch { return []; } }
  return [];
}

export function LcaCalculationPage() {
  const requestedProjectId = new URLSearchParams(location.search).get("projectId") || "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(requestedProjectId);
  const [records, setRecords] = useState<Record<string, WorkspaceRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<Tab>("work");

  const load = useCallback(async () => {
    setLoading(true); setError(""); setChecked(false);
    try {
      const urls = [PROJECTS_API, ...WORKSPACE_TYPES.map(type => `${WORKSPACE}/${type}`)];
      const responses = await Promise.all(urls.map(url => fetch(url, { credentials: "include", cache: "no-store", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } })));
      const bodies = await Promise.all(responses.map(response => response.json().catch(() => ({})) as Promise<Record<string, unknown>>));
      if (!responses[0].ok) throw new Error(`프로젝트 목록을 불러오지 못했습니다. 로그인 상태와 프로젝트 조회 권한을 확인해 주세요. (${responses[0].status})`);
      const available = ((bodies[0].items || []) as Array<Record<string, unknown>>).map(row => ({ id: String(row.id || ""), name: String(row.name || row.id || "이름 없음"), site: String(row.site || ""), period: String(row.period || ""), status: String(row.status || "") })).filter(row => row.id);
      const failures = responses.slice(1).map((response, index) => !response.ok ? `${WORKSPACE_TYPES[index]} (${response.status})` : "").filter(Boolean);
      if (failures.length) throw new Error(`저장된 LCA 업무자료를 읽을 권한이 없거나 일시 오류가 있습니다: ${failures.join(", ")}`);
      const next: Record<string, WorkspaceRecord[]> = {};
      WORKSPACE_TYPES.forEach((type, index) => { next[type] = Array.isArray(bodies[index + 1].records) ? bodies[index + 1].records as WorkspaceRecord[] : []; });
      setProjects(available); setRecords(next);
      setProjectId(current => available.some(row => row.id === current) ? current : available.some(row => row.id === requestedProjectId) ? requestedProjectId : "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "산정자료를 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, [requestedProjectId]);

  useEffect(() => { void load(); }, [load]);
  const project = projects.find(row => row.id === projectId);
  const recordsFor = (type: string) => (records[type] || []).filter(record => payloadOf(record).projectId === projectId).sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  const latest = (type: string) => recordsFor(type)[0];
  const processRecord = latest("LCA_PRODUCT_PROCESS");
  const scopeRecord = latest("LCA_SCOPE");
  const collectionRecord = latest("LCA_DATA_COLLECTION");
  const mappingRecord = latest("LCA_MATERIAL_MAPPING");
  const resultRecords = recordsFor("LCA_CALCULATION_RESULT");
  const savedResult = resultRecords[0];
  const inventory = useMemo(() => inventoryFrom(collectionRecord), [collectionRecord]);
  const mappingPayload = payloadOf(mappingRecord);
  const mappingsRaw = mappingPayload.lciMappings ?? mappingPayload.mappingEntries ?? mappingPayload.materialMappings ?? mappingPayload.mappings;
  const mappings = Array.isArray(mappingsRaw) ? mappingsRaw as Array<Record<string, unknown>> : [];
  const mappedIds = new Set(mappings.map(row => text(row, "targetId", "inventoryRowId", "sourceRowId")));
  const mappedCount = inventory.filter(row => mappedIds.has(row.id)).length;
  const unmappedCount = Math.max(0, inventory.length - mappedCount);
  const incompleteInputs = inventory.filter(row => !row.unit.trim() || !Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0 || !row.evidence.trim());
  const scope = payloadOf(scopeRecord);
  const boundary = (scope.boundary && typeof scope.boundary === "object" ? scope.boundary : {}) as Record<string, unknown>;
  const functionalValue = scope.functionalUnit ?? scope.referenceFlow ?? boundary.functionalUnit ?? boundary.referenceFlow;
  const functionalUnit = functionalValue && typeof functionalValue === "object" ? text(functionalValue as Record<string, unknown>, "label", "name", "value", "quantity") : String(functionalValue || "");
  const processPayload = payloadOf(processRecord);
  const processRows = Array.isArray(processPayload.processes) ? processPayload.processes as Array<Record<string, unknown>> : [];
  const outputs = asRows(payloadOf(collectionRecord).productOutputEntries);
  const coProducts = outputs.filter(row => ["공동제품", "부산물", "CO_PRODUCT", "BYPRODUCT"].includes(text(row, "type", "outputType").toUpperCase()));
  const allocationProblems = coProducts.filter(row => { const method = text(row, "allocationMethod"); return !method || method === "해당 없음" || (method === "배분 안 함" && !text(row, "allocationReason")); });
  const resultPayload = payloadOf(savedResult);
  const resultRows = asRows(resultPayload.resultTable ?? resultPayload.lciResults ?? resultPayload.results);
  const checks: Check[] = [
    { label: "제품·공정", state: processRows.length ? (isApproved(processRecord) ? "ready" : "review") : "missing", detail: processRows.length ? `${processRows.length}개 공정 · ${processRecord?.workflowStatus || "상태 확인 필요"}` : "저장된 제품·공정 정의가 없습니다.", href: "/lca/product-process" },
    { label: "목표·범위·기능단위", state: scopeRecord && functionalUnit ? (isApproved(scopeRecord) ? "ready" : "review") : "missing", detail: scopeRecord ? (functionalUnit ? `기능단위 ${functionalUnit} · ${scopeRecord.workflowStatus || "상태 확인 필요"}` : "기능단위 정보가 저장되지 않았습니다.") : "시스템 경계와 범위를 먼저 저장해 주세요.", href: "/lca/functional-unit" },
    { label: "활동자료·단위·증빙", state: inventory.length ? (incompleteInputs.length ? "review" : isApproved(collectionRecord) ? "ready" : "review") : "missing", detail: inventory.length ? `${inventory.length}개 항목 · 수량·단위·증빙 확인 필요 ${incompleteInputs.length}건` : "저장된 활동자료가 없습니다.", href: "/lca/materials" },
    { label: "LCI 데이터 매핑", state: inventory.length && unmappedCount === 0 ? (isApproved(mappingRecord) ? "ready" : "review") : "missing", detail: inventory.length ? `${mappedCount}/${inventory.length}개 연결 · 미연결 ${unmappedCount}개` : "먼저 활동자료를 등록해 주세요.", href: "/lca/data-mapping" },
    { label: "공동제품 배분", state: allocationProblems.length ? "missing" : "ready", detail: coProducts.length ? (allocationProblems.length ? `배분 방법 또는 제외 근거 ${allocationProblems.length}건을 확인해 주세요.` : `${coProducts.length}개 부산물·공동제품의 배분 정보가 있습니다.`) : "배분 대상 공동제품·부산물이 없습니다.", href: "/lca/products-byproducts" },
  ];
  const blockers = checks.filter(row => row.state !== "ready");
  const link = (path: string) => { const url = new URL(path, location.origin); if (projectId) url.searchParams.set("projectId", projectId); return `${url.pathname}${url.search}`; };
  function selectProject(nextId: string) {
    setProjectId(nextId); setChecked(false); setTab("work");
    const next = new URL(location.href); if (nextId) next.searchParams.set("projectId", nextId); else next.searchParams.delete("projectId");
    history.replaceState(null, "", next);
  }
  function exportInputSnapshot() {
    if (!project) return;
    const artifact = { schema: "ccus.lca.calculation-input-snapshot.v1", createdAt: new Date().toISOString(), project: { id: project.id, name: project.name }, sourceVersions: Object.fromEntries(WORKSPACE_TYPES.map(type => [type, latest(type)?.version ?? null])), functionalUnit: functionalUnit || null, inventory: inventory.map(row => ({ ...row, mapped: mappedIds.has(row.id) })), note: "산정 입력자료 사본입니다. 계산 결과가 아니며 서버에 저장되지 않습니다." };
    const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = href; anchor.download = `${project.id}-lci-input.json`; anchor.click(); URL.revokeObjectURL(href);
  }

  const statusClass = (state: Check["state"]) => state === "ready" ? "bg-emerald-100 text-emerald-900" : state === "missing" ? "bg-amber-100 text-amber-900" : "bg-blue-100 text-blue-900";
  const labelFor = (state: Check["state"]) => state === "ready" ? "확인" : state === "missing" ? "자료 필요" : "검토 필요";
  const tabButton = (id: Tab, label: string) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-11 border-b-2 px-4 font-bold ${tab === id ? "border-blue-800 text-blue-900" : "border-transparent text-slate-600 hover:text-blue-900"}`}>{label}</button>;

  return <main className="mx-auto max-w-[1500px] px-4 py-6 text-[#052b57]" data-testid="lca-calculation-page">
    <nav aria-label="현재 위치" className="mb-4 text-sm"><a className="underline" href="/emission/lca?menu=H1030101">제품 LCA</a>　›　인벤토리·매핑　›　<strong>LCI 산정</strong></nav>
    <header className="flex flex-wrap items-end justify-between gap-5 rounded-lg border border-blue-200 bg-blue-50 p-5"><div><p className="font-bold text-blue-800">제품 LCA · 산정 · H1030301</p><h1 className="mt-1 text-3xl font-black">LCI 산정</h1><p className="mt-2 max-w-4xl">프로젝트의 기준 흐름과 공정별 투입·산출자료, LCI 데이터 연결을 검토하고 저장된 산정 결과를 확인합니다.</p></div><label className="min-w-80 font-bold">프로젝트 선택<select aria-label="산정 프로젝트 선택" className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3" value={projectId} onChange={event => selectProject(event.target.value)}><option value="">프로젝트 선택</option>{projects.map(row => <option key={row.id} value={row.id}>{row.name} · {row.id}</option>)}</select></label></header>
    {error && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4">{error}</p>}
    {loading && <p role="status" className="mt-4 rounded border bg-white p-4">프로젝트와 산정자료를 불러오는 중입니다…</p>}
    {!loading && !projectId && !error && <section className="mt-4 rounded-lg border bg-white p-8"><h2 className="text-xl font-black">산정을 시작할 프로젝트를 선택해 주세요</h2><p className="mt-2 text-slate-700">프로젝트를 고르면 공정·기능단위·활동자료·LCI 연결과 저장 결과가 이 화면에 표시됩니다. 선택 전에는 진행 건수나 보완 경고를 표시하지 않습니다.</p><div className="mt-5 flex flex-wrap gap-3"><a className="rounded border border-blue-700 px-4 py-3 font-bold text-blue-900 underline" href="/emission/project_list">프로젝트 목록</a><a className="rounded border px-4 py-3 font-bold underline" href="/lca/product-process">제품·공정 정의</a><a className="rounded border px-4 py-3 font-bold underline" href="/lca/data-mapping">LCI 데이터 매핑</a></div></section>}
    {project && <>
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="선택 프로젝트 개요">{[["프로젝트", `${project.name} · ${project.id}`], ["사업장·기간", [project.site, project.period].filter(Boolean).join(" · ") || "저장 정보 없음"], ["기능단위", functionalUnit || "기능단위 미등록"], ["입력 버전", `활동자료 v${collectionRecord?.version ?? "—"} · 매핑 v${mappingRecord?.version ?? "—"}`]].map(([label, value]) => <article key={label} className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">{label}</p><strong className="mt-1 block">{value}</strong></article>)}</section>
      <section className="mt-4 rounded-lg border bg-white" aria-label="산정 진행 요약"><div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">{[["인벤토리 항목", `${inventory.length}건`], ["LCI 연결", `${mappedCount}건`], ["미연결", `${unmappedCount}건`], ["자료 보완", `${incompleteInputs.length}건`], ["저장 산정 버전", `${resultRecords.length}건`]].map(([label, value]) => <div key={label} className="rounded bg-slate-50 p-3"><p className="text-sm text-slate-600">{label}</p><strong className="mt-1 block text-xl">{value}</strong></div>)}</div></section>
      <section className="mt-4 overflow-hidden rounded-lg border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4"><div role="tablist" aria-label="LCI 산정 작업 탭" className="flex flex-wrap">{tabButton("work", "산정 대상")}{tabButton("check", "검증")}{tabButton("results", "산정 결과")}{tabButton("history", "실행 이력·버전")}</div><div className="flex flex-wrap gap-2 py-2"><button type="button" onClick={() => void load()} className="min-h-10 rounded border border-blue-700 px-3 font-bold text-blue-900">새로고침</button><button type="button" onClick={() => setChecked(true)} className="min-h-10 rounded border border-blue-700 px-3 font-bold text-blue-900">입력 검사</button><button type="button" onClick={exportInputSnapshot} className="min-h-10 rounded border border-blue-700 px-3 font-bold text-blue-900">입력 사본 다운로드</button><button type="button" disabled title="프로젝트별 LCI 실행과 결과 저장을 지원하는 계산 기능이 아직 연결되지 않았습니다." className="min-h-10 rounded bg-slate-300 px-4 font-bold text-slate-700">LCI 산정 실행</button></div></div>
        {tab === "work" && <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.65fr)]"><article className="overflow-hidden rounded-lg border"><div className="border-b p-4"><h2 className="text-xl font-black">공정별 투입·산출 인벤토리</h2><p className="mt-1 text-sm text-slate-600">수량·단위·증빙·LCI 연결을 확인합니다. 이 목록은 산정 결과가 아닙니다.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="bg-slate-100"><tr>{["흐름 구분", "항목", "공정", "수량", "단위", "증빙", "LCI 연결"].map(label => <th key={label} className="border-b p-3 text-left">{label}</th>)}</tr></thead><tbody>{inventory.map(row => { const mapped = mappedIds.has(row.id); const evidenceUrl = /^https?:\/\//i.test(row.evidence) ? row.evidence : ""; return <tr key={row.id}><td className="border-b p-3">{row.category}</td><td className="border-b p-3 font-bold">{row.name}</td><td className="border-b p-3">{row.process || "공정 미지정"}</td><td className="border-b p-3">{row.amount || "미입력"}</td><td className="border-b p-3">{row.unit || "미입력"}</td><td className="border-b p-3">{evidenceUrl ? <a className="text-blue-800 underline" href={evidenceUrl} target="_blank" rel="noreferrer">증빙 열기</a> : row.evidence ? "증빙 확인" : "미첨부"}</td><td className="border-b p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${mapped ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{mapped ? "연결됨" : "미연결"}</span></td></tr>; })}{!inventory.length && <tr><td colSpan={7} className="p-10 text-center text-slate-600">저장된 활동자료가 없습니다. 활동자료 입력 화면에서 자료를 저장하면 여기에 표시됩니다.</td></tr>}</tbody></table></div><div className="flex flex-wrap gap-3 border-t p-4"><a className="font-bold text-blue-800 underline" href={link("/emission/data_input")}>활동자료 입력 열기 →</a><a className="font-bold text-blue-800 underline" href={link("/lca/data-mapping")}>LCI 데이터 연결 검토 →</a></div></article>
          <aside className="space-y-4"><article className="rounded-lg border p-4"><h2 className="text-lg font-black">공정·기준 흐름</h2><p className="mt-1 text-sm text-slate-600">기능단위와 공정 연결은 저장된 설계값을 사용합니다.</p><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt>제품·공정</dt><dd className="font-bold">{processRows.length}개</dd></div><div className="flex justify-between gap-3"><dt>기능단위</dt><dd className="font-bold">{functionalUnit || "미등록"}</dd></div><div className="flex justify-between gap-3"><dt>공동제품·부산물</dt><dd className="font-bold">{coProducts.length}개</dd></div></dl><div className="mt-4 flex flex-col gap-2"><a className="font-bold text-blue-800 underline" href={link("/lca/product-process")}>제품·공정 정보 수정 →</a><a className="font-bold text-blue-800 underline" href={link("/lca/functional-unit")}>기능단위 확인 →</a><a className="font-bold text-blue-800 underline" href={link("/lca/products-byproducts")}>배분 기준 확인 →</a></div></article>
            <article className="rounded-lg border border-amber-300 bg-amber-50 p-4"><h2 className="text-lg font-black">계산 상태</h2><p className="mt-2 text-sm">입력과 연결 자료를 확인할 수 있습니다. 이 프로젝트의 계산 실행과 결과 저장은 아직 제공되지 않아 산정 실행이 비활성화되어 있습니다.</p><p className="mt-2 text-xs text-slate-700">계산 결과를 만들려면 서버 계산 기능이 연결되어야 합니다. 입력 자료만으로 결과 수치를 표시하지 않습니다.</p></article></aside></div>}
        {tab === "check" && <div className="p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">산정 전 검증</h2><p className="mt-1 text-sm text-slate-600">선택 프로젝트에 저장된 최신 자료 기준입니다.</p></div>{checked && <p role="status" className="rounded bg-blue-50 px-3 py-2 text-sm font-bold">확인 필요 {blockers.length}건</p>}</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{checks.map((row, index) => <article key={row.label} className="rounded-lg border p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-bold">{index + 1}. {row.label}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(row.state)}`}>{labelFor(row.state)}</span></div><p className="mt-2 text-sm text-slate-700">{row.detail}</p><a className="mt-3 inline-block text-sm font-bold text-blue-800 underline" href={link(row.href)}>해당 자료 열기 →</a></article>)}</div>{checked && <div role="alert" className="mt-4 rounded border border-amber-300 bg-amber-50 p-4"><strong>산정 실행 전 확인 {blockers.length}건</strong><p className="mt-1 text-sm">검증 결과를 해소해도 서버 계산 기능이 연결되기 전에는 계산을 실행할 수 없습니다.</p></div>}</div>}
        {tab === "results" && <div className="p-4"><div className="mb-4"><h2 className="text-xl font-black">저장된 LCI 산정 결과</h2><p className="mt-1 text-sm text-slate-600">선택 프로젝트의 서버 저장 결과 버전만 표시합니다. 결과가 없으면 0으로 대신하지 않습니다.</p></div>{savedResult && <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["결과 버전", `v${savedResult.version ?? "—"}`], ["상태", savedResult.workflowStatus || "확인 필요"], ["기준 수량", text(resultPayload, "referenceAmount") || "미기록"], ["정규화", text(resultPayload, "normalizationMethod") || "미기록"]].map(([label, value]) => <article key={label} className="rounded border bg-slate-50 p-3"><p className="text-sm text-slate-600">{label}</p><strong>{value}</strong></article>)}</div>}<div className="overflow-x-auto rounded border"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-100"><tr>{["흐름·구분", "항목", "공정", "수량", "단위"].map(label => <th key={label} className="border-b p-3 text-left">{label}</th>)}</tr></thead><tbody>{resultRows.map((row, index) => <tr key={`${text(row, "id", "flowId", "name")}-${index}`}><td className="border-b p-3">{text(row, "category", "flowType") || "미분류"}</td><td className="border-b p-3 font-bold">{text(row, "flowName", "name", "materialName", "productName") || "이름 없음"}</td><td className="border-b p-3">{text(row, "processName", "processId") || "—"}</td><td className="border-b p-3">{text(row, "quantity", "amount", "value") || "—"}</td><td className="border-b p-3">{text(row, "unit") || "—"}</td></tr>)}{!resultRows.length && <tr><td colSpan={5} className="p-10 text-center text-slate-600">{savedResult ? "저장 버전은 있으나 표시 가능한 결과 행이 없습니다." : "이 프로젝트에 저장된 LCI 산정 결과가 없습니다."}</td></tr>}</tbody></table></div></div>}
        {tab === "history" && <div className="p-4"><h2 className="text-xl font-black">산정 실행 이력·버전</h2><p className="mt-1 text-sm text-slate-600">결과 작업공간에 저장된 프로젝트별 버전 순서입니다.</p><div className="mt-4 overflow-x-auto rounded border"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-100"><tr>{["버전", "상태", "실행 식별자", "입력 해시", "저장 시각"].map(label => <th key={label} className="border-b p-3 text-left">{label}</th>)}</tr></thead><tbody>{resultRecords.map((record, index) => { const p = payloadOf(record); return <tr key={`${record.workspaceId || "result"}-${record.version || index}`}><td className="border-b p-3 font-bold">v{record.version ?? "—"}</td><td className="border-b p-3">{record.workflowStatus || "상태 미기록"}</td><td className="border-b p-3">{text(p, "calculationRunId", "runId", "calculationId") || "미기록"}</td><td className="border-b p-3">{text(p, "inputHash", "calculationHash") || "미기록"}</td><td className="border-b p-3">{record.updatedAt || record.createdAt || "시각 미기록"}</td></tr>; })}{!resultRecords.length && <tr><td colSpan={5} className="p-10 text-center text-slate-600">저장된 산정 실행 이력이 없습니다.</td></tr>}</tbody></table></div></div>}
      </section>
      <nav className="mt-4 flex flex-wrap gap-3" aria-label="LCA 산정 단계"><a className="rounded border bg-white p-3 font-bold underline" href={link("/lca/data-mapping")}>이전: LCI 데이터 매핑</a><a className="rounded border bg-white p-3 font-bold underline" href={link("/lca/impact-assessment")}>다음: LCIA 영향평가</a><a className="rounded border bg-white p-3 font-bold underline" href={link("/emission/lca?menu=H1030303")}>공정별 기여도</a></nav>
      <details className="mt-4 rounded border bg-white p-4"><summary className="cursor-pointer font-bold">도움말 · 업무 순서 · 완료 기준 · QA</summary><div className="mt-3 grid gap-4 md:grid-cols-3"><section><h2 className="font-bold">업무 순서</h2><p>프로젝트 선택 → 제품·공정·기능단위 확인 → 활동자료와 LCI 매핑 확인 → 검증 → 계산 실행 → 저장 결과와 실행 이력 확인.</p></section><section><h2 className="font-bold">완료 기준</h2><p>모든 인벤토리 행의 수량·단위·증빙과 매핑이 확인되고, 필요한 공동제품 배분을 검토한 뒤 서버에 결과 버전·실행 ID·입력 해시가 저장되어야 합니다.</p></section><section><h2 className="font-bold">현재 상태</h2><p>프로젝트 자료 확인과 저장 결과 조회까지 제공합니다. 실제 계산 실행·저장은 서버 계산 기능 연결 후 활성화해야 합니다.</p></section></div></details>
    </>}
  </main>;
}
