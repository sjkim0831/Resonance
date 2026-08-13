export type GeneratedScreenSupportCatalogEntry = {
  pageId: string;
  routePath: string;
  designHash: string;
  support: {
    help?: { pageId?: string; title?: string; summary?: string; items?: readonly Record<string, unknown>[] };
    [key: string]: unknown;
  };
};

export const GENERATED_SCREEN_SUPPORT_CATALOG: readonly GeneratedScreenSupportCatalogEntry[] = [];
const supportKey = (value: string) => String(value || "").replace(/^\/en(?=\/)/, "").replace(/\?.*$/, "").toLowerCase().replace(/[^a-z0-9가-힣/]+/g, "-");

export function findGeneratedScreenSupport(pageIdOrPath: string) {
  const key = supportKey(pageIdOrPath);
  return GENERATED_SCREEN_SUPPORT_CATALOG.find(entry => supportKey(entry.pageId) === key || supportKey(entry.routePath) === key);
}
