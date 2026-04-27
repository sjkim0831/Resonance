import { ReactNode, SyntheticEvent, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  applyAdminSessionSimulator,
  invalidateFrontendSessionCache,
  fetchAdminMenuTree,
  fetchAdminSessionSimulator,
  fetchFrontendSession,
  getAdminMenuTreeRefreshEventName,
  readAdminMenuTreeSnapshot,
  readFrontendSessionSnapshot,
  resetAdminSessionSimulator
} from "../../lib/api/adminShell";
import {
  ADMIN_MENU_CODE_LABEL_OVERRIDES_EN,
  ADMIN_MENU_CODE_LABEL_OVERRIDES_KO,
  type AdminMenuDomain,
  type AdminMenuGroup,
  type AdminMenuLink,
  type AdminSessionSimulationPayload,
  type FrontendSession
} from "../../lib/api/adminShellTypes";
import { fetchJson } from "../../lib/api/core";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { findRouteDefinitionByPath } from "../../app/routes/definitions";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type AdminPageShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  contextStrip?: ReactNode;
  sidebarVariant?: string;
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
};

type GnbItem = {
  key: string;
  label: string;
  href: string;
  domain: string;
};

type MenuLinkLike = {
  code?: string;
  text?: string;
  tEn?: string;
  u?: string;
  icon?: string;
};

type MenuIndexEntry = {
  domainKey: string;
  groupKey: string;
  linkIndex: number;
};

type MenuIndex = {
  exactPathMap: Record<string, MenuIndexEntry>;
  basePathMap: Record<string, MenuIndexEntry>;
};

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_FOOTER_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";
const ADMIN_SESSION_STORAGE_KEY = "adminSessionExpireAt";
const ADMIN_SIMULATOR_EXPANDED_STORAGE_KEY = "adminDevSimulatorExpanded";
const ADMIN_SIDEBAR_SCROLL_STORAGE_KEY = "adminSidebarScrollTop";
const ADMIN_SIDEBAR_OPEN_GROUPS_STORAGE_KEY = "adminSidebarOpenGroups";
const ADMIN_SESSION_DURATION_MS = 60 * 60 * 1000;
const ADMIN_SESSION_WARNING_MS = 5 * 60 * 1000;
const ADMIN_SESSION_DANGER_MS = 60 * 1000;
function handleGovSymbolError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

function readStoredAdminSessionExpireAt() {
  const stored = window.sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || "";
  const parsed = Number.parseInt(stored, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isFreshAdminLoginNavigation() {
  if (!document.referrer) {
    return false;
  }
  try {
    const referrer = new URL(document.referrer, window.location.origin);
    return referrer.origin === window.location.origin
      && (referrer.pathname === "/admin/login/loginView"
        || referrer.pathname === "/en/admin/login/loginView");
  } catch {
    return false;
  }
}

function ensureAdminSessionExpireAt() {
  const now = Date.now();
  if (isFreshAdminLoginNavigation()) {
    const next = now + ADMIN_SESSION_DURATION_MS;
    window.sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, String(next));
    return next;
  }
  const stored = readStoredAdminSessionExpireAt();
  if (stored > now) {
    return stored;
  }
  const next = now + ADMIN_SESSION_DURATION_MS;
  window.sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, String(next));
  return next;
}

function formatAdminSessionRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readStoredAdminSimulatorExpanded() {
  if (typeof window === "undefined") {
    return false;
  }
  const stored = window.localStorage.getItem(ADMIN_SIMULATOR_EXPANDED_STORAGE_KEY);
  if (stored === "Y") {
    return true;
  }
  if (stored === "N") {
    return false;
  }
  return false;
}

function normalizeComparablePath(value: string) {
  if (!value) {
    return "/";
  }
  try {
    const url = new URL(value, window.location.origin);
    const normalizedPath = url.pathname.length > 1 && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
    if (normalizedPath === "/admin/member/withdrawn") {
      return "/admin/member/list?sbscrbSttus=D";
    }
    if (normalizedPath === "/en/admin/member/withdrawn") {
      return "/en/admin/member/list?sbscrbSttus=D";
    }
    if (normalizedPath === "/admin/member/activate") {
      return "/admin/member/list?sbscrbSttus=X";
    }
    if (normalizedPath === "/en/admin/member/activate") {
      return "/en/admin/member/list?sbscrbSttus=X";
    }
    return `${normalizedPath}${url.search}`;
  } catch {
    return value;
  }
}

function pathOnly(value: string) {
  const [pathname] = normalizeComparablePath(value).split("?");
  return pathname;
}

function resolveMenuComparablePath(value: string, preserveDirectMenu = true) {
  const normalized = normalizeComparablePath(value);
  try {
    const url = new URL(normalized, window.location.origin);
    const pathname = pathOnly(url.pathname);

    if (pathname === "/admin/member/edit"
      || pathname === "/en/admin/member/edit"
      || pathname === "/admin/member/detail"
      || pathname === "/en/admin/member/detail") {
      return pathname.startsWith("/en/") ? "/en/admin/member/list" : "/admin/member/list";
    }

    if (pathname === "/admin/member/company_detail" || pathname === "/en/admin/member/company_detail") {
      return pathname.startsWith("/en/") ? "/en/admin/member/company_list" : "/admin/member/company_list";
    }

    if ((pathname === "/admin/member/company_account" || pathname === "/en/admin/member/company_account")
      && url.searchParams.get("insttId")) {
      return pathname.startsWith("/en/") ? "/en/admin/member/company_list" : "/admin/member/company_list";
    }

    if (pathname === "/admin/member/admin_account/permissions" || pathname === "/en/admin/member/admin_account/permissions") {
      return pathname.startsWith("/en/") ? "/en/admin/member/admin_list" : "/admin/member/admin_list";
    }

    if (pathname === "/admin/emission/result_detail" || pathname === "/en/admin/emission/result_detail") {
      return pathname.startsWith("/en/") ? "/en/admin/emission/result_list" : "/admin/emission/result_list";
    }

    if (!preserveDirectMenu) {
      return `${pathname}${url.search}`;
    }

    return normalized;
  } catch {
    return normalized;
  }
}

