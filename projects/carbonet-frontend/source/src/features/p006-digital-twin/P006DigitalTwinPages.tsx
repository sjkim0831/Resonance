import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { AdminPageShell } from "../admin-entry/AdminPageShell";

const routes = [
  ["프로젝트 현황", "/projects/P006/digital-twin"],
  ["공장 조립 스튜디오", "/projects/P006/digital-twin/factory-studio"],
  ["공장 시뮬레이터", "/projects/P006/digital-twin/factory-simulator"],
  ["시뮬레이션 시나리오", "/projects/P006/digital-twin/scenarios"],
  ["실행 결과·병목 분석", "/projects/P006/digital-twin/results"]
] as const;

const assets = [
  ["pump", "펌프"], ["conveyor", "컨베이어"], ["robot", "로봇"], ["inspection", "검사 설비"],
  ["tank", "탱크"], ["compressor", "압축기"], ["dryer", "건조기"], ["filter", "필터"],
  ["cooler", "냉각기"], ["panel", "제어반"], ["pipe", "배관"], ["valve", "밸브"], ["sensor", "센서"]
] as const;
const assetNames = Object.fromEntries(assets);

type SceneObject = { objectId: string; assetCode: string; transform: { x: number; y: number; rotationY?: number } };

const cards = [
  ["도움말", "왼쪽 설비를 작업공간에 끌어 놓습니다. 저장된 위치는 새로고침 후 자동 복원됩니다."],
  ["화면 설계", "KRDS 공통 프레임과 P006 장면 API를 사용하고 배치 좌표는 독립 DB에 저장합니다."],
  ["QA 검증", "페이지 → 액터 → 화면 → 기능 → 입력값 → DB 출력값 → 재접속 복원 순서로 검증합니다."],
  ["다음 업무", "설비 연결선과 타임라인 애니메이션을 USD Stage 명령으로 변환합니다."],
  ["업무 길잡이", "설비 선택 → 드래그 배치 → 자동 저장 → 새로고침 → 위치 복원 → RTX 검토"],
  ["전체 업무 보기", "설비 선택, 배치, 이동, 삭제, 저장, 복원, RTX 검토까지 7개 업무를 관리합니다."]
] as const;

