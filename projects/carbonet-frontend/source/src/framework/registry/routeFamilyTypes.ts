export type RouteUnitDefinition<TId extends string = string> = {
  id: TId;
  label: string;
  group: "admin" | "platform" | "join" | "home";
  koPath: string;
  enPath: string;
};

export type RouteDefinitionsOf<TId extends string = string> = ReadonlyArray<RouteUnitDefinition<TId>>;
type RouteIdsOf<TDefinitions extends readonly RouteUnitDefinition[]> = TDefinitions[number]["id"];

export type LazyPageUnit<TId extends string = string> = {
  id: TId;
  exportName: string;
  loader: () => Promise<unknown>;
};

export type PageUnitsOf<TDefinitions extends readonly RouteUnitDefinition[]> = ReadonlyArray<LazyPageUnit<RouteIdsOf<TDefinitions>>>;

export type RoutePageContract<TId extends string = string> = {
  routeId: TId;
  pageId: string;
  menuCode: string;
  canonicalRoute: string;
  manifest: string;
  runtimeVerificationTarget: string;
  validator: string;
  rollbackEvidence: string;
};

export type RouteFamilyCloseout = {
  familyId: string;
  pageFamily: string;
  ownershipLane: "SYSTEM" | "BUILDER" | "PROJECT" | "DOMAIN_INSTALL";
  installScope: "COMMON_ONLY" | "PROJECT_ONLY" | "COMMON_DEF_PROJECT_BIND";
  systemization: {
    manifestOwner: string;
    templateProfile: string;
    frameProfile: string;
    helpBinding: string;
    accessibilityBinding: string;
    securityBinding: string;
  };
  authorityScope: {
    actorFamily: string;
    dataScope: string;
    actionScopes: readonly string[];
    menuPolicy: string;
    entryPolicy: string;
    queryPolicy: string;
    actionPolicy: string;
    approvalPolicy: string;
    auditPolicy: string;
    tracePolicy: string;
    denyState: string;
  };
  commonDefinition: {
    owner: string;
    artifacts: readonly string[];
  };
  projectBinding: {
    owner: string;
    menuBinding: string;
    routeBinding: string;
    authorityBinding: string;
    themeBinding: string;
  };
  projectExecutor: {
    owner: string;
    responsibilities: readonly string[];
  };
  installDeploy: {
    packagingOwnerPath: string;
    assemblyOwnerPath: string;
    bootstrapPayloadTarget: string;
    bindingInputs: readonly string[];
    validatorChecks: readonly string[];
    runtimeVerificationTarget: string;
    compareTarget: string;
    deploySequence: string;
    freshnessVerificationSequence: string;
    validator: string;
    rollbackEvidence: string;
    auditTrace: string;
  };
  pageContracts: readonly RoutePageContract[];
  pageSystemizationCloseout: string;
  authorityScopeApplicationCloseout: string;
  builderInstallDeployCloseout: string;
  projectBindingPatternsCloseout: string;
};

export type RouteFamilyOf<TDefinitions extends readonly RouteUnitDefinition[]> = {
  routeDefinitions: TDefinitions;
  pageUnits: PageUnitsOf<TDefinitions>;
  closeout: RouteFamilyCloseout;
};

export function createRouteFamily<const TDefinitions extends readonly RouteUnitDefinition[]>(
  routeDefinitions: TDefinitions,
  pageUnits: PageUnitsOf<TDefinitions>,
  closeout: RouteFamilyCloseout
): RouteFamilyOf<TDefinitions> {
  return {
    routeDefinitions,
    pageUnits,
    closeout
  };
}

type BuildRoutePageContractsOptions<TDefinitions extends readonly RouteUnitDefinition[]> = {
  familyId: string;
  manifestRoot: string;
  validator: string;
  rollbackEvidence: string;
  menuCodePrefix?: string;
  menuCodeByRoute?: Partial<Record<RouteIdsOf<TDefinitions>, string>>;
  manifestByRoute?: Partial<Record<RouteIdsOf<TDefinitions>, string>>;
  runtimeVerificationTargetByRoute?: Partial<Record<RouteIdsOf<TDefinitions>, string>>;
};

function toRegistryMenuCode(routeId: string, prefix?: string) {
  const normalized = routeId.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  return prefix ? `${prefix}_${normalized}` : normalized;
}

export function buildRoutePageContracts<const TDefinitions extends readonly RouteUnitDefinition[]>(
  routeDefinitions: TDefinitions,
  options: BuildRoutePageContractsOptions<TDefinitions>
): ReadonlyArray<RoutePageContract<RouteIdsOf<TDefinitions>>> {
  return routeDefinitions.map((definition) => {
    const routeId = definition.id as RouteIdsOf<TDefinitions>;
    return {
    routeId,
    pageId: routeId,
    menuCode: options.menuCodeByRoute?.[routeId] || toRegistryMenuCode(routeId, options.menuCodePrefix),
    canonicalRoute: definition.koPath,
    manifest: options.manifestByRoute?.[routeId] || `${options.manifestRoot}.${routeId}`,
    runtimeVerificationTarget: options.runtimeVerificationTargetByRoute?.[routeId] || definition.koPath,
    validator: options.validator,
    rollbackEvidence: options.rollbackEvidence
  };
  });
}
