import React, { useEffect, useMemo, useRef, useState } from "react";
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

const REPORT_VERIFICATION_STORAGE_KEY = "carbonet:emission-survey-report-verification:v1";
const REPORT_VERIFY_BEGIN = "CARBONET_REPORT_VERIFY_BEGIN";
const REPORT_VERIFY_END = "CARBONET_REPORT_VERIFY_END";

type ReportVerificationPayload = {
  version: 1;
  certificateId: string;
  issuedAt: string;
  reportTitle: string;
  productName: string;
  generatedAt: string;
  totalEmission: number;
  rowCount: number;
  calculatedRowCount: number;
  warningCount: number;
  payloadHash: string;
  integrityCode: string;
  verificationUrl: string;
};

type ReportVerificationRecord = ReportVerificationPayload & {
  source: "browser-print";
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

async function sha256Hex(value: string) {
  if (!window.crypto?.subtle?.digest) {
    return sha256HexFallback(value);
  }
  const buffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function rightRotate(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256HexFallback(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) {
    bytes.push(0);
  }
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  bytes.push((high >>> 24) & 255, (high >>> 16) & 255, (high >>> 8) & 255, high & 255);
  bytes.push((low >>> 24) & 255, (low >>> 16) & 255, (low >>> 8) & 255, low & 255);

  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const words = new Array<number>(64);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const cursor = offset + index * 4;
      words[index] = ((bytes[cursor] << 24) | (bytes[cursor + 1] << 16) | (bytes[cursor + 2] << 8) | bytes[cursor + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rightRotate(words[index - 15], 7) ^ rightRotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rightRotate(words[index - 2], 17) ^ rightRotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + ch + constants[index] + words[index]) >>> 0;
      const sum0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((item, index) => {
      hash[index] = (hash[index] + item) >>> 0;
    });
  }
  return hash.map((item) => item.toString(16).padStart(8, "0")).join("");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function canonicalReportForVerification(report: EmissionSurveyReportPayload) {
  return {
    generatedAt: report.generatedAt,
    productName: report.productName,
    pageTitle: report.pageTitle,
    classification: report.classification,
    calculationScope: report.calculationScope,
    summary: report.summary,
    normalization: report.normalization,
    sectionSummaries: report.sectionSummaries,
    rows: report.rows.map((row) => ({
      rowId: row.rowId,
      sectionCode: row.sectionCode,
      materialName: row.materialName,
      amount: row.amount,
      originalAmount: row.originalAmount,
      unit: row.unit,
      emissionFactor: row.emissionFactor,
      totalEmission: row.totalEmission,
      calculated: row.calculated
    }))
  };
}

function loadReportVerificationRecords() {
  try {
    const raw = window.localStorage.getItem(REPORT_VERIFICATION_STORAGE_KEY) || "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ReportVerificationRecord[] : [];
  } catch {
    return [];
  }
}

function saveReportVerificationRecord(record: ReportVerificationRecord) {
  const records = loadReportVerificationRecords().filter((item) => item.certificateId !== record.certificateId);
  window.localStorage.setItem(REPORT_VERIFICATION_STORAGE_KEY, JSON.stringify([record, ...records].slice(0, 100)));
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function verificationPayloadToBlock(payload: ReportVerificationPayload) {
  return `${REPORT_VERIFY_BEGIN}\n${base64UrlEncode(JSON.stringify(payload))}\n${REPORT_VERIFY_END}`;
}

function extractVerificationPayload(raw: string): ReportVerificationPayload | null {
  const blockMatch = raw.match(/CARBONET_REPORT_VERIFY_BEGIN\s*([A-Za-z0-9_-]+)\s*CARBONET_REPORT_VERIFY_END/);
  const inlineMatch = raw.match(/CARBONET-VERIFY:([A-Za-z0-9_-]+)/);
  const encoded = blockMatch?.[1] || inlineMatch?.[1] || "";
  if (!encoded) {
    return null;
  }
  try {
    return JSON.parse(base64UrlDecode(encoded)) as ReportVerificationPayload;
  } catch {
    return null;
  }
}

function normalizePdfExtractedText(value: string) {
  return value
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\r/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, " ");
}

function findPayloadFromVisibleVerificationFields(raw: string): ReportVerificationPayload | null {
  const text = normalizePdfExtractedText(raw);
  const certificateId = text.match(/CRN-\d{8}-[A-Fa-f0-9]{12}/)?.[0] || "";
  const knownRecords = loadReportVerificationRecords();
  if (certificateId) {
    const exactRecord = knownRecords.find((record) => record.certificateId === certificateId);
    if (exactRecord) {
      return exactRecord;
    }
  }
  const hashes = Array.from(new Set(text.match(/[A-Fa-f0-9]{64}/g) || []));
  const integrityCodes = Array.from(new Set(text.match(/[A-Fa-f0-9]{24}/g) || []));
  const matchedBySignals = knownRecords.find((record) => (
    (!certificateId || record.certificateId === certificateId)
    && hashes.some((hash) => hash.toLowerCase() === record.payloadHash.toLowerCase())
    && integrityCodes.some((code) => code.toUpperCase() === record.integrityCode.toUpperCase())
  ));
  return matchedBySignals || null;
}

async function inflatePdfStream(streamBytes: Uint8Array) {
  const streamApi = (window as Window & { DecompressionStream?: new(format: string) => DecompressionStream }).DecompressionStream;
  if (!streamApi) {
    return "";
  }
  try {
    const streamBuffer = streamBytes.buffer.slice(streamBytes.byteOffset, streamBytes.byteOffset + streamBytes.byteLength) as ArrayBuffer;
    const decompressed = new Blob([streamBuffer]).stream().pipeThrough(new streamApi("deflate"));
    return await new Response(decompressed).text();
  } catch {
    return "";
  }
}

async function extractPdfVerificationText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const latinText = new TextDecoder("latin1", { fatal: false }).decode(buffer);
  const candidates = [
    new TextDecoder("utf-8", { fatal: false }).decode(buffer),
    latinText
  ];
  let searchOffset = 0;
  while (searchOffset < latinText.length) {
    const streamStart = latinText.indexOf("stream", searchOffset);
    if (streamStart < 0) {
      break;
    }
    const streamEnd = latinText.indexOf("endstream", streamStart);
    if (streamEnd < 0) {
      break;
    }
    const dictionaryStart = Math.max(0, latinText.lastIndexOf("<<", streamStart));
    const dictionaryText = latinText.slice(dictionaryStart, streamStart);
    let contentStart = streamStart + "stream".length;
    if (latinText[contentStart] === "\r" && latinText[contentStart + 1] === "\n") {
      contentStart += 2;
    } else if (latinText[contentStart] === "\n" || latinText[contentStart] === "\r") {
      contentStart += 1;
    }
    let contentEnd = streamEnd;
    while (contentEnd > contentStart && (bytes[contentEnd - 1] === 10 || bytes[contentEnd - 1] === 13)) {
      contentEnd -= 1;
    }
    const streamBytes = bytes.slice(contentStart, contentEnd);
    if (/\/FlateDecode\b/.test(dictionaryText)) {
      const inflated = await inflatePdfStream(streamBytes);
      if (inflated) {
        candidates.push(inflated);
      }
    } else {
      candidates.push(new TextDecoder("latin1", { fatal: false }).decode(streamBytes));
    }
    searchOffset = streamEnd + "endstream".length;
  }
  return candidates.join("\n");
}

function resolveVerificationPayload(raw: string): ReportVerificationPayload | null {
  return extractVerificationPayload(raw) || findPayloadFromVisibleVerificationFields(raw);
}

async function buildReportVerificationRecord(report: EmissionSurveyReportPayload): Promise<ReportVerificationRecord> {
  const issuedAt = new Date().toISOString();
  const payloadHash = await sha256Hex(stableStringify(canonicalReportForVerification(report)));
  const certificateId = `CRN-${issuedAt.slice(0, 10).replace(/-/g, "")}-${payloadHash.slice(0, 12).toUpperCase()}`;
  const integrityCode = (await sha256Hex(`${certificateId}|${payloadHash}|${report.summary.totalEmission}|CARBONET`)).slice(0, 24).toUpperCase();
  return {
    version: 1,
    source: "browser-print",
    certificateId,
    issuedAt,
    reportTitle: report.pageTitle,
    productName: report.productName,
    generatedAt: report.generatedAt,
    totalEmission: report.summary.totalEmission,
    rowCount: report.summary.rowCount,
    calculatedRowCount: report.summary.calculatedRowCount,
    warningCount: report.summary.warningCount,
    payloadHash,
    integrityCode,
    verificationUrl: `${window.location.origin}${buildLocalizedPath("/admin/emission/survey-report-verify", "/en/admin/emission/survey-report-verify")}?certificateId=${encodeURIComponent(certificateId)}`
  };
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function buildReportPdfFileName(report: EmissionSurveyReportPayload) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const name = (report.productName || report.pageTitle || "emission-survey-report")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${name || "emission-survey-report"}-${date}.pdf`;
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

function isOutputByproductRow(row: EmissionSurveyReportRow) {
  return cleanEnglishMaterialName(row.group || row.sectionLabel) === "부산물";
}

function outputProductMassTotal(rows: EmissionSurveyReportRow[]) {
  return rows
    .filter((row) => !isOutputByproductRow(row))
    .reduce((sum, row) => sum + Math.max(row.originalAmount || 0, 0), 0);
}

function outputMassShare(row: EmissionSurveyReportRow, rows: EmissionSurveyReportRow[], outputQuantityTotal: number, byproductAllocation: "allocated" | "unallocated" = "allocated") {
  if (byproductAllocation === "unallocated") {
    if (isOutputByproductRow(row)) {
      return 0;
    }
    const productOnlyMass = outputProductMassTotal(rows);
    return productOnlyMass > 0 ? row.originalAmount / productOnlyMass : 0;
  }
  return outputQuantityTotal > 0 ? row.originalAmount / outputQuantityTotal : 0;
}

function outputNormalizedEmission(row: EmissionSurveyReportRow, rows: EmissionSurveyReportRow[], totalEmission: number, outputQuantityTotal: number, byproductAllocation: "allocated" | "unallocated" = "allocated") {
  return totalEmission * outputMassShare(row, rows, outputQuantityTotal, byproductAllocation);
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

const SURVEY_REPORT_BUILD_MARKER = "survey-report-sync-20260604-0105";

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
                    <p className="mt-1 font-mono text-lg font-black text-slate-950">{formatNumber(outputNormalizationRows.length > 0 ? outputNormalizedEmission(outputNormalizationRows[0], outputNormalizationRows, report.summary.totalEmission, normalization.outputQuantityTotal, byproductAllocation) : 0, 6)}</p>
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
                      <th className="px-4 py-3">{en ? "Mass" : "질량"}</th>

                      <th className="px-4 py-3">{en ? "Emission Factor" : "배출계수"}</th>
                      <th className="px-4 py-3">{en ? "Product Standard Emission" : "제품 기준 배출량"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionGroups.map((group) => (
                      <PrintSectionRows en={en} group={group} key={group.sectionCode} sectionCode={group.sectionCode} />
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white">
                    <tr>
                      <td className="px-4 py-4 text-right text-xs font-black uppercase tracking-[0.16em] text-white/65" colSpan={3}>
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
  const reportArticleRef = useRef<HTMLElement | null>(null);
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
  const [verificationRecord, setVerificationRecord] = useState<ReportVerificationRecord | null>(null);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);

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
          const nextEmissionFactor = row.originalAmount > 0 ? value / row.originalAmount : row.emissionFactor;
          return {
            ...row,
            emissionFactor: nextEmissionFactor,
            emissionFactorText: formatNumber(nextEmissionFactor, 6),
            totalEmission: value,
            calculated: true
          };
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
    setDraftSectionShares((current) => {
      if (!(sectionCode in current)) {
        return current;
      }
      const next = { ...current };
      delete next[sectionCode];
      return next;
    });
    setSectionShareMessage("");
    setDraftReport((current) => {
      if (!current) {
        return current;
      }
      const hasSectionRows = current.rows.some((row) => row.sectionCode === sectionCode && row.calculated && row.sectionCode !== "OUTPUT_PRODUCTS");
      const nextReport = hasSectionRows
        ? syncReportFromRows({
            ...current,
            rows: redistributeRowsBySectionEmission(current.rows, sectionCode, value, current.normalization?.factor || 1)
          })
        : normalizeReportSectionShares({
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
  const handleDownloadPdf = async () => {
    if (!effectiveReport) {
      return;
    }
    setVerificationBusy(true);
    setVerificationMessage("");
    try {
      const record = await buildReportVerificationRecord(effectiveReport);
      saveReportVerificationRecord(record);
      setVerificationRecord(record);
      await nextAnimationFrame();
      await nextAnimationFrame();
      const element = reportArticleRef.current;
      if (!element) {
        throw new Error("Report element is not ready.");
      }
      const module = await import("html2pdf.js");
      const html2pdf = module.default || module;
      const pdfOptions: Record<string, unknown> = {
          filename: buildReportPdfFileName(effectiveReport),
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
            windowWidth: element.scrollWidth
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          margin: [8, 8, 8, 8],
          pagebreak: { mode: ["css", "legacy"], avoid: [".print-break", ".print-card"] }
        };
      const worker = html2pdf()
        .set(pdfOptions)
        .from(element)
        .toPdf();
      await worker.get("pdf").then((pdf: {
        internal: { getNumberOfPages: () => number };
        setPage: (page: number) => void;
        setFontSize: (size: number) => void;
        setTextColor: (r: number, g: number, b: number) => void;
        text: (text: string, x: number, y: number, options?: Record<string, unknown>) => void;
        setProperties?: (properties: Record<string, string>) => void;
      }) => {
        pdf.setPage(Math.max(1, pdf.internal.getNumberOfPages()));
        pdf.setFontSize(1);
        pdf.setTextColor(255, 255, 255);
        pdf.text(verificationPayloadToBlock(record), 1, 1, { maxWidth: 1 });
        pdf.setProperties?.({
          title: record.reportTitle || "Carbonet Emission Survey Report",
          subject: "Carbonet verified emission survey report",
          keywords: `carbonet,verification,${record.certificateId}`,
          creator: "Carbonet"
        });
      });
      await worker.save();
      setVerificationMessage(en ? "PDF file downloaded with hidden verification data." : "숨김 검증 정보가 포함된 PDF 파일을 다운로드했습니다.");
    } catch (error) {
      console.error(error);
      setVerificationMessage(en ? "PDF download failed. Please try again." : "PDF 다운로드에 실패했습니다. 다시 시도하세요.");
    } finally {
      setVerificationBusy(false);
    }
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
        {"@page{size:A4;margin:8mm;}@media print{html,body{background:#fff!important}.print-hidden{display:none!important}.print-sheet{box-shadow:none!important;border:none!important;border-radius:0!important;margin:0!important;max-width:none!important;overflow:visible!important;padding:0!important}.print-page{break-after:page}.print-page:last-child{break-after:auto}.print-break{break-inside:avoid;page-break-inside:avoid}.print-table{break-inside:auto;page-break-inside:auto}.print-table thead{display:table-header-group}.print-table tr{break-inside:avoid;page-break-inside:avoid}.print-card{background:#fff!important;border:1px solid #d8e0ea!important;border-radius:18px!important;box-shadow:none!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pdf-machine-readable{position:absolute!important;left:0!important;top:0!important;width:1px!important;height:1px!important;overflow:hidden!important;color:#fff!important;background:#fff!important;font-size:1px!important;line-height:1px!important;letter-spacing:0!important;white-space:pre-wrap!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-soft-bg{background:#f8fafc!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-ink-bg{background:#0f172a!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-report-hero{background:linear-gradient(135deg,#0f172a,#11284d 42%,#0f766e)!important;color:#fff!important;border:1px solid #0f172a!important;border-radius:20px!important;margin:0 0 16px!important;padding:20px!important;overflow:hidden!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-report-hero-grid{display:grid!important;grid-template-columns:minmax(0,1.4fr) 260px!important;align-items:center!important}.print-report-title-wrap{min-height:112px!important;display:flex!important;align-items:center!important}.print-report-title-tag{color:#a5f3fc!important}.print-report-title{color:#fff!important}.print-report-total-card{width:260px!important;justify-self:end!important;background:rgba(255,255,255,.10)!important;color:#fff!important;border:1px solid rgba(255,255,255,.18)!important;box-shadow:none!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-report-total-card *{color:#fff!important}.print-total-cell{background:#fff!important;color:#0f172a!important;border-top:2px solid #0f172a!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-total-label{border-bottom-left-radius:18px!important}.print-total-box-cell{border-bottom-right-radius:18px!important}.print-total-value{background:#f8fafc!important;color:#0f172a!important;border:1px solid transparent!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}@media screen{.print-input-text{display:none!important}.pdf-machine-readable{position:absolute!important;left:-10000px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;color:transparent!important;background:transparent!important;font-size:1px!important;line-height:1px!important;white-space:pre-wrap!important}}"}
      </style>
      <div className="print-hidden mx-auto mb-4 flex max-w-5xl justify-between gap-3">
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700" onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-report", "/en/admin/emission/survey-report"))} type="button">
          {en ? "Back To Report" : "리포트로 돌아가기"}
        </button>
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-wait disabled:bg-slate-500"
            disabled={verificationBusy}
            onClick={handleDownloadPdf}
            type="button"
          >
            {verificationBusy ? (en ? "Preparing..." : "인증정보 생성 중...") : (en ? "Download PDF With Verification" : "인증정보 포함 PDF 다운로드")}
          </button>
          <button
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800"
            onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-report-verify", "/en/admin/emission/survey-report-verify"))}
            type="button"
          >
            {en ? "Verify PDF" : "진위확인"}
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

      {verificationMessage ? (
        <div className="print-hidden mx-auto mb-4 max-w-5xl rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 shadow-sm">
          {verificationMessage}
        </div>
      ) : null}

      <article className="print-sheet mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)]" ref={reportArticleRef}>
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
                value={outputNormalizationRows.length > 0 ? outputNormalizedEmission(outputNormalizationRows[0], outputNormalizationRows, totalEmission, normalization.outputQuantityTotal, byproductAllocation) : 0}
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
            onSectionEmissionChange={updateSectionEmission}
            onSectionShareChange={updateDraftSectionShare}
            sectionShareInputs={sectionShareInputs}
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
                  <th className="w-[30%] px-3 py-2">{en ? "Mass" : "질량"}</th>
                  <th className="w-[15%] px-3 py-2">{en ? "Emission Factor" : "배출계수"}</th>
                  <th className="w-[15%] px-3 py-2">{en ? "Product Standard Emission" : "제품 기준 배출량"}</th>
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
                        <div className="mt-1 whitespace-nowrap text-xs font-black text-slate-600">ton of {effectiveReport.productName || (en ? "Product" : "제품")}</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section className="print-card mx-8 mb-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                {en ? "Authenticity Evidence" : "진위 식별 정보"}
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                {en ? "Carbonet Report Certificate" : "Carbonet 리포트 인증서"}
              </h2>
              <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-slate-600">
                {en
                  ? "This report stores three verification signals: certificate ID, SHA-256 report fingerprint, and a machine-readable verification block embedded in this print/PDF."
                  : "이 리포트는 인증서 ID, SHA-256 리포트 지문, PDF 내 기계 판독용 검증 블록의 3가지 방식으로 진위 여부를 식별합니다."}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-right">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">{en ? "Status" : "상태"}</p>
              <p className="mt-1 text-sm font-black text-emerald-900">{verificationRecord ? (en ? "Issued" : "발급됨") : (en ? "Prepare before print" : "인쇄 전 발급 필요")}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-white p-3">
              <p className="text-[11px] font-black text-slate-500">{en ? "Certificate ID" : "인증서 ID"}</p>
              <p className="mt-1 break-all font-mono text-sm font-black text-slate-950">{verificationRecord?.certificateId || "-"}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white p-3">
              <p className="text-[11px] font-black text-slate-500">{en ? "Report Fingerprint" : "리포트 지문"}</p>
              <p className="mt-1 break-all font-mono text-xs font-black text-slate-950">{verificationRecord?.payloadHash || "-"}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white p-3">
              <p className="text-[11px] font-black text-slate-500">{en ? "Integrity Code" : "무결성 코드"}</p>
              <p className="mt-1 break-all font-mono text-sm font-black text-slate-950">{verificationRecord?.integrityCode || "-"}</p>
            </div>
          </div>
          {verificationRecord ? (
            <div className="mt-4 rounded-2xl border border-dashed border-emerald-300 bg-white p-3">
              <pre aria-hidden="true" className="pdf-machine-readable">
                {verificationPayloadToBlock(verificationRecord)}
              </pre>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
                {en ? "Upload Verification" : "업로드 검증"}
              </p>
              <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                {en
                  ? "Upload this saved PDF on the authenticity page. No login route is embedded in the PDF."
                  : "저장한 PDF를 진위확인 페이지에 업로드하세요. PDF에는 로그인 경로를 포함하지 않습니다."}
              </p>
            </div>
          ) : null}
        </section>
      </article>
    </main>
  );
}

export function EmissionSurveyReportVerifyPage() {
  const en = isEnglish();
  const [manualBlock, setManualBlock] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploadedVerificationText, setUploadedVerificationText] = useState("");
  const [uploadedPayloadFound, setUploadedPayloadFound] = useState(false);
  const [payload, setPayload] = useState<ReportVerificationPayload | null>(null);
  const [resultMessage, setResultMessage] = useState(en ? "Upload the certificate PDF or paste the verification block." : "인증서 PDF를 업로드하거나 검증 블록을 붙여넣으세요.");
  const [resultTone, setResultTone] = useState<"info" | "success" | "warning">("info");

  const matchedRecord = useMemo(() => {
    if (!payload) {
      return null;
    }
    return loadReportVerificationRecords().find((record) => (
      record.certificateId === payload.certificateId
      && record.payloadHash === payload.payloadHash
      && record.integrityCode === payload.integrityCode
    )) || null;
  }, [payload]);

  const evaluatePayload = (nextPayload: ReportVerificationPayload | null, sourceLabel: string) => {
    if (!nextPayload) {
      setPayload(null);
      setResultTone("warning");
      setResultMessage(en
        ? `No Carbonet verification block was found in ${sourceLabel}. If the browser compressed PDF text, paste the block printed on the last page.`
        : `${sourceLabel}에서 Carbonet 검증 블록을 찾지 못했습니다. 브라우저가 PDF 텍스트를 압축했다면 마지막 페이지의 검증 블록을 붙여넣으세요.`);
      return;
    }
    const records = loadReportVerificationRecords();
    const exact = records.some((record) => (
      record.certificateId === nextPayload.certificateId
      && record.payloadHash === nextPayload.payloadHash
      && record.integrityCode === nextPayload.integrityCode
    ));
    const sameId = records.some((record) => record.certificateId === nextPayload.certificateId);
    setPayload(nextPayload);
    if (exact) {
      setResultTone("success");
      setResultMessage(en ? "Authenticity verified against the local issued-record registry." : "로컬 발급 이력과 일치하여 진위 확인이 완료되었습니다.");
      return;
    }
    setResultTone("warning");
    setResultMessage(sameId
      ? (en ? "Certificate ID exists, but fingerprint or integrity code does not match." : "인증서 ID는 존재하지만 리포트 지문 또는 무결성 코드가 일치하지 않습니다.")
      : (en ? "Verification block is readable, but no matching local issued record exists on this browser." : "검증 블록은 읽었지만 이 브라우저의 발급 이력에서 일치하는 기록을 찾지 못했습니다."));
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const extractedText = await extractPdfVerificationText(buffer);
    const nextPayload = resolveVerificationPayload(extractedText);
    setUploadedVerificationText(extractedText);
    setUploadedPayloadFound(Boolean(nextPayload));
    evaluatePayload(nextPayload, file.name);
  };

  const handleManualVerify = () => {
    const sourceText = manualBlock.trim() || uploadedVerificationText;
    const sourceLabel = manualBlock.trim()
      ? (en ? "manual input" : "수동 입력값")
      : (fileName || (en ? "uploaded PDF" : "업로드 PDF"));
    evaluatePayload(resolveVerificationPayload(sourceText), sourceLabel);
  };

  const toneClass = resultTone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : resultTone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-sky-200 bg-sky-50 text-sky-950";

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Emissions / Survey" : "배출/설문" },
        { label: en ? "Report Authenticity" : "리포트 진위확인" }
      ]}
      title={en ? "Emission Survey Report Authenticity" : "배출 설문 리포트 진위확인"}
      subtitle={en ? "Upload a downloaded certificate PDF and verify the certificate ID, report fingerprint, and integrity block." : "다운로드한 인증서 PDF를 업로드하여 인증서 ID, 리포트 지문, 무결성 블록을 확인합니다."}
    >
      <AdminWorkspacePageFrame>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{en ? "PDF Verification" : "PDF 검증"}</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{en ? "Upload Certificate PDF" : "인증서 PDF 업로드"}</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  {en ? "Use the PDF saved from the report print screen. The verification block printed on the last page is read automatically when the PDF keeps text data." : "리포트 출력 화면에서 저장한 PDF를 사용하세요. PDF에 텍스트 데이터가 남아 있으면 마지막 페이지의 검증 블록을 자동으로 읽습니다."}
                </p>
              </div>
              <MemberButton onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-report-print?lang=ko", "/en/admin/emission/survey-report-print?lang=en"))} type="button" variant="secondary">
                {en ? "Open PDF Download" : "PDF 다운로드 화면 열기"}
              </MemberButton>
            </div>
            <label className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center hover:border-emerald-400 hover:bg-emerald-50">
              <span className="text-base font-black text-slate-900">{fileName || (en ? "Choose PDF file" : "PDF 파일 선택")}</span>
              <span className="mt-2 text-sm font-semibold text-slate-500">{en ? "PDF files are preferred. Text-based saved PDFs can be verified automatically." : "PDF 파일 권장. 텍스트 기반 저장 PDF는 자동 검증됩니다."}</span>
              <input accept="application/pdf,.pdf" className="sr-only" onChange={handleFileChange} type="file" />
            </label>
            {fileName ? (
              <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-bold ${uploadedPayloadFound ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                {uploadedPayloadFound
                  ? (en ? "Verification data was found in the uploaded PDF. The button below can verify it again." : "업로드한 PDF에서 검증 데이터를 찾았습니다. 아래 버튼으로 다시 확인할 수 있습니다.")
                  : (en ? "The uploaded PDF was read, but the verification block was not found. Paste the block from the last report page below if needed." : "업로드한 PDF는 읽었지만 검증 블록을 찾지 못했습니다. 필요하면 리포트 마지막 페이지의 검증 블록을 아래에 붙여넣으세요.")}
              </div>
            ) : null}

            <div className="mt-5">
              <label className="text-sm font-black text-slate-800" htmlFor="manual-verification-block">
                {en ? "Manual verification block" : "수동 검증 블록"}
              </label>
              <textarea
                className="mt-2 min-h-36 w-full rounded-2xl border border-slate-300 bg-white p-4 font-mono text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                id="manual-verification-block"
                onChange={(event) => setManualBlock(event.target.value)}
                placeholder={`${REPORT_VERIFY_BEGIN}\n...\n${REPORT_VERIFY_END}`}
                value={manualBlock}
              />
              <div className="mt-3 flex justify-end">
                <MemberButton onClick={handleManualVerify} type="button">
                  {en ? "Verify Uploaded PDF / Block" : "업로드 PDF / 검증 블록 확인"}
                </MemberButton>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
              <p className="text-xs font-black uppercase tracking-[0.16em] opacity-80">{en ? "Verification Result" : "검증 결과"}</p>
              <h2 className="mt-2 text-xl font-black">
                {resultTone === "success" ? (en ? "Valid" : "정상") : resultTone === "warning" ? (en ? "Needs Review" : "확인 필요") : (en ? "Waiting" : "대기")}
              </h2>
              <p className="mt-2 text-sm font-bold leading-6">{resultMessage}</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{en ? "Three Verification Signals" : "3가지 식별 방식"}</p>
              <div className="mt-4 space-y-3">
                {[
                  [en ? "Certificate ID" : "인증서 ID", payload?.certificateId || "-"],
                  [en ? "SHA-256 Fingerprint" : "SHA-256 리포트 지문", payload?.payloadHash || "-"],
                  [en ? "Integrity Code" : "무결성 코드", payload?.integrityCode || "-"]
                ].map(([label, value]) => (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3" key={label}>
                    <p className="text-[11px] font-black text-slate-500">{label}</p>
                    <p className="mt-1 break-all font-mono text-xs font-black text-slate-950">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{en ? "Issued Record" : "발급 이력"}</p>
              {matchedRecord ? (
                <div className="mt-3 space-y-2 text-sm font-bold text-slate-700">
                  <p>{en ? "Issued at" : "발급일시"}: {new Date(matchedRecord.issuedAt).toLocaleString()}</p>
                  <p>{en ? "Product" : "제품"}: {matchedRecord.productName || "-"}</p>
                  <p>{en ? "Total emission" : "총 배출량"}: {formatNumber(matchedRecord.totalEmission, 4)} kg CO2e</p>
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                  {en ? "No matching local issued record has been selected yet." : "아직 일치하는 로컬 발급 이력이 선택되지 않았습니다."}
                </p>
              )}
            </section>
          </aside>
        </div>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
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
  const lcaSoftware = defaultLcaSoftwareLabel();

  logGovernanceScope("PAGE", "emission-survey-lca-summary-print", {
    route: window.location.pathname,
    hasSessionPayload: Boolean(report),
    productName: report?.productName || "",
    buildMarker: SURVEY_REPORT_BUILD_MARKER
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
  const tableHeaderClass = "border border-[#cccccc] bg-[#d9d9d9] px-3 py-2 text-center text-[8px] font-black text-slate-950";
  const tableLabelClass = "border border-[#cccccc] bg-[#f2f2f2] px-3 py-2 text-[8px] font-black text-[#4f6fd5]";
  const tableCellClass = "border border-[#cccccc] px-3 py-2 text-[8px] font-semibold leading-4 text-slate-800";
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
        {"@page{size:A4;margin:60px;}@media print{html,body{background:#fff!important}.print-hidden{display:none!important}main{padding:60px!important;box-sizing:border-box!important}.lca-sheet{box-shadow:none!important;border:none!important;border-radius:0!important;margin:0!important;max-width:none!important;width:100%!important;box-sizing:border-box!important;padding:0!important;font-family:\"Pretendard GOV\",\"Noto Sans KR\",sans-serif!important;font-size:10pt!important;font-weight:400!important;line-height:1.35!important}.lca-sheet header{min-height:25px!important;margin-bottom:8px!important}.lca-sheet header,.lca-sheet header *{font-family:\"Pretendard GOV\",\"Noto Sans KR\",sans-serif!important;font-size:18pt!important;font-weight:600!important;line-height:1.2!important}.lca-sheet h2{font-family:\"Pretendard GOV\",\"Noto Sans KR\",sans-serif!important;font-size:12pt!important;font-weight:600!important;line-height:1.2!important;margin-bottom:6px!important}.lca-page-2>h2{font-size:18pt!important;font-weight:600!important;margin-bottom:18pt!important}.lca-sheet p,.lca-overview-copy{font-family:\"Pretendard GOV\",\"Noto Sans KR\",sans-serif!important;font-size:9pt!important;font-weight:400!important;line-height:1.45!important}.lca-section{break-inside:avoid;page-break-inside:avoid;margin-top:26px!important}.lca-page-2{break-before:page!important;page-break-before:always!important;margin-top:0!important;padding-top:60px!important}.lca-sheet>.lca-section:last-child{padding-bottom:0!important}.lca-table{break-inside:auto;page-break-inside:auto;font-family:\"Pretendard GOV\",\"Noto Sans KR\",sans-serif!important;font-size:7pt!important;font-weight:400!important;width:100%!important}.lca-table thead{display:table-header-group}.lca-table tr{break-inside:avoid;page-break-inside:avoid}.lca-table th{background:#d9d9d9!important;color:#0f172a!important;padding:5px 7px!important;font-family:\"Pretendard GOV\",\"Noto Sans KR\",sans-serif!important;font-size:7pt!important;font-weight:500!important;line-height:1.25!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.lca-table td{padding:5px 7px!important;font-family:\"Pretendard GOV\",\"Noto Sans KR\",sans-serif!important;font-size:7pt!important;font-weight:400!important;line-height:1.25!important}.lca-page-1-table,.lca-page-1-table th,.lca-page-1-table td{font-size:9pt!important;line-height:1.3!important}.lca-table td.bg-\[\#f2f2f2\],.lca-table td[class*='bg-[#f2f2f2]']{background:#f2f2f2!important;font-weight:500!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-input-control{display:none!important}.print-input-text{display:inline!important;color:inherit!important;font:inherit!important;font-weight:inherit!important;line-height:inherit!important;white-space:pre-wrap!important}.lca-auto{background:transparent!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.lca-screen-note{display:none!important}}@media screen{.print-input-text{display:none!important}.lca-required-field{background-image:linear-gradient(135deg,#ef233c 0 8px,transparent 8px)!important;background-repeat:no-repeat!important;background-position:left top!important;background-size:12px 12px!important}.lca-page-1-table,.lca-page-1-table th,.lca-page-1-table td{font-size:9px!important;line-height:1.3!important}.lca-overview-copy{font-size:9px!important;line-height:1.45!important}}"}
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

      <article className="lca-sheet mx-auto max-w-[900px] rounded-[20px] border border-white bg-white p-6 text-[12px] shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
        <header className="text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
            <EditableText className={`${textFieldClass} lca-fill !w-auto min-w-[170px] text-center text-2xl`} onCommit={setCompanyName} placeholder="* 기업명(예: 00건설)" value={companyName} />
            <span>{en ? "Product LCA Summary" : "제품 LCA 수행 개요"}</span>
          </div>
        </header>

        <section className="lca-section mt-4">
          <h2 className="mb-2 text-base font-black text-slate-950">1. {en ? "Terms" : "용어정의"}</h2>
          <table className="lca-table lca-page-1-table w-full border-collapse">
            <thead>
              <tr>
                <th className={`${tableHeaderClass} w-[24%] text-left`}>{en ? "Term" : "용어"}</th>
                <th className={`${tableHeaderClass} text-left`}>{en ? "Description" : "설명"}</th>
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

        <section className="lca-section mt-4">
          <h2 className="mb-2 text-base font-black text-slate-950">2. ISO 14040/44 {en ? "Main Application" : "기반의 주요 적용 사항"}</h2>
          <table className="lca-table lca-page-1-table w-full border-collapse">
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

        <section className="lca-section lca-page-2 mt-0">
          <h2 className="mb-5 text-base font-black text-slate-950">{en ? "Summary" : "결과 요약"}</h2>
          <p className="lca-overview-copy leading-6 text-slate-800">
            {en ? "The target " : "당사가 생산하는 "}
            <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[260px] align-middle`} onCommit={setProductFamily} placeholder="* 구분(예: 건설기계)(제품명: 모델, A123-4)" value={productFamily} />
            {en ? " product was assessed according to ISO 14040 and ISO 14044 procedures. The scope was set as Cradle to Gate, including raw material acquisition, processing, and product manufacturing. The functional unit was defined as " : " 제품은 ISO14040 및 ISO14044 지침의 일반적 절차와 요구 사항에 따라 LCA를 수행하였다. 영향 평가의 대상 범위는 ISO14025, ISO/TS14067에 따라 Cradle to Gate로 설정하여, 원료채취 및 가공, 제품 제조를 포함하고 있다. 평가대상의 기준단위는 "}
            <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[260px] align-middle`} onCommit={setFunctionalUnit} placeholder={`* 산정된 탄소배출량의 단위\n예: 단위 제품 생산당, 단위 작동 시간당 등`} value={functionalUnit} />
            {en ? "." : " 배출량으로 정의하였다."}
          </p>
          <p className="lca-overview-copy mt-2 leading-6 text-slate-800">
            {en ? "The LCA model was developed based on " : "LCA 수행은 ISO 지침에 따라 "}
            <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[180px] align-middle`} onCommit={setCompanyName} placeholder="* 기업명(예: 00건설)" value={companyName} />
            {en ? " process information, and the carbon emission impact result was derived." : "의 공정현황을 기반으로 "}
            {!en ? (
              <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[160px] align-middle`} onCommit={setProductFamily} placeholder="* 구분(예: 건설기계)" value={productFamily} />
            ) : null}
            {en ? "" : " 제품 LCA 수행 모델을 개발하여 진행되었다. 해당 수행 모델을 기반으로 제품의 탄소배출량(Global Warming Potential)에 대한 영향 평가 결과를 도출하였다."}
          </p>
        </section>

        <section className="lca-section mt-4">
          <h2 className="mb-2 text-base font-black text-slate-950">1. {en ? "Product Information" : "제품정보"}</h2>
          <table className="lca-table w-full border-collapse">
            <tbody>
              <tr>
                <td className={`${tableLabelClass} w-[28%]`}>{en ? "Product model" : "제품모델"}</td>
                <td className={tableCellClass} colSpan={4}><EditableText className={`${textFieldClass} lca-fill`} onCommit={setProductModel} placeholder="* 제품명으로 수정" value={productModel} /></td>
              </tr>
              <tr>
                <td className={tableLabelClass}>{en ? "General information" : "제품 일반 정보"}</td>
                <td className={tableCellClass} colSpan={4}><EditableText className={`${textFieldClass} lca-fill`} maxLength={300} multiline onCommit={setProductDescription} placeholder={`* 모델명으로 수정\n제품 일반 정보를 입력`} value={productDescription} /></td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} w-[28%] align-middle`} rowSpan={2}>Product Spec.</td>
                <td className={tableHeaderClass}>{en ? "Product name" : "제품명"}</td>
                <td className={tableHeaderClass}>{en ? "Model name" : "모델명"}</td>
                <td className={tableHeaderClass}>{en ? "Equipment weight(ton)" : "장비중량(ton)"}</td>
                <td className={tableHeaderClass}>버킷 용량(m2)</td>
              </tr>
              <tr>
                <td className={`${tableCellClass} text-center`}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setProductModel} placeholder="* 제품명" value={productModel} /></td>
                <td className={`${tableCellClass} text-center`}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setProductType} placeholder="* 모델명" value={productType} /></td>
                <td className={`${tableCellClass} text-center`}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setEquipmentWeight} placeholder="장비중량(ton)" value={equipmentWeight} /></td>
                <td className={`${tableCellClass} text-center`}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setBucketCapacity} placeholder="버킷 용량(m2)" value={bucketCapacity} /></td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} w-[28%]`}>{en ? "Reference flow" : "중량정보(기준흐름)"}</td>
                <td className={tableCellClass} colSpan={4}><EditableText className={`${textFieldClass} lca-fill`} onCommit={setReferenceFlow} placeholder="* 중량정보(기준흐름)" value={referenceFlow} /></td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="lca-section mt-4">
          <h2 className="mb-2 text-base font-black text-slate-950">2. {en ? "LCA Execution Information" : "LCA 수행 정보"}</h2>
          <table className="lca-table w-full border-collapse">
            <tbody>
              <tr>
                <td className={`${tableLabelClass} w-[25%]`}>{en ? "Functional unit" : "기능단위"}</td>
                <td className={tableCellClass} colSpan={4}><EditableText className={`${textFieldClass} lca-fill`} onCommit={setFunctionalUnit} placeholder={`* 산정된 탄소배출량의 단위\n예: 단위 제품 생산당, 단위 작동 시간당 등`} value={functionalUnit} /></td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} align-middle`} rowSpan={5}>{en ? "System boundary" : "시스템경계"}</td>
                <th className={tableHeaderClass}>{en ? "Analysis stage" : "분석 단계"}</th>
                <th className={tableHeaderClass} colSpan={2}>{en ? "Detailed scope" : "세부 범위"}</th>
                <th className={tableHeaderClass}>{en ? "Included" : "분석 포함 여부"}</th>
              </tr>
              <tr>
                <td className={`${tableCellClass} text-center align-middle`} rowSpan={3}>제조전 단계</td>
                <td className={tableCellClass} colSpan={2}>원료물질 채취 및 제조공정</td>
                <td className={`${tableCellClass} text-center`}>●</td>
              </tr>
              <tr>
                <td className={tableCellClass} colSpan={2}>1차 협력업체 생산제품 제조</td>
                <td className={`${tableCellClass} text-center`}>X</td>
              </tr>
              <tr>
                <td className={tableCellClass} colSpan={2}>수송(협력업체→제조사업장)</td>
                <td className={`${tableCellClass} text-center`}>X</td>
              </tr>
              <tr>
                <td className={`${tableCellClass} text-center align-middle`}>제조 단계</td>
                <td className={tableCellClass} colSpan={2}>제품 제조 공정</td>
                <td className={`${tableCellClass} text-center`}>●</td>
              </tr>
              <tr>
                <td className={tableLabelClass}>{en ? "Data quality" : "데이터 품질"}</td>
                <td className={tableCellClass} colSpan={4}>
                  <div className="leading-7">
                    <div>· Upstream : secondary data(LCI DB)</div>
                    <div> · Core : 현장데이터 및 LCI DB</div>
                    <div className="pl-4">
                   - Time Related Scope :{" "}
                    <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[150px] align-middle`} onCommit={setDataPeriod} value={dataPeriod} placeholder="* 0000.00.00 ~ 0000.00.00" />
                    </div>
                    <div className="pl-4">
                      - Region Scope :{" "}
                      <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[220px] align-middle`} onCommit={setRegionScope} placeholder="* 지역 범위(예: 00건설 00공장)" value={regionScope} />
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td className={tableLabelClass}>LCA Software</td>
                <td className={`${tableCellClass} lca-auto bg-amber-100`} colSpan={4}>
                  <span className="block font-black text-slate-950">{lcaSoftware || "-"}</span>
                </td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} align-middle`} rowSpan={2}>LCIA Method</td>
                <th className={`${tableHeaderClass} w-[20%]`}>Impact category</th>
                <th className={`${tableHeaderClass} w-[30%]`}>Indicator</th>
                <th className={`${tableHeaderClass} w-[14%]`}>Unit</th>
                <th className={`${tableHeaderClass} w-[26%]`}>Recommended default LCIA method</th>
              </tr>
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
        </section>

        <section className="lca-section mt-4">
          <h2 className="mb-2 text-base font-black text-slate-950">3. {en ? "Impact Assessment Result" : "영향평가 결과"}</h2>
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
  placeholder = "",
  maxLength = 500
}: {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const [draft, setDraft] = useState(value);
  const requiredClassName = placeholder.trim().startsWith("*") ? "lca-required-field" : "";
  useEffect(() => {
    setDraft(value);
  }, [value]);
  if (multiline) {
    return (
      <>
        <textarea
          className={`print-input-control w-full ${requiredClassName} ${className}`.trim()}
          maxLength={maxLength}
          onBlur={() => onCommit(draft)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          placeholder={placeholder}
          rows={3}
          value={draft}
        />
          <span className="print-input-text">{draft.trim() || "-"}</span>
      </>
    );
  }
  return (
    <>
      <input
        className={`print-input-control w-full ${requiredClassName} ${className}`.trim()}
        maxLength={maxLength}
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
      <span className="print-input-text">{draft.trim() || "-"}</span>
    </>
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

  const editable = Boolean(onRowNumberChange || onRowTextChange || onRowShareChange);

  return (
    <div className="print-table overflow-hidden rounded-3xl border border-amber-300 bg-white print:overflow-hidden">
      <table className="print-table w-full table-fixed border-separate border-spacing-0 text-[11px]">
        <thead className="bg-amber-50">
          <tr className="text-left font-black text-amber-900">
            <th className="w-[12%] whitespace-nowrap rounded-tl-3xl border-b border-amber-200 px-3 py-3 text-center">{en ? "Model name" : "모델명"}</th>
            <th className="w-[28%] border-b border-amber-200 px-2 py-3">{en ? "Output" : "출력물"}</th>
            <th className="w-[16%] whitespace-nowrap border-b border-amber-200 px-2 py-3 text-center">{en ? "Process Standard Mass" : "공정기준질량"}</th>
            <th className="w-[10%] whitespace-nowrap border-b border-amber-200 px-2 py-3 text-center">{en ? "Mass Share" : "질량 비중"}</th>
            <th className="w-[17%] border-b border-amber-200 px-2 py-3 text-center">{en ? "Emission (by Mass Share)" : "질량 비중에 따른 배출량 계산"}</th>
            <th className="w-[17%] rounded-tr-3xl border-b border-amber-200 px-2 py-3 text-center">{en ? "Emission per ton" : "배출량(1톤 기준)"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const massShare = outputMassShare(row, rows, outputQuantityTotal, byproductAllocation || "allocated");
            const displaySharePercent = massShare * 100;
            const effectiveNormalizationFactor = normalizationFactor || 1;
            const sourceTotalEmission = effectiveNormalizationFactor > 0 ? totalEmission / effectiveNormalizationFactor : totalEmission;
            const massShareEmission = sourceTotalEmission * massShare;
            const perTonEmission = outputQuantityTotal > 0 ? (sourceTotalEmission / outputQuantityTotal) * massShare : totalEmission * massShare;
            return (
              <tr className="border-b border-amber-100 align-middle" key={row.rowId}>
                <td className="px-3 py-3 align-middle text-slate-600 font-bold text-center bg-slate-50/40">
                  {groupLabel(row, en)}
                </td>
                <td className="px-3 py-3 align-middle">
                  {editable ? (
                    <EditableText
                      multiline
                      className="min-h-[3.9rem] resize-none bg-transparent text-sm font-black leading-snug text-slate-950 print:min-h-0 print:whitespace-pre-wrap"
                      onCommit={(value) => onRowTextChange?.(row.rowId, "materialName", value)}
                      value={en ? resolveEnglishMaterialName(row.materialName, englishNameMap || {}) : (row.materialName || "-")}
                    />
                  ) : (
                    <span className="block whitespace-pre-wrap text-sm font-black leading-snug text-slate-950">
                      {en ? resolveEnglishMaterialName(row.materialName, englishNameMap || {}) : (row.materialName || "-")}
                    </span>
                  )}
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-amber-100">
                    <div className="h-full rounded-full bg-amber-600" style={{ width: `${Math.max(2, Math.min(displaySharePercent, 100))}%` }} />
                  </div>
                </td>
                <td className="px-2 py-3 text-center">
                  <span className="inline-flex items-baseline justify-center gap-0.5 whitespace-nowrap font-mono text-[11px] font-black text-slate-900">
                    {editable ? (
                      <EditableNumber
                        className="inline-block w-12 bg-transparent text-center font-mono font-black"
                        digits={2}
                        onCommit={(value) => onRowNumberChange?.(row.rowId, "originalAmount", value)}
                        value={row.originalAmount}
                      />
                    ) : (
                      <span>{formatNumber(row.originalAmount, 2)}</span>
                    )}
                    <span className="text-[9px] font-bold text-slate-500">{row.unit || ""}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-center font-mono font-black">
                  <span className="inline-flex items-baseline justify-center gap-0.5 whitespace-nowrap text-slate-950">
                    {editable ? (
                      <EditableNumber
                        className="inline-block w-10 bg-transparent text-center font-mono font-black"
                        digits={2}
                        onCommit={(value) => onRowShareChange?.(row.rowId, value)}
                        value={displaySharePercent}
                      />
                    ) : (
                      <span>{formatNumber(displaySharePercent, 2)}</span>
                    )}
                    <span>%</span>
                  </span>
                </td>
                <td className="px-2 py-3 text-center align-middle">
                  <div className="inline-flex flex-col items-center justify-center leading-none">
                    <span className="font-mono text-sm font-black text-slate-950">{formatNumber(massShareEmission, 2)}</span>
                    <span className="mt-1 text-[9px] font-bold text-slate-500 whitespace-nowrap">kg CO2e</span>
                  </div>
                </td>
                <td className="px-2 py-3 text-center align-middle">
                  <div className="inline-flex flex-col items-center justify-center leading-none">
                    <span className="font-mono text-sm font-black text-slate-950">{formatNumber(perTonEmission, 2)}</span>
                    <span className="mt-1 text-[9px] font-bold text-slate-500 whitespace-nowrap">
                      kg CO2e/ton of <br />{en ? (productName || "Product") : (productName || "제품")}
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
  const editable = Boolean(onRowChange || onRowNumberChange);

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
            {editable ? (
              <EditableText
                className="w-full bg-transparent font-bold leading-tight text-slate-900"
                onCommit={(value) => onRowChange?.(row.rowId, "materialName", value)}
                value={en ? resolveEnglishMaterialName(row.materialName, englishNameMap || {}) : (row.materialName || "-")}
              />
            ) : (
              <span className="block whitespace-nowrap font-bold leading-tight text-slate-900">
                {en ? resolveEnglishMaterialName(row.materialName, englishNameMap || {}) : (row.materialName || "-")}
              </span>
            )}
          </td>
          <td className="px-3 py-2">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1">
              <span className="min-w-12 text-[10px] font-bold text-slate-500">{en ? "Mass" : "질량"}</span>
              <span className="whitespace-nowrap font-mono">
                {editable ? (
                  <EditableNumber
                    className="inline-block w-20 bg-transparent text-right font-mono"
                    digits={2}
                    onCommit={(value) => onRowNumberChange?.(row.rowId, "originalAmount", value)}
                    value={row.originalAmount}
                  />
                ) : (
                  <span>{formatNumber(row.originalAmount, 2)}</span>
                )} {row.unit || ""}
              </span>
            </div>
          </td>
          <td className="px-3 py-2">
            {editable ? (
              <EditableNumber
                className="inline-block w-24 bg-transparent font-mono"
                digits={2}
                onCommit={(value) => onRowNumberChange?.(row.rowId, "emissionFactor", value)}
                value={row.emissionFactor}
              />
            ) : (
              <span className="font-mono">{formatNumber(row.emissionFactor, 2)}</span>
            )}
          </td>
          <td className="px-3 py-2 font-black">
            {row.calculated && editable ? (
              <EditableNumber
                className="w-20 bg-transparent font-black"
                onCommit={(value) => onRowNumberChange?.(row.rowId, "totalEmission", value)}
                value={row.originalAmount * row.emissionFactor}
              />
            ) : row.calculated ? (
              <span className="font-mono">{formatNumber(row.originalAmount * row.emissionFactor, 2)}</span>
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
  onCopy,
  onSectionEmissionChange,
  onSectionShareChange,
  sectionShareInputs = {}
}: {
  sections: EmissionSurveyReportSectionSummary[];
  title: string;
  en: boolean;
  onCopy?: () => void;
  onSectionEmissionChange?: (sectionCode: string, value: number) => void;
  onSectionShareChange?: (sectionCode: string, value: number) => void;
  sectionShareInputs?: Record<string, number>;
}) {
  const pieSlices = buildPieSlices(sections);
  return (
    <div className="rounded-[calc(var(--kr-gov-radius)+4px)] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
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
                <p className="text-xs font-black text-slate-950">
                  {onSectionShareChange ? (
                    <>
                      <EditableNumber
                        className="inline-block w-14 bg-transparent text-right font-mono font-black"
                        digits={1}
                        onCommit={(value) => onSectionShareChange(section.sectionCode, value)}
                        value={sectionShareInputs[section.sectionCode] ?? section.sharePercent}
                      />%
                    </>
                  ) : formatPercent(section.sharePercent)}
                </p>
                <p className="text-[10px] font-bold text-slate-500">
                  {onSectionEmissionChange ? (
                    <EditableNumber
                      className="inline-block w-20 bg-transparent text-right font-mono font-bold text-slate-500"
                      onCommit={(value) => onSectionEmissionChange(section.sectionCode, value)}
                      value={section.totalEmission}
                    />
                  ) : formatNumber(section.totalEmission)} kg CO2e
                </p>
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
