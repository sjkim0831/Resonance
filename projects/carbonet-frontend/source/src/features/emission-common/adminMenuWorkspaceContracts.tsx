import { useEffect, useMemo, useState } from "react";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { buildResilientCsrfHeaders } from "../../lib/api/core";

export type AdminMenuWorkspaceContract = {
  menuCode: string;
  title: string;
  titleEn: string;
  processCode: string;
  actor: string;
  objective: string;
  objectiveEn: string;
  functions: string[];
  functionRoutes: string[];
  inputs: string[];
  outputs: string[];
  nextLabel: string;
  nextRoute: string;
  surface: "PROJECT" | "SURVEY_DATA" | "SPECIALIZED";
  steps: string[];
  fieldSchema: Array<{ key: string; label: string; type: "text" | "number" | "date" | "select" | "file" | "table"; required: boolean }>;
  actors: Array<{ code: string; responsibility: string }>;
  completionEvidence: string[];
};

type Seed = [string, string, string, string];

const carbonSeeds: Seed[] = [
  ["A1030102", "프로젝트 상세", "PROJECT_DETAIL", "프로젝트 기본정보·범위·기간을 확인하고 변경 이력을 관리"],
  ["A1030103", "진행 현황", "PROJECT_PROGRESS", "단계별 진척률·지연·차단 사유를 추적"],
  ["A1030104", "담당자 배정", "ACTOR_ASSIGNMENT", "계정·액터·역할·데이터 범위를 프로젝트에 배정"],
  ["A1030105", "마감·지연 관리", "DEADLINE_CONTROL", "마감일·SLA·지연 업무와 조치 책임자를 관리"],
  ["A1030106", "프로젝트 확정·해제", "PROJECT_AUTHORITY", "프로젝트 확정·해제 조건과 승인 증거를 검증"],
  ["A1030110", "배출량 프로젝트 운영", "EMISSION_PROJECT_OPERATION", "프로젝트 전체 단계와 다음 필수 업무를 통합 운영"],
  ["A1030201", "활동자료 제출 현황", "ACTIVITY_SUBMISSION", "사업장별 활동자료 제출·누락·보완 상태를 관리"],
  ["A1030202", "엑셀 업로드 관리", "ACTIVITY_IMPORT", "업로드 파일의 구조·행·단위·오류를 검증하고 반영"],
  ["A1030203", "증빙자료 관리", "EVIDENCE_MANAGEMENT", "활동자료와 증빙 파일의 연결·유효성·보존 상태를 관리"],
  ["A1030204", "데이터 요청 양식", "DATA_REQUEST", "담당자에게 필요한 데이터와 제출기한을 요청"],
  ["A1030205", "외부 연계 현황", "EXTERNAL_INTEGRATION", "외부 시스템 연계·수신·재처리 상태를 점검"],
  ["A1030301", "검증 대기열", "VALIDATION_QUEUE", "검증 대상의 우선순위·담당 검토자·대기시간을 관리"],
  ["A1030302", "오류·보완 관리", "CORRECTION_MANAGEMENT", "필드 오류·보완 요청·수정 결과를 추적"],
  ["A1030303", "승인 대기", "APPROVAL_QUEUE", "승인 조건·검토 증거·승인자를 확인하고 처리"],
  ["A1030304", "반려·재제출", "RESUBMISSION", "반려 사유와 수정 항목을 신청자에게 전달하고 재제출"],
  ["A1030305", "승인 이력", "APPROVAL_HISTORY", "승인·반려·재검토 이력을 감사 증거로 조회"],
  ["A10304", "결과·보고", "RESULT_REPORTING", "산정 결과에서 보고·인증까지 완료 상태를 통합 확인"],
  ["A1030401", "산정 결과", "CALCULATION_RESULT", "Scope별 배출량·계수·합계와 계산 근거를 검증"],
  ["A1030402", "보고서 관리", "REPORT_MANAGEMENT", "보고서 생성·검토·제출·버전 상태를 관리"],
  ["A1030404", "인증서 발급", "CERTIFICATE_ISSUANCE", "승인된 결과의 인증서 발급·취소·재발급을 관리"],
  ["A1030405", "보고서 진위 확인", "REPORT_VERIFICATION", "PDF·OCR·식별값·표·차트 변조를 검증"],
];

