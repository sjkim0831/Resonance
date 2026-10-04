import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type Project = { id: string; name: string };
type Process = { id: string; name: string };
type OutputType = "주제품" | "공동제품" | "부산물";
type AllocationMethod = "해당 없음" | "배분 안 함" | "질량 기준" | "경제가치 기준" | "에너지 함량 기준" | "기타 기준";
type OutputEntry = {
  id: string; processId: string; type: OutputType; name: string; code: string; quantity: string; unit: string;
  measurementBasis: string; moisturePercent: string; disposition: string; allocationGroup: string;
  allocationMethod: AllocationMethod; allocationPercent: string; allocationBasisValue: string;
  allocationReason: string; periodStart: string; periodEnd: string; source: string; evidence: string;
};
type WorkspaceRecord = { version?: number; payload?: unknown };

const API = "/admin/api/admin/lca-workspaces/LCA_DATA_COLLECTION";
const allocationOptions: AllocationMethod[] = ["해당 없음", "배분 안 함", "질량 기준", "경제가치 기준", "에너지 함량 기준", "기타 기준"];
const dispositions = ["판매", "내부 재사용", "외부 재활용", "기타 회수", "폐기물 처리", "미정"];
const fresh = (): OutputEntry => ({
  id: globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`,
  processId: "", type: "주제품", name: "", code: "", quantity: "", unit: "t", measurementBasis: "건조 기준",
  moisturePercent: "", disposition: "", allocationGroup: "", allocationMethod: "해당 없음", allocationPercent: "100",
  allocationBasisValue: "", allocationReason: "", periodStart: "", periodEnd: "", source: "", evidence: ""
});

function payloadOf(record?: WorkspaceRecord): Record<string, unknown> {
  if (record?.payload && typeof record.payload === "object") return record.payload as Record<string, unknown>;
  if (typeof record?.payload === "string") { try { return JSON.parse(record.payload) as Record<string, unknown>; } catch { return {}; } }
  return {};
}

export function LcaProductsByproductsPage() {
  const requested = new URLSearchParams(location.search).get("projectId") || "";
  const en = location.pathname.startsWith("/en/");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(requested);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [records, setRecords] = useState<WorkspaceRecord[]>([]);
  const [entries, setEntries] = useState<OutputEntry[]>([fresh()]);
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
      if (responses.some(response => !response.ok)) throw new Error("프로젝트 또는 제품·공정·생산자료 조회에 실패했습니다. 로그인과 프로젝트 업무 권한을 확인하세요.");
      const available = ((bodies[0].items || []) as Array<Record<string, unknown>>).map(item => ({ id: String(item.id || ""), name: String(item.name || item.id || "") })).filter(item => item.id);
      const chosenId = available.some(item => item.id === projectId) ? projectId : (available.find(item => item.id === requested)?.id || available[0]?.id || "");
      setProjects(available); setProjectId(chosenId);
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
  const savedEntries = saved && Array.isArray(payloadOf(saved).productOutputEntries) ? payloadOf(saved).productOutputEntries as OutputEntry[] : [];
  useEffect(() => { setEntries(savedEntries.length ? savedEntries.map(row => ({ ...fresh(), ...row })) : [fresh()]); setValidated(false); }, [projectId, saved?.version]);

  const allocationIssues = useMemo(() => {
    const groups = new Map<string, number>();
    entries.filter(row => row.allocationGroup.trim() && row.allocationMethod !== "배분 안 함" && row.allocationMethod !== "해당 없음")
      .forEach(row => groups.set(row.allocationGroup.trim(), (groups.get(row.allocationGroup.trim()) || 0) + Number(row.allocationPercent || 0)));
    return [...groups.entries()].filter(([, total]) => Math.abs(total - 100) > 0.01)
      .map(([group, total]) => `배분 그룹 “${group}” 합계가 ${total.toFixed(2)}%입니다. 같은 기능단위의 배분 합계를 100%로 확인하세요.`);
  }, [entries]);

  const problems = useMemo(() => {
    const rowIssues = entries.flatMap((row, index) => {
      const prefix = `${index + 1}행: `;
      const issues: string[] = [];
      if (!row.processId) issues.push(prefix + "연결 공정을 선택하세요.");
      if (!row.name.trim()) issues.push(prefix + "제품 또는 부산물 명칭을 입력하세요.");
      if (!Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0) issues.push(prefix + "생산량은 0보다 큰 숫자여야 합니다.");
      if (!row.unit.trim()) issues.push(prefix + "생산량 단위를 입력하세요.");
      if (!row.periodStart || !row.periodEnd || row.periodStart > row.periodEnd) issues.push(prefix + "집계 기간을 확인하세요.");
      if (row.measurementBasis === "습윤 기준" && (!Number.isFinite(Number(row.moisturePercent)) || Number(row.moisturePercent) < 0 || Number(row.moisturePercent) > 100)) issues.push(prefix + "습윤 기준에는 수분율 0~100%가 필요합니다.");
      if (row.type === "부산물" && (!row.disposition || row.disposition === "미정")) issues.push(prefix + "부산물 처리 경로를 정하세요.");
      if (row.type !== "주제품") {
        if (row.allocationMethod === "해당 없음") issues.push(prefix + "공동제품·부산물의 배분 기준을 선택하거나 ‘배분 안 함’ 근거를 적으세요.");
        if (row.allocationMethod === "배분 안 함" && !row.allocationReason.trim()) issues.push(prefix + "배분 제외 근거를 기록하세요.");
        if (row.allocationMethod !== "배분 안 함" && row.allocationMethod !== "해당 없음") {
          if (!Number.isFinite(Number(row.allocationPercent)) || Number(row.allocationPercent) <= 0 || Number(row.allocationPercent) > 100) issues.push(prefix + "배분 비율은 0 초과 100% 이하여야 합니다.");
          if (!row.allocationBasisValue.trim()) issues.push(prefix + "선택한 배분 기준의 근거값을 입력하세요.");
          if (!row.allocationReason.trim()) issues.push(prefix + "배분 방법의 적용 근거를 입력하세요.");
        }
      }
      if (!row.source.trim() && !row.evidence.trim()) issues.push(prefix + "생산자료 출처 또는 증빙 URL을 입력하세요.");
      return issues;
    });
    return [...rowIssues, ...allocationIssues];
  }, [entries, allocationIssues]);

  const filtered = entries.filter(row => !filter || [row.type, row.name, row.code, row.disposition, row.allocationGroup, row.source].join(" ").toLowerCase().includes(filter.toLowerCase()));
  const update = (id: string, key: keyof OutputEntry, value: string) => {
    setEntries(current => current.map(row => row.id === id ? { ...row, [key]: value } : row)); setValidated(false);
  };
  const selectProject = (id: string) => {
    setProjectId(id); const url = new URL(location.href);
    if (id) url.searchParams.set("projectId", id); else url.searchParams.delete("projectId");
    history.replaceState(null, "", url);
  };
  const validate = (event: FormEvent) => { event.preventDefault(); setValidated(true); };
  const count = (type: OutputType) => entries.filter(row => row.type === type).length;
  const th = "border-b p-2 text-left align-bottom";
  const input = "min-h-10 rounded border border-slate-300 px-2 py-1";

  return <main className="mx-auto max-w-[1500px] px-4 py-7 text-[#052b57]" data-testid="lca-products-byproducts">
    <nav className="mb-4 text-sm"><a className="underline" href={(en ? "/en" : "") + "/emission/lca?menu=H1030101"}>제품 LCA</a>　›　생산·산출물　›　<strong>제품·부산물</strong></nav>
    <header className="rounded-lg border border-blue-200 bg-blue-50 p-6">
      <p className="font-bold text-blue-800">제품 LCA · 생산 산출물 · H1030204</p>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="mt-1 text-3xl font-black">제품·부산물 생산량</h1><p className="mt-2 max-w-4xl">제품 시스템에 연결된 공정별 생산물과 부산물, 처리 경로, 환경부하 배분 기준 및 증빙을 관리합니다.</p></div><label className="min-w-72 font-bold">프로젝트<select className={`${input} mt-2 block w-full bg-white`} value={projectId} onChange={event => selectProject(event.target.value)}><option value="">프로젝트 선택</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.id}</option>)}</select></label></div>
    </header>
    <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="생산물 요약">
      {[["전체 산출물", entries.length], ["주제품", count("주제품")], ["공동제품", count("공동제품")], ["부산물", count("부산물")]].map(([label, value]) => <article key={String(label)} className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">{label}</p><strong className="mt-1 block text-2xl">{value}</strong></article>)}
    </section>
    <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm"><strong>배분 원칙</strong><p className="mt-1">공동제품·부산물의 배분 방법은 프로젝트 산정 기준에 맞춰 선택하고 근거를 남기세요. 배분 제외도 근거가 필요합니다. 제품 생산량만으로 배출량을 계산하지 않으며, 배출계수와 배분 결과는 LCI 산정 단계에서 계산합니다.</p></div>
    {error && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4">{error}</p>}
    {loading && <p role="status" className="mt-4 rounded border bg-white p-4">프로젝트·공정·제품 자료를 불러오는 중입니다…</p>}
    {!loading && !projects.length && <p className="mt-4 rounded border bg-white p-8 text-center">현재 계정에서 접근 가능한 LCA 프로젝트가 없습니다. 프로젝트 배정과 LCA 업무 권한을 확인하세요.</p>}
    {projectId && <form onSubmit={validate} className="mt-4 overflow-hidden rounded-lg border bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4"><div><h2 className="text-xl font-black">공정별 생산 산출물</h2><p className="text-sm text-slate-600">주제품·공동제품·부산물을 행별로 구분하고 기간과 증빙을 연결합니다.</p></div><label className="text-sm">산출물 검색<input className={`${input} ml-2`} value={filter} onChange={event => setFilter(event.target.value)} placeholder="유형·명칭·처리경로"/></label><div className="flex gap-2"><button type="button" onClick={() => setEntries(current => [...current, fresh()])} className="min-h-10 rounded bg-[#003b88] px-4 font-bold text-white">+ 산출물 추가</button><button type="button" onClick={() => void load()} className="min-h-10 rounded border border-blue-700 px-4 font-bold">새로고침</button></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[2000px] text-sm"><thead className="bg-slate-100"><tr>{["유형","연결 공정","제품·부산물명","코드","생산량","단위","측정 기준","수분율 %","부산물 처리 경로","배분 그룹","배분 기준","배분율 %","기준값·단위","배분 근거","기간 시작","기간 종료","출처","증빙 URL",""].map(label => <th className={th} key={label}>{label}</th>)}</tr></thead><tbody>
        {filtered.map(row => <tr key={row.id} className="hover:bg-blue-50/40">{[
          <select aria-label="산출물 유형" value={row.type} onChange={event => { const type = event.target.value as OutputType; update(row.id,"type",type); if (type === "주제품") update(row.id,"allocationMethod","해당 없음"); else if (row.allocationMethod === "해당 없음") update(row.id,"allocationMethod","배분 안 함"); }} className={`${input} w-28`}>{["주제품","공동제품","부산물"].map(value => <option key={value}>{value}</option>)}</select>,
          <select aria-label="연결 공정" value={row.processId} onChange={event => update(row.id,"processId",event.target.value)} className={`${input} w-40`}><option value="">공정 선택</option>{processes.map(process => <option key={process.id} value={process.id}>{process.name}</option>)}</select>,
          <input aria-label="제품 또는 부산물 명칭" value={row.name} onChange={event => update(row.id,"name",event.target.value)} className={`${input} w-40`} placeholder="예: 정제 제품"/>,
          <input aria-label="산출물 코드" value={row.code} onChange={event => update(row.id,"code",event.target.value)} className={`${input} w-28`}/>,
          <input aria-label="생산량" type="number" min="0" step="any" value={row.quantity} onChange={event => update(row.id,"quantity",event.target.value)} className={`${input} w-24`}/>,
          <input aria-label="생산량 단위" value={row.unit} onChange={event => update(row.id,"unit",event.target.value)} className={`${input} w-20`} placeholder="t"/>,
          <select aria-label="측정 기준" value={row.measurementBasis} onChange={event => update(row.id,"measurementBasis",event.target.value)} className={`${input} w-28`}><option>건조 기준</option><option>습윤 기준</option><option>측정 기준 기타</option></select>,
          <input aria-label="수분율" type="number" min="0" max="100" step="any" disabled={row.measurementBasis !== "습윤 기준"} value={row.moisturePercent} onChange={event => update(row.id,"moisturePercent",event.target.value)} className={`${input} w-20 disabled:bg-slate-100`}/>,
          <select aria-label="부산물 처리 경로" disabled={row.type !== "부산물"} value={row.disposition} onChange={event => update(row.id,"disposition",event.target.value)} className={`${input} w-32 disabled:bg-slate-100`}><option value="">선택</option>{dispositions.map(value => <option key={value}>{value}</option>)}</select>,
          <input aria-label="배분 그룹" value={row.allocationGroup} onChange={event => update(row.id,"allocationGroup",event.target.value)} className={`${input} w-28`} placeholder="같은 기능단위"/>,
          <select aria-label="배분 기준" value={row.allocationMethod} onChange={event => update(row.id,"allocationMethod",event.target.value as AllocationMethod)} disabled={row.type === "주제품"} className={`${input} w-36 disabled:bg-slate-100`}>{allocationOptions.map(value => <option key={value}>{value}</option>)}</select>,
          <input aria-label="배분 비율" type="number" min="0" max="100" step="any" disabled={row.type === "주제품" || row.allocationMethod === "배분 안 함" || row.allocationMethod === "해당 없음"} value={row.allocationPercent} onChange={event => update(row.id,"allocationPercent",event.target.value)} className={`${input} w-20 disabled:bg-slate-100`}/>,
          <input aria-label="배분 기준값" disabled={row.type === "주제품" || row.allocationMethod === "배분 안 함" || row.allocationMethod === "해당 없음"} value={row.allocationBasisValue} onChange={event => update(row.id,"allocationBasisValue",event.target.value)} className={`${input} w-36 disabled:bg-slate-100`} placeholder="값·단위"/>,
          <input aria-label="배분 방법 근거" value={row.allocationReason} onChange={event => update(row.id,"allocationReason",event.target.value)} className={`${input} w-44`} placeholder={row.allocationMethod === "배분 안 함" ? "배분 제외 이유" : "기준서·산정 근거"}/>,
          <input aria-label="집계 시작일" type="date" value={row.periodStart} onChange={event => update(row.id,"periodStart",event.target.value)} className={input}/>,
          <input aria-label="집계 종료일" type="date" value={row.periodEnd} onChange={event => update(row.id,"periodEnd",event.target.value)} className={input}/>,
          <input aria-label="생산자료 출처" value={row.source} onChange={event => update(row.id,"source",event.target.value)} className={`${input} w-36`} placeholder="생산일보·ERP"/>,
          <input aria-label="생산자료 증빙 URL" type="url" value={row.evidence} onChange={event => update(row.id,"evidence",event.target.value)} className={`${input} w-44`} placeholder="https://…"/>,
          <button type="button" aria-label="산출물 행 삭제" onClick={() => setEntries(current => current.length > 1 ? current.filter(item => item.id !== row.id) : [fresh()])} className="font-bold text-red-700">삭제</button>
        ].map((cell, index) => <td key={index} className="border-b p-2">{cell}</td>)}</tr>)}
        {!filtered.length && <tr><td colSpan={19} className="p-8 text-center text-slate-600">표시할 산출물이 없습니다. 제품 또는 부산물을 추가하세요.</td></tr>}
      </tbody></table></div>
      <div className="flex flex-wrap items-center gap-3 border-t p-4"><button type="submit" className="min-h-11 rounded bg-[#003b88] px-5 font-bold text-white">입력 검증</button><button type="button" disabled title="서버가 사용자별 프로젝트 배정과 레코드 버전을 확인하는 저장 경로가 확인되면 활성화됩니다." className="min-h-11 rounded border px-5 text-slate-500">저장 연결 대기</button><span className="text-sm text-slate-600">{entries.length}행 · 조회된 저장 행 {savedEntries.length}행</span></div>
      <p className="px-4 pb-4 text-sm text-amber-800">화면 입력값은 현재 저장되지 않습니다. 프로젝트별 서버 권한 검증이 확인되지 않아 저장은 잠겨 있습니다.</p>
      {validated && <section role={problems.length ? "alert" : "status"} className={`m-4 rounded border p-4 ${problems.length ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}`}><strong>{problems.length ? `검증 결과: 수정할 항목 ${problems.length}건` : "입력 형식 검증 통과"}</strong>{problems.length ? <ul className="mt-2 list-inside list-disc text-red-800">{problems.map(issue => <li key={issue}>{issue}</li>)}</ul> : <p className="mt-2">필수 생산량·처리 경로·배분 근거와 증빙 입력을 확인했습니다. 이 결과는 배출량 계산 결과가 아닙니다.</p>}</section>}
    </form>}
    <nav className="mt-5 flex flex-wrap gap-3"><a className="rounded border bg-white p-3 underline" href={(en ? "/en" : "") + "/lca/transport" + (projectId ? `?projectId=${encodeURIComponent(projectId)}` : "")}>이전: 운송</a><a className="rounded border bg-white p-3 underline" href={(en ? "/en" : "") + "/lca/waste-emissions" + (projectId ? `?projectId=${encodeURIComponent(projectId)}` : "")}>다음: 폐기물·배출물</a></nav>
    <details className="mt-5 rounded border bg-white p-4"><summary className="font-bold">도움말 · 완료 기준 · QA</summary><div className="mt-3 grid gap-4 md:grid-cols-3"><section><h2 className="font-bold">입력</h2><p>공정, 산출물 유형, 명칭, 생산량, 단위, 집계 기간, 측정 기준과 생산 근거를 입력합니다.</p></section><section><h2 className="font-bold">부산물</h2><p>판매·재사용·재활용·기타 회수·폐기 경로를 고르고, 폐기물 처리 자료는 관련 폐기물 업무와 대조합니다.</p></section><section><h2 className="font-bold">완료 기준</h2><p>공동제품·부산물은 배분 기준 또는 제외 근거가 있어야 합니다. 같은 배분 그룹은 기준값과 합계 100%를 검토하고 증빙을 연결합니다.</p></section></div></details>
  </main>;
}
