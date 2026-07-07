import type { ReactNode } from "react";
import type { CertificateApprovePagePayload } from "../../lib/api/memberTypes";
import { AdminInput, AdminSelect } from "../admin-ui/common";
import {
  MemberButton,
  MemberButtonGroup,
  MemberPagination,
  MemberPermissionButton,
  MemberSectionToolbar,
  MEMBER_BUTTON_LABELS
} from "../member/common";

export type CertificateApproveFilters = {
  searchKeyword: string;
  requestType: string;
  status: string;
  pageIndex: number;
};

export const DEFAULT_CERTIFICATE_APPROVE_FILTERS: CertificateApproveFilters = {
  searchKeyword: "",
  requestType: "",
  status: "PENDING",
  pageIndex: 1
};

function isCertificateActionable(row: Record<string, unknown>) {
  const status = String(row.status || "").toUpperCase();
  return status === "PENDING" || status === "HOLD";
}

const REQUEST_TYPE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "ISSUE", label: "신규 발급" },
  { value: "REISSUE", label: "재발급" },
  { value: "CORRECTION", label: "정정 발급" }
];

const STATUS_OPTIONS = [
  { value: "PENDING", label: "승인 대기" },
  { value: "APPROVED", label: "승인 완료" },
  { value: "REJECTED", label: "반려" },
  { value: "HOLD", label: "보완 요청" }
];

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

function normalizeAttachmentFiles(value: unknown) {
  return toRecordArray(value);
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
      <h4 className="mb-3 flex items-center gap-2 text-[16px] font-bold">
        <span className="h-4 w-1 rounded-full bg-[var(--kr-gov-blue)]"></span>
        {title}
      </h4>
      {children}
    </section>
  );
}

