import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { readBootstrappedCertificateStatisticsPageData } from "../../lib/api/bootstrap";
import { fetchCertificateStatisticsPage } from "../../lib/api/trade";
import type { CertificateStatisticsPagePayload } from "../../lib/api/tradeTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import {
  AdminInput,
  AdminSelect,
  CollectionResultPanel,
  GridToolbar,
  MemberPagination,
  PageStatusNotice,
  SummaryMetricCard
} from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { stringOf } from "../admin-system/adminSystemShared";
import { MemberButton } from "../member/common";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  periodFilter: string;
  certificateType: string;
  issuanceStatus: string;
};

export function CertificateStatisticsMigrationPage() {
  const en = isEnglish();
  const initial = useMemo<Filters>(() => {
    const search = new URLSearchParams(window.location.search);
    return {
      pageIndex: Number(search.get("pageIndex") || "1") || 1,
      searchKeyword: search.get("searchKeyword") || "",
      periodFilter: search.get("periodFilter") || "LAST_12_MONTHS",
      certificateType: search.get("certificateType") || "",
      issuanceStatus: search.get("issuanceStatus") || ""
    };
  }, []);
  const initialPayload = useMemo(() => readBootstrappedCertificateStatisticsPageData(), []);
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const pageState = useAsyncValue<CertificateStatisticsPagePayload>(() => fetchCertificateStatisticsPage(filters), [filters.pageIndex, filters.searchKeyword, filters.periodFilter, filters.certificateType, filters.issuanceStatus], {
    initialValue: initialPayload,
    skipInitialLoad: Boolean(initialPayload),
    onSuccess(payload) {
      setDraft({
        pageIndex: Number(payload.pageIndex || 1),
        searchKeyword: String(payload.searchKeyword || ""),
        periodFilter: String(payload.periodFilter || "LAST_12_MONTHS"),
        certificateType: String(payload.certificateType || ""),
        issuanceStatus: String(payload.issuanceStatus || "")
      });
    }
  });
  const page = pageState.value;
  const monthlyRows = (page?.monthlyRows || []) as Array<Record<string, string>>;
  const certificateTypeRows = (page?.certificateTypeRows || []) as Array<Record<string, string>>;
  const institutionRows = (page?.institutionRows || []) as Array<Record<string, string>>;
  const alertRows = (page?.alertRows || []) as Array<Record<string, string>>;
  const currentPage = Number(page?.pageIndex || 1);
  const totalPages = Number(page?.totalPages || 1);
  const maxMonthlyIssued = Math.max(1, ...monthlyRows.map((item) => Number(stringOf(item, "issuedCount") || "0")));

  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.pageIndex > 1) next.set("pageIndex", String(filters.pageIndex));
    if (filters.searchKeyword) next.set("searchKeyword", filters.searchKeyword);
    if (filters.periodFilter && filters.periodFilter !== "LAST_12_MONTHS") next.set("periodFilter", filters.periodFilter);
    if (filters.certificateType) next.set("certificateType", filters.certificateType);
    if (filters.issuanceStatus) next.set("issuanceStatus", filters.issuanceStatus);
    const query = next.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [filters]);

  useEffect(() => {
    logGovernanceScope("PAGE", "certificate-statistics", {
      language: en ? "en" : "ko",
      route: window.location.pathname,
      searchKeyword: filters.searchKeyword,
      periodFilter: filters.periodFilter,
      certificateType: filters.certificateType,
      issuanceStatus: filters.issuanceStatus,
      monthlyRowCount: monthlyRows.length,
      institutionRowCount: institutionRows.length
    });
    logGovernanceScope("COMPONENT", "certificate-statistics-dashboard", {
      totalIssuedCount: Number(page?.totalIssuedCount || 0),
      totalPendingCount: Number(page?.pendingCount || 0),
      totalRejectedCount: Number(page?.rejectedCount || 0),
      totalPages
    });
  }, [en, filters.certificateType, filters.issuanceStatus, filters.periodFilter, filters.searchKeyword, institutionRows.length, monthlyRows.length, page?.pendingCount, page?.rejectedCount, page?.totalIssuedCount, totalPages]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Certification" : "인증" },
        { label: en ? "Certificate Statistics" : "인증서 통계" }
      ]}
      title={en ? "Certificate Statistics" : "인증서 통계"}
      subtitle={en ? "Monitor issuance throughput, pending backlog, institution-level delivery pace, and re-issuance concentration in one workspace." : "발급 처리량, 대기 백로그, 기관별 처리 속도, 재발급 집중도를 한 화면에서 점검합니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-5" data-help-id="certificate-statistics-summary">
          <SummaryMetricCard title={en ? "Issued" : "발급 완료"} value={Number(page?.totalIssuedCount || 0).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-amber-700" surfaceClassName="bg-amber-50" title={en ? "Pending" : "대기 건수"} value={Number(page?.pendingCount || 0).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-red-700" surfaceClassName="bg-red-50" title={en ? "Rejected" : "반려 건수"} value={Number(page?.rejectedCount || 0).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-sky-700" surfaceClassName="bg-sky-50" title={en ? "Re-issued" : "재발급"} value={Number(page?.reissuedCount || 0).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-emerald-700" surfaceClassName="bg-emerald-50" title={en ? "Issuance Rate" : "발급률"} value={`${stringOf(page as Record<string, unknown>, "issuanceRate")}%`} description={`${stringOf(page as Record<string, unknown>, "avgLeadDays")}${en ? " days avg." : "일 평균"}`} />
        </section>

        <CollectionResultPanel
          data-help-id="certificate-statistics-filter"
          title={en ? "Statistics Filter" : "통계 조회 조건"}
          description={en ? "Slice the issuance dashboard by period, issuance type, process state, and institution keyword." : "기간, 발급 유형, 처리 상태, 기관 키워드 기준으로 인증서 통계를 좁혀 봅니다."}
          icon="monitoring"
        >
          <form className="grid grid-cols-1 gap-4 lg:grid-cols-5" onSubmit={(event) => {
            event.preventDefault();
            setFilters({ ...draft, pageIndex: 1 });
          }}>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="periodFilter">{en ? "Period" : "기간"}</label>
              <AdminSelect id="periodFilter" value={draft.periodFilter} onChange={(event) => setDraft((current) => ({ ...current, periodFilter: event.target.value }))}>
                <option value="LAST_12_MONTHS">{en ? "Last 12 months" : "최근 12개월"}</option>
                <option value="LAST_6_MONTHS">{en ? "Last 6 months" : "최근 6개월"}</option>
                <option value="Q1_2026">{en ? "2026 Q1" : "2026년 1분기"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="certificateType">{en ? "Certificate Type" : "인증서 유형"}</label>
              <AdminSelect id="certificateType" value={draft.certificateType} onChange={(event) => setDraft((current) => ({ ...current, certificateType: event.target.value }))}>
                <option value="">{en ? "All" : "전체"}</option>
                <option value="EMISSION">{en ? "Emission Certificate" : "배출권 인증서"}</option>
                <option value="REDUCTION">{en ? "Reduction Confirmation" : "감축실적 확인서"}</option>
                <option value="REC">{en ? "REC Verification" : "REC 검증서"}</option>
                <option value="COMPLIANCE">{en ? "Compliance Report" : "준수 확인서"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="issuanceStatus">{en ? "Status" : "처리 상태"}</label>
              <AdminSelect id="issuanceStatus" value={draft.issuanceStatus} onChange={(event) => setDraft((current) => ({ ...current, issuanceStatus: event.target.value }))}>
                <option value="">{en ? "All" : "전체"}</option>
                <option value="ISSUED">{en ? "Issued" : "발급 완료"}</option>
                <option value="PENDING">{en ? "Pending" : "대기"}</option>
                <option value="REJECTED">{en ? "Rejected" : "반려"}</option>
                <option value="REISSUED">{en ? "Re-issued focus" : "재발급 중심"}</option>
              </AdminSelect>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="searchKeyword">{en ? "Institution Keyword" : "기관 키워드"}</label>
              <div className="flex gap-2">
                <AdminInput className="flex-1" id="searchKeyword" placeholder={en ? "Institution, operator, or site keyword" : "기관명, 담당자, 배출지 키워드"} value={draft.searchKeyword} onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))} />
                <button className="gov-btn gov-btn-primary" type="submit">{en ? "Search" : "조회"}</button>
              </div>
            </div>
          </form>
        </CollectionResultPanel>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="gov-card" data-help-id="certificate-statistics-trend">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[var(--kr-gov-text-primary)]">{en ? "Issuance Trend" : "월별 발급 추이"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Issued, re-issued, and rejected volumes for the selected period." : "선택한 기간의 발급 완료, 재발급, 반려 물량을 월 단위로 확인합니다."}</p>
              </div>
              <div className="flex gap-2">
                <MemberButton icon="pending_actions" size="xs" type="button" variant="secondary" onClick={() => { window.location.href = buildLocalizedPath("/admin/certificate/pending_list", "/en/admin/certificate/pending_list"); }}>{en ? "Pending Queue" : "대기열"}</MemberButton>
                <MemberButton icon="fact_check" size="xs" type="button" variant="secondary" onClick={() => { window.location.href = buildLocalizedPath("/admin/certificate/review", "/en/admin/certificate/review"); }}>{en ? "Review" : "발급 검토"}</MemberButton>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {monthlyRows.map((item) => {
                const issuedHeight = Math.max(18, Math.round((Number(stringOf(item, "issuedCount") || "0") / maxMonthlyIssued) * 148));
                const reissuedHeight = Math.max(8, Math.round((Number(stringOf(item, "reissuedCount") || "0") / maxMonthlyIssued) * 72));
                const rejectedHeight = Math.max(8, Math.round((Number(stringOf(item, "rejectedCount") || "0") / maxMonthlyIssued) * 56));
                return (
                  <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-4" key={stringOf(item, "monthLabel")}>
                    <div className="flex h-[170px] items-end justify-center gap-2">
                      <div className="w-8 rounded-t-md bg-[var(--kr-gov-blue)]" style={{ height: `${issuedHeight}px` }} />
                      <div className="w-5 rounded-t-md bg-sky-300" style={{ height: `${reissuedHeight}px` }} />
                      <div className="w-5 rounded-t-md bg-rose-300" style={{ height: `${rejectedHeight}px` }} />
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-sm font-bold">{stringOf(item, "monthLabel")}</p>
                      <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{en ? "Issued" : "발급"} {Number(stringOf(item, "issuedCount") || "0").toLocaleString()}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </article>

          <article className="gov-card" data-help-id="certificate-statistics-alerts">
            <h3 className="text-lg font-bold text-[var(--kr-gov-text-primary)]">{en ? "Operational Alerts" : "운영 알림"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Queues or institutions that currently require operator attention." : "현재 운영자 확인이 필요한 대기열 또는 기관 이슈입니다."}</p>
            <div className="mt-5 space-y-3">
              {alertRows.map((item, index) => (
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4" key={`${stringOf(item, "title")}-${index}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</p>
                      <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "description")}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${stringOf(item, "toneClassName")}`}>{stringOf(item, "badge")}</span>
                  </div>
                  <a className="mt-3 inline-flex text-sm font-bold text-[var(--kr-gov-blue)] hover:underline" href={stringOf(item, "actionUrl")}>{stringOf(item, "actionLabel")}</a>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="certificate-statistics-type-table">
          <GridToolbar title={en ? "Certificate Type Distribution" : "인증서 유형별 분포"} meta={en ? "Compare request, issued, pending, rejected, and average lead time across certificate categories." : "인증서 유형별 신청, 발급, 대기, 반려, 평균 처리일을 비교합니다."} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-6 py-4">{en ? "Type" : "유형"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Requests" : "신청"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Issued" : "발급"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Pending" : "대기"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Rejected" : "반려"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Avg. Lead Days" : "평균 처리일"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Success Rate" : "성공률"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {certificateTypeRows.map((item) => (
                  <tr key={stringOf(item, "certificateTypeCode")}>
                    <td className="px-6 py-4 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "certificateTypeLabel")}</td>
                    <td className="px-6 py-4 text-right">{Number(stringOf(item, "requestCount") || "0").toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-[var(--kr-gov-blue)]">{Number(stringOf(item, "issuedCount") || "0").toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-amber-700">{Number(stringOf(item, "pendingCount") || "0").toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-red-700">{Number(stringOf(item, "rejectedCount") || "0").toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">{stringOf(item, "avgLeadDays")}</td>
                    <td className="px-6 py-4 text-right">{stringOf(item, "successRate")}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="certificate-statistics-institution-table">
          <GridToolbar title={en ? "Institution Delivery Pace" : "기관별 발급 처리 현황"} meta={en ? "Track where issuance is concentrated and which institutions are accumulating pending or rejected requests." : "기관별 발급 집중도와 대기 또는 반려 누적 상황을 함께 확인합니다."} actions={<MemberButton icon="download" size="xs" type="button" variant="secondary">{en ? "Download CSV" : "CSV 다운로드"}</MemberButton>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-6 py-4">{en ? "Institution / Site" : "기관 / 배출지"}</th>
                  <th className="px-6 py-4">{en ? "Primary Type" : "주요 유형"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Requests" : "신청"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Issued" : "발급"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Pending" : "대기"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Rejected" : "반려"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Re-issued" : "재발급"}</th>
                  <th className="px-6 py-4 text-right">{en ? "Avg. Days" : "평균 일수"}</th>
                  <th className="px-6 py-4">{en ? "Last Issued" : "최근 발급일"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Related" : "관련 화면"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {institutionRows.length === 0 ? (
                  <tr><td className="px-6 py-10 text-center text-[var(--kr-gov-text-secondary)]" colSpan={10}>{en ? "No matching institution rows found." : "조건에 맞는 기관 통계가 없습니다."}</td></tr>
                ) : institutionRows.map((item) => (
                  <tr key={stringOf(item, "insttId")}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "insttName")}</div>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(item, "siteName")}</div>
                    </td>
                    <td className="px-6 py-4">{stringOf(item, "certificateTypeLabel")}</td>
                    <td className="px-6 py-4 text-right">{Number(stringOf(item, "requestCount") || "0").toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-[var(--kr-gov-blue)]">{Number(stringOf(item, "issuedCount") || "0").toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-amber-700">{Number(stringOf(item, "pendingCount") || "0").toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-red-700">{Number(stringOf(item, "rejectedCount") || "0").toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-sky-700">{Number(stringOf(item, "reissuedCount") || "0").toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">{stringOf(item, "avgLeadDays")}</td>
                    <td className="px-6 py-4">{stringOf(item, "lastIssuedAt")}</td>
                    <td className="px-6 py-4 text-center">
                      <a className="inline-flex rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[var(--kr-gov-blue-hover)]" href={stringOf(item, "detailUrl")}>
                        {en ? "Open" : "열기"}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MemberPagination className="border-t-0" currentPage={currentPage} onPageChange={(pageNumber) => setFilters((current) => ({ ...current, pageIndex: pageNumber }))} totalPages={totalPages} />
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
