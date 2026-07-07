import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  readBootstrappedEmissionValidatePageData
} from "../../lib/api/bootstrap";
import { fetchEmissionValidatePage } from "../../lib/api/emission";
import type { EmissionValidatePagePayload } from "../../lib/api/emissionTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, CollectionResultPanel, DiagnosticCard, GridToolbar, LookupContextStrip, MemberPagination, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type Filters = {
  pageIndex: number;
  resultId: string;
  searchKeyword: string;
  verificationStatus: string;
  priorityFilter: string;
};

function sameFilters(left: Filters, right: Filters) {
  return left.pageIndex === right.pageIndex
    && left.resultId === right.resultId
    && left.searchKeyword === right.searchKeyword
    && left.verificationStatus === right.verificationStatus
    && left.priorityFilter === right.priorityFilter;
}

function stringOf(row: Record<string, unknown> | undefined, key: string) {
  return row ? String(row[key] || "") : "";
}

function priorityToneClass(code: string) {
  switch (code) {
    case "HIGH":
      return "bg-red-100 text-red-700";
    case "MEDIUM":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function verificationToneClass(code: string) {
  switch (code) {
    case "FAILED":
      return "bg-red-100 text-red-700";
    case "IN_PROGRESS":
      return "bg-indigo-100 text-indigo-700";
    case "VERIFIED":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-blue-100 text-blue-700";
  }
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

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return {
      pageIndex: 1,
      resultId: "",
      searchKeyword: "",
      verificationStatus: "",
      priorityFilter: ""
    };
  }
  const search = new URLSearchParams(window.location.search);
  return {
    pageIndex: Number(search.get("pageIndex") || "1") || 1,
    resultId: search.get("resultId") || "",
    searchKeyword: search.get("searchKeyword") || "",
    verificationStatus: search.get("verificationStatus") || "",
    priorityFilter: search.get("priorityFilter") || ""
  };
}

function matchesInitialValidatePayload(payload: EmissionValidatePagePayload | null, filters: Filters) {
  if (!payload) {
    return false;
  }
  return Number(payload.pageIndex || 1) === filters.pageIndex
    && String(payload.resultId || "") === filters.resultId
    && String(payload.searchKeyword || "") === filters.searchKeyword
    && String(payload.verificationStatus || "") === filters.verificationStatus
    && String(payload.priorityFilter || "") === filters.priorityFilter;
}

export function EmissionValidateMigrationPage() {
  const en = isEnglish();
  const returnUrl = readReturnUrl();
  const initial = useMemo<Filters>(() => readInitialFilters(), []);
  const initialPayload = useMemo(() => readBootstrappedEmissionValidatePageData(), []);
  const canUseInitialPayload = matchesInitialValidatePayload(initialPayload, initial);
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const pageState = useAsyncValue<EmissionValidatePagePayload>(() => fetchEmissionValidatePage(filters), [filters.pageIndex, filters.resultId, filters.searchKeyword, filters.verificationStatus, filters.priorityFilter], {
    initialValue: canUseInitialPayload ? initialPayload : null,
    skipInitialLoad: canUseInitialPayload,
    onSuccess(payload) {
      const next = {
        pageIndex: Number(payload.pageIndex || 1),
        resultId: String(payload.resultId || ""),
        searchKeyword: String(payload.searchKeyword || ""),
        verificationStatus: String(payload.verificationStatus || ""),
        priorityFilter: String(payload.priorityFilter || "")
      };
      setDraft((current) => sameFilters(current, next) ? current : next);
      setFilters((current) => sameFilters(current, next) ? current : next);
    }
  });
  const page = pageState.value;
  const summaryCards = (page?.summaryCards || []) as Array<Record<string, unknown>>;
  const queueRows = (page?.queueRows || []) as Array<Record<string, unknown>>;
  const selectedResult = (page?.selectedResult || null) as Record<string, unknown> | null;
  const priorityLegend = (page?.priorityLegend || []) as Array<Record<string, unknown>>;
  const policyRows = (page?.policyRows || []) as Array<Record<string, unknown>>;
  const actionLinks = (page?.actionLinks || []) as Array<Record<string, unknown>>;
  const currentPage = Number(page?.pageIndex || 1);
  const totalPages = Number(page?.totalPages || 1);

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
    if (filters.resultId) {
      search.set("resultId", filters.resultId);
    }
    if (filters.searchKeyword) {
      search.set("searchKeyword", filters.searchKeyword);
    }
    if (filters.verificationStatus) {
      search.set("verificationStatus", filters.verificationStatus);
    }
    if (filters.priorityFilter) {
      search.set("priorityFilter", filters.priorityFilter);
    }
    const nextQuery = search.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [filters, returnUrl]);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-validate", {
      language: en ? "en" : "ko",
      pageIndex: currentPage,
      resultId: filters.resultId,
      searchKeyword: filters.searchKeyword,
      verificationStatus: filters.verificationStatus,
      priorityFilter: filters.priorityFilter,
      rowCount: queueRows.length
    });
    logGovernanceScope("COMPONENT", "emission-validate-table", {
      rowCount: queueRows.length,
      totalPages,
      currentPage
    });
  }, [currentPage, en, filters.priorityFilter, filters.resultId, filters.searchKeyword, filters.verificationStatus, queueRows.length, totalPages]);

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

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Calculation & Certification" : "산정·인증" },
        ...(returnUrl ? [{ label: en ? "Emission Result Detail" : "산정 결과 상세", href: returnUrl }] : []),
        { label: en ? "Verification Management" : "검증 관리" }
      ]}
      title={en ? "Verification Management" : "검증 관리"}
      subtitle={en ? "Prioritize failed, pending, and in-progress emission verification work from one admin queue." : "반려, 대기, 진행 중인 배출 검증 업무를 하나의 관리자 대기열에서 우선순위별로 관리합니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
        {filters.resultId ? (
          <LookupContextStrip
            data-help-id="emission-validate-context"
            action={(
              <button
                className="gov-btn gov-btn-secondary"
                onClick={() => {
                  setDraft((current) => ({ ...current, resultId: "", pageIndex: 1 }));
                  setFilters((current) => ({ ...current, resultId: "", pageIndex: 1 }));
                }}
                type="button"
              >
                {en ? "Clear selection" : "선택 해제"}
              </button>
            )}
            label={en ? "Selected Result" : "선택 결과"}
            value={page?.selectedResultFound && selectedResult ? (
              <span>
                <strong>{stringOf(selectedResult, "resultId")}</strong>
                {" · "}
                {stringOf(selectedResult, "projectName")}
                {" · "}
                {stringOf(selectedResult, "companyName")}
                {" · "}
                {stringOf(selectedResult, "verificationStatusLabel")}
                {" / "}
                {stringOf(selectedResult, "priorityLabel")}
              </span>
            ) : (
              en ? `Result ${filters.resultId} is not in the current verification queue or active filters.` : `${filters.resultId} 결과가 현재 검증 대기열 또는 적용된 필터에 없습니다.`
            )}
          />
        ) : null}

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3" data-help-id="emission-validate-summary">
          {summaryCards.length > 0
            ? summaryCards.map((card, index) => (
              <SummaryMetricCard
                key={`${stringOf(card, "title")}-${index}`}
                title={stringOf(card, "title")}
                value={stringOf(card, "value")}
                description={stringOf(card, "description")}
                accentClassName={stringOf(card, "toneClass")}
              />
            ))
            : (
              <>
                <SummaryMetricCard title={en ? "Verification Queue" : "검증 대기열"} value={String(page?.totalCount || 0)} />
                <SummaryMetricCard title={en ? "Pending / In Progress" : "대기 / 진행중"} value={`${page?.pendingCount || 0} / ${page?.inProgressCount || 0}`} />
                <SummaryMetricCard title={en ? "Failed / High Priority" : "반려 / 고우선"} value={`${page?.failedCount || 0} / ${page?.highPriorityCount || 0}`} />
              </>
            )}
        </section>

        <CollectionResultPanel
          data-help-id="emission-validate-search"
          description={en ? "Filter the verification queue by review state, urgency, and keyword." : "검증 상태, 우선순위, 검색어 기준으로 검증 대기열을 좁힙니다."}
          icon="rule"
          title={en ? "Verification Filters" : "검증 필터"}
        >
          <form className="grid grid-cols-1 gap-6 md:grid-cols-4" onSubmit={(event) => {
            event.preventDefault();
            setFilters({ ...draft, pageIndex: 1 });
          }}>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="verificationStatus">{en ? "Verification Status" : "검증 상태"}</label>
              <AdminSelect id="verificationStatus" value={draft.verificationStatus} onChange={(event) => setDraft((current) => ({ ...current, verificationStatus: event.target.value }))}>
                <option value="">{en ? "All" : "전체"}</option>
                <option value="PENDING">{en ? "Pending" : "검증 대기"}</option>
                <option value="IN_PROGRESS">{en ? "In Progress" : "검증 진행중"}</option>
                <option value="FAILED">{en ? "Failed" : "반려"}</option>
                <option value="VERIFIED">{en ? "Verified" : "검증 완료"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="priorityFilter">{en ? "Priority" : "우선순위"}</label>
              <AdminSelect id="priorityFilter" value={draft.priorityFilter} onChange={(event) => setDraft((current) => ({ ...current, priorityFilter: event.target.value }))}>
                <option value="">{en ? "All" : "전체"}</option>
                <option value="HIGH">{en ? "High" : "높음"}</option>
                <option value="MEDIUM">{en ? "Medium" : "중간"}</option>
                <option value="NORMAL">{en ? "Normal" : "일반"}</option>
              </AdminSelect>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="searchKeyword">{en ? "Keyword" : "검색어"}</label>
              <div className="flex gap-2">
                <AdminInput className="flex-1" id="searchKeyword" placeholder={en ? "Search by result ID, project, or company" : "결과 ID, 프로젝트명, 기관명 검색"} value={draft.searchKeyword} onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))} />
                <button className="gov-btn gov-btn-primary" type="submit">{en ? "Search" : "검색"}</button>
              </div>
            </div>
          </form>
        </CollectionResultPanel>

        <section className="gov-card" data-help-id="emission-validate-links">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {actionLinks.map((link, index) => (
              <a className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4 transition hover:border-[var(--kr-gov-blue)] hover:bg-blue-50" href={withReturnUrl(stringOf(link, "url"), returnUrl)} key={`${stringOf(link, "label")}-${index}`}>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">{stringOf(link, "icon")}</span>
                  <div>
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(link, "label")}</p>
                    <p className="mt-1 break-all text-xs text-[var(--kr-gov-text-secondary)]">{withReturnUrl(stringOf(link, "url"), returnUrl)}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="emission-validate-table">
          <GridToolbar meta={en ? "Review verification status, assignee, and priority reasoning from one queue." : "검증 상태, 담당자, 우선순위 사유를 하나의 대기열에서 함께 검토합니다."} title={en ? "Verification Queue" : "검증 대기열"} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-6 py-4 text-center w-16">{en ? "No." : "번호"}</th>
                  <th className="px-6 py-4">{en ? "Result / Project" : "결과 / 프로젝트"}</th>
                  <th className="px-6 py-4">{en ? "Company" : "기관명"}</th>
                  <th className="px-6 py-4">{en ? "Priority" : "우선순위"}</th>
                  <th className="px-6 py-4">{en ? "Verification" : "검증 상태"}</th>
                  <th className="px-6 py-4">{en ? "Assignee" : "담당자"}</th>
                  <th className="px-6 py-4">{en ? "Reason" : "사유"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Action" : "관리"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {queueRows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-gray-500" colSpan={8}>{en ? "No verification items found." : "조회된 검증 대상이 없습니다."}</td>
                  </tr>
                ) : queueRows.map((row, index) => {
                  const rowNo = Number(page?.totalCount || 0) - ((currentPage - 1) * Number(page?.pageSize || 8) + index);
                  const isSelected = filters.resultId && stringOf(row, "resultId") === filters.resultId;
                  return (
                    <tr className={`${isSelected ? "bg-blue-50/80" : "hover:bg-gray-50/50"} transition-colors`} key={`${stringOf(row, "resultId")}-${index}`}>
                      <td className="px-6 py-4 text-center text-gray-500">{rowNo}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "projectName")}</div>
                          {isSelected ? (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                              {en ? "Selected" : "선택됨"}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">{stringOf(row, "resultId")} · {stringOf(row, "calculatedAt")}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-[var(--kr-gov-text-secondary)]">{stringOf(row, "companyName")}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${priorityToneClass(stringOf(row, "priorityCode"))}`}>{stringOf(row, "priorityLabel")}</span>
                        <div className="mt-2 text-xs text-gray-500">{stringOf(row, "totalEmission")}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${verificationToneClass(stringOf(row, "verificationStatusCode"))}`}>{stringOf(row, "verificationStatusLabel")}</span>
                      </td>
                      <td className="px-6 py-4">{stringOf(row, "assignee")}</td>
                      <td className="px-6 py-4 text-[13px] leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "priorityReason")}</td>
                      <td className="px-6 py-4 text-center">
                        <a className="inline-flex rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[var(--kr-gov-blue-hover)]" href={withReturnUrl(stringOf(row, "detailUrl"), returnUrl)}>
                          {stringOf(row, "actionLabel")}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <MemberPagination className="border-t-0" currentPage={currentPage} onPageChange={(pageIndex) => setFilters((current) => ({ ...current, pageIndex }))} totalPages={totalPages} />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]" data-help-id="emission-validate-policy">
          <DiagnosticCard
            description={en ? "Use the same thresholds across operators before approval or rejection." : "승인 또는 반려 전에 운영자 간 동일한 우선순위 기준을 적용합니다."}
            status={en ? "Governed" : "운영 기준"}
            statusTone="healthy"
            title={en ? "Priority Legend" : "우선순위 기준"}
          >
            <div className="space-y-3">
              {priorityLegend.map((row, index) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3" key={`${stringOf(row, "code")}-${index}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "label")}</p>
                    <code className="text-xs font-bold text-[var(--kr-gov-blue)]">{stringOf(row, "code")}</code>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "description")}</p>
                </div>
              ))}
            </div>
          </DiagnosticCard>

          <DiagnosticCard
            description={en ? "These operator checks define what must be reviewed before the final verification action." : "최종 검증 조치 전에 반드시 검토해야 하는 운영 기준입니다."}
            status={en ? "Checklist" : "체크리스트"}
            statusTone="warning"
            title={en ? "Verification Policies" : "검증 정책"}
          >
            <div className="space-y-3">
              {policyRows.map((row, index) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3" key={`${stringOf(row, "title")}-${index}`}>
                  <p className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "title")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "description")}</p>
                </div>
              ))}
            </div>
          </DiagnosticCard>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
