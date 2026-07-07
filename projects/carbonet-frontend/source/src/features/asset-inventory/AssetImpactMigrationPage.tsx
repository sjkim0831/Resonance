import { useEffect, useMemo, useState } from "react";
import { getCurrentRuntimeSearch } from "../../app/routes/runtime";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchSystemAssetImpact, fetchSystemAssetList } from "../../lib/api/platform";
import type { SystemAssetImpactPayload, SystemAssetInventoryVO } from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, DiagnosticCard, GridToolbar, MemberLinkButton, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type ImpactMode = "page" | "feature" | "runtime" | "integration";

const IMPACT_MODES: Array<{ key: ImpactMode; labelKo: string; labelEn: string }> = [
  { key: "page", labelKo: "페이지 영향", labelEn: "Page Impact" },
  { key: "feature", labelKo: "기능 영향", labelEn: "Feature Impact" },
  { key: "runtime", labelKo: "런타임 영향", labelEn: "Runtime Impact" },
  { key: "integration", labelKo: "연계 영향", labelEn: "Integration Impact" }
];

function getSearchParam(key: string) {
  return new URLSearchParams(getCurrentRuntimeSearch()).get(key) || "";
}

function buildAssetImpactHref(mode = "", id = "") {
  const params = new URLSearchParams();
  if (mode) params.set("mode", mode);
  if (id) params.set("id", id);
  const query = params.toString() ? `?${params.toString()}` : "";
  return buildLocalizedPath(`/admin/system/asset-impact${query}`, `/en/admin/system/asset-impact${query}`);
}

