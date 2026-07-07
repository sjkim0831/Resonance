import { useEffect, useMemo, useState } from "react";
import { fetchCertificatePendingPage } from "../../lib/api/member";
import type { CertificatePendingPagePayload } from "../../lib/api/memberTypes";
import { buildLocalizedPath, getSearchParam, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { SummaryMetricCard } from "../admin-ui/common";
import { AdminInput, AdminSelect, MemberButton, MemberPagination, PageStatusNotice } from "../member/common";
import { AdminListPageFrame, AdminSummaryStrip } from "../admin-ui/pageFrames";

type PendingFilters = {
  searchKeyword: string;
  certificateType: string;
  processStatus: string;
  applicationId: string;
  insttId: string;
  pageIndex: number;
};

const DEFAULT_FILTERS: PendingFilters = {
  searchKeyword: "",
  certificateType: "",
  processStatus: "PENDING",
  applicationId: "",
  insttId: "",
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

function readInitialFilters(): PendingFilters {
  const pageIndex = Number(getSearchParam("pageIndex") || DEFAULT_FILTERS.pageIndex);
  return {
    searchKeyword: getSearchParam("searchKeyword"),
    certificateType: getSearchParam("certificateType"),
    processStatus: getSearchParam("processStatus") || DEFAULT_FILTERS.processStatus,
    applicationId: getSearchParam("applicationId"),
    insttId: getSearchParam("insttId"),
    pageIndex: Number.isFinite(pageIndex) && pageIndex > 0 ? pageIndex : DEFAULT_FILTERS.pageIndex
  };
}

export function CertificatePendingMigrationPage() {
  const en = isEnglish();
  const [filters, setFilters] = useState<PendingFilters>(readInitialFilters);
  const [draft, setDraft] = useState<PendingFilters>(readInitialFilters);
  const [result, setResult] = useState<CertificatePendingPagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchCertificatePendingPage(filters)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setResult(data);
        setDraft({
          searchKeyword: safeString(data.searchKeyword),
          certificateType: safeString(data.certificateType),
          processStatus: safeString(data.processStatus) || DEFAULT_FILTERS.processStatus,
          applicationId: safeString(data.applicationId),
          insttId: safeString(data.insttId),
          pageIndex: Number(data.pageIndex || 1)
        });
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : (en ? "Failed to load certificate queue." : "인증서 대기 목록을 불러오지 못했습니다."));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [en, filters]);

  const rows = useMemo(() => toRows(result?.certificatePendingRows), [result?.certificatePendingRows]);
  const summaryRows = useMemo(() => toRows(result?.certificatePendingSummary), [result?.certificatePendingSummary]);
  const focusedApplicationId = safeString(result?.selectedApplicationId) || safeString(result?.applicationId);
  const focusedInsttId = safeString(result?.selectedInsttId) || safeString(result?.insttId);
  const focusedInsttName = safeString(en ? result?.selectedInsttNameEn : result?.selectedInsttName);

  return (
    <AdminPageShell
      actions={(
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">
          {en ? `${Number(result?.totalCount || 0).toLocaleString()} requests` : `총 ${Number(result?.totalCount || 0).toLocaleString()}건`}
        </span>
      )}
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Certificate" : "인증" },
        { label: en ? "Pending Queue" : "발급 대기 목록" }
      ]}
      subtitle={en
        ? "Review certificate issuance requests, payment readiness, and current reviewer ownership in one queue."
        : "인증서 발급 신청 건의 수수료, 검토 담당자, 현재 진행 상태를 한 화면에서 확인합니다."}
      title={en ? "Certificate Pending Queue" : "인증서 발급 대기 목록"}
      loading={loading && !result}
      loadingLabel={en ? "Loading certificate pending queue." : "인증서 발급 대기 목록을 불러오는 중입니다."}
    >
      {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
      {!loading && result && result.canViewCertificatePending === false ? (
        <PageStatusNotice tone="warning">
          {en ? "Your account cannot view this certificate queue." : "현재 계정으로는 인증서 발급 대기 목록을 조회할 수 없습니다."}
        </PageStatusNotice>
      ) : null}

      <AdminListPageFrame>
        <AdminSummaryStrip data-help-id="certificate-pending-summary">
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

        <section className="gov-card overflow-hidden" data-help-id="certificate-pending-search">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold">{en ? "Search Conditions" : "검색 조건"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Filter the issuance queue by certificate type, processing state, and applicant."
                    : "인증 유형, 처리 상태, 신청 회사 또는 신청번호로 대기열을 좁힙니다."}
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
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Certificate Type" : "인증 유형"}</span>
              <AdminSelect value={draft.certificateType} onChange={(event) => setDraft((current) => ({ ...current, certificateType: event.target.value }))}>
                <option value="">{en ? "All" : "전체"}</option>
                <option value="CCUS">{en ? "CCUS Certificate" : "CCUS 인증서"}</option>
                <option value="REPORT">{en ? "Emission Report" : "배출량 보고서"}</option>
                <option value="REC">{en ? "REC Duplicate Check" : "REC 중복 확인"}</option>
              </AdminSelect>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Process Status" : "처리 상태"}</span>
              <AdminSelect value={draft.processStatus} onChange={(event) => setDraft((current) => ({ ...current, processStatus: event.target.value }))}>
                <option value="">{en ? "All" : "전체"}</option>
                <option value="PENDING">{en ? "Pending Review" : "검토 대기"}</option>
                <option value="FEE_WAIT">{en ? "Waiting Payment" : "수수료 대기"}</option>
                <option value="IN_REVIEW">{en ? "In Review" : "심사중"}</option>
                <option value="OBJECTION">{en ? "Objection" : "이의신청"}</option>
              </AdminSelect>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
              <AdminInput
                placeholder={en ? "Application no., company, site, reviewer" : "신청번호, 회원사명, 배출지, 검토자 검색"}
                value={draft.searchKeyword}
                onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))}
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Focused Application" : "집중 신청번호"}</span>
              <AdminInput
                placeholder={en ? "Application no." : "신청번호"}
                value={draft.applicationId}
                onChange={(event) => setDraft((current) => ({ ...current, applicationId: event.target.value }))}
              />
            </label>
          </div>
          <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                {focusedApplicationId
                  ? (en ? `Current focus request: ${focusedApplicationId}` : `현재 집중 신청번호: ${focusedApplicationId}`)
                  : focusedInsttId
                    ? (en
                      ? `Focused institution: ${focusedInsttName || focusedInsttId} (${focusedInsttId})`
                      : `현재 집중 기관: ${focusedInsttName || focusedInsttId} (${focusedInsttId})`)
                    : (en
                      ? "Use the same card density and table structure as other admin list pages."
                      : "다른 관리자 목록형 화면과 동일한 검색 카드 밀도와 표 구조를 유지합니다.")}
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

        <section className="gov-card overflow-hidden" data-help-id="certificate-pending-table">
          <div className="border-b border-[var(--kr-gov-border-light)] bg-gray-50 px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold">{en ? "Pending Applications" : "인증서 발급 대기 신청 목록"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "See issuance readiness, payment completion, objection risk, and the current review owner."
                    : "발급 가능 여부, 수수료 납부 상태, 이의신청 위험, 현재 검토 담당자를 함께 확인합니다."}
                </p>
              </div>
              <span className="text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? `${Number(result?.totalCount || 0).toLocaleString()} items`
                  : `총 ${Number(result?.totalCount || 0).toLocaleString()}건`}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-sm">
              <thead className="border-b border-[var(--kr-gov-border-light)] bg-gray-50 text-left text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-4 py-4 font-bold">{en ? "Application No." : "신청번호"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Applicant" : "신청 회원사"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Certificate Type" : "인증 유형"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Target Site" : "대상 배출지"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Submitted" : "신청일"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Fee" : "수수료"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Reviewer" : "검토 담당"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "SLA" : "SLA"}</th>
                  <th className="px-4 py-4 text-center font-bold">{en ? "Status" : "상태"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Action" : "바로가기"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-gray-500" colSpan={10}>
                      {en ? "No pending certificate requests matched the current search." : "현재 검색 조건에 맞는 인증서 발급 대기 건이 없습니다."}
                    </td>
                  </tr>
                ) : rows.map((row, index) => (
                  <tr className="align-top hover:bg-gray-50/70" key={`${safeString(row.applicationId) || "row"}-${index}`}>
                    <td className="px-4 py-4">
                      <div className="font-bold text-[var(--kr-gov-text-primary)]">{safeString(row.applicationId) || "-"}</div>
                      <div className="mt-1 text-xs text-gray-500">{safeString(en ? row.reportPeriodEn : row.reportPeriod) || "-"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-[var(--kr-gov-text-primary)]">{safeString(en ? row.companyNameEn : row.companyName) || "-"}</div>
                      <div className="mt-1 text-xs text-gray-500">{safeString(row.businessNumber) || "-"}</div>
                    </td>
                    <td className="px-4 py-4">{safeString(en ? row.certificateTypeLabelEn : row.certificateTypeLabel) || "-"}</td>
                    <td className="px-4 py-4">
                      <div>{safeString(en ? row.siteNameEn : row.siteName) || "-"}</div>
                      <div className="mt-1 text-xs text-gray-500">{safeString(en ? row.evidenceSummaryEn : row.evidenceSummary) || "-"}</div>
                    </td>
                    <td className="px-4 py-4">{safeString(row.submittedAt) || "-"}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold">{safeString(en ? row.feeStatusEn : row.feeStatus) || "-"}</div>
                      <div className="mt-1 text-xs text-gray-500">{safeString(en ? row.feeMemoEn : row.feeMemo) || "-"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div>{safeString(en ? row.reviewerNameEn : row.reviewerName) || "-"}</div>
                      <div className="mt-1 text-xs text-gray-500">{safeString(en ? row.reviewerTeamEn : row.reviewerTeam) || "-"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold">{safeString(row.slaDueAt) || "-"}</div>
                      <div className="mt-1 text-xs text-gray-500">{safeString(en ? row.slaMemoEn : row.slaMemo) || "-"}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${safeString(row.statusBadgeClass) || "bg-slate-100 text-slate-700"}`}>
                        {safeString(en ? row.processStatusLabelEn : row.processStatusLabel) || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <a
                        className="inline-flex items-center gap-1 text-xs font-bold text-[var(--kr-gov-blue)] hover:underline"
                        href={safeString(en ? row.detailUrlEn : row.detailUrl) || "#"}
                      >
                        {en ? "Open Review" : "검토 화면 열기"}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MemberPagination
            currentPage={Number(result?.pageIndex || 1)}
            totalPages={Number(result?.totalPages || 1)}
            onPageChange={(pageNumber) => setFilters((current) => ({ ...current, pageIndex: pageNumber }))}
          />
        </section>
      </AdminListPageFrame>
    </AdminPageShell>
  );
}
