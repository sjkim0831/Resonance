import { useEffect, useMemo, useState } from "react";
import { readBootstrappedCertificateReviewPageData } from "../../lib/api/bootstrap";
import { fetchCertificateReviewPage } from "../../lib/api/member";
import type { CertificateReviewPagePayload } from "../../lib/api/memberTypes";
import { buildLocalizedPath, getSearchParam, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { SummaryMetricCard } from "../admin-ui/common";
import { AdminListPageFrame, AdminSummaryStrip } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, MemberButton, MemberPagination, PageStatusNotice } from "../member/common";

type ReviewFilters = {
  searchKeyword: string;
  status: string;
  certificateType: string;
  applicationId: string;
  pageIndex: number;
};

const DEFAULT_FILTERS: ReviewFilters = {
  searchKeyword: "",
  status: "ALL",
  certificateType: "ALL",
  applicationId: "",
  pageIndex: 1
};

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toRows(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function readInitialFilters(): ReviewFilters {
  const pageIndex = Number(getSearchParam("pageIndex") || DEFAULT_FILTERS.pageIndex);
  return {
    searchKeyword: getSearchParam("searchKeyword"),
    status: getSearchParam("status") || DEFAULT_FILTERS.status,
    certificateType: getSearchParam("certificateType") || DEFAULT_FILTERS.certificateType,
    applicationId: getSearchParam("applicationId"),
    pageIndex: Number.isFinite(pageIndex) && pageIndex > 0 ? pageIndex : DEFAULT_FILTERS.pageIndex
  };
}

export function CertificateReviewMigrationPage() {
  const en = isEnglish();
  const initialPayload = useMemo(() => readBootstrappedCertificateReviewPageData(), []);
  const [filters, setFilters] = useState<ReviewFilters>(readInitialFilters);
  const [draft, setDraft] = useState<ReviewFilters>(readInitialFilters);
  const [result, setResult] = useState<CertificateReviewPagePayload | null>(initialPayload);
  const [loading, setLoading] = useState(!initialPayload);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const bootstrapped = initialPayload;
    const skipFetch = bootstrapped
      ? safeString(bootstrapped.searchKeyword) === filters.searchKeyword
        && (safeString(bootstrapped.status) || DEFAULT_FILTERS.status) === filters.status
        && (safeString(bootstrapped.certificateType) || DEFAULT_FILTERS.certificateType) === filters.certificateType
        && safeString(bootstrapped.applicationId) === filters.applicationId
        && Number(bootstrapped.pageIndex || 1) === filters.pageIndex
      : false;
    if (skipFetch) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setError("");
    fetchCertificateReviewPage(filters)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setResult(data);
        setDraft({
          searchKeyword: safeString(data.searchKeyword),
          status: safeString(data.status) || DEFAULT_FILTERS.status,
          certificateType: safeString(data.certificateType) || DEFAULT_FILTERS.certificateType,
          applicationId: safeString(data.applicationId),
          pageIndex: Number(data.pageIndex || 1)
        });
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : (en ? "Failed to load certificate review page." : "발급 검토 화면을 불러오지 못했습니다."));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [en, filters]);

  const rows = useMemo(() => toRows(result?.certificateReviewRows), [result?.certificateReviewRows]);
  const summaryRows = useMemo(() => toRows(result?.certificateReviewSummary), [result?.certificateReviewSummary]);
  const guidanceRows = useMemo(() => toRows(result?.certificateReviewGuidance), [result?.certificateReviewGuidance]);
  const selectedRequestId = safeString(result?.selectedRequestId);

  return (
    <AdminPageShell
      actions={(
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">
          {en ? `${Number(result?.totalCount || 0).toLocaleString()} review items` : `총 ${Number(result?.totalCount || 0).toLocaleString()}건`}
        </span>
      )}
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Certificate" : "인증" },
        { label: en ? "Issuance Review" : "발급 검토" }
      ]}
      subtitle={en
        ? "Review certificate issuance requests, supporting evidence, and operator handoff readiness in one queue."
        : "인증서 발급 요청의 증빙, 검토 상태, 승인 단계 이관 준비도를 한 화면에서 확인합니다."}
      title={en ? "Certificate Issuance Review" : "발급 검토"}
      loading={loading && !result}
      loadingLabel={en ? "Loading certificate review page." : "발급 검토 화면을 불러오는 중입니다."}
    >
      {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
      {!loading && result && result.canViewCertificateReview === false ? (
        <PageStatusNotice tone="warning">
          {en ? "Your account cannot view this certificate review queue." : "현재 계정으로는 발급 검토 화면을 조회할 수 없습니다."}
        </PageStatusNotice>
      ) : null}

      <AdminListPageFrame>
        <AdminSummaryStrip data-help-id="certificate-review-summary">
          {summaryRows.map((item, index) => (
            <SummaryMetricCard
              key={`${safeString(item.metricKey) || "metric"}-${index}`}
              title={safeString(en ? item.labelEn : item.label) || "-"}
              value={safeString(item.value) || "-"}
              description={safeString(en ? item.descriptionEn : item.description)}
              accentClassName={safeString(item.accentClassName) || "text-[var(--kr-gov-blue)]"}
              surfaceClassName={safeString(item.surfaceClassName) || "bg-[#f8fbff]"}
            />
          ))}
        </AdminSummaryStrip>

        <section className="gov-card overflow-hidden" data-help-id="certificate-review-search">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold">{en ? "Search Conditions" : "검색 조건"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Filter issuance review work by status, certificate type, request id, or company keyword."
                    : "상태, 인증 유형, 요청번호, 회원사 키워드 기준으로 발급 검토 대상을 좁힙니다."}
                </p>
              </div>
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                {en
                  ? `Page ${Number(result?.pageIndex || 1)} / ${Number(result?.totalPages || 1)}`
                  : `현재 페이지 ${Number(result?.pageIndex || 1)} / ${Number(result?.totalPages || 1)}`}
              </span>
            </div>
          </div>
          <div className="grid gap-4 px-6 py-6 lg:grid-cols-[220px_220px_minmax(0,1fr)_220px]">
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "상태"}</span>
              <AdminSelect value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="REQUESTED">{en ? "Pending Review" : "검토 대기"}</option>
                <option value="UNDER_REVIEW">{en ? "Under Review" : "검토 중"}</option>
                <option value="REJECTED">{en ? "Revision Requested" : "보완 요청"}</option>
                <option value="READY">{en ? "Ready to Issue" : "발급 가능"}</option>
              </AdminSelect>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Certificate Type" : "인증 유형"}</span>
              <AdminSelect value={draft.certificateType} onChange={(event) => setDraft((current) => ({ ...current, certificateType: event.target.value }))}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="CCUS">{en ? "CCUS Certificate" : "CCUS 인증서"}</option>
                <option value="REPORT">{en ? "Emission Report" : "배출량 보고서"}</option>
                <option value="REC">{en ? "REC Duplicate Check" : "REC 중복 확인"}</option>
              </AdminSelect>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
              <AdminInput
                placeholder={en ? "Request id, company, applicant, reviewer" : "요청번호, 회원사명, 신청자, 검토자 검색"}
                value={draft.searchKeyword}
                onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))}
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Focused Request" : "선택 요청번호"}</span>
              <AdminInput
                placeholder={en ? "Request id" : "요청번호"}
                value={draft.applicationId}
                onChange={(event) => setDraft((current) => ({ ...current, applicationId: event.target.value }))}
              />
            </label>
          </div>
          <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                {selectedRequestId
                  ? (en ? `Current focus: ${selectedRequestId}` : `현재 선택 요청번호: ${selectedRequestId}`)
                  : (en ? "Select a request id to align follow-up review work." : "후속 검토 기준을 맞추기 위해 요청번호를 선택해 둘 수 있습니다.")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <MemberButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setDraft(DEFAULT_FILTERS);
                    setFilters(DEFAULT_FILTERS);
                  }}
                >
                  {en ? "Reset" : "초기화"}
                </MemberButton>
                <MemberButton
                  type="button"
                  variant="primary"
                  onClick={() => setFilters({ ...draft, pageIndex: 1 })}
                >
                  {en ? "Search" : "조회"}
                </MemberButton>
              </div>
            </div>
          </div>
        </section>

        <section className="gov-card overflow-hidden" data-help-id="certificate-review-table">
          <div className="border-b border-[var(--kr-gov-border-light)] bg-gray-50 px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold">{en ? "Issuance Review Queue" : "발급 검토 대기열"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Compare review status, evidence, reviewer, and handoff readiness before approval."
                    : "승인 단계 이관 전 검토 상태, 증빙, 담당자, 이관 준비도를 함께 비교합니다."}
                </p>
              </div>
              <span className="text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? `${Number(result?.totalCount || 0).toLocaleString()} items` : `총 ${Number(result?.totalCount || 0).toLocaleString()}건`}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1440px] text-sm">
              <thead className="border-b border-[var(--kr-gov-border-light)] bg-gray-50 text-left text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-4 py-4 font-bold">{en ? "Request Id" : "요청번호"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Company / Applicant" : "회원사 / 신청자"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Certificate Type" : "인증 유형"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Requested At" : "접수 시각"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Reviewer" : "검토 담당"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Issue Summary" : "검토 포인트"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Evidence / Checklist" : "증빙 / 체크리스트"}</th>
                  <th className="px-4 py-4 text-center font-bold">{en ? "Status" : "상태"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Action" : "바로가기"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-gray-500" colSpan={9}>
                      {en ? "No certificate review items matched the current search." : "현재 검색 조건에 맞는 발급 검토 대상이 없습니다."}
                    </td>
                  </tr>
                ) : rows.map((row, index) => {
                  const evidenceFiles = toStringList(row.evidenceFiles);
                  const checklist = toStringList(en ? row.checklistEn : row.checklist);
                  return (
                    <tr className="align-top hover:bg-gray-50/70" key={`${safeString(row.requestId) || "row"}-${index}`}>
                      <td className="px-4 py-4">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{safeString(row.requestId) || "-"}</div>
                        <div className="mt-1 text-xs text-gray-500">{safeString(row.relatedCount) || "-"}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{safeString(en ? row.companyNameEn : row.companyName) || "-"}</div>
                        <div className="mt-1 text-xs text-gray-500">{safeString(en ? row.applicantNameEn : row.applicantName) || "-"}</div>
                      </td>
                      <td className="px-4 py-4">{safeString(en ? row.certificateTypeEn : row.certificateType) || "-"}</td>
                      <td className="px-4 py-4">{safeString(row.requestedAt) || "-"}</td>
                      <td className="px-4 py-4">{safeString(en ? row.reviewerEn : row.reviewer) || "-"}</td>
                      <td className="px-4 py-4">
                        <p className="text-[var(--kr-gov-text-primary)]">{safeString(en ? row.issueSummaryEn : row.issueSummary) || "-"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Evidence" : "증빙"}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {evidenceFiles.map((file, fileIndex) => (
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700" key={`${safeString(row.requestId)}-file-${fileIndex}`}>
                                  {typeof file === "string" ? file : "-"}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Checklist" : "체크리스트"}</p>
                            <ul className="mt-1 space-y-1 text-xs text-gray-600">
                              {checklist.map((item, checklistIndex) => (
                                <li key={`${safeString(row.requestId)}-check-${checklistIndex}`}>- {typeof item === "string" ? item : "-"}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${safeString(row.statusClassName) || "bg-slate-100 text-slate-700"}`}>
                          {safeString(en ? row.statusLabelEn : row.statusLabelKo) || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <a
                          className="inline-flex rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[var(--kr-gov-blue-hover)]"
                          href={safeString(en ? row.detailUrlEn : row.detailUrl)}
                        >
                          {en ? "Open" : "열기"}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <MemberPagination
            className="border-t-0"
            currentPage={Number(result?.pageIndex || 1)}
            totalPages={Number(result?.totalPages || 1)}
            onPageChange={(pageIndex) => setFilters((current) => ({ ...current, pageIndex }))}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          {guidanceRows.map((item, index) => (
            <article className="gov-card" key={`${safeString(item.title) || "guidance"}-${index}`}>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">{safeString(item.icon) || "fact_check"}</span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{safeString(item.title) || "-"}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{safeString(item.description) || "-"}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      </AdminListPageFrame>
    </AdminPageShell>
  );
}
