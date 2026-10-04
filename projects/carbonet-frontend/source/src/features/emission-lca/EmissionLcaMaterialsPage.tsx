import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type Project = { id: string; name: string };
type Process = { id: string; name: string };
type Material = { id: string; processId: string; name: string; type: string; quantity: string; unit: string; supplier: string; origin: string; recycledPercent: string; source: string; evidence: string };
type RecordItem = { payload?: unknown; version?: number };
const fresh = (): Material => ({ id: globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)), processId: "", name: "", type: "원료", quantity: "", unit: "", supplier: "", origin: "", recycledPercent: "", source: "", evidence: "" });
function bodyOf(record?: RecordItem): Record<string, unknown> {
  if (record?.payload && typeof record.payload === "object") return record.payload as Record<string, unknown>;
  if (typeof record?.payload === "string") { try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; } }
  return {};
}

export function EmissionLcaMaterialsPage() {
  const requested = new URLSearchParams(location.search).get("projectId") || "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(requested);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [materials, setMaterials] = useState<Material[]>([fresh()]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const urls = ["/home/api/emission-projects?page=1&size=100", "/admin/api/admin/lca-workspaces/LCA_PRODUCT_PROCESS", "/admin/api/admin/lca-workspaces/LCA_MATERIAL_MAPPING"];
      const responses = await Promise.all(urls.map(url => fetch(url, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })));
      const bodies = await Promise.all(responses.map(response => response.json().catch(() => ({})) as Promise<Record<string, unknown>>));
      if (responses.some(response => !response.ok)) throw new Error("프로젝트·공정·원료 자료를 불러오지 못했습니다. 접근 권한과 서버 응답을 확인하세요.");
      const available = ((bodies[0].items || []) as Array<Record<string, unknown>>).map(item => ({ id: String(item.id || ""), name: String(item.name || item.id || "") })).filter(item => item.id);
      setProjects(available);
      setProjectId(current => available.some(item => item.id === current) ? current : (available.find(item => item.id === requested)?.id || available[0]?.id || ""));
      const processRows = (bodies[1].records || []) as RecordItem[];
      const selected = processRows.find(record => bodyOf(record).projectId === projectId);
      const rawProcesses = bodyOf(selected).processes;
      setProcesses(Array.isArray(rawProcesses) ? rawProcesses.map((item, index) => ({ id: String((item as Record<string, unknown>).id || index + 1), name: String((item as Record<string, unknown>).name || ("공정 " + (index + 1))) })) : []);
      setRecords((bodies[2].records || []) as RecordItem[]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "자료 조회 오류"); }
    finally { setLoading(false); }
  }, [projectId, requested]);
  useEffect(() => { void load(); }, [load]);
  const saved = useMemo(() => records.find(record => bodyOf(record).projectId === projectId), [records, projectId]);
  const savedMaterials = saved && Array.isArray(bodyOf(saved).materials) ? bodyOf(saved).materials as Material[] : [];
  useEffect(() => { setMaterials(savedMaterials.length ? savedMaterials.map(row => ({ ...fresh(), ...row })) : [fresh()]); setChecked(false); }, [projectId, saved?.version]);
  const shown = materials.filter(row => !query || (row.name + row.type + row.supplier + row.origin).toLowerCase().includes(query.toLowerCase()));
  const problems = materials.flatMap((row, index) => {
    const errors: string[] = [];
    if (!row.name.trim()) errors.push((index + 1) + "행: 물질명 누락");
    if (!row.processId) errors.push((index + 1) + "행: 공정 미선택");
    if (!row.quantity || !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0) errors.push((index + 1) + "행: 양수 투입량 필요");
    if (!row.unit.trim()) errors.push((index + 1) + "행: 단위 누락");
    if (row.recycledPercent && (!Number.isFinite(Number(row.recycledPercent)) || Number(row.recycledPercent) < 0 || Number(row.recycledPercent) > 100)) errors.push((index + 1) + "행: 재생원료 비율은 0~100%");
    return errors;
  });
  const update = (id: string, key: keyof Material, value: string) => { setMaterials(rows => rows.map(row => row.id === id ? { ...row, [key]: value } : row)); setChecked(false); };
  const validate = (event: FormEvent) => { event.preventDefault(); setChecked(true); };

  return <main className="mx-auto max-w-7xl px-4 py-7 text-[#052b57]" data-testid="lca-materials">
    <nav className="mb-4 text-sm"><a className="underline" href="/emission/lca?menu=H1030102">제품 LCA</a>　›　원료·보조재</nav>
    <header className="rounded-lg border border-blue-200 bg-blue-50 p-6"><p className="font-bold text-blue-800">제품 LCA · 인벤토리</p><h1 className="mt-1 text-3xl font-black">원료·보조재 투입 자료</h1><p className="mt-2">프로젝트 공정별 원료와 보조재 사용량, 공급처 및 데이터 출처를 정리합니다.</p></header>
    <p role="status" className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm">현재는 조회와 입력 검증 단계입니다. 저장 API가 프로젝트 배정을 쓰기 시 검사하지 않아 저장을 잠갔으며, 이 화면에서 새로 입력한 값은 새로고침하면 유지되지 않습니다.</p>
    <section className="my-5 flex flex-wrap items-end gap-4 rounded-lg border bg-white p-4">
      <label className="min-w-80 flex-1 font-bold">프로젝트<select className="mt-2 block min-h-11 w-full rounded border p-2" value={projectId} onChange={event => { setProjectId(event.target.value); const url = new URL(location.href); url.searchParams.set("projectId", event.target.value); history.replaceState(null, "", url); }}><option value="">프로젝트 선택</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.id}</option>)}</select></label>
      <button type="button" onClick={() => void load()} className="min-h-11 rounded border border-blue-700 px-4 font-bold">새로고침</button>
    </section>
    {error && <p role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-4">{error}</p>}
    {!loading && !projectId && <p className="rounded border bg-white p-8 text-center">접근 가능한 프로젝트가 없습니다.</p>}
    {projectId && <form onSubmit={validate} className="rounded-lg border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="text-xl font-black">투입 물질 목록</h2><p className="text-sm">같은 물질도 투입 공정이 다르면 별도 행으로 등록합니다.</p></div><input aria-label="원료 검색" className="min-h-10 rounded border px-3" value={query} onChange={event => setQuery(event.target.value)} placeholder="물질·공급처 검색"/><button type="button" onClick={() => setMaterials(rows => [...rows, fresh()])} className="rounded bg-[#003b88] px-4 py-2 font-bold text-white">+ 행 추가</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-sm"><thead className="bg-slate-100"><tr>{["구분","물질명","투입 공정","투입량","단위","공급처","원산지","재생원료 %","데이터 출처","증빙 URL",""].map(label => <th key={label} className="border-b p-3 text-left">{label}</th>)}</tr></thead><tbody>
        {shown.map(row => <tr key={row.id}>{[
          <select aria-label="구분" value={row.type} onChange={event => update(row.id,"type",event.target.value)} className="w-28 rounded border p-2"><option>원료</option><option>보조재</option></select>,
          <input aria-label="물질명" value={row.name} onChange={event => update(row.id,"name",event.target.value)} className="w-40 rounded border p-2"/>,
          <select aria-label="공정" value={row.processId} onChange={event => update(row.id,"processId",event.target.value)} className="w-40 rounded border p-2"><option value="">공정 선택</option>{processes.map(process => <option key={process.id} value={process.id}>{process.name}</option>)}</select>,
          <input aria-label="투입량" type="number" min="0" step="any" value={row.quantity} onChange={event => update(row.id,"quantity",event.target.value)} className="w-24 rounded border p-2"/>,
          <input aria-label="단위" value={row.unit} onChange={event => update(row.id,"unit",event.target.value)} className="w-20 rounded border p-2" placeholder="kg"/>,
          <input aria-label="공급처" value={row.supplier} onChange={event => update(row.id,"supplier",event.target.value)} className="w-32 rounded border p-2"/>,
          <input aria-label="원산지" value={row.origin} onChange={event => update(row.id,"origin",event.target.value)} className="w-24 rounded border p-2"/>,
          <input aria-label="재생원료 비율" type="number" min="0" max="100" step="any" value={row.recycledPercent} onChange={event => update(row.id,"recycledPercent",event.target.value)} className="w-20 rounded border p-2"/>,
          <input aria-label="데이터 출처" value={row.source} onChange={event => update(row.id,"source",event.target.value)} className="w-36 rounded border p-2"/>,
          <input aria-label="증빙 URL" type="url" value={row.evidence} onChange={event => update(row.id,"evidence",event.target.value)} className="w-40 rounded border p-2"/>,
          <button type="button" aria-label="행 삭제" onClick={() => setMaterials(rows => rows.length > 1 ? rows.filter(item => item.id !== row.id) : [fresh()])} className="text-red-700">삭제</button>
        ].map((cell,index) => <td key={index} className="border-b p-2">{cell}</td>)}</tr>)}
        {!shown.length && <tr><td colSpan={11} className="p-8 text-center">검색 결과가 없습니다.</td></tr>}
      </tbody></table></div>
      <div className="flex flex-wrap items-center gap-3 border-t p-4"><button type="submit" className="rounded bg-[#003b88] px-5 py-3 font-bold text-white">입력 검증</button><button type="button" disabled title="서버 저장 API가 프로젝트 배정을 저장 시 확인하지 않습니다." className="rounded border px-5 py-3 text-slate-500">저장 연결 대기</button><span className="text-sm">{loading ? "조회 중" : materials.length + "행 · 저장자료 " + savedMaterials.length + "행"}</span></div>
      <p className="px-4 pb-4 text-sm text-amber-800">저장하려면 서버에서 계정과 선택 프로젝트의 LCA_DATA_STEWARD 배정 및 레코드 버전을 함께 검사해야 합니다.</p>
      {checked && <section role={problems.length ? "alert" : "status"} className="m-4 rounded border p-4"><b>{problems.length ? "수정 필요 " + problems.length + "건" : "입력 형식 검증 통과"}</b>{problems.length > 0 && <ul className="mt-2 list-inside list-disc text-red-700">{problems.map(issue => <li key={issue}>{issue}</li>)}</ul>}{!problems.length && <p className="mt-2">출처와 증빙의 적합성은 담당자가 검토해야 합니다.</p>}</section>}
    </form>}
    <nav className="mt-5 flex gap-3"><a className="rounded border bg-white p-3 underline" href={"/lca/functional-unit" + (projectId ? "?projectId=" + encodeURIComponent(projectId) : "")}>이전: 기능 단위</a><a className="rounded border bg-white p-3 underline" href={"/lca/energy-steam" + (projectId ? "?projectId=" + encodeURIComponent(projectId) : "")}>다음: 에너지·스팀</a></nav>
    <details className="mt-5 rounded border bg-white p-4"><summary className="font-bold">도움말·완료 기준</summary><p className="mt-3">공정별 물질 분리, 원자료 기준 수량과 단위, 공급처·원산지·재생 함량 근거, 데이터 기간과 중복 여부를 확인합니다. 단위 환산 전 원자료를 보존하세요.</p></details>
  </main>;
}
