export const UNIT_OPTIONS = [
  { value: "carat", label: "carat | 캐럿" },
  { value: "cg", label: "cg | 센티그램" },
  { value: "ct", label: "ct | 캐럿 (중복)" },
  { value: "cwt", label: "cwt | 헌드레드웨이트" },
  { value: "dag", label: "dag | 데카그램" },
  { value: "dg", label: "dg | 데시그램" },
  { value: "dr (Av)", label: "dr (Av) | 드람 (상형)" },
  { value: "dwt", label: "dwt | 페니웨이트" },
  { value: "g", label: "g | 그램" },
  { value: "gr", label: "gr | 그레인" },
  { value: "hg", label: "hg | 헥토그램" },
  { value: "kg", label: "kg | 킬로그램" },
  { value: "kg SWU", label: "kg SWU | 킬로그램 분리작업단위" },
  { value: "kt", label: "kt | 킬로톤" },
  { value: "kW", label: "kW | 킬로와트" },
  { value: "lb av", label: "lb av | 파운드 (상형)" },
  { value: "long tn", label: "long tn | 롱톤 (영국 톤)" },
  { value: "mg", label: "mg | 밀리그램" },
  { value: "Mg", label: "Mg | 메가그램 (톤)" },
  { value: "MJ", label: "MJ | 메가줄" },
  { value: "m3", label: "m3 | 세제곱미터" },
  { value: "Mt", label: "Mt | 메가톤" },
  { value: "ng", label: "ng | 나노그램" },
  { value: "oz av", label: "oz av | 온스 (상형)" },
  { value: "oz t", label: "oz t | 온스 (트로이)" },
  { value: "pg", label: "pg | 피코그램" },
  { value: "sh tn", label: "sh tn | 쇼트톤 (미국 톤)" },
  { value: "t", label: "t | 톤" },
  { value: "ug", label: "ug | 마이크로그램" }
] as const;

export const UNIT_CATEGORY_OPTIONS = [
  { value: "MASS", label: "질량" },
  { value: "ENERGY", label: "에너지" },
  { value: "VOLUME", label: "부피" },
  { value: "POWER", label: "전력" },
  { value: "OTHER", label: "기타" }
] as const;

export const UNIT_OPTION_VALUES = new Set<string>(UNIT_OPTIONS.map((option) => option.value));

const MASS_UNIT_VALUES = new Set([
  "carat",
  "cg",
  "ct",
  "cwt",
  "dag",
  "dg",
  "dr (Av)",
  "dwt",
  "g",
  "gr",
  "hg",
  "kg",
  "kg SWU",
  "kt",
  "lb av",
  "long tn",
  "mg",
  "Mg",
  "Mt",
  "ng",
  "oz av",
  "oz t",
  "pg",
  "sh tn",
  "t",
  "ug"
]);

const ENERGY_UNIT_VALUES = new Set(["MJ"]);
const VOLUME_UNIT_VALUES = new Set(["m3"]);
const POWER_UNIT_VALUES = new Set(["kW"]);

export const UNIT_VALUE_ALIASES: Record<string, string> = {
  ton: "t",
  "t/yr": "t",
  "ton/yr": "t",
  "kg/yr": "kg",
  "mg/yr": "mg",
  "ug/yr": "ug",
  "g/yr": "g",
  "pg/yr": "pg",
  "ng/yr": "ng",
  kw: "kW",
  "kw/yr": "kW",
  mj: "MJ",
  "mj/yr": "MJ",
  "m3/yr": "m3"
};

export function normalizeUnitValue(value: string) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (UNIT_OPTION_VALUES.has(raw)) {
    return raw;
  }
  const codeOnly = raw.includes("|") ? raw.split("|")[0].trim() : raw;
  if (UNIT_OPTION_VALUES.has(codeOnly)) {
    return codeOnly;
  }
  const normalizedAlias = UNIT_VALUE_ALIASES[raw] || UNIT_VALUE_ALIASES[codeOnly] || UNIT_VALUE_ALIASES[raw.toLowerCase()] || UNIT_VALUE_ALIASES[codeOnly.toLowerCase()];
  if (normalizedAlias && UNIT_OPTION_VALUES.has(normalizedAlias)) {
    return normalizedAlias;
  }
  return raw;
}

export function resolveUnitCategory(value: string) {
  const normalized = normalizeUnitValue(value);
  if (!normalized) {
    return "";
  }
  if (MASS_UNIT_VALUES.has(normalized)) {
    return "MASS";
  }
  if (ENERGY_UNIT_VALUES.has(normalized)) {
    return "ENERGY";
  }
  if (VOLUME_UNIT_VALUES.has(normalized)) {
    return "VOLUME";
  }
  if (POWER_UNIT_VALUES.has(normalized)) {
    return "POWER";
  }
  return "OTHER";
}

export function getUnitOptionsByCategory(category: string) {
  const normalizedCategory = String(category || "").trim();
  if (!normalizedCategory) {
    return UNIT_OPTIONS;
  }
  return UNIT_OPTIONS.filter((option) => resolveUnitCategory(option.value) === normalizedCategory);
}

export function isMappedUnitValue(value: string) {
  const normalized = normalizeUnitValue(value);
  return Boolean(normalized) && UNIT_OPTION_VALUES.has(normalized);
}

export function hasUnitMappingIssue(value: string) {
  const normalized = normalizeUnitValue(value);
  return Boolean(normalized) && !UNIT_OPTION_VALUES.has(normalized);
}
