import { useEffect, useMemo, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchSystemAssetList, triggerSystemAssetScan } from "../../lib/api/platform";
import type { AssetScanSummary, SystemAssetInventoryVO } from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { buildAssetDetailPath, buildVerificationCenterPath } from "../../platform/routes/platformPaths";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, DiagnosticCard, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type AssetLane = {
  key: string;
  titleKo: string;
  titleEn: string;
  status: "READY" | "PARTIAL" | "PLANNED";
  currentCount: number;
  targetCount: number;
  summaryKo: string;
  summaryEn: string;
  links: Array<{ labelKo: string; labelEn: string; href: string }>;
};

function laneTone(status: AssetLane["status"]) {
  if (status === "READY") return "healthy" as const;
  if (status === "PARTIAL") return "warning" as const;
  return "neutral" as const;
}

function laneStatusLabel(status: AssetLane["status"], en: boolean) {
  if (status === "READY") return en ? "Ready" : "준비";
  if (status === "PARTIAL") return en ? "Partial" : "부분";
  return en ? "Planned" : "계획";
}

export function AssetInventoryMigrationPage() {
  const en = isEnglish();
  const [assets, setAssets] = useState<SystemAssetInventoryVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<AssetScanSummary | null>(null);
  const [error, setError] = useState("");

  const loadAssets = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchSystemAssetList();
      setAssets(Array.isArray(data) ? data : []);
    } catch (err) {
      setAssets([]);
      setError(err instanceof Error ? err.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setError("");
    setScanResult(null);
    try {
      const result = await triggerSystemAssetScan();
      setScanResult(result);
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    void loadAssets();
  }, []);

  const lanes = useMemo<AssetLane[]>(() => [
    {
      key: "service-registry",
      titleKo: "서비스 자산 레지스트리",
      titleEn: "Service Asset Registry",
      status: "PARTIAL",
      currentCount: assets.filter(a => ["API", "FUNCTION"].includes(a.assetType)).length || 6,
      targetCount: 8,
      summaryKo: "메뉴, 페이지, 기능, 화면 흐름, 메뉴 귀속, 풀스택 메타데이터는 이미 있으나 자산 영향도와 소유권 표현이 아직 약합니다.",
      summaryEn: "Menu, page, feature, flow, assignment, and full-stack metadata already exist, but ownership and impact visibility are still weak.",
      links: [
        { labelKo: "상세 열기", labelEn: "Open Detail", href: buildAssetDetailPath("service-registry") },
        { labelKo: "메뉴 관리", labelEn: "Menu Management", href: buildLocalizedPath("/admin/system/menu", "/en/admin/system/menu") },
        { labelKo: "화면 관리", labelEn: "Page Management", href: buildLocalizedPath("/admin/system/page-management", "/en/admin/system/page-management") },
        { labelKo: "화면 흐름 관리", labelEn: "Screen Flow", href: buildLocalizedPath("/admin/system/screen-flow-management", "/en/admin/system/screen-flow-management") }
      ]
    },
    {
      key: "runtime-operations",
      titleKo: "런타임 운영 자산",
      titleEn: "Runtime Operations Assets",
      status: "PARTIAL",
      currentCount: assets.filter(a => ["NODE", "SCHEDULER", "ENVIRONMENT", "BATCH"].includes(a.assetType)).length || 5,
      targetCount: 8,
      summaryKo: "환경, 스케줄러, 배치 화면이 있으나 실행 이력과 자산 단위 운영 증적 연결이 더 필요합니다.",
      summaryEn: "Environment, scheduler, and batch screens exist, but they still need asset-level operational evidence and execution closure.",
      links: [
        { labelKo: "상세 열기", labelEn: "Open Detail", href: buildAssetDetailPath("runtime-operations") },
        { labelKo: "환경 관리", labelEn: "Environment", href: buildLocalizedPath("/admin/system/environment-management", "/en/admin/system/environment-management") },
        { labelKo: "스케줄러 관리", labelEn: "Scheduler", href: buildLocalizedPath("/admin/system/scheduler", "/en/admin/system/scheduler") },
        { labelKo: "배치 관리", labelEn: "Batch", href: buildLocalizedPath("/admin/system/batch", "/en/admin/system/batch") }
      ]
    },
    {
      key: "recovery-continuity",
      titleKo: "복구 및 연속성 자산",
      titleEn: "Recovery & Continuity Assets",
      status: "PARTIAL",
      currentCount: assets.filter(a => ["BACKUP", "RESTORE", "MAINTENANCE"].includes(a.assetType)).length || 3,
      targetCount: 6,
      summaryKo: "백업, 복구, 점검 모드 화면은 있으나 실행 중심 워크플로와 복구 리허설 증적 관리가 더 필요합니다.",
      summaryEn: "Backup, restore, and maintenance screens exist, but execution-first workflows and recovery drill evidence need stronger closure.",
      links: [
        { labelKo: "상세 열기", labelEn: "Open Detail", href: buildAssetDetailPath("recovery-continuity") },
        { labelKo: "백업 설정", labelEn: "Backup Settings", href: buildLocalizedPath("/admin/system/backup", "/en/admin/system/backup") },
        { labelKo: "복구 콘솔", labelEn: "Restore Console", href: buildLocalizedPath("/admin/system/restore", "/en/admin/system/restore") },
        { labelKo: "점검 모드", labelEn: "Maintenance Mode", href: buildLocalizedPath("/admin/system/maintenance", "/en/admin/system/maintenance") }
      ]
    },
    {
      key: "security-access",
      titleKo: "보안 및 접근 자산",
      titleEn: "Security And Access Assets",
      status: "READY",
      currentCount: 7,
      targetCount: 7,
      summaryKo: "보안 정책, 모니터링, 감사, 접속/에러 이력, 화이트리스트, 차단 목록은 자산관리 시야로 바로 재사용 가능합니다.",
      summaryEn: "Security policy, monitoring, audit, access/error history, whitelist, and blocklist can already be reused directly in the asset-management view.",
      links: [
        { labelKo: "상세 열기", labelEn: "Open Detail", href: buildAssetDetailPath("security-access") },
        { labelKo: "보안 정책", labelEn: "Security Policy", href: buildLocalizedPath("/admin/system/security-policy", "/en/admin/system/security-policy") },
        { labelKo: "보안 감사", labelEn: "Security Audit", href: buildLocalizedPath("/admin/system/security-audit", "/en/admin/system/security-audit") },
        { labelKo: "접속 로그", labelEn: "Access History", href: buildLocalizedPath("/admin/system/access_history", "/en/admin/system/access_history") }
      ]
    },
    {
      key: "integration-assets",
      titleKo: "연계 자산",
      titleEn: "Integration Assets",
      status: "PARTIAL",
      currentCount: assets.filter(a => a.assetType === "TABLE").length || 6,
      targetCount: 10,
      summaryKo: "외부연계 목록, 로그, 동기화, 재시도, 모니터링은 유효하지만 키, 스키마, 웹훅, 점검은 수명주기 관점 보강이 필요합니다.",
      summaryEn: "Connection list, logs, sync, retry, and monitoring are useful, but keys, schema, webhooks, and maintenance still need lifecycle closure.",
      links: [
        { labelKo: "상세 열기", labelEn: "Open Detail", href: buildAssetDetailPath("integration-assets") },
        { labelKo: "외부연계 목록", labelEn: "Connection List", href: buildLocalizedPath("/admin/external/connection_list", "/en/admin/external/connection_list") },
        { labelKo: "연계 모니터링", labelEn: "External Monitoring", href: buildLocalizedPath("/admin/external/monitoring", "/en/admin/external/monitoring") },
        { labelKo: "외부 인증키", labelEn: "External Keys", href: buildLocalizedPath("/admin/external/keys", "/en/admin/external/keys") }
      ]
    },
    {
      key: "content-file",
      titleKo: "콘텐츠 및 파일 자산",
      titleEn: "Content And File Assets",
      status: "PARTIAL",
      currentCount: 2,
      targetCount: 4,
      summaryKo: "파일 관리와 콘텐츠 화면은 있으나 자산 인벤토리 시각에서 소유권과 보존정책 연결이 더 필요합니다.",
      summaryEn: "File management and content screens exist, but ownership and retention links still need a stronger asset-inventory view.",
      links: [
        { labelKo: "상세 열기", labelEn: "Open Detail", href: buildAssetDetailPath("content-file") },
        { labelKo: "파일 관리", labelEn: "File Management", href: buildLocalizedPath("/admin/content/file", "/en/admin/content/file") },
        { labelKo: "사이트맵", labelEn: "Sitemap", href: buildLocalizedPath("/admin/content/sitemap", "/en/admin/content/sitemap") }
      ]
    },
    {
      key: "planned-consoles",
      titleKo: "추가 구축 대상",
      titleEn: "Planned Consoles",
      status: "PLANNED",
      currentCount: 1,
      targetCount: 4,
      summaryKo: "자산 상세, 영향도, 수명주기, 갭 큐 화면은 아직 계획 단계입니다. 이번 화면은 그 출발점입니다.",
      summaryEn: "Asset detail, impact, lifecycle, and gap consoles are still planned. This page is the first entry point for that suite.",
      links: [
        { labelKo: "서비스 상세", labelEn: "Service Detail", href: buildAssetDetailPath("service-registry") },
        { labelKo: "환경 관리로 돌아가기", labelEn: "Back To Environment", href: buildLocalizedPath("/admin/system/environment-management", "/en/admin/system/environment-management") },
        { labelKo: "런타임 비교", labelEn: "Runtime Compare", href: buildLocalizedPath("/admin/system/current-runtime-compare", "/en/admin/system/current-runtime-compare") }
      ]
    }
  ], [assets]);

  const totalCurrent = assets.length || lanes.reduce((sum, lane) => sum + lane.currentCount, 0);
  const totalTarget = lanes.reduce((sum, lane) => sum + lane.targetCount, 0);
  const readyCount = lanes.filter((lane) => lane.status === "READY").length;
  const partialCount = lanes.filter((lane) => lane.status === "PARTIAL").length;
  const plannedCount = lanes.filter((lane) => lane.status === "PLANNED").length;

  const priorities = useMemo(() => [
    {
      title: en ? "Expand environment inventory" : "환경 인벤토리 확장",
      description: en
        ? "Promote `/admin/system/environment-management` from builder bind console into the root asset registry."
        : "`/admin/system/environment-management`를 빌더 바인딩 콘솔에서 자산 레지스트리 루트로 확장합니다."
    },
    {
      title: en ? "Standardize page baselines" : "페이지 baseline 표준화",
      description: en
        ? "Keep route, metadata, smoke scenario, and test-account baselines together so AI and operators verify the same preserved behavior."
        : "route, 메타데이터, smoke 시나리오, 테스트 계정 baseline을 함께 묶어 AI와 운영자가 같은 보존 동작을 검증하게 만듭니다."
    },
    {
      title: en ? "Close ownership links" : "소유권 연결 보강",
      description: en
        ? "Upgrade screen-flow and screen-menu assignment so one page shows menu, page, feature, API, and DB impact together."
        : "화면 흐름과 화면-메뉴 귀속을 보강해 메뉴, 페이지, 기능, API, DB 영향을 한 번에 보이게 합니다."
    },
    {
      title: en ? "Split recovery workflows" : "복구 워크플로 분리",
      description: en
        ? "Separate backup and restore execution-first workflows from simple settings pages."
        : "백업/복구를 단순 설정 페이지가 아니라 실행 중심 워크플로로 분리합니다."
    },
    {
      title: en ? "Finish integration lifecycle" : "연계 수명주기 마무리",
      description: en
        ? "Complete key rotation, schema publish, webhook replay, and maintenance approval flows."
        : "키 회전, 스키마 배포, 웹훅 재전송, 점검 승인 흐름을 마무리합니다."
    }
  ], [en]);

  useEffect(() => {
    logGovernanceScope("PAGE", "asset-inventory", {
      language: en ? "en" : "ko",
      laneCount: lanes.length,
      totalCurrent,
      totalTarget,
      readyCount,
      partialCount,
      plannedCount,
      assetCount: assets.length
    });
  }, [en, lanes.length, partialCount, plannedCount, readyCount, totalCurrent, totalTarget, assets.length]);

  return (
    <AdminPageShell
      title={en ? "System Asset Inventory" : "시스템 자산 인벤토리"}
      subtitle={en
        ? "Reclassify current admin surfaces as governed assets and open the next implementation lanes."
        : "현재 관리자 화면을 운영 자산 기준으로 재분류하고 다음 구현 대상을 여는 화면입니다."}
      breadcrumbs={[
        { label: en ? "System" : "시스템", href: buildLocalizedPath("/admin/system/environment-management", "/en/admin/system/environment-management") },
        { label: en ? "Asset Inventory" : "자산 인벤토리" }
      ]}
    >
      <AdminWorkspacePageFrame>
        {error ? (
          <PageStatusNotice tone="error">{error}</PageStatusNotice>
        ) : null}
        {scanResult ? (
          <PageStatusNotice tone="success">
            {en 
              ? `Scan completed: ${scanResult.total} processed, ${scanResult.newCount} new, ${scanResult.driftedCount} drifted assets found in ${scanResult.durationMs}ms.`
              : `스캔 완료: 총 ${scanResult.total}건 처리, 신규 ${scanResult.newCount}건, 변동 ${scanResult.driftedCount}건 발견 (${scanResult.durationMs}ms)`}
          </PageStatusNotice>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="asset-inventory-summary">
          <SummaryMetricCard title={en ? "Covered Assets" : "현재 커버 자산"} value={`${assets.length || totalCurrent}`} />
          <SummaryMetricCard title={en ? "Target Assets" : "목표 자산"} value={`${totalTarget}`} />
          <SummaryMetricCard title={en ? "Partial Lanes" : "부분 완료 레인"} value={`${partialCount}`} />
          <SummaryMetricCard title={en ? "Planned Consoles" : "예정 콘솔"} value={`${plannedCount}`} />
        </section>

        <DiagnosticCard
          data-help-id="asset-inventory-overview"
          title={en ? "Current asset-management baseline" : "현재 자산관리 기준선"}
          status={en ? `${readyCount} ready / ${partialCount} partial` : `준비 ${readyCount} / 부분 ${partialCount}`}
          statusTone="warning"
          description={en
            ? "Carbonet already has many asset-management ingredients. The missing part is one operating model that exposes ownership, lifecycle, impact, and evidence together."
            : "Carbonet에는 자산관리 재료가 이미 많습니다. 부족한 것은 소유권, 수명주기, 영향도, 증적을 함께 보여주는 하나의 운영 모델입니다."}
          actions={(
            <>
              <button 
                className={`gov-btn ${scanning ? "gov-btn-secondary" : "gov-btn-primary"}`} 
                disabled={scanning}
                onClick={handleScan}
              >
                {scanning ? (en ? "Scanning..." : "스캔 중...") : (en ? "Trigger Full Scan" : "전체 스캔 시작")}
              </button>
              <a className="gov-btn gov-btn-outline-blue" href={buildLocalizedPath("/admin/system/environment-management", "/en/admin/system/environment-management")}>
                {en ? "Open Environment Root" : "환경 관리 열기"}
              </a>
              <a className="gov-btn gov-btn-outline-blue" href={buildVerificationCenterPath()}>
                {en ? "Open Verification Center" : "검증 센터 열기"}
              </a>
            </>
          )}
        />

        <section className="gov-card" data-help-id="asset-inventory-list">
          <GridToolbar title={en ? "Discovered Assets" : "발견된 시스템 자산"} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3">{en ? "Asset ID" : "자산 식별자"}</th>
                  <th className="px-4 py-3">{en ? "Type/Family" : "유형/도메인"}</th>
                  <th className="px-4 py-3">{en ? "Name" : "이름"}</th>
                  <th className="px-4 py-3">{en ? "Ownership" : "소유권/담당"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                  <th className="px-4 py-3">{en ? "Last Scan" : "최근 스캔"}</th>
                  <th className="px-4 py-3">{en ? "Detail" : "상세"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-gray-500" colSpan={7}>
                      {en ? "Loading assets..." : "자산 목록을 불러오는 중..."}
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-gray-500" colSpan={7}>
                      {en ? "No assets found. Try triggering a scan." : "발견된 자산이 없습니다. 스캔을 시작해 보세요."}
                    </td>
                  </tr>
                ) : assets.map((asset) => (
                  <tr className="hover:bg-slate-50" key={asset.assetId}>
                    <td className="px-4 py-3 font-mono text-xs">{asset.assetId}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {asset.assetType}
                        </span>
                        <span className="inline-flex w-fit rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">
                          {asset.assetFamily || "SERVICE"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold">{asset.assetName}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{asset.ownerDomain || "-"}</span>
                        <span className="text-[10px] text-slate-500">{asset.operatorOwner || asset.serviceOwner || "-"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${
                        asset.healthStatus === "OK" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {asset.healthStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{asset.lastScanAt ? new Date(asset.lastScanAt).toLocaleString() : "-"}</td>
                    <td className="px-4 py-3">
                      <a 
                        className="text-blue-600 hover:underline" 
                        href={buildLocalizedPath(`/admin/system/asset-detail?id=${encodeURIComponent(asset.assetId)}`, `/en/admin/system/asset-detail?id=${encodeURIComponent(asset.assetId)}`)}
                      >
                        {en ? "View" : "보기"}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2" data-help-id="asset-inventory-lanes">
          {lanes.map((lane) => (
            <DiagnosticCard
              key={lane.key}
              title={en ? lane.titleEn : lane.titleKo}
              status={laneStatusLabel(lane.status, en)}
              statusTone={laneTone(lane.status)}
              description={en ? lane.summaryEn : lane.summaryKo}
              summary={(
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Current" : "현재"}</div>
                    <div className="mt-2 text-2xl font-black text-[var(--kr-gov-text-primary)]">{lane.currentCount}</div>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target" : "목표"}</div>
                    <div className="mt-2 text-2xl font-black text-[var(--kr-gov-text-primary)]">{lane.targetCount}</div>
                  </div>
                </div>
              )}
            >
              <div className="flex flex-wrap gap-2">
                {lane.links.map((link) => (
                  <a className="gov-btn gov-btn-outline-blue" href={link.href} key={link.href}>
                    {en ? link.labelEn : link.labelKo}
                  </a>
                ))}
              </div>
            </DiagnosticCard>
          ))}
        </section>

        <section className="gov-card" data-help-id="asset-inventory-priority">
          <GridToolbar title={en ? "Next implementation priorities" : "다음 구현 우선순위"} />
          <CollectionResultPanel
            title={en ? "Implementation queue" : "구현 큐"}
            description={en
              ? "Use this queue to move from grouped inventory into concrete screen and structure changes."
              : "이 큐를 기준으로 묶인 인벤토리를 실제 화면과 구조 변경으로 옮깁니다."}
          >
            <div className="space-y-3">
            {priorities.map((item) => (
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-4" key={item.title}>
                <h3 className="text-base font-bold text-[var(--kr-gov-text-primary)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{item.description}</p>
              </div>
            ))}
            </div>
          </CollectionResultPanel>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
