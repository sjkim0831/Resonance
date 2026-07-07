import { useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { resetJoinSession, saveJoinStep2 } from "../../lib/api/joinSession";
import { useJoinSession } from "../../app/hooks/useJoinSession";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AppButton, AppCheckbox } from "../app-ui/primitives";

const TERMS_KO = {
  title: "회원가입",
  subtitle: "서비스 이용을 위해 약관에 동의해 주세요.",
  steps: ["회원유형", "약관 동의", "본인 확인", "정보 입력", "가입 완료"],
  sectionTitle: "서비스 이용약관 동의",
  allAgree: "전체 약관에 모두 동의합니다.",
  required: "필수",
  optional: "선택",
  termsTitle: "서비스 이용약관",
  termsBody: `제1조(목적) 이 약관은 탄소중립 CCUS 통합관리 포털(이하 "포털"이라 한다)에서 제공하는 모든 서비스(이하 "서비스"라 한다)의 이용조건 및 절차, 이용자와 포털의 권리, 의무, 책임사항과 기타 필요한 사항을 규정함을 목적으로 합니다.\n\n제2조(용어의 정의) 1. "이용자"란 포털에 접속하여 이 약관에 따라 포털이 제공하는 서비스를 받는 회원 및 비회원을 말합니다. 2. "회원"이라 함은 포털에 개인정보를 제공하여 회원등록을 한 자로서, 포털의 정보를 지속적으로 제공받으며, 포털이 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.\n\n제3조(약관의 효력 및 변경) 1. 이 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공시함으로써 효력이 발생합니다. 2. 포털은 필요하다고 인정되는 경우 관계법령을 위배하지 않는 범위 내에서 이 약관을 개정할 수 있습니다.`,
  termsAgree: "이용약관에 동의합니다.",
  privacyTitle: "개인정보 수집 및 이용 동의",
  privacyBody: `탄소중립 CCUS 통합관리 포털은 「개인정보 보호법」 등 관련 법령에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보 처리방침을 수립·공개합니다.\n\n1. 개인정보의 수집 및 이용 목적: 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지, 각종 고지·통지 등.\n\n2. 수집하는 개인정보 항목: 성명, 아이디, 비밀번호, 이메일 주소, 전화번호, 소속 기관 정보 등.\n\n3. 개인정보의 보유 및 이용 기간: 회원 탈퇴 시까지 또는 서비스 종료 시까지 보유하며, 관계 법령의 규정에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.`,
  privacyAgree: "개인정보 수집 및 이용에 동의합니다.",
  marketingTitle: "마케팅 정보 수신 동의",
  marketingBody: "CCUS 관련 정책 뉴스레터, 세미나 안내 등 유익한 정보를 이메일 또는 SMS로 수신하시겠습니까? (미동의 시에도 서비스 이용이 가능합니다.)",
  marketingAgree: "마케팅 정보 수신에 동의합니다.",
  back: "이전",
  next: "동의하고 다음으로",
  footer: "본인 확인 및 약관 동의 절차는 이용자의 안전한 서비스 이용을 위해 필수적입니다.",
  guideLinks: ["개인정보처리방침", "이용약관", "이메일무단수집거부"]
};

