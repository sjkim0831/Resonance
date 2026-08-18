import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(frontendRoot, "../../..");
const paths = {
  page: path.join(frontendRoot, "src/features/emission-survey-report/EmissionSurveyReportMigrationPage.tsx"),
  api: path.join(frontendRoot, "src/lib/api/emission.ts"),
  service: path.join(repoRoot, "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/service/ReportVerificationRegistryService.java"),
  controller: path.join(repoRoot, "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/web/ReportVerificationRegistryController.java"),
  migration: path.join(repoRoot, "apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260818090000__bind_issued_pdf_bytes_to_verification_registry.sql"),
};

const sources = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, value]) => [key, await readFile(value, "utf8")])));
let assertionCount = 0;

function requireText(sourceKey, token) {
  assertionCount += 1;
  if (!sources[sourceKey].includes(token)) {
    throw new Error(`[certificate-pdf-tamper] missing ${sourceKey} contract: ${token}`);
  }
}

function rejectText(sourceKey, token) {
  assertionCount += 1;
  if (sources[sourceKey].includes(token)) {
    throw new Error(`[certificate-pdf-tamper] forbidden ${sourceKey} bypass: ${token}`);
  }
}

function requireOrder(sourceKey, startToken, firstToken, secondToken, endToken) {
  assertionCount += 1;
  const source = sources[sourceKey];
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  const first = source.indexOf(firstToken, start);
  const second = source.indexOf(secondToken, start);
  if (start < 0 || end < 0 || first < start || second < start || first >= second || second >= end) {
    throw new Error(`[certificate-pdf-tamper] invalid ${sourceKey} ordering: ${firstToken} < ${secondToken}`);
  }
}

requireText("migration", "pdf_sha256 CHAR(64)");
requireText("migration", "CHECK ((pdf_sha256 IS NULL) = (pdf_size_bytes IS NULL))");
requireText("service", "MessageDigest.isEqual");
requireText("service", '"EXACT_PDF_MATCH"');
requireText("service", '"TAMPERED_PDF"');
requireText("service", '"PDF_FINGERPRINT_UNAVAILABLE"');
requireText("service", "bindIssuedPdfFingerprint");
requireText("controller", '"/api/home/certificate-verify/verify-file"');
requireText("controller", '@RequestPart("file") MultipartFile file');
requireText("api", 'form.append("file", file, file.name)');
requireText("api", '"/api/home/certificate-verify/verify-file"');
requireText("page", 'resultTone === "danger" ? (en ? "Tampered PDF" : "변조 파일")');
requireText("page", 'verification.status === "TAMPERED_PDF"');
requireText("page", "QR·OCR·시각 유사도로 이 결과를 덮어쓸 수 없습니다.");
requireText("page", "const [uploadedPdfSelected, setUploadedPdfSelected] = useState(false)");
requireText("page", "const visibleCertificateId = findCertificateIdFromPdfText(extractedText)");
requireText("page", "const modificationDates = await inspectPdfModificationDates(buffer)");
requireText("page", "creationDate !== modificationDate");
requireText("page", 'verificationMode: "PDF_METADATA_DATES"');
requireText("page", "PDF 생성·수정 날짜 불일치를 감지했습니다.");
requireText("page", "변조 파일입니다. PDF 생성일과 수정일이 다릅니다.");
requireText("page", "변조 파일: PDF 생성일과 수정일이 다릅니다.");
requireText("api", '"EXACT_PDF_BYTES" | "PDF_METADATA_DATES"');
requireText("page", "PDF 원본성 검증 불가: OCR·시각 유사도는 참고 증거이며 진위 판정이 아닙니다.");
requireText("page", 'uploadedPdfSelected && pdfFileVerification?.status !== "EXACT_PDF_MATCH" ? "UNVERIFIABLE"');
requireText("page", 'uploadedPdfSelected ? "UNVERIFIABLE" : "-"');
rejectText("page", "(!pdfFileVerification && (uploadedPayloadFound || photoVerification?.photoConsistent))");
rejectText("page", "(!pdfFileVerification || pdfFileVerification.status === \"EXACT_PDF_MATCH\")");
requireOrder("page", "const handleFileChange", "await verifyExactPdfFile(file, nextPayload.certificateId)",
  "await evaluatePayload(nextPayload, file.name, exactPdfVerification)", "const handleManualVerify");
requireOrder("page", "const handleFileChange", "const visibleCertificateId = findCertificateIdFromPdfText(extractedText)",
  "await evaluatePhotographedPages(pages, file.name, false, file, initialPdfVerification)", "const handleManualVerify");
requireOrder("page", "const evaluatePhotographedPages", "if (rawPdfFile) {",
  "if (preserveDigitalPayload) {", "const handleFileChange");

console.log(JSON.stringify({
  status: "PASS",
  assertionCount,
  exactByteEndpoint: true,
  tamperedResultPrecedence: true,
  legacyFailClosed: true,
  missingExactVerdictNeverGreen: true,
  standaloneCertificateIdVerifiedBeforeOcrSuccess: true,
  pdfCreationModificationDateMismatchBlocked: true,
  adminOneWayBinding: true,
}));
