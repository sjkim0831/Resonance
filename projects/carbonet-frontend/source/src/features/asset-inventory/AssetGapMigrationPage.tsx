import { useEffect, useMemo, useState } from "react";
import { getCurrentRuntimeSearch } from "../../app/routes/runtime";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchSystemAssetGap, updateSystemAsset } from "../../lib/api/platform";
import type { SystemAssetGapPayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { DiagnosticCard, GridToolbar, MemberLinkButton, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminSelect, MemberButton } from "../member/common";

type GapType = "owner" | "criticality" | "drift" | "orphan";

const GAP_QUEUES: Array<{ key: GapType; titleKo: string; titleEn: string; descKo: string; descEn: string }> = [
  {
    key: "owner",
    titleKo: "소유자 누락",
    titleEn: "Missing Owner",
    descKo: "메뉴, 페이지, 배치, 외부연계에 owner가 없는 항목",
    descEn: "Assets with no owner across menu, page, batch, and external integration"
  },
  {
    key: "criticality",
    titleKo: "중요도 누락",
    titleEn: "Missing Criticality",
    descKo: "서비스 중요도가 정의되지 않아 운영 우선순위 파악이 어려운 항목",
    descEn: "Assets with no criticality defined, making it hard to prioritize operations"
  },
  {
    key: "drift",
    titleKo: "변동 감지 (Drift)",
    titleEn: "Content Drift",
    descKo: "마지막 스캔 이후 콘텐츠 해시가 변경되어 의도치 않은 변동이 의심되는 항목",
    descEn: "Assets with suspected unintended changes since the last scan"
  },
  {
    key: "orphan",
    titleKo: "고아 자산",
    titleEn: "Orphan Asset",
    descKo: "메뉴 또는 운영 연결 없이 남아있는 파일, 도움말, 자원",
    descEn: "Files, help content, and resources left without menu or runtime ownership"
  }
];

function getSearchParam(key: string) {
  return new URLSearchParams(getCurrentRuntimeSearch()).get(key) || "";
}

function buildAssetGapHref(queue = "") {
  const query = queue ? `?queue=${encodeURIComponent(queue)}` : "";
  return buildLocalizedPath(`/admin/system/asset-gap${query}`, `/en/admin/system/asset-gap${query}`);
}

export function AssetGapMigrationPage() {
  const en = isEnglish();
  const [gapData, setGapData] = useState<SystemAssetGapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Row inline edit state
  const [quickEdits, setQuickEdits] = useState<Record<string, { owner?: string; criticality?: string }>>({});
  const [updatingId, setUpdatingId] = useState("");

  const selectedQueue = useMemo(() => (getSearchParam("queue") as GapType) || "", []);

  const loadGapData = async (queueType: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchSystemAssetGap(queueType);
      setGapData(data);
      setQuickEdits({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gap data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGapData(selectedQueue);
  }, [selectedQueue]);

  const handleQuickUpdate = async (assetId: string) => {
    const edit = quickEdits[assetId];
    if (!edit) return;
    
    setUpdatingId(assetId);
    try {
      await updateSystemAsset({
        id: assetId,
        ownerDomain: edit.owner,
        criticality: edit.criticality
      });
      await loadGapData(selectedQueue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quick update failed");
    } finally {
      setUpdatingId("");
    }
  };

  const updateEditState = (assetId: string, field: "owner" | "criticality", value: string) => {
    setQuickEdits(prev => ({
      ...prev,
      [assetId]: { ...prev[assetId], [field]: value }
    }));
  };

  useEffect(() => {
    logGovernanceScope("PAGE", "asset-gap", {
      language: en ? "en" : "ko",
      queueCount: GAP_QUEUES.length,
      selectedQueue
    });
  }, [en, selectedQueue]);

  return (
    <AdminPageShell
      title={en ? "Asset Gap Queue" : "자산 미흡 큐"}
      subtitle={en ? "Collect still-ungoverned assets into one queue." : "거버넌스 미흡 자산을 하나의 큐로 모읍니다."}
      breadcrumbs={[
        { label: en ? "Asset Inventory" : "자산 인벤토리", href: buildLocalizedPath("/admin/system/asset-inventory", "/en/admin/system/asset-inventory") },
        { label: en ? "Asset Gap Queue" : "자산 미흡 큐" }
      ]}
    >
      <AdminWorkspacePageFrame>
        {error && <PageStatusNotice tone="error">{error}</PageStatusNotice>}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="asset-gap-summary">
          <SummaryMetricCard title={en ? "Missing Owner" : "소유자 누락"} value={`${gapData?.summary.missingOwnerCount || 0}`} />
          <SummaryMetricCard title={en ? "Missing Criticality" : "중요도 누락"} value={`${gapData?.summary.missingCriticalityCount || 0}`} />
          <SummaryMetricCard title={en ? "Content Drift" : "변동 감지"} value={`${gapData?.summary.driftedCount || 0}`} />
          <SummaryMetricCard title={en ? "Orphan Assets" : "고아 자산"} value={`${gapData?.summary.orphanCount || 0}`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2" data-help-id="asset-gap-queues">
          {GAP_QUEUES.map((queue) => {
            const selected = selectedQueue === queue.key;
            const count = 
              queue.key === "owner" ? gapData?.summary.missingOwnerCount :
              queue.key === "criticality" ? gapData?.summary.missingCriticalityCount :
              queue.key === "drift" ? gapData?.summary.driftedCount :
              gapData?.summary.orphanCount;

            return (
              <DiagnosticCard
                key={queue.key}
                title={en ? queue.titleEn : queue.titleKo}
                status={count !== undefined ? (en ? `${count} items` : `${count} 건`) : "-"}
                statusTone={count && count > 0 ? "warning" : "healthy"}
                description={en ? queue.descEn : queue.descKo}
                actions={(
                  <MemberLinkButton href={buildAssetGapHref(queue.key)} size="xs" variant={selected ? "primary" : "secondary"}>
                    {en ? "Review Queue" : "큐 검토"}
                  </MemberLinkButton>
                )}
              />
            );
          })}
        </section>

        {selectedQueue && (
          <section className="gov-card" data-help-id="asset-gap-list">
            <GridToolbar title={en ? `Gap Targets: ${GAP_QUEUES.find(q => q.key === selectedQueue)?.titleEn}` : `미흡 대상: ${GAP_QUEUES.find(q => q.key === selectedQueue)?.titleKo}`} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3">{en ? "Asset ID" : "자산 식별자"}</th>
                    <th className="px-4 py-3">{en ? "Name" : "이름"}</th>
                    <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                    <th className="px-4 py-3">{en ? "Quick Action" : "빠른 조치"}</th>
                    <th className="px-4 py-3">{en ? "Save" : "저장"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td className="px-4 py-10 text-center" colSpan={5}>{en ? "Loading..." : "불러오는 중..."}</td></tr>
                  ) : gapData?.assets && gapData.assets.length > 0 ? (
                    gapData.assets.map((asset) => (
                      <tr className="hover:bg-slate-50" key={asset.assetId}>
                        <td className="px-4 py-3 font-mono text-xs">{asset.assetId}</td>
                        <td className="px-4 py-3 font-bold">{asset.assetName}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${asset.healthStatus === "OK" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {asset.healthStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {selectedQueue === "owner" && (
                            <AdminSelect 
                              value={quickEdits[asset.assetId]?.owner || ""} 
                              onChange={(e) => updateEditState(asset.assetId, "owner", e.target.value)}
                              className="text-xs py-1"
                            >
                              <option value="">{en ? "Unassigned" : "미배정"}</option>
                              <option value="GENERAL_ADMIN">GENERAL_ADMIN</option>
                              <option value="COMMON_ADMIN_OPS">COMMON_ADMIN_OPS</option>
                              <option value="EXTERNAL_INTEGRATION">EXTERNAL_INTEGRATION</option>
                            </AdminSelect>
                          )}
                          {selectedQueue === "criticality" && (
                            <AdminSelect 
                              value={quickEdits[asset.assetId]?.criticality || ""} 
                              onChange={(e) => updateEditState(asset.assetId, "criticality", e.target.value)}
                              className="text-xs py-1"
                            >
                              <option value="">{en ? "Undefined" : "미정의"}</option>
                              <option value="CRITICAL">CRITICAL</option>
                              <option value="HIGH">HIGH</option>
                              <option value="MEDIUM">MEDIUM</option>
                              <option value="LOW">LOW</option>
                            </AdminSelect>
                          )}
                          {["drift", "orphan"].includes(selectedQueue) && (
                            <MemberLinkButton href={buildLocalizedPath(`/admin/system/asset-detail?id=${encodeURIComponent(asset.assetId)}`, `/en/admin/system/asset-detail?id=${encodeURIComponent(asset.assetId)}`)} size="xs" variant="secondary">
                              {en ? "Investigate" : "조사하기"}
                            </MemberLinkButton>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {["owner", "criticality"].includes(selectedQueue) && (
                            <MemberButton 
                              size="xs" 
                              variant="primary" 
                              onClick={() => handleQuickUpdate(asset.assetId)}
                              disabled={updatingId === asset.assetId || !quickEdits[asset.assetId]}
                            >
                              {updatingId === asset.assetId ? "..." : (en ? "Apply" : "적용")}
                            </MemberButton>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td className="px-4 py-10 text-center text-slate-400" colSpan={5}>{en ? "No assets in this queue." : "이 큐에 해당되는 자산이 없습니다."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
