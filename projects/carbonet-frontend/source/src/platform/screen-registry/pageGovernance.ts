import { normalizeRegistryPath } from "../../framework/registry/pathNormalization";
import { findRouteDefinitionByPath } from "../../app/routes/definitions";
import { findRouteFamilyCloseoutByPath, findRouteOwnershipTraceByPath } from "../../app/routes/routeCatalog";
import { PAGE_MANIFESTS } from "./pageManifests";
import type { PageManifest } from "./types";

type GovernedRouteCloseout = NonNullable<ReturnType<typeof findRouteFamilyCloseoutByPath>>;
type GovernedRouteOwnershipTrace = NonNullable<ReturnType<typeof findRouteOwnershipTraceByPath>>;

export type GovernedPageManifest = PageManifest & {
  canonicalRoute: string;
  routeId: string;
  routeLabel: string;
  familyId: string;
  pageFamily: string;
  ownershipLane: string;
  installScope: string;
  systemization: GovernedRouteCloseout["systemization"];
  authorityScope: GovernedRouteCloseout["authorityScope"];
  commonDefinition: GovernedRouteCloseout["commonDefinition"];
  projectBinding: GovernedRouteCloseout["projectBinding"];
  projectExecutor: GovernedRouteCloseout["projectExecutor"];
  installDeploy: GovernedRouteCloseout["installDeploy"];
  pageContract: GovernedRouteCloseout["pageContracts"][number];
  ownershipTrace: GovernedRouteOwnershipTrace;
  closeout: {
    pageSystemization: string;
    authorityScopeApplication: string;
    builderInstallDeploy: string;
    projectBindingPatterns: string;
  };
};

export function resolveGovernedPageManifest(page: PageManifest): GovernedPageManifest {
  const routeDefinition = findRouteDefinitionByPath(page.routePath);
  if (!routeDefinition) {
    throw new Error(`Missing route definition for page manifest: ${page.pageId} (${page.routePath})`);
  }
  const closeout = findRouteFamilyCloseoutByPath(page.routePath);
  if (!closeout) {
    throw new Error(`Missing route family closeout for page manifest: ${page.pageId} (${page.routePath})`);
  }
  const ownershipTrace = findRouteOwnershipTraceByPath(page.routePath);
  if (!ownershipTrace) {
    throw new Error(`Missing route ownership trace for page manifest: ${page.pageId} (${page.routePath})`);
  }
  const normalizedRoutePath = normalizeRegistryPath(page.routePath);
  const pageContract = closeout.pageContracts.find(
    (contract) =>
      contract.pageId === page.pageId || normalizeRegistryPath(contract.canonicalRoute) === normalizedRoutePath
  );
  if (!pageContract) {
    throw new Error(`Missing page contract for page manifest: ${page.pageId} (${page.routePath})`);
  }
  if (page.menuCode && page.menuCode !== pageContract.menuCode) {
    throw new Error(`Manifest menuCode mismatch for page manifest: ${page.pageId} (${page.routePath})`);
  }
  if (normalizeRegistryPath(pageContract.canonicalRoute) !== normalizedRoutePath) {
    throw new Error(`Canonical route mismatch for page manifest: ${page.pageId} (${page.routePath})`);
  }

  return {
    ...page,
    canonicalRoute: routeDefinition.koPath,
    routeId: routeDefinition.id,
    routeLabel: routeDefinition.label,
    familyId: closeout.familyId,
    pageFamily: closeout.pageFamily,
    ownershipLane: closeout.ownershipLane,
    installScope: closeout.installScope,
    systemization: closeout.systemization,
    authorityScope: closeout.authorityScope,
    commonDefinition: closeout.commonDefinition,
    projectBinding: closeout.projectBinding,
    projectExecutor: closeout.projectExecutor,
    installDeploy: closeout.installDeploy,
    pageContract,
    ownershipTrace,
    closeout: {
      pageSystemization: closeout.pageSystemizationCloseout,
      authorityScopeApplication: closeout.authorityScopeApplicationCloseout,
      builderInstallDeploy: closeout.builderInstallDeployCloseout,
      projectBindingPatterns: closeout.projectBindingPatternsCloseout
    }
  };
}

export function getGovernedPageManifest(pageId: string): GovernedPageManifest | null {
  const manifest = PAGE_MANIFESTS[pageId];
  return manifest ? resolveGovernedPageManifest(manifest) : null;
}

export function listGovernedPageManifests(): GovernedPageManifest[] {
  return Object.values(PAGE_MANIFESTS).map(resolveGovernedPageManifest);
}