function resolveMenuLinkRuntimeUrl(link: MenuLinkLike | undefined) {
  return String(link?.u || "").trim();
}

function isLikelyMenuCodeLabel(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return true;
  }
  return /^[A-Z][A-Z0-9_]{3,}$/.test(normalized) || /^[A-Z]\d{3,}$/.test(normalized);
}

function resolveRouteBackedMenuLabel(runtimeUrl: string, en: boolean) {
  const targetPath = pathOnly(resolveMenuComparablePath(runtimeUrl, false));
  if (!targetPath || targetPath === "/") {
    return "";
  }
  const matchedRoute = findRouteDefinitionByPath(targetPath);
  if (!matchedRoute) {
    return "";
  }
  if (en) {
    const englishPathLabel = pathOnly(matchedRoute.enPath).split("/").filter(Boolean).pop() || "";
    return englishPathLabel.replace(/-/g, " ");
  }
  return matchedRoute.label;
}

function resolveSidebarLinkLabel(link: MenuLinkLike | undefined, en: boolean) {
  const fallbackLabel = en ? String(link?.tEn || link?.text || "").trim() : String(link?.text || link?.tEn || "").trim();
  if (!isLikelyMenuCodeLabel(fallbackLabel)) {
    return fallbackLabel;
  }
  const routeLabel = resolveRouteBackedMenuLabel(resolveMenuLinkRuntimeUrl(link), en);
  return routeLabel || fallbackLabel;
}

function resolveCodeBackedMenuLabel(value: string, en: boolean) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) {
    return "";
  }
  return en ? (ADMIN_MENU_CODE_LABEL_OVERRIDES_EN[normalized] || "") : (ADMIN_MENU_CODE_LABEL_OVERRIDES_KO[normalized] || "");
}

function resolveSidebarGroupTitle(group: AdminMenuGroup, en: boolean) {
  const fallbackLabel = en ? String(group.titleEn || group.title || "").trim() : String(group.title || group.titleEn || "").trim();
  if (!isLikelyMenuCodeLabel(fallbackLabel)) {
    return fallbackLabel;
  }
  return resolveCodeBackedMenuLabel(fallbackLabel, en) || fallbackLabel;
}

function resolveSidebarDomainLabel(domainKey: string, domain: AdminMenuDomain | undefined, en: boolean) {
  const fallbackLabel = en
    ? String(domain?.labelEn || domain?.label || domainKey || "").trim()
    : String(domain?.label || domain?.labelEn || domainKey || "").trim();
  if (!isLikelyMenuCodeLabel(fallbackLabel)) {
    return fallbackLabel;
  }
  return resolveCodeBackedMenuLabel(fallbackLabel, en) || fallbackLabel;
}

function shouldHideSidebarLink(link: MenuLinkLike | undefined) {
  void link;
  return false;
}

function visibleLinks(links: AdminMenuLink[] | undefined): AdminMenuLink[] {
  return (links || []).filter((link) => !shouldHideSidebarLink(link));
}

function slugifyGroupKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "group";
}

function getStableGroupToken(group: AdminMenuGroup) {
  const links = visibleLinks(group.links);
  const linkCodes = links
    .map((link) => link.code || resolveMenuLinkRuntimeUrl(link) || link.text || link.tEn || "")
    .filter(Boolean)
    .join("|");
  return slugifyGroupKey(linkCodes || group.title || group.titleEn || "group");
}

function getMenuGroupKey(domainKey: string, group: AdminMenuGroup, index: number) {
  const base = slugifyGroupKey(group.title || group.titleEn || `group-${index}`);
  return `${domainKey}:${base}:${getStableGroupToken(group)}`;
}

function readStoredOpenGroups() {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.sessionStorage.getItem(ADMIN_SIDEBAR_OPEN_GROUPS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, boolean> : {};
  } catch {
    return {};
  }
}

function buildMenuIndex(menuTree: Record<string, AdminMenuDomain>): MenuIndex {
  const exactPathMap: Record<string, MenuIndexEntry> = {};
  const basePathMap: Record<string, MenuIndexEntry> = {};

  Object.entries(menuTree).forEach(([domainKey, domain]) => {
    (domain.groups || []).forEach((group, groupIndex) => {
      const groupKey = getMenuGroupKey(domainKey, group, groupIndex);
      visibleLinks(group.links).forEach((link, linkIndex) => {
        const runtimeUrl = resolveMenuLinkRuntimeUrl(link);
        if (!runtimeUrl || runtimeUrl === "#") {
          return;
        }
        const fullPath = resolveMenuComparablePath(runtimeUrl, true);
        const basePath = pathOnly(fullPath);
        const entry = { domainKey, groupKey, linkIndex };
        if (fullPath && !exactPathMap[fullPath]) {
          exactPathMap[fullPath] = entry;
        }
        if (basePath && !basePathMap[basePath]) {
          basePathMap[basePath] = entry;
        }
      });
    });
  });

  return { exactPathMap, basePathMap };
}

function resolveMenuIndexEntry(menuIndex: MenuIndex, currentPath: string) {
  const currentFull = resolveMenuComparablePath(currentPath, false);
  const currentBase = pathOnly(currentFull);
  return menuIndex.exactPathMap[currentFull] || menuIndex.basePathMap[currentBase] || null;
}

function resolveFirstDomainPath(domain: AdminMenuDomain | undefined) {
  if (!domain) {
    return "#";
  }
  for (const group of domain.groups || []) {
    for (const link of visibleLinks(group.links)) {
      const runtimeUrl = resolveMenuLinkRuntimeUrl(link);
      if (runtimeUrl && runtimeUrl !== "#") {
        return runtimeUrl;
      }
    }
  }
  return "#";
}