function ProjectStatus() {
  const [state, setState] = useState("확인 중");
  useEffect(() => { fetch("/r/P006/actuator/health", { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject()).then(r => setState(r.status === "UP" ? "정상" : "점검 필요")).catch(() => setState("점검 필요")); }, []);
  return <strong className={state === "정상" ? "text-emerald-700" : "text-amber-700"}>{state}</strong>;
}

function FactoryStudio() {
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [status, setStatus] = useState("장면 불러오는 중");
  const [showRtx, setShowRtx] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);
  const load = useCallback(() => fetch("/r/P006/actuator/p006/factory-scenes/default", { credentials: "include", headers: { "X-P006-Actor": "FACTORY_DESIGNER" } })
    .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(r => { setObjects(r.objects || []); setStatus(`DB 복원 완료 · ${r.objectCount || 0}개`); })
    .catch(() => setStatus("장면을 불러오지 못했습니다.")), []);
  useEffect(() => { void load(); }, [load]);

  const save = async (assetCode: string, x: number, y: number, objectId?: string) => {
    setStatus("저장 중");
    const response = await fetch("/r/P006/actuator/p006/factory-scenes/default/objects", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-P006-Actor": "FACTORY_DESIGNER" }, body: JSON.stringify({ objectId, assetCode, x, y, rotationY: 0 }) });
    if (!response.ok) { setStatus(`저장 실패 · HTTP ${response.status}`); return; }
    await load();
    setStatus("독립 DB 저장 완료");
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bounds = workspace.current?.getBoundingClientRect();
    if (!bounds) return;
    const payload = JSON.parse(event.dataTransfer.getData("application/p006-object") || "{}");
    if (!payload.assetCode) return;
    const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
    void save(payload.assetCode, Number(x.toFixed(2)), Number(y.toFixed(2)), payload.objectId);
  };
  const remove = async (objectId: string) => {
    setStatus("삭제 중");
    const response = await fetch(`/r/P006/actuator/p006/factory-scenes/default/objects/${objectId}`, { method: "DELETE", credentials: "include", headers: { "X-P006-Actor": "FACTORY_DESIGNER" } });
    if (response.ok) await load(); else setStatus(`삭제 실패 · HTTP ${response.status}`);
  };

  return <section className="mt-6 grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
    <aside className="rounded-2xl border bg-white p-4 shadow-sm"><h2 className="gov-text-heading-sm font-black text-[#052b57]">설비 자산 13종</h2><p className="gov-text-body-sm mt-2 text-slate-600">설비를 오른쪽 작업공간으로 끌어 놓으세요.</p><div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-1">{assets.map(([code, label]) => <button className="krds-control cursor-grab rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-left font-bold hover:bg-blue-50" draggable key={code} onDragStart={e => e.dataTransfer.setData("application/p006-object", JSON.stringify({ assetCode: code }))}>＋ {label}</button>)}</div></aside>
    <div><div className="mb-3 flex items-center justify-between rounded-xl border bg-white px-4 py-3"><strong aria-live="polite">{status}</strong><button className="krds-control rounded-lg border px-3 py-2 font-bold" onClick={() => void load()}>DB에서 다시 불러오기</button></div>
      <div aria-label="공장 조립 작업공간" className="relative min-h-[520px] overflow-hidden rounded-2xl border-2 border-dashed border-blue-300 bg-[#eef5fb] shadow-inner" onDragOver={e => e.preventDefault()} onDrop={drop} ref={workspace} style={{backgroundImage:"linear-gradient(#c9d8e8 1px,transparent 1px),linear-gradient(90deg,#c9d8e8 1px,transparent 1px)",backgroundSize:"32px 32px"}}>
        <p className="absolute left-4 top-3 rounded-lg bg-white/90 px-3 py-2 text-sm font-bold text-slate-600">P006 공장 평면 · 드래그 이동 가능</p>
        {objects.map(object => <div className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move rounded-xl border-2 border-[#005ea8] bg-white px-4 py-3 text-center shadow-lg" draggable key={object.objectId} onDragStart={e => e.dataTransfer.setData("application/p006-object", JSON.stringify({ objectId: object.objectId, assetCode: object.assetCode }))} style={{left:`${object.transform.x}%`,top:`${object.transform.y}%`}}><strong className="block text-[#052b57]">{assetNames[object.assetCode] || object.assetCode}</strong><small className="text-slate-500">{object.transform.x.toFixed(1)}, {object.transform.y.toFixed(1)}</small><button aria-label={`${assetNames[object.assetCode] || object.assetCode} 삭제`} className="ml-2 text-red-700" onClick={() => void remove(object.objectId)}>×</button></div>)}
        {!objects.length && <div className="absolute inset-0 grid place-items-center text-center text-slate-500"><div><strong className="text-xl">설비를 여기에 배치하세요</strong><p>배치 즉시 woosu_digital_twin DB에 저장됩니다.</p></div></div>}
      </div>
      <section className="mt-4 rounded-xl border bg-white"><button className="krds-control w-full px-4 py-3 text-left font-bold" onClick={() => setShowRtx(value => !value)}>{showRtx ? "RTX 미리보기 닫기" : "RTX 결과 미리보기 열기"}</button>{showRtx && <iframe allow="autoplay; fullscreen; clipboard-read; clipboard-write" className="aspect-video min-h-[480px] w-full border-0" src="/admin/digital-twin/woosu-factory/?view=viewport" title="공장 RTX 결과 미리보기"/>}</section>
    </div>
  </section>;
}

function Simulator() { return <section className="mt-6 overflow-hidden rounded-2xl border border-slate-300 bg-slate-950 shadow-sm"><iframe allow="autoplay; fullscreen; clipboard-read; clipboard-write" className="aspect-video min-h-[560px] w-full border-0" src="/admin/digital-twin/woosu-factory/?view=viewport" title="공장 시뮬레이터"/></section>; }

export function P006DigitalTwinPages() {
  const path = location.pathname.replace(/^\/en(?=\/)/, "");
  const title = routes.find(([, route]) => route === path)?.[0] || "Woosu Digital Twin";
  const isStudio = path.endsWith("factory-studio"), isSimulator = path.endsWith("factory-simulator");
  return <AdminPageShell breadcrumbs={[{ label: "프로젝트", href: "/projects/P006/digital-twin" }, { label: "P006" }, { label: title }]} title={title}><main className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8" style={{"--p006-primary":"#005ea8"} as CSSProperties}><div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]"><nav aria-label="Digital Twin 프로젝트 메뉴" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="gov-text-label font-black text-[#005ea8]">P006 · 독립 DB</p><h2 className="gov-text-heading-sm mt-1 font-black text-[#052b57]">Woosu Digital Twin</h2><div className="mt-4 grid gap-2">{routes.map(([label, route]) => <a className={`krds-control rounded-lg px-3 py-3 font-bold ${route === path ? "bg-[#005ea8] text-white" : "bg-slate-50 text-slate-800 hover:bg-blue-50"}`} href={route} key={route}>{label}</a>)}</div></nav><section><header className="rounded-2xl bg-[#052b57] p-6 text-white"><p className="gov-text-label font-bold text-blue-200">System · Digital Twin · P006</p><h1 className="gov-text-heading-lg mt-2 font-black">{title}</h1><p className="gov-text-body mt-2 text-slate-200">공통 KRDS 프레임을 공유하고 계정·장면·시뮬레이션 데이터는 woosu_digital_twin DB에 분리합니다.</p></header>{isStudio ? <FactoryStudio/> : isSimulator ? <Simulator/> : <><section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["프로젝트 런타임",<ProjectStatus/>],["독립 DB","woosu_digital_twin"],["등록 설비","13종"],["구현 단계","배치·저장·복원"]].map(([label,value])=><article className="krds-component rounded-xl border bg-white" key={String(label)}><span className="gov-text-label font-bold text-slate-500">{label}</span><div className="gov-text-heading-sm mt-2 font-black text-[#052b57]">{value}</div></article>)}</section><section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards.map(([label,body])=><article className="krds-component rounded-xl border bg-white" key={label}><h2 className="gov-text-heading-sm font-black text-[#052b57]">{label}</h2><p className="gov-text-body-sm mt-3 text-slate-600">{body}</p></article>)}</section></>}</section></div></main></AdminPageShell>;
}
