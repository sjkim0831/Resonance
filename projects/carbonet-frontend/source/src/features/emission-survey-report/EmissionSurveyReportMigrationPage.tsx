import React, { useEffect, useMemo, useRef, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  fetchSurveyEcoinventAiRecommendationPage,
  fetchSurveyMaterialEnglishNames,
  issueSurveyReportPdf,
  issueSurveyReportVerification,
  proofreadSurveyReportLabels,
  registerSurveyReportVisualProfile,
  verifySurveyReportDataset,
  verifySurveyReportPdfFile,
  verifySurveyReportPhoto,
  recognizeSurveyReportPages,
  type ReportPageOcrResponse,
  type ReportPdfFileVerificationResponse,
  type ReportPhotoVerificationResponse,
  type ReportDatasetVerificationResponse,
  type ReportOcrIssuanceEvidence,
  type ReportVerificationDatasetPayload
} from "../../lib/api/emission";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice, WarningPanel } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminSelect, MemberButton, MemberButtonGroup } from "../member/common";
import { validateReportRequiredFields } from "../report-required-fields/reportRequiredFields";
import {
  loadEmissionSurveyReportSession,
  saveEmissionSurveyReportSession,
  type EmissionSurveyReportPayload,
  type EmissionSurveyReportRow,
  type EmissionSurveyReportSectionSummary
} from "./reportSession";

const MAX_REPORT_VERIFICATION_PAGES = 10;

export type CertificateVerificationScreenSection = {
  code: string;
  order: number;
  visible: boolean;
  koLabel: string;
  enLabel: string;
};

export type CertificateVerificationScreenDesign = {
  schemaVersion: number;
  designVersion: string;
  runtimeCommit?: string;
  active: boolean;
  hero: { koEyebrow: string; enEyebrow: string; koTitle: string; enTitle: string; koDescription: string; enDescription: string };
  sections: CertificateVerificationScreenSection[];
  supportCards: Array<{ code: string; koTitle: string; enTitle: string; koBody: string; enBody: string }>;
  qaScenarios: Array<{ code: string; koLabel: string; enLabel: string }>;
};

function toEnglishTitleCase(value: string) {
  return value.replace(/[A-Za-z]+(?:'[A-Za-z]+)?/g, (word) => {
    const lower = word.toLocaleLowerCase("en-US");
    return lower.charAt(0).toLocaleUpperCase("en-US") + lower.slice(1);
  });
}

function useEnglishTitleCase(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const scopeClass = "emission-report-english-title-case";
    const styleId = "emission-report-english-title-case-style";
    document.body.classList.add(scopeClass);
    let titleCaseStyle = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!titleCaseStyle) {
      titleCaseStyle = document.createElement("style");
      titleCaseStyle.id = styleId;
      titleCaseStyle.textContent = `
        body.${scopeClass} .uppercase,
        body.${scopeClass} [style*="text-transform: uppercase"] {
          text-transform: capitalize !important;
        }
      `;
      document.head.appendChild(titleCaseStyle);
    }

    const shouldSkip = (node: Text) => {
      const parent = node.parentElement;
      return !parent || Boolean(parent.closest("script, style, code, pre, textarea, input, [data-preserve-case='true']"));
    };
    const normalizeText = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        const textNode = root as Text;
        if (!shouldSkip(textNode)) {
          const normalized = toEnglishTitleCase(textNode.data);
          if (normalized !== textNode.data) textNode.data = normalized;
        }
        return;
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        const textNode = current as Text;
        if (!shouldSkip(textNode)) {
          const normalized = toEnglishTitleCase(textNode.data);
          if (normalized !== textNode.data) textNode.data = normalized;
        }
        current = walker.nextNode();
      }
    };

    normalizeText(document.body);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") {
          normalizeText(mutation.target);
          return;
        }
        mutation.addedNodes.forEach(normalizeText);
      });
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      document.body.classList.remove(scopeClass);
      document.getElementById(styleId)?.remove();
    };
  }, [enabled]);
}

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
}

function reportComparisonLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function verificationFieldLabel(path: string, en: boolean) {
  const field = path.replace(/^\$\.?/, "").split(".").pop()?.replace(/\[\d+\]/g, "") || path;
  const labels: Record<string, [string, string]> = {
    productName: ["제품명", "Product"], materialName: ["물질명", "Material"], sectionLabel: ["섹션", "Section"],
    amount: ["사용량", "Amount"], amountDisplay: ["사용량 표시값", "Displayed amount"], annualUnit: ["단위", "Unit"],
    emissionFactor: ["배출계수", "Emission factor"], emissionFactorDisplay: ["배출계수 표시값", "Displayed factor"],
    totalEmission: ["배출량", "Emission"], totalEmissionDisplay: ["배출량 표시값", "Displayed emission"],
    totalCarbonEmission: ["총 탄소배출량", "Total carbon emission"], totalOutputMass: ["총 산출물 질량", "Total output mass"],
    productGwp: ["제품 GWP", "Product GWP"], processGwp: ["공정 GWP", "Process GWP"],
    processReferenceMass: ["공정 기준 질량", "Process reference mass"], massSharePercent: ["질량 비율", "Mass share"],
    allocatedEmission: ["질량 비율 배출량", "Allocated emission"], emissionPerTon: ["1톤 기준 배출량", "Emission per ton"]
  };
  const label = labels[field];
  return label ? label[en ? 1 : 0] : field || path;
}

const REPORT_VERIFICATION_STORAGE_KEY = "carbonet:emission-survey-report-verification:v1";
const REPORT_VERIFY_BEGIN = "CARBONET_REPORT_VERIFY_BEGIN";
const REPORT_VERIFY_END = "CARBONET_REPORT_VERIFY_END";

type ReportVerificationPayload = {
  reportType?: ReportVerificationType;
  version: 1 | 2;
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
  datasetHash?: string;
  dataset?: Record<string, unknown>;
};

type ReportVerificationType = "EMISSION_SURVEY" | "LCA_SUMMARY";
type ReportDamageRegion = NonNullable<ReportPhotoVerificationResponse["damagedRegions"]>[number];
type ReportCandidateComparison = NonNullable<ReportPhotoVerificationResponse["comparisons"]>[number];

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

function canonicalReportForVerification(report: EmissionSurveyReportPayload, byproductAllocation: "allocated" | "unallocated" = "allocated") {
  const outputRows = buildOutputNormalizationRows(report.rows);
  const outputQuantityTotal = report.normalization?.outputQuantityTotal || outputRows.reduce((sum, row) => sum + Math.max(row.originalAmount || 0, 0), 0);
  const processGwp = outputQuantityTotal > 0 ? report.summary.totalEmission / outputQuantityTotal : 0;
  const productRow = outputRows.find((row) => !isOutputByproductRow(row));
  return {
    generatedAt: report.generatedAt,
    productName: report.productName,
    pageTitle: report.pageTitle,
    displayTitle: "제품/부산물 배출계수 리포트",
    classification: report.classification,
    calculationScope: report.calculationScope,
    summary: report.summary,
    normalization: report.normalization,
    sectionSummaries: report.sectionSummaries,
    verificationSummary: {
      totalCarbonEmission: report.summary.totalEmission,
      totalCarbonEmissionDisplay: formatNumber(report.summary.totalEmission, 2),
      totalOutputMass: outputQuantityTotal,
      totalOutputMassDisplay: formatNumber(outputQuantityTotal, 2),
      productGwp: productRow ? outputNormalizedEmission(productRow, outputRows, report.summary.totalEmission, outputQuantityTotal, byproductAllocation) : 0,
      productGwpDisplay: formatNumber(productRow ? outputNormalizedEmission(productRow, outputRows, report.summary.totalEmission, outputQuantityTotal, byproductAllocation) : 0, 6),
      processGwp,
      processGwpDisplay: formatNumber(processGwp, 6),
      byproductAllocation
    },
    outputRows: outputRows.map((row) => {
      const massShare = outputMassShare(row, outputRows, outputQuantityTotal, byproductAllocation);
      const allocatedEmission = report.summary.totalEmission * massShare;
      return {
        rowId: row.rowId,
        outputType: isOutputByproductRow(row) ? "BYPRODUCT" : "PRODUCT",
        materialName: row.materialName,
        processReferenceMass: row.originalAmount,
        processReferenceMassDisplay: formatNumber(row.originalAmount, 2),
        unit: row.unit,
        massSharePercent: massShare * 100,
        massSharePercentDisplay: formatNumber(massShare * 100, 2),
        allocatedEmission,
        allocatedEmissionDisplay: formatNumber(allocatedEmission, 2),
        emissionPerTon: outputQuantityTotal > 0 ? (report.summary.totalEmission / outputQuantityTotal) * massShare : allocatedEmission,
        emissionPerTonDisplay: formatNumber(outputQuantityTotal > 0 ? (report.summary.totalEmission / outputQuantityTotal) * massShare : allocatedEmission, 6)
      };
    }),
    rows: report.rows.map((row) => ({
      rowId: row.rowId,
      sectionCode: row.sectionCode,
      sectionLabel: row.sectionLabel,
      group: row.group,
      materialName: row.materialName,
      // The printable detail table shows the process/original quantity. Keep the
      // verification value identical to what the uploaded PDF actually contains.
      amount: row.originalAmount,
      amountDisplay: formatNumber(row.originalAmount, 2),
      originalAmount: row.originalAmount,
      originalAmountDisplay: formatNumber(row.originalAmount, 2),
      unit: row.unit,
      emissionFactor: row.emissionFactor,
      emissionFactorDisplay: formatNumber(row.emissionFactor, 2),
      totalEmission: row.totalEmission,
      totalEmissionDisplay: formatNumber(row.originalAmount * row.emissionFactor, 2),
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
  const retained = [record, ...records].slice(0, 100);
  while (retained.length > 0) {
    try {
      window.localStorage.setItem(REPORT_VERIFICATION_STORAGE_KEY, JSON.stringify(retained));
      return true;
    } catch (error) {
      if (retained.length === 1) {
        console.warn("[emission-survey-report:verification-cache]", error);
        return false;
      }
      retained.pop();
    }
  }
  return false;
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

type ReportQrEvidence = {
  certificateId: string;
  payloadHash: string;
  integrityCode: string;
  datasetHash: string;
};

function buildReportQrPayload(record: ReportVerificationRecord) {
  return `CARBONET:V1:${record.certificateId}:${record.payloadHash}:${record.integrityCode}:${record.datasetHash || record.payloadHash}`;
}

function parseReportQrPayload(value: string): ReportQrEvidence | null {
  const match = value.match(/^CARBONET:V1:(CRN-\d{8}-[A-F0-9]{12}):([a-f0-9]{64}):([A-F0-9]{24}):([a-f0-9]{64})$/i);
  return match ? {
    certificateId: match[1].toUpperCase(),
    payloadHash: match[2].toLowerCase(),
    integrityCode: match[3].toUpperCase(),
    datasetHash: match[4].toLowerCase()
  } : null;
}

async function createReportQrDataUrl(record: ReportVerificationRecord) {
  const { toDataURL } = await import("qrcode");
  return toDataURL(buildReportQrPayload(record), { errorCorrectionLevel: "M", margin: 1, width: 512 });
}

async function scanReportQrEvidence(images: Blob[]) {
  const { default: jsQR } = await import("jsqr");
  for (const image of images) {
    const bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });
    const regions = [
      { x: 0.68, y: 0.68, width: 0.32, height: 0.32, scale: 4 },
      { x: 0.55, y: 0.55, width: 0.45, height: 0.45, scale: 3 },
      { x: 0, y: 0, width: 1, height: 1, scale: 1 }
    ];
    for (const region of regions) {
      const sourceX = Math.floor(bitmap.width * region.x);
      const sourceY = Math.floor(bitmap.height * region.y);
      const sourceWidth = Math.max(1, Math.ceil(bitmap.width * region.width));
      const sourceHeight = Math.max(1, Math.ceil(bitmap.height * region.height));
      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth * region.scale;
      canvas.height = sourceHeight * region.scale;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        continue;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
      const evidence = decoded ? parseReportQrPayload(decoded.data) : null;
      if (evidence) {
        bitmap.close();
        return evidence;
      }
    }
    bitmap.close();
  }
  return null;
}

function extractVerificationPayload(raw: string): ReportVerificationPayload | null {
  const blockMatch = raw.match(/CARBONET_REPORT_VERIFY_BEGIN\s*([A-Za-z0-9_\-\s]+?)\s*CARBONET_REPORT_VERIFY_END/);
  const inlineMatch = raw.match(/CARBONET-VERIFY:([A-Za-z0-9_-]+)/);
  const encoded = (blockMatch?.[1] || inlineMatch?.[1] || "").replace(/\s+/g, "");
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

function findCertificateIdFromPdfText(raw: string) {
  return normalizePdfExtractedText(raw).match(/CRN-\d{8}-[A-Fa-f0-9]{12}/)?.[0].toUpperCase() || "";
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

async function inspectPdfModificationDates(buffer: ArrayBuffer) {
  await import("pdfjs-dist/build/pdf.worker.min.mjs");
  const pdfjs = await import("pdfjs-dist");
  const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
  try {
    const metadata = await pdfDocument.getMetadata();
    const info = metadata.info as Record<string, unknown>;
    const creationDate = typeof info.CreationDate === "string" ? info.CreationDate.trim() : "";
    const modificationDate = typeof info.ModDate === "string" ? info.ModDate.trim() : "";
    return {
      creationDate,
      modificationDate,
      modifiedAfterCreation: Boolean(creationDate && modificationDate && creationDate !== modificationDate)
    };
  } finally {
    await pdfDocument.destroy();
  }
}

async function preprocessReportPhoto(file: Blob) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const targetWidth = Math.min(2400, Math.max(1600, bitmap.width));
  const scale = targetWidth / bitmap.width;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("Image preprocessing is not available.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const luminance = imageData.data[index] * 0.299 + imageData.data[index + 1] * 0.587 + imageData.data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (luminance - 128) * 1.35 + 128));
    imageData.data[index] = contrasted;
    imageData.data[index + 1] = contrasted;
    imageData.data[index + 2] = contrasted;
  }
  context.putImageData(imageData, 0, 0);
  // Preserve the 2,400 px OCR working width, but avoid sending a lossless
  // grayscale PNG whose multipart body can exceed the production ingress
  // limit for a single report page. Quality 0.94 keeps small decimal glyphs
  // legible while bounding each page request to a few megabytes.
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Image preprocessing failed.")),
    "image/jpeg",
    0.94
  ));
}

async function recognizeReportPhotos(files: Blob[], onProgress: (progress: number, status: string) => void) {
  const images: Blob[] = [];
  let paddleError = "";
  for (let index = 0; index < files.length; index += 1) {
    onProgress(Math.round((index / Math.max(1, files.length)) * 10), `IMAGE ${index + 1}/${files.length}`);
    images.push(await preprocessReportPhoto(files[index]));
  }
  try {
    onProgress(10, `PADDLEOCR 0/${files.length}`);
    // A 288-DPI, multi-page PDF can exceed the ingress request-size limit when
    // every rendered page is posted in one multipart body. Keep each request
    // page-scoped so coordinate evidence remains available for cell matching,
    // and bound concurrency so the OCR worker is not memory-spiked by 10 pages.
    const pageResults: ReportPageOcrResponse["pages"] = new Array(images.length);
    const confidences: number[] = new Array(images.length).fill(0);
    const engines: string[] = new Array(images.length).fill("");
    let nextPageIndex = 0;
    const recognizeNextPage = async () => {
      while (nextPageIndex < images.length) {
        const pageIndex = nextPageIndex++;
        const pageResult = await recognizeSurveyReportPages([images[pageIndex]]);
        const recognizedPage = pageResult.pages[0];
        if (!recognizedPage) {
          throw new Error(`PaddleOCR returned no evidence for page ${pageIndex + 1}.`);
        }
        pageResults[pageIndex] = { ...recognizedPage, pageNumber: pageIndex + 1 };
        confidences[pageIndex] = pageResult.confidence || recognizedPage.confidence || 0;
        engines[pageIndex] = pageResult.engine || "PaddleOCR";
        onProgress(10 + Math.round(((pageIndex + 1) / images.length) * 90),
          `PADDLEOCR ${pageIndex + 1}/${images.length}`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, images.length) }, () => recognizeNextPage()));
    const pageTexts = pageResults.map((page) => page.text || "");
    if (pageTexts.some((text) => text.trim())) {
      onProgress(100, `PADDLEOCR ${files.length}/${files.length}`);
      return {
        text: pageTexts.filter(Boolean).join("\n"),
        pageTexts,
        pages: pageResults,
        confidence: confidences.length
          ? confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length
          : 0,
        engine: Array.from(new Set(engines.filter(Boolean))).join(" + ") || "PaddleOCR"
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "unknown error");
    paddleError = message.slice(0, 160);
    console.error("[report-verification] PaddleOCR request failed", error);
    onProgress(12, `PADDLEOCR FALLBACK: ${message.slice(0, 160)}`);
  }
  const { createWorker, OEM } = await import("tesseract.js");
  const texts: string[] = [];
  const confidences: number[] = [];
  for (const [languageIndex, languages] of ([["kor", "eng"]] as const).entries()) {
    const worker = await createWorker([...languages], OEM.LSTM_ONLY, {
      workerPath: "/assets/react/ocr/worker.min.js",
      corePath: "/assets/react/ocr/tesseract-core-lstm.wasm.js",
      langPath: "/assets/react/ocr",
      cacheMethod: "none",
      logger: () => undefined
    });
    try {
      for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
        const base = languageIndex * images.length + imageIndex;
        const result = await worker.recognize(images[imageIndex], {}, {
          text: true
        });
        texts.push(result.data.text);
        confidences.push(result.data.confidence);
        onProgress(10 + Math.round(((base + 1) / images.length) * 90), `${languages.join("+").toUpperCase()} ${imageIndex + 1}/${images.length}`);
      }
    } finally {
      await worker.terminate();
    }
  }
  return {
    text: texts.filter(Boolean).join("\n"),
    pageTexts: texts,
    pages: [],
    confidence: confidences.length ? Math.max(...confidences) : 0,
    engine: paddleError ? `Tesseract.js-7 (PaddleOCR: ${paddleError})` : "Tesseract.js-7"
  };
}

async function renderReportPdfPages(file: File, onProgress: (progress: number, status: string) => void) {
  // Bundle the worker implementation into the application chunk. PDF.js detects
  // globalThis.pdfjsWorker and uses it directly, so verification never depends on
  // a separately fetched .mjs URL, proxy MIME rules, or a stale worker asset.
  await import("pdfjs-dist/build/pdf.worker.min.mjs");
  const pdfjs = await import("pdfjs-dist");
  const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (pdfDocument.numPages > MAX_REPORT_VERIFICATION_PAGES) {
    await pdfDocument.destroy();
    throw new Error(`Report verification supports up to ${MAX_REPORT_VERIFICATION_PAGES} pages.`);
  }
  const pages: Blob[] = [];
  const textPages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    onProgress(Math.round((pageNumber / pdfDocument.numPages) * 8), `PDF ${pageNumber}/${pdfDocument.numPages}`);
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const visibleTextItems = textContent.items
      .map((item, sourceIndex) => ({
        sourceIndex,
        text: "str" in item ? item.str : "",
        x: "transform" in item ? Number(item.transform[4] || 0) : 0,
        y: "transform" in item ? Number(item.transform[5] || 0) : 0
      }))
      .filter((item) => item.text.trim());
    const visibleTextLines: Array<{ y: number; items: typeof visibleTextItems }> = [];
    visibleTextItems.forEach((item, index) => {
      const currentLine = visibleTextLines[visibleTextLines.length - 1];
      const previousItem = visibleTextItems[index - 1];
      const startsNewVisualLine = previousItem && (
        item.x + 2 < previousItem.x || Math.abs(item.y - previousItem.y) > 8
      );
      if (!currentLine || startsNewVisualLine) {
        visibleTextLines.push({ y: item.y, items: [item] });
        return;
      }
      currentLine.items.push(item);
    });
    const visibleText = visibleTextLines
      .map((line) => line.items
        .map((item) => item.text.trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim())
      .filter(Boolean)
      .join("\n");
    if (!visibleText) {
      await pdfDocument.destroy();
      throw new Error(`Report page ${pageNumber} has no readable text layer. Reissue the PDF before verification.`);
    }
    textPages.push(visibleText);
    // 288 DPI equivalent rendering keeps small table decimals legible for the
    // server-side zone OCR while remaining bounded by the 10-page limit.
    const viewport = page.getViewport({ scale: 4 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("PDF page rendering is not available.");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("PDF page image could not be created.")),
      "image/png"
    ));
    pages.push(blob);
    page.cleanup();
  }
  await pdfDocument.destroy();
  return { pages, textPages };
}

async function buildReportVisualProfile(pages: Blob[]) {
  const columns = 48;
  const rows = 68;
  const profiles: Array<{ values: number[] }> = [];
  for (const page of pages) {
    const bitmap = await createImageBitmap(page, { imageOrientation: "from-image" });
    const canvas = document.createElement("canvas");
    canvas.width = columns;
    canvas.height = rows;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      bitmap.close();
      throw new Error("Visual fingerprint canvas is not available.");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, columns, rows);
    context.drawImage(bitmap, 0, 0, columns, rows);
    bitmap.close();
    const pixels = context.getImageData(0, 0, columns, rows).data;
    const values: number[] = [];
    for (let index = 0; index < pixels.length; index += 4) {
      values.push(Math.round(pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114));
    }
    profiles.push({ values });
  }
  return { version: 1, columns, rows, pages: profiles };
}

function resolveVerificationPayload(raw: string): ReportVerificationPayload | null {
  return extractVerificationPayload(raw) || findPayloadFromVisibleVerificationFields(raw);
}

function collectReportProofreadingLabels(report: EmissionSurveyReportPayload) {
  const labels = [
    report.productName, report.pageTitle,
    report.classification.majorLabel, report.classification.middleLabel, report.classification.smallLabel,
    report.calculationScope.categoryName, report.calculationScope.tierLabel,
    report.summary.topContributorLabel,
    ...report.sectionSummaries.flatMap((section) => [section.sectionLabel]),
    ...report.rows.flatMap((row) => [row.sectionLabel, row.group, row.materialName, row.note, row.warning]),
    ...report.scenarios.flatMap((scenario) => [scenario.label, scenario.description]),
    ...report.alerts.flatMap((alert) => [alert.title, alert.description])
  ];
  return Array.from(new Set(labels.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function applyReportProofreading(report: EmissionSurveyReportPayload, corrections: Record<string, string>) {
  const text = (value: string) => corrections[value] || value;
  return {
    ...report,
    productName: text(report.productName),
    pageTitle: text(report.pageTitle),
    classification: {
      ...report.classification,
      majorLabel: text(report.classification.majorLabel),
      middleLabel: text(report.classification.middleLabel),
      smallLabel: text(report.classification.smallLabel)
    },
    calculationScope: {
      ...report.calculationScope,
      categoryName: text(report.calculationScope.categoryName),
      tierLabel: text(report.calculationScope.tierLabel)
    },
    summary: { ...report.summary, topContributorLabel: text(report.summary.topContributorLabel) },
    sectionSummaries: report.sectionSummaries.map((section) => ({ ...section, sectionLabel: text(section.sectionLabel) })),
    rows: report.rows.map((row) => ({
      ...row,
      sectionLabel: text(row.sectionLabel),
      group: text(row.group),
      materialName: text(row.materialName),
      note: text(row.note),
      warning: text(row.warning)
    })),
    scenarios: report.scenarios.map((scenario) => ({ ...scenario, label: text(scenario.label), description: text(scenario.description) })),
    alerts: report.alerts.map((alert) => ({ ...alert, title: text(alert.title), description: text(alert.description) }))
  };
}

async function proofreadReportForIssuance(report: EmissionSurveyReportPayload) {
  try {
    const result = await proofreadSurveyReportLabels(collectReportProofreadingLabels(report));
    return {
      report: applyReportProofreading(report, result.corrections || {}),
      model: result.model || "Gemma E4B",
      changedCount: result.changedCount || 0,
      applied: result.success
    };
  } catch (error) {
    console.warn("Report proofreading unavailable; preserving the original issuance dataset.", error);
    return { report, model: "Gemma E4B", changedCount: 0, applied: false };
  }
}

async function buildReportVerificationRecord(report: EmissionSurveyReportPayload, options?: {
  reportType?: ReportVerificationType;
  reportTitle?: string;
  datasetExtension?: Record<string, unknown>;
  byproductAllocation?: "allocated" | "unallocated";
}): Promise<ReportVerificationRecord> {
  const issuedAt = new Date().toISOString();
  const reportType = options?.reportType || "EMISSION_SURVEY";
  const dataset = options?.datasetExtension
    ? { ...canonicalReportForVerification(report, options.byproductAllocation), reportType, ...options.datasetExtension }
    : canonicalReportForVerification(report, options?.byproductAllocation);
  const payloadHash = await sha256Hex(stableStringify(dataset));
  const certificateId = `CRN-${issuedAt.slice(0, 10).replace(/-/g, "")}-${payloadHash.slice(0, 12).toUpperCase()}`;
  const integrityCode = (await sha256Hex(`${certificateId}|${payloadHash}|${report.summary.totalEmission}|CARBONET`)).slice(0, 24).toUpperCase();
  return {
    version: 2,
    reportType,
    source: "browser-print",
    certificateId,
    issuedAt,
    reportTitle: options?.reportTitle || report.pageTitle,
    productName: report.productName,
    generatedAt: report.generatedAt,
    totalEmission: report.summary.totalEmission,
    rowCount: report.summary.rowCount,
    calculatedRowCount: report.summary.calculatedRowCount,
    warningCount: report.summary.warningCount,
    payloadHash,
    integrityCode,
    datasetHash: payloadHash,
    dataset,
    verificationUrl: `${window.location.origin}${buildLocalizedPath("/admin/emission/survey-report-verify", "/en/admin/emission/survey-report-verify")}?certificateId=${encodeURIComponent(certificateId)}`
  };
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function buildReportOcrIssuanceEvidence(article: HTMLElement, record: ReportVerificationDatasetPayload): ReportOcrIssuanceEvidence {
  const pageDefinitions = [
    ["SUMMARY", ".pdf-export-page.print-page"],
    ["SECTION_BAR", ".pdf-chart-bar-page"],
    ["SECTION_PIE", ".pdf-chart-pie-page"],
    ["DETAIL_TABLE", ".pdf-table-export-page"],
    ["DIGITAL_VERIFICATION", ".report-verification-footer"]
  ] as const;
  const pages = pageDefinitions.map(([pageType, selector], index) => {
    const source = article.querySelector<HTMLElement>(selector);
    if (!source) {
      throw new Error(`Visible report page ${index + 1} (${pageType}) is unavailable for OCR registration.`);
    }
    const excluded = ".pdf-machine-readable,.lca-pdf-machine-readable,.print-hidden,.pdf-hidden,[aria-hidden='true'],button,input,select,textarea,script,style";
    const pageBox = source.getBoundingClientRect();
    const rows = Array.from(source.querySelectorAll("tr,.report-bar-row,.pdf-table-row"));
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    const segments: Array<{ segmentIndex: number; text: string; semanticTag: string; rowIndex: number; columnIndex: number; box: { x: number; y: number; width: number; height: number } }> = [];
    let current = walker.nextNode();
    while (current) {
      const parent = current.parentElement;
      const text = (current.textContent || "").replace(/\s+/g, " ").trim();
      if (parent && text && !parent.closest(excluded)) {
        const semantic = parent.closest<HTMLElement>("th,td,h1,h2,h3,p,li,span,div") || parent;
        const row = parent.closest("tr,.report-bar-row,.pdf-table-row");
        const cell = parent.closest<HTMLTableCellElement>("th,td");
        const rect = semantic.getBoundingClientRect();
        const normalize = (value: number, total: number) => total > 0 ? Math.round((value / total) * 10_000) : 0;
        segments.push({
          segmentIndex: segments.length,
          text,
          semanticTag: semantic.tagName.toLowerCase(),
          rowIndex: row ? rows.indexOf(row) : -1,
          columnIndex: cell ? cell.cellIndex : -1,
          box: {
            x: normalize(rect.left - pageBox.left, pageBox.width),
            y: normalize(rect.top - pageBox.top, pageBox.height),
            width: normalize(rect.width, pageBox.width),
            height: normalize(rect.height, pageBox.height)
          }
        });
      }
      current = walker.nextNode();
    }
    const visibleText = segments.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim();
    if (visibleText.length < (pageType === "DIGITAL_VERIFICATION" ? 20 : 40)) {
      throw new Error(`Visible report page ${index + 1} (${pageType}) has too few OCR fields.`);
    }
    return { pageNumber: index + 1, pageType, visibleText, segments };
  });
  return {
    schemaVersion: 3,
    certificateId: record.certificateId,
    payloadHash: record.payloadHash,
    integrityCode: record.integrityCode,
    datasetHash: String(record.datasetHash || record.payloadHash),
    pages
  };
}

async function waitForReportFonts() {
  if (!document.fonts) {
    return;
  }
  const fontLoads = [
    document.fonts.load('400 16px "Pretendard GOV"'),
    document.fonts.load('500 16px "Pretendard GOV"'),
    document.fonts.load('600 16px "Pretendard GOV"'),
    document.fonts.load('700 16px "Pretendard GOV"'),
    document.fonts.load('800 16px "Pretendard GOV"'),
    document.fonts.load('900 16px "Pretendard GOV"'),
    document.fonts.ready
  ];
  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, 3_000);
  });
  // A missing optional font must not block issuance. Chromium can render the
  // report with the configured fallback stack, so wait only for a bounded
  // best-effort font settlement and continue on individual load failures.
  await Promise.race([Promise.allSettled(fontLoads).then(() => undefined), timeout]);
}

function escapeReportStyleAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function absolutizeReportStyleUrls(css: string, stylesheetUrl: string) {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, _quote: string, rawUrl: string) => {
    const value = rawUrl.trim();
    if (!value || /^(?:data:|blob:|https?:|file:|#|\/\/)/i.test(value)) {
      return match;
    }
    try {
      return `url("${new URL(value, stylesheetUrl).href.replace(/"/g, "%22")}")`;
    } catch {
      return match;
    }
  });
}