function normalizeMenuSearchText(value: string | undefined) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreMenuSearchMatch(query: string, ...candidates: Array<string | undefined>) {
  if (!query) {
    return 0;
  }

  let bestScore = 0;
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeMenuSearchText(candidate);
    if (!normalizedCandidate) {
      continue;
    }
    if (normalizedCandidate === query) {
      bestScore = Math.max(bestScore, 3);
      continue;
    }
    const tokens = normalizedCandidate.split(" ");
    if (tokens.includes(query)) {
      bestScore = Math.max(bestScore, 2);
      continue;
    }
    if (normalizedCandidate.includes(query)) {
      bestScore = Math.max(bestScore, 1);
    }
  }

  return bestScore;
}

function filterMenuGroups(groups: AdminMenuGroup[] | undefined, rawQuery: string, en: boolean) {
  const normalizedQuery = normalizeMenuSearchText(rawQuery);
  const sourceGroups = (groups || []).map((group) => ({ ...group, links: visibleLinks(group.links) }));

  if (!normalizedQuery) {
    return {
      groups: sourceGroups.filter((group) => (group.links || []).length > 0),
      visibleLinkCount: sourceGroups.reduce((count, group) => count + (group.links || []).length, 0)
    };
  }

  const evaluatedGroups = sourceGroups.map((group) => {
    const linkEntries = (group.links || []).map((link) => ({
      link,
      score: scoreMenuSearchMatch(normalizedQuery, link.text, link.tEn, en ? link.tEn : link.text)
    }));

    return {
      group,
      groupScore: scoreMenuSearchMatch(normalizedQuery, group.title, group.titleEn, en ? group.titleEn : group.title),
      linkEntries
    };
  });

  const hasStrongLinkMatch = evaluatedGroups.some((group) => group.linkEntries.some((entry) => entry.score >= 2));
  const filteredGroups = evaluatedGroups.flatMap(({ group, groupScore, linkEntries }) => {
    const matchedLinks = linkEntries
      .filter((entry) => entry.score > 0 && (!hasStrongLinkMatch || entry.score >= 2))
      .map((entry) => entry.link);

    if (matchedLinks.length > 0) {
      return [{ ...group, links: matchedLinks }];
    }
    if (groupScore > 0 && !hasStrongLinkMatch) {
      return [{ ...group }];
    }
    return [];
  });

  return {
    groups: filteredGroups.filter((group) => (group.links || []).length > 0),
    visibleLinkCount: filteredGroups.reduce((count, group) => count + (group.links || []).length, 0)
  };
}

async function handleAdminLogout() {
  try {
    await fetchJson(buildLocalizedPath("/admin/login/actionLogout", "/en/admin/login/actionLogout"), {
      method: "POST"
    });
  } finally {
    invalidateFrontendSessionCache();
    navigate(buildLocalizedPath("/admin/login/loginView", "/en/admin/login/loginView"));
  }
}

