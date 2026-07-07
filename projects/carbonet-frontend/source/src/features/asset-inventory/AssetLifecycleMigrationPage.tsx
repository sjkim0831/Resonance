import { useEffect, useMemo, useState } from "react";
import { getCurrentRuntimeSearch } from "../../app/routes/runtime";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchSystemAssetLifecycle, createSystemAssetLifecyclePlan } from "../../lib/api/platform";
import type { SystemAssetLifecyclePayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { DiagnosticCard, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminSelect, MemberButton, MemberLinkButton } from "../member/common";

type StageType = "CREATE" | "PUBLISH" | "DEPRECATE" | "RETIRE" | "ROLLBACK";

function getSearchParam(key: string) {
  return new URLSearchParams(getCurrentRuntimeSearch()).get(key) || "";
}

export function AssetLifecycleMigrationPage() {
  const en = isEnglish();
  const [lifecycleData, setLifecycleData] = useState<SystemAssetLifecyclePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // New Plan State
  const [targetAssetId, setTargetAssetId] = useState("");
  const [targetStage, setTargetStage] = useState<StageType>("PUBLISH");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const assetIdParam = useMemo(() => getSearchParam("id"), []);

  const loadLifecycleData = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchSystemAssetLifecycle(id);
      setLifecycleData(data);
      if (id) setTargetAssetId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lifecycle data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLifecycleData(assetIdParam);
  }, [assetIdParam]);

  const handleCreatePlan = async () => {
    if (!targetAssetId || !reason) return;
    setSubmitting(true);
    try {
      await createSystemAssetLifecyclePlan({
        assetId: targetAssetId,
        targetStage,
        reason
      });
      setReason("");
      await loadLifecycleData(targetAssetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    logGovernanceScope("PAGE", "asset-lifecycle", {
      language: en ? "en" : "ko",
      planCount: lifecycleData?.plans.length || 0,
      assetId: targetAssetId
    });
  }, [en, lifecycleData?.plans.length, targetAssetId]);

  return (
    <AdminPageShell
      title={en ? "Asset Lifecycle Governance" : "자산 수명주기 거버넌스"}
      subtitle={en ? "Manage asset stage transitions with evidence and approval." : "증적과 승인을 기반으로 자산의 단계 전환을 관리합니다."}
      breadcrumbs={[
        { label: en ? "Asset Inventory" : "자산 인벤토리", href: buildLocalizedPath("/admin/system/asset-inventory", "/en/admin/system/asset-inventory") },
        { label: en ? "Asset Lifecycle" : "자산 수명주기" }
      ]}
    >
      <AdminWorkspacePageFrame>
        {error && <PageStatusNotice tone="error">{error}</PageStatusNotice>}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="lifecycle-summary">
          <SummaryMetricCard title={en ? "Active Plans" : "활성 계획"} value={`${lifecycleData?.plans.filter(p => p.planStatus === "REQUESTED").length || 0}`} />
          <SummaryMetricCard title={en ? "Completed" : "완료됨"} value={`${lifecycleData?.plans.filter(p => p.planStatus === "COMPLETED").length || 0}`} />
          <SummaryMetricCard title={en ? "Drafts" : "초안"} value={`${lifecycleData?.plans.filter(p => p.planStatus === "DRAFT").length || 0}`} />
          <SummaryMetricCard title={en ? "Total Evidence" : "전체 증적"} value={`${lifecycleData?.totalEvidenceCount || 0}`} />
        </section>

        <article className="gov-card" data-help-id="lifecycle-new-plan">
          <GridToolbar title={en ? "Propose New Lifecycle Transition" : "새 수명주기 전환 제안"} />
          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3 xl:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target Asset ID" : "대상 자산 식별자"}</span>
              <input 
                type="text" 
                className="gov-input w-full" 
                value={targetAssetId} 
                onChange={(e) => setTargetAssetId(e.target.value)}
                placeholder="e.g. NODE-001"
              />
            </label>
            
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target Stage" : "목표 단계"}</span>
              <AdminSelect value={targetStage} onChange={(e) => setTargetStage(e.target.value as StageType)}>
                <option value="PUBLISH">PUBLISH (반영)</option>
                <option value="DEPRECATE">DEPRECATE (지원 종료)</option>
                <option value="RETIRE">RETIRE (영구 폐기)</option>
                <option value="ROLLBACK">ROLLBACK (회수)</option>
              </AdminSelect>
            </label>

            <div className="flex flex-col gap-3">
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Reason / Context" : "사유 / 컨텍스트"}</span>
              <input 
                type="text" 
                className="gov-input w-full" 
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
                placeholder={en ? "Enter reason for transition..." : "전환 사유를 입력하세요..."}
              />
            </div>

            <MemberButton onClick={handleCreatePlan} disabled={submitting || !targetAssetId || !reason} variant="primary">
              {submitting ? "..." : (en ? "Request Transition" : "전환 요청")}
            </MemberButton>
          </div>
        </article>

        <section className="gov-card" data-help-id="lifecycle-history">
          <GridToolbar title={en ? "Transition History & Plans" : "전환 이력 및 계획"} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3">{en ? "Plan ID" : "계획 식별자"}</th>
                  <th className="px-4 py-3">{en ? "Asset" : "자산"}</th>
                  <th className="px-4 py-3">{en ? "Stage" : "단계"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                  <th className="px-4 py-3">{en ? "Requester" : "요청자"}</th>
                  <th className="px-4 py-3">{en ? "Date" : "일시"}</th>
                  <th className="px-4 py-3">{en ? "Evidence" : "증적"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td className="px-4 py-10 text-center" colSpan={7}>{en ? "Loading..." : "불러오는 중..."}</td></tr>
                ) : lifecycleData?.plans && lifecycleData.plans.length > 0 ? (
                  lifecycleData.plans.map((plan) => (
                    <tr className="hover:bg-slate-50" key={plan.planId}>
                      <td className="px-4 py-3 font-mono text-xs">{plan.planId}</td>
                      <td className="px-4 py-3 font-bold">{plan.assetId}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                          {plan.targetStage}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${
                          plan.planStatus === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                          plan.planStatus === "REQUESTED" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {plan.planStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{plan.requesterId}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(plan.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <MemberLinkButton href={buildLocalizedPath(`/admin/system/asset-detail?id=${encodeURIComponent(plan.assetId)}`, `/en/admin/system/asset-detail?id=${encodeURIComponent(plan.assetId)}`)} size="xs" variant="secondary">
                          {en ? "View" : "보기"}
                        </MemberLinkButton>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td className="px-4 py-10 text-center text-slate-400" colSpan={7}>{en ? "No lifecycle plans found." : "수명주기 계획이 없습니다."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2" data-help-id="lifecycle-lanes">
          <DiagnosticCard
            title={en ? "Release Evidence" : "배포 증적"}
            status={en ? "Governed" : "운영 중"}
            statusTone="healthy"
            description={en ? "Ensure every production push has a linked asset plan and evidence." : "모든 운영 배포가 자산 계획 및 증적과 연결되도록 보장합니다."}
          />
          <DiagnosticCard
            title={en ? "Deprecation Policy" : "지원 종료 정책"}
            status={en ? "Manual" : "수동 관리"}
            statusTone="warning"
            description={en ? "Legacy assets should be moved to DEPRECATED stage to warn developers." : "레거시 자산은 DEPRECATED 단계로 옮겨 개발자에게 경고를 주어야 합니다."}
          />
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
