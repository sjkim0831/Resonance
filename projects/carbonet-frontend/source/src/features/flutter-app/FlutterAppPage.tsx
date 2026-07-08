import { useMemo, useRef, useState } from "react";

const FLUTTER_APP_URL = "http://127.0.0.1:8080/flutter-app";

export default function FlutterAppPage() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const builderHref = useMemo(() => (
    `/admin/system/builder-studio?menuCode=FLUTTER&pageId=flutter-app&menuTitle=${encodeURIComponent("Flutter App")}&menuUrl=${encodeURIComponent("/flutter-app")}`
  ), []);

  function reloadFrame() {
    setLoadState("loading");
    setReloadKey((value) => value + 1);
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">External Runtime</p>
          <h1 className="text-lg font-black">Flutter App</h1>
          <p className="break-all text-xs text-slate-500">{FLUTTER_APP_URL}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${loadState === "ready" ? "bg-emerald-100 text-emerald-700" : loadState === "error" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
            {loadState === "ready" ? "READY" : loadState === "error" ? "ERROR" : "LOADING"}
          </span>
          <button className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold hover:bg-slate-50" onClick={reloadFrame} type="button">새로고침</button>
          <a className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold hover:bg-slate-50" href={FLUTTER_APP_URL} rel="noreferrer" target="_blank">새 창</a>
          <a className="rounded bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800" href={builderHref}>빌더 관리</a>
        </div>
      </header>
      <main className="relative min-h-0 flex-1">
        {loadState === "loading" ? (
          <div className="absolute left-4 top-4 z-10 rounded border bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm">Flutter runtime loading...</div>
        ) : null}
        <iframe
          key={reloadKey}
          ref={frameRef}
          src={FLUTTER_APP_URL}
          title="Flutter App"
          className="h-full w-full border-0 bg-white"
          allow="camera; microphone; geolocation; file-access"
          onLoad={() => setLoadState("ready")}
          onError={() => setLoadState("error")}
        />
      </main>
    </div>
  );
}
