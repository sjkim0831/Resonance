import { apiFetch, readJsonResponse } from "./core";

export const SESSION_STORAGE_CACHE_PREFIX = "carbonet:api-cache:v3:";
export const DEFAULT_PAGE_CACHE_TTL_MS = 60 * 1000;

function buildJsonRequestHeaders(headers?: HeadersInit): Headers {
  const next = new Headers(headers || {});
  if (!next.has("Accept")) {
    next.set("Accept", "application/json");
  }
  if (!next.has("X-Requested-With")) {
    next.set("X-Requested-With", "XMLHttpRequest");
  }
  return next;
}

type SessionStorageCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export function readSessionStorageCache<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SessionStorageCacheEntry<T>;
    if (!parsed || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export function writeSessionStorageCache<T>(key: string, value: T, ttlMs: number) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload: SessionStorageCacheEntry<T> = {
      expiresAt: Date.now() + ttlMs,
      value
    };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or serialization errors and keep the runtime path working.
  }
}

export function removeSessionStorageCache(key: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore sessionStorage failures.
  }
}

export function buildPageCacheKey(path: string) {
  return `${SESSION_STORAGE_CACHE_PREFIX}${path}`;
}

export async function fetchCachedJson<T>(options: {
  cacheKey: string;
  url: string;
  ttlMs?: number;
  mapError?: (body: any, status: number) => string;
}): Promise<T> {
  const cached = readSessionStorageCache<T>(options.cacheKey);
  if (cached) {
    return cached;
  }

  const response = await apiFetch(options.url, {
    credentials: "include",
    headers: buildJsonRequestHeaders()
  });
  const body = await readJsonResponse<T>(response).catch((error) => {
    if (error instanceof Error && error.message.includes("Authentication required")) {
      throw error;
    }
    if (error instanceof Error && error.message.includes("Server returned HTML instead of JSON")) {
      throw error;
    }
    return {} as T;
  });
  if (!response.ok) {
    throw new Error(options.mapError?.(body, response.status) || `Failed to load page: ${response.status}`);
  }
  writeSessionStorageCache(options.cacheKey, body as T, options.ttlMs ?? DEFAULT_PAGE_CACHE_TTL_MS);
  return body as T;
}

export async function fetchJsonWithoutCache<T>(options: {
  url: string;
  mapError?: (body: any, status: number) => string;
}): Promise<T> {
  const response = await apiFetch(options.url, {
    credentials: "include",
    headers: buildJsonRequestHeaders()
  });
  const body = await readJsonResponse<T>(response).catch((error) => {
    if (error instanceof Error && error.message.includes("Authentication required")) {
      throw error;
    }
    if (error instanceof Error && error.message.includes("Server returned HTML instead of JSON")) {
      throw error;
    }
    return {} as T;
  });
  if (!response.ok) {
    throw new Error(options.mapError?.(body, response.status) || `Failed to load page: ${response.status}`);
  }
  return body as T;
}
