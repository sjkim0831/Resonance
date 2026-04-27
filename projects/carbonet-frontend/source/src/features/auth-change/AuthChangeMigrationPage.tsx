import { useEffect, useMemo, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { CanView } from "../../components/access/CanView";
import { readBootstrappedAuthChangePageData } from "../../lib/api/bootstrap";
import { fetchAuthChangeHistory, fetchAuthChangePage } from "../../lib/api/adminMember";
import { saveAdminAuthChange } from "../../lib/api/adminActions";
import { fetchFrontendSession } from "../../lib/api/adminShell";
import type { FrontendSession } from "../../lib/api/adminShellTypes";
import type { AuthChangeHistoryRow, AuthChangePagePayload } from "../../lib/api/authTypes";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminAuthorityPageFrame } from "../admin-ui/pageFrames";
import { PageStatusNotice } from "../member/common";
import { MemberStateCard } from "../member/sections";
import { AuthChangeHistorySection, AuthChangeOverview, AuthChangeSelectedCard, AuthChangeTableSection } from "./authChangeSections";

function t(page: AuthChangePagePayload | null, ko: string, en: string) {
  return page?.isEn ? en : ko;
}

export function AuthChangeMigrationPage() {
  const bootstrappedPage = readBootstrappedAuthChangePageData();
  const [session, setSession] = useState<FrontendSession | null>(null);
  const [page, setPage] = useState<AuthChangePagePayload | null>(bootstrappedPage);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const nextDrafts: Record<string, string> = {};
    (bootstrappedPage?.roleAssignments || []).forEach((row) => {
      nextDrafts[row.emplyrId] = row.authorCode || "";
    });
    return nextDrafts;
  });
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingEmplyrId, setSavingEmplyrId] = useState("");
  const [restoreEmplyrId, setRestoreEmplyrId] = useState("");
  const [searchKeyword, setSearchKeyword] = useState(bootstrappedPage?.assignmentSearchKeyword || "");
  const [searchDraft, setSearchDraft] = useState(bootstrappedPage?.assignmentSearchKeyword || "");
  const [assignmentFilter, setAssignmentFilter] = useState("ALL");
  const [pageIndex, setPageIndex] = useState(Math.max(1, Number(bootstrappedPage?.assignmentPageIndex || 1)));
  const [initialBootstrapped, setInitialBootstrapped] = useState(!!bootstrappedPage);
  const [historyRows, setHistoryRows] = useState<AuthChangeHistoryRow[]>(bootstrappedPage?.recentRoleChangeHistory || []);

  function applyPayload(sessionPayload: FrontendSession, payload: AuthChangePagePayload) {
    setSession(sessionPayload);
    setPage(payload);
    setSearchKeyword(payload.assignmentSearchKeyword || "");
    setSearchDraft(payload.assignmentSearchKeyword || "");
    setPageIndex(Math.max(1, Number(payload.assignmentPageIndex || 1)));
    setDrafts((current) => {
      const nextDrafts = { ...current };
      payload.roleAssignments.forEach((row) => {
        if (typeof nextDrafts[row.emplyrId] !== "string") {
          nextDrafts[row.emplyrId] = row.authorCode || "";
        }
      });
      return nextDrafts;
    });
    setSelectedAdminId((current) => {
      const hasCurrent = payload.roleAssignments.some((row) => row.emplyrId === current);
      if (hasCurrent) return current;
      return payload.authChangeTargetUserId || payload.roleAssignments[0]?.emplyrId || "";
    });
  }

  function loadPage(existingSession?: FrontendSession | null) {
    setError("");
    return Promise.all([
      existingSession ? Promise.resolve(existingSession) : fetchFrontendSession(),
      fetchAuthChangePage({ searchKeyword, pageIndex })
    ]).then(([sessionPayload, payload]) => {
      applyPayload(sessionPayload, payload);
      return { sessionPayload, payload };
    });
  }

  useEffect(() => {
    if (initialBootstrapped && bootstrappedPage) {
      setInitialBootstrapped(false);
      fetchFrontendSession()
        .then((sessionPayload) => applyPayload(sessionPayload, bootstrappedPage))
        .catch((err: Error) => setError(err.message));
      return;
    }
    loadPage().catch((err: Error) => setError(err.message));
  }, [pageIndex, searchKeyword]);

  useEffect(() => {
    fetchAuthChangeHistory()
      .then((items) => setHistoryRows(items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!restoreEmplyrId) return;
    const target = document.getElementById(`auth-change-row-${restoreEmplyrId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setRestoreEmplyrId("");
  }, [page, restoreEmplyrId]);

  const canView = !!page;
  const canEdit = !!page?.canEditAuthChange;
  const pendingChanges = (page?.roleAssignments || []).filter((row) => (drafts[row.emplyrId] || row.authorCode || "") !== (row.authorCode || ""));
  const visibleAssignments = (page?.roleAssignments || []).filter((row) => {
    const pending = (drafts[row.emplyrId] || "") !== (row.authorCode || "");
    const matchesFilter = assignmentFilter === "ALL" || (assignmentFilter === "PENDING" && pending) || (assignmentFilter === "UNCHANGED" && !pending);
    return matchesFilter;
  });
  const currentPage = Math.max(1, Number(page?.assignmentPageIndex || pageIndex || 1));
  const totalPages = Math.max(1, Number(page?.assignmentTotalPages || 1));
  const pagedAssignments = visibleAssignments;
  const selectedAssignment = (page?.roleAssignments || []).find((row) => row.emplyrId === selectedAdminId) || null;
  const selectedDraftAuthorCode = selectedAssignment ? (drafts[selectedAssignment.emplyrId] || "") : "";
  const selectedDraftAuthorName = (page?.authorGroups || []).find((group) => group.authorCode === selectedDraftAuthorCode)?.authorNm || "";
  const filteredHistory = useMemo(() => {
    const rows = historyRows;
    if (!selectedAdminId) return rows;
    const matched = rows.filter((row) => row.targetUserId === selectedAdminId);
    return matched.length > 0 ? matched : rows;
  }, [historyRows, selectedAdminId]);

  useEffect(() => {
    if (!page || !session) {
      return;
    }
    logGovernanceScope("PAGE", "auth-change", {
      route: window.location.pathname,
      actorUserId: session.userId || "",
      actorAuthorCode: session.authorCode || "",
      actorInsttId: session.insttId || "",
      canEdit: !!page.canEditAuthChange,
      assignmentCount: Number(page.assignmentCount || 0),
      selectedAdminId,
      searchKeyword
    });
    logGovernanceScope("COMPONENT", "auth-change-table", {
      component: "auth-change-table",
      allowed: !!page.canEditAuthChange,
      visibleAssignmentCount: visibleAssignments.length,
      pendingCount: pendingChanges.length
    });
  }, [page, pendingChanges.length, searchKeyword, selectedAdminId, session, visibleAssignments.length]);

  function handleSearchSubmit() {
    logGovernanceScope("ACTION", "auth-change-search", {
      actorInsttId: session?.insttId || "",
      searchDraft,
      pageIndex: 1
    });
    const nextKeyword = searchDraft.trim();
    if (nextKeyword === searchKeyword && pageIndex === 1) {
      loadPage(session).catch((err: Error) => setError(err.message));
      return;
    }
    setPageIndex(1);
    setSearchKeyword(nextKeyword);
  }

  function handleSave(emplyrId: string) {
    logGovernanceScope("ACTION", "auth-change-save", {
      actorInsttId: session?.insttId || "",
      targetAdminId: emplyrId,
      nextAuthorCode: drafts[emplyrId] || ""
    });
    if (!session) {
      setError(t(page, "세션 정보가 없습니다.", "Session is unavailable."));
      return;
    }
    const currentRow = (page?.roleAssignments || []).find((row) => row.emplyrId === emplyrId);
    const nextAuthorCode = drafts[emplyrId] || "";
    if (!currentRow || nextAuthorCode === (currentRow.authorCode || "")) {
      setMessage(t(page, "변경된 권한이 없습니다.", "There is no changed role to save."));
      return;
    }
    const nextAuthorName = (page?.authorGroups || []).find((group) => group.authorCode === nextAuthorCode)?.authorNm || nextAuthorCode || "Unassigned";
    const confirmed = window.confirm(t(page, `${emplyrId} 권한을 ${(currentRow.authorNm || currentRow.authorCode || "미지정")}에서 ${nextAuthorName}로 변경하시겠습니까?`, `Do you want to change ${emplyrId} from ${currentRow.authorNm || currentRow.authorCode || "Unassigned"} to ${nextAuthorName}?`));
    if (!confirmed) return;
    setError("");
    setMessage("");
    setSavingEmplyrId(emplyrId);
    saveAdminAuthChange(session, { emplyrId, authorCode: nextAuthorCode })
      .then(() => loadPage(session))
      .then(() => {
        setSelectedAdminId(emplyrId);
        setRestoreEmplyrId(emplyrId);
        setMessage(t(page, "권한 변경을 저장했습니다.", "Authority change has been saved."));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSavingEmplyrId(""));
  }

  async function handleBulkSave() {
    logGovernanceScope("ACTION", "auth-change-bulk-save", {
      actorInsttId: session?.insttId || "",
      pendingCount: pendingChanges.length
    });
    if (!session || pendingChanges.length === 0) {
      setMessage(t(page, "저장할 변경이 없습니다.", "There are no pending changes to save."));
      return;
    }
    const confirmed = window.confirm(t(page, `${pendingChanges.length}건의 관리자 권한 변경을 한 번에 저장하시겠습니까?`, `Do you want to save ${pendingChanges.length} administrator role changes at once?`));
    if (!confirmed) return;
    setError("");
    setMessage("");
    setSavingEmplyrId("__bulk__");
    try {
      for (const row of pendingChanges) {
        await saveAdminAuthChange(session, { emplyrId: row.emplyrId, authorCode: drafts[row.emplyrId] || "" });
      }
      await loadPage(session);
      setSelectedAdminId(pendingChanges[0]?.emplyrId || "");
      setRestoreEmplyrId(pendingChanges[0]?.emplyrId || "");
      setMessage(t(page, "권한 변경을 일괄 저장했습니다.", "Authority changes have been saved in bulk."));
    } catch (err) {
      setError(err instanceof Error ? err.message : t(page, "일괄 저장에 실패했습니다.", "Bulk save failed."));
    } finally {
      setSavingEmplyrId("");
    }
  }

  return (
    <AdminPageShell
      actions={<span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">{page?.assignmentCount ?? 0}{t(page, "명", " admins")}</span>}
      breadcrumbs={[
        { label: t(page, "홈", "Home"), href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: t(page, "회원/권한", "Members/Authority") },
        { label: t(page, "권한 변경", "Authority Change") }
      ]}
      subtitle={t(page, "관리자 계정별 현재 권한 그룹을 확인하고 변경합니다.", "Review and update the assigned authority group for each administrator.")}
      title={t(page, "권한 변경", "Authority Change")}
      loading={!page && !error}
      loadingLabel={t(page, "관리자 권한 데이터를 불러오는 중입니다.", "Loading administrator authority data.")}
    >
      {(page?.authChangeError || error) ? <PageStatusNotice tone="error">{page?.authChangeError || error}</PageStatusNotice> : null}
      {(message || page?.authChangeMessage) ? <PageStatusNotice tone="success">{message || page?.authChangeMessage}</PageStatusNotice> : null}
      {!page && !error && !session ? null : !canView ? (
        <MemberStateCard description={t(page, "현재 계정으로는 권한 변경 화면을 조회할 수 없습니다.", "The current account cannot access the authority change screen.")} icon="lock" title={t(page, "권한이 없습니다.", "Permission denied.")} tone="warning" />
      ) : null}
      <CanView allowed={canView} fallback={null}>
        <AdminAuthorityPageFrame>
        <AuthChangeOverview page={page} pendingCount={pendingChanges.length} />
        <AuthChangeSelectedCard page={page} selectedAssignment={selectedAssignment} selectedDraftAuthorCode={selectedDraftAuthorCode} selectedDraftAuthorName={selectedDraftAuthorName} />
        <AuthChangeTableSection
          assignmentFilter={assignmentFilter}
          canEdit={canEdit}
          currentPage={currentPage}
          drafts={drafts}
          onBulkSave={() => { void handleBulkSave(); }}
          onSave={handleSave}
          page={page}
          pagedAssignments={pagedAssignments}
          pendingCount={pendingChanges.length}
          savingEmplyrId={savingEmplyrId}
          searchDraft={searchDraft}
          searchKeyword={searchKeyword}
          selectedAdminId={selectedAdminId}
          setAssignmentFilter={setAssignmentFilter}
          setDrafts={setDrafts}
          setSearchDraft={setSearchDraft}
          setSelectedAdminId={setSelectedAdminId}
          setPageIndex={setPageIndex}
          onSearchSubmit={handleSearchSubmit}
          totalPages={totalPages}
        />
        <AuthChangeHistorySection page={page} rows={filteredHistory} />
        </AdminAuthorityPageFrame>
      </CanView>
    </AdminPageShell>
  );
}
