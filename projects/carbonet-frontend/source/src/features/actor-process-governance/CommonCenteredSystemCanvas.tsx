import { PointerEvent, WheelEvent, useEffect, useMemo, useRef, useState } from "react";

type Row = Record<string, unknown>;
type Props = {
  actors: Row[];
  blueprints: Row[]; mappings: Row[]; onOpen: (tab: string) => void; onRefresh: () => void;
  cases: Row[]; components: Row[]; contracts: Row[];
  pageDesigns: Row[]; processes: Row[]; sections: Row[]; steps: Row[];
};
type NodeKind = "SCREEN" | "COMMON_SCREEN" | "SECTION" | "COMMON_SCHEMA" | "SCREEN_SCHEMA" | "ACTOR" | "PROCESS" | "COMPONENT" | "FIELD" | "API" | "TEST";
type MapNode = { id: string; kind: NodeKind; label: string; sub: string; route: string; processCode: string; x: number; y: number; source: Row };
type MapEdge = { id: string; from: string; to: string; kind: "FLOW" | "USES_SCREEN" | "USES_SECTION" | "USES_SCHEMA" | "USES_COMPONENT" | "USES_FIELD" | "CALLS_API" | "OWNED_BY" | "IMPLEMENTS_PROCESS" | "VERIFIED_BY" };

const W = 164;
const H = 58;
const HUB_W = 178;
const HUB_H = 60;
const SIZE = 15000;
const CENTER = SIZE / 2;
const value = (row: Row | undefined, key: string) => String(row?.[key] ?? "");
const normalizeRoute = (path: string) => path.split("?")[0].replace(/\/+$/, "") || "/";
const kindLabel: Record<NodeKind, string> = { SCREEN: "업무 화면", COMMON_SCREEN: "공통 화면", SECTION: "공통 섹션", COMMON_SCHEMA: "공통 스키마", SCREEN_SCHEMA: "화면 스키마", ACTOR: "액터", PROCESS: "프로세스", COMPONENT: "공통 컴포넌트", FIELD: "필드 계약", API: "API 계약", TEST: "테스트 시나리오" };
const edgeStyle = (kind: MapEdge["kind"]) => {
  if (kind === "FLOW") return ["#64748b", ""];
  if (kind === "USES_SCREEN") return ["#2563eb", "8 6"];
  if (kind === "USES_SECTION") return ["#7c3aed", "4 5"];
  if (kind === "USES_SCHEMA" || kind === "USES_FIELD") return ["#059669", "5 5"];
  if (kind === "CALLS_API") return ["#ea580c", "3 4"];
  if (kind === "OWNED_BY") return ["#db2777", "7 4"];
  if (kind === "VERIFIED_BY") return ["#0891b2", "2 5"];
  return ["#4f46e5", "6 4"];
};
const contractItems = (raw: unknown) => {
  if (!raw) return [] as string[];
  if (Array.isArray(raw)) return raw.map(item => typeof item === "string" ? item : JSON.stringify(item));
  const text = String(raw).trim();
  if (!text) return [] as string[];
  try {
    const parsed = JSON.parse(text);
    return (Array.isArray(parsed) ? parsed : [parsed]).map(item => typeof item === "string" ? item : JSON.stringify(item));
  } catch {
    return text.split(/\s*[,|\n]\s*/).filter(Boolean);
  }
};

