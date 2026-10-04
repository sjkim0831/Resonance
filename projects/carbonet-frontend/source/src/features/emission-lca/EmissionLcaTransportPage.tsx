import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type Project = { id: string; name: string };
type Process = { id: string; name: string };
type MovementBasis = "질량거리" | "운송연료";
type TransportEntry = {
  id: string;
  processId: string;
  stage: string;
  cargo: string;
  origin: string;
  destination: string;
  mode: string;
  vehicle: string;
  basis: MovementBasis;
  mass: string;
  massUnit: string;
  distanceKm: string;
  fuelAmount: string;
  fuelUnit: string;
  periodStart: string;
  periodEnd: string;
  trips: string;
  allocationGroup: string;
  allocationPercent: string;
  source: string;
  evidence: string;
};
type WorkspaceRecord = { version?: number; payload?: unknown };

const API = "/admin/api/admin/lca-workspaces/LCA_DATA_COLLECTION";
const stageOptions = ["원료 반입", "공정 간 이동", "제품 출하", "폐기물 반출"];
const modeOptions = ["도로", "철도", "해상", "항공"];
const fresh = (): TransportEntry => ({
  id: globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`,
  processId: "", stage: "원료 반입", cargo: "", origin: "", destination: "", mode: "도로", vehicle: "",
  basis: "질량거리", mass: "", massUnit: "t", distanceKm: "", fuelAmount: "", fuelUnit: "",
  periodStart: "", periodEnd: "", trips: "", allocationGroup: "", allocationPercent: "100", source: "", evidence: ""
});

function payloadOf(record?: WorkspaceRecord): Record<string, unknown> {
  if (record?.payload && typeof record.payload === "object") return record.payload as Record<string, unknown>;
  if (typeof record?.payload === "string") { try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; } }
  return {};
}

function massDistance(entry: TransportEntry): number | null {
  const mass = Number(entry.mass);
  const distance = Number(entry.distanceKm);
  if (!Number.isFinite(mass) || mass <= 0 || !Number.isFinite(distance) || distance <= 0) return null;
  const tonnes = entry.massUnit === "kg" ? mass / 1000 : mass;
  return tonnes * distance * (Number(entry.allocationPercent) / 100);
}

export function EmissionLcaTransportPage() {
  const query = new URLSearchParams(location.search);
  const requested = query.get("projectId") || "";
  const en = location.pathname.startsWith("/en/");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(requested);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [records, setRecords] = useState<WorkspaceRecord[]>([]);
  const [entries, setEntries] = useState<TransportEntry[]>([fresh()]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validated, setValidated] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const urls = ["/home/api/emission-projects?page=1&size=100", "/admin/api/admin/lca-workspaces/LCA_PRODUCT_PROCESS", API];
      const responses = await Promise.all(urls.map(url => fetch(url, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })));
      const bodies = await Promise.all(responses.map(response => response.json().catch(() => ({})) as Promise<Record<string, unknown>>));
      if (responses.some(response => !response.ok)) throw new Error("프로젝트 또는 제품·공정·운송자료 조회에 실패했습니다. 로그인과 프로젝트 업무 권한을 확인하세요.");
      const available = ((bodies[0].items || []) as Array<Record<string, unknown>>).map(item => ({ id: String(item.id || ""), name: String(item.name || item.id || "") })).filter(item => item.id);
      const chosenId = available.some(item => item.id === projectId) ? projectId : (available.find(item => item.id === requested)?.id || available[0]?.id || "");
      setProjects(available);
      setProjectId(chosenId);
      const processRecord = ((bodies[1].records || []) as WorkspaceRecord[]).find(record => payloadOf(record).projectId === chosenId);
      const processRows = payloadOf(processRecord).processes;
      setProcesses(Array.isArray(processRows) ? processRows.map((value, index) => {
        const item = value as Record<string, unknown>;
        return { id: String(item.id || index + 1), name: String(item.name || `공정 ${index + 1}`) };
      }) : []);
      setRecords((bodies[2].records || []) as WorkspaceRecord[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "자료 조회 오류"); }
    finally { setLoading(false); }
  }, [projectId, requested]);
  useEffect(() => { void load(); }, [load]);

  const saved = useMemo(() => records.find(record => payloadOf(record).projectId === projectId), [records, projectId]);
  const savedEntries = saved && Array.isArray(payloadOf(saved).transportEntries) ? payloadOf(saved).transportEntries as TransportEntry[] : [];
  useEffect(() => { setEntries(savedEntries.length ? savedEntries.map(row => ({ ...fresh(), ...row })) : [fresh()]); setValidated(false); }, [projectId, saved?.version]);

  const allocationIssues = useMemo(() => {
    const groups = new Map<string, number>();
    entries.filter(row => row.allocationGroup.trim()).forEach(row => groups.set(row.allocationGroup.trim(), (groups.get(row.allocationGroup.trim()) || 0) + Number(row.allocationPercent || 0)));
    return [...groups.entries()].filter(([, total]) => Math.abs(total - 100) > 0.01).map(([group, total]) => `배분 그룹 “${group}” 합계가 ${total.toFixed(2)}%입니다. 공유 운송 건이면 100%로 맞추세요.`);
  }, [entries]);

  const problems = useMemo(() => {
    const issues = entries.flatMap((row, index) => {
      const prefix = `${index + 1}행: `;
      const rowIssues: string[] = [];
      if (!row.processId) rowIssues.push(prefix + "연결 공정을 선택하세요.");
      if (!row.cargo.trim()) rowIssues.push(prefix + "운송 대상 원료·제품을 입력하세요.");
      if (!row.origin.trim() || !row.destination.trim() || row.origin.trim() === row.destination.trim()) rowIssues.push(prefix + "출발지와 도착지를 확인하세요.");
      if (!row.vehicle.trim()) rowIssues.push(prefix + "차량·선박·열차·항공기 유형을 입력하세요.");
      if (!row.periodStart || !row.periodEnd || row.periodStart > row.periodEnd) rowIssues.push(prefix + "운송 기간을 올바르게 입력하세요.");
      if (row.trips.trim() && (!Number.isInteger(Number(row.trips)) || Number(row.trips) < 1)) rowIssues.push(prefix + "운송 횟수는 1 이상의 정수로 입력하세요.");
      if (!Number.isFinite(Number(row.allocationPercent)) || Number(row.allocationPercent) <= 0 || Number(row.allocationPercent) > 100) rowIssues.push(prefix + "제품 배분 비율은 0 초과 100% 이하여야 합니다.");
      if (row.basis === "질량거리") {
        if (!Number.isFinite(Number(row.mass)) || Number(row.mass) <= 0) rowIssues.push(prefix + "질량거리 기준은 운송 질량이 필요합니다.");
        if (!Number.isFinite(Number(row.distanceKm)) || Number(row.distanceKm) <= 0) rowIssues.push(prefix + "질량거리 기준은 거리(km)가 필요합니다.");
      } else {
        if (!Number.isFinite(Number(row.fuelAmount)) || Number(row.fuelAmount) <= 0 || !row.fuelUnit.trim()) rowIssues.push(prefix + "연료 기준은 연료 사용량과 단위가 필요합니다.");
      }
      if (!row.source.trim() && !row.evidence.trim()) rowIssues.push(prefix + "데이터 출처 또는 증빙 URL을 입력하세요.");
      return rowIssues;
    });
    return [...issues, ...allocationIssues];
  }, [entries, allocationIssues]);

  const filtered = entries.filter(row => !filter || [row.cargo, row.origin, row.destination, row.vehicle, row.mode, row.source].join(" ").toLowerCase().includes(filter.toLowerCase()));
  const update = (id: string, key: keyof TransportEntry, value: string) => { setEntries(current => current.map(row => row.id === id ? { ...row, [key]: value } : row)); setValidated(false); };
  const selectProject = (id: string) => {
    setProjectId(id);
    const url = new URL(location.href);
    if (id) url.searchParams.set("projectId", id); else url.searchParams.delete("projectId");
    history.replaceState(null, "", url);
  };
  const validate = (event: FormEvent) => { event.preventDefault(); setValidated(true); };

  const th = "border-b p-2 text-left align-bottom";
  const input = "min-h-10 rounded border border-slate-300 px-2 py-1";
  return <main className="mx-auto max-w-[1500px] px-4 py-7 text-[#052b57]" data-testid="lca-transport">
    <nav className="mb-4 text-sm"><a className="underline" href={en ? "/en/emission/lca?menu=H1030201" : "/emission/lca?menu=H1030201"}>제품 LCA</a>　›　원료·에너지 인벤토리　›　<strong>운송</strong></nav>
    <header className="rounded-lg border border-blue-200 bg-blue-50 p-6">
      <p className="font-bold text-blue-800">제품 LCA · 인벤토리 · H1030203</p>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="mt-1 text-3xl font-black">운송자료</h1><p className="mt-2 max-w-4xl">원료 반입부터 제품 출하와 폐기물 반출까지 공정별 운송 구간, 운송수단, 활동자료와 증빙을 기록합니다.</p></div><label className="min-w-72 font-bold">프로젝트<select className={`${input} mt-2 block w-full bg-white`} value={projectId} onChange={event => selectProject(event.target.value)}><option value="">프로젝트 선택</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.id}</option>)}</select></label></div>
    </header>
    <section className="mt-4 grid gap-3 md:grid-cols-4" aria-label="운송자료 요약">
      {[ ["전체 운송 건", entries.length], ["증빙 연결", entries.filter(row => row.evidence.trim() || row.source.trim()).length], ["질량거리 기준", entries.filter(row => row.basis === "질량거리").length], ["운송연료 기준", entries.filter(row => row.basis === "운송연료").length] ].map(([label, value]) => <article key={String(label)} className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">{label}</p><strong className="mt-1 block text-2xl">{value}</strong></article>)}
    </section>
    <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm"><strong>산정 경계 안내</strong><p className="mt-1">운송 활동자료를 등록하는 화면입니다. 배출량은 여기서 임의 계산하지 않습니다. 질량거리(t·km)와 운송연료 사용량 중 실제 산정에 사용할 기준을 행마다 하나만 선택하고, 배출계수 매핑은 LCI 산정 업무에서 연결하세요.</p></div>
    {error && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4">{error}</p>}
    {loading && <p role="status" className="mt-4 rounded border bg-white p-4">프로젝트와 운송자료를 불러오는 중입니다…</p>}
    {!loading && !projects.length && <p className="mt-4 rounded border bg-white p-8 text-center">현재 계정에서 접근 가능한 LCA 프로젝트가 없습니다. 프로젝트 배정과 LCA 업무 권한을 확인하세요.</p>}
    {projectId && <form onSubmit={validate} className="mt-4 overflow-hidden rounded-lg border bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4"><div><h2 className="text-xl font-black">공정별 운송 내역</h2><p className="text-sm text-slate-600">원료 반입·공정 간 이동·제품 출하·폐기물 반출을 구간 단위로 입력합니다.</p></div><label className="text-sm">운송 검색<input className={`${input} ml-2`} value={filter} onChange={event => setFilter(event.target.value)} placeholder="대상·구간·운송수단"/></label><div className="flex gap-2"><button type="button" onClick={() => setEntries(current => [...current, fresh()])} className="min-h-10 rounded bg-[#003b88] px-4 font-bold text-white">+ 운송 구간 추가</button><button type="button" onClick={() => void load()} className="min-h-10 rounded border border-blue-700 px-4 font-bold">새로고침</button></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[2200px] text-sm"><thead className="bg-slate-100"><tr>{["단계","연결 공정","운송 대상","출발지","도착지","수단","차량·기종","활동자료 기준","질량","단위","거리 km","연료 사용량","연료 단위","기간 시작","기간 종료","운송 횟수","배분 그룹","배분 %","출처","증빙 URL",""].map(label => <th className={th} key={label}>{label}</th>)}</tr></thead><tbody>
        {filtered.map(row => <tr key={row.id} className="hover:bg-blue-50/40">{[
          <select aria-label="운송 단계" value={row.stage} onChange={event => update(row.id,"stage",event.target.value)} className={`${input} w-32`}>{stageOptions.map(value => <option key={value}>{value}</option>)}</select>,
          <select aria-label="연결 공정" value={row.processId} onChange={event => update(row.id,"processId",event.target.value)} className={`${input} w-40`}><option value="">공정 선택</option>{processes.map(process => <option key={process.id} value={process.id}>{process.name}</option>)}</select>,
          <input aria-label="운송 대상" value={row.cargo} onChange={event => update(row.id,"cargo",event.target.value)} className={`${input} w-40`} placeholder="예: 철강 코일"/>,
          <input aria-label="출발지" value={row.origin} onChange={event => update(row.id,"origin",event.target.value)} className={`${input} w-36`} placeholder="사업장·지역"/>,
          <input aria-label="도착지" value={row.destination} onChange={event => update(row.id,"destination",event.target.value)} className={`${input} w-36`} placeholder="사업장·지역"/>,
          <select aria-label="운송 수단" value={row.mode} onChange={event => update(row.id,"mode",event.target.value)} className={`${input} w-24`}>{modeOptions.map(value => <option key={value}>{value}</option>)}</select>,
          <input aria-label="차량·기종" value={row.vehicle} onChange={event => update(row.id,"vehicle",event.target.value)} className={`${input} w-36`} placeholder="차종·선박·기종"/>,
          <select aria-label="활동자료 기준" value={row.basis} onChange={event => update(row.id,"basis",event.target.value as MovementBasis)} className={`${input} w-32`}><option>질량거리</option><option>운송연료</option></select>,
          <input aria-label="운송 질량" type="number" min="0" step="any" disabled={row.basis !== "질량거리"} value={row.mass} onChange={event => update(row.id,"mass",event.target.value)} className={`${input} w-24 disabled:bg-slate-100`}/>,
          <select aria-label="질량 단위" disabled={row.basis !== "질량거리"} value={row.massUnit} onChange={event => update(row.id,"massUnit",event.target.value)} className={`${input} w-20 disabled:bg-slate-100`}><option>t</option><option>kg</option></select>,
          <input aria-label="운송 거리" type="number" min="0" step="any" disabled={row.basis !== "질량거리"} value={row.distanceKm} onChange={event => update(row.id,"distanceKm",event.target.value)} className={`${input} w-24 disabled:bg-slate-100`}/>,
          <input aria-label="연료 사용량" type="number" min="0" step="any" disabled={row.basis !== "운송연료"} value={row.fuelAmount} onChange={event => update(row.id,"fuelAmount",event.target.value)} className={`${input} w-24 disabled:bg-slate-100`}/>,
          <input aria-label="연료 단위" disabled={row.basis !== "운송연료"} value={row.fuelUnit} onChange={event => update(row.id,"fuelUnit",event.target.value)} className={`${input} w-20 disabled:bg-slate-100`} placeholder="L·kg"/>,
          <input aria-label="운송 시작일" type="date" value={row.periodStart} onChange={event => update(row.id,"periodStart",event.target.value)} className={input}/>,
          <input aria-label="운송 종료일" type="date" value={row.periodEnd} onChange={event => update(row.id,"periodEnd",event.target.value)} className={input}/>,
          <input aria-label="운송 횟수" type="number" min="1" step="1" value={row.trips} onChange={event => update(row.id,"trips",event.target.value)} className={`${input} w-20`}/>,
          <input aria-label="배분 그룹" value={row.allocationGroup} onChange={event => update(row.id,"allocationGroup",event.target.value)} className={`${input} w-28`} placeholder="공유 건만"/>,
          <input aria-label="제품 배분 비율" type="number" min="0" max="100" step="any" value={row.allocationPercent} onChange={event => update(row.id,"allocationPercent",event.target.value)} className={`${input} w-20`}/>,
          <input aria-label="데이터 출처" value={row.source} onChange={event => update(row.id,"source",event.target.value)} className={`${input} w-36`} placeholder="운송장·ERP"/>,
          <input aria-label="증빙 URL" type="url" value={row.evidence} onChange={event => update(row.id,"evidence",event.target.value)} className={`${input} w-44`} placeholder="https://…"/>,
          <button type="button" aria-label="운송 행 삭제" onClick={() => setEntries(current => current.length > 1 ? current.filter(item => item.id !== row.id) : [fresh()])} className="font-bold text-red-700">삭제</button>
        ].map((cell, index) => <td key={index} className="border-b p-2">{cell}</td>)}</tr>)}
        {!filtered.length && <tr><td colSpan={21} className="p-8 text-center text-slate-600">표시할 운송 행이 없습니다. 운송 구간을 추가하세요.</td></tr>}
      </tbody></table></div>
      <div className="flex flex-wrap items-center gap-3 border-t p-4"><button type="submit" className="min-h-11 rounded bg-[#003b88] px-5 font-bold text-white">입력 검증</button><button type="button" disabled title="프로젝트 배정 권한을 서버가 검사하는 저장 경로가 확인되면 활성화됩니다." className="min-h-11 rounded border px-5 text-slate-500">저장 연결 대기</button><span className="text-sm text-slate-600">{entries.length}행 · 조회된 저장 행 {savedEntries.length}행</span></div>
      <p className="px-4 pb-4 text-sm text-amber-800">화면 입력값은 현재 저장되지 않습니다. 서버 저장 API가 이 계정의 프로젝트 배정 범위를 검사하지 않아 저장은 잠겨 있습니다.</p>
      {validated && <section role={problems.length ? "alert" : "status"} className={`m-4 rounded border p-4 ${problems.length ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}`}><strong>{problems.length ? `검증 결과: 수정할 항목 ${problems.length}건` : "입력 형식 검증 통과"}</strong>{problems.length > 0 ? <ul className="mt-2 list-inside list-disc text-red-800">{problems.map(issue => <li key={issue}>{issue}</li>)}</ul> : <div className="mt-2 space-y-1"><p>입력 형식과 필수 증빙을 확인했습니다. 이 결과는 배출량 산정 결과가 아닙니다.</p>{entries.filter(row => row.basis === "질량거리").map(row => <p key={row.id}>행 {entries.indexOf(row) + 1}: 활동자료 미리보기 {massDistance(row)?.toLocaleString(undefined, { maximumFractionDigits: 4 }) || "—"} t·km · 배출계수 미적용</p>)}</div>}</section>}
    </form>}
    <nav className="mt-5 flex flex-wrap gap-3"><a className="rounded border bg-white p-3 underline" href={(en ? "/en" : "") + "/lca/energy-steam" + (projectId ? `?projectId=${encodeURIComponent(projectId)}` : "")}>이전: 에너지·스팀</a><a className="rounded border bg-white p-3 underline" href={(en ? "/en" : "") + "/lca/products-byproducts" + (projectId ? `?projectId=${encodeURIComponent(projectId)}` : "")}>다음: 제품·부산물</a></nav>
    <details className="mt-5 rounded border bg-white p-4"><summary className="font-bold">도움말 · 완료 기준 · QA</summary><div className="mt-3 grid gap-4 md:grid-cols-3"><section><h2 className="font-bold">입력</h2><p>연결 공정, 운송 구간, 운송수단, 기간, 질량거리 또는 연료 사용량, 데이터 출처와 증빙을 기록합니다.</p></section><section><h2 className="font-bold">검증</h2><p>질량거리와 연료 사용량 기준은 한 행에서 함께 산정하지 않습니다. 공유 운송은 배분 그룹별 합계 100%를 확인합니다.</p></section><section><h2 className="font-bold">완료 기준</h2><p>모든 행에서 필수 입력·단위·기간·증빙이 확인되고 배분 그룹 오류가 없어야 합니다. 배출계수 연결과 실제 저장은 별도 업무/API 검증이 필요합니다.</p></section></div></details>
  </main>;
}
