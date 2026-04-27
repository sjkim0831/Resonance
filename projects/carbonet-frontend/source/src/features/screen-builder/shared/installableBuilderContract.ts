export const BUILDER_INSTALL_REQUIRED_BINDINGS = [
  "projectId",
  "menuRoot",
  "runtimeClass",
  "menuScope",
  "releaseUnitPrefix",
  "runtimePackagePrefix"
] as const;
export type BuilderInstallBindingKey = typeof BUILDER_INSTALL_REQUIRED_BINDINGS[number];

export const BUILDER_INSTALL_VALIDATOR_CHECKS = [
  "required-beans-present",
  "required-properties-present",
  "menu-root-resolvable",
  "storage-writable",
  "builder-routes-exposed"
] as const;
export type BuilderInstallValidatorCheckKey = typeof BUILDER_INSTALL_VALIDATOR_CHECKS[number];

export const BUILDER_INSTALL_ARTIFACTS = [
  "screenbuilder-core.jar",
  "screenbuilder-project-adapter.jar",
  "application-screenbuilder.properties"
] as const;

export type BuilderInstallQueueSummary = {
  menuCode: string;
  pageId: string;
  menuUrl: string;
  releaseUnitId: string;
  runtimePackageId: string;
  deployTraceId: string;
  publishReady: boolean;
  issueCount: number;
  validatorPassCount: number;
  validatorTotalCount: number;
};

export type BuilderInstallFlowStep = {
  key: "draft" | "publish" | "binding" | "install";
  title: string;
  state: string;
  tone: string;
  detail: string;
};

export type BuilderInstallFlowContract = {
  manifestTarget: string;
  bindingInputs: ReadonlyArray<{ key: BuilderInstallBindingKey; ready: boolean; detail: string }>;
  validatorInputs: ReadonlyArray<{ key: BuilderInstallValidatorCheckKey; ready: boolean; detail: string }>;
  rollbackEvidenceTarget: string;
  steps: ReadonlyArray<BuilderInstallFlowStep>;
};

export function describeBuilderInstallBinding(binding: BuilderInstallBindingKey, en: boolean) {
  switch (binding) {
    case "projectId":
      return en ? "Project Id" : "프로젝트 ID";
    case "menuRoot":
      return en ? "Menu Root" : "메뉴 루트";
    case "runtimeClass":
      return en ? "Runtime Class" : "런타임 클래스";
    case "menuScope":
      return en ? "Menu Scope" : "메뉴 스코프";
    case "releaseUnitPrefix":
      return en ? "Release Unit Prefix" : "릴리즈 유닛 Prefix";
    case "runtimePackagePrefix":
      return en ? "Runtime Package Prefix" : "런타임 패키지 Prefix";
    default:
      return binding;
  }
}

export function describeBuilderValidatorCheck(check: BuilderInstallValidatorCheckKey, en: boolean) {
  switch (check) {
    case "required-beans-present":
      return en ? "Required Beans" : "필수 Bean";
    case "required-properties-present":
      return en ? "Required Properties" : "필수 Properties";
    case "menu-root-resolvable":
      return en ? "Menu Root Resolvable" : "메뉴 루트 해석";
    case "storage-writable":
      return en ? "Storage Writable" : "스토리지 쓰기";
    case "builder-routes-exposed":
      return en ? "Builder Routes Exposed" : "빌더 라우트 노출";
    default:
      return check;
  }
}

export function buildBuilderInstallQueueSummary(input: {
  menuCode?: string | null;
  pageId?: string | null;
  menuUrl?: string | null;
  releaseUnitId?: string | null;
  runtimePackageId?: string | null;
  deployTraceId?: string | null;
  publishReady: boolean;
  issueCount: number;
  validatorPassCount: number;
  validatorTotalCount: number;
}): BuilderInstallQueueSummary {
  return {
    menuCode: String(input.menuCode || "-"),
    pageId: String(input.pageId || "-"),
    menuUrl: String(input.menuUrl || "-"),
    releaseUnitId: String(input.releaseUnitId || "-"),
    runtimePackageId: String(input.runtimePackageId || "-"),
    deployTraceId: String(input.deployTraceId || "-"),
    publishReady: input.publishReady,
    issueCount: input.issueCount,
    validatorPassCount: input.validatorPassCount,
    validatorTotalCount: input.validatorTotalCount
  };
}

