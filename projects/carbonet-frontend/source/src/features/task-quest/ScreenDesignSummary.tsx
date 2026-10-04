import type { ScreenWorkContext } from "../runtime-assist/screenWorkContext";
import { EmissionContractCard, emissionContractPage } from '../emission-common/currentEmissionContract';
import emissionScreens from '../emission-common/emission-workflow-screens.json';
import dashboardContract from '../emission-dashboard/dashboard-contract.json';
import reductionTasks from '../reduction-workflow/reduction-task-design.json';
import lcaDesign from './lca-screen-design.json';
import monitoringDesign from './monitoring-screen-design.json';
import tradeDesign from './trade-screen-design.json';

// This card deliberately accepts no task/project state: a user's pending task
// cannot define the design of the page they happen to be viewing.
export function ScreenDesignSummary({ routePath, context, en }: {
  routePath: string;
  context?: ScreenWorkContext | null;
  en: boolean;
}) {
  const normalize = (value: string) => (value.split(/[?#]/)[0].replace(/^\/en(?=\/|$)/, "").replace(/\/+$/, "") || "/");
  const route = normalize(routePath);
  const tradeGroup = tradeDesign.groups.find(g=>g.pages.some(p=>p.path===route+(typeof location==='undefined'?'':location.search))) || (route==='/admin/trade/approve'?tradeDesign.groups.find(g=>g.code==='TRADE_CONTRACT'):undefined);
  const monitoringGroup = monitoringDesign.groups.find(g=>g.pages.some(p=>p.path===route+(typeof location==='undefined'?'':location.search) || (route==='/admin/emission/validation-rule' && p.path==='/admin/emission/validation-rule?menuCode=A1070102')));
  const actualSearch = typeof location === 'undefined' ? '' : location.search;
  const lcaPath = route + actualSearch;
  const lcaMatch = (page: { path: string; legacyPath?: string }) => page.path === lcaPath || normalize(page.path) === route || (page.legacyPath ? normalize(page.legacyPath) === route : false) || (route==='/emission/lca'&&!actualSearch&&page.path==='/emission/lca?menu=H1030101');
  const lcaGroup = lcaDesign.groups.find(g=>g.pages.some(lcaMatch));
  const lcaPage = lcaGroup?.pages.find(lcaMatch);
  if (!tradeGroup && !monitoringGroup && !lcaPage && emissionContractPage(route)) return <EmissionContractCard route={route} mode="설계" />;
  const reductionTask = reductionTasks.pages.find(p=>p.path===route);
  const tab = new URLSearchParams(location.search).get('tab');
  const emissionScreen = emissionScreens.find(s=>s.path===route+(tab&&['quality','submission'].includes(tab)?'?tab='+tab:''));
  const home = route === "/" || route === "/home" || route === "/home/index";
  const certificate = route === "/home/certificate-verify";
  const projectList = route === "/emission/project_list";
  const organizationalBoundary = route === "/emission/org-boundary";
  const sourceRegister = route === "/home/emission/source-register";
  const factorReference = route === "/home/emission/factor-reference";
  const candidate = context?.workflow;
  const linked = !home && !certificate && context?.linked
    && normalize(context.routePath) === route
    && [candidate?.userPath, candidate?.adminPath].some(path => path && normalize(path) === route);
  const workflow = linked ? candidate : null;
  const rows = tradeGroup ? [
    ['프로세스', tradeGroup.name], ['절차', tradeGroup.flow],
    ['입력', tradeGroup.input], ['출력', tradeGroup.output], ['적용', tradeGroup.condition],
    ['검증', '메뉴·탐색 연결 확인. 실제 계약·이행·결제·환불·정산 E2E 미검증'],
    ['주의', '일부 관리자 메뉴는 거래 승인 공통 화면 별칭. 발급·계좌·결제 전용 기능으로 판단하지 않음'],
    ['QA', '동일 거래·계약 ID/버전, 최신 요청·승인 상태, 이행·입금·정산 증적을 각각 재조회'],
    ['다음 업무', '전체 업무 보기 → 탄소·자원 거래. 역할별·조건부 분기 선택'],
  ] : monitoringGroup ? [
    ['프로세스', monitoringGroup.name], ['절차', monitoringGroup.flow],
    ['입력', monitoringGroup.input], ['출력', monitoringGroup.output],
    ['조건', monitoringGroup.condition], ['검증', '메뉴·탐색 연결 확인. 실제 집계·저장·전송 E2E 미검증'],
    ['QA', '동일 범위·기준시각·버전으로 원본과 결과 재조회. 경보 조치·출력·공유·전송 증적은 각각 검증'],
    ['다음 업무', '전체 업무 보기 → 모니터링·분석. 필요한 조건부 업무만 선택'],
  ] : lcaGroup && lcaPage ? [
    ['화면명', lcaPage.name], ['프로세스', lcaGroup.name],
    ['절차', lcaGroup.flow], ['적용', lcaGroup.condition],
    ['입력 계약', lcaGroup.input], ['출력 계약', lcaGroup.output],
    ['역할', lcaPage.actor], ['구현 확인 범위', lcaPage.description],
    ['검증 상태', '탐색·메뉴 연결 확인 / 저장·최신 버전·승인 E2E 미검증'],
    ['QA', '동일 LCA 프로젝트·버전 → 저장 후 재조회 → 최신 검토 요청 → 확정 결과·보고서 재조회. 과거 증적으로 현재 완료를 판정하지 않음'],
    ['다음 업무', '전체 업무 보기 → 제품 LCA에서 선택. 반려 시 입력·산정으로 복귀'],
  ] : home ? [
    [en ? "Screen" : "화면명", en ? "Platform home" : "플랫폼 홈"],
    [en ? "Purpose" : "목적", en ? "Discover services and public information" : "서비스 탐색 및 공개 정보 안내"],
    [en ? "Functions" : "기능", en ? "Search, service navigation, notices, public statistics, session-aware navigation" : "통합 검색·서비스 이동·공지·공개 통계·로그인 상태별 안내"],
    [en ? "Input" : "입력", en ? "Search terms, selected service, sign-in state" : "검색어·선택한 서비스·로그인 상태"],
    [en ? "Output" : "출력", en ? "Search results, destination page, notices and public statistics" : "검색 결과·선택한 서비스 화면·공지 및 공개 통계"],
    [en ? "Workflow" : "업무 연결", en ? "Entry screen; select a process in All workflows" : "업무 진입 화면 · 전체 업무 보기에서 프로세스 선택"],
    [en ? "Access" : "권한", en ? "Public information; protected services enforce their own permissions. Design editing requires an administrator." : "공개 정보 조회 · 보호된 업무는 이동 대상에서 권한 검사 · 설계 편집은 관리자"],
    [en ? "Exceptions" : "예외 처리", en ? "Check sign-in and role when access is denied; unavailable data must not be treated as zero." : "접근 불가 시 로그인·소속·역할 확인 · 조회 실패는 실제 0건과 구분"],
    [en ? "Boundary" : "처리 범위", en ? "No assignment, approval or completion on Home; use the actual work screen." : "홈에서 배정·결재·완료하지 않음 · 담당자·결재자 지정 및 저장은 실제 업무 화면에서 처리"],
  ] : route === dashboardContract.path ? [
    ['화면명', dashboardContract.name],
    ['입력', dashboardContract.input],
    ['출력', dashboardContract.output],
    ['업무 순서', dashboardContract.steps.join(' → ')],
    ['집계 기준', dashboardContract.aggregateRule],
    ['QA 확인 항목', dashboardContract.qa.join(' · ')],
    ['처리 범위', dashboardContract.boundary],
  ] : route === '/emission/project/create' ? [
    [en ? 'Screen' : '화면명', en ? 'Emission project registration' : '배출량 프로젝트 등록'],
    [en ? 'Input' : '입력', en ? 'Name, reporting year, period, due date, sites, scopes, boundary, standard, methodology, assurance, collection cycle, materiality, optional description' : '프로젝트명·보고연도·산정 기간·마감일·사업장·Scope·조직 경계·표준·방법론 버전·검증 수준·수집 주기·중요성 기준·설명'],
    [en ? 'Output' : '출력', en ? 'Project ID, saved project criteria and site links, then project detail route' : '프로젝트 ID·산정 기준·사업장 연결 저장 후 동일 프로젝트 상세로 이동'],
    [en ? 'API' : 'API', 'POST /home/api/emission-project-drafts'],
    [en ? 'Rules' : '규칙', en ? 'Company authorization, API v2 validation, idempotent retry; accessible same-site period overlap warning does not block save' : '회사 등록 권한·API v2 검증·중복 요청 방지·조회 권한 내 동일 사업장 기간 중복 안내(저장 허용)'],
    [en ? 'Next' : '다음', en ? 'Project details; step-level owners are assigned within each work item' : '프로젝트 상세 이동 · 세부 담당자는 각 업무에서 지정'],
    [en ? 'Scope' : '범위', en ? 'No purpose field, draft-save action, or actor picker is supported by the current creation API; accountable company manager is derived by the server' : '현재 생성 API는 목적 필드·임시저장·담당자 선택을 지원하지 않으며 총괄 계정은 서버가 인증된 기업 관리자로 결정'],
  ] : projectList ? [
    [en ? "Screen" : "화면명", en ? "Emission projects" : "배출량 프로젝트 목록"],
    [en ? "Process" : "프로세스", en ? "Emission management / project selection" : "탄소배출 관리 · 프로젝트 선택"],
    [en ? "Step" : "절차", en ? "Find a project → open details → choose site work" : "프로젝트 조회 → 상세 확인 → 사업장별 업무 선택"],
    [en ? "Input" : "입력", en ? "Name, site, status, period, sort, page size" : "프로젝트명·사업장·진행 상태·산정 기간·정렬·표시 건수"],
    [en ? "Output" : "출력", en ? "Authorized project list, selected project scope and status, projectId for details" : "접근 가능한 프로젝트 목록·선택 프로젝트의 사업장/기간/상태 요약·상세로 전달할 projectId"],
    [en ? "Functions" : "기능", en ? "Search, reset, 20/50/100 rows, sorting, select a project, review its summary, open details" : "검색·초기화·20/50/100건 조회·정렬·프로젝트 선택·요약 확인·상세 이동"],
    [en ? "Access" : "권한", en ? "Session company and project access; creation separately authorized" : "로그인 회사 및 프로젝트 접근권한 적용 · 등록은 별도 권한 확인"],
    [en ? "Exceptions" : "예외", en ? "Sign-in expiry, forbidden, query failure and zero results are distinct" : "로그인 만료·권한 없음·조회 실패·0건을 구분 · 날짜 역전 차단"],
    [en ? "Boundary" : "범위", en ? "No emission input or approval here; use project details. Progress and calculation state are separate." : "이 화면에서는 배출량 입력·결재하지 않음 · 상세에서 업무 진행 · 진행 상태와 산정 상태는 별도"],
  ] : emissionScreen ? [
    ['화면명', emissionScreen.name],
    ['업무 안내', '탄소배출 관리 · 프로젝트별 업무'],
    ['할 일', emissionScreen.action],
    ['입력', emissionScreen.input],
    ['출력', emissionScreen.output],
    ['연결', route === '/emission/project/detail' ? '본문의 처리할 업무에서 대상을 선택하고 업무 화면으로 이동' : '상단 전체 업무 화면 보기에서 동일 프로젝트의 16개 화면·절차 확인'],
    ['검증 범위', '화면 연결 검증 · 업무 저장·승인 전체 검증은 별도 진행'],
  ] : reductionTask ? [
    ['화면명', reductionTask.name], ['프로세스', reductionTasks.process],
    ['처리', reductionTask.action], ['입력', reductionTask.input], ['출력', reductionTask.output],
    ['연결', reductionTasks.identity], ['QA', reductionTasks.qa], ['범위', reductionTasks.boundary],
  ] : sourceRegister ? [
    ["화면명", "배출원·시설 관리"],
    ["프로세스", "탄소배출 프로젝트 수행 · 프로젝트별 배출원 현황 확인"],
    ["절차", "접근 가능한 프로젝트 선택 → 사업장 범위 확인 → 등록 활동자료·계수 매핑 확인 → 활동자료 업무로 이동"],
    ["입력", "로그인 계정·projectId · 프로젝트 범위 활동자료 API 조회"],
    ["출력", "사업장 범위·활동자료 건수·미매핑 건수·활동자료 원장"],
    ["권한", "프로젝트 목록과 상세 활동자료는 서버 API의 현재 계정 접근 범위로 제한"],
    ["경계", "고정 설비·계측기 등록 및 교정 이력은 전용 API/저장 계약이 없어 이 화면에서 등록·수정하지 않음"],
    ["QA", "인증 상태·프로젝트 접근 범위·프로젝트 변경 시 자료 재조회·직접 URL 새로고침·0건 정상표시·API 오류 구분"],
    ["다음 업무", "활동자료 처리 → 증빙 확인·품질검사·제출"],
  ] : factorReference ? [
    ["화면명", "산정 기준·배출계수"],
    ["프로세스", "탄소배출 프로젝트 수행 · 계수 매핑·Scope 배출량 산정"],
    ["절차", "프로젝트 선택 → 접수 자료 확인 → 기준·출처·단위 확인 → 선택 사유 기록 → 배출계수 적용 → 산정 화면 이동"],
    ["입력", "접근 가능한 projectId · 활동자료별 factorId · 적용·변경 사유"],
    ["출력", "활동자료별 계수 결정·출처·단위 호환성·신뢰도·변경 이력"],
    ["권한", "프로젝트 API 범위 및 CALCULATOR 역할을 서버에서 재검증"],
    ["QA", "프로젝트·접수 버전·계수값·출처·단위·변경 사유·권한·저장 후 재조회·산정 이동 확인"],
    ["범위", "기준·계수 원본 등록과 승인은 관리자 관리 영역에서 수행"],
    ["다음 업무", "배출량 산정 → 산정 버전 생성·검증"],
  ] : organizationalBoundary ? [
    ['화면명', '조직경계·사업장 관리'],
    ['프로세스', '탄소배출 프로젝트 수행 · 조직경계 설정'],
    ['절차', '프로젝트 선택 → 경계 기준·기간 설정 → 법인·사업장 포함 판정 → 검토 요청 → 보완·확정'],
    ['입력', '접근 가능한 프로젝트, 경계 기준, 적용 기간, 선정 근거, 대상 법인·사업장, 포함·제외 사유 및 증빙'],
    ['출력', '저장된 경계 버전, 포함 사업장 목록, 검토 상태, 내부거래 제거·연결 산정 상태'],
    ['권한', '프로젝트 접근 범위와 단계별 담당 역할을 서버에서 확인'],
    ['검증', '기간·근거·대상 필수값, 제외 사유·증빙, 중복 대상, 단계 권한을 점검'],
    ['다음 업무', '활동자료 수집 또는 경계 보완·검토·확정'],
  ] : certificate ? [
    [en ? "Screen" : "화면명", en ? "Certificate authenticity verification" : "인증서 진위여부 확인"],
    [en ? "Functions" : "기능", en ? "Upload document, inspect verdict and evidence" : "문서 업로드·진위 판정·검증 근거 확인"],
    [en ? "Input" : "입력", en ? "Issued PDF or certificate page images" : "발급받은 PDF 또는 인증서 페이지 이미지"],
    [en ? "Output" : "출력", en ? "Verdict, certificate ID, issued/uploaded hashes" : "진위 판정·인증서 ID·발급 원본 및 업로드 해시"],
    [en ? "Workflow" : "업무 연결", en ? "Public verification; distinct from report issuance" : "공개 진위검증 · 보고서 발급 업무와 구분"],
  ] : [
    [en ? "Process" : "프로세스", workflow?.processName || workflow?.processCode || (en ? "No confirmed page mapping" : "확정된 화면 연결 정보 없음")],
    [en ? "Step" : "절차", workflow?.stepName || workflow?.stepCode || "—"],
    [en ? "Input" : "입력", workflow?.inputContract || (en ? "Not defined in this screen design" : "현재 화면 설계에 미정의")],
    [en ? "Output" : "출력", workflow?.outputContract || (en ? "Not defined in this screen design" : "현재 화면 설계에 미정의")],
  ];
  return <section className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3" data-screen-design-summary="">
    <h4 className="font-black text-blue-950">{en ? "Current screen design" : "현재 화면 설계"}</h4>
    <dl className="mt-2 space-y-1 text-xs leading-5 text-blue-900">
      {[[en ? "Route" : "경로", routePath.split(/[?#]/)[0]], ...rows].map(([label, value]) => <div key={label}>
        <dt className="inline font-bold">{label}: </dt><dd className="inline">{value}</dd>
      </div>)}
    </dl>
  </section>;
}
