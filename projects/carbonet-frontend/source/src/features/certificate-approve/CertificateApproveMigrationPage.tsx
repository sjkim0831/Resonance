import { useCallback, useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { CanView } from "../../components/access/CanView";
import { submitCertificateApproveAction } from "../../lib/api/adminActions";
import { fetchCertificateApprovePage } from "../../lib/api/adminMember";
import { buildLocalizedPath, getSearchParam } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { MemberPermissionButton, MEMBER_BUTTON_LABELS, PageStatusNotice } from "../member/common";
import { MemberStateCard, ReviewModalFrame } from "../member/sections";
import {
  CertificateApproveFilters,
  CertificateApproveReviewContent,
  CertificateApproveSearchSection,
  CertificateApproveTableSection,
  DEFAULT_CERTIFICATE_APPROVE_FILTERS
} from "./certificateApproveSections";

function readInitialPageIndex() {
  const raw = Number(getSearchParam("pageIndex") || DEFAULT_CERTIFICATE_APPROVE_FILTERS.pageIndex);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_CERTIFICATE_APPROVE_FILTERS.pageIndex;
}

export function CertificateApproveMigrationPage() {
  const [pageData, setPageData] = useState({
    searchKeyword: getSearchParam("searchKeyword"),
    requestType: getSearchParam("requestType"),
    status: getSearchParam("status") || DEFAULT_CERTIFICATE_APPROVE_FILTERS.status,
    pageIndex: readInitialPageIndex()
  });
  const [result, setResult] = useState<{
    approvalRows: Array<Record<string, unknown>>;
    totalPages: number;
    totalCount: number;
    pageIndex: number;
    canView: boolean;
    canUseAction: boolean;
    resultMessage: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draftFilters, setDraftFilters] = useState<CertificateApproveFilters>({
    searchKeyword: getSearchParam("searchKeyword"),
    requestType: getSearchParam("requestType"),
    status: getSearchParam("status") || DEFAULT_CERTIFICATE_APPROVE_FILTERS.status,
    pageIndex: readInitialPageIndex()
  });
  const [actionError, setActionError] = useState(() => getSearchParam("errorMessage"));
  const [message, setMessage] = useState(() => {
    const r = getSearchParam("result");
    return r === "approved" || r === "batchApproved"
      ? "인증서 승인 처리가 완료되었습니다."
      : r === "rejected" || r === "batchRejected"
        ? "인증서 반려 처리가 완료되었습니다."
        : "";
  });
  const [reviewCertificateId, setReviewCertificateId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const sessionState = useFrontendSession();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchCertificateApprovePage({
      pageIndex: pageData.pageIndex,
      searchKeyword: pageData.searchKeyword,
      requestType: pageData.requestType,
      status: pageData.status,
      result: getSearchParam("result") || ""
    })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setResult({
          approvalRows: data.approvalRows || [],
          totalPages: Number(data.totalPages || 1),
          totalCount: Number(data.certificateApprovalTotalCount || 0),
          pageIndex: Number(data.pageIndex || 1),
          canView: data.canViewCertificateApprove !== false,
          canUseAction: data.canUseCertificateApproveAction === true,
          resultMessage: String(data.certificateApprovalResultMessage || "")
        });
        setDraftFilters({
          searchKeyword: String(data.searchKeyword || ""),
          requestType: String(data.requestType || ""),
          status: String(data.status || DEFAULT_CERTIFICATE_APPROVE_FILTERS.status),
          pageIndex: Number(data.pageIndex || 1)
        });
        setSelectedIds([]);
        if (data.certificateApprovalResultMessage) {
          setMessage(String(data.certificateApprovalResultMessage));
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : "데이터 로딩 실패");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageData.pageIndex, pageData.requestType, pageData.searchKeyword, pageData.status, reloadKey]);

  const reviewRow = result?.approvalRows.find((row) => String(row.certificateId || "") === reviewCertificateId) || null;

  useEffect(() => {
    if (!result || !sessionState.value) {
      return;
    }
    logGovernanceScope("PAGE", "certificate-approve", {
      route: window.location.pathname,
      actorUserId: sessionState.value.userId || "",
      actorAuthorCode: sessionState.value.authorCode || "",
      actorInsttId: sessionState.value.insttId || "",
      canUseAction: result.canUseAction,
      selectedCount: selectedIds.length,
      totalCount: result.totalCount
    });
    logGovernanceScope("COMPONENT", "certificate-approve-table", {
      component: "certificate-approve-table",
      rowCount: result.approvalRows.length,
      selectedCount: selectedIds.length,
      currentPage: result.pageIndex
    });
  }, [result, selectedIds.length, sessionState.value]);

  useEffect(() => {
    if (!reviewRow) {
      setRejectReason("");
      return;
    }
    setRejectReason(String(reviewRow.rejectReason || ""));
  }, [reviewRow]);

  const updateDraft = useCallback((key: keyof CertificateApproveFilters, value: string | number) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyFilters = useCallback((nextPageIndex = 1) => {
    setActionError("");
    logGovernanceScope("ACTION", "certificate-approve-search", {
      actorInsttId: sessionState.value?.insttId || "",
      searchKeyword: draftFilters.searchKeyword,
      requestType: draftFilters.requestType,
      status: draftFilters.status,
      pageIndex: nextPageIndex
    });
    setPageData((prev) => ({ ...prev, ...draftFilters, pageIndex: nextPageIndex }));
  }, [draftFilters, sessionState.value?.insttId]);

  const movePage = useCallback((nextPageIndex: number) => {
    setActionError("");
    setPageData((prev) => ({ ...prev, pageIndex: nextPageIndex }));
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  }, []);

  const toggleSelectAll = useCallback((checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(result?.approvalRows
      .filter((row) => {
        const status = String(row.status || "").toUpperCase();
        return status === "PENDING" || status === "HOLD";
      })
      .map((row, index) => String(row.certificateId || `certificate-${index}`)) || []);
  }, [result?.approvalRows]);

  const handleAction = useCallback(async (action: string, certificateId?: string) => {
    const session = sessionState.value;
    if (!session) {
      return;
    }
    setActionError("");
    if ((action === "reject" || action === "batch_reject") && !rejectReason.trim()) {
      setActionError("반려 사유를 입력한 뒤 반려 처리해 주세요.");
      return;
    }
    logGovernanceScope("ACTION", "certificate-approve-submit", {
      actorInsttId: session.insttId || "",
      action,
      certificateId: certificateId || "",
      selectedCount: selectedIds.length
    });
    try {
      await submitCertificateApproveAction(session, {
        action,
        certificateId,
        selectedIds: certificateId ? undefined : selectedIds,
        rejectReason
      });
      setMessage(action.includes("reject") ? "인증서 반려 처리가 완료되었습니다." : "인증서 승인 처리가 완료되었습니다.");
      setReloadKey((current) => current + 1);
      setSelectedIds([]);
      if (certificateId) {
        setReviewCertificateId("");
        setRejectReason("");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "승인 처리 실패");
    }
  }, [rejectReason, selectedIds, sessionState.value]);

  const handleResetFilters = useCallback(() => {
    setDraftFilters(DEFAULT_CERTIFICATE_APPROVE_FILTERS);
    setPageData((prev) => ({ ...prev, ...DEFAULT_CERTIFICATE_APPROVE_FILTERS }));
  }, []);

  return (
    <AdminPageShell
      actions={(
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">
          총 {result?.totalCount?.toLocaleString() || 0}건
        </span>
      )}
      breadcrumbs={[
        { label: "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: "배출/인증" },
        { label: "인증서 승인" }
      ]}
      subtitle="인증서 발급 신청 내역을 검토하고 승인 또는 반려 상태를 처리합니다."
      title="인증서 승인 관리"
      loading={loading && !result}
      loadingLabel="인증서 승인 대상을 불러오는 중입니다."
    >
      {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
      {error || actionError ? <PageStatusNotice tone="error">{error || actionError}</PageStatusNotice> : null}
      {!loading && result && !result.canView ? (
        <MemberStateCard description="현재 계정으로는 인증서 승인 관리 화면을 조회할 수 없습니다." icon="lock" title="권한이 없습니다." tone="warning" />
      ) : null}
      <CanView allowed={result?.canView ?? false} fallback={null}>
        <CertificateApproveSearchSection
          applyFilters={applyFilters}
          currentPage={result?.pageIndex || 1}
          draftFilters={draftFilters}
          resetFilters={handleResetFilters}
          totalPages={result?.totalPages || 1}
          updateDraft={updateDraft}
        />
        <CertificateApproveTableSection
          approvalRows={result?.approvalRows || []}
          currentPage={result?.pageIndex || 1}
          handleAction={handleAction}
          movePage={movePage}
          openReview={setReviewCertificateId}
          page={result ? { canUseCertificateApproveAction: result.canUseAction, certificateApprovalTotalCount: result.totalCount } : null}
          rejectReason={rejectReason}
          selectedIds={selectedIds}
          toggleSelectAll={toggleSelectAll}
          toggleSelection={toggleSelection}
          totalPages={result?.totalPages || 1}
          updateRejectReason={setRejectReason}
        />
        <ReviewModalFrame
          footerLeft={(
            reviewRow ? <MemberPermissionButton allowed={result?.canUseAction ?? false} className="flex-1 justify-center whitespace-nowrap sm:min-w-[160px] sm:flex-none" onClick={() => handleAction("reject", String(reviewRow.certificateId || ""))} reason="마스터 관리자만 반려할 수 있습니다." size="lg" type="button" variant="dangerSecondary">{MEMBER_BUTTON_LABELS.reject}</MemberPermissionButton> : null
          )}
          footerRight={(
            reviewRow ? <MemberPermissionButton allowed={result?.canUseAction ?? false} className="flex-1 justify-center whitespace-nowrap sm:min-w-[160px] sm:flex-none" onClick={() => handleAction("approve", String(reviewRow.certificateId || ""))} reason="마스터 관리자만 승인할 수 있습니다." size="lg" type="button" variant="primary">{MEMBER_BUTTON_LABELS.approveDone}</MemberPermissionButton> : null
          )}
          onClose={() => {
            setReviewCertificateId("");
            setRejectReason("");
          }}
          open={!!reviewRow}
          title="인증서 발급 신청 상세 검토"
        >
          {reviewRow ? (
            <>
              <CertificateApproveReviewContent reviewRow={reviewRow} />
              <section className="mt-6">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-primary)]">반려 사유</span>
                  <textarea
                    className="gov-input min-h-[120px] py-3"
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="첨부 누락, REC 중복 검토, 정정 요청 사유 등을 입력하세요."
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
