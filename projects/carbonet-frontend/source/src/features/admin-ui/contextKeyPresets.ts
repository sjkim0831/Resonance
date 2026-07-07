import type { ContextKeyItem } from "./ContextKeyStrip";

type ContextKeyPreset = {
  guidedStateId: string;
  templateLineId: string;
  screenFamilyRuleId: string;
  ownerLane: string;
};

type GovernedTemplateType = "EDIT_PAGE" | "LIST_PAGE" | "DETAIL_PAGE" | "REVIEW_PAGE" | "";

type RuntimeGovernedContextOptions = {
  menuUrl?: string;
  templateType?: string;
};

function toContextKeyItems(preset: ContextKeyPreset): ContextKeyItem[] {
  return [
    { label: "Guided State", value: preset.guidedStateId },
    { label: "Template Line", value: preset.templateLineId },
    { label: "Screen Family Rule", value: preset.screenFamilyRuleId },
    { label: "Owner Lane", value: preset.ownerLane }
  ];
}

function resolveSurfaceType(menuUrl?: string) {
  const normalized = String(menuUrl || "").trim().toLowerCase();
  return normalized.startsWith("/admin") || normalized.startsWith("/en/admin") ? "admin" : "public";
}

function resolveTemplateLineId(menuUrl?: string) {
  return resolveSurfaceType(menuUrl) === "admin" ? "admin-line-02" : "public-line-01";
}

function resolvePublicScreenFamilyRuleId(menuUrl?: string) {
  const normalized = String(menuUrl || "").trim().toLowerCase();
  if (normalized.includes("/join")) {
    return "PUBLIC_JOIN_STEP";
  }
  return "PUBLIC_HOME";
}

function resolveAdminScreenFamilyRuleId(templateType: GovernedTemplateType) {
  switch (templateType) {
    case "LIST_PAGE":
      return "ADMIN_LIST";
    case "DETAIL_PAGE":
      return "ADMIN_DETAIL";
    case "REVIEW_PAGE":
      return "ADMIN_LIST_REVIEW";
    case "EDIT_PAGE":
    default:
      return "ADMIN_EDIT";
  }
}

export function resolveRuntimeSurfaceContextKeys(options?: RuntimeGovernedContextOptions): ContextKeyItem[] {
  const menuUrl = options?.menuUrl || "";
  const templateType = String(options?.templateType || "").trim().toUpperCase() as GovernedTemplateType;
  const surfaceType = resolveSurfaceType(menuUrl);
  return toContextKeyItems({
    guidedStateId: "guided-build-07-runtime-binding",
    templateLineId: resolveTemplateLineId(menuUrl),
    screenFamilyRuleId: surfaceType === "admin"
      ? resolveAdminScreenFamilyRuleId(templateType)
      : resolvePublicScreenFamilyRuleId(menuUrl),
    ownerLane: "res-frontend"
  });
}

export function resolveRuntimeCompareContextKeys(options?: RuntimeGovernedContextOptions): ContextKeyItem[] {
  const menuUrl = options?.menuUrl || "";
  const templateType = String(options?.templateType || "").trim().toUpperCase() as GovernedTemplateType;
  const surfaceType = resolveSurfaceType(menuUrl);
  return toContextKeyItems({
    guidedStateId: "guided-build-14-runtime-compare",
    templateLineId: resolveTemplateLineId(menuUrl),
    screenFamilyRuleId: surfaceType === "admin"
      ? resolveAdminScreenFamilyRuleId(templateType)
      : resolvePublicScreenFamilyRuleId(menuUrl),
    ownerLane: "res-verify"
  });
}

export function resolveRepairWorkbenchContextKeys(options?: RuntimeGovernedContextOptions): ContextKeyItem[] {
  const menuUrl = options?.menuUrl || "";
  const templateType = String(options?.templateType || "").trim().toUpperCase() as GovernedTemplateType;
  const surfaceType = resolveSurfaceType(menuUrl);
  return toContextKeyItems({
    guidedStateId: "guided-build-15-repair",
    templateLineId: resolveTemplateLineId(menuUrl),
    screenFamilyRuleId: surfaceType === "admin"
      ? resolveAdminScreenFamilyRuleId(templateType)
      : resolvePublicScreenFamilyRuleId(menuUrl),
    ownerLane: "res-verify"
  });
}

export const authorDesignContextKeys = toContextKeyItems({
  guidedStateId: "guided-build-author-design",
  templateLineId: "admin-line-02",
  screenFamilyRuleId: "ADMIN_WORKSPACE_COMPOSE",
  ownerLane: "res-frontend"
});

export const verifyRuntimeContextKeys = toContextKeyItems({
  guidedStateId: "guided-build-verify-runtime",
  templateLineId: "admin-line-02",
  screenFamilyRuleId: "ADMIN_LIST_REVIEW",
  ownerLane: "res-verify"
});

export const runtimeSurfaceContextKeys = toContextKeyItems({
  guidedStateId: "guided-build-07-runtime-binding",
  templateLineId: "admin-line-02",
  screenFamilyRuleId: "ADMIN_LIST_REVIEW",
  ownerLane: "res-frontend"
});

export const codexWorkbenchContextKeys = toContextKeyItems({
  guidedStateId: "guided-build-prepare-plan-build",
  templateLineId: "admin-line-02",
  screenFamilyRuleId: "ADMIN_WORKBENCH_FLOW",
  ownerLane: "res-frontend"
});
