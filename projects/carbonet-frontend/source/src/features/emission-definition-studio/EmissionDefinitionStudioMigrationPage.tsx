import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  fetchEmissionDefinitionStudioPage,
  publishEmissionDefinitionDraft,
  saveEmissionDefinitionDraft
} from "../../lib/api/emission";
import { readBootstrappedEmissionDefinitionStudioPageData } from "../../lib/api/bootstrap";
import type {
  EmissionDefinitionDraftSaveResponse,
  EmissionDefinitionStudioPagePayload
} from "../../lib/api/emissionTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, MemberButton, PageStatusNotice } from "../admin-ui/common";
import { EmissionClassificationCatalogPanel } from "../emission-common/EmissionClassificationCatalogPanel";

function stringOf(row: Record<string, unknown> | undefined, key: string) {
  return row ? String(row[key] || "") : "";
}

function readInitialClassificationCode() {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("code") || "";
}

function localizedCardText(en: boolean, row: Record<string, string>, baseKey: string) {
  if (en && row[`${baseKey}En`]) {
    return String(row[`${baseKey}En`] || "");
  }
  return String(row[baseKey] || row[`${baseKey}En`] || "");
}

function normalizeVariableDefinitionRow(row?: Record<string, unknown> | null) {
  const options = Array.isArray(row?.options)
    ? (row?.options as Array<Record<string, unknown>>).map((option) => ({
      code: String(option.code || ""),
      label: String(option.label || ""),
      description: String(option.description || "")
    }))
    : [];
  return {
    varCode: String(row?.varCode || ""),
    varName: String(row?.varName || ""),
    displayName: String(row?.displayName || ""),
    unit: String(row?.unit || ""),
    inputType: String(row?.inputType || "NUMBER"),
    commonCodeId: String(row?.commonCodeId || ""),
    isRequired: String(row?.isRequired || ""),
    isRepeatable: String(row?.isRepeatable || ""),
    supplementalYn: String(row?.supplementalYn || ""),
    sectionId: String(row?.sectionId || ""),
    sectionTitle: String(row?.sectionTitle || ""),
    sectionDescription: String(row?.sectionDescription || ""),
    sectionFormula: String(row?.sectionFormula || ""),
    sectionPreviewType: String(row?.sectionPreviewType || ""),
    sectionRelatedFactorCodes: String(row?.sectionRelatedFactorCodes || ""),
    visibleWhen: String(row?.visibleWhen || ""),
    disabledWhen: String(row?.disabledWhen || ""),
    sectionOrder: Number(row?.sectionOrder || 0),
    sortOrder: Number(row?.sortOrder || 0),
    uiHint: String(row?.uiHint || ""),
    varDesc: String(row?.varDesc || ""),
    options
  };
}

function normalizeSectionDefinitionRow(row?: Record<string, unknown> | null) {
  return {
    sectionId: String(row?.sectionId || ""),
    sectionTitle: String(row?.sectionTitle || ""),
    sectionDescription: String(row?.sectionDescription || ""),
    sectionFormula: String(row?.sectionFormula || ""),
    sectionPreviewType: String(row?.sectionPreviewType || ""),
    sectionRelatedFactorCodes: String(row?.sectionRelatedFactorCodes || ""),
    sectionOrder: Number(row?.sectionOrder || 0),
    uiHint: String(row?.uiHint || "")
  };
}

type FormulaJoiner = "" | "+" | "-" | "×" | "÷";

type FormulaBlock = {
  id: string;
  joiner: FormulaJoiner;
  kind: "token" | "sum" | "group" | "fraction";
  token: string;
  iterator: string;
  items: FormulaBlock[];
  numerator: FormulaBlock[];
  denominator: FormulaBlock[];
};

type FormulaPreset = {
  id: string;
  label: string;
  labelEn: string;
  formula: string;
  blocks: FormulaBlock[];
};

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildFormulaBlock(kind: FormulaBlock["kind"], overrides?: Partial<FormulaBlock>): FormulaBlock {
  return {
    id: createId("formula-block"),
    joiner: overrides?.joiner || "",
    kind,
    token: overrides?.token || "",
    iterator: overrides?.iterator || "i",
    items: overrides?.items || [],
    numerator: overrides?.numerator || [],
    denominator: overrides?.denominator || []
  };
}

function cloneFormulaBlocks(items: FormulaBlock[]): FormulaBlock[] {
  return items.map((item) => ({
    ...item,
    id: createId("formula-block"),
    items: cloneFormulaBlocks(item.items || []),
    numerator: cloneFormulaBlocks(item.numerator || []),
    denominator: cloneFormulaBlocks(item.denominator || [])
  }));
}

function formatFormulaBlock(item: FormulaBlock): string {
  if (item.kind === "sum") {
    const nestedExpression = buildFormulaFromBlocks(item.items || []);
    if (!nestedExpression) {
      return "SUM( , i)";
    }
    return `SUM(${nestedExpression}${item.iterator.trim() ? `, ${item.iterator.trim()}` : ""})`;
  }
  if (item.kind === "group") {
    return `(${buildFormulaFromBlocks(item.items || [])})`;
  }
  if (item.kind === "fraction") {
    return `(${buildFormulaFromBlocks(item.numerator || [])}) ÷ (${buildFormulaFromBlocks(item.denominator || [])})`;
  }
  return item.token.trim();
}

function buildFormulaFromBlocks(items: FormulaBlock[]) {
  return items
    .map((item) => {
      const expression = formatFormulaBlock(item);
      if (!expression) {
        return "";
      }
      return `${item.joiner ? `${item.joiner} ` : ""}${expression}`;
    })
    .filter(Boolean)
    .join(" ")
    .trim();
}

function normalizeFormulaBlocks(items: Array<Record<string, unknown>> | null | undefined): FormulaBlock[] {
  return (items || [])
    .filter((item) => item && typeof item === "object")
    .map((item) => buildFormulaBlock(
      String(item.kind || "token") as FormulaBlock["kind"],
      {
        joiner: String(item.joiner || "") as FormulaJoiner,
        token: String(item.token || ""),
        iterator: String(item.iterator || "i"),
        items: normalizeFormulaBlocks(Array.isArray(item.items) ? item.items as Array<Record<string, unknown>> : []),
        numerator: normalizeFormulaBlocks(Array.isArray(item.numerator) ? item.numerator as Array<Record<string, unknown>> : []),
        denominator: normalizeFormulaBlocks(Array.isArray(item.denominator) ? item.denominator as Array<Record<string, unknown>> : [])
      }
    ));
}

function applyJoiner(left: number, joiner: FormulaJoiner, right: number) {
  if (joiner === "-") {
    return left - right;
  }
  if (joiner === "×") {
    return left * right;
  }
  if (joiner === "÷") {
    return right === 0 ? Number.NaN : left / right;
  }
  return left + right;
}

type FormulaExecutionInput = {
  scalars: Record<string, number>;
  iterators: Record<string, Array<Record<string, number>>>;
};

type FormulaExecutionTrace = {
  label: string;
  expression: string;
  result: number;
};

function createExecutionSeed(tokens: string[], iterators: string[]) {
  const scalars = tokens.reduce<Record<string, number>>((acc, token) => {
    if (!token.includes(",") && Number.isNaN(Number(token))) {
      acc[token] = 0;
    }
    return acc;
  }, {});
  const iteratorMap = iterators.reduce<Record<string, Array<Record<string, number>>>>((acc, iterator) => {
    const iteratorTokens = tokens.filter((token) => token.includes(`,${iterator}`));
    acc[iterator] = [
      iteratorTokens.reduce<Record<string, number>>((row, token) => {
        row[token] = 0;
        return row;
      }, {})
    ];
    return acc;
  }, {});
  return JSON.stringify({ scalars, iterators: iteratorMap }, null, 2);
}

function collectFormulaTokens(blocks: FormulaBlock[]): string[] {
  const tokens = new Set<string>();
  const visit = (items: FormulaBlock[]) => {
    items.forEach((item) => {
      if (item.kind === "token" && item.token.trim()) {
        tokens.add(item.token.trim());
      }
      visit(item.items || []);
      visit(item.numerator || []);
      visit(item.denominator || []);
    });
  };
  visit(blocks);
  return Array.from(tokens);
}

function collectFormulaIterators(blocks: FormulaBlock[]): string[] {
  const iterators = new Set<string>();
  const visit = (items: FormulaBlock[]) => {
    items.forEach((item) => {
      if (item.kind === "sum" && item.iterator.trim()) {
        iterators.add(item.iterator.trim());
      }
      visit(item.items || []);
      visit(item.numerator || []);
      visit(item.denominator || []);
    });
  };
  visit(blocks);
  return Array.from(iterators);
}

function evaluateFormulaBlocks(
  blocks: FormulaBlock[],
  input: FormulaExecutionInput,
  trace: FormulaExecutionTrace[],
  scope: Record<string, number> = {}
): number {
  return blocks.reduce((total, block, index) => {
    const current = evaluateFormulaBlock(block, input, trace, scope);
    if (index === 0) {
      return current;
    }
    return applyJoiner(total, block.joiner, current);
  }, 0);
}

function evaluateFormulaBlock(
  block: FormulaBlock,
  input: FormulaExecutionInput,
  trace: FormulaExecutionTrace[],
  scope: Record<string, number>
): number {
  if (block.kind === "token") {
    const numeric = Number(block.token);
    const result = Number.isNaN(numeric) ? Number(scope[block.token] ?? input.scalars[block.token] ?? 0) : numeric;
    trace.push({ label: block.token || "token", expression: block.token || "0", result });
    return result;
  }
  if (block.kind === "group") {
    const result = evaluateFormulaBlocks(block.items || [], input, trace, scope);
    trace.push({ label: "group", expression: formatFormulaBlock(block), result });
    return result;
  }
  if (block.kind === "fraction") {
    const numerator = evaluateFormulaBlocks(block.numerator || [], input, trace, scope);
    const denominator = evaluateFormulaBlocks(block.denominator || [], input, trace, scope);
    const result = denominator === 0 ? Number.NaN : numerator / denominator;
    trace.push({ label: "fraction", expression: formatFormulaBlock(block), result });
    return result;
  }
  const iteratorRows = input.iterators[block.iterator] || [];
  const result = iteratorRows.reduce((sum, row, rowIndex) => {
    const rowResult = evaluateFormulaBlocks(block.items || [], input, trace, { ...scope, ...row });
    trace.push({
      label: `SUM ${block.iterator}[${rowIndex}]`,
      expression: buildFormulaFromBlocks(block.items || []),
      result: rowResult
    });
    return sum + rowResult;
  }, 0);
  trace.push({ label: `SUM ${block.iterator}`, expression: formatFormulaBlock(block), result });
  return result;
}

