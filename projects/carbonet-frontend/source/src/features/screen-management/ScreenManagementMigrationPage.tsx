/**
 * Screen Management Migration Page
 * 화면 관리 - 시스템 내 모든 화면을 통합 관리 (1000+ 화면 지원)
 * - 모든 화면 조회/검색/필터링
 * - Screen Builder를 통한 화면 생성/수정
 * - 메뉴 귀속 관리
 */
import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  listRouteOwnershipTraces,
  type RouteOwnershipTrace
} from "../../app/routes/routeCatalog";
import {
  fetchScreenCommandPage
} from "../../lib/api/platform";
import type {
  ScreenCommandPagePayload
} from "../../lib/api/platformTypes";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { GovernanceCompressionNav } from "../admin-system/GovernanceCompressionNav";
import {
  KeyValueGridPanel,
  PageStatusNotice,
  SummaryMetricCard
} from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import {
  AdminInput,
  AdminSelect,
  MemberButton
} from "../member/common";

type ScreenRow = {
  routeId: string;
  pageId: string;
  menuCode: string;
  routePath: string;
  menuUrl: string;
  label: string;
  familyId: string;
  ownershipLane: string;
  pageFamily: string;
  status: "registered" | "unregistered" | "has-screen" | "no-screen";
  hasBuilder: boolean;
  runtimeStatus: RuntimeStatus;
  runtimePriority: string;
  runtimeErrors: string[];
  runtimeDurationMs?: number;
  runtimeScore?: number;
  verifiedAt?: string;
};

type RuntimeStatus = "pass" | "error" | "warning" | "not-tested";

type RuntimeQualityRoute = {
  routePath: string;
  priority?: string;
  gaps?: string[];
  durationMs?: number;
  runtimeScore?: number;
};

type RuntimeQualityReport = {
  completedAt?: string;
  summary?: { routeCount?: number };
  routes?: RuntimeQualityRoute[];
};

