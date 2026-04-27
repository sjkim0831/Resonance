import type { RouteFamilyCloseout, RouteFamilyOf, RouteUnitDefinition } from "./routeFamilyTypes";

function reportRouteFamilyValidation(message: string) {
  if (typeof console !== "undefined") {
    console.error(`[route-family-validation] ${message}`);
  }
}

function validateRouteFamilies<TFamilies extends readonly RouteFamilyOf<readonly RouteUnitDefinition[]>[]>(families: TFamilies) {
  families.forEach((family) => {
    const routeIds = new Set(family.routeDefinitions.map((entry) => entry.id));
    const pageUnitIds = new Set(family.pageUnits.map((entry) => entry.id));

    routeIds.forEach((routeId) => {
      if (!pageUnitIds.has(routeId)) {
        reportRouteFamilyValidation(`Missing page unit for route id: ${routeId}`);
      }
    });

    pageUnitIds.forEach((pageUnitId) => {
      if (!routeIds.has(pageUnitId)) {
        reportRouteFamilyValidation(`Unknown page unit route id: ${pageUnitId}`);
      }
    });

    validateRouteFamilyCloseout(family.closeout);
  });
}

function validateRouteFamilyCloseout(closeout: RouteFamilyCloseout) {
  if (!closeout.familyId.trim()) {
    reportRouteFamilyValidation("Missing route family closeout familyId");
  }
  if (!closeout.pageFamily.trim()) {
    reportRouteFamilyValidation(`Missing pageFamily for route family: ${closeout.familyId}`);
  }
  if (!closeout.authorityScope.actionScopes.length) {
    reportRouteFamilyValidation(`Missing authority action scopes for route family: ${closeout.familyId}`);
  }
  if (!closeout.authorityScope.menuPolicy.trim() || !closeout.authorityScope.queryPolicy.trim() || !closeout.authorityScope.actionPolicy.trim()) {
    reportRouteFamilyValidation(`Missing authority application policy for route family: ${closeout.familyId}`);
  }
  if (!closeout.authorityScope.approvalPolicy.trim() || !closeout.authorityScope.auditPolicy.trim() || !closeout.authorityScope.tracePolicy.trim()) {
    reportRouteFamilyValidation(`Missing approval/audit/trace policy for route family: ${closeout.familyId}`);
  }
  if (!closeout.installDeploy.runtimeVerificationTarget.trim()) {
    reportRouteFamilyValidation(`Missing runtime verification target for route family: ${closeout.familyId}`);
  }
  if (!closeout.installDeploy.bootstrapPayloadTarget.trim()) {
    reportRouteFamilyValidation(`Missing bootstrap payload target for route family: ${closeout.familyId}`);
  }
  if (!closeout.installDeploy.bindingInputs.length) {
    reportRouteFamilyValidation(`Missing project binding inputs for route family: ${closeout.familyId}`);
  }
  if (!closeout.installDeploy.validatorChecks.length) {
    reportRouteFamilyValidation(`Missing validator checks for route family: ${closeout.familyId}`);
  }
  if (!closeout.installDeploy.validator.trim()) {
    reportRouteFamilyValidation(`Missing validator contract for route family: ${closeout.familyId}`);
  }
  if (!closeout.installDeploy.freshnessVerificationSequence.trim()) {
    reportRouteFamilyValidation(`Missing freshness verification sequence for route family: ${closeout.familyId}`);
  }
  if (!closeout.commonDefinition.owner.trim()) {
    reportRouteFamilyValidation(`Missing common definition owner for route family: ${closeout.familyId}`);
  }
  if (!closeout.commonDefinition.artifacts.length) {
    reportRouteFamilyValidation(`Missing common definition artifacts for route family: ${closeout.familyId}`);
  }
  if (!closeout.projectBinding.owner.trim()) {
    reportRouteFamilyValidation(`Missing project binding owner for route family: ${closeout.familyId}`);
  }
  if (!closeout.projectExecutor.owner.trim()) {
    reportRouteFamilyValidation(`Missing project executor owner for route family: ${closeout.familyId}`);
  }
  if (!closeout.projectExecutor.responsibilities.length) {
    reportRouteFamilyValidation(`Missing project executor responsibilities for route family: ${closeout.familyId}`);
  }
  if (!closeout.pageContracts.length) {
    reportRouteFamilyValidation(`Missing route page contracts for route family: ${closeout.familyId}`);
  }
  closeout.pageContracts.forEach((pageContract) => {
    if (!pageContract.pageId.trim() || !pageContract.menuCode.trim() || !pageContract.canonicalRoute.trim()) {
      reportRouteFamilyValidation(`Missing stable identity in route page contract for route family: ${closeout.familyId}`);
    }
    if (!pageContract.manifest.trim() || !pageContract.runtimeVerificationTarget.trim()) {
      reportRouteFamilyValidation(`Missing manifest/runtime target in route page contract for route family: ${closeout.familyId}`);
    }
    if (!pageContract.validator.trim() || !pageContract.rollbackEvidence.trim()) {
      reportRouteFamilyValidation(`Missing validator/rollback evidence in route page contract for route family: ${closeout.familyId}`);
    }
  });
  if (!closeout.pageSystemizationCloseout.startsWith("CLOSED: page systemization is complete for ")) {
    reportRouteFamilyValidation(`Invalid page-systemization closeout for route family: ${closeout.familyId}`);
  }
  if (!closeout.authorityScopeApplicationCloseout.startsWith("CLOSED: authority scope is consistently applied for ")) {
    reportRouteFamilyValidation(`Invalid authority-scope closeout for route family: ${closeout.familyId}`);
  }
  if (!closeout.builderInstallDeployCloseout.startsWith("CLOSED: builder install and deploy closeout is complete for ")) {
    reportRouteFamilyValidation(`Invalid builder-install-deploy closeout for route family: ${closeout.familyId}`);
  }
  if (!closeout.projectBindingPatternsCloseout.startsWith("CLOSED: project binding is explicit for ")) {
    reportRouteFamilyValidation(`Invalid project-binding-patterns closeout for route family: ${closeout.familyId}`);
  }
}

export function buildRouteFamilyAggregates<TFamilies extends readonly RouteFamilyOf<readonly RouteUnitDefinition[]>[]>(
  families: TFamilies
): {
  definitions: ReadonlyArray<TFamilies[number]["routeDefinitions"][number]>;
  pageUnits: ReadonlyArray<TFamilies[number]["pageUnits"][number]>;
} {
  validateRouteFamilies(families);
  const definitions: Array<TFamilies[number]["routeDefinitions"][number]> = [];
  const pageUnits: Array<TFamilies[number]["pageUnits"][number]> = [];

  families.forEach((family) => {
    definitions.push(...family.routeDefinitions);
    pageUnits.push(...family.pageUnits);
  });

  return {
    definitions,
    pageUnits
  };
}
