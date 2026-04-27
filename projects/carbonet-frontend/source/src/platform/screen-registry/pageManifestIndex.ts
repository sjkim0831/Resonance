import type { PageManifest } from "./types";
import { PAGE_MANIFESTS } from "./pageManifests";

function normalizeRouteToken(value: string) {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

export function normalizeManifestLookupPath(value: string) {
  if (!value) {
    return "";
  }
  return value.trim().toLowerCase().replace(/^\/en/, "");
}

const manifestList = Object.values(PAGE_MANIFESTS);

const pageIdIndex = new Map<string, PageManifest>();
const menuCodeIndex = new Map<string, PageManifest>();
const routePathIndex = new Map<string, PageManifest>();

manifestList.forEach((manifest) => {
  pageIdIndex.set(normalizeRouteToken(manifest.pageId), manifest);
  if (manifest.menuCode) {
    menuCodeIndex.set(String(manifest.menuCode).toUpperCase(), manifest);
  }
  if (manifest.routePath) {
    routePathIndex.set(normalizeManifestLookupPath(String(manifest.routePath)), manifest);
  }
});

export function listPageManifestOptions() {
  return manifestList.slice().sort((left, right) => left.pageId.localeCompare(right.pageId));
}

export function findManifestByPageId(pageId: string) {
  return pageIdIndex.get(normalizeRouteToken(pageId)) || null;
}

export function findManifestByMenuCodeOrRoutePath(menuCode: string, routePath: string) {
  const normalizedMenuCode = String(menuCode || "").trim().toUpperCase();
  if (normalizedMenuCode) {
    const matchedByCode = menuCodeIndex.get(normalizedMenuCode);
    if (matchedByCode) {
      return matchedByCode;
    }
  }
  const normalizedRoutePath = normalizeManifestLookupPath(routePath);
  if (!normalizedRoutePath) {
    return null;
  }
  return routePathIndex.get(normalizedRoutePath) || null;
}
