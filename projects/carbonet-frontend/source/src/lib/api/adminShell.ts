import { buildLocalizedPath } from "../navigation/runtime";
import { buildAdminApiPath, buildResilientCsrfHeaders, fetchJson, fetchJsonWithResponse, postJson } from "./core";
import {
  readSessionStorageCache,
  removeSessionStorageCache,
  SESSION_STORAGE_CACHE_PREFIX,
  writeSessionStorageCache
} from "./pageCache";
import type {
  AdminMenuTreePayload,
  AdminSessionSimulationPayload,
  FrontendSession
} from "./adminShellTypes";
import { normalizeAdminEmissionMenuTree } from "./menuNormalization";

const FRONTEND_SESSION_STORAGE_KEY = `${SESSION_STORAGE_CACHE_PREFIX}frontend-session`;
const ADMIN_MENU_TREE_STORAGE_KEY = `${SESSION_STORAGE_CACHE_PREFIX}admin-menu-tree-db-v5`;
const LEGACY_ADMIN_MENU_TREE_STORAGE_KEYS = [
  `${SESSION_STORAGE_CACHE_PREFIX}admin-menu-tree-db-v4`,
  `${SESSION_STORAGE_CACHE_PREFIX}admin-menu-tree-db-v3`,
  `${SESSION_STORAGE_CACHE_PREFIX}admin-menu-tree-db-v2`,
  `${SESSION_STORAGE_CACHE_PREFIX}admin-menu-tree`,
  "carbonet:admin-menu-tree"
];

function removeLegacyAdminMenuTreeCaches() {
  LEGACY_ADMIN_MENU_TREE_STORAGE_KEYS.forEach((key) => removeSessionStorageCache(key));
}

const ADMIN_MENU_TREE_REFRESH_EVENT = "carbonet:admin-menu-tree:refresh";
const ADMIN_MENU_TREE_REFRESH_STORAGE_KEY = "carbonet:admin-menu-tree:refresh-at";
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

let frontendSessionCache: FrontendSession | null = null;
let frontendSessionPromise: Promise<FrontendSession> | null = null;
let adminMenuTreeCache: AdminMenuTreePayload | null = null;
let adminMenuTreePromise: Promise<AdminMenuTreePayload> | null = null;

function buildAdminShellHeaders() {
  return {
    "X-Requested-With": "XMLHttpRequest"
  };
}

function buildAdminSessionSimulatorUrl(insttId?: string) {
  const url = new URL(buildAdminApiPath("/api/admin/dev/session-simulator"), window.location.origin);
  if (insttId) {
    url.searchParams.set("insttId", insttId);
  }
  return url.toString();
}

function readBootstrap<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  const store = window.__CARBONET_REACT_BOOTSTRAP__ as Record<string, unknown> | undefined;
  const payload = store?.[key] as T | undefined;
  return payload ?? null;
}

export function getAdminMenuTreeRefreshEventName() {
  ensureAdminMenuTreeCrossTabRefresh();
  return ADMIN_MENU_TREE_REFRESH_EVENT;
}

let adminMenuTreeCrossTabRefreshReady = false;

function ensureAdminMenuTreeCrossTabRefresh() {
  if (adminMenuTreeCrossTabRefreshReady || typeof window === "undefined") {
    return;
  }
  adminMenuTreeCrossTabRefreshReady = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== ADMIN_MENU_TREE_REFRESH_STORAGE_KEY) {
      return;
    }
    invalidateFrontendSessionCache();
    window.dispatchEvent(new Event(ADMIN_MENU_TREE_REFRESH_EVENT));
  });
}

export function invalidateFrontendSessionCache() {
  removeLegacyAdminMenuTreeCaches();
  frontendSessionCache = null;
  frontendSessionPromise = null;
  adminMenuTreeCache = null;
  adminMenuTreePromise = null;
  removeSessionStorageCache(FRONTEND_SESSION_STORAGE_KEY);
  removeSessionStorageCache(ADMIN_MENU_TREE_STORAGE_KEY);
}

export function readAdminMenuTreeSnapshot(): AdminMenuTreePayload | null {
  removeLegacyAdminMenuTreeCaches();
  const bootstrappedMenuTree = readBootstrap<AdminMenuTreePayload>("adminMenuTree");
  if (bootstrappedMenuTree) {
    const menuTree = normalizeAdminEmissionMenuTree(bootstrappedMenuTree);
    adminMenuTreeCache = menuTree;
    return menuTree;
  }
  return adminMenuTreeCache;
}

