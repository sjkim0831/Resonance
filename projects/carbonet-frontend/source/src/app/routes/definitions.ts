import { createRouteDefinitionRegistry } from "../../framework/registry/routeDefinitionRegistry";
import { ALL_ROUTE_DEFINITIONS } from "./routeCatalog";
import type { MigrationPageId } from "./routeCatalog";

const ROUTE_ID_ALIASES = [
  ["codex-provision", "codex-request"]
] as const satisfies ReadonlyArray<readonly [string, MigrationPageId]>;

const routeRegistry = createRouteDefinitionRegistry(ALL_ROUTE_DEFINITIONS);
const ROUTE_ID_ALIAS_MAP = new Map<string, MigrationPageId>(ROUTE_ID_ALIASES);
const ROUTE_IDS = ALL_ROUTE_DEFINITIONS.map((entry) => entry.id);

export function normalizeRouteId(value: string | null | undefined): MigrationPageId | "" {
  if (!value) {
    return "";
  }
  const normalized = value.trim().replace(/_/g, "-");
  const aliasedRouteId = ROUTE_ID_ALIAS_MAP.get(normalized);
  if (aliasedRouteId) {
    return aliasedRouteId;
  }
  for (const routeId of ROUTE_IDS) {
    if (routeId === normalized) {
      return routeId;
    }
  }
  return "";
}

export function getRouteDefinition(value: string | null | undefined) {
  return routeRegistry.getById(value);
}

export function findRouteDefinitionByPath(path: string) {
  return routeRegistry.getByPath(path);
}
