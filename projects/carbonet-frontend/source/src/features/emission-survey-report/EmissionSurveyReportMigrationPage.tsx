import React, { useEffect, useMemo, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchSurveyEcoinventAiRecommendationPage, fetchSurveyMaterialEnglishNames } from "../../lib/api/emission";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice, WarningPanel } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminSelect, MemberButton, MemberButtonGroup } from "../member/common";
import {
  loadEmissionSurveyReportSession,
  type EmissionSurveyReportPayload,
  type EmissionSurveyReportRow,
  type EmissionSurveyReportSectionSummary
} from "./reportSession";

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
}

function formatPercent(value: number, digits = 1) {
  return `${formatNumber(value, digits)}%`;
}

function parseEditableNumber(value: string) {
  const normalized = value.replace(/[^0-9.\-]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuantityText(value: number, unit?: string) {
  return `${formatNumber(value, 6)} ${unit || ""}`.trim();
}

function recalculateRowEmission(row: EmissionSurveyReportRow) {
  const totalEmission = Math.max(row.amount || 0, 0) * Math.max(row.emissionFactor || 0, 0);
  return {
    ...row,
    totalEmission,
    calculated: row.calculated || (row.amount > 0 && row.emissionFactor > 0)
  };
}

function sectionSolidColor(index: number) {
  const palette = ["#0f172a", "#059669", "#0284c7", "#f59e0b", "#7c3aed", "#e11d48", "#2563eb", "#64748b"];
  return palette[index % palette.length];
}

function buildSectionGroups(rows: EmissionSurveyReportRow[]) {
  const map = new Map<string, { sectionLabel: string; rows: EmissionSurveyReportRow[] }>();
  rows.forEach((row) => {
    const current = map.get(row.sectionCode);
    if (current) {
      current.rows.push(row);
      return;
    }
    map.set(row.sectionCode, {
      sectionLabel: row.sectionLabel,
      rows: [row]
    });
  });
  return Array.from(map.entries()).map(([sectionCode, value]) => ({
    sectionCode,
    sectionLabel: value.sectionLabel,
    rows: value.rows
  }));
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function describeDonutSlice(cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number) {
  const safeEndAngle = Math.min(endAngle, startAngle + 359.99);
  const outerStart = polarToCartesian(cx, cy, outerRadius, safeEndAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, safeEndAngle);
  const largeArcFlag = safeEndAngle - startAngle <= 180 ? "0" : "1";
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z"
  ].join(" ");
}

function buildPieSlices(sections: EmissionSurveyReportSectionSummary[]) {
  const totalShare = sections.reduce((sum, section) => sum + Math.max(section.sharePercent, 0), 0);
  let cursor = 0;
  return sections.map((section, index) => {
    const share = totalShare > 0 ? Math.max(section.sharePercent, 0) / totalShare : 0;
    const startAngle = cursor * 360;
    cursor += share;
    const endAngle = cursor * 360;
    return {
      color: sectionSolidColor(index),
      d: describeDonutSlice(110, 110, 104, 50, startAngle, endAngle),
      key: section.sectionCode
    };
  });
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function copySvgToClipboard(svg: string) {
  const image = new Image();
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.width || 900;
    canvas.height = image.height || 520;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context is not available.");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Chart image could not be created.")), "image/png");
    });
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildSectionBarChartSvg(sections: EmissionSurveyReportSectionSummary[], en: boolean) {
  const width = 900;
  const rowHeight = 58;
  const height = Math.max(260, 120 + sections.length * rowHeight);
  const maxEmission = Math.max(...sections.map((section) => section.totalEmission), 1);
  const rows = sections.map((section, index) => {
    const y = 92 + index * rowHeight;
    const barWidth = Math.max(8, (Math.max(section.totalEmission, 0) / maxEmission) * 520);
    const label = escapeSvgText(sectionLabel(section.sectionCode, section.sectionLabel, en));
    return `
      <text x="44" y="${y}" fill="#0f172a" font-size="17" font-weight="800">${label}</text>
      <text x="856" y="${y}" fill="#0f172a" font-size="15" font-weight="800" text-anchor="end">${escapeSvgText(formatNumber(section.totalEmission))} kg CO2e</text>
      <rect x="44" y="${y + 14}" width="620" height="12" rx="6" fill="#eef2f7"/>
      <rect x="44" y="${y + 14}" width="${barWidth}" height="12" rx="6" fill="${sectionSolidColor(index)}"/>
      <text x="856" y="${y + 27}" fill="#64748b" font-size="13" font-weight="700" text-anchor="end">${escapeSvgText(formatPercent(section.sharePercent))}</text>
    `;
  }).join("");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" rx="28" fill="#ffffff"/>
      <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="24" fill="#f8fafc" stroke="#d8e0ea"/>
      <text x="44" y="58" fill="#0f172a" font-size="24" font-weight="900">${en ? "Section Contribution Bars" : "섹션별 탄소배출 기여 그래프"}</text>
      ${rows}
    </svg>
  `;
}

function buildSectionPieChartSvg(sections: EmissionSurveyReportSectionSummary[], en: boolean) {
  const width = 900;
  const height = 520;
  const slices = buildPieSlices(sections).map((slice) => (
    `<path d="${slice.d}" fill="${slice.color}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>`
  )).join("");
  const legend = sections.map((section, index) => {
    const y = 126 + index * 42;
    return `
      <rect x="492" y="${y - 14}" width="352" height="30" rx="10" fill="#f8fafc"/>
      <circle cx="512" cy="${y}" r="6" fill="${sectionSolidColor(index)}"/>
      <text x="528" y="${y + 5}" fill="#334155" font-size="13" font-weight="800">${escapeSvgText(sectionLabel(section.sectionCode, section.sectionLabel, en))}</text>
      <text x="828" y="${y + 5}" fill="#0f172a" font-size="13" font-weight="900" text-anchor="end">${escapeSvgText(formatPercent(section.sharePercent))}</text>
    `;
  }).join("");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" rx="28" fill="#ffffff"/>
      <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="24" fill="#ffffff" stroke="#d8e0ea"/>
      <text x="44" y="62" fill="#0f172a" font-size="24" font-weight="900">${en ? "Section Contribution Pie" : "섹션별 탄소배출 기여 원그래프"}</text>
      <g transform="translate(120 120)">${slices}<circle cx="110" cy="110" r="50" fill="#fff" stroke="#e2e8f0"/><text x="110" y="104" text-anchor="middle" fill="#64748b" font-size="11" font-weight="900">${en ? "TOTAL" : "합계"}</text><text x="110" y="130" text-anchor="middle" fill="#0f172a" font-size="22" font-weight="900">100%</text></g>
      ${legend}
    </svg>
  `;
}

function buildOutputNormalizationRows(rows: EmissionSurveyReportRow[]) {
  return rows.filter((row) => row.sectionCode === "OUTPUT_PRODUCTS" && row.originalAmount > 0);
}

function outputMassShare(row: EmissionSurveyReportRow, outputQuantityTotal: number) {
  return outputQuantityTotal > 0 ? row.originalAmount / outputQuantityTotal : 0;
}

function outputNormalizedEmission(row: EmissionSurveyReportRow, totalEmission: number, outputQuantityTotal: number) {
  return totalEmission * outputMassShare(row, outputQuantityTotal);
}

function normalizeReportSectionShares(report: EmissionSurveyReportPayload) {
  const total = report.sectionSummaries.reduce((sum, section) => sum + Math.max(section.totalEmission || 0, 0), 0);
  return {
    ...report,
    summary: {
      ...report.summary,
      totalEmission: total
    },
    sectionSummaries: report.sectionSummaries.map((section) => ({
      ...section,
      sharePercent: total > 0 ? (Math.max(section.totalEmission || 0, 0) / total) * 100 : 0
    }))
  };
}

function syncOutputMassTotals(report: EmissionSurveyReportPayload, factor = report.normalization?.factor || 1) {
  const outputRows = buildOutputNormalizationRows(report.rows || []);
  const outputQuantityTotal = outputRows.reduce((sum, row) => sum + Math.max(row.originalAmount || 0, 0), 0);
  return {
    ...report,
    normalization: {
      ...report.normalization,
      outputQuantityTotal,
      factor,
      applied: report.normalization?.applied || factor !== 1
    }
  };
}

function scaleReportTotal(report: EmissionSurveyReportPayload, nextTotalEmission: number) {
  const currentTotal = report.sectionSummaries.reduce((sum, section) => sum + Math.max(section.totalEmission || 0, 0), 0);
  if (currentTotal <= 0) {
    const shareTotal = report.sectionSummaries.reduce((sum, section) => sum + Math.max(section.sharePercent || 0, 0), 0);
    const equalShare = report.sectionSummaries.length > 0 ? 1 / report.sectionSummaries.length : 0;
    const nextSections = report.sectionSummaries.map((section) => {
      const sectionShare = shareTotal > 0 ? Math.max(section.sharePercent || 0, 0) / shareTotal : equalShare;
      return {
        ...section,
        totalEmission: nextTotalEmission * sectionShare
      };
    });
    return normalizeReportSectionShares({
      ...report,
      summary: {
        ...report.summary,
        totalEmission: nextTotalEmission
      },
      sectionSummaries: nextSections
    });
  }
  if (nextTotalEmission <= 0) {
    return {
      ...report,
      summary: {
        ...report.summary,
        totalEmission: nextTotalEmission
      },
      sectionSummaries: report.sectionSummaries.map((section) => ({
        ...section,
        totalEmission: 0
      }))
    };
  }
  return normalizeReportSectionShares({
    ...report,
    summary: {
      ...report.summary,
      totalEmission: nextTotalEmission
    },
    sectionSummaries: report.sectionSummaries.map((section) => ({
      ...section,
      totalEmission: (Math.max(section.totalEmission || 0, 0) / currentTotal) * nextTotalEmission
    }))
  });
}

function syncReportFromRows(report: EmissionSurveyReportPayload) {
  const nextSections = report.sectionSummaries.map((section) => ({
    ...section,
    totalEmission: report.rows
      .filter((row) => row.sectionCode === section.sectionCode && row.calculated && row.sectionCode !== "OUTPUT_PRODUCTS")
      .reduce((sum, row) => sum + Math.max(row.totalEmission || 0, 0), 0)
  }));
  return normalizeReportSectionShares({ ...report, sectionSummaries: nextSections });
}

function redistributeRowsBySectionEmission(
  rows: EmissionSurveyReportRow[],
  sectionCode: string,
  nextSectionEmission: number,
  factor = 1
) {
  const sectionRows = rows.filter((row) => row.sectionCode === sectionCode && row.calculated && row.sectionCode !== "OUTPUT_PRODUCTS");
  if (sectionRows.length === 0) {
    return rows;
  }
  const currentSectionEmission = sectionRows.reduce((sum, row) => sum + Math.max(row.totalEmission || 0, 0), 0);
  const equalShare = sectionRows.length > 0 ? 1 / sectionRows.length : 0;
  return rows.map((row) => {
    if (row.sectionCode !== sectionCode || !row.calculated || row.sectionCode === "OUTPUT_PRODUCTS") {
      return row;
    }
    const rowShare = currentSectionEmission > 0 ? Math.max(row.totalEmission || 0, 0) / currentSectionEmission : equalShare;
    const nextRowEmission = nextSectionEmission * rowShare;
    const nextAmount = row.emissionFactor > 0 ? nextRowEmission / row.emissionFactor : row.amount;
    const nextOriginalAmount = factor > 0 ? nextAmount / factor : nextAmount;
    return {
      ...row,
      amount: nextAmount,
      amountText: formatQuantityText(nextAmount, row.unit),
      originalAmount: nextOriginalAmount,
      originalAmountText: formatQuantityText(nextOriginalAmount, row.unit),
      totalEmission: nextRowEmission
    };
  });
}

function outputMassUnitLabel(rows: EmissionSurveyReportRow[], en: boolean) {
  const units = Array.from(new Set(rows.map((row) => row.unit || "").filter(Boolean)));
  if (units.length === 0) {
    return "";
  }
  return units.length === 1 ? units[0] : (en ? "mixed units" : "혼합 단위");
}

function sumOriginalMass(rows: EmissionSurveyReportRow[]) {
  return rows.reduce((sum, row) => sum + Math.max(row.originalAmount || 0, 0), 0);
}

function sumNormalizedMass(rows: EmissionSurveyReportRow[]) {
  return rows.reduce((sum, row) => sum + Math.max(row.amount || 0, 0), 0);
}

function defaultLcaSoftwareLabel() {
  return "Carbonet LCA Engine / ecoinvent API beta, ecoinvent v3.12 LCI DB, IPCC 2021 GWP100";
}

type EnglishMaterialNameMap = Record<string, string>;

const ENGLISH_MATERIAL_NAME_CACHE_KEY = "carbonet:survey-report:english-material-names:v1";
const SECTION_LABEL_EN: Record<string, string> = {
  OUTPUT_PRODUCTS: "Products And Byproducts",
  RAW_MATERIALS: "Raw And Auxiliary Materials",
  ENERGY: "Energy",
  PROCESS: "Process Emissions",
  TRANSPORT: "Transport",
  WASTE: "Waste",
  PACKAGING: "Packaging",
  WATER: "Water"
};
const KOREAN_LABEL_EN: Record<string, string> = {
  "원료 물질 및 보조 물질": "Raw And Auxiliary Materials",
  "출력 제품 및 부산물": "Products And Byproducts",
  "제품": "Product",
  "부산물": "Byproduct",
  "에너지": "Energy",
  "전기": "Electricity",
  "전력": "Electricity",
  "스팀": "Steam",
  "에너지 스팀": "Energy / Steam",
  "에너지/스팀": "Energy / Steam",
  "열": "Heat",
  "연료": "Fuel",
  "기타": "Other",
  "대기 배출물": "Air Emissions",
  "대기배출물": "Air Emissions",
  "대기 배출": "Air Emissions",
  "수계 배출물": "Water Emissions",
  "수계배출물": "Water Emissions",
  "수계 배출": "Water Emissions",
  "수질 배출물": "Water Emissions",
  "수질배출물": "Water Emissions",
  "용수": "Water",
  "공업용수": "Industrial Water",
  "폐수": "Wastewater",
  "폐기물": "Waste",
  "운송": "Transport",
  "수송": "Transport",
  "포장": "Packaging",
  "공정": "Process",
  "공정 배출": "Process Emissions",
  "직접 배출": "Direct Emissions",
  "간접 배출": "Indirect Emissions",
  "원료 물질": "Raw Material",
  "원료물질": "Raw Material",
  "원료": "Raw Material",
  "보조 물질": "Auxiliary Material",
  "보조물질": "Auxiliary Material",
  "보조재": "Auxiliary Material",
  "투입물": "Input",
  "출력물": "Output",
  "소분류 미선택": "Unselected Subcategory"
};

function looksKorean(value: string) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value);
}

function cleanEnglishMaterialName(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[「」“”"]/g, "")
    .trim();
}

function readEnglishMaterialNameCache(): EnglishMaterialNameMap {
  try {
    return JSON.parse(window.sessionStorage.getItem(ENGLISH_MATERIAL_NAME_CACHE_KEY) || "{}") as EnglishMaterialNameMap;
  } catch {
    return {};
  }
}

function writeEnglishMaterialNameCache(nextMap: EnglishMaterialNameMap) {
  window.sessionStorage.setItem(ENGLISH_MATERIAL_NAME_CACHE_KEY, JSON.stringify(nextMap));
}

function resolveEnglishMaterialName(originalName: string, englishNameMap: EnglishMaterialNameMap) {
  const name = cleanEnglishMaterialName(originalName);
  if (!name) {
    return "-";
  }
  if (KOREAN_LABEL_EN[name]) {
    return KOREAN_LABEL_EN[name];
  }
  if (!looksKorean(name)) {
    return name;
  }
  return englishNameMap[name] || name;
}

function sectionLabel(sectionCode: string, label: string, en: boolean) {
  if (!en) {
    return label;
  }
  return SECTION_LABEL_EN[sectionCode] || KOREAN_LABEL_EN[cleanEnglishMaterialName(label)] || label;
}

function groupLabel(row: EmissionSurveyReportRow, en: boolean) {
  const value = row.group || row.sectionLabel || "";
  if (!en) {
    return value || "-";
  }
  return KOREAN_LABEL_EN[cleanEnglishMaterialName(value)] || sectionLabel(row.sectionCode, value, true) || "-";
}

async function fetchEnglishMaterialName(originalName: string) {
  const response = await fetchSurveyEcoinventAiRecommendationPage({
    materialName: originalName,
    pageIndex: 1,
    pageSize: 1
  });
  const firstRow = Array.isArray(response.data) ? response.data[0] : undefined;
  const aiSearchTerm = cleanEnglishMaterialName(firstRow?.aiSearchTerm);
  const productName = cleanEnglishMaterialName(firstRow?.productName);
  const activityName = cleanEnglishMaterialName(firstRow?.activityName);
  return aiSearchTerm || productName || activityName || "";
}

function useEnglishMaterialNames(report: ReturnType<typeof loadEmissionSurveyReportSession>, en: boolean) {
  const [englishNameMap, setEnglishNameMap] = useState<EnglishMaterialNameMap>(() => readEnglishMaterialNameCache());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!en || !report) {
      return;
    }
    const cached = readEnglishMaterialNameCache();
    const rawNames = [
      report.productName,
      ...(report.rows || []).map((row) => row.materialName)
    ].map(cleanEnglishMaterialName);
    const materialNames = Array.from(new Set(rawNames.filter((name) => name && looksKorean(name) && !KOREAN_LABEL_EN[name])));
    const missingNames = materialNames.filter((name) => !cached[name]);
    if (missingNames.length === 0) {
      setEnglishNameMap(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchSurveyMaterialEnglishNames(missingNames)
      .then(async (dictionaryMap) => {
        if (cancelled) {
          return;
        }
        const nextMap = { ...readEnglishMaterialNameCache() };
        const stillMissing: string[] = [];
        missingNames.forEach((name) => {
          const dictionaryName = cleanEnglishMaterialName(dictionaryMap[name]);
          if (dictionaryName && !looksKorean(dictionaryName)) {
            nextMap[name] = dictionaryName;
          } else {
            stillMissing.push(name);
          }
        });
        if (stillMissing.length > 0) {
          const fallbackResults = await Promise.allSettled(
            stillMissing.map(async (name) => {
              const englishName = await fetchEnglishMaterialName(name);
              return [name, englishName] as const;
            })
          );
          fallbackResults.forEach((result) => {
            if (result.status !== "fulfilled") {
              return;
            }
            const [name, englishName] = result.value;
            if (englishName && !looksKorean(englishName)) {
              nextMap[name] = englishName;
            }
          });
        }
        const unresolvedNames = materialNames.filter((name) => looksKorean(resolveEnglishMaterialName(name, nextMap)));
        if (unresolvedNames.length > 0) {
          console.warn("[survey-report-print] unresolved Korean material names", unresolvedNames);
        } else {
          console.info("[survey-report-print] English material dictionary resolved", Object.keys(nextMap).length);
        }
        writeEnglishMaterialNameCache(nextMap);
        setEnglishNameMap(nextMap);
      })
      .catch(() => {
        return Promise.allSettled(
          missingNames.map(async (name) => {
            const englishName = await fetchEnglishMaterialName(name);
            return [name, englishName] as const;
          })
        ).then((results) => {
          if (cancelled) {
            return;
          }
          const nextMap = { ...readEnglishMaterialNameCache() };
          results.forEach((result) => {
            if (result.status !== "fulfilled") {
              return;
            }
            const [name, englishName] = result.value;
            if (englishName && !looksKorean(englishName)) {
              nextMap[name] = englishName;
            }
          });
          console.warn("[survey-report-print] English material dictionary API unavailable; used AI recommendation fallback");
          writeEnglishMaterialNameCache(nextMap);
          setEnglishNameMap(nextMap);
        });
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [en, report]);

  return { englishNameMap, loading };
}

export function EmissionSurveyReportMigrationPage() {
  const routeEn = isEnglish();
  const [printLanguageOpen, setPrintLanguageOpen] = useState(false);
  const [byproductAllocation, setByproductAllocation] = useState<"allocated" | "unallocated">("allocated");
  const en = routeEn;
  const report = loadEmissionSurveyReportSession();

  logGovernanceScope("PAGE", "emission-survey-report", {
    route: window.location.pathname,
    hasSessionPayload: Boolean(report),
    productName: report?.productName || ""
  });

  const chartSections = useMemo(
    () => (report?.sectionSummaries || []).filter((section) => section.totalEmission > 0),
    [report]
  );
  const sectionGroups = useMemo(
    () => buildSectionGroups(report?.rows || []),
    [report]
  );

  if (!report) {
    return (
      <AdminPageShell
        breadcrumbs={[
          { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
          { label: en ? "Emissions & Certification" : "배출/인증" },
          { label: en ? "Emission Survey Management" : "배출 설문 관리", href: buildLocalizedPath("/admin/emission/survey-admin", "/en/admin/emission/survey-admin") },
          { label: en ? "Carbon Report" : "탄소배출량 리포트" }
        ]}
        title={en ? "Carbon Emission Analysis Report" : "탄소배출량 분석 리포트"}
        subtitle={en ? "No calculated report session was found." : "계산 결과 세션을 찾지 못했습니다."}
      >
        <AdminWorkspacePageFrame>
          <PageStatusNotice tone="warning">
            {en
              ? "Open this page through the calculation button on the survey admin screen."
              : "배출 설문 관리 화면의 `실제 탄소배출량 계산` 버튼을 통해 이 페이지로 진입하세요."}
          </PageStatusNotice>
          <MemberButton onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-admin", "/en/admin/emission/survey-admin"))} type="button">
            {en ? "Back To Survey Admin" : "배출 설문 관리로 이동"}
          </MemberButton>
        </AdminWorkspacePageFrame>
      </AdminPageShell>
    );
  }

  const normalization = report.normalization || {
    outputQuantityTotal: 0,
    factor: 1,
    applied: false
  };
  const outputNormalizationRows = buildOutputNormalizationRows(report.rows || []);
  const maxChartEmission = Math.max(...chartSections.map((section) => section.totalEmission), 1);
  const outputMassUnit = outputMassUnitLabel(outputNormalizationRows, en);
  const handlePrintLanguage = (language: "ko" | "en") => {
    setPrintLanguageOpen(false);
    const target = language === "en"
      ? "/en/admin/emission/survey-report-print?lang=en"
      : "/admin/emission/survey-report-print?lang=ko";
    navigate(target);
  };
  const handleLcaSummaryPrint = () => {
    navigate(en ? "/en/admin/emission/survey-report-lca-summary?lang=en" : "/admin/emission/survey-report-lca-summary?lang=ko");
  };

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Emissions & Certification" : "배출/인증" },
        { label: en ? "Emission Survey Management" : "배출 설문 관리", href: buildLocalizedPath("/admin/emission/survey-admin", "/en/admin/emission/survey-admin") },
        { label: en ? "Carbon Report" : "탄소배출량 리포트" }
      ]}
      title={en ? "Carbon Emission Analysis Report" : "탄소배출량 분석 리포트"}
      subtitle={en ? "Manager report with charts, scenarios, and audit notes." : "그래프, 시나리오, 검증 메모를 함께 보여주는 관리자 리포트입니다."}
      actions={(
        <MemberButtonGroup>
          <MemberButton onClick={handleLcaSummaryPrint} type="button" variant="secondary">
            {en ? "LCA Summary Report" : "LCA요약보고서"}
          </MemberButton>
          <div className="relative">
            <MemberButton onClick={() => setPrintLanguageOpen((open) => !open)} type="button" variant="secondary">
              {en ? "Export PDF" : "PDF 출력"}
            </MemberButton>
            {printLanguageOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{en ? "Report Language" : "출력 언어 선택"}</p>
                </div>
                <button
                  className="block w-full px-4 py-3 text-left text-sm font-black text-slate-800 hover:bg-slate-50"
                  onClick={() => handlePrintLanguage("ko")}
                  type="button"
                >
                  한글 리포트 PDF
                </button>
                <button
                  className="block w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-black text-slate-800 hover:bg-slate-50"
                  onClick={() => handlePrintLanguage("en")}
                  type="button"
                >
                  English Report PDF
                </button>
              </div>
            ) : null}
          </div>
          <MemberButton onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-admin", "/en/admin/emission/survey-admin"))} type="button" variant="secondary">{en ? "Recalculate" : "다시 계산"}</MemberButton>
        </MemberButtonGroup>
      )}
    >
      <AdminWorkspacePageFrame>
        <section className="overflow-hidden rounded-[calc(var(--kr-gov-radius)+10px)] bg-[linear-gradient(135deg,#0f172a,#11284d_42%,#0f766e)] text-white shadow-[0_26px_60px_rgba(15,23,42,0.22)]">
          <div className="grid items-center gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.4fr)_380px] lg:px-8 lg:py-8">
            <div>
              <h1 className="text-4xl font-black tracking-[-0.04em] text-white lg:text-5xl">
                {report.productName || report.pageTitle}
              </h1>
            </div>
            <div className="flex items-stretch">
              <div className="w-full rounded-[calc(var(--kr-gov-radius)+4px)] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65">{en ? "Total Footprint" : "총 탄소배출량"}</p>
                <p className="mt-3 text-3xl font-black tracking-[-0.05em]">{formatNumber(report.summary.totalEmission)}</p>
                <p className="mt-1 text-xs text-white/70">kg CO2e</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6">
          <div className="space-y-6">
            <section className="rounded-[calc(var(--kr-gov-radius)+6px)] border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{en ? "Contribution Analysis" : "기여도 분석"}</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--kr-gov-text-primary)]">{en ? "Section Contribution Graph" : "섹션별 탄소배출 기여 그래프"}</h2>
                </div>
              </div>

              <div className="mt-6 rounded-[calc(var(--kr-gov-radius)+4px)] border border-amber-200 bg-amber-50/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">{en ? "Normalization Base" : "정규화 기준"}</p>
                    <h3 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">{en ? "Product And Byproduct Mass Basis" : "제품 및 부산물 질량 기준"}</h3>
                    <p className="mt-2 text-xs font-bold leading-5 text-amber-800">
                      {en
                        ? "Mass uses each row unit, and allocated emissions are shown in kg CO2e."
                        : "질량은 각 행의 입력 단위를 따르며, 배분 배출량 단위는 kg CO2e입니다."}
                    </p>
                  </div>
                  <div className="min-w-[160px] bg-white rounded-xl p-1 shadow-sm border border-amber-200">
                    <label className="block p-1">
                      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-amber-800">{en ? "Byproduct Allocation" : "부산물 할당 여부"}</span>
                      <AdminSelect
                        value={byproductAllocation}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setByproductAllocation(e.target.value as "allocated" | "unallocated")}
                      >
                        <option value="allocated">{en ? "Allocated" : "할당"}</option>
                        <option value="unallocated">{en ? "Unallocated" : "미할당"}</option>
                      </AdminSelect>
                    </label>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 rounded-[var(--kr-gov-radius)] border border-amber-100 bg-white/85 p-4 sm:grid-cols-3 xl:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">{en ? "Total Output Mass" : "총 산출물 질량"}</p>
                    <p className="mt-1 font-mono text-lg font-black text-slate-950">
                      {formatNumber(normalization.outputQuantityTotal, 6)}
                      {outputMassUnit ? <span className="ml-1 text-sm text-slate-500">{outputMassUnit}</span> : null}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">{en ? "Product GWP" : "제품 GWP"}</p>
                    <p className="mt-1 font-mono text-lg font-black text-slate-950">{formatNumber(outputNormalizationRows.length > 0 ? outputNormalizedEmission(outputNormalizationRows[0], report.summary.totalEmission, normalization.outputQuantityTotal) : 0, 6)}</p>
                    <p className="text-[10px] font-bold text-slate-400">kg CO2e/ton of {en ? (report.productName || "Product") : (report.productName || "제품")}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">{en ? "Process GWP" : "공정 GWP"}</p>
                    <p className="mt-1 font-mono text-lg font-black text-slate-950">{formatNumber(report.summary.totalEmission, 6)}</p>
                    <p className="text-[10px] font-bold text-slate-400">kg CO2e</p>
                  </div>
                </div>
                <section className="mt-5">
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">{en ? "Emission Detail" : "배출량 상세"}</p>
                      <h3 className="mt-1 text-xl font-black tracking-[-0.04em] text-slate-950">{en ? "Emissions By Product And Byproduct" : "제품 및 부산물 별 배출량"}</h3>
                    </div>
                  </div>
                  <PrintOutputAllocationTable
                    en={en}
                    outputQuantityTotal={normalization.outputQuantityTotal}
                    normalizationFactor={normalization.factor}
                    byproductAllocation={byproductAllocation}
                    rows={outputNormalizationRows}
                    totalEmission={report.summary.totalEmission}
                    productName={report.productName}
                  />
                </section>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[calc(var(--kr-gov-radius)+4px)] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--kr-gov-blue)]">{en ? "Existing View" : "기존 그래프"}</p>
                      <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-slate-950">{en ? "Section Contribution Bars" : "섹션별 탄소배출 기여 그래프"}</h3>
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    {chartSections.map((section, index) => {
                      const width = Math.max(4, (section.totalEmission / maxChartEmission) * 100);
                      return (
                        <div key={section.sectionCode}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-black text-slate-800">{sectionLabel(section.sectionCode, section.sectionLabel, en)}</span>
                            <span className="font-mono font-black text-slate-950">{formatNumber(section.totalEmission)} kg CO2e</span>
                          </div>
                          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white">
                            <div className="h-full rounded-full" style={{ backgroundColor: sectionSolidColor(index), width: `${width}%` }} />
                          </div>
                          <p className="mt-1 text-xs font-bold text-slate-500">{formatPercent(section.sharePercent)}</p>
                        </div>
                      );
                    })}
                    {chartSections.length === 0 ? (
                      <p className="rounded-lg bg-white px-3 py-4 text-sm font-bold text-slate-500">
                        {en ? "No calculated section emission is available." : "계산된 섹션 배출량이 없습니다."}
                      </p>
                    ) : null}
                  </div>
                </div>
                <SectionContributionPieCard en={en} sections={chartSections} title={en ? "Section Contribution Pie" : "섹션별 탄소배출 기여 원그래프"} />
              </div>
              <p className="mt-4 rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                {en
                  ? "Both charts use the same normalized section-emission dataset after rebasing product + byproduct quantity to 1."
                  : "두 그래프는 제품+부산물 총량을 1 기준으로 환산한 동일한 섹션별 배출량 데이터를 사용합니다."}
              </p>
            </section>

            <section className="rounded-[calc(var(--kr-gov-radius)+6px)] border border-[var(--kr-gov-border-light)] bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--kr-gov-border-light)] px-5 py-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--kr-gov-blue)]">{en ? "Detailed Inventory" : "상세 계산 인벤토리"}</p>
                  <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[var(--kr-gov-text-primary)]">{en ? "Detailed Calculation Inventory" : "상세 계산 결과표"}</h2>
                </div>
                <MemberButton onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-admin", "/en/admin/emission/survey-admin"))} size="sm" type="button" variant="secondary">
                  {en ? "Back To Editor" : "입력 화면으로"}
                </MemberButton>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-xs">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-left text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                      <th className="px-4 py-3">{en ? "Section / Substance" : "섹션 / 물질명"}</th>
                      <th className="px-4 py-3">{en ? "Volume" : "배출량"}</th>

                      <th className="px-4 py-3">{en ? "Emission Factor" : "배출계수"}</th>
                      <th className="px-4 py-3">{en ? "Total CO2e" : "산출량"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionGroups.map((group) => (
                      <PrintSectionRows en={en} group={group} key={group.sectionCode} sectionCode={group.sectionCode} />
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white">
                    <tr>
                      <td className="px-4 py-4 text-right text-xs font-black uppercase tracking-[0.16em] text-white/65" colSpan={4}>
                        {en ? "Summation Result" : "최종 합계"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-mono text-lg font-black">{formatNumber(report.summary.totalEmission)}</div>
                        <div className="text-xs font-bold text-white/70">kg CO2e</div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            {report.alerts.length > 0 ? (
              <WarningPanel title={en ? "Audit Integrity Flag" : "검증 / 감사 플래그"}>
                <ul className="space-y-3">
                  {report.alerts.map((alert, index) => (
                    <li className="flex gap-3" key={`${alert.title}-${index}`}>
                      <span className="material-symbols-outlined mt-0.5 text-[18px]">{alert.tone === "warning" ? "warning" : "info"}</span>
                      <div>
                        <p className="font-bold">{alert.title}</p>
                        <p className="mt-1 text-sm leading-6">{alert.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </WarningPanel>
            ) : null}
          </div>
        </div>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export function EmissionSurveyReportPrintPage() {
  const report = useMemo(() => loadEmissionSurveyReportSession(), []);
  const [draftReport, setDraftReport] = useState<EmissionSurveyReportPayload | null>(report);
  const [byproductAllocation, setByproductAllocation] = useState<"allocated" | "unallocated">("allocated");
  const language = new URLSearchParams(window.location.search).get("lang");
  const en = language ? language === "en" : isEnglish();
  const effectiveReport = draftReport || report;
  const { englishNameMap, loading: englishMaterialNameLoading } = useEnglishMaterialNames(effectiveReport, en);
  const [originalTotalEmission, setOriginalTotalEmission] = useState(() => {
    const baseTotal = effectiveReport?.summary.totalEmission || 0;
    const baseFactor = effectiveReport?.normalization?.factor || 1;
    return baseFactor > 0 ? baseTotal / baseFactor : baseTotal;
  });
  const [draftSectionShares, setDraftSectionShares] = useState<Record<string, number>>({});
  const [sectionShareMessage, setSectionShareMessage] = useState("");

  const chartSections = useMemo(
    () => (effectiveReport?.sectionSummaries || []).filter((section) => section.totalEmission > 0 || section.sharePercent > 0),
    [effectiveReport]
  );
  const sectionShareInputs = useMemo(() => {
    const entries: Record<string, number> = {};
    chartSections.forEach((section) => {
      entries[section.sectionCode] = draftSectionShares[section.sectionCode] ?? section.sharePercent;
    });
    return entries;
  }, [chartSections, draftSectionShares]);
  const draftSectionShareTotal = useMemo(
    () => chartSections.reduce((sum, section) => sum + Math.max(sectionShareInputs[section.sectionCode] || 0, 0), 0),
    [chartSections, sectionShareInputs]
  );
  const sectionShareReady = Math.abs(draftSectionShareTotal - 100) < 0.01;
  const sectionGroups = useMemo(
    () => buildSectionGroups(effectiveReport?.rows || []),
    [effectiveReport]
  );
  const [chartCopyMessage, setChartCopyMessage] = useState("");

  if (!effectiveReport) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
        <section className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-black">{en ? "No report data" : "리포트 데이터 없음"}</h1>
          <p className="mt-3 text-sm text-slate-600">
            {en ? "Create the report from the survey admin screen first." : "배출 설문 관리 화면에서 리포트를 먼저 생성하세요."}
          </p>
        </section>
      </main>
    );
  }

  const normalization = effectiveReport.normalization || {
    outputQuantityTotal: 0,
    factor: 1,
    applied: false
  };
  const outputNormalizationRows = buildOutputNormalizationRows(effectiveReport.rows || []);
  const outputMassUnit = outputMassUnitLabel(outputNormalizationRows, en);
  const totalEmission = effectiveReport.summary.totalEmission;
  const applyFactorToOutputRows = (rows: EmissionSurveyReportRow[], factor: number) => rows.map((row) => row.sectionCode === "OUTPUT_PRODUCTS" ? {
    ...row,
    amount: (row.originalAmount || 0) * factor,
    amountText: formatQuantityText((row.originalAmount || 0) * factor, row.unit)
  } : row);
  const updateTotalEmission = (value: number) => {
    setDraftReport((current) => {
      if (!current) {
        return current;
      }
      const nextFactor = originalTotalEmission > 0 ? value / originalTotalEmission : (current.normalization?.factor || 1);
      return {
        ...scaleReportTotal(current, value),
        rows: applyFactorToOutputRows(current.rows, nextFactor),
        normalization: { ...current.normalization, factor: nextFactor, applied: nextFactor !== 1 }
      };
    });
  };
  const updateOriginalTotalEmission = (value: number) => {
    setOriginalTotalEmission(value);
    setDraftReport((current) => {
      if (!current) {
        return current;
      }
      const nextFactor = value > 0 ? (current.summary.totalEmission || 0) / value : (current.normalization?.factor || 1);
      return {
        ...current,
        rows: applyFactorToOutputRows(current.rows, nextFactor),
        normalization: { ...current.normalization, factor: nextFactor, applied: nextFactor !== 1 }
      };
    });
  };
  const updateOutputQuantityTotal = (value: number) => {
    setDraftReport((current) => current ? {
      ...current,
      normalization: { ...current.normalization, outputQuantityTotal: value }
    } : current);
  };
  const updateOutputRowNumber = (rowId: string, key: "originalAmount" | "amount", value: number) => {
    setDraftReport((current) => {
      if (!current) {
        return current;
      }
      const nextRows = current.rows.map((row) => {
        if (row.rowId !== rowId) {
          return row;
        }
        const currentFactor = current.normalization?.factor || 1;
        const factor = key === "amount" && row.originalAmount > 0 ? value / row.originalAmount : currentFactor;
        if (key === "originalAmount") {
          const nextAmount = value * factor;
          return {
            ...row,
            originalAmount: value,
            originalAmountText: formatQuantityText(value, row.unit),
            amount: nextAmount,
            amountText: formatQuantityText(nextAmount, row.unit)
          };
        }
        const nextOriginal = factor > 0 ? value / factor : value;
        return {
          ...row,
          originalAmount: nextOriginal,
          originalAmountText: formatQuantityText(nextOriginal, row.unit),
          amount: value,
          amountText: formatQuantityText(value, row.unit)
        };
      });
      const nextFactor = key === "amount"
        ? nextRows.find((row) => row.rowId === rowId)?.originalAmount
          ? value / (nextRows.find((row) => row.rowId === rowId)?.originalAmount || 1)
          : (current.normalization?.factor || 1)
        : (current.normalization?.factor || 1);
      const rowsWithFactor = key === "amount" ? applyFactorToOutputRows(nextRows, nextFactor) : nextRows;
      return syncOutputMassTotals({
        ...current,
        rows: rowsWithFactor,
        normalization: { ...current.normalization, factor: nextFactor, applied: nextFactor !== 1 }
      }, nextFactor);
    });
  };
  const updateOutputSharePercent = (rowId: string, value: number) => {
    setDraftReport((current) => {
      if (!current) {
        return current;
      }
      const total = current.normalization?.outputQuantityTotal || buildOutputNormalizationRows(current.rows).reduce((sum, row) => sum + Math.max(row.originalAmount || 0, 0), 0);
      const factor = current.normalization?.factor || 1;
      const outputRows = buildOutputNormalizationRows(current.rows);
      const targetShare = Math.max(0, Math.min(value, 100)) / 100;
      const nextOriginalAmount = total * targetShare;
      const otherRows = outputRows.filter((row) => row.rowId !== rowId);
      const otherTotal = otherRows.reduce((sum, row) => sum + Math.max(row.originalAmount || 0, 0), 0);
      const remainingTotal = Math.max(total - nextOriginalAmount, 0);
      const nextRows = current.rows.map((row) => {
        if (row.sectionCode !== "OUTPUT_PRODUCTS") {
          return row;
        }
        const nextOriginal = row.rowId === rowId
          ? nextOriginalAmount
          : (otherTotal > 0 ? (Math.max(row.originalAmount || 0, 0) / otherTotal) * remainingTotal : remainingTotal / Math.max(otherRows.length, 1));
        return {
          ...row,
          originalAmount: nextOriginal,
          originalAmountText: formatQuantityText(nextOriginal, row.unit),
          amount: nextOriginal * factor,
          amountText: formatQuantityText(nextOriginal * factor, row.unit)
        };
      });
      return { ...current, rows: nextRows };
    });
  };
  const updateInventoryRowAmount = (rowId: string, key: "amount" | "originalAmount" | "emissionFactor" | "totalEmission", value: number) => {
    setDraftReport((current) => {
      if (!current) {
        return current;
      }
      const factor = current.normalization?.factor || 1;
      let nextFactor = factor;
      const nextRows = current.rows.map((row) => {
        if (row.rowId !== rowId) {
          return row;
        }
        if (key === "totalEmission") {
          return { ...row, totalEmission: value, calculated: true };
        }
        if (key === "emissionFactor") {
          return recalculateRowEmission({
            ...row,
            emissionFactor: value,
            emissionFactorText: formatNumber(value, 6)
          });
        }
        if (key === "originalAmount") {
          const amount = value * factor;
          return recalculateRowEmission({
            ...row,
            originalAmount: value,
            originalAmountText: formatQuantityText(value, row.unit),
            amount,
            amountText: formatQuantityText(amount, row.unit)
          });
        }
        if (row.sectionCode === "OUTPUT_PRODUCTS" && row.originalAmount > 0) {
          nextFactor = value / row.originalAmount;
          return {
            ...row,
            amount: value,
            amountText: formatQuantityText(value, row.unit)
          };
        }
        const originalAmount = factor > 0 ? value / factor : value;
        return recalculateRowEmission({
          ...row,
          amount: value,
          amountText: formatQuantityText(value, row.unit),
          originalAmount,
          originalAmountText: formatQuantityText(originalAmount, row.unit)
        });
      });
      const rowsWithFactor = nextFactor !== factor ? applyFactorToOutputRows(nextRows, nextFactor) : nextRows;
      const nextReport = syncReportFromRows(syncOutputMassTotals({
        ...current,
        rows: rowsWithFactor,
        normalization: { ...current.normalization, factor: nextFactor, applied: nextFactor !== 1 }
      }, nextFactor));
      setOriginalTotalEmission((nextReport.summary.totalEmission || 0) / (nextReport.normalization?.factor || 1));
      return nextReport;
    });
  };
  const updateInventoryRow = (rowId: string, key: keyof EmissionSurveyReportRow, value: string | number) => {
    setDraftReport((current) => {
      if (!current) {
        return current;
      }
      const nextRows = current.rows.map((row) => {
        if (row.rowId !== rowId) {
          return row;
        }
        if (key === "amountText") {
          const amount = parseEditableNumber(String(value));
          const factor = current.normalization?.factor || 1;
          return recalculateRowEmission({
            ...row,
            amount,
            amountText: String(value),
            originalAmount: factor > 0 ? amount / factor : amount
          });
        }
        if (key === "originalAmountText") {
          const originalAmount = parseEditableNumber(String(value));
          const amount = originalAmount * (current.normalization?.factor || 1);
          return recalculateRowEmission({
            ...row,
            originalAmount,
            originalAmountText: String(value),
            amount,
            amountText: formatQuantityText(amount, row.unit)
          });
        }
        if (key === "emissionFactorText") {
          const emissionFactor = parseEditableNumber(String(value));
          return recalculateRowEmission({
            ...row,
            emissionFactor,
            emissionFactorText: String(value)
          });
        }
        return { ...row, [key]: value };
      });
      if (key !== "amountText" && key !== "originalAmountText" && key !== "emissionFactorText") {
        return { ...current, rows: nextRows };
      }
      const nextReport = syncReportFromRows(syncOutputMassTotals({ ...current, rows: nextRows }));
      setOriginalTotalEmission((nextReport.summary.totalEmission || 0) / (nextReport.normalization?.factor || 1));
      return nextReport;
    });
  };
  const updateSectionEmission = (sectionCode: string, value: number) => {
    setDraftReport((current) => {
      if (!current) {
        return current;
      }
      const nextReport = normalizeReportSectionShares({
        ...current,
        sectionSummaries: current.sectionSummaries.map((section) => (
          section.sectionCode === sectionCode ? { ...section, totalEmission: value } : section
        ))
      });
      setOriginalTotalEmission((nextReport.summary.totalEmission || 0) / (nextReport.normalization?.factor || 1));
      return nextReport;
    });
  };
  const updateDraftSectionShare = (sectionCode: string, sharePercent: number) => {
    setDraftSectionShares((current) => ({
      ...current,
      [sectionCode]: Math.max(sharePercent, 0)
    }));
    setSectionShareMessage("");
  };
  const applyDraftSectionShares = () => {
    setDraftReport((current) => {
      if (!current) {
        return current;
      }
      const targetSections = current.sectionSummaries.filter((section) => section.totalEmission > 0 || section.sharePercent > 0);
      const shareTotal = targetSections.reduce((sum, section) => {
        const share = draftSectionShares[section.sectionCode] ?? section.sharePercent;
        return sum + Math.max(share || 0, 0);
      }, 0);
      if (Math.abs(shareTotal - 100) >= 0.01) {
        const diff = 100 - shareTotal;
        setSectionShareMessage(
          en
            ? `Current total is ${formatNumber(shareTotal, 2)}%. ${diff > 0 ? formatNumber(diff, 2) + "% short" : formatNumber(Math.abs(diff), 2) + "% over"}.`
            : `현재 합계 ${formatNumber(shareTotal, 2)}%입니다. ${diff > 0 ? formatNumber(diff, 2) + "% 부족" : formatNumber(Math.abs(diff), 2) + "% 초과"}입니다.`
        );
        return current;
      }
      const total = current.summary.totalEmission || 0;
      const nextRows = current.sectionSummaries.reduce((rows, section) => {
        if (draftSectionShares[section.sectionCode] === undefined) {
          return rows;
        }
        const nextSectionEmission = total * Math.max(draftSectionShares[section.sectionCode], 0) / 100;
        return redistributeRowsBySectionEmission(rows, section.sectionCode, nextSectionEmission, current.normalization?.factor || 1);
      }, current.rows);
      const nextReport = syncReportFromRows({
        ...current,
        rows: nextRows
      });
      setDraftSectionShares({});
      setSectionShareMessage(en ? "Section ratios applied." : "섹션 비율을 적용했습니다.");
      return nextReport;
    });
  };
  const handlePrintDocument = () => {
    const originalTitle = document.title;
    document.title = " ";
    window.print();
    window.setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  };
  const handleCopyChart = async (type: "bar" | "pie") => {
    try {
      const svg = type === "bar" ? buildSectionBarChartSvg(chartSections, en) : buildSectionPieChartSvg(chartSections, en);
      await copySvgToClipboard(svg);
      setChartCopyMessage(en ? "Chart copied as image." : "그래프 이미지를 복사했습니다.");
    } catch {
      setChartCopyMessage(en ? "Could not copy image in this browser." : "이 브라우저에서 이미지 복사를 사용할 수 없습니다.");
    }
  };

  return (
    <main className="min-h-screen bg-[#dfe7ef] px-4 py-8 text-slate-950 print:bg-white print:p-0">
      <style>
        {"@page{size:A4;margin:8mm;}@media print{html,body{background:#fff!important}.print-hidden{display:none!important}.print-sheet{box-shadow:none!important;border:none!important;border-radius:0!important;margin:0!important;max-width:none!important;overflow:visible!important;padding:0!important}.print-page{break-after:page}.print-page:last-child{break-after:auto}.print-break{break-inside:avoid;page-break-inside:avoid}.print-table{break-inside:auto;page-break-inside:auto}.print-table thead{display:table-header-group}.print-table tr{break-inside:avoid;page-break-inside:avoid}.print-card{background:#fff!important;border:1px solid #d8e0ea!important;border-radius:18px!important;box-shadow:none!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-soft-bg{background:#f8fafc!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-ink-bg{background:#0f172a!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-report-hero{background:linear-gradient(135deg,#0f172a,#11284d 42%,#0f766e)!important;color:#fff!important;border:1px solid #0f172a!important;border-radius:20px!important;margin:0 0 16px!important;padding:20px!important;overflow:hidden!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-report-hero-grid{display:grid!important;grid-template-columns:minmax(0,1.4fr) 260px!important;align-items:center!important}.print-report-title-wrap{min-height:112px!important;display:flex!important;align-items:center!important}.print-report-title-tag{color:#a5f3fc!important}.print-report-title{color:#fff!important}.print-report-total-card{width:260px!important;justify-self:end!important;background:rgba(255,255,255,.10)!important;color:#fff!important;border:1px solid rgba(255,255,255,.18)!important;box-shadow:none!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-report-total-card *{color:#fff!important}.print-total-cell{background:#fff!important;color:#0f172a!important;border-top:2px solid #0f172a!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-total-label{border-bottom-left-radius:18px!important}.print-total-box-cell{border-bottom-right-radius:18px!important}.print-total-value{background:#f8fafc!important;color:#0f172a!important;border:1px solid transparent!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}"}
      </style>
      <div className="print-hidden mx-auto mb-4 flex max-w-5xl justify-between gap-3">
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700" onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-report", "/en/admin/emission/survey-report"))} type="button">
          {en ? "Back To Report" : "리포트로 돌아가기"}
        </button>
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white"
            onClick={handlePrintDocument}
            type="button"
          >
            {en ? "Print / Save PDF" : "인쇄 / PDF 저장"}
          </button>
          {englishMaterialNameLoading ? (
            <span className="text-xs font-bold text-slate-600">
              {en ? "English names are updating live. You can print now or wait." : "영문명이 실시간 갱신 중입니다. 지금 인쇄해도 됩니다."}
            </span>
          ) : null}
        </div>
      </div>

      {en && englishMaterialNameLoading ? (
        <div
          aria-live="polite"
          className="print-hidden mx-auto mb-4 flex max-w-5xl items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 shadow-sm"
          role="status"
        >
          <span className="inline-block h-3 w-3 shrink-0 animate-pulse rounded-full bg-sky-500" />
          <div>
            <p className="font-black">English translation is still loading.</p>
            <p className="mt-0.5 text-xs font-semibold text-sky-800">
              Material and product names will update automatically. This notice is hidden when printing or saving as PDF.
            </p>
          </div>
        </div>
      ) : null}

      <article className="print-sheet mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]">
        <div className="print-page">
        <header className="print-ink-bg print-report-hero relative overflow-hidden bg-slate-950 px-8 py-8 text-white">
          <div className="print-report-hero-deco absolute -right-20 -top-28 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="print-report-hero-deco absolute bottom-0 right-0 h-36 w-72 rounded-tl-full bg-emerald-400/10" />
          <p className="print-report-title-tag relative text-xs font-black uppercase tracking-[0.24em] text-cyan-200">{en ? "Product / Byproduct Emission Factor Report" : "제품/부산물 배출계수 리포트"}</p>
          <div className="print-report-hero-grid relative mt-4 grid items-center gap-5 lg:grid-cols-[minmax(0,1.4fr)_320px]">
            <div className="print-report-title-wrap flex min-h-28 items-center">
              <h1 className="print-report-title max-w-2xl text-4xl font-black leading-tight tracking-[-0.055em]">
                <EditableText
                  className="print-report-title max-w-2xl bg-transparent text-4xl font-black leading-tight tracking-[-0.055em] text-white"
                  onCommit={(value) => setDraftReport((current) => current ? { ...current, productName: value } : current)}
                  value={en ? resolveEnglishMaterialName(effectiveReport.productName || effectiveReport.pageTitle, englishNameMap) : (effectiveReport.productName || effectiveReport.pageTitle)}
                />
              </h1>
            </div>
            <div className="print-report-total-card rounded-3xl border border-white/15 bg-white/10 p-4 text-right shadow-2xl backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100">{en ? "Total Footprint" : "총 탄소배출량"}</p>
              <EditableNumber
                className="mt-3 inline-block w-32 max-w-full bg-transparent text-right text-3xl font-black tracking-[-0.05em] text-white"
                onCommit={updateTotalEmission}
                value={totalEmission}
              />
              <p className="mt-1 text-xs text-slate-300">kg CO2e</p>
            </div>
          </div>
        </header>

        <div className="px-8 py-7">
        <section className="print-card print-soft-bg mt-7 rounded-3xl border border-amber-200 bg-[linear-gradient(135deg,#fffbeb,#fff7ed)] p-5">
          <div className="flex flex-wrap justify-between gap-3 items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">{en ? "Normalization Base" : "정규화 기준"}</p>
              <h2 className="mt-1 text-xl font-black">{en ? "Product And Byproduct Mass Basis" : "제품 및 부산물 질량 기준"}</h2>
            </div>
            <div className="min-w-[160px] bg-white rounded-xl p-1 shadow-sm border border-amber-200 print:hidden">
              <label className="block p-1">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-amber-800">{en ? "Byproduct Allocation" : "부산물 할당 여부"}</span>
                <AdminSelect
                  value={byproductAllocation}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setByproductAllocation(e.target.value as "allocated" | "unallocated")}
                >
                  <option value="allocated">{en ? "Allocated" : "할당"}</option>
                  <option value="unallocated">{en ? "Unallocated" : "미할당"}</option>
                </AdminSelect>
              </label>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <PrintMetric
              editable
              label={en ? "Total Output Mass" : "총 산출물 질량"}
              note={outputMassUnit}
              onCommit={updateOutputQuantityTotal}
              value={normalization.outputQuantityTotal}
            />
<PrintMetric
                editable
                digits={2}
                label={en ? "Product GWP" : "제품 GWP"}
                note={`kg CO2e/ton of ${en ? (effectiveReport.productName || "Product") : (effectiveReport.productName || "제품")}`}
                onCommit={updateOriginalTotalEmission}
                value={outputNormalizationRows.length > 0 ? outputNormalizedEmission(outputNormalizationRows[0], totalEmission, normalization.outputQuantityTotal) : 0}
              />
	            <PrintMetric
	              editable
	              digits={2}
		            label={en ? "Process GWP" : "공정 GWP"}
	              note="kg CO2e"
	              onCommit={updateTotalEmission}
	              value={totalEmission}
	            />
          </div>
        </section>

        <section className="print-card mt-7 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">{en ? "Emission Detail" : "배출량 상세"}</p>
	              <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">{en ? "Emissions By Product And Byproduct" : "제품 및 부산물 별 배출량"}</h2>
            </div>
          </div>
          <PrintOutputAllocationTable
            en={en}
            englishNameMap={englishNameMap}
            outputQuantityTotal={normalization.outputQuantityTotal}
            normalizationFactor={normalization.factor}
            byproductAllocation={byproductAllocation}
            onRowShareChange={updateOutputSharePercent}
            onRowNumberChange={updateOutputRowNumber}
            onRowTextChange={updateInventoryRow}
            rows={outputNormalizationRows}
            totalEmission={totalEmission}
            productName={effectiveReport.productName}
          />
        </section>

        </div>
        </div>

        <section className="print-page grid gap-4 px-8 py-7 lg:grid-cols-2">
          <div className="print-card print-soft-bg rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{en ? "Section Contribution Bars" : "섹션별 탄소배출 기여 그래프"}</h2>
                {sectionShareMessage ? <p className="print-hidden mt-1 text-xs font-bold text-slate-500">{sectionShareMessage}</p> : null}
                {chartCopyMessage ? <p className="print-hidden mt-1 text-xs font-bold text-slate-500">{chartCopyMessage}</p> : null}
              </div>
              <div className="print-hidden flex flex-wrap items-center justify-end gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-black ${sectionShareReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  {en ? "Ratio total" : "비율 합계"} {formatPercent(draftSectionShareTotal, 2)}
                </span>
                <button
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-700"
                  onClick={() => handleCopyChart("bar")}
                  type="button"
                >
                  {en ? "Copy Image" : "이미지 복사"}
                </button>
                <button
                  className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white"
                  onClick={applyDraftSectionShares}
                  type="button"
                >
                  {en ? "Apply Ratios" : "비율 적용"}
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {chartSections.map((section, index) => (
                <div key={section.sectionCode}>
                  <div className="flex justify-between gap-3 text-sm font-black">
                    <span>{sectionLabel(section.sectionCode, section.sectionLabel, en)}</span>
	                    <span className="font-mono">
                      <EditableNumber
                        className="inline-block w-24 bg-transparent text-right font-mono font-black"
                        onCommit={(value) => updateSectionEmission(section.sectionCode, value)}
                        value={section.totalEmission}
                      /> kg CO2e
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full" style={{ backgroundColor: sectionSolidColor(index), width: `${Math.max(4, Math.min(section.sharePercent, 100))}%` }} />
                  </div>
	                  <p className="mt-1 text-xs font-bold text-slate-500">
                    <EditableNumber
                      className="inline-block w-16 bg-transparent font-mono font-bold text-slate-500"
                      digits={1}
                      onCommit={(value) => updateDraftSectionShare(section.sectionCode, value)}
                      value={sectionShareInputs[section.sectionCode] ?? section.sharePercent}
                    />%
                  </p>
                </div>
              ))}
            </div>
          </div>
          <SectionContributionPieCard
            en={en}
            onCopy={() => handleCopyChart("pie")}
            sections={chartSections}
            title={en ? "Section Contribution Pie" : "섹션별 탄소배출 기여 원그래프"}
          />
        </section>

        <section className="print-card print-table mx-8 mb-7 overflow-hidden rounded-3xl border border-slate-200 bg-white print:overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-black">{en ? "Detailed Calculation Inventory" : "상세 계산 결과표"}</h2>
          </div>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="print-table w-full table-fixed border-separate border-spacing-0 text-xs">
              <thead className="bg-slate-50">
                <tr className="text-left font-black text-slate-500">
                  <th className="w-[40%] px-3 py-2">{en ? "Section / Substance" : "섹션 / 물질명"}</th>
                  <th className="w-[30%] px-3 py-2">{en ? "Volume" : "배출량"}</th>
                  <th className="w-[15%] px-3 py-2">{en ? "Emission Factor" : "배출계수"}</th>
                  <th className="w-[15%] px-3 py-2">{en ? "Emissions" : "배출량"}</th>
                </tr>
              </thead>
              <tbody>
                {sectionGroups.map((group) => (
                  <PrintSectionRows
                    en={en}
                    englishNameMap={englishNameMap}
                    group={group}
                    key={group.sectionCode}
                    onRowNumberChange={updateInventoryRowAmount}
                    onRowChange={updateInventoryRow}
                    sectionCode={group.sectionCode}
                  />
                ))}
                <tr className="print-break">
                  <td className="print-total-cell print-total-label print-total-box-cell rounded-b-3xl bg-white px-5 py-5" colSpan={4}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                        {en ? "Summation Result" : "최종 합계"}
                      </span>
                      <div className="print-total-value shrink-0 rounded-2xl bg-slate-50 px-4 py-3 text-center">
                        <EditableNumber
                          className="w-28 bg-transparent text-center font-mono text-3xl font-black leading-none text-slate-950"
                          onCommit={updateTotalEmission}
                          value={totalEmission}
                        />
                        <div className="mt-1 whitespace-nowrap text-xs font-black text-slate-600">kg CO2e</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </article>
    </main>
  );
}

export function EmissionSurveyLcaSummaryPrintPage() {
  const routeEn = isEnglish();
  const en = routeEn;
  const report = loadEmissionSurveyReportSession();
  const [companyName, setCompanyName] = useState("");
  const [productFamily, setProductFamily] = useState("");
  const [functionalUnit, setFunctionalUnit] = useState("");
  const [productModel, setProductModel] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productType, setProductType] = useState("");
  const [equipmentWeight, setEquipmentWeight] = useState("");
  const [bucketCapacity, setBucketCapacity] = useState("");
  const [referenceFlow, setReferenceFlow] = useState("");
  const [dataPeriod, setDataPeriod] = useState("");
  const [regionScope, setRegionScope] = useState("");
  const [lcaSoftware, setLcaSoftware] = useState(defaultLcaSoftwareLabel());

  logGovernanceScope("PAGE", "emission-survey-lca-summary-print", {
    route: window.location.pathname,
    hasSessionPayload: Boolean(report),
    productName: report?.productName || ""
  });

  if (!report) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">{en ? "No report session" : "리포트 세션 없음"}</h1>
          <p className="mt-3 text-sm font-bold text-slate-600">
            {en ? "Open this page from the survey report screen." : "배출 설문 리포트 화면에서 LCA요약보고서 버튼으로 진입하세요."}
          </p>
          <button
            className="mt-6 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white"
            onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-report", "/en/admin/emission/survey-report"))}
            type="button"
          >
            {en ? "Back To Report" : "리포트로 돌아가기"}
          </button>
        </div>
      </main>
    );
  }

  const outputRows = buildOutputNormalizationRows(report.rows || []);
  const inputRows = (report.rows || []).filter((row) => row.sectionCode !== "OUTPUT_PRODUCTS");
  const preManufacturingMass = sumOriginalMass(inputRows);
  const postManufacturingMass = sumOriginalMass(outputRows);
  const normalizedOutputMass = sumNormalizedMass(outputRows);
  const massUnit = outputMassUnitLabel(outputRows, en) || "t";
  const totalEmission = report.summary.totalEmission || 0;
  const totalEmissionPerMass = normalizedOutputMass > 0 ? totalEmission / normalizedOutputMass : totalEmission;
  const handlePrintDocument = () => {
    const originalTitle = document.title;
    document.title = " ";
    window.print();
    window.setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  };
  const textFieldClass = "rounded-sm border border-emerald-300 bg-emerald-100/80 px-1.5 py-0.5 font-bold text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 print:border-0 print:bg-transparent print:px-0 print:py-0 print:shadow-none";
  const tableHeaderClass = "border border-[#cccccc] bg-[#d9d9d9] px-3 py-2 text-center text-[13px] font-black text-slate-950";
  const tableLabelClass = "border border-[#cccccc] bg-[#f2f2f2] px-3 py-2 text-[13px] font-black text-[#4f6fd5]";
  const tableCellClass = "border border-[#cccccc] px-3 py-2 text-[13px] font-semibold leading-6 text-slate-800";
  const terms = [
    ["영향범주", "평가 대상 제품 또는 시스템에 영향을 미칠 수 있는 일반적인 환경영향, 지구온난화, 부영양화, 산성화 등이 해당"],
    ["전과정", "원료물질 채취부터 최종 처리에 이르는 제품 시스템 상의 연속적이고 상호 연관된 단계들"],
    ["Cradle to Gate", "원료물질의 취득부터 제품이 공장을 출하하는 시점까지의 단계"],
    ["전과정 영향평가", "제품 시스템의 전과정에 걸쳐 잠재적 환경영향의 크기와 중요성을 이해하고 평가하는 것을 목적으로 하는 전과정평가의 단계"],
    ["전과정평가", "제품 시스템의 전과정에 걸쳐 투입물과 산출물을 작성하고 이들이 환경에 미치는 잠재적 영향을 종합평가하는 기법"],
    ["제품 시스템", "하나 또는 그 이상의 정의된 기능을 수행하는 물질 또는 에너지로 연결된 단위공정의 집합체"],
    ["단위 공정", "투입물과 산출물 데이터를 정량화하기 위하여 전과정 분석에서 고려되는 최소 요소"],
    ["시스템 경계", "어떤 단위공정 또는 물질들이 제품 시스템의 일부라는 것을 상술하는 일련의 기준"],
    ["에너지 사용 제품", "냉장고, 세탁기, 자동차 등과 같이 사용단계에서 에너지를 사용하는 소비재"],
    ["에너지 비사용 제품", "의류, 가구 등과 같이 사용 단계에서 에너지 사용이 없는 소비재"],
    ["기능단위", "서로 다른 대안을 비교하기 위한 기준단위로, 제품 시스템의 성능"],
    ["현장 데이터 (Primary Data)", "사업장에서 측정 또는 계산을 통하여 직접 수집, 관리되는 데이터"],
    ["일반 데이터 (Secondary Data)", "현장 데이터를 제외한 해당 국가 공인 전과정목록(LCI) 데이터와 해당 산업계 평균 전과정목록 데이터, 기타 전과정목록 데이터"],
    ["할당", "한 제품 시스템과 하나 이상의 다른 제품 시스템 사이에서 하나의 공정 또는 하나의 제품 시스템의 투입물과 산출물의 흐름을 분배하는 과정"],
    ["제외기준 (Cut-off Rules)", "산정에서 제외할 제품 시스템과 관련된 물질 또는 에너지 흐름의 양"]
  ];

  return (
    <main className="min-h-screen bg-[#e8edf3] px-4 py-8 text-slate-950 print:bg-white print:p-0">
      <style>
        {"@page{size:A4;margin:0;}@media print{html,body{background:#fff!important}.print-hidden{display:none!important}main{padding:0!important}.lca-sheet{box-shadow:none!important;border:none!important;border-radius:0!important;margin:0!important;max-width:none!important;padding:20mm 10mm!important}.lca-section{break-inside:avoid;page-break-inside:avoid}.lca-table{break-inside:auto;page-break-inside:auto}.lca-table thead{display:table-header-group}.lca-table tr{break-inside:avoid;page-break-inside:avoid}.lca-table th{background:#d9d9d9!important;color:#0f172a!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.lca-table td.bg-\\[\\#f2f2f2\\],.lca-table td[class*='bg-[#f2f2f2]']{background:#f2f2f2!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-input-control{display:none!important}.print-input-text{display:inline!important;color:inherit!important;font:inherit!important;font-weight:inherit!important;line-height:inherit!important;white-space:pre-wrap!important}.lca-auto{background:transparent!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.lca-screen-note{display:none!important}}@media screen{.print-input-text{display:none!important}}"}
      </style>

      <div className="print-hidden mx-auto mb-4 flex max-w-[900px] justify-between gap-3">
        <button
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700"
          onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-report", "/en/admin/emission/survey-report"))}
          type="button"
        >
          {en ? "Back To Report" : "리포트로 돌아가기"}
        </button>
        <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white" onClick={handlePrintDocument} type="button">
          {en ? "Print" : "인쇄하기"}
        </button>
      </div>

      <article className="lca-sheet mx-auto max-w-[900px] rounded-[26px] border border-white bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
        <header className="text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
            <EditableText className={`${textFieldClass} lca-fill !w-auto min-w-[170px] text-center text-3xl`} onCommit={setCompanyName} value={companyName} />
            <span>{en ? "Product LCA Summary" : "제품 LCA 수행 개요"}</span>
          </div>
        </header>

        <section className="lca-section mt-8">
          <h2 className="mb-3 text-xl font-black text-slate-950">1. {en ? "Terms" : "용어정의"}</h2>
          <table className="lca-table w-full border-collapse">
            <thead>
              <tr>
                <th className={`${tableHeaderClass} w-[24%]`}>{en ? "Term" : "용어"}</th>
                <th className={tableHeaderClass}>{en ? "Description" : "설명"}</th>
              </tr>
            </thead>
            <tbody>
              {terms.map(([term, desc]) => (
                <tr key={term}>
                  <td className={tableLabelClass}>{term}</td>
                  <td className={tableCellClass}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="lca-section mt-7">
          <h2 className="mb-3 text-xl font-black text-slate-950">2. ISO 14040/44 {en ? "Main Application" : "기반의 주요 적용 사항"}</h2>
          <table className="lca-table w-full border-collapse">
            <tbody>
              {[
                ["기능단위", "제품 작동 시간 당 kg CO₂-eq"],
                ["시스템 경계", "Cradle-to-Gate"],
                ["전과정 영향평가 방법론", "지구온난화 영향범주에 대한 잠재적 영향평가를 위해 IPCC 2021(GWP100) 방법론 적용"],
                ["제외기준(Cut-off Rules)", "제품 구성 부품 선정 시 누적중량 95% 기준 적용"],
                ["할당", "제품 중량 기준 할당 적용"]
              ].map(([label, value]) => (
                <tr key={String(label)}>
                  <td className={`${tableLabelClass} w-[28%]`}>{label as string}</td>
                  <td className={tableCellClass}>{value as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="lca-section mt-7">
          <h2 className="mb-3 text-xl font-black text-slate-950">{en ? "Summary" : "결과 요약"}</h2>
          <p className="leading-8 text-slate-800">
            {en ? "The target " : "당사가 생산하는 "}
            <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[260px] align-middle`} onCommit={setProductFamily} value={productFamily} />
            {en ? " product was assessed according to ISO 14040 and ISO 14044 procedures. The scope was set as Cradle to Gate, including raw material acquisition, processing, and product manufacturing. The functional unit was defined as " : " 제품은 ISO14040 및 ISO14044 지침의 일반적 절차와 요구 사항에 따라 LCA를 수행하였다. 영향 평가의 대상 범위는 ISO14025, ISO/TS14067에 따라 Cradle to Gate로 설정하여, 원료채취 및 가공, 제품 제조를 포함하고 있다. 평가대상의 기준단위는 "}
            <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[240px] align-middle`} onCommit={setFunctionalUnit} value={functionalUnit} />
            {en ? "." : " 배출량으로 정의하였다."}
          </p>
          <p className="mt-3 leading-8 text-slate-800">
            {en ? "The LCA model was developed based on " : "LCA 수행은 ISO 지침에 따라 "}
            <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[180px] align-middle`} onCommit={setCompanyName} value={companyName} />
            {en ? " process information, and the carbon emission impact result was derived." : "의 공정현황을 기반으로 "}
            {!en ? (
              <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[120px] align-middle`} onCommit={setProductFamily} value={productFamily} />
            ) : null}
            {en ? "" : " 제품 LCA 수행 모델을 개발하여 진행되었다. 해당 수행 모델을 기반으로 제품의 탄소배출량(Global Warming Potential)에 대한 영향 평가 결과를 도출하였다."}
          </p>
        </section>

        <section className="lca-section mt-8">
          <h2 className="mb-3 text-xl font-black text-slate-950">1. {en ? "Product Information" : "제품정보"}</h2>
          <table className="lca-table w-full border-collapse">
            <tbody>
              <tr>
                <td className={`${tableLabelClass} w-[28%]`}>{en ? "Product model" : "제품모델"}</td>
                <td className={tableCellClass} colSpan={4}><EditableText className={`${textFieldClass} lca-fill`} onCommit={setProductModel} value={productModel} /></td>
              </tr>
              <tr>
                <td className={tableLabelClass}>{en ? "General information" : "제품 일반 정보"}</td>
                <td className={tableCellClass} colSpan={4}><EditableText className={`${textFieldClass} lca-fill`} multiline onCommit={setProductDescription} value={productDescription} /></td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} w-[28%] align-middle`} rowSpan={2}>Product Spec.</td>
                <td className={tableHeaderClass}>{en ? "Product name" : "제품명"}</td>
                <td className={tableHeaderClass}>{en ? "Type" : "구분"}</td>
                <td className={tableHeaderClass}>{en ? "Equipment weight(ton)" : "장비중량(ton)"}</td>
                <td className={tableHeaderClass}>버킷 용량(m2)</td>
              </tr>
              <tr>
                <td className={`${tableCellClass} text-center`}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setProductModel} value={productModel} /></td>
                <td className={`${tableCellClass} text-center`}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setProductType} value={productType} /></td>
                <td className={`${tableCellClass} text-center`}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setEquipmentWeight} value={equipmentWeight} /></td>
                <td className={`${tableCellClass} text-center`}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setBucketCapacity} value={bucketCapacity} /></td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} w-[28%]`}>{en ? "Reference flow" : "중량정보(기준흐름)"}</td>
                <td className={tableCellClass} colSpan={4}><EditableText className={`${textFieldClass} lca-fill`} onCommit={setReferenceFlow} value={referenceFlow} /></td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="lca-section mt-8">
          <h2 className="mb-3 text-xl font-black text-slate-950">2. {en ? "LCA Execution Information" : "LCA 수행 정보"}</h2>
          <table className="lca-table w-full border-collapse">
            <tbody>
              <tr>
                <td className={`${tableLabelClass} w-[25%]`}>{en ? "Functional unit" : "기능단위"}</td>
                <td className={tableCellClass}><EditableText className={`${textFieldClass} lca-fill`} onCommit={setFunctionalUnit} value={functionalUnit} /></td>
              </tr>
              <tr>
                <td className={tableLabelClass}>{en ? "System boundary" : "시스템경계"}</td>
                <td className={tableCellClass}>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={tableHeaderClass}>{en ? "Analysis stage" : "분석 단계"}</th>
                        <th className={tableHeaderClass}>{en ? "Detailed scope" : "세부 범위"}</th>
                        <th className={tableHeaderClass}>{en ? "Included" : "분석 포함 여부"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={`${tableCellClass} text-center align-middle`} rowSpan={3}>제조전 단계</td>
                        <td className={tableCellClass}>원료물질 채취 및 제조공정</td>
                        <td className={`${tableCellClass} text-center`}>●</td>
                      </tr>
                      <tr>
                        <td className={tableCellClass}>1차 협력업체 생산제품 제조</td>
                        <td className={`${tableCellClass} text-center`}>X</td>
                      </tr>
                      <tr>
                        <td className={tableCellClass}>수송(협력업체→제조사업장)</td>
                        <td className={`${tableCellClass} text-center`}>X</td>
                      </tr>
                      <tr>
                        <td className={`${tableCellClass} text-center align-middle`}>제조 단계</td>
                        <td className={tableCellClass}>제품 제조 공정</td>
                        <td className={`${tableCellClass} text-center`}>●</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td className={tableLabelClass}>{en ? "Data quality" : "데이터 품질"}</td>
                <td className={tableCellClass}>
                  <div className="leading-7">
                    <div>· Upstream : secondary data(LCI DB)</div>
                    <div> · Core : 현장데이터 및 LCI DB</div>
                    <div className="pl-4">
                   - Time Related Scope :{" "}
                    <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[150px] align-middle`} onCommit={setDataPeriod} value={dataPeriod} placeholder="0000.00.00 ~ 0000.00.00" />
                    </div>
                    <div className="pl-4">
                      - Region Scope :{" "}
                      <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[220px] align-middle`} onCommit={setRegionScope} value={regionScope} />
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td className={tableLabelClass}>LCA Software</td>
                <td className={`${tableCellClass} lca-auto bg-amber-100`}>
                  <EditableText className="w-full rounded-md border border-amber-300 bg-amber-100 px-2 py-1 font-black text-slate-950 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 print:border-0 print:bg-amber-100 print:p-0" onCommit={setLcaSoftware} value={lcaSoftware} />
                </td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} align-middle`}>LCIA Method</td>
                <td className={tableCellClass}>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={`${tableHeaderClass} w-[27%]`}>Impact category</th>
                        <th className={`${tableHeaderClass} w-[33%]`}>Indicator</th>
                        <th className={`${tableHeaderClass} w-[16%]`}>Unit</th>
                        <th className={`${tableHeaderClass} w-[24%]`}>Recommended default LCIA method</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={`${tableCellClass} align-middle text-center`}>Global Warming Potential (GWP100)</td>
                        <td className={`${tableCellClass} align-middle text-center`}>Radiative forcing as Global Warming Potential (GWP100)</td>
                        <td className={`${tableCellClass} align-middle text-center`}>kg CO₂–eq.</td>
                        <td className={`${tableCellClass} align-middle text-center`}>
                          from openLCIA methods<br />
                          <span className="font-black">✓ IPCC 2021, AR6</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="lca-section mt-8">
          <h2 className="mb-3 text-xl font-black text-slate-950">3. {en ? "Impact Assessment Result" : "영향평가 결과"}</h2>
          <table className="lca-table w-full border-collapse">
            <thead>
              <tr>
                <th className={tableHeaderClass}>Impact category</th>
                <th className={tableHeaderClass}>Unit</th>
                <th className={tableHeaderClass}>Total</th>
                <th className={tableHeaderClass}>제조전</th>
                <th className={tableHeaderClass}>제조</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${tableCellClass} text-center`}>Global Warming Potential (GWP100)</td>
                <td className={`${tableCellClass} text-center`}>kg CO₂–eq<br />/{massUnit}</td>
                <td className={`${tableCellClass} lca-auto text-center font-black`}>{formatNumber(totalEmissionPerMass)}</td>
                <td className={`${tableCellClass} lca-auto text-center font-black`}>{formatNumber(preManufacturingMass)}</td>
                <td className={`${tableCellClass} lca-auto text-center font-black`}>{formatNumber(postManufacturingMass)}</td>
              </tr>
              <tr>
                <td className={`${tableCellClass} text-center font-black`} colSpan={2}>탄소배출량 합계</td>
                <td className={`${tableCellClass} lca-auto text-center font-black`}>{formatNumber(totalEmission)} kg CO₂-eq</td>
                <td className={`${tableCellClass} lca-auto text-center font-black`}>{preManufacturingMass > 0 ? formatPercent((preManufacturingMass / Math.max(preManufacturingMass + postManufacturingMass, 1)) * 100) : "-"}</td>
                <td className={`${tableCellClass} lca-auto text-center font-black`}>{postManufacturingMass > 0 ? formatPercent((postManufacturingMass / Math.max(preManufacturingMass + postManufacturingMass, 1)) * 100) : "-"}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </article>
    </main>
  );
}

function EditableNumber({
  value,
  onCommit,
  className = "",
  digits = 2
}: {
  value: number;
  onCommit: (value: number) => void;
  className?: string;
  digits?: number;
}) {
  const [draft, setDraft] = useState(formatNumber(value, digits));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) {
      setDraft(formatNumber(value, digits));
    }
  }, [digits, focused, value]);
  return (
    <input
      className={`print:border-0 print:bg-transparent print:p-0 ${className}`.trim()}
      inputMode="decimal"
      onBlur={() => {
        setFocused(false);
        onCommit(parseEditableNumber(draft));
      }}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setFocused(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      value={draft}
    />
  );
}

function EditableText({
  value,
  onCommit,
  className = "",
  multiline = false,
  placeholder = ""
}: {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  if (multiline) {
    return (
      <>
        <textarea
          className={`print-input-control w-full ${className}`.trim()}
          onBlur={() => onCommit(draft)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          rows={3}
          value={draft}
        />
      </>
    );
  }
  return (
    <input
      className={`print-input-control w-full ${className}`.trim()}
      onBlur={() => onCommit(draft)}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      placeholder={placeholder}
      value={draft}
    />
  );
}

function PrintMetric({
  label,
  value,
  note,
  editable,
  digits = 6,
  onCommit
}: {
  label: string;
  value: string | number;
  note?: string;
  editable?: boolean;
  digits?: number;
  onCommit?: (value: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
      <p className="text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-center font-mono text-lg font-black text-slate-950">
        {editable && typeof value === "number" && onCommit ? (
	          <EditableNumber
	            className="w-full bg-transparent text-center font-mono text-lg font-black text-slate-950"
	            digits={digits}
	            onCommit={onCommit}
	            value={value}
	          />
        ) : value}
      </p>
      {note ? <p className="mt-0.5 text-center text-[10px] font-bold text-slate-500">{note}</p> : null}
    </div>
  );
}

function PrintOutputAllocationTable({
  rows,
  en,
  englishNameMap,
  totalEmission,
  outputQuantityTotal,
  normalizationFactor,
  byproductAllocation,
  onRowNumberChange,
  onRowTextChange,
  onRowShareChange,
  productName
}: {
  rows: EmissionSurveyReportRow[];
  en: boolean;
  englishNameMap?: EnglishMaterialNameMap;
  totalEmission: number;
  outputQuantityTotal: number;
  normalizationFactor?: number;
  byproductAllocation?: "allocated" | "unallocated";
  onRowNumberChange?: (rowId: string, key: "originalAmount" | "amount", value: number) => void;
  onRowTextChange?: (rowId: string, key: keyof EmissionSurveyReportRow, value: string | number) => void;
  onRowShareChange?: (rowId: string, value: number) => void;
  productName?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-bold text-slate-500">
        {en ? "No product or byproduct mass was entered." : "제품 또는 부산물 질량 입력값이 없습니다."}
      </p>
    );
  }

  return (
    <div className="print-table overflow-hidden rounded-3xl border border-amber-300 bg-white print:overflow-hidden">
      <table className="print-table w-full table-fixed border-separate border-spacing-0 text-[11px]">
        <thead className="bg-amber-50">
          <tr className="text-left font-black text-amber-900">
            <th className="w-[12%] whitespace-nowrap rounded-tl-3xl border-b border-amber-200 px-3 py-3 text-center">{en ? "Type" : "구분"}</th>
            <th className="w-[28%] border-b border-amber-200 px-2 py-3">{en ? "Output" : "출력물"}</th>
            <th className="w-[16%] whitespace-nowrap border-b border-amber-200 px-2 py-3 text-center">{en ? "Process Standard Mass" : "공정기준질량"}</th>
            <th className="w-[10%] whitespace-nowrap border-b border-amber-200 px-2 py-3 text-center">{en ? "Mass Share" : "질량 비중"}</th>
            <th className="w-[17%] border-b border-amber-200 px-2 py-3 text-center">{en ? "Emission (by Mass Share)" : "질량 비중에 따른 배출량 계산"}</th>
            <th className="w-[17%] rounded-tr-3xl border-b border-amber-200 px-2 py-3 text-center">{en ? "Emission per ton" : "배출량(1톤 기준)"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isByproduct = row.sectionCode === "OUTPUT_BYPRODUCTS";
            const productOnlyMass = rows
              .filter((r) => r.sectionCode === "OUTPUT_PRODUCTS")
              .reduce((sum, r) => sum + (r.originalAmount || 0), 0);
            const isUnallocated = byproductAllocation === "unallocated";
            const effectiveOutputQuantityTotal = isUnallocated ? productOnlyMass : outputQuantityTotal;
            const massShare = effectiveOutputQuantityTotal > 0 ? row.originalAmount / effectiveOutputQuantityTotal : 0;
            const displaySharePercent = massShare * 100;
            const normalizedEmission = isUnallocated && isByproduct ? 0 : totalEmission * massShare;
            const rawEmission = normalizedEmission * (normalizationFactor || 1);
            return (
              <tr className="border-b border-amber-100 align-middle" key={row.rowId}>
                <td className="px-3 py-3 align-middle text-slate-600 font-bold text-center bg-slate-50/40">
                  {groupLabel(row, en)}
                </td>
                <td className="px-3 py-3 align-middle">
	                  <EditableText
	                    multiline
	                    className="min-h-[3.9rem] resize-none bg-transparent text-sm font-black leading-snug text-slate-950 print:min-h-0 print:whitespace-pre-wrap"
	                    onCommit={(value) => onRowTextChange?.(row.rowId, "materialName", value)}
	                    value={en ? resolveEnglishMaterialName(row.materialName, englishNameMap || {}) : (row.materialName || "-")}
	                  />
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-amber-100">
                    <div className="h-full rounded-full bg-amber-600" style={{ width: `${Math.max(2, Math.min(displaySharePercent, 100))}%` }} />
                  </div>
                </td>
                <td className="px-2 py-3 text-center">
                  <span className="inline-flex items-baseline justify-center gap-0.5 whitespace-nowrap font-mono text-[11px] font-black text-slate-900">
                    <EditableNumber
                      className="inline-block w-12 bg-transparent text-center font-mono font-black"
                      digits={2}
                      onCommit={(value) => onRowNumberChange?.(row.rowId, "originalAmount", value)}
                      value={row.originalAmount}
                    />
                    <span className="text-[9px] font-bold text-slate-500">{row.unit || ""}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-center font-mono font-black">
                  <span className="inline-flex items-baseline justify-center gap-0.5 whitespace-nowrap text-slate-950">
                    <EditableNumber
                      className="inline-block w-10 bg-transparent text-center font-mono font-black"
                      digits={2}
                      onCommit={(value) => onRowShareChange?.(row.rowId, value)}
                      value={displaySharePercent}
                    />
                    <span>%</span>
                  </span>
                </td>
                <td className="px-2 py-3 text-center align-middle">
                  <div className="inline-flex flex-col items-center justify-center leading-none">
                    <span className="font-mono text-sm font-black text-slate-950">{formatNumber(rawEmission, 2)}</span>
                    <span className="mt-1 text-[9px] font-bold text-slate-500 whitespace-nowrap">kg CO2e</span>
                  </div>
                </td>
                <td className="px-2 py-3 text-center align-middle">
                  <div className="inline-flex flex-col items-center justify-center leading-none">
                    <span className="font-mono text-sm font-black text-slate-950">{formatNumber(normalizedEmission, 2)}</span>
                    <span className="mt-1 text-[9px] font-bold text-slate-500 whitespace-nowrap">
                      kg CO2e/ton of {en ? (productName || "Product") : (productName || "제품")}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PrintSectionRows({
  group,
  en,
  englishNameMap,
  sectionCode,
  onRowChange,
  onRowNumberChange
}: {
  group: { sectionLabel: string; rows: EmissionSurveyReportRow[] };
  en: boolean;
  englishNameMap?: EnglishMaterialNameMap;
  sectionCode: string;
  onRowChange?: (rowId: string, key: keyof EmissionSurveyReportRow, value: string | number) => void;
  onRowNumberChange?: (rowId: string, key: "amount" | "originalAmount" | "emissionFactor" | "totalEmission", value: number) => void;
}) {
  return (
    <>
      <tr className="bg-blue-50">
        <td className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700" colSpan={4}>
          {sectionLabel(sectionCode, group.sectionLabel, en)}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr className="border-b border-slate-100 align-top" key={row.rowId}>
          <td className="w-[40%] px-3 py-2">
            <EditableText
              className="w-full bg-transparent font-bold text-slate-900"
              onCommit={(value) => onRowChange?.(row.rowId, "materialName", value)}
              value={en ? resolveEnglishMaterialName(row.materialName, englishNameMap || {}) : (row.materialName || "-")}
            />
            <div className="mt-0.5 text-[10px] text-slate-500">{groupLabel(row, en)}</div>
          </td>
          <td className="px-3 py-2">
            <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1">
              <span className="min-w-12 text-[10px] font-bold text-slate-500">{en ? "Normalized" : "단위 배출량"}</span>
              <span className="whitespace-nowrap font-mono">
	              <EditableNumber
	                className="inline-block w-20 bg-transparent text-right font-mono"
	                digits={2}
	                onCommit={(value) => onRowNumberChange?.(row.rowId, "amount", value)}
	                value={row.amount}
	              /> {row.unit || ""}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-slate-500">
              <span className="min-w-12 text-[10px] font-bold">{en ? "Original" : "실제 배출량"}</span>
              <span className="whitespace-nowrap font-mono text-[10px]">
	                <EditableNumber
	                  className="inline-block w-20 bg-transparent text-right font-mono text-[10px] text-slate-500"
	                  digits={2}
	                  onCommit={(value) => onRowNumberChange?.(row.rowId, "originalAmount", value)}
	                  value={row.originalAmount}
	                /> {row.unit || ""}
              </span>
            </div>
            </div>
          </td>
          <td className="px-3 py-2">
	            <EditableNumber
	              className="inline-block w-24 bg-transparent font-mono"
	              digits={2}
	              onCommit={(value) => onRowNumberChange?.(row.rowId, "emissionFactor", value)}
	              value={row.emissionFactor}
	            />
          </td>
          <td className="px-3 py-2 font-black">
            {row.calculated ? (
              <EditableNumber
                className="w-20 bg-transparent font-black"
                onCommit={(value) => onRowNumberChange?.(row.rowId, "totalEmission", value)}
                value={row.totalEmission}
              />
            ) : "-"}
          </td>
        </tr>
      ))}
    </>
  );
}

function SectionContributionPieCard({
  sections,
  title,
  en,
  onCopy
}: {
  sections: EmissionSurveyReportSectionSummary[];
  title: string;
  en: boolean;
  onCopy?: () => void;
}) {
  const pieSlices = buildPieSlices(sections);
  return (
    <div className="rounded-[calc(var(--kr-gov-radius)+4px)] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--kr-gov-blue)]">{en ? "Same Data View" : "동일 데이터 그래프"}</p>
          <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-slate-950">{title}</h3>
        </div>
        {onCopy ? (
          <button className="print-hidden rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-700" onClick={onCopy} type="button">
            {en ? "Copy Image" : "이미지 복사"}
          </button>
        ) : null}
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[220px]">
          <svg aria-label={title} className="h-full w-full" role="img" viewBox="0 0 220 220">
            <circle cx="110" cy="110" fill="#e2e8f0" r="104" />
            {pieSlices.map((slice) => (
              <path d={slice.d} fill={slice.color} key={slice.key} stroke="#ffffff" strokeLinejoin="round" strokeWidth="2" />
            ))}
            <circle cx="110" cy="110" fill="#ffffff" r="50" stroke="#e2e8f0" strokeWidth="1" />
            <text fill="#64748b" fontSize="11" fontWeight="900" textAnchor="middle" x="110" y="104">
              {en ? "TOTAL" : "합계"}
            </text>
            <text fill="#0f172a" fontSize="22" fontWeight="900" textAnchor="middle" x="110" y="130">
              100%
            </text>
          </svg>
        </div>
        <div className="space-y-2">
          {sections.map((section, index) => (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2" key={`${title}-${section.sectionCode}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: sectionSolidColor(index) }} />
                <span className="truncate text-xs font-bold text-slate-700">{sectionLabel(section.sectionCode, section.sectionLabel, en)}</span>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-black text-slate-950">{formatPercent(section.sharePercent)}</p>
	                <p className="text-[10px] font-bold text-slate-500">{formatNumber(section.totalEmission)} kg CO2e</p>
              </div>
            </div>
          ))}
          {sections.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm font-bold text-slate-500">
              {en ? "No calculated section emission is available." : "계산된 섹션 배출량이 없습니다."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
