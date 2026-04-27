import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { readBootstrappedEmissionDataHistoryPageData } from "../../lib/api/bootstrap";
import { fetchEmissionDataHistoryPage } from "../../lib/api/emission";
import type { EmissionDataHistoryPagePayload } from "../../lib/api/emissionTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, CollectionResultPanel, GridToolbar, MemberPagination, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { stringOf } from "../admin-system/adminSystemShared";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  changeType: string;
  changeTarget: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  searchKeyword: "",
  changeType: "",
  changeTarget: ""
};

const DEFAULT_CHANGE_TYPE_OPTIONS = [
  { value: "", labelKo: "전체", labelEn: "All" },
  { value: "CORRECTION", labelKo: "정정", labelEn: "Correction" },
  { value: "APPROVAL", labelKo: "승인 반영", labelEn: "Approval" },
  { value: "SCHEMA", labelKo: "스키마 동기화", labelEn: "Schema Sync" }
];

const DEFAULT_CHANGE_TARGET_OPTIONS = [
  { value: "", labelKo: "전체", labelEn: "All" },
  { value: "ACTIVITY_DATA", labelKo: "활동자료", labelEn: "Activity Data" },
  { value: "VERIFICATION_STATUS", labelKo: "검증 상태", labelEn: "Verification Status" },
  { value: "RESULT_STATUS", labelKo: "산정 상태", labelEn: "Result Status" },
  { value: "ATTACHMENT", labelKo: "첨부 문서", labelEn: "Attachment" },
  { value: "SITE_METADATA", labelKo: "배출지 메타데이터", labelEn: "Site Metadata" },
  { value: "CALCULATION_FORMULA", labelKo: "산정식", labelEn: "Calculation Formula" },
  { value: "EMISSION_FACTOR", labelKo: "배출계수", labelEn: "Emission Factor" },
  { value: "MONITORING_RULE", labelKo: "모니터링 규칙", labelEn: "Monitoring Rule" }
];

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  const search = new URLSearchParams(window.location.search);
  return {
    pageIndex: Number(search.get("pageIndex") || "1") || 1,
    searchKeyword: search.get("searchKeyword") || "",
    changeType: search.get("changeType") || "",
    changeTarget: search.get("changeTarget") || ""
  };
}

function sameFilters(left: Filters, right: Filters) {
  return left.pageIndex === right.pageIndex
    && left.searchKeyword === right.searchKeyword
    && left.changeType === right.changeType
    && left.changeTarget === right.changeTarget;
}

function isDefaultFilters(filters: Filters) {
  return sameFilters(filters, DEFAULT_FILTERS);
}

function readReturnUrl() {
  if (typeof window === "undefined") {
    return "";
  }
  const raw = new URLSearchParams(window.location.search).get("returnUrl") || "";
  if (!raw) {
    return "";
  }
  try {
    const decoded = decodeURIComponent(raw);
    const nextUrl = new URL(decoded, window.location.origin);
    if (nextUrl.origin !== window.location.origin) {
      return "";
    }
    if (!(nextUrl.pathname.startsWith("/admin/") || nextUrl.pathname.startsWith("/en/admin/"))) {
      return "";
    }
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  } catch {
    return "";
  }
}

function withReturnUrl(targetUrl: string, returnUrl: string) {
  const normalizedTargetUrl = String(targetUrl || "").trim();
  if (!normalizedTargetUrl || !returnUrl || typeof window === "undefined") {
    return normalizedTargetUrl;
  }
  try {
    const nextUrl = new URL(normalizedTargetUrl, window.location.origin);
    nextUrl.searchParams.set("returnUrl", returnUrl);
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  } catch {
    return normalizedTargetUrl;
  }
}

function matchesInitialHistoryPayload(payload: EmissionDataHistoryPagePayload | null, filters: Filters) {
  if (!payload) {
    return false;
  }
  return Number(payload.pageIndex || 1) === filters.pageIndex
    && String(payload.searchKeyword || "") === filters.searchKeyword
    && String(payload.changeType || "") === filters.changeType
    && String(payload.changeTarget || "") === filters.changeTarget;
}

