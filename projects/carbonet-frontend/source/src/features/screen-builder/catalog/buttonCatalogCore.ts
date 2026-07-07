import systemComponentCatalogJson from "../../../generated/systemComponentCatalog.json";

export type SystemComponentCatalogType = "button" | "input" | "select" | "textarea" | "table" | "pagination";

export type SystemComponentCatalogRoute = {
  routeId: string;
  label: string;
  koPath: string;
  enPath: string;
};

export type SystemComponentCatalogInstance = {
  route: SystemComponentCatalogRoute;
  componentType: SystemComponentCatalogType;
  componentName: string;
  variant: string;
  size: string;
  className: string;
  icon: string;
  label: string;
  placeholder: string;
  summary: string;
};

export type SystemComponentCatalogItem = {
  key: string;
  styleGroupId: string;
  componentType: SystemComponentCatalogType;
  componentName: string;
  variant: string;
  size: string;
  className: string;
  icon: string;
  placeholder: string;
  summary: string;
  routeCount: number;
  instanceCount: number;
  labels: string[];
  routes: SystemComponentCatalogRoute[];
  instances: SystemComponentCatalogInstance[];
};

const systemComponentCatalog = systemComponentCatalogJson as SystemComponentCatalogItem[];

export function buildSystemComponentCatalog(): SystemComponentCatalogItem[] {
  return systemComponentCatalog;
}

export function buildSystemButtonCatalog(): SystemComponentCatalogItem[] {
  return systemComponentCatalog.filter((item) => item.componentType === "button");
}
