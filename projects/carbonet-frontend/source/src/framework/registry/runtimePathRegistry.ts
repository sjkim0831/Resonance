import type { RouteUnitDefinition } from "./routeFamilyTypes";
import { normalizeLocalizedRoutePaths, normalizeRegistryPath } from "./pathNormalization";
import {
  getNormalizedRegistryValue,
  setCompatibleRegistryValue,
  setUniqueRegistryValue
} from "./registryMapGuards";

export function createRuntimePathRegistry<TRouteDefinition extends RouteUnitDefinition>(
  definitions: ReadonlyArray<TRouteDefinition>,
  aliases: ReadonlyArray<readonly [string, TRouteDefinition["id"]]>
) {
  const routeByComparablePath = new Map<string, TRouteDefinition["id"]>();

  definitions.forEach((entry) => {
    const { koPath: normalizedKoPath, enPath: normalizedEnPath } = normalizeLocalizedRoutePaths(entry);

    setUniqueRegistryValue(routeByComparablePath, normalizedKoPath, entry.id, `Duplicate runtime path detected: ${normalizedKoPath}`);
    setUniqueRegistryValue(routeByComparablePath, normalizedEnPath, entry.id, `Duplicate runtime path detected: ${normalizedEnPath}`);
  });

  aliases.forEach(([path, pageId]) => {
    const normalizedPath = normalizeRegistryPath(path);
    setCompatibleRegistryValue(routeByComparablePath, normalizedPath, pageId, `Conflicting runtime alias detected: ${normalizedPath}`);
  });

  return {
    getByPath(path: string) {
      return getNormalizedRegistryValue(routeByComparablePath, path, normalizeRegistryPath);
    }
  };
}
