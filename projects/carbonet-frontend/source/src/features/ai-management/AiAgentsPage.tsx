import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { fetchAiAgents } from "../../lib/api/aiManagement";
import { SimpleTable, SummaryCards, TabBar, text, rowsOf } from "./aiShared";

type TabKey = "agents"|"tools"|"prompts"|"workflows"|"router";

export function AiAgentsPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const [tab, setTab] = useState<TabKey>("agents");
  const state = useAsyncValue(() => fetchAiAgents({}), []);
  const payload = state.value;
  useEffect(() => { logGovernanceScope("PAGE","ai-agents",{language:en?"en":"ko"}); }, [en]);
  useEffect(() => {
    function handleNavigationSync() {
      void state.reload();
      void session.reload();
    }
    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => window.removeEventListener(getNavigationEventName(), handleNavigationSync);
  }, [state, session]);

  const tabs = [{key:"agents",label:en?"Agents":"에이전트"},{key:"tools",label:en?"Tools":"Tool"},{key:"prompts",label:en?"Prompts":"Prompt"},{key:"workflows",label:en?"Workflows":"Workflow"},{key:"router",label:en?"Router":"Router"}];
  const cols: Record<TabKey, any[]> = {
    agents: [{key:"name",label:en?"Name":"이름"},{key:"model",label:en?"Model":"모델"},{key:"type",label:en?"Type":"유형"},{key:"status",label:en?"Status":"상태",badge:true},{key:"lastActive",label:en?"Last Active":"최근 활동"}],
    tools: [{key:"name",label:en?"Name":"이름"},{key:"type",label:en?"Type":"유형"},{key:"endpoint",label:"Endpoint"},{key:"status",label:en?"Status":"상태",badge:true}],
    prompts: [{key:"name",label:en?"Name":"이름"},{key:"version",label:"Version"},{key:"model",label:en?"Model":"모델"},{key:"status",label:en?"Status":"상태",badge:true},{key:"updatedAt",label:en?"Updated":"수정일"}],
    workflows: [{key:"name",label:en?"Name":"이름"},{key:"steps",label:en?"Steps":"단계"},{key:"lastRun",label:en?"Last Run":"최근 실행"},{key:"status",label:en?"Status":"상태",badge:true}],
    router: [{key:"routeName",label:en?"Route":"경로"},{key:"condition",label:en?"Condition":"조건"},{key:"target",label:en?"Target":"대상"},{key:"priority",label:en?"Priority":"우선순위"},{key:"status",label:en?"Status":"상태",badge:true}],
  };

  return (
    <AdminPageShell breadcrumbs={[{label:en?"Home":"홈",href:buildLocalizedPath("/admin/","/en/admin/")},{label:en?"AI Management":"AI 관리"},{label:en?"Agents":"에이전트 관리"}]} sidebarVariant="system" title={en?"Agent Management":"에이전트 관리"} subtitle={en?"Manage AI agents, tools, prompts, workflows, and routing.":"AI 에이전트, 도구, 프롬프트, 워크플로우, 라우팅을 관리합니다."} actions={<button className="gov-btn gov-btn-primary" type="button">{en?"Register Agent":"에이전트 등록"}</button>}>
      <AdminWorkspacePageFrame>
        {state.error ? <PageStatusNotice tone="error">{state.error}</PageStatusNotice> : null}
        <SummaryCards cards={[
          {title:en?"Agents":"에이전트",value:text(payload?.summary?.agentCount),desc:en?"Total registered agents.":"등록된 에이전트입니다."},
          {title:en?"Tools":"도구",value:text(payload?.summary?.toolCount),desc:en?"Available tools.":"사용 가능한 도구입니다."},
          {title:en?"Workflows":"워크플로우",value:text(payload?.summary?.workflowCount),desc:en?"Active workflows.":"활성 워크플로우입니다."},
          {title:en?"Routes":"라우트",value:text(payload?.summary?.routeCount),desc:en?"Configured router entries.":"설정된 라우터 항목입니다."},
        ]} />
        <section className="gov-card">
          <TabBar tabs={tabs} active={tab} setActive={(k)=>setTab(k as TabKey)} />
          <SimpleTable rows={rowsOf((payload as any)?.[tab] || [])} columns={cols[tab]} />
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}