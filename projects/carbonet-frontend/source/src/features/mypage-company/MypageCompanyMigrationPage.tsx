import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { fetchMypage } from "../../lib/api/portal";

type CompanyRecord = Record<string, unknown>;

function textValue(record: CompanyRecord, keys: string[], fallback = "-") {
  for (const key of keys) {
    const value = String(record[key] ?? "").trim();
    if (value) return value;
  }
  return fallback;
}

function statusAccepted(value: string) {
  return /^(P|Y|ACTIVE|APPROVED|APPROVE|NORMAL|정상|승인|활성)$/i.test(value.trim());
}

export function MypageCompanyMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const [payload, setPayload] = useState<CompanyRecord>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [changeGuideOpen, setChangeGuideOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    void fetchMypage(en)
      .then((value) => {
        if (!active) return;
        setPayload(value);
      })
      .catch(() => {
        if (!active) return;
        setPayload({});
        setLoadError(en ? "Company information could not be loaded." : "회사 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [en]);

  const company = useMemo<CompanyRecord>(() => {
    if (payload.company && typeof payload.company === "object") return payload.company as CompanyRecord;
    if (payload.member && typeof payload.member === "object") return payload.member as CompanyRecord;
    return {};
  }, [payload]);

  const companyName = textValue(company, ["insttNm", "cmpnyNm"], en ? "Company not linked" : "연결된 회사 없음");
  const businessNumber = textValue(company, ["bizrno"]);
  const representative = textValue(company, ["representativeName", "reprsntNm", "cxfc"]);
  const institutionId = textValue(company, ["insttId"], textValue(payload, ["insttId"]));
  const address = [
    textValue(company, ["address", "adres"], ""),
    textValue(company, ["detailAddress", "detailAdres"], "")
  ].filter(Boolean).join(" ") || "-";
  const approvedAt = textValue(company, ["approvedAt", "approvalAt", "lastUpdtPnttm"], en ? "Approval record linked" : "승인 기록 연계");
  const rawStatus = textValue(company, ["status", "insttSttus", "entrprsMberStus"], textValue(payload, ["memberStatus", "pendingStatus"], ""));
  const pageType = textValue(payload, ["pageType"], "");
  const authenticated = Boolean(payload.authenticated ?? payload.isLoggedIn ?? session.value?.userId);
  const companyLinked = Object.keys(company).length > 0;
  const approvalReady = companyLinked && pageType !== "pending" && pageType !== "blocked" && (!rawStatus || statusAccepted(rawStatus));
  const tenantReady = institutionId !== "-";
  const evidenceReady = businessNumber !== "-" && companyName !== (en ? "Company not linked" : "연결된 회사 없음");
  const readyCount = [approvalReady, tenantReady, evidenceReady].filter(Boolean).length;
  const allReady = readyCount === 3;

  const conditions = en ? [
    { title: "Company membership approved", detail: approvalReady ? "The company registration review is complete." : "Company approval is pending or requires review.", ready: approvalReady },
    { title: "Company tenant activated", detail: tenantReady ? "A company-scoped operating tenant is linked." : "The company tenant identifier is missing.", ready: tenantReady },
    { title: "Required company evidence identified", detail: evidenceReady ? "The company name and business registration number are available." : "Required company identifiers must be supplemented.", ready: evidenceReady }
  ] : [
    { title: "회원사 신청 승인", detail: approvalReady ? "관리자 검토와 회사 등록 승인이 완료되었습니다." : "승인 대기 또는 관리자 확인이 필요합니다.", ready: approvalReady },
    { title: "기업 테넌트 활성화", detail: tenantReady ? "회사별 데이터·권한 운영공간이 연결되었습니다." : "기관 식별자가 없어 테넌트 확인이 필요합니다.", ready: tenantReady },
    { title: "필수 기업정보 확인", detail: evidenceReady ? "법인명과 사업자등록번호가 확인되었습니다." : "법인명 또는 사업자등록번호 보완이 필요합니다.", ready: evidenceReady }
  ];

  const fields = en ? [
    ["Corporate name", companyName], ["Business registration no.", businessNumber],
    ["Representative", representative], ["Institution ID", institutionId],
    ["Head office", address], ["Approval record", approvedAt]
  ] : [
    ["기업 법인명", companyName], ["사업자등록번호", businessNumber],
    ["대표자", representative], ["기관 식별자", institutionId],
    ["본사 소재지", address], ["회사 승인일", approvedAt]
  ];

  logGovernanceScope("PAGE", "mypage-company", { processCode: "COMPANY_REGISTRATION_APPROVAL", stepCode: "COMPANY_REGISTRATION_APPROVAL_S4" });

  return (
    <div data-mypage-theme="krds-v1" className="min-h-screen bg-slate-50 text-slate-900">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-blue-900 focus:px-4 focus:py-3 focus:text-white">
        {en ? "Skip to main content" : "본문 바로가기"}
      </a>
      <UserPortalHeader
        brandTitle={en ? "CCUS Carbon Footprint Platform" : "CCUS 탄소중립 플랫폼"}
        brandSubtitle={en ? "Company Workspace" : "기업 업무환경"}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={<UserLanguageToggle en={en} onKo={() => navigate("/mypage/company")} onEn={() => navigate("/en/mypage/company")} />}
      />

      <main id="main-content" className="mx-auto w-full max-w-[1240px] px-4 py-8 lg:px-8 lg:py-10">
        <nav aria-label={en ? "Breadcrumb" : "현재 위치"} className="text-sm text-slate-500">
          {en ? "Home › My Page › Company registration" : "홈 › 마이페이지 › 회원사 가입"}
        </nav>

        <header className="mt-6 flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:px-8 lg:py-7" data-help-id="mypage-company-hero">
          <div className="min-w-0">
            <p className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold tracking-[0.08em] text-emerald-800">{en ? "COMPANY REGISTRATION · COMPLETE" : "회원사 가입 · 완료"}</p>
            <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">{en ? "Company information and activation status" : "회사 정보·활성 상태 확인"}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">{en ? "Review the approved company record and prerequisites for starting work." : "승인된 회사 정보와 업무 시작 조건을 확인합니다."}</p>
          </div>
          <span className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${allReady ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${allReady ? "bg-emerald-600" : "bg-amber-600"}`} aria-hidden="true" />
            {allReady ? (en ? "Company activation complete" : "회사 활성화 완료") : (en ? "Activation review required" : "활성화 확인 필요")}
          </span>
        </header>

        {loadError && <div role="alert" className="mt-6 rounded-xl border border-red-300 bg-red-50 px-5 py-4 font-semibold text-red-800">{loadError}</div>}
        {!authenticated && !loading && <div role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 font-semibold text-amber-900">{en ? "Please sign in to review the company workspace." : "회사 업무환경을 확인하려면 로그인해 주세요."}</div>}

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-help-id="mypage-company-profile">
              <div className="border-b border-slate-100 px-6 py-5"><h2 className="text-xl font-black">{en ? "Company information" : "회사 기본정보"}</h2><p className="mt-2 text-sm text-slate-500">{en ? "Reference data recorded during registration and approval." : "가입·승인 시 등록된 기준정보입니다."}</p></div>
              <dl className="grid gap-4 p-6 md:grid-cols-2">
                {fields.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-2 break-words text-base font-bold text-slate-900">{loading ? (en ? "Loading..." : "불러오는 중...") : value}</dd></div>)}
              </dl>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-help-id="mypage-company-activation-conditions">
              <div className="border-b border-slate-100 px-6 py-5"><h2 className="text-xl font-black">{en ? "Registration completion conditions" : "가입 완료 조건"}</h2><p className="mt-2 text-sm text-slate-500">{en ? "The company approval and activation conditions are checked automatically." : "회원사 승인과 회사 활성화에 필요한 조건을 자동 점검합니다."}</p></div>
              <ul className="divide-y divide-slate-100 px-6">
                {conditions.map((condition) => <li key={condition.title} className="grid gap-3 py-5 sm:grid-cols-[40px_1fr_auto] sm:items-center"><span className={`grid h-9 w-9 place-items-center rounded-full font-black ${condition.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{condition.ready ? "✓" : "!"}</span><div><b className="text-sm">{condition.title}</b><p className="mt-1 text-sm text-slate-500">{condition.detail}</p></div><span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${condition.ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{condition.ready ? (en ? "Ready" : "충족") : (en ? "Review" : "확인 필요")}</span></li>)}
              </ul>
            </section>
          </div>

          <aside className="space-y-4">
            <section className={`rounded-2xl border p-6 shadow-sm ${allReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`} data-help-id="mypage-company-registration-result">
              <p className={`text-sm font-bold ${allReady ? "text-emerald-800" : "text-amber-800"}`}>{allReady ? "✓ " : "! "}{allReady ? (en ? "Company registration complete" : "회원사 가입 완료") : (en ? "Registration review required" : "가입 상태 확인 필요")}</p>
              <h2 className="mt-3 text-xl font-black text-slate-950">{allReady ? (en ? "The company is active" : "회사가 활성화되었습니다") : (en ? "Complete the required conditions" : "필요 조건을 확인하세요")}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{en ? "Emission-site setup and project readiness are managed separately under Carbon Emissions." : "사업장 구성과 프로젝트 착수 점검은 탄소배출 관리 업무에서 별도로 진행합니다."}</p>
              <div className="mt-5 rounded-xl border border-white bg-white/80 p-4"><b className="text-3xl text-slate-950">{readyCount} / 3</b><p className="mt-1 text-sm text-slate-600">{en ? "registration completion conditions" : "가입 완료 조건 충족"}</p></div>
            </section>

            <button type="button" onClick={() => setChangeGuideOpen((open) => !open)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-4 font-bold text-slate-700 hover:bg-slate-50">
              {en ? "Company information change guide" : "기업정보 변경 안내"}
            </button>
            {changeGuideOpen && <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600" aria-live="polite"><b className="text-slate-900">{en ? "Documents required" : "변경 시 필요한 자료"}</b><p className="mt-2">{en ? "Changes to the company name, representative, or business number require supporting evidence and administrator review. The request API is not yet available, so contact the administrator." : "법인명·대표자·사업자번호 변경은 증빙 제출과 관리자 검토가 필요합니다. 현재 변경 요청 API가 없어 관리자에게 요청해야 합니다."}</p></section>}
          </aside>
        </div>
      </main>

      <UserPortalFooter
        orgName={en ? "CCUS Integrated Management Office" : "CCUS 통합관리본부"}
        addressLine={en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul" : "(04551) 서울특별시 중구 세종대로 110"}
        footerLinks={en ? ["Privacy Policy", "Terms of Use", "Sitemap"] : ["개인정보처리방침", "이용약관", "사이트맵"]}
        copyright="© 2026 CCUS Carbon Footprint Platform. All rights reserved."
        lastModifiedLabel={en ? "Last Modified:" : "최종 수정일:"}
        waAlt={en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크"}
        serviceLine={en ? "Integrated carbon management services." : "탄소배출·LCA·감축·인증 업무를 통합 지원합니다."}
      />
    </div>
  );
}

export default MypageCompanyMigrationPage;
