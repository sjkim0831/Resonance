export const KRDS_TYPE_ROLES = ["caption", "label", "body", "subtitle", "title", "display"] as const;
export const KRDS_DENSITIES = ["compact", "standard", "comfortable"] as const;
export const KRDS_COMPONENT_SPANS = ["auto", "full", "half", "third"] as const;

export type KrdsTypeRole = typeof KRDS_TYPE_ROLES[number];
export type KrdsDensity = typeof KRDS_DENSITIES[number];
export type KrdsComponentSpan = typeof KRDS_COMPONENT_SPANS[number];

export type ResponsiveDesignContract = {
  typeRole: KrdsTypeRole;
  density: KrdsDensity;
  span: KrdsComponentSpan;
  mobileStack: boolean;
};

export const DEFAULT_RESPONSIVE_DESIGN_CONTRACT: ResponsiveDesignContract = {
  typeRole: "body",
  density: "standard",
  span: "auto",
  mobileStack: true
};

export function krdsResponsiveClasses(contract: Partial<ResponsiveDesignContract> = {}) {
  const value = { ...DEFAULT_RESPONSIVE_DESIGN_CONTRACT, ...contract };
  const spanClass = value.span === "full" ? "krds-span-full" : value.span === "half" ? "krds-span-half" : value.span === "third" ? "krds-span-third" : "";
  return {
    container: "krds-responsive-container",
    layout: "krds-auto-layout",
    component: `krds-component krds-type-${value.typeRole} ${spanClass}`.trim(),
    density: value.density
  };
}
