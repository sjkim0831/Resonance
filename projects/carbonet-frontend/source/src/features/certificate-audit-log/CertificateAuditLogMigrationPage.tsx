import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { fetchCertificateAuditLogPage } from "../../lib/api/ops";
import { readBootstrappedCertificateAuditLogPageData } from "../../lib/api/bootstrap";
import type { CertificateAuditLogPagePayload } from "../../lib/api/opsTypes";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { SummaryMetricCard } from "../admin-ui/common";
import { AdminListPageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberPagination, MemberSectionToolbar } from "../member/common";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  auditType: string;
  status: string;
  certificateType: string;
  startDate: string;
  endDate: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  searchKeyword: "",
  auditType: "ALL",
  status: "ALL",
  certificateType: "ALL",
  startDate: "",
  endDate: ""
};

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  const params = new URLSearchParams(window.location.search);
  return {
    pageIndex: Number(params.get("pageIndex") || "1") || 1,
    searchKeyword: params.get("searchKeyword") || "",
    auditType: params.get("auditType") || "ALL",
    status: params.get("status") || "ALL",
    certificateType: params.get("certificateType") || "ALL",
    startDate: params.get("startDate") || "",
    endDate: params.get("endDate") || ""
  };
}

function buildFilterSearchParams(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.pageIndex > 1) {
    params.set("pageIndex", String(filters.pageIndex));
  }
  if (filters.searchKeyword) {
    params.set("searchKeyword", filters.searchKeyword);
  }
  if (filters.auditType !== "ALL") {
    params.set("auditType", filters.auditType);
  }
  if (filters.status !== "ALL") {
    params.set("status", filters.status);
  }
  if (filters.certificateType !== "ALL") {
    params.set("certificateType", filters.certificateType);
  }
  if (filters.startDate) {
    params.set("startDate", filters.startDate);
  }
  if (filters.endDate) {
    params.set("endDate", filters.endDate);
  }
  return params;
}

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

function sameFilters(left: Filters, right: Filters) {
  return left.pageIndex === right.pageIndex
    && left.searchKeyword === right.searchKeyword
    && left.auditType === right.auditType
    && left.status === right.status
    && left.certificateType === right.certificateType
    && left.startDate === right.startDate
    && left.endDate === right.endDate;
}