export function CommonCenteredSystemCanvas({ actors, blueprints, cases, components, contracts, mappings, onOpen, onRefresh, pageDesigns, processes, sections, steps }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [zoom, setZoom] = useState(0.12);
  const [pan, setPan] = useState({ x: 12, y: 12 });
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"OVERVIEW" | "INFINITE">("OVERVIEW");
  const [processFocus, setProcessFocus] = useState("ALL");

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => { onRefresh(); setLastRefresh(new Date()); }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, onRefresh]);

  const model = useMemo(() => {
    const processMap = new Map(processes.map(row => [value(row, "processCode"), row]));
    const stepMap = new Map(steps.map(row => [`${value(row, "processCode")}::${value(row, "stepCode")}`, row]));
    const designByRoute = new Map(pageDesigns.map(row => [normalizeRoute(value(row, "actualRoutePath") || value(row, "plannedRoutePath") || value(row, "routePath")), row]));
    const mappingsByRoute = new Map<string, Row[]>();
    mappings.forEach(row => {
      const route = normalizeRoute(value(row, "routePath"));
      const rows = mappingsByRoute.get(route) ?? [];
      rows.push(row);
      mappingsByRoute.set(route, rows);
    });
    const routeCounts = new Map<string, number>();
    blueprints.forEach(row => {
      const route = normalizeRoute(value(row, "routePath"));
      if (route !== "/") routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1);
    });
    const commonRoutes = [...routeCounts.entries()].filter(([, count]) => count > 1).sort((a,b) => b[1] - a[1]);
    const entities = [...new Set(pageDesigns.map(row => value(row, "primaryEntity")).filter(Boolean))].sort();
    const commonEntities = entities.filter(entity => pageDesigns.filter(row => value(row, "primaryEntity") === entity).length > 1);
    const screenEntities = entities.filter(entity => !commonEntities.includes(entity));
    const hubs: MapNode[] = [];
    const placeHubGrid = (items: Array<{ id: string; label: string; sub: string; kind: NodeKind; source: Row }>, startX: number, startY: number, columns: number) => {
      items.forEach((item, index) => hubs.push({ ...item, route: "", processCode: "", x: startX + (index % columns) * (HUB_W + 18), y: startY + Math.floor(index / columns) * (HUB_H + 18) }));
    };
    placeHubGrid(commonRoutes.map(([route,count]) => ({ id:`common-route:${route}`, label:route, sub:`${count}개 화면 재사용`, kind:"COMMON_SCREEN" as const, source:{} })), CENTER - 980, CENTER - 1950, 10);
    placeHubGrid(sections.map(row => ({ id:`section:${value(row,"sectionId")}`, label:value(row,"sectionName") || value(row,"sectionId"), sub:value(row,"sectionType"), kind:"SECTION" as const, source:row })), CENTER - 2050, CENTER - 850, 5);
    placeHubGrid(commonEntities.map(entity => ({ id:`schema:${entity}`, label:entity, sub:`${pageDesigns.filter(row => value(row,"primaryEntity")===entity).length}개 화면`, kind:"COMMON_SCHEMA" as const, source:{} })), CENTER + 1050, CENTER - 850, 5);
    placeHubGrid(screenEntities.map(entity => ({ id:`screen-schema:${entity}`, label:entity, sub:"화면 전용", kind:"SCREEN_SCHEMA" as const, source:{} })), CENTER - 980, CENTER + 1350, 10);
    placeHubGrid(actors.map(row => ({ id:`actor:${value(row,"actorCode")}`, label:value(row,"actorName") || value(row,"actorCode"), sub:value(row,"actorType"), kind:"ACTOR" as const, source:row })), CENTER - 2050, CENTER + 350, 5);
    placeHubGrid(processes.map(row => ({ id:`process:${value(row,"processCode")}`, label:value(row,"processName") || value(row,"processCode"), sub:value(row,"domainCode"), kind:"PROCESS" as const, source:row })), CENTER + 1050, CENTER + 350, 5);
    placeHubGrid(components.map(row => ({ id:`component:${value(row,"componentId")}`, label:value(row,"componentName") || value(row,"componentId"), sub:value(row,"componentType"), kind:"COMPONENT" as const, source:row })), CENTER - 2050, CENTER - 1450, 5);

    const contractByKey = new Map(contracts.map(row => [`${value(row,"processCode")}::${value(row,"stepCode")}::${value(row,"audience")}`, row]));
    const fieldItems = new Map<string, Row>();
    const apiItems = new Map<string, Row>();
    contracts.forEach(contract => {
      contractItems(contract.fieldContract).forEach(item => fieldItems.set(item, contract));
      contractItems(contract.apiContract).forEach(item => apiItems.set(item, contract));
    });
    placeHubGrid([...fieldItems.entries()].map(([item,source]) => ({ id:`field:${item}`, label:item, sub:"필드·검증·DB 계약", kind:"FIELD" as const, source })), CENTER + 1050, CENTER - 1450, 5);
    placeHubGrid([...apiItems.entries()].map(([item,source]) => ({ id:`api:${item}`, label:item, sub:"요청·응답 계약", kind:"API" as const, source })), CENTER - 2050, CENTER + 900, 5);
    placeHubGrid(cases.map(row => ({ id:`test:${value(row,"caseCode") || value(row,"testCaseCode")}`, label:value(row,"caseName") || value(row,"testCaseName") || value(row,"caseCode"), sub:value(row,"expectedResult"), kind:"TEST" as const, source:row })), CENTER + 1050, CENTER + 900, 5);

    const screenRows = blueprints.map((row, index) => {
      const processCode = value(row, "processCode");
      const step = stepMap.get(`${processCode}::${value(row,"stepCode")}`);
      const route = value(row, "routePath") || value(step, "userPath") || value(step, "adminPath");
      const normalized = normalizeRoute(route);
      const ringCapacity = 120;
      const ring = Math.floor(index / ringCapacity);
      const slot = index % ringCapacity;
      const count = Math.min(ringCapacity, blueprints.length - ring * ringCapacity);
      const angle = (slot / Math.max(1,count)) * Math.PI * 2 - Math.PI / 2;
      const radius = 3300 + ring * 430;
      return {
        id: value(row,"blueprintCode") || `screen:${index}`, kind: "SCREEN" as const,
        label: value(row,"pageName") || value(step,"stepName") || value(row,"stepCode"),
        sub: `${value(processMap.get(processCode),"processName") || processCode} · ${value(row,"stepCode")}`,
        route, processCode, x: CENTER + Math.cos(angle) * radius - W / 2, y: CENTER + Math.sin(angle) * radius - H / 2, source: row, normalized,
      };
    });
    const nodes: MapNode[] = [...hubs, ...screenRows];
    const edges: MapEdge[] = [];
    const nodeByRoute = new Map(commonRoutes.map(([route]) => [route, `common-route:${route}`]));
    const sectionIds = new Set(sections.map(row => value(row,"sectionId")));
    screenRows.forEach(screen => {
      const design = designByRoute.get(screen.normalized);
      const entity = value(design,"primaryEntity");
      const schemaId = commonEntities.includes(entity) ? `schema:${entity}` : entity ? `screen-schema:${entity}` : "";
      if (schemaId && hubs.some(node => node.id === schemaId)) edges.push({ id:`schema-edge:${screen.id}`, from:screen.id, to:schemaId, kind:"USES_SCHEMA" });
      if (screen.processCode && hubs.some(node => node.id === `process:${screen.processCode}`)) edges.push({ id:`process-edge:${screen.id}`, from:screen.id, to:`process:${screen.processCode}`, kind:"IMPLEMENTS_PROCESS" });
      const actorCode = value(screen.source,"actorCode");
      if (actorCode && hubs.some(node => node.id === `actor:${actorCode}`)) edges.push({ id:`actor-edge:${screen.id}`, from:screen.id, to:`actor:${actorCode}`, kind:"OWNED_BY" });
      const commonId = nodeByRoute.get(screen.normalized);
      if (commonId) edges.push({ id:`common-edge:${screen.id}`, from:screen.id, to:commonId, kind:"USES_SCREEN" });
      (mappingsByRoute.get(screen.normalized) ?? []).forEach((mapping,index) => {
        const sectionId = value(mapping,"sectionId");
        if (sectionIds.has(sectionId)) edges.push({ id:`section-edge:${screen.id}:${sectionId}:${index}`, from:screen.id, to:`section:${sectionId}`, kind:"USES_SECTION" });
        const componentId = value(mapping,"componentId");
        if (componentId && hubs.some(node => node.id === `component:${componentId}`)) edges.push({ id:`component-edge:${screen.id}:${componentId}:${index}`, from:screen.id, to:`component:${componentId}`, kind:"USES_COMPONENT" });
      });
      const contract = contractByKey.get(`${screen.processCode}::${value(screen.source,"stepCode")}::${value(screen.source,"audience")}`)
        ?? contracts.find(row => value(row,"processCode") === screen.processCode && value(row,"stepCode") === value(screen.source,"stepCode"));
      contractItems(contract?.fieldContract).forEach((item,index) => edges.push({ id:`field-edge:${screen.id}:${index}`, from:screen.id, to:`field:${item}`, kind:"USES_FIELD" }));
      contractItems(contract?.apiContract).forEach((item,index) => edges.push({ id:`api-edge:${screen.id}:${index}`, from:screen.id, to:`api:${item}`, kind:"CALLS_API" }));
      cases.filter(row => value(row,"processCode") === screen.processCode).forEach((test,index) => {
        const testId = value(test,"caseCode") || value(test,"testCaseCode");
        if (testId) edges.push({ id:`test-edge:${screen.id}:${index}`, from:screen.id, to:`test:${testId}`, kind:"VERIFIED_BY" });
      });
    });
    const screensByProcess = new Map<string, typeof screenRows>();
    screenRows.forEach(node => { const rows = screensByProcess.get(node.processCode) ?? []; rows.push(node); screensByProcess.set(node.processCode,rows); });
    screensByProcess.forEach(rows => {
      rows.sort((a,b) => Number(stepMap.get(`${a.processCode}::${value(a.source,"stepCode")}`)?.stepOrder ?? 0) - Number(stepMap.get(`${b.processCode}::${value(b.source,"stepCode")}`)?.stepOrder ?? 0));
      rows.slice(1).forEach((node,index) => edges.push({ id:`flow:${rows[index].id}:${node.id}`, from:rows[index].id, to:node.id, kind:"FLOW" }));
    });
    return { nodes, edges, nodeMap:new Map(nodes.map(node => [node.id,node])), counts:{ screens:screenRows.length, commonScreens:commonRoutes.length, sections:sections.length, schemas:entities.length, actors:actors.length, processes:processes.length, components:components.length, fields:fieldItems.size, apis:apiItems.size, tests:cases.length } };
  }, [actors, blueprints, cases, components, contracts, mappings, pageDesigns, processes, sections, steps]);

  const processSummaries = useMemo(() => processes.map((process, index) => {
    const processCode = value(process, "processCode");
    const screens = model.nodes.filter(node => node.kind === "SCREEN" && node.processCode === processCode);
    const schemas = new Set(screens.map(screen => {
      const design = pageDesigns.find(row => normalizeRoute(value(row, "actualRoutePath") || value(row, "plannedRoutePath") || value(row, "routePath")) === normalizeRoute(screen.route));
      return value(design, "primaryEntity");
    }).filter(Boolean));
    return { processCode, processName:value(process,"processName") || processCode, screenCount:screens.length, schemaCount:schemas.size, index };
  }).filter(item => item.screenCount > 0), [model.nodes, pageDesigns, processes]);
  const visibleIds = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ko-KR");
    return new Set(model.nodes.filter(node =>
      (processFocus === "ALL" || node.kind !== "SCREEN" || node.processCode === processFocus) &&
      (kindFilter === "ALL" || node.kind === kindFilter) &&
      (!needle || `${node.label} ${node.sub} ${node.route}`.toLocaleLowerCase("ko-KR").includes(needle))
    ).map(node => node.id));
  }, [kindFilter, model.nodes, processFocus, query]);
  const selected = model.nodeMap.get(selectedId);
  const related = useMemo(() => selected ? model.edges.filter(edge => edge.from === selected.id || edge.to === selected.id).map(edge => ({ edge, node:model.nodeMap.get(edge.from === selected.id ? edge.to : edge.from) })).filter(item => item.node) : [], [model, selected]);
  const fit = () => { const view=viewportRef.current;if(!view)return;setZoom(Math.max(.055,Math.min(.5,Math.min((view.clientWidth-24)/SIZE,(view.clientHeight-24)/SIZE))));setPan({x:12,y:12}); };
  const wheel = (event: WheelEvent<HTMLDivElement>) => { event.preventDefault();const rect=event.currentTarget.getBoundingClientRect(),px=event.clientX-rect.left,py=event.clientY-rect.top,next=Math.max(.055,Math.min(1.5,zoom*(event.deltaY>0?.88:1.12))),wx=(px-pan.x)/zoom,wy=(py-pan.y)/zoom;setZoom(next);setPan({x:px-wx*next,y:py-wy*next}); };
  const down = (event: PointerEvent<HTMLDivElement>) => { if((event.target as HTMLElement).closest("button,a,input,select,label"))return;event.currentTarget.setPointerCapture(event.pointerId);dragRef.current={x:event.clientX,y:event.clientY,px:pan.x,py:pan.y}; };
  const move = (event: PointerEvent<HTMLDivElement>) => { if(dragRef.current)setPan({x:dragRef.current.px+event.clientX-dragRef.current.x,y:dragRef.current.py+event.clientY-dragRef.current.y}); };

  return <div className="space-y-4">
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><p className="text-xs font-black tracking-[.12em] text-blue-700">COMMON-CENTERED SYSTEM MAP</p><h2 className="mt-1 text-2xl font-black text-[#052b57]">공통 자산을 중심으로 전체 설계 관계를 연결합니다</h2><p className="mt-2 text-sm text-slate-600">화면·액터·프로세스·섹션·컴포넌트·필드·API·테스트의 실제 계약을 한 그래프에서 추적합니다.</p></div><div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 xl:grid-cols-6">{Object.entries(model.counts).map(([key,count])=><div className="rounded-xl bg-slate-50 p-3" key={key}><span className="text-xs font-bold text-slate-500">{{screens:"화면",commonScreens:"공통 화면",sections:"섹션",schemas:"스키마",actors:"액터",processes:"프로세스",components:"컴포넌트",fields:"필드",apis:"API",tests:"테스트"}[key as keyof typeof model.counts]}</span><strong className="block text-xl text-[#052b57]">{count}</strong></div>)}</div></div>
      <div className="mt-4 flex flex-wrap gap-2"><button className={`min-h-11 rounded-lg px-4 font-bold ${viewMode==="OVERVIEW"?"bg-[#052b57] text-white":"border"}`} onClick={()=>setViewMode("OVERVIEW")} type="button">한눈에 보기</button><button className={`min-h-11 rounded-lg px-4 font-bold ${viewMode==="INFINITE"?"bg-[#052b57] text-white":"border"}`} onClick={()=>setViewMode("INFINITE")} type="button">무한 캔버스</button><select aria-label="프로세스 집중 보기" className="h-11 min-w-60 rounded-lg border bg-white px-3" onChange={event=>setProcessFocus(event.target.value)} value={processFocus}><option value="ALL">전체 프로세스</option>{processSummaries.map(item=><option key={item.processCode} value={item.processCode}>{item.processName} · {item.screenCount}화면</option>)}</select></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_14rem_auto]"><input aria-label="지도 검색" className="h-11 rounded-lg border px-3" onChange={event=>setQuery(event.target.value)} placeholder="화면·경로·스키마·섹션 검색" value={query}/><select aria-label="자산 유형" className="h-11 rounded-lg border bg-white px-3" onChange={event=>setKindFilter(event.target.value)} value={kindFilter}><option value="ALL">전체 유형</option>{Object.entries(kindLabel).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-lg border px-3 font-bold" onClick={fit} type="button">전체 맞춤</button><button className="min-h-11 rounded-lg border px-3 font-bold" onClick={()=>{onRefresh();setLastRefresh(new Date());}} type="button">설계 다시 불러오기</button><label className="flex min-h-11 items-center gap-2 rounded-lg border px-3 font-bold"><input checked={autoRefresh} onChange={event=>setAutoRefresh(event.target.checked)} type="checkbox"/>30초 자동 갱신</label></div></div>
      <p className="mt-3 text-right text-xs text-slate-500">마지막 갱신 {lastRefresh.toLocaleTimeString("ko-KR")} · 표시 {visibleIds.size}/{model.nodes.length}</p>
    </section>
    {viewMode === "OVERVIEW" && <SystemOverview
      counts={model.counts}
      onSelect={code=>{setProcessFocus(code);setViewMode("INFINITE");requestAnimationFrame(fit)}}
      processes={processSummaries}
    />}
    {viewMode === "INFINITE" && <section className="overflow-hidden rounded-2xl border bg-slate-100">
      <div className="relative h-[76vh] min-h-[650px] cursor-grab touch-none overflow-hidden active:cursor-grabbing" onPointerCancel={()=>{dragRef.current=null}} onPointerDown={down} onPointerMove={move} onPointerUp={()=>{dragRef.current=null}} onWheel={wheel} ref={viewportRef}>
        <div className="absolute origin-top-left" style={{height:SIZE,width:SIZE,transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}}>
          <div className="absolute rounded-[160px] border-[14px] border-double border-blue-300 bg-white/80" style={{height:5000,left:CENTER-2500,top:CENTER-2500,width:5000}}><p className="pt-12 text-center text-4xl font-black text-[#052b57]">공통 자산 허브</p></div>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0" height={SIZE} width={SIZE}><defs><marker id="common-map-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0 0L8 4L0 8Z" fill="context-stroke"/></marker></defs>{model.edges.filter(edge=>visibleIds.has(edge.from)&&visibleIds.has(edge.to)).map(edge=>{const from=model.nodeMap.get(edge.from),to=model.nodeMap.get(edge.to);if(!from||!to)return null;const [stroke,dash]=edgeStyle(edge.kind);return <path d={`M ${from.x+W/2} ${from.y+H/2} Q ${CENTER} ${CENTER} ${to.x+(to.kind==="SCREEN"?W:HUB_W)/2} ${to.y+(to.kind==="SCREEN"?H:HUB_H)/2}`} fill="none" key={edge.id} markerEnd="url(#common-map-arrow)" opacity={edge.kind==="FLOW"?.26:.56} stroke={stroke} strokeDasharray={dash||undefined} strokeWidth={edge.kind==="FLOW"?2:3}/>})}</svg>
          {model.nodes.map(node=>!visibleIds.has(node.id)?null:<button className={`absolute overflow-hidden rounded-xl bg-white px-3 py-2 text-left shadow-sm ${node.kind==="SCREEN"?"border border-slate-300":"border-4 border-double"} ${selectedId===node.id?"ring-8 ring-cyan-300":""}`} key={node.id} onClick={()=>setSelectedId(node.id)} style={{height:node.kind==="SCREEN"?H:HUB_H,left:node.x,top:node.y,width:node.kind==="SCREEN"?W:HUB_W}} type="button"><span className="block truncate text-[10px] font-black text-blue-700">{kindLabel[node.kind]}</span><strong className="block truncate text-xs text-[#052b57]">{node.label}</strong><small className="block truncate text-[9px] text-slate-500">{node.sub||node.route}</small></button>)}
        </div>
        <div className="absolute bottom-4 left-4 flex overflow-hidden rounded-lg border bg-white shadow"><button className="h-11 w-11 font-black" onClick={()=>setZoom(v=>Math.max(.055,v-.05))} type="button">−</button><button className="h-11 min-w-16 border-x text-xs font-black" onClick={fit} type="button">{Math.round(zoom*100)}%</button><button className="h-11 w-11 font-black" onClick={()=>setZoom(v=>Math.min(1.5,v+.05))} type="button">+</button></div>
      </div>
    </section>}
    {selected&&<section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-black text-blue-700">{kindLabel[selected.kind]}</p><h3 className="mt-1 text-xl font-black text-[#052b57]">{selected.label}</h3><p className="mt-1 font-mono text-xs text-slate-500">{selected.route||selected.sub}</p></div><div className="flex gap-2">{selected.route.startsWith("/")&&<a className="rounded-lg bg-[#246beb] px-4 py-3 font-bold text-white" href={selected.route}>실제 화면</a>}<button className="rounded-lg border px-4 py-3 font-bold" onClick={()=>onOpen(selected.kind==="SECTION"||selected.kind==="COMPONENT"?"design":"page-fields")} type="button">설계 수정</button></div></div><h4 className="mt-5 font-black">직접 영향 관계 {related.length}개</h4><p className="mt-1 text-sm text-slate-600">선택 자산을 수정할 때 함께 검토해야 하는 화면·데이터·API·권한·테스트입니다.</p><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{related.slice(0,200).map(({edge,node})=><button className="rounded-lg border p-3 text-left hover:bg-blue-50" key={edge.id} onClick={()=>node&&setSelectedId(node.id)} type="button"><span className="text-[10px] font-black text-blue-700">{edge.kind}</span><b className="block truncate text-sm">{node?.label}</b><small className="mt-1 block truncate text-slate-500">{node && kindLabel[node.kind]}</small></button>)}</div></section>}
  </div>;
}

function SystemOverview({ counts, onSelect, processes }: {
  counts: Record<string, number>;
  onSelect: (code:string)=>void;
  processes: Array<{ processCode:string; processName:string; screenCount:number; schemaCount:number; index:number }>;
}) {
  const width=1600,height=Math.max(900,Math.ceil(processes.length/18)*220+620),cx=width/2,cy=height/2;
  return <section className="overflow-hidden rounded-2xl border bg-[#eef4fb] p-3">
    <div className="relative mx-auto min-h-[760px] w-full overflow-hidden rounded-xl bg-white" style={{height}}>
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>{processes.map((item,index)=>{const angle=index/processes.length*Math.PI*2-Math.PI/2,rx=Math.min(650,width*.39),ry=Math.min(height*.4,430),x=cx+Math.cos(angle)*rx,y=cy+Math.sin(angle)*ry;return <path d={`M ${cx} ${cy} Q ${(cx+x)/2+Math.sin(angle)*90} ${(cy+y)/2-Math.cos(angle)*90} ${x} ${y}`} fill="none" key={item.processCode} opacity=".48" stroke="#246beb" strokeWidth="2"/>})}</svg>
      <div className="absolute left-1/2 top-1/2 w-[min(34rem,45vw)] -translate-x-1/2 -translate-y-1/2 rounded-[3rem] border-8 border-double border-blue-400 bg-[#052b57] p-8 text-center text-white shadow-2xl"><p className="text-xs font-black tracking-[.15em] text-blue-200">COMMON ASSET CORE</p><h3 className="mt-2 text-2xl font-black">공통 자산 허브</h3><div className="mt-5 grid grid-cols-2 gap-2 text-sm"><span className="rounded-xl bg-white/10 p-3">공통 화면 <b className="block text-xl">{counts.commonScreens}</b></span><span className="rounded-xl bg-white/10 p-3">공통 섹션 <b className="block text-xl">{counts.sections}</b></span><span className="rounded-xl bg-white/10 p-3">스키마 <b className="block text-xl">{counts.schemas}</b></span><span className="rounded-xl bg-white/10 p-3">전체 화면 <b className="block text-xl">{counts.screens}</b></span></div></div>
      {processes.map((item,index)=>{const angle=index/processes.length*Math.PI*2-Math.PI/2,rx=Math.min(650,width*.39),ry=Math.min(height*.4,430),left=50+(Math.cos(angle)*rx/width)*100,top=50+(Math.sin(angle)*ry/height)*100;return <button className="absolute w-44 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-blue-300 bg-white p-3 text-left shadow-md hover:border-blue-700 hover:bg-blue-50" key={item.processCode} onClick={()=>onSelect(item.processCode)} style={{left:`${left}%`,top:`${top}%`}} type="button"><strong className="block truncate text-sm text-[#052b57]">{item.processName}</strong><span className="mt-1 block text-xs font-bold text-blue-700">{item.screenCount}화면 · {item.schemaCount}스키마</span></button>})}
    </div>
  </section>;
}