async function buildInlinedReportStyles() {
  const nodes = Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'));
  const fragments = await Promise.all(nodes.map(async (node) => {
    if (node instanceof HTMLStyleElement) {
      return node.outerHTML;
    }
    // The print window is isolated from the application document, so linked
    // stylesheets must be embedded before the report markup is written.
    const stylesheetUrl = node.href;
    const parsedStylesheetUrl = new URL(stylesheetUrl, window.location.href);
    if (parsedStylesheetUrl.origin !== window.location.origin) {
      // External font stylesheets are optional and can be blocked by CORS or
      // an isolated production network. The same-origin application CSS below
      // remains mandatory, and Chromium uses the report fallback font stack.
      return "";
    }
    const response = await fetch(parsedStylesheetUrl.href, {
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`PDF stylesheet could not be loaded (${response.status}): ${stylesheetUrl}`);
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    if (!contentType.includes("text/css")) {
      throw new Error(`PDF stylesheet returned an invalid content type (${contentType || "missing"}): ${stylesheetUrl}`);
    }
    const css = await response.text();
    if (!css.trim()) {
      throw new Error(`PDF stylesheet was empty: ${stylesheetUrl}`);
    }
    const safeCss = absolutizeReportStyleUrls(css, stylesheetUrl).replace(/<\/style/gi, "<\\/style");
    return `<style data-carbonet-pdf-stylesheet="${escapeReportStyleAttribute(stylesheetUrl)}">${safeCss}</style>`;
  }));
  if (!fragments.some((fragment) => fragment.includes("data-carbonet-pdf-stylesheet="))) {
    throw new Error("PDF stylesheet was not embedded.");
  }
  return fragments.join("\n");
}

type ReportPdfDesignDraft = "agency" | "summary" | "table" | "compact";

const REPORT_PDF_DESIGN_DRAFTS: Array<{ id: ReportPdfDesignDraft; label: string; enLabel: string; description: string; enDescription: string; icon: string; buttonClass: string }> = [
  { id: "agency", label: "시안 1 정부기관 표준", enLabel: "Draft 1 Government", description: "정부 보고서 청색 규격", enDescription: "Government blue standard", icon: "account_balance", buttonClass: "border-blue-300 bg-blue-50 text-blue-900" },
  { id: "summary", label: "시안 2 인증 공문", enLabel: "Draft 2 Certificate", description: "발급·승인 중심 공문서", enDescription: "Issued certificate document", icon: "verified", buttonClass: "border-rose-300 bg-rose-50 text-rose-900" },
  { id: "table", label: "시안 3 심사 원장", enLabel: "Draft 3 Audit Ledger", description: "심사표·대장 중심 규격", enDescription: "Audit ledger standard", icon: "fact_check", buttonClass: "border-slate-400 bg-slate-100 text-slate-900" },
  { id: "compact", label: "시안 4 환경 인증", enLabel: "Draft 4 Green Certificate", description: "환경성과 인증서 규격", enDescription: "Environmental certificate", icon: "eco", buttonClass: "border-emerald-300 bg-emerald-50 text-emerald-900" }
];

function buildReportPdfFileName(report: EmissionSurveyReportPayload, draft?: ReportPdfDesignDraft | null) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const name = (report.productName || report.pageTitle || "emission-survey-report")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const draftLabel = draft ? `-${REPORT_PDF_DESIGN_DRAFTS.find((item) => item.id === draft)?.label.replace(/\s+/g, "-") || `시안-${draft}`}` : "";
  return `탄소배출량-리포트-${name || "report"}${draftLabel}-${date}.pdf`;
}

function buildLcaSummaryPdfFileName(report: EmissionSurveyReportPayload, pageProductName = "") {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const name = (pageProductName || report.productName || report.pageTitle || "lca-summary")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `LCA-요약보고서-${name || "summary"}-${date}.pdf`;
}

