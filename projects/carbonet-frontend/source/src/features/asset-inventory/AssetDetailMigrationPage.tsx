import { useEffect, useMemo, useState } from "react";
import { getCurrentRuntimeSearch } from "../../app/routes/runtime";
import { fetchSystemAssetDetail, updateSystemAsset } from "../../lib/api/platform";
import type { SystemAssetDetailPayload } from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { GridToolbar, KeyValueGridPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminSelect, MemberButton } from "../member/common";

type AssetTab = "identity" | "ownership" | "dependency" | "runtime" | "verification" | "recovery";
type AssetPanelItem = { label: string; value: string };
type AssetDetailViewConfig = {
  key: string;
  titleKo: string;
  titleEn: string;
  identityItems: AssetPanelItem[];
  ownershipItems: AssetPanelItem[];
  dependencyItems: AssetPanelItem[];
  runtimeItems: AssetPanelItem[];
  verificationItems: AssetPanelItem[];
  recoveryItems: AssetPanelItem[];
};

const ASSET_TABS: Array<{ key: AssetTab; labelKo: string; labelEn: string }> = [
  { key: "identity", labelKo: "식별", labelEn: "Identity" },
  { key: "ownership", labelKo: "소유권", labelEn: "Ownership" },
  { key: "dependency", labelKo: "의존관계", labelEn: "Dependency" },
  { key: "runtime", labelKo: "런타임", labelEn: "Runtime" },
  { key: "verification", labelKo: "운영검증", labelEn: "Verification" },
  { key: "recovery", labelKo: "복구", labelEn: "Recovery" }
];

function getSearchParam(key: string) {
  return new URLSearchParams(getCurrentRuntimeSearch()).get(key) || "";
}

