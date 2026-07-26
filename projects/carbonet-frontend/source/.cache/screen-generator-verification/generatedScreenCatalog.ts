import type { GeneratedScreenDefinition } from "./generatedScreenTypes";
import { screen_detailed_user_page } from "./definitions/detailed-user-page";
export type { GeneratedScreenDefinition } from "./generatedScreenTypes";
export const GENERATED_SCREEN_CATALOG = [
  screen_detailed_user_page
] as const satisfies readonly GeneratedScreenDefinition[];
export function findGeneratedScreen(pathname:string){const normalized=pathname.replace(/^\/en(?=\/)/,"")||"/";return GENERATED_SCREEN_CATALOG.find(screen=>screen.routePath===normalized);}
