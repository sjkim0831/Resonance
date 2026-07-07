import { normalizeRegistryPath } from "../../framework/registry/pathNormalization";
import { EXTERNAL_ROUTE_FAMILIES } from "../../platform/routes/platformRouteRegistry";
import {
  ALL_ROUTE_CLOSEOUT_BINDINGS,
  ALL_ROUTE_FAMILY_CLOSEOUTS,
  ALL_ROUTE_DEFINITIONS,
  ALL_ROUTE_PAGE_UNITS
} from "./families/allRouteFamilies";

export { ALL_ROUTE_DEFINITIONS, ALL_ROUTE_PAGE_UNITS, ALL_ROUTE_FAMILY_CLOSEOUTS, ALL_ROUTE_CLOSEOUT_BINDINGS };

export type MigrationPageId = (typeof ALL_ROUTE_DEFINITIONS)[number]["id"];
export type RouteFamilyCloseout = (typeof ALL_ROUTE_FAMILY_CLOSEOUTS)[number];
export type RouteAuthorityScope = RouteFamilyCloseout["authorityScope"];
export type RoutePageContract = RouteFamilyCloseout["pageContracts"][number];
export type RouteCommonDefinition = RouteFamilyCloseout["commonDefinition"];
export type RouteProjectBinding = RouteFamilyCloseout["projectBinding"];
export type RouteProjectExecutor = RouteFamilyCloseout["projectExecutor"];
export type RouteProjectBindingPatternsCloseout = RouteFamilyCloseout["projectBindingPatternsCloseout"];
export type RouteInstallDeployCloseout = RouteFamilyCloseout["installDeploy"];
export type RouteSystemization = RouteFamilyCloseout["systemization"];
export type RouteOwnershipTrace = {
  routeId: MigrationPageId;
  routeScope: "RUNTIME" | "PLATFORM";
  routeLabel: string;
  canonicalRoute: string;
  localizedRoutes: {
    koPath: string;
    enPath: string;
  };
  familyId: RouteFamilyCloseout["familyId"];
  pageFamily: RouteFamilyCloseout["pageFamily"];
  ownershipLane: RouteFamilyCloseout["ownershipLane"];
  installScope: RouteFamilyCloseout["installScope"];
  pageId: RoutePageContract["pageId"];
  menuCode: RoutePageContract["menuCode"];
  manifest: RoutePageContract["manifest"];
  runtimeVerificationTarget: RoutePageContract["runtimeVerificationTarget"];
  assemblyOwnerPath: RouteInstallDeployCloseout["assemblyOwnerPath"];
  packagingOwnerPath: RouteInstallDeployCloseout["packagingOwnerPath"];
};

export const DEFAULT_PAGE_ROUTE: MigrationPageId = "home";
export const DEFAULT_ADMIN_ROUTE: MigrationPageId = "admin-home";

const ROUTE_CLOSEOUT_MAP = new Map<MigrationPageId, RouteFamilyCloseout>(
  ALL_ROUTE_CLOSEOUT_BINDINGS.map(({ routeId, closeout }) => [routeId, closeout])
);
const ROUTE_CLOSEOUT_PATH_MAP = new Map<string, RouteFamilyCloseout>();
const ROUTE_OWNERSHIP_TRACE_MAP = new Map<MigrationPageId, RouteOwnershipTrace>();
const ROUTE_OWNERSHIP_TRACE_PATH_MAP = new Map<string, RouteOwnershipTrace>();

const PLATFORM_FAMILY_IDS = new Set<string>(
  EXTERNAL_ROUTE_FAMILIES.map((family) => family.closeout.familyId)
);

function reportRouteCatalogIssue(message: string) {
  if (typeof console !== "undefined") {
    console.error(`[route-catalog] ${message}`);
  }
}

ALL_ROUTE_DEFINITIONS.forEach((definition) => {
  const closeout = ROUTE_CLOSEOUT_MAP.get(definition.id);
  if (!closeout) {
    reportRouteCatalogIssue(`Missing route family closeout binding for route: ${definition.id}`);
    return;
  }
  ROUTE_CLOSEOUT_PATH_MAP.set(normalizeRegistryPath(definition.koPath), closeout);
  ROUTE_CLOSEOUT_PATH_MAP.set(normalizeRegistryPath(definition.enPath), closeout);

  const pageContract = closeout.pageContracts.find((entry) => entry.routeId === definition.id);
  if (!pageContract) {
    reportRouteCatalogIssue(`Missing route page contract binding for route: ${definition.id}`);
    return;
  }

  const ownershipTrace: RouteOwnershipTrace = {
    routeId: definition.id,
    routeScope: PLATFORM_FAMILY_IDS.has(closeout.familyId) ? "PLATFORM" : "RUNTIME",
    routeLabel: definition.label,
    canonicalRoute: definition.koPath,
    localizedRoutes: {
      koPath: definition.koPath,
      enPath: definition.enPath
    },
    familyId: closeout.familyId,
    pageFamily: closeout.pageFamily,
    ownershipLane: closeout.ownershipLane,
    installScope: closeout.installScope,
    pageId: pageContract.pageId,
    menuCode: pageContract.menuCode,
    manifest: pageContract.manifest,
    runtimeVerificationTarget: pageContract.runtimeVerificationTarget,
    assemblyOwnerPath: closeout.installDeploy.assemblyOwnerPath,
    packagingOwnerPath: closeout.installDeploy.packagingOwnerPath
  };

  ROUTE_OWNERSHIP_TRACE_MAP.set(definition.id, ownershipTrace);
  ROUTE_OWNERSHIP_TRACE_PATH_MAP.set(normalizeRegistryPath(definition.koPath), ownershipTrace);
  ROUTE_OWNERSHIP_TRACE_PATH_MAP.set(normalizeRegistryPath(definition.enPath), ownershipTrace);
});

