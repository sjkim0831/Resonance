import { Fragment, useEffect, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  calculateEmissionInputSession,
  fetchEmissionCategories,
  fetchEmissionInputSession,
  fetchEmissionLimeDefaultFactor,
  fetchEmissionManagementPage,
  fetchEmissionScopeStatus,
  fetchEmissionTiers,
  fetchEmissionVariableDefinitions,
  materializeEmissionDefinitionScope,
  precheckEmissionDefinitionScope,
  saveEmissionManagementElementDefinition,
  saveEmissionInputSession
} from "../../lib/api/emission";
import type {
  EmissionCategoryItem,
  EmissionFactorDefinition,
  EmissionInputValuePayload,
  EmissionManagementElementSaveResponse,
  EmissionManagementPagePayload,
  EmissionTierItem,
  EmissionVariableDefinition
} from "../../lib/api/emissionTypes";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, CollectionResultPanel, DiagnosticCard, LookupContextStrip, MemberActionBar, MemberButton, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { EmissionClassificationCatalogPanel } from "../emission-common/EmissionClassificationCatalogPanel";
import {
  type InputMap,
  type InputRow,
  type TierGuide,
  type WizardStep,
  DEFAULT_INPUT_ROW,
  alignedRowsForRemoval,
  arrayOf,
  buildEmptyInputs,
  buildSummationGroups,
  buildTierGuide,
  buildVariableSections,
  carbonateFactorOf,
  cementTier2DerivedSummary,
  displayVariableCode,
  displayVariableName,
  hydrateInputs,
  isCementTier2Scope,
  isConditionallyDisabledVariable,
  isDerivedCarbonateFactorVariable,
  isLimeTier2Scope,
  isLimeTier2SupplementalVariable,
  isRepeatableVariable,
  isRequiredVariable,
  limeTier2DerivedSummary,
  limeTier2VariableHint,
  numberOf,
  resolutionGuideForVariable,
  shouldShowConditionalVariable,
  stringOf,
  syncLineNumbers,
  variableCodeOf,
  variableOptions,
  visibleVariablesForStep
} from "./emissionManagementShared";

function splitFormulaToken(token: string) {
  const directMatch = token.match(/^([A-Za-z가-힣·]+)(?:_([A-Za-z0-9가-힣·]+))?(?:,([A-Za-z0-9가-힣]+))?$/);
  if (directMatch && (directMatch[2] || directMatch[3])) {
    return {
      head: directMatch[1],
      sub: `${directMatch[2] || ""}${directMatch[2] && directMatch[3] ? "," : ""}${directMatch[3] || ""}`
    };
  }
  const compactMatch = token.match(/^([A-Z]{1,3})([a-z]+(?:,[A-Za-z0-9]+)?)$/);
  if (compactMatch) {
    return {
      head: compactMatch[1],
      sub: compactMatch[2]
    };
  }
  return null;
}

function documentFormulaText(formula: string) {
  return formula
    .replace(/\bEFI\b/g, "EFi")
    .replace(/\bEFK\b/g, "EFk")
    .replace(/\bMI\b/g, "Mi")
    .replace(/\bFI\b/g, "Fi")
    .replace(/\bMK\b/g, "Mk")
    .replace(/\bXK\b/g, "Xk")
    .replace(/\bMCL\b/g, "Mcl")
    .replace(/\bEFCL\b/g, "EFcl")
    .replace(/\bEFCLC\b/g, "EFclc")
    .replace(/\bCFCKD\b/g, "CFckd")
    .replace(/\bIM\b/g, "Im")
    .replace(/\bEX\b/g, "Ex")
    .replace(/\bMD\b/g, "Md")
    .replace(/\bCD\b/g, "Cd")
    .replace(/\bFD\b/g, "Fd")
    .replace(/\s*,\s*,+\s*/g, ", ")
    .replace(/,{2,}/g, ",")
    .replace(/,\s*,/g, ",");
}

function displayUnitLabel(unit: string, en: boolean) {
  const normalized = stringOf(unit).trim();
  if (!normalized) {
    return "-";
  }
  if (normalized === "ton") {
    return en ? "metric tons" : "톤";
  }
  if (normalized === "ratio") {
    return en ? "ratio" : "비율";
  }
  if (normalized === "YN") {
    return en ? "yes/no" : "예/아니오";
  }
  if (normalized === "tCO2/ton") {
    return en ? "tCO2 per ton" : "톤당 CO2 배출량";
  }
  if (normalized === "tCO2/t-lime") {
    return en ? "tCO2 per ton of lime" : "석회 1톤당 CO2 배출량";
  }
  if (normalized === "tCO2/t-CaO") {
    return en ? "tCO2 per ton of CaO" : "CaO 1톤당 CO2 환산량";
  }
  if (normalized === "tCO2/t-CaO·MgO") {
    return en ? "tCO2 per ton of CaO·MgO" : "CaO·MgO 1톤당 CO2 환산량";
  }
  return normalized;
}

function appliedFactorLabel(factor: Record<string, unknown>, en: boolean) {
  const source = stringOf(factor.source).toUpperCase();
  if (source === "EF_LIME") {
    return en ? "Applied lime emission factor" : "적용 석회 배출계수";
  }
  if (source === "CF_LKD") {
    return en ? "Applied LKD correction factor" : "적용 LKD 보정계수";
  }
  if (source === "C_H") {
    return en ? "Applied hydrated-lime correction" : "적용 수화석회 보정계수";
  }
  if (source === "EFI") {
    return en ? "Applied carbonate emission factor" : "적용 탄산염 배출계수";
  }
  if (source === "EFK") {
    return en ? "Applied raw-material emission factor" : "적용 원료 배출계수";
  }
  if (source === "EFD") {
    return en ? "Applied residual carbonate factor" : "적용 잔류 탄산염 계수";
  }
  return en ? "Applied factor" : "적용 계수";
}

function appliedFactorContext(factor: Record<string, unknown>, en: boolean) {
  const source = stringOf(factor.source).toUpperCase();
  const lineNo = numberOf(factor.lineNo);
  const linePrefix = lineNo > 0 ? `${en ? "Line" : "라인"} ${lineNo} · ` : "";
  if (source === "EF_LIME") {
    return `${linePrefix}${en ? "formula term EF석회,i" : "수식 항 EF석회,i"}`;
  }
  if (source === "CF_LKD") {
    return `${linePrefix}${en ? "formula term CF_lkd,i" : "수식 항 CF_lkd,i"}`;
  }
  if (source === "C_H") {
    return `${linePrefix}${en ? "formula term C_h,i" : "수식 항 C_h,i"}`;
  }
  if (source === "EFI") {
    return `${linePrefix}${en ? "formula term EFi" : "수식 항 EFi"}`;
  }
  if (source === "EFK") {
    return `${linePrefix}${en ? "formula term EFk" : "수식 항 EFk"}`;
  }
  if (source === "EFD") {
    return `${linePrefix}${en ? "formula term EFd" : "수식 항 EFd"}`;
  }
  return linePrefix || (en ? "Applied during calculation" : "계산 중 적용");
}

function appliedFactorSourceBadge(factor: Record<string, unknown>, en: boolean) {
  const defaultApplied = Boolean(factor.defaultApplied);
  if (defaultApplied) {
    return en ? "Default/Mapped" : "기본값/매핑";
  }
  return en ? "Saved/Entered" : "저장값/입력값";
}

function localizedLimeTypeLabel(value: string, en: boolean) {
  const normalized = stringOf(value).trim().toUpperCase();
  if (normalized === "HIGH_CALCIUM") {
    return en ? "high-calcium lime" : "고칼슘석회";
  }
  if (normalized === "HYDRAULIC") {
    return en ? "hydraulic lime" : "수경성석회";
  }
  if (normalized === "DOLOMITIC") {
    return en ? "dolomitic lime" : "고토석회";
  }
  if (normalized === "DOLOMITIC_HIGH") {
    return en ? "dolomitic lime (high-grade)" : "고토석회(선진국 기준)";
  }
  if (normalized === "DOLOMITIC_LOW") {
    return en ? "dolomitic lime (low-grade)" : "고토석회(개도국 기준)";
  }
  return stringOf(value);
}

function rolloutStatusTone(status: string) {
  if (status === "READY" || status === "PRIMARY_READY") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "BLOCKED") {
    return "bg-rose-100 text-rose-700";
  }
  if (status === "PRIMARY_WITH_DRIFT") {
    return "bg-violet-100 text-violet-700";
  }
  if (status === "SHADOW_ONLY") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

function rolloutStatusLabel(status: string, en: boolean) {
  if (status === "READY") {
    return en ? "Ready to switch" : "치환 가능";
  }
  if (status === "PRIMARY_READY") {
    return en ? "Primary ready" : "우선 실행";
  }
  if (status === "BLOCKED") {
    return en ? "Blocked" : "치환 보류";
  }
  if (status === "PRIMARY_WITH_DRIFT") {
    return en ? "Primary with drift" : "우선 실행(차이 있음)";
  }
  if (status === "SHADOW_ONLY") {
    return en ? "Shadow only" : "비교만";
  }
  return en ? "Legacy only" : "레거시만";
}

function definitionScopeStatusTone(status: string) {
  if (status === "READY") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "MISSING_CALCULATION") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-slate-200 text-slate-700";
}

function definitionScopeStatusLabel(status: string, en: boolean) {
  if (status === "READY") {
    return en ? "Runtime ready" : "런타임 가능";
  }
  if (status === "MISSING_CALCULATION") {
    return en ? "Calc missing" : "계산기 미연결";
  }
  if (status === "STUDIO_ONLY_TIER") {
    return en ? "Studio-only tier" : "스튜디오 전용 Tier";
  }
  if (status === "STUDIO_ONLY_CATEGORY") {
    return en ? "Studio-only category" : "스튜디오 전용 분류";
  }
  return en ? "Pending" : "대기";
}

type ClassificationOption = {
  code: string;
  label: string;
};

type CategoryClassificationMeta = {
  majorCode: string;
  majorName: string;
  middleCode: string;
  middleName: string;
  smallCode: string;
  smallName: string;
  tierLabel: string;
  pathLabel: string;
};

function classificationRowForCategory(category: EmissionCategoryItem | null | undefined, catalogRows: Array<Record<string, unknown>>) {
  const classificationCode = stringOf(category?.classificationCode);
  const alias = stringOf(category?.subCode).trim().toUpperCase();
  return catalogRows.find((row) => {
    if (stringOf(row.code) === classificationCode) {
      return true;
    }
    const aliases = Array.isArray(row.aliases) ? (row.aliases as Array<unknown>).map((item) => stringOf(item).trim().toUpperCase()) : [];
    return alias.length > 0 && aliases.includes(alias);
  }) || null;
}

function classificationMetaOf(category: EmissionCategoryItem | null | undefined, catalogRows: Array<Record<string, unknown>>): CategoryClassificationMeta {
  const matched = classificationRowForCategory(category, catalogRows);
  const pathParts = stringOf(category?.classificationPath)
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  const classificationCode = stringOf(category?.classificationCode);
  const majorCode = stringOf(matched?.majorCode) || (classificationCode.length >= 2 ? classificationCode.slice(0, 2) : "");
  const middleCode = stringOf(matched?.middleCode) || (classificationCode.length >= 4 ? classificationCode.slice(0, 4) : "");
  const smallCode = stringOf(matched?.smallCode) || (classificationCode.length >= 6 ? classificationCode.slice(0, 6) : classificationCode);
  const majorName = stringOf(matched?.majorName) || pathParts[0] || stringOf(category?.majorName);
  const middleName = stringOf(matched?.middleName) || pathParts[1];
  const smallName = stringOf(matched?.smallName) || pathParts[2] || stringOf(category?.subName);
  const pathLabel = stringOf(category?.classificationPath) || stringOf(matched?.pathLabel);
  const tierLabel = stringOf(category?.classificationTierLabel) || stringOf(matched?.tierLabel);
  return {
    majorCode,
    majorName,
    middleCode,
    middleName,
    smallCode,
    smallName,
    tierLabel,
    pathLabel
  };
}

function buildClassificationMajorOptions(categories: EmissionCategoryItem[], catalogRows: Array<Record<string, unknown>>) {
  const deduped = new Map<string, ClassificationOption>();
  categories.forEach((category) => {
    const meta = classificationMetaOf(category, catalogRows);
    if (!meta.majorCode || deduped.has(meta.majorCode)) {
      return;
    }
    deduped.set(meta.majorCode, {
      code: meta.majorCode,
      label: `${meta.majorName}${meta.majorCode ? ` (${meta.majorCode})` : ""}`
    });
  });
  return Array.from(deduped.values()).sort((left, right) => left.label.localeCompare(right.label, "ko"));
}

function candidateStatusTone(status: string) {
  if (status === "READY") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "STUDIO_ONLY") {
    return "bg-blue-100 text-blue-700";
  }
  if (status === "PLANNED") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

function candidateStatusLabel(status: string, en: boolean) {
  if (status === "READY") {
    return en ? "Operational" : "운영중";
  }
  if (status === "STUDIO_ONLY") {
    return en ? "Definition only" : "정의만 있음";
  }
  if (status === "PLANNED") {
    return en ? "Tier planned" : "Tier 후보 있음";
  }
  return en ? "Not implemented" : "미구현";
}

function buildClassificationMiddleOptions(categories: EmissionCategoryItem[], catalogRows: Array<Record<string, unknown>>, selectedMajorCode: string) {
  const deduped = new Map<string, ClassificationOption>();
  categories.forEach((category) => {
    const meta = classificationMetaOf(category, catalogRows);
    if (!meta.middleCode || (selectedMajorCode && meta.majorCode !== selectedMajorCode) || deduped.has(meta.middleCode)) {
      return;
    }
    deduped.set(meta.middleCode, {
      code: meta.middleCode,
      label: `${meta.middleName}${meta.middleCode ? ` (${meta.middleCode})` : ""}`
    });
  });
  return Array.from(deduped.values()).sort((left, right) => left.label.localeCompare(right.label, "ko"));
}

function scopeBlockingReasonLabel(code: string, en: boolean) {
  if (code === "MISSING_CATEGORY") {
    return en ? "Management category missing" : "management 카테고리 없음";
  }
  if (code === "MISSING_TIER") {
    return en ? "Management tier missing" : "management Tier 없음";
  }
  if (code === "MISSING_VARIABLES") {
    return en ? "Variable metadata missing" : "변수 메타데이터 없음";
  }
  if (code === "MISSING_RUNTIME_SUPPORT") {
    return en ? "Runtime support missing" : "런타임 지원 없음";
  }
  if (code === "EMPTY_FORMULA_TREE") {
    return en ? "Formula tree empty" : "formulaTree 비어 있음";
  }
  return code || (en ? "Unknown issue" : "알 수 없는 이슈");
}

function scopeRecommendedAction(status: Record<string, unknown> | null, precheck: Record<string, unknown> | null, en: boolean) {
  const lifecycleStatus = stringOf(status?.lifecycleStatus).toUpperCase();
  const promotionStatus = stringOf(status?.promotionStatus).toUpperCase();
  const blockingReasons = arrayOf<Record<string, unknown>>(precheck?.blockingReasons || status?.blockingReasons);
  const firstReasonCode = stringOf(blockingReasons[0]?.code).toUpperCase();

  if (precheck && Boolean(precheck.materializable)) {
    return en
      ? "Precheck passed. You can materialize metadata for this published definition now."
      : "사전 점검이 통과했습니다. 이 publish 정의를 바로 메타 반영할 수 있습니다.";
  }
  if (firstReasonCode === "MISSING_CATEGORY") {
    return en
      ? "Create or map the management category first, then rerun precheck."
      : "먼저 management 카테고리를 만들거나 연결한 뒤 사전 점검을 다시 실행하세요.";
  }
  if (firstReasonCode === "MISSING_TIER") {
    return en
      ? "Add the missing management tier row, then rerun precheck."
      : "누락된 management Tier를 추가한 뒤 사전 점검을 다시 실행하세요.";
  }
  if (firstReasonCode === "MISSING_VARIABLES") {
    return en
      ? "Materialize or complete variable metadata before trying runtime verification."
      : "런타임 검증 전에 변수 메타데이터를 먼저 반영하거나 보완하세요.";
  }
  if (firstReasonCode === "MISSING_RUNTIME_SUPPORT") {
    return en
      ? "Metadata is present, but calculator/runtime support is still missing. Keep this scope blocked until runtime support is added."
      : "메타데이터는 있지만 계산기/런타임 지원이 아직 없습니다. 런타임 지원이 추가될 때까지 이 scope는 차단 상태로 유지해야 합니다.";
  }
  if (firstReasonCode === "EMPTY_FORMULA_TREE") {
    return en
      ? "Republish the definition with a valid formula tree before materialization."
      : "유효한 formulaTree를 포함하도록 정의를 다시 publish 한 뒤 반영하세요.";
  }
  if (lifecycleStatus === "MATERIALIZED" && promotionStatus === "PRIMARY_READY") {
    return en
      ? "This scope is already primary-active. Monitor parity and drift only."
      : "이 scope는 이미 primary 활성 상태입니다. parity와 drift만 계속 모니터링하면 됩니다.";
  }
  if (lifecycleStatus === "MATERIALIZED" && promotionStatus === "READY") {
    return en
      ? "Parity is aligned. This scope is ready for runtime promotion."
      : "parity가 맞았습니다. 이 scope는 런타임 전환 후보입니다.";
  }
  if (lifecycleStatus === "MATERIALIZED") {
    return en
      ? "Metadata is already materialized. Run calculate and review rollout status."
      : "메타 반영은 끝났습니다. calculate를 실행하고 rollout 상태를 확인하세요.";
  }
  if (lifecycleStatus === "DRAFT") {
    return en
      ? "No published definition snapshot is available yet. Publish from definition studio first."
      : "아직 publish 된 정의 스냅샷이 없습니다. 먼저 definition studio에서 publish 하세요.";
  }
  return en
    ? "Review the current blocking reasons and rerun precheck after the missing prerequisites are fixed."
    : "현재 차단 사유를 확인하고, 누락된 선행 조건을 보완한 뒤 사전 점검을 다시 실행하세요.";
}

function buildScopeTimeline(status: Record<string, unknown> | null, en: boolean) {
  const published = Boolean(status?.published);
  const materialized = Boolean(status?.materialized);
  const lifecycleStatus = stringOf(status?.lifecycleStatus).toUpperCase();
  const promotionStatus = stringOf(status?.promotionStatus).toUpperCase();
  const lastPublishedAt = stringOf(status?.lastPublishedAt) || "-";
  const lastVerifiedAt = stringOf(status?.lastVerifiedAt) || "-";
  const lastRuntimeTransitionAt = stringOf(status?.lastRuntimeTransitionAt) || "-";
  const lastRuntimePromotionStatus = stringOf(status?.lastRuntimePromotionStatus).toUpperCase() || "-";

  return [
    {
      key: "published",
      label: en ? "Published" : "정의 확정",
      description: published
        ? (en ? `Published snapshot recorded at ${lastPublishedAt}.` : `${lastPublishedAt} 기준 publish 스냅샷이 기록됐습니다.`)
        : (en ? "No published definition snapshot exists yet." : "아직 publish 된 정의 스냅샷이 없습니다."),
      completed: published
    },
    {
      key: "materialized",
      label: en ? "Metadata" : "메타 반영",
      description: materialized
        ? (en ? "Management metadata is already materialized." : "management 메타데이터 반영이 완료됐습니다.")
        : (en ? "Management metadata is not materialized yet." : "management 메타데이터가 아직 반영되지 않았습니다."),
      completed: materialized
    },
    {
      key: "runtime",
      label: en ? "Runtime ready" : "런타임 준비",
      description: promotionStatus === "PRIMARY_READY" || promotionStatus === "READY"
        ? (en
          ? `Runtime verification is aligned. Last verification: ${lastVerifiedAt}. Last transition: ${lastRuntimeTransitionAt}.`
          : `런타임 검증이 정렬됐습니다. 마지막 검증 시각: ${lastVerifiedAt}. 마지막 전환 시각: ${lastRuntimeTransitionAt}.`)
        : lifecycleStatus === "RUNTIME_BLOCKED"
          ? (en ? "Runtime support is still blocked for this scope." : "이 scope는 아직 런타임 지원이 차단 상태입니다.")
          : (en
            ? `Runtime verification is not complete yet. Latest recorded transition status: ${lastRuntimePromotionStatus}.`
            : `런타임 검증이 아직 완료되지 않았습니다. 최근 기록된 전환 상태: ${lastRuntimePromotionStatus}.`),
      completed: promotionStatus === "PRIMARY_READY" || promotionStatus === "READY"
    },
    {
      key: "primary",
      label: en ? "Primary active" : "운영 적용",
      description: promotionStatus === "PRIMARY_READY"
        ? (en ? "Definition-backed path is active in primary runtime." : "정의 기반 경로가 primary 런타임에서 활성 상태입니다.")
        : (en ? "Primary runtime adoption has not happened yet." : "primary 런타임 전환은 아직 되지 않았습니다."),
      completed: promotionStatus === "PRIMARY_READY"
    }
  ];
}

function scopeEvidenceItems(status: Record<string, unknown> | null, en: boolean) {
  return [
    {
      key: "draft",
      label: en ? "Draft ID" : "Draft ID",
      value: stringOf(status?.draftId) || "-",
      tone: "slate"
    },
    {
      key: "version",
      label: en ? "Published version" : "Publish 버전",
      value: stringOf(status?.publishedVersionId) || "-",
      tone: "slate"
    },
    {
      key: "publishedAt",
      label: en ? "Last published" : "마지막 publish",
      value: stringOf(status?.lastPublishedAt) || "-",
      tone: stringOf(status?.lastPublishedAt) ? "blue" : "slate"
    },
    {
      key: "materializedAt",
      label: en ? "Last materialized" : "마지막 메타 반영",
      value: stringOf(status?.lastMaterializedAt) || "-",
      tone: stringOf(status?.lastMaterializedAt) ? "indigo" : "slate"
    },
    {
      key: "materializedBy",
      label: en ? "Materialized by" : "메타 반영 작업자",
      value: stringOf(status?.lastMaterializedBy) || "-",
      tone: stringOf(status?.lastMaterializedBy) ? "indigo" : "slate"
    },
    {
      key: "verifiedAt",
      label: en ? "Last verified" : "마지막 검증",
      value: stringOf(status?.lastVerifiedAt) || "-",
      tone: stringOf(status?.lastVerifiedAt) ? "emerald" : "slate"
    },
    {
      key: "runtimeMode",
      label: en ? "Runtime mode" : "런타임 모드",
      value: stringOf(status?.lastRuntimeMode) || stringOf(status?.runtimeMode) || "-",
      tone: stringOf(status?.lastRuntimeMode) || stringOf(status?.runtimeMode) ? "emerald" : "slate"
    },
    {
      key: "runtimeStatus",
      label: en ? "Last transition status" : "마지막 전환 상태",
      value: stringOf(status?.lastRuntimePromotionStatus) || stringOf(status?.promotionStatus) || "-",
      tone: stringOf(status?.lastRuntimePromotionStatus) || stringOf(status?.promotionStatus) ? "emerald" : "slate"
    },
    {
      key: "runtimeAt",
      label: en ? "Last runtime transition" : "마지막 런타임 전환",
      value: stringOf(status?.lastRuntimeTransitionAt) || "-",
      tone: stringOf(status?.lastRuntimeTransitionAt) ? "emerald" : "slate"
    },
    {
      key: "runtimeBy",
      label: en ? "Runtime transition by" : "런타임 전환 작업자",
      value: stringOf(status?.lastRuntimeTransitionBy) || "-",
      tone: stringOf(status?.lastRuntimeTransitionBy) ? "emerald" : "slate"
    }
  ];
}

function buildScopeActivityFeed(status: Record<string, unknown> | null, en: boolean) {
  const backendItems = arrayOf<Record<string, unknown>>(status?.activityFeed);
  if (backendItems.length > 0) {
    return backendItems.map((item) => ({
      key: stringOf(item.type) || "activity",
      at: stringOf(item.at) || "-",
      title:
        stringOf(item.type) === "published"
          ? (en ? "Published snapshot" : "publish 스냅샷")
          : stringOf(item.type) === "materialized"
            ? (en ? "Metadata materialized" : "메타 반영")
            : stringOf(item.type) === "runtime-transition"
              ? (en ? "Runtime transition" : "런타임 전환")
              : (en ? "Calculation verified" : "계산 검증"),
      detail: stringOf(item.actor)
        ? `${stringOf(item.status) || "-"} · ${stringOf(item.actor)}`
        : stringOf(item.status) || "-",
      tone:
        stringOf(item.type) === "published"
          ? "blue"
          : stringOf(item.type) === "materialized"
            ? "indigo"
            : "emerald",
      message: stringOf(item.message)
    }));
  }

  const items = [
    stringOf(status?.lastPublishedAt)
      ? {
          key: "published",
          at: stringOf(status?.lastPublishedAt),
          title: en ? "Published snapshot" : "publish 스냅샷",
          detail: stringOf(status?.publishedVersionId)
            ? (en
              ? `Published version ${stringOf(status?.publishedVersionId)} was recorded.`
              : `Publish 버전 ${stringOf(status?.publishedVersionId)} 이 기록됐습니다.`)
            : (en ? "A published definition snapshot was recorded." : "publish 된 정의 스냅샷이 기록됐습니다."),
          tone: "blue"
        }
      : null,
    stringOf(status?.lastMaterializedAt)
      ? {
          key: "materialized",
          at: stringOf(status?.lastMaterializedAt),
          title: en ? "Metadata materialized" : "메타 반영",
          detail: stringOf(status?.lastMaterializedBy)
            ? (en
              ? `Metadata was materialized by ${stringOf(status?.lastMaterializedBy)}.`
              : `${stringOf(status?.lastMaterializedBy)} 작업자가 메타를 반영했습니다.`)
            : (en ? "Management metadata was materialized." : "management 메타데이터가 반영됐습니다."),
          tone: "indigo"
        }
      : null,
    stringOf(status?.lastRuntimeTransitionAt)
      ? {
          key: "runtime-transition",
          at: stringOf(status?.lastRuntimeTransitionAt),
          title: en ? "Runtime transition" : "런타임 전환",
          detail: (() => {
            const parts = [
              stringOf(status?.lastRuntimeMode) ? `${en ? "mode" : "모드"} ${stringOf(status?.lastRuntimeMode)}` : "",
              stringOf(status?.lastRuntimePromotionStatus) ? `${en ? "status" : "상태"} ${stringOf(status?.lastRuntimePromotionStatus)}` : "",
              stringOf(status?.lastRuntimeTransitionBy) ? `${en ? "by" : "작업자"} ${stringOf(status?.lastRuntimeTransitionBy)}` : ""
            ].filter(Boolean);
            return parts.length > 0
              ? parts.join(" · ")
              : (en ? "A runtime transition snapshot was recorded." : "런타임 전환 스냅샷이 기록됐습니다.");
          })(),
          tone: "emerald"
        }
      : null,
    stringOf(status?.lastVerifiedAt)
      ? {
          key: "verified",
          at: stringOf(status?.lastVerifiedAt),
          title: en ? "Calculation verified" : "계산 검증",
          detail: stringOf(status?.promotionStatus)
            ? (en
              ? `Latest verified promotion status is ${stringOf(status?.promotionStatus)}.`
              : `최근 검증된 전환 상태는 ${stringOf(status?.promotionStatus)} 입니다.`)
            : (en ? "A calculation verification snapshot was recorded." : "계산 검증 스냅샷이 기록됐습니다."),
          tone: "emerald"
        }
      : null
  ].filter(Boolean) as Array<{ key: string; at: string; title: string; detail: string; tone: string }>;

  return items.sort((left, right) => right.at.localeCompare(left.at)).map((item) => ({
    ...item,
    message: item.detail
  }));
}

function presentCalculationText(value: string, en: boolean) {
  return stringOf(value)
    .replace(/\bHIGH_CALCIUM\b/g, localizedLimeTypeLabel("HIGH_CALCIUM", en))
    .replace(/\bHYDRAULIC\b/g, localizedLimeTypeLabel("HYDRAULIC", en))
    .replace(/\bDOLOMITIC_HIGH\b/g, localizedLimeTypeLabel("DOLOMITIC_HIGH", en))
    .replace(/\bDOLOMITIC_LOW\b/g, localizedLimeTypeLabel("DOLOMITIC_LOW", en))
    .replace(/\bDOLOMITIC\b/g, localizedLimeTypeLabel("DOLOMITIC", en));
}

