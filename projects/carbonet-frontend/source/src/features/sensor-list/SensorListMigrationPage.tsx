import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchSensorListPage } from "../../lib/api/ops";
import type { SensorListPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, MemberPagination, MemberSectionToolbar } from "../member/common";

const PAGE_SIZE = 10;

type SensorCloseoutRow = {
  titleKo: string;
  titleEn: string;
  status: "Available" | "Blocked";
  detailKo: string;
  detailEn: string;
};

const SENSOR_CLOSEOUT_ROWS: SensorCloseoutRow[] = [
  {
    titleKo: "모니터링 기반 센서 행",
    titleEn: "Monitoring-derived sensor rows",
    status: "Available",
    detailKo: "보안 모니터링 이벤트, 활동 로그, 차단 후보를 센서 행으로 재구성해 조회/필터/선택 패널을 제공합니다.",
    detailEn: "Security monitoring events, activity logs, and block candidates are reshaped into rows for search, filters, and focused review."
  },
  {
    titleKo: "상세 화면 이동",
    titleEn: "Detail navigation",
    status: "Available",
    detailKo: "선택 센서는 이벤트 상세, 보안 모니터링, 센서 설정 화면으로 이동할 수 있습니다.",
    detailEn: "The focused row can move into event detail, security monitoring, and sensor settings screens."
  },
  {
    titleKo: "Live Inventory Source",
    titleEn: "Live inventory source",
    status: "Blocked",
    detailKo: "등록/수정 화면과 동일한 센서 인벤토리 원천, 소유자, 설치 위치, 활성 상태, 갱신 시각 계약이 필요합니다.",
    detailEn: "The same inventory source as add/edit, owner, installation location, active state, and refreshed-at contract are required."
  },
  {
    titleKo: "상태 새로고침 / Export",
    titleEn: "Status refresh / export",
    status: "Blocked",
    detailKo: "센서별 health refresh API, source timestamp, CSV/Excel export, export 감사가 필요합니다.",
    detailEn: "Per-sensor health refresh API, source timestamp, CSV/Excel export, and export audit are required."
  },
  {
    titleKo: "Bulk Enable / Disable",
    titleEn: "Bulk enable / disable",
    status: "Blocked",
    detailKo: "선택 행, bulk 활성/비활성 API, 권한 기능 코드, 영향 미리보기, 변경 감사가 필요합니다.",
    detailEn: "Selected rows, bulk enable/disable API, feature codes, impact preview, and change audit are required."
  }
];

const SENSOR_ACTION_CONTRACT = [
  {
    labelKo: "상태 새로고침",
    labelEn: "Refresh Status",
    noteKo: "live sensor health API와 source timestamp가 필요합니다.",
    noteEn: "Requires live sensor health API and source timestamp."
  },
  {
    labelKo: "목록 Export",
    labelEn: "Export List",
    noteKo: "필터 조건 포함 export API와 감사 이력이 필요합니다.",
    noteEn: "Requires export API with filter criteria and audit history."
  },
  {
    labelKo: "선택 활성화",
    labelEn: "Bulk Enable",
    noteKo: "bulk mutation API, 권한 기능 코드, 영향 미리보기가 필요합니다.",
    noteEn: "Requires bulk mutation API, feature code, and impact preview."
  },
  {
    labelKo: "선택 비활성화",
    labelEn: "Bulk Disable",
    noteKo: "bulk mutation API, 비활성 사유, 변경 감사가 필요합니다.",
    noteEn: "Requires bulk mutation API, disable reason, and change audit."
  }
];

function stringOf(row: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!row) {
    return "";
  }
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined) {
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
  }
  return "";
}

function statusBadgeClass(value: string) {
  switch (value.toUpperCase()) {
    case "BLOCKED":
      return "bg-red-100 text-red-700";
    case "ALERT":
      return "bg-amber-100 text-amber-700";
    case "REVIEW":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-emerald-100 text-emerald-700";
  }
}

function severityBadgeClass(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("CRITICAL")) return "bg-red-100 text-red-700";
  if (upper.includes("HIGH")) return "bg-amber-100 text-amber-700";
  if (upper.includes("MEDIUM")) return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