const lcaSeeds: Seed[] = [
  ["A104", "LCA 운영", "LCA_OPERATION", "LCA 프로젝트·데이터·산정·보고 전체 상태를 운영"],
  ["A10401", "LCA 프로젝트", "LCA_PROJECT", "제품 LCA 프로젝트의 범위·담당자·완료도를 관리"],
  ["A1040101", "LCA 프로젝트 관리", "LCA_PROJECT_MANAGEMENT", "LCA 프로젝트 기본정보·기능단위·시스템 경계를 관리"],
  ["A1040102", "제품·공정 관리", "LCA_PRODUCT_PROCESS", "제품·공정·투입·산출 관계를 구성"],
  ["A1040103", "데이터 수집 현황", "LCA_DATA_COLLECTION", "공정별 데이터 수집·누락·검토 상태를 확인"],
  ["A1040104", "검토·승인", "LCA_REVIEW_APPROVAL", "LCA 데이터와 결과의 검토·승인·반려를 처리"],
  ["A1040201", "업로드 데이터셋", "LCA_DATASET_IMPORT", "업로드 데이터셋의 컬럼·단위·행 오류를 검증"],
  ["A1040202", "물질 매핑", "LCA_MATERIAL_MAPPING", "원료·배출물과 ecoinvent 데이터셋을 매핑"],
  ["A1040203", "LCI 분류", "LCA_LCI_CLASSIFICATION", "LCI 항목을 투입·산출·영향범주로 분류"],
  ["A1040204", "LCI 데이터베이스", "LCA_LCI_DATABASE", "LCI 데이터셋의 출처·버전·지역·품질을 관리"],
  ["A1040205", "제품·부산물 기준", "LCA_ALLOCATION", "제품·부산물 배분 기준과 계산 근거를 관리"],
  ["A1040206", "기능 단위·시스템 경계", "LCA_SCOPE", "기능 단위와 cradle-to-gate 경계를 확정"],
  ["A1040301", "산정 결과", "LCA_CALCULATION_RESULT", "LCI 산정값·정규화·배분 결과를 검증"],
  ["A1040302", "영향평가 결과", "LCA_IMPACT_ASSESSMENT", "영향범주별 결과·기여도·민감도를 분석"],
  ["A1040303", "검토·확정", "LCA_RESULT_CONFIRMATION", "결과 검토·이슈 해소·확정 권한을 처리"],
  ["A1040304", "보고서 생성", "LCA_REPORT_GENERATION", "확정 결과로 LCA 보고서를 생성하고 버전을 관리"],
  ["A1040305", "보고서 양식", "LCA_REPORT_TEMPLATE", "LCA 보고서 섹션·표·차트·표준 문구를 관리"],
  ["A1040306", "진위 확인", "LCA_REPORT_VERIFICATION", "LCA PDF의 식별값·데이터·차트·페이지를 검증"],
  ["A1040307", "LCA 데이터 수집", "LCA_SURVEY_DATA", "제품·공정별 원료·에너지·배출·폐기물 데이터를 입력"],
];

type LcaDetail = {
  steps: string[];
  fields: Array<[string, string, AdminMenuWorkspaceContract["fieldSchema"][number]["type"]]>;
  actors: Array<[string, string]>;
  evidence: string[];
};