export function EmissionDataHistoryMigrationPage() {
  const en = isEnglish();
  const returnUrl = readReturnUrl();
  const initial = useMemo<Filters>(() => readInitialFilters(), []);
  const initialPayload = useMemo(() => readBootstrappedEmissionDataHistoryPageData(), []);
  const canUseInitialPayload = matchesInitialHistoryPayload(initialPayload, initial);
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const pageState = useAsyncValue<EmissionDataHistoryPagePayload>(() => fetchEmissionDataHistoryPage(filters), [filters.pageIndex, filters.searchKeyword, filters.changeType, filters.changeTarget], {
    initialValue: canUseInitialPayload ? initialPayload : null,
    skipInitialLoad: canUseInitialPayload,
    onSuccess(payload) {
      const next = {
        pageIndex: Number(payload.pageIndex || 1),
        searchKeyword: String(payload.searchKeyword || ""),
        changeType: String(payload.changeType || ""),
        changeTarget: String(payload.changeTarget || "")
      };
      setFilters((current) => sameFilters(current, next) ? current : next);
      setDraft((current) => sameFilters(current, next) ? current : next);
    }
  });
  const page = pageState.value;
  const rows = (page?.historyRows || []) as Array<Record<string, unknown>>;
  const changeTypeOptions = ((page?.changeTypeOptions as Array<Record<string, unknown>> | undefined)?.length
    ? (page?.changeTypeOptions as Array<Record<string, unknown>>)
    : DEFAULT_CHANGE_TYPE_OPTIONS.map((option) => ({ value: option.value, label: en ? option.labelEn : option.labelKo })));
  const changeTargetOptions = ((page?.changeTargetOptions as Array<Record<string, unknown>> | undefined)?.length
    ? (page?.changeTargetOptions as Array<Record<string, unknown>>)
    : DEFAULT_CHANGE_TARGET_OPTIONS.map((option) => ({ value: option.value, label: en ? option.labelEn : option.labelKo })));
  const changeTypeMeta = (page?.changeTypeMeta || {}) as Record<string, Record<string, unknown>>;
  const changeTargetMeta = (page?.changeTargetMeta || {}) as Record<string, Record<string, unknown>>;
  const summaryCards = (page?.summaryCards || []) as Array<Record<string, unknown>>;
  const totalPages = Number(page?.totalPages || 1);
  const currentPage = Number(page?.pageIndex || 1);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const search = new URLSearchParams();
    if (filters.pageIndex > 1) {
      search.set("pageIndex", String(filters.pageIndex));
    }
    if (returnUrl) {
      search.set("returnUrl", returnUrl);
    }
    if (filters.searchKeyword) {
      search.set("searchKeyword", filters.searchKeyword);
    }
    if (filters.changeType) {
      search.set("changeType", filters.changeType);
    }
    if (filters.changeTarget) {
      search.set("changeTarget", filters.changeTarget);
    }
    const nextQuery = search.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [filters, returnUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handlePopState = () => {
      const next = readInitialFilters();
      setFilters((current) => sameFilters(current, next) ? current : next);
      setDraft((current) => sameFilters(current, next) ? current : next);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-data-history", {
      language: en ? "en" : "ko",
      pageIndex: currentPage,
      searchKeyword: filters.searchKeyword,
      changeType: filters.changeType,
      changeTarget: filters.changeTarget,
      rowCount: rows.length
    });
    logGovernanceScope("COMPONENT", "emission-data-history-table", {
      rowCount: rows.length,
      totalPages,
      currentPage
    });
  }, [currentPage, en, filters.changeTarget, filters.changeType, filters.searchKeyword, rows.length, totalPages]);

  function resolveMetaLabel(meta: Record<string, Record<string, unknown>>, code: string, fallback: string) {
    if (!code) {
      return fallback;
    }
    return stringOf(meta[code], "label") || fallback;
  }

  function resolveBadgeClass(meta: Record<string, Record<string, unknown>>, code: string, fallback: string) {
    if (!code) {
      return fallback;
    }
    return stringOf(meta[code], "badgeClass") || fallback;
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Calculation & Certification" : "산정·인증" },
        ...(returnUrl ? [{ label: en ? "Emission Result Detail" : "산정 결과 상세", href: returnUrl }] : []),
        { label: en ? "Data Change History" : "데이터 변경 이력" }
      ]}
      title={en ? "Data Change History" : "데이터 변경 이력"}
      subtitle={en ? "Track before and after values for emission calculation data, approval states, and site metadata." : "배출 산정 데이터, 승인 상태, 배출지 메타데이터의 변경 전후 값을 추적합니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-4" data-help-id="emission-data-history-summary">
          {summaryCards.map((card, index) => (
            <SummaryMetricCard
              key={`${stringOf(card, "title")}-${index}`}
              title={stringOf(card, "title")}
              value={stringOf(card, "value")}
              description={stringOf(card, "description")}
              accentClassName={stringOf(card, "toneClass")}
              surfaceClassName={stringOf(card, "surfaceClassName")}
            />
          ))}
        </section>

        <CollectionResultPanel
          data-help-id="emission-data-history-search"
          description={en ? "Filter the change ledger by change type, target field group, and keyword to isolate operator actions." : "변경 유형, 대상 필드군, 검색어로 운영 변경 이력을 좁혀 확인합니다."}
          icon="history"
          title={en ? "History Filter" : "이력 조회 조건"}
        >
          <form className="grid grid-cols-1 gap-6 md:grid-cols-4" onSubmit={(event) => {
            event.preventDefault();
            logGovernanceScope("ACTION", "emission-data-history-search", {
              searchKeyword: draft.searchKeyword,
              changeType: draft.changeType,
              changeTarget: draft.changeTarget
            });
            setFilters({ ...draft, pageIndex: 1 });
          }}>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="changeType">{en ? "Change Type" : "변경 유형"}</label>
              <AdminSelect id="changeType" value={draft.changeType} onChange={(event) => setDraft((current) => ({ ...current, changeType: event.target.value }))}>
                {changeTypeOptions.map((option, index) => (
                  <option key={`${stringOf(option, "value") || "all"}-${index}`} value={stringOf(option, "value")}>
                    {stringOf(option, "label")}
                  </option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="changeTarget">{en ? "Target Field" : "대상 항목"}</label>
              <AdminSelect id="changeTarget" value={draft.changeTarget} onChange={(event) => setDraft((current) => ({ ...current, changeTarget: event.target.value }))}>
                {changeTargetOptions.map((option, index) => (
                  <option key={`${stringOf(option, "value") || "all"}-${index}`} value={stringOf(option, "value")}>
                    {stringOf(option, "label")}
                  </option>
                ))}
              </AdminSelect>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="searchKeyword">{en ? "Keyword" : "검색어"}</label>
              <div className="flex gap-2">
                <AdminInput className="flex-1" id="searchKeyword" placeholder={en ? "Search by project, site, user, or change value" : "프로젝트명, 배출지명, 작업자, 변경값 검색"} value={draft.searchKeyword} onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))} />
                <button className="gov-btn gov-btn-primary" type="submit">{en ? "Search" : "검색"}</button>
                <button
                  className="gov-btn gov-btn-secondary"
                  type="button"
                  onClick={() => {
                    setDraft(DEFAULT_FILTERS);
                    setFilters(DEFAULT_FILTERS);
                  }}
                >
                  {en ? "Reset" : "초기화"}
                </button>
              </div>
            </div>
          </form>
        </CollectionResultPanel>

        {!isDefaultFilters(filters) ? (
          <PageStatusNotice tone="warning">
            {en
              ? `Filtered results are shown for ${resolveMetaLabel(changeTypeMeta, filters.changeType, "all change types")} / ${resolveMetaLabel(changeTargetMeta, filters.changeTarget, "all targets")}${filters.searchKeyword ? ` / keyword "${filters.searchKeyword}"` : ""}.`
              : `${resolveMetaLabel(changeTypeMeta, filters.changeType, "전체 변경 유형")}, ${resolveMetaLabel(changeTargetMeta, filters.changeTarget, "전체 대상 항목")}${filters.searchKeyword ? `, 검색어 "${filters.searchKeyword}"` : ""} 조건으로 필터링된 결과입니다.`}
          </PageStatusNotice>
        ) : null}

        <section className="gov-card overflow-hidden p-0" data-help-id="emission-data-history-table">
          <GridToolbar meta={en ? "Review when a field changed, who changed it, and the before/after values in one table." : "언제, 누가, 어떤 항목을 어떻게 바꿨는지 전후 값까지 한 표에서 확인합니다."} title={en ? "History Ledger" : "변경 이력 원장"} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px] border-collapse text-left text-sm">
              <thead>
                <tr className="gov-table-header">
                  <th className="w-16 px-6 py-4 text-center">{en ? "No." : "번호"}</th>
                  <th className="px-6 py-4">{en ? "History / Time" : "이력 ID / 변경 시각"}</th>
                  <th className="px-6 py-4">{en ? "Project / Site" : "프로젝트 / 배출지"}</th>
                  <th className="px-6 py-4">{en ? "Operator" : "작업자"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Type" : "유형"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Target" : "대상 항목"}</th>
                  <th className="px-6 py-4">{en ? "Before" : "변경 전"}</th>
                  <th className="px-6 py-4">{en ? "After" : "변경 후"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Trace" : "추적"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td className="px-6 py-8 text-center text-gray-500" colSpan={9}>{en ? "No history rows found." : "조회된 이력 행이 없습니다."}</td></tr>
                ) : rows.map((item, index) => {
                  const rowNo = Number(page?.totalCount || 0) - ((currentPage - 1) * Number(page?.pageSize || 10) + index);
                  return (
                    <tr className="transition-colors hover:bg-gray-50/50" key={`${stringOf(item, "historyId")}-${index}`}>
                      <td className="px-6 py-4 text-center text-gray-500">{rowNo}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "historyId")}</div>
                        <div className="mt-1 text-xs text-gray-400">{stringOf(item, "changedAt")}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "projectName")}</div>
                        <div className="mt-1 text-xs text-gray-500">{stringOf(item, "siteName")}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-[var(--kr-gov-text-secondary)]">{stringOf(item, "changedBy")}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${resolveBadgeClass(changeTypeMeta, stringOf(item, "changeTypeCode"), "bg-slate-200 text-slate-700")}`}>{stringOf(item, "changeTypeLabel")}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${resolveBadgeClass(changeTargetMeta, stringOf(item, "changeTargetCode"), "bg-slate-100 text-slate-700")}`}>{stringOf(item, "changeTargetLabel")}</span>
                      </td>
                      <td className="max-w-[220px] px-6 py-4 text-gray-500">{stringOf(item, "beforeValue")}</td>
                      <td className="max-w-[220px] px-6 py-4 font-bold text-[var(--kr-gov-blue)]">{stringOf(item, "afterValue")}</td>
                      <td className="px-6 py-4 text-center">
                        <a className="inline-flex rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[var(--kr-gov-blue-hover)]" href={withReturnUrl(stringOf(item, "detailUrl"), returnUrl)}>
                          {en ? "Open" : "열기"}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <MemberPagination className="border-t-0" currentPage={currentPage} onPageChange={(pageNumber) => setFilters((current) => ({ ...current, pageIndex: pageNumber }))} totalPages={totalPages} />
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
