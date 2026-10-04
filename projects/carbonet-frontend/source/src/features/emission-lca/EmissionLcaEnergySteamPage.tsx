import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type Project = { id: string; name: string };
type Process = { id: string; name: string };
type Entry = { id: string; processId: string; type: string; production: string; amount: string; unit: string; periodStart: string; periodEnd: string; meter: string; supplier: string; allocationPercent: string; source: string; evidence: string };
type RecordItem = { payload?: unknown; version?: number };
const fresh = (): Entry => ({ id: globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)), processId: "", type: "전력", production: "구매", amount: "", unit: "", periodStart: "", periodEnd: "", meter: "", supplier: "", allocationPercent: "100", source: "", evidence: "" });
const ENERGY_API = "/admin/api/admin/lca-workspaces/LCA_DATA_COLLECTION";
function payloadOf(record?: RecordItem): Record<string, unknown> {
  if (record?.payload && typeof record.payload === "object") return record.payload as Record<string, unknown>;
  if (typeof record?.payload === "string") { try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; } }
  return {};
}

export function EmissionLcaEnergySteamPage() {
  const requested = new URLSearchParams(location.search).get("projectId") || "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(requested);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [entries, setEntries] = useState<Entry[]>([fresh()]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validated, setValidated] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const urls = ["/home/api/emission-projects?page=1&size=100", "/admin/api/admin/lca-workspaces/LCA_PRODUCT_PROCESS", ENERGY_API];
      const responses = await Promise.all(urls.map(url => fetch(url, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })));
      const bodies = await Promise.all(responses.map(response => response.json().catch(() => ({})) as Promise<Record<string, unknown>>));
      if (responses.some(response => !response.ok)) throw new Error("프로젝트·공정·에너지 자료 조회에 실패했습니다. 로그인과 업무 권한을 확인하세요.");
      const available = ((bodies[0].items || []) as Array<Record<string, unknown>>).map(item => ({ id: String(item.id || ""), name: String(item.name || item.id || "") })).filter(item => item.id);
      setProjects(available);
      setProjectId(current => available.some(item => item.id === current) ? current : (available.find(item => item.id === requested)?.id || available[0]?.id || ""));
      const workspaces = (bodies[1].records || []) as RecordItem[];
      const projectWorkspace = workspaces.find(record => payloadOf(record).projectId === projectId);
      const processRows = payloadOf(projectWorkspace).processes;
      setProcesses(Array.isArray(processRows) ? processRows.map((value, index) => {
        const item = value as Record<string, unknown>;
        return { id: String(item.id || index + 1), name: String(item.name || ("공정 " + (index + 1))) };
      }) : []);
      setRecords((bodies[2].records || []) as RecordItem[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "자료 조회 오류"); }
    finally { setLoading(false); }
  }, [projectId, requested]);
  useEffect(() => { void load(); }, [load]);

  const saved = useMemo(() => records.find(record => payloadOf(record).projectId === projectId), [records, projectId]);
  const savedEntries = saved && Array.isArray(payloadOf(saved).energyEntries) ? payloadOf(saved).energyEntries as Entry[] : [];
  useEffect(() => { setEntries(savedEntries.length ? savedEntries.map(row => ({ ...fresh(), ...row })) : [fresh()]); setValidated(false); }, [projectId, saved?.version]);
  const filtered = entries.filter(item => !query || [item.type, item.production, item.meter, item.supplier, item.source].join(" ").toLowerCase().includes(query.toLowerCase()));
  const problems = entries.flatMap((item, index) => {
    const issues: string[] = [];
    if (!item.processId) issues.push((index + 1) + "행: 공정을 선택하세요.");
    if (!item.amount || !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0) issues.push((index + 1) + "행: 사용량은 0보다 큰 숫자여야 합니다.");
    if (!item.unit.trim()) issues.push((index + 1) + "행: 단위를 입력하세요.");
    if (!item.periodStart || !item.periodEnd || item.periodStart > item.periodEnd) issues.push((index + 1) + "행: 유효한 사용 기간을 입력하세요.");
    if (!item.meter.trim() && !item.source.trim()) issues.push((index + 1) + "행: 계량기 번호 또는 데이터 출처가 필요합니다.");
    if (!Number.isFinite(Number(item.allocationPercent)) || Number(item.allocationPercent) <= 0 || Number(item.allocationPercent) > 100) issues.push((index + 1) + "행: 배분 비율은 0 초과 100% 이하여야 합니다.");
    if (item.production === "자가생산" && item.type === "스팀") issues.push((index + 1) + "행: 자가생산 스팀은 보일러 연료와 함께 산정할 때 중복 집계를 검토하세요.");
    return issues;
  });
  const update = (id: string, key: keyof Entry, value: string) => { setEntries(current => current.map(item => item.id === id ? { ...item, [key]: value } : item)); setValidated(false); };
  const validate = (event: FormEvent) => { event.preventDefault(); setValidated(true); };

  return <main className="mx-auto max-w-7xl px-4 py-7 text-[#052b57]" data-testid="lca-energy-steam">
    <nav className="mb-4 text-sm"><a className="underline" href="/emission/lca?menu=H1030201">제품 LCA</a>　›　에너지·스팀</nav>
    <header className="rounded-lg border border-blue-200 bg-blue-50 p-6"><p className="font-bold text-blue-800">제품 LCA · 인벤토리</p><h1 className="mt-1 text-3xl font-black">에너지·스팀 사용량</h1><p className="mt-2">프로젝트 공정별 전력·연료·스팀·열 사용량과 계량 출처, 공유 사용량 배분을 관리합니다.</p></header>
    <p role="status" className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm">현재는 조회와 입력 검증 단계입니다. 저장 API가 프로젝트 배정을 저장 시 확인하지 않아 저장이 잠겨 있습니다. 새 입력값은 새로고침하면 유지되지 않습니다.</p>
    <section className="my-5 flex flex-wrap items-end gap-4 rounded-lg border bg-white p-4">
      <label className="min-w-80 flex-1 font-bold">프로젝트<select className="mt-2 block min-h-11 w-full rounded border p-2" value={projectId} onChange={event => { setProjectId(event.target.value); const url = new URL(location.href); url.searchParams.set("projectId", event.target.value); history.replaceState(null, "", url); }}><option value="">프로젝트 선택</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.id}</option>)}</select></label>
      <button type="button" onClick={() => void load()} className="min-h-11 rounded border border-blue-700 px-4 font-bold">새로고침</button>
    </section>
    {error && <p role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-4">{error}</p>}
    {!loading && !projectId && <p className="rounded border bg-white p-8 text-center">접근 가능한 프로젝트가 없습니다.</p>}
    {projectId && <form onSubmit={validate} className="rounded-lg border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="text-xl font-black">에너지 사용 내역</h2><p className="text-sm">공유 계량량은 공정별 배분 기준과 비율을 남기고, 연료와 생산 스팀의 이중 계산을 확인하세요.</p></div><input aria-label="에너지 검색" className="min-h-10 rounded border px-3" value={query} onChange={event => setQuery(event.target.value)} placeholder="에너지원·계량기·공급처 검색"/><button type="button" onClick={() => setEntries(current => [...current, fresh()])} className="rounded bg-[#003b88] px-4 py-2 font-bold text-white">+ 행 추가</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1400px] text-sm"><thead className="bg-slate-100"><tr>{["에너지원","공정","구매/자가","사용량","단위","기간 시작","기간 종료","계량기","공급처","배분 %","데이터 출처","증빙 URL",""].map(label => <th key={label} className="border-b p-3 text-left">{label}</th>)}</tr></thead><tbody>
        {filtered.map(item => <tr key={item.id}>{[
          <select aria-label="에너지원" value={item.type} onChange={event => update(item.id,"type",event.target.value)} className="w-32 rounded border p-2">{["전력","연료","스팀","열·냉열"].map(value => <option key={value}>{value}</option>)}</select>,
          <select aria-label="공정" value={item.processId} onChange={event => update(item.id,"processId",event.target.value)} className="w-40 rounded border p-2"><option value="">공정 선택</option>{processes.map(process => <option key={process.id} value={process.id}>{process.name}</option>)}</select>,
          <select aria-label="조달 형태" value={item.production} onChange={event => update(item.id,"production",event.target.value)} className="w-28 rounded border p-2"><option>구매</option><option>자가생산</option></select>,
          <input aria-label="사용량" type="number" min="0" step="any" value={item.amount} onChange={event => update(item.id,"amount",event.target.value)} className="w-24 rounded border p-2"/>,
          <input aria-label="단위" value={item.unit} onChange={event => update(item.id,"unit",event.target.value)} className="w-20 rounded border p-2" placeholder="kWh"/>,
          <input aria-label="기간 시작" type="date" value={item.periodStart} onChange={event => update(item.id,"periodStart",event.target.value)} className="rounded border p-2"/>,
          <input aria-label="기간 종료" type="date" value={item.periodEnd} onChange={event => update(item.id,"periodEnd",event.target.value)} className="rounded border p-2"/>,
          <input aria-label="계량기" value={item.meter} onChange={event => update(item.id,"meter",event.target.value)} className="w-28 rounded border p-2"/>,
          <input aria-label="공급처" value={item.supplier} onChange={event => update(item.id,"supplier",event.target.value)} className="w-32 rounded border p-2"/>,
          <input aria-label="배분 비율" type="number" min="0" max="100" step="any" value={item.allocationPercent} onChange={event => update(item.id,"allocationPercent",event.target.value)} className="w-20 rounded border p-2"/>,
          <input aria-label="데이터 출처" value={item.source} onChange={event => update(item.id,"source",event.target.value)} className="w-36 rounded border p-2"/>,
          <input aria-label="증빙 URL" type="url" value={item.evidence} onChange={event => update(item.id,"evidence",event.target.value)} className="w-40 rounded border p-2"/>,
          <button type="button" aria-label="행 삭제" onClick={() => setEntries(current => current.length > 1 ? current.filter(row => row.id !== item.id) : [fresh()])} className="text-red-700">삭제</button>
        ].map((cell,index) => <td key={index} className="border-b p-2">{cell}</td>)}</tr>)}
        {!filtered.length && <tr><td colSpan={13} className="p-8 text-center">검색 결과가 없습니다.</td></tr>}
      </tbody></table></div>
      <div className="flex flex-wrap items-center gap-3 border-t p-4"><button type="submit" className="rounded bg-[#003b88] px-5 py-3 font-bold text-white">입력 검증</button><button type="button" disabled title="서버 저장 API에 프로젝트별 권한 검사가 필요합니다." className="rounded border px-5 py-3 text-slate-500">저장 연결 대기</button><span className="text-sm">{loading ? "조회 중" : entries.length + "행 · 저장자료 " + savedEntries.length + "행"}</span></div>
      <p className="px-4 pb-4 text-sm text-amber-800">저장 연결에는 프로젝트 배정 권한과 레코드 버전 검사가 필요합니다.</p>
      {validated && <section role={problems.length ? "alert" : "status"} className="m-4 rounded border p-4"><b>{problems.length ? "수정 필요 " + problems.length + "건" : "입력 형식 검증 통과"}</b>{problems.length > 0 && <ul className="mt-2 list-inside list-disc text-red-700">{problems.map(issue => <li key={issue}>{issue}</li>)}</ul>}{!problems.length && <p className="mt-2">사용량 출처와 공정 배분의 근거를 검토하세요. 자가 보일러 연료와 스팀은 중복 산정되지 않도록 확인해야 합니다.</p>}</section>}
    </form>}
    <nav className="mt-5 flex gap-3"><a className="rounded border bg-white p-3 underline" href={"/lca/materials" + (projectId ? "?projectId=" + encodeURIComponent(projectId) : "")}>이전: 원료·보조재</a><a className="rounded border bg-white p-3 underline" href={"/lca/transport" + (projectId ? "?projectId=" + encodeURIComponent(projectId) : "")}>다음: 운송</a></nav>
    <details className="mt-5 rounded border bg-white p-4"><summary className="font-bold">도움말·완료 기준</summary><p className="mt-3">전력·연료·스팀·열을 공정별로 기록하고 계량 기간, 단위, 공급처, 출처와 증빙을 연결합니다. 여러 공정이 공유하면 합계 배분이 100%인지 확인합니다. 보일러 연료 사용량과 생산된 스팀량을 함께 기록할 경우 산정 경계에서 중복 계산하지 않도록 검토하세요.</p></details>
  </main>;
}
