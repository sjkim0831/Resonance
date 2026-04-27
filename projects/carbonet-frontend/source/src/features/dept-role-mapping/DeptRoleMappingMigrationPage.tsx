import { useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { CanView } from "../../components/access/CanView";
import { readBootstrappedDeptRolePageData } from "../../lib/api/bootstrap";
import { fetchDeptRolePage } from "../../lib/api/adminMember";
import { saveDeptRoleMapping, saveDeptRoleMember } from "../../lib/api/adminActions";
import { fetchFrontendSession } from "../../lib/api/adminShell";
import type { FrontendSession } from "../../lib/api/adminShellTypes";
import type { DeptRolePagePayload } from "../../lib/api/authTypes";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminAuthorityPageFrame } from "../admin-ui/pageFrames";
import { PageStatusNotice } from "../member/common";
import { MemberStateCard } from "../member/sections";
import { DeptRoleCompanySection, DeptRoleDepartmentTable, DeptRoleMemberTable } from "./deptRoleSections";

function t(page: DeptRolePagePayload | null, ko: string, en: string) {
  return page?.isEn ? en : ko;
}

export function DeptRoleMappingMigrationPage() {
  const bootstrappedPage = readBootstrappedDeptRolePageData();
  const [session, setSession] = useState<FrontendSession | null>(null);
  const [page, setPage] = useState<DeptRolePagePayload | null>(bootstrappedPage);
  const [insttId, setInsttId] = useState(bootstrappedPage?.selectedInsttId || "");
  const [memberSearchKeyword, setMemberSearchKeyword] = useState(String(bootstrappedPage?.companyMemberSearchKeyword || ""));
  const [memberSearchDraft, setMemberSearchDraft] = useState(String(bootstrappedPage?.companyMemberSearchKeyword || ""));
  const [memberPageIndex, setMemberPageIndex] = useState(Math.max(1, Number(bootstrappedPage?.companyMemberPageIndex || 1)));
  const [deptDrafts, setDeptDrafts] = useState<Record<string, string>>({});
  const [memberDrafts, setMemberDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [skipInitialFetch, setSkipInitialFetch] = useState(Boolean(bootstrappedPage));

  function applyPayload(sessionPayload: FrontendSession, payload: DeptRolePagePayload) {
    setSession(sessionPayload);
    setPage(payload);
    setInsttId(payload.selectedInsttId || "");
    setMemberSearchKeyword(String(payload.companyMemberSearchKeyword || ""));
    setMemberSearchDraft(String(payload.companyMemberSearchKeyword || ""));
    setMemberPageIndex(Math.max(1, Number(payload.companyMemberPageIndex || 1)));
    const nextDeptDrafts: Record<string, string> = {};
    payload.departmentMappings.forEach((row) => {
      nextDeptDrafts[`${row.insttId}:${row.deptNm}`] = row.recommendedRoleCode || row.authorCode || "";
    });
    const nextMemberDrafts: Record<string, string> = {};
    payload.companyMembers.forEach((row) => {
      nextMemberDrafts[row.userId] = row.authorCode || "";
    });
    setDeptDrafts(nextDeptDrafts);
    setMemberDrafts(nextMemberDrafts);
  }

  function loadPage(nextInsttId?: string, existingSession?: FrontendSession | null, options?: { memberSearchKeyword?: string; memberPageIndex?: number }) {
    setError("");
    return Promise.all([
      existingSession ? Promise.resolve(existingSession) : fetchFrontendSession(),
      fetchDeptRolePage({ insttId: nextInsttId ?? insttId, memberSearchKeyword: options?.memberSearchKeyword ?? memberSearchKeyword, memberPageIndex: options?.memberPageIndex ?? memberPageIndex })
    ]).then(([sessionPayload, payload]) => {
      applyPayload(sessionPayload, payload);
      return { sessionPayload, payload };
    });
  }

  useEffect(() => {
    if (skipInitialFetch && page) {
      setSkipInitialFetch(false);
      fetchFrontendSession().then((sessionPayload) => {
        setSession(sessionPayload);
        applyPayload(sessionPayload, page);
      }).catch((err: Error) => setError(err.message));
      return;
    }
    loadPage(insttId, undefined, { memberSearchKeyword, memberPageIndex }).catch((err: Error) => setError(err.message));
  }, [insttId, memberSearchKeyword, memberPageIndex]);

  const canViewCompanySelector = !!page;
  const canUseAllCompanies = !!page?.canManageAllCompanies;
  const canUseOwnCompany = !!page?.canManageOwnCompany;
  const roleProfilesByAuthorCode = page?.roleProfilesByAuthorCode || {};
  const currentMemberPage = Math.max(1, Number(page?.companyMemberPageIndex || memberPageIndex || 1));
  const totalMemberPages = Math.max(1, Number(page?.companyMemberTotalPages || 1));

  useEffect(() => {
    if (!page || !session) {
      return;
    }
    logGovernanceScope("PAGE", "dept-role-mapping", {
      route: window.location.pathname,
      actorUserId: session.userId || "",
      actorAuthorCode: session.authorCode || "",
      actorInsttId: session.insttId || "",
      canManageAllCompanies: !!page.canManageAllCompanies,
      canManageOwnCompany: !!page.canManageOwnCompany,
      selectedInsttId: insttId,
      memberSearchKeyword
    });
    logGovernanceScope("COMPONENT", "dept-role-member-table", {
      component: "dept-role-member-table",
      selectedInsttId: insttId,
      departmentCount: (page.departmentMappings || []).length,
      memberCount: (page.companyMembers || []).length
    });
  }, [insttId, memberSearchKeyword, page, session]);

  function handleMemberSearchSubmit() {
    logGovernanceScope("ACTION", "dept-role-member-search", {
      actorInsttId: session?.insttId || "",
      selectedInsttId: insttId,
      memberSearchDraft
    });
    setMemberPageIndex(1);
    setMemberSearchKeyword(memberSearchDraft.trim());
  }

  function handleCompanyChange(nextInsttId: string) {
    setInsttId(nextInsttId);
    setMemberPageIndex(1);
  }

  function handleDeptSave(row: Record<string, string>) {
    logGovernanceScope("ACTION", "dept-role-save", {
      actorInsttId: session?.insttId || "",
      selectedInsttId: row.insttId || insttId,
      deptNm: row.deptNm || "",
      authorCode: deptDrafts[`${row.insttId}:${row.deptNm}`] || ""
    });
    if (!session) return;
    setError("");
    setMessage("");
    saveDeptRoleMapping(session, { insttId: row.insttId || insttId, cmpnyNm: row.cmpnyNm || "", deptNm: row.deptNm || "", authorCode: deptDrafts[`${row.insttId}:${row.deptNm}`] || "" })
      .then(() => loadPage(row.insttId || insttId, session, { memberSearchKeyword, memberPageIndex }))
      .then(() => setMessage(t(page, `${row.deptNm} 부서 권한을 저장했습니다.`, `Saved the department role for ${row.deptNm}.`)))
      .catch((err: Error) => setError(err.message));
  }

  function handleMemberSave(userId: string) {
    logGovernanceScope("ACTION", "dept-role-member-save", {
      actorInsttId: session?.insttId || "",
      selectedInsttId: insttId,
      targetUserId: userId,
      authorCode: memberDrafts[userId] || ""
    });
    if (!session || !insttId) return;
    setError("");
    setMessage("");
    saveDeptRoleMember(session, { insttId, entrprsMberId: userId, authorCode: memberDrafts[userId] || "" })
      .then(() => loadPage(insttId, session, { memberSearchKeyword, memberPageIndex }))
      .then(() => setMessage(t(page, `${userId} 회원 권한을 저장했습니다.`, `Saved the member role for ${userId}.`)))
      .catch((err: Error) => setError(err.message));
  }

  return (
    <AdminPageShell
      actions={<span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">{page?.mappingCount ?? 0}{t(page, "개 부서", " departments")}</span>}
      breadcrumbs={[
        { label: t(page, "홈", "Home"), href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: t(page, "회원/권한", "Members/Authority") },
        { label: t(page, "부서 권한 맵핑", "Department Role Mapping") }
      ]}
      subtitle={t(page, "최상단에서 회사를 선택하고, 해당 회사 회원 목록과 부서별 기본 Role 맵핑을 함께 확인하는 화면입니다.", "Select a company first, then review company members and default department role mappings together.")}
      title={t(page, "부서 권한 맵핑", "Department Role Mapping")}
      loading={!page && !error}
      loadingLabel={t(page, "부서 권한 정보를 불러오는 중입니다.", "Loading department role data.")}
    >
      {(page?.deptRoleError || error) ? <PageStatusNotice tone="error">{page?.deptRoleError || error}</PageStatusNotice> : null}
      {page?.deptRoleUpdated || message ? <PageStatusNotice tone="success">{message || (page?.deptRoleTargetInsttId ? t(page, `${page.deptRoleTargetInsttId} 부서 권한 맵핑이 저장되었습니다.`, `Saved department role mappings for ${page.deptRoleTargetInsttId}.`) : t(page, "부서 권한 맵핑이 저장되었습니다.", "Department role mappings have been saved."))}</PageStatusNotice> : null}
      {page?.deptRoleMessage && !message ? <PageStatusNotice tone="warning">{page.deptRoleMessage}</PageStatusNotice> : null}
      {!page && !error && !session ? null : !canViewCompanySelector ? (
        <MemberStateCard description={t(page, "현재 계정으로는 부서 권한 맵핑 화면을 조회할 수 없습니다.", "The current account cannot access the department role mapping screen.")} icon="lock" title={t(page, "권한이 없습니다.", "Permission denied.")} tone="warning" />
      ) : null}
      <CanView allowed={canViewCompanySelector} fallback={null}>
        <AdminAuthorityPageFrame>
        <DeptRoleCompanySection canUseAllCompanies={canUseAllCompanies} canUseOwnCompany={canUseOwnCompany} insttId={insttId} onCompanyChange={handleCompanyChange} page={page} />
        <DeptRoleDepartmentTable canUseAllCompanies={canUseAllCompanies} canUseOwnCompany={canUseOwnCompany} deptDrafts={deptDrafts} onDeptSave={handleDeptSave} page={page} roleProfilesByAuthorCode={roleProfilesByAuthorCode} setDeptDrafts={setDeptDrafts} />
        <DeptRoleMemberTable canUseAllCompanies={canUseAllCompanies} canUseOwnCompany={canUseOwnCompany} currentMemberPage={currentMemberPage} memberDrafts={memberDrafts} memberSearchDraft={memberSearchDraft} onMemberSave={handleMemberSave} onMemberSearchSubmit={handleMemberSearchSubmit} page={page} roleProfilesByAuthorCode={roleProfilesByAuthorCode} setMemberDrafts={setMemberDrafts} setMemberPageIndex={setMemberPageIndex} setMemberSearchDraft={setMemberSearchDraft} totalMemberPages={totalMemberPages} />
        </AdminAuthorityPageFrame>
      </CanView>
    </AdminPageShell>
  );
}
