import { useCallback, useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { CanView } from "../../components/access/CanView";
import { submitCompanyApproveAction } from "../../lib/api/adminActions";
import { fetchCompanyApprovePage } from "../../lib/api/adminMember";
import { buildLocalizedPath, getSearchParam } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { MemberPermissionButton, MEMBER_BUTTON_LABELS, PageStatusNotice } from "../member/common";
import { MemberStateCard, ReviewModalFrame } from "../member/sections";
import { CompanyApproveFilters, CompanyApproveReviewContent, CompanyApproveSearchSection, CompanyApproveTableSection, DEFAULT_COMPANY_APPROVE_FILTERS } from "./companyApproveSections";

function readInitialPageIndex() {
  const raw = Number(getSearchParam("pageIndex") || DEFAULT_COMPANY_APPROVE_FILTERS.pageIndex);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_COMPANY_APPROVE_FILTERS.pageIndex;
}

export function CompanyApproveMigrationPage() {
  const [pageData, setPageData] = useState<{
    searchKeyword: string;
    status: string;
    pageIndex: number;
  }>({
    searchKeyword: getSearchParam("searchKeyword"),
    status: getSearchParam("sbscrbSttus") || DEFAULT_COMPANY_APPROVE_FILTERS.status,
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
  const [draftFilters, setDraftFilters] = useState<CompanyApproveFilters>({
    searchKeyword: getSearchParam("searchKeyword"),
    status: getSearchParam("sbscrbSttus") || DEFAULT_COMPANY_APPROVE_FILTERS.status,
    pageIndex: readInitialPageIndex()
  });
  const [actionError, setActionError] = useState(() => getSearchParam("errorMessage"));
  const [message, setMessage] = useState(() => {
    const r = getSearchParam("result");
    return r === "success" ? "승인이 완료되었습니다." : r === "reject" ? "반려가 완료되었습니다." : "";
  });
  const [reviewInsttId, setReviewInsttId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  
  const sessionState = useFrontendSession();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    
    fetchCompanyApprovePage({
      pageIndex: pageData.pageIndex,
      searchKeyword: pageData.searchKeyword,
      sbscrbSttus: pageData.status,
      result: getSearchParam("result") || ""
    })
      .then(data => {
        if (cancelled) return;
        setResult({
          approvalRows: data.approvalRows || [],
          totalPages: Number(data.totalPages || 1),
          totalCount: Number(data.memberApprovalTotalCount || 0),
          pageIndex: Number(data.pageIndex || 1),
          canView: data.canViewCompanyApprove !== false,
          canUseAction: data.canUseCompanyApproveAction === true,
          resultMessage: String(data.memberApprovalResultMessage || "")
        });
        setDraftFilters({
          searchKeyword: String(data.searchKeyword || ""),
          status: String(data.sbscrbSttus || "A"),
          pageIndex: Number(data.pageIndex || 1)
        });
        setSelectedIds([]);
        if (data.memberApprovalResultMessage) {
          setMessage(String(data.memberApprovalResultMessage));
        }
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "데이터 로딩 실패");
        setLoading(false);
      });
    
    return () => { cancelled = true; };
  }, [pageData.pageIndex, pageData.searchKeyword, pageData.status, reloadKey]);

  const reviewRow = result?.approvalRows.find(r => String(r.insttId || "") === reviewInsttId) || null;

  useEffect(() => {
    if (!result || !sessionState.value) {
      return;
    }
    logGovernanceScope("PAGE", "company-approve", {
      route: window.location.pathname,
      actorUserId: sessionState.value.userId || "",
      actorAuthorCode: sessionState.value.authorCode || "",
      actorInsttId: sessionState.value.insttId || "",
      canUseAction: result.canUseAction,
      selectedCount: selectedIds.length,
      totalCount: result.totalCount
    });
    logGovernanceScope("COMPONENT", "company-approve-table", {
      component: "company-approve-table",
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

  const updateDraft = useCallback((key: keyof CompanyApproveFilters, value: string | number) => {
    setDraftFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const applyFilters = useCallback((nextPageIndex = 1) => {
    setActionError("");
    logGovernanceScope("ACTION", "company-approve-search", {
      actorInsttId: sessionState.value?.insttId || "",
      searchKeyword: draftFilters.searchKeyword,
      status: draftFilters.status,
      pageIndex: nextPageIndex
    });
    setPageData(prev => ({ ...prev, ...draftFilters, pageIndex: nextPageIndex }));
  }, [draftFilters, sessionState.value?.insttId]);

  const movePage = useCallback((nextPageIndex: number) => {
    setActionError("");
    setPageData(prev => ({ ...prev, pageIndex: nextPageIndex }));
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const handleAction = useCallback(async (action: string, insttId?: string) => {
    const session = sessionState.value;
    if (!session) return;
    setActionError("");
    logGovernanceScope("ACTION", "company-approve-submit", {
      actorInsttId: session.insttId || "",
      action,
      insttId: insttId || "",
      selectedCount: selectedIds.length
    });
    try {
      await submitCompanyApproveAction(session, {
        action,
        insttId,
        selectedIds: insttId ? undefined : selectedIds,
        rejectReason
      });
      setReloadKey((current) => current + 1);
      setSelectedIds([]);
      if (insttId) {
        setReviewInsttId("");
        setRejectReason("");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "승인 처리 실패");
    }
  }, [sessionState.value, selectedIds, rejectReason]);

  const toggleSelectAll = useCallback((checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(result?.approvalRows.map((row, i) => String(row.insttId || `instt-${i}`)) || []);
  }, [result?.approvalRows]);

  const handleResetFilters = useCallback(() => {
    setDraftFilters(DEFAULT_COMPANY_APPROVE_FILTERS);
    setPageData(prev => ({ ...prev, ...DEFAULT_COMPANY_APPROVE_FILTERS }));
  }, []);

  return (
    <AdminPageShell
      actions={(
        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-blue-50 text-[var(--kr-gov-blue)]">
          총 {result?.totalCount?.toLocaleString() || 0}건
        </span>
      )}
      breadcrumbs={[
        { label: "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: "회원사" },
        { label: "회원사 가입승인" }
      ]}
      subtitle="회원사 등록 신청 내역을 검토하고 승인 또는 반려 상태를 처리합니다."
      title="회원사 가입승인"
      loading={loading && !result}
      loadingLabel="회원사 승인 대상을 불러오는 중입니다."
    >
      {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
      {error || actionError ? <PageStatusNotice tone="error">{error || actionError}</PageStatusNotice> : null}
      {!loading && result && !result.canView ? (
        <MemberStateCard description="현재 계정으로는 회원사 승인 관리 화면을 조회할 수 없습니다." icon="lock" title="권한이 없습니다." tone="warning" />
      ) : null}
      <CanView allowed={result?.canView ?? false} fallback={null}>
        <CompanyApproveSearchSection
          applyFilters={applyFilters}
          currentPage={result?.pageIndex || 1}
          draftFilters={draftFilters}
          resetFilters={handleResetFilters}
          totalPages={result?.totalPages || 1}
          updateDraft={updateDraft}
        />

        <CompanyApproveTableSection
          approvalRows={result?.approvalRows || []}
          currentPage={result?.pageIndex || 1}
          handleAction={handleAction}
          movePage={movePage}
          openReview={setReviewInsttId}
          page={result ? { canUseCompanyApproveAction: result.canUseAction, memberApprovalTotalCount: result.totalCount } : null}
          selectedIds={selectedIds}
          toggleSelectAll={toggleSelectAll}
          toggleSelection={toggleSelection}
          totalPages={result?.totalPages || 1}
        />

        <ReviewModalFrame
          footerLeft={(
            reviewRow ? <MemberPermissionButton allowed={result?.canUseAction ?? false} className="flex-1 sm:min-w-[160px] sm:flex-none justify-center whitespace-nowrap" onClick={() => handleAction("reject", String(reviewRow.insttId || ""))} reason="마스터 관리자만 반려할 수 있습니다." size="lg" type="button" variant="dangerSecondary">{MEMBER_BUTTON_LABELS.reject}</MemberPermissionButton> : null
          )}
          footerRight={(
            reviewRow ? <MemberPermissionButton allowed={result?.canUseAction ?? false} className="flex-1 sm:min-w-[160px] sm:flex-none justify-center whitespace-nowrap" onClick={() => handleAction("approve", String(reviewRow.insttId || ""))} reason="마스터 관리자만 승인할 수 있습니다." size="lg" type="button" variant="primary">{MEMBER_BUTTON_LABELS.approveDone}</MemberPermissionButton> : null
          )}
          onClose={() => {
            setReviewInsttId("");
            setRejectReason("");
          }}
          open={!!reviewRow}
          title="회원사 가입 신청 상세 검토"
        >
          {reviewRow ? (
            <>
              <CompanyApproveReviewContent reviewRow={reviewRow} />
              <section className="mt-6">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-primary)]">반려 사유</span>
                  <textarea
                    className="gov-input min-h-[120px] py-3"
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="회원사 반려 사유를 입력하세요."
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