const TERMS_EN = {
  title: "Registration",
  subtitle: "Please agree to the terms to use our services.",
  steps: ["Member Type", "Terms", "Verification", "Information", "Complete"],
  sectionTitle: "Terms of Service Agreement",
  allAgree: "I agree to all terms and conditions.",
  required: "Required",
  optional: "Optional",
  termsTitle: "Terms of Service",
  termsBody: `Article 1 (Purpose) These Terms and Conditions govern the conditions and procedures for using all services (hereinafter "Services") provided by the Carbon Neutrality CCUS Integrated Management Portal (hereinafter "Portal"), and stipulate the rights, obligations, responsibilities, and other necessary matters between users and the Portal.\n\nArticle 2 (Definitions) 1. "User" refers to members and non-members who access the Portal and receive services provided by the Portal in accordance with these Terms. 2. "Member" refers to a person who has registered as a member by providing personal information to the Portal, and who continuously receives information from the Portal and can continuously use the services provided by the Portal.\n\nArticle 3 (Effect and Amendment of Terms) 1. These Terms become effective when posted on the service screen or otherwise disclosed to users. 2. The Portal may amend these Terms within the scope not violating relevant laws and regulations when deemed necessary.`,
  termsAgree: "I agree to the Terms of Service.",
  privacyTitle: "Personal Information Collection and Use",
  privacyBody: `The Carbon Neutrality CCUS Integrated Management Portal establishes and discloses the following personal information processing policy to protect users' personal information in accordance with relevant laws such as the Personal Information Protection Act, and to handle related complaints promptly and smoothly.\n\n1. Purpose of collection and use: Verification of membership registration intent, identity verification and authentication for membership services, maintenance and management of membership, prevention of unauthorized use of services, various notices and notifications, etc.\n\n2. Items collected: Name, user ID, password, email address, phone number, affiliated organization information, etc.\n\n3. Retention period: Retained until membership withdrawal or service termination; retained for the required period if preservation is required by relevant laws and regulations.`,
  privacyAgree: "I agree to the collection and use of personal information.",
  marketingTitle: "Marketing Information Consent",
  marketingBody: "Would you like to receive useful information such as CCUS-related policy newsletters and seminar announcements by email or SMS? (Service is available even without consent.)",
  marketingAgree: "I agree to receive marketing information.",
  back: "Back",
  next: "Agree and Continue",
  footer: "Identity verification and terms agreement are required for safe service use.",
  guideLinks: ["Privacy Policy", "Terms of Use", "Email Collection Refusal"]
};

