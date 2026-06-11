import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { fetchAiModels, type AiModelsPayload } from "../../lib/api/aiManagement";
import { Badge, SimpleTable, SummaryCards, TabBar, text, rowsOf } from "./aiShared";

type TabKey = "models" | "versions" | "deployments" | "comparison";

export function AiModelsPage() {
  const en = isEnglish();
  const [status, setStatus] = useState("ALL");
  const [provider, setProvider] = useState("ALL");
  const [tab, setTab] = useState<TabKey>("models");
  const state = useAsyncValue(() => fetchAiModels({status:status==="ALL"?undefined:status,provider:provider==="ALL"?undefined:provider}), [status, provider]);
  const payload = state.value;
  useEffect(() => { logGovernanceScope("PAGE","ai-models",{language:en?"en":"ko"}); }, [en]);

  const tabs = [{key:"models",label:en?"Models":"모델 목록"},{key:"versions",label:en?"Versions":"버전 관리"},{key:"deployments",label:en?"Deployments":"배포 현황"},{key:"comparison",label:en?"Comparison":"모델 비교"}];
  const cols: Record<TabKey, any[]> = {
    models: [{key:"name",label:en?"Name":"모델명"},{key:"version",label:"Version"},{key:"provider",label:en?"Provider":"제공자"},{key:"type",label:en?"Type":"유형"},{key:"status",label:en?"Status":"상태",badge:true},{key:"latency",label:en?"Latency":"지연시간"}],
    versions: [{key:"modelName",label:en?"Model":"모델"},{key:"version",label:"Version"},{key:"createdAt",label:en?"Created":"생성일"},{key:"status",label:en?"Status":"상태",badge:true},{key:"accuracy",label:en?"Accuracy":"정확도"}],
    deployments: [{key:"modelName",label:en?"Model":"모델"},{key:"endpoint",label:"Endpoint"},{key:"replicas",label:en?"Replicas":"레플리카"},{key:"status",label:en?"Status":"상태",badge:true},{key:"uptime",label:en?"Uptime":"가동시간"}],
    comparison: [{key:"modelName",label:en?"Model":"모델"},{key:"accuracy",label:en?"Accuracy":"정확도"},{key:"avgLatency",label:en?"Avg Latency":"평균 지연"},{key:"tokensPerSec",label:"Tokens/s"},{key:"gpuMemory",label:"GPU Memory"},{key:"status",label:en?"Status":"상태",badge:true}],
  };

  return (
    <AdminPageShell breadcrumbs={[{label:en?"Home":"홈",href:buildLocalizedPath("/admin/","/en/admin/")},{label:en?"AI Management":"AI 관리"},{label:en?"Models":"모델 관리"}]} sidebarVariant="system" title={en?"Model Management":"모델 관리"} subtitle={en?"Register, deploy, and monitor AI models.":"AI 모델을 등록, 배포, 모니터링합니다."} actions={<button className="gov-btn gov-btn-primary" type="button">{en?"Register Model":"모델 등록"}</button>}>
      <AdminWorkspacePageFrame>
        {state.error ? <PageStatusNotice tone="error">{state.error}</PageStatusNotice> : null}
        <SummaryCards cards={[
          {title:en?"Total Models":"전체 모델",value:text(payload?.summary?.totalCount),desc:en?"Registered models.":"등록된 모델입니다."},
          {title:en?"Active":"활성",value:text(payload?.summary?.activeCount),desc:en?"Currently deployed.":"현재 배포 중입니다."},
          {title:en?"Avg Accuracy":"평균 정확도",value:text(payload?.summary?.avgAccuracy),desc:en?"Across all models.":"전체 모델 평균입니다."},
          {title:en?"Avg Latency":"평균 지연",value:text(payload?.summary?.avgLatency),desc:en?"Inference response time.":"추론 응답 시간입니다."},
        ]} />
        <section className="gov-card">
          <TabBar tabs={tabs} active={tab} setActive={(k)=>setTab(k as TabKey)} extra={<>
            <select className="gov-select text-sm" value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">{en?"All Status":"전체 상태"}</option><option value="ACTIVE">ACTIVE</option><option value="STOPPED">STOPPED</option></select>
            <select className="gov-select text-sm" value={provider} onChange={e=>setProvider(e.target.value)}><option value="ALL">{en?"All Providers":"전체 제공자"}</option><option value="ollama">Ollama</option><option value="vllm">vLLM</option></select>
          </>} />
          <SimpleTable rows={rowsOf(payload?.[tab] || [])} columns={cols[tab]} />
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}