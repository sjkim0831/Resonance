import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type Project = { id: string; name: string };
type Process = { id: string; name: string };
type EntryKind = "폐기물" | "직접 배출물";
type Entry = {
  id: string; kind: EntryKind; processId: string; name: string; code: string; medium: string;
  quantity: string; unit: string; treatment: string; operator: string; measurement: string;
  periodStart: string; periodEnd: string; source: string; evidence: string; lciMapping: string;
};
type RecordRow = { version?: number; payload?: unknown };
const DATA_API = "/admin/api/admin/lca-workspaces/LCA_DATA_COLLECTION";
const PROCESS_API = "/admin/api/admin/lca-workspaces/LCA_PRODUCT_PROCESS";
const fresh = (): Entry => ({ id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, kind: "폐기물", processId: "", name: "", code: "", medium: "해당 없음", quantity: "", unit: "kg", treatment: "", operator: "", measurement: "계량", periodStart: "", periodEnd: "", source: "", evidence: "", lciMapping: "" });
function payload(record?: RecordRow): Record<string, unknown> {
  if (record?.payload && typeof record.payload === "object") return record.payload as Record<string, unknown>;
  if (typeof record?.payload === "string") { try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; } }
  return {};
}

export function LcaWasteEmissionsPage() {
  const requested = new URLSearchParams(location.search).get("projectId") || "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(requested);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [entries, setEntries] = useState<Entry[]>([fresh()]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [validated, setValidated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const urls = ["/home/api/emission-projects?page=1&size=100", PROCESS_API, DATA_API];
      const responses = await Promise.all(urls.map(url => fetch(url, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })));
      const bodies = await Promise.all(responses.map(response => response.json().catch(() => ({})) as Promise<Record<string, unknown>>));
      if (responses.some(response => !response.ok)) throw new Error("프로젝트·공정·폐기물 자료를 조회하지 못했습니다. 로그인과 프로젝트 업무 권한을 확인하세요.");
      const available = ((bodies[0].items || []) as Array<Record<string, unknown>>).map(row => ({ id: String(row.id || ""), name: String(row.name || row.id || "") })).filter(row => row.id);
      const chosen = available.some(row => row.id === projectId) ? projectId : (available.find(row => row.id === requested)?.id || available[0]?.id || "");
      setProjects(available); setProjectId(chosen);
      const processRows = (bodies[1].records as RecordRow[] | undefined)?.find(row => payload(row).projectId === chosen);
      const processData = payload(processRows).processes;
      setProcesses(Array.isArray(processData) ? processData.map((value, index) => { const row = value as Record<string, unknown>; return { id: String(row.id || index + 1), name: String(row.name || `공정 ${index + 1}`) }; }) : []);
      setRecords((bodies[2].records || []) as RecordRow[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "자료 조회 중 오류가 발생했습니다."); }
    finally { setLoading(false); }
  }, [projectId, requested]);
  useEffect(() => { void load(); }, [load]);

  const saved = useMemo(() => records.find(row => payload(row).projectId === projectId), [records, projectId]);
  const savedEntries = saved && Array.isArray(payload(saved).wasteEmissionEntries) ? payload(saved).wasteEmissionEntries as Entry[] : [];
  useEffect(() => { setEntries(savedEntries.length ? savedEntries.map(row => ({ ...fresh(), ...row })) : [fresh()]); setValidated(false); }, [projectId, saved?.version]);
  const problems = useMemo(() => entries.flatMap((row, index) => {
    const prefix = `${index + 1}행: `; const issues: string[] = [];
    if (!row.processId) issues.push(prefix + "연결 공정을 선택하세요.");
    if (!row.name.trim()) issues.push(prefix + "폐기물 또는 배출물 명칭을 입력하세요.");
    if (!Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0) issues.push(prefix + "발생량은 0보다 큰 값이어야 합니다.");
    if (!row.unit.trim()) issues.push(prefix + "단위를 입력하세요.");
    if (!row.periodStart || !row.periodEnd || row.periodStart > row.periodEnd) issues.push(prefix + "집계 기간을 확인하세요.");
    if (row.kind === "폐기물" && !row.treatment) issues.push(prefix + "폐기물 처리 경로를 선택하세요.");
    if (row.kind === "직접 배출물" && row.medium === "해당 없음") issues.push(prefix + "직접 배출 매체를 선택하세요.");
    if (!row.measurement) issues.push(prefix + "측정·추정 방법을 선택하세요.");
    if (!row.source.trim() && !row.evidence.trim()) issues.push(prefix + "자료 출처 또는 증빙 URL을 입력하세요.");
    return issues;
  }), [entries]);
  const update = (id: string, key: keyof Entry, value: string) => { setEntries(rows => rows.map(row => row.id === id ? { ...row, [key]: value, ...(key === "kind" && value === "폐기물" ? { medium: "해당 없음" } : {}), ...(key === "kind" && value === "직접 배출물" ? { treatment: "" } : {}) } : row)); setValidated(false); };
  const selectProject = (id: string) => { setProjectId(id); const url = new URL(location.href); if (id) url.searchParams.set("projectId", id); else url.searchParams.delete("projectId"); history.replaceState(null, "", url); };
  const filtered = entries.filter(row => !filter || [row.kind, row.name, row.code, row.medium, row.treatment, row.operator, row.lciMapping].join(" ").toLowerCase().includes(filter.toLowerCase()));
  const count = (kind: EntryKind) => entries.filter(row => row.kind === kind).length;
  const input = "min-h-10 rounded border border-slate-300 bg-white px-2 py-1";
  const th = "border-b p-2 text-left align-bottom";
  const onValidate = (event: FormEvent) => { event.preventDefault(); setValidated(true); };

  return <main className="mx-auto max-w-[1500px] px-4 py-7 text-[#052b57]" data-testid="lca-waste-emissions">
    <nav className="mb-4 text-sm"><a className="underline" href="/emission/lca?menu=H1030101">제품 LCA</a>　›　자원·환경 인벤토리　›　<strong>폐기물·배출물</strong></nav>
    <header className="rounded-lg border border-blue-200 bg-blue-50 p-6"><p className="font-bold text-blue-800">제품 LCA · 자원·환경 인벤토리 · H1030205</p><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="mt-1 text-3xl font-black">폐기물·배출물</h1><p className="mt-2 max-w-4xl">공정에서 발생한 폐기물의 처리량과 대기·수계·토양 직접 배출량을 기록하고 LCI 연결·증빙을 관리합니다.</p></div><label className="min-w-72 font-bold">프로젝트<select className={`${input} mt-2 block w-full`} value={projectId} onChange={event => selectProject(event.target.value)}><option value="">프로젝트 선택</option>{projects.map(row => <option key={row.id} value={row.id}>{row.name} · {row.id}</option>)}</select></label></div></header>
    <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="폐기물·배출물 요약">{[["전체 항목", entries.length], ["폐기물", count("폐기물")], ["직접 배출물", count("직접 배출물")], ["입력 오류", validated ? problems.length : "검증 전"]].map(([label, value]) => <article key={String(label)} className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">{label}</p><strong className="mt-1 block text-2xl">{value}</strong></article>)}</section>
    <aside className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm"><strong>중복 산정 방지</strong><p className="mt-1">폐기물 처리량은 처리 경로별 LCI 데이터에 연결하고, 공정에서 발생한 직접 배출량은 매체와 물질별로 기록합니다. 같은 배출을 폐기물 처리 계수와 직접 배출 양쪽에 중복 반영하지 마세요. 이 화면은 임의로 CO₂ 환산값을 만들지 않습니다.</p></aside>
    {error && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4">{error}</p>}{loading && <p role="status" className="mt-4 rounded border bg-white p-4">프로젝트·공정·자료를 불러오는 중입니다…</p>}{!loading && !projects.length && <p className="mt-4 rounded border bg-white p-8 text-center">접근 가능한 프로젝트가 없습니다. 로그인과 프로젝트 배정을 확인하세요.</p>}
    {projectId && <form onSubmit={onValidate} className="mt-4 overflow-hidden rounded-lg border bg-white"><div className="flex flex-wrap items-end justify-between gap-3 border-b p-4"><div><h2 className="text-xl font-black">공정별 폐기물·배출물 기록</h2><p className="text-sm text-slate-600">측정·추정 자료와 처리 증빙을 공정 및 집계 기간에 연결합니다.</p></div><label className="text-sm">항목 검색<input className={`${input} ml-2`} value={filter} onChange={event => setFilter(event.target.value)} placeholder="이름·매체·처리 경로"/></label><div className="flex gap-2"><button type="button" onClick={() => setEntries(rows => [...rows, fresh()])} className="min-h-10 rounded bg-[#003b88] px-4 font-bold text-white">+ 항목 추가</button><button type="button" onClick={() => void load()} className="min-h-10 rounded border border-blue-700 px-4 font-bold">새로고침</button></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1800px] text-sm"><thead className="bg-slate-100"><tr>{["구분","연결 공정","폐기물·배출물명","물질 코드","배출 매체","발생량","단위","처리 경로","처리업체·시설","측정·추정 방법","기간 시작","기간 종료","LCI 매핑·처리 계수","자료 출처","증빙 URL",""].map(label => <th className={th} key={label}>{label}</th>)}</tr></thead><tbody>{filtered.map(row => <tr key={row.id} className="hover:bg-blue-50/40">{[
        <select aria-label="자료 구분" value={row.kind} onChange={event => update(row.id,"kind",event.target.value)} className={`${input} w-28`}><option>폐기물</option><option>직접 배출물</option></select>,
        <select aria-label="연결 공정" value={row.processId} onChange={event => update(row.id,"processId",event.target.value)} className={`${input} w-40`}><option value="">공정 선택</option>{processes.map(process => <option key={process.id} value={process.id}>{process.name}</option>)}</select>,
        <input aria-label="물질명" value={row.name} onChange={event => update(row.id,"name",event.target.value)} className={`${input} w-40`} placeholder={row.kind === "폐기물" ? "예: 폐수오니" : "예: 질소산화물"}/>,
        <input aria-label="물질 코드" value={row.code} onChange={event => update(row.id,"code",event.target.value)} className={`${input} w-28`}/>,
        <select aria-label="배출 매체" value={row.medium} onChange={event => update(row.id,"medium",event.target.value)} disabled={row.kind === "폐기물"} className={`${input} w-28 disabled:bg-slate-100`}><option>해당 없음</option><option>대기</option><option>수계</option><option>토양</option><option>기타</option></select>,
        <input aria-label="발생량" type="number" min="0" step="any" value={row.quantity} onChange={event => update(row.id,"quantity",event.target.value)} className={`${input} w-24`}/>,
        <input aria-label="단위" value={row.unit} onChange={event => update(row.id,"unit",event.target.value)} className={`${input} w-20`} placeholder="kg"/>,
        <select aria-label="폐기물 처리 경로" value={row.treatment} onChange={event => update(row.id,"treatment",event.target.value)} disabled={row.kind !== "폐기물"} className={`${input} w-32 disabled:bg-slate-100`}><option value="">처리 경로 선택</option><option>재사용</option><option>재활용</option><option>소각</option><option>매립</option><option>폐수처리</option><option>기타 위탁처리</option></select>,
        <input aria-label="처리업체 또는 배출시설" value={row.operator} onChange={event => update(row.id,"operator",event.target.value)} className={`${input} w-36`} placeholder="업체·시설"/>,
        <select aria-label="측정 또는 추정 방법" value={row.measurement} onChange={event => update(row.id,"measurement",event.target.value)} className={`${input} w-32`}><option>계량</option><option>연속측정</option><option>시료분석</option><option>활동자료 기반 추정</option><option>공급자 자료</option></select>,
        <input aria-label="집계 시작일" type="date" value={row.periodStart} onChange={event => update(row.id,"periodStart",event.target.value)} className={input}/>,
        <input aria-label="집계 종료일" type="date" value={row.periodEnd} onChange={event => update(row.id,"periodEnd",event.target.value)} className={input}/>,
        <input aria-label="LCI 매핑" value={row.lciMapping} onChange={event => update(row.id,"lciMapping",event.target.value)} className={`${input} w-40`} placeholder="분류·처리계수 ID"/>,
        <input aria-label="자료 출처" value={row.source} onChange={event => update(row.id,"source",event.target.value)} className={`${input} w-36`} placeholder="계량표·분석성적서"/>,
        <input aria-label="증빙 URL" type="url" value={row.evidence} onChange={event => update(row.id,"evidence",event.target.value)} className={`${input} w-44`} placeholder="https://…"/>,
        <button type="button" aria-label="항목 삭제" onClick={() => setEntries(rows => rows.length > 1 ? rows.filter(item => item.id !== row.id) : [fresh()])} className="font-bold text-red-700">삭제</button>
      ].map((cell, index) => <td key={index} className="border-b p-2">{cell}</td>)}</tr>)}{!filtered.length && <tr><td colSpan={16} className="p-8 text-center text-slate-600">자료가 없습니다. 폐기물 또는 직접 배출물을 추가하세요.</td></tr>}</tbody></table></div>
      <div className="flex flex-wrap items-center gap-3 border-t p-4"><button type="submit" className="min-h-11 rounded bg-[#003b88] px-5 font-bold text-white">입력 검증</button><button type="button" disabled title="프로젝트별 서버 권한과 버전 확인을 보장하는 저장 API가 아직 확인되지 않았습니다." className="min-h-11 rounded border px-5 text-slate-500">저장 연결 대기</button><span className="text-sm text-slate-600">{entries.length}행 · 저장 조회 {savedEntries.length}행</span></div><p className="px-4 pb-4 text-sm text-amber-800">화면 입력값은 아직 저장되지 않습니다. 프로젝트별 서버 권한 검증이 확인되지 않아 저장 기능이 잠겨 있습니다.</p>{validated && <section role={problems.length ? "alert" : "status"} className={`m-4 rounded border p-4 ${problems.length ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}`}><strong>{problems.length ? `검증 결과: 수정할 항목 ${problems.length}건` : "입력 형식 검증 통과"}</strong>{problems.length ? <ul className="mt-2 list-inside list-disc text-red-800">{problems.map(issue => <li key={issue}>{issue}</li>)}</ul> : <p className="mt-2">필수값·기간·처리 경로·배출 매체·자료 근거 입력을 확인했습니다. 배출량 환산이나 LCI 계산은 실행하지 않았습니다.</p>}</section>}</form>}
    <nav className="mt-5 flex flex-wrap gap-3"><a className="rounded border bg-white p-3 underline" href={`/lca/products-byproducts${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`}>이전: 제품·부산물</a><a className="rounded border bg-white p-3 underline" href={`/lca/data-mapping${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`}>다음: LCI 데이터 매핑</a></nav>
    <details className="mt-5 rounded border bg-white p-4"><summary className="font-bold">도움말 · 완료 기준 · QA</summary><div className="mt-3 grid gap-4 md:grid-cols-3"><section><h2 className="font-bold">폐기물</h2><p>발생량·단위·처리경로·위탁업체·처리 확인서를 연결합니다. 공정 산출물에 이미 기록된 부산물과 같은 물량인지 대조합니다.</p></section><section><h2 className="font-bold">직접 배출물</h2><p>대기·수계·토양 매체, 물질명, 배출량과 측정·추정 방법을 기록합니다. 가능한 경우 분석 성적서 또는 시설 측정 기록을 증빙으로 연결합니다.</p></section><section><h2 className="font-bold">완료 기준</h2><p>모든 행이 공정·기간·단위·자료 근거와 연결되고, 처리 경로 또는 배출 매체가 정해지며, LCI 매핑과 중복 검토가 완료되어야 합니다.</p></section></div></details>
  </main>;
}
