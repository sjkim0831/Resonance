import { readFileSync } from "node:fs";

const sourcePath = new URL("../src/features/emission-survey-report/EmissionSurveyReportMigrationPage.tsx", import.meta.url);
const source = readFileSync(sourcePath, "utf8");

const required = [
  ["stylesheet inliner", "async function buildInlinedReportStyles()"],
  ["authenticated stylesheet fetch", 'credentials: "include"'],
  ["fresh stylesheet fetch", 'cache: "no-store"'],
  ["stylesheet content-type validation", 'contentType.includes("text/css")'],
  ["relative asset URL normalization", "absolutizeReportStyleUrls(css, stylesheetUrl)"],
  ["embedded stylesheet marker", "data-carbonet-pdf-stylesheet="],
  ["empty stylesheet fail-closed", "PDF stylesheet was empty"],
  ["missing embedded stylesheet fail-closed", "PDF stylesheet was not embedded"],
  ["issuance waits for embedded styles", "const printableHead = await buildInlinedReportStyles();"],
];

for (const [label, token] of required) {
  if (!source.includes(token)) {
    throw new Error(`[report-pdf-style-contract] missing ${label}: ${token}`);
  }
}

const issuanceStart = source.indexOf("const handleDownloadPdf = async");
const legacyStart = source.indexOf("const handleDownloadPdfLegacy = async", issuanceStart);
if (issuanceStart < 0 || legacyStart < 0) {
  throw new Error("[report-pdf-style-contract] PDF issuance boundaries are missing");
}
const issuance = source.slice(issuanceStart, legacyStart);
if (issuance.includes('.map((node) => node.outerHTML)')) {
  throw new Error("[report-pdf-style-contract] external stylesheet links can still bypass embedding");
}
const embeddedStylesIndex = issuance.indexOf("await buildInlinedReportStyles()");
const issuePdfIndex = issuance.indexOf("issueSurveyReportPdf(record, reportHtml");
if (embeddedStylesIndex < 0 || issuePdfIndex < 0) {
  throw new Error("[report-pdf-style-contract] PDF issuance or embedded stylesheet boundary is missing");
}
if (embeddedStylesIndex > issuePdfIndex) {
  throw new Error("[report-pdf-style-contract] PDF is issued before styles are embedded");
}

console.log("REPORT_PDF_STYLE_CONTRACT_PASS embedded=1 authenticated=1 failClosed=2 relativeUrls=1");