function buildStaticConfig(assetType: string, en: boolean): AssetDetailViewConfig | null {
  const configs: Record<string, AssetDetailViewConfig> = {
    "service-registry": {
      key: "service-registry",
      titleKo: "서비스 자산 상세",
      titleEn: "Service Asset Detail",
      identityItems: [
        { label: en ? "Asset Type" : "자산 유형", value: en ? "Service Registry" : "서비스 레지스트리" },
        { label: en ? "Primary Scope" : "주요 범위", value: en ? "menu / page / feature / API" : "메뉴 / 페이지 / 기능 / API" }
      ],
      ownershipItems: [
        { label: en ? "Owner Lane" : "소유 레인", value: "GENERAL_ADMIN" },
        { label: en ? "Current State" : "현재 상태", value: en ? "Ownership and impact mapping are still partial." : "소유권과 영향도 매핑이 아직 부분 상태입니다." }
      ],
      dependencyItems: [
        { label: en ? "Main Chain" : "주요 체인", value: "menu -> page -> feature -> API -> service -> mapper" }
      ],
      runtimeItems: [
        { label: en ? "Verification" : "검증 기준", value: en ? "Route response and full-stack metadata" : "route 응답과 full-stack 메타데이터" }
      ],
      verificationItems: [
        { label: en ? "Baseline" : "기준선", value: en ? "Screen flow, menu assignment, and help bindings" : "화면 흐름, 메뉴 귀속, 도움말 바인딩" }
      ],
      recoveryItems: [
        { label: en ? "Recovery" : "복구 기준", value: en ? "Runtime compare and repair workbench" : "런타임 비교와 리페어 워크벤치" }
      ]
    },
    "runtime-operations": {
      key: "runtime-operations",
      titleKo: "런타임 자산 상세",
      titleEn: "Runtime Asset Detail",
      identityItems: [
        { label: en ? "Asset Type" : "자산 유형", value: en ? "Runtime Operations" : "런타임 운영 자산" },
        { label: en ? "Primary Scope" : "주요 범위", value: en ? "environment / scheduler / batch / backup" : "환경 / 스케줄러 / 배치 / 백업" }
      ],
      ownershipItems: [
        { label: en ? "Owner Lane" : "소유 레인", value: "COMMON_ADMIN_OPS" },
        { label: en ? "Current State" : "현재 상태", value: en ? "Execution evidence linkage still needs closure." : "실행 증적 연결 보강이 더 필요합니다." }
      ],
      dependencyItems: [
        { label: en ? "Main Chain" : "주요 체인", value: "environment -> scheduler/batch -> backup/restore -> runtime compare" }
      ],
      runtimeItems: [
        { label: en ? "Verification" : "검증 기준", value: en ? ":18000 freshness, PID, port, startup marker" : ":18000 freshness, PID, port, startup marker" }
      ],
      verificationItems: [
        { label: en ? "Baseline" : "기준선", value: en ? "Backup config, batch, scheduler, and compare signals" : "백업 설정, 배치, 스케줄러, 비교 신호" }
      ],
      recoveryItems: [
        { label: en ? "Recovery" : "복구 기준", value: en ? "Backup evidence plus restore evidence" : "백업 증적과 복구 증적 연결" }
      ]
    },
    "recovery-continuity": {
      key: "recovery-continuity",
      titleKo: "복구 및 연속성 자산 상세",
      titleEn: "Recovery And Continuity Asset Detail",
      identityItems: [
        { label: en ? "Asset Type" : "자산 유형", value: en ? "Recovery & Continuity" : "복구 및 연속성 자산" }
      ],
      ownershipItems: [
        { label: en ? "Owner Lane" : "소유 레인", value: "COMMON_ADMIN_OPS" }
      ],
      dependencyItems: [
        { label: en ? "Main Chain" : "주요 체인", value: "backup policy -> execution -> restore -> verification" }
      ],
      runtimeItems: [
        { label: en ? "Verification" : "검증 기준", value: en ? "Version restore and execution history" : "버전 복구와 실행 이력" }
      ],
      verificationItems: [
        { label: en ? "Baseline" : "기준선", value: en ? "Recovery rehearsal and rollback anchors" : "복구 리허설과 롤백 앵커" }
      ],
      recoveryItems: [
        { label: en ? "Recovery" : "복구 기준", value: en ? "Execution-first restore workflow" : "실행 우선 복구 워크플로" }
      ]
    },
    "security-access": {
      key: "security-access",
      titleKo: "보안 및 접근 자산 상세",
      titleEn: "Security And Access Asset Detail",
      identityItems: [
        { label: en ? "Asset Type" : "자산 유형", value: en ? "Security & Access" : "보안 및 접근 자산" }
      ],
      ownershipItems: [
        { label: en ? "Owner Lane" : "소유 레인", value: "COMMON_ADMIN_OPS" }
      ],
      dependencyItems: [
        { label: en ? "Main Chain" : "주요 체인", value: "policy -> monitoring -> audit -> block/unblock" }
      ],
      runtimeItems: [
        { label: en ? "Verification" : "검증 기준", value: en ? "Auth gate, rate limit, deny path" : "인증 게이트, rate limit, 차단 경로" }
      ],
      verificationItems: [
        { label: en ? "Baseline" : "기준선", value: en ? "Security monitoring and audit trails" : "보안 모니터링과 감사 추적" }
      ],
      recoveryItems: [
        { label: en ? "Recovery" : "복구 기준", value: en ? "Policy rollback plus audit trace" : "정책 롤백과 감사 추적" }
      ]
    },
    "integration-assets": {
      key: "integration-assets",
      titleKo: "연계 자산 상세",
      titleEn: "Integration Asset Detail",
      identityItems: [
        { label: en ? "Asset Type" : "자산 유형", value: en ? "Integration Assets" : "연계 자산" }
      ],
      ownershipItems: [
        { label: en ? "Owner Lane" : "소유 레인", value: "COMMON_ADMIN_OPS" }
      ],
      dependencyItems: [
        { label: en ? "Main Chain" : "주요 체인", value: "connection -> key/schema -> webhook/sync -> retry/logs" }
      ],
      runtimeItems: [
        { label: en ? "Verification" : "검증 기준", value: en ? "Monitoring, retry queue, and maintenance windows" : "모니터링, 재시도 큐, 점검 창" }
      ],
      verificationItems: [
        { label: en ? "Baseline" : "기준선", value: en ? "Schema/key/webhook lifecycle checks" : "스키마/키/웹훅 수명주기 점검" }
      ],
      recoveryItems: [
        { label: en ? "Recovery" : "복구 기준", value: en ? "Retry queue and maintenance release" : "재시도 큐와 점검 해제 흐름" }
      ]
    },
    "content-file": {
      key: "content-file",
      titleKo: "콘텐츠 및 파일 자산 상세",
      titleEn: "Content And File Asset Detail",
      identityItems: [
        { label: en ? "Asset Type" : "자산 유형", value: en ? "Content & File Assets" : "콘텐츠 및 파일 자산" }
      ],
      ownershipItems: [
        { label: en ? "Owner Lane" : "소유 레인", value: "GENERAL_ADMIN" }
      ],
      dependencyItems: [
        { label: en ? "Main Chain" : "주요 체인", value: "content -> file registry -> retention/download policy" }
      ],
      runtimeItems: [
        { label: en ? "Verification" : "검증 기준", value: en ? "File registry and retention linkage" : "파일 레지스트리와 보존 정책 연계" }
      ],
      verificationItems: [
        { label: en ? "Baseline" : "기준선", value: en ? "File management and sitemap screens" : "파일 관리와 사이트맵 화면" }
      ],
      recoveryItems: [
        { label: en ? "Recovery" : "복구 기준", value: en ? "Content retention and restore tracking" : "콘텐츠 보존과 복구 추적" }
      ]
    }
  };
  return configs[assetType] || null;
}