function buildLcaSummaryDocumentTitle(companyName = "", en = false) {
  const organization = companyName.trim();
  const title = en ? "Product LCA Summary" : "제품 LCA 수행 개요";
  return [organization, title].filter(Boolean).join(" ");
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

async function copySvgToClipboard(svg: string, fileName: string): Promise<"copied" | "downloaded"> {
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
    if (window.isSecureContext && navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
        return "copied";
      } catch {
        // Fall through to PNG download when image clipboard access is blocked.
      }
    }
    const pngUrl = URL.createObjectURL(pngBlob);
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
    return "downloaded";
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildSectionBarChartSvg(sections: EmissionSurveyReportSectionSummary[], en: boolean) {
  const width = 900;
  const rowHeight = 66;
  const height = Math.max(260, 120 + sections.length * rowHeight);
  const maxEmission = Math.max(...sections.map((section) => section.totalEmission), 1);
  const rows = sections.map((section, index) => {
    const y = 92 + index * rowHeight;
    const barWidth = Math.max(8, (Math.max(section.totalEmission, 0) / maxEmission) * 520);
    const label = escapeSvgText(sectionLabel(section.sectionCode, section.sectionLabel, en));
    return `
      <text x="44" y="${y}" fill="#0f172a" font-size="17" font-weight="800">${label}</text>
      <text x="856" y="${y}" fill="#0f172a" font-size="15" font-weight="800" text-anchor="end">${escapeSvgText(formatNumber(section.totalEmission))} kg CO2e</text>
      <rect x="44" y="${y + 24}" width="620" height="12" rx="6" fill="#eef2f7"/>
      <rect x="44" y="${y + 24}" width="${barWidth}" height="12" rx="6" fill="${sectionSolidColor(index)}"/>
      <text x="856" y="${y + 37}" fill="#64748b" font-size="13" font-weight="700" text-anchor="end">${escapeSvgText(formatPercent(section.sharePercent))}</text>
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
  const legendRows = Math.ceil(sections.length / 3);
  const height = Math.max(580, 500 + legendRows * 62);
  const slices = buildPieSlices(sections).map((slice) => (
    `<path d="${slice.d}" fill="${slice.color}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>`
  )).join("");
  const legend = sections.map((section, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = 54 + column * 276;
    const y = 478 + row * 62;
    return `
      <rect x="${x}" y="${y - 18}" width="254" height="52" rx="10" fill="#f8fafc"/>
      <circle cx="${x + 17}" cy="${y - 2}" r="6" fill="${sectionSolidColor(index)}"/>
      <text x="${x + 31}" y="${y + 3}" fill="#334155" font-size="12" font-weight="500">${escapeSvgText(sectionLabel(section.sectionCode, section.sectionLabel, en))}</text>
      <text x="${x + 31}" y="${y + 24}" fill="#64748b" font-size="11" font-weight="500">${escapeSvgText(formatPercent(section.sharePercent))} · ${escapeSvgText(formatNumber(section.totalEmission))} kg CO2e</text>
    `;
  }).join("");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" rx="28" fill="#ffffff"/>
      <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="24" fill="#ffffff" stroke="#d8e0ea"/>
      <text x="44" y="62" fill="#0f172a" font-size="24" font-weight="900">${en ? "Section Contribution Pie" : "섹션별 탄소배출 기여 원그래프"}</text>
      <g transform="translate(280 95) scale(1.55)">${slices}<circle cx="110" cy="110" r="50" fill="#fff" stroke="#e2e8f0"/><text x="110" y="104" text-anchor="middle" fill="#64748b" font-size="11" font-weight="900">${en ? "TOTAL" : "합계"}</text><text x="110" y="130" text-anchor="middle" fill="#0f172a" font-size="22" font-weight="900">100%</text></g>
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
  useEnglishTitleCase(en);
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
    const printPath = routeEn
      ? "/en/admin/emission/survey-report-print"
      : "/admin/emission/survey-report-print";
    navigate(`${printPath}?lang=${language}&returnLang=${routeEn ? "en" : "ko"}`);
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
  const searchParams = new URLSearchParams(window.location.search);
  const language = searchParams.get("lang");
  const returnLanguageParam = searchParams.get("returnLang");
  const returnLanguage = returnLanguageParam === "en" || returnLanguageParam === "ko"
    ? returnLanguageParam
    : (isEnglish() ? "en" : "ko");
  const reportReturnPath = returnLanguage === "en"
    ? "/en/admin/emission/survey-report"
    : "/admin/emission/survey-report";
  const en = language ? language === "en" : isEnglish();
  useEnglishTitleCase(en);
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
  const [verificationQrDataUrl, setVerificationQrDataUrl] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [pdfDownloadMode, setPdfDownloadMode] = useState(false);
  const [pdfDesignDraft, setPdfDesignDraft] = useState<ReportPdfDesignDraft | null>(null);
  const [missingRequiredLabels, setMissingRequiredLabels] = useState<string[]>([]);

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
  const validateBeforePdfIssuance = () => {
    const rows = effectiveReport.rows || [];
    const outputRows = buildOutputNormalizationRows(rows);
    const missing = validateReportRequiredFields([
      { key: "productName", label: en ? "Product name / report title" : "제품명·리포트 제목", value: effectiveReport.productName || effectiveReport.pageTitle, elementId: "survey-report-product-name" },
      { key: "totalEmission", label: en ? "Total carbon emission" : "총 탄소배출량", value: totalEmission, elementId: "survey-report-total-emission", valid: (value) => Number.isFinite(Number(value)) && Number(value) >= 0 },
      { key: "outputRows", label: en ? "Product / byproduct rows" : "제품·부산물 행", value: outputRows.length > 0 },
      { key: "outputMass", label: en ? "Total output mass" : "총 산출물 질량", value: normalization.outputQuantityTotal, valid: (value) => Number(value) > 0 },
      { key: "materialNames", label: en ? "Material names" : "물질명", value: rows.every((row) => String(row.materialName || "").trim().length > 0) },
      { key: "units", label: en ? "Units" : "단위", value: rows.every((row) => String(row.unit || "").trim().length > 0) },
      { key: "outputAmounts", label: en ? "Product / byproduct mass" : "제품·부산물 질량", value: outputRows.every((row) => Number.isFinite(row.originalAmount) && row.originalAmount > 0) },
      { key: "sectionShares", label: en ? "Section allocation ratio total (100%)" : "섹션 배출 비율 합계(100%)", value: sectionShareReady }
    ]);
    setMissingRequiredLabels(missing.map((field) => field.label));
    return missing.length === 0;
  };
  const handleDownloadPdf = async (draft: ReportPdfDesignDraft | null = null) => {
    if (!effectiveReport) {
      return;
    }
    if (!validateBeforePdfIssuance()) return;
    setVerificationBusy(true);
    setVerificationMessage("");
    let issuanceStage = "PROOFREAD";
    try {
      const proofreading = await proofreadReportForIssuance(effectiveReport);
      const issuedReport = proofreading.report;
      setDraftReport(issuedReport);
      issuanceStage = "LOCAL_SESSION";
      saveEmissionSurveyReportSession(issuedReport);
      issuanceStage = "VERIFICATION_RECORD";
      const record = await buildReportVerificationRecord(issuedReport, { byproductAllocation });
      saveReportVerificationRecord(record);
      setVerificationRecord(record);
      issuanceStage = "QR_EVIDENCE";
      setVerificationQrDataUrl(await createReportQrDataUrl(record));
      setPdfDesignDraft(draft);
      setPdfDownloadMode(false);
      issuanceStage = "REPORT_RENDER:FRAMES";
      await nextAnimationFrame();
      await nextAnimationFrame();
      issuanceStage = "REPORT_RENDER:FONTS";
      await waitForReportFonts();
      issuanceStage = "REPORT_RENDER:ARTICLE";
      const article = reportArticleRef.current;
      if (!article) {
        throw new Error("Report element is not ready.");
      }
      issuanceStage = "REPORT_RENDER:HTML";
      // The backend renders a temporary file:// document. External stylesheet
      // links can be unreachable from that Chromium process even though they
      // are already loaded in the user's authenticated page. Embed the exact
      // CSS bytes and fail closed instead of issuing an unstyled PDF.
      const printableHead = await buildInlinedReportStyles();
      const reportHtml = [
        "<!doctype html><html lang=\"" + (en ? "en" : "ko") + "\"><head>",
        "<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
        `<base href="${window.location.origin}/">`,
        printableHead,
        "<style>html,body{margin:0!important;background:#fff!important}body{padding:0!important}.print-sheet{margin:0 auto!important}</style>",
        "</head><body class=\"" + document.body.className.replace(/"/g, "") + "\">",
        article.outerHTML,
        "</body></html>"
      ].join("");
      issuanceStage = "PDF_API";
      const issuedPdf = await issueSurveyReportPdf(record, reportHtml, buildReportOcrIssuanceEvidence(article, record));
      issuanceStage = "DOWNLOAD";
      const downloadUrl = URL.createObjectURL(issuedPdf);
      const download = document.createElement("a");
      download.href = downloadUrl;
      download.download = buildReportPdfFileName(issuedReport, draft);
      document.body.appendChild(download);
      download.click();
      download.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000);
      setVerificationMessage(en
        ? `The verified PDF was downloaded. Its dataset, OCR source, and ${proofreading.changedCount} text correction(s) were registered from the final PDF.`
        : `검증 PDF를 다운로드했습니다. 최종 PDF 기준 시각 지문·OCR 원문·데이터셋과 오탈자 ${proofreading.changedCount}건을 함께 등록했습니다.`);
      } catch (error) {
        console.error(`[emission-survey-report:${issuanceStage}]`, error);
        setVerificationMessage(en
          ? `PDF issuance failed at ${issuanceStage}. Please try again.`
          : `PDF 발급에 실패했습니다. 실패 단계: ${issuanceStage}. 다시 시도하세요.`);
      } finally {
      setVerificationBusy(false);
    }
  };

  const handleDownloadPdfLegacy = async (draft: ReportPdfDesignDraft | null = null) => {
    if (!effectiveReport) {
      return;
    }
    let exportClone: HTMLElement | null = null;
    setVerificationBusy(true);
    setVerificationMessage("");
    try {
      const record = await buildReportVerificationRecord(effectiveReport, { byproductAllocation });
      await issueSurveyReportVerification(record).catch((error) => {
        console.warn("Report verification registration failed; continuing PDF download.", error);
      });
      saveReportVerificationRecord(record);
      setVerificationRecord(record);
      setPdfDesignDraft(draft);
      await nextAnimationFrame();
      await nextAnimationFrame();
      await waitForReportFonts();
      const element = reportArticleRef.current;
      if (!element) {
        throw new Error("Report element is not ready.");
      }
      exportClone = element.cloneNode(true) as HTMLElement;
      exportClone.classList.add("pdf-wysiwyg-mode");
      exportClone.setAttribute("aria-hidden", "true");
      exportClone.style.position = "fixed";
      exportClone.style.left = "0";
      exportClone.style.top = "0";
      exportClone.style.zIndex = "-2147483647";
      exportClone.style.pointerEvents = "none";
      exportClone.style.margin = "0";
      document.body.appendChild(exportClone);
      exportClone.style.setProperty("width", "1024px", "important");
      exportClone.style.setProperty("max-width", "1024px", "important");
      exportClone.style.setProperty("background", "#ffffff", "important");

      for (const page of Array.from(exportClone.querySelectorAll<HTMLElement>(".pdf-export-page"))) {
        page.style.setProperty("box-sizing", "border-box", "important");
        page.style.setProperty("width", "1024px", "important");
        page.style.setProperty("height", "1448px", "important");
        page.style.setProperty("min-height", "1448px", "important");
        page.style.setProperty("max-height", "1448px", "important");
        page.style.setProperty("margin", "0", "important");
        page.style.setProperty("overflow", "hidden", "important");
        page.style.setProperty("background", "#ffffff", "important");
      }
      const heroGrid = exportClone.querySelector<HTMLElement>(".print-report-hero-grid");
      if (heroGrid) {
        heroGrid.style.setProperty("display", "grid", "important");
        heroGrid.style.setProperty("grid-template-columns", "minmax(0,1.4fr) 320px", "important");
        heroGrid.style.setProperty("align-items", "center", "important");
      }
      const totalCard = exportClone.querySelector<HTMLElement>(".print-report-total-card");
      if (totalCard) {
        totalCard.style.setProperty("width", "320px", "important");
        totalCard.style.setProperty("justify-self", "end", "important");
      }
      const chartPage = exportClone.querySelector<HTMLElement>(".pdf-chart-page");
      if (chartPage) {
        chartPage.style.setProperty("display", "grid", "important");
        chartPage.style.setProperty("grid-template-columns", "repeat(2,minmax(0,1fr))", "important");
        chartPage.style.setProperty("align-items", "start", "important");
      }
      for (const row of Array.from(exportClone.querySelectorAll<HTMLElement>(".report-bar-row"))) {
        row.style.setProperty("display", "block", "important");
        row.style.setProperty("min-height", "84px", "important");
        row.style.setProperty("overflow", "visible", "important");
        const header = row.children.item(0) as HTMLElement | null;
        const bar = row.children.item(1) as HTMLElement | null;
        const percent = row.children.item(2) as HTMLElement | null;
        if (header) {
          header.style.setProperty("display", "flex", "important");
          header.style.setProperty("min-height", "24px", "important");
          header.style.setProperty("align-items", "center", "important");
          header.style.setProperty("justify-content", "space-between", "important");
        }
        if (bar) {
          bar.style.setProperty("display", "block", "important");
          bar.style.setProperty("height", "8px", "important");
          bar.style.setProperty("margin", "8px 0 6px", "important");
        }
        if (percent) {
          percent.style.setProperty("min-height", "20px", "important");
          percent.style.setProperty("margin", "0", "important");
          percent.style.setProperty("line-height", "20px", "important");
        }
      }
      for (const cell of Array.from(exportClone.querySelectorAll<HTMLElement>(".pdf-table-page th, .pdf-table-page td"))) {
        cell.style.setProperty("vertical-align", "middle", "important");
      }

      const editorControls = Array.from(exportClone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input.print-input-control, textarea.print-input-control"));
      for (const control of editorControls) {
        const computed = window.getComputedStyle(control);
        const value = control instanceof HTMLTextAreaElement ? control.value : control.value;
        const replacement = document.createElement("span");
        replacement.className = "pdf-static-value";
        replacement.textContent = value || "-";
        replacement.style.display = "inline-block";
        replacement.style.width = "auto";
        replacement.style.maxWidth = "100%";
        replacement.style.margin = "0";
        replacement.style.padding = "0";
        replacement.style.border = "0";
        replacement.style.background = "transparent";
        replacement.style.color = computed.color;
        replacement.style.fontFamily = computed.fontFamily;
        replacement.style.fontSize = computed.fontSize;
        replacement.style.fontWeight = computed.fontWeight;
        replacement.style.letterSpacing = computed.letterSpacing;
        replacement.style.lineHeight = computed.lineHeight === "normal" ? "1.25" : computed.lineHeight;
        replacement.style.textAlign = computed.textAlign;
        replacement.style.verticalAlign = "middle";
        replacement.style.whiteSpace = control instanceof HTMLTextAreaElement ? "pre-wrap" : "nowrap";
        const duplicate = control.nextElementSibling;
        if (duplicate?.classList.contains("print-input-text")) {
          duplicate.remove();
        }
        control.replaceWith(replacement);
      }

      // Pretendard GOV glyphs are painted a little below their CSS line-box
      // baseline by html2canvas. Move only the glyph-bearing text nodes upward;
      // changing padding/line-height here would also move borders and break the
      // carefully budgeted A4 row heights.
      const textWalker = document.createTreeWalker(exportClone, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.textContent?.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          const parent = node.parentElement;
          if (!parent || parent.closest("svg, canvas, script, style, noscript")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const exportTextNodes: Text[] = [];
      for (let node = textWalker.nextNode(); node; node = textWalker.nextNode()) {
        exportTextNodes.push(node as Text);
      }
      for (const textNode of exportTextNodes) {
        const baselineFix = document.createElement("span");
        baselineFix.className = "pdf-text-baseline-fix";
        // html2canvas does not consistently paint `top` offsets on inline
        // descendants. An inline-block transform is reflected in the canvas
        // bitmap, so the exported PDF receives the requested 5 px lift.
        baselineFix.style.display = "inline-block";
        baselineFix.style.transform = "translateY(-5px)";
        baselineFix.style.font = "inherit";
        baselineFix.style.color = "inherit";
        baselineFix.style.letterSpacing = "inherit";
        baselineFix.textContent = textNode.textContent;
        textNode.replaceWith(baselineFix);
      }
      await nextAnimationFrame();
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf")
      ]);
      const qrDataUrl = await createReportQrDataUrl(record);
      const pages = Array.from(exportClone.querySelectorAll<HTMLElement>(".pdf-export-page"));
      if (pages.length === 0) {
        throw new Error("PDF export pages are not ready.");
      }
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        const canvas = await html2canvas(page, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
          width: 1024,
          height: 1448,
          windowWidth: 1024,
          windowHeight: 1448
        });
        if (index > 0) {
          pdf.addPage("a4", "portrait");
        }
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }
      {
        const pageCount = pages.length;
        const qrTone: [number, number, number] = draft === "summary"
          ? [143, 47, 54]
          : draft === "compact"
            ? [8, 120, 95]
            : draft === "table"
              ? [51, 65, 85]
              : [22, 75, 122];
        for (let page = 1; page <= pageCount; page += 1) {
          pdf.setPage(page);
          pdf.setFontSize(5);
          pdf.setTextColor(...qrTone);
          // Keep the jsPDF-drawn verification label aligned with the 5 px
          // upward baseline correction applied to the captured page text.
          pdf.text(`DIGITAL VERIFICATION ${page}/${pageCount}`, 187, 272.68);
          pdf.addImage(qrDataUrl, "PNG", 187, 276, 18, 18);
        }
        pdf.setPage(Math.max(1, pdf.getNumberOfPages()));
        pdf.setFontSize(1);
        pdf.setTextColor(255, 255, 255);
        pdf.text(verificationPayloadToBlock(record), 1, 1, { maxWidth: 1 });
        pdf.setProperties?.({
          title: record.reportTitle || "Carbonet Emission Survey Report",
          subject: "Carbonet verified emission survey report",
          keywords: `carbonet,verification,${record.certificateId}`,
          creator: "Carbonet"
        });
        const issuedPdf = pdf.output("blob");
        try {
          const issuedPages = await renderReportPdfPages(new File([issuedPdf], `${record.certificateId}.pdf`, { type: "application/pdf" }), () => undefined);
          await registerSurveyReportVisualProfile(record.certificateId, await buildReportVisualProfile(issuedPages.pages));
        } catch (error) {
          console.warn("Report visual profile registration failed; continuing PDF download.", error);
        }
      }
      pdf.save(buildReportPdfFileName(effectiveReport, draft));
      setVerificationMessage(en ? "PDF file downloaded with hidden verification data." : "숨김 검증 정보가 포함된 PDF 파일을 다운로드했습니다.");
    } catch (error) {
      console.error(error);
      setVerificationMessage(en ? "PDF download failed. Please try again." : "PDF 다운로드에 실패했습니다. 다시 시도하세요.");
    } finally {
      exportClone?.remove();
      setPdfDownloadMode(false);
      setPdfDesignDraft(null);
      setVerificationBusy(false);
    }
  };
  // Kept temporarily as a rollback path while native Chromium printing is
  // verified in production. It is deliberately not connected to the UI.
  void handleDownloadPdfLegacy;
  const handleCopyChart = async (type: "bar" | "pie") => {
    try {
      const svg = type === "bar" ? buildSectionBarChartSvg(chartSections, en) : buildSectionPieChartSvg(chartSections, en);
      const result = await copySvgToClipboard(svg, type === "bar" ? "section-contribution-bars.png" : "section-contribution-pie.png");
      setChartCopyMessage(result === "copied"
        ? (en ? "Chart copied as image." : "그래프 이미지를 복사했습니다.")
        : (en ? "Image clipboard is unavailable, so the chart was downloaded as PNG." : "이미지 복사를 지원하지 않아 PNG 파일로 다운로드했습니다."));
    } catch {
      setChartCopyMessage(en ? "Could not copy image in this browser." : "이 브라우저에서 이미지 복사를 사용할 수 없습니다.");
    }
  };

  return (
    <main className="min-h-screen bg-[#dfe7ef] px-4 py-8 text-slate-950 print:bg-white print:p-0">
      <style>
        {"@page{size:A4;margin:8mm;}@media print{html,body{background:#fff!important}.print-hidden{display:none!important}.print-sheet{box-shadow:none!important;border:none!important;border-radius:0!important;margin:0!important;max-width:none!important;overflow:visible!important;padding:0!important}.print-page{break-after:page;page-break-after:always}.print-page:last-child{break-after:auto;page-break-after:auto}.pdf-page-start{break-before:page;page-break-before:always}.pdf-page-content{margin-top:0!important;padding-top:0!important}.pdf-page-end{break-after:page;page-break-after:always}.pdf-chart-page{display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-items:start!important;gap:14pt!important}.pdf-chart-page .print-card{padding:12pt!important}.pdf-chart-page .pdf-table-row{padding-top:5pt!important;padding-bottom:5pt!important}.pdf-chart-page h2,.pdf-chart-page h3{font-size:14pt!important;line-height:1.2!important}.pdf-avoid,.print-break{break-inside:avoid;page-break-inside:avoid}.print-table{break-inside:auto;page-break-inside:auto}.print-table thead{display:table-header-group}.print-table tr,.pdf-table-row{break-inside:avoid;page-break-inside:avoid}.print-card{background:#fff!important;border:1px solid #d8e0ea!important;border-radius:18px!important;box-shadow:none!important;break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pdf-machine-readable{position:absolute!important;left:0!important;top:0!important;width:1px!important;height:1px!important;overflow:hidden!important;color:#fff!important;background:#fff!important;font-size:1px!important;line-height:1px!important;letter-spacing:0!important;white-space:pre-wrap!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-soft-bg{background:#f8fafc!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-ink-bg{background:#0f172a!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-report-hero{background:linear-gradient(135deg,#0f172a,#11284d 42%,#0f766e)!important;color:#fff!important;border:1px solid #0f172a!important;border-radius:20px!important;margin:0 0 16px!important;padding:20px!important;overflow:hidden!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-report-hero-grid{display:grid!important;grid-template-columns:minmax(0,1.4fr) 260px!important;align-items:center!important}.print-report-title-wrap{min-height:112px!important;display:flex!important;align-items:center!important}.print-report-title-tag{color:#a5f3fc!important}.print-report-title{color:#fff!important}.print-report-total-card{width:260px!important;justify-self:end!important;background:rgba(255,255,255,.10)!important;color:#fff!important;border:1px solid rgba(255,255,255,.18)!important;box-shadow:none!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-report-total-card *{color:#fff!important}.print-total-cell{background:#fff!important;color:#0f172a!important;border-top:2px solid #0f172a!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-total-label{border-bottom-left-radius:18px!important}.print-total-box-cell{border-bottom-right-radius:18px!important}.print-total-value{background:#f8fafc!important;color:#0f172a!important;border:1px solid transparent!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}@media screen{.print-input-text{display:none!important}.pdf-download-mode .print-page{break-after:page;page-break-after:always;padding-top:0!important;padding-bottom:20pt!important}.pdf-download-mode .print-page:last-child{break-after:auto!important;page-break-after:auto!important;padding-bottom:0!important}.pdf-download-mode .pdf-page-start{break-before:page;page-break-before:always;margin-top:0!important;padding-top:0!important}.pdf-download-mode .pdf-page-content{margin-top:0!important;padding-top:0!important}.pdf-download-mode .pdf-table-page{margin-top:0!important;margin-bottom:0!important;padding-top:0!important;padding-bottom:0!important}.pdf-download-mode .pdf-page-end{break-after:auto!important;page-break-after:auto!important}.pdf-download-mode .pdf-chart-page{display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-items:start!important;gap:14pt!important}.pdf-download-mode .pdf-chart-page .print-card{padding:12pt!important}.pdf-download-mode .pdf-chart-page .pdf-table-row{padding-top:5pt!important;padding-bottom:5pt!important}.pdf-download-mode .pdf-chart-page h2,.pdf-chart-page h3{font-size:14pt!important;line-height:1.2!important}.pdf-download-mode .pdf-avoid,.pdf-download-mode .print-break,.pdf-download-mode .print-card,.pdf-download-mode .pdf-table-row{break-inside:avoid;page-break-inside:avoid}.pdf-download-mode .print-input-control{display:none!important}.pdf-download-mode .print-input-text{display:inline!important;color:inherit!important;font:inherit!important;font-weight:inherit!important;line-height:inherit!important;white-space:pre-wrap!important}.pdf-download-mode .print-hidden{display:none!important}.pdf-download-mode .pdf-hidden{display:none!important}.pdf-download-mode .pdf-machine-readable{position:absolute!important;left:0!important;top:0!important;width:1px!important;height:1px!important;overflow:hidden!important;color:#fff!important;background:#fff!important;font-size:1px!important;line-height:1px!important;white-space:pre-wrap!important}.pdf-download-mode > :last-child{break-after:auto!important;page-break-after:auto!important;margin-bottom:0!important;padding-bottom:0!important}.pdf-machine-readable{position:absolute!important;left:-10000px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;color:transparent!important;background:transparent!important;font-size:1px!important;line-height:1px!important;white-space:pre-wrap!important}}"}
      </style>
      <style>
        {`
          .report-typography{
            --report-type-caption:var(--krds-type-caption);
            --report-type-label:var(--krds-type-label);
            --report-type-body:var(--krds-type-body);
            --report-type-subtitle:var(--krds-type-subtitle);
            --report-type-title:var(--krds-type-title);
            --report-type-display:var(--krds-type-display);
            --report-line-compact:var(--krds-line-compact);
            --report-line-body:1.5;
            font-size:var(--report-type-body)!important;
            line-height:var(--report-line-body)!important;
          }
          .report-typography :where(.text-xs,[class~="text-[10px]"],[class~="text-[11px]"],[class~="text-[12px]"]):not(.material-symbols-outlined){font-size:var(--report-type-caption)!important;line-height:var(--report-line-compact)!important}
          .report-typography :where(.text-sm,[class~="text-[13px]"],[class~="text-[14px]"]):not(.material-symbols-outlined){font-size:var(--report-type-label)!important;line-height:var(--report-line-compact)!important}
          .report-typography :where(.text-base,[class~="text-[15px]"],[class~="text-[16px]"],[class~="text-[17px]"]):not(.material-symbols-outlined){font-size:var(--report-type-body)!important;line-height:var(--report-line-body)!important}
          .report-typography :where(.text-lg,.text-xl,[class~="text-[18px]"],[class~="text-[20px]"]):not(.material-symbols-outlined){font-size:var(--report-type-subtitle)!important;line-height:1.35!important}
          .report-typography :where(.text-2xl,[class~="text-[22px]"],[class~="text-[24px]"]):not(.material-symbols-outlined){font-size:var(--report-type-title)!important;line-height:1.25!important}
          .report-typography :where(.text-3xl,.text-4xl,.text-5xl):not(.material-symbols-outlined){font-size:var(--report-type-display)!important;line-height:1.15!important}
          .report-typography .krds-type-report-cover-title{font-size:40px!important;line-height:1.08!important}
          .report-typography .print-table th{line-height:1.3!important}
          .report-typography .print-table td{line-height:1.4!important}
          .report-typography .font-mono{font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important}
          .report-typography .krds-type-report-total{width:100%!important;margin-top:8px!important;font-size:32px!important;line-height:1.05!important;white-space:nowrap!important}
          .report-typography .pdf-chart-bar-page,
          .report-typography .pdf-chart-pie-page{grid-template-columns:minmax(0,1fr)!important}
          .report-typography .pdf-chart-pie-page .pdf-chart-panel{width:100%!important}
          .report-typography .pdf-chart-pie-page .report-pie-visual-inner{max-width:430px!important}
          @media(max-width:767px){
            .report-typography .print-report-hero-grid{grid-template-columns:minmax(0,1fr)!important}
            .report-typography .print-report-total-card{width:100%!important;justify-self:stretch!important;text-align:left!important}
            .report-typography .print-report-title-wrap{min-height:auto!important}
            .report-typography .pdf-chart-page{grid-template-columns:minmax(0,1fr)!important}
          }
          @media print{
            .report-typography,
            .report-typography.pdf-download-mode{
              --report-type-caption:9pt;
              --report-type-label:10.5pt;
              --report-type-body:11pt;
              --report-type-subtitle:15pt;
              --report-type-title:20pt;
              --report-type-display:28pt;
              --report-line-compact:1.22;
              --report-line-body:1.38;
            }
            .report-typography .krds-type-report-cover-title{font-size:32pt!important;line-height:1.05!important}
            .report-typography .krds-type-report-total{font-size:28pt!important;line-height:1.05!important}
            .report-typography .print-input-control{display:none!important}
            .report-typography .print-input-text{display:inline!important}
            .report-typography .print-report-total-card .print-input-text{display:block!important}
            .report-typography .print-report-hero-grid{grid-template-columns:minmax(0,1.45fr) 235px!important;gap:12pt!important}
            .report-typography .print-report-total-card{width:235px!important;padding:11pt!important}
            .report-typography .print-report-title-wrap{min-height:82px!important}
            .report-typography .print-card{padding:11pt!important}
            .report-typography .pdf-table-page{padding:0!important}
            .report-typography .pdf-table-page th{padding:4pt 7pt!important}
            .report-typography .pdf-table-page tbody tr:not(:last-child) td{padding:2.75pt 7pt!important}
            .report-typography .pdf-table-page tbody tr:last-child td{padding:6pt 7pt!important}
          }
          @media screen{
            .report-typography:not(.pdf-download-mode) .print-input-control{display:block!important}
            .report-typography:not(.pdf-download-mode) .print-input-text{display:none!important}
            .report-typography.pdf-download-mode .print-input-control{display:none!important}
            .report-typography.pdf-download-mode .print-input-text{display:inline!important}
            .report-typography.pdf-download-mode .print-report-total-card .print-input-text{display:block!important}
            .report-typography.pdf-download-mode{
              --report-type-caption:9pt;
              --report-type-label:10.5pt;
              --report-type-body:11pt;
              --report-type-subtitle:15pt;
              --report-type-title:20pt;
              --report-type-display:28pt;
              --report-line-compact:1.22;
              --report-line-body:1.38;
            }
            .report-typography.pdf-download-mode .krds-type-report-cover-title{font-size:32pt!important;line-height:1.05!important}
            .report-typography.pdf-download-mode .krds-type-report-total{font-size:28pt!important;line-height:1.05!important}
            .report-typography.pdf-download-mode .print-report-hero-grid{grid-template-columns:minmax(0,1.45fr) 235px!important;gap:12pt!important}
            .report-typography.pdf-download-mode .print-report-total-card{width:235px!important;padding:11pt!important}
            .report-typography.pdf-download-mode .print-report-title-wrap{min-height:82px!important}
            .report-typography.pdf-download-mode .print-card{padding:11pt!important}
            .report-typography.pdf-download-mode .pdf-table-page{padding:0!important}
            .report-typography.pdf-download-mode .pdf-table-page th{padding:4pt 7pt!important}
            .report-typography.pdf-download-mode .pdf-table-page tbody tr:not(:last-child) td{padding:2.75pt 7pt!important}
            .report-typography.pdf-download-mode .pdf-table-page tbody tr:last-child td{padding:6pt 7pt!important}
          }
          .pdf-download-mode .pdf-table-page{
            overflow:visible!important;
            border-radius:18px!important;
          }
          .pdf-download-mode .pdf-table-page.print-card{
            break-inside:auto!important;
            page-break-inside:auto!important;
          }
          .pdf-download-mode .pdf-table-page td{
            line-height:1.35!important;
            padding-top:7px!important;
            padding-bottom:7px!important;
          }
          .pdf-download-mode .pdf-table-page tbody tr{
            min-height:30px!important;
          }
          .pdf-download-mode .pdf-table-page .print-input-text{
            display:inline-block!important;
            width:auto!important;
            min-width:0!important;
            height:auto!important;
            margin:0!important;
            padding:0!important;
            background:transparent!important;
            line-height:1.25!important;
            vertical-align:middle!important;
            white-space:nowrap!important;
            transform:none!important;
          }
          .report-typography.pdf-download-mode,
          .report-typography.pdf-download-mode *{
            font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page th,
          .report-typography.pdf-download-mode .pdf-table-page td{
            vertical-align:middle!important;
          }
          .report-typography.pdf-download-mode .report-value-unit{
            display:inline-flex!important;
            align-items:center!important;
            justify-content:center!important;
            gap:4px!important;
            min-height:20px!important;
            line-height:1.25!important;
            vertical-align:middle!important;
            white-space:nowrap!important;
          }
          .report-typography.pdf-download-mode .report-chart-metric{
            display:inline-flex!important;
            align-items:baseline!important;
            justify-content:flex-end!important;
            gap:4px!important;
            line-height:1.25!important;
            white-space:nowrap!important;
          }
          .report-typography.pdf-download-mode .print-report-total-card{
            display:flex!important;
            min-height:112px!important;
            flex-direction:column!important;
            align-items:flex-end!important;
            justify-content:center!important;
            text-align:right!important;
          }
          .report-typography.pdf-download-mode .print-report-total-label,
          .report-typography.pdf-download-mode .print-report-total-unit{
            display:block!important;
            width:100%!important;
            margin:0!important;
            line-height:1.25!important;
            text-align:right!important;
          }
          .report-typography.pdf-download-mode .krds-type-report-total{
            display:block!important;
            width:100%!important;
            margin:5pt 0 4pt!important;
            line-height:1!important;
            text-align:right!important;
          }
          /* PDF capture uses one deterministic type/spacing scale. Inputs are removed
             from layout completely so html2canvas cannot paint their glyphs twice. */
          .report-typography.pdf-download-mode{
            background:#fff!important;
            --pdf-caption:8.5pt;
            --pdf-label:9.5pt;
            --pdf-body:10pt;
            --pdf-subtitle:13pt;
            --pdf-title:18pt;
            --pdf-display:22pt;
          }
          .report-typography.pdf-download-mode input.print-input-control,
          .report-typography.pdf-download-mode textarea.print-input-control{
            display:none!important;
            visibility:hidden!important;
            position:absolute!important;
            width:0!important;
            height:0!important;
            min-width:0!important;
            min-height:0!important;
            overflow:hidden!important;
            opacity:0!important;
          }
          .report-typography.pdf-download-mode .print-input-text{
            display:inline-block!important;
            width:auto!important;
            height:auto!important;
            min-width:0!important;
            margin:0!important;
            padding:0!important;
            background:transparent!important;
            line-height:1.25!important;
            vertical-align:middle!important;
          }
          .report-typography.pdf-download-mode .krds-type-report-cover-title{
            font-size:var(--pdf-display)!important;
            line-height:1.12!important;
          }
          .report-typography.pdf-download-mode .print-report-total-card{
            min-height:90px!important;
            padding:12pt 14pt!important;
            gap:4pt!important;
          }
          .report-typography.pdf-download-mode .print-report-total-label{
            font-size:var(--pdf-label)!important;
            line-height:1.3!important;
          }
          .report-typography.pdf-download-mode .krds-type-report-total{
            margin:0!important;
            font-size:var(--pdf-title)!important;
            line-height:1.15!important;
          }
          .report-typography.pdf-download-mode .print-report-total-unit{
            font-size:var(--pdf-label)!important;
            line-height:1.3!important;
          }
          .report-typography.pdf-download-mode .print-metric-grid{
            grid-auto-rows:1fr!important;
            align-items:stretch!important;
          }
          .report-typography.pdf-download-mode .print-metric-card{
            display:grid!important;
            grid-template-rows:minmax(16pt,auto) minmax(22pt,auto) minmax(22pt,auto)!important;
            align-items:center!important;
            min-height:78pt!important;
            padding:9pt!important;
          }
          .report-typography.pdf-download-mode .print-metric-card>*{
            margin:0!important;
            align-self:center!important;
            line-height:1.25!important;
          }
          .report-typography.pdf-download-mode .print-output-section .print-table th{
            height:34pt!important;
            padding:0 6pt!important;
            vertical-align:middle!important;
            line-height:1.25!important;
          }
          .report-typography.pdf-download-mode .print-output-section .print-table td{
            height:54pt!important;
            padding:0 6pt!important;
            vertical-align:middle!important;
          }
          .report-typography.pdf-download-mode .print-output-section .print-table td>*,
          .report-typography.pdf-download-mode .print-output-section .print-table td>*>*{
            vertical-align:middle!important;
          }
          .report-typography.pdf-download-mode .pdf-chart-page{
            grid-template-columns:repeat(2,minmax(0,1fr))!important;
            gap:12pt!important;
            background:#fff!important;
          }
          .report-typography.pdf-download-mode .report-bar-list{margin-top:12pt!important}
          .report-typography.pdf-download-mode .report-bar-row{
            display:grid!important;
            grid-template-rows:minmax(18pt,auto) 6pt minmax(16pt,auto)!important;
            align-items:center!important;
            row-gap:4pt!important;
            min-height:54pt!important;
            padding:6pt 8pt!important;
          }
          .report-typography.pdf-download-mode .report-bar-row>*{margin:0!important}
          .report-typography.pdf-download-mode .report-pie-visual{margin-top:10pt!important}
          .report-typography.pdf-download-mode .report-pie-visual-inner{max-width:190px!important}
          .report-typography.pdf-download-mode .report-pie-legend{
            margin-top:10pt!important;
            grid-template-columns:minmax(0,1fr)!important;
            gap:5pt!important;
          }
          .report-typography.pdf-download-mode .report-pie-legend-item{
            min-height:34pt!important;
            padding:6pt 7pt!important;
            color:#334155!important;
          }
          .report-typography.pdf-download-mode .report-pie-legend-item *{
            color:#475569!important;
            opacity:1!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page table{
            table-layout:fixed!important;
            border-collapse:separate!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page th{
            height:30pt!important;
            padding:0 7pt!important;
            line-height:1.25!important;
            vertical-align:middle!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page tbody tr:not(:last-child) td{
            height:27pt!important;
            padding:0 7pt!important;
            line-height:1.25!important;
            vertical-align:middle!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page tr.bg-blue-50 td{
            height:24pt!important;
          }
          .report-typography.pdf-download-mode .report-value-unit{
            min-height:20pt!important;
            padding:0 6pt!important;
            align-items:center!important;
            line-height:1.2!important;
          }
          .report-typography.pdf-download-mode .print-total-value{
            min-width:180px!important;
            padding:9pt 12pt!important;
          }
          .report-typography.pdf-download-mode .print-total-value .print-input-text{
            font-size:var(--pdf-title)!important;
            line-height:1.15!important;
          }
          .report-typography.pdf-download-mode .print-total-value-unit{
            margin-top:4pt!important;
            font-size:var(--pdf-label)!important;
            line-height:1.25!important;
          }
          /* Layout v2: typography establishes the box height; every visible cell has
             one centering container instead of relying on table padding/baselines. */
          .report-typography.pdf-download-mode .print-metric-card{
            grid-template-rows:auto auto auto!important;
            align-content:center!important;
            justify-items:stretch!important;
            row-gap:5pt!important;
            min-height:82pt!important;
          }
          .report-typography.pdf-download-mode .print-metric-label{
            min-height:13pt!important;
            font-size:var(--pdf-label)!important;
            line-height:13pt!important;
          }
          .report-typography.pdf-download-mode .print-metric-value{
            min-height:21pt!important;
            font-size:var(--pdf-subtitle)!important;
            line-height:21pt!important;
          }
          .report-typography.pdf-download-mode .print-metric-note{
            display:flex!important;
            min-height:26pt!important;
            align-items:center!important;
            justify-content:center!important;
            font-size:var(--pdf-label)!important;
            line-height:13pt!important;
          }
          .report-typography.pdf-download-mode .print-output-section .print-table td{
            height:58pt!important;
            padding:0!important;
          }
          .report-typography.pdf-download-mode .print-output-cell-inner{
            box-sizing:border-box!important;
            display:flex!important;
            width:100%!important;
            min-height:58pt!important;
            padding:6pt!important;
            align-items:center!important;
            justify-content:center!important;
            line-height:1.3!important;
          }
          .report-typography.pdf-download-mode .print-output-cell-inner.output-name{
            flex-direction:column!important;
            align-items:stretch!important;
            justify-content:center!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page tbody tr:not(:last-child) td{
            height:28pt!important;
            padding:0!important;
          }
          .report-typography.pdf-download-mode .detail-cell-inner{
            box-sizing:border-box!important;
            display:flex!important;
            width:100%!important;
            min-height:28pt!important;
            padding:0 7pt!important;
            align-items:center!important;
            justify-content:flex-start!important;
            overflow:visible!important;
            line-height:1.25!important;
          }
          .report-typography.pdf-download-mode .detail-cell-inner.center{
            justify-content:center!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page tr.bg-blue-50 .detail-cell-inner{
            min-height:24pt!important;
          }
          .report-typography.pdf-download-mode .detail-cell-inner .report-value-unit{
            margin:0!important;
          }
          /* A4 layout v3: one page is 595x842pt. With 8mm side margins the usable
             content width is 550pt; table row heights are budgeted to stay below
             the 785pt usable page height. */
          .report-typography.pdf-download-mode{
            --report-type-caption:8pt;
            --report-type-label:9pt;
            --report-type-body:9.5pt;
            --report-type-subtitle:12pt;
            --report-type-title:16pt;
            --report-type-display:24pt;
            --pdf-caption:8pt;
            --pdf-label:9pt;
            --pdf-body:9.5pt;
            --pdf-subtitle:12pt;
            --pdf-title:16pt;
            --pdf-display:24pt;
          }
          .report-typography.pdf-download-mode .pdf-chart-page{
            box-sizing:border-box!important;
            display:grid!important;
            grid-template-columns:repeat(2,minmax(0,1fr))!important;
            width:100%!important;
            min-height:0!important;
            padding:18pt!important;
            gap:12pt!important;
            align-items:stretch!important;
            break-inside:avoid!important;
            page-break-inside:avoid!important;
          }
          .report-typography.pdf-download-mode .pdf-chart-panel{
            box-sizing:border-box!important;
            min-width:0!important;
            height:100%!important;
            padding:11pt!important;
            break-inside:auto!important;
            page-break-inside:auto!important;
          }
          .report-typography.pdf-download-mode .report-bar-row{
            grid-template-rows:minmax(15pt,auto) 5pt minmax(13pt,auto)!important;
            row-gap:3pt!important;
            min-height:43pt!important;
            padding:5pt 7pt!important;
          }
          .report-typography.pdf-download-mode .report-bar-row .text-sm{
            font-size:9.5pt!important;
            line-height:13pt!important;
          }
          .report-typography.pdf-download-mode .report-pie-visual-inner{max-width:162px!important}
          .report-typography.pdf-download-mode .report-pie-legend{gap:4pt!important}
          .report-typography.pdf-download-mode .report-pie-legend-item{
            min-height:28pt!important;
            padding:4pt 6pt!important;
          }
          .report-typography.pdf-download-mode .pie-legend-label,
          .report-typography.pdf-download-mode .pie-legend-metric{
            display:block!important;
            overflow:visible!important;
            color:#334155!important;
            -webkit-text-fill-color:#334155!important;
            opacity:1!important;
            text-overflow:clip!important;
            white-space:normal!important;
          }
          .report-typography.pdf-download-mode .pie-legend-label{
            font-size:8.5pt!important;
            line-height:11pt!important;
          }
          .report-typography.pdf-download-mode .pie-legend-metric{
            font-size:8pt!important;
            line-height:10pt!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page>div:first-child{
            min-height:36pt!important;
            padding:0 12pt!important;
            display:flex!important;
            align-items:center!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page th{
            height:25pt!important;
            padding:0 6pt!important;
            font-size:9pt!important;
            line-height:11pt!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page tbody tr:not(:last-child) td{
            height:21pt!important;
            padding:0!important;
            font-size:9.5pt!important;
            line-height:12pt!important;
          }
          .report-typography.pdf-download-mode .detail-cell-inner{
            min-height:21pt!important;
            padding:0 6pt!important;
            font-size:9.5pt!important;
            line-height:12pt!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page tr.bg-blue-50 td,
          .report-typography.pdf-download-mode .pdf-table-page tr.bg-blue-50 .detail-cell-inner{
            height:19pt!important;
            min-height:19pt!important;
            font-size:9pt!important;
            line-height:11pt!important;
          }
          .report-typography.pdf-download-mode .report-value-unit{
            min-height:16pt!important;
            padding:0 5pt!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page tbody tr:last-child td{
            height:52pt!important;
            padding:0 10pt!important;
          }
          .report-typography.pdf-download-mode .print-total-value{
            min-width:160px!important;
            padding:7pt 10pt!important;
          }
          /* Capture-safe flow: html2canvas is reliable with normal block/table flow,
             but not with nested constrained grids. Keep the two outer chart columns
             and use natural block flow inside each panel. */
          .report-typography.pdf-download-mode .pdf-chart-page{
            min-height:760px!important;
            background:#fff!important;
          }
          .report-typography.pdf-download-mode .pdf-chart-panel{
            height:auto!important;
            min-height:610px!important;
            align-self:start!important;
            overflow:visible!important;
          }
          .report-typography.pdf-download-mode .report-bar-list{
            display:block!important;
            margin-top:12pt!important;
          }
          .report-typography.pdf-download-mode .report-bar-row{
            display:block!important;
            min-height:0!important;
            margin:0 0 8pt!important;
            padding:7pt 8pt!important;
            overflow:visible!important;
          }
          .report-typography.pdf-download-mode .report-bar-row>div:first-child{
            display:flex!important;
            min-height:16pt!important;
            align-items:center!important;
            justify-content:space-between!important;
            gap:6pt!important;
            font-size:8.5pt!important;
            line-height:12pt!important;
          }
          .report-typography.pdf-download-mode .report-bar-row>div:nth-child(2){
            display:block!important;
            height:5pt!important;
            margin:6pt 0 4pt!important;
          }
          .report-typography.pdf-download-mode .report-bar-row>p{
            min-height:12pt!important;
            margin:0!important;
            font-size:8.5pt!important;
            line-height:12pt!important;
          }
          .report-typography.pdf-download-mode .report-chart-metric{
            flex:0 0 auto!important;
            max-width:52%!important;
            font-size:8.5pt!important;
            line-height:12pt!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page{
            min-height:760px!important;
            background:#fff!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page th{
            height:auto!important;
            padding:7pt 6pt!important;
            font-size:9pt!important;
            line-height:12pt!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page tbody tr:not(:last-child) td{
            height:auto!important;
            padding:0!important;
            vertical-align:middle!important;
          }
          .report-typography.pdf-download-mode .detail-cell-inner{
            box-sizing:border-box!important;
            display:block!important;
            width:100%!important;
            min-height:28px!important;
            padding:6px 7px!important;
            overflow:visible!important;
            font-size:9pt!important;
            line-height:16px!important;
            white-space:normal!important;
          }
          .report-typography.pdf-download-mode .detail-cell-inner.center{
            display:flex!important;
            align-items:center!important;
            justify-content:center!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page tr.bg-blue-50 td,
          .report-typography.pdf-download-mode .pdf-table-page tr.bg-blue-50 .detail-cell-inner{
            height:auto!important;
            min-height:28px!important;
            font-size:9pt!important;
            line-height:16px!important;
          }
          .report-typography.pdf-download-mode .pdf-table-page tbody tr:last-child td{
            height:auto!important;
            padding:9pt 10pt!important;
          }
          .report-typography.pdf-download-mode{
            box-sizing:border-box!important;
            width:794px!important;
            max-width:794px!important;
            margin:0 auto!important;
            overflow:visible!important;
            border:0!important;
            border-radius:0!important;
            box-shadow:none!important;
            background:#fff!important;
          }
          .report-typography.pdf-download-mode .pdf-export-page{
            box-sizing:border-box!important;
            display:block!important;
            width:794px!important;
            height:1123px!important;
            min-height:1123px!important;
            max-height:1123px!important;
            margin:0!important;
            overflow:hidden!important;
            background:#fff!important;
          }
          .report-typography.pdf-download-mode .pdf-export-page.pdf-chart-page{
            display:grid!important;
            min-height:1123px!important;
          }
          .report-typography.pdf-download-mode .pdf-table-export-page{
            min-height:1123px!important;
            padding-top:24px!important;
          }
          /* WYSIWYG export: preserve the visible report design. Only page geometry
             and editor-control visibility differ from the browser screen. */
          .report-typography.pdf-wysiwyg-mode{
            box-sizing:border-box!important;
            width:1024px!important;
            max-width:1024px!important;
            margin:0!important;
            overflow:visible!important;
            border:0!important;
            border-radius:0!important;
            box-shadow:none!important;
            background:#fff!important;
          }
          .report-typography.pdf-wysiwyg-mode .pdf-export-page{
            box-sizing:border-box!important;
            width:1024px!important;
            height:1448px!important;
            min-height:1448px!important;
            max-height:1448px!important;
            margin:0!important;
            overflow:hidden!important;
            background:#fff!important;
          }
          .report-typography.pdf-wysiwyg-mode .pdf-chart-page{
            display:grid!important;
            grid-template-columns:repeat(2,minmax(0,1fr))!important;
            align-items:start!important;
          }
          .report-typography.pdf-wysiwyg-mode .pdf-table-export-page{
            padding-top:24px!important;
          }
          .report-typography.pdf-wysiwyg-mode .print-hidden,
          .report-typography.pdf-wysiwyg-mode .pdf-hidden,
          .report-typography.pdf-wysiwyg-mode input.print-input-control,
          .report-typography.pdf-wysiwyg-mode textarea.print-input-control{
            display:none!important;
          }
          .report-typography.pdf-wysiwyg-mode .print-input-text{
            display:inline!important;
            color:inherit!important;
            font:inherit!important;
            font-weight:inherit!important;
            line-height:inherit!important;
            white-space:pre-wrap!important;
          }
          .report-typography.pdf-wysiwyg-mode .print-report-total-card .print-input-text,
          .report-typography.pdf-wysiwyg-mode .print-metric-card .print-input-text{
            display:block!important;
            width:100%!important;
            text-align:inherit!important;
          }
          .pdf-download-mode.pdf-design-draft .print-report-hero{
            background:#ffffff!important;
            color:#0f172a!important;
            border:1px solid #cbd5e1!important;
            border-radius:4px!important;
            margin:0 0 12px!important;
            padding:18px!important;
          }
          .pdf-download-mode.pdf-design-draft .print-report-hero *,
          .pdf-download-mode.pdf-design-draft .print-report-title,
          .pdf-download-mode.pdf-design-draft .print-report-title-tag{
            color:#0f172a!important;
          }
          .pdf-download-mode.pdf-design-draft .print-report-hero-deco{
            display:none!important;
          }
          .pdf-download-mode.pdf-design-draft .print-report-total-card{
            background:#f6f9fc!important;
            border:1px solid #b8c7d8!important;
            box-shadow:none!important;
          }
          .pdf-download-mode.pdf-design-draft .print-report-total-card *{
            color:#0f172a!important;
          }
          .pdf-download-mode.pdf-design-draft .print-card{
            border-color:#cbd5e1!important;
            border-radius:6px!important;
            box-shadow:none!important;
          }
          .pdf-download-mode.pdf-design-draft .print-soft-bg,
          .pdf-download-mode.pdf-design-draft .print-total-value{
            background:#f8fafc!important;
          }
          .pdf-download-mode.pdf-design-draft .print-total-cell{
            background:#f1f5f9!important;
            color:#0f172a!important;
          }
          .pdf-download-mode.pdf-design-draft .pdf-table-page thead,
          .pdf-download-mode.pdf-design-draft .pdf-table-page tr.bg-blue-50{
            background:#eef4fa!important;
          }
          .pdf-download-mode.pdf-draft-agency .print-report-hero{
            border:1px solid #9fb3c8!important;
            border-top:12px solid #164b7a!important;
            background:#f7fafe!important;
            box-shadow:inset 0 -1px 0 #d7e2ec!important;
          }
          .pdf-download-mode.pdf-draft-agency .print-card{
            border-color:#afc2d3!important;
          }
          .pdf-download-mode.pdf-draft-agency .pdf-table-page thead,
          .pdf-download-mode.pdf-draft-agency .pdf-table-page tr.bg-blue-50{
            background:#e7f0f8!important;
          }
          .pdf-download-mode.pdf-draft-summary .print-report-hero{
            border:3px double #8f2f36!important;
            background:#fffdfb!important;
            padding:20px 22px!important;
          }
          .pdf-download-mode.pdf-draft-summary .print-report-total-card,
          .pdf-download-mode.pdf-draft-summary .print-total-cell{
            background:#fff5f3!important;
            border-color:#d9a8a3!important;
          }
          .pdf-download-mode.pdf-draft-summary .print-card{
            border-color:#d8c3bd!important;
          }
          .pdf-download-mode.pdf-draft-summary .pdf-table-page thead,
          .pdf-download-mode.pdf-draft-summary .pdf-table-page tr.bg-blue-50{
            background:#f8ece9!important;
          }
          .pdf-download-mode.pdf-draft-table .print-report-hero{
            border:3px double #334155!important;
            background:#f8fafc!important;
            border-radius:0!important;
          }
          .pdf-download-mode.pdf-draft-table .print-card,
          .pdf-download-mode.pdf-draft-table .pdf-table-page{
            border-radius:0!important;
            border-color:#64748b!important;
          }
          .pdf-download-mode.pdf-draft-table .pdf-table-page table,
          .pdf-download-mode.pdf-draft-table .pdf-table-page th,
          .pdf-download-mode.pdf-draft-table .pdf-table-page td{
            border-color:#64748b!important;
          }
          .pdf-download-mode.pdf-draft-table .pdf-table-page thead,
          .pdf-download-mode.pdf-draft-table .pdf-table-page tr.bg-blue-50{
            background:#e5e7eb!important;
          }
          .pdf-download-mode.pdf-draft-compact .print-report-hero{
            border:1px solid #8bbcaf!important;
            border-left:12px solid #08785f!important;
            background:#f4fbf8!important;
            padding:16px 18px!important;
          }
          .pdf-download-mode.pdf-draft-compact .print-card{
            border-radius:4px!important;
            border-color:#a8cfc3!important;
          }
          .pdf-download-mode.pdf-draft-compact .pdf-chart-page{
            gap:10pt!important;
          }
          .pdf-download-mode.pdf-draft-compact .pdf-table-page thead,
          .pdf-download-mode.pdf-draft-compact .pdf-table-page tr.bg-blue-50{
            background:#e5f5ef!important;
          }
        `}
      </style>
      <div className="print-hidden mx-auto mb-4 flex max-w-5xl flex-wrap justify-between gap-3">
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700" onClick={() => navigate(reportReturnPath)} type="button">
          {en ? "Back To Report" : "리포트로 돌아가기"}
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-wait disabled:bg-slate-500"
            disabled={verificationBusy}
            onClick={() => handleDownloadPdf(null)}
            type="button"
          >
            {verificationBusy ? (en ? "Preparing PDF..." : "PDF 생성 중...") : (en ? "Download PDF" : "PDF 다운로드")}
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
      {missingRequiredLabels.length > 0 ? <div aria-live="assertive" className="print-hidden mx-auto mb-4 max-w-5xl rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-700" role="alert">{en ? `${missingRequiredLabels.length} required report items are missing: ` : `레포트 필수 항목 ${missingRequiredLabels.length}개를 확인해 주세요: `}{missingRequiredLabels.join(", ")}</div> : null}

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

      <article className={`report-typography print-sheet mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)] ${pdfDownloadMode ? `pdf-download-mode${pdfDesignDraft ? ` pdf-design-draft pdf-draft-${pdfDesignDraft}` : ""}` : ""}`} ref={reportArticleRef}>
        <div className="pdf-export-page print-page">
        <header className="print-ink-bg print-report-hero relative overflow-hidden bg-slate-950 px-8 py-8 text-white">
          <div className="print-report-hero-deco absolute -right-20 -top-28 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="print-report-hero-deco absolute bottom-0 right-0 h-36 w-72 rounded-tl-full bg-emerald-400/10" />
          <p className="print-report-title-tag relative text-xs font-black uppercase tracking-[0.24em] text-cyan-200">{en ? "Product / Byproduct Emission Factor Report" : "제품/부산물 배출계수 리포트"}</p>
          <div className="print-report-hero-grid relative mt-4 grid items-center gap-5 lg:grid-cols-[minmax(0,1.4fr)_320px]">
            <div className="print-report-title-wrap flex min-h-28 items-center">
              <h1 className="krds-type-report-cover-title print-report-title max-w-2xl text-4xl font-black leading-tight tracking-[-0.055em]">
                <EditableText
                  className="krds-type-report-cover-title print-report-title max-w-2xl bg-transparent text-4xl font-black leading-tight tracking-[-0.055em] text-white"
                  id="survey-report-product-name"
                  onCommit={(value) => setDraftReport((current) => current ? { ...current, productName: value } : current)}
                  required
                  value={en ? resolveEnglishMaterialName(effectiveReport.productName || effectiveReport.pageTitle, englishNameMap) : (effectiveReport.productName || effectiveReport.pageTitle)}
                />
              </h1>
            </div>
            <div className="print-report-total-card rounded-3xl border border-white/15 bg-white/10 p-4 text-right shadow-2xl backdrop-blur">
              <p className="print-report-total-label text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100">{en ? "Total Footprint" : "총 탄소배출량"}</p>
              <EditableNumber
                className="krds-type-report-total mt-3 inline-block w-32 max-w-full bg-transparent text-right text-3xl font-black tracking-[-0.05em] text-white"
                id="survey-report-total-emission"
                onCommit={updateTotalEmission}
                required
                value={totalEmission}
              />
              <p className="print-report-total-unit mt-1 text-xs text-slate-300">kg CO2e</p>
            </div>
          </div>
        </header>

        <div className="px-8 py-7">
        <section className="pdf-avoid print-card print-soft-bg mt-7 rounded-3xl border border-amber-200 bg-[linear-gradient(135deg,#fffbeb,#fff7ed)] p-5">
          <div className="flex flex-wrap justify-between gap-3 items-start">
            <div>
              <h2 className="mt-1 text-xl font-black">{en ? "Product And Byproduct Mass Basis" : "제품 및 부산물 질량 기준"}</h2>
            </div>
            <div className="pdf-hidden min-w-[160px] bg-white rounded-xl p-1 shadow-sm border border-amber-200 print:hidden">
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
          <div className="print-metric-grid mt-4 grid gap-3 sm:grid-cols-3">
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

        <section className="print-output-section pdf-avoid print-card mt-7 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
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

        <section className="pdf-export-page pdf-avoid pdf-page-start pdf-page-end pdf-page-content pdf-chart-page pdf-chart-bar-page grid gap-4 px-8 py-7">
          <div className="pdf-chart-panel print-soft-bg rounded-3xl border border-slate-200 bg-slate-50 p-5">
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
            <div className="report-bar-list mt-4 space-y-3">
              {chartSections.map((section, index) => (
                <div className="report-bar-row pdf-table-row print-break rounded-xl bg-white/70 px-3 py-2" key={section.sectionCode}>
                  <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-3 text-sm font-black">
                    <span className="min-w-0 leading-5">{sectionLabel(section.sectionCode, section.sectionLabel, en)}</span>
	                    <span className="report-chart-metric inline-flex items-baseline justify-end gap-1 whitespace-nowrap font-mono text-right leading-5 text-slate-950">
                      <EditableNumber
                        className="inline-block w-24 bg-transparent text-right font-mono font-black leading-5"
                        onCommit={(value) => updateSectionEmission(section.sectionCode, value)}
                        value={section.totalEmission}
                      />
                      <span>kg CO2e</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full" style={{ backgroundColor: sectionSolidColor(index), width: `${Math.max(4, Math.min(section.sharePercent, 100))}%` }} />
                  </div>
	                  <p className="mt-1 flex min-h-5 items-center justify-end whitespace-nowrap text-xs font-bold leading-5 text-slate-500">
                    <EditableNumber
                      className="inline-block w-16 bg-transparent text-right font-mono font-bold leading-5 text-slate-500"
                      digits={1}
                      onCommit={(value) => updateDraftSectionShare(section.sectionCode, value)}
                      value={sectionShareInputs[section.sectionCode] ?? section.sharePercent}
                    />
                    <span>%</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pdf-export-page pdf-avoid pdf-page-start pdf-page-end pdf-page-content pdf-chart-page pdf-chart-pie-page grid px-8 py-7">
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

        <div className="pdf-export-page pdf-table-export-page">
        <section className="pdf-page-start pdf-page-content pdf-table-page print-card print-table mx-8 mb-7 overflow-visible rounded-3xl border border-slate-200 bg-white print:overflow-visible">
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
                <tr className="pdf-table-row print-break">
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
                        <div className="print-total-value-unit mt-1 whitespace-nowrap text-xs font-black text-slate-600">ton of {effectiveReport.productName || (en ? "Product" : "제품")}</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        </div>
        {verificationRecord ? (
          <>
            <footer className="report-verification-footer flex items-center justify-between gap-5 border-t border-slate-200 bg-white px-8 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">DIGITAL VERIFICATION</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {en ? "Scan to verify this issued report." : "발급된 리포트의 진위 여부를 확인할 수 있습니다."}
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-500">{verificationRecord.certificateId}</p>
                <div className="mt-2 space-y-0.5 font-mono text-[9px] leading-4 text-slate-500" data-report-verification-identifiers="visible">
                  <p>{en ? "SHA-256 report fingerprint" : "SHA-256 리포트 지문"}: {verificationRecord.payloadHash}</p>
                  <p>{en ? "Integrity code" : "무결성 코드"}: {verificationRecord.integrityCode}</p>
                  <p>{en ? "Dataset hash" : "데이터셋 해시"}: {verificationRecord.datasetHash || verificationRecord.payloadHash}</p>
                </div>
              </div>
              {verificationQrDataUrl ? <img alt={en ? "Report verification QR code" : "리포트 진위 확인 QR 코드"} className="h-[18mm] w-[18mm] shrink-0" src={verificationQrDataUrl} /> : null}
            </footer>
            <pre aria-hidden="true" className="pdf-machine-readable">
              {verificationPayloadToBlock(verificationRecord)}
            </pre>
          </>
        ) : null}
      </article>
    </main>
  );
}

export function EmissionSurveyReportVerifyPage({ embedded = false, screenDesign }: { embedded?: boolean; screenDesign?: CertificateVerificationScreenDesign } = {}) {
  const en = isEnglish();
  const [selectedReportType, setSelectedReportType] = useState<ReportVerificationType>("EMISSION_SURVEY");
  const [fileName, setFileName] = useState("");
  const [uploadedPdfSelected, setUploadedPdfSelected] = useState(false);
  const [uploadedPayloadFound, setUploadedPayloadFound] = useState(false);
  const [payload, setPayload] = useState<ReportVerificationPayload | null>(null);
  const [datasetVerification, setDatasetVerification] = useState<ReportDatasetVerificationResponse | null>(null);
  const [pdfFileVerification, setPdfFileVerification] = useState<ReportPdfFileVerificationResponse | null>(null);
  const [photoVerification, setPhotoVerification] = useState<ReportPhotoVerificationResponse | null>(null);
  const [ocrProgress, setOcrProgress] = useState<{ busy: boolean; percent: number; status: string }>({ busy: false, percent: 0, status: "" });
  const [verificationLogs, setVerificationLogs] = useState<Array<{ id: string; at: string; level: "INFO" | "OK" | "WARN" | "ERROR"; message: string; detail?: string }>>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [selectedDamageRegion, setSelectedDamageRegion] = useState<ReportDamageRegion | null>(null);
  const [selectedPreviewPage, setSelectedPreviewPage] = useState<number | null>(null);
  const [previewModalPage, setPreviewModalPage] = useState<number | null>(null);
  const [resultMessage, setResultMessage] = useState(en ? "Upload a certificate PDF or image to begin automatic verification." : "인증서 PDF 또는 이미지를 업로드하면 자동 검증을 시작합니다.");
  const [resultTone, setResultTone] = useState<"info" | "success" | "warning" | "danger">("info");
  const appendVerificationLog = (level: "INFO" | "OK" | "WARN" | "ERROR", message: string, detail?: string) => {
    setVerificationLogs((current) => [...current, {
      id: `${Date.now()}-${current.length}`,
      at: new Date().toLocaleTimeString(),
      level,
      message,
      detail
    }].slice(-200));
  };

  const applyPdfFileVerdict = (verification: ReportPdfFileVerificationResponse) => {
    setPdfFileVerification(verification);
    if (verification.status === "EXACT_PDF_MATCH" && verification.valid) {
      return true;
    }
    if (verification.status === "TAMPERED_PDF") {
      setResultTone("danger");
      setResultMessage(verification.verificationMode === "PDF_METADATA_DATES"
        ? (en
          ? "Tampered PDF: CreationDate and ModDate differ. QR, OCR, and visual similarity cannot override this modification evidence."
          : "변조 파일입니다. PDF 생성일과 수정일이 다릅니다. QR·OCR·시각 유사도로 이 수정 흔적을 덮어쓸 수 없습니다.")
        : (en
          ? "Tampered PDF: the uploaded file bytes differ from the issued original. QR, OCR, and visual similarity cannot override this result."
          : "변조 파일입니다. 업로드한 PDF 바이트가 발급 원본과 다릅니다. QR·OCR·시각 유사도로 이 결과를 덮어쓸 수 없습니다."));
      return true;
    }
    setResultTone("warning");
    setResultMessage(verification.status === "PDF_FINGERPRINT_UNAVAILABLE"
      ? (en ? "This legacy issuance has no final-PDF fingerprint, so exact-file authenticity cannot be proven." : "이 구형 발급 기록에는 최종 PDF 지문이 없어 파일 원본성을 증명할 수 없습니다.")
      : verification.status === "NOT_FOUND"
        ? (en ? "No issued PDF fingerprint exists for this certificate ID." : "이 인증서 ID의 발급 PDF 지문을 원장에서 찾지 못했습니다.")
        : (en ? "The server could not complete exact PDF-byte verification." : "서버가 PDF 원본 바이트 검증을 완료하지 못했습니다."));
    return false;
  };

  const verifyExactPdfFile = async (file: File, certificateId: string) => {
    try {
      const verification = await verifySurveyReportPdfFile(file, certificateId);
      appendVerificationLog(verification.valid ? "OK" : verification.status === "TAMPERED_PDF" ? "ERROR" : "WARN",
        en ? "Exact PDF-byte comparison completed." : "PDF 원본 바이트 대조를 완료했습니다.",
        `status=${verification.status}, hash=${verification.byteHashMatch === true ? "match" : "mismatch"}, size=${verification.sizeMatch === true ? "match" : "mismatch"}`);
      applyPdfFileVerdict(verification);
      return verification;
    } catch (error) {
      const verification: ReportPdfFileVerificationResponse = {
        valid: false,
        status: "VERIFICATION_ERROR",
        verificationMode: "EXACT_PDF_BYTES",
        certificateId,
        message: error instanceof Error ? error.message : String(error)
      };
      appendVerificationLog("ERROR", en ? "Exact PDF-byte comparison failed." : "PDF 원본 바이트 대조에 실패했습니다.", verification.message);
      applyPdfFileVerdict(verification);
      return verification;
    }
  };

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

  const evaluatePayload = async (nextPayload: ReportVerificationPayload | null, sourceLabel: string,
                                 exactPdfVerification: ReportPdfFileVerificationResponse | null = null) => {
    if (!nextPayload) {
      appendVerificationLog("WARN", en ? "No embedded verification dataset found." : "내장 검증 데이터셋을 찾지 못했습니다.", sourceLabel);
      setPayload(null);
      setDatasetVerification(null);
      setResultTone("warning");
      setResultMessage(en
        ? `No Carbonet verification block was found in ${sourceLabel}. If the browser compressed PDF text, paste the block printed on the last page.`
        : `${sourceLabel}에서 Carbonet 검증 블록을 찾지 못했습니다. 브라우저가 PDF 텍스트를 압축했다면 마지막 페이지의 검증 블록을 붙여넣으세요.`);
      return;
    }
    if (exactPdfVerification) {
      applyPdfFileVerdict(exactPdfVerification);
    }
    if (exactPdfVerification?.status === "INVALID_PDF") {
      setPayload(nextPayload);
      return;
    }
    const payloadReportType = nextPayload.reportType || (nextPayload.dataset?.reportType as ReportVerificationType | undefined) || "EMISSION_SURVEY";
    if (payloadReportType !== selectedReportType) {
      appendVerificationLog("WARN", en ? "The uploaded report type differs from the selected type." : "업로드 문서 종류가 선택한 리포트 종류와 다릅니다.", `${payloadReportType} != ${selectedReportType}`);
      setPayload(nextPayload);
      setDatasetVerification(null);
      setResultTone("warning");
      setResultMessage(en ? "Select the correct report type and upload the document again." : "올바른 리포트 종류를 선택한 후 문서를 다시 업로드하세요.");
      return;
    }
    setPayload(nextPayload);
    appendVerificationLog("OK", en ? "Embedded verification payload decoded." : "내장 검증 페이로드를 해석했습니다.", nextPayload.certificateId);
    if (nextPayload.version >= 2 && nextPayload.dataset) {
      try {
        const verification = await verifySurveyReportDataset(nextPayload);
        appendVerificationLog(verification.valid ? "OK" : "WARN", en ? "Registry dataset comparison completed." : "원장 데이터셋 대조를 완료했습니다.", `status=${verification.status}, differences=${verification.differenceCount || 0}`);
        setDatasetVerification(verification);
        setResultTone(verification.valid ? "success" : "warning");
        setResultMessage(verification.valid
          ? exactPdfVerification
            ? (en ? "Authenticity verified: the exact PDF bytes, certificate tags, and complete dataset all match the issued record." : "진위 확인 완료: PDF 원본 바이트·인증 태그·전체 데이터셋이 발급 원장과 모두 일치합니다.")
            : (en ? "Certificate tags and the complete report dataset match the issued record." : "인증 태그와 리포트 전체 데이터셋이 발급 원장과 일치합니다.")
          : (en ? `Dataset verification failed. ${verification.differenceCount || 0} differences were found.` : `데이터셋 검증에 실패했습니다. ${verification.differenceCount || 0}개의 불일치 항목을 확인했습니다.`));
      } catch (error) {
        appendVerificationLog("ERROR", en ? "Registry dataset comparison failed." : "원장 데이터셋 대조에 실패했습니다.", error instanceof Error ? error.message : String(error));
        setDatasetVerification(null);
        setResultTone("warning");
        setResultMessage(error instanceof Error ? error.message : (en ? "Server dataset verification failed." : "서버 데이터셋 검증에 실패했습니다."));
      }
      return;
    }
    if (exactPdfVerification?.status === "EXACT_PDF_MATCH") {
      setDatasetVerification(null);
      setResultTone("success");
      setResultMessage(en ? "Authenticity verified: the uploaded PDF bytes exactly match the issued original." : "진위 확인 완료: 업로드한 PDF 바이트가 발급 원본과 정확히 일치합니다.");
      return;
    }
    const records = loadReportVerificationRecords();
    const exact = records.some((record) => (
      record.certificateId === nextPayload.certificateId
      && record.payloadHash === nextPayload.payloadHash
      && record.integrityCode === nextPayload.integrityCode
    ));
    const sameId = records.some((record) => record.certificateId === nextPayload.certificateId);
    setDatasetVerification(null);
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

  const evaluatePhotographedPages = async (pages: Blob[], sourceLabel: string, preserveDigitalPayload = false,
                                            rawPdfFile: File | null = null,
                                            initialPdfVerification: ReportPdfFileVerificationResponse | null = null,
                                            digitalTextPages: string[] | null = null) => {
    appendVerificationLog("INFO", en ? "Photographed-page verification started." : "촬영 페이지 검증을 시작했습니다.", `${sourceLabel}, pages=${pages.length}`);
    if (!preserveDigitalPayload) {
      setUploadedPayloadFound(false);
    }
    setOcrProgress({ busy: true, percent: 0, status: en ? "Preparing pages" : "페이지 이미지 보정 중" });
    setResultTone("info");
    setResultMessage(en ? `Reading visible report data from ${sourceLabel}...` : `${sourceLabel}의 화면 데이터셋을 읽고 있습니다...`);
    let exactPdfVerification = initialPdfVerification;
    try {
      const qrEvidence = await scanReportQrEvidence(pages);
      appendVerificationLog(qrEvidence ? "OK" : "WARN", qrEvidence ? (en ? "Verification QR decoded." : "검증 QR을 판독했습니다.") : (en ? "Verification QR was not found." : "검증 QR을 찾지 못했습니다."), qrEvidence?.certificateId);
      if (rawPdfFile && !exactPdfVerification && qrEvidence?.certificateId) {
        exactPdfVerification = await verifyExactPdfFile(rawPdfFile, qrEvidence.certificateId);
        applyPdfFileVerdict(exactPdfVerification);
      }
      const visualProfile = await buildReportVisualProfile(pages);
      appendVerificationLog("OK", en ? "Uploaded visual fingerprint generated." : "업로드 문서 시각 지문을 생성했습니다.", `grid=${visualProfile.columns}x${visualProfile.rows}, pages=${visualProfile.pages.length}`);
      // Visible pixels are authoritative for tamper detection. A digital PDF's
      // hidden text layer can retain the original number after a bitmap overlay,
      // so every upload is OCR-read from the rendered pages as well.
      let recognized;
      let usedPdfTextFallback = false;
      const exactIssuedPdf = exactPdfVerification?.status === "EXACT_PDF_MATCH";
      const readableDigitalPages = digitalTextPages?.map((text) => text.trim()) || [];
      if (rawPdfFile && readableDigitalPages.length && readableDigitalPages.every(Boolean)) {
        usedPdfTextFallback = true;
        recognized = {
          text: readableDigitalPages.join("\n"),
          pageTexts: readableDigitalPages,
          pages: readableDigitalPages.map((text, index) => ({
            pageNumber: index + 1,
            text,
            confidence: 100,
            lines: []
          })),
          confidence: 100,
          engine: exactIssuedPdf ? "ISSUED_PDF_TEXT_LAYER" : "PDF_TEXT_LAYER_REVIEW"
        };
        appendVerificationLog(exactIssuedPdf ? "OK" : "WARN",
          exactIssuedPdf
            ? (en ? "DB comparison continued directly from the byte-exact issued PDF text layer." : "바이트가 일치한 발급 PDF의 텍스트 레이어로 DB 전체 비교를 즉시 계속했습니다.")
            : (en ? "PDF bytes differ; semantic DB comparison continues from the document text. This cannot override the authenticity failure." : "PDF 바이트는 다르지만 문서 텍스트로 DB 내용 비교를 계속합니다. 이 결과는 원본성 실패를 정상으로 바꾸지 않습니다."),
          `pages=${readableDigitalPages.length}`);
      } else {
        recognized = await recognizeReportPhotos(pages, (percent, status) => setOcrProgress({ busy: true, percent, status }));
      }
      appendVerificationLog(usedPdfTextFallback && !exactIssuedPdf ? "WARN" : "OK",
        usedPdfTextFallback
          ? exactIssuedPdf
            ? (en ? "Issued PDF text comparison completed." : "발급 PDF 텍스트 비교를 완료했습니다.")
            : (en ? "Non-original PDF text comparison completed for review." : "원본성 불일치 PDF의 내용 비교를 검토용으로 완료했습니다.")
          : digitalTextPages
            ? (en ? "Visible PDF pixels were OCR-read independently from the text layer." : "PDF 화면 픽셀을 텍스트 레이어와 독립적으로 OCR 판독했습니다.")
            : (en ? "Korean/English OCR completed." : "한글·영문 OCR을 완료했습니다."),
        `pages=${recognized.pageTexts.length}, characters=${recognized.text.length}, engine=${recognized.engine}, engineConfidence=${Math.round(recognized.confidence)}%`);
      const rawVerification = await verifySurveyReportPhoto(recognized.text, qrEvidence || undefined, visualProfile, selectedReportType, recognized.pageTexts, recognized.pages);
      const byteExactCertificateId = (exactPdfVerification?.certificateId || rawVerification.certificateId || qrEvidence?.certificateId || "").trim().toUpperCase();
      const verification: ReportPhotoVerificationResponse = exactPdfVerification?.status === "EXACT_PDF_MATCH"
        ? {
            ...rawVerification,
            photoConsistent: true,
            status: "PHOTO_CONTENT_MATCH",
            certificateId: exactPdfVerification.certificateId,
            datasetExactMatch: true,
            numericDataExactMatch: true,
            chartDataExactMatch: true,
            chartVisualExactMatch: true,
            chartExactMatch: true,
            semanticStatus: "CONTENT_EXACT",
            fieldMismatches: [],
            missingOcrEvidenceTokens: [],
            comparisons: rawVerification.comparisons?.map((candidate) => {
              if (candidate.certificateId.trim().toUpperCase() !== byteExactCertificateId) return candidate;
              const exactFieldComparisons = candidate.fieldComparisons?.map((field) => ({
                ...field,
                rowMatched: true,
                materialMatched: true,
                actualMaterialName: field.materialName || "",
                amountActual: field.amountDisplay || "",
                amountMatched: true,
                emissionFactorActual: field.emissionFactorDisplay || "",
                emissionFactorMatched: true,
                totalEmissionActual: field.totalEmissionDisplay || "",
                totalEmissionMatched: true
              }));
              const exactOutputComparisons = candidate.outputFieldComparisons?.map((field) => ({
                ...field,
                materialActual: field.materialName,
                materialMatched: true,
                processReferenceMassActual: field.processReferenceMassDisplay || "",
                processReferenceMassMatched: true,
                massSharePercentActual: field.massSharePercentDisplay || "",
                massSharePercentMatched: true,
                allocatedEmissionActual: field.allocatedEmissionDisplay || "",
                allocatedEmissionMatched: true,
                emissionPerTonActual: field.emissionPerTonDisplay || "",
                emissionPerTonMatched: true,
                rowMatched: true
              }));
              return {
                ...candidate,
                confidence: 100,
                contentMatch: true,
                certificateIdMatch: true,
                payloadHashMatch: true,
                integrityCodeMatch: true,
                datasetHashMatch: true,
                verificationTagMatch: true,
                datasetExactMatch: true,
                numericDataExactMatch: true,
                chartDataExactMatch: true,
                chartVisualExactMatch: true,
                chartExactMatch: true,
                tagExactMatch: true,
                overallExactMatch: true,
                productMatched: true,
                totalEmissionMatched: true,
                matchedMaterialCount: candidate.materialCount,
                matchedNumberCount: candidate.numberCount,
                detailRowsExactMatch: true,
                matchedComparisonItemCount: candidate.comparisonItemCount,
                fieldMismatches: [],
                fieldComparisons: exactFieldComparisons,
                comparisonDetails: candidate.comparisonDetails?.map((detail) => ({ ...detail, actual: detail.expected, matched: true })),
                reportSummaryComparisons: candidate.reportSummaryComparisons?.map((field) => ({ ...field, actual: field.expected, matched: true })),
                outputFieldComparisons: exactOutputComparisons,
                sectionSummaryComparisons: candidate.sectionSummaryComparisons?.map((section) => ({
                  ...section,
                  actualTotalEmission: section.expectedTotalEmission,
                  actualSharePercent: section.expectedSharePercent,
                  labelMatched: true,
                  totalEmissionMatched: true,
                  sharePercentMatched: true,
                  unexpectedNumbers: [],
                  matched: true
                })),
                unexpectedSectionSummaryNumbers: []
              };
            })
          }
        : rawVerification;
      const orderedEvidenceMismatchCount = verification.ocrEvidencePageComparisons
        ?.filter((page) => !page.tokenSequenceExact).length || 0;
      appendVerificationLog(verification.photoConsistent ? "OK" : "WARN", en ? "Issued-report candidate comparison completed." : "발급 리포트 후보 대조를 완료했습니다.", `certificate=${verification.certificateId || "-"}, candidates=${verification.comparisons?.length || 0}, exact=${verification.comparisons?.filter((item) => item.overallExactMatch).length || 0}, confidence=${verification.confidence}%, visual=${verification.visualSimilarity ?? 0}%, fieldMismatches=${verification.fieldMismatches?.length || 0}, orderedPageMismatches=${orderedEvidenceMismatchCount}`);
      if (rawPdfFile && !exactPdfVerification && verification.certificateId) {
        exactPdfVerification = await verifyExactPdfFile(rawPdfFile, verification.certificateId);
      }
      const exactIssuedSemanticMatch = exactPdfVerification?.status === "EXACT_PDF_MATCH";
      const effectiveVerification = exactIssuedSemanticMatch
        ? {
            ...verification,
            chartVisualExactMatch: true,
            chartExactMatch: true,
            semanticStatus: "CONTENT_EXACT" as const
          }
        : verification;
      setPhotoVerification(effectiveVerification);
      if (rawPdfFile) {
        if (!exactPdfVerification) {
          setResultTone("warning");
          setResultMessage(en
            ? "The PDF certificate ID could not be bound to an issued byte fingerprint. OCR similarity alone cannot prove authenticity."
            : "PDF 인증서 ID를 발급 바이트 지문과 결박하지 못했습니다. OCR 유사도만으로는 진위를 증명할 수 없습니다.");
          return;
        }
        if (exactPdfVerification.status === "INVALID_PDF") {
          applyPdfFileVerdict(exactPdfVerification);
          return;
        }
        const bytesExact = exactPdfVerification.status === "EXACT_PDF_MATCH";
        const semanticExact = effectiveVerification.semanticStatus === "CONTENT_EXACT";
        setResultTone(bytesExact && semanticExact ? "success" : "danger");
        setResultMessage(effectiveVerification.semanticStatus === "DATA_TAMPERED"
          ? (en ? "Data tampering detected: at least one report value differs from the issued dataset." : "데이터 변조를 감지했습니다. 리포트 개별 값 중 하나 이상이 발급 데이터와 다릅니다.")
          : effectiveVerification.semanticStatus === "CHART_TAMPERED"
            ? (en ? "Chart tampering detected: a bar value or rendered bar shape differs from the issued report." : "막대그래프 변조를 감지했습니다. 그래프 숫자 또는 막대 모양이 발급본과 다릅니다.")
            : bytesExact
              ? (en ? "The issued PDF bytes and all registered data and charts match." : "발급 PDF 원본 바이트와 원장 데이터·그래프가 모두 일치합니다.")
              : semanticExact
                ? (en ? "Authenticity failed because PDF bytes differ; semantic DB comparison completed and all visible values match." : "원본성 불일치: PDF 바이트는 다르지만 DB 내용 비교를 완료했고 표시 데이터는 모두 일치합니다.")
                : (en ? "Authenticity failed because PDF bytes differ; semantic DB comparison also found differences." : "원본성 불일치: PDF 바이트가 다르고 DB 내용 비교에서도 불일치가 발견됐습니다."));
        return;
      }
      if (preserveDigitalPayload) {
        setResultTone(verification.photoConsistent ? "success" : "warning");
        setResultMessage(verification.photoConsistent
          ? (en ? `Digital verification and visible OCR cross-check completed (${verification.confidence}%).` : `디지털 진위 확인과 화면 OCR 교차 검증을 완료했습니다(${verification.confidence}%).`)
          : (en ? `Digital data was verified, but visible OCR requires review (${verification.confidence}%).` : `숨김 데이터는 확인됐지만 화면 OCR 결과는 검토가 필요합니다(${verification.confidence}%).`));
      } else {
        setPayload(null);
        setResultTone(verification.photoConsistent ? "success" : "warning");
        setResultMessage(verification.photoConsistent
          ? (en ? `Visible content matches an issued dataset with ${verification.confidence}% confidence.` : `보이는 내용이 발급 데이터셋과 ${verification.confidence}% 신뢰도로 일치합니다.`)
          : verification.status === "PHOTO_REVIEW"
            ? (en ? `Partial match (${verification.confidence}%). Visual review is required.` : `부분 일치(${verification.confidence}%)하여 육안 검토가 필요합니다.`)
            : (en ? `The visible content does not match an issued dataset (${verification.confidence}%).` : `보이는 내용이 발급 데이터셋과 충분히 일치하지 않습니다(${verification.confidence}%).`));
      }
    } catch (error) {
      appendVerificationLog("ERROR", en ? "Photographed report verification failed." : "촬영 리포트 검증에 실패했습니다.", error instanceof Error ? error.message : String(error));
      if (exactPdfVerification && !applyPdfFileVerdict(exactPdfVerification)) {
        return;
      }
      setResultTone("warning");
      setResultMessage(error instanceof Error ? error.message : (en ? "Photo OCR failed." : "사진 OCR 처리에 실패했습니다."));
    } finally {
      setOcrProgress((current) => ({ ...current, busy: false }));
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const file = files[0];
    if (!file) {
      return;
    }
    setVerificationLogs([]);
    appendVerificationLog("INFO", en ? "File selected." : "검증 파일을 선택했습니다.", files.map((item) => `${item.name} (${Math.round(item.size / 1024)} KB)`).join(", "));
    setFileName(files.map((item) => item.name).join(", "));
    setPayload(null);
    setUploadedPayloadFound(false);
    setSelectedDamageRegion(null);
    setSelectedPreviewPage(null);
    setPreviewModalPage(null);
    setPhotoVerification(null);
    setDatasetVerification(null);
    setPdfFileVerification(null);
    if (files.every((item) => item.type.startsWith("image/"))) {
      if (files.length > MAX_REPORT_VERIFICATION_PAGES) {
        setResultTone("warning");
        setResultMessage(en ? "Upload no more than 10 report pages." : "리포트 페이지는 최대 10개까지 업로드할 수 있습니다.");
        return;
      }
      setUploadedPdfSelected(false);
      photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
      setPhotoPreviewUrls(files.map((item) => URL.createObjectURL(item)));
      await evaluatePhotographedPages(files, en ? "uploaded photos" : "업로드 사진");
      return;
    }
    photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPhotoPreviewUrls([]);
    setUploadedPdfSelected(true);
    const buffer = await file.arrayBuffer();
    const extractedText = await extractPdfVerificationText(buffer);
    const modificationDates = await inspectPdfModificationDates(buffer);
    appendVerificationLog("INFO", en ? "PDF embedded text scan completed." : "PDF 내장 텍스트 검색을 완료했습니다.", `characters=${extractedText.length}`);
    const nextPayload = resolveVerificationPayload(extractedText);
    const visibleCertificateId = findCertificateIdFromPdfText(extractedText);
    setUploadedPayloadFound(Boolean(nextPayload));
    if (nextPayload) {
      let exactPdfVerification = await verifyExactPdfFile(file, nextPayload.certificateId);
      if (exactPdfVerification.status !== "EXACT_PDF_MATCH" && modificationDates.modifiedAfterCreation) {
        const metadataTamperVerdict: ReportPdfFileVerificationResponse = {
          valid: false,
          status: "TAMPERED_PDF",
          verificationMode: "PDF_METADATA_DATES",
          certificateId: nextPayload.certificateId,
          uploadedPdfSizeBytes: file.size,
          message: `PDF CreationDate (${modificationDates.creationDate}) and ModDate (${modificationDates.modificationDate}) differ.`
        };
        appendVerificationLog("ERROR", en ? "PDF modification metadata detected." : "PDF 생성·수정 날짜 불일치를 감지했습니다.", metadataTamperVerdict.message);
        applyPdfFileVerdict(metadataTamperVerdict);
        exactPdfVerification = metadataTamperVerdict;
        setOcrProgress({ busy: true, percent: 0, status: en ? "Metadata mismatch recorded; continuing semantic checks" : "수정 이력 기록 후 데이터·그래프 검증 계속" });
      }
      await evaluatePayload(nextPayload, file.name, exactPdfVerification);
      if (exactPdfVerification.status === "TAMPERED_PDF") {
        setOcrProgress({ busy: true, percent: 0, status: en ? "Byte mismatch recorded; continuing semantic checks" : "바이트 불일치 기록 후 데이터·그래프 검증 계속" });
      }
      setOcrProgress({ busy: true, percent: 0, status: en ? "Cross-checking visible PDF data" : "PDF 화면 데이터 교차 검증 중" });
      try {
        const rendered = await renderReportPdfPages(file, (percent, status) => setOcrProgress({ busy: true, percent, status }));
        appendVerificationLog("OK", en ? "PDF pages rendered for text and visual cross-check." : "텍스트·시각 교차 검증용 PDF 페이지 변환을 완료했습니다.", `pages=${rendered.pages.length}, textPages=${rendered.textPages.length}`);
        setPhotoPreviewUrls(rendered.pages.map((page) => URL.createObjectURL(page)));
        await evaluatePhotographedPages(rendered.pages, file.name, true, file, exactPdfVerification, rendered.textPages);
      } catch (error) {
        appendVerificationLog("ERROR", en ? "Visible PDF OCR cross-check failed." : "PDF 화면 OCR 교차 검증에 실패했습니다.", error instanceof Error ? error.message : String(error));
        setOcrProgress((current) => ({ ...current, busy: false }));
        setResultTone("warning");
        setResultMessage(error instanceof Error ? error.message : (en ? "Visible PDF dataset cross-check failed." : "PDF 화면 데이터셋 교차 검증에 실패했습니다."));
      }
      return;
    }
    let initialPdfVerification = visibleCertificateId
      ? await verifyExactPdfFile(file, visibleCertificateId)
      : null;
    if (initialPdfVerification?.status !== "EXACT_PDF_MATCH" && modificationDates.modifiedAfterCreation) {
      const metadataTamperVerdict: ReportPdfFileVerificationResponse = {
        valid: false,
        status: "TAMPERED_PDF",
        verificationMode: "PDF_METADATA_DATES",
        certificateId: visibleCertificateId,
        uploadedPdfSizeBytes: file.size,
        message: `PDF CreationDate (${modificationDates.creationDate}) and ModDate (${modificationDates.modificationDate}) differ.`
      };
      appendVerificationLog("ERROR", en ? "PDF modification metadata detected." : "PDF 생성·수정 날짜 불일치를 감지했습니다.", metadataTamperVerdict.message);
      applyPdfFileVerdict(metadataTamperVerdict);
      initialPdfVerification = metadataTamperVerdict;
      setOcrProgress({ busy: true, percent: 0, status: en ? "Metadata mismatch recorded; continuing semantic checks" : "수정 이력 기록 후 데이터·그래프 검증 계속" });
    }
    if (initialPdfVerification?.status === "TAMPERED_PDF") {
      setOcrProgress({ busy: true, percent: 0, status: en ? "Byte mismatch recorded; continuing semantic checks" : "바이트 불일치 기록 후 데이터·그래프 검증 계속" });
    }
    setOcrProgress({ busy: true, percent: 0, status: en ? "Rendering PDF pages" : "PDF 페이지 변환 중" });
    try {
      const rendered = await renderReportPdfPages(file, (percent, status) => setOcrProgress({ busy: true, percent, status }));
      appendVerificationLog("OK", en ? "PDF pages rendered for text and visual verification." : "텍스트·시각 검증용 PDF 페이지 변환을 완료했습니다.", `pages=${rendered.pages.length}, textPages=${rendered.textPages.length}`);
      setPhotoPreviewUrls(rendered.pages.map((page) => URL.createObjectURL(page)));
      await evaluatePhotographedPages(rendered.pages, file.name, false, file, initialPdfVerification, rendered.textPages);
    } catch (error) {
      setOcrProgress((current) => ({ ...current, busy: false }));
      setResultTone("warning");
      setResultMessage(error instanceof Error ? error.message : (en ? "Scanned PDF OCR failed." : "스캔 PDF OCR 처리에 실패했습니다."));
    }
  };

  const toneClass = resultTone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : resultTone === "danger"
      ? "border-rose-300 bg-rose-50 text-rose-950"
    : resultTone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-sky-200 bg-sky-50 text-sky-950";

  const isCurrentUploadComparisonExact = (item: ReportCandidateComparison) => item.overallExactMatch || (
    pdfFileVerification?.status === "EXACT_PDF_MATCH"
    && photoVerification?.semanticStatus === "CONTENT_EXACT"
    && item.certificateId === photoVerification.certificateId
    && item.datasetExactMatch
    && item.tagExactMatch
  );

  const sectionProps = (code: string) => {
    const section = screenDesign?.sections.find((candidate) => candidate.code === code);
    return {
      "data-certificate-section": code,
      "data-section-design-version": screenDesign?.designVersion || "built-in",
      style: section ? ({ order: section.order, display: section.visible ? undefined : "none" } as React.CSSProperties) : undefined
    };
  };

  const activePreviewPage = Math.min(
    photoPreviewUrls.length || 1,
    Math.max(1, selectedDamageRegion?.page || selectedPreviewPage || 1)
  );

  const verificationContent = (
      <AdminWorkspacePageFrame>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,58fr)_minmax(360px,42fr)]">
          <section data-certificate-section="UPLOAD" data-section-design-version={screenDesign?.designVersion || "built-in"} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <fieldset className="mb-5 border-b border-slate-200 pb-5">
              <legend className="text-sm font-black text-slate-800">{en ? "Report type" : "검증할 리포트 종류"}</legend>
              <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup">
                {([
                  ["EMISSION_SURVEY", en ? "Emission report" : "탄소배출량 리포트", en ? "Emission survey and calculation" : "배출 설문·산정 보고서"],
                  ["LCA_SUMMARY", en ? "Product LCA summary" : "제품 LCA 수행 개요", en ? "Product LCA overview report" : "제품 LCA 요약 보고서"]
                ] as const).map(([value, label, description]) => (
                  <button
                    aria-pressed={selectedReportType === value}
                    className={`min-h-20 border px-4 py-3 text-left transition-colors ${selectedReportType === value ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
                    key={value}
                    onClick={() => {
                      setSelectedReportType(value);
                      setPayload(null);
                      setDatasetVerification(null);
                      setPhotoVerification(null);
                      setFileName("");
                      setPhotoPreviewUrls([]);
                      setVerificationLogs([]);
                      setResultTone("info");
                      setResultMessage(en ? "Upload a report of the selected type." : "선택한 종류의 리포트를 업로드하세요.");
                    }}
                    role="radio"
                    type="button"
                  >
                    <strong className="block text-sm">{label}</strong>
                    <span className="mt-1 block text-xs font-semibold opacity-70">{description}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{en ? "PDF Verification" : "PDF 검증"}</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{en ? "Upload Certificate PDF" : "인증서 PDF 업로드"}</h2>
            </div>
            <label className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center hover:border-emerald-400 hover:bg-emerald-50">
              <span className="text-base font-black text-slate-900">{fileName || (en ? "Choose PDF file" : "PDF 파일 선택")}</span>
              <span className="mt-2 text-sm font-semibold text-slate-500">{en ? "PDF, JPG, PNG, and WebP are supported. Photos are processed locally with Korean and English OCR." : "PDF, JPG, PNG, WebP 지원. 사진은 한글·영문 OCR로 기기 안에서 처리합니다."}</span>
              <input accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="sr-only" multiple onChange={handleFileChange} type="file" />
            </label>
            {photoPreviewUrls.length ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-300 bg-slate-900 shadow-xl" data-certificate-pdf-preview>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950 px-4 py-3 text-white">
                  <div><strong className="text-sm">{en ? "Issued document evidence" : "발급 문서 증거"}</strong><span className="ml-2 text-xs font-bold text-slate-300">P{activePreviewPage} / {photoPreviewUrls.length}</span></div>
                  <div className="flex gap-1 text-[11px] font-black"><span className="rounded-full bg-emerald-500/20 px-2 py-1 text-emerald-200">PDF</span><span className="rounded-full bg-sky-500/20 px-2 py-1 text-sky-200">DB</span><span className="rounded-full bg-violet-500/20 px-2 py-1 text-violet-200">{en ? "VISUAL" : "시각 증거"}</span></div>
                </div>
                <button aria-label={en ? `Enlarge uploaded report page ${activePreviewPage}` : `업로드 리포트 ${activePreviewPage}페이지 크게 보기`} className="relative flex min-h-[520px] w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#334155,#0f172a_70%)] p-4" onClick={() => setPreviewModalPage(activePreviewPage)} type="button">
                  <img alt={`${en ? "Uploaded report page" : "업로드 리포트 페이지"} ${activePreviewPage}`} className="max-h-[72vh] w-full object-contain drop-shadow-2xl" src={photoPreviewUrls[activePreviewPage - 1]} />
                  {selectedDamageRegion?.page === activePreviewPage ? <span aria-hidden className="pointer-events-none absolute border-4 border-rose-500 bg-rose-500/15 shadow-[0_0_0_9999px_rgba(15,23,42,0.12)]" style={{ left: `${Math.max(2, selectedDamageRegion.column * 10)}%`, top: `${Math.max(2, selectedDamageRegion.row * 6)}%`, width: "12%", height: "7%" }} /> : null}
                </button>
                <p className="bg-white px-4 py-2 text-center text-xs font-bold text-slate-600">{en ? `Select a thumbnail to inspect another page; select the large page to enlarge it.` : `썸네일로 페이지를 전환하고 큰 문서를 누르면 확대됩니다.`}</p>
                <div className="grid grid-cols-3 gap-2 bg-slate-100 p-3 sm:grid-cols-5">
                  {photoPreviewUrls.map((url, index) => (
                    <button aria-pressed={activePreviewPage === index + 1} className={`group relative overflow-hidden rounded-xl border-2 bg-white transition ${activePreviewPage === index + 1 ? "border-emerald-500 ring-2 ring-emerald-200" : "border-white hover:border-slate-400"}`} key={url} onClick={() => {
                      setSelectedPreviewPage(index + 1);
                      setSelectedDamageRegion(null);
                    }} type="button">
                      <img alt={`${en ? "Uploaded report thumbnail" : "업로드 리포트 썸네일"} ${index + 1}`} className="aspect-[3/4] w-full object-contain" src={url} />
                      <span className="absolute left-2 top-2 rounded-full bg-slate-950/80 px-2 py-1 text-[11px] font-black text-white">{index + 1}</span>
                      {photoVerification?.damagedRegions?.some((region) => region.page === index + 1) ? <span className="absolute bottom-2 right-2 rounded-full bg-rose-600 px-3 py-1 text-xs font-black text-white shadow-lg">{en ? "Inspect damage" : "훼손 위치 확대"}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl" data-certificate-evidence-placeholder>
                <div className="grid items-center gap-6 md:grid-cols-[minmax(220px,0.85fr)_1.15fr]">
                  <div className="relative mx-auto w-full max-w-[300px]">
                    <div className="absolute -right-3 top-5 h-full w-full rotate-3 rounded-xl border border-white/20 bg-white/10" />
                    <div className="relative aspect-[3/4] rounded-xl bg-white p-5 text-slate-900 shadow-2xl">
                      <div className="flex items-center justify-between"><span className="h-3 w-24 rounded bg-emerald-600" /><span className="text-[10px] font-black text-emerald-700">VERIFIED PDF</span></div>
                      <div className="mt-5 h-3 w-3/4 rounded bg-slate-900" /><div className="mt-2 h-2 w-1/2 rounded bg-slate-300" />
                      <div className="mt-7 flex h-24 items-end gap-2 border-b border-l border-slate-300 px-3 pb-1"><span className="h-10 flex-1 bg-emerald-300" /><span className="h-16 flex-1 bg-emerald-500" /><span className="h-20 flex-1 bg-sky-500" /><span className="h-12 flex-1 bg-violet-400" /></div>
                      <div className="mt-6 space-y-2">{[88, 72, 94, 64].map((width) => <div className="h-2 rounded bg-slate-200" key={width} style={{ width: `${width}%` }} />)}</div>
                      <div className="absolute bottom-5 right-5 grid h-14 w-14 place-items-center rounded-lg border-4 border-slate-900 text-[9px] font-black">QR</div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">{en ? "Visual evidence workspace" : "시각 증거 작업공간"}</p>
                    <h3 className="mt-2 text-2xl font-black leading-tight">{en ? "See the document, not only the verdict." : "판정만 보지 말고 문서를 직접 확인하세요."}</h3>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{en ? "After upload, the original pages, charts, tables, and suspected locations appear here with page thumbnails." : "업로드하면 원본 페이지·그래프·표·의심 위치가 페이지 썸네일과 함께 이 영역에 표시됩니다."}</p>
                    <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-black"><span className="rounded-lg bg-white/10 px-2 py-3">01<br />{en ? "ORIGINAL" : "원본"}</span><span className="rounded-lg bg-white/10 px-2 py-3">02<br />{en ? "COMPARE" : "대조"}</span><span className="rounded-lg bg-emerald-400/20 px-2 py-3 text-emerald-200">03<br />{en ? "EVIDENCE" : "증거"}</span></div>
                  </div>
                </div>
              </div>
            )}
            {ocrProgress.busy ? (
              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
                <div className="flex items-center justify-between text-sm font-black text-sky-900"><span>{en ? "OCR processing" : "OCR 처리 중"}</span><span>{ocrProgress.percent}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100"><div className="h-full bg-sky-600 transition-all" style={{ width: `${ocrProgress.percent}%` }} /></div>
                <p className="mt-2 text-xs font-semibold text-sky-700">{ocrProgress.status}</p>
              </div>
            ) : null}
            {fileName ? (
              <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-bold ${pdfFileVerification?.status === "TAMPERED_PDF" ? "border-rose-300 bg-rose-50 text-rose-950" : pdfFileVerification?.status === "EXACT_PDF_MATCH" || (!uploadedPdfSelected && photoVerification?.photoConsistent) ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                {pdfFileVerification?.status === "TAMPERED_PDF"
                  ? pdfFileVerification.verificationMode === "PDF_METADATA_DATES"
                    ? (en ? "Tampered PDF: CreationDate and ModDate differ." : "변조 파일: PDF 생성일과 수정일이 다릅니다.")
                    : (en ? "Tampered PDF: exact issued-file bytes do not match." : "변조 파일: 발급 원본 PDF 바이트와 일치하지 않습니다.")
                  : pdfFileVerification?.status === "EXACT_PDF_MATCH"
                  ? (en ? "Exact issued-PDF byte match confirmed." : "발급 PDF 원본 바이트가 정확히 일치합니다.")
                  : uploadedPdfSelected && ocrProgress.busy
                  ? (en ? "Verifying PDF bytes, visible text, page order, tables, and charts..." : "PDF 원본 바이트·화면 문자·페이지 순서·표·차트를 검증하고 있습니다.")
                  : uploadedPdfSelected
                  ? (en ? "PDF byte verification has not completed. Select the file again if processing has stopped." : "PDF 원본 바이트 검증이 완료되지 않았습니다. 처리가 멈췄다면 파일을 다시 선택하세요.")
                  : photoVerification
                  ? (en ? `Photo OCR comparison completed (${photoVerification.confidence}%).` : `사진 OCR 데이터셋 대조를 완료했습니다(${photoVerification.confidence}%).`)
                  : uploadedPayloadFound
                  ? (en ? "Verification data was found in the uploaded PDF and verified automatically." : "업로드한 PDF에서 검증 데이터를 찾아 자동으로 확인했습니다.")
                  : (en ? "The uploaded PDF was read, but hidden Carbonet verification data was not found." : "업로드한 PDF는 읽었지만 숨김 Carbonet 검증 정보를 찾지 못했습니다.")}
              </div>
            ) : null}

          </section>

          <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
            <section {...sectionProps("VERDICT")} className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
              <p className="text-xs font-black uppercase tracking-[0.16em] opacity-80">{en ? "Verification Result" : "검증 결과"}</p>
              <h2 className="mt-2 text-xl font-black">
                {resultTone === "success" ? (en ? "Valid" : "정상") : resultTone === "danger" ? (en ? "Tampered PDF" : "변조 파일") : resultTone === "warning" ? (en ? "Needs Review" : "확인 필요") : (en ? "Waiting" : "대기")}
              </h2>
              <p className="mt-2 text-sm font-bold leading-6">{resultMessage}</p>
            </section>

            <section {...sectionProps("IDENTITY")} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{en ? "Three Verification Signals" : "3가지 식별 방식"}</p>
              <div className="mt-4 space-y-3">
                {[
                  [en ? "Certificate ID" : "인증서 ID", payload?.certificateId || photoVerification?.certificateId || "-"],
                  [en ? "SHA-256 Fingerprint" : "SHA-256 리포트 지문", payload?.payloadHash || photoVerification?.payloadHash || "-"],
                  [en ? "Integrity Code" : "무결성 코드", payload?.integrityCode || photoVerification?.integrityCode || "-"]
                ].map(([label, value]) => (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3" key={label}>
                    <p className="text-[11px] font-black text-slate-500">{label}</p>
                    <p className="mt-1 break-all font-mono text-xs font-black text-slate-950">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            {photoVerification ? (
              <section {...sectionProps("VISUAL")} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{en ? "Photo OCR Evidence" : "사진 OCR 대조 근거"}</p>
                <div className="mt-3 flex items-end justify-between"><strong className="text-3xl text-slate-950">{pdfFileVerification?.status === "EXACT_PDF_MATCH" ? (en ? "ORIGINAL" : "원본 일치") : `${photoVerification.confidence}%`}</strong><span className="text-xs font-black text-slate-500">{pdfFileVerification?.status === "EXACT_PDF_MATCH" ? (en ? "BYTE-EXACT EVIDENCE" : "원본 바이트 증거") : (en ? "CONTENT MATCH RATE" : "내용 일치율")}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                  <span className="col-span-2">QR: {photoVerification.qrFullyMatched ? "VERIFIED" : photoVerification.qrDetected ? "MISMATCH" : "NOT FOUND"}</span>
                  <span className="col-span-2">{pdfFileVerification?.status === "EXACT_PDF_MATCH" ? (en ? "OCR score: supplementary only; exact-byte evidence takes precedence" : "OCR 점수: 참고용 · 원본 바이트 판정 우선") : `${en ? "OCR-only confidence" : "OCR 단독 일치도"}: ${photoVerification.contentConfidence ?? photoVerification.confidence}%`}</span>
                  <span className="col-span-2">{en ? "Visual integrity" : "시각 원본 일치"}: {photoVerification.visualProfileAvailable ? `${photoVerification.visualSimilarity ?? 0}% / ${photoVerification.visualStatus}` : "NOT REGISTERED"}</span>
                  <span className="col-span-2">{en ? "Damaged regions" : "훼손 의심 영역"}: {photoVerification.damagedCellCount ?? 0}/{photoVerification.comparedCellCount ?? 0}</span>
                  <span>{en ? "Product" : "제품명"}: {photoVerification.productMatched ? "OK" : "-"}</span>
                  <span>{en ? "Title" : "제목"}: {photoVerification.titleMatched ? "OK" : "-"}</span>
                  {selectedReportType === "LCA_SUMMARY" ? <>
                    <span>{en ? "LCA fields" : "LCA 고유 항목"}: {photoVerification.matchedLcaFieldCount || 0}/{photoVerification.lcaFieldCount || 0}</span>
                    <span>{en ? "Mass balance" : "질량·배출 수치"}: {photoVerification.matchedNumberCount || 0}/{photoVerification.numberCount || 0}</span>
                  </> : <>
                    <span>{en ? "Total" : "총량"}: {photoVerification.totalEmissionMatched ? "OK" : "-"}</span>
                    <span>{en ? "Materials" : "물질명"}: {photoVerification.matchedMaterialCount || 0}/{photoVerification.materialCount || 0}</span>
                    <span className="col-span-2">{en ? "Numeric cells" : "수치 셀"}: {photoVerification.matchedNumberCount || 0}/{photoVerification.numberCount || 0}</span>
                  </>}
                </div>
                {selectedReportType === "LCA_SUMMARY" && photoVerification.lcaFieldComparisons?.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {photoVerification.lcaFieldComparisons.map((field) => (
                      <div className={`border p-3 text-xs ${field.matched ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`} key={field.field}>
                        <strong>{field.label}</strong>
                        <span className="mt-1 block break-words">{field.expected || "-"}</span>
                        <span className="mt-1 block font-black">{field.matched ? "MATCH" : "MISMATCH"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {selectedReportType !== "LCA_SUMMARY" && photoVerification.fieldMismatches?.length ? (
                  <div className="mt-4 border-t border-rose-200 pt-3">
                    <p className="text-xs font-black text-rose-900">{en ? "Unmatched or unreadable dataset fields" : "불일치·판독 실패 데이터"}</p>
                    <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                      {photoVerification.fieldMismatches.slice(0, 30).map((item) => (
                        <div className="border border-rose-200 bg-rose-50 p-3 text-xs" key={`${item.rowIndex}-${item.materialName}`}>
                          <p className="font-black text-rose-950">#{item.rowIndex} {item.sectionLabel || "-"} / {item.materialName || "-"}</p>
                          <div className="mt-2 grid grid-cols-2 gap-1 text-rose-800">
                            {!item.materialMatched ? <span>{en ? "Material name not found" : "물질명 판독 불일치"}</span> : null}
                            {!item.amountMatched ? <span>{en ? "Amount shown" : "화면 사용량"}: {item.amountDisplay || formatNumber(item.amount ?? 0, 2)}</span> : null}
                            {!item.emissionFactorMatched ? <span>{en ? "Emission factor shown" : "화면 배출계수"}: {item.emissionFactorDisplay || formatNumber(item.emissionFactor ?? 0, 2)}</span> : null}
                            {!item.totalEmissionMatched ? <span>{en ? "Emission shown" : "화면 배출량"}: {item.totalEmissionDisplay || formatNumber(item.totalEmission ?? 0, 2)}</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-rose-700">{en ? "These values were not confirmed in OCR. They may be altered, covered, blurred, or misread." : "표시된 값은 OCR에서 확인되지 않았습니다. 변조·가림·흐림 또는 오인식 가능성을 검토해야 합니다."}</p>
                  </div>
                ) : null}
                {photoVerification.damagedRegions?.length ? (
                  <div className="mt-3 border-t border-amber-200 pt-3">
                    <p className="text-xs font-black text-amber-900">{en ? "Suspected visual damage locations" : "시각 훼손 의심 위치"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {[...photoVerification.damagedRegions].sort((left, right) => right.difference - left.difference).slice(0, 16).map((region, index) => (
                        <button className="bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900 hover:bg-rose-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-rose-500" key={`${region.page}-${region.row}-${region.column}-${index}`} onClick={() => setSelectedDamageRegion(region)} title={en ? "Open the page and highlight this location" : "해당 페이지를 확대하고 위치 표시"} type="button">
                          P{region.page} R{region.row} C{region.column} ({region.difference})
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-amber-800">{en ? "Select a location to enlarge the page and display the suspected area." : "위치를 누르면 해당 페이지를 확대하고 의심 영역을 빨간색으로 표시합니다."}</p>
                  </div>
                ) : null}
                <p className="mt-3 text-xs font-semibold leading-5 text-amber-800">{en ? "A photo verifies visible-content consistency, not the hidden digital signature. Use the original PDF for cryptographic authenticity." : "사진은 보이는 내용의 일치도를 검증하며 숨김 디지털 서명 자체를 증명하지는 않습니다. 완전한 진위 확인은 원본 PDF를 사용하세요."}</p>
              </section>
            ) : null}

            <section {...sectionProps("SUMMARY")} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{en ? "Dataset Comparison" : "데이터셋 대조"}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
                <span className={`col-span-2 rounded-lg px-3 py-2 ${pdfFileVerification?.status === "EXACT_PDF_MATCH" ? "bg-emerald-100 text-emerald-900" : pdfFileVerification?.status === "TAMPERED_PDF" ? "bg-rose-100 text-rose-900" : uploadedPdfSelected ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "PDF bytes vs issued original" : "PDF 원본 바이트 ↔ 발급 원장"}: {pdfFileVerification?.status === "EXACT_PDF_MATCH" ? "EXACT" : pdfFileVerification?.status === "TAMPERED_PDF" ? "TAMPERED" : uploadedPdfSelected ? "UNVERIFIABLE" : "-"}
                </span>
                <span className={`rounded-lg px-3 py-2 ${photoVerification || datasetVerification ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "Pre-PDF registry dataset" : "PDF 생성 전 원장 데이터셋"}: {photoVerification || datasetVerification ? "OK" : "-"}
                </span>
                <span className={`rounded-lg px-3 py-2 ${datasetVerification?.datasetPresent ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "PDF embedded dataset" : "PDF 내장 데이터셋"}: {datasetVerification?.datasetPresent ? "OK" : "-"}
                </span>
                <span className={`rounded-lg px-3 py-2 ${datasetVerification?.datasetMatch ? "bg-emerald-50 text-emerald-800" : datasetVerification ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "Embedded vs registry" : "내장 ↔ 원장"}: {datasetVerification?.datasetMatch ? "OK" : datasetVerification ? "FAIL" : "-"}
                </span>
                <span className={`rounded-lg px-3 py-2 ${photoVerification?.photoConsistent || pdfFileVerification?.status === "EXACT_PDF_MATCH" ? "bg-emerald-50 text-emerald-800" : photoVerification ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "Visible OCR vs registry" : "화면 OCR ↔ 원장"}: {pdfFileVerification?.status === "EXACT_PDF_MATCH" ? (en ? "ORIGINAL MATCH" : "원본 일치") : photoVerification ? `${photoVerification.confidence}%` : "-"}
                </span>
                <span className={`rounded-lg px-3 py-2 ${photoVerification?.numericDataExactMatch ? "bg-emerald-100 text-emerald-900" : photoVerification ? "bg-rose-100 text-rose-900" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "Every numeric field" : "개별 숫자 전체"}: {photoVerification?.numericDataExactMatch ? "EXACT" : photoVerification ? "DATA_TAMPERED" : "-"}
                </span>
                <span className={`rounded-lg px-3 py-2 ${photoVerification?.chartExactMatch ? "bg-emerald-100 text-emerald-900" : photoVerification ? "bg-rose-100 text-rose-900" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "Chart values + bar shapes" : "그래프 숫자 + 막대 모양"}: {photoVerification?.chartExactMatch ? "EXACT" : photoVerification ? "CHART_TAMPERED" : "-"}
                </span>
                <span className={`col-span-2 rounded-lg px-3 py-2 ${photoVerification?.qrFullyMatched ? "bg-emerald-100 text-emerald-900" : photoVerification?.qrDetected ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "Photographed QR signature vs registry" : "촬영 QR 서명 ↔ 원장"}: {photoVerification?.qrFullyMatched ? "OK" : photoVerification?.qrDetected ? "FAIL" : "-"}
                </span>
                <span className={`col-span-2 rounded-lg px-3 py-2 ${photoVerification?.tagExactMatch ? "bg-emerald-100 text-emerald-900" : photoVerification ? "bg-rose-100 text-rose-900" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "Certificate ID + SHA-256 fingerprint + integrity code + dataset hash" : "인증서 ID + SHA-256 리포트 지문 + 무결성 코드 + 데이터셋 해시"}: {photoVerification?.tagExactMatch ? "OK" : photoVerification ? "FAIL" : "-"}
                </span>
                {selectedReportType === "EMISSION_SURVEY" ? (
                  <span className={`col-span-2 rounded-lg px-3 py-2 ${pdfFileVerification?.status === "EXACT_PDF_MATCH" || photoVerification?.ocrEvidenceExactMatch ? "bg-emerald-100 text-emerald-900" : photoVerification ? "bg-rose-100 text-rose-900" : "bg-slate-100 text-slate-500"}`}>
                  {pdfFileVerification?.status === "EXACT_PDF_MATCH" ? (en ? "All issued fields verification: ORIGINAL PDF EXACT" : "발급 화면 전체 항목 검증: 원본 PDF 전체 일치") : `${en ? "All issued visible fields vs OCR" : "발급 화면 전체 항목 ↔ OCR"}: ${photoVerification?.ocrEvidenceExactMatch ? `OK (${photoVerification.matchedOcrEvidenceTokenCount || 0}/${photoVerification.ocrEvidenceTokenCount || 0})` : photoVerification?.ocrEvidenceAvailable ? `FAIL (${photoVerification.matchedOcrEvidenceTokenCount || 0}/${photoVerification.ocrEvidenceTokenCount || 0})` : photoVerification ? (en ? "REISSUE REQUIRED" : "재발급 필요") : "-"}`}
                  </span>
                ) : null}
                <span className={`col-span-2 rounded-lg px-3 py-2 ${photoVerification?.semanticStatus === "CONTENT_EXACT" ? "bg-emerald-100 text-emerald-900" : photoVerification ? "bg-rose-100 text-rose-900" : "bg-slate-100 text-slate-600"}`}>
                  {en ? "Semantic verification" : "내용 검증 최종 판정"}: {photoVerification?.semanticStatus || (datasetVerification ? (en ? "OCR REVIEW" : "OCR 검토") : (en ? "EMBEDDED DATA UNAVAILABLE" : "내장 데이터 없음"))}
                </span>
              </div>
              {datasetVerification?.datasetMatch ? <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{en ? "The embedded report dataset matches the issued registry." : "PDF 내장 데이터셋이 발급 원장과 일치합니다."}</p> : null}
              {datasetVerification?.fieldComparisons?.length ? (
                <details className="mt-4 overflow-hidden border border-slate-200 bg-white" open={!datasetVerification.datasetMatch}>
                  <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-black text-slate-900">
                    {en ? "Stored dataset vs uploaded dataset" : "DB 저장값 ↔ 업로드값 상세 비교"} ({datasetVerification.matchedFieldCount || 0}/{datasetVerification.fieldCount || 0})
                  </summary>
                  <div className="max-h-[32rem] overflow-auto border-t border-slate-200">
                    <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 text-slate-700"><tr>
                        <th className="px-3 py-3">{en ? "Field" : "항목"}</th>
                        <th className="px-3 py-3">{en ? "Stored value" : "DB 저장값"}</th>
                        <th className="px-3 py-3">{en ? "Uploaded value" : "업로드값"}</th>
                        <th className="px-3 py-3">{en ? "Result" : "판정"}</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {datasetVerification.fieldComparisons.map((field) => <tr className={field.matched ? "bg-white" : "bg-rose-50"} key={field.path}>
                          <td className="px-3 py-2"><strong>{verificationFieldLabel(field.path, en)}</strong><code className="mt-1 block break-all text-[10px] text-slate-400">{field.path}</code></td>
                          <td className="max-w-72 break-all px-3 py-2 font-semibold text-slate-800">{field.expected || "-"}</td>
                          <td className="max-w-72 break-all px-3 py-2 font-semibold text-slate-800">{field.actual || "-"}</td>
                          <td className={`px-3 py-2 font-black ${field.matched ? "text-emerald-700" : "text-rose-700"}`}>{field.matched ? "MATCH" : "MISMATCH"}</td>
                        </tr>)}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
            </section>

            <section {...sectionProps("PAGE_SEQUENCE")} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{en ? "Issued Record" : "발급 이력"}</p>
              {matchedRecord || photoVerification?.certificateId ? (
                <div className="mt-3 space-y-2 text-sm font-bold text-slate-700">
                  <p>{en ? "Certificate" : "인증서"}: {matchedRecord?.certificateId || photoVerification?.certificateId || "-"}</p>
                  <p>{en ? "Issued at" : "발급일시"}: {(matchedRecord?.issuedAt || photoVerification?.issuedAt) ? new Date(matchedRecord?.issuedAt || photoVerification?.issuedAt || "").toLocaleString() : "-"}</p>
                  <p>{en ? "Product" : "제품"}: {matchedRecord?.productName || photoVerification?.productName || "-"}</p>
                  <p>{en ? "Total emission" : "총 배출량"}: {formatNumber(matchedRecord?.totalEmission ?? photoVerification?.totalEmission ?? 0, 4)} kg CO2e</p>
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                  {en ? "No matching local issued record has been selected yet." : "아직 일치하는 로컬 발급 이력이 선택되지 않았습니다."}
                </p>
              )}
            </section>
          </aside>
        </div>

        {photoVerification ? (
          <section {...sectionProps("DETAILS")} className="mt-5 overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-black text-slate-950">{en ? "All Issued Documents A-Z Comparison" : "전체 발급 문서 A-Z 일괄 대조"}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {en
                    ? `OCR content was compared with ${photoVerification.candidateCount || 0} issued datasets and verification tags.`
                    : `수집한 OCR을 발급 원장의 리포트 ${photoVerification.candidateCount || 0}건과 데이터·검증 태그별로 비교했습니다.`}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-black">
                <span className="bg-emerald-50 px-3 py-2 text-emerald-800">{en ? "Content match" : "내용 일치"}: {photoVerification.comparisons?.filter((item) => item.contentMatch).length || 0}</span>
                <span className="bg-sky-50 px-3 py-2 text-sky-800">{en ? "Tag match" : "태그 일치"}: {photoVerification.comparisons?.filter((item) => item.verificationTagMatch).length || 0}</span>
                <span className="bg-blue-50 px-3 py-2 text-blue-800">{en ? "Dataset exact" : "데이터셋 완전 일치"}: {photoVerification.comparisons?.filter((item) => item.datasetExactMatch).length || 0}</span>
                <span className="bg-violet-50 px-3 py-2 text-violet-800">{en ? "Tag exact" : "태그 완전 일치"}: {photoVerification.comparisons?.filter((item) => item.tagExactMatch).length || 0}</span>
                <span className="bg-slate-950 px-3 py-2 text-white">{en ? "Final exact" : "최종 완전 일치"}: {photoVerification.comparisons?.filter(isCurrentUploadComparisonExact).length || 0}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full border-collapse text-left text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-black">{en ? "Issued report" : "발급 리포트"}</th>
                    <th className="px-4 py-3 font-black">{en ? "Match rate" : "내용 일치율"}</th>
                    <th className="px-4 py-3 font-black">{en ? "Dataset fields" : "데이터 항목"}</th>
                    <th className="px-4 py-3 font-black">{en ? "Certificate ID" : "인증서 ID"}</th>
                    <th className="px-4 py-3 font-black">{en ? "Payload hash" : "리포트 해시"}</th>
                    <th className="px-4 py-3 font-black">{en ? "Integrity" : "무결성 코드"}</th>
                    <th className="px-4 py-3 font-black">{en ? "Dataset hash" : "데이터셋 해시"}</th>
                    <th className="px-4 py-3 font-black">{en ? "Result" : "판정"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(photoVerification.comparisons || []).map((item, comparisonIndex) => (
                    <tr className={item.contentMatch ? "bg-emerald-50/30" : "bg-white"} key={item.certificateId}>
                      <td className="px-4 py-3 align-top">
                        <span className="mb-2 inline-flex h-7 min-w-7 items-center justify-center bg-slate-900 px-2 font-black text-white">{reportComparisonLabel(comparisonIndex)}</span>
                        <p className="font-black text-slate-950">{item.productName || "-"}</p>
                        <p className="mt-1 text-slate-600">{item.reportTitle || "-"}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{item.issuedAt ? new Date(item.issuedAt).toLocaleString() : "-"}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <strong className={item.contentMatch ? "text-emerald-700" : item.confidence >= 55 ? "text-amber-700" : "text-rose-700"}>{isCurrentUploadComparisonExact(item) && pdfFileVerification?.status === "EXACT_PDF_MATCH" ? (en ? "ORIGINAL" : "원본 일치") : `${item.confidence}%`}</strong>
                        <p className="mt-1 text-slate-500">{item.contentMatch ? (en ? "MATCH" : "일치") : item.confidence >= 55 ? (en ? "REVIEW" : "검토") : (en ? "MISMATCH" : "불일치")}</p>
                      </td>
                      <td className="px-4 py-3 align-top leading-5 text-slate-700" colSpan={6}>
                        <p className={`mb-2 font-black ${item.datasetExactMatch ? "text-emerald-700" : "text-rose-700"}`}>{en ? "Dataset" : "데이터셋"}: {item.datasetExactMatch ? "EXACT" : "MISMATCH"}</p>
                        <p>{en ? "Product" : "제품"}: {item.productMatched ? "OK" : "-"}</p>
                        {selectedReportType === "LCA_SUMMARY" ? <p>{en ? "Title" : "제목"}: {item.titleMatched ? "OK" : "-"}</p> : null}
                        {selectedReportType === "LCA_SUMMARY" ? <>
                          <p>{en ? "LCA fields" : "LCA 고유 항목"}: {item.matchedLcaFieldCount || 0}/{item.lcaFieldCount || 0}</p>
                          <p>{en ? "Mass / emission values" : "질량·배출 수치"}: {item.matchedNumberCount}/{item.numberCount}</p>
                        </> : <>
                          <p>{en ? "Total" : "총량"}: {item.totalEmissionMatched ? "OK" : "-"}</p>
                          <p>{en ? "Materials" : "물질"}: {item.matchedMaterialCount}/{item.materialCount}</p>
                          <p>{en ? "Numbers" : "수치"}: {item.matchedNumberCount}/{item.numberCount}</p>
                          <p>{en ? "All visible fields including charts" : "차트 포함 전체 표시 항목"}: {item.matchedComparisonItemCount ?? 0}/{item.comparisonItemCount ?? 0}</p>
                        </>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`px-2 py-1 font-black ${item.tagExactMatch ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{en ? "Verification tags" : "검증 태그"}: {item.tagExactMatch ? "EXACT" : "MISMATCH"}</span>
                          <span className={`px-2 py-1 font-black ${isCurrentUploadComparisonExact(item) ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{en ? "Final result" : "최종 판정"}: {isCurrentUploadComparisonExact(item) ? (en ? "EXACT MATCH" : "일치") : (en ? "MISMATCH" : "불일치")}</span>
                        </div>
                        <details className="mt-3 min-w-72 border border-slate-200 bg-white">
                          <summary className="cursor-pointer select-none px-3 py-2 font-black text-slate-800 hover:bg-slate-50">
                            {en ? "Show detailed comparison" : "상세 일치·불일치 내역"}
                          </summary>
                          <div className="flex flex-col border-t border-slate-200 p-3">
                            {item.comparisonDetails?.some((detail) => detail.category !== "CHART") && (selectedReportType === "LCA_SUMMARY" || !item.fieldComparisons?.length) ? <div className="order-3 mt-4 border border-slate-300 bg-slate-50 p-3">
                              <p className="font-black text-slate-950">
                                {en ? "Page 4 · Detailed table comparison" : "4페이지 · 상세표 일치·불일치"}
                              </p>
                              <div className="mt-2 max-h-[32rem] overflow-auto border border-slate-200 bg-white">
                                <table className="w-full min-w-[840px] border-collapse text-left text-[11px]">
                                  <thead className="sticky top-0 bg-slate-100 text-slate-700"><tr>
                                    <th className="px-3 py-2">{en ? "Type" : "종류"}</th><th className="px-3 py-2">{en ? "Group" : "행·차트 항목"}</th>
                                    <th className="px-3 py-2">{en ? "Field" : "필드"}</th><th className="px-3 py-2">{en ? "Expected" : "예상값"}</th>
                                    <th className="px-3 py-2">{en ? "Actual" : "실제값"}</th><th className="px-3 py-2">{en ? "Result" : "판정"}</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {item.comparisonDetails.filter((detail) => detail.category !== "CHART").map((detail, detailIndex) => <tr className={detail.matched ? "bg-white" : "bg-rose-50"} key={`${item.certificateId}-${detail.category}-${detail.group}-${detail.field}-${detailIndex}`}>
                                      <td className="px-3 py-2 font-black">{en ? "DETAIL" : "상세표"}</td>
                                      <td className="px-3 py-2 font-semibold">{detail.group}</td><td className="px-3 py-2 font-bold">{detail.field}</td>
                                      <td className="px-3 py-2 font-semibold">{detail.expected || "-"}</td><td className="px-3 py-2 font-semibold">{detail.actual || (en ? "MISSING" : "누락")}</td>
                                      <td className={`px-3 py-2 font-black ${detail.matched ? "text-emerald-700" : "text-rose-700"}`}>{detail.matched ? "MATCH" : "MISMATCH"}</td>
                                    </tr>)}
                                  </tbody>
                                </table>
                              </div>
                            </div> : null}
                            <div className="order-5 mt-4 overflow-auto border border-slate-200">
                              <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 font-black text-slate-900">{en ? "Page 5 · Digital verification identifiers" : "5페이지 · 디지털 검증 식별 정보"}</p>
                              <table className="w-full min-w-[720px] border-collapse text-left text-[11px]">
                                <thead className="bg-slate-100 text-slate-700"><tr>
                                  <th className="px-3 py-2">{en ? "Field" : "항목"}</th><th className="px-3 py-2">{en ? "Stored value" : "DB 저장값"}</th>
                                  <th className="px-3 py-2">{en ? "Uploaded PDF value" : "업로드 PDF값"}</th><th className="px-3 py-2">{en ? "Result" : "판정"}</th>
                                </tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                  {([
                                    [en ? "Product" : "제품명", item.productName || "-", item.productNameActual || "", item.productMatched],
                                    ...(selectedReportType === "LCA_SUMMARY" ? [[en ? "Title" : "제목", item.reportTitle || "-", item.reportTitleActual || "", item.titleMatched] as [string, string, string, boolean]] : []),
                                    [en ? "Total emission" : "총 배출량", String(item.totalEmission ?? "-"), item.totalEmissionActual || "", item.totalEmissionMatched],
                                    [en ? "Certificate ID" : "인증서 ID", item.certificateId || "-", item.certificateIdActual || "", item.certificateIdMatch],
                                    [en ? "Report hash" : "리포트 해시", item.payloadHash || "-", item.payloadHashActual || "", item.payloadHashMatch],
                                    [en ? "Integrity code" : "무결성 코드", item.integrityCode || "-", item.integrityCodeActual || "", item.integrityCodeMatch],
                                    [en ? "Dataset hash" : "데이터셋 해시", item.datasetHash || "-", item.datasetHashActual || "", item.datasetHashMatch]
                                  ] as Array<[string, string, string, boolean]>).map(([label, storedValue, actualValue, matched]) => <tr className={matched ? "bg-white" : "bg-rose-50"} key={label}>
                                    <td className="px-3 py-2 font-bold">{label}</td><td className="max-w-64 break-all px-3 py-2 font-semibold">{storedValue}</td>
                                    <td className="max-w-64 break-all px-3 py-2 font-semibold">{actualValue || (en ? "Not confirmed in uploaded PDF" : "업로드 PDF에서 확인되지 않음")}</td>
                                    <td className={`px-3 py-2 font-black ${matched ? "text-emerald-700" : "text-rose-700"}`}>{matched ? "MATCH" : "MISMATCH"}</td>
                                  </tr>)}
                                </tbody>
                              </table>
                            </div>
                            {selectedReportType !== "LCA_SUMMARY" && item.reportSummaryComparisons?.length ? <div className="order-1 border-t border-slate-200 pt-3">
                              <p className="font-black text-slate-900">{en ? "Page 1 · Report totals and GWP" : "1페이지 · 레포트 총계·GWP 대조"}</p>
                              <div className="mt-2 overflow-auto border border-slate-200"><table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
                                <thead className="bg-slate-100 text-slate-700"><tr><th className="px-3 py-2">{en ? "Field" : "항목"}</th><th className="px-3 py-2">{en ? "Stored value" : "DB 저장값"}</th><th className="px-3 py-2">{en ? "Uploaded PDF value" : "업로드 PDF값"}</th><th className="px-3 py-2">{en ? "Result" : "판정"}</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">{item.reportSummaryComparisons.map((field) => <tr className={field.matched ? "bg-white" : "bg-rose-50"} key={`${item.certificateId}-summary-${field.field}`}><td className="px-3 py-2 font-bold">{field.label}</td><td className="px-3 py-2 font-semibold">{field.expected || "-"}</td><td className="px-3 py-2 font-semibold">{field.actual || (en ? "Not confirmed in uploaded PDF" : "업로드 PDF에서 확인되지 않음")}</td><td className={`px-3 py-2 font-black ${field.matched ? "text-emerald-700" : "text-rose-700"}`}>{field.matched ? "MATCH" : "MISMATCH"}</td></tr>)}</tbody>
                              </table></div>
                            </div> : null}
                            {selectedReportType === "EMISSION_SURVEY" && item.sectionSummaryComparisons?.length ? (
                              <div className="order-2 mt-4 border-t border-slate-200 pt-3">
                                {[2, 3].map((pageNumber) => {
                                  const pageSections = item.sectionSummaryComparisons?.filter((section) => section.pageNumber === pageNumber) || [];
                                  const pageDataSections = pageSections.filter((section) => section.sectionCode !== "__UNEXPECTED__");
                                  if (!pageSections.length) return null;
                                  return <div className="mb-4 last:mb-0" data-certificate-chart-page={pageNumber} key={`${item.certificateId}-chart-page-${pageNumber}`}>
                                  <p className="font-black text-slate-900">{pageNumber === 2 ? (en ? "Page 2 · Bar chart data comparison" : "2페이지 · 막대그래프 데이터 대조") : (en ? "Page 3 · Pie chart data comparison" : "3페이지 · 원그래프 데이터 대조")}</p>
                                  <div className="mt-2 max-h-96 overflow-auto border border-slate-200">
                                  <table className="w-full min-w-[760px] border-collapse text-left text-[11px]">
                                    <thead className="sticky top-0 bg-slate-100 text-slate-700">
                                      <tr>
                                        <th className="px-3 py-2">{en ? "Page" : "페이지"}</th>
                                        <th className="px-3 py-2">{en ? "Order" : "순서"}</th>
                                        <th className="px-3 py-2">{en ? "Section" : "섹션"}</th>
                                        <th className="px-3 py-2">{en ? "Field" : "항목"}</th>
                                        <th className="px-3 py-2">{en ? "Stored value" : "DB 저장값"}</th>
                                        <th className="px-3 py-2">{en ? "Uploaded PDF value" : "업로드 PDF값"}</th>
                                        <th className="px-3 py-2">{en ? "Result" : "판정"}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {pageDataSections.flatMap((section, sectionIndex) => ([
                                        [en ? "Emission" : "배출량", section.expectedTotalEmission, section.actualTotalEmission, section.totalEmissionMatched],
                                        [en ? "Share" : "비율", `${section.expectedSharePercent}%`, section.actualSharePercent !== null && section.actualSharePercent !== undefined && section.actualSharePercent !== "" ? `${section.actualSharePercent}%` : "", section.sharePercentMatched],
                                      ] as Array<[string, string, string, boolean]>).map(([label, storedValue, uploadedValue, matched], fieldIndex) => (
                                        <tr className={matched ? "bg-white" : "bg-rose-50 text-rose-900"} key={`${item.certificateId}-graph-${section.sectionCode}-${fieldIndex}`}>
                                          <td className="px-3 py-2 font-black">{section.pageNumber || "-"}</td>
                                          <td className="px-3 py-2 font-black">{sectionIndex + 1}</td>
                                          <td className="px-3 py-2 font-black">{section.sectionLabel}</td>
                                          <td className="px-3 py-2">{label}</td>
                                          <td className="px-3 py-2">{storedValue}</td>
                                          <td className="px-3 py-2">{uploadedValue || (en ? "MISSING" : "누락")}</td>
                                          <td className={`px-3 py-2 font-black ${matched ? "text-emerald-700" : "text-rose-700"}`}>{matched ? "MATCH" : "MISMATCH"}</td>
                                        </tr>
                                      )))}
                                      {pageSections.flatMap((section) => section.unexpectedNumbers.map((number, unexpectedIndex) => (
                                        <tr className="bg-rose-50 text-rose-900" key={`${item.certificateId}-${pageNumber}-${section.sectionCode}-unexpected-${unexpectedIndex}`}>
                                          <td className="px-3 py-2 font-black">{pageNumber}</td>
                                          <td className="px-3 py-2 font-black">-</td>
                                          <td className="px-3 py-2 font-black">{en ? "Whole graph" : "그래프 전체"}</td>
                                          <td className="px-3 py-2 font-black">{en ? "Unexpected graph value" : "예상하지 않은 그래프 값"}</td>
                                          <td className="px-3 py-2">-</td><td className="px-3 py-2 font-black">{number}</td>
                                          <td className="px-3 py-2 font-black">MISMATCH</td>
                                        </tr>
                                      )))}
                                    </tbody>
                                  </table>
                                </div>
                                </div>;
                                })}
                              </div>
                            ) : null}
                            {selectedReportType !== "LCA_SUMMARY" && item.outputFieldComparisons?.length ? <div className="order-1 mt-4 border-t border-slate-200 pt-3">
                              <p className="font-black text-slate-900">{en ? "Page 1 · Product and byproduct mass and emissions" : "1페이지 · 제품·부산물 질량 및 배출량 대조"}</p>
                              <div className="mt-2 max-h-96 overflow-auto border border-slate-200"><table className="w-full min-w-[760px] border-collapse text-left text-[11px]">
                                <thead className="sticky top-0 bg-slate-100 text-slate-700"><tr><th className="px-3 py-2">{en ? "Output" : "산출물"}</th><th className="px-3 py-2">{en ? "Field" : "항목"}</th><th className="px-3 py-2">{en ? "Stored value" : "DB 저장값"}</th><th className="px-3 py-2">{en ? "Uploaded PDF value" : "업로드 PDF값"}</th><th className="px-3 py-2">{en ? "Result" : "판정"}</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">{item.outputFieldComparisons.flatMap((field) => ([
                                  [en ? "Name" : "물질명", field.materialName || "-", field.materialActual || "", field.materialMatched],
                                  [en ? "Process standard mass" : "공정 기준 질량", field.processReferenceMassDisplay || "-", field.processReferenceMassActual || "", field.processReferenceMassMatched],
                                  [en ? "Mass share" : "질량 비율", `${field.massSharePercentDisplay || "-"}%`, field.massSharePercentActual ? `${field.massSharePercentActual}%` : "", field.massSharePercentMatched],
                                  [en ? "Allocated emission" : "질량 비율 배출량", field.allocatedEmissionDisplay || "-", field.allocatedEmissionActual || "", field.allocatedEmissionMatched],
                                  [en ? "Emission per ton" : "배출량(1톤 기준)", field.emissionPerTonDisplay || "-", field.emissionPerTonActual || "", field.emissionPerTonMatched]
                                ] as Array<[string, string, string, boolean]>).map(([label, storedValue, actualValue, matched], valueIndex) => <tr className={matched ? "bg-white" : "bg-rose-50"} key={`${item.certificateId}-output-${field.rowIndex}-${valueIndex}`}><td className="px-3 py-2 font-black">{field.outputType === "BYPRODUCT" ? (en ? "Byproduct" : "부산물") : (en ? "Product" : "제품")}<span className="block font-semibold text-slate-500">{field.materialName || "-"}</span></td><td className="px-3 py-2 font-bold">{label}</td><td className="px-3 py-2 font-semibold">{storedValue}</td><td className="px-3 py-2 font-semibold">{actualValue || (en ? "Not confirmed in uploaded PDF" : "업로드 PDF에서 확인되지 않음")}</td><td className={`px-3 py-2 font-black ${matched ? "text-emerald-700" : "text-rose-700"}`}>{matched ? "MATCH" : "MISMATCH"}</td></tr>))}</tbody>
                              </table></div>
                            </div> : null}
                            {selectedReportType === "LCA_SUMMARY" && item.lcaFieldComparisons?.length ? (
                              <div className="order-3 mt-3 space-y-4">
                                <div>
                                  <p className="font-black text-emerald-800">{en ? "Matched LCA fields" : "LCA 일치 내역"} ({item.lcaFieldComparisons.filter((field) => field.matched).length})</p>
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    {item.lcaFieldComparisons.filter((field) => field.matched).map((field) => (
                                      <span className="bg-emerald-50 px-2 py-1 font-bold text-emerald-800" key={`matched-${field.field}`}>
                                        {field.label}: {field.expected || "-"} ↔ {field.actual || (en ? "MISSING" : "누락")}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="border-t border-slate-200 pt-3">
                                  <p className="font-black text-rose-800">{en ? "Mismatched LCA fields" : "LCA 불일치 내역"} ({item.lcaFieldComparisons.filter((field) => !field.matched).length})</p>
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    {item.lcaFieldComparisons.filter((field) => !field.matched).map((field) => (
                                      <span className="bg-rose-50 px-2 py-1 font-bold text-rose-800" key={`mismatched-${field.field}`}>
                                        {field.label}: {field.expected || "-"} ↔ {field.actual || (en ? "MISSING" : "누락")}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : selectedReportType === "LCA_SUMMARY" ? (
                              <p className="order-3 mt-3 border border-amber-200 bg-amber-50 p-3 font-bold text-amber-900">
                                {en ? "This issued PDF does not contain the LCA-specific dataset. Download it again from the LCA report page." : "이 발급 PDF에는 LCA 전용 데이터셋이 없습니다. LCA 보고서 화면에서 새로 다운로드하세요."}
                              </p>
                            ) : null}
                            {selectedReportType !== "LCA_SUMMARY" && item.fieldComparisons?.length ? <div className="order-4 mt-4 border-t border-slate-200 pt-3">
                              <p className="font-black text-slate-900">{en ? "Page 4 · Detailed calculation results table" : "4페이지 · 상세 계산 결과표"} ({item.fieldComparisons.filter((field) => field.rowMatched).length}/{item.fieldComparisons.length} {en ? "rows matched" : "행 일치"})</p>
                              <div className="mt-2 max-h-96 overflow-auto border border-slate-200">
                                <table className="w-full min-w-[760px] border-collapse text-left text-[11px]">
                                  <thead className="sticky top-0 bg-slate-100 text-slate-700"><tr>
                                    <th className="px-3 py-2">{en ? "Row / material" : "행·물질"}</th><th className="px-3 py-2">{en ? "Field" : "항목"}</th>
                                    <th className="px-3 py-2">{en ? "Stored value" : "DB 저장값"}</th><th className="px-3 py-2">{en ? "Uploaded document value" : "업로드 문서값"}</th><th className="px-3 py-2">{en ? "Result" : "판정"}</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {item.fieldComparisons.flatMap((field) => ([
                                      [en ? "Material" : "물질명", field.materialName || "-", field.actualMaterialName || "", field.materialMatched],
                                      [en ? "Amount" : "사용량", field.amountDisplay || "-", field.amountActual || "", field.amountMatched],
                                      [en ? "Factor" : "배출계수", field.emissionFactorDisplay || "-", field.emissionFactorActual || "", field.emissionFactorMatched],
                                      [en ? "Emission" : "배출량", field.totalEmissionDisplay || "-", field.totalEmissionActual || "", field.totalEmissionMatched]
                                    ] as Array<[string, string, string, boolean]>).map(([label, storedValue, actualValue, matched], valueIndex) => <tr className={matched ? "bg-white" : "bg-rose-50"} key={`${item.certificateId}-${field.rowIndex}-${valueIndex}`}>
                                      <td className="px-3 py-2"><strong>#{field.rowIndex} {field.materialName || "-"}</strong><span className="block text-slate-400">{field.sectionLabel || "-"}</span></td>
                                      <td className="px-3 py-2 font-bold">{label}</td><td className="px-3 py-2 font-semibold">{storedValue}</td>
                                      <td className="px-3 py-2 font-semibold">{actualValue || (en ? "Not confirmed in uploaded document" : "업로드 문서에서 확인되지 않음")}</td>
                                      <td className={`px-3 py-2 font-black ${matched ? "text-emerald-700" : "text-rose-700"}`}>{matched ? "MATCH" : "MISMATCH"}</td>
                                    </tr>))}
                                  </tbody>
                                </table>
                              </div>
                              <p className="mt-2 text-[11px] font-semibold text-slate-500">{en ? "Digital PDFs use their embedded text layer; scanned images use OCR. Missing values remain explicitly unconfirmed instead of being invented." : "디지털 PDF는 내장 텍스트를 우선 사용하고 스캔 이미지만 OCR을 사용합니다. 누락값은 임의로 만들지 않고 ‘업로드 문서에서 확인되지 않음’으로 표시합니다."}</p>
                            </div> : null}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        <section {...sectionProps("LOG")} className="mt-5 overflow-hidden border border-slate-300 bg-slate-950 text-slate-100 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
            <div>
              <h2 className="text-sm font-black">{en ? "Verification Processing Log" : "검증 처리 로그"}</h2>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">{en ? "Client processing and registry comparison events for the current upload" : "현재 업로드 파일의 브라우저 처리 및 원장 대조 이력"}</p>
            </div>
            <button aria-label={en ? "Clear log" : "로그 지우기"} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => setVerificationLogs([])} title={en ? "Clear log" : "로그 지우기"} type="button">
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto p-4 font-mono text-xs">
            {verificationLogs.length ? verificationLogs.map((entry) => (
              <div className="grid grid-cols-[76px_52px_minmax(0,1fr)] gap-3 border-b border-slate-800 py-2 last:border-0" key={entry.id}>
                <span className="text-slate-500">{entry.at}</span>
                <span className={entry.level === "OK" ? "text-emerald-400" : entry.level === "WARN" ? "text-amber-400" : entry.level === "ERROR" ? "text-rose-400" : "text-sky-400"}>{entry.level}</span>
                <span className="break-words"><strong className="text-slate-100">{entry.message}</strong>{entry.detail ? <span className="mt-1 block text-slate-400">{entry.detail}</span> : null}</span>
              </div>
            )) : <p className="py-4 text-center text-slate-500">{en ? "Select a PDF or image to begin logging." : "PDF 또는 이미지를 선택하면 처리 로그가 기록됩니다."}</p>}
          </div>
        </section>
        {(previewModalPage || selectedDamageRegion?.page) && photoPreviewUrls[(previewModalPage || selectedDamageRegion?.page || 1) - 1] ? (
          <div aria-label={en ? "Uploaded PDF enlarged preview" : "업로드 PDF 확대 미리보기"} aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4" onClick={() => { setPreviewModalPage(null); setSelectedDamageRegion(null); }} role="dialog">
            <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <div><strong className="text-slate-950">{en ? "Uploaded PDF preview" : "업로드 PDF 미리보기"}</strong><p className="text-xs font-semibold text-slate-500">P{previewModalPage || selectedDamageRegion?.page}{selectedDamageRegion ? ` R${selectedDamageRegion.row} C${selectedDamageRegion.column}` : ""}{selectedDamageRegion ? (en ? " · rendered pixels differ from the issued original" : " · 발급 원본과 화면 픽셀이 다른 위치입니다") : ""}</p></div>
                <button aria-label={en ? "Close" : "닫기"} className="rounded-full bg-slate-100 px-4 py-2 font-black text-slate-700 hover:bg-slate-200" onClick={() => { setPreviewModalPage(null); setSelectedDamageRegion(null); }} type="button">{en ? "Close" : "닫기"}</button>
              </div>
              <div className="overflow-auto bg-slate-200 p-4">
                <div className="relative mx-auto w-fit max-w-full">
                  <img alt={`${en ? "Enlarged uploaded report page" : "업로드 리포트 확대 페이지"} ${previewModalPage || selectedDamageRegion?.page}`} className="max-h-[82vh] max-w-full bg-white object-contain shadow-xl" src={photoPreviewUrls[(previewModalPage || selectedDamageRegion?.page || 1) - 1]} />
                  {selectedDamageRegion ? <span className="pointer-events-none absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-md border-4 border-rose-600 bg-rose-500/20 shadow-[0_0_0_4px_rgba(255,255,255,0.9)]" style={{ left: `${((selectedDamageRegion.column - 0.5) / 48) * 100}%`, top: `${((selectedDamageRegion.row - 0.5) / 68) * 100}%` }} /> : null}
                </div>
                {selectedDamageRegion ? (
                  <div className="sticky bottom-4 mx-auto mt-4 w-full max-w-xl overflow-hidden rounded-2xl border-4 border-rose-600 bg-white shadow-2xl" data-certificate-damage-magnifier>
                    <div className="flex items-center justify-between bg-rose-600 px-4 py-2 text-xs font-black text-white">
                      <span>{en ? "VISIBLE ALTERATION — MAGNIFIED" : "화면 변조 의심 위치 · 확대"}</span>
                      <span>P{selectedDamageRegion.page} R{selectedDamageRegion.row} C{selectedDamageRegion.column} · Δ{selectedDamageRegion.difference}</span>
                    </div>
                    <div className="relative h-48 overflow-hidden bg-slate-100 bg-no-repeat" style={{
                      backgroundImage: `url(${photoPreviewUrls[selectedDamageRegion.page - 1]})`,
                      backgroundPosition: `${((((selectedDamageRegion.column - 0.5) / 48) * 6 - 0.5) / 5) * 100}% ${((((selectedDamageRegion.row - 0.5) / 68) * 8.5 - 0.5) / 7.5) * 100}%`,
                      backgroundSize: "600% 850%"
                    }}>
                      <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 border-4 border-rose-600 bg-rose-500/10 shadow-[0_0_0_3px_rgba(255,255,255,0.95)]" />
                    </div>
                    <p className="px-4 py-3 text-xs font-bold leading-5 text-rose-900">{en ? "The PDF text layer may still contain the issued text. This panel magnifies the rendered pixels that the customer actually sees." : "PDF 숨은 텍스트에는 발급 원문이 남아 있을 수 있습니다. 이 확대 영역은 고객이 실제로 보는 화면 픽셀 변조를 표시합니다."}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </AdminWorkspacePageFrame>
  );
  if (embedded) {
    return verificationContent;
  }
  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Emissions / Survey" : "배출/설문" },
        { label: en ? "Report Authenticity" : "리포트 진위확인" }
      ]}
      title={en ? "Emission Survey Report Authenticity" : "배출 설문 리포트 진위확인"}
      subtitle={en ? "Upload a downloaded report and compare its certificate tags and complete dataset with the issued registry." : "다운로드한 리포트를 업로드하여 인증 태그와 전체 데이터셋을 발급 원장과 비교합니다."}
    >
      {verificationContent}
    </AdminPageShell>
  );
}

export function EmissionSurveyLcaSummaryPrintPage() {
  const routeEn = isEnglish();
  const en = routeEn;
  const report = loadEmissionSurveyReportSession();
  const lcaArticleRef = useRef<HTMLElement | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [productFamily, setProductFamily] = useState("");
  const [functionalUnit, setFunctionalUnit] = useState("");
  const [productModel, setProductModel] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productType, setProductType] = useState("");
  const [equipmentWeight, setEquipmentWeight] = useState("");
  const [bucketCapacity, setBucketCapacity] = useState("");
  const [referenceFlow, setReferenceFlow] = useState("");
  const [dataPeriod] = useState("");
  const [regionScope] = useState("");
  const [verificationRecord, setVerificationRecord] = useState<ReportVerificationRecord | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [missingRequiredLabels, setMissingRequiredLabels] = useState<string[]>([]);
  const [pdfDownloadMode, setPdfDownloadMode] = useState(false);
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
  const lcaDocumentTitle = buildLcaSummaryDocumentTitle(companyName, en);
  const handleDownloadDocument = async () => {
    const missing = validateReportRequiredFields([
      { key: "companyName", label: en ? "Company name" : "기업명", value: companyName, elementId: "lca-company-name" },
      { key: "productFamily", label: en ? "Product category" : "제품 구분", value: productFamily, elementId: "lca-product-family" },
      { key: "functionalUnit", label: en ? "Functional unit" : "기능단위", value: functionalUnit, elementId: "lca-functional-unit" },
      { key: "productModel", label: en ? "Product name" : "제품명", value: productModel, elementId: "lca-product-model" },
      { key: "productDescription", label: en ? "Product description" : "제품 일반 정보", value: productDescription, elementId: "lca-product-description" },
      { key: "productType", label: en ? "Model name" : "모델명", value: productType, elementId: "lca-product-type" },
      { key: "referenceFlow", label: en ? "Reference flow" : "기준흐름", value: referenceFlow, elementId: "lca-reference-flow" },
      { key: "inputRows", label: en ? "LCI input rows" : "LCI 투입물 행", value: inputRows.length > 0 },
      { key: "outputRows", label: en ? "Product / byproduct rows" : "제품·부산물 행", value: outputRows.length > 0 },
      { key: "normalizedOutputMass", label: en ? "Normalized output mass" : "정규화 산출물 질량", value: normalizedOutputMass, valid: (value) => Number(value) > 0 }
    ]);
    setMissingRequiredLabels(missing.map((field) => field.label));
    if (missing.length > 0) return;
    setDownloadBusy(true);
    setDownloadMessage("");
    try {
      const record = await buildReportVerificationRecord(report, {
        reportType: "LCA_SUMMARY",
        reportTitle: lcaDocumentTitle,
        datasetExtension: {
          lcaSummary: {
            schemaVersion: 2,
            capturedAt: new Date().toISOString(),
            documentTitle: lcaDocumentTitle,
            companyName,
            productFamily,
            functionalUnit,
            productModel,
            productDescription,
            productType,
            equipmentWeight,
            bucketCapacity,
            referenceFlow,
            dataPeriod,
            regionScope,
            lcaSoftware,
            preManufacturingMass,
            postManufacturingMass,
            normalizedOutputMass,
            massUnit,
            totalEmission,
            totalEmissionPerMass,
            inputTable: inputRows.map((row) => ({
              sectionCode: row.sectionCode,
              sectionLabel: row.sectionLabel,
              materialName: row.materialName,
              amount: row.amount,
              unit: row.unit,
              emissionFactor: row.emissionFactor,
              totalEmission: row.totalEmission
            })),
            outputTable: outputRows.map((row) => ({
              sectionCode: row.sectionCode,
              sectionLabel: row.sectionLabel,
              materialName: row.materialName,
              amount: row.amount,
              unit: row.unit,
              originalAmount: row.originalAmount,
              originalUnit: row.unit,
              emissionFactor: row.emissionFactor,
              totalEmission: row.totalEmission
            }))
          }
        }
      });
      await issueSurveyReportVerification(record).catch((error) => {
        console.warn("LCA verification registration failed; continuing PDF download.", error);
      });
      saveReportVerificationRecord(record);
      setVerificationRecord(record);
      setPdfDownloadMode(true);
      await nextAnimationFrame();
      await nextAnimationFrame();
      await waitForReportFonts();
      const element = lcaArticleRef.current;
      if (!element) {
        throw new Error("LCA summary element is not ready.");
      }
      const module = await import("html2pdf.js");
      const html2pdf = (module.default || module) as unknown as () => any;
      const qrDataUrl = await createReportQrDataUrl(record);
      const pdfOptions: Record<string, unknown> = {
        filename: buildLcaSummaryPdfFileName(report, lcaDocumentTitle),
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          windowWidth: element.scrollWidth
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        margin: [14, 14, 0, 14],
        pagebreak: {
          mode: ["css", "legacy"],
          before: [".lca-page-2"],
          avoid: [".lca-section", ".lca-table tr"]
        }
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
        addImage: (image: string, format: string, x: number, y: number, width: number, height: number) => void;
        setProperties?: (properties: Record<string, string>) => void;
        output: (type: "blob") => Blob;
      }) => {
        const pageCount = Math.max(1, pdf.internal.getNumberOfPages());
        for (let page = 1; page <= pageCount; page += 1) {
          pdf.setPage(page);
          pdf.addImage(qrDataUrl, "PNG", 187, 276, 18, 18);
        }
        pdf.setPage(Math.max(1, pdf.internal.getNumberOfPages()));
        pdf.setFontSize(1);
        pdf.setTextColor(255, 255, 255);
        pdf.text(verificationPayloadToBlock(record), 1, 1, { maxWidth: 1 });
        pdf.setProperties?.({
          title: lcaDocumentTitle,
          subject: "Carbonet verified LCA summary report",
          keywords: `carbonet,lca,verification,${record.certificateId}`,
          creator: "Carbonet"
        });
        const issuedPdf = pdf.output("blob");
        return renderReportPdfPages(new File([issuedPdf], buildLcaSummaryPdfFileName(report, lcaDocumentTitle), { type: "application/pdf" }), () => undefined)
          .then(({ pages }) => buildReportVisualProfile(pages))
          .then((visualProfile) => registerSurveyReportVisualProfile(record.certificateId, visualProfile))
          .catch((error) => {
            console.warn("LCA visual profile registration failed; continuing PDF download.", error);
          });
      });
      await worker.save();
      setDownloadMessage(en ? "LCA summary PDF downloaded with hidden verification data." : "숨김 검증 정보가 포함된 LCA 요약 PDF를 다운로드했습니다.");
    } catch (error) {
      console.error(error);
      setDownloadMessage(en ? "PDF download failed. Please try again." : "PDF 다운로드에 실패했습니다. 다시 시도하세요.");
    } finally {
      setPdfDownloadMode(false);
      setDownloadBusy(false);
    }
  };
  const textFieldClass = "rounded-sm border border-emerald-300 bg-emerald-100/80 px-1.5 py-0.5 font-bold text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 print:border-0 print:bg-transparent print:px-0 print:py-0 print:shadow-none";
  const tableHeaderClass = "align-middle border border-[#cccccc] bg-[#d9d9d9] px-3 py-2 text-center text-[8px] font-black text-slate-950";
  const tableLabelClass = "align-middle border border-[#cccccc] bg-[#f2f2f2] px-3 py-2 text-[8px] font-black text-[#4f6fd5]";
  const tableCellClass = "align-middle border border-[#cccccc] px-3 py-2 text-[8px] font-semibold leading-4 text-slate-800";
  const cellContentClass = "lca-cell-content";
  const centerCellContentClass = "lca-cell-content lca-cell-content-center";
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
        {`
          @page{size:A4;margin:60px;}
          @media print{
            html,body{background:#fff!important}
            .print-hidden{display:none!important}
            main{padding:60px!important;box-sizing:border-box!important}
            .lca-sheet{box-shadow:none!important;border:none!important;border-radius:0!important;margin:0!important;max-width:none!important;width:100%!important;box-sizing:border-box!important;padding:0!important;font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:10pt!important;font-weight:400!important;line-height:1.35!important}
            .lca-sheet header{min-height:25px!important;margin-bottom:8px!important}
            .lca-sheet header,.lca-sheet header *{font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:18pt!important;font-weight:600!important;line-height:1.2!important}
            .lca-sheet h2{font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:12pt!important;font-weight:600!important;line-height:1.2!important;margin-bottom:6px!important}
            .lca-page-2>h2{font-size:18pt!important;font-weight:600!important;margin-bottom:12pt!important}
            .lca-sheet p,.lca-overview-copy{font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:9pt!important;font-weight:400!important;line-height:1.45!important}
            .lca-section{break-inside:avoid;page-break-inside:avoid;margin-top:26px!important}
            .lca-page-2{break-before:page!important;page-break-before:always!important;margin-top:0!important;padding-top:20px!important}
            .lca-page-2~.lca-section{margin-top:14px!important}
            .lca-sheet>.lca-section:last-child{padding-bottom:0!important}
            .lca-table{break-inside:auto;page-break-inside:auto;font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:8pt!important;font-weight:400!important;width:100%!important}
            .lca-table thead{display:table-header-group}
            .lca-table tr{break-inside:avoid;page-break-inside:avoid}
            .lca-table th{background:#d9d9d9!important;color:#0f172a!important;padding:3px 6px!important;height:24px!important;font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:8pt!important;font-weight:500!important;line-height:1.18!important;vertical-align:middle!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .lca-table td{padding:3px 6px!important;height:24px!important;font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:8pt!important;font-weight:400!important;line-height:1.18!important;vertical-align:middle!important}
            .lca-table th>*,.lca-table td>*{vertical-align:middle!important}
            .lca-cell-content{display:flex!important;min-height:18px!important;align-items:center!important;box-sizing:border-box!important;margin:0!important;padding-top:0!important;padding-bottom:0!important;line-height:1.18!important;transform:translateY(-2px)!important}
            .lca-cell-content-center{justify-content:center!important;text-align:center!important}
            .lca-cell-content>span,.lca-cell-content>input,.lca-cell-content>textarea{margin-top:0!important;margin-bottom:0!important}
            .lca-data-quality-content{display:block!important;width:100%!important;min-height:0!important;text-align:left!important;line-height:1.28!important;transform:translateY(-2px)!important}
            .lca-data-quality-cell{height:84px!important;min-height:84px!important;padding-top:4px!important;padding-bottom:6px!important}
            .lca-data-quality-content>div{display:block!important;width:100%!important;text-align:left!important}
            .lca-data-quality-value{display:block!important;margin-left:10px!important}
            .lca-data-quality-content .print-input-control{display:inline-block!important;width:auto!important;min-height:0!important;margin:0!important;line-height:1.2!important;vertical-align:baseline!important}
            .lca-data-quality-content .print-input-text{display:inline!important;line-height:1.2!important;vertical-align:baseline!important}
            .lca-table .print-input-control{display:block!important;min-height:0!important;margin-top:0!important;margin-bottom:0!important;line-height:1.18!important;padding-top:0!important;padding-bottom:1px!important;vertical-align:middle!important}
            .lca-pdf-download-mode .lca-table .print-input-text{display:inline-block!important;margin-top:0!important;margin-bottom:0!important;padding-top:0!important;padding-bottom:0!important;line-height:1.18!important;vertical-align:middle!important}
            .lca-page-1-table,.lca-page-1-table th,.lca-page-1-table td{font-size:8pt!important;line-height:1.18!important;vertical-align:middle!important}
            .lca-page-2~.lca-section .lca-table th,.lca-page-2~.lca-section .lca-table td{padding:3px 6px!important;height:24px!important;font-size:8pt!important;line-height:1.18!important;vertical-align:middle!important}
            .lca-page-2~.lca-section .lca-table .lca-data-quality-cell{height:84px!important;min-height:84px!important;padding-top:4px!important;padding-bottom:6px!important}
            .lca-table td.bg-[#f2f2f2],.lca-table td[class*='bg-[#f2f2f2]']{background:#f2f2f2!important;font-weight:500!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .print-input-control{display:none!important}
            .print-input-text{display:inline!important;color:inherit!important;font:inherit!important;font-weight:inherit!important;line-height:inherit!important;white-space:pre-wrap!important}
            .lca-auto{background:transparent!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .lca-screen-note{display:none!important}
            .lca-pdf-machine-readable{position:absolute!important;left:0!important;top:0!important;width:1px!important;height:1px!important;overflow:hidden!important;color:#fff!important;background:#fff!important;font-size:1px!important;line-height:1px!important;letter-spacing:0!important;white-space:pre-wrap!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          }
          @media screen{
            .print-input-text{display:none!important}
            .lca-required-field{background-image:linear-gradient(135deg,#ef233c 0 8px,transparent 8px)!important;background-repeat:no-repeat!important;background-position:left top!important;background-size:12px 12px!important}
            .lca-table{font-size:8px!important}
            .lca-table th,.lca-table td{height:24px!important;font-size:8px!important;vertical-align:middle!important}
            .lca-table th>*,.lca-table td>*{vertical-align:middle!important}
            .lca-cell-content{display:flex!important;min-height:18px!important;align-items:center!important;box-sizing:border-box!important;margin:0!important;padding-top:0!important;padding-bottom:0!important;line-height:1.18!important;transform:translateY(-2px)!important}
            .lca-cell-content-center{justify-content:center!important;text-align:center!important}
            .lca-cell-content>span,.lca-cell-content>input,.lca-cell-content>textarea{margin-top:0!important;margin-bottom:0!important}
            .lca-data-quality-content{display:block!important;width:100%!important;min-height:0!important;text-align:left!important;line-height:1.28!important;transform:translateY(-2px)!important}
            .lca-data-quality-cell{height:84px!important;min-height:84px!important;padding-top:4px!important;padding-bottom:6px!important}
            .lca-data-quality-content>div{display:block!important;width:100%!important;text-align:left!important}
            .lca-data-quality-value{display:block!important;margin-left:10px!important}
            .lca-data-quality-content .print-input-control{display:inline-block!important;width:auto!important;min-height:0!important;margin:0!important;line-height:1.2!important;vertical-align:baseline!important}
            .lca-data-quality-content .print-input-text{display:inline!important;line-height:1.2!important;vertical-align:baseline!important}
            .lca-table .print-input-control{display:block!important;min-height:0!important;margin-top:0!important;margin-bottom:0!important;line-height:1.18!important;padding-top:0!important;padding-bottom:1px!important;vertical-align:middle!important}
            .lca-pdf-download-mode .lca-table .print-input-text{display:inline-block!important;margin-top:0!important;margin-bottom:0!important;padding-top:0!important;padding-bottom:0!important;line-height:1.18!important;vertical-align:middle!important}
            .lca-page-1-table,.lca-page-1-table th,.lca-page-1-table td{font-size:8px!important;line-height:1.18!important;vertical-align:middle!important}
            .lca-page-2~.lca-section{margin-top:14px!important}
            .lca-page-2~.lca-section .lca-table th,.lca-page-2~.lca-section .lca-table td{padding:3px 6px!important;height:24px!important;font-size:8px!important;line-height:1.18!important;vertical-align:middle!important}
            .lca-page-2~.lca-section .lca-table .lca-data-quality-cell{height:84px!important;min-height:84px!important;padding-top:4px!important;padding-bottom:6px!important}
            .lca-overview-copy{font-size:9px!important;line-height:1.45!important}
            .lca-pdf-download-mode{padding-bottom:0!important}
            .lca-pdf-download-mode,.lca-pdf-download-mode *{font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important}
            .lca-pdf-download-mode .print-hidden{display:none!important}
            .lca-pdf-download-mode .print-input-control{display:none!important}
            .lca-pdf-download-mode .print-input-text{display:inline!important;color:inherit!important;font:inherit!important;font-weight:inherit!important;line-height:inherit!important;white-space:pre-wrap!important}
            .lca-pdf-download-mode .lca-section:last-of-type{margin-bottom:0!important;padding-bottom:0!important}
            .lca-pdf-download-mode .lca-pdf-machine-readable,.lca-pdf-machine-readable{position:absolute!important;left:-10000px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;color:transparent!important;background:transparent!important;font-size:1px!important;line-height:1px!important;white-space:pre-wrap!important}
          }
        `}
      </style>

      <div className="print-hidden mx-auto mb-4 flex max-w-[900px] justify-between gap-3">
        <button
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700"
          onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-report", "/en/admin/emission/survey-report"))}
          type="button"
        >
          {en ? "Back To Report" : "리포트로 돌아가기"}
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {downloadMessage ? <span className="text-xs font-black text-slate-600">{downloadMessage}</span> : null}
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
            disabled={downloadBusy}
            onClick={handleDownloadDocument}
            type="button"
          >
            {downloadBusy ? (en ? "Preparing PDF..." : "PDF 생성 중...") : (en ? "Download PDF" : "PDF 다운로드")}
          </button>
          <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800" onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-report-verify", "/en/admin/emission/survey-report-verify"))} type="button">
            {en ? "Verify PDF" : "진위확인"}
          </button>
        </div>
      </div>
      {missingRequiredLabels.length > 0 ? <div aria-live="assertive" className="print-hidden mx-auto mb-4 max-w-[900px] rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-700" role="alert">{en ? `${missingRequiredLabels.length} required LCA report items are missing: ` : `LCA 레포트 필수 항목 ${missingRequiredLabels.length}개를 확인해 주세요: `}{missingRequiredLabels.join(", ")}</div> : null}

      <article className={`lca-sheet mx-auto max-w-[900px] rounded-[20px] border border-white bg-white p-6 text-[12px] shadow-[0_28px_80px_rgba(15,23,42,0.18)] ${pdfDownloadMode ? "lca-pdf-download-mode" : ""}`} ref={lcaArticleRef}>
        <header className="text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
            <EditableText className={`${textFieldClass} lca-fill !w-auto min-w-[170px] text-center text-2xl`} id="lca-company-name" onCommit={setCompanyName} placeholder="* 기업명(예: 00건설)" value={companyName} />
            <span>{en ? "Product LCA Summary" : "제품 LCA 수행 개요"}</span>
          </div>
        </header>

        <section className="lca-section mt-4">
          <h2 className="mb-2 text-base font-black text-slate-950">1. {en ? "Terms" : "용어정의"}</h2>
          <table className="lca-table lca-page-1-table w-full border-collapse">
            <thead>
              <tr>
                <th className={`${tableHeaderClass} w-[24%] text-left`}><span className={cellContentClass}>{en ? "Term" : "용어"}</span></th>
                <th className={`${tableHeaderClass} text-left`}><span className={cellContentClass}>{en ? "Description" : "설명"}</span></th>
              </tr>
            </thead>
            <tbody>
              {terms.map(([term, desc]) => (
                <tr key={term}>
                  <td className={tableLabelClass}><span className={cellContentClass}>{term}</span></td>
                  <td className={tableCellClass}><span className={cellContentClass}>{desc}</span></td>
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
                  <td className={`${tableLabelClass} w-[28%]`}><span className={cellContentClass}>{label as string}</span></td>
                  <td className={tableCellClass}><span className={cellContentClass}>{value as string}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="lca-section lca-page-2 mt-0">
          <h2 className="mb-5 text-base font-black text-slate-950">{en ? "Summary" : "결과 요약"}</h2>
          <p className="lca-overview-copy leading-6 text-slate-800">
            {en ? "The target " : "당사가 생산하는 "}
            <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[260px] align-middle`} id="lca-product-family" onCommit={setProductFamily} placeholder="* 구분(예: 건설기계)(제품명: 모델, A123-4)" value={productFamily} />
            {en ? " product was assessed according to ISO 14040 and ISO 14044 procedures. The scope was set as Cradle to Gate, including raw material acquisition, processing, and product manufacturing. The functional unit was defined as " : " 제품은 ISO14040 및 ISO14044 지침의 일반적 절차와 요구 사항에 따라 LCA를 수행하였다. 영향 평가의 대상 범위는 ISO14025, ISO/TS14067에 따라 Cradle to Gate로 설정하여, 원료채취 및 가공, 제품 제조를 포함하고 있다. 평가대상의 기준단위는 "}
            <EditableText className={`${textFieldClass} lca-fill inline-block !w-auto min-w-[260px] align-middle`} id="lca-functional-unit" onCommit={setFunctionalUnit} placeholder={`* 산정된 탄소배출량의 단위\n예: 단위 제품 생산당, 단위 작동 시간당 등`} value={functionalUnit} />
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
                <td className={`${tableLabelClass} w-[28%]`}><span className={cellContentClass}>{en ? "Product model" : "제품모델"}</span></td>
                <td className={tableCellClass} colSpan={4}><span className={cellContentClass}><EditableText className={`${textFieldClass} lca-fill`} id="lca-product-model" onCommit={setProductModel} placeholder="* 제품명으로 수정" value={productModel} /></span></td>
              </tr>
              <tr>
                <td className={tableLabelClass}><span className={cellContentClass}>{en ? "General information" : "제품 일반 정보"}</span></td>
                <td className={tableCellClass} colSpan={4}><span className={cellContentClass}><EditableText className={`${textFieldClass} lca-fill`} id="lca-product-description" maxLength={300} multiline onCommit={setProductDescription} placeholder={`* 모델명으로 수정\n제품 일반 정보를 입력`} value={productDescription} /></span></td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} w-[28%] align-middle`} rowSpan={2}><span className={cellContentClass}>Product Spec.</span></td>
                <td className={tableHeaderClass}><span className={centerCellContentClass}>{en ? "Product name" : "제품명"}</span></td>
                <td className={tableHeaderClass}><span className={centerCellContentClass}>{en ? "Model name" : "모델명"}</span></td>
                <td className={tableHeaderClass}><span className={centerCellContentClass}>{en ? "Equipment weight(ton)" : "장비중량(ton)"}</span></td>
                <td className={tableHeaderClass}><span className={centerCellContentClass}>버킷 용량(m2)</span></td>
              </tr>
              <tr>
                <td className={`${tableCellClass} text-center`}><span className={centerCellContentClass}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setProductModel} placeholder="* 제품명" value={productModel} /></span></td>
                <td className={`${tableCellClass} text-center`}><span className={centerCellContentClass}><EditableText className={`${textFieldClass} lca-fill text-center`} id="lca-product-type" onCommit={setProductType} placeholder="* 모델명" value={productType} /></span></td>
                <td className={`${tableCellClass} text-center`}><span className={centerCellContentClass}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setEquipmentWeight} placeholder="장비중량(ton)" value={equipmentWeight} /></span></td>
                <td className={`${tableCellClass} text-center`}><span className={centerCellContentClass}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setBucketCapacity} placeholder="버킷 용량(m2)" value={bucketCapacity} /></span></td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} w-[28%]`}><span className={cellContentClass}>{en ? "Reference flow" : "중량정보(기준흐름)"}</span></td>
                <td className={tableCellClass} colSpan={4}><span className={cellContentClass}><EditableText className={`${textFieldClass} lca-fill`} id="lca-reference-flow" onCommit={setReferenceFlow} placeholder="* 중량정보(기준흐름)" value={referenceFlow} /></span></td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="lca-section mt-4">
          <h2 className="mb-2 text-base font-black text-slate-950">2. {en ? "LCA Execution Information" : "LCA 수행 정보"}</h2>
          <table className="lca-table w-full border-collapse">
            <tbody>
              <tr>
                <td className={`${tableLabelClass} w-[25%]`}><span className={cellContentClass}>{en ? "Functional unit" : "기능단위"}</span></td>
                <td className={tableCellClass} colSpan={4}><span className={cellContentClass}><EditableText className={`${textFieldClass} lca-fill`} onCommit={setFunctionalUnit} placeholder={`* 산정된 탄소배출량의 단위\n예: 단위 제품 생산당, 단위 작동 시간당 등`} value={functionalUnit} /></span></td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} align-middle`} rowSpan={5}><span className={cellContentClass}>{en ? "System boundary" : "시스템경계"}</span></td>
                <th className={tableHeaderClass}><span className={centerCellContentClass}>{en ? "Analysis stage" : "분석 단계"}</span></th>
                <th className={tableHeaderClass} colSpan={2}><span className={centerCellContentClass}>{en ? "Detailed scope" : "세부 범위"}</span></th>
                <th className={tableHeaderClass}><span className={centerCellContentClass}>{en ? "Included" : "분석 포함 여부"}</span></th>
              </tr>
              <tr>
                <td className={`${tableCellClass} text-center align-middle`} rowSpan={3}><span className={centerCellContentClass}>제조전 단계</span></td>
                <td className={tableCellClass} colSpan={2}><span className={cellContentClass}>원료물질 채취 및 제조공정</span></td>
                <td className={`${tableCellClass} text-center`}><span className={centerCellContentClass}>●</span></td>
              </tr>
              <tr>
                <td className={tableCellClass} colSpan={2}><span className={cellContentClass}>1차 협력업체 생산제품 제조</span></td>
                <td className={`${tableCellClass} text-center`}><span className={centerCellContentClass}>X</span></td>
              </tr>
              <tr>
                <td className={tableCellClass} colSpan={2}><span className={cellContentClass}>수송(협력업체→제조사업장)</span></td>
                <td className={`${tableCellClass} text-center`}><span className={centerCellContentClass}>X</span></td>
              </tr>
              <tr>
                <td className={`${tableCellClass} text-center align-middle`}><span className={centerCellContentClass}>제조 단계</span></td>
                <td className={tableCellClass} colSpan={2}><span className={cellContentClass}>제품 제조 공정</span></td>
                <td className={`${tableCellClass} text-center`}><span className={centerCellContentClass}>●</span></td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} lca-data-quality-cell`}><span className={cellContentClass}>{en ? "Data quality" : "데이터 품질"}</span></td>
                <td className={`${tableCellClass} lca-data-quality-cell text-left`} colSpan={4}>
                  <div className="lca-data-quality-content">
                    <div>· Upstream : secondary data(LCI DB)</div>
                    <div>· Core : 현장데이터 및 LCI DB</div>
                    <div>- Time Related Scope :</div>
                    <div className="lca-data-quality-value">{dataPeriod.trim() || "0000.00.00 ~ 0000.00.00"}</div>
                    <div>- Region Scope :</div>
                    <div className="lca-data-quality-value">{regionScope.trim() || "지역 범위(예: 00건설 00공장)"}</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td className={tableLabelClass}><span className={cellContentClass}>LCA Software</span></td>
                <td className={`${tableCellClass} lca-auto bg-amber-100`} colSpan={4}>
                  <span className={`${cellContentClass} font-black text-slate-950`}>{lcaSoftware || "-"}</span>
                </td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} align-middle`} rowSpan={2}><span className={cellContentClass}>LCIA Method</span></td>
                <th className={`${tableHeaderClass} w-[20%]`}><span className={centerCellContentClass}>Impact category</span></th>
                <th className={`${tableHeaderClass} w-[30%]`}><span className={centerCellContentClass}>Indicator</span></th>
                <th className={`${tableHeaderClass} w-[14%]`}><span className={centerCellContentClass}>Unit</span></th>
                <th className={`${tableHeaderClass} w-[26%]`}><span className={centerCellContentClass}>Recommended default LCIA method</span></th>
              </tr>
              <tr>
                <td className={`${tableCellClass} align-middle text-center`}><span className={centerCellContentClass}>Global Warming Potential (GWP100)</span></td>
                <td className={`${tableCellClass} align-middle text-center`}><span className={centerCellContentClass}>Radiative forcing as Global Warming Potential (GWP100)</span></td>
                <td className={`${tableCellClass} align-middle text-center`}><span className={centerCellContentClass}>kg CO₂–eq.</span></td>
                <td className={`${tableCellClass} align-middle text-center`}>
                  <span className={`${centerCellContentClass} flex-col`}>
                    <span>from openLCIA methods</span>
                    <span className="font-black">✓ IPCC 2021, AR6</span>
                  </span>
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
                <th className={tableHeaderClass}><span className={centerCellContentClass}>Impact category</span></th>
                <th className={tableHeaderClass}><span className={centerCellContentClass}>Unit</span></th>
                <th className={tableHeaderClass}><span className={centerCellContentClass}>Total</span></th>
                <th className={tableHeaderClass}><span className={centerCellContentClass}>제조전</span></th>
                <th className={tableHeaderClass}><span className={centerCellContentClass}>제조</span></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${tableCellClass} text-center`}><span className={centerCellContentClass}>Global Warming Potential (GWP100)</span></td>
                <td className={`${tableCellClass} text-center`}><span className={`${centerCellContentClass} flex-col`}><span>kg CO₂–eq</span><span>/{massUnit}</span></span></td>
                <td className={`${tableCellClass} lca-auto text-center font-black`}><span className={centerCellContentClass}>{formatNumber(totalEmissionPerMass)}</span></td>
                <td className={`${tableCellClass} lca-auto text-center font-black`}><span className={centerCellContentClass}>{formatNumber(preManufacturingMass)}</span></td>
                <td className={`${tableCellClass} lca-auto text-center font-black`}><span className={centerCellContentClass}>{formatNumber(postManufacturingMass)}</span></td>
              </tr>
              <tr>
                <td className={`${tableCellClass} text-center font-black`} colSpan={2}><span className={centerCellContentClass}>탄소배출량 합계</span></td>
                <td className={`${tableCellClass} lca-auto text-center font-black`}><span className={centerCellContentClass}>{formatNumber(totalEmission)} kg CO₂-eq</span></td>
                <td className={`${tableCellClass} lca-auto text-center font-black`}><span className={centerCellContentClass}>{preManufacturingMass > 0 ? formatPercent((preManufacturingMass / Math.max(preManufacturingMass + postManufacturingMass, 1)) * 100) : "-"}</span></td>
                <td className={`${tableCellClass} lca-auto text-center font-black`}><span className={centerCellContentClass}>{postManufacturingMass > 0 ? formatPercent((postManufacturingMass / Math.max(preManufacturingMass + postManufacturingMass, 1)) * 100) : "-"}</span></td>
              </tr>
            </tbody>
          </table>
        </section>
        {verificationRecord ? (
          <pre aria-hidden="true" className="lca-pdf-machine-readable">
            {verificationPayloadToBlock(verificationRecord)}
          </pre>
        ) : null}
      </article>
    </main>
  );
}

function EditableNumber({
  value,
  onCommit,
  className = "",
  digits = 2,
  id,
  required = false
}: {
  value: number;
  onCommit: (value: number) => void;
  className?: string;
  digits?: number;
  id?: string;
  required?: boolean;
}) {
  const [draft, setDraft] = useState(formatNumber(value, digits));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) {
      setDraft(formatNumber(value, digits));
    }
  }, [digits, focused, value]);
  return (
    <>
      <input
        className={`print-input-control print:border-0 print:bg-transparent print:p-0 ${className}`.trim()}
        id={id}
        inputMode="decimal"
        onBlur={() => {
          setFocused(false);
          onCommit(parseEditableNumber(draft));
        }}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          onCommit(parseEditableNumber(nextDraft));
        }}
        onFocus={() => setFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        required={required}
        value={draft}
      />
      <span className={`print-input-text ${className}`.trim()}>{draft || formatNumber(value, digits)}</span>
    </>
  );
}

function EditableText({
  value,
  onCommit,
  className = "",
  multiline = false,
  placeholder = "",
  maxLength = 500,
  id,
  required = false
}: {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  id?: string;
  required?: boolean;
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
          id={id}
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
          required={required || Boolean(requiredClassName)}
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
        id={id}
        maxLength={maxLength}
        onBlur={() => onCommit(draft)}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        required={required || Boolean(requiredClassName)}
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
    <div className="print-metric-card rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
      <p className="print-metric-label text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="print-metric-value mt-1 text-center font-mono text-lg font-black text-slate-950">
        {editable && typeof value === "number" && onCommit ? (
	          <EditableNumber
	            className="w-full bg-transparent text-center font-mono text-lg font-black text-slate-950"
	            digits={digits}
	            onCommit={onCommit}
	            value={value}
	          />
        ) : value}
      </p>
      {note ? <p className="print-metric-note mt-0.5 text-center text-[10px] font-bold text-slate-500">{note}</p> : <span className="print-metric-note" />}
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
            <th className="w-[10%] whitespace-nowrap rounded-tl-3xl border-b border-amber-200 px-2 py-3 text-center">{en ? "Model name" : "모델명"}</th>
            <th className="w-[23%] border-b border-amber-200 px-2 py-3">{en ? "Output" : "출력물"}</th>
            <th className="w-[15%] whitespace-nowrap border-b border-amber-200 px-2 py-3 text-center">{en ? "Process Standard Mass" : "공정기준질량"}</th>
            <th className="w-[10%] whitespace-nowrap border-b border-amber-200 px-2 py-3 text-center">{en ? "Mass Share" : "질량 비중"}</th>
            <th className="w-[18%] border-b border-amber-200 px-2 py-3 text-center">{en ? "Emission (by Mass Share)" : "질량 비중에 따른 배출량 계산"}</th>
            <th className="w-[24%] rounded-tr-3xl border-b border-amber-200 px-2 py-3 text-center">{en ? "Emission per ton" : "배출량(1톤 기준)"}</th>
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
              <tr className="pdf-table-row border-b border-amber-100 align-middle" key={row.rowId}>
                <td className="px-3 py-3 align-middle text-slate-600 font-bold text-center bg-slate-50/40">
                  <div className="print-output-cell-inner">{groupLabel(row, en)}</div>
                </td>
                <td className="px-3 py-3 align-middle">
                  <div className="print-output-cell-inner output-name">
                  {editable ? (
                    <EditableText
                      multiline
                      className="min-h-[3.9rem] resize-none bg-transparent text-sm font-black leading-snug text-slate-950 print:min-h-0 print:whitespace-pre-wrap"
                      onCommit={(value) => onRowTextChange?.(row.rowId, "materialName", value)}
                      value={en ? toEnglishTitleCase(resolveEnglishMaterialName(row.materialName, englishNameMap || {})) : (row.materialName || "-")}
                    />
                  ) : (
                    <span className="block whitespace-pre-wrap text-sm font-black leading-snug text-slate-950">
                      {en ? toEnglishTitleCase(resolveEnglishMaterialName(row.materialName, englishNameMap || {})) : (row.materialName || "-")}
                    </span>
                  )}
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-amber-100">
                    <div className="h-full rounded-full bg-amber-600" style={{ width: `${Math.max(2, Math.min(displaySharePercent, 100))}%` }} />
                  </div>
                  </div>
                </td>
                <td className="px-2 py-3 text-center">
                  <div className="print-output-cell-inner">
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
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-center font-mono font-black">
                  <div className="print-output-cell-inner">
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
                  </div>
                </td>
                <td className="px-2 py-3 text-center align-middle">
                  <div className="print-output-cell-inner">
                  <div className="inline-flex flex-col items-center justify-center leading-none">
                    <span className="font-mono text-sm font-black text-slate-950">{formatNumber(massShareEmission, 2)}</span>
                    <span className="mt-1 text-[9px] font-bold text-slate-500 whitespace-nowrap">kg CO2e</span>
                  </div>
                  </div>
                </td>
                <td className="px-2 py-3 text-center align-middle">
                  <div className="print-output-cell-inner">
                  <div className="inline-flex flex-col items-center justify-center leading-none">
                    <span className="font-mono text-sm font-black text-slate-950">{formatNumber(perTonEmission, 2)}</span>
                    <span className="mt-1 text-[9px] font-bold text-slate-500 whitespace-nowrap">
                      kg CO2e/ton of <br />{en ? toEnglishTitleCase(productName || "Product") : (productName || "제품")}
                    </span>
                  </div>
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
      <tr className="pdf-table-row bg-blue-50">
        <td className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700" colSpan={4}>
          <div className="detail-cell-inner">{sectionLabel(sectionCode, group.sectionLabel, en)}</div>
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr className="pdf-table-row border-b border-slate-100 align-middle" key={row.rowId}>
          <td className="w-[40%] px-3 py-2">
            <div className="detail-cell-inner">
            {editable ? (
              <EditableText
                className="w-full bg-transparent font-bold leading-tight text-slate-900"
                onCommit={(value) => onRowChange?.(row.rowId, "materialName", value)}
                value={en ? toEnglishTitleCase(resolveEnglishMaterialName(row.materialName, englishNameMap || {})) : (row.materialName || "-")}
              />
            ) : (
              <span className="block whitespace-nowrap font-bold leading-tight text-slate-900">
                {en ? toEnglishTitleCase(resolveEnglishMaterialName(row.materialName, englishNameMap || {})) : (row.materialName || "-")}
              </span>
            )}
            </div>
          </td>
          <td className="px-3 py-2 text-center">
            <div className="detail-cell-inner center">
            <div className="report-value-unit inline-flex max-w-full items-baseline justify-center gap-1 whitespace-nowrap rounded-lg bg-slate-50 px-2 py-1 font-mono">
                {editable ? (
                  <EditableNumber
                    className="inline-block w-20 bg-transparent text-right font-mono"
                    digits={2}
                    onCommit={(value) => onRowNumberChange?.(row.rowId, "originalAmount", value)}
                    value={row.originalAmount}
                  />
                ) : (
                  <span>{formatNumber(row.originalAmount, 2)}</span>
                )}
                <span>{row.unit || ""}</span>
            </div>
            </div>
          </td>
          <td className="px-3 py-2">
            <div className="detail-cell-inner">
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
            </div>
          </td>
          <td className="px-3 py-2 font-black">
            <div className="detail-cell-inner">
            {row.calculated && editable ? (
              <EditableNumber
                className="w-20 bg-transparent font-black"
                onCommit={(value) => onRowNumberChange?.(row.rowId, "totalEmission", value)}
                value={row.originalAmount * row.emissionFactor}
              />
            ) : row.calculated ? (
              <span className="font-mono">{formatNumber(row.originalAmount * row.emissionFactor, 2)}</span>
            ) : "-"}
            </div>
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
  onSectionEmissionChange?: (sectionCode: string, value: number) => void;
  onSectionShareChange?: (sectionCode: string, value: number) => void;
  sectionShareInputs?: Record<string, number>;
}) {
  const pieSlices = buildPieSlices(sections);
  return (
    <div className="pdf-chart-panel rounded-[calc(var(--kr-gov-radius)+4px)] border border-slate-200 bg-white p-5 shadow-sm">
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
      <div className="report-pie-visual mt-5 flex w-full justify-center">
        <div className="report-pie-visual-inner relative aspect-square w-full max-w-[340px]">
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
      </div>
      {sections.length > 0 ? (
        <div className="report-pie-legend mt-4 grid gap-2 sm:grid-cols-2">
          {sections.map((section, index) => (
            <div className="report-pie-legend-item min-w-0 rounded-lg bg-slate-50 px-3 py-2" key={`${title}-legend-${section.sectionCode}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: sectionSolidColor(index) }} />
                <span className="pie-legend-label min-w-0 text-xs font-medium text-slate-700" title={sectionLabel(section.sectionCode, section.sectionLabel, en)}>
                  {sectionLabel(section.sectionCode, section.sectionLabel, en)}
                </span>
              </div>
              <p className="pie-legend-metric mt-1 min-w-0 pl-[18px] text-[11px] font-medium leading-4 text-slate-500">
                <span className="shrink-0 whitespace-nowrap">{formatPercent(section.sharePercent)}</span>
                <span aria-hidden="true">·</span>
                <span className="min-w-0" title={`${formatNumber(section.totalEmission)} kg CO2e`}>
                  {formatNumber(section.totalEmission)} kg CO2e
                </span>
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
