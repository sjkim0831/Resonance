export function normalizeRoutePath(value) {
  const path = String(value || "").trim();
  if (!path || path === "/") return path || "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function comparableRouteKey(value) {
  return normalizeRoutePath(value).toLowerCase();
}

export function registerCanonicalRoute(index, value, source = "route registry") {
  const route = normalizeRoutePath(value);
  if (!route.startsWith("/")) return;
  const key = comparableRouteKey(route);
  const current = index.get(key);
  if (current && current.route !== route) {
    throw new Error(
      `Case-insensitive route collision in ${source}: ${current.route} <> ${route}`,
    );
  }
  if (!current) index.set(key, { route, source });
}

export function findCanonicalRoute(index, value) {
  return index.get(comparableRouteKey(value))?.route || "";
}
