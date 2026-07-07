import type { Dispatch, SetStateAction } from "react";
import type { DeptRolePagePayload } from "../../lib/api/authTypes";
import { GridToolbar, MemberButton, MemberPagination, MemberPermissionButton } from "../admin-ui/common";

function t(page: DeptRolePagePayload | null, ko: string, en: string) {
  return page?.isEn ? en : ko;
}

export function renderRoleProfilePreview(page: DeptRolePagePayload | null, profile?: { displayTitle?: string; priorityWorks?: string[]; description?: string; baseRoleYn?: string; assignmentScope?: string; parentAuthorCode?: string } | null) {
  if (!profile || (!profile.displayTitle && !(profile.priorityWorks || []).length && !profile.description && !profile.assignmentScope)) {
    return <div className="mt-2 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-[var(--kr-gov-text-secondary)]">{t(page, "연결된 프로필 메타데이터가 없습니다.", "No linked role profile metadata.")}</div>;
  }
  return (
    <div className="mt-2 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-[var(--kr-gov-text-secondary)]" data-help-id="dept-role-role-profile">
      <p className="font-bold text-[var(--kr-gov-blue)]">{profile.displayTitle || "-"}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-white px-2 py-0.5 font-bold text-[var(--kr-gov-blue)]">
          {profile.baseRoleYn === "Y" ? t(page, "기본 롤", "Base role") : t(page, "서브 롤", "Sub role")}
        </span>
        {profile.assignmentScope ? <span className="rounded-full bg-white px-2 py-0.5 font-bold text-[var(--kr-gov-blue)]">{profile.assignmentScope}</span> : null}
      </div>
      {(profile.priorityWorks || []).length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{(profile.priorityWorks || []).map((item) => <span className="rounded-full bg-white px-2 py-0.5 font-bold text-[var(--kr-gov-blue)]" key={item}>{item}</span>)}</div> : null}
      {profile.description ? <p className="mt-2">{profile.description}</p> : null}
      {profile.parentAuthorCode ? <p className="mt-2">{t(page, "상위 기본 롤", "Parent base role")}: {profile.parentAuthorCode}</p> : null}
    </div>
  );
}

export function DeptRoleCompanySection({ page, insttId, canUseAllCompanies, canUseOwnCompany, onCompanyChange }: { page: DeptRolePagePayload | null; insttId: string; canUseAllCompanies: boolean; canUseOwnCompany: boolean; onCompanyChange: (value: string) => void; }) {
  return (
    <section className="gov-card" data-help-id="dept-role-company">
      <GridToolbar title={t(page, "선택 회사의 부서 권한 목록", "Department roles for the selected company")} />
      <div className="mb-4 flex flex-wrap items-center gap-3 p-6 pb-0">
        <label className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">{t(page, "회사명", "Company")}</label>
        <select className="max-w-md w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] h-10 px-3 text-sm" disabled={!canUseAllCompanies && !canUseOwnCompany} value={insttId} onChange={(e) => onCompanyChange(e.target.value)}>
          {(page?.departmentCompanyOptions || []).map((option) => <option key={option.insttId} value={option.insttId}>{option.cmpnyNm}</option>)}
        </select>
      </div>
    </section>
  );
}