const FORMULA_PRESETS: FormulaPreset[] = [
  {
    id: "cement-tier1",
    label: "시멘트 Tier 1",
    labelEn: "Cement Tier 1",
    formula: "[SUM(Mci × Ccli, i) - Im + Ex] × EFclc",
    blocks: [
      buildFormulaBlock("group", {
        items: [
          buildFormulaBlock("sum", { iterator: "i", items: [buildFormulaBlock("token", { token: "Mci" }), buildFormulaBlock("token", { joiner: "×", token: "Ccli" })] }),
          buildFormulaBlock("token", { joiner: "-", token: "Im" }),
          buildFormulaBlock("token", { joiner: "+", token: "Ex" })
        ]
      }),
      buildFormulaBlock("token", { joiner: "×", token: "EFclc" })
    ]
  },
  {
    id: "cement-tier2",
    label: "시멘트 Tier 2",
    labelEn: "Cement Tier 2",
    formula: "Mcl × EFcl × CFckd",
    blocks: [
      buildFormulaBlock("token", { token: "Mcl" }),
      buildFormulaBlock("token", { joiner: "×", token: "EFcl" }),
      buildFormulaBlock("token", { joiner: "×", token: "CFckd" })
    ]
  },
  {
    id: "cement-tier3",
    label: "시멘트 Tier 3",
    labelEn: "Cement Tier 3",
    formula: "SUM(EFi × Mi × Fi, i) - Md × Cd × (1 - Fd) × EFd + SUM(Mk × Xk × EFk, k)",
    blocks: [
      buildFormulaBlock("sum", { iterator: "i", items: [buildFormulaBlock("token", { token: "EFi" }), buildFormulaBlock("token", { joiner: "×", token: "Mi" }), buildFormulaBlock("token", { joiner: "×", token: "Fi" })] }),
      buildFormulaBlock("token", { joiner: "-", token: "Md" }),
      buildFormulaBlock("token", { joiner: "×", token: "Cd" }),
      buildFormulaBlock("group", { joiner: "×", items: [buildFormulaBlock("token", { token: "1" }), buildFormulaBlock("token", { joiner: "-", token: "Fd" })] }),
      buildFormulaBlock("token", { joiner: "×", token: "EFd" }),
      buildFormulaBlock("sum", { joiner: "+", iterator: "k", items: [buildFormulaBlock("token", { token: "Mk" }), buildFormulaBlock("token", { joiner: "×", token: "Xk" }), buildFormulaBlock("token", { joiner: "×", token: "EFk" })] })
    ]
  },
  {
    id: "lime-tier1",
    label: "석회 Tier 1",
    labelEn: "Lime Tier 1",
    formula: "SUM(EF석회,i × Ml,i, i)",
    blocks: [
      buildFormulaBlock("sum", { iterator: "i", items: [buildFormulaBlock("token", { token: "EF석회,i" }), buildFormulaBlock("token", { joiner: "×", token: "Ml,i" })] })
    ]
  },
  {
    id: "lime-tier2",
    label: "석회 Tier 2",
    labelEn: "Lime Tier 2",
    formula: "SUM(EF석회,i × Ml,i × CF_lkd,i × C_h,i, i)",
    blocks: [
      buildFormulaBlock("sum", { iterator: "i", items: [buildFormulaBlock("token", { token: "EF석회,i" }), buildFormulaBlock("token", { joiner: "×", token: "Ml,i" }), buildFormulaBlock("token", { joiner: "×", token: "CF_lkd,i" }), buildFormulaBlock("token", { joiner: "×", token: "C_h,i" })] })
    ]
  },
  {
    id: "lime-tier3",
    label: "석회 Tier 3",
    labelEn: "Lime Tier 3",
    formula: "SUM(EFi × Mi × Fi, i) - Md × Cd × (1 - Fd) × EFd",
    blocks: [
      buildFormulaBlock("sum", { iterator: "i", items: [buildFormulaBlock("token", { token: "EFi" }), buildFormulaBlock("token", { joiner: "×", token: "Mi" }), buildFormulaBlock("token", { joiner: "×", token: "Fi" })] }),
      buildFormulaBlock("token", { joiner: "-", token: "Md" }),
      buildFormulaBlock("token", { joiner: "×", token: "Cd" }),
      buildFormulaBlock("group", { joiner: "×", items: [buildFormulaBlock("token", { token: "1" }), buildFormulaBlock("token", { joiner: "-", token: "Fd" })] }),
      buildFormulaBlock("token", { joiner: "×", token: "EFd" })
    ]
  }
];

function normalizeRowOrdering(rows: Array<Record<string, unknown>>) {
  return rows.map((row, index) => ({
    ...row,
    sortOrder: (index + 1) * 10
  }));
}

function normalizeSectionOrdering(rows: Array<Record<string, unknown>>) {
  return rows.map((row, index) => ({
    ...row,
    sectionOrder: (index + 1) * 10
  }));
}

function extractSectionDefinitions(rows: Array<Record<string, unknown>>) {
  const sections = new Map<string, Record<string, unknown>>();
  rows.forEach((row, index) => {
    const normalized = normalizeVariableDefinitionRow(row);
    const fallbackSectionId = normalized.sectionId || `section-${index + 1}`;
    const hasSectionMetadata = [
      normalized.sectionId,
      normalized.sectionTitle,
      normalized.sectionDescription,
      normalized.sectionFormula,
      normalized.sectionPreviewType,
      normalized.sectionRelatedFactorCodes
    ].some(Boolean);
    if (!hasSectionMetadata) {
      return;
    }
    if (!sections.has(fallbackSectionId)) {
      sections.set(fallbackSectionId, normalizeSectionDefinitionRow({
        sectionId: fallbackSectionId,
        sectionTitle: normalized.sectionTitle,
        sectionDescription: normalized.sectionDescription,
        sectionFormula: normalized.sectionFormula,
        sectionPreviewType: normalized.sectionPreviewType,
        sectionRelatedFactorCodes: normalized.sectionRelatedFactorCodes,
        sectionOrder: normalized.sectionOrder,
        uiHint: normalized.uiHint
      }));
    }
  });
  return normalizeSectionOrdering(Array.from(sections.values()));
}

function applySectionsToVariableRows(
  rows: Array<Record<string, unknown>>,
  sections: Array<Record<string, unknown>>
) {
  const sectionById = new Map(
    sections
      .map((section) => normalizeSectionDefinitionRow(section))
      .filter((section) => section.sectionId)
      .map((section) => [section.sectionId, section] as const)
  );
  return normalizeRowOrdering(rows.map((row) => {
    const normalizedRow = normalizeVariableDefinitionRow(row);
    const matchedSection = normalizedRow.sectionId ? sectionById.get(normalizedRow.sectionId) : null;
    if (!matchedSection) {
      return {
        ...row,
        sectionTitle: "",
        sectionDescription: "",
        sectionFormula: "",
        sectionPreviewType: "",
        sectionRelatedFactorCodes: "",
        sectionOrder: 0
      };
    }
    return {
      ...row,
      sectionId: matchedSection.sectionId,
      sectionTitle: matchedSection.sectionTitle,
      sectionDescription: matchedSection.sectionDescription,
      sectionFormula: matchedSection.sectionFormula,
      sectionPreviewType: matchedSection.sectionPreviewType,
      sectionRelatedFactorCodes: matchedSection.sectionRelatedFactorCodes,
      sectionOrder: matchedSection.sectionOrder
    };
  }));
}

