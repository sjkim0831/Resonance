import { useEffect } from "react";
import { StandardUserFooter } from "../../components/user-shell/StandardUserFooter";
import { logGovernanceScope } from "../../app/policy/debug";
import { resetJoinSession } from "../../lib/api/joinSession";
import { buildLocalizedPath, getSearchParam, isEnglish, navigate } from "../../lib/navigation/runtime";

type JoinCompletePayload = {
  mberId?: string;
  mberNm?: string;
  insttNm?: string;
};

const STORAGE_KEY = "carbonet.join.step5";

function readPayload(): JoinCompletePayload {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as JoinCompletePayload;
    }
  } catch {
  }
  return {
    mberId: getSearchParam("mberId"),
    mberNm: getSearchParam("mberNm"),
    insttNm: getSearchParam("insttNm")
  };
}

export function JoinCompleteMigrationPage() {
  const en = isEnglish();
  const payload = readPayload();

  useEffect(() => {
    logGovernanceScope("PAGE", "join-step5", {
      route: window.location.pathname,
      memberId: payload.mberId || "",
      insttNm: payload.insttNm || ""
    });
    logGovernanceScope("COMPONENT", "join-step5-summary", {
      component: "join-step5-summary",
      memberId: payload.mberId || "",
      memberName: payload.mberNm || ""
    });
  }, [payload.insttNm, payload.mberId, payload.mberNm]);

  async function handleHome() {
    logGovernanceScope("ACTION", "join-step5-home", {
      memberId: payload.mberId || ""
    });
    window.sessionStorage.removeItem(STORAGE_KEY);
    await resetJoinSession();
    navigate(buildLocalizedPath("/home", "/en/home"));
  }

  function handleLanguageChange(nextEn: boolean) {
    navigate(nextEn ? "/join/en/step1" : "/join/step1");
  }

  return (
    <div className="bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen flex flex-col">
      <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>

      <div className="bg-white border-b border-[var(--kr-gov-border-light)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              alt={en ? "Emblem of the Republic of Korea" : "대한민국 정부 상징"}
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
            <div className="flex items-center gap-3 shrink-0">
              <a className="flex items-center gap-2 focus-visible" href="#" onClick={(event) => {
                event.preventDefault();
                void handleHome();
              }}>
                <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 600" }}>
                  eco
                </span>
                <div className="flex flex-col">
                  <h1 className="text-lg font-bold tracking-tight text-[var(--kr-gov-text-primary)] leading-none">
                    {en ? "CCUS Carbon Footprint Platform" : "CCUS 탄소발자국 플랫폼"}
                  </h1>
                  <p className="text-[9px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider mt-1">
                    Carbon Footprint Platform
                  </p>
                </div>
              </a>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                <button
                  className={en ? "px-3 py-1 text-xs font-bold bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "px-3 py-1 text-xs font-bold bg-[var(--kr-gov-blue)] text-white"}
                  id="langKoBtn"
                  onClick={() => handleLanguageChange(false)}
                  type="button"
                >
                  KO
                </button>
                <button
                  className={en ? "px-3 py-1 text-xs font-bold border-l border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-blue)] text-white" : "px-3 py-1 text-xs font-bold border-l border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}
                  id="langEnBtn"
                  onClick={() => handleLanguageChange(true)}
                  type="button"
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow py-12 px-4" id="main-content">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[var(--kr-gov-text-primary)] mb-2">{en ? "Registration" : "회원가입"}</h2>
            <p className="text-[var(--kr-gov-text-secondary)]">{en ? "Your application has been submitted." : "가입 신청이 완료되었습니다."}</p>
          </div>

          <div className="max-w-5xl mx-auto mb-12">
            <div className="flex justify-between relative">
              <div className="step-item step-completed">
                <div className="step-line"></div>
                <div className="step-circle"><span className="material-symbols-outlined !text-[20px]">check</span></div>
                <span className="mt-3 text-sm font-medium text-[var(--kr-gov-text-secondary)]">{en ? "Member Type" : "회원유형"}</span>
              </div>
              <div className="step-item step-completed">
                <div className="step-line"></div>
                <div className="step-circle"><span className="material-symbols-outlined !text-[20px]">check</span></div>
                <span className="mt-3 text-sm font-medium text-[var(--kr-gov-text-secondary)]">{en ? "Terms" : "약관 동의"}</span>
              </div>
              <div className="step-item step-completed">
                <div className="step-line"></div>
                <div className="step-circle"><span className="material-symbols-outlined !text-[20px]">check</span></div>
                <span className="mt-3 text-sm font-medium text-[var(--kr-gov-text-secondary)]">{en ? "Verification" : "본인 확인"}</span>
              </div>
              <div className="step-item step-completed">
                <div className="step-line"></div>
                <div className="step-circle"><span className="material-symbols-outlined !text-[20px]">check</span></div>
                <span className="mt-3 text-sm font-medium text-[var(--kr-gov-text-secondary)]">{en ? "Information" : "정보 입력"}</span>
              </div>
              <div className="step-item step-active">
                <div className="step-circle">05</div>
                <span className="mt-3 text-sm font-bold text-[var(--kr-gov-blue)]">{en ? "Complete" : "가입 완료"}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[var(--kr-gov-border-light)] rounded-lg shadow-sm p-8 lg:p-12 text-center" data-help-id="join-step5-summary" role="status" aria-live="polite">
            <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 text-[var(--kr-gov-blue)]">
              <span className="material-symbols-outlined text-[48px]" style={{ fontVariationSettings: "'wght' 600" }}>check_circle</span>
            </div>
            <h3 className="text-2xl font-bold text-[var(--kr-gov-text-primary)] mb-4">{en ? "Application Submitted" : "가입 신청 완료"}</h3>
            <p className="text-lg text-[var(--kr-gov-text-primary)] font-medium mb-2">
              {en ? "Your registration application has been successfully submitted." : "회원가입 신청이 정상적으로 완료되었습니다."}
            </p>
            <div className="bg-gray-50 border border-gray-100 p-6 rounded-lg mb-10 text-left max-w-xl mx-auto">
              <p className="text-[var(--kr-gov-text-secondary)] text-sm leading-relaxed mb-4">
                {en
                  ? "You will be able to use all services after administrator approval is completed."
                  : "운영자의 승인이 완료된 후 모든 서비스를 이용하실 수 있습니다."}
                <br />
                {en
                  ? "Approval results will be sent to your registered email and SMS."
                  : "승인 결과는 등록하신 이메일과 SMS로 안내해 드립니다."}
              </p>
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-500">{en ? "Name" : "이름"}</span>
                  <span className="text-sm font-medium text-[var(--kr-gov-text-primary)]">{payload.mberNm || (en ? "John Doe" : "홍길동")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-500">{en ? "User ID" : "아이디"}</span>
                  <span className="text-sm font-medium text-[var(--kr-gov-text-primary)]">{payload.mberId || "ccus_user_01"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-500">{en ? "Organization" : "소속 기관"}</span>
                  <span className="text-sm font-medium text-[var(--kr-gov-text-primary)]">{payload.insttNm || (en ? "Korea Energy Agency" : "한국에너지공단")}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4" data-help-id="join-step5-actions">
              <button
                className="flex items-center justify-center h-14 bg-[var(--kr-gov-blue)] text-white text-lg font-bold rounded-[var(--kr-gov-radius)] hover:bg-[var(--kr-gov-blue-hover)] transition-colors focus-visible"
                onClick={() => void handleHome()}
                type="button"
              >
                {en ? "Go to Home" : "홈으로 이동"}
              </button>
            </div>
          </div>
          <p className="mt-8 text-sm text-[var(--kr-gov-text-secondary)] text-center">
            {en
              ? "For inquiries regarding approval, please contact the administrator at 02-1234-5678."
              : "승인과 관련된 문의사항은 관리자(02-1234-5678)에게 문의하시기 바랍니다."}
          </p>
        </div>
      </main>

      <StandardUserFooter english={en} />
    </div>
  );
}
