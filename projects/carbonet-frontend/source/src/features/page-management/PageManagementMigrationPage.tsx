import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchPageManagementPage } from "../../lib/api/platform";
import type { PageManagementPagePayload } from "../../lib/api/platformTypes";
import { postFormUrlEncoded } from "../../lib/api/core";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { stringOf, submitFormRequest } from "../admin-system/adminSystemShared";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard, WarningPanel } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type Filters = {
  menuType: string;
  searchKeyword: string;
  searchUrl: string;
  searchDomainCode: string;
  searchUseAt: string;
  autoFeature: string;
  updated: string;
  deleted: string;
  deletedRoleRefs: string;
  deletedUserOverrides: string;
};

type PageSortOption = "code-asc" | "code-desc" | "name-asc" | "url-asc" | "useAt";
const PAGE_MANAGEMENT_RECENT_CODES_STORAGE_KEY = "carbonet.page-management.recent-codes";

function parseFilters(): Filters {
  const search = new URLSearchParams(window.location.search);
  return {
    menuType: search.get("menuType") || "ADMIN",
    searchKeyword: search.get("searchKeyword") || "",
    searchUrl: search.get("searchUrl") || "",
    searchDomainCode: search.get("searchDomainCode") || "",
    searchUseAt: search.get("searchUseAt") || "",
    autoFeature: search.get("autoFeature") || "",
    updated: search.get("updated") || "",
    deleted: search.get("deleted") || "",
    deletedRoleRefs: search.get("deletedRoleRefs") || "",
    deletedUserOverrides: search.get("deletedUserOverrides") || ""
  };
}

function buildQueryString(filters: Filters) {
  const search = new URLSearchParams();
  if (filters.menuType) search.set("menuType", filters.menuType);
  if (filters.searchKeyword) search.set("searchKeyword", filters.searchKeyword);
  if (filters.searchUrl) search.set("searchUrl", filters.searchUrl);
  if (filters.searchDomainCode) search.set("searchDomainCode", filters.searchDomainCode);
  if (filters.searchUseAt) search.set("searchUseAt", filters.searchUseAt);
  if (filters.autoFeature) search.set("autoFeature", filters.autoFeature);
  if (filters.updated) search.set("updated", filters.updated);
  if (filters.deleted) search.set("deleted", filters.deleted);
  if (filters.deletedRoleRefs) search.set("deletedRoleRefs", filters.deletedRoleRefs);
  if (filters.deletedUserOverrides) search.set("deletedUserOverrides", filters.deletedUserOverrides);
  return search.toString();
}

function extractQueryState(url: string): Partial<Filters> {
  const parsed = new URL(url, window.location.origin);
  const search = parsed.searchParams;
  return {
    menuType: search.get("menuType") || "ADMIN",
    searchKeyword: search.get("searchKeyword") || "",
    searchUrl: search.get("searchUrl") || "",
    searchDomainCode: search.get("searchDomainCode") || "",
    searchUseAt: search.get("searchUseAt") || "",
    autoFeature: search.get("autoFeature") || "",
    updated: search.get("updated") || "",
    deleted: search.get("deleted") || "",
    deletedRoleRefs: search.get("deletedRoleRefs") || "",
    deletedUserOverrides: search.get("deletedUserOverrides") || ""
  };
}

type IconPickerProps = {
  icons: string[];
  value: string;
  onChange: (value: string) => void;
  searchPlaceholder: string;
  helperText: string;
};

