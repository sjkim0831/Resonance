import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchRefundProcessPage } from "../../lib/api/trade";
import type { RefundProcessPagePayload } from "../../lib/api/tradeTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberLinkButton, MemberPagination, MemberSectionToolbar } from "../member/common";
import { MemberStateCard, ReviewModalFrame } from "../member/sections";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  refundStatus: string;
  refundChannel: string;
  priority: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  searchKeyword: "",
  refundStatus: "ALL",
  refundChannel: "ALL",
  priority: "ALL"
};

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  const params = new URLSearchParams(window.location.search);
  return {
    pageIndex: Number(params.get("pageIndex") || "1") || 1,
    searchKeyword: params.get("searchKeyword") || "",
    refundStatus: params.get("refundStatus") || "ALL",
    refundChannel: params.get("refundChannel") || "ALL",
    priority: params.get("priority") || "ALL"
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

export function RefundProcessMigrationPage() {
  const en = isEnglish();
  const [filters, setFilters] = useState<Filters>(() => readInitialFilters());
  const [draftFilters, setDraftFilters] = useState<Filters>(() => readInitialFilters());
  const [activeRefundId, setActiveRefundId] = useState("");
  const [operatorNote, setOperatorNote] = useState("");
  const pageState = useAsyncValue<RefundProcessPagePayload>(
    () => fetchRefundProcessPage(filters),
    [filters.pageIndex, filters.searchKeyword, filters.refundStatus, filters.refundChannel, filters.priority],
    {
      onSuccess(payload) {
        const next = {
          pageIndex: Number(payload.pageIndex || 1),
          searchKeyword: String(payload.searchKeyword || ""),
          refundStatus: String(payload.refundStatus || "ALL"),
          refundChannel: String(payload.refundChannel || "ALL"),
          priority: String(payload.priority || "ALL")
        };
        setFilters(next);
        setDraftFilters(next);
      }
    }
  );
  const page = pageState.value;
  const error = pageState.error || String(page?.refundProcessError || "");
  const rows = (page?.refundRows || []) as Array<Record<string, unknown>>;
  const summary = (page?.refundSummary || []) as Array<Record<string, unknown>>;
  const guidance = (page?.refundGuidance || []) as Array<Record<string, unknown>>;
  const currentPage = Math.max(1, Number(page?.pageIndex || 1));
  const totalPages = Math.max(1, Number(page?.totalPages || 1));
  const totalCount = Number(page?.totalCount || rows.length);
  const canView = page?.canViewRefundProcess !== false;
  const activeRow = useMemo(
    () => rows.find((row) => stringOf(row, "refundId") === activeRefundId) || null,
    [activeRefundId, rows]
  );
  const reviewChecklist = Array.isArray(en ? activeRow?.reviewChecklistEn : activeRow?.reviewChecklist)
    ? ((en ? activeRow?.reviewChecklistEn : activeRow?.reviewChecklist) as unknown[]).map((item) => String(item || "")).filter(Boolean)
    : [];
  const attachments = Array.isArray(activeRow?.attachments)
    ? activeRow.attachments.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "refund-process", {
      language: en ? "en" : "ko",
      totalCount,
      currentPage,
      refundStatus: filters.refundStatus,
      refundChannel: filters.refundChannel,
      priority: filters.priority,
      searchKeyword: filters.searchKeyword
    });
  }, [currentPage, en, filters.priority, filters.refundChannel, filters.refundStatus, filters.searchKeyword, page, totalCount]);

  useEffect(() => {
    if (!activeRow) {
      setOperatorNote("");
      return;
    }
    setOperatorNote(en
      ? `Next action: ${stringOf(activeRow, "nextActionEn", "nextAction")}`
      : `다음 조치: ${stringOf(activeRow, "nextAction", "nextActionEn")}`);
  }, [activeRow, en]);

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
        { label: en ? "Payments & Settlement" : "결제/정산" },
        { label: en ? "Refund Processing" : "환불 처리" }
      ]}
      title={en ? "Refund Processing" : "환불 처리"}
      subtitle={en ? "Review account readiness, refund channel, and execution SLA before releasing customer funds." : "환불 계좌 검수, 처리 채널, 집행 SLA를 함께 확인하면서 환불 집행을 진행하는 운영 큐입니다."}
      loading={pageState.loading && !page && !error}
      loadingLabel={en ? "Loading refund processing queue..." : "환불 처리 대기열을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
        {!pageState.loading && page && !canView ? (
          <MemberStateCard
            description={en ? "The current account cannot access the refund processing queue." : "현재 계정으로는 환불 처리 화면을 조회할 수 없습니다."}
            icon="lock"
            title={en ? "Permission denied." : "권한이 없습니다."}
            tone="warning"
          />
        ) : null}
        {!canView ? null : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="refund-process-summary">
              {summary.map((item, index) => (
                <SummaryMetricCard
                  key={`${stringOf(item, "metricKey")}-${index}`}
                  title={en ? stringOf(item, "labelEn", "label") : stringOf(item, "label", "labelEn")}
                  value={stringOf(item, "value") || "0"}
                  description={en ? stringOf(item, "descriptionEn", "description") : stringOf(item, "description", "descriptionEn")}
                />
              ))}
            </section>

            <CollectionResultPanel
              data-help-id="refund-process-search"
              title={en ? "Search Queue" : "검색 조건"}
              description={en ? "Filter the queue by refund state, channel, and urgency before assigning execution." : "환불 상태, 처리 채널, 긴급도를 기준으로 집행 대상을 좁혀 담당자와 순서를 정리합니다."}
              icon="payments"
            >
              <form className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr,1fr,1fr,1fr,auto]" onSubmit={(event) => {
                event.preventDefault();
                applyFilters(1);
              }}>
                <div>
                  <label className="mb-1 block text-sm font-bold" htmlFor="refundProcessKeyword">{en ? "Keyword" : "검색어"}</label>
                  <AdminInput
                    id="refundProcessKeyword"
                    placeholder={en ? "Refund ID, request ID, company, payer, assignee" : "환불번호, 요청번호, 기업명, 예금주, 담당자"}
                    value={draftFilters.searchKeyword}
                    onChange={(event) => updateDraft("searchKeyword", event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold" htmlFor="refundProcessStatus">{en ? "Refund Status" : "처리 상태"}</label>
                  <AdminSelect id="refundProcessStatus" value={draftFilters.refundStatus} onChange={(event) => updateDraft("refundStatus", event.target.value)}>
                    <option value="ALL">{en ? "All" : "전체"}</option>
                    <option value="REQUESTED">{en ? "Requested" : "요청 접수"}</option>
                    <option value="ACCOUNT_REVIEW">{en ? "Account Review" : "계좌 검수"}</option>
                    <option value="EXECUTION_READY">{en ? "Ready to Execute" : "집행 대기"}</option>
                    <option value="COMPLETED">{en ? "Completed" : "완료"}</option>
                  </AdminSelect>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold" htmlFor="refundProcessChannel">{en ? "Channel" : "처리 채널"}</label>
                  <AdminSelect id="refundProcessChannel" value={draftFilters.refundChannel} onChange={(event) => updateDraft("refundChannel", event.target.value)}>
                    <option value="ALL">{en ? "All" : "전체"}</option>
                    <option value="BANK">{en ? "Bank Transfer" : "계좌이체"}</option>
                    <option value="CARD">{en ? "Card Cancellation" : "카드취소"}</option>
                    <option value="MIXED">{en ? "Mixed" : "혼합"}</option>
                  </AdminSelect>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold" htmlFor="refundProcessPriority">{en ? "Priority" : "긴급도"}</label>
                  <AdminSelect id="refundProcessPriority" value={draftFilters.priority} onChange={(event) => updateDraft("priority", event.target.value)}>
                    <option value="ALL">{en ? "All" : "전체"}</option>
                    <option value="HIGH">{en ? "High" : "높음"}</option>
                    <option value="MEDIUM">{en ? "Medium" : "보통"}</option>
                    <option value="LOW">{en ? "Low" : "낮음"}</option>
                  </AdminSelect>
                </div>
                <div className="flex items-end gap-2">
                  <MemberButton onClick={resetFilters} type="button" variant="secondary">{en ? "Reset" : "초기화"}</MemberButton>
                  <MemberButton type="submit" variant="primary">{en ? "Search" : "검색"}</MemberButton>
                </div>
              </form>
            </CollectionResultPanel>

            <section className="gov-card overflow-hidden p-0" data-help-id="refund-process-table">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <MemberSectionToolbar
                  title={en ? "Refund Execution Queue" : "환불 집행 대기열"}
                  meta={en ? `Total ${totalCount} refunds in the current filter.` : `현재 필터 기준 총 ${totalCount}건입니다.`}
                  actions={<span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{en ? `Page ${currentPage} / ${totalPages}` : `${currentPage} / ${totalPages} 페이지`}</span>}
                />
              </div>
              <div className="overflow-x-auto">
                <AdminTable>
                  <thead>
                    <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
                      <th className="px-4 py-4 text-left">{en ? "Refund" : "환불 건"}</th>
                      <th className="px-4 py-4 text-left">{en ? "Amount / Channel" : "금액 / 채널"}</th>
                      <th className="px-4 py-4 text-left">{en ? "Account Readiness" : "계좌 검수"}</th>
                      <th className="px-4 py-4 text-left">{en ? "Status / SLA" : "상태 / SLA"}</th>
                      <th className="px-4 py-4 text-left">{en ? "Operator" : "담당자"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                          {en ? "No refund cases match the current filters." : "현재 조건에 맞는 환불 건이 없습니다."}
                        </td>
                      </tr>
                    ) : rows.map((row) => (
                      <tr className="align-top" key={stringOf(row, "refundId", "requestId")}>
                        <td className="px-4 py-4">
                          <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "refundId")}</div>
                          <div className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? stringOf(row, "companyNameEn", "companyName") : stringOf(row, "companyName", "companyNameEn")}</div>
                          <div className="mt-1 text-xs text-gray-500">{stringOf(row, "requestId")} / {stringOf(row, "requestTypeLabel", "requestTypeLabelEn")}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stringOf(row, "priorityBadgeClass")}`}>{en ? stringOf(row, "priorityLabelEn", "priorityLabel") : stringOf(row, "priorityLabel", "priorityLabelEn")}</span>
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{en ? stringOf(row, "payerNameEn", "payerName") : stringOf(row, "payerName", "payerNameEn")}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "refundAmount")}</div>
                          <div className="mt-1 text-[var(--kr-gov-text-secondary)]">{en ? stringOf(row, "refundChannelLabelEn", "refundChannelLabel") : stringOf(row, "refundChannelLabel", "refundChannelLabelEn")}</div>
                          <div className="mt-1 text-xs text-gray-500">{en ? "Requested" : "요청"}: {stringOf(row, "requestedAt")}</div>
                          <div className="mt-1 text-xs text-gray-500">{en ? "Reason" : "사유"}: {en ? stringOf(row, "refundReasonEn", "refundReason") : stringOf(row, "refundReason", "refundReasonEn")}</div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stringOf(row, "accountBadgeClass")}`}>{en ? stringOf(row, "accountReviewLabelEn", "accountReviewLabel") : stringOf(row, "accountReviewLabel", "accountReviewLabelEn")}</span>
                          <div className="mt-2 font-bold text-[var(--kr-gov-text-primary)]">{en ? stringOf(row, "bankNameEn", "bankName") : stringOf(row, "bankName", "bankNameEn")}</div>
                          <div className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "accountMasked")}</div>
                          <div className="mt-1 text-xs text-gray-500">{en ? stringOf(row, "accountOwnerEn", "accountOwner") : stringOf(row, "accountOwner", "accountOwnerEn")}</div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stringOf(row, "statusBadgeClass")}`}>{en ? stringOf(row, "refundStatusLabelEn", "refundStatusLabel") : stringOf(row, "refundStatusLabel", "refundStatusLabelEn")}</span>
                          <div className="mt-2 text-[var(--kr-gov-text-secondary)]">{en ? "Due" : "처리기한"}: {stringOf(row, "dueAt")}</div>
                          <div className="mt-1 text-[var(--kr-gov-text-secondary)]">{en ? "Settlement" : "차감 원천"}: {en ? stringOf(row, "sourceStatusEn", "sourceStatus") : stringOf(row, "sourceStatus", "sourceStatusEn")}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <MemberLinkButton href={en ? stringOf(row, "listUrlEn", "listUrl") : stringOf(row, "listUrl", "listUrlEn")} variant="secondary">{en ? "Request list" : "요청 목록"}</MemberLinkButton>
                            <MemberButton onClick={() => setActiveRefundId(stringOf(row, "refundId"))} type="button" variant="primary">{en ? "Review" : "검토"}</MemberButton>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="font-bold text-[var(--kr-gov-text-primary)]">{en ? stringOf(row, "assigneeEn", "assignee") : stringOf(row, "assignee", "assigneeEn")}</div>
                          <div className="mt-1 text-[var(--kr-gov-text-secondary)]">{en ? stringOf(row, "teamNameEn", "teamName") : stringOf(row, "teamName", "teamNameEn")}</div>
                          <div className="mt-1 text-xs text-gray-500">{en ? "Escalation" : "상신"}: {en ? stringOf(row, "escalationOwnerEn", "escalationOwner") : stringOf(row, "escalationOwner", "escalationOwnerEn")}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              </div>
              <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-4">
                <MemberPagination currentPage={currentPage} totalPages={totalPages} onPageChange={(nextPage) => applyFilters(nextPage)} />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3" data-help-id="refund-process-guidance">
              {guidance.map((item, index) => (
                <article className="gov-card p-5" key={`${stringOf(item, "title", "titleEn")}-${index}`}>
                  <div className="mb-3 inline-flex rounded-full bg-slate-100 p-2 text-slate-700">
                    <span className="material-symbols-outlined text-[20px]">{stringOf(item, "icon") || "rule"}</span>
                  </div>
                  <h3 className="text-base font-bold text-[var(--kr-gov-text-primary)]">{en ? stringOf(item, "titleEn", "title") : stringOf(item, "title", "titleEn")}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{en ? stringOf(item, "descriptionEn", "description") : stringOf(item, "description", "descriptionEn")}</p>
                </article>
              ))}
            </section>
          </>
        )}
      </AdminWorkspacePageFrame>

      <ReviewModalFrame
        open={Boolean(activeRow)}
        title={en ? "Refund execution review" : "환불 집행 검토"}
        onClose={() => setActiveRefundId("")}
      >
        {!activeRow ? null : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-[var(--kr-gov-border-light)] bg-white p-4">
                <h3 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Execution snapshot" : "집행 요약"}</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Refund ID" : "환불번호"}</dt>
                    <dd className="text-right font-bold text-[var(--kr-gov-text-primary)]">{stringOf(activeRow, "refundId")}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Amount" : "환불 금액"}</dt>
                    <dd className="text-right font-bold text-[var(--kr-gov-text-primary)]">{stringOf(activeRow, "refundAmount")}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Channel" : "처리 채널"}</dt>
                    <dd className="text-right">{en ? stringOf(activeRow, "refundChannelLabelEn", "refundChannelLabel") : stringOf(activeRow, "refundChannelLabel", "refundChannelLabelEn")}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Account review" : "계좌 검수"}</dt>
                    <dd className="text-right">{en ? stringOf(activeRow, "accountReviewLabelEn", "accountReviewLabel") : stringOf(activeRow, "accountReviewLabel", "accountReviewLabelEn")}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Next action" : "다음 조치"}</dt>
                    <dd className="text-right">{en ? stringOf(activeRow, "nextActionEn", "nextAction") : stringOf(activeRow, "nextAction", "nextActionEn")}</dd>
                  </div>
                </dl>
              </article>
              <article className="rounded-2xl border border-[var(--kr-gov-border-light)] bg-white p-4">
                <h3 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Review checklist" : "검토 체크리스트"}</h3>
                <ul className="mt-3 space-y-2 text-sm text-[var(--kr-gov-text-secondary)]">
                  {reviewChecklist.map((item, index) => (
                    <li className="flex gap-2" key={`${item}-${index}`}>
                      <span className="material-symbols-outlined text-[18px] text-slate-500">check_circle</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            <article className="rounded-2xl border border-[var(--kr-gov-border-light)] bg-white p-4">
              <h3 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Operator note" : "운영 메모"}</h3>
              <textarea
                className="mt-3 min-h-[140px] w-full rounded-xl border border-[var(--kr-gov-border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--kr-gov-primary)] focus:ring-2 focus:ring-[var(--kr-gov-primary)]/15"
                value={operatorNote}
                onChange={(event) => setOperatorNote(event.target.value)}
              />
            </article>

            <article className="rounded-2xl border border-[var(--kr-gov-border-light)] bg-white p-4">
              <h3 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Attachments and links" : "첨부 및 연계 화면"}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((attachment, index) => (
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700" key={`${stringOf(attachment, "name", "nameEn")}-${index}`}>
                    {en ? stringOf(attachment, "nameEn", "name") : stringOf(attachment, "name", "nameEn")}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <MemberLinkButton href={en ? stringOf(activeRow, "listUrlEn", "listUrl") : stringOf(activeRow, "listUrl", "listUrlEn")} variant="secondary">{en ? "Open refund list" : "환불 요청 목록"}</MemberLinkButton>
                <MemberLinkButton href={en ? stringOf(activeRow, "accountReviewUrlEn", "accountReviewUrl") : stringOf(activeRow, "accountReviewUrl", "accountReviewUrlEn")} variant="secondary">{en ? "Open account review" : "환불 계좌 검수"}</MemberLinkButton>
              </div>
            </article>
          </div>
        )}
      </ReviewModalFrame>
    </AdminPageShell>
  );
}
