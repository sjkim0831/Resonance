import type { ScreenWorkContext } from "../runtime-assist/screenWorkContext";

// This card deliberately accepts no task/project state: a user's pending task
// cannot define the design of the page they happen to be viewing.
export function ScreenDesignSummary({ routePath, context, en }: {
  routePath: string;
  context?: ScreenWorkContext | null;
  en: boolean;
}) {
  const normalize = (value: string) => (value.split(/[?#]/)[0].replace(/^\/en(?=\/|$)/, "").replace(/\/+$/, "") || "/");
  const route = normalize(routePath);
  const home = route === "/" || route === "/home" || route === "/home/index";
  const certificate = route === "/home/certificate-verify";
  const candidate = context?.workflow;
  const linked = !home && !certificate && context?.linked
    && normalize(context.routePath) === route
    && [candidate?.userPath, candidate?.adminPath].some(path => path && normalize(path) === route);
  const workflow = linked ? candidate : null;
  const rows = home ? [
    [en ? "Screen" : "화면명", en ? "Platform home" : "플랫폼 홈"],
    [en ? "Purpose" : "목적", en ? "Discover services and public information" : "서비스 탐색 및 공개 정보 안내"],
    [en ? "Functions" : "기능", en ? "Search, service navigation, notices, public statistics, session-aware navigation" : "통합 검색·서비스 이동·공지·공개 통계·로그인 상태별 안내"],
    [en ? "Input" : "입력", en ? "Search terms, selected service, sign-in state" : "검색어·선택한 서비스·로그인 상태"],
    [en ? "Output" : "출력", en ? "Search results, destination page, notices and public statistics" : "검색 결과·선택한 서비스 화면·공지 및 공개 통계"],
    [en ? "Workflow" : "업무 연결", en ? "Entry screen; select a process in All workflows" : "업무 진입 화면 · 전체 업무 보기에서 프로세스 선택"],
    [en ? "Access" : "권한", en ? "Public information; protected services enforce their own permissions. Design editing requires an administrator." : "공개 정보 조회 · 보호된 업무는 이동 대상에서 권한 검사 · 설계 편집은 관리자"],
    [en ? "Exceptions" : "예외 처리", en ? "Check sign-in and role when access is denied; unavailable data must not be treated as zero." : "접근 불가 시 로그인·소속·역할 확인 · 조회 실패는 실제 0건과 구분"],
    [en ? "Boundary" : "처리 범위", en ? "No assignment, approval or completion on Home; use the actual work screen." : "홈에서 배정·결재·완료하지 않음 · 담당자·결재자 지정 및 저장은 실제 업무 화면에서 처리"],
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