export function buildBuilderInstallFlowContract(input: {
  en: boolean;
  manifestTarget: string;
  queueSummary: BuilderInstallQueueSummary;
  bindingInputs: ReadonlyArray<{ key: BuilderInstallBindingKey; ready: boolean; detail: string }>;
  validatorInputs: ReadonlyArray<{ key: BuilderInstallValidatorCheckKey; ready: boolean; detail: string }>;
  rollbackEvidenceTarget: string;
  publishedVersionId?: string | null;
  versionId?: string | null;
  publishIssueCount: number;
  requiredViewFeatureCode?: string | null;
}) : BuilderInstallFlowContract {
  const { en } = input;
  const bindingReady = input.bindingInputs.every((item) => item.ready);
  const installReady = input.queueSummary.releaseUnitId !== "-"
    && input.queueSummary.runtimePackageId !== "-"
    && input.queueSummary.deployTraceId !== "-";

  return {
    manifestTarget: input.manifestTarget,
    bindingInputs: input.bindingInputs,
    validatorInputs: input.validatorInputs,
    rollbackEvidenceTarget: input.rollbackEvidenceTarget,
    steps: [
      {
        key: "draft",
        title: en ? "1. Draft" : "1. 초안",
        state: input.versionId ? (en ? "READY" : "준비됨") : (en ? "MISSING" : "없음"),
        tone: input.versionId ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50",
        detail: input.versionId || (en ? "Save the current package draft first." : "먼저 현재 패키지 초안을 저장하세요.")
      },
      {
        key: "publish",
        title: en ? "2. Publish" : "2. 발행",
        state: input.publishedVersionId
          ? (en ? "READY" : "준비됨")
          : (input.queueSummary.publishReady ? (en ? "WAITING" : "대기") : (en ? "BLOCKED" : "차단")),
        tone: input.publishedVersionId
          ? "text-emerald-700 bg-emerald-50"
          : (input.queueSummary.publishReady ? "text-blue-700 bg-blue-50" : "text-red-700 bg-red-50"),
        detail: input.publishedVersionId || (
          input.queueSummary.publishReady
            ? (en ? "Build install snapshot." : "설치 스냅샷을 빌드하세요.")
            : `${input.publishIssueCount} issue(s)`
        )
      },
      {
        key: "binding",
        title: en ? "3. Project Binding" : "3. 프로젝트 바인딩",
        state: bindingReady ? (en ? "READY" : "준비됨") : (en ? "BLOCKED" : "차단"),
        tone: bindingReady ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50",
        detail: bindingReady
          ? `${input.queueSummary.menuCode || "-"} / ${String(input.requiredViewFeatureCode || "-")}`
          : input.bindingInputs.filter((item) => !item.ready).map((item) => describeBuilderInstallBinding(item.key, en)).join(", ")
      },
      {
        key: "install",
        title: en ? "4. Install" : "4. 설치",
        state: installReady ? (en ? "READY" : "준비됨") : (en ? "PIPELINE" : "파이프라인 필요"),
        tone: installReady ? "text-emerald-700 bg-emerald-50" : "text-violet-700 bg-violet-50",
        detail: installReady
          ? `${input.queueSummary.releaseUnitId} / ${input.queueSummary.runtimePackageId}`
          : (en ? "Open compare or repair pipeline to promote installable product." : "compare 또는 repair 파이프라인에서 설치형 프로덕트로 승격하세요.")
      }
    ]
  };
}