export function readFrontendSessionSnapshot(): FrontendSession | null {
  const bootstrappedSession = readBootstrap<FrontendSession>("frontendSession");
  if (bootstrappedSession) {
    frontendSessionCache = bootstrappedSession;
    writeSessionStorageCache(FRONTEND_SESSION_STORAGE_KEY, bootstrappedSession, SESSION_CACHE_TTL_MS);
    return bootstrappedSession;
  }
  const storedSession = readSessionStorageCache<FrontendSession>(FRONTEND_SESSION_STORAGE_KEY);
  if (storedSession) {
    frontendSessionCache = storedSession;
    return storedSession;
  }
  return frontendSessionCache;
}

export function refreshAdminMenuTree() {
  ensureAdminMenuTreeCrossTabRefresh();
  invalidateFrontendSessionCache();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ADMIN_MENU_TREE_REFRESH_STORAGE_KEY, String(Date.now()));
    window.dispatchEvent(new Event(ADMIN_MENU_TREE_REFRESH_EVENT));
  }
}

export async function fetchFrontendSession(): Promise<FrontendSession> {
  const bootstrappedSession = readBootstrap<FrontendSession>("frontendSession");
  if (bootstrappedSession) {
    frontendSessionCache = bootstrappedSession;
    writeSessionStorageCache(FRONTEND_SESSION_STORAGE_KEY, bootstrappedSession, SESSION_CACHE_TTL_MS);
    return bootstrappedSession;
  }
  const storedSession = readSessionStorageCache<FrontendSession>(FRONTEND_SESSION_STORAGE_KEY);
  if (storedSession) {
    frontendSessionCache = storedSession;
  }
  if (frontendSessionCache) {
    return frontendSessionCache;
  }
  if (!frontendSessionPromise) {
    frontendSessionPromise = fetchJsonWithResponse<FrontendSession>("/api/frontend/session").then(({ response, body: session }) => {
      if (!response.ok) {
        throw new Error(`Failed to load session: ${response.status}`);
      }
      frontendSessionCache = session;
      writeSessionStorageCache(FRONTEND_SESSION_STORAGE_KEY, session, SESSION_CACHE_TTL_MS);
      return session;
    }).finally(() => {
      frontendSessionPromise = null;
    });
  }
  if (!frontendSessionPromise) {
    throw new Error("Frontend session promise was not initialized");
  }
  return frontendSessionPromise;
}

export async function fetchAdminSessionSimulator(insttId?: string): Promise<AdminSessionSimulationPayload> {
  return fetchJson<AdminSessionSimulationPayload>(buildAdminSessionSimulatorUrl(insttId), {
    headers: buildAdminShellHeaders()
  });
}

export async function applyAdminSessionSimulator(
  _session: FrontendSession,
  payload: { insttId: string; emplyrId: string; authorCode: string; }
): Promise<AdminSessionSimulationPayload> {
  const response = await postJson<AdminSessionSimulationPayload>(
    buildAdminApiPath("/api/admin/dev/session-simulator"),
    payload,
    {
      headers: buildAdminShellHeaders()
    }
  );
  invalidateFrontendSessionCache();
  return response;
}

export async function resetAdminSessionSimulator(session: FrontendSession): Promise<AdminSessionSimulationPayload> {
  void session;
  const response = await fetchJson<AdminSessionSimulationPayload>(buildAdminApiPath("/api/admin/dev/session-simulator"), {
    method: "DELETE",
    headers: await buildResilientCsrfHeaders(buildAdminShellHeaders())
  });
  invalidateFrontendSessionCache();
  return response;
}

export async function fetchAdminMenuTree(): Promise<AdminMenuTreePayload> {
  removeLegacyAdminMenuTreeCaches();
  readAdminMenuTreeSnapshot();
  if (!adminMenuTreePromise) {
    adminMenuTreePromise = fetchJson<AdminMenuTreePayload>(buildLocalizedPath("/admin/system/menu-data", "/en/admin/system/menu-data"), {
      cache: "no-store",
      headers: buildAdminShellHeaders()
    }).then((payload) => {
        const menuTree = normalizeAdminEmissionMenuTree(payload);
        adminMenuTreeCache = menuTree;
        return menuTree;
      })
      .catch((error) => {
        throw error;
      })
      .finally(() => {
        adminMenuTreePromise = null;
      });
  }
  if (!adminMenuTreePromise) {
    throw new Error("Admin menu tree promise was not initialized");
  }
  return adminMenuTreePromise;
}
