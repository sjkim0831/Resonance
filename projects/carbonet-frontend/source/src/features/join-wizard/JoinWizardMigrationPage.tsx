import { useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { resetJoinSession, saveJoinStep1 } from "../../lib/api/joinSession";
import { useJoinSession } from "../../app/hooks/useJoinSession";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, getSearchParam, isEnglish, navigate } from "../../lib/navigation/runtime";
import { EN_MEMBERSHIP_CARDS, KO_MEMBERSHIP_CARDS } from "../join/shared/membershipCards";

export function JoinWizardMigrationPage() {
  const en = isEnglish();
  const [membershipType, setMembershipType] = useState("EMITTER");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const sessionState = useJoinSession({
    onSuccess(payload) {
      setMembershipType(String(payload.membershipType || "EMITTER"));
    }
  });
  const session = sessionState.value;
  const error = actionError || sessionState.error;
  const cards = en ? EN_MEMBERSHIP_CARDS : KO_MEMBERSHIP_CARDS;

  useEffect(() => {
    if (getSearchParam("expired") === "1") {
      window.alert(en
        ? "Your session has expired. Please restart the sign-up process from Step 1."
        : "세션이 만료되었습니다. 회원가입을 처음부터 다시 진행해 주세요.");
      const url = new URL(window.location.href);
      url.searchParams.delete("expired");
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
    }
  }, [en]);

  useEffect(() => {
    logGovernanceScope("PAGE", "join-step1", {
      route: window.location.pathname,
      membershipType,
      canViewStep1: !!session?.canViewStep1
    });
    logGovernanceScope("COMPONENT", "join-step1-cards", {
      component: "join-step1-cards",
      membershipType,
      cardCount: cards.length
    });
  }, [cards.length, membershipType, session?.canViewStep1]);

  async function handleHome() {
    await resetJoinSession();
    navigate(buildLocalizedPath("/home", "/en/home"));
  }

  async function handleLanguageChange(nextEn: boolean) {
    await resetJoinSession();
    navigate(nextEn ? "/join/en/step1?init=T" : "/join/step1?init=T");
  }

  async function handleCardSelect(nextType: string) {
    logGovernanceScope("ACTION", "join-step1-select-type", {
      membershipType: nextType
    });
    setMembershipType(nextType);
    setActionError("");
    try {
      await saveJoinStep1(nextType);
      await sessionState.reload();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Failed to save join step1");
    }
  }

  async function handleNext() {
    logGovernanceScope("ACTION", "join-step1-next", {
      membershipType
    });
    setSubmitting(true);
    setActionError("");
    try {
      await saveJoinStep1(membershipType);
      navigate(buildLocalizedPath("/join/step2", "/join/en/step2"));
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Failed to save join step1");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="join-step1-screen bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen flex flex-col">
      <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>

      <UserGovernmentBar governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"} />
      <UserPortalHeader
        brandSubtitle="Carbon Footprint Platform"
        brandTitle={en ? "CCUS Carbon Footprint Platform" : "CCUS 탄소발자국 플랫폼"}
        onHomeClick={() => { void handleHome(); }}
        rightContent={<UserLanguageToggle en={en} onEn={() => { void handleLanguageChange(true); }} onKo={() => { void handleLanguageChange(false); }} />}
      />

      <main className="flex-grow py-12 px-4" id="main-content">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10" data-help-id="join-hero">
            <h2 className="text-3xl font-bold text-[var(--kr-gov-text-primary)] mb-2">{en ? "Registration" : "회원가입"}</h2>
            <p className="text-[var(--kr-gov-text-secondary)]">
              {en ? "Please select the membership type that fits your organization." : "사용자 환경에 맞는 회원 유형을 선택해 주세요."}
            </p>
          </div>

          <div className="max-w-5xl mx-auto mb-12">
            <div className="flex justify-between relative">
              {[
                en ? "Member Type" : "회원유형 선택",
                en ? "Terms" : "약관 동의",
                en ? "Verification" : "본인 확인",
                en ? "Information" : "정보 입력",
                en ? "Complete" : "가입 완료"
              ].map((label, index) => (
                <div className={`step-item ${index === 0 ? "step-active" : "step-inactive"}`} key={label}>
                  {index < 4 ? <div className="step-line"></div> : null}
                  <div className="step-circle">{`0${index + 1}`}</div>
                  <span className={`mt-3 text-sm ${index === 0 ? "font-bold text-[var(--kr-gov-blue)]" : "font-medium text-[var(--kr-gov-text-secondary)]"}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-error)]/30 bg-[var(--kr-gov-error)]/5 px-4 py-3 text-sm text-[var(--kr-gov-error)]">
              {error}
            </div>
          ) : null}

          <fieldset className="mb-12" data-help-id="join-step1-cards">
            <legend className="sr-only">{en ? "Membership type selection" : "회원 유형 선택"}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" data-help-id="membership-type-card-group">
              {cards.map((card) => {
                const active = membershipType === card.value;
                return (
                  <label
                    className={`type-card group${active ? " active" : ""}`}
                    key={card.value}
                    onClick={() => void handleCardSelect(card.value)}
                  >
                    <input
                      checked={active}
                      className="sr-only"
                      name="membership_type"
                      onChange={() => void handleCardSelect(card.value)}
                      required
                      type="radio"
                      value={card.value}
                    />
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors ${card.iconWrapClass} ${card.hoverIconWrapClass}`}>
                      <span className={`material-symbols-outlined text-4xl ${card.iconClass} group-hover:text-white`}>{card.icon}</span>
                    </div>
                    <h3 className="text-lg font-bold mb-3 break-keep">{card.title}</h3>
                    <p className="text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed whitespace-pre-line">{card.description}</p>
                    <div className={`check-icon absolute top-4 right-4 text-[var(--kr-gov-blue)]${active ? "" : " hidden"}`}>
                      <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-center justify-center gap-4" data-help-id="join-step1-actions">
            <div className="flex items-center justify-center gap-4" data-help-id="join-wizard-actions">
              <button
                className="w-40 h-14 border border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-primary)] flex items-center justify-center rounded-[var(--kr-gov-radius)] font-bold hover:bg-gray-50 transition-colors"
                onClick={() => void handleHome()}
                type="button"
              >
                {en ? "Home" : "홈으로"}
              </button>
              <button
                className="w-40 h-14 bg-[var(--kr-gov-blue)] text-white flex items-center justify-center rounded-[var(--kr-gov-radius)] font-bold hover:bg-[var(--kr-gov-blue-hover)] transition-colors"
                disabled={submitting || !session?.canViewStep1}
                onClick={() => void handleNext()}
                type="button"
              >
                {submitting ? "..." : en ? "Next" : "다음 단계"}
              </button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto mt-16 bg-white border border-[var(--kr-gov-border-light)] p-6 rounded-lg" data-help-id="join-step1-guide">
            <div className="flex gap-3">
              <span className="material-symbols-outlined text-blue-600">help</span>
              <div className="text-sm text-[var(--kr-gov-text-secondary)]">
                <p className="font-bold text-[var(--kr-gov-text-primary)] mb-1">{en ? "Registration Guide" : "회원가입 관련 안내"}</p>
                <ul className="list-disc ml-4 space-y-1">
                  {(en
                    ? [
                        "Corporate members require business registration number verification.",
                        "Executor and Promotion Center members may require additional approval.",
                        "Government members may need an official certificate or letter.",
                        "All information entered during registration is managed in accordance with applicable laws."
                      ]
                    : [
                        "기업 회원은 사업자등록번호 인증이 필요합니다.",
                        "수행 기업 및 진흥센터 회원은 관련 승인 절차가 진행될 수 있습니다.",
                        "기관 회원은 소속 기관의 인증서 또는 공문 확인이 필요할 수 있습니다.",
                        "가입 과정에서 입력하신 정보는 관련 법령에 따라 철저히 관리됩니다."
                      ]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-[var(--kr-gov-border-light)] mt-20">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-12 pb-8">
          <div className="flex flex-col md:flex-row justify-between gap-10 pb-10 border-b border-[var(--kr-gov-border-light)]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img alt={en ? "Emblem of the Republic of Korea" : "대한민국 정부 상징"} className="h-8 grayscale" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBUw404pm2QFmL61j73Dpfn72GnHGEg-KXTkLQ8WVJYUJ4iekrO0IvqJK8cd0cOSNSIh9Yq1LAodkSNj7oHtVAltdnnymj25ZzOI3l167qrrWmkEoYsZGu3ztT-YGo9se-fFR3NhBG3rZ8DYfs2vna0bxSzVG8VjryTnsz40LCDS2SN3-AeqXrbaPEva2ptmrQzO8iQSwbqSGyGKddlGf7FtnhHT25Cz5a5Xhk8MTve0BF4RWxN-ULiw64ZBbrTASIHQUaURqiZXyE" />
                <span className="text-xl font-black text-[var(--kr-gov-text-primary)]">{en ? "CCUS Integrated Management Office" : "CCUS 통합관리본부"}</span>
              </div>
              <address className="not-italic text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed">
                {en
                  ? "(04551) 110 Sejong-daero, Jung-gu, Seoul, Korea | Main Contact: 02-1234-5678 (Weekdays 09:00~18:00)"
                  : "(04551) 서울특별시 중구 세종대로 110 | 대표전화: 02-1234-5678 (평일 09:00~18:00)"}
                <br />
                {en
                  ? "This service manages greenhouse gas reduction performance in accordance with relevant laws."
                  : "본 서비스는 관계 법령에 의거하여 온실가스 감축 성과를 관리합니다."}
              </address>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold">
              {(en ? ["Privacy Policy", "Terms of Use", "Email Collection Refusal"] : ["개인정보처리방침", "이용약관", "이메일무단수집거부"]).map((item, index) => (
                <a
                  className={index === 0 ? "text-[var(--kr-gov-blue)] hover:underline" : "text-[var(--kr-gov-text-primary)] hover:underline"}
                  href="#"
                  key={item}
                  onClick={(event) => event.preventDefault()}
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
          <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-xs font-medium text-[var(--kr-gov-text-secondary)]">
              <p>© 2025 CCUS Carbon Footprint Platform. All rights reserved.</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 px-3 py-1 bg-[var(--kr-gov-bg-gray)] rounded-[var(--kr-gov-radius)] text-xs font-bold text-[var(--kr-gov-text-secondary)]">
                <span>{en ? "Last Modified:" : "최종 수정일:"}</span>
                <time dateTime="2025-08-14">2025.08.14</time>
              </div>
              <img alt={en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크"} className="h-10" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