function statusClassName(statusCode: string) {
  switch (statusCode) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700";
    case "REJECTED":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function riskClassName(riskCode: string) {
  switch (riskCode) {
    case "HIGH":
      return "bg-rose-100 text-rose-700";
    case "MEDIUM":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function summaryAccentClass(tone: string) {
  if (tone === "danger") {
    return "text-rose-700";
  }
  if (tone === "warning") {
    return "text-amber-700";
  }
  return "text-[var(--kr-gov-blue)]";
}

function summarySurfaceClass(tone: string) {
  if (tone === "danger") {
    return "bg-rose-50";
  }
  if (tone === "warning") {
    return "bg-amber-50";
  }
  return "bg-[#f8fbff]";
}

export function CertificateAuditLogMigrationPage() {
  const en = isEnglish();
  const initialPayload = useMemo(() => readBootstrappedCertificateAuditLogPageData(), []);
  const [filters, setFilters] = useState<Filters>(() => readInitialFilters());
  const [draftFilters, setDraftFilters] = useState<Filters>(() => readInitialFilters());
  const pageState = useAsyncValue<CertificateAuditLogPagePayload>(
    () => fetchCertificateAuditLogPage(filters),
    [filters.pageIndex, filters.searchKeyword, filters.auditType, filters.status, filters.certificateType, filters.startDate, filters.endDate],
    {
      initialValue: initialPayload,
      skipInitialLoad: Boolean(initialPayload),
      onSuccess(payload) {
        const next = {
          pageIndex: Number(payload.pageIndex || 1),
          searchKeyword: String(payload.searchKeyword || ""),
          auditType: String(payload.auditType || "ALL"),
          status: String(payload.status || "ALL"),
          certificateType: String(payload.certificateType || "ALL"),
          startDate: String(payload.startDate || ""),
          endDate: String(payload.endDate || "")
        };
        setFilters((current) => sameFilters(current, next) ? current : next);
        setDraftFilters((current) => sameFilters(current, next) ? current : next);
      }
    }
  );
  const page = pageState.value;
  const error = pageState.error;
  const rows = (page?.certificateAuditRows || []) as Array<Record<string, unknown>>;
  const summary = (page?.certificateAuditSummary || []) as Array<Record<string, unknown>>;
  const alerts = (page?.certificateAuditAlerts || []) as Array<Record<string, unknown>>;
  const currentPage = Math.max(1, Number(page?.pageIndex || 1));
  const totalPages = Math.max(1, Number(page?.totalPages || 1));
  const totalCount = Number(page?.totalCount || rows.length);

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "certificate-audit-log", {
      route: window.location.pathname,
      pageIndex: currentPage,
      totalCount,
      auditType: filters.auditType,
      status: filters.status,
      certificateType: filters.certificateType
    });
  }, [currentPage, filters.auditType, filters.certificateType, filters.status, page, totalCount]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const nextSearch = buildFilterSearchParams(filters).toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [filters]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    function handlePopState() {
      const nextFilters = readInitialFilters();
      setFilters((current) => sameFilters(current, nextFilters) ? current : nextFilters);
      setDraftFilters((current) => sameFilters(current, nextFilters) ? current : nextFilters);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function updateDraft<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(nextPageIndex = 1) {
    setFilters({
      ...draftFilters,
      pageIndex: nextPageIndex
    });
  }

  function resetFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Certificate" : "인증서" },
        { label: en ? "Audit Log" : "감사 로그" }
      ]}
      subtitle={en
        ? "Track issuance, reissue, renewal, and revocation decisions from one operator view."
        : "인증서 발급, 재발급, 갱신, 폐기 이력을 운영 관점에서 한 화면으로 추적합니다."}
      title={en ? "Certificate Audit Log" : "인증서 감사 로그"}
      loading={pageState.loading && !page && !error}
      loadingLabel={en ? "Loading certificate audit log." : "인증서 감사 로그를 불러오는 중입니다."}
    >
      <AdminListPageFrame>
        {error ? (
          <section className="rounded-[var(--kr-gov-radius)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {en ? "Failed to load certificate audit log." : "인증서 감사 로그를 불러오지 못했습니다."}
          </section>
        ) : null}

        <section className="gov-card" data-help-id="certificate-audit-log-filters">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              title={en ? "Search Conditions" : "검색 조건"}
              meta={en
                ? "Filter by request type, review status, certificate type, and request period."
                : "요청 유형, 처리 상태, 인증서 종류, 요청 기간으로 감사 범위를 좁힙니다."}
            />
          </div>
          <form
            className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters(1);
            }}
          >
            <div className="md:col-span-2">
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
              <AdminInput
                id="searchKeyword"
                placeholder={en ? "Request ID, certificate no., company, applicant" : "요청번호, 인증서번호, 회사명, 신청자"}
                value={draftFilters.searchKeyword}
                onChange={(event) => updateDraft("searchKeyword", event.target.value)}
              />
            </div>
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Request Type" : "요청 유형"}</span>
              <AdminSelect id="auditType" value={draftFilters.auditType} onChange={(event) => updateDraft("auditType", event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="ISSUE">{en ? "Issuance" : "신규 발급"}</option>
                <option value="REISSUE">{en ? "Reissue" : "재발급"}</option>
                <option value="RENEW">{en ? "Renewal" : "갱신"}</option>
                <option value="REVOKE">{en ? "Revocation" : "폐기"}</option>
              </AdminSelect>
            </div>
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "처리 상태"}</span>
              <AdminSelect id="status" value={draftFilters.status} onChange={(event) => updateDraft("status", event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="PENDING">{en ? "Pending" : "검토 대기"}</option>
                <option value="APPROVED">{en ? "Approved" : "승인"}</option>
                <option value="REJECTED">{en ? "Rejected" : "반려"}</option>
              </AdminSelect>
            </div>
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Certificate Type" : "인증서 종류"}</span>
              <AdminSelect id="certificateType" value={draftFilters.certificateType} onChange={(event) => updateDraft("certificateType", event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="EMISSION">{en ? "Emission" : "배출 인증서"}</option>
                <option value="JOINT">{en ? "Joint" : "공동인증서"}</option>
                <option value="CLOUD">{en ? "Cloud" : "클라우드 인증서"}</option>
              </AdminSelect>
            </div>
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Start Date" : "시작일"}</span>
              <AdminInput id="startDate" type="date" value={draftFilters.startDate} onChange={(event) => updateDraft("startDate", event.target.value)} />
            </div>
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "End Date" : "종료일"}</span>
              <AdminInput id="endDate" type="date" value={draftFilters.endDate} onChange={(event) => updateDraft("endDate", event.target.value)} />
            </div>
            <div className="md:col-span-4">
              <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? `Latest audit event: ${stringOf(page as Record<string, unknown>, "lastUpdated") || "-"}`
                    : `최신 감사 시각: ${stringOf(page as Record<string, unknown>, "lastUpdated") || "-"}`}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <MemberButton onClick={resetFilters} type="button" variant="secondary">
                    {en ? "Reset" : "초기화"}
                  </MemberButton>
                  <MemberButton icon="search" type="submit" variant="primary">
                    {en ? "Search" : "검색"}
                  </MemberButton>
                </div>
              </div>
            </div>
          </form>
        </section>

        <section className="space-y-4" data-help-id="certificate-audit-log-summary">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summary.map((item, index) => (
              <SummaryMetricCard
                key={`${stringOf(item, "label")}-${index}`}
                title={stringOf(item, "label")}
                value={stringOf(item, "value")}
                description={stringOf(item, "description")}
                accentClassName={summaryAccentClass(stringOf(item, "tone"))}
                surfaceClassName={summarySurfaceClass(stringOf(item, "tone"))}
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {alerts.map((item, index) => (
              <article
                key={`${stringOf(item, "title")}-${index}`}
                className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 text-sm ${
                  stringOf(item, "tone") === "danger"
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : stringOf(item, "tone") === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <p className="font-bold">{stringOf(item, "title")}</p>
                <p className="mt-2 leading-6">{stringOf(item, "body")}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="certificate-audit-log-table">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              title={(
                <span className="text-[15px] font-semibold text-[var(--kr-gov-text-primary)]">
                  {en ? "Total" : "전체"} <span className="text-[var(--kr-gov-blue)]">{totalCount.toLocaleString()}</span>{en ? "" : "건"}
                </span>
              )}
              meta={en
                ? "Review operator decisions, approval chain, and reason history in chronological order."
                : "운영자 처리 결과, 승인 체인, 사유 이력을 시간순으로 검토합니다."}
            />
          </div>
          <div className="overflow-x-auto">
            <AdminTable>
              <thead>
                <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                  <th className="w-16 px-6 py-4 text-center">{en ? "No." : "번호"}</th>
                  <th className="px-6 py-4">{en ? "Audit Time" : "감사 시각"}</th>
                  <th className="px-6 py-4">{en ? "Request / Certificate" : "요청 / 인증서"}</th>
                  <th className="px-6 py-4">{en ? "Company" : "회사"}</th>
                  <th className="px-6 py-4">{en ? "Applicant / Approver" : "신청자 / 승인자"}</th>
                  <th className="px-6 py-4">{en ? "Type" : "유형"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Status" : "상태"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Risk" : "위험도"}</th>
                  <th className="px-6 py-4">{en ? "Reason" : "사유"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-gray-500" colSpan={9}>
                      {en ? "No audit events found." : "조회된 감사 이력이 없습니다."}
                    </td>
                  </tr>
                ) : rows.map((row, index) => {
                  const rowNumber = totalCount - ((currentPage - 1) * Number(page?.pageSize || 10) + index);
                  return (
                    <tr className="transition-colors hover:bg-gray-50/60" key={`${stringOf(row, "requestId")}-${index}`}>
                      <td className="px-6 py-4 text-center text-gray-500">{rowNumber > 0 ? rowNumber : index + 1}</td>
                      <td className="px-6 py-4 text-gray-600">{stringOf(row, "auditAt") || "-"}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "requestId") || "-"}</div>
                        <div className="text-xs text-gray-500">{stringOf(row, "certificateNo") || "-"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-[var(--kr-gov-text-primary)]">{stringOf(row, "companyName") || "-"}</div>
                        <div className="text-xs text-gray-500">{stringOf(row, "companyId") || "-"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-[var(--kr-gov-text-primary)]">{stringOf(row, "applicantName") || "-"}</div>
                        <div className="text-xs text-gray-500">{stringOf(row, "applicantId") || "-"}</div>
                        <div className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">
                          {en ? "Approver" : "승인자"}: {stringOf(row, "approverName") || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-[var(--kr-gov-text-primary)]">{stringOf(row, "auditType") || "-"}</div>
                        <div className="text-xs text-gray-500">{stringOf(row, "certificateType") || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClassName(stringOf(row, "statusCode"))}`}>
                          {stringOf(row, "status") || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${riskClassName(stringOf(row, "riskLevelCode"))}`}>
                          {stringOf(row, "riskLevel") || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "reason") || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          </div>
          <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-4">
            <MemberPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(pageIndex) => applyFilters(pageIndex)}
            />
          </div>
        </section>
      </AdminListPageFrame>
    </AdminPageShell>
  );
}
