import { PointerEvent, WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Row = Record<string, unknown>;
type Point = { x: number; y: number };
type CanvasNode = { row: Row; x: number; y: number; width: number; height: number; key: string };
type Props = { base: string; en: boolean };

const value = (row: Row, key: string) => String(row[key] ?? "");
const number = (row: Row, key: string) => Number(row[key] ?? 0);
const jsonArray = (input: unknown): Row[] => {
  if (Array.isArray(input)) return input as Row[];
  if (typeof input !== "string" || !input.trim()) return [];
  try { const parsed = JSON.parse(input); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};
const statusStyle = (status: string) => status === "VERIFIED"
  ? "border-emerald-400 bg-emerald-50 text-emerald-900"
  : status === "IMPLEMENTED" ? "border-blue-400 bg-blue-50 text-blue-950" : "border-amber-400 bg-amber-50 text-amber-950";
const previewPath = (route: string) => `${route}${route.includes("?") ? "&" : "?"}canvasPreview=1`;

export function ProfessionalDesignCanvas({ base, en }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [flowEdges, setFlowEdges] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Row>({});
  const [qualitySummary, setQualitySummary] = useState<Row>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [workType, setWorkType] = useState("");
  const [selected, setSelected] = useState<CanvasNode | null>(null);
  const [preview, setPreview] = useState(false);
  const [transform, setTransform] = useState({ x: 36, y: 64, scale: .72 });
  const drag = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`${base}/design/professional-graph`, { credentials: "include" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.message || "설계 지도를 불러오지 못했습니다."); return body; })
      .then(body => { if (active) { setRows(body.items || []); setFlowEdges(body.edges || []); setSummary(body.summary || {}); setQualitySummary(body.qualitySummary || {}); setError(""); } })
      .catch(reason => active && setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [base, refreshVersion]);

  const synchronizeDesign = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setError("");
    try {
      const response = await fetch(`${base}/design/generate-professional-graph`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok || body.success === false) throw new Error(body.message || "설계 그래프 동기화에 실패했습니다.");
      setLastSyncedAt(new Date().toLocaleTimeString());
      setRefreshVersion(current => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSyncing(false);
    }
  }, [base, syncing]);

  const workTypes = useMemo(() => Array.from(new Set(rows.map(row => value(row, "workTypeCode")))).sort(), [rows]);
  const filtered = useMemo(() => rows.filter(row => !workType || value(row, "workTypeCode") === workType), [rows, workType]);
  const layout = useMemo(() => {
    const nodeWidth = 284, nodeHeight = 154, stepGap = 322, rowHeight = 390, groupGap = 90;
    const processes = Array.from(new Map(filtered.map(row => [value(row, "processCode"), row])).values())
      .sort((a, b) => value(a, "workTypeCode").localeCompare(value(b, "workTypeCode")) || number(a, "workflowOrder") - number(b, "workflowOrder"));
    const processY = new Map<string, number>();
    const groupY = new Map<string, number>();
    let y = 110, previous = "";
    processes.forEach(process => {
      const type = value(process, "workTypeCode");
      if (type !== previous) { if (previous) y += groupGap; groupY.set(type, y - 62); previous = type; }
      processY.set(value(process, "processCode"), y); y += rowHeight;
    });
    const duplicateIndex = new Map<string, number>();
    const nodes: CanvasNode[] = filtered.map((row, index) => {
      const process = value(row, "processCode"), step = value(row, "stepCode");
      const duplicateKey = `${process}:${step}`;
      const lane = duplicateIndex.get(duplicateKey) || 0;
      duplicateIndex.set(duplicateKey, lane + 1);
      return {
        row, key: `${value(row, "bindingId")}-${index}`,
        x: 250 + Math.max(0, number(row, "stepOrder") - 1) * stepGap,
        y: (processY.get(process) || 0) + 48 + lane * 166,
        width: nodeWidth, height: nodeHeight,
      };
    });
    const maxStep = Math.max(1, ...filtered.map(row => number(row, "stepOrder")));
    return { nodes, processes, processY, groupY, width: 300 + maxStep * stepGap, height: Math.max(700, y + 120) };
  }, [filtered]);

  const matchingKeys = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return new Set<string>();
    return new Set(layout.nodes.filter(node => ["screenName", "routePath", "processName", "stepName", "actorCode"]
      .some(key => value(node.row, key).toLowerCase().includes(needle))).map(node => node.key));
  }, [layout.nodes, query]);

  const zoomAt = useCallback((next: number, clientX?: number, clientY?: number) => {
    setTransform(current => {
      const scale = Math.min(1.8, Math.max(.08, next));
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect || clientX == null || clientY == null) return { ...current, scale };
      const px = clientX - rect.left, py = clientY - rect.top;
      const worldX = (px - current.x) / current.scale, worldY = (py - current.y) / current.scale;
      return { scale, x: px - worldX * scale, y: py - worldY * scale };
    });
  }, []);
  const fitAll = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect(); if (!rect) return;
    const scale = Math.min(.9, Math.max(.08, Math.min((rect.width - 48) / layout.width, (rect.height - 48) / layout.height)));
    setTransform({ scale, x: Math.max(24, (rect.width - layout.width * scale) / 2), y: 24 });
  }, [layout.height, layout.width]);
  const reset = useCallback(() => setTransform({ x: 36, y: 64, scale: .72 }), []);
  const jumpToMatch = useCallback(() => {
    const target = layout.nodes.find(node => matchingKeys.has(node.key));
    const rect = viewportRef.current?.getBoundingClientRect(); if (!target || !rect) return;
    const scale = Math.max(.65, transform.scale);
    setTransform({ scale, x: rect.width / 2 - (target.x + target.width / 2) * scale, y: rect.height / 2 - (target.y + target.height / 2) * scale });
    setSelected(target);
  }, [layout.nodes, matchingKeys, transform.scale]);
  const onWheel = (event: WheelEvent<HTMLDivElement>) => { event.preventDefault(); zoomAt(transform.scale * (event.deltaY > 0 ? .88 : 1.14), event.clientX, event.clientY); };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button,a,input,select,aside")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: { x: transform.x, y: transform.y } };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current; if (!state || state.pointerId !== event.pointerId) return;
    setTransform(current => ({ ...current, x: state.origin.x + event.clientX - state.start.x, y: state.origin.y + event.clientY - state.start.y }));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => { if (drag.current?.pointerId === event.pointerId) drag.current = null; };

  const edges = useMemo(() => {
    const byProcess = new Map<string, CanvasNode[]>();
    layout.nodes.forEach(node => { const key = value(node.row, "processCode"); const list = byProcess.get(key) || []; list.push(node); byProcess.set(key, list); });
    return flowEdges.flatMap(edge => {
      const nodes = byProcess.get(value(edge, "processCode")) || [];
      const from = nodes.find(node => value(node.row, "stepCode") === value(edge, "fromStepCode"));
      const to = nodes.find(node => value(node.row, "stepCode") === value(edge, "toStepCode"));
      return from && to ? [{ from, to, edge }] : [];
    });
  }, [flowEdges, layout.nodes]);
  const edgeColor = (type: string) => type === "REJECT" ? "#dc2626" : type === "RETRY" ? "#d97706" : type === "BRANCH" ? "#7c3aed" : type === "PARALLEL" || type === "JOIN" ? "#0891b2" : "#8aa1b8";

  return <section className="overflow-hidden rounded-2xl border border-slate-300 bg-[#eef3f8] shadow-sm">
    <header className="relative z-30 border-b bg-white p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div><p className="text-xs font-black tracking-[.16em] text-[#246beb]">PROFESSIONAL DESIGN CANVAS</p><h2 className="mt-1 text-xl font-black text-[#052b57]">{en ? "Interactive screen and workflow map" : "전체 화면·업무 인터랙션 지도"}</h2><p className="mt-1 text-sm text-slate-600">화면을 확대·축소하고 드래그하면서 액터, 프로세스, 단계, 기능, 데이터 계보와 실제 업무를 확인합니다.</p></div>
        <div className="flex flex-wrap gap-2 text-sm">
          {[['프로세스', summary.processCount], ['단계', summary.stepCount], ['고유 화면', summary.screenCount], ['연결', summary.bindingCount]].map(([label, metric]) => <span className="rounded-full bg-slate-100 px-3 py-2 font-bold text-slate-700" key={String(label)}>{String(label)} <strong className="text-[#052b57]">{String(metric ?? 0)}</strong></span>)}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 lg:flex-row">
        <select aria-label="업무 종류" className="h-11 rounded-lg border bg-white px-3 text-sm font-bold" value={workType} onChange={event => { setWorkType(event.target.value); setSelected(null); reset(); }}><option value="">전체 업무 종류</option>{workTypes.map(item => <option key={item}>{item}</option>)}</select>
        <div className="flex min-w-0 flex-1"><input aria-label="화면 검색" className="h-11 min-w-0 flex-1 rounded-l-lg border px-3 text-sm" placeholder="화면명, 경로, 프로세스, 단계, 액터 검색" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === "Enter" && jumpToMatch()} /><button className="h-11 rounded-r-lg bg-[#246beb] px-4 font-bold text-white" onClick={jumpToMatch} type="button">찾기 {matchingKeys.size ? `(${matchingKeys.size})` : ""}</button></div>
        <div className="flex overflow-hidden rounded-lg border bg-white"><button aria-label="축소" className="h-11 w-11 text-xl font-bold hover:bg-slate-100" onClick={() => zoomAt(transform.scale / 1.2)} type="button">−</button><span className="flex min-w-16 items-center justify-center border-x text-xs font-black">{Math.round(transform.scale * 100)}%</span><button aria-label="확대" className="h-11 w-11 text-xl font-bold hover:bg-slate-100" onClick={() => zoomAt(transform.scale * 1.2)} type="button">＋</button></div>
        <button className="h-11 rounded-lg border bg-white px-4 text-sm font-bold" onClick={fitAll} type="button">전체 맞춤</button><button className="h-11 rounded-lg border bg-white px-4 text-sm font-bold" onClick={reset} type="button">100% 위치</button>
        <button className="h-11 rounded-lg bg-[#052b57] px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60" disabled={syncing || loading} onClick={synchronizeDesign} type="button">{syncing ? "설계 동기화 중…" : "설계 전체 동기화"}</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold"><span className="text-slate-500">고객 사용 품질</span><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">사용 가능 {String(qualitySummary.customerReadyCount ?? 0)}</span><span className="rounded-full bg-red-100 px-3 py-1.5 text-red-800">계약 보완 {String(qualitySummary.contractRepairCount ?? 0)}</span><span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-900">구현 필요 {String(qualitySummary.implementationRequiredCount ?? 0)}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">평균 {String(qualitySummary.averageScore ?? 0)}점</span><span className="rounded-full bg-purple-100 px-3 py-1.5 text-purple-800">DB 계보 누락 {String(qualitySummary.dataLineageGapCount ?? 0)}</span><span className="rounded-full bg-cyan-100 px-3 py-1.5 text-cyan-800">테스트 보완 {String(qualitySummary.testGapCount ?? 0)}</span></div>
      {lastSyncedAt && <p className="mt-2 text-right text-xs font-bold text-emerald-700">DB 설계와 캔버스 동기화 완료 · {lastSyncedAt}</p>}
    </header>

    <div ref={viewportRef} className="relative h-[72vh] min-h-[620px] touch-none cursor-grab overflow-hidden bg-[radial-gradient(#b8c5d3_1px,transparent_1px)] bg-[size:20px_20px] active:cursor-grabbing" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      {loading && <div className="absolute inset-0 z-50 grid place-items-center bg-white/80 font-bold text-[#052b57]">전체 설계 지도를 구성하고 있습니다.</div>}
      {error && <div className="absolute left-4 right-4 top-4 z-50 rounded-xl bg-red-50 p-4 font-bold text-red-800">{error}</div>}
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: layout.width, height: layout.height, transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})` }}>
        {Array.from(layout.groupY.entries()).map(([type, y]) => <div className="absolute left-8 flex items-center gap-3" key={type} style={{ top: y }}><span className="rounded-lg bg-[#052b57] px-4 py-2 text-base font-black text-white">{type}</span><span className="text-sm font-bold text-slate-500">업무 영역</span></div>)}
        {layout.processes.map(process => { const y = layout.processY.get(value(process, "processCode")) || 0; return <div className="absolute left-8 w-52 rounded-xl border border-slate-300 bg-white/90 p-3 shadow-sm" key={value(process, "processCode")} style={{ top: y + 48 }}><span className="text-[11px] font-black text-[#246beb]">{value(process, "processCode")}</span><strong className="mt-1 block text-sm text-[#052b57]">{value(process, "processName")}</strong><span className="mt-2 block text-xs text-slate-500">실행 순서 {value(process, "workflowOrder")}</span></div>; })}
        <svg className="pointer-events-none absolute inset-0 overflow-visible" width={layout.width} height={layout.height} aria-hidden="true"><defs>{["NEXT","BRANCH","REJECT","RETRY","PARALLEL","JOIN","SUBPROCESS","EVENT","EXTERNAL"].map(type => <marker id={`canvas-arrow-${type}`} key={type} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor(type)} /></marker>)}</defs>{edges.map((item, index) => { const type=value(item.edge,"edgeType")||"NEXT", color=edgeColor(type), midX=(item.from.x+item.from.width+item.to.x)/2, midY=(item.from.y+item.to.y)/2+70; return <g key={`${value(item.edge,"edgeId")}-${index}`}><path d={`M ${item.from.x + item.from.width} ${item.from.y + 76} C ${item.from.x + item.from.width + 46} ${item.from.y + 76}, ${item.to.x - 46} ${item.to.y + 76}, ${item.to.x} ${item.to.y + 76}`} fill="none" markerEnd={`url(#canvas-arrow-${type})`} stroke={color} strokeDasharray={value(item.edge,"reviewStatus")==="REVIEW_REQUIRED"?"8 6":undefined} strokeWidth="3"/><g transform={`translate(${midX},${midY})`}><rect x="-44" y="-11" width="88" height="22" rx="11" fill="white" stroke={color}/><text fill={color} fontSize="10" fontWeight="800" textAnchor="middle" dominantBaseline="middle">{type}</text></g></g>; })}</svg>
        {layout.nodes.map(node => { const row = node.row, matched = matchingKeys.has(node.key), chosen = selected?.key === node.key; return <button className={`absolute overflow-hidden rounded-xl border-2 p-3 text-left shadow-md transition-[box-shadow,border-color] hover:shadow-xl ${statusStyle(value(row, "implementationStatus"))} ${matched ? "ring-4 ring-fuchsia-400" : ""} ${chosen ? "ring-4 ring-[#052b57]" : ""}`} key={node.key} style={{ left: node.x, top: node.y, width: node.width, height: node.height }} onClick={event => { event.stopPropagation(); setSelected(node); setPreview(false); }} type="button">
          <div className="flex items-start justify-between gap-2"><span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-black">{value(row, "audience")} · {value(row, "entryMode")}</span><span className="text-[10px] font-black">{value(row, "professionalScore")}점 · {value(row, "customerReadiness")}</span></div>
          <strong className="mt-2 block line-clamp-2 text-sm">{value(row, "screenName")}</strong><span className="mt-1 block truncate text-[11px] font-bold opacity-75">{value(row, "stepName")} · {value(row, "actorCode")}</span><span className="mt-2 block truncate rounded bg-white/70 px-2 py-1 font-mono text-[10px]">{value(row, "routePath")}</span>
        </button>; })}
      </div>

      <div className="absolute bottom-4 left-4 z-20 flex max-w-[70%] flex-wrap gap-2 rounded-xl border bg-white/95 p-2 text-[11px] font-bold shadow"><span className="rounded bg-emerald-100 px-2 py-1 text-emerald-900">VERIFIED</span><span className="rounded bg-blue-100 px-2 py-1 text-blue-900">IMPLEMENTED</span><span className="rounded bg-amber-100 px-2 py-1 text-amber-900">DESIGN ONLY</span>{["NEXT","BRANCH","REJECT","RETRY","PARALLEL","JOIN"].map(type=><span className="rounded border px-2 py-1" key={type} style={{borderColor:edgeColor(type),color:edgeColor(type)}}>{type}</span>)}<span className="px-2 py-1 text-slate-500">실선: 확정 · 점선: 검토 필요</span></div>
      <div className="absolute bottom-4 right-4 z-20 h-28 w-48 overflow-hidden rounded-xl border bg-white/95 shadow" aria-label="미니맵"><div className="absolute inset-0 origin-top-left" style={{ transform: `scale(${180 / layout.width},${100 / layout.height})`, transformOrigin: "8px 8px" }}>{layout.nodes.map(node => <span className="absolute rounded bg-[#246beb]" key={`mini-${node.key}`} style={{ left: node.x, top: node.y, width: Math.max(30, node.width), height: Math.max(22, node.height) }} />)}</div><span className="absolute bottom-1 left-2 text-[10px] font-black text-slate-500">전체 지도</span></div>

      {selected && <aside className="absolute bottom-0 right-0 top-0 z-40 w-full max-w-[470px] overflow-y-auto border-l bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white p-5"><div><p className="text-xs font-black text-[#246beb]">{value(selected.row, "workTypeCode")} / {value(selected.row, "processCode")}</p><h3 className="mt-1 text-xl font-black text-[#052b57]">{value(selected.row, "screenName")}</h3></div><button aria-label="상세 닫기" className="rounded-lg border px-3 py-2 font-black" onClick={() => setSelected(null)} type="button">×</button></div>
        <div className="space-y-5 p-5">
          <Info label="업무 단계" text={`${value(selected.row, "stepOrder")}. ${value(selected.row, "stepName")}`} /><div className="grid grid-cols-2 gap-3"><Info label="담당 액터" text={value(selected.row, "actorCode")} /><Info label="상태 전이" text={`${value(selected.row, "fromState")} → ${value(selected.row, "toState")}`} /></div><Info label="실행 명령" text={value(selected.row, "commandCode")} /><Info label="실제 경로" text={value(selected.row, "routePath")} />
          <section><h4 className="font-black text-[#052b57]">전문 품질 계약</h4><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">{[["구조","structureScore"],["데이터","dataScore"],["구현","implementationScore"],["흐름","workflowScore"],["테스트","testScore"]].map(([label,key])=><div className="rounded-lg border bg-slate-50 p-2 text-center" key={key}><span className="block text-[11px] font-bold text-slate-500">{label}</span><strong className="text-sm text-[#052b57]">{value(selected.row,key)}/20</strong></div>)}</div><p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-900">누락: {value(selected.row,"gapCodes") || "없음"}</p></section>
          <div className="flex gap-2"><a className="flex-1 rounded-lg bg-[#246beb] px-4 py-3 text-center font-bold text-white" href={value(selected.row, "routePath")} target="_blank" rel="noreferrer">실제 화면 열기</a><button className="rounded-lg border px-4 py-3 font-bold" onClick={() => setPreview(true)} type="button">미리보기 팝업</button></div>
          <ContractList title="화면 기능" rows={jsonArray(selected.row.capabilities)} primary="name" secondary="capabilityCode" /><ContractList title="입·출력 데이터 계보" rows={jsonArray(selected.row.dataElements)} primary="name" secondary="dataElementCode" /><ContractList title="테스트 시나리오" rows={jsonArray(selected.row.tests)} primary="caseCode" secondary="scope" /><ContractList title="실제 프로젝트 실행 업무" rows={jsonArray(selected.row.actualProjectTasks)} primary="taskName" secondary="status" />
        </div>
      </aside>}
      {selected && preview && <div aria-modal="true" className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" role="dialog" onMouseDown={event => { if (event.target === event.currentTarget) setPreview(false); }}>
        <section className="flex h-[92vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header className="flex items-center justify-between gap-4 border-b bg-white px-4 py-3 sm:px-6">
            <div className="min-w-0"><p className="text-xs font-black text-[#246beb]">LIVE SCREEN PREVIEW</p><h3 className="truncate text-lg font-black text-[#052b57]">{value(selected.row, "screenName")}</h3><p className="truncate font-mono text-xs text-slate-500">{value(selected.row, "routePath")}</p></div>
            <div className="flex shrink-0 gap-2"><a className="rounded-lg bg-[#246beb] px-4 py-2 text-sm font-bold text-white" href={value(selected.row, "routePath")} target="_blank" rel="noreferrer">새 창에서 열기</a><button aria-label="미리보기 팝업 닫기" className="rounded-lg border px-4 py-2 text-sm font-black" onClick={() => setPreview(false)} type="button">닫기</button></div>
          </header>
          <iframe className="min-h-0 flex-1 bg-white" src={previewPath(value(selected.row, "routePath"))} title={`${value(selected.row, "screenName")} 미리보기`} />
        </section>
      </div>}
    </div>
  </section>;
}

function Info({ label, text }: { label: string; text: string }) { return <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block break-words text-sm text-slate-800">{text || "-"}</strong></div>; }
function ContractList({ title, rows, primary, secondary }: { title: string; rows: Row[]; primary: string; secondary: string }) { return <section><div className="flex items-center justify-between"><h4 className="font-black text-[#052b57]">{title}</h4><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{rows.length}</span></div><div className="mt-2 max-h-52 space-y-2 overflow-y-auto">{rows.map((row, index) => <div className="rounded-lg border p-3" key={`${value(row, primary)}-${index}`}><strong className="block text-sm">{value(row, primary) || value(row, secondary) || `항목 ${index + 1}`}</strong><span className="mt-1 block break-all text-xs text-slate-500">{value(row, secondary)}</span></div>)}{!rows.length && <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">등록된 항목이 없습니다.</p>}</div></section>; }
