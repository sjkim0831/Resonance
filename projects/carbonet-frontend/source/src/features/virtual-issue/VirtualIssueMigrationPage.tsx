import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchRefundAccountReviewPage } from "../../lib/api/member";
import type { RefundAccountReviewPagePayload } from "../../lib/api/memberTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, MemberButton, MemberLinkButton, MemberPagination, MemberSectionToolbar } from "../member/common";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  verificationStatus: string;
  payoutStatus: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  searchKeyword: "",
  verificationStatus: "ALL",
  payoutStatus: "ALL"
};

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  const params = new URLSearchParams(window.location.search);
  return {
    pageIndex: Number(params.get("pageIndex") || "1") || 1,
    searchKeyword: params.get("searchKeyword") || "",
    verificationStatus: params.get("verificationStatus") || "ALL",
    payoutStatus: params.get("payoutStatus") || "ALL"
  };
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

function listOf(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "")).filter(Boolean) : [];
}

function badgeClassName(status: string) {
  switch (status) {
    case "VERIFIED":
      return "bg-emerald-100 text-emerald-700";
    case "MISMATCH":
      return "bg-rose-100 text-rose-700";
    case "ESCALATED":
      return "bg-violet-100 text-violet-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function payoutBadgeClassName(status: string) {
  switch (status) {
    case "READY":
      return "bg-blue-100 text-blue-700";
    case "SENT":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

export function VirtualIssueMigrationPage() {
  const en = isEnglish();
  const [filters, setFilters] = useState<Filters>(() => readInitialFilters());
  const [draftFilters, setDraftFilters] = useState<Filters>(() => readInitialFilters());
  const [activeRequestId, setActiveRequestId] = useState("");
  const pageState = useAsyncValue<RefundAccountReviewPagePayload>(
    () => fetchRefundAccountReviewPage(filters),
    [filters.pageIndex, filters.searchKeyword, filters.verificationStatus, filters.payoutStatus],
    {
      onSuccess(payload) {
        const next = {
          pageIndex: Number(payload.pageIndex || 1),
          searchKeyword: String(payload.searchKeyword || ""),
          verificationStatus: String(payload.verificationStatus || "ALL"),
          payoutStatus: String(payload.payoutStatus || "ALL")
        };
        setFilters(next);
        setDraftFilters(next);
      }
    }
  );
  const page = pageState.value;
  const error = pageState.error || String(page?.refundAccountReviewError || "");
  const rows = ((page?.refundAccountRows || []) as Array<Record<string, unknown>>);
  const summary = ((page?.refundAccountSummary || []) as Array<Record<string, unknown>>);
  const guidance = ((page?.refundAccountGuidance || []) as Array<Record<string, unknown>>);
  const totalCount = Number(page?.totalCount || rows.length);
  const currentPage = Math.max(1, Number(page?.pageIndex || 1));
  const totalPages = Math.max(1, Number(page?.totalPages || 1));
  const canView = page?.canViewRefundAccountReview !== false;
  const activeRow = useMemo(
    () => rows.find((row) => stringOf(row, "requestId") === activeRequestId) || rows[0] || null,
    [activeRequestId, rows]
  );
  const activeChecklist = listOf(en ? activeRow?.checklistEn : activeRow?.checklist);

  useEffect(() => {
    if (!activeRequestId && rows[0]) {
      setActiveRequestId(stringOf(rows[0], "requestId"));
    }
  }, [activeRequestId, rows]);

  useEffect(() => {
    if (activeRow) {
      setActiveRequestId(stringOf(activeRow, "requestId"));
    }
  }, [activeRow]);

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "virtual-issue", {
      language: en ? "en" : "ko",
      totalCount,
      currentPage,
      verificationStatus: filters.verificationStatus,
      payoutStatus: filters.payoutStatus
    });
  }, [currentPage, en, filters.payoutStatus, filters.verificationStatus, page, totalCount]);

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
        { label: en ? "Payment" : "결제/정산" },
        { label: en ? "Refund Account Review" : "환불 계좌 검수" }
      ]}
      title={en ? "Refund Account Review" : "환불 계좌 검수"}
      subtitle={en
        ? "Validate refund-account evidence before releasing payout to settlement handling."
        : "환불 지급 전 계좌 증빙, 예금주, 정산 이관 가능 여부를 한 화면에서 검수합니다."}
      loading={pageState.loading && !page && !error}
      loadingLabel={en ? "Loading refund account review." : "환불 계좌 검수 화면을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
        {!pageState.loading && page && !canView ? (
          <PageStatusNotice tone="warning">
            {en ? "The current account cannot access refund account review." : "현재 계정으로는 환불 계좌 검수 화면을 조회할 수 없습니다."}
          </PageStatusNotice>
        ) : null}
        {!canView ? null : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="virtual-issue-summary">
              {summary.map((item, index) => (
                <SummaryMetricCard
                  key={`${stringOf(item, "metricKey")}-${index}`}
                  title={en ? stringOf(item, "labelEn", "label") : stringOf(item, "label", "labelEn")}
                  value={stringOf(item, "value") || "0"}
                  description={en ? stringOf(item, "descriptionEn", "description") : stringOf(item, "description", "descriptionEn")}
                  accentClassName={stringOf(item, "accentClassName") || "text-[var(--kr-gov-blue)]"}
                  surfaceClassName={stringOf(item, "surfaceClassName") || "bg-[#f8fbff]"}
                />
              ))}
            </section>

            <CollectionResultPanel
              data-help-id="virtual-issue-search"
              title={en ? "Search Queue" : "검색 조건"}
              description={en ? "Narrow down the queue by verification and payout state before sending cases to settlement." : "검수 상태와 지급 상태를 기준으로 대상 계좌를 좁혀 정산 이관 전 점검합니다."}
              icon="fact_check"
            >
              <form className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr,1fr,1fr,auto]" onSubmit={(event) => {
                event.preventDefault();
                applyFilters(1);
              }}>
                <div>
                  <label className="mb-1 block text-sm font-bold" htmlFor="virtualIssueKeyword">{en ? "Keyword" : "검색어"}</label>
                  <AdminInput
                    id="virtualIssueKeyword"
                    placeholder={en ? "Request ID, refund ID, company, bank, reviewer" : "검수번호, 환불번호, 기업명, 은행명, 검수자"}
                    value={draftFilters.searchKeyword}
                    onChange={(event) => updateDraft("searchKeyword", event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold" htmlFor="virtualIssueVerificationStatus">{en ? "Verification" : "검수 상태"}</label>
                  <AdminSelect id="virtualIssueVerificationStatus" value={draftFilters.verificationStatus} onChange={(event) => updateDraft("verificationStatus", event.target.value)}>
                    <option value="ALL">{en ? "All" : "전체"}</option>
                    <option value="PENDING">{en ? "Pending Review" : "검수 대기"}</option>
                    <option value="MISMATCH">{en ? "Mismatch" : "불일치"}</option>
                    <option value="VERIFIED">{en ? "Verified" : "검수 완료"}</option>
                    <option value="ESCALATED">{en ? "Escalated" : "상신 필요"}</option>
                  </AdminSelect>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold" htmlFor="virtualIssuePayoutStatus">{en ? "Payout" : "지급 상태"}</label>
                  <AdminSelect id="virtualIssuePayoutStatus" value={draftFilters.payoutStatus} onChange={(event) => updateDraft("payoutStatus", event.target.value)}>
                    <option value="ALL">{en ? "All" : "전체"}</option>
                    <option value="HOLD">{en ? "On Hold" : "지급 보류"}</option>
                    <option value="READY">{en ? "Ready for Payout" : "지급 가능"}</option>
                    <option value="SENT">{en ? "Payout Requested" : "지급 요청 전송"}</option>
                  </AdminSelect>
                </div>
                <div className="flex items-end gap-2">
                  <MemberButton onClick={resetFilters} type="button" variant="secondary">{en ? "Reset" : "초기화"}</MemberButton>
                  <MemberButton type="submit" variant="primary">{en ? "Search" : "검색"}</MemberButton>
                </div>
              </form>
            </CollectionResultPanel>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="gov-card overflow-hidden p-0" data-help-id="virtual-issue-table">
                <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                  <MemberSectionToolbar
                    title={en ? "Refund Account Queue" : "환불 계좌 검수 대기열"}
                    meta={en ? `${totalCount.toLocaleString()} cases in scope` : `총 ${totalCount.toLocaleString()}건`}
                    actions={(
                      <div className="flex items-center gap-2">
                        <MemberLinkButton href={buildLocalizedPath("/admin/payment/refund_list", "/en/admin/payment/refund_list")} variant="secondary">
                          {en ? "Refund Requests" : "환불 요청 목록"}
                        </MemberLinkButton>
                        <MemberLinkButton href={buildLocalizedPath("/admin/payment/refund_process", "/en/admin/payment/refund_process")} variant="secondary">
                          {en ? "Refund Processing" : "환불 처리"}
                        </MemberLinkButton>
                      </div>
                    )}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)]">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                        <th className="px-6 py-4">{en ? "Request" : "검수건"}</th>
                        <th className="px-4 py-4">{en ? "Account" : "계좌정보"}</th>
                        <th className="px-4 py-4">{en ? "Verification" : "검수상태"}</th>
                        <th className="px-4 py-4">{en ? "Payout" : "지급상태"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white">
                      {rows.length === 0 ? (
                        <tr>
                          <td className="px-6 py-12 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={4}>
                            {en ? "No refund-account cases matched the filters." : "조건에 맞는 환불 계좌 검수 건이 없습니다."}
                          </td>
                        </tr>
                      ) : rows.map((row) => {
                        const selected = stringOf(row, "requestId") === stringOf(activeRow, "requestId");
                        return (
                          <tr
                            className={`cursor-pointer transition hover:bg-slate-50 ${selected ? "bg-[#f8fbff]" : ""}`}
                            key={stringOf(row, "requestId")}
                            onClick={() => setActiveRequestId(stringOf(row, "requestId"))}
                          >
                            <td className="px-6 py-4 align-top">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "requestId")}</p>
                                <p className="text-sm text-[var(--kr-gov-text-primary)]">{en ? stringOf(row, "companyNameEn", "companyName") : stringOf(row, "companyName", "companyNameEn")}</p>
                                <p className="text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "refundRequestId")} · {stringOf(row, "requestedAt")}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top text-sm">
                              <p className="font-medium text-[var(--kr-gov-text-primary)]">{en ? stringOf(row, "bankNameEn", "bankName") : stringOf(row, "bankName", "bankNameEn")}</p>
                              <p className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "accountNumberMasked")}</p>
                              <p className="mt-1 text-[var(--kr-gov-text-secondary)]">{en ? stringOf(row, "accountHolderEn", "accountHolder") : stringOf(row, "accountHolder", "accountHolderEn")}</p>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${badgeClassName(stringOf(row, "verificationStatus"))}`}>
                                {en ? stringOf(row, "verificationStatusLabelEn", "verificationStatusLabel") : stringOf(row, "verificationStatusLabel", "verificationStatusLabelEn")}
                              </span>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${payoutBadgeClassName(stringOf(row, "payoutStatus"))}`}>
                                {en ? stringOf(row, "payoutStatusLabelEn", "payoutStatusLabel") : stringOf(row, "payoutStatusLabel", "payoutStatusLabelEn")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <MemberPagination currentPage={currentPage} totalPages={totalPages} onPageChange={(pageNumber) => applyFilters(pageNumber)} />
              </section>

              <section className="space-y-6">
                <article className="gov-card" data-help-id="virtual-issue-detail">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--kr-gov-text-secondary)]">{stringOf(activeRow, "requestId") || "-"}</p>
                      <h2 className="mt-2 text-xl font-bold text-[var(--kr-gov-text-primary)]">
                        {en ? stringOf(activeRow, "companyNameEn", "companyName") : stringOf(activeRow, "companyName", "companyNameEn")}
                      </h2>
                    </div>
                    {activeRow ? (
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${badgeClassName(stringOf(activeRow, "verificationStatus"))}`}>
                        {en ? stringOf(activeRow, "verificationStatusLabelEn", "verificationStatusLabel") : stringOf(activeRow, "verificationStatusLabel", "verificationStatusLabelEn")}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[
                      [en ? "Refund Request" : "환불 요청번호", stringOf(activeRow, "refundRequestId") || "-"],
                      [en ? "Amount" : "환불 금액", stringOf(activeRow, "requestedAmount") || "-"],
                      [en ? "Bank" : "은행", en ? stringOf(activeRow, "bankNameEn", "bankName") : stringOf(activeRow, "bankName", "bankNameEn") || "-"],
                      [en ? "Masked Account" : "마스킹 계좌", stringOf(activeRow, "accountNumberMasked") || "-"],
                      [en ? "Account Holder" : "예금주", en ? stringOf(activeRow, "accountHolderEn", "accountHolder") : stringOf(activeRow, "accountHolder", "accountHolderEn") || "-"],
                      [en ? "Reviewer" : "검수 담당", en ? stringOf(activeRow, "reviewerEn", "reviewer") : stringOf(activeRow, "reviewer", "reviewerEn") || "-"]
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <p className="text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{label}</p>
                        <div className="mt-2 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f8fbff] px-4 py-4">
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Review Note" : "검수 메모"}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                      {en ? stringOf(activeRow, "mismatchReasonEn", "mismatchReason") : stringOf(activeRow, "mismatchReason", "mismatchReasonEn") || "-"}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <MemberLinkButton href={en ? stringOf(activeRow, "detailUrlEn", "detailUrl") : stringOf(activeRow, "detailUrl", "detailUrlEn")} variant="primary">
                      {en ? "Open Processing Page" : "처리 화면 열기"}
                    </MemberLinkButton>
                  </div>
                </article>

                <CollectionResultPanel
                  data-help-id="virtual-issue-checklist"
                  title={en ? "Evidence Checklist" : "증빙 체크리스트"}
                  description={en ? "Keep a trace of what justified the payout decision." : "지급 가능 여부 판단의 근거가 되는 증빙 목록을 유지합니다."}
                  icon="checklist"
                >
                  <div className="space-y-3">
                    {activeChecklist.length === 0 ? (
                      <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No evidence checklist is registered for this case." : "이 건에 등록된 증빙 체크리스트가 없습니다."}</p>
                    ) : activeChecklist.map((item, index) => (
                      <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]" key={`${item}-${index}`}>
                        {index + 1}. {item}
                      </div>
                    ))}
                  </div>
                </CollectionResultPanel>

                <CollectionResultPanel
                  data-help-id="virtual-issue-guidance"
                  title={en ? "Operator Guidance" : "운영 가이드"}
                  description={en ? "Use the same decision boundary before handing off to settlement." : "정산 이관 전 동일한 판정 경계를 유지하기 위한 운영 메모입니다."}
                  icon="rule"
                >
                  <div className="space-y-3">
                    {guidance.map((item, index) => (
                      <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3" key={`${stringOf(item, "title")}-${index}`}>
                        <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "description")}</p>
                      </div>
                    ))}
                  </div>
                </CollectionResultPanel>
              </section>
            </section>
          </>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
