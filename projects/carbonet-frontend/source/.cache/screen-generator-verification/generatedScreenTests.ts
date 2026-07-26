export type GeneratedScreenTestContract={pageId:string;actorCode:string;routePath:string;requiredScenarios:readonly string[];designScore:number};
export const GENERATED_SCREEN_TESTS=[
  {
    "pageId": "DETAILED_USER_PAGE",
    "actorCode": "COMPANY_MANAGER",
    "routePath": "/generated/emission-project/create",
    "requiredScenarios": [
      "HAPPY_PATH",
      "AUTHORITY",
      "ISOLATION",
      "EXCEPTION",
      "RECOVERY"
    ],
    "designScore": 100
  }
] as const satisfies readonly GeneratedScreenTestContract[];