export function DeptRoleDepartmentTable({ page, canUseAllCompanies, canUseOwnCompany, deptDrafts, setDeptDrafts, roleProfilesByAuthorCode, onDeptSave }: { page: DeptRolePagePayload | null; canUseAllCompanies: boolean; canUseOwnCompany: boolean; deptDrafts: Record<string, string>; setDeptDrafts: Dispatch<SetStateAction<Record<string, string>>>; roleProfilesByAuthorCode: Record<string, { displayTitle?: string; priorityWorks?: string[]; description?: string; baseRoleYn?: string; assignmentScope?: string; parentAuthorCode?: string }>; onDeptSave: (row: Record<string, string>) => void; }) {
  return (
    <div className="mb-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] overflow-hidden" data-help-id="dept-role-departments">
      <GridToolbar actions={<span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{page?.mappingCount ?? 0}{t(page, "개 부서", " departments")}</span>} title={t(page, "선택 회사 부서 기본 권한", "Default department roles for the selected company")} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
              <th className="px-4 py-3">{t(page, "회사", "Company")}</th>
              <th className="px-4 py-3">{t(page, "부서명", "Department")}</th>
              <th className="px-4 py-3">{t(page, "권장 Role", "Recommended role")}</th>
              <th className="px-4 py-3">{t(page, "권한 수정", "Update role")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(page?.departmentMappings || []).map((row) => {
              const key = `${row.insttId}:${row.deptNm}`;
              return (
                <tr key={key}>
                  <td className="px-4 py-3">{row.cmpnyNm}</td>
                  <td className="px-4 py-3">{row.deptNm}</td>
                  <td className="px-4 py-3"><div className="font-semibold">{row.recommendedRoleName || row.authorNm || "-"}</div><div className="text-xs text-[var(--kr-gov-text-secondary)]">{row.authorCode || "-"}</div></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select className="min-w-[16rem] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] h-10 px-3 text-sm" disabled={!canUseAllCompanies && !canUseOwnCompany} value={deptDrafts[key] || ""} onChange={(e) => setDeptDrafts((current) => ({ ...current, [key]: e.target.value }))}>
                        {(page?.departmentAuthorGroups || []).map((group) => <option key={group.authorCode} value={group.authorCode}>{group.authorNm} ({group.authorCode})</option>)}
                      </select>
                      <MemberPermissionButton allowed={canUseAllCompanies || canUseOwnCompany} onClick={() => onDeptSave(row)} reason={t(page, "전체 회사 또는 자기 회사 관리 권한이 있어야 부서 기본 Role을 저장할 수 있습니다.", "You need all-company or own-company access to save a department role.")} size="xs" type="button" variant="primary">{t(page, "저장", "Save")}</MemberPermissionButton>
                    </div>
                    {renderRoleProfilePreview(page, roleProfilesByAuthorCode[deptDrafts[key] || row.authorCode || ""])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DeptRoleMemberTable({ page, canUseAllCompanies, canUseOwnCompany, memberSearchDraft, setMemberSearchDraft, onMemberSearchSubmit, currentMemberPage, totalMemberPages, memberDrafts, setMemberDrafts, roleProfilesByAuthorCode, onMemberSave, setMemberPageIndex }: { page: DeptRolePagePayload | null; canUseAllCompanies: boolean; canUseOwnCompany: boolean; memberSearchDraft: string; setMemberSearchDraft: (value: string) => void; onMemberSearchSubmit: () => void; currentMemberPage: number; totalMemberPages: number; memberDrafts: Record<string, string>; setMemberDrafts: Dispatch<SetStateAction<Record<string, string>>>; roleProfilesByAuthorCode: Record<string, { displayTitle?: string; priorityWorks?: string[]; description?: string; baseRoleYn?: string; assignmentScope?: string; parentAuthorCode?: string }>; onMemberSave: (userId: string) => void; setMemberPageIndex: (value: number) => void; }) {
  return (
    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] overflow-hidden" data-help-id="dept-role-members">
      <GridToolbar actions={<span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{page?.companyMemberCount ?? 0}{t(page, "명", " members")}</span>} title={t(page, "선택 회사 회원 권한 목록", "Member roles for the selected company")} />
      <div className="flex flex-col gap-3 border-b border-[var(--kr-gov-border-light)] bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full max-w-xl items-center gap-2">
          <input className="h-10 flex-1 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-sm" placeholder={t(page, "회원 ID, 이름, 부서명 검색", "Search by member ID, name, or department")} value={memberSearchDraft} onChange={(e) => setMemberSearchDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onMemberSearchSubmit(); } }} />
          <MemberButton onClick={onMemberSearchSubmit} type="button" variant="info">{t(page, "검색", "Search")}</MemberButton>
        </div>
        <p className="text-xs text-[var(--kr-gov-text-secondary)]">{t(page, `페이지 ${currentMemberPage} / ${totalMemberPages}`, `Page ${currentMemberPage} / ${totalMemberPages}`)}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
              <th className="px-4 py-3">{t(page, "회원 ID", "Member ID")}</th>
              <th className="px-4 py-3">{t(page, "이름", "Name")}</th>
              <th className="px-4 py-3">{t(page, "부서명", "Department")}</th>
              <th className="px-4 py-3">{t(page, "현재 권한", "Current role")}</th>
              <th className="px-4 py-3">{t(page, "권한 수정", "Update role")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(page?.companyMembers || []).length === 0 ? (
              <tr><td className="px-4 py-6 text-center text-[var(--kr-gov-text-secondary)]" colSpan={5}>{t(page, "선택한 회사의 회원이 없습니다.", "No members exist for the selected company.")}</td></tr>
            ) : (page?.companyMembers || []).map((row) => (
              <tr key={row.userId}>
                <td className="px-4 py-3 font-semibold">{row.userId}</td>
                <td className="px-4 py-3">{row.userNm}</td>
                <td className="px-4 py-3">{row.deptNm || t(page, "미지정", "Unassigned")}</td>
                <td className="px-4 py-3"><div className="font-semibold">{row.authorNm || t(page, "권한 미지정", "No role assigned")}</div><div className="text-xs text-[var(--kr-gov-text-secondary)]">{row.authorCode || "-"}</div></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <select className="min-w-[16rem] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] h-10 px-3 text-sm" disabled={!canUseAllCompanies && !canUseOwnCompany} value={memberDrafts[row.userId] || ""} onChange={(e) => setMemberDrafts((current) => ({ ...current, [row.userId]: e.target.value }))}>
                      {(page?.memberAssignableAuthorGroups || []).map((group) => <option key={group.authorCode} value={group.authorCode}>{group.authorNm} ({group.authorCode})</option>)}
                    </select>
                    <MemberPermissionButton allowed={canUseAllCompanies || canUseOwnCompany} onClick={() => onMemberSave(row.userId)} reason={t(page, "전체 회사 또는 자기 회사 관리 권한이 있어야 회원 권한을 저장할 수 있습니다.", "You need all-company or own-company access to save a member role.")} size="xs" type="button" variant="primary">{t(page, "저장", "Save")}</MemberPermissionButton>
                  </div>
                  {renderRoleProfilePreview(page, roleProfilesByAuthorCode[memberDrafts[row.userId] || row.authorCode || ""])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MemberPagination className="px-4 py-3" currentPage={currentMemberPage} onPageChange={setMemberPageIndex} totalPages={totalMemberPages} />
    </div>
  );
}
