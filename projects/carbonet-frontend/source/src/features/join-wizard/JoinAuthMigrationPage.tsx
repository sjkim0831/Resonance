import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { resetJoinSession, saveJoinStep3 } from "../../lib/api/joinSession";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type AuthOption = {
  method: string;
  icon: string;
  title: string;
  description: string;
};

const AUTH_OPTIONS_KO: AuthOption[] = [
  {
    method: "ONEPASS",
    icon: "smartphone",
    title: "디지털 원패스",
    description: "하나의 아이디로 모든\n정부 서비스를 이용합니다."
  },
  {
    method: "JOINT",
    icon: "verified_user",
    title: "공동인증서",
    description: "기존 공인인증서를 사용하여\n본인을 확인합니다."
  },
  {
    method: "FINANCIAL",
    icon: "account_balance",
    title: "금융인증서",
    description: "클라우드 기반의 금융인증서로\n간편하게 인증합니다."
  },
  {
    method: "SIMPLE",
    icon: "qr_code_scanner",
    title: "간편인증 (카카오, 토스 등)",
    description: "민간 인증서의 간편한\n인증 절차를 이용합니다."
  },
  {
    method: "EMAIL",
    icon: "mail",
    title: "이메일 인증",
    description: "해외 거주자 또는 이메일을 통한\n본인확인이 필요한 경우 이용합니다."
  }
];

const AUTH_OPTIONS_EN: AuthOption[] = [
  {
    method: "ONEPASS",
    icon: "smartphone",
    title: "Digital One-Pass",
    description: "Access all government services\nwith a single account."
  },
  {
    method: "JOINT",
    icon: "verified_user",
    title: "Joint Certificate",
    description: "Verify using your existing\njoint certificate."
  },
  {
    method: "FINANCIAL",
    icon: "account_balance",
    title: "Financial Certificate",
    description: "Easy verification via\ncloud-based financial certificate."
  },
  {
    method: "SIMPLE",
    icon: "qr_code_scanner",
    title: "Easy Auth (Kakao, Toss, etc.)",
    description: "Simple process via popular\nprivate certificates."
  },
  {
    method: "EMAIL",
    icon: "mail",
    title: "Email Verification",
    description: "Verification for overseas users\nvia registered email address."
  }
];

