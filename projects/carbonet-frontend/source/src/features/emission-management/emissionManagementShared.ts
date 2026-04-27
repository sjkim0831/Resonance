import type { EmissionCategoryItem, EmissionVariableDefinition } from "../../lib/api/emissionTypes";

export type InputRow = {
  lineNo: number;
  value: string;
};

export type InputMap = Record<string, InputRow[]>;
export type WizardStep = 1 | 2;
export type MajorCategoryOption = {
  key: string;
  majorCode: string;
  majorName: string;
};

export type VariableSection = {
  id: string;
  order: number;
  title: string;
  description: string;
  formula: string;
  previewType: string;
  relatedFactorCodes: string;
  codes: string[];
};

export type TierGuide = {
  formulaSummary: string;
  formulaDisplay: string;
  variables: EmissionVariableDefinition[];
};

export type ResolutionGuide = {
  badge: string;
  description: string;
};

type TierUiDefinition = {
  summationGroups?: string[][];
};

export const DEFAULT_INPUT_ROW: InputRow = { lineNo: 1, value: "" };

const TIER_UI_DEFINITIONS: Record<string, TierUiDefinition> = {};

const CACO3_FACTOR = 0.43971;
const MGCO3_FACTOR = 0.52197;
const CAMGCO32_FACTOR = 0.47732;
const FECO3_FACTOR = 0.37987;
const CAFE_MG_MN_CO32_FACTOR = 0.40822;
const MNCO3_FACTOR = 0.38286;
const NA2CO3_FACTOR = 0.41492;
const SR_CAO_DEFAULT = 0.785;
const SR_CAO_MGO_DEFAULT = 0.913;
const CEMENT_EFC_DEFAULT = 0.4397;
const CEMENT_EFCL_DEFAULT = 0.51;
const CEMENT_CFCKD_DEFAULT = 1.02;
const HIGH_CALCIUM_CONTENT_DEFAULT = 0.95;
const DOLOMITIC_HIGH_CONTENT_DEFAULT = 0.95;
const DOLOMITIC_LOW_CONTENT_DEFAULT = 0.85;
const HYDRAULIC_CONTENT_DEFAULT = 0.75;
const LIME_CF_LKD_DEFAULT = 1.02;
const HYDRATED_LIME_CORRECTION_DEFAULT = 0.97;

