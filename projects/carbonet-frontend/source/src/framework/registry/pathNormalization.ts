import type { RouteUnitDefinition } from "./routeFamilyTypes";

export function normalizeRegistryPath(value: string): string {
  if (!value) {
    return "/";
  }
  return value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
}

export function normalizeLocalizedRoutePaths<TRouteDefinition extends RouteUnitDefinition>(
  definition: TRouteDefinition
) {
  return {
    koPath: normalizeRegistryPath(definition.koPath),
    enPath: normalizeRegistryPath(definition.enPath)
  };
}
