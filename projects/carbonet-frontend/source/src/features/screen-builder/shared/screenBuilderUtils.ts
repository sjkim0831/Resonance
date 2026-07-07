import type { ScreenBuilderNode } from "../../../lib/api/platformTypes";

export function resolveScreenBuilderQuery(searchParams: { get(name: string): string | null }): {
  menuCode: string;
  pageId: string;
  menuTitle: string;
  menuUrl: string;
} {
  return {
    menuCode: searchParams.get("menuCode") || "",
    pageId: searchParams.get("pageId") || "",
    menuTitle: searchParams.get("menuTitle") || "",
    menuUrl: searchParams.get("menuUrl") || ""
  };
}

export function sortScreenBuilderNodes(nodes: ScreenBuilderNode[]) {
  return [...nodes].sort((left, right) => left.sortOrder - right.sortOrder);
}
