import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  useFrameworkAuthorityContract
} from "../../../framework";
import type {
  ScreenBuilderComponentRegistryItem,
  ScreenBuilderComponentUsage,
  ScreenBuilderNode,
  ScreenBuilderPagePayload
} from "../../../lib/api/platformTypes";
import { fetchScreenBuilderComponentRegistryUsage } from "../../../lib/api/platform";
import type { SystemComponentCatalogItem, SystemComponentCatalogType } from "../catalog/buttonCatalogCore";
import { supportedSystemCatalogTypes, type BuilderTemplateType } from "../shared/screenBuilderShared";
import { sortScreenBuilderNodes } from "../shared/screenBuilderUtils";

type Params = {
  componentRegistry: ScreenBuilderComponentRegistryItem[];
  en: boolean;
  page: ScreenBuilderPagePayload | null;
  registryStatusFilter: "ALL" | "ACTIVE" | "DEPRECATED";
  registryTypeFilter: string;
  registryUsagePreviewMap: Record<string, ScreenBuilderComponentUsage[]>;
  selectedRegistryComponentId: string;
  setComponentRegistry: Dispatch<SetStateAction<ScreenBuilderComponentRegistryItem[]>>;
  setPreviewNodes: Dispatch<SetStateAction<ScreenBuilderNode[]>>;
  setRegistryEditorDescription: Dispatch<SetStateAction<string>>;
  setRegistryEditorLabel: Dispatch<SetStateAction<string>>;
  setRegistryEditorPropsJson: Dispatch<SetStateAction<string>>;
  setRegistryEditorReplacementId: Dispatch<SetStateAction<string>>;
  setRegistryEditorStatus: Dispatch<SetStateAction<string>>;
  setRegistryEditorType: Dispatch<SetStateAction<string>>;
  setRegistryUsageLoading: Dispatch<SetStateAction<boolean>>;
  setRegistryUsagePreviewMap: Dispatch<SetStateAction<Record<string, ScreenBuilderComponentUsage[]>>>;
  setRegistryUsageRows: Dispatch<SetStateAction<ScreenBuilderComponentUsage[]>>;
  setSaveError: Dispatch<SetStateAction<string>>;
  setSelectedRegistryComponentId: Dispatch<SetStateAction<string>>;
  setSelectedTemplateType: Dispatch<SetStateAction<BuilderTemplateType>>;
};

