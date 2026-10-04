import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchEcoinventDatasets } from "../../lib/api/emission";
import type { EcoinventDatasetRow } from "../../lib/api/emissionTypes";

type Project = { id: string; name: string };
type RecordItem = { payload?: unknown; version?: number };
type InventoryTarget = { id: string; category: string; name: string; processId: string; amount: string; unit: string; source: string; evidence: string; medium: string; treatment: string };
type MappingDraft = { targetId: string; datasetId: number; rationale: string; unitConversion: string; geographyReason: string };
const WORKSPACE = "/admin/api/admin/lca-workspaces";
function payloadOf(row?: RecordItem): Record<string, unknown> {
  if (row?.payload && typeof row.payload === "object") return row.payload as Record<string, unknown>;
  if (typeof row?.payload === "string") { try { return JSON.parse(row.payload) as Record<string, unknown>; } catch { return {}; } }
  return {};
}
function text(row: Record<string, unknown>, ...keys: string[]) { for (const key of keys) { const value = row[key]; if (value !== undefined && value !== null && String(value).trim()) return String(value); } return ""; }
function targetsFrom(payload: Record<string, unknown>): InventoryTarget[] {
  const groups: Array<[string, string[]]> = [
    ["원료·보조재", ["materials", "materialEntries"]], ["에너지·스팀", ["energyEntries"]],
    ["운송", ["transportEntries"]], ["제품·부산물", ["productOutputEntries"]], ["폐기물·배출물", ["wasteEmissionEntries"]]
  ];
  return groups.flatMap(([category, keys]) => keys.flatMap(key => Array.isArray(payload[key]) ? (payload[key] as Array<Record<string, unknown>>).map((row, index) => ({
    id: text(row, "id", "rowId") || `${category}:${index}:${text(row, "name", "materialName", "type")}`,
    category, name: text(row, "name", "materialName", "productName", "type", "substance"),
    processId: text(row, "processId"), amount: text(row, "quantity", "amount", "production"), unit: text(row, "unit"),
    source: text(row, "source", "measurement", "supplier"), evidence: text(row, "evidence", "evidenceUrl"),
    medium: text(row, "medium", "emissionMedium"), treatment: text(row, "treatment", "disposition")
  })).filter(row => row.name) : []));
}