function isSelectionKey(key: string) {
  return key === "Enter" || key === " ";
}

function hasActiveFilters(searchKeyword: string, statusFilter: string, typeFilter: string, severityFilter: string) {
  return searchKeyword.trim() !== "" || statusFilter !== "ALL" || typeFilter !== "ALL" || severityFilter !== "ALL";
}

function buildSensorEditHref(row: Record<string, unknown> | null | undefined) {
  const search = new URLSearchParams({
    sensorId: stringOf(row, "sensorId"),
    sensorName: stringOf(row, "sensorName"),
    sensorType: stringOf(row, "sensorType") || "GAS",
    managerName: stringOf(row, "owner"),
    lifecycleStatus: stringOf(row, "status"),
    status: stringOf(row, "status"),
    detail: stringOf(row, "detail"),
    description: stringOf(row, "note", "detail"),
    note: stringOf(row, "note"),
    targetUrl: stringOf(row, "targetUrl"),
    sourceIp: stringOf(row, "sourceIp"),
    installLocation: stringOf(row, "targetUrl", "sourceIp"),
    detectedAt: stringOf(row, "detectedAt"),
    eventCount: stringOf(row, "eventCount"),
    fingerprint: stringOf(row, "fingerprint"),
    blockStatusLabel: stringOf(row, "blockStatusLabel"),
    targetRoute: stringOf(row, "targetRoute")
  });
  return `${buildLocalizedPath("/admin/monitoring/sensor_edit", "/en/admin/monitoring/sensor_edit")}?${search.toString()}`;
}