export function AdminPageShell({
  title,
  subtitle,
  actions,
  breadcrumbs,
  contextStrip,
  sidebarVariant: _sidebarVariant,
  loading = false,
  loadingLabel,
  children
}: AdminPageShellProps) {
  const en = isEnglish();
  const [showDeferredChrome, setShowDeferredChrome] = useState(false);
  const [initialMenuTree] = useState(() => readAdminMenuTreeSnapshot());
  const [bootstrappedSession] = useState<FrontendSession | null>(() => readFrontendSessionSnapshot());
  const embeddedInLegacyAdminShell = typeof document !== "undefined" && (() => {
    const root = document.getElementById("root");
    if (!root) {
      return false;
    }
    if (root.closest("#main-content")) {
      return true;
    }
    return !!root.closest(".js-admin-layout-shell");
  })();
  const currentPath = `${window.location.pathname}${window.location.search}`;
  const hasInitialMenuTree = Boolean(initialMenuTree && Object.keys(initialMenuTree).length);
  const menuState = useAsyncValue(fetchAdminMenuTree, [], {
    initialValue: initialMenuTree,
    skipInitialLoad: hasInitialMenuTree
  });
  const fallbackMenuTree = useMemo(
    () => (initialMenuTree && Object.keys(initialMenuTree).length ? initialMenuTree : {}),
    [initialMenuTree]
  );
  const menuTree = useMemo<Record<string, AdminMenuDomain>>(
    () => Object.keys(menuState.value || {}).length ? (menuState.value || {}) : fallbackMenuTree,
    [fallbackMenuTree, menuState.value]
  );
  const menuIndex = useMemo(() => buildMenuIndex(menuTree), [menuTree]);
  const activeMenuEntry = useMemo(() => resolveMenuIndexEntry(menuIndex, currentPath), [menuIndex, currentPath]);
  const activeDomainKey = activeMenuEntry?.domainKey || Object.keys(menuTree)[0] || "";
  const [selectedDomainKey, setSelectedDomainKey] = useState(activeDomainKey);
  const [menuFilter, setMenuFilter] = useState("");
  const deferredMenuFilter = useDeferredValue(menuFilter);
  const selectedDomain = menuTree[selectedDomainKey] || menuTree[activeDomainKey];
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => readStoredOpenGroups());
  const [sessionRemainingMs, setSessionRemainingMs] = useState(() => Math.max(0, ensureAdminSessionExpireAt() - Date.now()));
  const [sessionRefreshPending, setSessionRefreshPending] = useState(false);
  const [devSession, setDevSession] = useState<FrontendSession | null>(bootstrappedSession);
  const [simulatorPayload, setSimulatorPayload] = useState<AdminSessionSimulationPayload | null>(null);
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [simulatorSubmitting, setSimulatorSubmitting] = useState(false);
  const [simulatorMessage, setSimulatorMessage] = useState("");
  const [simulatorExpanded, setSimulatorExpanded] = useState(() => readStoredAdminSimulatorExpanded());
  const [selectedSimulatorInsttId, setSelectedSimulatorInsttId] = useState("");
  const [selectedSimulatorEmplyrId, setSelectedSimulatorEmplyrId] = useState("");
  const [selectedSimulatorAuthorCode, setSelectedSimulatorAuthorCode] = useState("");
  const sidebarBodyRef = useRef<HTMLDivElement | null>(null);
  const sidebarScrollRestoringRef = useRef(false);
  const filteredSelectedDomain = useMemo(
    () => filterMenuGroups(selectedDomain?.groups, deferredMenuFilter, en),
    [selectedDomain?.groups, deferredMenuFilter, en]
  );
  const showDevSimulator = Boolean(devSession?.simulationAvailable || bootstrappedSession?.simulationAvailable);
  const selectedSimulatorAccount = useMemo(
    () => simulatorPayload?.adminAccountOptions.find((option) => option.emplyrId === selectedSimulatorEmplyrId) || null,
    [selectedSimulatorEmplyrId, simulatorPayload?.adminAccountOptions]
  );

  function syncSimulatorSelection(payload: AdminSessionSimulationPayload, options?: { keepAccount?: boolean; keepRole?: boolean }) {
    const keepAccount = Boolean(options?.keepAccount);
    const keepRole = Boolean(options?.keepRole);
    const insttId = payload.selectedInsttId || payload.companyOptions[0]?.insttId || "";
    const accountIds = new Set((payload.adminAccountOptions || []).map((option) => option.emplyrId || ""));
    const roleCodes = new Set((payload.authorOptions || []).map((option) => option.authorCode || ""));
    const nextEmplyrId = keepAccount && accountIds.has(selectedSimulatorEmplyrId)
      ? selectedSimulatorEmplyrId
      : (payload.selectedEmplyrId || payload.adminAccountOptions[0]?.emplyrId || "");
    const defaultRoleCode = payload.adminAccountOptions.find((option) => option.emplyrId === nextEmplyrId)?.authorCode || "";
    const nextAuthorCode = keepRole && roleCodes.has(selectedSimulatorAuthorCode)
      ? selectedSimulatorAuthorCode
      : (payload.selectedAuthorCode || defaultRoleCode || "");
    setSelectedSimulatorInsttId(insttId);
    setSelectedSimulatorEmplyrId(nextEmplyrId);
    setSelectedSimulatorAuthorCode(nextAuthorCode);
  }

  async function loadSimulator(nextInsttId?: string, options?: { keepAccount?: boolean; keepRole?: boolean }) {
    setSimulatorLoading(true);
    setSimulatorMessage("");
    try {
      const payload = await fetchAdminSessionSimulator(nextInsttId);
      setSimulatorPayload(payload);
      syncSimulatorSelection(payload, options);
    } catch (error) {
      setSimulatorMessage(error instanceof Error ? error.message : (en ? "Failed to load simulator." : "시뮬레이터를 불러오지 못했습니다."));
    } finally {
      setSimulatorLoading(false);
    }
  }

  useEffect(() => {
    const eventName = getAdminMenuTreeRefreshEventName();
    const handleMenuTreeRefresh = () => {
      void menuState.reload();
    };
    window.addEventListener(eventName, handleMenuTreeRefresh);
    return () => {
      window.removeEventListener(eventName, handleMenuTreeRefresh);
    };
  }, [menuState]);

  useEffect(() => {
    if (activeDomainKey) {
      setSelectedDomainKey(activeDomainKey);
    }
  }, [activeDomainKey]);

  useEffect(() => {
    if (!selectedDomain) {
      return;
    }
    setOpenGroups((current) => {
      const nextState: Record<string, boolean> = { ...current };
      (selectedDomain.groups || []).forEach((group: AdminMenuGroup, index: number) => {
        const groupKey = getMenuGroupKey(selectedDomainKey, group, index);
        const hasActiveLink = activeMenuEntry?.domainKey === selectedDomainKey && activeMenuEntry.groupKey === groupKey;
        if (typeof current[groupKey] === "boolean") {
          nextState[groupKey] = current[groupKey];
          return;
        }
        nextState[groupKey] = hasActiveLink || index === 0;
      });

      // Keep the active menu group expanded without collapsing groups the user opened manually.
      if (activeMenuEntry?.domainKey === selectedDomainKey && nextState[activeMenuEntry.groupKey] === false) {
        nextState[activeMenuEntry.groupKey] = true;
      }

      return nextState;
    });
  }, [activeMenuEntry, selectedDomain, selectedDomainKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.sessionStorage.setItem(ADMIN_SIDEBAR_OPEN_GROUPS_STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  useEffect(() => {
    let expired = false;

    const syncTimer = () => {
      const nextExpireAt = ensureAdminSessionExpireAt();
      const remaining = Math.max(0, nextExpireAt - Date.now());
      setSessionRemainingMs(remaining);
      if (remaining <= 0 && !expired) {
        expired = true;
        window.alert(en ? "Your session has expired. You will be logged out." : "세션이 만료되어 로그아웃됩니다.");
        void handleAdminLogout();
      }
    };

    const handleActivity = () => {
      const savedExpireAt = readStoredAdminSessionExpireAt();
      const remaining = savedExpireAt - Date.now();
      if (remaining > ADMIN_SESSION_WARNING_MS) {
        return;
      }
      const nextExpireAt = Date.now() + ADMIN_SESSION_DURATION_MS;
      window.sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, String(nextExpireAt));
      setSessionRemainingMs(Math.max(0, nextExpireAt - Date.now()));
    };

    syncTimer();
    const intervalId = window.setInterval(syncTimer, 1000);
    window.addEventListener("storage", syncTimer);
    document.addEventListener("click", handleActivity, { passive: true });
    document.addEventListener("keydown", handleActivity);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", syncTimer);
      document.removeEventListener("click", handleActivity);
      document.removeEventListener("keydown", handleActivity);
    };
  }, [en]);

  useEffect(() => {
    let cancelled = false;

    if (bootstrappedSession) {
      if (bootstrappedSession.simulationAvailable) {
        void loadSimulator();
      }
      return () => {
        cancelled = true;
      };
    }

    fetchFrontendSession()
      .then((session) => {
        if (cancelled) {
          return;
        }
        setDevSession(session);
        if (session.simulationAvailable) {
          void loadSimulator();
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [bootstrappedSession]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(ADMIN_SIMULATOR_EXPANDED_STORAGE_KEY, simulatorExpanded ? "Y" : "N");
  }, [simulatorExpanded]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const container = sidebarBodyRef.current;
    if (!container) {
      return;
    }
    const stored = window.sessionStorage.getItem(ADMIN_SIDEBAR_SCROLL_STORAGE_KEY) || "";
    const scrollTop = Number.parseInt(stored, 10);
    if (!Number.isFinite(scrollTop) || scrollTop <= 0) {
      return;
    }
    sidebarScrollRestoringRef.current = true;
    container.scrollTop = scrollTop;
    const rafId = window.requestAnimationFrame(() => {
      if (sidebarBodyRef.current) {
        sidebarBodyRef.current.scrollTop = scrollTop;
      }
    });
    const timeoutIds = [
      window.setTimeout(() => {
        if (sidebarBodyRef.current) {
          sidebarBodyRef.current.scrollTop = scrollTop;
        }
      }, 0),
      window.setTimeout(() => {
        if (sidebarBodyRef.current) {
          sidebarBodyRef.current.scrollTop = scrollTop;
        }
      }, 50),
      window.setTimeout(() => {
        if (sidebarBodyRef.current) {
          sidebarBodyRef.current.scrollTop = scrollTop;
        }
        sidebarScrollRestoringRef.current = false;
      }, 150)
    ];
    return () => {
      sidebarScrollRestoringRef.current = false;
      window.cancelAnimationFrame(rafId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [selectedDomainKey, activeMenuEntry?.groupKey, filteredSelectedDomain.groups.length]);

  const gnbItems: GnbItem[] = useMemo(() => {
    const domainEntries = Object.entries(menuTree);
    if (!domainEntries.length) {
      return [];
    }
    return domainEntries.map(([domainKey, domain]: [string, AdminMenuDomain]) => ({
      key: domainKey,
      label: resolveSidebarDomainLabel(domainKey, domain, en),
      href: resolveFirstDomainPath(domain),
      domain: domainKey
    }));
  }, [en, menuTree]);

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  }

  async function handleSessionExtend() {
    const confirmed = window.confirm(en ? "Extend the current session?" : "현재 세션을 연장하시겠습니까?");
    if (!confirmed) {
      return;
    }

    setSessionRefreshPending(true);
    try {
      const payload = await fetchJson<{ status?: string; accessExpiresIn?: number }>(
        buildLocalizedPath("/admin/login/refreshSession", "/en/admin/login/refreshSession"),
        {
          method: "GET",
          credentials: "same-origin",
          headers: { "X-Requested-With": "XMLHttpRequest" }
        }
      );
      if (payload?.status !== "success") {
        throw new Error("REFRESH_FAILED");
      }
      const nextExpireAt = Date.now() + (typeof payload.accessExpiresIn === "number" ? payload.accessExpiresIn : ADMIN_SESSION_DURATION_MS);
      window.sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, String(nextExpireAt));
      setSessionRemainingMs(Math.max(0, nextExpireAt - Date.now()));
      window.alert(en ? "The session has been extended." : "세션이 연장되었습니다.");
    } catch {
      window.alert(en
        ? "Failed to extend the session. You will be redirected to login."
        : "세션 연장에 실패했습니다. 로그인 화면으로 이동합니다.");
      await handleAdminLogout();
    } finally {
      setSessionRefreshPending(false);
    }
  }

  async function handleApplySimulator() {
    if (!selectedSimulatorEmplyrId || !selectedSimulatorAuthorCode) {
      setSimulatorMessage(en ? "Select an account and role first." : "관리자 계정과 권한 롤을 먼저 선택하세요.");
      return;
    }
    setSimulatorSubmitting(true);
    setSimulatorMessage("");
    try {
      const session = devSession || await fetchFrontendSession();
      setDevSession(session);
      await applyAdminSessionSimulator(session, {
        insttId: selectedSimulatorInsttId,
        emplyrId: selectedSimulatorEmplyrId,
        authorCode: selectedSimulatorAuthorCode
      });
      invalidateFrontendSessionCache();
      window.location.reload();
    } catch (error) {
      setSimulatorMessage(error instanceof Error ? error.message : (en ? "Failed to apply simulator." : "시뮬레이터 적용에 실패했습니다."));
    } finally {
      setSimulatorSubmitting(false);
    }
  }

  async function handleResetSimulator() {
    setSimulatorSubmitting(true);
    setSimulatorMessage("");
    try {
      const session = devSession || await fetchFrontendSession();
      setDevSession(session);
      await resetAdminSessionSimulator(session);
      invalidateFrontendSessionCache();
      window.location.reload();
    } catch (error) {
      setSimulatorMessage(error instanceof Error ? error.message : (en ? "Failed to reset simulator." : "시뮬레이터 초기화에 실패했습니다."));
    } finally {
      setSimulatorSubmitting(false);
    }
  }

  const sessionTimerClassName = [
    "hidden lg:flex items-center gap-2 px-3 py-2 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white text-[12px] font-bold text-[var(--kr-gov-text-secondary)]",
    sessionRemainingMs <= ADMIN_SESSION_DANGER_MS
      ? "session-danger"
      : (sessionRemainingMs <= ADMIN_SESSION_WARNING_MS ? "session-warning" : "")
  ].filter(Boolean).join(" ");
  const resolvedLoadingLabel = loadingLabel || (en ? "Loading page data." : "화면을 불러오는 중입니다.");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let cancelled = false;
    const rafId = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!cancelled) {
          setShowDeferredChrome(true);
        }
      }, 0);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  if (embeddedInLegacyAdminShell) {
    return (
      <>
        {children}
        {loading ? (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/25 px-4 backdrop-blur-[2px]">
            <div className="min-w-[18rem] rounded-[calc(var(--kr-gov-radius)+6px)] border border-slate-200 bg-white/95 px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
              <div className="flex items-center gap-4">
                <div className="relative h-10 w-10 shrink-0">
                  <span className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
                  <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[var(--kr-gov-blue)] border-r-[var(--kr-gov-blue)]" />
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Preparing screen" : "화면 준비 중"}</p>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{resolvedLoadingLabel}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#f8f9fa] text-[var(--kr-gov-text-primary)]">
      <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>

      <div className="z-50 shrink-0 border-b border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-gray)]">
        <div className="mx-auto flex max-w-full items-center justify-between px-6 py-1.5">
          <div className="flex items-center gap-2">
            <img alt={en ? "Government Symbol of the Republic of Korea" : "대한민국정부 상징"} className="h-3.5" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
            <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">
              {en ? "Official Government Service of the Republic of Korea" : "대한민국정부 공식 누리집"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium text-[var(--kr-gov-text-secondary)]">
            <span><span id="admin-login-label">{en ? "Admin Login:" : "관리자 로그인:"}</span> <span>관리자</span></span>
            <button className="hover:underline" onClick={() => void handleAdminLogout()} type="button">{en ? "Logout" : "로그아웃"}</button>
          </div>
        </div>
      </div>

      <header className="z-40 shrink-0 border-b border-[var(--kr-gov-border-light)] bg-white">
        <div className="mx-auto max-w-full px-6">
          <div className="flex h-20 items-center justify-between">
            <a
              className="flex items-center gap-2"
              href={buildLocalizedPath("/admin/", "/en/admin/")}
              onClick={(e) => {
                e.preventDefault();
                navigate(buildLocalizedPath("/admin/", "/en/admin/"));
              }}
            >
              <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]">eco</span>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold tracking-tight text-[var(--kr-gov-text-primary)]">
                  {en ? "CCUS Integrated Management System" : "CCUS 통합관리 시스템"}
                </h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--kr-gov-blue)]">Admin Dashboard</p>
              </div>
            </a>

            <nav aria-label={en ? "Admin Main Menu" : "관리자 주 메뉴"} className="hidden h-full items-stretch space-x-1 xl:flex" id="adminGnbMenu">
              {gnbItems.map((item) => {
                const active = item.domain === (selectedDomainKey || activeDomainKey);
                return (
                  <a
                    data-domain={item.domain}
                    href={item.href}
                    key={item.label}
                    onClick={(event) => {
                      event.preventDefault();
                      setSelectedDomainKey(item.domain);
                    }}
                    className={`js-gnb-menu inline-flex h-full items-center border-b-[3px] px-5 text-[16px] font-bold transition-colors ${
                      active
                        ? "border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)]"
                        : "border-transparent text-[var(--kr-gov-text-secondary)] hover:border-[var(--kr-gov-border-light)] hover:text-[var(--kr-gov-blue)]"
                    }`}
                  >
                    <span className="inline-flex items-center leading-none">{item.label}</span>
                  </a>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <div className={sessionTimerClassName} id="admin-session-timer">
                <span className="material-symbols-outlined text-[18px]">timer</span>
                <span id="admin-session-label">{en ? "Session" : "세션"}</span>
                <span className="min-w-[44px] text-[var(--kr-gov-blue)]" id="admin-session-remaining">{formatAdminSessionRemaining(sessionRemainingMs)}</span>
                <button
                  className="rounded border border-[var(--kr-gov-border-light)] px-2 py-1 text-[11px] font-bold hover:bg-gray-100 disabled:opacity-60"
                  disabled={sessionRefreshPending}
                  id="admin-session-refresh"
                  onClick={() => void handleSessionExtend()}
                  type="button"
                >
                  {sessionRefreshPending ? "..." : (en ? "Extend" : "연장")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {showDeferredChrome && showDevSimulator ? (
        simulatorExpanded ? (
          <div className="z-30 shrink-0 border-b border-amber-200 bg-[linear-gradient(90deg,#fff7e6,#fffdf5)]">
            <div className="mx-auto max-w-full px-6 py-3">
              <div className="space-y-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black tracking-wide text-amber-700">
                        {en ? "DEV SESSION SIMULATOR" : "개발 세션 시뮬레이터"}
                      </span>
                      {simulatorPayload?.active ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-700">
                          {en ? "SIMULATION ACTIVE" : "시뮬레이션 적용 중"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">
                      {en
                        ? `Actual ${devSession?.actualUserId || bootstrappedSession?.actualUserId || "-"} -> Effective ${simulatorPayload?.effectiveUserId || devSession?.userId || "-"}`
                        : `실제 ${devSession?.actualUserId || bootstrappedSession?.actualUserId || "-"} -> 적용 ${simulatorPayload?.effectiveUserId || devSession?.userId || "-"}`}
                    </p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? "Use local webmaster only. Company, admin account, and role are overridden in session until reset."
                        : "local webmaster 전용입니다. 회사, 관리자 계정, 권한 롤을 세션에서만 덮어쓰고 원복 전까지 유지합니다."}
                    </p>
                    {simulatorMessage ? <p className="mt-2 text-xs font-bold text-red-600">{simulatorMessage}</p> : null}
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      aria-expanded={simulatorExpanded}
                      className="inline-flex min-h-[44px] min-w-[132px] items-center justify-center gap-1.5 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--kr-gov-text-primary)] transition-colors hover:bg-gray-50"
                      onClick={() => setSimulatorExpanded(false)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">expand_less</span>
                      {en ? "Hide Simulator" : "시뮬레이터 숨기기"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 xl:min-w-[840px]">
                  <div className="grid gap-2 lg:grid-cols-[minmax(180px,1fr)_minmax(260px,1.3fr)_minmax(260px,1.3fr)_auto_auto]">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Company" : "회사"}</span>
                      <select
                        className="h-11 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 text-sm"
                        onChange={(event) => {
                          const nextInsttId = event.target.value;
                          setSelectedSimulatorInsttId(nextInsttId);
                          setSelectedSimulatorEmplyrId("");
                          void loadSimulator(nextInsttId, { keepRole: true });
                        }}
                        value={selectedSimulatorInsttId}
                      >
                        {(simulatorPayload?.companyOptions || []).map((option) => (
                          <option key={option.insttId || ""} value={option.insttId || ""}>
                            {option.cmpnyNm || option.insttId}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Admin Account" : "관리자 계정"}</span>
                      <select
                        className="h-11 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 text-sm"
                        onChange={(event) => {
                          const nextEmplyrId = event.target.value;
                          setSelectedSimulatorEmplyrId(nextEmplyrId);
                          const matched = simulatorPayload?.adminAccountOptions.find((option) => option.emplyrId === nextEmplyrId);
                          if (matched?.authorCode) {
                            setSelectedSimulatorAuthorCode(matched.authorCode);
                          }
                        }}
                        value={selectedSimulatorEmplyrId}
                      >
                        {(simulatorPayload?.adminAccountOptions || []).map((option) => (
                          <option key={option.emplyrId || ""} value={option.emplyrId || ""}>
                            {`${option.userNm || option.emplyrId} (${option.emplyrId || "-"})`}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Role" : "권한 롤"}</span>
                      <select
                        className="h-11 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 text-sm"
                        onChange={(event) => setSelectedSimulatorAuthorCode(event.target.value)}
                        value={selectedSimulatorAuthorCode}
                      >
                        {(simulatorPayload?.authorOptions || []).map((option) => (
                          <option key={option.authorCode || ""} value={option.authorCode || ""}>
                            {`${option.authorNm || option.authorCode} (${option.authorCode || "-"})`}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--kr-gov-blue-hover)] disabled:opacity-60"
                      disabled={simulatorLoading || simulatorSubmitting || !selectedSimulatorEmplyrId || !selectedSimulatorAuthorCode}
                      onClick={() => void handleApplySimulator()}
                      type="button"
                    >
                      {simulatorSubmitting ? "..." : (en ? "Apply" : "적용")}
                    </button>

                    <button
                      className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-2 text-sm font-bold text-[var(--kr-gov-text-primary)] hover:bg-gray-50 disabled:opacity-60"
                      disabled={simulatorSubmitting || !simulatorPayload?.active}
                      onClick={() => void handleResetSimulator()}
                      type="button"
                    >
                      {en ? "Reset" : "원복"}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[12px] text-[var(--kr-gov-text-secondary)]">
                    <span>{simulatorLoading ? (en ? "Loading options..." : "옵션 불러오는 중...") : (en ? `Accounts ${simulatorPayload?.adminAccountOptions.length || 0}` : `계정 ${simulatorPayload?.adminAccountOptions.length || 0}건`)}</span>
                    {selectedSimulatorAccount ? (
                      <span>
                        {en ? "Selected account role:" : "선택 계정 현재 롤:"} <strong className="text-[var(--kr-gov-text-primary)]">{selectedSimulatorAccount.authorNm || selectedSimulatorAccount.authorCode || "-"}</strong>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="pointer-events-none absolute right-6 top-[116px] z-30">
            <div className="flex justify-end">
              <button
                aria-expanded={simulatorExpanded}
                className="pointer-events-auto inline-flex min-h-[44px] min-w-[132px] items-center justify-center gap-1.5 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-2 text-[13px] font-bold text-amber-800 shadow-sm transition-colors hover:bg-amber-100"
                onClick={() => setSimulatorExpanded(true)}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
                {en ? "Show Simulator" : "시뮬레이터 펼치기"}
              </button>
            </div>
          </div>
        )
      ) : null}

      <div className="js-admin-layout-shell flex min-h-0 flex-1">
        <aside aria-label={en ? "Admin Side Menu" : "관리자 사이드 메뉴"} className="js-admin-lnb flex w-72 flex-col bg-white p-5">
          <div className="mb-6">
            <div className="relative">
              <input
                className="w-full rounded-[var(--kr-gov-radius)] border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[var(--kr-gov-blue)] focus:ring-2 focus:ring-[var(--kr-gov-blue)]"
                id="gnbMenuFilter"
                onChange={(event) => setMenuFilter(event.target.value)}
                placeholder={en ? "Search menu (e.g. log, approval)" : "메뉴 검색 (예: 로그, 승인)"}
                type="text"
                value={menuFilter}
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-gray-400">search</span>
            </div>
          </div>

          <div
            className="js-admin-lnb-body space-y-5"
            id="gnbTreeWrap"
            onScroll={(event) => {
              if (sidebarScrollRestoringRef.current) {
                return;
              }
              window.sessionStorage.setItem(
                ADMIN_SIDEBAR_SCROLL_STORAGE_KEY,
                String(event.currentTarget.scrollTop)
              );
            }}
            ref={sidebarBodyRef}
          >
            {!showDeferredChrome ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4" key={`sidebar-skeleton-${index}`}>
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                    <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
                    <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : filteredSelectedDomain.groups.map((group: AdminMenuGroup, index) => {
              const groupLinks = visibleLinks(group.links);
              const groupKey = getMenuGroupKey(selectedDomainKey, group, index);
              const groupDomId = `sidebar-group-${groupKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
              const activeLinkIndex = activeMenuEntry?.domainKey === selectedDomainKey && activeMenuEntry.groupKey === groupKey
                ? activeMenuEntry.linkIndex
                : -1;
              const groupHasActive = activeLinkIndex >= 0;
              const expanded = deferredMenuFilter.trim() ? true : (openGroups[groupKey] ?? groupHasActive ?? index === 0);
              return (
                <div className="gnb-tree-group" key={groupKey}>
                  <button
                    aria-controls={`${groupDomId}-links`}
                    aria-expanded={expanded ? "true" : "false"}
                    className={`gnb-tree-title ${groupHasActive || index === 0 ? "active" : "inactive"}`}
                    onClick={() => toggleGroup(groupKey)}
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px]">{group.icon || "folder_open"}</span>
                      {resolveSidebarGroupTitle(group, en)}
                    </span>
                    <span className={`material-symbols-outlined text-[18px] transition-transform ${expanded ? "" : "-rotate-90"}`}>expand_more</span>
                  </button>
                  <div className={`gnb-tree-links space-y-1 ${expanded ? "" : "hidden"}`} id={`${groupDomId}-links`}>
                    {groupLinks.map((link, linkIndex) => {
                      const active = linkIndex === activeLinkIndex;
                      const runtimeUrl = resolveMenuLinkRuntimeUrl(link);
                      return (
                        <a
                          className={`admin-sidebar-link ${active ? "active" : ""}`}
                          href={runtimeUrl || "#"}
                          key={`${groupKey}-${link.code || runtimeUrl}-${linkIndex}`}
                          onClick={(e) => {
                            e.preventDefault();
                            if (runtimeUrl) {
                              (e.currentTarget as HTMLAnchorElement).blur();
                              if (sidebarBodyRef.current) {
                                window.sessionStorage.setItem(
                                  ADMIN_SIDEBAR_SCROLL_STORAGE_KEY,
                                  String(sidebarBodyRef.current.scrollTop)
                                );
                              }
                              navigate(runtimeUrl);
                            }
                          }}
                        >
                          <span className="material-symbols-outlined text-[20px]">{link.icon || (active ? "check_circle" : "chevron_right")}</span>
                          {resolveSidebarLinkLabel(link, en)}
                        </a>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {showDeferredChrome && menuFilter.trim() && filteredSelectedDomain.groups.length === 0 ? (
              <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "No menu matched the entered text." : "입력한 텍스트와 일치하는 메뉴가 없습니다."}
              </div>
            ) : null}
          </div>

          <div className="mt-auto border-t border-[var(--kr-gov-border-light)] pt-4">
            <div className="rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 p-4 text-[13px]">
              <p className="mb-1 font-bold text-[var(--kr-gov-blue)]">
                {selectedDomain ? `${resolveSidebarDomainLabel(selectedDomainKey, selectedDomain, en)} ${en ? "Domain Active" : "도메인 활성화"}` : (en ? "Menu Loading" : "메뉴 로딩 중")}
              </p>
              <p className="text-[var(--kr-gov-text-secondary)]">
                {!showDeferredChrome
                  ? (en ? "Preparing sidebar menus" : "사이드 메뉴 준비 중")
                  : selectedDomain
                  ? (en
                    ? `Currently displaying ${filteredSelectedDomain.visibleLinkCount} menus${menuFilter.trim() ? " matching the search" : ""}`
                    : `현재 ${menuFilter.trim() ? "검색 결과 " : "전체 메뉴 "}${filteredSelectedDomain.visibleLinkCount}개 노출 중`)
                  : (menuState.loading ? (en ? "Loading menus from server" : "서버 메뉴를 불러오는 중입니다") : (en ? "Fallback menu applied" : "기본 메뉴가 적용되었습니다"))}
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-8" id="main-content">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm text-[var(--kr-gov-text-secondary)]">
              <span className="material-symbols-outlined text-[18px]">home</span>
              {breadcrumbs.map((item, index) => (
                <div className="flex items-center gap-2" key={`${item.label}-${index}`}>
                  {index > 0 ? <span className="material-symbols-outlined text-[16px]">chevron_right</span> : null}
                  {item.href ? <a className="hover:underline" href={item.href}>{item.label}</a> : <span className="font-bold text-[var(--kr-gov-blue)]">{item.label}</span>}
                </div>
              ))}
            </nav>
          ) : null}

          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-[var(--kr-gov-text-primary)]">{title}</h2>
              {subtitle ? <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex gap-2">{actions}</div> : null}
          </div>

          {contextStrip}
          {children}
        </main>
      </div>

      <footer className="relative z-40 border-t border-[var(--kr-gov-border-light)] bg-white">
        <div className="mx-auto flex max-w-full flex-col items-center justify-between gap-6 px-6 py-6 md:flex-row">
          <div className="flex items-center gap-4">
            <img alt={en ? "Government Symbol of the Republic of Korea" : "대한민국정부 상징"} className="h-8 grayscale opacity-70" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_FOOTER_SYMBOL} />
            <div className="border-l border-gray-200 pl-4 text-[12px] leading-tight text-[var(--kr-gov-text-secondary)]">
              <p className="mb-0.5 text-[13px] font-bold">{en ? "Net Zero CCUS Integrated Management HQ (Admin Console)" : "탄소중립 CCUS 통합관리본부 (Admin Console)"}</p>
              <p>© 2025 CCUS Integration Management Portal. All rights reserved.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">
            <a className="hover:underline" href="#">{en ? "Terms of Service" : "서비스 이용약관"}</a>
            <span className="text-gray-300">|</span>
            <a className="hover:underline" href="#">{en ? "Privacy Policy" : "개인정보처리방침"}</a>
            <span className="text-gray-300">|</span>
            <div className="rounded-[5px] border border-gray-200 bg-[var(--kr-gov-bg-gray)] px-3 py-1 text-[11px] font-bold">
              <span>{en ? "Last Updated: 2025.08.14 14:45" : "최종 업데이트: 2025.08.14 14:45"}</span>
            </div>
          </div>
        </div>
      </footer>

      {loading ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/25 px-4 backdrop-blur-[2px]">
          <div className="min-w-[18rem] rounded-[calc(var(--kr-gov-radius)+6px)] border border-slate-200 bg-white/95 px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-center gap-4">
              <div className="relative h-10 w-10 shrink-0">
                <span className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
                <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[var(--kr-gov-blue)] border-r-[var(--kr-gov-blue)]" />
              </div>
              <div>
                <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Preparing screen" : "화면 준비 중"}</p>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{resolvedLoadingLabel}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