function routeKey(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    const query = [...url.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${key.toLowerCase()}=${val.toLowerCase()}`)
      .join("&");
    return `${url.pathname.replace(/\/$/, "") || "/"}${query ? `?${query}` : ""}`.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

function runtimeStatusOf(route?: RuntimeQualityRoute): RuntimeStatus {
  if (!route) return "not-tested";
  const gaps = route.gaps || [];
  if (route.priority === "NOT_TESTED" || gaps.includes("TEST_NOT_EXECUTED")) return "not-tested";
  if (route.priority === "P0" || route.priority === "P1" || gaps.some((gap) => /HTTP_|BLANK_SCREEN|BOOTSTRAP|API_FAILURE|CONSOLE_ERROR|PAGE_ERROR/.test(gap))) return "error";
  if (route.priority === "P2" || route.priority === "P3") return "warning";
  return "pass";
}

async function fetchRuntimeQualityReport(): Promise<RuntimeQualityReport> {
  const candidates = ["/full-screen-quality-report.json", "/assets/react/full-screen-quality-report.json"];
  let lastError: unknown;
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("json")) throw new Error(`INVALID_CONTENT_TYPE ${contentType}`);
      return await response.json() as RuntimeQualityReport;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("실제 화면 검사 결과를 불러오지 못했습니다.");
}

function buildScreenRows(
  routeTraces: RouteOwnershipTrace[],
  screenPages?: ScreenCommandPagePayload["pages"],
  qualityReport?: RuntimeQualityReport
): ScreenRow[] {
  const pageMap = new Map<string, ScreenCommandPagePayload["pages"][number]>();

  (screenPages || []).forEach((page) => {
    if (page.menuCode) {
      pageMap.set(page.menuCode.toUpperCase(), page);
    }
    if (page.pageId) {
      pageMap.set(page.pageId, page);
    }
  });

  const runtimeMap = new Map((qualityReport?.routes || []).map((route) => [routeKey(route.routePath), route]));
  return routeTraces.map((trace): ScreenRow => {
    const menuCode = trace.menuCode || "";
    const pageId = trace.pageId || "";
    const matched = pageMap.get(menuCode.toUpperCase()) || pageMap.get(pageId);
    const runtime = runtimeMap.get(routeKey(trace.canonicalRoute));

    let status: ScreenRow["status"] = "unregistered";
    if (matched) {
      status = "has-screen";
    } else if (menuCode) {
      status = "registered";
    }

    return {
      routeId: trace.routeId,
      pageId: pageId,
      menuCode: menuCode,
      routePath: trace.canonicalRoute,
      menuUrl: matched?.routePath || trace.canonicalRoute,
      label: trace.routeLabel || trace.routeId,
      familyId: trace.familyId,
      ownershipLane: trace.ownershipLane,
      pageFamily: trace.pageFamily,
      status,
      hasBuilder: false,
      runtimeStatus: runtimeStatusOf(runtime),
      runtimePriority: runtime?.priority || "NOT_TESTED",
      runtimeErrors: runtime?.gaps || [],
      runtimeDurationMs: runtime?.durationMs,
      runtimeScore: runtime?.runtimeScore,
      verifiedAt: runtime ? qualityReport?.completedAt : undefined
    };
  });
}

function ScreenManagementCatalogPanel({
  title,
  count,
  filterValue,
  onFilterChange,
  filterPlaceholder,
  items,
  emptyLabel,
  onSelect
}: {
  title: string;
  count: number;
  filterValue: string;
  onFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  filterPlaceholder: string;
  items: ScreenRow[];
  emptyLabel: string;
  onSelect: (screen: ScreenRow) => void;
}) {
  const en = isEnglish();
  const filteredItems = useMemo(() => {
    if (!filterValue.trim()) return items;
    const term = filterValue.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(term) ||
        item.routeId.toLowerCase().includes(term) ||
        item.menuCode.toLowerCase().includes(term) ||
        item.routePath.toLowerCase().includes(term)
    );
  }, [items, filterValue]);

  return (
    <section className="gov-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">
          {count}
        </span>
      </div>
      <AdminInput
        className="mb-4"
        onChange={onFilterChange}
        placeholder={filterPlaceholder}
        value={filterValue}
      />
      <div className="max-h-[70vh] space-y-2 overflow-y-auto">
        {filteredItems.slice(0, 200).map((item) => (
          <button
            key={item.routeId}
            className={`w-full rounded-[var(--kr-gov-radius)] border px-3 py-3 text-left transition-colors hover:border-[var(--kr-gov-blue)] hover:bg-slate-50`}
            type="button"
            onClick={() => onSelect(item)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">
                  {item.label}
                </p>
                <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                  {item.routePath}
                </p>
                {item.menuCode && (
                  <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                    <span className="font-mono">{item.menuCode}</span>
                    {item.pageId && ` | ${item.pageId}`}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.runtimeStatus === "pass" ? "bg-emerald-100 text-emerald-800"
                      : item.runtimeStatus === "error" ? "bg-red-100 text-red-800"
                      : item.runtimeStatus === "warning" ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {item.runtimeStatus === "pass" ? (en ? "Pass" : "정상")
                    : item.runtimeStatus === "error" ? (en ? "Error" : "오류")
                    : item.runtimeStatus === "warning" ? (en ? "Warning" : "주의")
                    : (en ? "Not tested" : "미검사")}
                </span>
              </div>
            </div>
          </button>
        ))}
        {filteredItems.length > 200 && (
          <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-3 text-center text-sm text-[var(--kr-gov-text-secondary)]">
            {en ? `Showing 200 of ${filteredItems.length} screens` : `200개 표시 (총 ${filteredItems.length}개)`}
          </div>
        )}
        {filteredItems.length === 0 && (
          <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-5 text-center text-sm text-[var(--kr-gov-text-secondary)]">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  );
}

function ScreenDetailPanel({
  screen,
  onOpenBuilder,
  onAssignMenu,
  en
}: {
  screen: ScreenRow | null;
  onOpenBuilder: (screen: ScreenRow) => void;
  onAssignMenu: (screen: ScreenRow) => void;
  en: boolean;
}) {
  if (!screen) {
    return (
      <section className="gov-card">
        <div className="text-sm text-[var(--kr-gov-text-secondary)]">
          {en ? "Select a screen to view details" : "화면을 선택하여 상세 정보를 확인하세요"}
        </div>
      </section>
    );
  }

  const metaItems = [
    { label: en ? "Route ID" : "라우트 ID", value: screen.routeId },
    { label: en ? "Page ID" : "페이지 ID", value: screen.pageId || "-" },
    { label: en ? "Menu Code" : "메뉴코드", value: screen.menuCode || "-" },
    { label: en ? "Route Path" : "라우트 경로", value: screen.routePath },
    { label: en ? "Family ID" : "패밀리 ID", value: screen.familyId },
    { label: en ? "Ownership" : "소유권", value: screen.ownershipLane },
    { label: en ? "Page Family" : "페이지 계열", value: screen.pageFamily }
    ,{ label: en ? "Runtime Status" : "실제 검사 상태", value: screen.runtimePriority }
    ,{ label: en ? "Runtime Score" : "실행 점수", value: screen.runtimeScore == null ? "-" : `${screen.runtimeScore}점` }
    ,{ label: en ? "Response Time" : "응답 시간", value: screen.runtimeDurationMs == null ? "-" : `${screen.runtimeDurationMs}ms` }
    ,{ label: en ? "Last Verified" : "최근 검사", value: screen.verifiedAt || "미검사" }
  ];

  return (
    <section className="gov-card">
      <div className="mb-4">
        <h3 className="text-lg font-bold">{screen.label}</h3>
        <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
          {screen.menuUrl}
        </p>
      </div>

      <KeyValueGridPanel
        items={metaItems}
        description=""
        title={en ? "Screen Information" : "화면 정보"}
      />
      {screen.runtimeErrors.length > 0 && (
        <PageStatusNotice tone={screen.runtimeStatus === "error" ? "error" : "warning"}>
          <p className="font-bold">{en ? "Detected issues" : "실제 검사 오류"}</p>
          <p className="mt-1 break-words text-xs">{screen.runtimeErrors.join(", ")}</p>
        </PageStatusNotice>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <MemberButton
          onClick={() => window.open(screen.routePath, "_blank", "noopener,noreferrer")}
          size="sm"
          type="button"
          variant="secondary"
        >
          {en ? "Open actual screen" : "실제 화면 열기"}
        </MemberButton>
        <MemberButton
          onClick={() => onOpenBuilder(screen)}
          size="sm"
          type="button"
          variant="primary"
        >
          {screen.hasBuilder ? (en ? "Open Builder" : "빌더 열기") : (en ? "Create with Builder" : "빌더로 생성")}
        </MemberButton>
        {!screen.menuCode && (
          <MemberButton
            onClick={() => onAssignMenu(screen)}
            size="sm"
            type="button"
            variant="secondary"
          >
            {en ? "Assign Menu" : "메뉴 귀속"}
          </MemberButton>
        )}
      </div>
    </section>
  );
}

const SCREEN_MANAGEMENT_CLOSE_OUT_ROWS = [
  {
    labelKo: "화면 카탈로그",
    labelEn: "Screen Catalog",
    status: "available" as const,
    descriptionKo: "시스템 내 모든 화면을 route/catalog 기반으로 조회합니다.",
    descriptionEn: "Query all screens in the system based on route/catalog."
  },
  {
    labelKo: "Screen Builder 연동",
    labelEn: "Screen Builder Integration",
    status: "available" as const,
    descriptionKo: "Screen Builder를 통해 화면을 생성/수정할 수 있습니다.",
    descriptionEn: "Create and modify screens through Screen Builder."
  },
  {
    labelKo: "메뉴 귀속 관리",
    labelEn: "Menu Assignment",
    status: "available" as const,
    descriptionKo: "화면을 메뉴에 귀속시킬 수 있습니다.",
    descriptionEn: "Assign screens to menus."
  },
  {
    labelKo: "화면 흐름 관리",
    labelEn: "Screen Flow Management",
    status: "blocked" as const,
    descriptionKo: "화면 간 전환 흐름을 정의하고 관리합니다.",
    descriptionEn: "Define and manage transition flows between screens."
  },
  {
    labelKo: "버전 관리 / 롤백",
    labelEn: "Version Management / Rollback",
    status: "blocked" as const,
    descriptionKo: "화면 버전 히스토리 및 롤백 기능을 제공합니다.",
    descriptionEn: "Provide screen version history and rollback."
  }
];

export function ScreenManagementMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const [routeFilter, setRouteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RuntimeStatus>("all");
  const [selectedScreen, setSelectedScreen] = useState<ScreenRow | null>(null);

  const routeTraces = useMemo(() => listRouteOwnershipTraces(), []);

  const screenPayload = useAsyncValue<ScreenCommandPagePayload>(
    () => fetchScreenCommandPage(""),
    []
  );
  const qualityPayload = useAsyncValue<RuntimeQualityReport>(fetchRuntimeQualityReport, []);

  const screenRows = useMemo(() => {
    return buildScreenRows(routeTraces, screenPayload.value?.pages, qualityPayload.value);
  }, [routeTraces, screenPayload.value, qualityPayload.value]);

  const filteredScreenRows = useMemo(() => {
    let rows = screenRows;
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.runtimeStatus === statusFilter);
    }
    return rows;
  }, [screenRows, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { all: screenRows.length, pass: 0, error: 0, warning: 0, "not-tested": 0 };
    screenRows.forEach((r) => {
      counts[r.runtimeStatus]++;
    });
    return counts;
  }, [screenRows]);

  useEffect(() => {
    logGovernanceScope("PAGE", "screen-management", {
      totalScreens: screenRows.length,
      passCount: statusCounts.pass,
      errorCount: statusCounts.error,
      warningCount: statusCounts.warning,
      notTestedCount: statusCounts["not-tested"]
    });
  }, [screenRows.length, statusCounts]);

  useEffect(() => {
    function handleNavigationSync() {
      void screenPayload.reload();
      void qualityPayload.reload();
      void session.reload();
    }
    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => window.removeEventListener(getNavigationEventName(), handleNavigationSync);
  }, [screenPayload, qualityPayload, session]);

  const handleOpenBuilder = (screen: ScreenRow) => {
    const builderUrl = buildLocalizedPath(
      `/admin/system/builder-studio?menuCode=${screen.menuCode || screen.routeId}&pageId=${screen.pageId || ""}&menuTitle=${encodeURIComponent(screen.label)}&menuUrl=${encodeURIComponent(screen.routePath)}`,
      `/en/admin/system/builder-studio?menuCode=${screen.menuCode || screen.routeId}&pageId=${screen.pageId || ""}&menuTitle=${encodeURIComponent(screen.label)}&menuUrl=${encodeURIComponent(screen.routePath)}`
    );
    window.location.href = builderUrl;
  };

  const handleAssignMenu = (screen: ScreenRow) => {
    const assignmentUrl = buildLocalizedPath(
      `/admin/system/screen-menu-assignment-management?pageId=${screen.pageId}&menuCode=${screen.menuCode}`,
      `/en/admin/system/screen-menu-assignment-management?pageId=${screen.pageId}&menuCode=${screen.menuCode}`
    );
    window.location.href = assignmentUrl;
  };

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Environment" : "환경" },
        { label: en ? "Screen Management" : "화면 관리" }
      ]}
      title={en ? "Screen Management" : "화면 관리"}
    >
      <GovernanceCompressionNav activeId="screen-management" en={en} />
      <AdminWorkspacePageFrame>
        <PageStatusNotice tone="info">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {SCREEN_MANAGEMENT_CLOSE_OUT_ROWS.map((row) => (
              <div key={row.labelEn} className="flex items-start gap-3">
                <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] ${
                  row.status === "available" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {row.status === "available" ? (en ? "Available" : "가능") : (en ? "Blocked" : "차단")}
                </span>
                <div>
                  <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">
                    {en ? row.labelEn : row.labelKo}
                  </p>
                  <p className="text-xs text-[var(--kr-gov-text-secondary)]">
                    {en ? row.descriptionEn : row.descriptionKo}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </PageStatusNotice>

        {qualityPayload.error && (
          <PageStatusNotice tone="error">
            {en ? "The runtime inspection report could not be loaded." : "실제 화면 검사 결과를 불러오지 못했습니다."} {String(qualityPayload.error)}
          </PageStatusNotice>
        )}
        {qualityPayload.value && qualityPayload.value.summary?.routeCount !== screenRows.length && (
          <PageStatusNotice tone="warning">
            {en
              ? `Inspection coverage ${qualityPayload.value.summary?.routeCount || 0} / registry ${screenRows.length}. Unmatched routes are shown as Not tested.`
              : `실제 검사 ${qualityPayload.value.summary?.routeCount || 0}건 / 화면 원장 ${screenRows.length}건입니다. 일치하지 않는 화면은 미검사로 표시됩니다.`}
          </PageStatusNotice>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <SummaryMetricCard
            title={en ? "Total Screens" : "전체 화면"}
            value={statusCounts.all}
            accentClassName="bg-blue-50 border-blue-200"
            surfaceClassName="text-blue-800"
          />
          <SummaryMetricCard
            title={en ? "Pass" : "정상"}
            value={statusCounts.pass}
            accentClassName="bg-emerald-50 border-emerald-200"
            surfaceClassName="text-emerald-800"
          />
          <SummaryMetricCard
            title={en ? "Error" : "오류"}
            value={statusCounts.error}
            accentClassName="bg-red-50 border-red-200"
            surfaceClassName="text-red-800"
          />
          <SummaryMetricCard
            title={en ? "Warning / Not tested" : "주의 / 미검사"}
            value={statusCounts.warning + statusCounts["not-tested"]}
            accentClassName="bg-gray-50 border-gray-200"
            surfaceClassName="text-gray-800"
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4">
          <AdminSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="w-48"
          >
            <option value="all">{en ? "All Status" : "전체 상태"}</option>
            <option value="pass">{en ? "Pass" : "정상"}</option>
            <option value="error">{en ? "Error" : "오류"}</option>
            <option value="warning">{en ? "Warning" : "주의"}</option>
            <option value="not-tested">{en ? "Not tested" : "미검사"}</option>
          </AdminSelect>
          <div className="flex-1">
            <AdminInput
              onChange={(e) => setRouteFilter(e.target.value)}
              placeholder={en ? "Search by name, route, menu code..." : "이름, 라우트, 메뉴코드로 검색..."}
              value={routeFilter}
              className="w-full"
            />
          </div>
          <MemberButton
            onClick={() => {
              window.location.href = buildLocalizedPath(
                "/admin/system/builder-studio",
                "/en/admin/system/builder-studio"
              );
            }}
            size="sm"
            type="button"
            variant="primary"
          >
            {en ? "+ New Screen" : "+ 새 화면"}
          </MemberButton>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ScreenManagementCatalogPanel
              title={en ? "Screen Catalog" : "화면 카탈로그"}
              count={filteredScreenRows.length}
              filterValue={routeFilter}
              onFilterChange={(e) => setRouteFilter(e.target.value)}
              filterPlaceholder={en ? "Search screens..." : "화면 검색..."}
              items={filteredScreenRows}
              emptyLabel={en ? "No screens found" : "화면을 찾을 수 없습니다"}
              onSelect={setSelectedScreen}
            />
          </div>
          <div className="xl:col-span-1">
            <ScreenDetailPanel
              screen={selectedScreen}
              onOpenBuilder={handleOpenBuilder}
              onAssignMenu={handleAssignMenu}
              en={en}
            />
          </div>
        </div>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export default ScreenManagementMigrationPage;