export function SensorListMigrationPage() {
  const en = isEnglish();
  const pageState = useAsyncValue<SensorListPagePayload>(fetchSensorListPage, [], {});
  const page = pageState.value;
  const summary = useMemo(() => ((page?.sensorSummary || []) as Array<Record<string, string>>), [page]);
  const rows = useMemo(() => ((page?.sensorRows || []) as Array<Record<string, string>>), [page]);
  const activityRows = useMemo(() => ((page?.sensorActivityRows || []) as Array<Record<string, string>>), [page]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [pageIndex, setPageIndex] = useState(1);
  const [selectedSensorId, setSelectedSensorId] = useState("");
  const filtersActive = hasActiveFilters(searchKeyword, statusFilter, typeFilter, severityFilter);

  const filteredRows = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesKeyword = !keyword || [
        stringOf(row, "sensorId"),
        stringOf(row, "sensorName"),
        stringOf(row, "sourceIp"),
        stringOf(row, "targetUrl"),
        stringOf(row, "owner"),
        stringOf(row, "note"),
        stringOf(row, "detail")
      ].join(" ").toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === "ALL" || stringOf(row, "status").toUpperCase() === statusFilter;
      const matchesType = typeFilter === "ALL" || stringOf(row, "sensorType").toUpperCase() === typeFilter;
      const matchesSeverity = severityFilter === "ALL" || stringOf(row, "severity").toUpperCase().includes(severityFilter);
      return matchesKeyword && matchesStatus && matchesType && matchesSeverity;
    });
  }, [rows, searchKeyword, severityFilter, statusFilter, typeFilter]);

  useEffect(() => {
    setPageIndex(1);
  }, [searchKeyword, severityFilter, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePageIndex = Math.min(pageIndex, totalPages);
  const pagedRows = useMemo(() => {
    const startIndex = (safePageIndex - 1) * PAGE_SIZE;
    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, safePageIndex]);
  const selectedRow = useMemo(() => {
    if (selectedSensorId) {
      const matchedRow = filteredRows.find((row) => stringOf(row, "sensorId") === selectedSensorId);
      if (matchedRow) {
        return matchedRow;
      }
    }
    return pagedRows[0] || filteredRows[0] || null;
  }, [filteredRows, pagedRows, selectedSensorId]);

  useEffect(() => {
    if (filteredRows.length === 0) {
      if (selectedSensorId) {
        setSelectedSensorId("");
      }
      return;
    }
    if (!selectedSensorId || !filteredRows.some((row) => stringOf(row, "sensorId") === selectedSensorId)) {
      setSelectedSensorId(stringOf(filteredRows[0], "sensorId"));
    }
  }, [filteredRows, selectedSensorId]);

  useEffect(() => {
    logGovernanceScope("PAGE", "sensor-list", {
      language: en ? "en" : "ko",
      totalCount: rows.length,
      filteredCount: filteredRows.length,
      statusFilter,
      typeFilter,
      severityFilter
    });
  }, [en, filteredRows.length, rows.length, severityFilter, statusFilter, typeFilter]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Monitoring" : "모니터링" },
        { label: en ? "Sensor List" : "센서 목록" }
      ]}
      title={en ? "Sensor List" : "센서 목록"}
      subtitle={en ? "Review monitoring-derived sensor rows and move into detailed inspection quickly." : "모니터링 기반 센서 행을 빠르게 조회하고 상세 분석 화면으로 이동합니다."}
      actions={
        <a
          className="gov-btn"
          href={buildLocalizedPath("/admin/monitoring/sensor_add", "/en/admin/monitoring/sensor_add")}
        >
          {en ? "Register Sensor" : "센서 등록"}
        </a>
      }
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading sensor list..." : "센서 목록을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5" data-help-id="sensor-list-summary">
          {summary.map((card, index) => (
            <SummaryMetricCard
              key={`${stringOf(card, "title", "label")}-${index}`}
              title={stringOf(card, "title", "label")}
              value={stringOf(card, "value")}
              description={stringOf(card, "description")}
            />
          ))}
        </section>

        <CollectionResultPanel
          title={en ? "Sensor List Operating Rule" : "센서 목록 운영 기준"}
          description={en ? "Keep one list for status, severity, owner note, and block promotion state before moving to event detail." : "상태, 심각도, 담당자 메모, 차단 승격 상태를 한 목록에서 본 뒤 이벤트 상세 화면으로 이동합니다."}
          data-help-id="sensor-list-operating-rule"
        >
          {en
            ? "This screen keeps the first triage pass lightweight and aligned with the shared admin list pattern."
            : "1차 분류는 가볍게 유지하고, 화면 구조는 기존 관리자 리스트 패턴에 맞춥니다."}
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="sensor-list-closeout-gate">
          <div className="px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Closeout Gate" : "완료 게이트"}</p>
                <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? "What is still missing for sensor inventory operations" : "센서 인벤토리 운영을 위해 남은 기능"}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "This page currently supports monitoring-derived triage and detail navigation. Inventory mutation actions stay disabled until the add/edit inventory source, live refresh, export, bulk enable/disable, authorization, and audit contracts are implemented."
                    : "이 화면은 현재 모니터링 기반 1차 분류와 상세 이동을 제공합니다. 등록/수정과 같은 인벤토리 원천, live refresh, export, bulk 활성/비활성, 권한, 감사 계약이 구현되기 전까지 변경 조치는 비활성화합니다."}
                </p>
              </div>
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                {en ? "PARTIAL / inventory actions blocked" : "PARTIAL / 인벤토리 조치 차단"}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
              {SENSOR_CLOSEOUT_ROWS.map((row) => (
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4" key={row.titleEn}>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${row.status === "Available" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {row.status}
                  </span>
                  <h3 className="mt-3 text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? row.titleEn : row.titleKo}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{en ? row.detailEn : row.detailKo}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--kr-gov-border-light)] bg-slate-50 px-6 py-5" data-help-id="sensor-list-action-contract">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[var(--kr-gov-text-primary)]">{en ? "Blocked Sensor Inventory Actions" : "차단된 센서 인벤토리 조치"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Keep filtering and detail navigation active; enable these actions only after backend inventory, authorization, and audit are connected." : "필터와 상세 이동은 유지하되, 백엔드 인벤토리·권한·감사가 연결된 뒤에만 아래 조치를 활성화합니다."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SENSOR_ACTION_CONTRACT.map((action) => (
                  <button className="gov-btn gov-btn-outline opacity-60" disabled key={action.labelEn} title={en ? action.noteEn : action.noteKo} type="button">
                    {en ? action.labelEn : action.labelKo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="gov-card" data-help-id="sensor-list-filters">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <MemberSectionToolbar
                title={en ? "Search Filters" : "검색 조건"}
                meta={(en ? "Refreshed at " : "갱신 시각 ") + stringOf(page as Record<string, unknown>, "refreshedAt")}
              />
              <button
                type="button"
                className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-2 text-sm font-bold text-[var(--kr-gov-text-primary)] hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!filtersActive}
                onClick={() => {
                  setSearchKeyword("");
                  setStatusFilter("ALL");
                  setTypeFilter("ALL");
                  setSeverityFilter("ALL");
                }}
              >
                {en ? "Reset Filters" : "검색 조건 초기화"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="sensor-keyword">
                {en ? "Keyword" : "검색어"}
              </label>
              <AdminInput
                id="sensor-keyword"
                placeholder={en ? "Sensor, IP, URL, owner, note" : "센서명, IP, URL, 담당자, 메모"}
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="sensor-status">
                {en ? "Status" : "상태"}
              </label>
              <AdminSelect id="sensor-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="BLOCKED">{en ? "Blocked" : "차단"}</option>
                <option value="ALERT">{en ? "Alert" : "경보"}</option>
                <option value="REVIEW">{en ? "Review" : "검토"}</option>
                <option value="STABLE">{en ? "Stable" : "안정"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="sensor-type">
                {en ? "Sensor Type" : "센서 유형"}
              </label>
              <AdminSelect id="sensor-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="AUTH">{en ? "Authentication" : "인증"}</option>
                <option value="ADMIN">{en ? "Admin Access" : "관리자 접근"}</option>
                <option value="API">{en ? "API Traffic" : "API 트래픽"}</option>
                <option value="OPS">{en ? "Operations" : "운영"}</option>
                <option value="WEB">{en ? "Web Access" : "웹 접근"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="sensor-severity">
                {en ? "Severity" : "심각도"}
              </label>
              <AdminSelect id="sensor-severity" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </AdminSelect>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.9fr)]">
          <div className="gov-card overflow-hidden p-0" data-help-id="sensor-list-table">
            <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
              <MemberSectionToolbar
                title={en ? `Sensor Rows (${filteredRows.length})` : `센서 행 (${filteredRows.length})`}
                meta={en ? "Click or press Enter on a row to change the focused sensor." : "행을 클릭하거나 Enter 키를 눌러 선택 센서를 바꿉니다."}
              />
            </div>
            {selectedRow ? (
              <div className="border-b border-[var(--kr-gov-border-light)] bg-slate-50 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-[var(--kr-gov-text-secondary)]">
                    {en
                      ? `Selected ${stringOf(selectedRow, "sensorId")} · ${stringOf(selectedRow, "sensorName")}`
                      : `선택 센서 ${stringOf(selectedRow, "sensorId")} · ${stringOf(selectedRow, "sensorName")}`}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="inline-flex items-center rounded border border-[var(--kr-gov-border-light)] bg-white px-3 py-2 text-xs font-bold text-[var(--kr-gov-blue)] hover:bg-slate-50"
                      href={stringOf(selectedRow, "targetRoute") || buildLocalizedPath("/admin/system/security-monitoring", "/en/admin/system/security-monitoring")}
                    >
                      {en ? "Event Detail" : "이벤트 상세"}
                    </a>
                    <a
                      className="inline-flex items-center rounded border border-[var(--kr-gov-border-light)] bg-white px-3 py-2 text-xs font-bold text-[var(--kr-gov-blue)] hover:bg-slate-50"
                      href={`${buildLocalizedPath("/admin/monitoring/sensor_edit", "/en/admin/monitoring/sensor_edit")}?sensorId=${encodeURIComponent(stringOf(selectedRow, "sensorId"))}&sensorName=${encodeURIComponent(stringOf(selectedRow, "sensorName"))}&sensorType=${encodeURIComponent(stringOf(selectedRow, "sensorType") || "GAS")}&managerName=${encodeURIComponent(stringOf(selectedRow, "owner"))}`}
                    >
                      {en ? "Sensor Settings" : "센서 설정"}
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <AdminTable>
                <caption className="sr-only">
                  {en
                    ? "Sensor list table. Move focus to a row and press Enter to update the focused sensor panel."
                    : "센서 목록 표입니다. 행으로 이동한 뒤 Enter 키를 누르면 선택 센서 패널이 바뀝니다."}
                </caption>
                <thead>
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4 text-center">ID</th>
                    <th className="px-6 py-4">{en ? "Sensor" : "센서"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Type" : "유형"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Severity" : "심각도"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Status" : "상태"}</th>
                    <th className="px-6 py-4">{en ? "Target" : "대상"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Signals" : "신호 수"}</th>
                    <th className="px-6 py-4">{en ? "Detected At" : "감지 시각"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={8}>
                        {en ? "No sensor rows match the current filter." : "현재 조건에 맞는 센서 행이 없습니다."}
                      </td>
                    </tr>
                  ) : pagedRows.map((row) => {
                    const rowSensorId = stringOf(row, "sensorId");
                    const isSelected = rowSensorId !== "" && rowSensorId === stringOf(selectedRow, "sensorId");
                    return (
                    <tr
                      className={`cursor-pointer transition-colors hover:bg-gray-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--kr-gov-blue)] focus-visible:outline-offset-[-2px] ${isSelected ? "bg-blue-50/70" : ""}`}
                      key={stringOf(row, "sensorId", "fingerprint")}
                      onClick={() => setSelectedSensorId(rowSensorId)}
                      onKeyDown={(event) => {
                        if (isSelectionKey(event.key)) {
                          event.preventDefault();
                          setSelectedSensorId(rowSensorId);
                        }
                      }}
                      aria-selected={isSelected}
                      aria-label={
                        en
                          ? `${stringOf(row, "sensorName")} sensor row`
                          : `${stringOf(row, "sensorName")} 센서 행`
                      }
                      tabIndex={0}
                    >
                      <td className="px-6 py-4 text-center text-sm font-bold text-[var(--kr-gov-text-primary)]">
                        <span className="sr-only">
                          {isSelected
                            ? (en ? "Currently selected sensor. " : "현재 선택된 센서. ")
                            : (en ? "Press Enter to select sensor. " : "Enter 키로 센서를 선택합니다. ")}
                        </span>
                        {stringOf(row, "sensorId")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "sensorName")}</div>
                        <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "sourceIp") || stringOf(row, "targetUrl") || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm">{stringOf(row, "sensorTypeLabel")}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${severityBadgeClass(stringOf(row, "severity"))}`}>
                          {stringOf(row, "severity")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(stringOf(row, "status"))}`}>
                          {stringOf(row, "statusLabel")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "targetUrl") || stringOf(row, "sourceIp") || "-"}</td>
                      <td className="px-6 py-4 text-center text-sm">{stringOf(row, "eventCount")}</td>
                      <td className="px-6 py-4 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "detectedAt") || "-"}</td>
                    </tr>
                  )})}
                </tbody>
              </AdminTable>
            </div>
            <MemberPagination currentPage={safePageIndex} totalPages={totalPages} onPageChange={setPageIndex} />
          </div>

          <div className="space-y-6">
            <section className="gov-card" data-help-id="sensor-list-focus">
              <h2 className="text-base font-black text-[var(--kr-gov-text-primary)]">{en ? "Focused Sensor" : "선택 센서"}</h2>
              {selectedRow ? (
                <div className="mt-4 space-y-4">
                  <div
                    aria-live="polite"
                    className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
                  >
                    {en
                      ? `Selected sensor ${stringOf(selectedRow, "sensorId")} is reflected in the detail cards and action buttons below.`
                      : `선택한 센서 ${stringOf(selectedRow, "sensorId")} 기준으로 아래 상세 카드와 작업 버튼이 바뀝니다.`}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{stringOf(selectedRow, "sensorTypeLabel")}</p>
                    <h3 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(selectedRow, "sensorName")}</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SummaryMetricCard title={en ? "Severity" : "심각도"} value={stringOf(selectedRow, "severity") || "-"} description={en ? "Current signal severity" : "현재 신호 심각도"} />
                    <SummaryMetricCard title={en ? "Status" : "상태"} value={stringOf(selectedRow, "statusLabel") || "-"} description={en ? "Current operating state" : "현재 운영 상태"} />
                    <SummaryMetricCard title={en ? "Owner" : "담당자"} value={stringOf(selectedRow, "owner") || "-"} description={en ? "Latest assigned owner" : "최신 담당자"} />
                    <SummaryMetricCard title={en ? "Block" : "차단"} value={stringOf(selectedRow, "blockStatusLabel") || "-"} description={en ? "Promotion state from monitoring" : "모니터링에서 승격된 차단 상태"} />
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-4">
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Signal Detail" : "신호 상세"}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(selectedRow, "detail") || "-"}</p>
                    <div className="mt-4 space-y-2 text-sm text-[var(--kr-gov-text-secondary)]">
                      <p>{(en ? "Target URL: " : "대상 URL: ") + (stringOf(selectedRow, "targetUrl") || "-")}</p>
                      <p>{(en ? "Source IP: " : "소스 IP: ") + (stringOf(selectedRow, "sourceIp") || "-")}</p>
                      <p>{(en ? "Operator Note: " : "운영 메모: ") + (stringOf(selectedRow, "note") || "-")}</p>
                    </div>
                  </div>
                  <a
                    className="inline-flex min-h-[44px] min-w-[160px] items-center justify-center rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--kr-gov-blue-hover)]"
                    href={stringOf(selectedRow, "targetRoute") || buildLocalizedPath("/admin/system/security-monitoring", "/en/admin/system/security-monitoring")}
                  >
                    {en ? "Open Event Detail" : "이벤트 상세 열기"}
                  </a>
                  <a
                    className="inline-flex min-h-[44px] min-w-[160px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-2 text-sm font-bold text-[var(--kr-gov-text-primary)] hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]"
                    href={buildLocalizedPath("/admin/system/security-monitoring", "/en/admin/system/security-monitoring")}
                  >
                    {en ? "Open Security Monitoring" : "보안 모니터링 이동"}
                  </a>
                  <a
                    className="inline-flex min-h-[44px] min-w-[160px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-2 text-sm font-bold text-[var(--kr-gov-text-primary)] hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]"
                    href={buildSensorEditHref(selectedRow)}
                  >
                    {en ? "Open Sensor Settings" : "센서 설정 열기"}
                  </a>
                  <a
                    className="inline-flex min-h-[44px] min-w-[160px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-2 text-sm font-bold text-[var(--kr-gov-text-primary)] hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]"
                    href={buildLocalizedPath("/admin/monitoring/sensor_add", "/en/admin/monitoring/sensor_add")}
                  >
                    {en ? "Register New Sensor" : "신규 센서 등록"}
                  </a>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No sensor is currently available." : "현재 선택 가능한 센서가 없습니다."}</p>
              )}
            </section>

            <section className="gov-card" data-help-id="sensor-list-activity">
              <h2 className="text-base font-black text-[var(--kr-gov-text-primary)]">{en ? "Recent Activity" : "최근 활동"}</h2>
              <div className="mt-4 space-y-3">
                {activityRows.slice(0, 6).map((row, index) => (
                  <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3" key={`${stringOf(row, "happenedAt", "action")}-${index}`}>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "action") || "-"}</p>
                      <span className="text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "happenedAt") || "-"}</span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "detail") || "-"}</p>
                    <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">
                      {(en ? "Actor / Target: " : "수행자 / 대상: ") + `${stringOf(row, "actorUserId") || "-"} / ${stringOf(row, "target") || "-"}`}
                    </p>
                  </article>
                ))}
                {activityRows.length === 0 ? (
                  <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No recent activity is available." : "최근 활동 이력이 없습니다."}</p>
                ) : null}
              </div>
            </section>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
// agent note: updated by FreeAgent Ultra
