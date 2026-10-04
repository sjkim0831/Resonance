import {CommonSearchSection} from '../../components/common-design/CommonSearchSection';
import {
  UserPortalFooter
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { FormEvent, useCallback, useEffect, useState } from "react";

type RelayItem = { request_id: string; target_user_id: string; before_author_code: string; requested_author_code: string; status: string; requested_by?: string; assigned_by?: string; verified_by?: string; approved_by?: string };
type InviteActor={value:string;label:string};

const WORKFLOWS = {
  ko: [
    {
      id: "workflow-1",
      tone: "emerald",
      tag: "신규 등록",
      meta: "3 / 4 단계",
      title: "박민재 (공정관리팀) 시스템 권한 부여",
      action: "다음 단계 진행",
      actionVariant: "primary",
      icon: "how_to_reg",
      steps: ["등록", "교육", "승인", "발령"],
      activeIndex: 2
    },
    {
      id: "workflow-2",
      tone: "rose",
      tag: "퇴직 처리",
      meta: "긴급",
      title: "최영희 (울산 센터) 데이터 이관 대기",
      action: "상태 확인",
      actionVariant: "secondary",
      icon: "person_remove",
      steps: ["공지", "자산 회수", "종료"],
      activeIndex: 1
    }
  ],
  en: [
    {
      id: "workflow-1",
      tone: "emerald",
      tag: "Onboarding",
      meta: "Step 3 of 4",
      title: "Park Min-jae (Process Team) system access grant",
      action: "Perform next step",
      actionVariant: "primary",
      icon: "how_to_reg",
      steps: ["Registration", "Training", "Approval", "Appointment"],
      activeIndex: 2
    },
    {
      id: "workflow-2",
      tone: "rose",
      tag: "Offboarding",
      meta: "Urgent",
      title: "Choi Young-hee (Ulsan Center) pending data transfer",
      action: "Check status",
      actionVariant: "secondary",
      icon: "person_remove",
      steps: ["Notice", "Asset Return", "Closure"],
      activeIndex: 1
    }
  ]
};

const LIFECYCLE_CARDS = {
  ko: [
    {
      id: "staff-1",
      name: "김철수",
      subtitle: "포항 플랜트 1 · 총괄 관리자",
      status: "재직",
      tone: "emerald",
      metricLabel: "권한 성숙도",
      metricValue: "100%",
      actions: ["권한 조정", "인수인계"],
      insightTitle: "갱신 필요 (D-15)",
      insightBody: "연간 보안 서약과 시스템 재인증 갱신 기한이 도래했습니다."
    },
    {
      id: "staff-2",
      name: "이지은",
      subtitle: "울산 화학기지 3 · 산정 담당",
      status: "온보딩",
      tone: "amber",
      metricLabel: "온보딩 진행률",
      metricValue: "65%",
      actions: ["프로세스 계속", "서류 확인"],
      insightTitle: "필수 교육 미이수",
      insightBody: "'L3 데이터 산정 숙련 교육'이 완료되지 않아 시스템 승인 단계가 보류 중입니다."
    },
    {
      id: "staff-3",
      name: "박지성",
      subtitle: "광양 에너지센터 2 · 검증 담당",
      status: "전환",
      tone: "slate",
      metricLabel: "이관율",
      metricValue: "88%",
      actions: ["수료 확인", "최종 종료"],
      insightTitle: "이관 검토 완료",
      insightBody: "모든 관리 기록이 후임자에게 성공적으로 이관되었습니다."
    }
  ],
  en: [
    {
      id: "staff-1",
      name: "Kim Cheol-su",
      subtitle: "Pohang Plant 1 · General Manager",
      status: "Active",
      tone: "emerald",
      metricLabel: "Permission maturity",
      metricValue: "100%",
      actions: ["Adjust role", "Handover"],
      insightTitle: "Renewal required (D-15)",
      insightBody: "The deadline for annual security pledge renewal and system re-authentication is approaching."
    },
    {
      id: "staff-2",
      name: "Lee Ji-eun",
      subtitle: "Ulsan Base 3 · Calculation Staff",
      status: "Onboarding",
      tone: "amber",
      metricLabel: "Onboarding progress",
      metricValue: "65%",
      actions: ["Continue process", "Documents"],
      insightTitle: "Missing mandatory training",
      insightBody: "System approval is blocked until the L3 data calculation training is completed."
    },
    {
      id: "staff-3",
      name: "Park Ji-sung",
      subtitle: "Gwangyang Energy Center 2 · Verifier",
      status: "Transition",
      tone: "slate",
      metricLabel: "Transfer rate",
      metricValue: "88%",
      actions: ["Certificate", "Final exit"],
      insightTitle: "Transfer review complete",
      insightBody: "All management records were successfully handed over to the successor."
    }
  ]
};

const STAFF_TABLE = {
  ko: [
    {
      id: "row-1",
      initials: "최",
      name: "최강현",
      role: "안전환경 / 담당",
      detail: "데이터 수집 및 검증",
      facilities: "포항 1, 파주 데이터센터",
      security: "Level 2",
      status: "재직"
    },
    {
      id: "row-2",
      initials: "한",
      name: "한소희",
      role: "광양 센터 / 관리자",
      detail: "인증 총괄",
      facilities: "광양 에너지센터 2",
      security: "Level 3",
      status: "권한 변경"
    }
  ],
  en: [
    {
      id: "row-1",
      initials: "C",
      name: "Choi Kang-hyun",
      role: "Safety & Env / Staff",
      detail: "Data collection and verification",
      facilities: "Pohang 1, Paju Data Center",
      security: "Level 2",
      status: "Active"
    },
    {
      id: "row-2",
      initials: "H",
      name: "Han So-hee",
      role: "Gwangyang Center / Manager",
      detail: "Certification lead",
      facilities: "Gwangyang Energy Center 2",
      security: "Level 3",
      status: "Permission Update"
    }
  ]
};

function toneClasses(tone: string) {
  if (tone === "emerald") {
    return {
      pill: "bg-emerald-100 text-emerald-700 border-emerald-200",
      track: "bg-emerald-500",
      card: "bg-emerald-50/30",
      accent: "bg-emerald-50 border-emerald-100 text-emerald-700"
    };
  }
  if (tone === "amber") {
    return {
      pill: "bg-amber-100 text-amber-700 border-amber-200",
      track: "bg-amber-500",
      card: "bg-amber-50/30",
      accent: "bg-red-50 border-red-100 text-red-700"
    };
  }
  return {
    pill: "bg-slate-100 text-slate-700 border-slate-200",
    track: "bg-[#246beb]",
    card: "bg-slate-50/50",
    accent: "bg-blue-50 border-blue-100 text-blue-700"
  };
}

export function MypageStaffMigrationPage() {
  const en = isEnglish();
  const routeParams = new URLSearchParams(window.location.search);
  const invitationIssueMode = routeParams.get("processCode") === "COMPANY_MEMBER_INVITATION"
    && routeParams.get("stepCode") === "INVITE_ISSUE";
  const companyOnboardingActorsMode = routeParams.get("processCode") === "COMPANY_ONBOARDING"
    && routeParams.get("stepCode") === "COMPANY_ONBOARDING_ACTORS";
  const locale = en ? "en" : "ko";
  const workflows = WORKFLOWS[locale];
  const cards = LIFECYCLE_CARDS[locale];
  const rows = STAFF_TABLE[locale];
  const [relayActor,setRelayActor]=useState("");
  const [relayItems,setRelayItems]=useState<RelayItem[]>([]);
  const [relayError,setRelayError]=useState("");
  const [relayBusy,setRelayBusy]=useState("");
  const [targetUserId,setTargetUserId]=useState("");
  const [targetRole,setTargetRole]=useState("");
  const [inviteOpen,setInviteOpen]=useState(false);
  const [inviteActors,setInviteActors]=useState<InviteActor[]>([]);
  const [inviteName,setInviteName]=useState("");
  const [inviteEmail,setInviteEmail]=useState("");
  const [inviteActor,setInviteActor]=useState("");
  const [invitePath,setInvitePath]=useState("");
  const [inviteExpiresAt,setInviteExpiresAt]=useState("");
  const [inviteMessage,setInviteMessage]=useState("");
  const [inviteBusy,setInviteBusy]=useState(false);
  const [inviteTenantId,setInviteTenantId]=useState("");
  const loadRelay=useCallback(async()=>{
    const response=await fetch("/api/authority-change/relay",{credentials:"include"});
    if(response.status===403){setRelayActor("");setRelayItems([]);return;}
    const data=await response.json();if(!response.ok)throw new Error(String(data.message||"Relay queue failed"));
    setRelayActor(String(data.actorCode||""));setRelayItems(Array.isArray(data.items)?data.items:[]);
  },[]);
  useEffect(()=>{
    if (companyOnboardingActorsMode || invitationIssueMode) return;
    loadRelay().catch((error)=>setRelayError(error instanceof Error?error.message:String(error)));
  },[companyOnboardingActorsMode, invitationIssueMode, loadRelay]);
  function relayStepCode(actor:string){return actor==="COMPANY_ADMIN"?"USER_AUTHORITY_ASSIGNMENT_S1":actor==="AUTHORITY_ADMIN"?"USER_AUTHORITY_ASSIGNMENT_S2":actor==="VERIFIER"?"USER_AUTHORITY_ASSIGNMENT_S3":actor==="APPROVER"?"USER_AUTHORITY_ASSIGNMENT_S4":""}
  function selectRelayContext(requestId:string){
    const stepCode=relayStepCode(relayActor);if(!stepCode)return;
    const url=new URL(window.location.href);
    url.searchParams.set("processCode","USER_AUTHORITY_ASSIGNMENT");
    url.searchParams.set("stepCode",stepCode);
    url.searchParams.set("actorCode",relayActor);
    url.searchParams.set("requestId",requestId);
    window.history.replaceState(window.history.state,"",url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  async function selectAndRelay(requestId:string,action:string){selectRelayContext(requestId);await relayAction(requestId,action)}
  async function relayAction(requestId:string,action:string){setRelayBusy(requestId);setRelayError("");try{const response=await fetch("/api/authority-change/relay/action",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId,action})});const data=await response.json();if(!response.ok)throw new Error(String(data.message||"Action failed"));await loadRelay()}catch(error){setRelayError(error instanceof Error?error.message:String(error))}finally{setRelayBusy("")}}
  async function submitRelayRequest(){setRelayBusy("request");setRelayError("");try{const response=await fetch("/api/authority-change/request",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({emplyrId:targetUserId,authorCode:targetRole})});const data=await response.json();if(!response.ok)throw new Error(String(data.message||"Request failed"));setTargetUserId("");setTargetRole("");await loadRelay()}catch(error){setRelayError(error instanceof Error?error.message:String(error))}finally{setRelayBusy("")}}
  async function loadInviteContext(){const r=await fetch("/api/company-member-invitations/context",{credentials:"include"});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(String(b.message||"기업 마스터 권한이 필요합니다."));const actors=Array.isArray(b.actors)?b.actors:[];setInviteActors(actors);setInviteTenantId(String(b.tenantId||""));setInviteActor(current=>current||actors[0]?.value||"");return actors}
  async function openInvite(){setInviteMessage("");try{await loadInviteContext()}catch(error){setInviteMessage(error instanceof Error?error.message:String(error))}setInviteOpen(true)}
  async function issueInvite(e:FormEvent){e.preventDefault();setInviteBusy(true);setInviteMessage("");setInvitePath("");setInviteExpiresAt("");try{const r=await fetch("/api/company-member-invitations",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({memberName:inviteName,email:inviteEmail,actorCode:inviteActor})});const b=await r.json().catch(()=>({}));if(r.ok&&b.activationPath){setInvitePath(`${location.origin}${b.activationPath}`);setInviteExpiresAt(String(b.expiresAt||""));setInviteMessage("초대 링크가 발급되었습니다.")}else setInviteMessage(b.message||"초대 발급에 실패했습니다.")}catch{setInviteMessage("서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.")}finally{setInviteBusy(false)}}
  const visibleRelayItems=relayItems.filter(item=>item.before_author_code!==item.requested_author_code);

  const copy = {
    skip: en ? "Skip to main content" : "본문 바로가기",
    government: en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스",
    guideline: en ? "My Page | Manager permission and workflow management" : "마이페이지 | 담당자 권한 및 라이프사이클 관리",
    brandTitle: en ? "My Page" : "마이페이지",
    brandSubtitle: en ? "Manager Lifecycle Control" : "담당자 라이프사이클 관리",
    homeHref: buildLocalizedPath("/home", "/en/home"),
    heroBadge: en ? "Workflow engine active" : "워크플로 엔진 활성화",
    heroTitle: en ? "Intelligent Staff Lifecycle Assistant" : "지능형 담당자 라이프사이클 어시스턴트",
    heroBody: en
      ? "Handle onboarding, role changes, and offboarding from one operational cockpit."
      : "신규 등록, 역할 변경, 종료 처리까지 모든 담당자 운영 절차를 한 화면에서 관리합니다.",
    startRegistration: en ? "Start Registration" : "등록 시작",
    statusReport: en ? "General Status Report" : "전체 현황 리포트",
    ongoingTitle: en ? "Major Ongoing Workflows" : "주요 진행 워크플로",
    ongoingMeta: en ? "2 pending processes" : "총 2건 진행 중",
    searchPlaceholder: en ? "Search by staff name, department, or site" : "담당자명, 부서, 사업장으로 검색",
    search: en ? "Search" : "검색",
    sectionTitle: en ? "Core Staff Lifecycle Management" : "핵심 담당자 라이프사이클 관리",
    sectionBody: en ? "Monitor current status and required actions of core facility staff in real time." : "핵심 시설 담당자의 현재 상태와 필요한 조치를 실시간으로 확인합니다.",
    batchRole: en ? "Batch Role Adjustment" : "일괄 권한 조정",
    downloadList: en ? "Download List" : "목록 다운로드",
    listTitle: en ? "All Staff List" : "전체 담당자 목록",
    totalLabel: en ? "Total 42" : "총 42명",
    departmentFilter: en ? "All Departments" : "전체 부서",
    statusFilter: en ? "All Statuses" : "전체 상태",
    managerCol: en ? "Staff" : "담당자",
    deptCol: en ? "Dept / Role" : "부서 / 역할",
    facilitiesCol: en ? "Managed Facilities" : "담당 시설",
    securityCol: en ? "Security Level" : "보안 등급",
    workflowCol: en ? "Workflow Status" : "워크플로 상태",
    actionCol: en ? "Action" : "작업",
    profile: en ? "My Profile" : "내 정보",
    security: en ? "Security & Password" : "보안 설정",
    company: en ? "Company Info" : "기업 정보",
    staff: en ? "Staff Management" : "담당자 관리",
    notification: en ? "Notifications" : "알림 설정",
    userRole: en ? "System Administrator" : "시스템 관리자",
    userName: en ? "Admin Lee Hyeon-jang" : "이현장 관리자",
    footerOrg: en ? "CCUS Integrated HQ" : "CCUS 통합관리본부",
    footerAddress: en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Staff support: 02-1234-5678" : "(04551) 서울특별시 중구 세종대로 110 | 담당자 지원센터 02-1234-5678",
    footerService: en ? "This system supports efficient staff governance and security compliance." : "본 시스템은 담당자 운영 거버넌스와 보안 준수를 효율적으로 지원합니다.",
    footerLinks: en ? Array.from(["Privacy Policy", "Terms of Use", "Admin Guide"]) : Array.from(["개인정보처리방침", "이용약관", "운영 가이드"]),
    footerWaAlt: en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크",
    lastModifiedLabel: en ? "Last Modified:" : "최종 수정일:"
  };

  const sidebarItems = [
    { label: copy.profile, href: buildLocalizedPath("/mypage/profile", "/en/mypage/profile"), icon: "account_circle", active: false },
    { label: copy.security, href: buildLocalizedPath("/mypage/password?processCode=PROFILE_MANAGEMENT&stepCode=PROFILE_MANAGEMENT_S4&guide=1", "/en/mypage/password?processCode=PROFILE_MANAGEMENT&stepCode=PROFILE_MANAGEMENT_S4&guide=1"), icon: "security", active: false },
    { label: copy.company, href: buildLocalizedPath("/mypage/company", "/en/mypage/company"), icon: "business", active: false },
    { label: copy.staff, href: buildLocalizedPath("/mypage/staff", "/en/mypage/staff"), icon: "groups", active: true },
    { label: copy.notification, href: buildLocalizedPath("/mypage/notification", "/en/mypage/notification"), icon: "notifications", active: false }
  ];

  useEffect(() => {
    if (!invitationIssueMode) return;
    void openInvite();
  }, [invitationIssueMode]);

  useEffect(() => {
    if (!companyOnboardingActorsMode) return;
    void loadInviteContext().catch(error=>setInviteMessage(error instanceof Error?error.message:String(error)));
  }, [companyOnboardingActorsMode]);

  if (companyOnboardingActorsMode) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] text-slate-900" data-mypage-theme="krds-v1">
        <main className="mx-auto max-w-5xl px-5 py-10 lg:px-8" id="main-content">
          <header className="border-b border-slate-300 pb-6">
            <p className="text-sm font-bold text-[#246beb]">기업 업무환경 구성 · 직원 준비</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#052b57]">기업 관리자 준비·다음 업무 안내</h1>
            <p className="mt-3 text-base text-slate-600">이 주소는 기존 온보딩 링크입니다. 기업 승인과 최초 관리자의 소속·접근 여부를 확인한 뒤, 직원 초대와 세부 권한 관리는 필요한 경우에만 별도 진행합니다.</p>
          </header>

          <section className="mt-8 rounded-2xl border border-slate-300 bg-white shadow-sm" aria-labelledby="company-context-title">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-[#052b57]" id="company-context-title">회사 소속 확인</h2>
                <p className="mt-2 text-sm text-slate-600">로그인 계정이 관리하는 회사 범위에서만 직원을 초대할 수 있습니다.</p>
              </div>
              <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800">회사 식별자 · {inviteTenantId||"확인 중"}</span>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <span className="material-symbols-outlined text-3xl text-[#246beb]">domain_verified</span>
                <h3 className="mt-3 text-lg font-black text-[#052b57]">회사 관리자</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">회사 정보와 소속 직원을 관리하는 회사 공통 권한입니다.</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <span className="material-symbols-outlined text-3xl text-[#246beb]">group</span>
                <h3 className="mt-3 text-lg font-black text-[#052b57]">회사 소속 직원</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">초대 수락 후 회사 소속과 기본 로그인 권한이 연결됩니다.</p>
              </article>
            </div>
          </section>

          <section className="mt-6" aria-label="직원 구성 작업">
            <article className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <span className="material-symbols-outlined text-3xl text-[#246beb]">person_add</span>
              <h2 className="mt-4 text-xl font-black text-[#052b57]">직원 초대·소속 가입</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">직원 초대와 계정 활성화는 독립된 회원사 직원 초대 프로세스에서 진행합니다.</p>
              <button className="mt-5 min-h-12 rounded-lg bg-[#246beb] px-6 font-bold text-white hover:bg-[#1d56bc]" onClick={()=>navigate("/mypage/staff?processCode=COMPANY_MEMBER_INVITATION&stepCode=INVITE_ISSUE&guide=1")} type="button">직원 초대 업무로 이동</button>
            </article>
          </section>

          <aside className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="font-black text-emerald-950">온보딩 완료 전 확인 기준 — 자동 검증 결과가 아닙니다</h2>
            <ul className="mt-3 grid gap-2 text-sm text-emerald-900 md:grid-cols-2"><li>1. 기업 승인이 완료되었는지 확인합니다.</li><li>2. 최초 기업관리자의 소속·계정 활성·접근 가능 여부를 확인합니다.</li></ul>
            <p className="mt-3 text-sm">직원 전체 초대 및 세부 권한 배정은 온보딩 필수 조건이 아닙니다. 업무 담당자·결재자 지정과 시스템 접근 권한은 별개입니다.</p>
            <nav className="mt-4 flex flex-wrap gap-4" aria-label="독립 권한 관리 업무">
              <a className="font-bold underline" href="/admin/auth/group">권한 그룹 정의</a>
              <a className="font-bold underline" href="/admin/member/dept-role-mapping">부서·회원 권한 할당</a>
              <a className="font-bold underline" href="/admin/member/auth-change">기존 권한 변경</a>
            </nav>
          </aside>
        </main>
        <UserPortalFooter addressLine={copy.footerAddress} copyright="© 2026 CCUS Carbon Footprint Platform. All rights reserved." footerLinks={copy.footerLinks} lastModifiedLabel={copy.lastModifiedLabel} orgName={copy.footerOrg} serviceLine={copy.footerService} waAlt={copy.footerWaAlt}/>
      </div>
    );
  }

  if (invitationIssueMode) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] text-slate-900" data-mypage-theme="krds-v1">
        <main className="mx-auto max-w-5xl px-5 py-10 lg:px-8" id="main-content">
          <header className="border-b border-slate-300 pb-6">
            <p className="text-sm font-bold text-[#246beb]">회원사 직원 초대 · 1단계</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#052b57]">직원 초대 링크 발급</h1>
            <p className="mt-3 text-base text-slate-600">초대할 직원의 기본 정보와 담당 업무 액터를 지정합니다.</p>
          </header>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm" aria-labelledby="invite-form-title">
              <div className="border-b border-slate-200 pb-5">
                <h2 className="text-xl font-black text-[#052b57]" id="invite-form-title">초대 정보 입력</h2>
                <p className="mt-2 text-sm text-slate-600"><span className="font-bold text-red-600">*</span> 표시는 필수 입력 항목입니다.</p>
              </div>
              <form className="mt-6 grid gap-5" onSubmit={issueInvite}>
                <label className="grid gap-2 text-sm font-bold">직원 이름 <span className="sr-only">필수</span>
                  <input className="min-h-12 rounded-lg border border-slate-400 px-4 outline-none focus:border-[#246beb] focus:ring-2 focus:ring-blue-100" value={inviteName} onChange={e=>setInviteName(e.target.value)} maxLength={50} required />
                </label>
                <label className="grid gap-2 text-sm font-bold">이메일 <span className="sr-only">필수</span>
                  <input className="min-h-12 rounded-lg border border-slate-400 px-4 outline-none focus:border-[#246beb] focus:ring-2 focus:ring-blue-100" type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} maxLength={100} required />
                  <span className="text-xs font-normal text-slate-500">수신자가 확인할 수 있는 업무용 이메일을 입력해 주세요.</span>
                </label>
                <label className="grid gap-2 text-sm font-bold">담당 업무 액터 <span className="sr-only">필수</span>
                  <select className="min-h-12 rounded-lg border border-slate-400 bg-white px-4 outline-none focus:border-[#246beb] focus:ring-2 focus:ring-blue-100" value={inviteActor} onChange={e=>setInviteActor(e.target.value)} required>
                    {inviteActors.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                  <span className="text-xs font-normal text-slate-500">초대 수락 시 일반 회원 권한과 선택한 업무 액터가 함께 배정됩니다.</span>
                </label>
                <div className="flex justify-end border-t border-slate-200 pt-5">
                  <button disabled={inviteBusy||inviteActors.length===0} className="min-h-12 rounded-lg bg-[#246beb] px-8 font-bold text-white hover:bg-[#1d56bc] disabled:cursor-not-allowed disabled:opacity-50">
                    {inviteBusy ? "발급 중..." : "초대 링크 발급"}
                  </button>
                </div>
              </form>
              {inviteMessage && <p className={`mt-5 rounded-lg border p-4 text-sm font-bold ${invitePath ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-800"}`} role="status">{inviteMessage}</p>}
              {invitePath && <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5" aria-labelledby="issued-link-title">
                <h3 className="font-black text-[#052b57]" id="issued-link-title">발급된 초대 링크</h3>
                {inviteExpiresAt && <p className="mt-2 text-sm text-slate-600">유효 기한: {new Date(inviteExpiresAt).toLocaleString()}</p>}
                <input aria-label="발급된 초대 링크" readOnly className="mt-4 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 font-mono text-xs" value={invitePath}/>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="min-h-11 rounded-lg border border-[#246beb] bg-white px-5 font-bold text-[#246beb]" onClick={()=>navigator.clipboard.writeText(invitePath)} type="button">링크 복사</button>
                  <button className="min-h-11 rounded-lg bg-[#246beb] px-5 font-bold text-white" onClick={()=>window.open(invitePath,"_blank","noopener,noreferrer")} type="button">초대 화면 열기</button>
                </div>
              </section>}
            </section>

            <aside className="h-fit rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <h2 className="font-black text-[#052b57]">발급 전 확인</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <li>1. 링크는 24시간 동안 유효합니다.</li>
                <li>2. 한 번 사용한 링크는 다시 사용할 수 없습니다.</li>
                <li>3. 수락 완료 후 계정과 업무 액터가 자동 생성됩니다.</li>
              </ul>
            </aside>
          </div>
        </main>
        <UserPortalFooter addressLine={copy.footerAddress} copyright="© 2026 CCUS Carbon Footprint Platform. All rights reserved." footerLinks={copy.footerLinks} lastModifiedLabel={copy.lastModifiedLabel} orgName={copy.footerOrg} serviceLine={copy.footerService} waAlt={copy.footerWaAlt}/>
      </div>
    );
  }

  return (
    <div data-mypage-theme="krds-v1"
      className="min-h-screen bg-[linear-gradient(180deg,#eff4fb_0%,#f8fafc_22%,#ffffff_100%)] text-slate-900"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9"
      }}
    >
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-4 focus:py-3 focus:text-white" href="#main-content">
        {copy.skip}
      </a>
      <main id="main-content">
        <section className="border-b border-slate-200 bg-[#f4f6f8]" data-help-id="mypage-staff-hero">
          <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
            <div className="grid gap-8 xl:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {sidebarItems.map((item) => (
                  <button
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition ${item.active ? "bg-blue-50 text-[#00378b]" : "text-slate-600 hover:bg-slate-50 hover:text-[#00378b]"}`}
                    key={item.label}
                    onClick={() => navigate(item.href)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </aside>

              <div className="space-y-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#246beb]" />
                      </span>
                      {copy.heroBadge}
                    </span>
                    <h2 className="mt-4 text-3xl font-black text-[#052b57] md:text-4xl">{copy.heroTitle}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{copy.heroBody}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button className="rounded-xl bg-[#246beb] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1d56bc]" onClick={openInvite} type="button">
                      {copy.startRegistration}
                    </button>
                    <button className="rounded-xl border border-[#246beb] bg-white px-5 py-3 text-sm font-bold text-[#246beb] transition hover:bg-blue-50" type="button">
                      {copy.statusReport}
                    </button>
                  </div>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <h3 className="flex items-center gap-2 text-lg font-black text-[#052b57]">
                      <span className="material-symbols-outlined text-[#246beb]">pending_actions</span>
                      {copy.ongoingTitle}
                    </h3>
                    <span className="text-xs font-bold text-slate-400">{copy.ongoingMeta}</span>
                  </div>
                  <div className="space-y-5">
                    {workflows.map((workflow) => (
                      <article className="rounded-xl border border-slate-200 bg-slate-50 p-5" key={workflow.id}>
                        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-4">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${workflow.tone === "emerald" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-rose-500/20 bg-rose-500/10 text-rose-300"}`}>
                              <span className="material-symbols-outlined">{workflow.icon}</span>
                            </div>
                            <div>
                              <div className="mb-2 flex items-center gap-2">
                                <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${workflow.tone === "emerald" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>{workflow.tag}</span>
                                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{workflow.meta}</span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-900">{workflow.title}</h4>
                            </div>
                          </div>
                          <button className={`rounded-lg px-4 py-2 text-xs font-bold transition ${workflow.actionVariant === "primary" ? "bg-[#246beb] text-white hover:bg-[#1d56bc]" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`} type="button">
                            {workflow.action}
                          </button>
                        </div>
                        <div className={`grid gap-3 ${workflow.steps.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
                          {workflow.steps.map((step, index) => {
                            const active = index === workflow.activeIndex;
                            const complete = index < workflow.activeIndex;
                            return (
                              <div key={step}>
                                <div className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-black ${complete ? "border-emerald-500 bg-emerald-50 text-emerald-600" : active ? "border-[#246beb] bg-[#246beb] text-white shadow-sm" : "border-slate-300 bg-white text-slate-500"}`}>
                                  {complete ? <span className="material-symbols-outlined text-[18px]">check</span> : index + 1}
                                </div>
                                <p className={`mt-2 text-[11px] font-bold ${active ? "text-[#052b57]" : "text-slate-500"}`}>{step}</p>
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>

        {relayActor ? <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8" data-help-id="user-authority-assignment-relay">
          <div className="rounded-[28px] border border-blue-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-black text-blue-700">USER_AUTHORITY_ASSIGNMENT</p><h3 className="mt-1 text-xl font-black">{en?"My authority-change relay queue":"내 권한 변경 릴레이 대기열"}</h3><p className="mt-2 text-sm text-slate-600">{en?`Current actor: ${relayActor}`:`현재 액터: ${relayActor} · 순서에 맞는 실제 권한 변경만 표시합니다.`}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{visibleRelayItems.length}{en?" effective changes":"건 실제 변경"}</span></div>
            {relayActor==="COMPANY_ADMIN"?<div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]"><input aria-label="target user id" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" value={targetUserId} onChange={e=>setTargetUserId(e.target.value)} placeholder={en?"Target user ID":"대상 사용자 ID"}/><input aria-label="target authority code" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" value={targetRole} onChange={e=>setTargetRole(e.target.value)} placeholder={en?"Authority code":"변경할 권한 코드"}/><button disabled={!targetUserId||!targetRole||relayBusy==="request"} onClick={submitRelayRequest} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{en?"Submit request":"변경 요청"}</button></div>:null}
            {relayError?<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{relayError}</p>:null}
            <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-100 text-slate-700"><tr><th className="p-3">{en?"Request":"요청"}</th><th className="p-3">{en?"Target":"대상"}</th><th className="p-3">{en?"Change":"변경"}</th><th className="p-3">{en?"Status":"상태"}</th><th className="p-3">{en?"Action":"처리"}</th></tr></thead><tbody>{visibleRelayItems.map(item=>{const action=relayActor==="AUTHORITY_ADMIN"&&item.status==="REQUESTED"?"ASSIGN":relayActor==="VERIFIER"&&item.status==="ASSIGNED"?"VERIFY":relayActor==="APPROVER"&&item.status==="VERIFIED"?"APPROVE":"";return <tr className="border-b border-slate-200" key={item.request_id} data-process-code="USER_AUTHORITY_ASSIGNMENT" data-step-code={relayStepCode(relayActor)} data-request-id={item.request_id}><td className="p-3 font-mono text-xs"><button className="text-left font-mono text-xs font-bold text-blue-700 underline-offset-2 hover:underline" onClick={()=>selectRelayContext(item.request_id)} type="button">{item.request_id}</button></td><td className="p-3 font-bold">{item.target_user_id}</td><td className="p-3">{item.before_author_code} → {item.requested_author_code}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{item.status}</span></td><td className="p-3">{action?<button disabled={relayBusy===item.request_id} onClick={()=>selectAndRelay(item.request_id,action)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{action}</button>:<span className="text-xs text-slate-400">-</span>}</td></tr>})}{visibleRelayItems.length===0?<tr><td className="p-6 text-center text-sm text-slate-500" colSpan={5}>{en?"No effective authority changes.":"처리할 실제 권한 변경 요청이 없습니다."}</td></tr>:null}</tbody></table></div>
          </div>
        </section>:null}

        <section className="mx-auto -mt-8 max-w-7xl px-4 lg:px-8">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-xl">
            <div className="ccus-search-host"><CommonSearchSection basic={<><div className="ccus-search-field"><label className="relative flex-1">
                <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input className="h-14 w-full rounded-xl bg-slate-50 pl-12 pr-4 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-500" placeholder={copy.searchPlaceholder} type="text" />
              </label></div></>} actions={<><button className="h-14 rounded-xl bg-[#246beb] px-8 text-sm font-bold text-white transition hover:bg-[#1d56bc]" type="button">{copy.search}</button>
<button className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200" type="button">
                  <span className="material-symbols-outlined">filter_list</span>
                </button></>}></CommonSearchSection></div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8" data-help-id="mypage-staff-table">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                <span className="material-symbols-outlined text-[#246beb]">manage_accounts</span>
                {copy.sectionTitle}
              </h3>
              <p className="mt-2 text-sm text-slate-500">{copy.sectionBody}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600" type="button">
                <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                {copy.batchRole}
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700" type="button">
                <span className="material-symbols-outlined text-[16px]">download</span>
                {copy.downloadList}
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {cards.map((card) => {
              const tone = toneClasses(card.tone);
              return (
                <article className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" key={card.id}>
                  <div className={`border-b border-slate-100 p-6 ${tone.card}`}>
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
                        <span className="material-symbols-outlined text-[28px]">face</span>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${tone.pill}`}>{card.status}</span>
                    </div>
                    <h4 className="text-lg font-black text-slate-900">{card.name}</h4>
                    <p className="mt-1 text-xs font-medium text-slate-500">{card.subtitle}</p>
                  </div>
                  <div className="space-y-6 p-6">
                    <div>
                      <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        <span>{card.metricLabel}</span>
                        <span className="text-indigo-600">{card.metricValue}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full ${tone.track}`} style={{ width: card.metricValue }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {card.actions.map((action) => (
                        <button className="rounded-xl bg-slate-50 py-3 text-[11px] font-bold text-slate-600 transition hover:bg-indigo-600 hover:text-white" key={action} type="button">
                          {action}
                        </button>
                      ))}
                    </div>
                    <div className={`rounded-2xl border p-4 ${tone.accent}`}>
                      <p className="text-[11px] font-black">{card.insightTitle}</p>
                      <p className="mt-2 text-[11px] leading-5">{card.insightBody}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 lg:px-8">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="text-lg font-black text-slate-900">
                {copy.listTitle}
                <span className="ml-2 text-sm font-normal text-slate-400">{copy.totalLabel}</span>
              </h3>
              <div className="flex gap-3">
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500">
                  <option>{copy.departmentFilter}</option>
                </select>
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500">
                  <option>{copy.statusFilter}</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-6 py-4">{copy.managerCol}</th>
                    <th className="px-6 py-4">{copy.deptCol}</th>
                    <th className="px-6 py-4">{copy.facilitiesCol}</th>
                    <th className="px-6 py-4">{copy.securityCol}</th>
                    <th className="px-6 py-4 text-center">{copy.workflowCol}</th>
                    <th className="px-6 py-4 text-right">{copy.actionCol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr className="hover:bg-slate-50/80" key={row.id}>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-600">{row.initials}</div>
                          <div className="text-sm font-bold text-slate-800">{row.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-xs font-bold text-slate-600">{row.role}</div>
                        <div className="mt-1 text-[10px] text-slate-400">{row.detail}</div>
                      </td>
                      <td className="px-6 py-5 text-xs font-medium text-slate-600">{row.facilities}</td>
                      <td className="px-6 py-5">
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">{row.security}</span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${row.status.includes("권한") || row.status.includes("Permission") ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>{row.status}</span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button className="text-slate-400 transition hover:text-indigo-600" type="button">
                          <span className="material-symbols-outlined text-[20px]">more_vert</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center gap-1 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400" type="button">
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button className="h-8 w-8 rounded border border-indigo-600 bg-indigo-600 text-xs font-bold text-white" type="button">1</button>
              <button className="h-8 w-8 rounded border border-slate-200 bg-white text-xs font-bold text-slate-600" type="button">2</button>
              <button className="h-8 w-8 rounded border border-slate-200 bg-white text-xs font-bold text-slate-600" type="button">3</button>
              <button className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400" type="button">
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        </section>

        {inviteOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="member-invite-title"><section className="w-full max-w-xl rounded-3xl bg-white p-7 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black text-blue-700">기업 마스터 · 담당자 온보딩</p><h3 id="member-invite-title" className="mt-1 text-2xl font-black">일반 회원 초대 및 액터 배정</h3><p className="mt-2 text-sm text-slate-600">초대 수락 시 계정, ROLE_USER 권한, 선택 액터가 한 번에 생성됩니다.</p></div><button aria-label="닫기" className="rounded-xl border p-2" onClick={()=>setInviteOpen(false)} type="button">✕</button></div><form className="mt-6 grid gap-4" onSubmit={issueInvite}><label className="grid gap-2 text-sm font-bold">담당자 이름<input className="min-h-12 rounded-xl border border-slate-300 px-4" value={inviteName} onChange={e=>setInviteName(e.target.value)} required/></label><label className="grid gap-2 text-sm font-bold">이메일<input className="min-h-12 rounded-xl border border-slate-300 px-4" type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} required/></label><label className="grid gap-2 text-sm font-bold">업무 액터<select className="min-h-12 rounded-xl border border-slate-300 px-4" value={inviteActor} onChange={e=>setInviteActor(e.target.value)} required>{inviteActors.map(a=><option key={a.value} value={a.value}>{a.label} ({a.value})</option>)}</select></label><button disabled={inviteBusy||inviteActors.length===0} className="min-h-12 rounded-xl bg-blue-800 font-black text-white disabled:opacity-40">초대 링크 발급</button></form>{inviteMessage&&<p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm font-bold text-blue-900">{inviteMessage}</p>}{invitePath&&<div className="mt-4 grid gap-2"><label className="text-sm font-bold">초대 링크<input readOnly className="mt-2 min-h-12 w-full rounded-xl border bg-slate-50 px-4 font-mono text-xs" value={invitePath}/></label><button className="min-h-11 rounded-xl border border-blue-700 font-bold text-blue-800" onClick={()=>navigator.clipboard.writeText(invitePath)} type="button">초대 링크 복사</button></div>}</section></div>}
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright="© 2026 CCUS Carbon Footprint Platform. All rights reserved."
        footerLinks={copy.footerLinks}
        lastModifiedLabel={copy.lastModifiedLabel}
        orgName={copy.footerOrg}
        serviceLine={copy.footerService}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
