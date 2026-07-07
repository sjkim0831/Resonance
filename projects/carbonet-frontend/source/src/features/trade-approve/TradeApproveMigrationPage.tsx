import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { CanView } from "../../components/access/CanView";
import { submitTradeApproveAction } from "../../lib/api/adminActions";
import { readBootstrappedTradeApprovePageData } from "../../lib/api/bootstrap";
import { fetchTradeApprovePage } from "../../lib/api/trade";
import type { TradeApprovePagePayload } from "../../lib/api/tradeTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import {
  AdminInput,
  AdminSelect,
  MemberButton,
  MemberButtonGroup,
  MemberPagination,
  MemberPermissionButton,
  MemberSectionToolbar,
  PageStatusNotice,
  SummaryMetricCard
} from "../member/common";
import { MemberStateCard, ReviewModalFrame } from "../member/sections";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  approvalStatus: string;
  tradeType: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  searchKeyword: "",
  approvalStatus: "PENDING",
  tradeType: ""
};

function stringOf(value: unknown, key?: string) {
  if (typeof key === "string" && value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return typeof record[key] === "string" ? (record[key] as string) : "";
  }
  return typeof value === "string" ? value : "";
}

function numberOf(value: unknown) {
  return typeof value === "number" ? value : Number(value || 0);
}

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  const search = new URLSearchParams(window.location.search);
  return {
    pageIndex: Number(search.get("pageIndex") || "1") || 1,
    searchKeyword: search.get("searchKeyword") || "",
    approvalStatus: search.get("approvalStatus") || DEFAULT_FILTERS.approvalStatus,
    tradeType: search.get("tradeType") || ""
  };
}

function sameFilters(left: Filters, right: Filters) {
  return left.pageIndex === right.pageIndex
    && left.searchKeyword === right.searchKeyword
    && left.approvalStatus === right.approvalStatus
    && left.tradeType === right.tradeType;
}

function canAct(row: Record<string, unknown>) {
  const code = stringOf(row, "approvalStatusCode").toUpperCase();
  return code === "PENDING" || code === "HOLD";
}

