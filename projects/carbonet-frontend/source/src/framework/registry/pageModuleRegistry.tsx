import { ComponentType, lazy } from "react";
import type { LazyPageUnit } from "./routeFamilyTypes";

function isModuleRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isComponentExport(value: unknown): value is ComponentType {
  return typeof value === "function";
}

function lazyNamed(loader: () => Promise<unknown>, exportName: string) {
  return lazy(async () => {
    const module = await loader();
    if (!isModuleRecord(module)) {
      throw new Error(`Invalid page module payload for export: ${exportName}`);
    }
    const component = module[exportName];
    if (component === undefined) {
      throw new Error(`Missing page module export: ${exportName}`);
    }
    if (!isComponentExport(component)) {
      throw new Error(`Invalid page module export type: ${exportName}`);
    }
    return { default: component };
  });
}

export function createPageModuleRegistry<TPageUnit extends LazyPageUnit>(
  units: ReadonlyArray<TPageUnit>,
  defaultRoute: TPageUnit["id"]
) {
  const components: Partial<Record<TPageUnit["id"], ComponentType>> = {};
  const preloaders: Partial<Record<TPageUnit["id"], () => Promise<unknown>>> = {};
  const preloadedModules: Partial<Record<TPageUnit["id"], Promise<unknown>>> = {};

  units.forEach((unit) => {
    const routeId = unit.id as TPageUnit["id"];
    if (components[routeId]) {
      throw new Error(`Duplicate page unit detected for route: ${routeId}`);
    }
    components[routeId] = lazyNamed(unit.loader, unit.exportName);
    preloaders[routeId] = unit.loader;
  });

  const defaultComponent = components[defaultRoute];
  if (!defaultComponent) {
    throw new Error(`Default page component is missing for route: ${defaultRoute}`);
  }

  return {
    getPageComponent(route: TPageUnit["id"]) {
      return components[route] || defaultComponent;
    },
    preloadPageModule(route: TPageUnit["id"]) {
      const loader = preloaders[route];
      if (!loader) {
        return Promise.resolve();
      }
      if (!preloadedModules[route]) {
        preloadedModules[route] = loader();
      }
      return preloadedModules[route];
    }
  };
}
