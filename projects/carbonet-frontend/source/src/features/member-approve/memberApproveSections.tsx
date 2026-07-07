import type { ReactNode } from "react";
import type { MemberApprovePagePayload } from "../../lib/api/memberTypes";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import {
  AdminInput,
  AdminSelect,
  MemberButton,
  MemberButtonGroup,
  MemberPagination,
  MemberPermissionButton,
  MemberSectionToolbar,
  MEMBER_BUTTON_LABELS
} from "../member/common";
import { MEMBER_APPROVAL_STATUS_OPTIONS, MEMBER_TYPE_OPTIONS } from "../member/shared";

export type MemberApproveFilters = {
  searchKeyword: string;
  membershipType: string;
  status: string;
  pageIndex: number;
};

export const DEFAULT_MEMBER_APPROVE_FILTERS: MemberApproveFilters = {
  searchKeyword: "",
  membershipType: "",
  status: "A",
  pageIndex: 1
};

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

export function normalizeMemberApprovalRows(value: unknown) {
  return toRecordArray(value);
}

export function MemberApproveSearchSection({
  draftFilters,
  updateDraft,
  applyFilters,
  resetFilters
}: {
  draftFilters: MemberApproveFilters;
  updateDraft: <K extends keyof MemberApproveFilters>(key: K, value: MemberApproveFilters[K]) => void;
  applyFilters: (nextPageIndex?: number) => void;
  resetFilters: () => void;
}) {
  return (
    <section className="gov-card mb-6 overflow-hidden p-0" data-help-id="member-approve-search">
      <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
        <MemberSectionToolbar
          meta="회원 승인 목록은 유형, 상태, 검색어 조합을 동일한 검색 카드 구조 안에서 유지합니다."
          title="검색 조건"
        />
      </div>
      <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4">
        <div>
          <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">회원 유형</span>
          <AdminSelect value={draftFilters.membershipType} onChange={(event) => updateDraft("membershipType", event.target.value)}>
            {MEMBER_TYPE_OPTIONS.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
          </AdminSelect>
        </div>
        <div>
          <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">상태</span>
          <AdminSelect value={draftFilters.status} onChange={(event) => updateDraft("status", event.target.value)}>
            {MEMBER_APPROVAL_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </AdminSelect>
        </div>
        <div className="md:col-span-2">
          <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">검색어</span>
          <AdminInput
            className="flex-1"
            placeholder="신청자명, 회원사명, 사업자등록번호 검색"
            value={draftFilters.searchKeyword}
            onChange={(event) => updateDraft("searchKeyword", event.target.value)}
          />
        </div>
      </div>
      <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
            동일한 목록형 화면은 검색 카드, 상단 툴바, 결과 테이블 순서를 유지합니다.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MemberButton onClick={resetFilters} type="button" variant="secondary">{MEMBER_BUTTON_LABELS.reset}</MemberButton>
            <MemberButton onClick={() => applyFilters(1)} type="button" variant="primary">{MEMBER_BUTTON_LABELS.search}</MemberButton>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MemberApproveTableSection({
  page,
  approvalRows,
  selectedIds,
  toggleSelectAll,
  toggleSelection,
  openReview,
  handleAction,
  currentPage,
  totalPages,
  movePage
}: {
  page: MemberApprovePagePayload | null;
  approvalRows: Array<Record<string, unknown>>;
  selectedIds: string[];
  toggleSelectAll: (checked: boolean) => void;
  toggleSelection: (id: string) => void;
  openReview: (memberId: string) => void;
  handleAction: (action: string, memberId?: string) => void;
  currentPage: number;
  totalPages: number;
  movePage: (pageNumber: number) => void;
}) {
  const canUseBatchAction = !!page?.canUseMemberApproveAction;
  const hasSelection = selectedIds.length > 0;

  return (
    <section className="gov-card overflow-hidden" data-help-id="member-approve-table">
      <MemberSectionToolbar
        actions={(
          <MemberButtonGroup data-help-id="member-approve-batch-actions">
            <MemberPermissionButton allowed={canUseBatchAction && hasSelection} onClick={() => handleAction("batch_approve")} reason={!canUseBatchAction ? "권한 있는 관리자만 승인할 수 있습니다." : undefined} type="button" variant="primary">선택 승인</MemberPermissionButton>
            <MemberPermissionButton allowed={canUseBatchAction && hasSelection} onClick={() => handleAction("batch_reject")} reason={!canUseBatchAction ? "권한 있는 관리자만 반려할 수 있습니다." : undefined} type="button" variant="dangerSecondary">선택 반려</MemberPermissionButton>
          </MemberButtonGroup>
        )}
        className="border-b border-[var(--kr-gov-border-light)] bg-gray-50 px-6 py-4"
        meta={<>총 <span className="font-bold text-[var(--kr-gov-blue)]">{Number(page?.memberApprovalTotalCount || 0).toLocaleString()}</span>건</>}
        title="회원 가입 승인 목록"
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="border-b border-[var(--kr-gov-border-light)] bg-gray-50">
            <tr className="text-left text-[var(--kr-gov-text-secondary)]">
              <th className="w-12 px-4 py-4 text-center">
                <input checked={approvalRows.length > 0 && selectedIds.length === approvalRows.length} className="rounded border-gray-300" onChange={(event) => toggleSelectAll(event.target.checked)} type="checkbox" />
              </th>
              <th className="px-4 py-4 font-bold">신청자</th>
              <th className="px-4 py-4 font-bold">회원사</th>
              <th className="px-4 py-4 font-bold">회원 유형</th>
              <th className="px-4 py-4 font-bold">사업자등록번호</th>
              <th className="px-4 py-4 font-bold">증빙 서류</th>
              <th className="px-4 py-4 font-bold text-center">상태</th>
              <th className="px-4 py-4 font-bold text-center">처리</th>
            </tr>
          </thead>
          <tbody>
            {approvalRows.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-gray-500" colSpan={8}>조회된 승인 대상 회원이 없습니다.</td>
              </tr>
            ) : approvalRows.map((row, index) => {
              const memberId = String(row.memberId || `member-${index}`);
              const evidenceFiles = ((row.evidenceFiles as Array<Record<string, unknown>> | undefined) || []);
              const evidenceCount = Number(row.evidenceFileCount || evidenceFiles.length || 0);

              return (
                <tr className="border-b border-[var(--kr-gov-border-light)] align-top" key={memberId}>
                  <td className="px-4 py-4 text-center">
                    <input checked={selectedIds.includes(memberId)} className="rounded border-gray-300" onChange={() => toggleSelection(memberId)} type="checkbox" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-gray-900">{String(row.memberName || "-")}</div>
                    <div className="mt-1 text-xs text-gray-500">{memberId}</div>
                    <div className="mt-2 text-xs text-gray-500">{String(row.joinDate || "-")}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-gray-900">{String(row.companyName || "-")}</div>
                    <div className="mt-1 text-xs text-gray-500">{String(row.departmentName || "-")}</div>
                    <div className="mt-1 text-xs text-gray-500">{String(row.representativeName || "-")}</div>
                  </td>
                  <td className="px-4 py-4 text-gray-700">{String(row.membershipTypeLabel || "-")}</td>
                  <td className="px-4 py-4 text-gray-700">{String(row.businessNumber || "-")}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      {evidenceFiles.length === 0 ? <span className="text-xs text-gray-400">등록 파일 없음</span> : evidenceFiles.map((file, fileIndex) => (
                        <a className="inline-flex items-center gap-1 text-xs font-bold text-[var(--kr-gov-blue)] hover:underline" href={String(file.downloadUrl || "#")} key={`${String(file.fileName || "file")}-${fileIndex}`}>
                          {String(file.fileName || "-")}
                        </a>
                      ))}
                      <span className="text-xs text-gray-500">총 {evidenceCount.toLocaleString()}건</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${String(row.statusBadgeClass || "bg-slate-100 text-slate-700")}`}>{String(row.statusLabel || "-")}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <MemberButton onClick={() => openReview(memberId)} size="xs" type="button" variant="secondary">{MEMBER_BUTTON_LABELS.review}</MemberButton>
                      <MemberPermissionButton allowed={!!page?.canUseMemberApproveAction} onClick={() => handleAction("approve", memberId)} reason="권한 있는 관리자만 승인할 수 있습니다." size="xs" type="button" variant="primary">{MEMBER_BUTTON_LABELS.approve}</MemberPermissionButton>
                      <MemberPermissionButton allowed={!!page?.canUseMemberApproveAction} onClick={() => handleAction("reject", memberId)} reason="권한 있는 관리자만 반려할 수 있습니다." size="xs" type="button" variant="dangerSecondary">{MEMBER_BUTTON_LABELS.reject}</MemberPermissionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MemberPagination currentPage={currentPage} onPageChange={movePage} totalPages={totalPages} />
    </section>
  );
}

function ReviewDataTable({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <div className="border-t-2 border-[var(--kr-gov-text-primary)]">
      {rows.map(([label, value]) => (
        <div className="grid grid-cols-[140px_1fr]" key={label}>
          <div className="border-b border-r border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-3 text-sm font-bold text-[var(--kr-gov-text-secondary)]">{label}</div>
          <div className="border-b border-[var(--kr-gov-border-light)] px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 flex items-center gap-2 text-[16px] font-bold"><span className="h-4 w-1 rounded-full bg-[var(--kr-gov-blue)]"></span>{title}</h4>
      {children}
    </section>
  );
}

export function MemberApproveReviewContent({
  reviewRow
}: {
  reviewRow: Record<string, unknown>;
}) {
  const memberId = String(reviewRow.memberId || "");
  const evidenceFiles = ((reviewRow.evidenceFiles as Array<Record<string, unknown>> | undefined) || []);

  return (
    <>
      <ReviewBlock title="회원 기본 정보">
        <ReviewDataTable rows={[
          ["신청자명", String(reviewRow.memberName || "-")],
          ["회원 ID", memberId || "-"],
          ["회원 유형", String(reviewRow.membershipTypeLabel || "-")],
          ["현재 상태", String(reviewRow.statusLabel || "-")]
        ]} />
      </ReviewBlock>

      <ReviewBlock title="소속 및 신청 정보">
        <ReviewDataTable rows={[
          ["회원사명", String(reviewRow.companyName || "-")],
          ["부서명", String(reviewRow.departmentName || "-")],
          ["대표자명", String(reviewRow.representativeName || "-")],
          ["사업자등록번호", String(reviewRow.businessNumber || "-")],
          ["가입일", String(reviewRow.joinDate || "-")],
          ["상세 정보", <a className="font-bold text-[var(--kr-gov-blue)] hover:underline" href={String(reviewRow.detailUrl || buildLocalizedPath(`/admin/member/detail?memberId=${encodeURIComponent(memberId)}`, `/en/admin/member/detail?memberId=${encodeURIComponent(memberId)}`))}>회원 상세 화면으로 이동</a>]
        ]} />
      </ReviewBlock>

      <ReviewBlock title="증빙 서류 확인">
        <div className="space-y-3 rounded-[var(--kr-gov-radius)] bg-[#f2f2f2] p-4">
          {evidenceFiles.length === 0 ? (
            <div className="rounded border border-dashed border-[var(--kr-gov-border-light)] bg-white px-4 py-6 text-center text-sm text-gray-500">등록된 첨부 파일이 없습니다.</div>
          ) : evidenceFiles.map((file, index) => (
            <div className="flex items-center justify-between rounded border border-[var(--kr-gov-border-light)] bg-white p-3" key={`${String(file.fileName || "file")}-${index}`}>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-gray-500">description</span>
                <span className="text-sm font-medium">{String(file.fileName || "-")}</span>
              </div>
              <MemberButton className="text-[var(--kr-gov-blue)]" icon="visibility" onClick={() => { window.open(String(file.downloadUrl || "#"), "_blank", "noopener,noreferrer"); }} size="xs" type="button" variant="info">
                {MEMBER_BUTTON_LABELS.preview}
              </MemberButton>
            </div>
          ))}
        </div>
      </ReviewBlock>
    </>
  );
}