export function useScreenBuilderGovernanceState({
  componentRegistry,
  en,
  page,
  registryStatusFilter,
  registryTypeFilter,
  registryUsagePreviewMap,
  selectedRegistryComponentId,
  setComponentRegistry,
  setPreviewNodes,
  setRegistryEditorDescription,
  setRegistryEditorLabel,
  setRegistryEditorPropsJson,
  setRegistryEditorReplacementId,
  setRegistryEditorStatus,
  setRegistryEditorType,
  setRegistryUsageLoading,
  setRegistryUsagePreviewMap,
  setRegistryUsageRows,
  setSaveError,
  setSelectedRegistryComponentId,
  setSelectedTemplateType
}: Params) {
  const [systemComponentCatalog, setSystemComponentCatalog] = useState<SystemComponentCatalogItem[]>([]);
  const {
    builderReadyRoles: authorityRoleTemplates,
    roleCategoryOptions: authorityRoleCategoryOptions,
    assignmentAuthorities: authorityAssignmentAuthorities,
    roleCategories: authorityRoleCategories,
    loading: authorityLoading
  } = useFrameworkAuthorityContract();
  const selectedRegistryInventoryItem = useMemo(
    () => componentRegistry.find((item) => item.componentId === selectedRegistryComponentId) || null,
    [componentRegistry, selectedRegistryComponentId]
  );
  const backendUnregisteredNodes = page?.registryDiagnostics?.unregisteredNodes || [];
  const backendMissingNodes = page?.registryDiagnostics?.missingNodes || [];
  const backendDeprecatedNodes = page?.registryDiagnostics?.deprecatedNodes || [];
  const componentPromptSurface = page?.registryDiagnostics?.componentPromptSurface || [];
  const componentTypeOptions = useMemo(
    () => Array.from(new Set((page?.componentTypeOptions || componentRegistry.map((item) => item.componentType)).filter(Boolean))).sort((left, right) => String(left).localeCompare(String(right))),
    [componentRegistry, page?.componentTypeOptions]
  );
  const filteredComponentRegistry = useMemo(
    () => componentRegistry.filter((item) => {
      const matchesStatus = registryStatusFilter === "ALL" ? true : String(item.status || "ACTIVE") === registryStatusFilter;
      const matchesType = registryTypeFilter === "ALL" ? true : String(item.componentType || "") === registryTypeFilter;
      return matchesStatus && matchesType;
    }),
    [componentRegistry, registryStatusFilter, registryTypeFilter]
  );
  const selectedCatalogType = useMemo<SystemComponentCatalogType | "ALL" | "">(
    () => supportedSystemCatalogTypes.includes(registryTypeFilter as SystemComponentCatalogType)
      ? (registryTypeFilter as SystemComponentCatalogType)
      : registryTypeFilter === "ALL"
        ? "ALL"
        : "",
    [registryTypeFilter]
  );
  const filteredSystemCatalog = useMemo(
    () => selectedCatalogType === "ALL"
      ? systemComponentCatalog
      : selectedCatalogType
        ? systemComponentCatalog.filter((item) => item.componentType === selectedCatalogType)
        : [],
    [selectedCatalogType, systemComponentCatalog]
  );
  const systemCatalogInstances = useMemo(
    () => filteredSystemCatalog.flatMap((item) => item.instances.map((instance, index) => ({
      key: `${item.key}-${instance.route.routeId}-${instance.label || index}`,
      styleGroupId: item.styleGroupId,
      componentType: item.componentType,
      componentName: instance.componentName,
      variant: instance.variant,
      size: instance.size,
      className: instance.className,
      icon: instance.icon,
      label: instance.label,
      placeholder: instance.placeholder,
      summary: instance.summary,
      route: instance.route
    }))),
    [filteredSystemCatalog]
  );
  const uniqueUsageUrlsByComponent = useMemo(
    () => Object.fromEntries(
      Object.entries(registryUsagePreviewMap).map(([componentId, rows]) => [
        componentId,
        Array.from(new Set((rows || []).map((row) => String(row.menuUrl || "").trim()).filter(Boolean)))
      ])
    ),
    [registryUsagePreviewMap]
  );

  useEffect(() => {
    let cancelled = false;
    import("../catalog/buttonCatalogCore")
      .then((module) => {
        if (!cancelled) {
          setSystemComponentCatalog(module.buildSystemComponentCatalog());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSystemComponentCatalog([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!page) {
      return;
    }
    setComponentRegistry(page.componentRegistry || []);
    setSelectedRegistryComponentId((current) => current || (page.componentRegistry || [])[0]?.componentId || "");
    setPreviewNodes(sortScreenBuilderNodes(page.nodes || []));
    setSelectedTemplateType((page.templateType || "EDIT_PAGE") as BuilderTemplateType);
  }, [page, setComponentRegistry, setPreviewNodes, setSelectedRegistryComponentId, setSelectedTemplateType]);

  useEffect(() => {
    if (!selectedRegistryInventoryItem) {
      setRegistryEditorType("");
      setRegistryEditorLabel("");
      setRegistryEditorDescription("");
      setRegistryEditorStatus("ACTIVE");
      setRegistryEditorReplacementId("");
      setRegistryEditorPropsJson("{}");
      setRegistryUsageRows([]);
      return;
    }
    setRegistryEditorType(String(selectedRegistryInventoryItem.componentType || ""));
    setRegistryEditorLabel(String(selectedRegistryInventoryItem.label || ""));
    setRegistryEditorDescription(String(selectedRegistryInventoryItem.description || ""));
    setRegistryEditorStatus(String(selectedRegistryInventoryItem.status || "ACTIVE"));
    setRegistryEditorReplacementId(String(selectedRegistryInventoryItem.replacementComponentId || ""));
    setRegistryEditorPropsJson(JSON.stringify(selectedRegistryInventoryItem.propsTemplate || {}, null, 2));
  }, [
    selectedRegistryInventoryItem,
    setRegistryEditorDescription,
    setRegistryEditorLabel,
    setRegistryEditorPropsJson,
    setRegistryEditorReplacementId,
    setRegistryEditorStatus,
    setRegistryEditorType,
    setRegistryUsageRows
  ]);

  useEffect(() => {
    if (!selectedRegistryComponentId) {
      setRegistryUsageRows([]);
      return;
    }
    let cancelled = false;
    setRegistryUsageLoading(true);
    fetchScreenBuilderComponentRegistryUsage(selectedRegistryComponentId)
      .then((response) => {
        if (!cancelled) {
          setRegistryUsageRows(response.items || []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSaveError(error instanceof Error ? error.message : (en ? "Failed to load component usage." : "컴포넌트 사용 화면을 불러오지 못했습니다."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRegistryUsageLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [en, selectedRegistryComponentId, setRegistryUsageLoading, setRegistryUsageRows, setSaveError]);

  useEffect(() => {
    if (registryTypeFilter !== "button") {
      return;
    }
    const targetIds = filteredComponentRegistry
      .filter((item) => item.componentType === "button")
      .slice(0, 24)
      .map((item) => item.componentId)
      .filter(Boolean);
    const missingIds = targetIds.filter((componentId) => !registryUsagePreviewMap[componentId]);
    if (!missingIds.length) {
      return;
    }
    let cancelled = false;
    Promise.all(missingIds.map((componentId) => fetchScreenBuilderComponentRegistryUsage(componentId)))
      .then((responses) => {
        if (cancelled) {
          return;
        }
        setRegistryUsagePreviewMap((current) => {
          const next = { ...current };
          missingIds.forEach((componentId, index) => {
            next[componentId] = responses[index]?.items || [];
          });
          return next;
        });
      })
      .catch(() => {
        // Keep the gallery usable even if one preview lookup fails.
      });
    return () => {
      cancelled = true;
    };
  }, [filteredComponentRegistry, registryTypeFilter, registryUsagePreviewMap, setRegistryUsagePreviewMap]);

  return {
    authorityAssignmentAuthorities,
    authorityLoading,
    authorityRoleCategories,
    authorityRoleCategoryOptions,
    authorityRoleTemplates,
    backendDeprecatedNodes,
    backendMissingNodes,
    backendUnregisteredNodes,
    componentPromptSurface,
    componentTypeOptions,
    filteredComponentRegistry,
    filteredSystemCatalog,
    selectedCatalogType,
    selectedRegistryInventoryItem,
    systemCatalogInstances,
    uniqueUsageUrlsByComponent
  };
}