function IconPicker(props: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const filteredIcons = useMemo(
    () => props.icons.filter((icon) => !keyword || icon.toLowerCase().includes(keyword.toLowerCase())),
    [keyword, props.icons]
  );

  return (
    <details className="relative" open={open}>
      <summary className="flex w-full cursor-pointer items-center justify-between rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-2 text-sm list-none" onClick={(event) => {
        event.preventDefault();
        setOpen((current) => !current);
      }}>
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined">{props.value || "web"}</span>
          <span>{props.value || "web"}</span>
        </span>
        <span className="material-symbols-outlined text-[18px]">expand_more</span>
      </summary>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-3 shadow-lg">
          <input className="gov-input mb-3" placeholder={props.searchPlaceholder} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          <p className="mb-2 text-xs text-[var(--kr-gov-text-secondary)]">{props.helperText}</p>
          <div className="grid max-h-[28rem] grid-cols-4 gap-2 overflow-y-auto md:grid-cols-6">
            {filteredIcons.map((icon) => (
              <button
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--kr-gov-radius)] border px-2 py-3 text-xs transition-colors ${icon === props.value ? "border-[var(--kr-gov-blue)] bg-blue-50 font-bold text-[var(--kr-gov-blue)]" : "border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-secondary)] hover:border-[var(--kr-gov-blue)] hover:bg-blue-50"}`}
                key={icon}
                onClick={() => {
                  props.onChange(icon);
                  setOpen(false);
                }}
                type="button"
              >
                <span className="material-symbols-outlined">{icon}</span>
                <span>{icon}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </details>
  );
}

type RowFormState = {
  codeNm: string;
  codeDc: string;
  menuUrl: string;
  menuIcon: string;
  useAt: string;
};

function createRowFormState(row: Record<string, unknown>): RowFormState {
  return {
    codeNm: stringOf(row, "codeNm"),
    codeDc: stringOf(row, "codeDc"),
    menuUrl: stringOf(row, "menuUrl"),
    menuIcon: stringOf(row, "menuIcon") || "web",
    useAt: stringOf(row, "useAt") || "Y"
  };
}

function sortPageRows(rows: Array<Record<string, unknown>>, sortOption: PageSortOption) {
  const nextRows = [...rows];
  nextRows.sort((left, right) => {
    const leftCode = stringOf(left, "code");
    const rightCode = stringOf(right, "code");
    const leftName = stringOf(left, "codeNm");
    const rightName = stringOf(right, "codeNm");
    const leftUrl = stringOf(left, "menuUrl");
    const rightUrl = stringOf(right, "menuUrl");
    const leftUseAt = stringOf(left, "useAt") || "Y";
    const rightUseAt = stringOf(right, "useAt") || "Y";
    if (sortOption === "code-desc") {
      return rightCode.localeCompare(leftCode, undefined, { numeric: true });
    }
    if (sortOption === "name-asc") {
      return leftName.localeCompare(rightName, undefined, { numeric: true })
        || leftCode.localeCompare(rightCode, undefined, { numeric: true });
    }
    if (sortOption === "url-asc") {
      return leftUrl.localeCompare(rightUrl, undefined, { numeric: true })
        || leftCode.localeCompare(rightCode, undefined, { numeric: true });
    }
    if (sortOption === "useAt") {
      return leftUseAt.localeCompare(rightUseAt)
        || leftName.localeCompare(rightName, undefined, { numeric: true })
        || leftCode.localeCompare(rightCode, undefined, { numeric: true });
    }
    return leftCode.localeCompare(rightCode, undefined, { numeric: true });
  });
  return nextRows;
}

function validatePageForm(params: {
  en: boolean;
  code: string;
  codeNm: string;
  menuUrl: string;
  menuType: string;
  domainCode?: string;
}) {
  const { en, code, codeNm, menuUrl, menuType, domainCode } = params;
  const normalizedCode = code.trim().toUpperCase();
  const normalizedUrl = menuUrl.trim();
  if (domainCode !== undefined && !domainCode.trim()) {
    return en ? "Select a domain first." : "도메인을 먼저 선택하세요.";
  }
  if (!normalizedCode) {
    return en ? "Enter a page code." : "페이지 코드를 입력하세요.";
  }
  if (!/^[A-Z0-9]{8}$/.test(normalizedCode)) {
    return en ? "Page code must be 8 uppercase letters or digits." : "페이지 코드는 8자리 대문자/숫자여야 합니다.";
  }
  if (domainCode && !normalizedCode.startsWith(domainCode.trim().toUpperCase())) {
    return en ? "Page code must start with the selected domain code." : "페이지 코드는 선택한 도메인 코드로 시작해야 합니다.";
  }
  if (!codeNm.trim()) {
    return en ? "Enter a page name." : "페이지명을 입력하세요.";
  }
  if (!normalizedUrl) {
    return en ? "Enter a page URL." : "페이지 URL을 입력하세요.";
  }
  if (!normalizedUrl.startsWith("/")) {
    return en ? "Page URL must start with /." : "페이지 URL은 / 로 시작해야 합니다.";
  }
  if (menuType === "ADMIN" && !normalizedUrl.startsWith("/admin/")) {
    return en ? "Admin page URL must start with /admin/." : "관리자 페이지 URL은 /admin/으로 시작해야 합니다.";
  }
  if (menuType === "USER" && !normalizedUrl.startsWith("/home/")) {
    return en ? "Home page URL must start with /home/." : "홈 페이지 URL은 /home/으로 시작해야 합니다.";
  }
  return "";
}

function readRecentCodesFromSessionStorage() {
  try {
    const raw = window.sessionStorage.getItem(PAGE_MANAGEMENT_RECENT_CODES_STORAGE_KEY) || "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "")).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function PageManagementMigrationPage() {
  const en = isEnglish();
  const initial = useMemo(parseFilters, []);
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [openCode, setOpenCode] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [highlightedCode, setHighlightedCode] = useState("");
  const [recentCodes, setRecentCodes] = useState<string[]>(() => readRecentCodesFromSessionStorage());
  const [recentOnly, setRecentOnly] = useState(false);
  const [savingCodes, setSavingCodes] = useState<string[]>([]);
  const [savedCodes, setSavedCodes] = useState<string[]>([]);
  const [failedCodes, setFailedCodes] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<PageSortOption>("code-asc");
  const [createForm, setCreateForm] = useState({
    domainCode: "",
    code: "",
    codeNm: "",
    codeDc: "",
    menuUrl: "",
    menuIcon: "web",
    useAt: "Y"
  });
  const [editForms, setEditForms] = useState<Record<string, RowFormState>>({});
  const pageState = useAsyncValue<PageManagementPagePayload>(() => fetchPageManagementPage(filters), [filters.menuType, filters.searchKeyword, filters.searchUrl, filters.autoFeature, filters.updated, filters.deleted, filters.deletedRoleRefs, filters.deletedUserOverrides], {
    onSuccess(payload) {
      const next = {
        menuType: String(payload.menuType || "ADMIN"),
        searchKeyword: String(payload.searchKeyword || ""),
        searchUrl: String(payload.searchUrl || ""),
        searchDomainCode: filters.searchDomainCode,
        searchUseAt: filters.searchUseAt,
        autoFeature: filters.autoFeature,
        updated: filters.updated,
        deleted: filters.deleted,
        deletedRoleRefs: filters.deletedRoleRefs,
        deletedUserOverrides: filters.deletedUserOverrides
      };
      setDraft(next);
      const nextRows = (payload.pageRows || []) as Array<Record<string, unknown>>;
      setEditForms(() => {
        const nextState: Record<string, RowFormState> = {};
        nextRows.forEach((row) => {
          const code = stringOf(row, "code");
          if (!code) {
            return;
          }
          nextState[code] = createRowFormState(row);
        });
        return nextState;
      });
    }
  });
  const page = pageState.value;
  const rows = (page?.pageRows || []) as Array<Record<string, unknown>>;
  const domainOptions = (page?.domainOptions || []) as Array<Record<string, unknown>>;
  const iconOptions = ((page?.iconOptions || []) as string[]).length > 0 ? (page?.iconOptions as string[]) : ["web"];
  const useAtOptions = ((page?.useAtOptions || []) as string[]).length > 0 ? (page?.useAtOptions as string[]) : ["Y", "N"];
  const blockedLinks = (page?.pageMgmtBlockedFeatureLinks || []) as Array<Record<string, string>>;
  const existingCodeSet = useMemo(() => new Set(rows.map((row) => stringOf(row, "code").toUpperCase()).filter(Boolean)), [rows]);
  const existingUrlMap = useMemo(() => rows.reduce<Record<string, string>>((result, row) => {
    const url = stringOf(row, "menuUrl").trim();
    const code = stringOf(row, "code").toUpperCase();
    if (url && code) {
      result[url] = code;
    }
    return result;
  }, {}), [rows]);

  const filteredRows = useMemo(() => sortPageRows(rows.filter((row) => {
    if (draft.searchDomainCode && stringOf(row, "domainCode") !== draft.searchDomainCode) {
      return false;
    }
    if (draft.searchUseAt && stringOf(row, "useAt") !== draft.searchUseAt) {
      return false;
    }
    if (recentOnly && !recentCodes.includes(stringOf(row, "code"))) {
      return false;
    }
    return true;
  }), sortOption), [draft.searchDomainCode, draft.searchUseAt, recentCodes, recentOnly, rows, sortOption]);

  const dirtyCodes = useMemo(() => filteredRows.flatMap((row) => {
    const code = stringOf(row, "code");
    const current = editForms[code];
    const initialRow = createRowFormState(row);
    if (!code || !current) {
      return [];
    }
    const changed = current.codeNm !== initialRow.codeNm
      || current.codeDc !== initialRow.codeDc
      || current.menuUrl !== initialRow.menuUrl
      || current.menuIcon !== initialRow.menuIcon
      || current.useAt !== initialRow.useAt;
    return changed ? [code] : [];
  }), [editForms, filteredRows]);
  const createDuplicateCode = createForm.code.trim() && existingCodeSet.has(createForm.code.trim().toUpperCase());
  const createDuplicateUrlOwner = createForm.menuUrl.trim() ? existingUrlMap[createForm.menuUrl.trim()] || "" : "";

  useEffect(() => {
    function syncFiltersFromLocation() {
      const next = parseFilters();
      setFilters(next);
      setDraft(next);
    }
    const navigationEventName = getNavigationEventName();
    window.addEventListener("popstate", syncFiltersFromLocation);
    window.addEventListener(navigationEventName, syncFiltersFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFiltersFromLocation);
      window.removeEventListener(navigationEventName, syncFiltersFromLocation);
    };
  }, []);

  useEffect(() => {
    const query = buildQueryString(filters);
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [filters]);

  useEffect(() => {
    if (!highlightedCode) {
      return;
    }
    const timer = window.setTimeout(() => setHighlightedCode(""), 5000);
    return () => window.clearTimeout(timer);
  }, [highlightedCode]);

  useEffect(() => {
    window.sessionStorage.setItem(PAGE_MANAGEMENT_RECENT_CODES_STORAGE_KEY, JSON.stringify(recentCodes));
  }, [recentCodes]);

  useEffect(() => {
    if (savedCodes.length === 0 && failedCodes.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSavedCodes([]);
      setFailedCodes([]);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [failedCodes, savedCodes]);

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "page-management", {
      route: window.location.pathname,
      menuType: filters.menuType,
      rowCount: rows.length,
      filteredRowCount: filteredRows.length,
      domainOptionCount: domainOptions.length,
      blockedFeatureLinkCount: blockedLinks.length,
      dirtyCount: dirtyCodes.length,
      sortOption
    });
    logGovernanceScope("COMPONENT", "page-management-table", {
      component: "page-management-table",
      rowCount: filteredRows.length,
      openCode
    });
  }, [blockedLinks.length, dirtyCodes.length, domainOptions.length, filters.menuType, filteredRows.length, openCode, page, rows.length, sortOption]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>, nextState?: Partial<Filters>) {
    event.preventDefault();
    logGovernanceScope("ACTION", "page-management-submit", {
      menuType: draft.menuType,
      searchKeyword: draft.searchKeyword,
      searchUrl: draft.searchUrl
    });
    setActionError("");
    setActionMessage("");
    setSavedCodes([]);
    setFailedCodes([]);
    try {
      const response = await submitFormRequest(event.currentTarget);
      const merged = { ...draft, ...extractQueryState(response.url), ...(nextState || {}) } as Filters;
      setFilters(merged);
      setDraft(merged);
      await pageState.reload();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : (en ? "Request failed." : "요청 처리에 실패했습니다."));
    }
  }

  function ensureDomainPrefix(domainCode: string) {
    setCreateForm((current) => {
      if (!domainCode) {
        return { ...current, domainCode };
      }
      const code = current.code.trim().toUpperCase();
      const nextCode = !code || code.length < domainCode.length || !code.startsWith(domainCode) ? domainCode : code;
      return { ...current, domainCode, code: nextCode };
    });
  }

  function submitCreateForm(event: FormEvent<HTMLFormElement>) {
    const validationError = validatePageForm({
      en,
      code: createForm.code,
      codeNm: createForm.codeNm,
      menuUrl: createForm.menuUrl,
      menuType: draft.menuType,
      domainCode: createForm.domainCode
    });
    if (validationError) {
      event.preventDefault();
      setActionError(validationError);
      return;
    }
    if (createDuplicateCode) {
      event.preventDefault();
      setActionError(en ? "This page code already exists." : "이미 존재하는 페이지 코드입니다.");
      return;
    }
    if (createDuplicateUrlOwner) {
      event.preventDefault();
      setActionError(en ? `This URL is already used by ${createDuplicateUrlOwner}.` : `이 URL은 이미 ${createDuplicateUrlOwner} 코드가 사용 중입니다.`);
      return;
    }
    const nextCode = createForm.code.trim().toUpperCase();
    setHighlightedCode(nextCode);
    setRecentCodes((current) => [nextCode, ...current.filter((item) => item !== nextCode)].slice(0, 20));
    void handleSubmit(event, { autoFeature: "Y", updated: "", deleted: "" });
  }

  function submitEditForm(event: FormEvent<HTMLFormElement>, code: string) {
    const editForm = editForms[code];
    const validationError = validatePageForm({
      en,
      code,
      codeNm: editForm?.codeNm || "",
      menuUrl: editForm?.menuUrl || "",
      menuType: draft.menuType
    });
    if (validationError) {
      event.preventDefault();
      setActionError(validationError);
      return;
    }
    const duplicateUrlOwner = editForm?.menuUrl.trim() ? existingUrlMap[editForm.menuUrl.trim()] || "" : "";
    if (duplicateUrlOwner && duplicateUrlOwner !== code) {
      event.preventDefault();
      setActionError(en ? `This URL is already used by ${duplicateUrlOwner}.` : `이 URL은 이미 ${duplicateUrlOwner} 코드가 사용 중입니다.`);
      return;
    }
    setHighlightedCode(code);
    setRecentCodes((current) => [code, ...current.filter((item) => item !== code)].slice(0, 20));
    void handleSubmit(event, { updated: "Y", autoFeature: "", deleted: "" });
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setActionError("");
      setActionMessage(successMessage);
    } catch {
      setActionError(en ? "Copy failed." : "복사에 실패했습니다.");
    }
  }

  const saveDirtyRows = async () => {
    if (dirtyCodes.length === 0) {
      setActionMessage(en ? "There are no edited rows to save." : "저장할 수정 행이 없습니다.");
      return;
    }
    setActionError("");
    setActionMessage("");
    setSavedCodes([]);
    setFailedCodes([]);
    for (const code of dirtyCodes) {
      setSavingCodes((current) => [...current, code]);
      const editForm = editForms[code];
      if (!editForm) {
        setSavingCodes((current) => current.filter((item) => item !== code));
        continue;
      }
      const validationError = validatePageForm({
        en,
        code,
        codeNm: editForm.codeNm,
        menuUrl: editForm.menuUrl,
        menuType: draft.menuType
      });
      if (validationError) {
        setSavingCodes((current) => current.filter((item) => item !== code));
        throw new Error(`${code}: ${validationError}`);
      }
      const duplicateUrlOwner = editForm.menuUrl.trim() ? existingUrlMap[editForm.menuUrl.trim()] || "" : "";
      if (duplicateUrlOwner && duplicateUrlOwner !== code) {
        setSavingCodes((current) => current.filter((item) => item !== code));
        throw new Error(en ? `${code}: URL is already used by ${duplicateUrlOwner}.` : `${code}: URL이 이미 ${duplicateUrlOwner} 코드에 사용 중입니다.`);
      }
      const body = new URLSearchParams();
      body.set("code", code);
      body.set("menuType", draft.menuType);
      body.set("searchKeyword", draft.searchKeyword);
      body.set("searchUrl", draft.searchUrl);
      body.set("codeNm", editForm.codeNm);
      body.set("codeDc", editForm.codeDc);
      body.set("menuUrl", editForm.menuUrl);
      body.set("menuIcon", editForm.menuIcon);
      body.set("useAt", editForm.useAt);
      try {
        await postFormUrlEncoded(buildLocalizedPath("/admin/system/page-management/update", "/en/admin/system/page-management/update"), body);
        setSavedCodes((current) => [...current, code]);
      } catch (error) {
        setFailedCodes((current) => [...current, code]);
        throw error;
      } finally {
        setSavingCodes((current) => current.filter((item) => item !== code));
      }
    }
    setHighlightedCode(dirtyCodes[dirtyCodes.length - 1] || "");
    setRecentCodes((current) => [...dirtyCodes.slice().reverse(), ...current.filter((item) => !dirtyCodes.includes(item))].slice(0, 20));
    const nextFilters = { ...draft, updated: "Y", autoFeature: "", deleted: "" };
    setFilters(nextFilters);
    setDraft(nextFilters);
    await pageState.reload();
    setActionMessage(en ? "Edited rows have been saved." : "수정된 행을 저장했습니다.");
  };

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Code Management" : "코드 관리" },
        { label: en ? "Screen Management" : "화면 관리" }
      ]}
      title={en ? "Screen Management" : "화면 관리"}
      subtitle={en ? "Manage screen codes and URLs used in the admin menu based on common-code records." : "관리자 메뉴에 등록되는 화면 코드와 URL을 공통코드 기준으로 관리합니다."}
    >
      <AdminWorkspacePageFrame>
        {page?.pageMgmtError || actionError || pageState.error ? (
          <PageStatusNotice tone="error">
            <p className="leading-6">{actionError || page?.pageMgmtError || pageState.error}</p>
            {blockedLinks.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {blockedLinks.map((item) => (
                  <a className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100" href={stringOf(item, "href")} key={stringOf(item, "featureCode")}>
                    <span className="material-symbols-outlined text-[16px]">link</span>
                    <span>{stringOf(item, "featureCode")}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </PageStatusNotice>
        ) : null}
        {page?.pageMgmtMessage || actionMessage ? <PageStatusNotice tone="success">{actionMessage || String(page?.pageMgmtMessage)}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
          <SummaryMetricCard title={en ? "Registered Pages" : "등록 페이지"} value={`${filteredRows.length} / ${rows.length}`} description={en ? "Filtered / total" : "필터 결과 / 전체"} />
          <SummaryMetricCard title={en ? "Unsaved Edits" : "미저장 수정"} value={String(dirtyCodes.length)} description={en ? "Changed rows in current view" : "현재 화면에서 변경된 행"} />
          <SummaryMetricCard title={en ? "Blocked Links" : "차단 링크"} value={String(blockedLinks.length)} description={en ? "Follow-up links after failed actions" : "실패 후 후속 이동 링크"} />
          <SummaryMetricCard title={en ? "Current Scope" : "현재 구분"} value={filters.menuType} description={en ? "Synced to URL query" : "URL 쿼리와 동기화"} />
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="page-management-register">
          <GridToolbar
            meta={en ? "Register a new page code, route, and default VIEW feature from one form." : "페이지 코드, route, 기본 VIEW 기능을 한 폼에서 같이 등록합니다."}
            title={en ? "Register Page" : "페이지 등록"}
          />
          <div className="p-6">
        <form action={buildLocalizedPath("/admin/system/page-management/create", "/en/admin/system/page-management/create")} className="grid grid-cols-1 gap-4 xl:grid-cols-6" method="post" onSubmit={submitCreateForm}>
          <input name="menuType" type="hidden" value={draft.menuType} />
          <div>
            <label className="gov-label" htmlFor="domainCode">{en ? "Domain" : "도메인"}</label>
            <select className="gov-select" id="domainCode" name="domainCode" value={createForm.domainCode} onChange={(event) => ensureDomainPrefix(event.target.value)}>
              <option value="">{en ? "Select" : "선택"}</option>
              {domainOptions.map((opt) => (
                <option key={stringOf(opt, "code")} value={stringOf(opt, "code")}>{stringOf(opt, "label")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="gov-label" htmlFor="code">{en ? "Page Code" : "페이지 코드"}</label>
            <input className="gov-input" id="code" maxLength={8} name="code" placeholder={en ? "e.g. A0060105" : "예: A0060105"} value={createForm.code} onChange={(event) => setCreateForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} />
            {createDuplicateCode ? <p className="mt-1 text-xs text-red-600">{en ? "This code already exists." : "이미 존재하는 코드입니다."}</p> : null}
          </div>
          <div>
            <label className="gov-label" htmlFor="codeNm">{en ? "Page Name" : "페이지명"}</label>
            <input className="gov-input" id="codeNm" name="codeNm" placeholder={en ? "e.g. Page Management" : "예: 페이지 관리"} value={createForm.codeNm} onChange={(event) => setCreateForm((current) => ({ ...current, codeNm: event.target.value }))} />
          </div>
          <div>
            <label className="gov-label" htmlFor="codeDc">{en ? "English Page Name" : "영문 페이지명"}</label>
            <input className="gov-input" id="codeDc" name="codeDc" placeholder="Page Management" value={createForm.codeDc} onChange={(event) => setCreateForm((current) => ({ ...current, codeDc: event.target.value }))} />
          </div>
          <div className="xl:col-span-2">
            <label className="gov-label" htmlFor="menuUrl">{en ? "Page URL" : "페이지 URL"}</label>
            <input className="gov-input" id="menuUrl" name="menuUrl" placeholder={en ? "e.g. /admin/system/page-management" : "예: /admin/system/page-management"} value={createForm.menuUrl} onChange={(event) => setCreateForm((current) => ({ ...current, menuUrl: event.target.value }))} />
            {createDuplicateUrlOwner ? <p className="mt-1 text-xs text-red-600">{en ? `Duplicate URL with ${createDuplicateUrlOwner}` : `${createDuplicateUrlOwner} 코드와 URL 중복`}</p> : null}
          </div>
          <div>
            <label className="gov-label">{en ? "Menu Icon" : "메뉴 아이콘"}</label>
            <input name="menuIcon" type="hidden" value={createForm.menuIcon} />
            <IconPicker helperText={en ? "Scroll to view the full icon list." : "스크롤해서 전체 아이콘을 볼 수 있습니다."} icons={iconOptions} onChange={(value) => setCreateForm((current) => ({ ...current, menuIcon: value }))} searchPlaceholder={en ? "Search icons" : "아이콘 검색"} value={createForm.menuIcon} />
          </div>
          <div>
            <label className="gov-label" htmlFor="useAt">{en ? "Use" : "사용 여부"}</label>
            <select className="gov-select" id="useAt" name="useAt" value={createForm.useAt} onChange={(event) => setCreateForm((current) => ({ ...current, useAt: event.target.value }))}>
              {useAtOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)] xl:col-span-4">
            {en ? "When a domain is selected, the page-code input is prefilled with the common-code prefix for that domain. Page codes follow the 8-digit detail-code convention." : "도메인을 선택하면 페이지 코드 입력칸에 해당 도메인 공통코드 앞자리를 미리 채웁니다. 페이지 코드는 8자리 상세 코드 체계를 따릅니다."}
          </div>
          <div className="rounded-[var(--kr-gov-radius)] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 xl:col-span-2">
            {en ? <>Registering a page automatically creates the default <span className="font-bold">PAGE_CODE_VIEW</span> feature. Review role assignment manually in the authority group screen.</> : <>페이지 등록 시 <span className="font-bold">페이지코드_VIEW</span> 기본 기능을 자동 생성합니다. 권한 부여는 권한 그룹 화면에서 수동으로 검토하세요.</>}
          </div>
          <div className="flex justify-end gap-2 xl:col-span-6">
            <button className="gov-btn gov-btn-primary" type="submit">{en ? "Add Page Code" : "페이지 코드 추가"}</button>
          </div>
        </form>
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0" data-help-id="page-management-list">
          <GridToolbar
            meta={en ? "Search, inspect dirty edits, and update existing page rows." : "기존 페이지 행을 조회하고, 수정 상태를 확인한 뒤 바로 반영합니다."}
            title={en ? "Registered Pages" : "등록 페이지 목록"}
          />
          <div className="p-6">
        <form className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-6" onSubmit={(event) => {
          event.preventDefault();
          const nextFilters = { ...draft, autoFeature: "", updated: "", deleted: "", deletedRoleRefs: "", deletedUserOverrides: "" };
          setFilters(nextFilters);
          setDraft(nextFilters);
        }}>
          <div>
            <label className="gov-label" htmlFor="menuType">{en ? "Screen" : "화면 구분"}</label>
            <select className="gov-select" id="menuType" value={draft.menuType} onChange={(event) => setDraft((current) => ({ ...current, menuType: event.target.value }))}>
              <option value="USER">{en ? "Home" : "홈"}</option>
              <option value="ADMIN">{en ? "Admin" : "관리자"}</option>
            </select>
          </div>
          <div>
            <label className="gov-label" htmlFor="searchKeyword">{en ? "Search by Name or Code" : "페이지명/코드 검색"}</label>
            <input className="gov-input" id="searchKeyword" placeholder={en ? "e.g. Page Management or A0060105" : "예: 페이지 관리 또는 A0060105"} value={draft.searchKeyword} onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))} />
          </div>
          <div>
            <label className="gov-label" htmlFor="searchUrl">{en ? "Search by URL" : "URL 검색"}</label>
            <input className="gov-input" id="searchUrl" placeholder="/admin/system" value={draft.searchUrl} onChange={(event) => setDraft((current) => ({ ...current, searchUrl: event.target.value }))} />
          </div>
          <div>
            <label className="gov-label" htmlFor="searchDomainCode">{en ? "Domain Filter" : "도메인 필터"}</label>
            <select className="gov-select" id="searchDomainCode" value={draft.searchDomainCode} onChange={(event) => setDraft((current) => ({ ...current, searchDomainCode: event.target.value }))}>
              <option value="">{en ? "All domains" : "전체 도메인"}</option>
              {domainOptions.map((opt) => (
                <option key={stringOf(opt, "code")} value={stringOf(opt, "code")}>{stringOf(opt, "label")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="gov-label" htmlFor="searchUseAt">{en ? "Use Filter" : "사용 필터"}</label>
            <select className="gov-select" id="searchUseAt" value={draft.searchUseAt} onChange={(event) => setDraft((current) => ({ ...current, searchUseAt: event.target.value }))}>
              <option value="">{en ? "All" : "전체"}</option>
              {useAtOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label className="gov-label" htmlFor="sortOption">{en ? "Sort" : "정렬"}</label>
            <select className="gov-select" id="sortOption" value={sortOption} onChange={(event) => setSortOption(event.target.value as PageSortOption)}>
              <option value="code-asc">{en ? "Code ascending" : "코드 오름차순"}</option>
              <option value="code-desc">{en ? "Code descending" : "코드 내림차순"}</option>
              <option value="name-asc">{en ? "Name ascending" : "이름 오름차순"}</option>
              <option value="url-asc">{en ? "URL ascending" : "URL 오름차순"}</option>
              <option value="useAt">{en ? "Use status first" : "사용여부 우선"}</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-2 text-sm">
              <input checked={recentOnly} className="h-4 w-4" onChange={(event) => setRecentOnly(event.target.checked)} type="checkbox" />
              <span>{en ? "Recent Only" : "최근 작업만"}</span>
            </label>
          </div>
          <div className="flex items-end gap-2">
            <button className="gov-btn gov-btn-outline w-full" type="submit">{en ? "Search" : "조회"}</button>
            <button className="gov-btn gov-btn-outline w-full" onClick={() => {
              const reset = {
                ...draft,
                searchKeyword: "",
                searchUrl: "",
                searchDomainCode: "",
                searchUseAt: "",
                autoFeature: "",
                updated: "",
                deleted: "",
                deletedRoleRefs: "",
                deletedUserOverrides: ""
              };
              setDraft(reset);
              setFilters(reset);
            }} type="button">{en ? "Reset" : "초기화"}</button>
          </div>
        </form>

        {dirtyCodes.length > 0 ? (
          <CollectionResultPanel className="mb-4" description={en ? "Rows below have local edits that are not saved yet." : "아래 행 중 아직 저장되지 않은 수정 대상이 있습니다."} icon="edit_note" title={en ? "Unsaved edited rows" : "미저장 수정 행"}>
            <div className="mb-3 flex justify-end">
              <button className="gov-btn gov-btn-primary" onClick={() => { void saveDirtyRows().catch((error: Error) => setActionError(error.message)); }} type="button">
                {en ? "Save Edited Rows" : "수정 행 저장"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {dirtyCodes.slice(0, 10).map((code) => <span className="gov-chip bg-indigo-100 text-indigo-700" key={code}>{code}</span>)}
              {dirtyCodes.length > 10 ? <span className="gov-chip bg-slate-100 text-slate-700">+{dirtyCodes.length - 10}</span> : null}
            </div>
            {savingCodes.length > 0 ? <p className="mt-3 text-xs text-[var(--kr-gov-text-secondary)]">{en ? `Saving: ${savingCodes.join(", ")}` : `저장 중: ${savingCodes.join(", ")}`}</p> : null}
          </CollectionResultPanel>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="gov-table-header">
                <th className="px-4 py-3">{en ? "Domain" : "도메인"}</th>
                <th className="sticky left-0 z-10 bg-[var(--kr-gov-surface-subtle)] px-4 py-3">{en ? "Page Code" : "페이지 코드"}</th>
                <th className="px-4 py-3">{en ? "Page Name" : "페이지명"}</th>
                <th className="px-4 py-3">{en ? "English Page Name" : "영문 페이지명"}</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">{en ? "Icon" : "아이콘"}</th>
                <th className="px-4 py-3 text-center">{en ? "Use" : "사용"}</th>
                <th className="sticky right-0 z-10 bg-[var(--kr-gov-surface-subtle)] px-4 py-3 text-center">{en ? "Actions" : "관리"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={8}>{en ? "No registered pages." : "등록된 페이지가 없습니다."}</td></tr>
              ) : filteredRows.flatMap((row) => {
                const code = stringOf(row, "code");
                const editForm = editForms[code] || createRowFormState(row);
                const initialRow = createRowFormState(row);
                const duplicateUrlOwner = editForm.menuUrl.trim() ? existingUrlMap[editForm.menuUrl.trim()] || "" : "";
                const isDirty = editForm.codeNm !== initialRow.codeNm
                  || editForm.codeDc !== initialRow.codeDc
                  || editForm.menuUrl !== initialRow.menuUrl
                  || editForm.menuIcon !== initialRow.menuIcon
                  || editForm.useAt !== initialRow.useAt;
                const isHighlighted = highlightedCode === code;
                return [
                  <tr className={isHighlighted ? "bg-amber-50" : isDirty ? "bg-[#f8fbff]" : ""} key={`${code}-view`}>
                    <td className="whitespace-nowrap px-4 py-3">{en ? stringOf(row, "domainNameEn", "domainName") : stringOf(row, "domainName")}</td>
                    <td className={`sticky left-0 z-[1] whitespace-nowrap px-4 py-3 font-bold ${isHighlighted ? "bg-amber-50" : isDirty ? "bg-[#f8fbff]" : "bg-white"}`}>{code}</td>
                    <td className="min-w-[12rem] px-4 py-3">{stringOf(row, "codeNm")}</td>
                    <td className="min-w-[12rem] px-4 py-3">{stringOf(row, "codeDc")}</td>
                    <td className="min-w-[16rem] break-all px-4 py-3 text-[var(--kr-gov-text-secondary)]">
                      <div>{stringOf(row, "menuUrl")}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button className="gov-btn gov-btn-outline" onClick={() => { void copyText(code, en ? `Copied ${code}.` : `${code} 복사됨.`); }} type="button">{en ? "Copy Code" : "코드 복사"}</button>
                        <button className="gov-btn gov-btn-outline" onClick={() => { void copyText(stringOf(row, "menuUrl"), en ? "Copied URL." : "URL 복사됨."); }} type="button">{en ? "Copy URL" : "URL 복사"}</button>
                        <a className="gov-btn gov-btn-outline" href={stringOf(row, "menuUrl")} rel="noreferrer" target="_blank">{en ? "Open" : "열기"}</a>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-[var(--kr-gov-text-secondary)]">
                        <span className="material-symbols-outlined text-[18px]">{stringOf(row, "menuIcon") || "web"}</span>
                        <span>{stringOf(row, "menuIcon") || "web"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{stringOf(row, "useAt")}</td>
                    <td className={`sticky right-0 z-[1] whitespace-nowrap px-4 py-3 text-center ${isHighlighted ? "bg-amber-50" : isDirty ? "bg-[#f8fbff]" : "bg-white"}`}>
                      <div className="flex flex-col items-center gap-2">
                        <button className="gov-btn gov-btn-outline w-full" onClick={() => setOpenCode((current) => current === code ? "" : code)} type="button">{openCode === code ? (en ? "Close Edit" : "수정 닫기") : (en ? "Edit" : "수정")}</button>
                        <form action={buildLocalizedPath("/admin/system/page-management/delete", "/en/admin/system/page-management/delete")} method="post" onSubmit={(event) => {
                          if (!window.confirm(en
                            ? `Delete and recreate if needed. Default VIEW cleanup impact: role mappings ${numberToText(row.defaultViewRoleRefCount)}, user overrides ${numberToText(row.defaultViewUserOverrideCount)}. Continue?`
                            : `삭제 후 다시 생성해야 합니다. 기본 VIEW 정리 영향: 권한그룹 매핑 ${numberToText(row.defaultViewRoleRefCount)}건, 사용자 예외권한 ${numberToText(row.defaultViewUserOverrideCount)}건. 계속하시겠습니까?`)) {
                            event.preventDefault();
                            return;
                          }
                          void handleSubmit(event, {
                            deleted: "Y",
                            autoFeature: "",
                            updated: "",
                            deletedRoleRefs: numberToText(row.defaultViewRoleRefCount),
                            deletedUserOverrides: numberToText(row.defaultViewUserOverrideCount)
                          });
                        }}>
                          <input name="code" type="hidden" value={code} />
                          <input name="menuType" type="hidden" value={draft.menuType} />
                          <input name="searchKeyword" type="hidden" value={draft.searchKeyword} />
                          <input name="searchUrl" type="hidden" value={draft.searchUrl} />
                          <button className="gov-btn gov-btn-danger w-full" type="submit">{en ? "Delete" : "삭제"}</button>
                        </form>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          <span className="gov-chip bg-blue-50 text-[var(--kr-gov-blue)]">{`Role ${numberToText(row.defaultViewRoleRefCount)}`}</span>
                          <span className="gov-chip bg-amber-50 text-amber-800">{`User ${numberToText(row.defaultViewUserOverrideCount)}`}</span>
                          {isDirty ? <span className="gov-chip bg-indigo-100 text-indigo-700">{en ? "Edited" : "수정됨"}</span> : null}
                          {isHighlighted ? <span className="gov-chip bg-amber-100 text-amber-800">{en ? "Recent" : "최근 작업"}</span> : null}
                          {savingCodes.includes(code) ? <span className="gov-chip bg-sky-100 text-sky-700">{en ? "Saving" : "저장 중"}</span> : null}
                          {savedCodes.includes(code) ? <span className="gov-chip bg-emerald-100 text-emerald-700">{en ? "Saved" : "저장 완료"}</span> : null}
                          {failedCodes.includes(code) ? <span className="gov-chip bg-red-100 text-red-700">{en ? "Failed" : "실패"}</span> : null}
                        </div>
                        <div className="mt-2 w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2 text-left text-xs text-[var(--kr-gov-text-secondary)]">
                          <p>{en ? "Delete impact" : "삭제 영향"}</p>
                          <p className="mt-1">{en ? `Role mappings ${numberToText(row.defaultViewRoleRefCount)}, user overrides ${numberToText(row.defaultViewUserOverrideCount)}` : `권한그룹 매핑 ${numberToText(row.defaultViewRoleRefCount)}건, 사용자 예외권한 ${numberToText(row.defaultViewUserOverrideCount)}건`}</p>
                        </div>
                      </div>
                    </td>
                  </tr>,
                  openCode === code ? (
                    <tr className={isHighlighted ? "bg-amber-50" : "bg-gray-50"} key={`${code}-edit`}>
                      <td className="px-4 py-4" colSpan={8}>
                        <form action={buildLocalizedPath("/admin/system/page-management/update", "/en/admin/system/page-management/update")} className="grid grid-cols-1 items-end gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4 md:grid-cols-6" method="post" onSubmit={(event) => submitEditForm(event, code)}>
                          <input name="code" type="hidden" value={code} />
                          <input name="menuType" type="hidden" value={draft.menuType} />
                          <input name="searchKeyword" type="hidden" value={draft.searchKeyword} />
                          <input name="searchUrl" type="hidden" value={draft.searchUrl} />
                          <label>
                            <span className="gov-label">{en ? "Page Name" : "페이지명"}</span>
                            <input className="gov-input" name="codeNm" value={editForm.codeNm} onChange={(event) => setEditForms((current) => ({ ...current, [code]: { ...editForm, codeNm: event.target.value } }))} />
                          </label>
                          <label>
                            <span className="gov-label">{en ? "English Page Name" : "영문 페이지명"}</span>
                            <input className="gov-input" name="codeDc" value={editForm.codeDc} onChange={(event) => setEditForms((current) => ({ ...current, [code]: { ...editForm, codeDc: event.target.value } }))} />
                          </label>
                          <label className="md:col-span-2">
                            <span className="gov-label">{en ? "Page URL" : "페이지 URL"}</span>
                            <input className="gov-input" name="menuUrl" value={editForm.menuUrl} onChange={(event) => setEditForms((current) => ({ ...current, [code]: { ...editForm, menuUrl: event.target.value } }))} />
                            {duplicateUrlOwner && duplicateUrlOwner !== code ? (
                              <p className="mt-1 text-xs text-red-600">{en ? `Duplicate URL with ${duplicateUrlOwner}` : `${duplicateUrlOwner} 코드와 URL 중복`}</p>
                            ) : null}
                          </label>
                          <label>
                            <span className="gov-label">{en ? "Menu Icon" : "메뉴 아이콘"}</span>
                            <input name="menuIcon" type="hidden" value={editForm.menuIcon} />
                            <IconPicker helperText={en ? "Scroll to view the full icon list." : "스크롤해서 전체 아이콘을 볼 수 있습니다."} icons={iconOptions} onChange={(value) => setEditForms((current) => ({ ...current, [code]: { ...editForm, menuIcon: value } }))} searchPlaceholder={en ? "Search icons" : "아이콘 검색"} value={editForm.menuIcon} />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label>
                              <span className="gov-label">{en ? "Use" : "사용"}</span>
                              <select className="gov-select" name="useAt" value={editForm.useAt} onChange={(event) => setEditForms((current) => ({ ...current, [code]: { ...editForm, useAt: event.target.value } }))}>
                                {useAtOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </label>
                            <div className="flex items-end">
                              <button className="gov-btn gov-btn-outline w-full" type="submit">{en ? "Save Edit" : "수정 저장"}</button>
                            </div>
                          </div>
                          <div className="md:col-span-6 flex justify-end gap-2">
                            <button
                              className="gov-btn gov-btn-outline"
                              onClick={() => setEditForms((current) => ({ ...current, [code]: createRowFormState(row) }))}
                              type="button"
                            >
                              {en ? "Reset Row" : "행 되돌리기"}
                            </button>
                            <button className="gov-btn gov-btn-outline" onClick={() => setOpenCode("")} type="button">{en ? "Close" : "닫기"}</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : null
                ];
              })}
            </tbody>
          </table>
        </div>
          {blockedLinks.length > 0 ? (
            <WarningPanel className="mt-4 mb-0" title={en ? "Blocked follow-up links" : "차단 후속 링크"}>
              <div className="flex flex-wrap gap-2">
                {blockedLinks.map((item) => (
                  <a className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100" href={stringOf(item, "href")} key={`footer-${stringOf(item, "featureCode")}`}>
                    <span className="material-symbols-outlined text-[16px]">link</span>
                    <span>{stringOf(item, "featureCode")}</span>
                  </a>
                ))}
              </div>
            </WarningPanel>
          ) : null}
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

function numberToText(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}
