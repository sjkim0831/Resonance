import { buildRoutePageContracts, type RouteDefinitionsOf } from "../../../framework/registry/routeFamilyTypes";
import { normalizeRegistryPath } from "../../../framework/registry/pathNormalization";
import { PAGE_MANIFESTS } from "../../../platform/screen-registry/pageManifests";

type ManifestBackedRoutePageContractOptions<TDefinitions extends readonly { id: string; koPath: string }[]> = {
  familyId: string;
  manifestRoot: string;
  validator: string;
  rollbackEvidence: string;
  menuCodePrefix?: string;
  runtimeVerificationTargetByRoute?: Partial<Record<TDefinitions[number]["id"], string>>;
};

const PAGE_MANIFEST_BY_PATH = new Map(
  Object.values(PAGE_MANIFESTS).map((manifest) => [normalizeRegistryPath(manifest.routePath), manifest] as const)
);

export function buildManifestBackedRoutePageContracts<const TDefinitions extends RouteDefinitionsOf>(
  routeDefinitions: TDefinitions,
  options: ManifestBackedRoutePageContractOptions<TDefinitions>
) {
  const menuCodeByRoute = {} as Partial<Record<TDefinitions[number]["id"], string>>;
  const manifestByRoute = {} as Partial<Record<TDefinitions[number]["id"], string>>;
  const runtimeVerificationTargetByRoute = {
    ...(options.runtimeVerificationTargetByRoute || {})
  } as Partial<Record<TDefinitions[number]["id"], string>>;

  routeDefinitions.forEach((definition) => {
    const routeId = definition.id as TDefinitions[number]["id"];
    const manifest = PAGE_MANIFEST_BY_PATH.get(normalizeRegistryPath(definition.koPath));
    if (!manifest) {
      return;
    }
    if (manifest.menuCode) {
      menuCodeByRoute[routeId] = manifest.menuCode;
    }
    manifestByRoute[routeId] = `${options.manifestRoot}.${manifest.pageId}`;
    runtimeVerificationTargetByRoute[routeId] = manifest.routePath;
  });

  return buildRoutePageContracts(routeDefinitions, {
    familyId: options.familyId,
    manifestRoot: options.manifestRoot,
    validator: options.validator,
    rollbackEvidence: options.rollbackEvidence,
    menuCodePrefix: options.menuCodePrefix,
    menuCodeByRoute,
    manifestByRoute,
    runtimeVerificationTargetByRoute
  });
}