export function stringOf(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function tierUiDefinition(category: EmissionCategoryItem | null, tier: number) {
  const subCode = stringOf(category?.subCode).toUpperCase();
  return TIER_UI_DEFINITIONS[`${subCode}:${tier}`];
}

export function numberOf(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ratioOf(value: unknown) {
  const parsed = numberOf(value);
  if (parsed >= 1 && parsed <= 100) {
    return parsed / 100;
  }
  return parsed;
}

export function arrayOf<T = Record<string, unknown>>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isYes(value: unknown) {
  return stringOf(value).toUpperCase() === "Y";
}

export function isRepeatableVariable(variable: EmissionVariableDefinition) {
  return isYes(variable.isRepeatable ?? variable.repeatable);
}

export function isRequiredVariable(variable: EmissionVariableDefinition) {
  return isYes(variable.isRequired ?? variable.required);
}

export function variableCodeOf(variable: EmissionVariableDefinition) {
  return stringOf(variable.varCode).toUpperCase();
}

function normalizeToken(value: string) {
  return stringOf(value)
    .toUpperCase()
    .replace(/ /g, "")
    .replace(/_/g, "")
    .replace(/-/g, "")
    .replace(/·/g, "")
    .replace(/\./g, "")
    .replace(/내지/g, "");
}

export function carbonateFactorOf(value: string) {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return "";
  }
  if (normalized.includes("CACO3") || normalized.includes("방해석") || normalized.includes("아라고나이트") || normalized.includes("CALCITE") || normalized.includes("ARAGONITE")) {
    return String(CACO3_FACTOR);
  }
  if (normalized.includes("MGCO3") || normalized.includes("마그네사이트") || normalized.includes("MAGNESITE")) {
    return String(MGCO3_FACTOR);
  }
  if (normalized.includes("CAMG(CO3)2") || normalized.includes("백운석") || normalized.includes("DOLOMITE")) {
    return String(CAMGCO32_FACTOR);
  }
  if (normalized.includes("FECO3") || normalized.includes("능철광") || normalized.includes("SIDERITE")) {
    return String(FECO3_FACTOR);
  }
  if (normalized.includes("CA(FE,MG,MN)(CO3)2") || normalized.includes("CAFEMGMNCO32") || normalized.includes("철백운석") || normalized.includes("ANKERITE")) {
    return String(CAFE_MG_MN_CO32_FACTOR);
  }
  if (normalized.includes("MNCO3") || normalized.includes("망간광")) {
    return String(MNCO3_FACTOR);
  }
  if (normalized.includes("NA2CO3") || normalized.includes("탄산나트륨") || normalized.includes("소다회") || normalized.includes("SODAASH")) {
    return String(NA2CO3_FACTOR);
  }
  return "";
}

export function variableOptions(variable: EmissionVariableDefinition, currentValue: string) {
  const options = arrayOf<Record<string, unknown>>(variable.options).map((option) => ({
    code: stringOf(option.code),
    label: stringOf(option.label) || stringOf(option.code)
  })).filter((option) => option.code);
  if (currentValue && !options.some((option) => option.code === currentValue)) {
    options.unshift({
      code: currentValue,
      label: `${currentValue}${options.length > 0 ? " (현재값)" : ""}`
    });
  }
  return options;
}

export function buildSummationGroups(category: EmissionCategoryItem | null, tier: number, variables: EmissionVariableDefinition[]) {
  const metadataGroups = new Map<string, string[]>();
  variables.forEach((variable) => {
    if (!isRepeatableVariable(variable)) {
      return;
    }
    const groupKey = stringOf(variable.repeatGroupKey);
    if (!groupKey) {
      return;
    }
    const nextCodes = metadataGroups.get(groupKey) || [];
    nextCodes.push(variableCodeOf(variable));
    metadataGroups.set(groupKey, nextCodes);
  });
  if (metadataGroups.size > 0) {
    return Array.from(metadataGroups.values()).filter((group) => group.length > 1);
  }
  const variableCodes = new Set(variables.filter((variable) => isRepeatableVariable(variable)).map((variable) => variableCodeOf(variable)));
  return (tierUiDefinition(category, tier)?.summationGroups || [])
    .map((group) => group.filter((code) => variableCodes.has(code)))
    .filter((group) => group.length > 1);
}

export function sortVariableDefinitions(variables: EmissionVariableDefinition[]) {
  return variables.slice().sort((left, right) => numberOf(left.sortOrder) - numberOf(right.sortOrder));
}

export function buildTierGuide(variables: EmissionVariableDefinition[], formulaSummary: unknown, formulaDisplay?: unknown): TierGuide {
  return {
    formulaSummary: stringOf(formulaSummary),
    formulaDisplay: stringOf(formulaDisplay),
    variables: sortVariableDefinitions(variables)
  };
}

export function isDerivedCarbonateFactorVariable(category: EmissionCategoryItem | null, tier: number, variable: EmissionVariableDefinition) {
  if (isYes(variable.derivedYn)) {
    return true;
  }
  void category;
  void tier;
  return false;
}

export function visibleVariablesForStep(category: EmissionCategoryItem | null, tier: number, variables: EmissionVariableDefinition[]) {
  return variables.filter((variable) => {
    if (isDerivedCarbonateFactorVariable(category, tier, variable)) {
      return false;
    }
    return true;
  });
}

export function displayVariableName(_category: EmissionCategoryItem | null, _tier: number, variable: EmissionVariableDefinition) {
  const backendDisplayName = stringOf(variable.displayName);
  if (backendDisplayName) {
    return backendDisplayName;
  }
  return stringOf(variable.varName) || stringOf(variable.varCode);
}

export function displayVariableCode(_category: EmissionCategoryItem | null, _tier: number, variable: EmissionVariableDefinition) {
  const backendDisplayCode = stringOf(variable.displayCode);
  if (backendDisplayCode) {
    return backendDisplayCode;
  }
  return stringOf(variable.varCode);
}

function limeTypeTokenForRow(inputs: InputMap, rowIndex: number) {
  return normalizeToken(inputs.LIME_TYPE?.[rowIndex]?.value || "");
}

export function resolveLimeTier2Type(inputs: InputMap, rowIndex: number) {
  const limeType = limeTypeTokenForRow(inputs, rowIndex);
  if (!limeType) {
    return "BLANK";
  }
  if (limeType === "A" || limeType.includes("고칼슘") || limeType.includes("HIGHCALCIUM")) {
    return "HIGH_CALCIUM";
  }
  if (limeType === "C" || limeType.includes("수경성") || limeType.includes("HYDRAULIC")) {
    return "HYDRAULIC";
  }
  if (limeType.includes("개도국") || limeType.includes("LOW") || limeType.includes("0.77")) {
    return "DOLOMITIC_LOW";
  }
  if (limeType.includes("선진국") || limeType.includes("HIGH") || limeType.includes("0.86")) {
    return "DOLOMITIC_HIGH";
  }
  if (limeType === "B" || limeType.includes("고토") || limeType.includes("DOLOMITIC")) {
    return "DOLOMITIC";
  }
  return "BLANK";
}

function normalizeConditionToken(value: string) {
  return stringOf(value)
    .toUpperCase()
    .replace(/ /g, "")
    .replace(/-/g, "")
    .replace(/·/g, "")
    .replace(/\./g, "")
    .replace(/내지/g, "");
}

function resolveConditionValue(category: EmissionCategoryItem | null, tier: number, inputs: InputMap, rowIndex: number, operand: string) {
  const normalizedOperand = stringOf(operand).trim().toUpperCase();
  if (normalizedOperand === "LIME_TYPE" && isLimeTier2Scope(category, tier)) {
    return resolveLimeTier2Type(inputs, rowIndex);
  }
  if (normalizedOperand === "BLANK") {
    return "BLANK";
  }
  return normalizeConditionToken(rowValue(inputs, normalizedOperand, rowIndex)) || "BLANK";
}

function parseConditionRule(rule: string) {
  const normalized = stringOf(rule).replace(/\s+/g, " ").trim();
  const upper = normalized.toUpperCase();
  if (upper.includes(" NOTIN ")) {
    const [left, right] = upper.split(" NOTIN ", 2);
    return { left, operator: "NOTIN" as const, values: right.split("|").map((item) => item.trim()).filter(Boolean) };
  }
  if (upper.includes(" IN ")) {
    const [left, right] = upper.split(" IN ", 2);
    return { left, operator: "IN" as const, values: right.split("|").map((item) => item.trim()).filter(Boolean) };
  }
  if (upper.includes("!=")) {
    const [left, right] = upper.split("!=", 2);
    return { left, operator: "NE" as const, values: [right.trim()] };
  }
  if (upper.includes("=")) {
    const [left, right] = upper.split("=", 2);
    return { left, operator: "EQ" as const, values: [right.trim()] };
  }
  return null;
}

function evaluateConditionRule(category: EmissionCategoryItem | null, tier: number, inputs: InputMap, rowIndex: number, rule: string) {
  const parsed = parseConditionRule(rule);
  if (!parsed) {
    return false;
  }
  const leftValue = resolveConditionValue(category, tier, inputs, rowIndex, parsed.left);
  const normalizedValues = parsed.values.map((value) => normalizeConditionToken(value));
  if (parsed.operator === "NOTIN") {
    return !normalizedValues.includes(leftValue);
  }
  if (parsed.operator === "IN") {
    return normalizedValues.includes(leftValue);
  }
  if (parsed.operator === "NE") {
    return leftValue !== normalizedValues[0];
  }
  return leftValue === normalizedValues[0];
}

function rowValue(inputs: InputMap, code: string, rowIndex: number) {
  return inputs[code]?.[rowIndex]?.value || "";
}

function defaultLimeTier2Content(limeType: string) {
  if (limeType === "HIGH_CALCIUM") {
    return HIGH_CALCIUM_CONTENT_DEFAULT;
  }
  if (limeType === "HYDRAULIC") {
    return HYDRAULIC_CONTENT_DEFAULT;
  }
  if (limeType === "DOLOMITIC_LOW") {
    return DOLOMITIC_LOW_CONTENT_DEFAULT;
  }
  if (limeType === "DOLOMITIC_HIGH" || limeType === "DOLOMITIC") {
    return DOLOMITIC_HIGH_CONTENT_DEFAULT;
  }
  return 0;
}

export function limeTier2DerivedSummary(en: boolean, inputs: InputMap, rowIndex: number) {
  const limeType = resolveLimeTier2Type(inputs, rowIndex);
  const mli = numberOf(rowValue(inputs, "MLI", rowIndex));
  const cao = ratioOf(rowValue(inputs, "CAO_CONTENT", rowIndex));
  const caoMgoRaw = ratioOf(rowValue(inputs, "CAO_MGO_CONTENT", rowIndex));
  const md = numberOf(rowValue(inputs, "MD", rowIndex));
  const cd = ratioOf(rowValue(inputs, "CD", rowIndex));
  const fd = ratioOf(rowValue(inputs, "FD", rowIndex));
  const hydratedYn = stringOf(rowValue(inputs, "HYDRATED_LIME_PRODUCTION_YN", rowIndex)).toUpperCase();
  const x = ratioOf(rowValue(inputs, "X", rowIndex));
  const y = ratioOf(rowValue(inputs, "Y", rowIndex));

  const usesCaoMgo = limeType === "DOLOMITIC" || limeType === "DOLOMITIC_HIGH" || limeType === "DOLOMITIC_LOW";
  const content = usesCaoMgo
    ? (caoMgoRaw > 0 ? caoMgoRaw : defaultLimeTier2Content(limeType))
    : (cao > 0 ? cao : defaultLimeTier2Content(limeType));
  const ef = (usesCaoMgo ? SR_CAO_MGO_DEFAULT : SR_CAO_DEFAULT) * content;
  const cf = md > 0 && cd > 0 && fd > 0 && mli > 0 ? 1 + (md / mli) * cd * fd : LIME_CF_LKD_DEFAULT;
  const ch = hydratedYn === "N" ? 1 : hydratedYn === "Y" ? (x > 0 && y > 0 ? 1 - (x * y) : HYDRATED_LIME_CORRECTION_DEFAULT) : 1;
  const efA = SR_CAO_DEFAULT * (cao > 0 ? cao : defaultLimeTier2Content(limeType));
  const combinedForB = caoMgoRaw > 0 ? caoMgoRaw : defaultLimeTier2Content(limeType);
  const efB = SR_CAO_MGO_DEFAULT * combinedForB;
  const efC = SR_CAO_DEFAULT * (cao > 0 ? cao : defaultLimeTier2Content(limeType));

  return {
    ef,
    efAText: `${en ? "EF_lime,a" : "EF석회,a"} = ${SR_CAO_DEFAULT} × ${usesCaoMgo ? (cao > 0 ? cao.toFixed(4) : "CaO") : content.toFixed(4)} = ${efA.toFixed(6)}`,
    efBText: `${en ? "EF_lime,b" : "EF석회,b"} = ${SR_CAO_MGO_DEFAULT} × ${combinedForB.toFixed(4)} = ${efB.toFixed(6)}`,
    efCText: `${en ? "EF_lime,c" : "EF석회,c"} = ${SR_CAO_DEFAULT} × ${content.toFixed(4)} = ${efC.toFixed(6)}`,
    efText: usesCaoMgo
      ? `${en ? "Selected EF_lime,i" : "적용 EF석회,i"} = ${en ? "EF_lime,b" : "EF석회,b"} = ${ef.toFixed(6)}`
      : `${en ? "Selected EF_lime,i" : "적용 EF석회,i"} = ${limeType === "HYDRAULIC" ? (en ? "EF_lime,c" : "EF석회,c") : (en ? "EF_lime,a" : "EF석회,a")} = ${ef.toFixed(6)}`,
    cfText: md > 0 && cd > 0 && fd > 0 && mli > 0
      ? `${en ? "CF_lkd,i" : "CF_lkd,i"} = 1 + (${md} / ${mli}) × ${cd.toFixed(4)} × ${fd.toFixed(4)} = ${cf.toFixed(6)}`
      : `${en ? "CF_lkd,i" : "CF_lkd,i"} = ${LIME_CF_LKD_DEFAULT.toFixed(2)} ${en ? "(default)" : "(기본값)"}`,
    chText: hydratedYn === "N"
      ? `${en ? "C_h,i" : "C_h,i"} = 1.00 ${en ? "(hydrated lime not produced)" : "(수화석회 생산 안 함)"}`
      : hydratedYn === "Y"
        ? (x > 0 && y > 0
          ? `${en ? "C_h,i" : "C_h,i"} = 1 - (${x.toFixed(4)} × ${y.toFixed(4)}) = ${ch.toFixed(6)}`
          : `${en ? "C_h,i" : "C_h,i"} = ${HYDRATED_LIME_CORRECTION_DEFAULT.toFixed(2)} ${en ? "(hydrated lime default)" : "(수화석회 기본값)"}`)
        : `${en ? "C_h,i" : "C_h,i"} = 1.00 ${en ? "(select production status)" : "(생산 여부 선택 전)"}`
  };
}

export function cementTier2DerivedSummary(en: boolean, inputs: InputMap) {
  const mcl = numberOf(rowValue(inputs, "MCL", 0));
  const md = numberOf(rowValue(inputs, "MD", 0));
  const cd = ratioOf(rowValue(inputs, "CD", 0));
  const fd = ratioOf(rowValue(inputs, "FD", 0));
  const efc = numberOf(rowValue(inputs, "EFC", 0)) || CEMENT_EFC_DEFAULT;
  const efcl = numberOf(rowValue(inputs, "EFCL", 0)) || CEMENT_EFCL_DEFAULT;
  const directCfckd = numberOf(rowValue(inputs, "CFCKD", 0));
  const canDeriveCfckd = mcl > 0 && md > 0 && cd > 0 && fd > 0 && efcl > 0;
  const derivedCfckd = canDeriveCfckd ? 1 + (md / mcl) * cd * fd * (efc / efcl) : CEMENT_CFCKD_DEFAULT;
  const appliedCfckd = directCfckd > 0 ? directCfckd : derivedCfckd;
  const total = mcl > 0 && efcl > 0 ? mcl * efcl * appliedCfckd : 0;

  return {
    efcText: `${en ? "EFc" : "EFc"} = ${efc.toFixed(4)}${numberOf(rowValue(inputs, "EFC", 0)) > 0 ? "" : ` ${en ? "(default/stored fallback)" : "(기본/저장 fallback)"}`}`,
    efclText: `${en ? "EFcl" : "EFcl"} = ${efcl.toFixed(4)}${numberOf(rowValue(inputs, "EFCL", 0)) > 0 ? "" : ` ${en ? "(default/stored fallback)" : "(기본/저장 fallback)"}`}`,
    cfckdText: directCfckd > 0
      ? `${en ? "CFckd" : "CFckd"} = ${directCfckd.toFixed(6)} ${en ? "(direct input)" : "(직접 입력값)"}`
      : canDeriveCfckd
        ? `${en ? "CFckd" : "CFckd"} = 1 + (${md} / ${mcl}) × ${cd.toFixed(4)} × ${fd.toFixed(4)} × (${efc.toFixed(4)} / ${efcl.toFixed(4)}) = ${derivedCfckd.toFixed(6)}`
        : `${en ? "CFckd" : "CFckd"} = ${CEMENT_CFCKD_DEFAULT.toFixed(2)} ${en ? "(default/stored fallback)" : "(기본/저장 fallback)"}`,
    totalText: total > 0
      ? `${en ? "CO2" : "CO2"} = ${mcl} × ${efcl.toFixed(4)} × ${appliedCfckd.toFixed(6)} = ${total.toFixed(6)}`
      : (en ? "Enter Mcl and related factors to preview CO2." : "Mcl과 관련 계수를 입력하면 CO2 미리보기가 표시됩니다."),
    canDeriveCfckd
  };
}

export function isLimeTier2Scope(category: EmissionCategoryItem | null, tier: number) {
  return stringOf(category?.subCode).toUpperCase() === "LIME" && tier === 2;
}

export function isCementTier2Scope(category: EmissionCategoryItem | null, tier: number) {
  return stringOf(category?.subCode).toUpperCase() === "CEMENT" && tier === 2;
}

export function resolutionGuideForVariable(en: boolean, category: EmissionCategoryItem | null, tier: number, variable: EmissionVariableDefinition): ResolutionGuide | null {
  const subCode = stringOf(category?.subCode).toUpperCase();
  const code = variableCodeOf(variable);

  if (subCode === "CEMENT" && tier === 1 && code === "EFCLC") {
    return {
      badge: en ? "Stored/Default Fallback" : "저장/기본 대체",
      description: en
        ? "If EFclc is omitted, the calculator uses a stored coefficient first and then the documented default."
        : "EFclc가 비어 있으면 저장 계수를 우선 사용하고, 없으면 문서 기본값을 적용합니다."
    };
  }

  if (subCode === "CEMENT" && tier === 2) {
    if (code === "EFC" || code === "EFCL") {
      return {
        badge: en ? "Stored/Default Fallback" : "저장/기본 대체",
        description: en
          ? `${code} falls back to a stored coefficient and then the documented default when direct input is missing.`
          : `${code}는 직접 입력이 없으면 저장 계수, 그다음 문서 기본값으로 대체됩니다.`
      };
    }
    if (code === "CFCKD") {
      return {
        badge: en ? "Derived Or Fallback" : "유도식/대체값",
        description: en
          ? "CFckd is derived from Md, Cd, Fd, Mcl, EFc, and EFcl when available. Otherwise it switches to a stored coefficient or the default 1.02."
          : "CFckd는 Md, Cd, Fd, Mcl, EFc, EFcl이 있으면 유도식으로 계산하고, 부족하면 저장 계수 또는 기본값 1.02로 전환됩니다."
      };
    }
    if (code === "MD" || code === "CD" || code === "FD") {
      return {
        badge: en ? "Derivation Input" : "유도식 입력",
        description: en
          ? "This value is used to derive CFckd. If it is omitted, the calculator falls back to stored/default CFckd handling."
          : "이 값은 CFckd 유도식에 사용됩니다. 비어 있으면 계산기는 저장/기본 CFckd 흐름으로 전환됩니다."
      };
    }
  }

  if (subCode === "CEMENT" && tier === 3) {
    if (code === "CARBONATE_TYPE" || code === "RAW_MATERIAL_CARBONATE_TYPE" || code === "LKD_CARBONATE_TYPE") {
      return {
        badge: en ? "Type Mapping" : "유형 매핑",
        description: en
          ? "Selecting the carbonate type maps the emission factor from the document table."
          : "탄산염 유형을 선택하면 문서 기준 표에서 배출계수를 매핑합니다."
      };
    }
    if (code === "EFD") {
      return {
        badge: en ? "Mapped/Stored/Default" : "매핑/저장/기본",
        description: en
          ? "EFd can come from direct input, carbonate-type mapping, a stored coefficient, or the documented default."
          : "EFd는 직접 입력, 탄산염 유형 매핑, 저장 계수, 문서 기본값 순으로 적용될 수 있습니다."
      };
    }
  }

  if (subCode === "LIME" && tier === 1 && code === "LIME_TYPE") {
    return {
      badge: en ? "Type Or Fallback" : "유형/대체값",
      description: en
        ? "The selected lime type determines EF_lime,i. If the type is blank, the calculator uses a stored coefficient or the default."
        : "선택한 석회 유형이 EF석회,i를 결정합니다. 유형이 비어 있으면 저장 계수 또는 기본값을 사용합니다."
    };
  }

  if (subCode === "LIME" && tier === 2) {
    if (["LIME_TYPE", "CAO_CONTENT", "CAO_MGO_CONTENT", "MD", "CD", "FD", "HYDRATED_LIME_PRODUCTION_YN", "X", "Y"].includes(code)) {
      return {
        badge: en ? "Derived Or Fallback" : "유도식/대체값",
        description: en
          ? "This input participates in lime Tier 2 factor or correction derivation. Missing values can switch the calculator to mapped, stored, or documented defaults."
          : "이 입력값은 석회 Tier 2 계수 또는 보정항 유도식에 참여합니다. 값이 부족하면 매핑값, 저장 계수, 문서 기본값으로 전환될 수 있습니다."
      };
    }
  }

  if (subCode === "LIME" && tier === 3) {
    if (code === "CARBONATE_TYPE" || code === "LKD_CARBONATE_TYPE") {
      return {
        badge: en ? "Type Mapping" : "유형 매핑",
        description: en
          ? "Selecting the carbonate type maps the emission factor from the document table."
          : "탄산염 유형을 선택하면 문서 기준 표에서 배출계수를 매핑합니다."
      };
    }
    if (code === "EFD") {
      return {
        badge: en ? "Mapped/Stored/Default" : "매핑/저장/기본",
        description: en
          ? "EFd can come from direct input, carbonate-type mapping, a stored coefficient, or the documented default."
          : "EFd는 직접 입력, 탄산염 유형 매핑, 저장 계수, 문서 기본값 순으로 적용될 수 있습니다."
      };
    }
  }

  return null;
}

export function buildVariableSections(
  en: boolean,
  _category: EmissionCategoryItem | null,
  _tier: number,
  variables: EmissionVariableDefinition[],
  sectionDefinitions: Array<Record<string, unknown>> = []
): VariableSection[] {
  const metadataSections = new Map<string, VariableSection>();
  variables.forEach((variable) => {
    const sectionId = stringOf(variable.sectionId);
    if (!sectionId) {
      return;
    }
    const existing = metadataSections.get(sectionId);
    const code = variableCodeOf(variable);
    if (existing) {
      existing.codes.push(code);
      return;
    }
    metadataSections.set(sectionId, {
      id: sectionId,
      order: numberOf(variable.sectionOrder),
      title: stringOf(variable.sectionTitle) || (en ? "Variable Inputs" : "변수 입력"),
      description: stringOf(variable.sectionDescription),
      formula: stringOf(variable.sectionFormula),
      previewType: stringOf(variable.sectionPreviewType),
      relatedFactorCodes: stringOf(variable.sectionRelatedFactorCodes),
      codes: [code]
    });
  });
  sectionDefinitions.forEach((sectionDefinition, index) => {
    const sectionId = stringOf(sectionDefinition.sectionId);
    if (!sectionId) {
      return;
    }
    const existing = metadataSections.get(sectionId);
    const nextSection: VariableSection = existing || {
      id: sectionId,
      order: numberOf(sectionDefinition.sectionOrder) || ((index + 1) * 10),
      title: stringOf(sectionDefinition.sectionTitle) || (en ? "Variable Inputs" : "변수 입력"),
      description: stringOf(sectionDefinition.sectionDescription),
      formula: stringOf(sectionDefinition.sectionFormula),
      previewType: stringOf(sectionDefinition.sectionPreviewType),
      relatedFactorCodes: stringOf(sectionDefinition.sectionRelatedFactorCodes),
      codes: []
    };
    nextSection.order = numberOf(sectionDefinition.sectionOrder) || nextSection.order;
    nextSection.title = stringOf(sectionDefinition.sectionTitle) || nextSection.title;
    nextSection.description = stringOf(sectionDefinition.sectionDescription) || nextSection.description;
    nextSection.formula = stringOf(sectionDefinition.sectionFormula) || nextSection.formula;
    nextSection.previewType = stringOf(sectionDefinition.sectionPreviewType) || nextSection.previewType;
    nextSection.relatedFactorCodes = stringOf(sectionDefinition.sectionRelatedFactorCodes) || nextSection.relatedFactorCodes;
    metadataSections.set(sectionId, nextSection);
  });
  if (metadataSections.size > 0) {
    return Array.from(metadataSections.values()).sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  }

  const repeatSections = new Map<string, VariableSection>();
  const ungroupedCodes: string[] = [];
  variables.forEach((variable) => {
    const code = variableCodeOf(variable);
    const groupKey = stringOf(variable.repeatGroupKey);
    if (!groupKey || !isRepeatableVariable(variable)) {
      ungroupedCodes.push(code);
      return;
    }
    const existing = repeatSections.get(groupKey);
    if (existing) {
      existing.codes.push(code);
      return;
    }
    repeatSections.set(groupKey, {
      id: groupKey,
      order: repeatSections.size + 1,
      title: en ? "Grouped Inputs" : "묶음 입력",
      description: en
        ? "Repeated variables in the same calculation term are grouped together."
        : "같은 계산항에 반복 사용되는 변수를 함께 묶어 입력합니다.",
      formula: "",
      previewType: "",
      relatedFactorCodes: "",
      codes: [code]
    });
  });
  if (repeatSections.size > 0) {
    return [
      ...Array.from(repeatSections.values()),
      ...(ungroupedCodes.length > 0 ? [{
        id: "default",
        order: repeatSections.size + 99,
        title: en ? "Additional Inputs" : "추가 입력",
        description: en ? "Enter the remaining variables required by the selected formula." : "선택한 계산식의 나머지 변수를 입력합니다.",
        formula: "",
        previewType: "",
        relatedFactorCodes: "",
        codes: ungroupedCodes
      }] : [])
    ];
  }
  return [];
}

export function isConditionallyDisabledVariable(category: EmissionCategoryItem | null, tier: number, inputs: InputMap, variable: EmissionVariableDefinition | null, rowIndex: number) {
  if (!variable) {
    return false;
  }
  const visibleWhen = stringOf(variable.visibleWhen);
  if (visibleWhen && !evaluateConditionRule(category, tier, inputs, rowIndex, visibleWhen)) {
    return true;
  }
  const disabledWhen = stringOf(variable.disabledWhen);
  if (disabledWhen && evaluateConditionRule(category, tier, inputs, rowIndex, disabledWhen)) {
    return true;
  }
  return false;
}

export function shouldShowConditionalVariable(category: EmissionCategoryItem | null, tier: number, inputs: InputMap, variable: EmissionVariableDefinition | null) {
  if (!variable) {
    return true;
  }
  const visibleWhen = stringOf(variable.visibleWhen);
  if (!visibleWhen) {
    return true;
  }
  const anchorRows = inputs.LIME_TYPE?.length || inputs[variableCodeOf(variable)]?.length || 1;
  return Array.from({ length: Math.max(anchorRows, 1) }, (_, rowIndex) => (
    evaluateConditionRule(category, tier, inputs, rowIndex, visibleWhen)
  )).some(Boolean);
}

export function isLimeTier2SupplementalVariable(_category: EmissionCategoryItem | null, _tier: number, variable: EmissionVariableDefinition) {
  if (isYes(variable.supplementalYn)) {
    return true;
  }
  return false;
}

export function limeTier2VariableHint(_en: boolean, _category: EmissionCategoryItem | null, _tier: number, variable: EmissionVariableDefinition) {
  const backendHint = stringOf(variable.uiHint);
  if (backendHint) {
    return backendHint;
  }
  return "";
}

export function tier2FieldPlaceholder(en: boolean, category: EmissionCategoryItem | null, tier: number, inputs: InputMap, varCode: string, rowIndex: number, unit: string) {
  void category;
  void tier;
  void inputs;
  void varCode;
  void rowIndex;
  if (unit) {
    return unit || (en ? "Enter value" : "값 입력");
  }
  return en ? "Enter value" : "값 입력";
}

export function majorCategoryKey(category: EmissionCategoryItem | null | undefined) {
  return `${stringOf(category?.majorCode)}::${stringOf(category?.majorName)}`;
}

export function majorCategoryLabel(option: MajorCategoryOption | null, en: boolean) {
  if (!option) {
    return en ? "Not selected" : "미선택";
  }
  return `${option.majorName}${option.majorCode ? ` (${option.majorCode})` : ""}`;
}

export function buildMajorCategoryOptions(categories: EmissionCategoryItem[]) {
  const deduped = new Map<string, MajorCategoryOption>();
  categories.forEach((category) => {
    const key = majorCategoryKey(category);
    if (!key || deduped.has(key)) {
      return;
    }
    deduped.set(key, {
      key,
      majorCode: stringOf(category.majorCode),
      majorName: stringOf(category.majorName)
    });
  });
  return Array.from(deduped.values()).sort((left, right) => left.majorName.localeCompare(right.majorName, "ko"));
}

export function buildEmptyInputs(variables: EmissionVariableDefinition[]) {
  const next: InputMap = {};
  variables.forEach((variable) => {
    const code = stringOf(variable.varCode);
    if (!code) {
      return;
    }
    next[code] = [DEFAULT_INPUT_ROW];
  });
  return next;
}

export function hydrateInputs(variables: EmissionVariableDefinition[], values: Array<Record<string, unknown>>) {
  const grouped = new Map<string, InputRow[]>();
  values.forEach((value) => {
    const code = stringOf(value.varCode);
    if (!code) {
      return;
    }
    const rows = grouped.get(code) || [];
    rows.push({
      lineNo: Math.max(1, numberOf(value.lineNo) || rows.length + 1),
      value: value.valueNum == null ? stringOf(value.valueText) : String(value.valueNum)
    });
    grouped.set(code, rows);
  });

  const next: InputMap = {};
  variables.forEach((variable) => {
    const code = stringOf(variable.varCode);
    if (!code) {
      return;
    }
    const rows = (grouped.get(code) || []).sort((left, right) => left.lineNo - right.lineNo);
    next[code] = rows.length > 0 ? rows : [DEFAULT_INPUT_ROW];
  });
  return next;
}

export function syncLineNumbers(rows: InputRow[]) {
  return rows.map((row, index) => ({ ...row, lineNo: index + 1 }));
}

export function alignedRowsForRemoval(rows: InputRow[], rowIndex: number) {
  const nextRows = syncLineNumbers(rows.filter((_, index) => index !== rowIndex));
  return nextRows.length > 0 ? nextRows : [DEFAULT_INPUT_ROW];
}
