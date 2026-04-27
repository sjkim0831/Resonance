import type { LayoutZone } from "../../platform/screen-registry/types";

export type FrameworkContractSource = "frontend-static-registry" | "backend-runtime-registry";

export type FrameworkBuilderSurfaceContract = {
  componentId: string;
  instanceKey: string;
  layoutZone: LayoutZone | string;
  displayOrder: number;
  propsSummary: string[];
  conditionalRuleSummary: string;
};

export type FrameworkBuilderPageContract = {
  pageId: string;
  label: string;
  routePath: string;
  canonicalRoute: string;
  menuCode: string;
  domainCode: string;
  routeId: string;
  pageFamily: string;
  ownershipLane: string;
  installScope: string;
  layoutVersion: string;
  designTokenVersion: string;
  manifestId: string;
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
  bootstrapQueryMutationContract: {
    bootstrapPayloadTarget: string;
    compareTarget: string;
    auditTrace: string;
  };
  projectBinding: {
    owner: string;
    menuBinding: string;
    routeBinding: string;
    authorityBinding: string;
    themeBinding: string;
    bindingInputs: readonly string[];
  };
  projectExecutor: {
    owner: string;
    responsibilities: readonly string[];
  };
  installDeploy: {
    packagingOwnerPath: string;
    assemblyOwnerPath: string;
    validator: string;
    validatorChecks: readonly string[];
    rollbackEvidence: string;
    runtimeVerificationTarget: string;
    compareTarget: string;
    deploySequence: string;
    freshnessVerificationSequence: string;
  };
  closeout: {
    pageSystemization: string;
    authorityScopeApplication: string;
    builderInstallDeploy: string;
    projectBindingPatterns: string;
  };
  componentCount: number;
  components: FrameworkBuilderSurfaceContract[];
};

export type FrameworkBuilderComponentContract = {
  componentId: string;
  label: string;
  componentType: string;
  ownerDomain: string;
  status: string;
  sourceType: string;
  replacementComponentId: string;
  designReference: string;
  propsSchemaJson: string;
  usageCount: number;
  routeCount: number;
  instanceCount: number;
  labels: string[];
  builderReady: boolean;
};

export type FrameworkBuilderProfiles = {
  pageFrameProfileIds: string[];
  layoutZoneIds: string[];
  componentTypeIds: string[];
  artifactUnitIds: string[];
};

export type FrameworkBuilderContract = {
  frameworkId: string;
  frameworkName: string;
  contractVersion: string;
  source: FrameworkContractSource;
  generatedAt: string;
  pages: FrameworkBuilderPageContract[];
  components: FrameworkBuilderComponentContract[];
  builderProfiles: FrameworkBuilderProfiles;
};