const lcaDetail = (steps: string[], fields: LcaDetail["fields"], actors: LcaDetail["actors"], evidence: string[]): LcaDetail => ({ steps, fields, actors, evidence });
const LCA_WORKSPACE_DETAILS: Record<string, LcaDetail> = {
  LCA_OPERATION: lcaDetail(["프로젝트 접수", "데이터 준비", "산정·검토", "보고·인증"], [["portfolioId", "LCA 포트폴리오", "select"], ["reportingPeriod", "보고 기간", "date"], ["priority", "업무 우선순위", "select"], ["blockingIssue", "차단 사유", "text"]], [["LCA_PROGRAM_MANAGER", "전체 일정·SLA 책임"], ["LCA_SPECIALIST", "기술 업무 수행"], ["LCA_APPROVER", "최종 완료 승인"]], ["단계별 완료율", "미완료·지연 목록", "승인된 LCA 결과"]),
  LCA_PROJECT: lcaDetail(["신청", "범위 정의", "담당 배정", "착수 승인"], [["projectName", "프로젝트명", "text"], ["productFamily", "제품군", "text"], ["standard", "적용 표준", "select"], ["targetDate", "목표 완료일", "date"]], [["LCA_PROJECT_OWNER", "프로젝트 신청·책임"], ["LCA_SPECIALIST", "범위 기술 검토"], ["LCA_APPROVER", "착수 승인"]], ["프로젝트 식별번호", "승인된 범위", "담당자 배정 이력"]),
  LCA_PROJECT_MANAGEMENT: lcaDetail(["기본정보", "기능단위", "시스템 경계", "기준선 확정"], [["functionalUnit", "기능단위", "text"], ["referenceFlow", "기준흐름", "number"], ["boundaryType", "시스템 경계", "select"], ["cutoffRule", "Cut-off 기준", "text"]], [["LCA_SPECIALIST", "기본 설계 작성"], ["LCA_METHOD_REVIEWER", "방법론 검토"], ["LCA_APPROVER", "기준선 확정"]], ["기능단위 버전", "경계 다이어그램", "방법론 승인 기록"]),
  LCA_PRODUCT_PROCESS: lcaDetail(["제품 등록", "공정 구성", "투입·산출 연결", "공정망 검증"], [["productCode", "제품 코드", "text"], ["processName", "공정명", "text"], ["processType", "공정 유형", "select"], ["flowTable", "투입·산출 흐름", "table"]], [["LCA_PROCESS_MODELER", "제품·공정 모델링"], ["SITE_DATA_OWNER", "현장 데이터 확인"], ["LCA_METHOD_REVIEWER", "공정망 검증"]], ["제품-공정 그래프", "미연결 흐름 0건", "공정망 검증 해시"]),
  LCA_DATA_COLLECTION: lcaDetail(["요청", "수집", "누락 점검", "제출 확정"], [["siteId", "사업장", "select"], ["collectionPeriod", "수집 기간", "date"], ["requiredDataset", "필수 데이터셋", "select"], ["evidenceFiles", "증빙 파일", "file"]], [["LCA_SPECIALIST", "수집 항목 정의"], ["SITE_DATA_OWNER", "원천 데이터 제출"], ["LCA_DATA_REVIEWER", "누락·품질 검토"]], ["제출률", "누락 항목 목록", "증빙 파일 해시"]),
  LCA_REVIEW_APPROVAL: lcaDetail(["검토 배정", "기술 검토", "보완·재제출", "승인"], [["reviewTarget", "검토 대상", "select"], ["reviewChecklist", "검토 체크리스트", "table"], ["reviewOpinion", "검토 의견", "text"], ["decision", "승인 결정", "select"]], [["LCA_DATA_REVIEWER", "데이터 검토"], ["LCA_METHOD_REVIEWER", "방법론 검토"], ["LCA_APPROVER", "승인·반려 결정"]], ["체크리스트 결과", "보완 이력", "전자 승인 기록"]),
  LCA_DATASET_IMPORT: lcaDetail(["파일 접수", "스키마 검사", "행·단위 검사", "반영"], [["datasetFile", "데이터셋 파일", "file"], ["schemaVersion", "스키마 버전", "select"], ["duplicatePolicy", "중복 처리", "select"], ["validationRows", "검증 결과", "table"]], [["SITE_DATA_OWNER", "파일 제출"], ["LCA_DATA_STEWARD", "스키마·품질 관리"], ["LCA_DATA_REVIEWER", "반영 승인"]], ["파일 SHA-256", "행별 오류 보고서", "반영 건수"]),
  LCA_MATERIAL_MAPPING: lcaDetail(["미매핑 조회", "후보 검색", "데이터셋 선택", "매핑 확정"], [["materialName", "원료·배출물", "text"], ["flowDirection", "투입·산출 구분", "select"], ["ecoinventDataset", "ecoinvent 데이터셋", "select"], ["mappingRationale", "선정 근거", "text"]], [["LCA_DATA_STEWARD", "후보 검색·매핑"], ["LCA_SPECIALIST", "기술 적합성 검토"], ["LCA_METHOD_REVIEWER", "매핑 확정"]], ["매핑 ID", "데이터셋 버전", "선정 근거·AI 순위"]),
  LCA_LCI_CLASSIFICATION: lcaDetail(["항목 로드", "흐름 분류", "영향범주 연결", "분류 확정"], [["inventoryFlow", "LCI 흐름", "text"], ["flowClass", "흐름 분류", "select"], ["impactCategory", "영향범주", "select"], ["classificationNote", "분류 근거", "text"]], [["LCA_SPECIALIST", "LCI 분류"], ["LCA_METHOD_REVIEWER", "영향범주 검토"], ["LCA_APPROVER", "분류 기준 승인"]], ["분류 코드", "영향범주 연결표", "검토 이력"]),
  LCA_LCI_DATABASE: lcaDetail(["데이터셋 등록", "메타데이터 검증", "버전 발행", "사용 승인"], [["datasetName", "데이터셋명", "text"], ["geography", "지역", "select"], ["datasetVersion", "버전", "text"], ["qualityScore", "데이터 품질 점수", "number"]], [["LCA_DATA_STEWARD", "데이터셋 등록·버전 관리"], ["LCA_METHOD_REVIEWER", "품질 검토"], ["LCA_APPROVER", "사용 승인"]], ["불변 데이터셋 ID", "출처·라이선스", "품질 평가표"]),
  LCA_ALLOCATION: lcaDetail(["공동생산 확인", "배분 기준 선택", "배분율 계산", "기준 확정"], [["coProduct", "제품·부산물", "table"], ["allocationMethod", "배분 방법", "select"], ["allocationBasis", "배분 기준값", "number"], ["allocationRatio", "배분율", "number"]], [["LCA_SPECIALIST", "배분 모델 작성"], ["FINANCE_DATA_OWNER", "경제가치 근거 확인"], ["LCA_METHOD_REVIEWER", "배분 기준 승인"]], ["배분율 합계 100%", "계산식", "민감도 비교"]),
  LCA_SCOPE: lcaDetail(["목적 정의", "기능단위 확정", "경계 설정", "Cut-off 승인"], [["studyGoal", "평가 목적", "text"], ["functionalUnit", "기능단위", "text"], ["systemBoundary", "시스템 경계", "select"], ["excludedFlow", "제외 흐름과 근거", "table"]], [["LCA_PROJECT_OWNER", "평가 목적 제시"], ["LCA_SPECIALIST", "범위 설계"], ["LCA_METHOD_REVIEWER", "범위 승인"]], ["Goal & Scope 문서", "경계 포함·제외표", "Cut-off 충족 증거"]),
  LCA_CALCULATION_RESULT: lcaDetail(["계산 실행", "질량수지", "배분·정규화", "결과 잠금"], [["calculationVersion", "산정 버전", "select"], ["referenceAmount", "기준 수량", "number"], ["normalizationMethod", "정규화 방식", "select"], ["resultTable", "LCI 산정 결과", "table"]], [["LCA_SPECIALIST", "계산 실행·결과 해석"], ["LCA_METHOD_REVIEWER", "계산 검증"], ["LCA_APPROVER", "결과 버전 잠금"]], ["재현 가능한 계산 해시", "질량수지 오차", "잠금 결과 버전"]),
  LCA_IMPACT_ASSESSMENT: lcaDetail(["LCIA 방법 선택", "특성화", "기여도 분석", "민감도 검증"], [["lciaMethod", "LCIA 방법론", "select"], ["impactCategories", "영향범주", "table"], ["scenario", "민감도 시나리오", "select"], ["contributionCutoff", "기여도 표시 기준", "number"]], [["LCA_SPECIALIST", "영향평가 실행"], ["LCA_METHOD_REVIEWER", "방법론·결과 검토"], ["LCA_APPROVER", "영향평가 확정"]], ["범주별 특성화 결과", "기여도 그래프", "민감도 결과"]),
  LCA_RESULT_CONFIRMATION: lcaDetail(["결과 접수", "이슈 등록", "이슈 해소", "결과 확정"], [["resultVersion", "결과 버전", "select"], ["reviewIssue", "검토 이슈", "table"], ["resolution", "조치 결과", "text"], ["finalDecision", "확정 결정", "select"]], [["LCA_SPECIALIST", "결과 제출·조치"], ["LCA_CRITICAL_REVIEWER", "독립 검토"], ["LCA_APPROVER", "결과 확정"]], ["이슈 0건", "독립 검토 의견", "확정 서명"]),
  LCA_REPORT_GENERATION: lcaDetail(["결과 선택", "보고서 구성", "PDF 생성", "발행"], [["confirmedResult", "확정 결과", "select"], ["reportLanguage", "보고서 언어", "select"], ["includedCharts", "포함 차트", "table"], ["reportVersion", "보고서 버전", "text"]], [["LCA_REPORT_AUTHOR", "보고서 작성"], ["LCA_SPECIALIST", "내용 검토"], ["LCA_APPROVER", "보고서 발행"]], ["PDF SHA-256", "데이터 스냅샷", "발행 이력"]),
  LCA_REPORT_TEMPLATE: lcaDetail(["양식 선택", "섹션 편집", "표·차트 배치", "양식 배포"], [["templateName", "양식명", "text"], ["standardVersion", "표준 버전", "select"], ["sectionLayout", "섹션 구성", "table"], ["chartRules", "차트 규칙", "table"]], [["LCA_REPORT_AUTHOR", "양식 설계"], ["DESIGN_SYSTEM_MANAGER", "KRDS·공통 컴포넌트 검토"], ["LCA_APPROVER", "양식 배포 승인"]], ["양식 JSON", "미리보기 이미지", "배포 버전"]),
  LCA_REPORT_VERIFICATION: lcaDetail(["PDF 접수", "식별값 검증", "데이터·차트 비교", "진위 판정"], [["reportFile", "검증 PDF", "file"], ["certificateId", "인증서 ID", "text"], ["reportFingerprint", "리포트 SHA-256", "text"], ["integrityCode", "무결성 코드", "text"]], [["REPORT_VERIFIER", "진위 검증 수행"], ["LCA_SPECIALIST", "불일치 해석"], ["AUDIT_MANAGER", "변조 사건 처리"]], ["페이지 수 동적 검증", "필드·표·차트 비교표", "최종 진위 판정"]),
  LCA_SURVEY_DATA: lcaDetail(["제품 선택", "공정별 입력", "증빙 연결", "제출"], [["productId", "제품", "select"], ["processId", "공정", "select"], ["inventoryRows", "원료·에너지·배출·폐기물", "table"], ["sourceEvidence", "출처 증빙", "file"]], [["SITE_DATA_OWNER", "원천 데이터 입력"], ["LCA_DATA_STEWARD", "단위·출처 검증"], ["LCA_SPECIALIST", "데이터 제출 확정"]], ["입력 행 수", "단위 변환 결과", "제출 스냅샷"]),
};

