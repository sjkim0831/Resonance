import type { FrameworkBuilderContract } from "./contracts";
import { getFrameworkContractMetadata } from "./contractMetadata";
import { buildSystemComponentCatalog } from "../features/screen-builder/catalog/buttonCatalogCore";
import type { SystemComponentCatalogItem } from "../features/screen-builder/catalog/buttonCatalogCore";
import { listGovernedPageManifests } from "../platform/screen-registry/pageGovernance";
import type { GovernedPageManifest } from "../platform/screen-registry/pageGovernance";
import type {
  FrameworkBuilderComponentContract,
  FrameworkBuilderPageContract
} from "./contracts/builderContract";

const BUILDER_READY_COMPONENT_TYPES = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "table",
  "pagination"
]);

function inferOwnerDomain(item: SystemComponentCatalogItem): string {
  const firstRoute = item.routes[0];
  if (!firstRoute) {
    return "admin";
  }
  if (firstRoute.koPath.startsWith("/admin/")) {
    return "admin";
  }
  if (firstRoute.koPath.startsWith("/join/")) {
    return "join";
  }
  return "home";
}

function buildComponentLabel(item: SystemComponentCatalogItem): string {
  return item.labels[0] || item.summary || item.componentName || item.styleGroupId;
}

function buildFrameworkComponentCatalog(): FrameworkBuilderComponentContract[] {
  return buildSystemComponentCatalog()
    .map((item) => ({
      componentId: item.styleGroupId,
      label: buildComponentLabel(item),
      componentType: item.componentType,
      ownerDomain: inferOwnerDomain(item),
      status: "ACTIVE",
      sourceType: "catalog-json",
      replacementComponentId: "",
      designReference: item.className,
      propsSchemaJson: JSON.stringify({
        variant: item.variant,
        size: item.size,
        icon: item.icon,
        placeholder: item.placeholder,
        labels: item.labels
      }),
      usageCount: item.instanceCount,
      routeCount: item.routeCount,
      instanceCount: item.instanceCount,
      labels: item.labels,
      builderReady: BUILDER_READY_COMPONENT_TYPES.has(item.componentType)
    }))
    .sort((left, right) => left.componentId.localeCompare(right.componentId));
}

function buildPageLabel(page: GovernedPageManifest): string {
  if (page.menuCode) {
    return page.menuCode;
  }
  return page.pageId;
}

function buildFrameworkPageRegistry(): FrameworkBuilderPageContract[] {
  return listGovernedPageManifests()
    .map((page) => ({
      pageId: page.pageId,
      label: buildPageLabel(page),
      routePath: page.routePath,
      canonicalRoute: page.canonicalRoute,
      menuCode: page.menuCode ?? "",
      domainCode: page.domainCode,
      routeId: page.routeId,
      pageFamily: page.pageFamily,
      ownershipLane: page.ownershipLane,
      installScope: page.installScope,
      layoutVersion: page.layoutVersion,
      designTokenVersion: page.designTokenVersion,
      manifestId: page.pageContract.manifest,
      systemization: page.systemization,
      authorityScope: page.authorityScope,
      bootstrapQueryMutationContract: {
        bootstrapPayloadTarget: page.installDeploy.bootstrapPayloadTarget,
        compareTarget: page.installDeploy.compareTarget,
        auditTrace: page.installDeploy.auditTrace
      },
      projectBinding: {
        ...page.projectBinding,
        bindingInputs: page.installDeploy.bindingInputs
      },
      projectExecutor: page.projectExecutor,
      installDeploy: {
        packagingOwnerPath: page.installDeploy.packagingOwnerPath,
        assemblyOwnerPath: page.installDeploy.assemblyOwnerPath,
        validator: page.installDeploy.validator,
        validatorChecks: page.installDeploy.validatorChecks,
        rollbackEvidence: page.installDeploy.rollbackEvidence,
        runtimeVerificationTarget: page.pageContract.runtimeVerificationTarget,
        compareTarget: page.installDeploy.compareTarget,
        deploySequence: page.installDeploy.deploySequence,
        freshnessVerificationSequence: page.installDeploy.freshnessVerificationSequence
      },
      closeout: page.closeout,
      componentCount: page.components.length,
      components: page.components.map((component, index) => ({
        componentId: component.componentId,
        instanceKey: component.instanceKey,
        layoutZone: component.layoutZone,
        displayOrder: index + 1,
        propsSummary: component.propsSummary ?? [],
        conditionalRuleSummary: component.conditionalRuleSummary ?? ""
      }))
    }))
    .sort((left, right) => left.pageId.localeCompare(right.pageId));
}

export function buildFrameworkBuilderContract(): FrameworkBuilderContract {
  const metadata = getFrameworkContractMetadata();

  return {
    frameworkId: metadata.frameworkId,
    frameworkName: metadata.frameworkName,
    contractVersion: metadata.contractVersion,
    source: "frontend-static-registry",
    generatedAt: new Date().toISOString(),
    pages: buildFrameworkPageRegistry(),
    components: buildFrameworkComponentCatalog(),
    builderProfiles: metadata.builderProfiles
  };
}