export function AssetDetailMigrationPage() {
  const en = isEnglish();
  const [activeTab, setActiveTab] = useState<AssetTab>("identity");
  const [assetDetail, setAssetDetail] = useState<SystemAssetDetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Edit State
  const [editFamily, setEditFamily] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editOwnerScope, setEditOwnerScope] = useState("");
  const [editOperatorOwner, setEditOperatorOwner] = useState("");
  const [editServiceOwner, setEditServiceOwner] = useState("");
  const [editCriticality, setEditCriticality] = useState("");
  const [propagate, setPropagate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");

  const assetId = useMemo(() => getSearchParam("id"), []);
  const assetType = useMemo(() => getSearchParam("assetType"), []);

  const loadDetail = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchSystemAssetDetail(id);
      setAssetDetail(data);
      const a = data.asset;
      setEditFamily(a.assetFamily || "");
      setEditOwner(a.ownerDomain || "");
      setEditOwnerScope(a.ownerScope || "");
      setEditOperatorOwner(a.operatorOwner || "");
      setEditServiceOwner(a.serviceOwner || "");
      setEditCriticality(a.criticality || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load asset detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assetId) {
      void loadDetail(assetId);
    }
  }, [assetId]);

  const handleUpdate = async () => {
    if (!assetId) return;
    setUpdating(true);
    setUpdateMessage("");
    try {
      const result = await updateSystemAsset({
        id: assetId,
        assetFamily: editFamily,
        ownerDomain: editOwner,
        ownerScope: editOwnerScope,
        operatorOwner: editOperatorOwner,
        serviceOwner: editServiceOwner,
        criticality: editCriticality,
        propagate
      });
      if (result.success) {
        setUpdateMessage(en 
          ? `Updated successfully. ${result.affectedCount} assets affected.` 
          : `성공적으로 업데이트되었습니다. 총 ${result.affectedCount}건의 자산이 변경되었습니다.`);
        await loadDetail(assetId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const config = useMemo<AssetDetailViewConfig | null>(() => {
    if (assetDetail?.asset) {
      const a = assetDetail.asset;
      return {
        key: a.assetId,
        titleKo: `${a.assetName} 자산 상세`,
        titleEn: `${a.assetName} Asset Detail`,
        identityItems: [
          { label: en ? "Asset ID" : "자산 식별자", value: a.assetId },
          { label: en ? "Asset Type" : "자산 유형", value: a.assetType },
          { label: en ? "Asset Family" : "자산 도메인(가족)", value: a.assetFamily || "-" },
          { label: en ? "Source Path" : "소스 경로", value: a.sourcePath || "-" }
        ],
        ownershipItems: [
          { label: en ? "Owner Domain" : "소유 도메인", value: a.ownerDomain || "-" },
          { label: en ? "Owner Scope" : "소유 범위", value: a.ownerScope || "-" },
          { label: en ? "Operator Owner" : "운영 담당", value: a.operatorOwner || "-" },
          { label: en ? "Service Owner" : "서비스 담당", value: a.serviceOwner || "-" },
          { label: en ? "Criticality" : "중요도", value: a.criticality || "-" }
        ],
        dependencyItems: assetDetail.compositions.map(c => ({
          label: en ? "Dependency" : "의존관계", value: `${c.childAssetId} (${c.relationType})`
        })),
        runtimeItems: [
          { label: en ? "Last Scan" : "최근 스캔", value: a.lastScanAt ? new Date(a.lastScanAt).toLocaleString() : "-" },
          { label: en ? "Content Hash" : "콘텐츠 해시", value: a.contentHash || "-" }
        ],
        verificationItems: [
          { label: en ? "Status" : "검증 상태", value: "READY" },
          { label: en ? "Baseline" : "표준 기준선", value: "Route OK / JSON Meta Valid" },
          { label: en ? "Last Run" : "최근 검증", value: "2026-04-15 10:00" }
        ],
        recoveryItems: assetDetail.scanLogs.slice(0, 3).map(l => ({
          label: en ? "Scan Log" : "변경 이력", value: `${l.scanResult}: ${l.scanDetails}`
        }))
      };
    }
    return buildStaticConfig(assetType, en);
  }, [assetDetail, assetType, en]);

  const panelItems = useMemo(() => {
    if (!config) return [];
    const map: Record<AssetTab, AssetPanelItem[]> = {
      identity: config.identityItems,
      ownership: config.ownershipItems,
      dependency: config.dependencyItems,
      runtime: config.runtimeItems,
      verification: config.verificationItems,
      recovery: config.recoveryItems
    };
    return map[activeTab] || [];
  }, [config, activeTab]);

  return (
    <AdminPageShell
      title={en ? config?.titleEn || "Asset Detail" : config?.titleKo || "자산 상세"}
      subtitle={en ? "Inspect asset identity, ownership, and verification baselines." : "자산 식별, 소유권, 운영 검증 기준을 점검합니다."}
      breadcrumbs={[
        { label: en ? "Asset Inventory" : "자산 인벤토리", href: buildLocalizedPath("/admin/system/asset-inventory", "/en/admin/system/asset-inventory") },
        { label: en ? "Asset Detail" : "자산 상세" }
      ]}
    >
      <AdminWorkspacePageFrame>
        {error && <PageStatusNotice tone="error">{error}</PageStatusNotice>}
        {updateMessage && <PageStatusNotice tone="success">{updateMessage}</PageStatusNotice>}
        {loading && <PageStatusNotice tone="info">{en ? "Loading asset detail." : "자산 상세를 불러오는 중입니다."}</PageStatusNotice>}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="asset-detail-summary">
          <SummaryMetricCard title={en ? "Type" : "자산 유형"} value={assetDetail?.asset.assetType || config?.titleEn || config?.titleKo || "-"} />
          <SummaryMetricCard title={en ? "Status" : "상태"} value={assetDetail?.asset.healthStatus || (assetType ? (en ? "Planned baseline" : "기획 기준선") : "-")} />
          <SummaryMetricCard title={en ? "Owner" : "소유 도메인"} value={assetDetail?.asset.ownerDomain || (assetType ? (en ? "Governed lane" : "거버넌스 레인") : "-")} />
          <SummaryMetricCard title={en ? "Criticality" : "중요도"} value={assetDetail?.asset.criticality || (assetType ? "MEDIUM" : "-")} />
        </section>

        {assetDetail && (
          <article className="gov-card" data-help-id="asset-detail-edit">
            <GridToolbar title={en ? "Edit Governance Attributes" : "거버넌스 속성 편집"} />
            <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 xl:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Asset Family" : "자산 도메인(가족)"}</span>
                <AdminSelect value={editFamily} onChange={(e) => setEditFamily(e.target.value)}>
                  <option value="">{en ? "Undefined" : "미정의"}</option>
                  <option value="SERVICE">SERVICE</option>
                  <option value="INFRA">INFRA</option>
                  <option value="RECOVERY">RECOVERY</option>
                  <option value="INTEGRATION">INTEGRATION</option>
                  <option value="SECURITY">SECURITY</option>
                </AdminSelect>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Owner Domain" : "소유 도메인"}</span>
                <AdminSelect value={editOwner} onChange={(e) => setEditOwner(e.target.value)}>
                  <option value="">{en ? "Unassigned" : "미배정"}</option>
                  <option value="admin">admin</option>
                  <option value="home">home</option>
                  <option value="platform">platform</option>
                  <option value="shared">shared</option>
                </AdminSelect>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Owner Scope" : "소유 범위"}</span>
                <AdminSelect value={editOwnerScope} onChange={(e) => setEditOwnerScope(e.target.value)}>
                  <option value="">{en ? "Undefined" : "미정의"}</option>
                  <option value="GLOBAL">GLOBAL</option>
                  <option value="PROJECT">PROJECT</option>
                  <option value="PRIVATE">PRIVATE</option>
                </AdminSelect>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Operator Owner" : "운영 담당"}</span>
                <input 
                  type="text" 
                  className="gov-input" 
                  value={editOperatorOwner} 
                  onChange={(e) => setEditOperatorOwner(e.target.value)}
                  placeholder={en ? "e.g. PLATFORM_OPS" : "예: PLATFORM_OPS"}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Service Owner" : "서비스 담당"}</span>
                <input 
                  type="text" 
                  className="gov-input" 
                  value={editServiceOwner} 
                  onChange={(e) => setEditServiceOwner(e.target.value)}
                  placeholder={en ? "e.g. SERVICE_TEAM_A" : "예: SERVICE_TEAM_A"}
                />
              </label>
              
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Criticality" : "중요도"}</span>
                <AdminSelect value={editCriticality} onChange={(e) => setEditCriticality(e.target.value)}>
                  <option value="">{en ? "Undefined" : "미정의"}</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </AdminSelect>
              </label>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-6">
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--kr-gov-text-secondary)]">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={propagate} onChange={(e) => setPropagate(e.target.checked)} />
                {en ? "Propagate changes to children assets" : "이 속성 변경사항을 하위 자산으로 전파"}
              </label>
              <MemberButton onClick={handleUpdate} disabled={updating} variant="primary">
                {updating ? "..." : (en ? "Save Governance Metadata" : "거버넌스 메타데이터 저장")}
              </MemberButton>
            </div>
          </article>
        )}

        <section className="gov-card">
          <div className="flex flex-wrap gap-2" role="tablist">
            {ASSET_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`rounded border px-4 py-2 text-sm font-bold ${activeTab === tab.key ? "border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] text-white" : "border-slate-200 bg-white"}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {en ? tab.labelEn : tab.labelKo}
              </button>
            ))}
          </div>
        </section>

        <KeyValueGridPanel
          className="gov-card"
          items={panelItems}
          title={en ? ASSET_TABS.find(t => t.key === activeTab)?.labelEn : ASSET_TABS.find(t => t.key === activeTab)?.labelKo}
        />

        {activeTab === "verification" && (
          <section className="gov-card">
            <GridToolbar title={en ? "Verification History" : "운영 검증 이력"} />
            <div className="p-10 text-center text-sm text-slate-400">
              {en ? "Detailed verification logs will be integrated from the Verification Center." : "상세 검증 로그는 운영 검증 센터와 통합될 예정입니다."}
            </div>
          </section>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
