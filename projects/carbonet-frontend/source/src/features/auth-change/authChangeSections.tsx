import type { Dispatch, SetStateAction } from "react";
import type { AuthChangePagePayload } from "../../lib/api/authTypes";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { AdminInput, AdminSelect, AdminTable, DiagnosticCard, GridToolbar, MemberButton, MemberPagination, MemberPermissionButton } from "../admin-ui/common";

function t(page: AuthChangePagePayload | null, ko: string, en: string) {
  return page?.isEn ? en : ko;
}

export function formatResultStatus(page: AuthChangePagePayload | null, status: string) {
  const normalized = status.trim().toUpperCase();
  if (normalized === "SUCCESS") return t(page, "성공", "Success");
  if (normalized === "FAIL" || normalized === "FAILED" || normalized === "ERROR") return t(page, "실패", "Failed");
  return status || t(page, "성공", "Success");
}

export function AuthChangeOverview({
  page,
  pendingCount
}: {
  page: AuthChangePagePayload | null;
  pendingCount: number;
}) {
  return (
    <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
      <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
          <h3 className="font-black">{t(page, "이 화면의 역할", "Purpose of this page")}</h3>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
            {t(page, "사용자 단위로 현재 Role을 확인하고, 회원 수정 화면과 연계할 권한 변경 기준을 검토합니다.", "Review the current role per user and check the authority-change baseline used with member editing.")}
          </p>
      </article>
      <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
          <h3 className="font-black">{t(page, "권장 운영", "Recommended operation")}</h3>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
            {t(page, "기본 권한은 권한 그룹/부서 권한에서 정하고, 여기서는 개인 예외와 직접 변경만 다룹니다.", "Keep baseline authority in role groups and department roles, and use this page only for direct exceptions.")}
          </p>
      </article>
      <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
          <h3 className="font-black">{t(page, "다음 단계", "Next step")}</h3>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
            {t(page, "저장 기능은 사용자-Role 변경 이력과 함께 붙이는 것이 안전합니다.", "Saving should be paired with user-role change history for safer operations.")}
          </p>
      </article>
      <DiagnosticCard
        className="bg-blue-50"
        description={pendingCount > 0 ? t(page, "저장되지 않은 관리자 권한 변경이 있습니다.", "There are unsaved administrator role changes.") : t(page, "현재 저장 대기 중인 변경이 없습니다.", "There are no unsaved administrator role changes.")}
        status={pendingCount > 0 ? t(page, "저장 필요", "Pending save") : t(page, "정상", "Clean")}
        statusTone={pendingCount > 0 ? "warning" : "healthy"}
        summary={<p className="text-2xl font-black text-[var(--kr-gov-blue)]">{pendingCount}</p>}
        title={t(page, "저장 전 변경", "Pending changes")}
      />
    </section>
  );
}

export function AuthChangeSelectedCard({
  page,
  selectedAssignment,
  selectedDraftAuthorCode,
  selectedDraftAuthorName
}: {
  page: AuthChangePagePayload | null;
  selectedAssignment: { emplyrId: string; userNm: string; authorNm?: string; authorCode?: string } | null;
  selectedDraftAuthorCode: string;
  selectedDraftAuthorName: string;
}) {
  if (!selectedAssignment) return null;
  return (
    <section className="mb-8 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-blue)]">{t(page, "선택 관리자", "Selected admin")}</p>
          <p className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{selectedAssignment.userNm} ({selectedAssignment.emplyrId})</p>
          <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
            {t(page, "현재", "Current")}: {selectedAssignment.authorNm || t(page, "미지정", "Unassigned")} {" -> "}
            {t(page, "변경안", "Draft")}: {selectedDraftAuthorName || selectedDraftAuthorCode || t(page, "미지정", "Unassigned")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedDraftAuthorCode !== (selectedAssignment.authorCode || "") ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{t(page, "저장 대기 변경", "Pending save")}</span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{t(page, "변경 없음", "No pending change")}</span>
          )}
          <a
            className="inline-flex items-center rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-[var(--kr-gov-blue)]"
            href={buildLocalizedPath(
              `/admin/system/observability?pageId=auth-change&actionCode=ADMIN_ROLE_ASSIGNMENT_SAVE&searchKeyword=${encodeURIComponent(selectedAssignment.emplyrId)}`,
              `/en/admin/system/observability?pageId=auth-change&actionCode=ADMIN_ROLE_ASSIGNMENT_SAVE&searchKeyword=${encodeURIComponent(selectedAssignment.emplyrId)}`
            )}
          >
            {t(page, "선택 관리자 이력", "Selected admin history")}
          </a>
        </div>
      </div>
    </section>
  );
}

