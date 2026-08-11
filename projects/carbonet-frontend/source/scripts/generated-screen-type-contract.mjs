export const GENERATED_SCREEN_TYPES_SOURCE = [
  "export type DesignCompleteness={score:number;complete:boolean;checks:Record<string,boolean>};",
  "export type ScreenCoordinate={domain:string;process:string;step:string;state:string;actor:string;policy:string;view:string;device:string;locale:string;variant:string};",
  'export type GeneratedScreenDefinition = { id:string; blueprintCode:string; processCode:string; stepCode:string; actorCode:string; audience:"USER"|"ADMIN"; pageId:string; pageName:string; routePath:string; screenType:string; templateCode:string; screenCoordinate:ScreenCoordinate; screenCoordinateKey:string; specification:Record<string,any>; traceability:Record<string,any>; designCompleteness:DesignCompleteness; };',
  "",
].join("\n");
