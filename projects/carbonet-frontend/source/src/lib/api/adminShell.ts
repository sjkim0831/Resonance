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

const FRONTEND_SESSION_STORAGE_KEY = `${SESSION_STORAGE_CACHE_PREFIX}frontend-session`;
const ADMIN_MENU_TREE_STORAGE_KEY = `${SESSION_STORAGE_CACHE_PREFIX}admin-menu-tree`;
const ADMIN_MENU_TREE_REFRESH_EVENT = "carbonet:admin-menu-tree:refresh";
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
  return ADMIN_MENU_TREE_REFRESH_EVENT;
}

export function invalidateFrontendSessionCache() {
  frontendSessionCache = null;
  frontendSessionPromise = null;
  adminMenuTreeCache = null;
  adminMenuTreePromise = null;
  removeSessionStorageCache(FRONTEND_SESSION_STORAGE_KEY);
  removeSessionStorageCache(ADMIN_MENU_TREE_STORAGE_KEY);
}

export function readAdminMenuTreeSnapshot(): AdminMenuTreePayload | null {
  const bootstrappedMenuTree = readBootstrap<AdminMenuTreePayload>("adminMenuTree");
  if (bootstrappedMenuTree) {
    adminMenuTreeCache = bootstrappedMenuTree;
    writeSessionStorageCache(ADMIN_MENU_TREE_STORAGE_KEY, bootstrappedMenuTree, SESSION_CACHE_TTL_MS);
    return bootstrappedMenuTree;
  }
  const storedMenuTree = readSessionStorageCache<AdminMenuTreePayload>(ADMIN_MENU_TREE_STORAGE_KEY);
  if (storedMenuTree) {
    adminMenuTreeCache = storedMenuTree;
    return storedMenuTree;
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
  invalidateFrontendSessionCache();
  if (typeof window !== "undefined") {
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
  const cachedMenuTree = readAdminMenuTreeSnapshot();
  if (!adminMenuTreePromise) {
    adminMenuTreePromise = fetchJson<AdminMenuTreePayload>(buildLocalizedPath("/admin/system/menu-data", "/en/admin/system/menu-data"), {
      cache: "no-store",
      headers: buildAdminShellHeaders()
    }).then((payload) => {
        adminMenuTreeCache = payload;
        writeSessionStorageCache(ADMIN_MENU_TREE_STORAGE_KEY, payload, SESSION_CACHE_TTL_MS);
        return payload;
      })
      .catch((error) => {
        if (cachedMenuTree) {
          adminMenuTreeCache = cachedMenuTree;
          return cachedMenuTree;
        }
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