export function AuthChangeTableSection({
  page,
  canEdit,
  searchDraft,
  searchKeyword,
  setSearchDraft,
  assignmentFilter,
  setAssignmentFilter,
  pendingCount,
  savingEmplyrId,
  onBulkSave,
  pagedAssignments,
  selectedAdminId,
  setSelectedAdminId,
  drafts,
  setDrafts,
  onSave,
  currentPage,
  totalPages,
  setPageIndex,
  onSearchSubmit
}: {
  page: AuthChangePagePayload | null;
  canEdit: boolean;
  searchDraft: string;
  searchKeyword: string;
  setSearchDraft: (value: string) => void;
  assignmentFilter: string;
  setAssignmentFilter: (value: string) => void;
  pendingCount: number;
  savingEmplyrId: string;
  onBulkSave: () => void;
  pagedAssignments: Array<{ emplyrId: string; userNm: string; authorNm?: string; authorCode?: string }>;
  selectedAdminId: string;
  setSelectedAdminId: (value: string) => void;
  drafts: Record<string, string>;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onSave: (emplyrId: string) => void;
  currentPage: number;
  totalPages: number;
  setPageIndex: (value: number) => void;
  onSearchSubmit: () => void;
}) {
  return (
    <section className="gov-card" data-help-id="auth-change-table">
      <div data-help-id="auth-change-summary" hidden />
      <GridToolbar
        actions={(
          <MemberButton className="w-full sm:w-auto" disabled={!canEdit || pendingCount === 0 || savingEmplyrId === "__bulk__"} onClick={onBulkSave} type="button" variant="primary">
            {t(page, "변경 일괄 저장", "Save pending changes")}
          </MemberButton>
        )}
        title={t(page, "관리자 권한 변경 대상", "Administrator Authority Targets")}
      />
      <div className="p-6">
      <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_0.7fr_auto]">
        <label>
          <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{t(page, "관리자 검색", "Admin Search")}</span>
          <AdminInput
            placeholder={t(page, "ID, 이름, 현재 권한 검색", "Search by ID, name, or current role")}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSearchSubmit();
              }
            }}
          />
        </label>
        <label>
          <span className="mb-2 block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">{t(page, "변경 상태", "Change State")}</span>
          <AdminSelect value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)}>
            <option value="ALL">{t(page, "전체", "All")}</option>
            <option value="PENDING">{t(page, "변경 대기만", "Pending only")}</option>
            <option value="UNCHANGED">{t(page, "변경 없음", "Unchanged")}</option>
          </AdminSelect>
        </label>
        <div className="flex items-end">
          <MemberButton className="w-full sm:w-auto" onClick={onSearchSubmit} type="button" variant="secondary">
            {t(page, "조회", "Search")}
          </MemberButton>
        </div>
      </div>
      {searchKeyword ? (
        <p className="mb-4 text-sm text-[var(--kr-gov-text-secondary)]">
          {t(page, "적용 검색어", "Applied keyword")}: <span className="font-semibold text-[var(--kr-gov-text-primary)]">{searchKeyword}</span>
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <AdminTable className="min-w-[960px]">
          <thead className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
            <tr>
              <th className="px-4 py-3">{t(page, "관리자", "Administrator")}</th>
              <th className="px-4 py-3">{t(page, "현재 권한", "Current role")}</th>
              <th className="px-4 py-3">{t(page, "변경 권한", "Draft role")}</th>
              <th className="px-4 py-3">{t(page, "변경 요약", "Change summary")}</th>
              <th className="px-4 py-3 text-right">{t(page, "저장", "Save")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagedAssignments.map((row) => {
              const draftCode = drafts[row.emplyrId] || "";
              const changed = draftCode !== (row.authorCode || "");
              return (
                <tr className={selectedAdminId === row.emplyrId ? "bg-blue-50/60" : ""} id={`auth-change-row-${row.emplyrId}`} key={row.emplyrId} onClick={() => setSelectedAdminId(row.emplyrId)}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{row.userNm}</div>
                    <div className="text-xs text-[var(--kr-gov-text-secondary)]">{row.emplyrId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{row.authorNm || t(page, "미지정", "Unassigned")}</div>
                    <div className="text-xs text-[var(--kr-gov-text-secondary)]">{row.authorCode || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <AdminSelect className="min-w-[16rem] h-10 px-3 text-sm" disabled={!canEdit} value={draftCode} onChange={(event) => setDrafts((current) => ({ ...current, [row.emplyrId]: event.target.value }))}>
                      {((page?.authorGroupSections || []).length > 0 ? (page?.authorGroupSections || []).map((section) => (
                        <optgroup key={section.layerKey} label={section.sectionLabel}>
                          {(section.groups || []).map((group) => (
                            <option key={group.authorCode} value={group.authorCode}>{group.authorNm} ({group.authorCode})</option>
                          ))}
                        </optgroup>
                      )) : (page?.authorGroups || []).map((group) => (
                        <option key={group.authorCode} value={group.authorCode}>{group.authorNm} ({group.authorCode})</option>
                      )))}
                    </AdminSelect>
                  </td>
                  <td className="px-4 py-3">
                    {changed ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{t(page, "추가/변경 예정", "Pending change")}</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{t(page, "변경 없음", "No change")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MemberPermissionButton allowed={canEdit} disabled={!changed || savingEmplyrId === row.emplyrId} onClick={() => onSave(row.emplyrId)} reason={t(page, "webmaster만 관리자 권한을 변경할 수 있습니다.", "Only webmaster can change administrator roles.")} size="xs" type="button" variant="primary">
                      {t(page, "저장", "Save")}
                    </MemberPermissionButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </AdminTable>
      </div>
      <MemberPagination className="px-4 py-3" currentPage={currentPage} onPageChange={setPageIndex} totalPages={totalPages} />
      </div>
    </section>
  );
}

export function AuthChangeHistorySection({
  page,
  rows
}: {
  page: AuthChangePagePayload | null;
  rows: Array<Record<string, string>>;
}) {
  return (
    <section className="mt-8 gov-card" data-help-id="auth-change-history">
      <GridToolbar title={t(page, "최근 권한 변경 이력", "Recent role change history")} />
      <div className="space-y-3 p-6">
        {rows.length === 0 ? (
          <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{t(page, "표시할 이력이 없습니다.", "No history to show.")}</div>
        ) : rows.map((row, index) => (
          <article className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3" key={`${row.targetUserId}-${row.changedAt}-${index}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{row.targetUserId}</p>
                <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{row.changedAt} · {row.changedBy}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${row.resultStatus === "SUCCESS" || row.resultStatus === "성공" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                {formatResultStatus(page, row.resultStatus || "")}
              </span>
            </div>
            <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
              {row.beforeAuthorName || row.beforeAuthorCode || t(page, "미지정", "Unassigned")} {" -> "}
              <span className="font-bold text-[var(--kr-gov-text-primary)]">{row.afterAuthorName || row.afterAuthorCode || t(page, "미지정", "Unassigned")}</span>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
