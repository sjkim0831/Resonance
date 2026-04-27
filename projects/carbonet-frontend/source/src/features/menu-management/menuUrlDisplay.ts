import { getRouteDefinition, normalizeRouteId } from "../../app/routes/definitions";

function isExternalUrl(value: string) {
  return /^https?:\/\//i.test(value) || value === "#";
}

function findRoutePath(routeToken: string) {
  const routeId = normalizeRouteId(routeToken);
  if (!routeId) {
    return "";
  }
  return getRouteDefinition(routeId)?.koPath || "";
}

function localizePath(path: string, english: boolean) {
  if (!english || !path.startsWith("/")) {
    return path;
  }
  return path.startsWith("/en/") ? path : `/en${path}`;
}

export function toDisplayMenuUrl(rawUrl: string) {
  const value = rawUrl.trim();
  if (!value || isExternalUrl(value)) {
    return value;
  }

  let parsed: URL;
  try {
    parsed = new URL(value, "http://carbonet.local");
  } catch {
    return value;
  }

  const english = parsed.pathname.startsWith("/en/");
  const pathname = english ? parsed.pathname.slice(3) || "/" : parsed.pathname;
  if (
    pathname !== "/admin/app"
    && pathname !== "/app"
  ) {
    return `${parsed.pathname}${parsed.search}`;
  }

  const routeToken = parsed.searchParams.get("route") || "";
  const routePath = findRoutePath(routeToken);
  if (!routePath) {
    return `${parsed.pathname}${parsed.search}`;
  }

  parsed.searchParams.delete("route");
  const query = parsed.searchParams.toString();
  return `${localizePath(routePath, english)}${query ? `?${query}` : ""}`;
}
