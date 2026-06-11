import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { fetchAiQuality, type AiQualityPayload } from "../../lib/api/aiManagement";
import { Badge, SimpleTable, SummaryCards, TabBar, text, rowsOf } from "./aiShared";

type TabKey = "evaluations"|"feedback"|"hallucination"|"accuracy"|"abtest";

export function AiQualityPage() {
  const en = isEnglish();
  const [tab, setTab] = useState<TabKey>("evaluations");
  const [modelId, setModelId] = useState("ALL");
  const state = useAsyncValue(() => fetchAiQuality({modelId:modelId==="ALL"?undefined:modelId}), [modelId]);
  const payload = state.value;
  useEffect(() => { logGovernanceScope("PAGE","ai-quality",{language:en?"en":"ko"}); }, [en]);

  const tabs = [{key:"evaluations",label:en?"Evaluations":"응답 평가"},{key:"feedback",label:en?"Feedback":"사용자 피드백"},{key:"hallucination",label:en?"Hallucination":"Hallucination"},{key:"accuracy",label:en?"Accuracy":"정답률 분석"},{key:"abtest",label:en?"A/B Test":"A/B 테스트"}];
  const cols: Record<TabKey, any[]> = {
    evaluations: [{key:"createdAt",label:en?"Date":"일자"},{key:"model",label:en?"Model":"모델"},{key:"score",label:en?"Score":"점수",badge:true},{key:"criteria",label:en?"Criteria":"평가 기준"},{key:"comment",label:en?"Comment":"코멘트",wide:true}],
    feedback: [{key:"createdAt",label:en?"Date":"일자"},{key:"userId",label:en?"User":"사용자"},{key:"rating",label:en?"Rating":"평점"},{key:"category",label:en?"Category":"카테고리"},{key:"comment",label:en?"Comment":"의견",wide:true}],
    hallucination: [{key:"detectedAt",label:en?"Date":"일자"},{key:"model",label:en?"Model":"모델"},{key:"claim",label:en?"Claim":"주장",wide:true},{key:"verification",label:en?"Verification":"검증 결과",wide:true},{key:"severity",label:en?"Severity":"심각도",badge:true}],
    accuracy: [{key:"period",label:en?"Period":"기간"},{key:"model",label:en?"Model":"모델"},{key:"accuracy",label:en?"Accuracy":"정확도",badge:true},{key:"sampleSize",label:en?"Samples":"표본 수"}],
    abtest: [{key:"testName",label:en?"Test":"테스트명"},{key:"modelA",label:"Model A"},{key:"modelB",label:"Model B"},{key:"winner",label:en?"Winner":"승자"},{key:"confidence",label:en?"Confidence":"신뢰도"},{key:"status",label:en?"Status":"상태",badge:true}],
  };

  return (
    <AdminPageShell breadcrumbs={[{label:en?"Home":"홈",href:buildLocalizedPath("/admin/","/en/admin/")},{label:en?"AI Management":"AI 관리"},{label:en?"Quality":"품질 관리"}]} sidebarVariant="system" title={en?"AI Quality Management":"AI 품질 관리"} subtitle={en?"Evaluate responses, review feedback, monitor hallucination, and analyze accuracy.":"응답을 평가하고, 피드백을 검토하며, Hallucination을 모니터링하고, 정확도를 분석합니다."}>
      <AdminWorkspacePageFrame>
        {state.error ? <PageStatusNotice tone="error">{state.error}</PageStatusNotice> : null}
        <SummaryCards cards={[
          {title:en?"Avg Score":"평균 점수",value:text(payload?.summary?.avgScore),desc:en?"Response quality score.":"응답 품질 점수입니다."},
          {title:en?"Hallucinations":"Hallucination",value:text(payload?.summary?.hallucinationCount),desc:en?"Detected this period.":"이 기간 탐지된 건수입니다."},
          {title:en?"Feedback":"피드백",value:text(payload?.summary?.feedbackCount),desc:en?"User feedback received.":"수집된 사용자 피드백입니다."},
          {title:en?"A/B Tests":"A/B 테스트",value:text(payload?.summary?.abTestCount),desc:en?"Active experiments.":"진행 중인 실험입니다."},
        ]} />
        <section className="gov-card">
          <TabBar tabs={tabs} active={tab} setActive={(k)=>setTab(k as TabKey)} extra={<select className="gov-select text-sm" value={modelId} onChange={e=>setModelId(e.target.value)}><option value="ALL">{en?"All Models":"전체 모델"}</option><option value="40B">40B</option><option value="14B">14B</option><option value="7B">7B</option></select>} />
          <SimpleTable rows={rowsOf(payload?.[tab] || [])} columns={cols[tab]} />
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}