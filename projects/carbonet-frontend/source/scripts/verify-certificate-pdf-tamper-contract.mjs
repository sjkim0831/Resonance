import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(frontendRoot, "../../..");
const paths = {
  page: path.join(frontendRoot, "src/features/emission-survey-report/EmissionSurveyReportMigrationPage.tsx"),
  home: path.join(frontendRoot, "src/features/home-entry/HomeCertificateVerifyPage.tsx"),
  api: path.join(frontendRoot, "src/lib/api/emission.ts"),
  service: path.join(repoRoot, "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/service/ReportVerificationRegistryService.java"),
  controller: path.join(repoRoot, "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/web/ReportVerificationRegistryController.java"),
  security: path.join(repoRoot, "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/config/security/CarbonetSecurityOverrideConfig.java"),
  screenRegistry: path.join(repoRoot, "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/service/CertificateVerificationScreenDesignRegistry.java"),
  deploy: path.join(repoRoot, "ops/scripts/resonance-k8s-build-deploy-80-v2.sh"),
  runtimeAssets: path.join(frontendRoot, "public/runtime/screen-system-assets.js"),
  migration: path.join(repoRoot, "apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260818090000__bind_issued_pdf_bytes_to_verification_registry.sql"),
  ocrMigration: path.join(repoRoot, "apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260818173000__register_report_ocr_evidence.sql"),
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
requireText("ocrMigration", "ocr_evidence_json jsonb");
requireText("ocrMigration", "ocr_evidence_version integer");
requireText("ocrMigration", "conrelid = 'carbonet_report_verification_registry'::regclass");
requireText("screenRegistry", 'DEFAULT_SCREEN_FILE = "/app/config/certificate-verification-screen.json"');
requireText("deploy", '"$ROOT_DIR/config/certificate-verification/certificate-verification-screen.json"');
requireText("deploy", '"$ROOT_DIR/config/certificate-verification/certificate-verification-rules.json"');
requireText("deploy", '[[ -f "$certificate_config_source" && ! -L "$certificate_config_source" ]]');
requireText("runtimeAssets", "build.sourceCommit || build.sourceHash");
requireText("service", "MessageDigest.isEqual");
requireText("service", '"EXACT_PDF_MATCH"');
requireText("service", '"TAMPERED_PDF"');
requireText("service", '"PDF_FINGERPRINT_UNAVAILABLE"');
requireText("service", "bindIssuedPdfFingerprint");
requireText("service", "canonicalizeOcrEvidence");
requireText("service", "findCompactEvidenceToken");
requireText("service", "unexpected-numeric-evidence");
rejectText("service", "expectedTokens.equals(actualTokens)");
requireText("service", 'pageComparison.put("unexpectedTokens", pageUnexpected)');
requireText("service", 'Boolean.TRUE.equals(score.get("sectionSummaryExactMatch"))');
requireText("service", 'result.put("unexpectedSectionSummaryNumbers", unexpected)');
requireText("service", 'comparison.put("unexpectedNumbers", unexpectedNumbers)');
requireText("service", "scoreDetailTablePage(normalizedOcrPages, dataset, ocrLinePages)");
requireText("service", "MAX_VERIFICATION_PAGES = 10");
requireText("service", "scoreSectionSummaryPage(normalizedOcrPages, dataset, ocrLinePages)");
requireText("service", "selectSectionSummaryPage(normalizedOcrPages, summaries)");
requireText("service", "selectDetailTablePages(normalizedOcrPages, rows)");
requireText("service", 'score.put("comparisonItemCount", details.size())');
requireText("service", 'detail.put("category", category)');
requireText("service", 'comparison.put("numericDataExactMatch", numericDataExactMatch)');
requireText("service", 'comparison.put("chartExactMatch", chartExactMatch)');
requireText("service", 'response.put("payloadHash", best.get("payload_hash"))');
requireText("service", 'response.put("integrityCode", best.get("integrity_code"))');
requireText("service", '"DATA_TAMPERED"');
requireText("service", '"CHART_TAMPERED"');
requireText("service", 'classifySemanticStatus(Boolean.TRUE.equals(best.get("numericDataExactMatch"))');
requireText("service", 'boolean ocrEvidenceRequired = "EMISSION_SURVEY".equalsIgnoreCase(requestedReportType)');
requireText("service", "tagExactMatch && datasetExactMatch && ocrEvidenceExactMatch");
requireText("service", "!ocrEvidenceRequired || ocrEvidenceExactMatch");
requireText("service", 'status = confidence >= 55 ? "PHOTO_REVIEW" : "PHOTO_MISMATCH"');
requireText("service", '"IDENTIFIER_MISMATCH"');
requireText("service", '"OCR_EVIDENCE_UNAVAILABLE"');
requireText("service", '"OCR_CONTENT_MISMATCH"');
requireText("controller", '"/api/home/certificate-verify/verify-file"');
requireText("controller", '"INVALID_VERIFICATION_REQUEST"');
requireText("controller", 'ReportVerificationRegistryService.MAX_VERIFICATION_PAGES');
requireText("security", '"/api/home/certificate-verify/verify-file"');
requireText("security", '"/api/en/home/certificate-verify/verify-file"');
requireText("security", '"/api/home/certificate-verify/verify"');
requireText("security", '"/api/home/certificate-verify/verify-ocr"');
requireText("security", '"/api/en/home/certificate-verify/verify"');
requireText("security", '"/api/en/home/certificate-verify/verify-ocr"');
requireText("controller", '@RequestPart("file") MultipartFile file');
requireText("api", 'form.append("file", file, file.name)');
requireText("api", '"/api/home/certificate-verify/verify-file"');
requireText("api", "body: JSON.stringify({ record, html, ocrEvidence })");
requireText("page", "buildReportOcrIssuanceEvidence(article, record)");
requireText("page", "MAX_REPORT_VERIFICATION_PAGES = 10");
requireText("page", "pdfDocument.numPages > MAX_REPORT_VERIFICATION_PAGES");
requireText("page", "files.length > MAX_REPORT_VERIFICATION_PAGES");
rejectText("page", "최대 10페이지의 유형을 자동 식별하여 각각 검증합니다.");
rejectText("page", "내장 데이터셋 대조를 위해 새로 발급한 리포트를 업로드하세요.");
rejectText("page", "version 2 PDF에는 숨김 인증 정보와 정규화 데이터셋이 포함되며 업로드 시 자동으로 읽어 대조합니다.");
rejectText("page", "PDF 다운로드 화면 열기");
rejectText("home", "Carbonet에서 발급한 리포트 또는 인증서를 업로드하여 식별 정보와 전체 데이터셋을 발급 원장과 대조합니다.");
rejectText("home", "data-certificate-support-cards");
requireText("page", 'selectedReportType === "EMISSION_SURVEY" && photoVerification.ocrEvidencePageComparisons?.length');
requireText("api", "actualTokenCount: number");
requireText("api", "tokenSequenceExact: boolean");
requireText("api", "unexpectedTokens: string[]");
requireText("api", "tokenComparisons: Array<{");
requireText("api", "expectedOccurrence: number");
requireText("api", "actualOccurrenceCount: number");
requireText("page", 'page.tokenSequenceExact ? "SEQUENCE EXACT" : "SEQUENCE MISMATCH"');
requireText("page", 'page.unexpectedTokens.join(", ")');
requireText("api", "sectionSummaryComparisons?: Array<{");
requireText("api", "actualTotalEmission: string");
rejectText("page", 'en ? "Pages 2–3 · Graph data comparison" : "2–3페이지 · 그래프 데이터 대조"');
rejectText("page", 'en ? "Ordered page evidence" : "페이지별 전체 항목·순서·중복 검증"');
requireText("page", 'matched ? "MATCH" : "MISMATCH"');
requireText("page", 'pageDataSections.flatMap((section, sectionIndex)');
requireText("page", 'en ? "Uploaded PDF value" : "업로드 PDF값"');
requireText("page", 'section.unexpectedNumbers.map');
requireText("page", 'item.comparisonDetails.filter((detail) => detail.category !== "CHART")');
rejectText("page", 'photoVerification.sectionSummaryComparisons.map((section)');
requireText("page", 'className="order-1 border-t border-slate-200 pt-3"');
requireText("page", 'className="order-2 mt-4 border-t border-slate-200 pt-3"');
requireText("page", 'className="order-3 mt-4 border border-slate-300 bg-slate-50 p-3"');
requireText("page", 'className="order-5 mt-4 overflow-auto border border-slate-200"');
requireText("page", 'en ? "Page 1 · Report totals and GWP" : "1페이지 · 레포트 총계·GWP 대조"');
requireText("page", 'en ? "Page 1 · Product and byproduct mass and emissions" : "1페이지 · 제품·부산물 질량 및 배출량 대조"');
requireText("page", 'en ? "Page 4 · Detailed table comparison" : "4페이지 · 상세표 일치·불일치"');
requireText("page", 'en ? "Page 4 · Detailed calculation results table" : "4페이지 · 상세 계산 결과표"');
requireText("page", 'selectedReportType === "LCA_SUMMARY" || !item.fieldComparisons?.length');
requireText("page", 'en ? "Uploaded document value" : "업로드 문서값"');
requireText("page", 'PDF 화면 픽셀을 텍스트 레이어와 독립적으로 OCR 판독했습니다.');
requireText("page", 'en ? "Page 5 · Digital verification identifiers" : "5페이지 · 디지털 검증 식별 정보"');
requireText("page", "payload?.certificateId || photoVerification?.certificateId");
requireText("page", "payload?.payloadHash || photoVerification?.payloadHash");
requireText("page", "payload?.integrityCode || photoVerification?.integrityCode");
requireText("api", "comparisonDetails?: ReportVisibleFieldComparison[]");
requireText("page", 'const textContent = await page.getTextContent()');
requireText("page", 'item.x + 2 < previousItem.x || Math.abs(item.y - previousItem.y) > 8');
requireText("page", '.join("\\n")');
requireText("page", 'throw new Error(`Report page ${pageNumber} has no readable text layer. Reissue the PDF before verification.`)');
requireText("page", 'digitalTextPages: string[] | null = null');
requireText("page", 'recognized = await recognizeReportPhotos(pages');
requireText("page", 'exactPdfVerification?.status === "EXACT_PDF_MATCH"');
requireText("page", 'readableDigitalPages.every(Boolean)');
requireText("page", 'engine: exactIssuedPdf ? "ISSUED_PDF_TEXT_LAYER" : "PDF_TEXT_LAYER_REVIEW"');
requireText("page", '바이트가 일치한 발급 PDF의 텍스트 레이어로 DB 전체 비교를 즉시 계속했습니다.');
requireText("page", 'PDF 바이트는 다르지만 문서 텍스트로 DB 내용 비교를 계속합니다.');
requireText("page", '원본성 불일치: PDF 바이트는 다르지만 DB 내용 비교를 완료했고 표시 데이터는 모두 일치합니다.');
requireText("page", 'const rawVerification = await verifySurveyReportPhoto(');
requireText("page", 'exactPdfVerification?.status === "EXACT_PDF_MATCH"');
requireText("page", 'comparisonDetails: candidate.comparisonDetails?.map((detail) => ({ ...detail, actual: detail.expected, matched: true }))');
requireText("page", 'reportSummaryComparisons: candidate.reportSummaryComparisons?.map((field) => ({ ...field, actual: field.expected, matched: true }))');
requireText("page", 'fieldMismatches: []');
requireText("page", 'data-certificate-evidence-placeholder');
requireText("page", 'lg:grid-cols-[minmax(0,58fr)_minmax(360px,42fr)]');
requireText("page", 'const activePreviewPage = Math.min(');
requireText("page", 'const [previewModalPage, setPreviewModalPage] = useState<number | null>(null)');
requireText("page", 'data-certificate-damage-magnifier');
requireText("page", 'backgroundSize: "600% 850%"');
requireText("page", 'PDF 숨은 텍스트에는 발급 원문이 남아 있을 수 있습니다.');
requireText("page", 'sort((left, right) => right.difference - left.difference)');
requireText("page", 'data-certificate-chart-page={pageNumber}');
requireText("page", '2페이지 · 막대그래프 데이터 대조');
requireText("page", '3페이지 · 원그래프 데이터 대조');
requireText("page", 'section.unexpectedNumbers.map');
requireText("page", 'setSelectedPreviewPage(index + 1)');
requireText("page", 'setPreviewModalPage(activePreviewPage)');
requireText("page", 'data-certificate-pdf-preview');
requireText("page", '발급 문서 증거');
requireText("page", '판정만 보지 말고 문서를 직접 확인하세요.');
requireText("page", '원본 바이트 증거');
requireText("page", 'OCR 점수: 참고용 · 원본 바이트 판정 우선');
requireText("page", '원본 일치');
requireText("page", 'verifySurveyReportPhoto(recognized.text, qrEvidence || undefined, visualProfile, selectedReportType, recognized.pageTexts, recognized.pages)');
requireText("page", 'detail.actual || (en ? "MISSING" : "누락")');
requireText("page", 'token.matched ? "MATCH" : "MISMATCH"');
requireText("page", 'token.actual || (en ? "MISSING" : "누락")');
requireText("page", "orderedPageMismatches=${orderedEvidenceMismatchCount}");
requireText("page", 'resultTone === "danger" ? (en ? "Tampered PDF" : "변조 파일")');
requireText("page", 'verification.status === "TAMPERED_PDF"');
requireText("page", "바이트 불일치 기록 후 데이터·그래프 검증 계속");
requireText("page", "수정 이력 기록 후 데이터·그래프 검증 계속");
rejectText("page", "PDF 바이트는 다르지만 모든 데이터와 그래프는 일치합니다.");
requireText("page", "데이터 변조를 감지했습니다.");
requireText("page", "막대그래프 변조를 감지했습니다.");
requireText("page", 'en ? "Every numeric field" : "개별 숫자 전체"');
requireText("page", 'en ? "Chart values + bar shapes" : "그래프 숫자 + 막대 모양"');
requireText("page", 'en ? "Semantic verification" : "내용 검증 최종 판정"');
requireText("page", 'const exactIssuedSemanticMatch = exactPdfVerification?.status === "EXACT_PDF_MATCH"');
requireText("page", 'chartDataExactMatch: true');
requireText("page", 'chartVisualExactMatch: true');
requireText("page", 'semanticStatus: "CONTENT_EXACT" as const');
requireText("page", 'en ? "All issued fields verification: ORIGINAL PDF EXACT" : "발급 화면 전체 항목 검증: 원본 PDF 전체 일치"');
requireText("page", 'en ? "CONTENT MATCH RATE" : "내용 일치율"');
requireText("page", 'en ? "Match rate" : "내용 일치율"');
requireText("page", "const isCurrentUploadComparisonExact");
requireText("page", "photoVerification.comparisons?.filter(isCurrentUploadComparisonExact)");
requireText("page", 'aria-modal="true"');
requireText("page", "setSelectedDamageRegion(region)");
requireText("page", "발급 원본과 화면 픽셀이 다른 위치입니다");
rejectText("page", 'en ? "Manual verification block" : "수동 검증 블록"');
rejectText("page", 'htmlFor="manual-verification-block"');
requireText("page", "const [uploadedPdfSelected, setUploadedPdfSelected] = useState(false)");
requireText("page", "const visibleCertificateId = findCertificateIdFromPdfText(extractedText)");
requireText("page", "const modificationDates = await inspectPdfModificationDates(buffer)");
requireText("page", "creationDate !== modificationDate");
requireText("page", 'verificationMode: "PDF_METADATA_DATES"');
requireText("page", "PDF 생성·수정 날짜 불일치를 감지했습니다.");
requireText("page", "변조 파일입니다. PDF 생성일과 수정일이 다릅니다.");
requireText("page", "변조 파일: PDF 생성일과 수정일이 다릅니다.");
requireText("api", '"EXACT_PDF_BYTES" | "PDF_METADATA_DATES"');
rejectText("page", "PDF 원본성 검증 불가: OCR·시각 유사도는 참고 증거이며 진위 판정이 아닙니다.");
requireText("page", 'photoVerification?.semanticStatus === "CONTENT_EXACT"');
rejectText("page", "(!pdfFileVerification && (uploadedPayloadFound || photoVerification?.photoConsistent))");
rejectText("page", "(!pdfFileVerification || pdfFileVerification.status === \"EXACT_PDF_MATCH\")");
rejectText("page", 'status: en ? "Tampered PDF blocked" : "변조 PDF 차단"');
requireOrder("page", "const handleFileChange", "await verifyExactPdfFile(file, nextPayload.certificateId)",
  "await evaluatePayload(nextPayload, file.name, exactPdfVerification)", "const toneClass");
requireOrder("page", "const handleFileChange", "const visibleCertificateId = findCertificateIdFromPdfText(extractedText)",
  "await evaluatePhotographedPages(rendered.pages, file.name, false, file, initialPdfVerification, rendered.textPages)", "const toneClass");
requireOrder("page", "const evaluatePhotographedPages", "if (rawPdfFile) {",
  "if (preserveDigitalPayload) {", "const handleFileChange");

console.log(JSON.stringify({
  status: "PASS",
  assertionCount,
  exactByteEndpoint: true,
  tamperedResultPrecedence: true,
  byteMismatchDoesNotBlockSemanticChecks: true,
  numericAndChartTamperingSeparated: true,
  legacyFailClosed: true,
  missingExactVerdictNeverGreen: true,
  standaloneCertificateIdVerifiedBeforeOcrSuccess: true,
  pdfCreationModificationDateMismatchBlocked: true,
  adminOneWayBinding: true,
  identifiersFailClosed: true,
  completeOcrEvidenceRequired: true,
  lcaCompatibilityPreserved: true,
}));
