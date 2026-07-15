import React, { useEffect, useMemo, useRef, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  fetchSurveyEcoinventAiRecommendationPage,
  fetchSurveyMaterialEnglishNames,
  issueSurveyReportVerification,
  registerSurveyReportVisualProfile,
  verifySurveyReportDataset,
  verifySurveyReportPhoto,
  type ReportPhotoVerificationResponse,
  type ReportDatasetVerificationResponse
} from "../../lib/api/emission";
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
      amount: row.amount,
      amountDisplay: formatNumber(row.amount, 2),
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
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image preprocessing failed.")), "image/png"));
}

async function recognizeReportPhotos(files: Blob[], onProgress: (progress: number, status: string) => void) {
  const images: Blob[] = [];
  for (let index = 0; index < files.length; index += 1) {
    onProgress(Math.round((index / Math.max(1, files.length)) * 10), `IMAGE ${index + 1}/${files.length}`);
    images.push(await preprocessReportPhoto(files[index]));
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
    confidence: confidences.length ? Math.max(...confidences) : 0
  };
}

async function renderReportPdfPages(file: File, onProgress: (progress: number, status: string) => void) {
  // Bundle the worker implementation into the application chunk. PDF.js detects
  // globalThis.pdfjsWorker and uses it directly, so verification never depends on
  // a separately fetched .mjs URL, proxy MIME rules, or a stale worker asset.
  await import("pdfjs-dist/build/pdf.worker.min.mjs");
  const pdfjs = await import("pdfjs-dist");
  const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: Blob[] = [];
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    onProgress(Math.round((pageNumber / pdfDocument.numPages) * 8), `PDF ${pageNumber}/${pdfDocument.numPages}`);
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
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
  return pages;
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

async function waitForReportFonts() {
  if (!document.fonts) {
    return;
  }
  await Promise.all([
    document.fonts.load('400 16px "Pretendard GOV"'),
    document.fonts.load('500 16px "Pretendard GOV"'),
    document.fonts.load('600 16px "Pretendard GOV"'),
    document.fonts.load('700 16px "Pretendard GOV"'),
    document.fonts.load('800 16px "Pretendard GOV"'),
    document.fonts.load('900 16px "Pretendard GOV"'),
    document.fonts.ready
  ]);
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
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [pdfDownloadMode, setPdfDownloadMode] = useState(false);
  const [pdfDesignDraft, setPdfDesignDraft] = useState<ReportPdfDesignDraft | null>(null);

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
  const handleDownloadPdf = async (draft: ReportPdfDesignDraft | null = null) => {
    if (!effectiveReport) {
      return;
    }
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
      setPdfDownloadMode(true);
      await nextAnimationFrame();
      await nextAnimationFrame();
      await waitForReportFonts();
      const element = reportArticleRef.current;
      if (!element) {
        throw new Error("Report element is not ready.");
      }
      const module = await import("html2pdf.js");
      const html2pdf = module.default || module;
      const qrDataUrl = await createReportQrDataUrl(record);
      const pdfOptions: Record<string, unknown> = {
          filename: buildReportPdfFileName(effectiveReport, draft),
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
            windowWidth: element.scrollWidth
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          margin: [8, 8, 0, 8],
          pagebreak: {
            mode: ["css", "legacy"],
            before: [".pdf-page-start"],
            after: [],
            avoid: [".pdf-avoid", ".print-break", ".print-card", ".pdf-table-row"]
          }
        };
      const worker = html2pdf()
        .set(pdfOptions)
        .from(element)
        .toPdf();
      await worker.get("pdf").then(async (pdf: {
        internal: { getNumberOfPages: () => number };
        setPage: (page: number) => void;
        setFontSize: (size: number) => void;
        setTextColor: (r: number, g: number, b: number) => void;
        text: (text: string, x: number, y: number, options?: Record<string, unknown>) => void;
        addImage: (image: string, format: string, x: number, y: number, width: number, height: number) => void;
        output: (type: "blob") => Blob;
        setProperties?: (properties: Record<string, string>) => void;
      }) => {
        const pageCount = Math.max(1, pdf.internal.getNumberOfPages());
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
          pdf.text(`DIGITAL VERIFICATION ${page}/${pageCount}`, 187, 274);
          pdf.addImage(qrDataUrl, "PNG", 187, 276, 18, 18);
        }
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
        const issuedPdf = pdf.output("blob");
        try {
          const issuedPages = await renderReportPdfPages(new File([issuedPdf], `${record.certificateId}.pdf`, { type: "application/pdf" }), () => undefined);
          await registerSurveyReportVisualProfile(record.certificateId, await buildReportVisualProfile(issuedPages));
        } catch (error) {
          console.warn("Report visual profile registration failed; continuing PDF download.", error);
        }
      });
      await worker.save();
      setVerificationMessage(en ? "PDF file downloaded with hidden verification data." : "숨김 검증 정보가 포함된 PDF 파일을 다운로드했습니다.");
    } catch (error) {
      console.error(error);
      setVerificationMessage(en ? "PDF download failed. Please try again." : "PDF 다운로드에 실패했습니다. 다시 시도하세요.");
    } finally {
      setPdfDownloadMode(false);
      setPdfDesignDraft(null);
      setVerificationBusy(false);
    }
  };
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
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {REPORT_PDF_DESIGN_DRAFTS.map((draft) => (
              <button
                className={`min-w-40 border px-3 py-2 text-left disabled:cursor-wait disabled:bg-slate-100 disabled:text-slate-500 ${draft.buttonClass}`}
                disabled={verificationBusy}
                key={draft.id}
                onClick={() => handleDownloadPdf(draft.id)}
                type="button"
              >
                <span className="flex items-center gap-2 text-xs font-black">
                  <span className="material-symbols-outlined text-[18px]">{draft.icon}</span>
                  {verificationBusy && pdfDesignDraft === draft.id ? (en ? "Preparing..." : "생성 중...") : (en ? draft.enLabel : draft.label)}
                </span>
                <span className="mt-1 block text-[10px] font-bold opacity-70">{en ? draft.enDescription : draft.description}</span>
              </button>
            ))}
          </div>
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

      <article className={`report-typography print-sheet mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.22)] ${pdfDownloadMode ? `pdf-download-mode${pdfDesignDraft ? ` pdf-design-draft pdf-draft-${pdfDesignDraft}` : ""}` : ""}`} ref={reportArticleRef}>
        <div className="print-page">
        <header className="print-ink-bg print-report-hero relative overflow-hidden bg-slate-950 px-8 py-8 text-white">
          <div className="print-report-hero-deco absolute -right-20 -top-28 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="print-report-hero-deco absolute bottom-0 right-0 h-36 w-72 rounded-tl-full bg-emerald-400/10" />
          <p className="print-report-title-tag relative text-xs font-black uppercase tracking-[0.24em] text-cyan-200">{en ? "Product / Byproduct Emission Factor Report" : "제품/부산물 배출계수 리포트"}</p>
          <div className="print-report-hero-grid relative mt-4 grid items-center gap-5 lg:grid-cols-[minmax(0,1.4fr)_320px]">
            <div className="print-report-title-wrap flex min-h-28 items-center">
              <h1 className="krds-type-report-cover-title print-report-title max-w-2xl text-4xl font-black leading-tight tracking-[-0.055em]">
                <EditableText
                  className="krds-type-report-cover-title print-report-title max-w-2xl bg-transparent text-4xl font-black leading-tight tracking-[-0.055em] text-white"
                  onCommit={(value) => setDraftReport((current) => current ? { ...current, productName: value } : current)}
                  value={en ? resolveEnglishMaterialName(effectiveReport.productName || effectiveReport.pageTitle, englishNameMap) : (effectiveReport.productName || effectiveReport.pageTitle)}
                />
              </h1>
            </div>
            <div className="print-report-total-card rounded-3xl border border-white/15 bg-white/10 p-4 text-right shadow-2xl backdrop-blur">
              <p className="print-report-total-label text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100">{en ? "Total Footprint" : "총 탄소배출량"}</p>
              <EditableNumber
                className="krds-type-report-total mt-3 inline-block w-32 max-w-full bg-transparent text-right text-3xl font-black tracking-[-0.05em] text-white"
                onCommit={updateTotalEmission}
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

        <section className="pdf-page-content pdf-chart-page grid gap-4 px-8 py-7 lg:grid-cols-2">
          <div className="pdf-avoid print-card print-soft-bg rounded-3xl border border-slate-200 bg-slate-50 p-5">
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
        {verificationRecord ? (
          <pre aria-hidden="true" className="pdf-machine-readable">
            {verificationPayloadToBlock(verificationRecord)}
          </pre>
        ) : null}
      </article>
    </main>
  );
}