function badgeClass(code: string) {
  switch (code) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700";
    case "REJECTED":
      return "bg-rose-100 text-rose-700";
    case "HOLD":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function reviewDataRows(row: Record<string, unknown>, en: boolean) {
  return [
    [en ? "Trade ID" : "거래번호", stringOf(row, "tradeId")],
    [en ? "Contract" : "계약명", stringOf(row, "contractName")],
    [en ? "Trade Type" : "거래 유형", stringOf(row, "productType")],
    [en ? "Seller" : "매도 기관", stringOf(row, "sellerName")],
    [en ? "Buyer" : "매수 기관", stringOf(row, "buyerName")],
    [en ? "Quantity" : "수량", stringOf(row, "quantity")],
    [en ? "Amount" : "금액", stringOf(row, "amount")],
    [en ? "Requested At" : "요청 일시", stringOf(row, "requestedAt")],
    [en ? "Settlement" : "정산 상태", stringOf(row, "settlementStatusLabel")],
    [en ? "Reviewer" : "검토 담당", stringOf(row, "reviewerName")],
    [en ? "Review Note" : "검토 메모", stringOf(row, "reviewNote")],
    [en ? "Reject Reason" : "반려 사유", stringOf(row, "rejectReason") || "-"]
  ] as Array<[string, string]>;
}

export function TradeApproveMigrationPage() {
  const en = isEnglish();
  const sessionState = useFrontendSession();
  const initialFilters = useMemo<Filters>(() => readInitialFilters(), []);
  const initialPayload = useMemo(() => readBootstrappedTradeApprovePageData(), []);
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState(initialFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewTradeId, setReviewTradeId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const pageState = useAsyncValue<TradeApprovePagePayload>(
    () => fetchTradeApprovePage(filters),
    [filters.pageIndex, filters.searchKeyword, filters.approvalStatus, filters.tradeType, reloadKey],
    {
      initialValue: initialPayload,
      skipInitialLoad: Boolean(initialPayload),
      onSuccess(payload) {
        const next = {
          pageIndex: numberOf(payload.pageIndex) || 1,
          searchKeyword: stringOf(payload.searchKeyword),
          approvalStatus: stringOf(payload.approvalStatus) || DEFAULT_FILTERS.approvalStatus,
          tradeType: stringOf(payload.tradeType)
        };
        setFilters((current) => sameFilters(current, next) ? current : next);
        setDraft((current) => sameFilters(current, next) ? current : next);
        setSelectedIds([]);
      }
    }
  );

  const page = pageState.value;
  const rows = (page?.approvalRows || []) as Array<Record<string, unknown>>;
  const reviewRow = rows.find((row) => stringOf(row, "tradeId") === reviewTradeId) || null;
  const approvalStatusOptions = (page?.approvalStatusOptions || []) as Array<Record<string, unknown>>;
  const tradeTypeOptions = (page?.tradeTypeOptions || []) as Array<Record<string, unknown>>;
  const currentPage = numberOf(page?.pageIndex) || 1;
  const totalPages = numberOf(page?.totalPages) || 1;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const search = new URLSearchParams();
    if (filters.pageIndex > 1) {
      search.set("pageIndex", String(filters.pageIndex));
    }
    if (filters.searchKeyword) {
      search.set("searchKeyword", filters.searchKeyword);
    }
    if (filters.approvalStatus) {
      search.set("approvalStatus", filters.approvalStatus);
    }
    if (filters.tradeType) {
      search.set("tradeType", filters.tradeType);
    }
    const query = search.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [filters]);

  useEffect(() => {
    logGovernanceScope("PAGE", "trade-approve", {
      language: en ? "en" : "ko",
      actorInsttId: sessionState.value?.insttId || "",
      pageIndex: currentPage,
      searchKeyword: filters.searchKeyword,
      approvalStatus: filters.approvalStatus,
      tradeType: filters.tradeType,
      selectedCount: selectedIds.length,
      rowCount: rows.length
    });
  }, [currentPage, en, filters.approvalStatus, filters.searchKeyword, filters.tradeType, rows.length, selectedIds.length, sessionState.value?.insttId]);

  useEffect(() => {
    if (!reviewRow) {
      setRejectReason("");
      return;
    }
    setRejectReason(stringOf(reviewRow, "rejectReason"));
  }, [reviewRow]);

  const actionableIds = rows.filter(canAct).map((row) => stringOf(row, "tradeId"));
  const allActionableSelected = actionableIds.length > 0 && actionableIds.every((id) => selectedIds.includes(id));

  async function handleAction(action: string, tradeId?: string) {
    const session = sessionState.value;
    if (!session) {
      return;
    }
    setActionError("");
    setMessage("");
    if ((action === "reject" || action === "batch_reject") && !rejectReason.trim()) {
      setActionError(en ? "Enter a reject reason before submitting rejection." : "반려 처리 전에 반려 사유를 입력해 주세요.");
      return;
    }
    try {
      await submitTradeApproveAction(session, {
        action,
        tradeId,
        selectedIds: tradeId ? undefined : selectedIds,
        rejectReason
      });
      setMessage(
        action.includes("reject")
          ? (en ? "Trade rejection completed." : "거래 반려 처리가 완료되었습니다.")
          : (en ? "Trade approval completed." : "거래 승인 처리가 완료되었습니다.")
      );
      setReloadKey((current) => current + 1);
      setSelectedIds([]);
      if (tradeId) {
        setReviewTradeId("");
        setRejectReason("");
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (en ? "Failed to process trade approval." : "거래 승인 처리에 실패했습니다."));
    }
  }

  return (
    <AdminPageShell
      actions={(
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">
          {en ? "Total" : "총"} {numberOf(page?.totalCount).toLocaleString()}
        </span>
      )}
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Trade" : "거래" },
        { label: en ? "Trade Approval" : "거래 승인" }
      ]}
      title={en ? "Trade Approval" : "거래 승인"}
      subtitle={en ? "Review pending trades, confirm settlement readiness, and approve or reject operator requests." : "거래 승인 대상을 검토하고 정산 준비 상태를 확인한 뒤 승인 또는 반려를 처리합니다."}
    >
      {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
      {pageState.error || actionError ? <PageStatusNotice tone="error">{pageState.error || actionError}</PageStatusNotice> : null}
      {!pageState.loading && page && !page.canViewTradeApprove ? (
        <MemberStateCard
          title={en ? "Access denied" : "권한이 없습니다."}
          description={en ? "Your account cannot view the trade approval screen." : "현재 계정으로는 거래 승인 화면을 조회할 수 없습니다."}
          icon="lock"
          tone="warning"
        />
      ) : null}
      <CanView allowed={page?.canViewTradeApprove ?? true} fallback={null}>
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="trade-approve-summary">
          <SummaryMetricCard title={en ? "Pending" : "승인 대기"} value={numberOf(page?.pendingCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-emerald-600" surfaceClassName="bg-emerald-50" title={en ? "Approved" : "승인 완료"} value={numberOf(page?.approvedCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-rose-600" surfaceClassName="bg-rose-50" title={en ? "Rejected" : "반려"} value={numberOf(page?.rejectedCount).toLocaleString()} />
          <SummaryMetricCard accentClassName="text-amber-600" surfaceClassName="bg-amber-50" title={en ? "On Hold" : "보류"} value={numberOf(page?.holdCount).toLocaleString()} />
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="trade-approve-search">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={<span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{en ? `Page ${currentPage} / ${totalPages}` : `현재 페이지 ${currentPage} / ${totalPages}`}</span>}
              meta={en ? "Keep the same approval layout: search, queue, then detailed review." : "검색 조건, 승인 대기열, 상세 검토 모달 순서를 동일하게 유지합니다."}
              title={en ? "Search Conditions" : "검색 조건"}
            />
          </div>
          <form
            className="grid gap-4 px-6 py-6 lg:grid-cols-[220px_220px_minmax(0,1fr)] lg:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setActionError("");
              setFilters({ ...draft, pageIndex: 1 });
            }}
          >
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Approval Status" : "승인 상태"}</span>
              <AdminSelect value={draft.approvalStatus} onChange={(event) => setDraft((current) => ({ ...current, approvalStatus: event.target.value }))}>
                {approvalStatusOptions.map((option, index) => <option key={`${stringOf(option, "code")}-${index}`} value={stringOf(option, "code")}>{stringOf(option, "label")}</option>)}
              </AdminSelect>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Trade Type" : "거래 유형"}</span>
              <AdminSelect value={draft.tradeType} onChange={(event) => setDraft((current) => ({ ...current, tradeType: event.target.value }))}>
                {tradeTypeOptions.map((option, index) => <option key={`${stringOf(option, "code")}-${index}`} value={stringOf(option, "code")}>{stringOf(option, "label")}</option>)}
              </AdminSelect>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
              <AdminInput
                placeholder={en ? "Trade ID, seller, buyer, or contract name" : "거래번호, 매도기관, 매수기관, 계약명 검색"}
                value={draft.searchKeyword}
                onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))}
              />
            </label>
          </form>
          <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                {en ? "Check counterparty, settlement state, and operator notes before the approval decision." : "상대 기관, 정산 상태, 운영 메모를 함께 확인한 뒤 승인 결정을 진행합니다."}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <MemberButton
                  onClick={() => {
                    setDraft(DEFAULT_FILTERS);
                    setFilters(DEFAULT_FILTERS);
                  }}
                  type="button"
                  variant="secondary"
                >
                  {en ? "Reset" : "초기화"}
                </MemberButton>
                <MemberButton onClick={() => setFilters({ ...draft, pageIndex: 1 })} type="button" variant="primary">{en ? "Search" : "검색"}</MemberButton>
              </div>
            </div>
          </div>
        </section>

        <section className="gov-card overflow-hidden" data-help-id="trade-approve-table">
          <MemberSectionToolbar
            actions={(
              <MemberButtonGroup data-help-id="trade-approve-batch-actions">
                <MemberPermissionButton allowed={Boolean(page?.canUseTradeApproveAction) && selectedIds.length > 0} onClick={() => handleAction("batch_approve")} reason={en ? "Only authorized admins can approve trades." : "권한 있는 관리자만 거래를 승인할 수 있습니다."} type="button" variant="primary">{en ? "Approve Selected" : "선택 승인"}</MemberPermissionButton>
                <MemberPermissionButton allowed={Boolean(page?.canUseTradeApproveAction) && selectedIds.length > 0} onClick={() => handleAction("batch_reject")} reason={en ? "Only authorized admins can reject trades." : "권한 있는 관리자만 거래를 반려할 수 있습니다."} type="button" variant="dangerSecondary">{en ? "Reject Selected" : "선택 반려"}</MemberPermissionButton>
              </MemberButtonGroup>
            )}
            className="border-b border-[var(--kr-gov-border-light)] bg-gray-50 px-6 py-4"
            meta={en ? `Queue ${numberOf(page?.totalCount).toLocaleString()} items` : `총 ${numberOf(page?.totalCount).toLocaleString()}건`}
            title={en ? "Trade Approval Queue" : "거래 승인 목록"}
          />
          {selectedIds.length > 0 ? (
            <div className="border-b border-[var(--kr-gov-border-light)] bg-amber-50 px-6 py-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Selected Reject Reason" : "선택 반려 사유"}</span>
                <textarea
                  className="gov-input min-h-[96px] py-3"
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder={en ? "Enter a common reject reason for the selected trades." : "선택 반려 시 공통 반려 사유를 입력하세요."}
                  value={rejectReason}
                />
              </label>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-[1440px] w-full text-sm text-left">
              <thead className="border-b border-[var(--kr-gov-border-light)] bg-gray-50">
                <tr className="text-[var(--kr-gov-text-secondary)]">
                  <th className="w-12 px-4 py-4 text-center">
                    <input checked={allActionableSelected} className="rounded border-gray-300" onChange={(event) => setSelectedIds(event.target.checked ? actionableIds : [])} type="checkbox" />
                  </th>
                  <th className="px-4 py-4 font-bold">{en ? "Trade" : "거래"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Counterparty" : "거래 상대"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Type / Quantity" : "유형 / 수량"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Amount" : "금액"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Settlement" : "정산"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Requested At" : "요청 일시"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Status" : "상태"}</th>
                  <th className="px-4 py-4 font-bold">{en ? "Actions" : "처리"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={9}>
                      {en ? "No trade approval targets matched the current search conditions." : "현재 검색 조건에 맞는 거래 승인 대상이 없습니다."}
                    </td>
                  </tr>
                ) : rows.map((row, index) => {
                  const tradeId = stringOf(row, "tradeId") || `trade-${index}`;
                  const actionable = canAct(row);
                  return (
                    <tr key={tradeId} className="align-top">
                      <td className="px-4 py-4 text-center">
                        <input checked={selectedIds.includes(tradeId)} className="rounded border-gray-300" disabled={!actionable} onChange={() => setSelectedIds((current) => current.includes(tradeId) ? current.filter((item) => item !== tradeId) : [...current, tradeId])} type="checkbox" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{tradeId}</div>
                        <div className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "contractName")}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div>{stringOf(row, "sellerName")}</div>
                        <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Buyer" : "매수"}: {stringOf(row, "buyerName")}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div>{stringOf(row, "productType")}</div>
                        <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "quantity")}</div>
                      </td>
                      <td className="px-4 py-4">{stringOf(row, "amount")}</td>
                      <td className="px-4 py-4">
                        <div>{stringOf(row, "settlementStatusLabel")}</div>
                        <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "reviewerName")}</div>
                      </td>
                      <td className="px-4 py-4">{stringOf(row, "requestedAt")}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass(stringOf(row, "approvalStatusCode"))}`}>
                          {stringOf(row, "approvalStatusLabel")}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <MemberButton onClick={() => setReviewTradeId(tradeId)} type="button" variant="secondary">{en ? "Review" : "검토"}</MemberButton>
                          <MemberPermissionButton allowed={Boolean(page?.canUseTradeApproveAction) && actionable} onClick={() => handleAction("approve", tradeId)} reason={en ? "Only pending trades can be approved." : "승인 대기 거래만 승인할 수 있습니다."} type="button" variant="primary">{en ? "Approve" : "승인"}</MemberPermissionButton>
                          <MemberPermissionButton allowed={Boolean(page?.canUseTradeApproveAction) && actionable} onClick={() => setReviewTradeId(tradeId)} reason={en ? "Only pending trades can be rejected." : "승인 대기 거래만 반려할 수 있습니다."} type="button" variant="dangerSecondary">{en ? "Reject" : "반려"}</MemberPermissionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-4">
            <MemberPagination currentPage={currentPage} onPageChange={(pageIndex) => setFilters((current) => ({ ...current, pageIndex }))} totalPages={totalPages} />
          </div>
        </section>

        <ReviewModalFrame
          footerLeft={reviewRow ? <MemberPermissionButton allowed={Boolean(page?.canUseTradeApproveAction) && canAct(reviewRow)} className="flex-1 justify-center sm:min-w-[160px] sm:flex-none" onClick={() => handleAction("reject", stringOf(reviewRow, "tradeId"))} reason={en ? "Only pending trades can be rejected." : "승인 대기 거래만 반려할 수 있습니다."} size="lg" type="button" variant="dangerSecondary">{en ? "Reject Trade" : "거래 반려"}</MemberPermissionButton> : null}
          footerRight={reviewRow ? <MemberPermissionButton allowed={Boolean(page?.canUseTradeApproveAction) && canAct(reviewRow)} className="flex-1 justify-center sm:min-w-[160px] sm:flex-none" onClick={() => handleAction("approve", stringOf(reviewRow, "tradeId"))} reason={en ? "Only pending trades can be approved." : "승인 대기 거래만 승인할 수 있습니다."} size="lg" type="button" variant="primary">{en ? "Approve Trade" : "거래 승인"}</MemberPermissionButton> : null}
          onClose={() => {
            setReviewTradeId("");
            setRejectReason("");
          }}
          open={Boolean(reviewRow)}
          title={en ? "Trade Approval Review" : "거래 승인 상세 검토"}
        >
          {reviewRow ? (
            <>
              <div className="grid gap-0 border-t-2 border-[var(--kr-gov-text-primary)]">
                {reviewDataRows(reviewRow, en).map(([label, value]) => (
                  <div className="grid grid-cols-[160px_1fr]" key={label}>
                    <div className="border-b border-r border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-3 text-sm font-bold text-[var(--kr-gov-text-secondary)]">{label}</div>
                    <div className="border-b border-[var(--kr-gov-border-light)] px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]">{value || "-"}</div>
                  </div>
                ))}
              </div>
              <section>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Reject Reason" : "반려 사유"}</span>
                  <textarea
                    className="gov-input min-h-[120px] py-3"
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder={en ? "Enter the reason when rejecting the trade." : "거래 반려 시 사유를 입력하세요."}
                    value={rejectReason}
                  />
                </label>
              </section>
            </>
          ) : null}
        </ReviewModalFrame>
      </CanView>
    </AdminPageShell>
  );
}