export function CertificateApproveSearchSection({
  draftFilters,
  updateDraft,
  applyFilters,
  resetFilters,
  currentPage,
  totalPages
}: {
  draftFilters: CertificateApproveFilters;
  updateDraft: <K extends keyof CertificateApproveFilters>(key: K, value: CertificateApproveFilters[K]) => void;
  applyFilters: (nextPageIndex?: number) => void;
  resetFilters: () => void;
  currentPage: number;
  totalPages: number;
}) {
  return (
    <section className="gov-card mb-6 overflow-hidden p-0" data-help-id="certificate-approve-search">
      <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
        <MemberSectionToolbar
          actions={(
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              현재 페이지 {currentPage} / {totalPages}
            </span>
          )}
          meta="인증서 승인 화면은 검색 카드, 검토 목록, 상세 검토 모달 순서를 동일하게 유지합니다."
          title="검색 조건"
        />
      </div>
      <div className="grid gap-4 px-6 py-6 lg:grid-cols-[220px_220px_minmax(0,1fr)] lg:items-end">
        <label>
          <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">신청 구분</span>
          <AdminSelect value={draftFilters.requestType} onChange={(event) => updateDraft("requestType", event.target.value)}>
            {REQUEST_TYPE_OPTIONS.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
          </AdminSelect>
        </label>
        <label>
          <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">처리 상태</span>
          <AdminSelect value={draftFilters.status} onChange={(event) => updateDraft("status", event.target.value)}>
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </AdminSelect>
        </label>
        <label>
          <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">검색어</span>
          <AdminInput
            placeholder="신청번호, 회원사명, 보고서명 검색"
            value={draftFilters.searchKeyword}
            onChange={(event) => updateDraft("searchKeyword", event.target.value)}
          />
        </label>
      </div>
      <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
            REC 중복 여부, 첨부 검토, 반려 사유 입력을 한 화면에서 이어서 처리할 수 있도록 구성했습니다.
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

export function CertificateApproveTableSection({
  page,
  approvalRows,
  selectedIds,
  rejectReason,
  updateRejectReason,
  toggleSelectAll,
  toggleSelection,
  openReview,
  handleAction,
  currentPage,
  totalPages,
  movePage
}: {
  page: CertificateApprovePagePayload | null;
  approvalRows: Array<Record<string, unknown>>;
  selectedIds: string[];
  rejectReason: string;
  updateRejectReason: (value: string) => void;
  toggleSelectAll: (checked: boolean) => void;
  toggleSelection: (id: string) => void;
  openReview: (certificateId: string) => void;
  handleAction: (action: string, certificateId?: string) => void;
  currentPage: number;
  totalPages: number;
  movePage: (pageNumber: number) => void;
}) {
  const canUseBatchAction = !!page?.canUseCertificateApproveAction;
  const actionableIds = approvalRows
    .filter((row) => isCertificateActionable(row))
    .map((row, index) => String(row.certificateId || `certificate-${index}`));
  const hasSelection = selectedIds.length > 0;
  const allActionableSelected = actionableIds.length > 0 && actionableIds.every((id) => selectedIds.includes(id));

  return (
    <section className="gov-card overflow-hidden" data-help-id="certificate-approve-table">
      <MemberSectionToolbar
        actions={(
          <MemberButtonGroup data-help-id="certificate-approve-batch-actions">
            <MemberPermissionButton allowed={canUseBatchAction && hasSelection} onClick={() => handleAction("batch_approve")} reason={!canUseBatchAction ? "마스터 관리자만 승인할 수 있습니다." : undefined} type="button" variant="primary">선택 승인</MemberPermissionButton>
            <MemberPermissionButton allowed={canUseBatchAction && hasSelection} onClick={() => handleAction("batch_reject")} reason={!canUseBatchAction ? "마스터 관리자만 반려할 수 있습니다." : undefined} type="button" variant="dangerSecondary">선택 반려</MemberPermissionButton>
          </MemberButtonGroup>
        )}
        className="border-b border-[var(--kr-gov-border-light)] bg-gray-50 px-6 py-4"
        meta={<>총 <span className="font-bold text-[var(--kr-gov-blue)]">{Number(page?.certificateApprovalTotalCount || 0).toLocaleString()}</span>건</>}
        title="인증서 발급 승인 목록"
      />
      {hasSelection ? (
        <div className="border-b border-[var(--kr-gov-border-light)] bg-amber-50 px-6 py-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-primary)]">선택 반려 사유</span>
            <textarea
              className="gov-input min-h-[96px] py-3"
              onChange={(event) => updateRejectReason(event.target.value)}
              placeholder="선택 반려 시 공통 반려 사유를 입력하세요."
              value={rejectReason}
            />
          </label>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1320px] text-sm">
          <thead className="border-b border-[var(--kr-gov-border-light)] bg-gray-50">
            <tr className="text-left text-[var(--kr-gov-text-secondary)]">
              <th className="w-12 px-4 py-4 text-center">
                <input checked={allActionableSelected} className="rounded border-gray-300" onChange={(event) => toggleSelectAll(event.target.checked)} type="checkbox" />
              </th>
              <th className="px-4 py-4 font-bold">신청번호</th>
              <th className="px-4 py-4 font-bold">회원사</th>
              <th className="px-4 py-4 font-bold">보고서/인증서</th>
              <th className="px-4 py-4 font-bold">신청 구분</th>
              <th className="px-4 py-4 font-bold">연계 점검</th>
              <th className="px-4 py-4 font-bold">첨부파일</th>
              <th className="px-4 py-4 font-bold text-center">상태</th>
              <th className="px-4 py-4 font-bold text-center">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {approvalRows.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-gray-500" colSpan={9}>조회된 인증서 승인 신청이 없습니다.</td>
              </tr>
            ) : approvalRows.map((row, index) => {
              const certificateId = String(row.certificateId || `certificate-${index}`);
              const attachmentFiles = normalizeAttachmentFiles(row.attachmentFiles);
              const actionable = isCertificateActionable(row);
              return (
                <tr className="align-top hover:bg-gray-50/70" key={certificateId}>
                  <td className="px-4 py-4 text-center">
                    <input checked={selectedIds.includes(certificateId)} className="rounded border-gray-300 disabled:cursor-not-allowed disabled:opacity-50" disabled={!actionable || !canUseBatchAction} onChange={() => toggleSelection(certificateId)} type="checkbox" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-[var(--kr-gov-text-primary)]">{String(row.requestNumber || "-")}</div>
                    <div className="mt-1 text-xs text-gray-500">{String(row.requestedAt || "-")}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-[var(--kr-gov-text-primary)]">{String(row.companyName || "-")}</div>
                    <div className="mt-1 text-xs text-gray-500">{String(row.businessNumber || "-")}</div>
                    <div className="mt-1 text-xs text-gray-500">{String(row.requesterName || "-")}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-[var(--kr-gov-text-primary)]">{String(row.reportTitle || "-")}</div>
                    <div className="mt-1 text-xs text-gray-500">정산 기간 {String(row.reportingPeriod || "-")}</div>
                    <div className="mt-1 text-xs text-gray-500">예상 인증량 {String(row.estimatedVolumeLabel || "-")}</div>
                  </td>
                  <td className="px-4 py-4 text-gray-700">{String(row.requestTypeLabel || "-")}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${String(row.recCheckBadgeClass || "bg-slate-100 text-slate-700")}`}>{String(row.recCheckStatus || "-")}</span>
                      <span className="text-xs text-gray-500">{String(row.gridCheckSummary || "-")}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      {attachmentFiles.length === 0 ? <span className="text-xs text-gray-400">등록 파일 없음</span> : attachmentFiles.map((file, fileIndex) => (
                        <a className="inline-flex items-center gap-1 text-xs font-bold text-[var(--kr-gov-blue)] hover:underline" href={String(file.downloadUrl || "#")} key={`${String(file.fileName || "file")}-${fileIndex}`}>
                          {String(file.fileName || "-")}
                        </a>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${String(row.statusBadgeClass || "bg-slate-100 text-slate-700")}`}>{String(row.statusLabel || "-")}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <MemberButton onClick={() => openReview(certificateId)} size="xs" type="button" variant="secondary">{MEMBER_BUTTON_LABELS.review}</MemberButton>
                      <MemberPermissionButton allowed={!!page?.canUseCertificateApproveAction && actionable} onClick={() => handleAction("approve", certificateId)} reason={!page?.canUseCertificateApproveAction ? "마스터 관리자만 승인할 수 있습니다." : "승인 대기 또는 보완 요청 상태만 처리할 수 있습니다."} size="xs" type="button" variant="primary">{MEMBER_BUTTON_LABELS.approve}</MemberPermissionButton>
                      <MemberPermissionButton allowed={!!page?.canUseCertificateApproveAction && actionable} onClick={() => openReview(certificateId)} reason={!page?.canUseCertificateApproveAction ? "마스터 관리자만 반려할 수 있습니다." : "승인 대기 또는 보완 요청 상태만 처리할 수 있습니다."} size="xs" type="button" variant="dangerSecondary">{MEMBER_BUTTON_LABELS.reject}</MemberPermissionButton>
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

export function CertificateApproveReviewContent({
  reviewRow
}: {
  reviewRow: Record<string, unknown>;
}) {
  const attachmentFiles = normalizeAttachmentFiles(reviewRow.attachmentFiles);
  return (
    <>
      <ReviewBlock title="신청 기본 정보">
        <ReviewDataTable rows={[
          ["신청번호", String(reviewRow.requestNumber || "-")],
          ["신청 상태", String(reviewRow.statusLabel || "-")],
          ["신청 구분", String(reviewRow.requestTypeLabel || "-")],
          ["신청일시", String(reviewRow.requestedAt || "-")]
        ]} />
      </ReviewBlock>

      <ReviewBlock title="회원사 및 보고서 정보">
        <ReviewDataTable rows={[
          ["회원사명", String(reviewRow.companyName || "-")],
          ["사업자등록번호", String(reviewRow.businessNumber || "-")],
          ["신청자", String(reviewRow.requesterName || "-")],
          ["보고서명", String(reviewRow.reportTitle || "-")],
          ["정산 기간", String(reviewRow.reportingPeriod || "-")],
          ["예상 인증량", String(reviewRow.estimatedVolumeLabel || "-")]
        ]} />
      </ReviewBlock>

      <ReviewBlock title="검토 포인트">
        <ReviewDataTable rows={[
          ["REC 중복 여부", String(reviewRow.recCheckStatus || "-")],
          ["전력거래소 연계", String(reviewRow.gridCheckSummary || "-")],
          ["운영 메모", String(reviewRow.reviewerMemo || "-")],
          ["최근 반려 사유", String(reviewRow.rejectReason || "-")]
        ]} />
      </ReviewBlock>

      <ReviewBlock title="첨부 파일">
        <div className="space-y-2 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-4">
          {attachmentFiles.length === 0 ? <p className="text-sm text-gray-500">첨부된 파일이 없습니다.</p> : attachmentFiles.map((file, index) => (
            <a className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:bg-slate-50" href={String(file.downloadUrl || "#")} key={`${String(file.fileName || "file")}-${index}`}>
              <span>{String(file.fileName || "-")}</span>
              <span className="text-xs text-slate-500">{String(file.fileSizeLabel || "-")}</span>
            </a>
          ))}
        </div>
      </ReviewBlock>
    </>
  );
}
