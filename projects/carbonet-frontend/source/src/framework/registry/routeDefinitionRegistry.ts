import type { RouteUnitDefinition } from "./routeFamilyTypes";
import { normalizeLocalizedRoutePaths, normalizeRegistryPath } from "./pathNormalization";
import { getNormalizedRegistryValue, setUniqueRegistryValue } from "./registryMapGuards";

export function createRouteDefinitionRegistry<TRouteDefinition extends RouteUnitDefinition>(
  definitions: ReadonlyArray<TRouteDefinition>
) {
  const routeById = new Map<string, TRouteDefinition>();
  const routeByLookupPath = new Map<string, TRouteDefinition>();

  definitions.forEach((entry) => {
    const { koPath: normalizedKoPath, enPath: normalizedEnPath } = normalizeLocalizedRoutePaths(entry);

    setUniqueRegistryValue(routeById, entry.id, entry, `Duplicate route id detected: ${entry.id}`);
    setUniqueRegistryValue(routeByLookupPath, normalizedKoPath, entry, `Duplicate route path detected: ${normalizedKoPath}`);
    setUniqueRegistryValue(routeByLookupPath, normalizedEnPath, entry, `Duplicate route path detected: ${normalizedEnPath}`);
  });

  return {
    getById(value: string | null | undefined) {
      return value ? routeById.get(value) || null : null;
    },
    getByPath(path: string) {
      return getNormalizedRegistryValue(routeByLookupPath, path, normalizeRegistryPath);
    }
  };
}
