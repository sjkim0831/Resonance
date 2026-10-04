import type { ScreenBuilderPreviewPayload } from "../../../lib/api/platformTypes";

export function canonicalScreenPath(route: string) {
  return route.split(/[?#]/, 1)[0].replace(/^\/en\/admin\//, "/admin/");
}

export function isPublishedScreenFor(screen: ScreenBuilderPreviewPayload | null | undefined, target: { menuCode: string; pageId: string; menuUrl: string }) {
  return Boolean(screen && screen.versionStatus === "PUBLISHED" && target.menuCode && target.pageId
    && screen.menuCode === target.menuCode && screen.pageId === target.pageId
    && canonicalScreenPath(screen.menuUrl) === canonicalScreenPath(target.menuUrl));
}