function contract([menuCode, title, processCode, objective]: Seed, domain: "CARBON" | "LCA"): AdminMenuWorkspaceContract {
  const surveyCodes = new Set(["A1040103", "A1040201", "A1040202", "A1040307"]);
  const primaryRoute = (() => {
    if (/VERIFICATION/.test(processCode)) return "/admin/emission/survey-report-verify";
    if (/REPORT_TEMPLATE/.test(processCode)) return "/admin/emission/report-template";
    if (/REPORT/.test(processCode)) return "/admin/emission/survey-report";
    if (/RESULT|CALCULATION|IMPACT/.test(processCode)) return "/admin/emission/result_list";
    if (/EVIDENCE/.test(processCode)) return "/admin/emission/evidence-management";
    if (/HISTORY/.test(processCode)) return "/admin/emission/data_history";
    if (/LCI_CLASSIFICATION/.test(processCode)) return "/admin/emission/lci-classification";
    if (/MATERIAL_MAPPING|LCI_DATABASE/.test(processCode)) return "/admin/emission/ecoinvent";
    if (/DATASET_IMPORT|DATA_COLLECTION|SURVEY_DATA/.test(processCode)) return "/admin/emission/survey-admin-data";
    return domain === "CARBON" ? "/admin/emission/project-operations" : "/admin/emission/survey-admin";
  })();
  const detail = domain === "LCA" ? LCA_WORKSPACE_DETAILS[processCode] : undefined;
  return {
    menuCode,
    title,
    titleEn: title,
    processCode,
    actor: domain === "CARBON" ? "EMISSION_OPERATION_MANAGER" : "LCA_SPECIALIST",
    objective,
    objectiveEn: objective,
    functions: [`${title} 조회`, `${title} 검증`, `${title} 저장`, `${title} 이력·증거 확인`],
    functionRoutes: [primaryRoute, "/admin/emission/validate", primaryRoute, "/admin/emission/data_history"],
    inputs: ["프로젝트·제품 식별자", "담당 액터와 권한", "업무 입력값·첨부 증거"],
    outputs: ["처리 상태", "검증 결과", "다음 단계 인계 데이터"],
    nextLabel: domain === "CARBON" ? "다음 탄소배출 업무" : "다음 LCA 업무",
    nextRoute: domain === "CARBON" ? "/admin/emission/project-operations" : "/admin/emission/survey-report-verify",
    surface: domain === "CARBON" ? "PROJECT" : surveyCodes.has(menuCode) ? "SURVEY_DATA" : "SPECIALIZED",
    steps: detail?.steps || ["업무 접수", "입력·처리", "검증", "완료·인계"],
    fieldSchema: (detail?.fields || [["workId", "업무 식별자", "text"], ["evidence", "업무 증거", "file"]]).map(([key, label, type]) => ({ key, label, type, required: true })),
    actors: (detail?.actors || [[domain === "CARBON" ? "EMISSION_OPERATION_MANAGER" : "LCA_SPECIALIST", "업무 수행"]]).map(([code, responsibility]) => ({ code, responsibility })),
    completionEvidence: detail?.evidence || ["처리 상태", "검증 결과", "감사 이력"],
  };
}