export function EmissionDefinitionStudioMigrationPage() {
  const en = isEnglish();
  const initialPayload = useMemo(() => readBootstrappedEmissionDefinitionStudioPageData(), []);
  const pageState = useAsyncValue<EmissionDefinitionStudioPagePayload>(() => fetchEmissionDefinitionStudioPage(), [], {
    initialValue: initialPayload,
    skipInitialLoad: Boolean(initialPayload)
  });
  const page = pageState.value || {};
  const summaryCards = (page.summaryCards || []) as Array<Record<string, string>>;
  const quickLinks = (page.quickLinks || []) as Array<Record<string, string>>;
  const seedCategories = (page.seedCategories || []) as Array<Record<string, string>>;
  const seedTiers = (page.seedTiers || []) as Array<Record<string, string>>;
  const policyOptions = (page.policyOptions || []) as Array<Record<string, string>>;
  const saveChecklist = (page.saveChecklist || []) as Array<Record<string, string>>;
  const governanceNotes = (page.governanceNotes || []) as Array<Record<string, string>>;
  const initialDefinitionRows = (page.definitionRows || []) as Array<Record<string, unknown>>;
  const initialSelectedDefinition = (page.selectedDefinition || null) as Record<string, unknown> | null;
  const classificationCatalog = (page.classificationCatalog || null) as Record<string, unknown> | null;
  const classificationRows = Array.isArray(classificationCatalog?.rows)
    ? (classificationCatalog.rows as Array<Record<string, unknown>>)
    : [];

  const [draftId, setDraftId] = useState("");
  const [categoryCode, setCategoryCode] = useState("CEMENT");
  const [categoryName, setCategoryName] = useState(en ? "Cement production extension" : "시멘트 생산 확장");
  const [selectedClassificationCode, setSelectedClassificationCode] = useState(readInitialClassificationCode);
  const [tierLabel, setTierLabel] = useState("Tier 4");
  const [formula, setFormula] = useState("SUM(activity × factor) - correction");
  const [formulaBlocks, setFormulaBlocks] = useState<FormulaBlock[]>([
    buildFormulaBlock("sum", { iterator: "i", items: [buildFormulaBlock("token", { token: "activity,i" }), buildFormulaBlock("token", { joiner: "×", token: "factor,i" })] }),
    buildFormulaBlock("token", { joiner: "-", token: "correction" })
  ]);
  const [executionValuesJson, setExecutionValuesJson] = useState(createExecutionSeed(["activity,i", "factor,i", "correction"], ["i"]));
  const [executionResult, setExecutionResult] = useState("");
  const [executionTrace, setExecutionTrace] = useState<FormulaExecutionTrace[]>([]);
  const [executionError, setExecutionError] = useState("");
  const [inputMode, setInputMode] = useState("NUMBER");
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([
    "input_required_yn",
    "default_capable_yn",
    "stored_factor_capable_yn"
  ]);
  const [directRequiredCodes, setDirectRequiredCodes] = useState("MCI, CCLI, MCL, MLI");
  const [fallbackCodes, setFallbackCodes] = useState("EFCLC, EFC, EFCL");
  const [autoCalculatedCodes, setAutoCalculatedCodes] = useState("CFCKD");
  const [supplementalCodes, setSupplementalCodes] = useState("");
  const [sectionDefinitionsJson, setSectionDefinitionsJson] = useState("[]");
  const [variableDefinitionsJson, setVariableDefinitionsJson] = useState("[]");
  const [runtimeMode, setRuntimeMode] = useState("AUTO");
  const [notes, setNotes] = useState(en
    ? "Separate validation policy from resolution policy before opening save API."
    : "저장 API 개방 전 validation 정책과 resolution 정책을 분리합니다.");
  const [definitionRows, setDefinitionRows] = useState<Array<Record<string, unknown>>>(initialDefinitionRows);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const applyDraft = (draft: Record<string, unknown> | null) => {
    if (!draft) {
      setDraftId("");
      setCategoryCode("CEMENT");
      setCategoryName(en ? "Cement production extension" : "시멘트 생산 확장");
      setTierLabel("Tier 4");
      setFormula("SUM(activity × factor) - correction");
      const defaultBlocks = [
        buildFormulaBlock("sum", { iterator: "i", items: [buildFormulaBlock("token", { token: "activity,i" }), buildFormulaBlock("token", { joiner: "×", token: "factor,i" })] }),
        buildFormulaBlock("token", { joiner: "-", token: "correction" })
      ];
      setFormulaBlocks(defaultBlocks);
      setExecutionValuesJson(createExecutionSeed(["activity,i", "factor,i", "correction"], ["i"]));
      setExecutionResult("");
      setExecutionTrace([]);
      setExecutionError("");
      setInputMode("NUMBER");
      setSelectedPolicies(["input_required_yn", "default_capable_yn", "stored_factor_capable_yn"]);
      setDirectRequiredCodes("MCI, CCLI, MCL, MLI");
      setFallbackCodes("EFCLC, EFC, EFCL");
      setAutoCalculatedCodes("CFCKD");
      setSupplementalCodes("");
      setSectionDefinitionsJson("[]");
      setVariableDefinitionsJson("[]");
      setRuntimeMode("AUTO");
      setNotes(en
        ? "Separate validation policy from resolution policy before opening save API."
        : "저장 API 개방 전 validation 정책과 resolution 정책을 분리합니다.");
      return;
    }
    setDraftId(stringOf(draft, "draftId"));
    setCategoryCode(stringOf(draft, "categoryCode") || "CEMENT");
    setCategoryName(stringOf(draft, "categoryName") || "");
    setTierLabel(stringOf(draft, "tierLabel") || "Tier 4");
    const nextFormula = stringOf(draft, "formula") || "";
    setFormula(nextFormula);
    const nextFormulaTree = Array.isArray(draft.formulaTree) ? normalizeFormulaBlocks(draft.formulaTree as Array<Record<string, unknown>>) : [];
    const matchedPreset = FORMULA_PRESETS.find((preset) => preset.formula === nextFormula);
    const nextFormulaBlocks = nextFormulaTree.length > 0
      ? nextFormulaTree
      : (matchedPreset ? cloneFormulaBlocks(matchedPreset.blocks) : [buildFormulaBlock("token", { token: nextFormula || "activity" })]);
    setFormulaBlocks(nextFormulaBlocks);
    const nextIterators = Array.from(new Set(nextFormulaBlocks.flatMap((block) => collectFormulaIterators([block]))));
    const nextTokens = collectFormulaTokens(nextFormulaBlocks);
    setExecutionValuesJson(createExecutionSeed(nextTokens, nextIterators));
    setExecutionResult("");
    setExecutionTrace([]);
    setExecutionError("");
    setInputMode(stringOf(draft, "inputMode") || "NUMBER");
    const nextPolicies = Array.isArray(draft.policies)
      ? (draft.policies as unknown[]).map((item) => String(item || "")).filter(Boolean)
      : [];
    setSelectedPolicies(nextPolicies.length > 0 ? nextPolicies : ["input_required_yn"]);
    setDirectRequiredCodes(Array.isArray(draft.directRequiredCodes) ? (draft.directRequiredCodes as unknown[]).map((item) => String(item || "")).filter(Boolean).join(", ") : "");
    setFallbackCodes(Array.isArray(draft.fallbackCodes) ? (draft.fallbackCodes as unknown[]).map((item) => String(item || "")).filter(Boolean).join(", ") : "");
    setAutoCalculatedCodes(Array.isArray(draft.autoCalculatedCodes) ? (draft.autoCalculatedCodes as unknown[]).map((item) => String(item || "")).filter(Boolean).join(", ") : "");
    setSupplementalCodes(Array.isArray(draft.supplementalCodes) ? (draft.supplementalCodes as unknown[]).map((item) => String(item || "")).filter(Boolean).join(", ") : "");
    const nextVariableDefinitions = Array.isArray(draft.variableDefinitions) ? (draft.variableDefinitions as Array<Record<string, unknown>>) : [];
    const nextSections = Array.isArray(draft.sections) ? (draft.sections as Array<Record<string, unknown>>) : extractSectionDefinitions(nextVariableDefinitions);
    setSectionDefinitionsJson(JSON.stringify(nextSections, null, 2));
    setVariableDefinitionsJson(JSON.stringify(Array.isArray(draft.variableDefinitions) ? draft.variableDefinitions : [], null, 2));
    setRuntimeMode(stringOf(draft, "runtimeMode") || "AUTO");
    setNotes(stringOf(draft, "note"));
  };

  const parsedSectionDefinitions = useMemo(() => {
    try {
      const parsed = JSON.parse(sectionDefinitionsJson || "[]");
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
    } catch {
      return null;
    }
  }, [sectionDefinitionsJson]);

  const parsedVariableDefinitions = useMemo(() => {
    try {
      const parsed = JSON.parse(variableDefinitionsJson || "[]");
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
    } catch {
      return null;
    }
  }, [variableDefinitionsJson]);

  const editableVariableDefinitions = useMemo(() => (
    (parsedVariableDefinitions || []).map((row) => normalizeVariableDefinitionRow(row))
  ), [parsedVariableDefinitions]);

  const editableSectionDefinitions = useMemo(() => (
    (parsedSectionDefinitions || []).map((row) => normalizeSectionDefinitionRow(row))
  ), [parsedSectionDefinitions]);

  const classificationOptions = useMemo(() => (
    classificationRows
      .filter((row) => stringOf(row, "code"))
      .map((row) => ({
        code: stringOf(row, "code"),
        label: stringOf(row, "label"),
        level: stringOf(row, "level"),
        pathLabel: stringOf(row, "pathLabel"),
        tierLabel: stringOf(row, "tierLabel"),
        useAt: stringOf(row, "useAt")
      }))
  ), [classificationRows]);

  const selectedClassification = useMemo(
    () => classificationRows.find((row) => stringOf(row, "code") === selectedClassificationCode) || null,
    [classificationRows, selectedClassificationCode]
  );

  const formulaTokenOptions = useMemo(() => {
    const tokens = new Set<string>([
      "Mci",
      "Ccli",
      "Im",
      "Ex",
      "Mcl",
      "EFcl",
      "CFckd",
      "EFi",
      "Mi",
      "Fi",
      "Md",
      "Cd",
      "Fd",
      "(1 - Fd)",
      "EFd",
      "Mk",
      "Xk",
      "EFk",
      "EF석회,i",
      "Ml,i",
      "CF_lkd,i",
      "C_h,i",
      "activity,i",
      "factor,i",
      "activity",
      "factor",
      "1",
      "correction"
    ]);
    [directRequiredCodes, fallbackCodes, autoCalculatedCodes, supplementalCodes].forEach((codeGroup) => {
      codeGroup.split(",").map((item) => item.trim()).filter(Boolean).forEach((token) => tokens.add(token));
    });
    editableVariableDefinitions.forEach((row) => {
      if (row.varCode) {
        tokens.add(row.varCode);
      }
      if (row.displayName) {
        tokens.add(row.displayName);
      }
    });
    return Array.from(tokens);
  }, [autoCalculatedCodes, directRequiredCodes, editableVariableDefinitions, fallbackCodes, supplementalCodes]);

  const sectionBindingOptions = useMemo(() => {
    const options = editableSectionDefinitions.map((section, index) => ({
      value: section.sectionId,
      label: section.sectionTitle || section.sectionId || (en ? `Section ${index + 1}` : `섹션 ${index + 1}`)
    })).filter((option) => option.value);
    const boundOnlyIds = editableVariableDefinitions
      .map((row) => row.sectionId)
      .filter((sectionId) => sectionId && !options.some((option) => option.value === sectionId));
    boundOnlyIds.forEach((sectionId) => {
      options.push({
        value: sectionId,
        label: `${sectionId} ${en ? "(unregistered)" : "(미등록)"}`
      });
    });
    return options;
  }, [editableSectionDefinitions, editableVariableDefinitions, en]);

  useEffect(() => {
    const builtFormula = buildFormulaFromBlocks(formulaBlocks);
    if (builtFormula) {
      setFormula(builtFormula);
    }
  }, [formulaBlocks]);

  useEffect(() => {
    setDefinitionRows(initialDefinitionRows);
  }, [initialDefinitionRows]);

  useEffect(() => {
    if (initialSelectedDefinition) {
      applyDraft(initialSelectedDefinition);
    }
  }, [initialSelectedDefinition]);

  useEffect(() => {
    if (!selectedClassificationCode) {
      return;
    }
    const matched = classificationRows.find((row) => stringOf(row, "code") === selectedClassificationCode);
    if (!matched) {
      return;
    }
    setCategoryCode(stringOf(matched, "code"));
    setCategoryName(stringOf(matched, "pathLabel") || stringOf(matched, "label"));
  }, [classificationRows, selectedClassificationCode]);

  useEffect(() => {
    const matched = classificationRows.find((row) => stringOf(row, "code") === categoryCode);
    const nextCode = matched ? stringOf(matched, "code") : "";
    if (nextCode !== selectedClassificationCode) {
      setSelectedClassificationCode(nextCode);
    }
  }, [categoryCode, classificationRows, selectedClassificationCode]);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-definition-studio", {
      language: en ? "en" : "ko",
      menuCode: page.menuCode || "",
      seedCategoryCount: seedCategories.length,
      policyCount: policyOptions.length,
      selectedPolicyCount: selectedPolicies.length,
      savedDraftCount: definitionRows.length
    });
  }, [definitionRows.length, en, page.menuCode, policyOptions.length, seedCategories.length, selectedPolicies.length]);

  const activeDraftRow = useMemo(
    () => definitionRows.find((item) => stringOf(item, "draftId") === draftId) || null,
    [definitionRows, draftId]
  );

  const stagedPayload = useMemo(() => {
    const resolvedPolicies = policyOptions
      .filter((item) => selectedPolicies.includes(stringOf(item, "code")))
      .map((item) => ({
        code: stringOf(item, "code"),
        label: stringOf(item, "label")
      }));
    return {
      category: {
        code: categoryCode.trim() || "NEW_CATEGORY",
        name: categoryName.trim() || (en ? "New emission category" : "신규 배출 분류")
      },
      tier: {
        label: tierLabel.trim() || "Tier X",
        formula: formula.trim(),
        inputMode
      },
      formulaTree: formulaBlocks,
      policies: resolvedPolicies,
      variablePolicyCodes: {
        directRequiredCodes: directRequiredCodes.split(",").map((item) => item.trim()).filter(Boolean),
        fallbackCodes: fallbackCodes.split(",").map((item) => item.trim()).filter(Boolean),
        autoCalculatedCodes: autoCalculatedCodes.split(",").map((item) => item.trim()).filter(Boolean),
        supplementalCodes: supplementalCodes.split(",").map((item) => item.trim()).filter(Boolean)
      },
      sections: parsedSectionDefinitions || [],
      variableDefinitions: applySectionsToVariableRows(parsedVariableDefinitions || [], parsedSectionDefinitions || []),
      runtimeMode,
      note: notes.trim()
    };
  }, [autoCalculatedCodes, categoryCode, categoryName, directRequiredCodes, en, fallbackCodes, formula, formulaBlocks, inputMode, notes, parsedSectionDefinitions, parsedVariableDefinitions, policyOptions, runtimeMode, selectedPolicies, supplementalCodes, tierLabel]);

  const togglePolicy = (code: string) => {
    setSelectedPolicies((current) => (
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
    ));
  };

  const applyFormulaPreset = (presetId: string) => {
    const preset = FORMULA_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    setFormula(preset.formula);
    const nextBlocks = cloneFormulaBlocks(preset.blocks);
    setFormulaBlocks(nextBlocks);
    setExecutionValuesJson(createExecutionSeed(collectFormulaTokens(nextBlocks), collectFormulaIterators(nextBlocks)));
    setExecutionResult("");
    setExecutionTrace([]);
    setExecutionError("");
  };

  const updateFormulaBlocks = (
    blocks: FormulaBlock[],
    path: number[],
    recipe: (items: FormulaBlock[]) => FormulaBlock[]
  ): FormulaBlock[] => {
    if (path.length === 0) {
      return recipe(blocks);
    }
    const [head, ...rest] = path;
    return blocks.map((block, index) => {
      if (index !== head) {
        return block;
      }
      const targetKey = block.kind === "fraction"
        ? (rest[0] === -1 ? "numerator" : "denominator")
        : "items";
      const childPath = block.kind === "fraction" ? rest.slice(1) : rest;
      return {
        ...block,
        [targetKey]: updateFormulaBlocks(
          (block[targetKey as "items" | "numerator" | "denominator"] || []) as FormulaBlock[],
          childPath,
          recipe
        )
      };
    });
  };

  const normalizeLeadingJoiners = (blocks: FormulaBlock[]) => (
    blocks.map((block, index) => ({
      ...block,
      joiner: (index === 0 ? "" : (block.joiner || "+")) as FormulaJoiner
    }))
  );

  const addFormulaBlock = (path: number[], kind: FormulaBlock["kind"]) => {
    setFormulaBlocks((current) => updateFormulaBlocks(current, path, (items) => normalizeLeadingJoiners([
      ...items,
      buildFormulaBlock(kind, kind === "sum"
        ? {
          joiner: items.length > 0 ? "+" : "",
          iterator: "i",
          items: [buildFormulaBlock("token", { token: "activity,i" }), buildFormulaBlock("token", { joiner: "×", token: "factor,i" })]
        }
        : kind === "fraction"
          ? {
            joiner: items.length > 0 ? "+" : "",
            numerator: [buildFormulaBlock("token", { token: "numerator" })],
            denominator: [buildFormulaBlock("token", { token: "denominator" })]
          }
          : kind === "group"
            ? { joiner: items.length > 0 ? "+" : "", items: [buildFormulaBlock("token", { token: "value" })] }
            : { joiner: items.length > 0 ? "+" : "", token: "value" })
    ])));
  };

  const updateFormulaBlock = (path: number[], patch: Partial<FormulaBlock>) => {
    setFormulaBlocks((current) => updateFormulaBlocks(current, path.slice(0, -1), (items) => items.map((item, itemIndex) => (
      itemIndex === path[path.length - 1]
        ? { ...item, ...patch }
        : item
    ))));
  };

  const removeFormulaBlock = (path: number[]) => {
    setFormulaBlocks((current) => updateFormulaBlocks(current, path.slice(0, -1), (items) => normalizeLeadingJoiners(
      items.filter((_, itemIndex) => itemIndex !== path[path.length - 1])
    )));
  };

  const moveFormulaBlock = (path: number[], direction: "up" | "down") => {
    setFormulaBlocks((current) => updateFormulaBlocks(current, path.slice(0, -1), (items) => {
      const targetIndex = direction === "up" ? path[path.length - 1] - 1 : path[path.length - 1] + 1;
      if (targetIndex < 0 || targetIndex >= items.length) {
        return items;
      }
      const next = items.slice();
      const [picked] = next.splice(path[path.length - 1], 1);
      next.splice(targetIndex, 0, picked);
      return normalizeLeadingJoiners(next);
    }));
  };

  const runFormulaExecution = () => {
    try {
      const parsed = JSON.parse(executionValuesJson || "{}") as FormulaExecutionInput;
      const trace: FormulaExecutionTrace[] = [];
      const result = evaluateFormulaBlocks(formulaBlocks, {
        scalars: parsed?.scalars || {},
        iterators: parsed?.iterators || {}
      }, trace);
      if (Number.isNaN(result)) {
        throw new Error(en ? "Execution produced an invalid number." : "계산 결과가 유효하지 않은 숫자입니다.");
      }
      setExecutionResult(String(result));
      setExecutionTrace(trace);
      setExecutionError("");
    } catch (error) {
      setExecutionResult("");
      setExecutionTrace([]);
      setExecutionError(error instanceof Error ? error.message : (en ? "Execution failed." : "계산 실행에 실패했습니다."));
    }
  };

  const setVariableDefinitionsFromRows = (rows: Array<Record<string, unknown>>) => {
    setVariableDefinitionsJson(JSON.stringify(rows, null, 2));
  };

  const setSectionDefinitionsFromRows = (rows: Array<Record<string, unknown>>) => {
    setSectionDefinitionsJson(JSON.stringify(rows, null, 2));
  };

  const updateVariableDefinitionRow = (index: number, key: string, value: string | number) => {
    const rows = (parsedVariableDefinitions || []).map((row) => ({ ...row }));
    if (!rows[index]) {
      return;
    }
    rows[index] = {
      ...rows[index],
      [key]: value
    };
    setVariableDefinitionsFromRows(rows);
  };

  const updateVariableDefinitionOptions = (index: number, options: Array<Record<string, unknown>>) => {
    const rows = (parsedVariableDefinitions || []).map((row) => ({ ...row }));
    if (!rows[index]) {
      return;
    }
    rows[index] = {
      ...rows[index],
      options
    };
    setVariableDefinitionsFromRows(rows);
  };

  const addVariableDefinitionOption = (index: number) => {
    const currentRow = editableVariableDefinitions[index];
    if (!currentRow) {
      return;
    }
    updateVariableDefinitionOptions(index, [
      ...(Array.isArray(currentRow.options) ? currentRow.options : []),
      { code: "", label: "", description: "" }
    ]);
  };

  const updateVariableDefinitionOption = (rowIndex: number, optionIndex: number, key: string, value: string) => {
    const currentRow = editableVariableDefinitions[rowIndex];
    if (!currentRow) {
      return;
    }
    const nextOptions = (Array.isArray(currentRow.options) ? currentRow.options : []).map((option) => ({ ...option }));
    if (!nextOptions[optionIndex]) {
      return;
    }
    nextOptions[optionIndex] = {
      ...nextOptions[optionIndex],
      [key]: value
    };
    updateVariableDefinitionOptions(rowIndex, nextOptions);
  };

  const removeVariableDefinitionOption = (rowIndex: number, optionIndex: number) => {
    const currentRow = editableVariableDefinitions[rowIndex];
    if (!currentRow) {
      return;
    }
    updateVariableDefinitionOptions(
      rowIndex,
      (Array.isArray(currentRow.options) ? currentRow.options : []).filter((_, index) => index !== optionIndex)
    );
  };

  const updateSectionDefinitionRow = (index: number, key: string, value: string | number) => {
    const rows = (parsedSectionDefinitions || []).map((row) => ({ ...row }));
    if (!rows[index]) {
      return;
    }
    const previousSectionId = key === "sectionId" ? String(rows[index].sectionId || "") : "";
    rows[index] = {
      ...rows[index],
      [key]: value
    };
    setSectionDefinitionsFromRows(rows);
    if (key === "sectionId") {
      const nextSectionId = String(value || "");
      if (previousSectionId && previousSectionId !== nextSectionId) {
        const nextVariables = (parsedVariableDefinitions || []).map((row) => {
          const normalizedRow = normalizeVariableDefinitionRow(row);
          if (normalizedRow.sectionId !== previousSectionId) {
            return row;
          }
          return {
            ...row,
            sectionId: nextSectionId
          };
        });
        setVariableDefinitionsFromRows(nextVariables);
      }
    }
  };

  const applySectionTemplate = (index: number, templateKey: string) => {
    const templates: Record<string, Record<string, unknown>> = {
      scope: {
        sectionId: "scope-selection",
        sectionTitle: en ? "Scope selection" : "범위 선택",
        sectionDescription: en ? "Choose category and tier before opening variable inputs." : "변수 입력 전 분류와 Tier를 먼저 선택합니다.",
        sectionFormula: "",
        sectionPreviewType: "",
        sectionRelatedFactorCodes: "",
        sectionOrder: 1,
        uiHint: en ? "Choose category and tier first." : "먼저 분류와 Tier를 선택합니다."
      },
      material_input: {
        sectionId: "material-input",
        sectionTitle: en ? "Material input" : "원료 입력",
        sectionDescription: en ? "Enter activity data and repeated material rows for this formula block." : "이 수식 블록의 활동자료와 반복 원료 행을 입력합니다.",
        sectionFormula: "activity × factor",
        sectionPreviewType: "",
        sectionRelatedFactorCodes: "",
        sectionOrder: 2,
        uiHint: en ? "Enter source values for this formula block." : "이 수식 블록의 원천값을 입력합니다."
      },
      factor_block: {
        sectionId: "factor-block",
        sectionTitle: en ? "Factor and correction" : "계수 및 보정",
        sectionDescription: en ? "Review fallback, stored, or derived factors and correction terms in this block." : "이 블록에서 대체값, 저장계수, 유도식 계수와 보정항을 검토합니다.",
        sectionFormula: "factor × correction",
        sectionPreviewType: "factor-preview",
        sectionRelatedFactorCodes: "EFCLC,EFC,EFCL,CFCKD,EFD,EF_LIME,CF_LKD",
        sectionOrder: 3,
        uiHint: en ? "Review fallback, stored, or derived factor flow." : "대체값, 저장계수, 유도식 계수 흐름을 검토합니다."
      },
      result_block: {
        sectionId: "result-block",
        sectionTitle: en ? "Result block" : "결과 블록",
        sectionDescription: en ? "Expose the final variable or summary item near the result area." : "최종 변수나 요약 항목을 결과 영역 근처에 노출합니다.",
        sectionFormula: "CO2 = ...",
        sectionPreviewType: "result-preview",
        sectionRelatedFactorCodes: "",
        sectionOrder: 9,
        uiHint: en ? "Expose this variable near result output." : "이 변수를 결과 영역 가까이에 노출합니다."
      }
    };
    const template = templates[templateKey];
    if (!template) {
      return;
    }
    const rows = (parsedSectionDefinitions || []).map((row) => ({ ...row }));
    if (!rows[index]) {
      return;
    }
    rows[index] = {
      ...rows[index],
      ...template
    };
    setSectionDefinitionsFromRows(rows);
  };

  const applyPreviewPreset = (index: number, presetKey: string) => {
    const presets: Record<string, Record<string, unknown>> = {
      factor_preview: {
        sectionPreviewType: "factor-preview",
        sectionRelatedFactorCodes: "EFCLC,EFC,EFCL,CFCKD,EFD,EF_LIME,CF_LKD"
      },
      result_preview: {
        sectionPreviewType: "result-preview"
      },
      cement_tier2_cf: {
        sectionPreviewType: "cement-tier2-cf",
        sectionRelatedFactorCodes: "EFC,EFCL,CFCKD"
      },
      lime_tier2_ef: {
        sectionPreviewType: "lime-tier2-ef",
        sectionRelatedFactorCodes: "EF_LIME"
      },
      lime_tier2_cf: {
        sectionPreviewType: "lime-tier2-cf",
        sectionRelatedFactorCodes: "CF_LKD"
      },
      lime_tier2_ch: {
        sectionPreviewType: "lime-tier2-ch",
        sectionRelatedFactorCodes: "CH,X,Y,HYDRATED_LIME_PRODUCTION_YN"
      }
    };
    const preset = presets[presetKey];
    const rows = (parsedSectionDefinitions || []).map((row) => ({ ...row }));
    if (!preset || !rows[index]) {
      return;
    }
    rows[index] = {
      ...rows[index],
      ...preset
    };
    setSectionDefinitionsFromRows(rows);
  };

  const applySelectPreset = (index: number, presetKey: string) => {
    const presets: Record<string, { commonCodeId: string; options: Array<Record<string, string>>; uiHint: string; }> = {
      carbonate_type: {
        commonCodeId: "EMCRB1",
        uiHint: en ? "Maps the emission factor from the carbonate-type table." : "탄산염 유형 표 기준으로 배출계수를 매핑합니다.",
        options: [
          { code: "CACO3", label: en ? "Calcite / Aragonite" : "방해석 / 아라고나이트", description: "CaCO3" },
          { code: "MGCO3", label: en ? "Magnesite" : "마그네사이트", description: "MgCO3" },
          { code: "CAMG_CO3_2", label: en ? "Dolomite" : "백운석", description: "CaMg(CO3)2" },
          { code: "FECO3", label: en ? "Siderite" : "능철광", description: "FeCO3" },
          { code: "CA_FE_MG_MN_CO3_2", label: en ? "Ankerite" : "철백운석", description: "Ca(Fe,Mg,Mn)(CO3)2" },
          { code: "MNCO3", label: en ? "Rhodochrosite" : "망간광", description: "MnCO3" },
          { code: "NA2CO3", label: en ? "Soda Ash" : "소다회", description: "Na2CO3" }
        ]
      },
      lime_type_tier1: {
        commonCodeId: "EMLIM1",
        uiHint: en ? "Tier 1 lime-type selector used to resolve EF_lime,i." : "Tier 1 석회 유형 선택값으로 EF석회,i를 결정합니다.",
        options: [
          { code: "HIGH_CALCIUM", label: en ? "High-calcium lime" : "고칼슘석회", description: "Tier 1" },
          { code: "DOLOMITIC_HIGH", label: en ? "Dolomitic lime (developed)" : "고토석회(선진국)", description: "Tier 1" },
          { code: "DOLOMITIC_LOW", label: en ? "Dolomitic lime (developing)" : "고토석회(개도국)", description: "Tier 1" },
          { code: "HYDRAULIC", label: en ? "Hydraulic lime" : "수경성석회", description: "Tier 1" }
        ]
      },
      lime_type_tier23: {
        commonCodeId: "EMLIM2",
        uiHint: en ? "Tier 2/3 lime-type selector used for factor/default branching." : "Tier 2/3 석회 유형 선택값으로 계수/기본값 분기를 결정합니다.",
        options: [
          { code: "HIGH_CALCIUM", label: en ? "High-calcium lime" : "고칼슘석회", description: "Tier 2/3" },
          { code: "DOLOMITIC_HIGH", label: en ? "Dolomitic lime (developed)" : "고토석회(선진국)", description: "Tier 2/3" },
          { code: "DOLOMITIC_LOW", label: en ? "Dolomitic lime (developing)" : "고토석회(개도국)", description: "Tier 2/3" },
          { code: "HYDRAULIC", label: en ? "Hydraulic lime" : "수경성석회", description: "Tier 2/3" }
        ]
      },
      hydrated_lime_yn: {
        commonCodeId: "EMHYD1",
        uiHint: en ? "Controls whether C_h,i stays at 1.00 or switches to hydration-correction flow." : "C_h,i를 1.00으로 둘지 수화 보정 흐름으로 전환할지 결정합니다.",
        options: [
          { code: "Y", label: en ? "Produces hydrated lime" : "수화석회를 생산하는 경우", description: "C_h,i derived/default correction" },
          { code: "N", label: en ? "Does not produce hydrated lime" : "수화석회를 생산하지 않는 경우", description: "C_h,i = 1.00" }
        ]
      }
    };
    const preset = presets[presetKey];
    const rows = (parsedVariableDefinitions || []).map((row) => ({ ...row }));
    if (!preset || !rows[index]) {
      return;
    }
    rows[index] = {
      ...rows[index],
      inputType: "SELECT",
      commonCodeId: preset.commonCodeId,
      uiHint: rows[index].uiHint || preset.uiHint,
      options: preset.options
    };
    setVariableDefinitionsFromRows(rows);
  };

  const addVariableDefinitionRow = () => {
    const rows = (parsedVariableDefinitions || []).map((row) => ({ ...row }));
    rows.push({
      varCode: "",
      varName: "",
      displayName: "",
      inputType: "NUMBER",
      unit: "",
      commonCodeId: "",
      isRequired: "",
      isRepeatable: "",
      supplementalYn: "",
      sectionId: "",
      sectionTitle: "",
      sectionDescription: "",
      sectionFormula: "",
      sectionPreviewType: "",
      sectionRelatedFactorCodes: "",
      visibleWhen: "",
      disabledWhen: "",
      sectionOrder: rows.length + 1,
      sortOrder: (rows.length + 1) * 10,
      uiHint: "",
      varDesc: "",
      options: []
    });
    setVariableDefinitionsFromRows(normalizeRowOrdering(rows));
  };

  const addVariableDefinitionRowForSection = (sectionId: string) => {
    const rows = (parsedVariableDefinitions || []).map((row) => ({ ...row }));
    rows.push({
      varCode: "",
      varName: "",
      displayName: "",
      inputType: "NUMBER",
      unit: "",
      commonCodeId: "",
      isRequired: "",
      isRepeatable: "",
      supplementalYn: "",
      sectionId,
      sectionTitle: "",
      sectionDescription: "",
      sectionFormula: "",
      sectionPreviewType: "",
      sectionRelatedFactorCodes: "",
      visibleWhen: "",
      disabledWhen: "",
      sectionOrder: rows.length + 1,
      sortOrder: (rows.length + 1) * 10,
      uiHint: "",
      varDesc: "",
      options: []
    });
    setVariableDefinitionsFromRows(normalizeRowOrdering(rows));
  };

  const removeVariableDefinitionRow = (index: number) => {
    const rows = (parsedVariableDefinitions || []).filter((_, rowIndex) => rowIndex !== index);
    setVariableDefinitionsFromRows(normalizeRowOrdering(rows));
  };

  const moveVariableDefinitionRow = (index: number, direction: "up" | "down") => {
    const rows = (parsedVariableDefinitions || []).map((row) => ({ ...row }));
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (!rows[index] || targetIndex < 0 || targetIndex >= rows.length) {
      return;
    }
    const nextRows = rows.slice();
    const [picked] = nextRows.splice(index, 1);
    nextRows.splice(targetIndex, 0, picked);
    setVariableDefinitionsFromRows(normalizeRowOrdering(nextRows));
  };

  const addSectionDefinitionRow = () => {
    const rows = (parsedSectionDefinitions || []).map((row) => ({ ...row }));
    rows.push({
      sectionId: "",
      sectionTitle: "",
      sectionDescription: "",
      sectionFormula: "",
      sectionPreviewType: "",
      sectionRelatedFactorCodes: "",
      sectionOrder: (rows.length + 1) * 10,
      uiHint: ""
    });
    setSectionDefinitionsFromRows(normalizeSectionOrdering(rows));
  };

  const removeSectionDefinitionRow = (index: number) => {
    const removedSectionId = editableSectionDefinitions[index]?.sectionId || "";
    const nextSections = (parsedSectionDefinitions || []).filter((_, rowIndex) => rowIndex !== index);
    setSectionDefinitionsFromRows(normalizeSectionOrdering(nextSections));
    if (!removedSectionId) {
      return;
    }
    const nextVariables = (parsedVariableDefinitions || []).map((row) => {
      const normalizedRow = normalizeVariableDefinitionRow(row);
      if (normalizedRow.sectionId !== removedSectionId) {
        return row;
      }
      return {
        ...row,
        sectionId: ""
      };
    });
    setVariableDefinitionsFromRows(nextVariables);
  };

  const moveSectionDefinitionRow = (index: number, direction: "up" | "down") => {
    const rows = (parsedSectionDefinitions || []).map((row) => ({ ...row }));
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (!rows[index] || targetIndex < 0 || targetIndex >= rows.length) {
      return;
    }
    const nextRows = rows.slice();
    const [picked] = nextRows.splice(index, 1);
    nextRows.splice(targetIndex, 0, picked);
    setSectionDefinitionsFromRows(normalizeSectionOrdering(nextRows));
  };

  const seedVariableDefinitionRows = () => {
    const seededRows = Array.from(new Set([
      ...directRequiredCodes.split(",").map((item) => item.trim()).filter(Boolean),
      ...fallbackCodes.split(",").map((item) => item.trim()).filter(Boolean),
      ...autoCalculatedCodes.split(",").map((item) => item.trim()).filter(Boolean),
      ...supplementalCodes.split(",").map((item) => item.trim()).filter(Boolean)
    ])).map((varCode, index) => ({
      varCode,
      varName: varCode,
      displayName: varCode,
      inputType: "NUMBER",
      unit: "",
      isRequired: directRequiredCodes.split(",").map((item) => item.trim()).includes(varCode) ? "Y" : "N",
      isRepeatable: "N",
      supplementalYn: supplementalCodes.split(",").map((item) => item.trim()).includes(varCode) ? "Y" : "N",
      sectionId: "",
      sectionTitle: "",
      sectionDescription: "",
      sectionFormula: "",
      sectionPreviewType: "",
      sectionRelatedFactorCodes: "",
      visibleWhen: "",
      disabledWhen: "",
      sectionOrder: index + 1,
      sortOrder: (index + 1) * 10,
      uiHint: "",
      varDesc: "",
      options: []
    }));
    setVariableDefinitionsFromRows(seededRows);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setSaveError("");
    setMessage("");
    if (parsedSectionDefinitions == null) {
      setSaving(false);
      setSaveError(en ? "Section definitions JSON is invalid." : "섹션 정의 JSON 형식이 올바르지 않습니다.");
      return;
    }
    if (parsedVariableDefinitions == null) {
      setSaving(false);
      setSaveError(en ? "Variable definitions JSON is invalid." : "변수 정의 JSON 형식이 올바르지 않습니다.");
      return;
    }
    try {
      const response = await saveEmissionDefinitionDraft({
        draftId: draftId || undefined,
        categoryCode,
        categoryName,
        tierLabel,
        formula,
        formulaTree: formulaBlocks,
        inputMode,
        policies: selectedPolicies,
        directRequiredCodes: directRequiredCodes.split(",").map((item) => item.trim()).filter(Boolean),
        fallbackCodes: fallbackCodes.split(",").map((item) => item.trim()).filter(Boolean),
        autoCalculatedCodes: autoCalculatedCodes.split(",").map((item) => item.trim()).filter(Boolean),
        supplementalCodes: supplementalCodes.split(",").map((item) => item.trim()).filter(Boolean),
        sections: parsedSectionDefinitions,
        variableDefinitions: applySectionsToVariableRows(parsedVariableDefinitions, parsedSectionDefinitions),
        runtimeMode,
        note: notes
      });
      const typed = response as EmissionDefinitionDraftSaveResponse;
      setMessage(String(typed.message || (en ? "Draft saved." : "초안을 저장했습니다.")));
      setDraftId(String(typed.draftId || draftId || ""));
      setDefinitionRows(((typed.definitionRows || []) as Array<Record<string, unknown>>));
      if (typed.draftDetail) {
        applyDraft((typed.draftDetail || null) as Record<string, unknown>);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to save draft." : "초안 저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const handlePublishDraft = async () => {
    if (!draftId) {
      setSaveError(en ? "Save the draft before publishing." : "publish 전에 먼저 초안을 저장하세요.");
      return;
    }
    setPublishing(true);
    setSaveError("");
    setMessage("");
    try {
      const response = await publishEmissionDefinitionDraft(draftId);
      const typed = response as EmissionDefinitionDraftSaveResponse;
      setMessage(String(typed.message || (en ? "Publish snapshot saved." : "publish 스냅샷을 저장했습니다.")));
      setDefinitionRows(((typed.definitionRows || []) as Array<Record<string, unknown>>));
      if (typed.draftDetail) {
        applyDraft((typed.draftDetail || null) as Record<string, unknown>);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to publish draft." : "초안 publish에 실패했습니다."));
    } finally {
      setPublishing(false);
    }
  };

  const renderFormulaBlockEditor = (blocks: FormulaBlock[], path: number[] = [], depth = 0) => (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const blockPath = [...path, index];
        return (
          <article className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-4" key={block.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">
                {depth + 1}.{index + 1} {block.kind === "token" ? (en ? "Token" : "토큰") : block.kind.toUpperCase()}
              </p>
              <div className="flex flex-wrap gap-2">
                <MemberButton disabled={index === 0} onClick={() => moveFormulaBlock(blockPath, "up")} type="button" variant="secondary">
                  {en ? "Move up" : "위로"}
                </MemberButton>
                <MemberButton disabled={index >= blocks.length - 1} onClick={() => moveFormulaBlock(blockPath, "down")} type="button" variant="secondary">
                  {en ? "Move down" : "아래로"}
                </MemberButton>
                <MemberButton onClick={() => removeFormulaBlock(blockPath)} type="button" variant="secondary">
                  {en ? "Remove" : "삭제"}
                </MemberButton>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Operator before" : "앞 연산자"}</span>
                <AdminSelect onChange={(event) => updateFormulaBlock(blockPath, { joiner: event.target.value as FormulaJoiner })} value={block.joiner}>
                  <option value="">{en ? "First item" : "첫 항"}</option>
                  <option value="+">+</option>
                  <option value="-">-</option>
                  <option value="×">×</option>
                  <option value="÷">÷</option>
                </AdminSelect>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Block type" : "블럭 타입"}</span>
                <AdminSelect onChange={(event) => updateFormulaBlock(blockPath, { kind: event.target.value as FormulaBlock["kind"] })} value={block.kind}>
                  <option value="token">{en ? "Token" : "토큰"}</option>
                  <option value="sum">SUM</option>
                  <option value="group">{en ? "Group" : "괄호 그룹"}</option>
                  <option value="fraction">{en ? "Fraction" : "분수"}</option>
                </AdminSelect>
              </label>
              {block.kind === "sum" ? (
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Iterator array" : "배열 인덱스"}</span>
                  <AdminInput onChange={(event) => updateFormulaBlock(blockPath, { iterator: event.target.value })} value={block.iterator} />
                </label>
              ) : null}
              {block.kind === "token" ? (
                <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-2">
                  <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Token" : "토큰"}</span>
                  <AdminSelect onChange={(event) => updateFormulaBlock(blockPath, { token: event.target.value })} value={block.token}>
                    {formulaTokenOptions.map((token) => (
                      <option key={`${block.id}-${token}`} value={token}>{token}</option>
                    ))}
                  </AdminSelect>
                </label>
              ) : null}
            </div>

            {block.kind === "token" ? (
              <label className="mt-3 flex flex-col gap-2">
                <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Advanced token edit" : "고급 토큰 편집"}</span>
                <AdminInput onChange={(event) => updateFormulaBlock(blockPath, { token: event.target.value })} value={block.token} />
              </label>
            ) : null}

            {block.kind !== "token" ? (
              <section className="mt-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">
                      {block.kind === "fraction" ? (en ? "Fraction blocks" : "분수 블럭") : (en ? "Nested blocks" : "내부 블럭")}
                    </p>
                    <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                      {block.kind === "sum"
                        ? (en ? "Compose the SUM body with variable and operator blocks." : "SUM 내부식을 변수와 연산 블럭으로 구성합니다.")
                        : block.kind === "group"
                          ? (en ? "Compose the grouped expression in parentheses." : "괄호 내부 수식을 블럭으로 구성합니다.")
                          : (en ? "Build numerator and denominator separately." : "분자와 분모를 각각 블럭으로 구성합니다.")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MemberButton onClick={() => addFormulaBlock(block.kind === "fraction" ? [...blockPath, -1] : blockPath, "token")} type="button" variant="secondary">
                      {en ? "Add token" : "토큰 추가"}
                    </MemberButton>
                    <MemberButton onClick={() => addFormulaBlock(block.kind === "fraction" ? [...blockPath, -1] : blockPath, "sum")} type="button" variant="secondary">
                      {en ? "Add SUM" : "SUM 추가"}
                    </MemberButton>
                    <MemberButton onClick={() => addFormulaBlock(block.kind === "fraction" ? [...blockPath, -1] : blockPath, "group")} type="button" variant="secondary">
                      {en ? "Add group" : "그룹 추가"}
                    </MemberButton>
                    <MemberButton onClick={() => addFormulaBlock(block.kind === "fraction" ? [...blockPath, -1] : blockPath, "fraction")} type="button" variant="secondary">
                      {en ? "Add fraction" : "분수 추가"}
                    </MemberButton>
                  </div>
                </div>

                {block.kind === "fraction" ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Numerator" : "분자"}</p>
                      {renderFormulaBlockEditor(block.numerator, [...blockPath, -1], depth + 1)}
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Denominator" : "분모"}</p>
                      {renderFormulaBlockEditor(block.denominator, [...blockPath, -2], depth + 1)}
                    </div>
                  </div>
                ) : renderFormulaBlockEditor(block.items, blockPath, depth + 1)}
              </section>
            ) : null}
          </article>
        );
      })}
    </div>
  );

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Calculation & Certification" : "산정·인증" },
        { label: en ? "Emission Definition Studio" : "배출 정의 관리" }
      ]}
      title={stringOf(page, en ? "pageTitleEn" : "pageTitle") || (en ? "Emission Definition Studio" : "배출 정의 관리")}
      subtitle={stringOf(page, en ? "pageDescriptionEn" : "pageDescription") || (en ? "Prepare persistable emission calculation definitions before replacing hard-coded rules." : "하드코딩 규칙을 대체하기 전에 저장 가능한 배출 계산 정의 구조를 준비합니다.")}
    >
      {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
      {saveError ? <PageStatusNotice tone="error">{saveError}</PageStatusNotice> : null}
      {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4" data-help-id="emission-definition-summary">
        {summaryCards.map((card) => (
          <article className="gov-card" key={`${stringOf(card, "title")}-${stringOf(card, "value")}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{localizedCardText(en, card, "title")}</p>
            <p className="mt-2 text-3xl font-black text-[var(--kr-gov-blue)]">{stringOf(card, "value")}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{localizedCardText(en, card, "description")}</p>
          </article>
        ))}
      </section>

      <div className="mb-6">
        <EmissionClassificationCatalogPanel
          catalog={classificationCatalog}
          highlightedCode={selectedClassificationCode}
          title={en ? "LCI DB Classification Seed" : "LCI DB 분류 시드"}
        />
      </div>

      <section className="gov-card mb-6" data-help-id="emission-definition-links">
        <div data-help-id="emission-definition-quick-links">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{en ? "Direct Links" : "직접 연결 링크"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Move between the live calculator screen and the future definition-management chain." : "실사용 계산 화면과 향후 정의 관리 체인을 오가며 구조를 정리합니다."}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">{stringOf(page, "menuCode") || "-"}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((link) => (
            <a
              className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4 transition hover:border-[var(--kr-gov-blue)] hover:bg-blue-50"
              href={stringOf(link, "url")}
              key={`${stringOf(link, "label")}-${stringOf(link, "url")}`}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">{stringOf(link, "icon") || "arrow_forward"}</span>
                <div>
                  <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(link, "label")}</p>
                  <p className="mt-1 break-all text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(link, "url")}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="gov-card" data-help-id="emission-definition-draft">
          <div data-help-id="emission-definition-draft-builder">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{en ? "Definition Draft Builder" : "정의 초안 빌더"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Compose the category, tier, formula, and resolution policy that should become a persisted definition row." : "분류, Tier, 수식, 해석 정책을 저장 가능한 정의 행 형태로 먼저 조합합니다."}</p>
            </div>
            <a className="gov-btn gov-btn-secondary" href={buildLocalizedPath("/admin/emission/management", "/en/admin/emission/management")}>
              {en ? "Open live calculator" : "실사용 계산 화면 열기"}
            </a>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-bold">{en ? "Apply LCI classification" : "LCI 분류 적용"}</span>
              <AdminSelect onChange={(event) => setSelectedClassificationCode(event.target.value)} value={selectedClassificationCode}>
                <option value="">{en ? "Not linked" : "연결 안 함"}</option>
                {classificationOptions.map((item) => (
                  <option key={item.code} value={item.code}>
                    {`${item.code} | ${item.pathLabel || item.label}${item.tierLabel ? ` | ${item.tierLabel}` : ""}${item.useAt === "N" ? ` | ${en ? "Hidden" : "숨김"}` : ""}`}
                  </option>
                ))}
              </AdminSelect>
              {selectedClassification ? (
                <p className="text-xs text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? `Applied classification: ${stringOf(selectedClassification, "pathLabel") || stringOf(selectedClassification, "label")} (${stringOf(selectedClassification, "level")}${stringOf(selectedClassification, "tierLabel") ? `, ${stringOf(selectedClassification, "tierLabel")}` : ""})`
                    : `적용 분류: ${stringOf(selectedClassification, "pathLabel") || stringOf(selectedClassification, "label")} (${stringOf(selectedClassification, "level")}${stringOf(selectedClassification, "tierLabel") ? `, ${stringOf(selectedClassification, "tierLabel")}` : ""})`}
                </p>
              ) : null}
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold">{en ? "Category code" : "분류 코드"}</span>
              <AdminInput onChange={(event) => setCategoryCode(event.target.value)} value={categoryCode} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold">{en ? "Category name" : "분류명"}</span>
              <AdminInput onChange={(event) => setCategoryName(event.target.value)} value={categoryName} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold">Tier</span>
              <AdminInput onChange={(event) => setTierLabel(event.target.value)} value={tierLabel} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold">{en ? "Primary input mode" : "기본 입력 타입"}</span>
              <AdminSelect onChange={(event) => setInputMode(event.target.value)} value={inputMode}>
                <option value="NUMBER">NUMBER</option>
                <option value="TEXT">TEXT</option>
                <option value="SELECT">SELECT</option>
              </AdminSelect>
            </label>
          </div>

          <section className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Formula builder" : "수식 빌더"}</p>
                <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Start from one of the six live formulas, then compose token, SUM, group, and fraction blocks."
                    : "현재 운영 중인 6개 수식에서 시작한 뒤 토큰, SUM, 괄호 그룹, 분수 블럭을 선택해 수식을 구성합니다."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <MemberButton onClick={() => addFormulaBlock([], "token")} type="button" variant="secondary">
                  {en ? "Add token" : "토큰 추가"}
                </MemberButton>
                <MemberButton onClick={() => addFormulaBlock([], "sum")} type="button" variant="secondary">
                  {en ? "Add SUM" : "SUM 추가"}
                </MemberButton>
                <MemberButton onClick={() => addFormulaBlock([], "group")} type="button" variant="secondary">
                  {en ? "Add group" : "그룹 추가"}
                </MemberButton>
                <MemberButton onClick={() => addFormulaBlock([], "fraction")} type="button" variant="secondary">
                  {en ? "Add fraction" : "분수 추가"}
                </MemberButton>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {FORMULA_PRESETS.map((preset) => (
                <MemberButton key={preset.id} onClick={() => applyFormulaPreset(preset.id)} type="button" variant="secondary">
                  {en ? preset.labelEn : preset.label}
                </MemberButton>
              ))}
            </div>
            <div className="mt-4">{renderFormulaBlockEditor(formulaBlocks)}</div>
          </section>

          <label className="mt-4 flex flex-col gap-2">
            <span className="text-sm font-bold">{en ? "Formula preview / advanced edit" : "수식 미리보기 / 고급 편집"}</span>
            <textarea
              className="min-h-[120px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]"
              onChange={(event) => setFormula(event.target.value)}
              value={formula}
            />
          </label>

          <section className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Execution preview" : "실행 미리보기"}</p>
                <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Provide scalar and iterator sample values, then run the formula with step traces."
                    : "스칼라 값과 iterator 샘플 값을 넣고 수식을 단계별 trace와 함께 실행합니다."}
                </p>
              </div>
              <MemberButton onClick={runFormulaExecution} type="button" variant="secondary">
                {en ? "Run preview" : "미리보기 실행"}
              </MemberButton>
            </div>
            <label className="mt-4 flex flex-col gap-2">
              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Execution input JSON" : "실행 입력 JSON"}</span>
              <textarea
                className="min-h-[180px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]"
                onChange={(event) => setExecutionValuesJson(event.target.value)}
                value={executionValuesJson}
              />
            </label>
            {executionError ? <PageStatusNotice tone="error">{executionError}</PageStatusNotice> : null}
            {executionResult ? (
              <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Result" : "결과"}</p>
                <p className="mt-2 text-2xl font-black text-[var(--kr-gov-text-primary)]">{executionResult}</p>
                <div className="mt-4 space-y-2">
                  {executionTrace.map((entry, index) => (
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3" key={`${entry.label}-${index}`}>
                      <p className="text-xs font-bold text-[var(--kr-gov-text-primary)]">{entry.label}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{entry.expression}</p>
                      <p className="mt-1 text-sm font-bold text-[var(--kr-gov-blue)]">{entry.result}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
            <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Resolution policy switches" : "해석 정책 스위치"}</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {policyOptions.map((item) => {
                const code = stringOf(item, "code");
                const checked = selectedPolicies.includes(code);
                return (
                  <button
                    className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 text-left transition ${
                      checked ? "border-[var(--kr-gov-blue)] bg-blue-50" : "border-white bg-white hover:border-[var(--kr-gov-border-light)]"
                    }`}
                    key={code}
                    onClick={() => togglePolicy(code)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "label")}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "description")}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${checked ? "bg-blue-100 text-[var(--kr-gov-blue)]" : "bg-slate-100 text-slate-700"}`}>
                        {checked ? (en ? "Included" : "포함") : (en ? "Off" : "미포함")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold">{en ? "Direct-required codes" : "직접입력 필수 코드"}</span>
              <textarea
                className="min-h-[88px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]"
                onChange={(event) => setDirectRequiredCodes(event.target.value)}
                placeholder={en ? "MCI, CCLI, MCL" : "MCI, CCLI, MCL"}
                value={directRequiredCodes}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold">{en ? "Fallback-capable codes" : "대체 허용 코드"}</span>
              <textarea
                className="min-h-[88px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]"
                onChange={(event) => setFallbackCodes(event.target.value)}
                placeholder={en ? "EFCLC, EFC, EFCL" : "EFCLC, EFC, EFCL"}
                value={fallbackCodes}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold">{en ? "Auto-calculated codes" : "자동계산 코드"}</span>
              <textarea
                className="min-h-[88px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]"
                onChange={(event) => setAutoCalculatedCodes(event.target.value)}
                placeholder={en ? "CFCKD, EFI, EFK" : "CFCKD, EFI, EFK"}
                value={autoCalculatedCodes}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold">{en ? "Supplemental codes" : "보조 입력 코드"}</span>
              <textarea
                className="min-h-[88px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]"
                onChange={(event) => setSupplementalCodes(event.target.value)}
                placeholder={en ? "MD, CD, FD" : "MD, CD, FD"}
                value={supplementalCodes}
              />
            </label>
          </div>

          <section className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Section block editor" : "섹션 블록 편집기"}</p>
                <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Design block headers, descriptions, formulas, and previews before attaching variable rows."
                    : "변수 행을 붙이기 전에 블록 헤더, 설명, 수식, 미리보기를 먼저 설계합니다."}
                </p>
              </div>
              <MemberButton onClick={addSectionDefinitionRow} type="button" variant="secondary">
                {en ? "Add section block" : "섹션 블록 추가"}
              </MemberButton>
            </div>
            <div className="mt-4 space-y-3">
              {editableSectionDefinitions.length > 0 ? editableSectionDefinitions.map((section, index) => (
                <article className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-4" key={`section-row-${index}-${section.sectionId || "new"}`}>
                  {(() => {
                    const boundVariables = editableVariableDefinitions.filter((row) => row.sectionId === section.sectionId);
                    return (
                      <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">
                      {index + 1}. {section.sectionId || (en ? `Section ${index + 1}` : `섹션 ${index + 1}`)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <MemberButton disabled={index === 0} onClick={() => moveSectionDefinitionRow(index, "up")} type="button" variant="secondary">
                        {en ? "Move up" : "위로"}
                      </MemberButton>
                      <MemberButton disabled={index >= editableSectionDefinitions.length - 1} onClick={() => moveSectionDefinitionRow(index, "down")} type="button" variant="secondary">
                        {en ? "Move down" : "아래로"}
                      </MemberButton>
                      <MemberButton onClick={() => applySectionTemplate(index, "scope")} type="button" variant="secondary">
                        {en ? "Scope template" : "범위 템플릿"}
                      </MemberButton>
                      <MemberButton onClick={() => applySectionTemplate(index, "factor_block")} type="button" variant="secondary">
                        {en ? "Factor template" : "계수 템플릿"}
                      </MemberButton>
                      <MemberButton disabled={!section.sectionId} onClick={() => addVariableDefinitionRowForSection(section.sectionId)} type="button" variant="secondary">
                        {en ? "Add bound variable" : "연결 변수 추가"}
                      </MemberButton>
                      <MemberButton onClick={() => removeSectionDefinitionRow(index)} type="button" variant="secondary">
                        {en ? "Remove" : "삭제"}
                      </MemberButton>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">
                        {en ? "Bound variables" : "연결 변수"}
                      </p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700">
                        {boundVariables.length}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {boundVariables.length > 0 ? boundVariables.map((row, rowIndex) => (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--kr-gov-text-primary)]" key={`bound-variable-${section.sectionId}-${row.varCode || rowIndex}`}>
                          {row.varCode || (en ? `Variable ${rowIndex + 1}` : `변수 ${rowIndex + 1}`)}
                        </span>
                      )) : (
                        <span className="text-xs text-[var(--kr-gov-text-secondary)]">
                          {en ? "No variable rows are bound to this section yet." : "이 섹션에 연결된 변수 행이 아직 없습니다."}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Section ID" : "섹션 ID"}</span>
                      <AdminInput onChange={(event) => updateSectionDefinitionRow(index, "sectionId", event.target.value)} value={section.sectionId} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Section title" : "섹션 제목"}</span>
                      <AdminInput onChange={(event) => updateSectionDefinitionRow(index, "sectionTitle", event.target.value)} value={section.sectionTitle} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Section preview type" : "섹션 미리보기 타입"}</span>
                      <AdminInput onChange={(event) => updateSectionDefinitionRow(index, "sectionPreviewType", event.target.value)} value={section.sectionPreviewType} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Section formula" : "섹션 수식"}</span>
                      <AdminInput onChange={(event) => updateSectionDefinitionRow(index, "sectionFormula", event.target.value)} value={section.sectionFormula} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Section order" : "섹션 순서"}</span>
                      <AdminInput onChange={(event) => updateSectionDefinitionRow(index, "sectionOrder", Number(event.target.value) || 0)} type="number" value={String(section.sectionOrder)} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "UI hint" : "UI 힌트"}</span>
                      <AdminInput onChange={(event) => updateSectionDefinitionRow(index, "uiHint", event.target.value)} value={section.uiHint} />
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-3">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Section related factor codes" : "섹션 연관 계수 코드"}</span>
                      <AdminInput onChange={(event) => updateSectionDefinitionRow(index, "sectionRelatedFactorCodes", event.target.value)} value={section.sectionRelatedFactorCodes} />
                    </label>
                  </div>
                  <label className="mt-3 flex flex-col gap-2">
                    <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Section description" : "섹션 설명"}</span>
                    <textarea
                      className="min-h-[84px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]"
                      onChange={(event) => updateSectionDefinitionRow(index, "sectionDescription", event.target.value)}
                      value={section.sectionDescription}
                    />
                  </label>
                  <section className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Section templates" : "섹션 템플릿"}</p>
                        <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                          {en ? "Quickly place this block into a common workflow section." : "자주 쓰는 워크플로우 섹션으로 빠르게 배치합니다."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <MemberButton onClick={() => applySectionTemplate(index, "scope")} type="button" variant="secondary">
                          {en ? "Scope" : "범위"}
                        </MemberButton>
                        <MemberButton onClick={() => applySectionTemplate(index, "material_input")} type="button" variant="secondary">
                          {en ? "Material" : "원료"}
                        </MemberButton>
                        <MemberButton onClick={() => applySectionTemplate(index, "factor_block")} type="button" variant="secondary">
                          {en ? "Factor" : "계수"}
                        </MemberButton>
                        <MemberButton onClick={() => applySectionTemplate(index, "result_block")} type="button" variant="secondary">
                          {en ? "Result" : "결과"}
                        </MemberButton>
                      </div>
                    </div>
                  </section>
                  <section className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Preview presets" : "미리보기 preset"}</p>
                        <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                          {en ? "Attach the runtime preview behavior used by the management screen." : "관리 화면에서 쓰는 런타임 미리보기 동작을 연결합니다."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <MemberButton onClick={() => applyPreviewPreset(index, "factor_preview")} type="button" variant="secondary">
                          {en ? "Factor preview" : "계수 미리보기"}
                        </MemberButton>
                        <MemberButton onClick={() => applyPreviewPreset(index, "result_preview")} type="button" variant="secondary">
                          {en ? "Result preview" : "결과 미리보기"}
                        </MemberButton>
                        <MemberButton onClick={() => applyPreviewPreset(index, "cement_tier2_cf")} type="button" variant="secondary">
                          {en ? "Cement T2 CF" : "시멘트 T2 CF"}
                        </MemberButton>
                        <MemberButton onClick={() => applyPreviewPreset(index, "lime_tier2_ef")} type="button" variant="secondary">
                          {en ? "Lime T2 EF" : "석회 T2 EF"}
                        </MemberButton>
                        <MemberButton onClick={() => applyPreviewPreset(index, "lime_tier2_cf")} type="button" variant="secondary">
                          {en ? "Lime T2 CF" : "석회 T2 CF"}
                        </MemberButton>
                        <MemberButton onClick={() => applyPreviewPreset(index, "lime_tier2_ch")} type="button" variant="secondary">
                          {en ? "Lime T2 Ch" : "석회 T2 Ch"}
                        </MemberButton>
                      </div>
                    </div>
                  </section>
                      </>
                    );
                  })()}
                </article>
              )) : (
                <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "No section blocks yet. Add a block first, then bind variable rows to it." : "아직 섹션 블록이 없습니다. 먼저 블록을 추가한 뒤 변수 행을 연결하세요."}
                </div>
              )}
            </div>
          </section>

          <section className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Variable row editor" : "변수 행 편집기"}</p>
                <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Edit variable rows as form fields first. The JSON editor below remains available for advanced keys."
                    : "먼저 폼으로 변수 행을 편집하고, 아래 JSON 편집기는 고급 키 조정용으로 유지합니다."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <MemberButton onClick={seedVariableDefinitionRows} type="button" variant="secondary">
                  {en ? "Seed from policy codes" : "정책 코드로 초안 생성"}
                </MemberButton>
                <MemberButton onClick={addVariableDefinitionRow} type="button" variant="secondary">
                  {en ? "Add variable row" : "변수 행 추가"}
                </MemberButton>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {editableVariableDefinitions.length > 0 ? editableVariableDefinitions.map((row, index) => (
                <article className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-4" key={`variable-row-${index}-${row.varCode || "new"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">
                      {index + 1}. {row.varCode || (en ? `Variable ${index + 1}` : `변수 ${index + 1}`)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <MemberButton disabled={index === 0} onClick={() => moveVariableDefinitionRow(index, "up")} type="button" variant="secondary">
                        {en ? "Move up" : "위로"}
                      </MemberButton>
                      <MemberButton disabled={index >= editableVariableDefinitions.length - 1} onClick={() => moveVariableDefinitionRow(index, "down")} type="button" variant="secondary">
                        {en ? "Move down" : "아래로"}
                      </MemberButton>
                      <MemberButton onClick={() => removeVariableDefinitionRow(index)} type="button" variant="secondary">
                        {en ? "Remove" : "삭제"}
                      </MemberButton>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">varCode</span>
                      <AdminInput onChange={(event) => updateVariableDefinitionRow(index, "varCode", event.target.value.toUpperCase())} value={row.varCode} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Variable name" : "변수명"}</span>
                      <AdminInput onChange={(event) => updateVariableDefinitionRow(index, "varName", event.target.value)} value={row.varName} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Display name" : "표시명"}</span>
                      <AdminInput onChange={(event) => updateVariableDefinitionRow(index, "displayName", event.target.value)} value={row.displayName} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Input type" : "입력 타입"}</span>
                      <AdminSelect onChange={(event) => updateVariableDefinitionRow(index, "inputType", event.target.value)} value={row.inputType}>
                        <option value="NUMBER">NUMBER</option>
                        <option value="TEXT">TEXT</option>
                        <option value="SELECT">SELECT</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Unit" : "단위"}</span>
                      <AdminInput onChange={(event) => updateVariableDefinitionRow(index, "unit", event.target.value)} value={row.unit} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "UI hint" : "UI 힌트"}</span>
                      <AdminInput onChange={(event) => updateVariableDefinitionRow(index, "uiHint", event.target.value)} value={row.uiHint} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Common code ID" : "공통코드 ID"}</span>
                      <AdminInput onChange={(event) => updateVariableDefinitionRow(index, "commonCodeId", event.target.value.toUpperCase())} value={row.commonCodeId} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Required" : "필수"}</span>
                      <AdminSelect onChange={(event) => updateVariableDefinitionRow(index, "isRequired", event.target.value)} value={row.isRequired}>
                        <option value="">{en ? "Unset" : "미지정"}</option>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Repeatable" : "반복 입력"}</span>
                      <AdminSelect onChange={(event) => updateVariableDefinitionRow(index, "isRepeatable", event.target.value)} value={row.isRepeatable}>
                        <option value="">{en ? "Unset" : "미지정"}</option>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Supplemental" : "보조 입력"}</span>
                      <AdminSelect onChange={(event) => updateVariableDefinitionRow(index, "supplementalYn", event.target.value)} value={row.supplementalYn}>
                        <option value="">{en ? "Unset" : "미지정"}</option>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Section ID" : "섹션 ID"}</span>
                      <AdminSelect onChange={(event) => updateVariableDefinitionRow(index, "sectionId", event.target.value)} value={row.sectionId}>
                        <option value="">{en ? "Unassigned" : "미지정"}</option>
                        {sectionBindingOptions.map((option) => (
                          <option key={`section-bind-${option.value}`} value={option.value}>{option.label}</option>
                        ))}
                      </AdminSelect>
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-3">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Visible rule" : "노출 규칙"}</span>
                      <AdminInput onChange={(event) => updateVariableDefinitionRow(index, "visibleWhen", event.target.value)} placeholder="LIME_TYPE in DOLOMITIC|DOLOMITIC_HIGH|DOLOMITIC_LOW" value={String((row as Record<string, unknown>).visibleWhen || "")} />
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-3">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Disabled rule" : "비활성 규칙"}</span>
                      <AdminInput onChange={(event) => updateVariableDefinitionRow(index, "disabledWhen", event.target.value)} placeholder="HYDRATED_LIME_PRODUCTION_YN=N" value={String((row as Record<string, unknown>).disabledWhen || "")} />
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Sort order" : "정렬 순서"}</span>
                      <AdminInput onChange={(event) => updateVariableDefinitionRow(index, "sortOrder", Number(event.target.value) || 0)} type="number" value={String(row.sortOrder)} />
                    </label>
                  </div>
                  <label className="mt-3 flex flex-col gap-2">
                    <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Description" : "설명"}</span>
                    <textarea
                      className="min-h-[84px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]"
                      onChange={(event) => updateVariableDefinitionRow(index, "varDesc", event.target.value)}
                      value={row.varDesc}
                    />
                  </label>
                  {row.inputType === "SELECT" ? (
                    <section className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Select options" : "선택 옵션"}</p>
                          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                            {en ? "Define the code/label pairs used by this SELECT variable." : "이 SELECT 변수에 사용할 코드/라벨 쌍을 정의합니다."}
                          </p>
                        </div>
                        <MemberButton onClick={() => addVariableDefinitionOption(index)} type="button" variant="secondary">
                          {en ? "Add option" : "옵션 추가"}
                        </MemberButton>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <MemberButton onClick={() => applySelectPreset(index, "carbonate_type")} type="button" variant="secondary">
                          {en ? "Carbonate preset" : "탄산염 preset"}
                        </MemberButton>
                        <MemberButton onClick={() => applySelectPreset(index, "lime_type_tier1")} type="button" variant="secondary">
                          {en ? "Lime T1 preset" : "석회 T1 preset"}
                        </MemberButton>
                        <MemberButton onClick={() => applySelectPreset(index, "lime_type_tier23")} type="button" variant="secondary">
                          {en ? "Lime T2/3 preset" : "석회 T2/3 preset"}
                        </MemberButton>
                        <MemberButton onClick={() => applySelectPreset(index, "hydrated_lime_yn")} type="button" variant="secondary">
                          {en ? "Hydrated Y/N preset" : "수화 여부 preset"}
                        </MemberButton>
                      </div>
                      <div className="mt-4 space-y-3">
                        {Array.isArray(row.options) && row.options.length > 0 ? row.options.map((option, optionIndex) => (
                          <div className="grid grid-cols-1 gap-3 rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-4 md:grid-cols-[1fr_1.2fr_1.5fr_auto]" key={`option-${index}-${optionIndex}`}>
                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Code" : "코드"}</span>
                              <AdminInput onChange={(event) => updateVariableDefinitionOption(index, optionIndex, "code", event.target.value)} value={String(option.code || "")} />
                            </label>
                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Label" : "라벨"}</span>
                              <AdminInput onChange={(event) => updateVariableDefinitionOption(index, optionIndex, "label", event.target.value)} value={String(option.label || "")} />
                            </label>
                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Description" : "설명"}</span>
                              <AdminInput onChange={(event) => updateVariableDefinitionOption(index, optionIndex, "description", event.target.value)} value={String(option.description || "")} />
                            </label>
                            <div className="flex items-end">
                              <MemberButton onClick={() => removeVariableDefinitionOption(index, optionIndex)} type="button" variant="secondary">
                                {en ? "Remove" : "삭제"}
                              </MemberButton>
                            </div>
                          </div>
                        )) : (
                          <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
                            {en ? "No select options defined yet." : "아직 선택 옵션이 없습니다."}
                          </div>
                        )}
                      </div>
                    </section>
                  ) : null}
                </article>
              )) : (
                <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "No variable override rows yet. Add a row or seed from current policy codes." : "아직 변수 override 행이 없습니다. 행을 추가하거나 현재 정책 코드로 초안을 만드세요."}
                </div>
              )}
            </div>
          </section>

          <label className="mt-4 flex flex-col gap-2">
            <span className="text-sm font-bold">{en ? "Section blocks JSON" : "섹션 블록 JSON"}</span>
            <textarea
              className="min-h-[180px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-950 px-4 py-3 font-mono text-xs leading-6 text-slate-100"
              onChange={(event) => setSectionDefinitionsJson(event.target.value)}
              placeholder='[{"sectionId":"factor-block","sectionTitle":"Factor and correction","sectionPreviewType":"factor-preview"}]'
              value={sectionDefinitionsJson}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-1 font-bold ${parsedSectionDefinitions == null ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {parsedSectionDefinitions == null
                  ? (en ? "JSON invalid" : "JSON 오류")
                  : `${en ? "Sections" : "섹션"} ${parsedSectionDefinitions.length}`}
              </span>
              <span className="text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Supported keys include sectionId, sectionTitle, sectionDescription, sectionFormula, sectionPreviewType, sectionRelatedFactorCodes, sectionOrder, uiHint."
                  : "지원 키: sectionId, sectionTitle, sectionDescription, sectionFormula, sectionPreviewType, sectionRelatedFactorCodes, sectionOrder, uiHint"}
              </span>
            </div>
          </label>

          <label className="mt-4 flex flex-col gap-2">
            <span className="text-sm font-bold">{en ? "Variable definition overrides JSON" : "변수 정의 override JSON"}</span>
            <textarea
              className="min-h-[220px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-950 px-4 py-3 font-mono text-xs leading-6 text-slate-100"
              onChange={(event) => setVariableDefinitionsJson(event.target.value)}
              placeholder='[{"varCode":"MCI","displayName":"Clinker production","inputType":"NUMBER"}]'
              value={variableDefinitionsJson}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-1 font-bold ${parsedVariableDefinitions == null ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {parsedVariableDefinitions == null
                  ? (en ? "JSON invalid" : "JSON 오류")
                  : `${en ? "Rows" : "행"} ${parsedVariableDefinitions.length}`}
              </span>
              <span className="text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Supported keys include varCode, varName, varDesc, displayName, displayCode, unit, inputType, commonCodeId, supplementalYn, isRequired, isRepeatable, sortOrder, sectionId, visibleWhen, disabledWhen, options."
                  : "지원 키: varCode, varName, varDesc, displayName, displayCode, unit, inputType, commonCodeId, supplementalYn, isRequired, isRepeatable, sortOrder, sectionId, visibleWhen, disabledWhen, options"}
              </span>
            </div>
          </label>

          <label className="mt-4 flex flex-col gap-2">
            <span className="text-sm font-bold">{en ? "Governance note" : "거버넌스 메모"}</span>
            <textarea
              className="min-h-[96px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]"
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </label>

          <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
            <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Publish snapshot status" : "Publish 스냅샷 상태"}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Publish now carries an explicit runtime mode. AUTO preserves match-only adoption, SHADOW keeps legacy active, and PRIMARY promotes the published formula when it is evaluable."
                : "이제 publish 스냅샷에는 runtime mode가 함께 저장됩니다. AUTO는 일치 시 채택, SHADOW는 비교만, PRIMARY는 평가 가능하면 published formula를 우선 실행합니다."}
            </p>
            <label className="mt-4 flex max-w-[320px] flex-col gap-2">
              <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Runtime mode" : "런타임 모드"}</span>
              <AdminSelect onChange={(event) => setRuntimeMode(event.target.value)} value={runtimeMode}>
                <option value="AUTO">{en ? "AUTO · adopt on exact match" : "AUTO · 정확히 일치하면 채택"}</option>
                <option value="SHADOW">{en ? "SHADOW · compare only" : "SHADOW · 비교만 수행"}</option>
                <option value="PRIMARY">{en ? "PRIMARY · published formula first" : "PRIMARY · published formula 우선"}</option>
              </AdminSelect>
            </label>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--kr-gov-text-secondary)]">
              <span>{en ? "Current status" : "현재 상태"}: {stringOf(activeDraftRow || undefined, "statusLabel") || (draftId ? (en ? "Draft" : "초안") : "-")}</span>
              <span>{en ? "Runtime mode" : "런타임 모드"}: {stringOf(activeDraftRow || undefined, "runtimeModeLabel") || runtimeMode}</span>
              <span>{en ? "Published version" : "배포 버전"}: {stringOf(activeDraftRow || undefined, "publishedVersionId") || "-"}</span>
              <span>{en ? "Published at" : "배포 시각"}: {stringOf(activeDraftRow || undefined, "publishedSavedAt") || "-"}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <MemberButton onClick={() => {
              applyDraft(null);
            }} type="button" variant="secondary">
              {en ? "Reset draft" : "초안 초기화"}
            </MemberButton>
            <MemberButton disabled={saving} onClick={() => { void handleSaveDraft(); }} type="button">
              {saving ? (en ? "Saving..." : "저장 중...") : (draftId ? (en ? "Update draft" : "초안 수정") : (en ? "Save draft" : "초안 저장"))}
            </MemberButton>
            <MemberButton disabled={publishing || !draftId} onClick={() => { void handlePublishDraft(); }} type="button" variant="secondary">
              {publishing ? (en ? "Publishing..." : "배포 중...") : (en ? "Publish snapshot" : "Publish 스냅샷")}
            </MemberButton>
            <a className="gov-btn gov-btn-primary" href={buildLocalizedPath("/admin/emission/management", "/en/admin/emission/management")}>
              {en ? "Back to variable management" : "배출 변수 관리로 이동"}
            </a>
          </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="gov-card">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold">{en ? "Saved Definition Drafts" : "저장된 정의 초안"}</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{definitionRows.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {definitionRows.length > 0 ? definitionRows.map((item) => {
                const active = draftId && draftId === stringOf(item, "draftId");
                return (
                  <button
                    className={`w-full rounded-[var(--kr-gov-radius)] border px-4 py-3 text-left transition ${
                      active ? "border-[var(--kr-gov-blue)] bg-blue-50" : "border-[var(--kr-gov-border-light)] bg-white hover:border-[var(--kr-gov-blue)]"
                    }`}
                    key={stringOf(item, "draftId")}
                    onClick={() => applyDraft(item)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(item, "categoryCode")} / {stringOf(item, "tierLabel")}</p>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[var(--kr-gov-blue)]">{stringOf(item, "statusLabel") || "DRAFT"}</span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "categoryName")}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(item, "formula")}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--kr-gov-text-secondary)]">
                      <span>{stringOf(item, "lastSavedAt") || "-"}</span>
                      <span>{stringOf(item, "lastSavedBy") || "-"}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                        {en ? "Sections" : "섹션"} {stringOf(item, "sectionCount") || "0"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                        {en ? "Direct" : "직접"} {stringOf(item, "directRequiredCount") || "0"}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                        {en ? "Fallback" : "대체"} {stringOf(item, "fallbackCount") || "0"}
                      </span>
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                        {en ? "Auto" : "자동"} {stringOf(item, "autoCalculatedCount") || "0"}
                      </span>
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-700">
                        {en ? "Supplemental" : "보조"} {stringOf(item, "supplementalCount") || "0"}
                      </span>
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700">
                        {en ? "Variables" : "변수정의"} {stringOf(item, "variableDefinitionCount") || "0"}
                      </span>
                    </div>
                  </button>
                );
              }) : (
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No saved definition drafts yet." : "저장된 정의 초안이 아직 없습니다."}</p>
              )}
            </div>
          </section>

          <section className="gov-card">
            <h3 className="text-lg font-bold">{en ? "Live Seeds" : "현재 시드 구조"}</h3>
            <div className="mt-4 space-y-3">
              {seedCategories.map((item) => (
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3" key={stringOf(item, "code")}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(item, "label")}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{stringOf(item, "code")}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "status")}</p>
                  <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(item, "tiers")}</p>
                </article>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {seedTiers.map((item) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3" key={stringOf(item, "tier")}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{stringOf(item, "tier")}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[var(--kr-gov-blue)]">{stringOf(item, "policies")}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "summary")}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="gov-card" data-help-id="emission-definition-preview">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold">{en ? "Staged Payload Preview" : "저장 페이로드 미리보기"}</h3>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{draftId || (en ? "new" : "신규")}</span>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-950 px-4 py-4 text-xs leading-6 text-slate-100">
              {JSON.stringify(stagedPayload, null, 2)}
            </pre>
          </section>

          <section className="gov-card" data-help-id="emission-definition-checklist">
            <h3 className="text-lg font-bold">{en ? "Save Readiness Checklist" : "저장 전 체크리스트"}</h3>
            <div className="mt-4 space-y-2">
              {saveChecklist.map((item, index) => (
                <div className="flex items-start gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3" key={`check-${index}`}>
                  <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">check_circle</span>
                  <p className="text-sm text-[var(--kr-gov-text-primary)]">{stringOf(item, "text")}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm font-bold text-amber-900">{en ? "Governance Notes" : "운영 메모"}</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
                {governanceNotes.map((item, index) => (
                  <li key={`note-${index}`}>{stringOf(item, "text")}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </AdminPageShell>
  );
}