function FormulaNotation({
  formula,
  active = false,
  compact = false,
  highlightedTokens = []
}: {
  formula: string;
  active?: boolean;
  compact?: boolean;
  highlightedTokens?: string[];
}) {
  const normalizedFormula = documentFormulaText(formula);
  const normalizedHighlights = highlightedTokens
    .map((token) => documentFormulaText(stringOf(token)).replace(/\s+/g, ""))
    .filter(Boolean);
  const parts = normalizedFormula.split(/(\s+|[=()+\-×/])/g).filter((part) => part.length > 0);
  return (
    <div
      className={`flex flex-wrap items-end gap-x-1.5 gap-y-1 ${
        compact ? "text-sm" : "text-base"
      } ${active ? "text-[var(--kr-gov-text-primary)]" : "text-[var(--kr-gov-text-secondary)]"}`}
      style={{ fontFamily: "\"Times New Roman\", serif" }}
    >
      {parts.map((part, index) => {
        if (/^\s+$/.test(part)) {
          return <span aria-hidden="true" className="w-1.5" key={`space-${index}`} />;
        }
        if (/^[=()+\-×/]$/.test(part)) {
          return (
            <span className={active ? "font-bold text-[var(--kr-gov-blue)]" : "font-semibold"} key={`operator-${index}`}>
              {part}
            </span>
          );
        }
        const normalized = part.replace(/^[:;,]+|[:;,]+$/g, "");
        if (!normalized) {
          return <span key={`punctuation-${index}`}>{part}</span>;
        }
        const prefixLength = normalized ? part.indexOf(normalized) : 0;
        const prefix = prefixLength > 0 ? part.slice(0, prefixLength) : "";
        const suffix = part.slice(prefixLength + normalized.length);
        const notation = normalized ? splitFormulaToken(normalized) : null;
        const isHighlighted = normalizedHighlights.includes(normalized.replace(/\s+/g, ""));
        return (
          <span className="inline-flex items-end gap-0.5" key={`token-${index}`}>
            {prefix ? <span>{prefix}</span> : null}
            {notation ? (
              <span
                className={`inline-flex items-end gap-0.5 rounded-md px-1.5 py-0.5 shadow-sm ring-1 ${
                  isHighlighted
                    ? "bg-amber-100 ring-amber-300"
                    : "bg-white/70 ring-black/5"
                }`}
              >
                <span className={`font-semibold tracking-[0.01em] ${isHighlighted ? "text-amber-900" : ""}`}>{notation.head}</span>
                <sub className={`text-[0.72em] font-semibold leading-none ${isHighlighted ? "text-amber-700" : "text-[var(--kr-gov-blue)]"}`}>{notation.sub}</sub>
              </span>
            ) : (
              <span className={isHighlighted ? "rounded bg-amber-100 px-1 text-amber-900" : ""}>{normalized || part}</span>
            )}
            {suffix ? <span>{suffix}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

type FormulaTreeJoiner = "" | "+" | "-" | "×" | "÷";

type FormulaTreeBlock = {
  kind: "token" | "sum" | "group" | "fraction";
  joiner: FormulaTreeJoiner;
  token: string;
  iterator: string;
  items: FormulaTreeBlock[];
  numerator: FormulaTreeBlock[];
  denominator: FormulaTreeBlock[];
};

type FormulaPreviewTrace = {
  label: string;
  expression: string;
  result: number;
  note?: string;
};

function normalizeFormulaTreeBlocks(value: unknown): FormulaTreeBlock[] {
  return arrayOf<Record<string, unknown>>(value).map((item) => ({
    kind: (stringOf(item.kind) || "token") as FormulaTreeBlock["kind"],
    joiner: (stringOf(item.joiner) || "") as FormulaTreeJoiner,
    token: stringOf(item.token),
    iterator: stringOf(item.iterator) || "i",
    items: normalizeFormulaTreeBlocks(item.items),
    numerator: normalizeFormulaTreeBlocks(item.numerator),
    denominator: normalizeFormulaTreeBlocks(item.denominator)
  }));
}

function formatFormulaTreeBlock(block: FormulaTreeBlock): string {
  if (block.kind === "sum") {
    return `SUM(${buildFormulaTreeExpression(block.items)}, ${block.iterator || "i"})`;
  }
  if (block.kind === "group") {
    return `(${buildFormulaTreeExpression(block.items)})`;
  }
  if (block.kind === "fraction") {
    return `(${buildFormulaTreeExpression(block.numerator)}) ÷ (${buildFormulaTreeExpression(block.denominator)})`;
  }
  return block.token;
}

function buildFormulaTreeExpression(blocks: FormulaTreeBlock[]): string {
  return blocks.map((block) => `${block.joiner ? `${block.joiner} ` : ""}${formatFormulaTreeBlock(block)}`).join(" ").trim();
}

function findCategoryById(categories: EmissionCategoryItem[], categoryId: number) {
  return categories.find((item) => numberOf(item.categoryId) === categoryId) || null;
}

function findCategoryByCode(categories: EmissionCategoryItem[], categoryCode: string) {
  const normalizedCode = stringOf(categoryCode).toUpperCase();
  return categories.find((item) => stringOf(item.subCode).toUpperCase() === normalizedCode) || null;
}

function virtualCategoryIdForCode(categoryCode: string) {
  const normalized = stringOf(categoryCode).toUpperCase();
  if (!normalized) {
    return 0;
  }
  return -Array.from(normalized).reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
}

function readSessionIdFromUrl() {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = new URLSearchParams(window.location.search).get("sessionId") || "";
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function updateSessionIdInUrl(sessionId: number) {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  if (sessionId > 0) {
    url.searchParams.set("sessionId", String(sessionId));
  } else {
    url.searchParams.delete("sessionId");
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function readSurveyBootstrapFromUrl() {
  if (typeof window === "undefined") {
    return { fromSurveyAdmin: false, categoryId: 0, tier: 0 };
  }
  const searchParams = new URLSearchParams(window.location.search);
  const rawCategoryId = Number(searchParams.get("categoryId") || "");
  const rawTier = Number(searchParams.get("tier") || "");
  return {
    fromSurveyAdmin: (searchParams.get("fromSurveyAdmin") || "").toUpperCase() === "Y",
    categoryId: Number.isFinite(rawCategoryId) ? rawCategoryId : 0,
    tier: Number.isFinite(rawTier) ? rawTier : 0
  };
}

export function EmissionManagementMigrationPage() {
  type ValidationIssue = {
    sectionId: string;
    sectionTitle: string;
    lineNo: number | null;
    inputCode: string;
    variableLabel: string;
    formulaLabel: string;
  };

  type ScopeBlockingReason = {
    code?: string;
    message?: string;
    blocking?: boolean;
  };

  const allowedSessionActionRoles = new Set([
    "ROLE_SYSTEM_MASTER",
    "ROLE_SYSTEM_ADMIN",
    "ROLE_ADMIN",
    "ROLE_OPERATION_ADMIN"
  ]);
  const surveyBootstrap = readSurveyBootstrapFromUrl();

  const en = isEnglish();
  const frontendSession = useFrontendSession();
  const [page, setPage] = useState<EmissionManagementPagePayload | null>(null);
  const [elementRegistryRows, setElementRegistryRows] = useState<Array<Record<string, unknown>>>([]);
  const [selectedElementDefinitionId, setSelectedElementDefinitionId] = useState("");
  const [elementDefinitionDraft, setElementDefinitionDraft] = useState<Record<string, unknown>>({});
  const [elementRegistrySaving, setElementRegistrySaving] = useState(false);
  const [categories, setCategories] = useState<EmissionCategoryItem[]>([]);
  const [tiers, setTiers] = useState<EmissionTierItem[]>([]);
  const [variables, setVariables] = useState<EmissionVariableDefinition[]>([]);
  const [factors, setFactors] = useState<EmissionFactorDefinition[]>([]);
  const [inputs, setInputs] = useState<InputMap>({});
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [majorSearchKeyword, setMajorSearchKeyword] = useState("");
  const [middleSearchKeyword, setMiddleSearchKeyword] = useState("");
  const [subCategorySearchKeyword, setSubCategorySearchKeyword] = useState("");
  const [selectedMajorKey, setSelectedMajorKey] = useState("");
  const [selectedMiddleCode, setSelectedMiddleCode] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(0);
  const [selectedTier, setSelectedTier] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<EmissionCategoryItem | null>(null);
  const [formulaSummary, setFormulaSummary] = useState("");
  const [tierGuideMap, setTierGuideMap] = useState<Record<number, TierGuide>>({});
  const [sessionId, setSessionId] = useState(0);
  const [limeDefaultFactor, setLimeDefaultFactor] = useState<Record<string, unknown> | null>(null);
  const [calculationResult, setCalculationResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [definitionLoading, setDefinitionLoading] = useState(false);
  const [tierGuideLoading, setTierGuideLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [materializingDraftId, setMaterializingDraftId] = useState("");
  const [precheckingDraftId, setPrecheckingDraftId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [selectedScopeStatus, setSelectedScopeStatus] = useState<Record<string, unknown> | null>(null);
  const [scopeStatusLoading, setScopeStatusLoading] = useState(false);
  const [selectedScopePrecheck, setSelectedScopePrecheck] = useState<Record<string, unknown> | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [pendingValidationFocus, setPendingValidationFocus] = useState<ValidationIssue | null>(null);
  const [activeFormulaStep, setActiveFormulaStep] = useState(0);
  const [focusedFormulaToken, setFocusedFormulaToken] = useState("");
  const [hoveredFormulaToken, setHoveredFormulaToken] = useState("");
  const [highlightedHelpId, setHighlightedHelpId] = useState("");
  const [activityFeedOverlayOpen, setActivityFeedOverlayOpen] = useState(false);
  const canExecuteSessionActions = Boolean(
    frontendSession.value?.authenticated
      && frontendSession.value?.csrfToken
      && allowedSessionActionRoles.has(String(frontendSession.value?.authorCode || "").trim().toUpperCase())
  );

  useEffect(() => {
    if (frontendSession.loading || !frontendSession.value) {
      return;
    }
    if (!frontendSession.value.authenticated) {
      navigate(buildLocalizedPath("/signin/loginView?console=admin", "/en/signin/loginView?console=admin"));
    }
  }, [frontendSession.loading, frontendSession.value]);
  const elementRegistrySummary = (page?.elementRegistrySummary || []) as Array<Record<string, string>>;
  const elementTypeOptions = (page?.elementTypeOptions || []) as Array<Record<string, string>>;
  const layoutZoneOptions = (page?.layoutZoneOptions || []) as Array<Record<string, string>>;
  const componentTypeOptions = (page?.componentTypeOptions || []) as Array<Record<string, string>>;
  const formulaReference = (page?.formulaReference || null) as Record<string, unknown> | null;
  const rolloutSummaryCards = (page?.rolloutSummaryCards || []) as Array<Record<string, string>>;
  const rolloutStatusRows = (page?.rolloutStatusRows || []) as Array<Record<string, unknown>>;
  const definitionScopeSummaryCards = (page?.definitionScopeSummaryCards || []) as Array<Record<string, string>>;
  const definitionScopeRows = (page?.definitionScopeRows || []) as Array<Record<string, unknown>>;
  const definitionDraftRows = ((page?.publishedDefinitionRows || page?.definitionDraftRows || []) as Array<Record<string, unknown>>);
  const definitionPolicyOptions = (page?.definitionPolicyOptions || []) as Array<Record<string, string>>;
  const selectedPublishedDefinition = (page?.selectedPublishedDefinition || null) as Record<string, unknown> | null;
  const selectedDefinitionDraft = (selectedPublishedDefinition && Object.keys(selectedPublishedDefinition).length > 0
    ? selectedPublishedDefinition
    : ((page?.selectedDefinitionDraft || null) as Record<string, unknown> | null));
  const [appliedDefinitionDraftId, setAppliedDefinitionDraftId] = useState("");
  const classificationCatalog = (page?.classificationCatalog || null) as Record<string, unknown> | null;
  const classificationCatalogRows = Array.isArray(classificationCatalog?.rows)
    ? (classificationCatalog.rows as Array<Record<string, unknown>>)
    : [];
  const majorOptions = buildClassificationMajorOptions(categories, classificationCatalogRows);
  const filteredMajorOptions = majorOptions.filter((option) => {
    const keyword = majorSearchKeyword.trim().toLowerCase();
    if (!keyword) {
      return true;
    }
    return `${option.code} ${option.label}`.toLowerCase().includes(keyword);
  });
  const middleOptions = buildClassificationMiddleOptions(categories, classificationCatalogRows, selectedMajorKey);
  const filteredMiddleOptions = middleOptions.filter((option) => {
    const keyword = middleSearchKeyword.trim().toLowerCase();
    if (!keyword) {
      return true;
    }
    return `${option.code} ${option.label}`.toLowerCase().includes(keyword);
  });
  const visibleCategories = categories.filter((category) => {
    const meta = classificationMetaOf(category, classificationCatalogRows);
    const matchesMajor = !selectedMajorKey || meta.majorCode === selectedMajorKey;
    if (!matchesMajor) {
      return false;
    }
    const matchesMiddle = !selectedMiddleCode || meta.middleCode === selectedMiddleCode;
    if (!matchesMiddle) {
      return false;
    }
    const keyword = subCategorySearchKeyword.trim().toLowerCase();
    if (!keyword) {
      return true;
    }
    return `${meta.smallCode} ${meta.smallName} ${stringOf(category.subCode)} ${stringOf(category.subName)} ${meta.pathLabel}`.toLowerCase().includes(keyword);
  });
  const selectedMajorOption = majorOptions.find((option) => option.code === selectedMajorKey) || null;
  const selectedMiddleOption = middleOptions.find((option) => option.code === selectedMiddleCode) || null;
  const hasSelectedCategory = selectedCategoryId !== 0;
  const selectedTierItem = tiers.find((tier) => numberOf(tier.tier) === selectedTier) || null;
  const selectedClassificationMeta = classificationMetaOf(selectedCategory, classificationCatalogRows);
  const lciSmallCandidates = classificationCatalogRows
    .filter((row) => stringOf(row.level).toUpperCase() === "SMALL")
    .map((row) => {
      const aliases = Array.isArray(row.aliases) ? (row.aliases as Array<unknown>).map((item) => stringOf(item).trim().toUpperCase()).filter(Boolean) : [];
      const matchedCategories = categories.filter((category) => aliases.includes(stringOf(category.subCode).trim().toUpperCase()));
      const matchedDefinitionScopes = definitionScopeRows.filter((scopeRow) => aliases.includes(stringOf(scopeRow.categoryCode).trim().toUpperCase()));
      const runtimeTiers = new Set<number>();
      const plannedTiers = new Set<number>();
      matchedCategories.forEach((category) => {
        tierItemsForDefinitionScope(stringOf(category.subCode)).forEach((tierItem) => {
          const tierNumber = numberOf(tierItem.tier);
          if (tierNumber <= 0) {
            return;
          }
          if (Boolean(tierItem.runtimeSupported ?? true)) {
            runtimeTiers.add(tierNumber);
          } else {
            plannedTiers.add(tierNumber);
          }
        });
      });
      matchedDefinitionScopes.forEach((scopeRow) => {
        const tierNumber = numberOf(scopeRow.tier);
        if (tierNumber <= 0) {
          return;
        }
        if (Boolean(scopeRow.runtimeSupported)) {
          runtimeTiers.add(tierNumber);
        } else {
          plannedTiers.add(tierNumber);
        }
      });
      let status = "UNMAPPED";
      if (runtimeTiers.size > 0) {
        status = "READY";
      } else if (matchedDefinitionScopes.length > 0 || matchedCategories.some((category) => Boolean(category.virtualCategory))) {
        status = "STUDIO_ONLY";
      } else if (plannedTiers.size > 0) {
        status = "PLANNED";
      }
      return {
        code: stringOf(row.code),
        majorName: stringOf(row.majorName),
        middleName: stringOf(row.middleName),
        smallName: stringOf(row.smallName),
        tierLabel: stringOf(row.tierLabel),
        aliases,
        matchedCategories,
        matchedDefinitionScopes,
        runtimeTiers: Array.from(runtimeTiers).sort((left, right) => left - right),
        plannedTiers: Array.from(plannedTiers).sort((left, right) => left - right),
        status
      };
    })
    .sort((left, right) => `${left.majorName}/${left.middleName}/${left.smallName}`.localeCompare(`${right.majorName}/${right.middleName}/${right.smallName}`, "ko"));
  const selectedCategoryDefinitionScopeRows = definitionScopeRows.filter((row) => {
    return stringOf(row.categoryCode).toUpperCase() === stringOf(selectedCategory?.subCode).toUpperCase();
  });
  const blockedSelectedCategoryDefinitionScopeRows = selectedCategoryDefinitionScopeRows.filter((row) => !Boolean(row.runtimeSupported));
  const matchingDefinitionDrafts = definitionDraftRows.filter((row) => draftMatchesScope(row, stringOf(selectedCategory?.subCode), selectedTier));
  const appliedDefinitionDraft = matchingDefinitionDrafts.find((row) => stringOf(row.draftId) === appliedDefinitionDraftId)
    || matchingDefinitionDrafts[0]
    || (selectedTier <= 0 && !selectedCategory ? selectedDefinitionDraft : null)
    || null;
  const visibleVariables = visibleVariablesForStep(selectedCategory, selectedTier, variables);
  const summationGroups = buildSummationGroups(selectedCategory, selectedTier, visibleVariables);
  const variableSections = buildVariableSections(
    en,
    selectedCategory,
    selectedTier,
    visibleVariables,
    Array.isArray(appliedDefinitionDraft?.sections)
      ? (appliedDefinitionDraft.sections as Array<Record<string, unknown>>)
      : []
  );
  const appliedDefinitionPolicies = definitionPolicyBadges(appliedDefinitionDraft);
  const effectiveFormulaSummary = stringOf(appliedDefinitionDraft?.formula) || formulaSummary;
  const appliedFormulaTree = normalizeFormulaTreeBlocks(appliedDefinitionDraft?.formulaTree);
  const selectedScopeBlockingReasons = arrayOf<ScopeBlockingReason>(selectedScopeStatus?.blockingReasons);
  const selectedScopeWarnings = arrayOf<string>(selectedScopeStatus?.warnings);
  const selectedScopePrecheckBlockingReasons = arrayOf<ScopeBlockingReason>(selectedScopePrecheck?.blockingReasons);
  const selectedScopeActionGuide = scopeRecommendedAction(selectedScopeStatus, selectedScopePrecheck, en);
  const selectedScopeTimeline = buildScopeTimeline(selectedScopeStatus, en);
  const selectedScopeEvidence = scopeEvidenceItems(selectedScopeStatus, en);
  const selectedScopeActivityFeed = buildScopeActivityFeed(selectedScopeStatus, en);
  const selectedScopeActivityFeedPreview = selectedScopeActivityFeed.slice(0, 4);
  const hasAdditionalSelectedScopeActivityFeed = selectedScopeActivityFeed.length > selectedScopeActivityFeedPreview.length;

  useEffect(() => {
    setActivityFeedOverlayOpen(false);
  }, [selectedCategoryId, selectedTier]);

  function normalizeTierLabelValue(value: unknown) {
    return stringOf(value).replace(/\s+/g, " ").trim().toUpperCase();
  }

  function draftMatchesScope(row: Record<string, unknown> | null, categoryCode: string, tierNumber: number) {
    if (!row || !categoryCode || tierNumber <= 0) {
      return false;
    }
    return stringOf(row.categoryCode).toUpperCase() === stringOf(categoryCode).toUpperCase()
      && normalizeTierLabelValue(row.tierLabel) === `TIER ${tierNumber}`;
  }

  function definitionDraftForScope(categoryCode: string, tierNumber: number) {
    return definitionDraftRows.find((row) => draftMatchesScope(row, categoryCode, tierNumber)) || null;
  }

  function definitionPolicyBadges(draft: Record<string, unknown> | null) {
    const labels = Array.isArray(draft?.policyLabels)
      ? (draft?.policyLabels as unknown[]).map((item) => String(item || "")).filter(Boolean)
      : [];
    if (labels.length > 0) {
      return labels;
    }
    const selectedCodes = Array.isArray(draft?.policies)
      ? (draft?.policies as unknown[]).map((item) => String(item || "")).filter(Boolean)
      : [];
    if (selectedCodes.length === 0) {
      return [];
    }
    return selectedCodes.map((policyCode) => {
      const matched = definitionPolicyOptions.find((option) => stringOf(option.code) === policyCode);
      return stringOf(matched?.label) || policyCode;
    });
  }

  function definitionDraftForPolicy(categoryOverride: EmissionCategoryItem | null = selectedCategory, tierOverride = selectedTier) {
    const categoryCode = stringOf(categoryOverride?.subCode);
    if (categoryCode && tierOverride > 0) {
      if (draftMatchesScope(appliedDefinitionDraft, categoryCode, tierOverride)) {
        return appliedDefinitionDraft;
      }
      return definitionDraftForScope(categoryCode, tierOverride);
    }
    return appliedDefinitionDraft;
  }

  function mergeCategoriesWithDefinitionScopes(baseCategories: EmissionCategoryItem[], scopeRows: Array<Record<string, unknown>>) {
    const merged = baseCategories.map((category) => ({ ...category }));
    const indexByCode = new Map<string, number>();
    merged.forEach((category, index) => {
      indexByCode.set(stringOf(category.subCode).toUpperCase(), index);
    });
    scopeRows.forEach((row) => {
      const categoryCode = stringOf(row.categoryCode).toUpperCase();
      if (!categoryCode) {
        return;
      }
      const categoryName = stringOf(row.categoryName) || categoryCode;
      const existingIndex = indexByCode.get(categoryCode);
      if (typeof existingIndex === "number") {
        const existing = merged[existingIndex];
        merged[existingIndex] = {
          ...existing,
          definitionPublishedCount: numberOf(existing.definitionPublishedCount) + 1,
          blockedDefinitionCount: numberOf(existing.blockedDefinitionCount) + (Boolean(row.runtimeSupported) ? 0 : 1),
          hasPublishedDefinition: true
        };
        return;
      }
      indexByCode.set(categoryCode, merged.length);
      merged.push({
        categoryId: virtualCategoryIdForCode(categoryCode),
        majorCode: "STUDIO",
        majorName: en ? "Definition studio" : "정의 스튜디오",
        subCode: categoryCode,
        subName: categoryName,
        useYn: "Y",
        sourceType: "STUDIO_ONLY",
        virtualCategory: true,
        hasPublishedDefinition: true,
        definitionPublishedCount: 1,
        blockedDefinitionCount: Boolean(row.runtimeSupported) ? 0 : 1
      });
    });
    return merged;
  }

  function tierItemsForDefinitionScope(categoryCode: string, existingTiers: EmissionTierItem[] = []) {
    const tierMap = new Map<number, EmissionTierItem>();
    existingTiers.forEach((tier) => {
      tierMap.set(numberOf(tier.tier), { ...tier });
    });
    const scopeRows = definitionScopeRows.filter((row) => stringOf(row.categoryCode).toUpperCase() === stringOf(categoryCode).toUpperCase());
    scopeRows.forEach((row) => {
      const tierNumber = numberOf(row.tier);
      if (tierNumber <= 0) {
        return;
      }
      const existing = tierMap.get(tierNumber) || {};
      tierMap.set(tierNumber, {
        ...existing,
        tier: tierNumber,
        tierLabel: stringOf(existing.tierLabel) || stringOf(row.tierLabel) || `Tier ${tierNumber}`,
        runtimeSupported: Boolean(row.runtimeSupported),
        status: stringOf(row.status) || stringOf(existing.status),
        statusMessage: stringOf(row.statusMessage) || stringOf(existing.statusMessage),
        runtimeMode: stringOf(row.runtimeMode) || stringOf(existing.runtimeMode),
        publishedDefinition: true
      });
    });
    return Array.from(tierMap.values()).sort((left, right) => numberOf(left.tier) - numberOf(right.tier));
  }

  function definitionPolicyCodeLists(categoryOverride: EmissionCategoryItem | null = selectedCategory, tierOverride = selectedTier) {
    const draft = definitionDraftForPolicy(categoryOverride, tierOverride);
    return {
      draft,
      directRequiredCodes: codeList(draft?.directRequiredCodes).map((item) => item.toUpperCase()),
      fallbackCodes: codeList(draft?.fallbackCodes).map((item) => item.toUpperCase()),
      autoCalculatedCodes: codeList(draft?.autoCalculatedCodes).map((item) => item.toUpperCase()),
      supplementalCodes: codeList(draft?.supplementalCodes).map((item) => item.toUpperCase())
    };
  }

  function mergeDefinitionVariableOverrides(
    baseVariables: EmissionVariableDefinition[],
    categoryOverride: EmissionCategoryItem | null = selectedCategory,
    tierOverride = selectedTier
  ) {
    const draft = definitionDraftForPolicy(categoryOverride, tierOverride);
    const overrides = Array.isArray(draft?.variableDefinitions)
      ? (draft?.variableDefinitions as Array<Record<string, unknown>>)
      : [];
    if (overrides.length === 0) {
      return baseVariables;
    }
    const merged = baseVariables.map((variable) => ({ ...variable }));
    const indexByCode = new Map<string, number>();
    merged.forEach((variable, index) => {
      indexByCode.set(stringOf(variable.varCode).toUpperCase(), index);
    });
    overrides.forEach((override, overrideIndex) => {
      const varCode = stringOf(override.varCode).toUpperCase();
      if (!varCode) {
        return;
      }
      const normalizedOverride: EmissionVariableDefinition = {
        variableId: numberOf(override.variableId) || 0,
        categoryId: numberOf(override.categoryId) || numberOf(categoryOverride?.categoryId) || 0,
        tier: numberOf(override.tier) || tierOverride,
        varCode,
        varName: stringOf(override.varName) || varCode,
        varDesc: stringOf(override.varDesc),
        unit: stringOf(override.unit),
        inputType: stringOf(override.inputType) || "TEXT",
        sourceType: stringOf(override.sourceType),
        isRepeatable: stringOf(override.isRepeatable),
        isRequired: stringOf(override.isRequired),
        sortOrder: numberOf(override.sortOrder) || (1000 + overrideIndex),
        useYn: stringOf(override.useYn) || "Y",
        commonCodeId: stringOf(override.commonCodeId),
        options: Array.isArray(override.options) ? (override.options as Array<Record<string, string>>) : [],
        displayName: stringOf(override.displayName),
        displayCode: stringOf(override.displayCode),
        uiHint: stringOf(override.uiHint),
        derivedYn: stringOf(override.derivedYn),
        supplementalYn: stringOf(override.supplementalYn),
        repeatGroupKey: stringOf(override.repeatGroupKey),
        sectionId: stringOf(override.sectionId),
        sectionOrder: numberOf(override.sectionOrder) || 0,
        sectionTitle: stringOf(override.sectionTitle),
        sectionDescription: stringOf(override.sectionDescription),
        sectionFormula: stringOf(override.sectionFormula),
        sectionPreviewType: stringOf(override.sectionPreviewType),
        sectionRelatedFactorCodes: stringOf(override.sectionRelatedFactorCodes),
        visibleWhen: stringOf(override.visibleWhen),
        disabledWhen: stringOf(override.disabledWhen)
      };
      const existingIndex = indexByCode.get(varCode);
      if (typeof existingIndex === "number") {
        merged[existingIndex] = {
          ...merged[existingIndex],
          ...normalizedOverride
        };
        return;
      }
      indexByCode.set(varCode, merged.length);
      merged.push(normalizedOverride);
    });
    return merged.sort((left, right) => numberOf(left.sortOrder) - numberOf(right.sortOrder));
  }

  function definitionPolicyTone(variable: EmissionVariableDefinition, categoryOverride: EmissionCategoryItem | null = selectedCategory, tierOverride = selectedTier) {
    const code = stringOf(variable.varCode).toUpperCase();
    if (!code) {
      return "";
    }
    const policyLists = definitionPolicyCodeLists(categoryOverride, tierOverride);
    if (policyLists.autoCalculatedCodes.includes(code)) {
      return "rose";
    }
    if (policyLists.fallbackCodes.includes(code)) {
      return "amber";
    }
    if (policyLists.supplementalCodes.includes(code)) {
      return "sky";
    }
    if (policyLists.directRequiredCodes.includes(code)) {
      return "red";
    }
    return "";
  }

  function applyElementDefinition(definition: Record<string, unknown> | null) {
    const fallback = definition || {};
    setSelectedElementDefinitionId(stringOf(fallback.definitionId) || "");
    setElementDefinitionDraft({
      definitionId: stringOf(fallback.definitionId),
      elementKey: stringOf(fallback.elementKey),
      elementName: stringOf(fallback.elementName),
      elementType: stringOf(fallback.elementType) || "section",
      layoutZone: stringOf(fallback.layoutZone) || "workspace",
      componentType: stringOf(fallback.componentType) || "DiagnosticCard",
      bindingTarget: stringOf(fallback.bindingTarget),
      defaultLabel: stringOf(fallback.defaultLabel),
      defaultLabelEn: stringOf(fallback.defaultLabelEn),
      description: stringOf(fallback.description),
      variableScope: stringOf(fallback.variableScope),
      policyNote: stringOf(fallback.policyNote),
      directRequiredCodes: Array.isArray(fallback.directRequiredCodes) ? (fallback.directRequiredCodes as unknown[]).map((item) => String(item || "")).filter(Boolean).join(", ") : "",
      fallbackCodes: Array.isArray(fallback.fallbackCodes) ? (fallback.fallbackCodes as unknown[]).map((item) => String(item || "")).filter(Boolean).join(", ") : "",
      autoCalculatedCodes: Array.isArray(fallback.autoCalculatedCodes) ? (fallback.autoCalculatedCodes as unknown[]).map((item) => String(item || "")).filter(Boolean).join(", ") : "",
      useYn: stringOf(fallback.useYn) || "Y",
      tags: Array.isArray(fallback.tags) ? (fallback.tags as unknown[]).map((item) => String(item || "")).filter(Boolean).join(", ") : ""
    });
  }

  function updateElementDefinitionDraft(key: string, value: string) {
    setElementDefinitionDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function collectPolicyCodesForCurrentSelection() {
    const directRequiredCodes: string[] = [];
    const fallbackCodes: string[] = [];
    const autoCalculatedCodes: string[] = [];
    const supplementalCodes: string[] = [];

    visibleVariables.forEach((variable) => {
      const code = variableCodeOf(variable);
      const policy = inputPolicyMeta(variable);
      if (!code) {
        return;
      }
      if (policy.tone === "red" && !directRequiredCodes.includes(code)) {
        directRequiredCodes.push(code);
      } else if (policy.tone === "amber" && !fallbackCodes.includes(code)) {
        fallbackCodes.push(code);
      } else if (policy.tone === "rose" && !autoCalculatedCodes.includes(code)) {
        autoCalculatedCodes.push(code);
      } else if (policy.tone === "sky" && !supplementalCodes.includes(code)) {
        supplementalCodes.push(code);
      }
    });

    return {
      directRequiredCodes,
      fallbackCodes,
      autoCalculatedCodes,
      supplementalCodes
    };
  }

  function applyCurrentSelectionPolicyToDraft() {
    const policyCodes = collectPolicyCodesForCurrentSelection();
    setElementDefinitionDraft((current) => ({
      ...current,
      variableScope: `${stringOf(selectedCategory?.subCode) || "scope"} / Tier ${selectedTier || "-"}`,
      policyNote: en
        ? `Auto-filled from the current selection. Direct-required ${policyCodes.directRequiredCodes.length}, fallback ${policyCodes.fallbackCodes.length}, auto-calculated ${policyCodes.autoCalculatedCodes.length}, supplemental ${policyCodes.supplementalCodes.length}.`
        : `현재 선택 기준으로 자동 채움. 직접입력 필수 ${policyCodes.directRequiredCodes.length}건, 대체 허용 ${policyCodes.fallbackCodes.length}건, 자동계산 ${policyCodes.autoCalculatedCodes.length}건, 보조 입력 ${policyCodes.supplementalCodes.length}건.`,
      directRequiredCodes: policyCodes.directRequiredCodes.join(", "),
      fallbackCodes: policyCodes.fallbackCodes.join(", "),
      autoCalculatedCodes: policyCodes.autoCalculatedCodes.join(", ")
    }));
  }

  function applyElementTemplate(templateKey: string) {
    const baseLabel = `${stringOf(selectedCategory?.subCode) || "EMISSION"}_T${selectedTier || 0}`;
    const policyCodes = collectPolicyCodesForCurrentSelection();
    const templates: Record<string, Record<string, unknown>> = {
      workspace: {
        elementKey: `${baseLabel}_WORKSPACE`,
        elementName: en ? "Input workspace" : "입력 작업공간",
        elementType: "workspace",
        layoutZone: "workspace",
        componentType: "DiagnosticCard",
        bindingTarget: "inputs/sessionId",
        defaultLabel: en ? "Input workspace" : "입력 작업공간",
        defaultLabelEn: "Input workspace",
        variableScope: `${stringOf(selectedCategory?.subCode) || "scope"} / Tier ${selectedTier || "-"}`,
        policyNote: en ? "Template for the main editable variable workspace." : "주요 변수 입력 작업공간용 템플릿입니다.",
        directRequiredCodes: policyCodes.directRequiredCodes.join(", "),
        fallbackCodes: policyCodes.fallbackCodes.join(", "),
        autoCalculatedCodes: policyCodes.autoCalculatedCodes.join(", "),
        description: en ? "Template for the main editable variable workspace." : "실제 변수값을 입력하는 메인 작업영역용 템플릿입니다."
      },
      catalog: {
        elementKey: `${baseLabel}_VARIABLE_CATALOG`,
        elementName: en ? "Variable definition catalog" : "변수 정의 카탈로그",
        elementType: "section",
        layoutZone: "catalog",
        componentType: "DiagnosticCard",
        bindingTarget: "visibleVariables",
        defaultLabel: en ? "Variable definition catalog" : "변수 정의 카탈로그",
        defaultLabelEn: "Variable definition catalog",
        variableScope: "visibleVariables / selected tier variable policies",
        policyNote: en ? "Template for the variable-policy catalog." : "변수 정책 카탈로그용 템플릿입니다.",
        directRequiredCodes: policyCodes.directRequiredCodes.join(", "),
        fallbackCodes: policyCodes.fallbackCodes.join(", "),
        autoCalculatedCodes: policyCodes.autoCalculatedCodes.join(", "),
        description: en ? "Template for policy cards that describe variable input rules." : "변수 입력 규칙을 보여주는 정책 카드용 템플릿입니다."
      },
      calc_log: {
        elementKey: `${baseLabel}_CALC_LOG`,
        elementName: en ? "Calculation logs" : "계산 로그",
        elementType: "result",
        layoutZone: "result",
        componentType: "DiagnosticCard",
        bindingTarget: "calculationResult.logs",
        defaultLabel: en ? "Calculation logs" : "계산 로그",
        defaultLabelEn: "Calculation logs",
        variableScope: "resolved factors / calculation trace",
        policyNote: en ? "Template for showing how direct, fallback, and derived paths were resolved." : "직접값, 대체값, 유도식 적용 경로를 보여주는 템플릿입니다.",
        directRequiredCodes: "",
        fallbackCodes: policyCodes.fallbackCodes.join(", "),
        autoCalculatedCodes: policyCodes.autoCalculatedCodes.join(", "),
        description: en ? "Template for calculation trace and interpretation logs." : "계산 추적과 해석 로그를 보여주는 템플릿입니다."
      },
      applied_factors: {
        elementKey: `${baseLabel}_APPLIED_FACTORS`,
        elementName: en ? "Applied factors" : "적용 계수 목록",
        elementType: "result",
        layoutZone: "result",
        componentType: "DiagnosticCard",
        bindingTarget: "calculationResult.appliedFactors",
        defaultLabel: en ? "Applied factors" : "적용 계수 목록",
        defaultLabelEn: "Applied factors",
        variableScope: "applied factors / fallback summary",
        policyNote: en ? "Template for the factor list that records stored/default/derived application." : "저장값/기본값/유도식 계수 적용 내역을 기록하는 템플릿입니다.",
        directRequiredCodes: "",
        fallbackCodes: policyCodes.fallbackCodes.join(", "),
        autoCalculatedCodes: policyCodes.autoCalculatedCodes.join(", "),
        description: en ? "Template for applied factor tracking." : "적용 계수 추적용 템플릿입니다."
      },
      validation: {
        elementKey: `${baseLabel}_VALIDATION_NOTICE`,
        elementName: en ? "Validation notice" : "검증/경고 안내",
        elementType: "notice",
        layoutZone: "action",
        componentType: "PageStatusNotice",
        bindingTarget: "warning/validationIssues",
        defaultLabel: en ? "Validation notice" : "검증/경고 안내",
        defaultLabelEn: "Validation notice",
        variableScope: "validation issues",
        policyNote: en ? "Template for blocking save/calculate when direct-required inputs are missing." : "직접입력 필수값 누락 시 저장/계산을 차단하는 안내 템플릿입니다.",
        directRequiredCodes: policyCodes.directRequiredCodes.join(", "),
        fallbackCodes: "",
        autoCalculatedCodes: "",
        description: en ? "Template for missing-required-input and row-alignment warnings." : "필수 입력 누락과 라인 정렬 경고용 템플릿입니다."
      }
    };
    const next = templates[templateKey];
    if (!next) {
      return;
    }
    setElementDefinitionDraft((current) => ({
      ...current,
      ...next
    }));
  }

  function formulaCodeOf(variable: EmissionVariableDefinition) {
    return documentFormulaText(displayVariableCode(selectedCategory, selectedTier, variable));
  }

  function sectionHighlightedTokens(sectionId: string) {
    const activeSection = variableSections[activeFormulaStep];
    if (!activeSection || activeSection.id !== sectionId) {
      return [];
    }
    const sectionVariables = sectionVariablesFor(sectionId);
    const completedTokens = sectionVariables
      .filter((variable) => {
        const code = variableCodeOf(variable);
        return (inputs[code] || []).some((row, rowIndex) => {
          if (isConditionalFieldDisabled(code, rowIndex)) {
            return false;
          }
          return row.value.trim() !== "";
        });
      })
      .map((variable) => formulaCodeOf(variable));
    return Array.from(new Set([hoveredFormulaToken, focusedFormulaToken, ...completedTokens].filter(Boolean)));
  }

  function sectionFormulaMappings(sectionId: string) {
    return sectionVariablesFor(sectionId)
      .map((variable) => ({
        code: formulaCodeOf(variable),
        name: displayVariableName(selectedCategory, selectedTier, variable)
      }))
      .filter((item) => item.code);
  }

  function previewCardForRow(sectionId: string, rowIndex: number) {
    return sectionPreviewCards(sectionId)[rowIndex] || null;
  }

  function previewValueForVariable(variable: EmissionVariableDefinition, rowIndex?: number) {
    const code = variableCodeOf(variable);
    const rawValue = typeof rowIndex === "number"
      ? inputValueAt(code, rowIndex)
      : (inputs[code] || []).map((row) => row.value.trim()).find(Boolean) || "";
    if (isDerivedCarbonateFactorVariable(selectedCategory, selectedTier, variable)) {
      const derivedValue = typeof rowIndex === "number" ? derivedFactorValue(code, rowIndex) : "";
      return derivedValue || (en ? "Calculated from selection" : "선택값 기준 자동계산");
    }
    return optionLabelForValue(variable, rawValue) || rawValue || (en ? "Waiting for input" : "입력 대기");
  }

  function previewLineForVariable(variable: EmissionVariableDefinition, rowIndex?: number) {
    const value = previewValueForVariable(variable, rowIndex);
    const unit = displayUnitLabel(stringOf(variable.unit), en);
    return unit && unit !== "-"
      ? `${displayVariableName(selectedCategory, selectedTier, variable)}: ${value} (${unit})`
      : `${displayVariableName(selectedCategory, selectedTier, variable)}: ${value}`;
  }

  function sectionFactorTokens(sectionId: string) {
    return sectionVariablesFor(sectionId)
      .flatMap((variable) => {
        const formulaCode = formulaCodeOf(variable);
        return [
          stringOf(variable.varCode),
          displayVariableCode(selectedCategory, selectedTier, variable),
          formulaCode
        ];
      })
      .map((token) => stringOf(token).toLowerCase())
      .filter(Boolean);
  }

  function findSummationGroup(varCode: string) {
    const normalizedVarCode = stringOf(varCode).toUpperCase();
    return summationGroups.find((group) => group.includes(normalizedVarCode)) || [normalizedVarCode];
  }

  function findVariableByCode(varCode: string) {
    const normalizedVarCode = stringOf(varCode).toUpperCase();
    return visibleVariables.find((item) => variableCodeOf(item) === normalizedVarCode) || null;
  }

  function isConditionalFieldDisabled(varCode: string, rowIndex: number) {
    return isConditionallyDisabledVariable(selectedCategory, selectedTier, inputs, findVariableByCode(varCode), rowIndex);
  }

  function shouldShowConditionalVar(variable: EmissionVariableDefinition) {
    return shouldShowConditionalVariable(selectedCategory, selectedTier, inputs, variable);
  }

  function conditionalFieldPlaceholder(variable: EmissionVariableDefinition, rowIndex: number) {
    if (isConditionalFieldDisabled(variableCodeOf(variable), rowIndex)) {
      return en ? "Not used for the current condition" : "현재 조건에서는 사용하지 않습니다";
    }
    return stringOf(variable.unit) || (en ? "Enter value" : "값 입력");
  }

  function repeatGroupAnchorCode(varCode: string) {
    return findSummationGroup(varCode)[0] || stringOf(varCode).toUpperCase();
  }

  function inputValueAt(varCode: string, rowIndex: number) {
    return inputs[stringOf(varCode).toUpperCase()]?.[rowIndex]?.value || "";
  }

  function optionLabelForValue(variable: EmissionVariableDefinition | null, value: string) {
    if (!variable || !value) {
      return "";
    }
    return variableOptions(variable, value).find((option) => option.code === value)?.label || value;
  }

  function rowContextSummary(varCode: string, rowIndex: number) {
    const anchorCode = repeatGroupAnchorCode(varCode);
    const anchorVariable = findVariableByCode(anchorCode);
    const anchorValue = inputValueAt(anchorCode, rowIndex);
    const anchorLabel = optionLabelForValue(anchorVariable, anchorValue) || anchorValue;
    const anchorTitle = anchorVariable
      ? displayVariableName(selectedCategory, selectedTier, anchorVariable)
      : (en ? "selected item" : "선택 항목");
    if (!anchorLabel) {
      return en
        ? `Line ${rowIndex + 1}: select ${anchorTitle} first`
        : `라인 ${rowIndex + 1}: ${anchorTitle}을 먼저 선택하세요`;
    }
    return en
      ? `Line ${rowIndex + 1}: ${anchorTitle} = ${anchorLabel}`
      : `라인 ${rowIndex + 1}: ${anchorTitle} = ${anchorLabel}`;
  }

  function repeatableSectionRowCount(sectionVariables: EmissionVariableDefinition[]) {
    return Math.max(
      1,
      ...sectionVariables.map((variable) => {
        const code = variableCodeOf(variable);
        return (inputs[code] || [DEFAULT_INPUT_ROW]).length;
      })
    );
  }

  function sectionVariablesFor(sectionId: string) {
    return variableSections
      .find((section) => section.id === sectionId)
      ?.codes.map((code) => visibleVariables.find((variable) => variableCodeOf(variable) === code))
      .filter((variable): variable is EmissionVariableDefinition => Boolean(variable))
      .filter((variable) => shouldShowConditionalVar(variable)) || [];
  }

  function sectionForVariableCode(code: string) {
    return variableSections.find((section) => section.codes.includes(code)) || null;
  }

  function validationInputId(sectionId: string, code: string, lineNo?: number | null) {
    const safeSectionId = stringOf(sectionId).replace(/[^a-zA-Z0-9_-]/g, "-");
    const safeCode = stringOf(code).replace(/[^a-zA-Z0-9_-]/g, "-");
    return `validation-input-${safeSectionId}-${safeCode}-${lineNo ?? "single"}`;
  }

  function sectionCompletion(sectionId: string) {
    const sectionVariables = sectionVariablesFor(sectionId);
    const requiredVariables = sectionVariables.filter((variable) => requiresDirectInput(variable));
    if (requiredVariables.length === 0) {
      return { complete: false, filled: 0, total: 0 };
    }
    let filled = 0;
    requiredVariables.forEach((variable) => {
      const code = variableCodeOf(variable);
      const rows = inputs[code] || [DEFAULT_INPUT_ROW];
      const hasValue = rows.some((row, rowIndex) => {
        if (isConditionalFieldDisabled(code, rowIndex)) {
          return true;
        }
        return row.value.trim() !== "";
      });
      if (hasValue) {
        filled += 1;
      }
    });
    return { complete: filled === requiredVariables.length, filled, total: requiredVariables.length };
  }

  function sectionPreviewCards(sectionId: string) {
    const sectionVariables = sectionVariablesFor(sectionId);
    if (sectionVariables.length > 0 && sectionVariables.every((variable) => isRepeatableVariable(variable))) {
      const anchorCode = variableCodeOf(sectionVariables[0]);
      return Array.from({ length: repeatableSectionRowCount(sectionVariables) }, (_, rowIndex) => ({
        title: `${en ? "Line" : "라인"} ${rowIndex + 1}`,
        emphasis: rowContextSummary(anchorCode, rowIndex),
        lines: sectionVariables.map((variable) => previewLineForVariable(variable, rowIndex))
      }));
    }
    return sectionVariables.map((variable) => {
      const formulaCode = formulaCodeOf(variable);
      return {
        title: displayVariableName(selectedCategory, selectedTier, variable),
        emphasis: previewValueForVariable(variable),
        lines: [
          formulaCode ? `${en ? "Formula term" : "수식 항"}: ${formulaCode}` : "",
          displayUnitLabel(stringOf(variable.unit), en) !== "-" ? `${en ? "Unit" : "단위"}: ${displayUnitLabel(stringOf(variable.unit), en)}` : ""
        ].filter(Boolean)
      };
    });
  }

  function factorCardsForSection(sectionId: string) {
    const section = variableSections.find((item) => item.id === sectionId);
    const explicitFactorCodes = stringOf(section?.relatedFactorCodes)
      .split(",")
      .map((code) => stringOf(code).trim().toUpperCase())
      .filter(Boolean);
    if (explicitFactorCodes.length > 0) {
      const explicitMatches = factors.filter((factor) => explicitFactorCodes.includes(stringOf(factor.factorCode).toUpperCase()));
      if (explicitMatches.length > 0) {
        return explicitMatches;
      }
    }
    const sectionTokens = sectionFactorTokens(sectionId);
    const matchedFactors = factors.filter((factor) => {
      const token = `${stringOf(factor.factorCode)} ${stringOf(factor.factorName)} ${stringOf(factor.remark)}`.toLowerCase();
      return sectionTokens.some((sectionToken) => sectionToken && token.includes(sectionToken));
    });
    return matchedFactors.length > 0 ? matchedFactors : factors;
  }

  function derivedPreviewCards(section: (typeof variableSections)[number]) {
    const previewType = stringOf(section.previewType);
    if (!previewType) {
      return [];
    }
    if (previewType === "cement-tier2-cf" && isCementTier2Scope(selectedCategory, selectedTier)) {
      const preview = cementTier2DerivedSummary(en, inputs);
      return [{
        title: en ? "Tier 2 correction preview" : "Tier 2 보정계수 미리보기",
        lines: [preview.efcText, preview.efclText, preview.cfckdText],
        emphasis: preview.totalText
      }];
    }
    if (!isLimeTier2Scope(selectedCategory, selectedTier)) {
      return [];
    }
    return (inputs.MLI || [DEFAULT_INPUT_ROW]).map((_, rowIndex) => {
      const preview = limeTier2DerivedSummary(en, inputs, rowIndex);
      if (previewType === "lime-tier2-ef") {
        return {
          title: `${en ? "Line" : "라인"} ${rowIndex + 1}`,
          lines: [preview.efAText, preview.efBText, preview.efCText],
          emphasis: preview.efText
        };
      }
      if (previewType === "lime-tier2-cf") {
        return {
          title: `${en ? "Line" : "라인"} ${rowIndex + 1}`,
          lines: [],
          emphasis: preview.cfText
        };
      }
      if (previewType === "lime-tier2-ch") {
        return {
          title: `${en ? "Line" : "라인"} ${rowIndex + 1}`,
          lines: [],
          emphasis: preview.chText
        };
      }
      return null;
    }).filter((item): item is { title: string; lines: string[]; emphasis: string } => Boolean(item));
  }

  function activeSectionPreviewCards() {
    const activeSection = variableSections[activeFormulaStep];
    if (!activeSection) {
      return [];
    }
    return sectionPreviewCards(activeSection.id);
  }

  function formulaAliasCode(token: string) {
    const normalized = stringOf(token).trim();
    const lower = normalized.toLowerCase();
    const aliases: Record<string, string> = {
      mci: "MCI",
      ccli: "CCLI",
      im: "IM",
      ex: "EX",
      mcl: "MCL",
      efcl: "EFCL",
      efclc: "EFCLC",
      cfckd: "CFCKD",
      efi: "EFI",
      mi: "MI",
      fi: "FI",
      md: "MD",
      cd: "CD",
      fd: "FD",
      efd: "EFD",
      mk: "MK",
      xk: "XK",
      efk: "EFK",
      "ef석회": "EF_LIME",
      ml: "MLI",
      "cf_lkd": "CF_LKD",
      "c_h": "C_H"
    };
    return aliases[lower] || normalized.toUpperCase();
  }

  function inputNumberForCode(code: string, rowIndex?: number | null) {
    const normalizedCode = stringOf(code).toUpperCase();
    if (!normalizedCode) {
      return 0;
    }
    const rows = inputs[normalizedCode] || [];
    if (typeof rowIndex === "number" && rowIndex >= 0) {
      return numberOf(rows[rowIndex]?.value);
    }
    return numberOf(rows.find((row) => row.value.trim())?.value || "");
  }

  function factorNumberForCode(code: string) {
    const normalizedCode = stringOf(code).toUpperCase();
    const matchedFactor = factors.find((factor) => stringOf(factor.factorCode).toUpperCase() === normalizedCode);
    return numberOf(matchedFactor?.factorValue);
  }

  function limeTier2DerivedValues(rowIndex: number) {
    const mli = inputNumberForCode("MLI", rowIndex);
    const cao = numberOf(inputValueAt("CAO_CONTENT", rowIndex));
    const caoMgo = numberOf(inputValueAt("CAO_MGO_CONTENT", rowIndex));
    const md = inputNumberForCode("MD", rowIndex);
    const cd = numberOf(inputValueAt("CD", rowIndex));
    const fd = numberOf(inputValueAt("FD", rowIndex));
    const hydratedYn = stringOf(inputValueAt("HYDRATED_LIME_PRODUCTION_YN", rowIndex)).toUpperCase();
    const x = numberOf(inputValueAt("X", rowIndex));
    const y = numberOf(inputValueAt("Y", rowIndex));
    const limeType = stringOf(inputValueAt("LIME_TYPE", rowIndex)).toUpperCase();
    const usesDolomitic = limeType.includes("DOLOMITIC") || limeType.includes("고토");
    const ef = usesDolomitic
      ? 0.913 * (caoMgo > 1 ? caoMgo / 100 : caoMgo || 0.95)
      : 0.785 * (cao > 1 ? cao / 100 : cao || 0.95);
    const cf = mli > 0 && md > 0 && cd > 0 && fd > 0 ? 1 + (md / mli) * (cd > 1 ? cd / 100 : cd) * (fd > 1 ? fd / 100 : fd) : 1.02;
    const xRatio = x > 1 ? x / 100 : x;
    const yRatio = y > 1 ? y / 100 : y;
    const ch = hydratedYn === "Y" ? (xRatio > 0 && yRatio > 0 ? 1 - (xRatio * yRatio) : 0.97) : 1;
    return { ef, cf, ch };
  }

  function resolveFormulaToken(token: string, rowIndex?: number | null) {
    const trimmed = stringOf(token).trim();
    const numeric = Number(trimmed);
    if (trimmed && Number.isFinite(numeric)) {
      return { value: numeric, note: "" };
    }
    const iteratorMatch = trimmed.match(/^(.*?),([A-Za-z0-9가-힣]+)$/);
    const baseToken = iteratorMatch ? iteratorMatch[1] : trimmed;
    const code = formulaAliasCode(baseToken);
    if (code === "EFI") {
      return { value: numberOf(carbonateFactorOf(inputValueAt("CARBONATE_TYPE", rowIndex || 0))), note: stringOf(inputValueAt("CARBONATE_TYPE", rowIndex || 0)) || (en ? "carbonate mapping" : "탄산염 매핑") };
    }
    if (code === "EFK") {
      return { value: numberOf(carbonateFactorOf(inputValueAt("RAW_MATERIAL_CARBONATE_TYPE", rowIndex || 0))), note: stringOf(inputValueAt("RAW_MATERIAL_CARBONATE_TYPE", rowIndex || 0)) || (en ? "raw material mapping" : "원료 매핑") };
    }
    if (code === "EFD") {
      return { value: numberOf(carbonateFactorOf(inputValueAt("LKD_CARBONATE_TYPE", rowIndex || 0))) || inputNumberForCode(code, rowIndex), note: stringOf(inputValueAt("LKD_CARBONATE_TYPE", rowIndex || 0)) || "" };
    }
    if (code === "EF_LIME" || code === "CF_LKD" || code === "C_H") {
      const derived = limeTier2DerivedValues(rowIndex || 0);
      if (code === "EF_LIME") {
        return { value: derived.ef || numberOf(limeDefaultFactor?.factorValue), note: en ? "lime factor preview" : "석회 계수 미리보기" };
      }
      if (code === "CF_LKD") {
        return { value: derived.cf, note: en ? "LKD correction preview" : "LKD 보정계수 미리보기" };
      }
      return { value: derived.ch, note: en ? "hydration correction preview" : "수화 보정 미리보기" };
    }
    const directInputValue = inputNumberForCode(code, rowIndex);
    if (directInputValue) {
      return { value: directInputValue, note: en ? "input value" : "입력값" };
    }
    const factorValue = factorNumberForCode(code);
    if (factorValue) {
      return { value: factorValue, note: en ? "factor registry" : "계수 테이블" };
    }
    return { value: 0, note: en ? "unresolved -> 0" : "미해결 -> 0" };
  }

  function formulaIteratorRows(block: FormulaTreeBlock) {
    const nestedTokens = buildFormulaTreeExpression(block.items).match(/[A-Za-z가-힣_]+,[A-Za-z0-9가-힣]+/g) || [];
    const rowCounts = nestedTokens.map((token) => {
      const baseToken = token.split(",")[0];
      const code = formulaAliasCode(baseToken);
      return Math.max((inputs[code] || []).length, 1);
    });
    return Array.from({ length: Math.max(...rowCounts, 1) }, (_, index) => index);
  }

  function evaluateFormulaTreeBlocks(blocks: FormulaTreeBlock[], trace: FormulaPreviewTrace[], rowIndex?: number | null): number {
    return blocks.reduce((total, block, index) => {
      const nextValue = evaluateFormulaTreeBlock(block, trace, rowIndex);
      if (index === 0) {
        return nextValue;
      }
      if (block.joiner === "-") {
        return total - nextValue;
      }
      if (block.joiner === "×") {
        return total * nextValue;
      }
      if (block.joiner === "÷") {
        return nextValue === 0 ? Number.NaN : total / nextValue;
      }
      return total + nextValue;
    }, 0);
  }

  function evaluateFormulaTreeBlock(block: FormulaTreeBlock, trace: FormulaPreviewTrace[], rowIndex?: number | null): number {
    if (block.kind === "token") {
      const resolved = resolveFormulaToken(block.token, rowIndex);
      trace.push({ label: block.token || (en ? "token" : "토큰"), expression: block.token || "0", result: resolved.value, note: resolved.note });
      return resolved.value;
    }
    if (block.kind === "group") {
      const result = evaluateFormulaTreeBlocks(block.items, trace, rowIndex);
      trace.push({ label: en ? "group" : "그룹", expression: formatFormulaTreeBlock(block), result });
      return result;
    }
    if (block.kind === "fraction") {
      const numerator = evaluateFormulaTreeBlocks(block.numerator, trace, rowIndex);
      const denominator = evaluateFormulaTreeBlocks(block.denominator, trace, rowIndex);
      const result = denominator === 0 ? Number.NaN : numerator / denominator;
      trace.push({ label: en ? "fraction" : "분수", expression: formatFormulaTreeBlock(block), result });
      return result;
    }
    const sumResult = formulaIteratorRows(block).reduce((acc, nextRowIndex) => {
      const lineValue = evaluateFormulaTreeBlocks(block.items, trace, nextRowIndex);
      trace.push({
        label: `${block.iterator || "i"}[${nextRowIndex + 1}]`,
        expression: buildFormulaTreeExpression(block.items),
        result: lineValue
      });
      return acc + lineValue;
    }, 0);
    trace.push({ label: `SUM ${block.iterator || "i"}`, expression: formatFormulaTreeBlock(block), result: sumResult });
    return sumResult;
  }

  const definitionFormulaPreview = (() => {
    if (appliedFormulaTree.length === 0) {
      return null;
    }
    const trace: FormulaPreviewTrace[] = [];
    const total = evaluateFormulaTreeBlocks(appliedFormulaTree, trace);
    return {
      total,
      trace,
      formula: buildFormulaTreeExpression(appliedFormulaTree)
    };
  })();

  function moveFormulaStep(direction: "prev" | "next") {
    setActiveFormulaStep((current) => {
      if (direction === "prev") {
        return Math.max(0, current - 1);
      }
      return Math.min(variableSections.length - 1, current + 1);
    });
  }

  function renderFormulaSection(section: (typeof variableSections)[number], sectionIndex: number) {
    const sectionVariables = section.codes
      .map((code) => visibleVariables.find((variable) => variableCodeOf(variable) === code))
      .filter((variable): variable is EmissionVariableDefinition => Boolean(variable))
      .filter((variable) => shouldShowConditionalVar(variable));
    const activeSection = sectionIndex === activeFormulaStep;
    const completion = sectionCompletion(section.id);
    const previewCards = sectionPreviewCards(section.id);
    const metadataOnlySection = sectionVariables.length === 0;
    return (
      <section
        className={`rounded-[var(--kr-gov-radius)] border px-4 py-4 transition ${
          activeSection ? "border-[var(--kr-gov-blue)] bg-slate-50" : "border-[var(--kr-gov-border-light)] bg-slate-100/70 opacity-60"
        }`}
        id={`formula-section-${section.id}`}
        key={section.id}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-[var(--kr-gov-text-primary)]">{sectionIndex + 1}. {section.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{section.description}</p>
            {section.formula ? (
              <div className="mt-3">
                <FormulaNotation active={activeSection} compact formula={section.formula} highlightedTokens={sectionHighlightedTokens(section.id)} />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${activeSection ? "bg-blue-100 text-[var(--kr-gov-blue)]" : "bg-white text-slate-600"}`}>
              {activeSection ? (en ? "Active block" : "활성 블록") : (en ? "Inactive" : "비활성")}
            </span>
            {completion.total > 0 ? (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${completion.complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {completion.filled}/{completion.total} {en ? "required" : "필수"}
              </span>
            ) : null}
          </div>
        </div>
        {!activeSection ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-3">
              <p className="text-sm text-[var(--kr-gov-text-primary)]">
                {completion.complete ? (en ? "This block has the required inputs." : "이 블록은 필수 입력이 완료되었습니다.") : (en ? "Open this block to continue the formula." : "이 블록을 열어 수식을 이어서 입력하세요.")}
              </p>
            </div>
            {previewCards.length > 0 ? (
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">
                    {en ? "Step preview" : "스텝 미리보기"}
                  </p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    {en ? "Read only" : "읽기 전용"}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {previewCards.slice(0, 2).map((previewCard) => (
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3" key={`${section.id}-inactive-preview-${previewCard.title}`}>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{previewCard.title}</p>
                      <p className="mt-1 text-sm font-black text-[var(--kr-gov-blue)]">{previewCard.emphasis}</p>
                    </div>
                  ))}
                  {previewCards.length > 2 ? (
                    <p className="text-xs text-[var(--kr-gov-text-secondary)]">
                      {en ? `+ ${previewCards.length - 2} more preview item(s) inside this step` : `이 스텝 안에 미리보기 ${previewCards.length - 2}건이 더 있습니다.`}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {activeSection && previewCards.length > 0 ? (
          <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-white px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Calculated result under current formula" : "현재 수식 바로 아래 계산 결과"}</p>
            <div className="mt-3 space-y-2">
              {previewCards.map((previewCard) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3" key={`${section.id}-inline-${previewCard.title}`}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{previewCard.title}</p>
                  <p className="mt-1 text-sm font-black text-[var(--kr-gov-blue)]">{previewCard.emphasis}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {activeSection && derivedPreviewCards(section).length > 0 ? (
          <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-dashed border-blue-200 bg-white px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Derived factor preview" : "파생계수 계산 미리보기"}</p>
            <div className="mt-2 space-y-2 text-sm text-[var(--kr-gov-text-primary)]">
              {derivedPreviewCards(section).map((previewCard) => {
                return (
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3" key={`${section.id}-${previewCard.title}`}>
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{previewCard.title}</p>
                    {previewCard.lines.length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {previewCard.lines.map((line) => (
                          <p key={`${section.id}-${previewCard.title}-${line}`}>{line}</p>
                        ))}
                        <p className="font-bold text-[var(--kr-gov-blue)]">{previewCard.emphasis}</p>
                      </div>
                    ) : (
                      <p className="mt-1">{previewCard.emphasis}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {activeSection ? (
          <>
            <div className="mt-4 space-y-4">
              {metadataOnlySection ? (
                <section className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                  <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "No variable rows bound yet" : "아직 연결된 변수 행이 없습니다"}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                    {en
                      ? "This block comes from the definition draft section metadata only. Bind variable rows in definition studio when the input fields are ready."
                      : "이 블록은 정의 초안의 섹션 메타데이터만으로 구성되어 있습니다. 입력 필드가 준비되면 definition studio에서 변수 행을 연결하세요."}
                  </p>
                </section>
              ) : sectionVariables.every((variable) => isRepeatableVariable(variable)) ? (
                <section className="overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Row-based input sheet" : "행 기준 입력 시트"}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">
                        {en ? "Enter one target per row and complete the formula block on one screen." : "한 행을 한 대상 기준으로 입력하고 이 블록을 한 화면에서 완성합니다."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {Array.from({ length: repeatableSectionRowCount(sectionVariables) }, (_, rowIndex) => (
                        <button
                          className="rounded-full border border-[var(--kr-gov-border-light)] bg-white px-3 py-1 text-xs font-bold text-[var(--kr-gov-text-secondary)] transition hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]"
                          key={`${section.id}-jump-${rowIndex + 1}`}
                          onClick={() => {
                            document.getElementById(`${section.id}-row-${rowIndex + 1}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                          type="button"
                        >
                          {en ? "Line" : "라인"} {rowIndex + 1}
                        </button>
                      ))}
                      <MemberButton onClick={() => addInputRow(variableCodeOf(sectionVariables[0]))} type="button" variant="secondary">
                        {en ? "Add row" : "행 추가"}
                      </MemberButton>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 border-b border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Line" : "라인"}</th>
                          <th className="sticky left-[88px] z-10 min-w-[260px] border-b border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Current target" : "현재 입력 대상"}</th>
                          {sectionVariables.map((variable) => (
                            <th
                              className={`min-w-[220px] border-b px-4 py-3 text-left align-top ${
                                supportsFallbackInput(variable)
                                  ? "border-amber-200 bg-amber-50/60"
                                  : "border-[var(--kr-gov-border-light)] bg-white"
                              }`}
                              key={`${section.id}-${stringOf(variable.varCode)}-header`}
                            >
                              <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{displayVariableName(selectedCategory, selectedTier, variable)}</p>
                              {formulaCodeOf(variable) ? (
                                <div className="mt-2">
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Formula term" : "수식 항"}</p>
                                  <div className="mt-1">
                                    <div onMouseEnter={() => setHoveredFormulaToken(formulaCodeOf(variable))} onMouseLeave={() => setHoveredFormulaToken("")}>
                                      <FormulaNotation compact formula={formulaCodeOf(variable)} highlightedTokens={sectionHighlightedTokens(section.id)} />
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                              <p className="mt-1 text-xs font-bold text-[var(--kr-gov-blue)]">{displayUnitLabel(stringOf(variable.unit), en)}</p>
                              {supportsFallbackInput(variable) ? (
                                <p className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                                  {en ? "Fallback defined" : "대체값 정의됨"}
                                </p>
                              ) : null}
                              {stringOf(variable.varDesc) ? <p className="mt-2 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{stringOf(variable.varDesc)}</p> : null}
                              {limeTier2VariableHint(en, selectedCategory, selectedTier, variable) ? <p className="mt-2 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{limeTier2VariableHint(en, selectedCategory, selectedTier, variable)}</p> : null}
                            </th>
                          ))}
                          <th className="border-b border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Action" : "작업"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: repeatableSectionRowCount(sectionVariables) }, (_, rowIndex) => {
                          const rowPreview = previewCardForRow(section.id, rowIndex);
                          return (
                            <Fragment key={`${section.id}-row-group-${rowIndex + 1}`}>
                              <tr className="align-top" id={`${section.id}-row-${rowIndex + 1}`}>
                                <td className="sticky left-0 z-[1] border-b border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-3 py-2 text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Line" : "라인"} {rowIndex + 1}</div>
                                </td>
                                <td className="sticky left-[88px] z-[1] min-w-[260px] border-b border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                                  <div className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-3 py-3">
                                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{rowContextSummary(variableCodeOf(sectionVariables[0]), rowIndex)}</p>
                                    <p className="mt-1 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{en ? "Use this target context for every value in the same row." : "같은 행의 모든 값은 이 대상 기준으로 입력합니다."}</p>
                                  </div>
                                </td>
                                {sectionVariables.map((variable) => {
                                  const code = stringOf(variable.varCode);
                                  const row = inputs[code]?.[rowIndex] || { lineNo: rowIndex + 1, value: "" };
                                  const inputType = stringOf(variable.inputType).toUpperCase();
                                  const disabledByLimeTier2 = isConditionalFieldDisabled(code, rowIndex);
                                  return (
                                    <td className="border-b border-[var(--kr-gov-border-light)] px-4 py-4" key={`${section.id}-${code}-row-${rowIndex + 1}`}>
                                      <div className="space-y-2">
                                        {arrayOf(variable.options).length > 0 ? (
                                          <AdminSelect
                                            className={validationInputClass(section.id, code, rowIndex + 1)}
                                            disabled={disabledByLimeTier2}
                                            id={validationInputId(section.id, code, rowIndex + 1)}
                                            onChange={(event) => updateInput(code, rowIndex, event.target.value)}
                                            onMouseEnter={() => setHoveredFormulaToken(formulaCodeOf(variable))}
                                            onMouseLeave={() => setHoveredFormulaToken("")}
                                            onFocus={() => setFocusedFormulaToken(formulaCodeOf(variable))}
                                            value={row.value}
                                          >
                                            <option value="">{en ? "Select option" : "선택"}</option>
                                            {variableOptions(variable, row.value).map((option) => (
                                              <option key={`${code}-${rowIndex + 1}-${option.code}`} value={option.code}>{option.label}</option>
                                            ))}
                                          </AdminSelect>
                                        ) : (
                                          <AdminInput
                                            className={validationInputClass(section.id, code, rowIndex + 1)}
                                            disabled={disabledByLimeTier2}
                                            id={validationInputId(section.id, code, rowIndex + 1)}
                                            onChange={(event) => updateInput(code, rowIndex, event.target.value)}
                                            onMouseEnter={() => setHoveredFormulaToken(formulaCodeOf(variable))}
                                            onMouseLeave={() => setHoveredFormulaToken("")}
                                            onFocus={() => setFocusedFormulaToken(formulaCodeOf(variable))}
                                            placeholder={conditionalFieldPlaceholder(variable, rowIndex)}
                                            step={inputType === "NUMBER" ? "any" : undefined}
                                            type={inputType === "NUMBER" ? "number" : "text"}
                                            value={disabledByLimeTier2 ? "" : row.value}
                                          />
                                        )}
                                        {shouldShowDirectInputWarning(variable, rowIndex) ? (
                                          <p className="rounded-[var(--kr-gov-radius)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
                                            {en ? "Direct input required. This field is not supplemented automatically." : "직접 입력 필요. 이 항목은 자동 보완되지 않습니다."}
                                          </p>
                                        ) : null}
                                        {validationMessage(section.id, code, rowIndex + 1) ? (
                                          <p className="rounded-[var(--kr-gov-radius)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
                                            {validationMessage(section.id, code, rowIndex + 1)}
                                          </p>
                                        ) : null}
                                      </div>
                                    </td>
                                  );
                                })}
                                <td className="border-b border-[var(--kr-gov-border-light)] px-4 py-4">
                                  <MemberButton onClick={() => removeInputRow(variableCodeOf(sectionVariables[0]), rowIndex)} type="button" variant="secondary">
                                    {en ? "Remove" : "삭제"}
                                  </MemberButton>
                                </td>
                              </tr>
                              {rowPreview ? (
                                <tr className="bg-blue-50/55">
                                  <td className="border-b border-[var(--kr-gov-border-light)] px-4 py-0" />
                                  <td className="border-b border-[var(--kr-gov-border-light)] px-4 py-0" colSpan={sectionVariables.length + 2}>
                                    <div className="mx-4 mb-4 -mt-1 rounded-[var(--kr-gov-radius)] border border-sky-200 bg-gradient-to-r from-sky-50 to-white px-4 py-3 shadow-[inset_4px_0_0_0_var(--kr-gov-blue)]">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">
                                          {en ? "Line result" : "행 결과"} · {rowPreview.title}
                                        </p>
                                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--kr-gov-blue)]">
                                          {en ? "Live preview" : "실시간 반영"}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-sm font-black leading-5 text-[var(--kr-gov-blue)]">{rowPreview.emphasis}</p>
                                      {rowPreview.lines.length > 0 ? (
                                        <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs leading-5 text-[var(--kr-gov-text-secondary)] xl:grid-cols-2">
                                          {rowPreview.lines.map((line) => (
                                            <p className="rounded-[var(--kr-gov-radius)] bg-white/80 px-3 py-2" key={`${section.id}-${rowPreview.title}-${line}`}>{line}</p>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                sectionVariables.map((variable) => {
                  const code = variableCodeOf(variable);
                  const inputType = stringOf(variable.inputType).toUpperCase();
                  const rows = inputs[code] || [DEFAULT_INPUT_ROW];
                  const derivedFactorVariable = isDerivedCarbonateFactorVariable(selectedCategory, selectedTier, variable);
                  const limeTier2SupplementalVariable = isLimeTier2SupplementalVariable(selectedCategory, selectedTier, variable);
                  const limeTier2Hint = limeTier2VariableHint(en, selectedCategory, selectedTier, variable);
                  const resolutionGuide = resolutionGuideForVariable(en, selectedCategory, selectedTier, variable);
                  return (
                    <section
                      className={`rounded-[var(--kr-gov-radius)] border px-4 py-4 ${
                        supportsFallbackInput(variable)
                          ? "border-amber-200 bg-amber-50/60"
                          : "border-[var(--kr-gov-border-light)] bg-white"
                      }`}
                      key={code}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-black">{displayVariableName(selectedCategory, selectedTier, variable)}</h3>
                          {formulaCodeOf(variable) ? (
                            <div className="mt-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Formula term" : "수식 항"}</p>
                              <div className="mt-1">
                                <div onMouseEnter={() => setHoveredFormulaToken(formulaCodeOf(variable))} onMouseLeave={() => setHoveredFormulaToken("")}>
                                  <FormulaNotation compact formula={formulaCodeOf(variable)} highlightedTokens={sectionHighlightedTokens(section.id)} />
                                </div>
                              </div>
                            </div>
                          ) : null}
                          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{displayUnitLabel(stringOf(variable.unit), en)}</p>
                          {supportsFallbackInput(variable) ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                                {en ? "Fallback defined" : "대체값 정의됨"}
                              </span>
                              <p className="text-xs leading-5 text-amber-700">
                                {fallbackInputDescription(variable)}
                              </p>
                            </div>
                          ) : null}
                          {limeTier2Hint ? <p className="mt-2 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{limeTier2Hint}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {resolutionGuide ? <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700">{resolutionGuide.badge}</span> : null}
                          {limeTier2SupplementalVariable ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">{en ? "Tier 2 only" : "Tier 2 전용"}</span> : null}
                          {isRepeatableVariable(variable) ? <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">{en ? "Summation variable" : "Summation 변수"}</span> : null}
                          {derivedFactorVariable ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{en ? "Auto from carbonate type" : "탄산염 종류 자동 반영"}</span> : null}
                          {isRepeatableVariable(variable) ? (
                            <MemberButton onClick={() => addInputRow(code)} type="button" variant="secondary">
                              {en ? "Add row" : "행 추가"}
                            </MemberButton>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {rows.map((row, rowIndex) => {
                          const disabledByLimeTier2 = isConditionalFieldDisabled(code, rowIndex);
                          const rowPreview = previewCardForRow(section.id, rowIndex);
                          return (
                            <Fragment key={`${code}-${row.lineNo}`}>
                              <div className="grid grid-cols-[96px_1fr_auto] items-end gap-3">
                                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-2 text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Line" : "라인"} {row.lineNo}</div>
                                <label className="flex flex-col gap-2">
                                  <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">
                                    {derivedFactorVariable ? (en ? "AUTO" : "자동계산") : arrayOf(variable.options).length > 0 ? (en ? "SELECT" : "선택형") : (stringOf(variable.inputType) || "TEXT")}
                                  </span>
                                  {derivedFactorVariable ? (
                                    <AdminInput placeholder={en ? "Select carbonate type first" : "먼저 탄산염 종류를 선택하세요"} readOnly type="number" value={derivedFactorValue(code, rowIndex)} />
                                  ) : arrayOf(variable.options).length > 0 ? (
                                    <AdminSelect
                                      className={validationInputClass(section.id, code, row.lineNo)}
                                      disabled={disabledByLimeTier2}
                                      id={validationInputId(section.id, code, row.lineNo)}
                                      onChange={(event) => updateInput(code, rowIndex, event.target.value)}
                                      onMouseEnter={() => setHoveredFormulaToken(formulaCodeOf(variable))}
                                      onMouseLeave={() => setHoveredFormulaToken("")}
                                      onFocus={() => setFocusedFormulaToken(formulaCodeOf(variable))}
                                      value={row.value}
                                    >
                                      <option value="">{en ? "Select option" : "선택"}</option>
                                      {variableOptions(variable, row.value).map((option) => (
                                        <option key={`${code}-${option.code}`} value={option.code}>{option.label}</option>
                                      ))}
                                    </AdminSelect>
                                  ) : (
                                    <AdminInput
                                      className={validationInputClass(section.id, code, row.lineNo)}
                                      disabled={disabledByLimeTier2}
                                      id={validationInputId(section.id, code, row.lineNo)}
                                      onChange={(event) => updateInput(code, rowIndex, event.target.value)}
                                      onMouseEnter={() => setHoveredFormulaToken(formulaCodeOf(variable))}
                                      onMouseLeave={() => setHoveredFormulaToken("")}
                                      onFocus={() => setFocusedFormulaToken(formulaCodeOf(variable))}
                                      placeholder={conditionalFieldPlaceholder(variable, rowIndex)}
                                      step={inputType === "NUMBER" ? "any" : undefined}
                                      type={inputType === "NUMBER" ? "number" : "text"}
                                      value={disabledByLimeTier2 ? "" : row.value}
                                    />
                                  )}
                                  {shouldShowDirectInputWarning(variable, rowIndex) ? (
                                    <span className="rounded-[var(--kr-gov-radius)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
                                      {en ? "Direct input required. This field is not supplemented automatically." : "직접 입력 필요. 이 항목은 자동 보완되지 않습니다."}
                                    </span>
                                  ) : null}
                                  {validationMessage(section.id, code, row.lineNo) ? (
                                    <span className="rounded-[var(--kr-gov-radius)] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
                                      {validationMessage(section.id, code, row.lineNo)}
                                    </span>
                                  ) : null}
                                </label>
                                <div className="flex flex-col items-end gap-2">
                                  {isRepeatableVariable(variable) ? (
                                    <MemberButton onClick={() => removeInputRow(code, rowIndex)} type="button" variant="secondary">
                                      {en ? "Remove" : "삭제"}
                                    </MemberButton>
                                  ) : <span />}
                                </div>
                              </div>
                              {rowPreview ? (
                                <div className="ml-[96px] mt-2 rounded-[var(--kr-gov-radius)] border border-sky-200 bg-gradient-to-r from-sky-50 to-white px-4 py-3 shadow-[inset_4px_0_0_0_var(--kr-gov-blue)]">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">
                                      {en ? "Line result" : "행 결과"} · {rowPreview.title}
                                    </p>
                                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--kr-gov-blue)]">
                                      {en ? "Live preview" : "실시간 반영"}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm font-black leading-5 text-[var(--kr-gov-blue)]">{rowPreview.emphasis}</p>
                                  {rowPreview.lines.length > 0 ? (
                                    <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs leading-5 text-[var(--kr-gov-text-secondary)] md:grid-cols-2">
                                      {rowPreview.lines.map((line) => (
                                        <p className="rounded-[var(--kr-gov-radius)] bg-white/80 px-3 py-2" key={`${section.id}-${rowPreview.title}-${line}`}>{line}</p>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </div>
                    </section>
                  );
                })
              )}
            </div>
            {variableSections.length > 0 ? (
              <div className="sticky bottom-4 z-20 mt-6">
                <div className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Quick block navigation" : "빠른 블록 이동"}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                        {en
                          ? `${activeFormulaStep + 1} / ${variableSections.length} active. Move without scrolling back to the top.`
                          : `${activeFormulaStep + 1} / ${variableSections.length} 블록 활성 상태입니다. 상단으로 돌아가지 않고 이동할 수 있습니다.`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MemberButton
                        disabled={activeFormulaStep <= 0}
                        onClick={() => moveFormulaStep("prev")}
                        type="button"
                        variant="secondary"
                      >
                        {en ? "Prev" : "이전"}
                      </MemberButton>
                      <MemberButton
                        disabled={activeFormulaStep >= variableSections.length - 1}
                        onClick={() => moveFormulaStep("next")}
                        type="button"
                        variant="secondary"
                      >
                        {en ? "Next" : "다음"}
                      </MemberButton>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Immediate formula preview" : "즉시 계산 미리보기"}</p>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "This block updates immediately as values are entered." : "이 블록은 값이 입력될 때마다 즉시 갱신됩니다."}
                </p>
                <div className="mt-3 space-y-3">
                  {previewCards.map((previewCard) => (
                    <article className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-3" key={`${section.id}-${previewCard.title}`}>
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{previewCard.title}</p>
                      <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">{previewCard.emphasis}</p>
                      {previewCard.lines.length > 0 ? (
                        <div className="mt-2 space-y-1 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">
                          {previewCard.lines.map((line) => (
                            <p key={`${section.id}-${previewCard.title}-${line}`}>{line}</p>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                  {previewCards.length === 0 ? (
                    <article className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-3">
                      <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                        {en ? "Preview will appear as soon as this formula block has enough input values." : "이 수식 블록에 필요한 값이 입력되면 여기에 미리보기 계산식이 표시됩니다."}
                      </p>
                    </article>
                  ) : null}
                </div>
              </section>
              <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Related factors and references" : "연관 계수 및 기준값"}</p>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Keep the active formula block and related coefficients on the same screen." : "활성 수식 블록과 연관 계수를 같은 화면에서 확인합니다."}
                </p>
                <div className="mt-3 space-y-3">
                  {selectedCategory && stringOf(selectedCategory.subCode).toUpperCase() === "LIME" && limeDefaultFactor ? (
                    <div className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{en ? "Lime default factor" : "석회 기본 계수"}</p>
                      <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(limeDefaultFactor.factorValue)} {displayUnitLabel(stringOf(limeDefaultFactor.unit), en)}</p>
                    </div>
                  ) : null}
                  {factorCardsForSection(section.id).map((factor) => (
                    <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3" key={`${section.id}-${stringOf(factor.factorCode)}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(factor.factorName) || stringOf(factor.factorCode)}</p>
                          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{displayUnitLabel(stringOf(factor.unit), en)}</p>
                        </div>
                        <p className="text-sm font-black text-[var(--kr-gov-blue)]">{stringOf(factor.factorValue)}</p>
                      </div>
                      {stringOf(factor.remark) ? <p className="mt-2 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{stringOf(factor.remark)}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </section>
    );
  }

  function resetSelectionState() {
    setSelectedTier(0);
    setWizardStep(1);
    setActiveFormulaStep(0);
    setVariables([]);
    setFactors([]);
    setInputs({});
    setFormulaSummary("");
    setCalculationResult(null);
    setSessionId(0);
    setValidationIssues([]);
    setPendingValidationFocus(null);
    updateSessionIdInUrl(0);
  }

  function resetCurrentDraft() {
    setInputs(buildEmptyInputs(variables));
    setCalculationResult(null);
    setSessionId(0);
    setActiveFormulaStep(0);
    setFocusedFormulaToken("");
    setHoveredFormulaToken("");
    setError("");
    setWarning("");
    setValidationIssues([]);
    setPendingValidationFocus(null);
    setMessage(en ? "Current draft has been reset." : "현재 입력 초안을 초기화했습니다.");
    updateSessionIdInUrl(0);
  }

  function applyRowChange(varCode: string, updater: (rows: InputRow[]) => InputRow[]) {
    setInputs((current) => {
      const next = { ...current };
      findSummationGroup(varCode).forEach((code) => {
        next[code] = updater(current[code] || [DEFAULT_INPUT_ROW]);
      });
      return next;
    });
  }

  async function loadCategories(pagePayload?: EmissionManagementPagePayload | null) {
    const response = await fetchEmissionCategories("");
    const nextCategories = mergeCategoriesWithDefinitionScopes(
      response.items || [],
      ((pagePayload?.definitionScopeRows || []) as Array<Record<string, unknown>>)
    );
    setCategories(nextCategories);
    if (!selectedCategoryId && nextCategories.length === 1) {
      const nextCategory = nextCategories[0];
      const nextCategoryId = numberOf(nextCategory.categoryId);
      if (nextCategoryId > 0) {
        await handleCategoryChange(nextCategoryId, nextCategories);
      }
    }
  }

  async function reloadManagementPage() {
    const pageResponse = await fetchEmissionManagementPage().catch(() => null);
    setPage(pageResponse);
    await loadCategories(pageResponse);
    return pageResponse;
  }

  async function loadDefinitions(categoryId: number, tier: number, existingValues?: Array<Record<string, unknown>>, existingResult?: Record<string, unknown> | null) {
    setDefinitionLoading(true);
    try {
      const response = await fetchEmissionVariableDefinitions(categoryId, tier);
      const mergedVariables = mergeDefinitionVariableOverrides(response.variables || [], selectedCategory, tier);
      const nextGuide = buildTierGuide(mergedVariables, response.formulaSummary, response.formulaDisplay);
      const nextVariables = nextGuide.variables;
      setVariables(nextVariables);
      setFactors(response.factors || []);
      setFormulaSummary(nextGuide.formulaSummary);
      setInputs(existingValues ? hydrateInputs(nextVariables, existingValues) : buildEmptyInputs(nextVariables));
      setCalculationResult(existingResult || null);
    } finally {
      setDefinitionLoading(false);
    }
  }

  async function loadTierGuides(categoryId: number, tierItems: EmissionTierItem[], categoryOverride?: EmissionCategoryItem | null) {
    if (categoryId <= 0 || tierItems.length === 0) {
      setTierGuideMap({});
      return;
    }
    setTierGuideLoading(true);
    try {
      const supportedTierItems = tierItems.filter((tierItem) => Boolean(tierItem.runtimeSupported ?? true));
      const results = await Promise.allSettled(
        supportedTierItems.map(async (tierItem) => {
          const tierNumber = numberOf(tierItem.tier);
          const response = await fetchEmissionVariableDefinitions(categoryId, tierNumber);
          const mergedVariables = mergeDefinitionVariableOverrides(response.variables || [], categoryOverride || selectedCategory, tierNumber);
          return {
            tier: tierNumber,
            guide: buildTierGuide(mergedVariables, response.formulaSummary, response.formulaDisplay)
          };
        })
      );
      const nextGuideMap: Record<number, TierGuide> = {};
      results.forEach((result) => {
        if (result.status !== "fulfilled") {
          return;
        }
        nextGuideMap[result.value.tier] = result.value.guide;
      });
      setTierGuideMap(nextGuideMap);
    } finally {
      setTierGuideLoading(false);
    }
  }

  async function handleCategoryChange(categoryId: number, sourceCategories?: EmissionCategoryItem[]) {
    setSelectedCategoryId(categoryId);
    resetSelectionState();
    setTierGuideMap({});
    setWarning("");
    const nextCategory = findCategoryById(sourceCategories || categories, categoryId);
    const nextClassificationMeta = classificationMetaOf(nextCategory, classificationCatalogRows);
    setSelectedCategory(nextCategory);
    setSelectedMajorKey(nextClassificationMeta.majorCode);
    setSelectedMiddleCode(nextClassificationMeta.middleCode);
    if (categoryId <= 0) {
      setTiers([]);
      return;
    }
    if (Boolean(nextCategory?.virtualCategory)) {
      const nextTiers = tierItemsForDefinitionScope(stringOf(nextCategory?.subCode));
      setTiers(nextTiers);
      setWarning(en
        ? "This category exists only in published definition studio scopes. Runtime input/calculation stays blocked until DB metadata and calculator support are added."
        : "이 분류는 현재 publish 된 definition studio 범위에만 존재합니다. DB 메타데이터와 계산기 지원이 추가되기 전까지는 런타임 입력/계산이 막혀 있습니다.");
      setTierGuideMap({});
      return;
    }
    const response = await fetchEmissionTiers(categoryId);
    const resolvedCategory = (response.category as EmissionCategoryItem) || nextCategory;
    setSelectedCategory(resolvedCategory);
    const nextTiers = tierItemsForDefinitionScope(
      stringOf(resolvedCategory?.subCode),
      [
        ...((response.tiers || []) as EmissionTierItem[]).map((tier) => ({ ...tier, runtimeSupported: true })),
        ...((response.unsupportedTiers || []) as EmissionTierItem[]).map((tier) => ({ ...tier, runtimeSupported: false }))
      ]
    );
    setTiers(nextTiers);
    setWarning(stringOf(response.warning));
    await loadTierGuides(categoryId, nextTiers, resolvedCategory);
  }

  async function handleTierChange(tier: number) {
    setSelectedTier(tier);
    resetSelectionState();
    setSelectedTier(tier);
  }

  async function restoreSession(targetSessionId: number) {
    if (targetSessionId <= 0) {
      return;
    }
    const response = await fetchEmissionInputSession(targetSessionId);
    const session = (response.session || {}) as Record<string, unknown>;
    const existingValues = (response.values || []) as Array<Record<string, unknown>>;
    const existingResult = (response.result || null) as Record<string, unknown> | null;
    const categoryId = numberOf(session.categoryId);
    const tier = numberOf(session.tier);
    setSessionId(targetSessionId);
    setWizardStep(2);
    updateSessionIdInUrl(targetSessionId);
    setSelectedCategoryId(categoryId);
    setSelectedTier(tier);
    const tiersResponse = await fetchEmissionTiers(categoryId);
    const restoredCategory = (tiersResponse.category as EmissionCategoryItem) || null;
    const restoredClassificationMeta = classificationMetaOf(restoredCategory, classificationCatalogRows);
    setSelectedCategory(restoredCategory);
    setSelectedMajorKey(restoredClassificationMeta.majorCode);
    setSelectedMiddleCode(restoredClassificationMeta.middleCode);
    setTiers(tierItemsForDefinitionScope(
      stringOf(restoredCategory?.subCode),
      [
        ...((tiersResponse.tiers || []) as EmissionTierItem[]).map((item) => ({ ...item, runtimeSupported: true })),
        ...((tiersResponse.unsupportedTiers || []) as EmissionTierItem[]).map((item) => ({ ...item, runtimeSupported: false }))
      ]
    ));
    setWarning(stringOf(tiersResponse.warning));
    await loadDefinitions(categoryId, tier, existingValues, existingResult);
  }

  async function proceedToInputStep() {
    if (selectedCategoryId === 0) {
      setError(en ? "Select major, middle, and small classification first." : "대분류, 중분류, 소분류를 먼저 선택하세요.");
      return;
    }
    if (selectedTier <= 0) {
      setError(en ? "Select a tier first." : "Tier를 먼저 선택하세요.");
      return;
    }
    if (!Boolean(selectedTierItem?.runtimeSupported ?? true)) {
      setError(en
        ? "The selected tier is published in definition studio, but management cannot open it yet because runtime support is still missing."
        : "선택한 Tier는 definition studio에는 publish 되어 있지만, management 런타임 지원이 없어 아직 열 수 없습니다.");
      return;
    }
    setError("");
    setWarning("");
    setMessage("");
    await loadDefinitions(selectedCategoryId, selectedTier);
    setWizardStep(2);
  }

  async function handleMaterializeDefinitionScope(draftId: string) {
    if (!draftId) {
      return;
    }
    setMaterializingDraftId(draftId);
    setError("");
    try {
      const response = await materializeEmissionDefinitionScope(draftId);
      setMessage(stringOf(response.message) || (en ? "Definition scope materialized." : "정의 범위를 반영했습니다."));
      await reloadManagementPage();
      if (stringOf(selectedCategory?.subCode) && selectedTier > 0) {
        await loadSelectedScopeStatus(stringOf(selectedCategory?.subCode), selectedTier);
      }
      setSelectedScopePrecheck(null);
    } catch (materializeError) {
      setError(materializeError instanceof Error
        ? materializeError.message
        : (en ? "Failed to materialize the definition scope." : "정의 범위 반영에 실패했습니다."));
    } finally {
      setMaterializingDraftId("");
    }
  }

  async function loadSelectedScopeStatus(categoryCode: string, tier: number) {
    if (!categoryCode || tier <= 0) {
      setSelectedScopeStatus(null);
      return;
    }
    setScopeStatusLoading(true);
    try {
      const response = await fetchEmissionScopeStatus(categoryCode, tier);
      setSelectedScopeStatus(response);
    } catch (scopeStatusError) {
      setSelectedScopeStatus(null);
      setError(scopeStatusError instanceof Error
        ? scopeStatusError.message
        : (en ? "Failed to load the scope status." : "선택 scope 상태를 불러오지 못했습니다."));
    } finally {
      setScopeStatusLoading(false);
    }
  }

  async function handlePrecheckDefinitionScope(draftId: string) {
    if (!draftId) {
      return;
    }
    setPrecheckingDraftId(draftId);
    setError("");
    try {
      const response = await precheckEmissionDefinitionScope(draftId);
      setSelectedScopePrecheck(response);
      setMessage(stringOf(response.displayStatusDescription)
        || (en ? "Definition scope precheck completed." : "정의 범위 사전 점검을 완료했습니다."));
    } catch (precheckError) {
      setError(precheckError instanceof Error
        ? precheckError.message
        : (en ? "Failed to precheck the definition scope." : "정의 범위 사전 점검에 실패했습니다."));
    } finally {
      setPrecheckingDraftId("");
    }
  }

  async function focusDefinitionScope(row: Record<string, unknown>) {
    const categoryCode = stringOf(row.categoryCode);
    const tierNumber = numberOf(row.tier);
    if (!categoryCode || tierNumber <= 0) {
      return;
    }
    const matchedCategory = findCategoryByCode(categories, categoryCode);
    if (!matchedCategory) {
      setError(en ? "Unable to find the matching category for this scope." : "이 scope와 일치하는 카테고리를 찾지 못했습니다.");
      return;
    }
    const categoryId = numberOf(matchedCategory.categoryId);
    if (categoryId === 0) {
      setError(en ? "The matching category does not expose a valid selection id." : "일치하는 카테고리에 유효한 선택 id가 없습니다.");
      return;
    }
    setError("");
    setMessage("");
    await handleCategoryChange(categoryId, categories);
    setSelectedTier(tierNumber);
    if (stringOf(row.draftId)) {
      setAppliedDefinitionDraftId(stringOf(row.draftId));
    }
  }

  function updateInput(varCode: string, rowIndex: number, value: string) {
    if (validationIssues.length > 0 || warning) {
      setWarning("");
      setValidationIssues([]);
      setPendingValidationFocus(null);
    }
    setInputs((current) => {
      const rows = (current[varCode] || []).slice();
      if (!rows[rowIndex]) {
        rows[rowIndex] = { lineNo: rowIndex + 1, value: "" };
      }
      rows[rowIndex] = { ...rows[rowIndex], value };
      return { ...current, [varCode]: rows };
    });
  }

  function addInputRow(varCode: string) {
    if (validationIssues.length > 0 || warning) {
      setWarning("");
      setValidationIssues([]);
      setPendingValidationFocus(null);
    }
    applyRowChange(varCode, (rows) => syncLineNumbers([...rows, { lineNo: rows.length + 1, value: "" }]));
  }

  function removeInputRow(varCode: string, rowIndex: number) {
    if (validationIssues.length > 0 || warning) {
      setWarning("");
      setValidationIssues([]);
      setPendingValidationFocus(null);
    }
    applyRowChange(varCode, (rows) => alignedRowsForRemoval(rows, rowIndex));
  }

  function serializeInputs() {
    return variables.reduce<EmissionInputValuePayload[]>((collected, variable) => {
      const code = stringOf(variable.varCode);
      if (isDerivedCarbonateFactorVariable(selectedCategory, selectedTier, variable)) {
        return collected;
      }
      const inputType = stringOf(variable.inputType).toUpperCase();
      (inputs[code] || []).forEach((row) => {
        if (isConditionalFieldDisabled(code, row.lineNo - 1)) {
          return;
        }
        const trimmed = row.value.trim();
        if (!trimmed) {
          return;
        }
        if (inputType === "NUMBER") {
          const valueNum = Number(trimmed);
          if (!Number.isFinite(valueNum)) {
            return;
          }
          collected.push({ varCode: code, lineNo: row.lineNo, valueNum, valueText: "" });
          return;
        }
        collected.push({ varCode: code, lineNo: row.lineNo, valueNum: null, valueText: trimmed });
      });
      return collected;
    }, []);
  }

  function derivedFactorValue(varCode: string, rowIndex: number) {
    const normalizedCode = stringOf(varCode).toUpperCase();
    if (normalizedCode === "EFI") {
      return carbonateFactorOf(inputs.CARBONATE_TYPE?.[rowIndex]?.value || "");
    }
    if (normalizedCode === "EFK") {
      return carbonateFactorOf(inputs.RAW_MATERIAL_CARBONATE_TYPE?.[rowIndex]?.value || "");
    }
    return "";
  }

  function filledLineNumbers(varCode: string) {
    return new Set(
      (inputs[varCode] || [])
        .filter((row) => row.value.trim() !== "")
        .map((row) => row.lineNo)
    );
  }

  function collectMissingRequiredInputIssues() {
    const issues: ValidationIssue[] = [];
    const seenRepeatGroups = new Set<string>();

    for (const variable of visibleVariables) {
      if (!requiresDirectInput(variable) || canOmitDirectInputWarning(variable)) {
        continue;
      }

      const code = variableCodeOf(variable);
      if (isRepeatableVariable(variable)) {
        const group = findSummationGroup(code);
        const groupKey = group.join("|");
        if (seenRepeatGroups.has(groupKey)) {
          continue;
        }
        seenRepeatGroups.add(groupKey);

        const populatedLines = new Set<number>();
        group.forEach((groupCode) => {
          (inputs[groupCode] || []).forEach((row, rowIndex) => {
            if (isConditionalFieldDisabled(groupCode, rowIndex)) {
              return;
            }
            if (row.value.trim() !== "") {
              populatedLines.add(row.lineNo);
            }
          });
        });

        if (populatedLines.size === 0) {
          const requiredGroupVariables = group
            .map((groupCode) => findVariableByCode(groupCode))
            .filter((item): item is EmissionVariableDefinition => Boolean(item))
            .filter((item) => requiresDirectInput(item));
          requiredGroupVariables.forEach((requiredVariable) => {
            const requiredCode = variableCodeOf(requiredVariable);
            if (isConditionalFieldDisabled(requiredCode, 0)) {
              return;
            }
            const section = sectionForVariableCode(requiredCode);
            issues.push({
              sectionId: section?.id || "default",
              sectionTitle: section?.title || (en ? "Variable Inputs" : "변수 입력"),
              lineNo: 1,
              inputCode: requiredCode,
              variableLabel: displayVariableName(selectedCategory, selectedTier, requiredVariable),
              formulaLabel: formulaCodeOf(requiredVariable) || requiredCode
            });
          });
          continue;
        }

        const requiredGroupVariables = group
          .map((groupCode) => findVariableByCode(groupCode))
          .filter((item): item is EmissionVariableDefinition => Boolean(item))
          .filter((item) => requiresDirectInput(item));

        for (const lineNo of Array.from(populatedLines).sort((a, b) => a - b)) {
          for (const requiredVariable of requiredGroupVariables) {
            const requiredCode = variableCodeOf(requiredVariable);
            const rowIndex = Math.max(0, lineNo - 1);
            if (isConditionalFieldDisabled(requiredCode, rowIndex)) {
              continue;
            }
            const value = inputs[requiredCode]?.[rowIndex]?.value?.trim() || "";
            if (value) {
              continue;
            }
            const section = sectionForVariableCode(requiredCode);
            issues.push({
              sectionId: section?.id || "default",
              sectionTitle: section?.title || (en ? "Variable Inputs" : "변수 입력"),
              lineNo,
              inputCode: requiredCode,
              variableLabel: displayVariableName(selectedCategory, selectedTier, requiredVariable),
              formulaLabel: formulaCodeOf(requiredVariable) || requiredCode
            });
          }
        }
        continue;
      }

      const rows = inputs[code] || [DEFAULT_INPUT_ROW];
      const hasValue = rows.some((row, rowIndex) => {
        if (isConditionalFieldDisabled(code, rowIndex)) {
          return true;
        }
        return row.value.trim() !== "";
      });

      if (!hasValue) {
        const section = sectionForVariableCode(code);
        issues.push({
          sectionId: section?.id || "default",
          sectionTitle: section?.title || (en ? "Variable Inputs" : "변수 입력"),
          lineNo: null,
          inputCode: code,
          variableLabel: displayVariableName(selectedCategory, selectedTier, variable),
          formulaLabel: formulaCodeOf(variable) || code
        });
      }
    }

    return issues;
  }

  function focusValidationIssue(issue: ValidationIssue | null) {
    if (!issue) {
      return;
    }
    const nextIndex = variableSections.findIndex((section) => section.id === issue.sectionId);
    if (nextIndex >= 0) {
      setActiveFormulaStep(nextIndex);
    }
    setPendingValidationFocus(issue);
  }

  function hasValidationIssue(sectionId: string, code: string, lineNo?: number | null) {
    return validationIssues.some((issue) => {
      if (issue.sectionId !== sectionId) {
        return false;
      }
      if (stringOf(issue.inputCode).toUpperCase() !== stringOf(code).toUpperCase()) {
        return false;
      }
      if (lineNo == null) {
        return issue.lineNo == null;
      }
      return issue.lineNo === lineNo;
    });
  }

  function validationInputClass(sectionId: string, code: string, lineNo?: number | null) {
    return hasValidationIssue(sectionId, code, lineNo)
      ? "border-rose-500 bg-rose-50 shadow-[0_0_0_1px_var(--kr-gov-red,#dc2626)]"
      : "";
  }

  function validationMessage(sectionId: string, code: string, lineNo?: number | null) {
    if (!hasValidationIssue(sectionId, code, lineNo)) {
      return "";
    }
    return en ? "This required value is missing." : "필수 입력값이 비어 있습니다.";
  }

  useEffect(() => {
    if (!pendingValidationFocus) {
      return;
    }
    const activeSection = variableSections[activeFormulaStep];
    if (!activeSection || activeSection.id !== pendingValidationFocus.sectionId) {
      return;
    }
    const timer = window.setTimeout(() => {
      document.getElementById(`formula-section-${pendingValidationFocus.sectionId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      const input = document.getElementById(
        validationInputId(
          pendingValidationFocus.sectionId,
          pendingValidationFocus.inputCode,
          pendingValidationFocus.lineNo
        )
      ) as HTMLInputElement | HTMLSelectElement | null;
      if (input) {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        input.focus();
      }
      setPendingValidationFocus(null);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeFormulaStep, pendingValidationFocus, variableSections]);

  function missingRequiredInputWarning() {
    const issues = collectMissingRequiredInputIssues();
    if (issues.length === 0) {
      return { message: "", issues: [] as ValidationIssue[] };
    }
    const firstIssue = issues[0];
    const message = en
      ? `${issues.length} required input(s) are missing. Review the list below before saving or calculating.`
      : `필수 입력 ${issues.length}건이 비어 있습니다. 아래 목록을 확인한 뒤 저장 또는 계산을 진행하세요.`;
    return { message, issues, firstIssue };
  }

  function fallbackInputDescription(
    variable: EmissionVariableDefinition,
    categoryOverride: EmissionCategoryItem | null = selectedCategory,
    tierOverride = selectedTier
  ) {
    const draft = definitionDraftForPolicy(categoryOverride, tierOverride);
    const definitionFallbackCodes = codeList(draft?.fallbackCodes).map((item) => item.toUpperCase());
    if (definitionFallbackCodes.includes(stringOf(variable.varCode).toUpperCase())) {
      return stringOf(draft?.note)
        || (en
          ? "This variable is marked as fallback-capable by the applied definition draft."
          : "적용된 정의 초안에서 이 변수를 대체 허용 항목으로 지정했습니다.");
    }
    const categoryCode = stringOf(categoryOverride?.subCode).toUpperCase();
    const code = stringOf(variable.varCode).toUpperCase();
    if (categoryCode === "CEMENT" && tierOverride === 1 && code === "EFCLC") {
      return en
        ? "If EFclc is blank, the calculator uses the stored coefficient first and then the documented default."
        : "EFclc가 비어 있으면 저장 계수를 먼저 적용하고, 없으면 문서 기본값을 사용합니다.";
    }
    if (categoryCode === "CEMENT" && tierOverride === 2 && (code === "EFC" || code === "EFCL")) {
      return en
        ? `${code} uses the stored coefficient first and then the documented default when direct input is blank.`
        : `${code}는 직접 입력이 비어 있으면 저장 계수를 먼저 적용하고, 없으면 문서 기본값을 사용합니다.`;
    }
    if (categoryCode === "CEMENT" && tierOverride === 2 && code === "CFCKD") {
      return en
        ? "CFckd is derived from Md, Cd, Fd, Mcl, EFc, and EFcl when available. If not, it switches to the stored coefficient or the default 1.02."
        : "CFckd는 Md, Cd, Fd, Mcl, EFc, EFcl이 있으면 유도식으로 계산하고, 부족하면 저장 계수 또는 기본값 1.02를 사용합니다.";
    }
    if (categoryCode === "CEMENT" && tierOverride === 3 && code === "EFD") {
      return en
        ? "EFd applies direct input first, then carbonate-type mapping, then the stored coefficient, and finally the documented default."
        : "EFd는 직접 입력을 우선 적용하고, 없으면 탄산염 유형 매핑, 저장 계수, 문서 기본값 순으로 적용합니다.";
    }
    if (categoryCode === "LIME" && tierOverride === 1 && code === "LIME_TYPE") {
      return en
        ? "If the lime type is blank, EF_lime,i switches to the stored coefficient or the documented default."
        : "석회 유형이 비어 있으면 EF석회,i는 저장 계수 또는 문서 기본값으로 전환됩니다.";
    }
    if (categoryCode === "LIME" && tierOverride === 2 && code === "LIME_TYPE") {
      return en
        ? "If the lime type is blank, EF_lime,i switches to the stored coefficient or the documented default."
        : "석회 유형이 비어 있으면 EF석회,i는 저장 계수 또는 문서 기본값으로 전환됩니다.";
    }
    if (categoryCode === "LIME" && tierOverride === 2 && (code === "CAO_CONTENT" || code === "CAO_MGO_CONTENT")) {
      return en
        ? "If the composition value is blank, the documented default content for the selected lime type is used."
        : "조성값이 비어 있으면 선택한 석회 유형의 문서 기본 함유량을 사용합니다.";
    }
    if (categoryCode === "LIME" && tierOverride === 2 && ["MD", "CD", "FD"].includes(code)) {
      return en
        ? "If Md, Cd, Fd are incomplete, CF_lkd,i switches to the stored coefficient or the default 1.02."
        : "Md, Cd, Fd가 완전하지 않으면 CF_lkd,i는 저장 계수 또는 기본값 1.02로 전환됩니다.";
    }
    if (categoryCode === "LIME" && tierOverride === 2 && code === "HYDRATED_LIME_PRODUCTION_YN") {
      return en
        ? "If the hydration flag is blank, C_h,i falls back to rule-based handling: 1.00 by default, or a derived/default hydration correction when x and y are provided."
        : "수화 여부가 비어 있으면 C_h,i는 규칙 기반으로 처리되며, 기본적으로 1.00을 적용하고 x, y가 있으면 유도식 또는 기본 보정값을 사용합니다.";
    }
    if (categoryCode === "LIME" && tierOverride === 2 && (code === "X" || code === "Y")) {
      return en
        ? "If x or y is blank, C_h,i uses the documented hydration default when hydrated-lime production is selected."
        : "x 또는 y가 비어 있으면 수화석회 생산 선택 시 C_h,i는 문서 기본 보정값을 사용합니다.";
    }
    if (categoryCode === "LIME" && tierOverride === 3 && code === "EFD") {
      return en
        ? "EFd applies direct input first, then carbonate-type mapping, then the stored coefficient, and finally the documented default."
        : "EFd는 직접 입력을 우선 적용하고, 없으면 탄산염 유형 매핑, 저장 계수, 문서 기본값 순으로 적용합니다.";
    }
    return "";
  }

  function supportsFallbackInput(
    variable: EmissionVariableDefinition,
    categoryOverride: EmissionCategoryItem | null = selectedCategory,
    tierOverride = selectedTier
  ) {
    const draftTone = definitionPolicyTone(variable, categoryOverride, tierOverride);
    if (draftTone === "amber") {
      return true;
    }
    return Boolean(fallbackInputDescription(variable, categoryOverride, tierOverride));
  }

  function requiresDirectInput(
    variable: EmissionVariableDefinition,
    categoryOverride: EmissionCategoryItem | null = selectedCategory,
    tierOverride = selectedTier
  ) {
    const draftTone = definitionPolicyTone(variable, categoryOverride, tierOverride);
    if (draftTone === "red") {
      return true;
    }
    if (draftTone === "amber" || draftTone === "sky" || draftTone === "rose") {
      return false;
    }
    return isRequiredVariable(variable);
  }

  function canOmitDirectInputWarning(
    variable: EmissionVariableDefinition,
    categoryOverride: EmissionCategoryItem | null = selectedCategory,
    tierOverride = selectedTier
  ) {
    const draftTone = definitionPolicyTone(variable, categoryOverride, tierOverride);
    if (draftTone === "amber" || draftTone === "sky") {
      return true;
    }
    if (stringOf(variable.supplementalYn).toUpperCase() === "Y") {
      return true;
    }
    return supportsFallbackInput(variable, categoryOverride, tierOverride);
  }

  function inputPolicyMeta(
    variable: EmissionVariableDefinition,
    categoryOverride: EmissionCategoryItem | null = selectedCategory,
    tierOverride = selectedTier
  ) {
    const draftTone = definitionPolicyTone(variable, categoryOverride, tierOverride);
    const draft = definitionDraftForPolicy(categoryOverride, tierOverride);
    if (draftTone === "rose") {
      return {
        badge: en ? "Auto-calculated" : "자동 계산",
        tone: "rose" as const,
        description: stringOf(draft?.note) || (en ? "This term is marked as auto-calculated by the applied definition draft." : "적용된 정의 초안에서 이 항목을 자동 계산 대상으로 지정했습니다.")
      };
    }
    if (draftTone === "amber") {
      return {
        badge: en ? "Fallback defined" : "대체값 정의됨",
        tone: "amber" as const,
        description: fallbackInputDescription(variable, categoryOverride, tierOverride)
      };
    }
    if (draftTone === "sky") {
      return {
        badge: en ? "Supplemental input" : "보조 입력",
        tone: "sky" as const,
        description: stringOf(draft?.note) || (en ? "This value is supplemental according to the applied definition draft." : "적용된 정의 초안 기준 보조 입력 항목입니다.")
      };
    }
    if (draftTone === "red") {
      return {
        badge: en ? "Direct input required" : "직접 입력 필수",
        tone: "red" as const,
        description: stringOf(draft?.note) || (en ? "This value is explicitly required by the applied definition draft." : "적용된 정의 초안에서 이 값을 직접 입력 필수로 지정했습니다.")
      };
    }
    if (isDerivedCarbonateFactorVariable(categoryOverride, tierOverride, variable)) {
      return {
        badge: en ? "Auto-calculated" : "자동 계산",
        tone: "rose" as const,
        description: en ? "This term is derived from the mapped carbonate type and does not accept direct input." : "이 항목은 탄산염 유형 매핑으로 계산되며 직접 입력을 받지 않습니다."
      };
    }
    if (supportsFallbackInput(variable, categoryOverride, tierOverride)) {
      return {
        badge: en ? "Fallback defined" : "대체값 정의됨",
        tone: "amber" as const,
        description: fallbackInputDescription(variable, categoryOverride, tierOverride)
      };
    }
    if (stringOf(variable.supplementalYn).toUpperCase() === "Y") {
      return {
        badge: en ? "Supplemental input" : "보조 입력",
        tone: "sky" as const,
        description: en ? "This value improves a derived term when provided, but the calculator can continue without direct entry." : "이 값이 있으면 유도 항 계산이 정교해지지만, 직접 입력이 없어도 계산은 계속할 수 있습니다."
      };
    }
    if (requiresDirectInput(variable, categoryOverride, tierOverride)) {
      return {
        badge: en ? "Direct input required" : "직접 입력 필수",
        tone: "red" as const,
        description: en ? "No replacement path is defined. Enter this value before saving or calculating." : "대체 경로가 정의되지 않았습니다. 저장 또는 계산 전에 반드시 입력해야 합니다."
      };
    }
    return {
      badge: en ? "Optional" : "선택 입력",
      tone: "slate" as const,
      description: en ? "This value is optional for the current formula flow." : "현재 계산 흐름에서는 선택 입력 항목입니다."
    };
  }

  function policyBadgeClass(tone: "amber" | "red" | "rose" | "sky" | "slate") {
    if (tone === "amber") {
      return "bg-amber-100 text-amber-700";
    }
    if (tone === "red") {
      return "bg-rose-100 text-rose-700";
    }
    if (tone === "rose") {
      return "bg-rose-100 text-rose-700";
    }
    if (tone === "sky") {
      return "bg-sky-100 text-sky-700";
    }
    return "bg-slate-100 text-slate-700";
  }

  function codeList(value: unknown) {
    if (Array.isArray(value)) {
      return (value as unknown[]).map((item) => String(item || "")).filter(Boolean);
    }
    return stringOf(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function helpIdForElement(row: Record<string, unknown>) {
    const elementKey = stringOf(row.elementKey);
    const mapping: Record<string, string> = {
      EMISSION_SUMMARY_METRICS: "emission-management-summary",
      EMISSION_DEFINITION_LINK: "emission-management-definition-link",
      EMISSION_SCOPE_SELECTION: "emission-management-scope",
      EMISSION_MAJOR_FILTER: "emission-management-scope",
      EMISSION_SUBCATEGORY_TIER: "emission-management-scope",
      EMISSION_TIER_GUIDE: "emission-management-scope",
      EMISSION_VARIABLE_CATALOG: "emission-management-definition",
      EMISSION_FACTOR_REFERENCE: "emission-management-definition",
      EMISSION_INPUT_WORKSPACE: "emission-management-input",
      EMISSION_FORMULA_FLOW: "emission-management-input",
      EMISSION_ACTION_BAR: "emission-management-input",
      EMISSION_RESULT_PANEL: "emission-management-result",
      EMISSION_CALC_LOG: "emission-management-result",
      EMISSION_APPLIED_FACTORS: "emission-management-result",
      EMISSION_VALIDATION_NOTICE: "emission-management-input"
    };
    return mapping[elementKey] || "";
  }

  function focusRegisteredElement(row: Record<string, unknown>) {
    const helpId = helpIdForElement(row);
    if (!helpId) {
      return;
    }
    const element = document.querySelector(`[data-help-id="${helpId}"]`) as HTMLElement | null;
    if (!element) {
      return;
    }
    setHighlightedHelpId(helpId);
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      setHighlightedHelpId((current) => current === helpId ? "" : current);
    }, 2200);
  }

  function elementKeysForHelpId(helpId: string) {
    const mapping: Record<string, string[]> = {
      "emission-management-summary": ["EMISSION_SUMMARY_METRICS"],
      "emission-management-definition-link": ["EMISSION_DEFINITION_LINK"],
      "emission-management-formula-reference": ["EMISSION_MGMT_FACTOR_REFERENCE"],
      "emission-management-scope": ["EMISSION_SCOPE_SELECTION", "EMISSION_MAJOR_FILTER", "EMISSION_SUBCATEGORY_TIER", "EMISSION_MGMT_TIER_GUIDE"],
      "emission-management-definition": ["EMISSION_MGMT_VARIABLE_CATALOG", "EMISSION_MGMT_FACTOR_REFERENCE"],
      "emission-management-input": ["EMISSION_MGMT_INPUT_WORKSPACE", "EMISSION_MGMT_FORMULA_FLOW", "EMISSION_MGMT_ACTION_BAR", "EMISSION_MGMT_VALIDATION_NOTICE"],
      "emission-management-result": ["EMISSION_MGMT_RESULT_PANEL", "EMISSION_MGMT_CALC_LOG", "EMISSION_MGMT_APPLIED_FACTORS"]
    };
    return mapping[helpId] || [];
  }

  function openElementDefinitionByHelpId(helpId: string) {
    const candidateKeys = elementKeysForHelpId(helpId);
    if (candidateKeys.length === 0) {
      return;
    }
    const matched = elementRegistryRows.find((row) => candidateKeys.includes(stringOf(row.elementKey)));
    if (!matched) {
      return;
    }
    applyElementDefinition(matched);
    setHighlightedHelpId(helpId);
    document.querySelector(`[data-help-id="emission-management-element-registry"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    window.setTimeout(() => {
      setHighlightedHelpId((current) => current === helpId ? "" : current);
    }, 2200);
  }

  function hasInputValue(variable: EmissionVariableDefinition, rowIndex = 0) {
    const code = variableCodeOf(variable);
    if (isConditionalFieldDisabled(code, rowIndex)) {
      return true;
    }
    if (isDerivedCarbonateFactorVariable(selectedCategory, selectedTier, variable)) {
      return true;
    }
    return (inputs[code]?.[rowIndex]?.value || "").trim() !== "";
  }

  function shouldShowDirectInputWarning(variable: EmissionVariableDefinition, rowIndex = 0) {
    if (!requiresDirectInput(variable)) {
      return false;
    }
    if (canOmitDirectInputWarning(variable)) {
      return false;
    }
    return !hasInputValue(variable, rowIndex);
  }

  function tierGuideFallbackSummary(category: EmissionCategoryItem | null, tierNumber: number, guideVariables: EmissionVariableDefinition[]) {
    const categoryCode = stringOf(category?.subCode).toUpperCase();
    if (categoryCode === "CEMENT" && tierNumber === 1) {
      return en
        ? "If EFclc is omitted, the documented coefficient flow uses a stored value and then the default."
        : "EFclc를 비워두면 문서 기준 흐름에 따라 저장 계수 후 기본 계수를 사용합니다.";
    }
    if (isCementTier2Scope(category, tierNumber)) {
      return en
        ? "EFc, EFcl, and CFckd use stored or default coefficients when direct or derived values are not available."
        : "EFc, EFcl, CFckd는 직접값이나 유도값이 없으면 저장 계수 또는 문서 기본 계수를 사용합니다.";
    }
    if (isLimeTier2Scope(category, tierNumber)) {
      return en
        ? "Composition and hydration inputs can switch EF_lime,i or C_h,i to documented default handling."
        : "조성값과 수화 입력이 없으면 EF석회,i 또는 C_h,i가 문서 기준 기본값 흐름으로 전환될 수 있습니다.";
    }
    if (categoryCode === "CEMENT" && tierNumber === 3) {
      return en
        ? "Carbonate-type selections map factors from the document table, and EFd can still fall back to stored/default handling."
        : "탄산염 유형 선택으로 문서 표 계수를 매핑하고, EFd는 저장/기본 계수 흐름도 가질 수 있습니다.";
    }
    if (categoryCode === "LIME" && tierNumber === 3) {
      return en
        ? "Carbonate-type selections map factors from the document table, and EFd can still fall back to stored/default handling."
        : "탄산염 유형 선택으로 문서 표 계수를 매핑하고, EFd는 저장/기본 계수 흐름도 가질 수 있습니다.";
    }
    const fallbackVariables = guideVariables.filter((variable) => supportsFallbackInput(variable, category, tierNumber));
    if (fallbackVariables.length === 0) {
      return "";
    }
    return en
      ? "Some variables in this tier can fall back to stored coefficients or documented defaults."
      : "이 Tier의 일부 변수는 저장 계수 또는 문서 기본값으로 대체될 수 있습니다.";
  }

  function repeatGroupValidationWarning() {
    for (const group of summationGroups) {
      const groupVariables = group
        .map((code) => findVariableByCode(code))
        .filter((variable): variable is EmissionVariableDefinition => Boolean(variable));
      if (groupVariables.length <= 1) {
        continue;
      }

      const primaryCodes = new Set<string>([group[0] || ""]);
      groupVariables.forEach((variable) => {
        if (requiresDirectInput(variable)) {
          primaryCodes.add(variableCodeOf(variable));
        }
      });

      const normalizedPrimaryCodes = Array.from(primaryCodes).filter(Boolean);
      const referenceCodes = normalizedPrimaryCodes.length > 0 ? normalizedPrimaryCodes : group;
      const filledSets = referenceCodes
        .map((code) => ({
          code,
          lines: filledLineNumbers(code)
        }))
        .filter((item) => item.lines.size > 0);

      if (filledSets.length <= 1) {
        continue;
      }

      const [reference, ...rest] = filledSets;
      const aligned = rest.every((item) =>
        item.lines.size === reference.lines.size &&
        Array.from(item.lines).every((lineNo) => reference.lines.has(lineNo))
      );
      if (aligned) {
        continue;
      }

      const labels = referenceCodes.map((code) => {
        const variable = findVariableByCode(code);
        return variable
          ? `${displayVariableName(selectedCategory, selectedTier, variable)} (${formulaCodeOf(variable) || code})`
          : code;
      });

      return en
        ? `This summation group requires matching row counts and line numbers: ${labels.join(", ")}. Align the repeated rows before saving or calculating.`
        : `이 Summation 묶음은 입력 라인 수와 라인 번호가 서로 같아야 합니다: ${labels.join(", ")}. 저장 또는 계산 전에 반복 행을 맞춰주세요.`;
    }
    return "";
  }

  const supplementCount = calculationResult
    ? arrayOf<Record<string, unknown>>(calculationResult.appliedFactors).filter((factor) => Boolean(factor.defaultApplied)).length
    : 0;

  function validateLineAlignment() {
    return repeatGroupValidationWarning();
  }

  async function handleSave() {
    if (!canExecuteSessionActions) {
      setError(en ? "Admin execution permission is required." : "관리자 실행 권한이 필요합니다.");
      return 0;
    }
    if (selectedCategoryId <= 0 || selectedTier <= 0) {
      setError(en ? "Select a category and tier first." : "카테고리와 Tier를 먼저 선택하세요.");
      return 0;
    }
    const lineAlignmentWarning = validateLineAlignment();
    if (lineAlignmentWarning) {
      setWarning(lineAlignmentWarning);
      setValidationIssues([]);
      setError("");
      setMessage("");
      return 0;
    }
    const requiredInputWarning = missingRequiredInputWarning();
    if (requiredInputWarning.message) {
      setWarning(requiredInputWarning.message);
      setValidationIssues(requiredInputWarning.issues);
      focusValidationIssue(requiredInputWarning.firstIssue || null);
      setError("");
      setMessage("");
      return 0;
    }
    setSaving(true);
    setError("");
    setWarning("");
    setValidationIssues([]);
    setMessage("");
    try {
      const response = await saveEmissionInputSession({
        categoryId: selectedCategoryId,
        tier: selectedTier,
        values: serializeInputs()
      });
      const nextSessionId = numberOf(response.sessionId);
      setSessionId(nextSessionId);
      updateSessionIdInUrl(nextSessionId);
      setMessage(en ? "Input session saved." : "입력 세션을 저장했습니다.");
      await restoreSession(nextSessionId);
      return nextSessionId;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : (en ? "Failed to save session." : "세션 저장에 실패했습니다."));
      return 0;
    } finally {
      setSaving(false);
    }
  }

  async function handleCalculate() {
    if (!canExecuteSessionActions) {
      setError(en ? "Admin execution permission is required." : "관리자 실행 권한이 필요합니다.");
      return;
    }
    if (surveyBootstrap.fromSurveyAdmin && factors.length === 0) {
      setError(en
        ? "No stored emission factor is available for this survey scope. Contact the administrator."
        : "이 설문 범위에 저장된 배출계수 값이 없습니다. 관리자에 문의하세요.");
      setWarning("");
      setValidationIssues([]);
      setMessage("");
      return;
    }
    const lineAlignmentWarning = validateLineAlignment();
    if (lineAlignmentWarning) {
      setWarning(lineAlignmentWarning);
      setValidationIssues([]);
      setError("");
      setMessage("");
      return;
    }
    const requiredInputWarning = missingRequiredInputWarning();
    if (requiredInputWarning.message) {
      setWarning(requiredInputWarning.message);
      setValidationIssues(requiredInputWarning.issues);
      focusValidationIssue(requiredInputWarning.firstIssue || null);
      setError("");
      setMessage("");
      return;
    }
    setCalculating(true);
    setError("");
    setWarning("");
    setValidationIssues([]);
    setMessage("");
    try {
      const targetSessionId = await handleSave();
      if (targetSessionId <= 0) {
        return;
      }
      const response = await calculateEmissionInputSession(targetSessionId);
      setCalculationResult(response);
      setMessage(en ? "Calculation completed." : "계산을 완료했습니다.");
      await restoreSession(targetSessionId);
    } catch (calculationError) {
      setError(calculationError instanceof Error ? calculationError.message : (en ? "Calculation failed." : "계산 실행에 실패했습니다."));
    } finally {
      setCalculating(false);
    }
  }

  async function handleSaveElementDefinition() {
    setElementRegistrySaving(true);
    setError("");
    setMessage("");
    try {
      const response = await saveEmissionManagementElementDefinition({
        definitionId: stringOf(elementDefinitionDraft.definitionId) || undefined,
        elementKey: stringOf(elementDefinitionDraft.elementKey),
        elementName: stringOf(elementDefinitionDraft.elementName),
        elementType: stringOf(elementDefinitionDraft.elementType),
        layoutZone: stringOf(elementDefinitionDraft.layoutZone),
        componentType: stringOf(elementDefinitionDraft.componentType),
        bindingTarget: stringOf(elementDefinitionDraft.bindingTarget),
        defaultLabel: stringOf(elementDefinitionDraft.defaultLabel),
        defaultLabelEn: stringOf(elementDefinitionDraft.defaultLabelEn),
        description: stringOf(elementDefinitionDraft.description),
        variableScope: stringOf(elementDefinitionDraft.variableScope),
        policyNote: stringOf(elementDefinitionDraft.policyNote),
        directRequiredCodes: stringOf(elementDefinitionDraft.directRequiredCodes).split(",").map((item) => item.trim()).filter(Boolean),
        fallbackCodes: stringOf(elementDefinitionDraft.fallbackCodes).split(",").map((item) => item.trim()).filter(Boolean),
        autoCalculatedCodes: stringOf(elementDefinitionDraft.autoCalculatedCodes).split(",").map((item) => item.trim()).filter(Boolean),
        useYn: stringOf(elementDefinitionDraft.useYn) || "Y",
        tags: stringOf(elementDefinitionDraft.tags)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      });
      const typed = response as EmissionManagementElementSaveResponse;
      setElementRegistryRows((typed.elementRegistryRows || []) as Array<Record<string, unknown>>);
      setMessage(stringOf(typed.message) || (en ? "Element definition saved." : "요소 정의를 저장했습니다."));
      applyElementDefinition((typed.selectedElementDefinition || null) as Record<string, unknown> | null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : (en ? "Failed to save element definition." : "요소 정의 저장에 실패했습니다."));
    } finally {
      setElementRegistrySaving(false);
    }
  }

  function handleNewElementDefinition() {
    applyElementDefinition({
      definitionId: "",
      elementKey: "EMISSION_NEW_ELEMENT",
      elementName: en ? "New element" : "신규 요소",
      elementType: "section",
      layoutZone: "workspace",
      componentType: "DiagnosticCard",
      bindingTarget: "",
      defaultLabel: en ? "New element" : "신규 요소",
      defaultLabelEn: "New element",
      description: en ? "Register a new emission-management screen element." : "배출 변수 관리 화면의 새 구성 요소를 등록합니다.",
      variableScope: "",
      policyNote: "",
      directRequiredCodes: [],
      fallbackCodes: [],
      autoCalculatedCodes: [],
      useYn: "Y",
      tags: ["emission-management"]
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [pageResponse, limeResponse] = await Promise.all([
          fetchEmissionManagementPage().catch(() => null),
          fetchEmissionLimeDefaultFactor().catch(() => null)
        ]);
        if (cancelled) {
          return;
        }
        setPage(pageResponse);
        setElementRegistryRows(((pageResponse?.elementRegistryRows || []) as Array<Record<string, unknown>>));
        applyElementDefinition(((pageResponse?.selectedElementDefinition || null) as Record<string, unknown> | null));
        setLimeDefaultFactor(limeResponse);
        await loadCategories(pageResponse);
        const initialSessionId = readSessionIdFromUrl();
        if (initialSessionId > 0) {
          await restoreSession(initialSessionId);
          return;
        }
        if (surveyBootstrap.categoryId > 0) {
          await handleCategoryChange(surveyBootstrap.categoryId);
          if (surveyBootstrap.tier > 0) {
            setSelectedTier(surveyBootstrap.tier);
            await loadDefinitions(surveyBootstrap.categoryId, surveyBootstrap.tier);
            setWizardStep(2);
            setMessage(en
              ? "Loaded the survey-linked calculation scope and stored factor set."
              : "설문 관리에서 전달된 계산 범위와 저장 배출계수를 불러왔습니다.");
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : (en ? "Failed to load the page." : "페이지를 불러오지 못했습니다."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [en]);

  useEffect(() => {
    if (!selectedElementDefinitionId && elementRegistryRows.length > 0 && !stringOf(elementDefinitionDraft.elementKey)) {
      applyElementDefinition(elementRegistryRows[0] || null);
    }
  }, [elementDefinitionDraft.elementKey, elementRegistryRows, selectedElementDefinitionId]);

  useEffect(() => {
    if (matchingDefinitionDrafts.length === 0) {
      setAppliedDefinitionDraftId("");
      return;
    }
    if (!matchingDefinitionDrafts.some((row) => stringOf(row.draftId) === appliedDefinitionDraftId)) {
      setAppliedDefinitionDraftId(stringOf(matchingDefinitionDrafts[0]?.draftId));
    }
  }, [appliedDefinitionDraftId, matchingDefinitionDrafts]);

  useEffect(() => {
    if (!stringOf(selectedCategory?.subCode) || selectedTier <= 0) {
      setSelectedScopeStatus(null);
      setSelectedScopePrecheck(null);
      return;
    }
    void loadSelectedScopeStatus(stringOf(selectedCategory?.subCode), selectedTier);
  }, [en, selectedCategory?.subCode, selectedTier]);

  useEffect(() => {
    logGovernanceScope("PAGE", "emission-management", {
      language: en ? "en" : "ko",
      categoryId: selectedCategoryId,
      tier: selectedTier,
      variableCount: visibleVariables.length,
      factorCount: factors.length,
      sessionId
    });
    logGovernanceScope("COMPONENT", "emission-management-input", {
      repeatableCount: visibleVariables.filter((item) => isRepeatableVariable(item)).length,
      savedValueCount: serializeInputs().length,
      hasResult: Boolean(calculationResult)
    });
  }, [calculationResult, en, factors.length, inputs, selectedCategory, selectedCategoryId, selectedTier, sessionId, variables, visibleVariables]);

  useEffect(() => {
    setActiveFormulaStep((current) => {
      if (variableSections.length === 0) {
        return 0;
      }
      return Math.min(current, variableSections.length - 1);
    });
  }, [variableSections.length]);

  useEffect(() => {
    setFocusedFormulaToken("");
    setHoveredFormulaToken("");
  }, [activeFormulaStep, selectedCategoryId, selectedTier]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Calculation & Certification" : "산정·인증" },
        { label: en ? "Emission Variable Management" : "배출 변수 관리" }
      ]}
      title={stringOf(en ? page?.pageTitleEn : page?.pageTitle) || (en ? "Emission Variable Management" : "배출 변수 관리")}
      subtitle={stringOf(en ? page?.pageDescriptionEn : page?.pageDescription) || (en ? "Operate category, tier, variable input sessions, and calculation execution from one admin console." : "카테고리, Tier, 변수 입력 세션 저장과 계산 실행을 하나의 관리자 콘솔에서 운영합니다.")}
    >
      <AdminWorkspacePageFrame>
        {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
        {warning ? (
          <PageStatusNotice tone="warning">
            <div className="space-y-3">
              <p>{warning}</p>
              {validationIssues.length > 0 ? (
                <div className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                    {en ? "Missing inputs" : "누락 입력 목록"}
                  </p>
                  <div className="mt-3 space-y-2">
                    {validationIssues.slice(0, 6).map((issue, index) => (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--kr-gov-radius)] border border-amber-100 bg-white px-3 py-2" key={`${issue.sectionId}-${issue.variableLabel}-${issue.lineNo ?? "single"}-${index}`}>
                        <p className="text-sm text-[var(--kr-gov-text-primary)]">
                          {issue.sectionTitle}
                          {issue.lineNo ? ` · ${en ? "Line" : "라인"} ${issue.lineNo}` : ""}
                          {` · ${issue.variableLabel} (${issue.formulaLabel})`}
                        </p>
                        <MemberButton
                          onClick={() => focusValidationIssue(issue)}
                          type="button"
                          variant="secondary"
                        >
                          {en ? "Move" : "이동"}
                        </MemberButton>
                      </div>
                    ))}
                    {validationIssues.length > 6 ? (
                      <p className="text-xs text-[var(--kr-gov-text-secondary)]">
                        {en ? `+ ${validationIssues.length - 6} more missing input(s)` : `누락 입력 ${validationIssues.length - 6}건이 더 있습니다.`}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </PageStatusNotice>
        ) : null}
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
        {wizardStep === 2 ? (
          <LookupContextStrip
            action={(
              <MemberButton
                disabled={saving || calculating}
                onClick={() => {
                  setWizardStep(1);
                }}
                type="button"
                variant="secondary"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>{en ? "Change selection" : "선택 변경"}</span>
              </MemberButton>
            )}
            label={en ? "Current selection" : "현재 선택 범위"}
            value={(
              <span className="font-semibold">
                {`${selectedClassificationMeta.pathLabel || (en ? "Not selected" : "미선택")} / ${selectedTier > 0 ? `Tier ${selectedTier}` : "-"}`}
              </span>
            )}
          />
        ) : null}

        <section className={`grid grid-cols-1 gap-4 xl:grid-cols-5 ${highlightedHelpId === "emission-management-summary" ? "rounded-[var(--kr-gov-radius)] ring-2 ring-[var(--kr-gov-blue)] ring-offset-4 ring-offset-white" : ""}`} data-help-id="emission-management-summary">
          <div className="xl:col-span-5 flex justify-end">
            <MemberButton onClick={() => openElementDefinitionByHelpId("emission-management-summary")} type="button" variant="secondary">
              {en ? "Open element definition" : "요소 정의 열기"}
            </MemberButton>
          </div>
          <SummaryMetricCard title={en ? "Selected Major" : "선택 대분류"} value={selectedMajorOption?.label || (en ? "Not selected" : "미선택")} description={en ? "Choose the LCI top-level family first." : "LCI 대분류로 상위 범위를 먼저 정합니다."} />
          <SummaryMetricCard title={en ? "Selected Middle" : "선택 중분류"} value={selectedMiddleOption?.label || (en ? "Not selected" : "미선택")} description={en ? "Middle classification narrows the eligible small categories." : "중분류를 선택하면 연결 가능한 소분류만 남습니다."} />
          <SummaryMetricCard title={en ? "Selected Small" : "선택 소분류"} value={selectedClassificationMeta.smallName || (en ? "Not selected" : "미선택")} description={en ? "Small classification binds the runtime category and tier scope." : "소분류 선택으로 실제 계산 카테고리와 Tier 범위가 결정됩니다."} />
          <SummaryMetricCard title="Tier" value={selectedTier > 0 ? `Tier ${selectedTier}` : "-"} description={en ? "Tier selection controls formula and variable definitions." : "Tier 선택에 따라 계산식과 입력 변수가 바뀝니다."} />
          <SummaryMetricCard title={en ? "Step" : "단계"} value={wizardStep === 1 ? (en ? "Step 1" : "1단계") : (en ? "Step 2" : "2단계")} description={wizardStep === 1 ? (en ? "Select scope and tier." : "범위와 Tier를 선택합니다.") : (en ? "Enter variables and calculate." : "변수를 입력하고 계산합니다.")} />
        </section>

        <EmissionClassificationCatalogPanel
          catalog={(page?.classificationCatalog || null) as Record<string, unknown> | null}
          highlightedAlias={stringOf(selectedCategory?.subCode)}
          title={en ? "LCI DB Classification Alignment" : "LCI DB 분류 체계 연계"}
        />

        <section className="gov-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "LCI Candidate Backlog" : "LCI 후보 백로그"}</p>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "All LCI small classifications are listed here even when management metadata is not created yet. Use this board to identify which scopes need a later development request."
                  : "management 메타데이터가 아직 없어도 LCI 소분류 전체를 여기서 확인할 수 있습니다. 이후 개발 요청이 필요한 범위를 식별하는 용도입니다."}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{lciSmallCandidates.length}</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <SummaryMetricCard title={en ? "Operational" : "운영중"} value={String(lciSmallCandidates.filter((item) => item.status === "READY").length)} description={en ? "Small classifications already connected to runtime tiers." : "런타임 Tier까지 연결된 소분류"} />
            <SummaryMetricCard title={en ? "Definition only" : "정의만 있음"} value={String(lciSmallCandidates.filter((item) => item.status === "STUDIO_ONLY").length)} description={en ? "Published scope exists but runtime category/tier is not ready." : "publish scope는 있으나 runtime category/tier가 미완료"} />
            <SummaryMetricCard title={en ? "Tier planned" : "Tier 후보 있음"} value={String(lciSmallCandidates.filter((item) => item.status === "PLANNED").length)} description={en ? "Tier metadata exists but runtime support is not ready." : "Tier 후보는 있으나 runtime 지원이 미완료"} />
            <SummaryMetricCard title={en ? "Not implemented" : "미구현"} value={String(lciSmallCandidates.filter((item) => item.status === "UNMAPPED").length)} description={en ? "No management or definition linkage has been created yet." : "management/definition 연결이 아직 없는 소분류"} />
          </div>
          <div className="mt-4 overflow-x-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)]">
            <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)] text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">
                  <th className="px-4 py-3">{en ? "LCI classification" : "LCI 분류"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                  <th className="px-4 py-3">{en ? "Runtime code linkage" : "런타임 코드 연결"}</th>
                  <th className="px-4 py-3">{en ? "Tier coverage" : "Tier 범위"}</th>
                  <th className="px-4 py-3">{en ? "Follow-up" : "후속 조치"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white">
                {lciSmallCandidates.map((candidate) => (
                  <tr key={`lci-candidate-${candidate.code}`}>
                    <td className="px-4 py-3 align-top">
                      <p className="font-bold text-[var(--kr-gov-text-primary)]">{candidate.smallName || candidate.code}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{`${candidate.majorName} / ${candidate.middleName} / ${candidate.smallName}`}</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">{candidate.code}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${candidateStatusTone(candidate.status)}`}>
                        {candidateStatusLabel(candidate.status, en)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {candidate.aliases.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {candidate.aliases.map((alias) => (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700" key={`${candidate.code}-${alias}`}>{alias}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--kr-gov-text-secondary)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {candidate.runtimeTiers.map((tierNumber) => (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700" key={`${candidate.code}-runtime-${tierNumber}`}>{`Tier ${tierNumber}`}</span>
                        ))}
                        {candidate.plannedTiers.filter((tierNumber) => !candidate.runtimeTiers.includes(tierNumber)).map((tierNumber) => (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700" key={`${candidate.code}-planned-${tierNumber}`}>{`Tier ${tierNumber}`}</span>
                        ))}
                        {candidate.runtimeTiers.length === 0 && candidate.plannedTiers.length === 0 ? (
                          <span className="text-xs text-[var(--kr-gov-text-secondary)]">-</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                        {candidate.status === "READY"
                          ? (en ? "No immediate action. Use the existing small classification from the scope selector." : "즉시 조치 불필요. 범위 선택기에서 기존 소분류를 사용하면 됩니다.")
                          : candidate.status === "STUDIO_ONLY"
                            ? (en ? "Create management category/tier metadata or submit a rollout request for runtime linkage." : "management category/tier 메타를 만들거나 런타임 연결 개발 요청으로 넘기세요.")
                            : candidate.status === "PLANNED"
                              ? (en ? "Tier candidate exists. Runtime support still needs follow-up development." : "Tier 후보는 있으나 런타임 지원 개발이 추가로 필요합니다.")
                              : (en ? "No mapping exists yet. Register the scope through a later development request." : "아직 매핑이 없습니다. 이후 개발 요청으로 범위를 등록하세요.")}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`gov-card ${highlightedHelpId === "emission-management-definition-link" ? "ring-2 ring-[var(--kr-gov-blue)] ring-offset-4 ring-offset-white" : ""}`} data-help-id="emission-management-definition-link">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Definition Management" : "정의 관리"}</p>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Use the separate definition studio when you need to add a new category, tier, formula, or resolution policy instead of only testing live inputs."
                  : "실입력 검증만이 아니라 신규 분류, Tier, 수식, 해석 정책을 추가하려면 별도 정의 관리 화면으로 이동합니다."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <MemberButton onClick={() => openElementDefinitionByHelpId("emission-management-definition-link")} type="button" variant="secondary">
                {en ? "Open element definition" : "요소 정의 열기"}
              </MemberButton>
              <a className="gov-btn gov-btn-secondary" href={buildLocalizedPath("/admin/emission/definition-studio", "/en/admin/emission/definition-studio")}>
                {en ? "Open definition studio" : "배출 정의 관리 열기"}
              </a>
            </div>
          </div>
        </section>

        {formulaReference && Boolean(formulaReference.available) ? (
          <section className={`gov-card ${highlightedHelpId === "emission-management-formula-reference" ? "ring-2 ring-[var(--kr-gov-blue)] ring-offset-4 ring-offset-white" : ""}`} data-help-id="emission-management-formula-reference">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{stringOf(formulaReference.title) || (en ? "Built-in formula reference text" : "내장 수식 레퍼런스 텍스트")}</p>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(formulaReference.description)}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-[var(--kr-gov-text-secondary)]">
                <MemberButton onClick={() => openElementDefinitionByHelpId("emission-management-formula-reference")} type="button" variant="secondary">
                  {en ? "Open element definition" : "요소 정의 열기"}
                </MemberButton>
                <span>{en ? "Source HWPX" : "원본 HWPX"}: {stringOf(formulaReference.sourcePath)}</span>
                <span>{en ? "Embedded text" : "내장 텍스트"}: {stringOf(formulaReference.extractedPath)}</span>
              </div>
            </div>
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
              <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-[var(--kr-gov-text-primary)]">{stringOf(formulaReference.text)}</pre>
            </div>
          </section>
        ) : null}

        <section className="gov-card" data-help-id="emission-management-definition-scope-status">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Studio scope bridge" : "스튜디오-런타임 연결 현황"}</p>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Shows whether each published definition scope is already backed by management metadata and a registered calculator."
                  : "publish 된 정의 범위가 management 메타데이터와 런타임 계산기에 이미 연결됐는지 보여 줍니다."}
              </p>
            </div>
            <a className="gov-btn gov-btn-secondary" href={buildLocalizedPath("/admin/emission/definition-studio", "/en/admin/emission/definition-studio")}>
              {en ? "Open definition studio" : "배출 정의 관리 열기"}
            </a>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            {definitionScopeSummaryCards.map((card) => (
              <SummaryMetricCard
                key={`${stringOf(card.title)}-${stringOf(card.value)}`}
                title={stringOf(card.title)}
                value={stringOf(card.value)}
                description={stringOf(card.description)}
              />
            ))}
          </div>

          {selectedCategoryDefinitionScopeRows.length > 0 ? (
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">
                    {en ? "Selected category scope status" : "선택 분류의 정의 연결 상태"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                    {en
                      ? "Published scopes under the currently selected category."
                      : "현재 선택한 분류 아래 publish 된 범위들입니다."}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{selectedCategoryDefinitionScopeRows.length}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedCategoryDefinitionScopeRows.map((row) => (
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${definitionScopeStatusTone(stringOf(row.status))}`} key={`selected-scope-${stringOf(row.categoryCode)}-${stringOf(row.tier)}`}>
                    {`${stringOf(row.tierLabel) || `Tier ${numberOf(row.tier)}`} · ${definitionScopeStatusLabel(stringOf(row.status), en)}`}
                  </span>
                ))}
              </div>
              {blockedSelectedCategoryDefinitionScopeRows.length > 0 ? (
                <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-bold text-amber-900">
                    {en
                      ? "Some published tiers in this category cannot be opened from management yet."
                      : "이 분류에는 management에서 아직 열 수 없는 publish Tier가 있습니다."}
                  </p>
                  <div className="mt-2 space-y-2">
                    {blockedSelectedCategoryDefinitionScopeRows.map((row) => (
                      <p className="text-xs leading-5 text-amber-900" key={`selected-scope-message-${stringOf(row.categoryCode)}-${stringOf(row.tier)}`}>
                        {`${stringOf(row.tierLabel) || `Tier ${numberOf(row.tier)}`} · ${stringOf(row.statusMessage)}`}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {selectedCategory && selectedTier > 0 ? (
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">
                    {en ? "Selected scope runtime status" : "선택 scope 런타임 상태"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                    {en
                      ? "Live status for the currently selected category/tier, including materialization and runtime readiness."
                      : "현재 선택한 카테고리/Tier의 메타 반영 여부와 런타임 준비 상태를 바로 확인합니다."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {appliedDefinitionDraft && stringOf(appliedDefinitionDraft.draftId) ? (
                    <MemberButton
                      disabled={precheckingDraftId === stringOf(appliedDefinitionDraft.draftId)}
                      onClick={() => {
                        void handlePrecheckDefinitionScope(stringOf(appliedDefinitionDraft.draftId));
                      }}
                      type="button"
                      variant="secondary"
                    >
                      {precheckingDraftId === stringOf(appliedDefinitionDraft.draftId)
                        ? (en ? "Prechecking..." : "점검 중...")
                        : (en ? "Run precheck" : "사전 점검")}
                    </MemberButton>
                  ) : null}
                  <MemberButton
                    disabled={scopeStatusLoading}
                    onClick={() => {
                      void loadSelectedScopeStatus(stringOf(selectedCategory?.subCode), selectedTier);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    {scopeStatusLoading ? (en ? "Refreshing..." : "새로고침 중...") : (en ? "Refresh status" : "상태 새로고침")}
                  </MemberButton>
                </div>
              </div>

              {selectedScopeStatus ? (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">
                      {en ? "Current status" : "현재 상태"}
                    </p>
                    <p className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(selectedScopeStatus.displayStatusLabel) || "-"}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(selectedScopeStatus.displayStatusDescription) || "-"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">{stringOf(selectedScopeStatus.lifecycleStatus) || "-"}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700">{stringOf(selectedScopeStatus.promotionStatus) || "LEGACY_ONLY"}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700">{stringOf(selectedScopeStatus.runtimeMode) || "AUTO"}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">
                        {en ? "Status evidence" : "상태 증적"}
                      </p>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {selectedScopeEvidence.map((item) => (
                          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3" key={`selected-scope-evidence-${item.key}`}>
                            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{item.label}</p>
                            <p
                              className={`mt-2 break-all text-sm font-bold ${
                                item.tone === "blue"
                                  ? "text-[var(--kr-gov-blue)]"
                                  : item.tone === "indigo"
                                    ? "text-indigo-700"
                                  : item.tone === "emerald"
                                    ? "text-emerald-700"
                                    : "text-[var(--kr-gov-text-primary)]"
                              }`}
                            >
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">
                        {en ? "Lifecycle timeline" : "전환 타임라인"}
                      </p>
                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-4">
                        {selectedScopeTimeline.map((step, index) => (
                          <div
                            className={`rounded-[var(--kr-gov-radius)] border px-3 py-3 ${
                              step.completed
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-slate-200 bg-white"
                            }`}
                            key={`selected-scope-timeline-${step.key}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-xs font-bold uppercase tracking-wide ${step.completed ? "text-emerald-800" : "text-[var(--kr-gov-text-secondary)]"}`}>
                                {step.label}
                              </p>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${step.completed ? "bg-white text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                {step.completed ? (en ? "Done" : "완료") : `${index + 1}`}
                              </span>
                            </div>
                            <p className={`mt-2 text-sm leading-6 ${step.completed ? "text-emerald-950" : "text-[var(--kr-gov-text-secondary)]"}`}>
                              {step.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">
                          {en ? "Transition feed" : "전환 이력 피드"}
                        </p>
                        {selectedScopeActivityFeed.length > 0 ? (
                          <MemberButton
                            onClick={() => {
                              setActivityFeedOverlayOpen(true);
                            }}
                            type="button"
                            variant="secondary"
                          >
                            {en ? "View all activity" : "전체 이력 보기"}
                          </MemberButton>
                        ) : null}
                      </div>
                      {selectedScopeActivityFeed.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {selectedScopeActivityFeedPreview.map((item) => (
                            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-3 py-3" key={`selected-scope-activity-${item.key}-${item.at}`}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p
                                  className={`text-xs font-bold uppercase tracking-wide ${
                                    item.tone === "blue"
                                      ? "text-[var(--kr-gov-blue)]"
                                      : item.tone === "indigo"
                                        ? "text-indigo-700"
                                        : "text-emerald-700"
                                  }`}
                                >
                                  {item.title}
                                </p>
                                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700">
                                  {item.at}
                                </span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{item.detail}</p>
                              {stringOf(item.message) && stringOf(item.message) !== stringOf(item.detail) ? (
                                <p className="mt-2 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{stringOf(item.message)}</p>
                              ) : null}
                            </div>
                          ))}
                          {hasAdditionalSelectedScopeActivityFeed ? (
                            <p className="text-xs leading-5 text-[var(--kr-gov-text-secondary)]">
                              {en
                                ? `${selectedScopeActivityFeed.length - selectedScopeActivityFeedPreview.length} more transition records are available in the overlay.`
                                : `추가 전환 이력 ${selectedScopeActivityFeed.length - selectedScopeActivityFeedPreview.length}건은 전체 보기에서 확인할 수 있습니다.`}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
                          {en ? "No transition evidence has been recorded for this scope yet." : "이 scope에는 아직 기록된 전환 이력이 없습니다."}
                        </p>
                      )}
                    </div>

                    <div className="rounded-[var(--kr-gov-radius)] border border-indigo-200 bg-indigo-50 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">{en ? "Recommended next action" : "권장 다음 작업"}</p>
                        {appliedDefinitionDraft && stringOf(appliedDefinitionDraft.draftId) && Boolean(selectedScopePrecheck?.materializable) ? (
                          <MemberButton
                            disabled={materializingDraftId === stringOf(appliedDefinitionDraft.draftId)}
                            onClick={() => {
                              void handleMaterializeDefinitionScope(stringOf(appliedDefinitionDraft.draftId));
                            }}
                            type="button"
                            variant="secondary"
                          >
                            {materializingDraftId === stringOf(appliedDefinitionDraft.draftId)
                              ? (en ? "Materializing..." : "반영 중...")
                              : (en ? "Materialize now" : "지금 메타 반영")}
                          </MemberButton>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-indigo-950">{selectedScopeActionGuide}</p>
                    </div>

                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">
                        {en ? "Blocking reasons" : "차단 사유"}
                      </p>
                      {selectedScopeBlockingReasons.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {selectedScopeBlockingReasons.map((reason, index) => (
                            <div className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-3 py-3" key={`selected-scope-blocking-${stringOf(reason.code)}-${index}`}>
                              <p className="text-xs font-bold text-amber-900">{scopeBlockingReasonLabel(stringOf(reason.code), en)}</p>
                              <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">{stringOf(reason.code) || "-"}</p>
                              <p className="mt-1 text-sm leading-6 text-amber-900">{stringOf(reason.message) || "-"}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
                          {en ? "No blocking reason is currently reported for this scope." : "현재 이 scope에는 차단 사유가 보고되지 않았습니다."}
                        </p>
                      )}
                    </div>

                    {selectedScopeWarnings.length > 0 ? (
                      <div className="rounded-[var(--kr-gov-radius)] border border-sky-200 bg-sky-50 px-4 py-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-sky-800">{en ? "Warnings" : "주의"}</p>
                        <div className="mt-3 space-y-2">
                          {selectedScopeWarnings.map((item, index) => (
                            <p className="text-sm leading-6 text-sky-900" key={`selected-scope-warning-${index}`}>{item}</p>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedScopePrecheck ? (
                      <div className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">{en ? "Precheck result" : "사전 점검 결과"}</p>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-800">
                            {Boolean(selectedScopePrecheck.materializable)
                              ? (en ? "Materializable" : "반영 가능")
                              : (en ? "Blocked" : "반영 차단")}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-emerald-900">{stringOf(selectedScopePrecheck.displayStatusDescription) || "-"}</p>
                        {selectedScopePrecheckBlockingReasons.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {selectedScopePrecheckBlockingReasons.map((reason, index) => (
                              <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-3 py-3" key={`selected-scope-precheck-${stringOf(reason.code)}-${index}`}>
                                <p className="text-xs font-bold text-[var(--kr-gov-text-primary)]">{scopeBlockingReasonLabel(stringOf(reason.code), en)}</p>
                                <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{stringOf(reason.code) || "-"}</p>
                                <p className="mt-1 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(reason.message) || "-"}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--kr-gov-text-secondary)]">
                  {scopeStatusLoading
                    ? (en ? "Loading scope status..." : "scope 상태를 불러오는 중입니다...")
                    : (en ? "Select a concrete category/tier scope to inspect runtime status." : "구체적인 카테고리/Tier를 선택하면 런타임 상태를 확인할 수 있습니다.")}
                </p>
              )}
            </div>
          ) : null}

          <div className="mt-6 overflow-x-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)]">
            <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)] text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">
                  <th className="px-4 py-3">{en ? "Scope" : "범위"}</th>
                  <th className="px-4 py-3">{en ? "Bridge status" : "연결 상태"}</th>
                  <th className="px-4 py-3">{en ? "Runtime mode" : "런타임 모드"}</th>
                  <th className="px-4 py-3">{en ? "Published at" : "Publish 시각"}</th>
                  <th className="px-4 py-3">{en ? "Actions" : "작업"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white">
                {definitionScopeRows.length > 0 ? definitionScopeRows.map((row) => {
                  const isSelectedScope = stringOf(row.categoryCode).toUpperCase() === stringOf(selectedCategory?.subCode).toUpperCase()
                    && numberOf(row.tier) === selectedTier;
                  return (
                  <tr
                    className={isSelectedScope ? "bg-blue-50/40" : ""}
                    key={`definition-scope-${stringOf(row.categoryCode)}-${stringOf(row.tier)}`}
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row.categoryName) || stringOf(row.categoryCode)}</p>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{`${stringOf(row.categoryCode)} / ${stringOf(row.tierLabel) || `Tier ${numberOf(row.tier)}`}`}</p>
                      {isSelectedScope ? (
                        <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--kr-gov-blue)]">
                          {en ? "Selected" : "선택됨"}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${definitionScopeStatusTone(stringOf(row.status))}`}>
                        {definitionScopeStatusLabel(stringOf(row.status), en)}
                      </span>
                      <p className="mt-2 max-w-[340px] text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{stringOf(row.statusMessage)}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row.runtimeMode) || "AUTO"}</td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row.publishedSavedAt) || "-"}</p>
                      {!Boolean(row.runtimeSupported) && stringOf(row.draftId) ? (
                        <div className="mt-3">
                          <MemberButton
                            disabled={materializingDraftId === stringOf(row.draftId)}
                            onClick={() => {
                              void handleMaterializeDefinitionScope(stringOf(row.draftId));
                            }}
                            type="button"
                            variant="secondary"
                          >
                            {materializingDraftId === stringOf(row.draftId)
                              ? (en ? "Materializing..." : "반영 중...")
                              : (en ? "Materialize metadata" : "메타 반영")}
                          </MemberButton>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <MemberButton
                          onClick={() => {
                            void focusDefinitionScope(row);
                          }}
                          type="button"
                          variant="secondary"
                        >
                          {en ? "Use this scope" : "이 scope 선택"}
                        </MemberButton>
                        {stringOf(row.draftId) ? (
                          <MemberButton
                            disabled={precheckingDraftId === stringOf(row.draftId)}
                            onClick={() => {
                              void focusDefinitionScope(row).then(() => handlePrecheckDefinitionScope(stringOf(row.draftId)));
                            }}
                            type="button"
                            variant="secondary"
                          >
                            {precheckingDraftId === stringOf(row.draftId)
                              ? (en ? "Prechecking..." : "점검 중...")
                              : (en ? "Precheck" : "사전 점검")}
                          </MemberButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );}) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                      {en
                        ? "No published definition scope has been recorded yet."
                        : "아직 publish 된 정의 범위가 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="gov-card" data-help-id="emission-management-definition-overlay">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Definition overlay" : "정의 오버레이"}</p>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Apply a published definition snapshot to the current category/tier view so formula and policy intent are read from the publish boundary."
                  : "현재 분류/Tier 화면에 publish 된 정의 스냅샷을 적용해 수식과 정책 의도를 publish 경계 기준으로 읽습니다."}
              </p>
            </div>
            <a className="gov-btn gov-btn-secondary" href={buildLocalizedPath("/admin/emission/definition-studio", "/en/admin/emission/definition-studio")}>
              {en ? "Open definition studio" : "배출 정의 관리 열기"}
            </a>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold">{en ? "Applied published snapshot" : "적용 publish 스냅샷"}</span>
              <AdminSelect
                disabled={matchingDefinitionDrafts.length === 0}
                onChange={(event) => setAppliedDefinitionDraftId(event.target.value)}
                value={appliedDefinitionDraftId}
              >
                {matchingDefinitionDrafts.length === 0 ? (
                  <option value="">{en ? "No matching published snapshot" : "일치하는 publish 스냅샷 없음"}</option>
                ) : null}
                {matchingDefinitionDrafts.map((row) => (
                  <option key={stringOf(row.draftId)} value={stringOf(row.draftId)}>
                    {`${stringOf(row.categoryCode)} / ${stringOf(row.tierLabel)} / ${stringOf(row.lastSavedAt) || "-"}`}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Effective formula" : "적용 수식"}</p>
                  <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{effectiveFormulaSummary || "-"}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                  {appliedDefinitionDraft ? (stringOf(appliedDefinitionDraft.inputMode) || "NUMBER") : (en ? "live metadata" : "실메타데이터")}
                </span>
              </div>
              {appliedDefinitionPolicies.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {appliedDefinitionPolicies.map((policy) => (
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-blue)]" key={`policy-${policy}`}>{policy}</span>
                  ))}
                </div>
              ) : null}
              {stringOf(appliedDefinitionDraft?.note) ? (
                <p className="mt-4 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(appliedDefinitionDraft?.note)}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="gov-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Definition rollout board" : "정의 수식 rollout 현황"}</p>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Shows the latest server-side comparison result for each category/tier scope so you can see which definitions are ready to replace the legacy calculator."
                  : "카테고리/Tier별 최신 서버 비교 결과를 모아, 어떤 정의가 레거시 계산기를 대체할 준비가 됐는지 바로 확인합니다."}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {en ? `${rolloutStatusRows.length} scopes tracked` : `${rolloutStatusRows.length}개 scope 추적 중`}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
            {rolloutSummaryCards.map((card) => (
              <SummaryMetricCard
                key={`${stringOf(card.title)}-${stringOf(card.value)}`}
                title={stringOf(card.title)}
                value={stringOf(card.value)}
                description={stringOf(card.description)}
              />
            ))}
          </div>

          <div className="mt-6 overflow-x-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)]">
            <table className="min-w-full divide-y divide-[var(--kr-gov-border-light)] text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">
                  <th className="px-4 py-3">{en ? "Scope" : "범위"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                  <th className="px-4 py-3">{en ? "Delta" : "차이"}</th>
                  <th className="px-4 py-3">{en ? "Definition draft" : "정의 초안"}</th>
                  <th className="px-4 py-3">{en ? "Calculated at" : "계산 시각"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--kr-gov-border-light)] bg-white">
                {rolloutStatusRows.length > 0 ? rolloutStatusRows.map((row) => {
                  const status = stringOf(row.promotionStatus);
                  return (
                    <tr key={`${stringOf(row.categoryCode)}-${stringOf(row.tier)}-${stringOf(row.resultId)}`}>
                      <td className="px-4 py-3 align-top">
                        <p className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row.categoryName) || stringOf(row.categoryCode)}</p>
                        <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{`${stringOf(row.categoryCode)} / ${stringOf(row.tierLabel) || `Tier ${numberOf(row.tier)}`}`}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rolloutStatusTone(status)}`}>
                          {rolloutStatusLabel(status, en)}
                        </span>
                        <p className="mt-2 max-w-[320px] text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{stringOf(row.promotionMessage)}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-bold text-[var(--kr-gov-text-primary)]">{numberOf(row.delta).toFixed(6)}</p>
                        <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                          {en ? "Unresolved" : "미해결"} {numberOf(row.unresolvedCount)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-mono text-xs text-[var(--kr-gov-text-primary)]">{stringOf(row.draftId) || "-"}</p>
                        <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">
                          {Boolean(row.definitionFormulaAdopted)
                            ? (en ? "Runtime is using the published definition path." : "런타임이 published definition 경로를 사용 중입니다.")
                            : (en ? "Legacy total still active." : "현재는 레거시 결과가 유지됩니다.")}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">
                          {en ? "Runtime mode" : "런타임 모드"}: {stringOf((row.definitionFormulaComparison as Record<string, unknown>)?.runtimeMode) || "AUTO"}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row.createdAt) || "-"}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                      {en
                        ? "No server-side rollout comparison has been recorded yet. Run calculate once in each category/tier scope to populate this board."
                        : "아직 서버 기준 rollout 비교 결과가 없습니다. 각 카테고리/Tier에서 계산을 한 번 실행하면 이 보드가 채워집니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`gov-card ${highlightedHelpId === "emission-management-element-registry" ? "ring-2 ring-[var(--kr-gov-blue)] ring-offset-4 ring-offset-white" : ""}`} data-help-id="emission-management-element-registry">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Screen element registry" : "화면 요소 정의/등록"}</p>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Define the major elements that compose /admin/emission/management and register their component type, layout zone, labels, bindings, and usage status."
                  : "/admin/emission/management 화면을 구성하는 주요 요소를 정의하고 컴포넌트 유형, 배치 영역, 라벨, 바인딩, 사용 상태까지 등록합니다."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <MemberButton onClick={handleNewElementDefinition} type="button" variant="secondary">
                {en ? "New element" : "신규 요소"}
              </MemberButton>
              <MemberButton disabled={elementRegistrySaving} onClick={() => void handleSaveElementDefinition()} type="button">
                {elementRegistrySaving ? (en ? "Saving..." : "저장 중...") : (en ? "Register element" : "요소 등록")}
              </MemberButton>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            {elementRegistrySummary.map((card) => (
              <SummaryMetricCard
                key={`${stringOf(card.title)}-${stringOf(card.value)}`}
                title={stringOf(card.title)}
                value={stringOf(card.value)}
                description={stringOf(card.description)}
              />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold">{en ? "Registered elements" : "등록 요소 목록"}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{elementRegistryRows.length}</span>
              </div>
              <div className="mt-4 space-y-3">
                {elementRegistryRows.map((row) => {
                  const definitionId = stringOf(row.definitionId);
                  const active = definitionId === selectedElementDefinitionId;
                  return (
                    <button
                      className={`w-full rounded-[var(--kr-gov-radius)] border px-4 py-3 text-left transition ${
                        active
                          ? "border-[var(--kr-gov-blue)] bg-blue-50"
                          : "border-white bg-white hover:border-[var(--kr-gov-border-light)] hover:bg-slate-50"
                      }`}
                      key={definitionId || stringOf(row.elementKey)}
                      onClick={() => applyElementDefinition(row)}
                      type="button"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(row.elementName) || stringOf(row.elementKey)}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{stringOf(row.layoutZone)}</span>
                          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">{en ? "Direct" : "직접"} {stringOf(row.directRequiredCount) || "0"}</span>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">{en ? "Fallback" : "대체"} {stringOf(row.fallbackCount) || "0"}</span>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{stringOf(row.statusLabel) || stringOf(row.status)}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{stringOf(row.elementKey)}</p>
                      {stringOf(row.variableScope) ? <p className="mt-2 text-xs text-[var(--kr-gov-blue)]">{stringOf(row.variableScope)}</p> : null}
                      <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row.description)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold">{en ? "Element definition" : "요소 정의 편집"}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <MemberButton
                    disabled={selectedCategoryId <= 0 || selectedTier <= 0 || visibleVariables.length === 0}
                    onClick={applyCurrentSelectionPolicyToDraft}
                    type="button"
                    variant="secondary"
                  >
                    {en ? "Use current tier policy" : "현재 Tier 정책 채우기"}
                  </MemberButton>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">
                    {stringOf(elementDefinitionDraft.definitionId) || (en ? "new" : "신규")}
                  </span>
                </div>
              </div>
              <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Template shortcuts" : "템플릿 바로가기"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <MemberButton onClick={() => applyElementTemplate("workspace")} type="button" variant="secondary">
                    {en ? "Workspace" : "입력 작업공간"}
                  </MemberButton>
                  <MemberButton onClick={() => applyElementTemplate("catalog")} type="button" variant="secondary">
                    {en ? "Catalog" : "변수 카탈로그"}
                  </MemberButton>
                  <MemberButton onClick={() => applyElementTemplate("calc_log")} type="button" variant="secondary">
                    {en ? "Calc log" : "계산 로그"}
                  </MemberButton>
                  <MemberButton onClick={() => applyElementTemplate("applied_factors")} type="button" variant="secondary">
                    {en ? "Applied factors" : "적용 계수"}
                  </MemberButton>
                  <MemberButton onClick={() => applyElementTemplate("validation")} type="button" variant="secondary">
                    {en ? "Validation" : "검증 안내"}
                  </MemberButton>
                </div>
              </div>
              {selectedCategoryId > 0 && selectedTier > 0 ? (
                <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-sky-200 bg-sky-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-sky-700">{en ? "Current policy snapshot" : "현재 정책 스냅샷"}</p>
                  <p className="mt-2 text-sm text-sky-900">
                    {en
                      ? `${stringOf(selectedCategory?.subName) || stringOf(selectedCategory?.subCode)} / Tier ${selectedTier}`
                      : `${stringOf(selectedCategory?.subName) || stringOf(selectedCategory?.subCode)} / Tier ${selectedTier}`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{en ? "Direct" : "직접"} {collectPolicyCodesForCurrentSelection().directRequiredCodes.length}</span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">{en ? "Fallback" : "대체"} {collectPolicyCodesForCurrentSelection().fallbackCodes.length}</span>
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{en ? "Auto" : "자동"} {collectPolicyCodesForCurrentSelection().autoCalculatedCodes.length}</span>
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700">{en ? "Supplemental" : "보조"} {collectPolicyCodesForCurrentSelection().supplementalCodes.length}</span>
                  </div>
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Element key" : "요소 키"}</span>
                  <AdminInput onChange={(event) => updateElementDefinitionDraft("elementKey", event.target.value)} value={stringOf(elementDefinitionDraft.elementKey)} />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Element name" : "요소 이름"}</span>
                  <AdminInput onChange={(event) => updateElementDefinitionDraft("elementName", event.target.value)} value={stringOf(elementDefinitionDraft.elementName)} />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Element type" : "요소 유형"}</span>
                  <AdminSelect onChange={(event) => updateElementDefinitionDraft("elementType", event.target.value)} value={stringOf(elementDefinitionDraft.elementType)}>
                    {elementTypeOptions.map((option) => (
                      <option key={stringOf(option.code)} value={stringOf(option.code)}>{stringOf(option.label)}</option>
                    ))}
                  </AdminSelect>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Layout zone" : "배치 영역"}</span>
                  <AdminSelect onChange={(event) => updateElementDefinitionDraft("layoutZone", event.target.value)} value={stringOf(elementDefinitionDraft.layoutZone)}>
                    {layoutZoneOptions.map((option) => (
                      <option key={stringOf(option.code)} value={stringOf(option.code)}>{stringOf(option.label)}</option>
                    ))}
                  </AdminSelect>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Component type" : "컴포넌트 유형"}</span>
                  <AdminSelect onChange={(event) => updateElementDefinitionDraft("componentType", event.target.value)} value={stringOf(elementDefinitionDraft.componentType)}>
                    {componentTypeOptions.map((option) => (
                      <option key={stringOf(option.code)} value={stringOf(option.code)}>{stringOf(option.label)}</option>
                    ))}
                  </AdminSelect>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Use status" : "사용 상태"}</span>
                  <AdminSelect onChange={(event) => updateElementDefinitionDraft("useYn", event.target.value)} value={stringOf(elementDefinitionDraft.useYn) || "Y"}>
                    <option value="Y">{en ? "Use" : "사용"}</option>
                    <option value="N">{en ? "Disabled" : "미사용"}</option>
                  </AdminSelect>
                </label>
              </div>
              <label className="mt-4 flex flex-col gap-2">
                <span className="text-sm font-bold">{en ? "Binding target" : "바인딩 대상"}</span>
                <AdminInput onChange={(event) => updateElementDefinitionDraft("bindingTarget", event.target.value)} value={stringOf(elementDefinitionDraft.bindingTarget)} />
              </label>
              <label className="mt-4 flex flex-col gap-2">
                <span className="text-sm font-bold">{en ? "Variable scope" : "변수 범위"}</span>
                <AdminInput onChange={(event) => updateElementDefinitionDraft("variableScope", event.target.value)} placeholder={en ? "ex) visibleVariables / selected tier" : "예) visibleVariables / selected tier"} value={stringOf(elementDefinitionDraft.variableScope)} />
              </label>
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Default label (KO)" : "기본 라벨(국문)"}</span>
                  <AdminInput onChange={(event) => updateElementDefinitionDraft("defaultLabel", event.target.value)} value={stringOf(elementDefinitionDraft.defaultLabel)} />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Default label (EN)" : "기본 라벨(영문)"}</span>
                  <AdminInput onChange={(event) => updateElementDefinitionDraft("defaultLabelEn", event.target.value)} value={stringOf(elementDefinitionDraft.defaultLabelEn)} />
                </label>
              </div>
              <label className="mt-4 flex flex-col gap-2">
                <span className="text-sm font-bold">{en ? "Tags" : "태그"}</span>
                <AdminInput onChange={(event) => updateElementDefinitionDraft("tags", event.target.value)} placeholder={en ? "Comma separated tags" : "쉼표로 구분한 태그"} value={stringOf(elementDefinitionDraft.tags)} />
              </label>
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Direct-required codes" : "직접입력 필수 코드"}</span>
                  <AdminInput onChange={(event) => updateElementDefinitionDraft("directRequiredCodes", event.target.value)} placeholder="MCL, MI, FI" value={stringOf(elementDefinitionDraft.directRequiredCodes)} />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Fallback codes" : "대체 허용 코드"}</span>
                  <AdminInput onChange={(event) => updateElementDefinitionDraft("fallbackCodes", event.target.value)} placeholder="EFCLC, EFC, EFCL" value={stringOf(elementDefinitionDraft.fallbackCodes)} />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Auto-calculated codes" : "자동계산 코드"}</span>
                  <AdminInput onChange={(event) => updateElementDefinitionDraft("autoCalculatedCodes", event.target.value)} placeholder="EFI, EFK" value={stringOf(elementDefinitionDraft.autoCalculatedCodes)} />
                </label>
              </div>
              <label className="mt-4 flex flex-col gap-2">
                <span className="text-sm font-bold">{en ? "Policy note" : "정책 메모"}</span>
                <textarea
                  className="min-h-[88px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]"
                  onChange={(event) => updateElementDefinitionDraft("policyNote", event.target.value)}
                  value={stringOf(elementDefinitionDraft.policyNote)}
                />
              </label>
              <label className="mt-4 flex flex-col gap-2">
                <span className="text-sm font-bold">{en ? "Description" : "설명"}</span>
                <textarea
                  className="min-h-[120px] rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-primary)]"
                  onChange={(event) => updateElementDefinitionDraft("description", event.target.value)}
                  value={stringOf(elementDefinitionDraft.description)}
                />
              </label>
            </div>
          </div>
        </section>

        <section className={`gov-card ${highlightedHelpId === "emission-management-element-spec" ? "ring-2 ring-[var(--kr-gov-blue)] ring-offset-4 ring-offset-white" : ""}`} data-help-id="emission-management-element-spec">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Screen composition spec" : "화면 구성 명세"}</p>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Read the saved element registry as a screen specification with layout, bindings, and input-policy coverage."
                  : "저장된 요소 registry를 배치, 바인딩, 입력 정책 범위까지 포함한 화면 명세로 읽습니다."}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{elementRegistryRows.length}</span>
          </div>
          <div className="mt-4 space-y-4">
            {elementRegistryRows.map((row) => {
              const directCodes = codeList(row.directRequiredCodes);
              const fallbackCodes = codeList(row.fallbackCodes);
              const autoCodes = codeList(row.autoCalculatedCodes);
              return (
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4" key={`spec-${stringOf(row.definitionId) || stringOf(row.elementKey)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(row.elementName) || stringOf(row.elementKey)}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{stringOf(row.elementKey)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <MemberButton onClick={() => focusRegisteredElement(row)} type="button" variant="secondary">
                        {en ? "Locate on page" : "화면에서 찾기"}
                      </MemberButton>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{stringOf(row.layoutZone)}</span>
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">{stringOf(row.componentType)}</span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{stringOf(row.useLabel) || stringOf(row.useYn)}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{en ? "Binding" : "바인딩"}</p>
                        <p className="mt-2 text-sm text-[var(--kr-gov-text-primary)]">{stringOf(row.bindingTarget) || "-"}</p>
                      </div>
                      <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{en ? "Variable scope" : "변수 범위"}</p>
                        <p className="mt-2 text-sm text-[var(--kr-gov-text-primary)]">{stringOf(row.variableScope) || "-"}</p>
                      </div>
                      <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{en ? "Policy note" : "정책 메모"}</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-primary)]">{stringOf(row.policyNote) || stringOf(row.description) || "-"}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-[var(--kr-gov-radius)] border border-rose-200 bg-rose-50 px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700">{en ? "Direct-required codes" : "직접입력 필수 코드"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {directCodes.length > 0 ? directCodes.map((code) => (
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-rose-700" key={`${stringOf(row.definitionId)}-direct-${code}`}>{code}</span>
                          )) : <span className="text-sm text-rose-700">-</span>}
                        </div>
                      </div>
                      <div className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">{en ? "Fallback codes" : "대체 허용 코드"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {fallbackCodes.length > 0 ? fallbackCodes.map((code) => (
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-700" key={`${stringOf(row.definitionId)}-fallback-${code}`}>{code}</span>
                          )) : <span className="text-sm text-amber-700">-</span>}
                        </div>
                      </div>
                      <div className="rounded-[var(--kr-gov-radius)] border border-sky-200 bg-sky-50 px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-sky-700">{en ? "Auto-calculated codes" : "자동계산 코드"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {autoCodes.length > 0 ? autoCodes.map((code) => (
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-sky-700" key={`${stringOf(row.definitionId)}-auto-${code}`}>{code}</span>
                          )) : <span className="text-sm text-sky-700">-</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        {wizardStep === 1 ? (
          <CollectionResultPanel
            className={highlightedHelpId === "emission-management-scope" ? "ring-2 ring-[var(--kr-gov-blue)] ring-offset-4 ring-offset-white" : ""}
            data-help-id="emission-management-scope"
            title={en ? "Step 1. Scope And Tier Selection" : "1단계. 범위 및 Tier 선택"}
            description={en ? "Choose LCI major, middle, and small classification, then decide the tier before moving to input." : "LCI 대분류, 중분류, 소분류를 선택하고 Tier를 정한 뒤 입력 페이지로 이동합니다."}
          >
            <div className="mb-4 flex justify-end">
              <MemberButton onClick={() => openElementDefinitionByHelpId("emission-management-scope")} type="button" variant="secondary">
                {en ? "Open element definition" : "요소 정의 열기"}
              </MemberButton>
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_0.95fr_1.1fr]">
              <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold">{en ? "Major Classification" : "대분류"}</h3>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Select the LCI top-level classification first." : "먼저 LCI 대분류를 검색하고 선택합니다."}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{filteredMajorOptions.length}</span>
                </div>
                <label className="mt-4 flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Major Search" : "대분류 검색"}</span>
                  <AdminInput
                    onChange={(event) => setMajorSearchKeyword(event.target.value)}
                    placeholder={en ? "Search major code or name" : "대분류 코드 또는 명 검색"}
                    value={majorSearchKeyword}
                  />
                </label>
                <label className="mt-4 flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Major Classification" : "대분류 선택"}</span>
                  <AdminSelect
                    onChange={(event) => {
                      setSelectedMajorKey(event.target.value);
                      setMiddleSearchKeyword("");
                      setSubCategorySearchKeyword("");
                      setSelectedMiddleCode("");
                      setSelectedCategoryId(0);
                      setSelectedCategory(null);
                      setTiers([]);
                      resetSelectionState();
                    }}
                    value={selectedMajorKey}
                  >
                    <option value="">{en ? "Select major classification" : "대분류 선택"}</option>
                    {filteredMajorOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </AdminSelect>
                </label>
              </section>

              <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold">{en ? "Middle Classification" : "중분류"}</h3>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "After selecting the major group, narrow the scope with the middle classification." : "대분류를 선택한 뒤 중분류로 범위를 더 좁힙니다."}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{filteredMiddleOptions.length}</span>
                </div>
                <label className="mt-4 flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Middle Search" : "중분류 검색"}</span>
                  <AdminInput
                    disabled={!selectedMajorKey}
                    onChange={(event) => setMiddleSearchKeyword(event.target.value)}
                    placeholder={en ? "Search middle code or name" : "중분류 코드 또는 명 검색"}
                    value={middleSearchKeyword}
                  />
                </label>
                <label className="mt-4 flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Middle Classification" : "중분류 선택"}</span>
                  <AdminSelect
                    disabled={!selectedMajorKey}
                    onChange={(event) => {
                      setSelectedMiddleCode(event.target.value);
                      setSubCategorySearchKeyword("");
                      setSelectedCategoryId(0);
                      setSelectedCategory(null);
                      setTiers([]);
                      resetSelectionState();
                    }}
                    value={selectedMiddleCode}
                  >
                    <option value="">{en ? "Select middle classification" : "중분류 선택"}</option>
                    {filteredMiddleOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </AdminSelect>
                </label>
              </section>

              <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold">{en ? "Small Classification And Tier" : "소분류 및 Tier"}</h3>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Choose the runtime small classification, then pick the tier for formula and variable generation." : "실행할 소분류를 선택한 뒤 Tier를 정하면 계산식과 입력 변수가 구성됩니다."}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">{selectedTier > 0 ? `Tier ${selectedTier}` : (en ? "Pending" : "선택 대기")}</span>
                </div>
                <label className="mt-4 flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Small Search" : "소분류 검색"}</span>
                  <AdminInput
                    disabled={!selectedMajorKey || !selectedMiddleCode}
                    onChange={(event) => setSubCategorySearchKeyword(event.target.value)}
                    placeholder={en ? "Search small classification or runtime code" : "소분류 또는 런타임 코드 검색"}
                    value={subCategorySearchKeyword}
                  />
                </label>
                <label className="mt-4 flex flex-col gap-2">
                  <span className="text-sm font-bold">{en ? "Small Classification" : "소분류 선택"}</span>
                  <AdminSelect
                    disabled={!selectedMajorKey || !selectedMiddleCode}
                    onChange={(event) => {
                      void handleCategoryChange(Number(event.target.value) || 0);
                    }}
                    value={hasSelectedCategory ? String(selectedCategoryId) : ""}
                  >
                    <option value="">{en ? "Select small classification" : "소분류 선택"}</option>
                    {visibleCategories.map((category) => {
                      const meta = classificationMetaOf(category, classificationCatalogRows);
                      return (
                        <option key={stringOf(category.categoryId)} value={stringOf(category.categoryId)}>
                          {`${meta.smallName || stringOf(category.subName)}${meta.smallCode ? ` (${meta.smallCode})` : ""}${stringOf(category.subCode) ? ` · ${stringOf(category.subCode)}` : ""}${Boolean(category.virtualCategory) ? (en ? " [Studio only]" : " [Studio 전용]") : ""}`}
                        </option>
                      );
                    })}
                  </AdminSelect>
                </label>
                <label className="mt-4 flex flex-col gap-2">
                  <span className="text-sm font-bold">Tier</span>
                  <AdminSelect
                    disabled={!hasSelectedCategory}
                    onChange={(event) => {
                      void handleTierChange(Number(event.target.value) || 0);
                    }}
                    value={selectedTier > 0 ? String(selectedTier) : ""}
                  >
                    <option value="">{en ? "Select tier" : "Tier 선택"}</option>
                    {tiers.map((tier) => (
                      <option key={`${stringOf(tier.tier)}-${stringOf(tier.tierLabel)}`} value={stringOf(tier.tier)}>
                        {`${stringOf(tier.tierLabel) || `Tier ${stringOf(tier.tier)}`}${Boolean(tier.runtimeSupported ?? true) ? "" : (en ? " [Unavailable]" : " [미개통]")}`}
                      </option>
                    ))}
                  </AdminSelect>
                  <div className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">{en ? "Tier Guidance" : "Tier 안내"}</p>
                    <p className="mt-1 text-sm font-bold leading-6 text-amber-900">
                      {selectedClassificationMeta.tierLabel
                        ? (en ? `LCI recommended scope: ${selectedClassificationMeta.tierLabel}` : `LCI 권장 범위: ${selectedClassificationMeta.tierLabel}`)
                        : (en
                          ? "Choosing a higher tier generally improves carbon emission accuracy."
                          : "조금 더 높은 Tier를 선택할수록 탄소배출량 산정 정확도가 높아집니다.")}
                    </p>
                  </div>
                </label>
                <div className="mt-6 flex items-center justify-end">
                  <MemberButton
                    disabled={loading || definitionLoading || !hasSelectedCategory || selectedTier <= 0}
                    onClick={() => {
                      void proceedToInputStep();
                    }}
                    type="button"
                  >
                    {definitionLoading ? (en ? "Loading..." : "불러오는 중...") : (en ? "Next: Input Variables" : "다음: 변수 입력")}
                  </MemberButton>
                </div>
              </section>
            </div>
            {hasSelectedCategory ? (
              <section className="mt-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold">{en ? "Tier Input Guide" : "Tier별 입력값 안내"}</h3>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                      {en
                        ? "After selecting a small classification, review the formula and main inputs required for each tier before deciding."
                        : "소분류를 선택한 뒤 각 Tier에서 요구하는 계산식과 주요 입력값을 먼저 확인할 수 있습니다."}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{tiers.length}</span>
                </div>
                {tierGuideLoading ? (
                  <p className="mt-4 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Loading tier guidance..." : "Tier 안내를 불러오는 중입니다..."}</p>
                ) : null}
                {!tierGuideLoading && tiers.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                    {tiers.map((tier) => {
                      const tierNumber = numberOf(tier.tier);
                      const guide = tierGuideMap[tierNumber];
                      const guideVariables = guide?.variables ? visibleVariablesForStep(selectedCategory, tierNumber, guide.variables) : [];
                      const tierDefinitionDraft = definitionDraftForScope(stringOf(selectedCategory?.subCode), tierNumber);
                      const tierDefinitionPolicies = definitionPolicyBadges(tierDefinitionDraft);
                      const tierFormulaSummary = stringOf(tierDefinitionDraft?.formula) || guide?.formulaDisplay || guide?.formulaSummary || "-";
                      const runtimeSupported = Boolean(tier.runtimeSupported ?? true);
                      return (
                        <article className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-4" key={`tier-guide-${tierNumber}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(tier.tierLabel) || `Tier ${tierNumber}`}</h4>
                              {tierDefinitionDraft ? (
                                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-[var(--kr-gov-blue)]">
                                  {en ? "Published definition" : "publish 정의 반영"}
                                </span>
                              ) : null}
                              {tierGuideFallbackSummary(selectedCategory, tierNumber, guideVariables) ? (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                                  {en ? "Fallback Available" : "대체값 적용 가능"}
                                </span>
                              ) : null}
                              {!runtimeSupported ? (
                                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                                  {en ? "Runtime unavailable" : "런타임 미개통"}
                                </span>
                              ) : null}
                            </div>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{guideVariables.length}</span>
                          </div>
                          <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-3 py-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Formula" : "계산식"}</p>
                            <div className="mt-2">
                              <FormulaNotation active formula={tierFormulaSummary} />
                            </div>
                          </div>
                          {!runtimeSupported ? (
                            <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-3 py-3">
                              <p className="text-xs leading-5 text-amber-900">
                                {stringOf(tier.statusMessage) || (en ? "This tier is published in studio, but management runtime support is not ready." : "이 Tier는 studio에 publish 되었지만 management 런타임 지원이 아직 준비되지 않았습니다.")}
                              </p>
                            </div>
                          ) : null}
                          {tierDefinitionPolicies.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {tierDefinitionPolicies.map((policy) => (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700" key={`tier-draft-${tierNumber}-${policy}`}>
                                  {policy}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {stringOf(tierDefinitionDraft?.note) ? (
                            <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-3">
                              <p className="text-xs leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(tierDefinitionDraft?.note)}</p>
                            </div>
                          ) : null}
                          {tierGuideFallbackSummary(selectedCategory, tierNumber, guideVariables) ? (
                            <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-3 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                                {en ? "Fallback Guidance" : "대체값 안내"}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-amber-900">
                                {tierGuideFallbackSummary(selectedCategory, tierNumber, guideVariables)}
                              </p>
                            </div>
                          ) : null}
                          <div className="mt-4 space-y-2">
                            {guideVariables.length > 0 ? guideVariables.map((variable) => {
                              const policy = inputPolicyMeta(variable, selectedCategory, tierNumber);
                              return (
                                <div
                                  className={`rounded-[var(--kr-gov-radius)] border px-3 py-3 ${
                                    supportsFallbackInput(variable, selectedCategory, tierNumber)
                                      ? "border-amber-200 bg-amber-50/70"
                                      : "border-[var(--kr-gov-border-light)] bg-slate-50"
                                  }`}
                                  key={`tier-guide-${tierNumber}-${stringOf(variable.varCode)}`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{displayVariableName(selectedCategory, tierNumber, variable)}</p>
                                    <div className="flex flex-wrap gap-2">
                                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${policyBadgeClass(policy.tone)}`}>{policy.badge}</span>
                                      {isRepeatableVariable(variable) ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">{en ? "Summation" : "Summation"}</span> : null}
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">{stringOf(variable.inputType) || "TEXT"}</span>
                                    </div>
                                  </div>
                                  <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{displayUnitLabel(stringOf(variable.unit), en)}</p>
                                  <p className="mt-2 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{policy.description}</p>
                                </div>
                              );
                            }) : (
                              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No variable guide is available for this tier yet." : "이 Tier의 변수 안내를 아직 불러오지 못했습니다."}</p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            ) : null}
          </CollectionResultPanel>
        ) : null}

        {wizardStep === 2 ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="min-w-0 xl:w-[420px] xl:min-w-[420px] xl:max-w-[420px]">
          <DiagnosticCard
            className={highlightedHelpId === "emission-management-definition" ? "ring-2 ring-[var(--kr-gov-blue)] ring-offset-4 ring-offset-white" : ""}
            data-help-id="emission-management-definition"
            actions={(
              <MemberButton onClick={() => openElementDefinitionByHelpId("emission-management-definition")} type="button" variant="secondary">
                {en ? "Open element definition" : "요소 정의 열기"}
              </MemberButton>
            )}
            description={en ? "Step 2 begins after tier selection. Review the current formula, variable metadata, and factor references before entering values." : "2단계에서는 선택된 Tier 기준 계산식, 변수 메타데이터, 계수 참조를 확인한 뒤 값을 입력합니다."}
            status={definitionLoading ? (en ? "Loading" : "불러오는 중") : (en ? "Ready" : "준비됨")}
            statusTone={definitionLoading ? "warning" : "healthy"}
            title={en ? "Step 2. Variable Definition Catalog" : "2단계. 변수 정의 카탈로그"}
          >
            {loading ? (
              <p className="mt-4 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Loading categories and metadata..." : "카테고리와 메타데이터를 불러오는 중입니다..."}</p>
            ) : null}
            {appliedDefinitionDraft ? (
              <section className="mt-4 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Applied published definition" : "적용 publish 정의"}</p>
                    <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">
                      {`${stringOf(appliedDefinitionDraft.categoryCode) || "-"} / ${stringOf(appliedDefinitionDraft.tierLabel) || "-"}`}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                    {stringOf(appliedDefinitionDraft.inputMode) || "NUMBER"}
                  </span>
                </div>
                <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Definition formula" : "정의 수식"}</p>
                  <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{effectiveFormulaSummary || "-"}</p>
                </div>
                {appliedDefinitionPolicies.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {appliedDefinitionPolicies.map((policy) => (
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-blue)]" key={`applied-definition-policy-${policy}`}>
                        {policy}
                      </span>
                    ))}
                  </div>
                ) : null}
                {stringOf(appliedDefinitionDraft.note) ? (
                  <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(appliedDefinitionDraft.note)}</p>
                ) : null}
              </section>
            ) : null}
            {!definitionLoading && visibleVariables.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[var(--kr-gov-radius)] border border-rose-200 bg-rose-50 px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700">{en ? "Direct Required" : "직접 입력 필수"}</p>
                  <p className="mt-2 text-2xl font-black text-rose-900">{visibleVariables.filter((variable) => inputPolicyMeta(variable).tone === "red").length}</p>
                </div>
                <div className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">{en ? "Fallback Defined" : "대체값 정의됨"}</p>
                  <p className="mt-2 text-2xl font-black text-amber-900">{visibleVariables.filter((variable) => inputPolicyMeta(variable).tone === "amber").length}</p>
                </div>
              </div>
            ) : null}
            <div className="mt-4 space-y-3">
              {visibleVariables.map((variable) => {
                const resolutionGuide = resolutionGuideForVariable(en, selectedCategory, selectedTier, variable);
                const policy = inputPolicyMeta(variable);
                return (
                  <article
                    className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${
                      supportsFallbackInput(variable)
                        ? "border-amber-200 bg-amber-50/60"
                        : "border-[var(--kr-gov-border-light)] bg-white"
                    }`}
                    key={stringOf(variable.varCode)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{displayVariableName(selectedCategory, selectedTier, variable)}</p>
                        <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{displayUnitLabel(stringOf(variable.unit), en)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${policyBadgeClass(policy.tone)}`}>{policy.badge}</span>
                        {resolutionGuide ? <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700">{resolutionGuide.badge}</span> : null}
                        {isRepeatableVariable(variable) ? <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">{en ? "Summation" : "Summation 변수"}</span> : null}
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{stringOf(variable.inputType) || "TEXT"}</span>
                      </div>
                    </div>
                    {stringOf(variable.varDesc) ? <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(variable.varDesc)}</p> : null}
                    <p className="mt-2 text-xs font-bold leading-5 text-[var(--kr-gov-text-primary)]">{policy.description}</p>
                    {resolutionGuide ? <p className="mt-2 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{resolutionGuide.description}</p> : null}
                  </article>
                );
              })}
              {!definitionLoading && visibleVariables.length === 0 ? (
                <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Select a category and tier to load variable definitions." : "카테고리와 Tier를 선택하면 변수 정의가 표시됩니다."}</p>
              ) : null}
            </div>

            <section className="mt-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold">{en ? "Factor References" : "계수 참조"}</h3>
                {selectedCategory && stringOf(selectedCategory.subCode).toUpperCase() === "LIME" && limeDefaultFactor ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                    {stringOf(limeDefaultFactor.factorValue)} {displayUnitLabel(stringOf(limeDefaultFactor.unit), en)}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 space-y-3">
                {factors.map((factor) => (
                  <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-3" key={stringOf(factor.factorCode)}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">{stringOf(factor.factorName) || stringOf(factor.factorCode)}</p>
                        <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{displayUnitLabel(stringOf(factor.unit), en)}</p>
                      </div>
                      <p className="text-sm font-black text-[var(--kr-gov-blue)]">{stringOf(factor.factorValue)}</p>
                    </div>
                    {stringOf(factor.remark) ? <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(factor.remark)}</p> : null}
                  </div>
                ))}
                {factors.length === 0 ? (
                  <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No stored factor rows for the current scope." : "현재 범위에 저장된 계수 행이 없습니다."}</p>
                ) : null}
              </div>
            </section>
          </DiagnosticCard>
          </div>

          <div className="min-w-0">
          <DiagnosticCard
            className={highlightedHelpId === "emission-management-input" ? "ring-2 ring-[var(--kr-gov-blue)] ring-offset-4 ring-offset-white" : ""}
            data-help-id="emission-management-input"
            actions={(
              <MemberButton onClick={() => openElementDefinitionByHelpId("emission-management-input")} type="button" variant="secondary">
                {en ? "Open element definition" : "요소 정의 열기"}
              </MemberButton>
            )}
            description={en ? "Enter numeric or text values for the loaded variables. Repeatable variables support row addition for summation formulas." : "불러온 변수에 숫자 또는 텍스트 값을 입력합니다. 반복 입력 변수는 Summation 계산을 위해 행 추가를 지원합니다."}
            status={sessionId > 0 ? `${en ? "Session" : "세션"} #${sessionId}` : (en ? "Draft" : "초안")}
            statusTone={sessionId > 0 ? "healthy" : "neutral"}
            title={en ? "Step 2. Input Workspace" : "2단계. 입력 작업공간"}
          >
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Summation Guide" : "Summation 입력 안내"}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-primary)]">
                {en
                  ? "Variables marked as Summation support line-by-line entry. Use Add row for repeated items, then run the calculation to see CO2 at the bottom."
                  : "Summation 변수로 표시된 항목은 여러 줄 입력이 가능합니다. 반복 항목은 행 추가로 입력하고, 계산 실행 후 하단에서 CO2 결과를 확인합니다."}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Major Classification" : "대분류"}</p>
                <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedMajorOption?.label || "-"}</p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Middle Classification" : "중분류"}</p>
                <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedMiddleOption?.label || "-"}</p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Small Classification" : "소분류"}</p>
                <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedClassificationMeta.smallName || "-"}</p>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">Tier</p>
                <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedTier > 0 ? `Tier ${selectedTier}` : "-"}</p>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {effectiveFormulaSummary ? (
                <section className="space-y-3">
                  <div className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-blue-50/95">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">
                          {appliedDefinitionDraft ? (en ? "Definition Formula" : "정의 기준 계산식") : (en ? "Document Formula" : "문서 기준 계산식")}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">
                          {appliedDefinitionDraft
                            ? (en ? "A published definition snapshot is currently driving the high-level formula and policy summary for this scope." : "현재 범위에서는 publish 된 정의 스냅샷이 상위 계산식과 정책 요약을 우선 반영합니다.")
                            : (en ? "Review the full formula here before entering values in the blocks below." : "아래 블록 입력 전에 전체 계산식을 여기서 먼저 확인합니다.")}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--kr-gov-blue)]">
                        {appliedDefinitionDraft ? (en ? "Definition-backed" : "정의 반영") : (en ? "Input context" : "입력 기준")}
                      </span>
                    </div>
                    <div className="mt-3 overflow-x-auto rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-3">
                      <div className="min-w-max">
                        <FormulaNotation active formula={stringOf(appliedDefinitionDraft?.formula) || tierGuideMap[selectedTier]?.formulaDisplay || effectiveFormulaSummary} />
                      </div>
                    </div>
                  </div>
                  {appliedDefinitionPolicies.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50/60 px-4 py-3">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-indigo-700">
                        {en ? "Sections" : "섹션"} {Array.isArray(appliedDefinitionDraft?.sections) ? appliedDefinitionDraft.sections.length : 0}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-violet-700">
                        {en ? "Variables" : "변수"} {Array.isArray(appliedDefinitionDraft?.variableDefinitions) ? appliedDefinitionDraft.variableDefinitions.length : 0}
                      </span>
                      {appliedDefinitionPolicies.map((policy) => (
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-blue)]" key={`workspace-policy-${policy}`}>{policy}</span>
                      ))}
                    </div>
                  ) : appliedDefinitionDraft ? (
                    <div className="mt-3 flex flex-wrap gap-2 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50/60 px-4 py-3">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-indigo-700">
                        {en ? "Sections" : "섹션"} {Array.isArray(appliedDefinitionDraft.sections) ? appliedDefinitionDraft.sections.length : 0}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-violet-700">
                        {en ? "Variables" : "변수"} {Array.isArray(appliedDefinitionDraft.variableDefinitions) ? appliedDefinitionDraft.variableDefinitions.length : 0}
                      </span>
                    </div>
                  ) : null}
                  {stringOf(appliedDefinitionDraft?.note) ? (
                    <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3">
                      <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(appliedDefinitionDraft.note)}</p>
                    </div>
                  ) : null}
                  {definitionFormulaPreview ? (
                    <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{en ? "Definition formula preview" : "정의 수식 실행 미리보기"}</p>
                          <p className="mt-1 text-xs leading-5 text-emerald-900">
                            {en
                              ? "This preview executes the saved formula tree against the current inputs before backend calculate."
                              : "이 미리보기는 백엔드 계산 전에 저장된 formulaTree를 현재 입력값으로 먼저 실행합니다."}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">
                          {Number.isFinite(definitionFormulaPreview.total) ? definitionFormulaPreview.total.toFixed(6) : (en ? "Invalid" : "계산 불가")}
                        </span>
                      </div>
                      <div className="mt-3 overflow-x-auto rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-3">
                        <div className="min-w-max">
                          <FormulaNotation active formula={definitionFormulaPreview.formula} />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2">
                        {definitionFormulaPreview.trace.map((entry, index) => (
                          <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-3 py-3" key={`definition-formula-trace-${index}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-bold text-[var(--kr-gov-text-primary)]">{entry.label}</p>
                              <span className="text-sm font-black text-emerald-700">{Number.isFinite(entry.result) ? entry.result.toFixed(6) : "NaN"}</span>
                            </div>
                            <div className="mt-1">
                              <FormulaNotation compact formula={entry.expression} />
                            </div>
                            {entry.note ? <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{entry.note}</p> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
              <div>
                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Formula workflow" : "수식 진행 워크플로우"}</p>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                    {en ? "Activate one formula block at a time and move with Prev or Next." : "수식 블록을 하나씩 활성화하고 Prev/Next로 이동합니다."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variableSections.map((section, sectionIndex) => {
                    const completion = sectionCompletion(section.id);
                    const active = sectionIndex === activeFormulaStep;
                    return (
                      <button
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                          active
                            ? "border-[var(--kr-gov-blue)] bg-blue-50 text-[var(--kr-gov-blue)]"
                            : completion.complete
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-secondary)]"
                        }`}
                        key={`${section.id}-step`}
                        onClick={() => setActiveFormulaStep(sectionIndex)}
                        type="button"
                      >
                        {sectionIndex + 1}. {section.title}
                        {section.codes.length === 0 ? ` · ${en ? "structure" : "구조만"}` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
              {variableSections[activeFormulaStep] ? (
                <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{variableSections[activeFormulaStep].title}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{variableSections[activeFormulaStep].description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MemberButton
                        disabled={activeFormulaStep <= 0}
                        onClick={() => moveFormulaStep("prev")}
                        type="button"
                        variant="secondary"
                      >
                        {en ? "Prev" : "이전"}
                      </MemberButton>
                      <MemberButton
                        disabled={activeFormulaStep >= variableSections.length - 1}
                        onClick={() => moveFormulaStep("next")}
                        type="button"
                        variant="secondary"
                      >
                        {en ? "Next" : "다음"}
                      </MemberButton>
                    </div>
                  </div>
                  {variableSections[activeFormulaStep].formula ? (
                    <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Active formula notation" : "활성 수식 표기"}</p>
                      <div className="mt-3">
                        <FormulaNotation active formula={variableSections[activeFormulaStep].formula} highlightedTokens={sectionHighlightedTokens(variableSections[activeFormulaStep].id)} />
                      </div>
                      {sectionFormulaMappings(variableSections[activeFormulaStep].id).length > 0 ? (
                        <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Formula term mapping" : "수식 항 매핑"}</p>
                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {sectionFormulaMappings(variableSections[activeFormulaStep].id).map((item) => (
                              <button
                                className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-3 py-3 text-left transition hover:border-amber-300 hover:bg-amber-50"
                                key={`${variableSections[activeFormulaStep].id}-${item.code}`}
                                onBlur={() => setHoveredFormulaToken("")}
                                onFocus={() => setHoveredFormulaToken(item.code)}
                                onMouseEnter={() => setHoveredFormulaToken(item.code)}
                                onMouseLeave={() => setHoveredFormulaToken("")}
                                type="button"
                              >
                                <FormulaNotation compact formula={item.code} highlightedTokens={sectionHighlightedTokens(variableSections[activeFormulaStep].id)} />
                                <p className="mt-1 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{item.name}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {activeSectionPreviewCards().length > 0 ? (
                        <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Calculated result under formula" : "수식 바로 아래 계산 결과"}</p>
                          <div className="mt-3 space-y-2">
                            {activeSectionPreviewCards().map((previewCard) => (
                              <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-3 py-3" key={`active-inline-${previewCard.title}`}>
                                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{previewCard.title}</p>
                                <p className="mt-1 text-sm font-black text-[var(--kr-gov-blue)]">{previewCard.emphasis}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
                <div className="mt-4 space-y-5">
                  {variableSections[activeFormulaStep] ? renderFormulaSection(variableSections[activeFormulaStep], activeFormulaStep) : null}
                  {variableSections
                    .map((section, sectionIndex) => ({ section, sectionIndex }))
                    .filter(({ sectionIndex }) => sectionIndex !== activeFormulaStep)
                    .map(({ section, sectionIndex }) => renderFormulaSection(section, sectionIndex))}
                  {visibleVariables.length === 0 ? <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Variable inputs will appear here after a scope is selected." : "범위를 선택하면 여기에 변수 입력 항목이 나타납니다."}</p> : null}
                </div>

                <MemberActionBar
                  dataHelpId="emission-management-actions"
                  description={en ? "Save the current input values into a session when you need a persistent work item. Run calculation always saves the latest on-screen inputs first, then calculates with that newest session." : "지속적인 작업 항목이 필요하면 현재 입력값을 세션으로 저장하세요. 계산 실행은 항상 현재 화면 입력값을 먼저 저장한 뒤, 그 최신 세션으로 계산합니다."}
                  eyebrow={en ? "Execution" : "실행"}
                  secondary={{
                    label: saving ? (en ? "Saving..." : "저장 중...") : (en ? "Save session" : "세션 저장"),
                    disabled: saving || calculating || visibleVariables.length === 0 || !canExecuteSessionActions,
                    onClick: () => {
                      void handleSave();
                    }
                  }}
                  primary={(
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <MemberButton
                        disabled={saving || calculating || selectedCategoryId <= 0 || selectedTier <= 0 || variables.length === 0 || !canExecuteSessionActions}
                        onClick={() => {
                          resetCurrentDraft();
                        }}
                        type="button"
                        variant="secondary"
                      >
                        {en ? "Reset draft" : "입력 초기화"}
                      </MemberButton>
                      <MemberButton
                        disabled={saving || calculating || !canExecuteSessionActions}
                        onClick={() => {
                          setWizardStep(1);
                        }}
                        type="button"
                        variant="secondary"
                      >
                        {en ? "Change selection" : "선택 변경"}
                      </MemberButton>
                      <MemberButton disabled={saving || calculating || visibleVariables.length === 0 || !canExecuteSessionActions} onClick={() => void handleCalculate()} type="button">
                        {calculating ? (en ? "Calculating..." : "계산 중...") : (en ? "Run calculation" : "계산 실행")}
                      </MemberButton>
                    </div>
                  )}
                  title={en ? "Session Save And Calculation" : "세션 저장 및 계산"}
                />
              </div>
            </div>
          </DiagnosticCard>
          </div>
        </div>
        ) : null}

        <DiagnosticCard
          className={highlightedHelpId === "emission-management-result" ? "ring-2 ring-[var(--kr-gov-blue)] ring-offset-4 ring-offset-white" : ""}
          data-help-id="emission-management-result"
          actions={(
            <MemberButton onClick={() => openElementDefinitionByHelpId("emission-management-result")} type="button" variant="secondary">
              {en ? "Open element definition" : "요소 정의 열기"}
            </MemberButton>
          )}
          description={en ? "The lower result area updates after calculation on step 2." : "2단계에서 계산을 실행하면 하단 결과 영역이 갱신됩니다."}
          status={calculationResult ? (en ? "Latest result" : "최신 결과") : (en ? "No result" : "결과 없음")}
          statusTone={calculationResult ? "healthy" : "neutral"}
          title={en ? "Calculation Result" : "계산 결과"}
        >
          {calculationResult ? (
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-4 lg:self-start">
                <div className="space-y-4 lg:sticky lg:top-24 lg:z-10">
                  <div className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-blue-50/95">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">
                      {stringOf(calculationResult.calculationSource) === "PUBLISHED_DEFINITION"
                        ? (en ? "Published Formula" : "publish 기준 계산식")
                        : (en ? "Document Formula" : "문서 기준 계산식")}
                    </p>
                    <div className="mt-2">
                      <FormulaNotation active formula={stringOf(calculationResult.formulaDisplay || calculationResult.formulaSummary) || "-"} />
                    </div>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-emerald-50/95">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                      {stringOf(calculationResult.calculationSource) === "PUBLISHED_DEFINITION"
                        ? (en ? "Published Runtime Trace" : "publish 런타임 추적")
                        : (en ? "Actual Calculation" : "실제 계산식")}
                    </p>
                    <div className="mt-2">
                      <FormulaNotation active formula={stringOf(calculationResult.substitutedFormula) || "-"} />
                    </div>
                  </div>
                </div>
                <SummaryMetricCard
                  accentClassName="text-pink-700"
                  surfaceClassName="bg-pink-50"
                  title={en ? "Total Emission" : "총 배출량"}
                  value={`${stringOf(calculationResult.co2Total)} ${displayUnitLabel(stringOf(calculationResult.unit) || "tCO2", en)}`}
                  description={documentFormulaText(stringOf(calculationResult.formulaDisplay || calculationResult.formulaSummary))}
                />
                <div
                  className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${
                    Boolean(calculationResult.definitionFormulaAdopted)
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wide ${
                        Boolean(calculationResult.definitionFormulaAdopted) ? "text-[var(--kr-gov-blue)]" : "text-[var(--kr-gov-text-secondary)]"
                      }`}>
                        {en ? "Runtime adoption" : "런타임 채택 상태"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                        {Boolean(calculationResult.definitionFormulaAdopted)
                          ? (en ? "This result adopted the definition formula output because the parity check is READY." : "이 결과는 parity check가 READY여서 definition formula 결과를 채택했습니다.")
                          : (en ? "This result still uses the legacy calculator output." : "이 결과는 아직 기존 계산기 결과를 사용합니다.")}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-black ${
                      Boolean(calculationResult.definitionFormulaAdopted)
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      {Boolean(calculationResult.definitionFormulaAdopted)
                        ? (en ? "Definition adopted" : "정의 수식 채택")
                        : (en ? "Legacy active" : "기존 계산기 사용")}
                    </span>
                  </div>
                </div>
                <div
                  className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${
                    supplementCount > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wide ${supplementCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                        {en ? "Supplement Summary" : "보완 적용 요약"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                        {en
                          ? "Only formula terms with defined defaults or stored coefficients are counted here."
                          : "정의된 기본 계수 또는 저장 계수로 보완된 수식 항만 집계합니다."}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-black ${
                        supplementCount > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {supplementCount > 0 ? (en ? `${supplementCount} supplemented` : `보완 ${supplementCount}건`) : (en ? "No supplement" : "보완 없음")}
                    </span>
                  </div>
                </div>
                <SummaryMetricCard
                  title={en ? "Fallback/Stored Supplement Used" : "기본 계수/저장 계수 보완 사용 여부"}
                  value={Boolean(calculationResult.defaultApplied) ? (en ? "Used" : "사용함") : (en ? "Not used" : "사용 안 함")}
                  description={en ? "Shows whether any formula term with a defined default or stored coefficient was supplemented during calculation." : "기본값이 정의된 수식 항에 한해 기본 계수 또는 저장 계수 보완이 적용되었는지 표시합니다."}
                />
                {calculationResult.definitionFormulaComparison ? (
                  <div
                    className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${
                      Boolean((calculationResult.definitionFormulaComparison as Record<string, unknown>).matched)
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-wide ${
                          Boolean((calculationResult.definitionFormulaComparison as Record<string, unknown>).matched)
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }`}>
                          {en ? "Definition parity" : "정의 수식 일치 여부"}
                        </p>
                        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                          {en
                            ? "Compares legacy calculator output with the definition formula preview evaluated during the same request."
                            : "같은 요청에서 평가한 기존 계산기 결과와 definition formula preview 결과를 비교합니다."}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-sm font-black ${
                        Boolean((calculationResult.definitionFormulaComparison as Record<string, unknown>).matched)
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {Boolean((calculationResult.definitionFormulaComparison as Record<string, unknown>).matched)
                          ? (en ? "Matched" : "일치")
                          : (en ? "Different" : "차이 있음")}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-sm font-black ${
                        ["READY", "PRIMARY_READY"].includes(stringOf((calculationResult.definitionFormulaComparison as Record<string, unknown>).promotionStatus))
                          ? "bg-blue-100 text-blue-800"
                          : stringOf((calculationResult.definitionFormulaComparison as Record<string, unknown>).promotionStatus) === "BLOCKED"
                            ? "bg-rose-100 text-rose-800"
                            : stringOf((calculationResult.definitionFormulaComparison as Record<string, unknown>).promotionStatus) === "PRIMARY_WITH_DRIFT"
                              ? "bg-violet-100 text-violet-800"
                            : "bg-slate-100 text-slate-800"
                      }`}>
                        {stringOf((calculationResult.definitionFormulaComparison as Record<string, unknown>).promotionStatus) === "READY"
                          ? (en ? "Ready to switch" : "치환 가능")
                          : stringOf((calculationResult.definitionFormulaComparison as Record<string, unknown>).promotionStatus) === "PRIMARY_READY"
                            ? (en ? "Primary runtime" : "우선 실행")
                          : stringOf((calculationResult.definitionFormulaComparison as Record<string, unknown>).promotionStatus) === "BLOCKED"
                            ? (en ? "Blocked" : "치환 보류")
                            : stringOf((calculationResult.definitionFormulaComparison as Record<string, unknown>).promotionStatus) === "PRIMARY_WITH_DRIFT"
                              ? (en ? "Primary with drift" : "우선 실행(차이 있음)")
                            : (en ? "Shadow only" : "비교만")}
                      </span>
                    </div>
                    {stringOf((calculationResult.definitionFormulaComparison as Record<string, unknown>).promotionMessage) ? (
                      <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                        {stringOf((calculationResult.definitionFormulaComparison as Record<string, unknown>).promotionMessage)}
                      </p>
                    ) : null}
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Legacy total" : "기존 계산기 결과"}</p>
                        <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">{numberOf((calculationResult.definitionFormulaComparison as Record<string, unknown>).legacyTotal).toFixed(6)}</p>
                      </div>
                      <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Definition total" : "정의 수식 결과"}</p>
                        <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">{numberOf((calculationResult.definitionFormulaComparison as Record<string, unknown>).definitionTotal).toFixed(6)}</p>
                      </div>
                      <div className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Delta" : "차이"}</p>
                        <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">{numberOf((calculationResult.definitionFormulaComparison as Record<string, unknown>).delta).toFixed(6)}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="space-y-4">
                <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  {calculationResult.definitionFormulaPreview ? (
                    <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-teal-200 bg-teal-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{en ? "Server definition formula preview" : "서버 정의 수식 실행 미리보기"}</p>
                          <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                            {en
                              ? "This trace was evaluated on the backend during calculate and stored with the result snapshot."
                              : "이 trace는 calculate 시점에 백엔드에서 평가되어 결과 snapshot과 함께 저장되었습니다."}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-teal-700">
                          {Number.isFinite(numberOf((calculationResult.definitionFormulaPreview as Record<string, unknown>).total))
                            ? numberOf((calculationResult.definitionFormulaPreview as Record<string, unknown>).total).toFixed(6)
                            : (en ? "Invalid" : "계산 불가")}
                        </span>
                      </div>
                      <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-white bg-white px-3 py-3">
                        <FormulaNotation active formula={stringOf((calculationResult.definitionFormulaPreview as Record<string, unknown>).formula) || "-"} />
                      </div>
                      <div className="mt-3 space-y-3">
                        {arrayOf<Record<string, unknown>>((calculationResult.definitionFormulaPreview as Record<string, unknown>).trace).map((entry, index) => (
                          <article className="rounded-[var(--kr-gov-radius)] border border-white bg-white px-4 py-4 shadow-sm" key={`server-definition-trace-${index}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(entry.label) || "-"}</p>
                              <div className="rounded-[var(--kr-gov-radius)] border border-teal-200 bg-teal-50 px-3 py-2 text-right">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">{en ? "Result" : "결과"}</p>
                                <p className="mt-1 text-sm font-black text-teal-800">{Number.isFinite(numberOf(entry.result)) ? numberOf(entry.result).toFixed(6) : "NaN"}</p>
                              </div>
                            </div>
                            <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Expression" : "식"}</p>
                              <div className="mt-2">
                                <FormulaNotation compact formula={stringOf(entry.expression)} />
                              </div>
                            </div>
                            {stringOf(entry.note) ? (
                              <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-3 py-3">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">{en ? "Note" : "비고"}</p>
                                <p className="mt-2 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{stringOf(entry.note)}</p>
                              </div>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Calculation Log" : "계산 로그"}</p>
                  <div className="mt-3 space-y-3">
                    {arrayOf<Record<string, unknown>>(calculationResult.calculationLogs).map((log, index) => (
                      <article className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-4 shadow-sm" key={`calc-log-${index}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                                {en ? "Step" : "단계"} {index + 1}
                              </span>
                              {numberOf(log.lineNo) > 0 ? (
                                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-[var(--kr-gov-blue)]">
                                  {en ? "Line" : "라인"} {numberOf(log.lineNo)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(log.label) || (en ? "Step" : "단계")}</p>
                          </div>
                          <div className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-right">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">{en ? "Result" : "결과"}</p>
                            <p className="mt-1 text-sm font-black text-emerald-800">{stringOf(log.result) || "0"}</p>
                          </div>
                        </div>
                        {stringOf(log.formula) ? (
                          <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Formula" : "수식"}</p>
                            <div className="mt-2">
                              <FormulaNotation compact formula={stringOf(log.formula)} />
                            </div>
                          </div>
                        ) : null}
                        {stringOf(log.substituted) ? (
                          <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-3 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">{en ? "Substituted values" : "값 대입식"}</p>
                            <div className="mt-2">
                              <FormulaNotation active compact formula={stringOf(log.substituted)} />
                            </div>
                          </div>
                        ) : null}
                        {stringOf(log.note) ? (
                          <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-3 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">{en ? "Note" : "비고"}</p>
                            <p className="mt-2 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{presentCalculationText(stringOf(log.note), en)}</p>
                          </div>
                        ) : null}
                      </article>
                    ))}
                    {arrayOf(calculationResult.calculationLogs).length === 0 ? (
                      <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No calculation steps were returned." : "계산 단계 로그가 없습니다."}</p>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">{en ? "Applied Factors" : "적용 계수"}</p>
                      <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                        {en
                          ? "Review the factors applied during calculation, including any default or stored supplement that replaced direct input."
                          : "계산에 적용된 계수를 확인합니다. 직접 입력 대신 기본 계수 또는 저장 계수 보완이 사용된 경우 여기서 함께 표시합니다."}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-black ${supplementCount > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {supplementCount > 0 ? (en ? `${supplementCount} supplemented` : `보완 ${supplementCount}건`) : (en ? "No supplement" : "보완 없음")}
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {arrayOf<Record<string, unknown>>(calculationResult.appliedFactors).map((factor, index) => (
                      <div
                        className={`rounded-[var(--kr-gov-radius)] border px-4 py-3 ${
                          Boolean(factor.defaultApplied) ? "border-amber-200 bg-amber-50/70" : "border-white bg-white"
                        }`}
                        key={`factor-${index}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{appliedFactorLabel(factor, en)}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{appliedFactorContext(factor, en)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[var(--kr-gov-blue)]">{stringOf(factor.factorValue) || "-"}</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${Boolean(factor.defaultApplied) ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {appliedFactorSourceBadge(factor, en)}
                            </span>
                          </div>
                        </div>
                        {Boolean(factor.defaultApplied) ? (
                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                            <p className="rounded-[var(--kr-gov-radius)] bg-white/80 px-3 py-2 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">
                              {en
                                ? "This term was completed with a defined default, stored coefficient, or mapped fallback because direct input was unavailable."
                                : "직접 입력값이 없어 정의된 기본 계수, 저장 계수 또는 매핑 fallback 값으로 이 항목을 보완해 계산했습니다."}
                            </p>
                            <span className="inline-flex items-center justify-center rounded-[var(--kr-gov-radius)] border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-700">
                              {en ? "Supplement used" : "보완 적용"}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {arrayOf(calculationResult.appliedFactors).length === 0 ? (
                      <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No factor list was returned." : "적용 계수 목록이 없습니다."}</p>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Run a calculation to inspect the saved result." : "계산을 실행하면 저장된 결과를 여기서 확인할 수 있습니다."}</p>
          )}
        </DiagnosticCard>
      </AdminWorkspacePageFrame>
      {activityFeedOverlayOpen && selectedScopeActivityFeed.length > 0 ? (
        <div
          aria-labelledby="scope-activity-feed-title"
          aria-modal="true"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-[2px]"
          onClick={() => {
            setActivityFeedOverlayOpen(false);
          }}
          role="dialog"
        >
          <div
            className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[calc(var(--kr-gov-radius)*1.2)] border border-[var(--kr-gov-border-light)] bg-white shadow-2xl"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--kr-gov-border-light)] bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--kr-gov-blue)]">
                  {en ? "Scope activity history" : "scope 활동 이력"}
                </p>
                <h2 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]" id="scope-activity-feed-title">
                  {stringOf(selectedScopeStatus?.scope) || (en ? "Selected scope" : "선택된 scope")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Review the recent publish, materialization, runtime transition, and verification evidence for this scope."
                    : "이 scope의 publish, 메타 반영, 런타임 전환, 검증 증적을 최근 순서대로 확인합니다."}
                </p>
              </div>
              <MemberButton
                onClick={() => {
                  setActivityFeedOverlayOpen(false);
                }}
                type="button"
                variant="secondary"
              >
                {en ? "Close" : "닫기"}
              </MemberButton>
            </div>
            <div className="max-h-[calc(85vh-8rem)] overflow-y-auto px-5 py-5">
              <div className="space-y-3">
                {selectedScopeActivityFeed.map((item) => (
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4" key={`selected-scope-activity-overlay-${item.key}-${item.at}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className={`text-xs font-bold uppercase tracking-wide ${
                          item.tone === "blue"
                            ? "text-[var(--kr-gov-blue)]"
                            : item.tone === "indigo"
                              ? "text-indigo-700"
                              : "text-emerald-700"
                        }`}
                      >
                        {item.title}
                      </p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700">
                        {item.at}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{item.detail}</p>
                    {stringOf(item.message) && stringOf(item.message) !== stringOf(item.detail) ? (
                      <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-white bg-white px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--kr-gov-text-secondary)]">
                          {en ? "Recorded note" : "기록 메모"}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{stringOf(item.message)}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageShell>
  );
}
