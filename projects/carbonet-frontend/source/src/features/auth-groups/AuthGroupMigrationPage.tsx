import { FormEvent, useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { readBootstrappedAuthGroupPageData } from "../../lib/api/bootstrap";
import { createAuthGroup, saveAuthorRoleProfile, saveAuthGroupFeatures } from "../../lib/api/adminActions";
import { fetchAuthGroupPage } from "../../lib/api/adminMember";
import { fetchFrontendSession } from "../../lib/api/adminShell";
import { fetchAuditEvents } from "../../lib/api/platform";
import type { FrontendSession } from "../../lib/api/adminShellTypes";
import type { AuthGroupPagePayload } from "../../lib/api/authTypes";
import { CanView } from "../../components/access/CanView";
import { deriveUiPermissions } from "../../lib/auth/permissions";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, AdminTable, GridToolbar, MemberButton, MemberPermissionButton } from "../admin-ui/common";
import { AdminAuthorityPageFrame } from "../admin-ui/pageFrames";

const PINNED_AUTH_GROUPS_STORAGE_KEY = "carbonet:pinned-auth-groups";

type CreateFormState = {
  authorCode: string;
  authorNm: string;
  authorDc: string;
};

type SummaryRow = {
  code?: string;
  name?: string;
  description?: string;
  status?: string;
};

type DepartmentRow = {
  cmpnyNm?: string;
  deptNm?: string;
  memberCount?: string;
  recommendedRoleName?: string;
  recommendedRoleCode?: string;
  status?: string;
};

type UserAuthorityRow = {
  userId?: string;
  userNm?: string;
  cmpnyNm?: string;
  authorNm?: string;
  authorCode?: string;
};

type AuthorityInfoRow = {
  title?: string;
  description?: string;
};

type RestoreTarget = {
  menuCode: string;
  featureCode: string;
};

type RoleProfileFormState = {
  displayTitle: string;
  priorityWorks: string;
  description: string;
  memberEditVisibleYn: string;
  roleType: string;
  baseRoleYn: string;
  parentAuthorCode: string;
  assignmentScope: string;
  defaultMemberTypes: string[];
};

function text(page: AuthGroupPagePayload | null, ko: string, en: string) {
  return page?.isEn ? en : ko;
}

function parsePinnedAuthorCodes() {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(PINNED_AUTH_GROUPS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "")).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function formatAuditSnapshot(value: unknown) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseAuditSnapshot(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? value as Record<string, unknown> : null;
}

function extractFeatureCodes(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractFeatureCodes(item));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && (trimmed.startsWith("ROLE_") || trimmed.includes("_")) ? [trimmed] : [];
  }
  if (typeof value !== "object") {
    return [];
  }
  const record = value as Record<string, unknown>;
  return Object.entries(record).flatMap(([key, nested]) => (
    ["selectedFeatureCodes", "featureCodes", "features", "grantedFeatures", "mappedFeatures"].includes(key)
      ? extractFeatureCodes(nested)
      : []
  ));
}

function summarizeAuthAuditDiff(page: AuthGroupPagePayload | null, row: Record<string, unknown>) {
  const addedFromServer = Array.isArray(row.addedFeatureCodes) ? row.addedFeatureCodes.map((item) => String(item || "")) : [];
  const removedFromServer = Array.isArray(row.removedFeatureCodes) ? row.removedFeatureCodes.map((item) => String(item || "")) : [];
  if (addedFromServer.length > 0 || removedFromServer.length > 0) {
    const parts: string[] = [];
    if (addedFromServer.length > 0) {
      parts.push(`${text(page, "추가", "Added")} ${addedFromServer.slice(0, 3).join(", ")}${addedFromServer.length > 3 ? ` +${addedFromServer.length - 3}` : ""}`);
    }
    if (removedFromServer.length > 0) {
      parts.push(`${text(page, "해제", "Removed")} ${removedFromServer.slice(0, 3).join(", ")}${removedFromServer.length > 3 ? ` +${removedFromServer.length - 3}` : ""}`);
    }
    return parts.join(" / ");
  }
  const before = parseAuditSnapshot(row.beforeSummaryJson || row.beforeData || row.beforeSummary);
  const after = parseAuditSnapshot(row.afterSummaryJson || row.afterData || row.afterSummary);
  const beforeCodes = Array.from(new Set(extractFeatureCodes(before)));
  const afterCodes = Array.from(new Set(extractFeatureCodes(after)));
  const beforeSet = new Set(beforeCodes);
  const afterSet = new Set(afterCodes);
  const added = afterCodes.filter((code) => !beforeSet.has(code));
  const removed = beforeCodes.filter((code) => !afterSet.has(code));
  if (added.length === 0 && removed.length === 0) {
    return text(page, "해석 가능한 diff가 없습니다.", "No interpreted diff available.");
  }
  const parts: string[] = [];
  if (added.length > 0) {
    parts.push(`${text(page, "추가", "Added")} ${added.slice(0, 3).join(", ")}${added.length > 3 ? ` +${added.length - 3}` : ""}`);
  }
  if (removed.length > 0) {
    parts.push(`${text(page, "해제", "Removed")} ${removed.slice(0, 3).join(", ")}${removed.length > 3 ? ` +${removed.length - 3}` : ""}`);
  }
  return parts.join(" / ");
}

