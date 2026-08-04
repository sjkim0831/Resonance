export type ContractOption = { value: string; labelKo: string; labelEn: string };

export type ContractField = {
  code: string;
  nameKo: string;
  nameEn: string;
  type: "TEXT" | "NUMBER" | "DATE" | "SELECT" | "CHECKBOX";
  section: string;
  required?: boolean;
  readOnly?: boolean;
  helpKo?: string;
  helpEn?: string;
  options?: ContractOption[];
  optionSource?: { code: string; actorCode?: string; emptyLabelKo: string; emptyLabelEn: string };
  validation?: { min?: number; max?: number; step?: number; maxLength?: number };
};

export type FiveLayerScreenContract = {
  version: "1.0";
  screen: { contractId: string | number; route: string; nameKo: string; nameEn: string; purposeKo: string; purposeEn: string };
  dataSchema: { fields: ContractField[] };
  uiSchema: {
    sections: Array<{ code: string; order: number; nameKo: string; nameEn: string; descriptionKo?: string; descriptionEn?: string; columns?: 1 | 2 | 3 }>;
    responsive: { mobileColumns: 1; tabletColumns: 1 | 2; desktopColumns: 1 | 2 | 3 };
    accessibility: { requiredMarker: true; errorSummary: true; labelStrategy: "explicit" };
  };
  actionSchema: { commands: Array<{ code: string; method: string; path: string }> };
  processSchema: { processCode: string; stepCode: string; states: string[]; entryCondition: string; exitCondition: string };
  permissionSchema: { actorCodes: string[]; actions: string[] };
};

export function assertFiveLayerContract(contract: FiveLayerScreenContract) {
  const sectionCodes = new Set(contract.uiSchema.sections.map((section) => section.code));
  const fieldCodes = new Set<string>();
  for (const field of contract.dataSchema.fields) {
    if (fieldCodes.has(field.code)) throw new Error(`Duplicate field contract: ${field.code}`);
    if (!sectionCodes.has(field.section)) throw new Error(`Unknown section contract: ${field.code} -> ${field.section}`);
    if (field.type === "SELECT" && !field.options?.length && !field.optionSource) throw new Error(`Selection field requires options or optionSource: ${field.code}`);
    fieldCodes.add(field.code);
  }
  if (!contract.processSchema.processCode || !contract.processSchema.stepCode) throw new Error("Process and step contracts are required");
  if (!contract.permissionSchema.actorCodes.length) throw new Error("At least one actor contract is required");
  return contract;
}
