import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

export type AdminMenuWorkspaceContract = {
  menuCode: string;
  title: string;
  titleEn: string;
  processCode: string;
  actor: string;
  objective: string;
  objectiveEn: string;
  functions: string[];
  inputs: string[];
  outputs: string[];
  nextLabel: string;
  nextRoute: string;
  surface: "PROJECT" | "SURVEY_DATA" | "SPECIALIZED";
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

function contract([menuCode, title, processCode, objective]: Seed, domain: "CARBON" | "LCA"): AdminMenuWorkspaceContract {
  const surveyCodes = new Set(["A1040103", "A1040201", "A1040202", "A1040307"]);
  return {
    menuCode,
    title,
    titleEn: title,
    processCode,
    actor: domain === "CARBON" ? "EMISSION_OPERATION_MANAGER" : "LCA_SPECIALIST",
    objective,
    objectiveEn: objective,
    functions: [`${title} 조회`, `${title} 검증`, `${title} 저장`, `${title} 이력·증거 확인`],
    inputs: ["프로젝트·제품 식별자", "담당 액터와 권한", "업무 입력값·첨부 증거"],
    outputs: ["처리 상태", "검증 결과", "다음 단계 인계 데이터"],
    nextLabel: domain === "CARBON" ? "다음 탄소배출 업무" : "다음 LCA 업무",
    nextRoute: domain === "CARBON" ? "/admin/emission/project-operations" : "/admin/emission/survey-report-verify",
    surface: domain === "CARBON" ? "PROJECT" : surveyCodes.has(menuCode) ? "SURVEY_DATA" : "SPECIALIZED",
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

export function AdminMenuWorkspaceContractPanel({ contract }: { contract: AdminMenuWorkspaceContract }) {
  const en = isEnglish();
  const cards = [
    [en ? "Help" : "도움말", en ? contract.objectiveEn : contract.objective, "help"],
    [en ? "Screen design" : "화면 설계", contract.functions.join(" · "), "design"],
    ["QA", `${contract.inputs.length} inputs → ${contract.outputs.length} outputs · actor=${contract.actor}`, "qa"],
    [en ? "Work guide" : "업무 길잡이", `${contract.processCode} → ${contract.nextLabel}`, "guide"],
  ];
  return (
    <section
      className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm"
      data-menu-code={contract.menuCode}
      data-process-code={contract.processCode}
      data-testid={`menu-workspace-${contract.menuCode}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-black text-blue-700">{contract.menuCode} · {contract.processCode}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{en ? contract.titleEn : contract.title}</h2><p className="mt-2 text-sm font-semibold text-slate-700">{en ? contract.objectiveEn : contract.objective}</p></div>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{contract.actor}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{cards.map(([title, body, kind]) => <article className="rounded-xl border bg-white p-4" data-card-kind={kind} key={kind}><strong className="text-sm text-[#052b57]">{title}</strong><p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{body}</p></article>)}</div>
      <div className="mt-4 flex flex-wrap gap-2">{contract.functions.map((feature, index) => <button className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-800" data-feature-index={index + 1} key={feature} type="button">{feature}</button>)}</div>
      <a className="mt-4 inline-flex rounded-lg bg-[#246beb] px-4 py-2 text-sm font-black text-white" href={buildLocalizedPath(contract.nextRoute, `/en${contract.nextRoute}`)}>{contract.nextLabel}</a>
    </section>
  );
}

export function AdminMenuSpecializedWorkspace({ contract }: { contract: AdminMenuWorkspaceContract }) {
  return (
    <section className="space-y-5" data-specialized-workspace={contract.menuCode}>
      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">업무 입력</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {contract.inputs.map((input, index) => (
              <label className="text-sm font-black text-slate-800" key={input}>
                {index + 1}. {input}
                <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-medium" data-work-input={index + 1} placeholder={`${input} 입력 또는 선택`} />
              </label>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-800">완료 조건</p>
          <ol className="mt-4 space-y-3">
            {contract.outputs.map((output, index) => <li className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700" data-work-output={index + 1} key={output}>{index + 1}. {output}</li>)}
          </ol>
        </article>
      </div>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">프로세스 실행</p><h3 className="mt-1 text-xl font-black text-slate-950">{contract.title} 업무 기능</h3></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">actor · {contract.actor}</span></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {contract.functions.map((feature, index) => (
            <button className="min-h-24 rounded-xl border border-blue-200 bg-blue-50 p-4 text-left text-sm font-black text-blue-950 hover:bg-blue-100" data-work-action={index + 1} key={feature} type="button"><span className="block text-xs text-blue-600">STEP {index + 1}</span><span className="mt-2 block">{feature}</span></button>
          ))}
        </div>
      </article>
    </section>
  );
}