export function JoinAuthMigrationPage() {
  const en = isEnglish();
  const options = en ? AUTH_OPTIONS_EN : AUTH_OPTIONS_KO;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [submittingMethod, setSubmittingMethod] = useState("");
  const [error, setError] = useState("");
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function resolveCertificationGatewayPath(pathname: string) {
    if (typeof window === "undefined") {
      return pathname;
    }
    try {
      const url = new URL(window.location.origin);
      url.protocol = window.location.protocol === "https:" ? "https:" : "http:";
      url.port = "9000";
      url.pathname = pathname;
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch (_error) {
      return pathname;
    }
  }

  useEffect(() => {
    logGovernanceScope("PAGE", "join-step3", {
      route: window.location.pathname,
      optionCount: options.length,
      selectedMethod: options[selectedIndex]?.method ?? ""
    });
    logGovernanceScope("COMPONENT", "join-step3-auth-options", {
      component: "join-step3-auth-options",
      optionCount: options.length,
      selectedMethod: options[selectedIndex]?.method ?? ""
    });
  }, [options, selectedIndex]);

  useEffect(() => {
    if (selectedIndex >= options.length) {
      setSelectedIndex(0);
    }
  }, [options.length, selectedIndex]);

  async function handleHome() {
    await resetJoinSession();
    navigate(buildLocalizedPath("/home", "/en/home"));
  }

  function handleLanguageChange(nextEn: boolean) {
    navigate(nextEn ? "/join/en/step1" : "/join/step1");
  }

  async function proceedToStep4(method: string) {
    logGovernanceScope("ACTION", "join-step3-next", {
      method
    });
    if (submittingMethod) {
      return;
    }
    setError("");
    setSubmittingMethod(method);
    try {
      await saveJoinStep3(method);
      navigate(buildLocalizedPath("/join/step4", "/join/en/step4"));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : (en ? "Failed to continue to the next step." : "다음 단계로 이동하지 못했습니다."));
    } finally {
      setSubmittingMethod("");
    }
  }

  function handleAuth(method: string) {
    logGovernanceScope("ACTION", "join-step3-auth", {
      method
    });
    if (method === "JOINT" || method === "FINANCIAL") {
      window.open(resolveCertificationGatewayPath("/certlogin/utl/sec/certVar.do"), "certPopup", "width=500,height=600");
      window.setTimeout(() => {
        void proceedToStep4(method);
      }, 1000);
      return;
    }
    if (method === "ONEPASS") {
      window.open(resolveCertificationGatewayPath("/gnrlogin/utl/sec/certVar.do"), "gnrPopup", "width=500,height=600");
      window.setTimeout(() => {
        void proceedToStep4(method);
      }, 1000);
      return;
    }
    if (method === "SIMPLE") {
      void proceedToStep4(method);
      return;
    }
    if (method === "EMAIL") {
      const userEmail = window.prompt(en ? "Please enter your email address for verification." : "인증할 이메일 주소를 입력해 주세요.");
      if (userEmail) {
        window.alert(en ? `A verification code has been sent to ${userEmail}. (Mock)` : `${userEmail} 경로로 인증번호를 발송했습니다. (Mock)`);
        void proceedToStep4(method);
      }
      return;
    }
    void proceedToStep4(method);
  }

  function getColumnCount() {
    if (typeof window === "undefined") {
      return 3;
    }
    if (window.innerWidth >= 1024) {
      return 3;
    }
    if (window.innerWidth >= 640) {
      return 2;
    }
    return 1;
  }

  function focusOption(nextIndex: number) {
    setSelectedIndex(nextIndex);
    window.requestAnimationFrame(() => {
      optionRefs.current[nextIndex]?.focus();
    });
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const columns = getColumnCount();
    let nextIndex = index;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % options.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + options.length) % options.length;
        break;
      case "ArrowDown": {
        const nextRowIndex = index + columns;
        if (nextRowIndex < options.length) {
          nextIndex = nextRowIndex;
        } else {
          const remainder = index % columns;
          if (index < columns) {
            const lastRowStart = Math.floor((options.length - 1) / columns) * columns;
            nextIndex = Math.min(lastRowStart + remainder, options.length - 1);
          } else {
            nextIndex = remainder;
          }
        }
        break;
      }
      case "ArrowUp": {
        const previousRowIndex = index - columns;
        if (previousRowIndex >= 0) {
          nextIndex = previousRowIndex;
        } else {
          const remainder = index % columns;
          const lastRowStart = Math.floor((options.length - 1) / columns) * columns;
          nextIndex = Math.min(lastRowStart + remainder, options.length - 1);
        }
        break;
      }
      case " ":
      case "Enter":
        event.preventDefault();
        void handleAuth(options[index].method);
        return;
      default:
        return;
    }

    event.preventDefault();
    focusOption(nextIndex);
  }

  const selectedOption = options[selectedIndex] ?? options[0];

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
            <p className="text-[var(--kr-gov-text-secondary)]">
              {en ? "Please complete identity verification for secure service access." : "안전한 서비스 이용을 위해 본인확인을 진행해 주세요."}
            </p>
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
              <div className="step-item step-active">
                <div className="step-line"></div>
                <div className="step-circle">03</div>
                <span className="mt-3 text-sm font-bold text-[var(--kr-gov-blue)]">{en ? "Verification" : "본인 확인"}</span>
              </div>
              <div className="step-item step-inactive">
                <div className="step-line"></div>
                <div className="step-circle">04</div>
                <span className="mt-3 text-sm font-medium text-[var(--kr-gov-text-secondary)]">{en ? "Information" : "정보 입력"}</span>
              </div>
              <div className="step-item step-inactive">
                <div className="step-circle">05</div>
                <span className="mt-3 text-sm font-medium text-[var(--kr-gov-text-secondary)]">{en ? "Complete" : "가입 완료"}</span>
              </div>
            </div>
          </div>

          <div className="join-auth-selection-bar max-w-6xl mx-auto mb-6" role="status" aria-live="polite">
            <div>
              <p className="join-auth-selection-eyebrow">{en ? "Current selection" : "현재 선택"}</p>
              <strong className="join-auth-selection-title">{selectedOption.title}</strong>
              <p className="join-auth-selection-description">{selectedOption.description.replace(/\n/g, " ")}</p>
            </div>
            <p className="join-auth-selection-help">
              {en ? "Use arrow keys to move, then press Enter or Space to continue." : "방향키로 이동한 뒤 Enter 또는 Space로 바로 진행할 수 있습니다."}
            </p>
          </div>

          <div
            aria-activedescendant={`join-auth-option-${selectedOption.method}`}
            aria-label={en ? "Select identity verification method" : "본인인증 수단 선택"}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16"
            data-help-id="join-step3-methods"
            id="authForm"
            role="radiogroup"
          >
            {options.map((option, index) => (
              <button
                aria-checked={selectedIndex === index}
                className={`auth-card group ${selectedIndex === index ? "auth-card-selected" : ""}`}
                disabled={Boolean(submittingMethod)}
                id={`join-auth-option-${option.method}`}
                key={option.method}
                onClick={() => {
                  setSelectedIndex(index);
                  void handleAuth(option.method);
                }}
                onFocus={() => setSelectedIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                role="radio"
                tabIndex={selectedIndex === index ? 0 : -1}
                type="button"
              >
                <div className="icon-box">
                  <span className="material-symbols-outlined">{option.icon}</span>
                </div>
                <span className="auth-card-badge">{en ? "Selected" : "선택됨"}</span>
                <h3 className="text-lg font-bold mb-3">{option.title}</h3>
                <p className="text-xs text-[var(--kr-gov-text-secondary)] leading-relaxed whitespace-pre-line">{option.description}</p>
              </button>
            ))}
          </div>

          {error ? (
            <div className="max-w-3xl mx-auto mb-8 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-center">
            <button
              className="w-48 h-14 border border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-primary)] flex items-center justify-center rounded-[var(--kr-gov-radius)] font-bold hover:bg-gray-50 transition-colors"
              onClick={() => window.history.back()}
              type="button"
            >
              <span className="material-symbols-outlined mr-2">arrow_back</span>
              {en ? "Previous" : "이전 단계"}
            </button>
          </div>

          <div className="max-w-5xl mx-auto mt-20 bg-white border border-[var(--kr-gov-border-light)] p-8 rounded-lg">
            <div className="flex gap-4">
              <span className="material-symbols-outlined text-blue-600 mt-0.5">info</span>
              <div className="text-[15px] text-[var(--kr-gov-text-secondary)]">
                <p className="font-bold text-[var(--kr-gov-text-primary)] mb-2">{en ? "Identity Verification Guide" : "본인인증 안내사항"}</p>
                <ul className="list-disc ml-5 space-y-1.5">
                  {(en
                    ? [
                        "The identity verification information must match the information entered during registration.",
                        "Using someone else's identity for verification may result in penalties under relevant laws.",
                        "For issues during the verification process, please contact the customer service of each verification method.",
                        "For corporate members, personal identity verification of the person in charge may be required."
                      ]
                    : [
                        "입력하신 본인확인 정보는 가입 시 입력된 정보와 일치해야 합니다.",
                        "타인의 명의를 도용하여 본인확인을 진행할 경우 관련 법령에 따라 처벌받을 수 있습니다.",
                        "인증 과정에서 발생하는 문제는 각 인증 수단별 고객센터로 문의해 주시기 바랍니다.",
                        "법인 회원의 경우, 담당자 개인의 본인인증이 필요할 수 있습니다."
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
                <img
                  alt={en ? "Emblem of the Republic of Korea" : "대한민국 정부 상징"}
                  className="h-8 grayscale"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBUw404pm2QFmL61j73Dpfn72GnHGEg-KXTkLQ8WVJYUJ4iekrO0IvqJK8cd0cOSNSIh9Yq1LAodkSNj7oHtVAltdnnymj25ZzOI3l167qrrWmkEoYsZGu3ztT-YGo9se-fFR3NhBG3rZ8DYfs2vna0bxSzVG8VjryTnsz40LCDS2SN3-AeqXrbaPEva2ptmrQzO8iQSwbqSGyGKddlGf7FtnhHT25Cz5a5Xhk8MTve0BF4RWxN-ULiw64ZBbrTASIHQUaURqiZXyE"
                />
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
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
