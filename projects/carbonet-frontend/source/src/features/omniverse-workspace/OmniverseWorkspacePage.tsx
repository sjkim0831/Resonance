import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildResilientCsrfHeaders } from "../../lib/api/core";

type Asset = { name: string; size: number; modifiedAt: string; downloadUrl: string };
type Payload = { items: Asset[]; streamUrl?: string; status?: string; maxUploadBytes?: number };

const API = "/admin/api/omniverse/assets";
const ACCEPT = ".usd,.usda,.usdc,.usdz,.zip";
const FACTORY_VIEWER = "woosu_factory_v2.usda";

async function responseBody(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { return { message: response.ok ? "서버 응답을 처리할 수 없습니다." : `요청 실패 (HTTP ${response.status})` }; }
}

function sizeLabel(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

export function OmniverseWorkspacePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [payload, setPayload] = useState<Payload>({ items: [] });
  const [selected, setSelected] = useState(FACTORY_VIEWER);
  const [viewerKey, setViewerKey] = useState(0);
  const [viewerReady, setViewerReady] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(API, { credentials: "include", headers: { Accept: "application/json" } });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
      setPayload({ ...body, items: Array.isArray(body.items) ? body.items : [] });
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const resetViewer = useCallback(async () => {
    if (!payload.streamUrl || resetting) return;
    setResetting(true); setViewerReady(false); setError("");
    try {
      const endpoint = new URL("/api/reset", payload.streamUrl).toString();
      const response = await fetch(endpoint, { method: "POST", mode: "cors", cache: "no-store" });
      if (!response.ok) throw new Error(`스트림 초기화 실패 (HTTP ${response.status})`);
      setViewerKey((value) => value + 1); setViewerReady(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setResetting(false); }
  }, [payload.streamUrl, resetting]);
  useEffect(() => { if (payload.streamUrl && !viewerReady && !resetting) void resetViewer(); }, [payload.streamUrl]);
  const selectedAsset = useMemo(() => payload.items.find((item) => item.name === selected), [payload.items, selected]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch(API, { method: "POST", credentials: "include", headers: await buildResilientCsrfHeaders(), body: form });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
      setSelected(body.name || file.name); setMessage(`${file.name} 업로드를 완료했습니다.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); event.target.value = ""; }
  }

  async function remove(name: string) {
    if (!confirm(`${name} 파일을 삭제하시겠습니까?`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${API}/${encodeURIComponent(name)}/delete`, { method: "POST", credentials: "include", headers: await buildResilientCsrfHeaders() });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
      if (selected === name) setSelected(""); setMessage(`${name} 파일을 삭제했습니다.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900">
    <div className="mx-auto max-w-[1700px]">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">System · Digital Twin</p><h1 className="mt-2 text-3xl font-black text-[#052b57]">우수 스마트 팩토리 디지털 트윈</h1><p className="mt-2 text-slate-600">설비 색상, RTX 조명과 공정 애니메이션이 포함된 Omniverse 공장 뷰어입니다.</p></div>
        <div className="flex flex-wrap gap-2"><input ref={inputRef} className="hidden" type="file" accept={ACCEPT} onChange={upload}/><button disabled={busy} onClick={() => inputRef.current?.click()} className="rounded-lg bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "처리 중…" : "USD 업로드"}</button><button disabled={resetting} onClick={() => void resetViewer()} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-bold disabled:opacity-50">{resetting ? "스트림 초기화 중…" : "뷰어 재연결"}</button></div>
      </header>
      {(message || error) && <div className={`mt-5 rounded-xl border px-4 py-3 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || message}</div>}
      <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#101722] shadow-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-white"><div><strong>RTX 공장 실시간 뷰어</strong><span className={`ml-3 rounded-full px-2 py-1 text-xs font-black ${payload.streamUrl ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"}`}>{payload.streamUrl ? "온라인" : "준비 필요"}</span></div><span className="text-xs text-slate-400">{selectedAsset?.name || FACTORY_VIEWER}</span></div>
          <div className="aspect-video min-h-[560px]">{payload.streamUrl && viewerReady ? <iframe key={viewerKey} className="h-full w-full border-0" allow="autoplay; fullscreen; clipboard-read; clipboard-write" src={`${payload.streamUrl}${payload.streamUrl.includes("?") ? "&" : "?"}embed=1&v=${viewerKey}`} title="Woosu Smart Factory Omniverse Viewer"/> : <div className="flex h-full items-center justify-center text-slate-300"><div className="text-center"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-600 border-t-blue-400"/><strong>{resetting ? "기존 세션을 정리하고 RTX를 시작하는 중입니다…" : "WebRTC 스트림을 준비 중입니다."}</strong><p className="mt-2 text-xs text-slate-500">라우트 진입 시 자동으로 초기화됩니다.</p></div></div>}</div>
        </div>
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-lg font-black text-[#052b57]">뷰어 파일</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{payload.items.length}개</span></div>
          <p className="mt-2 text-xs leading-5 text-slate-500">공장 뷰어는 원본 USD를 참조하는 경량 레이어입니다. 두 파일을 같은 폴더에 보관하세요.</p>
          <div className="mt-4 max-h-[650px] space-y-3 overflow-y-auto pr-1">{payload.items.map((asset) => <article key={asset.name} onClick={() => setSelected(asset.name)} className={`cursor-pointer rounded-xl border p-4 transition ${selected === asset.name ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-400"}`}><strong className="block break-all text-sm">{asset.name}{asset.name === FACTORY_VIEWER && <span className="ml-2 rounded bg-emerald-100 px-2 py-1 text-[10px] text-emerald-800">홈페이지 뷰어</span>}</strong><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{sizeLabel(asset.size)}</span><span>{new Date(asset.modifiedAt).toLocaleString()}</span></div><div className="mt-3 flex gap-2"><a onClick={(e) => e.stopPropagation()} className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white" href={asset.downloadUrl}>다운로드</a><button onClick={(e) => { e.stopPropagation(); void remove(asset.name); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">삭제</button></div></article>)}</div>
        </aside>
      </section>
      <section className="mt-5 grid gap-4 md:grid-cols-4">{[["설비","컨베이어·탱크·배관·로봇 셀"],["색상","강철·공정·안전 구역 팔레트"],["조명","RTX 환경광·천장등·경광등"],["애니메이션","10초 루프 롤러·로봇·비콘"]].map(([title,body]) => <div key={title} className="rounded-xl border border-slate-200 bg-white p-5"><strong className="text-[#052b57]">{title}</strong><p className="mt-2 text-sm text-slate-600">{body}</p></div>)}</section>
    </div>
  </main>;
}
