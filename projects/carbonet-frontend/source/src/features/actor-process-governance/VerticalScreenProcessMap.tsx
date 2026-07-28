import { useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Props = { actors: Row[]; blueprints: Row[]; processes: Row[]; steps: Row[] };
type ScreenNode = {
  key: string;
  blueprintCode: string;
  processCode: string;
  processName: string;
  domainCode: string;
  stepCode: string;
  stepName: string;
  stepOrder: number;
  actorCode: string;
  actorName: string;
  audience: string;
  pageName: string;
  routePath: string;
  screenType: string;
  templateCode: string;
  validationStatus: string;
  validationMessage: string;
  specificationJson: string;
  traceabilityJson: string;
};

const value = (row: Row | undefined, key: string) => String(row?.[key] ?? "");
const number = (row: Row | undefined, key: string) => Number(row?.[key] ?? 0);
const normalized = (text: string) => text.trim().toLocaleLowerCase("ko-KR");
const compactJson = (source: string) => {
  if (!source) return "-";
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>;
    const summary = Object.entries(parsed).slice(0, 8).map(([key, item]) => `${key}: ${Array.isArray(item) ? item.length : typeof item === "object" ? "정의됨" : String(item)}`);
    return summary.join(" · ");
  } catch {
    return source.slice(0, 240);
  }
};