export function AuthGroupMigrationPage() {
  const initialSearch = new URLSearchParams(window.location.search);
  const bootstrappedPage = readBootstrappedAuthGroupPageData();
  const [session, setSession] = useState<FrontendSession | null>(null);
  const [page, setPage] = useState<AuthGroupPagePayload | null>(bootstrappedPage);
  const [roleCategory, setRoleCategory] = useState(bootstrappedPage?.selectedRoleCategory || "GENERAL");
  const [insttId, setInsttId] = useState(bootstrappedPage?.authGroupSelectedInsttId || "");
  const [authorCode, setAuthorCode] = useState(bootstrappedPage?.selectedAuthorCode || "");
  const [focusedMenuCode, setFocusedMenuCode] = useState(bootstrappedPage?.focusedMenuCode || initialSearch.get("menuCode") || "");
  const [focusedFeatureCode, setFocusedFeatureCode] = useState(bootstrappedPage?.focusedFeatureCode || initialSearch.get("featureCode") || "");
  const [menuSearchKeyword, setMenuSearchKeyword] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(bootstrappedPage?.selectedFeatureCodes || []);
  const [featureSearchKeyword, setFeatureSearchKeyword] = useState("");
  const [featureAssignmentFilter, setFeatureAssignmentFilter] = useState("ALL");
  const [createForm, setCreateForm] = useState<CreateFormState>({
    authorCode: "",
    authorNm: "",
    authorDc: ""
  });
  const initialUserSearchKeyword = String((bootstrappedPage as Record<string, unknown> | null)?.userSearchKeyword || "");
  const [userSearchInput, setUserSearchInput] = useState(initialUserSearchKeyword);
  const [submittedUserSearchKeyword, setSubmittedUserSearchKeyword] = useState(initialUserSearchKeyword);
  const [loading, setLoading] = useState(!bootstrappedPage);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [auditRows, setAuditRows] = useState<Array<Record<string, unknown>>>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [collapsedMenuCodes, setCollapsedMenuCodes] = useState<string[]>([]);
  const [expandedAuditIds, setExpandedAuditIds] = useState<string[]>([]);
  const [pinnedAuthorCodes, setPinnedAuthorCodes] = useState<string[]>(() => parsePinnedAuthorCodes());
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null);
  const [skipInitialFetch, setSkipInitialFetch] = useState(Boolean(bootstrappedPage));
  const [profileForm, setProfileForm] = useState<RoleProfileFormState>({
    displayTitle: "",
    priorityWorks: "",
    description: "",
    memberEditVisibleYn: "Y",
    roleType: "",
    baseRoleYn: "N",
    parentAuthorCode: "",
    assignmentScope: "",
    defaultMemberTypes: []
  });

  const payload = (page || {}) as Record<string, unknown>;
  const permissions = deriveUiPermissions(session, page);
  const canManageAllCompanies = !!page?.canManageAllCompanies;
  const roleCategories = (payload.roleCategories as Array<Record<string, string>> | undefined) || [];
  const recommendedRoleSections =
    (payload.recommendedRoleSections as Array<Record<string, unknown>> | undefined) || [];
  const deptRoleSummaries =
    (payload.authGroupDepartmentRoleSummaries as Array<Record<string, string>> | undefined) || [];
  const generalAuthorGroups =
    (payload.generalAuthorGroups as Array<Record<string, string>> | undefined) || [];
  const departmentRows =
    (payload.authGroupDepartmentRows as DepartmentRow[] | undefined) || [];
  const userAuthorityTargets =
    (payload.userAuthorityTargets as UserAuthorityRow[] | undefined) || [];
  const assignmentAuthorities =
    (payload.assignmentAuthorities as AuthorityInfoRow[] | undefined) || [];
  const referenceAuthorGroups =
    (payload.referenceAuthorGroups as Array<Record<string, string>> | undefined) || [];
  const referenceAuthorProfilesByCode =
    (payload.referenceAuthorProfilesByCode as Record<string, Record<string, unknown>> | undefined) || {};
  const selectedAuthorProfile = ((page?.selectedAuthorProfile as Record<string, unknown> | undefined) || null);
  const selectedAuthorGroup =
    referenceAuthorGroups.find((group) => String(group.authorCode || "") === authorCode)
    || generalAuthorGroups.find((group) => String(group.authorCode || "") === authorCode)
    || null;
  const selectedAuthorName =
    page?.selectedAuthorName || text(page, "권한 그룹을 선택하세요", "Select a role group");
  const selectedParentProfile = profileForm.parentAuthorCode
    ? referenceAuthorProfilesByCode[profileForm.parentAuthorCode] || null
    : null;
  const selectedChildProfiles = Object.entries(referenceAuthorProfilesByCode)
    .filter(([, profile]) => String(profile?.parentAuthorCode || "") === authorCode)
    .map(([code, profile]) => ({ code, profile }));
  const pinnedReferenceGroups = referenceAuthorGroups.filter((group) => pinnedAuthorCodes.includes(String(group.authorCode || "")));
  const baselineSelectedFeatures = page?.selectedFeatureCodes || [];
  const baselineFeatureSet = new Set(baselineSelectedFeatures);
  const selectedFeatureSet = new Set(selectedFeatures);
  const addedFeatureCodes = selectedFeatures.filter((code) => !baselineFeatureSet.has(code));
  const removedFeatureCodes = baselineSelectedFeatures.filter((code) => !selectedFeatureSet.has(code));

  useEffect(() => {
    if (skipInitialFetch && page) {
      setSkipInitialFetch(false);
      setLoading(true);
      setError("");
      fetchFrontendSession()
        .then((sessionPayload) => setSession(sessionPayload))
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
      return;
    }
    setLoading(true);
    setError("");
    Promise.all([
      fetchFrontendSession(),
      fetchAuthGroupPage({
        authorCode,
        roleCategory,
        insttId,
        menuCode: focusedMenuCode,
        featureCode: focusedFeatureCode,
        userSearchKeyword: submittedUserSearchKeyword
      })
    ])
      .then(([sessionPayload, nextPage]) => {
        setSession(sessionPayload);
        setPage(nextPage);
        setRoleCategory(nextPage.selectedRoleCategory || "GENERAL");
        setInsttId(nextPage.authGroupSelectedInsttId || "");
        setAuthorCode(nextPage.selectedAuthorCode || "");
        setFocusedMenuCode(nextPage.focusedMenuCode || "");
        setFocusedFeatureCode(nextPage.focusedFeatureCode || "");
        setSelectedFeatures(nextPage.selectedFeatureCodes || []);
        const nextKeyword = String((nextPage as Record<string, unknown>).userSearchKeyword || "");
        setUserSearchInput(nextKeyword);
        setSubmittedUserSearchKeyword(nextKeyword);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authorCode, roleCategory, insttId, submittedUserSearchKeyword, focusedMenuCode, focusedFeatureCode]);

  useEffect(() => {
    if (!page || !session) {
      return;
    }
    logGovernanceScope("PAGE", "auth-group", {
      route: window.location.pathname,
      actorUserId: session.userId || "",
      actorAuthorCode: session.authorCode || "",
      actorInsttId: session.insttId || "",
      canManageAllCompanies,
      roleCategory,
      insttId,
      selectedAuthorCode: authorCode
    });
    logGovernanceScope("COMPONENT", "auth-group-feature-matrix", {
      component: "auth-group-feature-matrix",
      selectedAuthorCode: authorCode,
      selectedFeatureCount: selectedFeatures.length,
      focusedMenuCode,
      focusedFeatureCode
    });
  }, [authorCode, canManageAllCompanies, focusedFeatureCode, focusedMenuCode, insttId, page, roleCategory, selectedFeatures.length, session]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(PINNED_AUTH_GROUPS_STORAGE_KEY, JSON.stringify(pinnedAuthorCodes));
  }, [pinnedAuthorCodes]);

  useEffect(() => {
    let cancelled = false;
    async function loadAuditRows() {
      if (!authorCode) {
        setAuditRows([]);
        return;
      }
      setAuditLoading(true);
      try {
        const response = await fetchAuditEvents({
          pageId: "auth-group",
          searchKeyword: authorCode,
          pageSize: 5
        });
        if (!cancelled) {
          setAuditRows(Array.isArray(response.items) ? response.items : []);
        }
      } catch {
        if (!cancelled) {
          setAuditRows([]);
        }
      } finally {
        if (!cancelled) {
          setAuditLoading(false);
        }
      }
    }
    void loadAuditRows();
    return () => {
      cancelled = true;
    };
  }, [authorCode]);

  useEffect(() => {
    setExpandedAuditIds([]);
  }, [authorCode]);

  useEffect(() => {
    const nextProfile = (page?.selectedAuthorProfile || {}) as Record<string, unknown>;
    setProfileForm({
      displayTitle: String(nextProfile.displayTitle || selectedAuthorName || ""),
      priorityWorks: Array.isArray(nextProfile.priorityWorks) ? nextProfile.priorityWorks.map((item) => String(item || "")).join(", ") : "",
      description: String(nextProfile.description || selectedAuthorGroup?.authorDc || ""),
      memberEditVisibleYn: String(nextProfile.memberEditVisibleYn || "Y") === "N" ? "N" : "Y",
      roleType: String(nextProfile.roleType || roleCategory || ""),
      baseRoleYn: String(nextProfile.baseRoleYn || "N") === "Y" ? "Y" : "N",
      parentAuthorCode: String(nextProfile.parentAuthorCode || ""),
      assignmentScope: String(nextProfile.assignmentScope || (roleCategory === "GENERAL" ? "GLOBAL" : roleCategory === "DEPARTMENT" ? "DEPARTMENT" : "USER")),
      defaultMemberTypes: Array.isArray(nextProfile.defaultMemberTypes)
        ? nextProfile.defaultMemberTypes.map((item) => String(item || ""))
        : []
    });
  }, [authorCode, page?.selectedAuthorProfile, roleCategory, selectedAuthorGroup?.authorDc, selectedAuthorName]);

  useEffect(() => {
    if (!restoreTarget) {
      return;
    }
    const featureElement = restoreTarget.featureCode
      ? document.getElementById(`auth-feature-${restoreTarget.featureCode}`)
      : null;
    const menuElement = restoreTarget.menuCode
      ? document.getElementById(`auth-section-${restoreTarget.menuCode}`)
      : null;
    const target = featureElement || menuElement;
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setRestoreTarget(null);
  }, [page, restoreTarget, selectedFeatures]);

  const visibleFeatureSections = (page?.featureSections || []).map((section) => ({
    ...section,
    features: (section.features || []).filter((feature) => (
      (!focusedFeatureCode || String(feature.featureCode || "").toUpperCase() === focusedFeatureCode.toUpperCase())
      && (!featureSearchKeyword.trim()
        || `${feature.featureCode || ""} ${feature.featureNm || ""} ${feature.featureNmEn || ""} ${feature.featureDc || ""}`
          .toUpperCase()
          .includes(featureSearchKeyword.trim().toUpperCase()))
      && (featureAssignmentFilter === "ALL"
        || (featureAssignmentFilter === "ASSIGNED" && selectedFeatures.includes(feature.featureCode))
        || (featureAssignmentFilter === "UNASSIGNED" && !selectedFeatures.includes(feature.featureCode)))
    ))
  })).filter((section) => (
    (!focusedMenuCode || String(section.menuCode || "").toUpperCase() === focusedMenuCode.toUpperCase())
    && (!menuSearchKeyword.trim()
      || `${section.menuCode || ""} ${section.menuNm || ""} ${section.menuNmEn || ""} ${section.menuUrl || ""}`
        .toUpperCase()
        .includes(menuSearchKeyword.trim().toUpperCase()))
    && (section.features || []).length > 0
  ));
  const totalVisibleFeatureCount = visibleFeatureSections.reduce((sum, section) => sum + (section.features || []).length, 0);
  const visibleFeatureCodes = visibleFeatureSections.flatMap((section) => (section.features || []).map((feature) => feature.featureCode));
  const riskFlags = [
    addedFeatureCodes.length > 10 ? text(page, "대량 추가 변경", "Large add change") : "",
    removedFeatureCodes.length > 0 ? text(page, "권한 제거 변경 포함", "Contains permission removals") : "",
    !authorCode ? text(page, "기준 권한 그룹 미선택", "Reference role not selected") : "",
    focusedFeatureCode ? text(page, "특정 기능 포커스 적용 중", "Specific feature focus active") : ""
  ].filter(Boolean);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    logGovernanceScope("ACTION", "auth-group-create", {
      actorInsttId: session?.insttId || "",
      roleCategory,
      insttId,
      authorCode: createForm.authorCode
    });
    if (!session) {
      setError(text(page, "세션 정보가 없습니다.", "Session is unavailable."));
      return;
    }
    setMessage("");
    setError("");
    createAuthGroup(session, {
      ...createForm,
      roleCategory,
      insttId
    })
      .then((result) => {
        setMessage(
          text(page, "권한 그룹이 생성되었습니다: ", "Authority group created: ") + result.authorCode
        );
        setAuthorCode(result.authorCode);
        setCreateForm({ authorCode: "", authorNm: "", authorDc: "" });
      })
      .catch((err: Error) => setError(err.message));
  }

  function handleSaveFeatures() {
    logGovernanceScope("ACTION", "auth-group-save-features", {
      actorInsttId: session?.insttId || "",
      selectedAuthorCode: authorCode,
      roleCategory,
      insttId,
      selectedFeatureCount: selectedFeatures.length
    });
    if (!session || !authorCode) {
      setError(text(page, "선택된 권한 그룹이 없습니다.", "No authority group selected."));
      return;
    }
    setMessage("");
    setError("");
    saveAuthGroupFeatures(session, {
      authorCode,
      roleCategory,
      featureCodes: selectedFeatures
    })
      .then(async () => {
        setRestoreTarget({
          menuCode: focusedMenuCode || visibleFeatureSections[0]?.menuCode || "",
          featureCode: focusedFeatureCode || selectedFeatures[selectedFeatures.length - 1] || ""
        });
        const nextPage = await fetchAuthGroupPage({
          authorCode,
          roleCategory,
          insttId,
          menuCode: focusedMenuCode,
          featureCode: focusedFeatureCode,
          userSearchKeyword: submittedUserSearchKeyword
        });
        setPage(nextPage);
        setSelectedFeatures(nextPage.selectedFeatureCodes || []);
        setMessage(text(page, "Role-기능 매핑을 저장했습니다.", "Role-feature mapping saved."));
      })
      .catch((err: Error) => setError(err.message));
  }

  function handleDefaultMemberTypeToggle(memberType: string) {
    setProfileForm((current) => ({
      ...current,
      defaultMemberTypes: current.defaultMemberTypes.includes(memberType)
        ? current.defaultMemberTypes.filter((item) => item !== memberType)
        : [...current.defaultMemberTypes, memberType]
    }));
  }

  function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    logGovernanceScope("ACTION", "auth-group-save-profile", {
      actorInsttId: session?.insttId || "",
      selectedAuthorCode: authorCode,
      roleCategory,
      assignmentScope: profileForm.assignmentScope,
      defaultMemberTypes: profileForm.defaultMemberTypes.join(",")
    });
    if (!session || !authorCode) {
      setError(text(page, "선택된 권한 그룹이 없습니다.", "No authority group selected."));
      return;
    }
    setMessage("");
    setError("");
    saveAuthorRoleProfile(session, {
      authorCode,
      roleCategory,
      displayTitle: profileForm.displayTitle,
      priorityWorks: profileForm.priorityWorks.split(",").map((item) => item.trim()).filter(Boolean),
      description: profileForm.description,
      memberEditVisibleYn: profileForm.memberEditVisibleYn,
      roleType: profileForm.roleType,
      baseRoleYn: profileForm.baseRoleYn,
      parentAuthorCode: profileForm.parentAuthorCode,
      assignmentScope: profileForm.assignmentScope,
      defaultMemberTypes: profileForm.defaultMemberTypes
    })
      .then(async () => {
        const nextPage = await fetchAuthGroupPage({
          authorCode,
          roleCategory,
          insttId,
          menuCode: focusedMenuCode,
          featureCode: focusedFeatureCode,
          userSearchKeyword: submittedUserSearchKeyword
        });
        setPage(nextPage);
        setMessage(text(page, "권한 프로필을 저장했습니다.", "Role profile saved."));
      })
      .catch((err: Error) => setError(err.message));
  }

  function toggleFeature(featureCode: string) {
    setSelectedFeatures((current) =>
      current.includes(featureCode)
        ? current.filter((code) => code !== featureCode)
        : [...current, featureCode]
    );
  }

  function setVisibleFeatures(checked: boolean) {
    setSelectedFeatures((current) => {
      const currentSet = new Set(current);
      if (checked) {
        visibleFeatureCodes.forEach((code) => currentSet.add(code));
      } else {
        visibleFeatureCodes.forEach((code) => currentSet.delete(code));
      }
      return Array.from(currentSet);
    });
  }

  function toggleSectionCollapse(menuCode: string) {
    setCollapsedMenuCodes((current) => (
      current.includes(menuCode)
        ? current.filter((code) => code !== menuCode)
        : [...current, menuCode]
    ));
  }

  function toggleAuditExpansion(auditId: string) {
    setExpandedAuditIds((current) => (
      current.includes(auditId)
        ? current.filter((id) => id !== auditId)
        : [...current, auditId]
    ));
  }

  function togglePinnedAuthorCode(nextAuthorCode: string) {
    if (!nextAuthorCode) {
      return;
    }
    setPinnedAuthorCodes((current) => (
      current.includes(nextAuthorCode)
        ? current.filter((code) => code !== nextAuthorCode)
        : [...current, nextAuthorCode]
    ));
  }

  function handleUserSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedUserSearchKeyword(userSearchInput.trim());
  }

  function createButtonLabel() {
    if (roleCategory === "GENERAL") {
      return page?.isEn
        ? page?.isWebmaster
          ? "Add Role"
          : "Webmaster only"
        : page?.isWebmaster
          ? "Role 추가"
          : "webmaster 전용";
    }
    return page?.isEn
      ? page?.canManageScopedAuthorityGroups
        ? "Add Role"
        : "Role creation unavailable"
      : page?.canManageScopedAuthorityGroups
        ? "Role 추가"
        : "Role 추가 불가";
  }

  function renderExistingBadge(grantable: boolean) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-white text-[var(--kr-gov-text-secondary)]">
        {grantable ? text(page, "부여 가능", "Grantable") : text(page, "조회 전용", "Read only")}
      </span>
    );
  }

  function renderNeedStatus(status: string | undefined) {
    const existing = String(status || "").toLowerCase() === "existing";
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
          existing ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        {existing ? text(page, "기존 존재", "Existing") : text(page, "추가 필요", "Need to add")}
      </span>
    );
  }

  function renderDepartmentStatus(status: string | undefined) {
    const normalized = String(status || "").toLowerCase();
    const className =
      normalized === "mapped"
        ? "bg-blue-50 text-blue-700"
        : normalized === "ready"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700";
    const label =
      normalized === "mapped"
        ? text(page, "매핑 완료", "Mapped")
        : normalized === "ready"
          ? text(page, "기본 매핑 후보", "Ready")
          : text(page, "검토 필요", "Needs review");
    return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>{label}</span>;
  }

  function renderUserAuthorityStatus(row: UserAuthorityRow) {
    if (!authorCode) {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-600">
          {text(page, "대상 권한 없음", "No target role")}
        </span>
      );
    }
    if ((row.authorCode || "").toUpperCase() === authorCode.toUpperCase()) {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700">
          {text(page, "대상 권한과 동일", "Same as target")}
        </span>
      );
    }
    if (!row.authorCode) {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-700">
          {text(page, "권한 부여 필요", "Grant required")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700">
        {text(page, "권한 변경 필요", "Change required")}
      </span>
    );
  }

  function renderEmptyState(messageKo: string, messageEn: string) {
    return (
      <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-6 text-center text-sm text-[var(--kr-gov-text-secondary)]">
        {text(page, messageKo, messageEn)}
      </div>
    );
  }

  function renderRecommendedTable(rows: SummaryRow[]) {
    return (
      <div className="overflow-x-auto">
        <AdminTable>
          <thead>
            <tr className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
              <th className="px-4 py-3">{text(page, "Role 코드", "Role Code")}</th>
              <th className="px-4 py-3">{text(page, "Role 명", "Role Name")}</th>
              <th className="px-4 py-3">{text(page, "용도", "Purpose")}</th>
              <th className="px-4 py-3 text-center">{text(page, "상태", "Status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-[var(--kr-gov-text-secondary)]" colSpan={4}>
                  {text(page, "이 분류에는 아직 준비된 권한 그룹이 없습니다.", "No roles prepared in this category yet.")}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.code || row.name || "role"}-${index}`}>
                  <td className="px-4 py-3 font-bold whitespace-nowrap">{row.code || "-"}</td>
                  <td className="px-4 py-3">{row.name || "-"}</td>
                  <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">
                    {row.description || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">{renderNeedStatus(row.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>
      </div>
    );
  }

  function renderProfileBadge(label: string, tone: "blue" | "emerald" | "slate" = "slate") {
    const toneClass = tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-slate-100 text-slate-700";
    return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${toneClass}`}>{label}</span>;
  }

  return (
    <AdminPageShell
      actions={(
        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-blue-50 text-[var(--kr-gov-blue)]">
          {(page?.isWebmaster ? text(page, "마스터 계정", "Master Account") : text(page, "현재 계정", "Current Account")) +
            `: ${page?.currentUserId || session?.userId || "-"}`}
        </span>
      )}
      breadcrumbs={[
        { label: text(page, "홈", "Home"), href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: text(page, "시스템", "System") },
        { label: text(page, "권한 그룹", "Permission Groups") }
      ]}
      subtitle={text(
        page,
        "webmaster 계정이 전체 기능 카탈로그를 검토하는 마스터 권한 기준 화면입니다.",
        "Webmaster can review the full feature catalog and use this page as the master authority baseline."
      )}
      title={text(page, "권한 그룹", "Permission Groups")}
      loading={loading && !page && !error}
      loadingLabel={text(page, "권한 그룹 구성을 불러오는 중입니다.", "Loading authority group configuration.")}
    >
      {page?.authGroupError ? (
        <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {page.authGroupError}
        </section>
      ) : null}
      {error ? (
        <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </section>
      ) : null}
      {message ? (
        <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </section>
      ) : null}
      {focusedMenuCode || focusedFeatureCode ? (
        <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {text(page, "환경관리 화면에서 선택한 범위만 표시 중입니다.", "Showing only the scope selected in environment management.")}
          <span className="ml-2 font-mono">
            {[focusedMenuCode ? `menu:${focusedMenuCode}` : "", focusedFeatureCode ? `feature:${focusedFeatureCode}` : ""].filter(Boolean).join(" / ")}
          </span>
        </section>
      ) : null}

      <AdminAuthorityPageFrame>
      <section className="gov-card border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm mb-8" data-help-id="auth-group-filters">
        <div className="flex items-center gap-2 border-b pb-4 mb-4">
          <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">tune</span>
          <h3 className="text-lg font-bold">{text(page, "권한 분류", "Role Category")}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] !mb-0">
            {text(page, "권한 분류", "Role category")}
          </label>
          <AdminSelect
            className="gov-select w-[18rem] border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm"
            value={roleCategory}
            onChange={(event) => {
              setRoleCategory(event.target.value);
              setAuthorCode("");
            }}
          >
            {(page?.roleCategoryOptions || []).map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </AdminSelect>
          {(roleCategory === "DEPARTMENT" || roleCategory === "USER") && (
            <>
              <label className="block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] shrink-0 whitespace-nowrap">
                {text(page, "회사명", "Company")}
              </label>
              <AdminSelect
                className="gov-select min-w-[28rem] w-[28rem] border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm"
                disabled={!canManageAllCompanies}
                value={insttId}
                onChange={(event) => setInsttId(event.target.value)}
              >
                {(page?.authGroupCompanyOptions || []).map((option) => (
                  <option key={option.insttId} value={option.insttId}>
                    {option.cmpnyNm}
                  </option>
                ))}
              </AdminSelect>
            </>
          )}
        </div>
      </section>

      <CanView
        allowed={
          roleCategory === "GENERAL"
            ? permissions.canViewGeneralAuthGroupSection
            : permissions.canViewScopedAuthGroupSection
        }
        fallback={null}
      >
        <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm mb-8" data-help-id="auth-group-profile">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">badge</span>
            <h3 className="text-lg font-bold">{text(page, "선택 권한 그룹 프로필", "Selected Role Profile")}</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
              <p className="text-xs font-bold uppercase text-[var(--kr-gov-text-secondary)]">{text(page, "권한 그룹", "Role group")}</p>
              <p className="mt-2 text-base font-black text-[var(--kr-gov-text-primary)]">{selectedAuthorName}</p>
              <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{authorCode || "-"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {profileForm.roleType ? renderProfileBadge(profileForm.roleType, "blue") : null}
                {profileForm.baseRoleYn === "Y"
                  ? renderProfileBadge(text(page, "기본 롤", "Base role"), "emerald")
                  : renderProfileBadge(text(page, "서브 롤", "Sub role"), "slate")}
                {profileForm.assignmentScope
                  ? renderProfileBadge(profileForm.assignmentScope, "slate")
                  : null}
              </div>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4 md:col-span-2">
              <p className="text-xs font-bold uppercase text-[var(--kr-gov-text-secondary)]">{text(page, "운영 설명", "Operational description")}</p>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                {String(selectedAuthorProfile?.description || selectedAuthorGroup?.authorDc || text(page, "선택한 권한 그룹의 설명이 아직 없습니다.", "No description is available for the selected role group yet."))}
              </p>
              {selectedParentProfile ? (
                <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-3 py-3 text-xs text-[var(--kr-gov-text-secondary)]">
                  <p className="font-bold text-[var(--kr-gov-blue)]">{text(page, "상위 기본 롤", "Parent base role")}</p>
                  <p className="mt-1">{String(selectedParentProfile.displayTitle || profileForm.parentAuthorCode || "-")}</p>
                </div>
              ) : null}
            </article>
          </div>
          {selectedChildProfiles.length > 0 ? (
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
              <p className="text-xs font-bold uppercase text-[var(--kr-gov-text-secondary)]">{text(page, "연결된 서브 롤", "Connected sub roles")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedChildProfiles.map(({ code, profile }) => (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700" key={code}>
                    {String(profile.displayTitle || code)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm mb-8" data-help-id="auth-group-profile-editor">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">schema</span>
            <h3 className="text-lg font-bold">{text(page, "기본 롤/서브 롤 메타데이터", "Base/Sub role metadata")}</h3>
          </div>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSaveProfile}>
            <label>
              <span className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">{text(page, "표시 이름", "Display title")}</span>
              <AdminInput className="gov-select w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm" disabled={!authorCode} value={profileForm.displayTitle} onChange={(event) => setProfileForm((current) => ({ ...current, displayTitle: event.target.value }))} />
            </label>
            <label>
              <span className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">{text(page, "롤 타입", "Role type")}</span>
              <AdminSelect className="gov-select w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm" disabled={!authorCode} value={profileForm.roleType} onChange={(event) => setProfileForm((current) => ({ ...current, roleType: event.target.value }))}>
                <option value="">{text(page, "선택 안 함", "Not set")}</option>
                <option value="GENERAL">{text(page, "공통", "General")}</option>
                <option value="DEPARTMENT">{text(page, "부서", "Department")}</option>
                <option value="USER">{text(page, "회원", "User")}</option>
              </AdminSelect>
            </label>
            <label>
              <span className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">{text(page, "기본 롤 여부", "Base role")}</span>
              <AdminSelect className="gov-select w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm" disabled={!authorCode} value={profileForm.baseRoleYn} onChange={(event) => setProfileForm((current) => ({ ...current, baseRoleYn: event.target.value }))}>
                <option value="Y">{text(page, "기본 롤", "Base role")}</option>
                <option value="N">{text(page, "서브 롤", "Sub role")}</option>
              </AdminSelect>
            </label>
            <label>
              <span className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">{text(page, "적용 범위", "Assignment scope")}</span>
              <AdminSelect className="gov-select w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm" disabled={!authorCode} value={profileForm.assignmentScope} onChange={(event) => setProfileForm((current) => ({ ...current, assignmentScope: event.target.value }))}>
                <option value="GLOBAL">{text(page, "전역", "Global")}</option>
                <option value="COMPANY">{text(page, "회사", "Company")}</option>
                <option value="DEPARTMENT">{text(page, "부서", "Department")}</option>
                <option value="USER">{text(page, "회원", "User")}</option>
              </AdminSelect>
            </label>
            <label className="md:col-span-2">
              <span className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">{text(page, "상위 기본 롤", "Parent base role")}</span>
              <AdminSelect className="gov-select w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm" disabled={!authorCode || profileForm.baseRoleYn === "Y"} value={profileForm.parentAuthorCode} onChange={(event) => setProfileForm((current) => ({ ...current, parentAuthorCode: event.target.value }))}>
                <option value="">{text(page, "상위 기본 롤 없음", "No parent base role")}</option>
                {referenceAuthorGroups
                  .filter((group) => String(group.authorCode || "") !== authorCode)
                  .map((group) => (
                    <option key={String(group.authorCode || "")} value={String(group.authorCode || "")}>
                      {`${String(group.authorNm || "-")} (${String(group.authorCode || "-")})`}
                    </option>
                  ))}
              </AdminSelect>
            </label>
            <label className="md:col-span-2">
              <span className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">{text(page, "우선 업무", "Priority works")}</span>
              <AdminInput className="gov-select w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm" disabled={!authorCode} placeholder={text(page, "쉼표로 구분해 입력", "Comma-separated values")} value={profileForm.priorityWorks} onChange={(event) => setProfileForm((current) => ({ ...current, priorityWorks: event.target.value }))} />
            </label>
            <label className="md:col-span-2">
              <span className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">{text(page, "설명", "Description")}</span>
              <AdminInput className="gov-select w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm" disabled={!authorCode} value={profileForm.description} onChange={(event) => setProfileForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="md:col-span-2">
              <p className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">{text(page, "기본 회원 유형", "Default member types")}</p>
              <div className="flex flex-wrap gap-2">
                {[
                  ["E", text(page, "CO2 배출사업자", "CO2 Emitter")],
                  ["P", text(page, "CCUS 프로젝트 사업자", "CCUS Project Operator")],
                  ["C", text(page, "진흥·지원 기관", "Promotion / Support Institution")],
                  ["G", text(page, "관계 기관·주무관청", "Government / Related Institution")]
                ].map(([code, label]) => (
                  <button
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${profileForm.defaultMemberTypes.includes(code) ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"}`}
                    disabled={!authorCode}
                    key={code}
                    onClick={() => handleDefaultMemberTypeToggle(code)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label>
              <span className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">{text(page, "회원 수정 노출", "Visible in member edit")}</span>
              <AdminSelect className="gov-select w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm" disabled={!authorCode} value={profileForm.memberEditVisibleYn} onChange={(event) => setProfileForm((current) => ({ ...current, memberEditVisibleYn: event.target.value }))}>
                <option value="Y">{text(page, "노출", "Visible")}</option>
                <option value="N">{text(page, "숨김", "Hidden")}</option>
              </AdminSelect>
            </label>
            <div className="flex items-end justify-end md:col-span-1">
              <MemberPermissionButton
                allowed={!!authorCode}
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-[var(--kr-gov-blue)] text-white disabled:opacity-50"
                reason={text(page, "권한 그룹을 먼저 선택해야 프로필을 저장할 수 있습니다.", "Select a role group first to save the profile.")}
                type="submit"
              >
                {text(page, "프로필 저장", "Save profile")}
              </MemberPermissionButton>
            </div>
          </form>
        </section>
        <section className="gov-card border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm mb-8" data-help-id="auth-group-create">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">add_moderator</span>
            <h3 className="text-lg font-bold">{text(page, "권한 그룹 추가", "Create Authority Group")}</h3>
          </div>
          <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={handleCreate}>
            <label>
              <span className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">
                {text(page, "Role 코드", "Role Code")}
              </span>
              <AdminInput
                className="gov-select w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm"
                placeholder={
                  roleCategory === "GENERAL"
                    ? "ROLE_OPERATION_ADMIN"
                    : roleCategory === "DEPARTMENT"
                      ? "ROLE_DEPT_OPERATION"
                      : "ROLE_USER_STANDARD"
                }
                value={createForm.authorCode}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, authorCode: event.target.value }))
                }
              />
            </label>
            <label>
              <span className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">
                {text(page, "Role 명", "Role Name")}
              </span>
              <AdminInput
                className="gov-select w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm"
                placeholder={
                  roleCategory === "GENERAL"
                    ? text(page, "운영 관리자", "Operations Administrator")
                    : roleCategory === "DEPARTMENT"
                      ? text(page, "부서 운영 역할", "Department Operations Role")
                      : text(page, "사용자 표준 역할", "User Standard Role")
                }
                value={createForm.authorNm}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, authorNm: event.target.value }))
                }
              />
            </label>
            <label className="md:col-span-2">
              <span className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">
                {text(page, "설명", "Description")}
              </span>
              <AdminInput
                className="gov-select w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm"
                placeholder={
                  roleCategory === "GENERAL"
                    ? text(page, "운영 업무 전반 권한", "Administrative role baseline")
                    : roleCategory === "DEPARTMENT"
                      ? text(page, "회사/부서 범위 역할 기준", "Department-scoped role baseline")
                      : text(page, "회사/사용자 범위 역할 기준", "User-scoped role baseline")
                }
                value={createForm.authorDc}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, authorDc: event.target.value }))
                }
              />
            </label>
            {(roleCategory === "DEPARTMENT" || roleCategory === "USER") && (
              <label className="md:col-span-2">
                <span className="gov-label block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">
                  {text(page, "회사 범위", "Company Scope")}
                </span>
                <AdminSelect
                  className="gov-select w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm"
                  disabled={!canManageAllCompanies}
                  value={insttId}
                  onChange={(event) => setInsttId(event.target.value)}
                >
                  {page?.isWebmaster ? (
                    <option value="">{text(page, "회사 지정 안 함", "No company scope")}</option>
                  ) : null}
                  {(page?.authGroupCompanyOptions || []).map((option) => (
                    <option key={option.insttId} value={option.insttId}>
                      {option.cmpnyNm}
                    </option>
                  ))}
                </AdminSelect>
                <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">
                  {page?.isWebmaster
                    ? text(
                        page,
                        "webmaster는 회사를 비워 공통 Role로 만들거나, 회사를 선택해 회사 범위 Role로 만들 수 있습니다.",
                        "Webmaster may leave the company empty to create a shared role, or choose a company to create a scoped role."
                      )
                    : text(
                        page,
                        "회사 범위 관리자는 본인 회사 Role만 생성할 수 있습니다.",
                        "Company-scoped administrators can create roles only for their own company."
                      )}
                </p>
              </label>
            )}
            <div className="md:col-span-4 flex justify-end">
              <MemberPermissionButton
                allowed={
                  roleCategory === "GENERAL"
                    ? permissions.canUseGeneralAuthGroupCreate
                    : permissions.canUseScopedAuthGroupCreate
                }
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-[var(--kr-gov-blue)] text-white disabled:opacity-50"
                reason={
                  roleCategory === "GENERAL"
                    ? text(page, "일반 권한 그룹 생성은 webmaster만 사용할 수 있습니다.", "Only webmaster can create general authority groups.")
                    : text(page, "회사 범위 권한이 있을 때만 부서/사용자 권한 그룹을 생성할 수 있습니다.", "Scoped authority is required to create department or user roles.")
                }
                type="submit"
              >
                {createButtonLabel()}
              </MemberPermissionButton>
            </div>
          </form>
        </section>
      </CanView>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] uppercase">
            {text(page, "권한 그룹 수", "Authority Groups")}
          </p>
          <p className="mt-2 text-3xl font-black">{page?.authorGroupCount ?? 0}</p>
        </div>
        <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] uppercase">
            {text(page, "페이지 수", "Page Catalog")}
          </p>
          <p className="mt-2 text-3xl font-black">{page?.pageCount ?? 0}</p>
        </div>
        <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] uppercase">
            {text(page, "기능 수", "Feature Catalog")}
          </p>
          <p className="mt-2 text-3xl font-black">{page?.featureCount ?? 0}</p>
        </div>
      </div>

      <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm mb-8">
        <div className="flex items-center gap-2 border-b pb-4 mb-4">
          <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">account_tree</span>
          <h3 className="text-lg font-bold">{text(page, "권한 모델 구조", "Authority Model")}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roleCategories.length === 0
            ? renderEmptyState(
                "권한 모델 설명이 아직 준비되지 않았습니다.",
                "Authority model details are not available yet."
              )
            : roleCategories.map((category, index) => (
                <article
                  className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4"
                  key={`${category.title || "category"}-${index}`}
                >
                  <h4 className="font-black">{category.title || "-"}</h4>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                    {category.description || "-"}
                  </p>
                </article>
              ))}
        </div>
      </section>

      <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm mb-8">
        <div className="flex items-center gap-2 border-b pb-4 mb-4">
          <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">playlist_add_check</span>
          <h3 className="text-lg font-bold">
            {text(page, "추가 준비가 필요한 권한 그룹", "Recommended Roles to Prepare")}
          </h3>
        </div>
        <div className="space-y-6">
          {roleCategory === "DEPARTMENT" ? (
            <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] overflow-hidden">
              <div className="bg-gray-50 border-b border-[var(--kr-gov-border-light)] px-4 py-4">
                <h4 className="font-black">{text(page, "부서 권한 그룹", "Department Authority Groups")}</h4>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {text(page, "선택한 회사의 부서에 적용 가능한 베이스라인 Role입니다.", "Baseline roles available for the selected company departments.")}
                </p>
              </div>
              {renderRecommendedTable(
                deptRoleSummaries.map((item) => ({
                  code: item.code,
                  name: item.name,
                  description: item.description,
                  status: item.status
                }))
              )}
            </section>
          ) : (
            recommendedRoleSections.map((section, index) => {
              const rows = (((section.roles as Array<Record<string, string>> | undefined) ||
                (section.items as Array<Record<string, string>> | undefined) ||
                [])).map((item) => ({
                code: item.code,
                name: item.name,
                description: item.description,
                status: item.status
              }));
              return (
                <section
                  className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] overflow-hidden"
                  key={`${String(section.title || "section")}-${index}`}
                >
                  <div className="bg-gray-50 border-b border-[var(--kr-gov-border-light)] px-4 py-4">
                    <h4 className="font-black">{String(section.title || text(page, "권한 그룹", "Role Group"))}</h4>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                      {String(section.description || "-")}
                    </p>
                  </div>
                  {renderRecommendedTable(rows)}
                </section>
              );
            })
          )}
        </div>
      </section>

      {roleCategory === "GENERAL" ? (
        <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm mb-8">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">admin_panel_settings</span>
            <h3 className="text-lg font-bold">{text(page, "권한 그룹 목록", "Authority Groups")}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {generalAuthorGroups.map((group, index) => (
              <article
                className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4 bg-gray-50"
                key={`${group.authorCode || "group"}-${index}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">{group.authorNm || "-"}</p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{group.authorCode || "-"}</p>
                  </div>
                  {renderExistingBadge(!!page?.isWebmaster)}
                </div>
                <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
                  {group.authorDc || text(page, "설명 없음", "No description")}
                </p>
              </article>
            ))}
          </div>
          {generalAuthorGroups.length === 0 ? (
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-6 text-center text-sm text-[var(--kr-gov-text-secondary)]">
              {text(page, "등록된 일반 권한 그룹이 없습니다.", "There are no general authority groups registered.")}
            </div>
          ) : null}
        </section>
      ) : null}

      {roleCategory === "DEPARTMENT" ? (
        <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm mb-8">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">account_tree</span>
            <h3 className="text-lg font-bold">{text(page, "부서 권한 그룹", "Department Authority Groups")}</h3>
          </div>
          <div className="overflow-x-auto">
            <AdminTable>
              <thead>
                <tr className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
                  <th className="px-4 py-3">{text(page, "회사명", "Company")}</th>
                  <th className="px-4 py-3">{text(page, "부서명", "Department")}</th>
                  <th className="px-4 py-3">{text(page, "회원 수", "Members")}</th>
                  <th className="px-4 py-3">{text(page, "부서 권한 Role", "Department Role")}</th>
                  <th className="px-4 py-3">{text(page, "상태", "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {departmentRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                      {text(page, "선택한 회사의 부서 권한 그룹이 없습니다.", "No department authority groups for the selected company.")}
                    </td>
                  </tr>
                ) : (
                  departmentRows.map((row, index) => (
                    <tr key={`${row.recommendedRoleCode || row.deptNm || "dept"}-${index}`}>
                      <td className="px-4 py-3 font-semibold">{row.cmpnyNm || "-"}</td>
                      <td className="px-4 py-3">{row.deptNm || "-"}</td>
                      <td className="px-4 py-3">{row.memberCount || "0"}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{row.recommendedRoleName || "-"}</div>
                        <div className="text-xs text-[var(--kr-gov-text-secondary)]">
                          {row.recommendedRoleCode || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{renderDepartmentStatus(row.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>
          </div>
        </section>
      ) : null}

      {roleCategory === "USER" ? (
        <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm mb-8">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">person_search</span>
            <h3 className="text-lg font-bold">{text(page, "사용자 권한 검색", "User Authority Search")}</h3>
          </div>
          <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={handleUserSearch}>
            <label className="min-w-[18rem]">
              <span className="block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">
                {text(page, "회사명", "Company")}
              </span>
              <AdminSelect
                className="w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm"
                disabled={!canManageAllCompanies}
                value={insttId}
                onChange={(event) => setInsttId(event.target.value)}
              >
                {(page?.authGroupCompanyOptions || []).map((option) => (
                  <option key={option.insttId} value={option.insttId}>
                    {`${option.insttId} / ${option.cmpnyNm}`}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <label className="min-w-[18rem]">
              <span className="block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">
                {text(page, "사용자 검색", "User search")}
              </span>
              <AdminInput
                className="w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm"
                placeholder={text(page, "사용자 ID / 이름 / 회사명", "User ID / name / company")}
                value={userSearchInput}
                onChange={(event) => setUserSearchInput(event.target.value)}
              />
            </label>
            <MemberButton className="h-10" size="xs" type="submit" variant="primary">
              {text(page, "검색", "Search")}
            </MemberButton>
          </form>
          <div className="overflow-x-auto">
            <AdminTable>
              <thead>
                <tr className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
                  <th className="px-4 py-3">{text(page, "사용자 ID", "User ID")}</th>
                  <th className="px-4 py-3">{text(page, "이름", "Name")}</th>
                  <th className="px-4 py-3">{text(page, "회사명", "Company")}</th>
                  <th className="px-4 py-3">{text(page, "현재 권한", "Current Authority")}</th>
                  <th className="px-4 py-3">{text(page, "부여 권한", "Grant Authority")}</th>
                  <th className="px-4 py-3">{text(page, "상태", "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {userAuthorityTargets.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-[var(--kr-gov-text-secondary)]" colSpan={6}>
                      {text(page, "회사와 사용자를 검색하면 사용자 권한 현황이 표시됩니다.", "Search a company and user to review user-specific authorities.")}
                    </td>
                  </tr>
                ) : (
                  userAuthorityTargets.map((row, index) => (
                    <tr key={`${row.userId || "user"}-${index}`}>
                      <td className="px-4 py-3 font-bold">{row.userId || "-"}</td>
                      <td className="px-4 py-3">{row.userNm || "-"}</td>
                      <td className="px-4 py-3">{row.cmpnyNm || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          {row.authorNm || text(page, "권한 미지정", "No authority assigned")}
                        </div>
                        <div className="text-xs text-[var(--kr-gov-text-secondary)]">
                          {row.authorCode || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          {authorCode ? selectedAuthorName : text(page, "선택 권한 없음", "No target selected")}
                        </div>
                        <div className="text-xs text-[var(--kr-gov-text-secondary)]">
                          {authorCode || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{renderUserAuthorityStatus(row)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>
          </div>
        </section>
      ) : null}

      <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm mb-8">
        <div className="flex items-center gap-2 border-b pb-4 mb-4">
          <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">manage_accounts</span>
          <h3 className="text-lg font-bold">{text(page, "권한 할당 / 부여 권한 구조", "Assignment and Grant Authority")}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {assignmentAuthorities.length === 0
            ? renderEmptyState(
                "권한 할당 구조 안내가 아직 준비되지 않았습니다.",
                "Assignment guidance is not available yet."
              )
            : assignmentAuthorities.map((item, index) => (
                <article
                  className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4 bg-gray-50"
                  key={`${item.title || "assign"}-${index}`}
                >
                  <h4 className="font-black">{item.title || "-"}</h4>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                    {item.description || "-"}
                  </p>
                </article>
              ))}
        </div>
        <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
          {text(
            page,
            "권장 운영 방식: 이 화면에서는 Role-기능 매핑을 관리하고, 회원 수정 화면에서는 현재 관리자에게 부여 가능한 Role만 노출합니다.",
            "Recommended operation: manage role-feature mapping here, then expose only grantable roles on the member edit page according to the current administrator."
          )}
        </div>
      </section>

      <CanView
        allowed={
          roleCategory === "GENERAL"
            ? permissions.canViewGeneralAuthGroupSection
            : permissions.canViewScopedAuthGroupSection
        }
        fallback={null}
      >
        <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm" data-help-id="auth-group-features">
          <GridToolbar title={text(page, "페이지별 기능 카탈로그", "Feature Catalog by Page")} />
          <div className="p-6">

          <div className="mb-4 flex items-center gap-3">
            <label className="block text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
              {text(page, "기준 권한 그룹", "Reference group")}
            </label>
            <select
              className="max-w-sm w-full border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] h-10 px-3 text-sm"
              value={authorCode}
              onChange={(event) => setAuthorCode(event.target.value)}
            >
              <option value="">{text(page, "권한 그룹 선택", "Select a role group")}</option>
              {referenceAuthorGroups.map((group) => (
                <option key={group.authorCode} value={group.authorCode}>
                  {`${group.authorNm} (${group.authorCode})`}
                </option>
              ))}
            </select>
            <MemberButton
              disabled={!authorCode}
              onClick={() => togglePinnedAuthorCode(authorCode)}
              size="sm"
              type="button"
              variant="secondary"
            >
              {pinnedAuthorCodes.includes(authorCode)
                ? text(page, "핀 해제", "Unpin")
                : text(page, "핀 고정", "Pin")}
            </MemberButton>
          </div>

          {pinnedReferenceGroups.length > 0 ? (
            <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold uppercase text-[var(--kr-gov-blue)]">
                {text(page, "고정 권한 그룹", "Pinned Role Groups")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pinnedReferenceGroups.map((group) => {
                  const groupCode = String(group.authorCode || "");
                  return (
                    <button
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${
                        groupCode === authorCode
                          ? "border-blue-300 bg-white text-[var(--kr-gov-blue)]"
                          : "border-blue-100 bg-white text-[var(--kr-gov-text-secondary)]"
                      }`}
                      key={groupCode}
                      onClick={() => setAuthorCode(groupCode)}
                      type="button"
                    >
                      {`${group.authorNm || groupCode} (${groupCode})`}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_1.1fr_0.8fr]">
            <label>
              <span className="block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">
                {text(page, "메뉴 검색", "Menu Search")}
              </span>
              <input
                className="gov-input"
                placeholder={text(page, "메뉴 코드, 메뉴명, URL 검색", "Search menu code, name, or URL")}
                value={menuSearchKeyword}
                onChange={(event) => setMenuSearchKeyword(event.target.value)}
              />
            </label>
            <label>
              <span className="block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">
                {text(page, "기능 검색", "Feature Search")}
              </span>
              <input
                className="gov-input"
                placeholder={text(page, "기능 코드, 기능명, 설명 검색", "Search feature code, name, or description")}
                value={featureSearchKeyword}
                onChange={(event) => setFeatureSearchKeyword(event.target.value)}
              />
            </label>
            <label>
              <span className="block text-[13px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">
                {text(page, "할당 상태", "Assignment Status")}
              </span>
              <select
                className="gov-select"
                value={featureAssignmentFilter}
                onChange={(event) => setFeatureAssignmentFilter(event.target.value)}
              >
                <option value="ALL">{text(page, "전체", "All")}</option>
                <option value="ASSIGNED">{text(page, "할당됨", "Assigned")}</option>
                <option value="UNASSIGNED">{text(page, "미할당", "Unassigned")}</option>
              </select>
            </label>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-3">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] uppercase">
                {text(page, "선택 권한", "Selected Role")}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-sm font-black">{selectedAuthorName}</p>
                {pinnedAuthorCodes.includes(authorCode) ? (
                  <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[var(--kr-gov-blue)]">
                    {text(page, "핀 고정됨", "Pinned")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{authorCode || "-"}</p>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-3">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] uppercase">
                {text(page, "선택 기능", "Selected Features")}
              </p>
              <p className="mt-2 text-2xl font-black">{selectedFeatures.length}</p>
              <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                {text(page, "현재 체크된 기능 수", "Currently checked features")}
              </p>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-3">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] uppercase">
                {text(page, "미할당 기능", "Unassigned Features")}
              </p>
              <p className="mt-2 text-2xl font-black">{page?.unassignedFeatureCount ?? 0}</p>
              <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                {`${page?.catalogFeatureCount ?? page?.featureCount ?? 0}${text(page, "개 전체 기능 기준", " in catalog")}`}
              </p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] uppercase">
                {text(page, "현재 표시 기능", "Visible Features")}
              </p>
              <p className="mt-2 text-2xl font-black">{totalVisibleFeatureCount}</p>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-bold uppercase text-emerald-700">
                {text(page, "추가 예정", "To Add")}
              </p>
              <p className="mt-2 text-2xl font-black text-emerald-700">{addedFeatureCodes.length}</p>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold uppercase text-amber-700">
                {text(page, "해제 예정", "To Remove")}
              </p>
              <p className="mt-2 text-2xl font-black text-amber-700">{removedFeatureCodes.length}</p>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold uppercase text-[var(--kr-gov-blue)]">
                {text(page, "변경 건수", "Pending Changes")}
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--kr-gov-blue)]">{addedFeatureCodes.length + removedFeatureCodes.length}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-bold uppercase text-[var(--kr-gov-text-secondary)]">
                {text(page, "변경 Diff", "Change Diff")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {addedFeatureCodes.slice(0, 8).map((code) => (
                  <span className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-mono text-emerald-700" key={`add-${code}`}>+ {code}</span>
                ))}
                {removedFeatureCodes.slice(0, 8).map((code) => (
                  <span className="inline-flex rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-mono text-amber-700" key={`remove-${code}`}>- {code}</span>
                ))}
                {addedFeatureCodes.length === 0 && removedFeatureCodes.length === 0 ? (
                  <span className="text-sm text-emerald-700">{text(page, "저장 전 변경 사항이 없습니다.", "No pending changes before save.")}</span>
                ) : null}
              </div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-bold uppercase text-[var(--kr-gov-text-secondary)]">
                {text(page, "위험도 요약", "Risk Summary")}
              </p>
              {riskFlags.length === 0 ? (
                <p className="mt-3 text-sm text-emerald-700">{text(page, "현재 눈에 띄는 위험 신호는 없습니다.", "No obvious risk signals in the current selection.")}</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {riskFlags.map((flag) => (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[12px] font-bold text-amber-800" key={flag}>{flag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 overflow-hidden">
            <GridToolbar title={text(page, "최근 변경 이력", "Recent Changes")} />
            <div className="px-4 py-4">
            {!authorCode ? (
              <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">{text(page, "권한 그룹을 선택하면 최근 변경 이력이 표시됩니다.", "Select a role group to view recent changes.")}</p>
            ) : auditLoading ? (
              <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">{text(page, "감사 이력을 불러오는 중입니다.", "Loading audit history.")}</p>
            ) : auditRows.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">{text(page, "최근 감사 이력이 없습니다.", "No recent audit events.")}</p>
            ) : (
              <div className="mt-3 space-y-3">
                {auditRows.map((row, index) => (
                  <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-3 text-sm" key={`${String(row.auditId || "audit")}-${index}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-[var(--kr-gov-text-primary)]">{String(row.actionCode || "-")}</p>
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-[var(--kr-gov-text-secondary)]"
                          onClick={() => toggleAuditExpansion(String(row.auditId || index))}
                          type="button"
                        >
                          {expandedAuditIds.includes(String(row.auditId || index))
                            ? text(page, "상세 접기", "Hide Details")
                            : text(page, "상세 보기", "View Details")}
                        </button>
                        <span className="text-xs text-[var(--kr-gov-text-secondary)]">{String(row.createdAt || "-")}</span>
                      </div>
                    </div>
                    <p className="mt-1 text-[var(--kr-gov-text-secondary)]">{text(page, "작업자", "Actor")}: {String(row.actorId || "-")}</p>
                    <p className="mt-1 text-[var(--kr-gov-text-secondary)]">{text(page, "결과", "Result")}: {String(row.resultStatus || "-")}</p>
                    {row.reasonSummary ? <p className="mt-1 text-[var(--kr-gov-text-secondary)]">{String(row.reasonSummary)}</p> : null}
                    <p className="mt-2 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] font-bold text-[var(--kr-gov-blue)]">
                      {summarizeAuthAuditDiff(page, row)}
                    </p>
                    {expandedAuditIds.includes(String(row.auditId || index)) ? (
                      <div className="mt-3 grid gap-3 xl:grid-cols-2">
                        <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="text-xs font-bold uppercase text-[var(--kr-gov-text-secondary)]">
                            {text(page, "변경 전", "Before")}
                          </p>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-[var(--kr-gov-text-secondary)]">
                            {formatAuditSnapshot(row.beforeSummaryJson || row.beforeData || row.beforeSummary) || text(page, "기록 없음", "No snapshot")}
                          </pre>
                        </div>
                        <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="text-xs font-bold uppercase text-[var(--kr-gov-text-secondary)]">
                            {text(page, "변경 후", "After")}
                          </p>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-[var(--kr-gov-text-secondary)]">
                            {formatAuditSnapshot(row.afterSummaryJson || row.afterData || row.afterSummary) || text(page, "기록 없음", "No snapshot")}
                          </pre>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <MemberButton onClick={() => setVisibleFeatures(true)} size="sm" type="button" variant="secondary">
              {text(page, "현재 표시 기능 전체 선택", "Select All Visible Features")}
            </MemberButton>
            <MemberButton onClick={() => setVisibleFeatures(false)} size="sm" type="button" variant="secondary">
              {text(page, "현재 표시 기능 전체 해제", "Clear All Visible Features")}
            </MemberButton>
            <MemberButton onClick={() => setCollapsedMenuCodes([])} size="sm" type="button" variant="secondary">
              {text(page, "페이지 전체 펼치기", "Expand All Pages")}
            </MemberButton>
            <MemberButton onClick={() => setCollapsedMenuCodes(visibleFeatureSections.map((section) => section.menuCode))} size="sm" type="button" variant="secondary">
              {text(page, "페이지 전체 접기", "Collapse All Pages")}
            </MemberButton>
          </div>

          <div className="space-y-6">
            {!authorCode
              ? renderEmptyState(
                  "기능 할당을 검토하려면 기준 권한 그룹을 먼저 선택하세요.",
                  "Select a reference role group to review feature assignments."
                )
              : visibleFeatureSections.length === 0
                ? renderEmptyState(
                    "선택한 권한 그룹에 표시할 기능 카탈로그가 없습니다.",
                    "There is no feature catalog available for the selected role group."
                  )
                : visibleFeatureSections.map((section) => {
                    const sectionFocused = !!focusedMenuCode && String(section.menuCode || "").toUpperCase() === focusedMenuCode.toUpperCase();
                    const collapsed = collapsedMenuCodes.includes(section.menuCode);
                    return (
                      <section
                        id={`auth-section-${section.menuCode}`}
                        className={`rounded-[var(--kr-gov-radius)] border overflow-hidden ${sectionFocused ? "border-blue-300 shadow-[0_0_0_2px_rgba(28,100,242,0.12)]" : "border-[var(--kr-gov-border-light)]"}`}
                        key={section.menuCode}
                      >
                        <div className={`flex flex-col gap-1 px-4 py-4 border-b border-[var(--kr-gov-border-light)] ${sectionFocused ? "bg-blue-50" : "bg-gray-50"}`}>
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h4 className="font-black">
                                {page?.isEn ? section.menuNmEn || section.menuNm || section.menuCode : section.menuNm || section.menuNmEn || section.menuCode}
                              </h4>
                              <p className="text-xs text-[var(--kr-gov-text-secondary)]">
                                {section.menuCode}
                                {section.menuUrl ? ` | ${section.menuUrl}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button className="gov-btn gov-btn-outline-blue" onClick={() => toggleSectionCollapse(section.menuCode)} type="button">
                                {collapsed ? text(page, "펼치기", "Expand") : text(page, "접기", "Collapse")}
                              </button>
                              {sectionFocused ? (
                                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-[var(--kr-gov-blue)] text-white">
                                  {text(page, "포커스 메뉴", "Focused menu")}
                                </span>
                              ) : null}
                              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-blue-50 text-[var(--kr-gov-blue)]">
                                {`${section.features.length}${text(page, "개 기능", " features")}`}
                              </span>
                            </div>
                          </div>
                        </div>
                        {!collapsed ? (
                        <div className="overflow-x-auto">
                          <table className="w-full table-fixed text-sm text-left border-collapse">
                            <colgroup>
                              <col className="w-[18%]" />
                              <col className="w-[18%]" />
                              <col className="w-[18%]" />
                              <col className="w-[28%]" />
                              <col className="w-[9%]" />
                              <col className="w-[9%]" />
                            </colgroup>
                            <thead>
                              <tr className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[13px] font-bold text-[var(--kr-gov-text-secondary)]">
                                <th className="px-4 py-3">{text(page, "기능 코드", "Feature Code")}</th>
                                <th className="px-4 py-3">{text(page, "기능명", "Feature Name")}</th>
                                <th className="px-4 py-3">{text(page, "영문 기능명", "English Name")}</th>
                                <th className="px-4 py-3">{text(page, "기능 설명", "Description")}</th>
                                <th className="px-4 py-3 text-center">{text(page, "사용", "Use")}</th>
                                <th className="px-4 py-3 text-center">{text(page, "할당", "Assigned")}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {section.features.map((feature) => {
                                const featureFocused = !!focusedFeatureCode && String(feature.featureCode || "").toUpperCase() === focusedFeatureCode.toUpperCase();
                                return (
                                  <tr className={featureFocused ? "bg-[rgba(28,100,242,0.06)]" : ""} id={`auth-feature-${feature.featureCode}`} key={feature.featureCode}>
                                    <td className="px-4 py-3 font-bold break-all">{feature.featureCode}</td>
                                    <td className="px-4 py-3 break-words">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span>{feature.featureNm || "-"}</span>
                                        {featureFocused ? (
                                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold bg-[var(--kr-gov-blue)] text-white">
                                            {text(page, "포커스 기능", "Focused feature")}
                                          </span>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 break-words">{feature.featureNmEn || "-"}</td>
                                    <td className="px-4 py-3 break-words text-[var(--kr-gov-text-secondary)]">{feature.featureDc || "-"}</td>
                                    <td className="px-4 py-3 text-center font-semibold">{feature.useAt || "-"}</td>
                                    <td className="px-4 py-3 text-center">
                                      <input
                                        checked={selectedFeatures.includes(feature.featureCode)}
                                        className="h-4 w-4"
                                        disabled={
                                          roleCategory === "GENERAL"
                                            ? !permissions.canUseGeneralFeatureSave
                                            : !permissions.canUseScopedFeatureSave
                                        }
                                        onChange={() => toggleFeature(feature.featureCode)}
                                        type="checkbox"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        ) : null}
                      </section>
                    );
                  })}
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-[var(--kr-gov-text-secondary)]">
              <div className="font-semibold text-[var(--kr-gov-text-primary)]">
                {text(page, "저장 대상", "Saving Target")}: {selectedAuthorName} ({authorCode || "-"})
              </div>
              <div className="mt-1">
                {text(page, "추가", "Add")} {addedFeatureCodes.length}
                {" · "}
                {text(page, "해제", "Remove")} {removedFeatureCodes.length}
                {" · "}
                {text(page, "표시 중", "Visible")} {totalVisibleFeatureCount}
              </div>
            </div>
            <MemberPermissionButton
              allowed={
                !!authorCode &&
                (roleCategory === "GENERAL"
                  ? permissions.canUseGeneralFeatureSave
                  : permissions.canUseScopedFeatureSave)
              }
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold bg-[var(--kr-gov-blue)] text-white disabled:opacity-50"
              onClick={handleSaveFeatures}
              reason={
                roleCategory === "GENERAL"
                  ? text(page, "일반 권한 그룹 기능 저장은 webmaster만 사용할 수 있습니다.", "Only webmaster can save general role features.")
                  : text(page, "회사 범위 권한이 있을 때만 부서/사용자 권한 그룹 기능을 저장할 수 있습니다.", "Scoped authority is required to save department or user role features.")
              }
              type="button"
            >
              {page?.isWebmaster || roleCategory !== "GENERAL"
                ? text(page, "Role 기능 저장", "Save Role Features")
                : text(page, "webmaster 전용", "Webmaster only")}
            </MemberPermissionButton>
          </div>
        </div>
        </section>
      </CanView>
      </AdminAuthorityPageFrame>
    </AdminPageShell>
  );
}
