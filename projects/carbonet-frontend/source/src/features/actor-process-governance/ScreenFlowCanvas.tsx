import { PointerEvent, WheelEvent, useMemo, useRef, useState } from "react";

type Row = Record<string, unknown>;
type Props = { actors: Row[]; bindings: Row[]; blueprints: Row[]; processes: Row[]; steps: Row[] };
type FlowNode = {
  id: string; processCode: string; processName: string; stepCode: string; stepName: string;
  stepOrder: number; actorCode: string; actorName: string; pageName: string; routePath: string;
  screenType: string; validationStatus: string; popup: boolean; shared: boolean; sharedCount: number;
  commonFeatures: string[]; x: number; y: number;
};
type FlowEdge = { id: string; from: string; to: string; kind: "NEXT" | "REUSE" | "POPUP" };

const NODE_WIDTH = 224;
const NODE_HEIGHT = 82;
const LANE_WIDTH = 272;
const NODE_GAP = 34;
const LANE_GAP = 42;
const HEADER_HEIGHT = 58;
const CANVAS_PADDING = 48;
const COLUMN_COUNT = 5;
const value = (row: Row | undefined, key: string) => String(row?.[key] ?? "");
const numeric = (row: Row | undefined, key: string) => Number(row?.[key] ?? 0);
const normalizeRoute = (path: string) => path.split("?")[0].replace(/\/+$/, "") || "/";
const isPopup = (row: Row, step: Row | undefined) => /POPUP|MODAL|DIALOG|DRAWER|LOOKUP|SEARCH/i.test([
  value(row, "screenType"), value(row, "templateCode"), value(row, "pageName"),
  value(row, "routePath"), value(step, "stepName"), value(step, "commandCode"),
].join(" "));
const edgeColor = (kind: FlowEdge["kind"]) => kind === "POPUP" ? "#7c3aed" : kind === "REUSE" ? "#d97706" : "#64748b";