export function VerticalScreenProcessMap({ actors, blueprints, processes, steps }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [processFilter, setProcessFilter] = useState("ALL");
  const processMap = useMemo(() => new Map(processes.map(row => [value(row, "processCode"), row])), [processes]);
  const actorMap = useMemo(() => new Map(actors.map(row => [value(row, "actorCode"), row])), [actors]);
  const stepMap = useMemo(() => new Map(steps.map(row => [`${value(row, "processCode")}::${value(row, "stepCode")}`, row])), [steps]);

  const nodes = useMemo<ScreenNode[]>(() => blueprints.map((row, index) => {
    const processCode = value(row, "processCode");
    const stepCode = value(row, "stepCode");
    const process = processMap.get(processCode);
    const step = stepMap.get(`${processCode}::${stepCode}`);
    const actorCode = value(row, "actorCode") || value(step, "actorCode");
    return {
      key: value(row, "blueprintCode") || `${processCode}-${stepCode}-${index}`,
      blueprintCode: value(row, "blueprintCode"),
      processCode,
      processName: value(process, "processName") || processCode,
      domainCode: value(process, "domainCode") || "COMMON",
      stepCode,
      stepName: value(step, "stepName") || stepCode,
      stepOrder: number(step, "stepOrder") || index + 1,
      actorCode,
      actorName: value(actorMap.get(actorCode), "actorName") || actorCode,
      audience: value(row, "audience"),
      pageName: value(row, "pageName"),
      routePath: value(row, "routePath") || value(step, "userPath") || value(step, "adminPath"),
      screenType: value(row, "screenType"),
      templateCode: value(row, "templateCode"),
      validationStatus: value(row, "validationStatus") || "PLANNED",
      validationMessage: value(row, "validationMessage"),
      specificationJson: value(row, "specificationJson"),
      traceabilityJson: value(row, "traceabilityJson"),
    };
  }).sort((left, right) =>
    left.domainCode.localeCompare(right.domainCode, "ko") ||
    left.processName.localeCompare(right.processName, "ko") ||
    left.stepOrder - right.stepOrder ||
    left.pageName.localeCompare(right.pageName, "ko")
  ), [actorMap, blueprints, processMap, stepMap]);

  const filtered = useMemo(() => {
    const needle = normalized(query);
    return nodes.filter(node =>
      (processFilter === "ALL" || node.processCode === processFilter) &&
      (status === "ALL" || node.validationStatus === status) &&
      (!needle || normalized([
        node.domainCode, node.processCode, node.processName, node.stepCode, node.stepName,
        node.actorCode, node.actorName, node.pageName, node.routePath, node.screenType,
      ].join(" ")).includes(needle))
    );
  }, [nodes, processFilter, query, status]);

  const groups = useMemo(() => {
    const result = new Map<string, ScreenNode[]>();
    filtered.forEach(node => {
      const key = `${node.domainCode}::${node.processCode}`;
      const current = result.get(key) ?? [];
      current.push(node);
      result.set(key, current);
    });
    return [...result.entries()];
  }, [filtered]);
  const validCount = nodes.filter(node => node.validationStatus === "VALID").length;
  const linkedCount = nodes.filter(node => node.routePath.startsWith("/")).length;

  const jump = (key: string) => {
    setProcessFilter(key);
    requestAnimationFrame(() => document.getElementById(`vertical-process-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return <div className="space-y-5">
    <section className="sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-xs font-black tracking-[0.12em] text-blue-700">SYSTEM-WIDE VERTICAL PROCESS MAP</p><h2 className="mt-1 text-2xl font-black text-[#052b57]">시스템 전체 화면을 업무 순서대로 위에서 아래로 확인합니다.</h2><p className="mt-2 text-sm text-slate-600">프로세스와 단계를 정렬 기준으로 사용하며, 화면을 선택하면 설계·데이터·테스트 추적 정보를 펼쳐볼 수 있습니다.</p></div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["전체", nodes.length], ["경로 연결", linkedCount], ["검증 통과", validCount]].map(([label, metric]) => <div className="min-w-24 rounded-xl bg-slate-50 p-3" key={String(label)}><span className="block text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-xl text-[#052b57]">{metric}</strong></div>)}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(12rem,.7fr)_minmax(12rem,.7fr)]">
        <label className="text-xs font-bold text-slate-600">화면·프로세스 검색<input className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" onChange={event => setQuery(event.target.value)} placeholder="화면명, 경로, 액터, 프로세스" value={query}/></label>
        <label className="text-xs font-bold text-slate-600">프로세스 바로가기<select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" onChange={event => jump(event.target.value)} value={processFilter}><option value="ALL">전체 프로세스</option>{processes.map(row => <option key={value(row, "processCode")} value={value(row, "processCode")}>{value(row, "processName")} ({value(row, "processCode")})</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">설계 상태<select className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" onChange={event => setStatus(event.target.value)} value={status}><option value="ALL">전체 상태</option><option value="VALID">검증 통과</option><option value="INVALID">보완 필요</option><option value="PLANNED">설계 예정</option></select></label>
      </div>
    </section>

    <section className="relative pl-7 before:absolute before:bottom-0 before:left-[13px] before:top-0 before:w-0.5 before:bg-blue-200">
      {groups.length ? groups.map(([groupKey, screens], processIndex) => {
        const first = screens[0];
        return <article className="relative mb-8 scroll-mt-48" id={`vertical-process-${first.processCode}`} key={groupKey}>
          <span className="absolute -left-7 top-6 flex h-7 w-7 items-center justify-center rounded-full bg-[#246beb] text-xs font-black text-white">{processIndex + 1}</span>
          <header className="rounded-t-2xl border border-blue-200 bg-[#052b57] p-5 text-white">
            <p className="text-xs font-bold text-blue-200">{first.domainCode} · {first.processCode}</p>
            <div className="mt-1 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><h3 className="text-xl font-black">{first.processName}</h3><span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">{screens.length}개 화면</span></div>
          </header>
          <div className="space-y-3 rounded-b-2xl border border-t-0 border-slate-200 bg-slate-50 p-4">
            {screens.map((screen, screenIndex) => <details
              className="group rounded-xl border border-slate-200 bg-white shadow-sm"
              key={screen.key}
              style={{ contentVisibility: "auto", containIntrinsicSize: "160px" }}
            >
              <summary className="grid cursor-pointer list-none gap-3 p-4 md:grid-cols-[4rem_minmax(12rem,1.3fr)_minmax(10rem,.8fr)_minmax(12rem,1fr)_7rem] md:items-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-blue-700">{screenIndex + 1}</span>
                <span><strong className="block text-base text-[#052b57]">{screen.pageName || screen.stepName}</strong><small className="mt-1 block text-slate-500">{screen.stepOrder}. {screen.stepName} · {screen.stepCode}</small></span>
                <span className="text-sm"><strong className="block text-slate-700">{screen.actorName || "-"}</strong><small className="text-slate-500">{screen.actorCode} · {screen.audience}</small></span>
                <span className="break-all text-sm font-bold text-blue-700">{screen.routePath || "경로 설계 필요"}</span>
                <span className={`rounded-full px-3 py-2 text-center text-xs font-black ${screen.validationStatus === "VALID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{screen.validationStatus}</span>
              </summary>
              <div className="border-t border-slate-200 p-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm"><dt className="font-bold text-slate-500">설계 코드</dt><dd>{screen.blueprintCode || "-"}</dd><dt className="font-bold text-slate-500">화면 유형</dt><dd>{screen.screenType || "-"}</dd><dt className="font-bold text-slate-500">템플릿</dt><dd>{screen.templateCode || "-"}</dd><dt className="font-bold text-slate-500">검증 메시지</dt><dd>{screen.validationMessage || "이상 없음"}</dd></dl>
                  <div className="space-y-3 text-sm"><div><strong className="text-slate-700">화면·데이터 계약</strong><p className="mt-1 rounded-lg bg-slate-50 p-3 leading-6 text-slate-600">{compactJson(screen.specificationJson)}</p></div><div><strong className="text-slate-700">액터·프로세스·테스트 추적</strong><p className="mt-1 rounded-lg bg-slate-50 p-3 leading-6 text-slate-600">{compactJson(screen.traceabilityJson)}</p></div></div>
                </div>
                {screen.routePath.startsWith("/") && <a className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#246beb] px-4 font-bold text-white" href={screen.routePath}>실제 화면 열기</a>}
              </div>
            </details>)}
          </div>
        </article>;
      }) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center font-bold text-slate-500">조건에 맞는 화면 설계가 없습니다.</div>}
    </section>
  </div>;
}