const contracts = [...carbonSeeds.map((seed) => contract(seed, "CARBON")), ...lcaSeeds.map((seed) => contract(seed, "LCA"))];
export const ADMIN_EMISSION_MENU_WORKSPACES = Object.fromEntries(contracts.map((item) => [item.menuCode, item]));

export function currentAdminMenuCode(fallback: string) {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get("menuCode")?.toUpperCase() || fallback;
}

export function resolveAdminMenuWorkspace(menuCode: string, fallback: string) {
  return ADMIN_EMISSION_MENU_WORKSPACES[menuCode] || ADMIN_EMISSION_MENU_WORKSPACES[fallback];
}

export function AdminMenuSpecializedWorkspace({ contract }: { contract: AdminMenuWorkspaceContract }) {
  const [businessKey, setBusinessKey] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([]);
  const [runtimeMessage, setRuntimeMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const endpoint = useMemo(() => `/admin/emission/api/lca-workspaces/${encodeURIComponent(contract.processCode)}`, [contract.processCode]);

  const loadRecords = async () => {
    const response = await fetch(endpoint, { credentials: "include", cache: "no-store", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } });
    const body = await response.json().catch(() => ({})) as { records?: Array<Record<string, unknown>>; message?: string };
    if (!response.ok) throw new Error(body.message || `LCA workspace load failed (${response.status})`);
    setRecords(Array.isArray(body.records) ? body.records : []);
  };

  useEffect(() => {
    setBusinessKey("");
    setValues({});
    setRuntimeMessage("");
    void loadRecords().catch((error) => setRuntimeMessage(error instanceof Error ? error.message : "LCA 업무 목록을 불러오지 못했습니다."));
  }, [endpoint]);

  const saveWorkspace = async () => {
    if (!businessKey.trim()) { setRuntimeMessage("업무 식별자를 입력하세요."); return; }
    const missing = contract.fieldSchema.filter((field) => field.required && String(values[field.key] ?? "").trim() === "");
    if (missing.length) { setRuntimeMessage(`필수 입력 누락: ${missing.map((field) => field.label).join(", ")}`); return; }
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST", credentials: "include",
        headers: await buildResilientCsrfHeaders({ "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }),
        body: JSON.stringify({ businessKey: businessKey.trim(), assignedActor: contract.actors[0]?.code || contract.actor, payload: values })
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message || `LCA workspace save failed (${response.status})`);
      await loadRecords();
      setRuntimeMessage("DB 저장과 감사 버전 생성이 완료되었습니다.");
    } catch (error) {
      setRuntimeMessage(error instanceof Error ? error.message : "LCA 업무 저장에 실패했습니다.");
    } finally { setSaving(false); }
  };

  const executeCommand = async (record: Record<string, unknown>, command: string) => {
    const workspaceId = String(record.workspaceId || "");
    if (!workspaceId) return;
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(workspaceId)}/commands`, {
        method: "POST", credentials: "include",
        headers: await buildResilientCsrfHeaders({ "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }),
        body: JSON.stringify({ command, evidence: { screen: contract.menuCode, process: contract.processCode } })
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message || `LCA command failed (${response.status})`);
      await loadRecords();
      setRuntimeMessage(`${command} 상태 전이가 완료되었습니다.`);
    } catch (error) { setRuntimeMessage(error instanceof Error ? error.message : "상태 전이에 실패했습니다."); }
  };

  const commandsFor = (status: string) => status === "DRAFT" ? ["VALIDATE"] : status === "VALIDATED" ? ["REOPEN", "SUBMIT"] : status === "SUBMITTED" ? ["APPROVE", "REJECT"] : status === "REJECTED" ? ["REOPEN"] : [];
  return (
    <section className="space-y-5" data-specialized-workspace={contract.menuCode}>
      <article className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm" data-lca-process-flow={contract.processCode}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">업무 프로세스</p><h3 className="mt-1 text-xl font-black text-slate-950">{contract.title} 단계·책임·완료 계약</h3></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">DESIGN READY · {contract.steps.length} STEPS</span>
        </div>
        <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {contract.steps.map((step, index) => (
            <li className="relative rounded-xl border border-blue-100 bg-blue-50 p-4" data-process-step={index + 1} key={step}>
              <span className="text-xs font-black text-blue-600">STEP {index + 1}</span>
              <strong className="mt-2 block text-sm text-slate-950">{step}</strong>
            </li>
          ))}
        </ol>
      </article>
      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">업무 입력</p>
          <label className="mt-4 block text-sm font-black text-slate-800">업무 식별자<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" data-business-key onChange={(event) => setBusinessKey(event.target.value)} placeholder={`${contract.processCode}-업무번호`} value={businessKey} /></label>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {contract.fieldSchema.map((field, index) => (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-800" data-field-key={field.key} data-field-type={field.type} data-work-input={index + 1} key={field.key}>
                {index + 1}. {field.label}
                <span className="mt-2 block text-xs font-semibold text-slate-500">{field.type.toUpperCase()} · {field.required ? "필수" : "선택"} · JSON key={field.key}</span>
                {field.type === "file" ? <input className="mt-3 block w-full text-xs" onChange={(event) => { const file = event.target.files?.[0]; setValues((current) => ({ ...current, [field.key]: file ? { name: file.name, size: file.size, type: file.type } : "" })); }} type="file" />
                  : field.type === "table" ? <textarea className="mt-3 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium" onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder="행 데이터를 JSON 또는 표 형식으로 입력" value={String(values[field.key] ?? "")} />
                  : <input className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium" onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={String(values[field.key] ?? "")} />}
              </div>
            ))}
          </div>
          <button className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50" data-lca-save disabled={saving} onClick={() => void saveWorkspace()} type="button">{saving ? "DB 저장 중..." : "업무 DB 저장"}</button>
          {runtimeMessage ? <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700" data-lca-runtime-message>{runtimeMessage}</p> : null}
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-800">완료 조건</p>
          <ol className="mt-4 space-y-3">
            {contract.completionEvidence.map((output, index) => <li className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700" data-work-output={index + 1} key={output}>{index + 1}. {output}</li>)}
          </ol>
        </article>
      </div>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-lca-record-count={records.length}>
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">저장·상태 전이</p><h3 className="mt-1 text-xl font-black text-slate-950">실제 업무 레코드</h3></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{records.length}건</span></div>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b"><th className="px-3 py-2">업무 식별자</th><th className="px-3 py-2">상태</th><th className="px-3 py-2">담당 액터</th><th className="px-3 py-2">버전</th><th className="px-3 py-2">명령</th></tr></thead><tbody>{records.map((record) => { const status = String(record.workflowStatus || ""); return <tr className="border-b" data-lca-record={record.workspaceId} key={String(record.workspaceId)}><td className="px-3 py-3 font-bold">{String(record.businessKey || "")}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black">{status}</span></td><td className="px-3 py-3">{String(record.assignedActor || "")}</td><td className="px-3 py-3">v{String(record.version || "")}</td><td className="px-3 py-3"><div className="flex gap-2">{commandsFor(status).map((command) => <button className="rounded border border-blue-200 px-2 py-1 text-xs font-black text-blue-800" data-lca-command={command} key={command} onClick={() => void executeCommand(record, command)} type="button">{command}</button>)}</div></td></tr>; })}{records.length === 0 ? <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={5}>저장된 업무가 없습니다.</td></tr> : null}</tbody></table></div>
      </article>
      <article className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm" data-actor-relay-count={contract.actors.length}>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-800">계정·액터 릴레이</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {contract.actors.map((actor, index) => (
            <div className="rounded-xl border border-violet-100 bg-white p-4" data-actor-code={actor.code} key={actor.code}>
              <span className="text-xs font-black text-violet-600">ACTOR {index + 1}</span>
              <strong className="mt-1 block text-sm text-slate-950">{actor.code}</strong>
              <p className="mt-2 text-xs font-semibold text-slate-600">{actor.responsibility}</p>
            </div>
          ))}
        </div>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">프로세스 실행</p><h3 className="mt-1 text-xl font-black text-slate-950">{contract.title} 업무 기능</h3></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">actor · {contract.actor}</span></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {contract.functions.map((feature, index) => (
            <a className="min-h-24 rounded-xl border border-blue-200 bg-blue-50 p-4 text-left text-sm font-black text-blue-950 hover:bg-blue-100" data-work-action={index + 1} href={`${buildLocalizedPath(contract.functionRoutes[index], `/en${contract.functionRoutes[index]}`)}?menuCode=${encodeURIComponent(contract.menuCode)}&workspaceAction=${index + 1}`} key={feature}><span className="block text-xs text-blue-600">STEP {index + 1}</span><span className="mt-2 block">{feature}</span><span className="mt-2 block text-xs text-blue-700">실제 기능 화면 열기 →</span></a>
          ))}
        </div>
      </article>
    </section>
  );
}
