import { useEffect } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AiModelsPage } from "../AiModelsPage";

export function AiModelRegisterPage() {
  const en = isEnglish();
  useEffect(() => { logGovernanceScope("PAGE", "ai-model-register", { language: en ? "en" : "ko" }); }, [en]);
  return (
    <AdminPageShell
      breadcrumbs={[{ label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") }, { label: en ? "AI Management" : "AI 관리" }, { label: en ? "Register Model" : "모델 등록" }]}
      sidebarVariant="system"
      title={en ? "Register Model" : "모델 등록"}
      subtitle={en ? "Register a new AI model or adapter." : "새 AI 모델 또는 어댑터를 등록합니다."}
    >
      <AdminWorkspacePageFrame>
        <section className="gov-card p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Model Name" : "모델명"}</span>
              <input className="gov-input w-full" placeholder={en ? "e.g., qwen2.5-coder:14b" : "예: qwen2.5-coder:14b"} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Provider" : "제공자"}</span>
              <select className="gov-select w-full">
                <option>Ollama</option>
                <option>vLLM</option>
                <option>OpenAI</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Model Type" : "모델 유형"}</span>
              <select className="gov-select w-full">
                <option>{en ? "Chat/Instruction" : "채팅/명령"}</option>
                <option>{en ? "Code Generation" : "코드 생성"}</option>
                <option>{en ? "Embedding" : "임베딩"}</option>
                <option>{en ? "Vision" : "비전"}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">Endpoint URL</span>
              <input className="gov-input w-full" placeholder="http://localhost:11434/api/generate" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Description" : "설명"}</span>
              <textarea className="gov-textarea w-full" rows={3} placeholder={en ? "Model capabilities and notes..." : "모델 기능 및 참고 사항..."} />
            </label>
          </div>
          <div className="mt-6 flex gap-3">
            <button className="gov-btn gov-btn-primary" type="button">{en ? "Register" : "등록"}</button>
            <button className="gov-btn gov-btn-outline" type="button">{en ? "Cancel" : "취소"}</button>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export function AiModelVersionsPage() { return <AiModelsPage />; }
export function AiModelDeployPage() { return <AiModelsPage />; }
export function AiModelMonitorPage() { return <AiModelsPage />; }
export function AiModelResourcesPage() {
  const en = isEnglish();
  useEffect(() => { logGovernanceScope("PAGE", "ai-model-resources", { language: en ? "en" : "ko" }); }, [en]);
  return (
    <AdminPageShell
      breadcrumbs={[{ label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") }, { label: en ? "AI Management" : "AI 관리" }, { label: en ? "GPU/CPU Resources" : "GPU/CPU 리소스" }]}
      sidebarVariant="system"
      title={en ? "GPU / CPU Resources" : "GPU / CPU 리소스"}
      subtitle={en ? "Monitor hardware resource allocation for AI workloads." : "AI 워크로드의 하드웨어 리소스 할당을 모니터링합니다."}
    >
      <AdminWorkspacePageFrame>
        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="gov-card p-5"><div className="text-sm text-[var(--kr-gov-text-secondary)]">GPU 0</div><div className="mt-2 text-lg font-black">NVIDIA A100</div><div className="h-2 mt-2 rounded-full bg-slate-200"><div className="h-2 w-[72%] rounded-full bg-blue-500" /></div><div className="mt-1 text-sm">72% · 64/80 GB</div></div>
          <div className="gov-card p-5"><div className="text-sm text-[var(--kr-gov-text-secondary)]">GPU 1</div><div className="mt-2 text-lg font-black">NVIDIA A100</div><div className="h-2 mt-2 rounded-full bg-slate-200"><div className="h-2 w-[45%] rounded-full bg-blue-500" /></div><div className="mt-1 text-sm">45% · 36/80 GB</div></div>
          <div className="gov-card p-5"><div className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "CPU" : "CPU"}</div><div className="mt-2 text-lg font-black">32 Cores</div><div className="h-2 mt-2 rounded-full bg-slate-200"><div className="h-2 w-[23%] rounded-full bg-amber-500" /></div><div className="mt-1 text-sm">23% · 7.4/32 cores</div></div>
          <div className="gov-card p-5"><div className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Memory" : "메모리"}</div><div className="mt-2 text-lg font-black">256 GB</div><div className="h-2 mt-2 rounded-full bg-slate-200"><div className="h-2 w-[38%] rounded-full bg-emerald-500" /></div><div className="mt-1 text-sm">38% · 97/256 GB</div></div>
        </section>
        <section className="gov-card">
          <div className="px-6 py-5 border-b border-[var(--kr-gov-border-light)]">
            <h2 className="text-lg font-black">{en ? "Model Resources" : "모델별 리소스"}</h2>
          </div>
          <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)] text-sm">
            <thead className="bg-slate-50"><tr>{["Model", "GPU", "VRAM", "Status"].map(h => <th className="px-4 py-3 text-left text-xs font-black uppercase" key={h}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white">
              {[{m:"gemma3:4b",g:"GPU 0",v:"8 GB",s:"ACTIVE"},{m:"qwen2.5-coder:14b",g:"GPU 0-1",v:"32 GB",s:"ACTIVE"},{m:"gemma-4-e2b-it",g:"GPU 1",v:"16 GB",s:"ACTIVE"}].map(r => <tr key={r.m}><td className="px-4 py-3 font-bold">{r.m}</td><td className="px-4 py-3">{r.g}</td><td className="px-4 py-3">{r.v}</td><td className="px-4 py-3"><span className="inline-flex rounded-full px-2.5 py-1 text-xs font-black bg-emerald-100 text-emerald-700">{r.s}</span></td></tr>)}
            </tbody>
          </table>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}