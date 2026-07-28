import type { ScreenCoordinate } from "./generatedScreenTypes";
export type GeneratedScreenCoordinateIndex={key:string;pageId:string;routePath:string;coordinate:ScreenCoordinate};
export const GENERATED_SCREEN_SPACE_INDEX=[
  {
    "key": "EMISSION::EMISSION_PROJECT::EMISSION_PROJECT_SETUP::DRAFT::COMPANY_MANAGER::COMPANY_MANAGER%3ADEFAULT::FORM::ADAPTIVE::MULTI::KRDS_TASK_FORM",
    "pageId": "DETAILED_USER_PAGE",
    "routePath": "/generated/emission-project/create",
    "coordinate": {
      "domain": "EMISSION",
      "process": "EMISSION_PROJECT",
      "step": "EMISSION_PROJECT_SETUP",
      "state": "DRAFT",
      "actor": "COMPANY_MANAGER",
      "policy": "COMPANY_MANAGER:DEFAULT",
      "view": "FORM",
      "device": "ADAPTIVE",
      "locale": "MULTI",
      "variant": "KRDS_TASK_FORM"
    }
  }
] as const satisfies readonly GeneratedScreenCoordinateIndex[];
export function findScreenByCoordinate(key:string){return GENERATED_SCREEN_SPACE_INDEX.find(item=>item.key===key);}
