import type { ComponentType } from "react";
import { createPageModuleRegistry } from "../../framework/registry/pageModuleRegistry";
import { ALL_ROUTE_PAGE_UNITS, DEFAULT_PAGE_ROUTE } from "./routeCatalog";

type PageRouteId = (typeof ALL_ROUTE_PAGE_UNITS)[number]["id"];

const pageModuleRegistry = createPageModuleRegistry(ALL_ROUTE_PAGE_UNITS, DEFAULT_PAGE_ROUTE);

export function getPageComponent(route: PageRouteId): ComponentType {
  return pageModuleRegistry.getPageComponent(route);
}

export function preloadPageModule(route: PageRouteId) {
  return pageModuleRegistry.preloadPageModule(route);
}