export function ScreenFlowCanvas({ actors, bindings, blueprints, processes, steps }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [query, setQuery] = useState("");
  const [processFilter, setProcessFilter] = useState("ALL");
  const [showReuse, setShowReuse] = useState(true);
  const [showPopups, setShowPopups] = useState(true);
  const [zoom, setZoom] = useState(0.34);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [selectedId, setSelectedId] = useState("");

  const model = useMemo(() => {
    const actorMap = new Map(actors.map(row => [value(row, "actorCode"), row]));
    const processMap = new Map(processes.map(row => [value(row, "processCode"), row]));
    const stepMap = new Map(steps.map(row => [`${value(row, "processCode")}::${value(row, "stepCode")}`, row]));
    const routeCounts = new Map<string, number>();
    const routeFeatures = new Map<string, Set<string>>();
    blueprints.forEach(row => {
      const route = normalizeRoute(value(row, "routePath"));
      if (route !== "/") routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1);
    });
    bindings.forEach(row => {
      const route = normalizeRoute(value(row, "routePath"));
      if (route === "/") return;
      const features = routeFeatures.get(route) ?? new Set<string>();
      const feature = value(row, "featureCode");
      if (feature) features.add(feature);
      routeFeatures.set(route, features);
    });
    const grouped = new Map<string, Array<{ row: Row; originalIndex: number }>>();
    blueprints.forEach((row, originalIndex) => {
      const processCode = value(row, "processCode") || "UNASSIGNED";
      const items = grouped.get(processCode) ?? [];
      items.push({ row, originalIndex });
      grouped.set(processCode, items);
    });
    const orderedGroups = [...grouped.entries()].sort(([left], [right]) =>
      (value(processMap.get(left), "processName") || left).localeCompare(value(processMap.get(right), "processName") || right, "ko")
    );
    const columnY = Array.from({ length: COLUMN_COUNT }, () => CANVAS_PADDING);
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const processBounds = new Map<string, { x: number; y: number; height: number; name: string }>();
    const firstByRoute = new Map<string, string>();
    orderedGroups.forEach(([processCode, entries], groupIndex) => {
      entries.sort((left, right) => {
        const leftStep = stepMap.get(`${processCode}::${value(left.row, "stepCode")}`);
        const rightStep = stepMap.get(`${processCode}::${value(right.row, "stepCode")}`);
        return (numeric(leftStep, "stepOrder") || left.originalIndex) - (numeric(rightStep, "stepOrder") || right.originalIndex);
      });
      const column = groupIndex % COLUMN_COUNT;
      const x = CANVAS_PADDING + column * (LANE_WIDTH + LANE_GAP);
      const y = columnY[column];
      const groupHeight = HEADER_HEIGHT + Math.max(1, entries.length) * (NODE_HEIGHT + NODE_GAP) + 28;
      const processName = value(processMap.get(processCode), "processName") || processCode;
      processBounds.set(processCode, { x, y, height: groupHeight, name: processName });
      let previousId = "";
      entries.forEach(({ row, originalIndex }, nodeIndex) => {
        const stepCode = value(row, "stepCode");
        const step = stepMap.get(`${processCode}::${stepCode}`);
        const actorCode = value(row, "actorCode") || value(step, "actorCode");
        const routePath = value(row, "routePath") || value(step, "userPath") || value(step, "adminPath");
        const normalizedRoute = normalizeRoute(routePath);
        const popup = isPopup(row, step);
        const id = value(row, "blueprintCode") || `${processCode}-${stepCode}-${originalIndex}`;
        const node: FlowNode = {
          id, processCode, processName, stepCode, stepName: value(step, "stepName") || stepCode,
          stepOrder: numeric(step, "stepOrder") || nodeIndex + 1, actorCode,
          actorName: value(actorMap.get(actorCode), "actorName") || actorCode,
          pageName: value(row, "pageName") || value(step, "stepName") || stepCode, routePath,
          screenType: value(row, "screenType") || "SCREEN",
          validationStatus: value(row, "validationStatus") || "PLANNED", popup,
          shared: normalizedRoute !== "/" && (routeCounts.get(normalizedRoute) ?? 0) > 1,
          sharedCount: normalizedRoute === "/" ? 1 : routeCounts.get(normalizedRoute) ?? 1,
          commonFeatures: [...(routeFeatures.get(normalizedRoute) ?? [])],
          x: x + 24 + (popup ? 18 : 0), y: y + HEADER_HEIGHT + nodeIndex * (NODE_HEIGHT + NODE_GAP),
        };
        nodes.push(node);
        if (previousId) edges.push({ id: `next-${previousId}-${id}`, from: previousId, to: id, kind: popup ? "POPUP" : "NEXT" });
        if (normalizedRoute !== "/") {
          const firstId = firstByRoute.get(normalizedRoute);
          if (firstId && firstId !== id) edges.push({ id: `reuse-${firstId}-${id}`, from: firstId, to: id, kind: "REUSE" });
          else firstByRoute.set(normalizedRoute, id);
        }
        previousId = id;
      });
      columnY[column] = y + groupHeight + LANE_GAP;
    });
    return {
      nodes, edges, processBounds,
      width: CANVAS_PADDING * 2 + COLUMN_COUNT * LANE_WIDTH + (COLUMN_COUNT - 1) * LANE_GAP,
      height: Math.max(...columnY, 800),
    };
  }, [actors, bindings, blueprints, processes, steps]);

  const visibleNodeIds = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ko-KR");
    return new Set(model.nodes.filter(node =>
      (processFilter === "ALL" || node.processCode === processFilter) &&
      (!needle || [node.pageName, node.routePath, node.processName, node.stepName, node.actorName, ...node.commonFeatures].join(" ").toLocaleLowerCase("ko-KR").includes(needle)) &&
      (showPopups || !node.popup)
    ).map(node => node.id));
  }, [model.nodes, processFilter, query, showPopups]);
  const nodeMap = useMemo(() => new Map(model.nodes.map(node => [node.id, node])), [model.nodes]);
  const visibleEdges = useMemo(() => model.edges.filter(edge =>
    visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to) && (showReuse || edge.kind !== "REUSE")
  ), [model.edges, showReuse, visibleNodeIds]);
  const selected = nodeMap.get(selectedId);
  const popupCount = model.nodes.filter(node => node.popup).length;
  const sharedCount = model.nodes.filter(node => node.shared).length;
  const fit = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setZoom(Math.max(0.12, Math.min(1, Math.min((viewport.clientWidth - 32) / model.width, (viewport.clientHeight - 32) / model.height))));
    setPan({ x: 16, y: 16 });
  };
  const focusNode = (node: FlowNode) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextZoom = Math.max(0.7, zoom);
    setZoom(nextZoom);
    setPan({ x: viewport.clientWidth / 2 - (node.x + NODE_WIDTH / 2) * nextZoom, y: viewport.clientHeight / 2 - (node.y + NODE_HEIGHT / 2) * nextZoom });
    setSelectedId(node.id);
  };
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const nextZoom = Math.max(0.12, Math.min(1.8, zoom * (event.deltaY > 0 ? 0.88 : 1.12)));
    const worldX = (pointerX - pan.x) / zoom;
    const worldY = (pointerY - pan.y) / zoom;
    setZoom(nextZoom);
    setPan({ x: pointerX - worldX * nextZoom, y: pointerY - worldY * nextZoom });
  };
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button,a,input,select,label")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setPan({ x: dragRef.current.panX + event.clientX - dragRef.current.x, y: dragRef.current.panY + event.clientY - dragRef.current.y });
  };

  return <div className="space-y-4">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div><p className="text-xs font-black tracking-[0.12em] text-blue-700">SYSTEM-WIDE SCREEN FLOW CANVAS</p><h2 className="mt-1 text-2xl font-black text-[#052b57]">전체 화면 호출·재사용·팝업 관계 순서도</h2><p className="mt-2 text-sm leading-6 text-slate-600">프로세스의 실제 단계 순서와 화면 경로를 기준으로 모든 화면을 배치합니다. 동일 경로는 공통 사용, 팝업 유형은 분기 호출로 표시합니다.</p></div>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">{[["전체 화면", model.nodes.length], ["연결", model.edges.length], ["팝업", popupCount], ["공통 사용", sharedCount]].map(([label, metric]) => <div className="min-w-24 rounded-xl bg-slate-50 p-3" key={String(label)}><span className="block text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-xl text-[#052b57]">{metric}</strong></div>)}</div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_minmax(14rem,.7fr)_auto]">
        <label className="text-xs font-bold text-slate-600">화면·경로·액터·공통 기능 검색<input className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" onChange={event => setQuery(event.target.value)} value={query}/></label>
        <label className="text-xs font-bold text-slate-600">프로세스<select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" onChange={event => setProcessFilter(event.target.value)} value={processFilter}><option value="ALL">전체 프로세스</option>{processes.map(row => <option key={value(row, "processCode")} value={value(row, "processCode")}>{value(row, "processName")} ({value(row, "processCode")})</option>)}</select></label>
        <div className="flex flex-wrap items-end gap-2"><button className={`min-h-11 rounded-lg border px-3 text-sm font-bold ${showReuse ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-300"}`} onClick={() => setShowReuse(current => !current)} type="button">재호출 화살표</button><button className={`min-h-11 rounded-lg border px-3 text-sm font-bold ${showPopups ? "border-violet-400 bg-violet-50 text-violet-800" : "border-slate-300"}`} onClick={() => setShowPopups(current => !current)} type="button">팝업 표시</button><button className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-bold" onClick={fit} type="button">전체 맞춤</button></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600"><span><i className="mr-2 inline-block h-0.5 w-8 bg-slate-500"/>다음 화면</span><span><i className="mr-2 inline-block w-8 border-t-2 border-dashed border-amber-500"/>동일 화면 재호출</span><span><i className="mr-2 inline-block w-8 border-t-2 border-dotted border-violet-600"/>팝업 분기</span><span><i className="mr-2 inline-block h-4 w-8 rounded border-4 border-double border-blue-500"/>공통 사용 화면</span><span className="ml-auto">{Math.round(zoom * 100)}% · 표시 {visibleNodeIds.size}/{model.nodes.length}</span></div>
    </section>
    <section className="relative overflow-hidden rounded-2xl border border-slate-300 bg-slate-100">
      <div aria-label={`전체 화면 ${model.nodes.length}개의 순서도 캔버스`} className="relative h-[72vh] min-h-[620px] cursor-grab touch-none overflow-hidden active:cursor-grabbing" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} onWheel={handleWheel} ref={viewportRef} role="region">
        <div className="absolute origin-top-left" style={{ height: model.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: model.width }}>
          {[...model.processBounds.entries()].map(([code, bound]) => processFilter !== "ALL" && code !== processFilter ? null : <div className="absolute rounded-2xl border border-slate-300 bg-white/55" key={code} style={{ height: bound.height, left: bound.x, top: bound.y, width: LANE_WIDTH }}><div className="h-12 border-b border-slate-300 px-4 py-2"><strong className="block truncate text-sm text-[#052b57]">{bound.name}</strong><span className="text-[11px] font-bold text-slate-500">{code}</span></div></div>)}
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible" height={model.height} width={model.width}>
            <defs><marker id="screen-flow-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5"><path d="M0,0 L7,3.5 L0,7 z" fill="context-stroke"/></marker></defs>
            {visibleEdges.map(edge => {
              const from = nodeMap.get(edge.from), to = nodeMap.get(edge.to);
              if (!from || !to) return null;
              const sameLane = from.processCode === to.processCode;
              const x1 = from.x + NODE_WIDTH / 2, y1 = from.y + NODE_HEIGHT, x2 = to.x + NODE_WIDTH / 2, y2 = to.y;
              const path = sameLane ? `M ${x1} ${y1} C ${x1} ${y1 + 18}, ${x2} ${y2 - 18}, ${x2} ${y2}` : `M ${from.x + NODE_WIDTH} ${from.y + NODE_HEIGHT / 2} C ${from.x + NODE_WIDTH + 40} ${from.y + NODE_HEIGHT / 2}, ${to.x - 40} ${to.y + NODE_HEIGHT / 2}, ${to.x} ${to.y + NODE_HEIGHT / 2}`;
              return <path d={path} fill="none" key={edge.id} markerEnd="url(#screen-flow-arrow)" opacity={edge.kind === "REUSE" ? 0.42 : 0.82} stroke={edgeColor(edge.kind)} strokeDasharray={edge.kind === "REUSE" ? "9 7" : edge.kind === "POPUP" ? "3 5" : undefined} strokeWidth={edge.kind === "NEXT" ? 2 : 2.5}/>;
            })}
          </svg>
          {model.nodes.map(node => !visibleNodeIds.has(node.id) ? null : <button aria-label={`${node.pageName}, ${node.processName} ${node.stepOrder}단계`} className={`absolute overflow-hidden rounded-xl bg-white p-3 text-left shadow-sm transition ${node.shared ? "border-4 border-double border-blue-500" : node.popup ? "border-2 border-violet-500" : "border border-slate-300"} ${selectedId === node.id ? "ring-4 ring-blue-300" : "hover:border-blue-500"}`} key={node.id} onClick={() => setSelectedId(node.id)} onDoubleClick={() => focusNode(node)} style={{ height: NODE_HEIGHT, left: node.x, top: node.y, width: NODE_WIDTH }} type="button"><span className="flex items-center gap-1 text-[10px] font-black text-slate-500"><b>{node.stepOrder}</b><span className="truncate">{node.actorName || node.actorCode || "액터 미지정"}</span>{node.popup && <em className="ml-auto not-italic text-violet-700">POPUP</em>}</span><strong className="mt-1 block truncate text-sm text-[#052b57]">{node.pageName}</strong><span className="mt-1 block truncate font-mono text-[10px] text-blue-700">{node.routePath || "경로 설계 필요"}</span><span className="mt-1 flex gap-1 text-[9px] font-bold text-slate-500">{node.shared && <b>공통 {node.sharedCount}</b>}{node.commonFeatures.length > 0 && <b>기능 {node.commonFeatures.length}</b>}<b className="ml-auto">{node.validationStatus}</b></span></button>)}
        </div>
        <div className="absolute bottom-4 left-4 flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow"><button aria-label="축소" className="h-11 w-11 font-black" onClick={() => setZoom(current => Math.max(0.12, current - 0.1))} type="button">−</button><button className="h-11 min-w-16 border-x px-2 text-xs font-black" onClick={fit} type="button">{Math.round(zoom * 100)}%</button><button aria-label="확대" className="h-11 w-11 font-black" onClick={() => setZoom(current => Math.min(1.8, current + 0.1))} type="button">+</button></div>
      </div>
    </section>
    {selected && <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-black text-blue-700">{selected.processName} · {selected.stepOrder}단계</p><h3 className="mt-1 text-xl font-black text-[#052b57]">{selected.pageName}</h3><p className="mt-1 font-mono text-xs text-slate-500">{selected.routePath || "경로 설계 필요"}</p></div><div className="flex flex-wrap gap-2">{selected.popup && <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-800">팝업 호출</span>}{selected.shared && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">{selected.sharedCount}개 단계 공통 사용</span>}<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{selected.validationStatus}</span></div></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4"><div><dt className="font-bold text-slate-500">프로세스·단계</dt><dd className="mt-1 font-bold">{selected.processCode} · {selected.stepCode}</dd></div><div><dt className="font-bold text-slate-500">담당 액터</dt><dd className="mt-1 font-bold">{selected.actorName || selected.actorCode || "-"}</dd></div><div><dt className="font-bold text-slate-500">화면 유형</dt><dd className="mt-1 font-bold">{selected.screenType}</dd></div><div><dt className="font-bold text-slate-500">공통 기능</dt><dd className="mt-1 font-bold">{selected.commonFeatures.join(", ") || "-"}</dd></div></dl>{selected.routePath.startsWith("/") && <a className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-[#246beb] px-4 font-bold text-white" href={selected.routePath}>실제 화면 열기</a>}</section>}
  </div>;
}
