import { useEffect } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { resetJoinSession } from "../../lib/api/joinSession";
import { buildLocalizedPath, getSearchParam, isEnglish, navigate } from "../../lib/navigation/runtime";

type CompanyRegisterCompletePayload = {
  insttNm?: string;
  bizrno?: string;
  regDate?: string;
};

const STORAGE_KEY = "carbonet.join.company-register.complete";

function readPayload(): CompanyRegisterCompletePayload {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as CompanyRegisterCompletePayload;
    }
  } catch {
  }
  return {
    insttNm: getSearchParam("insttNm"),
    bizrno: getSearchParam("bizrno"),
    regDate: getSearchParam("regDate")
  };
}

export function JoinCompanyRegisterCompleteMigrationPage() {
  const en = isEnglish();
  const payload = readPayload();

  useEffect(() => {
    logGovernanceScope("PAGE", "join-company-register-complete", {
      language: en ? "en" : "ko",
      insttNm: payload.insttNm || "",
      bizrno: payload.bizrno || "",
      regDate: payload.regDate || ""
    });
    logGovernanceScope("COMPONENT", "join-company-register-complete-summary", {
      insttNm: payload.insttNm || "",
      bizrnoPresent: Boolean(payload.bizrno),
      regDatePresent: Boolean(payload.regDate)
    });
  }, [en, payload.bizrno, payload.insttNm, payload.regDate]);

  async function handleHome() {
    logGovernanceScope("ACTION", "join-company-register-complete-home", {
      insttNm: payload.insttNm || ""
    });
    window.sessionStorage.removeItem(STORAGE_KEY);
    await resetJoinSession();
    navigate(buildLocalizedPath("/home", "/en/home"));
  }

  function handleStatus() {
    logGovernanceScope("ACTION", "join-company-register-complete-status", {
      insttNm: payload.insttNm || ""
    });
    navigate(buildLocalizedPath("/join/companyJoinStatusGuide", "/join/en/companyJoinStatusGuide"));
  }

  return (
    <div className="bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen flex flex-col">
      <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>

      <div className="bg-white border-b border-[var(--kr-gov-border-light)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              alt={en ? "Government of the Republic of Korea Emblem" : "대한민국 정부 상징"}
              className="h-4"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8BPzqtzSLVGSrjt4mzhhVBy9SocCRDssk1F3XRVu7Xq9jHh7qzzt48wFi8qduCiJmB0LRQczPB7waPe3h0gkjn3jOEDxt6UJSJjdXNf8P-4WlM2BEZrfg2SL91uSiZrFcCk9KYrsdg-biTS9dtJ_OIghDBEVoAzMc33XcCYR_UP0QQdoYzBe840YrtH40xGyB9MSr0QH4D0foqlvOhG0jX8CDayXNlDsSKlfClVd3K2aodlwg4xSxgXHB3vnnnA0L2yNBNihQQg0"
            />
            <span className="text-[13px] font-medium text-[var(--kr-gov-text-secondary)]">
              {en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
            </span>
          </div>
        </div>
      </div>

      <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <a className="flex items-center gap-2" href={buildLocalizedPath("/home", "/en/home")}>
                <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 600" }}>eco</span>
                <div className="flex flex-col">
                  <h1 className={`text-xl font-bold tracking-tight text-[var(--kr-gov-text-primary)] ${en ? "uppercase" : ""}`}>
                    {en ? "CCUS Portal" : "CCUS 통합관리 포털"}
                  </h1>
                  <p className="text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider">Carbon Capture, Utilization and Storage</p>
                </div>
              </a>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-emerald-600 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                <span className="material-symbols-outlined text-[16px]">lock</span>
                {en ? "Secure SSL Communication Active" : "안전한 SSL 보안 통신 중"}
              </div>
              <div className="flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                <a className={`px-3 py-1 text-xs font-bold ${en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} href={`/join/companyRegisterComplete?${new URLSearchParams({ insttNm: payload.insttNm || "", bizrno: payload.bizrno || "", regDate: payload.regDate || "" }).toString()}`}>KO</a>
                <a className={`px-3 py-1 text-xs font-bold border-l border-[var(--kr-gov-border-light)] ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} href={`/join/en/companyRegisterComplete?${new URLSearchParams({ insttNm: payload.insttNm || "", bizrno: payload.bizrno || "", regDate: payload.regDate || "" }).toString()}`}>EN</a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow py-16 px-4" id="main-content">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12" role="status" aria-live="polite">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-50 rounded-full mb-6">
              <span className="material-symbols-outlined text-5xl text-emerald-600" style={{ fontVariationSettings: "'wght' 600" }}>check_circle</span>
            </div>
            <h2 className="text-3xl font-bold text-[var(--kr-gov-text-primary)] mb-4">
              {en ? "Registration Request Complete" : "회원사 등록 신청 완료"}
            </h2>
            <p className="text-lg text-[var(--kr-gov-text-secondary)]">
              {en ? "Your request for new member company registration has been successfully submitted." : "신규 회원사 등록 신청이 정상적으로 완료되었습니다."}
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-blue-100 rounded-lg p-8 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--kr-gov-blue)]"></div>
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-blue-600 mt-0.5">info</span>
                <div>
                  <h3 className="font-bold text-[var(--kr-gov-text-primary)] mb-2">
                    {en ? "Approval Process Information" : "승인 절차 안내"}
                  </h3>
                  <p className="text-[var(--kr-gov-text-secondary)] leading-relaxed">
                    {en ? "The submitted documents will be reviewed by the administrator, and the approval decision will be made within " : "제출하신 서류는 담당자가 확인 후 "}
                    <span className="text-[var(--kr-gov-blue)] font-bold">{en ? "2-3 business days" : "영업일 기준 2~3일 이내"}</span>
                    {en ? "." : "에 승인 여부가 결정됩니다."}
                    <br />
                    {en ? "The final approval result will be sent individually via " : "최종 승인 결과는 회원정보에 등록된 "}
                    <span className="font-bold">{en ? "SMS and email" : "SMS 및 이메일"}</span>
                    {en ? " registered in your member information." : "로 개별 안내 드립니다."}
                  </p>
                </div>
              </div>
            </div>

            <section className="bg-white border border-[var(--kr-gov-border-light)] rounded-lg overflow-hidden" data-help-id="join-company-register-complete-summary">
              <div className="bg-gray-50 px-6 py-4 border-b border-[var(--kr-gov-border-light)]">
                <h3 className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Application Summary" : "신청 내역 요약"}</h3>
              </div>
              <div className="p-6">
                <dl className={`grid grid-cols-1 ${en ? "sm:grid-cols-[160px_1fr]" : "sm:grid-cols-[140px_1fr]"} gap-y-4 text-sm`}>
                  <dt className="text-[var(--kr-gov-text-secondary)] font-medium">{en ? "Agency Name" : "신청 기관명"}</dt>
                  <dd className="text-[var(--kr-gov-text-primary)] font-bold">{payload.insttNm || "-"}</dd>
                  <dt className="text-[var(--kr-gov-text-secondary)] font-medium">{en ? "Business Reg. No." : "사업자등록번호"}</dt>
                  <dd className="text-[var(--kr-gov-text-primary)] font-bold">{payload.bizrno || "-"}</dd>
                  <dt className="text-[var(--kr-gov-text-secondary)] font-medium">{en ? "Application Date" : "신청 일시"}</dt>
                  <dd className="text-[var(--kr-gov-text-primary)] font-bold">{payload.regDate || "-"}</dd>
                </dl>
              </div>
            </section>

            <div className="flex flex-col items-center gap-6 pt-6" data-help-id="join-company-register-complete-actions">
              <button className="w-full sm:w-64 h-14 flex items-center justify-center bg-[var(--kr-gov-blue)] text-white text-lg font-bold rounded-[var(--kr-gov-radius)] hover:bg-[var(--kr-gov-blue-hover)] transition-colors shadow-lg shadow-blue-900/10" onClick={() => void handleHome()} type="button">
                {en ? "Go to Home" : "홈으로 이동"}
              </button>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Curious about your application status?" : "신청 현황이 궁금하신가요?"}</span>
                <button className="text-[var(--kr-gov-blue)] font-bold hover:underline underline-offset-4 flex items-center gap-1" onClick={handleStatus} type="button">
                  {en ? "Status Inquiry" : "조회 안내"} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-[var(--kr-gov-border-light)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img
                  alt={en ? "Government Emblem" : "대한민국 정부 상징"}
                  className="h-8 grayscale"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBUw404pm2QFmL61j73Dpfn72GnHGEg-KXTkLQ8WVJYUJ4iekrO0IvqJK8cd0cOSNSIh9Yq1LAodkSNj7oHtVAltdnnymj25ZzOI3l167qrrWmkEoYsZGu3ztT-YGo9se-fFR3NhBG3rZ8DYfs2vna0bxSzVG8VjryTnsz40LCDS2SN3-AeqXrbaPEva2ptmrQzO8iQSwbqSGyGKddlGf7FtnhHT25Cz5a5Xhk8MTve0BF4RWxN-ULiw64ZBbrTASIHQUaURqiZXyE"
                />
                <span className="text-xl font-black text-[var(--kr-gov-text-primary)]">
                  {en ? "Carbon Neutral CCUS Management Headquarters" : "탄소중립 CCUS 통합관리본부"}
                </span>
              </div>
              <address className="not-italic text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed">
                {en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Main Tel: 02-1234-5678" : "(04551) 서울특별시 중구 세종대로 110 | 대표전화: 02-1234-5678"}
                <br />
                © 2025 CCUS Integration Management Portal. All rights reserved.
              </address>
            </div>
            <div className="flex flex-col items-end gap-4">
              <div className="flex flex-wrap gap-6 text-sm font-bold">
                <a className="text-[var(--kr-gov-blue)] hover:underline" href="#">{en ? "Privacy Policy" : "개인정보처리방침"}</a>
                <a className="text-[var(--kr-gov-text-primary)] hover:underline" href="#">{en ? "Terms of Service" : "이용약관"}</a>
              </div>
              <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-[var(--kr-gov-bg-gray)] rounded-[var(--kr-gov-radius)] text-[11px] font-bold text-[var(--kr-gov-text-secondary)]">
                  {en ? "Last Updated:" : "최종 수정일:"} <time dateTime="2025-08-14">2025.08.14</time>
                </div>
                <img
                  alt={en ? "Web Accessibility Certification Mark" : "웹 접근성 품질인증 마크"}
                  className="h-10"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y"
                />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