export function getRouteFamilyCloseout(routeId: MigrationPageId): RouteFamilyCloseout {
  const closeout = ROUTE_CLOSEOUT_MAP.get(routeId);
  if (!closeout) {
    reportRouteCatalogIssue(`Missing route family closeout for route: ${routeId}`);
    return ALL_ROUTE_FAMILY_CLOSEOUTS[0];
  }
  return closeout;
}

export function findRouteFamilyCloseoutByPath(path: string): RouteFamilyCloseout | null {
  return ROUTE_CLOSEOUT_PATH_MAP.get(normalizeRegistryPath(path)) ?? null;
}

export function getRouteAuthorityScope(routeId: MigrationPageId): RouteAuthorityScope {
  return getRouteFamilyCloseout(routeId).authorityScope;
}

export function getRoutePageContract(routeId: MigrationPageId): RoutePageContract {
  const pageContract = getRouteFamilyCloseout(routeId).pageContracts.find((entry) => entry.routeId === routeId);
  if (!pageContract) {
    reportRouteCatalogIssue(`Missing route page contract for route: ${routeId}`);
    return getRouteFamilyCloseout(DEFAULT_PAGE_ROUTE).pageContracts[0];
  }
  return pageContract;
}

export function getRouteProjectBinding(routeId: MigrationPageId): RouteProjectBinding {
  return getRouteFamilyCloseout(routeId).projectBinding;
}

export function getRouteCommonDefinition(routeId: MigrationPageId): RouteCommonDefinition {
  return getRouteFamilyCloseout(routeId).commonDefinition;
}

export function getRouteProjectExecutor(routeId: MigrationPageId): RouteProjectExecutor {
  return getRouteFamilyCloseout(routeId).projectExecutor;
}

export function getRouteProjectBindingPatternsCloseout(routeId: MigrationPageId): RouteProjectBindingPatternsCloseout {
  return getRouteFamilyCloseout(routeId).projectBindingPatternsCloseout;
}

export function getRouteInstallDeployCloseout(routeId: MigrationPageId): RouteInstallDeployCloseout {
  return getRouteFamilyCloseout(routeId).installDeploy;
}

export function getRouteSystemization(routeId: MigrationPageId): RouteSystemization {
  return getRouteFamilyCloseout(routeId).systemization;
}

export function findRouteAuthorityScopeByPath(path: string): RouteAuthorityScope | null {
  return findRouteFamilyCloseoutByPath(path)?.authorityScope ?? null;
}

export function findRoutePageContractByPath(path: string): RoutePageContract | null {
  const closeout = findRouteFamilyCloseoutByPath(path);
  if (!closeout) {
    return null;
  }
  const normalizedPath = normalizeRegistryPath(path);
  return closeout.pageContracts.find((entry) => normalizeRegistryPath(entry.canonicalRoute) === normalizedPath) ?? null;
}

export function findRouteProjectBindingByPath(path: string): RouteProjectBinding | null {
  return findRouteFamilyCloseoutByPath(path)?.projectBinding ?? null;
}

export function findRouteCommonDefinitionByPath(path: string): RouteCommonDefinition | null {
  return findRouteFamilyCloseoutByPath(path)?.commonDefinition ?? null;
}

export function findRouteProjectExecutorByPath(path: string): RouteProjectExecutor | null {
  return findRouteFamilyCloseoutByPath(path)?.projectExecutor ?? null;
}

export function findRouteProjectBindingPatternsCloseoutByPath(path: string): RouteProjectBindingPatternsCloseout | null {
  return findRouteFamilyCloseoutByPath(path)?.projectBindingPatternsCloseout ?? null;
}

export function findRouteInstallDeployCloseoutByPath(path: string): RouteInstallDeployCloseout | null {
  return findRouteFamilyCloseoutByPath(path)?.installDeploy ?? null;
}

export function findRouteSystemizationByPath(path: string): RouteSystemization | null {
  return findRouteFamilyCloseoutByPath(path)?.systemization ?? null;
}

export function getRouteOwnershipTrace(routeId: MigrationPageId): RouteOwnershipTrace {
  const ownershipTrace = ROUTE_OWNERSHIP_TRACE_MAP.get(routeId);
  if (!ownershipTrace) {
    reportRouteCatalogIssue(`Missing route ownership trace for route: ${routeId}`);
    return ROUTE_OWNERSHIP_TRACE_MAP.get(DEFAULT_PAGE_ROUTE) as RouteOwnershipTrace;
  }
  return ownershipTrace;
}

export function findRouteOwnershipTraceByPath(path: string): RouteOwnershipTrace | null {
  return ROUTE_OWNERSHIP_TRACE_PATH_MAP.get(normalizeRegistryPath(path)) ?? null;
}

export function listRouteOwnershipTraces(): RouteOwnershipTrace[] {
  return ALL_ROUTE_DEFINITIONS.map((definition) => getRouteOwnershipTrace(definition.id));
}
