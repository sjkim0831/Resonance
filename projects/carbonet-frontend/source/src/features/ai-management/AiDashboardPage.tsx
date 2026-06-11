import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { fetchAiDashboard } from "../../lib/api/aiManagement";

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    healthy: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    critical: "bg-rose-100 text-rose-700",
    inactive: "bg-slate-100 text-slate-700"
  };
  return <span className={"inline-flex rounded-full px-2.5 py-1 text-xs font-black " + (colors[value] || colors.inactive)}>{value}</span>;
}

export function AiDashboardPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const state = useAsyncValue(() => fetchAiDashboard(), []);
  const payload = state.value;
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => { logGovernanceScope("PAGE", "ai-dashboard", { language: en ? "en" : "ko" }); }, [en]);
  useEffect(() => { if (!autoRefresh) return; const i = setInterval(() => void state.reload(), 30000); return () => clearInterval(i); }, [autoRefresh]);
  useEffect(() => {
    function handleNavigationSync() {
      void state.reload();
      void session.reload();
    }
    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => window.removeEventListener(getNavigationEventName(), handleNavigationSync);
  }, [state, session]);

  return (
    <AdminPageShell
      breadcrumbs={[{ label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") }, { label: en ? "AI Management" : "AI 관리" }, { label: en ? "Dashboard" : "대시보드" }]}
      sidebarVariant="system"
      title={en ? "AI Operations Dashboard" : "AI 운영 대시보드"}
      subtitle={en ? "Real-time AI platform health, model status, and resource overview." : "AI 플랫폼 상태, 모델 현황, 리소스 개요를 실시간으로 확인합니다."}
      actions={<div className="flex gap-2"><label className="flex items-center gap-1.5 text-sm text-[var(--kr-gov-text-secondary)]"><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="gov-checkbox" />{en ? "Auto-refresh" : "자동 새로고침"}</label><button className="gov-btn gov-btn-outline" onClick={() => void state.reload()} type="button">{en ? "Refresh" : "새로고침"}</button></div>}
    >
      <AdminWorkspacePageFrame>
        {state.error ? <PageStatusNotice tone="error">{state.error}</PageStatusNotice> : null}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetricCard title={en ? "Active Models" : "활성 모델"} value={payload?.modelCount || "-"} description={en ? "Deployed and running." : "배포되어 실행 중입니다."} />
          <SummaryMetricCard title={en ? "RAG Chunks" : "RAG 청크"} value={payload?.ragChunkCount || "-"} description={en ? "Indexed in vector DB." : "벡터DB에 색인되었습니다."} />
          <SummaryMetricCard title={en ? "Today Inferences" : "오늘 추론"} value={payload?.todayInferences || "-"} description={en ? "Model inference calls today." : "오늘 모델 추론 호출입니다."} />
          <SummaryMetricCard title={en ? "Avg Latency" : "평균 지연"} value={payload?.avgLatency || "-"} description={en ? "Across all active models." : "전체 활성 모델 평균입니다."} />
        </section>
        <section className="gov-card">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5"><h2 className="text-lg font-black">{en ? "Model Health" : "모델 상태"}</h2></div>
          <div className="divide-y divide-[var(--kr-gov-border-light)]">
            {(payload?.modelHealth || []).length === 0 ? <div className="px-6 py-8 text-center text-[var(--kr-gov-text-secondary)]">{en ? "No model data" : "모델 데이터 없음"}</div> :
            (payload?.modelHealth || []).map((m: Record<string, string>) => (<div className="flex items-center justify-between px-6 py-4" key={m.name}><div><p className="font-bold">{m.name}</p><p className="text-sm text-[var(--kr-gov-text-secondary)]">{m.version} {m.provider}</p></div><div className="flex items-center gap-4"><span className="text-sm text-[var(--kr-gov-text-secondary)]">{m.latency}</span><StatusBadge value={m.status} /></div></div>))}
          </div>
        </section>
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="gov-card"><div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5"><h2 className="text-lg font-black">{en ? "System Resources" : "시스템 리소스"}</h2></div><div className="space-y-3 p-6">
            <div><div className="mb-1 flex justify-between text-sm"><span>GPU</span><span>{payload?.gpuUsage || "-"}</span></div><div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-blue-500" style={{ width: payload?.gpuPercent || "0%" }} /></div></div>
            <div><div className="mb-1 flex justify-between text-sm"><span>VRAM</span><span>{payload?.vramUsage || "-"}</span></div><div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-purple-500" style={{ width: payload?.vramPercent || "0%" }} /></div></div>
            <div><div className="mb-1 flex justify-between text-sm"><span>CPU</span><span>{payload?.cpuUsage || "-"}</span></div><div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-amber-500" style={{ width: payload?.cpuPercent || "0%" }} /></div></div>
            <div><div className="mb-1 flex justify-between text-sm"><span>Memory</span><span>{payload?.memoryUsage || "-"}</span></div><div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-emerald-500" style={{ width: payload?.memoryPercent || "0%" }} /></div></div>
          </div></section>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}