export function EmissionSurveyReportVerifyPage({ embedded = false }: { embedded?: boolean } = {}) {
  const en = isEnglish();
  const [selectedReportType, setSelectedReportType] = useState<ReportVerificationType>("EMISSION_SURVEY");
  const [manualBlock, setManualBlock] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploadedVerificationText, setUploadedVerificationText] = useState("");
  const [uploadedPayloadFound, setUploadedPayloadFound] = useState(false);
  const [payload, setPayload] = useState<ReportVerificationPayload | null>(null);
  const [datasetVerification, setDatasetVerification] = useState<ReportDatasetVerificationResponse | null>(null);
  const [photoVerification, setPhotoVerification] = useState<ReportPhotoVerificationResponse | null>(null);
  const [ocrProgress, setOcrProgress] = useState<{ busy: boolean; percent: number; status: string }>({ busy: false, percent: 0, status: "" });
  const [verificationLogs, setVerificationLogs] = useState<Array<{ id: string; at: string; level: "INFO" | "OK" | "WARN" | "ERROR"; message: string; detail?: string }>>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [resultMessage, setResultMessage] = useState(en ? "Upload the certificate PDF or paste the verification block." : "인증서 PDF를 업로드하거나 검증 블록을 붙여넣으세요.");
  const [resultTone, setResultTone] = useState<"info" | "success" | "warning">("info");
  const appendVerificationLog = (level: "INFO" | "OK" | "WARN" | "ERROR", message: string, detail?: string) => {
    setVerificationLogs((current) => [...current, {
      id: `${Date.now()}-${current.length}`,
      at: new Date().toLocaleTimeString(),
      level,
      message,
      detail
    }].slice(-200));
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

  const evaluatePayload = async (nextPayload: ReportVerificationPayload | null, sourceLabel: string) => {
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
          ? (en ? "Authenticity verified: all certificate tags and the complete report dataset match the issued record." : "진위 확인 완료: 인증 태그와 리포트 전체 데이터셋이 발급 원장과 모두 일치합니다.")
          : (en ? `Dataset verification failed. ${verification.differenceCount || 0} differences were found.` : `데이터셋 검증에 실패했습니다. ${verification.differenceCount || 0}개의 불일치 항목을 확인했습니다.`));
      } catch (error) {
        appendVerificationLog("ERROR", en ? "Registry dataset comparison failed." : "원장 데이터셋 대조에 실패했습니다.", error instanceof Error ? error.message : String(error));
        setDatasetVerification(null);
        setResultTone("warning");
        setResultMessage(error instanceof Error ? error.message : (en ? "Server dataset verification failed." : "서버 데이터셋 검증에 실패했습니다."));
      }
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

  const evaluatePhotographedPages = async (pages: Blob[], sourceLabel: string, preserveDigitalPayload = false) => {
    appendVerificationLog("INFO", en ? "Photographed-page verification started." : "촬영 페이지 검증을 시작했습니다.", `${sourceLabel}, pages=${pages.length}`);
    if (!preserveDigitalPayload) {
      setUploadedPayloadFound(false);
    }
    setOcrProgress({ busy: true, percent: 0, status: en ? "Preparing pages" : "페이지 이미지 보정 중" });
    setResultTone("info");
    setResultMessage(en ? `Reading visible report data from ${sourceLabel}...` : `${sourceLabel}의 화면 데이터셋을 읽고 있습니다...`);
    try {
      const qrEvidence = await scanReportQrEvidence(pages);
      appendVerificationLog(qrEvidence ? "OK" : "WARN", qrEvidence ? (en ? "Verification QR decoded." : "검증 QR을 판독했습니다.") : (en ? "Verification QR was not found." : "검증 QR을 찾지 못했습니다."), qrEvidence?.certificateId);
      const visualProfile = await buildReportVisualProfile(pages);
      appendVerificationLog("OK", en ? "Uploaded visual fingerprint generated." : "업로드 문서 시각 지문을 생성했습니다.", `grid=${visualProfile.columns}x${visualProfile.rows}, pages=${visualProfile.pages.length}`);
      const recognized = await recognizeReportPhotos(pages, (percent, status) => setOcrProgress({ busy: true, percent, status }));
      appendVerificationLog("OK", en ? "Korean/English OCR completed." : "한글·영문 OCR을 완료했습니다.", `characters=${recognized.text.length}, engineConfidence=${Math.round(recognized.confidence)}%`);
      setUploadedVerificationText(recognized.text);
      const verification = await verifySurveyReportPhoto(recognized.text, qrEvidence || undefined, visualProfile, selectedReportType);
      appendVerificationLog(verification.photoConsistent ? "OK" : "WARN", en ? "Issued-report candidate comparison completed." : "발급 리포트 후보 대조를 완료했습니다.", `certificate=${verification.certificateId || "-"}, candidates=${verification.comparisons?.length || 0}, exact=${verification.comparisons?.filter((item) => item.overallExactMatch).length || 0}, confidence=${verification.confidence}%, visual=${verification.visualSimilarity ?? 0}%, mismatches=${verification.fieldMismatches?.length || 0}`);
      setPhotoVerification(verification);
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
    setPhotoVerification(null);
    setDatasetVerification(null);
    if (files.every((item) => item.type.startsWith("image/"))) {
      photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
      setPhotoPreviewUrls(files.map((item) => URL.createObjectURL(item)));
      await evaluatePhotographedPages(files, en ? "uploaded photos" : "업로드 사진");
      return;
    }
    photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPhotoPreviewUrls([]);
    const buffer = await file.arrayBuffer();
    const extractedText = await extractPdfVerificationText(buffer);
    appendVerificationLog("INFO", en ? "PDF embedded text scan completed." : "PDF 내장 텍스트 검색을 완료했습니다.", `characters=${extractedText.length}`);
    const nextPayload = resolveVerificationPayload(extractedText);
    setUploadedVerificationText(extractedText);
    setUploadedPayloadFound(Boolean(nextPayload));
    if (nextPayload) {
      await evaluatePayload(nextPayload, file.name);
      setOcrProgress({ busy: true, percent: 0, status: en ? "Cross-checking visible PDF data" : "PDF 화면 데이터 교차 검증 중" });
      try {
        const pages = await renderReportPdfPages(file, (percent, status) => setOcrProgress({ busy: true, percent, status }));
        appendVerificationLog("OK", en ? "PDF pages rendered for OCR cross-check." : "OCR 교차 검증용 PDF 페이지 변환을 완료했습니다.", `pages=${pages.length}`);
        setPhotoPreviewUrls(pages.map((page) => URL.createObjectURL(page)));
        await evaluatePhotographedPages(pages, file.name, true);
      } catch (error) {
        appendVerificationLog("ERROR", en ? "Visible PDF OCR cross-check failed." : "PDF 화면 OCR 교차 검증에 실패했습니다.", error instanceof Error ? error.message : String(error));
        setOcrProgress((current) => ({ ...current, busy: false }));
        setResultTone("warning");
        setResultMessage(error instanceof Error ? error.message : (en ? "Visible PDF dataset cross-check failed." : "PDF 화면 데이터셋 교차 검증에 실패했습니다."));
      }
      return;
    }
    setOcrProgress({ busy: true, percent: 0, status: en ? "Rendering PDF pages" : "PDF 페이지 변환 중" });
    try {
      const pages = await renderReportPdfPages(file, (percent, status) => setOcrProgress({ busy: true, percent, status }));
      appendVerificationLog("OK", en ? "PDF pages rendered for visual verification." : "시각 검증용 PDF 페이지 변환을 완료했습니다.", `pages=${pages.length}`);
      setPhotoPreviewUrls(pages.map((page) => URL.createObjectURL(page)));
      await evaluatePhotographedPages(pages, file.name);
    } catch (error) {
      setOcrProgress((current) => ({ ...current, busy: false }));
      setResultTone("warning");
      setResultMessage(error instanceof Error ? error.message : (en ? "Scanned PDF OCR failed." : "스캔 PDF OCR 처리에 실패했습니다."));
    }
  };

  const handleManualVerify = () => {
    if (photoVerification) {
      setResultTone(photoVerification.photoConsistent ? "success" : "warning");
      setResultMessage(photoVerification.photoConsistent
        ? (en ? `Photo content matches an issued dataset with ${photoVerification.confidence}% confidence.` : `촬영본 내용이 발급 데이터셋과 ${photoVerification.confidence}% 신뢰도로 일치합니다.`)
        : (en ? "The photo OCR result requires review." : "사진 OCR 결과에 대한 검토가 필요합니다."));
      return;
    }
    const sourceText = manualBlock.trim() || uploadedVerificationText;
    const sourceLabel = manualBlock.trim()
      ? (en ? "manual input" : "수동 입력값")
      : (fileName || (en ? "uploaded PDF" : "업로드 PDF"));
    void evaluatePayload(resolveVerificationPayload(sourceText), sourceLabel);
  };

  const toneClass = resultTone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : resultTone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-sky-200 bg-sky-50 text-sky-950";

  const verificationContent = (
      <AdminWorkspacePageFrame>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{en ? "PDF Verification" : "PDF 검증"}</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{en ? "Upload Certificate PDF" : "인증서 PDF 업로드"}</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  {en ? "Version 2 PDFs contain hidden certificate data and the canonical report dataset. They are read and compared automatically." : "version 2 PDF에는 숨김 인증 정보와 정규화 데이터셋이 포함되며 업로드 시 자동으로 읽어 대조합니다."}
                </p>
              </div>
              <MemberButton onClick={() => navigate(buildLocalizedPath("/admin/emission/survey-report-print?lang=ko", "/en/admin/emission/survey-report-print?lang=en"))} type="button" variant="secondary">
                {en ? "Open PDF Download" : "PDF 다운로드 화면 열기"}
              </MemberButton>
            </div>
            <label className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center hover:border-emerald-400 hover:bg-emerald-50">
              <span className="text-base font-black text-slate-900">{fileName || (en ? "Choose PDF file" : "PDF 파일 선택")}</span>
              <span className="mt-2 text-sm font-semibold text-slate-500">{en ? "PDF, JPG, PNG, and WebP are supported. Photos are processed locally with Korean and English OCR." : "PDF, JPG, PNG, WebP 지원. 사진은 한글·영문 OCR로 기기 안에서 처리합니다."}</span>
              <input accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="sr-only" multiple onChange={handleFileChange} type="file" />
            </label>
            {photoPreviewUrls.length ? (
              <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
                {photoPreviewUrls.map((url, index) => <img alt={`${en ? "Uploaded report page" : "업로드 리포트 페이지"} ${index + 1}`} className="aspect-[3/4] w-full rounded-xl border border-slate-200 bg-slate-50 object-contain" key={url} src={url} />)}
              </div>
            ) : null}
            {ocrProgress.busy ? (
              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
                <div className="flex items-center justify-between text-sm font-black text-sky-900"><span>{en ? "OCR processing" : "OCR 처리 중"}</span><span>{ocrProgress.percent}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100"><div className="h-full bg-sky-600 transition-all" style={{ width: `${ocrProgress.percent}%` }} /></div>
                <p className="mt-2 text-xs font-semibold text-sky-700">{ocrProgress.status}</p>
              </div>
            ) : null}
            {fileName ? (
              <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-bold ${uploadedPayloadFound || photoVerification?.photoConsistent ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                {photoVerification
                  ? (en ? `Photo OCR comparison completed (${photoVerification.confidence}%).` : `사진 OCR 데이터셋 대조를 완료했습니다(${photoVerification.confidence}%).`)
                  : uploadedPayloadFound
                  ? (en ? "Verification data was found in the uploaded PDF. The button below can verify it again." : "업로드한 PDF에서 검증 데이터를 찾았습니다. 아래 버튼으로 다시 확인할 수 있습니다.")
                  : (en ? "The uploaded PDF was read, but hidden Carbonet verification data was not found." : "업로드한 PDF는 읽었지만 숨김 Carbonet 검증 정보를 찾지 못했습니다.")}
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

            {photoVerification ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{en ? "Photo OCR Evidence" : "사진 OCR 대조 근거"}</p>
                <div className="mt-3 flex items-end justify-between"><strong className="text-3xl text-slate-950">{photoVerification.confidence}%</strong><span className="text-xs font-black text-slate-500">{en ? "CONTENT CONFIDENCE" : "내용 일치 신뢰도"}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                  <span className="col-span-2">QR: {photoVerification.qrFullyMatched ? "VERIFIED" : photoVerification.qrDetected ? "MISMATCH" : "NOT FOUND"}</span>
                  <span className="col-span-2">{en ? "OCR-only confidence" : "OCR 단독 일치도"}: {photoVerification.contentConfidence ?? photoVerification.confidence}%</span>
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
                      {photoVerification.damagedRegions.slice(0, 16).map((region, index) => (
                        <span className="bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900" key={`${region.page}-${region.row}-${region.column}-${index}`}>
                          P{region.page} R{region.row} C{region.column} ({region.difference})
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="mt-3 text-xs font-semibold leading-5 text-amber-800">{en ? "A photo verifies visible-content consistency, not the hidden digital signature. Use the original PDF for cryptographic authenticity." : "사진은 보이는 내용의 일치도를 검증하며 숨김 디지털 서명 자체를 증명하지는 않습니다. 완전한 진위 확인은 원본 PDF를 사용하세요."}</p>
              </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{en ? "Dataset Comparison" : "데이터셋 대조"}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
                <span className={`rounded-lg px-3 py-2 ${photoVerification || datasetVerification ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "Pre-PDF registry dataset" : "PDF 생성 전 원장 데이터셋"}: {photoVerification || datasetVerification ? "OK" : "-"}
                </span>
                <span className={`rounded-lg px-3 py-2 ${datasetVerification?.datasetPresent ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "PDF embedded dataset" : "PDF 내장 데이터셋"}: {datasetVerification?.datasetPresent ? "OK" : "-"}
                </span>
                <span className={`rounded-lg px-3 py-2 ${datasetVerification?.datasetMatch ? "bg-emerald-50 text-emerald-800" : datasetVerification ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "Embedded vs registry" : "내장 ↔ 원장"}: {datasetVerification?.datasetMatch ? "OK" : datasetVerification ? "FAIL" : "-"}
                </span>
                <span className={`rounded-lg px-3 py-2 ${photoVerification?.photoConsistent ? "bg-emerald-50 text-emerald-800" : photoVerification ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "Visible OCR vs registry" : "화면 OCR ↔ 원장"}: {photoVerification?.photoConsistent ? `${photoVerification.confidence}%` : photoVerification ? `${photoVerification.confidence}%` : "-"}
                </span>
                <span className={`col-span-2 rounded-lg px-3 py-2 ${photoVerification?.qrFullyMatched ? "bg-emerald-100 text-emerald-900" : photoVerification?.qrDetected ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-500"}`}>
                  {en ? "Photographed QR signature vs registry" : "촬영 QR 서명 ↔ 원장"}: {photoVerification?.qrFullyMatched ? "OK" : photoVerification?.qrDetected ? "FAIL" : "-"}
                </span>
                <span className={`col-span-2 rounded-lg px-3 py-2 ${datasetVerification?.datasetMatch && photoVerification?.photoConsistent ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-600"}`}>
                  {en ? "Three-way equality" : "3자 데이터 일치"}: {datasetVerification?.datasetMatch && photoVerification?.photoConsistent ? "OK" : datasetVerification ? (en ? "OCR REVIEW" : "OCR 검토") : (en ? "EMBEDDED DATA UNAVAILABLE" : "내장 데이터 없음")}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                {datasetVerification?.datasetMatch
                  ? (en ? "The embedded report dataset matches the issued registry. Visible report fields are listed in the detailed OCR comparison." : "PDF 내장 데이터셋이 발급 원장과 일치합니다. 눈에 보이는 레포트 항목은 OCR 상세 대조에서 확인할 수 있습니다.")
                  : (en ? "Upload a newly issued report to compare its embedded dataset." : "내장 데이터셋 대조를 위해 새로 발급한 리포트를 업로드하세요.")}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
          <section className="mt-5 overflow-hidden border border-slate-200 bg-white shadow-sm">
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
                <span className="bg-slate-950 px-3 py-2 text-white">{en ? "Final exact" : "최종 완전 일치"}: {photoVerification.comparisons?.filter((item) => item.overallExactMatch).length || 0}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full border-collapse text-left text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-black">{en ? "Issued report" : "발급 리포트"}</th>
                    <th className="px-4 py-3 font-black">{en ? "Confidence" : "내용 신뢰도"}</th>
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
                        <strong className={item.contentMatch ? "text-emerald-700" : item.confidence >= 55 ? "text-amber-700" : "text-rose-700"}>{item.confidence}%</strong>
                        <p className="mt-1 text-slate-500">{item.contentMatch ? (en ? "MATCH" : "일치") : item.confidence >= 55 ? (en ? "REVIEW" : "검토") : (en ? "MISMATCH" : "불일치")}</p>
                      </td>
                      <td className="px-4 py-3 align-top leading-5 text-slate-700" colSpan={6}>
                        <p className={`mb-2 font-black ${item.datasetExactMatch ? "text-emerald-700" : "text-rose-700"}`}>{en ? "Dataset" : "데이터셋"}: {item.datasetExactMatch ? "EXACT" : "MISMATCH"}</p>
                        <p>{en ? "Product" : "제품"}: {item.productMatched ? "OK" : "-"}</p>
                        <p>{en ? "Title" : "제목"}: {item.titleMatched ? "OK" : "-"}</p>
                        {selectedReportType === "LCA_SUMMARY" ? <>
                          <p>{en ? "LCA fields" : "LCA 고유 항목"}: {item.matchedLcaFieldCount || 0}/{item.lcaFieldCount || 0}</p>
                          <p>{en ? "Mass / emission values" : "질량·배출 수치"}: {item.matchedNumberCount}/{item.numberCount}</p>
                        </> : <>
                          <p>{en ? "Total" : "총량"}: {item.totalEmissionMatched ? "OK" : "-"}</p>
                          <p>{en ? "Materials" : "물질"}: {item.matchedMaterialCount}/{item.materialCount}</p>
                          <p>{en ? "Numbers" : "수치"}: {item.matchedNumberCount}/{item.numberCount}</p>
                        </>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`px-2 py-1 font-black ${item.tagExactMatch ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{en ? "Verification tags" : "검증 태그"}: {item.tagExactMatch ? "EXACT" : "MISMATCH"}</span>
                          <span className={`px-2 py-1 font-black ${item.overallExactMatch ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{en ? "Final result" : "최종 판정"}: {item.overallExactMatch ? (en ? "EXACT MATCH" : "일치") : (en ? "MISMATCH" : "불일치")}</span>
                        </div>
                        <details className="mt-3 min-w-72 border border-slate-200 bg-white">
                          <summary className="cursor-pointer select-none px-3 py-2 font-black text-slate-800 hover:bg-slate-50">
                            {en ? "Show detailed comparison" : "상세 일치·불일치 내역"}
                          </summary>
                          <div className="border-t border-slate-200 p-3">
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                [en ? "Product" : "제품명", item.productMatched],
                                [en ? "Title" : "제목", item.titleMatched],
                                [en ? "Total emission" : "총 배출량", item.totalEmissionMatched],
                                [en ? "Certificate ID" : "인증서 ID", item.certificateIdMatch],
                                [en ? "Report hash" : "리포트 해시", item.payloadHashMatch],
                                [en ? "Integrity code" : "무결성 코드", item.integrityCodeMatch],
                                [en ? "Dataset hash" : "데이터셋 해시", item.datasetHashMatch]
                              ].map(([label, matched]) => (
                                <span className={`px-2 py-1 font-bold ${matched ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`} key={String(label)}>
                                  {String(label)}: {matched ? "MATCH" : "MISMATCH"}
                                </span>
                              ))}
                            </div>
                            {selectedReportType !== "LCA_SUMMARY" && item.reportSummaryComparisons?.length ? <div className="mt-4 border-t border-slate-200 pt-3">
                              <p className="font-black text-slate-900">{en ? "Report totals and GWP" : "레포트 총계·GWP 대조"}</p>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                {item.reportSummaryComparisons.map((field) => <span className={`px-2 py-2 font-bold ${field.matched ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`} key={`${item.certificateId}-summary-${field.field}`}>{field.label}: {field.expected || "-"} · {field.matched ? "MATCH" : "MISMATCH"}</span>)}
                              </div>
                            </div> : null}
                            {selectedReportType !== "LCA_SUMMARY" && item.outputFieldComparisons?.length ? <div className="mt-4 border-t border-slate-200 pt-3">
                              <p className="font-black text-slate-900">{en ? "Product and byproduct allocation" : "제품·부산물 질량 및 배출량 대조"}</p>
                              <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                                {item.outputFieldComparisons.map((field) => <div className={`border-l-4 p-3 ${field.rowMatched ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-rose-500 bg-rose-50 text-rose-900"}`} key={`${item.certificateId}-output-${field.rowIndex}-${field.materialName}`}>
                                  <p className="font-black">{field.outputType === "BYPRODUCT" ? (en ? "Byproduct" : "부산물") : (en ? "Product" : "제품")} · {field.materialName || "-"}</p>
                                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                                    <span>{en ? "Name" : "물질명"}: {field.materialMatched ? "MATCH" : "MISMATCH"}</span>
                                    <span>{en ? "Process standard mass" : "공정 기준 질량"}: {field.processReferenceMassDisplay || "-"} · {field.processReferenceMassMatched ? "MATCH" : "MISMATCH"}</span>
                                    <span>{en ? "Mass share" : "질량 비율"}: {field.massSharePercentDisplay || "-"}% · {field.massSharePercentMatched ? "MATCH" : "MISMATCH"}</span>
                                    <span>{en ? "Allocated emission" : "질량 비율 배출량"}: {field.allocatedEmissionDisplay || "-"} · {field.allocatedEmissionMatched ? "MATCH" : "MISMATCH"}</span>
                                    <span>{en ? "Emission per ton" : "배출량(1톤 기준)"}: {field.emissionPerTonDisplay || "-"} · {field.emissionPerTonMatched ? "MATCH" : "MISMATCH"}</span>
                                  </div>
                                </div>)}
                              </div>
                            </div> : null}
                            {selectedReportType === "LCA_SUMMARY" && item.lcaFieldComparisons?.length ? (
                              <div className="mt-3 space-y-4">
                                <div>
                                  <p className="font-black text-emerald-800">{en ? "Matched LCA fields" : "LCA 일치 내역"} ({item.lcaFieldComparisons.filter((field) => field.matched).length})</p>
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    {item.lcaFieldComparisons.filter((field) => field.matched).map((field) => (
                                      <span className="bg-emerald-50 px-2 py-1 font-bold text-emerald-800" key={`matched-${field.field}`}>
                                        {field.label}: {field.expected || "-"}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="border-t border-slate-200 pt-3">
                                  <p className="font-black text-rose-800">{en ? "Mismatched LCA fields" : "LCA 불일치 내역"} ({item.lcaFieldComparisons.filter((field) => !field.matched).length})</p>
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    {item.lcaFieldComparisons.filter((field) => !field.matched).map((field) => (
                                      <span className="bg-rose-50 px-2 py-1 font-bold text-rose-800" key={`mismatched-${field.field}`}>
                                        {field.label}: {field.expected || "-"}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : selectedReportType === "LCA_SUMMARY" ? (
                              <p className="mt-3 border border-amber-200 bg-amber-50 p-3 font-bold text-amber-900">
                                {en ? "This issued PDF does not contain the LCA-specific dataset. Download it again from the LCA report page." : "이 발급 PDF에는 LCA 전용 데이터셋이 없습니다. LCA 보고서 화면에서 새로 다운로드하세요."}
                              </p>
                            ) : null}
                            {selectedReportType !== "LCA_SUMMARY" ? <div className="mt-3">
                              <p className="font-black text-emerald-800">{en ? "Matched fields" : "일치 내역"} ({item.fieldComparisons?.filter((field) => field.rowMatched).length || 0})</p>
                              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                                {(item.fieldComparisons || []).filter((field) => field.rowMatched).map((field) => (
                                  <div className="border-l-4 border-emerald-500 bg-emerald-50 p-2 text-emerald-900" key={`${item.certificateId}-matched-${field.rowIndex}-${field.materialName}`}>
                                    <p className="font-black">#{field.rowIndex} {field.sectionLabel || "-"} / {field.materialName || "-"}</p>
                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                                      <span>{en ? "Material" : "물질명"}: MATCH</span>
                                      <span>{en ? "Amount" : "사용량"}: {field.amountDisplay || "-"}</span>
                                      <span>{en ? "Factor" : "배출계수"}: {field.emissionFactorDisplay || "-"}</span>
                                      <span>{en ? "Emission" : "배출량"}: {field.totalEmissionDisplay || "-"}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div> : null}
                            {selectedReportType !== "LCA_SUMMARY" ? <div className="mt-4 border-t border-slate-200 pt-3">
                              <p className="font-black text-rose-800">{en ? "Mismatched fields" : "불일치 내역"} ({item.fieldMismatches?.length || 0})</p>
                            {item.fieldMismatches?.length ? (
                              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                                {item.fieldMismatches.map((field) => (
                                  <div className="border-l-4 border-rose-500 bg-rose-50 p-2 text-rose-900" key={`${item.certificateId}-${field.rowIndex}-${field.materialName}`}>
                                    <p className="font-black">#{field.rowIndex} {field.sectionLabel || "-"} / {field.materialName || "-"}</p>
                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                                      {!field.materialMatched ? <span>{en ? "Material mismatch" : "물질명 불일치"}</span> : null}
                                      {!field.amountMatched ? <span>{en ? "Amount" : "사용량"}: {field.amountDisplay || "-"}</span> : null}
                                      {!field.emissionFactorMatched ? <span>{en ? "Factor" : "배출계수"}: {field.emissionFactorDisplay || "-"}</span> : null}
                                      {!field.totalEmissionMatched ? <span>{en ? "Emission" : "배출량"}: {field.totalEmissionDisplay || "-"}</span> : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-3 bg-emerald-50 p-2 font-bold text-emerald-800">{en ? "No field-level mismatches were found." : "필드 단위 불일치가 없습니다."}</p>
                            )}
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
        <section className="mt-5 overflow-hidden border border-slate-300 bg-slate-950 text-slate-100 shadow-sm">
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
      const html2pdf = module.default || module;
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
          .then(buildReportVisualProfile)
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

      <article className={`lca-sheet mx-auto max-w-[900px] rounded-[20px] border border-white bg-white p-6 text-[12px] shadow-[0_28px_80px_rgba(15,23,42,0.18)] ${pdfDownloadMode ? "lca-pdf-download-mode" : ""}`} ref={lcaArticleRef}>
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
                <td className={`${tableLabelClass} w-[28%]`}><span className={cellContentClass}>{en ? "Product model" : "제품모델"}</span></td>
                <td className={tableCellClass} colSpan={4}><span className={cellContentClass}><EditableText className={`${textFieldClass} lca-fill`} onCommit={setProductModel} placeholder="* 제품명으로 수정" value={productModel} /></span></td>
              </tr>
              <tr>
                <td className={tableLabelClass}><span className={cellContentClass}>{en ? "General information" : "제품 일반 정보"}</span></td>
                <td className={tableCellClass} colSpan={4}><span className={cellContentClass}><EditableText className={`${textFieldClass} lca-fill`} maxLength={300} multiline onCommit={setProductDescription} placeholder={`* 모델명으로 수정\n제품 일반 정보를 입력`} value={productDescription} /></span></td>
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
                <td className={`${tableCellClass} text-center`}><span className={centerCellContentClass}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setProductType} placeholder="* 모델명" value={productType} /></span></td>
                <td className={`${tableCellClass} text-center`}><span className={centerCellContentClass}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setEquipmentWeight} placeholder="장비중량(ton)" value={equipmentWeight} /></span></td>
                <td className={`${tableCellClass} text-center`}><span className={centerCellContentClass}><EditableText className={`${textFieldClass} lca-fill text-center`} onCommit={setBucketCapacity} placeholder="버킷 용량(m2)" value={bucketCapacity} /></span></td>
              </tr>
              <tr>
                <td className={`${tableLabelClass} w-[28%]`}><span className={cellContentClass}>{en ? "Reference flow" : "중량정보(기준흐름)"}</span></td>
                <td className={tableCellClass} colSpan={4}><span className={cellContentClass}><EditableText className={`${textFieldClass} lca-fill`} onCommit={setReferenceFlow} placeholder="* 중량정보(기준흐름)" value={referenceFlow} /></span></td>
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
    <>
      <input
        className={`print-input-control print:border-0 print:bg-transparent print:p-0 ${className}`.trim()}
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
    <div className="print-metric-card rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
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
                  {groupLabel(row, en)}
                </td>
                <td className="px-3 py-3 align-middle">
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
                      kg CO2e/ton of <br />{en ? toEnglishTitleCase(productName || "Product") : (productName || "제품")}
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
      <tr className="pdf-table-row bg-blue-50">
        <td className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700" colSpan={4}>
          {sectionLabel(sectionCode, group.sectionLabel, en)}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr className="pdf-table-row border-b border-slate-100 align-middle" key={row.rowId}>
          <td className="w-[40%] px-3 py-2">
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
          </td>
          <td className="px-3 py-2 text-center">
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
    <div className="pdf-avoid rounded-[calc(var(--kr-gov-radius)+4px)] border border-slate-200 bg-white p-5 shadow-sm">
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
                <span className="min-w-0 truncate text-xs font-medium text-slate-700" title={sectionLabel(section.sectionCode, section.sectionLabel, en)}>
                  {sectionLabel(section.sectionCode, section.sectionLabel, en)}
                </span>
              </div>
              <p className="mt-1 flex min-w-0 items-baseline gap-1 pl-[18px] text-[11px] font-medium leading-4 text-slate-500">
                <span className="shrink-0 whitespace-nowrap">{formatPercent(section.sharePercent)}</span>
                <span aria-hidden="true">·</span>
                <span className="min-w-0 truncate" title={`${formatNumber(section.totalEmission)} kg CO2e`}>
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
