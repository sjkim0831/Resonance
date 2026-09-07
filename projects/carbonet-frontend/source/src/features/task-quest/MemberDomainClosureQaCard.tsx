import { useEffect, useState } from "react";

type Gate = { name: string; status: string; seconds: number; logOutput?: string; affectedFiles?: string[]; affectedRoutes?: string[] };
type Receipt = { status: string; sourceCommit: string; totalSeconds: number; finishedAt: string; evidencePath?: string; gates: Gate[] };
type Status = { running: boolean; job?: { startedAt?: string; output?: string; exitCode?: number | null; trigger?: string }; receipt?: Receipt | null; automation?: { enabled?: boolean; pending?: string | null; lastTriggeredAt?: string | null; lastTrigger?: string | null } };

export function MemberDomainClosureQaCard({ enabled, en, processCode, stepCode }: { enabled: boolean; en: boolean; processCode?: string; stepCode?: string }) {
  const [status, setStatus] = useState<Status>({ running: false });
  const [message, setMessage] = useState("");

  async function refresh() {
    if (!enabled) return;
    const response = await fetch("/runtime/qa/member-domain-closure", { credentials: "include", cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || String(response.status));
    setStatus(body);
  }

  useEffect(() => {
    if (!enabled) return;
    void refresh().catch((error) => setMessage(String(error)));
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !status.running) return;
    const timer = window.setInterval(() => void refresh().catch((error) => setMessage(String(error))), 1000);
    return () => window.clearInterval(timer);
  }, [enabled, status.running]);

  if (!enabled) return null;

  async function run(gate = "ALL") {
    setMessage(gate === "ALL" ? (en ? "Starting member-domain verification..." : "회원 도메인 전체 검증을 시작합니다.") : `${gate} ${en ? "gate verification is starting." : "게이트 재검증을 시작합니다."}`);
    const response = await fetch(`/runtime/qa/member-domain-closure?gate=${encodeURIComponent(gate)}`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Carbonet-Test-Mode": "1" },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || String(response.status));
    setStatus(body);
    setMessage(en ? "Verification is running." : "검증 실행 중입니다.");
  }

  const receipt = status.receipt;
  const timelineQuery = new URLSearchParams();
  if (processCode) timelineQuery.set("process", processCode);
  if (stepCode) timelineQuery.set("step", stepCode);
  const timelineHref = `/qa/member-eight-scenario/timeline.html${timelineQuery.toString() ? `?${timelineQuery}` : ""}`;
  return (
    <section className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3" data-member-domain-closure-qa="">
      <div className="flex items-start justify-between gap-3">
        <div><strong className="text-sm text-emerald-950">{en ? "Member domain closure" : "회원 전체 종료 검증"}</strong><p className="mt-1 text-xs text-emerald-900">{en ? "Runs ledger, account relay, authority, and exception recovery in one gate." : "원장·계정 릴레이·권한·예외 복구를 한 번에 검증합니다."}</p></div>
        <button className="min-h-10 shrink-0 rounded-lg bg-emerald-800 px-3 text-xs font-black text-white disabled:bg-slate-400" disabled={status.running} onClick={() => void run().catch((error) => setMessage(`${en ? "Failed" : "실패"}: ${String(error)}`))} type="button">{status.running ? (en ? "Running" : "실행 중") : (en ? "Run 4 gates" : "4개 게이트 실행")}</button>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-[11px] font-bold text-emerald-900"><span>{en ? "Design change automation" : "설계 변경 자동 검증"}</span><span>{status.automation?.pending ? (en ? "Waiting for stability" : "변경 안정화 대기") : status.automation?.enabled ? (en ? "ON" : "사용 중") : (en ? "Checking" : "확인 중")}</span></div>
      <a className="mt-2 flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-white px-3 text-xs font-black text-emerald-900" data-member-qa-ledger-link="qa" href={timelineHref} target="_blank" rel="noreferrer"><span className="material-symbols-outlined text-[18px]">movie</span>{en ? "84-step video evidence" : "84단계 영상 증거 열기"}</a>
      {receipt ? <><div className="mt-3 flex items-center justify-between rounded-lg bg-white p-2 text-xs"><b className={receipt.status === "PASS" ? "text-emerald-700" : "text-red-700"}>{receipt.status}</b><span>{receipt.totalSeconds}{en ? " sec" : "초"} · {receipt.sourceCommit?.slice(0, 12)}</span></div><div className="mt-2 space-y-1.5">{receipt.gates?.map((gate) => <details className="rounded-lg bg-white px-2 py-1.5 text-[11px]" key={gate.name} open={gate.status !== "PASS"}><summary className="flex cursor-pointer justify-between font-bold"><span>{gate.name}</span><span className={gate.status === "PASS" ? "text-emerald-700" : "text-red-700"}>{gate.status} · {gate.seconds}s</span></summary><div className="mt-2 space-y-2 border-t pt-2"><div><b>{en ? "Design files" : "관련 설계 파일"}</b>{gate.affectedFiles?.map((file) => <code className="mt-1 block break-all rounded bg-slate-100 p-1" key={file}>{file}</code>)}</div><div className="flex flex-wrap gap-1">{gate.affectedRoutes?.map((route) => <a className="rounded border border-blue-300 px-2 py-1 font-bold text-blue-700" href={`${route}${route.includes("?") ? "&" : "?"}qaGate=${gate.name}`} key={route}>{en ? "Open selected screen" : "선택 화면 열기"} · {route}</a>)}</div>{gate.status !== "PASS" ? <button className="min-h-9 rounded-lg bg-red-700 px-3 font-black text-white disabled:bg-slate-400" disabled={status.running} onClick={() => void run(gate.name).catch((error) => setMessage(`${en ? "Failed" : "실패"}: ${String(error)}`))} type="button">{en ? `Re-run ${gate.name}` : `${gate.name}만 재검증`}</button> : null}{gate.logOutput ? <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-2 text-[10px] text-slate-100">{gate.logOutput}</pre> : null}</div></details>)}</div>{receipt.evidencePath ? <code className="mt-2 block break-all text-[10px] text-emerald-900">{receipt.evidencePath}</code> : null}</> : null}
      {message ? <p className="mt-2 text-xs font-bold text-emerald-900">{message}</p> : null}
    </section>
  );
}