export function AssetImpactMigrationPage() {
  const en = isEnglish();
  const [activeMode, setActiveMode] = useState<ImpactMode>((getSearchParam("mode") as ImpactMode) || "page");
  const [assets, setAssets] = useState<SystemAssetInventoryVO[]>([]);
  const [impactData, setImpactData] = useState<SystemAssetImpactPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedId = useMemo(() => getSearchParam("id"), []);

  const loadAssets = async () => {
    try {
      // Filter by type based on activeMode
      let typeFilter = "";
      if (activeMode === "page") typeFilter = "PAGE";
      if (activeMode === "feature") typeFilter = "API"; // or FUNCTION

      const data = await fetchSystemAssetList({ type: typeFilter });
      setAssets(data);
    } catch (err) {
      console.error("Failed to load assets", err);
    }
  };

  const loadImpact = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchSystemAssetImpact(id);
      setImpactData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load impact data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssets();
  }, [activeMode]);

  useEffect(() => {
    if (selectedId) {
      void loadImpact(selectedId);
    } else {
      setImpactData(null);
    }
  }, [selectedId]);

  const modeConfig = useMemo(() => {
    const configs: Record<ImpactMode, {
      titleKo: string;
      titleEn: string;
      summaryKo: string;
      summaryEn: string;
      links: Array<{ labelKo: string; labelEn: string; href: string }>;
    }> = {
      page: {
        titleKo: "페이지 영향도",
        titleEn: "Page Impact",
        summaryKo: "메뉴, pageId, 기본 VIEW 기능, 삭제 영향도를 함께 검토합니다.",
        summaryEn: "Review menu, pageId, default VIEW feature, and delete impact together.",
        links: [
          { labelKo: "환경 관리", labelEn: "Environment", href: buildLocalizedPath("/admin/system/environment-management", "/en/admin/system/environment-management") },
          { labelKo: "화면 흐름 관리", labelEn: "Screen Flow", href: buildLocalizedPath("/admin/system/screen-flow-management", "/en/admin/system/screen-flow-management") }
        ]
      },
      feature: {
        titleKo: "기능 영향도",
        titleEn: "Feature Impact",
        summaryKo: "기능 삭제 또는 수정 전에 역할 매핑과 실행 버튼 노출을 함께 검토합니다.",
        summaryEn: "Before deleting or changing a feature, review role mappings and execution-button exposure.",
        links: [
          { labelKo: "기능 관리", labelEn: "Feature Management", href: buildLocalizedPath("/admin/system/feature-management", "/en/admin/system/feature-management") },
          { labelKo: "보안 정책", labelEn: "Security Policy", href: buildLocalizedPath("/admin/system/security-policy", "/en/admin/system/security-policy") }
        ]
      },
      runtime: {
        titleKo: "런타임 영향도",
        titleEn: "Runtime Impact",
        summaryKo: "배포 전후 기준으로 published runtime, compare, repair 영향을 검토합니다.",
        summaryEn: "Review published runtime, compare, and repair impacts before and after deployment.",
        links: [
          { labelKo: "런타임 비교", labelEn: "Runtime Compare", href: buildLocalizedPath("/admin/system/current-runtime-compare", "/en/admin/system/current-runtime-compare") },
          { labelKo: "리페어 워크벤치", labelEn: "Repair Workbench", href: buildLocalizedPath("/admin/system/repair-workbench", "/en/admin/system/repair-workbench") }
        ]
      },
      integration: {
        titleKo: "연계 영향도",
        titleEn: "Integration Impact",
        summaryKo: "점검, 재시도, 웹훅, 스키마가 외부연계 실행에 미치는 영향을 검토합니다.",
        summaryEn: "Review how maintenance, retry, webhooks, and schema affect external integration execution.",
        links: [
          { labelKo: "연계 모니터링", labelEn: "External Monitoring", href: buildLocalizedPath("/admin/external/connection_list", "/en/admin/external/connection_list") },
          { labelKo: "점검 관리", labelEn: "Maintenance", href: buildLocalizedPath("/admin/external/maintenance", "/en/admin/external/maintenance") }
        ]
      }
    };
    return configs[activeMode];
  }, [activeMode]);

  useEffect(() => {
    logGovernanceScope("PAGE", "asset-impact", {
      language: en ? "en" : "ko",
      mode: activeMode,
      selectedId
    });
  }, [activeMode, en, selectedId]);

  return (
    <AdminPageShell
      title={en ? "Asset Impact Console" : "자산 영향도 콘솔"}
      subtitle={en
        ? "Bring page, feature, runtime, and integration impact checks into one governed entry."
        : "페이지, 기능, 런타임, 연계 영향 검토를 하나의 거버넌스 진입점으로 묶습니다."}
      breadcrumbs={[
        { label: en ? "Asset Inventory" : "자산 인벤토리", href: buildLocalizedPath("/admin/system/asset-inventory", "/en/admin/system/asset-inventory") },
        { label: en ? "Asset Impact" : "자산 영향도" }
      ]}
    >
      <AdminWorkspacePageFrame>
        {error && <PageStatusNotice tone="error">{error}</PageStatusNotice>}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="asset-impact-summary">
          <SummaryMetricCard title={en ? "Impact Modes" : "영향 모드"} value={`${IMPACT_MODES.length}`} />
          <SummaryMetricCard title={en ? "Candidate Assets" : "검토 대상 자산"} value={`${assets.length}`} />
          <SummaryMetricCard title={en ? "Upstream Impact" : "상위 영향 건수"} value={`${impactData?.upstream.length || 0}`} />
          <SummaryMetricCard title={en ? "Downstream Impact" : "하위 영향 건수"} value={`${impactData?.downstream.length || 0}`} />
        </section>

        <section className="gov-card" data-help-id="asset-impact-modes">
          <GridToolbar title={en ? "Impact modes" : "영향도 모드"} />
          <div aria-label={en ? "Asset impact modes" : "자산 영향도 모드"} className="flex flex-wrap gap-2" role="tablist">
            {IMPACT_MODES.map((mode) => {
              const selected = activeMode === mode.key;
              return (
                <button
                  aria-selected={selected}
                  className={`rounded border px-4 py-2 text-sm font-bold ${selected ? "border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] text-white" : "border-slate-200 bg-white text-[var(--kr-gov-text-primary)]"}`}
                  key={mode.key}
                  onClick={() => {
                    setActiveMode(mode.key);
                    // Clear ID when switching modes if needed, or keep it.
                  }}
                  role="tab"
                  type="button"
                >
                  {en ? mode.labelEn : mode.labelKo}
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_1fr]">
          <section className="gov-card h-fit">
            <GridToolbar title={en ? "Review Candidates" : "검토 대상 목록"} />
            <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
              {assets.map((asset) => (
                <a
                  key={asset.assetId}
                  className={`block rounded border px-3 py-2 text-sm transition-colors ${asset.assetId === selectedId ? "border-[var(--kr-gov-blue)] bg-blue-50" : "border-slate-100 bg-white hover:bg-slate-50"}`}
                  href={buildAssetImpactHref(activeMode, asset.assetId)}
                >
                  <div className="font-bold">{asset.assetName}</div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500">{asset.assetId}</div>
                </a>
              ))}
              {assets.length === 0 && <div className="py-10 text-center text-sm text-slate-400">{en ? "No candidates found." : "검토 대상이 없습니다."}</div>}
            </div>
          </section>

          <div className="space-y-6">
            <DiagnosticCard
              data-help-id="asset-impact-overview"
              title={impactData ? (en ? `${impactData.asset.assetName} Impact Analysis` : `${impactData.asset.assetName} 영향도 분석`) : (en ? modeConfig.titleEn : modeConfig.titleKo)}
              status={impactData ? (en ? "Analysis Active" : "분석 활성") : (en ? "Select an asset" : "자산을 선택하세요")}
              statusTone={impactData ? "healthy" : "neutral"}
              description={impactData ? (en ? `Analyzing impact for ${impactData.asset.assetId}` : `${impactData.asset.assetId} 자산의 영향을 분석 중입니다.`) : (en ? modeConfig.summaryEn : modeConfig.summaryKo)}
            />

            {loading ? (
              <div className="py-20 text-center">{en ? "Analyzing impact..." : "영향 분석 중..."}</div>
            ) : impactData ? (
              <>
                <section className="grid gap-6 xl:grid-cols-2">
                  <CollectionResultPanel
                    title={en ? "Affected Upstream (Parents)" : "영향을 받는 상위 자산 (부모)"}
                    description={en ? "These assets depend on the selected asset and may be affected by changes." : "이 자산들은 선택된 자산에 의존하고 있어 변경 시 영향을 받을 수 있습니다."}
                  >
                    <div className="space-y-2">
                      {impactData.upstream.map((item) => (
                        <div key={item.composition.compositionId} className="rounded border border-amber-100 bg-amber-50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-900">{item.asset.assetName}</span>
                            <div className="flex gap-1">
                              <span className="inline-flex rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-800">{item.asset.assetFamily || "SERVICE"}</span>
                              <span className="inline-flex rounded-full bg-white border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">{item.asset.ownerDomain || "admin"}</span>
                            </div>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-amber-800">
                            <span>{item.composition.relationType}: {item.composition.mappingNotes || "-"}</span>
                            <span className="font-mono">{item.asset.operatorOwner || item.asset.serviceOwner || "-"}</span>
                          </div>
                        </div>
                      ))}
                      {impactData.upstream.length === 0 && <div className="py-4 text-center text-sm text-slate-400">{en ? "No upstream impact detected." : "상위 영향이 감지되지 않았습니다."}</div>}
                    </div>
                  </CollectionResultPanel>

                  <CollectionResultPanel
                    title={en ? "Downstream Dependencies (Children)" : "의존하는 하위 자산 (자식)"}
                    description={en ? "The selected asset depends on these items." : "선택된 자산이 의존하고 있는 항목들입니다."}
                  >
                    <div className="space-y-2">
                      {impactData.downstream.map((item) => (
                        <div key={item.composition.compositionId} className="rounded border border-blue-100 bg-blue-50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-blue-900">{item.asset.assetName}</span>
                            <div className="flex gap-1">
                              <span className="inline-flex rounded-full bg-blue-200 px-2 py-0.5 text-[10px] font-black text-blue-800">{item.asset.assetFamily || "SERVICE"}</span>
                              <span className="inline-flex rounded-full bg-white border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">{item.asset.ownerDomain || "admin"}</span>
                            </div>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-blue-800">
                            <span>{item.composition.relationType}: {item.composition.mappingNotes || "-"}</span>
                            <span className="font-mono">{item.asset.operatorOwner || item.asset.serviceOwner || "-"}</span>
                          </div>
                        </div>
                      ))}
                      {impactData.downstream.length === 0 && <div className="py-4 text-center text-sm text-slate-400">{en ? "No downstream dependencies." : "하위 의존성이 없습니다."}</div>}
                    </div>
                  </CollectionResultPanel>
                </section>

                <section className="gov-card">
                  <GridToolbar title={en ? "Linked Action Consoles" : "연계 관리 콘솔"} />
                  <div className="flex flex-wrap gap-2 p-4">
                    {modeConfig.links.map((link) => (
                      <MemberLinkButton href={link.href} key={link.href} size="sm" variant="secondary">
                        {en ? link.labelEn : link.labelKo}
                      </MemberLinkButton>
                    ))}
                    <MemberLinkButton href={buildLocalizedPath(`/admin/system/asset-detail?id=${encodeURIComponent(impactData.asset.assetId)}`, `/en/admin/system/asset-detail?id=${encodeURIComponent(impactData.asset.assetId)}`)} size="sm" variant="secondary">
                      {en ? "View Full Detail" : "전체 상세 보기"}
                    </MemberLinkButton>
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </div>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