export function JoinTermsMigrationPage() {
  const en = isEnglish();
  const copy = en ? TERMS_EN : TERMS_KO;
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [marketingAgree, setMarketingAgree] = useState(false);
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const sessionState = useJoinSession({
    onSuccess(payload) {
      const joinVO = (payload.joinVO || {}) as Record<string, unknown>;
      setMarketingAgree(String(joinVO.marketingYn || "N").toUpperCase() === "Y");
    }
  });
  const session = sessionState.value;
  const error = actionError || sessionState.error;

  useEffect(() => {
    logGovernanceScope("PAGE", "join-step2", {
      route: window.location.pathname,
      canViewStep2: !!session?.canViewStep2
    });
    logGovernanceScope("COMPONENT", "join-step2-required-terms", {
      component: "join-step2-required-terms",
      agreeTerms,
      agreePrivacy,
      marketingAgree
    });
  }, [agreePrivacy, agreeTerms, marketingAgree, session?.canViewStep2]);

  async function handleHome() {
    await resetJoinSession();
    navigate(buildLocalizedPath("/home", "/en/home"));
  }

  async function handleLanguageChange(nextEn: boolean) {
    navigate(nextEn ? "/join/en/step1" : "/join/step1");
  }

  async function handleMarketingChange(checked: boolean) {
    logGovernanceScope("ACTION", "join-step2-marketing", {
      marketingAgree: checked
    });
    setMarketingAgree(checked);
    try {
      await saveJoinStep2(checked ? "Y" : "N");
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Failed to save join step2");
    }
  }

  async function handleNext() {
    logGovernanceScope("ACTION", "join-step2-next", {
      agreeTerms,
      agreePrivacy,
      marketingAgree
    });
    if (!agreeTerms || !agreePrivacy) {
      setActionError(en ? "Please agree to the required terms." : "필수 약관에 동의해 주세요.");
      return;
    }
    setSubmitting(true);
    setActionError("");
    try {
      await saveJoinStep2(marketingAgree ? "Y" : "N");
      navigate(buildLocalizedPath("/join/step3", "/join/en/step3"));
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Failed to save join step2");
    } finally {
      setSubmitting(false);
    }
  }

  const allChecked = agreeTerms && agreePrivacy;

  return (
    <div className="join-step2-screen bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen flex flex-col">
      <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>

      <div className="bg-white border-b border-[var(--kr-gov-border-light)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img alt={en ? "Emblem of the Republic of Korea" : "대한민국 정부 상징"} className="h-4" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8BPzqtzSLVGSrjt4mzhhVBy9SocCRDssk1F3XRVu7Xq9jHh7qzzt48wFi8qduCiJmB0LRQczPB7waPe3h0gkjn3jOEDxt6UJSJjdXNf8P-4WlM2BEZrfg2SL91uSiZrFcCk9KYrsdg-biTS9dtJ_OIghDBEVoAzMc33XcCYR_UP0QQdoYzBe840YrtH40xGyB9MSr0QH4D0foqlvOhG0jX8CDayXNlDsSKlfClVd3K2aodlwg4xSxgXHB3vnnnA0L2yNBNihQQg0" />
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
                <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 600" }}>eco</span>
                <div className="flex flex-col">
                  <h1 className="text-lg font-bold tracking-tight text-[var(--kr-gov-text-primary)] leading-none">
                    {en ? "CCUS Carbon Footprint Platform" : "CCUS 탄소발자국 플랫폼"}
                  </h1>
                  <p className="text-[9px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider mt-1">Carbon Footprint Platform</p>
                </div>
              </a>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                <AppButton className={en ? "rounded-none border-0 bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "rounded-none border-0 bg-[var(--kr-gov-blue)] text-white"} id="langKoBtn" onClick={() => void handleLanguageChange(false)} size="xs" type="button" variant="ghost">KO</AppButton>
                <AppButton className={`rounded-none border-l border-[var(--kr-gov-border-light)] ${en ? "border-0 bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} id="langEnBtn" onClick={() => void handleLanguageChange(true)} size="xs" type="button" variant="ghost">EN</AppButton>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow py-12 px-4" id="main-content">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[var(--kr-gov-text-primary)] mb-2">{copy.title}</h2>
            <p className="text-[var(--kr-gov-text-secondary)]">{copy.subtitle}</p>
          </div>

          <div className="max-w-5xl mx-auto mb-12">
            <div className="flex justify-between relative">
              {copy.steps.map((label, index) => (
                <div className={`step-item ${index === 0 ? "step-completed" : index === 1 ? "step-active" : "step-inactive"}`} key={label}>
                  {index < 4 ? <div className="step-line"></div> : null}
                  <div className="step-circle">
                    {index === 0 ? <span className="material-symbols-outlined !text-[20px]">check</span> : `0${index + 1}`}
                  </div>
                  <span className={`mt-3 text-sm ${index === 1 ? "font-bold text-[var(--kr-gov-blue)]" : "font-medium text-[var(--kr-gov-text-secondary)]"}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-error)]/30 bg-[var(--kr-gov-error)]/5 px-4 py-3 text-sm text-[var(--kr-gov-error)]">
              {error}
            </div>
          ) : null}

          <div className="bg-white border border-[var(--kr-gov-border-light)] rounded-lg shadow-sm p-8 lg:p-10">
            <h3 className="text-xl font-bold text-[var(--kr-gov-text-primary)] mb-8 border-l-4 border-[var(--kr-gov-blue)] pl-4">
              {copy.sectionTitle}
            </h3>
            <div className="mb-10 bg-blue-50 border border-blue-100 p-5 rounded-[var(--kr-gov-radius)]" data-help-id="join-step2-all-agree">
              <label className="flex items-center cursor-pointer">
                <AppCheckbox
                  checked={allChecked}
                  className="h-6 w-6"
                  id="all-check"
                  onChange={(event) => {
                    setAgreeTerms(event.target.checked);
                    setAgreePrivacy(event.target.checked);
                  }}
                />
                <span className="ml-3 text-lg font-bold text-[var(--kr-gov-blue)]">{copy.allAgree}</span>
              </label>
            </div>

            <form className="space-y-10" onSubmit={(event) => {
              event.preventDefault();
              void handleNext();
            }}>
              <div className="space-y-4" data-help-id="join-step2-required-terms">
                <div className="flex justify-between items-end">
                  <label className="flex items-center">
                    <span className="px-2 py-0.5 bg-[#d32f2f] text-white text-[11px] font-bold rounded mr-2">{copy.required}</span>
                    <span className="text-lg font-bold text-[var(--kr-gov-text-primary)]">{copy.termsTitle}</span>
                  </label>
                </div>
                <div aria-label={copy.termsTitle} className="terms-scroll whitespace-pre-line" role="region" tabIndex={0}>{copy.termsBody}</div>
                <div className="flex justify-end">
                  <label className="flex items-center cursor-pointer">
                    <AppCheckbox checked={agreeTerms} className="term-check" id="agree-terms" name="agreeTerms" onChange={(event) => setAgreeTerms(event.target.checked)} required />
                    <span className="ml-2 text-[15px] font-medium text-[var(--kr-gov-text-secondary)]">{copy.termsAgree}</span>
                  </label>
                </div>
              </div>

              <div className="space-y-4" data-help-id="join-step2-required-terms">
                <div className="flex justify-between items-end">
                  <label className="flex items-center">
                    <span className="px-2 py-0.5 bg-[#d32f2f] text-white text-[11px] font-bold rounded mr-2">{copy.required}</span>
                    <span className="text-lg font-bold text-[var(--kr-gov-text-primary)]">{copy.privacyTitle}</span>
                  </label>
                </div>
                <div aria-label={copy.privacyTitle} className="terms-scroll whitespace-pre-line" role="region" tabIndex={0}>{copy.privacyBody}</div>
                <div className="flex justify-end">
                  <label className="flex items-center cursor-pointer">
                    <AppCheckbox checked={agreePrivacy} className="term-check" id="agree-privacy" name="agreePrivacy" onChange={(event) => setAgreePrivacy(event.target.checked)} required />
                    <span className="ml-2 text-[15px] font-medium text-[var(--kr-gov-text-secondary)]">{copy.privacyAgree}</span>
                  </label>
                </div>
              </div>

              <div className="space-y-4" data-help-id="join-step2-marketing">
                <div className="flex justify-between items-end">
                  <label className="flex items-center">
                    <span className="px-2 py-0.5 bg-gray-500 text-white text-[11px] font-bold rounded mr-2">{copy.optional}</span>
                    <span className="text-lg font-bold text-[var(--kr-gov-text-primary)]">{copy.marketingTitle}</span>
                  </label>
                </div>
                <div className="p-5 bg-gray-50 border border-[var(--kr-gov-border-light)] text-sm text-[var(--kr-gov-text-secondary)]">{copy.marketingBody}</div>
                <div className="flex justify-end">
                  <label className="flex items-center cursor-pointer">
                    <AppCheckbox checked={marketingAgree} id="marketing_agree" onChange={(event) => void handleMarketingChange(event.target.checked)} />
                    <span className="ml-2 text-[15px] font-medium text-[var(--kr-gov-text-secondary)]">{copy.marketingAgree}</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <AppButton className="flex-1 text-lg" onClick={() => navigate(buildLocalizedPath("/join/step1", "/join/en/step1"))} size="lg" type="button">
                  {copy.back}
                </AppButton>
                <AppButton className="flex-[2] text-lg" disabled={submitting || !session?.canViewStep2} size="lg" type="submit" variant="primary">
                  {submitting ? "..." : copy.next}
                </AppButton>
              </div>
            </form>
          </div>

          <p className="mt-8 text-sm text-[var(--kr-gov-text-secondary)] text-center">{copy.footer}</p>
        </div>
      </main>
    </div>
  );
}
