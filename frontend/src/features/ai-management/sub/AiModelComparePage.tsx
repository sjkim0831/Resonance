import { useEffect } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AiModelsPage } from "../AiModelsPage";

export function AiModelComparePage() {
  const en = isEnglish();
  useEffect(() => { logGovernanceScope("PAGE", "ai-model-compare", { language: en ? "en" : "ko" }); }, [en]);
  return (
    <AdminPageShell
      breadcrumbs={[{ label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") }, { label: en ? "AI Management" : "AI 관리" }, { label: en ? "Model Comparison" : "모델 비교" }]}
      sidebarVariant="system"
      title={en ? "Model Comparison" : "모델 비교"}
      subtitle={en ? "Compare model accuracy, latency, and resource usage side by side." : "모델 정확도, 지연시간, 리소스 사용량을 나란히 비교합니다."}
    >
      <AdminWorkspacePageFrame>
        <section className="gov-card">
          <div className="px-6 py-5 border-b border-[var(--kr-gov-border-light)]">
            <div className="flex gap-4 items-center">
              <select className="gov-select"><option>gemma3:4b</option><option>qwen2.5-coder:14b</option><option>gemma-4-e2b-it</option></select>
              <span className="text-[var(--kr-gov-text-secondary)]">vs</span>
              <select className="gov-select"><option>qwen2.5-coder:14b</option><option>gemma3:4b</option><option>gemma-4-e2b-it</option></select>
              <button className="gov-btn gov-btn-primary">{en ? "Compare" : "비교"}</button>
            </div>
          </div>
          <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)] text-sm">
            <thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left text-xs font-black uppercase text-[var(--kr-gov-text-secondary)]">{en ? "Metric" : "지표"}</th><th className="px-4 py-3 text-left text-xs font-black uppercase text-[var(--kr-gov-text-secondary)]">Model A</th><th className="px-4 py-3 text-left text-xs font-black uppercase text-[var(--kr-gov-text-secondary)]">Model B</th></tr></thead>
            <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white">
              {[
                {m:en ? "Accuracy" : "정확도",a:"88%",b:"92%"},
                {m:en ? "Avg Latency" : "평균 지연",a:"1.4s",b:"3.2s"},
                {m:"Tokens/sec",a:"45",b:"22"},
                {m:"GPU Memory",a:"8 GB",b:"32 GB"},
                {m:en ? "Context Window" : "컨텍스트 윈도우",a:"128K",b:"256K"},
              ].map(r => <tr key={r.m}><td className="px-4 py-3 font-medium">{r.m}</td><td className="px-4 py-3">{r.a}</td><td className="px-4 py-3">{r.b}</td></tr>)}
            </tbody>
          </table>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export { AiModelsPage as AiModelVersionsPage, AiModelsPage as AiModelDeployPage, AiModelsPage as AiModelMonitorPage };