export function LcaLciDataMappingPage() {
  const requested = new URLSearchParams(location.search).get("projectId") || "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(requested);
  const [inventory, setInventory] = useState<RecordItem[]>([]);
  const [mappingRecords, setMappingRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [targetId, setTargetId] = useState("");
  const [filter, setFilter] = useState("");
  const [datasetKeyword, setDatasetKeyword] = useState("");
  const [geography, setGeography] = useState("");
  const [unit, setUnit] = useState("");
  const [datasets, setDatasets] = useState<EcoinventDatasetRow[]>([]);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [datasetError, setDatasetError] = useState("");
  const [draft, setDraft] = useState<MappingDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const urls = ["/home/api/emission-projects?page=1&size=100", `${WORKSPACE}/LCA_DATA_COLLECTION`, `${WORKSPACE}/LCA_MATERIAL_MAPPING`];
      const responses = await Promise.all(urls.map(url => fetch(url, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })));
      const bodies = await Promise.all(responses.map(response => response.json().catch(() => ({})) as Promise<Record<string, unknown>>));
      if (responses.some(response => !response.ok)) throw new Error("프로젝트 또는 인벤토리·매핑 자료를 조회하지 못했습니다. 로그인과 LCA 업무 권한을 확인하세요.");
      const available = ((bodies[0].items || []) as Array<Record<string, unknown>>).map(row => ({ id: String(row.id || ""), name: String(row.name || row.id || "") })).filter(row => row.id);
      const chosen = available.some(row => row.id === projectId) ? projectId : (available.find(row => row.id === requested)?.id || available[0]?.id || "");
      setProjects(available); setProjectId(chosen);
      setInventory(((bodies[1].records || []) as RecordItem[]).filter(row => payloadOf(row).projectId === chosen));
      setMappingRecords(((bodies[2].records || []) as RecordItem[]).filter(row => payloadOf(row).projectId === chosen));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "LCI 매핑 자료 조회 오류"); }
    finally { setLoading(false); }
  }, [projectId, requested]);
  useEffect(() => { void load(); }, [load]);

  const targets = useMemo(() => inventory.flatMap(row => targetsFrom(payloadOf(row))), [inventory]);
  const inputVersion = inventory[0]?.version;
  const mappingVersion = mappingRecords[0]?.version;
  const selectedTarget = targets.find(row => row.id === targetId) || null;
  const mappings = useMemo(() => mappingRecords.flatMap(record => {
    const body = payloadOf(record);
    const rows = body.lciMappings ?? body.mappingEntries ?? body.materialMappings ?? body.mappings;
    return Array.isArray(rows) ? rows as Array<Record<string, unknown>> : [];
  }), [mappingRecords]);
  const mappedTargets = new Set(mappings.map(row => text(row, "targetId", "inventoryRowId", "sourceRowId")));
  const filteredTargets = targets.filter(row => !filter || `${row.category} ${row.name} ${row.unit} ${row.processId} ${row.medium} ${row.treatment}`.toLowerCase().includes(filter.toLowerCase()));
  const unmappedCount = targets.filter(row => !mappedTargets.has(row.id)).length;
  const saveIssue = selectedTarget && draft && draft.targetId === selectedTarget.id ? [
    !draft.rationale.trim() && "데이터셋 선택 근거를 적어 주세요.",
    selectedTarget.unit && text((datasets.find(row => Number(row.datasetId) === draft.datasetId) || {}) as Record<string, unknown>, "referenceProductUnit", "unit") && !text((datasets.find(row => Number(row.datasetId) === draft.datasetId) || {}) as Record<string, unknown>, "referenceProductUnit", "unit").toLowerCase().includes(selectedTarget.unit.toLowerCase()) && !draft.unitConversion.trim() && "단위가 다릅니다. 환산식과 근거를 기록하세요."
  ].filter(Boolean) : [];

  async function searchDatasets() {
    if (!datasetKeyword.trim()) { setDatasetError("물질명 또는 공정명을 입력하세요."); return; }
    setDatasetLoading(true); setDatasetError(""); setDatasets([]);
    try {
      const rows = await fetchEcoinventDatasets({ keyword: datasetKeyword.trim(), materialName: selectedTarget?.name, geography: geography || undefined, referenceProductUnit: unit || undefined, pageIndex: 0, pageSize: 30, sortField: "productName", sortDirection: "asc" });
      setDatasets(Array.isArray(rows) ? rows : []);
      if (!rows.length) setDatasetError("저장된 LCI 데이터셋에서 후보를 찾지 못했습니다. 검색어·지역·단위를 바꿔 다시 검색하세요.");
    } catch (cause) { setDatasetError(cause instanceof Error ? cause.message : "LCI 후보 조회에 실패했습니다."); }
    finally { setDatasetLoading(false); }
  }

  function selectProject(id: string) {
    setProjectId(id); setTargetId(""); setDraft(null); setDatasets([]);
    const url = new URL(location.href); if (id) url.searchParams.set("projectId", id); else url.searchParams.delete("projectId"); history.replaceState(null, "", url);
  }

  const input = "min-h-10 rounded border border-slate-300 bg-white px-3 py-2";
  return <main className="mx-auto max-w-[1600px] px-4 py-7 text-[#052b57]" data-testid="lca-lci-data-mapping">
    <nav className="mb-4 text-sm"><a className="underline" href={`/lca/waste-emissions${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`}>폐기물·배출물</a>　›　LCI 연결　›　<strong>LCI 데이터 매핑</strong></nav>
    <header className="flex flex-wrap items-end justify-between gap-5 rounded-lg border border-blue-200 bg-blue-50 p-6"><div><p className="font-bold text-blue-800">제품 LCA · 인벤토리 연결 · H1030206</p><h1 className="mt-1 text-3xl font-black">LCI 데이터 매핑</h1><p className="mt-2 max-w-4xl">공정 인벤토리 항목에 지역·기준연도·기술·기능단위가 맞는 LCI 데이터셋을 연결하고 선정 근거를 검토합니다.</p></div><label className="min-w-80 font-bold">프로젝트<select className={`${input} mt-2 block w-full`} value={projectId} onChange={event => selectProject(event.target.value)}><option value="">프로젝트 선택</option>{projects.map(row => <option key={row.id} value={row.id}>{row.name} · {row.id}</option>)}</select></label></header>
    {error && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4">{error}</p>}
    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="매핑 진행 현황">{[["인벤토리 항목", targets.length], ["미매핑", unmappedCount], ["저장 매핑", mappings.length], ["인벤토리 버전", inputVersion ? `v${inputVersion}` : "없음"], ["프로젝트 매핑 버전", mappingVersion ? `v${mappingVersion}` : "없음"]].map(([label, value]) => <article key={String(label)} className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-600">{label}</p><strong className="mt-1 block text-2xl">{loading ? "조회 중" : value}</strong></article>)}</section>
    <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm"><strong>후보는 검토 대상입니다</strong><p className="mt-1">검색 결과는 저장된 데이터셋 후보입니다. 기준흐름, 단위, 지역, 기술, 기준연도와 출처·라이선스를 확인하고 담당자가 적합성을 승인해야 계산에 사용할 수 있습니다. CO₂e 또는 배출계수는 이 화면에서 임의 생성하지 않습니다.</p></div>
    {loading && <p role="status" className="mt-4 rounded border bg-white p-4">프로젝트 인벤토리와 매핑 자료를 불러오는 중입니다…</p>}
    {projectId && <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)]">
      <section className="overflow-hidden rounded-lg border bg-white"><div className="border-b p-4"><h2 className="text-xl font-black">매핑 대상</h2><p className="mt-1 text-sm text-slate-600">원료·에너지·운송·제품·폐기물 입력 자료를 공정 단위로 표시합니다.</p><input aria-label="인벤토리 검색" className={`${input} mt-3 w-full`} value={filter} onChange={event => setFilter(event.target.value)} placeholder="분류·항목·단위·공정 검색"/></div><div className="max-h-[680px] overflow-y-auto">{filteredTargets.map(row => { const mapped = mappedTargets.has(row.id); return <button key={row.id} type="button" onClick={() => { setTargetId(row.id); setDatasetKeyword(row.name); setUnit(""); setDraft(null); setDatasets([]); }} aria-pressed={targetId === row.id} className={`block w-full border-b p-4 text-left hover:bg-blue-50 ${targetId === row.id ? "bg-blue-50 ring-2 ring-inset ring-blue-700" : ""}`}><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold text-blue-700">{row.category}</span><h3 className="mt-1 font-bold">{row.name}</h3><p className="mt-1 text-sm text-slate-600">{row.processId ? `공정 ${row.processId} · ` : ""}{row.amount || "수량 미입력"} {row.unit}</p>{row.medium && <p className="text-xs text-slate-500">매체: {row.medium}</p>}{row.treatment && <p className="text-xs text-slate-500">처리: {row.treatment}</p>}</div><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${mapped ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{mapped ? "저장 매핑" : "미매핑"}</span></div></button>; })}{!filteredTargets.length && <p className="p-8 text-center text-slate-600">{targets.length ? "검색 결과가 없습니다." : "프로젝트 인벤토리가 없습니다. 앞선 자료 입력 페이지에서 항목을 저장하면 여기에 표시됩니다."}</p>}</div></section>
      <section className="min-w-0 space-y-4">
        <article className="rounded-lg border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">LCI 데이터셋 검색</h2><p className="mt-1 text-sm text-slate-600">데이터베이스에 적재된 후보만 검색합니다.</p></div>{selectedTarget && <span className="rounded bg-blue-50 px-3 py-2 text-sm font-bold">선택 항목: {selectedTarget.name}</span>}</div><div className="mt-4 grid gap-3 md:grid-cols-[1.5fr_0.7fr_0.7fr_auto]"><label className="text-sm font-bold">물질·기능흐름<input className={`${input} mt-1 block w-full`} value={datasetKeyword} onChange={event => setDatasetKeyword(event.target.value)} placeholder="예: electricity, wastewater, NOx"/></label><label className="text-sm font-bold">지역<input className={`${input} mt-1 block w-full`} value={geography} onChange={event => setGeography(event.target.value)} placeholder="KR, Europe, GLO"/></label><label className="text-sm font-bold">기준 단위<input className={`${input} mt-1 block w-full`} value={unit} onChange={event => setUnit(event.target.value)} placeholder="kg, kWh, m3"/></label><button type="button" disabled={datasetLoading} onClick={() => void searchDatasets()} className="min-h-10 self-end rounded bg-[#003b88] px-5 font-bold text-white disabled:opacity-50">{datasetLoading ? "검색 중…" : "후보 검색"}</button></div>{datasetError && <p role="alert" className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm">{datasetError}</p>}
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1040px] text-sm"><thead className="bg-slate-100"><tr>{["선택","데이터셋·기능흐름","데이터셋 버전","지역·기준연도","기준흐름 단위","점수·지표","출처"].map(value => <th key={value} className="border-b p-3 text-left">{value}</th>)}</tr></thead><tbody>{datasets.map(row => { const id = Number(row.datasetId || 0); const active = draft?.datasetId === id; return <tr key={id} className={active ? "bg-blue-50" : ""}><td className="border-b p-3"><button type="button" onClick={() => setDraft({ targetId: selectedTarget?.id || "", datasetId: id, rationale: "", unitConversion: "", geographyReason: "" })} className={`rounded px-3 py-2 font-bold ${active ? "bg-emerald-700 text-white" : "border border-blue-700 text-blue-800"}`}>{active ? "선택됨" : "검토 선택"}</button></td><td className="border-b p-3"><strong>{text(row as Record<string, unknown>, "productName", "materialName", "englishName") || "이름 정보 없음"}</strong><p className="mt-1 text-xs text-slate-600">{text(row as Record<string, unknown>, "activityName", "activityType")}</p><p className="text-xs text-slate-500">ID {id || "미제공"}</p></td><td className="border-b p-3">{text(row as Record<string, unknown>, "datasetVersion", "version", "dataVersion") || "버전 상세 미제공"}</td><td className="border-b p-3">{text(row as Record<string, unknown>, "geography") || "지역 미제공"}<p className="text-xs text-slate-600">{text(row as Record<string, unknown>, "timePeriod") || "연도 미제공"}</p></td><td className="border-b p-3">{text(row as Record<string, unknown>, "referenceProductUnit", "unit") || "단위 미제공"}</td><td className="border-b p-3">{text(row as Record<string, unknown>, "score") || "점수 미제공"}<p className="text-xs text-slate-600">{text(row as Record<string, unknown>, "indicatorName")}</p></td><td className="border-b p-3">{text(row as Record<string, unknown>, "source", "databaseName") || "출처 상세 확인 필요"}</td></tr>; })}{!datasets.length && <tr><td colSpan={7} className="p-8 text-center text-slate-600">검색어를 넣어 LCI 데이터셋 후보를 찾으세요.</td></tr>}</tbody></table></div>
        </article>
        <article className="rounded-lg border bg-white p-4"><h2 className="text-xl font-black">매핑 검토안</h2>{!selectedTarget ? <p className="mt-3 text-slate-600">왼쪽에서 인벤토리 항목을 선택하세요.</p> : !draft || draft.targetId !== selectedTarget.id ? <p className="mt-3 text-slate-600">후보 검색 후 적합한 데이터셋을 검토 선택하세요. 이 선택은 아직 저장되지 않습니다.</p> : <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-sm font-bold md:col-span-2">선정 근거<textarea className={`${input} mt-1 block min-h-20 w-full`} value={draft.rationale} onChange={event => setDraft({ ...draft, rationale: event.target.value })} placeholder="지역·기술·기준흐름·기간·품질 적합성을 설명"/></label><label className="text-sm font-bold">단위 환산식·근거<textarea className={`${input} mt-1 block min-h-16 w-full`} value={draft.unitConversion} onChange={event => setDraft({ ...draft, unitConversion: event.target.value })} placeholder="단위가 같으면 해당 없음"/></label><label className="text-sm font-bold">지역·연도 차이 근거<textarea className={`${input} mt-1 block min-h-16 w-full`} value={draft.geographyReason} onChange={event => setDraft({ ...draft, geographyReason: event.target.value })} placeholder="대표성 차이와 적용 이유"/></label><p className="rounded bg-slate-50 p-3 text-sm md:col-span-2">선택 데이터셋 ID: <strong>{draft.datasetId}</strong> · 선택 근거 입력 {draft.rationale.trim() ? "완료" : "필요"}</p></div>}
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4"><button type="button" disabled title="프로젝트 ID·레코드 버전·LCA_DATA_STEWARD 권한을 서버에서 검증하는 프로젝트 매핑 저장 API가 확인되지 않았습니다." className="min-h-11 rounded bg-slate-300 px-5 font-bold text-slate-700">프로젝트 매핑 저장 잠금</button><span className="text-sm text-amber-800">검토안은 아직 저장되지 않습니다. 프로젝트 범위 저장 API와 액터 권한 검증을 확인한 후 사용할 수 있습니다.</span></div>{saveIssue.length > 0 && <p className="mt-2 text-sm text-red-700">검토 전 확인: {saveIssue.join(" · ")}</p>}
        </article>
      </section>
    </div>}
    <nav className="mt-5 flex flex-wrap gap-3"><a className="rounded border bg-white p-3 underline" href={`/lca/waste-emissions${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`}>이전: 폐기물·배출물</a><a className="rounded border bg-white p-3 underline" href={`/emission/lca?menu=H1030201${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""}`}>인벤토리 자료 확인</a><a className="rounded border border-blue-700 bg-white p-3 font-bold text-blue-900 underline" href={`/lca/calculation${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`}>다음: LCI 산정 사전 검사 →</a></nav>
    <details className="mt-5 rounded border bg-white p-4"><summary className="font-bold">도움말 · 완료 기준 · QA</summary><div className="mt-3 grid gap-4 md:grid-cols-3"><section><h2 className="font-bold">데이터 적합성</h2><p>기능흐름, 기술, 지역, 기준연도와 데이터 출처·라이선스를 비교합니다. 검색 순위만으로 자동 확정하지 않습니다.</p></section><section><h2 className="font-bold">단위·대표성</h2><p>인벤토리 단위와 기준흐름 단위가 다르면 환산식을 기록합니다. 지역·연도가 다르면 대표성 근거를 남겨 검토합니다.</p></section><section><h2 className="font-bold">완료 기준</h2><p>필수 인벤토리 전체에 승인된 데이터셋 ID·버전·환산 근거가 연결되고, 미매핑 0건과 검토 기록이 확인돼야 합니다.</p></section></div></details>
  </main>;
}
