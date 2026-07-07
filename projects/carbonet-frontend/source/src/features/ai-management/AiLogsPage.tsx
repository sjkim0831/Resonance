import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { fetchAiLogs } from "../../lib/api/aiManagement";
import { SimpleTable, SummaryCards, TabBar, text, rowsOf } from "./aiShared";

type TabKey = "conversations"|"tasks"|"errors"|"tools"|"inferences";

export function AiLogsPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const [tab, setTab] = useState<TabKey>("conversations");
  const [level, setLevel] = useState("ALL");
  const state = useAsyncValue(() => fetchAiLogs({level:level==="ALL"?undefined:level}), [level]);
  const payload = state.value;
  useEffect(() => { logGovernanceScope("PAGE","ai-logs",{language:en?"en":"ko"}); }, [en]);
  useEffect(() => {
    function handleNavigationSync() {
      void state.reload();
      void session.reload();
    }
    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => window.removeEventListener(getNavigationEventName(), handleNavigationSync);
  }, [state, session]);

  const tabs = [{key:"conversations",label:en?"Conversations":"대화 로그"},{key:"tasks",label:en?"Tasks":"작업 로그"},{key:"errors",label:en?"Errors":"오류 로그"},{key:"tools",label:en?"Tool Calls":"Tool 호출"},{key:"inferences",label:en?"Inferences":"추론 로그"}];
  const cols: Record<TabKey, any[]> = {
    conversations: [{key:"createdAt",label:en?"Time":"시간"},{key:"userQuery",label:en?"Query":"질문",wide:true},{key:"modelResponse",label:en?"Response":"응답",wide:true},{key:"model",label:en?"Model":"모델"},{key:"tokensUsed",label:"Tokens"}],
    tasks: [{key:"createdAt",label:en?"Time":"시간"},{key:"taskType",label:en?"Type":"유형"},{key:"status",label:en?"Status":"상태",badge:true},{key:"duration",label:en?"Duration":"소요시간"},{key:"summary",label:en?"Summary":"요약",wide:true}],
    errors: [{key:"createdAt",label:en?"Time":"시간"},{key:"level",label:en?"Level":"수준",badge:true},{key:"source",label:en?"Source":"발생처"},{key:"message",label:en?"Message":"메시지",wide:true}],
    tools: [{key:"createdAt",label:en?"Time":"시간"},{key:"toolName",label:en?"Tool":"도구명"},{key:"arguments",label:en?"Args":"인자",wide:true},{key:"status",label:en?"Status":"상태",badge:true},{key:"duration",label:en?"Duration":"소요시간"}],
    inferences: [{key:"createdAt",label:en?"Time":"시간"},{key:"model",label:en?"Model":"모델"},{key:"promptTokens",label:"Prompt"},{key:"completionTokens",label:"Completion"},{key:"latency",label:en?"Latency":"지연"},{key:"status",label:en?"Status":"상태",badge:true}],
  };

  return (
    <AdminPageShell breadcrumbs={[{label:en?"Home":"홈",href:buildLocalizedPath("/admin/","/en/admin/")},{label:en?"AI Management":"AI 관리"},{label:en?"Logs":"로그 관리"}]} sidebarVariant="system" title={en?"AI Log Management":"AI 로그 관리"} subtitle={en?"Review conversation logs, task history, errors, tool calls, and inference records.":"대화 로그, 작업 이력, 오류, Tool 호출, 추론 기록을 검토합니다."}>
      <AdminWorkspacePageFrame>
        {state.error ? <PageStatusNotice tone="error">{state.error}</PageStatusNotice> : null}
        <SummaryCards cards={[
          {title:en?"Conversations":"대화",value:text(payload?.summary?.conversationCount),desc:en?"Total conversations.":"전체 대화 수입니다."},
          {title:en?"Tasks":"작업",value:text(payload?.summary?.taskCount),desc:en?"Total tasks.":"전체 작업 수입니다."},
          {title:en?"Errors":"오류",value:text(payload?.summary?.errorCount),desc:en?"Recent errors.":"최근 오류 수입니다."},
          {title:en?"Inferences":"추론",value:text(payload?.summary?.inferenceCount),desc:en?"Total inferences.":"전체 추론 수입니다."},
        ]} />
        <section className="gov-card">
          <TabBar tabs={tabs} active={tab} setActive={(k)=>setTab(k as TabKey)} extra={<select className="gov-select text-sm" value={level} onChange={e=>setLevel(e.target.value)}><option value="ALL">{en?"All Levels":"전체"}</option><option value="INFO">INFO</option><option value="WARN">WARN</option><option value="ERROR">ERROR</option></select>} />
          <SimpleTable rows={rowsOf((payload as any)?.[tab] || [])} columns={cols[tab]} />
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}